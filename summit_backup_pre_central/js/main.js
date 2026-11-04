import { View } from './scene.js';
import { Game } from './game.js';
import { LEVELS } from './levels.js';
import { Input, ACHIEVEMENTS, Save, SKILLS, Settings, chapterOfLevel } from './core.js';
import { Sfx } from './audio.js';
import { icon } from './icons.js';

const $ = id => document.getElementById(id);
const screens = ['menu', 'levels', 'achievements', 'controls', 'pause', 'complete', 'saves', 'mode', 'skills', 'credits', 'death', 'campaign', 'stats', 'options'];
const CHAPTER_NAMES = { 1: 'A Subida', 2: 'A Tempestade', 3: 'O Núcleo' };
const MUSIC_WIND = { 1: 0.03, 2: 0.09, 3: 0.05 };

Settings.load();
Save.load();
Input.init();

const view = new View($('c'));
let state = 'menu';
let currentLevel = 0;
let currentScreen = 'menu';
let navStack = [];
let pendingSlot = -1;
let saveScreenMode = 'continue';
let dialogResolve = null;
let lastFinal = null;
const hudCache = {};

const fmt = t => {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return String(m).padStart(2, '0') + ':' + s.toFixed(1).padStart(4, '0');
};

const setHtml = (id, html) => {
    if (hudCache[id] === html) return;
    hudCache[id] = html;
    $(id).innerHTML = html;
};

const stat = (label, value) => `<div class="stat"><small>${label}</small><b>${value}</b></div>`;

function showBanner(kicker, title, sub, duration = 2600) {
    $('banner-kicker').textContent = kicker;
    $('banner-title').textContent = title;
    $('banner-sub').textContent = sub;
    const el = $('banner');
    el.classList.remove('hidden', 'show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(showBanner.timer);
    showBanner.timer = setTimeout(() => el.classList.add('hidden'), duration);
}

function toast(iconName, title, desc) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div class="ic">${icon(iconName)}</div><div><b>${title}</b><small>${desc}</small></div>`;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 4200);
}

function renderHudSkills() {
    const owned = Save.data ? Save.data.skills : [];
    setHtml('hud-skills', SKILLS.filter(s => owned.includes(s.id)).map(s => `<span title="${s.name}">${icon(s.icon)}</span>`).join(''));
}

const game = new Game(view, {
    onHud(h) {
        setHtml('hud-level', `<small>Cap. ${h.chapter}</small> ${h.level}`);
        setHtml('hud-berries', `${icon('berry', 'red')} ${h.berries}/${h.totalBerries}`);
        setHtml('hud-deaths', `${icon('skull')} ${h.deaths}`);
        $('hud-time').textContent = fmt(h.time);
        const stamina = Math.max(0, h.stamina);
        $('stamina').style.width = stamina * 100 + '%';
        $('stamina').classList.toggle('low', stamina < 0.3);
        let hearts = '';
        for (let i = 0; i < h.maxHp; i++) hearts += icon('heart', i < h.hp ? 'on' : 'off');
        setHtml('hud-hearts', hearts);
        let dashes = '';
        for (let i = 0; i < h.maxDashes; i++) dashes += `<i class="${i < h.dashes ? 'on' : ''}"></i>`;
        setHtml('hud-dashes', dashes);
    },
    onAchievement(a) {
        toast(a.icon, a.name, a.desc);
    },
    onSkill(sk) {
        showBanner('Nova habilidade', sk.name, sk.desc, 3800);
        renderHudSkills();
    },
    onCheckpoint() {
        const el = $('checkpoint-note');
        el.classList.remove('hidden', 'show');
        void el.offsetWidth;
        el.classList.add('show');
    },
    onSecret(label) {
        toast('eye', label, 'Você foi além do caminho.');
    },
    onBossIntro(name, title) {
        document.body.classList.add('cinematic');
        showBanner('Chefe', name, title, 2700);
    },
    onBossBar(name, ratio, phase, marks) {
        document.body.classList.remove('cinematic');
        $('boss-bar').classList.remove('hidden');
        $('boss-name').textContent = name;
        $('boss-fill').style.width = ratio * 100 + '%';
        $('boss-lag').style.width = ratio * 100 + '%';
        setHtml('boss-marks', marks.map(m => `<i style="left:${m * 100}%"></i>`).join(''));
    },
    onBossEnd() {
        $('boss-bar').classList.add('hidden');
        showBanner('Vitória', 'Caminho livre', 'Siga até o portal.', 2400);
    },
    onComplete(r) {
        state = 'complete';
        Sfx.setTheme(null);
        $('hud').classList.add('hidden');
        $('boss-bar').classList.add('hidden');
        $('complete-kicker').textContent = r.lastOfChapter ? `Capítulo ${r.chapter} concluído` : `Capítulo ${r.chapter}`;
        $('complete-title').textContent = r.last ? 'Você chegou ao cume!' : r.lastOfChapter ? CHAPTER_NAMES[r.chapter] : r.name;
        const d = Save.data;
        const extra = r.lastOfChapter && d ? stat('Mortes no capítulo', d.chapterDeaths[r.chapter - 1]) : '';
        $('complete-stats').innerHTML = stat('Tempo', fmt(r.time) + (r.record ? ' <em>recorde!</em>' : ''))
            + stat('Morangos', `${r.berries}/${r.totalBerries}`) + stat('Mortes', r.deaths) + extra;
        $('btn-next').textContent = r.lastOfChapter ? 'Próximo capítulo' : 'Próxima fase';
        $('btn-next').classList.toggle('hidden', r.last);
        currentLevel = r.index;
        navStack = [];
        show('complete');
    },
    onPermadeathCommit() {
        const d = Save.data;
        lastFinal = d ? { deaths: d.deaths, time: d.totalTime, chapter: d.chapter } : null;
        if (Save.active >= 0) Save.deleteSlot(Save.active);
    },
    onPermadeath() {
        state = 'dead';
        Sfx.setTheme(null);
        $('hud').classList.add('hidden');
        $('boss-bar').classList.add('hidden');
        $('death-msg').textContent = 'Seu save foi permanentemente deletado.';
        $('death-stats').innerHTML = lastFinal
            ? stat('Capítulo alcançado', lastFinal.chapter) + stat('Tempo de jornada', fmt(lastFinal.time)) : '';
        navStack = [];
        show('death');
    }
});

function focusFirst(name) {
    const el = $(name);
    const target = el && el.querySelector('button:not(.hidden), .level-card[tabindex]');
    if (target) target.focus({ preventScroll: true });
}

function show(name, remember = false) {
    if (remember && currentScreen && currentScreen !== name) navStack.push(currentScreen);
    currentScreen = name;
    screens.forEach(s => $(s).classList.toggle('hidden', s !== name));
    focusFirst(name);
}

function back() {
    Sfx.uiBack();
    const prev = navStack.pop() || 'menu';
    if (prev === 'menu') {
        actions.menu();
        return;
    }
    show(prev);
}

function hideAll() {
    currentScreen = null;
    screens.forEach(s => $(s).classList.add('hidden'));
    if (document.activeElement) document.activeElement.blur();
}

function start(index, resume = null) {
    if (!Save.hasActive()) {
        renderSaves();
        navStack = [];
        show('saves');
        return;
    }
    Sfx.ensure();
    currentLevel = index;
    const d = Save.data;
    d.currentLevel = index;
    d.chapter = chapterOfLevel(index);
    if (!resume) d.checkpoint = null;
    Save.save();
    game.load(index, resume);
    Sfx.setTheme(LEVELS[index].chapter, MUSIC_WIND[LEVELS[index].chapter]);
    navStack = [];
    hideAll();
    document.body.classList.remove('cinematic');
    $('boss-bar').classList.add('hidden');
    $('hud').classList.remove('hidden');
    renderHudSkills();
    state = 'playing';
    showBanner(`Capítulo ${LEVELS[index].chapter} · Fase ${index + 1}`, LEVELS[index].name, CHAPTER_NAMES[LEVELS[index].chapter], 2200);
}

function renderLevels() {
    const list = $('level-list');
    list.innerHTML = '';
    const unlocked = Save.data ? Save.data.unlocked : 1;
    const best = Save.data ? Save.data.best : {};
    [1, 2, 3].forEach(ch => {
        const head = document.createElement('div');
        head.className = 'chapter-head';
        head.textContent = `Capítulo ${ch} — ${CHAPTER_NAMES[ch]}`;
        list.appendChild(head);
        LEVELS.forEach((l, i) => {
            if (l.chapter !== ch) return;
            const locked = i >= unlocked;
            const b = best[i];
            const card = document.createElement('div');
            card.className = 'level-card' + (locked ? ' locked' : '');
            const info = locked ? `${icon('lock')} Bloqueada` : b ? `${icon('clock')} ${fmt(b.time)} · ${icon('berry', 'red')} ${b.berries}` : 'Sem recorde';
            card.innerHTML = `<b>${i + 1}. ${l.name}${l.boss ? ' · Chefe' : ''}</b><span>${info}</span>`;
            if (!locked) {
                card.tabIndex = 0;
                card.onclick = () => start(i);
                card.onkeydown = e => {
                    if (e.code === 'Enter' || e.code === 'Space') start(i);
                };
            }
            list.appendChild(card);
        });
    });
}

function renderAchievements() {
    const achs = Save.data ? Save.data.achievements : {};
    const done = ACHIEVEMENTS.filter(a => achs[a.id]).length;
    $('ach-count').textContent = `${done}/${ACHIEVEMENTS.length}`;
    $('ach-list').innerHTML = ACHIEVEMENTS.map(a => {
        const ok = achs[a.id];
        const name = (!ok && a.secret) ? '???' : a.name;
        const desc = (!ok && a.secret) ? 'Conquista secreta' : a.desc;
        return `<div class="ach ${ok ? 'done' : ''}"><div class="ic">${icon(ok ? a.icon : 'lock')}</div><div><b>${name}</b><span>${desc}</span></div></div>`;
    }).join('');
}

function fmtSave(d) {
    const mode = d.mode === 'permadeath' ? 'Morte Súbita' : 'Normal';
    return `<span class="save-mode ${d.mode}">${mode}</span> Capítulo ${d.chapter} · Fase ${d.currentLevel + 1}
        <div class="save-line">${icon('skull')} ${d.deaths} ${icon('clock')} ${fmt(d.totalTime)} ${icon('trophy')} ${Object.keys(d.achievements).length}</div>`;
}

function addButton(parent, label, onClick, cls = '') {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = cls;
    b.onclick = onClick;
    parent.appendChild(b);
}

function renderSaves() {
    $('saves-title').textContent = saveScreenMode === 'newgame' ? 'Escolha um slot' : 'Continuar';
    const list = $('save-list');
    list.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const s = Save.slot(i);
        const card = document.createElement('div');
        card.className = 'level-card save-card' + (s ? '' : ' empty');
        card.innerHTML = s
            ? `<b>Save ${i + 1}</b><span>${fmtSave(s)}</span><small>Atualizado: ${new Date(s.updatedAt).toLocaleString()}</small>`
            : `<b>Save ${i + 1}</b><span>Vazio</span>`;
        const btns = document.createElement('div');
        btns.className = 'buttons row';
        if (saveScreenMode === 'newgame') {
            addButton(btns, s ? 'Substituir' : 'Criar', () => actions.selectSave(i), s ? 'danger' : '');
            if (s) addButton(btns, 'Excluir', () => actions.deleteSave(i), 'danger');
        } else if (s) {
            addButton(btns, 'Selecionar', () => actions.selectSave(i));
        }
        card.appendChild(btns);
        list.appendChild(card);
    }
}

function renderCampaign() {
    const s = Save.data;
    if (!s) return;
    $('campaign-title').textContent = `Campanha — Save ${Save.active + 1}`;
    const pct = Math.round((s.unlocked / LEVELS.length) * 100);
    $('campaign-summary').innerHTML = `${fmtSave(s)}<div class="progress"><div style="width:${pct}%"></div></div>`;
}

function renderStats() {
    const s = Save.data;
    const list = $('stats-list');
    if (!s) {
        list.innerHTML = '<p>Nenhum dado.</p>';
        return;
    }
    const skills = s.skills.map(id => (SKILLS.find(k => k.id === id) || { name: id }).name).join(', ');
    list.innerHTML = [
        stat('Campanha', `Save ${Save.active + 1}`),
        stat('Modo', s.mode === 'permadeath' ? 'Morte Súbita' : 'Normal'),
        stat('Capítulo', s.chapter),
        stat('Fase atual', s.currentLevel + 1),
        stat('Mortes', s.deaths),
        stat('Morangos', s.berries),
        stat('Cristais', s.crystals),
        stat('Inimigos derrotados', s.stomps),
        stat('Tempo jogado', fmt(s.totalTime)),
        stat('Áreas secretas', Object.keys(s.secrets).length),
        stat('Capítulos concluídos', s.completedChapters.join(', ') || '—'),
        stat('Conquistas', `${Object.keys(s.achievements).length}/${ACHIEVEMENTS.length}`),
        stat('Habilidades', skills)
    ].join('');
}

function renderSkills() {
    const data = Save.data;
    $('skill-list').innerHTML = SKILLS.map(sk => {
        const unlocked = data && data.skills.includes(sk.id);
        return `<div class="ach ${unlocked ? 'done' : ''}"><div class="ic">${icon(unlocked ? sk.icon : 'lock')}</div><div><b>${sk.name}</b><span>${sk.desc}</span><small>${unlocked ? 'Desbloqueada' : 'Desbloqueio: ' + sk.unlock}</small></div></div>`;
    }).join('');
}

function renderOptions() {
    $('vol-master').value = Settings.master;
    $('vol-music').value = Settings.music;
    $('vol-sfx').value = Settings.sfx;
    $('btn-mute').textContent = 'Som: ' + (Settings.muted ? 'desligado' : 'ligado');
    $('btn-shake').textContent = 'Tremor de tela: ' + (Settings.shake ? 'ligado' : 'reduzido');
    $('btn-shadows').textContent = 'Sombras: ' + (Settings.shadows ? 'ligadas' : 'desligadas');
}

function confirmDialog(text, yes = 'Confirmar') {
    $('dialog-text').textContent = text;
    $('dialog-yes').textContent = yes;
    $('dialog').classList.remove('hidden');
    $('dialog-no').focus();
    return new Promise(resolve => { dialogResolve = resolve; });
}

function closeDialog(answer) {
    $('dialog').classList.add('hidden');
    if (dialogResolve) dialogResolve(answer);
    dialogResolve = null;
    focusFirst(currentScreen);
}

$('dialog-yes').onclick = () => closeDialog(true);
$('dialog-no').onclick = () => closeDialog(false);

const actions = {
    continue() {
        saveScreenMode = 'continue';
        renderSaves();
        show('saves', true);
    },
    newgame() {
        saveScreenMode = 'newgame';
        renderSaves();
        show('saves', true);
    },
    options() {
        renderOptions();
        show('options', true);
    },
    achievements() { renderAchievements(); show('achievements', true); },
    controls() { show('controls', true); },
    credits() { show('credits', true); },
    back,
    mute() {
        Sfx.muted = !Sfx.muted;
        renderOptions();
    },
    'toggle-shake'() {
        Settings.shake = !Settings.shake;
        Settings.save();
        renderOptions();
    },
    'toggle-shadows'() {
        Settings.shadows = !Settings.shadows;
        Settings.save();
        view.renderer.shadowMap.enabled = Settings.shadows;
        view.sun.castShadow = Settings.shadows;
        view.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
        renderOptions();
    },
    fullscreen() {
        const el = document.documentElement;
        if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
        else document.exitFullscreen().catch(() => {});
    },
    menu() {
        game.flushPlaytime();
        state = 'menu';
        navStack = [];
        Sfx.setTheme(null);
        document.body.classList.remove('cinematic');
        $('boss-bar').classList.add('hidden');
        $('banner').classList.add('hidden');
        $('hud').classList.add('hidden');
        game.running = false;
        show('menu');
    },
    resume() {
        hideAll();
        state = 'playing';
    },
    restart() { start(currentLevel); },
    next() { start(Math.min(currentLevel + 1, LEVELS.length - 1)); },
    async reset() {
        if (await confirmDialog('Apagar todo o progresso e as conquistas deste save?', 'Apagar')) {
            Save.reset();
            actions.menu();
        }
    },
    async selectSave(i) {
        if (saveScreenMode === 'newgame') {
            if (Save.slot(i) && !await confirmDialog('Este slot já contém uma campanha. Iniciar uma nova campanha substituirá o progresso existente.', 'Substituir')) return;
            pendingSlot = i;
            show('mode', true);
            return;
        }
        Save.setActive(i);
        if (!Save.hasActive()) return;
        renderCampaign();
        show('campaign', true);
    },
    async deleteSave(i) {
        if (await confirmDialog(`Excluir o save ${i + 1}?`, 'Excluir')) {
            Save.deleteSlot(i);
            renderSaves();
            focusFirst('saves');
        }
    },
    'mode-normal'() {
        if (pendingSlot < 0) return;
        Save.create(pendingSlot, 'normal');
        pendingSlot = -1;
        saveScreenMode = 'continue';
        start(0);
    },
    async 'mode-permadeath'() {
        if (pendingSlot < 0) return;
        if (!await confirmDialog('MODO MORTE SÚBITA: se você morrer, o save será permanentemente deletado.', 'Aceitar')) return;
        Save.create(pendingSlot, 'permadeath');
        pendingSlot = -1;
        saveScreenMode = 'continue';
        start(0);
    },
    'camp-continue'() {
        const s = Save.data;
        if (!s) return;
        const cp = s.checkpoint;
        const index = s.currentLevel;
        start(index, cp && cp.level === index ? cp : null);
    },
    'camp-chapters'() { renderLevels(); show('levels', true); },
    'camp-achievements'() { renderAchievements(); show('achievements', true); },
    'camp-skills'() { renderSkills(); show('skills', true); },
    'camp-stats'() { renderStats(); show('stats', true); },
    'camp-settings'() { renderOptions(); show('options', true); }
};

document.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (btn && actions[btn.dataset.act]) {
        Sfx.ensure();
        Sfx.uiSelect();
        actions[btn.dataset.act](btn);
    }
});

function focusables() {
    const scope = dialogResolve ? $('dialog') : $(currentScreen);
    if (!scope) return [];
    return [...scope.querySelectorAll('button, input, .level-card[tabindex]')].filter(el => el.offsetParent !== null);
}

function menuKeys(e) {
    const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.code];
    if (dir) {
        if (document.activeElement && document.activeElement.type === 'range' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) return;
        const list = focusables();
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
        Sfx.uiMove();
        return;
    }
    if (e.code === 'Escape') {
        if (dialogResolve) closeDialog(false);
        else if (currentScreen !== 'menu' && currentScreen !== 'complete' && currentScreen !== 'death') {
            if (currentScreen === 'pause') actions.resume();
            else back();
        }
    }
}

addEventListener('keydown', e => {
    if (e.repeat) return;
    if (state === 'playing') {
        const p = game.player;
        const permaDying = game.permadeathPending;
        if ((e.code === 'Escape' || e.code === 'KeyP') && !permaDying && !game.finished) {
            state = 'paused';
            game.flushPlaytime();
            $('pause-info').innerHTML = stat('Fase', LEVELS[currentLevel].name) + stat('Tempo', fmt(game.time)) + stat('Morangos', `${game.levelBerries}/${game.totalBerries}`);
            navStack = [];
            show('pause');
            Sfx.uiBack();
        } else if (e.code === 'KeyR' && !permaDying && !p.dead && !game.finished) {
            start(currentLevel);
        }
        return;
    }
    if (e.code === 'KeyP' && state === 'paused' && currentScreen === 'pause') {
        actions.resume();
        return;
    }
    menuKeys(e);
});

[['vol-master', 'master'], ['vol-music', 'music'], ['vol-sfx', 'sfx']].forEach(([id, key]) => {
    $(id).addEventListener('input', () => {
        Settings[key] = parseFloat($(id).value);
        Settings.save();
        Sfx.applyVolumes();
    });
});

addEventListener('pagehide', () => game.flushPlaytime());
document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing' && !game.permadeathPending && !game.finished) {
        state = 'paused';
        game.flushPlaytime();
        navStack = [];
        show('pause');
    }
});

let last = performance.now();
function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    Input.pollGamepad();
    if (state === 'playing') {
        game.update(dt);
    } else {
        Input.endFrame();
        if (state === 'menu') view.idle(dt);
        else view.updateParticles(dt);
    }
    view.render();
    requestAnimationFrame(loop);
}

game.load(0);
game.running = false;
view.idle(0.016);
requestAnimationFrame(loop);

globalThis.__summit = { game, view, actions, Save, get state() { return state; } };
