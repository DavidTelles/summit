import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newGame, Save } from './helpers.mjs';
import { STEP, PH } from '../js/config.js';
import { ramTrace } from './ramTrace.mjs';
import { playBoss } from './bossBot.mjs';

const STORM = 8;
const CORE = 11;

const run = (game, seconds, each) => {
    for (let i = 0; i < seconds * 120; i++) {
        if (each) each(i);
        game.step(STEP);
        game.input.endFrame();
    }
};

function fight(index, opts = {}) {
    const { game, input } = newGame(index, opts.hooks || {}, opts.abilities ? { abilities: opts.abilities } : {});
    const a = game.level.arena;
    game.player.x = a.triggerX + 1;
    game.player.y = a.floor + 0.2;
    if (opts.safe !== false) {
        game.hurtPlayer = () => {};
        game.kill = () => {};
    }
    run(game, 3.1);
    assert.equal(game.boss.mode, 'fight');
    return { game, input, b: game.boss, a, p: game.player };
}

function forcePhase(b, phase) {
    while (b.phase < phase) {
        b.vulnerable = true;
        b.invuln = 0;
        b.damage();
    }
    b.invuln = 0;
}

function orbFor(game, b) {
    b.setAct('orb');
    run(game, 1.1);
    const orb = game.shots.find(s => s.deflect);
    assert.ok(orb, 'a esfera deve existir');
    return orb;
}

test('Capítulo 1: trilha do Caçador do Pico é idêntica à original', () => {
    const r = ramTrace();
    assert.equal(r.hash, 1347233605);
    assert.deepEqual(r.acts, ['air', 'charge', 'idle', 'landed', 'leap', 'recover', 'rocks', 'running', 'stunned']);
});

test('Capítulo 1: chefe segue sem nenhuma mecânica nova', () => {
    const { game } = newGame(4);
    const b = game.boss;
    assert.equal(b.theme, undefined);
    assert.equal(b.constructor.name, 'RamBoss');
    assert.equal(b.hp, 6);
    assert.deepEqual(b.thresholds, [3]);
    assert.equal(game.bossHazards.length, 0);
    const src = readFileSync(new URL('../js/bosses.js', import.meta.url), 'utf8');
    assert.ok(!src.includes('StormBoss') && !src.includes('ColossusBoss'));
});

test('cada chefe tem identidade: atos exclusivos e não compartilhados', () => {
    const acts = file => new Set([...readFileSync(new URL(`../js/${file}`, import.meta.url), 'utf8').matchAll(/case '(\w+)':/g)].map(m => m[1]));
    const ram = new Set(['charge', 'rush', 'running', 'turnaround', 'stunned', 'leap', 'air', 'landed', 'rocks']);
    const storm = acts('bossStorm.js');
    const colossus = acts('bossColossus.js');
    const shared = new Set(['idle', 'recover', 'transition', 'falling']);
    for (const a of storm) {
        assert.ok(!ram.has(a), `Olho repete ${a}`);
        if (!shared.has(a)) assert.ok(!colossus.has(a), `Olho e Guardião compartilham ${a}`);
    }
    for (const a of colossus) assert.ok(!ram.has(a), `Guardião repete ${a}`);
    for (const a of ['orb', 'plates', 'gust', 'ambush', 'dive', 'lodged', 'master', 'grounded']) assert.ok(storm.has(a), a);
    for (const a of ['slam', 'sweep', 'boulder', 'beam', 'nova', 'erupt', 'exposing', 'exposed']) assert.ok(colossus.has(a), a);
});

test('Olho: protegido até a esfera voltar; cair abre a janela e o golpe tira vida', () => {
    const { game, b } = fight(STORM);
    assert.equal(b.onStrike({ id: 'body' }, 'dash'), 'blocked');
    assert.equal(b.hp, 6);
    orbFor(game, b).deflect();
    run(game, 3);
    assert.equal(b.act, 'grounded');
    assert.equal(b.vulnerable, true);
    assert.equal(b.onStrike({ id: 'body' }, 'stomp'), 'hit');
    assert.equal(b.hp, 5);
    assert.equal(b.vulnerable, false);
});

test('Olho: a esfera ignorada avisa, explode e fere quem ficou perto', () => {
    const { game, b, p } = fight(STORM, { safe: false });
    let hits = 0;
    game.hurtPlayer = () => { hits++; };
    const orb = orbFor(game, b);
    orb.x = p.x + 1.5;
    orb.y = p.y + 1;
    orb.life = 0.5;
    run(game, 0.2);
    assert.equal(orb.mesh.userData.blast.scale.x > 1, true);
    run(game, 0.4);
    assert.ok(hits >= 1);
    assert.equal(orb.done, true);
});

for (const [name, abilities, act] of [
    ['Onda de Choque', { shockwave: 3 }, (g, p, orb) => { orb.x = p.x + 2; orb.y = p.y + 1; g.input.press('KeyQ'); }],
    ['Lança de Luz', { light_lance: 3 }, (g, p, orb) => { orb.x = p.x + 4; orb.y = p.y + PH / 2; p.facing = 1; g.input.press('KeyQ'); }]
]) {
    test(`${name} devolve a esfera de raio`, () => {
        const { game, b, p } = fight(STORM, { abilities });
        const orb = orbFor(game, b);
        act(game, p, orb);
        run(game, 0.35);
        assert.equal(orb.state === 'return' || orb.done, true);
    });
}

test('Olho: dash devolve a esfera sem custo de vida', () => {
    const { game, b, p, input } = fight(STORM, { safe: false });
    const hp = p.hp;
    const orb = orbFor(game, b);
    orb.x = p.x + 1.4;
    orb.y = p.y + PH / 2;
    input.ix = 1;
    input.press('KeyX');
    run(game, 0.1);
    assert.equal(orb.state, 'return');
    assert.equal(p.hp, hp);
});

test('Contra-ataque: golpe da esfera no instante certo é anulado e devolvido', () => {
    const { game, b, p, input } = fight(STORM, { abilities: { riposte: 3 }, safe: false });
    const orb = orbFor(game, b);
    orb.x = p.x;
    orb.y = p.y + PH / 2;
    const hp = p.hp;
    input.press('KeyQ');
    run(game, 0.15);
    assert.equal(p.hp, hp);
    assert.equal(orb.state, 'return');
});

test('Olho: na fase 2 ele rebate a esfera uma vez antes de cair', () => {
    const { game, b, p } = fight(STORM);
    forcePhase(b, 1);
    run(game, 2.6);
    const orb = orbFor(game, b);
    const shroud = b.shroud;
    orb.deflect();
    while (orb.state === 'return') run(game, 0.05);
    assert.equal(orb.state, 'seek');
    assert.equal(b.shroud, shroud);
    assert.ok(orb.speed > 9, 'mais rápida');
    orb.x = p.x;
    orb.deflect();
    run(game, 3);
    assert.ok(['falling', 'grounded'].includes(b.act), b.act);
});

test('Olho: emboscada esconde o chefe, marca a nuvem real e crava no chão', () => {
    const { game, b } = fight(STORM);
    forcePhase(b, 1);
    run(game, 2.6);
    b.setAct('ambush');
    run(game, 0.3);
    assert.equal(b.hidden, true);
    assert.ok(!b.parts().some(q => q.id === 'body'), 'escondido não é alvo');
    const roles = b.clouds.filter(c => c.role).map(c => c.role).sort();
    assert.deepEqual(roles, ['decoy', 'decoy', 'real']);
    let lodged = false;
    let aimed = false;
    run(game, 3, () => {
        if (b.act === 'aim' && b.t > 0.02 && b.aim.visible) aimed = true;
        if (b.act === 'lodged') lodged = true;
    });
    assert.ok(aimed, 'mira visível antes do mergulho');
    assert.ok(lodged, 'deve cravar no chão');
});

test('Olho: acertar enquanto crava derruba, sem depender da esfera', () => {
    const { game, b } = fight(STORM);
    forcePhase(b, 1);
    run(game, 2.6);
    b.setAct('lodged');
    assert.equal(b.onStrike({ id: 'body' }, 'dash'), 'stagger');
    assert.equal(b.act, 'falling');
});

test('Olho: fase 3 escurece, sobe para-raios e o Raio Mestre é atraído pelo carregado', () => {
    const dims = [];
    const { game, b, p } = fight(STORM);
    game.view.setDim = v => dims.push(v);
    forcePhase(b, 2);
    run(game, 2.6);
    assert.equal(dims.at(-1), 0.34);
    assert.equal(b.maxShroud(), 2);
    assert.equal(b.rods.every(r => r.up), true);
    const rodPart = b.parts().find(q => q.id === 'rod');
    assert.equal(b.onStrike(rodPart, 'dash'), 'stagger');
    assert.ok(rodPart.rod.charge > 0);
    const before = b.shroud;
    p.x = rodPart.rod.x + 10;
    b.setAct('master');
    run(game, 1.6);
    assert.equal(b.shroud, before - 1, 'o véu cede');
    assert.equal(rodPart.rod.charge, 0);
});

test('Olho: adaptação — perto demais o repele, parado recebe descarga no chão', () => {
    const { b, p } = fight(STORM);
    p.x = b.x;
    p.y = b.y;
    assert.equal(b.chooseAct(p), 'repel');
    b.repelCool = 7;
    p.x = b.center;
    p.y = b.floor;
    b.y = b.highY;
    b.campT = 5;
    b.plateCool = 0;
    b.sinceOrb = 0;
    assert.equal(b.chooseAct(p), 'plates');
    assert.deepEqual(b.adaptive, ['repel', 'camp']);
});

test('Olho: placas nunca cobrem o chão inteiro ao mesmo tempo', () => {
    for (const phase of [0, 1, 2]) {
        for (const px of [68, 80, 90, 103]) {
            const { game, b, p } = fight(STORM);
            forcePhase(b, phase);
            game.strikes.forEach(s => s.dispose(game));
            game.strikes.length = 0;
            p.x = px;
            b.firePlates(p);
            const atOnce = {};
            for (const s of game.strikes) atOnce[s.warn] = (atOnce[s.warn] || 0) + 1;
            for (const count of Object.values(atOnce)) assert.ok(count <= 3, `fase ${phase}: ${count}`);
        }
    }
});

test('Olho: vento respeita a Firmeza', () => {
    const measure = abilities => {
        const { b, p } = fight(STORM, { abilities });
        p.x = b.center;
        p.y = b.floor;
        b.windForce = 5;
        const x = p.x;
        b.applyWind(0.5, p);
        return p.x - x;
    };
    assert.ok(measure({ steadfast: 3 }) < measure({ shockwave: 1 }) / 2);
});

test('Olho: morrer volta ao início da fase sem nuvens penduradas', () => {
    const { game, b } = fight(STORM);
    forcePhase(b, 1);
    run(game, 2.6);
    b.setAct('ambush');
    run(game, 0.2);
    assert.equal(b.hidden, true);
    game.respawn();
    assert.equal(b.hidden, false);
    assert.equal(b.windForce, 0);
    assert.equal(game.shots.length, 0);
    assert.equal(b.clouds.every(c => !c.mesh.visible), true);
    assert.equal(b.lifts.every(l => l.on), true);
    assert.equal(b.hp, b.phaseStartHp);
});

test('Guardião: escudo bloqueia; pilares caindo abrem janela', () => {
    const { game, b } = fight(CORE);
    assert.equal(b.shielded, true);
    assert.equal(b.onStrike({ id: 'head' }, 'dash'), 'blocked');
    for (const py of b.pylons.slice()) assert.equal(b.onStrike({ id: 'pylon', pylon: py }, 'dash'), 'stagger');
    assert.equal(b.shielded, false);
    assert.equal(b.act, 'exposing');
    run(game, 0.8);
    assert.equal(b.vulnerable, true);
    assert.equal(b.onStrike({ id: 'head' }, 'dash'), 'hit');
    assert.equal(b.hp, 5);
    assert.equal(b.shielded, true, 'o ciclo recomeça');
    assert.equal(b.pylons.every(q => q.up), true);
});

test('Guardião: pilares renascem se o jogador demorar, e ele reage à perda', () => {
    const { game, b } = fight(CORE);
    const [a] = b.pylons;
    b.onStrike({ id: 'pylon', pylon: a }, 'dash');
    assert.equal(a.up, false);
    assert.ok(b.adaptive.includes('guard-pylon'));
    run(game, 15.5);
    assert.equal(a.up, true);
    assert.equal(b.shielded, true);
});

test('Guardião: fase 2 quebra o chão com aviso, sobe lava e mostra selos com guardas', () => {
    const { game, b } = fight(CORE);
    forcePhase(b, 1);
    const floor = b.slabs.filter(s => s.kind === 'floor');
    assert.ok(floor.some(s => s.state === 'crack'), 'aviso antes de cair');
    assert.equal(floor.every(s => s.active), true, 'ainda sólidos durante o aviso');
    run(game, 3);
    assert.ok(floor.some(s => !s.active));
    assert.ok(floor.filter(s => s.active).length >= 3);
    assert.equal(b.pads.every(q => q.on && q.guard && q.guard.alive), true);
    assert.ok(b.lava.level > b.floor - 2);
});

test('Guardião: selo só marca com o guarda morto e não aceita golpe à distância', () => {
    const { game, b } = fight(CORE);
    forcePhase(b, 1);
    run(game, 3);
    const [pad] = b.pads;
    assert.ok(!b.parts().some(q => q.pad === pad), 'selo guardado não é alvo');
    pad.guard.die(game);
    const part = b.parts().find(q => q.pad === pad);
    assert.ok(part);
    assert.equal(b.onStrike(part, 'ability'), 'none');
    assert.equal(b.onStrike(part, 'dash'), 'stagger');
    assert.ok(pad.sealed > 0);
    assert.equal(b.vulnerable, false);
});

test('Guardião: dash real atinge o guarda em vez de quicar no selo', () => {
    const { game, b, p, input } = fight(CORE);
    forcePhase(b, 1);
    run(game, 3);
    const [pad] = b.pads;
    const guard = pad.guard;
    p.x = guard.x + 3;
    p.y = pad.y;
    p.vx = p.vy = 0;
    p.dashes = 2;
    input.ix = -1;
    input.press('KeyX');
    run(game, 0.3, () => { input.ix = -1; });
    assert.equal(guard.alive, false);
});

test('Guardião: carregador alcança o centro e reabre o selo', () => {
    const { game, b } = fight(CORE);
    forcePhase(b, 1);
    run(game, 3);
    const [pad] = b.pads;
    pad.guard.die(game);
    b.onStrike(b.parts().find(q => q.pad === pad), 'dash');
    b.feedT = 0;
    let fed = false;
    run(game, 10, () => {
        if (pad.sealed === 0 && pad.guard && pad.guard.alive) fed = true;
    });
    assert.ok(fed);
});

test('Guardião: os dois selos acorrentam e abrem janela', () => {
    const { game, b } = fight(CORE);
    forcePhase(b, 1);
    run(game, 3);
    for (const pad of b.pads) {
        pad.guard.die(game);
        b.onStrike(b.parts().find(q => q.pad === pad), 'dash');
    }
    assert.equal(b.act, 'exposing');
    run(game, 0.9);
    assert.equal(b.vulnerable, true);
});

test('Guardião: feixe marca abrigos reais que bloqueiam o raio', () => {
    const { game, b, p, a } = fight(CORE);
    forcePhase(b, 1);
    run(game, 3);
    let hurt = 0;
    game.hurtPlayer = () => { hurt++; };
    b.setAct('beam');
    run(game, 0.02);
    assert.ok(b.safeMarks.length >= 2, 'precisa de abrigos');
    const mark = b.safeMarks.reduce((u, v) => (v.scale.x > u.scale.x ? v : u));
    const x = mark.position.x;
    const shot = [];
    run(game, 3.5, () => {
        p.x = x;
        p.y = a.floor;
        p.vy = 0;
        p.vx = 0;
        for (const s of game.strikes) shot.push(s);
    });
    assert.equal(hurt, 0, 'abrigo protege');
    assert.equal(b.safeMarks.length, 0, 'marcas somem');
});

test('Guardião: fora do abrigo, o feixe fere', () => {
    const { game, b, p, a } = fight(CORE);
    forcePhase(b, 1);
    run(game, 3);
    let hurt = 0;
    game.hurtPlayer = () => { hurt++; };
    b.setAct('beam');
    run(game, 0.02);
    const covered = b.safeMarks.map(m => [m.position.x - m.scale.x / 2, m.position.x + m.scale.x / 2]);
    let open = a.x1 + 2;
    for (let x = a.x1 + 2; x < a.x2 - 2; x += 0.5) {
        if (covered.every(([l, r]) => x < l - 1 || x > r + 1) && b.slabs.some(s => s.kind === 'floor' && s.active && x > s.x + 1 && x < s.x + s.w - 1)) {
            open = x;
            break;
        }
    }
    run(game, 3.5, () => {
        p.x = open;
        p.y = a.floor;
        p.vy = 0;
        p.vx = 0;
    });
    assert.ok(hurt > 0, `descoberto em ${open}`);
});

test('Guardião: nova só atinge quem está colado', () => {
    const { game, b, p } = fight(CORE);
    p.x = b.x + 5;
    p.y = b.y;
    assert.equal(b.chooseAct(p), 'nova');
    let hurt = 0;
    game.hurtPlayer = () => { hurt++; };
    b.setAct('nova');
    run(game, 2.2, () => {
        p.x = b.x + 18;
        p.y = b.floor;
        p.vy = 0;
    });
    assert.equal(hurt, 0);
});

test('Guardião: mão trava antes de cair', () => {
    const { game, b, p } = fight(CORE);
    b.setAct('slam');
    run(game, 0.02);
    const h = b.hands[b.activeHand];
    p.x = b.center;
    p.y = b.floor;
    run(game, 0.78);
    const locked = h.x;
    p.x = b.center + 8;
    run(game, 0.1);
    assert.equal(h.x, locked, 'sem rastrear nos instantes finais');
});

test('Guardião: fase 3 afunda o chão, sobe elevadores e o calor abre o núcleo', () => {
    const { game, b } = fight(CORE);
    forcePhase(b, 2);
    run(game, 3);
    assert.ok(b.slabs.filter(s => s.kind === 'floor').every(s => !s.active));
    assert.ok(b.lifts.every(l => l.active));
    assert.ok(b.pylons.filter(q => q.up).length >= 2, 'válvulas');
    run(game, 3);
    assert.ok(b.lava.level > b.floor + 1);
    b.heat = 0;
    b.setAct('idle');
    b.addHeat(2);
    assert.equal(b.shielded, true);
    b.addHeat(3);
    assert.equal(b.shielded, false);
    assert.equal(b.act, 'exposing');
    run(game, 0.9);
    assert.equal(b.vulnerable, true);
});

test('Guardião: quebrar válvula acelera o calor', () => {
    const { b, game } = fight(CORE);
    forcePhase(b, 2);
    run(game, 2.6);
    const heat = b.heat;
    b.onStrike(b.parts().find(q => q.id === 'pylon'), 'dash');
    assert.equal(b.heat, heat + 2);
});

test('Guardião: morrer na fase 3 renasce sobre plataforma, fora da lava', () => {
    const { game, b, p, a } = fight(CORE);
    forcePhase(b, 2);
    run(game, 6);
    p.x = a.x1 + 1;
    p.y = a.floor;
    game.respawn();
    assert.equal(p.x, a.safe.x);
    assert.ok(p.y > b.lava.level, 'acima da lava');
    assert.equal(p.dead, false);
    assert.equal(b.lava.level, a.floor + 3);
    assert.equal(b.slabs.filter(s => s.kind === 'ledge').every(s => s.active), true);
});

test('Guardião: derrota refaz o chão, baixa a lava e o portal é alcançável a pé', () => {
    const { game, input, b, p, a } = fight(CORE);
    forcePhase(b, 2);
    run(game, 5);
    p.x = a.safe.x;
    p.y = 25;
    while (b.mode === 'fight') {
        b.vulnerable = true;
        b.invuln = 0;
        b.damage();
    }
    assert.equal(b.minions.length, 0);
    assert.equal(b.slabs.every(s => s.active), true);
    run(game, 3);
    assert.equal(b.mode, 'dead');
    assert.ok(b.lava.level <= a.floor - 2);
    run(game, 5.2);
    delete game.hurtPlayer;
    delete game.kill;
    let finished = false;
    run(game, 6, () => {
        input.ix = 1;
        finished = finished || game.finished;
    });
    assert.ok(finished, `não chegou ao portal: ${p.x},${p.y}`);
    assert.equal(p.dead, false);
});

test('justiça: nenhum ataque nasce sem aviso em nenhuma das fases', () => {
    for (const index of [STORM, CORE]) {
        for (const phase of [0, 1, 2]) {
            const { game, b, p } = fight(index);
            forcePhase(b, phase);
            const seen = new Set();
            let least = Infinity;
            run(game, 30, i => {
                p.x = b.center + Math.sin(i / 200) * 10;
                for (const s of game.strikes) {
                    if (seen.has(s)) continue;
                    seen.add(s);
                    least = Math.min(least, s.warn);
                }
            });
            assert.ok(seen.size > 0, `fase ${phase}: sem ataques`);
            assert.ok(least >= 0.35, `chefe ${index} fase ${phase}: aviso de ${least}s`);
        }
    }
});

test('variedade: cada fase alterna vários atos e nunca trava', () => {
    for (const index of [STORM, CORE]) {
        for (const phase of [0, 1, 2]) {
            const { game, b, p } = fight(index);
            forcePhase(b, phase);
            const acts = new Set();
            let stale = 0;
            let last = '';
            run(game, 40, i => {
                p.x = b.center + Math.sin(i / 300) * 12;
                stale = b.act === last ? stale + 1 : 0;
                last = b.act;
                acts.add(b.act);
                assert.ok(stale < 120 * 7, `preso em ${b.act}`);
                assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y));
                assert.ok(game.shots.length < 40, 'projéteis acumulando');
            });
            assert.ok(acts.size >= 4, `chefe ${index} fase ${phase}: ${[...acts]}`);
        }
    }
});

test('a transição de fase cura um coração e limpa os ataques', () => {
    for (const index of [STORM, CORE]) {
        const { game, b, p } = fight(index);
        b.setAct('idle');
        b.strike(b.center, b.floor, 2, 2, 1, 0.3, 0xffffff);
        p.hp = 1;
        forcePhase(b, 1);
        assert.equal(p.hp, 2);
        assert.equal(game.strikes.length, 0);
    }
});

const LOADOUTS = {
    'sem habilidades': null,
    ofensiva: { shockwave: 3, light_lance: 3, riposte: 3 },
    defensiva: { energy_shield: 3, regeneration: 3, heal: 3 },
    mobilidade: { long_dash: 3, air_burst: 3, glide: 3 },
    especial: { time_dilation: 3, summit_form: 3, perfect_dodge: 3 },
    suporte: { steadfast: 3, crystal_link: 3, blade_dash: 3 }
};

for (const [index, name] of [[STORM, 'Olho'], [CORE, 'Guardião']]) {
    for (const [label, abilities] of Object.entries(LOADOUTS)) {
        test(`vencível com entrada real: ${name} com loadout ${label}`, () => {
            const { stats } = playBoss(index, { abilities, limit: 900 });
            assert.ok(stats.won, JSON.stringify(stats));
            assert.ok(stats.windows >= 6);
            assert.equal(Save.data.achievements[index === STORM ? 'boss2' : 'boss3'], true);
        });
    }
}
