import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(tmpdir(), 'summit-art');
const ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const wait = ms => new Promise(r => setTimeout(r, ms));
const server = createServer(async (req, res) => {
    const path = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    try {
        const data = await readFile(join(ROOT, path));
        res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
        res.end(data);
    } catch {
        res.writeHead(404);
        res.end();
    }
}).listen(0);
const port = server.address().port;
await mkdir(OUT, { recursive: true });
const debugPort = 9800 + Math.floor(Math.random() * 150);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${debugPort}`, '--window-size=1280,720', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--mute-audio', '--no-first-run', `--user-data-dir=${join(OUT, 'profile')}`, 'about:blank'], { stdio: 'ignore' });
let target = null;
for (let i = 0; i < 40 && !target; i++) {
    await wait(250);
    try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(t => t.type === 'page'); } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let seq = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
});
const send = (method, params = {}) => new Promise(r => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) { errors.push(expression.slice(0, 70) + ' -> ' + (r.result.exceptionDetails.exception?.description || 'erro')); return undefined; }
    return r.result.result.value;
};
const shot = async name => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64'));
};
await send('Page.enable');
await send('Runtime.enable');
 
await send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
await wait(2500);
await evaluate(`localStorage.clear(); __summit.Save.create(0, 'normal'); (() => { const d = __summit.Save.data; d.unlocked = 12; Object.assign(d.story.scenes, { intro: true, ch1to2: true, ch2to3: true, final: true }); d.skills = ['dash','wall_climb','double_jump','air_dash','ground_pound']; d.loadout = ['shockwave', 'energy_shield', 'long_dash']; d.abilities = { shockwave: 2, energy_shield: 1, long_dash: 1 }; })()`);
const want = name => !ONLY || ONLY.some(o => name.startsWith(o));
const load = (level, x, y) => evaluate(`(() => { const S = __summit; S.actions.resume(); const G = S.game; delete G.hurtPlayer; delete G.kill; G.load(${level}); G.running = true; G.hurtPlayer = () => {}; G.kill = () => {}; ${x !== undefined ? `G.player.x = ${x}; G.player.y = ${y}; G.spawn = { x: ${x}, y: ${y} }; G.view.follow(${x}, ${y}, 0, true);` : ''} document.getElementById('hud').classList.remove('hidden'); })()`);

const levels = [[0, 10, 2], [1, 36, 2], [2, 44, 2], [3, 64, 14], [4, 95, 22], [5, 64, 18], [6, 45, 27], [7, 30, 24], [8, 52, 6], [9, 41, 2], [10, 30, 29], [11, 44, 19]];
for (const [level, x, y] of levels) {
    if (!want(`l${level}`)) continue;
    await load(level, x, y);
    await wait(1100);
    await shot(`l${level}`);
}
if (want('poses')) {
    await load(0, 10, 2);
    await evaluate(`(() => { const v = __summit.view; v.targetDist = 5; v.dist = 5; })()`);
    const poses = { idle: {}, run: { vx: 9, onGround: true, __lock: 'run' }, jump: { vy: 8, __lock: 'jump' }, fall: { vy: -8, __lock: 'fall' }, dash: { __lock: 'dash', vx: 18, dashDir: { x: 1, y: 0 } }, grab: { __lock: 'grab' }, climb: { __lock: 'climb', climbing: 1 }, land: { __lock: 'land' }, hurt: { __lock: 'hurt' }, glide: { __lock: 'glide' }, spin: { __lock: 'spin' }, pound: { __lock: 'pound' }, slide: { __lock: 'slide' } };
    await evaluate(`globalThis.__rig = (name, fields) => { const G = __summit.game; const p = G.player; const m = G.playerMesh; G.running = false; const t0 = performance.now(); clearInterval(globalThis.__rigT); import('./js/entities.js').then(E => { globalThis.__rigT = setInterval(() => { Object.assign(p, fields); E.animatePlayer(m, p, name, 1 / 30, performance.now() / 1000); G.view.follow(p.x, p.y, 1 / 30, true); }, 33); }); }; 1`);
    for (const [name, fields] of Object.entries(poses)) {
        await evaluate(`__rig('${name}', ${JSON.stringify(fields)})`);
        await wait(450);
        await shot(`pose-${name}`);
    }
    await evaluate(`clearInterval(globalThis.__rigT)`);
}
if (want('enemies')) {
    await load(5, 62, 18);
    await wait(900);
    await shot('enemies-ch2');
    await load(9, 74, 22);
    await wait(900);
    await shot('enemies-ch3');
    await load(0, 28, 2);
    await wait(900);
    await shot('enemies-ch1');
}
for (const [level, label] of [[4, 'boss1'], [8, 'boss2'], [11, 'boss3']]) {
    if (!want(label)) continue;
    await load(level);
    await evaluate(`(() => { const G = __summit.game; const a = G.level.arena; G.player.x = a.triggerX + 1; G.player.y = a.floor + 0.2; })()`);
    await wait(1500);
    await shot(`${label}-intro`);
    await wait(4500);
    await shot(`${label}-fight`);
    await wait(3500);
    await shot(`${label}-fight2`);
}
console.log('erros:', errors.length ? errors.slice(0, 8) : 'nenhum');
const fps = await evaluate(`new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 2000) r(n / 2); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`);
console.log('FPS software:', fps);
const measure = () => evaluate(`new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 2500) r(n / 2.5); else requestAnimationFrame(f); }; requestAnimationFrame(f); })`);
for (const [level, x, y] of [[0, 10, 2], [8, 52, 6], [10, 30, 29]]) {
    const ms = await evaluate(`(() => { const t = performance.now(); __summit.game.load(${level}); return Math.round(performance.now() - t); })()`);
    await load(level, x, y);
    await wait(500);
    const on = await measure();
    await evaluate('__summit.Settings.shadows = false; __summit.view.applyQuality()');
    const off = await measure();
    await evaluate('__summit.Settings.shadows = true; __summit.view.applyQuality()');
    console.log(`fase ${level + 1}: carga ${ms} ms; FPS com acabamento ${on}; sem acabamento ${off}`);
}
ws.close();
chrome.kill();
server.close();
process.exit(0);
