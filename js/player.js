import {
    RUN, GRAVITY, JUMP, MAX_FALL, POUND_SPEED, DASH_SPEED, STAMINA_MAX, PW, PH, PLAYER_HP,
    COYOTE, JUMP_BUFFER, CORNER_NUDGE
} from './config.js';
import { Sfx } from './audio.js';
import { actionCodes } from './core.js';

export function createPlayer(x, y) {
    return {
        x, y, vx: 0, vy: 0, facing: 1, onGround: false, coyote: 0, jumpBuf: 0,
        dashes: 1, dashTimer: 0, dashDir: { x: 1, y: 0 }, stamina: STAMINA_MAX, grabbing: false,
        lock: 0, dead: false, deadTimer: 0, jumping: false, squash: 1, wasGround: false,
        doubleJumpAvailable: true, groundPounding: false, poundHang: 0,
        hp: PLAYER_HP, iframes: 0, hurtTimer: 0, landTimer: 0, spin: 0, climbing: 0, riding: null,
        stepTimer: 0, trailTimer: 0, sliding: false
    };
}

export function resetPlayerMotion(p, maxDashes) {
    p.vx = p.vy = 0;
    p.dead = false;
    p.dashes = maxDashes;
    p.dashTimer = 0;
    p.stamina = STAMINA_MAX;
    p.grabbing = false;
    p.sliding = false;
    p.lock = 0;
    p.doubleJumpAvailable = true;
    p.groundPounding = false;
    p.poundHang = 0;
    p.hp = PLAYER_HP;
    p.iframes = 0;
    p.hurtTimer = 0;
    p.riding = null;
    p.jumping = false;
}

function readControls(input, locked) {
    if (locked) return { ix: 0, iy: 0, jumpHit: false, jumpHeld: false, dashHit: false, grabHeld: false };
    return {
        ix: input.x,
        iy: input.y,
        jumpHit: input.hit(...actionCodes('jump')),
        jumpHeld: input.down(...actionCodes('jump')),
        dashHit: input.hit(...actionCodes('dash')),
        grabHeld: input.down(...actionCodes('grab'))
    };
}

function isWall(world, p, dir, yoff = 0, h = PH) {
    return world.hits(p.x + dir * 0.12, p.y + yoff, PW, h);
}

function startDash(game, p, ix, iy) {
    let dx = ix;
    let dy = iy;
    if (dx === 0 && dy === 0) dx = p.facing;
    const len = Math.hypot(dx, dy);
    p.dashDir = { x: dx / len, y: dy / len };
    p.dashes--;
    p.dashTimer = game.abilities.dashTime();
    game.abilities.onDash();
    p.grabbing = false;
    p.groundPounding = false;
    p.jumpBuf = 0;
    p.lock = 0;
    game.hitstop(0.04);
    game.shake(0.3);
    Sfx.dash();
}

function breakCracksAhead(game, p) {
    const reach = 0.3;
    const x1 = Math.floor(p.x - PW / 2 + Math.min(0, p.dashDir.x) * reach);
    const x2 = Math.floor(p.x + PW / 2 + Math.max(0, p.dashDir.x) * reach);
    const y1 = Math.floor(p.y + Math.min(0, p.dashDir.y) * reach);
    const y2 = Math.floor(p.y + PH + Math.max(0, p.dashDir.y) * reach);
    for (let ty = y1; ty <= y2; ty++) {
        for (let tx = x1; tx <= x2; tx++) {
            if (game.world.cell(tx, ty) === 'X') game.breakCell(tx, ty);
        }
    }
}

function updateDash(game, p, dt, c, grounded) {
    p.dashTimer -= dt;
    p.vx = p.dashDir.x * DASH_SPEED;
    p.vy = p.dashDir.y * DASH_SPEED;
    game.view.emit(p.x, p.y + 0.45, 0x5ab8ff, 1, 1.5, 0.3);
    if (c.jumpHit || p.jumpBuf > 0) {
        if (grounded && p.dashDir.y <= 0 && p.dashDir.x !== 0) {
            p.dashTimer = 0;
            p.vy = JUMP * 0.9;
            p.vx = p.dashDir.x * RUN * 1.9;
            p.jumpBuf = 0;
            p.jumping = true;
            p.squash = 1.3;
            Sfx.jump();
            return false;
        }
    }
    breakCracksAhead(game, p);
    const hitX = game.world.moveAxis(p, 'x', p.vx * dt);
    const hitY = game.world.moveAxis(p, 'y', p.vy * dt);
    if (hitX) p.vx = 0;
    if (hitY) p.vy = 0;
    if (hitX && p.dashDir.y === 0) p.dashTimer = 0;
    if (hitY && p.dashDir.y < 0) p.dashTimer = 0;
    if (p.dashTimer <= 0) {
        p.vx *= 0.5;
        p.vy *= 0.4;
    }
    return true;
}

function tryJump(game, p, c, grounded, wallDir) {
    if (p.jumpBuf <= 0) return;
    if (game.hasSkill('ground_pound') && !grounded && c.iy < 0 && p.coyote <= 0 && !p.grabbing) {
        p.groundPounding = true;
        p.poundHang = 0.07;
        p.vx = 0;
        p.vy = 0;
        p.jumpBuf = 0;
        p.spin = 1;
        Sfx.dash();
        return;
    }
    if (p.coyote > 0) {
        const rider = p.riding;
        p.vy = JUMP + (rider ? Math.max(0, rider.vy) : 0);
        if (rider) p.vx += rider.vx;
        p.jumping = true;
        p.coyote = 0;
        p.jumpBuf = 0;
        p.squash = 1.3;
        p.riding = null;
        Sfx.jump();
        game.view.emit(p.x, p.y, 0xffffff, 5, 3, 0.3);
    } else if (wallDir !== 0) {
        p.vy = JUMP * 0.95;
        p.vx = -wallDir * RUN;
        p.facing = -wallDir;
        p.lock = 0.15;
        p.jumping = true;
        p.jumpBuf = 0;
        p.grabbing = false;
        p.squash = 1.25;
        Sfx.wallJump();
        game.view.emit(p.x + wallDir * 0.35, p.y + 0.5, 0xffffff, 6, 3, 0.3);
    } else if (game.hasSkill('double_jump') && p.doubleJumpAvailable && !grounded) {
        p.vy = JUMP * 0.9;
        p.doubleJumpAvailable = false;
        p.jumpBuf = 0;
        p.jumping = true;
        p.squash = 1.2;
        p.spin = 1;
        Sfx.doubleJump();
        game.view.emit(p.x, p.y, 0x3bc7ff, 8, 3.5, 0.35);
    }
}

function nudgeAroundCorner(world, p) {
    for (const d of [CORNER_NUDGE, -CORNER_NUDGE]) {
        if (!world.hits(p.x + d, p.y + 0.06)) {
            p.x += d;
            return true;
        }
    }
    return false;
}

export function updatePlayer(game, p, dt) {
    const world = game.world;
    const c = readControls(game.input, game.finished || game.cutscene || p.hurtTimer > 0);
    if (c.jumpHit) p.jumpBuf = JUMP_BUFFER;
    else p.jumpBuf -= dt;
    p.lock -= dt;
    p.iframes = Math.max(0, p.iframes - dt);
    p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    p.landTimer = Math.max(0, p.landTimer - dt);
    p.spin = Math.max(0, p.spin - dt * 3);

    const grounded = world.hits(p.x, p.y - 0.05);
    p.onGround = grounded;
    if (grounded) {
        p.coyote = COYOTE;
        if (p.dashTimer <= 0) {
            p.dashes = game.maxDashes();
            if (game.abilities.staminaLock <= 0) p.stamina = STAMINA_MAX;
        }
        if (!p.wasGround) {
            p.squash = 0.7;
            p.landTimer = 0.14;
            Sfx.land();
            game.view.emit(p.x, p.y, 0xffffff, 6, 3, 0.35);
        }
        p.doubleJumpAvailable = true;
    } else p.coyote -= dt;
    p.wasGround = grounded;
    if (c.ix !== 0 && p.lock <= 0) p.facing = c.ix;

    if (c.dashHit && p.dashes > 0 && p.dashTimer <= 0) startDash(game, p, c.ix, c.iy);
    if (p.dashTimer > 0 && updateDash(game, p, dt, c, grounded)) {
        p.grabbing = false;
        return;
    }

    if (p.groundPounding) {
        updatePound(game, p, dt);
        return;
    }

    const wallDir = isWall(world, p, 1) ? 1 : isWall(world, p, -1) ? -1 : 0;
    p.grabbing = !grounded && wallDir !== 0 && c.grabHeld && p.stamina > 0;
    p.climbing = 0;

    if (p.grabbing) {
        p.vx = 0;
        p.vy = c.iy > 0 ? 4 : c.iy < 0 ? -6 : 0;
        p.climbing = c.iy;
        p.stamina -= dt * (c.iy > 0 ? 1.6 : 0.6) * game.abilities.staminaScale();
        p.facing = wallDir;
        if (c.iy > 0 && !isWall(world, p, wallDir, PH * 0.7, PH * 0.3) && isWall(world, p, wallDir, 0, PH * 0.4)) {
            p.vy = 9;
            p.vx = wallDir * 2.5;
            p.grabbing = false;
            p.lock = 0.1;
        }
    } else if (p.lock <= 0) {
        const target = c.ix * RUN;
        const accel = grounded ? 90 : 55;
        if (Math.abs(p.vx) > RUN && Math.sign(p.vx) === c.ix) p.vx -= Math.sign(p.vx) * 20 * dt;
        else p.vx += Math.max(-accel * dt, Math.min(accel * dt, target - p.vx));
    } else {
        p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), 8 * dt);
    }

    tryJump(game, p, c, grounded, wallDir);
    if (p.groundPounding) return;

    p.sliding = false;
    if (!p.grabbing) {
        let g = GRAVITY;
        if (p.vy > 0 && !c.jumpHeld && p.jumping) g *= 2.2;
        if (Math.abs(p.vy) < 2.5 && c.jumpHeld) g *= 0.55;
        p.vy -= g * dt;
        if (p.vy < -MAX_FALL) p.vy = -MAX_FALL;
        if (wallDir !== 0 && c.ix === wallDir && p.vy < -3) {
            p.vy = -3;
            p.sliding = true;
        }
    }
    game.abilities.glide(p, c.jumpHeld, dt);
    if (p.vy <= 0) p.jumping = false;

    if (world.moveAxis(p, 'x', p.vx * dt)) p.vx = 0;
    if (world.moveAxis(p, 'y', p.vy * dt)) {
        if (p.vy > 0 && nudgeAroundCorner(world, p)) return;
        if (p.vy > 0) p.jumping = false;
        p.vy = 0;
    }

    if (grounded && Math.abs(p.vx) > 2) {
        p.stepTimer -= dt * Math.abs(p.vx);
        if (p.stepTimer <= 0) {
            p.stepTimer = 2.8;
            Sfx.step();
        }
    }
    if (p.y < -4) game.kill('fall');
}

function updatePound(game, p, dt) {
    if (p.poundHang > 0) {
        p.poundHang -= dt;
        return;
    }
    p.vy = -POUND_SPEED;
    if (game.world.moveAxis(p, 'y', p.vy * dt)) {
        p.vy = 0;
        game.poundImpact();
    }
    if (p.y < -4) game.kill('fall');
}

export function playerPose(p) {
    if (p.dead) return 'dead';
    if (p.hurtTimer > 0) return 'hurt';
    if (p.groundPounding) return 'pound';
    if (p.dashTimer > 0) return 'dash';
    if (p.grabbing) return p.climbing !== 0 ? 'climb' : 'grab';
    if (p.sliding) return 'slide';
    if (p.gliding) return 'glide';
    if (!p.onGround) {
        if (p.spin > 0) return 'spin';
        return p.vy > 0 ? 'jump' : 'fall';
    }
    if (p.landTimer > 0 && Math.abs(p.vx) < 3) return 'land';
    const speed = Math.abs(p.vx);
    if (speed > 5.5) return 'run';
    if (speed > 0.6) return 'walk';
    return 'idle';
}
