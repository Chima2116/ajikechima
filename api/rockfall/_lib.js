// Shared helpers for the ROCKFALL leaderboard API. Files starting with "_" are not exposed as routes.
import crypto from 'node:crypto';

export const BONUSES = { 15: 5, 30: 10, 60: 25, 90: 50 };          // keep in step with site/rockfall.js
export const MAX_NAME = 16;

export function configured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.ROCKFALL_SECRET);
}

export function send(res, status, body, cache) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > 60000) throw new Error('too large'); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return {}; }
}

const b64 = (b) => Buffer.from(b).toString('base64url');
export function signToken(payload) {
  const body = b64(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', process.env.ROCKFALL_SECRET).update(body).digest('base64url');
  return body + '.' + mac;
}
export function verifyToken(token) {
  if (typeof token !== 'string' || token.length > 400) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const want = crypto.createHmac('sha256', process.env.ROCKFALL_SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch (e) { return null; }
}

export function ipHash(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  return crypto.createHash('sha256').update(ip + '|' + process.env.ROCKFALL_SECRET).digest('hex').slice(0, 32);
}

// Names: letters, numbers, spaces and a few marks. Anything else is dropped. A short blocklist swaps the worst words for "Anon".
const BLOCK = /(fuck|shit|cunt|nigg|fagg|rape|nazi|bitch|whore|slut|dick|cock|pussy)/i;
export function cleanName(raw) {
  let n = String(raw == null ? '' : raw).normalize('NFKC').replace(/[^\p{L}\p{N} ._\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  if (!n) return '';
  if (BLOCK.test(n.replace(/[\s._\-]/g, ''))) return 'Anon';
  return n;
}

export function maxScoreFor(duration) {
  const sec = Math.floor(duration); let s = sec;
  for (const k in BONUSES) if (sec >= +k) s += BONUSES[k];
  return s;
}

const base = () => process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rockfall_scores';
const headers = (extra) => Object.assign({ apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }, extra || {});

export async function insertScore(row) {
  const r = await fetch(base(), { method: 'POST', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(row) });
  if (!r.ok) { const t = await r.text(); const e = new Error('insert failed'); e.status = r.status; e.detail = t; throw e; }
  return (await r.json())[0];
}
export async function countWhere(query) {
  const r = await fetch(base() + '?select=id&' + query, { headers: headers({ Prefer: 'count=exact', Range: '0-0' }) });
  if (!r.ok) throw new Error('count failed');
  const cr = r.headers.get('content-range') || '*/0';
  return parseInt(cr.split('/')[1], 10) || 0;
}
export async function topScores(limit, sinceIso) {
  const q = '?select=name,score,duration,created_at&order=score.desc,duration.desc,created_at.asc&limit=' + limit + (sinceIso ? '&created_at=gte.' + encodeURIComponent(sinceIso) : '');
  const r = await fetch(base() + q, { headers: headers() });
  if (!r.ok) throw new Error('top failed');
  return r.json();
}
export function rankQuery(score, duration, sinceIso) {
  // better than this run: a higher score, or the same score in less time... we rank by score only and break ties by earlier submission
  return 'score=gt.' + score + (sinceIso ? '&created_at=gte.' + encodeURIComponent(sinceIso) : '');
}
export const weekAgo = () => new Date(Date.now() - 7 * 86400000).toISOString();
