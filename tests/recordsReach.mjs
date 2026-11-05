import { LEVELS } from './helpers.mjs';
import { RECORDS } from '../js/story.js';
import { collectTargets, solve } from './solver.mjs';

const filter = process.argv[2] ? process.argv[2].split(',') : null;
let failed = 0;
for (const r of RECORDS.filter(x => !x.auto && (!filter || filter.includes(x.id)))) {
    const target = { x: r.at[0], y: r.at[1] };
    const flags = [null, ...collectTargets(r.level, 'K')].sort((a, b) => (a && b ? Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y) : a ? -1 : 1));
    let result = null;
    for (const from of flags.slice(0, 3)) {
        result = solve(r.level, target, { ms: 20000, from, radius: 0.9 });
        if (result.ok) break;
    }
    console.log(`${result.ok ? 'OK    ' : 'FALHOU'} fase ${r.level + 1} ${LEVELS[r.level].name}: ${r.title}${result.ok ? '' : ` perto=${result.bestD} em ${result.bestP}`}`);
    if (!result.ok) failed++;
}
process.exit(failed ? 1 : 0);
