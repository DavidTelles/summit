import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, Save } from './helpers.mjs';
import { sanitizeSave } from '../js/core.js';
import { ROOMS, doorsOf, isRoom } from '../js/worldMap.js';
import { MERCHANTS, REWARDS, SHOP_ITEMS, buyError, itemById, remainingInRoom } from '../js/shop.js';
import { STEP } from '../js/config.js';

const run = (game, seconds, each) => {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i++) {
        if (each) each(i);
        game.step(STEP);
        game.input.endFrame();
    }
};

const SOLID = new Set(['#']);

test('save v7 migrado ganha Mapa e Bússola; save novo começa sem nada', () => {
    const old = sanitizeSave({ version: 7, unlocked: 3 });
    assert.equal(old.version, 8);
    assert.equal(old.items.map, true);
    assert.equal(old.items.compass, true);
    assert.equal(old.items.collector, false);
    assert.equal(old.items.warp_stone, 0);
    assert.equal(old.shards, 0);

    newGame(0);
    const d = Save.data;
    assert.deepEqual(d.items, { map: false, compass: false, collector: false, warp_stone: 0 });
    assert.equal(d.shards, 0);

    const junk = sanitizeSave({ version: 8, shards: -5, items: { map: 'yes', compass: true, warp_stone: 99 } });
    assert.equal(junk.shards, 0);
    assert.equal(junk.items.map, false);
    assert.equal(junk.items.compass, true);
    assert.equal(junk.items.warp_stone, itemById('warp_stone').max, 'pedras limitadas ao máximo');
});

test('cacos: morango, inimigo e registro pagam; o save guarda o saldo', () => {
    const { game } = newGame(0);
    const berry = game.berries[0];
    game.collectBerry(berry);
    assert.equal(Save.data.shards, REWARDS.berry);

    const room = ROOMS.findIndex((r, i) => i < 18 && r.grid.cells.some(row => Array.from(row).some(c => c === 'E')));
    game.load(room);
    const e = game.enemies.find(en => en.alive);
    assert.ok(e, 'há inimigo para derrotar');
    game.onEnemyKilled(e, 'dash', game.player);
    assert.equal(Save.data.shards, REWARDS.berry + REWARDS.enemy);

    const stoneRoom = ROOMS.findIndex((_, i) => { game.load(i); return game.recordStones.length > 0; });
    assert.ok(stoneRoom >= 0, 'há uma pedra de registro');
    game.collectRecord(game.recordStones[0]);
    assert.equal(Save.data.shards, REWARDS.berry + REWARDS.enemy + REWARDS.record);
});

test('chefe paga cacos só na primeira vitória', () => {
    const { game } = newGame(4);
    game.bossDefeated();
    assert.equal(Save.data.shards, REWARDS.boss);
    game.bossDefeated();
    assert.equal(Save.data.shards, REWARDS.boss, 'segunda vitória não paga de novo');
});

test('regras de compra: saldo, item repetido, mochila cheia e dependência do mapa', () => {
    newGame(0);
    const d = Save.data;
    assert.equal(Save.buy('map'), 'Cacos insuficientes.');
    d.shards = 500;
    assert.match(buyError(d, 'collector'), /Mapa/);
    assert.equal(Save.buy('map'), null);
    assert.equal(d.items.map, true);
    assert.equal(d.shards, 500 - itemById('map').price);
    assert.equal(Save.buy('map'), 'Você já tem.');
    assert.equal(Save.buy('collector'), null);
    for (let i = 0; i < 3; i++) assert.equal(Save.buy('warp_stone'), null);
    assert.match(Save.buy('warp_stone'), /Mochila cheia/);
    assert.equal(d.items.warp_stone, 3);
    assert.equal(Save.useWarpStone(), true);
    assert.equal(d.items.warp_stone, 2);
    const spent = SHOP_ITEMS.filter(i => i.id !== 'compass').reduce((s, i) => s + i.price * (i.id === 'warp_stone' ? 3 : 1), 0);
    assert.equal(d.shards, 500 - spent);
    d.items.warp_stone = 0;
    assert.equal(Save.useWarpStone(), false);
});

test('Amuleto do Coletor: conta morangos e registros que faltam na sala', () => {
    const { game } = newGame(0);
    const before = remainingInRoom(Save.data, 0);
    assert.equal(before.berries, game.berries.length);
    game.collectBerry(game.berries[0]);
    assert.equal(remainingInRoom(Save.data, 0).berries, before.berries - 1);
});

test('mercadores: no chão, livres e longe de espinhos, passagens e inimigos', () => {
    for (const m of MERCHANTS) {
        assert.ok(isRoom(m.room), `sala ${m.room} existe`);
        const g = ROOMS[m.room].grid;
        const tx = Math.floor(m.x);
        const cell = (x, y) => g.cells[y][x];
        for (const x of [tx - 1, tx, tx + 1]) {
            assert.ok(SOLID.has(cell(x, m.y - 1)), `${ROOMS[m.room].name}: chão sólido sob x=${x}`);
            assert.equal(cell(x, m.y), '.', `${ROOMS[m.room].name}: espaço livre em x=${x}`);
            assert.equal(cell(x, m.y + 1), '.', `${ROOMS[m.room].name}: espaço livre acima em x=${x}`);
        }
        for (let y = m.y - 1; y <= m.y + 3; y++) {
            for (let x = tx - 3; x <= tx + 3; x++) {
                assert.ok(!'^vEFK'.includes(cell(x, y)), `${ROOMS[m.room].name}: "${cell(x, y)}" perto do mercador em ${x},${y}`);
            }
        }
        for (const door of doorsOf(m.room)) {
            if (door.y === undefined || door.x === undefined) continue;
            assert.ok(Math.abs(door.x - m.x) >= 3 || Math.abs(door.y - m.y) > 3, `${ROOMS[m.room].name}: longe da passagem ${door.id}`);
        }
    }
});

test('perto do mercador: aviso aparece, saudação uma vez e ↑ abre a loja', () => {
    const near = [];
    let opened = 0;
    const lines = [];
    const hooks = {
        onMerchantNear(v) { near.push(v); },
        onMerchant() { opened++; },
        onStoryLine(text, who) { lines.push(who); }
    };
    const { game, input } = newGame(0, hooks);
    const m = MERCHANTS.find(x => x.room === 0);
    assert.ok(game.merchant, 'a Base do Acampamento tem mercador');
    game.player.x = m.x + 0.6;
    game.player.y = m.y;
    run(game, 0.3);
    assert.deepEqual(near, [true]);
    assert.equal(lines.filter(w => /Mascate/.test(w)).length, 1, 'saudação na primeira visita');
    assert.equal(opened, 0, 'só abre com ↑');
    input.press('ArrowUp');
    run(game, 0.05);
    assert.equal(opened, 1);
    game.player.x = m.x + 12;
    run(game, 0.2);
    assert.deepEqual(near, [true, false]);
    game.player.x = m.x;
    run(game, 0.2);
    assert.equal(lines.filter(w => /Mascate/.test(w)).length, 1, 'saudação não se repete');

    game.load(1);
    assert.equal(game.merchant, null, 'Cidade Antiga não tem mercador');
    assert.equal(near[near.length - 1], false, 'trocar de sala esconde o aviso');
});

test('loja sem luta: ↑ não abre a loja durante luta de chefe', () => {
    const { game } = newGame(0, { onMerchant() { throw new Error('não deveria abrir'); } });
    game.boss = { alive: true, mode: 'fight' };
    assert.equal(game.inBossFight(), true);
    game.boss = null;
    assert.equal(game.inBossFight(), false);
});
