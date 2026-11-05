import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEVELS, Save, memoryStore, newGame } from './helpers.mjs';
import { STEP, PH } from '../js/config.js';
import { sanitizeSave } from '../js/core.js';
import { LEVEL_STORY, RECORDS, SCENE_AFTER_LEVEL, SCENE_INFO, TOTAL_RECORDS, pendingScene, recordById, sanitizeStory } from '../js/story.js';
import { DECOR_KINDS } from '../js/decor.js';
import { Cinema, SCENES } from '../js/cinema.js';

const run = (game, seconds, each) => {
    const steps = Math.round(seconds / STEP);
    for (let i = 0; i < steps; i++) {
        if (each) each(i);
        game.step(STEP);
        game.input.endFrame();
    }
};
const allText = () => [
    ...RECORDS.map(r => r.text),
    ...LEVEL_STORY.flatMap(s => s.moments.flatMap(m => [m.line, m.then || ''])),
    ...Object.values(SCENES).flatMap(s => s.shots.flatMap(shot => shot.lines.map(l => l[1])))
].join(' | ');

test('história: frases obrigatórias do roteiro estão no jogo, sem alteração', () => {
    const script = allText();
    for (const line of [
        'A montanha não tem nome.',
        'Quando o Guardião despertar, o Cume se fechará para sempre.',
        'Apenas aquele que chegar ao Núcleo antes do amanhecer do terceiro dia poderá silenciar a tempestade.',
        'Ele vê tudo.',
        'Não vim reacender os cristais. Vim conversar.',
        'Por que você subiu?',
        'Ele não sabe se conseguirá descer.',
        'A montanha, pela primeira vez em séculos, está em silêncio.'
    ]) assert.ok(script.includes(line), line);
    const after = readFileSync(new URL('../js/aftermath.js', import.meta.url), 'utf8');
    for (const line of ['O Núcleo não quer ser encontrado.', 'Mas você precisa chegar.', 'Vá.']) assert.ok(after.includes(line), line);
});

test('Guardião não recebe falas: nenhuma cena ou fala é atribuída a ele', () => {
    assert.ok(!LEVEL_STORY.some(s => s.moments.some(m => /guardi/i.test(m.who || ''))));
    const after = readFileSync(new URL('../js/aftermath.js', import.meta.url), 'utf8');
    const guardian = after.slice(after.indexOf('class GuardianEnd'), after.indexOf('export function createAftermath'));
    assert.ok(!guardian.includes('this.say('));
});

test('registros: ids únicos, textos curtos, um por cada função narrativa', () => {
    assert.equal(new Set(RECORDS.map(r => r.id)).size, RECORDS.length);
    assert.ok(RECORDS.every(r => r.text.length <= 340), 'texto longo demais');
    assert.equal(new Set(RECORDS.map(r => r.text)).size, RECORDS.length, 'registro repetido');
    const kinds = new Set(RECORDS.map(r => r.kind));
    for (const k of ['oath', 'city', 'ether', 'varak', 'aethos', 'expedition', 'core']) assert.ok(kinds.has(k), k);
    for (const r of RECORDS) assert.equal(LEVELS[r.level].chapter, r.chapter, r.id);
});

test('história principal não depende de exploração: todo registro obrigatório nasce de um evento no caminho', () => {
    const autos = RECORDS.filter(r => r.auto).map(r => r.id).sort();
    const fired = LEVEL_STORY.flatMap(s => s.moments.map(m => m.record)).filter(Boolean).sort();
    assert.deepEqual(fired, autos);
});

test('mundo: decoração, pedras e eventos só usam tipos válidos e espaços livres; arena do Chefe 1 intocada', () => {
    assert.equal(LEVEL_STORY.length, LEVELS.length);
    LEVEL_STORY.forEach((story, index) => {
        const { game } = newGame(index);
        for (const [kind, x, y] of story.decor) {
            assert.ok(DECOR_KINDS.includes(kind), kind);
            assert.ok(x >= 0 && x < game.grid.w && y >= 0 && y < game.grid.h, `${index}:${kind}`);
            assert.equal(game.world.solid(Math.floor(x), Math.floor(y)), false, `${index}:${kind} dentro de bloco em ${x},${y}`);
        }
        for (const stone of game.recordStones) assert.equal(game.world.solid(Math.floor(stone.x), Math.floor(stone.y)), false, stone.id);
        const seen = new Set();
        for (const m of story.moments) {
            assert.ok(!seen.has(m.id));
            seen.add(m.id);
            assert.ok(m.x1 < m.x2);
        }
    });
    const arena = LEVELS[4].arena;
    for (const [kind, x] of LEVEL_STORY[4].decor) assert.ok(x < arena.gateX, `${kind} invade a arena`);
    for (const r of RECORDS.filter(x => x.level === 4)) assert.ok(r.at[0] < arena.gateX);
});

test('pedra de registro: coleta, salva, avisa e não reaparece; evento dispara uma vez', () => {
    const records = [];
    const lines = [];
    const { game } = newGame(3, { onRecord: r => records.push(r.id), onStoryLine: t => lines.push(t) });
    game.kill = () => {};
    game.hurtPlayer = () => {};
    const stone = game.recordStones[0];
    game.player.x = stone.x;
    game.player.y = stone.y - PH / 2;
    run(game, 0.02);
    assert.deepEqual(records, [stone.id]);
    assert.equal(stone.mesh.visible, false);
    assert.equal(Save.data.story.records[stone.id], true);
    assert.equal(Save.data.achievements.first_record, true);
    game.player.x = 64;
    game.player.y = 14;
    run(game, 0.05);
    assert.ok(lines.some(l => l.startsWith('Quando o Guardião')));
    assert.equal(Save.data.story.records.prophecy, true);
    assert.equal(records.at(-1), 'prophecy');
    const count = lines.length;
    run(game, 5);
    assert.ok(lines.includes('Três dias, então.'), 'segunda fala atrasada');
    game.player.x = 20;
    run(game, 0.05);
    game.player.x = 64;
    game.player.y = 14;
    run(game, 0.05);
    assert.equal(lines.length, count + 1, 'evento não repete');
    game.load(3);
    assert.ok(!game.recordStones.some(r => r.id === stone.id), 'pedra coletada não volta');
    assert.equal(game.moments.some(m => m.id === 'prophecy'), false);
});

test('saves isolados: registros, eventos e cenas de um save não aparecem em outro', () => {
    newGame(3);
    Save.discoverRecord('storm_names');
    Save.sawMoment('3:prophecy');
    Save.sawScene('intro');
    Save.create(1, 'normal');
    assert.deepEqual(Save.data.story, { records: {}, moments: {}, scenes: {} });
    assert.equal(pendingScene(Save.data), 'intro');
    Save.setActive(0);
    assert.equal(Save.data.story.records.storm_names, true);
    assert.equal(Save.data.story.scenes.intro, true);
    const raw = JSON.parse(memoryStore.get('summit_slot_1'));
    assert.deepEqual(raw.story.records, {});
    Save.deleteSlot(0);
    assert.ok(Save.slot(1));
});

test('migração v3 → v4: mantém progresso, não força cenas passadas e entrega registros obrigatórios já vividos', () => {
    const old = { version: 3, mode: 'permadeath', unlocked: 7, currentLevel: 6, deaths: 3, totalTime: 900, best: { 0: { time: 9, berries: 1 }, 3: { time: 9, berries: 0 }, 4: { time: 50, berries: 2 } }, achievements: { boss1: true }, completedChapters: [1], secrets: { '5:valley': true }, loadout: ['shockwave'], abilities: { shockwave: 2 } };
    const d = sanitizeSave(old);
    assert.equal(d.version, 4);
    assert.equal(d.mode, 'permadeath');
    assert.equal(d.unlocked, 7);
    assert.equal(d.best[4].time, 50);
    assert.equal(d.abilities.shockwave, 2);
    assert.equal(d.story.scenes.intro, true);
    assert.equal(d.story.scenes.ch1to2, true);
    assert.equal(d.story.scenes.final, undefined);
    assert.equal(d.story.records.prophecy, true);
    assert.equal(pendingScene(d), null);
    const again = sanitizeSave(JSON.parse(JSON.stringify(d)));
    assert.deepEqual(again.story, d.story);
    const fresh = sanitizeSave({ version: 3, unlocked: 1 });
    assert.equal(fresh.story.scenes.intro, undefined, 'save antigo sem progresso ainda vê a introdução');
    assert.deepEqual(sanitizeStory({ records: { fake: true, prophecy: 'x', varak_refusal: true }, scenes: { nope: true } }, { best: {}, unlocked: 1, totalTime: 0 }, 4).records, { varak_refusal: true });
});

test('fila de cenas: novo save pede a abertura; capítulos e final só depois de concluídos', () => {
    newGame(0);
    const d = Save.data;
    assert.equal(pendingScene(d), 'intro');
    Save.sawScene('intro');
    assert.equal(pendingScene(d), null);
    for (const [level, scene] of Object.entries(SCENE_AFTER_LEVEL)) {
        d.best[level] = { time: 1, berries: 0 };
        assert.equal(pendingScene(d), scene);
        Save.sawScene(scene);
    }
    assert.equal(pendingScene(d), null);
});

function fakeCinema() {
    const captions = [];
    const fades = [];
    const cinema = new Cinema({ renderer: { domElement: {}, render() {} } }, { onCaption: t => { if (t) captions.push(t); }, onFade: f => fades.push(f) });
    return { cinema, captions, fades };
}

for (const id of Object.keys(SCENE_INFO)) {
    test(`cena "${id}": termina sozinha, mostra todas as falas, não tem erro e não é longa demais`, () => {
        const { cinema, captions, fades } = fakeCinema();
        const def = SCENES[id];
        const total = def.shots.reduce((sum, s) => sum + s.dur, 0);
        assert.ok(total <= 70, `${id}: ${total}s`);
        cinema.play(id);
        let t = 0;
        while (cinema.playing && t < total + 2) {
            cinema.update(1 / 60);
            cinema.render();
            t += 1 / 60;
            assert.ok(Number.isFinite(cinema.camera.position.x));
        }
        assert.equal(cinema.playing, false);
        assert.deepEqual(captions, def.shots.flatMap(s => s.lines.map(l => l[1])));
        assert.ok(fades.every(f => f >= 0 && f <= 1));
        for (const shot of def.shots) for (const [at] of shot.lines) assert.ok(at < shot.dur - 1, 'fala sem tempo de leitura');
    });
}

test('cena: pular encerra na hora; avançar respeita o tempo mínimo e chega ao fim', () => {
    const { cinema } = fakeCinema();
    cinema.play('intro');
    cinema.update(0.1);
    cinema.skip();
    assert.equal(cinema.playing, false);
    cinema.play('final');
    cinema.update(0.1);
    cinema.advance();
    assert.equal(cinema.active.index, 0, 'avanço acidental ignorado');
    let guard = 0;
    while (cinema.playing && guard++ < 200) {
        cinema.update(1);
        cinema.advance();
    }
    assert.equal(cinema.playing, false);
});

test('final: pergunta do Núcleo sem resposta falada e silêncio antes do fim', () => {
    const shots = SCENES.final.shots;
    const question = shots.findIndex(s => s.lines.some(l => l[1] === 'Por que você subiu?'));
    assert.ok(question >= 0);
    assert.equal(shots[question + 1].lines.length, 0, 'a resposta de Kael não é dita');
    assert.ok(shots.some(s => s.fadeMusic), 'a trilha some antes do último plano');
    assert.ok(shots.slice(0, question).every(s => !s.lines.length), 'a chegada é silenciosa');
});

for (const [index, epilogue, duration] of [[4, null, 8.2], [8, 'Vá.', 9.4], [11, null, 5]]) {
    test(`chefe da fase ${index + 1}: encerramento trava só durante a cena e devolve o controle`, () => {
        const lines = [];
        let ended = 0;
        let epilogued = 0;
        const { game, input } = newGame(index, { onStoryLine: t => lines.push(t), onBossEnd: () => ended++, onBossEpilogue: () => epilogued++ });
        const a = game.level.arena;
        game.hurtPlayer = () => {};
        game.kill = () => {};
        game.player.x = a.triggerX + 1;
        game.player.y = a.floor + 0.2;
        run(game, 3.2);
        const b = game.boss;
        while (b.mode === 'fight') {
            b.vulnerable = true;
            b.invuln = 0;
            b.damage();
        }
        run(game, 2.7);
        assert.equal(b.mode, 'dead');
        assert.equal(ended, 1);
        assert.ok(game.aftermath);
        assert.equal(game.cutscene, true);
        assert.equal(epilogued, 0);
        assert.equal(Save.data.achievements[game.level.boss], true, 'conquista não depende da cena');
        const x = game.player.x;
        input.ix = 1;
        run(game, 0.3);
        assert.ok(Math.abs(game.player.x - x) < 0.01, 'sem controle durante a cena');
        run(game, duration);
        assert.equal(game.aftermath.done, true);
        assert.equal(game.cutscene, false);
        assert.equal(epilogued, 1);
        if (epilogue) assert.ok(lines.includes(epilogue));
        run(game, 0.5);
        assert.ok(Math.abs(game.player.x - x) > 0.5, 'controle devolvido');
    });
}

test('Varak: flor nasce e fica; rosto humano aparece e some', () => {
    const { game } = newGame(4);
    const a = game.level.arena;
    game.hurtPlayer = () => {};
    game.kill = () => {};
    game.player.x = a.triggerX + 1;
    game.player.y = a.floor + 0.2;
    run(game, 3.2);
    const b = game.boss;
    while (b.mode === 'fight') {
        b.vulnerable = true;
        b.invuln = 0;
        b.damage();
    }
    run(game, 2.7);
    const after = game.aftermath;
    run(game, 2);
    assert.equal(after.face.visible, true);
    assert.equal(after.face.userData.eyes[0].visible, true, 'olhar humano');
    run(game, 3);
    assert.equal(after.face.visible, false);
    run(game, 3.3);
    assert.ok(after.flower.scale.x > 1);
    assert.equal(after.flower.parent, game.view.root);
});

test('registros completos: conquista Cronista só com todos no mesmo save', () => {
    const { game } = newGame(0);
    for (const r of RECORDS.slice(1)) game.grantRecord(r.id);
    assert.equal(Save.data.achievements.all_records, undefined);
    game.grantRecord(RECORDS[0].id);
    assert.equal(Object.keys(Save.data.story.records).length, TOTAL_RECORDS);
    assert.equal(Save.data.achievements.all_records, true);
    assert.ok(recordById('quarantine'));
});

test('Percepção revela registro próximo', () => {
    const { game } = newGame(3, {}, { abilities: { perception: 1 } });
    game.hurtPlayer = () => {};
    game.kill = () => {};
    const stone = game.recordStones[0];
    game.player.x = stone.x - 4;
    game.player.y = stone.y;
    run(game, 0.6);
    assert.equal(game.abilities.byId.get('perception').alert, true);
});
