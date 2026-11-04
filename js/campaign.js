import { LEVELS } from './levels.js';
import { ABILITIES, isLevelDone } from './abilities.js';

export const CHAPTER_NAMES = { 1: 'A Subida', 2: 'A Tempestade', 3: 'O Núcleo' };
export const CHAPTER_DESC = {
    1: 'Da base do acampamento até o primeiro cume, atravessando cidade, caverna e templo.',
    2: 'Vento, raios e ruínas suspensas. O céu inteiro está contra você.',
    3: 'Lava e fogo no coração da montanha, até o cume eterno.'
};
export const BOSSES = {
    boss1: { name: 'Caçador do Pico', chapter: 1 },
    boss2: { name: 'Olho da Tempestade', chapter: 2 },
    boss3: { name: 'Guardião do Cume', chapter: 3 }
};
export const DIFFICULTY = ['Tranquila', 'Moderada', 'Difícil', 'Muito difícil', 'Extrema'];

const LEVEL_INFO = [
    { desc: 'Os primeiros passos da subida. Aprenda a saltar, usar o dash e pisar nos inimigos.', difficulty: 1 },
    { desc: 'Muros antigos e espinhos entre as ruas. A escalada passa a ser obrigatória.', difficulty: 1 },
    { desc: 'Molas e cristais formam o caminho sobre um longo trecho de espinhos.', difficulty: 2 },
    { desc: 'Uma ascensão contínua entre plataformas altas e inimigos voadores.', difficulty: 2 },
    { desc: 'O topo do primeiro capítulo. No fim da trilha, a fera de pedra espera na arena.', difficulty: 3 },
    { desc: 'Rajadas de vento mudam cada salto. Investidores e raios protegem o vale.', difficulty: 3 },
    { desc: 'Plataformas móveis sobre o vazio. Escudos só caem por trás ou por cima.', difficulty: 3 },
    { desc: 'Uma descida guiada pelo vento, com raios frequentes e predadores aéreos.', difficulty: 4 },
    { desc: 'O topo da tempestade. O Olho observa cada movimento e o chão não é seguro.', difficulty: 4 },
    { desc: 'Lava que sobe, gêiseres e barras de fogo. Parar significa queimar.', difficulty: 4 },
    { desc: 'Uma subida vertical pelo interior da montanha, com sentinelas e lava constante.', difficulty: 5 },
    { desc: 'O último trecho. A própria montanha se levanta para impedir sua chegada.', difficulty: 5 }
];

const ENEMY_TYPES = new Set(['charger', 'spitter', 'shield', 'diver', 'sentinel']);
const BASE_MOVE_REWARDS = { 2: 'Pulo Duplo', 5: 'Dash Aéreo', 9: 'Pancada no Chão' };

const facts = LEVELS.map((level, index) => {
    const cells = level.grid.cells.flat();
    const objects = level.objects || [];
    return {
        index,
        name: level.name,
        chapter: level.chapter,
        boss: level.boss || null,
        berries: cells.filter(c => c === 'S').length,
        flags: cells.filter(c => c === 'K').length,
        enemies: cells.filter(c => c === 'E' || c === 'F').length + objects.filter(o => ENEMY_TYPES.has(o.type)).length,
        secrets: objects.filter(o => o.type === 'secret').length,
        ...LEVEL_INFO[index]
    };
});

export const levelFacts = index => facts[index];
export const chapterLevels = chapter => facts.filter(f => f.chapter === chapter);
export const TOTAL_LEVELS = LEVELS.length;
export const TOTAL_SECRETS = facts.reduce((sum, f) => sum + f.secrets, 0);
export const TOTAL_BERRIES = facts.reduce((sum, f) => sum + f.berries, 0);

export function levelStatus(d, index) {
    if (isLevelDone(d, index)) return 'done';
    return index < d.unlocked ? 'open' : 'locked';
}

export function continueLevel(d) {
    if (d.checkpoint && d.checkpoint.level < d.unlocked) return d.checkpoint.level;
    return d.unlocked - 1;
}

export function resumeFor(d, index) {
    return d.checkpoint && d.checkpoint.level === index ? d.checkpoint : null;
}

export function campaignProgress(d) {
    const done = facts.filter(f => isLevelDone(d, f.index)).length;
    return { done, total: facts.length, pct: Math.round((done / facts.length) * 100) };
}

export function chapterProgress(d, chapter) {
    const levels = chapterLevels(chapter);
    const done = levels.filter(f => isLevelDone(d, f.index)).length;
    return { done, total: levels.length, pct: Math.round((done / levels.length) * 100), open: levels[0].index < d.unlocked };
}

export function defeatedBosses(d) {
    return Object.keys(BOSSES).filter(id => d.achievements[id]);
}

export function exploration(d) {
    const secrets = Object.keys(d.secrets).length;
    const berries = facts.reduce((sum, f) => sum + Math.min(f.berries, d.best[f.index] ? d.best[f.index].berries : 0), 0);
    const found = secrets + berries;
    const total = TOTAL_SECRETS + TOTAL_BERRIES;
    return { secrets, berries, pct: Math.round((found / total) * 100) };
}

export function levelObjectives(index) {
    const f = facts[index];
    const list = [];
    if (f.boss) list.push({ icon: 'boss', text: `Derrote ${BOSSES[f.boss].name}` });
    list.push({ icon: 'flag', text: 'Alcance o portal no fim da fase' });
    list.push({ icon: 'berry', text: `Opcional: colete ${f.berries} morangos` });
    if (f.secrets) list.push({ icon: 'eye', text: 'Opcional: encontre a área secreta' });
    return list;
}

export function levelRewards(d, index) {
    const f = facts[index];
    const list = [];
    if (BASE_MOVE_REWARDS[index] && !isLevelDone(d, index)) list.push({ icon: 'spark', text: `Movimento: ${BASE_MOVE_REWARDS[index]}` });
    const chapterEnd = !facts[index + 1] || facts[index + 1].chapter !== f.chapter;
    for (const a of ABILITIES) {
        if (d.abilities[a.id]) continue;
        const u = a.unlock;
        if (u.level === index + 1 || (f.boss && u.boss === f.boss) || (chapterEnd && u.chapter === f.chapter)) {
            list.push({ icon: a.icon, text: `Habilidade: ${a.name}` });
        }
    }
    return list;
}
