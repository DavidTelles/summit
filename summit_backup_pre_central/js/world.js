import { PW, PH } from './config.js';

export const PULSE_PERIOD = 1.8;
const PULSE_WARN = 0.35;
const SUBSTEP = 0.05;
const REFINE_ITERATIONS = 3;

export class World {
    constructor(grid) {
        this.grid = grid;
        this.crumbles = new Map();
        this.broken = new Set();
        this.solids = [];
        this.pulseA = true;
    }

    key(tx, ty) {
        return ty * this.grid.w + tx;
    }

    cell(tx, ty) {
        if (tx < 0 || tx >= this.grid.w || ty < 0 || ty >= this.grid.h) return '.';
        return this.grid.cells[ty][tx];
    }

    solid(tx, ty) {
        if (tx < 0 || tx >= this.grid.w) return true;
        if (ty < 0 || ty >= this.grid.h) return false;
        switch (this.grid.cells[ty][tx]) {
            case '#': return true;
            case '~': {
                const cr = this.crumbles.get(this.key(tx, ty));
                return !cr || cr.broken <= 0;
            }
            case 'X':
            case 'Y': return !this.broken.has(this.key(tx, ty));
            case 'O': return this.pulseA;
            case 'o': return !this.pulseA;
            default: return false;
        }
    }

    hits(x, y, w = PW, h = PH) {
        const left = x - w / 2 + 0.001;
        const right = x + w / 2 - 0.001;
        const bottom = y + 0.001;
        const top = y + h - 0.001;
        const x1 = Math.floor(left);
        const x2 = Math.floor(right);
        const y1 = Math.floor(bottom);
        const y2 = Math.floor(top);
        for (let ty = y1; ty <= y2; ty++) {
            for (let tx = x1; tx <= x2; tx++) if (this.solid(tx, ty)) return true;
        }
        for (const s of this.solids) {
            if (s.active !== false && left < s.x + s.w && right > s.x && bottom < s.y + s.h && top > s.y) return true;
        }
        return false;
    }

    moveAxis(body, axis, delta, w = PW, h = PH) {
        const steps = Math.ceil(Math.abs(delta) / SUBSTEP) || 1;
        const s = delta / steps;
        for (let i = 0; i < steps; i++) {
            if (!this.blockedAt(body, axis, s, w, h)) {
                body[axis] += s;
                continue;
            }
            let free = 0;
            let blocked = s;
            for (let r = 0; r < REFINE_ITERATIONS; r++) {
                const mid = (free + blocked) / 2;
                if (this.blockedAt(body, axis, mid, w, h)) blocked = mid;
                else free = mid;
            }
            body[axis] += free;
            return true;
        }
        return false;
    }

    blockedAt(body, axis, offset, w, h) {
        return axis === 'x'
            ? this.hits(body.x + offset, body.y, w, h)
            : this.hits(body.x, body.y + offset, w, h);
    }

    updatePulse(clock, overlapsPlayer) {
        const wantA = Math.floor(clock / PULSE_PERIOD) % 2 === 0;
        if (wantA === this.pulseA) return false;
        this.pulseA = wantA;
        if (overlapsPlayer()) {
            this.pulseA = !wantA;
            return false;
        }
        return true;
    }

    pulseWarning(clock) {
        return PULSE_PERIOD - (clock % PULSE_PERIOD) < PULSE_WARN;
    }

    surfaceBelow(tx, fromY) {
        for (let y = Math.floor(fromY); y >= 0; y--) if (this.solid(tx, y)) return y + 1;
        return 0;
    }

    ceilingAbove(tx, fromY) {
        for (let y = Math.max(0, Math.floor(fromY)); y < this.grid.h; y++) if (this.solid(tx, y)) return y;
        return this.grid.h;
    }
}
