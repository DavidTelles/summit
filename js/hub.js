import { CHAPTER_THREAD, RECORDS, RECORD_KINDS, SCENE_INFO, TOTAL_RECORDS, recordById, recordsFound } from './story.js';
import { LEVELS } from './levels.js';
import { ACHIEVEMENTS, Save, SKILLS, achievementProgress } from './core.js';
import { ABILITIES, CATEGORIES, LOADOUT_SIZE, TYPE_LABEL, abilityById, meetsReq, reqProgress, reqText } from './abilities.js';
import {
    BOSSES, CHAPTER_DESC, CHAPTER_NAMES, DIFFICULTY, TOTAL_BERRIES, TOTAL_SECRETS, campaignProgress, chapterLevels, chapterProgress,
    continueLevel, defeatedBosses, exploration, levelFacts, levelObjectives, levelRewards, levelStatus, resumeFor
} from './campaign.js';
import { icon } from './icons.js';
import { Sfx } from './audio.js';

const $ = id => document.getElementById(id);
const TABS = [
    { id: 'home', label: 'Início', icon: 'home' },
    { id: 'chapters', label: 'Capítulos', icon: 'route' },
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
const pips = (level, max) => `<span class="pips" aria-label="Nível ${level} de ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('')}</span>`;
const meter = (pct, cls = '') => `<div class="meter ${cls}"><i style="width:${Math.min(100, pct)}%"></i></div>`;
const difficulty = n => `<span class="pips diff" aria-hidden="true">${Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>`;
const seconds = v => `${String(v).replace('.', ',')} s`;

function abilityFacts(a, stats) {
    const list = [`<span>${icon(a.type === 'passive' ? 'spark' : 'bolt2')} ${TYPE_LABEL[a.type]}</span>`];
    if (stats.cooldown) list.push(`<span>${icon('cooldown')} Recarga ${seconds(stats.cooldown)}</span>`);
    if (stats.duration) list.push(`<span>${icon('clock')} Dura ${seconds(stats.duration)}</span>`);
    if (stats.cost) list.push(`<span>${icon('wind')} Custa ${stats.cost} de fôlego</span>`);
    return `<div class="ab-facts">${list.join('')}</div>`;
}

function reqLine(req, d) {
    const ok = meetsReq(req, d);
    const progress = !ok && reqProgress(req, d);
    return `<div class="req ${ok ? 'ok' : ''}">${icon(ok ? 'check' : 'lock')}<span>${reqText(req)}${progress ? ` <b>${progress[0]}/${progress[1]}</b>` : ''}</span></div>`;
}

const knowsBossName = (d, id) => (id === 'boss1' ? d.story.records.varak_champion || d.story.records.varak_refusal : d.story.records.aethos_notebook);

function profileSvg(d) {
    const W = 1000;
    const H = 76;
    const lift = [0, 3, 1, 7, 13, 9, 14, 10, 22, 19, 27, 36];
    const points = LEVELS.map((_, i) => {
        const x = 24 + (i * (W - 48)) / (LEVELS.length - 1);
        const y = H - 12 - ((i / (LEVELS.length - 1)) * 18 + lift[i]);
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
    const ui = { tab: 'home', filter: 'all', ability: 'shockwave', chapter: 1, prep: null, prepFocus: null, hero: null, heroTried: false };

    function loadoutSlots(removable) {
        const d = Save.data;
        const cells = [];
        for (let i = 0; i < LOADOUT_SIZE; i++) {
            const a = abilityById(d.loadout[i]);
            if (a) {
                cells.push(`<button class="slot filled cat-${a.category}" data-act="slot-remove" data-arg="${a.id}" title="Remover ${a.name}" ${removable ? '' : 'tabindex="-1"'}>
                    <span class="slot-ic">${icon(a.icon)}</span><span class="slot-name">${a.name}</span>${removable ? `<span class="slot-x">${icon('close')}</span>` : ''}</button>`);
            } else {
                cells.push(`<div class="slot empty"><span class="slot-ic">${i + 1}</span><span class="slot-name">Espaço livre</span></div>`);
            }
        }
        return cells.join('');
    }

    function abilityCard(a, acting) {
        const d = Save.data;
        const level = d.abilities[a.id];
        const equipped = d.loadout.includes(a.id);
        const ready = level && Save.canUpgrade(a.id);
        const state = !level ? 'locked' : equipped ? 'equipped' : 'open';
        const selected = (acting === 'ability-pick' ? ui.ability : ui.prepFocus) === a.id;
        return `<button class="ab-card ${state} ${selected ? 'selected' : ''} cat-${a.category}" data-act="${acting}" data-arg="${a.id}" data-ability="${a.id}" aria-pressed="${equipped}">
            <span class="ab-ic">${icon(level ? a.icon : 'lock')}</span>
            <span class="ab-text"><b>${a.name}</b><small>${level ? `Nível ${level}` : 'Bloqueada'}${ready ? ' · pode evoluir' : ''}</small></span>
            ${equipped ? `<span class="ab-mark">${icon('check')}</span>` : ''}
        </button>`;
    }

    function abilityDetail(id, withUpgrade) {
        const d = Save.data;
        const a = abilityById(id);
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
        const upgrade = next ? `<div class="detail-block upgrade">
                <small>Próximo nível: ${level + 1}</small><p>${next.text}</p>${reqLine(next.req, d)}
                ${withUpgrade ? `<button class="btn ${Save.canUpgrade(a.id) ? 'btn-primary' : ''}" data-act="ability-upgrade" data-arg="${a.id}" ${Save.canUpgrade(a.id) ? '' : 'disabled'}>${icon('spark')} Evoluir para nível ${level + 1}</button>` : ''}
            </div>` : '<div class="detail-block"><small>Evolução</small><p>Nível máximo alcançado.</p></div>';
        const toggle = withUpgrade
            ? `<button class="btn" data-act="ability-toggle" data-arg="${a.id}">${icon(equipped ? 'close' : 'check')} ${equipped ? 'Remover da próxima fase' : 'Equipar para a próxima fase'}</button>`
            : '';
        return `${head}${body}<div class="detail-block"><small>Nível atual: ${level}</small><p>${stats.text}</p></div>${upgrade}${toggle}`;
    }

    const PANELS = {
        home() {
            const d = Save.data;
            const index = continueLevel(d);
            const f = levelFacts(index);
            const progress = campaignProgress(d);
            const resume = resumeFor(d, index);
            const unlocked = Object.keys(d.abilities).length;
            const upgrades = ABILITIES.filter(a => d.abilities[a.id] && Save.canUpgrade(a.id)).length;
            const achieved = Object.keys(d.achievements).length;
            const explored = exploration(d);
            const finished = progress.done === progress.total;
            return `<div class="home">
                <div class="home-left">
                    <small class="kicker">Kael · Capítulo ${f.chapter}</small>
                    <h1 class="home-title">${CHAPTER_NAMES[f.chapter]}</h1>
                    <p class="home-thread">${finished ? 'A montanha está em silêncio. O que resta é explorar o que ficou.' : CHAPTER_THREAD[f.chapter]}</p>
                    <div class="home-progress"><b>${progress.pct}%</b><span>da campanha · ${progress.done} de ${progress.total} fases</span>${meter(progress.pct)}</div>
                    <button class="btn btn-primary btn-hero" data-act="hub-continue" id="btn-continue">
                        ${icon('play')}<span><b>${finished ? 'Rejogar última fase' : resume ? 'Retomar jornada' : 'Continuar jornada'}</b><small>Fase ${index + 1} · ${f.name}${resume ? ' · do checkpoint' : ''}</small></span>
                    </button>
                    <div class="home-loadout">
                        <small class="kicker-soft">Equipadas para a próxima fase</small>
                        <div class="mini-slots">${[0, 1, 2].map(i => {
                            const a = abilityById(d.loadout[i]);
                            return a ? `<span class="mini-slot cat-${a.category}" title="${a.name}">${icon(a.icon)}</span>` : '<span class="mini-slot empty"></span>';
                        }).join('')}</div>
                    </div>
                </div>
                <div class="home-hero"><div id="hero-slot"></div></div>
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
                    <div class="trail-labels"><span>Base</span><span>Última fase alcançada: <b>${d.unlocked}. ${LEVELS[d.unlocked - 1].name}</b></span><span>Cume</span></div>
                    ${profileSvg(d)}
                </div>
            </div>`;
        },
        chapters() {
            const d = Save.data;
            const tabs = [1, 2, 3].map(ch => {
                const p = chapterProgress(d, ch);
                return `<button class="chapter-tab ch-${ch} ${ui.chapter === ch ? 'selected' : ''} ${p.open ? '' : 'locked'}" data-act="chapter-pick" data-arg="${ch}" aria-pressed="${ui.chapter === ch}">
                    <small>Capítulo ${ch}</small><b>${CHAPTER_NAMES[ch]}</b>
                    <span class="chapter-meta">${p.open ? `${p.done}/${p.total} fases` : `${icon('lock')} Bloqueado`}</span>${meter(p.pct)}
                </button>`;
            }).join('');
            const cards = chapterLevels(ui.chapter).map(f => {
                const status = levelStatus(d, f.index);
                const b = d.best[f.index];
                const meta = status === 'locked'
                    ? `Conclua a fase ${f.index} para liberar`
                    : b ? `${icon('clock')} ${fmtTime(b.time)} &nbsp; ${icon('berry', 'red')} ${Math.min(b.berries, f.berries)}/${f.berries}` : `${icon('berry', 'red')} ${f.berries} morangos para encontrar`;
                return `<button class="level-tile ${status}" data-act="open-level" data-arg="${f.index}" ${status === 'locked' ? 'aria-disabled="true"' : ''}>
                    <span class="level-num">${f.index + 1}</span>
                    <span class="level-body"><b>${f.name}</b><small>${meta}</small></span>
                    <span class="level-side">${f.boss ? `<span class="tag tag-boss">${icon('boss')} Chefe</span>` : ''}<span class="status ${status}">${icon(STATUS[status].icon)} ${STATUS[status].label}</span></span>
                </button>`;
            }).join('');
            return `<div class="chapter-tabs">${tabs}</div>
                <p class="chapter-desc">${CHAPTER_DESC[ui.chapter]}</p>
                <div class="level-list">${cards}</div>`;
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
                    <div class="equipped-row"><span class="slots-count"><b>${d.loadout.length}/${LOADOUT_SIZE}</b> equipadas para a próxima fase</span><div class="slots">${loadoutSlots(true)}</div></div>
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
            const cards = ACHIEVEMENTS.map(a => {
                const ok = d.achievements[a.id];
                const hidden = !ok && a.secret;
                const progress = !ok && achievementProgress(a.id, d);
                return `<div class="ach-card ${ok ? 'done' : ''}">
                    <span class="ach-ic">${icon(ok ? a.icon : hidden ? 'eye' : 'lock')}</span>
                    <span class="ach-text"><b>${hidden ? 'Conquista secreta' : a.name}</b><small>${hidden ? 'Continue explorando para revelar.' : a.desc}</small>
                    ${progress ? `<span class="ach-progress">${meter((progress[0] / progress[1]) * 100)}<em>${progress[0]}/${progress[1]}</em></span>` : ''}</span>
                    ${ok ? `<span class="ach-done" title="Obtida">${icon('check')}</span>` : ''}
                </div>`;
            }).join('');
            return `<div class="section-head"><b class="big">${done}<i>/${ACHIEVEMENTS.length}</i></b><span>conquistas obtidas nesta campanha</span>${meter((done / ACHIEVEMENTS.length) * 100)}</div>
                <div class="ach-grid">${cards}</div>`;
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
                ${tile('boss', `${bosses.length}<i>/3</i>`, 'Chefes derrotados')}
                ${tile('eye', `${ex.secrets}<i>/${TOTAL_SECRETS}</i>`, 'Segredos encontrados')}
                ${tile('berry', `${ex.berries}<i>/${TOTAL_BERRIES}</i>`, 'Morangos nas melhores marcas')}
                ${tile('scroll', `${recordsFound(d)}<i>/${TOTAL_RECORDS}</i>`, 'Registros encontrados')}
            </div>
            <div class="stat-columns">
                <div class="stat-block"><div class="stat-block-head"><span>Progresso de exploração</span><b>${ex.pct}%</b></div>${meter(ex.pct)}<small>Soma dos segredos encontrados e do melhor número de morangos de cada fase concluída.</small>
                    <ul class="stat-lines">
                        <li>Inimigos derrotados <b>${d.stomps}</b></li>
                        <li>Cristais usados <b>${d.crystals}</b></li>
                        <li>Morangos coletados no total <b>${d.berries}</b></li>
                        <li>Habilidades usadas <b>${d.abilityUses}</b></li>
                    </ul>
                </div>
                <div class="stat-block"><div class="stat-block-head"><span>Chefes</span></div><ul class="boss-list">${rows}</ul>
                    <div class="stat-block-head spaced"><span>Mortes por capítulo</span></div>
                    <ul class="stat-lines">${[1, 2, 3].map(ch => `<li>Capítulo ${ch}: ${CHAPTER_NAMES[ch]} <b>${d.chapterDeaths[ch - 1]}</b></li>`).join('')}</ul>
                </div>
            </div>`;
        },
        records() {
            const d = Save.data;
            const found = recordsFound(d);
            const open = recordById(ui.record);
            const current = open && d.story.records[open.id] ? open : RECORDS.find(r => d.story.records[r.id]) || null;
            ui.record = current ? current.id : null;
            const groups = [1, 2, 3].map(ch => {
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
        if (ui.hero) ui.hero.setChapter(levelFacts(continueLevel(Save.data)).chapter);
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
        ui.chapter = levelFacts(continueLevel(d)).chapter;
        if (!d.abilities[ui.ability]) ui.ability = d.loadout[0] || Object.keys(d.abilities)[0] || 'shockwave';
        render();
        ctx.show('hub');
        refocus(tab === 'home' ? '#btn-continue' : '#hub-nav .selected');
        return true;
    }

    function renderPrep() {
        const d = Save.data;
        const { index, resume } = ui.prep;
        const f = levelFacts(index);
        const owned = ABILITIES.filter(a => d.abilities[a.id]);
        const locked = ABILITIES.length - owned.length;
        const rewards = levelRewards(d, index);
        if (!ui.prepFocus || !d.abilities[ui.prepFocus]) ui.prepFocus = d.loadout[0] || (owned[0] && owned[0].id) || null;
        $('prep').dataset.chapter = f.chapter;
        $('prep-info').innerHTML = `<small class="kicker">Capítulo ${f.chapter} · ${CHAPTER_NAMES[f.chapter]} · Fase ${index + 1}</small>
            <h2>${f.name}</h2>
            <div class="prep-diff">${difficulty(f.difficulty)} <span>${DIFFICULTY[f.difficulty - 1]}</span>${f.boss ? ` <span class="tag tag-boss">${icon('boss')} Chefe</span>` : ''}</div>
            <p>${f.desc}</p>
            <div class="prep-block"><small class="kicker-soft">Objetivos</small><ul>${levelObjectives(index).map(o => `<li>${icon(o.icon)} ${o.text}</li>`).join('')}</ul></div>
            ${rewards.length ? `<div class="prep-block"><small class="kicker-soft">Recompensas previstas</small><ul class="rewards">${rewards.map(o => `<li>${icon(o.icon)} ${o.text}</li>`).join('')}</ul></div>` : ''}
            ${resume ? `<div class="prep-note">${icon('flag')} Você tem um checkpoint nesta fase.</div>` : ''}`;
        $('prep-slots').innerHTML = `<div class="slots-head"><b>${d.loadout.length}/${LOADOUT_SIZE}</b><span>espaços ocupados</span><em id="prep-msg" role="status"></em></div><div class="slots">${loadoutSlots(true)}</div>`;
        $('prep-grid').innerHTML = owned.length ? owned.map(a => abilityCard(a, 'ability-equip')).join('') : '<p class="empty-note">Nenhuma habilidade desbloqueada ainda.</p>';
        $('prep-locked').textContent = locked ? `Mais ${locked} ${locked === 1 ? 'habilidade bloqueada' : 'habilidades bloqueadas'}: veja os requisitos na aba Habilidades.` : 'Você desbloqueou todas as habilidades.';
        $('prep-detail').innerHTML = ui.prepFocus ? abilityDetail(ui.prepFocus, false) : '';
        $('btn-prep-clear').disabled = !d.loadout.length;
        $('btn-prep-start-label').textContent = resume ? 'Retomar do checkpoint' : 'Iniciar Fase';
        $('btn-prep-restart').classList.toggle('hidden', !resume);
    }

    function openPrep(index, resume = null) {
        if (!Save.data) return;
        ui.prep = { index, resume };
        ui.prepFocus = null;
        renderPrep();
        ctx.show('prep');
        refocus('#btn-prep-start');
    }

    function prepMessage(text) {
        const el = $('prep-msg');
        if (!el) return;
        el.textContent = text;
        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');
    }

    function afterLoadoutChange(focusSelector) {
        if (ctx.currentScreen() === 'prep') renderPrep();
        else render(false);
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
        'hub-continue'() {
            const d = Save.data;
            const index = continueLevel(d);
            openPrep(index, resumeFor(d, index));
        },
        'open-level'(btn) {
            const index = +btn.dataset.arg;
            const d = Save.data;
            if (levelStatus(d, index) === 'locked') {
                Sfx.denied();
                ctx.toast('lock', 'Fase bloqueada', `Conclua a fase ${index} para liberar ${LEVELS[index].name}.`);
                return;
            }
            openPrep(index, resumeFor(d, index));
        },
        'chapter-pick'(btn) {
            const chapter = +btn.dataset.arg;
            if (!chapterProgress(Save.data, chapter).open) {
                Sfx.denied();
                ctx.toast('lock', 'Capítulo bloqueado', `Conclua o Capítulo ${chapter - 1} para continuar a subida.`);
                return;
            }
            ui.chapter = chapter;
            renderPanel(false);
            refocus(`.chapter-tab.ch-${chapter}`);
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
        'ability-equip'(btn) {
            const id = btn.dataset.arg;
            ui.prepFocus = id;
            if (Save.unequip(id)) {
                Sfx.unequip();
                afterLoadoutChange(`.ab-card[data-arg=${id}]`);
                return;
            }
            const error = Save.equip(id);
            if (error) {
                Sfx.denied();
                renderPrep();
                refocus(`.ab-card[data-arg=${id}]`);
                prepMessage(error);
                return;
            }
            Sfx.equip();
            afterLoadoutChange(`.ab-card[data-arg=${id}]`);
        },
        'slot-remove'(btn) {
            if (Save.unequip(btn.dataset.arg)) Sfx.unequip();
            afterLoadoutChange(ctx.currentScreen() === 'prep' ? '#prep-grid .ab-card' : '#hub-nav .selected');
        },
        'ability-upgrade'(btn) {
            const id = btn.dataset.arg;
            const a = abilityById(id);
            if (!Save.upgradeAbility(id)) return;
            Sfx.upgrade();
            const level = Save.data.abilities[id];
            ctx.toast(a.icon, `${a.name}: nível ${level}`, a.levels[level - 1].text);
            if (level === a.levels.length) ctx.game.unlock('ability_max');
            render(false);
            refocus(`.ab-card[data-arg=${id}]`);
        },
        'prep-clear'() {
            if (Save.clearLoadout()) Sfx.unequip();
            renderPrep();
            refocus('#prep-grid .ab-card');
        },
        'prep-back'() {
            open(ui.tab);
        },
        'record-pick'(btn) {
            ui.record = btn.dataset.arg;
            render(false);
            refocus(`.rec-row[data-arg=${ui.record}]`);
        },
        'scene-replay'(btn) {
            ctx.replayScene(btn.dataset.arg);
        },
        'prep-start'() {
            ctx.start(ui.prep.index, ui.prep.resume);
        },
        'prep-restart'() {
            ctx.start(ui.prep.index, null);
        }
    };

    $('prep-grid').addEventListener('focusin', e => previewAbility(e.target));
    $('prep-grid').addEventListener('mouseover', e => previewAbility(e.target));
    function previewAbility(target) {
        const card = target.closest && target.closest('[data-ability]');
        if (!card || card.dataset.ability === ui.prepFocus) return;
        ui.prepFocus = card.dataset.ability;
        document.querySelectorAll('#prep-grid .ab-card').forEach(el => el.classList.toggle('selected', el === card));
        $('prep-detail').innerHTML = abilityDetail(ui.prepFocus, false);
    }

    return {
        open,
        openPrep,
        actions,
        get tab() { return ui.tab; },
        setTab(tab) { ui.tab = tab; render(); },
        get hero() { return ui.tab === 'home' ? ui.hero : null; }
    };
}
