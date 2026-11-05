import * as THREE from '../lib/three.module.js';
import { Settings } from './core.js';
import { LAYER, sprite } from './ink.js';
import { buildBackdrop, buildTerrain, themeOf, useLevelTextures } from './backdrops.js';

const CAMERA_DIST = 17;
const MAX_PARTICLES = 700;
const WEATHER_COUNT = 170;
const SLASH_POOL = 6;

const WEATHER = {
    snow: { color: 0xffffff, vx: -0.9, vy: -1.5, size: 0.17, kind: 'soft' },
    rain: { color: 0xb6d2ff, vx: -5, vy: -24, size: 0.34, kind: 'streak' },
    dust: { color: 0xfff0d0, vx: 0.5, vy: 0.2, size: 0.09, kind: 'soft' },
    sparkle: { color: 0x9fe6ff, vx: 0, vy: 0.5, size: 0.13, kind: 'soft' },
    embers: { color: 0xffa050, vx: 0.6, vy: 2.2, size: 0.13, kind: 'soft' }
};

function pointSprite(kind) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    if (kind === 'streak') {
        const g = ctx.createLinearGradient(0, 0, 0, 32);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, 'rgba(255,255,255,0.9)');
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(16, 16);
        ctx.rotate(0.2);
        ctx.fillRect(-0.8, -15, 1.6, 30);
        ctx.restore();
    } else {
        const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 16);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 32, 32);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function disposeTree(object) {
    object.traverse(node => {
        if (!node.userData.owned) return;
        if (node.material.map && !node.material.map.userData.memo) node.material.map.dispose();
        node.geometry.dispose();
        node.material.dispose();
    });
}

export class View {
    constructor(canvas) {
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.autoClear = true;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
        this.camPos = new THREE.Vector2();
        this.shake = 0;
        this.dist = CAMERA_DIST;
        this.targetDist = CAMERA_DIST;
        this.bounds = null;
        this.flashAmount = 0;
        this.popTimer = 0;
        this.idleT = 0;
        this.dim = 1;
        this.dimTarget = 1;
        this.time = 0;
        this.storm = 0;
        this.root = new THREE.Group();
        this.scene.add(this.root);
        this.sprites = { soft: pointSprite('soft'), streak: pointSprite('streak') };
        this.setupParticles();
        this.setupSky();
        this.setupPost();
        this.setupSlashes();
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
            size: 0.24, map: this.sprites.soft, vertexColors: true, transparent: true, depthWrite: false, depthTest: false, fog: false,
            blending: THREE.AdditiveBlending
        }));
        this.points.frustumCulled = false;
        this.points.renderOrder = LAYER.fx + 5;
        this.scene.add(this.points);

        const wg = new THREE.BufferGeometry();
        this.wPos = new Float32Array(WEATHER_COUNT * 3);
        wg.setAttribute('position', new THREE.BufferAttribute(this.wPos, 3));
        this.weatherPoints = new THREE.Points(wg, new THREE.PointsMaterial({
            size: 0.1, map: this.sprites.soft, transparent: true, opacity: 0.8, depthWrite: false, depthTest: false, fog: false
        }));
        this.weatherPoints.frustumCulled = false;
        this.weatherPoints.renderOrder = LAYER.fx + 4;
        this.scene.add(this.weatherPoints);
    }

    setupSky() {
        this.skyMaterial = new THREE.ShaderMaterial({
            depthWrite: false,
            depthTest: false,
            fog: false,
            uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, flash: { value: 0 } },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
            fragmentShader: 'uniform vec3 top; uniform vec3 bottom; uniform float flash; varying vec2 vUv; void main(){ vec3 c = mix(bottom, top, smoothstep(0.0, 1.0, vUv.y)); gl_FragColor = vec4(c + flash * vec3(0.55, 0.6, 0.75), 1.0);\n#include <colorspace_fragment>\n}'
        });
        this.sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.skyMaterial);
        this.sky.frustumCulled = false;
        this.sky.renderOrder = LAYER.sky;
        this.scene.add(this.sky);
    }

    setupPost() {
        this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
        this.postScene = new THREE.Scene();
        this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.postMat = new THREE.ShaderMaterial({
            depthWrite: false,
            depthTest: false,
            uniforms: {
                tex: { value: this.rt.texture }, dim: { value: 1 }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) },
                shade: { value: new THREE.Color(0x101428) }, light: { value: new THREE.Color(0xffffff) }, warmth: { value: 0 }
            },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
            fragmentShader: `uniform sampler2D tex; uniform float dim; uniform float time; uniform vec2 res; uniform vec3 shade; uniform vec3 light; varying vec2 vUv;
                float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
                float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
                void main(){
                    vec4 c = texture2D(tex, vUv);
                    float lum = dot(c.rgb, vec3(0.3, 0.59, 0.11));
                    c.rgb = mix(c.rgb, c.rgb * light + shade * (1.0 - lum) * 0.05, 0.8);
                    vec2 q = vUv - 0.5;
                    float vig = 1.0 - smoothstep(0.32, 0.85, length(q * vec2(1.0, 0.86)));
                    c.rgb *= mix(0.52, 1.0, vig);
                    float paper = noise(vUv * res * 0.42) * 0.55 + noise(vUv * res * 0.11 + 9.0) * 0.45;
                    float grain = hash(floor(vUv * res * 0.75) + floor(time * 9.0));
                    c.rgb *= 0.965 + paper * 0.05 + (grain - 0.5) * 0.022;
                    c.rgb *= dim;
                    gl_FragColor = vec4(c.rgb, 1.0);
                    #include <colorspace_fragment>
                }`
        });
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
        quad.frustumCulled = false;
        this.postScene.add(quad);
    }

    setupSlashes() {
        this.slashes = Array.from({ length: SLASH_POOL }, () => {
            const m = sprite('impactSlash', 2.4, 1.1, ctx => {
                const g = ctx.createLinearGradient(-1.2, 0, 1.2, 0);
                g.addColorStop(0, 'rgba(255,255,255,0)');
                g.addColorStop(0.75, 'rgba(255,255,255,1)');
                g.addColorStop(1, 'rgba(255,255,255,0.4)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.moveTo(-1.15, -0.2);
                ctx.quadraticCurveTo(0.1, 0.42, 1.15, 0.14);
                ctx.quadraticCurveTo(0.2, 0.15, -1.15, -0.2);
                ctx.fill();
            }, { ppu: 70, additive: true, own: true, layer: LAYER.fx + 6, opacity: 0 });
            m.visible = false;
            m.userData.life = 0;
            this.scene.add(m);
            return m;
        });
        this.slashIndex = 0;
    }

    slash(x, y, rotation = 0, color = 0xffffff, size = 1) {
        const m = this.slashes[this.slashIndex++ % SLASH_POOL];
        m.visible = true;
        m.position.set(x, y, 0.6);
        m.rotation.z = rotation;
        m.scale.set(size, size, 1);
        m.material.color.setHex(color);
        m.userData.life = 0.2;
    }

    resize() {
        const w = innerWidth;
        const h = innerHeight;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        const pr = this.renderer.getPixelRatio();
        this.rt.setSize(Math.floor(w * pr), Math.floor(h * pr));
        this.postMat.uniforms.res.value.set(w * pr, h * pr);
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
        this.dim = 1;
        this.dimTarget = 1;
        const theme = themeOf(level);
        this.theme = theme;
        this.skyMaterial.uniforms.top.value.set(theme.sky[0]);
        this.skyMaterial.uniforms.bottom.value.set(theme.sky[1]);
        this.postMat.uniforms.shade.value.set(theme.sky[0]);
        this.postMat.uniforms.light.value.set(level.chapter === 3 ? 0xfff0e2 : level.chapter === 2 ? 0xe6edff : 0xfdf8ee);
        useLevelTextures(level.name);
        this.env = buildBackdrop(this.root, level);
        this.applyQuality();
        this.dress = buildTerrain(this.root, level);
        this.setupWeather(level);
    }

    restoreGrade() {
        if (this.theme) this.postMat.uniforms.shade.value.set(this.theme.sky[0]);
    }

    applyQuality() {
        if (this.env) this.env.optional.forEach(m => { m.visible = Settings.shadows; });
    }

    setupWeather(level) {
        const w = WEATHER[level.weather] || WEATHER.dust;
        this.weather = w;
        this.weatherPoints.material.color.setHex(w.color);
        this.weatherPoints.material.size = w.size;
        this.weatherPoints.material.map = this.sprites[w.kind];
        this.weatherPoints.material.needsUpdate = true;
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
            p.life = life * (0.6 + Math.random() * 0.4); p.max = life;
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
            p.vx *= 1 - dt * 2.2;
            p.vy = p.vy * (1 - dt * 1.4) - 5 * dt;
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
        for (const m of this.slashes) {
            if (!m.visible) continue;
            m.userData.life -= dt;
            m.material.opacity = Math.max(0, m.userData.life / 0.2);
            m.scale.x += dt * 5;
            if (m.userData.life <= 0) m.visible = false;
        }
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

    setDim(amount) {
        this.dimTarget = amount;
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
        this.time += dt;
        const t = this.time;
        const env = this.env;
        this.flashAmount = Math.max(0, this.flashAmount - dt * 3);
        if (env) {
            env.fogs.forEach(f => { if (f.tex) f.tex.offset.x = (t * f.speed) % 1; });
            env.rays.forEach(r => { r.material.opacity = 0.26 + Math.sin(t * 0.5) * 0.08; });
            env.pulses.forEach(p => { p.m.material.opacity = p.base + Math.sin(t * 1.3 + p.p) * p.base * 0.7; });
            if (env.lightning) {
                this.storm -= dt;
                if (this.storm <= 0) {
                    this.storm = 2.5 + Math.random() * 6;
                    this.flash(0.22 + Math.random() * 0.2);
                }
            }
        }
        if (this.dress) this.dress.uniforms.time.value = t;
        this.skyMaterial.uniforms.flash.value = this.flashAmount;
        this.dim += (this.dimTarget - this.dim) * Math.min(1, dt * 1.5);
        this.postMat.uniforms.dim.value = this.dim * (1 + this.flashAmount * 0.5);
        this.postMat.uniforms.time.value = t;
    }

    idle(dt) {
        this.idleT += dt * 0.5;
        const g = this.level.grid;
        const span = Math.max(1, g.w - 40);
        const x = 20 + ((Math.sin(this.idleT * 0.05) + 1) / 2) * span;
        this.follow(x, 6, dt, false);
        this.updateParticles(dt);
    }

    present(scene, camera) {
        if (Settings.shadows) {
            this.renderer.setRenderTarget(this.rt);
            this.renderer.render(scene, camera);
            this.renderer.setRenderTarget(null);
            this.renderer.render(this.postScene, this.postCam);
        } else {
            this.renderer.setRenderTarget(null);
            this.renderer.render(scene, camera);
        }
    }

    render() {
        this.present(this.scene, this.camera);
    }
}
