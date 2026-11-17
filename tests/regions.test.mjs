import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, Save, newGame } from './helpers.mjs';
import { sanitizeSave } from '../js/core.js';
import { REALMS, REALM_IDS, realmForProgress, realmOfChapter } from '../js/realms.js';
import { ACHIEVEMENTS } from '../js/achievements.js';
import { BOSSES, levelFacts } from '../js/campaign.js';
import { LEVEL_STORY, RECORDS, SCENE_AFTER_LEVEL, SCENE_INFO, pendingScene } from '../js/story.js';
import { THEMES } from '../js/backdrops.js';
import { SCENES } from '../js/cinema.js';
import { MENU_THEMES } from '../js/menuThemes.js';
import { PLAYER_HP, STEP } from '../js/config.js';

const THRONE = LEVELS.findIndex(l => l.boss === 'herald');
const run = (game, seconds, each) => {
    for (let i = 0; i < Math.round(seconds / STEP); i++) {
        if (each && each(i) === false) return;
        game.step(STEP);
        game.input.endFrame();
    }
};

function startFight() {
    const { game, input } = newGame(THRONE);
    const a = game.level.arena;
    game.player.x = a.triggerX + 1;
    game.player.y = a.floor + 0.05;
    run(game, 0.3);
    assert.equal(game.boss.mode, 'intro');
    run(game, 3.2);
    assert.equal(game.boss.mode, 'fight');
    return { game, input, boss: game.boss, a };
}

const park = (game, x) => {
    game.player.x = x;
    game.player.y = game.level.arena.floor + 0.05;
    game.player.vx = 0;
    game.player.iframes = 5;
};

test('Céu: Capítulo 5 tem três fases com história, cenário e chefe próprios; Inferno fecha no Capítulo 4', () => {
    const ch5 = LEVELS.map((l, i) => i).filter(i => LEVELS[i].chapter === 5);
    assert.deepEqual(ch5, [15, 16, 17]);
    assert.deepEqual(REALMS.inferno.chapters, [4]);
    assert.equal(realmOfChapter(5), 'ceu');
    for (const i of ch5) {
        const f = levelFacts(i);
        assert.ok(f.desc && f.difficulty, `descrição da fase ${i + 1}`);
        assert.ok(THEMES[LEVELS[i].name], `cenário da fase ${i + 1}`);
        assert.ok(LEVEL_STORY[i].moments.length, `história da fase ${i + 1}`);
    }
    assert.ok(BOSSES.herald && BOSSES.herald.tip);
    assert.ok(ACHIEVEMENTS.some(a => a.id === 'herald'));
    assert.ok(RECORDS.filter(r => r.chapter === 5).length >= 3);
});

test('reino: Céu só depois de vencer o Inferno e nunca regride sem zerar', () => {
    assert.equal(realmForProgress(15), 'inferno');
    assert.equal(realmForProgress(16), 'ceu');
    assert.equal(sanitizeSave({ version: 6, unlocked: 16, realm: 'montanha' }).realm, 'ceu');
});

test('migração v5: quem venceu a última fase antiga ganha acesso ao Céu; o resto não muda', () => {
    const old = sanitizeSave({ version: 5, unlocked: 15, best: { 14: { time: 1, berries: 0 } } });
    assert.equal(old.unlocked, 16);
    assert.equal(old.realm, 'ceu');
    assert.equal(old.cleared, false);
    assert.equal(sanitizeSave({ version: 5, unlocked: 15 }).unlocked, 15, 'sem vencer a fase, nada abre');
    assert.equal(sanitizeSave({ version: 6, unlocked: 15, best: { 14: { time: 1, berries: 0 } } }).unlocked, 15, 'só migra uma vez');
});

test('escolha de região: recusada sem zerar, livre depois, e persiste no disco', () => {
    newGame(0);
    assert.equal(Save.chooseRealm('ceu'), false);
    assert.equal(Save.data.realm, 'montanha');
    assert.equal(Save.anyCleared(), false);
    assert.equal(Save.finishGame(), true);
    assert.equal(Save.finishGame(), false, 'só a primeira vez conta como novidade');
    assert.equal(Save.anyCleared(), true);
    assert.equal(Save.chooseRealm('nada'), false);
    assert.equal(Save.chooseRealm('inferno'), true);
    const disk = JSON.parse(localStorage.getItem('summit_slot_0'));
    assert.equal(disk.cleared, true);
    assert.equal(disk.realm, 'inferno');
    assert.equal(sanitizeSave(disk).realm, 'inferno', 'save zerado pode voltar a regiões anteriores');
});

test('região do menu: não mostra lugar que nenhum save alcançou', () => {
    newGame(0);
    assert.equal(Save.setMenuRealm('ceu'), false);
    assert.equal(Save.menuRealm, 'montanha');
    localStorage.setItem('summit_menu_realm', 'ceu');
    assert.equal(Save.menuRealm, 'montanha', 'valor adulterado é ignorado');
    Save.data.realm = 'inferno';
    assert.equal(Save.setMenuRealm('inferno'), true);
    assert.equal(Save.menuRealm, 'inferno');
    assert.equal(Save.setMenuRealm('xyz'), false);
});

test('menu: cada região tem identidade própria e cenário no reino certo', () => {
    assert.deepEqual(Object.keys(MENU_THEMES), REALM_IDS);
    const titles = new Set();
    for (const id of REALM_IDS) {
        const t = MENU_THEMES[id];
        assert.ok(t.title && t.tagline && t.logo && t.place && t.blurb && t.veil, id);
        titles.add(t.title);
        assert.equal(realmOfChapter(LEVELS[t.level].chapter), id);
    }
    assert.equal(titles.size, REALM_IDS.length);
});

test('passagens: Inferno e Céu têm cena própria, encadeada na ordem, e o final vem por último', () => {
    assert.equal(SCENE_AFTER_LEVEL[14], 'ch4to5');
    assert.equal(SCENE_AFTER_LEVEL[THRONE], 'ending');
    for (const id of ['ch3to4', 'ch4to5', 'ending']) assert.ok(SCENES[id] && SCENE_INFO[id], id);
    assert.ok(SCENES.ch3to4.shots.some(s => s.set === 'rift'));
    assert.ok(SCENES.ch4to5.shots.some(s => s.set === 'ascent'));
    newGame(0);
    const d = Save.data;
    Object.assign(d.story.scenes, { intro: true, ch1to2: true, ch2to3: true });
    d.best[11] = { time: 1, berries: 0 };
    assert.equal(pendingScene(d), 'final');
    Save.sawScene('final');
    assert.equal(pendingScene(d), 'ch3to4');
    Save.sawScene('ch3to4');
    d.best[14] = { time: 1, berries: 0 };
    assert.equal(pendingScene(d), 'ch4to5');
    Save.sawScene('ch4to5');
    d.best[THRONE] = { time: 1, berries: 0 };
    assert.equal(pendingScene(d), 'ending');
    assert.equal(d.cleared, false, 'ver a cena não zera; só os créditos');
});

test('Arauto: colunas e mergulho são avisados, e ele só é vulnerável no chão', () => {
    const { game, boss, a } = startFight();
    assert.equal(boss.onStrike(boss.parts()[0], 'stomp'), 'blocked');
    boss.setAct('idle');
    boss.step = 0;
    boss.t = 5;
    run(game, 0.8, () => { park(game, a.x1 + 3); return game.strikes.length === 0; });
    assert.ok(game.strikes.length > 0, 'colunas marcadas antes de cair');
    assert.equal(game.strikes[0].state, 'warn');
    let seen = false;
    run(game, 6, () => { park(game, a.x1 + 3); seen = boss.act === 'window'; return !seen; });
    assert.ok(seen, 'mergulho abre janela');
    assert.equal(boss.y, boss.floor);
    assert.equal(boss.vulnerable, true);
    assert.equal(boss.onStrike(boss.parts()[0], 'stomp'), 'hit');
    assert.equal(boss.hp, boss.maxHp - 1);
});

test('Arauto: luta inteira termina sem travar nem NaN, golpeando só nas janelas', () => {
    const { game, boss, a } = startFight();
    let was = false;
    run(game, 240, () => {
        const p = game.player;
        const opened = boss.vulnerable && !was;
        was = boss.vulnerable;
        if (opened) {
            p.x = boss.x;
            p.y = boss.y + boss.h + 0.1;
            p.vy = -8;
            p.vx = 0;
            p.dashTimer = 0;
            p.groundPounding = false;
        } else if (!boss.vulnerable) park(game, boss.x < (a.x1 + a.x2) / 2 ? a.x2 - 2 : a.x1 + 2);
        assert.ok(Number.isFinite(boss.x) && Number.isFinite(boss.y), 'posição válida');
        return boss.mode !== 'dead';
    });
    assert.equal(boss.mode, 'dead');
    assert.equal(Save.data.achievements.herald, true);
    assert.equal(game.player.hp, PLAYER_HP);
    assert.equal(game.goal.locked, null, 'a passagem se abre');
});
