import * as THREE from '../lib/three.module.js';

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial(Object.assign({ color }, extra));

export function makePlayer() {
    const group = new THREE.Group();
    const body = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.5), mat(0x3b82f6));
    torso.position.y = 0.3;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.55), mat(0xffd9b8));
    head.position.y = 0.72;
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.28, 0.62), mat(0xff3b3b));
    hair.position.y = 0.92;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), mat(0xff3b3b));
    tail.position.set(-0.4, 0.8, 0);
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.05), mat(0x111111));
    eyeL.position.set(0.12, 0.74, 0.29);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.28;
    const feet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.45), mat(0x1e293b));
    feet.position.y = 0.06;
    body.add(torso, head, hair, tail, eyeL, eyeR, feet);
    group.add(body);
    group.userData = { body, hair, tail, torso };
    return group;
}

export function makeBerry() {
    const g = new THREE.Group();
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), mat(0xff2d55, { emissive: 0x550011 }));
    fruit.scale.y = 1.15;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 6), mat(0x3ddc84));
    leaf.position.y = 0.4;
    g.add(fruit, leaf);
    return g;
}

export function makeCrystal() {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), mat(0x7df9ff, { emissive: 0x1a8a99, transparent: true, opacity: 0.9 }));
    m.scale.y = 1.4;
    return m;
}

export function makeSpring() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 0.9), mat(0x666666));
    base.position.y = 0.08;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.8), mat(0xffd23f, { emissive: 0x443300 }));
    top.position.y = 0.4;
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8), mat(0xcccccc));
    coil.position.y = 0.24;
    g.add(base, top, coil);
    g.userData.top = top;
    g.userData.coil = coil;
    return g;
}

export function makeSpikes() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.55, 4), mat(0xe8e8f0));
        c.position.set(0.17 + i * 0.33, 0.27, 0);
        g.add(c);
    }
    return g;
}

export function makeWalker() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.65, 0.7), mat(0x8b2fc9));
    body.position.y = 0.38;
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.1), mat(0xffffff, { emissive: 0xffffff }));
    eye.position.set(0.22, 0.5, 0.36);
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.05), mat(0x000000));
    pupil.position.set(0.26, 0.5, 0.42);
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 4), mat(0xffd23f));
    hornL.position.set(-0.2, 0.84, 0);
    const hornR = hornL.clone();
    hornR.position.x = 0.2;
    g.add(body, eye, pupil, hornL, hornR);
    g.userData.body = body;
    return g;
}

export function makeFlyer() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), mat(0xff7a3d, { emissive: 0x331100 }));
    body.position.y = 0.4;
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.35), mat(0xffe0c0));
    wingL.position.set(-0.45, 0.55, 0);
    const wingR = wingL.clone();
    wingR.position.x = 0.45;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), mat(0xffffff, { emissive: 0xffffff }));
    eye.position.set(0.15, 0.48, 0.34);
    g.add(body, wingL, wingR, eye);
    g.userData.wingL = wingL;
    g.userData.wingR = wingR;
    return g;
}

export function makeFlag() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), mat(0xdddddd));
    pole.position.y = 0.8;
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.05), mat(0x888888));
    cloth.position.set(0.38, 1.3, 0);
    g.add(pole, cloth);
    g.userData.cloth = cloth;
    return g;
}

export function makeGoal() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 10, 28), mat(0xffd23f, { emissive: 0x886600 }));
    ring.position.y = 1;
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45), mat(0xffffff, { emissive: 0xffee99 }));
    core.position.y = 1;
    g.add(ring, core);
    g.userData.ring = ring;
    g.userData.core = core;
    return g;
}

export function makeCrumble() {
    return new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 1.4), mat(0xc99a5b));
}
