import * as THREE from '../lib/three.module.js';
import * as E from './entities.js';
import { Sfx } from './audio.js';
import { INK, LAYER, glowSprite, hatch, mixHex, pivot, radial, rgba, rng, shape, sprite, stroke, trace, vGrad } from './ink.js';
import { addLayer, crystalCluster, layerTexture } from './backdrops.js';
import { makeDecor, makeFlower, makeRubble } from './decor.js';

const AETHER = 0x6fcfff;
const FADE = 0.7;
const MIN_SHOT = 0.8;

function kael(pose) {
    const model = E.makePlayer();
    model.userData.halo.scale.setScalar(0.001);
    const state = { x: 0, y: 0, vx: 0, vy: 0, facing: 1, dashes: 1, dashDir: { x: 1, y: 0 }, squash: 1, onGround: true, climbing: 0, iframes: 0, dead: false };
    return { model, state, pose };
}

function plate(parent, W, H, z, draw, opts = {}) {
    const { x = -W / 2, y = 0, order = LAYER.mid, px = 12, opacity = 1 } = opts;
    const tex = layerTexture(W, H, draw, px, false);
    if (tex) tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const m = addLayer(parent, tex, x, y, z, W, H, 1, 1, order, { opacity });
    m.userData.owned = false;
    m.userData.plate = true;
    return m;
}

function solid(parent, color, x, y, z, w, h, order) {
    const m = addLayer(parent, null, x, y, z, w, h, 1, 1, order, { color: new THREE.Color(color).getHex() });
    m.userData.owned = false;
    return m;
}

function mountainPlate(ctx, W, H, light, shade, snow, seed) {
    const r = rng(seed);
    const peak = (cx, top, halfW, base, lit, dark, capH) => {
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(cx - halfW, base);
        ctx.lineTo(cx - halfW * 0.42, base + (top - base) * 0.58);
        ctx.lineTo(cx - halfW * 0.16, base + (top - base) * 0.83);
        ctx.lineTo(cx, top);
        ctx.lineTo(cx + halfW * 0.22, base + (top - base) * 0.74);
        ctx.lineTo(cx + halfW * 0.48, base + (top - base) * 0.5);
        ctx.lineTo(cx + halfW, base);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = lit;
        ctx.beginPath();
        ctx.moveTo(cx - halfW, base);
        ctx.lineTo(cx - halfW * 0.42, base + (top - base) * 0.58);
        ctx.lineTo(cx - halfW * 0.16, base + (top - base) * 0.83);
        ctx.lineTo(cx, top);
        ctx.lineTo(cx + halfW * 0.06, base + (top - base) * 0.62);
        ctx.lineTo(cx - halfW * 0.08, base + (top - base) * 0.42);
        ctx.lineTo(cx + halfW * 0.07, base);
        ctx.closePath();
        ctx.fill();
        const capBase = top - capH;
        ctx.fillStyle = snow;
        ctx.beginPath();
        ctx.moveTo(cx, top);
        ctx.lineTo(cx + capH * 0.42, capBase + capH * 0.32);
        ctx.lineTo(cx + capH * 0.2, capBase + capH * 0.12);
        ctx.lineTo(cx + capH * 0.05, capBase + capH * 0.25);
        ctx.lineTo(cx - capH * 0.08, capBase - capH * 0.02);
        ctx.lineTo(cx - capH * 0.26, capBase + capH * 0.22);
        ctx.lineTo(cx - capH * 0.42, capBase + capH * 0.08);
        ctx.lineTo(cx - capH * 0.46, capBase + capH * 0.42);
        ctx.closePath();
        ctx.fill();
    };
    peak(W * 0.22, H * 0.56, W * 0.26, 0, light, shade, H * 0.1);
    peak(W * 0.8, H * 0.5, W * 0.26, 0, light, shade, H * 0.08);
    peak(W * 0.5, H * 0.96, W * 0.42, 0, mixHex(light, '#ffffff', 0.05), shade, H * 0.2);
    ctx.strokeStyle = rgba('#000000', 0.14);
    ctx.lineWidth = H * 0.0028;
    for (let i = 0; i < 54; i++) {
        const x = W * (0.16 + r() * 0.68);
        const y = H * (0.05 + r() * 0.5);
        const side = x < W / 2 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + side * H * (0.012 + r() * 0.02), y - H * (0.03 + r() * 0.06));
        ctx.stroke();
    }
}

function crystalSprite(key, s, order) {
    return sprite(`cine.${key}`, s * 2.4, s * 3, ctx => crystalCluster(ctx, 0, -s * 1.5, s, '#3f9fc6', '#b6efff'), { ppu: 50, own: true, layer: order, y: s * 1.5 });
}

function bigCrystal(order) {
    return sprite('cine.giant', 6, 30, ctx => {
        const o = [[-1.6, -14.8, 1], [-1.95, -3], [-1.8, 11], [0, 14.8, 1], [1.65, 10.2], [1.95, -4], [1.6, -14.8, 1]];
        shape(ctx, o, '#22658c', 0.1, '#05141e');
        shape(ctx, [[0, 14.8, 1], [-1.8, 11], [-1.95, -3], [-1.6, -14.8, 1], [-0.3, -14.8, 1], [-0.1, 3]], '#5fb9de', 0, INK);
        shape(ctx, [[0, 14.8, 1], [1.65, 10.2], [0.35, -1], [-0.1, 3]], '#a6e6f7', 0, INK);
        trace(ctx, o);
        ctx.save();
        ctx.clip();
        ctx.fillStyle = vGrad(ctx, 3, -14.8, 'rgba(2,8,24,0)', 'rgba(2,8,24,0.88)');
        ctx.fillRect(-3, -15, 6, 18);
        ctx.restore();
        stroke(ctx, [[-0.1, 3], [-0.3, -14.8]], 0.05, '#0f3f58');
        stroke(ctx, [[-1.2, 9], [-0.9, 2]], 0.09, 'rgba(255,255,255,0.8)');
    }, { ppu: 24, own: true, layer: order });
}

const SETS = {
    peak(g) {
        const data = { sky: ['#4f76ad', '#ecd8c2'], crystals: [], veins: [] };
        plate(g, 240, 70, -92, ctx => {
            const r = rng(9);
            ctx.fillStyle = '#90a4c1';
            for (let i = 0; i < 22; i++) {
                const x = (i / 22) * 240;
                const h = 12 + r() * 30;
                ctx.beginPath();
                ctx.moveTo(x - 16, 0);
                ctx.lineTo(x + r() * 4, h);
                ctx.lineTo(x + 18, 0);
                ctx.fill();
            }
            ctx.fillStyle = vGrad(ctx, 34, 0, rgba('#ecd8c2', 0), rgba('#ecd8c2', 0.75));
            ctx.fillRect(0, 0, 240, 34);
        }, { x: -120, y: -12, order: LAYER.far });
        plate(g, 130, 104, -30, ctx => mountainPlate(ctx, 130, 104, '#5b6a8a', '#2a3350', '#e9eff7', 3), { x: -65, y: -12, order: LAYER.mid, px: 14 });
        plate(g, 240, 22, -6, ctx => {
            ctx.fillStyle = vGrad(ctx, 22, 0, rgba('#d9e4ee', 0), rgba('#d9e4ee', 0.8));
            ctx.fillRect(0, 0, 240, 22);
        }, { x: -120, y: -12, order: LAYER.mid + 3 });
        const r = rng(11);
        for (let i = 0; i < 18; i++) {
            const m = sprite('cine.spark', 1.2, 1.8, ctx => {
                radial(ctx, 0, 0, 0.6, '#7fe3ff', 0.75);
                shape(ctx, [[0, 0.6, 1], [0.2, 0, 1], [0, -0.6, 1], [-0.2, 0, 1]], '#c8f4ff', 0.02, '#0a4258');
            }, { ppu: 30, own: true, layer: LAYER.mid + 1, x: (r() - 0.5) * 50, y: 4 + r() * 40 });
            m.position.z = -27;
            g.add(m);
            data.crystals.push(m);
        }
        data.core = glowSprite(0xff8a3c, 9, { opacity: 0.95, layer: LAYER.mid + 2 });
        data.core.position.set(0, 15, -24);
        data.veins = [[-6, 12, 0.5], [6, 17, -0.6], [-3, 21, -0.9], [4, 9, 0.9]].map(([x, y, rot]) => {
            const v = sprite('cine.vein', 1, 12, ctx => stroke(ctx, [[0, -5.6], [0.3, -2], [-0.3, 1.5], [0.15, 5.6]], 0.16, '#ff8a3c'), { ppu: 30, additive: true, layer: LAYER.mid + 2, x, y });
            v.position.z = -24;
            v.rotation.z = rot;
            v.visible = false;
            g.add(v);
            return v;
        });
        data.core.visible = false;
        g.add(data.core);
        return data;
    },
    city(g) {
        const data = { sky: ['#4a7bb9', '#f4cfa4'], crystals: [], stones: [] };
        plate(g, 180, 60, -60, ctx => mountainPlate(ctx, 180, 60, '#7d90b0', '#4c5d80', '#ecf2f6', 21), { x: -90, y: -6, order: LAYER.far });
        const TIERS = ['#3d2f30', '#65575a', '#8e8488', '#aca5ad'];
        const FOG = '#f4cfa4';
        for (let tier = 3; tier >= 0; tier--) {
            const y = tier * 5.5 - 2;
            const z = -6 - tier * 6;
            const tone = TIERS[tier];
            plate(g, 90, 14, z, ctx => {
                const r = rng(tier * 7 + 3);
                const line = mixHex('#120e10', tone, tier * 0.28);
                let x = 0.5;
                while (x < 88) {
                    const kind = r();
                    const w = kind > 0.82 ? 1.8 + r() : 2.6 + r() * 3;
                    const h = kind > 0.82 ? 7 + r() * 4 : 2.4 + r() * 4.4;
                    const fill = mixHex(tone, '#000000', r() * 0.16);
                    const base = 2.2;
                    if (kind > 0.82) shape(ctx, [[x, base, 1], [x + 0.1, base + h, 1], [x + w / 2, base + h + 2.2, 1], [x + w - 0.1, base + h, 1], [x + w, base, 1]], fill, 0.05, line);
                    else if (kind > 0.45) shape(ctx, [[x, base, 1], [x, base + h, 1], [x - 0.35, base + h, 1], [x + w * 0.5, base + h + 1.6, 1], [x + w + 0.35, base + h, 1], [x + w, base + h, 1], [x + w, base, 1]], fill, 0.05, line);
                    else shape(ctx, [[x, base, 1], [x, base + h, 1], [x + w * 0.5, base + h + 0.25, 1], [x + w, base + h, 1], [x + w, base, 1]], fill, 0.05, line);
                    ctx.fillStyle = rgba('#000000', 0.16);
                    ctx.fillRect(x + w * 0.62, base, w * 0.38, h);
                    for (let k = 0; k < Math.floor(h / 1.5); k++) {
                        if (r() < 0.25) continue;
                        const wx = x + w * (0.2 + r() * 0.42);
                        const wy = base + 0.6 + k * 1.45;
                        radial(ctx, wx + 0.12, wy + 0.24, 0.7, '#ffcf8a', 0.3);
                        ctx.fillStyle = '#ffdf9f';
                        ctx.beginPath();
                        ctx.moveTo(wx, wy);
                        ctx.lineTo(wx, wy + 0.34);
                        ctx.quadraticCurveTo(wx + 0.13, wy + 0.56, wx + 0.26, wy + 0.34);
                        ctx.lineTo(wx + 0.26, wy);
                        ctx.fill();
                    }
                    x += w + (r() < 0.25 ? 0.5 + r() * 1.3 : 0.05);
                }
                shape(ctx, [[0, 0, 1], [0, 2.3, 1], [90, 2.3, 1], [90, 0, 1]], mixHex(tone, '#000000', 0.25), 0.05, line);
                for (let a = 4; a < 88; a += 7) {
                    ctx.fillStyle = mixHex(tone, '#000000', 0.45);
                    ctx.beginPath();
                    ctx.moveTo(a, 0);
                    ctx.lineTo(a, 1.1);
                    ctx.quadraticCurveTo(a + 1.2, 2.1, a + 2.4, 1.1);
                    ctx.lineTo(a + 2.4, 0);
                    ctx.fill();
                }
                ctx.fillStyle = vGrad(ctx, 8, 0, rgba(FOG, 0), rgba(FOG, 0.1 + tier * 0.12));
                ctx.fillRect(0, 0, 90, 8);
            }, { x: -45, y, order: LAYER.mid + (3 - tier) * 6, px: 18 });
            for (let i = 0; i < 3; i++) {
                const c = crystalSprite('cityGem', 0.9, LAYER.mid + (3 - tier) * 6 + 2);
                const hold = pivot(-24 + i * 22 + tier * 4, y + 2.3, c);
                hold.position.z = z + 0.1;
                const glow = glowSprite(AETHER, 7, { opacity: 0.5, layer: LAYER.mid + (3 - tier) * 6 + 1 });
                glow.position.y = 1.5;
                hold.add(glow);
                g.add(hold);
                data.crystals.push({ gem: c, glow });
            }
        }
        const r = rng(5);
        for (let i = 0; i < 14; i++) {
            const m = sprite(`cine.floatStone${i % 3}`, 2.4, 1.5, ctx => {
                const tone = TIERS[1 + (i % 3)];
                radial(ctx, 0, -0.42, 0.55, '#7fe3ff', 0.75);
                shape(ctx, [[-0.95, 0.4, 1], [0.9, 0.42, 1], [0.98, 0.1, 1], [0.54, -0.1, 1], [0.34, -0.36, 1], [-0.1, -0.2, 1], [-0.4, -0.42, 1], [-0.74, -0.08, 1]], tone, 0.05, '#120e10');
                stroke(ctx, [[-0.2, 0.4], [-0.1, 0.05], [-0.22, -0.2]], 0.03, '#120e10');
            }, { ppu: 40, layer: LAYER.mid + 26 });
            m.position.set(-28 + i * 4.3, 9 + r() * 15, -4);
            m.userData = { y: m.position.y, phase: r() * 6 };
            g.add(m);
            data.stones.push(m);
        }
        return data;
    },
    camp(g) {
        const data = { sky: ['#0d1730', '#3a4a79'] };
        plate(g, 220, 88, -55, ctx => mountainPlate(ctx, 220, 88, '#27335a', '#141c38', '#6f81ad', 7), { x: -110, y: -6, order: LAYER.far });
        plate(g, 160, 16, -20, ctx => {
            const r = rng(17);
            ctx.fillStyle = '#10182c';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            for (let x = 0; x <= 160; x += 4) ctx.lineTo(x, 3 + r() * 6);
            ctx.lineTo(160, 0);
            ctx.fill();
        }, { x: -80, y: -2, order: LAYER.mid });
        const r = rng(31);
        for (let i = 0; i < 6; i++) {
            const tent = makeDecor('tent', {});
            tent.scale.setScalar(1.3 + r() * 0.3);
            tent.position.set(-19 + i * 7.5 + r() * 1.5, 0, -7 - (i % 3) * 2);
            g.add(tent);
        }
        for (let i = 0; i < 14; i++) {
            const post = makeDecor('post', {});
            post.position.set(-24 + i * 3.8, 0, -4.5);
            g.add(post);
        }
        solid(g, '#20283a', -130, -60, -1, 260, 60, LAYER.terrain - 1);
        plate(g, 120, 3, -0.5, ctx => {
            ctx.fillStyle = '#39445a';
            ctx.fillRect(0, 1.8, 120, 0.25);
            hatch(ctx, 0, 0.2, 120, 1.8, 140, 'rgba(0,0,0,0.3)', 0.05, 8);
        }, { x: -60, y: -2.05, order: LAYER.terrain });
        const base = sprite('cine.relicBase', 2.6, 1.3, ctx => {
            shape(ctx, [[-1.2, 0, 1], [-0.92, 0.42, 1], [0.92, 0.42, 1], [1.2, 0, 1]], '#3f3d42', 0.05);
            shape(ctx, [[-0.72, 0.42, 1], [-0.66, 0.84, 1], [0.66, 0.84, 1], [0.72, 0.42, 1]], '#6e6b5e', 0.045);
            stroke(ctx, [[-0.3, 0.6], [0.3, 0.6]], 0.03, INK);
        }, { ay: 0, ppu: 80, layer: LAYER.back });
        base.position.set(0, 0, -1);
        g.add(base);
        data.relicGem = sprite('cine.relicGem', 2, 2.9, ctx => crystalCluster(ctx, 0, -1.4, 0.8, '#39566d', '#7890a8'), { ppu: 70, own: true, layer: LAYER.back + 1, x: 0, y: 2.2 });
        data.relicGem.position.z = -1;
        data.relicLit = sprite('cine.relicLit', 2, 2.9, ctx => crystalCluster(ctx, 0, -1.4, 0.8, '#6fcfff', '#ffffff'), { ppu: 70, own: true, additive: true, layer: LAYER.back + 2, x: 0, y: 2.2 });
        data.relicLit.position.z = -1;
        data.light = glowSprite(AETHER, 14, { opacity: 0, layer: LAYER.back - 1, x: 0, y: 2.2 });
        data.light.position.z = -1.2;
        g.add(data.light, data.relicGem, data.relicLit);
        data.fire = sprite('cine.fire', 1.6, 2.2, ctx => {
            shape(ctx, [[-0.5, -1, 1], [-0.46, -0.42], [-0.3, -0.12, 1], [-0.24, -0.34], [-0.06, 0.42, 1], [0.08, -0.08], [0.18, 0.1, 1], [0.36, -0.48], [0.5, -1, 1]], '#ff8a3c', 0.025, '#5a1a06');
            shape(ctx, [[-0.26, -1, 1], [-0.2, -0.58], [-0.04, -0.12, 1], [0.1, -0.54], [0.26, -1, 1]], '#ffe39a', 0);
        }, { ppu: 70, layer: LAYER.back + 3, x: 8, y: 1 });
        data.fire.position.z = -2;
        data.fireGlow = glowSprite(0xff9a3c, 9, { opacity: 0.5, layer: LAYER.back - 1, x: 8, y: 1 });
        data.fireGlow.position.z = -2.2;
        g.add(data.fireGlow, data.fire);
        const hero = kael('idle');
        hero.state.x = 3.5;
        hero.state.facing = -1;
        g.add(hero.model);
        data.hero = hero;
        return data;
    },
    training(g) {
        const data = { sky: ['#6c8ab8', '#f4cda8'] };
        plate(g, 150, 58, -46, ctx => mountainPlate(ctx, 150, 58, '#7a8cac', '#556684', '#e6edf3', 41), { x: -75, y: -4, order: LAYER.far });
        solid(g, '#28303f', -130, -60, -1, 260, 60, LAYER.terrain - 1);
        const wall = sprite('cine.wall', 9, 22, ctx => {
            const o = [[-3.2, -10.9, 1], [-3.5, -5], [-3, 0], [-3.4, 4], [-2.8, 8], [-2.2, 10.9, 1], [4.4, 10.9, 1], [4.4, -10.9, 1]];
            shape(ctx, o, '#4c5468', 0.1);
            hatch(ctx, -3, -10, 4, 10, 120, 'rgba(0,0,0,0.3)', 0.05, 3);
            const r = rng(7);
            for (let i = 0; i < 26; i++) {
                const y = -10 + i * 0.8;
                const x = -3.1 + r() * 0.5;
                shape(ctx, [[x, y, 1], [x + 0.28, y + 0.18, 1], [x + 0.55, y, 1]], '#6a738a', 0.04);
            }
        }, { ppu: 40, layer: LAYER.terrain + 1, x: 8, y: 10.9 });
        g.add(wall);
        const hero = kael('climb');
        hero.state.x = 4.35;
        hero.state.y = 1;
        hero.state.facing = 1;
        hero.state.climbing = 1;
        g.add(hero.model);
        data.hero = hero;
        return data;
    },
    ascent(g) {
        const data = { sky: ['#1c2c58', '#f4ac84'] };
        plate(g, 260, 118, -62, ctx => mountainPlate(ctx, 260, 118, '#344262', '#1a2340', '#a0a8c2', 13), { x: -130, y: -5, order: LAYER.far });
        plate(g, 220, 20, -22, ctx => {
            ctx.fillStyle = vGrad(ctx, 20, 0, rgba('#f4ac84', 0), rgba('#f4ac84', 0.55));
            ctx.fillRect(0, 0, 220, 20);
        }, { x: -110, y: -3, order: LAYER.mid });
        solid(g, '#1b2233', -130, -60, -1, 260, 60, LAYER.terrain - 1);
        const hero = kael('walk');
        hero.state.x = -5;
        hero.state.vx = 2;
        g.add(hero.model);
        data.hero = hero;
        return data;
    },
    stormfront(g) {
        const data = { sky: ['#141c38', '#5a6687'] };
        plate(g, 200, 50, -50, ctx => {
            const r = rng(51);
            for (let i = 0; i < 70; i++) {
                const x = r() * 200;
                const y = 10 + r() * 38;
                ctx.save();
                ctx.translate(x, y);
                ctx.scale(1, 0.32);
                ctx.fillStyle = rgba(i % 2 ? '#222b4c' : '#2f3a60', 0.9);
                ctx.beginPath();
                ctx.arc(0, 0, 5 + r() * 9, 0, 7);
                ctx.fill();
                ctx.restore();
            }
            for (let i = 0; i < 8; i++) {
                const x = 12 + r() * 176;
                const y = 6 + r() * 26;
                ctx.fillStyle = '#39436a';
                ctx.beginPath();
                ctx.moveTo(x - 5, y);
                ctx.lineTo(x + 5, y);
                ctx.lineTo(x + 2, y - 3);
                ctx.lineTo(x - 2, y - 2.5);
                ctx.fill();
                ctx.fillRect(x - 3.4, y, 1.2, 3 + r() * 3);
            }
        }, { x: -100, y: 0, order: LAYER.far });
        solid(g, '#20263a', -100, -40, -6, 200, 40.3, LAYER.mid);
        const mound = sprite('cine.mound', 32, 8, ctx => {
            const o = [[-15, -3.8, 1], [-8, -1.2], [-2.5, 2.8], [0, 3.6], [2.2, 3], [8, -1], [15, -3.8, 1]];
            shape(ctx, o, '#3a4258', 0.1);
            hatch(ctx, -10, -3.4, 10, 1, 90, 'rgba(0,0,0,0.3)', 0.05, 9);
        }, { ppu: 30, layer: LAYER.mid + 2, x: -1, y: 0 });
        mound.position.z = -2;
        g.add(mound);
        const rubble = makeRubble();
        rubble.position.set(1.2, 0.05, 1.8);
        rubble.scale.setScalar(0.9);
        const flower = makeFlower();
        flower.scale.setScalar(1.6);
        flower.position.set(1.5, 0.2, 2);
        g.add(rubble, flower);
        data.bolts = [-20, 0, 18].map(x => {
            const b = sprite('cine.bolt', 2, 28, ctx => {
                radial(ctx, 0, 6, 8, '#a8d8ff', 0.3);
                stroke(ctx, [[0.3, 13.8], [-0.4, 8], [0.45, 3], [-0.25, -2], [0.4, -8], [-0.2, -13.8]], 0.13, '#eff8ff');
            }, { ppu: 30, additive: true, layer: LAYER.mid + 1, x, y: 18 });
            b.position.z = -30;
            b.visible = false;
            g.add(b);
            return b;
        });
        const hero = kael('idle');
        hero.state.x = -1;
        hero.state.y = 3.45;
        g.add(hero.model);
        data.hero = hero;
        return data;
    },
    chasm(g) {
        const data = { sky: ['#07060c', '#8a2f12'] };
        const wall = side => {
            const tex = layerTexture(14, 110, ctx => {
                const r = rng(side + 71);
                const pts = [];
                for (let i = 0; i <= 28; i++) pts.push([side < 0 ? 8.5 + r() * 3.5 : 5.5 - r() * 3.5, i * 4, 1]);
                const o = side < 0 ? [[0, 0, 1], ...pts, [0, 110, 1]] : [[14, 0, 1], ...pts, [14, 110, 1]];
                shape(ctx, o, '#21171a', 0.16);
                hatch(ctx, side < 0 ? 0 : 7, 0, side < 0 ? 8 : 14, 110, 260, 'rgba(0,0,0,0.4)', 0.08, 4);
                for (let i = 0; i < 16; i++) {
                    const y = r() * 106;
                    const x = side < 0 ? 5 + r() * 3 : 6 + r() * 3;
                    stroke(ctx, [[x, y], [x + r() - 0.5, y + 2], [x + r() - 0.5, y + 5]], 0.14, '#ff6a2a');
                }
            }, 10, false);
            if (tex) tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
            const m = addLayer(g, tex, side < 0 ? -15.5 : 1.5, -62, -1, 14, 110, 1, 1, LAYER.terrain + 2);
            m.userData.owned = false;
            m.userData.plate = true;
        };
        plate(g, 60, 120, -18, ctx => {
            ctx.fillStyle = vGrad(ctx, 120, 0, '#120808', '#a33212');
            ctx.fillRect(0, 0, 60, 120);
        }, { x: -30, y: -70, order: LAYER.mid });
        wall(-1);
        wall(1);
        const lava = glowSprite(0xff7a30, 36, { opacity: 0.8, layer: LAYER.terrain + 3, x: 0, y: -62 });
        lava.position.z = -2;
        g.add(lava);
        const hero = kael('fall');
        hero.state.y = 40;
        hero.state.vy = -10;
        g.add(hero.model);
        data.hero = hero;
        return data;
    },
    chamber(g) {
        const data = { sky: ['#02050d', '#05152d'], crystals: [], motes: [] };
        solid(g, '#090d18', -130, -60, -3, 260, 60, LAYER.terrain - 1);
        plate(g, 180, 3, -2, ctx => {
            ctx.fillStyle = '#161d30';
            ctx.fillRect(0, 2.3, 180, 0.3);
            hatch(ctx, 0, 0.2, 180, 2.2, 180, 'rgba(120,180,220,0.08)', 0.05, 4);
        }, { x: -90, y: -2.5, order: LAYER.terrain });
        const r = rng(71);
        for (let i = 0; i < 16; i++) {
            const far = i < 8;
            const side = i % 2 ? 1 : -1;
            const scale = far ? 0.7 + r() * 0.3 : 0.9 + r() * 0.4;
            const m = bigCrystal(far ? LAYER.mid : LAYER.near);
            m.scale.setScalar(scale);
            m.rotation.z = side * -0.07;
            m.position.set(side * (5 + r() * (far ? 28 : 18)), 13 * scale, far ? -28 - r() * 12 : -8 - r() * 8);
            g.add(m);
            data.crystals.push(m);
        }
        for (let i = 0; i < 4; i++) {
            const glow = glowSprite(AETHER, 44, { opacity: 0.25, layer: LAYER.mid - 2, x: -30 + i * 20, y: 9 });
            glow.position.z = -32;
            g.add(glow);
            data.crystals.push(glow);
        }
        for (let i = 0; i < 44; i++) {
            const mote = sprite('cine.mote', 0.3, 0.3, ctx => radial(ctx, 0, 0, 0.15, '#d8f4ff', 1), { ppu: 60, additive: true, layer: LAYER.fx, x: (r() - 0.5) * 30, y: 1 + r() * 12 });
            mote.position.z = -r() * 16;
            mote.userData = { y0: mote.position.y, phase: r() * 6 };
            g.add(mote);
            data.motes.push(mote);
        }
        const hero = kael('walk');
        hero.state.x = -7;
        hero.state.vx = 2;
        g.add(hero.model);
        data.hero = hero;
        return data;
    },
    dawn(g) {
        const data = { sky: ['#2b508f', '#fbcfa7'] };
        plate(g, 330, 70, -90, ctx => {
            const r = rng(15);
            ctx.fillStyle = '#9daac5';
            for (let i = 0; i < 28; i++) {
                const x = (i / 28) * 330;
                const h = 10 + r() * 30;
                ctx.beginPath();
                ctx.moveTo(x - 18, 0);
                ctx.lineTo(x + r() * 4, h);
                ctx.lineTo(x + 20, 0);
                ctx.fill();
            }
            ctx.fillStyle = vGrad(ctx, 30, 0, rgba('#fbcfa7', 0), rgba('#fbcfa7', 0.8));
            ctx.fillRect(0, 0, 330, 30);
        }, { x: -165, y: -18, order: LAYER.far });
        plate(g, 150, 110, -25, ctx => mountainPlate(ctx, 150, 110, '#57688f', '#28324f', '#fff0e2', 3), { x: -75, y: -18, order: LAYER.mid, px: 14 });
        plate(g, 280, 30, -8, ctx => {
            ctx.fillStyle = vGrad(ctx, 30, 0, rgba('#ffe3c6', 0), rgba('#ffe3c6', 0.85));
            ctx.fillRect(0, 0, 280, 30);
        }, { x: -140, y: -20, order: LAYER.mid + 3 });
        return data;
    }
};

export const SCENES = {
    intro: {
        music: 'cine_intro',
        shots: [
            { set: 'peak', dur: 7, cam: [[-10, 8, 92], [-2, 24, 66]], look: [[-3, 22, -20], [0, 36, -20]], lines: [[0.5, 'A montanha não tem nome.'], [3.6, 'Os povos ao seu redor a chamavam apenas de o Cume.']], sfx: 'gust' },
            { set: 'peak', dur: 6.5, cam: [[6, 20, 40], [-1, 17, 24]], look: [[0, 18, -14], [0, 15, -14]], lines: [[0.5, 'No centro dela pulsa o Núcleo.'], [3.4, 'Os antigos chamaram sua energia de Éter.']], flow: true, core: true },
            { set: 'city', dur: 8, cam: [[-16, 11, 40], [14, 14, 36]], look: [[-10, 11, -10], [8, 13, -10]], lines: [[0.5, 'Uma cidade cresceu em suas encostas.'], [4, 'Colheram os cristais. Deram nomes às tempestades.']], cityLit: 1 },
            { set: 'city', dur: 7, cam: [[14, 14, 36], [15, 11, 44]], look: [[8, 13, -10], [6, 10, -10]], lines: [[1.9, 'Até o dia em que, sem aviso, o Éter parou de fluir.']], cityLit: 0, stonesFall: true, sfx: 'shatter' },
            { set: 'camp', dur: 7, cam: [[-12, 8, 32], [5, 5, 24]], look: [[-8, 7, -8], [1, 4, -6]], lines: [[0.5, 'Os sobreviventes desceram e juraram que alguém subiria de novo.'], [4, 'Gerações se passaram. A montanha permaneceu.']] },
            { set: 'training', dur: 6, cam: [[1, 3, 9], [1.5, 7.6, 7.4]], look: [[2.5, 3.2, 0], [3.1, 8, 0]], lines: [[0.8, 'Kael nunca esperou.'], [3.2, 'Ele treinou.']], climb: 1.3 },
            { set: 'camp', dur: 6.5, cam: [[3.6, 2.6, 10], [2.2, 2.2, 7.2]], look: [[1.6, 2.2, 0], [1.4, 1.9, 0]], lines: [[1.6, 'Na última noite, o cristal adormecido acendeu.']], relic: [0, 1], heroFacing: -1, sfx: 'relic' },
            { set: 'ascent', dur: 6.5, cam: [[-7, 4.4, 15], [-1, 5.6, 14]], look: [[-3, 4.4, 0], [2, 7.2, 0]], lines: [[1, 'Ele partiu na madrugada. Sozinho. Sem avisar ninguém.']], walk: 2 }
        ]
    },
    ch1to2: {
        music: 2,
        shots: [
            { set: 'stormfront', dur: 4.8, cam: [[2, 1.6, 7.4], [1.8, 1.4, 6]], look: [[1.5, 1.2, 2], [1.5, 1.05, 2]], lines: [[0.8, 'Entre os escombros, uma flor de morango.']] },
            { set: 'stormfront', dur: 5, cam: [[1.8, 1.4, 6], [-1, 5, 16]], look: [[1.5, 1.05, 2], [-0.6, 5.4, -8]], lines: [[1, 'Acima dela, o céu já não era o mesmo.']], sfx: 'gust' },
            { set: 'stormfront', dur: 6, cam: [[-1, 5, 16], [3, 13, 22]], look: [[-0.6, 5.4, -8], [2, 17, -22]], lines: [[1.3, 'O primeiro dia terminava. A tempestade esperava logo acima.']], lightning: true, sfx: 'thunder' }
        ]
    },
    ch2to3: {
        music: 3,
        shots: [
            { set: 'stormfront', dur: 5, cam: [[2, 14, 26], [0, 7, 17]], look: [[2, 18, -22], [-0.5, 5, -6]], lines: [[1, 'Os raios cessaram. O céu ficou de repente vazio.']] },
            { set: 'chasm', dur: 7, cam: [[0, 44, 20], [0, -42, 20]], look: [[0, 40, 0], [0, -44, 0]], lines: [[0.8, 'Tudo o que Aethos mediu apontava para baixo.'], [3.8, 'O segundo dia terminava. O caminho agora era para dentro.']], fall: true, sfx: 'gust' }
        ]
    },
    final: {
        music: 'cine_final',
        shots: [
            { set: 'chamber', dur: 8, cam: [[-10, 5, 22], [-1, 3.8, 13]], look: [[-6, 6, -14], [0, 3.4, -4]], lines: [], walk: 1.2, walkLimit: 0, chamberLit: 0.35 },
            { set: 'chamber', dur: 7, cam: [[0.8, 1.2, 6.2], [0.6, 1.1, 5]], look: [[0, 1.2, 0], [0, 1.15, 0]], heroAt: 0, lines: [[2.4, 'Por que você subiu?']], lineStyle: 'voice', chamberLit: 0.35, sfx: 'coreVoice' },
            { set: 'chamber', dur: 5, cam: [[0.6, 1.1, 5], [0.45, 1.05, 4.4]], look: [[0, 1.15, 0], [0, 1.1, 0]], heroAt: 0, lines: [], chamberLit: 0.35 },
            { set: 'chamber', dur: 7, cam: [[-3, 3, 11], [3, 8, 26]], look: [[0, 3, -3], [0, 10, -20]], heroAt: 0, lines: [], chamberLit: [0.35, 1.6], motes: true, sfx: 'aetherFlow' },
            { set: 'camp', dur: 6, cam: [[2.2, 2.2, 7.2], [3, 6, 20]], look: [[1.4, 1.9, 0], [1, 7, -10]], lines: [], relic: [1.4, 3.6], noHero: true, sfx: 'relic' },
            { set: 'chamber', dur: 9, cam: [[2.4, 1.6, 8], [1.6, 1.6, 6.4]], look: [[0, 1.2, 0], [0, 1.4, 0]], heroAt: 0, sit: true, lines: [[1.2, 'Ele não sabe se conseguirá descer.'], [5, 'Mas, por um momento, apenas fica ali.']], chamberLit: 1, motes: true, fadeMusic: 8 },
            { set: 'dawn', dur: 8, cam: [[0, 10, 84], [0, 20, 66]], look: [[0, 20, -20], [0, 28, -20]], lines: [[3, 'A montanha, pela primeira vez em séculos, está em silêncio.']] }
        ]
    }
};

const smooth = k => k * k * (3 - 2 * k);
const mix = (a, b, k) => a + (b - a) * k;

export class Cinema {
    constructor(view, hooks = {}) {
        this.view = view;
        this.hooks = hooks;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 500);
        this.skyMat = new THREE.ShaderMaterial({
            depthWrite: false, depthTest: false, fog: false,
            uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
            vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
            fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec2 vUv; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0, 1.0, vUv.y)), 1.0);\n#include <colorspace_fragment>\n}'
        });
        const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.skyMat);
        sky.frustumCulled = false;
        sky.renderOrder = LAYER.sky;
        this.scene.add(sky);
        this.sets = {};
        this.active = null;
        this.time = 0;
    }

    set(name) {
        if (!this.sets[name]) {
            const group = new THREE.Group();
            const data = SETS[name](group);
            group.visible = false;
            this.scene.add(group);
            this.sets[name] = { group, data };
        }
        return this.sets[name];
    }

    play(id) {
        this.active = { id, def: SCENES[id], index: -1, t: 0, ended: false };
        Sfx.setTheme(this.active.def.music);
        this.nextShot();
    }

    get playing() {
        return !!this.active && !this.active.ended;
    }

    nextShot() {
        const a = this.active;
        a.index++;
        a.t = 0;
        a.line = -1;
        const shot = a.def.shots[a.index];
        for (const s of Object.values(this.sets)) s.group.visible = false;
        if (!shot) {
            a.ended = true;
            this.emitCaption('', null);
            return;
        }
        const set = this.set(shot.set);
        set.group.visible = true;
        this.skyMat.uniforms.top.value.set(set.data.sky[0]);
        this.skyMat.uniforms.bottom.value.set(set.data.sky[1]);
        if (this.view.postMat) this.view.postMat.uniforms.shade.value.set(set.data.sky[0]);
        this.emitCaption('', null);
        if (shot.sfx && Sfx[shot.sfx]) Sfx[shot.sfx]();
        if (shot.fadeMusic) Sfx.fadeMusic(shot.fadeMusic);
        if (set.data.hero) {
            set.data.hero.state.y = shot.fall ? 40 : set.data.hero.state.y;
            set.data.hero.model.visible = !shot.noHero;
            if (shot.heroAt !== undefined) {
                set.data.hero.state.x = shot.heroAt;
                set.data.hero.state.vx = 0;
            } else if (shot.walkLimit !== undefined) set.data.hero.state.x = -7;
            else if (shot.walk) set.data.hero.state.x = -5;
        }
        if (set.data.stones) set.data.stones.forEach(m => { m.position.y = m.userData.y; });
    }

    emitCaption(text, style) {
        if (this.hooks.onCaption) this.hooks.onCaption(text, style);
    }

    advance() {
        const a = this.active;
        if (!a || a.ended || a.t < MIN_SHOT) return;
        this.nextShot();
    }

    skip() {
        const a = this.active;
        if (!a || a.ended) return;
        a.ended = true;
        for (const s of Object.values(this.sets)) s.group.visible = false;
        this.emitCaption('', null);
    }

    update(dt) {
        const a = this.active;
        if (!a || a.ended) return;
        a.t += dt;
        this.time += dt;
        if (this.view.postMat) {
            this.view.postMat.uniforms.dim.value = 1;
            this.view.postMat.uniforms.time.value = this.time;
        }
        const shot = a.def.shots[a.index];
        if (a.t >= shot.dur) {
            this.nextShot();
            if (a.ended) return;
            this.update(0);
            return;
        }
        const k = smooth(a.t / shot.dur);
        const [c1, c2] = shot.cam;
        const [l1, l2] = shot.look;
        this.camera.position.set(mix(c1[0], c2[0], k), mix(c1[1], c2[1], k), mix(c1[2], c2[2], k));
        this.camera.lookAt(mix(l1[0], l2[0], k), mix(l1[1], l2[1], k), mix(l1[2], l2[2], k));
        for (let i = a.line + 1; i < shot.lines.length; i++) {
            if (a.t < shot.lines[i][0]) break;
            a.line = i;
            this.emitCaption(shot.lines[i][1], shot.lineStyle || null);
        }
        this.animate(shot, a.t, a.t / shot.dur, dt);
        const fade = Math.min(1, Math.min(a.t, shot.dur - a.t) / FADE);
        if (this.hooks.onFade) this.hooks.onFade(1 - fade);
    }

    animate(shot, t, k, dt) {
        const data = this.set(shot.set).data;
        if (data.core) {
            if (shot.flow) data.crystals.forEach((m, i) => { m.material.opacity = 0.55 + Math.sin(this.time * 2 + i) * 0.4; });
            data.core.visible = !!shot.core;
            data.veins.forEach(v => { v.visible = !!shot.core; });
            if (shot.core) data.core.scale.setScalar(9 + Math.sin(this.time * 2.4) * 1.3);
        }
        if (shot.cityLit !== undefined && data.crystals) {
            const on = shot.cityLit === 1 ? 1 : k < 0.2 ? Math.max(0, 1 - k / 0.2) * (Math.sin(this.time * 34) > -0.2 ? 1 : 0.2) : 0;
            data.crystals.forEach(c => {
                c.glow.material.opacity = on * 0.55;
                c.gem.material.color.setRGB(0.3 + on * 0.7, 0.34 + on * 0.66, 0.42 + on * 0.58);
            });
        }
        if (data.stones) {
            data.stones.forEach(m => {
                if (shot.stonesFall && k > 0.12) m.position.y = Math.max(-1, m.position.y - dt * 14 * Math.min(1, (k - 0.12) * 5));
                else m.position.y = m.userData.y + Math.sin(this.time * 1.2 + m.userData.phase) * 0.28;
            });
        }
        if (data.relicGem) {
            const power = shot.relic ? mix(shot.relic[0], shot.relic[1], smooth(Math.min(1, Math.max(0, (k - 0.15) / 0.5)))) : 0;
            const beat = 1 + Math.sin(this.time * 3) * 0.12;
            data.relicLit.material.opacity = Math.min(1, power * beat);
            data.light.material.opacity = Math.min(0.9, power * 0.45);
            data.light.scale.setScalar(10 + power * 9);
        }
        if (data.fire) {
            data.fire.scale.y = 1 + Math.sin(this.time * 13) * 0.12;
            data.fireGlow.material.opacity = 0.42 + Math.sin(this.time * 9) * 0.08;
        }
        if (data.bolts) data.bolts.forEach((b, i) => { b.visible = !!shot.lightning && Math.sin(this.time * 7 + i * 2.2) > 0.91; });
        if (shot.chamberLit !== undefined && data.crystals) {
            const lit = Array.isArray(shot.chamberLit) ? mix(shot.chamberLit[0], shot.chamberLit[1], smooth(k)) : shot.chamberLit;
            const v = Math.min(1, 0.3 + lit * 0.42) * (1 + Math.sin(this.time * 1.5) * (lit > 0.5 ? 0.06 : 0.02));
            data.crystals.forEach(m => {
                if (m.material.blending === THREE.AdditiveBlending) m.material.opacity = 0.05 + lit * 0.13;
                else m.material.color.setRGB(v, v, v);
            });
        }
        if (data.motes) {
            data.motes.forEach(m => {
                m.visible = !!shot.motes;
                m.position.y = m.userData.y0 + ((this.time * 0.5 + m.userData.phase) % 6);
            });
        }
        if (data.hero) this.animateHero(shot, data.hero, k, dt);
    }

    animateHero(shot, hero, k, dt) {
        const s = hero.state;
        let pose = 'idle';
        s.climbing = 0;
        if (shot.walk) {
            s.x += shot.walk * dt;
            if (shot.walkLimit !== undefined && s.x >= shot.walkLimit) s.x = shot.walkLimit;
            else {
                s.vx = shot.walk;
                pose = 'walk';
            }
            s.facing = 1;
        } else if (shot.climb) {
            s.y = Math.min(13, s.y + shot.climb * dt);
            s.climbing = 1;
            s.facing = 1;
            pose = 'climb';
        } else if (shot.fall) {
            s.y = mix(40, -46, smooth(k));
            pose = 'fall';
        } else if (shot.sit) {
            pose = 'land';
        }
        if (shot.heroFacing) s.facing = shot.heroFacing;
        s.onGround = pose !== 'fall';
        E.animatePlayer(hero.model, s, pose, dt, this.time);
    }

    release() {
        for (const { group } of Object.values(this.sets)) {
            group.traverse(node => {
                if (!node.userData.plate) return;
                if (node.material.map) node.material.map.dispose();
                node.material.dispose();
                node.geometry.dispose();
            });
            this.scene.remove(group);
        }
        this.sets = {};
    }

    resize() {
        const c = this.view.renderer.domElement;
        const aspect = c.clientWidth && c.clientHeight ? c.clientWidth / c.clientHeight : 16 / 9;
        if (Math.abs(aspect - this.camera.aspect) > 0.001) {
            this.camera.aspect = aspect;
            this.camera.fov = aspect < 1.2 ? 58 : 42;
            this.camera.updateProjectionMatrix();
        }
    }

    render() {
        this.resize();
        if (this.view.present) this.view.present(this.scene, this.camera);
        else this.view.renderer.render(this.scene, this.camera);
    }
}
