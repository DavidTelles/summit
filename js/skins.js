export const SKINS = [
    {
        id: 'original', name: 'Original', chapter: 0,
        note: 'Como chegou à montanha.',
        swatch: ['#f2f2f2', '#ff79ba']
    },
    {
        id: 'geada', name: 'Geada', chapter: 1,
        note: 'Pelagem de neve e o cachecol do acampamento.',
        fur: 0xd3e4f3, pads: 0x6fb4ee, blush: 0x3f7fc8, scarf: 0xb3312b,
        swatch: ['#d3e4f3', '#b3312b']
    },
    {
        id: 'eter', name: 'Éter', chapter: 2,
        note: 'Marcas de tempestade que brilham com o Éter.',
        fur: 0x3c4560, pads: 0x7fe3ff, padGlow: 0x1f8fc0, blush: 0x7fe3ff, eyes: 0xe8f6ff,
        marks: { type: 1, color: 0x7fe3ff, glow: 1.2 },
        swatch: ['#3c4560', '#7fe3ff']
    },
    {
        id: 'brasa', name: 'Brasa', chapter: 3,
        note: 'Fissuras do Núcleo ardendo sob a pelagem.',
        fur: 0x2e2626, pads: 0xff8a3a, padGlow: 0xc8400f, blush: 0xff6a2a, eyes: 0xffd9a0,
        marks: { type: 2, color: 0xff7a2a, glow: 1.8 },
        swatch: ['#2e2626', '#ff7a2a']
    }
];

export const DEFAULT_SKIN = 'original';

export function skinById(id) {
    return SKINS.find(s => s.id === id) || null;
}

export function skinForChapter(chapter) {
    return SKINS.find(s => s.chapter === chapter) || null;
}
