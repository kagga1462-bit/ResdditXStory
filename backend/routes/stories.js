const express = require('express');
const router = express.Router();
const { runQuery } = require('../db');

const PAGE_SIZE = 10;

async function fetchStories({ page = 1, subreddit = null }) {
	const offset = (page - 1) * PAGE_SIZE;
	if (!process.env.DATABASE_URL) {
		return { items: [], hasNext: false };
	}
	const limit = PAGE_SIZE + 1;
	let rows;
	if (subreddit) {
		({ rows } = await runQuery(
			`SELECT id, reddit_id, title, author, subreddit, url, score, num_comments, created_at, content, slug
			 FROM stories
			 WHERE subreddit = $1
			 ORDER BY created_at DESC
			 LIMIT $2 OFFSET $3`,
			[subreddit, limit, offset]
		));
	} else {
		({ rows } = await runQuery(
			`SELECT id, reddit_id, title, author, subreddit, url, score, num_comments, created_at, content, slug
			 FROM stories
			 ORDER BY created_at DESC
			 LIMIT $1 OFFSET $2`,
			[limit, offset]
		));
	}
	const hasNext = rows.length > PAGE_SIZE;
	const items = hasNext ? rows.slice(0, PAGE_SIZE) : rows;
	return { items, hasNext };
}

async function fetchStoryBySlug(slug) {
	if (!process.env.DATABASE_URL) return null;
	const { rows } = await runQuery(
		`SELECT id, reddit_id, title, author, subreddit, url, score, num_comments, created_at, content, slug
		 FROM stories
		 WHERE slug = $1
		 LIMIT 1`,
		[slug]
	);
	return rows[0] || null;
}

router.get('/', async (req, res) => {
	const page = Math.max(parseInt(req.query.page || '1', 10), 1);
	const subreddit = req.query.subreddit || null;
	const { items, hasNext } = await fetchStories({ page, subreddit });
	res.render('index', {
		pageTitle: res.locals.site.name,
		pageDescription: 'Fresh stories aggregated from Reddit subreddits',
		stories: items,
		page,
		hasNext,
		subreddit,
	});
});

router.get('/story/:slug', async (req, res) => {
	const { slug } = req.params;
	const story = await fetchStoryBySlug(slug);
	if (!story) {
		return res.status(404).render('story', { story: null, pageTitle: 'Not found', pageDescription: '' });
	}
	res.render('story', {
		story,
		pageTitle: `${story.title} – ${res.locals.site.name}`,
		pageDescription: story.content ? story.content.slice(0, 160) : story.title,
	});
});

// Removed HTMX load-more endpoint; classic pagination is handled via query params on '/'

module.exports = router;


