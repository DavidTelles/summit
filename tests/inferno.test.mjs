import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, Save, LEVELS } from './helpers.mjs';
import { sanitizeSave } from '../js/core.js';
import { ACHIEVEMENTS } from '../js/achievements.js';
import { ABILITIES } from '../js/abilities.js';
import { CHAPTERS, realmForProgress, realmEntryLevel } from '../js/realms.js';
import { BOSSES, levelFacts } from '../js/campaign.js';
import { LEVEL_STORY, RECORDS } from '../js/story.js';
import { THEMES } from '../js/backdrops.js';
import { STEP, PLAYER_HP } from '../js/config.js';

const BRIDGE = LEVELS.findIndex(l => l.boss === 'beast');
const HALL = LEVELS.findIndex(l => l.boss === 'mentor');
const MOUNTAIN_END = LEVELS.findLastIndex(l => l.chapter === 3);

const run = (game, seconds, each) => {
    const n = Math.round(seconds / STEP);
    for (let i = 0; i < n; i++) {
        if (each && each(i) === false) return;
        game.step(STEP);
        game.input.endFrame();
    }
};

function startFight(index, opts) {
    const { game, input } = newGame(index, {}, opts);
    const a = game.level.arena;
    game.player.x = a.triggerX + 1;
    game.player.y = a.floor + 0.05;
    run(game, 0.3);
    assert.equal(game.boss.mode, 'intro');
    run(game, 3.2);
    assert.equal(game.boss.mode, 'fight');
    return { game, input, boss: game.boss, a };
}

// Mantém o jogador vivo e fora do caminho para observar o chefe sem interferir.
function park(game, x) {
    game.player.x = x;
    game.player.y = game.level.arena.floor + 0.05;
    game.player.vx = 0;
    game.player.iframes = 5;
}

test('Inferno: Capítulo 4 tem três fases, arenas válidas, história e cenário próprios', () => {
    const ch4 = LEVELS.map((l, i) => i).filter(i => LEVELS[i].chapter === 4);
    assert.deepEqual(ch4, [12, 13, 14]);
    assert.deepEqual(CHAPTERS, [1, 2, 3, 4, 5]);
    for (const i of ch4) {
        const f = levelFacts(i);
        assert.ok(f.desc && f.difficulty, `descrição da fase ${i + 1}`);
        assert.ok(THEMES[LEVELS[i].name], `cenário da fase ${i + 1}`);
        assert.ok(LEVEL_STORY[i] && LEVEL_STORY[i].moments.length, `história da fase ${i + 1}`);
    }
    for (const id of ['beast', 'mentor']) {
        assert.ok(BOSSES[id] && BOSSES[id].tip, `dica do chefe ${id}`);
        assert.ok(ACHIEVEMENTS.some(a => a.id === id), `conquista do chefe ${id}`);
    }
    assert.ok(RECORDS.filter(r => r.chapter === 4).length >= 3);
});

test('reino da central: muda para o Inferno só ao alcançar o Capítulo 4 e nunca regride', () => {
    const entry = realmEntryLevel('inferno');
    assert.equal(entry, 12);
    assert.equal(realmForProgress(entry), 'montanha');
    assert.equal(realmForProgress(entry + 1), 'inferno');
    assert.equal(sanitizeSave({ unlocked: 12 }).realm, 'montanha');
    assert.equal(sanitizeSave({ unlocked: 13 }).realm, 'inferno');
    assert.equal(sanitizeSave({ unlocked: 13, realm: 'montanha' }).realm, 'inferno', 'progresso corrige reino antigo');
    assert.equal(sanitizeSave({ unlocked: 13, realm: 'nada' }).realm, 'inferno', 'valor inválido é ignorado');
    assert.equal(sanitizeSave({ unlocked: 2 }).realm, 'montanha');
});

test('concluir o Capítulo 3 leva a central ao Inferno, avisa na tela de conclusão e persiste no disco', () => {
    const { game } = newGame(MOUNTAIN_END);
    game.boss.mode = 'dead';
    game.complete();
    assert.equal(Save.data.realm, 'inferno');
    assert.equal(game.completeResult.realmChanged, true);
    assert.equal(game.completeResult.realm, 'inferno');
    const disk = JSON.parse(localStorage.getItem('summit_slot_0'));
    assert.equal(disk.realm, 'inferno');
    Save.load();
    Save.setActive(0);
    assert.equal(Save.data.realm, 'inferno', 'reabrir o jogo mantém a central infernal');
    assert.equal(Save.data.achievements.summit, true);
});

test('conquistas: catálogo completo e migração compatível de saves antigos', () => {
    assert.equal(new Set(ACHIEVEMENTS.map(a => a.id)).size, ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) assert.ok(a.icon && a.name && a.desc && a.group, a.id);
    for (const id of ['first_steps', 'chapter_done', 'no_death_chapter']) assert.ok(ACHIEVEMENTS.some(a => a.id === id), id);
    const d = sanitizeSave({
        unlocked: 12,
        achievements: { no_death_ch2: true, ch1_complete: true, berry_5: true, boss1: true, summit: true, die_10: true, fake: true, boss2: 'sim' }
    });
    assert.deepEqual(Object.keys(d.achievements).sort(), ['boss1', 'chapter_done', 'no_death_chapter', 'summit']);
});

test('habilidades não dependem mais de conquistas removidas', () => {
    const removed = new Set(['no_death', 'crystal_10', 'first_loadout', 'ability_max']);
    for (const a of ABILITIES) {
        for (const req of [a.unlock, ...a.levels.map(l => l.req)]) {
            if (req && req.ach) assert.ok(!removed.has(req.ach) && ACHIEVEMENTS.some(x => x.id === req.ach), `${a.id} depende de ${req.ach}`);
        }
    }
});

test('conquista Pele Intacta: só sem dano em fase do Inferno; Além dos Portões ao concluir o Capítulo 4', () => {
    let { game } = newGame(12);
    game.complete();
    assert.equal(Save.data.achievements.unscathed, true);
    ({ game } = newGame(12));
    game.hurtPlayer(1, game.player.x + 1);
    game.complete();
    assert.equal(Save.data.achievements.unscathed, undefined);
    ({ game } = newGame(HALL));
    game.boss.mode = 'dead';
    game.complete();
    assert.equal(Save.data.achievements.inferno_gate, true);
    assert.equal(Save.data.achievements.chapter_done, true);
});

test('Besta: golpear a âncora derruba o contrapeso; a investida contra ele atordoa e abre a janela', () => {
    const { game, boss, a } = startFight(BRIDGE);
    const weight = boss.weights[0];
    const anchor = boss.parts().find(p => p.id === 'anchor' && p.weight === weight);
    assert.ok(anchor, 'âncora disponível');
    assert.ok(anchor.y - a.floor <= 7, 'âncora alcançável com pulo duplo');
    game.player.x = anchor.x;
    game.player.y = anchor.y - 0.4;
    game.player.dashTimer = 0.1;
    game.player.dashDir = { x: 0, y: 1 };
    run(game, 0.02);
    assert.equal(weight.state, 'falling');
    park(game, a.x2 - 2);
    run(game, 0.6);
    assert.equal(weight.state, 'down');
    assert.equal(weight.solid.active, true, 'contrapeso vira obstáculo sólido');
    boss.x = weight.x + 6;
    boss.dir = -1;
    boss.setAct('charge');
    run(game, 1, () => { park(game, a.x2 - 2); return boss.act === 'charge'; });
    assert.equal(boss.act, 'stunned');
    assert.equal(boss.vulnerable, true);
    assert.equal(boss.wallHits, 0);
    const hp = boss.hp;
    assert.equal(boss.onStrike(boss.parts()[0], 'stomp'), 'hit');
    assert.equal(boss.hp, hp - 1);
});

test('Besta: investida até a ponta da ponte não abre janela e conta contra Contrapeso', () => {
    const { game, boss, a } = startFight(BRIDGE);
    boss.weights.forEach(w => w.reset());
    boss.x = a.x1 + 6;
    boss.dir = 1;
    boss.setAct('charge');
    run(game, 4, () => { park(game, a.x1 + 2); return boss.act === 'charge'; });
    assert.equal(boss.wallHits, 1);
    assert.equal(boss.vulnerable, false);
    assert.equal(boss.featEarned(), null);
    assert.equal(boss.onStrike(boss.parts()[0], 'dash'), 'blocked');
});

test('Besta: a investida sempre é avisada antes no chão', () => {
    const { game, boss } = startFight(BRIDGE);
    boss.setAct('idle');
    boss.t = 5;
    let warned = 0;
    run(game, 3, () => {
        park(game, boss.arena.x1 + 2);
        if (boss.act === 'paw') warned++;
        return boss.act !== 'charge';
    });
    assert.ok(warned * STEP >= 0.7, `aviso de ${(warned * STEP).toFixed(2)} s`);
    assert.ok(game.strikes.length > 0, 'marca no chão');
});

function mentorUntil(game, boss, act, seconds = 8) {
    let seen = false;
    run(game, seconds, () => {
        park(game, boss.arena.x1 + 2);
        if (boss.act === act) seen = true;
        return !seen;
    });
    return seen;
}

test('Mentor: dash sempre em 8 direções, com linha de aviso, e termina numa janela de golpe', () => {
    const { game, boss } = startFight(HALL);
    assert.ok(mentorUntil(game, boss, 'aim'));
    assert.ok(boss.aimTime >= 0.5, 'aviso do dash na fase 1');
    run(game, 0.05, () => { park(game, boss.arena.x1 + 2); });
    assert.equal(boss.aim.visible, true);
    const ang = Math.atan2(boss.dashDir.y, boss.dashDir.x) / (Math.PI / 4);
    assert.ok(Math.abs(ang - Math.round(ang)) < 1e-6, 'direção de dash do jogador');
    assert.equal(boss.onStrike(boss.parts()[0], 'stomp'), 'blocked', 'mirando ele não sofre dano');
    assert.ok(mentorUntil(game, boss, 'window'));
    assert.equal(boss.vulnerable, true);
    assert.equal(boss.onStrike(boss.parts()[0], 'stomp'), 'hit');
    assert.equal(boss.hp, boss.maxHp - 1);
});

test('Mentor: pancada marca o chão antes de cair e as ondas de choque são puladas', () => {
    const { game, boss } = startFight(HALL);
    boss.setAct('idle');
    boss.step = 3;
    boss.t = 5;
    run(game, 0.02, () => { park(game, boss.arena.x1 + 6); });
    assert.equal(boss.act, 'rise');
    assert.ok(game.strikes.length >= 1, 'marca do alvo no chão');
    assert.ok(mentorUntil(game, boss, 'window', 4));
    assert.ok(game.shots.some(s => s.ground), 'ondas de choque no chão');
});

test('Mentor: Só o Básico exige começar a luta sem habilidades', () => {
    let { boss } = startFight(HALL);
    assert.equal(boss.featEarned(), 'mentor_pure');
    ({ boss } = startFight(HALL, { abilities: { shockwave: 1 } }));
    assert.equal(boss.featEarned(), null);
});

for (const [name, index] of [['Besta', BRIDGE], ['Mentor', HALL]]) {
    test(`${name}: luta inteira roda até o fim sem travar nem NaN, golpeando só nas janelas`, () => {
        const { game, boss, a } = startFight(index);
        let windows = 0;
        let was = false;
        run(game, 240, () => {
            const p = game.player;
            const opened = boss.vulnerable && !was;
            if (opened) windows++;
            was = boss.vulnerable;
            if (name === 'Besta' && boss.act === 'paw') {
                const w = boss.weights.find(x => x.ready && (x.x - boss.x) * boss.dir > 3);
                if (w) w.drop();
            }
            if (opened) {
                // Um pisão por janela, caindo de cima como o jogador faria.
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
        assert.equal(boss.mode, 'dead', `${name} derrotado em ${windows} janelas`);
        assert.equal(Save.data.achievements[LEVELS[index].boss], true);
        assert.equal(game.player.hp, PLAYER_HP);
        assert.equal(game.goal.locked, null, 'a passagem se abre');
    });
}
