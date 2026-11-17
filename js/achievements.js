// Catálogo de conquistas. Cada uma tem condição objetiva, checada em um único ponto do jogo
// (game.js, hub.js ou main.js); `group` organiza a aba Conquistas e `goal` alimenta a barra de progresso.
export const ACHIEVEMENT_GROUPS = [
    { id: 'progress', name: 'Jornada' },
    { id: 'bosses', name: 'Chefes' },
    { id: 'mastery', name: 'Domínio' },
    { id: 'explore', name: 'Exploração' }
];

export const ACHIEVEMENTS = [
    { id: 'first_steps', group: 'progress', icon: 'boot', name: 'Primeira Fase Concluída', desc: 'Conclua a primeira fase do jogo.' },
    { id: 'chapter_done', group: 'progress', icon: 'flag', name: 'Capítulo Concluído', desc: 'Conclua qualquer capítulo.' },
    { id: 'no_death_chapter', group: 'progress', icon: 'shield', name: 'Capítulo Concluído Sem Morrer', desc: 'Jogue um capítulo inteiro em sequência, da primeira à última fase, sem morrer nenhuma vez.' },
    { id: 'summit', group: 'progress', icon: 'peak', name: 'O Silêncio da Montanha', desc: 'Conclua o Capítulo 3.' },
    { id: 'no_death_all', group: 'progress', icon: 'trophy', name: 'A Montanha Imaculada', desc: 'Conclua os Capítulos 1, 2 e 3 sem nenhuma morte registrada no save.' },
    { id: 'iron_mountain', group: 'progress', icon: 'skull', name: 'Sem Segunda Chance', desc: 'Conclua o Capítulo 3 em uma campanha no modo Morte Súbita.' },
    { id: 'inferno_gate', group: 'progress', icon: 'crown', name: 'Além dos Portões', desc: 'Conclua o Capítulo 4, o primeiro do Inferno.' },
    { id: 'sky_reached', group: 'progress', icon: 'crown', name: 'Sem Instruções', desc: 'Conclua o Capítulo 5, no Céu.' },
    { id: 'game_cleared', group: 'progress', icon: 'trophy', name: 'A Jornada Inteira', desc: 'Veja os créditos finais e libere a escolha de região.' },

    { id: 'boss1', group: 'bosses', icon: 'boss', name: 'Caçador do Pico', desc: 'Derrote o Caçador do Pico.' },
    { id: 'boss2', group: 'bosses', icon: 'boss', name: 'Tempestade Vencida', desc: 'Derrote o Olho da Tempestade.' },
    { id: 'boss3', group: 'bosses', icon: 'boss', name: 'Cume Conquistado', desc: 'Derrote o Guardião do Cume.' },
    { id: 'beast', group: 'bosses', icon: 'boss', name: 'Besta Domada', desc: 'Derrote a Besta de Carga na Ponte das Correntes.' },
    { id: 'mentor', group: 'bosses', icon: 'boss', name: 'O Aluno Supera', desc: 'Derrote o Mentor Corrompido.' },
    { id: 'herald', group: 'bosses', icon: 'boss', name: 'Sentença Anulada', desc: 'Derrote o Arauto do Alto.' },
    { id: 'boss_nodmg', group: 'bosses', icon: 'star', name: 'Intocável', desc: 'Derrote qualquer chefe sem sofrer nenhum dano durante a luta.' },
    { id: 'beast_clean', group: 'bosses', icon: 'spike', name: 'Contrapeso', desc: 'Derrote a Besta de Carga sem que ela bata em nenhuma das pontas da ponte.' },
    { id: 'mentor_pure', group: 'bosses', icon: 'boot', name: 'Só o Básico', desc: 'Derrote o Mentor Corrompido sem nenhuma habilidade equipada.' },

    { id: 'parry_10', group: 'mastery', icon: 'parry', name: 'Guarda Perfeita', desc: 'Anule 10 golpes com o Contra-ataque.', goal: d => [d.parries, 10] },
    { id: 'dodge_25', group: 'mastery', icon: 'dodge', name: 'Reflexo Puro', desc: 'Atravesse 25 golpes com o Reflexo Instintivo.', goal: d => [d.dodges, 25] },
    { id: 'air_chain', group: 'mastery', icon: 'bolt', name: 'Sem Tocar o Chão', desc: 'Derrote 3 inimigos seguidos sem tocar o chão.' },
    { id: 'unscathed', group: 'mastery', icon: 'heart', name: 'Pele Intacta', desc: 'Conclua uma fase do Inferno sem sofrer nenhum dano.' },
    { id: 'speed', group: 'mastery', icon: 'clock', name: 'Velocista', desc: 'Conclua a primeira fase em menos de 40 s.' },
    { id: 'stomp_100', group: 'mastery', icon: 'boot', name: 'Pisa Forte', desc: 'Derrote 100 inimigos.', goal: d => [d.stomps, 100] },
    { id: 'crystal_100', group: 'mastery', icon: 'crystal', name: 'Energia Pura', desc: 'Use 100 cristais de dash.', goal: d => [d.crystals, 100] },
    { id: 'ability_max3', group: 'mastery', icon: 'spark', name: 'Domínio', desc: 'Evolua três habilidades até o nível máximo.', goal: d => [d.maxedAbilities, 3] },
    { id: 'all_skills', group: 'mastery', icon: 'star', name: 'Mestre', desc: 'Desbloqueie todos os movimentos e habilidades.', goal: d => [d.unlockedPowers, d.totalPowers] },

    { id: 'berry_100', group: 'explore', icon: 'berry', name: 'Colecionador', desc: 'Pegue 100 morangos no total.', goal: d => [d.berries, 100] },
    { id: 'berry_chapter', group: 'explore', icon: 'berry', name: 'Colheita Completa', desc: 'Tenha todos os morangos em todas as fases de um mesmo capítulo.' },
    { id: 'secret_area', group: 'explore', icon: 'eye', name: 'Explorador', desc: 'Encontre uma área secreta.', secret: true },
    { id: 'secrets_all', group: 'explore', icon: 'eye', name: 'Cartógrafo', desc: 'Encontre todas as áreas secretas.', goal: d => [d.secretCount, d.totalSecrets] },
    { id: 'all_records', group: 'explore', icon: 'scroll', name: 'Cronista', desc: 'Reúna todos os registros de uma campanha.', goal: d => [d.recordCount, d.totalRecords] },
    { id: 'trial_ch3', group: 'explore', icon: 'trophy', name: 'Provação do Núcleo', desc: 'Vença um desafio opcional do Capítulo 3.', secret: true },
    { id: 'core_reached', group: 'explore', icon: 'eye', name: 'O Silêncio', desc: 'Responda à pergunta do Núcleo.', secret: true }
];

const BY_ID = new Map(ACHIEVEMENTS.map(a => [a.id, a]));
export const achievementById = id => BY_ID.get(id);

// Conquistas antigas com condição equivalente são convertidas; as fáceis que deixaram de existir somem.
const LEGACY = {
    no_death_ch1: 'no_death_chapter', no_death_ch2: 'no_death_chapter', no_death_ch3: 'no_death_chapter',
    ch1_complete: 'chapter_done', ch2_complete: 'chapter_done', ch3_complete: 'chapter_done'
};

export function sanitizeAchievements(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const [id, value] of Object.entries(raw)) {
        if (value !== true) continue;
        const target = BY_ID.has(id) ? id : LEGACY[id];
        if (target) out[target] = true;
    }
    return out;
}
