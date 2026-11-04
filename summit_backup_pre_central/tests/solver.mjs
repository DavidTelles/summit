import { newGame, LEVELS } from './helpers.mjs';
import { STEP } from '../js/config.js';

const FRAMES = 8;
const ACTIONS = [];
for (const ix of [-1, 0, 1]) {
    ACTIONS.push({ ix });
    ACTIONS.push({ ix, jump: 'hold' });
    ACTIONS.push({ ix, jump: 'press' });
    ACTIONS.push({ ix, iy: 1, grab: true });
    ACTIONS.push({ ix, iy: 0, grab: true });
    for (const iy of [-1, 0, 1]) if (ix || iy) ACTIONS.push({ ix, iy, dash: true });
}
ACTIONS.push({ ix: 0, iy: -1, jump: 'press' });

function snapshot(game) {
    const p = game.player;
    return {
        p: { ...p, dashDir: { ...p.dashDir }, riding: p.riding },
        clock: game.clock,
        pulseA: game.world.pulseA,
        crumbles: game.crumbles.map(c => [c.timer, c.broken]),
        broken: [...game.world.broken],
        lava: game.hazards.filter(h => h.rise !== undefined).map(h => h.level),
        movers: game.hazards.filter(h => h.period && h.positionAt).map(h => [h.x, h.y, h.vx, h.vy]),
        crystals: game.crystals.map(c => c.cool),
        springs: null
    };
}

function restore(game, s) {
    Object.assign(game.player, s.p, { dashDir: { ...s.p.dashDir } });
    game.clock = s.clock;
    game.world.pulseA = s.pulseA;
    game.crumbles.forEach((c, i) => { [c.timer, c.broken] = s.crumbles[i]; });
    game.world.broken = new Set(s.broken);
    game.hazards.filter(h => h.rise !== undefined).forEach((h, i) => { h.level = s.lava[i]; });
    game.hazards.filter(h => h.period && h.positionAt).forEach((h, i) => { [h.x, h.y, h.vx, h.vy] = s.movers[i]; });
    game.crystals.forEach((c, i) => { c.cool = s.crystals[i]; });
    game.finished = false;
    game.completeTimer = -1;
}

function simulate(game, input, action) {
    input.ix = action.ix || 0;
    input.iy = action.iy || 0;
    input.held.clear();
    if (action.grab) input.held.add('ShiftLeft');
    if (action.jump) {
        input.held.add('Space');
        input.press('Space');
    }
    if (action.dash) input.press('KeyX');
    for (let i = 0; i < FRAMES; i++) {
        game.step(STEP * 1);
        input.endFrame();
        if (action.jump === 'press') input.held.delete('Space');
        if (game.player.dead) return;
    }
}

function keyOf(game, dynamicPeriod) {
    const p = game.player;
    const q = (v, s) => Math.round(v / s);
    const phase = dynamicPeriod ? q(game.clock % dynamicPeriod, 0.3) : 0;
    return [
        q(p.x, 0.3), q(p.y, 0.3), q(p.vx, 3), q(p.vy, 4), p.dashes, p.doubleJumpAvailable ? 1 : 0,
        p.onGround ? 1 : 0, q(p.stamina, 2), phase, game.world.broken.size,
        ...game.hazards.filter(h => h.rise).map(h => q(h.level, 3))
    ].join(',');
}

class Heap {
    constructor() { this.a = []; }
    push(item) {
        const a = this.a;
        a.push(item);
        let i = a.length - 1;
        while (i > 0) {
            const up = (i - 1) >> 1;
            if (a[up].f <= a[i].f) break;
            [a[up], a[i]] = [a[i], a[up]];
            i = up;
        }
    }
    pop() {
        const a = this.a;
        const top = a[0];
        const last = a.pop();
        if (a.length) {
            a[0] = last;
            let i = 0;
            for (;;) {
                const l = 2 * i + 1;
                const r = l + 1;
                let m = i;
                if (l < a.length && a[l].f < a[m].f) m = l;
                if (r < a.length && a[r].f < a[m].f) m = r;
                if (m === i) break;
                [a[m], a[i]] = [a[i], a[m]];
                i = m;
            }
        }
        return top;
    }
    get size() { return this.a.length; }
}

export function solve(index, target, opts = {}) {
    const { game, input } = newGame(index, {}, opts);
    game.enemies.forEach(e => { e.alive = false; });
    if (opts.from) {
        game.player.x = opts.from.x;
        game.player.y = opts.from.y;
    }
    if (game.boss) game.level.arena && (game.level.arena._t = game.level.arena.triggerX, game.level.arena.triggerX = 1e9);
    if (game.boss) game.boss.mode = 'dead';
    const dynamic = game.hazards.some(h => h.period) || game.world.grid.cells.some(r => r.includes('O'));
    const period = dynamic ? 7.2 : 0;
    const limit = opts.limit || 150000;
    const dist = () => Math.hypot(game.player.x - target.x, game.player.y - target.y);
    const open = new Heap();
    const seen = new Set();
    open.push({ f: dist(), g: 0, s: snapshot(game) });
    let expanded = 0;
    let bestD = Infinity;
    let bestP = null;
    const t0 = Date.now();
    while (open.size && expanded < limit && Date.now() - t0 < (opts.ms || 45000)) {
        const node = open.pop();
        expanded++;
        for (const action of ACTIONS) {
            restore(game, node.s);
            simulate(game, input, action);
            const p = game.player;
            if (p.dead) continue;
            const d = dist();
            if (d < bestD) {
                bestD = d;
                bestP = [+p.x.toFixed(1), +p.y.toFixed(1)];
            }
            if (d < (opts.radius || 1.0)) return { ok: true, expanded, time: +(node.g + FRAMES * STEP).toFixed(1) };
            const key = keyOf(game, period);
            if (seen.has(key)) continue;
            seen.add(key);
            const g = node.g + FRAMES * STEP;
            open.push({ f: d * 1.0 + g * 0.5, g, s: snapshot(game) });
        }
    }
    return { ok: false, expanded, bestD: +bestD.toFixed(1), bestP };
}

export function goalOf(index) {
    const grid = LEVELS[index].grid;
    for (let y = 0; y < grid.h; y++) {
        for (let x = 0; x < grid.w; x++) {
            if (grid.cells[y][x] === 'G') return { x: x + 0.5, y };
        }
    }
    return null;
}

export function collectTargets(index, char) {
    const grid = LEVELS[index].grid;
    const out = [];
    for (let y = 0; y < grid.h; y++) {
        for (let x = 0; x < grid.w; x++) {
            if (grid.cells[y][x] === char) out.push({ x: x + 0.5, y });
        }
    }
    return out;
}

export function routeOf(index) {
    const level = LEVELS[index];
    const vertical = level.grid.h > level.grid.w;
    const flags = collectTargets(index, 'K').sort((a, b) => (vertical ? a.y - b.y : a.x - b.x));
    return [...flags, goalOf(index)];
}

export function solveRoute(index, opts = {}) {
    let from = null;
    const legs = [];
    for (const target of routeOf(index)) {
        const r = solve(index, target, { ...opts, from, radius: 1.2 });
        legs.push({ target, ...r });
        if (!r.ok) break;
        from = target;
    }
    return legs;
}

if (process.argv[1] && process.argv[1].endsWith('solver.mjs')) {
    const filter = process.argv[2] ? process.argv[2].split(',').map(Number) : LEVELS.map((_, i) => i + 1);
    const withBerries = process.argv.includes('--berries');
    let failed = 0;
    for (const n of filter) {
        const i = n - 1;
        const legs = solveRoute(i, { ms: 25000 });
        const bad = legs.find(l => !l.ok);
        const total = legs.reduce((sum, l) => sum + (l.time || 0), 0).toFixed(0);
        console.log(`Fase ${n} ${LEVELS[i].name}: ${bad ? `FALHOU -> alvo (${bad.target.x},${bad.target.y}) perto=${bad.bestD} em ${bad.bestP}` : `OK ${legs.length} trechos, ~${total}s`}`);
        if (bad) failed++;
        if (withBerries) {
            for (const char of ['S']) {
                for (const t of collectTargets(i, char)) {
                    const flags = [null, ...collectTargets(i, 'K')].sort((a, b) => (a && b ? Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y) : a ? -1 : 1));
                    let b = null;
                    for (const from of flags.slice(0, 2)) {
                        b = solve(i, t, { ms: 12000, from, radius: 0.9 });
                        if (b.ok) break;
                    }
                    if (!b.ok) console.log(`   morango (${t.x},${t.y}) inalcançado perto=${b.bestD} em ${b.bestP}`);
                }
            }
        }
    }
    process.exit(failed ? 1 : 0);
}
