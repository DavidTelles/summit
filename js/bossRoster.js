import { RamBoss } from './bosses.js';
import { StormBoss } from './bossStorm.js';
import { ColossusBoss } from './bossColossus.js';

export function createBoss(game, id) {
    if (id === 'boss1') return new RamBoss(game);
    if (id === 'boss2') return new StormBoss(game);
    return new ColossusBoss(game);
}
