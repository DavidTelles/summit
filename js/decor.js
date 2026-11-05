import * as THREE from '../lib/three.module.js';
import { INK, LAYER, glowSprite, hatch, mixHex, pivot, radial, shape, sprite, stroke } from './ink.js';
import { crystalCluster } from './backdrops.js';

const STONE = '#878372';
const STONE_D = '#55524a';
const IRON = '#3f3339';
const AETHER = '#7fe3ff';
const L = LAYER.back;
const part = (key, w, h, draw, o = {}) => sprite(`decor.${key}`, w, h, draw, { ay: 0, ppu: 80, layer: L, ...o });

const BUILD = {
    tent() {
        return part('tent', 3.2, 2.4, ctx => {
            const o = [[-1.5, 0, 1], [-0.12, 2.05, 1], [0.12, 2.05, 1], [1.5, 0, 1]];
            shape(ctx, o, '#6b4b39', 0.04);
            shape(ctx, [[-0.32, 0, 1], [0, 1.12, 1], [0.34, 0, 1]], '#1c1411', 0.03);
            stroke(ctx, [[-0.8, 0.02], [-0.22, 1.86]], 0.02, '#3d2b20');
            stroke(ctx, [[0.8, 0.02], [0.2, 1.86]], 0.02, '#3d2b20');
            for (const [x, y] of [[-0.9, 0.5], [0.72, 0.8]]) stroke(ctx, [[x, y], [x + 0.28, y + 0.04]], 0.05, '#8f6a50');
            stroke(ctx, [[-0.05, 2.04], [-0.14, 2.34]], 0.04, INK);
            stroke(ctx, [[0.05, 2.04], [0.14, 2.34]], 0.04, INK);
        });
    },
    post() {
        return part('post', 1.2, 2.6, ctx => {
            shape(ctx, [[-0.1, 0, 1], [-0.08, 2.3, 1], [0.08, 2.3, 1], [0.1, 0, 1]], '#4f3b2a', 0.03);
            stroke(ctx, [[-0.45, 1.86], [0.45, 1.78]], 0.11, INK);
            stroke(ctx, [[-0.45, 1.86], [0.45, 1.78]], 0.07, '#4f3b2a');
            shape(ctx, [[0.1, 1.76, 1], [0.52, 1.75, 1], [0.48, 1.28, 1], [0.32, 1.38, 1], [0.1, 1.24, 1]], '#7d2f2b', 0.025);
        });
    },
    relic(ctx) {
        const g = new THREE.Group();
        g.add(part('relicBase', 1.8, 0.9, c => {
            shape(c, [[-0.8, 0, 1], [-0.62, 0.34, 1], [0.62, 0.34, 1], [0.8, 0, 1]], STONE_D, 0.035);
            shape(c, [[-0.5, 0.33, 1], [-0.44, 0.62, 1], [0.44, 0.62, 1], [0.5, 0.33, 1]], STONE, 0.03);
            stroke(c, [[-0.25, 0.48], [0.25, 0.48]], 0.02, INK);
        }));
        const crystal = sprite('decor.relicGem', 1.3, 1.9, c => crystalCluster(c, 0, -0.85, 0.5, '#3f9fc6', '#a8ecff'), { ppu: 90, layer: L + 1 });
        crystal.position.y = 1.5;
        const glow = glowSprite(0x6fcfff, ctx.final ? 5.4 : 2.6, { opacity: ctx.final ? 0.75 : 0.32, layer: L - 1 });
        glow.position.y = 1.4;
        g.add(glow, crystal);
        return g;
    },
    statue() {
        return part('statue', 1.5, 2.8, ctx => {
            shape(ctx, [[-0.5, 0, 1], [-0.42, 0.34, 1], [0.42, 0.34, 1], [0.5, 0, 1]], STONE_D, 0.03);
            const robe = [[-0.33, 0.34], [-0.38, 1.0], [-0.22, 1.72], [0.22, 1.72], [0.38, 1.0], [0.3, 0.34]];
            shape(ctx, robe, STONE, 0.035);
            stroke(ctx, [[-0.08, 0.34], [-0.12, 1.5]], 0.018, INK);
            stroke(ctx, [[0.14, 0.34], [0.1, 1.2]], 0.018, INK);
            shape(ctx, [[-0.2, 1.7], [-0.18, 2.2], [0, 2.32], [0.18, 2.2], [0.2, 1.7]], STONE, 0.03);
            shape(ctx, [[0.2, 1.65, 1], [0.58, 2.35, 1], [0.5, 2.5, 1], [0.08, 1.7, 1]], STONE, 0.03);
            stroke(ctx, [[-0.3, 1.9], [-0.05, 1.58], [0.06, 1.1]], 0.02, '#3d4a34');
            hatch(ctx, -0.34, 0.4, 0.3, 1.1, 14, 'rgba(0,0,0,0.3)', 0.012, 8);
            stroke(ctx, [[-0.2, 0.6], [-0.1, 0.42]], 0.04, '#5f8054');
        });
    },
    column() {
        return part('column', 1.3, 3.3, ctx => {
            shape(ctx, [[-0.5, 0, 1], [-0.4, 0.26, 1], [0.4, 0.26, 1], [0.5, 0, 1]], STONE_D, 0.03);
            const o = [[-0.28, 0.25, 1], [-0.27, 2.42, 1], [-0.08, 2.72, 1], [0.04, 2.52, 1], [0.2, 2.98, 1], [0.27, 2.2, 1], [0.28, 0.25, 1]];
            shape(ctx, o, STONE, 0.035);
            for (const x of [-0.12, 0.05, 0.18]) stroke(ctx, [[x, 0.3], [x, 2.2]], 0.015, 'rgba(0,0,0,0.42)');
            stroke(ctx, [[-0.29, 1.5], [-0.02, 1.2], [0.25, 0.78]], 0.05, '#5f8054');
        });
    },
    house() {
        return part('house', 4, 4, ctx => {
            const o = [[-1.7, 0, 1], [-1.7, 2.3, 1], [-1.2, 2.3, 1], [-1.2, 3.25, 1], [-0.45, 3.45, 1], [-0.32, 2.5, 1], [0.35, 2.76, 1], [0.6, 2.22, 1], [1.05, 2.42, 1], [1.7, 1.7, 1], [1.7, 0, 1]];
            shape(ctx, o, '#6a6355', 0.04);
            for (const [x, y, w, h] of [[-1.25, 0, 0.72, 1.2], [0.42, 0.9, 0.62, 0.68], [-0.72, 1.9, 0.42, 0.56]]) {
                shape(ctx, [[x, y, 1], [x, y + h * 0.7, 1], [x + w / 2, y + h, 1], [x + w, y + h * 0.7, 1], [x + w, y, 1]], '#15161c', 0.035);
            }
            hatch(ctx, -1.6, 0.1, 1.5, 1.8, 40, 'rgba(0,0,0,0.25)', 0.013, 3);
            stroke(ctx, [[1.4, 1.95], [1.1, 1.3], [1.48, 0.6]], 0.06, '#567048');
            for (const y of [0.55, 1.42]) stroke(ctx, [[-0.3, y], [1.66, y + 0.02]], 0.016, 'rgba(0,0,0,0.4)');
        });
    },
    deadCrystal(ctx) {
        const lit = ctx.final;
        const g = pivot(0, 0, sprite(`decor.crystal${lit}`, 1.3, 1.7, c => {
            crystalCluster(c, 0, -0.84, 0.46, lit ? '#3f9fc6' : '#333946', lit ? '#a8ecff' : '#5a6474');
            if (!lit) stroke(c, [[-0.05, -0.1], [0.07, 0.2], [-0.02, 0.5]], 0.018, INK);
        }, { ppu: 90, layer: L, y: 0.84 }));
        if (lit) g.add(glowSprite(0x6fcfff, 2.4, { opacity: 0.4, layer: L - 1, x: 0, y: 0.8 }));
        return g;
    },
    liveCrystal() {
        const glow = glowSprite(0x6fcfff, 2.3, { opacity: 0.36, layer: L - 1, x: 0, y: 0.8 });
        return pivot(0, 0, glow, sprite('decor.liveCrystal', 1.4, 1.9, c => crystalCluster(c, 0, -0.93, 0.5, '#3f9fc6', '#a8ecff'), { ppu: 90, layer: L, y: 0.93 }));
    },
    windFrame() {
        return part('windFrame', 2.9, 4, ctx => {
            shape(ctx, [[-0.42, 0, 1], [-0.28, 0.28, 1], [0.28, 0.28, 1], [0.42, 0, 1]], STONE_D, 0.03);
            shape(ctx, [[-0.1, 0.26, 1], [-0.08, 2.65, 1], [0.08, 2.65, 1], [0.1, 0.26, 1]], '#6e6a5a', 0.03);
            for (let i = 0; i < 4; i++) {
                const a = 0.5 + i * 1.57;
                const x = Math.cos(a);
                const y = Math.sin(a);
                shape(ctx, [[0, 2.7, 1], [x * 1.22 - y * 0.15, 2.7 + y * 1.22 + x * 0.15, 1], [x * 1.3 + y * 0.28, 2.7 + y * 1.3 - x * 0.28, 1], [x * 0.2 + y * 0.05, 2.7 + y * 0.2 - x * 0.05, 1]], '#a8a288', 0.022);
            }
            radial(ctx, 0, 2.7, 0.18, AETHER, 0.8);
        });
    },
    tablet() {
        return part('tablet', 2.3, 3, ctx => {
            shape(ctx, [[-1, 0, 1], [-0.84, 0.25, 1], [0.84, 0.25, 1], [1, 0, 1]], STONE_D, 0.03);
            shape(ctx, [[-0.78, 0.25, 1], [-0.74, 2.2], [-0.2, 2.62], [0.6, 2.48], [0.8, 2.1], [0.76, 0.25, 1]], '#696556', 0.04);
            for (let i = 0; i < 6; i++) {
                const y = 0.56 + i * 0.3;
                const w = 0.42 + ((i * 3) % 3) * 0.1;
                stroke(ctx, [[-w, y], [-w * 0.3, y + 0.04], [w * 0.2, y - 0.03], [w, y]], 0.035, AETHER);
            }
            hatch(ctx, -0.7, 0.3, 0.7, 2.2, 22, 'rgba(0,0,0,0.25)', 0.012, 6);
        });
    },
    circle() {
        return part('circle', 3.6, 1.2, ctx => {
            for (const [x, h] of [[-1.5, 0.3], [-1, 0.58], [-0.42, 0.34], [0.42, 0.42], [1.02, 0.66], [1.5, 0.32]]) {
                shape(ctx, [[x - 0.22, 0, 1], [x - 0.15, h], [x + 0.05, h + 0.1], [x + 0.22, 0, 1]], STONE, 0.03);
            }
            shape(ctx, [[-0.42, 0, 1], [-0.3, 0.09], [0.3, 0.09], [0.42, 0, 1]], '#3a2c22', 0.03);
            stroke(ctx, [[-0.2, 0.1], [0.12, 0.08]], 0.04, '#5b4c38');
        });
    },
    sword() {
        const g = part('sword', 1, 2.5, ctx => {
            shape(ctx, [[-0.08, 0, 1], [-0.07, 1.5, 1], [0, 1.58, 1], [0.08, 1.5, 1], [0.08, 0, 1]], '#979da6', 0.025);
            stroke(ctx, [[0, 0.05], [0, 1.4]], 0.016, '#55595f');
            shape(ctx, [[-0.33, 1.52, 1], [0.33, 1.52, 1], [0.27, 1.64, 1], [-0.27, 1.64, 1]], '#5b4427', 0.024);
            shape(ctx, [[-0.05, 1.63, 1], [-0.05, 1.98, 1], [0.05, 1.98, 1], [0.05, 1.63, 1]], '#3a2a18', 0.022);
            radial(ctx, 0, 2.03, 0.1, '#c9c29e', 1);
        });
        g.rotation.z = -0.14;
        return g;
    },
    scar() {
        return part('scar', 3.4, 1.8, ctx => {
            for (const [x, r] of [[-1.25, -0.3], [-0.4, 0.28], [0.65, -0.24]]) stroke(ctx, [[x, 0.05], [x + r, 0.6], [x + r * 0.5, 1.4]], 0.05, 'rgba(14,14,18,0.85)');
        });
    },
    floatRuin() {
        const g = part('floatRuin', 3.6, 3.2, ctx => {
            const o = [[-1.5, 0, 1], [1.5, 0.05, 1], [0.86, -0.32], [0.22, -0.4], [-0.72, -0.42]];
            shape(ctx, o, '#55618c', 0.04);
            shape(ctx, [[-1.12, 0, 1], [-1.12, 1.52, 1], [-0.84, 1.8, 1], [-0.5, 1.5, 1], [-0.5, 0, 1]], '#6a78a6', 0.035);
            shape(ctx, [[0.4, 0, 1], [0.4, 0.92, 1], [0.7, 0.72, 1], [1, 0.98, 1], [1.02, 0, 1]], '#6a78a6', 0.035);
            stroke(ctx, [[-0.3, -0.4], [-0.12, -0.25], [-0.26, -0.1]], 0.02, '#a8d8ff');
        }, { ay: 0.2 });
        g.position.y = 0;
        return g;
    },
    rod() {
        return part('rod', 1.3, 3.6, ctx => {
            shape(ctx, [[-0.4, 0, 1], [-0.28, 0.28, 1], [0.28, 0.28, 1], [0.4, 0, 1]], '#3b3f4e', 0.03);
            shape(ctx, [[-0.06, 0.26, 1], [-0.05, 3.3, 1], [0, 3.42, 1], [0.05, 3.3, 1], [0.06, 0.26, 1]], '#a0713f', 0.024);
            for (const [y, w] of [[2.54, 0.36], [2.98, 0.24]]) stroke(ctx, [[-w, y], [w, y]], 0.04, '#7a5228');
        });
    },
    gear() {
        return part('gear', 1.8, 1.9, ctx => {
            shape(ctx, [[-0.3, 0, 1], [-0.34, 0.54], [-0.2, 0.74], [0.2, 0.74], [0.32, 0.54], [0.3, 0, 1]], '#4c3a27', 0.035);
            stroke(ctx, [[-0.3, 0.42], [0.3, 0.42]], 0.05, '#2d2115');
            stroke(ctx, [[0.48, 0], [0.54, 1.5]], 0.05, '#7c7766');
            shape(ctx, [[0.54, 1.5, 1], [1, 1.34, 1], [0.84, 1.2, 1], [1, 1.04, 1], [0.54, 1.02, 1]], '#7d3a2a', 0.022);
            stroke(ctx, [[-0.62, 0.02], [-0.52, 0.35], [-0.72, 0.5], [-0.5, 0.64]], 0.028, '#a58a5a');
        });
    },
    scopeBase() {
        return part('scope', 3.6, 3.8, ctx => {
            shape(ctx, [[-0.86, 0, 1], [-0.6, 0.34, 1], [0.6, 0.34, 1], [0.86, 0, 1]], '#3b3f4e', 0.035);
            shape(ctx, [[-0.16, 0.32, 1], [-0.14, 1.9, 1], [0.14, 1.9, 1], [0.16, 0.32, 1]], '#6b5c3f', 0.03);
            ctx.save();
            ctx.translate(0, 2.06);
            ctx.rotate(0.5);
            shape(ctx, [[-1.3, -0.17, 1], [-1.3, 0.17, 1], [0.86, 0.26, 1], [0.86, -0.26, 1]], '#9c8147', 0.04);
            for (const x of [-0.7, -0.12, 0.42]) stroke(ctx, [[x, -0.21], [x, 0.21]], 0.03, INK);
            shape(ctx, [[0.86, -0.3, 1], [0.86, 0.3, 1], [1.18, 0.3, 1], [1.18, -0.3, 1]], '#a8d8ff', 0.03);
            ctx.restore();
            radial(ctx, 0, 2.06, 0.1, '#c9c29e', 1);
        });
    },
    machine() {
        return part('machine', 3.4, 3.4, ctx => {
            shape(ctx, [[-1.3, 0, 1], [-1.3, 1.64, 1], [1.3, 1.64, 1], [1.3, 0, 1]], IRON, 0.04);
            shape(ctx, [[-1.1, 1.62, 1], [-1.1, 3, 1], [-0.46, 3, 1], [-0.46, 1.62, 1]], '#2f272c', 0.035);
            stroke(ctx, [[-1.15, 2.42], [-0.42, 2.42]], 0.07, '#5b4d50');
            shape(ctx, [[-0.4, 0.62, 1], [-0.4, 1.3, 1], [1, 1.3, 1], [1, 0.62, 1]], '#150f10', 0.03);
            stroke(ctx, [[-0.26, 0.96], [0.84, 0.96]], 0.1, '#ff7a30');
            for (const [x, y] of [[-1.16, 0.15], [1.16, 0.15], [-1.16, 1.5], [1.16, 1.5]]) radial(ctx, x, y, 0.05, '#9a8a8e', 1);
            stroke(ctx, [[0.3, 1.64], [0.48, 2.42], [1.1, 2.54]], 0.09, INK);
            stroke(ctx, [[0.3, 1.64], [0.48, 2.42], [1.1, 2.54]], 0.05, '#5b4d50');
        });
    },
    ironRig() {
        return part('ironRig', 3, 3.6, ctx => {
            const beam = (pts, w = 0.13) => {
                stroke(ctx, pts, w + 0.05, INK);
                stroke(ctx, pts, w, IRON);
            };
            beam([[-1, 0], [-0.86, 3.05]]);
            beam([[1, 0], [0.86, 3.05]]);
            beam([[-1.16, 3.1], [1.16, 3.1]], 0.18);
            beam([[-0.92, 0.6], [0.92, 2.72]], 0.09);
            beam([[0.92, 0.6], [-0.92, 2.72]], 0.09);
            stroke(ctx, [[0.45, 3.1], [0.45, 2.3]], 0.03, '#79696d');
            shape(ctx, [[0.3, 2.3, 1], [0.6, 2.3, 1], [0.54, 2.05, 1], [0.36, 2.05, 1]], '#6d5550', 0.024);
        });
    },
    seal() {
        const g = part('seal', 2.2, 3.2, ctx => {
            shape(ctx, [[-0.86, 0, 1], [-0.8, 2.5], [-0.2, 2.86], [0.42, 2.82], [0.84, 2.4], [0.86, 0, 1]], '#2a2226', 0.045);
            ctx.strokeStyle = '#ff7a3c';
            ctx.lineWidth = 0.05;
            ctx.beginPath();
            ctx.arc(0, 1.44, 0.58, 0, Math.PI * 2);
            ctx.stroke();
            stroke(ctx, [[-0.45, 1.44], [0.45, 1.44]], 0.05, '#ff7a3c');
            stroke(ctx, [[0, 0.98], [0, 1.9]], 0.05, '#ff7a3c');
            hatch(ctx, -0.8, 0.1, 0.8, 0.8, 16, 'rgba(0,0,0,0.5)', 0.014, 15);
        });
        return g;
    }
};

export const DECOR_KINDS = Object.keys(BUILD);

export function makeDecor(kind, ctx) {
    return BUILD[kind](ctx);
}

export function makeRecordStone() {
    const g = new THREE.Group();
    const halo = sprite('decor.recordHalo', 1.6, 1.6, ctx => {
        radial(ctx, 0, 0, 0.8, AETHER, 0.5);
        ctx.strokeStyle = '#d8f6ff';
        ctx.lineWidth = 0.022;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, 0.62, (i * Math.PI * 2) / 3, (i * Math.PI * 2) / 3 + 1.5);
            ctx.stroke();
        }
    }, { ppu: 80, additive: true, layer: LAYER.fx - 4 });
    const face = sprite('decor.recordStone', 1, 1.1, ctx => {
        const o = [[-0.3, -0.44], [-0.34, 0.2], [-0.12, 0.45], [0.22, 0.42], [0.34, 0.14], [0.3, -0.44]];
        shape(ctx, o, '#6b6757', 0.04);
        for (const [y, w] of [[0.22, 0.2], [0.06, 0.15], [-0.1, 0.2], [-0.26, 0.11]]) stroke(ctx, [[-w, y], [0, y + 0.015], [w, y]], 0.03, AETHER);
    }, { ppu: 100, layer: LAYER.entity + 8 });
    g.add(halo, face);
    g.userData = { halo };
    return g;
}

export function makeRubble() {
    return sprite('decor.rubble', 4, 1, ctx => {
        const stones = [[-1.45, 0.3, '#45403a'], [-0.95, 0.46, '#6a6358'], [-0.42, 0.3, '#7c7468'], [0.1, 0.52, '#4e4840'], [0.65, 0.33, '#6a6358'], [1.2, 0.42, '#45403a']];
        for (const [x, s, c] of stones) {
            shape(ctx, [[x - s, 0, 1], [x - s * 0.72, s * 0.8], [x + s * 0.1, s * 0.98], [x + s * 0.72, s * 0.6], [x + s, 0, 1]], c, 0.04);
            stroke(ctx, [[x - s * 0.2, s * 0.8], [x, s * 0.2]], 0.02, INK);
        }
    }, { ay: 0.05, ppu: 100, layer: LAYER.entity + 2 });
}

export function makeFlower() {
    return sprite('decor.flower', 1, 1.2, ctx => {
        stroke(ctx, [[0, 0], [0.04, 0.3], [-0.02, 0.68]], 0.06, INK);
        stroke(ctx, [[0, 0], [0.04, 0.3], [-0.02, 0.68]], 0.03, '#4f9a58');
        for (const [x, y, r] of [[-0.18, 0.2, -0.7], [0.2, 0.34, 0.6]]) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(r);
            shape(ctx, [[-0.14, 0], [0, 0.08], [0.15, 0], [0, -0.07]], '#3f8f4a', 0.02);
            ctx.restore();
        }
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 + 0.3;
            const cx = -0.02 + Math.cos(a) * 0.14;
            const cy = 0.74 + Math.sin(a) * 0.14;
            shape(ctx, [[cx - 0.1, cy], [cx, cy + 0.1], [cx + 0.1, cy], [cx, cy - 0.1]], '#fff8ee', 0.022);
        }
        radial(ctx, -0.02, 0.74, 0.1, '#ffd23f', 1);
        shape(ctx, [[0.2, 0.42], [0.28, 0.5], [0.36, 0.42], [0.28, 0.27]], '#d22a4c', 0.022);
    }, { ay: 0, ppu: 130, layer: LAYER.entity + 5 });
}

export function makeStoneFace() {
    const g = new THREE.Group();
    g.add(sprite('decor.stoneFace', 2.2, 2.4, ctx => {
        const o = [[-0.85, 0, 1], [-0.86, 1], [-0.6, 1.72], [-0.05, 1.98], [0.55, 1.7], [0.85, 0.98], [0.85, 0, 1]];
        shape(ctx, o, '#5d574f', 0.05);
        shape(ctx, [[-0.68, 0.93], [-0.32, 1.1], [0.32, 1.1], [0.68, 0.93], [0.36, 0.76], [-0.36, 0.76]], '#100c09', 0.04);
        for (const line of [[[-0.6, 1.66], [-0.3, 1.32], [-0.46, 1.1]], [[0.5, 1.64], [0.25, 1.3], [0.38, 1.1]], [[-0.28, 0.76], [-0.12, 0.34], [-0.3, 0]], [[0.25, 0.75], [0.1, 0.42], [0.3, 0]]]) stroke(ctx, line, 0.03, '#14100c');
        hatch(ctx, -0.8, 0.05, 0.8, 0.7, 30, 'rgba(0,0,0,0.42)', 0.015, 4);
    }, { ay: 0, ppu: 110, layer: LAYER.entity + 3 }));
    const eye = x => sprite('decor.humanEye', 0.5, 0.3, ctx => {
        shape(ctx, [[-0.17, 0], [0, 0.085], [0.17, 0], [0, -0.07]], '#f2e8d8', 0.016);
        radial(ctx, 0, 0, 0.065, '#4a3220', 1);
        ctx.fillStyle = '#080604';
        ctx.beginPath();
        ctx.arc(0, 0, 0.03, 0, 7);
        ctx.fill();
    }, { ppu: 160, layer: LAYER.entity + 4, x, y: 0.93 });
    const eyes = [eye(-0.3), eye(0.3)];
    g.add(...eyes);
    g.userData = { eyes };
    return g;
}

export function makeLightFigure() {
    const m = sprite('decor.lightFigure', 1.8, 2.7, ctx => {
        radial(ctx, 0, 1.2, 1.3, '#a8d8ff', 0.5);
        const o = [[-0.28, 0, 1], [-0.42, 0.78], [-0.34, 1.6], [-0.16, 1.82], [-0.2, 2.16], [0, 2.36], [0.2, 2.16], [0.16, 1.82], [0.34, 1.6], [0.42, 0.78], [0.28, 0, 1]];
        shape(ctx, o, 'rgba(235,246,255,0.88)', 0);
        stroke(ctx, [[0.32, 1.6], [0.72, 2.0], [0.62, 2.28]], 0.035, '#ffffff');
        stroke(ctx, [[-0.32, 1.5], [-0.66, 1.0], [-0.8, 0.6]], 0.03, '#ffffff');
    }, { ay: 0, ppu: 110, additive: true, own: true, layer: LAYER.fx - 4 });
    const g = new THREE.Group();
    g.add(m);
    g.userData = { material: m.material };
    return g;
}
