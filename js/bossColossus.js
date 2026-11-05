import { Boss } from './bosses.js';
import { Enemy } from './enemies.js';
import * as E from './entities.js';
import { Lava, Mover, Shot, overlap } from './hazards.js';
import { Sfx } from './audio.js';
import { PH, PLAYER_HP, PW } from './config.js';

const WINDOW = [3.6, 4.0, 3.4];
const IDLE = [0.85, 0.7, 0.55];
const PYLON_TIMER = 15;
const SEAL_TIME = 18;
const FEED_EVERY = 10;
const HEAT_MAX = 5;
const VENT_REGROW = 9;
const LAVA_LOW = -3;
const LAVA_MID = -1.5;
const LAVA_HIGH = 3;

const ROTATION = [
    ['slam', 'sweep', 'slam', 'boulder'],
    ['beam', 'slam', 'sweep', 'boulder', 'slam'],
    ['slam', 'erupt', 'boulder', 'slam', 'nova']
];

const CUES = [
    'Escudo de magma: destrua os 3 pilares antes que eles renasçam.',
    'Mate os guardas e marque os 2 selos para acorrentar o Guardião. Não deixe os carregadores alcançá-lo.',
    'A lava sobe! O calor o abre: sobreviva e quebre as válvulas para superaquecê-lo.'
];

class Magmite extends Enemy {
    constructor(boss, kind, x, y) {
        super({ x, y }, boss.game.view.root, () => E.makeMagmite(kind), {
            w: 1, h: 1, color: kind === 'feeder' ? 0x7dffa8 : 0xff8a3c
        });
        this.boss = boss;
        this.kind = kind;
        this.spit = 2 + (x % 1.5);
        this.dir = 1;
    }

    update(game, dt, p) {
        if (this.kind === 'feeder') {
            const target = this.boss.center;
            this.dir = Math.sign(target - this.x) || 1;
            this.x += this.dir * 2 * dt;
            this.y = this.oy + Math.sin(game.clock * 5) * 0.2;
            if (Math.abs(target - this.x) < 0.3) this.boss.onFed(this);
            return;
        }
        this.dir = Math.sign(p.x - this.x) || this.dir;
        const near = Math.hypot(p.x - this.x, p.y - this.y) < 11;
        if (!near) return;
        this.spit -= dt;
        if (this.spit < 0) {
            this.spit = 2.6;
            game.addShot(new Shot(game, this.x + this.dir * 0.6, this.y + 0.6, this.dir * 6, 0, { color: 0xff8a3c, r: 0.26, solid: true, life: 2.6 }));
            Sfx.shot();
        }
    }

    die(game) {
        super.die(game);
        this.boss.onMinionDead(this);
    }

    sync(t, dt) {
        super.sync(t, dt);
        const swell = this.kind === 'guard' && this.spit < 0.5 ? 1 + (0.5 - this.spit) * 0.6 : 1;
        this.mesh.userData.magmite.scale.setScalar(swell);
    }
}

class Stage {
    constructor(boss) {
        this.boss = boss;
    }

    update(game, dt, p) {
        const b = this.boss;
        const lava = b.lava;
        if (lava.level < b.lavaTarget) lava.level = Math.min(b.lavaTarget, lava.level + dt * b.lavaRate);
        else lava.level = Math.max(b.lavaTarget, lava.level - dt * (b.mode === 'fight' ? 3 : 9));
        if (b.mode === 'fight') lava.update(game, dt, p);
        for (const slab of b.slabs) b.updateSlab(slab, dt, p);
        for (const lift of b.lifts) if (lift.on) lift.update(game, dt, p);
    }

    sync(t) {
        const b = this.boss;
        b.lava.sync(t);
        for (const lift of b.lifts) if (lift.on) lift.sync(t);
    }
}

export class ColossusBoss extends Boss {
    constructor(game) {
        const a = game.level.arena;
        super(game, { x: (a.x1 + a.x2) / 2, y: a.floor + 13 }, {
            hp: 6, thresholds: [4, 2], name: 'Guardião do Cume', title: 'A própria montanha se levanta', w: 4, h: 3.6
        });
        this.theme = 'boss3';
        this.highY = this.y;
        this.hands = [
            { x: this.x - 8, y: a.floor + 8, restX: this.x - 8, state: 'rest', t: 0 },
            { x: this.x + 8, y: a.floor + 8, restX: this.x + 8, state: 'rest', t: 0 }
        ];
        this.activeHand = 0;
        this.lava = new Lava({ y: a.floor + LAVA_LOW, x1: a.x1, x2: a.x2 }, game.view.root, game.grid.w);
        this.lavaTarget = a.floor + LAVA_LOW;
        this.lavaRate = 1;
        this.shielded = true;
        this.heat = 0;
        this.novaR = 0;
        this.campX = 0;
        this.campT = 0;
        this.novaCool = 0;
        this.campCool = 0;
        this.cycle = 0;
        this.adaptive = [];
        this.pylonClock = 0;
        this.feedT = FEED_EVERY;
        this.safeMarks = [];
        this.beamLine = E.makeAimLine(0xff5a3c);
        game.view.root.add(this.beamLine);
        this.slabs = a.slabs.map(def => this.buildSlab(def));
        this.pylons = a.pylons.map(def => {
            const mesh = E.makeMagmaPylon();
            mesh.visible = false;
            game.view.root.add(mesh);
            return { x: def.x, y: def.y, spots: def.spots, mesh, up: false, regrow: 0 };
        });
        this.pads = a.pads.map(def => {
            const mesh = E.makeSealPad();
            mesh.position.set(def.x, def.y, 0.3);
            mesh.visible = false;
            game.view.root.add(mesh);
            const chain = E.makeAimLine(0x7dffa8);
            game.view.root.add(chain);
            return { x: def.x, y: def.y, mesh, chain, on: false, sealed: 0, guard: null };
        });
        this.lifts = a.lifts.map(def => {
            const lift = new Mover(def, game.view.root);
            lift.active = false;
            lift.on = false;
            lift.mesh.visible = false;
            game.world.solids.push(lift);
            return lift;
        });
        this.minions = [];
        this.stage = new Stage(this);
        game.bossHazards.push(this.stage);
        this.setPylons();
    }

    buildMesh() {
        return E.makeColossus();
    }

    buildSlab(def) {
        const mesh = E.makeBossSlab(def.w, def.h);
        mesh.position.set(def.x + def.w / 2, def.y + def.h / 2, 0);
        this.game.view.root.add(mesh);
        const slab = { ...def, active: true, state: 'solid', timer: 0, regrow: 0, mesh };
        this.game.world.solids.push(slab);
        return slab;
    }

    onIntro() {
        Sfx.roar();
        this.game.shake(0.9);
        this.y = this.floor - 3;
        this.hands.forEach(h => { h.y = this.floor - 3; });
    }

    update(dt, p) {
        if (this.mode === 'intro') {
            const k = Math.min(1, dt * 1.5);
            this.y += (this.home.y - this.y) * k;
            this.hands.forEach(h => { h.y += (this.floor + 8 - h.y) * k; });
            if (Math.random() < dt * 20) this.game.view.emit(this.x + (Math.random() - 0.5) * 16, this.floor, 0xffa050, 6, 8, 0.8);
        } else if (this.mode === 'dying') {
            this.y -= dt * 2.5;
            this.hands.forEach(h => { h.y -= dt * 7; });
        }
        const wasFighting = this.mode === 'fight';
        super.update(dt, p);
        if (wasFighting && this.mode === 'fight' && !this.statusShown) {
            this.statusShown = true;
            this.showCue();
        }
    }

    showCue(text = CUES[this.phase]) {
        this.game.bossStatus(text, this.shielded && !this.vulnerable);
    }

    damage() {
        super.damage();
        if (this.mode === 'dying') {
            this.onDying();
            return;
        }
        if (this.act === 'recover') this.resetCycle();
    }

    onDying() {
        this.endBeam();
        this.novaR = 0;
        this.clearMinions();
        this.pylons.forEach(py => { py.up = false; py.mesh.visible = false; });
        this.pads.forEach(pad => { pad.on = false; pad.sealed = 0; pad.mesh.visible = false; pad.chain.visible = false; });
        this.lavaTarget = this.floor + LAVA_LOW;
        this.game.bossStatus('', false);
        this.settleArena();
    }

    settleArena() {
        const p = this.game.player;
        for (const slab of this.slabs) {
            slab.state = 'solid';
            slab.active = true;
            slab.mesh.visible = true;
            E.setSlabHot(slab.mesh, false);
            slab.mesh.position.x = slab.x + slab.w / 2;
            if (overlap(p.x, p.y + PH / 2, PW, PH, slab.x + slab.w / 2, slab.y + slab.h / 2, slab.w, slab.h)) {
                p.y = slab.y + slab.h;
                p.vy = 0;
            }
        }
        if (p.y < this.floor && p.x > this.arena.x1 && p.x < this.arena.x2) {
            p.y = this.floor;
            p.vy = 0;
        }
    }

    onPhaseChange() {
        this.clearAttacks();
        this.endBeam();
        this.novaR = 0;
        this.hands.forEach(h => { h.state = 'rest'; h.t = 0; });
        this.step = 0;
        this.cycle = 0;
        this.game.view.flash(0.9);
        this.game.player.hp = Math.min(PLAYER_HP, this.game.player.hp + 1);
        this.applyPhase(false);
        this.showCue();
        Sfx.crack();
    }

    applyPhase(snap) {
        const floorSlabs = this.slabs.filter(s => s.kind === 'floor');
        this.heat = 0;
        this.shielded = true;
        this.feedT = FEED_EVERY;
        this.clearMinions();
        if (this.phase === 0) {
            this.lavaTarget = this.floor + LAVA_LOW;
            this.lavaRate = 1;
            this.setPylons();
            this.pads.forEach(pad => this.setPad(pad, false));
        } else if (this.phase === 1) {
            this.lavaTarget = this.floor + LAVA_MID;
            this.lavaRate = 1;
            this.setPylons(true);
            floorSlabs.forEach((s, i) => {
                if (snap) this.restoreSlab(s);
                if (i % 2 === 1) this.breakSlab(s, snap ? 0 : 1.4, 0);
            });
            this.pads.forEach(pad => this.setPad(pad, true));
        } else {
            this.lavaTarget = this.floor + LAVA_HIGH;
            this.lavaRate = 0.75;
            this.setPylons();
            floorSlabs.forEach(s => this.breakSlab(s, snap ? 0 : 1.6, 0));
            this.slabs.filter(s => s.kind === 'ledge').forEach(s => { if (snap) this.restoreSlab(s); });
            this.pads.forEach(pad => this.setPad(pad, false));
            this.lifts.forEach(lift => {
                lift.on = true;
                lift.active = true;
                lift.mesh.visible = true;
            });
        }
        if (snap) this.lava.level = this.lavaTarget;
    }

    onRetry() {
        this.clearMinions();
        this.endBeam();
        this.novaR = 0;
        this.y = this.highY;
        this.hands.forEach(h => { h.state = 'rest'; h.t = 0; h.x = h.restX; h.y = this.floor + 8; });
        this.cycle = 0;
        this.campT = 0;
        this.applyPhase(true);
        if (this.phase === 2) {
            const safe = this.arena.safe;
            this.game.player.x = safe.x;
            this.game.player.y = safe.y;
        }
        this.showCue();
    }

    setPylons(hideAll = false) {
        const spots = this.phase === 2 ? 'vents' : this.cycle % 2 ? 'high' : 'low';
        this.pylonClock = 0;
        for (const py of this.pylons) {
            const spot = py.spots[spots];
            py.up = !hideAll && this.phase !== 1 && !!spot;
            py.regrow = 0;
            py.mesh.visible = py.up;
            if (spot) {
                py.x = spot.x;
                py.y = spot.y;
                py.mesh.position.set(spot.x, spot.y, 0.25);
            }
        }
    }

    setPad(pad, on) {
        pad.on = on;
        pad.sealed = 0;
        pad.mesh.visible = on;
        pad.chain.visible = false;
        if (pad.guard) pad.guard = null;
        if (on) this.spawnGuard(pad);
    }

    spawnGuard(pad) {
        const guard = new Magmite(this, 'guard', pad.x, pad.y);
        pad.guard = guard;
        guard.pad = pad;
        this.minions.push(guard);
        this.game.enemies.push(guard);
        this.game.view.emit(pad.x, pad.y + 0.5, 0xff8a3c, 18, 5, 0.5);
    }

    spawnFeeder() {
        const a = this.arena;
        const side = this.game.player.x > this.center ? a.x1 + 3 : a.x2 - 3;
        const feeder = new Magmite(this, 'feeder', side, a.floor + 1.2);
        this.minions.push(feeder);
        this.game.enemies.push(feeder);
        this.game.bossStatus('Carregador de magma: detenha-o antes que alcance o centro!', true);
        Sfx.tell();
    }

    onMinionDead(m) {
        if (m.pad) m.pad.guard = null;
    }

    onFed(feeder) {
        feeder.alive = false;
        feeder.mesh.visible = false;
        this.game.view.emit(feeder.x, feeder.y, 0x7dffa8, 30, 8, 0.8);
        Sfx.vent();
        const pad = this.pads.find(q => q.sealed > 0);
        if (pad) {
            pad.sealed = 0;
            pad.chain.visible = false;
            if (!pad.guard) this.spawnGuard(pad);
            this.game.bossStatus('O carregador reabriu um selo!', true);
        }
    }

    clearMinions() {
        const g = this.game;
        for (const m of this.minions) {
            m.alive = false;
            g.view.root.remove(m.mesh);
        }
        g.enemies = g.enemies.filter(e => !this.minions.includes(e));
        this.minions = [];
        this.pads.forEach(pad => { pad.guard = null; });
    }

    clearAttacks() {
        const g = this.game;
        g.shots.forEach(s => s.dispose(g));
        g.strikes.forEach(s => s.dispose(g));
        g.shots.length = 0;
        g.strikes.length = 0;
    }

    resetCycle() {
        this.cycle++;
        this.heat = 0;
        this.shielded = true;
        this.feedT = FEED_EVERY;
        if (this.phase !== 1) this.setPylons();
        for (const pad of this.pads) {
            if (!pad.on) continue;
            pad.sealed = 0;
            pad.chain.visible = false;
            if (!pad.guard) this.spawnGuard(pad);
        }
        this.showCue();
    }

    expose(text) {
        this.clearAttacks();
        this.endBeam();
        this.novaR = 0;
        this.clearFeeders();
        this.hands.forEach(h => { h.state = 'rest'; h.t = 0; });
        this.shielded = false;
        this.game.shake(0.8);
        this.game.view.flash(0.6);
        this.game.bossStatus(text, false);
        this.setAct('exposing');
    }

    clearFeeders() {
        for (const m of this.minions) {
            if (m.kind === 'feeder' && m.alive) {
                m.alive = false;
                m.mesh.visible = false;
            }
        }
    }

    parts() {
        const list = [];
        for (const py of this.pylons) {
            if (py.up) list.push({ id: 'pylon', pylon: py, x: py.x, y: py.y + 1.1, w: 1.6, h: 2.2, deadly: false });
        }
        for (const pad of this.pads) {
            if (pad.on && !pad.sealed && !(pad.guard && pad.guard.alive)) list.push({ id: 'pad', pad, x: pad.x, y: pad.y + 0.7, w: 2.4, h: 1.4, deadly: false });
        }
        for (const h of this.hands) {
            const deadly = h.state === 'falling' || h.state === 'sweep';
            if (deadly || h.state === 'stuck') list.push({ id: 'hand', hand: h, x: h.x, y: h.y + 0.9, w: 3, h: 1.8, deadly });
        }
        list.push({ id: 'head', x: this.x, y: this.y + this.h / 2, w: this.w, h: this.h, deadly: false });
        return list;
    }

    onStrike(part, kind) {
        if (part.id === 'pylon') return this.breakPylon(part.pylon);
        if (part.id === 'pad') return kind === 'ability' ? 'none' : this.markPad(part.pad);
        if (this.invuln > 0) return 'none';
        if (part.id === 'hand') {
            if (part.hand.state !== 'stuck') return 'blocked';
            part.hand.state = 'rest';
            part.hand.t = 0;
            this.invuln = 0.3;
            Sfx.bossHit();
            this.game.hitstop(0.1);
            this.game.shake(0.5);
            if (this.phase === 2) this.addHeat(1);
            if (this.act === 'idle' || this.act === 'slam') this.setAct('staggered');
            return 'stagger';
        }
        if (!this.vulnerable) return 'blocked';
        this.damage();
        return 'hit';
    }

    breakPylon(py) {
        if (!py.up) return 'none';
        py.up = false;
        py.mesh.visible = false;
        Sfx.shatter();
        Sfx.vent();
        this.game.shake(0.45);
        this.game.view.emit(py.x, py.y + 1.2, 0xff8a3c, 30, 7, 0.7);
        if (this.phase === 2) {
            py.regrow = VENT_REGROW;
            this.addHeat(2);
            return 'stagger';
        }
        if (this.pylons.every(q => !q.up)) {
            this.expose('O escudo caiu! Ataque a cabeça!');
        } else {
            if (this.pylonClock <= 0) this.pylonClock = PYLON_TIMER;
            const left = this.pylons.filter(q => q.up).length;
            this.game.bossStatus(`Pilares restantes: ${left}. Eles renascem em ${PYLON_TIMER} s!`, true);
            this.adaptive.push('guard-pylon');
            if (this.act === 'idle' || this.act === 'staggered') this.setAct('slam');
        }
        return 'stagger';
    }

    markPad(pad) {
        if (pad.sealed || (pad.guard && pad.guard.alive)) return 'none';
        pad.sealed = SEAL_TIME;
        Sfx.seal();
        this.game.view.emit(pad.x, pad.y + 0.5, 0x7dffa8, 26, 6, 0.6);
        if (this.pads.every(q => !q.on || q.sealed)) this.expose('Acorrentado! Ataque a cabeça!');
        else this.game.bossStatus('Selo marcado! Marque o outro antes que ele expire.', true);
        return 'stagger';
    }

    addHeat(n) {
        if (this.phase !== 2) return;
        this.heat = Math.min(HEAT_MAX, this.heat + n);
        this.game.view.emit(this.x, this.y + 1.8, 0xffa050, 8 + this.heat * 4, 6, 0.6);
        if (this.heat >= HEAT_MAX && this.shielded) {
            Sfx.overheat();
            this.expose('Superaquecido! Suba e ataque o núcleo!');
        }
    }

    onPound(x, y) {
        for (const pad of this.pads) {
            if (pad.on && !pad.sealed && Math.abs(x - pad.x) < 2.2 && Math.abs(y - pad.y) < 1.5) this.markPad(pad);
        }
    }

    groundAt(x, fromY) {
        let top = this.game.world.surfaceBelow(Math.floor(x), fromY);
        for (const s of this.slabs) {
            if (s.active && x >= s.x && x <= s.x + s.w && s.y + s.h <= fromY) top = Math.max(top, s.y + s.h);
        }
        return Math.max(top, this.lava.level);
    }

    solidAt(x, y) {
        if (this.game.world.solid(Math.floor(x), Math.floor(y))) return true;
        return this.slabs.some(s => s.active && x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
    }

    slabUnder(x, y) {
        return this.slabs.find(s => x >= s.x && x <= s.x + s.w && Math.abs(s.y + s.h - y) < 0.3) || null;
    }

    breakSlab(slab, warn, regrow) {
        if (slab.state === 'crack' || slab.state === 'gone') {
            slab.regrow = regrow;
            return;
        }
        slab.regrow = regrow;
        slab.state = 'crack';
        slab.timer = warn;
        E.setSlabHot(slab.mesh, true);
        if (warn > 0) Sfx.crack();
    }

    restoreSlab(slab) {
        slab.state = 'solid';
        slab.active = true;
        slab.mesh.visible = true;
        slab.mesh.position.x = slab.x + slab.w / 2;
        E.setSlabHot(slab.mesh, false);
    }

    updateSlab(slab, dt, p) {
        if (slab.state === 'solid') return;
        slab.timer -= dt;
        if (slab.state === 'crack') {
            slab.mesh.position.x = slab.x + slab.w / 2 + Math.sin(slab.timer * 60) * 0.06;
            if (slab.timer <= 0) {
                slab.state = 'gone';
                slab.active = false;
                slab.mesh.visible = false;
                slab.timer = slab.regrow;
                Sfx.shatter();
                this.game.view.emit(slab.x + slab.w / 2, slab.y + slab.h, 0xc08a5b, 26, 6, 0.7);
            }
            return;
        }
        if (slab.state === 'gone') {
            if (slab.regrow > 0 && slab.timer <= 0) {
                slab.state = 'rising';
                slab.timer = 1;
                slab.mesh.visible = true;
                E.setSlabHot(slab.mesh, true);
            }
            return;
        }
        slab.mesh.visible = Math.floor(slab.timer * 12) % 2 === 0;
        if (slab.timer <= 0) {
            const inside = overlap(p.x, p.y + PH / 2, PW, PH, slab.x + slab.w / 2, slab.y + slab.h / 2, slab.w, slab.h);
            if (inside) slab.timer = 0.2;
            else this.restoreSlab(slab);
        }
    }

    updateHands(dt, p) {
        const a = this.arena;
        for (const h of this.hands) {
            h.t += dt;
            switch (h.state) {
                case 'rest':
                    h.x += (h.restX - h.x) * Math.min(1, dt * 3);
                    h.y += (a.floor + 8 + Math.sin(this.modeT * 2 + h.restX) * 0.3 - h.y) * Math.min(1, dt * 3);
                    break;
                case 'track': {
                    const drop = this.phase > 1 ? 0.8 : 1.0;
                    if (h.t < drop - 0.28) h.x += (Math.max(a.x1 + 2, Math.min(a.x2 - 2, p.x)) - h.x) * Math.min(1, dt * 5);
                    else if (Math.random() < dt * 30) this.game.view.emit(h.x, h.y, 0xffa050, 2, 4, 0.3);
                    h.y += (Math.max(a.floor + 8, p.y + 5) - h.y) * Math.min(1, dt * 6);
                    if (h.t > drop) {
                        h.state = 'falling';
                        h.t = 0;
                    }
                    break;
                }
                case 'falling': {
                    const ground = this.groundAt(h.x, h.y + 1);
                    h.y -= 26 * dt;
                    if (h.y <= ground) this.handImpact(h, ground);
                    break;
                }
                case 'stuck':
                    if (h.t > (this.phase > 1 ? 1.6 : 2.0)) {
                        h.state = 'rest';
                        h.t = 0;
                    }
                    break;
                case 'sweepTell':
                    h.x += (h.fromX - h.x) * Math.min(1, dt * 6);
                    h.y += (a.floor + 0.4 - h.y) * Math.min(1, dt * 6);
                    if (h.t > 1.05) {
                        this.beamLine.visible = false;
                        h.state = 'sweep';
                        h.t = 0;
                        Sfx.gust();
                    }
                    break;
                case 'sweep':
                    h.x += h.dir * 20 * dt;
                    h.y = a.floor + 0.4;
                    if (Math.random() < dt * 40) this.game.view.emit(h.x, a.floor + 0.3, 0xffa050, 2, 4, 0.4);
                    if ((h.dir > 0 && h.x > a.x2 - 1) || (h.dir < 0 && h.x < a.x1 + 1)) {
                        h.state = 'rest';
                        h.t = 0;
                    }
                    break;
            }
        }
    }

    handImpact(h, ground) {
        const a = this.arena;
        h.y = ground;
        h.state = 'stuck';
        h.t = 0;
        Sfx.pound();
        this.game.shake(0.7);
        this.game.view.emit(h.x, h.y, 0xd8c8a8, 24, 7, 0.6);
        for (const dir of [-1, 1]) {
            this.game.addShot(new Shot(this.game, h.x + dir * 1.2, ground + 0.8, dir * 5, 11, { color: 0xffa050, r: 0.3, gravity: 26, solid: true, life: 2.2 }));
        }
        const slab = this.slabUnder(h.x, ground);
        if (!slab || slab.state !== 'solid') return;
        const left = this.slabs.filter(s => s.kind === slab.kind && s.state === 'solid').length;
        if (this.phase === 1 && slab.kind === 'floor' && left > 2) this.breakSlab(slab, 0.9, 6);
        if (this.phase === 2 && slab.kind === 'ledge' && left > 2 && !this.pylons.some(q => q.up && q.x >= slab.x && q.x <= slab.x + slab.w)) {
            this.breakSlab(slab, 0.9, 5);
        }
        if (this.phase === 0 || slab.state === 'solid') {
            this.strike(Math.max(a.x1, h.x - 1.5), ground, 3, 0.7, 0.35, 0.9, 0xff8a3c);
        }
    }

    chooseAct(p) {
        const d = Math.hypot(p.x - this.x, p.y + PH / 2 - this.y - 1.8);
        if (d < 8.5 && this.novaCool <= 0) {
            this.adaptive.push('nova');
            return 'nova';
        }
        if (this.campT > 4.5 && this.campCool <= 0) {
            this.campCool = 8;
            this.adaptive.push('camp');
            return 'boulder';
        }
        const list = ROTATION[this.phase];
        const act = list[this.step % list.length];
        this.step++;
        return act;
    }

    think(dt, p) {
        const a = this.arena;
        this.novaCool = Math.max(0, this.novaCool - dt);
        this.campCool = Math.max(0, this.campCool - dt);
        if (Math.abs(p.x - this.campX) > 4) {
            this.campX = p.x;
            this.campT = 0;
        } else this.campT += dt;
        this.updateHands(dt, p);
        this.updateObjectives(dt);
        switch (this.act) {
            case 'idle':
                this.hover(dt, this.highY);
                if (this.t > IDLE[this.phase]) {
                    this.heat = this.phase === 2 ? this.heat : 0;
                    this.setAct(this.chooseAct(p));
                }
                break;
            case 'slam':
                this.hover(dt, this.highY);
                if (this.t < dt * 1.5) {
                    this.activeHand = 1 - this.activeHand;
                    const h = this.hands[this.activeHand];
                    h.state = 'track';
                    h.t = 0;
                    Sfx.tell();
                }
                if (this.t > 1.7) this.finishAttack();
                break;
            case 'sweep':
                this.hover(dt, this.highY);
                if (this.t < dt * 1.5) {
                    this.activeHand = 1 - this.activeHand;
                    const h = this.hands[this.activeHand];
                    const fromLeft = p.x > this.center;
                    h.fromX = fromLeft ? a.x1 + 1 : a.x2 - 1;
                    h.dir = fromLeft ? 1 : -1;
                    h.state = 'sweepTell';
                    h.t = 0;
                    Sfx.tell();
                    E.setAimLine(this.beamLine, a.x1, a.floor + 0.2, a.x2, a.floor + 0.2, 0.8);
                }
                if (this.t > 3.2) this.finishAttack();
                break;
            case 'boulder':
                this.hover(dt, this.highY);
                if (this.t < dt * 1.5) this.throwBoulders(p);
                if (this.t > 1.9) this.finishAttack();
                break;
            case 'nova':
                this.hover(dt, this.highY);
                this.updateNova(dt, p);
                break;
            case 'beam':
                this.updateBeam(dt, p);
                break;
            case 'erupt':
                this.hover(dt, this.highY);
                if (this.t < dt * 1.5) this.startEruption(p);
                if (this.t > 2) this.finishAttack();
                break;
            case 'staggered':
                this.hover(dt, this.highY);
                if (this.t > 1.3) this.setAct('idle');
                break;
            case 'exposing':
                this.y += (this.exposeY() - this.y) * Math.min(1, dt * 6);
                this.x += (this.center - this.x) * Math.min(1, dt * 3);
                if (this.t > 0.7) {
                    this.vulnerable = true;
                    Sfx.tell();
                    this.setAct('exposed');
                }
                break;
            case 'exposed':
                if (this.t > WINDOW[this.phase]) {
                    this.vulnerable = false;
                    this.resetCycle();
                    this.setAct('recover');
                }
                break;
            case 'recover':
                this.y += (this.highY - this.y) * Math.min(1, dt * 3);
                if (this.t > 0.9) this.setAct('idle');
                break;
            case 'transition':
                this.y += (this.highY + 1 - this.y) * Math.min(1, dt * 2);
                if (Math.random() < dt * 8) {
                    this.game.view.emit(a.x1 + Math.random() * (a.x2 - a.x1), this.lava.level + 0.2, 0xffa050, 10, 9, 0.8);
                    this.game.shake(0.4);
                }
                if (this.t > 2.4) this.setAct('idle');
                break;
        }
    }

    hover(dt, targetY) {
        this.y += (targetY + Math.sin(this.modeT * 1.5) * 0.4 - this.y) * Math.min(1, dt * 3);
        this.x += (this.home.x + Math.sin(this.modeT * 0.7) * 3 - this.x) * Math.min(1, dt * 2);
    }

    exposeY() {
        if (this.phase === 0) return this.floor + 1.5;
        if (this.phase === 1) return this.floor + 6;
        return this.floor + 10.5;
    }

    finishAttack() {
        if (this.phase === 2) this.addHeat(1);
        if (this.act !== 'exposing' && this.act !== 'exposed') this.setAct('idle');
    }

    updateObjectives(dt) {
        if (this.phase === 0 && this.pylonClock > 0) {
            this.pylonClock -= dt;
            if (this.pylonClock <= 0) {
                this.setPylons();
                Sfx.vent();
                this.showCue('Os pilares renasceram. Seja mais rápido!');
            }
        }
        if (this.phase === 2) {
            for (const py of this.pylons) {
                if (py.up || py.regrow <= 0) continue;
                py.regrow -= dt;
                if (py.regrow <= 0) {
                    const slab = this.slabUnder(py.x, py.y);
                    if (slab && slab.state !== 'solid') {
                        py.regrow = 1;
                        continue;
                    }
                    py.up = true;
                    py.mesh.visible = true;
                }
            }
        }
        if (this.phase !== 1 || !this.shielded) return;
        for (const pad of this.pads) {
            if (pad.sealed > 0) {
                pad.sealed -= dt;
                E.setAimLine(pad.chain, pad.x, pad.y + 0.4, this.x, this.y + 1.8, 0.8);
                if (pad.sealed <= 0) {
                    pad.sealed = 0;
                    pad.chain.visible = false;
                    if (!pad.guard) this.spawnGuard(pad);
                }
            }
        }
        this.feedT -= dt;
        if (this.feedT <= 0 && this.act !== 'transition') {
            this.feedT = FEED_EVERY;
            if (!this.minions.some(m => m.kind === 'feeder' && m.alive)) this.spawnFeeder();
        }
    }

    throwBoulders(p) {
        const a = this.arena;
        const count = this.phase === 0 ? 2 : 3;
        Sfx.roar();
        for (let i = 0; i < count; i++) {
            const tx = Math.max(a.x1 + 1.5, Math.min(a.x2 - 1.5, p.x + (i - (count - 1) / 2) * 4.5));
            const y0 = this.y + 1;
            const flight = 1.25;
            const top = this.groundAt(tx, this.y);
            const gravity = 22;
            const vy = (top + 0.6 - y0 + 0.5 * gravity * flight * flight) / flight;
            this.game.addShot(new Shot(this.game, this.x, y0, (tx - this.x) / flight, vy, { color: 0xc08a5b, r: 0.55, gravity, solid: false, life: flight + 0.05 }));
            this.strike(tx - 1, top, 2, 1.1, flight - 0.05, 0.2, 0xffa050, () => Sfx.stomp());
        }
    }

    updateNova(dt, p) {
        const tell = 0.85;
        const maxR = 12;
        if (this.t < dt * 1.5) {
            Sfx.nova();
            this.novaHit = false;
        }
        if (this.t < tell) {
            this.novaR = 3 + Math.sin(this.t * 30) * 0.4;
            return;
        }
        this.novaR = 3 + (this.t - tell) * 11;
        const d = Math.hypot(p.x - this.x, p.y + PH / 2 - this.y - 1.8);
        if (!this.novaHit && Math.abs(d - this.novaR) < 0.75) {
            this.novaHit = true;
            this.game.hurtPlayer(1, this.x);
        }
        if (this.novaR >= maxR) {
            this.novaR = 0;
            this.novaCool = 7;
            this.finishAttack();
        }
    }

    updateBeam(dt, p) {
        const a = this.arena;
        const tell = 1.35;
        const sweep = 2;
        this.x += (this.center - this.x) * Math.min(1, dt * 4);
        this.y += (this.highY - this.y) * Math.min(1, dt * 4);
        const ox = this.center;
        const oy = this.highY + 1.4;
        if (this.t < dt * 1.5) {
            this.beamDir = p.x > this.center ? -1 : 1;
            this.markCover(ox, oy);
            this.game.bossStatus('Feixe! Abrigue-se sob as plataformas: as zonas azuis estão protegidas.', true);
            Sfx.nova();
        }
        const fromX = this.beamDir > 0 ? a.x1 : a.x2;
        const toX = this.beamDir > 0 ? a.x2 : a.x1;
        const k = Math.min(1, Math.max(0, (this.t - tell) / sweep));
        const groundX = fromX + (toX - fromX) * k;
        const hit = this.castRay(ox, oy, groundX, a.floor - 2);
        if (this.t < tell) {
            E.setAimLine(this.beamLine, ox, oy, hit.x, hit.y, 0.5 + (this.t / tell) * 0.5);
            return;
        }
        E.setAimLine(this.beamLine, ox, oy, hit.x, hit.y, 3);
        if (Math.random() < dt * 50) this.game.view.emit(hit.x, hit.y, 0xffa050, 2, 5, 0.3);
        if (this.pointNearSegment(p.x, p.y + PH / 2, ox, oy, hit.x, hit.y) < 0.55) this.game.hurtPlayer(1, hit.x);
        if (k >= 1) {
            this.endBeam();
            this.showCue();
            this.finishAttack();
        }
    }

    castRay(ox, oy, tx, ty) {
        const dx = tx - ox;
        const dy = ty - oy;
        const len = Math.hypot(dx, dy) || 1;
        const steps = Math.ceil(len / 0.25);
        for (let i = 1; i <= steps; i++) {
            const x = ox + (dx * i) / steps;
            const y = oy + (dy * i) / steps;
            if (y <= this.lava.level || this.solidAt(x, y)) return { x, y };
        }
        return { x: tx, y: ty };
    }

    pointNearSegment(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const k = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1)));
        return Math.hypot(px - (x1 + dx * k), py - (y1 + dy * k));
    }

    markCover(ox, oy) {
        const a = this.arena;
        const blocked = (x, y) => {
            const hit = this.castRay(ox, oy, x, y);
            return Math.hypot(hit.x - x, hit.y - y) > 0.6;
        };
        const covered = x => [-0.6, 0.6].every(dx => blocked(x + dx, a.floor + 0.2) && blocked(x + dx, a.floor + 1.5));
        let start = null;
        for (let x = a.x1 + 0.5; x <= a.x2 + 0.5; x += 0.5) {
            const on = x <= a.x2 && covered(x);
            if (on && start === null) start = x;
            if (!on && start !== null) {
                if (x - start >= 1) {
                    const mark = E.makeAimLine(0x7fc6ff);
                    E.setAimLine(mark, start, a.floor + 0.14, x, a.floor + 0.14, 1.4);
                    this.game.view.root.add(mark);
                    this.safeMarks.push(mark);
                }
                start = null;
            }
        }
    }

    endBeam() {
        this.beamLine.visible = false;
        this.safeMarks.forEach(m => this.game.view.root.remove(m));
        this.safeMarks = [];
    }

    startEruption(p) {
        const a = this.arena;
        Sfx.roar();
        const spots = [p.x, p.x - 7, p.x + 7];
        for (const raw of spots) {
            const x = Math.max(a.x1 + 2, Math.min(a.x2 - 2, raw));
            const base = this.lava.level;
            this.strike(x - 1, base, 2, 11, 0.95, 0.35, 0xff8a3c, () => {
                Sfx.vent();
                for (let i = 0; i < 3; i++) {
                    this.game.addShot(new Shot(this.game, x, base + 11, (i - 1) * 3.5, 4, { color: 0xffa050, r: 0.3, gravity: 18, solid: false, life: 1.6 }));
                }
            });
        }
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
            m.rotation.z = (i ? 1 : -1) * (h.state === 'sweep' || h.state === 'sweepTell' ? 0.22 : 0);
        });
        for (const py of this.pylons) {
            if (!py.mesh.visible) continue;
            py.mesh.userData.crystal.rotation.z = Math.sin(t * 1.5) * 0.05;
            const urgent = this.phase === 0 && this.pylonClock > 0 && this.pylonClock < 4;
            py.mesh.userData.crystal.scale.setScalar(urgent ? 1 + Math.sin(t * 22) * 0.18 : 1);
        }
        for (const pad of this.pads) {
            if (!pad.on) continue;
            const u = pad.mesh.userData;
            u.rune.material = pad.sealed ? u.onMat : u.offMat;
        }
    }
}
