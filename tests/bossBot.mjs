import { newGame } from './helpers.mjs';
import { STEP, PH } from '../js/config.js';

const SKILL_KEYS = ['KeyQ', 'KeyE', 'KeyF'];
const dashRange = 3.6;

class Driver {
    constructor(game, input) {
        this.game = game;
        this.input = input;
        this.jumpHold = 0;
        this.jumpCool = 0;
        this.dashCool = 0;
        this.skillCool = 0;
    }

    get p() { return this.game.player; }

    begin() {
        this.input.ix = 0;
        this.input.iy = 0;
        this.jumpCool -= STEP;
        this.dashCool -= STEP;
        this.skillCool -= STEP;
        if (this.jumpHold > 0) {
            this.jumpHold -= STEP;
            if (this.jumpHold <= 0) this.input.held.delete('Space');
        }
    }

    go(x) {
        const dx = x - this.p.x;
        if (Math.abs(dx) > 0.25) this.input.ix = Math.sign(dx);
    }

    jump(hold = 0.3) {
        if (this.jumpCool > 0) return;
        const p = this.p;
        const canGround = p.onGround || p.coyote > 0;
        const canDouble = p.doubleJumpAvailable && p.vy < 3;
        if (!canGround && !canDouble) return;
        this.jumpCool = 0.16;
        this.jumpHold = hold;
        this.input.held.add('Space');
        this.input.press('Space');
    }

    dash(dx, dy) {
        const p = this.p;
        if (this.dashCool > 0 || p.dashes <= 0 || p.dashTimer > 0) return false;
        this.dashCool = 0.22;
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        this.input.ix = ax > ay * 0.45 ? Math.sign(dx) : 0;
        this.input.iy = ay > ax * 0.45 ? Math.sign(dy) : 0;
        this.input.press('KeyX');
        return true;
    }

    useSkills() {
        if (this.skillCool > 0) return;
        const slots = this.game.abilities.slots;
        slots.forEach((s, i) => {
            if (s.def.type !== 'active' || s.cooldown > 0 || s.active > 0) return;
            this.input.press(SKILL_KEYS[i]);
            this.skillCool = 0.5;
        });
    }

    dodgeStrikes() {
        const { game, p } = this;
        for (const s of game.strikes) {
            const remain = s.warn - s.age;
            const insideX = p.x > s.x - 0.5 && p.x < s.x + s.w + 0.5;
            const insideY = p.y < s.y + s.h && p.y + PH > s.y;
            if (!insideX || !insideY) continue;
            if (remain > 0.75) continue;
            if (s.h > 1.3 && s.h < 2.5) {
                if (remain < 0.16) this.jump();
                continue;
            }
            const left = s.x - 1.2;
            const right = s.x + s.w + 1.2;
            const a = game.level.arena;
            const target = (Math.abs(p.x - left) < Math.abs(p.x - right) && left > a.x1 + 1) || right > a.x2 - 1 ? left : right;
            this.input.ix = Math.sign(target - p.x);
            if (remain < 0.25) this.dash(target - p.x, 0);
            return true;
        }
        return false;
    }
}

function stormBrain(d, b) {
    const { game, p, input } = d;
    const a = game.level.arena;
    if (b.act === 'transition') {
        d.go(b.center);
        return;
    }
    const cy = p.y + PH / 2;
    const orbs = game.shots.filter(s => s.deflect && s.state === 'seek');
    if (b.vulnerable || b.act === 'lodged') {
        const dx = b.x - p.x;
        const dy = b.y + 1.5 - cy;
        d.go(b.x);
        if (dy > 1 && p.onGround) d.jump();
        if (Math.abs(dx) < dashRange + 1.5 && Math.abs(dy) < 3.5) d.dash(dx, dy);
        return;
    }
    if (b.act === 'aim' && b.t > 0.2) {
        const dir = (b.diveX || (p.x - b.x)) > 0 ? -1 : 1;
        const safe = p.x + dir * 3 > a.x1 + 1 && p.x + dir * 3 < a.x2 - 1 ? dir : -dir;
        input.ix = safe;
        if (b.t > 0.38) d.dash(safe, 0);
        return;
    }
    if (d.dodgeStrikes()) return;
    if (b.windForce) input.ix = -Math.sign(b.windForce);
    const nearestOrb = orbs.sort((u, v) => Math.hypot(u.x - p.x, u.y - cy) - Math.hypot(v.x - p.x, v.y - cy))[0];
    if (nearestOrb) {
        const dx = nearestOrb.x - p.x;
        const dy = nearestOrb.y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < 2.8 && d.dash(dx, dy)) return;
        if (dist < 7) d.useSkills();
        d.go(nearestOrb.x);
        if (dy > 1.2 && dist < 6) d.jump();
        return;
    }
    if (b.phase >= 2 && !b.rods.some(r => r.charge > 0)) {
        const rod = b.rods[1];
        const dx = rod.x - p.x;
        if (p.y < rod.y + 0.1) {
            const start = rod.x - 6.5;
            if (Math.abs(p.x - start) > 2 && p.onGround) d.go(start);
            else {
                d.go(rod.x);
                if (p.onGround) d.jump();
                else if (p.vy < 2 && p.doubleJumpAvailable) d.jump();
                else if (p.vy < -1 && p.dashes > 0 && p.y < rod.y + 0.4) d.dash(dx, 1);
            }
        } else {
            d.go(rod.x);
            if (Math.abs(dx) < 2.2) d.dash(dx, 0);
        }
        return;
    }
    d.go(b.center + Math.sin(game.clock * 0.7) * 10);
}

function reachHead(d, b) {
    const { p } = d;
    const cy = p.y + PH / 2;
    const headX = b.x;
    const headY = b.y + b.h / 2;
    const dx = headX - p.x;
    const dy = headY - cy;
    d.go(headX);
    if (Math.abs(dx) < 3.2 && Math.abs(dy) < 3.4) {
        if (d.dash(dx, dy)) return;
    }
    if (Math.abs(dx) < 7) {
        if (p.onGround && dy > 0.8) d.jump();
        else if (!p.onGround && p.vy < 3 && dy > 0.8) d.jump();
    }
    d.useSkills();
}

function crossGap(d, b, targetX) {
    const { p, input } = d;
    const dir = Math.sign(targetX - p.x);
    if (!dir) return;
    d.go(targetX);
    if (p.onGround) {
        const ahead = p.x + dir * 1.1;
        const ground = b.groundAt(ahead, p.y + 0.2);
        if (ground < p.y - 0.6) d.jump();
    } else if (p.vy < 0 && b.groundAt(p.x, p.y + 0.2) < p.y - 1.5) {
        const landing = b.groundAt(p.x + dir * 2.5, p.y + 0.2);
        if (landing <= b.lava.level + 0.01) {
            if (p.doubleJumpAvailable) d.jump();
            else if (p.dashes > 0) d.dash(dir, 0);
        }
        input.ix = dir;
    }
}

function climbLedge(d, b, x, top) {
    const { p, input } = d;
    if (p.y >= top - 0.05) {
        crossGap(d, b, x);
        return;
    }
    const slab = b.slabs.find(s => s.kind === 'ledge' && x >= s.x && x <= s.x + s.w);
    const left = slab ? slab.x - 2 : x - 3;
    const right = slab ? slab.x + slab.w + 2 : x + 3;
    let from = Math.abs(p.x - left) < Math.abs(p.x - right) ? left : right;
    if (b.groundAt(from, p.y + 0.2) < p.y - 0.5) from = from === left ? right : left;
    if (Math.abs(p.x - from) > 0.6 && p.onGround) {
        crossGap(d, b, from);
        return;
    }
    const inward = Math.sign(x - from);
    if (p.onGround) {
        d.jump(0.4);
        return;
    }
    if (p.vy < 3 && p.doubleJumpAvailable) d.jump(0.4);
    if (p.y > top + 0.1) input.ix = inward;
    else if (p.vy < -1 && p.dashes > 0 && !p.doubleJumpAvailable) d.dash(0, 1);
    else if (Math.abs(p.x - from) > 0.3) input.ix = Math.sign(from - p.x);
}

function colossusBrain(d, b) {
    const { game, p, input } = d;
    const cy = p.y + PH / 2;
    const a = game.level.arena;
    const under = b.slabUnder(p.x, p.y);
    if (under && under.state === 'crack' && p.onGround) {
        const solid = b.slabs.filter(s => s.kind === under.kind && s.state === 'solid').sort((u, v) => Math.abs(u.x - p.x) - Math.abs(v.x - p.x))[0];
        const dest = solid ? solid.x + solid.w / 2 : a.x1 + 2;
        d.go(dest);
        if (Math.abs(dest - p.x) > 3) d.jump();
        if (Math.abs(dest - p.x) > 2) d.dash(dest - p.x, 0);
        return;
    }
    if (b.act === 'transition') {
        if (b.phase === 2) climbLedge(d, b, a.safe.x, 25);
        return;
    }
    if (b.vulnerable || b.act === 'exposing') {
        if (b.phase === 2 && p.y < 25 - 0.2) {
            climbLedge(d, b, a.safe.x, 25);
            return;
        }
        reachHead(d, b);
        return;
    }
    if (d.dodgeStrikes()) return;
    if (b.phase < 2) d.useSkills();
    const sweep = b.hands.find(h => h.state === 'sweep');
    if (sweep && Math.abs(sweep.x - p.x) < 7 && p.y < a.floor + 1) {
        d.jump(0.4);
        return;
    }
    const falling = b.hands.find(h => (h.state === 'track' && h.t > 0.55) || h.state === 'falling');
    if (falling && Math.abs(falling.x - p.x) < 2.9 && falling.y > p.y) {
        const dir = (p.x >= falling.x ? 1 : -1);
        const out = p.x + dir * 4;
        const safe = b.groundAt(out, p.y + 0.3) >= p.y - 0.6 ? dir : -dir;
        input.ix = safe;
        d.dash(safe, 0);
        return;
    }
    if (b.act === 'nova' && b.t < 0.95) {
        const dx = p.x - b.x;
        const dir = dx >= 0 ? 1 : -1;
        if (Math.hypot(dx, cy - b.y - 1.8) < 13) {
            input.ix = dir;
            if (b.groundAt(p.x + dir * 2, p.y + 0.3) >= p.y - 0.6) {
                d.go(p.x + dir * 3);
                return;
            }
        }
    }
    if (b.act === 'beam') {
        const marks = b.safeMarks;
        if (marks.length && p.y < a.floor + 1) {
            const mx = marks.map(m => m.position.x).sort((u, v) => Math.abs(u - p.x) - Math.abs(v - p.x))[0];
            crossGap(d, b, mx);
            return;
        }
    }
    const up = b.pylons.filter(q => q.up).sort((u, v) => Math.abs(u.x - p.x) - Math.abs(v.x - p.x));
    if (b.phase === 0 && up.length) {
        const q = up[0];
        if (q.y > p.y + 0.4) {
            climbLedge(d, b, q.x, q.y);
            return;
        }
        const dx = q.x - p.x;
        d.go(q.x);
        if (Math.abs(dx) < dashRange) d.dash(dx, 0);
        return;
    }
    if (b.phase === 1) {
        const feeder = b.minions.find(m => m.kind === 'feeder' && m.alive);
        if (feeder && Math.abs(feeder.x - p.x) < 9 && Math.abs(feeder.y - p.y) < 3) {
            const dx = feeder.x - p.x;
            crossGap(d, b, feeder.x);
            if (Math.abs(dx) < dashRange) d.dash(dx, feeder.y - p.y);
            return;
        }
        const pad = b.pads.filter(q => q.on && !q.sealed).sort((u, v) => Math.abs(u.x - p.x) - Math.abs(v.x - p.x))[0];
        if (pad) {
            if (pad.y > p.y + 0.4) {
                climbLedge(d, b, pad.x, pad.y);
                return;
            }
            const guard = pad.guard && pad.guard.alive ? pad.guard : null;
            const tx = guard ? guard.x : pad.x;
            const dx = tx - p.x;
            crossGap(d, b, tx);
            if (Math.abs(dx) < dashRange) d.dash(dx, 0);
            return;
        }
    }
    if (b.phase === 2) {
        const vent = up[0];
        if (p.y < 24.8) {
            climbLedge(d, b, a.safe.x, 25);
            return;
        }
        if (vent) {
            const dx = vent.x - p.x;
            if (Math.abs(dx) < dashRange) {
                d.dash(dx, 0);
                d.go(vent.x);
                return;
            }
            d.go(vent.x);
            if (p.onGround) {
                const ahead = b.groundAt(p.x + Math.sign(dx) * 1, p.y + 0.2);
                if (ahead < p.y - 0.6) d.jump(0.4);
            } else if (p.vy < 1 && p.doubleJumpAvailable) d.jump(0.4);
            else if (p.vy < -2 && p.dashes > 0) d.dash(dx, 0);
            return;
        }
        d.go(a.safe.x);
        return;
    }
    d.go(b.center + Math.sin(game.clock * 0.6) * 9);
}

export function playBoss(index, opts = {}) {
    const hurtLog = {};
    const { game, input } = newGame(index, {}, opts.abilities ? { abilities: opts.abilities } : {});
    const a = game.level.arena;
    const b = game.boss;
    game.player.x = a.triggerX + 1;
    game.player.y = a.floor + 0.2;
    const d = new Driver(game, input);
    let seed = opts.seed || 12345;
    const rand = () => {
        seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
        return seed / 4294967296;
    };
    let pause = 0;
    let lastDead = false;
    const brain = index === 8 ? stormBrain : colossusBrain;
    const limit = opts.limit || 900;
    const hurt = game.hurtPlayer.bind(game);
    const stats = { hits: 0, deaths: 0, time: 0, phaseDeaths: {}, windows: 0, hurtBy: hurtLog };
    game.hurtPlayer = (amount, x, ig) => {
        const before = game.player.hp;
        hurt(amount, x, ig);
        if (game.player.hp < before) {
            stats.hits++;
            hurtLog[b.act] = (hurtLog[b.act] || 0) + 1;
        }
    };
    const kill = game.kill.bind(game);
    game.kill = reason => {
        const wasDead = game.player.dead;
        kill(reason);
        if (!wasDead && game.player.dead) {
            stats.deaths++;
            stats.phaseDeaths[b.phase] = (stats.phaseDeaths[b.phase] || 0) + 1;
            const key = `morte:${reason}`;
            hurtLog[key] = (hurtLog[key] || 0) + 1;
        }
    };
    let wasVul = false;
    for (let i = 0; i < limit * 120; i++) {
        if (b.mode === 'dead') break;
        d.begin();
        if (lastDead && !game.player.dead) pause = rand() * 1.6;
        lastDead = game.player.dead;
        pause = Math.max(0, pause - STEP);
        if (b.mode === 'fight' && !game.player.dead && pause <= 0) brain(d, b);
        if (opts.trace && i % 60 === 0) opts.trace(game, b, stats, i);
        game.step(STEP);
        input.endFrame();
        if (b.vulnerable && !wasVul) stats.windows++;
        wasVul = b.vulnerable;
        stats.time += STEP;
    }
    stats.won = b.mode === 'dead';
    stats.hp = b.hp;
    stats.phase = b.phase;
    stats.act = b.act;
    stats.adaptive = b.adaptive.slice();
    return { game, stats };
}

if (process.argv[1] && process.argv[1].endsWith('bossBot.mjs')) {
    const LOADOUTS = {
        nenhuma: null,
        ofensiva: { shockwave: 3, light_lance: 3, riposte: 3 },
        defensiva: { energy_shield: 3, regeneration: 3, heal: 3 },
        mobilidade: { long_dash: 3, air_burst: 3, glide: 3 },
        especial: { time_dilation: 3, summit_form: 3, perfect_dodge: 3 }
    };
    for (const index of [8, 11]) {
        for (const [label, abilities] of Object.entries(LOADOUTS)) {
            const { stats } = playBoss(index, { abilities });
            console.log(index + 1, label, JSON.stringify({ won: stats.won, t: +stats.time.toFixed(0), deaths: stats.deaths, hits: stats.hits, win: stats.windows, hp: stats.hp, ph: stats.phase, act: stats.act, by: stats.hurtBy, pd: stats.phaseDeaths }));
        }
    }
}
