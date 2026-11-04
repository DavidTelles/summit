import { View } from './scene.js';
import { Game } from './game.js';
import { LEVELS } from './levels.js';
import { Input, Sfx, ACHIEVEMENTS, Save, SKILLS } from './core.js';

const $ = id => document.getElementById(id);
const screens = ['menu', 'levels', 'achievements', 'controls', 'pause', 'complete', 'saves', 'mode', 'skills', 'credits', 'death', 'campaign', 'stats', 'options'];

Save.load();
Input.init();

const view = new View($('c'));
let state = 'menu';
let currentLevel = 0;

const fmt = t => {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return String(m).padStart(2, '0') + ':' + s.toFixed(1).padStart(4, '0');
};

const game = new Game(view, {
    onHud(h) {
        $('hud-level').textContent = `${h.index + 1}. ${h.level}`;
        $('hud-berries').textContent = `🍓 ${h.berries}/${h.totalBerries}`;
        $('hud-deaths').textContent = `💀 ${h.deaths}`;
        $('hud-time').textContent = fmt(h.time);
        $('stamina').style.width = Math.max(0, h.stamina * 100) + '%';
        $('stamina').style.background = h.stamina < 0.3 ? '#ff4d4d' : '#3ddc84';
        $('dash-dot').classList.toggle('empty', h.dashes < 1);
    },
    onAchievement(a) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.innerHTML = `<div class="ic">${a.icon}</div><div><b>${a.name}</b><small>${a.desc}</small></div>`;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 4200);
    },
    onComplete(r) {
        state = 'complete';
        $('hud').classList.add('hidden');
        $('complete-title').textContent = r.last ? 'Você chegou ao cume!' : 'Fase completa!';
        $('complete-stats').innerHTML =
            `<b>${r.name}</b><br>⏱️ ${fmt(r.time)}${r.record ? ' (novo recorde!)' : ''}<br>🍓 ${r.berries}/${r.totalBerries}<br>💀 ${r.deaths}`;
        $('btn-next').classList.toggle('hidden', r.last);
        show('complete');
    },
    onPermadeath() {
        if (Save.active >= 0) Save.deleteSlot(Save.active);
        Save.active = -1;
        state = 'dead';
        $('hud').classList.add('hidden');
        $('death-title').textContent = 'Morte Súbita';
        $('death-msg').textContent = 'Seu save foi permanentemente deletado.';
        show('death');
    }
});

function show(name) {
    screens.forEach(s => $(s).classList.toggle('hidden', s !== name));
}

function hideAll() {
    screens.forEach(s => $(s).classList.add('hidden'));
}

function start(index) {
    if (!Save.hasActive()) { renderSaves(); show('saves'); return; }
    Sfx.ensure();
    currentLevel = index;
    Save.data.currentLevel = index;
    Save.save();
    game.load(index);
    hideAll();
    $('hud').classList.remove('hidden');
    state = 'playing';
}

function renderLevels() {
    const list = $('level-list');
    list.innerHTML = '';
    const unlocked = Save.data ? Save.data.unlocked : 1;
    const best = Save.data ? Save.data.best : {};
    LEVELS.forEach((l, i) => {
        const locked = i >= unlocked;
        const b = best[i];
        const card = document.createElement('div');
        card.className = 'level-card' + (locked ? ' locked' : '');
        card.innerHTML = `<b>${i + 1}. ${l.name}</b><span>${locked ? '🔒 Bloqueada' : b ? `⏱️ ${fmt(b.time)} · 🍓 ${b.berries}` : 'Sem recorde'}</span>`;
        if (!locked) card.onclick = () => start(i);
        list.appendChild(card);
    });
}

function renderAchievements() {
    const data = Save.data;
    const achs = data ? data.achievements : {};
    const done = ACHIEVEMENTS.filter(a => achs[a.id]).length;
    $('ach-count').textContent = `${done}/${ACHIEVEMENTS.length}`;
    $('ach-list').innerHTML = ACHIEVEMENTS.map(a => {
        const ok = achs[a.id];
        const name = (!ok && a.secret) ? '???' : a.name;
        const desc = (!ok && a.secret) ? 'Conquista secreta' : a.desc;
        return `<div class="ach ${ok ? 'done' : ''}"><div class="ic">${ok ? a.icon : '🔒'}</div><div><b>${name}</b><span>${desc}</span></div></div>`;
    }).join('');
}

function fmtSave(s) {
    const d = s;
    const mode = d.mode === 'permadeath' ? 'Morte Súbita' : 'Normal';
    const mins = Math.floor(d.totalTime / 60);
    const secs = (d.totalTime % 60).toFixed(1);
    return `Cap ${d.chapter} · Nível ${d.unlocked} · 💀 ${d.deaths} · ⏱ ${String(mins).padStart(2,'0')}:${secs.padStart(4,'0')} · 🏆 ${Object.keys(d.achievements||{}).length} · ${mode}`;
}

function renderSaves() {
    const list = $('save-list');
    list.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const s = Save.slot(i);
        const card = document.createElement('div');
        card.className = 'level-card save-card';
        const empty = !s;
        card.innerHTML = empty
            ? `<b>Save ${i+1}</b><span>Vazio</span>`
            : `<b>Save ${i+1}</b><span>${fmtSave(s)}</span><br><small>Atualizado: ${new Date(s.updatedAt).toLocaleString()}</small>`;
        const btns = document.createElement('div');
        btns.className = 'buttons row';
        if (saveScreenMode === 'newgame') {
            if (!empty) {
                const over = document.createElement('button');
                over.textContent = 'Substituir';
                over.className = 'danger';
                over.onclick = () => actions.selectSave(i);
                btns.appendChild(over);
            } else {
                const over = document.createElement('button');
                over.textContent = 'Criar';
                over.onclick = () => actions.selectSave(i);
                btns.appendChild(over);
            }
            const del = document.createElement('button');
            del.textContent = 'Excluir';
            del.className = 'danger';
            del.onclick = () => actions.deleteSave(i);
            btns.appendChild(del);
        } else {
            if (!empty) {
                const sel = document.createElement('button');
                sel.textContent = 'Selecionar';
                sel.onclick = () => actions.selectSave(i);
                btns.appendChild(sel);
            } else {
                const tip = document.createElement('span');
                tip.textContent = 'Sem campanha salva';
                tip.style.opacity = 0.6;
                tip.style.fontSize = '12px';
                tip.style.marginLeft = '8px';
                btns.appendChild(tip);
            }
        }
        card.appendChild(btns);
        list.appendChild(card);
    }
}

function renderCampaign() {
    const s = Save.data;
    if (!s) return;
    $('campaign-title').textContent = `Campanha — Save ${Save.active + 1}`;
}

function renderStats() {
    const s = Save.data;
    const list = $('stats-list');
    if (!s) { list.innerHTML = '<p>Nenhum dado.</p>'; return; }
    const skills = Array.isArray(s.skills) ? s.skills.join(', ') : '—';
    list.innerHTML = `
        <p><b>Campanha:</b> Save ${Save.active + 1}</p>
        <p><b>Modo:</b> ${s.mode === 'permadeath' ? 'Morte Súbita' : 'Normal'}</p>
        <p><b>Capítulo:</b> ${s.chapter || 1}</p>
        <p><b>Fase atual:</b> ${(s.currentLevel || 0) + 1}</p>
        <p><b>Mortes:</b> ${s.deaths || 0}</p>
        <p><b>Morangos:</b> ${s.berries || 0}</p>
        <p><b>Cristais:</b> ${s.crystals || 0}</p>
        <p><b>Derrotas:</b> ${s.stomps || 0}</p>
        <p><b>Tempo jogado:</b> ${fmt(s.totalTime || 0)}</p>
        <p><b>Habilidades:</b> ${skills}</p>
        <p><b>Capítulos concluídos:</b> ${Array.isArray(s.completedChapters) ? s.completedChapters.join(', ') : '—'}</p>
        <p><b>Conquistas:</b> ${Object.keys(s.achievements||{}).length}</p>
    `;
}

let pendingSlot = -1;
let saveScreenMode = 'continue'; // 'continue' | 'newgame'

function renderSkills() {
    const list = $('skill-list');
    list.innerHTML = '';
    const data = Save.data;
    SKILLS.forEach(sk => {
        const unlocked = data && Array.isArray(data.skills) && data.skills.includes(sk.id);
        const div = document.createElement('div');
        div.className = 'ach ' + (unlocked ? 'done' : '');
        div.innerHTML = `<div class="ic">${unlocked ? '✨' : '🔒'}</div><div><b>${sk.name}</b><span>${sk.desc}<br><small>${unlocked ? 'Desbloqueada: ' + sk.unlock : 'Bloqueada'}</small></span></div>`;
        list.appendChild(div);
    });
}
const actions = {
    continue() {
        saveScreenMode = 'continue';
        renderSaves();
        show('saves');
    },
    newgame() {
        saveScreenMode = 'newgame';
        renderSaves();
        show('saves');
    },
    options() {
        show('options');
    },
    saves() { renderSaves(); show('saves'); },
    levels() { renderLevels(); show('levels'); },
    achievements() { renderAchievements(); show('achievements'); },
    skills() { renderSkills(); show('skills'); },
    controls() { show('controls'); },
    credits() { show('credits'); },
    quit() { try { window.close(); } catch (e) {} },
    mute(btn) { Sfx.muted = !Sfx.muted; btn.textContent = 'Som: ' + (Sfx.muted ? 'desligado' : 'ligado'); },
    fullscreen() {
        const el = document.documentElement;
        if (!document.fullscreenElement) el.requestFullscreen().catch(()=>{});
        else document.exitFullscreen().catch(()=>{});
    },
    menu() { state = 'menu'; $('hud').classList.add('hidden'); show('menu'); },
    resume() { hideAll(); state = 'playing'; },
    restart() { start(currentLevel); },
    next() { start(Math.min(currentLevel + 1, LEVELS.length - 1)); },
    reset() {
        if (confirm('Apagar todo o progresso e conquistas?')) {
            Save.reset(); renderAchievements();
        }
    },
    selectSave(i) {
        if (saveScreenMode === 'newgame') {
            pendingSlot = i;
            const occupied = !!Save.slot(i);
            if (occupied && !confirm('Este slot já contém uma campanha. Iniciar uma nova campanha substituirá o progresso existente?')) return;
            show('mode');
            return;
        }
        Save.setActive(i);
        const s = Save.data;
        if (!s || Save.active < 0) return;
        // Campaign internal menu
        renderCampaign();
        show('campaign');
    },
    deleteSave(i) {
        if (confirm('Excluir save ' + (i+1) + '?')) {
            Save.deleteSlot(i);
            renderSaves();
        }
    },
    'mode-normal'() {
        if (pendingSlot < 0) return;
        Save.create(pendingSlot, 'normal');
        pendingSlot = -1;
        saveScreenMode = 'continue';
        start(0);
    },
    'mode-permadeath'() {
        if (pendingSlot < 0) return;
        if (!confirm('MODO MORTE SÚBITA: se você morrer, o save será permanentemente deletado. Confirmar?')) return;
        Save.create(pendingSlot, 'permadeath');
        pendingSlot = -1;
        saveScreenMode = 'continue';
        start(0);
    },
    campaign() { renderCampaign(); show('campaign'); },
    'camp-continue'() {
        const s = Save.data;
        if (!s || Save.active < 0) return;
        start(s.currentLevel || 0);
    },
    'camp-chapters'() { show('levels'); },
    'camp-achievements'() { renderAchievements(); show('achievements'); },
    'camp-skills'() { renderSkills(); show('skills'); },
    'camp-stats'() { renderStats(); show('stats'); },
    'camp-settings'() { show('options'); },
};

document.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (btn && actions[btn.dataset.act]) {
        Sfx.ensure();
        actions[btn.dataset.act](btn);
    }
});

addEventListener('keydown', e => {
    if (state === 'playing' && (e.code === 'Escape' || e.code === 'KeyP')) {
        state = 'paused';
        show('pause');
    } else if (state === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) {
        actions.resume();
    } else if (state === 'playing' && e.code === 'KeyR') {
        start(currentLevel);
    }
});

const volInput = $('vol-master');
if (volInput) {
    volInput.addEventListener('input', () => { Sfx.volume = parseFloat(volInput.value); });
}

let last = performance.now();
function loop(now) {
    const dt = (now - last) / 1000;
    last = now;
    if (state === 'playing') game.update(dt);
    else if (game.running) game.view.updateParticles(dt);
    Input.endFrame();
    view.render();
    requestAnimationFrame(loop);
}

game.load(0);
requestAnimationFrame(loop);

