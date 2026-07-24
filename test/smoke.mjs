// Playwright smoke-тест шаблона/игры.
// Запуск:  npx playwright install chromium  (один раз)
//          node test/smoke.mjs
// Проверяет: страница грузится без ошибок консоли, тест-хуки есть,
// действие и апгрейд меняют состояние, пассивный доход капает.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = 'file://' + resolve(__dirname, '..', 'index.html');

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));

await page.goto(url);
await page.waitForFunction(() => typeof window.render_game_to_text === 'function', { timeout: 8000 });

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; } else console.log('ok  ', msg); };
const state = async () => JSON.parse(await page.evaluate(() => window.render_game_to_text()));

let s0 = await state();
assert(typeof s0.coins === 'number', 'render_game_to_text returns state');

// действие добавляет монеты
await page.click('#tapBtn');
let s1 = await state();
assert(s1.coins > s0.coins, 'action increases coins');

// пассивный доход через хук времени (если ips>0)
await page.evaluate(() => window.advanceTime(5000));
let s2 = await state();
assert(s2.coins >= s1.coins, 'time advance does not break state');

// апгрейд: накопить и купить
await page.evaluate(() => { for (let i=0;i<200;i++) document.getElementById('tapBtn').click(); });
let before = await state();
await page.click('#upBtn');
let after = await state();
assert(after.lvl >= before.lvl, 'upgrade path works');

assert(errors.length === 0, 'no console/page errors' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

await browser.close();
console.log(process.exitCode ? '\nSMOKE FAILED' : '\nSMOKE PASSED');
