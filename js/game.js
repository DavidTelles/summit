import { LEVELS } from './levels.js';
import { Input, ACHIEVEMENTS, Save, SKILLS, chapterOfLevel } from './core.js';
import { ABILITIES } from './abilities.js';
import { AbilitySystem } from './abilitySystem.js';
import { Sfx } from './audio.js';
import * as E from './entities.js';
import { STEP, MAX_STEPS_PER_FRAME, STAMINA_MAX, PW, PH, IFRAMES, POUND_RADIUS, DEATH_TIME, PLAYER_HP } from './config.js';
import { World } from './world.js';
import { createPlayer, resetPlayerMotion, updatePlayer, playerPose } from './player.js';
import { createHazard, isHazardDef, overlap } from './hazards.js';
import { createEnemy, isEnemyDef } from './enemies.js';
import { createBoss } from './bosses.js';

const COMPLETE_DELAY = 0.9;
const CRUMBLE_DELAY = 0.35;
const CRUMBLE_RESPAWN = 2.2;
const CRYSTAL_COOLDOWN = 2.5;
const STOMP_BOUNCE = 13;

export class Game {
    constructor(view, hooks, input = Input) {
        this.view = view;
        this.hooks = hooks;
        this.input = input;
        this.levelIndex = 0;
        this.running = false;
        this.accumulator = 0;
    }

    load(index, resume = null) {
        this.levelIndex = index;
        const level = LEVELS[index];
        this.level = level;
        this.grid = level.grid;
        this.view.build(level);
        this.world = new World(this.grid);
        this.time = resume ? resume.time : 0;
        this.clock = 0;
        this.freeze = 0;
        this.timeScale = 1;
        this.levelDeaths = 0;
        this.levelBerries = 0;
        this.finished = false;
        this.completeTimer = -1;
        this.cutscene = false;
        this.bossHazards = [];
        this.strikes = [];
        this.shots = [];
        this.accumulator = 0;
        this.unsavedTime = 0;
        this.permadeathPending = false;
        this.permadeathNotified = false;
        this.bossDamageTaken = false;
        this.newAbilities = [];
        this.buildEntities(resume);
        this.abilities = new AbilitySystem(this, Save.equippedAbilities());
        this.running = true;
        this.pushHud();
    }

    buildEntities(resume) {
        const root = this.view.root;
        const grid = this.grid;
        this.berries = [];
        this.crystals = [];
        this.springs = [];
        this.enemies = [];
        this.flags = [];
        this.crumbles = [];
        this.spikes = new Set();
        this.ceilingSpikes = new Set();
        this.hazards = [];
        this.specialBlocks = new Map();
        this.goal = null;
        this.totalBerries = 0;
        this.boss = null;
        let start = { x: 2, y: 2 };
        for (let y = 0; y < grid.h; y++) {
            for (let x = 0; x < grid.w; x++) {
                const c = grid.cells[y][x];
                if (c === 'P') start = { x: x + 0.5, y };
                else if (c === 'S') {
                    const mesh = E.makeBerry();
                    mesh.position.set(x + 0.5, y + 0.5, 0);
                    root.add(mesh);
                    this.berries.push({ x: x + 0.5, y: y + 0.5, got: false, mesh });
                    this.totalBerries++;
                } else if (c === 'C') {
                    const mesh = E.makeCrystal();
                    mesh.position.set(x + 0.5, y + 0.5, 0);
                    root.add(mesh);
                    this.crystals.push({ x: x + 0.5, y: y + 0.5, cool: 0, mesh });
                } else if (c === 'B') {
                    const mesh = E.makeSpring();
                    mesh.position.set(x + 0.5, y, 0);
                    root.add(mesh);
                    this.springs.push({ x: x + 0.5, y, anim: 0, mesh });
                } else if (c === '^' || c === 'v') {
                    const mesh = E.makeSpikes(c === 'v');
                    mesh.position.set(x, y, 0);
                    root.add(mesh);
                    (c === '^' ? this.spikes : this.ceilingSpikes).add(this.world.key(x, y));
                } else if (c === 'E' || c === 'F') {
                    this.enemies.push(createEnemy(c, { x: x + 0.5, y }, root));
                } else if (c === 'K') {
                    const mesh = E.makeFlag();
                    mesh.position.set(x + 0.5, y, -0.3);
                    root.add(mesh);
                    this.flags.push({ x: x + 0.5, y, active: false, mesh });
                } else if (c === 'G') {
                    const mesh = E.makeGoal();
                    mesh.position.set(x + 0.5, y, 0);
                    root.add(mesh);
                    this.goal = { x: x + 0.5, y, mesh };
                } else if (c === '~') {
                    const mesh = E.makeCrumble();
                    mesh.position.set(x + 0.5, y + 0.75, 0);
                    root.add(mesh);
                    const crumble = { x, y, timer: -1, broken: 0, mesh };
                    this.crumbles.push(crumble);
                    this.world.crumbles.set(this.world.key(x, y), crumble);
                } else if (c === 'X' || c === 'Y' || c === 'O' || c === 'o') {
                    const mesh = E.makeSpecialBlock(c);
                    mesh.position.set(x + 0.5, y + 0.5, 0);
                    root.add(mesh);
                    this.specialBlocks.set(this.world.key(x, y), { kind: c, mesh });
                }
            }
        }
        for (const def of this.level.objects || []) {
            if (isHazardDef(def)) {
                const h = createHazard(def, root, this.world);
                this.hazards.push(h);
                if (def.type === 'mover') this.world.solids.push(h);
            } else if (isEnemyDef(def)) {
                this.enemies.push(createEnemy(def.type, def, root));
            }
        }
        this.setupArena();
        const origin = resume ? { x: resume.x, y: resume.y } : start;
        this.player = createPlayer(origin.x, origin.y);
        this.player.dashes = this.maxDashes();
        this.spawn = { ...origin };
        if (resume) this.flags.forEach(f => { f.active = f.x === resume.x && f.y === resume.y; });
        this.playerMesh = E.makePlayer();
        root.add(this.playerMesh);
        this.view.setBounds(null);
        this.view.camPos.set(origin.x, origin.y);
        this.view.follow(origin.x, origin.y, 0, true);
    }

    setupArena() {
        const a = this.level.arena;
        if (!a || !this.level.boss) return;
        this.gate = { x: a.gateX, y: a.floor, w: 1, h: a.ceil - a.floor, active: false };
        this.gate.mesh = E.makeGate(this.gate.h);
        this.gate.mesh.position.set(this.gate.x + 0.5, this.gate.y, 0);
        this.gate.mesh.visible = false;
        this.view.root.add(this.gate.mesh);
        this.world.solids.push(this.gate);
        this.boss = createBoss(this, this.level.boss);
        if (this.goal) this.goal.mesh.visible = false;
    }

    hasSkill(id) {
        return Save.hasSkill(id);
    }

    maxDashes() {
        return this.hasSkill('air_dash') ? 2 : 1;
    }

    hitstop(duration) {
        this.freeze = Math.max(this.freeze, duration);
    }

    shake(amount) {
        this.view.shake = Math.max(this.view.shake, amount);
    }

    addShot(s) {
        this.shots.push(s);
    }

    addStrike(s) {
        this.strikes.push(s);
    }

    unlock(id) {
        const d = Save.data;
        if (!d || d.achievements[id]) return;
        d.achievements[id] = true;
        Save.save();
        Sfx.achievement();
        const a = ACHIEVEMENTS.find(x => x.id === id);
        if (a && this.hooks.onAchievement) this.hooks.onAchievement(a);
        this.syncProgress();
    }

    syncProgress() {
        const d = Save.data;
        if (!d) return;
        for (const ability of Save.refreshAbilities()) {
            this.newAbilities.push(ability);
            Sfx.skill();
            if (this.hooks.onAbilityUnlock) this.hooks.onAbilityUnlock(ability);
        }
        if (d.skills.length >= SKILLS.length && Object.keys(d.abilities).length >= ABILITIES.length) this.unlock('all_skills');
    }

    grantSkill(id) {
        if (!Save.unlockSkill(id)) return;
        Sfx.skill();
        const skill = SKILLS.find(s => s.id === id);
        if (skill && this.hooks.onSkill) this.hooks.onSkill(skill);
    }

    pushHud() {
        const p = this.player;
        this.hooks.onHud({
            level: this.level.name,
            index: this.levelIndex,
            chapter: this.level.chapter,
            berries: this.levelBerries,
            totalBerries: this.totalBerries,
            deaths: this.levelDeaths,
            time: this.time,
            stamina: p.stamina / STAMINA_MAX,
            dashes: p.dashes,
            maxDashes: this.maxDashes(),
            hp: p.hp,
            maxHp: PLAYER_HP,
            abilities: this.abilities.hud(),
            slowmo: this.abilities.worldScale < 1
        });
    }

    flushPlaytime() {
        const d = Save.data;
        if (!d || !this.unsavedTime) return;
        d.totalTime += this.unsavedTime;
        this.unsavedTime = 0;
        Save.save();
    }

    attackKind(p, thresholdY) {
        if (p.groundPounding) return 'pound';
        const boosted = this.abilities.contactKind(p);
        if (boosted) return boosted;
        if (p.dashTimer > 0) return 'dash';
        if (p.vy < -1 && p.y > thresholdY) return 'stomp';
        return null;
    }

    hurtPlayer(amount, sourceX, ignoreFrames = false) {
        const p = this.player;
        if (p.dead || this.finished || this.cutscene) return;
        if (p.iframes > 0 && !ignoreFrames) return;
        if (this.abilities.absorbHit(sourceX)) return;
        if (this.boss && this.boss.fighting) this.bossDamageTaken = true;
        p.hp -= amount;
        this.abilities.onDamaged();
        if (p.hp <= 0) {
            if (this.abilities.surviveLethal()) return;
            this.kill('enemy');
            return;
        }
        p.iframes = IFRAMES + this.abilities.extraIframes();
        if (!this.abilities.firm()) {
            p.hurtTimer = 0.28;
            p.dashTimer = 0;
            p.groundPounding = false;
            p.grabbing = false;
            p.vx = (p.x >= sourceX ? 1 : -1) * 7;
            p.vy = 7;
            p.jumping = false;
        }
        this.hitstop(0.08);
        this.shake(0.5);
        Sfx.hurt();
        this.view.emit(p.x, p.y + 0.5, 0xff5a5a, 14, 6, 0.5);
        this.view.damageFlash();
    }

    kill(reason = '') {
        const p = this.player;
        if (p.dead || this.finished) return;
        if (this.abilities.surviveKill(reason)) return;
        p.dead = true;
        p.hp = 0;
        p.deadTimer = DEATH_TIME;
        this.levelDeaths++;
        const ch = this.level.chapter;
        const d = Save.data;
        if (d) {
            d.chapterDeaths[ch - 1]++;
            d.deaths++;
            Save.save();
        }
        if (this.boss && this.boss.fighting) this.bossDamageTaken = true;
        Sfx.die();
        this.shake(0.8);
        this.view.emit(p.x, p.y + 0.5, 0xff3b3b, 40, 9, 0.9);
        this.view.emit(p.x, p.y + 0.5, 0xffffff, 15, 6, 0.7);
        this.playerMesh.visible = false;
        if (d) {
            if (d.deaths === 1) this.unlock('first_death');
            if (d.deaths >= 10) this.unlock('die_10');
            if (d.deaths >= 50) this.unlock('die_50');
            if (reason === 'spike') this.unlock('die_spike');
            if (reason === 'fall') this.unlock('die_fall');
            if (d.mode === 'permadeath') {
                this.permadeathPending = true;
                this.flushPlaytime();
                if (this.hooks.onPermadeathCommit) this.hooks.onPermadeathCommit();
            }
        }
    }

    respawn() {
        const p = this.player;
        p.x = this.spawn.x;
        p.y = this.spawn.y;
        resetPlayerMotion(p, this.maxDashes());
        this.abilities.onRespawn();
        this.playerMesh.visible = true;
        this.view.spawnPop();
        this.crumbles.forEach(c => {
            c.broken = 0;
            c.timer = -1;
            c.mesh.visible = true;
        });
        this.hazards.forEach(h => { if (h.reset) h.reset(this.spawn.y); });
        this.shots.forEach(s => s.dispose(this));
        this.strikes.forEach(s => s.dispose(this));
        this.shots.length = 0;
        this.strikes.length = 0;
        if (this.boss && this.boss.alive && this.boss.mode !== 'idle' && this.boss.mode !== 'dying') {
            this.boss.retry();
        }
        this.view.follow(p.x, p.y, 0, true);
    }

    update(rawDt) {
        if (!this.running) return;
        const dt = Math.min(rawDt, MAX_STEPS_PER_FRAME * STEP);
        this.view.updateParticles(dt);
        if (this.freeze > 0) {
            this.freeze -= dt;
        } else {
            this.accumulator += dt * this.timeScale;
            let stepped = false;
            while (this.accumulator >= STEP) {
                this.step(STEP);
                this.accumulator -= STEP;
                if (!stepped) {
                    this.input.endFrame();
                    stepped = true;
                }
                if (!this.running || this.freeze > 0) {
                    this.accumulator = 0;
                    break;
                }
            }
        }
        if (!this.running) return;
        this.animate(dt);
        this.followCamera(dt);
        this.pushHud();
    }

    step(dt) {
        if (!this.running) return;
        const worldDt = dt * this.abilities.worldScale;
        this.clock += worldDt;
        if (!this.finished) {
            this.time += dt;
            this.unsavedTime += dt;
        }
        if (this.completeTimer >= 0) {
            this.completeTimer -= dt;
            if (this.completeTimer < 0) this.fireComplete();
        }
        const p = this.player;
        this.abilities.update(dt, p);
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
            return;
        }
        this.world.updatePulse(this.clock, () => this.world.hits(p.x, p.y));
        for (const h of this.hazards) h.update(this, worldDt, p);
        for (const h of this.bossHazards) h.update(this, worldDt, p);
        updatePlayer(this, p, dt);
        if (!p.dead) this.updateWorld(p, dt, worldDt);
        this.updateProjectiles(worldDt, p);
        this.updateBoss(p, worldDt);
    }

    touchingTileHazard(p) {
        const x1 = Math.floor(p.x - PW * 0.4);
        const x2 = Math.floor(p.x + PW * 0.4);
        const y1 = Math.floor(p.y + 0.05);
        const y2 = Math.floor(p.y + PH - 0.05);
        const cx = p.x;
        const cy = p.y + PH / 2;
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                const k = this.world.key(x, y);
                if (this.spikes.has(k) && overlap(cx, cy, PW * 0.8, PH * 0.8, x + 0.5, y + 0.28, 0.7, 0.5)) return true;
                if (this.ceilingSpikes.has(k) && overlap(cx, cy, PW * 0.8, PH * 0.8, x + 0.5, y + 0.72, 0.7, 0.5)) return true;
            }
        }
        return false;
    }

    updateWorld(p, dt, worldDt = dt) {
        const cx = p.x;
        const cy = p.y + PH / 2;
        if (this.abilities.spikeGrace <= 0 && this.touchingTileHazard(p)) {
            this.kill('spike');
            return;
        }
        for (const b of this.berries) {
            if (!b.got && overlap(cx, cy, PW, PH, b.x, b.y, 0.8, 0.8)) this.collectBerry(b);
        }
        for (const c of this.crystals) {
            if (c.cool > 0) {
                c.cool -= dt;
                if (c.cool <= 0) c.mesh.visible = true;
            } else if (p.dashes < this.maxDashes() && overlap(cx, cy, PW, PH, c.x, c.y, 0.8, 0.9)) {
                p.dashes = this.maxDashes();
                c.cool = CRYSTAL_COOLDOWN;
                c.mesh.visible = false;
                Sfx.crystal();
                this.view.emit(c.x, c.y, 0x7df9ff, 18, 5, 0.6);
                const d = Save.data;
                if (d) {
                    d.crystals++;
                    Save.save();
                    if (d.crystals >= 10) this.unlock('crystal_10');
                    this.syncProgress();
                }
            }
        }
        for (const s of this.springs) {
            if (overlap(cx, cy, PW, PH, s.x, s.y + 0.25, 0.9, 0.5) && p.vy <= 2) {
                p.vy = 25;
                p.dashes = this.maxDashes();
                p.jumping = false;
                p.dashTimer = 0;
                p.groundPounding = false;
                p.doubleJumpAvailable = true;
                s.anim = 0.3;
                Sfx.spring();
                this.view.emit(s.x, s.y + 0.4, 0xffd23f, 12, 4, 0.4);
                this.unlock('spring');
            }
        }
        for (const f of this.flags) {
            if (!f.active && overlap(cx, cy, PW, PH, f.x, f.y + 0.8, 1.2, 1.8)) this.activateFlag(f, p);
        }
        for (const cr of this.crumbles) this.updateCrumble(cr, p, dt);
        this.updateEnemies(p, worldDt);
        if (p.dead) return;
        if (this.goal && !this.finished && overlap(cx, cy, PW, PH, this.goal.x, this.goal.y + 1, 1.4, 2)) {
            if (this.boss && this.boss.alive) return;
            this.complete();
        }
    }

    collectBerry(b) {
        b.got = true;
        b.mesh.visible = false;
        this.levelBerries++;
        Sfx.berry();
        this.view.emit(b.x, b.y, 0xff2d55, 20, 6, 0.7);
        const d = Save.data;
        if (d) {
            d.berries++;
            Save.save();
            if (d.berries >= 5) this.unlock('berry_5');
            this.syncProgress();
        }
        if (this.levelBerries === this.totalBerries) this.unlock('berry_all');
    }

    activateFlag(f, p) {
        this.flags.forEach(o => { o.active = false; });
        f.active = true;
        this.spawn = { x: f.x, y: f.y };
        p.hp = PLAYER_HP;
        Sfx.check();
        this.view.emit(f.x, f.y + 1.3, 0x3ddc84, 20, 5, 0.7);
        const d = Save.data;
        this.saveCheckpoint(f.x, f.y);
        this.abilities.onCheckpoint();
        if (this.hooks.onCheckpoint) this.hooks.onCheckpoint();
    }

    saveCheckpoint(x, y) {
        const d = Save.data;
        if (!d) return;
        const elsewhere = d.checkpoint && d.checkpoint.level !== this.levelIndex;
        if (elsewhere && this.levelIndex < d.checkpoint.level) return;
        d.checkpoint = { level: this.levelIndex, x, y, time: this.time };
        Save.save();
    }

    updateCrumble(cr, p, dt) {
        if (cr.broken > 0) {
            cr.broken -= dt;
            if (cr.broken <= 0) {
                if (this.world.hits(p.x, p.y)) cr.broken = 0.2;
                else {
                    cr.mesh.visible = true;
                    cr.timer = -1;
                }
            }
            return;
        }
        const onTop = p.onGround && Math.abs(p.y - (cr.y + 1)) < 0.06 && Math.abs(p.x - (cr.x + 0.5)) < 0.5 + PW / 2;
        if (onTop && cr.timer < 0) cr.timer = CRUMBLE_DELAY;
        if (cr.timer > 0) {
            cr.timer -= dt;
            if (cr.timer <= 0) {
                cr.broken = CRUMBLE_RESPAWN;
                cr.timer = -1;
                cr.mesh.visible = false;
                Sfx.shatter();
                this.view.emit(cr.x + 0.5, cr.y + 0.7, 0xc99a5b, 10, 3, 0.5);
            }
        }
    }

    updateEnemies(p, dt) {
        const cx = p.x;
        const cy = p.y + PH / 2;
        for (const e of this.enemies) {
            if (!e.alive) continue;
            if (Math.abs(e.x - p.x) > 40) continue;
            e.update(this, dt, p);
            if (p.dead) return;
            const reach = this.abilities.hitReach(p);
            if (!overlap(cx, cy, PW * 0.85 * reach, PH * 0.9 * reach, e.x, e.y + e.h / 2, e.w, e.h)) continue;
            const kind = this.attackKind(p, e.y + e.h * 0.45);
            if (!kind) {
                if (e.hurtsOnContact) this.hurtPlayer(1, e.x);
                if (p.dead) return;
                continue;
            }
            const result = e.receive(kind, this, p);
            if (result === 'killed') this.onEnemyKilled(e, kind, p);
            else if (result === 'blocked') this.bouncePlayerOff(p, e.x, e.y + e.h / 2);
            else if (result === 'hit') {
                this.hitstop(0.05);
                this.bouncePlayerOff(p, e.x, e.y + e.h / 2);
            }
        }
    }

    onEnemyKilled(e, kind, p) {
        e.die(this);
        this.hitstop(0.06);
        this.shake(0.4);
        Sfx.stomp();
        const d = Save.data;
        if (d) {
            d.stomps++;
            Save.save();
            if (d.stomps >= 5) this.unlock('stomp_5');
            this.syncProgress();
        }
        this.abilities.onKill(kind, p);
        if (kind === 'dash' || kind === 'blade') this.unlock('dash_dmg');
        if (kind === 'stomp') {
            p.vy = STOMP_BOUNCE;
            p.jumping = true;
            p.dashes = this.maxDashes();
        }
    }

    bouncePlayerOff(p, x, y) {
        const fromAbove = p.y + PH / 2 > y + 0.3;
        p.dashTimer = 0;
        p.groundPounding = false;
        p.vx = (p.x >= x ? 1 : -1) * 8;
        p.vy = fromAbove ? 10 : 5;
        p.jumping = false;
        p.lock = 0.18;
        p.dashes = this.maxDashes();
        p.iframes = Math.max(p.iframes, 0.35);
        Sfx.clank();
        this.view.emit(p.x, p.y + 0.4, 0xfff2b0, 10, 5, 0.3);
    }

    afterBossStrike(result, part, kind) {
        const p = this.player;
        if (result === 'none') return;
        if (result === 'blocked') {
            this.bouncePlayerOff(p, part.x, part.y);
            return;
        }
        const x = part.x;
        p.dashTimer = 0;
        p.groundPounding = false;
        p.vx = (p.x >= x ? 1 : -1) * 9;
        p.vy = STOMP_BOUNCE;
        p.jumping = true;
        p.lock = 0.15;
        p.dashes = this.maxDashes();
        p.iframes = Math.max(p.iframes, 0.5);
    }

    breakCell(tx, ty) {
        const k = this.world.key(tx, ty);
        if (this.world.broken.has(k)) return;
        this.world.broken.add(k);
        const block = this.specialBlocks.get(k);
        if (block) block.mesh.visible = false;
        Sfx.shatter();
        this.shake(0.25);
        this.view.emit(tx + 0.5, ty + 0.5, 0xb8a58a, 14, 5, 0.5);
    }

    poundImpact() {
        const p = this.player;
        const below = Math.floor(p.y - 0.1);
        let broke = false;
        for (let dx = -1; dx <= 1; dx++) {
            const tx = Math.floor(p.x + dx * 0.35);
            if (this.world.cell(tx, below) === 'Y' && this.world.solid(tx, below)) {
                this.breakCell(tx, below);
                broke = true;
            }
        }
        Sfx.pound();
        this.shake(0.55);
        this.hitstop(0.05);
        this.view.emit(p.x, p.y, 0xd8e6ff, 26, 8, 0.5);
        for (const e of this.enemies) {
            if (!e.alive || Math.hypot(e.x - p.x, e.y - p.y) > POUND_RADIUS) continue;
            if (e.receive('pound', this, p) === 'killed') this.onEnemyKilled(e, 'pound', p);
        }
        if (this.boss && this.boss.fighting) this.boss.onPound(p.x, p.y);
        if (broke) return;
        p.groundPounding = false;
        p.vy = 7;
        p.jumping = false;
        p.squash = 0.6;
    }

    discoverSecret(secret) {
        Sfx.secret();
        const d = Save.data;
        if (d) {
            d.secrets[`${this.levelIndex}:${secret.id || 0}`] = true;
            Save.save();
        }
        this.unlock('secret_area');
        if (secret.trial) this.unlock('trial_ch3');
        this.syncProgress();
        if (this.hooks.onSecret) this.hooks.onSecret(secret.label || 'Área secreta encontrada');
    }

    updateProjectiles(dt, p) {
        for (const list of [this.shots, this.strikes]) {
            for (let i = list.length - 1; i >= 0; i--) {
                const item = list[i];
                item.update(this, dt, p);
                if (item.done) {
                    item.dispose(this);
                    list.splice(i, 1);
                }
            }
        }
    }

    updateBoss(p, dt) {
        const b = this.boss;
        if (!b || !b.alive) return;
        if (b.mode === 'idle') {
            if (p.x >= this.level.arena.triggerX && p.onGround && !p.dead) this.startBoss();
            return;
        }
        if (this.timeScale < 1 && b.modeT > 0.9) this.timeScale = 1;
        b.update(dt, p);
    }

    startBoss() {
        const b = this.boss;
        this.gate.active = true;
        this.gate.mesh.visible = true;
        this.cutscene = true;
        const a = this.level.arena;
        this.spawn = { x: a.spawnX, y: a.floor };
        this.saveCheckpoint(a.entryX, a.floor);
        this.abilities.onBossStart();
        this.view.setBounds({ x1: a.x1, x2: a.x2, y1: a.floor - 2, y2: a.ceil, dist: a.zoom || 25 });
        b.begin();
        this.hooks.onBossIntro && this.hooks.onBossIntro(b.name, b.title);
        Sfx.setTheme('boss');
    }

    bossFightStarted() {
        this.cutscene = false;
        this.bossBarChanged();
    }

    bossBarChanged() {
        const b = this.boss;
        this.hooks.onBossBar && this.hooks.onBossBar(b.name, b.hp / b.maxHp, b.phase, b.thresholds.map(t => t / b.maxHp));
    }

    bossDying() {
        this.timeScale = 0.35;
        Sfx.bossDown();
        this.cutscene = true;
        this.shots.forEach(s => s.dispose(this));
        this.strikes.forEach(s => s.dispose(this));
        this.shots.length = 0;
        this.strikes.length = 0;
    }

    bossDefeated() {
        this.cutscene = false;
        this.gate.active = false;
        this.gate.mesh.visible = false;
        this.player.hp = PLAYER_HP;
        if (this.goal) {
            this.goal.mesh.visible = true;
            this.view.emit(this.goal.x, this.goal.y + 1, 0xffd23f, 50, 8, 1.2);
        }
        Sfx.win();
        Sfx.setTheme(this.level.chapter);
        this.hooks.onBossEnd && this.hooks.onBossEnd();
        this.unlock(this.level.boss);
        if (!this.bossDamageTaken) this.unlock('boss_nodmg');
    }

    complete() {
        this.finished = true;
        Sfx.win();
        const i = this.levelIndex;
        const ch = this.level.chapter;
        const d = Save.data;
        let record = false;
        if (d) {
            d.unlocked = Math.max(d.unlocked, Math.min(LEVELS.length, i + 2));
            const prev = d.best[i];
            record = !prev || this.time < prev.time;
            d.best[i] = {
                time: record ? this.time : prev.time,
                berries: Math.max(this.levelBerries, prev ? prev.berries : 0)
            };
            if (d.checkpoint && d.checkpoint.level === i) d.checkpoint = null;
            this.flushPlaytime();
        }
        this.view.emit(this.goal.x, this.goal.y + 1, 0xffd23f, 60, 8, 1.2);
        if (i === 0) this.unlock('first_steps');
        if (i === 0 && this.time < 40) this.unlock('speed');
        if (this.levelDeaths === 0) this.unlock('no_death');
        const lastOfChapter = i === LEVELS.length - 1 || LEVELS[i + 1].chapter !== ch;
        if (lastOfChapter && d) {
            if (!d.completedChapters.includes(ch)) d.completedChapters.push(ch);
            this.unlock('ch' + ch + '_complete');
            if (d.chapterDeaths[ch - 1] === 0) this.unlock('no_death_ch' + ch);
        }
        if (i === LEVELS.length - 1) {
            this.unlock('summit');
            this.unlock('summit_complete');
        }
        if (d && d.deaths === 0 && d.completedChapters.length === 3) this.unlock('no_death_all');
        if (i >= 2) this.grantSkill('double_jump');
        if (i >= 5) this.grantSkill('air_dash');
        if (i >= 9) this.grantSkill('ground_pound');
        this.syncProgress();
        if (d) {
            d.currentLevel = Math.min(i + 1, LEVELS.length - 1);
            d.chapter = chapterOfLevel(d.currentLevel);
        }
        Save.save();
        this.completeResult = {
            index: i,
            name: this.level.name,
            chapter: ch,
            time: this.time,
            berries: this.levelBerries,
            totalBerries: this.totalBerries,
            deaths: this.levelDeaths,
            record,
            lastOfChapter,
            last: i === LEVELS.length - 1,
            newAbilities: this.newAbilities
        };
        this.completeTimer = COMPLETE_DELAY;
    }

    fireComplete() {
        this.running = false;
        this.hooks.onComplete(this.completeResult);
    }

    followCamera(dt) {
        const p = this.player;
        if (this.boss && this.cutscene && this.boss.mode === 'intro') {
            this.view.follow(this.boss.x, this.boss.y + 1, dt, false, true);
            return;
        }
        const look = p.dead ? 0 : p.facing * Math.min(1.5, Math.abs(p.vx) * 0.2);
        this.view.follow(p.x + look, p.y, dt, false);
    }

    animate(dt) {
        const p = this.player;
        const t = performance.now() / 1000;
        E.animatePlayer(this.playerMesh, p, playerPose(p), dt, t);
        this.abilities.sync(t);
        if (this.goal) {
            const { ring, core } = this.goal.mesh.userData;
            ring.rotation.y = t * 2;
            core.rotation.y = -t * 3;
            this.goal.mesh.position.y = this.goal.y + Math.sin(t * 2) * 0.1;
        }
        this.berries.forEach((b, i) => { b.mesh.position.y = b.y + Math.sin(t * 3 + i) * 0.12; b.mesh.rotation.y = t; });
        this.crystals.forEach(c => { c.mesh.rotation.y = t * 2; });
        this.springs.forEach(s => {
            s.anim = Math.max(0, s.anim - dt);
            s.mesh.userData.top.position.y = 0.4 + (s.anim > 0 ? 0.25 : 0);
            s.mesh.userData.coil.scale.y = s.anim > 0 ? 1.8 : 1;
        });
        this.flags.forEach(f => {
            f.mesh.userData.cloth.material = f.active ? E.flagOnMat : E.flagOffMat;
            f.mesh.userData.cloth.rotation.y = Math.sin(t * 4 + f.x) * 0.25;
        });
        this.enemies.forEach(e => { if (e.alive) e.sync(t, dt); });
        this.hazards.forEach(h => h.sync(t));
        this.bossHazards.forEach(h => h.sync(t));
        if (this.boss && this.boss.alive) this.boss.sync(t, dt);
        this.crumbles.forEach(c => {
            c.mesh.position.x = c.x + 0.5 + (c.timer > 0 ? (Math.random() - 0.5) * 0.08 : 0);
        });
        this.syncSpecialBlocks();
    }

    syncSpecialBlocks() {
        const warn = this.world.pulseWarning(this.clock);
        for (const block of this.specialBlocks.values()) {
            if (block.kind !== 'O' && block.kind !== 'o') continue;
            const on = block.kind === 'O' ? this.world.pulseA : !this.world.pulseA;
            const blink = warn && Math.floor(this.clock * 16) % 2 === 0;
            block.mesh.material = on ? (blink ? E.pulseWarnMat : E.pulseOnMat) : (warn ? E.pulseWarnMat : E.pulseOffMat);
            block.mesh.scale.setScalar(on ? 1 : 0.86);
        }
    }
}
