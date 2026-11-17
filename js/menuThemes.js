// Identidade do menu principal em cada região: o save é um só, mas cada lugar parece outro jogo.
const svg = body => `<svg class="logo-peak" viewBox="0 0 220 44" aria-hidden="true">${body}</svg>`;

export const MENU_THEMES = {
    montanha: {
        title: 'SUMMIT',
        tagline: 'A jornada de Kael até o coração do Cume',
        place: 'A Montanha',
        blurb: 'Neve, tempestade e o silêncio do Núcleo.',
        level: 0, music: 1, wind: 0.03, veil: '#0b1a3a',
        logo: svg('<path d="M2 42 L60 22 L84 30 L110 3 L134 28 L160 19 L218 42" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M110 3 L103 20 L110 16 L117 24" fill="none" stroke="currentColor" stroke-width="1.2"/>')
    },
    inferno: {
        title: 'O FUNDO',
        tagline: 'O que a montanha guardava embaixo ainda está acordado',
        place: 'O Inferno',
        blurb: 'Cinzas, correntes e quem esperava no salão.',
        level: 12, music: 4, wind: 0.07, veil: '#ff4a1a',
        logo: svg('<path d="M2 4 L44 22 L66 12 L110 42 L154 12 L176 22 L218 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M92 4v12M104 4v18M116 4v18M128 4v12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-dasharray="3 2"/>')
    },
    ceu: {
        title: 'O ALÉM',
        tagline: 'Acima das nuvens, ninguém lembra de ter mandado',
        place: 'O Céu',
        blurb: 'Luz sem sombra e olhos demais para contar.',
        level: 15, music: 5, wind: 0.05, veil: '#fff0c8',
        logo: svg('<circle cx="110" cy="22" r="17" fill="none" stroke="currentColor" stroke-width="2"/><path d="M110 15a7 7 0 0 1 0 14a7 7 0 0 1 0-14z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 30 Q40 6 86 20M216 30 Q180 6 134 20M16 38 Q50 22 88 30M204 38 Q170 22 132 30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>')
    }
};
