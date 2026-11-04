import { Grid } from './grid.js';

const CORE = { chapter: 3, weather: 'embers' };

function pulseWalk(g, x1, x2, y, seg = 4) {
    for (let x = x1, n = 0; x <= x2; x += seg, n++) {
        g.fill(x, y, Math.min(x + seg - 1, x2), y, n % 2 ? 'o' : 'O');
    }
}

function gorge() {
    const g = new Grid(142, 42);
    g.fill(0, 0, 14, 1, '#').fill(35, 0, 50, 1, '#');
    pulseWalk(g, 15, 34, 1);
    g.fill(52, 3, 54, 3, '#').fill(62, 3, 64, 3, '#');
    g.fill(66, 0, 68, 20, '#').fill(69, 20, 84, 21, '#');
    pulseWalk(g, 85, 100, 20);
    g.fill(101, 18, 125, 19, '#').fill(107, 20, 109, 20, '^');
    g.set(2, 2, 'P').set(37, 2, 'K').set(70, 22, 'K').set(102, 20, 'K');
    g.many([[24, 5], [58, 9], [65, 24], [78, 25], [92, 25], [115, 24]], 'S');
    g.many([[58, 6]], 'C');
    g.set(122, 20, 'G');
    g.secretRoom(126, 20, 127, 137, 4).set(133, 21, 'S');
    return {
        name: 'Desfiladeiro Final', color: 0xff9a7a, ...CORE, grid: g,
        objects: [
            { type: 'lava', y: 0.8, x1: 15, x2: 35 },
            { type: 'lava', y: 0.8, x1: 51, x2: 66 },
            { type: 'lava', y: 0.8, x1: 69, x2: 142 },
            { type: 'geyser', x: 40, y: 2, h: 6, phase: 0 },
            { type: 'geyser', x: 45, y: 2, h: 6, phase: 1.8 },
            { type: 'firebar', x: 58, y: 6, len: 4, speed: 1.3 },
            { type: 'spitter', x: 48.5, y: 2 },
            { type: 'firebar', x: 60, y: 15, len: 4, speed: -1.5 },
            { type: 'shield', x: 76, y: 22 },
            { type: 'charger', x: 113, y: 20 },
            { type: 'geyser', x: 116, y: 20, h: 7, phase: 0.6 },
            { type: 'secret', id: 'gorge', x: 127, y: 20, w: 11, h: 4 }
        ]
    };
}

function core() {
    const g = new Grid(62, 128);
    g.fill(0, 0, 1, 127, '#').fill(60, 0, 61, 127, '#');
    g.fill(0, 0, 61, 1, '#');
    const tiers = [
        [4, 12, 8], [18, 28, 9], [36, 46, 10], [50, 58, 16], [28, 40, 22], [6, 18, 26], [22, 32, 32],
        [44, 56, 38], [30, 40, 45], [8, 20, 50], [26, 36, 56], [44, 58, 62], [24, 34, 68], [6, 16, 74],
        [24, 36, 80], [46, 58, 86], [24, 36, 92], [4, 16, 98]
    ];
    tiers.forEach(([x1, x2, y]) => g.fill(x1, y, x2, y, '#'));
    g.fill(24, 104, 58, 105, '#');
    g.fill(40, 104, 44, 105, 'Y');
    g.fill(32, 92, 36, 92, '~');
    g.fill(30, 112, 58, 112, '#');
    g.set(4, 2, 'P').set(52, 17, 'K').set(10, 51, 'K').set(50, 87, 'K').set(28, 106, 'K').set(54, 106, 'G');
    g.many([[23, 12], [40, 41], [14, 30], [32, 60], [12, 78], [30, 96]], 'S');
    g.many([[22, 16], [40, 30], [20, 43], [38, 74], [20, 90]], 'C');
    g.many([[6, 9], [46, 39], [12, 75]], 'K');
    g.many([[23, 10], [52, 39], [28, 81]], 'B');
    g.fill(38, 94, 46, 94, '#').fill(38, 100, 39, 100, '#').fill(45, 100, 46, 100, '#').fill(40, 100, 44, 100, 'Y');
    g.fill(37, 94, 37, 103, '#').fill(47, 94, 47, 103, '#');
    g.set(45, 95, 'S').set(39, 95, 'B');
    return {
        name: 'Núcleo da Montanha', color: 0xff7a5a, ...CORE, grid: g,
        objects: [
            { type: 'lava', y: -1, x1: 0, x2: 62, rise: 1.15, triggerX: 0, maxY: 92 },
            { type: 'spitter', x: 26.5, y: 10 },
            { type: 'firebar', x: 34, y: 28, len: 3.2, speed: 1.4 },
            { type: 'sentinel', x: 25, y: 44 },
            { type: 'shield', x: 30, y: 57 },
            { type: 'firebar', x: 40, y: 66, len: 4, speed: -1.6 },
            { type: 'diver', x: 30, y: 78 },
            { type: 'mover', x: 18, y: 84, w: 3, h: 1, dx: 22, period: 6 },
            { type: 'sentinel', x: 52, y: 110 },
            { type: 'firebar', x: 42, y: 97.5, len: 2.4, speed: 1.2 },
            { type: 'secret', id: 'core', x: 38, y: 95, w: 9, h: 5, trial: true, label: 'Provação encontrada' }
        ]
    };
}

function eternal() {
    const g = new Grid(132, 62);
    g.fill(0, 0, 8, 1, '#');
    g.fill(10, 6, 12, 6, '#').fill(18, 10, 20, 10, '#').fill(26, 14, 28, 14, '#');
    g.fill(32, 16, 34, 40, '#').fill(26, 26, 31, 26, '^');
    g.fill(42, 18, 46, 18, '#').fill(52, 14, 54, 14, 'Y').fill(50, 14, 51, 14, '#').fill(55, 14, 56, 14, '#');
    pulseWalk(g, 58, 72, 16, 3);
    g.fill(74, 18, 131, 19, '#');
    g.fill(123, 20, 131, 44, '#').fill(84, 44, 131, 45, '#');
    g.fill(90, 24, 95, 24, '#').fill(100, 24, 105, 24, '#').fill(112, 24, 117, 24, '#');
    g.fill(97, 30, 99, 30, '#').fill(108, 30, 110, 30, '#');
    g.fill(46, 4, 58, 5, '#').fill(46, 6, 46, 13, '#').fill(58, 6, 58, 13, '#');
    g.set(49, 6, 'B');
    g.set(2, 2, 'P').set(43, 19, 'K').set(77, 20, 'K').set(118, 20, 'G');
    g.many([[19, 13], [27, 17], [37, 28], [55, 8], [65, 21]], 'S');
    g.many([[23, 12], [37, 22], [49, 22], [68, 22]], 'C');
    g.many([[14, 12]], 'B');
    return {
        name: 'Cume Eterno', color: 0xff5a5a, ...CORE, boss: 'boss3', grid: g,
        arena: {
            x1: 85, x2: 123, floor: 20, ceil: 44, gateX: 84, triggerX: 87, spawnX: 86, entryX: 77.5, zoom: 30,
            sigils: [{ x: 92.5, y: 25 }, { x: 102.5, y: 25 }, { x: 114.5, y: 25 }]
        },
        objects: [
            { type: 'firebar', x: 23, y: 16, len: 3.2, speed: 1.6 },
            { type: 'firebar', x: 38, y: 16, len: 3.2, speed: -1.6 },
            { type: 'sentinel', x: 44, y: 24 },
            { type: 'spitter', x: 79.5, y: 20 },
            { type: 'geyser', x: 80, y: 20, h: 8, phase: 1 },
            { type: 'firebar', x: 53, y: 9, len: 2.4, speed: 1.1 },
            { type: 'secret', id: 'eternal', x: 47, y: 6, w: 11, h: 8, trial: true, label: 'Provação encontrada' }
        ]
    };
}

export const CHAPTER_3 = [gorge(), core(), eternal()];
