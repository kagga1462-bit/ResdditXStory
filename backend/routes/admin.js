const express = require('express');
const router = express.Router();
const { runQuery } = require('../db');

const ADMIN_EMAIL = 'kagga1462@gmail.com';
const ADMIN_PASSWORD = 'story54321';

function requireAuth(req, res, next) {
	if (req.cookies && req.cookies.admin === '1') return next();
	return res.redirect('/admin/login');
}

router.get('/login', (req, res) => {
	res.render('admin/login', { pageTitle: 'Admin Login', pageDescription: 'Login' });
});

router.post('/login', express.urlencoded({ extended: false }), (req, res) => {
	const { email, password } = req.body || {};
	if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
		res.cookie('admin', '1', { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 });
		return res.redirect('/admin');
	}
	return res.status(401).render('admin/login', { pageTitle: 'Admin Login', pageDescription: 'Login', error: 'Invalid credentials' });
});

router.post('/logout', (req, res) => {
	res.clearCookie('admin');
	res.redirect('/admin/login');
});

router.get('/', requireAuth, async (req, res) => {
	const { rows: counts } = await runQuery('SELECT COUNT(*)::int AS c FROM stories');
	const totalStories = counts?.[0]?.c || 0;
	const { rows: setting } = await runQuery("SELECT value FROM settings WHERE key = 'subreddits' LIMIT 1");
	const subs = (setting?.[0]?.value || '').trim();
	res.render('admin/dashboard', { pageTitle: 'Admin', pageDescription: 'Admin dashboard', totalStories, subs });
});

router.get('/subreddits', requireAuth, async (req, res) => {
	const { rows } = await runQuery('SELECT name, enabled, created_at FROM subreddits ORDER BY name');
	res.render('admin/subreddits', { pageTitle: 'Manage Subreddits', pageDescription: 'Manage', subs: rows });
});

router.post('/subreddits/add', requireAuth, express.urlencoded({ extended: false }), async (req, res) => {
	const name = (req.body.name || '').trim();
	if (name) {
		await runQuery('INSERT INTO subreddits(name, enabled) VALUES($1, TRUE) ON CONFLICT (name) DO UPDATE SET enabled = TRUE', [name]);
	}
	res.redirect('/admin/subreddits');
});

router.post('/subreddits/:name/toggle', requireAuth, async (req, res) => {
	const name = req.params.name;
	await runQuery('UPDATE subreddits SET enabled = NOT enabled WHERE name = $1', [name]);
	res.redirect('/admin/subreddits');
});

router.post('/subreddits/:name/delete', requireAuth, async (req, res) => {
	const name = req.params.name;
	await runQuery('DELETE FROM subreddits WHERE name = $1', [name]);
	res.redirect('/admin/subreddits');
});

router.get('/stories', requireAuth, async (req, res) => {
	const page = Math.max(parseInt(req.query.page || '1', 10), 1);
	const pageSize = 25;
	const offset = (page - 1) * pageSize;
	const { rows: stories } = await runQuery(
		`SELECT id, title, subreddit, author, score, num_comments, created_at, slug
		 FROM stories ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
		[pageSize, offset]
	);
	res.render('admin/stories', { pageTitle: 'Stories', pageDescription: 'Stories', stories, page });
});

router.post('/stories/:id/delete', requireAuth, async (req, res) => {
	const id = parseInt(req.params.id, 10);
	if (Number.isNaN(id)) return res.redirect('/admin/stories');
	await runQuery('DELETE FROM stories WHERE id = $1', [id]);
	res.redirect('/admin/stories');
});

module.exports = router;


