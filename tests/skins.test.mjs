import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, Save, newGame } from './helpers.mjs';
import { sanitizeSave } from '../js/core.js';
import { SKINS, skinForChapter } from '../js/skins.js';

const CHAPTERS = { 1: [0, 1, 2, 3, 4], 2: [5, 6, 7, 8], 3: [9, 10, 11] };

function play(game, index, { die = false, resume = null } = {}) {
    Save.startChapterRun(index, resume);
    game.load(index, resume);
    if (die) game.kill('spike');
    game.complete();
    return game.completeResult.skin;
}

function playChapter(game, ch, dieAt = -1) {
    return CHAPTERS[ch].map((i, n) => play(game, i, { die: n === dieAt }));
}

const stored = slot => JSON.parse(localStorage.getItem(`summit_slot_${slot}`));

test('capítulos batem com as fases do jogo', () => {
    for (const [ch, list] of Object.entries(CHAPTERS)) list.forEach(i => assert.equal(LEVELS[i].chapter, +ch));
    assert.equal(LEVELS.length, 12);
    for (const ch of [1, 2, 3]) assert.ok(skinForChapter(ch), `skin do capítulo ${ch}`);
    assert.equal(new Set(SKINS.map(s => s.id)).size, SKINS.length);
});

test('save novo começa só com a skin original equipada', () => {
    newGame(0);
    assert.deepEqual(Save.data.skins.unlocked, ['original']);
    assert.equal(Save.data.skins.equipped, 'original');
});

test('capítulo inteiro sem morrer desbloqueia a skin no fim, e só no fim', () => {
    const { game } = newGame(0);
    const got = playChapter(game, 1);
    assert.deepEqual(got.slice(0, 4), [null, null, null, null]);
    assert.equal(got[4].id, 'geada');
    assert.deepEqual(Save.data.skins.unlocked, ['original', 'geada']);
    assert.deepEqual(stored(0).skins.unlocked, ['original', 'geada']);
    assert.equal(Save.data.skins.run, null);
});

test('morrer em qualquer fase do capítulo bloqueia a skin daquela conclusão', () => {
    for (const dieAt of [0, 2, 4]) {
        const { game } = newGame(0);
        const got = playChapter(game, 1, dieAt);
        assert.ok(got.every(s => s === null), `morte na fase ${dieAt}`);
        assert.deepEqual(Save.data.skins.unlocked, ['original']);
    }
});

test('recomeçar o capítulo do início dá nova chance; morangos não contam', () => {
    const { game } = newGame(0);
    playChapter(game, 1, 1);
    assert.deepEqual(Save.data.skins.unlocked, ['original']);
    assert.equal(game.levelBerries, 0);
    const got = playChapter(game, 1);
    assert.equal(got[4].id, 'geada');
});

test('não duplica skin ao repetir o capítulo sem morrer', () => {
    const { game } = newGame(0);
    playChapter(game, 1);
    const again = playChapter(game, 1);
    assert.ok(again.every(s => s === null));
    assert.deepEqual(Save.data.skins.unlocked, ['original', 'geada']);
});

test('entrar no meio do capítulo não conta como capítulo inteiro', () => {
    const { game } = newGame(0);
    for (const i of [2, 3, 4]) assert.equal(play(game, i), null);
    assert.deepEqual(Save.data.skins.unlocked, ['original']);
});

test('pular uma fase quebra a sequência', () => {
    const { game } = newGame(0);
    play(game, 0);
    play(game, 1);
    play(game, 3);
    assert.equal(play(game, 4), null);
    assert.deepEqual(Save.data.skins.unlocked, ['original']);
});

test('voltar do checkpoint mantém a morte registrada na sequência', () => {
    const { game } = newGame(0);
    play(game, 0);
    Save.startChapterRun(1, null);
    game.load(1);
    game.kill('spike');
    assert.equal(Save.data.skins.run.clean, false);
    const resume = { level: 1, x: game.spawn.x, y: game.spawn.y, time: 3 };
    Save.startChapterRun(1, resume);
    assert.equal(Save.data.skins.run.clean, false);
    assert.equal(Save.data.skins.run.next, 1);
});

test('sequência sobrevive a fechar o jogo no meio do capítulo', () => {
    const { game } = newGame(5);
    play(game, 5);
    play(game, 6);
    Save.load();
    assert.deepEqual(Save.data.skins.run, { chapter: 2, next: 7, clean: true });
    play(game, 7);
    assert.equal(play(game, 8).id, 'eter');
});

test('morte em outro capítulo não afeta a sequência atual', () => {
    const { game } = newGame(9);
    Save.data.unlocked = 12;
    play(game, 9);
    Save.chapterDeath(1);
    play(game, 10);
    assert.equal(play(game, 11).id, 'brasa');
});

test('cada slot guarda as próprias skins', () => {
    const { game } = newGame(0);
    playChapter(game, 1);
    Save.create(1, 'normal');
    assert.deepEqual(Save.data.skins.unlocked, ['original']);
    assert.deepEqual(Save.slot(0).skins.unlocked, ['original', 'geada']);
    assert.deepEqual(stored(1).skins.unlocked, ['original']);
});

test('equipar: só skin desbloqueada, persiste ao recarregar', () => {
    const { game } = newGame(0);
    assert.equal(Save.equipSkin(0, 'geada'), false);
    playChapter(game, 1);
    assert.equal(Save.equipSkin(0, 'brasa'), false);
    assert.equal(Save.equipSkin(0, 'geada'), true);
    assert.equal(stored(0).skins.equipped, 'geada');
    Save.load();
    assert.equal(Save.slot(0).skins.equipped, 'geada');
    assert.equal(Save.equipSkin(2, 'original'), false);
});

test('save corrompido ou antigo é saneado sem perder skins', () => {
    const bad = sanitizeSave({ unlocked: 3, skins: { unlocked: ['geada', 'xyz', 'geada'], equipped: 'xyz', run: { chapter: 9, next: 'a' } } });
    assert.deepEqual(bad.skins.unlocked, ['original', 'geada']);
    assert.equal(bad.skins.equipped, 'original');
    assert.equal(bad.skins.run, null);
    const locked = sanitizeSave({ unlocked: 3, skins: { unlocked: [], equipped: 'brasa' } });
    assert.equal(locked.skins.equipped, 'original');
    const old = sanitizeSave({ unlocked: 10, completedChapters: [1, 2], chapterDeaths: [0, 3, 0] });
    assert.deepEqual(old.skins.unlocked, ['original', 'geada']);
});
