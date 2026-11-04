const PAD_MAP = [
    [0, 'Space'], [1, 'KeyX'], [2, 'KeyX'], [3, 'Space'], [4, 'ShiftLeft'], [5, 'ShiftLeft'],
    [6, 'KeyV'], [7, 'KeyV'], [9, 'KeyP'], [8, 'KeyR'],
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
            dispatchEvent(new KeyboardEvent(next[code] ? 'keydown' : 'keyup', { code, key: code === 'Space' ? ' ' : code }));
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
    { id: 'all_skills', icon: 'star', name: 'Mestre', desc: 'Desbloqueie todas as habilidades.', secret: false }
];

export const SKILLS = [
    { id: 'dash', icon: 'bolt', name: 'Dash', desc: 'Investida em 8 direções. Derrota inimigos e quebra paredes rachadas.', unlock: 'Início da jornada' },
    { id: 'wall_climb', icon: 'boot', name: 'Escalada', desc: 'Agarrar e escalar paredes.', unlock: 'Início da jornada' },
    { id: 'double_jump', icon: 'spring', name: 'Pulo Duplo', desc: 'Segundo pulo no ar.', unlock: 'Após a fase 3' },
    { id: 'air_dash', icon: 'crystal', name: 'Dash Aéreo', desc: 'Dois dashes antes de tocar o chão.', unlock: 'Após a fase 6' },
    { id: 'ground_pound', icon: 'peak', name: 'Pancada no Chão', desc: '↓ + Pular no ar: ataque em área que quebra pisos rachados.', unlock: 'Após a fase 10' }
];

const SAVE_VERSION = 2;
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

export function sanitizeSave(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const now = Date.now();
    const version = raw.version || 1;
    const unlocked = Math.min(LEVEL_COUNT, Math.max(1, Math.floor(num(raw.unlocked, 1))));
    const currentLevel = Math.min(unlocked - 1, Math.floor(num(raw.currentLevel, 0)));
    const skills = new Set(skillsForProgress(unlocked));
    const best = obj(raw.best);
    if (version < SAVE_VERSION) {
        Object.keys(best).forEach(k => { if (+k >= FIRST_REDESIGNED_LEVEL) delete best[k]; });
    }
    const cp = raw.checkpoint;
    const validCheckpoint = cp && Number.isInteger(cp.level) && Number.isFinite(cp.x) && Number.isFinite(cp.y);
    return {
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
        checkpoint: validCheckpoint ? { level: cp.level, x: cp.x, y: cp.y, time: num(cp.time) } : null
    };
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
        this.slots[i] = sanitizeSave({ mode: mode || 'normal', version: SAVE_VERSION });
        try { localStorage.removeItem(backupKey(i)); } catch (e) {}
        this.setActive(i);
        this.write(i);
    },
    setActive(i) {
        this.active = i;
        try {
            if (i >= 0) localStorage.setItem(ACTIVE_KEY, String(i));
        } catch (e) {}
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
        } catch (e) {}
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
    }
};

const SETTINGS_KEY = 'summit_settings';
export const Settings = {
    master: 1, music: 0.6, sfx: 1, muted: false, shake: true, shadows: true,
    load() {
        try { Object.assign(this, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}); } catch (e) {}
    },
    save() {
        const { master, music, sfx, muted, shake, shadows } = this;
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ master, music, sfx, muted, shake, shadows })); } catch (e) {}
    }
};
