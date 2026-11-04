import { Settings } from './core.js';

const CHORDS = {
    1: [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 330]],
    2: [[147, 175, 220], [131, 165, 196], [117, 147, 175], [139, 165, 208]],
    3: [[110, 131, 165], [104, 131, 156], [98, 123, 147], [92, 117, 139]],
    boss: [[110, 131, 165], [117, 139, 175], [98, 123, 147], [104, 131, 156]]
};
const BEAT = { 1: 2.4, 2: 2.0, 3: 1.7, boss: 0.46 };
const LOOKAHEAD = 0.5;

export const Sfx = {
    ctx: null,
    bus: null,
    musicBus: null,
    ambientGain: null,
    theme: null,
    nextBar: 0,
    bar: 0,
    get muted() { return Settings.muted; },
    set muted(v) { Settings.muted = v; Settings.save(); this.applyVolumes(); },
    ensure() {
        if (!this.ctx) {
            const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
            if (!AC) return;
            this.ctx = new AC();
            const comp = this.ctx.createDynamicsCompressor();
            comp.connect(this.ctx.destination);
            this.master = this.ctx.createGain();
            this.master.connect(comp);
            this.bus = this.ctx.createGain();
            this.bus.connect(this.master);
            this.musicBus = this.ctx.createGain();
            this.musicBus.connect(this.master);
            this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
            const d = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            this.applyVolumes();
            this.startAmbient();
            setInterval(() => this.schedule(), 200);
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    },
    applyVolumes() {
        if (!this.ctx) return;
        this.master.gain.value = Settings.muted ? 0 : Settings.master;
        this.bus.gain.value = Settings.sfx;
        this.musicBus.gain.value = Settings.music * 0.5;
    },
    tone(freq, dur, type = 'square', vol = 0.06, slide = 0, delay = 0, out = null) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(out || this.bus);
        o.start(t);
        o.stop(t + dur + 0.02);
    },
    noise(dur, freq = 1200, vol = 0.1, q = 0.8, slideTo = 0, delay = 0) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource();
        s.buffer = this.noiseBuffer;
        s.loop = true;
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = q;
        f.frequency.setValueAtTime(freq, t);
        if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f).connect(g).connect(this.bus);
        s.start(t);
        s.stop(t + dur + 0.02);
    },
    startAmbient() {
        const s = this.ctx.createBufferSource();
        s.buffer = this.noiseBuffer;
        s.loop = true;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 420;
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = 0;
        s.connect(f).connect(this.ambientGain).connect(this.musicBus);
        s.start();
    },
    setTheme(theme, wind = 0.03) {
        if (theme === this.theme) return;
        this.theme = theme;
        this.bar = 0;
        if (!this.ctx) return;
        this.ambientGain.gain.value = theme ? wind : 0;
        this.nextBar = this.ctx.currentTime + 0.1;
    },
    schedule() {
        if (!this.ctx || !this.theme || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        if (this.nextBar < now) this.nextBar = now + 0.05;
        while (this.nextBar < now + LOOKAHEAD) {
            this.playBar(this.nextBar - now);
            this.nextBar += BEAT[this.theme];
            this.bar++;
        }
    },
    playBar(delay) {
        const chords = CHORDS[this.theme];
        const beat = BEAT[this.theme];
        if (this.theme === 'boss') {
            const root = chords[Math.floor(this.bar / 8) % chords.length];
            this.tone(root[0] / 2, beat * 0.9, 'sawtooth', 0.09, 0, delay, this.musicBus);
            this.tone(this.bar % 2 ? 58 : 46, 0.18, 'sine', 0.3, -12, delay, this.musicBus);
            if (this.bar % 8 === 6) this.tone(root[2] * 2, beat * 1.6, 'square', 0.025, 0, delay, this.musicBus);
            return;
        }
        const chord = chords[this.bar % chords.length];
        chord.forEach(f => this.tone(f, beat * 1.5, 'sine', 0.06, 0, delay, this.musicBus));
        const note = chord[(this.bar * 2) % 3] * 2;
        if (this.bar % 2 === 0) this.tone(note, beat * 0.9, 'triangle', 0.03, 0, delay + beat / 2, this.musicBus);
    },
    jump() { this.tone(300, 0.14, 'square', 0.04, 250); },
    doubleJump() { this.tone(460, 0.16, 'triangle', 0.08, 500); this.noise(0.12, 2600, 0.04); },
    wallJump() { this.tone(360, 0.12, 'square', 0.04, 300); this.noise(0.06, 900, 0.07); },
    dash() { this.noise(0.22, 3000, 0.12, 0.6, 500); this.tone(500, 0.18, 'sawtooth', 0.03, -380); },
    land() { this.noise(0.07, 420, 0.12); },
    step() { this.noise(0.03, 900, 0.025); },
    die() { this.tone(300, 0.5, 'sawtooth', 0.08, -260); this.noise(0.4, 800, 0.14, 0.7, 120); },
    hurt() { this.tone(240, 0.18, 'square', 0.1, -140); this.noise(0.12, 1500, 0.12); },
    berry() {
        this.tone(660, 0.1, 'triangle', 0.08);
        this.tone(990, 0.18, 'triangle', 0.08, 0, 0.08);
    },
    crystal() { this.tone(820, 0.15, 'sine', 0.08, 400); },
    spring() { this.tone(200, 0.25, 'square', 0.05, 700); },
    stomp() { this.tone(180, 0.12, 'square', 0.08, -90); this.noise(0.08, 500, 0.1); },
    clank() { this.tone(1400, 0.08, 'square', 0.05, -500); this.tone(2100, 0.05, 'triangle', 0.04); },
    pound() { this.tone(90, 0.3, 'sine', 0.25, -50); this.noise(0.25, 300, 0.2); },
    shatter() { this.noise(0.25, 1800, 0.12, 0.5, 400); },
    check() {
        this.tone(520, 0.12, 'sine', 0.07);
        this.tone(780, 0.2, 'sine', 0.07, 0, 0.1);
    },
    win() {
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.08, 0, i * 0.14));
    },
    achievement() {
        [784, 988, 1175].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.08, 0, i * 0.09));
    },
    skill() {
        [392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.07, 0, i * 0.11));
    },
    secret() {
        [659, 622, 523, 415, 494, 659].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.06, 0, i * 0.1));
    },
    thunder() { this.noise(0.9, 240, 0.32, 0.5, 50); this.noise(0.08, 3000, 0.12); },
    tell() { this.tone(660, 0.1, 'square', 0.03, 200); },
    shot() { this.tone(520, 0.12, 'sawtooth', 0.04, -200); },
    gust() { this.noise(0.7, 500, 0.08, 0.5, 1400); },
    roar() { this.tone(90, 1.1, 'sawtooth', 0.16, -40); this.noise(1.0, 400, 0.2, 0.5, 150); },
    bossHit() { this.tone(160, 0.2, 'square', 0.14, -80); this.noise(0.18, 2000, 0.16); },
    bossDown() { this.roar(); [0.2, 0.5, 0.8, 1.1].forEach(d => this.noise(0.5, 300, 0.25, 0.5, 60, d)); },
    uiMove() { this.tone(700, 0.04, 'triangle', 0.03); },
    uiSelect() { this.tone(520, 0.06, 'triangle', 0.05, 300); },
    uiBack() { this.tone(420, 0.07, 'triangle', 0.04, -150); }
};
