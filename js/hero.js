import * as THREE from '../lib/three.module.js';
import * as E from './entities.js';

const ROCK = { 1: 0x7f92b5, 2: 0x5d6390, 3: 0x7a4a48 };
const RIM = { 1: 0x9fdcff, 2: 0xb3a6ff, 3: 0xff9a66 };

export class HeroStage {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
        this.camera.position.set(0, 0.92, 5.2);
        this.camera.lookAt(0, 0.62, 0);
        this.scene.add(new THREE.HemisphereLight(0xdfeaff, 0x2a3350, 1.7));
        const key = new THREE.DirectionalLight(0xfff2dd, 2.4);
        key.position.set(2.5, 4, 4);
        this.scene.add(key);
        this.rim = new THREE.DirectionalLight(RIM[1], 2.2);
        this.rim.position.set(-3, 2, -3);
        this.scene.add(this.rim);

        this.rock = new THREE.Mesh(
            new THREE.CylinderGeometry(0.62, 1.02, 0.52, 7),
            new THREE.MeshLambertMaterial({ color: ROCK[1], flatShading: true })
        );
        this.rock.position.y = -0.27;
        this.scene.add(this.rock);

        this.model = E.makePlayer();
        this.scene.add(this.model);
        this.pose = { x: 0, y: 0, vx: 0, vy: 0, facing: 1, dashes: 1, dashDir: { x: 1, y: 0 }, squash: 1, onGround: true, climbing: 0, iframes: 0, dead: false };
        this.t = 0;
        this.width = 0;
        this.height = 0;
    }

    setChapter(chapter) {
        this.rim.color.setHex(RIM[chapter] || RIM[1]);
        this.rock.material.color.setHex(ROCK[chapter] || ROCK[1]);
    }

    resize() {
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        if (!w || !h || (w === this.width && h === this.height)) return;
        this.width = w;
        this.height = h;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    update(dt) {
        this.resize();
        this.t += dt;
        E.animatePlayer(this.model, this.pose, 'idle', dt, this.t);
        this.model.rotation.y = -0.55 + Math.sin(this.t * 0.45) * 0.28;
        this.renderer.render(this.scene, this.camera);
    }
}
