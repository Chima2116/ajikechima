// GET /api/rockfall/top?range=all|week&score=NN  ->  { top: [...], total, rank }
// "rank" is where a score of NN would sit, used to show "You are #N" for people who skipped the name step.
import { configured, send, topScores, countWhere, rankQuery, weekAgo } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method' });
  if (!configured()) return send(res, 503, { error: 'not_configured' });
  const url = new URL(req.url, 'http://x');
  const since = url.searchParams.get('range') === 'week' ? weekAgo() : null;
  const score = Math.floor(Number(url.searchParams.get('score')));
  try {
    const q = since ? 'created_at=gte.' + encodeURIComponent(since) : '';
    const [top, total, above] = await Promise.all([topScores(10, since), countWhere(q), score >= 1 ? countWhere(rankQuery(score, 0, since)) : Promise.resolve(null)]);
    send(res, 200, { top, total, rank: above == null ? null : above + 1 }, 'public, s-maxage=10, stale-while-revalidate=30');
  } catch (e) { send(res, 502, { error: 'store' }); }
}
