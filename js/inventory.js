import { Save, Settings, keyLabel, roomKey } from './core.js';
import { ABILITIES, LOADOUT_SIZE } from './abilities.js';
import { CHAPTER_NAMES } from './campaign.js';
import { REALMS, realmOfChapter } from './realms.js';
import { icon } from './icons.js';
import { Sfx } from './audio.js';
import { abilityCard, abilityDetail, loadoutSlots } from './abilityUI.js';
import { renderMap } from './mapView.js';

const $ = id => document.getElementById(id);

// Inventário em jogo: abre por cima da fase pausada (Esc, P, Tab ou I) e permite trocar
// habilidades, ver o mapa e mudar som, jogabilidade e controles sem sair para o menu.
export const INV_TABS = [
    { id: 'abilities', label: 'Habilidades', icon: 'spark' },
    { id: 'map', label: 'Mapa', icon: 'map' },
    { id: 'audio', label: 'Som', icon: 'sound' },
    { id: 'gameplay', label: 'Jogabilidade', icon: 'sliders' },
    { id: 'controls', label: 'Controles', icon: 'pad' }
];
const SETTINGS_TABS = new Set(['audio', 'gameplay', 'controls']);

export function createInventory(ctx) {
    const ui = { tab: 'abilities', focus: null };

    const fmt = t => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t - m * 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    function stashSettings() {
        const body = $('settings-body');
        if (body && body.closest('#inv-panel')) $('settings-stash').appendChild(body);
    }

    function restingFlag() {
        const f = ctx.game.atFlag();
        return f ? roomKey(ctx.game.levelIndex, f.x, f.y) : null;
    }

    function renderHeader() {
        const g = ctx.game;
        const level = g.level;
        const realm = realmOfChapter(level.chapter);
        $('pause').dataset.realm = realm;
        $('inv-kicker').textContent = `${REALMS[realm].name} · Capítulo ${level.chapter}: ${CHAPTER_NAMES[level.chapter]}`;
        $('inv-room').textContent = level.name;
        $('inv-info').innerHTML = `<span title="Tempo nesta sala">${icon('clock')} ${fmt(g.time)}</span>
            <span title="Morangos desta sala">${icon('berry', 'red')} ${g.levelBerries}/${g.totalBerries}</span>
            <span title="Mortes nesta sala">${icon('skull')} ${g.levelDeaths}</span>`;
        $('inv-tabs').innerHTML = INV_TABS.map(t => `<button class="${t.id === ui.tab ? 'selected' : ''}" data-act="inv-tab" data-arg="${t.id}" aria-pressed="${t.id === ui.tab}">${icon(t.icon)}<span>${t.label}</span></button>`).join('');
    }

    const PANELS = {
        abilities() {
            const d = Save.data;
            const owned = ABILITIES.filter(a => d.abilities[a.id]);
            if (!ui.focus || !d.abilities[ui.focus]) ui.focus = d.loadout[0] || (owned[0] && owned[0].id) || null;
            const keys = ['skill1', 'skill2', 'skill3'].map(k => keyLabel(Settings.keys[k][0]));
            const locked = ABILITIES.length - owned.length;
            const grid = owned.length
                ? owned.map(a => abilityCard(d, a, { act: 'inv-equip', selected: ui.focus === a.id })).join('')
                : '<p class="empty-note">Nenhuma habilidade desbloqueada ainda.</p>';
            return `<div class="inv-abilities">
                <div class="inv-ab-main">
                    <div class="slots-head"><b>${d.loadout.length}/${LOADOUT_SIZE}</b><span>equipadas · a troca vale na hora</span><em id="inv-msg" role="status"></em></div>
                    <div class="slots">${loadoutSlots(d, { act: 'inv-slot-remove', keys })}</div>
                    <div class="ab-grid" id="inv-grid">${grid}</div>
                    <small class="inv-note">${locked ? `Mais ${locked} ${locked === 1 ? 'habilidade bloqueada' : 'habilidades bloqueadas'}: veja os requisitos na central.` : 'Você desbloqueou todas as habilidades.'}</small>
                </div>
                <aside class="detail" id="inv-detail">${ui.focus ? abilityDetail(d, ui.focus) : ''}</aside>
            </div>`;
        },
        map() {
            const d = Save.data;
            const g = ctx.game;
            const rest = restingFlag();
            const note = rest
                ? `${icon('flag')} Você está num checkpoint: escolha outro no mapa para viajar.`
                : `${icon('lock')} A viagem rápida só funciona descansando num checkpoint.`;
            return `<div class="inv-map">
                ${renderMap(d, { here: { room: g.levelIndex, x: g.player.x, y: g.player.y }, travel: !!rest, restKey: rest, act: 'inv-travel' })}
                <p class="map-legend">${note}</p>
            </div>`;
        },
        settings() {
            return `<div id="inv-settings" class="inv-settings" data-section="${ui.tab}"></div>`;
        }
    };

    function renderPanel() {
        stashSettings();
        const panel = $('inv-panel');
        panel.dataset.tab = ui.tab;
        panel.innerHTML = SETTINGS_TABS.has(ui.tab) ? PANELS.settings() : PANELS[ui.tab]();
        if (SETTINGS_TABS.has(ui.tab)) ctx.mountSettings($('inv-settings'), false);
    }

    function render() {
        renderHeader();
        renderPanel();
    }

    function refocus(selector) {
        const el = selector && document.querySelector(selector);
        if (el) el.focus({ preventScroll: true });
    }

    function message(text) {
        const el = $('inv-msg');
        if (!el) return;
        el.textContent = text;
        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');
    }

    // Troca de habilidades em jogo: salva o loadout e reconstrói as habilidades da fase.
    function applyLoadout(focus) {
        ctx.game.setLoadout(Save.equippedAbilities());
        renderPanel();
        refocus(focus);
    }

    function setTab(tab) {
        if (!INV_TABS.some(t => t.id === tab)) return;
        ui.tab = tab;
        render();
        refocus(`#inv-tabs [data-arg=${tab}]`);
    }

    function cycle(step) {
        const i = INV_TABS.findIndex(t => t.id === ui.tab);
        const next = INV_TABS[(i + step + INV_TABS.length) % INV_TABS.length];
        Sfx.uiMove();
        setTab(next.id);
    }

    function preview(target) {
        const card = target.closest && target.closest('#inv-grid [data-ability]');
        if (!card || card.dataset.ability === ui.focus) return;
        ui.focus = card.dataset.ability;
        document.querySelectorAll('#inv-grid .ab-card').forEach(el => el.classList.toggle('selected', el === card));
        $('inv-detail').innerHTML = abilityDetail(Save.data, ui.focus);
    }
    $('inv-panel').addEventListener('focusin', e => preview(e.target));
    $('inv-panel').addEventListener('mouseover', e => preview(e.target));

    const actions = {
        'inv-tab'(btn) {
            setTab(btn.dataset.arg);
        },
        'inv-equip'(btn) {
            const id = btn.dataset.arg;
            ui.focus = id;
            if (Save.unequip(id)) {
                Sfx.unequip();
                applyLoadout(`#inv-grid [data-arg=${id}]`);
                return;
            }
            const error = Save.equip(id);
            if (error) {
                Sfx.denied();
                renderPanel();
                refocus(`#inv-grid [data-arg=${id}]`);
                message(error);
                return;
            }
            Sfx.equip();
            applyLoadout(`#inv-grid [data-arg=${id}]`);
        },
        'inv-slot-remove'(btn) {
            if (Save.unequip(btn.dataset.arg)) Sfx.unequip();
            applyLoadout('#inv-grid .ab-card');
        },
        'inv-travel'(btn) {
            const flag = Save.data.world.flags[btn.dataset.arg];
            if (!flag) return;
            const rest = restingFlag();
            if (!rest) {
                Sfx.denied();
                ctx.toast('lock', 'Viagem indisponível', 'Descanse em um checkpoint para viajar pelo mapa.');
                return;
            }
            if (rest === btn.dataset.arg) return;
            ctx.travelTo(flag);
        }
    };

    return {
        open(tab = ui.tab) {
            ui.tab = INV_TABS.some(t => t.id === tab) ? tab : 'abilities';
            render();
            ctx.show('pause');
            refocus(`#inv-tabs [data-arg=${ui.tab}]`);
        },
        close: stashSettings,
        cycle,
        actions,
        get tab() { return ui.tab; }
    };
}
