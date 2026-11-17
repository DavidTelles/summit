import { Grid } from './grid.js';

// Capítulo 4 — Os Portões. Primeiro capítulo do Inferno: revisa o básico sob pressão
// (lava constante, plataformas que cedem) e fecha com dois chefes que exigem leitura e tempo.
const GATES = { chapter: 4, weather: 'ash' };

function ashGate() {
    const g = new Grid(132, 34);
    g.fill(0, 0, 14, 1, '#');
    g.fill(17, 4, 19, 4, '#');
    g.fill(22, 0, 40, 1, '#').fill(30, 2, 31, 2, '^');
    g.fill(37, 6, 39, 6, '#');
    g.fill(41, 0, 43, 13, '#');
    g.fill(44, 12, 62, 13, '#').fill(53, 14, 54, 14, '^');
    g.fill(63, 0, 82, 1, '#');
    g.fill(88, 5, 89, 5, '#');
    g.fill(97, 0, 131, 1, '#').fill(106, 2, 107, 4, '#');
    g.set(2, 2, 'P').set(46, 14, 'K').set(99, 2, 'K');
    g.many([[18, 7], [35, 5], [58, 17], [72, 6], [89, 9], [114, 7]], 'S');
    g.many([[86, 7], [93, 7]], 'C');
    g.many([[26, 2], [36, 2]], 'E').set(117, 6, 'F');
    g.set(128, 2, 'G');
    return {
        name: 'Portão de Cinzas', color: 0xff7a4a, ...GATES, grid: g,
        objects: [
            { type: 'lava', y: 0.8, x1: 15, x2: 22 },
            { type: 'lava', y: 0.8, x1: 83, x2: 97 },
            { type: 'firebar', x: 58, y: 17, len: 3, speed: 1.4 },
            { type: 'geyser', x: 68, y: 2, h: 6, phase: 0 },
            { type: 'geyser', x: 76, y: 2, h: 6, phase: 1.6 },
            { type: 'charger', x: 112, y: 2 },
            { type: 'spitter', x: 124, y: 2 }
        ]
    };
}

function chainBridge() {
    const g = new Grid(126, 34);
    g.fill(0, 0, 12, 1, '#');
    g.many([[15, 3], [16, 3]], '~');
    g.fill(19, 0, 26, 4, '#');
    g.many([[29, 6], [30, 6]], '~');
    g.fill(33, 0, 40, 7, '#');
    g.many([[43, 8], [44, 8]], '~');
    g.fill(47, 0, 62, 9, '#');
    g.fill(63, 8, 123, 9, '#');
    g.fill(120, 10, 123, 28, '#');
    g.fill(63, 27, 123, 28, '#');
    g.set(2, 2, 'P').set(35, 8, 'K').set(55, 10, 'K');
    g.many([[16, 6], [23, 8], [30, 9], [44, 11], [52, 13], [98, 14]], 'S');
    g.set(23, 5, 'E');
    g.set(116, 10, 'G');
    return {
        name: 'Ponte das Correntes', color: 0xff8a5a, ...GATES, boss: 'beast', grid: g,
        objects: [
            { type: 'lava', y: 0.8, x1: 13, x2: 126 },
            { type: 'spitter', x: 39, y: 8 }
        ],
        arena: { x1: 64, x2: 119, floor: 10, ceil: 27, gateX: 63, triggerX: 68, spawnX: 66, entryX: 58, zoom: 30 }
    };
}

function mentorHall() {
    const g = new Grid(104, 40);
    g.fill(0, 0, 16, 1, '#');
    g.fill(17, 0, 19, 9, '#');
    g.fill(24, 4, 26, 15, '#');
    g.fill(20, 0, 23, 1, '#').fill(20, 2, 23, 2, '^');
    g.fill(27, 12, 40, 13, '#').fill(33, 14, 34, 14, '^');
    g.fill(44, 12, 46, 12, '#');
    g.fill(50, 12, 62, 13, '#');
    g.fill(63, 12, 99, 13, '#');
    g.fill(96, 14, 99, 32, '#');
    g.fill(63, 31, 99, 32, '#');
    g.set(2, 2, 'P').set(29, 14, 'K').set(54, 14, 'K');
    g.many([[10, 4], [18, 14], [25, 19], [36, 17], [45, 15], [80, 20]], 'S');
    g.set(45, 18, 'C');
    g.set(92, 14, 'G');
    return {
        name: 'Salão do Mentor', color: 0xffb070, ...GATES, boss: 'mentor', grid: g,
        objects: [
            { type: 'lava', y: 0.8, x1: 41, x2: 50 },
            { type: 'shield', x: 37, y: 14 }
        ],
        arena: { x1: 64, x2: 95, floor: 14, ceil: 31, gateX: 63, triggerX: 68, spawnX: 66, entryX: 58, zoom: 27 }
    };
}

export const CHAPTER_4 = [ashGate(), chainBridge(), mentorHall()];
