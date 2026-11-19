import { View } from './scene.js';
import { Game } from './game.js';
import { Input, Save, SKILLS, Settings, actionCodes, chapterOfLevel, keyLabel } from './core.js';
import { abilityById } from './abilities.js';
import { CHAPTER_NAMES, campaignProgress, continueLevel, continueRoom, levelFacts } from './campaign.js';
import { ROOMS, isMain } from './worldMap.js';
import { createInventory } from './inventory.js';
import { createShop } from './shopUI.js';
import { CURRENCY } from './shop.js';
import { Sfx } from './audio.js';
import { icon } from './icons.js';
import { createHub, fmtLong, fmtTime as fmt } from './hub.js';
import { HeroStage } from './hero.js';
import { SKINS, skinById } from './skins.js';
import * as E from './entities.js';
import { Cinema } from './cinema.js';
import { SCENE_AFTER_LEVEL, pendingScene } from './story.js';
import { MENU_THEMES } from './menuThemes.js';
import { REALMS, REALM_IDS, realmOfChapter } from './realms.js';

const $ = id => document.getElementById(id);
const screens = ['menu', 'pause', 'saves', 'skins', 'regions', 'mode', 'credits', 'death', 'options', 'hub', 'shop'];
const VEIL_MS = 240;
const MUSIC_WIND = { 1: 0.03, 2: 0.09, 3: 0.05, 4: 0.07, 5: 0.06 };
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
        setHtml('hud-shards', `${icon(CURRENCY.icon, 'shard')} ${h.shards}`);
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
    onDoorLocked(text) {
        Sfx.denied();
        toast('lock', 'Passagem fechada', text);
    },
    onRespawnElsewhere(room, resume) {
        travel(room, resume, { respawn: true });
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
        showBanner('Vitória', 'Uma passagem se abriu', 'O caminho adiante está livre.', 2600);
    },
    onStoryLine(text, who, duration) {
        showStoryLine(text, who, duration);
    },
    onHint(template, who) {
        if (Settings.hints !== false) showHint(template, who);
    },
    // Mascate: aviso "↑ Conversar" ao chegar perto e loja ao apertar ↑.
    onMerchantNear(near) {
        $('merchant-prompt').innerHTML = `<kbd>↑</kbd> Conversar com o mascate`;
        $('merchant-prompt').classList.toggle('hidden', !near);
    },
    onMerchant() {
        openShop();
    },
    onShards() {
        const el = $('hud-shards');
        el.classList.remove('gain');
        void el.offsetWidth;
        el.classList.add('gain');
    },
    onRecord(record) {
        toast('scroll', 'Registro encontrado', record.title);
    },
    // O jogador atravessou uma passagem: sem tela de resultado, só o véu e a próxima sala.
    onDoor(r) {
        announceUnlocks(r);
        const d = Save.data;
        const scene = !r.travel && SCENE_AFTER_LEVEL[r.index];
        const scenesDue = !!(d && ((scene && !d.story.scenes[scene]) || (r.firstClear && pendingScene(d))));
        if (!r.target) {
            // Fim do Trono do Alto: a cena final leva aos créditos.
            if (scenesDue) runScenes(scene, () => enterHub());
            else enterHub();
            return;
        }
        travel(r.target.room, null, { door: r.target, scenes: scenesDue ? scene || true : null });
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
    createHero: () => heroStage(),
    replayScene: id => playScene(id, () => enterHub('records'), true),
    equipSkin: equipSkinById,
    travelTo: flag => travelTo(flag)
});

const inventory = createInventory({
    game,
    toast,
    show: name => show(name),
    mountSettings: (host, inCampaign) => mountSettings(host, inCampaign),
    travelTo: flag => travelTo(flag)
});

const shop = createShop({
    game,
    toast,
    show: name => show(name)
});

function openShop() {
    state = 'paused';
    game.flushPlaytime();
    navStack = [];
    $('merchant-prompt').classList.add('hidden');
    shop.open();
    Sfx.uiSelect();
}

function openInventory(tab) {
    state = 'paused';
    game.flushPlaytime();
    navStack = [];
    inventory.open(tab);
    Sfx.uiBack();
}

let heroInstance = null;
let heroTried = false;
let savesFocus = 0;

let skinsSlot = -1;

function heroStage() {
    if (!heroTried) {
        heroTried = true;
        try {
            heroInstance = new HeroStage($('hero'));
        } catch (e) {
            heroInstance = null;
        }
        // Nos saves e no início do hub, duplo clique (ou Enter/Espaço) no protagonista abre as skins.
        if (heroInstance) {
            $('hero').addEventListener('dblclick', openSkinsFromShowcase);
            $('hero').addEventListener('keydown', e => {
                if (e.code !== 'Enter' && e.code !== 'Space') return;
                e.preventDefault();
                e.stopPropagation();
                openSkinsFromShowcase();
            });
        }
    }
    return heroInstance;
}

function openSkinsFromShowcase() {
    let slot;
    if (currentScreen === 'saves') slot = savesFocus;
    else if (currentScreen === 'hub' && hub.tab === 'home') slot = Save.active;
    else return;
    if (!Save.slot(slot)) {
        Sfx.denied();
        toast('lock', 'Slot vazio', 'Crie uma campanha para escolher skins.');
        return;
    }
    skinsSlot = slot;
    renderSkins();
    show('skins', true);
}

function swatch(skin) {
    return `background: linear-gradient(135deg, ${skin.swatch[0]} 0 55%, ${skin.swatch[1]} 55% 100%)`;
}

function renderShowcase() {
    const s = Save.slot(savesFocus);
    const owned = s ? s.skins.unlocked : ['original'];
    const equipped = s ? s.skins.equipped : 'original';
    const skin = skinById(equipped);
    const hero = heroStage();
    const stage = $('showcase-stage');
    if (hero) {
        stage.prepend($('hero'));
        $('hero').classList.remove('hidden');
        $('hero').setAttribute('aria-label', `Protagonista com a skin ${skin.name}. Arraste ou use as setas para girar.`);
        hero.setSkin(equipped);
        hero.frame(true);
        hero.setChapter(s ? levelFacts(continueLevel(s)).chapter : 1);
    }
    stage.classList.toggle('no-hero', !hero);
    $('showcase-slot').textContent = s ? `Campanha ${savesFocus + 1} · ${owned.length}/${SKINS.length} skins` : `Campanha ${savesFocus + 1} · slot vazio`;
    $('showcase-name').textContent = skin.name;
    $('showcase-note').textContent = skin.note;
}

// Equipa uma skin de um save (padrão: o ativo): só desbloqueadas; aplica no protagonista da fase, se houver.
function equipSkinById(id, slot = Save.active) {
    const skin = skinById(id);
    const s = Save.slot(slot);
    if (!skin || !s) return false;
    if (!s.skins.unlocked.includes(skin.id)) {
        Sfx.denied();
        toast('lock', `${skin.name} está bloqueada`, `Conclua o Capítulo ${skin.chapter} inteiro sem morrer.`);
        return false;
    }
    if (!Save.equipSkin(slot, skin.id)) return false;
    if (game.playerMesh && slot === Save.active) E.setPlayerSkin(game.playerMesh, skin.id);
    Sfx.equip();
    return true;
}

// Tela de skins (pausa ou showcase dos saves): visualização de todas as skins e troca só entre as desbloqueadas.
function renderSkins() {
    const s = Save.slot(skinsSlot);
    if (!s) return;
    const owned = s.skins.unlocked;
    const equipped = s.skins.equipped;
    const hero = heroStage();
    if (hero) {
        $('skins-stage').prepend($('hero'));
        $('hero').classList.remove('hidden');
        $('hero').setAttribute('aria-label', 'Protagonista. Arraste ou use as setas para girar.');
        hero.frame(true);
        hero.setChapter(levelFacts(continueLevel(s)).chapter);
    }
    $('skins-grid').innerHTML = SKINS.map(k => {
        const have = owned.includes(k.id);
        const on = k.id === equipped;
        const req = k.chapter ? `Conclua o Capítulo ${k.chapter} inteiro sem morrer.` : 'Inicial';
        return `<button class="skin-chip${have ? '' : ' locked'}${on ? ' equipped' : ''}" data-act="equip-skin" data-arg="${k.id}" aria-disabled="${have ? 'false' : 'true'}" aria-pressed="${on}" title="${have ? k.name : 'Bloqueada: ' + req}">
            <i class="skin-swatch" style="${swatch(k)}">${have ? '' : icon('lock')}</i><span><b>${k.name}</b><small>${on ? 'Equipada' : have ? 'Liberada' : 'Bloqueada'}</small></span></button>`;
    }).join('');
    const show = id => {
        const k = skinById(id);
        const have = owned.includes(id);
        if (have && hero) hero.setSkin(id);
        $('skins-name').textContent = k.name;
        $('skins-note').textContent = have ? k.note : `Bloqueada. Conclua o Capítulo ${k.chapter} inteiro sem morrer.`;
    };
    const restore = () => show(equipped);
    $('skins-grid').querySelectorAll('.skin-chip').forEach(chip => {
        const id = chip.dataset.arg;
        chip.addEventListener('pointerenter', () => show(id));
        chip.addEventListener('focus', () => show(id));
        chip.addEventListener('pointerleave', restore);
        chip.addEventListener('blur', restore);
    });
    show(equipped);
    $('skins-slot').textContent = `${owned.length}/${SKINS.length} skins desbloqueadas`;
}

function focusSave(i) {
    if (savesFocus === i) return;
    savesFocus = i;
    document.querySelectorAll('#save-list .slot-card').forEach((c, n) => c.classList.toggle('selected', n === i));
    renderShowcase();
}

function focusFirst(name) {
    const el = $(name);
    const target = el && el.querySelector('button:not(.hidden):not([disabled])');
    if (target) target.focus({ preventScroll: true });
}

// Conquistas da saída de uma fase, mostradas como avisos (não há mais tela de resultado).
function announceUnlocks(r) {
    if (!r || r.travel) return;
    if (r.skin) toast('star', 'Skin desbloqueada', `${r.skin.name} · capítulo sem mortes`);
    if (r.realmChanged) toast('crown', `Novo reino: ${REALMS[r.realm].name}`, 'A central deste save agora fica lá.');
    if (r.firstClear && r.lastOfChapter) toast('flag', `Capítulo ${r.chapter} concluído`, CHAPTER_NAMES[r.chapter]);
}

// Cenas devidas, em sequência (o final da montanha emenda na passagem para o Inferno).
function runScenes(first, done) {
    const chain = () => {
        const next = Save.data && pendingScene(Save.data);
        if (next) playScene(next, chain);
        else done();
    };
    const d = Save.data;
    if (typeof first === 'string' && d && !d.story.scenes[first]) playScene(first, chain);
    else chain();
}

// Troca de sala com véu escuro. door: chegada por uma passagem; resume: ponto exato (checkpoint).
function travel(room, resume, { door = null, scenes = null, respawn = false } = {}) {
    game.running = false;
    state = 'transit';
    hideAll();
    const veil = $('room-veil');
    veil.classList.add('on');
    setTimeout(() => {
        const go = () => {
            veil.classList.add('on');
            enterRoom(room, resume, door);
            requestAnimationFrame(() => veil.classList.remove('on'));
        };
        if (scenes) {
            veil.classList.remove('on');
            runScenes(scenes, go);
        } else go();
    }, respawn ? 60 : VEIL_MS);
}

// Entra numa sala e deixa a interface pronta para jogar.
function enterRoom(index, resume = null, door = null) {
    const d = Save.data;
    const room = ROOMS[index];
    const prevChapter = state === 'transit' && game.level ? game.level.chapter : null;
    currentLevel = index;
    if (isMain(index)) {
        d.currentLevel = index;
        d.chapter = chapterOfLevel(index);
    }
    Save.startChapterRun(index, door && door.door === 'in' && !d.best[index] ? null : (resume || door || {}));
    Save.save();
    if (door) game.arrive(door);
    else game.load(index, resume);
    if (prevChapter !== room.chapter) Sfx.setTheme(room.chapter, MUSIC_WIND[room.chapter]);
    navStack = [];
    hideAll();
    document.body.classList.remove('cinematic', 'slowmo');
    $('boss-bar').classList.add('hidden');
    $('hud').classList.remove('hidden');
    hudCache.abilitySlots = null;
    renderHudMoves();
    state = 'playing';
    if (game.firstVisit) {
        const realm = REALMS[realmOfChapter(room.chapter)].name;
        showBanner(`${realm} · ${CHAPTER_NAMES[room.chapter]}`, room.name, room.main === false ? 'Área secreta do mundo' : '', 2600);
    }
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

// Dica de controle do tutorial. "{acao}" vira a tecla configurada pelo jogador, montada como texto (sem HTML).
function showHint(template, who) {
    const el = $('tutorial-hint');
    const text = $('hint-text');
    $('hint-who').textContent = who || '';
    text.textContent = '';
    template.split(/(\{\w+\})/).forEach(part => {
        const action = /^\{(\w+)\}$/.exec(part);
        if (!action) {
            text.append(part);
            return;
        }
        const kbd = document.createElement('kbd');
        const codes = Settings.keys[action[1]];
        kbd.textContent = codes && codes.length ? keyLabel(codes[0]) : action[1];
        text.append(kbd);
    });
    el.classList.remove('hidden', 'show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(showHint.timer);
    showHint.timer = setTimeout(() => el.classList.add('hidden'), Math.max(4.5, template.length * 0.07) * 1000);
}

function playScene(id, done, replay = false) {
    game.flushPlaytime();
    game.running = false;
    state = 'cinema';
    sceneRun = { id, done, replay };
    hideAll();
    clearTimeout(showStoryLine.timer);
    ['story-line', 'tutorial-hint', 'hud', 'hud-abilities', 'boss-bar', 'banner'].forEach(el => $(el).classList.add('hidden'));
    document.body.classList.remove('slowmo');
    document.body.classList.add('cinematic');
    $('cinema').classList.remove('hidden');
    cinema.skin = Save.data ? Save.data.skins.equipped : 'original';
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
        // A cena final só conta como vista depois dos créditos: fechar o jogo no meio não perde o zerar.
        if (run.id === 'ending') {
            rollCredits();
            return;
        }
        Save.sawScene(run.id);
        if (run.id === 'final') game.unlock('core_reached');
    }
    Sfx.setTheme(null);
    run.done();
}

function rollCredits() {
    state = 'ending';
    navStack = [];
    hideAll();
    ['hud', 'hud-abilities', 'boss-bar', 'banner', 'tutorial-hint'].forEach(id => $(id).classList.add('hidden'));
    document.body.classList.remove('slowmo');
    Sfx.setTheme('cine_final');
    const roll = $('ending-roll');
    roll.onanimationend = finishCredits;
    $('ending').classList.remove('hidden');
}

function finishCredits() {
    if (state !== 'ending') return;
    $('ending-roll').onanimationend = null;
    $('ending').classList.add('hidden');
    Save.sawScene('ending');
    const first = Save.finishGame();
    game.unlock('game_cleared');
    actions.menu();
    if (first) toast('crown', 'Regiões liberadas', 'Escolha onde quer estar no menu principal.');
}

// Veste o menu principal com a identidade da região e monta o cenário dela ao fundo.
function applyMenuRealm(id) {
    const theme = MENU_THEMES[id];
    $('menu').dataset.realm = id;
    $('menu-logo').innerHTML = theme.logo;
    $('menu-title').textContent = theme.title;
    $('menu-tagline').textContent = theme.tagline;
    $('btn-regions').classList.toggle('hidden', !Save.anyCleared());
    game.load(theme.level);
    game.running = false;
    view.idle(0.016);
    Sfx.setTheme(theme.music, theme.wind);
}

function renderRegions() {
    const current = Save.menuRealm;
    $('region-list').innerHTML = REALM_IDS.map(id => {
        const t = MENU_THEMES[id];
        return `<button class="region-card region-${id}${id === current ? ' current' : ''}" data-act="region-pick" data-arg="${id}" aria-pressed="${id === current}"><em>${id === current ? 'Você está aqui' : t.title}</em><b>${t.place}</b><small>${t.blurb}</small></button>`;
    }).join('');
}

// Véu na cor da região: troca o menu no auge da cobertura e depois revela.
function passToRealm(id) {
    const veil = $('realm-veil');
    veil.style.setProperty('--veil', MENU_THEMES[id].veil);
    veil.classList.add('on');
    setTimeout(() => {
        applyMenuRealm(id);
        navStack = [];
        show('menu');
        veil.classList.remove('on');
    }, 480);
}

function show(name, remember = false) {
    if (remember && currentScreen && currentScreen !== name) navStack.push(currentScreen);
    currentScreen = name;
    screens.forEach(s => $(s).classList.toggle('hidden', s !== name));
    document.body.classList.toggle('in-hub', name === 'hub');
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
    if (prev === 'hub') hub.setTab(hub.tab);
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
    if (d) Save.setMenuRealm(d.realm);
    Sfx.setTheme(d ? (d.cleared ? MENU_THEMES[d.realm].music : chapterOfLevel(continueLevel(d))) : null);
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
    state = 'starting';
    enterRoom(index, resume);
    if (!game.firstVisit) {
        const room = ROOMS[index];
        showBanner(resume ? 'Último checkpoint' : `Capítulo ${room.chapter} · ${CHAPTER_NAMES[room.chapter]}`, room.name, '', 2000);
    }
}

// Viagem rápida (central ou inventário): o checkpoint escolhido vira o save e o jogo começa nele.
function travelTo(flag) {
    const d = Save.data;
    if (!d) return;
    d.checkpoint = { level: flag.level, x: flag.x, y: flag.y, time: 0 };
    Save.save();
    if (state === 'paused') {
        inventory.close();
        travel(flag.level, d.checkpoint);
    } else start(flag.level, d.checkpoint);
}

// Volta ao último checkpoint salvo (tecla R ou botão do inventário).
function toCheckpoint() {
    const d = Save.data;
    if (!d) return;
    const point = continueRoom(d);
    inventory.close();
    travel(point.room, point.resume, { respawn: true });
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
    if (!Save.slot(savesFocus)) {
        const first = [0, 1, 2].find(i => Save.slot(i));
        savesFocus = Save.active >= 0 && Save.slot(Save.active) ? Save.active : first ?? 0;
    }
    for (let i = 0; i < 3; i++) {
        const card = slotCard(i);
        card.classList.toggle('selected', i === savesFocus);
        card.addEventListener('pointerenter', () => focusSave(i));
        card.addEventListener('focusin', () => focusSave(i));
        card.addEventListener('click', () => focusSave(i));
        list.appendChild(card);
    }
    renderShowcase();
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
    $('btn-hints').textContent = 'Dicas de controle de Oren: ' + (Settings.hints !== false ? 'ligadas' : 'desligadas');
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
    if (currentScreen !== 'hub') focusFirst(currentScreen);
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
        document.body.classList.remove('cinematic', 'slowmo');
        $('boss-bar').classList.add('hidden');
        $('banner').classList.add('hidden');
        $('hud').classList.add('hidden');
        $('hud-abilities').classList.add('hidden');
        applyMenuRealm(Save.menuRealm);
        show('menu');
    },
    regions() {
        if (!Save.anyCleared()) return;
        renderRegions();
        show('regions', true);
    },
    'region-pick'(btn) {
        const id = btn.dataset.arg;
        if (!Save.anyCleared() || !Save.setMenuRealm(id)) return;
        Sfx.equip();
        passToRealm(id);
    },
    'ending-skip'() {
        finishCredits();
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
        inventory.close();
        hideAll();
        state = 'playing';
        if (game.merchant && game.merchant.near) $('merchant-prompt').classList.remove('hidden');
    },
    'to-checkpoint'() {
        toCheckpoint();
    },
    'toggle-hints'() {
        Settings.hints = Settings.hints === false;
        Settings.save();
        renderOptions();
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
        if (Save.data.cleared) Save.chooseRealm(Save.menuRealm);
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
    ...hub.actions,
    ...inventory.actions,
    ...shop.actions,
    skins() {
        skinsSlot = Save.active;
        renderSkins();
        show('skins', true);
    },
    'equip-skin'(btn) {
        if (equipSkinById(btn.dataset.arg, skinsSlot)) renderSkins();
    }
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
    if (currentScreen === 'menu' || currentScreen === 'death') return;
    if (currentScreen === 'pause' || currentScreen === 'shop') {
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
    if (state === 'ending') {
        e.preventDefault();
        if (['Escape', 'Enter', 'Space', 'PadJump', 'PadDash'].includes(e.code)) finishCredits();
        return;
    }
    if (state === 'cinema') {
        e.preventDefault();
        if (['Escape', 'PadDash', 'KeyP'].includes(e.code)) cinema.skip();
        else if (['Enter', 'Space', 'PadJump'].includes(e.code)) cinema.advance();
        return;
    }
    if (state === 'transit' || state === 'starting') {
        e.preventDefault();
        return;
    }
    if (state === 'playing') {
        const p = game.player;
        const blocked = game.permadeathPending || game.finished;
        if (blocked) return;
        if (e.code === 'Escape' || e.code === 'KeyP') {
            openInventory();
        } else if (e.code === 'Tab' || e.code === 'KeyI') {
            e.preventDefault();
            openInventory('abilities');
        } else if (e.code === 'KeyM') {
            openInventory('map');
        } else if (e.code === 'KeyR' && !p.dead) {
            toCheckpoint();
        }
        return;
    }
    if (state === 'paused' && currentScreen === 'pause' && !dialogResolve) {
        if (e.code === 'KeyP' || e.code === 'KeyI') {
            actions.resume();
            return;
        }
        if (e.code === 'KeyM') {
            inventory.open('map');
            return;
        }
        const prev = e.code === 'PadSkill1' || actionCodes('skill1').includes(e.code) || (e.code === 'Tab' && e.shiftKey);
        const fwd = e.code === 'PadSkill2' || actionCodes('skill2').includes(e.code) || e.code === 'Tab';
        if (prev || fwd) {
            e.preventDefault();
            inventory.cycle(prev ? -1 : 1);
            return;
        }
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
    if (document.hidden && state === 'playing' && !game.permadeathPending && !game.finished) openInventory();
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
    } else if (state === 'transit') {
        Input.endFrame();
        view.updateParticles(dt);
    } else {
        Input.endFrame();
        if (state === 'menu') view.idle(dt);
        else if (state !== 'hub') view.updateParticles(dt);
    }
    if (state === 'hub') {
        if (currentScreen === 'hub' && hub.hero) hub.hero.update(dt);
        else if (currentScreen === 'skins' && heroInstance) heroInstance.update(dt);
    } else if (state !== 'cinema') {
        if ((currentScreen === 'saves' || currentScreen === 'skins') && heroInstance) heroInstance.update(dt);
        view.render();
    }
    requestAnimationFrame(loop);
}

applyMenuRealm(Save.menuRealm);
requestAnimationFrame(loop);

globalThis.__summit = { cinema, playScene, game, view, actions, Save, Settings, hub, get state() { return state; }, get screen() { return currentScreen; } };
