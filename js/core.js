import { ABILITIES, LOADOUT_SIZE, abilityById, meetsReq } from './abilities.js';
import { TOTAL_RECORDS, recordsFound, sanitizeStory } from './story.js';

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

export const ACHIEVEMENTS = [
    { id: 'first_steps', icon: 'boot', name: 'Primeiros Passos', desc: 'Complete a primeira fase.', secret: false },
    { id: 'berry_5', icon: 'berry', name: 'Colecionador', desc: 'Pegue 5 morangos no total.', secret: false },
    { id: 'berry_all', icon: 'berry', name: 'Banquete', desc: 'Pegue todos os morangos de uma fase.', secret: false },
    { id: 'die_10', icon: 'skull', name: 'Persistente', desc: 'Morra 10 vezes.', secret: false },
    { id: 'die_50', icon: 'skull', name: 'Imortal Demais', desc: 'Morra 50 vezes.', secret: false },
    { id: 'stomp_5', icon: 'boot', name: 'Pisa Forte', desc: 'Derrote 5 inimigos.', secret: false },
    { id: 'dash_dmg', icon: 'bolt', name: 'Investida Mortal', desc: 'Derrote um inimigo com o dash.', secret: false },
    { id: 'spring', icon: 'spring', name: 'Boing!', desc: 'Use uma mola.', secret: false },
    { id: 'crystal_10', icon: 'crystal', name: 'Energia Pura', desc: 'Use 10 cristais de dash.', secret: false },
    { id: 'no_death', icon: 'shield', name: 'Impecável', desc: 'Complete uma fase sem morrer.', secret: false },
    { id: 'speed', icon: 'clock', name: 'Velocista', desc: 'Complete a fase 1 em menos de 40s.', secret: false },
    { id: 'summit', icon: 'peak', name: 'No Cume', desc: 'Complete a última fase.', secret: false },
    { id: 'ch1_complete', icon: 'flag', name: 'Capítulo 1 Concluído', desc: 'Conclua o Capítulo 1.', secret: false },
    { id: 'ch2_complete', icon: 'flag', name: 'Capítulo 2 Concluído', desc: 'Conclua o Capítulo 2.', secret: false },
    { id: 'ch3_complete', icon: 'flag', name: 'Capítulo 3 Concluído', desc: 'Conclua o Capítulo 3.', secret: false },
    { id: 'summit_complete', icon: 'crown', name: 'Summit Completo', desc: 'Conclua todos os capítulos.', secret: false },
    { id: 'no_death_ch1', icon: 'shield', name: 'Impecável I', desc: 'Conclua o Capítulo 1 sem morrer.', secret: false },
    { id: 'no_death_ch2', icon: 'shield', name: 'Impecável II', desc: 'Conclua o Capítulo 2 sem morrer.', secret: false },
    { id: 'no_death_ch3', icon: 'shield', name: 'Impecável III', desc: 'Conclua o Capítulo 3 sem morrer.', secret: false },
    { id: 'no_death_all', icon: 'trophy', name: 'Perfeição', desc: 'Conclua os três capítulos sem morrer nenhuma vez.', secret: false },
    { id: 'first_death', icon: 'skull', name: 'Primeira Queda', desc: 'Morra pela primeira vez.', secret: false },
    { id: 'die_spike', icon: 'spike', name: 'Espinho Fatal', desc: 'Morra em espinhos.', secret: true },
    { id: 'die_fall', icon: 'pit', name: 'Queda Livre', desc: 'Morra caindo.', secret: true },
    { id: 'boss1', icon: 'boss', name: 'Caçador do Pico', desc: 'Derrote o chefe do Capítulo 1.', secret: false },
    { id: 'boss2', icon: 'boss', name: 'Tempestade Vencida', desc: 'Derrote o chefe do Capítulo 2.', secret: false },
    { id: 'boss3', icon: 'boss', name: 'Cume Conquistado', desc: 'Derrote o chefe final.', secret: false },
    { id: 'boss_nodmg', icon: 'star', name: 'Intocável', desc: 'Derrote um chefe sem receber dano.', secret: true },
    { id: 'secret_area', icon: 'eye', name: 'Explorador', desc: 'Encontre uma área secreta.', secret: true },
    { id: 'trial_ch3', icon: 'trophy', name: 'Provação do Núcleo', desc: 'Vença um desafio opcional do Capítulo 3.', secret: true },
    { id: 'all_skills', icon: 'star', name: 'Mestre', desc: 'Desbloqueie todas as habilidades.', secret: false },
    { id: 'first_loadout', icon: 'spark', name: 'Bem Preparado', desc: 'Inicie uma fase com 3 habilidades equipadas.', secret: false },
    { id: 'ability_max', icon: 'spark', name: 'Domínio', desc: 'Evolua uma habilidade até o nível máximo.', secret: false },
    { id: 'first_record', icon: 'scroll', name: 'Quem Lê', desc: 'Encontre um registro opcional.', secret: false },
    { id: 'all_records', icon: 'scroll', name: 'Cronista', desc: 'Reúna todos os registros de uma campanha.', secret: false },
    { id: 'core_reached', icon: 'eye', name: 'O Silêncio', desc: 'Responda à pergunta do Núcleo.', secret: true }
];

export function achievementProgress(id, d) {
    const bar = (cur, goal) => [Math.min(cur, goal), goal];
    switch (id) {
        case 'berry_5': return bar(d.berries, 5);
        case 'die_10': return bar(d.deaths, 10);
        case 'die_50': return bar(d.deaths, 50);
        case 'stomp_5': return bar(d.stomps, 5);
        case 'crystal_10': return bar(d.crystals, 10);
        case 'all_records': return bar(recordsFound(d), TOTAL_RECORDS);
        case 'all_skills': return bar(d.skills.length + Object.keys(d.abilities).length, SKILLS.length + ABILITIES.length);
        default: return null;
    }
}

export const SKILLS = [
    { id: 'dash', icon: 'bolt', name: 'Dash', desc: 'Investida em 8 direções. Derrota inimigos e quebra paredes rachadas.', unlock: 'Início da jornada' },
    { id: 'wall_climb', icon: 'boot', name: 'Escalada', desc: 'Agarrar e escalar paredes.', unlock: 'Início da jornada' },
    { id: 'double_jump', icon: 'spring', name: 'Pulo Duplo', desc: 'Segundo pulo no ar.', unlock: 'Após a fase 3' },
    { id: 'air_dash', icon: 'crystal', name: 'Dash Aéreo', desc: 'Dois dashes antes de tocar o chão.', unlock: 'Após a fase 6' },
    { id: 'ground_pound', icon: 'peak', name: 'Pancada no Chão', desc: '↓ + Pular no ar: ataque em área que quebra pisos rachados.', unlock: 'Após a fase 10' }
];

const SAVE_VERSION = 4;
const SLOT_COUNT = 3;
const LEVEL_COUNT = 12;
const FIRST_REDESIGNED_LEVEL = 5;
const CHAPTER_STARTS = [0, 5, 9];
const slotKey = i => 'summit_slot_' + i;
const backupKey = i => slotKey(i) + '_bak';
const ACTIVE_KEY = 'summit_active_slot';

export function chapterOfLevel(index) {
    return index >= CHAPTER_STARTS[2] ? 3 : index >= CHAPTER_STARTS[1] ? 2 : 1;
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
    const unlocked = Math.min(LEVEL_COUNT, Math.max(1, Math.floor(num(raw.unlocked, 1))));
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
        chapterDeaths: [0, 1, 2].map(i => num(Array.isArray(raw.chapterDeaths) ? raw.chapterDeaths[i] : 0)),
        berries: num(raw.berries),
        stomps: num(raw.stomps),
        crystals: num(raw.crystals),
        best,
        achievements: obj(raw.achievements),
        skills: [...skills],
        totalTime: num(raw.totalTime),
        completedChapters: Array.isArray(raw.completedChapters) ? raw.completedChapters.filter(n => [1, 2, 3].includes(n)) : [],
        secrets: obj(raw.secrets),
        checkpoint: validCheckpoint ? { level: cp.level, x: cp.x, y: cp.y, time: num(cp.time) } : null,
        abilityUses: num(raw.abilityUses)
    };
    sanitizeAbilities(data, raw);
    data.story = sanitizeStory(raw.story, data, version);
    return data;
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
const RESERVED_KEYS = new Set(['Escape', 'Enter', 'Tab', 'KeyP', 'KeyR', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);
const copyKeys = keys => Object.fromEntries(Object.entries(keys).map(([k, v]) => [k, [...v]]));

export const Settings = {
    master: 1, music: 0.6, sfx: 1, muted: false, shake: true, shadows: true,
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
        const { master, music, sfx, muted, shake, shadows, keys } = this;
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ master, music, sfx, muted, shake, shadows, keys })); } catch (e) {}
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
