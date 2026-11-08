// Uso (desde la raíz del repo): node og/render.js .  (corre con el playwright-core de %TEMP%\fsm-e2e)
const path = require('path');
const { chromium } = require(path.join(process.env.TEMP, 'fsm-e2e', 'node_modules', 'playwright-core'));
const out = process.argv[2];
const url = f => 'file:///' + path.join(__dirname, f).split('\\').join('/');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#060807"/><path d="M5 16h22M16 5v22" stroke="#ECF1EE" stroke-width="2"/><circle cx="16" cy="16" r="4.5" fill="#B4FF4D"/></svg>`;
(async () => {
  const b = await chromium.launch({ channel: 'msedge' });
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto(url('og.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(out, 'og.png') });
  for (const [name, size, pad] of [['apple-touch-icon.png', 180, 0], ['favicon-32.png', 32, 0]]) {
    const q = await b.newPage({ viewport: { width: size, height: size } });
    // el ícono de Apple va sin esquinas redondeadas: iOS las recorta solo
    const s = name.startsWith('apple') ? svg.replace(' rx="7"', '') : svg;
    await q.setContent(`<html><body style="margin:0;background:transparent">${s.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await q.screenshot({ path: path.join(out, name), omitBackground: true });
  }
  await b.close();
  console.log('ok');
})();
