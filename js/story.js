export const RECORD_KINDS = { oath: 'Sentinelas', city: 'Cidade perdida', ether: 'Estudos do Éter', varak: 'Varak', aethos: 'Aethos', expedition: 'Última expedição', core: 'O Núcleo' };

export const RECORDS = [
    { id: 'sentinel_oath', level: 0, chapter: 1, kind: 'oath', at: [72.5, 2.7], title: 'Juramento das sentinelas', source: 'Gravado no poste da guarda', text: 'Guardaremos a base até o Éter voltar. Quem sobe não volta, e ainda assim alguém subirá. Até lá, vigiamos a luz que não acende.' },
    { id: 'harvest_tablet', level: 1, chapter: 1, kind: 'city', at: [48.5, 9.6], title: 'Tábua da colheita', source: 'Cidade Antiga, mercado alto', text: 'Um cristal pequeno ergue uma pedra de casa. Um grande fecha uma ferida em uma noite. Colha só o que a encosta oferece. Abaixo desta linha, alguém riscou: "a encosta oferece o que pedirmos".' },
    { id: 'last_market', level: 1, chapter: 1, kind: 'city', at: [84.5, 6.6], title: 'Último dia de feira', source: 'Bilhete sob uma balança', text: 'Os cristais apagaram antes do meio-dia. As pedras caíram das ruas altas. Meu pai foi buscar água e não havia mais o que a erguesse. Vamos descer. Volto para buscar o resto depois.' },
    { id: 'crystal_chamber', level: 2, chapter: 1, kind: 'ether', at: [56.5, 5.6], title: 'Câmara nove', source: 'Notas de um mestre de obras', text: 'Abrimos a câmara nove e ouvimos um pulso vindo de baixo. Não é a água nem o vento. Quando colhemos demais, ele acelera. Registrei isso duas vezes e me mandaram seguir cavando.' },
    { id: 'storm_names', level: 3, chapter: 1, kind: 'city', at: [44, 17.6], title: 'Os nomes das tempestades', source: 'Friso do Templo do Vento', text: 'Damos nome às tempestades para que nos escutem. Cada corrente levada aos cristais recebe uma oração e uma medida. A maior de todas não tem nome: nunca conseguimos medi-la.' },
    { id: 'varak_champion', level: 3, chapter: 1, kind: 'varak', at: [67.5, 14.6], title: 'O campeão Varak', source: 'Fragmento do templo', text: 'A Varak, o mais forte de sua geração, que subiu o primeiro cume sem cristal e sem corda. Que ele guarde o alto enquanto a cidade dorme. A pedra está lascada: alguém tentou apagar o nome e desistiu.' },
    { id: 'varak_refusal', level: 4, chapter: 1, kind: 'varak', at: [113.5, 33.5], title: 'Eu fico', source: 'Riscado na rocha, à altura de um homem sentado', text: 'Desceram todos. Eu fico. O Éter vai voltar e alguém precisa estar aqui. Os dias são iguais. Esqueci o nome da minha irmã, depois lembrei. A pedra está quente. Não dói.' },
    { id: 'expedition_day_one', level: 5, chapter: 2, kind: 'expedition', at: [136.5, 2.6], title: 'Expedição: primeiro diário', source: 'Mochila deixada em um abrigo', text: 'Somos onze, cinquenta anos depois da última tentativa de que a vila se lembra. Passamos o primeiro cume em silêncio: a fera nos deixou passar porque estava de costas. Ninguém comentou o que ela fazia. Parecia estar sentada.' },
    { id: 'expedition_day_two', level: 6, chapter: 2, kind: 'expedition', at: [135.5, 20.6], title: 'Expedição: segundo diário', source: 'Páginas soltas entre as ruínas', text: 'Os raios caem antes de chegarmos a cada ponte. Dois caíram hoje. Só restam quatro, e nenhum raio atingiu quem estava parado. Ele não ataca o que fica. Ataca o que sobe.' },
    { id: 'aethos_forecast', level: 6, chapter: 2, kind: 'aethos', at: [45.5, 31.5], title: 'Previsão 412', source: 'Observatório, arquivo do astrônomo-chefe', text: 'Ao Conselho. Os padrões do Éter caem em um só sentido. Se a colheita não for reduzida, os cristais falharão em menos de uma geração. Anexo os cálculos. Resposta do Conselho, à margem: "Arquive-se".' },
    { id: 'aethos_unheard', level: 7, chapter: 2, kind: 'aethos', at: [14.5, 24.6], title: 'Previsão 413', source: 'Observatório, arquivo do astrônomo-chefe', text: 'Hoje os cristais apagaram, na hora que previ. Ninguém veio me perguntar nada. Fico aqui até encontrar a causa. Daqui de cima consigo ver a montanha inteira. Cada vez mais, consigo ver dela o que antes não via.' },
    { id: 'aethos_map', level: 8, chapter: 2, kind: 'aethos', at: [56, 11.5], title: 'Mapa sem mãos', source: 'Placa de observação', text: 'A letra muda no meio da placa, até deixar de ser letra. Ainda dá para ler: "O equilíbrio é frágil. Cada passo na encosta pesa. Não subam. Não é ódio. Eu só sei quanto custa."' },
    { id: 'council_quota', level: 9, chapter: 3, kind: 'core', at: [135.5, 20.6], title: 'Ata da cota', source: 'Câmara de máquinas, placa de ferro', text: 'Fica aprovada a escavação direta do veio central, triplicando a cota. Objeção do astrônomo registrada e descartada. Os ruídos relatados pelos mineiros não têm relação com a obra.' },
    { id: 'miner_note', level: 9, chapter: 3, kind: 'core', at: [66.5, 21.6], title: 'Turno da noite', source: 'Marcado a giz em uma viga', text: 'As máquinas continuam ligadas e não há mais ninguém. Quando paramos uma, ela volta. A rocha cresceu sobre a broca. Isso não é desabamento. Parece um dedo fechando uma ferida.' },
    { id: 'first_inscription', level: 10, chapter: 3, kind: 'core', at: [42.5, 96], title: 'A primeira inscrição', source: 'Provação, em escrita anterior à cidade', text: 'Nós o fizemos para que a terra e o alto não se devorem. Ele não vive e não morre. Ele mede. Se o tirarem demais, ele fechará a porta e não ouvirá pedidos. Só responderá a quem chegar sem pedir nada.' },
    { id: 'seal_order', level: 10, chapter: 3, kind: 'core', at: [33.5, 60.5], title: 'Marcas de contenção', source: 'Parede da galeria', text: 'Cada veio foi fechado de dentro para fora, em ordem, ao mesmo tempo, em toda a montanha. Nenhum desastre faz isso. Em volta da cidade, as marcas formam um anel perfeito.' },
    { id: 'guardian_function', level: 11, chapter: 3, kind: 'core', at: [52.5, 6.6], title: 'O que eles são', source: 'Provação do Cume Eterno', text: 'Varak ficou para guardar. Aethos ficou para entender. Ele usou o que restava deles como usa a pedra e o raio. Os Guardiões não são punição. São a porta. Não há ódio em uma porta.' },
    { id: 'empty_camp', level: 11, chapter: 3, kind: 'oath', at: [38.5, 28.5], title: 'Sem assinatura', source: 'Bilhete preso a uma corda', text: 'Se você leu até aqui, é da vila, e a vila ainda espera. Espero que tenham parado de esperar. Não subi para trazer nada de volta. Queria só saber por que ninguém perguntou.' },
    { id: 'prophecy', level: 3, chapter: 1, kind: 'city', auto: true, title: 'Profecia do Templo', source: 'Paredes do Templo do Vento', text: 'Quando o Guardião despertar, o Cume se fechará para sempre. Apenas aquele que chegar ao Núcleo antes do amanhecer do terceiro dia poderá silenciar a tempestade.' },
    { id: 'expedition_last', level: 6, chapter: 2, kind: 'expedition', auto: true, title: 'Expedição: última página', source: 'Diário encontrado nas ruínas suspensas', text: 'Ele vê tudo.' },
    { id: 'aethos_notebook', level: 8, chapter: 2, kind: 'aethos', auto: true, title: 'Caderno do Observador', source: 'Observatório do Pico da Tormenta', text: 'Mil e duzentas previsões, todas certas, nenhuma lida. A última entrada é de outra mão, ou de nenhuma: "Identifiquei a causa. A causa somos nós. Vou manter o equilíbrio até que entendam".' },
    { id: 'quarantine', level: 10, chapter: 3, kind: 'core', auto: true, title: 'Quarentena', source: 'Galerias do Núcleo', text: 'A cidade não foi destruída por acidente. O Núcleo, criado para guardar o equilíbrio, fechou o fluxo de Éter e acordou os Guardiões para manter os humanos longe. Foi isolada. Uma quarentena.' }
];

const byId = new Map(RECORDS.map(r => [r.id, r]));
export const recordById = id => byId.get(id);
export const TOTAL_RECORDS = RECORDS.length;

export const LEVEL_STORY = [
    {
        decor: [['tent', 8, 2], ['post', 5.5, 2], ['relic', 3.5, 2], ['post', 12, 2], ['tent', 16, 2], ['post', 27, 2], ['statue', 74, 2]],
        moments: [
            { id: 'relic', x1: 2, x2: 7, line: 'Décadas apagado. E acende justo hoje.' },
            { id: 'leave', x1: 24, x2: 28, line: 'Ninguém vai notar até o amanhecer.' }
        ]
    },
    {
        decor: [['house', 7, 2], ['column', 11, 2], ['deadCrystal', 19.5, 2], ['statue', 30, 2], ['house', 36, 2], ['deadCrystal', 48, 2], ['column', 55, 2], ['house', 75, 2], ['statue', 83, 2], ['deadCrystal', 90, 2]],
        moments: [{ id: 'stories', x1: 29, x2: 33, line: 'As histórias não exageravam.' }]
    },
    {
        decor: [['liveCrystal', 6, 2], ['deadCrystal', 12, 2], ['liveCrystal', 27, 2], ['machine', 36, 2], ['liveCrystal', 44, 2], ['liveCrystal', 50, 2], ['deadCrystal', 56, 2]],
        moments: [
            { id: 'pulse', x1: 26, x2: 30, line: 'Ainda pulsam. Fraco.' },
            { id: 'drain', x1: 47, x2: 52, line: 'Não estão morrendo. Algo os drena por dentro.' }
        ]
    },
    {
        decor: [['windFrame', 5, 2], ['column', 54, 14], ['windFrame', 58, 14], ['tablet', 62, 14], ['statue', 67, 14], ['windFrame', 102, 22], ['column', 106, 22]],
        moments: [{ id: 'prophecy', x1: 60, x2: 65, y1: 12, y2: 24, line: 'Quando o Guardião despertar, o Cume se fechará para sempre.', who: 'Inscrição', record: 'prophecy', then: 'Três dias, então.' }]
    },
    {
        decor: [['column', 6, 2], ['statue', 84, 22], ['circle', 114, 30], ['sword', 118, 30], ['scar', 110, 30], ['deadCrystal', 94, 22]],
        moments: [{ id: 'varak_seat', x1: 113, x2: 117, y1: 29, y2: 40, line: 'Alguém ficou aqui. Por muito tempo.' }]
    },
    {
        decor: [['column', 6, 2], ['floatRuin', 34, 16], ['gear', 58, 18], ['floatRuin', 68, 24], ['rod', 96, 16], ['column', 118, 2], ['gear', 133, 2]],
        moments: [{ id: 'not_weather', x1: 25, x2: 30, line: 'Isso não é clima. Algo está puxando estes raios.' }]
    },
    {
        decor: [['column', 19, 16], ['house', 42, 27], ['statue', 56, 27], ['gear', 86, 25], ['floatRuin', 99, 34], ['rod', 121, 20], ['gear', 133, 20]],
        moments: [{ id: 'diary', x1: 83, x2: 89, y1: 24, y2: 34, line: 'Ele vê tudo.', who: 'Última página de um diário', record: 'expedition_last' }]
    },
    {
        decor: [['rod', 8, 50], ['column', 34, 24], ['floatRuin', 22, 54], ['gear', 66, 48], ['rod', 96, 46], ['scopeBase', 113, 52]],
        moments: [{ id: 'feeding', x1: 60, x2: 66, y1: 46, y2: 58, line: 'Os raios descem para dentro da montanha. Ela está se alimentando.' }]
    },
    {
        decor: [['rod', 5, 2], ['scopeBase', 50, 6], ['tablet', 54, 6], ['deadCrystal', 60, 6], ['rod', 47, 6]],
        moments: [{ id: 'observatory', x1: 49, x2: 56, y1: 6, y2: 18, line: 'Mil previsões certas. Ninguém leu.', record: 'aethos_notebook' }]
    },
    {
        decor: [['machine', 6, 2], ['ironRig', 41, 2], ['ironRig', 47, 2], ['machine', 74, 22], ['seal', 80, 22], ['ironRig', 105, 20], ['machine', 118, 20]],
        moments: [
            { id: 'machines', x1: 38, x2: 43, line: 'Não é cidade. São máquinas de extrair.' },
            { id: 'extraction', x1: 104, x2: 109, y1: 20, y2: 30, line: 'Tiravam mais do que a terra podia dar.' }
        ]
    },
    {
        decor: [['seal', 8, 2], ['ironRig', 20, 10], ['seal', 42, 11], ['machine', 12, 27], ['seal', 28, 57], ['ironRig', 50, 87]],
        moments: [{ id: 'quarantine', x1: 26, x2: 37, y1: 56, y2: 64, line: 'Não foi acidente. Foi uma quarentena.', record: 'quarantine' }]
    },
    {
        decor: [['seal', 4, 2], ['seal', 44, 19], ['ironRig', 76, 20], ['seal', 81, 20]],
        moments: [
            { id: 'knows', x1: 42, x2: 47, y1: 18, y2: 30, line: 'Ela sabe que estou aqui.', shake: 0.7, dim: 0.75 },
            { id: 'not_rekindle', x1: 75, x2: 80, y1: 19, y2: 30, line: 'Não vim reacender os cristais. Vim conversar.', shake: 1, dim: 0.6 }
        ]
    }
];

export const CHAPTER_THREAD = {
    1: 'O cristal do acampamento acendeu depois de décadas. Descubra por quê.',
    2: 'A tempestade tem origem. Algo no centro da montanha se alimenta dela.',
    3: 'Você não veio buscar uma energia perdida. Chegue ao Núcleo.'
};

export const SCENE_INFO = {
    intro: { title: 'A partida', chapter: 1 },
    ch1to2: { title: 'Acima do primeiro cume', chapter: 1 },
    ch2to3: { title: 'Para dentro', chapter: 2 },
    final: { title: 'O silêncio', chapter: 3 }
};

export const SCENE_AFTER_LEVEL = { 4: 'ch1to2', 8: 'ch2to3', 11: 'final' };

const LAST_LEVEL_OF = { ch1to2: 4, ch2to3: 8, final: 11 };

export function sceneEarned(d, id) {
    return id === 'intro' || !!d.best[LAST_LEVEL_OF[id]];
}

export function sanitizeStory(raw, data, version) {
    const pick = (value, valid) => {
        const out = {};
        if (value && typeof value === 'object') Object.keys(value).forEach(k => { if (valid(k) && value[k] === true) out[k] = true; });
        return out;
    };
    const src = raw && typeof raw === 'object' ? raw : {};
    const story = {
        records: pick(src.records, k => byId.has(k)),
        moments: pick(src.moments, () => true),
        scenes: pick(src.scenes, k => !!SCENE_INFO[k])
    };
    for (const r of RECORDS) if (r.auto && data.best[r.level]) story.records[r.id] = true;
    if (version < 4) {
        for (const id of Object.keys(SCENE_INFO)) if (sceneEarned(data, id) && (id !== 'intro' || data.unlocked > 1 || data.totalTime > 0)) story.scenes[id] = true;
    }
    return story;
}

export function pendingScene(d) {
    return ['intro', 'ch1to2', 'ch2to3', 'final'].find(id => !d.story.scenes[id] && sceneEarned(d, id)) || null;
}

export function recordsFound(d) {
    return Object.keys(d.story.records).length;
}
