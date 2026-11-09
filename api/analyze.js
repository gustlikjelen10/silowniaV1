import { head } from '@vercel/blob';
export default async function handler(req, res) {
  if (process.env.APP_PIN && req.headers['x-pin'] !== process.env.APP_PIN) return res.status(401).json({ error: 'pin' });
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'Brak GEMINI_API_KEY w ustawieniach Vercel' });
  let D = { w: [], s: [], c: [] };
  try { const h = await head('gym/data.json'); D = await (await fetch(h.url + '?t=' + Date.now())).json(); } catch (e) {}
  const day = (req.body && req.body.d) || new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 56 * 864e5).toISOString().slice(0, 10), by = {};
  (D.s || []).filter(x => x.d >= since && x.d <= day).forEach(x => { by[x.d] = by[x.d] || {}; (by[x.d][x.ex] = by[x.d][x.ex] || []).push(x.kg + 'x' + x.r); });
  const sess = Object.keys(by).sort().map(d => d + ' | ' + Object.entries(by[d]).map(([e, a]) => e + ': ' + a.join(', ')).join(' | ')).join('\n');
  const w = (D.w || []).slice(-12).map(x => x.d + ' ' + x.kg + 'kg').join(', ');
  const c = (D.c || []).filter(x => x.d >= since).map(x => x.d + ' ' + x.m + ' ' + x.min + 'min' + (x.spd ? ' ' + x.spd + 'km/h' : '') + (x.inc ? ' nachyl.' + x.inc : '')).join('; ');
  const g = D.g ? 'Cel wagowy: ' + D.g.kg + ' kg' + (D.g.d ? ' do ' + D.g.d : '') : '';
  const b = req.body || {};
  const nx = b.next ? 'Najbliższy zaplanowany trening: ' + String(b.next).slice(0, 2) + ' (' + String(b.plan || '').slice(0, 300) + ').' : '';
  const prompt = `Jesteś doświadczonym trenerem personalnym. Podopieczny: Sebastian, redukcja tkanki tłuszczowej, trenuje od kilku lat, plan FBW (treningi A/B/C), maszyny Star Trac Inspiration, nie lubi wolnych ciężarów. Format serii: ciężar w kg x powtórzenia.
Dane z ostatnich 8 tygodni (treningi):
${sess || 'brak'}
Waga ciała: ${w || 'brak'}
Cardio: ${c || 'brak'}
${g}
${nx}
Przeanalizuj ostatni trening z dnia ${day} na tle poprzednich: progres w każdym ćwiczeniu, regularność, trend wagi, cardio. Odpowiedz po polsku, zwięźle (maks. ok. 180 słów), w czterech krótkich sekcjach z pogrubionymi nagłówkami: **Ocena**, **Co poszło dobrze**, **Na co uważać**, **Następny trening** (konkretne ciężary i powtórzenia dla ćwiczeń z najbliższego zaplanowanego treningu, jeśli podano, w przeciwnym razie dla kluczowych ćwiczeń). Nie powtarzaj surowych danych, nie dawaj porad medycznych.`;
  const models = ['gemini-flash-latest', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash'];
  let last = 'Nieznany błąd';
  for (let i = 0; i < models.length; i++) {
    if (i === 1) await new Promise(r => setTimeout(r, 2000));
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + models[i] + ':generateContent', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
      });
      const j = await r.json();
      const text = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts || []).map(p => p.text || '').join('').trim();
      if (text) return res.status(200).json({ text });
      last = (j.error && j.error.message) || 'Pusta odpowiedź Gemini';
      if ([400, 401, 403].includes(r.status)) break;
    } catch (e) { last = 'Błąd połączenia z Gemini'; }
  }
  return res.status(502).json({ error: /demand|overload|unavailable|quota|exhausted/i.test(last) ? 'Gemini jest chwilowo przeciążone. Spróbuj ponownie za minutę.' : last });
}
