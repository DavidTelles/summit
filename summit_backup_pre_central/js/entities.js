import * as THREE from '../lib/three.module.js';

const materials = new Map();
const geometries = new Map();

const mat = (color, extra = {}) => {
    const key = color + JSON.stringify(extra);
    if (!materials.has(key)) materials.set(key, new THREE.MeshLambertMaterial({ color, ...extra }));
    return materials.get(key);
};

const geo = (key, build) => {
    if (!geometries.has(key)) geometries.set(key, build());
    return geometries.get(key);
};

const boxGeo = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const box = (w, h, d, material, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(boxGeo(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
};
const glow = (color, power = 0.8, opacity) => mat(color, {
    emissive: color,
    emissiveIntensity: power,
    ...(opacity !== undefined ? { transparent: true, opacity, depthWrite: false } : {})
});
const pivot = (x, y, z, ...children) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    if (children.length) g.add(...children);
    return g;
};
const damp = (a, b, k) => a + (b - a) * k;

const POSES = {
    idle: { lean: 0, legL: 0, legR: 0, armL: 0.08, armR: -0.08, crouch: 0 },
    walk: { lean: 0.06, legL: 0, legR: 0, armL: 0, armR: 0, crouch: 0 },
    run: { lean: 0.2, legL: 0, legR: 0, armL: 0, armR: 0, crouch: 0.02 },
    jump: { lean: 0.05, legL: 0.7, legR: -0.35, armL: -2.4, armR: 0.5, crouch: 0 },
    spin: { lean: 0.2, legL: 0.9, legR: 0.9, armL: 0.5, armR: 0.5, crouch: 0 },
    fall: { lean: -0.04, legL: 0.3, legR: -0.5, armL: -1.5, armR: 1.5, crouch: 0 },
    land: { lean: 0.28, legL: 0.75, legR: 0.75, armL: 0.5, armR: 0.5, crouch: 0.16 },
    dash: { lean: 0.95, legL: -0.9, legR: -1.3, armL: -1.6, armR: 1.2, crouch: 0.06 },
    grab: { lean: 0, legL: 0.5, legR: -0.1, armL: -2.5, armR: -2.1, crouch: 0 },
    climb: { lean: 0, legL: 0, legR: 0, armL: 0, armR: 0, crouch: 0 },
    slide: { lean: -0.1, legL: 0.6, legR: 0.2, armL: -2.6, armR: -0.5, crouch: 0.04 },
    pound: { lean: 0.15, legL: 1.5, legR: 1.5, armL: -2.9, armR: 2.9, crouch: 0.1 },
    hurt: { lean: -0.6, legL: -0.5, legR: 0.5, armL: 2.2, armR: -2.2, crouch: 0 },
    dead: { lean: 0, legL: 0, legR: 0, armL: 0, armR: 0, crouch: 0 }
};
const HAIR_COLORS = [0x3bc7ff, 0xff3b3b, 0xff7ac8];

export const flagOnMat = glow(0x3ddc84, 0.5);
export const flagOffMat = mat(0x8a93a6);
export const pulseOnMat = mat(0x8bd7ff, { emissive: 0x2a7fb0, emissiveIntensity: 0.7 });
export const pulseOffMat = mat(0x8bd7ff, { transparent: true, opacity: 0.16, depthWrite: false });
export const pulseWarnMat = mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6, transparent: true, opacity: 0.55, depthWrite: false });

export function makePlayer() {
    const group = new THREE.Group();
    const body = new THREE.Group();
    const coat = mat(0x3b82f6);
    const skin = mat(0xffd9b8);
    const boot = mat(0x1e293b);
    const hairMat = new THREE.MeshLambertMaterial({ color: 0xff3b3b, emissive: 0x330000 });

    const torso = box(0.46, 0.4, 0.34, coat, 0, 0.42, 0);
    const pack = box(0.3, 0.36, 0.16, mat(0xc77b2f), -0.3, 0.44, 0);
    const scarf = box(0.5, 0.1, 0.38, mat(0xffd23f), 0, 0.62, 0);
    const head = pivot(0, 0.86, 0,
        box(0.46, 0.4, 0.42, skin),
        box(0.07, 0.11, 0.03, mat(0x111111), 0.17, 0.02, 0.21),
        box(0.07, 0.11, 0.03, mat(0x111111), 0.17, 0.02, -0.21),
        box(0.08, 0.13, 0.03, mat(0x111111), 0.24, 0.02, 0.1),
        box(0.08, 0.13, 0.03, mat(0x111111), 0.24, 0.02, -0.1)
    );
    const hairTop = new THREE.Mesh(boxGeo(0.52, 0.2, 0.48), hairMat);
    hairTop.position.set(-0.02, 0.2, 0);
    const hairBack = new THREE.Mesh(boxGeo(0.16, 0.3, 0.46), hairMat);
    hairBack.position.set(-0.2, 0.04, 0);
    head.add(hairTop, hairBack);
    const tail = pivot(-0.3, 0.98, 0);
    const tailA = new THREE.Mesh(boxGeo(0.22, 0.2, 0.22), hairMat);
    tailA.position.x = -0.08;
    const tailB = new THREE.Mesh(boxGeo(0.16, 0.14, 0.16), hairMat);
    tailB.position.x = -0.26;
    tail.add(tailA, tailB);

    const limb = (w, h, material, end) => {
        const p = new THREE.Group();
        const seg = box(w, h, w, material, 0, -h / 2, 0);
        p.add(seg);
        if (end) p.add(box(w + 0.05, 0.1, w + 0.1, end, 0.03, -h - 0.02, 0));
        return p;
    };
    const legL = limb(0.15, 0.26, mat(0x24406f), boot);
    legL.position.set(0, 0.28, 0.1);
    const legR = limb(0.15, 0.26, mat(0x24406f), boot);
    legR.position.set(0, 0.28, -0.1);
    const armL = limb(0.12, 0.3, coat, skin);
    armL.position.set(0, 0.6, 0.23);
    const armR = limb(0.12, 0.3, coat, skin);
    armR.position.set(0, 0.6, -0.23);

    body.add(torso, pack, scarf, head, tail, legL, legR, armL, armR);
    group.add(body);
    group.rotation.y = 0;
    group.userData = {
        body, head, tail, legL, legR, armL, armR, hairMat, spinAngle: 0, turn: 1, pose: 'idle', phase: 0,
        cur: { ...POSES.idle }
    };
    return group;
}

export function animatePlayer(group, p, pose, dt, t) {
    const u = group.userData;
    const k = Math.min(1, dt * (pose === 'dash' || pose === 'land' || pose === 'hurt' ? 28 : 16));
    u.turn = damp(u.turn, p.facing, Math.min(1, dt * 18));
    group.position.set(p.x, p.y, 0.1);
    group.rotation.y = (1 - u.turn) * (Math.PI / 2);

    const target = POSES[pose] || POSES.idle;
    const cur = u.cur;
    for (const key of Object.keys(cur)) cur[key] = damp(cur[key], target[key], k);

    let swing = 0;
    let climb = 0;
    if (pose === 'walk' || pose === 'run') {
        u.phase += dt * Math.abs(p.vx) * (pose === 'run' ? 1.5 : 2.1);
        swing = Math.sin(u.phase) * (pose === 'run' ? 1.05 : 0.65);
    }
    if (pose === 'climb') {
        u.phase += dt * 12 * Math.sign(p.climbing || 1);
        climb = Math.sin(u.phase);
    }
    const breath = pose === 'idle' ? Math.sin(t * 2.4) * 0.012 : 0;
    const bob = (pose === 'run' || pose === 'walk') ? Math.abs(Math.cos(u.phase)) * 0.05 : 0;

    p.squash += (1 - p.squash) * Math.min(1, dt * 14);
    const b = u.body;
    b.scale.set(1 / p.squash, p.squash + breath, 1);
    b.position.y = bob - cur.crouch;

    let lean = cur.lean;
    if (pose === 'dash' && p.dashDir.y !== 0) lean = 0.95 * Math.abs(p.dashDir.x) + (p.dashDir.y > 0 ? -0.3 : 0.6);
    b.rotation.z = -lean;
    if (pose === 'spin' || pose === 'pound') u.spinAngle += dt * (pose === 'pound' ? 34 : 22);
    else u.spinAngle = 0;
    if (u.spinAngle) b.rotation.z = -u.spinAngle;

    u.legL.rotation.z = cur.legL + swing - climb * 0.7;
    u.legR.rotation.z = cur.legR - swing + climb * 0.7;
    u.armL.rotation.z = cur.armL - swing * 0.8 + (pose === 'climb' ? -2.4 + climb * 0.5 : 0);
    u.armR.rotation.z = cur.armR + swing * 0.8 + (pose === 'climb' ? -2.4 - climb * 0.5 : 0);
    u.head.rotation.z = pose === 'hurt' ? 0.4 : Math.sin(t * 1.3) * 0.02;

    const air = p.onGround ? 0 : Math.max(-0.9, Math.min(0.9, p.vy * 0.06));
    u.tail.rotation.z = Math.sin(t * 13) * 0.14 + air + Math.min(0.9, Math.abs(p.vx) * 0.06);

    const dashesLeft = Math.min(2, Math.max(0, p.dashes));
    u.hairMat.color.setHex(HAIR_COLORS[dashesLeft]);
    group.visible = !p.dead && (p.iframes <= 0 || Math.floor(p.iframes * 16) % 2 === 0);
}

export function makeBerry() {
    const g = new THREE.Group();
    const fruit = new THREE.Mesh(geo('berry', () => new THREE.SphereGeometry(0.32, 14, 12)), mat(0xff2d55, { emissive: 0x550011 }));
    fruit.scale.y = 1.15;
    const leaf = new THREE.Mesh(geo('leaf', () => new THREE.ConeGeometry(0.22, 0.18, 6)), mat(0x3ddc84));
    leaf.position.y = 0.4;
    g.add(fruit, leaf);
    return g;
}

export function makeCrystal() {
    const m = new THREE.Mesh(geo('crystal', () => new THREE.OctahedronGeometry(0.4)), mat(0x7df9ff, { emissive: 0x1a8a99, transparent: true, opacity: 0.9 }));
    m.scale.y = 1.4;
    return m;
}

export function makeSpring() {
    const g = new THREE.Group();
    const base = box(0.9, 0.15, 0.9, mat(0x666666), 0, 0.08, 0);
    const top = box(0.8, 0.12, 0.8, mat(0xffd23f, { emissive: 0x443300 }), 0, 0.4, 0);
    const coil = new THREE.Mesh(geo('coil', () => new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8)), mat(0xcccccc));
    coil.position.y = 0.24;
    g.add(base, top, coil);
    g.userData.top = top;
    g.userData.coil = coil;
    return g;
}

export function makeSpikes(ceiling = false) {
    const g = new THREE.Group();
    const spike = geo('spike', () => new THREE.ConeGeometry(0.17, 0.55, 4));
    for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(spike, mat(0xe8e8f0));
        c.position.set(0.17 + i * 0.33, ceiling ? 0.73 : 0.27, 0);
        if (ceiling) c.rotation.x = Math.PI;
        c.castShadow = true;
        g.add(c);
    }
    return g;
}

export function makeFlag() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(geo('pole', () => new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6)), mat(0xdddddd));
    pole.position.y = 0.8;
    const cloth = box(0.7, 0.45, 0.05, flagOffMat, 0.38, 1.3, 0);
    const base = box(0.5, 0.1, 0.5, mat(0x70798a), 0, 0.05, 0);
    g.add(pole, cloth, base);
    g.userData.cloth = cloth;
    return g;
}

export function makeGoal() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(geo('ring', () => new THREE.TorusGeometry(0.9, 0.12, 10, 28)), mat(0xffd23f, { emissive: 0x886600 }));
    ring.position.y = 1;
    const core = new THREE.Mesh(geo('core', () => new THREE.IcosahedronGeometry(0.45)), mat(0xffffff, { emissive: 0xffee99 }));
    core.position.y = 1;
    const beam = box(0.5, 14, 0.5, glow(0xffe9a0, 0.8, 0.14), 0, 7, 0);
    beam.castShadow = false;
    g.add(ring, core, beam);
    g.userData.ring = ring;
    g.userData.core = core;
    return g;
}

export function makeCrumble() {
    return box(1, 0.5, 1.4, mat(0xc99a5b));
}

export function makeSpecialBlock(kind) {
    if (kind === 'O' || kind === 'o') {
        return new THREE.Mesh(boxGeo(1, 1, 1.5), kind === 'O' ? pulseOnMat : pulseOffMat);
    }
    const g = new THREE.Group();
    const color = kind === 'X' ? 0x8d7a66 : 0x7b6a8d;
    g.add(box(1, 1, 2, mat(color)));
    g.add(box(0.9, 0.08, 0.02, mat(0x241c18), 0, 0.15, 1.01));
    g.add(box(0.08, 0.6, 0.02, mat(0x241c18), -0.15, -0.1, 1.01));
    g.add(box(0.5, 0.08, 0.02, mat(0x241c18), 0.2, -0.25, 1.01));
    if (kind === 'Y') g.add(box(1.02, 0.1, 2.02, glow(0xc89bff, 0.5), 0, 0.47, 0));
    return g;
}

export function makeMover(w, h) {
    const g = new THREE.Group();
    g.add(box(w, h, 1.6, mat(0x6f7b94), w / 2, h / 2, 0));
    g.add(box(w, 0.14, 1.65, mat(0xffd23f, { emissive: 0x443300 }), w / 2, h - 0.07, 0));
    g.add(box(0.3, 0.3, 1.7, glow(0x7df9ff, 0.7), w / 2, h / 2 - 0.1, 0));
    return g;
}

export function makeGust(w, h, fx, fy) {
    const g = new THREE.Group();
    const lanes = [];
    const material = glow(0xdff2ff, 0.5, 0.45);
    const count = Math.max(4, Math.round((fx ? h : w) * 1.2));
    for (let i = 0; i < count; i++) {
        const offset = ((i + 0.5) / count - 0.5) * (fx ? h : w);
        const lane = fx
            ? new THREE.Mesh(boxGeo(1.6, 0.05, 0.05), material)
            : new THREE.Mesh(boxGeo(0.05, 1.6, 0.05), material);
        if (fx) lane.position.y = offset;
        else lane.position.x = offset;
        lanes.push(lane);
        g.add(lane);
    }
    g.userData.lanes = lanes;
    return g;
}

const TELEGRAPH = {
    warn: glow(0xfff0a0, 0.6, 0.28),
    strike: glow(0xffffff, 1, 0.9)
};

export function setTelegraph(mesh, state) {
    const beam = mesh.userData.beam;
    if (!beam) return;
    if (state === 'idle') {
        beam.visible = false;
        return;
    }
    beam.visible = true;
    beam.material = mesh.userData[state] || TELEGRAPH[state];
    beam.scale.x = state === 'warn' ? 0.35 : 1;
}

function beamGroup(w, h, centerY, strikeColor) {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(boxGeo(w, h, 0.6), TELEGRAPH.warn);
    beam.position.y = centerY;
    beam.visible = false;
    g.add(beam);
    g.userData.beam = beam;
    if (strikeColor !== undefined) {
        g.userData.warn = glow(strikeColor, 0.7, 0.3);
        g.userData.strike = glow(strikeColor, 1.2, 0.92);
    }
    return g;
}

export function makeBolt(w, h) {
    return beamGroup(w, h, 0, 0xcfe6ff);
}

export function makeStrike(w, h, color) {
    return beamGroup(w, h, 0, color);
}

export function makeGeyser(w, h) {
    const g = beamGroup(w - 0.2, h, h / 2, 0xff8a3c);
    g.add(box(w, 0.2, 1.4, mat(0x4a2a20), 0, 0.1, 0));
    g.add(box(w * 0.6, 0.06, 1.2, glow(0xff8a3c, 0.8), 0, 0.22, 0));
    return g;
}

export function makeFireBar(arms, len) {
    const g = new THREE.Group();
    g.add(box(0.7, 0.7, 1, mat(0x3a2c2c)));
    for (let a = 0; a < arms; a++) {
        const arm = new THREE.Group();
        arm.rotation.z = (a / arms) * Math.PI * 2;
        for (let r = 0.8; r <= len; r += 0.8) {
            arm.add(box(0.5, 0.5, 0.5, glow(r > len - 1 ? 0xffd23f : 0xff7a2a, 1), r, 0, 0));
        }
        g.add(arm);
    }
    return g;
}

export function makeLava(w) {
    const g = new THREE.Group();
    const surface = box(w, 0.3, 3, glow(0xff6a22, 0.9), 0, -0.15, 0);
    surface.castShadow = false;
    const body = box(w, 40, 3, glow(0xa8240c, 0.8), 0, -20.3, 0);
    body.castShadow = false;
    g.add(surface, body);
    return g;
}

export function makeShot(color, r, ground) {
    if (ground) return box(r * 1.6, r * 4, 0.5, glow(color, 1));
    const m = new THREE.Mesh(geo('shot', () => new THREE.IcosahedronGeometry(1, 0)), glow(color, 1.1));
    m.scale.setScalar(r);
    return m;
}

export function makeGate(h) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) g.add(box(0.2, h, 0.2, mat(0x4f5667), 0, h / 2, -0.5 + i * 0.5));
    for (let y = 1; y < h; y += 2) g.add(box(0.3, 0.14, 1.4, mat(0x70798a), 0, y, 0));
    return g;
}

export function makeSigil() {
    const g = new THREE.Group();
    const m = glow(0xc89bff, 1.1);
    g.add(box(2.2, 0.14, 0.4, m), box(0.14, 2.2, 0.4, m));
    const b = box(1.5, 1.5, 0.3, glow(0xc89bff, 0.6, 0.35));
    b.rotation.z = Math.PI / 4;
    g.add(b);
    return g;
}

export function makeWalker() {
    const g = new THREE.Group();
    const c = mat(0x8b2fc9);
    const body = pivot(0, 0, 0,
        box(0.78, 0.5, 0.7, c, 0, 0.42, 0),
        box(0.84, 0.12, 0.76, mat(0x5e1d8c), 0, 0.68, 0),
        box(0.22, 0.2, 0.08, glow(0xffffff), 0.26, 0.48, 0.2),
        box(0.22, 0.2, 0.08, glow(0xffffff), 0.26, 0.48, -0.2),
        box(0.1, 0.1, 0.1, mat(0x000000), 0.34, 0.46, 0.2),
        box(0.1, 0.1, 0.1, mat(0x000000), 0.34, 0.46, -0.2)
    );
    const hornGeo = geo('horn', () => new THREE.ConeGeometry(0.1, 0.25, 4));
    for (const x of [-0.2, 0.2]) {
        const horn = new THREE.Mesh(hornGeo, mat(0xffd23f));
        horn.position.set(x, 0.86, 0);
        body.add(horn);
    }
    const feet = [-0.26, 0.26].map(x => box(0.24, 0.18, 0.5, mat(0x3b1460), x, 0.09, 0));
    g.add(body, ...feet);
    g.userData = { body, feet };
    return g;
}

export function makeFlyer() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(geo('flyerBody', () => new THREE.SphereGeometry(0.4, 12, 10)), mat(0xff7a3d, { emissive: 0x331100 }));
    body.position.y = 0.4;
    const wingL = pivot(0, 0.5, 0.3, box(0.3, 0.05, 0.6, mat(0xffe0c0), 0, 0, 0.3));
    const wingR = pivot(0, 0.5, -0.3, box(0.3, 0.05, 0.6, mat(0xffe0c0), 0, 0, -0.3));
    const eye = new THREE.Mesh(geo('flyerEye', () => new THREE.SphereGeometry(0.1, 8, 8)), glow(0xffffff));
    eye.position.set(0.33, 0.48, 0);
    g.add(body, wingL, wingR, eye);
    g.userData = { wingL, wingR };
    return g;
}

export function makeCharger() {
    const g = new THREE.Group();
    const dark = mat(0x7d3323);
    const body = pivot(0, 0, 0,
        box(1.1, 0.6, 0.8, mat(0xc2553b), 0, 0.52, 0),
        box(0.5, 0.5, 0.65, dark, 0.65, 0.48, 0),
        box(0.34, 0.12, 0.08, glow(0xffe08a), 0.76, 0.58, 0.3),
        box(0.34, 0.12, 0.08, glow(0xffe08a), 0.76, 0.58, -0.3),
        box(0.5, 0.14, 0.14, mat(0xe8e0d0), 0.98, 0.34, 0.26),
        box(0.5, 0.14, 0.14, mat(0xe8e0d0), 0.98, 0.34, -0.26)
    );
    for (let i = 0; i < 3; i++) {
        const spike = new THREE.Mesh(geo('horn', () => new THREE.ConeGeometry(0.1, 0.25, 4)), mat(0xe8e0d0));
        spike.position.set(-0.35 + i * 0.35, 0.92, 0);
        body.add(spike);
    }
    const feet = [-0.35, 0.35].map(x => box(0.26, 0.22, 0.7, dark, x, 0.11, 0));
    g.add(body, ...feet);
    g.userData = { body, feet };
    return g;
}

export function makeSpitter() {
    const g = new THREE.Group();
    g.add(box(0.9, 0.22, 0.9, mat(0x3f5d38), 0, 0.11, 0));
    const stem = box(0.26, 0.5, 0.26, mat(0x4f8a4a), 0, 0.42, 0);
    const head = pivot(0, 0.82, 0,
        box(0.72, 0.5, 0.66, mat(0x5fae5a)),
        box(0.34, 0.3, 0.42, mat(0x1b2b1a), 0.24, 0, 0),
        box(0.12, 0.12, 0.08, glow(0xfff0a0), 0.1, 0.2, 0.3),
        box(0.12, 0.12, 0.08, glow(0xfff0a0), 0.1, 0.2, -0.3)
    );
    g.add(stem, head);
    g.userData = { head };
    return g;
}

export function makeShieldbearer() {
    const g = new THREE.Group();
    const steel = mat(0x6b7fa8);
    const body = pivot(0, 0, 0,
        box(0.62, 0.72, 0.56, steel, 0, 0.64, 0),
        box(0.5, 0.36, 0.48, mat(0x46557a), 0, 1.16, 0),
        box(0.08, 0.08, 0.32, glow(0xff5a3c), 0.26, 1.18, 0)
    );
    const shield = pivot(0.5, 0.65, 0,
        box(0.14, 1.2, 0.9, mat(0xc7d1e6)),
        box(0.06, 0.8, 0.5, mat(0xffd23f, { emissive: 0x443300 }), 0.08, 0, 0)
    );
    body.add(shield);
    const feet = [-0.2, 0.2].map(x => box(0.24, 0.28, 0.4, mat(0x2d3652), x, 0.14, 0));
    g.add(body, ...feet);
    g.userData = { body, feet, shield };
    return g;
}

export function makeDiver() {
    const g = new THREE.Group();
    const body = pivot(0, 0.35, 0,
        box(0.6, 0.42, 0.42, mat(0x4c4f8f)),
        box(0.34, 0.1, 0.1, mat(0xffd23f), 0.42, -0.06, 0),
        box(0.1, 0.1, 0.06, glow(0xff5a3c), 0.26, 0.08, 0.22),
        box(0.1, 0.1, 0.06, glow(0xff5a3c), 0.26, 0.08, -0.22)
    );
    const wingL = pivot(0, 0.46, 0.2, box(0.42, 0.05, 0.8, mat(0x32345f), 0, 0, 0.4));
    const wingR = pivot(0, 0.46, -0.2, box(0.42, 0.05, 0.8, mat(0x32345f), 0, 0, -0.4));
    g.add(body, wingL, wingR);
    g.userData = { body, wingL, wingR };
    return g;
}

export function makeSentinel() {
    const g = new THREE.Group();
    const core = pivot(0, 0.5, 0,
        new THREE.Mesh(geo('sentinel', () => new THREE.OctahedronGeometry(0.55)), mat(0xe0b040, { emissive: 0x553300 })),
        box(0.2, 0.2, 0.7, glow(0xffffff), 0, 0, 0)
    );
    const orbGeo = geo('orb', () => new THREE.IcosahedronGeometry(0.38, 0));
    const orbs = [0, 1].map(() => {
        const o = new THREE.Mesh(orbGeo, glow(0xff7a2a, 1));
        g.add(o);
        return o;
    });
    g.add(core);
    g.userData = { core, orbs };
    return g;
}

export function animateEnemy(m, e, t) {
    const u = m.userData;
    if (u.wingL) {
        const rate = e.state === 'swoop' ? 40 : 20;
        const w = Math.sin(t * rate + e.ox) * 0.6;
        u.wingL.rotation.x = -w;
        u.wingR.rotation.x = w;
    }
    if (u.feet) {
        const moving = e.state === 'idle' || e.state === 'charge' || e.state === 'bash';
        const rate = e.state === 'charge' ? 26 : 10;
        u.feet.forEach((f, i) => { f.position.y = f.geometry.parameters.height / 2 + (moving ? Math.max(0, Math.sin(t * rate + i * Math.PI)) * 0.1 : 0); });
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
    }
    if (u.orbs) {
        u.core.rotation.y = t * 2;
        u.orbs.forEach((o, i) => {
            const a = e.phase + i * Math.PI;
            const side = m.rotation.y === 0 ? 1 : -1;
            o.position.set(Math.cos(a) * (e.orbR || 2) * side, 0.5 + Math.sin(a) * (e.orbR || 2), 0);
        });
    }
}

export function makeRamBoss() {
    const g = new THREE.Group();
    const stone = mat(0x6a6358);
    const dark = mat(0x45403a);
    const body = pivot(0, 1.35, 0,
        box(2.5, 1.5, 1.8, stone),
        box(2.1, 0.5, 1.5, dark, -0.1, 0.9, 0),
        box(0.5, 0.7, 0.5, dark, -0.8, 1.1, 0),
        box(0.5, 0.5, 0.5, dark, 0, 1.25, 0)
    );
    const coreMat = new THREE.MeshLambertMaterial({ color: 0xff8a3c, emissive: 0xff5a1c, emissiveIntensity: 0.4 });
    const core = new THREE.Mesh(boxGeo(0.7, 0.7, 1.84), coreMat);
    core.position.set(0.6, -0.1, 0);
    body.add(core);
    const eyeMat = new THREE.MeshLambertMaterial({ color: 0xffe08a, emissive: 0xffc040, emissiveIntensity: 0.8 });
    const head = pivot(1.55, 0.3, 0,
        box(1, 1, 1.2, stone),
        box(0.5, 0.4, 0.8, dark, 0.6, -0.25, 0)
    );
    for (const z of [0.42, -0.42]) {
        const eye = new THREE.Mesh(boxGeo(0.3, 0.14, 0.1), eyeMat);
        eye.position.set(0.3, 0.14, z);
        head.add(eye);
        const s = Math.sign(z);
        head.add(box(0.9, 0.34, 0.34, mat(0xd9cfb8), -0.1, 0.55, z + s * 0.2));
        head.add(box(0.34, 0.8, 0.34, mat(0xd9cfb8), -0.55, 0.2, z + s * 0.32));
        head.add(box(0.4, 0.3, 0.3, mat(0xd9cfb8), -0.4, -0.25, z + s * 0.32));
    }
    body.add(head);
    const legs = [[-0.9, 0.7], [-0.9, -0.7], [0.9, 0.7], [0.9, -0.7]].map(([x, z]) => {
        const leg = pivot(x, 1, z, box(0.6, 1, 0.6, dark, 0, -0.5, 0));
        g.add(leg);
        return leg;
    });
    g.add(body);
    g.userData = { body, head, legs, coreMat, eyeMat };
    return g;
}

export function makeStormBoss() {
    const g = new THREE.Group();
    const cloud = mat(0x394a6b);
    const ring = new THREE.Group();
    for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const s = 0.9 + (i % 3) * 0.3;
        ring.add(box(s, s, s, i % 2 ? cloud : mat(0x56688c), Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0));
    }
    const rods = new THREE.Group();
    for (let i = 0; i < 4; i++) {
        const rod = pivot(0, 0, 0, box(0.16, 1.2, 0.16, glow(0xbfe0ff, 1), 0, 3.4, 0));
        rod.rotation.z = (i / 4) * Math.PI * 2;
        rods.add(rod);
    }
    const lidMat = new THREE.MeshLambertMaterial({ color: 0x2a3550 });
    const lidTop = box(2.3, 1.1, 1.5, lidMat, 0, 0.6, 0.1);
    const lidBottom = box(2.3, 1.1, 1.5, lidMat, 0, -0.6, 0.1);
    const irisMat = new THREE.MeshLambertMaterial({ color: 0xcfe6ff, emissive: 0x9fd0ff, emissiveIntensity: 0.9 });
    const iris = new THREE.Mesh(geo('eye', () => new THREE.SphereGeometry(1.05, 14, 12)), irisMat);
    const pupil = box(0.5, 0.9, 0.4, mat(0x10131f), 0, 0, 0.9);
    const eye = pivot(0, 0, 0, iris, pupil);
    const rig = pivot(0, 1.7, 0, ring, rods, eye, lidTop, lidBottom);
    g.add(rig);
    g.userData = { rig, ring, rods, lidTop, lidBottom, pupil, irisMat };
    return g;
}

export function makeColossus() {
    const g = new THREE.Group();
    const rock = mat(0x5d5157);
    const dark = mat(0x3b3238);
    const faceMat = new THREE.MeshLambertMaterial({ color: 0xff8a5a, emissive: 0xff3c1c, emissiveIntensity: 0.5 });
    const head = pivot(0, 1.8, 0,
        box(3.6, 3.2, 2.6, rock),
        box(4, 0.7, 2.8, dark, 0, 1.5, 0),
        box(1.2, 0.8, 1.2, dark, -1.3, 2, 0),
        box(1.2, 1.2, 1.2, dark, 1.3, 2.2, 0),
        box(1.4, 1.3, 1.4, dark, 0, 2.5, 0),
        box(2.8, 0.4, 0.2, dark, 0, -1.0, 1.32)
    );
    const eyeL = new THREE.Mesh(boxGeo(0.9, 0.5, 0.2), faceMat);
    eyeL.position.set(-0.8, 0.25, 1.32);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.8;
    const core = new THREE.Mesh(boxGeo(0.9, 0.9, 0.2), faceMat);
    core.position.set(0, -0.5, 1.32);
    core.rotation.z = Math.PI / 4;
    head.add(eyeL, eyeR, core);
    const hand = () => pivot(0, 0, 0,
        box(2.8, 0.9, 1.8, rock, 0, 0.45, 0),
        box(0.6, 0.7, 0.5, dark, -1, 1.1, 0),
        box(0.6, 0.8, 0.5, dark, 0, 1.2, 0),
        box(0.6, 0.7, 0.5, dark, 1, 1.1, 0),
        box(3, 0.16, 1.9, glow(0xff8a5a, 0.8), 0, 0.08, 0)
    );
    const handL = hand();
    const handR = hand();
    g.add(head, handL, handR);
    g.userData = { head, handL, handR, faceMat };
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
        u.legs.forEach((leg, i) => { leg.rotation.z = rate ? Math.sin(t * rate + i * 1.6) * 0.6 : 0; });
        const tell = b.act === 'charge' || b.act === 'rush' || b.act === 'leap';
        const stunned = b.act === 'stunned' || b.act === 'landed';
        u.body.rotation.z = stunned ? -0.32 + Math.sin(t * 20) * 0.015 : tell ? 0.24 : running ? -0.16 : 0;
        u.body.position.y = 1.35 + (tell ? -0.3 + Math.sin(t * 34) * 0.02 : stunned ? -0.35 : Math.sin(t * 3) * 0.04);
        u.coreMat.emissiveIntensity = flash ? 3 : b.vulnerable ? 1.6 + Math.sin(t * 14) * 0.6 : 0.3;
        u.eyeMat.emissiveIntensity = tell || b.phase > 0 ? 2 : stunned ? 0.1 : 0.8;
    }
    if (u.rig) {
        u.ring.rotation.z = t * (b.phase > 0 ? 1.8 : 1);
        u.rods.rotation.z = -t * 1.4;
        const open = b.vulnerable ? 1 : b.act === 'descend' ? 0.5 : 0.14;
        u.lidTop.position.y += (0.6 + open * 1.05 - u.lidTop.position.y) * 0.18;
        u.lidBottom.position.y += (-0.6 - open * 1.05 - u.lidBottom.position.y) * 0.18;
        const p = b.game.player;
        u.pupil.position.x = Math.max(-0.5, Math.min(0.5, (p.x - b.x) * 0.06));
        u.pupil.position.y = Math.max(-0.4, Math.min(0.4, (p.y - b.y) * 0.05));
        u.irisMat.emissive.setHex(b.phase > 0 ? 0xffb080 : 0x9fd0ff);
        u.irisMat.emissiveIntensity = flash ? 3 : b.vulnerable ? 1.5 : 0.8;
    }
    if (u.faceMat) {
        u.head.rotation.z = b.act === 'staggered' ? Math.sin(t * 18) * 0.05 + 0.1 : Math.sin(t) * 0.03;
        u.faceMat.emissiveIntensity = flash ? 3.5 : b.vulnerable ? 2 + Math.sin(t * 14) * 0.6 : 0.5 + b.phase * 0.3;
    }
}
