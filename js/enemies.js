import * as E from './entities.js';
import { Shot } from './hazards.js';
import { Sfx } from './audio.js';
import { PH } from './config.js';

const SIGHT_ROW = 1.6;

export class Enemy {
    constructor(def, root, make, stats = {}) {
        Object.assign(this, { w: 0.8, h: 0.8, hp: 1, dir: -1, alive: true, state: 'idle', t: 0, hitFlash: 0, color: 0x8b2fc9 }, stats, def);
        this.ox = this.x;
        this.oy = this.y;
        this.phase = this.x * 1.7;
        this.mesh = make();
        this.mesh.position.set(this.x, this.y, 0);
        root.add(this.mesh);
    }

    go(state) {
        this.state = state;
        this.t = 0;
    }

    canSeeRow(p, range) {
        return Math.abs(p.y - this.y) < SIGHT_ROW && Math.abs(p.x - this.x) < range;
    }

    groundAhead(game, dir) {
        const front = this.x + dir * (this.w / 2 + 0.1);
        return game.world.solid(Math.floor(front), Math.floor(this.y - 0.3));
    }

    wallAhead(game, dir) {
        const front = this.x + dir * (this.w / 2 + 0.1);
        return game.world.solid(Math.floor(front), Math.floor(this.y + 0.3));
    }

    patrol(game, dt, speed) {
        if (this.wallAhead(game, this.dir) || !this.groundAhead(game, this.dir)) {
            this.dir *= -1;
            return;
        }
        this.x += this.dir * speed * dt;
    }

    receive(kind, game) {
        this.hp--;
        this.hitFlash = 0.25;
        if (this.hp > 0) {
            Sfx.stomp();
            game.view.emit(this.x, this.y + this.h / 2, 0xffffff, 8, 4, 0.3);
            return 'hit';
        }
        return 'killed';
    }

    die(game) {
        this.alive = false;
        this.mesh.visible = false;
        game.view.emit(this.x, this.y + this.h / 2, this.color, 24, 7, 0.7);
    }

    get hurtsOnContact() {
        return true;
    }

    sync(t, dt) {
        this.hitFlash = Math.max(0, this.hitFlash - dt);
        const m = this.mesh;
        m.position.set(this.x, this.y, 0);
        m.rotation.y = this.dir > 0 ? 0 : Math.PI;
        const punch = 1 + this.hitFlash * 1.2;
        m.scale.set(punch, punch, punch);
        E.animateEnemy(m, this, t);
    }
}

class Walker extends Enemy {
    constructor(def, root) {
        super(def, root, E.makeWalker);
    }

    update(game, dt, p) {
        const alert = this.canSeeRow(p, 5);
        if (alert && Math.sign(p.x - this.x) !== this.dir && this.state !== 'turning') {
            this.go('turning');
        }
        if (this.state === 'turning') {
            this.t += dt;
            if (this.t > 0.25) {
                this.dir = Math.sign(p.x - this.x) || this.dir;
                this.go('idle');
            }
            return;
        }
        this.patrol(game, dt, alert ? 3.4 : 2.2);
    }
}

class Flyer extends Enemy {
    constructor(def, root) {
        super(def, root, E.makeFlyer, { color: 0xff7a3d });
    }

    update(game, dt) {
        this.phase += dt;
        const nx = this.ox + Math.sin(this.phase * 1.3) * 3.5;
        this.dir = nx >= this.x ? 1 : -1;
        this.x = nx;
        this.y = this.oy + Math.sin(this.phase * 2.1) * 1.1;
    }
}

class Charger extends Enemy {
    constructor(def, root) {
        super(def, root, E.makeCharger, { w: 1.2, h: 1, color: 0xc2553b });
    }

    update(game, dt, p) {
        this.t += dt;
        switch (this.state) {
            case 'idle':
                this.patrol(game, dt, 1.6);
                if (this.canSeeRow(p, 9)) {
                    this.dir = Math.sign(p.x - this.x) || this.dir;
                    this.go('tell');
                    Sfx.tell();
                }
                break;
            case 'tell':
                if (this.t > 0.6) this.go('charge');
                break;
            case 'charge':
                game.view.emit(this.x - this.dir * 0.5, this.y + 0.1, 0xb8a58a, 1, 1.5, 0.3);
                if (this.wallAhead(game, this.dir) || !this.groundAhead(game, this.dir) || this.t > 1.4) {
                    this.go('stunned');
                    game.shake(0.2);
                } else this.x += this.dir * 11 * dt;
                break;
            case 'stunned':
                if (this.t > 1.3) this.go('idle');
                break;
        }
    }

    receive(kind, game) {
        if (kind === 'dash' && this.state === 'charge') return 'blocked';
        return super.receive(kind, game);
    }

    get hurtsOnContact() {
        return this.state !== 'stunned';
    }
}

class Spitter extends Enemy {
    constructor(def, root) {
        super(def, root, E.makeSpitter, { w: 0.9, h: 1, color: 0x5fae5a, range: 12, cooldown: 2.2 });
        this.t = this.x % 1.5;
    }

    update(game, dt, p) {
        this.t += dt;
        const dx = p.x - this.x;
        const dy = p.y + PH / 2 - (this.y + 0.8);
        const inRange = Math.hypot(dx, dy) < this.range;
        if (inRange) this.dir = dx >= 0 ? 1 : -1;
        if (this.state === 'idle' && this.t > this.cooldown && inRange) {
            this.go('tell');
            Sfx.tell();
        } else if (this.state === 'tell' && this.t > 0.55) {
            const len = Math.hypot(dx, dy) || 1;
            game.addShot(new Shot(game, this.x + this.dir * 0.4, this.y + 0.8, (dx / len) * 7, (dy / len) * 7, { color: 0x9df26a, r: 0.26 }));
            Sfx.shot();
            this.go('idle');
        }
    }
}

class Shield extends Enemy {
    constructor(def, root) {
        super(def, root, E.makeShieldbearer, { w: 0.9, h: 1.3, color: 0x6b7fa8 });
    }

    update(game, dt, p) {
        this.t += dt;
        const sees = this.canSeeRow(p, 7);
        const toward = Math.sign(p.x - this.x) || this.dir;
        switch (this.state) {
            case 'idle':
                if (sees && toward !== this.dir && this.t > 0.7) {
                    this.dir = toward;
                    this.t = 0;
                }
                this.patrol(game, dt, sees ? 1.6 : 1);
                if (this.canSeeRow(p, 2) && toward === this.dir) {
                    this.go('tell');
                    Sfx.tell();
                }
                break;
            case 'tell':
                if (this.t > 0.45) this.go('bash');
                break;
            case 'bash':
                if (!this.wallAhead(game, this.dir) && this.groundAhead(game, this.dir)) this.x += this.dir * 7 * dt;
                if (this.t > 0.3) this.go('recover');
                break;
            case 'recover':
                if (this.t > 0.9) this.go('idle');
                break;
        }
    }

    receive(kind, game, p) {
        const fromFront = Math.sign(p.x - this.x) === this.dir;
        if (kind === 'dash' && fromFront && this.state !== 'recover') return 'blocked';
        return super.receive(kind, game);
    }
}

class Diver extends Enemy {
    constructor(def, root) {
        super(def, root, E.makeDiver, { w: 0.9, h: 0.7, color: 0x4c4f8f, swoops: 0 });
    }

    update(game, dt, p) {
        this.t += dt;
        switch (this.state) {
            case 'idle':
                this.x = this.ox + Math.sin(this.t * 1.1) * 0.5;
                this.y = this.oy + Math.sin(this.t * 2.2) * 0.2;
                if (Math.abs(p.x - this.x) < 7 && p.y < this.y && this.y - p.y < 11 && this.t > 1) {
                    this.dir = Math.sign(p.x - this.x) || 1;
                    this.go('tell');
                    Sfx.tell();
                }
                break;
            case 'tell':
                if (this.t > 0.5) {
                    this.from = { x: this.x, y: this.y };
                    this.to = { x: p.x, y: p.y + 0.3 };
                    this.go('swoop');
                }
                break;
            case 'swoop': {
                const dur = 0.9;
                const k = Math.min(1, this.t / dur);
                this.x = this.from.x + (this.to.x + (this.to.x - this.from.x) * 0.6 - this.from.x) * k;
                this.y = this.from.y + (this.to.y - this.from.y) * Math.sin(k * Math.PI);
                if (k >= 1) {
                    this.swoops++;
                    this.go(this.swoops % 2 === 1 ? 'tell' : 'rest');
                    this.dir = Math.sign(p.x - this.x) || this.dir;
                }
                break;
            }
            case 'rest':
                this.x += (this.ox - this.x) * dt * 1.5;
                this.y += (this.oy - this.y) * dt * 1.5;
                if (this.t > 1.8) this.go('idle');
                break;
        }
    }
}

class Sentinel extends Enemy {
    constructor(def, root) {
        super(def, root, E.makeSentinel, { w: 1, h: 1, hp: 2, color: 0xe0b040, radius: 2.4, spin: 1.5 });
    }

    update(game, dt, p) {
        this.phase += dt * this.spin;
        const r = this.radius + Math.sin(this.phase * 0.7) * 0.5;
        this.orbR = r;
        const cy = this.y + 0.5;
        for (let i = 0; i < 2; i++) {
            const a = this.phase + i * Math.PI;
            const ox = this.x + Math.cos(a) * r;
            const oy = cy + Math.sin(a) * r;
            if (Math.abs(ox - p.x) < 0.55 && Math.abs(oy - (p.y + PH / 2)) < 0.6) game.hurtPlayer(1, ox);
        }
    }
}

const TYPES = {
    E: Walker, F: Flyer, charger: Charger, spitter: Spitter, shield: Shield, diver: Diver, sentinel: Sentinel
};

export function isEnemyDef(def) {
    return !!TYPES[def.type];
}

export function createEnemy(type, def, root) {
    return new TYPES[type](def, root);
}
