// POST /api/rockfall/start  ->  { token, seed }
// Issues a signed, time-stamped run token. A score can only be submitted against a token the server issued,
// and only for about as long as the run could really have lasted since the token was issued.
import crypto from 'node:crypto';
import { configured, send, signToken } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (!configured()) return send(res, 503, { error: 'not_configured' });
  const id = crypto.randomBytes(9).toString('base64url');
  const seed = crypto.randomBytes(4).readUInt32BE(0);
  const token = signToken({ id, seed, t: Date.now() });
  send(res, 200, { token, seed });
}
