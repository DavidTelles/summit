import { Grid } from './grid.js';

// Salas opcionais do mundo aberto. Ficam fora da cadeia principal (índices depois das 18 fases)
// e se ligam a ela por passagens declaradas em BRANCH_DOORS. Cada sala reaproveita a arte de
// uma fase existente (theme) e pertence a um capítulo, para cor, música e contagem de mortes.

// Embaixo da Cidade Antiga: só se chega pela Pancada no Chão, que quebra o piso rachado.
function galeria() {
    const g = new Grid(56, 26);
    g.fill(0, 0, 55, 1, '#').fill(0, 0, 1, 25, '#').fill(54, 0, 55, 25, '#').fill(0, 24, 55, 25, '#');
    g.fill(2, 15, 11, 15, '#');
    g.fill(14, 2, 36, 2, '^');
    g.fill(17, 6, 18, 6, '#').fill(24, 9, 25, 9, '#').fill(31, 6, 32, 6, '#');
    g.many([[21, 8], [28, 11], [35, 8]], 'C');
    g.secretRoom(44, 2, 45, 52, 3);
    g.set(6, 16, 'P');
    g.many([[17, 8], [24, 12], [31, 8], [39, 5], [48, 3], [51, 3]], 'S');
    g.set(40, 2, 'E').set(26, 16, 'F');
    return {
        key: 'galeria', name: 'Galeria Soterrada', theme: 'Caverna de Cristal', anchor: 1,
        color: 0xb8a0ff, chapter: 1, weather: 'sparkle', grid: g,
        objects: [{ type: 'secret', id: 'galeria', x: 46, y: 2, w: 6, h: 3, label: 'Galeria escondida' }]
    };
}

// Atalho entre o Templo do Vento e as Ruínas Suspensas. A entrada do Templo pede o Dash Aéreo.
function fenda() {
    const g = new Grid(92, 30);
    g.fill(0, 0, 12, 1, '#');
    g.fill(16, 3, 19, 3, '#');
    g.many([[24, 5], [25, 5]], '~');
    g.fill(30, 6, 33, 6, '#');
    g.fill(42, 8, 45, 8, '#');
    g.fill(48, 11, 50, 11, '#');
    g.fill(55, 12, 61, 12, '#');
    g.fill(66, 8, 68, 8, '#');
    g.fill(74, 0, 91, 1, '#');
    g.set(37, 10, 'C').set(63, 14, 'C');
    g.set(7, 2, 'P');
    g.many([[18, 6], [31, 9], [44, 11], [58, 15], [67, 11], [80, 5]], 'S');
    g.set(62, 17, 'F').set(80, 2, 'E');
    return {
        key: 'fenda', name: 'Fenda dos Ecos', theme: 'Abismo de Vento', anchor: 3,
        color: 0x9fb4ff, chapter: 2, weather: 'rain', grid: g,
        objects: [{ type: 'gust', x: 34, y: 4, w: 7, h: 10, fy: 30, period: 3.6, on: 1.8 }]
    };
}

// Veio de lava que liga o Portão de Cinzas ao topo do Núcleo. Só abre pelo lado do Inferno.
function veio() {
    const g = new Grid(96, 28);
    g.fill(0, 0, 14, 1, '#');
    g.fill(18, 3, 21, 3, '#');
    g.fill(25, 0, 34, 1, '#').fill(29, 2, 30, 2, '^');
    g.fill(38, 5, 40, 5, '#');
    g.fill(44, 0, 46, 9, '#');
    g.fill(47, 8, 58, 9, '#');
    g.fill(62, 4, 64, 4, '#');
    g.fill(68, 0, 95, 1, '#');
    g.many([[23, 6], [42, 9]], 'C');
    g.set(88, 2, 'P');
    g.many([[19, 6], [32, 5], [39, 8], [52, 13], [63, 7], [76, 5]], 'S');
    g.set(54, 10, 'E');
    return {
        key: 'veio', name: 'Veio de Magma', theme: 'Portão de Cinzas', anchor: 12,
        color: 0xff7a4a, chapter: 4, weather: 'ash', grid: g,
        objects: [
            { type: 'lava', y: 0.8, x1: 15, x2: 25 },
            { type: 'lava', y: 0.8, x1: 35, x2: 44 },
            { type: 'lava', y: 0.8, x1: 59, x2: 68 },
            { type: 'firebar', x: 52, y: 14, len: 2.6, speed: 1.3 },
            { type: 'geyser', x: 72, y: 2, h: 6, phase: 0.8 }
        ]
    };
}

// Queda longa do Limiar das Nuvens até o Cume Eterno: um caminho de volta do Céu para a Montanha.
function mirante() {
    const g = new Grid(40, 70);
    g.fill(0, 0, 39, 1, '#').fill(0, 0, 1, 69, '#').fill(38, 0, 39, 69, '#');
    g.fill(2, 62, 14, 63, '#');
    g.fill(24, 50, 31, 50, '#');
    g.fill(6, 38, 13, 38, '#');
    g.fill(26, 26, 33, 26, '#').fill(26, 27, 27, 27, '^');
    g.fill(8, 14, 15, 14, '#');
    g.set(8, 64, 'P');
    g.many([[20, 58], [28, 53], [9, 41], [30, 32], [12, 20], [24, 8]], 'S');
    g.many([[19, 44], [21, 20]], 'C');
    return {
        key: 'mirante', name: 'Mirante Partido', theme: 'Limiar das Nuvens', anchor: 15,
        color: 0xffe2a0, chapter: 5, weather: 'cloud', grid: g
    };
}

export const BRANCH_ROOMS = [galeria(), fenda(), veio(), mirante()];

// Passagens das salas opcionais. `room` e `to.room` aceitam o índice de uma fase ou a chave da sala.
// x/y: centro da passagem e chão onde ela fica. spawn: onde o jogador aparece ao chegar por ela.
// lock: { skill } exige um movimento; { opened } exige que a passagem tenha sido aberta do outro lado.
// opens: atravessar esta passagem abre a trava `opened` correspondente. arrival: só ponto de chegada.
export const BRANCH_DOORS = [
    { id: 'galeria-hole', room: 1, kind: 'drop', x: 35, y: -3, w: 2, h: 3, spawn: { x: 38.5, y: 2 }, to: { room: 'galeria', door: 'galeria-up' } },
    { id: 'galeria-up', room: 'galeria', x: 4.5, y: 2, spawn: { x: 6.5, y: 16 }, to: { room: 1, door: 'galeria-hole' } },

    { id: 'fenda-templo', room: 3, x: 42.5, y: 31, spawn: { x: 40.2, y: 31 }, to: { room: 'fenda', door: 'fenda-w' },
        lock: { skill: 'air_dash', text: 'Um vento cortante fecha a fenda. Volte com o Dash Aéreo.' } },
    { id: 'fenda-w', room: 'fenda', x: 3.5, y: 2, spawn: { x: 7.5, y: 2 }, to: { room: 3, door: 'fenda-templo' } },
    { id: 'fenda-e', room: 'fenda', x: 87.5, y: 2, spawn: { x: 84.5, y: 2 }, to: { room: 6, door: 'fenda-ruinas' } },
    { id: 'fenda-ruinas', room: 6, x: 45.5, y: 27, spawn: { x: 42.6, y: 27 }, to: { room: 'fenda', door: 'fenda-e' } },

    { id: 'veio-portao', room: 12, x: 103.5, y: 2, spawn: { x: 101.6, y: 2 }, to: { room: 'veio', door: 'veio-e' } },
    { id: 'veio-e', room: 'veio', x: 91.5, y: 2, spawn: { x: 88.5, y: 2 }, to: { room: 12, door: 'veio-portao' } },
    { id: 'veio-w', room: 'veio', x: 4.5, y: 2, spawn: { x: 7.5, y: 2 }, to: { room: 10, door: 'veio-nucleo' }, opens: 'veio' },
    { id: 'veio-nucleo', room: 10, x: 48.5, y: 106, spawn: { x: 46.4, y: 106 }, to: { room: 'veio', door: 'veio-w' },
        lock: { opened: 'veio', text: 'A passagem está selada do outro lado.' } },

    { id: 'mirante-limiar', room: 15, x: 109.5, y: 18, spawn: { x: 106.5, y: 18 }, to: { room: 'mirante', door: 'mirante-top' } },
    { id: 'mirante-top', room: 'mirante', x: 4.5, y: 64, spawn: { x: 9.5, y: 64 }, to: { room: 15, door: 'mirante-limiar' } },
    { id: 'mirante-bottom', room: 'mirante', x: 33.5, y: 2, spawn: { x: 30.5, y: 2 }, to: { room: 11, door: 'mirante-cume' } },
    { id: 'mirante-cume', room: 11, arrival: true, x: 5.5, y: 2, spawn: { x: 5.5, y: 6 } }
];
