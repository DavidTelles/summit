import { LAYER, clipTo, glowSprite, pivot, radial, shape, sprite, stroke, vGrad } from './ink.js';

// Arte do Arauto do Alto. Mesmo estilo do resto do jogo: canvas 2D com contorno de tinta.
const BL = LAYER.entity + 10;
const GOLD = '#e8c878';
const EYES = [[-0.34, 0.2], [0.34, 0.2], [0, 0.46], [-0.18, -0.08], [0.18, -0.08], [0, -0.32]];

export function makeHerald() {
    const wing = side => sprite(`heraldWing${side}`, 2.6, 2.8, ctx => {
        for (let i = 0; i < 5; i++) {
            const y = 0.9 - i * 0.42;
            const len = 1.1 - i * 0.1;
            const o = [[0, y], [side * len * 0.55, y + 0.2], [side * len, y - 0.05], [side * len * 0.5, y - 0.26], [0, y - 0.2]];
            shape(ctx, o, i % 2 ? '#d7d3e6' : '#f4efe0', 0.03);
        }
    }, { ppu: 90, layer: BL });
    const wings = [-1, 1].map(side => pivot(side * 0.36, 1.9, wing(side)));
    const robeShape = [[-0.5, 2.3], [0.5, 2.3], [0.72, 0.9], [0.98, 0], [-0.98, 0], [-0.72, 0.9]];
    const robe = sprite('heraldRobe', 2.4, 2.8, ctx => {
        shape(ctx, robeShape, '#f1ead8', 0.05);
        clipTo(ctx, robeShape, () => {
            ctx.fillStyle = vGrad(ctx, 2.3, 0, 'rgba(255,255,255,0.1)', 'rgba(90,80,130,0.5)');
            ctx.fillRect(-1, 0, 2, 2.4);
            for (const x of [-0.45, -0.15, 0.15, 0.45]) stroke(ctx, [[x * 0.7, 2.2], [x * 1.3, 0]], 0.02, 'rgba(70,60,110,0.45)');
        });
        stroke(ctx, [[-0.92, 0.14], [0.92, 0.14]], 0.05, GOLD);
    }, { ppu: 100, ay: 0, layer: BL + 2 });
    const maskShape = [[-0.55, 0.45], [-0.3, 0.72], [0.3, 0.72], [0.55, 0.45], [0.42, -0.42], [0, -0.66], [-0.42, -0.42]];
    const mask = sprite('heraldMask', 1.5, 1.6, ctx => {
        shape(ctx, maskShape, '#f7f2e4', 0.05);
        for (const [x, y] of EYES) shape(ctx, [[x - 0.11, y, 1], [x, y + 0.06, 1], [x + 0.11, y, 1], [x, y - 0.06, 1]], '#3a3360', 0.016);
    }, { ppu: 110, layer: BL + 4 });
    mask.position.set(0, 2.75, 0);
    const eyes = sprite('heraldEyes', 1.5, 1.6, ctx => {
        for (const [x, y] of EYES) radial(ctx, x, y, 0.13, '#ffd070', 0.95);
    }, { ppu: 110, additive: true, own: true, layer: BL + 5 });
    eyes.position.set(0, 2.75, 0);
    const halo = sprite('heraldHalo', 3.2, 3.2, ctx => {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.07;
        ctx.beginPath();
        ctx.arc(0, 0, 1.25, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            stroke(ctx, [[Math.cos(a) * 1.25, Math.sin(a) * 1.25], [Math.cos(a) * 1.5, Math.sin(a) * 1.5]], 0.05, '#ffffff');
        }
    }, { ppu: 90, additive: true, own: true, color: 0xffe2a0, layer: BL - 1, opacity: 0.85 });
    halo.position.set(0, 2.75, -0.1);
    const core = glowSprite(0xffe2a0, 2.6, { opacity: 0.2, layer: BL + 3, x: 0, y: 1.3 });
    const body = pivot(0, 0, ...wings, robe, core, halo, mask, eyes);
    const g = pivot(0, 0, body);
    g.userData = { body, wings, halo, eyes, core };
    return g;
}

export function animateHerald(m, b, t) {
    const u = m.userData;
    const exposed = b.vulnerable;
    const tell = b.act === 'pillars' || b.act === 'volley' || b.act === 'mark';
    u.body.position.y = exposed ? 0 : Math.sin(t * 2.2) * 0.12;
    u.body.rotation.z = exposed ? 0.16 : b.act === 'divefall' ? 0 : Math.sin(t * 1.3) * 0.03;
    const spread = exposed ? -0.75 : tell ? 0.4 + Math.sin(t * 22) * 0.04 : Math.sin(t * 3) * 0.14;
    u.wings[0].rotation.z = -spread;
    u.wings[1].rotation.z = spread;
    u.halo.rotation.z = t * (tell ? 3 : 0.6);
    u.halo.material.opacity = exposed ? 0.15 : 0.85;
    const flash = b.hitFlash > 0 && Math.floor(b.hitFlash * 30) % 2 === 0;
    u.eyes.material.opacity = flash ? 0.1 : exposed ? 0.3 + Math.sin(t * 14) * 0.2 : tell || b.phase > 0 ? 1 : 0.7;
    u.core.material.opacity = exposed ? 0.7 + Math.sin(t * 14) * 0.2 : 0.2;
    if (b.mode === 'dying') {
        m.rotation.z = Math.sin(t * 30) * 0.05;
        m.scale.setScalar(1 - Math.min(1, b.modeT / 2.6) * 0.3);
    }
}
