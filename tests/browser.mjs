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
await wait(1800);
check('novo jogo abre a introdução', await evaluate(`__summit.state === 'cinema' && ${visible('cinema')}`));
check('introdução mostra texto', (await evaluate(`document.getElementById('cine-caption').textContent`)) === 'A montanha não tem nome.');
await shot('03b-intro-montanha');
await key('Enter');
await wait(400);
check('Enter avança o plano', await evaluate(`__summit.cinema.active.index === 1`));
await key('Escape');
await wait(900);
check('Esc pula a cena e abre a central', await evaluate(`__summit.state === 'hub' && __summit.Save.data.story.scenes.intro === true`));
check('novo jogo entra na central do save', await evaluate(`__summit.screen === 'hub' && ${visible('hub')}`));
check('personagem 3D renderizado na central', await evaluate(`(() => { const c = document.getElementById('hero'); return c.offsetWidth > 100 && c.closest('#hero-slot') !== null; })()`));
await shot('04-central');
await evaluate(`document.getElementById('btn-continue').click()`);
await wait(300);
check('continuar abre a preparação', await evaluate(visible('prep')));
await shot('04b-preparacao-inicio');
await evaluate(`document.getElementById('btn-prep-start').click()`);
await wait(1500);
check('jogo iniciado', await evaluate(`__summit.state === 'playing' && ${visible('hud')}`));
check('HUD mostra a habilidade equipada', await evaluate(`document.querySelectorAll('#hud-abilities .hud-ab').length === 1 && ${visible('hud-abilities')}`));
await shot('04c-fase1');

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
    for (let i = 0; i < 80 && !(await evaluate(`__summit.game.boss.mode === 'fight'`)); i++) await wait(250);
    check(`${label}: batalha ativa, barra visível`, await evaluate(`__summit.game.boss.mode === 'fight' && ${visible('boss-bar')}`));
    console.log(`FPS ${label}: ${(await frameTimes(1500))?.toFixed(1)}`);
    await shot(label + '-luta');
    await wait(4000);
    await shot(label + '-ataque');
    if (level === 4) continue;
    for (const phase of [1, 2]) {
        await evaluate(`(() => { const b = __summit.game.boss; while (b.phase < ${phase}) { b.vulnerable = true; b.invuln = 0; b.damage(); } })()`);
        await wait(9000);
        check(`${label}: fase ${phase + 1} sem travar`, await evaluate(`__summit.game.boss.phase === ${phase} && __summit.game.boss.mode === 'fight'`));
        await shot(`${label}-fase${phase + 1}`);
    }
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

const until = async (expression, ms = 30000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        if (await evaluate(expression)) return true;
        await wait(150);
    }
    return false;
};
const scenePlates = async (id, label) => {
    await evaluate(`__summit.playScene('${id}', () => __summit.actions['to-hub'](), true)`);
    const count = await evaluate(`__summit.cinema.active.def.shots.length`);
    for (let i = 0; i < count; i++) {
        await evaluate(`(() => { const c = __summit.cinema; const a = c.active; a.index = ${i} - 1; c.nextShot(); const s = a.def.shots[a.index]; const last = s.lines.at(-1); a.t = Math.max(0.8, Math.min(s.dur - 2.2, last ? last[0] + 0.3 : s.dur * 0.5)); })()`);
        await wait(900);
        await shot(`50-${label}-${i + 1}`);
    }
    await key('Escape');
    await wait(500);
};
await evaluate(`(() => { const d = __summit.Save.data; Object.assign(d.story.scenes, { intro: true, ch1to2: true, ch2to3: true, final: true }); __summit.game.running = false; })()`);
for (const [id, label] of [['intro', 'intro'], ['ch1to2', 'cap1-2'], ['ch2to3', 'cap2-3'], ['final', 'final']]) await scenePlates(id, label);
check('cenas revistas não mudam o progresso', await evaluate(`__summit.state === 'hub'`));

const place = (level, x, y) => evaluate(`(() => { const G = __summit.game; delete G.hurtPlayer; delete G.kill; __summit.actions.resume(); G.load(${level}); __summit.view.setDim(1); G.running = true; G.hurtPlayer = () => {}; G.kill = () => {}; G.player.x = ${x}; G.player.y = ${y}; G.spawn = { x: ${x}, y: ${y} }; G.view.follow(${x}, ${y}, 0, true); })()`);
for (const [level, x, y, label] of [[0, 4, 2, '60-acampamento'], [1, 33, 2, '61-cidade'], [2, 44, 2, '62-caverna'], [3, 64, 14, '63-templo'], [4, 115, 30, '64-assento-varak'], [6, 86, 25, '65-diario'], [8, 52, 6, '66-observatorio'], [9, 41, 2, '67-maquinas'], [10, 30, 57, '68-quarentena'], [11, 77, 20, '69-tremor']]) {
    await place(level, x, y);
    await wait(1300);
    await shot(label);
}
check('fala aparece sem pausar o jogo', await evaluate(`__summit.state === 'playing' && ${visible('story-line')}`));
await place(3, 42, 17);
await evaluate(`__summit.game.player.x = __summit.game.recordStones[0].x - 3`);
await wait(500);
await shot('70-pedra-registro');
const stoneId = await evaluate(`(() => { const G = __summit.game; const s = G.recordStones[0]; G.player.x = s.x; G.player.y = s.y - 0.4; return s.id; })()`);
await wait(300);
check('pedra entrega o registro ao save', await evaluate(`__summit.Save.data.story.records['${stoneId}'] === true`));
await shot('71-toast-registro');

for (const [level, label, times] of [[4, '72-fim-varak', [2500, 3000, 3200]], [8, '73-fim-aethos', [2200, 3200, 2600]], [11, '74-fim-guardiao', [1800, 2400]]]) {
    await place(level, 0, 0);
    await evaluate(`(() => { const G = __summit.game; const a = G.level.arena; G.player.x = a.triggerX + 1; G.player.y = a.floor + 0.2; })()`);
    await wait(4200);
    await evaluate(`(() => { const b = __summit.game.boss; while (b.mode === 'fight') { b.vulnerable = true; b.invuln = 0; b.damage(); } })()`);
    await until(`!!__summit.game.aftermath`, 40000);
    check(`${label}: cena de encerramento ativa`, await evaluate(`!!__summit.game.aftermath && !__summit.game.aftermath.done`));
    let i = 0;
    for (const t of times) {
        await wait(t);
        await shot(`${label}-${++i}`);
    }
    check(`${label}: controle volta ao jogador`, await until(`__summit.game.aftermath.done && !__summit.game.cutscene`, 60000));
}

await evaluate(`(() => { const G = __summit.game; const d = __summit.Save.data; delete G.hurtPlayer; delete G.kill; delete d.story.scenes.final; delete d.best[11]; G.load(11); G.boss.mode = 'dead'; G.complete(); })()`);
await wait(1600);
check('concluir a última fase abre o final', await evaluate(`__summit.state === 'cinema' && __summit.cinema.active.id === 'final'`));
await key('Escape');
await wait(500);
check('final leva à tela de conclusão', await evaluate(`__summit.screen === 'complete' && document.getElementById('complete-title').textContent === 'A montanha em silêncio'`));
check('final conta conquista e fica salvo', await evaluate(`__summit.Save.data.story.scenes.final === true && __summit.Save.data.achievements.core_reached === true`));
await shot('75-conclusao');
await evaluate(`__summit.actions['to-hub']()`);
await wait(400);
await evaluate(`__summit.hub.setTab('records')`);
await wait(300);
await shot('76-registros');
check('aba Registros lista e abre leitura', await evaluate(`document.querySelectorAll('.rec-row').length > 20 && !!document.querySelector('.rec-text')`));
const lockedCount = await evaluate(`document.querySelectorAll('.rec-row.locked').length`);
await evaluate(`document.querySelector('.rec-row:not(.locked)').click()`);
await wait(150);
check('registro selecionado permanece visível', await evaluate(`!!document.querySelector('.rec-row.selected')`));
check('há registros ainda ocultos', lockedCount > 0, String(lockedCount));
await send('Emulation.setDeviceMetricsOverride', { width: 760, height: 900, deviceScaleFactor: 1, mobile: false });
await wait(400);
await shot('77-registros-760');
check('Registros cabem em 760 px', await evaluate(`(() => { const b = document.getElementById('hub'); return b.scrollWidth - b.clientWidth <= 1; })()`));
await evaluate(`__summit.playScene('final', () => __summit.actions['to-hub'](), true)`);
await wait(2000);
await shot('78-final-760');
await key('Escape');
await wait(400);
await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 640, deviceScaleFactor: 1, mobile: false });
await evaluate(`__summit.playScene('intro', () => __summit.actions['to-hub'](), true)`);
await wait(2000);
await shot('79-intro-1024');
await key('Escape');
await wait(400);
await send('Emulation.clearDeviceMetricsOverride');
await wait(300);
await place(0, 4, 2);
await evaluate(`(() => { const G = __summit.game; delete G.hurtPlayer; delete G.kill; })()`);

const click = sel => evaluate(`document.querySelector(${JSON.stringify(sel)}).click()`);
const textOf = sel => evaluate(`document.querySelector(${JSON.stringify(sel)})?.textContent`);
const count = sel => evaluate(`document.querySelectorAll(${JSON.stringify(sel)}).length`);

await evaluate(`document.querySelector('#hud') && __summit.game.load(0)`);
await key('KeyQ');
await wait(250);
check('tecla Q ativa a Onda de Choque de verdade', await evaluate(`__summit.game.abilities.byId.get('shockwave').cooldown > 0`));
await shot('24-hud-recarga');
await key('KeyQ');
await wait(80);
check('HUD indica indisponível', await evaluate(`document.querySelector('.hud-ab').classList.contains('denied')`));
await shot('25-hud-indisponivel');

await key('Escape');
await wait(150);
await click('#pause [data-act=to-hub]');
await wait(400);
check('pausa volta à central', await evaluate(`__summit.screen === 'hub'`));

await evaluate(`(() => {
    const d = __summit.Save.data;
    d.unlocked = 7; d.currentLevel = 6; d.stomps = 22; d.berries = 26; d.crystals = 14; d.deaths = 9; d.totalTime = 2710;
    d.completedChapters = [1]; d.chapterDeaths = [6, 3, 0];
    Object.assign(d.story.scenes, { intro: true, ch1to2: true, ch2to3: true, final: true });
    for (let i = 0; i < 6; i++) d.best[i] = { time: 42 + i * 11, berries: 4 };
    d.secrets['5:valley'] = true;
    Object.assign(d.achievements, { boss1: true, no_death: true, first_steps: true, stomp_5: true, berry_5: true, crystal_10: true, ch1_complete: true });
    d.skills = ['dash', 'wall_climb', 'double_jump', 'air_dash'];
    __summit.Save.refreshAbilities();
    d.loadout = ['shockwave', 'energy_shield'];
    __summit.Save.save();
    __summit.hub.open('home');
})()`);
await wait(600);
await shot('26-central-avancada');

const tabs = ['chapters', 'abilities', 'achievements', 'stats', 'settings'];
for (const [i, tab] of tabs.entries()) {
    await click(`#hub-nav [data-arg=${tab}]`);
    await wait(350);
    check(`aba ${tab} abre`, await evaluate(`document.getElementById('hub-panel').dataset.tab === '${tab}'`));
    await shot(`${27 + i}-aba-${tab}`);
}

await click('#hub-nav [data-arg=chapters]');
await wait(200);
check('capítulo mostra as fases dele', (await count('.level-tile')) === 4);
await click('.chapter-tab.ch-3');
await wait(150);
check('capítulo bloqueado não abre', await evaluate(`!document.querySelector('.chapter-tab.ch-3').classList.contains('selected')`));
await click('.chapter-tab.ch-1');
await wait(150);
check('capítulo 1 lista 5 fases', (await count('.level-tile')) === 5);
await click('.chapter-tab.ch-2');
await wait(150);
await click('.level-tile.locked');
await wait(150);
check('fase bloqueada não abre preparação', await evaluate(`__summit.screen === 'hub'`));
await click('.level-tile.done');
await wait(250);
check('fase liberada abre preparação', await evaluate(visible('prep')));
await click('[data-act=prep-back]');
await wait(250);
check('voltar da preparação retorna à central', await evaluate(`__summit.screen === 'hub'`));

await click('#hub-nav [data-arg=abilities]');
await wait(200);
await click('.chip[data-arg=mobility]');
await wait(100);
check('filtro por categoria', (await count('#hub-panel .ab-card')) === 4);
await click('.chip[data-arg=all]');
await wait(100);
check('catálogo completo visível', (await count('#hub-panel .ab-card')) === 20);
await click('.ab-card[data-arg=shockwave]');
await wait(100);
check('detalhe mostra próximo nível', (await textOf('#ability-detail')).includes('Próximo nível'));
await click('#ability-detail [data-act=ability-upgrade]');
await wait(150);
check('evolução aplicada no save', await evaluate(`__summit.Save.data.abilities.shockwave === 2`));
await shot('32-habilidade-evoluida');

await click('#hub-nav [data-arg=home]');
await wait(250);
await click('#btn-continue');
await wait(300);
await shot('33-preparacao');
check('preparação mostra 2/3', (await textOf('.slots-head b')) === '2/3');
const owned = await evaluate(`[...document.querySelectorAll('#prep-grid .ab-card')].map(c => c.dataset.arg)`);
const free = owned.filter(id => !['shockwave', 'energy_shield'].includes(id));
await click(`#prep-grid .ab-card[data-arg=${free[0]}]`);
await wait(120);
check('terceira habilidade entra', (await textOf('.slots-head b')) === '3/3');
await click(`#prep-grid .ab-card[data-arg=${free[1]}]`);
await wait(120);
check('quarta é recusada com mensagem', (await textOf('.slots-head b')) === '3/3' && (await textOf('#prep-msg')).includes('ocupados'));
await shot('34-preparacao-cheia');
await click(`.slot.filled[data-arg=${free[0]}]`);
await wait(120);
await click(`#prep-grid .ab-card[data-arg=${free[1]}]`);
await wait(120);
check('substituição funciona', await evaluate(`__summit.Save.data.loadout.includes('${free[1]}') && !__summit.Save.data.loadout.includes('${free[0]}')`));
await click('#btn-prep-clear');
await wait(120);
check('remover seleção esvazia', (await textOf('.slots-head b')) === '0/3');
await click('#prep-grid .ab-card[data-arg=shockwave]');
await click(`#prep-grid .ab-card[data-arg=${free[1]}]`);
await wait(120);
await click('#btn-prep-start');
await wait(1500);
check('fase carrega as habilidades escolhidas', await evaluate(`__summit.game.abilities.slots.map(s => s.id).join() === 'shockwave,${free[1]}'`));
check('nível evoluído chega ao gameplay', await evaluate(`__summit.game.abilities.byId.get('shockwave').stats.radius === 4.5`));
await shot('35-fase-com-habilidades');

await evaluate(`(() => {
    const G = __summit.game;
    const P = G.player;
    G.abilities.effects.length = 0;
    for (const id of ['energy_shield', 'blade_dash', 'summit_form', 'recall', 'time_dilation']) __summit.Save.data.abilities[id] = 1;
    __summit.Save.data.loadout = ['energy_shield', 'recall', 'time_dilation'];
    G.load(G.levelIndex);
    G.hurtPlayer = () => {};
    G.kill = () => {};
})()`);
await wait(300);
await key('KeyQ');
await wait(60);
await key('KeyE');
await wait(60);
await key('KeyF');
await wait(250);
check('escudo, marca e tempo suspenso ativos juntos', await evaluate(`['energy_shield', 'recall', 'time_dilation'].every(id => __summit.game.abilities.isActive(id))`));
check('tempo suspenso muda o visual da tela', await evaluate(`document.body.classList.contains('slowmo')`));
await shot('35b-efeitos-defesa-tempo');
await evaluate(`(() => {
    const G = __summit.game;
    delete G.hurtPlayer;
    delete G.kill;
    __summit.Save.data.loadout = ['summit_form', 'shockwave', 'blade_dash'];
    G.load(G.levelIndex);
    G.hurtPlayer = () => {};
    G.kill = () => {};
})()`);
await wait(300);
await key('KeyQ');
await wait(40);
await key('KeyE');
await wait(90);
await shot('35c-efeitos-forma-onda');
await evaluate(`(() => {
    const G = __summit.game;
    delete G.hurtPlayer;
    delete G.kill;
    __summit.Save.data.loadout = ['shockwave', '${free[1]}'];
    G.load(G.levelIndex);
})()`);
await wait(200);

const rPosition = await evaluate(`__summit.game.abilities.slots.length`);
await key('KeyR');
await wait(400);
check('R reinicia mantendo a seleção', (await evaluate(`__summit.game.abilities.slots.length`)) === rPosition && await evaluate(`__summit.state === 'playing'`));
await key('Escape');
await wait(150);
await click('#pause [data-act=to-hub]');
await wait(300);

await click('#hub-nav [data-arg=settings]');
await wait(200);
await click('.bind-key[data-arg=skill1]');
await wait(80);
await key('KeyT');
await wait(100);
check('tecla trocada na tela de controles', await evaluate(`__summit.Settings.keys.skill1[0] === 'KeyT'`));
await click('.bind-key[data-arg=skill1]');
await key('KeyW');
await wait(100);
check('tecla reservada recusada', await evaluate(`__summit.Settings.keys.skill1[0] === 'KeyT' && document.querySelectorAll('.toast').length > 0`));
await click('[data-act=reset-keys]');

await evaluate(`__summit.hub.setTab('home')`);
await wait(200);
await evaluate(`document.querySelector('#hub-nav [data-arg=stats]').focus()`);
await evaluate(`dispatchEvent(new KeyboardEvent('keydown', { code: 'PadJump', key: 'PadJump' }))`);
await wait(200);
check('controle confirma nos menus', await evaluate(`document.getElementById('hub-panel').dataset.tab === 'stats'`));
await evaluate(`dispatchEvent(new KeyboardEvent('keydown', { code: 'PadDash', key: 'PadDash' }))`);
await wait(200);
check('controle volta nos menus', await evaluate(`document.getElementById('hub-panel').dataset.tab === 'home'`));
await key('ArrowDown');
await wait(60);
check('setas navegam na central', await evaluate(`document.activeElement && document.activeElement.tagName === 'BUTTON'`));

const slot0 = await evaluate(`localStorage.getItem('summit_slot_0')`);
const otherSlots = await evaluate(`localStorage.getItem('summit_slot_1')`);
await click('.rail-exit');
await wait(120);
check('Sair do Save pede confirmação', await evaluate(visible('dialog')));
await shot('36-sair-confirmacao');
await click('#dialog-no');
await wait(120);
check('cancelar mantém na central', await evaluate(`__summit.screen === 'hub' && __summit.Save.active === 0`));
await click('.rail-exit');
await wait(120);
await click('#dialog-yes');
await wait(300);
check('Sair do Save volta aos três slots', await evaluate(`__summit.screen === 'saves' && document.querySelectorAll('#save-list .slot-card').length === 3`));
check('campanha desativada sem apagar', await evaluate(`__summit.Save.active === -1 && localStorage.getItem('summit_slot_0') !== null && localStorage.getItem('summit_active_slot') === null`));
const after = JSON.parse(await evaluate(`localStorage.getItem('summit_slot_0')`));
const prior = JSON.parse(slot0);
check('progresso preservado ao sair', after.unlocked === prior.unlocked && after.deaths === prior.deaths && after.abilities.shockwave === 2 && JSON.stringify(after.loadout) === JSON.stringify(prior.loadout));
check('outro slot intacto ao sair', (await evaluate(`localStorage.getItem('summit_slot_1')`)) === otherSlots);
await shot('37-slots');

await evaluate(`document.querySelectorAll('#save-list .slot-card')[1].querySelector('button').click()`);
await wait(200);
check('slot vazio leva à escolha de modo', await evaluate(visible('mode')));
await evaluate(`document.querySelector('[data-act=mode-permadeath]').click()`);
await wait(150);
check('confirmação interna do jogo', await evaluate(visible('dialog')));
await shot('17-dialogo');
await evaluate(`document.getElementById('dialog-yes').click()`);
await wait(600);
check('Morte Súbita também abre a introdução', await evaluate(`__summit.state === 'cinema'`));
await key('Escape');
await wait(600);
check('Morte Súbita entra na central', await evaluate(`__summit.screen === 'hub'`));
await shot('38-central-morte-subita');
check('slot novo não herda dados do outro', await evaluate(`__summit.Save.data.mode === 'permadeath' && __summit.Save.data.deaths === 0 && !__summit.Save.data.abilities.recall && __summit.Save.data.unlocked === 1`));
await click('#btn-continue');
await wait(200);
await click('#btn-prep-start');
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
await wait(400);
check('campanha reabre na central', await evaluate(visible('hub')));
check('dados do slot 1 preservados', await evaluate(`__summit.Save.data.abilities.shockwave === 2 && __summit.Save.data.unlocked === 7`));

await evaluate(`location.reload()`);
await wait(2000);
await evaluate(`document.querySelector('[data-act=continue]').click()`);
await wait(150);
await evaluate(`document.querySelectorAll('#save-list button')[0].click()`);
await wait(400);
check('seleção e evolução sobrevivem a recarregar a página', await evaluate(`__summit.Save.data.abilities.shockwave === 2 && __summit.Save.data.loadout.includes('shockwave')`));

for (const [w, h, label] of [[1920, 1080, 'fhd'], [1024, 640, 'pequena'], [760, 900, 'estreita']]) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await evaluate(`__summit.hub.setTab('home')`);
    await wait(500);
    await shot(`40-central-${label}`);
    const overflow = await evaluate(`(() => { const b = document.getElementById('hub'); return b.scrollWidth - b.clientWidth; })()`);
    check(`central sem transbordo lateral em ${w}x${h}`, overflow <= 1, String(overflow));
    await evaluate(`__summit.hub.actions['hub-continue']()`);
    await wait(300);
    await shot(`41-preparacao-${label}`);
    await evaluate(`__summit.actions['prep-back']()`);
    await wait(150);
}
await send('Emulation.clearDeviceMetricsOverride');

check('sem erros no console', errors.length === 0, errors.slice(0, 6).join(' | '));
console.log(`Capturas em: ${OUT}`);
ws.close();
chrome.kill();
server.close();
process.exit(results.every(Boolean) ? 0 : 1);
