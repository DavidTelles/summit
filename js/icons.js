const LINES = {
    wave: 'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 2a10 10 0 0 1 10 10M12 22A10 10 0 0 1 2 12',
    lance: 'M3 21 21 3M14 3h7v7M6 13l5 5',
    blade: 'M4 20 17 4l3 1-1 3L5 21zM7 14l3 3',
    parry: 'M12 2l8 3v6c0 5-3.500 8.500-8 11-4.500-2.500-8-6-8-11V5zM8 12l4-4 4 4M12 8v8',
    bubble: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM7 10a5.500 5.500 0 0 1 4-3.500',
    dodge: 'M3 12h6M5 7h7M5 17h7M14 5l7 7-7 7',
    regen: 'M12 21C6 16 3 13 3 8.500 3 6 5 4 7.500 4c1.800 0 3.400 1 4.500 2.700C13.100 5 14.700 4 16.500 4 19 4 21 6 21 8.500 21 13 18 16 12 21zM12 9v7M8.500 12.500h7',
    lastchance: 'M12 21C6 16 3 13 3 8.500 3 6 5 4 7.500 4c1.800 0 3.400 1 4.500 2.700C13.100 5 14.700 4 16.500 4 19 4 21 6 21 8.500 21 13 18 16 12 21zM12.500 7l-2.500 5h4l-2.500 5',
    longdash: 'M2 12h16M13 6l6 6-6 6M2 7h6M2 17h6',
    burst: 'M12 21V8M6 13l6-7 6 7M7 21h10',
    glide: 'M2 11C6 4 18 4 22 11c-3-1-5-1-6.500 0-1.500-1-5.500-1-7 0-1.500-1-3.500-1-6.500 0zM12 11v7M9 22l3-4 3 4',
    link: 'M12 2l4 5-4 5-4-5zM12 12v3M7 22a5 5 0 0 1 10 0',
    heal: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
    wind: 'M3 8h11a3 3 0 1 0-3-3M3 13h16a3 3 0 1 1-3 3M3 18h7a2 2 0 1 1-2 2',
    focus: 'M12 2v4M12 18v4M2 12h4M18 12h4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 12h.01',
    steadfast: 'M12 3v18M6 21h12M5 8h14M5 8l-2 6h4zM19 8l-2 6h4z',
    recall: 'M4 12a8 8 0 1 0 2.500-5.800M4 3v5h5M12 8v4l3 2',
    hourglass: 'M7 2v4c0 3 5 4 5 6s-5 3-5 6v4M17 2v4c0 3-5 4-5 6s5 3 5 6v4M5 2h14M5 22h14',
    summit: 'M2 21 12 3l10 18zM8 14l4-3 4 3',
    scroll: 'M6 3h12v15a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2h12v2M6 3v13M9 7h6M9 11h6',
    home: 'M3 11l9-8 9 8M6 9v12h12V9M10 21v-6h4v6',
    route: 'M2 20 9 7l4 7 2-3 7 9zM9 7V2',
    spark: 'M12 2l2.500 7.500L22 12l-7.500 2.500L12 22l-2.500-7.500L2 12l7.500-2.500z',
    bars: 'M4 21v-8M12 21V4M20 21v-13',
    sliders: 'M4 6h9M18 6h2M4 12h3M12 12h8M4 18h11M20 18h0M15 4v4M9 10v4M17 16v4',
    exit: 'M14 4H5v16h9M10 12h11M17 8l4 4-4 4',
    check: 'M4 13l5 5L20 6',
    close: 'M5 5l14 14M19 5 5 19',
    play: 'M6 3l14 9-14 9z',
    cooldown: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
    bolt2: 'M13 2 5 14h6l-1 8 9-13h-6z'
};

const PATHS = {
    berry: 'M12 7c5 0 7 3 7 6 0 4-4 9-7 9s-7-5-7-9c0-3 2-6 7-6zM12 7c0-2-1-4-3-5 2 0 3 1 3 2 1-1 3-2 5-2-2 1-4 3-5 5z',
    skull: 'M12 2c5 0 9 3.5 9 8.5 0 3-1.5 5-3.5 6.2V20a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-3.3C4.500 15.500 3 13.500 3 10.500 3 5.500 7 2 12 2zM8.500 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    boot: 'M7 2h6v9l6 3c1 .5 2 1.500 2 3v3H4V5a3 3 0 0 1 3-3zM3 21h19v1H3z',
    bolt: 'M14 1 4 14h7l-2 9 11-14h-7z',
    spring: 'M4 3h16v3H4zM4 18h16v3H4zM7 7h10v2H7zM7 11h10v2H7zM7 15h10v2H7z',
    crystal: 'M12 1l7 9-7 13-7-13z',
    shield: 'M12 1l9 4v6c0 6-4 10-9 12-5-2-9-6-9-12V5z',
    clock: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm-1 4v7l6 3 1-2-5-2V6z',
    peak: 'M12 2l10 20H2zM12 7l-3 6 3-1 3 1z',
    flag: 'M5 1h2v22H5zM8 2h13l-3 5 3 5H8z',
    crown: 'M2 7l5 5 5-8 5 8 5-5-2 13H4z',
    trophy: 'M6 2h12v2h4v3c0 3-2 5-5 5.500-.8 1.500-2 2.300-3 2.500v3h4v4H6v-4h4v-3c-1-.2-2.200-1-3-2.500C4 12 2 10 2 7V4h4zm-2 4v1c0 1.500.8 2.500 2 3V6zm16 0h-2v4c1.200-.5 2-1.500 2-3z',
    spike: 'M1 22 6 6l5 16zM8 22l5-20 5 20zM15 22l4-12 4 12z',
    pit: 'M1 8h7v14H1zM16 8h7v14h-7zM9 18h6v4H9zM10 2h4l-2 6z',
    boss: 'M3 2l5 5h8l5-5-1 9c0 6-4 11-8 11S4 17 4 11zM8 11l3 2H8zm8 0v2h-3z',
    star: 'M12 1l3.200 7 7.800.8-5.800 5.200 1.700 7.700L12 18l-6.900 3.700 1.700-7.700L1 8.800 8.800 8z',
    eye: 'M12 5c6 0 10 5 11 7-1 2-5 7-11 7S2 14 1 12c1-2 5-7 11-7zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3h2v12H5V10zm3 0h4V7a2 2 0 0 0-4 0z',
    heart: 'M12 22C5 16 1 12 1 7.500 1 4.500 3.500 2 6.500 2c2.300 0 4.300 1.300 5.500 3.200C13.200 3.300 15.200 2 17.500 2 20.500 2 23 4.500 23 7.500 23 12 19 16 12 22z'
};

export function icon(name, cls = '') {
    if (LINES[name]) return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round" d="${LINES[name]}"/></svg>`;
    return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${PATHS[name] || PATHS.star}"/></svg>`;
}
