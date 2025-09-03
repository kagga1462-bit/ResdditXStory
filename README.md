RedditXStory
============

Fast, SEO-friendly Reddit story aggregator. Server-rendered (Express + EJS), HTMX for progressive enhancement, Tailwind CDN, Python scraper (PRAW), Postgres storage.

Tech
----
- Backend: Express.js, EJS, HTMX, Tailwind CDN
- Scraper: Python, PRAW
- DB: PostgreSQL
- Hosting: Render/Railway/Fly.io (server), GitHub Actions/Railway cron (scraper)

Local Setup
-----------

1) Requirements
- Node 18+
- Python 3.9+
- PostgreSQL 13+

2) Install
```
npm install
```

3) Environment
Create a file named `.env` in the project root:
```
# Server
PORT=3000
SITE_NAME=RedditXStory
SITE_URL=http://localhost:3000
ADSENSE_CLIENT_ID=

# Database
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/redditxstory
PGSSL=false

# Reddit API (PRAW)
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=redditxstory-dev/0.1 by yourname
SUBREDDITS=AskReddit,TIFU,TodayILearned,Showerthoughts,nosleep
REDDIT_FETCH_LIMIT=50
```

4) Database schema
```
createdb redditxstory # if not exists
psql "$DATABASE_URL" -f db/schema.sql
```

5) Run the server
```
npm run dev
# visit http://localhost:3000
```

Scraper
-------

Install Python deps (venv recommended)
```
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

Run scraper
The scraper reads env vars (DATABASE_URL, PGSSL, REDDIT_*). Ensure `.env` is populated and loaded into the environment (or export them).
```
. .venv/bin/activate
python scraper/fetch_reddit.py
```

Alternatively, via npm script (uses system python):
```
npm run scrape
```

CRON (examples)
```
*/15 * * * * cd /path/to/RedditXStory && . .venv/bin/activate && DATABASE_URL=... REDDIT_CLIENT_ID=... REDDIT_CLIENT_SECRET=... python scraper/fetch_reddit.py >> scraper.log 2>&1
```

Features
--------
- Server-rendered pages with SEO meta (title, description, OpenGraph)
- Clean URLs: /story/:slug
- HTMX Load More: /load-more-stories?page=X
- Basic robots.txt and sitemap.xml (home). Sitemap can be extended to include latest stories.
- Ad slots included (top banner, in-content). Paste your AdSense client id in `.env`.

Deployment notes
----------------
- Render/Railway: set env vars, use `npm run start` for the web service.
- Scraper: separate service/job with Python runtime and the same env vars. Schedule every 10-30 minutes.
- Postgres: enable SSL if required (`PGSSL=true`).

Admin: add/remove subreddits
----------------------------
Edit `SUBREDDITS` in `.env` (comma-separated). Re-run the scraper (it upserts by reddit_id).

License
-------
MIT


