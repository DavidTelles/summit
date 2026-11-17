import { Boss } from './bosses.js';
import { Shot, Telegraph } from './hazards.js';
import { Sfx } from './audio.js';
import { animateHerald, makeHerald } from './skyArt.js';

// Arauto do Alto: paira fora de alcance e julga de longe. Colunas de luz e rajadas são avisadas;
// o único momento em que ele toca o chão é depois do mergulho, e é ali que o golpe entra.
const HOVER = 8;
const GOLD = 0xffe08a;
const COLUMN = 2;

const PATTERNS = [
    ['pillars', 'dive', 'volley', 'dive'],
    ['volley', 'pillars', 'dive', 'pillars', 'dive'],
    ['pillars', 'volley', 'dive', 'dive', 'volley', 'dive']
];

const VERDICTS = [
    'O Fundo devolveu você inteiro. O Alto não devolve.',
    'Olhamos antes da sua montanha ter nome. Pare de subir.'
];

export class HeraldBoss extends Boss {
    constructor(game) {
        const a = game.level.arena;
        super(game, { x: a.x2 - 6, y: a.floor + HOVER }, {
            hp: 6, thresholds: [4, 2], name: 'Arauto do Alto', title: 'A voz do que olha de cima', w: 2, h: 3.2
        });
        this.theme = 'boss_ceu';
    }

    buildMesh() {
        return makeHerald();
    }

    onIntro() {
        Sfx.roar();
        this.game.storyLine('Tantos olhos. E nenhum deles piscou desde que saí do Fundo.', 'Kael', 3.2);
    }

    get hoverY() {
        return this.floor + HOVER;
    }

    clampX(x) {
        const a = this.arena;
        return Math.max(a.x1 + 1.5, Math.min(a.x2 - 1.5, x));
    }

    think(dt, p) {
        const fast = this.phase;
        switch (this.act) {
            case 'idle':
                this.vulnerable = false;
                this.y += (this.hoverY - this.y) * Math.min(1, dt * 4);
                this.x += (this.clampX(p.x) - this.x) * Math.min(1, dt * 0.8);
                this.dir = Math.sign(p.x - this.x) || this.dir;
                if (this.t > [0.9, 0.7, 0.55][fast]) this.startAct(this.nextAct(PATTERNS), p);
                break;
            case 'pillars':
                if (this.t >= 0.45) {
                    this.firePillars(p);
                    this.setAct('idle');
                }
                break;
            case 'volley':
                if (this.t >= 0.6) {
                    this.fireVolley(p);
                    this.setAct('idle');
                }
                break;
            case 'mark':
                this.x += (this.to - this.x) * Math.min(1, dt * 7);
                if (this.t >= this.markTime) {
                    this.x = this.to;
                    Sfx.dash();
                    this.setAct('divefall');
                }
                break;
            case 'divefall':
                this.y -= 30 * dt;
                if (this.y <= this.floor) {
                    this.y = this.floor;
                    this.game.shake(0.7);
                    Sfx.pound();
                    this.shockwave(9 + fast);
                    this.vulnerable = true;
                    this.windowTime = [1.5, 1.25, 1.05][fast];
                    this.setAct('window');
                }
                break;
            case 'window':
                if (this.t > this.windowTime) {
                    this.vulnerable = false;
                    this.setAct('idle');
                }
                break;
            case 'recover':
                if (this.t > 0.5) this.setAct('idle');
                break;
            case 'transition':
                this.y += (this.hoverY - this.y) * Math.min(1, dt * 4);
                if (this.t < dt * 1.5) {
                    this.game.view.flash(0.5);
                    this.game.storyLine(VERDICTS[Math.min(this.phase, VERDICTS.length) - 1], 'Arauto', 3);
                }
                if (this.t > 1.5) this.setAct('idle');
                break;
        }
    }

    startAct(act, p) {
        if (act !== 'dive') return;
        this.to = this.clampX(p.x);
        this.markTime = [0.95, 0.8, 0.68][this.phase];
        this.game.addStrike(new Telegraph(this.game, this.to - 1.5, this.floor, 3, 0.35, this.markTime + 0.25, GOLD));
        this.setAct('mark');
    }

    // Colunas com intervalo fixo: sempre há onde ficar, e o aviso mostra exatamente onde não ficar.
    firePillars(p) {
        const a = this.arena;
        const spacing = [7, 6, 5][this.phase];
        const warn = [0.85, 0.72, 0.62][this.phase];
        for (let k = -2; k <= 2; k++) {
            const x = p.x - COLUMN / 2 + k * spacing;
            if (x < a.x1 || x + COLUMN > a.x2) continue;
            this.strike(x, this.floor, COLUMN, a.ceil - this.floor, warn, 0.35, GOLD);
        }
    }

    fireVolley(p) {
        const count = [3, 5, 5][this.phase];
        const speed = [9, 10, 11][this.phase];
        const cy = this.y + 1.6;
        const aim = Math.atan2(p.y + 0.5 - cy, p.x - this.x);
        for (let i = 0; i < count; i++) {
            const ang = aim + (i - (count - 1) / 2) * 0.32;
            this.game.addShot(new Shot(this.game, this.x, cy, Math.cos(ang) * speed, Math.sin(ang) * speed, { r: 0.32, color: GOLD, life: 4 }));
        }
        Sfx.dash();
    }

    shockwave(speed) {
        for (const dir of [-1, 1]) {
            this.game.addShot(new Shot(this.game, this.x + dir * 1.2, this.floor + 0.4, dir * speed, 0, {
                r: 0.4, ground: true, color: GOLD, life: 2.6, breakable: false
            }));
        }
    }

    onRetry() {
        this.y = this.hoverY;
    }

    dyingPoint() {
        return { x: this.x, y: this.y + 1.6 };
    }

    sync(t) {
        this.mesh.position.set(this.x, this.y, 0.05);
        animateHerald(this.mesh, this, t);
    }
}
