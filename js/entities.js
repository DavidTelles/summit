import * as THREE from '../lib/three.module.js';
import { INK, LAYER, basic, canvasTexture, clipTo, glowSprite, hatch, mixHex, pivot, radial, rawCanvas, rgba, shape, sprite, stroke, vGrad } from './ink.js';

const PALETTES = {
    1: { stone: '#7b7f86', dark: '#2d3038', deep: '#191b22', moss: '#5f8054', glow: '#7fe3ff', metal: '#8d8878', accent: '#d9c9a0' },
    2: { stone: '#5f7096', dark: '#232d48', deep: '#121830', moss: '#4f6e8f', glow: '#a8d8ff', metal: '#7e8ba8', accent: '#ffe9a8' },
    3: { stone: '#6a4b47', dark: '#2a1a17', deep: '#160d0b', moss: '#83401f', glow: '#ff9a4a', metal: '#5b4d50', accent: '#ffd08a' }
};
let chapter = 1;
let pal = PALETTES[1];
export function setChapterArt(n) {
    chapter = PALETTES[n] ? n : 1;
    pal = PALETTES[chapter];
}
const K = key => `${key}|${chapter}`;
const AETHER = '#7fe3ff';
const damp = (a, b, k) => a + (b - a) * k;

const pulseTex = (color, line, alpha) => ctx => {
    shape(ctx, [[-0.47, -0.47, 1], [-0.47, 0.47, 1], [0.47, 0.47, 1], [0.47, -0.47, 1]], rgba(color, alpha), 0.04, line);
    if (alpha > 0.5) {
        stroke(ctx, [[-0.3, 0.2], [0, 0.3], [0.28, 0.1]], 0.025, rgba('#ffffff', 0.7));
        stroke(ctx, [[-0.25, -0.2], [0.02, -0.08], [0.28, -0.3]], 0.02, rgba(line, 0.55));
    }
};
const makeTexMat = (key, draw) => sprite(key, 1, 1, draw, { ppu: 96, own: true }).material;
const makeClothMat = (key, draw) => sprite(key, 0.8, 0.54, draw, { ax: 0, ppu: 96, own: true }).material;
export const pulseOnMat = makeTexMat('pulseOn', pulseTex('#5cb6e8', '#04263b', 0.95));
export const pulseOffMat = makeTexMat('pulseOff', pulseTex('#8bd7ff', 'rgba(143,215,255,0.5)', 0.1));
export const pulseWarnMat = makeTexMat('pulseWarn', pulseTex('#ffffff', '#8bd7ff', 0.7));
const clothDraw = color => ctx => {
    shape(ctx, [[0, 0.24, 1], [0.5, 0.2], [0.72, 0.24], [0.56, 0.02, 1], [0.72, -0.22], [0.4, -0.24], [0, -0.2, 1]], color, 0.03);
    stroke(ctx, [[0.1, 0.1], [0.4, 0.04]], 0.015, rgba('#000000', 0.4));
};
export const flagOnMat = makeClothMat('clothOn', clothDraw('#59c98b'));
export const flagOffMat = makeClothMat('clothOff', clothDraw('#59606f'));

export function makeAbilityRing(color) {
    const m = sprite('ring', 2.3, 2.3, ctx => {
        ctx.lineWidth = 0.05;
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        for (let i = 0; i <= 90; i++) {
            const a = (i / 90) * Math.PI * 2;
            const r = 1 + Math.sin(a * 5) * 0.012 + Math.sin(a * 13) * 0.008;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.stroke();
        radial(ctx, 0, 0, 1.12, '#ffffff', 0.12);
    }, { ppu: 80, additive: true, own: true, color, layer: LAYER.fx, opacity: 0.9 });
    return m;
}

export function makeAbilityAura(color) {
    return sprite('aura', 2, 2, ctx => {
        radial(ctx, 0, 0, 1, '#ffffff', 0.45);
        ctx.lineWidth = 0.025;
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.arc(0, 0, 0.86, 0, Math.PI * 2);
        ctx.stroke();
    }, { ppu: 64, additive: true, own: true, color, layer: LAYER.player + 8 });
}

export function makeAbilityLance() {
    return sprite('lance', 2.2, 0.5, ctx => {
        ctx.fillStyle = 'rgba(255,240,180,0.35)';
        ctx.fillRect(-1.1, -0.04, 1.9, 0.08);
        shape(ctx, [[-0.7, 0, 1], [0.7, 0.07, 1], [1.05, 0, 1], [0.7, -0.07, 1]], '#fff6d0', 0);
        radial(ctx, 0.75, 0, 0.25, '#ffe9a0', 0.8);
    }, { ppu: 90, additive: true, layer: LAYER.fx });
}

export function makeAbilityMarker(color) {
    return sprite('marker', 1.6, 1.6, ctx => {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.05;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, 0.6, (i * Math.PI * 2) / 3, (i * Math.PI * 2) / 3 + 1.4);
            ctx.stroke();
        }
    }, { ppu: 80, additive: true, own: true, color, layer: LAYER.fx });
}

const P = { dark: '#191a23', cloth: '#2a2b38', cloth2: '#3a3c4d', skin: '#d8b49c', glove: '#14141c', boot: '#1a1a23', strap: '#4a382e', rim: '#747790' };
const K_LAYER = LAYER.player;
const kpart = (key, w, h, draw, ax, ay, order) => sprite(`kael.${key}`, w, h, draw, { ax, ay, layer: K_LAYER + order });

function drawThigh(front) {
    return ctx => {
        const fill = front ? P.cloth2 : P.dark;
        shape(ctx, [[-0.08, 0.03], [0.08, 0.03], [0.07, -0.1], [0.055, -0.21], [-0.05, -0.21], [-0.075, -0.1]], fill);
        if (front) stroke(ctx, [[0.05, -0.02], [0.04, -0.16]], 0.012, P.rim);
    };
}
function drawShin(front) {
    return ctx => {
        shape(ctx, [[-0.055, 0.02], [0.055, 0.02], [0.06, -0.13], [0.06, -0.17], [0.15, -0.2], [0.16, -0.24, 1], [-0.07, -0.24, 1], [-0.06, -0.12]], front ? P.boot : '#0d0d13');
        stroke(ctx, [[-0.045, -0.07], [0.055, -0.08]], 0.018, P.strap);
        if (front) stroke(ctx, [[0.045, 0], [0.05, -0.12]], 0.01, P.rim);
    };
}
function drawUpperArm(front) {
    return ctx => {
        shape(ctx, [[-0.055, 0.04], [0.055, 0.04], [0.05, -0.1], [0.04, -0.17], [-0.04, -0.17], [-0.05, -0.1]], front ? P.cloth2 : P.dark);
    };
}
function drawForeArm(front) {
    return ctx => {
        shape(ctx, [[-0.04, 0.02], [0.04, 0.02], [0.05, -0.1], [0.075, -0.15], [0.065, -0.23], [-0.02, -0.25], [-0.065, -0.2], [-0.05, -0.11]], P.glove);
        stroke(ctx, [[-0.05, -0.08], [0.05, -0.08]], 0.016, front ? '#393b49' : '#22232c');
    };
}
function drawTorso(ctx) {
    const pts = [[-0.14, 0.34], [0.12, 0.34], [0.15, 0.1], [0.12, -0.04], [-0.13, -0.04], [-0.17, 0.12]];
    shape(ctx, pts, P.cloth);
    clipTo(ctx, pts, () => {
        ctx.fillStyle = vGrad(ctx, 0.34, -0.04, 'rgba(70,72,90,0.35)', 'rgba(0,0,0,0.35)');
        ctx.fillRect(-0.3, -0.1, 0.6, 0.5);
        hatch(ctx, -0.14, -0.02, 0, 0.26, 9, 'rgba(0,0,0,0.45)', 0.01, 5);
    });
    stroke(ctx, [[-0.13, 0.03], [0.13, 0.02]], 0.03, P.strap);
    ctx.fillStyle = '#9a7a52';
    ctx.fillRect(0.02, -0.002, 0.05, 0.045);
    stroke(ctx, [[-0.1, 0.3], [0.1, 0.05]], 0.02, P.strap);
}
function drawHood(ctx) {
    const pts = [[-0.3, 0.02], [-0.3, 0.22], [-0.17, 0.38], [0.04, 0.42], [0.22, 0.32], [0.3, 0.12], [0.28, -0.08], [0.18, -0.24], [-0.05, -0.28], [-0.24, -0.2]];
    shape(ctx, pts, P.dark, 0.032);
    clipTo(ctx, pts, () => {
        ctx.fillStyle = vGrad(ctx, 0.42, -0.28, 'rgba(92,94,116,0.5)', 'rgba(0,0,0,0.2)');
        ctx.fillRect(-0.4, -0.3, 0.8, 0.8);
        stroke(ctx, [[-0.28, 0.05], [-0.1, 0.26], [0.08, 0.36]], 0.012, 'rgba(0,0,0,0.6)');
    });
    stroke(ctx, [[-0.26, 0.26], [-0.08, 0.39], [0.1, 0.4]], 0.014, P.rim);
}
function drawFace(ctx) {
    const face = [[-0.02, 0.2], [0.19, 0.2], [0.27, 0.08], [0.27, -0.1], [0.05, -0.12], [-0.04, 0.02]];
    shape(ctx, face, P.skin, 0.022);
    clipTo(ctx, face, () => {
        ctx.fillStyle = 'rgba(60,30,40,0.35)';
        ctx.fillRect(-0.1, 0.1, 0.5, 0.12);
    });
    const mask = [[-0.1, -0.03, 1], [0.1, -0.01], [0.29, 0.015], [0.3, -0.1], [0.22, -0.22], [0.02, -0.26], [-0.15, -0.18]];
    shape(ctx, mask, '#0c0c12', 0.028);
    stroke(ctx, [[0.05, -0.03], [0.14, -0.15], [0.25, -0.17]], 0.011, '#34353f');
    stroke(ctx, [[-0.06, 0.0], [0.16, 0.012], [0.28, 0.008]], 0.012, '#3f404c');
}
function drawEyes(ctx) {
    shape(ctx, [[0.05, 0.075], [0.12, 0.11], [0.15, 0.07], [0.1, 0.045]], '#f6f1e6', 0.012);
    shape(ctx, [[0.19, 0.075], [0.24, 0.105], [0.26, 0.07], [0.22, 0.045]], '#f6f1e6', 0.012);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(0.115, 0.075, 0.021, 0, 7);
    ctx.arc(0.23, 0.075, 0.018, 0, 7);
    ctx.fill();
    stroke(ctx, [[0.03, 0.125], [0.13, 0.135]], 0.014, '#2a0f10');
    stroke(ctx, [[0.19, 0.13], [0.265, 0.115]], 0.013, '#2a0f10');
}
function drawHairTop(ctx) {
    const h = [[-0.17, 0.28, 1], [-0.27, 0.4, 1], [-0.11, 0.37, 1], [-0.13, 0.53, 1], [0.0, 0.42, 1], [0.05, 0.57, 1], [0.13, 0.42, 1], [0.27, 0.48, 1], [0.24, 0.32, 1], [0.37, 0.26, 1], [0.27, 0.18, 1], [0.33, 0.04, 1], [0.21, 0.11, 1], [0.15, 0.0, 1], [0.1, 0.13, 1], [0.02, 0.05, 1], [-0.02, 0.17, 1], [-0.14, 0.13, 1]];
    shape(ctx, h, '#f1f1f1', 0.026);
    clipTo(ctx, h, () => {
        ctx.fillStyle = vGrad(ctx, 0.55, 0.05, 'rgba(255,255,255,0.0)', 'rgba(70,70,70,0.75)');
        ctx.fillRect(-0.4, 0, 0.9, 0.6);
    });
    for (const line of [[[-0.05, 0.42], [0, 0.26], [0.02, 0.14]], [[0.11, 0.38], [0.12, 0.25], [0.15, 0.11]], [[0.23, 0.36], [0.22, 0.24], [0.27, 0.14]]]) stroke(ctx, line, 0.012, 'rgba(60,60,60,0.8)');
    stroke(ctx, [[-0.08, 0.44], [-0.02, 0.33]], 0.012, 'rgba(255,255,255,0.9)');
    stroke(ctx, [[0.05, 0.5], [0.07, 0.38]], 0.012, 'rgba(255,255,255,0.9)');
}
function drawLock(i) {
    return ctx => {
        shape(ctx, i === 0
            ? [[0.03, 0.05], [-0.03, 0.06], [-0.13, -0.1], [-0.13, -0.26, 1], [-0.04, -0.14], [0.04, -0.21, 1], [0.05, -0.04]]
            : [[0.03, 0.03], [-0.03, 0.03], [-0.08, -0.1], [-0.05, -0.23, 1], [0.03, -0.1]], '#e7e7e7', 0.022);
        stroke(ctx, [[0, 0.02], [-0.04, -0.12]], 0.01, 'rgba(50,50,50,0.8)');
    };
}
function drawCloak(i) {
    return ctx => {
        const w = 0.2 - i * 0.03;
        const h = 0.3 - i * 0.03;
        const pts = i === 2
            ? [[-w, 0.03], [w, 0.03], [w * 0.9, -h * 0.5], [w * 0.75, -h, 1], [w * 0.2, -h * 0.65], [-w * 0.1, -h * 1.1, 1], [-w * 0.55, -h * 0.6], [-w, -h * 0.95, 1]]
            : [[-w, 0.04], [w, 0.04], [w * 1.05, -h], [-w * 1.1, -h]];
        shape(ctx, pts, i === 0 ? '#191a23' : i === 1 ? '#15161e' : '#111118', 0.024);
        stroke(ctx, [[-w * 0.3, 0], [-w * 0.4, -h * 0.8]], 0.012, '#30313d');
        stroke(ctx, [[w * 0.45, 0], [w * 0.55, -h * 0.7]], 0.012, '#07070c');
    };
}

export function makePlayer() {
    const group = new THREE.Group();
    const flip = new THREE.Group();
    const body = new THREE.Group();
    const halo = glowSprite(0xe8dcc0, 1.9, { opacity: 0.2, layer: K_LAYER - 3, x: 0, y: 0.72 });
    const fallen = sprite('kael.fallen', 1.4, 1, ctx => {
        shape(ctx, [[-0.6, 0.02, 1], [-0.34, 0.26], [0.1, 0.32], [0.42, 0.18], [0.56, 0.02, 1]], '#191a23', 0.03);
        stroke(ctx, [[-0.4, 0.05], [-0.1, 0.2], [0.3, 0.05]], 0.015, '#3a3c4d');
        shape(ctx, [[-0.08, 0.3, 1], [-0.2, 0.46, 1], [0, 0.4, 1], [0.08, 0.56, 1], [0.16, 0.38, 1], [0.34, 0.43, 1], [0.26, 0.24, 1]], '#d8342a', 0.024);
    }, { ay: 0, layer: K_LAYER + 1, own: true });
    fallen.visible = false;
    const shadow = sprite('kael.shadow', 1.2, 0.3, ctx => {
        ctx.save();
        ctx.scale(1, 0.25);
        radial(ctx, 0, 0, 0.6, '#000000', 0.7);
        ctx.restore();
    }, { ppu: 60, layer: LAYER.shadow, y: -0.02 });

    const cloak = [0, 1, 2].map(i => pivot(0, 0, kpart(`cloak${i}`, 0.6, 0.5, drawCloak(i), 0.5, 0.86, 2 - i)));
    const c0 = pivot(-0.06, 0.32, cloak[0]);
    cloak[1].position.y = -0.26;
    cloak[2].position.y = -0.24;
    cloak[0].add(cloak[1]);
    cloak[1].add(cloak[2]);

    const limb = (upperKey, lowerKey, upper, lower, order, upperLen) => {
        const a = pivot(0, 0, kpart(upperKey, 0.3, 0.32, upper, 0.5, 0.75, order));
        const b = pivot(0, -upperLen, kpart(lowerKey, 0.42, 0.36, lower, 0.42, 0.8, order + 1));
        a.add(b);
        return { a, b };
    };
    const legB = limb('thighB', 'shinB', drawThigh(false), drawShin(false), 3, 0.19);
    const legF = limb('thighF', 'shinF', drawThigh(true), drawShin(true), 7, 0.19);
    const armB = limb('uarmB', 'farmB', drawUpperArm(false), drawForeArm(false), 5, 0.14);
    const armF = limb('uarmF', 'farmF', drawUpperArm(true), drawForeArm(true), 18, 0.14);
    legB.a.position.set(-0.03, 0.02, 0);
    legF.a.position.set(0.04, 0.02, 0);
    armB.a.position.set(-0.05, 0.28, 0);
    armF.a.position.set(0.01, 0.28, 0);

    const torso = kpart('torso', 0.46, 0.52, drawTorso, 0.5, 0.2, 9);
    const hood = kpart('hood', 0.72, 0.8, drawHood, 0.48, 0.42, 11);
    const face = kpart('face', 0.72, 0.56, drawFace, 0.4, 0.55, 12);
    const eyes = kpart('eyes', 0.6, 0.3, drawEyes, 0.3, 0.3, 13);
    const hairTop = sprite('kael.hairTop', 0.84, 0.72, drawHairTop, { ax: 0.45, ay: 0.02, layer: K_LAYER + 15, own: true });
    const lock0 = sprite('kael.lock0', 0.36, 0.42, drawLock(0), { ax: 0.5, ay: 0.82, layer: K_LAYER + 10, own: true });
    const lock1 = sprite('kael.lock1', 0.26, 0.32, drawLock(1), { ax: 0.5, ay: 0.86, layer: K_LAYER + 10, own: true });
    const lockA = pivot(-0.24, 0.12, lock0);
    const lockB = pivot(-0.05, -0.2, lock1);
    lockA.add(lockB);
    const head = pivot(0.0, 0.42, hood, face, eyes, lockA, hairTop);
    const upper = pivot(0, 0.03, torso, armB.a, armF.a, head);
    const hip = pivot(0, 0.4, c0, legB.a, legF.a, upper);
    body.add(hip);
    flip.add(body);
    group.add(shadow, halo, fallen, flip);
    group.userData = {
        halo, fallen, flip, body, hip, upper, head, eyes, cloak, lockA, lockB, legB, legF, armB, armF, shadow, hairMats: [hairTop.material, lock0.material, lock1.material],
        spinAngle: 0, turn: 1, phase: 0, cur: { ...POSES.idle }, cloakA: [0, 0, 0], cloakV: [0, 0, 0], lockV: 0, lockAngle: 0, blink: 2, ghosts: [], ghostT: 0, ghostI: 0, land: 0, wasAir: false
    };
    return group;
}

const POSES = {
    idle: { lean: 0.03, hip: 0.4, tF: 0.1, sF: -0.16, tB: -0.12, sB: -0.16, uF: -0.12, lF: 0.28, uB: 0.14, lB: 0.3, head: -0.03 },
    walk: { lean: 0.09, hip: 0.4, tF: 0, sF: 0, tB: 0, sB: 0, uF: 0, lF: 0.3, uB: 0, lB: 0.3, head: -0.05 },
    run: { lean: 0.3, hip: 0.385, tF: 0, sF: 0, tB: 0, sB: 0, uF: 0, lF: 0.9, uB: 0, lB: 0.9, head: -0.2 },
    jump: { lean: 0.1, hip: 0.42, tF: 1, sF: -1.3, tB: -0.25, sB: -0.5, uF: 1.1, lF: 0.6, uB: -0.75, lB: 0.3, head: 0.05 },
    spin: { lean: 0.1, hip: 0.4, tF: 1.5, sF: -2, tB: 1.3, sB: -2, uF: 0.9, lF: 1.4, uB: 0.9, lB: 1.4, head: 0.1 },
    fall: { lean: -0.05, hip: 0.42, tF: 0.45, sF: -0.85, tB: -0.2, sB: -0.75, uF: 2.1, lF: 0.3, uB: -1.9, lB: 0.3, head: 0.12 },
    land: { lean: 0.45, hip: 0.25, tF: 1.3, sF: -1.9, tB: 0.75, sB: -1.75, uF: -0.5, lF: 0.4, uB: 0.45, lB: 0.5, head: -0.35 },
    dash: { lean: 1.2, hip: 0.4, tF: 0.45, sF: -1.1, tB: -1.05, sB: -0.5, uF: 1.45, lF: 0.05, uB: -1.35, lB: 0.2, head: -0.95 },
    grab: { lean: -0.04, hip: 0.4, tF: 1.05, sF: -1.1, tB: 0.7, sB: -1.3, uF: 2.2, lF: -0.5, uB: 1.9, lB: -0.5, head: 0 },
    climb: { lean: -0.04, hip: 0.4, tF: 0.9, sF: -1.1, tB: 0.6, sB: -1.2, uF: 2.2, lF: -0.5, uB: 2, lB: -0.5, head: 0.08 },
    slide: { lean: -0.12, hip: 0.38, tF: 1, sF: -0.9, tB: 0.5, sB: -1, uF: 2.5, lF: -0.3, uB: -0.3, lB: 0.5, head: 0.1 },
    pound: { lean: 0.2, hip: 0.4, tF: 1.7, sF: -2.1, tB: 1.45, sB: -2.1, uF: 2.8, lF: 0.1, uB: 2.8, lB: 0.1, head: -0.4 },
    hurt: { lean: -0.55, hip: 0.4, tF: 0.5, sF: -0.4, tB: -0.5, sB: -0.5, uF: 2, lF: 0.3, uB: -2, lB: 0.3, head: -0.5 },
    glide: { lean: 0.14, hip: 0.42, tF: 0.3, sF: -0.5, tB: -0.25, sB: -0.5, uF: 1.75, lF: 0.15, uB: -1.75, lB: -0.15, head: -0.1 },
    cast: { lean: 0.1, hip: 0.38, tF: 0.4, sF: -0.5, tB: -0.3, sB: -0.3, uF: 1.55, lF: 0.05, uB: -0.5, lB: 0.4, head: -0.1 },
    dead: { lean: 0, hip: 0.4, tF: 0, sF: 0, tB: 0, sB: 0, uF: 0, lF: 0, uB: 0, lB: 0, head: 0 }
};
const HAIR_COLORS = [0x7b8fb3, 0xd8342a, 0xff5142];

function spawnGhosts(group, u) {
    if (u.ghosts.length || !group.parent) return;
    for (let i = 0; i < 6; i++) {
        const g = sprite('kael.ghost', 1.3, 1.5, ctx => {
            shape(ctx, [[-0.3, 0.55], [-0.1, 0.72], [0.15, 0.72], [0.3, 0.45], [0.25, 0.2], [0.42, -0.1], [0.3, -0.2], [-0.05, -0.05], [-0.48, -0.25], [-0.55, -0.1], [-0.2, 0.2]], '#ffffff', 0);
        }, { ppu: 48, additive: true, own: true, color: 0xe8423a, layer: K_LAYER - 2, opacity: 0, ay: 0.2 });
        g.visible = false;
        group.parent.add(g);
        u.ghosts.push(g);
    }
}

export function animatePlayer(group, p, pose, dt, t) {
    const u = group.userData;
    const fast = pose === 'dash' || pose === 'land' || pose === 'hurt' || pose === 'pound';
    const k = Math.min(1, dt * (fast ? 30 : 15));
    u.turn = damp(u.turn, p.facing, Math.min(1, dt * 26));
    group.position.set(p.x, p.y, 0.1);
    u.fallen.visible = !!p.dead;
    u.flip.visible = !p.dead;

    u.halo.visible = !p.dead;
    if (p.dead) {
        const k = Math.max(0, (p.deadTimer ?? 0) / 0.8);
        u.fallen.scale.x = u.turn >= 0 ? 1 : -1;
        u.fallen.scale.y = 0.5 + k * 0.5;
        u.fallen.material.opacity = k;
        group.visible = true;
        return;
    }
    const flipScale = (u.turn >= 0 ? 1 : -1) * Math.max(0.25, Math.abs(u.turn));
    u.flip.scale.x = flipScale;

    const target = POSES[p.casting > 0 && pose === 'idle' ? 'cast' : pose] || POSES.idle;
    const cur = u.cur;
    for (const key of Object.keys(cur)) cur[key] = damp(cur[key], target[key], k);

    let tF = cur.tF;
    let sF = cur.sF;
    let tB = cur.tB;
    let sB = cur.sB;
    let uF = cur.uF;
    let uB = cur.uB;
    let bob = 0;
    if (pose === 'walk' || pose === 'run') {
        const run = pose === 'run';
        u.phase += dt * Math.abs(p.vx) * (run ? 1.55 : 2.5);
        const a = u.phase;
        const reach = run ? 1.05 : 0.6;
        tF = Math.sin(a) * reach + (run ? 0.18 : 0.05);
        tB = Math.sin(a + Math.PI) * reach + (run ? 0.18 : 0.05);
        sF = -Math.max(0, Math.cos(a) * (run ? 1.55 : 0.85)) - 0.14;
        sB = -Math.max(0, Math.cos(a + Math.PI) * (run ? 1.55 : 0.85)) - 0.14;
        uF = Math.sin(a + Math.PI) * reach * 0.85;
        uB = Math.sin(a) * reach * 0.85;
        bob = Math.abs(Math.cos(a)) * (run ? 0.06 : 0.025);
    }
    if (pose === 'climb') {
        u.phase += dt * 11 * Math.sign(p.climbing || 1);
        const c = Math.sin(u.phase);
        uF += c * 0.4;
        uB -= c * 0.4;
        tF -= c * 0.35;
        tB += c * 0.35;
    }
    const breath = pose === 'idle' ? Math.sin(t * 2.3) : 0;

    const squash = p.squash ?? 1;
    if (p.squash !== undefined) p.squash += (1 - p.squash) * Math.min(1, dt * 14);
    u.body.scale.set(1 / Math.max(0.6, squash), squash, 1);
    u.hip.position.y = cur.hip + bob + breath * 0.006;

    let lean = cur.lean;
    if (pose === 'dash' && p.dashDir && p.dashDir.y !== 0) lean = 1.2 * Math.abs(p.dashDir.x) + (p.dashDir.y > 0 ? -0.35 : 0.8);
    u.hip.rotation.z = -lean;
    if (pose === 'spin') u.spinAngle += dt * 20;
    else u.spinAngle = 0;
    u.body.rotation.z = u.spinAngle ? -u.spinAngle : 0;

    u.upper.rotation.z = -Math.sin(u.phase) * (pose === 'run' ? 0.08 : 0) + breath * 0.012;
    u.legF.a.rotation.z = tF + lean;
    u.legF.b.rotation.z = sF;
    u.legB.a.rotation.z = tB + lean;
    u.legB.b.rotation.z = sB;
    if (p.casting > 0) {
        p.casting -= dt;
        const c = Math.min(1, p.casting * 6);
        if (pose !== 'grab' && pose !== 'climb') uF += (1.55 - uF) * c;
    }
    u.armF.a.rotation.z = uF;
    u.armF.b.rotation.z = cur.lF;
    u.armB.a.rotation.z = uB;
    u.armB.b.rotation.z = cur.lB;
    u.head.rotation.z = cur.head + lean * 0.65 + (pose === 'idle' ? Math.sin(t * 1.1) * 0.025 : 0);

    const facing = flipScale >= 0 ? 1 : -1;
    const vx = (p.vx || 0) * facing;
    const vy = p.vy || 0;
    const wind = Math.sin(t * 2.2) * 0.05 + Math.sin(t * 5.3) * 0.02;
    const want = Math.max(-1.4, Math.min(1.6, -vx * -0.13 + Math.max(-1, Math.min(1, vy * 0.05)) * -0.5)) + wind;
    u.cloak.forEach((seg, i) => {
        const goal = (i === 0 ? want : want * 0.45) + lean * (i === 0 ? 0.9 : 0);
        const spring = (goal - u.cloakA[i]) * 70 - u.cloakV[i] * 11;
        u.cloakV[i] += spring * dt;
        u.cloakA[i] += u.cloakV[i] * dt;
        seg.rotation.z = -u.cloakA[i] + Math.sin(t * 4.4 + i) * 0.02;
    });
    const hairGoal = Math.max(-1.2, Math.min(1.3, vx * 0.11 - vy * 0.04)) + Math.sin(t * 3.6) * 0.06;
    u.lockV += ((hairGoal - u.lockAngle) * 90 - u.lockV * 12) * dt;
    u.lockAngle += u.lockV * dt;
    u.lockA.rotation.z = -u.lockAngle;
    u.lockB.rotation.z = -u.lockAngle * 0.6;

    u.blink -= dt;
    if (u.blink < -0.11) u.blink = 2.4 + Math.abs(Math.sin(t * 7.3)) * 2.8;
    u.eyes.visible = u.blink > 0 && pose !== 'hurt';

    u.halo.position.x = flipScale * 0.02;
    const dashesLeft = Math.min(2, Math.max(0, p.dashes ?? 1));
    u.hairMats.forEach(m => m.color.setHex(HAIR_COLORS[dashesLeft]));
    u.shadow.visible = p.onGround !== false;
    if (pose === 'dash' && group.parent) {
        spawnGhosts(group, u);
        u.ghostT -= dt;
        if (u.ghostT <= 0 && u.ghosts.length) {
            u.ghostT = 0.028;
            const g = u.ghosts[u.ghostI++ % u.ghosts.length];
            g.visible = true;
            g.position.set(p.x, p.y + 0.2, 0.05);
            g.scale.x = facing;
            g.rotation.z = -lean * facing * 0.7;
            g.material.opacity = 0.42;
        }
    }
    u.ghosts.forEach(g => {
        if (!g.visible) return;
        g.material.opacity -= dt * 2.4;
        if (g.material.opacity <= 0) g.visible = false;
    });
    group.visible = !p.dead && ((p.iframes || 0) <= 0 || Math.floor(p.iframes * 16) % 2 === 0);
}

export function makeBerry() {
    const g = new THREE.Group();
    const aura = glowSprite(0xff5a78, 1.3, { opacity: 0.22, layer: LAYER.entity - 1 });
    const fruit = sprite('berry', 0.9, 1, ctx => {
        const b = [[0, -0.4, 1], [-0.28, -0.1], [-0.3, 0.2], [-0.05, 0.3], [0.05, 0.3], [0.3, 0.2], [0.28, -0.1]];
        shape(ctx, b, '#d22a4c', 0.035);
        clipTo(ctx, b, () => {
            ctx.fillStyle = vGrad(ctx, 0.3, -0.4, 'rgba(255,150,150,0.4)', 'rgba(60,0,20,0.55)');
            ctx.fillRect(-0.4, -0.5, 0.8, 0.9);
        });
        ctx.fillStyle = '#ffe2a8';
        for (const [x, y] of [[-0.12, 0.12], [0.08, 0.14], [-0.02, -0.02], [0.15, -0.04], [-0.14, -0.1], [0.03, -0.2]]) ctx.fillRect(x, y, 0.028, 0.04);
        shape(ctx, [[-0.26, 0.3, 1], [-0.1, 0.38, 1], [0, 0.48, 1], [0.1, 0.38, 1], [0.26, 0.3, 1], [0.08, 0.26], [-0.08, 0.26]], '#4f9a58', 0.03);
    }, { ppu: 120 });
    g.add(aura, fruit);
    g.userData = { fruit, aura };
    return g;
}

export function animateBerry(m, t, i) {
    m.userData.fruit.rotation.z = Math.sin(t * 2 + i) * 0.1;
    m.userData.aura.material.opacity = 0.18 + Math.sin(t * 3 + i) * 0.07;
}

export function makeCrystal() {
    const g = new THREE.Group();
    const aura = glowSprite(0x6fdfff, 2.4, { opacity: 0.4, layer: LAYER.entity - 1 });
    const gem = sprite('crystal', 1, 1.5, ctx => {
        const o = [[0, 0.68, 1], [0.33, 0.1, 1], [0.15, -0.66, 1], [-0.17, -0.66, 1], [-0.34, 0.1, 1]];
        shape(ctx, o, '#59c9ec', 0.04, '#07222e');
        shape(ctx, [[0, 0.68, 1], [0.33, 0.1, 1], [0.04, -0.04, 1]], '#b7f1ff', 0.012, '#0a4258');
        shape(ctx, [[0, 0.68, 1], [-0.34, 0.1, 1], [0.04, -0.04, 1]], '#7fdcf5', 0.012, '#0a4258');
        shape(ctx, [[0.04, -0.04, 1], [0.33, 0.1, 1], [0.15, -0.66, 1]], '#2f9fc6', 0.012, '#0a4258');
        stroke(ctx, [[-0.18, 0.24], [-0.05, 0.42]], 0.02, 'rgba(255,255,255,0.9)');
    }, { ppu: 110 });
    g.add(aura, gem);
    g.userData = { gem, aura };
    return g;
}

export function animateCrystal(m, t) {
    m.userData.gem.scale.setScalar(1 + Math.sin(t * 2.4) * 0.05);
    m.userData.gem.rotation.z = Math.sin(t * 1.3) * 0.07;
    m.userData.aura.material.opacity = 0.32 + Math.sin(t * 2.4) * 0.14;
}

export function makeSpring() {
    const g = new THREE.Group();
    const coil = sprite('springCoil', 0.7, 0.42, ctx => {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        for (let i = 0; i <= 28; i++) ctx.lineTo(Math.sin(i * 1.12) * 0.22, i * 0.0145);
        ctx.stroke();
        ctx.strokeStyle = '#b6a06a';
        ctx.lineWidth = 0.025;
        ctx.stroke();
    }, { ay: 0, layer: LAYER.entity });
    coil.position.y = 0.1;
    const base = sprite('springBase', 1, 0.24, ctx => {
        shape(ctx, [[-0.42, 0.02], [-0.34, 0.14], [0.34, 0.14], [0.42, 0.02]], pal.dark, 0.03);
    }, { ay: 0, layer: LAYER.entity + 1 });
    const top = sprite('springTop', 1, 0.3, ctx => {
        shape(ctx, [[-0.4, -0.05], [-0.42, 0.04], [0, 0.11], [0.42, 0.04], [0.4, -0.05]], '#e5c15a', 0.03);
        stroke(ctx, [[-0.2, 0.0], [0.2, 0.01]], 0.02, '#7a6020');
    }, { layer: LAYER.entity + 2 });
    top.position.y = 0.4;
    g.add(coil, base, top);
    g.userData = { top, coil };
    return g;
}

export function makeSpikes(ceiling = false) {
    const spikes = sprite(K('spikes'), 1.06, 0.72, ctx => {
        for (let i = 0; i < 4; i++) {
            const x = -0.4 + i * 0.27;
            const h = 0.46 + (i % 2) * 0.16;
            shape(ctx, [[x - 0.12, -0.3, 1], [x + 0.015, -0.3 + h, 1], [x + 0.13, -0.3, 1]], chapter === 3 ? '#3c2a29' : '#cfd3d8', 0.024);
            stroke(ctx, [[x + 0.03, -0.26], [x + 0.015, -0.3 + h * 0.8]], 0.016, chapter === 3 ? '#ff8a4a' : '#ffffff');
        }
    }, { ppu: 110, layer: LAYER.dress + 1, x: 0.5, y: ceiling ? 0.68 : 0.32 });
    if (ceiling) spikes.rotation.z = Math.PI;
    return pivot(0, 0, spikes);
}

export function makeFlag() {
    const g = new THREE.Group();
    const pole = sprite('flagPole', 0.5, 1.9, ctx => {
        shape(ctx, [[-0.24, 0.0], [-0.13, 0.13], [0.13, 0.13], [0.24, 0.0]], '#494a52', 0.03);
        shape(ctx, [[-0.035, 0.1, 1], [-0.03, 1.8, 1], [0.03, 1.82, 1], [0.04, 0.1, 1]], '#a9a07f', 0.024);
        stroke(ctx, [[-0.06, 0.9], [0.06, 0.87]], 0.02, '#4d3522');
    }, { ay: 0, layer: LAYER.entity - 2 });
    const cloth = sprite('flagCloth', 0.8, 0.54, () => {}, { ax: 0, layer: LAYER.entity - 1, own: true });
    cloth.material = flagOffMat;
    cloth.position.set(0.03, 1.5, 0);
    g.add(pole, cloth);
    g.userData.cloth = cloth;
    return g;
}

export function makeGoal() {
    const g = new THREE.Group();
    const beam = sprite('goalBeam', 2, 14, ctx => {
        const grad = ctx.createLinearGradient(-1, 0, 1, 0);
        grad.addColorStop(0, 'rgba(160,230,255,0)');
        grad.addColorStop(0.5, 'rgba(180,235,255,0.5)');
        grad.addColorStop(1, 'rgba(160,230,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(-1, 0, 2, 14);
    }, { ay: 0, ppu: 14, additive: true, opacity: 0.35, layer: LAYER.back });
    const arch = sprite('goalArch', 2.8, 3.1, ctx => {
        const stone = '#5c6170';
        shape(ctx, [[-1.1, 0.0, 1], [-1.15, 1.2], [-0.8, 2.3], [0, 2.75], [0.8, 2.3], [1.15, 1.2], [1.1, 0.0, 1], [0.72, 0.0, 1], [0.75, 1.15], [0.5, 1.95], [0, 2.25], [-0.5, 1.95], [-0.75, 1.15], [-0.72, 0, 1]], stone, 0.04);
        for (const [x, y, r] of [[-0.92, 1.05, 0], [-0.74, 1.85, 0.7], [0, 2.45, 0], [0.74, 1.85, -0.7], [0.92, 1.05, 0]]) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(r);
            ctx.fillStyle = '#7fe3ff';
            ctx.fillRect(-0.05, -0.1, 0.1, 0.2);
            ctx.restore();
        }
        stroke(ctx, [[-1, 0.5], [-0.8, 0.45]], 0.02, INK);
        stroke(ctx, [[0.8, 1.4], [1.05, 1.5]], 0.02, INK);
    }, { ay: 0, ppu: 100, layer: LAYER.back + 1 });
    const swirl = sprite('goalSwirl', 2, 2, ctx => {
        radial(ctx, 0, 0, 1, '#a8f0ff', 0.75);
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 0.035;
        for (let a = 0; a < 3; a++) {
            ctx.beginPath();
            for (let i = 0; i < 26; i++) {
                const r = i * 0.033;
                const th = a * 2.09 + i * 0.3;
                ctx.lineTo(Math.cos(th) * r, Math.sin(th) * r);
            }
            ctx.stroke();
        }
    }, { ppu: 80, additive: true, layer: LAYER.back + 2 });
    swirl.position.y = 1.15;
    const aura = glowSprite(0x7fe3ff, 3.6, { opacity: 0.35, layer: LAYER.back });
    aura.position.y = 1.2;
    g.add(aura, beam, arch, swirl);
    g.userData = { swirl, ring: arch, core: swirl };
    return g;
}

export function animateGoal(m, t) {
    m.userData.swirl.rotation.z = -t * 1.6;
    m.userData.swirl.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
}

export function makeCrumble() {
    return sprite(K('crumble'), 1.04, 0.62, ctx => {
        const pts = [[-0.5, 0.25], [0.5, 0.25], [0.5, 0.02], [0.3, -0.2, 1], [0.12, -0.08], [-0.08, -0.26, 1], [-0.3, -0.1], [-0.5, -0.2, 1]];
        shape(ctx, pts, mixHex(pal.stone, '#b58d58', 0.55), 0.03);
        stroke(ctx, [[-0.2, 0.25], [-0.12, 0.05], [-0.25, -0.05]], 0.016, INK);
        stroke(ctx, [[0.22, 0.25], [0.15, 0.1], [0.28, -0.02]], 0.016, INK);
    }, { ppu: 110, layer: LAYER.dress });
}

export function makeSpecialBlock(kind) {
    if (kind === 'O' || kind === 'o') {
        const m = sprite('pulseBlock', 1, 1, () => {}, { own: true, layer: LAYER.terrain + 1 });
        m.material = kind === 'O' ? pulseOnMat : pulseOffMat;
        return m;
    }
    return sprite(K(`block${kind}`), 1.04, 1.04, ctx => {
        const base = kind === 'X' ? mixHex(pal.stone, '#a58a6d', 0.45) : mixHex(pal.stone, '#8a74b0', 0.5);
        shape(ctx, [[-0.5, -0.5, 1], [-0.5, 0.5, 1], [0.5, 0.5, 1], [0.5, -0.5, 1]], base, 0.03);
        ctx.fillStyle = vGrad(ctx, 0.5, -0.5, 'rgba(255,255,255,0.1)', 'rgba(0,0,0,0.4)');
        ctx.fillRect(-0.5, -0.5, 1, 1);
        stroke(ctx, [[-0.35, 0.42], [-0.1, 0.12], [-0.28, -0.1], [0.05, -0.42]], 0.03, INK);
        stroke(ctx, [[-0.1, 0.12], [0.3, 0.2]], 0.024, INK);
        stroke(ctx, [[-0.28, -0.1], [0.28, -0.2]], 0.018, INK);
        if (kind === 'Y') {
            ctx.fillStyle = '#c89bff';
            ctx.fillRect(-0.46, 0.4, 0.92, 0.06);
        }
    }, { ppu: 96, layer: LAYER.terrain + 1 });
}

export function makeMover(w, h) {
    return sprite(K(`mover${w},${h}`), w + 0.1, h + 0.5, ctx => {
        const pts = [[0.02, h, 1], [w - 0.02, h, 1], [w - 0.02, 0.12], [w * 0.72, -0.2, 1], [w * 0.5, -0.04], [w * 0.28, -0.26, 1], [0.02, 0.08]];
        shape(ctx, pts, pal.stone, 0.035);
        clipTo(ctx, pts, () => {
            ctx.fillStyle = vGrad(ctx, h, -0.2, 'rgba(255,255,255,0.14)', 'rgba(0,0,0,0.55)');
            ctx.fillRect(0, -0.3, w, h + 0.4);
        });
        ctx.fillStyle = pal.glow;
        ctx.fillRect(w / 2 - 0.25, 0.28, 0.5, 0.06);
        stroke(ctx, [[0.06, h - 0.02], [w - 0.06, h - 0.02]], 0.05, mixHex(pal.stone, '#ffffff', 0.45));
    }, { ax: 0.05 / (w + 0.1), ay: 0.3 / (h + 0.5), ppu: 90, layer: LAYER.entity - 3 });
}

export function makeGust(w, h, fx) {
    const g = new THREE.Group();
    const lanes = [];
    const count = Math.max(4, Math.round((fx ? h : w) * 1.0));
    for (let i = 0; i < count; i++) {
        const offset = ((i + 0.5) / count - 0.5) * (fx ? h : w);
        const lane = sprite('gustLane', 2.2, 0.5, ctx => {
            const grad = ctx.createLinearGradient(-1.1, 0, 1.1, 0);
            grad.addColorStop(0, 'rgba(230,245,255,0)');
            grad.addColorStop(0.8, 'rgba(230,245,255,0.6)');
            grad.addColorStop(1, 'rgba(230,245,255,0)');
            ctx.strokeStyle = grad;
            ctx.lineWidth = 0.035;
            ctx.beginPath();
            ctx.moveTo(-1.05, -0.06);
            ctx.bezierCurveTo(-0.3, 0.03, 0.2, -0.05, 0.75, 0.02);
            ctx.bezierCurveTo(1, 0.05, 1.05, 0.15, 0.9, 0.17);
            ctx.stroke();
        }, { ppu: 80, additive: true, layer: LAYER.fx - 2 }).clone();
        if (fx) lane.position.y = offset;
        else {
            lane.position.x = offset;
            lane.rotation.z = Math.PI / 2;
        }
        lanes.push(lane);
        g.add(lane);
    }
    g.userData.lanes = lanes;
    return g;
}

function chalk(ctx, w, h) {
    const across = w <= h;
    const span = across ? w : h;
    const grad = across ? ctx.createLinearGradient(-w / 2, 0, w / 2, 0) : ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.12, 'rgba(255,255,255,0.16)');
    grad.addColorStop(0.88, 'rgba(255,255,255,0.16)');
    grad.addColorStop(1, 'rgba(255,255,255,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    const edge = Math.min(0.06, span * 0.05);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    if (across) {
        ctx.fillRect(-w / 2, -h / 2, edge, h);
        ctx.fillRect(w / 2 - edge, -h / 2, edge, h);
    } else {
        ctx.fillRect(-w / 2, -h / 2, w, edge);
        ctx.fillRect(-w / 2, h / 2 - edge, w, edge);
    }
}
function boltArt(ctx, w, h) {
    const vertical = h >= w;
    const len = vertical ? h : w;
    const span = vertical ? w : h;
    ctx.save();
    if (!vertical) ctx.rotate(Math.PI / 2);
    const grad = ctx.createLinearGradient(-span / 2, 0, span / 2, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.75)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-span / 2, -len / 2, span, len);
    ctx.strokeStyle = '#ffffff';
    ctx.lineJoin = 'miter';
    ctx.lineWidth = span * 0.15;
    ctx.beginPath();
    const steps = Math.max(5, Math.round(len / 0.9));
    for (let i = 0; i <= steps; i++) ctx.lineTo(((i * 7919) % 11) / 11 * span * 0.55 - span * 0.27, -len / 2 + (i / steps) * len);
    ctx.stroke();
    ctx.restore();
}

export function setTelegraph(mesh, state) {
    const beam = mesh.userData.beam;
    if (!beam) return;
    if (state === 'idle') {
        beam.visible = false;
        if (mesh.userData.flash) mesh.userData.flash.visible = false;
        return;
    }
    beam.visible = true;
    beam.material = state === 'warn' ? mesh.userData.warn : mesh.userData.strike;
    beam.scale.x = state === 'warn' ? 0.92 : 1;
    if (mesh.userData.flash) mesh.userData.flash.visible = state === 'strike';
}

function beamGroup(w, h, centerY, strikeColor) {
    const g = new THREE.Group();
    const key = `${w.toFixed(1)},${h.toFixed(1)}`;
    const ppu = Math.min(40, 1600 / Math.max(w, h));
    const warnMesh = sprite(`warn${key}`, w, h, (ctx, a, b) => chalk(ctx, a, b), { ppu, additive: true, own: true, color: strikeColor, layer: LAYER.fx - 1, opacity: 0.55 });
    const strikeMesh = sprite(`bolt${key}`, w, h, (ctx, a, b) => boltArt(ctx, a, b), { ppu, additive: true, own: true, color: strikeColor, layer: LAYER.fx - 1, opacity: 1 });
    const beam = warnMesh;
    beam.position.y = centerY;
    beam.visible = false;
    g.add(beam);
    g.userData = { beam, warn: warnMesh.material, strike: strikeMesh.material };
    return g;
}

export function makeBolt(w, h) {
    return beamGroup(w, h, 0, 0xd8ecff);
}

export function makeStrike(w, h, color) {
    return beamGroup(w, h, 0, color);
}

export function makeGeyser(w, h) {
    const g = beamGroup(Math.max(0.5, w - 0.2), h, h / 2, 0xff8a3c);
    const vent = sprite('geyserVent', w + 0.3, 0.5, ctx => {
        shape(ctx, [[-w / 2 - 0.1, 0, 1], [-w / 2 + 0.1, 0.24], [-w / 3, 0.17], [w / 3, 0.17], [w / 2 - 0.1, 0.24], [w / 2 + 0.1, 0, 1]], '#332321', 0.03);
        ctx.fillStyle = '#ff8a3c';
        ctx.fillRect(-w / 3, 0.15, (w / 3) * 2, 0.035);
    }, { ay: 0, ppu: 90, layer: LAYER.entity - 2 });
    g.add(vent);
    return g;
}

export function makeFireBar(arms, len) {
    const g = new THREE.Group();
    const hub = sprite('fireHub', 1, 1, ctx => {
        shape(ctx, [[-0.36, -0.2], [-0.2, 0.36], [0.2, 0.36], [0.36, -0.2], [0, -0.38]], '#3a2c2c', 0.035);
        radial(ctx, 0, 0, 0.17, '#ffb060', 1);
    }, { ppu: 90, layer: LAYER.entity });
    g.add(hub);
    for (let a = 0; a < arms; a++) {
        const arm = new THREE.Group();
        arm.rotation.z = (a / arms) * Math.PI * 2;
        for (let r = 0.8; r <= len; r += 0.8) {
            arm.add(sprite('fireBall', 1, 1, ctx => {
                radial(ctx, 0, 0, 0.5, '#ff7a2a', 0.9);
                shape(ctx, [[-0.17, -0.13], [-0.14, 0.09], [-0.04, 0.05], [0, 0.26, 1], [0.1, 0.05], [0.17, 0.09], [0.15, -0.14], [0, -0.21]], '#ffe39a', 0);
            }, { ppu: 72, additive: true, layer: LAYER.fx - 3, x: r }));
        }
        g.add(arm);
    }
    return g;
}

function lavaTexture() {
    const c = rawCanvas(512, 96);
    if (!c) return null;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 96);
    grad.addColorStop(0, '#ffd27a');
    grad.addColorStop(0.2, '#ff7a22');
    grad.addColorStop(0.75, '#b32a10');
    grad.addColorStop(1, '#6d140a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#2a0d08';
    for (let i = 0; i < 22; i++) {
        const x = (i * 97) % 512;
        const w = 22 + ((i * 41) % 42);
        ctx.beginPath();
        ctx.ellipse(x, 30 + ((i * 29) % 52), w, 5 + (i % 4) * 2, 0, 0, 7);
        ctx.fill();
    }
    ctx.fillStyle = '#ffe9a8';
    for (let i = 0; i < 26; i++) ctx.fillRect((i * 67) % 512, 2 + (i % 3), 18 + (i % 4) * 8, 3);
    return canvasTexture(c, true);
}

export function makeLava(w) {
    const g = new THREE.Group();
    const tex = lavaTexture();
    const material = basic(tex);
    if (tex) {
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.repeat.set(Math.max(1, w / 9), 1);
    }
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.6).translate(0, -0.8, 0), material);
    surface.renderOrder = LAYER.dress + 4;
    surface.userData.owned = true;
    const body = new THREE.Mesh(new THREE.PlaneGeometry(w, 42).translate(0, -22.6, 0), basic(null, { color: 0x4a0f07 }));
    body.renderOrder = LAYER.dress + 3;
    const halo = sprite('lavaHalo', 8, 6, ctx => {
        const grad = ctx.createLinearGradient(0, -3, 0, 3);
        grad.addColorStop(0, 'rgba(255,120,40,0.65)');
        grad.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(-4, -3, 8, 6);
    }, { ppu: 16, additive: true, layer: LAYER.back - 3, opacity: 0.8 }).clone();
    halo.scale.x = w / 8;
    halo.position.y = 2.6;
    g.add(halo, body, surface);
    g.userData = { tex };
    return g;
}

export function animateLava(mesh, t) {
    const tex = mesh.userData.tex;
    if (tex) tex.offset.x = t * 0.035 + Math.sin(t * 0.6) * 0.02;
}

const shotDraw = ground => (ctx, w) => {
    if (ground) {
        const pts = [[-0.34, -0.48, 1], [-0.2, 0.08], [-0.07, -0.08], [0, 0.48, 1], [0.1, -0.02], [0.2, 0.18], [0.34, -0.48, 1]];
        radial(ctx, 0, -0.1, 0.5, '#ffffff', 0.75);
        shape(ctx, pts, 'rgba(255,255,255,0.95)', 0);
        return;
    }
    radial(ctx, 0, 0, 0.5, '#ffffff', 0.8);
    shape(ctx, [[-0.2, -0.05], [-0.06, 0.2], [0.17, 0.14], [0.2, -0.1], [-0.02, -0.21]], '#ffffff', 0);
};
export function makeShot(color, r, ground) {
    const m = sprite(ground ? 'shotG' : 'shot', 1, 1, shotDraw(ground), { ppu: 72, additive: true, own: true, color, layer: LAYER.fx + 1 });
    m.scale.set(ground ? r * 2.2 : r * 2.6, ground ? r * 4 : r * 2.6, 1);
    return m;
}

export function makeGate(h) {
    return sprite(K(`gate${h}`), 1.4, h, ctx => {
        for (const x of [-0.42, 0, 0.42]) shape(ctx, [[x - 0.07, 0, 1], [x - 0.07, h - 0.1, 1], [x, h, 1], [x + 0.07, h - 0.1, 1], [x + 0.07, 0, 1]], pal.metal, 0.025);
        for (let y = 1; y < h; y += 2.4) shape(ctx, [[-0.6, y - 0.09, 1], [-0.6, y + 0.09, 1], [0.6, y + 0.09, 1], [0.6, y - 0.09, 1]], pal.dark, 0.025);
    }, { ay: 0, ppu: 40, layer: LAYER.entity + 4 });
}

const orbDraw = ctx => {
    radial(ctx, 0, 0, 0.95, '#ffffff', 0.8);
    const o = [[-0.3, -0.1], [-0.1, 0.3], [0.28, 0.2], [0.3, -0.18], [-0.04, -0.34]];
    shape(ctx, o, '#ffffff', 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 0.04;
    for (let i = 0; i < 6; i++) {
        const a = i * 1.05;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 0.36, Math.sin(a) * 0.36);
        ctx.lineTo(Math.cos(a + 0.22) * 0.55, Math.sin(a + 0.22) * 0.55);
        ctx.lineTo(Math.cos(a - 0.08) * 0.82, Math.sin(a - 0.08) * 0.82);
        ctx.stroke();
    }
};
export function makeStormOrb() {
    const g = new THREE.Group();
    const core = sprite('stormOrb', 2, 2, orbDraw, { ppu: 72, additive: true, own: true, color: 0xa8d8ff, layer: LAYER.fx + 2 });
    const blast = makeAbilityRing(0xfff2b0);
    blast.visible = false;
    g.add(core, blast);
    g.userData = { core, blast };
    return g;
}

export function setOrbReturning(m) {
    m.userData.core.material.color.setHex(0xffe08a);
}

export function setOrbVolley(m) {
    m.userData.core.material.color.setHex(0xff8a6a);
}

export function makeStormCloud() {
    const g = new THREE.Group();
    const cloud = sprite('stormCloud', 6, 3, ctx => {
        const pts = [[-2.7, -0.55], [-2.8, 0.15], [-1.9, 0.55], [-1.5, 1.2], [-0.5, 1.05], [0.1, 1.4], [1, 1], [1.8, 1], [2.6, 0.4], [2.8, -0.45], [1.5, -0.8], [0.5, -0.6], [-0.7, -0.88], [-1.8, -0.72]];
        shape(ctx, pts, '#27324f', 0.05, '#070a14');
        clipTo(ctx, pts, () => {
            ctx.fillStyle = vGrad(ctx, 1.3, -0.9, 'rgba(120,145,190,0.65)', 'rgba(8,12,28,0.65)');
            ctx.fillRect(-3, -1, 6, 2.5);
            for (const [x, y, r] of [[-1.5, 0.15, 0.72], [0, 0.45, 0.8], [1.5, 0.1, 0.72]]) {
                ctx.strokeStyle = 'rgba(160,185,225,0.5)';
                ctx.lineWidth = 0.04;
                ctx.beginPath();
                ctx.arc(x, y, r, 0.5, 2.6);
                ctx.stroke();
            }
        });
    }, { ppu: 70, layer: LAYER.entity + 6 });
    const gleam = sprite('stormGleam', 1.8, 1, ctx => {
        radial(ctx, 0, 0, 0.5, '#fff2b0', 1);
        shape(ctx, [[-0.5, 0], [0, 0.17], [0.5, 0], [0, -0.17]], '#fff8d8', 0);
        ctx.fillStyle = INK;
        ctx.fillRect(-0.04, -0.14, 0.08, 0.28);
    }, { ppu: 80, layer: LAYER.entity + 7 });
    gleam.visible = false;
    g.add(cloud, gleam);
    g.userData = { gleam };
    return g;
}

export function makeStormPlate(w) {
    return sprite(K(`plate${w.toFixed(2)}`), w, 0.4, (ctx, a) => {
        shape(ctx, [[-a / 2 + 0.25, 0.03, 1], [-a / 2 + 0.25, 0.14, 1], [a / 2 - 0.25, 0.14, 1], [a / 2 - 0.25, 0.03, 1]], '#3d4b6c', 0.022);
        ctx.fillStyle = '#7fc6ff';
        ctx.fillRect(-a / 2 + 0.3, 0.1, 0.14, 0.05);
        ctx.fillRect(a / 2 - 0.44, 0.1, 0.14, 0.05);
    }, { ay: 0, ppu: 60, layer: LAYER.dress + 1 });
}

export function makeStormRod() {
    const g = new THREE.Group();
    g.add(sprite('rodBody', 1.2, 2.4, ctx => {
        shape(ctx, [[-0.42, 0, 1], [-0.28, 0.27], [0.28, 0.27], [0.42, 0, 1]], '#3b3f4e', 0.03);
        shape(ctx, [[-0.06, 0.25, 1], [-0.05, 2.1, 1], [0.05, 2.1, 1], [0.06, 0.25, 1]], '#a0713f', 0.024);
        for (const y of [0.7, 1.15, 1.6]) stroke(ctx, [[-0.18, y], [0.18, y + 0.02]], 0.03, '#c78f50');
    }, { ay: 0, ppu: 80, layer: LAYER.entity - 2 }));
    const tipDraw = ctx => {
        radial(ctx, 0, 0, 0.5, '#ffffff', 0.9);
        shape(ctx, [[0, 0.3, 1], [0.18, 0, 1], [0, -0.3, 1], [-0.18, 0, 1]], '#ffffff', 0.02);
    };
    const tip = sprite('rodTip', 1, 1, tipDraw, { ppu: 72, own: true, color: 0x687388, layer: LAYER.entity - 1 });
    const tipOff = tip.material;
    const tipOn = basic(tip.material.map, { additive: true, color: 0xffe08a });
    tip.position.y = 2.28;
    g.add(tip);
    g.userData = { tip, tipOff, tipOn };
    return g;
}

export function makeAimLine(color) {
    const line = sprite('aimLine', 1, 0.4, ctx => {
        const grad = ctx.createLinearGradient(0, -0.2, 0, 0.2);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.95)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(-0.5, -0.2, 1, 0.4);
    }, { ppu: 40, additive: true, own: true, color, layer: LAYER.fx, opacity: 0.85 });
    line.visible = false;
    return line;
}

export function setAimLine(line, x1, y1, x2, y2, width = 1) {
    const len = Math.hypot(x2 - x1, y2 - y1) || 0.01;
    line.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0.6);
    line.rotation.z = Math.atan2(y2 - y1, x2 - x1);
    line.scale.set(len, width, 1);
    line.visible = true;
}

export function makeBossSlab(w, h) {
    const g = new THREE.Group();
    const draw = hot => ctx => {
        const pts = [[-w / 2, h / 2, 1], [w / 2, h / 2, 1], [w / 2, -h / 2 + 0.08], [w * 0.26, -h / 2 - 0.1], [-w * 0.1, -h / 2 + 0.02], [-w / 2, -h / 2 - 0.08]];
        shape(ctx, pts, '#2c1b1a', 0.035);
        stroke(ctx, [[-w / 2 + 0.03, h / 2 - 0.05], [w / 2 - 0.03, h / 2 - 0.05]], 0.08, '#6d4336');
        const color = hot ? '#ff9a3c' : '#120a09';
        for (let i = -1; i <= 1; i++) {
            const x = i * (w / 3.2);
            stroke(ctx, [[x, h / 2 - 0.1], [x + 0.14, h * 0.08], [x - 0.08, -h * 0.1], [x + 0.06, -h / 2 + 0.05]], hot ? 0.08 : 0.04, color);
        }
    };
    const body = sprite(`slab${w},${h}`, w + 0.1, h + 0.4, draw(false), { ppu: 56, own: true, layer: LAYER.terrain + 2 });
    const hotBody = sprite(`slabHot${w},${h}`, w + 0.1, h + 0.4, draw(true), { ppu: 56, own: true, layer: LAYER.terrain + 2 });
    g.add(body);
    g.userData = { body, off: body.material, hot: hotBody.material };
    return g;
}

export function setSlabHot(m, hot) {
    const u = m.userData;
    const material = hot ? u.hot : u.off;
    if (u.body.material !== material) u.body.material = material;
}

export function makeMagmaPylon() {
    const g = new THREE.Group();
    g.add(sprite('pylonBase', 1.6, 0.6, ctx => {
        shape(ctx, [[-0.7, 0, 1], [-0.45, 0.42], [0.45, 0.42], [0.7, 0, 1]], '#2c2226', 0.035);
    }, { ay: 0, ppu: 80, layer: LAYER.entity - 2 }));
    const aura = glowSprite(0xff8a3c, 2.4, { opacity: 0.5, layer: LAYER.entity - 3, x: 0, y: 1.25 });
    const crystal = sprite('pylonCrystal', 1.2, 2, ctx => {
        const o = [[0, 0.92, 1], [0.42, 0.25, 1], [0.32, -0.8, 1], [-0.3, -0.8, 1], [-0.44, 0.2, 1]];
        shape(ctx, o, '#ff8a3c', 0.04, '#3a1205');
        shape(ctx, [[0, 0.92, 1], [-0.44, 0.2, 1], [-0.04, -0.15, 1]], '#ffc27a', 0.012, '#7a2a0a');
        shape(ctx, [[0, 0.92, 1], [0.42, 0.25, 1], [-0.04, -0.15, 1]], '#ffe09a', 0.012, '#7a2a0a');
    }, { ppu: 80, layer: LAYER.entity - 1 });
    crystal.position.y = 1.25;
    g.add(aura, crystal);
    g.userData = { crystal };
    return g;
}

export function makeSealPad() {
    const g = new THREE.Group();
    g.add(sprite('sealBase', 2.6, 0.4, ctx => {
        shape(ctx, [[-1.2, 0, 1], [-1.05, 0.18], [1.05, 0.18], [1.2, 0, 1]], '#2c2226', 0.03);
    }, { ay: 0, ppu: 70, layer: LAYER.entity - 2 }));
    const runeDraw = ctx => {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.045;
        ctx.beginPath();
        ctx.moveTo(-0.65, 0);
        ctx.lineTo(-0.25, 0.18);
        ctx.lineTo(0, -0.14);
        ctx.lineTo(0.25, 0.18);
        ctx.lineTo(0.65, 0);
        ctx.stroke();
        radial(ctx, 0, 0, 0.75, '#ffffff', 0.35);
    };
    const rune = sprite('sealRune', 1.6, 0.6, runeDraw, { ppu: 80, own: true, additive: true, color: 0xc89bff, layer: LAYER.entity });
    rune.position.y = 0.35;
    const offMat = rune.material;
    const onMat = basic(rune.material.map, { additive: true, color: 0x7dffa8 });
    g.add(rune);
    g.userData = { rune, offMat, onMat };
    return g;
}

export function makeMagmite(kind) {
    const g = new THREE.Group();
    const feeder = kind === 'feeder';
    const body = sprite(`magmite${kind}`, 1.5, 1.5, ctx => {
        const shell = feeder ? '#6d4a2c' : '#3a2c2c';
        const o = [[-0.42, -0.42], [-0.5, 0.05], [-0.3, 0.42], [0.1, 0.5], [0.45, 0.25], [0.52, -0.15], [0.32, -0.45]];
        shape(ctx, o, shell, 0.04);
        clipTo(ctx, o, () => {
            ctx.fillStyle = vGrad(ctx, 0.5, -0.5, 'rgba(255,255,255,0.1)', 'rgba(0,0,0,0.55)');
            ctx.fillRect(-0.6, -0.6, 1.2, 1.2);
        });
        const eye = feeder ? '#7dffa8' : '#ff8a3c';
        shape(ctx, [[0.05, 0.02], [0.2, 0.12], [0.42, 0.04], [0.3, -0.06]], eye, 0.02);
        shape(ctx, [[-0.35, -0.42, 1], [-0.22, -0.65, 1], [-0.12, -0.42, 1]], shell, 0.03);
        shape(ctx, [[0.1, -0.44, 1], [0.24, -0.66, 1], [0.34, -0.42, 1]], shell, 0.03);
        if (kind === 'guard') {
            shape(ctx, [[-0.42, 0.28, 1], [-0.1, 0.72, 1], [0.32, 0.64, 1], [0.45, 0.2, 1]], '#201a1e', 0.03);
        }
        if (feeder) radial(ctx, -0.1, 0.48, 0.3, '#7dffa8', 0.9);
    }, { ppu: 90, layer: LAYER.entity });
    body.position.y = 0.55;
    g.add(body);
    g.userData = { magmite: body };
    return g;
}

export function makeSigil() {
    return sprite('sigil', 2.6, 2.6, ctx => {
        radial(ctx, 0, 0, 1.3, '#c89bff', 0.55);
        ctx.strokeStyle = '#efe0ff';
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.moveTo(0, 1.1);
        ctx.lineTo(0.75, 0);
        ctx.lineTo(0, -1.1);
        ctx.lineTo(-0.75, 0);
        ctx.closePath();
        ctx.moveTo(-0.3, 0);
        ctx.lineTo(0.3, 0);
        ctx.stroke();
    }, { ppu: 70, additive: true, layer: LAYER.fx - 2 });
}

const leg = (key, len, wid, color, order, foot = 0.1) => sprite(K(key), wid * 3 + foot, len + 0.15, ctx => {
    shape(ctx, [[-wid, 0.03], [wid, 0.03], [wid * 0.7, -len * 0.6], [wid * 0.45 + foot, -len, 1], [-wid * 0.6, -len, 1], [-wid * 0.8, -len * 0.5]], color, 0.028);
}, { ay: (len + 0.08) / (len + 0.15), layer: LAYER.entity + order });
const eyeOf = (ctx, x, y, r, color) => {
    radial(ctx, x, y, r * 3, color, 0.6);
    shape(ctx, [[x - r, y], [x, y + r * 0.7], [x + r, y], [x, y - r * 0.7]], '#fff8e8', 0.016);
};

export function makeWalker() {
    const g = new THREE.Group();
    const stone = pal.stone;
    const body = sprite(K('walker'), 1.3, 1.2, ctx => {
        const o = [[-0.5, 0.17], [-0.47, 0.5], [-0.2, 0.74], [0.16, 0.72], [0.42, 0.52], [0.48, 0.28], [0.44, 0.14], [-0.2, 0.08]];
        shape(ctx, o, pal.dark, 0.036);
        clipTo(ctx, o, () => {
            ctx.fillStyle = stone;
            for (const [x1, y1, x2, y2] of [[-0.48, 0.5, -0.1, 0.8], [-0.14, 0.42, 0.22, 0.8], [0.14, 0.32, 0.5, 0.68]]) {
                shape(ctx, [[x1, y1, 1], [x2, y2 - 0.08, 1], [x2 + 0.02, y1 + 0.06, 1], [x1 + 0.18, y1 - 0.08, 1]], stone, 0.02);
            }
            hatch(ctx, -0.45, 0.12, 0.45, 0.48, 16, 'rgba(0,0,0,0.4)', 0.012, 9);
        });
        shape(ctx, [[0.2, 0.42], [0.47, 0.5], [0.57, 0.32], [0.44, 0.15], [0.2, 0.22]], stone, 0.032);
        eyeOf(ctx, 0.42, 0.33, 0.075, pal.glow);
        shape(ctx, [[0.3, 0.17, 1], [0.34, 0.08, 1], [0.39, 0.16, 1]], '#d5d0bc', 0.015);
        if (chapter === 1) stroke(ctx, [[-0.3, 0.72], [-0.1, 0.8], [0.1, 0.74]], 0.05, pal.moss);
    }, { ay: 0, layer: LAYER.entity + 2 });
    const feet = [[-0.26, 0], [0.24, 1]].map(([x, i]) => {
        const f = leg(`walkerLeg`, 0.22, 0.09, pal.deep, i ? 3 : 1);
        const p = pivot(x, 0.22, f);
        p.userData.base = 0.22;
        return p;
    });
    const bodyP = pivot(0, 0, body);
    g.add(bodyP, ...feet);
    g.userData = { body: bodyP, feet };
    return g;
}

export function makeFlyer() {
    const g = new THREE.Group();
    const wing = sprite(K('flyerWing'), 1.3, 0.9, ctx => {
        const o = [[0, 0, 1], [0.32, 0.5], [0.85, 0.62, 1], [1, 0.3], [0.78, 0.05], [0.42, 0.02]];
        shape(ctx, o, mixHex(pal.glow, '#d9dee8', 0.65), 0.024);
        stroke(ctx, [[0.05, 0.03], [0.6, 0.48]], 0.012, INK);
        stroke(ctx, [[0.05, 0.03], [0.75, 0.22]], 0.012, INK);
    }, { ax: 0.08, ay: 0.1, layer: LAYER.entity + 1 });
    const wingL = pivot(-0.08, 0.5, wing);
    const wingR = pivot(0.1, 0.5, wing.clone());
    wingR.rotation.y = Math.PI;
    const body = sprite(K('flyer'), 1, 1, ctx => {
        const o = [[-0.36, 0.05], [-0.15, 0.3], [0.2, 0.3], [0.38, 0.05], [0.2, -0.22], [0, -0.42, 1], [-0.2, -0.2]];
        shape(ctx, o, pal.dark, 0.036);
        stroke(ctx, [[-0.26, -0.02], [0.28, -0.02]], 0.03, pal.stone);
        eyeOf(ctx, 0.18, 0.1, 0.08, pal.glow);
        shape(ctx, [[-0.12, 0.27, 1], [-0.22, 0.46, 1], [-0.02, 0.3, 1]], pal.dark, 0.02);
    }, { layer: LAYER.entity + 3, y: 0.42 });
    g.add(wingL, wingR, body);
    g.userData = { wingL, wingR };
    return g;
}

export function makeCharger() {
    const g = new THREE.Group();
    const body = sprite(K('charger'), 2.1, 1.5, ctx => {
        const o = [[-0.78, 0.25], [-0.72, 0.72], [-0.3, 0.98], [0.2, 0.92], [0.56, 0.72], [0.82, 0.52], [0.94, 0.28], [0.74, 0.13], [0.3, 0.18], [-0.5, 0.16]];
        shape(ctx, o, pal.stone, 0.04);
        clipTo(ctx, o, () => {
            ctx.fillStyle = vGrad(ctx, 0.98, 0.1, 'rgba(255,255,255,0.1)', 'rgba(0,0,0,0.6)');
            ctx.fillRect(-1, 0, 2, 1.1);
            hatch(ctx, -0.7, 0.2, 0.3, 0.6, 22, 'rgba(0,0,0,0.42)', 0.013, 12);
            stroke(ctx, [[-0.45, 1], [-0.34, 0.45], [-0.5, 0.2]], 0.025, INK);
            stroke(ctx, [[0.1, 1], [0.2, 0.55], [0.06, 0.2]], 0.025, INK);
        });
        shape(ctx, [[0.52, 0.62, 1], [0.92, 0.82, 1], [1.02, 1.08, 1], [1.0, 0.72], [0.68, 0.45, 1]], '#d8ceb4', 0.028);
        eyeOf(ctx, 0.68, 0.42, 0.075, pal.glow);
    }, { ay: 0, layer: LAYER.entity + 2 });
    const feet = [[-0.45, 0], [-0.2, 1], [0.32, 0], [0.56, 1]].map(([x, near]) => {
        const p = pivot(x, 0.3, leg('chargerLeg', 0.3, 0.1, near ? pal.dark : pal.deep, near ? 3 : 1));
        p.userData.base = 0.3;
        return p;
    });
    const bodyP = pivot(0, 0, body);
    g.add(bodyP, ...feet);
    g.userData = { body: bodyP, feet };
    return g;
}

export function makeSpitter() {
    const g = new THREE.Group();
    g.add(sprite(K('spitterStem'), 1.1, 0.9, ctx => {
        shape(ctx, [[-0.42, 0, 1], [-0.26, 0.24], [-0.1, 0.72], [0.1, 0.72], [0.26, 0.24], [0.42, 0, 1]], pal.moss, 0.032);
        stroke(ctx, [[-0.03, 0.05], [0.02, 0.65]], 0.022, INK);
        for (const s of [-1, 1]) shape(ctx, [[0, 0.2], [s * 0.3, 0.45], [s * 0.5, 0.25], [s * 0.3, 0.14]], mixHex(pal.moss, '#000000', 0.25), 0.024);
    }, { ay: 0, layer: LAYER.entity + 1 }));
    const headMesh = sprite(K('spitterHead'), 1.3, 1, ctx => {
        const o = [[-0.36, -0.1], [-0.28, 0.27], [0.08, 0.34], [0.46, 0.2, 1], [0.2, 0.0, 1], [0.46, -0.14, 1], [0.08, -0.3], [-0.28, -0.26]];
        shape(ctx, o, pal.stone, 0.036);
        radial(ctx, 0.2, 0, 0.15, pal.glow, 1);
        eyeOf(ctx, -0.08, 0.1, 0.07, pal.glow);
    }, { layer: LAYER.entity + 2 });
    const head = pivot(0.06, 0.8, headMesh);
    g.add(head);
    g.userData = { head };
    return g;
}

export function makeShieldbearer() {
    const g = new THREE.Group();
    const body = pivot(0, 0, sprite(K('shieldBody'), 1.1, 1.7, ctx => {
        const o = [[-0.33, 0.2], [-0.38, 0.84], [-0.2, 1.3], [0.16, 1.34], [0.3, 1.04], [0.3, 0.2]];
        shape(ctx, o, pal.dark, 0.036);
        shape(ctx, [[-0.22, 1.02], [-0.22, 1.42], [0.0, 1.57, 1], [0.24, 1.4], [0.24, 1.02], [0.02, 0.94]], pal.stone, 0.032);
        eyeOf(ctx, 0.09, 1.23, 0.06, pal.glow);
    }, { ay: 0, layer: LAYER.entity + 2 }), sprite(K('shield'), 0.8, 1.7, ctx => {
        const o = [[-0.18, 0.1], [-0.25, 0.9], [-0.18, 1.5, 1], [0.15, 1.3], [0.2, 0.2], [0, 0, 1]];
        shape(ctx, o, mixHex(pal.metal, pal.stone, 0.4), 0.04);
        stroke(ctx, [[-0.02, 0.1], [-0.03, 1.32]], 0.03, INK);
        stroke(ctx, [[-0.16, 0.72], [0.14, 0.76]], 0.03, INK);
        radial(ctx, -0.03, 0.74, 0.14, pal.glow, 0.9);
    }, { ay: 0, layer: LAYER.entity + 4, x: 0.42, y: 0.08 }));
    const feet = [[-0.17, 0], [0.13, 1]].map(([x, i]) => {
        const p = pivot(x, 0.26, leg('shieldLeg', 0.26, 0.09, i ? pal.dark : pal.deep, i ? 3 : 1));
        p.userData.base = 0.26;
        return p;
    });
    g.add(body, ...feet);
    g.userData = { body, feet };
    return g;
}

export function makeDiver() {
    const g = new THREE.Group();
    const wing = sprite(K('diverWing'), 1.5, 1, ctx => {
        shape(ctx, [[0, 0, 1], [0.32, 0.46], [0.75, 0.62], [1.2, 0.72, 1], [1.02, 0.26], [0.82, 0.3, 1], [0.66, 0.05], [0.42, 0.14, 1], [0.24, -0.08]], pal.dark, 0.028);
        stroke(ctx, [[0.05, 0.04], [0.95, 0.56]], 0.014, pal.stone);
    }, { ax: 0.06, ay: 0.25, layer: LAYER.entity + 1 });
    const wingL = pivot(-0.12, 0.4, wing);
    const wingR = pivot(0.04, 0.4, wing.clone());
    wingR.rotation.y = Math.PI;
    g.add(wingL, wingR, sprite(K('diver'), 1.5, 0.9, ctx => {
        const o = [[-0.6, 0.02, 1], [-0.25, 0.2], [0.22, 0.24], [0.68, 0.0, 1], [0.2, -0.18], [-0.25, -0.1]];
        shape(ctx, o, pal.stone, 0.032);
        eyeOf(ctx, 0.3, 0.06, 0.06, pal.glow);
        shape(ctx, [[-0.6, 0.02, 1], [-0.75, 0.1, 1], [-0.42, -0.02, 1]], pal.dark, 0.02);
    }, { layer: LAYER.entity + 3, y: 0.38 }));
    g.userData = { wingL, wingR };
    return g;
}

export function makeSentinel() {
    const g = new THREE.Group();
    const core = sprite(K('sentinel'), 1.6, 1.6, ctx => {
        const o = [[-0.4, -0.15, 1], [-0.17, 0.42, 1], [0.17, 0.42, 1], [0.4, -0.15, 1], [0.17, -0.44, 1], [-0.17, -0.44, 1]];
        shape(ctx, o, pal.metal, 0.04);
        stroke(ctx, [[-0.32, -0.05], [0.32, -0.06]], 0.02, INK);
        for (const [x, y] of [[-0.14, 0.27], [0.14, 0.27], [-0.14, -0.28], [0.14, -0.28]]) {
            ctx.fillStyle = INK;
            ctx.beginPath();
            ctx.arc(x, y, 0.025, 0, 7);
            ctx.fill();
        }
        eyeOf(ctx, 0, 0.1, 0.11, pal.glow);
    }, { layer: LAYER.entity + 3, y: 0.5 });
    g.add(core);
    const orbs = [0, 1].map(() => sprite('sentinelOrb', 1.2, 1.2, ctx => {
        radial(ctx, 0, 0, 0.6, '#ffb060', 0.85);
        shape(ctx, [[-0.22, -0.04], [-0.05, 0.24], [0.24, 0.14], [0.22, -0.15], [-0.05, -0.25]], '#fff0c0', 0.02, '#7a3a10');
    }, { ppu: 72, additive: true, layer: LAYER.fx - 3 }).clone());
    g.add(...orbs);
    g.userData = { core, orbs };
    return g;
}

export function animateEnemy(m, e, t) {
    const u = m.userData;
    if (u.wingL) {
        const rate = e.state === 'swoop' ? 34 : 18;
        const w = Math.sin(t * rate + e.ox);
        u.wingL.rotation.z = 0.2 + w * 0.65;
        u.wingR.rotation.z = 0.2 + w * 0.65;
        u.wingL.scale.y = 0.8 + w * 0.2;
    }
    if (u.feet) {
        const moving = e.state === 'idle' || e.state === 'charge' || e.state === 'bash';
        const rate = e.state === 'charge' ? 26 : 10;
        u.feet.forEach((f, i) => {
            const s = moving ? Math.sin(t * rate + i * 2.6) : 0;
            f.rotation.z = s * 0.55;
            f.position.y = f.userData.base + (moving ? Math.max(0, s) * 0.07 : 0);
        });
    }
    if (u.body) {
        let tilt = 0;
        let lift = 0;
        if (e.state === 'tell') { tilt = 0.28; lift = Math.sin(t * 40) * 0.03; }
        if (e.state === 'charge' || e.state === 'bash') tilt = -0.2;
        if (e.state === 'stunned') { tilt = 0.45; lift = Math.sin(t * 22) * 0.02; }
        if (e.state === 'recover') tilt = 0.2;
        if (e.state === 'turning') lift = 0.06;
        u.body.rotation.z = -tilt;
        u.body.position.y = lift + Math.sin(t * 5 + e.ox) * 0.015;
    }
    if (u.head) {
        const swell = e.state === 'tell' ? 1.25 + Math.sin(t * 30) * 0.05 : 1 + Math.sin(t * 3 + e.ox) * 0.03;
        u.head.scale.setScalar(swell);
        u.head.rotation.z = Math.sin(t * 1.6 + e.ox) * 0.08;
    }
    if (u.orbs) {
        u.core.rotation.z = Math.sin(t * 1.4) * 0.15;
        u.orbs.forEach((o, i) => {
            const a = e.phase + i * Math.PI;
            const side = m.rotation.y === 0 ? 1 : -1;
            o.position.set(Math.cos(a) * (e.orbR || 2) * side, 0.5 + Math.sin(a) * (e.orbR || 2), 0);
            o.scale.setScalar(1 + Math.sin(t * 9 + i) * 0.1);
        });
    }
}

const BL = LAYER.entity + 10;
export function makeRamBoss() {
    const g = new THREE.Group();
    const legPart = (near, order) => sprite(`ramLeg${near}`, 1.2, 1.45, ctx => {
        const fill = near ? '#413c37' : '#26231f';
        shape(ctx, [[-0.28, 0.1], [0.26, 0.1], [0.22, -0.48], [0.3, -0.92], [0.46, -1.16, 1], [-0.3, -1.16, 1], [-0.28, -0.6]], fill, 0.04);
        for (const x of [-0.14, 0.1, 0.32]) shape(ctx, [[x - 0.07, -1.16, 1], [x + 0.02, -1.28, 1], [x + 0.09, -1.16, 1]], '#c9bea3', 0.018);
        stroke(ctx, [[-0.1, 0], [-0.05, -0.65]], 0.02, '#17140f');
    }, { ay: 0.9, layer: BL + order });
    const legs = [[-1, 0.95, 0], [1, 0.95, 0], [-0.75, 0.98, 1], [0.76, 0.98, 1]].map(([x, y, near]) => {
        const p = pivot(x, y, legPart(near, near ? 6 : 0));
        return p;
    });
    const bodyPts = [[-1.6, -0.45], [-1.72, 0.15], [-1.25, 0.72], [-0.3, 1.0], [0.72, 0.92], [1.42, 0.45], [1.48, -0.26], [0.85, -0.68], [-0.2, -0.75], [-1.1, -0.72]];
    const bodyMesh = sprite('ramBody', 3.8, 2.9, ctx => {
        shape(ctx, bodyPts, '#5b554d', 0.055);
        clipTo(ctx, bodyPts, () => {
            ctx.fillStyle = vGrad(ctx, 1, -0.8, 'rgba(235,222,190,0.2)', 'rgba(0,0,0,0.62)');
            ctx.fillRect(-2, -1, 4, 2.2);
            hatch(ctx, -1.6, -0.7, 1.3, 0.1, 54, 'rgba(0,0,0,0.42)', 0.016, 21);
            for (const line of [[[-1.1, 0.8], [-0.82, 0.2], [-1.05, -0.3], [-0.85, -0.76]], [[-0.1, 1], [0.12, 0.48], [-0.1, -0.05], [0.14, -0.74]], [[0.86, 0.92], [0.75, 0.3], [0.95, -0.28]]]) stroke(ctx, line, 0.03, '#17140f');
        });
        for (const [x, y, s] of [[-1.15, 0.88, 0.3], [-0.55, 1.08, 0.42], [0.1, 1.15, 0.5], [0.72, 1.05, 0.38]]) {
            shape(ctx, [[x - s * 0.5, y - s * 0.25, 1], [x + s * 0.1, y + s, 1], [x + s * 0.5, y - s * 0.25, 1]], '#3a352f', 0.03);
        }
        shape(ctx, [[-1.62, 0.25], [-2, 0.5], [-1.9, 0.1], [-2.1, -0.02], [-1.65, -0.15]], '#3a352f', 0.035);
    }, { ppu: 100, layer: BL + 3 });
    const coreMat = sprite('ramCore', 1.6, 1.6, ctx => {
        radial(ctx, 0, 0, 0.8, '#ff8a3c', 0.95);
        shape(ctx, [[-0.3, -0.1, 1], [-0.1, 0.34, 1], [0.15, 0.1, 1], [0.34, 0.26, 1], [0.24, -0.3, 1], [-0.1, -0.2, 1]], '#ffe39a', 0.02, '#7a2a0a');
    }, { ppu: 80, additive: true, own: true, layer: BL + 4 });
    coreMat.position.set(0.32, -0.1, 0);
    const eyeMesh = sprite('ramEye', 1.4, 0.8, ctx => {
        radial(ctx, 0.15, 0, 0.45, '#ffc040', 0.9);
        shape(ctx, [[-0.16, -0.02, 1], [0.04, 0.09], [0.4, 0.0, 1], [0.1, -0.07]], '#fff0b0', 0.018, '#402000');
    }, { ppu: 80, additive: true, own: true, layer: BL + 8 });
    eyeMesh.position.set(0.28, 0.1, 0);
    const headMesh = sprite('ramHead', 2.4, 2.6, ctx => {
        const o = [[-0.62, -0.3], [-0.55, 0.42], [-0.1, 0.72], [0.48, 0.42], [0.82, 0.05], [0.98, -0.36], [0.62, -0.62], [0.05, -0.65]];
        shape(ctx, o, '#68625a', 0.05);
        clipTo(ctx, o, () => {
            ctx.fillStyle = vGrad(ctx, 0.72, -0.65, 'rgba(255,240,210,0.15)', 'rgba(0,0,0,0.55)');
            ctx.fillRect(-1, -0.8, 2, 1.6);
            hatch(ctx, -0.5, -0.5, 0.5, 0.0, 18, 'rgba(0,0,0,0.42)', 0.014, 8);
        });
        stroke(ctx, [[0.2, -0.3], [0.5, -0.4], [0.9, -0.34]], 0.03, '#17140f');
        for (const x of [0.5, 0.68, 0.84]) shape(ctx, [[x - 0.05, -0.38, 1], [x, -0.54, 1], [x + 0.06, -0.36, 1]], '#d9cfb8', 0.016);
        const horn = [[-0.38, 0.36], [-0.82, 0.86], [-0.62, 1.2], [-0.14, 1.28], [0.44, 0.98], [0.74, 1.08, 1], [0.34, 0.76], [-0.2, 0.86], [-0.4, 0.72], [-0.1, 0.42]];
        shape(ctx, horn, '#d9cfb8', 0.045);
        clipTo(ctx, horn, () => {
            for (let i = 0; i < 9; i++) stroke(ctx, [[-0.85 + i * 0.16, 0.6], [-0.75 + i * 0.16, 1.32]], 0.016, 'rgba(70,60,40,0.5)');
        });
    }, { ppu: 100, ax: 0.42, ay: 0.42, layer: BL + 7 });
    const head = pivot(1.55, 0.3, headMesh, eyeMesh);
    const body = pivot(0, 1.35, bodyMesh, coreMat, head);
    g.add(...legs, body);
    g.userData = { body, head, legs, coreMat, eyeMat: eyeMesh };
    return g;
}

export function makeStormBoss() {
    const g = new THREE.Group();
    const shroudDraw = ctx => {
        radial(ctx, 0, 0, 1, '#ffffff', 0.3);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 0.012;
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
            const a = (i / 60) * Math.PI * 2;
            const r = 0.86 + ((i * 7) % 5) * 0.02;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.stroke();
    };
    const shroud = sprite('stormShroud', 2, 2, shroudDraw, { ppu: 110, additive: true, own: true, color: 0x7fa5e0, layer: BL + 9, opacity: 0.6 });
    shroud.scale.setScalar(3.3);
    shroud.position.y = 1.7;
    const shroudTwo = shroud.clone();
    shroudTwo.material = shroud.material.clone();
    shroudTwo.material.color.setHex(0xbfe0ff);
    shroudTwo.scale.setScalar(3.9);
    const chargeGlow = glowSprite(0xffffff, 1, { opacity: 0.9, layer: BL + 10 });
    chargeGlow.position.set(0, 1.7, 0);
    chargeGlow.visible = false;
    const cloudPts = [[-3.05, -0.8], [-3.25, 0.2], [-2.55, 1.05], [-2.15, 2.0], [-1.1, 2.2], [-0.3, 2.85], [0.8, 2.55], [1.75, 2.45], [2.5, 1.5], [3.2, 0.55], [3.05, -0.72], [2.2, -1.2], [1.0, -1.1], [0.1, -1.55], [-1.2, -1.2], [-2.3, -1.35]];
    const ring = sprite('stormMass', 7, 6, ctx => {
        shape(ctx, cloudPts, '#1f2843', 0.07, '#05070f');
        clipTo(ctx, cloudPts, () => {
            ctx.fillStyle = vGrad(ctx, 2.9, -1.5, 'rgba(142,168,214,0.75)', 'rgba(6,10,24,0.8)');
            ctx.fillRect(-3.5, -2, 7, 5);
            ctx.lineWidth = 0.05;
            ctx.strokeStyle = 'rgba(180,205,240,0.55)';
            for (const [x, y, r, a1, a2] of [[-2.1, 0.5, 0.95, 0.4, 2.6], [-0.75, 1.5, 0.92, 0.3, 2.7], [1.05, 1.5, 0.92, 0.4, 2.7], [2.3, 0.3, 0.9, 0.2, 2.4], [-1.9, -0.7, 0.72, 0.5, 2.4], [1.6, -0.6, 0.7, 0.6, 2.5]]) {
                ctx.beginPath();
                ctx.arc(x, y, r, a1, a2);
                ctx.stroke();
            }
        });
        for (const [x, l] of [[-2.1, 1.4], [-1, 1.8], [0.2, 2], [1.3, 1.5], [2.3, 1.2]]) {
            stroke(ctx, [[x, -1.05], [x + 0.14, -1.05 - l * 0.4], [x - 0.08, -1.05 - l * 0.7], [x + 0.1, -1.05 - l]], 0.035, '#a8d8ff');
        }
    }, { ppu: 90, layer: BL + 1 });
    const rods = new THREE.Group();
    for (let i = 0; i < 6; i++) {
        const rod = pivot(0, 0, sprite('stormArc', 0.5, 1.6, ctx => {
            stroke(ctx, [[0, -0.75], [0.1, -0.35], [-0.09, 0.05], [0.08, 0.4], [0, 0.75]], 0.05, '#d8ecff');
        }, { ppu: 80, additive: true, layer: BL + 2, y: 3.45 }));
        rod.rotation.z = (i / 6) * Math.PI * 2;
        rods.add(rod);
    }
    const lidDraw = top => ctx => {
        const s = top ? 1 : -1;
        const o = [[-1.55, 0, 1], [-0.95, s * 0.78], [0, s * 1.0], [0.95, s * 0.78], [1.55, 0, 1], [0.72, s * 0.17], [0, s * 0.1], [-0.72, s * 0.17]];
        shape(ctx, o, '#141b30', 0.05, '#04060e');
        stroke(ctx, [[-1.25, s * 0.08], [-0.6, s * 0.3], [0, s * 0.32], [0.6, s * 0.3], [1.25, s * 0.08]], 0.03, '#60769f');
    };
    const lidTop = sprite('stormLidT', 3.4, 2.4, lidDraw(true), { ppu: 90, layer: BL + 6 });
    const lidBottom = sprite('stormLidB', 3.4, 2.4, lidDraw(false), { ppu: 90, layer: BL + 6 });
    lidTop.position.set(0, 0.6, 0);
    lidBottom.position.set(0, -0.6, 0);
    const irisMesh = sprite('stormIris', 2.6, 2.6, ctx => {
        ctx.fillStyle = '#e8f3ff';
        ctx.beginPath();
        ctx.arc(0, 0, 1.15, 0, 7);
        ctx.fill();
        const g2 = ctx.createRadialGradient(0, 0, 0.2, 0, 0, 0.9);
        g2.addColorStop(0, '#ffffff');
        g2.addColorStop(0.6, '#d8d8d8');
        g2.addColorStop(1, '#6a6a6a');
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.arc(0, 0, 0.9, 0, 7);
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,40,40,0.5)';
        ctx.lineWidth = 0.02;
        for (let i = 0; i < 36; i++) {
            const a = (i / 36) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * 0.3, Math.sin(a) * 0.3);
            ctx.lineTo(Math.cos(a) * 0.86, Math.sin(a) * 0.86);
            ctx.stroke();
        }
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        ctx.arc(0, 0, 1.15, 0, 7);
        ctx.stroke();
    }, { ppu: 90, own: true, color: 0x9fd0ff, layer: BL + 3 });
    const pupil = sprite('stormPupil', 0.7, 1.4, ctx => {
        shape(ctx, [[0, 0.62, 1], [0.2, 0.05], [0, -0.62, 1], [-0.2, 0.05]], '#05060c', 0);
    }, { ppu: 90, layer: BL + 4 });
    const eye = pivot(0, 0, irisMesh, pupil);
    const rig = pivot(0, 1.7, ring, rods, eye, lidTop, lidBottom);
    g.add(rig, shroud, shroudTwo, chargeGlow);
    g.userData = { rig, ring, rods, lidTop, lidBottom, pupil, irisMat: irisMesh, shroud, shroudTwo, chargeGlow, drift: 0 };
    return g;
}

const fistDraw = ctx => {
    const o = [[-1.48, 0.02], [-1.52, 0.8], [-1.05, 1.36], [-0.3, 1.45], [0.35, 1.5], [1.15, 1.32], [1.55, 0.72], [1.45, 0.0, 1], [0, -0.05]];
    shape(ctx, o, '#4c3f43', 0.06);
    clipTo(ctx, o, () => {
        ctx.fillStyle = vGrad(ctx, 1.5, 0, 'rgba(255,220,180,0.17)', 'rgba(0,0,0,0.65)');
        ctx.fillRect(-2, -0.1, 4, 1.7);
        hatch(ctx, -1.4, 0.03, 1.4, 0.65, 36, 'rgba(0,0,0,0.42)', 0.018, 31);
        for (const x of [-0.82, -0.08, 0.68]) stroke(ctx, [[x, 1.5], [x + 0.08, 0.72], [x - 0.04, 0.3]], 0.05, '#150f10');
    });
    stroke(ctx, [[-1.42, 0.05], [0, 0.0], [1.42, 0.06]], 0.09, '#ff7a30');
};
export function makeColossus() {
    const g = new THREE.Group();
    const faceGlow = sprite('coloEyes', 3.6, 1.2, ctx => {
        for (const x of [-0.82, 0.82]) {
            radial(ctx, x, 0, 0.56, '#ff6a2a', 1);
            shape(ctx, [[x - 0.45, 0.03, 1], [x, 0.14], [x + 0.45, -0.03, 1], [x, -0.1]], '#fff0c0', 0.02, '#401000');
        }
    }, { ppu: 90, additive: true, own: true, layer: BL + 8 });
    faceGlow.position.y = 2.25;
    const crownPts = [[-2.25, 0.32], [-2.4, 1.6], [-2.1, 2.9], [-2.85, 3.6, 1], [-1.75, 3.45], [-1.2, 4.6, 1], [-0.62, 3.65], [0.05, 5.0, 1], [0.7, 3.65], [1.42, 4.4, 1], [1.82, 3.3], [2.85, 3.45, 1], [2.2, 2.7], [2.45, 1.45], [2.25, 0.3], [1.1, -0.15], [0, 0.0], [-1.15, -0.15]];
    const headMesh = sprite('coloHead', 6.2, 5.8, ctx => {
        shape(ctx, crownPts, '#3a2f33', 0.07);
        clipTo(ctx, crownPts, () => {
            ctx.fillStyle = vGrad(ctx, 5, 0, 'rgba(255,220,190,0.2)', 'rgba(0,0,0,0.68)');
            ctx.fillRect(-3, -0.3, 6, 5.5);
            hatch(ctx, -2.3, 0.1, 2.3, 2.2, 90, 'rgba(0,0,0,0.42)', 0.02, 44);
            for (const line of [[[-1.8, 3.4], [-1.45, 2.65], [-1.82, 1.6], [-1.4, 0.2]], [[1.85, 3.3], [1.42, 2.6], [1.82, 1.4], [1.3, 0.1]], [[0, 5], [0.1, 3.2], [-0.12, 2.9]]]) stroke(ctx, line, 0.05, '#100b0c');
        });
        shape(ctx, [[-1.62, 2.65], [-1.25, 2.72], [-0.28, 2.5], [-0.28, 1.92], [-1.1, 1.82], [-1.62, 2.12]], '#0d0809', 0.03);
        shape(ctx, [[1.62, 2.65], [1.25, 2.72], [0.28, 2.5], [0.28, 1.92], [1.1, 1.82], [1.62, 2.12]], '#0d0809', 0.03);
        shape(ctx, [[-1.05, 1.15], [-0.45, 1.42], [0.45, 1.42], [1.05, 1.15], [0.8, 0.5], [-0.8, 0.5]], '#17100f', 0.04);
        for (const x of [-0.62, -0.2, 0.2, 0.62]) shape(ctx, [[x - 0.14, 1.38, 1], [x, 0.98, 1], [x + 0.14, 1.38, 1]], '#c6bba4', 0.02);
        stroke(ctx, [[-2.2, 2.9], [0, 3.2], [2.2, 2.82]], 0.09, '#6d5e64');
    }, { ppu: 100, ay: 0.05, layer: BL + 4 });
    const head = pivot(0, 0, headMesh, faceGlow);
    const coreLocal = sprite('coloSocket', 1.8, 1.8, ctx => {
        radial(ctx, 0, 0, 0.9, '#ff5a1c', 0.75);
        shape(ctx, [[0, 0.5, 1], [0.42, 0, 1], [0, -0.5, 1], [-0.42, 0, 1]], '#ffd08a', 0.025, '#5a1a06');
    }, { ppu: 80, additive: true, own: true, layer: BL + 6 });
    coreLocal.position.y = 0.8;
    head.add(coreLocal);
    const fist = () => pivot(0, 0, sprite('coloFist', 3.5, 1.9, fistDraw, { ay: 0.1, ppu: 90, layer: BL + 11 }));
    const handL = fist();
    const handR = fist();
    handR.scale.x = -1;
    const shield = sprite('coloShield', 2, 2, ctx => {
        radial(ctx, 0, 0, 1, '#ffffff', 0.32);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 0.015;
        ctx.beginPath();
        for (let i = 0; i < 9; i++) {
            const a = (i / 8) * Math.PI * 2;
            ctx.lineTo(Math.cos(a) * 0.92, Math.sin(a) * 0.92);
        }
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            ctx.moveTo(Math.cos(a) * 0.92, Math.sin(a) * 0.92);
            ctx.lineTo(Math.cos(a + 0.8) * 0.55, Math.sin(a + 0.8) * 0.55);
        }
        ctx.stroke();
    }, { ppu: 120, additive: true, own: true, color: 0xff7a2a, layer: BL + 12, opacity: 0.7 });
    shield.scale.setScalar(3.8);
    shield.position.y = 1.9;
    const coreGlow = glowSprite(0xffe08a, 2.2, { opacity: 0.9, layer: BL + 13 });
    coreGlow.position.y = 0.9;
    coreGlow.visible = false;
    const novaRing = makeAbilityRing(0xffb060);
    novaRing.visible = false;
    novaRing.position.y = 1.8;
    const shoulders = sprite('coloTorso', 16, 9, ctx => {
        const o = [[-8, -4.4], [-7.2, -0.8], [-5.1, 1.1], [-2.7, 1.9], [0, 2.2], [2.7, 1.9], [5.1, 1.1], [7.2, -0.8], [8, -4.4]];
        shape(ctx, o, '#1a1316', 0.1, '#070506');
        clipTo(ctx, o, () => {
            ctx.fillStyle = vGrad(ctx, 2, -4, 'rgba(100,60,50,0.3)', 'rgba(0,0,0,0.6)');
            ctx.fillRect(-8, -4.5, 16, 7);
            stroke(ctx, [[-4, 1.2], [-3.1, -0.7], [-3.8, -2.2], [-3.1, -4]], 0.09, '#ff6a2a');
            stroke(ctx, [[3.4, 1.4], [3, 0], [3.8, -1.7], [3, -4]], 0.08, '#ff6a2a');
            stroke(ctx, [[0, -1.5], [-0.3, -2.8], [0.2, -4]], 0.07, '#ff6a2a');
        });
    }, { ppu: 44, layer: LAYER.back - 2 });
    shoulders.position.y = -1.7;
    g.add(shoulders, head, handL, handR, shield, coreGlow, novaRing);
    g.userData = { head, handL, handR, faceMat: faceGlow, coreSocket: coreLocal, shield, coreGlow, novaRing, shoulders };
    return g;
}

export function animateBoss(m, b, t) {
    const u = m.userData;
    const flash = b.hitFlash > 0 && Math.floor(b.hitFlash * 30) % 2 === 0;
    const dying = b.mode === 'dying';
    if (dying) {
        m.rotation.z = Math.sin(t * 30) * 0.05;
        const k = 1 - Math.min(1, b.modeT / 2.6) * 0.25;
        m.scale.setScalar(k);
    }
    if (u.legs) {
        m.rotation.y = b.dir > 0 ? 0 : Math.PI;
        const running = b.act === 'running';
        const rate = running ? 26 : b.act === 'charge' || b.act === 'rush' ? 8 : 0;
        u.legs.forEach((leg, i) => { leg.rotation.z = rate ? Math.sin(t * rate + i * 1.6) * 0.6 : Math.sin(t * 1.3 + i) * 0.015; });
        const tell = b.act === 'charge' || b.act === 'rush' || b.act === 'leap';
        const stunned = b.act === 'stunned' || b.act === 'landed';
        u.body.rotation.z = stunned ? -0.32 + Math.sin(t * 20) * 0.015 : tell ? 0.24 : running ? -0.16 : 0;
        u.body.position.y = 1.35 + (tell ? -0.3 + Math.sin(t * 34) * 0.02 : stunned ? -0.35 : Math.sin(t * 3) * 0.04);
        u.head.rotation.z = stunned ? -0.25 : tell ? -0.12 : Math.sin(t * 1.7) * 0.03;
        u.coreMat.material.opacity = flash ? 1 : b.vulnerable ? 0.75 + Math.sin(t * 14) * 0.25 : 0.25;
        u.coreMat.scale.setScalar(b.vulnerable ? 1.2 + Math.sin(t * 14) * 0.15 : 0.8);
        u.eyeMat.material.opacity = tell || b.phase > 0 ? 1 : stunned ? 0.12 : 0.65;
    }
    if (u.rig) {
        u.ring.rotation.z = Math.sin(t * (b.phase > 0 ? 1.8 : 0.9)) * 0.04;
        const breathe = 1 + Math.sin(t * 1.6) * 0.022;
        u.ring.scale.set(breathe, 2 - breathe, 1);
        u.rods.rotation.z = -t * 1.4;
        u.rods.visible = Math.sin(t * 11) > -0.45;
        const open = b.eyeOpen();
        u.lidTop.position.y += (0.6 + open * 1.05 - u.lidTop.position.y) * 0.18;
        u.lidBottom.position.y += (-0.6 - open * 1.05 - u.lidBottom.position.y) * 0.18;
        const p = b.game.player;
        u.pupil.position.x = Math.max(-0.5, Math.min(0.5, (p.x - b.x) * 0.06));
        u.pupil.position.y = Math.max(-0.4, Math.min(0.4, (p.y - b.y) * 0.05));
        u.irisMat.material.color.setHex(flash ? 0xffffff : b.phase > 1 ? 0xff6a5a : b.phase > 0 ? 0xffb080 : 0x9fd0ff);
        u.shroud.visible = b.shroud >= 1 && !b.vulnerable;
        u.shroudTwo.visible = b.shroud >= 2 && !b.vulnerable;
        u.shroud.rotation.z = t * 0.8;
        u.shroudTwo.rotation.z = -t * 1.2;
        u.chargeGlow.visible = b.charging > 0;
        u.chargeGlow.scale.setScalar(0.5 + b.charging * 2.2 + Math.sin(t * 40) * 0.08);
        u.rig.rotation.z = b.act === 'lodged' || b.act === 'grounded' ? Math.sin(t * 22) * 0.06 : b.act === 'dive' ? 0.5 : 0;
    }
    if (u.faceMat) {
        u.head.rotation.z = b.act === 'staggered' ? Math.sin(t * 18) * 0.05 + 0.1 : b.act === 'transition' ? Math.sin(t * 24) * 0.05 : Math.sin(t) * 0.03;
        u.faceMat.material.opacity = flash ? 1 : b.vulnerable ? 0.8 + Math.sin(t * 14) * 0.2 : 0.42 + b.phase * 0.18;
        u.coreSocket.material.opacity = b.vulnerable ? 1 : 0.35 + b.phase * 0.12;
        u.shield.visible = b.shielded && !b.vulnerable;
        u.shield.rotation.z = t * 0.4;
        u.shield.material.opacity = 0.55 + Math.sin(t * 5) * 0.15;
        u.coreGlow.visible = b.vulnerable;
        u.coreGlow.scale.setScalar(2 + Math.sin(t * 12) * 0.32);
        u.novaRing.visible = b.novaR > 0;
        u.novaRing.scale.setScalar(Math.max(0.01, b.novaR || 0));
        u.shoulders.position.x = -(b.x - (b.home ? b.home.x : b.x)) * 0.75;
        u.shoulders.position.y = -1.7 + Math.sin(t * 0.8) * 0.15;
    }
}

