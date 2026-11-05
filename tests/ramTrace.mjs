import { newGame } from './helpers.mjs';
import { STEP } from '../js/config.js';

export function ramTrace() {
    const { game, input } = newGame(4);
    const a = game.level.arena;
    game.player.x = a.triggerX + 1;
    game.player.y = a.floor + 0.2;
    const lines = [];
    let hash = 2166136261;
    for (let i = 0; i < 120 * 150; i++) {
        input.ix = i % 500 < 250 ? 1 : -1;
        if (i % 97 === 0) { input.held.add('Space'); input.press('Space'); }
        if (i % 97 === 30) input.held.delete('Space');
        if (i % 211 === 0) input.press('KeyX');
        game.step(STEP);
        input.endFrame();
        if (i % 30 === 0) {
            const b = game.boss;
            const line = [b.x.toFixed(3), b.y.toFixed(3), b.act, b.hp, b.phase, b.mode, b.vulnerable, game.shots.length, game.strikes.length, game.player.x.toFixed(3), game.player.y.toFixed(3), game.player.hp, game.player.dead].join('|');
            lines.push(line);
            for (let c = 0; c < line.length; c++) hash = Math.imul(hash ^ line.charCodeAt(c), 16777619) >>> 0;
        }
    }
    const acts = new Set(lines.map(l => l.split('|')[2]));
    return { hash, acts: [...acts].sort(), last: lines[lines.length - 1] };
}

if (process.argv[1] && process.argv[1].endsWith('ramTrace.mjs')) console.log(JSON.stringify(ramTrace()));
