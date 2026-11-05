import { Boss } from './bosses.js';
import * as E from './entities.js';
import { Mover, Shot, overlap } from './hazards.js';
import { Sfx } from './audio.js';
import { PH, PLAYER_HP, PW } from './config.js';

const WINDOW = [3.6, 3.2, 2.9];
const ORB_SPEED = [5.5, 6.4, 7.2];
const ORB_TURN = [1.5, 1.8, 2.1];
const ORB_LIFE = 6.5;
const ORB_FUSE = 0.9;
const ORB_RADIUS = 2.3;
const ORB_RETURN = 21;
const WIND = [4.5, 5.5, 6.5];
const IDLE = [1.0, 0.85, 0.7];
const ROD_CHARGE = 8;
const RALLIES = [0, 1, 1];
const RALLY_SPEED = [0, 11, 13];
const RALLY_LIFE = 3.2;
const PLATE_COUNT = 5;

const ROTATION = [
    ['orb', 'plates', 'gust'],
    ['ambush', 'orb', 'plates', 'ambush', 'gust'],
    ['master', 'ambush', 'orb', 'gust', 'plates', 'master', 'orb']
];

const CUES = [
    'Golpeie a esfera de raio para devolvê-la ao Olho.',
    'Ele caça das nuvens: a nuvem que brilha esconde o Olho. Acerte-o quando ele cravar no chão.',
    'Escuridão. Rompa o véu duplo: devolva esferas ou carregue um para-raios antes do Raio Mestre.'
];

class StormOrb {
    constructor(game, boss, x, y, phase) {
        Object.assign(this, { game, boss, x, y, state: 'seek', life: ORB_LIFE, done: false, breakable: false, color: 0xbfe0ff });
        this.speed = ORB_SPEED[phase];
        this.turn = ORB_TURN[phase];
        this.rally = RALLIES[phase];
        this.phase = phase;
        const p = game.player;
        this.angle = Math.atan2(p.y + PH / 2 - y, p.x - x);
        this.mesh = E.makeStormOrb();
        this.mesh.position.set(x, y, 0.4);
        game.view.root.add(this.mesh);
    }

    deflect() {
        if (this.state !== 'seek') return;
        this.state = 'return';
        E.setOrbReturning(this.mesh);
        this.mesh.userData.blast.visible = false;
        this.game.hitstop(0.05);
        this.game.view.emit(this.x, this.y, 0xfff2b0, 22, 7, 0.5);
        Sfx.orbReflect();
    }

    update(game, dt, p) {
        const m = this.mesh;
        m.rotation.z += dt * 3;
        if (this.state === 'return') {
            const c = this.boss.dyingPoint();
            const dx = c.x - this.x;
            const dy = c.y - this.y;
            const d = Math.hypot(dx, dy) || 1;
            this.x += (dx / d) * ORB_RETURN * dt;
            this.y += (dy / d) * ORB_RETURN * dt;
            m.position.set(this.x, this.y, 0.4);
            if (Math.random() < dt * 60) game.view.emit(this.x, this.y, 0xffd23f, 1, 1.5, 0.3);
            if (d < 1.5) {
                if (this.rally > 0) this.volley(game, p);
                else {
                    this.done = true;
                    this.boss.onOrbReturn();
                }
            }
            return;
        }
        this.life -= dt;
        if (this.life > ORB_FUSE) {
            const want = Math.atan2(p.y + PH / 2 - this.y, p.x - this.x);
            let diff = want - this.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.angle += Math.max(-this.turn * dt, Math.min(this.turn * dt, diff));
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += Math.sin(this.angle) * this.speed * dt;
            this.y = Math.max(this.boss.floor + 0.7, this.y);
        } else {
            const blast = m.userData.blast;
            blast.visible = Math.floor(this.life * 14) % 2 === 0 || this.life < 0.2;
            blast.scale.setScalar(ORB_RADIUS);
            blast.rotation.z = -m.rotation.z;
            if (this.life <= 0) {
                this.explode(game, p);
                return;
            }
        }
        m.position.set(this.x, this.y, 0.4);
        if (!overlap(p.x, p.y + PH / 2, PW * 0.9, PH * 0.95, this.x, this.y, 1.1, 1.1)) return;
        if (game.attackKind(p, this.y - 0.2)) {
            this.deflect();
            if (p.vy < 0 && p.dashTimer <= 0) {
                p.vy = 11;
                p.jumping = true;
            }
            p.dashes = game.maxDashes();
            return;
        }
        game.hurtPlayer(1, this.x);
        if (this.state === 'seek') this.burst(game);
    }

    volley(game, p) {
        this.rally--;
        this.state = 'seek';
        this.speed = RALLY_SPEED[this.phase];
        this.turn = 2.6;
        this.life = RALLY_LIFE;
        this.angle = Math.atan2(p.y + PH / 2 - this.y, p.x - this.x);
        E.setOrbVolley(this.mesh);
        game.view.emit(this.x, this.y, 0xff8a6b, 24, 8, 0.5);
        game.shake(0.35);
        game.bossStatus('Ele rebateu! Devolva de novo!', true);
        Sfx.orbBlast();
    }

    explode(game, p) {
        this.burst(game);
        game.shake(0.45);
        if (Math.hypot(p.x - this.x, p.y + PH / 2 - this.y) < ORB_RADIUS) game.hurtPlayer(1, this.x);
    }

    burst(game) {
        this.done = true;
        game.view.emit(this.x, this.y, 0xbfe0ff, 26, 8, 0.5);
        game.view.flash(0.25);
        Sfx.orbBlast();
    }

    dispose(game) {
        game.view.root.remove(this.mesh);
    }
}

class SwitchedMover {
    constructor(def, game) {
        this.mover = new Mover(def, game.view.root);
        this.mover.active = false;
        this.mover.mesh.visible = false;
        game.world.solids.push(this.mover);
        this.on = false;
    }

    enable(on) {
        this.on = on;
        this.mover.active = on;
        this.mover.mesh.visible = on;
    }

    update(game, dt, p) {
        if (this.on) this.mover.update(game, dt, p);
    }

    sync(t) {
        this.mover.sync(t);
    }
}

export class StormBoss extends Boss {
    constructor(game) {
        const a = game.level.arena;
        super(game, { x: (a.x1 + a.x2) / 2, y: a.floor + 13 }, {
            hp: 6, thresholds: [4, 2], name: 'Olho da Tempestade', title: 'Aethos, o Observador', w: 3.4, h: 3.4
        });
        this.theme = 'boss2';
        this.highY = this.y;
        this.windForce = 0;
        this.windDir = 1;
        this.hidden = false;
        this.charging = 0;
        this.shroud = 1;
        this.campX = 0;
        this.campT = 0;
        this.sinceOrb = 1;
        this.repelCool = 0;
        this.plateCool = 0;
        this.adaptive = [];
        this.aim = E.makeAimLine(0xfff2b0);
        game.view.root.add(this.aim);
        this.clouds = a.nests.map(n => {
            const mesh = E.makeStormCloud();
            mesh.position.set(n.x, n.y, -0.2);
            mesh.visible = false;
            game.view.root.add(mesh);
            return { x: n.x, y: n.y, mesh, role: null };
        });
        const plateW = (a.x2 - a.x1) / PLATE_COUNT;
        this.plates = Array.from({ length: PLATE_COUNT }, (_, i) => {
            const mesh = E.makeStormPlate(plateW);
            mesh.position.set(a.x1 + plateW * (i + 0.5), a.floor, 0.25);
            game.view.root.add(mesh);
            return { x: a.x1 + plateW * i, w: plateW, mesh };
        });
        this.rods = a.rods.map(r => {
            const mesh = E.makeStormRod();
            mesh.position.set(r.x, r.y, 0.1);
            mesh.visible = false;
            game.view.root.add(mesh);
            return { x: r.x, y: r.y, mesh, charge: 0, up: false };
        });
        this.lifts = a.lifts.map(def => {
            const lift = new SwitchedMover(def, game);
            game.bossHazards.push(lift);
            return lift;
        });
        game.bossHazards.push({ update: (g, dt) => this.updateProps(dt), sync: t => this.syncProps(t) });
    }

    buildMesh() {
        return E.makeStormBoss();
    }

    setAct(act) {
        super.setAct(act);
        this.fired = false;
        this.masterDone = false;
        this.charging = 0;
        if (act !== 'aim') this.aim.visible = false;
    }

    eyeOpen() {
        if (this.vulnerable) return 1;
        if (this.charging > 0 || this.act === 'lodged' || this.act === 'aim') return 0.6;
        if (this.mode === 'intro') return Math.max(0, (this.modeT - 1.6) / 1.2) * 0.8;
        return 0.14;
    }

    maxShroud() {
        return this.phase >= 2 ? 2 : 1;
    }

    onIntro() {
        Sfx.thunder();
        this.game.view.flash(1);
        this.y = this.home.y + 7;
    }

    update(dt, p) {
        if (this.mode === 'intro') {
            this.y += (this.home.y - this.y) * Math.min(1, dt * 1.6);
            const before = this.modeT;
            if (Math.floor(before * 2) !== Math.floor((before + dt) * 2)) {
                this.game.view.flash(0.5);
                Sfx.thunder();
            }
        } else if (this.mode === 'dying') {
            const ground = this.floor;
            this.y = Math.max(ground, this.y - dt * 9);
            this.x += Math.sin(this.modeT * 22) * dt * 2;
        }
        const wasFighting = this.mode === 'fight';
        super.update(dt, p);
        if (wasFighting && this.mode === 'fight' && !this.statusShown) {
            this.statusShown = true;
            this.showCue();
        }
    }

    showCue(text = CUES[this.phase]) {
        this.game.bossStatus(text, !this.vulnerable);
    }

    damage() {
        super.damage();
        if (this.mode === 'dying') {
            this.hidden = false;
            this.windForce = 0;
            this.charging = 0;
            this.aim.visible = false;
            this.game.view.setDim(1);
            this.game.bossStatus('', false);
            this.clouds.forEach(c => { c.mesh.visible = false; c.role = null; });
            return;
        }
        if (this.act === 'recover') this.showCue();
    }

    onPhaseChange() {
        this.clearAttacks();
        this.hidden = false;
        this.windForce = 0;
        this.charging = 0;
        this.aim.visible = false;
        this.step = 0;
        this.sinceOrb = 1;
        this.applyPhase();
        this.game.player.hp = Math.min(PLAYER_HP, this.game.player.hp + 1);
        this.game.view.flash(1);
        this.showCue();
        for (const lift of this.lifts) {
            if (lift.on) this.game.view.emit(lift.mover.x + 1.5, lift.mover.y, 0xbfe0ff, 20, 6, 0.7);
        }
        this.rods.forEach(r => { if (r.up) this.game.view.emit(r.x, r.y + 1, 0xffe08a, 24, 6, 0.7); });
    }

    applyPhase() {
        this.shroud = this.maxShroud();
        this.lifts.forEach(l => l.enable(this.phase >= 1));
        this.rods.forEach(r => {
            r.up = this.phase >= 2;
            r.charge = 0;
            r.mesh.visible = r.up;
        });
        this.game.view.setDim(this.phase >= 2 ? 0.34 : this.phase === 1 ? 0.72 : 1);
    }

    onRetry() {
        this.hidden = false;
        this.windForce = 0;
        this.charging = 0;
        this.aim.visible = false;
        this.y = this.home.y;
        this.sinceOrb = 1;
        this.campT = 0;
        this.clouds.forEach(c => { c.mesh.visible = false; c.role = null; });
        this.applyPhase();
        this.showCue();
    }

    clearAttacks() {
        const g = this.game;
        g.shots.forEach(s => s.dispose(g));
        g.strikes.forEach(s => s.dispose(g));
        g.shots.length = 0;
        g.strikes.length = 0;
    }

    orbCount() {
        return this.game.shots.filter(s => s instanceof StormOrb && s.state === 'seek').length;
    }

    parts() {
        const list = [];
        for (const rod of this.rods) {
            if (rod.up) list.push({ id: 'rod', rod, x: rod.x, y: rod.y + 1.2, w: 1.2, h: 2.4, deadly: false });
        }
        if (!this.hidden) {
            const harmless = this.vulnerable || this.act === 'lodged' || this.act === 'transition' || this.act === 'falling';
            list.push({ id: 'body', x: this.x, y: this.y + this.h / 2, w: this.w, h: this.h, deadly: !harmless });
        }
        return list;
    }

    onStrike(part) {
        if (part.id === 'rod') {
            if (part.rod.charge > 0) return 'none';
            part.rod.charge = ROD_CHARGE;
            Sfx.rod();
            this.game.view.emit(part.rod.x, part.rod.y + 2.3, 0xffe08a, 22, 6, 0.6);
            return 'stagger';
        }
        if (this.invuln > 0) return 'none';
        if (this.vulnerable) {
            this.damage();
            return 'hit';
        }
        if (this.act === 'lodged') {
            this.invuln = 0.4;
            this.loseShroud();
            return 'stagger';
        }
        return 'blocked';
    }

    onOrbReturn() {
        this.hidden = false;
        this.loseShroud();
    }

    loseShroud() {
        if (this.act === 'falling' || this.act === 'grounded' || !this.fighting) return;
        this.shroud = Math.max(0, this.shroud - 1);
        Sfx.shroudBreak();
        this.game.shake(0.6);
        this.game.hitstop(0.08);
        this.game.view.flash(0.6);
        this.game.view.emit(this.x, this.y + 1.7, 0xfff2b0, 40, 10, 0.8);
        if (this.shroud > 0) {
            this.game.bossStatus('O véu racha! Falta um golpe.', true);
            this.setAct('recover');
            return;
        }
        this.windForce = 0;
        this.charging = 0;
        this.aim.visible = false;
        this.hidden = false;
        this.clouds.forEach(c => { c.mesh.visible = false; c.role = null; });
        this.clearAttacks();
        this.fallV = 0;
        this.setAct('falling');
    }

    chooseAct(p) {
        const orbMax = this.phase >= 2 ? 2 : 1;
        const dist = Math.hypot(p.x - this.x, p.y + PH / 2 - this.y - 1.7);
        this.sinceOrb++;
        if (dist < 7 && this.repelCool <= 0) {
            this.adaptive.push('repel');
            return 'repel';
        }
        if (this.sinceOrb > 2 && this.orbCount() < orbMax) return 'orb';
        if (this.campT > 4 && this.plateCool <= 0) {
            this.adaptive.push('camp');
            return 'plates';
        }
        const list = ROTATION[this.phase];
        for (let i = 0; i < list.length; i++) {
            const act = list[this.step % list.length];
            this.step++;
            if (act === 'orb' && this.orbCount() >= orbMax) continue;
            return act;
        }
        return 'plates';
    }

    think(dt, p) {
        const a = this.arena;
        this.repelCool = Math.max(0, this.repelCool - dt);
        this.plateCool = Math.max(0, this.plateCool - dt);
        if (Math.abs(p.x - this.campX) > 4) {
            this.campX = p.x;
            this.campT = 0;
        } else this.campT += dt;
        this.applyWind(dt, p);
        switch (this.act) {
            case 'idle':
                this.hover(dt, p, 0.9);
                if (this.t > IDLE[this.phase]) {
                    const next = this.chooseAct(p);
                    if (next === 'orb') this.sinceOrb = 0;
                    this.setAct(next);
                }
                break;
            case 'orb':
                this.hover(dt, p, 0.4);
                this.charging = Math.min(1, this.t);
                if (this.t < dt * 1.5) Sfx.orbCharge();
                if (this.t >= 1 && !this.fired) {
                    this.fired = true;
                    this.fireOrb();
                }
                if (this.phase >= 2 && this.t >= 1.5 && this.fired === true) {
                    this.fired = 'twice';
                    this.fireOrb();
                }
                if (this.t >= (this.phase >= 2 ? 1.7 : 1.2)) {
                    this.fired = false;
                    this.charging = 0;
                    this.setAct('idle');
                }
                break;
            case 'plates':
                this.hover(dt, p, 0.5);
                if (this.t < dt * 1.5) this.firePlates(p);
                if (this.t > 2.1 + (this.phase >= 1 ? 1.1 : 0) + (this.phase >= 2 ? 1.1 : 0)) this.setAct('idle');
                break;
            case 'gust':
                this.hover(dt, p, 0.5);
                if (this.t < dt * 1.5) {
                    this.windDir = p.x > this.center ? 1 : -1;
                    Sfx.gust();
                    this.game.bossStatus('O vento empurra contra a parede eletrificada!', !this.vulnerable);
                    const edge = this.windDir > 0 ? a.x2 - 1.8 : a.x1;
                    this.strike(edge, a.floor, 1.8, a.ceil - a.floor, 0.85, 2.3, 0xbfe0ff, () => { Sfx.thunder(); this.game.view.flash(0.4); });
                }
                this.windForce = this.t > 0.7 && this.t < 3.05 ? this.windDir * WIND[this.phase] : 0;
                if (this.t > 3.2) {
                    this.windForce = 0;
                    this.showCue();
                    this.setAct('idle');
                }
                break;
            case 'repel':
                if (this.t < dt * 1.5) Sfx.tell();
                this.game.view.emit(this.x, this.y + 1.7, 0xcfe6ff, 1, 5, 0.3);
                if (this.t > 0.45) {
                    this.repelCool = 7;
                    this.repelBlast(p);
                    this.blinkAway(p);
                    this.setAct('idle');
                }
                break;
            case 'ambush':
                this.updateAmbush(dt, p);
                break;
            case 'aim': {
                const lock = this.phase >= 2 ? 0.2 : 0.28;
                if (this.t < lock) {
                    this.diveTx = p.x;
                    this.diveTy = p.y + PH / 2;
                }
                const cy = this.y + 1.7;
                const dx = this.diveTx - this.x;
                const dy = this.diveTy - cy;
                const k = 40 / (Math.hypot(dx, dy) || 1);
                E.setAimLine(this.aim, this.x, cy, this.x + dx * k, cy + dy * k, this.t > lock ? 1.6 : 1);
                if (this.t > lock + 0.32) {
                    this.aim.visible = false;
                    const len = Math.hypot(dx, dy) || 1;
                    this.diveX = dx / len;
                    this.diveY = dy / len;
                    this.mineT = 0;
                    this.mines = 0;
                    this.setAct('dive');
                    Sfx.gust();
                }
                break;
            }
            case 'dive':
                this.updateDive(dt);
                break;
            case 'lodged':
                if (this.t > 1.05) this.setAct('recover');
                break;
            case 'master':
                this.updateMaster(dt, p);
                break;
            case 'falling': {
                this.fallV += 34 * dt;
                this.y -= this.fallV * dt;
                this.x += Math.max(-4 * dt, Math.min(4 * dt, p.x - this.x));
                this.x = Math.max(a.x1 + 2, Math.min(a.x2 - 2, this.x));
                const ground = this.game.world.surfaceBelow(Math.floor(this.x), this.y + 1);
                if (this.y <= ground) {
                    this.y = ground;
                    this.clearAttacks();
                    this.vulnerable = true;
                    Sfx.pound();
                    Sfx.tell();
                    this.game.shake(0.8);
                    this.game.view.emit(this.x, this.y, 0xcfe6ff, 40, 8, 0.7);
                    this.game.bossStatus('Vulnerável! Ataque agora!', false);
                    this.setAct('grounded');
                }
                break;
            }
            case 'grounded':
                if (this.t > WINDOW[this.phase]) {
                    this.vulnerable = false;
                    this.showCue();
                    this.setAct('recover');
                }
                break;
            case 'recover':
                this.y += (this.highY - this.y) * Math.min(1, dt * 3.5);
                if (this.shroud <= 0) this.shroud = this.maxShroud();
                if (this.t > 1) this.setAct('idle');
                break;
            case 'transition':
                this.y += (this.highY + 3 - this.y) * Math.min(1, dt * 2);
                this.x += (this.center - this.x) * Math.min(1, dt * 2);
                if (Math.random() < dt * 5) {
                    this.game.view.flash(0.45);
                    this.game.view.emit(this.x, this.y + 1.7, 0xbfe0ff, 16, 12, 0.7);
                }
                if (this.t > 2.3) this.setAct('idle');
                break;
        }
    }

    hover(dt, p, speed) {
        const a = this.arena;
        const bob = Math.sin(this.modeT * 2) * 0.5;
        this.y += (this.highY + bob - this.y) * Math.min(1, dt * 3);
        const tx = Math.max(a.x1 + 4, Math.min(a.x2 - 4, p.x));
        this.x += (tx - this.x) * Math.min(1, dt * speed);
    }

    fireOrb() {
        const orb = new StormOrb(this.game, this, this.x, this.y + 1.7, this.phase);
        this.game.addShot(orb);
        Sfx.shot();
        this.game.view.emit(this.x, this.y + 1.7, 0xbfe0ff, 18, 6, 0.5);
    }

    firePlates(p) {
        const a = this.arena;
        this.plateCool = 6;
        const here = Math.max(0, Math.min(PLATE_COUNT - 1, Math.floor((p.x - a.x1) / this.plates[0].w)));
        Sfx.plateCharge();
        const wave = (mask, delay) => {
            for (let i = 0; i < PLATE_COUNT; i++) {
                if (!mask[i]) continue;
                const plate = this.plates[i];
                this.strike(plate.x + 0.2, a.floor, plate.w - 0.4, 1.7, 1.15 + delay, 0.45, 0x8fd3ff, () => {
                    Sfx.thunder();
                    this.game.view.flash(0.2);
                });
            }
        };
        if (this.phase === 0) {
            const side = here + (here < 2 ? 1 : -1);
            const mask = Array(PLATE_COUNT).fill(false);
            mask[here] = mask[side] = true;
            wave(mask, 0);
            return;
        }
        const startOdd = here % 2 === 1;
        const first = i => (i % 2 === 1) === startOdd;
        wave(Array.from({ length: PLATE_COUNT }, (_, i) => first(i)), 0);
        wave(Array.from({ length: PLATE_COUNT }, (_, i) => !first(i)), 1.1);
        if (this.phase >= 2) wave(Array.from({ length: PLATE_COUNT }, (_, i) => first(i)), 2.2);
    }

    applyWind(dt, p) {
        const drift = this.phase >= 2 && this.act !== 'transition' && this.act !== 'grounded' && this.act !== 'falling'
            ? (Math.floor(this.modeT / 7) % 2 ? 1.8 : -1.8) : 0;
        const force = this.windForce + (this.windForce ? 0 : drift);
        if (!force || p.grabbing) return;
        this.game.world.moveAxis(p, 'x', force * dt * this.game.abilities.windScale());
        if (Math.random() < dt * 40) {
            const a = this.arena;
            this.game.view.emit(force > 0 ? a.x1 : a.x2, a.floor + Math.random() * (a.ceil - a.floor), 0xcfe6ff, 1, 1, 0.5);
        }
    }

    repelBlast(p) {
        const dx = p.x - this.x;
        const dist = Math.hypot(dx, p.y - this.y);
        Sfx.gust();
        this.game.shake(0.5);
        this.game.view.emit(this.x, this.y + 1.7, 0xcfe6ff, 40, 14, 0.5);
        if (dist < 10 && !p.dead) {
            const push = this.game.abilities.windScale();
            p.vx = (dx >= 0 ? 1 : -1) * 15 * push;
            p.vy = Math.max(p.vy, 6 * push);
            p.jumping = false;
            p.grabbing = false;
            p.lock = 0.2;
        }
    }

    blinkAway(p) {
        let best = this.clouds[0];
        for (const c of this.clouds) {
            if (Math.abs(c.x - p.x) > Math.abs(best.x - p.x)) best = c;
        }
        this.game.view.emit(this.x, this.y + 1.7, 0x9fd0ff, 26, 7, 0.5);
        this.x = best.x;
        this.y = best.y;
        this.game.view.emit(this.x, this.y + 1.7, 0x9fd0ff, 26, 7, 0.5);
        Sfx.vanish();
    }

    updateAmbush(dt, p) {
        if (this.t < dt * 1.5) {
            this.hidden = true;
            Sfx.vanish();
            this.game.view.emit(this.x, this.y + 1.7, 0x9fd0ff, 40, 8, 0.6);
            const count = this.clouds.length;
            const start = this.step % count;
            const chosen = [0, 1, 2].map(i => this.clouds[(start + i * 2) % count]);
            const real = chosen[this.step % 3];
            this.realCloud = real;
            chosen.forEach(c => {
                c.role = c === real ? 'real' : 'decoy';
                c.mesh.visible = true;
                if (c.role === 'decoy') {
                    const ground = this.game.world.surfaceBelow(Math.floor(c.x), c.y - 1);
                    this.strike(c.x - 0.7, ground, 1.4, c.y - ground, 0.95, 0.25, 0xcfe6ff, () => { Sfx.thunder(); this.game.view.flash(0.25); });
                }
            });
        }
        if (this.t > 1.05) {
            const c = this.realCloud;
            this.hidden = false;
            this.x = c.x;
            this.y = c.y - 1.7;
            this.clouds.forEach(o => { o.mesh.visible = false; o.role = null; });
            Sfx.emerge();
            this.game.view.emit(this.x, this.y + 1.7, 0xfff2b0, 30, 7, 0.6);
            this.diveTx = p.x;
            this.diveTy = p.y + PH / 2;
            this.setAct('aim');
        }
    }

    updateDive(dt) {
        const a = this.arena;
        const speed = 27;
        this.x += this.diveX * speed * dt;
        this.y += this.diveY * speed * dt;
        this.mineT += speed * dt;
        if (this.phase >= 1 && this.mineT > 5 && this.mines < 3) {
            this.mineT = 0;
            this.mines++;
            this.game.addShot(new Shot(this.game, this.x, this.y + 1.7, 0, 0, { color: 0x8fd3ff, r: 0.34, solid: false, life: 5.5 }));
        }
        const ground = this.game.world.surfaceBelow(Math.floor(this.x), this.y + 1.6);
        const hitSide = this.x < a.x1 + 2 || this.x > a.x2 - 2;
        if (this.y <= ground || hitSide || this.t > 2) {
            this.x = Math.max(a.x1 + 2, Math.min(a.x2 - 2, this.x));
            this.y = Math.max(ground, this.y);
            this.game.shake(0.5);
            Sfx.pound();
            this.game.view.emit(this.x, this.y, 0xcfe6ff, 26, 7, 0.5);
            this.setAct('lodged');
        }
    }

    updateMaster(dt, p) {
        const a = this.arena;
        this.hover(dt, p, 0.3);
        this.charging = Math.min(1, this.t / 1.2);
        const lockAt = 0.85;
        if (this.t < dt * 1.5) {
            Sfx.orbCharge();
            this.game.bossStatus('Raio Mestre! Um para-raios carregado o atrai.', true);
        }
        if (this.t < lockAt) {
            E.setAimLine(this.aim, p.x, p.y + PH / 2, p.x, a.ceil, 1);
        } else if (!this.masterDone) {
            this.masterDone = true;
            this.aim.visible = false;
            const rod = this.rods.find(r => r.up && r.charge > 0);
            if (rod) {
                const top = rod.y + 2.2;
                this.strike(rod.x - 0.8, top, 1.6, a.ceil - top, 0.4, 0.3, 0xfff2b0, () => {
                    rod.charge = 0;
                    Sfx.thunder();
                    this.game.view.flash(0.8);
                    this.game.view.emit(rod.x, rod.y + 2.3, 0xfff2b0, 40, 10, 0.7);
                    if (this.fighting && this.act !== 'transition') this.loseShroud();
                });
            } else {
                this.strike(p.x - 1.2, a.floor, 2.4, a.ceil - a.floor, 0.5, 0.3, 0xffffff, () => {
                    Sfx.thunder();
                    this.game.view.flash(0.9);
                });
            }
        }
        if (this.t > 1.75 && this.act === 'master') {
            this.masterDone = false;
            this.charging = 0;
            this.showCue();
            this.setAct('idle');
        }
    }

    updateProps(dt) {
        for (const rod of this.rods) rod.charge = Math.max(0, rod.charge - dt);
    }

    syncProps(t) {
        for (const c of this.clouds) {
            if (!c.mesh.visible) continue;
            c.mesh.position.y = c.y + Math.sin(t * 2 + c.x) * 0.15;
            c.mesh.userData.gleam.visible = c.role === 'real' && Math.floor(t * 9) % 2 === 0;
        }
        for (const r of this.rods) {
            const u = r.mesh.userData;
            u.tip.material = r.charge > 0 && (r.charge > 2 || Math.floor(t * 8) % 2 === 0) ? u.tipOn : u.tipOff;
        }
    }

    dyingPoint() {
        return { x: this.x, y: this.y + 1.7 };
    }

    sync(t, dt) {
        super.sync(t, dt);
        this.mesh.visible = !this.hidden && this.mode !== 'dead';
    }
}
