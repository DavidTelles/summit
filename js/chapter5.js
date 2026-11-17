import { Grid } from './grid.js';

// Capítulo 5 — O Alto. O Céu não tem lava: qualquer vão termina em queda livre.
// Vento, blocos pulsantes e nuvens que cedem pedem ritmo; o chefe pede leitura.
const HIGH = { chapter: 5, weather: 'cloud' };

function cloudThreshold() {
    const g = new Grid(130, 34);
    g.fill(0, 0, 13, 1, '#');
    g.fill(18, 2, 24, 3, '#');
    g.fill(30, 5, 36, 6, '#');
    g.many([[41, 8], [42, 8]], '~');
    g.fill(47, 8, 62, 9, '#').fill(54, 10, 55, 10, '^');
    g.fill(80, 8, 92, 9, '#');
    g.fill(100, 16, 112, 17, '#');
    g.fill(116, 12, 129, 13, '#');
    g.set(2, 2, 'P').set(49, 10, 'K').set(102, 18, 'K');
    g.many([[21, 7], [33, 10], [42, 12], [58, 13], [72, 13], [96, 22], [108, 21]], 'S');
    g.set(22, 4, 'E').set(72, 16, 'F');
    g.set(126, 14, 'G');
    return {
        name: 'Limiar das Nuvens', color: 0xffe2a0, ...HIGH, grid: g,
        objects: [
            { type: 'mover', x: 64, y: 8, w: 3, h: 1, dx: 11, period: 5 },
            { type: 'gust', x: 94, y: 4, w: 4, h: 16, fy: 42, period: 3, on: 3 },
            { type: 'charger', x: 86, y: 10 },
            { type: 'spitter', x: 110, y: 18 }
        ]
    };
}

function lightStair() {
    const g = new Grid(112, 56);
    g.fill(0, 0, 12, 1, '#');
    g.fill(15, 3, 19, 3, 'O');
    g.fill(23, 6, 27, 6, 'o');
    g.fill(31, 9, 35, 9, 'O');
    g.fill(39, 12, 46, 13, '#');
    g.fill(50, 15, 53, 15, 'o');
    g.fill(57, 18, 60, 18, 'O');
    g.fill(64, 21, 73, 22, '#').fill(67, 23, 68, 23, '^');
    g.fill(82, 31, 92, 32, '#');
    g.fill(100, 36, 111, 37, '#');
    g.set(2, 2, 'P').set(41, 14, 'K').set(84, 33, 'K');
    g.many([[17, 7], [33, 13], [44, 18], [58, 22], [71, 26], [88, 37], [96, 42]], 'S');
    g.set(96, 37, 'C');
    g.set(70, 24, 'F').set(90, 33, 'E');
    g.set(108, 38, 'G');
    return {
        name: 'Escadaria de Luz', color: 0xfff0c0, ...HIGH, grid: g,
        objects: [
            { type: 'mover', x: 76, y: 21, w: 3, h: 1, dy: 10, period: 5 },
            { type: 'shield', x: 44, y: 14 }
        ]
    };
}

function highThrone() {
    const g = new Grid(104, 44);
    g.fill(0, 0, 16, 1, '#');
    g.fill(20, 4, 26, 5, '#');
    g.many([[30, 8], [31, 8]], '~');
    g.fill(35, 10, 46, 11, '#');
    g.fill(50, 12, 62, 13, '#');
    g.fill(63, 12, 99, 13, '#');
    g.fill(96, 14, 99, 38, '#');
    g.fill(63, 37, 99, 38, '#');
    g.set(2, 2, 'P').set(37, 12, 'K').set(54, 14, 'K');
    g.many([[10, 4], [23, 9], [31, 12], [42, 15], [48, 18], [80, 20]], 'S');
    g.set(48, 15, 'C');
    g.set(92, 14, 'G');
    return {
        name: 'Trono do Alto', color: 0xffd98a, ...HIGH, boss: 'herald', grid: g,
        objects: [
            { type: 'spitter', x: 44, y: 12 }
        ],
        arena: { x1: 64, x2: 95, floor: 14, ceil: 36, gateX: 63, triggerX: 68, spawnX: 66, entryX: 58, zoom: 29 }
    };
}

export const CHAPTER_5 = [cloudThreshold(), lightStair(), highThrone()];
