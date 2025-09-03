const express = require('express');
const router = express.Router();
const { runQuery } = require('../db');

const PAGE_SIZE = 10;

async function fetchStories({ page = 1, subreddit = null }) {
	const offset = (page - 1) * PAGE_SIZE;
	if (!process.env.DATABASE_URL) {
		return [];
	}
	if (subreddit) {
		const { rows } = await runQuery(
			`SELECT id, reddit_id, title, author, subreddit, url, score, num_comments, created_at, content, slug
			 FROM stories
			 WHERE subreddit = $1
			 ORDER BY created_at DESC
			 LIMIT $2 OFFSET $3`,
			[subreddit, PAGE_SIZE, offset]
		);
		return rows;
	} else {
		const { rows } = await runQuery(
			`SELECT id, reddit_id, title, author, subreddit, url, score, num_comments, created_at, content, slug
			 FROM stories
			 ORDER BY created_at DESC
			 LIMIT $1 OFFSET $2`,
			[PAGE_SIZE, offset]
		);
		return rows;
	}
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
	const page = 1;
	const subreddit = req.query.subreddit || null;
	const stories = await fetchStories({ page, subreddit });
	res.set('Vary', 'HX-Request');
	res.render('index', {
		pageTitle: res.locals.site.name,
		pageDescription: 'Fresh stories aggregated from Reddit subreddits',
		stories,
		page,
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

router.get('/load-more-stories', async (req, res) => {
	const page = Math.max(parseInt(req.query.page || '2', 10), 1);
	const subreddit = req.query.subreddit || null;
	const stories = await fetchStories({ page, subreddit });
	res.set('Vary', 'HX-Request');
	res.render('partials/story_list', { stories, nextPage: page + 1, subreddit });
});

module.exports = router;


