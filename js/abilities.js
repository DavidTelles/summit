export const LOADOUT_SIZE = 3;

export const CATEGORIES = [
    { id: 'offense', name: 'Ofensivas', icon: 'blade' },
    { id: 'defense', name: 'Defensivas', icon: 'shield' },
    { id: 'mobility', name: 'Mobilidade', icon: 'longdash' },
    { id: 'support', name: 'Suporte', icon: 'heal' },
    { id: 'special', name: 'Especiais', icon: 'summit' }
];

export const TYPE_LABEL = { active: 'Ativável', passive: 'Passiva', hold: 'Segurar Pular' };

export const ABILITIES = [
    {
        id: 'shockwave', name: 'Onda de Choque', icon: 'wave', category: 'offense', type: 'active',
        desc: 'Libera um anel de energia que atinge tudo ao redor e apaga projéteis.',
        unlock: { start: true },
        levels: [
            { text: 'Raio de 3,5 blocos.', radius: 3.5, cooldown: 9, cost: 1 },
            { text: 'Raio de 4,5 blocos e recarga menor.', radius: 4.5, cooldown: 8, cost: 1, req: { chapter: 1 } },
            { text: 'Raio de 5,5 blocos. Recupera o dash ao disparar.', radius: 5.5, cooldown: 6.5, cost: 1, refund: true, req: { chapter: 2 } }
        ]
    },
    {
        id: 'light_lance', name: 'Lança de Luz', icon: 'lance', category: 'offense', type: 'active',
        desc: 'Dispara um feixe na direção apontada. Atravessa inimigos e ignora escudos frontais.',
        unlock: { level: 7 },
        levels: [
            { text: 'Alcance de 10 blocos.', range: 10, cooldown: 5, cost: 1 },
            { text: 'Alcance de 14 blocos e recarga menor.', range: 14, cooldown: 4, cost: 1, req: { boss: 'boss2' } },
            { text: 'Alcance de 18 blocos. Também quebra paredes rachadas.', range: 18, cooldown: 3, cost: 1, breaks: true, req: { chapter: 3 } }
        ]
    },
    {
        id: 'blade_dash', name: 'Lâmina Energizada', icon: 'blade', category: 'offense', type: 'active',
        desc: 'Por alguns segundos, o dash ganha alcance maior e atravessa escudos e investidas inimigas.',
        unlock: { stomps: 15 },
        levels: [
            { text: 'Dura 6 s.', duration: 6, cooldown: 14 },
            { text: 'Dura 7 s. Derrotar um inimigo com o dash recupera o dash.', duration: 7, cooldown: 13, refund: true, req: { stomps: 35 } },
            { text: 'Dura 9 s, com recarga menor.', duration: 9, cooldown: 10, refund: true, req: { stomps: 60 } }
        ]
    },
    {
        id: 'riposte', name: 'Contra-ataque', icon: 'parry', category: 'offense', type: 'active',
        desc: 'Abre uma guarda curta. Um golpe recebido nesse instante é anulado e devolvido em área.',
        unlock: { level: 8 },
        levels: [
            { text: 'Guarda de 0,4 s.', duration: 0.4, cooldown: 5, radius: 3 },
            { text: 'Guarda de 0,5 s e recarga menor.', duration: 0.5, cooldown: 4, radius: 3, req: { boss: 'boss2' } },
            { text: 'Guarda de 0,6 s. Acertar o tempo zera a recarga.', duration: 0.6, cooldown: 3.5, radius: 4, reset: true, req: { boss: 'boss3' } }
        ]
    },
    {
        id: 'energy_shield', name: 'Escudo de Energia', icon: 'bubble', category: 'defense', type: 'active',
        desc: 'Ergue uma bolha que absorve golpes por um tempo. Não protege de espinhos, quedas ou lava.',
        unlock: { level: 1 },
        levels: [
            { text: 'Absorve 1 golpe por até 8 s.', duration: 8, cooldown: 16, charges: 1 },
            { text: 'Absorve 1 golpe por até 10 s, com recarga menor.', duration: 10, cooldown: 14, charges: 1, req: { chapter: 1 } },
            { text: 'Absorve 2 golpes por até 12 s.', duration: 12, cooldown: 14, charges: 2, req: { level: 8 } }
        ]
    },
    {
        id: 'perfect_dodge', name: 'Reflexo Instintivo', icon: 'dodge', category: 'defense', type: 'passive',
        desc: 'Durante o dash você não recebe dano de golpes, tiros ou perigos de área.',
        unlock: { stomps: 8 },
        levels: [
            { text: 'Imune durante o dash.', after: 0 },
            { text: 'Imunidade dura mais 0,15 s após o dash.', after: 0.15, req: { level: 7 } },
            { text: 'Mais 0,3 s após o dash. Esquivar de um golpe recupera o dash.', after: 0.3, refund: true, req: { chapter: 2 } }
        ]
    },
    {
        id: 'regeneration', name: 'Regeneração', icon: 'regen', category: 'defense', type: 'passive',
        desc: 'Recupera 1 coração depois de um tempo sem sofrer dano.',
        unlock: { berries: 20 },
        levels: [
            { text: 'A cada 20 s sem dano.', interval: 20 },
            { text: 'A cada 15 s sem dano.', interval: 15, req: { berries: 35 } },
            { text: 'A cada 10 s sem dano.', interval: 10, req: { chapter: 3 } }
        ]
    },
    {
        id: 'last_stand', name: 'Última Chance', icon: 'lastchance', category: 'defense', type: 'passive',
        desc: 'Um golpe fatal deixa você com 1 coração e invulnerável por 2 s. Uma vez por fase.',
        unlock: { ach: 'no_death' },
        levels: [
            { text: 'Funciona contra inimigos e perigos de área.', spikes: false, recharge: false },
            { text: 'Recarrega ao ativar um checkpoint.', spikes: false, recharge: true, req: { boss: 'boss2' } },
            { text: 'Também salva de espinhos. Quedas e lava continuam fatais.', spikes: true, recharge: true, req: { chapter: 3 } }
        ]
    },
    {
        id: 'long_dash', name: 'Dash Longo', icon: 'longdash', category: 'mobility', type: 'passive',
        desc: 'Aumenta a distância percorrida pelo dash.',
        unlock: { level: 2 },
        levels: [
            { text: 'Dash 30% mais longo.', mult: 1.3 },
            { text: 'Dash 45% mais longo.', mult: 1.45, req: { level: 6 } },
            { text: 'Dash 60% mais longo.', mult: 1.6, req: { level: 10 } }
        ]
    },
    {
        id: 'air_burst', name: 'Impulso Aéreo', icon: 'burst', category: 'mobility', type: 'active',
        desc: 'Um empurrão para cima no meio do ar, para corrigir um salto que ficou curto.',
        unlock: { level: 6 },
        levels: [
            { text: 'Impulso médio.', power: 0.85, cooldown: 7, cost: 1 },
            { text: 'Impulso forte e recarga menor.', power: 0.95, cooldown: 6, cost: 1, req: { level: 9 } },
            { text: 'Impulso máximo. Devolve o pulo duplo.', power: 1.05, cooldown: 5, cost: 1, refresh: true, req: { level: 11 } }
        ]
    },
    {
        id: 'glide', name: 'Queda Controlada', icon: 'glide', category: 'mobility', type: 'hold',
        desc: 'Segure Pular durante a queda para descer devagar, gastando fôlego.',
        unlock: { berries: 8 },
        levels: [
            { text: 'Queda lenta. Gasta 1,2 de fôlego por segundo.', fall: 3.2, drain: 1.2 },
            { text: 'Queda mais lenta. Gasta 0,9 por segundo.', fall: 2.6, drain: 0.9, req: { level: 7 } },
            { text: 'Quase flutua. Gasta 0,6 por segundo.', fall: 2, drain: 0.6, req: { chapter: 2 } }
        ]
    },
    {
        id: 'crystal_link', name: 'Elo de Cristal', icon: 'link', category: 'mobility', type: 'active',
        desc: 'Puxa você até o cristal de dash disponível mais próximo, em linha reta.',
        unlock: { crystals: 6 },
        levels: [
            { text: 'Alcance de 8 blocos.', range: 8, cooldown: 6 },
            { text: 'Alcance de 10 blocos e recarga menor.', range: 10, cooldown: 5, req: { crystals: 20 } },
            { text: 'Alcance de 12 blocos.', range: 12, cooldown: 4, req: { crystals: 40 } }
        ]
    },
    {
        id: 'heal', name: 'Recuperação', icon: 'heal', category: 'support', type: 'active',
        desc: 'Restaura corações na hora, em troca de fôlego que demora a voltar.',
        unlock: { level: 3 },
        levels: [
            { text: 'Recupera 1 coração.', amount: 1, cooldown: 25, cost: 3 },
            { text: 'Recupera 1 coração, com menor custo e recarga.', amount: 1, cooldown: 20, cost: 2, req: { chapter: 1 } },
            { text: 'Recupera 2 corações.', amount: 2, cooldown: 20, cost: 2, req: { chapter: 2 } }
        ]
    },
    {
        id: 'second_wind', name: 'Segundo Fôlego', icon: 'wind', category: 'support', type: 'active',
        desc: 'Enche o fôlego e impede que ele seja gasto por alguns segundos. Ideal para escaladas longas.',
        unlock: { ach: 'crystal_10' },
        levels: [
            { text: 'Fôlego livre por 5 s.', duration: 5, cooldown: 20 },
            { text: 'Fôlego livre por 6 s, com recarga menor.', duration: 6, cooldown: 18, req: { level: 8 } },
            { text: 'Fôlego livre por 8 s.', duration: 8, cooldown: 15, req: { level: 11 } }
        ]
    },
    {
        id: 'perception', name: 'Percepção', icon: 'eye', category: 'support', type: 'passive',
        desc: 'Faz paredes rachadas, áreas secretas e registros próximos brilharem e avisa no painel.',
        unlock: { level: 4 },
        levels: [
            { text: 'Detecta a até 10 blocos.', radius: 10 },
            { text: 'Detecta a até 14 blocos.', radius: 14, req: { secrets: 1 } },
            { text: 'Detecta a até 20 blocos e também revela morangos.', radius: 20, berries: true, req: { secrets: 3 } }
        ]
    },
    {
        id: 'focus', name: 'Concentração', icon: 'focus', category: 'support', type: 'active',
        desc: 'Por alguns segundos, as outras habilidades recarregam muito mais rápido.',
        unlock: { level: 10 },
        levels: [
            { text: 'Recarga 2,5x mais rápida por 5 s.', duration: 5, cooldown: 24, rate: 2.5 },
            { text: 'Recarga 3x mais rápida por 6 s.', duration: 6, cooldown: 22, rate: 3, req: { level: 11 } },
            { text: 'Recarga 3x mais rápida por 7 s, com recarga menor.', duration: 7, cooldown: 20, rate: 3, req: { boss: 'boss3' } }
        ]
    },
    {
        id: 'steadfast', name: 'Firmeza', icon: 'steadfast', category: 'support', type: 'passive',
        desc: 'Golpes não empurram nem atordoam você.',
        unlock: { secrets: 2 },
        levels: [
            { text: 'Sem recuo nem atordoamento ao sofrer dano.', wind: 1, iframes: 0 },
            { text: 'Rajadas de vento empurram pela metade.', wind: 0.5, iframes: 0, req: { secrets: 3 } },
            { text: 'Vento a 25% e invulnerabilidade 0,6 s maior após um golpe.', wind: 0.25, iframes: 0.6, req: { secrets: 5 } }
        ]
    },
    {
        id: 'recall', name: 'Retorno', icon: 'recall', category: 'special', type: 'active',
        desc: 'Marca o local onde você está. Use de novo para voltar à marca antes que ela expire.',
        unlock: { boss: 'boss1' },
        levels: [
            { text: 'A marca dura 6 s.', duration: 6, cooldown: 14 },
            { text: 'A marca dura 8 s, com recarga menor.', duration: 8, cooldown: 12, req: { boss: 'boss2' } },
            { text: 'A marca dura 10 s. Voltar recupera o dash.', duration: 10, cooldown: 10, refund: true, req: { boss: 'boss3' } }
        ]
    },
    {
        id: 'time_dilation', name: 'Tempo Suspenso', icon: 'hourglass', category: 'special', type: 'active',
        desc: 'O mundo desacelera ao seu redor. Você continua em velocidade normal.',
        unlock: { boss: 'boss2' },
        levels: [
            { text: 'Mundo a 50% por 3 s.', scale: 0.5, duration: 3, cooldown: 30 },
            { text: 'Mundo a 45% por 3,5 s.', scale: 0.45, duration: 3.5, cooldown: 28, req: { level: 10 } },
            { text: 'Mundo a 35% por 4 s.', scale: 0.35, duration: 4, cooldown: 25, req: { boss: 'boss3' } }
        ]
    },
    {
        id: 'summit_form', name: 'Forma do Cume', icon: 'summit', category: 'special', type: 'active',
        desc: 'Muda seu estilo de combate: dashes ilimitados, imunidade a golpes e toque que derrota inimigos.',
        unlock: { level: 11 },
        levels: [
            { text: 'Dura 5 s.', duration: 5, cooldown: 45 },
            { text: 'Dura 6 s, com recarga menor.', duration: 6, cooldown: 40, req: { boss: 'boss3' } },
            { text: 'Dura 7 s, com recarga menor.', duration: 7, cooldown: 35, req: { ach: 'trial_ch3' } }
        ]
    }
];

const BY_ID = new Map(ABILITIES.map(a => [a.id, a]));
export const abilityById = id => BY_ID.get(id);

export function isLevelDone(d, index) {
    return !!d.best[index] || index < d.unlocked - 1;
}

export function meetsReq(req, d) {
    if (!req) return true;
    if (req.start) return true;
    if (req.level) return isLevelDone(d, req.level - 1);
    if (req.boss) return !!d.achievements[req.boss];
    if (req.chapter) return d.completedChapters.includes(req.chapter);
    if (req.ach) return !!d.achievements[req.ach];
    if (req.stomps) return d.stomps >= req.stomps;
    if (req.berries) return d.berries >= req.berries;
    if (req.crystals) return d.crystals >= req.crystals;
    if (req.secrets) return Object.keys(d.secrets).length >= req.secrets;
    return false;
}

const BOSS_NAMES = { boss1: 'Caçador do Pico', boss2: 'Olho da Tempestade', boss3: 'Guardião do Cume' };
const ACH_TEXT = { no_death: 'Conclua uma fase sem morrer', crystal_10: 'Use 10 cristais de dash', trial_ch3: 'Vença uma Provação do Capítulo 3' };

export function reqText(req) {
    if (!req || req.start) return 'Disponível desde o início';
    if (req.level) return `Conclua a fase ${req.level}`;
    if (req.boss) return `Derrote ${BOSS_NAMES[req.boss]}`;
    if (req.chapter) return `Conclua o Capítulo ${req.chapter}`;
    if (req.ach) return ACH_TEXT[req.ach] || 'Obtenha uma conquista';
    if (req.stomps) return `Derrote ${req.stomps} inimigos`;
    if (req.berries) return `Colete ${req.berries} morangos`;
    if (req.crystals) return `Use ${req.crystals} cristais de dash`;
    if (req.secrets) return req.secrets === 1 ? 'Encontre 1 área secreta' : `Encontre ${req.secrets} áreas secretas`;
    return '';
}

export function reqProgress(req, d) {
    if (req.stomps) return [Math.min(d.stomps, req.stomps), req.stomps];
    if (req.berries) return [Math.min(d.berries, req.berries), req.berries];
    if (req.crystals) return [Math.min(d.crystals, req.crystals), req.crystals];
    if (req.secrets) return [Math.min(Object.keys(d.secrets).length, req.secrets), req.secrets];
    return null;
}
