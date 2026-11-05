import * as THREE from '../lib/three.module.js';

const HAS_DOM = typeof document !== 'undefined';
export const INK = '#0a0b12';
export const PPU = 170;
export const LAYER = { sky: -200, far: -150, mid: -120, near: -100, fogBack: -90, terrain: 0, dress: 2, shadow: 4, back: 6, entity: 10, player: 40, fx: 60, fg: 90 };

const textures = new Map();
const materials = new Map();
const geometries = new Map();

export function rng(seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

export function rgba(hex, alpha = 1) {
    const h = typeof hex === 'number' ? hex.toString(16).padStart(6, '0') : hex.replace('#', '');
    return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${alpha})`;
}

export function mixHex(a, b, k) {
    const ha = a.replace('#', '');
    const hb = b.replace('#', '');
    const c = i => Math.round(parseInt(ha.slice(i, i + 2), 16) * (1 - k) + parseInt(hb.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0');
    return `#${c(0)}${c(2)}${c(4)}`;
}

export function trace(ctx, pts, closed = true) {
    const n = pts.length;
    ctx.beginPath();
    if (!closed) ctx.moveTo(pts[0][0], pts[0][1]);
    else ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
    const last = closed ? n : n - 1;
    for (let i = closed ? 0 : 0; i < last; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        const sharp = a[2] === 1;
        if (sharp) ctx.lineTo(a[0], a[1]);
        else ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    if (!closed) ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
    else ctx.closePath();
}

export function shape(ctx, pts, fill, lw = 0.028, line = INK) {
    trace(ctx, pts);
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
    if (lw > 0) {
        ctx.lineWidth = lw;
        ctx.strokeStyle = line;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
    }
}

export function stroke(ctx, pts, lw = 0.02, color = INK) {
    trace(ctx, pts, false);
    ctx.lineWidth = lw;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
}

export function clipTo(ctx, pts, fn) {
    ctx.save();
    trace(ctx, pts);
    ctx.clip();
    fn();
    ctx.restore();
}

export function vGrad(ctx, y1, y2, a, b) {
    const g = ctx.createLinearGradient(0, y1, 0, y2);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    return g;
}

export function hatch(ctx, x1, y1, x2, y2, count, color, lw = 0.012, seed = 1, tilt = 0.5) {
    const r = rng(seed);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
        const x = x1 + r() * (x2 - x1);
        const y = y1 + r() * (y2 - y1);
        const len = (0.04 + r() * 0.09) * (Math.abs(x2 - x1) + 0.4);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len * tilt, y - len);
        ctx.stroke();
    }
}

export function specks(ctx, x, y, w, h, count, color, size = 0.02, seed = 3) {
    const r = rng(seed);
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.arc(x + r() * w, y + r() * h, size * (0.4 + r()), 0, Math.PI * 2);
        ctx.fill();
    }
}

export function radial(ctx, x, y, radius, color, alpha = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, rgba(color, alpha));
    g.addColorStop(0.45, rgba(color, alpha * 0.32));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

export function rawCanvas(pxW, pxH) {
    if (!HAS_DOM) return null;
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.ceil(pxW));
    c.height = Math.max(2, Math.ceil(pxH));
    return c;
}

export function canvasTexture(canvas, repeat = false) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 2;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

function paint(key, w, h, draw, ax, ay, ppu) {
    if (!HAS_DOM) return null;
    if (textures.has(key)) return textures.get(key);
    const c = rawCanvas(w * ppu, h * ppu);
    const ctx = c.getContext('2d');
    ctx.setTransform(ppu, 0, 0, -ppu, ax * w * ppu, (1 - ay) * h * ppu);
    draw(ctx, w, h);
    const tex = canvasTexture(c);
    textures.set(key, tex);
    return tex;
}

export function basic(tex, opts = {}) {
    const { additive = false, opacity = 1, color = 0xffffff } = opts;
    return new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, toneMapped: false,
        fog: false, opacity, color, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
}

function planeGeo(w, h, ax, ay) {
    const key = `${w},${h},${ax},${ay}`;
    if (!geometries.has(key)) geometries.set(key, new THREE.PlaneGeometry(w, h).translate((0.5 - ax) * w, (0.5 - ay) * h, 0));
    return geometries.get(key);
}

export function sprite(key, w, h, draw, o = {}) {
    const { ax = 0.5, ay = 0.5, ppu = PPU, layer = LAYER.entity, additive = false, own = false, opacity = 1, color = 0xffffff, x = 0, y = 0 } = o;
    const tex = paint(`${key}@${ppu}`, w, h, draw, ax, ay, ppu);
    const mkey = `${key}@${ppu}|${additive}|${opacity}|${color}`;
    let material;
    if (own) material = basic(tex, { additive, opacity, color });
    else {
        if (!materials.has(mkey)) materials.set(mkey, basic(tex, { additive, opacity, color }));
        material = materials.get(mkey);
    }
    const m = new THREE.Mesh(planeGeo(w, h, ax, ay), material);
    m.renderOrder = layer;
    m.position.set(x, y, 0);
    return m;
}

const softDraw = ctx => radial(ctx, 0, 0, 1, '#ffffff', 1);

export function glowSprite(color, size, o = {}) {
    const m = sprite('softglow', 2, 2, softDraw, { ppu: 48, additive: true, own: true, color, layer: o.layer ?? LAYER.fx, opacity: o.opacity ?? 0.7 });
    m.scale.setScalar(size);
    if (o.x !== undefined) m.position.set(o.x, o.y, 0);
    return m;
}

export function group(layer, ...children) {
    const g = new THREE.Group();
    if (children.length) g.add(...children);
    if (layer !== undefined) g.traverse(n => { if (n.isMesh) n.renderOrder += layer; });
    return g;
}

export function pivot(x, y, ...children) {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    if (children.length) g.add(...children);
    return g;
}

export function setOrder(root, base) {
    root.traverse(n => { if (n.isMesh) n.renderOrder = base + (n.renderOrder % 10); });
    return root;
}
