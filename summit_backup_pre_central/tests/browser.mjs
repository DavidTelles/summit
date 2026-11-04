import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(tmpdir(), 'summit-shots');
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

const debugPort = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${debugPort}`, '--window-size=1280,720', '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader', '--mute-audio', '--no-first-run', `--user-data-dir=${join(OUT, 'profile')}`, 'about:blank'
], { stdio: 'ignore' });

let targets = null;
for (let i = 0; i < 40 && !targets; i++) {
    await wait(250);
    try {
        const list = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
        targets = list.find(t => t.type === 'page');
    } catch {}
}
if (!targets) throw new Error('Chrome não iniciou');

const ws = new WebSocket(targets.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let seq = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m);
        pending.delete(m.id);
    }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !m.params.entry.url?.includes('favicon')) errors.push(m.params.entry.text + ' ' + (m.params.entry.url || ''));
});
const send = (method, params = {}) => new Promise(r => {
    const id = ++seq;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) {
        errors.push(expression.slice(0, 60) + ' -> ' + (r.result.exceptionDetails.exception?.description || 'erro'));
        return undefined;
    }
    return r.result.result.value;
};
const shot = async name => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64'));
};
const key = async (code, down = 'both') => {
    const text = code === 'Enter' ? '\r' : undefined;
    const keyName = { Space: ' ', Enter: 'Enter', Escape: 'Escape', ArrowDown: 'ArrowDown', ArrowUp: 'ArrowUp', ArrowRight: 'ArrowRight' }[code] || code;
    if (down !== 'up') await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: keyName, text, windowsVirtualKeyCode: code === 'Enter' ? 13 : undefined });
    if (down !== 'down') await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: keyName, windowsVirtualKeyCode: code === 'Enter' ? 13 : undefined });
};

const results = [];
const check = (name, ok, extra = '') => {
    results.push(ok);
    console.log(`${ok ? 'OK  ' : 'FALHA'} ${name} ${extra}`);
};

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
await wait(2500);
await evaluate('localStorage.clear()');
await send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
await wait(2500);

const visible = id => `!document.getElementById('${id}').classList.contains('hidden')`;
check('menu inicial visível', await evaluate(visible('menu')));
await shot('01-menu');

await evaluate(`document.querySelector('[data-act=newgame]').click()`);
await wait(200);
check('tela de slots', await evaluate(visible('saves')));
await shot('02-saves');
await evaluate(`document.querySelectorAll('#save-list button')[0].click()`);
await wait(200);
check('tela de modo', await evaluate(visible('mode')));
await shot('03-mode');
await evaluate(`document.querySelector('[data-act=mode-normal]').click()`);
await wait(1500);
check('jogo iniciado', await evaluate(`__summit.state === 'playing' && ${visible('hud')}`));
await shot('04-fase1');

await key('ArrowRight', 'down');
await wait(700);
const x1 = await evaluate('__summit.game.player.x');
await key('ArrowRight', 'up');
check('teclado move o personagem', x1 > 3, `x=${x1?.toFixed(1)}`);
await key('Space');
await wait(150);
await shot('05-pulo');

await key('Escape');
await wait(200);
check('pausa abre', await evaluate(visible('pause')));
await shot('06-pausa');
await key('ArrowDown');
const focused = await evaluate(`document.activeElement.textContent`);
check('navegação por teclado no menu', focused === 'Reiniciar fase', focused);
await key('Escape');
await wait(150);
check('Esc retoma', await evaluate(`__summit.state === 'playing'`));

const frameTimes = async ms => evaluate(`new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < ${ms}) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); })`);

const SCENES = [
    { level: 4, label: '07-fase5', x: null },
    { level: 5, label: '08-cap2-vale', x: 60, y: 18 },
    { level: 6, label: '09-cap2-ruinas', x: 45, y: 27 },
    { level: 7, label: '10-cap2-abismo', x: 30, y: 24 },
    { level: 9, label: '11-cap3-desfiladeiro', x: 41, y: 2 },
    { level: 10, label: '12-cap3-nucleo', x: 30, y: 29 },
    { level: 11, label: '13-cap3-cume', x: 44, y: 19 }
];
for (const s of SCENES) {
    await evaluate(`(() => { const S = __summit; S.Save.data.unlocked = 12; S.Save.data.skills = ['dash','wall_climb','double_jump','air_dash','ground_pound']; S.game.load(${s.level}); ${s.x ? `S.game.player.x = ${s.x}; S.game.player.y = ${s.y}; S.game.spawn = {x:${s.x},y:${s.y}};` : ''} S.game.hurtPlayer = () => {}; S.game.kill = () => {}; })()`);
    await wait(1400);
    await shot(s.label);
}

for (const [level, label] of [[4, '14-chefe1'], [8, '15-chefe2'], [11, '16-chefe3']]) {
    await evaluate(`(() => { const G = __summit.game; delete G.hurtPlayer; delete G.kill; G.load(${level}); G.hurtPlayer = () => {}; G.kill = () => {}; const a = G.level.arena; G.player.x = a.triggerX + 1; G.player.y = a.floor + 0.2; })()`);
    await wait(1200);
    await shot(label + '-intro');
    await wait(4500);
    check(`${label}: batalha ativa, barra visível`, await evaluate(`__summit.game.boss.mode === 'fight' && ${visible('boss-bar')}`));
    await shot(label + '-luta');
    await wait(4000);
    await shot(label + '-ataque');
}

await evaluate(`(() => { const G = __summit.game; for (let i = 0; i < 30; i++) G.load(5); })()`);
await wait(300);
const mem = await evaluate(`(() => { const i = __summit.view.renderer.info.memory; return [i.geometries, i.textures]; })()`);
await evaluate(`(() => { const G = __summit.game; for (let i = 0; i < 30; i++) G.load(5); })()`);
await wait(300);
const mem2 = await evaluate(`(() => { const i = __summit.view.renderer.info.memory; return [i.geometries, i.textures]; })()`);
check('sem vazamento de geometria após 60 recargas', mem2[0] <= mem[0] + 2, `${mem} -> ${mem2}`);

await evaluate(`(() => { const G = __summit.game; delete G.hurtPlayer; delete G.kill; G.load(0); })()`);
await wait(500);
const fps = await frameTimes(2000);
console.log(`FPS (renderização por software, sem GPU): ${fps?.toFixed(1)}`);

await evaluate(`__summit.actions.menu()`);
await wait(200);
await evaluate(`document.querySelector('[data-act=newgame]').click()`);
await wait(150);
await evaluate(`document.querySelectorAll('#save-list .save-card')[1].querySelector('button').click()`);
await wait(150);
await evaluate(`document.querySelector('[data-act=mode-permadeath]').click()`);
await wait(150);
check('confirmação interna do jogo', await evaluate(visible('dialog')));
await shot('17-dialogo');
await evaluate(`document.getElementById('dialog-yes').click()`);
await wait(800);
const slotBefore = await evaluate(`__summit.Save.active`);
await evaluate(`__summit.game.kill('test')`);
await key('KeyR');
await wait(100);
check('Morte Súbita: R durante a morte não salva o save', await evaluate(`localStorage.getItem('summit_slot_${slotBefore}') === null`));
await wait(1500);
check('tela de morte súbita', await evaluate(visible('death')));
await shot('18-morte-subita');
check('slot 1 intacto', await evaluate(`localStorage.getItem('summit_slot_0') !== null`));
await evaluate(`document.querySelector('#death [data-act=menu]').click()`);
await wait(150);
await evaluate(`document.querySelector('[data-act=continue]').click()`);
await wait(150);
await evaluate(`document.querySelectorAll('#save-list button')[0].click()`);
await wait(200);
check('campanha abre', await evaluate(visible('campaign')));
await shot('19-campanha');
await evaluate(`document.querySelector('[data-act=camp-achievements]').click()`);
await wait(150);
await shot('20-conquistas');
await evaluate(`document.querySelector('#achievements [data-act=back]').click()`);
await wait(150);
check('voltar retorna à campanha', await evaluate(visible('campaign')));
await evaluate(`document.querySelector('[data-act=camp-chapters]').click()`);
await wait(150);
check('capítulos renderizados', await evaluate(`document.querySelectorAll('#level-list .level-card').length === 12`));
await shot('21-capitulos');
await evaluate(`document.querySelector('#levels [data-act=back]').click()`);
await evaluate(`document.querySelector('[data-act=camp-skills]').click()`);
await wait(150);
await shot('22-habilidades');
await evaluate(`document.querySelector('#skills [data-act=back]').click()`);
await evaluate(`document.querySelector('[data-act=camp-stats]').click()`);
await wait(150);
await shot('23-estatisticas');

check('sem erros no console', errors.length === 0, errors.slice(0, 6).join(' | '));
console.log(`Capturas em: ${OUT}`);
ws.close();
chrome.kill();
server.close();
process.exit(results.every(Boolean) ? 0 : 1);
