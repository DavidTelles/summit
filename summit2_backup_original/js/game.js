import { LEVELS } from './levels.js';
import { Input, Sfx, ACHIEVEMENTS, Save, SKILLS } from './core.js';
import * as E from './entities.js';
import * as THREE from '../lib/three.module.js';

const RUN = 9;
const GRAVITY = 32;
const JUMP = 15;
const MAX_FALL = 18;
const DASH_SPEED = 20;
const DASH_TIME = 0.16;
const STAMINA_MAX = 6;
const PW = 0.7;
const PH = 0.9;

export class Game {
    constructor(view, hooks) {
        this.view = view;
        this.hooks = hooks;
        this.levelIndex = 0;
        this.running = false;
    }

    load(index) {
        this.levelIndex = index;
        const level = LEVELS[index];
        this.level = level;
        this.grid = level.grid;
        this.view.build(level);
        this.time = 0;
        this.clock = 0;
        this.freeze = 0;
        this.levelDeaths = 0;
        this.levelBerries = 0;
        this.finished = false;
        this.berries = [];
        this.crystals = [];
        this.springs = [];
        this.enemies = [];
        this.flags = [];
        this.crumbles = [];
        this.spikes = [];
        this.goal = null;
        this.totalBerries = 0;
        this.boss = null;
        this.bossDefeated = false;
        this.bossDamageTaken = false;
        this.permadeathPending = false;
        let start = { x: 2, y: 2 };
        const root = this.view.root;
        for (let y = 0; y < this.grid.h; y++) {
            for (let x = 0; x < this.grid.w; x++) {
                const c = this.grid.cells[y][x];
                if (c === 'P') start = { x: x + 0.5, y };
                if (c === 'S') {
                    const mesh = E.makeBerry();
                    mesh.position.set(x + 0.5, y + 0.5, 0);
                    root.add(mesh);
                    this.berries.push({ x: x + 0.5, y: y + 0.5, got: false, mesh });
                    this.totalBerries++;
                }
                if (c === 'C') {
                    const mesh = E.makeCrystal();
                    mesh.position.set(x + 0.5, y + 0.5, 0);
                    root.add(mesh);
                    this.crystals.push({ x: x + 0.5, y: y + 0.5, cool: 0, mesh });
                }
                if (c === 'B') {
                    const mesh = E.makeSpring();
                    mesh.position.set(x + 0.5, y, 0);
                    root.add(mesh);
                    this.springs.push({ x: x + 0.5, y, anim: 0, mesh });
                }
                if (c === '^') {
                    const mesh = E.makeSpikes();
                    mesh.position.set(x, y, 0);
                    root.add(mesh);
                    this.spikes.push({ x, y });
                }
                if (c === 'E' || c === 'F') {
                    const mesh = c === 'E' ? E.makeWalker() : E.makeFlyer();
                    root.add(mesh);
                    this.enemies.push({ type: c, x: x + 0.5, y, ox: x + 0.5, oy: y, dir: -1, alive: true, mesh, phase: Math.random() * 6, w: 0.8, h: 0.8 });
                }
                if (c === 'K') {
                    const mesh = E.makeFlag();
                    mesh.position.set(x + 0.5, y, -0.3);
                    root.add(mesh);
                    this.flags.push({ x: x + 0.5, y, active: false, mesh });
                }
                if (c === 'G') {
                    const mesh = E.makeGoal();
                    mesh.position.set(x + 0.5, y, 0);
                    root.add(mesh);
                    this.goal = { x: x + 0.5, y, mesh };
                }
                if (c === '~') {
                    const mesh = E.makeCrumble();
                    mesh.position.set(x + 0.5, y + 0.75, 0);
                    root.add(mesh);
                    this.crumbles.push({ x, y, timer: -1, broken: 0, mesh });
                }
            }
        }
        this.player = {
            x: start.x, y: start.y, vx: 0, vy: 0, facing: 1, onGround: false, coyote: 0, jumpBuf: 0,
            dashes: 1, dashTimer: 0, dashDir: { x: 1, y: 0 }, stamina: STAMINA_MAX, grabbing: false,
            lock: 0, dead: false, deadTimer: 0, jumping: false, squash: 1, wasGround: false, trail: [],
            doubleJumpAvailable: true, groundPounding: false
        };
        this.spawn = { x: start.x, y: start.y };
        if (level.boss) {
            const hp = level.boss === 'boss3' ? 12 : level.boss === 'boss2' ? 8 : 5;
            const color = level.boss === 'boss3' ? 0xff3b3b : level.boss === 'boss2' ? 0xff8c3b : 0x9b3bc9;
            const mesh = new THREE.Group();
            const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), new THREE.MeshLambertMaterial({ color }));
            body.position.y = 1.1;
            mesh.add(body);
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.2), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff }));
            eye.position.set(0.6, 1.6, 1.2);
            mesh.add(eye);
            const startX = this.goal ? this.goal.x - 6 : (this.grid.w - 6);
            mesh.position.set(startX, 3, 0);
            root.add(mesh);
            this.boss = { id: level.boss, hp, maxHp: hp, x: startX, y: 3, vx: 0, vy: 0, dir: 1, alive: true, mesh, hitCooldown: 0, minX: 2, maxX: this.grid.w - 2, phase: 0, speed: level.boss === 'boss3' ? 5 : level.boss === 'boss2' ? 4 : 3 };
        }
        this.playerMesh = E.makePlayer();
        root.add(this.playerMesh);
        this.view.camPos.set(start.x, start.y);
        this.view.follow(start.x, start.y, 0, true);
        this.running = true;
        this.pushHud();
    }

    crumbleAt(tx, ty) {
        for (const c of this.crumbles) if (c.x === tx && c.y === ty) return c;
        return null;
    }

    solid(tx, ty) {
        if (tx < 0 || tx >= this.grid.w) return true;
        if (ty < 0) return false;
        if (ty >= this.grid.h) return false;
        const c = this.grid.cells[ty][tx];
        if (c === '#') return true;
        if (c === '~') {
            const cr = this.crumbleAt(tx, ty);
            return !cr || cr.broken <= 0;
        }
        return false;
    }

    hits(x, y, w = PW, h = PH) {
        const x1 = Math.floor(x - w / 2 + 0.001);
        const x2 = Math.floor(x + w / 2 - 0.001);
        const y1 = Math.floor(y + 0.001);
        const y2 = Math.floor(y + h - 0.001);
        for (let ty = y1; ty <= y2; ty++) for (let tx = x1; tx <= x2; tx++) if (this.solid(tx, ty)) return true;
        return false;
    }

    moveX(p, dx) {
        const steps = Math.ceil(Math.abs(dx) / 0.2) || 1;
        const s = dx / steps;
        for (let i = 0; i < steps; i++) {
            if (this.hits(p.x + s, p.y)) {
                p.vx = 0;
                return true;
            }
            p.x += s;
        }
        return false;
    }

    moveY(p, dy) {
        const steps = Math.ceil(Math.abs(dy) / 0.2) || 1;
        const s = dy / steps;
        for (let i = 0; i < steps; i++) {
            if (this.hits(p.x, p.y + s)) {
                if (s < 0) p.y = Math.floor(p.y + s) + 1;
                p.vy = 0;
                return s < 0 ? 'floor' : 'ceil';
            }
            p.y += s;
        }
        return null;
    }

    wall(p, dir, yoff = 0, h = PH) {
        return this.hits(p.x + dir * 0.12, p.y + yoff, PW, h);
    }

    unlock(id) {
        if (!Save.data || !Save.data.achievements) return;
        if (Save.data.achievements[id]) return;
        Save.data.achievements[id] = true;
        Save.save();
        Sfx.achievement();
        const a = ACHIEVEMENTS.find(x => x.id === id);
        if (a && this.hooks.onAchievement) this.hooks.onAchievement(a);
    }

    pushHud() {
        this.hooks.onHud({
            level: this.level.name,
            index: this.levelIndex,
            berries: this.levelBerries,
            totalBerries: this.totalBerries,
            deaths: this.levelDeaths,
            time: this.time,
            stamina: this.player.stamina / STAMINA_MAX,
            dashes: this.player.dashes
        });
    }

    kill(reason = '') {
        const p = this.player;
        if (p.dead || this.finished) return;
        p.dead = true;
        p.deadTimer = 0.8;
        this.levelDeaths++;
        const ch = (this.level.chapter || 1);
        if (Save.data) {
            if (!Save.data.chapterDeaths) Save.data.chapterDeaths = [0, 0, 0];
            Save.data.chapterDeaths[ch - 1] = (Save.data.chapterDeaths[ch - 1] || 0) + 1;
            Save.data.deaths = (Save.data.deaths || 0) + 1;
            Save.save();
        }
        if (this.boss && this.boss.alive) this.bossDamageTaken = true;
        Sfx.die();
        this.view.shake = 0.8;
        this.view.emit(p.x, p.y + 0.5, 0xff3b3b, 40, 9, 0.9);
        this.view.emit(p.x, p.y + 0.5, 0xffffff, 15, 6, 0.7);
        this.playerMesh.visible = false;
        if (Save.data) {
            if (Save.data.deaths === 1) this.unlock('first_death');
            if (Save.data.deaths >= 10) this.unlock('die_10');
            if (Save.data.deaths >= 50) this.unlock('die_50');
            if (reason === 'spike') this.unlock('die_spike');
            if (reason === 'fall') this.unlock('die_fall');
        }
        if (Save.data && Save.data.mode === 'permadeath') this.permadeathPending = true;
    }

    respawn() {
        const p = this.player;
        p.x = this.spawn.x;
        p.y = this.spawn.y;
        p.vx = p.vy = 0;
        p.dead = false;
        p.dashes = 1;
        p.dashTimer = 0;
        p.stamina = STAMINA_MAX;
        p.grabbing = false;
        p.lock = 0;
        p.trail.length = 0;
        p.doubleJumpAvailable = true;
        p.groundPounding = false;
        this.playerMesh.visible = true;
        this.crumbles.forEach(c => {
            c.broken = 0;
            c.timer = -1;
            c.mesh.visible = true;
        });
        this.view.follow(p.x, p.y, 0, true);
    }

    update(rawDt) {
        if (!this.running) return;
        const dt = Math.min(rawDt, 1 / 30);
        this.view.updateParticles(dt);
        this.animate(dt);
        if (this.freeze > 0) {
            this.freeze -= dt;
            return;
        }
        this.clock += dt;
        if (!this.finished) this.time += dt;
        const p = this.player;
        if (p.dead) {
            p.deadTimer -= dt;
            if (p.deadTimer <= 0) {
                if (this.permadeathPending) {
                    this.running = false;
                    if (this.hooks.onPermadeath) this.hooks.onPermadeath();
                    return;
                }
                this.respawn();
            }
            this.view.follow(p.x, p.y, dt, false);
            return;
        }
        this.updatePlayer(p, dt);
        this.updateWorld(p, dt);
        this.updateBoss(p, dt);
        this.view.follow(p.x, p.y, dt, false);
        this.pushHud();
    }

    updatePlayer(p, dt) {
        const ix = this.finished ? 0 : Input.x;
        const iy = this.finished ? 0 : Input.y;
        const jumpHit = !this.finished && Input.hit('Space', 'KeyC', 'KeyZ');
        const jumpHeld = Input.down('Space', 'KeyC', 'KeyZ');
        const dashHit = !this.finished && Input.hit('KeyX', 'KeyK', 'KeyJ');
        const grabHeld = !this.finished && Input.down('ShiftLeft', 'ShiftRight', 'KeyV', 'KeyL');
        if (jumpHit) p.jumpBuf = 0.12;
        else p.jumpBuf -= dt;
        p.lock -= dt;
        const grounded = this.hits(p.x, p.y - 0.05);
        p.onGround = grounded;
        if (grounded) {
            p.coyote = 0.1;
            if (p.dashTimer <= 0) {
                p.dashes = 1;
                p.stamina = STAMINA_MAX;
            }
            if (!p.wasGround) {
                p.squash = 0.7;
                Sfx.land();
                this.view.emit(p.x, p.y, 0xffffff, 6, 3, 0.35);
            }
            p.doubleJumpAvailable = true;
            p.groundPounding = false;
        } else p.coyote -= dt;
        p.wasGround = grounded;
        if (ix !== 0 && p.lock <= 0) p.facing = ix;

        if (dashHit && p.dashes > 0 && p.dashTimer <= 0) {
            let dx = ix;
            let dy = iy;
            if (dx === 0 && dy === 0) dx = p.facing;
            const len = Math.hypot(dx, dy);
            p.dashDir = { x: dx / len, y: dy / len };
            p.dashes--;
            p.dashTimer = DASH_TIME;
            p.grabbing = false;
            p.jumpBuf = 0;
            this.freeze = 0.05;
            this.view.shake = 0.35;
            Sfx.dash();
        }

        if (p.dashTimer > 0) {
            p.dashTimer -= dt;
            p.vx = p.dashDir.x * DASH_SPEED;
            p.vy = p.dashDir.y * DASH_SPEED;
            p.trail.push({ x: p.x, y: p.y, life: 0.25 });
            this.view.emit(p.x, p.y + 0.45, 0x5ab8ff, 2, 1.5, 0.3);
            if (jumpHit && grounded && p.dashDir.y <= 0 && p.dashDir.x !== 0) {
                p.dashTimer = 0;
                p.vy = JUMP * 0.9;
                p.vx = p.dashDir.x * RUN * 1.9;
                p.jumpBuf = 0;
                p.jumping = true;
                Sfx.jump();
            } else {
                const hitX = this.moveX(p, p.vx * dt);
                const hitY = this.moveY(p, p.vy * dt);
                if (p.dashTimer <= 0) {
                    p.vx *= 0.5;
                    p.vy *= 0.4;
                }
                if (hitX && p.dashDir.y === 0) p.dashTimer = 0;
                if (hitY === 'floor' && p.dashDir.y < 0) p.dashTimer = 0;
            }
            return;
        }

        const wallDir = this.wall(p, 1) ? 1 : this.wall(p, -1) ? -1 : 0;
        p.grabbing = !grounded && wallDir !== 0 && grabHeld && p.stamina > 0;

        if (p.grabbing) {
            p.vx = 0;
            p.vy = iy > 0 ? 4 : iy < 0 ? -6 : 0;
            p.stamina -= dt * (iy > 0 ? 1.6 : 0.6);
            p.facing = wallDir;
            if (iy > 0 && !this.wall(p, wallDir, PH * 0.7, PH * 0.3) && this.wall(p, wallDir, 0, PH * 0.4)) {
                p.vy = 9;
                p.vx = wallDir * 2.5;
                p.grabbing = false;
                p.lock = 0.1;
            }
        } else if (p.lock <= 0) {
            const target = ix * RUN;
            const accel = grounded ? 90 : 55;
            if (Math.abs(p.vx) > RUN && Math.sign(p.vx) === ix) p.vx -= Math.sign(p.vx) * 20 * dt;
            else p.vx += Math.max(-accel * dt, Math.min(accel * dt, target - p.vx));
        } else {
            p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), 8 * dt);
        }

        if (p.jumpBuf > 0) {
            if (p.coyote > 0) {
                p.vy = JUMP;
                p.jumping = true;
                p.coyote = 0;
                p.jumpBuf = 0;
                p.squash = 1.3;
                Sfx.jump();
                this.view.emit(p.x, p.y, 0xffffff, 5, 3, 0.3);
            } else if (wallDir !== 0) {
                p.vy = JUMP * 0.95;
                p.vx = -wallDir * RUN;
                p.facing = -wallDir;
                p.lock = 0.15;
                p.jumping = true;
                p.jumpBuf = 0;
                p.grabbing = false;
                Sfx.jump();
                this.view.emit(p.x + wallDir * 0.35, p.y + 0.5, 0xffffff, 6, 3, 0.3);
            } else if (Save.hasSkill('double_jump') && p.doubleJumpAvailable && !grounded) {
                p.vy = JUMP * 0.9;
                p.doubleJumpAvailable = false;
                p.jumpBuf = 0;
                p.jumping = true;
                p.squash = 1.2;
                Sfx.jump();
                this.view.emit(p.x, p.y, 0x3bc7ff, 6, 3, 0.3);
            } else if (Save.hasSkill('ground_pound') && !grounded && iy < 0) {
                p.vy = -35;
                p.groundPounding = true;
                p.jumpBuf = 0;
                Sfx.dash();
            }
        }

        if (!p.grabbing) {
            let g = GRAVITY;
            if (p.vy > 0 && !jumpHeld && p.jumping) g *= 2.2;
            if (Math.abs(p.vy) < 2.5 && jumpHeld) g *= 0.55;
            p.vy -= g * dt;
            if (p.vy < -MAX_FALL) p.vy = -MAX_FALL;
            if (wallDir !== 0 && ix === wallDir && p.vy < -3) p.vy = -3;
        }
        if (p.vy <= 0) p.jumping = false;

        this.moveX(p, p.vx * dt);
        const r = this.moveY(p, p.vy * dt);
        if (r === 'ceil') p.jumping = false;
        if (p.y < -4) this.kill('fall');
        p.trail = p.trail.filter(t => (t.life -= dt) > 0);
    }

    overlap(ax, ay, aw, ah, bx, by, bw, bh) {
        return Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;
    }

    updateWorld(p, dt) {
        const cx = p.x;
        const cy = p.y + PH / 2;
        for (const s of this.spikes) {
            if (this.overlap(cx, cy, PW * 0.8, PH * 0.8, s.x + 0.5, s.y + 0.28, 0.7, 0.5)) {
                this.kill('spike');
                return;
            }
        }
        for (const b of this.berries) {
            if (!b.got && this.overlap(cx, cy, PW, PH, b.x, b.y, 0.8, 0.8)) {
                b.got = true;
                b.mesh.visible = false;
                this.levelBerries++;
                if (Save.data) { Save.data.berries = (Save.data.berries || 0) + 1; Save.save(); }
                Sfx.berry();
                this.view.emit(b.x, b.y, 0xff2d55, 20, 6, 0.7);
                if (Save.data && Save.data.berries >= 5) this.unlock('berry_5');
                if (this.levelBerries === this.totalBerries) this.unlock('berry_all');
            }
        }
        for (const c of this.crystals) {
            if (c.cool > 0) {
                c.cool -= dt;
                if (c.cool <= 0) c.mesh.visible = true;
            } else if (p.dashes < 1 && this.overlap(cx, cy, PW, PH, c.x, c.y, 0.8, 0.9)) {
                p.dashes = 1;
                c.cool = 2.5;
                c.mesh.visible = false;
                Sfx.crystal();
                this.view.emit(c.x, c.y, 0x7df9ff, 18, 5, 0.6);
                if (Save.data) { Save.data.crystals = (Save.data.crystals || 0) + 1; Save.save(); }
                if (Save.data && Save.data.crystals >= 10) this.unlock('crystal_10');
            }
        }
        for (const s of this.springs) {
            if (this.overlap(cx, cy, PW, PH, s.x, s.y + 0.25, 0.9, 0.5) && p.vy <= 2) {
                p.vy = 25;
                p.dashes = 1;
                p.jumping = false;
                p.dashTimer = 0;
                s.anim = 0.3;
                Sfx.spring();
                this.view.emit(s.x, s.y + 0.4, 0xffd23f, 12, 4, 0.4);
                this.unlock('spring');
            }
        }
        for (const f of this.flags) {
            if (!f.active && this.overlap(cx, cy, PW, PH, f.x, f.y + 0.8, 1.2, 1.8)) {
                this.flags.forEach(o => (o.active = false));
                f.active = true;
                this.spawn = { x: f.x, y: f.y };
                Sfx.check();
                this.view.emit(f.x, f.y + 1.3, 0x3ddc84, 20, 5, 0.7);
            }
        }
        for (const cr of this.crumbles) {
            if (cr.broken > 0) {
                cr.broken -= dt;
                if (cr.broken <= 0 && !this.hits(p.x, p.y)) {
                    cr.mesh.visible = true;
                    cr.timer = -1;
                } else if (cr.broken <= 0) cr.broken = 0.2;
            } else {
                const onTop = p.onGround && Math.abs(p.y - (cr.y + 1)) < 0.06 && Math.abs(p.x - (cr.x + 0.5)) < 0.5 + PW / 2;
                if (onTop && cr.timer < 0) cr.timer = 0.35;
                if (cr.timer > 0) {
                    cr.timer -= dt;
                    cr.mesh.position.x = cr.x + 0.5 + (Math.random() - 0.5) * 0.08;
                    if (cr.timer <= 0) {
                        cr.broken = 2.2;
                        cr.mesh.visible = false;
                        this.view.emit(cr.x + 0.5, cr.y + 0.7, 0xc99a5b, 10, 3, 0.5);
                    }
                }
            }
        }
        this.updateEnemies(p, dt, cx, cy);
        if (this.goal && !this.finished && this.overlap(cx, cy, PW, PH, this.goal.x, this.goal.y + 1, 1.4, 2)) {
            if (this.boss && this.boss.alive) return;
            this.complete();
        }
    }

    updateEnemies(p, dt, cx, cy) {
        for (const e of this.enemies) {
            if (!e.alive) continue;
            if (e.type === 'E') {
                const nx = e.x + e.dir * 2.4 * dt;
                const front = e.x + e.dir * 0.5;
                const wallAhead = this.solid(Math.floor(front + e.dir * 0.1), Math.floor(e.y + 0.3));
                const noGround = !this.solid(Math.floor(front), Math.floor(e.y - 0.3));
                if (wallAhead || noGround) e.dir *= -1;
                else e.x = nx;
            } else {
                e.phase += dt;
                e.x = e.ox + Math.sin(e.phase * 1.3) * 3.5;
                e.y = e.oy + Math.sin(e.phase * 2.1) * 1.1;
            }
            if (this.overlap(cx, cy, PW * 0.85, PH * 0.9, e.x, e.y + 0.4, e.w, e.h)) {
                const stomp = p.vy < -1 && p.y > e.y + 0.35;
                const dashing = p.dashTimer > 0;
                if (stomp || dashing || p.groundPounding) {
                    e.alive = false;
                    e.mesh.visible = false;
                    this.freeze = 0.06;
                    this.view.shake = 0.4;
                    this.view.emit(e.x, e.y + 0.4, e.type === 'E' ? 0x8b2fc9 : 0xff7a3d, 24, 7, 0.7);
                    Sfx.stomp();
                    if (Save.data) { Save.data.stomps = (Save.data.stomps || 0) + 1; Save.save(); }
                    if (Save.data && Save.data.stomps >= 5) this.unlock('stomp_5');
                    if (dashing) this.unlock('dash_dmg');
                    if (stomp) {
                        p.vy = 13;
                        p.jumping = true;
                        p.dashes = 1;
                    }
                } else {
                    this.kill('enemy');
                    return;
                }
            }
        }
    }

    updateBoss(p, dt) {
        const b = this.boss;
        if (!b || !b.alive) { this.bossDefeated = !this.boss || !this.boss.alive; return; }
        b.phase += dt;
        b.hitCooldown = Math.max(0, b.hitCooldown - dt);
        // movement
        const speed = b.speed + (b.maxHp - b.hp) * 0.4;
        b.x += b.dir * speed * dt;
        if (b.x < b.minX) { b.x = b.minX; b.dir = 1; }
        if (b.x > b.maxX) { b.x = b.maxX; b.dir = -1; }
        // vertical sine for flyers
        if (b.id === 'boss2' || b.id === 'boss3') b.y = 3 + Math.sin(b.phase * 2) * 1.5;
        else b.y = 3;
        // charge attack: every ~2.5s lunge toward player
        if (b.phase % 2.5 < dt * speed * 0) {}
        // collision with player
        if (this.overlap(p.x, p.y + PH / 2, PW * 0.9, PH * 0.9, b.x, b.y + 1, 2, 2)) {
            const stomp = p.vy < -1 && p.y > b.y + 0.5;
            const dashing = p.dashTimer > 0;
            const pound = p.groundPounding;
            if ((stomp || dashing || pound) && b.hitCooldown <= 0) {
                b.hp--;
                b.hitCooldown = 0.6;
                this.view.shake = 0.5;
                this.view.emit(b.x, b.y + 1, 0xffd23f, 24, 7, 0.7);
                Sfx.stomp();
                if (stomp) { p.vy = 13; p.jumping = true; p.dashes = 1; }
                if (b.hp <= 0) {
                    b.alive = false;
                    b.mesh.visible = false;
                    this.view.emit(b.x, b.y + 1, 0xff3b3b, 60, 10, 1.2);
                    Sfx.win();
                    if (!this.bossDamageTaken) this.unlock('boss_nodmg');
                    this.unlock(b.id === 'boss1' ? 'boss1' : b.id === 'boss2' ? 'boss2' : 'boss3');
                }
            } else if (b.hitCooldown <= 0) {
                this.bossDamageTaken = true;
                this.kill('enemy');
            }
        }
        b.mesh.position.set(b.x, b.y, 0);
        this.bossDefeated = !b.alive;
    }

    complete() {
        this.finished = true;
        Sfx.win();
        const i = this.levelIndex;
        const level = this.level;
        const ch = level.chapter || 1;
        if (Save.data) {
            Save.data.unlocked = Math.max(Save.data.unlocked || 1, Math.min(LEVELS.length, i + 2));
            const prev = Save.data.best ? Save.data.best[i] : null;
            const record = !prev || this.time < prev.time;
            if (!Save.data.best) Save.data.best = {};
            if (record) Save.data.best[i] = { time: this.time, berries: Math.max(this.levelBerries, prev ? prev.berries : 0) };
            else if (prev) prev.berries = Math.max(prev.berries, this.levelBerries);
            Save.data.totalTime = (Save.data.totalTime || 0) + this.time;
            if (!Save.data.completedChapters) Save.data.completedChapters = [];
        }
        Save.save();
        this.view.emit(this.goal.x, this.goal.y + 1, 0xffd23f, 60, 8, 1.2);
        if (i === 0) this.unlock('first_steps');
        if (i === 0 && this.time < 40) this.unlock('speed');
        if (this.levelDeaths === 0) this.unlock('no_death');
        // chapter completion
        const levelsInChapter = LEVELS.map((l, idx) => ({ l, idx })).filter(o => (o.l.chapter || 1) === ch);
        const lastIdx = levelsInChapter[levelsInChapter.length - 1].idx;
        if (i === lastIdx) {
            if (Save.data && !Save.data.completedChapters.includes(ch)) Save.data.completedChapters.push(ch);
            this.unlock('ch' + ch + '_complete');
            if (level.boss) this.unlock('boss' + ch);
            const cd = Save.data && Save.data.chapterDeaths ? (Save.data.chapterDeaths[ch - 1] || 0) : 0;
            if (cd === 0) this.unlock('no_death_ch' + ch);
        }
        if (i === LEVELS.length - 1) { this.unlock('summit'); this.unlock('summit_complete'); }
        // no death all
        if (Save.data && (Save.data.deaths || 0) === 0 && Save.data.completedChapters && Save.data.completedChapters.length === 3) {
            this.unlock('no_death_all');
        }
        // skills
        if (i >= 2) Save.unlockSkill('double_jump');
        if (ch >= 2) Save.unlockSkill('air_dash');
        if (ch >= 3) Save.unlockSkill('ground_pound');
        if (Save.data && Save.data.skills && Save.data.skills.length >= SKILLS.length) this.unlock('all_skills');
        // boss nodmg
        if (level.boss && !this.bossDamageTaken) this.unlock('boss_nodmg');
        Save.save();
        setTimeout(() => {
            this.hooks.onComplete({
                index: i,
                name: this.level.name,
                time: this.time,
                berries: this.levelBerries,
                totalBerries: this.totalBerries,
                deaths: this.levelDeaths,
                record: (Save.data && Save.data.best && Save.data.best[i] && Save.data.best[i].time === this.time) || false,
                last: i === LEVELS.length - 1
            });
        }, 900);
    }

    animate(dt) {
        const p = this.player;
        const m = this.playerMesh;
        const t = performance.now() / 1000;
        p.squash += (1 - p.squash) * Math.min(1, dt * 14);
        m.position.set(p.x, p.y, 0.1);
        const ud = m.userData;
        ud.body.scale.set(1 / p.squash, p.squash, 1);
        ud.body.scale.x *= p.facing;
        const col = p.dashes > 0 ? 0xff3b3b : 0x3bc7ff;
        ud.hair.material.color.setHex(col);
        ud.tail.material.color.setHex(col);
        ud.tail.position.y = 0.8 + Math.sin(t * 12) * 0.03;
        ud.body.rotation.z = p.grabbing ? 0 : -p.vx * 0.012;
        this.goal && (this.goal.mesh.userData.ring.rotation.y = t * 2, this.goal.mesh.userData.core.rotation.y = -t * 3, this.goal.mesh.position.y = this.goal.y + Math.sin(t * 2) * 0.1);
        this.berries.forEach((b, i) => {
            b.mesh.position.y = b.y + Math.sin(t * 3 + i) * 0.12;
        });
        this.crystals.forEach(c => {
            c.mesh.rotation.y = t * 2;
        });
        this.springs.forEach(s => {
            s.anim = Math.max(0, s.anim - dt);
            s.mesh.userData.top.position.y = 0.4 + (s.anim > 0 ? 0.25 : 0);
            s.mesh.userData.coil.scale.y = s.anim > 0 ? 1.8 : 1;
        });
        this.flags.forEach(f => {
            f.mesh.userData.cloth.material.color.setHex(f.active ? 0x3ddc84 : 0x888888);
            f.mesh.userData.cloth.rotation.y = Math.sin(t * 4) * 0.2;
        });
        this.enemies.forEach(e => {
            e.mesh.position.set(e.x, e.y, 0);
            if (e.type === 'E') e.mesh.scale.x = e.dir;
            else {
                const w = Math.sin(t * 20) * 0.5;
                e.mesh.userData.wingL.rotation.z = w;
                e.mesh.userData.wingR.rotation.z = -w;
            }
        });
        this.boss && this.boss.mesh && (this.boss.mesh.rotation.y += dt * 2);
        this.crumbles.forEach(c => {
            if (c.timer < 0 && c.broken <= 0) c.mesh.position.x = c.x + 0.5;
        });
    }
}
