import * as E from './entities.js';
import { Shot, Strike, overlap } from './hazards.js';
import { Sfx } from './audio.js';
import { PH, PW } from './config.js';

const INTRO_TIME = 2.8;
const DYING_TIME = 2.6;

export class Boss {
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
