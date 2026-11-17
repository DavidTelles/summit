import { Boss } from './bosses.js';
import { Shot, Telegraph, overlap } from './hazards.js';
import { Sfx } from './audio.js';
import { PH, PW } from './config.js';
import { animateBeast, makeAnchor, makeBeast, makeShadowMark, makeWeight } from './infernoArt.js';

// Besta de Carga (mini-chefe da Ponte das Correntes).
// Ela investe de uma ponta à outra da ponte. Golpear uma âncora derruba um contrapeso na ponte;
// a besta que bate no contrapeso fica atordoada e vulnerável. Bater na ponta da ponte só a enfurece.
const WEIGHT_W = 2;
const WEIGHT_H = 2.6;
const FALL_TIME = 0.45;
const DOWN_TIME = 5.5;
const RISE_TIME = 0.6;
const ANCHOR_COOLDOWN = 2.5;
const ANCHOR_LIFT = 6.2;

class Weight {
    constructor(boss, x) {
        const a = boss.arena;
        Object.assign(this, { boss, x, top: a.ceil - 3, state: 'up', t: 0, cooldown: 0 });
        this.anchor = { x, y: a.floor + ANCHOR_LIFT };
        this.solid = { x: x - WEIGHT_W / 2, y: a.floor, w: WEIGHT_W, h: WEIGHT_H, active: false };
        boss.game.world.solids.push(this.solid);
        this.y = this.top;
        this.mesh = makeWeight();
        this.anchorMesh = makeAnchor();
        this.anchorMesh.position.set(x, this.anchor.y, -0.1);
        this.shadow = makeShadowMark();
        this.shadow.position.set(x, a.floor + 0.05, 0.3);
        this.shadow.visible = false;
        const root = boss.game.view.root;
        root.add(this.mesh, this.anchorMesh, this.shadow);
        this.sync();
    }

    get ready() { return this.state === 'up' && this.cooldown <= 0; }
    get blocking() { return this.state === 'down' || (this.state === 'falling' && this.y < this.boss.floor + 2.4); }

    drop() {
        if (!this.ready) return false;
        this.state = 'falling';
        this.t = 0;
        this.shadow.visible = true;
        Sfx.clank();
        return true;
    }

    shatter() {
        const g = this.boss.game;
        g.view.emit(this.x, this.boss.floor + 1.2, 0xb8a58a, 26, 7, 0.7);
        g.shake(0.6);
        Sfx.shatter();
        this.reset(ANCHOR_COOLDOWN);
    }

    reset(cooldown = 0) {
        this.state = 'up';
        this.t = 0;
        this.y = this.top;
        this.cooldown = cooldown;
        this.solid.active = false;
        this.shadow.visible = false;
    }

    update(dt, p) {
        const floor = this.boss.floor;
        this.cooldown = Math.max(0, this.cooldown - dt);
        this.t += dt;
        if (this.state === 'falling') {
            const k = Math.min(1, this.t / FALL_TIME);
            this.y = this.top + (floor - this.top) * k * k;
            if (!p.dead && overlap(p.x, p.y + PH / 2, PW * 0.8, PH * 0.8, this.x, this.y + WEIGHT_H / 2, WEIGHT_W, WEIGHT_H)) this.boss.game.hurtPlayer(1, this.x);
            if (k >= 1) {
                this.state = 'down';
                this.t = 0;
                this.y = floor;
                this.shadow.visible = false;
                this.solid.active = !overlap(p.x, p.y + PH / 2, PW, PH, this.x, floor + WEIGHT_H / 2, WEIGHT_W, WEIGHT_H);
                this.boss.game.shake(0.4);
                this.boss.game.view.emit(this.x, floor + 0.2, 0xffb060, 16, 6, 0.5);
                Sfx.pound();
            }
        } else if (this.state === 'down') {
            if (!this.solid.active && !overlap(p.x, p.y + PH / 2, PW, PH, this.x, floor + WEIGHT_H / 2, WEIGHT_W, WEIGHT_H)) this.solid.active = true;
            if (this.t >= DOWN_TIME) {
                this.state = 'rising';
                this.t = 0;
                this.solid.active = false;
            }
        } else if (this.state === 'rising') {
            const k = Math.min(1, this.t / RISE_TIME);
            this.y = floor + (this.top - floor) * k;
            if (k >= 1) this.reset(ANCHOR_COOLDOWN);
        }
        this.sync();
    }

    sync() {
        this.mesh.position.set(this.x, this.y, -0.05);
        const u = this.anchorMesh.userData;
        u.glow.visible = this.ready;
        u.ring.rotation.z = this.ready ? 0 : Math.PI / 4;
    }

    dispose(root) {
        root.remove(this.mesh, this.anchorMesh, this.shadow);
    }
}

const PATTERNS = [
    ['charge', 'charge', 'embers'],
    ['charge', 'embers', 'rush', 'charge']
];

export class BeastBoss extends Boss {
    constructor(game) {
        const a = game.level.arena;
        super(game, { x: a.x2 - 6, y: a.floor }, {
            hp: 4, thresholds: [2], name: 'Besta de Carga', title: 'Um dia puxou as carroças do Fundo', w: 4.2, h: 2.9
        });
        const span = a.x2 - a.x1;
        this.weights = [0.24, 0.5, 0.76].map(k => new Weight(this, a.x1 + span * k));
        this.wallHits = 0;
        this.theme = 'boss_inferno';
        this.charges = 0;
    }

    buildMesh() {
        return makeBeast();
    }

    onIntro() {
        Sfx.roar();
        this.game.shake(0.6);
        this.game.storyLine('As âncoras. Se eu derrubar o peso no caminho dela...', null, 3.4);
    }

    face(p) {
        this.dir = Math.sign(p.x - this.x) || this.dir;
    }

    parts() {
        const body = { id: 'body', x: this.x, y: this.y + this.h / 2, w: this.w, h: this.h, deadly: !this.vulnerable };
        const anchors = this.weights.filter(w => w.ready).map(w => ({ id: 'anchor', weight: w, x: w.anchor.x, y: w.anchor.y, w: 1.4, h: 1.4, deadly: false }));
        return [body, ...anchors];
    }

    onStrike(part, kind) {
        if (part.id === 'anchor') return part.weight.drop() ? 'hit' : 'none';
        return super.onStrike(part, kind);
    }

    think(dt, p) {
        for (const w of this.weights) w.update(dt, p);
        const a = this.arena;
        const rage = this.phase > 0;
        switch (this.act) {
            case 'idle':
                this.vulnerable = false;
                this.face(p);
                if (this.t > (rage ? 0.6 : 0.9)) {
                    const next = this.nextAct(PATTERNS);
                    if (next === 'charge' || next === 'rush') this.beginPaw(next === 'rush' ? 2 : 1);
                }
                break;
            case 'paw':
                if (this.t > (rage ? 0.75 : 1.0)) this.setAct('charge');
                break;
            case 'charge': {
                const speed = rage ? 18 : 15;
                this.x += this.dir * speed * dt;
                if (Math.random() < dt * 30) this.game.view.emit(this.x - this.dir * 1.6, this.y + 0.1, 0x8a6a5a, 1, 2, 0.35);
                const hit = this.weights.find(w => w.blocking && Math.abs(w.x - (this.x + this.dir * this.w / 2)) < WEIGHT_W / 2 + 0.2);
                if (hit) {
                    this.x = hit.x - this.dir * (this.w / 2 + WEIGHT_W / 2 + 0.05);
                    hit.shatter();
                    Sfx.roar();
                    this.vulnerable = true;
                    this.setAct('stunned');
                    break;
                }
                const limit = this.dir > 0 ? a.x2 - this.w / 2 : a.x1 + this.w / 2;
                if ((limit - this.x) * this.dir <= 0) {
                    this.x = limit;
                    this.slamWall();
                }
                break;
            }
            case 'slam':
                if (this.t > 0.5) {
                    this.dir = -this.dir;
                    if (this.charges > 1) {
                        this.charges--;
                        this.beginPaw(this.charges, 0.45);
                    } else this.setAct('idle');
                }
                break;
            case 'stunned':
                if (this.t > (rage ? 2.3 : 2.9)) {
                    this.vulnerable = false;
                    this.setAct('idle');
                }
                break;
            case 'embers':
                if (this.t < dt * 1.5) this.spitEmbers(rage ? 5 : 3);
                if (this.t > 1.2) this.setAct('idle');
                break;
            case 'recover':
                this.face(p);
                if (this.t < 0.5) this.x = Math.max(a.x1 + this.w / 2, Math.min(a.x2 - this.w / 2, this.x - this.dir * 6 * dt));
                if (this.t > 0.9) this.setAct('idle');
                break;
            case 'transition':
                if (this.t < dt * 1.5) {
                    this.game.view.flash(0.6);
                    this.spitEmbers(6);
                }
                if (this.t > 1.6) this.setAct('idle');
                break;
        }
    }

    beginPaw(charges, warn) {
        this.charges = charges;
        this.setAct('paw');
        if (warn !== undefined) this.t = (this.phase > 0 ? 0.75 : 1.0) - warn;
        const a = this.arena;
        const from = this.x + this.dir * this.w / 2;
        const to = this.dir > 0 ? a.x2 : a.x1;
        const x = Math.min(from, to);
        const remaining = (this.phase > 0 ? 0.75 : 1.0) - this.t;
        this.game.addStrike(new Telegraph(this.game, x, a.floor, Math.abs(to - from), 0.3, remaining + 0.2));
        Sfx.roar();
    }

    // Bater na ponta da ponte é a punição por não usar os contrapesos: tremor e pedras caindo.
    slamWall() {
        const a = this.arena;
        this.wallHits++;
        this.game.shake(0.8);
        Sfx.pound();
        this.setAct('slam');
        const count = this.phase > 0 ? 5 : 3;
        for (let i = 0; i < count; i++) {
            const x = a.x1 + 3 + ((i * 11 + this.wallHits * 7) % (a.x2 - a.x1 - 6));
            this.strike(x, a.floor, 1.6, a.ceil - a.floor, 0.9 + i * 0.12, 0.22, 0xc97a4b, () => Sfx.stomp());
        }
    }

    spitEmbers(count) {
        Sfx.roar();
        const p = this.game.player;
        for (let i = 0; i < count; i++) {
            const spread = (i - (count - 1) / 2) * 2.2;
            const dx = p.x + spread - this.x;
            const t = 1.1;
            this.game.addShot(new Shot(this.game, this.x + this.dir * 1.8, this.y + 2.4, dx / t, 9, {
                r: 0.32, gravity: 2 * (9 * t + (this.y + 2.4 - this.floor)) / (t * t), color: 0xff7a2a, life: 2.4
            }));
        }
    }

    featEarned() {
        return this.wallHits === 0 ? 'beast_clean' : null;
    }

    onRetry() {
        this.y = this.floor;
        this.charges = 0;
        this.weights.forEach(w => w.reset());
    }

    sync(t) {
        if (!this.fighting && this.mode !== 'intro') this.weights.forEach(w => { if (w.state !== 'up') w.reset(); });
        this.mesh.position.set(this.x, this.y, 0);
        animateBeast(this.mesh, this, t);
    }

    dispose() {
        this.weights.forEach(w => w.dispose(this.game.view.root));
    }
}
