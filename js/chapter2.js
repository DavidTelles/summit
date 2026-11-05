import { Grid } from './grid.js';

const STORM = { chapter: 2, weather: 'rain' };

function valley() {
    const g = new Grid(142, 32);
    g.fill(0, 0, 16, 1, '#').fill(23, 0, 36, 1, '#');
    g.fill(43, 10, 47, 10, '#').fill(53, 16, 72, 17, '#');
    g.fill(94, 14, 108, 15, '#').fill(110, 0, 129, 1, '#');
    g.fill(112, 2, 114, 2, '^');
    g.set(2, 2, 'P').set(30, 2, 'K').set(54, 18, 'K').set(96, 16, 'K').set(116, 2, 'K');
    g.many([[20, 6], [45, 12], [62, 21], [82, 19], [105, 17]], 'S');
    g.many([[113, 6]], 'C');
    g.set(27, 2, 'E').set(126, 2, 'G');
    g.secretRoom(130, 2, 131, 138, 4).set(135, 3, 'S');
    return {
        name: 'Vale da Tempestade', color: 0x7aa2ff, ...STORM, grid: g,
        objects: [
            { type: 'gust', x: 14, y: 2, w: 22, h: 8, fx: -4.5, period: 4.5, on: 2 },
            { type: 'gust', x: 39, y: -4, w: 3, h: 17, fy: 42, period: 3, on: 3 },
            { type: 'gust', x: 49, y: 4, w: 3, h: 16, fy: 42, period: 3, on: 3 },
            { type: 'charger', x: 66, y: 18 },
            { type: 'mover', x: 74, y: 15, w: 3, h: 1, dx: 9, period: 5 },
            { type: 'mover', x: 88, y: 10, w: 3, h: 1, dy: 5, period: 4.5 },
            { type: 'lightning', x: 102, top: 26, period: 3.4 },
            { type: 'spitter', x: 107.5, y: 16 },
            { type: 'charger', x: 121, y: 2 },
            { type: 'secret', id: 'valley', x: 131, y: 2, w: 8, h: 4 }
        ]
    };
}

function ruins() {
    const g = new Grid(140, 46);
    g.fill(0, 0, 10, 1, '#').fill(12, 0, 14, 14, '#').fill(12, 15, 22, 15, '#').fill(23, 15, 30, 15, '~');
    g.fill(38, 25, 49, 26, '#').fill(50, 27, 50, 32, 'X').fill(50, 33, 50, 45, '#');
    g.fill(51, 25, 70, 26, '#').fill(51, 33, 70, 33, '#');
    g.fill(55, 32, 57, 32, 'v').fill(63, 32, 65, 32, 'v');
    g.fill(81, 24, 90, 24, '#').fill(108, 18, 127, 19, '#');
    g.set(2, 2, 'P').set(18, 16, 'K').set(39, 27, 'K').set(82, 25, 'K').set(110, 20, 'K');
    g.many([[8, 6], [27, 19], [44, 31], [60, 29], [75, 35], [99, 29], [118, 24]], 'S');
    g.many([[75, 30], [97, 26]], 'C');
    g.many([[5, 2]], 'E');
    g.set(124, 20, 'G');
    g.secretRoom(128, 20, 129, 137, 4).set(134, 21, 'S');
    return {
        name: 'Ruínas Suspensas', color: 0x9bb0ff, ...STORM, grid: g,
        objects: [
            { type: 'mover', x: 33, y: 15, w: 3, h: 1, dy: 11, period: 5 },
            { type: 'shield', x: 45, y: 27 },
            { type: 'charger', x: 62, y: 27 },
            { type: 'diver', x: 86, y: 33 },
            { type: 'mover', x: 92, y: 22, w: 3, h: 1, dx: 12, dy: -3, period: 6 },
            { type: 'lightning', x: 114, top: 32, period: 2.8 },
            { type: 'lightning', x: 120, top: 32, period: 2.8, phase: 1.4 },
            { type: 'shield', x: 118, y: 20 },
            { type: 'secret', id: 'ruins', x: 129, y: 20, w: 9, h: 4 }
        ]
    };
}

function abyss() {
    const g = new Grid(122, 62);
    g.fill(0, 48, 14, 49, '#').fill(17, 40, 21, 40, '#').fill(25, 32, 29, 32, '#');
    g.fill(18, 22, 45, 23, '#');
    g.fill(51, 34, 58, 34, '#').fill(59, 35, 60, 46, '#').fill(59, 47, 70, 47, '#');
    g.fill(87, 44, 100, 45, '#').fill(108, 50, 121, 51, '#');
    g.set(2, 50, 'P').set(20, 24, 'K').set(52, 35, 'K').set(62, 48, 'K').set(88, 46, 'K');
    g.many([[19, 44], [27, 36], [36, 28], [55, 38], [78, 54], [94, 50], [105, 57]], 'S');
    g.many([[78, 50]], 'C');
    g.set(116, 52, 'G');
    g.secretRoom(17, 24, 10, 16, 4).set(13, 25, 'S');
    return {
        name: 'Abismo de Vento', color: 0x6aa0ff, ...STORM, grid: g,
        objects: [
            { type: 'gust', x: 15, y: 24, w: 18, h: 22, fx: 3.5, period: 5, on: 2.2 },
            { type: 'lightning', x: 28, top: 31, period: 3 },
            { type: 'lightning', x: 34, top: 42, period: 3, phase: 1 },
            { type: 'lightning', x: 40, top: 42, period: 3, phase: 2 },
            { type: 'shield', x: 38, y: 24 },
            { type: 'gust', x: 47, y: -4, w: 3, h: 42, fy: 42, period: 4, on: 4 },
            { type: 'diver', x: 62, y: 42 },
            { type: 'charger', x: 67, y: 48 },
            { type: 'gust', x: 71, y: 44, w: 16, h: 14, fx: -5, period: 5, on: 2.5 },
            { type: 'spitter', x: 97.5, y: 46 },
            { type: 'diver', x: 92, y: 56 },
            { type: 'mover', x: 102, y: 42, w: 3, h: 1, dy: 8, period: 4 },
            { type: 'secret', id: 'abyss', x: 10, y: 24, w: 7, h: 4 }
        ]
    };
}

function stormPeak() {
    const g = new Grid(110, 44);
    g.fill(0, 0, 12, 1, '#').fill(29, 0, 40, 1, '#').fill(46, 4, 109, 5, '#');
    g.fill(105, 6, 109, 27, '#').fill(65, 27, 109, 28, '#');
    g.fill(72, 10, 76, 10, '#').fill(83, 11, 87, 11, '#').fill(94, 10, 98, 10, '#');
    g.fill(33, 2, 35, 2, '^');
    g.set(2, 2, 'P').set(30, 2, 'K').set(62, 6, 'K').set(101, 6, 'G');
    g.many([[22, 12], [34, 7], [55, 11]], 'S');
    g.many([[79, 14], [91, 14]], 'C');
    return {
        name: 'Pico da Tormenta', color: 0x5a8fff, ...STORM, boss: 'boss2', grid: g,
        arena: {
            x1: 66, x2: 105, floor: 6, ceil: 27, gateX: 65, triggerX: 68, spawnX: 67, entryX: 62.5, zoom: 29,
            nests: [{ x: 72, y: 22 }, { x: 85.5, y: 24 }, { x: 99, y: 22 }, { x: 78, y: 18 }, { x: 92, y: 18 }],
            rods: [{ x: 74.5, y: 11 }, { x: 85.5, y: 12 }, { x: 96.5, y: 11 }],
            lifts: [{ type: 'mover', x: 78, y: 8, w: 3, h: 1, dy: 8, period: 6 }, { type: 'mover', x: 90, y: 8, w: 3, h: 1, dy: 8, period: 6, phase: 0.5 }]
        },
        objects: [
            { type: 'mover', x: 14, y: 2, w: 3, h: 1, dx: 10, dy: 3, period: 5 },
            { type: 'gust', x: 12, y: 0, w: 17, h: 18, fx: -3.5, period: 5, on: 2 },
            { type: 'charger', x: 37, y: 2 },
            { type: 'mover', x: 42, y: 1, w: 3, h: 1, dy: 4, period: 3.5 },
            { type: 'lightning', x: 50, top: 18, period: 2.6 },
            { type: 'shield', x: 56, y: 6 },
            { type: 'lightning', x: 58, top: 18, period: 2.6, phase: 1.3 }
        ]
    };
}

export const CHAPTER_2 = [valley(), ruins(), abyss(), stormPeak()];
