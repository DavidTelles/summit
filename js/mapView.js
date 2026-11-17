import { ROOMS, ROOM_COUNT, MAP_BOUNDS, doorById, doorsOf, mapPoint, roomRect } from './worldMap.js';
import { realmOfChapter, REALMS } from './realms.js';
import { BOSSES } from './campaign.js';
import { icon } from './icons.js';

// Mapa do mundo aberto, no estilo dos mapas de Hollow Knight: só aparecem as salas visitadas
// (e o contorno das vizinhas). Os checkpoints ativados viram botões de viagem rápida.
const pct = (v, total) => `${((v / total) * 100).toFixed(3)}%`;
const MIN_W = 34;
const PAD = 2.5;

// Recorte do mapa: só a parte já conhecida, com folga e proporção confortável.
function viewBounds(known) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const i of known) {
        const r = roomRect(i);
        x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y);
        x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h);
    }
    if (!Number.isFinite(x1)) return MAP_BOUNDS;
    let w = x2 - x1 + PAD * 2;
    let h = y2 - y1 + PAD * 2;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    w = Math.max(w, MIN_W, h * 1.4);
    h = Math.max(h, w / 3.2);
    return { x: cx - w / 2, y: cy - h / 2, w, h };
}

const lockOpen = (d, lock) => !lock || (lock.skill ? d.skills.includes(lock.skill) : !!d.world.opened[lock.opened]);

function knownRooms(d) {
    const visited = new Set(Object.keys(d.world.visited).map(Number));
    const known = new Set(visited);
    for (const room of visited) {
        for (const door of doorsOf(room)) {
            if (door.to && lockOpen(d, door.lock)) known.add(door.to.room);
        }
    }
    return { visited, known };
}

// Lista de pontos de viagem já ativados, na ordem do mundo.
export function travelPoints(d) {
    return Object.entries(d.world.flags)
        .map(([key, f]) => ({ key, ...f, name: ROOMS[f.level].name, realm: realmOfChapter(ROOMS[f.level].chapter) }))
        .sort((a, b) => a.level - b.level || a.x - b.x);
}

// opts.here: { room, x, y } posição atual; opts.travel: botões habilitados; opts.restKey: checkpoint onde o jogador está.
export function renderMap(d, opts = {}) {
    const { visited, known } = knownRooms(d);
    const B = viewBounds(known);
    const here = opts.here || null;
    const rects = [];
    for (let i = 0; i < ROOM_COUNT; i++) {
        if (!known.has(i)) continue;
        const r = roomRect(i);
        const realm = realmOfChapter(ROOMS[i].chapter);
        const cls = ['map-room', `realm-${realm}`, visited.has(i) ? 'seen' : 'unseen', here && here.room === i ? 'current' : '', ROOMS[i].main === false ? 'branch' : ''].join(' ');
        rects.push(`<rect class="${cls}" x="${(r.x - B.x).toFixed(2)}" y="${(r.y - B.y).toFixed(2)}" width="${r.w.toFixed(2)}" height="${r.h.toFixed(2)}" rx="0.5"><title>${visited.has(i) ? ROOMS[i].name : 'Área inexplorada'}</title></rect>`);
    }
    const links = [];
    const drawn = new Set();
    for (const room of visited) {
        for (const door of doorsOf(room)) {
            if (!door.to || !known.has(door.to.room)) continue;
            const target = doorById(door.to.room, door.to.door);
            const id = [room, door.id, door.to.room, door.to.door].join('|');
            const back = [door.to.room, door.to.door, room, door.id].join('|');
            if (!target || drawn.has(back)) continue;
            drawn.add(id);
            const a = mapPoint(room, door.x, door.y + 1);
            const b = mapPoint(door.to.room, target.x, target.y + 1);
            const locked = !lockOpen(d, door.lock) || !lockOpen(d, target.lock);
            links.push(`<line class="map-link ${locked ? 'locked' : ''}" x1="${(a.x - B.x).toFixed(2)}" y1="${(a.y - B.y).toFixed(2)}" x2="${(b.x - B.x).toFixed(2)}" y2="${(b.y - B.y).toFixed(2)}"/>`);
        }
    }
    const pins = [];
    for (const i of visited) {
        const r = roomRect(i);
        pins.push(`<span class="map-label" style="left:${pct(r.x + r.w / 2 - B.x, B.w)};top:${pct(r.y + r.h - B.y, B.h)}">${ROOMS[i].name}</span>`);
    }
    for (let i = 0; i < ROOM_COUNT; i++) {
        const boss = ROOMS[i].boss;
        if (!boss || !visited.has(i)) continue;
        const a = ROOMS[i].arena;
        const p = mapPoint(i, (a.x1 + a.x2) / 2, a.floor + 2);
        const beaten = !!d.achievements[boss];
        pins.push(`<span class="map-pin boss ${beaten ? 'beaten' : ''}" style="left:${pct(p.x - B.x, B.w)};top:${pct(p.y - B.y, B.h)}" title="${beaten ? BOSSES[boss].name + ' (derrotado)' : 'Guardião'}">${icon(beaten ? 'check' : 'boss')}</span>`);
    }
    for (const f of travelPoints(d)) {
        const p = mapPoint(f.level, f.x, f.y + 1);
        const resting = opts.restKey === f.key;
        const disabled = !opts.travel || resting;
        pins.push(`<button class="map-pin flag ${resting ? 'here' : ''}" data-act="${opts.act || 'map-travel'}" data-arg="${f.key}" style="left:${pct(p.x - B.x, B.w)};top:${pct(p.y - B.y, B.h)}" ${disabled ? 'aria-disabled="true"' : ''} title="${f.name}${resting ? ' (você está aqui)' : ''}">${icon('flag')}</button>`);
    }
    if (here) {
        const p = mapPoint(here.room, here.x, here.y + 0.5);
        pins.push(`<span class="map-pin you" style="left:${pct(p.x - B.x, B.w)};top:${pct(p.y - B.y, B.h)}" title="Você está aqui"></span>`);
    }
    return `<div class="map-canvas" style="aspect-ratio:${B.w.toFixed(2)} / ${B.h.toFixed(2)};width:min(100%, calc(56vh * ${(B.w / B.h).toFixed(3)}))">
        <svg viewBox="0 0 ${B.w.toFixed(2)} ${B.h.toFixed(2)}" preserveAspectRatio="none" aria-hidden="true">${links.join('')}${rects.join('')}</svg>
        ${pins.join('')}
    </div>`;
}

// Resumo textual do mapa: salas visitadas por reino.
export function mapSummary(d) {
    const { visited } = knownRooms(d);
    return Object.entries(REALMS).map(([id, realm]) => {
        const rooms = ROOMS.map((r, i) => i).filter(i => realmOfChapter(ROOMS[i].chapter) === id);
        const seen = rooms.filter(i => visited.has(i)).length;
        return { id, name: realm.name, seen, total: rooms.length };
    });
}
