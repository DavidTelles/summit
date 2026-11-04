export const Input = {
    keys: {},
    pressed: {},
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
        });
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

export const Sfx = {
    ctx: null,
    muted: false,
    volume: 1,
    ensure() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) this.ctx = new AC();
        }
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(freq, dur, type = 'square', vol = 0.06, slide = 0) {
        if (this.muted || !this.ctx) return;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
        g.gain.setValueAtTime(vol * this.volume, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.ctx.destination);
        o.start(t);
        o.stop(t + dur);
    },
    jump() { this.tone(300, 0.14, 'square', 0.05, 250); },
    dash() { this.tone(500, 0.2, 'sawtooth', 0.06, -380); },
    land() { this.tone(110, 0.08, 'triangle', 0.08); },
    die() { this.tone(300, 0.5, 'sawtooth', 0.08, -260); },
    berry() {
        this.tone(660, 0.1, 'triangle', 0.08);
        setTimeout(() => this.tone(990, 0.18, 'triangle', 0.08), 80);
    },
    crystal() { this.tone(820, 0.15, 'sine', 0.08, 400); },
    spring() { this.tone(200, 0.25, 'square', 0.06, 700); },
    stomp() { this.tone(180, 0.12, 'square', 0.08, -90); },
    check() {
        this.tone(520, 0.12, 'sine', 0.07);
        setTimeout(() => this.tone(780, 0.2, 'sine', 0.07), 100);
    },
    win() {
        [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'triangle', 0.08), i * 140));
    },
    achievement() {
        [784, 988, 1175].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'sine', 0.08), i * 90));
    }
};

export const ACHIEVEMENTS = [
    { id: 'first_steps', icon: '👣', name: 'Primeiros Passos', desc: 'Complete a primeira fase.', secret: false },
    { id: 'berry_5', icon: '🍓', name: 'Colecionador', desc: 'Pegue 5 morangos no total.', secret: false },
    { id: 'berry_all', icon: '🍓', name: 'Banquete', desc: 'Pegue todos os morangos de uma fase.', secret: false },
    { id: 'die_10', icon: '💀', name: 'Persistente', desc: 'Morra 10 vezes.', secret: false },
    { id: 'die_50', icon: '☠️', name: 'Imortal Demais', desc: 'Morra 50 vezes.', secret: false },
    { id: 'stomp_5', icon: '🥾', name: 'Pisa Forte', desc: 'Derrote 5 inimigos.', secret: false },
    { id: 'dash_dmg', icon: '⚡', name: 'Investida Mortal', desc: 'Derrote um inimigo com o dash.', secret: false },
    { id: 'spring', icon: '🌀', name: 'Boing!', desc: 'Use uma mola.', secret: false },
    { id: 'crystal_10', icon: '💎', name: 'Energia Pura', desc: 'Use 10 cristais de dash.', secret: false },
    { id: 'no_death', icon: '🛡️', name: 'Impecável', desc: 'Complete uma fase sem morrer.', secret: false },
    { id: 'speed', icon: '⏱️', name: 'Velocista', desc: 'Complete a fase 1 em menos de 40s.', secret: false },
    { id: 'summit', icon: '🏔️', name: 'No Cume', desc: 'Complete a última fase.', secret: false },
    { id: 'ch1_complete', icon: '🏁', name: 'Capítulo 1 Concluído', desc: 'Conclua o Capítulo 1.', secret: false },
    { id: 'ch2_complete', icon: '🏁', name: 'Capítulo 2 Concluído', desc: 'Conclua o Capítulo 2.', secret: false },
    { id: 'ch3_complete', icon: '🏁', name: 'Capítulo 3 Concluído', desc: 'Conclua o Capítulo 3.', secret: false },
    { id: 'summit_complete', icon: '👑', name: 'Summit Completo', desc: 'Conclua todos os capítulos.', secret: false },
    { id: 'no_death_ch1', icon: '🛡️', name: 'Impecável I', desc: 'Conclua o Capítulo 1 sem morrer.', secret: false },
    { id: 'no_death_ch2', icon: '🛡️', name: 'Impecável II', desc: 'Conclua o Capítulo 2 sem morrer.', secret: false },
    { id: 'no_death_ch3', icon: '🛡️', name: 'Impecável III', desc: 'Conclua o Capítulo 3 sem morrer.', secret: false },
    { id: 'no_death_all', icon: '🏆', name: 'Perfeição', desc: 'Conclua os três capítulos sem morrer nenhuma vez.', secret: false },
    { id: 'first_death', icon: '💀', name: 'Primeira Queda', desc: 'Morra pela primeira vez.', secret: false },
    { id: 'die_spike', icon: '📌', name: 'Espinho Fatal', desc: 'Morra em espinhos.', secret: true },
    { id: 'die_fall', icon: '🕳️', name: 'Queda Livre', desc: 'Morra caindo.', secret: true },
    { id: 'boss1', icon: '👹', name: 'Caçador do Pico', desc: 'Derrote o chefe do Capítulo 1.', secret: false },
    { id: 'boss2', icon: '👹', name: 'Tempestade Vencida', desc: 'Derrote o chefe do Capítulo 2.', secret: false },
    { id: 'boss3', icon: '👹', name: 'Cume Conquistado', desc: 'Derrote o chefe final.', secret: false },
    { id: 'boss_nodmg', icon: '💯', name: 'Intocável', desc: 'Derrote um chefe sem receber dano.', secret: true },
    { id: 'secret_area', icon: '🔍', name: 'Explorador', desc: 'Encontre uma área secreta.', secret: true },
    { id: 'all_skills', icon: '✨', name: 'Mestre', desc: 'Desbloqueie todas as habilidades.', secret: false }
];

export const SKILLS = [
    { id: 'dash', name: 'Dash', desc: 'Investida em 8 direções.', unlock: 'Início da jornada' },
    { id: 'wall_climb', name: 'Escalada', desc: 'Agarrar e escalar paredes.', unlock: 'Início da jornada' },
    { id: 'double_jump', name: 'Pulo Duplo', desc: 'Segundo pulo no ar.', unlock: 'Após a fase 3' },
    { id: 'air_dash', name: 'Dash Aéreo', desc: 'Dash recarregável no ar.', unlock: 'Capítulo 2' },
    { id: 'ground_pound', name: 'Pancada no Chão', desc: 'Ataque descendente em área.', unlock: 'Capítulo 3' }
];

export const Save = {
    slots: [null, null, null],
    active: -1,
    load() {
        for (let i = 0; i < 3; i++) {
            try {
                const raw = localStorage.getItem('summit_slot_' + i);
                this.slots[i] = raw ? JSON.parse(raw) : null;
            } catch (e) { this.slots[i] = null; }
        }
        const a = localStorage.getItem('summit_active_slot');
        if (a !== null) {
            const n = parseInt(a, 10);
            if (n >= 0 && n < 3) this.active = n;
        }
    },
    slot(i) { return this.slots[i]; },
    hasActive() { return this.active >= 0 && this.slots[this.active]; },
    get data() {
        if (this.active < 0) return null;
        if (!this.slots[this.active]) return null;
        return this.slots[this.active];
    },
    create(i, mode) {
        const now = Date.now();
        const d = {
            version: 1, mode: mode || 'normal', createdAt: now, updatedAt: now,
            chapter: 1, unlocked: 1, currentLevel: 0,
            deaths: 0, chapterDeaths: [0, 0, 0], berries: 0, stomps: 0, crystals: 0,
            best: {}, achievements: {}, skills: ['dash', 'wall_climb'],
            totalTime: 0, completedChapters: []
        };
        this.slots[i] = d;
        this.active = i;
        localStorage.setItem('summit_slot_' + i, JSON.stringify(d));
        localStorage.setItem('summit_active_slot', String(i));
    },
    setActive(i) {
        this.active = i;
        if (i >= 0) localStorage.setItem('summit_active_slot', String(i));
    },
    deleteSlot(i) {
        localStorage.removeItem('summit_slot_' + i);
        this.slots[i] = null;
        if (this.active === i) { this.active = -1; localStorage.removeItem('summit_active_slot'); }
    },
    save() {
        if (this.active < 0 || !this.slots[this.active]) return;
        this.slots[this.active].updatedAt = Date.now();
        try { localStorage.setItem('summit_slot_' + this.active, JSON.stringify(this.slots[this.active])); } catch (e) {}
    },
    reset() {
        if (this.active >= 0) this.deleteSlot(this.active);
    },
    hasSkill(id) {
        const d = this.data;
        return !!(d && Array.isArray(d.skills) && d.skills.includes(id));
    },
    unlockSkill(id) {
        const d = this.data;
        if (!d) return;
        if (!d.skills) d.skills = [];
        if (!d.skills.includes(id)) { d.skills.push(id); this.save(); }
    }
};
