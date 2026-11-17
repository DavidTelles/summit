import { LEVELS } from './levels.js';

// Capítulos e reinos derivados das fases: nenhum outro módulo deve assumir "3 capítulos".
export const CHAPTERS = [...new Set(LEVELS.map(l => l.chapter))];

export const REALMS = {
    montanha: { name: 'A Montanha', chapters: [1, 2, 3] },
    inferno: { name: 'O Inferno', chapters: [4] },
    ceu: { name: 'O Céu', chapters: [5] }
};
export const REALM_IDS = Object.keys(REALMS);

export function realmOfChapter(chapter) {
    return REALM_IDS.find(id => REALMS[id].chapters.includes(chapter)) || 'montanha';
}

export function chapterOfLevel(index) {
    const i = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(index) || 0));
    return LEVELS[i].chapter;
}

export function firstLevelOfChapter(chapter) {
    return LEVELS.findIndex(l => l.chapter === chapter);
}

export function lastLevelOfChapter(chapter) {
    return LEVELS.findLastIndex(l => l.chapter === chapter);
}

export const CHAPTER_STARTS = CHAPTERS.map(firstLevelOfChapter);

export function realmChapters(realm) {
    return REALMS[realm].chapters.filter(ch => CHAPTERS.includes(ch));
}

// Primeira fase de um reino: alcançá-la (unlocked) leva a central para aquele reino.
export function realmEntryLevel(realm) {
    const first = realmChapters(realm)[0];
    return first === undefined ? -1 : firstLevelOfChapter(first);
}

// Reino que a central deve exibir para um progresso: o mais avançado já alcançado.
export function realmForProgress(unlocked) {
    let realm = REALM_IDS[0];
    for (const id of REALM_IDS) {
        const entry = realmEntryLevel(id);
        if (entry >= 0 && unlocked > entry) realm = id;
    }
    return realm;
}
