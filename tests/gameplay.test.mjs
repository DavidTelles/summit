import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, Save, LEVELS, memoryStore, fakeView, FakeInput, Game } from './helpers.mjs';
import { sanitizeSave, chapterOfLevel } from '../js/core.js';
import { playerPose } from '../js/player.js';
import { STEP, JUMP, PLAYER_HP } from '../js/config.js';

const run = (game, seconds, each) => {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i++) {
        if (each) each(i);
        game.step(STEP);
        game.input.endFrame();
    }
};

const settle = game => run(game, 0.4);

test('três slots são independentes', () => {
    newGame(0);
    Save.create(0, 'normal');
    Save.data.achievements.first_steps = true;
    Save.data.skills.push('double_jump');
    Save.save();
    Save.create(1, 'permadeath');
    assert.equal(Save.data.mode, 'permadeath');
    assert.deepEqual(Save.data.achievements, {});
    assert.ok(!Save.data.skills.includes('double_jump'));
    Save.load();
    assert.equal(Save.slot(0).achievements.first_steps, true);
    assert.equal(Save.slot(1).mode, 'permadeath');
    assert.equal(Save.slot(2), null);
    Save.deleteSlot(1);
    assert.ok(Save.slot(0));
});

test('save corrompido usa backup e não derruba o jogo', () => {
    newGame(0);
    Save.data.deaths = 7;
    Save.save();
    Save.data.deaths = 8;
    Save.save();
    localStorage.setItem('summit_slot_0', '{corrompido');
    Save.load();
    assert.equal(Save.slot(0).deaths, 7);
    localStorage.setItem('summit_slot_1', '"texto"');
    Save.load();
    assert.equal(Save.slot(1), null);
    for (const bad of [null, 5, [], 'x']) assert.equal(sanitizeSave(bad), null);
});

test('migração do save v1 mantém progresso e limpa recordes refeitos', () => {
    const s = sanitizeSave({
        version: 1, mode: 'permadeath', unlocked: 8, currentLevel: 7, deaths: 3,
        best: { 0: { time: 10, berries: 1 }, 7: { time: 9, berries: 2 } }, achievements: { first_steps: true },
        skills: ['dash', 'wall_climb', 'double_jump', 'air_dash']
    });
    assert.equal(s.mode, 'permadeath');
    assert.equal(s.chapter, 2);
    assert.ok(s.best[0] && !s.best[7]);
    assert.ok(s.skills.includes('air_dash') && !s.skills.includes('ground_pound'));
    assert.equal(s.achievements.first_steps, true);
});

test('todos os checkpoints têm chão seguro abaixo', () => {
    LEVELS.forEach((level, index) => {
        const { game } = newGame(index);
        for (const f of game.flags) {
            game.player.x = f.x;
            game.player.y = f.y + 0.2;
            game.player.vy = 0;
            game.player.dead = false;
            let died = false;
            game.kill = () => { died = true; };
            const hurt = game.hurtPlayer;
            game.hurtPlayer = () => {};
            run(game, 0.8);
            game.hurtPlayer = hurt;
            assert.ok(!died, `fase ${index + 1}: checkpoint (${f.x},${f.y}) mata ao renascer`);
            assert.ok(game.player.onGround, `fase ${index + 1}: checkpoint (${f.x},${f.y}) sem chão`);
            delete game.kill;
        }
    });
});

test('inimigos terrestres ficam apoiados no chão', () => {
    LEVELS.forEach((level, index) => {
        const { game } = newGame(index);
        for (const e of game.enemies) {
            if (['Flyer', 'Diver', 'Sentinel'].includes(e.constructor.name)) continue;
            assert.ok(game.world.solid(Math.floor(e.x), Math.floor(e.y - 0.3)), `fase ${index + 1}: ${e.constructor.name} flutua em (${e.x},${e.y})`);
        }
    });
});

test('checkpoint renasce no local certo e permanece no save', () => {
    const { game } = newGame(1);
    settle(game);
    const flag = game.flags[1];
    game.player.x = flag.x;
    game.player.y = flag.y + 0.1;
    run(game, 0.1);
    assert.equal(Save.data.checkpoint.x, flag.x);
    game.kill('test');
    assert.equal(Save.data.deaths, 1);
    run(game, 1);
    assert.equal(game.player.dead, false);
    assert.ok(Math.abs(game.player.x - flag.x) < 0.5);
    const resumed = new Game(fakeView(), { onHud() {} }, new FakeInput());
    resumed.load(1, Save.data.checkpoint);
    assert.equal(resumed.player.x, flag.x);
});

test('morte súbita apaga o save no instante da morte, sem brecha', () => {
    let commit = 0;
    let screen = 0;
    const { game } = newGame(0, {
        onPermadeathCommit() { commit++; Save.deleteSlot(Save.active); },
        onPermadeath() { screen++; }
    }, { mode: 'permadeath' });
    game.kill('spike');
    assert.equal(commit, 1);
    assert.equal(Save.slot(0), null);
    assert.equal(localStorage.getItem('summit_slot_0'), null);
    assert.equal(localStorage.getItem('summit_slot_0_bak'), null);
    run(game, 1);
    assert.equal(screen, 1);
    assert.equal(game.running, false);
});

test('vida: inimigo tira 1 com invulnerabilidade, espinho mata na hora', () => {
    const { game } = newGame(0);
    settle(game);
    game.hurtPlayer(1, game.player.x - 1);
    assert.equal(game.player.hp, PLAYER_HP - 1);
    game.hurtPlayer(1, game.player.x - 1);
    assert.equal(game.player.hp, PLAYER_HP - 1, 'iframes');
    assert.equal(playerPose(game.player), 'hurt');
    game.player.iframes = 0;
    game.hurtPlayer(1, 0);
    game.player.iframes = 0;
    game.hurtPlayer(1, 0);
    assert.equal(game.player.dead, true);
    run(game, 1);
    assert.equal(game.player.hp, PLAYER_HP);

    const spiky = newGame(0).game;
    const [k] = spiky.spikes;
    spiky.player.x = (k % spiky.grid.w) + 0.5;
    spiky.player.y = Math.floor(k / spiky.grid.w);
    spiky.step(STEP);
    assert.equal(spiky.player.dead, true);
});

test('física independe de FPS: altura do pulo é estável e não atravessa paredes', () => {
    const { game, input } = newGame(0);
    settle(game);
    const y0 = game.player.y;
    input.held.add('Space');
    input.press('Space');
    let peak = 0;
    run(game, 0.9, () => { peak = Math.max(peak, game.player.y - y0); });
    assert.ok(peak > 3.3 && peak < 4.6, `apogeu ${peak}`);
    assert.ok(JUMP > 0);

    const wall = newGame(0).game;
    settle(wall);
    wall.player.x = 43;
    wall.player.y = 2;
    wall.player.vx = 200;
    wall.input.ix = 1;
    wall.input.press('KeyX');
    run(wall, 1);
    assert.ok(wall.player.x < 44, `atravessou parede: ${wall.player.x}`);
});

test('input não se perde durante hitstop e dash responde', () => {
    const view = fakeView();
    const input = new FakeInput();
    newGame(0);
    const game = new Game(view, { onHud() {}, onComplete() {} }, input);
    game.load(0);
    game.animate = () => {};
    game.followCamera = () => {};
    for (let i = 0; i < 60; i++) game.update(1 / 60);
    game.hitstop(0.05);
    input.press('Space');
    game.update(1 / 60);
    assert.equal(game.player.vy <= 0, true);
    assert.ok(input.hit('Space'), 'comando guardado durante o hitstop');
    for (let i = 0; i < 5; i++) game.update(1 / 60);
    assert.ok(game.player.vy > 0, 'pulo executado após o hitstop');
});

test('habilidades: dash aéreo dá 2 dashes, pancada quebra piso rachado', () => {
    const one = newGame(1).game;
    assert.equal(one.maxDashes(), 1);
    const two = newGame(7).game;
    assert.equal(two.maxDashes(), 2);

    const { game, input } = newGame(11);
    const t = game.world;
    let found = null;
    for (let y = 0; y < game.grid.h && !found; y++) {
        for (let x = 0; x < game.grid.w; x++) if (t.cell(x, y) === 'Y') { found = { x, y }; break; }
    }
    game.player.x = found.x + 0.5;
    game.player.y = found.y + 4;
    run(game, 0.05);
    input.iy = -1;
    input.held.add('Space');
    input.press('Space');
    game.hurtPlayer = () => {};
    run(game, 0.5);
    assert.ok(game.world.broken.has(t.key(found.x, found.y)), 'piso rachado não quebrou');
    assert.ok(game.player.y < found.y, 'caiu pelo buraco');
});

test('área secreta destranca conquista só neste save', () => {
    const { game } = newGame(5);
    const secret = game.hazards.find(h => h.constructor.name === 'Secret');
    game.player.x = secret.x + 1;
    game.player.y = secret.y;
    game.hazards.forEach(h => { if (h === secret) h.update(game, STEP, game.player); });
    assert.equal(Save.data.achievements.secret_area, true);
    Save.create(1, 'normal');
    assert.equal(Save.data.achievements.secret_area, undefined);
});

for (const [index, name] of [[4, 'Caçador do Pico'], [8, 'Olho da Tempestade'], [11, 'Guardião do Cume']]) {
    test(`chefe "${name}": intro, janelas, fases, derrota, portal e conclusão`, () => {
        let bars = 0;
        let intro = null;
        let ended = 0;
        let completed = null;
        const { game } = newGame(index, {
            onBossIntro(n) { intro = n; },
            onBossBar() { bars++; },
            onBossEnd() { ended++; },
            onComplete(r) { completed = r; }
        });
        const b = game.boss;
        const a = game.level.arena;
        assert.equal(game.goal.mesh.visible, false);
        game.hurtPlayer = () => {};
        game.kill = () => {};
        game.player.x = game.goal.x;
        game.player.y = game.goal.y;
        run(game, 0.2);
        assert.equal(game.finished, false, 'portal não pode funcionar com o chefe vivo');
        game.player.x = a.triggerX + 1;
        game.player.y = a.floor + 0.2;
        run(game, 0.3);
        assert.equal(intro, name);
        assert.equal(game.gate.active, true);
        assert.equal(game.cutscene, true);
        run(game, 3);
        assert.equal(game.cutscene, false);
        assert.equal(b.mode, 'fight');

        const seenPhases = new Set([0]);
        let windows = 0;
        let wasVulnerable = false;
        let elapsed = 0;
        const LIMIT = 400;
        while (b.mode === 'fight' && elapsed < LIMIT) {
            game.player.x = a.spawnX + 1;
            game.player.y = a.floor + 25;
            game.player.vy = 0;
            game.player.dashTimer = 0;
            for (const orb of game.shots) if (orb.deflect) orb.deflect();
            if (b.pylons) {
                for (const m of b.minions) if (m.alive && m.kind === 'guard') m.die(game);
                if (b.fighting) {
                    for (const part of b.parts()) {
                        if (part.id === 'pylon' || part.id === 'pad') b.onStrike(part, 'dash');
                    }
                    if (b.phase === 2) b.addHeat(1);
                }
            }
            if (b.vulnerable && !wasVulnerable) windows++;
            wasVulnerable = b.vulnerable;
            if (b.vulnerable && b.invuln <= 0) b.onStrike({ id: 'head' }, 'dash');
            seenPhases.add(b.phase);
            game.step(STEP);
            game.input.endFrame();
            elapsed += STEP;
            assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), 'posição do chefe inválida');
        }
        assert.ok(elapsed < LIMIT, `chefe não pôde ser derrotado (hp ${b.hp}, ato ${b.act})`);
        assert.equal(b.mode, 'dying');
        assert.ok(windows >= b.maxHp, `janelas de vulnerabilidade: ${windows}`);
        assert.equal(seenPhases.size, b.thresholds.length + 1);
        assert.ok(bars > b.maxHp);
        run(game, 3);
        assert.equal(b.mode, 'dead');
        assert.equal(ended, 1);
        assert.equal(game.goal.mesh.visible, true);
        assert.equal(game.gate.active, false);
        assert.equal(Save.data.achievements[game.level.boss], true);
        game.player.x = game.goal.x;
        game.player.y = game.goal.y + 0.2;
        run(game, 1.2);
        assert.ok(completed && completed.lastOfChapter);
        assert.equal(Save.data.completedChapters.includes(game.level.chapter), true);
        assert.equal(Save.data.checkpoint, null);
    });

    test(`chefe "${name}": morrer na luta retorna à fase atual sem travar`, () => {
        const { game } = newGame(index);
        const b = game.boss;
        const a = game.level.arena;
        game.player.x = a.triggerX + 1;
        game.player.y = a.floor + 0.2;
        const hurt = game.hurtPlayer;
        game.hurtPlayer = () => {};
        run(game, 3.3);
        b.damage();
        b.vulnerable = false;
        game.hurtPlayer = hurt;
        const hpBefore = b.phaseStartHp;
        game.kill('enemy');
        run(game, 1);
        assert.equal(game.player.dead, false);
        assert.equal(b.mode, 'fight');
        assert.equal(b.hp, hpBefore);
        assert.equal(game.gate.active, true);
        assert.ok(game.player.x > a.gateX);
        game.hurtPlayer = () => {};
        run(game, 15);
        assert.equal(b.mode, 'fight');
    });
}

test('todas as fases rodam 30s com inimigos sem erro e sem NaN', () => {
    LEVELS.forEach((level, index) => {
        const { game, input } = newGame(index);
        game.hurtPlayer = () => {};
        game.kill = () => {};
        input.ix = 1;
        run(game, 30, i => {
            if (i % 90 === 0) input.press('Space');
            if (i % 300 === 0) input.press('KeyX');
        });
        assert.ok(Number.isFinite(game.player.x) && Number.isFinite(game.player.y));
        for (const e of game.enemies) assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), e.constructor.name);
        assert.ok(game.shots.length < 80);
    });
});

test('capítulos e progressão: fases mapeadas e habilidades concedidas', () => {
    LEVELS.forEach((l, i) => assert.equal(l.chapter, chapterOfLevel(i)));
    assert.equal(LEVELS.length, 12);
    assert.ok(memoryStore instanceof Map);
    const { game } = newGame(2);
    game.player.x = game.goal.x;
    game.player.y = game.goal.y + 0.2;
    run(game, 0.05);
    assert.ok(Save.data.skills.includes('double_jump'));
    assert.equal(Save.data.unlocked, 4);
    assert.equal(Save.data.currentLevel, 3);
});
