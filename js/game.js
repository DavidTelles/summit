import { LEVELS } from './levels.js';
import { Input, ACHIEVEMENTS, Save, SKILLS, chapterOfLevel, roomKey } from './core.js';
import { TOTAL_SECRETS } from './campaign.js';
import { REALMS, realmOfChapter } from './realms.js';
import { ABILITIES, isLevelDone } from './abilities.js';
import { ROOMS, arrivalAt, doorsOf, isMain } from './worldMap.js';
import { AbilitySystem } from './abilitySystem.js';
import { Sfx } from './audio.js';
import * as E from './entities.js';
import { STEP, MAX_STEPS_PER_FRAME, STAMINA_MAX, PW, PH, IFRAMES, POUND_RADIUS, DEATH_TIME, PLAYER_HP } from './config.js';
import { World } from './world.js';
import { createPlayer, resetPlayerMotion, updatePlayer, playerPose } from './player.js';
import { createHazard, isHazardDef, overlap } from './hazards.js';
import { createEnemy, isEnemyDef } from './enemies.js';
import { createBoss } from './bossRoster.js';
import { LEVEL_STORY, RECORDS, TOTAL_RECORDS, recordById, recordsFound } from './story.js';
import { animateMerchant, makeDecor, makeMerchant, makeRecordStone } from './decor.js';
import { createAftermath } from './aftermath.js';
import { MERCHANT_NAME, REWARDS, merchantIn } from './shop.js';

// Tempo entre tocar uma passagem e a troca de sala (o véu escurece nesse intervalo).
const COMPLETE_DELAY = 0.3;
const PASSAGE_OPEN_TIME = 0.9;
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

    // resume: { x, y, time?, hp?, face?, door? }. Com `door`, o jogador chegou por uma passagem.
    load(index, resume = null) {
        if (this.boss && this.boss.dispose) this.boss.dispose();
        this.boss = null;
        this.levelIndex = index;
        const level = ROOMS[index];
        this.level = level;
        this.grid = level.grid;
        E.setChapterArt(level.chapter);
        this.view.build(level);
        this.view.deathVeil(false);
        this.world = new World(this.grid);
        this.firstVisit = this.markVisited(index);
        this.lastStandSpent = false;
        this.lockNotice = 0;
        this.time = resume && resume.time ? resume.time : 0;
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
        this.levelHurt = false;
        this.airKills = 0;
        this.aftermath = null;
        this.storyTimers = [];
        this.newAbilities = [];
        this.buildEntities(resume);
        this.abilities = new AbilitySystem(this, Save.equippedAbilities());
        this.running = true;
        this.pushHud();
    }

    // Troca as habilidades equipadas no meio da fase (inventário em jogo). Recargas e efeitos ativos
    // das habilidades que continuam equipadas são mantidos; Última Chance gasta continua gasta.
    setLoadout(equipped = Save.equippedAbilities()) {
        const old = this.abilities;
        if (!old) return;
        const stand = old.byId.get('last_stand');
        if (stand && stand.spent) this.lastStandSpent = true;
        const next = new AbilitySystem(this, equipped);
        for (const s of next.slots) {
            const prev = old.byId.get(s.id);
            if (prev) {
                for (const key of ['cooldown', 'active', 'charges', 'timer', 'spent', 'marker', 'alert']) s[key] = prev[key];
            } else if (s.id === 'last_stand') {
                s.spent = this.lastStandSpent;
            }
        }
        next.dodgeTimer = old.dodgeTimer;
        next.spikeGrace = old.spikeGrace;
        next.staminaLock = old.staminaLock;
        const recall = next.byId.get('recall');
        if (recall && recall.marker && recall.active > 0) next.showMarker(recall.marker);
        old.dispose();
        this.abilities = next;
        if (this.boss && this.boss.alive && this.boss.mode !== 'idle' && next.slots.length) this.boss.pure = false;
        this.pushHud();
    }

    // Marca a sala como visitada no save. Retorna true na primeira visita.
    markVisited(index) {
        const d = Save.data;
        if (!d || d.world.visited[index]) return false;
        d.world.visited[index] = true;
        Save.save();
        return true;
    }

    // Sala já vencida: a lava que sobe fica parada para permitir voltar por ela.
    roomSettled(index = this.levelIndex) {
        const d = Save.data;
        return !!d && isMain(index) && isLevelDone(d, index);
    }

    savedKey(kind, x, y) {
        const d = Save.data;
        return !!d && !!d.world[kind][roomKey(this.levelIndex, x, y)];
    }

    keepKey(kind, x, y) {
        const d = Save.data;
        if (!d) return;
        d.world[kind][roomKey(this.levelIndex, x, y)] = true;
        Save.save();
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
                    this.totalBerries++;
                    // Morangos coletados ficam coletados: no mundo aberto eles não voltam.
                    if (this.savedKey('collected', x, y)) {
                        this.levelBerries++;
                        continue;
                    }
                    const mesh = E.makeBerry();
                    mesh.position.set(x + 0.5, y + 0.5, 0);
                    root.add(mesh);
                    this.berries.push({ x: x + 0.5, y: y + 0.5, tx: x, ty: y, got: false, mesh });
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
        const settled = this.roomSettled();
        const d = Save.data;
        for (const raw of this.level.objects || []) {
            const def = raw.type === 'lava' && raw.rise && settled ? { ...raw, rise: 0 } : raw;
            if (isHazardDef(def)) {
                const h = createHazard(def, root, this.world);
                if (def.type === 'secret' && d && d.secrets[`${this.levelIndex}:${def.id || 0}`]) h.found = true;
                this.hazards.push(h);
                if (def.type === 'mover') this.world.solids.push(h);
            } else if (isEnemyDef(def)) {
                this.enemies.push(createEnemy(def.type, def, root));
            }
        }
        this.restoreBroken();
        this.buildDoors();
        this.setupArena();
        this.buildStory();
        this.buildMerchant();
        const origin = resume ? { x: resume.x, y: resume.y } : start;
        this.player = createPlayer(origin.x, origin.y);
        this.player.dashes = this.maxDashes();
        if (resume && resume.hp > 0) this.player.hp = Math.min(PLAYER_HP, resume.hp);
        if (resume && resume.face) this.player.facing = resume.face;
        this.spawn = { ...origin };
        // O renascimento segue o checkpoint salvo quando ele fica nesta sala.
        const cp = d && d.checkpoint;
        if (cp && cp.level === this.levelIndex) this.spawn = { x: cp.x, y: cp.y };
        const active = cp && cp.level === this.levelIndex ? cp : resume;
        if (active) this.flags.forEach(f => { f.active = f.x === active.x && f.y === active.y; });
        if (this.playerMesh) E.disposePlayer(this.playerMesh);
        this.playerMesh = E.makePlayer(Save.data ? Save.data.skins.equipped : undefined);
        root.add(this.playerMesh);
        this.view.setBounds(null);
        this.view.camPos.set(origin.x, origin.y);
        this.view.follow(origin.x, origin.y, 0, true);
    }

    // Paredes rachadas e pisos quebrados continuam quebrados (atalhos e entradas do mundo aberto).
    restoreBroken() {
        const d = Save.data;
        if (!d) return;
        const prefix = `${this.levelIndex}:`;
        for (const k of Object.keys(d.world.broken)) {
            if (!k.startsWith(prefix)) continue;
            const [tx, ty] = k.slice(prefix.length).split(',').map(Number);
            const key = this.world.key(tx, ty);
            this.world.broken.add(key);
            const block = this.specialBlocks.get(key);
            if (block) block.mesh.visible = false;
        }
    }

    buildDoors() {
        this.doors = [];
        this.goal = null;
        for (const def of doorsOf(this.levelIndex)) {
            if (def.arrival) continue;
            // Depois de zerar, o fim do Trono do Alto não leva a lugar nenhum.
            if (def.exit && !def.to && Save.data && Save.data.cleared) continue;
            const door = { def, x: def.x, y: def.y, kind: def.kind, lift: 1, opening: 0, mesh: null };
            door.locked = this.doorLock(def);
            if (door.kind === 'arch') {
                door.mesh = E.makePassage();
                door.mesh.position.set(def.x, def.y, -0.4);
                this.view.root.add(door.mesh);
            }
            door.lift = door.locked ? 0 : 1;
            if (door.mesh) E.setPassageLift(door.mesh, door.lift);
            this.doors.push(door);
            if (def.exit) this.goal = door;
        }
    }

    // Motivo de a passagem estar fechada, ou null quando ela está aberta.
    doorLock(def) {
        const lock = def.lock;
        if (!lock) return null;
        const d = Save.data;
        if (lock.skill && !this.hasSkill(lock.skill)) return lock.text;
        if (lock.opened && !(d && d.world.opened[lock.opened])) return lock.text;
        return null;
    }

    setDoorOpen(door, open, animate = false) {
        door.locked = open ? null : door.locked || 'Fechada.';
        if (!door.mesh) {
            door.lift = open ? 1 : 0;
            return;
        }
        if (open && animate) {
            door.opening = PASSAGE_OPEN_TIME;
            return;
        }
        door.opening = 0;
        door.lift = open ? 1 : 0;
        E.setPassageLift(door.mesh, door.lift);
    }

    get bossBeaten() {
        const d = Save.data;
        return !!(d && this.level.boss && d.achievements[this.level.boss]);
    }

    setupArena() {
        const a = this.level.arena;
        this.gate = null;
        if (!a || !this.level.boss) return;
        // Chefe já derrotado neste save: a arena fica vazia e a passagem, aberta. Pisos que o
        // próprio chefe criava (lajes do Guardião) ficam montados, como logo depois da vitória.
        if (this.bossBeaten) {
            for (const def of a.slabs || []) {
                const mesh = E.makeBossSlab(def.w, def.h);
                mesh.position.set(def.x + def.w / 2, def.y + def.h / 2, 0);
                this.view.root.add(mesh);
                this.world.solids.push({ x: def.x, y: def.y, w: def.w, h: def.h, active: true });
            }
            return;
        }
        this.gate = { x: a.gateX, y: a.floor, w: 1, h: a.ceil - a.floor, active: false };
        this.gate.mesh = E.makeGate(this.gate.h);
        this.gate.mesh.position.set(this.gate.x + 0.5, this.gate.y, 0);
        this.gate.mesh.visible = false;
        this.view.root.add(this.gate.mesh);
        this.world.solids.push(this.gate);
        this.boss = createBoss(this, this.level.boss);
        if (this.goal) {
            this.goal.locked = 'O caminho só abre quando o guardião cair.';
            this.setDoorOpen(this.goal, false);
        }
    }

    buildStory() {
        const d = Save.data;
        const story = LEVEL_STORY[this.levelIndex] || { decor: [], moments: [] };
        const ctx = { final: !!(d && d.story.scenes.final) };
        for (const [kind, x, y] of story.decor) {
            const mesh = makeDecor(kind, ctx);
            mesh.position.set(x, y, -0.72);
            this.view.root.add(mesh);
        }
        this.recordStones = [];
        for (const r of RECORDS.filter(r => r.level === this.levelIndex && !r.auto)) {
            if (d && d.story.records[r.id]) continue;
            const mesh = makeRecordStone();
            mesh.position.set(r.at[0], r.at[1], 0.2);
            this.view.root.add(mesh);
            this.recordStones.push({ id: r.id, x: r.at[0], y: r.at[1], got: false, mesh });
        }
        this.moments = story.moments.filter(m => !d || !d.story.moments[this.momentKey(m)]);
    }

    // Mascate: um por reino, logo na entrada. ↑ perto dele abre a loja.
    buildMerchant() {
        const def = merchantIn(this.levelIndex);
        if (this.merchant && this.merchant.near && this.hooks.onMerchantNear) this.hooks.onMerchantNear(false);
        this.merchant = null;
        if (!def) return;
        const mesh = makeMerchant();
        mesh.position.set(def.x, def.y, -0.25);
        this.view.root.add(mesh);
        this.merchant = { x: def.x, y: def.y, mesh, near: false };
    }

    updateMerchant(p, cx, cy) {
        const m = this.merchant;
        if (!m) return;
        const near = !p.dead && !this.finished && overlap(cx, cy, PW, PH, m.x, m.y + 0.9, 2.6, 1.8);
        if (near !== m.near) {
            m.near = near;
            if (this.hooks.onMerchantNear) this.hooks.onMerchantNear(near);
            if (near && Save.sawMoment('merchant:intro')) {
                this.storyLine('Ei, viajante! Cacos de Éter compram mapas, bússolas e pedras de viagem. Chegue perto e aperte ↑.', MERCHANT_NAME, 5);
            }
        }
        if (!near || !p.onGround || this.inBossFight()) return;
        if (this.input.hit('ArrowUp', 'KeyW') && this.hooks.onMerchant) {
            p.vx = 0;
            this.hooks.onMerchant();
        }
    }

    inBossFight() {
        const b = this.boss;
        return !!(b && b.alive && b.mode !== 'idle' && b.mode !== 'dying');
    }

    // Cacos de Éter: a carteira da loja. O HUD pisca a cada ganho.
    earnShards(n, x, y) {
        if (!Save.earn(n)) return;
        if (x !== undefined) this.view.emit(x, y, 0x9fe8ff, 6 + n, 4, 0.6);
        if (this.hooks.onShards) this.hooks.onShards(n);
    }

    momentKey(m) {
        return `${this.levelIndex}:${m.id}`;
    }

    updateStory(p, dt, cx, cy) {
        for (let i = this.storyTimers.length - 1; i >= 0; i--) {
            const timer = this.storyTimers[i];
            timer.t -= dt;
            if (timer.t <= 0) {
                this.storyTimers.splice(i, 1);
                this.storyLine(timer.text, timer.who);
            }
        }
        for (const r of this.recordStones) {
            if (!r.got && overlap(cx, cy, PW, PH, r.x, r.y, 1, 1.1)) this.collectRecord(r);
        }
        for (let i = this.moments.length - 1; i >= 0; i--) {
            const m = this.moments[i];
            if (p.x < m.x1 || p.x > m.x2) continue;
            if (m.y1 !== undefined && (p.y < m.y1 || p.y > m.y2)) continue;
            this.moments.splice(i, 1);
            this.fireMoment(m);
        }
    }

    fireMoment(m) {
        Save.sawMoment(this.momentKey(m));
        // Lições do tutorial usam um canal próprio para não cortar as falas da história.
        if (m.hint) {
            if (this.hooks.onHint) this.hooks.onHint(m.line, m.who || 'Lição de Oren');
            return;
        }
        this.storyLine(m.line, m.who || 'Kael');
        if (m.then) this.storyTimers.push({ t: 4.2, text: m.then, who: 'Kael' });
        if (m.shake) {
            this.shake(m.shake);
            Sfx.pound();
        }
        if (m.dim) this.view.setDim(m.dim);
        if (m.record) this.grantRecord(m.record);
    }

    storyLine(text, who, duration) {
        if (this.hooks.onStoryLine) this.hooks.onStoryLine(text, who, duration);
    }

    collectRecord(stone) {
        stone.got = true;
        this.player.casting = 0.35;
        stone.mesh.visible = false;
        this.view.emit(stone.x, stone.y, 0x6fcfff, 26, 5, 0.8);
        this.grantRecord(stone.id);
        this.earnShards(REWARDS.record, stone.x, stone.y);
    }

    grantRecord(id) {
        if (!Save.discoverRecord(id)) return;
        Sfx.record();
        if (this.hooks.onRecord) this.hooks.onRecord(recordById(id));
        if (recordsFound(Save.data) >= TOTAL_RECORDS) this.unlock('all_records');
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
            shards: Save.data ? Save.data.shards : 0,
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
        this.levelHurt = true;
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
            Save.chapterDeath(ch);
            Save.save();
        }
        if (this.boss && this.boss.fighting) this.bossDamageTaken = true;
        Sfx.die();
        this.shake(0.8);
        this.view.emit(p.x, p.y + 0.6, 0xffffff, 14, 7, 0.35);
        this.view.emit(p.x, p.y + 0.6, 0xff5a5a, 10, 4, 0.5);
        this.view.deathVeil(true);
        this.deathMotes = 0;
        this.levelHurt = true;
        this.airKills = 0;
        if (d) {
            if (d.mode === 'permadeath') {
                this.permadeathPending = true;
                this.flushPlaytime();
                if (this.hooks.onPermadeathCommit) this.hooks.onPermadeathCommit();
            }
        }
    }

    respawn() {
        const d = Save.data;
        const cp = d && d.checkpoint;
        // O último checkpoint ficou em outra sala: renasce lá, com a sala recarregada.
        if (cp && cp.level !== this.levelIndex) {
            this.running = false;
            const resume = { x: cp.x, y: cp.y, time: cp.time };
            if (this.hooks.onRespawnElsewhere) this.hooks.onRespawnElsewhere(cp.level, resume);
            else this.load(cp.level, resume);
            return;
        }
        const p = this.player;
        p.x = this.spawn.x;
        p.y = this.spawn.y;
        resetPlayerMotion(p, this.maxDashes());
        this.abilities.onRespawn();
        this.playerMesh.visible = true;
        this.view.deathVeil(false);
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
        for (const door of this.doors) {
            if (door.opening <= 0) continue;
            door.opening = Math.max(0, door.opening - dt);
            door.lift = 1 - door.opening / PASSAGE_OPEN_TIME;
        }
        this.abilities.update(dt, p);
        if (p.dead) {
            p.deadTimer -= dt;
            const elapsed = DEATH_TIME - p.deadTimer;
            if (this.deathMotes === 0 && elapsed > 0.3) {
                this.deathMotes = 1;
                this.view.emit(p.x, p.y + 0.7, 0xbfefff, 24, 2.2, 1.1);
            } else if (this.deathMotes === 1 && elapsed > 0.55) {
                this.deathMotes = 2;
                this.view.emit(p.x, p.y + 1.1, 0x7fe3ff, 16, 3, 0.9);
            }
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
        if (p.onGround) this.airKills = 0;
        if (!p.dead) this.updateWorld(p, dt, worldDt);
        this.updateProjectiles(worldDt, p);
        this.updateBoss(p, worldDt);
        if (this.aftermath && !this.aftermath.done) this.aftermath.update(dt);
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
        this.updateStory(p, dt, cx, cy);
        this.updateMerchant(p, cx, cy);
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
                    if (d.crystals >= 100) this.unlock('crystal_100');
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
            }
        }
        for (const f of this.flags) {
            if (!f.active && overlap(cx, cy, PW, PH, f.x, f.y + 0.8, 1.2, 1.8)) this.activateFlag(f, p);
        }
        for (const cr of this.crumbles) this.updateCrumble(cr, p, dt);
        this.updateEnemies(p, worldDt);
        if (p.dead) return;
        this.updateDoors(p, cx, cy, dt);
    }

    doorTouched(door, cx, cy) {
        if (door.kind === 'drop') {
            const def = door.def;
            return overlap(cx, cy, PW, PH, def.x + def.w / 2, def.y + def.h / 2, def.w, def.h);
        }
        return overlap(cx, cy, PW, PH, door.x, door.y + 1, 1.4, 2);
    }

    updateDoors(p, cx, cy, dt) {
        this.lockNotice = Math.max(0, this.lockNotice - dt);
        if (this.finished) return;
        for (const door of this.doors) {
            if (!this.doorTouched(door, cx, cy)) continue;
            if (door.locked || door.opening > 0) {
                if (this.lockNotice <= 0 && door.locked) {
                    this.lockNotice = 4;
                    if (this.hooks.onDoorLocked) this.hooks.onDoorLocked(door.locked);
                }
                continue;
            }
            if (this.boss && this.boss.alive && door.def.exit) continue;
            this.enterDoor(door);
            return;
        }
    }

    // Atravessar uma passagem. A saída de uma fase principal também registra a conclusão dela.
    enterDoor(door) {
        const def = door.def;
        const d = Save.data;
        if (def.opens && d && !d.world.opened[def.opens]) {
            d.world.opened[def.opens] = true;
            Save.save();
        }
        if (def.exit && isMain(this.levelIndex)) {
            this.complete(door);
            return;
        }
        this.finished = true;
        Sfx.check();
        this.completeResult = { travel: true, index: this.levelIndex, name: this.level.name, chapter: this.level.chapter, door: def.id, target: def.to, newAbilities: [] };
        this.completeTimer = COMPLETE_DELAY;
    }

    // Leva o jogador para o outro lado de uma passagem ({ room, door }), mantendo a vida.
    arrive(target) {
        const spot = arrivalAt(target);
        const hp = this.player && !this.player.dead ? this.player.hp : PLAYER_HP;
        const fromX = this.player ? this.player.x : 0;
        const to = ROOMS[target.room];
        const face = spot && spot.x < to.grid.w / 2 ? 1 : -1;
        this.load(target.room, spot ? { x: spot.x, y: spot.y, hp, face, door: target.door, fromX } : null);
    }

    // O jogador está descansando em um checkpoint (permite viajar pelo mapa).
    atFlag() {
        const p = this.player;
        if (!p || p.dead || this.finished) return null;
        const cx = p.x;
        const cy = p.y + PH / 2;
        return this.flags.find(f => overlap(cx, cy, PW, PH, f.x, f.y + 0.8, 1.6, 1.8)) || null;
    }

    collectBerry(b) {
        b.got = true;
        b.mesh.visible = false;
        this.levelBerries++;
        if (b.tx !== undefined) this.keepKey('collected', b.tx, b.ty);
        Sfx.berry();
        this.view.emit(b.x, b.y, 0xff2d55, 20, 6, 0.7);
        const d = Save.data;
        if (d) {
            d.berries++;
            Save.save();
            if (d.berries >= 100) this.unlock('berry_100');
            this.syncProgress();
        }
        this.earnShards(REWARDS.berry, b.x, b.y);
    }

    activateFlag(f, p) {
        p.casting = 0.35;
        this.flags.forEach(o => { o.active = false; });
        f.active = true;
        this.spawn = { x: f.x, y: f.y };
        p.hp = PLAYER_HP;
        Sfx.check();
        this.view.emit(f.x, f.y + 1.3, 0x3ddc84, 20, 5, 0.7);
        const d = Save.data;
        // Cada checkpoint é um save e vira um ponto de viagem no mapa.
        if (d) d.world.flags[roomKey(this.levelIndex, f.x, f.y)] = { level: this.levelIndex, x: f.x, y: f.y };
        this.saveCheckpoint(f.x, f.y);
        this.abilities.onCheckpoint();
        this.lastStandSpent = false;
        if (this.hooks.onCheckpoint) this.hooks.onCheckpoint();
    }

    // No mundo aberto vale sempre o último checkpoint tocado, em qualquer sala.
    saveCheckpoint(x, y) {
        const d = Save.data;
        if (!d) return;
        d.checkpoint = { level: this.levelIndex, x, y, time: this.time };
        this.flushPlaytime();
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
        this.view.slash(e.x, e.y + e.h / 2, p.dashTimer > 0 ? Math.atan2(p.dashDir.y, p.dashDir.x) : -0.6, 0xfff2d0);
        this.hitstop(0.06);
        this.shake(0.4);
        Sfx.stomp();
        const d = Save.data;
        if (d) {
            d.stomps++;
            Save.save();
            if (d.stomps >= 100) this.unlock('stomp_100');
            this.syncProgress();
        }
        this.earnShards(REWARDS.enemy, e.x, e.y + e.h / 2);
        this.abilities.onKill(kind, p);
        if (!p.onGround && ++this.airKills >= 3) this.unlock('air_chain');
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
        this.view.slash(p.x, p.y + PH / 2, p.dashTimer > 0 ? Math.atan2(p.dashDir.y, p.dashDir.x) : -0.6, result === 'blocked' ? 0xbfd0e0 : 0xffe2a8, result === 'blocked' ? 0.7 : 1.3);
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
        this.keepKey('broken', tx, ty);
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
        if (d && Object.keys(d.secrets).length >= TOTAL_SECRETS) this.unlock('secrets_all');
        this.syncProgress();
        if (this.hooks.onSecret) this.hooks.onSecret(secret.label || 'Área secreta encontrada');
    }

    updateProjectiles(dt, p) {
        for (const list of [this.shots, this.strikes]) {
            for (let i = list.length - 1; i >= 0; i--) {
                const item = list[i];
                if (!item) continue;
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
        Sfx.setTheme(b.theme || 'boss');
    }

    bossFightStarted() {
        this.cutscene = false;
        this.bossBarChanged();
    }

    bossStatus(text, shielded = false) {
        this.hooks.onBossStatus && this.hooks.onBossStatus(text, shielded);
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
            // A passagem para a próxima região se abre: a laje sobe devagar.
            this.setDoorOpen(this.goal, true, true);
            this.view.emit(this.goal.x, this.goal.y + 1, 0xffd23f, 50, 8, 1.2);
            this.shake(0.35);
        }
        Sfx.win();
        Sfx.setTheme(this.level.chapter);
        this.hooks.onBossEnd && this.hooks.onBossEnd();
        // O chefe paga cacos só na primeira vitória (a conquista marca isso).
        const firstWin = Save.data && !Save.data.achievements[this.level.boss];
        this.unlock(this.level.boss);
        if (firstWin) this.earnShards(REWARDS.boss, this.player.x, this.player.y + 1);
        if (!this.bossDamageTaken) this.unlock('boss_nodmg');
        const feat = this.boss.featEarned && this.boss.featEarned();
        if (feat) this.unlock(feat);
        const a = this.level.arena;
        const end = this.boss.dyingPoint();
        let restX = Math.max(a.x1 + 3, Math.min(a.x2 - 3, end.x));
        if (this.goal && Math.abs(restX - this.goal.x) < 5) restX = this.goal.x - 6;
        this.aftermath = createAftermath(this, this.level.boss, restX, a.floor);
        if (!this.aftermath && this.hooks.onBossEpilogue) this.hooks.onBossEpilogue();
    }

    // Conquistas de conclusão de fase e capítulo. `cleanChapter`: capítulo jogado em sequência sem morrer.
    unlockCompletion(i, ch, lastOfChapter, cleanChapter) {
        const d = Save.data;
        if (i === 0) this.unlock('first_steps');
        if (i === 0 && this.time < 40) this.unlock('speed');
        if (realmOfChapter(ch) === 'inferno' && !this.levelHurt) this.unlock('unscathed');
        if (d && this.chapterHarvested(d, ch)) this.unlock('berry_chapter');
        if (!lastOfChapter || !d) return;
        if (!d.completedChapters.includes(ch)) d.completedChapters.push(ch);
        this.unlock('chapter_done');
        if (cleanChapter) this.unlock('no_death_chapter');
        if (ch === 3) {
            this.unlock('summit');
            if (d.mode === 'permadeath') this.unlock('iron_mountain');
        }
        if (ch === 4) this.unlock('inferno_gate');
        if (ch === 5) this.unlock('sky_reached');
        const mountain = REALMS.montanha.chapters;
        if (d.deaths === 0 && mountain.every(c => d.completedChapters.includes(c))) this.unlock('no_death_all');
    }

    chapterHarvested(d, ch) {
        return LEVELS.every((level, index) => {
            if (level.chapter !== ch) return true;
            const total = level.grid.cells.flat().filter(c => c === 'S').length;
            return !!d.best[index] && d.best[index].berries >= total;
        });
    }

    // Saída de uma fase principal. Registra a conclusão (sem tela de resultado) e agenda a troca de sala.
    complete(door = this.goal) {
        this.finished = true;
        const i = this.levelIndex;
        const ch = this.level.chapter;
        const d = Save.data;
        const firstClear = !d || !isLevelDone(d, i);
        if (firstClear) Sfx.win();
        else Sfx.check();
        let record = false;
        if (d) {
            d.unlocked = Math.max(d.unlocked, Math.min(LEVELS.length, i + 2));
            const prev = d.best[i];
            record = !prev || this.time < prev.time;
            d.best[i] = {
                time: record ? this.time : prev.time,
                berries: Math.max(this.levelBerries, prev ? prev.berries : 0)
            };
            this.flushPlaytime();
        }
        if (door) this.view.emit(door.x, door.y + 1, 0xffd23f, 60, 8, 1.2);
        const lastOfChapter = i === LEVELS.length - 1 || LEVELS[i + 1].chapter !== ch;
        const run = d && d.skins.run;
        const cleanChapter = lastOfChapter && !!run && run.next === i && run.clean;
        this.unlockCompletion(i, ch, lastOfChapter, cleanChapter);
        const skin = d ? Save.finishRunLevel(i, lastOfChapter) : null;
        const realmChanged = d ? Save.syncRealm() : false;
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
            newAbilities: this.newAbilities,
            skin,
            realmChanged,
            realm: d ? d.realm : realmOfChapter(ch),
            firstClear,
            door: door ? door.def.id : null,
            target: door ? door.def.to : null
        };
        this.completeTimer = COMPLETE_DELAY;
    }

    fireComplete() {
        this.running = false;
        const hook = this.hooks.onDoor || this.hooks.onComplete;
        if (hook) hook(this.completeResult);
    }

    followCamera(dt) {
        const p = this.player;
        if (this.boss && this.cutscene && this.boss.mode === 'intro') {
            this.view.follow(this.boss.x, this.boss.y + 1, dt, false, true);
            return;
        }
        if (this.aftermath && !this.aftermath.done) {
            this.view.follow(this.aftermath.focus.x, this.aftermath.focus.y, dt, false, true);
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
        for (const door of this.doors) {
            if (!door.mesh) continue;
            if (door.mesh.userData.lift !== door.lift) {
                E.setPassageLift(door.mesh, door.lift);
                if (door.opening > 0 && Math.random() < 0.5) this.view.emit(door.x + (Math.random() - 0.5) * 1.4, door.y + 0.1, 0xbfb6a6, 1, 2, 0.4);
            }
            E.animatePassage(door.mesh, t);
        }
        this.berries.forEach((b, i) => { b.mesh.position.y = b.y + Math.sin(t * 3 + i) * 0.12; E.animateBerry(b.mesh, t, i); });
        this.crystals.forEach(c => { E.animateCrystal(c.mesh, t); });
        this.recordStones.forEach(r => {
            r.mesh.position.y = r.y + Math.sin(t * 1.8) * 0.08;
            r.mesh.userData.halo.rotation.z = t;
        });
        if (this.merchant) animateMerchant(this.merchant.mesh, t, this.player.x - this.merchant.x, this.merchant.near);
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
