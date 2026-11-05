const store = new Map();
globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear()
};

const { Game } = await import('../js/game.js');
const { Save } = await import('../js/core.js');
const { LEVELS } = await import('../js/levels.js');
const THREE = await import('../lib/three.module.js');

export { Game, Save, LEVELS, THREE };
export const memoryStore = store;

export class FakeInput {
    constructor() {
        this.ix = 0;
        this.iy = 0;
        this.held = new Set();
        this.pressed = new Set();
    }
    get x() { return this.ix; }
    get y() { return this.iy; }
    down(...codes) { return codes.some(c => this.held.has(c)); }
    hit(...codes) { return codes.some(c => this.pressed.has(c)); }
    endFrame() { this.pressed.clear(); }
    press(code) { this.pressed.add(code); }
}

export function fakeView() {
    return {
        root: new THREE.Group(),
        camPos: { set() {} },
        shake: 0,
        build() { this.root.clear(); },
        emit() {},
        follow() {},
        setBounds() {},
        flash() {},
        setDim() {},
        damageFlash() {},
        spawnPop() {},
        updateParticles() {}
    };
}

export function skillsForLevel(index) {
    const skills = ['dash', 'wall_climb'];
    if (index >= 3) skills.push('double_jump');
    if (index >= 6) skills.push('air_dash');
    if (index >= 10) skills.push('ground_pound');
    return skills;
}

export function newGame(index, hooks = {}, opts = {}) {
    localStorage.clear();
    Save.slots = [null, null, null];
    Save.active = -1;
    Save.create(0, opts.mode || 'normal');
    Save.data.unlocked = index + 1;
    Save.data.skills = opts.skills || skillsForLevel(index);
    Save.data.loadout = [];
    if (opts.abilities) {
        for (const [id, level] of Object.entries(opts.abilities)) Save.data.abilities[id] = level;
        Save.data.loadout = Object.keys(opts.abilities);
    }
    const input = new FakeInput();
    const game = new Game(fakeView(), { onHud() {}, onComplete() {}, ...hooks }, input);
    game.load(index);
    return { game, input };
}
