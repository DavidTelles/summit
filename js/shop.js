import { ROOMS } from './worldMap.js';
import { RECORDS } from './story.js';

// Loja do mascate: moeda, ganhos, itens à venda e onde o mercador aparece no mundo.
// Tudo aqui é dado puro ou regra sem efeito colateral; o Save aplica e grava.
export const CURRENCY = { name: 'Cacos de Éter', short: 'Cacos', icon: 'shard' };

// Cacos ganhos por ação. O chefe só paga na primeira vitória.
export const REWARDS = { enemy: 1, berry: 3, record: 5, boss: 30 };

export const MERCHANT_NAME = 'Bento, o Mascate';

export const SHOP_ITEMS = [
    {
        id: 'map', name: 'Mapa do Cartógrafo', icon: 'map', price: 15, kind: 'key',
        desc: 'Desenha as salas por onde você passou e as passagens entre elas. Abre a aba Mapa do inventário.',
        pitch: 'Um mapa! Sem ele, qualquer montanha é um labirinto.'
    },
    {
        id: 'compass', name: 'Bússola', icon: 'compass', price: 30, kind: 'key',
        desc: 'Mostra no mapa a sala e o ponto exato onde você está.',
        pitch: 'A agulha aponta para quem a carrega. Útil, não?'
    },
    {
        id: 'warp_stone', name: 'Pedra de Teletransporte', icon: 'warp', price: 20, kind: 'stack', max: 3,
        desc: 'Uma viagem rápida pelo mapa de qualquer lugar, sem precisar de checkpoint. Some ao ser usada. Não funciona em luta de chefe.',
        pitch: 'Aperte a pedra, pense numa bandeira, e pronto. Só uma vez cada.'
    },
    {
        id: 'collector', name: 'Amuleto do Coletor', icon: 'amulet', price: 60, kind: 'key', requires: 'map',
        desc: 'O mapa passa a mostrar quantos morangos e registros ainda faltam em cada sala visitada.',
        pitch: 'Ele zumbe perto de coisas esquecidas. Combina com um mapa.'
    }
];

export const itemById = id => SHOP_ITEMS.find(i => i.id === id) || null;
export const ITEM_IDS = SHOP_ITEMS.map(i => i.id);

// x: centro do mercador; y: linha do chão onde ele fica (a célula y - 1 é sólida).
// Um por reino, logo na entrada: Montanha, Inferno e Céu.
export const MERCHANTS = [
    { room: 0, x: 10.5, y: 2 },
    { room: 12, x: 8.5, y: 2 },
    { room: 15, x: 8.5, y: 2 }
];

export const merchantIn = room => MERCHANTS.find(m => m.room === room) || null;

export function emptyItems() {
    return { map: false, compass: false, collector: false, warp_stone: 0 };
}

export function itemCount(d, id) {
    const v = d.items ? d.items[id] : 0;
    return typeof v === 'number' ? v : v ? 1 : 0;
}

export const hasItem = (d, id) => itemCount(d, id) > 0;

// Motivo para não poder comprar, ou null se a compra é possível.
export function buyError(d, id) {
    const item = itemById(id);
    if (!item) return 'Item desconhecido.';
    if (item.kind === 'key' && hasItem(d, id)) return 'Você já tem.';
    if (item.kind === 'stack' && itemCount(d, id) >= item.max) return `Mochila cheia (${item.max}/${item.max}).`;
    if (item.requires && !hasItem(d, item.requires)) return `Precisa do ${itemById(item.requires).name}.`;
    if ((d.shards || 0) < item.price) return 'Cacos insuficientes.';
    return null;
}

export function applyPurchase(d, id) {
    const error = buyError(d, id);
    if (error) return error;
    const item = itemById(id);
    d.shards -= item.price;
    if (item.kind === 'stack') d.items[id] = itemCount(d, id) + 1;
    else d.items[id] = true;
    return null;
}

const BERRY_CELLS = ROOMS.map(r => {
    const list = [];
    r.grid.cells.forEach((row, y) => Array.from(row).forEach((c, x) => { if (c === 'S') list.push(`${x},${y}`); }));
    return list;
});

// Morangos e registros que ainda faltam numa sala (usado pelo Amuleto do Coletor).
export function remainingInRoom(d, room) {
    const collected = (d.world && d.world.collected) || {};
    const berries = (BERRY_CELLS[room] || []).filter(k => !collected[`${room}:${k}`]).length;
    const found = (d.story && d.story.records) || {};
    const records = RECORDS.filter(r => r.level === room && !r.auto && !found[r.id]).length;
    return { berries, records };
}
