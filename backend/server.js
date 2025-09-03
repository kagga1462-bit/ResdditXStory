const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });
// Relax TLS verification for self-signed DB certs when explicitly requested
if (
	process.env.PGSSL === 'true' ||
	/sslmode=require/.test(process.env.DATABASE_URL || '')
) {
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const app = express();

// Security and performance middleware
app.use(helmet({
	crossOriginEmbedderPolicy: false,
	contentSecurityPolicy: false,
}));
app.use(compression());
app.use(morgan('tiny'));
app.use(cookieParser());

// EJS setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Static assets
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), {
	maxAge: '7d',
}));

// Global locals for templates
app.use((req, res, next) => {
	res.locals.site = {
		name: process.env.SITE_NAME || 'RedditXStory',
		url: process.env.SITE_URL || 'http://localhost:' + (process.env.PORT || 3000),
		adsenseClientId: process.env.ADSENSE_CLIENT_ID || '',
	};
	res.locals.nowIso = new Date().toISOString();
	next();
});

// Routes
const storiesRouter = require('./routes/stories');
const adminRouter = require('./routes/admin');
app.use('/', storiesRouter);
app.use('/admin', adminRouter);

// robots.txt
app.get('/robots.txt', (req, res) => {
	res.type('text/plain');
	res.send(`User-agent: *\nAllow: /\nSitemap: ${res.locals.site.url}/sitemap.xml`);
});

// sitemap.xml (basic, to be improved when DB ready)
app.get('/sitemap.xml', (req, res) => {
	res.type('application/xml');
	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
		`  <url><loc>${res.locals.site.url}/</loc><changefreq>hourly</changefreq></url>\n` +
		`</urlset>`;
	res.send(xml);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});


