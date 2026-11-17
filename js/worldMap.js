import { LEVELS } from './levels.js';
import { BRANCH_ROOMS, BRANCH_DOORS } from './branches.js';

// Mundo aberto: as 18 fases continuam sendo a cadeia principal (índices 0-17) e as salas
// opcionais entram depois delas. Uma "sala" é qualquer item de ROOMS.
export const MAIN_COUNT = LEVELS.length;
export const ROOMS = [...LEVELS, ...BRANCH_ROOMS.map(r => ({ ...r, main: false }))];
export const ROOM_COUNT = ROOMS.length;

const ROOM_INDEX = new Map(BRANCH_ROOMS.map((r, i) => [r.key, MAIN_COUNT + i]));
const resolve = room => (typeof room === 'number' ? room : ROOM_INDEX.get(room));

export const isMain = index => Number.isInteger(index) && index >= 0 && index < MAIN_COUNT;
export const isRoom = index => Number.isInteger(index) && index >= 0 && index < ROOM_COUNT;
export const roomOf = index => ROOMS[index];
export const roomIndex = key => ROOM_INDEX.get(key);
// Fase principal usada para textos e capítulo de uma sala opcional.
export const anchorOf = index => (isMain(index) ? index : isRoom(index) ? ROOMS[index].anchor : 0);

export function findCell(grid, char) {
    for (let y = 0; y < grid.h; y++) {
        for (let x = 0; x < grid.w; x++) if (grid.cells[y][x] === char) return { x, y };
    }
    return null;
}

// Passagens da cadeia: a saída fica onde estava o portal (G) e a volta, num arco logo atrás do início (P).
function chainDoors(i) {
    const g = LEVELS[i].grid;
    const P = findCell(g, 'P');
    const G = findCell(g, 'G');
    const list = [];
    if (i > 0) {
        list.push({ id: 'in', room: i, x: Math.max(1, P.x - 1), y: P.y, spawn: { x: P.x + 0.5, y: P.y }, to: { room: i - 1, door: 'out' }, back: true });
    }
    list.push({ id: 'out', room: i, x: G.x + 0.5, y: G.y, spawn: { x: G.x - 1.5, y: G.y }, to: i + 1 < MAIN_COUNT ? { room: i + 1, door: 'in' } : null, exit: true });
    return list;
}

const DOORS = ROOMS.map(() => []);
LEVELS.forEach((_, i) => DOORS[i].push(...chainDoors(i)));
for (const def of BRANCH_DOORS) {
    const room = resolve(def.room);
    const door = { kind: 'arch', ...def, room };
    if (def.to) door.to = { room: resolve(def.to.room), door: def.to.door };
    DOORS[room].push(door);
}
DOORS.forEach(list => list.forEach(d => { d.kind = d.kind || 'arch'; }));

export const doorsOf = index => DOORS[index] || [];
export const doorById = (room, id) => doorsOf(room).find(d => d.id === id) || null;
export const exitDoor = index => doorsOf(index).find(d => d.exit) || null;

// Valida o grafo: todo destino existe, e toda passagem de ida tem volta (salvo as de sentido único).
export function checkRooms() {
    const problems = [];
    DOORS.forEach((list, room) => {
        for (const d of list) {
            if (!d.to) continue;
            const target = doorById(d.to.room, d.to.door);
            if (!target) {
                problems.push(`${ROOMS[room].name}: destino ${d.to.room}/${d.to.door} não existe`);
                continue;
            }
            if (!target.arrival && (!target.to || target.to.room !== room || target.to.door !== d.id)) {
                problems.push(`${ROOMS[room].name}/${d.id}: a volta não leva de novo para cá`);
            }
        }
    });
    return problems;
}

// Ponto de chegada ao atravessar para `to` ({ room, door }).
export function arrivalAt(to) {
    const door = doorById(to.room, to.door);
    const spot = door ? door.spawn : null;
    return spot ? { x: spot.x, y: spot.y, door: door.id } : null;
}

// ------- Mapa -------
// Escala do mapa: 1 unidade = 1 bloco * S. Coordenadas do mapa crescem para baixo.
const S = 1 / 12;
const GAP = 1.3;
const pointIn = (room, x, y) => ({ x: x * S, y: (ROOMS[room].grid.h - y) * S });

function layout() {
    const pos = new Array(ROOM_COUNT);
    const size = i => ({ w: ROOMS[i].grid.w * S, h: ROOMS[i].grid.h * S });
    const place = (i, x, y) => { pos[i] = { x, y, ...size(i) }; };
    // Encosta a entrada da sala i na saída da anterior.
    const chain = i => {
        const out = exitDoor(i - 1);
        const back = doorById(i, 'in');
        const a = pointIn(i - 1, out.x, out.y);
        const b = pointIn(i, back.x, back.y);
        place(i, pos[i - 1].x + a.x + GAP - b.x, pos[i - 1].y + a.y - b.y);
    };
    const bounds = list => list.reduce((acc, i) => ({
        x1: Math.min(acc.x1, pos[i].x), y1: Math.min(acc.y1, pos[i].y),
        x2: Math.max(acc.x2, pos[i].x + pos[i].w), y2: Math.max(acc.y2, pos[i].y + pos[i].h)
    }), { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity });
    const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);

    place(0, 0, 0);
    for (let i = 1; i <= 11; i++) chain(i);
    const mountain = bounds(range(0, 11));
    // O Inferno fica abaixo do fim da montanha; o Céu, acima dele.
    place(12, pos[10].x - 2, mountain.y2 + 4);
    for (let i = 13; i <= 14; i++) chain(i);
    place(15, pos[11].x - 4, mountain.y1 - 6 - size(15).h);
    for (let i = 16; i <= 17; i++) chain(i);

    const at = (room, door) => {
        const d = doorById(room, door);
        const p = pointIn(room, d.x, d.y);
        return { x: pos[room].x + p.x, y: pos[room].y + p.y };
    };
    const hole = at(1, 'galeria-hole');
    place(roomIndex('galeria'), hole.x - 1.5, mountain.y2 + 2.5);
    const temple = at(3, 'fenda-templo');
    const fenda = roomIndex('fenda');
    place(fenda, temple.x - 2, Math.min(pos[4].y, temple.y) - 1.5 - size(fenda).h);
    const gate = at(12, 'veio-portao');
    const veio = roomIndex('veio');
    place(veio, gate.x - size(veio).w / 2, pos[12].y + pos[12].h + 2.5);
    const sill = at(15, 'mirante-limiar');
    const mirante = roomIndex('mirante');
    place(mirante, sill.x + 1.5, sill.y + 1);
    return pos;
}

const POS = layout();
const all = POS.reduce((acc, p) => ({
    x1: Math.min(acc.x1, p.x), y1: Math.min(acc.y1, p.y), x2: Math.max(acc.x2, p.x + p.w), y2: Math.max(acc.y2, p.y + p.h)
}), { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity });
const PAD = 2;
export const MAP_BOUNDS = { x: all.x1 - PAD, y: all.y1 - PAD, w: all.x2 - all.x1 + PAD * 2, h: all.y2 - all.y1 + PAD * 2 };
export const roomRect = index => POS[index];

// Converte uma posição dentro de uma sala para o mapa.
export function mapPoint(room, x, y) {
    const p = pointIn(room, x, y);
    return { x: POS[room].x + p.x, y: POS[room].y + p.y };
}
