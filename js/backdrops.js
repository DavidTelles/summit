import * as THREE from '../lib/three.module.js';
import { INK, LAYER, basic, canvasTexture, glowSprite, mixHex, radial, rawCanvas, rgba, rng, stroke, vGrad } from './ink.js';

const TAU = Math.PI * 2;

export const THEMES = {
    'Base do Acampamento': { sky: ['#6b8fb5', '#d7dfe4'], far: '#8ea6c2', mid: '#5f7892', near: '#34465a', fog: '#dfe9f0', rock: '#3a4556', cap: '#e9eef2', capLine: '#a5b8c9', dress: ['snow', 'snow', 'rock', 'pine'], motif: ['peaks', 'pines', 'pinesNear'], rays: 0xfff1d0, fg: 'pine' },
    'Cidade Antiga': { sky: ['#a56f4e', '#efc58f'], far: '#c3966d', mid: '#8a6248', near: '#4a3226', fog: '#f1d2a4', rock: '#40352e', cap: '#a9b070', capLine: '#6d7741', dress: ['grass', 'grass', 'rock', 'vine'], motif: ['peaks', 'city', 'ruinsNear'], rays: 0xffe3b0, fg: 'leaf' },
    'Caverna de Cristal': { sky: ['#120e2c', '#2b2152'], far: '#2a2350', mid: '#1b1639', near: '#100c24', fog: '#6a5aa8', rock: '#211c38', cap: '#5a4d8c', capLine: '#8f7ed0', dress: ['crystal', 'rock', 'crystal', 'stal'], motif: ['caveFar', 'caveCrystal', 'caveNear'], enclosed: true, glow: 0x7fe3ff, fg: 'stal' },
    'Templo do Vento': { sky: ['#4f9a92', '#d6ecd4'], far: '#88bdb0', mid: '#55907f', near: '#2b5249', fog: '#e4f3e4', rock: '#2d463f', cap: '#8fc29a', capLine: '#4f8a68', dress: ['grass', 'vine', 'rock', 'grass'], motif: ['peaks', 'temple', 'pinesNear'], rays: 0xf6ffe0, fg: 'leaf' },
    'Cume da Montanha': { sky: ['#6e4a78', '#f0b8b8'], far: '#b58aa4', mid: '#815d7e', near: '#47324f', fog: '#f7d7d4', rock: '#3c2d43', cap: '#f4e3e2', capLine: '#b794ab', dress: ['snow', 'rock', 'snow', 'pine'], motif: ['peaks', 'crags', 'pinesNear'], rays: 0xffe2d6, fg: 'pine' },
    'Vale da Tempestade': { sky: ['#1a2547', '#465f93'], far: '#3a4c7a', mid: '#27375f', near: '#141e3d', fog: '#7f97c9', rock: '#1d2946', cap: '#54709f', capLine: '#8fb0dd', dress: ['grass', 'rock', 'grass', 'rod'], motif: ['stormPeaks', 'floatRuins', 'crags'], lightning: true, fg: 'rock' },
    'Ruínas Suspensas': { sky: ['#1e2650', '#57679f'], far: '#3f4f83', mid: '#2a3866', near: '#171f42', fog: '#8a9fd4', rock: '#212a4c', cap: '#6079ad', capLine: '#9fb9e8', dress: ['rock', 'vine', 'rock', 'rod'], motif: ['stormPeaks', 'floatRuins', 'floatNear'], lightning: true, fg: 'rock' },
    'Abismo de Vento': { sky: ['#101a3a', '#3b5791'], far: '#2e4475', mid: '#1f3059', near: '#0f1a3a', fog: '#6f8dc8', rock: '#17233f', cap: '#4b6a9c', capLine: '#83a7da', dress: ['rock', 'rod', 'grass'], motif: ['abyss', 'floatRuins', 'floatNear'], lightning: true, fg: 'rock' },
    'Pico da Tormenta': { sky: ['#0d1533', '#35487e'], far: '#26365f', mid: '#192647', near: '#0b1330', fog: '#5e78b0', rock: '#141d39', cap: '#3f5a8a', capLine: '#7ea0d6', dress: ['rock', 'rod'], motif: ['stormPeaks', 'observatory', 'crags'], lightning: true, fg: 'rock' },
    'Desfiladeiro Final': { sky: ['#2a0c0b', '#9c3a18'], far: '#6d2a18', mid: '#451a12', near: '#220c09', fog: '#d9662a', rock: '#2a1512', cap: '#6b3323', capLine: '#ff8a3c', dress: ['ember', 'iron', 'rock', 'ember'], motif: ['gorge', 'machines', 'caveNear'], enclosed: false, glow: 0xff7a30, fg: 'stal' },
    'Núcleo da Montanha': { sky: ['#180706', '#531a0d'], far: '#3a140c', mid: '#280d08', near: '#150705', fog: '#c0501f', rock: '#231210', cap: '#5e2e20', capLine: '#ff8a3c', dress: ['ember', 'iron', 'crystal'], motif: ['coreFar', 'machines', 'caveNear'], enclosed: true, glow: 0x6fcfff, fg: 'stal' },
    'Cume Eterno': { sky: ['#1b0605', '#7a2410'], far: '#561b0e', mid: '#361009', near: '#190705', fog: '#e0602a', rock: '#231010', cap: '#6d3020', capLine: '#ffa050', dress: ['ember', 'iron', 'ember', 'crystal'], motif: ['coreFar', 'machines', 'caveNear'], enclosed: false, glow: 0xff8a3c, fg: 'stal' }
};

const fallback = THEMES['Base do Acampamento'];
export const themeOf = level => THEMES[level.name] || fallback;

function ridge(W, seed, rough = 1) {
    const r = rng(seed);
    const waves = Array.from({ length: 7 }, (_, i) => ({ k: 1 + i * 2 + Math.floor(r() * 2), a: (0.5 / (i + 1)) * (0.6 + r()), p: r() * TAU }));
    return x => waves.reduce((s, w) => s + Math.sin((x / W) * TAU * w.k + w.p) * w.a, 0) * rough;
}

function fillRidge(ctx, W, base, amp, fn, color) {
    ctx.beginPath();
    ctx.moveTo(0, -1);
    for (let x = 0; x <= W; x += W / 300) ctx.lineTo(x, base + fn(x) * amp);
    ctx.lineTo(W, -1);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

function spikyRidge(ctx, W, base, amp, seed, color, count = 16) {
    const r = rng(seed);
    const pts = [];
    for (let i = 0; i < count; i++) {
        const x = (i / count) * W;
        pts.push([x, base + r() * amp * 0.25]);
        pts.push([x + (W / count) * (0.3 + r() * 0.3), base + amp * (0.45 + r() * 0.55)]);
    }
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.lineTo(0, pts[0][1]);
    pts.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(W, pts[0][1]);
    ctx.lineTo(W, -1);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    return pts;
}

function pine(ctx, x, y, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - h * 0.03, y);
    ctx.lineTo(x + h * 0.03, y);
    ctx.lineTo(x + h * 0.03, y + h * 0.12);
    for (let i = 0; i < 6; i++) {
        const k = i / 6;
        const j = ((i * 7) % 3) * 0.012;
        ctx.lineTo(x + h * (0.22 + j) * (1 - k * 0.92), y + h * (0.08 + k * 0.82));
        ctx.lineTo(x + h * (0.1 + j) * (1 - k * 0.92), y + h * (0.14 + k * 0.82));
    }
    ctx.lineTo(x, y + h);
    for (let i = 5; i >= 0; i--) {
        const k = i / 6;
        const j = ((i * 5) % 3) * 0.012;
        ctx.lineTo(x - h * (0.1 + j) * (1 - k * 0.92), y + h * (0.14 + k * 0.82));
        ctx.lineTo(x - h * (0.22 + j) * (1 - k * 0.92), y + h * (0.08 + k * 0.82));
    }
    ctx.closePath();
    ctx.fill();
}

function tower(ctx, x, y, w, h, color, broken = true, r = () => 0.5) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h * (0.84 + r() * 0.16));
    if (broken) {
        ctx.lineTo(x + w * 0.25, y + h * 0.82);
        ctx.lineTo(x + w * 0.42, y + h);
        ctx.lineTo(x + w * 0.62, y + h * 0.78);
        ctx.lineTo(x + w * 0.8, y + h * 0.92);
    } else ctx.lineTo(x + w / 2, y + h * 1.1);
    ctx.lineTo(x + w, y + h * (0.72 + r() * 0.2));
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fill();
}

function arch(ctx, x, y, w, h, color, hole) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.22, y);
    ctx.lineTo(x + w * 0.22, y + h * 0.55);
    ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.95, x + w * 0.78, y + h * 0.55);
    ctx.lineTo(x + w * 0.78, y);
    ctx.closePath();
    ctx.fill();
}

function mist(ctx, W, y1, y2, color, alpha) {
    ctx.fillStyle = vGrad(ctx, y1, y2, rgba(color, alpha), rgba(color, 0));
    ctx.fillRect(0, Math.min(y1, y2), W, Math.abs(y2 - y1));
}

function floatRock(ctx, x, y, w, color, r) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x + w / 2, y + w * 0.04);
    ctx.lineTo(x + w * 0.34, y - w * 0.22);
    ctx.lineTo(x + w * 0.1, y - w * (0.3 + r() * 0.2));
    ctx.lineTo(x - w * 0.16, y - w * 0.26);
    ctx.lineTo(x - w * 0.38, y - w * 0.14);
    ctx.closePath();
    ctx.fill();
}

const MOTIFS = {
    peaks(ctx, W, H, c, t, seed) {
        const pts = spikyRidge(ctx, W, H * 0.3, H * 0.62, seed, c, 11);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, -1);
        ctx.lineTo(0, pts[0][1]);
        pts.forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.lineTo(W, pts[0][1]);
        ctx.lineTo(W, -1);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = rgba('#ffffff', 0.42);
        for (let i = 1; i < pts.length; i += 2) {
            const [x, y] = pts[i];
            ctx.beginPath();
            ctx.moveTo(x - H * 0.2, y + 2);
            ctx.lineTo(x + H * 0.2, y + 2);
            ctx.lineTo(x + H * 0.1, y - H * 0.13);
            ctx.lineTo(x + H * 0.03, y - H * 0.08);
            ctx.lineTo(x - H * 0.02, y - H * 0.15);
            ctx.lineTo(x - H * 0.07, y - H * 0.09);
            ctx.lineTo(x - H * 0.12, y - H * 0.14);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = rgba('#000000', 0.1);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + H * 0.26, y - H * 0.5);
            ctx.lineTo(x + H * 0.02, y - H * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = rgba('#ffffff', 0.42);
        }
        ctx.restore();
        mist(ctx, W, 0, H * 0.45, t.fog, 0.55);
    },
    pines(ctx, W, H, c, t, seed) {
        const f = ridge(W, seed);
        fillRidge(ctx, W, H * 0.32, H * 0.12, f, c);
        const r = rng(seed + 9);
        for (let i = 0; i < 70; i++) {
            const x = r() * W;
            pine(ctx, x, H * 0.3 + f(x) * H * 0.12, H * (0.07 + r() * 0.1), mixHex(c, '#000000', r() * 0.18));
        }
        mist(ctx, W, 0, H * 0.3, t.fog, 0.4);
    },
    pinesNear(ctx, W, H, c, t, seed) {
        const f = ridge(W, seed);
        fillRidge(ctx, W, H * 0.16, H * 0.08, f, c);
        const r = rng(seed + 3);
        for (let i = 0; i < 34; i++) {
            const x = r() * W;
            pine(ctx, x, H * 0.14 + f(x) * H * 0.08, H * (0.16 + r() * 0.17), mixHex(c, '#000000', r() * 0.22));
        }
        mist(ctx, W, 0, H * 0.14, t.fog, 0.22);
    },
    city(ctx, W, H, c, t, seed) {
        const f = ridge(W, seed);
        fillRidge(ctx, W, H * 0.28, H * 0.1, f, c);
        const r = rng(seed + 1);
        for (let i = 0; i < 34; i++) {
            const x = (i / 34) * W + r() * 3;
            const w = W * (0.015 + r() * 0.025);
            const h = H * (0.16 + r() * 0.34);
            tower(ctx, x, H * 0.26 + f(x) * H * 0.1, w, h, mixHex(c, '#000000', r() * 0.15), true, r);
            if (i % 4 === 0) arch(ctx, x + w, H * 0.26, W * 0.04, H * 0.16, c, rgba(t.fog, 0.45));
            ctx.fillStyle = rgba(t.sky[1], 0.5);
            for (let j = 0; j < 3; j++) ctx.fillRect(x + w * 0.3, H * 0.34 + j * H * 0.07, w * 0.25, H * 0.03);
        }
        mist(ctx, W, 0, H * 0.28, t.fog, 0.4);
    },
    ruinsNear(ctx, W, H, c, t, seed) {
        const f = ridge(W, seed);
        fillRidge(ctx, W, H * 0.14, H * 0.06, f, c);
        const r = rng(seed + 2);
        for (let i = 0; i < 12; i++) {
            const x = (i / 12) * W + r() * 6;
            arch(ctx, x, H * 0.1, W * 0.05, H * (0.3 + r() * 0.2), c, rgba(t.sky[1], 0.25));
            tower(ctx, x + W * 0.05, H * 0.1, W * 0.02, H * (0.4 + r() * 0.25), c, true, r);
            if (i % 2 === 0) {
                ctx.strokeStyle = mixHex(c, '#6d8a3f', 0.55);
                ctx.lineWidth = 0.28;
                stroke(ctx, [[x, H * 0.5], [x + 1, H * 0.34], [x + 0.5, H * 0.2]], 0.3, mixHex(c, '#6d8a3f', 0.55));
            }
        }
    },
    temple(ctx, W, H, c, t, seed) {
        const f = ridge(W, seed);
        fillRidge(ctx, W, H * 0.3, H * 0.13, f, c);
        const r = rng(seed + 5);
        for (let i = 0; i < 9; i++) {
            const x = (i / 9) * W + r() * 8;
            const base = H * 0.28 + f(x) * H * 0.13;
            const h = H * (0.25 + r() * 0.25);
            for (let k = 0; k < 4; k++) ctx.fillRect(x + k * 2.1, base, 0.6, h);
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.moveTo(x - 1.4, base + h);
            ctx.lineTo(x + 3.6, base + h + H * 0.1);
            ctx.lineTo(x + 8, base + h);
            ctx.closePath();
            ctx.fill();
            const vx = x + 3.3;
            const vy = base + h + H * 0.16;
            ctx.strokeStyle = c;
            ctx.lineWidth = 0.25;
            for (let a = 0; a < 4; a++) {
                ctx.beginPath();
                ctx.moveTo(vx, vy);
                ctx.lineTo(vx + Math.cos(a * 1.57 + i) * 2.2, vy + Math.sin(a * 1.57 + i) * 2.2);
                ctx.stroke();
            }
        }
        mist(ctx, W, 0, H * 0.3, t.fog, 0.45);
    },
    crags(ctx, W, H, c, t, seed) {
        const pts = spikyRidge(ctx, W, H * 0.16, H * 0.46, seed, c, 13);
        const r = rng(seed);
        ctx.strokeStyle = rgba('#000000', 0.2);
        ctx.lineWidth = 0.18;
        pts.forEach((p, i) => {
            if (i % 2 === 0) return;
            ctx.beginPath();
            ctx.moveTo(p[0], p[1]);
            ctx.lineTo(p[0] + r() * 2, p[1] - H * 0.2);
            ctx.stroke();
        });
        mist(ctx, W, 0, H * 0.18, t.fog, 0.18);
    },
    stormPeaks(ctx, W, H, c, t, seed) {
        spikyRidge(ctx, W, H * 0.25, H * 0.55, seed, c, 12);
        const r = rng(seed + 8);
        for (let i = 0; i < 22; i++) {
            const x = r() * W;
            const y = H * (0.68 + r() * 0.26);
            const s = 3 + r() * 6;
            ctx.fillStyle = rgba(mixHex(t.sky[0], '#000000', 0.25), 0.45);
            ctx.beginPath();
            ctx.ellipse(x, y, s * 2.4, s * 0.45, 0, 0, TAU);
            ctx.fill();
        }
        mist(ctx, W, 0, H * 0.4, t.fog, 0.3);
    },
    floatRuins(ctx, W, H, c, t, seed) {
        const r = rng(seed + 4);
        for (let i = 0; i < 16; i++) {
            const x = r() * W;
            const y = H * (0.3 + r() * 0.5);
            const w = W * (0.03 + r() * 0.05);
            floatRock(ctx, x, y, w, c, r);
            if (r() > 0.4) tower(ctx, x - w * 0.2, y, w * 0.3, H * (0.05 + r() * 0.09), c, true, r);
            stroke(ctx, [[x, y - w * 0.3], [x + 0.3, y - w * 0.55]], 0.09, rgba('#a8d8ff', 0.55));
        }
    },
    floatNear(ctx, W, H, c, t, seed) {
        const r = rng(seed + 11);
        for (let i = 0; i < 9; i++) {
            const x = r() * W;
            const y = H * (0.2 + r() * 0.6);
            floatRock(ctx, x, y, W * (0.05 + r() * 0.06), c, r);
            arch(ctx, x - 1.5, y, 3, H * 0.09, c, rgba(t.fog, 0.2));
        }
    },
    abyss(ctx, W, H, c, t, seed) {
        const r = rng(seed);
        for (let i = 0; i < 18; i++) {
            const x = (i / 18) * W;
            const top = H * (0.55 + r() * 0.42);
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x + W * 0.03, top + H * 0.08);
            ctx.lineTo(x + W * 0.045, top - H * 0.02);
            ctx.lineTo(x + W * 0.055, -1);
            ctx.lineTo(x, -1);
            ctx.closePath();
            ctx.fill();
        }
        mist(ctx, W, 0, H * 0.6, t.fog, 0.48);
    },
    observatory(ctx, W, H, c, t, seed) {
        const f = ridge(W, seed);
        fillRidge(ctx, W, H * 0.24, H * 0.1, f, c);
        const r = rng(seed + 7);
        for (let i = 0; i < 4; i++) {
            const x = ((i + 0.3) / 4) * W;
            const base = H * 0.22 + f(x) * H * 0.1;
            ctx.fillStyle = c;
            ctx.fillRect(x, base, 8, H * 0.28);
            ctx.beginPath();
            ctx.arc(x + 4, base + H * 0.28, 4.6, 0, Math.PI);
            ctx.fill();
            ctx.strokeStyle = c;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + 3, base + H * 0.3);
            ctx.lineTo(x + 8, base + H * 0.46);
            ctx.stroke();
            ctx.fillStyle = rgba('#bfe0ff', 0.6);
            for (let k = 0; k < 3; k++) ctx.fillRect(x + 1.5 + k * 2, base + H * 0.14, 0.7, 1.2);
            for (let k = 0; k < 3; k++) stroke(ctx, [[x - 6 - k * 3, base], [x - 6 - k * 3 + r(), base + H * (0.12 + r() * 0.2)]], 0.2, c);
        }
        mist(ctx, W, 0, H * 0.22, t.fog, 0.28);
    },
    gorge(ctx, W, H, c, t, seed) {
        spikyRidge(ctx, W, H * 0.32, H * 0.62, seed, c, 9);
        mist(ctx, W, 0, H * 0.55, t.fog, 0.6);
        const r = rng(seed + 2);
        for (let i = 0; i < 6; i++) {
            const x = r() * W;
            stroke(ctx, [[x, 0], [x + r() * 2 - 1, H * 0.15], [x + r() * 2, H * 0.32], [x + r() * 3, H * (0.42 + r() * 0.2)]], 0.5, rgba('#ff9a3c', 0.8));
        }
    },
    machines(ctx, W, H, c, t, seed) {
        const f = ridge(W, seed);
        fillRidge(ctx, W, H * 0.17, H * 0.06, f, c);
        const r = rng(seed + 6);
        for (let i = 0; i < 10; i++) {
            const x = (i / 10) * W + r() * 4;
            const base = H * 0.14;
            const h = H * (0.3 + r() * 0.4);
            ctx.strokeStyle = c;
            ctx.lineWidth = 0.45;
            ctx.beginPath();
            ctx.moveTo(x, base);
            ctx.lineTo(x + 1.5, base + h);
            ctx.lineTo(x + 3, base);
            ctx.moveTo(x + 0.5, base + h * 0.3);
            ctx.lineTo(x + 2.5, base + h * 0.6);
            ctx.moveTo(x + 2.5, base + h * 0.3);
            ctx.lineTo(x + 0.5, base + h * 0.6);
            ctx.stroke();
            ctx.fillStyle = c;
            ctx.fillRect(x - 1.2, base + h - 0.3, 5.5, 1.1);
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(x + 1.5, base + h + 1.1, 1.5 + r(), 0, TAU);
            ctx.stroke();
            ctx.fillStyle = rgba('#ff8a3c', 0.9);
            ctx.fillRect(x + 0.7, base + h * 0.45, 1.5, 0.3);
        }
    },
    caveFar(ctx, W, H, c, t, seed) {
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, W, H);
        const r = rng(seed);
        for (let i = 0; i < 20; i++) {
            const x = r() * W;
            radial(ctx, x, r() * H, 8 + r() * 9, t.capLine, 0.12);
        }
        for (let i = 0; i < 26; i++) stalactite(ctx, r() * W, H, 2 + r() * 2.5, H * (0.12 + r() * 0.2), mixHex(c, '#000000', 0.3));
        for (let i = 0; i < 26; i++) stalagmite(ctx, r() * W, 0, 2 + r() * 2.5, H * (0.12 + r() * 0.16), mixHex(c, '#000000', 0.3));
        mist(ctx, W, 0, H * 0.32, t.fog, 0.3);
    },
    caveCrystal(ctx, W, H, c, t, seed) {
        const r = rng(seed);
        for (let i = 0; i < 14; i++) stalagmite(ctx, r() * W, 0, 3 + r() * 3, H * (0.2 + r() * 0.2), c);
        for (let i = 0; i < 14; i++) stalactite(ctx, r() * W, H, 3 + r() * 3, H * (0.2 + r() * 0.26), c);
        for (let i = 0; i < 12; i++) {
            const x = r() * W;
            const s = 1.6 + r() * 2.3;
            const y = H * (0.04 + r() * 0.22);
            radial(ctx, x, y + s, s * 3.4, '#7fe3ff', 0.42);
            crystalCluster(ctx, x, y, s, '#4fb6dc', '#b6efff');
        }
    },
    caveNear(ctx, W, H, c, t, seed) {
        const r = rng(seed);
        for (let i = 0; i < 12; i++) stalagmite(ctx, r() * W, 0, 4 + r() * 4, H * (0.26 + r() * 0.2), c);
        for (let i = 0; i < 12; i++) stalactite(ctx, r() * W, H, 4 + r() * 4, H * (0.26 + r() * 0.26), c);
    },
    coreFar(ctx, W, H, c, t, seed) {
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, W, H);
        const r = rng(seed);
        for (let i = 0; i < 14; i++) {
            const x = r() * W;
            stroke(ctx, [[x, 0], [x + r() * 4 - 2, H * 0.3], [x + r() * 4 - 2, H * 0.62], [x + r() * 4 - 2, H]], 0.55, rgba('#ff7a30', 0.75));
            radial(ctx, x, r() * H, 8, '#ff5a1c', 0.25);
        }
        for (let i = 0; i < 9; i++) {
            const x = r() * W;
            const s = 2.5 + r() * 4;
            const y = r() * H * 0.6;
            radial(ctx, x, y + s * 1.5, s * 3.2, '#6fcfff', 0.3);
            crystalCluster(ctx, x, y, s, '#3e94b8', '#a8e9ff');
        }
        mist(ctx, W, 0, H * 0.5, t.fog, 0.2);
    }
};

function stalactite(ctx, x, top, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, top);
    ctx.lineTo(x - w * 0.14, top - h * 0.62);
    ctx.lineTo(x, top - h);
    ctx.lineTo(x + w * 0.16, top - h * 0.55);
    ctx.lineTo(x + w / 2, top);
    ctx.closePath();
    ctx.fill();
}

function stalagmite(ctx, x, bottom, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, bottom);
    ctx.lineTo(x - w * 0.17, bottom + h * 0.6);
    ctx.lineTo(x, bottom + h);
    ctx.lineTo(x + w * 0.14, bottom + h * 0.52);
    ctx.lineTo(x + w / 2, bottom);
    ctx.closePath();
    ctx.fill();
}

export function crystalCluster(ctx, x, y, s, dark, light) {
    for (const [dx, h, w] of [[-0.55, 1.3, 0.42], [0.52, 1.6, 0.46], [0, 2.3, 0.6]]) {
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(x + (dx - w / 2) * s, y);
        ctx.lineTo(x + (dx - w / 2) * s, y + h * 0.7 * s);
        ctx.lineTo(x + dx * s, y + h * s);
        ctx.lineTo(x + (dx + w / 2) * s, y + h * 0.75 * s);
        ctx.lineTo(x + (dx + w / 2) * s, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = light;
        ctx.beginPath();
        ctx.moveTo(x + dx * s, y);
        ctx.lineTo(x + dx * s, y + h * s);
        ctx.lineTo(x + (dx - w / 2) * s, y + h * 0.7 * s);
        ctx.lineTo(x + (dx - w / 2) * s, y);
        ctx.closePath();
        ctx.fill();
    }
}

export function layerTexture(W, H, draw, px = 12, grain = true) {
    const c = rawCanvas(Math.min(2048, W * px), Math.min(1024, H * px));
    if (!c) return null;
    const ctx = c.getContext('2d');
    ctx.setTransform(c.width / W, 0, 0, -c.height / H, 0, c.height);
    draw(ctx);
    const r = rng(W * 31 + H);
    ctx.globalAlpha = 0.035;
    for (let i = 0; grain && i < 700; i++) {
        ctx.fillStyle = r() > 0.5 ? '#000000' : '#ffffff';
        const x = r() * W;
        const y = r() * H;
        ctx.beginPath();
        ctx.ellipse(x, y, 0.1 + r() * 0.6, 0.04 + r() * 0.08, r() * 3, 0, 7);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    const tex = canvasTexture(c, true);
    return tex;
}

const levelTextures = new Map();
let levelKey = '';

function memo(key, make) {
    const id = `${levelKey}|${key}`;
    if (!levelTextures.has(id)) {
        const tex = make();
        if (tex) tex.userData.memo = true;
        levelTextures.set(id, tex);
    }
    return levelTextures.get(id);
}

export function useLevelTextures(name) {
    if (name === levelKey) return;
    for (const tex of levelTextures.values()) if (tex) tex.dispose();
    levelTextures.clear();
    levelKey = name;
}

export function addLayer(parent, tex, x, y, z, width, height, repeatX, repeatY, order, opts = {}) {
    if (tex) tex.repeat.set(repeatX, repeatY);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height).translate(width / 2, height / 2, 0), basic(tex, opts));
    m.position.set(x, y, z);
    m.renderOrder = order;
    m.frustumCulled = false;
    m.userData.owned = true;
    parent.add(m);
    return m;
}

export function buildBackdrop(root, level) {
    const g = level.grid;
    const theme = themeOf(level);
    const anim = { fogs: [], pulses: [], rays: [], optional: [] };
    const seed = g.w * 7 + g.h * 13;
    const span = g.w + 260;
    const left = -130;
    const specs = [
        { z: -62, W: 160, H: 58, key: 0, color: theme.far, order: LAYER.far, base: g.h * 0.05 - 8 },
        { z: -32, W: 130, H: 44, key: 1, color: theme.mid, order: LAYER.mid, base: g.h * 0.03 - 7 },
        { z: -14, W: 100, H: 30, key: 2, color: theme.near, order: LAYER.near, base: -7 }
    ];
    for (const s of specs) {
        const draw = MOTIFS[theme.motif[s.key]];
        const enclosed = theme.enclosed;
        const tex = memo(`layer${s.key}`, () => layerTexture(s.W, s.H, ctx => draw(ctx, s.W, s.H, s.color, theme, seed + s.key * 17), s.key === 2 ? 16 : 12));
        if (enclosed) {
            const rows = Math.ceil((g.h + 90) / s.H);
            if (tex) tex.wrapT = THREE.RepeatWrapping;
            addLayer(root, tex, left, -45, s.z, span, rows * s.H, span / s.W, rows, s.order);
        } else {
            if (tex) tex.wrapT = THREE.ClampToEdgeWrapping;
            addLayer(root, tex, left, s.base, s.z, span, s.H, span / s.W, 1, s.order);
            addLayer(root, null, left, s.base - 120, s.z, span, 120.4, 1, 1, s.order, { color: new THREE.Color(mixHex(s.color, theme.fog, s.key === 2 ? 0.12 : 0.3)).getHex() });
        }
    }
    const fogTex = i => memo(`fog${i}`, () => layerTexture(70, 16, ctx => {
        const r = rng(seed + 44);
        for (let i = 0; i < 24; i++) {
            const x = r() * 70;
            const y = 5 + r() * 6;
            for (const dx of [-70, 0, 70]) {
                ctx.save();
                ctx.translate(x + dx, y);
                ctx.scale(1, 0.18);
                radial(ctx, 0, 0, 7 + r() * 8, theme.fog, 0.26);
                ctx.restore();
            }
        }
    }, 10));
    let fogIndex = 0;
    for (const [z, order, h, y, speed, alpha] of [[-24, LAYER.mid + 5, 26, g.h * 0.08, 0.004, 0.55], [-7, LAYER.fogBack, 18, -1, -0.007, 0.5]]) {
        const tex = fogTex(fogIndex++);
        if (tex) tex.wrapT = THREE.ClampToEdgeWrapping;
        anim.optional.push(addLayer(root, tex, left, y, z, span, h, span / 70, 1, order, { opacity: alpha }));
        anim.fogs.push({ tex, speed });
    }
    if (theme.rays) {
        const tex = memo('rays', () => layerTexture(40, 40, ctx => {
            for (const [x, w, a] of [[8, 3.2, 0.3], [17, 5, 0.42], [28, 2.6, 0.26], [34, 3.4, 0.3]]) {
                const grad = ctx.createLinearGradient(0, 40, 0, 0);
                grad.addColorStop(0, rgba('#ffffff', a));
                grad.addColorStop(1, rgba('#ffffff', 0));
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(x, 40);
                ctx.lineTo(x + w, 40);
                ctx.lineTo(x + w - 9, 0);
                ctx.lineTo(x - 9 - w * 0.7, 0);
                ctx.closePath();
                ctx.fill();
            }
        }, 6));
        if (tex) tex.wrapT = THREE.ClampToEdgeWrapping;
        const rays = addLayer(root, tex, left, -3, -9, span, g.h + 22, span / 54, 1, LAYER.fogBack + 1, { additive: true, color: theme.rays, opacity: 0.32 });
        anim.rays.push(rays);
        anim.optional.push(rays);
    }
    if (theme.glow) {
        const r = rng(seed + 90);
        const count = Math.round(g.w / 9 + g.h / 9);
        for (let i = 0; i < count; i++) {
            const m = glowSprite(theme.glow, 3 + r() * 5, { layer: LAYER.near + 2, opacity: 0.2 });
            m.position.set(r() * g.w, r() * g.h, -12);
            m.userData.owned = false;
            root.add(m);
            anim.optional.push(m);
            anim.pulses.push({ m, p: r() * TAU, base: 0.14 + r() * 0.14 });
        }
    }
    addForeground(root, level, theme, seed, span, left);
    anim.lightning = !!theme.lightning;
    return anim;
}

function addForeground(root, level, theme, seed, span, left) {
    const g = level.grid;
    const tex = memo('fg', () => layerTexture(60, 8, ctx => {
        const r = rng(seed + 2);
        const color = mixHex(theme.near, '#000000', 0.72);
        ctx.fillStyle = color;
        for (let i = 0; i < 28; i++) {
            const x = r() * 60;
            const w = 3 + r() * 5;
            const h = 1.6 + r() * 5.4;
            if (theme.fg === 'pine') pine(ctx, x, -0.2, h * 1.2, color);
            else if (theme.fg === 'stal') stalagmite(ctx, x, 0, w, h, color);
            else if (theme.fg === 'leaf') {
                for (let k = 0; k < 7; k++) {
                    ctx.save();
                    ctx.translate(x + k * 0.3, 0);
                    ctx.rotate(-0.75 + k * 0.25 + r() * 0.1);
                    ctx.beginPath();
                    ctx.moveTo(-0.16, 0);
                    ctx.quadraticCurveTo(0.26, h * 0.45, 0, h);
                    ctx.quadraticCurveTo(-0.3, h * 0.5, -0.16, 0);
                    ctx.fill();
                    ctx.restore();
                }
            } else floatRock(ctx, x, h * 0.42, w, color, r);
        }
        ctx.fillRect(0, 0, 60, 0.5);
    }, 14));
    if (tex) tex.wrapT = THREE.ClampToEdgeWrapping;
    addLayer(root, tex, left, -5.2, 5, span, 7.2, span / 60, 1, LAYER.fg);
    if (theme.enclosed || theme.motif[2] === 'caveNear') {
        const top = memo('fgTop', () => layerTexture(60, 8, ctx => {
            const r = rng(seed + 7);
            const color = mixHex(theme.near, '#000000', 0.72);
            for (let i = 0; i < 18; i++) stalactite(ctx, r() * 60, 8, 3 + r() * 5, 2 + r() * 6, color);
            ctx.fillStyle = color;
            ctx.fillRect(0, 7.6, 60, 0.4);
        }, 14));
        if (top) top.wrapT = THREE.ClampToEdgeWrapping;
        addLayer(root, top, left, g.h + 1, 5, span, 7.2, span / 60, 1, LAYER.fg);
    }
}

const TILE = 64;
const OVER = 18;
const COLS = 16;
const VARIANTS = 4;

function drawTile(ctx, mask, variant, theme, seed) {
    const up = mask & 1;
    const right = mask & 2;
    const down = mask & 4;
    const left = mask & 8;
    const r = rng(mask * 13 + variant * 91 + seed);
    const body = theme.rock;
    const inset = () => 2 + r() * 2.5;
    const tl = !up && !left;
    const tr = !up && !right;
    const bl = !down && !left;
    const br = !down && !right;
    const n = 4;
    const pts = [];
    const topY = 0;
    const edge = (x1, y1, x2, y2, closed, inward) => {
        for (let i = 0; i <= n; i++) {
            const k = i / n;
            const x = x1 + (x2 - x1) * k;
            const y = y1 + (y2 - y1) * k;
            const w = closed ? 0 : (i === 0 || i === n ? 0 : inward());
            const out = closed ? 3 : 0;
            const ox = x1 === x2 ? (x1 < TILE / 2 ? -out : out) : 0;
            const oy = y1 === y2 ? (y1 < TILE / 2 ? -out : out) : 0;
            pts.push([x + ox + (y1 === y2 ? 0 : (x1 < TILE / 2 ? w : -w)), y + oy + (x1 === x2 ? 0 : (y1 < TILE / 2 ? w * 0.65 : -w)), 1]);
        }
    };
    const R = 10;
    edge(tl ? R : 0, topY, tr ? TILE - R : TILE, topY, !!up, inset);
    if (tr) pts.push([TILE - 3, 3, 1]);
    edge(TILE, tr ? R : 0, TILE, br ? TILE - R : TILE, !!right, inset);
    if (br) pts.push([TILE - 3, TILE - 3, 1]);
    edge(br ? TILE - R : TILE, TILE, bl ? R : 0, TILE, !!down, inset);
    if (bl) pts.push([3, TILE - 3, 1]);
    edge(0, bl ? TILE - R : TILE, 0, tl ? R : 0, !!left, inset);
    if (tl) pts.push([3, 3, 1]);
    trace2(ctx, pts);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.save();
    ctx.clip();
    if (!up) {
        const grad = ctx.createLinearGradient(0, 0, 0, TILE * 0.6);
        grad.addColorStop(0, rgba('#ffffff', 0.09));
        grad.addColorStop(1, rgba('#ffffff', 0));
        ctx.fillStyle = grad;
        ctx.fillRect(-3, 0, TILE + 6, TILE);
    }
    if (!down) {
        const grad = ctx.createLinearGradient(0, TILE * 0.5, 0, TILE);
        grad.addColorStop(0, rgba('#000000', 0));
        grad.addColorStop(1, rgba('#000000', 0.42));
        ctx.fillStyle = grad;
        ctx.fillRect(-3, 0, TILE + 6, TILE);
    }
    ctx.strokeStyle = rgba('#000000', 0.34);
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 2 + variant; i++) {
        const x = r() * TILE;
        const y = r() * TILE;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (r() - 0.5) * 18, y + 6 + r() * 12);
        ctx.lineTo(x + (r() - 0.5) * 22, y + 12 + r() * 12);
        ctx.stroke();
    }
    ctx.strokeStyle = rgba('#ffffff', 0.05);
    for (let i = 0; i < 6; i++) {
        const x = r() * TILE;
        const y = r() * TILE;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 7 + r() * 8, y - 2 + r() * 4);
        ctx.stroke();
    }
    ctx.restore();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    const seg = (a, b) => {
        ctx.beginPath();
        ctx.moveTo(pts[a][0], pts[a][1]);
        for (let i = a + 1; i <= b; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
    };
    let cursor = 0;
    const count = n + 1;
    const topEnd = cursor + count - 1;
    const hasTop = !up;
    if (hasTop) seg(cursor, topEnd + (tr ? 1 : 0));
    cursor = topEnd + 1 + (tr ? 1 : 0);
    const rightEnd = cursor + count - 1;
    if (!right) seg(cursor, rightEnd + (br ? 1 : 0));
    cursor = rightEnd + 1 + (br ? 1 : 0);
    const downEnd = cursor + count - 1;
    if (!down) seg(cursor, downEnd + (bl ? 1 : 0));
    cursor = downEnd + 1 + (bl ? 1 : 0);
    const leftEnd = cursor + count - 1;
    if (!left) seg(cursor, leftEnd);
    if (tl && !left) {
        ctx.beginPath();
        ctx.moveTo(pts[leftEnd][0], pts[leftEnd][1]);
        ctx.lineTo(3, 3);
        ctx.lineTo(pts[0][0], pts[0][1]);
        ctx.stroke();
    }
    if (hasTop) {
        const x1 = tl ? 4 : -3;
        const x2 = tr ? TILE - 4 : TILE + 3;
        ctx.fillStyle = theme.cap;
        ctx.beginPath();
        ctx.moveTo(x1, 6);
        if (theme.dress.includes('snow')) {
            let x = x1;
            while (x < x2 - 1) {
                const w = 11 + r() * 15;
                const nx = Math.min(x2, x + w);
                ctx.quadraticCurveTo((x + nx) / 2, -3 - r() * 7, nx, 3);
                x = nx;
            }
        } else if (theme.dress.includes('grass')) {
            let x = x1;
            while (x < x2 - 2) {
                const w = 3 + r() * 5;
                const h = r() < 0.2 ? 7 + r() * 8 : 1 + r() * 4;
                ctx.quadraticCurveTo(x + w * 0.2, -h * 0.5, x + w * (r() - 0.2), -h);
                ctx.quadraticCurveTo(x + w * 0.9, -h * 0.2, x + w, 3);
                x += w;
            }
        } else {
            let x = x1;
            while (x < x2 - 2) {
                const w = 8 + r() * 13;
                ctx.lineTo(x + w * 0.35, -1 - r() * 4);
                ctx.lineTo(x + w * 0.8, 1 - r() * 3);
                ctx.lineTo(x + w, 3);
                x += w;
            }
        }
        ctx.lineTo(x2, 11);
        for (let i = 7; i >= 1; i--) ctx.lineTo(x1 + ((x2 - x1) * i) / 8, 11 + (r() - 0.3) * 5);
        ctx.lineTo(x1, 11);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = theme.capLine;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x1 + 2, 6);
        ctx.lineTo(x2 - 2, 6.5);
        ctx.stroke();
    }
}

function trace2(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
}

function terrainAtlas(theme, seed) {
    const c = rawCanvas(COLS * TILE, VARIANTS * (TILE + OVER));
    if (!c) return null;
    const ctx = c.getContext('2d');
    for (let v = 0; v < VARIANTS; v++) {
        for (let mask = 0; mask < 16; mask++) {
            ctx.save();
            ctx.translate(mask * TILE, v * (TILE + OVER) + OVER);
            ctx.beginPath();
            ctx.rect(0, -OVER, TILE, TILE + OVER);
            ctx.clip();
            drawTile(ctx, mask, v, theme, seed);
            ctx.restore();
        }
    }
    const t = canvasTexture(c);
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
    return t;
}

export function buildTerrain(root, level) {
    const g = level.grid;
    const theme = themeOf(level);
    const solid = (x, y) => y >= 0 && y < g.h && x >= 0 && x < g.w && g.cells[y][x] === '#';
    const pos = [];
    const uv = [];
    const col = [];
    const idx = [];
    const r = rng(g.w * 3 + g.h);
    const W = COLS * TILE;
    const H = VARIANTS * (TILE + OVER);
    const dist = (x, y) => {
        for (let d = 1; d <= 3; d++) {
            for (let a = -d; a <= d; a++) {
                if (!solid(x + a, y + d) || !solid(x + a, y - d) || !solid(x + d, y + a) || !solid(x - d, y + a)) return d;
            }
        }
        return 4;
    };
    for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
            if (!solid(x, y)) continue;
            const edgeSolid = (nx, ny) => solid(nx, ny) || nx < 0 || nx >= g.w;
            const mask = (edgeSolid(x, y + 1) ? 1 : 0) | (edgeSolid(x + 1, y) ? 2 : 0) | (y === 0 || edgeSolid(x, y - 1) ? 4 : 0) | (edgeSolid(x - 1, y) ? 8 : 0);
            const variant = Math.floor(r() * VARIANTS);
            const top = !(mask & 1);
            const over = top ? OVER / TILE : 0;
            const u1 = (mask * TILE + 1) / W;
            const u2 = ((mask + 1) * TILE - 1) / W;
            const vTop = 1 - (variant * (TILE + OVER) + (top ? 0 : OVER) + 1) / H;
            const vBottom = 1 - (variant * (TILE + OVER) + OVER + TILE - 1) / H;
            const base = pos.length / 3;
            pos.push(x, y, 0, x + 1, y, 0, x + 1, y + 1 + over, 0, x, y + 1 + over, 0);
            uv.push(u1, vBottom, u2, vBottom, u2, vTop, u1, vTop);
            const d = dist(x, y);
            const shade = d === 1 ? 1 : d === 2 ? 0.62 : d === 3 ? 0.38 : 0.2;
            for (let i = 0; i < 4; i++) col.push(shade, shade, shade);
            idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geometry.setIndex(idx);
    const material = basic(memo('atlas', () => terrainAtlas(theme, g.w)));
    material.vertexColors = true;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = LAYER.terrain;
    mesh.frustumCulled = false;
    mesh.userData.owned = true;
    root.add(mesh);
    return buildDressing(root, level, theme, solid);
}

function drawDress(ctx, kind, theme, i) {
    const cx = 64;
    const color = kind === 'grass' ? theme.cap : mixHex(theme.rock, '#ffffff', 0.15);
    const r = rng(i * 11 + 3);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (kind === 'grass') {
        for (let b = 0; b < 8; b++) {
            const x = cx - 40 + r() * 80;
            const h = 26 + r() * 70;
            ctx.beginPath();
            ctx.moveTo(x - 5, 128);
            ctx.quadraticCurveTo(x + r() * 18 - 9, 128 - h * 0.6, x + r() * 30 - 15, 128 - h);
            ctx.quadraticCurveTo(x + 7, 128 - h * 0.5, x + 5, 128);
            ctx.closePath();
            ctx.fillStyle = b % 2 ? color : mixHex(color, '#000000', 0.3);
            ctx.fill();
            ctx.strokeStyle = INK;
            ctx.lineWidth = 1.8;
            ctx.stroke();
        }
    } else if (kind === 'snow') {
        ctx.beginPath();
        ctx.moveTo(cx - 54, 128);
        ctx.bezierCurveTo(cx - 44, 90, cx - 8, 92, cx - 2, 106);
        ctx.bezierCurveTo(cx + 18, 84, cx + 48, 100, cx + 54, 128);
        ctx.closePath();
        ctx.fillStyle = theme.cap;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.5;
        ctx.stroke();
    } else if (kind === 'rock') {
        ctx.beginPath();
        ctx.moveTo(cx - 40, 128);
        ctx.lineTo(cx - 34, 96);
        ctx.lineTo(cx - 8, 82);
        ctx.lineTo(cx + 24, 92);
        ctx.lineTo(cx + 42, 128);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 6, 86);
        ctx.lineTo(cx - 2, 112);
        ctx.lineWidth = 1.8;
        ctx.stroke();
    } else if (kind === 'crystal') {
        ctx.save();
        ctx.translate(cx, 128);
        ctx.scale(22, -22);
        crystalCluster(ctx, 0, 0, 1.25, '#3f9fc6', '#a8ecff');
        ctx.restore();
    } else if (kind === 'ember') {
        ctx.beginPath();
        ctx.moveTo(cx - 28, 128);
        ctx.lineTo(cx - 10, 62);
        ctx.lineTo(cx + 5, 42);
        ctx.lineTo(cx + 12, 72);
        ctx.lineTo(cx + 30, 128);
        ctx.closePath();
        ctx.fillStyle = mixHex(theme.rock, '#000000', 0.2);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.strokeStyle = '#ff8a3c';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx + 4, 56);
        ctx.lineTo(cx - 3, 92);
        ctx.lineTo(cx + 8, 124);
        ctx.stroke();
    } else if (kind === 'pine') {
        ctx.save();
        ctx.translate(cx, 128);
        ctx.scale(1, -1);
        pine(ctx, 0, 0, 120, mixHex(theme.rock, '#3e5a48', 0.5));
        ctx.restore();
    } else if (kind === 'iron') {
        ctx.fillStyle = '#3d3238';
        ctx.fillRect(cx - 10, 54, 20, 74);
        ctx.fillRect(cx - 34, 46, 68, 14);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(cx - 10, 54, 20, 74);
        ctx.strokeRect(cx - 34, 46, 68, 14);
        ctx.fillStyle = '#ff8a3c';
        ctx.fillRect(cx - 5, 70, 10, 5);
    } else if (kind === 'rod') {
        ctx.fillStyle = '#a0713f';
        ctx.fillRect(cx - 3, 28, 6, 100);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - 3, 28, 6, 100);
        ctx.fillRect(cx - 17, 44, 34, 5);
        ctx.strokeRect(cx - 17, 44, 34, 5);
        ctx.fillStyle = '#c78f50';
        ctx.fillRect(cx - 12, 62, 24, 4);
    } else if (kind === 'vine' || kind === 'stal') {
        ctx.beginPath();
        if (kind === 'stal') {
            ctx.moveTo(cx - 26, 0);
            ctx.lineTo(cx - 6, 78);
            ctx.lineTo(cx + 2, 104);
            ctx.lineTo(cx + 10, 64);
            ctx.lineTo(cx + 28, 0);
            ctx.closePath();
            ctx.fillStyle = mixHex(theme.rock, '#ffffff', 0.08);
            ctx.fill();
            ctx.strokeStyle = INK;
            ctx.lineWidth = 2.5;
            ctx.stroke();
        } else {
            for (let v = 0; v < 3; v++) {
                const x = cx - 26 + v * 26;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.bezierCurveTo(x + 14, 34, x - 12, 66, x + 4, 94 + r() * 28);
                ctx.strokeStyle = INK;
                ctx.lineWidth = 5;
                ctx.stroke();
                ctx.strokeStyle = mixHex(theme.cap, '#000000', 0.15);
                ctx.lineWidth = 2.8;
                ctx.stroke();
                for (let l = 0; l < 4; l++) {
                    const ly = 18 + l * 22;
                    ctx.fillStyle = mixHex(theme.cap, '#000000', 0.1);
                    ctx.beginPath();
                    ctx.ellipse(x + (l % 2 ? 7 : -7), ly, 6, 3.4, l % 2 ? 0.6 : -0.6, 0, TAU);
                    ctx.fill();
                }
            }
        }
    }
}

const DRESS_KINDS = ['grass', 'snow', 'rock', 'crystal', 'ember', 'pine', 'iron', 'rod', 'vine', 'stal'];

function buildDressing(root, level, theme, solid) {
    const g = level.grid;
    const tex = memo('dress', () => {
        const c = rawCanvas(DRESS_KINDS.length * 128, 128);
        if (!c) return null;
        const ctx = c.getContext('2d');
        DRESS_KINDS.forEach((kind, i) => {
            ctx.save();
            ctx.translate(i * 128, 0);
            ctx.beginPath();
            ctx.rect(0, 0, 128, 128);
            ctx.clip();
            drawDress(ctx, kind, theme, i);
            ctx.restore();
        });
        return canvasTexture(c);
    });
    const pos = [];
    const uv = [];
    const sway = [];
    const idx = [];
    const r = rng(g.w * 5 + g.h * 11);
    const free = (x, y) => y >= 0 && y < g.h && g.cells[y][x] === '.';
    const add = (kind, x, y, size, hanging) => {
        const i = DRESS_KINDS.indexOf(kind);
        const u1 = i / DRESS_KINDS.length;
        const u2 = (i + 1) / DRESS_KINDS.length;
        const b = pos.length / 3;
        const flip = r() > 0.5;
        const ua = flip ? u2 : u1;
        const ub = flip ? u1 : u2;
        if (hanging) {
            pos.push(x - size / 2, y - size, 0, x + size / 2, y - size, 0, x + size / 2, y, 0, x - size / 2, y, 0);
            uv.push(ua, 0, ub, 0, ub, 1, ua, 1);
            sway.push(1, 1, 0, 0);
        } else {
            pos.push(x - size / 2, y, 0, x + size / 2, y, 0, x + size / 2, y + size, 0, x - size / 2, y + size, 0);
            uv.push(ua, 0, ub, 0, ub, 1, ua, 1);
            const s = kind === 'grass' || kind === 'pine' ? 1 : 0;
            sway.push(0, 0, s, s);
        }
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    for (let y = 0; y < g.h; y++) {
        for (let x = 1; x < g.w - 1; x++) {
            if (!solid(x, y)) continue;
            if (free(x, y + 1) && r() < 0.3) {
                const kinds = theme.dress.filter(k => k !== 'vine' && k !== 'stal');
                const kind = kinds[Math.floor(r() * kinds.length)];
                add(kind, x + 0.2 + r() * 0.6, y + 0.96, kind === 'pine' ? 1.9 + r() * 0.8 : 0.72 + r() * 0.5, false);
            }
            if (y > 0 && free(x, y - 1) && r() < 0.22) {
                const hang = theme.dress.includes('vine') ? 'vine' : 'stal';
                add(hang, x + r(), y + 0.08, 0.8 + r() * 0.7, true);
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
    geometry.setIndex(idx);
    const material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
        uniforms: { map: { value: tex }, time: { value: 0 } },
        vertexShader: 'attribute float aSway; uniform float time; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; p.x += aSway * (sin(time * 1.7 + p.x * 0.8) * 0.07 + sin(time * 3.9 + p.y) * 0.025); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
        fragmentShader: 'uniform sampler2D map; varying vec2 vUv; void main(){ vec4 c = texture2D(map, vUv); if (c.a < 0.01) discard; gl_FragColor = c;\n#include <colorspace_fragment>\n}'
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = LAYER.dress;
    mesh.frustumCulled = false;
    mesh.userData.owned = true;
    root.add(mesh);
    return material;
}

