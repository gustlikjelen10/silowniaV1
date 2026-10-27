import { put, head } from '@vercel/blob';
const P = 'gym/data.json';
export default async function handler(req, res) {
  if (process.env.APP_PIN && req.headers['x-pin'] !== process.env.APP_PIN) return res.status(401).json({ error: 'pin' });
  if (req.method === 'GET') {
    try { const h = await head(P); const r = await fetch(h.url + '?t=' + Date.now()); return res.status(200).json(await r.json()); }
    catch (e) { return res.status(200).json({ w: [], s: [], c: [] }); }
  }
  if (req.method === 'PUT') {
    await put(P, JSON.stringify(req.body), { access: 'public', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 60 });
    return res.status(200).json({ ok: 1 });
  }
  res.status(405).end();
}
