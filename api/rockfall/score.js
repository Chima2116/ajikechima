// POST /api/rockfall/score  { token, name, score, duration, inputs }  ->  { ok, rank, total, top }
// The client never decides the score alone. The server checks the token, the clock, the arithmetic of the score,
// and that the recorded pointer path looks like a real run. It cannot prove nobody scripted a perfect player,
// but it stops casual forgery. To go further, re-simulate the run server-side from the seed and the inputs.
import { configured, send, readJson, verifyToken, cleanName, ipHash, maxScoreFor, insertScore, countWhere, topScores, rankQuery } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (!configured()) return send(res, 503, { error: 'not_configured' });
  let body; try { body = await readJson(req); } catch (e) { return send(res, 413, { error: 'too_large' }); }

  const tok = verifyToken(body.token);
  if (!tok || !tok.id || !tok.t) return send(res, 400, { error: 'bad_token' });
  const elapsed = (Date.now() - tok.t) / 1000;
  const duration = Number(body.duration), score = Math.floor(Number(body.score));
  const name = cleanName(body.name);
  if (!name) return send(res, 400, { error: 'name' });
  if (!(duration >= 1) || !(score >= 1) || !isFinite(duration) || !isFinite(score)) return send(res, 400, { error: 'bad_run' });

  // time: the run cannot have lasted longer than the time since the token was issued, and the token expires
  if (duration > elapsed + 1.5 || elapsed > 3600) return send(res, 422, { error: 'time' });
  if (elapsed - duration > 900) return send(res, 422, { error: 'stale' });
  // arithmetic: one point per second plus the fixed milestone bonuses, nothing else
  const max = maxScoreFor(duration);
  if (score > max || score < max - 3) return send(res, 422, { error: 'score' });
  // movement: a real run leaves a pointer path, thinned to about two points a second, that actually moves
  const inputs = Array.isArray(body.inputs) ? body.inputs : [];
  if (duration >= 8) {
    const want = Math.min(duration * 2, 1200);        // the browser sends a thinned path, about one point per half second
    if (inputs.length < want * 0.5 || inputs.length > want * 1.6 + 20) return send(res, 422, { error: 'path' });
    const xs = new Set(inputs.map((p) => Array.isArray(p) ? Math.round(p[0] / 8) : 0));
    if (xs.size < 3) return send(res, 422, { error: 'path' });
  }

  const hash = ipHash(req);
  try {
    const recent = await countWhere('ip_hash=eq.' + hash + '&created_at=gte.' + encodeURIComponent(new Date(Date.now() - 60000).toISOString()));
    if (recent >= 6) return send(res, 429, { error: 'slow_down' });
    await insertScore({ run_id: tok.id, name, score, duration: Math.round(duration * 10) / 10, ip_hash: hash });
  } catch (e) {
    if (e.status === 409 || /duplicate|unique/i.test(e.detail || '')) return send(res, 409, { error: 'already_submitted' });
    return send(res, 502, { error: 'store', hint: e.hint || 'unknown' });
  }
  try {
    const [above, total, top] = await Promise.all([countWhere(rankQuery(score, duration)), countWhere(''), topScores(10)]);
    send(res, 200, { ok: true, rank: above + 1, total, name, top });
  } catch (e) { send(res, 200, { ok: true, rank: null, total: null, name, top: [] }); }
}
