import os
import sys
from datetime import datetime, timezone, timedelta
import time
import psycopg2
from psycopg2.extras import execute_values
import praw
import re
from dotenv import load_dotenv


def slugify(text: str) -> str:
	text = re.sub(r"[^a-zA-Z0-9\s-]", "", text).strip().lower()
	text = re.sub(r"[\s_-]+", "-", text)
	return text[:120]


def get_env(name: str, default: str = "") -> str:
	val = os.getenv(name)
	return val if val is not None else default


def get_int_env(name: str, default: int) -> int:
	"""Parse integer env values safely, tolerating inline comments."""
	raw = get_env(name, str(default)).strip()
	m = re.search(r"-?\d+", raw)
	return int(m.group(0)) if m else default


def connect_db():
	dsn = get_env("DATABASE_URL")
	if not dsn:
		raise RuntimeError("DATABASE_URL is required")
	sslmode = "require" if get_env("PGSSL") == "true" else None
	if sslmode:
		dsn = dsn + ("?sslmode=require" if "?" not in dsn else "&sslmode=require")
	return psycopg2.connect(dsn)


def ensure_schema(conn):
	with conn.cursor() as cur:
		cur.execute(
			"""
			CREATE TABLE IF NOT EXISTS stories (
				id BIGSERIAL PRIMARY KEY,
				reddit_id TEXT UNIQUE,
				title TEXT NOT NULL,
				subreddit TEXT NOT NULL,
				author TEXT,
				url TEXT,
				score INTEGER DEFAULT 0,
				num_comments INTEGER DEFAULT 0,
				created_at TIMESTAMPTZ NOT NULL,
				content TEXT,
				slug TEXT NOT NULL UNIQUE
			);
			"""
		)
		conn.commit()


def upsert_stories(conn, items):
	values = [
		(
			i["reddit_id"],
			i["title"],
			i["subreddit"],
			i.get("author"),
			i.get("url"),
			i.get("score", 0),
			i.get("num_comments", 0),
			i["created_at"],
			i.get("content"),
			i["slug"],
		)
		for i in items
	]
	with conn.cursor() as cur:
		execute_values(
			cur,
			"""
			INSERT INTO stories (reddit_id, title, subreddit, author, url, score, num_comments, created_at, content, slug)
			VALUES %s
			ON CONFLICT (reddit_id) DO UPDATE SET
				title = EXCLUDED.title,
				score = EXCLUDED.score,
				num_comments = EXCLUDED.num_comments,
				content = COALESCE(NULLIF(EXCLUDED.content, ''), stories.content)
			""",
			values,
		)
		conn.commit()


def fetch_from_reddit():
	reddit = praw.Reddit(
		client_id=get_env("REDDIT_CLIENT_ID"),
		client_secret=get_env("REDDIT_CLIENT_SECRET"),
		user_agent=get_env("REDDIT_USER_AGENT", "redditxstory/0.1 by script"),
	)
	# Strictly read from subreddits table; fallback to baked defaults only if table empty/unavailable
	subs = []
	try:
		conn = connect_db()
		with conn.cursor() as cur:
			cur.execute("SELECT name FROM subreddits WHERE enabled = TRUE ORDER BY name")
			rows = cur.fetchall()
			subs = [r[0] for r in rows]
		conn.close()
	except Exception:
		pass
	if not subs:
		subs = [s.strip() for s in get_env("SUBREDDITS", "AskReddit,TIFU,TodayILearned,Showerthoughts,nosleep").split(",") if s.strip()]
	limit = get_int_env("REDDIT_FETCH_LIMIT", 50)
	days_back = get_int_env("DAYS_BACK", 7)
	cutoff_dt = datetime.now(tz=timezone.utc) - timedelta(days=days_back)
	items = []
	for sub in subs:
		# Pull more than limit from 'new' to ensure enough recent posts, then filter by cutoff
		candidates = reddit.subreddit(sub).new(limit=limit * 5)
		for post in candidates:
			if getattr(post, "stickied", False):
				continue
			created_dt = datetime.fromtimestamp(post.created_utc, tz=timezone.utc)
			if created_dt < cutoff_dt:
				continue
			content = getattr(post, "selftext", None) or ""
			slug_base = slugify(post.title)
			items.append(
				{
					"reddit_id": post.id,
					"title": post.title,
					"subreddit": str(post.subreddit),
					"author": f"u/{getattr(post, 'author', 'unknown')}",
					"url": f"https://reddit.com{post.permalink}",
					"score": int(getattr(post, "score", 0)),
					"num_comments": int(getattr(post, "num_comments", 0)),
					"created_at": created_dt,
					"content": content,
					"slug": f"{slug_base}-{post.id}",
				}
			)
			if len(items) >= limit:
				break
	return items


def main():
	try:
		# Load env from .env if present
		load_dotenv()
		conn = connect_db()
		ensure_schema(conn)
		items = fetch_from_reddit()
		if items:
			upsert_stories(conn, items)
			print(f"Upserted {len(items)} stories")
		else:
			print("No items fetched")
	except Exception as e:
		print(f"Error: {e}")
		sys.exit(1)
	finally:
		try:
			conn.close()
		except Exception:
			pass


if __name__ == "__main__":
	main()


