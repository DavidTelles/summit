import { Save } from './core.js';
import { CATEGORIES, LOADOUT_SIZE, TYPE_LABEL, abilityById, meetsReq, reqProgress, reqText } from './abilities.js';
import { icon } from './icons.js';

// Peças de interface das habilidades, usadas pela central e pelo inventário em jogo.
export const pips = (level, max) => `<span class="pips" aria-label="Nível ${level} de ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('')}</span>`;
const seconds = v => `${String(v).replace('.', ',')} s`;

export function abilityFacts(a, stats) {
    const list = [`<span>${icon(a.type === 'passive' ? 'spark' : 'bolt2')} ${TYPE_LABEL[a.type]}</span>`];
    if (stats.cooldown) list.push(`<span>${icon('cooldown')} Recarga ${seconds(stats.cooldown)}</span>`);
    if (stats.duration) list.push(`<span>${icon('clock')} Dura ${seconds(stats.duration)}</span>`);
    if (stats.cost) list.push(`<span>${icon('wind')} Custa ${stats.cost} de fôlego</span>`);
    return `<div class="ab-facts">${list.join('')}</div>`;
}

export function reqLine(req, d) {
    const ok = meetsReq(req, d);
    const progress = !ok && reqProgress(req, d);
    return `<div class="req ${ok ? 'ok' : ''}">${icon(ok ? 'check' : 'lock')}<span>${reqText(req)}${progress ? ` <b>${progress[0]}/${progress[1]}</b>` : ''}</span></div>`;
}

// Os 3 espaços do loadout. `act`: ação do botão de remover.
export function loadoutSlots(d, { removable = true, act = 'slot-remove', keys = null } = {}) {
    const cells = [];
    for (let i = 0; i < LOADOUT_SIZE; i++) {
        const a = abilityById(d.loadout[i]);
        const key = keys ? `<kbd class="slot-key">${keys[i]}</kbd>` : '';
        if (a) {
            cells.push(`<button class="slot filled cat-${a.category}" data-act="${act}" data-arg="${a.id}" title="Remover ${a.name}" ${removable ? '' : 'tabindex="-1"'}>
                ${key}<span class="slot-ic">${icon(a.icon)}</span><span class="slot-name">${a.name}</span>${removable ? `<span class="slot-x">${icon('close')}</span>` : ''}</button>`);
        } else {
            cells.push(`<div class="slot empty">${key}<span class="slot-ic">${i + 1}</span><span class="slot-name">Espaço livre</span></div>`);
        }
    }
    return cells.join('');
}

export function abilityCard(d, a, { act, selected = false }) {
    const level = d.abilities[a.id];
    const equipped = d.loadout.includes(a.id);
    const ready = level && Save.canUpgrade(a.id);
    const state = !level ? 'locked' : equipped ? 'equipped' : 'open';
    return `<button class="ab-card ${state} ${selected ? 'selected' : ''} cat-${a.category}" data-act="${act}" data-arg="${a.id}" data-ability="${a.id}" aria-pressed="${equipped}">
        <span class="ab-ic">${icon(level ? a.icon : 'lock')}</span>
        <span class="ab-text"><b>${a.name}</b><small>${level ? `Nível ${level}` : 'Bloqueada'}${ready ? ' · pode evoluir' : ''}</small></span>
        ${equipped ? `<span class="ab-mark">${icon('check')}</span>` : ''}
    </button>`;
}

// Detalhe de uma habilidade. upgrade: mostra o botão de evoluir; toggle: botão de equipar/remover.
export function abilityDetail(d, id, { upgrade = false, toggle = false } = {}) {
    const a = abilityById(id);
    if (!a) return '';
    const category = CATEGORIES.find(c => c.id === a.category);
    const level = d.abilities[a.id] || 0;
    const stats = a.levels[Math.max(0, level - 1)];
    const next = level ? a.levels[level] : null;
    const equipped = d.loadout.includes(a.id);
    const head = `<div class="detail-head cat-${a.category}">
        <span class="detail-ic">${icon(level ? a.icon : 'lock')}</span>
        <div><small>${category.name}</small><h3>${a.name}</h3>${pips(level, a.levels.length)}</div>
    </div>`;
    const body = `<p class="detail-desc">${a.desc}</p>${abilityFacts(a, stats)}`;
    if (!level) {
        return `${head}${body}<div class="detail-block"><small>Como desbloquear</small>${reqLine(a.unlock, d)}</div>
            <div class="detail-block"><small>Efeito inicial</small><p>${a.levels[0].text}</p></div>`;
    }
    const nextBlock = next ? `<div class="detail-block upgrade">
            <small>Próximo nível: ${level + 1}</small><p>${next.text}</p>${reqLine(next.req, d)}
            ${upgrade ? `<button class="btn ${Save.canUpgrade(a.id) ? 'btn-primary' : ''}" data-act="ability-upgrade" data-arg="${a.id}" ${Save.canUpgrade(a.id) ? '' : 'disabled'}>${icon('spark')} Evoluir para nível ${level + 1}</button>` : ''}
        </div>` : '<div class="detail-block"><small>Evolução</small><p>Nível máximo alcançado.</p></div>';
    const toggleBtn = toggle
        ? `<button class="btn" data-act="ability-toggle" data-arg="${a.id}">${icon(equipped ? 'close' : 'check')} ${equipped ? 'Remover' : 'Equipar'}</button>`
        : '';
    return `${head}${body}<div class="detail-block"><small>Nível atual: ${level}</small><p>${stats.text}</p></div>${nextBlock}${toggleBtn}`;
}
