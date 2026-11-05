import { View } from './scene.js';
import { Game } from './game.js';
import { LEVELS } from './levels.js';
import { Input, Save, SKILLS, Settings, chapterOfLevel, keyLabel } from './core.js';
import { LOADOUT_SIZE, abilityById } from './abilities.js';
import { CHAPTER_NAMES, campaignProgress, continueLevel, levelFacts } from './campaign.js';
import { Sfx } from './audio.js';
import { icon } from './icons.js';
import { createHub, fmtLong, fmtTime as fmt } from './hub.js';
import { HeroStage } from './hero.js';
import { Cinema } from './cinema.js';
import { SCENE_AFTER_LEVEL, pendingScene } from './story.js';

const $ = id => document.getElementById(id);
const screens = ['menu', 'pause', 'complete', 'saves', 'mode', 'credits', 'death', 'options', 'hub', 'prep'];
const MUSIC_WIND = { 1: 0.03, 2: 0.09, 3: 0.05 };
const BINDINGS = [
    ['jump', 'Pular'], ['dash', 'Dash'], ['grab', 'Agarrar parede'],
    ['skill1', 'Habilidade 1'], ['skill2', 'Habilidade 2'], ['skill3', 'Habilidade 3']
];

Settings.load();
Save.load();
Input.init();

const view = new View($('c'));
const cinema = new Cinema(view, {
    onCaption(text, style) {
        const el = $('cine-caption');
        el.classList.toggle('voice', style === 'voice');
        el.classList.remove('show');
        if (!text) return;
        el.textContent = text;
        void el.offsetWidth;
        el.classList.add('show');
    },
    onFade(amount) {
        $('cine-fade').style.opacity = amount;
    }
});
let state = 'menu';
let currentLevel = 0;
let currentScreen = 'menu';
let navStack = [];
let pendingSlot = -1;
let saveScreenMode = 'continue';
let dialogResolve = null;
let lastFinal = null;
let rebinding = null;
let sceneRun = null;
const hudCache = {};

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

Save.onWriteError = () => toast('lock', 'Não foi possível salvar', 'O armazenamento do navegador está cheio ou bloqueado.');

function renderHudMoves() {
    const owned = Save.data ? Save.data.skills : [];
    setHtml('hud-skills', SKILLS.filter(s => owned.includes(s.id)).map(s => `<span title="${s.name}">${icon(s.icon)}</span>`).join(''));
}

function renderHudAbilities(list) {
    const host = $('hud-abilities');
    const signature = list.map(a => a.id + a.key).join();
    if (hudCache.abilitySlots !== signature) {
        hudCache.abilitySlots = signature;
        host.innerHTML = list.map(a => {
            const def = abilityById(a.id);
            return `<div class="hud-ab cat-${def.category}" data-id="${a.id}">
                <div class="hud-ab-face">${icon(a.icon)}<i class="hud-ab-cd"></i><i class="hud-ab-num"></i></div>
                <kbd>${a.type === 'active' ? a.key : a.type === 'hold' ? 'Segurar' : 'Passiva'}</kbd>
                <em class="hud-ab-msg"></em>
            </div>`;
        }).join('');
        host.classList.toggle('hidden', !list.length);
    }
    list.forEach((a, i) => {
        const el = host.children[i];
        if (!el) return;
        const face = el.firstElementChild;
        const cd = a.cooldown > 0 ? a.cooldown : a.active > 0 ? 1 - a.active : a.charge > 0 ? 1 - a.charge : 0;
        const cover = face.children[1];
        const ratio = Math.round(cd * 100);
        if (el.dataset.cover !== String(ratio)) {
            el.dataset.cover = ratio;
            cover.style.setProperty('--cd', ratio + '%');
        }
        const num = a.cooldown > 0 ? String(Math.ceil(a.seconds)) : a.armed ? '↩' : a.alert ? '!' : '';
        if (face.children[2].textContent !== num) face.children[2].textContent = num;
        el.classList.toggle('cooling', a.cooldown > 0);
        el.classList.toggle('active', a.active > 0);
        el.classList.toggle('charging', a.charge > 0);
        el.classList.toggle('spent', a.spent);
        el.classList.toggle('alert', a.alert);
        el.classList.toggle('pulse', a.pulse);
        el.classList.toggle('denied', a.denied);
        const msg = el.lastElementChild;
        if (a.message && msg.textContent !== a.message) msg.textContent = a.message;
    });
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
        renderHudAbilities(h.abilities);
        document.body.classList.toggle('slowmo', h.slowmo);
    },
    onAchievement(a) {
        toast(a.icon, a.name, a.desc);
    },
    onAbilityUnlock(a) {
        toast(a.icon, 'Nova habilidade', a.name);
    },
    onSkill(sk) {
        showBanner('Novo movimento', sk.name, sk.desc, 3800);
        renderHudMoves();
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
    onBossStatus(text, shielded) {
        const cue = $('boss-cue');
        if (cue.textContent !== text) {
            cue.textContent = text;
            cue.classList.remove('pop');
            void cue.offsetWidth;
            if (text) cue.classList.add('pop');
        }
        $('boss-bar').classList.toggle('shielded', shielded);
    },
    onBossEnd() {
        $('boss-cue').textContent = '';
        $('boss-bar').classList.remove('shielded');
        $('boss-bar').classList.add('hidden');
    },
    onBossEpilogue() {
        showBanner('Vitória', 'Caminho livre', 'Siga até o portal.', 2400);
    },
    onStoryLine(text, who, duration) {
        showStoryLine(text, who, duration);
    },
    onRecord(record) {
        toast('scroll', 'Registro encontrado', record.title);
    },
    onComplete(r) {
        const d = Save.data;
        const scene = SCENE_AFTER_LEVEL[r.index];
        if (scene && d && !d.story.scenes[scene]) playScene(scene, () => showComplete(r));
        else showComplete(r);
    },
    onPermadeathCommit() {
        const d = Save.data;
        lastFinal = d ? { deaths: d.deaths, time: d.totalTime, chapter: d.chapter } : null;
        if (Save.active >= 0) Save.deleteSlot(Save.active);
    },
    onPermadeath() {
        state = 'dead';
        Sfx.setTheme(null);
        document.body.classList.remove('slowmo');
        $('hud').classList.add('hidden');
        $('hud-abilities').classList.add('hidden');
        $('boss-bar').classList.add('hidden');
        $('death-msg').textContent = 'Seu save foi permanentemente deletado. Os outros slots não foram afetados.';
        $('death-stats').innerHTML = lastFinal
            ? stat('Capítulo alcançado', lastFinal.chapter) + stat('Tempo de jornada', fmt(lastFinal.time)) : '';
        navStack = [];
        show('death');
    }
});

const hub = createHub({
    game,
    toast,
    show,
    start,
    currentScreen: () => currentScreen,
    mountSettings,
    createHero: canvas => new HeroStage(canvas),
    replayScene: id => playScene(id, () => enterHub('records'), true)
});

function focusFirst(name) {
    const el = $(name);
    const target = el && el.querySelector('button:not(.hidden):not([disabled])');
    if (target) target.focus({ preventScroll: true });
}

function showComplete(r) {
    state = 'complete';
    Sfx.setTheme(null);
    document.body.classList.remove('slowmo');
    $('hud').classList.add('hidden');
    $('hud-abilities').classList.add('hidden');
    $('boss-bar').classList.add('hidden');
    $('complete-kicker').textContent = r.lastOfChapter ? `Capítulo ${r.chapter} concluído` : `Capítulo ${r.chapter} · Fase ${r.index + 1}`;
    $('complete-title').textContent = r.last ? 'A montanha em silêncio' : r.lastOfChapter ? CHAPTER_NAMES[r.chapter] : r.name;
    const d = Save.data;
    const extra = r.lastOfChapter && d ? stat('Mortes no capítulo', d.chapterDeaths[r.chapter - 1]) : '';
    $('complete-stats').innerHTML = stat('Tempo', fmt(r.time) + (r.record ? ' <em>recorde!</em>' : ''))
        + stat('Morangos', `${r.berries}/${r.totalBerries}`) + stat('Mortes', r.deaths) + extra;
    $('complete-unlocks').innerHTML = r.newAbilities.length
        ? `<small>Habilidades desbloqueadas</small><div>${r.newAbilities.map(a => `<span class="unlock-chip cat-${a.category}">${icon(a.icon)} ${a.name}</span>`).join('')}</div>` : '';
    $('complete-unlocks').classList.toggle('hidden', !r.newAbilities.length);
    $('btn-next').textContent = r.lastOfChapter ? 'Próximo capítulo' : 'Próxima fase';
    $('btn-next').classList.toggle('hidden', r.last);
    currentLevel = r.index;
    navStack = [];
    show('complete');
}

function showStoryLine(text, who, duration = Math.max(3.2, text.length * 0.075)) {
    const el = $('story-line');
    $('story-who').textContent = who || '';
    $('story-text').textContent = text;
    el.classList.remove('hidden', 'show');
    void el.offsetWidth;
    el.classList.add('show');
    Sfx.storyTick();
    clearTimeout(showStoryLine.timer);
    showStoryLine.timer = setTimeout(() => el.classList.add('hidden'), duration * 1000);
}

function playScene(id, done, replay = false) {
    game.flushPlaytime();
    game.running = false;
    state = 'cinema';
    sceneRun = { id, done, replay };
    hideAll();
    clearTimeout(showStoryLine.timer);
    ['story-line', 'hud', 'hud-abilities', 'boss-bar', 'banner'].forEach(el => $(el).classList.add('hidden'));
    document.body.classList.remove('slowmo');
    document.body.classList.add('cinematic');
    $('cinema').classList.remove('hidden');
    cinema.play(id);
}

function endScene() {
    const run = sceneRun;
    sceneRun = null;
    cinema.release();
    view.restoreGrade();
    $('cinema').classList.add('hidden');
    document.body.classList.remove('cinematic');
    $('cine-caption').classList.remove('show');
    if (!run.replay) {
        Save.sawScene(run.id);
        if (run.id === 'final') game.unlock('core_reached');
    }
    Sfx.setTheme(null);
    run.done();
}

function show(name, remember = false) {
    if (remember && currentScreen && currentScreen !== name) navStack.push(currentScreen);
    currentScreen = name;
    screens.forEach(s => $(s).classList.toggle('hidden', s !== name));
    document.body.classList.toggle('in-hub', name === 'hub' || name === 'prep');
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
    if (prev === 'saves') renderSaves();
}

function hideAll() {
    currentScreen = null;
    screens.forEach(s => $(s).classList.add('hidden'));
    document.body.classList.remove('in-hub');
    if (document.activeElement) document.activeElement.blur();
}

function enterHub(tab = 'home') {
    const pending = Save.data && pendingScene(Save.data);
    if (pending) {
        playScene(pending, () => enterHub(tab));
        return;
    }
    game.flushPlaytime();
    game.running = false;
    state = 'hub';
    navStack = [];
    document.body.classList.remove('cinematic', 'slowmo');
    $('boss-bar').classList.add('hidden');
    $('banner').classList.add('hidden');
    $('hud').classList.add('hidden');
    $('hud-abilities').classList.add('hidden');
    const d = Save.data;
    Sfx.setTheme(d ? chapterOfLevel(continueLevel(d)) : null);
    hub.open(tab);
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
    if (!resume && d.checkpoint && d.checkpoint.level === index) d.checkpoint = null;
    Save.save();
    game.load(index, resume);
    if (d.loadout.length === LOADOUT_SIZE) game.unlock('first_loadout');
    Sfx.setTheme(LEVELS[index].chapter, MUSIC_WIND[LEVELS[index].chapter]);
    navStack = [];
    hideAll();
    document.body.classList.remove('cinematic', 'slowmo');
    $('boss-bar').classList.add('hidden');
    $('hud').classList.remove('hidden');
    hudCache.abilitySlots = null;
    renderHudMoves();
    state = 'playing';
    showBanner(`Capítulo ${LEVELS[index].chapter} · Fase ${index + 1}`, LEVELS[index].name, CHAPTER_NAMES[LEVELS[index].chapter], 2200);
}

function slotCard(i) {
    const s = Save.slot(i);
    const card = document.createElement('div');
    card.className = 'slot-card' + (s ? '' : ' empty');
    if (s) {
        const index = continueLevel(s);
        const f = levelFacts(index);
        const progress = campaignProgress(s);
        card.dataset.chapter = f.chapter;
        card.innerHTML = `<div class="slot-top"><b>Campanha ${i + 1}</b><span class="tag ${s.mode === 'permadeath' ? 'tag-danger' : ''}">${s.mode === 'permadeath' ? `${icon('skull')} Morte Súbita` : 'Normal'}</span></div>
            <h3>${CHAPTER_NAMES[f.chapter]}</h3>
            <p>Capítulo ${f.chapter} · Fase ${index + 1}: ${f.name}</p>
            <div class="meter"><i style="width:${progress.pct}%"></i></div>
            <div class="slot-facts"><span>${progress.pct}%</span><span>${icon('clock')} ${fmtLong(s.totalTime)}</span><span>${icon('skull')} ${s.deaths}</span><span>${icon('spark')} ${Object.keys(s.abilities).length}</span></div>
            <small>Salvo em ${new Date(s.updatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>`;
    } else {
        card.innerHTML = `<div class="slot-top"><b>Campanha ${i + 1}</b></div><h3>Slot vazio</h3><p>Uma nova jornada pode começar aqui.</p>`;
    }
    const btns = document.createElement('div');
    btns.className = 'slot-actions';
    const add = (label, onClick, cls = '') => {
        const b = document.createElement('button');
        b.textContent = label;
        b.className = 'btn ' + cls;
        b.onclick = () => { Sfx.ensure(); Sfx.uiSelect(); onClick(); };
        btns.appendChild(b);
    };
    if (saveScreenMode === 'newgame') {
        add(s ? 'Substituir' : 'Criar campanha', () => actions.selectSave(i), s ? 'btn-danger' : 'btn-primary');
        if (s) add('Excluir', () => actions.deleteSave(i), 'btn-danger');
    } else if (s) {
        add('Entrar na campanha', () => actions.selectSave(i), 'btn-primary');
    } else {
        add('Criar campanha', () => actions.createInSlot(i));
    }
    card.appendChild(btns);
    return card;
}

function renderSaves() {
    $('saves-title').textContent = saveScreenMode === 'newgame' ? 'Escolha um slot para a nova campanha' : 'Escolha sua campanha';
    const list = $('save-list');
    list.innerHTML = '';
    for (let i = 0; i < 3; i++) list.appendChild(slotCard(i));
}

function renderBindings() {
    $('bind-list').innerHTML = BINDINGS.map(([action, label]) => {
        const waiting = rebinding === action;
        return `<div class="bind-row"><span>${label}</span><button class="btn bind-key ${waiting ? 'waiting' : ''}" data-act="rebind" data-arg="${action}">${waiting ? 'Pressione uma tecla…' : Settings.keys[action].map(keyLabel).join(' · ')}</button></div>`;
    }).join('');
}

function renderOptions() {
    $('vol-master').value = Settings.master;
    $('vol-music').value = Settings.music;
    $('vol-sfx').value = Settings.sfx;
    $('btn-mute').textContent = 'Som: ' + (Settings.muted ? 'desligado' : 'ligado');
    $('btn-shake').textContent = 'Tremor de tela: ' + (Settings.shake ? 'ligado' : 'reduzido');
    $('btn-shadows').textContent = 'Acabamento da imagem: ' + (Settings.shadows ? 'ligado' : 'desligado');
    renderBindings();
}

function mountSettings(host, inCampaign) {
    host.appendChild($('settings-body'));
    $('settings-danger').classList.toggle('hidden', !inCampaign);
    renderOptions();
}

function confirmDialog(text, yes = 'Confirmar', danger = true) {
    $('dialog-text').textContent = text;
    $('dialog-yes').textContent = yes;
    $('dialog-yes').className = danger ? 'btn btn-danger' : 'btn btn-primary';
    $('dialog').classList.remove('hidden');
    $('dialog-no').focus();
    return new Promise(resolve => { dialogResolve = resolve; });
}

function closeDialog(answer) {
    $('dialog').classList.add('hidden');
    if (dialogResolve) dialogResolve(answer);
    dialogResolve = null;
    if (currentScreen !== 'hub' && currentScreen !== 'prep') focusFirst(currentScreen);
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
        mountSettings($('options-host'), false);
        show('options', true);
    },
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
        view.applyQuality();
        Settings.save();
        view.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
        renderOptions();
    },
    fullscreen() {
        const el = document.documentElement;
        if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
        else document.exitFullscreen().catch(() => {});
    },
    rebind(btn) {
        rebinding = btn.dataset.arg;
        renderBindings();
    },
    'reset-keys'() {
        rebinding = null;
        Settings.resetKeys();
        renderBindings();
        toast('sliders', 'Controles restaurados', 'As teclas voltaram ao padrão.');
    },
    menu() {
        game.flushPlaytime();
        Save.clearActive();
        state = 'menu';
        navStack = [];
        Sfx.setTheme(null);
        document.body.classList.remove('cinematic', 'slowmo');
        $('boss-bar').classList.add('hidden');
        $('banner').classList.add('hidden');
        $('hud').classList.add('hidden');
        $('hud-abilities').classList.add('hidden');
        game.running = false;
        show('menu');
    },
    'to-hub'() {
        enterHub();
    },
    async 'exit-save'() {
        const yes = await confirmDialog(`Sair da Campanha ${Save.active + 1}? Seu progresso será salvo e a campanha continuará neste slot.`, 'Sair do Save', false);
        if (!yes) {
            const el = document.querySelector('.rail-exit');
            if (el) el.focus({ preventScroll: true });
            return;
        }
        game.flushPlaytime();
        Save.flush();
        Save.clearActive();
        state = 'menu';
        Sfx.setTheme(null);
        saveScreenMode = 'continue';
        renderSaves();
        navStack = ['menu'];
        show('saves');
    },
    'cine-skip'() {
        cinema.skip();
    },
    resume() {
        hideAll();
        state = 'playing';
    },
    restart() { start(currentLevel); },
    replay() {
        enterHub();
        hub.openPrep(currentLevel);
    },
    next() {
        enterHub();
        hub.openPrep(Math.min(currentLevel + 1, LEVELS.length - 1));
    },
    async reset() {
        if (await confirmDialog('Apagar esta campanha, com todo o progresso e as conquistas? Essa ação não pode ser desfeita.', 'Apagar campanha')) {
            Save.reset();
            saveScreenMode = 'continue';
            state = 'menu';
            Sfx.setTheme(null);
            renderSaves();
            navStack = ['menu'];
            show('saves');
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
        enterHub();
    },
    createInSlot(i) {
        saveScreenMode = 'newgame';
        pendingSlot = i;
        show('mode', true);
    },
    async deleteSave(i) {
        if (await confirmDialog(`Excluir a Campanha ${i + 1}?`, 'Excluir')) {
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
        enterHub();
    },
    async 'mode-permadeath'() {
        if (pendingSlot < 0) return;
        if (!await confirmDialog('MODO MORTE SÚBITA: se você morrer, o save será permanentemente deletado.', 'Aceitar')) return;
        Save.create(pendingSlot, 'permadeath');
        pendingSlot = -1;
        saveScreenMode = 'continue';
        enterHub();
    },
    ...hub.actions
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
    return [...scope.querySelectorAll('button:not([disabled]), input')].filter(el => el.offsetParent !== null && el.tabIndex >= 0);
}

const center = el => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

function moveFocus(dx, dy) {
    const list = focusables();
    if (!list.length) return;
    const current = document.activeElement;
    if (!list.includes(current)) {
        list[0].focus();
        Sfx.uiMove();
        return;
    }
    const from = center(current);
    let best = null;
    let bestScore = Infinity;
    for (const el of list) {
        if (el === current) continue;
        const to = center(el);
        const along = (to.x - from.x) * dx + (to.y - from.y) * dy;
        if (along <= 2) continue;
        const across = Math.abs((to.x - from.x) * dy) + Math.abs((to.y - from.y) * dx);
        const score = along + across * 2.5;
        if (score < bestScore) {
            bestScore = score;
            best = el;
        }
    }
    if (!best) return;
    best.focus();
    Sfx.uiMove();
}

function handleEscape() {
    if (dialogResolve) {
        closeDialog(false);
        return;
    }
    if (currentScreen === 'menu' || currentScreen === 'complete' || currentScreen === 'death') return;
    if (currentScreen === 'pause') {
        actions.resume();
        return;
    }
    if (currentScreen === 'hub') {
        Sfx.uiBack();
        if (hub.tab !== 'home') {
            hub.setTab('home');
            focusFirst('hub');
        } else actions['exit-save']();
        return;
    }
    if (currentScreen === 'prep') {
        Sfx.uiBack();
        actions['prep-back']();
        return;
    }
    back();
}

function menuKeys(e) {
    const step = { ArrowDown: [0, 1], ArrowUp: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.code];
    if (step) {
        if (document.activeElement && document.activeElement.type === 'range' && step[0] !== 0) return;
        moveFocus(step[0], step[1]);
        return;
    }
    if (e.code === 'Escape' || e.code === 'PadDash') {
        handleEscape();
        return;
    }
    if (e.code === 'PadJump' && document.activeElement && document.activeElement.click) document.activeElement.click();
}

addEventListener('keydown', e => {
    if (!rebinding) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    const action = rebinding;
    rebinding = null;
    if (e.code !== 'Escape') {
        const error = Settings.rebind(action, e.code);
        if (error) {
            Sfx.denied();
            toast('lock', 'Tecla não permitida', error);
        } else Sfx.equip();
    }
    renderBindings();
    const btn = document.querySelector(`.bind-key[data-arg=${action}]`);
    if (btn) btn.focus({ preventScroll: true });
}, { capture: true });

addEventListener('keydown', e => {
    if (e.repeat) return;
    if (state === 'cinema') {
        e.preventDefault();
        if (['Escape', 'PadDash', 'KeyP'].includes(e.code)) cinema.skip();
        else if (['Enter', 'Space', 'PadJump'].includes(e.code)) cinema.advance();
        return;
    }
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
    if (state === 'cinema') {
        Input.endFrame();
        cinema.update(dt);
        if (cinema.playing) cinema.render();
        else endScene();
    } else if (state === 'playing') {
        game.update(dt);
    } else {
        Input.endFrame();
        if (state === 'menu') view.idle(dt);
        else if (state !== 'hub') view.updateParticles(dt);
    }
    if (state === 'hub') {
        if (currentScreen === 'hub' && hub.hero) hub.hero.update(dt);
    } else if (state !== 'cinema') {
        view.render();
    }
    requestAnimationFrame(loop);
}

game.load(0);
game.running = false;
view.idle(0.016);
requestAnimationFrame(loop);

globalThis.__summit = { cinema, playScene, game, view, actions, Save, Settings, hub, get state() { return state; }, get screen() { return currentScreen; } };
