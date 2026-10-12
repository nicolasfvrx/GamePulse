import { handle } from 'hono/cloudflare-pages';
import { Hono } from 'hono';
import { api, type Env } from '../../src/api/server.js';

// Sub-route handling: match both /api/* and /* to prevent any 404 from prefix mismatches
const app = new Hono<Env>();
app.route('/api', api);
app.route('/', api);

export const onRequest = handle(app);
