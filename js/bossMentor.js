import * as E from './entities.js';
import { Boss } from './bosses.js';
import { Shot, Telegraph } from './hazards.js';
import { Sfx } from './audio.js';
import { PLAYER_HP } from './config.js';

// Mentor Corrompido: Oren, o guarda do acampamento que ensinou Kael a pular, escalar e usar o dash.
// Ele luta com os mesmos movimentos do protagonista, sem erro. Cada ataque tem aviso claro e termina
// em uma janela curta em que ele fica parado recuperando o fôlego: é ali que o golpe entra.
const DASH_SPEED = 24;
const DASH_TIME = 0.32;
const SCALE = 1.18;

const PATTERNS = [
    ['dash', 'hop', 'dash', 'pound'],
    ['dash2', 'wall', 'pound', 'dash2'],
    ['dash2', 'pound', 'wall', 'dash2', 'pound']
];

const TAUNTS = [
    'Você ainda pula atrasado, Kael. Eu te ensinei melhor.',
    'Eu te ensinei a cair. Agora aprenda a levantar.'
];

export class MentorBoss extends Boss {
    constructor(game) {
        const a = game.level.arena;
        super(game, { x: a.x2 - 5, y: a.floor }, {
            hp: 6, thresholds: [4, 2], name: 'Mentor Corrompido', title: 'Oren, que ensinou cada salto que você sabe', w: 0.9 * SCALE, h: 1.25 * SCALE
        });
        this.aim = E.makeAimLine(0xff5a2a);
        game.view.root.add(this.aim);
        this.pose = { x: this.x, y: this.y, vx: 0, vy: 0, facing: -1, dashes: 1, dashDir: { x: -1, y: 0 }, squash: 1, onGround: true, climbing: 0, iframes: 0, dead: false, hp: PLAYER_HP, casting: 0 };
        this.poseName = 'idle';
        this.pure = false;
        this.theme = 'boss_inferno';
    }

    buildMesh() {
        const m = E.makePlayer('oren');
        m.scale.setScalar(SCALE);
        return m;
    }

    onIntro() {
        this.pure = this.game.abilities.slots.length === 0;
        Sfx.roar();
        this.game.storyLine('Oren...? Você subiu antes de mim. Ninguém disse que você tinha caído até aqui.', 'Kael', 3.2);
    }

    face(p) {
        this.dir = Math.sign(p.x - this.x) || this.dir;
    }

    clampX(x) {
        const a = this.arena;
        return Math.max(a.x1 + 0.6, Math.min(a.x2 - 0.6, x));
    }

    think(dt, p) {
        const a = this.arena;
        const fast = this.phase;
        this.poseName = 'idle';
        switch (this.act) {
            case 'idle':
                this.vulnerable = false;
                this.y = a.floor;
                this.face(p);
                if (this.t > [0.75, 0.55, 0.4][fast]) this.startAct(this.nextAct(PATTERNS), p);
                break;
            case 'aim': {
                this.poseName = 'land';
                const k = this.t / this.aimTime;
                if (k < 0.7) this.lockAim(p);
                E.setAimLine(this.aim, this.x, this.y + 0.7, this.target.x, this.target.y, k < 0.7 ? 0.5 : 1.2);
                if (this.t >= this.aimTime) {
                    this.aim.visible = false;
                    Sfx.dash();
                    this.setAct('dashing');
                }
                break;
            }
            case 'dashing': {
                this.poseName = 'dash';
                this.x = this.clampX(this.x + this.dashDir.x * DASH_SPEED * dt);
                this.y = Math.max(a.floor, Math.min(a.ceil - 2, this.y + this.dashDir.y * DASH_SPEED * dt));
                if (Math.random() < dt * 40) this.game.view.emit(this.x, this.y + 0.6, 0xff5a2a, 1, 2, 0.3);
                if (this.t >= DASH_TIME) {
                    if (this.dashesLeft > 1) {
                        this.dashesLeft--;
                        this.beginAim(p, 0.38);
                    } else this.setAct('fall');
                }
                break;
            }
            case 'fall':
                this.poseName = 'fall';
                this.y = Math.max(a.floor, this.y - 16 * dt);
                if (this.y <= a.floor) this.openWindow([0.85, 0.7, 0.6][fast]);
                break;
            case 'hop': {
                this.poseName = 'jump';
                const k = Math.min(1, this.t / 0.7);
                this.x = this.from + (this.to - this.from) * k;
                this.y = a.floor + Math.sin(k * Math.PI) * 4.5;
                if (k >= 1) {
                    this.y = a.floor;
                    this.shockwave(9);
                    this.setAct('idle');
                    this.t = 0.2;
                }
                break;
            }
            case 'rise': {
                this.poseName = 'jump';
                const k = Math.min(1, this.t / 0.55);
                this.x = this.from + (this.to - this.from) * k;
                this.y = a.floor + (a.ceil - 4 - a.floor) * Math.sin(k * Math.PI / 2);
                if (k >= 1) this.setAct('hang');
                break;
            }
            case 'hang':
                this.poseName = 'pound';
                if (this.t > [0.55, 0.45, 0.35][fast]) this.setAct('slam');
                break;
            case 'slam':
                this.poseName = 'pound';
                this.y -= 34 * dt;
                if (this.y <= a.floor) {
                    this.y = a.floor;
                    this.game.shake(0.7);
                    Sfx.pound();
                    this.shockwave(10 + fast);
                    this.openWindow([1.1, 0.9, 0.75][fast]);
                }
                break;
            case 'run':
                this.poseName = 'run';
                this.x += this.dir * 11 * dt;
                if ((this.wallX - this.x) * this.dir <= 0.05) {
                    this.x = this.wallX;
                    this.setAct('climb');
                }
                break;
            case 'climb':
                this.poseName = 'climb';
                this.y = Math.min(a.floor + 7, this.y + 9 * dt);
                if (this.y >= a.floor + 7) {
                    this.dir = -this.dir;
                    this.beginAim(p, [0.6, 0.5, 0.42][fast]);
                }
                break;
            case 'window':
                this.poseName = 'land';
                if (this.t > this.windowTime) {
                    this.vulnerable = false;
                    this.setAct('idle');
                }
                break;
            case 'recover':
                this.poseName = 'hurt';
                this.y = a.floor;
                this.face(p);
                this.x = this.clampX(this.x - this.dir * 7 * dt * Math.max(0, 1 - this.t / 0.4));
                if (this.t > 0.6) this.setAct('idle');
                break;
            case 'transition':
                this.poseName = 'spin';
                this.y = a.floor;
                if (this.t < dt * 1.5) {
                    this.game.view.flash(0.5);
                    this.game.storyLine(TAUNTS[Math.min(this.phase, TAUNTS.length) - 1], 'Oren', 3);
                }
                if (this.t > 1.5) this.setAct('idle');
                break;
        }
    }

    startAct(act, p) {
        const a = this.arena;
        if (act === 'dash' || act === 'dash2') {
            this.dashesLeft = act === 'dash2' ? 2 : 1;
            this.beginAim(p, [0.7, 0.6, 0.52][this.phase]);
        } else if (act === 'hop') {
            this.from = this.x;
            this.to = this.clampX(p.x);
            this.setAct('hop');
        } else if (act === 'pound') {
            this.from = this.x;
            this.to = this.clampX(p.x);
            const warn = 0.55 + [0.55, 0.45, 0.35][this.phase];
            this.game.addStrike(new Telegraph(this.game, this.to - 1.5, a.floor, 3, 0.35, warn + 0.1));
            this.setAct('rise');
        } else if (act === 'wall') {
            this.dir = this.x - a.x1 < a.x2 - this.x ? -1 : 1;
            this.wallX = this.dir < 0 ? a.x1 + 0.45 : a.x2 - 0.45;
            this.setAct('run');
        }
    }

    beginAim(p, time) {
        this.aimTime = time;
        this.lockAim(p);
        this.setAct('aim');
    }

    lockAim(p) {
        const dx = p.x - this.x;
        const dy = p.y + 0.5 - (this.y + 0.7);
        // Só oito direções, como o dash do jogador: a linha nunca mente sobre o caminho.
        let ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        const grounded = this.y <= this.arena.floor + 0.01;
        if (grounded && Math.sin(ang) < -0.1) ang = dx >= 0 ? 0 : Math.PI;
        const x = Math.round(Math.cos(ang) * 1000) / 1000;
        const y = Math.round(Math.sin(ang) * 1000) / 1000;
        this.dashDir = { x, y };
        const reach = DASH_SPEED * DASH_TIME;
        const a = this.arena;
        this.target = {
            x: this.clampX(this.x + x * reach),
            y: Math.max(a.floor, Math.min(a.ceil - 2, this.y + y * reach)) + 0.7
        };
        this.dir = Math.sign(x) || this.dir;
        this.pose.dashDir = this.dashDir;
    }

    openWindow(time) {
        this.vulnerable = true;
        this.windowTime = time;
        this.setAct('window');
    }

    shockwave(speed) {
        for (const dir of [-1, 1]) {
            this.game.addShot(new Shot(this.game, this.x + dir * 0.9, this.floor + 0.4, dir * speed, 0, {
                r: 0.4, ground: true, color: 0xff6a3a, life: 2.6, breakable: false
            }));
        }
    }

    featEarned() {
        return this.pure ? 'mentor_pure' : null;
    }

    onRetry() {
        this.y = this.floor;
        this.aim.visible = false;
        this.dashesLeft = 0;
    }

    dyingPoint() {
        return { x: this.x, y: this.y + 0.8 };
    }

    sync(t, dt) {
        const pose = this.pose;
        pose.x = this.x;
        pose.y = this.y;
        pose.facing = this.dir;
        pose.onGround = this.y <= this.floor + 0.01;
        pose.vy = this.act === 'slam' || this.act === 'fall' ? -10 : this.act === 'rise' || this.act === 'hop' ? 6 : 0;
        pose.climbing = this.act === 'climb' ? 1 : 0;
        // Os ferimentos aparecem no corpo dele conforme a vida cai, como no protagonista.
        pose.hp = 1 + Math.round((PLAYER_HP - 1) * (this.hp / this.maxHp));
        pose.iframes = this.hitFlash;
        const name = this.mode === 'dying' ? 'hurt' : this.mode === 'intro' ? 'idle' : this.poseName;
        E.animatePlayer(this.mesh, pose, name, dt || 1 / 60, t);
        this.mesh.position.set(this.x, this.y, 0.05);
        if (this.mode === 'dying') this.mesh.scale.setScalar(SCALE * (1 - Math.min(1, this.modeT / 2.6) * 0.3));
    }

    dispose() {
        this.game.view.root.remove(this.aim);
        this.aim.material.dispose();
        E.disposePlayer(this.mesh);
    }
}
