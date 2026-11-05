import * as E from './entities.js';
import { PW, PH } from './config.js';
import { Sfx } from './audio.js';

const TWO_PI = Math.PI * 2;
export const overlap = (ax, ay, aw, ah, bx, by, bw, bh) =>
    Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;

const playerBox = p => [p.x, p.y + PH / 2, PW * 0.8, PH * 0.85];
const touchesRect = (p, x, y, w, h) => overlap(...playerBox(p), x + w / 2, y + h / 2, w, h);

export class Mover {
    constructor(def, root) {
        Object.assign(this, { dx: 0, dy: 0, period: 4, phase: 0, w: 3, h: 1 }, def);
        this.x0 = def.x;
        this.y0 = def.y;
        this.vx = 0;
        this.vy = 0;
        this.mesh = E.makeMover(this.w, this.h);
        this.mesh.position.set(this.x, this.y, 0);
        root.add(this.mesh);
    }

    positionAt(clock) {
        const s = (1 - Math.cos(TWO_PI * (clock / this.period + this.phase))) / 2;
        return [this.x0 + this.dx * s, this.y0 + this.dy * s];
    }

    update(game, dt, p) {
        const [nx, ny] = this.positionAt(game.clock);
        const dx = nx - this.x;
        const dy = ny - this.y;
        this.vx = dx / dt;
        this.vy = dy / dt;
        const wasOn = !p.dead && p.dashTimer <= 0 && p.vy <= 0.01
            && p.x + PW / 2 > this.x && p.x - PW / 2 < this.x + this.w && Math.abs(p.y - (this.y + this.h)) < 0.08;
        this.x = nx;
        this.y = ny;
        if (wasOn) {
            p.riding = this;
            p.y = this.y + this.h;
            this.active = false;
            game.world.moveAxis(p, 'x', dx);
            this.active = true;
            return;
        }
        if (p.riding === this) p.riding = null;
        if (!p.dead && p.x + PW / 2 > this.x && p.x - PW / 2 < this.x + this.w && p.y + PH > this.y && p.y < this.y + this.h) {
            const center = this.y + this.h / 2;
            if (dy !== 0 && p.y + PH / 2 >= center) p.y = this.y + this.h;
            else if (dy !== 0 && dy < 0) p.y = this.y - PH;
            else p.x = dx > 0 ? this.x + this.w + PW / 2 : this.x - PW / 2;
            if (game.world.hits(p.x, p.y)) game.hurtPlayer(1, this.x + this.w / 2, true);
        }
    }

    sync() {
        this.mesh.position.set(this.x, this.y, 0);
    }
}

export class Gust {
    constructor(def, root) {
        Object.assign(this, { fx: 0, fy: 0, period: 4, on: 2, phase: 0 }, def);
        this.active = false;
        this.mesh = E.makeGust(this.w, this.h, this.fx, this.fy);
        this.mesh.position.set(this.x + this.w / 2, this.y + this.h / 2, 0.9);
        root.add(this.mesh);
    }

    update(game, dt, p) {
        const t = (game.clock + this.phase) % this.period;
        const active = t < this.on;
        if (active && !this.active && touchesRect(p, this.x - 12, this.y - 8, this.w + 24, this.h + 16)) Sfx.gust();
        this.active = active;
        this.warning = !active && t > this.period - 0.7;
        if (!active || p.dead || !touchesRect(p, this.x, this.y, this.w, this.h)) return;
        if (p.grabbing) return;
        const push = game.abilities.windScale();
        if (this.fx) game.world.moveAxis(p, 'x', this.fx * dt * push);
        if (this.fy) {
            p.vy = Math.min(p.vy + this.fy * dt * push, this.fy * 0.4 * push);
            p.jumping = false;
        }
    }

    sync(t) {
        const lanes = this.mesh.userData.lanes;
        const span = this.fx ? this.w : this.h;
        lanes.forEach((lane, i) => {
            const travel = ((t * (this.active ? 14 : 2) + i * 2.3) % span) - span / 2;
            if (this.fx) lane.position.x = travel * Math.sign(this.fx);
            else lane.position.y = travel * Math.sign(this.fy);
            lane.visible = this.active || this.warning;
        });
    }
}

export class Lightning {
    constructor(def, root, world) {
        Object.assign(this, { period: 3, warn: 0.9, strike: 0.25, phase: 0, w: 1.2 }, def);
        this.y1 = world.surfaceBelow(Math.floor(this.x), this.top ?? world.grid.h - 1);
        this.y2 = this.top ?? world.grid.h;
        this.mesh = E.makeBolt(this.w, this.y2 - this.y1);
        this.mesh.position.set(this.x, (this.y1 + this.y2) / 2, 0.3);
        root.add(this.mesh);
        this.state = 'idle';
    }

    update(game, dt, p) {
        const t = (game.clock + this.phase) % this.period;
        const strikeAt = this.period - this.strike;
        const next = t >= strikeAt ? 'strike' : t >= strikeAt - this.warn ? 'warn' : 'idle';
        if (next === 'strike' && this.state !== 'strike') {
            if (Math.abs(p.x - this.x) < 22) Sfx.thunder();
            game.view.flash(0.5);
            game.view.emit(this.x, this.y1 + 0.2, 0xcfe6ff, 10, 6, 0.4);
        }
        this.state = next;
        if (next === 'strike' && touchesRect(p, this.x - this.w / 2, this.y1, this.w, this.y2 - this.y1)) {
            game.hurtPlayer(1, this.x);
        }
    }

    sync() {
        E.setTelegraph(this.mesh, this.state);
    }
}

export class FireBar {
    constructor(def, root) {
        Object.assign(this, { arms: 2, len: 4, speed: 1.4, phase: 0 }, def);
        this.mesh = E.makeFireBar(this.arms, this.len);
        this.mesh.position.set(this.x, this.y, 0.2);
        root.add(this.mesh);
    }

    update(game, dt, p) {
        if (p.dead) return;
        const a0 = game.clock * this.speed + this.phase;
        this.angle = a0;
        const px = p.x;
        const py = p.y + PH / 2;
        for (let arm = 0; arm < this.arms; arm++) {
            const a = a0 + (arm / this.arms) * TWO_PI;
            for (let r = 0.8; r <= this.len; r += 0.8) {
                const ox = this.x + Math.cos(a) * r;
                const oy = this.y + Math.sin(a) * r;
                if (Math.abs(ox - px) < 0.55 && Math.abs(oy - py) < 0.62) {
                    game.hurtPlayer(1, ox);
                    return;
                }
            }
        }
    }

    sync() {
        this.mesh.rotation.z = this.angle || 0;
    }
}

export class Geyser {
    constructor(def, root) {
        Object.assign(this, { w: 2, h: 5, period: 3.6, warn: 0.8, on: 1.1, phase: 0 }, def);
        this.state = 'idle';
        this.mesh = E.makeGeyser(this.w, this.h);
        this.mesh.position.set(this.x + this.w / 2, this.y, 0.3);
        root.add(this.mesh);
    }

    update(game, dt, p) {
        const t = (game.clock + this.phase) % this.period;
        const onAt = this.period - this.on;
        this.state = t >= onAt ? 'strike' : t >= onAt - this.warn ? 'warn' : 'idle';
        if (this.state === 'warn' && Math.random() < dt * 20) game.view.emit(this.x + this.w / 2, this.y + 0.2, 0xffa040, 1, 2, 0.4);
        if (this.state === 'strike' && touchesRect(p, this.x + 0.1, this.y, this.w - 0.2, this.h)) game.hurtPlayer(1, this.x + this.w / 2);
    }

    sync() {
        E.setTelegraph(this.mesh, this.state);
    }
}

export class Lava {
    constructor(def, root, gridWidth) {
        Object.assign(this, { rise: 0, triggerX: -1, x1: 0, x2: gridWidth, maxY: def.y }, def);
        this.y0 = def.y;
        this.level = def.y;
        this.mesh = E.makeLava(this.x2 - this.x1);
        this.mesh.position.set((this.x1 + this.x2) / 2, this.level, 0);
        root.add(this.mesh);
    }

    reset(spawnY) {
        this.level = this.rise ? Math.max(this.y0, Math.min(this.maxY, spawnY - 7)) : this.level;
    }

    update(game, dt, p) {
        if (this.rise && p.x >= this.triggerX && !game.cutscene) {
            const lag = Math.max(0, p.y - this.level - 9);
            this.level = Math.min(this.maxY, this.level + (this.rise + lag * 0.25) * dt);
        }
        if (!p.dead && p.x > this.x1 && p.x < this.x2 && p.y < this.level - 0.25) game.kill('lava');
    }

    sync(t) {
        this.mesh.position.y = this.level + Math.sin(t * 2) * 0.05;
        E.animateLava(this.mesh, t);
    }
}

export class Secret {
    constructor(def) {
        Object.assign(this, def);
        this.found = false;
    }

    update(game, dt, p) {
        if (this.found || !touchesRect(p, this.x, this.y, this.w, this.h)) return;
        this.found = true;
        game.discoverSecret(this);
    }

    sync() {}
}

export class Strike {
    constructor(game, x, y, w, h, warn = 0.8, active = 0.25, color = 0xff5a3c) {
        Object.assign(this, { x, y, w, h, warn, active, age: 0 });
        this.state = 'warn';
        this.mesh = E.makeStrike(w, h, color);
        this.mesh.position.set(x + w / 2, y + h / 2, 0.5);
        game.view.root.add(this.mesh);
        E.setTelegraph(this.mesh, 'warn');
        this.done = false;
    }

    update(game, dt, p) {
        this.age += dt;
        if (this.state === 'warn' && this.age >= this.warn) {
            this.state = 'strike';
            E.setTelegraph(this.mesh, 'strike');
            game.view.emit(this.x + this.w / 2, this.y + 0.2, 0xffd9a0, 8, 5, 0.4);
            if (this.onStrike) this.onStrike();
        }
        if (this.state === 'strike' && touchesRect(p, this.x, this.y, this.w, this.h)) game.hurtPlayer(1, this.x + this.w / 2);
        if (this.age >= this.warn + this.active) this.done = true;
    }

    dispose(game) {
        game.view.root.remove(this.mesh);
    }
}

export class Shot {
    constructor(game, x, y, vx, vy, opts = {}) {
        Object.assign(this, { x, y, vx, vy, r: 0.3, life: 5, gravity: 0, solid: true, color: 0xff7a3d, ground: false, breakable: true }, opts);
        this.done = false;
        this.mesh = E.makeShot(this.color, this.r, this.ground);
        this.mesh.position.set(x, y, 0.3);
        game.view.root.add(this.mesh);
    }

    update(game, dt, p) {
        this.life -= dt;
        this.vy -= this.gravity * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.mesh.position.set(this.x, this.y, 0.3);
        if (this.life <= 0) {
            this.done = true;
            return;
        }
        const inSolid = game.world.solid(Math.floor(this.x), Math.floor(this.y));
        if (this.solid && inSolid) {
            this.done = true;
            game.view.emit(this.x, this.y, this.color, 6, 3, 0.3);
            return;
        }
        const hh = this.ground ? this.r * 2 : this.r;
        if (overlap(p.x, p.y + PH / 2, PW * 0.8, PH * 0.85, this.x, this.y, this.r * 2, hh * 2)) {
            if (p.dashTimer > 0 && this.breakable) {
                this.done = true;
                game.view.emit(this.x, this.y, this.color, 8, 4, 0.3);
                return;
            }
            game.hurtPlayer(1, this.x);
            if (!this.ground) this.done = true;
        }
    }

    dispose(game) {
        game.view.root.remove(this.mesh);
    }
}

const FACTORY = {
    mover: (d, r) => new Mover(d, r),
    gust: (d, r) => new Gust(d, r),
    lightning: (d, r, w) => new Lightning(d, r, w),
    firebar: (d, r) => new FireBar(d, r),
    geyser: (d, r) => new Geyser(d, r),
    lava: (d, r, w) => new Lava(d, r, w.grid.w),
    secret: d => new Secret(d)
};

export function isHazardDef(def) {
    return !!FACTORY[def.type];
}

export function createHazard(def, root, world) {
    return FACTORY[def.type](def, root, world);
}
