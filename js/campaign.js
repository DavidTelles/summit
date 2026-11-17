import { LEVELS } from './levels.js';
import { ABILITIES, isLevelDone } from './abilities.js';
import { MAIN_COUNT, ROOMS, anchorOf, isRoom } from './worldMap.js';

export const CHAPTER_NAMES = { 1: 'A Subida', 2: 'A Tempestade', 3: 'O Núcleo', 4: 'Os Portões', 5: 'O Alto' };
export const CHAPTER_DESC = {
    1: 'Da base do acampamento até o primeiro cume, atravessando cidade, caverna e templo.',
    2: 'Vento, raios e ruínas suspensas. O céu inteiro está contra você.',
    3: 'Lava e fogo no coração da montanha, até o cume eterno.',
    4: 'Abaixo do Núcleo, o Fundo. Cinzas, correntes e alguém que você conhecia esperando no salão.',
    5: 'Acima das nuvens, o Alto. Luz sem sombra, vento sem chão e olhos demais para contar.'
};
export const BOSSES = {
    boss1: { name: 'Caçador do Pico', chapter: 1, lore: 'Varak' },
    boss2: { name: 'Olho da Tempestade', chapter: 2, lore: 'Aethos, o Observador', tip: 'Dica: golpes e habilidades devolvem as esferas de raio ao Olho.' },
    boss3: { name: 'Guardião do Cume', chapter: 3, tip: 'Dica: ele só sofre dano sem o escudo. Destrua o que o sustenta e leve mobilidade.' },
    beast: { name: 'Besta de Carga', chapter: 4, tip: 'Dica: golpeie uma âncora com dash ou pisão para derrubar um contrapeso no caminho da investida.' },
    mentor: { name: 'Mentor Corrompido', chapter: 4, lore: 'Oren', tip: 'Dica: cada ataque dele termina com uma pausa. Desvie primeiro; golpeie na pausa.' },
    herald: { name: 'Arauto do Alto', chapter: 5, tip: 'Dica: ele só toca o chão depois do mergulho. Saia da marca dourada e golpeie antes que ele suba.' }
};
export const DIFFICULTY = ['Tranquila', 'Moderada', 'Difícil', 'Muito difícil', 'Extrema'];

const LEVEL_INFO = [
    { desc: 'Você parte de madrugada, sem avisar ninguém. Aprenda a saltar, usar o dash e pisar nas criaturas de pedra.', difficulty: 1 },
    { desc: 'As ruas da civilização perdida. Muros antigos e espinhos: a escalada passa a ser obrigatória.', difficulty: 1 },
    { desc: 'Cristais de Éter ainda pulsam aqui, fracos. Eles formam o caminho sobre um longo trecho de espinhos.', difficulty: 2 },
    { desc: 'Uma ascensão contínua até o templo que canalizava o vento. Há algo gravado nas paredes.', difficulty: 2 },
    { desc: 'O topo do primeiro capítulo. No fim da trilha, a fera de pedra espera na arena.', difficulty: 3 },
    { desc: 'Rajadas de vento mudam cada salto. Investidores e raios protegem o vale.', difficulty: 3 },
    { desc: 'Plataformas móveis sobre o vazio. Escudos só caem por trás ou por cima.', difficulty: 3 },
    { desc: 'Uma descida guiada pelo vento, com raios frequentes e predadores aéreos.', difficulty: 4 },
    { desc: 'O topo da tempestade. O Olho caça das nuvens e só cai se você devolver seus raios.', difficulty: 4 },
    { desc: 'A entrada das fendas de lava, com gêiseres e máquinas antigas. Parar significa queimar.', difficulty: 4 },
    { desc: 'Nas profundezas, as galerias só levam adiante: sentinelas de ferro fundido e lava constante.', difficulty: 5 },
    { desc: 'O último trecho. O chão desaba, a lava sobe e a própria montanha tenta impedir sua chegada.', difficulty: 5 },
    { desc: 'O primeiro passo no Fundo. Cinzas no ar, lava em cada vão e um muro antigo para escalar.', difficulty: 4 },
    { desc: 'Plataformas que cedem até uma ponte sobre a lava. Algo enorme ainda puxa as correntes.', difficulty: 4 },
    { desc: 'O salão onde o velho guarda espera. Ele conhece cada movimento seu, porque foi ele quem os ensinou.', difficulty: 5 },
    { desc: 'O primeiro passo acima das nuvens. Não há lava aqui: errar o salto é cair para sempre.', difficulty: 4 },
    { desc: 'Degraus de luz que acendem e apagam em turnos. Quem hesita fica sem chão.', difficulty: 5 },
    { desc: 'O topo de tudo. O Arauto julga de longe e só desce para executar a sentença.', difficulty: 5 }
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

// Morangos e segredos de cada sala do mundo (fases e salas opcionais).
const roomTotals = ROOMS.map(room => ({
    berries: room.grid.cells.flat().filter(c => c === 'S').length,
    secrets: (room.objects || []).filter(o => o.type === 'secret').length
}));

export const levelFacts = index => facts[index];
export const chapterLevels = chapter => facts.filter(f => f.chapter === chapter);
export const TOTAL_LEVELS = LEVELS.length;
export const TOTAL_SECRETS = roomTotals.reduce((sum, r) => sum + r.secrets, 0);
export const TOTAL_BERRIES = roomTotals.reduce((sum, r) => sum + r.berries, 0);
export const roomBerries = index => (roomTotals[index] ? roomTotals[index].berries : 0);

export function levelStatus(d, index) {
    if (isLevelDone(d, index)) return 'done';
    return index < d.unlocked ? 'open' : 'locked';
}

// Fase principal que representa onde o jogador está (para textos, capítulo e cenário da central).
export function continueLevel(d) {
    if (d.checkpoint && isRoom(d.checkpoint.level)) return anchorOf(d.checkpoint.level);
    return d.unlocked - 1;
}

// Onde "Continuar" leva: o último checkpoint salvo, ou o início da fase mais avançada.
export function continueRoom(d) {
    if (d.checkpoint && isRoom(d.checkpoint.level)) return { room: d.checkpoint.level, resume: d.checkpoint };
    return { room: Math.min(MAIN_COUNT - 1, d.unlocked - 1), resume: null };
}

export function resumeFor(d, index) {
    return d.checkpoint && d.checkpoint.level === index ? d.checkpoint : null;
}

// Morangos já coletados numa sala: vale o maior entre a coleta persistente e o recorde antigo.
export function berriesFound(d, index) {
    const prefix = `${index}:`;
    const kept = Object.keys(d.world.collected).filter(k => k.startsWith(prefix)).length;
    const best = index < MAIN_COUNT && d.best[index] ? d.best[index].berries : 0;
    return Math.min(roomBerries(index), Math.max(kept, best));
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
    const berries = ROOMS.reduce((sum, _, i) => sum + berriesFound(d, i), 0);
    const found = secrets + berries;
    const total = TOTAL_SECRETS + TOTAL_BERRIES;
    return { secrets, berries, pct: Math.round((found / total) * 100) };
}

export function levelObjectives(index) {
    const f = facts[index];
    const list = [];
    if (f.boss) list.push({ icon: 'boss', text: `Derrote ${BOSSES[f.boss].name}` });
    if (f.boss && BOSSES[f.boss].tip) list.push({ icon: 'eye', text: BOSSES[f.boss].tip });
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
