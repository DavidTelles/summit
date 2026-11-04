import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, Save, LEVELS, memoryStore, fakeView, FakeInput, Game } from './helpers.mjs';
import { sanitizeSave, Settings, ACHIEVEMENTS, achievementProgress } from '../js/core.js';
import { ABILITIES, CATEGORIES, meetsReq } from '../js/abilities.js';
import { campaignProgress, continueLevel, exploration, levelObjectives, levelRewards, levelStatus, resumeFor, TOTAL_SECRETS } from '../js/campaign.js';
import { STEP, JUMP, PLAYER_HP, STAMINA_MAX, DASH_TIME, DASH_SPEED } from '../js/config.js';
import { Shot } from '../js/hazards.js';

const KEYS = ['KeyQ', 'KeyE', 'KeyF'];
const run = (game, seconds, each) => {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i++) {
        if (each) each(i);
        game.step(STEP);
        game.input.endFrame();
    }
};
const cast = (game, slot = 0) => {
    game.input.press(KEYS[slot]);
    game.step(STEP);
    game.input.endFrame();
};
const setup = (index, abilities, opts = {}) => {
    const r = newGame(index, opts.hooks || {}, { abilities, mode: opts.mode, skills: opts.skills });
    run(r.game, 0.4);
    return r;
};
const slot = (game, id) => game.abilities.byId.get(id);
const placeNear = (game, e, dx = 1) => {
    game.player.x = e.x + dx;
    game.player.y = e.y;
    game.player.vx = 0;
    game.player.vy = 0;
};

function fullProgress(raw = {}) {
    return sanitizeSave({
        version: 3, unlocked: 12, currentLevel: 11, stomps: 99, berries: 99, crystals: 99,
        secrets: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 },
        completedChapters: [1, 2, 3],
        best: { 11: { time: 100, berries: 3 } },
        achievements: { boss1: true, boss2: true, boss3: true, no_death: true, crystal_10: true, trial_ch3: true },
        ...raw
    });
}

test('catálogo: cada habilidade tem dados completos em todas as categorias', () => {
    for (const c of CATEGORIES) assert.ok(ABILITIES.filter(a => a.category === c.id).length >= 3, c.id);
    assert.equal(new Set(ABILITIES.map(a => a.id)).size, ABILITIES.length);
    for (const a of ABILITIES) {
        for (const key of ['name', 'icon', 'category', 'type', 'desc', 'unlock']) assert.ok(a[key], `${a.id}.${key}`);
        assert.ok(a.levels.length >= 2, a.id);
        a.levels.forEach((l, i) => {
            assert.ok(l.text, `${a.id} nível ${i + 1}`);
            if (i > 0) assert.ok(l.req, `${a.id} nível ${i + 1} sem requisito`);
            if (a.type === 'active') assert.ok(l.cooldown > 0, `${a.id} sem recarga`);
        });
    }
});

test('desbloqueio: toda habilidade e evolução é alcançável numa campanha, sem exigir morte', () => {
    const d = fullProgress();
    for (const a of ABILITIES) {
        assert.ok(d.abilities[a.id], `${a.id} inalcançável`);
        for (const l of a.levels.slice(1)) assert.ok(meetsReq(l.req, d), `${a.id}: ${JSON.stringify(l.req)}`);
    }
});

test('desbloqueio progressivo: começa só com Onda de Choque e avança com a campanha', () => {
    const { game } = newGame(0);
    const hooks = [];
    game.hooks.onAbilityUnlock = a => hooks.push(a.id);
    assert.deepEqual(Object.keys(Save.data.abilities), ['shockwave']);
    game.complete();
    assert.ok(Save.data.abilities.energy_shield);
    assert.ok(hooks.includes('energy_shield'));
    assert.ok(game.completeResult.newAbilities.some(a => a.id === 'energy_shield'));
    assert.ok(Save.data.abilities.last_stand, 'concluir sem morrer libera Última Chance');
    assert.ok(!Save.data.abilities.recall);
});

test('migração v2: mantém recordes e checkpoint, concede habilidades pelo histórico e não equipa nada à força', () => {
    const d = sanitizeSave({
        version: 2, mode: 'normal', unlocked: 7, currentLevel: 6, deaths: 4, stomps: 9, berries: 10,
        best: { 0: { time: 10, berries: 1 }, 5: { time: 50, berries: 6 } },
        achievements: { boss1: true }, completedChapters: [1],
        checkpoint: { level: 6, x: 10, y: 4, time: 3 }
    });
    assert.equal(d.version, 3);
    assert.ok(d.best[5], 'recorde de fase redesenhada preservado');
    assert.deepEqual(d.checkpoint, { level: 6, x: 10, y: 4, time: 3 });
    for (const id of ['shockwave', 'energy_shield', 'long_dash', 'heal', 'perception', 'recall', 'air_burst', 'perfect_dodge', 'glide']) assert.ok(d.abilities[id], id);
    assert.ok(!d.abilities.time_dilation);
    assert.deepEqual(d.loadout, []);
});

test('sanitização: seleção inválida é limpa e níveis ficam no limite', () => {
    const d = sanitizeSave({
        version: 3, abilities: { shockwave: 99, heal: 1, focus: 1, glide: 2, fake: 3 },
        loadout: ['shockwave', 'shockwave', 'fake', 'recall', 'heal', 'focus', 'glide']
    });
    assert.equal(d.abilities.shockwave, 3);
    assert.equal(d.abilities.fake, undefined);
    assert.deepEqual(d.loadout, ['shockwave', 'heal', 'focus']);
});

test('seleção: limite de 3, sem repetir, sem bloqueadas, com menos de 3 permitido', () => {
    newGame(0);
    const d = Save.data;
    Object.assign(d.abilities, { heal: 1, glide: 1, focus: 1 });
    assert.ok(Save.equip('recall'), 'bloqueada recusada');
    assert.equal(Save.equip('shockwave'), null);
    assert.ok(Save.equip('shockwave'), 'repetida recusada');
    assert.equal(Save.equip('heal'), null);
    assert.equal(Save.equip('glide'), null);
    assert.ok(Save.equip('focus'), 'quarta recusada');
    assert.equal(d.loadout.length, 3);
    assert.ok(Save.unequip('heal'));
    assert.equal(Save.equip('focus'), null);
    assert.deepEqual(d.loadout, ['shockwave', 'glide', 'focus']);
    Save.load();
    Save.setActive(0);
    assert.deepEqual(Save.data.loadout, ['shockwave', 'glide', 'focus'], 'seleção persiste');
    Save.clearLoadout();
    const game = new Game(fakeView(), { onHud() {} }, new FakeInput());
    game.load(0);
    assert.equal(game.abilities.slots.length, 0, 'fase inicia sem habilidades');
});

test('evolução: exige requisito, aumenta o nível e altera o efeito real', () => {
    const { game } = newGame(0, {}, { abilities: { shockwave: 1 } });
    assert.equal(Save.upgradeAbility('shockwave'), false, 'requisito não cumprido');
    Save.data.completedChapters.push(1);
    assert.equal(Save.upgradeAbility('shockwave'), true);
    assert.equal(Save.data.abilities.shockwave, 2);
    game.load(0);
    assert.equal(slot(game, 'shockwave').stats.radius, 4.5);
    assert.equal(Save.upgradeAbility('shockwave'), false);
    Save.data.completedChapters.push(2);
    Save.upgradeAbility('shockwave');
    assert.equal(Save.nextAbilityLevel('shockwave'), null);
    assert.equal(Save.upgradeAbility('shockwave'), false, 'nível máximo');
});

test('isolamento: habilidades, níveis e seleção de um save não vazam para outro', () => {
    newGame(0);
    Save.create(0, 'normal');
    Save.data.abilities.heal = 3;
    Save.data.loadout = ['heal'];
    Save.data.deaths = 5;
    Save.save();
    Save.create(1, 'permadeath');
    assert.deepEqual(Save.data.loadout, ['shockwave']);
    assert.equal(Save.data.abilities.heal, undefined);
    Save.data.abilities.glide = 2;
    Save.data.loadout = ['glide'];
    Save.save();
    Save.create(2, 'normal');
    Save.save();
    const before = memoryStore.get('summit_slot_0');
    Save.setActive(1);
    Save.deleteSlot(1);
    assert.equal(Save.slot(1), null);
    assert.equal(memoryStore.get('summit_slot_1'), undefined);
    assert.equal(memoryStore.get('summit_slot_0'), before, 'slot 0 intacto após apagar slot 1');
    Save.load();
    assert.equal(Save.slot(0).abilities.heal, 3);
    assert.deepEqual(Save.slot(0).loadout, ['heal']);
    assert.equal(Save.slot(0).abilities.glide, undefined);
    assert.ok(Save.slot(2));
    const game = new Game(fakeView(), { onHud() {} }, new FakeInput());
    Save.setActive(0);
    game.load(0);
    assert.deepEqual(game.abilities.slots.map(s => s.id), ['heal']);
    Save.setActive(2);
    game.load(0);
    assert.deepEqual(game.abilities.slots.map(s => s.id), ['shockwave']);
});

test('sair do save: mantém os dados, desativa a campanha e não reescreve sem necessidade', () => {
    newGame(0);
    Save.data.deaths = 3;
    Save.save();
    const stored = memoryStore.get('summit_slot_0');
    Save.flush();
    assert.equal(memoryStore.get('summit_slot_0'), stored, 'sem pendências, nada muda');
    Save.data.deaths = 4;
    Save.flush();
    assert.equal(JSON.parse(memoryStore.get('summit_slot_0')).deaths, 4, 'pendência é salva');
    Save.clearActive();
    assert.equal(Save.active, -1);
    assert.equal(memoryStore.get('summit_active_slot'), undefined);
    assert.equal(Save.slot(0).deaths, 4);
    Save.load();
    assert.equal(Save.slot(0).deaths, 4);
});

test('Onda de Choque: derrota inimigo próximo, apaga tiro, gasta fôlego e entra em recarga', () => {
    const { game } = setup(0, { shockwave: 1 });
    const e = game.enemies[0];
    placeNear(game, e, 2);
    const shot = new Shot(game, game.player.x + 2, game.player.y + 1, 0, 0, {});
    game.addShot(shot);
    const stamina = game.player.stamina;
    cast(game);
    assert.equal(e.alive, false);
    assert.ok(shot.done);
    assert.ok(game.player.stamina <= stamina - 1 + 0.01);
    run(game, 0.5);
    assert.ok(game.player.stamina < stamina, 'custo não volta na hora no chão');
    run(game, 1.2);
    assert.equal(game.player.stamina, stamina, 'fôlego volta após a espera');
    const s = slot(game, 'shockwave');
    assert.ok(s.cooldown > 6);
    assert.ok(Save.data.stomps >= 1);
    assert.equal(Save.data.abilityUses, 1);
    cast(game);
    assert.ok(s.denied > 0, 'indisponível dá retorno');
    assert.equal(s.message, 'Recarregando');
    run(game, 7.5);
    assert.equal(s.cooldown, 0);
});

test('Onda de Choque recusa sem fôlego e não entra em recarga', () => {
    const { game } = setup(0, { shockwave: 1 });
    game.player.stamina = 0.2;
    game.player.onGround = false;
    game.input.press('KeyQ');
    const s = slot(game, 'shockwave');
    game.abilities.activate(s, game.player);
    assert.equal(s.message, 'Fôlego insuficiente');
    assert.equal(s.cooldown, 0);
});

test('todas as habilidades atingem os três chefes só quando vulneráveis', () => {
    for (const index of [4, 8, 11]) {
        const { game } = setup(index, { shockwave: 3 });
        const b = game.boss;
        game.startBoss();
        run(game, 3);
        assert.equal(b.mode, 'fight', `fase ${index + 1}`);
        game.hurtPlayer = () => {};
        game.kill = () => {};
        const hp = b.hp;
        b.vulnerable = false;
        game.player.x = b.x;
        game.player.y = b.y;
        cast(game);
        assert.equal(b.hp, hp, 'chefe protegido não perde vida');
        slot(game, 'shockwave').cooldown = 0;
        b.vulnerable = true;
        b.invuln = 0;
        cast(game);
        assert.equal(b.hp, hp - 1, `chefe da fase ${index + 1} sofre dano`);
    }
});

test('Lança de Luz: viaja, atravessa inimigos e ignora escudo frontal, para em parede', () => {
    const { game } = setup(6, { light_lance: 1 });
    const shield = game.enemies.find(e => e.constructor.name === 'Shield');
    assert.ok(shield);
    game.hurtPlayer = () => {};
    const p = game.player;
    p.x = shield.x + shield.dir * 4;
    p.y = shield.y;
    p.vx = 0;
    p.facing = -shield.dir;
    assert.equal(shield.receive('dash', game, p), 'blocked', 'dash frontal é bloqueado');
    cast(game);
    assert.equal(game.abilities.effects.length, 1);
    run(game, 0.3);
    assert.equal(shield.alive, false);
    run(game, 0.6);
    assert.equal(game.abilities.effects.length, 0, 'projétil é descartado');
});

test('Lâmina Energizada: dash atravessa escudo, tem alcance maior e devolve dash no nível 2', () => {
    const { game } = setup(6, { blade_dash: 2 });
    const p = game.player;
    assert.equal(game.attackKind(p, 0), null);
    cast(game);
    p.dashTimer = 0.1;
    assert.equal(game.attackKind(p, 0), 'blade');
    assert.ok(game.abilities.hitReach(p) > 1);
    const shield = game.enemies.find(e => e.constructor.name === 'Shield');
    assert.notEqual(shield.receive('blade', game, p), 'blocked');
    p.dashes = 0;
    game.onEnemyKilled(shield, 'blade', p);
    assert.equal(p.dashes, game.maxDashes());
    p.dashTimer = 0;
    run(game, 7.1);
    assert.equal(game.abilities.isActive('blade_dash'), false);
    assert.ok(slot(game, 'blade_dash').cooldown > 0);
});

test('Contra-ataque: anula golpe na janela, revida em área e falha fora dela', () => {
    const { game } = setup(0, { riposte: 1 });
    const p = game.player;
    const e = game.enemies[0];
    placeNear(game, e, 1.5);
    cast(game);
    game.hurtPlayer(1, e.x);
    assert.equal(p.hp, PLAYER_HP);
    assert.equal(e.alive, false);
    assert.equal(slot(game, 'riposte').active, 0);
    assert.ok(slot(game, 'riposte').cooldown > 0);
    p.iframes = 0;
    game.hurtPlayer(1, p.x - 1);
    assert.equal(p.hp, PLAYER_HP - 1, 'sem guarda, leva dano');
});

test('Escudo de Energia: absorve o número certo de golpes e não salva de espinhos', () => {
    const { game } = setup(0, { energy_shield: 3 });
    const p = game.player;
    cast(game);
    assert.equal(slot(game, 'energy_shield').charges, 2);
    game.hurtPlayer(1, p.x - 1);
    p.iframes = 0;
    game.hurtPlayer(1, p.x - 1);
    assert.equal(p.hp, PLAYER_HP);
    assert.equal(game.abilities.isActive('energy_shield'), false);
    p.iframes = 0;
    game.hurtPlayer(1, p.x - 1);
    assert.equal(p.hp, PLAYER_HP - 1);
    const r = setup(0, { energy_shield: 1 });
    cast(r.game);
    r.game.kill('spike');
    assert.equal(r.game.player.dead, true);
});

test('Reflexo Instintivo: imune durante o dash e na janela do nível, recupera dash no nível 3', () => {
    const { game } = setup(0, { perfect_dodge: 3 });
    const p = game.player;
    game.input.press('KeyX');
    game.step(STEP);
    game.input.endFrame();
    assert.ok(p.dashTimer > 0);
    game.hurtPlayer(1, p.x - 1);
    assert.equal(p.hp, PLAYER_HP);
    assert.ok(p.dashes >= 1, 'dash recuperado');
    run(game, DASH_TIME + 0.1);
    assert.equal(p.dashTimer <= 0, true);
    game.hurtPlayer(1, p.x - 1);
    assert.equal(p.hp, PLAYER_HP, 'janela extra');
    run(game, 0.4);
    game.hurtPlayer(1, p.x - 1);
    assert.equal(p.hp, PLAYER_HP - 1, 'fim da janela');
});

test('Regeneração: cura depois do intervalo e um golpe zera o contador', () => {
    const { game } = setup(0, { regeneration: 3 });
    const p = game.player;
    p.hp = 1;
    run(game, 9);
    assert.equal(p.hp, 1);
    p.iframes = 0;
    p.hp = 2;
    game.hurtPlayer(1, p.x - 1);
    assert.equal(p.hp, 1);
    run(game, 9);
    assert.equal(p.hp, 1, 'contador zerado pelo golpe');
    run(game, 1.2);
    assert.equal(p.hp, 2);
});

test('Última Chance: sobrevive uma vez por fase, recarga e espinhos por nível, em Morte Súbita preserva o save', () => {
    const { game } = setup(0, { last_stand: 1 }, { mode: 'permadeath' });
    const p = game.player;
    p.hp = 1;
    game.hurtPlayer(1, p.x - 1);
    assert.equal(p.dead, false);
    assert.equal(p.hp, 1);
    assert.ok(p.iframes > 1.5);
    assert.ok(Save.slot(0), 'save mantido');
    p.iframes = 0;
    game.hurtPlayer(1, p.x - 1);
    assert.equal(p.dead, true, 'só uma vez');
    assert.equal(game.permadeathPending, true, 'segunda morte conta em Morte Súbita');

    const l1 = setup(0, { last_stand: 1 }).game;
    l1.kill('spike');
    assert.equal(l1.player.dead, true, 'nível 1 não salva de espinhos');

    const l3 = setup(0, { last_stand: 3 }).game;
    l3.kill('spike');
    assert.equal(l3.player.dead, false);
    assert.ok(l3.player.vy > 0);
    assert.ok(l3.abilities.spikeGrace > 0);
    l3.abilities.onCheckpoint();
    l3.kill('fall');
    assert.equal(l3.player.dead, true, 'queda é sempre fatal');
    run(l3, 1);
    assert.equal(slot(l3, 'last_stand').spent, false, 'nível 2+ recarrega no checkpoint');
});

test('Dash Longo: distância real aumenta conforme o nível', () => {
    const distance = abilities => {
        const { game } = setup(0, abilities);
        const x0 = game.player.x;
        game.input.ix = 1;
        game.input.press('KeyX');
        game.step(STEP);
        game.input.endFrame();
        game.input.ix = 0;
        while (game.player.dashTimer > 0) game.step(STEP);
        return game.player.x - x0;
    };
    const base = distance({});
    const boosted = distance({ long_dash: 3 });
    assert.ok(Math.abs(base - DASH_TIME * DASH_SPEED) < 0.4, `base ${base}`);
    assert.ok(boosted > base * 1.5, `${boosted} vs ${base}`);
});

test('Impulso Aéreo: recusa no chão e impulsiona no ar', () => {
    const { game } = setup(0, { air_burst: 3 });
    const p = game.player;
    cast(game);
    assert.equal(slot(game, 'air_burst').message, 'Só funciona no ar');
    assert.equal(slot(game, 'air_burst').cooldown, 0);
    p.y += 6;
    p.vy = -10;
    p.doubleJumpAvailable = false;
    run(game, 0.02);
    cast(game);
    assert.ok(p.vy > JUMP * 0.9);
    assert.equal(p.doubleJumpAvailable, true);
});

test('Queda Controlada: segurar Pular reduz a queda e gasta fôlego', () => {
    const fall = abilities => {
        const { game, input } = setup(0, abilities);
        const p = game.player;
        p.y += 12;
        p.vy = -2;
        input.held.add('Space');
        const stamina = p.stamina;
        run(game, 0.7);
        return { vy: p.vy, drained: stamina - p.stamina, gliding: p.gliding };
    };
    const off = fall({});
    const on = fall({ glide: 1 });
    assert.ok(on.vy > off.vy + 5, `${on.vy} vs ${off.vy}`);
    assert.ok(on.vy >= -3.3);
    assert.ok(on.drained > 0.5);
    assert.equal(on.gliding, true);
    assert.equal(off.drained, 0);
});

test('Elo de Cristal: voa até o cristal e o consome, recusa sem cristal ao alcance', () => {
    const { game } = setup(0, { crystal_link: 1 });
    const p = game.player;
    cast(game);
    assert.equal(slot(game, 'crystal_link').message, 'Nenhum cristal ao alcance');
    assert.equal(slot(game, 'crystal_link').cooldown, 0);
    const c = game.crystals[0];
    p.x = c.x - 5;
    p.y = c.y - 0.4;
    p.vy = 0;
    cast(game);
    assert.ok(slot(game, 'crystal_link').cooldown > 0);
    run(game, 0.4);
    assert.ok(c.cool > 0, 'cristal consumido');
    assert.ok(Math.abs(p.x - c.x) < 3);
});

test('Recuperação: recusa com vida cheia e cura com custo', () => {
    const { game } = setup(0, { heal: 3 });
    const p = game.player;
    cast(game);
    assert.equal(slot(game, 'heal').message, 'Vida cheia');
    assert.equal(slot(game, 'heal').cooldown, 0);
    p.hp = 1;
    cast(game);
    assert.equal(p.hp, 3);
    assert.ok(p.stamina <= STAMINA_MAX - 2 + 0.01);
});

test('Segundo Fôlego: enche o fôlego e impede gasto durante o efeito', () => {
    const { game } = setup(0, { second_wind: 1, shockwave: 1 });
    const p = game.player;
    p.stamina = 1;
    cast(game, 0);
    assert.equal(p.stamina, STAMINA_MAX);
    assert.equal(game.abilities.staminaScale(), 0);
    cast(game, 1);
    assert.equal(p.stamina, STAMINA_MAX, 'custo ignorado');
});

test('Percepção: alerta perto de parede rachada e área secreta, silenciosa longe', () => {
    const { game } = setup(5, { perception: 1 });
    const s = slot(game, 'perception');
    run(game, 0.6);
    assert.equal(s.alert, false);
    game.hurtPlayer = () => {};
    game.kill = () => {};
    const crack = [...game.specialBlocks.values()].find(b => b.kind === 'X');
    game.player.x = crack.mesh.position.x - 3;
    game.player.y = crack.mesh.position.y;
    run(game, 0.6);
    assert.equal(s.alert, true);
});

test('Concentração: acelera a recarga das outras habilidades e exige outra ativável', () => {
    const { game } = setup(0, { focus: 3, shockwave: 1 });
    const wave = slot(game, 'shockwave');
    cast(game, 1);
    const start = wave.cooldown;
    cast(game, 0);
    run(game, 1);
    assert.ok(start - wave.cooldown > 2.8, `${start - wave.cooldown}`);
    const alone = setup(0, { focus: 1 }).game;
    cast(alone, 0);
    assert.equal(slot(alone, 'focus').message, 'Equipe outra habilidade ativável');
    assert.equal(slot(alone, 'focus').active, 0);
});

test('Firmeza: remove recuo e atordoamento, reduz vento e prolonga invulnerabilidade', () => {
    const { game } = setup(0, { steadfast: 3 });
    const p = game.player;
    game.hurtPlayer(1, p.x - 1);
    assert.equal(p.hp, PLAYER_HP - 1);
    assert.equal(p.vx, 0);
    assert.equal(p.hurtTimer, 0);
    assert.ok(p.iframes > 1.5);
    assert.equal(game.abilities.windScale(), 0.25);
    const vento = setup(5, { steadfast: 3 }).game;
    const gust = vento.hazards.find(h => h.type === 'gust' && h.fx);
    assert.ok(gust);
    vento.player.x = gust.x + gust.w / 2;
    vento.player.y = gust.y + 1;
    const x0 = vento.player.x;
    gust.phase = -vento.clock;
    gust.update(vento, 0.1, vento.player);
    assert.ok(Math.abs(vento.player.x - x0) <= Math.abs(gust.fx) * 0.1 * 0.25 + 1e-6);
});

test('Retorno: marca, volta, recusa marca bloqueada e limpa ao iniciar chefe', () => {
    const { game } = setup(0, { recall: 1 });
    const p = game.player;
    const x0 = p.x;
    const y0 = p.y;
    cast(game);
    const s = slot(game, 'recall');
    assert.ok(s.marker);
    p.x += 5;
    cast(game);
    assert.ok(Math.abs(p.x - x0) < 0.2 && Math.abs(p.y - y0) < 0.2);
    assert.equal(s.marker, null);
    assert.ok(s.cooldown > 0);
    s.cooldown = 0;
    cast(game);
    run(game, 6.2);
    assert.equal(s.marker, null, 'marca expira');
    assert.ok(s.cooldown > 0);

    const boss = setup(4, { recall: 1 }).game;
    cast(boss);
    boss.startBoss();
    assert.equal(slot(boss, 'recall').marker, null, 'sem fuga da arena');
});

test('Tempo Suspenso: mundo desacelera e jogador não', () => {
    const { game, input } = setup(0, { time_dilation: 1 });
    const flyerGame = game;
    const clock = flyerGame.clock;
    cast(game);
    assert.equal(game.abilities.worldScale, 0.5);
    const start = game.clock;
    const x0 = game.player.x;
    input.ix = 1;
    run(game, 1);
    input.ix = 0;
    assert.ok(Math.abs(game.clock - start - 0.5) < 0.02, 'relógio do mundo a 50%');
    assert.ok(game.player.x - x0 > 7, 'jogador em velocidade normal');
    run(game, 2.1);
    assert.equal(game.abilities.worldScale, 1);
    assert.ok(clock >= 0);
});

test('Forma do Cume: imune a golpes, toque derrota, dashes ilimitados; não evita espinhos', () => {
    const { game } = setup(0, { summit_form: 1 });
    const p = game.player;
    cast(game);
    game.hurtPlayer(1, p.x - 1);
    assert.equal(p.hp, PLAYER_HP);
    p.dashes = 0;
    run(game, 0.02);
    assert.ok(p.dashes >= 1);
    const e = game.enemies[0];
    placeNear(game, e, 0.2);
    run(game, 0.05);
    assert.equal(e.alive, false);
    game.kill('spike');
    assert.equal(p.dead, true);
});

test('morte limpa efeitos e recargas e a fase continua jogável', () => {
    const { game } = setup(0, { shockwave: 1, energy_shield: 1, recall: 1 });
    cast(game, 0);
    cast(game, 1);
    cast(game, 2);
    game.kill('spike');
    run(game, 1);
    assert.equal(game.player.dead, false);
    for (const s of game.abilities.slots) {
        assert.equal(s.cooldown, 0);
        assert.equal(s.active, 0);
    }
    assert.equal(game.abilities.effects.length, 0);
});

test('HUD: entrega as habilidades equipadas com tecla, recarga e estado indisponível', () => {
    let last = null;
    const { game } = setup(0, { shockwave: 1, regeneration: 1, glide: 1 }, { hooks: { onHud(h) { last = h; } } });
    cast(game);
    game.pushHud();
    assert.equal(last.abilities.length, 3);
    assert.equal(last.abilities[0].key, 'Q');
    assert.ok(last.abilities[0].cooldown > 0.9);
    assert.ok(last.abilities[0].seconds > 8);
    assert.equal(last.abilities[1].type, 'passive');
    assert.equal(last.abilities[2].type, 'hold');
    cast(game);
    game.pushHud();
    assert.equal(last.abilities[0].denied, true);
    assert.equal(last.abilities[0].message, 'Recarregando');
});

test('controles: troca de tecla vale no jogo, troca conflito e recusa reservadas', () => {
    Settings.resetKeys();
    const { game } = setup(0, { shockwave: 1 });
    assert.ok(Settings.rebind('skill1', 'KeyW'), 'reservada recusada');
    assert.equal(Settings.rebind('skill1', 'KeyG'), null);
    game.input.press('KeyQ');
    game.step(STEP);
    game.input.endFrame();
    assert.equal(slot(game, 'shockwave').cooldown, 0, 'tecla antiga não ativa');
    game.input.press('KeyG');
    game.step(STEP);
    game.input.endFrame();
    assert.ok(slot(game, 'shockwave').cooldown > 0, 'tecla nova ativa');
    assert.equal(Settings.rebind('skill2', 'KeyG'), null);
    assert.ok(Settings.keys.skill2.includes('KeyG'));
    assert.ok(!Settings.keys.skill1.includes('KeyG'), 'sem tecla duplicada');
    assert.ok(Settings.keys.skill1.length > 0);
    assert.equal(Settings.rebind('jump', 'KeyB'), null);
    game.input.press('KeyB');
    const before = game.player.vy;
    game.step(STEP);
    assert.ok(game.player.vy > before, 'pulo responde à tecla nova');
    Settings.resetKeys();
    Save.data.achievements = {};
});

test('checkpoint: rejogar fase antiga não apaga o checkpoint da fase mais avançada', () => {
    const { game } = newGame(5);
    settleAt(game, 5);
    const cp = Save.data.checkpoint;
    assert.equal(cp.level, 5);
    const old = new Game(fakeView(), { onHud() {}, onComplete() {} }, new FakeInput());
    old.load(1);
    const flag = old.flags[0];
    old.player.x = flag.x;
    old.player.y = flag.y + 0.1;
    old.step(STEP);
    assert.deepEqual(Save.data.checkpoint, cp, 'bandeira de fase antiga não sobrescreve');
    old.complete();
    assert.deepEqual(Save.data.checkpoint, cp, 'concluir fase antiga não apaga');
    assert.equal(continueLevel(Save.data), 5);
    assert.ok(resumeFor(Save.data, 5));
    assert.equal(resumeFor(Save.data, 1), null);
});

function settleAt(game, index) {
    const flag = game.flags[0];
    game.player.x = flag.x;
    game.player.y = flag.y + 0.1;
    game.step(STEP);
    assert.equal(game.levelIndex, index);
}

test('central: status das fases, progresso e exploração usam dados reais do save', () => {
    newGame(5);
    const d = Save.data;
    assert.equal(levelStatus(d, 0), 'done');
    assert.equal(levelStatus(d, 5), 'open');
    assert.equal(levelStatus(d, 6), 'locked');
    assert.deepEqual(campaignProgress(d), { done: 5, total: 12, pct: 42 });
    assert.equal(continueLevel(d), 5);
    assert.equal(exploration(d).secrets, 0);
    d.secrets['5:valley'] = true;
    d.best[5] = { time: 30, berries: 6 };
    const ex = exploration(d);
    assert.equal(ex.secrets, 1);
    assert.equal(ex.berries, 6);
    assert.equal(TOTAL_SECRETS, 6);
    assert.ok(ex.pct > 0);
    assert.ok(levelObjectives(4).some(o => o.text.includes('Caçador')));
    assert.ok(levelRewards(sanitizeSave({ unlocked: 5 }), 4).some(r => r.text.includes('Retorno')));
    assert.deepEqual(achievementProgress('stomp_5', { stomps: 2 }), [2, 5]);
    assert.ok(ACHIEVEMENTS.every(a => a.icon && a.name && a.desc));
});

test('estresse: as 12 fases rodam com todas as habilidades acionadas sem erro nem NaN', () => {
    const groups = [];
    for (let i = 0; i < ABILITIES.length; i += 3) groups.push(ABILITIES.slice(i, i + 3));
    LEVELS.forEach((level, index) => {
        for (const group of groups) {
            const abilities = Object.fromEntries(group.map(a => [a.id, a.levels.length]));
            const { game, input } = newGame(index, {}, { abilities });
            run(game, 8, i => {
                if (i % 60 === 0) input.press(KEYS[(i / 60) % 3]);
                if (i % 90 === 0) input.press('KeyX');
                input.ix = i % 240 < 120 ? 1 : -1;
                if (i === 300 && game.boss) game.startBoss();
            });
            const p = game.player;
            for (const v of [p.x, p.y, p.vx, p.vy, p.stamina, game.clock]) assert.ok(Number.isFinite(v), `fase ${index + 1}, ${Object.keys(abilities)}`);
            for (const s of game.abilities.slots) assert.ok(Number.isFinite(s.cooldown) && s.cooldown >= 0);
        }
    });
});
