import * as THREE from '../lib/three.module.js';

export class View {
    constructor(canvas) {
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
        this.camPos = new THREE.Vector2();
        this.shake = 0;
        this.dist = 17;
        this.root = new THREE.Group();
        this.scene.add(this.root);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
        const sun = new THREE.DirectionalLight(0xffffff, 0.9);
        sun.position.set(-6, 12, 14);
        this.scene.add(sun);
        this.maxParticles = 600;
        this.particles = [];
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.maxParticles * 3), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.maxParticles * 3), 3));
        this.pointGeo = geo;
        this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, depthWrite: false, fog: false }));
        this.points.frustumCulled = false;
        this.scene.add(this.points);
        this.resize();
        addEventListener('resize', () => this.resize());
    }

    resize() {
        const w = innerWidth;
        const h = innerHeight;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    clear() {
        while (this.root.children.length) {
            const c = this.root.children[0];
            this.root.remove(c);
        }
        this.particles.length = 0;
    }

    build(level) {
        this.clear();
        const g = level.grid;
        this.level = level;
        this.scene.background = new THREE.Color(level.color).multiplyScalar(0.55);
        this.scene.fog = new THREE.Fog(new THREE.Color(level.color).multiplyScalar(0.55), 30, 90);
        const solids = [];
        for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.cells[y][x] === '#') solids.push([x, y]);
        const base = new THREE.Color(level.color);
        const mesh = new THREE.InstancedMesh(
            new THREE.BoxGeometry(1, 1, 2),
            new THREE.MeshLambertMaterial({ color: 0xffffff }),
            Math.max(1, solids.length)
        );
        const m = new THREE.Matrix4();
        solids.forEach(([x, y], i) => {
            m.setPosition(x + 0.5, y + 0.5, 0);
            mesh.setMatrixAt(i, m);
            const exposed = y + 1 >= g.h || g.cells[y + 1][x] !== '#';
            const c = base.clone().multiplyScalar(exposed ? 0.95 : 0.5 + ((x * 7 + y * 13) % 5) * 0.03);
            if (exposed) c.lerp(new THREE.Color(0xffffff), 0.35);
            mesh.setColorAt(i, c);
        });
        this.root.add(mesh);
        this.addBackground(level);
    }

    addBackground(level) {
        const g = level.grid;
        const col = new THREE.Color(level.color);
        for (let layer = 0; layer < 3; layer++) {
            const group = new THREE.Group();
            const z = -12 - layer * 14;
            const count = 10 + layer * 4;
            for (let i = 0; i < count; i++) {
                const h = 8 + Math.random() * 14 + layer * 4;
                const cone = new THREE.Mesh(
                    new THREE.ConeGeometry(5 + Math.random() * 6, h, 4),
                    new THREE.MeshLambertMaterial({ color: col.clone().multiplyScalar(0.45 + layer * 0.12) })
                );
                cone.position.set(-20 + (i / count) * (g.w + 60), h / 2 - 4 + g.h * 0.12 * layer, z);
                cone.rotation.y = Math.random() * 3;
                group.add(cone);
            }
            group.userData.layer = layer;
            this.root.add(group);
        }
    }

    emit(x, y, color, n = 8, speed = 4, life = 0.5) {
        const c = new THREE.Color(color);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * speed;
            this.particles.push({ x, y, z: 0.9, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, c });
        }
        if (this.particles.length > this.maxParticles) this.particles.splice(0, this.particles.length - this.maxParticles);
    }

    updateParticles(dt) {
        const pos = this.pointGeo.attributes.position;
        const col = this.pointGeo.attributes.color;
        this.particles = this.particles.filter(p => (p.life -= dt) > 0);
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            if (p) {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy -= 6 * dt;
                const f = p.life / p.max;
                pos.setXYZ(i, p.x, p.y, p.z);
                col.setXYZ(i, p.c.r * f, p.c.g * f, p.c.b * f);
            } else {
                pos.setXYZ(i, 0, -999, 0);
            }
        }
        pos.needsUpdate = true;
        col.needsUpdate = true;
    }

    follow(tx, ty, dt, snap) {
        const g = this.level.grid;
        const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * this.dist;
        const halfW = halfH * this.camera.aspect;
        const cx = Math.min(Math.max(tx, halfW), Math.max(halfW, g.w - halfW));
        const cy = Math.min(Math.max(ty + 1, halfH), Math.max(halfH, g.h - halfH));
        const k = snap ? 1 : 1 - Math.exp(-dt * 6);
        this.camPos.x += (cx - this.camPos.x) * k;
        this.camPos.y += (cy - this.camPos.y) * k;
        this.shake = Math.max(0, this.shake - dt * 2.5);
        const sx = (Math.random() - 0.5) * this.shake;
        const sy = (Math.random() - 0.5) * this.shake;
        this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.dist);
        this.camera.lookAt(this.camPos.x + sx, this.camPos.y + sy, 0);
        this.root.children.forEach(c => {
            if (c.userData.layer !== undefined) c.position.x = this.camPos.x * (0.15 + c.userData.layer * 0.12) * -1 + this.camPos.x * 0.35;
        });
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}
