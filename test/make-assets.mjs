// Headless-генерация магазинных ассетов (без внешних image-API).
// Делает: скриншоты геймплея с реального билда (RU+EN) + обложки RU/EN + иконку из card.html.
// Запуск из папки игры:  node test/make-assets.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const out = resolve(root, 'store-assets');
mkdirSync(out, { recursive: true });
const gameUrl = 'file://' + resolve(root, 'index.html');
const cardUrl = 'file://' + resolve(root, 'store', 'card.html');

// ---- CONFIG ----
const CONFIG = {
  titleRu: 'Котокопы', titleEn: 'Purrminer',
  subRu: 'Копай, продавай, расти!', subEn: 'Dig, sell, grow!',
  // GAME: кот-шахтёр с киркой, векторная SVG (viewBox 0 0 100 100), плоские заливки + чернильный контур
  heroSvg: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
    + '<ellipse cx="50" cy="73" rx="27" ry="20" fill="#E8A96B" stroke="#4A3527" stroke-width="4"/>'
    + '<circle cx="50" cy="43" r="26" fill="#E8A96B" stroke="#4A3527" stroke-width="4"/>'
    + '<path d="M28 31 L20 8 L42 23 Z" fill="#E8A96B" stroke="#4A3527" stroke-width="4" stroke-linejoin="round"/>'
    + '<path d="M72 31 L80 8 L58 23 Z" fill="#E8A96B" stroke="#4A3527" stroke-width="4" stroke-linejoin="round"/>'
    + '<path d="M30 27 L26 15 L38 23 Z" fill="#F3C08A"/>'
    + '<path d="M70 27 L74 15 L62 23 Z" fill="#F3C08A"/>'
    + '<circle cx="41" cy="45" r="3.6" fill="#4A3527"/>'
    + '<circle cx="59" cy="45" r="3.6" fill="#4A3527"/>'
    + '<path d="M46 53 Q50 57 54 53" fill="none" stroke="#4A3527" stroke-width="3" stroke-linecap="round"/>'
    + '<path d="M18 47 L36 49 M18 55 L36 53 M64 49 L82 47 M64 53 L82 55" stroke="#4A3527" stroke-width="2" stroke-linecap="round"/>'
    + '<g transform="translate(80,56) rotate(-20)">'
    + '<line x1="0" y1="0" x2="0" y2="-32" stroke="#4A3527" stroke-width="8" stroke-linecap="round"/>'
    + '<line x1="0" y1="0" x2="0" y2="-32" stroke="#8C6239" stroke-width="5" stroke-linecap="round"/>'
    + '<path d="M-13 -32 Q-5 -41 0 -33 Q5 -41 13 -32 Q0 -24 -13 -32 Z" fill="#B9BEC7" stroke="#4A3527" stroke-width="3" stroke-linejoin="round"/>'
    + '</g>'
    + '</svg>',
  accent: '#F2B341', bg: '#7A6650', ink: '#4A3527',
  // характерные экраны: [имя файла, скрипт подготовки состояния через хуки]
  shots: [
    ['d1-start',    async p => { await bulkTap(p, 10); await p.click('#tapBtn'); }],
    ['d2-cart',     async p => { await bulkTap(p, 24); await p.click('#tapBtn'); }],
    ['d3-helper',   async p => { await bulkTap(p, 600); await bulkUp(p, 3); await bulkTap(p, 40); await p.click('#tapBtn'); }],
    ['d4-progress', async p => { for (let r=0;r<4;r++){ await bulkTap(p, 250); await bulkUp(p, 1); } await p.click('#tapBtn'); }],
    ['d5-deep',     async p => { for (let r=0;r<8;r++){ await bulkTap(p, 250); await bulkUp(p, 1); } await p.click('#tapBtn'); }],
  ],
};

const browser = await chromium.launch();

async function bulkTap(p, n) { await p.evaluate(n => { const b=document.getElementById('tapBtn'); for (let i=0;i<n;i++) b.click(); }, n); }
async function bulkUp(p, n)  { await p.evaluate(n => { const b=document.getElementById('upBtn');  for (let i=0;i<n;i++) b.click(); }, n); }

async function shot(url, w, h, file, prep, locale) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale });
  await page.goto(url);
  await page.waitForTimeout(400);
  if (prep) await prep(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(out, file) });
  await page.close();
  console.log('saved', file);
}

// Скриншоты геймплея (десктоп 1920x1080) — RU и EN, локаль двигает язык через navigator.language
for (const [name, prep] of CONFIG.shots) {
  await shot(gameUrl, 1920, 1080, name + '.png', prep, 'ru-RU');
  await shot(gameUrl, 1920, 1080, name + '-en.png', prep, 'en-US');
}

// Обложки 800x470 и иконка 512x512 из card.html
const card = (o) => cardUrl + '?' + new URLSearchParams(o).toString();
await shot(card({ w:800,h:470,mode:'cover',title:CONFIG.titleRu,sub:CONFIG.subRu,heroSvg:CONFIG.heroSvg,accent:CONFIG.accent,bg:CONFIG.bg,ink:CONFIG.ink }), 800, 470, 'cover.png');
await shot(card({ w:800,h:470,mode:'cover',title:CONFIG.titleEn,sub:CONFIG.subEn,heroSvg:CONFIG.heroSvg,accent:CONFIG.accent,bg:CONFIG.bg,ink:CONFIG.ink }), 800, 470, 'cover-en.png');
await shot(card({ w:512,h:512,mode:'icon',heroSvg:CONFIG.heroSvg,accent:CONFIG.accent,bg:CONFIG.bg,ink:CONFIG.ink }), 512, 512, 'icon.png');

await browser.close();
console.log('\nАссеты готовы в', out);
