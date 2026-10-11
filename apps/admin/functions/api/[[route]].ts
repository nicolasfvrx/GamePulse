import { handle } from 'hono/cloudflare-pages';
import { api } from '../../src/api/server.js';

export const onRequest = handle(api);
