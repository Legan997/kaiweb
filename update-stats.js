// Obtiene seguidores de Instagram y TikTok con HTTP simple (sin Playwright)
const https = require('https');
const fs    = require('fs');
const path  = require('path');

function get(url, ua) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': ua, 'Accept-Language': 'es-MX,es;q=0.9' }
    }, res => {
      let d = '';
      res.on('data', x => d += x);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function parseCount(str) {
  if (!str) return 0;
  str = str.replace(/,/g, '').trim();
  if (/K$/i.test(str)) return Math.round(parseFloat(str) * 1_000);
  if (/M$/i.test(str)) return Math.round(parseFloat(str) * 1_000_000);
  return parseInt(str) || 0;
}

(async () => {
  const statsPath = path.join(__dirname, 'stats.json');
  const current   = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
  const stats     = { ...current, last_updated: new Date().toISOString() };

  // ── Instagram (Googlebot UA → og:description, hasta 3 intentos) ──
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { body } = await get(
        'https://www.instagram.com/kai_rawr/',
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      );
      const descMatch = body.match(/property="og:description"\s+content="([^"]+)"/);
      if (descMatch) {
        const m = descMatch[1].match(
          /([0-9,.KkMm]+)\s*Followers?,\s*([0-9,.KkMm]+)\s*Following,\s*([0-9,.KkMm]+)\s*Posts?/i
        );
        if (m) {
          stats.ig_followers = parseCount(m[1]);
          stats.ig_following = parseCount(m[2]);
          stats.ig_posts     = parseCount(m[3]);
          console.log(`Instagram ✓ (intento ${attempt}) — ${stats.ig_followers} seguidores, ${stats.ig_posts} posts`);
          break;
        }
      }
      console.log(`Instagram intento ${attempt} — sin datos, reintentando...`);
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.log(`Instagram intento ${attempt} error:`, e.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // ── TikTok (mobile UA → JSON embebido) ──
  try {
    const { body } = await get(
      'https://www.tiktok.com/@kai_rawr_2',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    );
    const fm = body.match(/"followerCount"\s*:\s*(\d+)/);
    const lm = body.match(/"heartCount"\s*:\s*(\d+)/);
    if (fm) { stats.tt_followers = parseInt(fm[1]); console.log(`TikTok ✓ — ${stats.tt_followers} seguidores`); }
    else    { console.log('TikTok — followerCount no encontrado'); }
    if (lm) stats.tt_likes = parseInt(lm[1]);
  } catch (e) {
    console.log('TikTok error:', e.message);
  }

  stats.total_community = stats.ig_followers + stats.tt_followers;

  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  console.log('\nstats.json actualizado →', stats);
})();
