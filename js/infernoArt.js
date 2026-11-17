import { INK, LAYER, clipTo, glowSprite, hatch, pivot, radial, shape, sprite, stroke, vGrad } from './ink.js';

// Arte dos chefes e peças do Inferno. Mesmo estilo do resto do jogo: canvas 2D com contorno de tinta.
const BL = LAYER.entity + 10;

export function makeBeast() {
    const leg = (near, order) => sprite(`beastLeg${near}`, 1.3, 1.6, ctx => {
        const fill = near ? '#3b2422' : '#241413';
        shape(ctx, [[-0.32, 0.12], [0.3, 0.12], [0.26, -0.5], [0.36, -1.0], [0.52, -1.28, 1], [-0.34, -1.28, 1], [-0.3, -0.62]], fill, 0.045);
        for (const x of [-0.16, 0.1, 0.34]) shape(ctx, [[x - 0.07, -1.28, 1], [x + 0.03, -1.42, 1], [x + 0.1, -1.28, 1]], '#e8d6b0', 0.018);
        stroke(ctx, [[-0.1, 0.02], [-0.04, -0.7]], 0.022, '#ff6a2a');
    }, { ay: 0.9, layer: BL + order });
    const legs = [[-1.25, 1.05, 0], [1.2, 1.05, 0], [-0.95, 1.08, 1], [0.98, 1.08, 1]].map(([x, y, near]) => pivot(x, y, leg(near, near ? 6 : 0)));
    const hull = [[-1.9, -0.5], [-2.05, 0.2], [-1.5, 0.9], [-0.4, 1.2], [0.8, 1.1], [1.65, 0.55], [1.72, -0.3], [1.0, -0.78], [-0.2, -0.86], [-1.3, -0.8]];
    const body = sprite('beastBody', 4.4, 3.2, ctx => {
        shape(ctx, hull, '#4a2b26', 0.06);
        clipTo(ctx, hull, () => {
            ctx.fillStyle = vGrad(ctx, 1.2, -0.9, 'rgba(255,170,110,0.18)', 'rgba(0,0,0,0.66)');
            ctx.fillRect(-2.2, -1, 4.4, 2.4);
            hatch(ctx, -1.9, -0.8, 1.6, 0.2, 60, 'rgba(0,0,0,0.4)', 0.016, 7);
            for (const line of [[[-1.2, 1], [-0.9, 0.3], [-1.1, -0.4]], [[0.1, 1.15], [0.3, 0.4], [0.05, -0.6]]]) stroke(ctx, line, 0.05, '#ff7a2a');
        });
        // correntes partidas presas ao lombo: ela foi uma besta de carga antes de enlouquecer
        for (const [x, y] of [[-1.3, 0.95], [-0.2, 1.22], [0.9, 1.12]]) {
            for (let i = 0; i < 3; i++) shape(ctx, [[x - 0.09, y + i * 0.17], [x + 0.09, y + i * 0.17], [x + 0.09, y + i * 0.17 + 0.13], [x - 0.09, y + i * 0.17 + 0.13]], '#6d6a72', 0.016);
        }
    }, { ppu: 100, layer: BL + 3 });
    const yoke = sprite('beastYoke', 1.8, 1.6, ctx => {
        radial(ctx, 0, 0, 0.8, '#ffb040', 0.95);
        shape(ctx, [[-0.3, -0.25, 1], [0, 0.32, 1], [0.32, -0.2, 1]], '#fff0b0', 0.02, '#7a2a0a');
    }, { ppu: 80, additive: true, own: true, layer: BL + 4 });
    yoke.position.set(-0.2, 0.2, 0);
    const headArt = sprite('beastHead', 2.6, 2.4, ctx => {
        const o = [[-0.7, -0.3], [-0.6, 0.45], [-0.1, 0.7], [0.55, 0.45], [1.0, 0.0], [1.1, -0.42], [0.62, -0.66], [0.0, -0.66]];
        shape(ctx, o, '#5a3530', 0.055);
        clipTo(ctx, o, () => {
            ctx.fillStyle = vGrad(ctx, 0.7, -0.66, 'rgba(255,200,150,0.14)', 'rgba(0,0,0,0.6)');
            ctx.fillRect(-1, -0.8, 2.2, 1.6);
        });
        // máscara de ferro: o golpe na testa é o que a atordoa
        shape(ctx, [[0.1, 0.3], [0.95, 0.05], [1.02, -0.3], [0.2, -0.1]], '#3a3740', 0.03);
        for (const x of [0.55, 0.72, 0.9]) shape(ctx, [[x - 0.05, -0.42, 1], [x, -0.6, 1], [x + 0.06, -0.4, 1]], '#efe0c0', 0.016);
        const horn = [[-0.4, 0.4], [-0.95, 0.95], [-0.75, 1.15], [-0.1, 0.7]];
        shape(ctx, horn, '#e6d7b8', 0.04);
        shape(ctx, [[0.3, 0.42], [0.6, 1.05], [0.75, 0.98], [0.55, 0.36]], '#e6d7b8', 0.035);
    }, { ppu: 100, ax: 0.4, ay: 0.42, layer: BL + 7 });
    const eye = sprite('beastEye', 1.2, 0.7, ctx => {
        radial(ctx, 0.1, 0, 0.4, '#ff5a20', 0.95);
        shape(ctx, [[-0.12, -0.02, 1], [0.05, 0.07], [0.32, 0, 1], [0.08, -0.06]], '#ffe090', 0.016, '#401000');
    }, { ppu: 80, additive: true, own: true, layer: BL + 8 });
    eye.position.set(0.42, 0.06, 0);
    const head = pivot(1.85, 0.35, headArt, eye);
    const torso = pivot(0, 1.45, body, yoke, head);
    const g = pivot(0, 0, ...legs, torso);
    g.userData = { legs, torso, head, yoke, eye };
    return g;
}

export function animateBeast(m, b, t) {
    const u = m.userData;
    m.rotation.y = b.dir > 0 ? 0 : Math.PI;
    const running = b.act === 'charge';
    const tell = b.act === 'paw';
    const stunned = b.act === 'stunned';
    const rate = running ? 30 : tell ? 10 : 0;
    u.legs.forEach((leg, i) => { leg.rotation.z = rate ? Math.sin(t * rate + i * 1.6) * 0.6 : Math.sin(t * 1.2 + i) * 0.02; });
    u.torso.rotation.z = stunned ? -0.36 + Math.sin(t * 22) * 0.02 : tell ? 0.26 : running ? -0.18 : 0;
    u.torso.position.y = 1.45 + (tell ? -0.32 + Math.sin(t * 34) * 0.03 : stunned ? -0.42 : Math.sin(t * 2.6) * 0.05);
    u.head.rotation.z = stunned ? -0.3 : tell ? -0.15 : Math.sin(t * 1.5) * 0.04;
    const flash = b.hitFlash > 0 && Math.floor(b.hitFlash * 30) % 2 === 0;
    u.yoke.material.opacity = flash ? 1 : b.vulnerable ? 0.75 + Math.sin(t * 14) * 0.25 : 0.2;
    u.yoke.scale.setScalar(b.vulnerable ? 1.25 + Math.sin(t * 14) * 0.15 : 0.8);
    u.eye.material.opacity = stunned ? 0.1 : tell || b.phase > 0 ? 1 : 0.7;
    if (b.mode === 'dying') {
        m.rotation.z = Math.sin(t * 30) * 0.05;
        m.scale.setScalar(1 - Math.min(1, b.modeT / 2.6) * 0.25);
    }
}

// Âncora de corrente com contrapeso. A âncora fica no alto; o peso desce até a ponte quando golpeada.
export function makeAnchor() {
    const ring = sprite('anchorRing', 1.4, 1.4, ctx => {
        shape(ctx, [[-0.42, -0.42], [0.42, -0.42], [0.42, 0.42], [-0.42, 0.42]], '#4b4650', 0.05);
        shape(ctx, [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]], '#ff8a3c', 0.03);
        stroke(ctx, [[-0.42, 0], [0.42, 0]], 0.03, INK);
    }, { ppu: 90, layer: BL + 1 });
    const glow = glowSprite(0xff8a3c, 1.1, { opacity: 0.6, layer: BL });
    const g = pivot(0, 0, glow, ring);
    g.userData = { ring, glow };
    return g;
}

export function makeChain(len) {
    return sprite(`chain${len}`, 0.4, len, ctx => {
        for (let y = -len / 2; y < len / 2; y += 0.32) {
            shape(ctx, [[-0.08, y], [0.08, y], [0.08, y + 0.24], [-0.08, y + 0.24]], '#5d5864', 0.018);
        }
    }, { ppu: 70, ay: 0, layer: BL - 1 });
}

export function makeWeight() {
    const w = sprite('chainWeight', 2.2, 2.6, ctx => {
        const o = [[-0.9, -1.2], [0.9, -1.2], [1.0, 0.7], [0.4, 1.1], [-0.4, 1.1], [-1.0, 0.7]];
        shape(ctx, o, '#3c3842', 0.06);
        clipTo(ctx, o, () => {
            ctx.fillStyle = vGrad(ctx, 1.1, -1.2, 'rgba(255,190,140,0.2)', 'rgba(0,0,0,0.6)');
            ctx.fillRect(-1.1, -1.3, 2.2, 2.5);
            hatch(ctx, -1, -1.2, 1, 1, 30, 'rgba(0,0,0,0.45)', 0.014, 3);
        });
        stroke(ctx, [[-0.6, -0.2], [0.6, -0.2]], 0.05, '#ff8a3c');
    }, { ppu: 90, ay: 0, layer: BL + 2 });
    const chain = makeChain(14);
    chain.position.y = 2.4;
    const g = pivot(0, 0, chain, w);
    g.userData = { block: w, chain };
    return g;
}

export function makeShadowMark() {
    return sprite('shadowMark', 2.4, 0.5, ctx => {
        ctx.save();
        ctx.scale(1, 0.2);
        radial(ctx, 0, 0, 1.1, '#ff3a1a', 0.75);
        ctx.restore();
    }, { ppu: 60, additive: true, own: true, layer: LAYER.fx });
}
