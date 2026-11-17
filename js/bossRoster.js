import { RamBoss } from './bosses.js';
import { StormBoss } from './bossStorm.js';
import { ColossusBoss } from './bossColossus.js';
import { BeastBoss } from './bossBeast.js';
import { MentorBoss } from './bossMentor.js';
import { HeraldBoss } from './bossHerald.js';

const ROSTER = {
    boss1: RamBoss,
    boss2: StormBoss,
    boss3: ColossusBoss,
    beast: BeastBoss,
    mentor: MentorBoss,
    herald: HeraldBoss
};

export function createBoss(game, id) {
    const BossClass = ROSTER[id];
    if (!BossClass) throw new Error(`Chefe desconhecido: ${id}`);
    return new BossClass(game);
}
