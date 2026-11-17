import { ABILITIES, LOADOUT_SIZE, abilityById, meetsReq } from './abilities.js';
import { TOTAL_RECORDS, recordsFound, sanitizeStory } from './story.js';
import { DEFAULT_SKIN, SKINS, skinById, skinForChapter } from './skins.js';
import { LEVELS } from './levels.js';
import { CHAPTERS, CHAPTER_STARTS, REALM_IDS, chapterOfLevel, realmForProgress } from './realms.js';
import { ACHIEVEMENTS, achievementById, sanitizeAchievements } from './achievements.js';
import { TOTAL_SECRETS } from './campaign.js';
import { isRoom } from './worldMap.js';

export { ACHIEVEMENTS, chapterOfLevel };

const PAD_MAP = [
    [0, 'PadJump'], [1, 'PadDash'], [2, 'PadDash'], [3, 'PadSkill3'], [4, 'PadSkill1'], [5, 'PadSkill2'],
    [6, 'PadGrab'], [7, 'PadGrab'], [9, 'KeyP'], [8, 'KeyR'],
    [12, 'ArrowUp'], [13, 'ArrowDown'], [14, 'ArrowLeft'], [15, 'ArrowRight']
];
const STICK_DEADZONE = 0.45;

export const Input = {
    keys: {},
    pressed: {},
    padKeys: {},
    init() {
        addEventListener('keydown', e => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
            if (!this.keys[e.code]) this.pressed[e.code] = true;
            this.keys[e.code] = true;
        });
        addEventListener('keyup', e => {
            this.keys[e.code] = false;
        });
        addEventListener('blur', () => {
            this.keys = {};
            this.pressed = {};
        });
    },
    pollGamepad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const pad = Array.from(pads).find(Boolean);
        if (!pad) return;
        const next = {};
        PAD_MAP.forEach(([index, code]) => {
            if (pad.buttons[index] && pad.buttons[index].pressed) next[code] = true;
        });
        if (pad.axes[0] < -STICK_DEADZONE) next.ArrowLeft = true;
        if (pad.axes[0] > STICK_DEADZONE) next.ArrowRight = true;
        if (pad.axes[1] < -STICK_DEADZONE) next.ArrowUp = true;
        if (pad.axes[1] > STICK_DEADZONE) next.ArrowDown = true;
        for (const code of new Set([...Object.keys(next), ...Object.keys(this.padKeys)])) {
            if (!!next[code] === !!this.padKeys[code]) continue;
            dispatchEvent(new KeyboardEvent(next[code] ? 'keydown' : 'keyup', { code, key: code }));
        }
        this.padKeys = next;
    },
    down(...codes) {
        return codes.some(c => this.keys[c]);
    },
    hit(...codes) {
        return codes.some(c => this.pressed[c]);
    },
    endFrame() {
        this.pressed = {};
    },
    get x() {
        return (this.down('ArrowRight', 'KeyD') ? 1 : 0) - (this.down('ArrowLeft', 'KeyA') ? 1 : 0);
    },
    get y() {
        return (this.down('ArrowUp', 'KeyW') ? 1 : 0) - (this.down('ArrowDown', 'KeyS') ? 1 : 0);
    }
};

// Números derivados do save usados pelas barras de progresso das conquistas.
function progressStats(d) {
    return {
        berries: d.berries || 0,
        stomps: d.stomps || 0,
        crystals: d.crystals || 0,
        parries: d.parries || 0,
        dodges: d.dodges || 0,
        maxedAbilities: ABILITIES.filter(a => (d.abilities || {})[a.id] >= a.levels.length).length,
        unlockedPowers: (d.skills || []).length + Object.keys(d.abilities || {}).length,
        totalPowers: SKILLS.length + ABILITIES.length,
        secretCount: Object.keys(d.secrets || {}).length,
        totalSecrets: TOTAL_SECRETS,
        recordCount: d.story ? recordsFound(d) : 0,
        totalRecords: TOTAL_RECORDS
    };
}

export function achievementProgress(id, d) {
    const a = achievementById(id);
    if (!a || !a.goal) return null;
    const [cur, goal] = a.goal(progressStats(d));
    return [Math.min(cur, goal), goal];
}

export function maxedAbilityCount(d) {
    return progressStats(d).maxedAbilities;
}

export const SKILLS = [
    { id: 'dash', icon: 'bolt', name: 'Dash', desc: 'Investida em 8 direções. Derrota inimigos e quebra paredes rachadas.', unlock: 'Início da jornada' },
    { id: 'wall_climb', icon: 'boot', name: 'Escalada', desc: 'Agarrar e escalar paredes.', unlock: 'Início da jornada' },
    { id: 'double_jump', icon: 'spring', name: 'Pulo Duplo', desc: 'Segundo pulo no ar.', unlock: 'Após a fase 3' },
    { id: 'air_dash', icon: 'crystal', name: 'Dash Aéreo', desc: 'Dois dashes antes de tocar o chão.', unlock: 'Após a fase 6' },
    { id: 'ground_pound', icon: 'peak', name: 'Pancada no Chão', desc: '↓ + Pular no ar: ataque em área que quebra pisos rachados.', unlock: 'Após a fase 10' }
];

// v7: mundo aberto. Salas visitadas, checkpoints de viagem, coletas e paredes quebradas por sala.
const SAVE_VERSION = 7;
// Última fase que existia antes do Céu: quem já a venceu precisa ter a fase seguinte aberta.
const LAST_LEVEL_V5 = 14;
const SLOT_COUNT = 3;
const LEVEL_COUNT = LEVELS.length;
const CHAPTER_COUNT = Math.max(...CHAPTERS);
const FIRST_REDESIGNED_LEVEL = 5;
const slotKey = i => 'summit_slot_' + i;
const backupKey = i => slotKey(i) + '_bak';
const ACTIVE_KEY = 'summit_active_slot';
const MENU_REALM_KEY = 'summit_menu_realm';

// O reino exibido pela central nunca regride: vale o mais avançado entre o salvo e o do progresso.
// A exceção é o save zerado, em que o jogador escolhe livremente a região.
function sanitizeRealm(raw, unlocked, cleared = false) {
    if (cleared && REALM_IDS.includes(raw)) return raw;
    const reached = realmForProgress(unlocked);
    const stored = REALM_IDS.includes(raw) ? raw : reached;
    return REALM_IDS.indexOf(stored) > REALM_IDS.indexOf(reached) ? stored : reached;
}

const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

function skillsForProgress(unlocked) {
    const skills = ['dash', 'wall_climb'];
    if (unlocked >= 4) skills.push('double_jump');
    if (unlocked >= 7) skills.push('air_dash');
    if (unlocked >= 11) skills.push('ground_pound');
    return skills;
}

function sanitizeAbilities(d, raw) {
    const stored = obj(raw.abilities);
    const levels = {};
    for (const a of ABILITIES) {
        const n = Math.floor(num(stored[a.id]));
        if (n >= 1) levels[a.id] = Math.min(n, a.levels.length);
        else if (meetsReq(a.unlock, d)) levels[a.id] = 1;
    }
    d.abilities = levels;
    const list = Array.isArray(raw.loadout) ? raw.loadout : [];
    d.loadout = [...new Set(list)].filter(id => levels[id]).slice(0, LOADOUT_SIZE);
}

export function sanitizeSave(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const now = Date.now();
    const version = raw.version || 1;
    const beatLastV5 = version < 6 && !!obj(raw.best)[LAST_LEVEL_V5];
    const unlocked = Math.min(LEVEL_COUNT, Math.max(beatLastV5 ? LAST_LEVEL_V5 + 2 : 1, Math.floor(num(raw.unlocked, 1))));
    const cleared = raw.cleared === true;
    const currentLevel = Math.min(unlocked - 1, Math.floor(num(raw.currentLevel, 0)));
    const skills = new Set(skillsForProgress(unlocked));
    const best = obj(raw.best);
    if (version < 2) {
        Object.keys(best).forEach(k => { if (+k >= FIRST_REDESIGNED_LEVEL) delete best[k]; });
    }
    const cp = raw.checkpoint;
    const validCheckpoint = cp && Number.isInteger(cp.level) && Number.isFinite(cp.x) && Number.isFinite(cp.y);
    const data = {
        version: SAVE_VERSION,
        mode: raw.mode === 'permadeath' ? 'permadeath' : 'normal',
        createdAt: num(raw.createdAt, now),
        updatedAt: num(raw.updatedAt, now),
        chapter: chapterOfLevel(currentLevel),
        unlocked,
        currentLevel,
        deaths: num(raw.deaths),
        chapterDeaths: Array.from({ length: CHAPTER_COUNT }, (_, i) => num(Array.isArray(raw.chapterDeaths) ? raw.chapterDeaths[i] : 0)),
        berries: num(raw.berries),
        stomps: num(raw.stomps),
        crystals: num(raw.crystals),
        best,
        achievements: sanitizeAchievements(raw.achievements),
        skills: [...skills],
        totalTime: num(raw.totalTime),
        completedChapters: Array.isArray(raw.completedChapters) ? [...new Set(raw.completedChapters.filter(n => CHAPTERS.includes(n)))] : [],
        secrets: obj(raw.secrets),
        checkpoint: validCheckpoint && isRoom(cp.level) ? { level: cp.level, x: cp.x, y: cp.y, time: num(cp.time) } : null,
        abilityUses: num(raw.abilityUses),
        parries: num(raw.parries),
        dodges: num(raw.dodges),
        realm: sanitizeRealm(raw.realm, unlocked, cleared),
        cleared
    };
    sanitizeAbilities(data, raw);
    data.world = sanitizeWorld(raw.world, data);
    data.skins = sanitizeSkins(raw.skins, data);
    data.story = sanitizeStory(raw.story, data, version);
    return data;
}

// Chaves de coleta e de paredes: "sala:x,y". Salas abaixo do progresso contam como visitadas.
const ROOM_KEY = /^\d+:-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
const roomKeyOk = k => ROOM_KEY.test(k) && isRoom(+k.split(':')[0]);

function trueKeys(raw, valid) {
    const out = {};
    for (const [k, v] of Object.entries(obj(raw))) if (v === true && valid(k)) out[k] = true;
    return out;
}

function sanitizeWorld(raw, d) {
    const w = obj(raw);
    const visited = trueKeys(w.visited, k => isRoom(+k));
    for (let i = 0; i < d.unlocked; i++) visited[i] = true;
    if (d.checkpoint) visited[d.checkpoint.level] = true;
    const flags = {};
    for (const [k, f] of Object.entries(obj(w.flags))) {
        if (f && isRoom(f.level) && Number.isFinite(f.x) && Number.isFinite(f.y)) flags[k] = { level: f.level, x: f.x, y: f.y };
    }
    return {
        visited,
        flags,
        collected: trueKeys(w.collected, roomKeyOk),
        broken: trueKeys(w.broken, roomKeyOk),
        opened: trueKeys(w.opened, k => /^[a-z_]+$/.test(k))
    };
}

export const roomKey = (room, x, y) => `${room}:${x},${y}`;

function sanitizeSkins(raw, d) {
    const s = obj(raw);
    const owned = new Set([DEFAULT_SKIN]);
    (Array.isArray(s.unlocked) ? s.unlocked : []).forEach(id => { if (skinById(id)) owned.add(id); });
    SKINS.forEach(k => {
        if (k.chapter && d.completedChapters.includes(k.chapter) && d.chapterDeaths[k.chapter - 1] === 0) owned.add(k.id);
    });
    const unlocked = SKINS.filter(k => owned.has(k.id)).map(k => k.id);
    const r = s.run;
    const run = r && CHAPTERS.includes(r.chapter) && Number.isInteger(r.next) ? { chapter: r.chapter, next: r.next, clean: r.clean === true } : null;
    return { unlocked, equipped: unlocked.includes(s.equipped) ? s.equipped : DEFAULT_SKIN, run };
}

function readSlot(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? sanitizeSave(JSON.parse(raw)) : null;
    } catch (e) {
        return null;
    }
}

export const Save = {
    slots: [null, null, null],
    active: -1,
    load() {
        this.active = -1;
        for (let i = 0; i < SLOT_COUNT; i++) {
            this.slots[i] = readSlot(slotKey(i)) || readSlot(backupKey(i));
        }
        let a = null;
        try { a = localStorage.getItem(ACTIVE_KEY); } catch (e) {}
        if (a !== null) {
            const n = parseInt(a, 10);
            if (n >= 0 && n < SLOT_COUNT && this.slots[n]) this.active = n;
        }
    },
    slot(i) { return this.slots[i]; },
    hasActive() { return this.active >= 0 && !!this.slots[this.active]; },
    get data() {
        if (this.active < 0) return null;
        return this.slots[this.active] || null;
    },
    create(i, mode) {
        this.slots[i] = sanitizeSave({ mode: mode || 'normal', version: SAVE_VERSION, loadout: ['shockwave'] });
        try { localStorage.removeItem(backupKey(i)); } catch (e) {}
        this.setActive(i);
        this.write(i);
    },
    discoverRecord(id) {
        const d = this.data;
        if (!d || d.story.records[id]) return false;
        d.story.records[id] = true;
        this.save();
        return true;
    },
    sawMoment(id) {
        const d = this.data;
        if (!d || d.story.moments[id]) return false;
        d.story.moments[id] = true;
        this.save();
        return true;
    },
    sawScene(id) {
        const d = this.data;
        if (!d || d.story.scenes[id]) return false;
        d.story.scenes[id] = true;
        this.save();
        return true;
    },
    setActive(i) {
        this.active = i;
        try {
            if (i >= 0) localStorage.setItem(ACTIVE_KEY, String(i));
        } catch (e) {}
    },
    clearActive() {
        this.active = -1;
        try { localStorage.removeItem(ACTIVE_KEY); } catch (e) {}
    },
    deleteSlot(i) {
        try {
            localStorage.removeItem(slotKey(i));
            localStorage.removeItem(backupKey(i));
            if (this.active === i) localStorage.removeItem(ACTIVE_KEY);
        } catch (e) {}
        this.slots[i] = null;
        if (this.active === i) this.active = -1;
    },
    write(i) {
        const d = this.slots[i];
        if (!d) return;
        d.updatedAt = Date.now();
        try {
            const previous = localStorage.getItem(slotKey(i));
            if (previous) localStorage.setItem(backupKey(i), previous);
            localStorage.setItem(slotKey(i), JSON.stringify(d));
            this.writeFailed = false;
        } catch (e) {
            this.writeFailed = true;
            if (this.onWriteError) this.onWriteError();
        }
    },
    flush() {
        if (!this.hasActive()) return;
        const { updatedAt: a, ...current } = this.data;
        let stored = null;
        try { stored = JSON.parse(localStorage.getItem(slotKey(this.active))); } catch (e) {}
        if (stored) {
            const { updatedAt: b, ...saved } = stored;
            if (JSON.stringify(saved) === JSON.stringify(current)) return;
        }
        this.save();
    },
    save() {
        if (this.hasActive()) this.write(this.active);
    },
    reset() {
        if (this.active >= 0) this.deleteSlot(this.active);
    },
    startChapterRun(index, resume) {
        const d = this.data;
        if (!d) return;
        const run = d.skins.run;
        if (!resume && CHAPTER_STARTS.includes(index)) d.skins.run = { chapter: chapterOfLevel(index), next: index, clean: true };
        else if (run && run.next !== index) d.skins.run = null;
        this.save();
    },
    // Atualiza o reino da central conforme o progresso. Retorna true quando o reino muda.
    syncRealm() {
        const d = this.data;
        if (!d) return false;
        const realm = sanitizeRealm(d.realm, d.unlocked, d.cleared);
        if (realm === d.realm) return false;
        d.realm = realm;
        this.setMenuRealm(realm);
        return true;
    },
    // Marca o save como zerado. Só os créditos finais chamam isto.
    finishGame() {
        const d = this.data;
        if (!d) return false;
        const first = !d.cleared;
        d.cleared = true;
        this.save();
        return first;
    },
    anyCleared() {
        return this.slots.some(s => s && s.cleared);
    },
    // Escolha de região de um save zerado; os demais seguem o progresso.
    chooseRealm(id) {
        const d = this.data;
        if (!d || !d.cleared || !REALM_IDS.includes(id)) return false;
        d.realm = id;
        this.save();
        return true;
    },
    // O menu aparece antes de escolher o save, então a região dele fica fora dos slots.
    realmReached(id) {
        if (id === REALM_IDS[0]) return true;
        if (!REALM_IDS.includes(id)) return false;
        return this.slots.some(s => s && (s.cleared || REALM_IDS.indexOf(s.realm) >= REALM_IDS.indexOf(id)));
    },
    get menuRealm() {
        let stored = null;
        try { stored = localStorage.getItem(MENU_REALM_KEY); } catch (e) {}
        return this.realmReached(stored) ? stored : REALM_IDS[0];
    },
    setMenuRealm(id) {
        if (!this.realmReached(id)) return false;
        try { localStorage.setItem(MENU_REALM_KEY, id); } catch (e) {}
        return true;
    },
    chapterDeath(chapter) {
        const run = this.data && this.data.skins.run;
        if (run && run.chapter === chapter) run.clean = false;
    },
    finishRunLevel(index, lastOfChapter) {
        const d = this.data;
        if (!d) return null;
        const run = d.skins.run;
        if (!run || run.next !== index) {
            d.skins.run = null;
            return null;
        }
        if (!lastOfChapter) {
            run.next = index + 1;
            return null;
        }
        d.skins.run = null;
        const skin = run.clean ? skinForChapter(run.chapter) : null;
        if (!skin || d.skins.unlocked.includes(skin.id)) return null;
        d.skins.unlocked.push(skin.id);
        return skin;
    },
    equipSkin(slot, id) {
        const d = this.slots[slot];
        if (!d || !d.skins.unlocked.includes(id)) return false;
        d.skins.equipped = id;
        this.write(slot);
        return true;
    },
    hasSkill(id) {
        const d = this.data;
        return !!(d && d.skills.includes(id));
    },
    unlockSkill(id) {
        const d = this.data;
        if (!d || d.skills.includes(id)) return false;
        d.skills.push(id);
        this.save();
        return true;
    },
    refreshAbilities() {
        const d = this.data;
        if (!d) return [];
        const fresh = ABILITIES.filter(a => !d.abilities[a.id] && meetsReq(a.unlock, d));
        fresh.forEach(a => { d.abilities[a.id] = 1; });
        if (fresh.length) this.save();
        return fresh;
    },
    equippedAbilities() {
        const d = this.data;
        if (!d) return [];
        return d.loadout.filter(id => d.abilities[id]).map(id => ({ id, level: d.abilities[id] }));
    },
    equip(id) {
        const d = this.data;
        if (!d) return 'Nenhuma campanha ativa.';
        if (!d.abilities[id]) return 'Esta habilidade ainda está bloqueada.';
        if (d.loadout.includes(id)) return 'Esta habilidade já está equipada.';
        if (d.loadout.length >= LOADOUT_SIZE) return 'Os 3 espaços estão ocupados. Remova uma habilidade para trocar.';
        d.loadout.push(id);
        this.save();
        return null;
    },
    unequip(id) {
        const d = this.data;
        if (!d || !d.loadout.includes(id)) return false;
        d.loadout = d.loadout.filter(x => x !== id);
        this.save();
        return true;
    },
    clearLoadout() {
        const d = this.data;
        if (!d || !d.loadout.length) return false;
        d.loadout = [];
        this.save();
        return true;
    },
    nextAbilityLevel(id) {
        const d = this.data;
        const a = abilityById(id);
        if (!d || !a || !d.abilities[id]) return null;
        return a.levels[d.abilities[id]] || null;
    },
    canUpgrade(id) {
        const next = this.nextAbilityLevel(id);
        return !!next && meetsReq(next.req, this.data);
    },
    upgradeAbility(id) {
        if (!this.canUpgrade(id)) return false;
        const d = this.data;
        d.abilities[id]++;
        this.save();
        return true;
    }
};

const SETTINGS_KEY = 'summit_settings';
const DEFAULT_KEYS = {
    jump: ['Space', 'KeyC', 'KeyZ'],
    dash: ['KeyX', 'KeyK', 'KeyJ'],
    grab: ['ShiftLeft', 'ShiftRight', 'KeyV', 'KeyL'],
    skill1: ['KeyQ'],
    skill2: ['KeyE'],
    skill3: ['KeyF']
};
const PAD_CODE = { jump: 'PadJump', dash: 'PadDash', grab: 'PadGrab', skill1: 'PadSkill1', skill2: 'PadSkill2', skill3: 'PadSkill3' };
const RESERVED_KEYS = new Set(['Escape', 'Enter', 'Tab', 'KeyI', 'KeyM', 'KeyP', 'KeyR', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);
const copyKeys = keys => Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, [...v]]));

export const Settings = {
    master: 1, music: 0.6, sfx: 1, muted: false, shake: true, shadows: true, hints: true,
    keys: copyKeys(DEFAULT_KEYS),
    load() {
        let raw = null;
        try { raw = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch (e) {}
        if (!raw || typeof raw !== 'object') return;
        const { keys, ...rest } = raw;
        Object.assign(this, rest);
        for (const action of Object.keys(DEFAULT_KEYS)) {
            const list = obj(keys)[action];
            if (Array.isArray(list) && list.length && list.every(k => typeof k === 'string')) this.keys[action] = list;
        }
    },
    save() {
        const { master, music, sfx, muted, shake, shadows, hints, keys } = this;
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ master, music, sfx, muted, shake, shadows, hints, keys })); } catch (e) {}
    },
    rebind(action, code) {
        if (RESERVED_KEYS.has(code)) return 'Essa tecla é reservada para movimento ou menus. Escolha outra.';
        const previous = this.keys[action];
        for (const [other, list] of Object.entries(this.keys)) {
            if (other === action || !list.includes(code)) continue;
            const rest = list.filter(k => k !== code);
            this.keys[other] = rest.length ? rest : [...previous];
        }
        this.keys[action] = [code];
        this.save();
        return null;
    },
    resetKeys() {
        this.keys = copyKeys(DEFAULT_KEYS);
        this.save();
    }
};

export const actionCodes = action => [...Settings.keys[action], PAD_CODE[action]];

const KEY_NAMES = {
    Space: 'Espaço', ShiftLeft: 'Shift', ShiftRight: 'Shift Dir.', ControlLeft: 'Ctrl', ControlRight: 'Ctrl Dir.',
    AltLeft: 'Alt', AltRight: 'Alt Dir.', CapsLock: 'Caps', Comma: ',', Period: '.', Semicolon: ';', Slash: '/',
    Quote: "'", BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '´', Backslash: '\\'
};

export function keyLabel(code) {
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return KEY_NAMES[code] || code;
}
