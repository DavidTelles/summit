import { Sfx } from './audio.js';
import { makeFlower, makeLightFigure, makeRubble, makeStoneFace } from './decor.js';

const clamp01 = k => Math.min(1, Math.max(0, k));

class Aftermath {
    constructor(game, duration, focus, zoom) {
        Object.assign(this, { game, duration, focus, zoom, t: 0, fired: new Set(), done: false, dist: game.view.targetDist });
        if (zoom) game.view.targetDist = zoom;
        game.cutscene = true;
    }

    at(time, fn) {
        if (this.t < time || this.fired.has(time)) return;
        this.fired.add(time);
        fn();
    }

    update(dt) {
        this.t += dt;
        this.script(dt);
        if (this.t >= this.duration) this.finish();
    }

    finish() {
        if (this.done) return;
        this.done = true;
        const game = this.game;
        if (this.zoom) game.view.targetDist = this.dist;
        game.cutscene = false;
        this.cleanup();
        Sfx.setTheme(game.level.chapter);
        if (game.hooks.onBossEpilogue) game.hooks.onBossEpilogue();
    }

    cleanup() {}

    script() {}

    say(text, who, duration) {
        const hook = this.game.hooks.onStoryLine;
        if (hook) hook(text, who, duration);
    }
}

class VarakEnd extends Aftermath {
    constructor(game, x, y) {
        super(game, 8.2, { x, y: y + 1.2 }, 13);
        this.x = x;
        this.y = y;
        const root = game.view.root;
        this.rubble = makeRubble();
        this.rubble.position.set(x, y, 0.4);
        this.face = makeStoneFace();
        this.face.position.set(x, y + 0.05, 0.9);
        this.flower = makeFlower();
        this.flower.position.set(x + 0.3, y + 0.3, 1.1);
        this.flower.scale.setScalar(0.001);
        root.add(this.rubble, this.face, this.flower);
        Sfx.setTheme(null);
    }

    script() {
        const { t, face, flower } = this;
        const closed = t < 1.2 || (t > 2.5 && t < 2.68);
        face.userData.eyes.forEach(m => { m.visible = !closed && t < 4.1; });
        this.at(1.2, () => Sfx.humanGaze());
        this.at(4.1, () => {
            Sfx.shatter();
            this.game.view.emit(this.x, this.y + 1, 0x7c7468, 40, 5, 1);
        });
        face.visible = t < 4.3;
        const grow = clamp01((t - 5) / 2);
        flower.scale.setScalar(Math.max(0.001, grow * grow * (3 - 2 * grow) * 1.4));
        this.at(5, () => Sfx.flowerBloom());
    }
}

class AethosEnd extends Aftermath {
    constructor(game, x, y) {
        const fy = Math.max(game.level.arena.floor, y);
        super(game, 9.4, { x, y: fy + 1.5 }, 15);
        this.figure = makeLightFigure();
        this.figure.position.set(x, fy, 0.8);
        this.figure.userData.material.opacity = 0;
        game.view.root.add(this.figure);
        this.x = x;
        this.y = fy;
        Sfx.setTheme(null);
        game.view.setDim(0.8);
    }

    script() {
        const t = this.t;
        const m = this.figure.userData.material;
        m.opacity = t < 1 ? t * 0.8 : t > 8 ? Math.max(0, (9 - t) * 0.8) : 0.8;
        this.at(1, () => { Sfx.coreVoice(); this.say('O Núcleo não quer ser encontrado.', 'Aethos', 3); });
        this.at(4, () => this.say('Mas você precisa chegar.', 'Aethos', 2.2));
        this.at(6.4, () => this.say('Vá.', 'Aethos', 1.8));
        this.at(8, () => {
            this.game.view.emit(this.x, this.y + 1, 0xbfe0ff, 50, 6, 1.2);
            this.game.view.setDim(1);
            this.game.view.flash(0.25);
        });
    }

    cleanup() {
        this.figure.visible = false;
    }
}

class GuardianEnd extends Aftermath {
    constructor(game) {
        const goal = game.goal;
        super(game, 5, { x: goal.x, y: goal.y + 1 }, 18);
        Sfx.setTheme(null);
        game.view.setDim(0.55);
    }

    script(dt) {
        const goal = this.game.goal;
        if (Math.random() < dt * 22) this.game.view.emit(goal.x, goal.y + 1, 0x6fcfff, 3, 3, 1);
        this.at(0.8, () => Sfx.aetherFlow());
        this.at(4, () => this.game.view.setDim(1));
    }
}

export function createAftermath(game, bossId, x, y) {
    if (bossId === 'boss1') return new VarakEnd(game, x, y);
    if (bossId === 'boss2') return new AethosEnd(game, x, y);
    if (bossId === 'boss3' && game.goal) return new GuardianEnd(game);
    return null;
}

