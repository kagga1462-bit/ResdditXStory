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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stories_created_at_desc ON stories (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_subreddit_created_at ON stories (subreddit, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_slug ON stories (slug);

-- Admin/settings
CREATE TABLE IF NOT EXISTS settings (
	key TEXT PRIMARY KEY,
	value TEXT
);

-- Subreddits table (preferred over settings/env)
CREATE TABLE IF NOT EXISTS subreddits (
	name TEXT PRIMARY KEY,
	enabled BOOLEAN NOT NULL DEFAULT TRUE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subreddits_enabled ON subreddits (enabled);


