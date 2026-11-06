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

// A browser keeps a random player id. The server stores only a salted hash of it as the owner of a name.
export function ownerHash(pid) {
  if (typeof pid !== 'string' || pid.length < 16 || pid.length > 80 || !/^[A-Za-z0-9_-]+$/.test(pid)) return null;
  return crypto.createHash('sha256').update('owner|' + pid + '|' + process.env.ROCKFALL_SECRET).digest('hex').slice(0, 32);
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

export function classify(status, text) {
  const t = String(text || '');
  if (status === 401 || status === 403 || /Invalid API key|JWT|apikey/i.test(t)) return 'key_rejected';
  if (status === 404 || /PGRST205|PGRST106|does not exist|relation .* does not exist|schema cache/i.test(t)) return 'table_missing';
  if (status === 0) return 'url_unreachable';
  return 'http_' + status;
}
async function sb(url, opt) {
  let r; try { r = await fetch(url, opt); } catch (e) { const x = new Error('network'); x.hint = 'url_unreachable'; throw x; }
  if (!r.ok) { const t = await r.text().catch(() => ''); const x = new Error('supabase'); x.status = r.status; x.detail = t; x.hint = classify(r.status, t); console.error('rockfall supabase', r.status, t.slice(0, 200)); throw x; }
  return r;
}
async function json(r) { try { return await r.json(); } catch (e) { const x = new Error('bad_response'); x.hint = 'bad_response'; console.error('rockfall: non-JSON reply from the database URL'); throw x; } }
const base = () => process.env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rockfall_scores';
// Works with either kind of server key: the older service_role JWT (starts "eyJ") or the newer secret key (starts "sb_secret_").
const headers = (extra) => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const h = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) h.Authorization = 'Bearer ' + key;
  return Object.assign(h, extra || {});
};

export async function insertScore(row) {
  const r = await sb(base(), { method: 'POST', headers: headers({ Prefer: 'return=representation' }), body: JSON.stringify(row) });
  return (await json(r))[0];
}
export async function countWhere(query) {
  const r = await sb(base() + '?select=id&' + query, { headers: headers({ Prefer: 'count=exact', Range: '0-0' }) });
  const cr = r.headers.get('content-range') || '*/0';
  return parseInt(cr.split('/')[1], 10) || 0;
}
export async function topScores(limit, sinceIso) {
  const q = '?select=name,score,duration,created_at&order=score.desc,duration.desc,created_at.asc&limit=' + limit + (sinceIso ? '&created_at=gte.' + encodeURIComponent(sinceIso) : '');
  const r = await sb(base() + q, { headers: headers() });
  return json(r);
}
export function rankQuery(score, duration, sinceIso) {
  // better than this run: a higher score, or the same score in less time... we rank by score only and break ties by earlier submission
  return 'score=gt.' + score + (sinceIso ? '&created_at=gte.' + encodeURIComponent(sinceIso) : '');
}
export const weekAgo = () => new Date(Date.now() - 7 * 86400000).toISOString();

// Is this name already used by someone else? Case does not matter. A name belongs only to the browser that first used it
// (the "owner"). Entries saved before owners existed belong to nobody, so those names are simply taken.
export async function nameTaken(name, owner) {
  const esc = encodeURIComponent(name.replace(/[\\%_]/g, '\\$&'));
  let rows;
  try { rows = await json(await sb(base() + '?select=id,owner,score&name=ilike.' + esc + '&limit=50', { headers: headers() })); }
  catch (e) {
    if (e.status === 400 && /owner/i.test(e.detail || '')) rows = await json(await sb(base() + '?select=id,score&name=ilike.' + esc + '&limit=50', { headers: headers() }));   // owner column not added yet: every existing name counts as taken
    else throw e;
  }
  if (!rows.length) return { taken: false, mine: null };
  if (!rows.every((r) => owner && r.owner === owner)) return { taken: true, mine: null };
  // the name is this player's own: one entry per name, so hand back the best row to be improved in place
  return { taken: false, mine: rows.sort((a, b) => b.score - a.score)[0] };
}
export async function improveScore(id, fields) {
  await sb(base() + '?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: headers({ Prefer: 'return=minimal' }), body: JSON.stringify(fields) });
}
