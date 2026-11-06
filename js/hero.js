import * as THREE from '../lib/three.module.js';
import * as E from './entities.js';
import { INK, LAYER, sprite } from './ink.js';

const ROCK = { 1: '#566278', 2: '#3f4a6b', 3: '#553732' };

const rockDraw = color => ctx => {
    ctx.fillStyle = color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.022;
    ctx.beginPath();
    ctx.moveTo(-1.1, -0.72);
    ctx.lineTo(-0.82, -0.18);
    ctx.lineTo(-0.45, 0);
    ctx.lineTo(0.4, 0);
    ctx.lineTo(0.84, -0.2);
    ctx.lineTo(1.14, -0.72);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-0.45, 0);
    ctx.lineTo(-0.2, -0.38);
    ctx.lineTo(-0.3, -0.72);
    ctx.moveTo(0.4, 0);
    ctx.lineTo(0.5, -0.32);
    ctx.lineTo(0.28, -0.56);
    ctx.lineWidth = 0.014;
    ctx.stroke();
};

export class HeroStage {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
        this.camera.position.set(0, 0.5, 5.2);
        this.camera.lookAt(0, 0.5, 0);
        this.rocks = {};
        for (const ch of [1, 2, 3]) {
            const rock = sprite(`heroRock${ch}`, 2.4, 0.8, rockDraw(ROCK[ch]), { ay: 0.95, ppu: 170, layer: LAYER.back });
            rock.visible = ch === 1;
            this.scene.add(rock);
            this.rocks[ch] = rock;
        }
        this.model = E.makePlayer();
        this.model.userData.halo.scale.setScalar(0.001);
        this.yaw = 0;
        this.spinV = 0;
        this.dragX = null;
        canvas.tabIndex = 0;
        canvas.setAttribute('role', 'img');
        canvas.addEventListener('pointerdown', e => {
            this.dragX = e.clientX;
            this.spinV = 0;
            canvas.setPointerCapture(e.pointerId);
            canvas.classList.add('dragging');
        });
        canvas.addEventListener('pointermove', e => {
            if (this.dragX === null) return;
            const dx = e.clientX - this.dragX;
            this.dragX = e.clientX;
            this.yaw += dx * 0.012;
            this.spinV = dx * 0.012 * 60;
        });
        const release = () => {
            this.dragX = null;
            canvas.classList.remove('dragging');
        };
        canvas.addEventListener('pointerup', release);
        canvas.addEventListener('pointercancel', release);
        canvas.addEventListener('keydown', e => {
            if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
            e.preventDefault();
            e.stopPropagation();
            this.spinV += e.code === 'ArrowLeft' ? -5 : 5;
        });
        this.scene.add(this.model);
        this.pose = { x: 0, y: 0, vx: 0, vy: 0, facing: 1, dashes: 1, dashDir: { x: 1, y: 0 }, squash: 1, onGround: true, climbing: 0, iframes: 0, dead: false };
        this.t = 0;
        this.width = 0;
        this.height = 0;
    }

    frame(close) {
        if (close) this.camera.position.set(0, 0.78, 3.7);
        else this.camera.position.set(0, 0.5, 5.2);
        this.camera.lookAt(0, close ? 0.62 : 0.5, 0);
        if (!close) {
            this.yaw = 0;
            this.spinV = 0;
        }
    }

    setSkin(id) {
        E.setPlayerSkin(this.model, id);
    }

    setChapter(chapter) {
        for (const ch of [1, 2, 3]) this.rocks[ch].visible = ch === (this.rocks[chapter] ? chapter : 1);
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
        if (this.dragX === null) {
            this.yaw += this.spinV * dt;
            this.spinV *= Math.pow(0.04, dt);
        }
        this.model.rotation.y = this.yaw;
        E.animatePlayer(this.model, this.pose, 'idle', dt, this.t);
        this.renderer.render(this.scene, this.camera);
    }
}
