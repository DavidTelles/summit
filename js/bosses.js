import * as E from './entities.js';
import { Shot, Strike, Lava, overlap } from './hazards.js';
import { Sfx } from './audio.js';
import { PH, PW } from './config.js';

const INTRO_TIME = 2.8;
const DYING_TIME = 2.6;

class Boss {
    constructor(game, def, stats) {
        this.game = game;
        this.arena = game.level.arena;
        Object.assign(this, { hp: 6, maxHp: 6, phase: 0, thresholds: [], name: '', title: '', w: 3, h: 3 }, stats);
        this.maxHp = this.hp;
        this.phaseStartHp = this.hp;
        this.mode = 'idle';
        this.modeT = 0;
        this.act = 'idle';
        this.t = 0;
        this.step = 0;
        this.dir = -1;
        this.vulnerable = false;
        this.hitFlash = 0;
        this.invuln = 0;
        Object.assign(this, def);
        this.home = { x: this.x, y: this.y };
        this.mesh = this.buildMesh();
        this.mesh.position.set(this.x, this.y, 0);
        game.view.root.add(this.mesh);
    }

    get floor() { return this.arena.floor; }
    get center() { return (this.arena.x1 + this.arena.x2) / 2; }
    get alive() { return this.mode !== 'dead'; }
    get fighting() { return this.mode === 'fight'; }

    setAct(act) {
        this.act = act;
        this.t = 0;
    }

    begin() {
        this.mode = 'intro';
        this.modeT = 0;
        this.onIntro();
    }

    onIntro() {}

    retry() {
        this.hp = this.phaseStartHp;
        this.vulnerable = false;
        this.mode = 'fight';
        this.step = 0;
        this.x = this.home.x;
        this.y = this.home.y;
        this.mesh.visible = true;
        this.onRetry();
        this.setAct('idle');
    }

    onRetry() {}

    update(dt, p) {
        this.hitFlash = Math.max(0, this.hitFlash - dt);
        this.invuln = Math.max(0, this.invuln - dt);
        this.modeT += dt;
        if (this.mode === 'intro') {
            if (this.modeT >= INTRO_TIME) {
                this.mode = 'fight';
                this.setAct('idle');
                this.game.bossFightStarted();
            }
            return;
        }
        if (this.mode === 'dying') {
            if (Math.random() < dt * 14) {
                const c = this.dyingPoint();
                this.game.view.emit(c.x + (Math.random() - 0.5) * this.w, c.y + (Math.random() - 0.5) * this.h, 0xffc060, 14, 7, 0.6);
                this.game.shake(0.25);
            }
            if (this.modeT >= DYING_TIME) {
                this.mode = 'dead';
                this.mesh.visible = false;
                const c = this.dyingPoint();
                this.game.view.emit(c.x, c.y, 0xffffff, 70, 12, 1.2);
                this.game.bossDefeated();
            }
            return;
        }
        if (this.mode !== 'fight') return;
        this.t += dt;
        this.think(dt, p);
        this.checkContact(p);
    }

    dyingPoint() {
        return { x: this.x, y: this.y + this.h / 2 };
    }

    parts() {
        return [{ id: 'body', x: this.x, y: this.y + this.h / 2, w: this.w, h: this.h, deadly: !this.vulnerable }];
    }

    checkContact(p) {
        if (p.dead) return;
        const px = p.x;
        const py = p.y + PH / 2;
        for (const part of this.parts()) {
            const reach = this.game.abilities.hitReach(p);
            if (!overlap(px, py, PW * 0.85 * reach, PH * 0.9 * reach, part.x, part.y, part.w, part.h)) continue;
            const kind = this.game.attackKind(p, part.y - part.h / 2 + part.h * 0.4);
            if (kind) {
                const result = this.onStrike(part, kind, p);
                this.game.afterBossStrike(result, part, kind);
                return;
            }
            if (part.deadly) {
                this.game.hurtPlayer(1, part.x);
                return;
            }
        }
    }

    onStrike(part, kind) {
        if (this.invuln > 0) return 'none';
        if (!this.vulnerable) return 'blocked';
        this.damage();
        return 'hit';
    }

    damage() {
        this.hp--;
        this.invuln = 0.5;
        this.hitFlash = 0.4;
        this.vulnerable = false;
        Sfx.bossHit();
        this.game.hitstop(0.12);
        this.game.shake(0.55);
        const c = this.dyingPoint();
        this.game.view.emit(c.x, c.y, 0xffe08a, 34, 9, 0.8);
        this.game.bossBarChanged();
        if (this.hp <= 0) {
            this.mode = 'dying';
            this.modeT = 0;
            this.game.bossDying();
            return;
        }
        const next = this.thresholds[this.phase];
        if (next !== undefined && this.hp <= next) {
            this.phase++;
            this.phaseStartHp = this.hp;
            this.setAct('transition');
            this.onPhaseChange();
            Sfx.roar();
            this.game.shake(0.8);
        } else this.setAct('recover');
    }

    onPhaseChange() {}

    onPound() {}

    nextAct(patterns) {
        const pattern = patterns[Math.min(this.phase, patterns.length - 1)];
        const act = pattern[this.step % pattern.length];
        this.step++;
        this.setAct(act);
        return act;
    }

    strike(x, y, w, h, warn, active, color, onStrike) {
        const s = new Strike(this.game, x, y, w, h, warn, active, color);
        s.onStrike = onStrike;
        this.game.addStrike(s);
        return s;
    }

    sync(t, dt) {
        this.mesh.position.set(this.x, this.y, 0);
        E.animateBoss(this.mesh, this, t, dt);
    }
}

const RAM_PATTERNS = [
    ['charge', 'leap', 'charge', 'rocks'],
    ['rush', 'rocks', 'leap', 'rush', 'leap']
];

export class RamBoss extends Boss {
    constructor(game) {
        const a = game.level.arena;
        super(game, { x: a.x2 - 5, y: a.floor }, {
            hp: 6, thresholds: [3], name: 'Caçador do Pico', title: 'Fera de pedra que guarda o primeiro cume', w: 3.2, h: 2.6
        });
    }

    buildMesh() {
        return E.makeRamBoss();
    }

    onIntro() {
        Sfx.roar();
        this.game.shake(0.5);
    }

    face(p) {
        this.dir = Math.sign(p.x - this.x) || this.dir;
    }

    fallingRocks(count, spacing, delay) {
        const a = this.arena;
        for (let i = 0; i < count; i++) {
            const x = a.x1 + 2 + Math.floor((i * spacing + this.step * 3.7) % (a.x2 - a.x1 - 4));
            const warn = 0.85 + i * delay;
            this.strike(x, a.floor, 1.6, a.ceil - a.floor, warn, 0.22, 0xc99a5b, () => Sfx.stomp());
        }
    }

    think(dt, p) {
        const a = this.arena;
        const rage = this.phase > 0;
        switch (this.act) {
            case 'idle':
                this.vulnerable = false;
                this.face(p);
                if (this.t > (rage ? 0.6 : 0.95)) this.nextAct(RAM_PATTERNS);
                break;
            case 'charge':
            case 'rush':
                this.face(p);
                if (this.t > (rage ? 0.6 : 0.85)) {
                    this.chargesLeft = this.act === 'rush' ? 2 : 1;
                    this.setAct('running');
                }
                break;
            case 'running': {
                const speed = rage ? 15 : 12.5;
                this.x += this.dir * speed * dt;
                this.game.view.emit(this.x - this.dir * 1.2, this.y + 0.1, 0xb8a58a, 1, 2, 0.35);
                const limit = this.dir > 0 ? a.x2 - this.w / 2 : a.x1 + this.w / 2;
                if ((limit - this.x) * this.dir <= 0) {
                    this.x = limit;
                    this.chargesLeft--;
                    this.game.shake(0.6);
                    Sfx.pound();
                    if (this.chargesLeft > 0) {
                        this.dir = -this.dir;
                        this.setAct('turnaround');
                    } else {
                        this.fallingRocks(rage ? 4 : 2, 6, 0.12);
                        this.vulnerable = true;
                        this.setAct('stunned');
                    }
                }
                break;
            }
            case 'turnaround':
                if (this.t > 0.45) this.setAct('running');
                break;
            case 'stunned':
                if (this.t > (rage ? 1.7 : 2.3)) {
                    this.vulnerable = false;
                    this.setAct('idle');
                }
                break;
            case 'leap':
                this.face(p);
                if (this.t > 0.6) {
                    this.from = this.x;
                    this.to = Math.max(a.x1 + 2, Math.min(a.x2 - 2, p.x));
                    this.dir = Math.sign(this.to - this.x) || this.dir;
                    this.setAct('air');
                }
                break;
            case 'air': {
                const dur = 0.85;
                const k = Math.min(1, this.t / dur);
                this.x = this.from + (this.to - this.from) * k;
                this.y = a.floor + Math.sin(k * Math.PI) * 7;
                if (k >= 1) {
                    this.y = a.floor;
                    this.shockwave(rage ? 11 : 9);
                    this.vulnerable = !rage;
                    this.setAct('landed');
                }
                break;
            }
            case 'landed':
                if (this.t > 1.0) {
                    this.vulnerable = false;
                    this.setAct('idle');
                }
                break;
            case 'rocks':
                if (this.t < dt * 1.5) {
                    Sfx.roar();
                    this.game.shake(0.5);
                    this.fallingRocks(rage ? 7 : 5, 5, 0.18);
                }
                if (this.t > 1.8) this.setAct('idle');
                break;
            case 'recover':
                this.face(p);
                if (this.t < 0.5) this.x = Math.max(a.x1 + 2, Math.min(a.x2 - 2, this.x - this.dir * 8 * dt));
                if (this.t > 0.8) this.setAct('idle');
                break;
            case 'transition':
                if (this.t < dt * 1.5) {
                    this.fallingRocks(6, 4, 0.1);
                    this.game.view.flash(0.6);
                }
                if (this.t > 1.6) this.setAct('idle');
                break;
        }
    }

    shockwave(speed) {
        Sfx.pound();
        this.game.shake(0.7);
        for (const dir of [-1, 1]) {
            this.game.addShot(new Shot(this.game, this.x + dir * 1.6, this.floor + 0.45, dir * speed, 0, {
                r: 0.45, ground: true, color: 0xffb060, life: 3, breakable: false
            }));
        }
    }

    onRetry() {
        this.y = this.floor;
    }
}

const STORM_PATTERNS = [
    ['sweep', 'descend', 'ring', 'gust', 'descend'],
    ['zap', 'sweep', 'descend', 'gust', 'ring', 'zap', 'descend']
];

export class StormBoss extends Boss {
    constructor(game) {
        const a = game.level.arena;
        super(game, { x: (a.x1 + a.x2) / 2, y: a.floor + 11 }, {
            hp: 8, thresholds: [4], name: 'Olho da Tempestade', title: 'O céu inteiro olha para você', w: 3.4, h: 3.4
        });
        this.highY = this.y;
        this.windForce = 0;
    }

    buildMesh() {
        return E.makeStormBoss();
    }

    onIntro() {
        Sfx.thunder();
        this.game.view.flash(1);
    }

    onRetry() {
        this.windForce = 0;
    }

    think(dt, p) {
        const a = this.arena;
        const rage = this.phase > 0;
        this.applyWind(dt, p);
        switch (this.act) {
            case 'idle':
                this.vulnerable = false;
                this.y += (this.highY + Math.sin(this.t * 2) * 0.6 - this.y) * dt * 3;
                this.x += (Math.max(a.x1 + 4, Math.min(a.x2 - 4, p.x)) - this.x) * dt * 0.8;
                if (this.t > (rage ? 1.1 : 1.5)) this.nextAct(STORM_PATTERNS);
                break;
            case 'sweep': {
                if (this.t < dt * 1.5) {
                    const fromLeft = p.x > this.center;
                    const count = 7;
                    const width = (a.x2 - a.x1 - 2) / count;
                    for (let i = 0; i < count; i++) {
                        const col = fromLeft ? i : count - 1 - i;
                        const gapCol = (this.step * 2) % count;
                        if (col === gapCol) continue;
                        this.strike(a.x1 + 1 + col * width, a.floor, width * 0.7, a.ceil - a.floor, 0.8 + i * (rage ? 0.17 : 0.24), 0.2, 0xbfe0ff, () => {
                            Sfx.thunder();
                            this.game.view.flash(0.35);
                        });
                    }
                }
                if (this.t > 2.8) this.setAct('idle');
                break;
            }
            case 'ring':
                if (this.t < dt * 1.5 || (rage && Math.abs(this.t - 0.8) < dt / 2)) this.fireRing(rage ? 12 : 9);
                if (this.t > 1.8) this.setAct('idle');
                break;
            case 'gust':
                if (this.t < dt * 1.5) {
                    this.windDir = p.x > this.center ? 1 : -1;
                    Sfx.gust();
                }
                this.windForce = this.t > 0.7 && this.t < 3 ? this.windDir * (rage ? 6 : 4.5) : 0;
                if (this.t > 3.2) {
                    this.windForce = 0;
                    this.setAct('idle');
                }
                break;
            case 'descend': {
                const lowY = a.floor + 4.2;
                this.y += (lowY - this.y) * dt * 3.5;
                this.x += (this.center - this.x) * dt * 2;
                if (this.t > 0.8) {
                    this.vulnerable = true;
                    this.setAct('exposed');
                    Sfx.tell();
                }
                break;
            }
            case 'exposed':
                if (this.t > (rage ? 2.6 : 3.2)) {
                    this.vulnerable = false;
                    this.setAct('idle');
                }
                break;
            case 'recover':
                this.y += (this.highY - this.y) * dt * 4;
                if (this.t > 0.9) this.setAct('idle');
                break;
            case 'zap':
                if (this.t < dt * 1.5) {
                    this.strike(a.x1, a.floor, a.x2 - a.x1, 1.3, 1.5, 0.45, 0xbfe0ff, () => {
                        Sfx.thunder();
                        this.game.view.flash(0.7);
                    });
                }
                if (this.t > 2.2) this.setAct('idle');
                break;
            case 'transition':
                this.y += (this.highY - this.y) * dt * 3;
                if (this.t < dt * 1.5) this.game.view.flash(1);
                if (this.t > 1.8) this.setAct('idle');
                break;
        }
    }

    applyWind(dt, p) {
        if (!this.windForce || p.grabbing) return;
        this.game.world.moveAxis(p, 'x', this.windForce * dt);
        if (Math.random() < dt * 40) {
            const a = this.arena;
            this.game.view.emit(this.windForce > 0 ? a.x1 : a.x2, a.floor + Math.random() * (a.ceil - a.floor), 0xcfe6ff, 1, 1, 0.5, this.windForce * 4);
        }
    }

    fireRing(count) {
        Sfx.shot();
        for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2 + this.step;
            this.game.addShot(new Shot(this.game, this.x, this.y + 1.7, Math.cos(a) * 6, Math.sin(a) * 6, { color: 0xa8d4ff, r: 0.3, solid: false, life: 4 }));
        }
    }
}

const COLOSSUS_PATTERNS = [
    ['slam', 'slam', 'spiral', 'slam'],
    ['beam', 'spiral', 'sigil'],
    ['slam', 'beam', 'spiral', 'sigil', 'slam', 'sigil']
];

export class ColossusBoss extends Boss {
    constructor(game) {
        const a = game.level.arena;
        super(game, { x: (a.x1 + a.x2) / 2, y: a.floor + 11 }, {
            hp: 9, thresholds: [6, 3], name: 'Guardião do Cume', title: 'A própria montanha se levanta', w: 4, h: 3.6
        });
        this.highY = this.y;
        this.hands = [
            { x: this.x - 8, y: a.floor + 8, restX: this.x - 8, state: 'rest', t: 0 },
            { x: this.x + 8, y: a.floor + 8, restX: this.x + 8, state: 'rest', t: 0 }
        ];
        this.lava = new Lava({ y: a.floor - 3, x1: a.x1, x2: a.x2 }, game.view.root, game.grid.w);
        this.game.bossHazards.push(this.lava);
        this.lavaTarget = a.floor - 3;
        this.sigil = null;
        this.activeHand = 0;
    }

    buildMesh() {
        return E.makeColossus();
    }

    onIntro() {
        Sfx.roar();
        this.game.shake(0.9);
    }

    onRetry() {
        this.sigil = null;
        this.hands.forEach(h => { h.state = 'rest'; h.t = 0; h.x = h.restX; h.y = this.floor + 8; });
        this.applyPhaseLava(true);
        if (this.phase === 1) {
            const safe = this.arena.sigils[0];
            this.game.player.x = safe.x;
            this.game.player.y = safe.y;
        }
    }

    onPhaseChange() {
        this.sigil = null;
        this.hands.forEach(h => { h.state = 'rest'; h.t = 0; });
        this.applyPhaseLava(false);
        this.game.view.flash(0.9);
    }

    applyPhaseLava(snap) {
        this.lavaTarget = this.phase === 1 ? this.floor + 1.2 : this.floor - 3;
        if (snap) this.lava.level = this.lavaTarget;
    }

    parts() {
        const list = [{ id: 'head', x: this.x, y: this.y + this.h / 2, w: this.w, h: this.h, deadly: false }];
        for (const h of this.hands) {
            const deadly = h.state === 'falling' || h.state === 'sweep';
            list.push({ id: 'hand', hand: h, x: h.x, y: h.y + 0.9, w: 3, h: 1.8, deadly });
        }
        return list;
    }

    onStrike(part, kind) {
        if (this.invuln > 0) return 'none';
        if (part.id === 'hand') {
            if (part.hand.state !== 'stuck') return 'blocked';
            part.hand.state = 'rest';
            part.hand.t = 0;
            this.stagger();
            this.invuln = 0.3;
            Sfx.bossHit();
            this.game.hitstop(0.1);
            return 'stagger';
        }
        if (!this.vulnerable) return 'blocked';
        this.damage();
        return 'hit';
    }

    stagger() {
        this.vulnerable = true;
        this.hands.forEach(h => { if (h.state !== 'stuck') { h.state = 'rest'; h.t = 0; } });
        this.setAct('staggered');
        this.game.shake(0.5);
    }

    onPound(x, y) {
        const s = this.sigil;
        if (!s || Math.abs(x - s.x) > 2 || Math.abs(y - s.y) > 1.5) return;
        this.game.view.root.remove(s.mesh);
        this.sigil = null;
        this.stagger();
        Sfx.bossHit();
    }

    updateHands(dt, p) {
        const a = this.arena;
        for (const h of this.hands) {
            h.t += dt;
            switch (h.state) {
                case 'rest':
                    h.x += (h.restX - h.x) * dt * 3;
                    h.y += (a.floor + 8 + Math.sin(this.modeT * 2 + h.restX) * 0.3 - h.y) * dt * 3;
                    break;
                case 'track':
                    h.x += (Math.max(a.x1 + 2, Math.min(a.x2 - 2, p.x)) - h.x) * dt * 5;
                    h.y += (a.floor + 8 - h.y) * dt * 6;
                    if (h.t > (this.phase > 1 ? 0.75 : 1.0)) {
                        h.state = 'falling';
                        h.t = 0;
                    }
                    break;
                case 'falling': {
                    const ground = this.game.world.surfaceBelow(Math.floor(h.x), a.floor + 7);
                    h.y -= 26 * dt;
                    if (h.y <= ground) {
                        h.y = ground;
                        h.state = 'stuck';
                        h.t = 0;
                        Sfx.pound();
                        this.game.shake(0.7);
                        this.game.view.emit(h.x, h.y, 0xd8c8a8, 24, 7, 0.6);
                        for (const dir of [-1, 1]) {
                            this.game.addShot(new Shot(this.game, h.x + dir * 1.8, ground + 0.4, dir * 8, 0, { r: 0.4, ground: true, color: 0xffb060, life: 1.3, breakable: false, solid: true }));
                        }
                    }
                    break;
                }
                case 'stuck':
                    if (h.t > (this.phase > 1 ? 1.5 : 2.0)) {
                        h.state = 'rest';
                        h.t = 0;
                    }
                    break;
            }
        }
    }

    think(dt, p) {
        const a = this.arena;
        this.lava.level += (this.lavaTarget - this.lava.level) * Math.min(1, dt * 0.9);
        this.updateHands(dt, p);
        switch (this.act) {
            case 'idle':
                this.vulnerable = false;
                this.y += (this.highY + Math.sin(this.t * 1.5) * 0.4 - this.y) * dt * 3;
                this.x += (this.home.x + Math.sin(this.t * 0.7) * 3 - this.x) * dt * 2;
                if (this.t > 1.1) this.nextAct(COLOSSUS_PATTERNS);
                break;
            case 'slam': {
                if (this.t < dt * 1.5) {
                    this.activeHand = 1 - this.activeHand;
                    const h = this.hands[this.activeHand];
                    h.state = 'track';
                    h.t = 0;
                    Sfx.tell();
                }
                if (this.t > 1.7) this.setAct('idle');
                break;
            }
            case 'spiral':
                this.spiralT = (this.spiralT || 0) + dt;
                if (this.spiralT > (this.phase > 1 ? 0.13 : 0.19)) {
                    this.spiralT = 0;
                    const ang = this.t * 3.1;
                    for (const off of [0, Math.PI]) {
                        this.game.addShot(new Shot(this.game, this.x, this.y + 1.4, Math.cos(ang + off) * 5.5, Math.sin(ang + off) * 5.5, { color: 0xff8a5a, r: 0.28, solid: false, life: 4.5 }));
                    }
                    Sfx.shot();
                }
                if (this.t > 2.3) this.setAct('idle');
                break;
            case 'beam':
                if (this.t < dt * 1.5) {
                    const width = a.x2 - a.x1;
                    const safe = Math.floor(this.step * 1.7) % 3;
                    for (let i = 0; i < 3; i++) {
                        if (i === safe) continue;
                        this.strike(a.x1 + (i * width) / 3, a.floor - 2, width / 3, a.ceil - a.floor + 2, 1.2, 0.4, 0xff5a3c, () => {
                            Sfx.thunder();
                            this.game.view.flash(0.5);
                        });
                    }
                }
                if (this.t > 2.1) this.setAct('idle');
                break;
            case 'sigil':
                if (!this.sigil) this.placeSigil();
                if (this.t > 5) {
                    this.game.view.root.remove(this.sigil.mesh);
                    this.sigil = null;
                    this.setAct('idle');
                }
                break;
            case 'staggered':
                this.y += (a.floor + 4.2 - this.y) * dt * 5;
                this.x += (this.center - this.x) * dt * 2;
                if (this.t > 3.2) {
                    this.vulnerable = false;
                    this.setAct('idle');
                }
                break;
            case 'recover':
                this.y += (this.highY - this.y) * dt * 3;
                if (this.t > 0.9) this.setAct('idle');
                break;
            case 'transition':
                this.y += (this.highY - this.y) * dt * 3;
                if (this.t > 2.2) {
                    this.step = 0;
                    this.setAct('idle');
                }
                break;
        }
    }

    placeSigil() {
        const spots = this.arena.sigils;
        const spot = spots[this.step % spots.length];
        const mesh = E.makeSigil();
        mesh.position.set(spot.x, spot.y, 0.4);
        this.game.view.root.add(mesh);
        this.sigil = { x: spot.x, y: spot.y, mesh };
        Sfx.tell();
    }

    dyingPoint() {
        return { x: this.x, y: this.y + 1.8 };
    }

    sync(t, dt) {
        super.sync(t, dt);
        const { handL, handR } = this.mesh.userData;
        [handL, handR].forEach((m, i) => {
            const h = this.hands[i];
            m.position.set(h.x - this.x, h.y - this.y, 0);
        });
        if (this.sigil) this.sigil.mesh.rotation.z = t * 2;
    }
}

export function createBoss(game, id) {
    if (id === 'boss1') return new RamBoss(game);
    if (id === 'boss2') return new StormBoss(game);
    return new ColossusBoss(game);
}
