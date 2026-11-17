import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, Save } from './helpers.mjs';
import { sanitizeSave } from '../js/core.js';
import { continueRoom, TOTAL_BERRIES, exploration } from '../js/campaign.js';
import { ROOMS, MAIN_COUNT, checkRooms, doorsOf, doorById, roomIndex } from '../js/worldMap.js';
import { STEP, PLAYER_HP, PH } from '../js/config.js';

const run = (game, seconds, each) => {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i++) {
        if (each) each(i);
        game.step(STEP);
        game.input.endFrame();
    }
};

const ALL_SKILLS = ['dash', 'wall_climb', 'double_jump', 'air_dash', 'ground_pound'];

// Coloca o jogador dentro de uma passagem e deixa o jogo processar a travessia.
function walkInto(game, id) {
    const door = game.doors.find(d => d.def.id === id);
    assert.ok(door, `passagem ${id} existe em ${game.level.name}`);
    let result = null;
    game.hooks.onComplete = r => { result = r; };
    if (door.kind === 'drop') {
        game.player.x = door.def.x + door.def.w / 2;
        game.player.y = door.def.y + door.def.h / 2;
    } else {
        game.player.x = door.x;
        game.player.y = door.y + 0.05;
    }
    game.player.vx = 0;
    game.player.vy = 0;
    run(game, 0.5);
    return result;
}

test('grafo do mundo: toda passagem leva a um destino existente e tem volta', () => {
    assert.deepEqual(checkRooms(), []);
    assert.equal(ROOMS.length, MAIN_COUNT + 4, '18 fases + 4 salas opcionais');
    for (let i = 0; i < MAIN_COUNT; i++) {
        assert.ok(doorById(i, 'out'), `${ROOMS[i].name} tem saída`);
        if (i > 0) assert.ok(doorById(i, 'in'), `${ROOMS[i].name} tem volta`);
    }
});

test('pontos de chegada: livres, com chão logo abaixo e fora da própria passagem', () => {
    for (let room = 0; room < ROOMS.length; room++) {
        const { game } = newGame(Math.min(room, MAIN_COUNT - 1), {}, { skills: ALL_SKILLS });
        // Volta pela passagem de uma arena: o chefe já caiu (e o chão dele continua lá).
        for (const r of ROOMS) if (r.boss) Save.data.achievements[r.boss] = true;
        game.load(room);
        for (const def of doorsOf(room)) {
            const s = def.spawn;
            assert.ok(!game.world.hits(s.x, s.y), `${ROOMS[room].name}/${def.id}: chegada dentro de bloco`);
            let drop = 0;
            while (drop < 6 && !game.world.hits(s.x, s.y - drop - 0.1)) drop += 0.1;
            assert.ok(drop < 6, `${ROOMS[room].name}/${def.id}: sem chão perto da chegada`);
            const door = game.doors.find(d => d.def === def);
            if (door && door.kind === 'arch') {
                assert.ok(!game.doorTouched(door, s.x, s.y + PH / 2), `${ROOMS[room].name}/${def.id}: chegada encosta na passagem`);
            }
        }
    }
});

test('atravessar a saída leva à próxima sala sem tela de resultado e mantém a vida', () => {
    const { game } = newGame(0);
    game.player.hp = 2;
    const r = walkInto(game, 'out');
    assert.ok(r, 'saída disparou');
    assert.deepEqual(r.target, { room: 1, door: 'in' });
    assert.equal(r.firstClear, true);
    assert.equal(Save.data.unlocked, 2);
    game.arrive(r.target);
    assert.equal(game.levelIndex, 1);
    assert.equal(game.player.hp, 2, 'vida mantida entre salas');
    assert.equal(game.player.x, doorById(1, 'in').spawn.x);
    const back = walkInto(game, 'in');
    assert.deepEqual(back.target, { room: 0, door: 'out' });
    assert.equal(back.travel, true);
    game.arrive(back.target);
    assert.equal(game.levelIndex, 0);
    assert.ok(game.player.x < doorById(0, 'out').x, 'volta aparece antes da saída');
});

test('chefe já derrotado: a arena fica vazia e a passagem, aberta', () => {
    const { game } = newGame(4);
    assert.ok(game.boss, 'chefe vivo na primeira visita');
    assert.ok(game.goal.locked);
    Save.data.achievements.boss1 = true;
    game.load(4);
    assert.equal(game.boss, null);
    assert.equal(game.gate, null);
    assert.equal(game.goal.locked, null);
});

test('morangos coletados não voltam e contam na exploração', () => {
    const { game } = newGame(0);
    const b = game.berries[0];
    const total = game.totalBerries;
    game.player.x = b.x;
    game.player.y = b.y - 0.4;
    run(game, 0.05);
    assert.equal(b.got, true);
    game.load(0);
    assert.equal(game.berries.length, total - 1);
    assert.equal(game.levelBerries, 1);
    assert.equal(game.totalBerries, total);
    assert.ok(exploration(Save.data).berries >= 1);
    assert.ok(TOTAL_BERRIES > 100);
});

test('checkpoint é save: Continuar volta à bandeira, e a morte em outra sala renasce nela', () => {
    const { game } = newGame(1);
    const flag = game.flags[0];
    game.player.x = flag.x;
    game.player.y = flag.y + 0.1;
    run(game, 0.05);
    const cp = Save.data.checkpoint;
    assert.equal(cp.level, 1);
    Save.load();
    Save.setActive(0);
    assert.deepEqual(continueRoom(Save.data), { room: 1, resume: Save.data.checkpoint });
    game.arrive({ room: 2, door: 'in' });
    assert.equal(game.levelIndex, 2);
    game.kill('spike');
    run(game, 1.2);
    assert.equal(game.levelIndex, 1, 'renasceu na sala do checkpoint');
    assert.equal(game.player.x, flag.x);
    assert.equal(game.player.hp, PLAYER_HP);
    assert.ok(game.flags.find(f => f.x === flag.x).active);
});

test('trocar habilidades em jogo: sem sobra de malhas e com a recarga preservada', () => {
    const { game } = newGame(6, {}, { abilities: { shockwave: 1, energy_shield: 1 } });
    const before = game.view.root.children.length;
    const shock = game.abilities.byId.get('shockwave');
    shock.cooldown = 3.5;
    Save.unequip('energy_shield');
    game.setLoadout();
    assert.equal(game.abilities.slots.length, 1);
    assert.equal(game.abilities.byId.get('shockwave').cooldown, 3.5, 'recarga mantida');
    Save.equip('energy_shield');
    game.setLoadout();
    assert.equal(game.view.root.children.length, before, 'malhas antigas removidas da cena');
    assert.equal(game.abilities.slots.length, 2);
});

test('Última Chance gasta continua gasta depois de tirar e recolocar', () => {
    const { game } = newGame(6, {}, { abilities: { last_stand: 1 } });
    game.abilities.byId.get('last_stand').spent = true;
    Save.unequip('last_stand');
    game.setLoadout();
    Save.equip('last_stand');
    game.setLoadout();
    assert.equal(game.abilities.byId.get('last_stand').spent, true);
});

test('travas: a Fenda pede o Dash Aéreo e o Veio só abre pelo lado do Inferno', () => {
    const { game } = newGame(3);
    const fenda = () => game.doors.find(d => d.def.id === 'fenda-templo');
    assert.ok(fenda().locked, 'sem Dash Aéreo');
    let notice = null;
    game.hooks.onDoorLocked = t => { notice = t; };
    assert.equal(walkInto(game, 'fenda-templo'), null);
    assert.ok(notice && notice.includes('Dash Aéreo'));
    Save.data.skills.push('air_dash');
    game.load(3);
    assert.equal(fenda().locked, null);

    const n = newGame(10, {}, { skills: ALL_SKILLS }).game;
    const nucleo = () => n.doors.find(d => d.def.id === 'veio-nucleo');
    assert.ok(nucleo().locked);
    n.load(roomIndex('veio'));
    const r = walkInto(n, 'veio-w');
    assert.deepEqual(r.target, { room: 10, door: 'veio-nucleo' });
    assert.equal(Save.data.world.opened.veio, true);
    n.arrive(r.target);
    assert.equal(nucleo().locked, null, 'aberta depois de atravessar pelo outro lado');
});

test('piso rachado da Cidade Antiga leva à Galeria e continua quebrado', () => {
    const { game } = newGame(1, {}, { skills: ALL_SKILLS });
    assert.equal(game.world.cell(35, 1), 'Y');
    game.breakCell(35, 1);
    game.breakCell(36, 1);
    game.load(1);
    assert.ok(!game.world.solid(35, 1), 'continua quebrado depois de recarregar');
    const r = walkInto(game, 'galeria-hole');
    assert.deepEqual(r.target, { room: roomIndex('galeria'), door: 'galeria-up' });
    game.arrive(r.target);
    assert.equal(game.level.name, 'Galeria Soterrada');
    run(game, 0.5);
    assert.equal(game.player.dead, false);
});

test('lava do Núcleo fica parada depois que a fase foi vencida', () => {
    const rising = newGame(10).game.hazards.find(h => h.y0 !== undefined && h.rise);
    assert.ok(rising, 'primeira subida: lava sobe');
    const { game } = newGame(10);
    Save.data.unlocked = 12;
    game.load(10);
    assert.ok(!game.hazards.some(h => h.y0 !== undefined && h.rise), 'na volta, parada');
});

test('migração v6 → v7: salas abertas viram visitadas e Continuar usa o checkpoint', () => {
    const d = sanitizeSave({ version: 6, unlocked: 5, checkpoint: { level: 3, x: 10, y: 2, time: 4 } });
    assert.equal(d.version, 7);
    for (let i = 0; i < 5; i++) assert.equal(d.world.visited[i], true);
    assert.deepEqual(d.world.flags, {});
    assert.deepEqual(continueRoom(d), { room: 3, resume: d.checkpoint });
    const fresh = sanitizeSave({ version: 6, unlocked: 7 });
    assert.deepEqual(continueRoom(fresh), { room: 6, resume: null });
    const junk = sanitizeSave({ version: 7, unlocked: 2, world: { visited: { 99: true, 1: 'x' }, collected: { 'bad': true, '0:3,4': true }, opened: { veio: true } } });
    assert.deepEqual(Object.keys(junk.world.visited).sort(), ['0', '1']);
    assert.deepEqual(junk.world.collected, { '0:3,4': true });
    assert.equal(junk.world.opened.veio, true);
});
