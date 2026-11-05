import { DASH_SPEED, DASH_TIME, JUMP, PH, PLAYER_HP, STAMINA_MAX } from './config.js';
import { abilityById } from './abilities.js';
import { actionCodes, keyLabel, Settings, Save } from './core.js';
import { Sfx } from './audio.js';
import * as E from './entities.js';

const DENY_TIME = 0.45;
const STAMINA_LOCK = 1.5;
const LANCE_SPEED = 30;
const SKILL_ACTIONS = ['skill1', 'skill2', 'skill3'];

const COLORS = {
    wave: 0x8fd3ff, lance: 0xfff2b0, blade: 0xff8a6b, parry: 0xffffff, shield: 0x6fe3c4,
    heal: 0x7dffa8, wind: 0xbdf0ff, focus: 0xffd166, recall: 0xc58bff, time: 0xa99bff, form: 0xffd23f
};

const rectNear = (part, x, y, r) => Math.abs(part.x - x) < part.w / 2 + r && Math.abs(part.y - y) < part.h / 2 + r;

class Ring {
    constructor(game, x, y, radius, color) {
        Object.assign(this, { game, radius, age: 0, life: 0.32, done: false });
        this.mesh = E.makeAbilityRing(color);
        this.mesh.position.set(x, y, 0.4);
        this.mesh.scale.setScalar(0.1);
        game.view.root.add(this.mesh);
    }

    update(dt) {
        this.age += dt;
        const k = Math.min(1, this.age / this.life);
        this.mesh.scale.setScalar(Math.max(0.1, this.radius * (1 - (1 - k) * (1 - k))));
        this.done = k >= 1;
    }

    dispose() {
        this.game.view.root.remove(this.mesh);
    }
}

class Lance {
    constructor(sys, x, y, dx, dy, stats) {
        Object.assign(this, { sys, game: sys.game, x, y, dx, dy, stats, travelled: 0, done: false, hit: new Set() });
        this.mesh = E.makeAbilityLance();
        this.mesh.position.set(x, y, 0.4);
        this.mesh.rotation.z = Math.atan2(dy, dx);
        this.game.view.root.add(this.mesh);
    }

    update(dt) {
        const game = this.game;
        const step = LANCE_SPEED * dt;
        this.x += this.dx * step;
        this.y += this.dy * step;
        this.travelled += step;
        this.mesh.position.set(this.x, this.y, 0.4);
        const tx = Math.floor(this.x);
        const ty = Math.floor(this.y);
        if (game.world.solid(tx, ty)) {
            if (this.stats.breaks && game.world.cell(tx, ty) === 'X') game.breakCell(tx, ty);
            else this.done = true;
            game.view.emit(this.x, this.y, COLORS.lance, 6, 3, 0.3);
            if (this.done) return;
        }
        for (const e of game.enemies) {
            if (!e.alive || this.hit.has(e)) continue;
            if (Math.abs(e.x - this.x) < e.w / 2 + 0.25 && Math.abs(e.y + e.h / 2 - this.y) < e.h / 2 + 0.25) {
                this.hit.add(e);
                this.sys.hitEnemy(e, 'ability');
            }
        }
        for (const shot of game.shots) {
            if (shot.deflect && Math.hypot(shot.x - this.x, shot.y - this.y) < 0.9) shot.deflect();
        }
        if (!this.hit.has('boss')) {
            const struck = this.sys.hitBoss(part => rectNear(part, this.x, this.y, 0.25));
            if (struck) this.hit.add('boss');
        }
        if (this.travelled >= this.stats.range) this.done = true;
    }

    dispose() {
        this.game.view.root.remove(this.mesh);
    }
}

const ACTIVATE = {
    shockwave(sys, s, p) {
        const cy = p.y + PH / 2;
        sys.addRing(p.x, cy, s.stats.radius, COLORS.wave);
        sys.strikeArea(p.x, cy, s.stats.radius);
        sys.clearShots(p.x, cy, s.stats.radius);
        if (s.stats.refund) p.dashes = sys.game.maxDashes();
        sys.game.shake(0.35);
        Sfx.wave();
    },
    light_lance(sys, s, p) {
        const input = sys.game.input;
        const up = input.y !== 0 && input.x === 0;
        const dx = up ? 0 : p.facing;
        const dy = up ? input.y : 0;
        sys.effects.push(new Lance(sys, p.x + dx * 0.4, p.y + PH / 2 + dy * 0.4, dx, dy, s.stats));
        Sfx.lance();
    },
    blade_dash(sys, s, p) {
        sys.game.view.emit(p.x, p.y + PH / 2, COLORS.blade, 16, 5, 0.5);
        Sfx.bladeOn();
    },
    riposte(sys, s, p) {
        sys.addRing(p.x, p.y + PH / 2, 1, COLORS.parry);
        Sfx.guard();
    },
    energy_shield(sys, s, p) {
        s.charges = s.stats.charges;
        sys.game.view.emit(p.x, p.y + PH / 2, COLORS.shield, 14, 3, 0.5);
        Sfx.shieldUp();
    },
    air_burst(sys, s, p) {
        if (p.onGround) return 'Só funciona no ar';
        p.vy = JUMP * s.stats.power;
        p.jumping = false;
        p.grabbing = false;
        p.groundPounding = false;
        p.dashTimer = 0;
        p.squash = 1.25;
        if (s.stats.refresh) p.doubleJumpAvailable = true;
        sys.game.view.emit(p.x, p.y, COLORS.wind, 14, 5, 0.4);
        Sfx.burst();
    },
    crystal_link(sys, s, p) {
        const target = sys.nearestCrystal(p, s.stats.range);
        if (!target) return 'Nenhum cristal ao alcance';
        const y = target.y - PH / 2;
        const dist = Math.hypot(target.x - p.x, y - p.y) || 1;
        p.dashDir = { x: (target.x - p.x) / dist, y: (y - p.y) / dist };
        p.dashTimer = dist / DASH_SPEED + 0.02;
        p.dashes = Math.min(p.dashes, sys.game.maxDashes() - 1);
        p.grabbing = false;
        p.groundPounding = false;
        p.riding = null;
        sys.game.view.emit(p.x, p.y + PH / 2, COLORS.wave, 10, 4, 0.4);
        Sfx.link();
    },
    heal(sys, s, p) {
        if (p.hp >= PLAYER_HP) return 'Vida cheia';
        p.hp = Math.min(PLAYER_HP, p.hp + s.stats.amount);
        sys.game.view.emit(p.x, p.y + PH / 2, COLORS.heal, 18, 3.5, 0.7);
        Sfx.healUp();
    },
    second_wind(sys, s, p) {
        p.stamina = STAMINA_MAX;
        sys.staminaLock = 0;
        sys.game.view.emit(p.x, p.y + PH / 2, COLORS.wind, 14, 4, 0.5);
        Sfx.burst();
    },
    focus(sys, s, p) {
        if (!sys.slots.some(o => o !== s && o.def.type === 'active')) return 'Equipe outra habilidade ativável';
        sys.game.view.emit(p.x, p.y + PH / 2, COLORS.focus, 12, 3, 0.5);
        Sfx.focusOn();
    },
    recall(sys, s, p) {
        s.marker = { x: p.x, y: p.y };
        sys.showMarker(s.marker);
        Sfx.recall();
    },
    time_dilation(sys, s, p) {
        sys.addRing(p.x, p.y + PH / 2, 8, COLORS.time);
        Sfx.slowOn();
    },
    summit_form(sys, s, p) {
        p.dashes = sys.game.maxDashes();
        sys.addRing(p.x, p.y + PH / 2, 4, COLORS.form);
        sys.game.shake(0.5);
        Sfx.formOn();
    }
};

export class AbilitySystem {
    constructor(game, equipped) {
        this.game = game;
        this.effects = [];
        this.dodgeTimer = 0;
        this.spikeGrace = 0;
        this.staminaLock = 0;
        this.slots = equipped.map(({ id, level }, index) => {
            const def = abilityById(id);
            return { index, id, def, level, stats: def.levels[level - 1], cooldown: 0, active: 0, denied: 0, pulse: 0, message: '', timer: 0, spent: false, charges: 0, marker: null, alert: false };
        });
        this.byId = new Map(this.slots.map(s => [s.id, s]));
        this.secretTargets = this.byId.has('perception') ? this.collectSecrets() : [];
        this.senseTimer = 0;
        this.mesh = {
            shield: this.addAura(E.makeAbilityAura(COLORS.shield)),
            form: this.addAura(E.makeAbilityAura(COLORS.form)),
            blade: this.addAura(E.makeAbilityAura(COLORS.blade)),
            marker: this.byId.has('recall') ? this.addAura(E.makeAbilityMarker(COLORS.recall)) : null
        };
    }

    addAura(mesh) {
        mesh.visible = false;
        this.game.view.root.add(mesh);
        return mesh;
    }

    isActive(id) {
        const s = this.byId.get(id);
        return !!s && s.active > 0;
    }

    get worldScale() {
        const s = this.byId.get('time_dilation');
        return s && s.active > 0 ? s.stats.scale : 1;
    }

    get formActive() {
        return this.isActive('summit_form');
    }

    update(dt, p) {
        const focus = this.byId.get('focus');
        const rate = focus && focus.active > 0 ? focus.stats.rate : 1;
        for (const s of this.slots) {
            s.denied = Math.max(0, s.denied - dt);
            s.pulse = Math.max(0, s.pulse - dt);
            if (s.active > 0) {
                s.active -= dt;
                if (s.active <= 0) this.finish(s);
            } else if (s.cooldown > 0) {
                s.cooldown = Math.max(0, s.cooldown - dt * (s === focus ? 1 : rate));
            }
        }
        this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
        this.spikeGrace = Math.max(0, this.spikeGrace - dt);
        this.staminaLock = Math.max(0, this.staminaLock - dt);
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const fx = this.effects[i];
            fx.update(dt);
            if (fx.done) {
                fx.dispose();
                this.effects.splice(i, 1);
            }
        }
        if (p.dead) return;
        this.updatePassives(dt, p);
        if (this.formActive) p.dashes = Math.max(p.dashes, this.game.maxDashes());
        if (this.game.finished || this.game.cutscene) return;
        this.slots.forEach((s, i) => {
            if (this.game.input.hit(...actionCodes(SKILL_ACTIONS[i]))) this.activate(s, p);
        });
    }

    updatePassives(dt, p) {
        const regen = this.byId.get('regeneration');
        if (regen && p.hp < PLAYER_HP) {
            regen.timer += dt;
            if (regen.timer >= regen.stats.interval) {
                regen.timer = 0;
                regen.pulse = 0.6;
                p.hp++;
                this.game.view.emit(p.x, p.y + PH / 2, COLORS.heal, 14, 3, 0.7);
                Sfx.healUp();
            }
        }
        const sense = this.byId.get('perception');
        if (sense) {
            this.senseTimer -= dt;
            if (this.senseTimer <= 0) {
                this.senseTimer = 0.5;
                this.sense(sense, p);
            }
        }
    }

    collectSecrets() {
        const game = this.game;
        const list = [];
        for (const [key, block] of game.specialBlocks) {
            if (block.kind !== 'X' && block.kind !== 'Y') continue;
            list.push({ key, x: block.mesh.position.x, y: block.mesh.position.y, kind: 'crack' });
        }
        for (const h of game.hazards) {
            if (h.type === 'secret') list.push({ ref: h, x: h.x + h.w / 2, y: h.y + h.h / 2, kind: 'secret' });
        }
        return list;
    }

    sense(slot, p) {
        const game = this.game;
        const r = slot.stats.radius;
        let found = false;
        for (const t of this.secretTargets) {
            if (t.kind === 'crack' && game.world.broken.has(t.key)) continue;
            if (t.kind === 'secret' && t.ref.found) continue;
            if (Math.hypot(t.x - p.x, t.y - p.y) > r) continue;
            found = true;
            game.view.emit(t.x, t.y, 0xd9c8ff, 5, 1.6, 0.7);
        }
        if (slot.stats.berries) {
            for (const b of game.berries) {
                if (b.got || Math.hypot(b.x - p.x, b.y - p.y) > r) continue;
                found = true;
                game.view.emit(b.x, b.y, 0xff8aa5, 4, 1.4, 0.6);
            }
        }
        slot.alert = found;
    }

    activate(s, p) {
        if (s.def.type !== 'active') return this.deny(s, s.def.type === 'hold' ? 'Segure Pular na queda' : 'Habilidade passiva');
        if (s.active > 0) {
            if (s.id === 'recall') return this.recallBack(s, p);
            return this.deny(s, 'Já está ativa');
        }
        if (s.cooldown > 0) return this.deny(s, 'Recarregando');
        const cost = this.isActive('second_wind') ? 0 : s.stats.cost || 0;
        if (cost > p.stamina) return this.deny(s, 'Fôlego insuficiente');
        const refusal = ACTIVATE[s.id](this, s, p);
        if (refusal) return this.deny(s, refusal);
        if (cost) {
            p.stamina -= cost;
            this.staminaLock = STAMINA_LOCK;
        }
        s.pulse = 0.35;
        const d = Save.data;
        if (d) d.abilityUses++;
        if (s.stats.duration) s.active = s.stats.duration;
        else s.cooldown = s.stats.cooldown;
        return true;
    }

    deny(s, message) {
        s.denied = DENY_TIME;
        s.message = message;
        Sfx.denied();
        return false;
    }

    finish(s) {
        s.active = 0;
        s.cooldown = s.stats.cooldown;
        s.charges = 0;
        if (s.marker) {
            s.marker = null;
            this.mesh.marker.visible = false;
        }
    }

    recallBack(s, p) {
        const m = s.marker;
        if (!m || this.game.world.hits(m.x, m.y)) return this.deny(s, 'Marca bloqueada');
        this.game.view.emit(p.x, p.y + PH / 2, COLORS.recall, 16, 4, 0.5);
        p.x = m.x;
        p.y = m.y;
        p.vx = 0;
        p.vy = 0;
        p.dashTimer = 0;
        p.grabbing = false;
        p.groundPounding = false;
        p.riding = null;
        if (s.stats.refund) p.dashes = this.game.maxDashes();
        this.game.view.emit(p.x, p.y + PH / 2, COLORS.recall, 16, 4, 0.5);
        this.game.view.follow(p.x, p.y, 0, true);
        Sfx.recall();
        this.finish(s);
        return true;
    }

    showMarker(marker) {
        this.mesh.marker.position.set(marker.x, marker.y + PH / 2, 0.2);
        this.mesh.marker.visible = true;
    }

    addRing(x, y, radius, color) {
        this.effects.push(new Ring(this.game, x, y, radius, color));
    }

    hitEnemy(e, kind) {
        const game = this.game;
        const result = e.receive(kind, game, game.player);
        if (result === 'killed') game.onEnemyKilled(e, kind, game.player);
        return result;
    }

    hitBoss(test) {
        const game = this.game;
        const b = game.boss;
        if (!b || !b.fighting) return false;
        for (const part of b.parts()) {
            if (!test(part)) continue;
            const result = b.onStrike(part, 'ability', game.player);
            if (result === 'hit' || result === 'stagger') return true;
            if (result === 'blocked') Sfx.clank();
        }
        return false;
    }

    strikeArea(x, y, r) {
        for (const e of this.game.enemies) {
            if (e.alive && Math.hypot(e.x - x, e.y + e.h / 2 - y) <= r) this.hitEnemy(e, 'ability');
        }
        this.hitBoss(part => rectNear(part, x, y, r));
    }

    clearShots(x, y, r) {
        for (const shot of this.game.shots) {
            if (shot.deflect && Math.hypot(shot.x - x, shot.y - y) <= r) shot.deflect();
            if (!shot.breakable || Math.hypot(shot.x - x, shot.y - y) > r) continue;
            shot.done = true;
            this.game.view.emit(shot.x, shot.y, shot.color, 6, 3, 0.3);
        }
    }

    nearestCrystal(p, range) {
        const game = this.game;
        const cy = p.y + PH / 2;
        let best = null;
        let bestD = range;
        for (const c of game.crystals) {
            if (c.cool > 0) continue;
            const dist = Math.hypot(c.x - p.x, c.y - cy);
            if (dist > bestD || !this.clearLine(p.x, cy, c.x, c.y)) continue;
            best = c;
            bestD = dist;
        }
        return best;
    }

    clearLine(x1, y1, x2, y2) {
        const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 3);
        for (let i = 1; i < steps; i++) {
            const k = i / steps;
            if (this.game.world.solid(Math.floor(x1 + (x2 - x1) * k), Math.floor(y1 + (y2 - y1) * k))) return false;
        }
        return true;
    }

    dashTime() {
        const s = this.byId.get('long_dash');
        return DASH_TIME * (s ? s.stats.mult : 1);
    }

    onDash() {
        const s = this.byId.get('perfect_dodge');
        if (s) this.dodgeTimer = this.dashTime() + s.stats.after;
    }

    contactKind(p) {
        if (this.formActive) return 'blade';
        return p.dashTimer > 0 && this.isActive('blade_dash') ? 'blade' : null;
    }

    hitReach(p) {
        return p.dashTimer > 0 && this.isActive('blade_dash') ? 1.8 : 1;
    }

    onKill(kind, p) {
        const s = this.byId.get('blade_dash');
        if (s && kind === 'blade' && s.stats.refund) p.dashes = this.game.maxDashes();
    }

    absorbHit(sourceX) {
        const p = this.game.player;
        if (this.formActive) return true;
        const dodge = this.byId.get('perfect_dodge');
        if (dodge && (p.dashTimer > 0 || this.dodgeTimer > 0)) {
            if (dodge.stats.refund) p.dashes = Math.max(p.dashes, 1);
            dodge.pulse = 0.4;
            this.game.view.emit(p.x, p.y + PH / 2, 0xffffff, 8, 4, 0.3);
            return true;
        }
        const guard = this.byId.get('riposte');
        if (guard && guard.active > 0) {
            this.parry(guard, p, sourceX);
            return true;
        }
        const shield = this.byId.get('energy_shield');
        if (shield && shield.active > 0 && shield.charges > 0) {
            shield.charges--;
            shield.pulse = 0.4;
            p.iframes = Math.max(p.iframes, 0.8);
            this.game.view.emit(p.x, p.y + PH / 2, COLORS.shield, 20, 5, 0.5);
            this.game.hitstop(0.05);
            Sfx.shieldHit();
            if (shield.charges === 0) this.finish(shield);
            return true;
        }
        return false;
    }

    parry(s, p, sourceX) {
        const cy = p.y + PH / 2;
        p.iframes = Math.max(p.iframes, 0.7);
        p.facing = sourceX >= p.x ? 1 : -1;
        this.addRing(p.x, cy, s.stats.radius, COLORS.parry);
        this.finish(s);
        if (s.stats.reset) s.cooldown = 0;
        s.pulse = 0.5;
        this.game.hitstop(0.1);
        this.game.shake(0.4);
        this.game.view.flash(0.25);
        Sfx.parry();
        this.strikeArea(p.x, cy, s.stats.radius);
        this.clearShots(p.x, cy, s.stats.radius);
    }

    onDamaged() {
        const regen = this.byId.get('regeneration');
        if (regen) regen.timer = 0;
    }

    surviveLethal() {
        const s = this.byId.get('last_stand');
        if (!s || s.spent) return false;
        this.spendLastStand(s);
        return true;
    }

    surviveKill(reason) {
        const s = this.byId.get('last_stand');
        if (!s || s.spent || !s.stats.spikes || reason !== 'spike') return false;
        this.spendLastStand(s);
        const p = this.game.player;
        p.vy = JUMP;
        p.jumping = false;
        this.spikeGrace = 1;
        return true;
    }

    spendLastStand(s) {
        const p = this.game.player;
        s.spent = true;
        s.pulse = 0.8;
        p.hp = 1;
        p.iframes = 2;
        this.game.hitstop(0.2);
        this.game.shake(0.7);
        this.game.view.damageFlash();
        this.game.view.emit(p.x, p.y + PH / 2, COLORS.form, 30, 7, 0.8);
        Sfx.lastStand();
    }

    firm() {
        return this.byId.has('steadfast');
    }

    extraIframes() {
        const s = this.byId.get('steadfast');
        return s ? s.stats.iframes : 0;
    }

    windScale() {
        const s = this.byId.get('steadfast');
        return s ? s.stats.wind : 1;
    }

    staminaScale() {
        return this.isActive('second_wind') ? 0 : 1;
    }

    glide(p, held, dt) {
        const s = this.byId.get('glide');
        p.gliding = false;
        if (!s || !held || p.vy >= 0 || p.grabbing || p.sliding || p.stamina <= 0) return;
        p.gliding = true;
        p.vy = Math.max(p.vy, -s.stats.fall);
        p.stamina -= s.stats.drain * dt * this.staminaScale();
        if (Math.random() < dt * 14) this.game.view.emit(p.x, p.y + PH, 0xffffff, 1, 1, 0.3);
    }

    onCheckpoint() {
        const s = this.byId.get('last_stand');
        if (s && s.stats.recharge) s.spent = false;
    }

    onBossStart() {
        const s = this.byId.get('recall');
        if (s && s.active > 0) this.finish(s);
    }

    onRespawn() {
        for (const s of this.slots) {
            s.active = 0;
            s.cooldown = 0;
            s.charges = 0;
            s.timer = 0;
            s.denied = 0;
            s.marker = null;
            s.alert = false;
        }
        if (this.mesh.marker) this.mesh.marker.visible = false;
        const stand = this.byId.get('last_stand');
        if (stand && stand.stats.recharge) stand.spent = false;
        this.dodgeTimer = 0;
        this.spikeGrace = 0;
        this.staminaLock = 0;
        this.effects.forEach(fx => fx.dispose());
        this.effects.length = 0;
    }

    sync(t) {
        const p = this.game.player;
        const place = (mesh, on, scale) => {
            mesh.visible = on && !p.dead;
            if (!mesh.visible) return;
            mesh.position.set(p.x, p.y + PH / 2, 0.2);
            mesh.scale.setScalar(scale);
        };
        place(this.mesh.shield, this.isActive('energy_shield'), 1 + Math.sin(t * 6) * 0.03);
        place(this.mesh.blade, this.isActive('blade_dash'), 0.72 + Math.sin(t * 14) * 0.05);
        place(this.mesh.form, this.formActive, 1.12 + Math.sin(t * 9) * 0.08);
        if (this.mesh.marker && this.mesh.marker.visible) this.mesh.marker.rotation.z = t * 2;
    }

    hud() {
        return this.slots.map((s, i) => {
            const total = s.stats.cooldown || 1;
            const regen = s.id === 'regeneration' && s.timer > 0;
            return {
                id: s.id,
                icon: s.def.icon,
                name: s.def.name,
                type: s.def.type,
                level: s.level,
                key: keyLabel(Settings.keys[SKILL_ACTIONS[i]][0]),
                cooldown: s.cooldown / total,
                seconds: s.cooldown,
                active: s.active > 0 ? s.active / s.stats.duration : 0,
                charge: regen ? s.timer / s.stats.interval : 0,
                spent: s.spent,
                alert: s.alert,
                pulse: s.pulse > 0,
                denied: s.denied > 0,
                message: s.denied > 0 ? s.message : '',
                armed: s.id === 'recall' && s.active > 0
            };
        });
    }
}
