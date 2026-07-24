// Playwright smoke-тест игры «Котокопы / Purrminer».
// Запуск:  npx playwright install chromium  (один раз)
//          node test/smoke.mjs
// Проверяет: страница грузится без ошибок консоли, тест-хуки есть,
// ручной тап и найм кота/открытие штольни меняют состояние, пассивный доход капает.
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
const tapN = async (n) => page.evaluate(n => { const b = document.getElementById('tapBtn'); for (let i = 0; i < n; i++) b.click(); }, n);

let s0 = await state();
assert(typeof s0.coins === 'number', 'render_game_to_text returns state');
assert(Array.isArray(s0.tunnels) && s0.tunnels.length >= 5, 'at least 5 tunnels reported');
assert(s0.tunnels[0].unlocked === true, 'tunnel 1 unlocked by default');
assert(s0.tunnels.slice(1).every(t => t.unlocked === false), 'other tunnels locked by default');
assert(s0.tunnels.every(t => t.hasCat === false), 'no cats hired at start');

// тап в штольне 1 добавляет золото вручную
await page.click('#tapBtn');
let s1 = await state();
assert(s1.coins > s0.coins, 'manual tap in tunnel 1 increases coins');

// хук времени не ломает стейт (пассивного дохода пока нет — коты не наняты)
await page.evaluate(() => window.advanceTime(5000));
let s2 = await state();
assert(s2.coins >= s1.coins, 'time advance does not break state');
assert(Number.isFinite(s2.coins), 'coins stay a finite number after advanceTime');

// накопить золото на первого кота и нанять его в штольню 1
await tapN(2000);
let beforeHire = await state();
assert(beforeHire.action.type === 'hire', 'action button offers hiring a cat once affordable');
await page.click('#actionBtn');
let afterHire = await state();
assert(afterHire.tunnels[0].hasCat === true, 'hiring buys a cat for tunnel 1');
assert(afterHire.coins < beforeHire.coins, 'hiring a cat spends coins');

// теперь кот пассивно копает — advanceTime должен ощутимо прибавить золото
let beforeIdle = await state();
assert(beforeIdle.ips > 0, 'income per second becomes positive after hiring a cat');
await page.evaluate(() => window.advanceTime(5000));
let afterIdle = await state();
assert(afterIdle.coins > beforeIdle.coins, 'passive income accrues via advanceTime after hiring a cat');

// накопить золото и открыть штольню 2
await tapN(3000);
let beforeUnlock = await state();
assert(beforeUnlock.action.type === 'unlock', 'action button offers unlocking next tunnel once tunnel 1 has a cat');
await page.click('#actionBtn');
let afterUnlock = await state();
assert(afterUnlock.unlockedCount === beforeUnlock.unlockedCount + 1, 'unlocking opens the next tunnel');
assert(afterUnlock.tunnels[1].unlocked === true, 'tunnel 2 becomes unlocked');
assert(afterUnlock.selected === 1, 'selection moves to the newly unlocked tunnel');

// новая выбранная штольня 2 тоже копается тапом
await page.click('#tapBtn');
let afterTap2 = await state();
assert(afterTap2.coins > afterUnlock.coins, 'tapping in newly selected tunnel 2 increases coins');

// окно улучшений — отдельная модалка поверх игры
assert(await page.evaluate(() => document.getElementById('upModal').classList.contains('on')) === false, 'upgrades modal closed by default');
await page.click('#upBtn2');
assert(await page.evaluate(() => document.getElementById('upModal').classList.contains('on')) === true, 'upgrades modal opens over the game');
const upBefore = (await state()).upgrades.tap;
await page.evaluate(() => { const b = document.querySelector('#upList button[data-key="tap"]'); if (b && !b.disabled) b.click(); });
const sUp = await state();
assert(sUp.upgrades.tap >= upBefore, 'tap upgrade purchase path does not break state');
await page.click('#closeUp');
assert(await page.evaluate(() => document.getElementById('upModal').classList.contains('on')) === false, 'upgrades modal closes');

assert(errors.length === 0, 'no console/page errors' + (errors.length ? ' -> ' + errors.join(' | ') : ''));

await browser.close();
console.log(process.exitCode ? '\nSMOKE FAILED' : '\nSMOKE PASSED');
