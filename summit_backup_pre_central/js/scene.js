import * as THREE from '../lib/three.module.js';
import { Settings } from './core.js';

const CAMERA_DIST = 17;
const MAX_PARTICLES = 700;
const WEATHER_COUNT = 160;
const SHADOW_SPAN = 26;
const SOLID_CELLS = new Set(['#']);

const WEATHER = {
    snow: { color: 0xffffff, vx: -0.8, vy: -1.4, size: 0.12 },
    rain: { color: 0xa8c8ff, vx: -5, vy: -22, size: 0.08 },
    dust: { color: 0xfff0d0, vx: 0.5, vy: 0.2, size: 0.07 },
    sparkle: { color: 0xd9c8ff, vx: 0, vy: 0.5, size: 0.09 },
    embers: { color: 0xffa050, vx: 0.6, vy: 2.2, size: 0.1 }
};

function seededRandom(seed) {
    let s = seed >>> 0 || 1;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function roundSprite() {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
}

function disposeTree(object) {
    object.traverse(node => {
        if (node.userData.owned) {
            node.geometry.dispose();
            node.material.dispose();
            if (node.dispose) node.dispose();
        }
    });
}

export class View {
    constructor(canvas) {
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.shadowMap.enabled = Settings.shadows;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 260);
        this.camPos = new THREE.Vector2();
        this.shake = 0;
        this.dist = CAMERA_DIST;
        this.targetDist = CAMERA_DIST;
        this.bounds = null;
        this.flashAmount = 0;
        this.popTimer = 0;
        this.idleT = 0;
        this.root = new THREE.Group();
        this.scene.add(this.root);
        this.hemi = new THREE.HemisphereLight(0xffffff, 0x445066, 1.5);
        this.scene.add(this.hemi);
        this.sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(1536, 1536);
        this.sun.shadow.bias = -0.0015;
        const sc = this.sun.shadow.camera;
        sc.left = sc.bottom = -SHADOW_SPAN;
        sc.right = sc.top = SHADOW_SPAN;
        sc.near = 1;
        sc.far = 90;
        this.scene.add(this.sun, this.sun.target);
        this.sprite = roundSprite();
        this.setupParticles();
        this.setupSky();
        this.flashEl = document.getElementById('screen-flash');
        this.resize();
        addEventListener('resize', () => this.resize());
    }

    setupParticles() {
        this.pPos = new Float32Array(MAX_PARTICLES * 3).fill(-9999);
        this.pCol = new Float32Array(MAX_PARTICLES * 3);
        this.pool = Array.from({ length: MAX_PARTICLES }, () => ({ life: 0 }));
        this.poolHead = 0;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
        this.pointGeo = geometry;
        this.points = new THREE.Points(geometry, new THREE.PointsMaterial({
            size: 0.3, map: this.sprite, vertexColors: true, transparent: true, depthWrite: false, fog: false,
            blending: THREE.AdditiveBlending
        }));
        this.points.frustumCulled = false;
        this.scene.add(this.points);

        const wg = new THREE.BufferGeometry();
        this.wPos = new Float32Array(WEATHER_COUNT * 3);
        wg.setAttribute('position', new THREE.BufferAttribute(this.wPos, 3));
        this.weatherPoints = new THREE.Points(wg, new THREE.PointsMaterial({
            size: 0.1, map: this.sprite, transparent: true, opacity: 0.7, depthWrite: false, fog: false
        }));
        this.weatherPoints.frustumCulled = false;
        this.scene.add(this.weatherPoints);
    }

    setupSky() {
        this.skyMaterial = new THREE.ShaderMaterial({
            depthWrite: false,
            fog: false,
            uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, flash: { value: 0 } },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
            fragmentShader: 'uniform vec3 top; uniform vec3 bottom; uniform float flash; varying vec2 vUv; void main(){ vec3 c = mix(bottom, top, smoothstep(0.0, 1.0, vUv.y)); gl_FragColor = vec4(c + flash * vec3(0.55, 0.6, 0.75), 1.0);\n#include <colorspace_fragment>\n}'
        });
        this.sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.skyMaterial);
        this.sky.frustumCulled = false;
        this.sky.renderOrder = -10;
        this.scene.add(this.sky);
    }

    resize() {
        const w = innerWidth;
        const h = innerHeight;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    clear() {
        disposeTree(this.root);
        this.root.clear();
        this.pool.forEach(p => { p.life = 0; });
    }

    owned(mesh) {
        mesh.userData.owned = true;
        return mesh;
    }

    build(level) {
        this.clear();
        this.level = level;
        this.bounds = null;
        this.targetDist = CAMERA_DIST;
        const base = new THREE.Color(level.color);
        const chapterDark = level.chapter === 1 ? 0.62 : level.chapter === 2 ? 0.32 : 0.22;
        const fogColor = base.clone().multiplyScalar(chapterDark);
        this.skyMaterial.uniforms.top.value.copy(base).multiplyScalar(chapterDark * 0.65);
        this.skyMaterial.uniforms.bottom.value.copy(base).multiplyScalar(chapterDark * 1.35).lerp(new THREE.Color(0xffffff), 0.08);
        this.scene.fog = new THREE.Fog(fogColor, 26, 110);
        this.hemi.intensity = level.chapter === 1 ? 1.5 : level.chapter === 2 ? 1.15 : 1.0;
        this.sun.intensity = level.chapter === 1 ? 2.4 : level.chapter === 2 ? 1.5 : 1.7;
        this.sun.color.setHex(level.chapter === 3 ? 0xffb080 : level.chapter === 2 ? 0xbcd2ff : 0xfff4e0);
        this.renderer.shadowMap.enabled = Settings.shadows;
        this.sun.castShadow = Settings.shadows;
        this.buildTerrain(level);
        this.addBackground(level);
        this.setupWeather(level);
    }

    buildTerrain(level) {
        const g = level.grid;
        const solids = [];
        for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (SOLID_CELLS.has(g.cells[y][x])) solids.push([x, y]);
        const isSolid = (x, y) => y >= 0 && y < g.h && x >= 0 && x < g.w && SOLID_CELLS.has(g.cells[y][x]);
        const base = new THREE.Color(level.color);
        const rock = base.clone().multiplyScalar(level.chapter === 1 ? 0.55 : 0.38);
        const rand = seededRandom(g.w * 131 + g.h);
        const mesh = this.owned(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 2), new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, solids.length)));
        mesh.castShadow = mesh.receiveShadow = true;
        const caps = solids.filter(([x, y]) => !isSolid(x, y + 1));
        const capMesh = this.owned(new THREE.InstancedMesh(new THREE.BoxGeometry(1.02, 0.24, 2.12), new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, caps.length)));
        capMesh.receiveShadow = true;
        const m = new THREE.Matrix4();
        const c = new THREE.Color();
        solids.forEach(([x, y], i) => {
            m.makeTranslation(x + 0.5, y + 0.5, 0);
            mesh.setMatrixAt(i, m);
            const depth = isSolid(x, y + 1) ? 0.72 + ((x * 7 + y * 13) % 5) * 0.05 : 1.05;
            c.copy(rock).multiplyScalar(depth + (rand() - 0.5) * 0.08);
            mesh.setColorAt(i, c);
        });
        const capColor = level.chapter === 1 ? base.clone().lerp(new THREE.Color(0xffffff), 0.55)
            : level.chapter === 2 ? base.clone().lerp(new THREE.Color(0xcfe0ff), 0.3)
                : new THREE.Color(0x4c2a26);
        caps.forEach(([x, y], i) => {
            m.makeTranslation(x + 0.5, y + 0.9, 0);
            capMesh.setMatrixAt(i, m);
            c.copy(capColor).multiplyScalar(0.92 + rand() * 0.16);
            capMesh.setColorAt(i, c);
        });
        this.root.add(mesh, capMesh);

        const decor = caps.filter(() => rand() < 0.28);
        const tuft = this.owned(new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 0.34, 4), new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, decor.length)));
        const decorColor = level.chapter === 3 ? new THREE.Color(0xff7a3c) : capColor.clone().multiplyScalar(0.8);
        decor.forEach(([x, y], i) => {
            m.makeTranslation(x + rand(), y + 1.15, -0.5 - rand() * 0.45);
            tuft.setMatrixAt(i, m);
            tuft.setColorAt(i, decorColor);
        });
        this.root.add(tuft);
    }

    addBackground(level) {
        const g = level.grid;
        const col = new THREE.Color(level.color);
        const rand = seededRandom(g.w * 17 + g.h * 3);
        const dark = level.chapter === 1 ? 0.55 : 0.28;
        for (let layer = 0; layer < 3; layer++) {
            const count = 12 + layer * 5;
            const span = g.w + 120;
            const mesh = this.owned(new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 4), new THREE.MeshLambertMaterial({ color: col.clone().multiplyScalar(dark * (0.75 + layer * 0.2)) }), count));
            const m = new THREE.Matrix4();
            const q = new THREE.Quaternion();
            const up = new THREE.Vector3(0, 1, 0);
            const scale = new THREE.Vector3();
            const pos = new THREE.Vector3();
            for (let i = 0; i < count; i++) {
                const h = 12 + rand() * 18 + layer * 6 + g.h * 0.25;
                const r = 6 + rand() * 8 + layer * 2;
                pos.set(-60 + (i / count) * span + rand() * 6, h / 2 - 5, -14 - layer * 15);
                q.setFromAxisAngle(up, rand() * 3);
                scale.set(r, h, r);
                m.compose(pos, q, scale);
                mesh.setMatrixAt(i, m);
            }
            mesh.frustumCulled = false;
            mesh.userData.layer = layer;
            this.root.add(mesh);
        }
        const clouds = this.owned(new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: col.clone().lerp(new THREE.Color(level.chapter === 3 ? 0x301010 : 0xffffff), 0.5), transparent: true, opacity: 0.16, depthWrite: false }), 16));
        const m2 = new THREE.Matrix4();
        for (let i = 0; i < 16; i++) {
            m2.makeScale(18 + rand() * 22, 1.2 + rand() * 1.6, 2);
            m2.setPosition(rand() * (g.w + 40) - 20, g.h * 0.4 + rand() * g.h * 0.8, -34 - rand() * 8);
            clouds.setMatrixAt(i, m2);
        }
        clouds.frustumCulled = false;
        clouds.userData.layer = 0;
        this.root.add(clouds);
    }

    setupWeather(level) {
        const w = WEATHER[level.weather] || WEATHER.dust;
        this.weather = w;
        this.weatherPoints.material.color.setHex(w.color);
        this.weatherPoints.material.size = w.size;
        for (let i = 0; i < WEATHER_COUNT; i++) {
            this.wPos[i * 3] = Math.random() * 44;
            this.wPos[i * 3 + 1] = Math.random() * 30;
            this.wPos[i * 3 + 2] = -3 + Math.random() * 7;
        }
    }

    emit(x, y, color, n = 8, speed = 4, life = 0.5) {
        const r = ((color >> 16) & 255) / 255;
        const g = ((color >> 8) & 255) / 255;
        const b = (color & 255) / 255;
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * speed;
            const p = this.pool[this.poolHead];
            this.poolHead = (this.poolHead + 1) % MAX_PARTICLES;
            p.x = x; p.y = y; p.z = 0.9;
            p.vx = Math.cos(a) * s;
            p.vy = Math.sin(a) * s;
            p.life = life; p.max = life;
            p.r = r; p.g = g; p.b = b;
        }
    }

    updateParticles(dt) {
        for (let i = 0; i < MAX_PARTICLES; i++) {
            const p = this.pool[i];
            const j = i * 3;
            if (p.life <= 0) {
                this.pPos[j + 1] = -9999;
                continue;
            }
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy -= 6 * dt;
            const f = Math.max(0, p.life / p.max);
            this.pPos[j] = p.x;
            this.pPos[j + 1] = p.y;
            this.pPos[j + 2] = p.z;
            this.pCol[j] = p.r * f;
            this.pCol[j + 1] = p.g * f;
            this.pCol[j + 2] = p.b * f;
        }
        this.pointGeo.attributes.position.needsUpdate = true;
        this.pointGeo.attributes.color.needsUpdate = true;
        this.updateWeather(dt);
    }

    updateWeather(dt) {
        const w = this.weather;
        if (!w) return;
        const x0 = this.camPos.x - 22;
        const y0 = this.camPos.y - 15;
        for (let i = 0; i < WEATHER_COUNT; i++) {
            const j = i * 3;
            let x = this.wPos[j] + w.vx * dt + Math.sin(i + this.idleT) * dt * 0.3;
            let y = this.wPos[j + 1] + w.vy * dt;
            if (x < x0) x += 44;
            if (x > x0 + 44) x -= 44;
            if (y < y0) y += 30;
            if (y > y0 + 30) y -= 30;
            this.wPos[j] = x;
            this.wPos[j + 1] = y;
        }
        this.weatherPoints.geometry.attributes.position.needsUpdate = true;
        this.idleT += dt;
    }

    setBounds(bounds) {
        this.bounds = bounds;
        this.targetDist = bounds ? bounds.dist : CAMERA_DIST;
    }

    flash(amount) {
        this.flashAmount = Math.max(this.flashAmount, amount);
    }

    damageFlash() {
        if (!this.flashEl) return;
        this.flashEl.classList.remove('on');
        void this.flashEl.offsetWidth;
        this.flashEl.classList.add('on');
    }

    spawnPop() {
        this.popTimer = 0.25;
    }

    follow(tx, ty, dt, snap, free = false) {
        const g = this.level.grid;
        this.dist += (this.targetDist - this.dist) * (snap ? 1 : Math.min(1, dt * 2.5));
        const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * this.dist;
        const halfW = halfH * this.camera.aspect;
        const b = this.bounds;
        const minX = b ? b.x1 : 0;
        const maxX = b ? b.x2 : g.w;
        const minY = b ? b.y1 : 0;
        const maxY = b ? b.y2 : g.h;
        const clampTo = (v, lo, hi, half) => (hi - lo <= half * 2 ? (lo + hi) / 2 : Math.max(lo + half, Math.min(hi - half, v)));
        const cx = clampTo(tx, minX, maxX, halfW);
        const cy = free ? ty : clampTo(ty + 1, minY, maxY, halfH);
        const k = snap ? 1 : 1 - Math.exp(-dt * (b ? 3.5 : 6));
        this.camPos.x += (cx - this.camPos.x) * k;
        this.camPos.y += (cy - this.camPos.y) * k;
        this.shake = Math.max(0, this.shake - dt * 2.5);
        const amount = Settings.shake ? this.shake : this.shake * 0.15;
        const sx = (Math.random() - 0.5) * amount;
        const sy = (Math.random() - 0.5) * amount;
        this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.dist);
        this.camera.lookAt(this.camPos.x + sx, this.camPos.y + sy, 0);
        this.applyEnvironment(dt);
    }

    applyEnvironment(dt) {
        for (const c of this.root.children) {
            if (c.userData.layer !== undefined) c.position.x = this.camPos.x * (0.2 + c.userData.layer * 0.22);
        }
        this.sun.position.set(this.camPos.x - 10, this.camPos.y + 22, 28);
        this.sun.target.position.set(this.camPos.x, this.camPos.y, 0);
        this.flashAmount = Math.max(0, this.flashAmount - dt * 3);
        this.skyMaterial.uniforms.flash.value = this.flashAmount;
        const base = this.level.chapter === 1 ? 1.5 : this.level.chapter === 2 ? 1.15 : 1.0;
        this.hemi.intensity = base + this.flashAmount * 2.2;
    }

    idle(dt) {
        this.idleT += dt * 0.5;
        const g = this.level.grid;
        const span = Math.max(1, g.w - 40);
        const x = 20 + ((Math.sin(this.idleT * 0.05) + 1) / 2) * span;
        this.follow(x, 6, dt, false);
        this.updateParticles(dt);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
