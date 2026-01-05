/* =========================================================
   entities.js
   - Entity Logic (Player, Enemies, Boss, Bullets, Drops)
   ========================================================= */

function setWeapon(key) {
    if (!BULLET_TYPES[key]) return;
    state.player.weaponKey = key;

    // weapon 可能覆蓋射速
    const w = BULLET_TYPES[key];
    state.player.shootCd = w.shootCd ?? PLAYER_DATA.baseShootCd;

    // 切換時稍微重置射擊冷卻避免連發 bug
    state.player.shootTimer = Math.min(state.player.shootTimer, state.player.shootCd);
}

function pickEnemyTypeKey() {
    return ENEMY_POOL[(Math.random() * ENEMY_POOL.length) | 0];
}

function spawnEnemy() {
    const typeKey = pickEnemyTypeKey();
    const t = ENEMY_TYPES[typeKey];

    // 從畫面外圍生成
    const pad = 60;
    const side = (Math.random() * 4) | 0;
    let x, y;
    if (side === 0) { x = rand(-pad, canvas.width + pad); y = -pad; }
    if (side === 1) { x = canvas.width + pad; y = rand(-pad, canvas.height + pad); }
    if (side === 2) { x = rand(-pad, canvas.width + pad); y = canvas.height + pad; }
    if (side === 3) { x = -pad; y = rand(-pad, canvas.height + pad); }

    state.enemies.push({
        typeKey,
        x, y,
        r: t.radius,
        speed: t.speed,
        hp: t.hp,
        maxHP: t.hp,
        damage: t.damage,
        score: t.score,
        color: t.color,
        hitCooldown: 0, // 被打後短暫閃爍
    });
}

function spawnEnemyLaserFromBossCore(b, angle) {
    const core = getBossCorePos(b);

    state.enemyLasers.push({
        x: core.x,
        y: core.y,
        angle: angle,

        length: 900,
        width: 10,
        dps: 1.2,
        duration: 900,
        time: 0,
        color: "red",
    });
}

function spawnEnemyLaser(x, y, angle) {
    state.enemyLasers.push({
        x: x,
        y: y,
        angle: angle,

        length: 800,
        width: 8,
        dps: 1,
        duration: 180,
        time: 0,

        moveAngle: 0,
        color: "rgba(255,0,0,0.95)", // ✅ 補上顏色
    });
}

function laserHitPlayer(laser, dt) {
    const p = state.player;

    // 雷射起點
    const x1 = laser.x;
    const y1 = laser.y;

    // 雷射終點
    const x2 = x1 + Math.cos(laser.angle) * laser.length;
    const y2 = y1 + Math.sin(laser.angle) * laser.length;

    // 玩家到雷射線段距離
    const dist = pointToSegmentDistance(
        p.x,
        p.y,
        x1,
        y1,
        x2,
        y2
    );

    if (dist <= laser.width / 2 + p.r) {
        const damage = laser.dps * (dt / 1000);
        p.hp -= damage * (1 - p.damageReduction);
    }
}

function angleToMouse() {
    const p = state.player;
    return Math.atan2(state.mouse.y - p.y, state.mouse.x - p.x);
}

function shoot(dt) {
    const p = state.player;
    p.shootTimer -= dt;
    if (!isShootDown()) return;
    if (p.shootTimer > 0) return;

    const w = BULLET_TYPES[p.weaponKey];
    p.shootTimer = p.shootCd;

    const ang = angleToMouse();

    if (p.weaponKey === "spread") {
        const pellets = w.pellets ?? 5;
        for (let i = 0; i < pellets; i++) {
            const offset = rand(-w.spreadAngle, w.spreadAngle);
            spawnBullet(ang + offset, w);
        }
        return;
    }

    if (p.weaponKey === "laser") {
        state.lasers.push({
            x: p.x,
            y: p.y,
            ang,
            length: w.length,
            width: w.width,
            dps: w.dps,
            timeLeft: w.duration,
        });
        return;
    }

    // normal / explosive
    spawnBullet(ang, w);
}

function spawnBullet(ang, w) {
    const p = state.player;
    const vx = Math.cos(ang) * w.speed;
    const vy = Math.sin(ang) * w.speed;
    state.bullets.push({
        x: p.x,
        y: p.y,
        vx, vy,
        r: w.radius,
        damage: w.damage,
        pierce: w.pierce ?? 0,
        timeLeft: w.lifetime,
        typeKey: w.key,
        exploded: false,
    });
}

function trySprayDrop(entity, chance, cooldown, sprayOptions = {}) {
    if (!entity) return;
    if (entity.dropCooldown > 0) return;

    if (Math.random() < chance) {
        // ⭐ 在這裡決定噴射位置
        const pos = getSprayDropPos(
            entity.x,
            entity.y,
            sprayOptions
        );
        trySpawnDrop(pos.x, pos.y);
        entity.dropCooldown = cooldown;
    }
}

function getEliteBarrelMuzzle(e, sideOffset) {
    const p = state.player;

    // 朝向玩家
    const ang = Math.atan2(p.y - e.y, p.x - e.x);

    // 垂直方向（左右砲管偏移）
    const px = Math.cos(ang + Math.PI / 2);
    const py = Math.sin(ang + Math.PI / 2);

    // 砲管起點
    const sx =
        e.x +
        px * sideOffset +
        Math.cos(ang) * (e.r * 0.55);
    const sy =
        e.y +
        py * sideOffset +
        Math.sin(ang) * (e.r * 0.55);

    // 砲口位置
    const len = 28;
    const mx = sx + Math.cos(ang) * len;
    const my = sy + Math.sin(ang) * len;

    return { x: mx, y: my, angle: ang };
}

function updateElite(dt) {
    const p = state.player;
    const e = state.elite;

    // 強制進場（還沒完全進畫面前）
    if (e.y < e.r + 20) {
        e.y += 2.2;
        return;
    }

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy);

    // === 雷射鎖定中：不能動、不能射 ===
    if (e.laserLockTime > 0) {
        e.laserLockTime -= dt;
        if (e.laserLockTime < 0) e.laserLockTime = 0;
        return;
    }

    // 移動（蓄力時停下）
    if (!e.charging && d > 1) {
        e.x += (dx / d) * ELITE_DATA.speed;
        e.y += (dy / d) * ELITE_DATA.speed;
    }

    // === 玩家接觸菁英怪傷害 ===
    //const p = state.player;
    const rr = e.r + p.r;

    const push = pushCircleOut(p.x, p.y, p.r, e.x, e.y, e.r);
    if (push) {
        p.x = push.x;
        p.y = push.y;
    }


    if (dist2(e.x, e.y, p.x, p.y) <= rr * rr) {
        if (e.contactCooldown <= 0) {
            const dmg = e.contactDamage * (1 - p.damageReduction);
            p.hp -= dmg;
            e.contactCooldown = 600; // 0.6 秒冷卻
        }
    }

    if (e.contactCooldown > 0) {
        e.contactCooldown -= dt;
    }

    e.shootTimer -= dt;

    // 普通射擊
    if (!e.charging && e.shootTimer <= 0) {
        fireEliteBullet(e);
        e.shootTimer = ELITE_DATA.shootCd;
    }

    // 隨機進入必殺
    if (!e.charging && Math.random() < 0.002) {
        e.charging = true;
        e.laserTimer = ELITE_DATA.laserChargeTime;
    }

    // 蓄力中
    if (e.charging) {
        e.laserTimer -= dt;
        if (e.laserTimer <= 0) {
            fireEliteLaser(e);
            e.charging = false;
            e.laserTimer = ELITE_DATA.laserDuration;
        }
    }
}

function updateBoss(dt) {
    const b = state.boss;
    if (!b) return;

    b.stateTimer -= dt;

    switch (b.attackState) {

        case "idle":
            if (b.stateTimer <= 0) {
                chooseNextBossAttack(b);
            }
            break;

        case "tripleShot":
            updateBossTripleShot(b, dt);
            break;

        case "fanSweep":
            updateBossFanSweep(b, dt);
            break;

        case "laserCharge": {
            // 蓄力狀態
            b.charging = true;

            if (b.stateTimer <= 0) {
                b.charging = false;

                // 清掉警告提示
                state.bossWarnings.length = 0;

                // ⭐ 根據「已決定」的雷射種類執行
                if (b.pendingLaser === "clamp") {
                    fireBossFanClampLasers(b);
                    b.attackState = "laserVertical";
                    b.stateTimer = 2200;
                } else if (b.pendingLaser === "core") {
                    fireBossCoreLaser(b);
                    b.attackState = "laserCore";
                    b.stateTimer = 1600;
                }

                // 用完就清，避免殘留
                b.pendingLaser = null;
            }
            break;
        }


        case "laserVertical":
            updateBossVerticalLaser(b, dt);
            break;

        case "laserCore":
            updateBossCoreLaser(b, dt);
            break;
    }

    if (b.shakeTime > 0) {
        b.shakeTime -= dt;
        if (b.shakeTime < 0) b.shakeTime = 0;
    }
}

function updateBossVerticalLaser(b, dt) {
    // 這個狀態期間 Boss 不要亂動（你想要雷射結束才動）
    b.canMove = false;

    // 雷射物件本身會在 updateEnemyLasers() 裡自己倒數/移動/消失
    // 這裡只要等時間到就回 idle
    if (b.stateTimer <= 0) {
        b.canMove = true;
        b.attackState = "idle";
        b.stateTimer = 900; // 下一次攻擊前的喘息時間
    }
}

function updateBossCoreLaser(b, dt) {
    b.canMove = false;

    if (b.stateTimer <= 0) {
        b.canMove = true;
        b.attackState = "idle";
        b.stateTimer = 900;
    }
}

function updateBossTripleShot(b, dt) {
    // 每隔一段時間射一次三連發
    b.attackCooldown -= dt;

    if (b.attackCooldown <= 0) {
        fireBossTripleShot(b);
        b.attackCooldown = 320; // 每 320ms 射一次（你可調 260~420）
    }

    // 狀態時間到就回 idle（留喘息）
    if (b.stateTimer <= 0) {
        b.attackState = "idle";
        b.stateTimer = 700;     // 攻擊間隔喘息
        b.attackCooldown = 0;   // 重置
    }
}

function updateBossFanSweep(b, dt) {
    // 初始化（第一次進 fanSweep）
    if (!b.sweepInit) {
        b.sweepInit = true;
        b.sweepDir = 1;                 // 1 or -1 來回
        b.sweepAngle = getBossAimAngleLeftOnly(b) - 0.7;        // 起始偏左
        b.sweepSpeed = 0.010;            // 掃射角速度（越小越好躲）
        b.sweepSpread = 0.35;            // 每次三發之間角度差
        b.attackCooldown = 0;            // 用同一套冷卻
    }

    // 射擊冷卻
    b.attackCooldown -= dt;
    if (b.attackCooldown <= 0) {
        // 每次噴 3 發，但「每次間隔」要留空隙
        for (let i = -1; i <= 1; i++) {
            const ang = b.sweepAngle + i * b.sweepSpread;

            // ⭐ 防止往後射 (X 軸速度不能為正，或稍寬容一點)
            if (Math.cos(ang) > 0.1) continue;

            const core = getBossCorePos(b);

            state.enemyBullets.push({
                x: core.x,
                y: core.y,
                vx: Math.cos(ang) * 4.2,
                vy: Math.sin(ang) * 4.2,
                r: 9,
                damage: 1.2,
            });
        }
        b.attackCooldown = 140; // 子彈間隔：調大更好躲（例如 140~220）
    }

    // 掃射角度來回
    b.sweepAngle += b.sweepSpeed * b.sweepDir * dt;

    // 到邊界就換方向（這裡控制扇形「來回」）
    const centerAng = getBossAimAngleLeftOnly(b);
    const leftBound = centerAng - 0.9;
    const rightBound = centerAng + 0.9;

    if (b.sweepAngle < leftBound) b.sweepDir = 1;
    if (b.sweepAngle > rightBound) b.sweepDir = -1;

    // 狀態結束就回 idle
    if (b.stateTimer <= 0) {
        b.attackState = "idle";
        b.stateTimer = 700;
        b.sweepInit = false;
    }
}

function trySpawnDrop(x, y) {
    for (const key in DROP_TYPES) {
        const d = DROP_TYPES[key];
        if (Math.random() < d.chance) {

            // ⭐ 移除場上同類型掉落物
            for (let i = state.drops.length - 1; i >= 0; i--) {
                if (state.drops[i].typeKey === key) {
                    state.drops.splice(i, 1);
                }
            }

            state.drops.push({
                x,
                y,
                size: 28,              // 正方形邊長
                weaponKey: d.weaponKey,
                typeKey: key,          // ⭐ spread / laser / explosive
                color: d.color,
            });
            break; // 一次只掉一個
        }
    }
}

function gainExp(amount) {
    const p = state.player;
    p.exp += amount;

    while (p.exp >= p.expToNext) {
        p.exp -= p.expToNext;
        p.level += 1;
        p.expToNext = calcExpToNext(p.level);

        // 每 5 級進入卡牌選擇
        if (p.level % 1 === 0) {
            enterCardSelect();
            break; // 卡牌選擇期間不再連續升級
        }
    }
}

function getAvailableCards() {
    const p = state.player;
    return [
        ...PLAYER_CARD_POOL,
        ...WEAPON_CARD_POOL
    ].filter(card => card.canAppear(p));
}

function drawCards(count = 3) {
    const pool = getAvailableCards();
    const result = [];

    while (pool.length > 0 && result.length < count) {
        const idx = Math.floor(Math.random() * pool.length);
        result.push(pool.splice(idx, 1)[0]);
    }

    return result;
}

function enterCardSelect() {
    const cards = drawCards(3);

    // ⭐ 如果真的沒卡可選，直接跳過卡牌階段
    if (cards.length === 0) {
        state.mode = "play";
        state.paused = false;
        return;
    }

    state.mode = "card";
    state.paused = true;
    state.currentCards = cards;
    state.cardUI = state.currentCards.map(() => ({
        scale: 1,
        lift: 0,
        glow: 0,
    }));

}

function chooseCard(index) {
    const card = state.currentCards[index];
    if (!card) return;

    // 套用效果
    card.apply(state.player);

    state.currentCards = [];

    // === 還有剩餘抽卡次數 ===
    if (state.postEliteCardCount > 1) {
        state.postEliteCardCount -= 1;
        rollCards();        // ⭐ 再抽一次
        return;             // 留在 card mode
    }

    // === 抽卡結束 ===
    state.postEliteCardCount = 0;
    state.mode = "play";
    state.paused = false;
}

function rollCards() {
    state.currentCards = drawCards(3);

    // 如果真的沒有卡可選，直接回遊戲
    if (state.currentCards.length === 0) {
        state.mode = "play";
        state.paused = false;
        state.postEliteCardCount = 0;
        return;
    }

    state.cardUI = state.currentCards.map(() => ({
        scale: 1,
        lift: 0,
        glow: 0,
    }));
}

function bulletHitEnemies() {
    for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
        const b = state.bullets[bi];
        // === 子彈先檢查 Boss ===
        if (state.boss) {
            const boss = state.boss;

            // =========================
            // 1️⃣ 外殼還在 → 打矩形
            // =========================
            if (boss.shellStage < 2) {
                const rx = boss.x - BOSS_DATA.width / 2;
                const ry = boss.y - BOSS_DATA.height / 2;
                const rw = BOSS_DATA.width;
                const rh = BOSS_DATA.height;

                if (circleRectHit(b.x, b.y, b.r, rx, ry, rw, rh)) {
                    const dmg = (b.typeKey === "explosive")
                        ? BULLET_TYPES.explosive.directDamage
                        : b.damage;

                    boss.shellHP -= dmg;
                    boss.hp -= dmg;

                    trySprayDrop(boss, 0.30, 1600, {
                        minDist: boss.shellStage < 2
                            ? BOSS_DATA.width / 2 + 60
                            : BOSS_DATA.coreRadius + 30,
                        maxDist: 420,
                        minAngle: -0.6,
                        maxAngle: 0.6,
                        baseAngle: Math.PI, // 左側
                    });

                    if (b.typeKey === "explosive" && !b.exploded) {
                        b.exploded = true;
                        state.pendingExplosions.push({
                            x: b.x,
                            y: b.y,
                            weapon: BULLET_TYPES.explosive
                        });
                    }


                    // 只有外殼階段才震
                    boss.shakeTime = 120;
                    boss.shakePower = 6;

                    state.bullets.splice(bi, 1);

                    const ratio = boss.hp / boss.maxHP;

                    // 外殼開始裂（80%）
                    if (ratio <= 0.8 && boss.shellStage === 0) {
                        boss.shellStage = 1;
                        generateShellCracks(boss);
                    }

                    // 外殼完全碎裂（50%）
                    if (ratio <= 0.5 && boss.shellStage === 1) {
                        boss.shellStage = 2;

                        // 殼碎，停止震動
                        boss.shakeTime = 0;
                        boss.shakePower = 0;

                        // 裂痕清空（殼都沒了就別畫了）
                        boss.cracks = [];
                    }

                    continue;
                }
            }

            // 外殼碎了 → 只打核心
            else {
                const rr = b.r + BOSS_DATA.coreRadius;
                if (dist2(b.x, b.y, boss.x, boss.y) <= rr * rr) {

                    const dmg = (b.typeKey === "explosive")
                        ? BULLET_TYPES.explosive.directDamage
                        : b.damage;

                    boss.hp -= dmg;

                    // ⭐ 你如果也想核心被打會噴掉落物，就放這（下面第2段我會教怎麼噴更遠）
                    trySprayDrop(boss, 0.30, 1600, {
                        minDist: BOSS_DATA.coreRadius + 80,
                        maxDist: 420,
                        minAngle: -0.9,
                        maxAngle: 0.9,
                        baseAngle: Math.PI, // 往左扇形
                    });

                    state.bullets.splice(bi, 1);
                    continue;
                }
            }
            if (boss.hp <= 0) {
                state.stats.killBoss += 1;
                enterVictory();
                return;
            }

        }


        // === 子彈先檢查菁英怪 ===
        if (state.elite) {
            const e = state.elite;
            const rr = b.r + e.r;

            if (dist2(b.x, b.y, e.x, e.y) <= rr * rr) {

                const dmg = (b.typeKey === "explosive")
                    ? BULLET_TYPES.explosive.directDamage
                    : b.damage;
                // 傷害
                e.hp -= dmg;

                // 爆炸彈觸發爆炸
                if (b.typeKey === "explosive" && !b.exploded) {
                    b.exploded = true;
                    state.pendingExplosions.push({
                        x: b.x,
                        y: b.y,
                        weapon: BULLET_TYPES.explosive
                    });
                }

                // 移除子彈
                state.bullets.splice(bi, 1);

                // ⭐ 命中時噴掉落物
                trySprayDrop(e, 0.30, 1200, {
                    minDist: 40,
                    maxDist: 90,
                    minAngle: -Math.PI,
                    maxAngle: Math.PI,
                    baseAngle: 0,
                }); // ⭐ 30%

                // 菁英死亡
                if (e.hp <= 0) {
                    killElite();
                }

                continue; // 這顆子彈處理完了
            }
        }

        for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
            const e = state.enemies[ei];
            const rr = b.r + e.r;

            if (dist2(b.x, b.y, e.x, e.y) <= rr * rr) {

                // === 傷害處理 ===
                if (b.typeKey === "explosive") {
                    e.hp -= BULLET_TYPES.explosive.directDamage;

                    // ⭐ 爆炸只排一次，且立刻移除子彈
                    if (!b.exploded) {
                        b.exploded = true;
                        state.pendingExplosions.push({
                            x: b.x,
                            y: b.y,
                            weapon: BULLET_TYPES.explosive
                        });
                    }

                    // 爆炸彈命中即消失（不穿透）
                    state.bullets.splice(bi, 1);

                } else {
                    // 非爆炸彈
                    e.hp -= b.damage;
                    e.hitCooldown = 80;

                    if (b.pierce > 0) {
                        b.pierce -= 1;
                    } else {
                        state.bullets.splice(bi, 1);
                    }
                }

                // === 敵人死亡 ===
                if (e.hp <= 0) {
                    state.score += e.score;
                    gainExp(e.score);
                    trySpawnDrop(e.x, e.y);
                    state.stats.killEnemy += 1;
                    state.enemies.splice(ei, 1);
                }

                // ⭐ 命中後，這顆子彈的工作結束
                break;
            }
        }
    }
}

function explodeAt(x, y, w) {
    // === 視覺特效（與判定半徑完全一致）
    state.explosions.push({
        x,
        y,
        radius: w.explosionRadius,
        time: 0,
        duration: 260,
    });

    const maxR = w.explosionRadius;
    const maxR2 = maxR * maxR;

    for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
        const e = state.enemies[ei];
        const d2 = dist2(x, y, e.x, e.y);

        if (d2 <= maxR2) {
            const d = Math.sqrt(d2);

            // 0（中心） → 1（邊緣）
            const t = d / maxR;

            // 傷害衰減（線性）
            const falloff =
                w.minFalloff + (1 - w.minFalloff) * (1 - t);

            const dmg = w.explosionDamage * falloff;

            e.hp -= dmg;
            e.hitCooldown = 120;

            if (e.hp <= 0) {
                state.score += e.score;
                gainExp(e.score);
                trySpawnDrop(e.x, e.y);
                state.enemies.splice(ei, 1);
            }
        }
    }
}

function laserHitEnemies(dt) {
    if (state.lasers.length === 0) return;

    // 簡化：把雷射看成一條線段，敵人中心到線段距離 < (敵人半徑 + 雷射寬度/2) 就受傷
    for (const l of state.lasers) {
        const damageThisFrame = (l.dps * dt) / 1000;

        const x1 = l.x;
        const y1 = l.y;
        const x2 = x1 + Math.cos(l.ang) * l.length;
        const y2 = y1 + Math.sin(l.ang) * l.length;

        for (let ei = state.enemies.length - 1; ei >= 0; ei--) {
            const e = state.enemies[ei];
            const d = pointToSegmentDistance(e.x, e.y, x1, y1, x2, y2);
            if (d <= e.r + l.width / 2) {
                e.hp -= damageThisFrame;
                e.hitCooldown = 40;
                if (e.hp <= 0) {
                    state.score += e.score;
                    gainExp(e.score);              // ⭐ 補經驗
                    trySpawnDrop(e.x, e.y);        // ⭐ 補掉落
                    state.stats.killEnemy += 1;
                    state.enemies.splice(ei, 1);
                }
            }
        }

        // === 雷射打菁英 ===
        if (state.elite) {
            const e = state.elite;
            const d = pointToSegmentDistance(e.x, e.y, x1, y1, x2, y2);
            if (d <= e.r + l.width / 2) {
                e.hp -= damageThisFrame;
                trySprayDrop(e, 0.30, 1200);
                if (e.hp <= 0) {
                    killElite();
                }
            }
        }

        // === 雷射打 Boss（只打核心）===
        if (state.boss && state.boss.shellStage >= 2) {
            const b = state.boss;
            const d = pointToSegmentDistance(b.x, b.y, x1, y1, x2, y2);
            if (d <= BOSS_DATA.coreRadius + l.width / 2) {
                b.hp -= damageThisFrame;
                trySprayDrop(b, 0.30, 1200);
            }
        }
    }
}

function triggerEliteWarning() {
    // 清場 (敵方單位與投射物)
    state.enemies.length = 0;
    state.drops.length = 0;
    if (state.enemyBullets) state.enemyBullets.length = 0;
    if (state.enemyLasers) state.enemyLasers.length = 0;

    state.mode = "eliteWarning";
    state.warningTimer = 1500; // ms
}

function triggerBossWarning() {
    // 清場 (敵方單位與投射物)
    state.enemies.length = 0;
    state.drops.length = 0;
    if (state.enemyBullets) state.enemyBullets.length = 0;
    if (state.enemyLasers) state.enemyLasers.length = 0;

    state.mode = "bossWarning";
    state.warningTimer = 1800; // 1.8s
}

function spawnElite() {
    const p = state.player;

    state.elite = {
        x: canvas.width / 2,
        y: -100,
        r: ELITE_DATA.radius,

        hp: ELITE_DATA.maxHP,
        maxHP: ELITE_DATA.maxHP,

        shootTimer: 0,
        laserTimer: 0,
        charging: false,

        barrelAngle: 0,

        fireSide: 1,
        laserLockTime: 0, // 雷射鎖定剩餘時間

        contactDamage: 1,
        contactCooldown: 0,

        dropCooldown: 0,

    };
}

function spawnFinalBoss() {
    // 清場（Boss 戰一定要乾淨）
    state.enemies.length = 0;
    state.drops.length = 0;

    state.boss = {
        x: canvas.width - BOSS_DATA.width / 2,
        y: canvas.height / 2,

        coreOffsetX: 0,
        coreOffsetY: 0,

        hp: BOSS_DATA.maxHP,
        maxHP: BOSS_DATA.maxHP,

        shellHP: BOSS_DATA.maxHP * 0.5,   // ⭐ 外殼血量
        shellStage: 0,              // 0 → 1 → 2

        cracks: [],
        shakeTime: 0,
        shakePower: 0,

        phase: 1,
        // ⭐ 攻擊狀態機
        attackState: "idle",
        stateTimer: 1200,      // 當前狀態剩餘時間

        // 共用
        attackCooldown: 0,

        // 掃射用
        sweepAngle: 0,
        sweepDir: 1,

        // 雷射用
        charging: false,

        dropCooldown: 0,
    };

    // Boss 戰期間暫停倒數
    state.paused = false;
}

function fireEliteBullet(e) {
    const barrelOffset = 22;

    // 左右輪流
    e.fireSide = e.fireSide === 1 ? -1 : 1;
    const side = e.fireSide || 1;

    const muzzle = getEliteBarrelMuzzle(e, barrelOffset * side);
    spawnEnemyBullet(muzzle.x, muzzle.y, muzzle.angle);
}

function spawnEnemyBullet(x, y, angle) {
    state.enemyBullets.push({
        x,
        y,
        vx: Math.cos(angle) * ELITE_DATA.bulletSpeed,
        vy: Math.sin(angle) * ELITE_DATA.bulletSpeed,
        r: 6,
        damage: 1,
    });
}

function fireEliteLaser(e) {
    const barrelOffset = 22;

    const left = getEliteBarrelMuzzle(e, -barrelOffset);
    const right = getEliteBarrelMuzzle(e, barrelOffset);

    spawnEnemyLaser(left.x, left.y, left.angle);
    spawnEnemyLaser(right.x, right.y, right.angle);


    // ⭐ 雷射存在多久，菁英就鎖多久
    e.laserLockTime = ELITE_DATA.laserDuration;
}

function killElite() {
    state.stats.killElite += 1;
    // ⭐ 清掉菁英殘留攻擊
    state.enemyLasers.length = 0;
    state.enemyBullets.length = 0;
    state.elite = null;

    state.postEliteCardCount = 2; // 要抽 2 次

    state.mode = "card";
    state.paused = true;

    rollCards(); // ⭐ 第一次抽牌
}

function fireBossTripleShot(boss) {
    const p = state.player;

    // 砲口：Boss 左側稍微伸出（視覺會像從武器射出）
    const muzzleX = boss.x - BOSS_DATA.width / 2 + 18;
    const muzzleY = boss.y;

    // 指向玩家
    let ang = Math.atan2(p.y - muzzleY, p.x - muzzleX);

    // ⭐ 限制方向：只允許「往左」扇形
    // 將角度轉換為「相對於正左 (PI)」的偏差值 [-PI, PI]
    let diff = ang - Math.PI;
    while (diff <= -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    // 限制偏差在 maxYaw 範圍內
    // maxYaw: 0.65 (約37度) -> 0.85 (約48度)，放寬一點以免射不到角落
    const maxYaw = 0.85;
    diff = Math.max(-maxYaw, Math.min(maxYaw, diff));

    // 還原為實際角度
    ang = Math.PI + diff;

    const spread = 0.14;
    const angles = [ang - spread, ang, ang + spread];

    for (const a of angles) {
        state.enemyBullets.push({
            x: muzzleX,
            y: muzzleY,
            vx: Math.cos(a) * BOSS_DATA.normalBullet.speed,
            vy: Math.sin(a) * BOSS_DATA.normalBullet.speed,
            r: BOSS_DATA.normalBullet.radius,
            damage: BOSS_DATA.normalBullet.damage,
        });
    }
}

function fireBossFanClampLasers(boss) {
    const core = getBossCorePos(boss);

    const originX = core.x;
    const originY = core.y;
    // 以「正左」為中心，做上下兩道指針
    const center = Math.PI;

    // 初始張角（比較開）
    const startGap = 1.15;     // 上下分開的角度（越大越開）
    // 最終保留縫隙（玩家生路）
    const endGap = 0.35;       // 越小越難躲，建議 0.30~0.45

    // 每毫秒收攏角速度（dt 是 ms）
    const clampSpeed = 0.00032; // 可調：0.00025~0.00045

    // 上指針：從 center-startGap/2 往 center-endGap/2 收
    // 下指針：從 center+startGap/2 往 center+endGap/2 收
    const topStart = center - startGap / 2;
    const botStart = center + startGap / 2;

    const topEnd = center - endGap / 2;
    const botEnd = center + endGap / 2;

    const topDir = topEnd > topStart ? +1 : -1;
    const botDir = botEnd > botStart ? +1 : -1;

    // 用 moveAngle 旋轉，並用 clampTarget 保存目標，更新時會停在那
    state.enemyLasers.push({
        x: originX,
        y: originY,
        angle: topStart,
        length: canvas.width,
        width: 18,
        dps: 3.2,
        duration: 2200,
        time: 0,
        color: "rgba(255,0,0,0.95)",
        moveAngle: clampSpeed * topDir,
        clampTarget: topEnd,
    });

    state.enemyLasers.push({
        x: originX,
        y: originY,
        angle: botStart,
        length: canvas.width,
        width: 18,
        dps: 3.2,
        duration: 2200,
        time: 0,
        color: "rgba(255,0,0,0.95)",
        moveAngle: clampSpeed * botDir,
        clampTarget: botEnd,
    });
}

function fireBossCoreLaser(boss) {
    state.enemyLasers.push({
        x: boss.x,
        y: boss.y,
        angle: Math.PI,
        length: canvas.width,
        width: 60,
        dps: 4.5,
        duration: 1600,
        time: 0,
        color: "rgba(255,0,0,0.95)",
    });
}

function chooseNextBossAttack(b) {
    const roll = Math.random();

    if (roll < 0.45) {
        // 普通三連發
        b.attackState = "tripleShot";
        b.stateTimer = 1800;
        b.attackCooldown = 0;

    } else if (roll < 0.75) {
        // 扇形掃射
        b.attackState = "fanSweep";
        b.stateTimer = 2600;
        b.sweepDir = 1;

        const base = Math.atan2(
            state.player.y - b.y,
            state.player.x - b.x
        );
        b.sweepAngle = base - 0.8;

    } else {
        b.attackState = "laserCharge";
        b.stateTimer = 1500;
        b.charging = true;

        // 先決定要哪個雷射
        b.pendingLaser = Math.random() < 0.5 ? "clamp" : "core";

        // 再用正確的型別生警告
        spawnBossLaserWarning(b.pendingLaser);
    }
}

function spawnBossLaserWarning(type) {
    state.bossWarnings.length = 0; // 每次只留一個警告，避免疊加
    state.bossWarnings.push({
        type, // "clamp" 或 "core"
        time: 0,
        duration: 1500,
        blink: 0,
    });
}

function generateShellCracks(boss) {
    const w = BOSS_DATA.width;
    const h = BOSS_DATA.height;

    const crackCount = 28;        // 裂痕數量：讓快爆掉時佈滿
    const branchPerCrack = 3;     // 每條主裂痕分支數

    boss.cracks = [];

    const coreR = BOSS_DATA.coreRadius + 10; // 從核心外圍開始，不被蓋住

    // 幫你挑一個「落在矩形邊界附近」的終點
    function randomEdgePoint() {
        const side = Math.floor(rand(0, 4));
        if (side === 0) return { x: rand(-w / 2, w / 2), y: -h / 2 + rand(-8, 8) }; // top
        if (side === 1) return { x: rand(-w / 2, w / 2), y: h / 2 + rand(-8, 8) }; // bottom
        if (side === 2) return { x: -w / 2 + rand(-8, 8), y: rand(-h / 2, h / 2) }; // left
        return { x: w / 2 + rand(-8, 8), y: rand(-h / 2, h / 2) };      // right
    }

    for (let i = 0; i < crackCount; i++) {
        // 主裂痕起點：圍繞核心一圈
        const a = rand(0, Math.PI * 2);
        const x1 = Math.cos(a) * coreR;
        const y1 = Math.sin(a) * coreR;

        // 主裂痕終點：往外殼邊界飛
        const end = randomEdgePoint();
        const x2 = end.x;
        const y2 = end.y;

        // 分支：從主裂痕中間某些點岔出去
        const branches = [];
        for (let k = 0; k < branchPerCrack; k++) {
            const t = rand(0.2, 0.85);
            const mx = x1 + (x2 - x1) * t;
            const my = y1 + (y2 - y1) * t;

            const mainAng = Math.atan2(y2 - y1, x2 - x1);
            const brAng = mainAng + rand(-1.2, 1.2);
            const brLen = rand(18, 55);

            branches.push({
                x1: mx,
                y1: my,
                x2: mx + Math.cos(brAng) * brLen,
                y2: my + Math.sin(brAng) * brLen
            });
        }

        boss.cracks.push({
            main: { x1, y1, x2, y2 },
            branches
        });
    }
}
