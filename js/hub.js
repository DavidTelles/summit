import { CHAPTER_THREAD, RECORDS, RECORD_KINDS, SCENE_INFO, TOTAL_RECORDS, recordById, recordsFound } from './story.js';
import { LEVELS } from './levels.js';
import { ACHIEVEMENTS, Save, SKILLS, achievementProgress, maxedAbilityCount } from './core.js';
import { ABILITIES, CATEGORIES, LOADOUT_SIZE, abilityById } from './abilities.js';
import {
    BOSSES, CHAPTER_NAMES, TOTAL_BERRIES, TOTAL_SECRETS, campaignProgress,
    continueLevel, continueRoom, defeatedBosses, exploration, levelFacts, levelStatus
} from './campaign.js';
import { icon } from './icons.js';
import { Sfx } from './audio.js';
import { ACHIEVEMENT_GROUPS } from './achievements.js';
import { abilityCard as card, abilityDetail as detail, loadoutSlots as slots } from './abilityUI.js';
import { mapSummary, renderMap, travelPoints } from './mapView.js';
import { ROOMS } from './worldMap.js';
import { CHAPTERS, REALMS, realmChapters, realmOfChapter } from './realms.js';

const $ = id => document.getElementById(id);
// Rótulos da trilha da central em cada reino: na montanha e no Céu se sobe, no Inferno se desce.
const TRAIL = {
    montanha: { from: 'Base', to: 'Cume', finished: 'A montanha está em silêncio. O que resta é explorar o que ficou.' },
    inferno: { from: 'Portões', to: 'Trono', finished: 'O Fundo está em silêncio. Acima, o Alto continua olhando.' },
    ceu: { from: 'Limiar', to: 'Trono', finished: 'Ninguém responde lá de cima. Agora o caminho é seu, em qualquer direção.' }
};
const TABS = [
    { id: 'home', label: 'Início', icon: 'home' },
    { id: 'map', label: 'Mapa', icon: 'map' },
    { id: 'abilities', label: 'Habilidades', icon: 'spark' },
    { id: 'records', label: 'Registros', icon: 'scroll' },
    { id: 'achievements', label: 'Conquistas', icon: 'trophy' },
    { id: 'stats', label: 'Estatísticas', icon: 'bars' },
    { id: 'settings', label: 'Configurações', icon: 'sliders' }
];
const STATUS = {
    done: { label: 'Concluída', icon: 'check' },
    open: { label: 'Disponível', icon: 'play' },
    locked: { label: 'Bloqueada', icon: 'lock' }
};

export const fmtTime = t => {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return String(m).padStart(2, '0') + ':' + s.toFixed(1).padStart(4, '0');
};

export const fmtLong = t => {
    const total = Math.floor(t);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h ? `${h}h ${String(m).padStart(2, '0')}min` : `${m}min ${String(s).padStart(2, '0')}s`;
};

const modeTag = d => `<span class="tag ${d.mode === 'permadeath' ? 'tag-danger' : ''}">${d.mode === 'permadeath' ? `${icon('skull')} Morte Súbita` : 'Normal'}</span>`;
const meter = (pct, cls = '') => `<div class="meter ${cls}"><i style="width:${Math.min(100, pct)}%"></i></div>`;

const BOSS_LORE_RECORDS = { boss1: ['varak_champion', 'varak_refusal'], boss2: ['aethos_notebook'], mentor: ['oren_lesson', 'oren_diary'] };
const knowsBossName = (d, id) => (BOSS_LORE_RECORDS[id] || []).some(r => d.story.records[r]);

// Altura de cada fase na trilha da montanha (desenho original, que sobe até o cume).
const MOUNTAIN_LIFT = [0, 3, 1, 7, 13, 9, 14, 10, 22, 19, 27, 36];

function profileSvg(d) {
    const W = 1000;
    const H = 76;
    const chapters = realmChapters(d.realm);
    const indices = LEVELS.map((l, i) => i).filter(i => chapters.includes(LEVELS[i].chapter));
    const n = Math.max(1, indices.length - 1);
    const descending = d.realm === 'inferno';
    const points = indices.map((i, k) => {
        const x = 24 + (k * (W - 48)) / n;
        const rise = descending ? (k / n) * 54 + (k % 2) * 4 : (k / n) * 18 + (MOUNTAIN_LIFT[k] || 0);
        const y = descending ? 12 + rise : H - 12 - rise;
        return { x, y, status: levelStatus(d, i), i };
    });
    const line = list => list.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
    const reached = points.filter(p => p.status !== 'locked');
    const current = continueLevel(d);
    const nodes = points.map(p => {
        const size = p.i === current ? 7 : levelFacts(p.i).boss ? 6 : 4;
        return `<rect class="node ${p.status} ${p.i === current ? 'current' : ''}" x="${p.x - size}" y="${p.y - size}" width="${size * 2}" height="${size * 2}" transform="rotate(45 ${p.x} ${p.y})"><title>Fase ${p.i + 1}: ${LEVELS[p.i].name} (${STATUS[p.status].label})</title></rect>`;
    }).join('');
    return `<svg class="profile" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Trilha da campanha: ${reached.length} de ${points.length} fases alcançadas">
        <path class="profile-fill" d="${line(points)}L${W - 24} ${H}L24 ${H}Z"/>
        <path class="profile-line" d="${line(points)}"/>
        <path class="profile-done" d="${line(reached)}"/>
        ${nodes}
    </svg>`;
}

export function createHub(ctx) {
    const ui = { tab: 'home', filter: 'all', ability: 'shockwave', hero: null, heroTried: false };

    const loadoutSlots = removable => slots(Save.data, { removable });
    const abilityCard = (a, act) => card(Save.data, a, { act, selected: ui.ability === a.id });
    const abilityDetail = (id, withUpgrade) => detail(Save.data, id, { upgrade: withUpgrade, toggle: withUpgrade });

    const PANELS = {
        home() {
            const d = Save.data;
            const index = continueLevel(d);
            const f = levelFacts(index);
            const progress = campaignProgress(d);
            const point = continueRoom(d);
            const resume = point.resume;
            const started = d.totalTime > 0 || d.unlocked > 1 || !!resume;
            const unlocked = Object.keys(d.abilities).length;
            const upgrades = ABILITIES.filter(a => d.abilities[a.id] && Save.canUpgrade(a.id)).length;
            const achieved = Object.keys(d.achievements).length;
            const explored = exploration(d);
            const finished = progress.done === progress.total;
            return `<div class="home">
                <div class="home-left">
                    <small class="kicker">Kael · Capítulo ${f.chapter}</small>
                    <h1 class="home-title">${CHAPTER_NAMES[f.chapter]}</h1>
                    <p class="home-thread">${finished ? TRAIL[d.realm].finished : CHAPTER_THREAD[f.chapter]}</p>
                    <div class="home-progress"><b>${progress.pct}%</b><span>da campanha · ${progress.done} de ${progress.total} fases</span>${meter(progress.pct)}</div>
                    <button class="btn btn-primary btn-hero" data-act="hub-continue" id="btn-continue">
                        ${icon('play')}<span><b>${started ? 'Continuar' : 'Começar jornada'}</b><small>${ROOMS[point.room].name}${resume ? ' · último checkpoint' : ''}</small></span>
                    </button>
                    <div class="home-loadout">
                        <small class="kicker-soft">Habilidades equipadas · troque a qualquer momento no inventário (Tab)</small>
                        <div class="mini-slots">${[0, 1, 2].map(i => {
                            const a = abilityById(d.loadout[i]);
                            return a ? `<span class="mini-slot cat-${a.category}" title="${a.name}">${icon(a.icon)}</span>` : '<span class="mini-slot empty"></span>';
                        }).join('')}</div>
                    </div>
                </div>
                <div class="home-hero"><div id="hero-slot"></div><span class="showcase-hint">Clique duas vezes para trocar a skin</span></div>
                <div class="home-right">
                    <button class="shortcut" data-act="hub-tab" data-arg="abilities">${icon('spark')}<span><b>${unlocked}<i>/${ABILITIES.length}</i></b><small>Habilidades${upgrades ? ` · ${upgrades} para evoluir` : ''}</small></span></button>
                    <button class="shortcut" data-act="hub-tab" data-arg="achievements">${icon('trophy')}<span><b>${achieved}<i>/${ACHIEVEMENTS.length}</i></b><small>Conquistas</small></span></button>
                    <button class="shortcut" data-act="hub-tab" data-arg="stats">${icon('eye')}<span><b>${explored.pct}<i>%</i></b><small>Exploração</small></span></button>
                    <div class="home-facts">
                        <span>${icon('clock')} ${fmtLong(d.totalTime)}</span>
                        <span>${icon('skull')} ${d.deaths} ${d.deaths === 1 ? 'morte' : 'mortes'}</span>
                    </div>
                </div>
                <div class="home-trail">
                    <div class="trail-labels"><span>${TRAIL[d.realm].from}</span><span>${REALMS[d.realm].name} · última fase alcançada: <b>${d.unlocked}. ${LEVELS[d.unlocked - 1].name}</b></span><span>${TRAIL[d.realm].to}</span></div>
                    ${profileSvg(d)}
                </div>
            </div>`;
        },
        map() {
            const d = Save.data;
            const cp = d.checkpoint;
            const here = cp ? { room: cp.level, x: cp.x, y: cp.y } : null;
            const points = travelPoints(d);
            const cpKey = cp ? `${cp.level}:${cp.x},${cp.y}` : null;
            const list = points.length
                ? points.map(p => `<button class="travel-row realm-${p.realm} ${p.key === cpKey ? 'here' : ''}" data-act="map-travel" data-arg="${p.key}">${icon('flag')}<span><b>${p.name}</b><small>${p.key === cpKey ? 'Último save' : 'Viajar para cá'}</small></span></button>`).join('')
                : '<p class="empty-note">Toque nas bandeiras pelo caminho: cada uma salva o jogo e vira um ponto de viagem.</p>';
            const realms = mapSummary(d).map(r => `<span class="map-realm realm-${r.id}"><b>${r.seen}<i>/${r.total}</i></b><small>${r.name}</small></span>`).join('');
            return `<div class="map-layout">
                <div class="map-main">
                    <div class="map-head"><span>Salas exploradas</span><div class="map-realms">${realms}</div></div>
                    ${renderMap(d, { here, travel: true, restKey: null })}
                    <p class="map-legend">${icon('flag')} checkpoint (clique para viajar) · ${icon('boss')} guardião · ${icon('check')} guardião derrotado · contorno tracejado: área ainda não explorada</p>
                </div>
                <aside class="travel-list"><small class="kicker-soft">Viagem rápida</small>${list}</aside>
            </div>`;
        },
        abilities() {
            const d = Save.data;
            const list = ui.filter === 'all' ? ABILITIES : ABILITIES.filter(a => a.category === ui.filter);
            const filters = [{ id: 'all', name: 'Todas', icon: 'spark' }, ...CATEGORIES].map(c =>
                `<button class="chip ${ui.filter === c.id ? 'selected' : ''}" data-act="ability-filter" data-arg="${c.id}" aria-pressed="${ui.filter === c.id}">${icon(c.icon)} ${c.name}</button>`).join('');
            const base = SKILLS.map(s => {
                const on = d.skills.includes(s.id);
                return `<span class="base-move ${on ? '' : 'locked'}" title="${s.desc}">${icon(on ? s.icon : 'lock')} ${s.name}${on ? '' : ` <small>${s.unlock}</small>`}</span>`;
            }).join('');
            return `<div class="abilities">
                <div class="abilities-main">
                    <div class="equipped-row"><span class="slots-count"><b>${d.loadout.length}/${LOADOUT_SIZE}</b> equipadas · também dá para trocar durante o jogo (Tab)</span><div class="slots">${loadoutSlots(true)}</div></div>
                    <div class="chips">${filters}</div>
                    <div class="ab-grid">${list.map(a => abilityCard(a, 'ability-pick')).join('')}</div>
                    <div class="base-moves"><small class="kicker-soft">Movimentos base: sempre ativos, não ocupam espaço</small><div>${base}</div></div>
                </div>
                <aside class="detail" id="ability-detail">${abilityDetail(ui.ability, true)}</aside>
            </div>`;
        },
        achievements() {
            const d = Save.data;
            const done = ACHIEVEMENTS.filter(a => d.achievements[a.id]).length;
            const card = a => {
                const ok = d.achievements[a.id];
                const hidden = !ok && a.secret;
                const progress = !ok && achievementProgress(a.id, d);
                return `<div class="ach-card ${ok ? 'done' : ''}">
                    <span class="ach-ic">${icon(ok ? a.icon : hidden ? 'eye' : 'lock')}</span>
                    <span class="ach-text"><b>${hidden ? 'Conquista secreta' : a.name}</b><small>${hidden ? 'Continue explorando para revelar.' : a.desc}</small>
                    ${progress ? `<span class="ach-progress">${meter((progress[0] / progress[1]) * 100)}<em>${progress[0]}/${progress[1]}</em></span>` : ''}</span>
                    ${ok ? `<span class="ach-done" title="Obtida">${icon('check')}</span>` : ''}
                </div>`;
            };
            const groups = ACHIEVEMENT_GROUPS.map(g => {
                const list = ACHIEVEMENTS.filter(a => a.group === g.id);
                const got = list.filter(a => d.achievements[a.id]).length;
                return `<small class="kicker-soft ach-group">${g.name} · ${got}/${list.length}</small><div class="ach-grid">${list.map(card).join('')}</div>`;
            }).join('');
            return `<div class="section-head"><b class="big">${done}<i>/${ACHIEVEMENTS.length}</i></b><span>conquistas obtidas nesta campanha</span>${meter((done / ACHIEVEMENTS.length) * 100)}</div>
                ${groups}`;
        },
        stats() {
            const d = Save.data;
            const progress = campaignProgress(d);
            const bosses = defeatedBosses(d);
            const ex = exploration(d);
            const tile = (ic, value, label, extra = '') => `<div class="stat-tile">${icon(ic)}<b>${value}</b><small>${label}</small>${extra}</div>`;
            const rows = Object.entries(BOSSES).map(([id, b]) => `<li class="${d.achievements[id] ? 'done' : ''}">${icon(d.achievements[id] ? 'check' : 'lock')} ${d.achievements[id] ? b.name : 'Chefe desconhecido'}${d.achievements[id] && b.lore && knowsBossName(d, id) ? ` <em>${b.lore}</em>` : ''} <small>Capítulo ${b.chapter}</small></li>`).join('');
            return `<div class="stat-grid">
                ${tile('clock', fmtLong(d.totalTime), 'Tempo total de jogo')}
                ${tile('skull', d.deaths, 'Mortes')}
                ${tile('flag', `${progress.done}<i>/${progress.total}</i>`, 'Fases concluídas')}
                ${tile('boss', `${bosses.length}<i>/${Object.keys(BOSSES).length}</i>`, 'Chefes derrotados')}
                ${tile('eye', `${ex.secrets}<i>/${TOTAL_SECRETS}</i>`, 'Segredos encontrados')}
                ${tile('berry', `${ex.berries}<i>/${TOTAL_BERRIES}</i>`, 'Morangos encontrados')}
                ${tile('map', `${Object.keys(d.world.visited).length}<i>/${ROOMS.length}</i>`, 'Salas visitadas')}
                ${tile('scroll', `${recordsFound(d)}<i>/${TOTAL_RECORDS}</i>`, 'Registros encontrados')}
            </div>
            <div class="stat-columns">
                <div class="stat-block"><div class="stat-block-head"><span>Progresso de exploração</span><b>${ex.pct}%</b></div>${meter(ex.pct)}<small>Soma dos segredos e dos morangos encontrados em todas as salas do mundo, incluindo as opcionais.</small>
                    <ul class="stat-lines">
                        <li>Inimigos derrotados <b>${d.stomps}</b></li>
                        <li>Cristais usados <b>${d.crystals}</b></li>
                        <li>Morangos coletados no total <b>${d.berries}</b></li>
                        <li>Habilidades usadas <b>${d.abilityUses}</b></li>
                    </ul>
                </div>
                <div class="stat-block"><div class="stat-block-head"><span>Chefes</span></div><ul class="boss-list">${rows}</ul>
                    <div class="stat-block-head spaced"><span>Mortes por capítulo</span></div>
                    <ul class="stat-lines">${CHAPTERS.map(ch => `<li>Capítulo ${ch}: ${CHAPTER_NAMES[ch]} <b>${d.chapterDeaths[ch - 1]}</b></li>`).join('')}</ul>
                </div>
            </div>`;
        },
        records() {
            const d = Save.data;
            const found = recordsFound(d);
            const open = recordById(ui.record);
            const current = open && d.story.records[open.id] ? open : RECORDS.find(r => d.story.records[r.id]) || null;
            ui.record = current ? current.id : null;
            const groups = CHAPTERS.filter(ch => RECORDS.some(r => r.chapter === ch)).map(ch => {
                const rows = RECORDS.filter(r => r.chapter === ch).map(r => {
                    const known = d.story.records[r.id];
                    return known
                        ? `<button class="rec-row ${current && current.id === r.id ? 'selected' : ''}" data-act="record-pick" data-arg="${r.id}">${icon('scroll')}<span><b>${r.title}</b><small>${RECORD_KINDS[r.kind]}</small></span></button>`
                        : `<div class="rec-row locked">${icon('lock')}<span><b>Registro não encontrado</b><small>${r.auto ? 'A história chegará até você' : LEVELS[r.level].name}</small></span></div>`;
                }).join('');
                return `<div class="rec-group"><small class="kicker-soft">Capítulo ${ch} · ${CHAPTER_NAMES[ch]}</small>${rows}</div>`;
            }).join('');
            const scenes = Object.entries(SCENE_INFO).filter(([id]) => d.story.scenes[id]).map(([id, s]) =>
                `<button class="chip" data-act="scene-replay" data-arg="${id}">${icon('play')} ${s.title}</button>`).join('');
            return `<div class="section-head"><b class="big">${found}<i>/${TOTAL_RECORDS}</i></b><span>registros reunidos nesta campanha</span>${meter((found / TOTAL_RECORDS) * 100)}</div>
                <div class="rec-layout">
                    <div class="rec-list">${groups}</div>
                    <article class="rec-reader">${current
                        ? `<small class="kicker">${RECORD_KINDS[current.kind]}</small><h3>${current.title}</h3><p class="rec-text">${current.text}</p><small class="rec-source">${current.source}</small>`
                        : '<p class="empty-note">Nada foi encontrado ainda. Pedras com inscrições brilhantes guardam o que restou do passado.</p>'}
                        ${scenes ? `<div class="rec-scenes"><small class="kicker-soft">Rever cenas</small><div>${scenes}</div></div>` : ''}
                    </article>
                </div>`;
        },
        settings() {
            return '<div id="settings-host"></div>';
        }
    };

    function renderHeader() {
        const d = Save.data;
        const tab = TABS.find(t => t.id === ui.tab);
        const when = new Date(d.updatedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        $('hub-header').innerHTML = `<h2>${tab.label}</h2>
            <div class="hub-id"><b>Campanha ${Save.active + 1}</b>${modeTag(d)}<small>Salvo em ${when}</small></div>`;
    }

    function renderNav() {
        $('hub-nav').innerHTML = TABS.map(t => `<button class="${t.id === ui.tab ? 'selected' : ''}" data-act="hub-tab" data-arg="${t.id}" ${t.id === ui.tab ? 'aria-current="page"' : ''}>${icon(t.icon)}<span>${t.label}</span></button>`).join('');
    }

    function attachHero() {
        const slot = $('hero-slot');
        if (!slot) return;
        if (!ui.heroTried) {
            ui.heroTried = true;
            try {
                ui.hero = ctx.createHero($('hero'));
            } catch (e) {
                ui.hero = null;
            }
        }
        const canvas = $('hero');
        slot.appendChild(canvas);
        canvas.classList.toggle('hidden', !ui.hero);
        if (ui.hero) {
            ui.hero.setChapter(levelFacts(continueLevel(Save.data)).chapter);
            ui.hero.setSkin(Save.data.skins.equipped);
            ui.hero.frame(false);
        }
    }

    function renderPanel(animate = true) {
        const panel = $('hub-panel');
        const stash = $('hero');
        if (stash && stash.parentElement !== $('hero-stash')) $('hero-stash').appendChild(stash);
        const settings = $('settings-body');
        if (settings.parentElement.id === 'settings-host') $('settings-stash').appendChild(settings);
        panel.innerHTML = PANELS[ui.tab]();
        panel.dataset.tab = ui.tab;
        if (animate) {
            panel.classList.remove('enter');
            void panel.offsetWidth;
            panel.classList.add('enter');
        }
        if (ui.tab === 'home') attachHero();
        if (ui.tab === 'settings') ctx.mountSettings($('settings-host'), true);
    }

    function render(animate = true) {
        const d = Save.data;
        if (!d) return;
        $('hub').dataset.chapter = levelFacts(continueLevel(d)).chapter;
        $('hub').dataset.realm = d.realm;
        renderHeader();
        renderNav();
        renderPanel(animate);
    }

    function refocus(selector) {
        const el = selector && document.querySelector(selector);
        if (el) el.focus({ preventScroll: true });
    }

    function open(tab = 'home') {
        const d = Save.data;
        if (!d) return false;
        ui.tab = tab;
        if (!d.abilities[ui.ability]) ui.ability = d.loadout[0] || Object.keys(d.abilities)[0] || 'shockwave';
        render();
        ctx.show('hub');
        refocus(tab === 'home' ? '#btn-continue' : '#hub-nav .selected');
        return true;
    }

    function afterLoadoutChange(focusSelector) {
        render(false);
        refocus(focusSelector);
    }

    const actions = {
        'hub-tab'(btn) {
            if (ui.tab !== btn.dataset.arg) {
                ui.tab = btn.dataset.arg;
                render();
            }
            refocus('#hub-nav .selected');
        },
        // Continuar: volta direto ao último checkpoint salvo, sem tela de preparação.
        'hub-continue'() {
            const point = continueRoom(Save.data);
            ctx.start(point.room, point.resume);
        },
        // Viagem rápida pelo mapa da central: começa no checkpoint escolhido (e ele vira o save).
        'map-travel'(btn) {
            const flag = Save.data.world.flags[btn.dataset.arg];
            if (!flag) return;
            ctx.travelTo(flag);
        },
        'ability-filter'(btn) {
            ui.filter = btn.dataset.arg;
            renderPanel(false);
            refocus(`.chip[data-arg=${ui.filter}]`);
        },
        'ability-pick'(btn) {
            ui.ability = btn.dataset.arg;
            renderPanel(false);
            refocus(`.ab-card[data-arg=${ui.ability}]`);
        },
        'ability-toggle'(btn) {
            const id = btn.dataset.arg;
            if (Save.unequip(id)) {
                Sfx.unequip();
            } else {
                const error = Save.equip(id);
                if (error) {
                    Sfx.denied();
                    ctx.toast('lock', 'Não foi possível equipar', error);
                    return;
                }
                Sfx.equip();
            }
            afterLoadoutChange(`.ab-card[data-arg=${id}]`);
        },
        'slot-remove'(btn) {
            if (Save.unequip(btn.dataset.arg)) Sfx.unequip();
            afterLoadoutChange('#hub-nav .selected');
        },
        'ability-upgrade'(btn) {
            const id = btn.dataset.arg;
            const a = abilityById(id);
            if (!Save.upgradeAbility(id)) return;
            Sfx.upgrade();
            const level = Save.data.abilities[id];
            ctx.toast(a.icon, `${a.name}: nível ${level}`, a.levels[level - 1].text);
            if (maxedAbilityCount(Save.data) >= 3) ctx.game.unlock('ability_max3');
            render(false);
            refocus(`.ab-card[data-arg=${id}]`);
        },
        'record-pick'(btn) {
            ui.record = btn.dataset.arg;
            render(false);
            refocus(`.rec-row[data-arg=${ui.record}]`);
        },
        'scene-replay'(btn) {
            ctx.replayScene(btn.dataset.arg);
        }
    };

    return {
        open,
        actions,
        get tab() { return ui.tab; },
        setTab(tab) { ui.tab = tab; render(); },
        get hero() { return ui.tab === 'home' ? ui.hero : null; }
    };
}
