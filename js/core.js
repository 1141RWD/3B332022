/* =========================================================
   core.js
   - Main Update Loop & High Level Logic
   ========================================================= */

// ==========================
// 5) 生成系統：敵人
// ==========================
let spawnTimer = 0;
let spawnInterval = 1100; // ms，越小越常出（之後可做隨時間變快）

function restartGame() {
    // 玩家（你要重置位置也可以）
    state.player.hp = state.player.maxHP; // ✅ maxHP
    state.player.x = 160;
    state.player.y = canvas.height / 2;

    // 清場
    state.bullets.length = 0;
    state.enemyBullets.length = 0;
    state.enemyLasers.length = 0;
    state.enemies.length = 0;
    state.drops.length = 0;
    state.lasers.length = 0;
    state.explosions.length = 0;
    state.pendingExplosions.length = 0;

    // 菁英 / Boss
    state.elite = null;          // ✅ 不是 length
    state.eliteSpawned = false;
    state.boss = null;
    state.bossSpawned = false;
    state.bossWarnings.length = 0;

    // 計時器（看你要不要也重置）
    state.timer.remaining = state.timer.total;

    // 分數
    state.score = 0;
    state.stats.killEnemy = 0;
    state.stats.killElite = 0;
    state.stats.killBoss = 0;
    state.stats.surviveTime = 0;

    // 模式
    state.mode = "play";
    state.paused = false;
}

function goHome() {
    window.location.href = "index.html";
}

function enterGameOver() {
    // 結算存活時間（你是倒數，所以這樣算）
    state.stats.surviveTime =
        state.timer.total - state.timer.remaining;

    state.mode = "gameover";
    state.paused = true;
}

function enterVictory() {
    state.stats.surviveTime =
        state.timer.total - state.timer.remaining;

    state.mode = "victory";
    state.paused = true;
}

// ==========================
// 8) 更新（Update）
// ==========================
function update(dt) {
    const p = state.player;

    // ---- 玩家移動
    let mx = 0, my = 0;
    if (isDown("moveUp")) my -= 1;
    if (isDown("moveDown")) my += 1;
    if (isDown("moveLeft")) mx -= 1;
    if (isDown("moveRight")) mx += 1;

    if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my) || 1;
        mx /= len; my /= len;
        p.x += mx * p.speed;
        p.y += my * p.speed;
    }

    // 邊界限制
    p.x = Math.max(p.r, Math.min(canvas.width - p.r, p.x));
    p.y = Math.max(p.r, Math.min(canvas.height - p.r, p.y));

    // ---- 射擊
    shoot(dt);

    // ---- 更新子彈
    for (let i = state.bullets.length - 1; i >= 0; i--) {
        const b = state.bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        b.timeLeft -= dt;

        // 出界或壽命到
        if (
            b.timeLeft <= 0 ||
            b.x < -80 || b.x > canvas.width + 80 ||
            b.y < -80 || b.y > canvas.height + 80
        ) {
            state.bullets.splice(i, 1);
            continue;
        }
    }

    // ---- 更新雷射
    for (let i = state.lasers.length - 1; i >= 0; i--) {
        const l = state.lasers[i];
        l.x = p.x;
        l.y = p.y;
        l.ang = angleToMouse();
        l.timeLeft -= dt;
        if (l.timeLeft <= 0) state.lasers.splice(i, 1);
    }

    // ---- 爆炸特效更新
    for (let i = state.explosions.length - 1; i >= 0; i--) {
        const ex = state.explosions[i];
        ex.time += dt;
        if (ex.time >= ex.duration) {
            state.explosions.splice(i, 1);
        }
    }

    // ---- 生成敵人（只在 play，且沒有菁英時）
    if (state.mode === "play" && !state.elite && !state.boss) {
        spawnTimer += dt;
        if (spawnTimer >= spawnInterval) {
            spawnTimer = 0;
            spawnEnemy();
            spawnInterval = Math.max(420, spawnInterval * 0.997);
        }
    }

    // ---- 更新敵人（追蹤玩家）
    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const e = state.enemies[i];

        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        e.x += Math.cos(ang) * e.speed;
        e.y += Math.sin(ang) * e.speed;

        e.hitCooldown = Math.max(0, e.hitCooldown - dt);

        // 敵人碰到玩家
        const rr = (e.r + p.r);
        if (dist2(e.x, e.y, p.x, p.y) <= rr * rr) {
            const finalDamage = e.damage * (1 - p.damageReduction);
            p.hp -= finalDamage;
            const push = 18;
            e.x -= Math.cos(ang) * push;
            e.y -= Math.sin(ang) * push;

            if (p.hp <= 0) {
                // 死亡重置（先簡單處理）
                enterGameOver();
                return;
            }
        }
    }

    // ---- 撿取掉落物（方塊）
    for (let i = state.drops.length - 1; i >= 0; i--) {
        const d = state.drops[i];
        const half = d.size / 2;
        const pr = state.player.r;

        const hit =
            state.player.x > d.x - half - pr &&
            state.player.x < d.x + half + pr &&
            state.player.y > d.y - half - pr &&
            state.player.y < d.y + half + pr;

        if (hit) {
            setWeapon(d.weaponKey);          // 切換武器
            state.player.weaponTime = state.player.weaponDuration;
            state.drops.splice(i, 1);
        }
    }

    // --- 掉落冷卻倒數 ---
    if (state.elite && state.elite.dropCooldown > 0) {
        state.elite.dropCooldown -= dt;
    }

    if (state.boss && state.boss.dropCooldown > 0) {
        state.boss.dropCooldown -= dt;
    }

    // ---- 武器時間倒數
    if (state.player.weaponKey !== "normal") {
        state.player.weaponTime -= dt;
        if (state.player.weaponTime <= 0) {
            setWeapon("normal");
            state.player.weaponTime = 0;
        }
    }
    // ---- 子彈打中敵人
    bulletHitEnemies();

    // ---- 雷射傷害
    laserHitEnemies(dt);

    if (state.pendingExplosions.length > 0) {
        for (const ex of state.pendingExplosions) {
            explodeAt(ex.x, ex.y, ex.weapon);
        }
        state.pendingExplosions.length = 0;
    }

    // === 倒計時 ===
    if (state.mode === "play" && state.timer.remaining > 0 &&
        !state.elite &&
        !state.boss) {
        state.timer.remaining -= dt / 1000;
        if (state.timer.remaining < 0) {
            state.timer.remaining = 0;
        }
    }

    if (!state.eliteSpawned && state.timer.remaining <= state.timer.total / 2) {
        state.eliteSpawned = true;
        triggerEliteWarning();
    }

    if (!state.bossSpawned && state.timer.remaining <= 0) {
        state.bossSpawned = true;
        triggerBossWarning();
    }
    if (state.mode === "bossWarning") {
        state.warningTimer -= dt;
        if (state.warningTimer <= 0) {
            spawnFinalBoss();
            state.mode = "play";
        }
        return; // ✅ WARNING 時暫停其他更新（跟 elite 一樣）
    }

    if (state.elite) {
        updateElite(dt);
    }

    if (state.boss) {
        updateBoss(dt);
    }

    // === 玩家接觸 Boss 傷害 ===
    if (state.boss) {
        const b = state.boss;
        const p = state.player;

        // 用「玩家圓 + Boss 外殼矩形」
        const rx = b.x - BOSS_DATA.width / 2;
        const ry = b.y - BOSS_DATA.height / 2;
        const rw = BOSS_DATA.width;
        const rh = BOSS_DATA.height;

        if (b.shellStage < 2 && circleRectHit(p.x, p.y, p.r, rx, ry, rw, rh)) {
            if (!b.contactCooldown || b.contactCooldown <= 0) {
                const dmg = 2.5 * (1 - p.damageReduction); // Boss 接觸傷害
                p.hp -= dmg;
                b.contactCooldown = 500; // ms
            }
            // ⭐ 彈開（重點）
            const push = pushCircleOutOfRect(
                p.x, p.y, p.r,
                rx, ry, rw, rh
            );
            if (push) {
                p.x = push.x;
                p.y = push.y;
            }
        }

        // =========================
        // ② 核心接觸（圓形）
        // =========================
        if (b.shellStage >= 2) {
            const rr = p.r + BOSS_DATA.coreRadius;
            const core = getBossCorePos(b);
            const d2 = dist2(p.x, p.y, core.x, core.y);

            if (d2 <= rr * rr) {
                if (!b.coreContactCooldown || b.coreContactCooldown <= 0) {
                    const dmg = 2.2 * (1 - p.damageReduction);
                    p.hp -= dmg;
                    b.coreContactCooldown = 500;
                }

                // ⭐ 彈開（核心）
                const push = pushCircleOut(
                    p.x, p.y, p.r,
                    b.x, b.y, BOSS_DATA.coreRadius
                );
                if (push) {
                    p.x = push.x;
                    p.y = push.y;
                }
            }
        }

        // =========================
        // ③ 冷卻倒數
        // =========================
        if (b.contactCooldown > 0) {
            b.contactCooldown -= dt;
        }
        if (b.coreContactCooldown > 0) {
            b.coreContactCooldown -= dt;
        }
    }

    if (state.mode === "eliteWarning") {
        state.warningTimer -= dt;
        if (state.warningTimer <= 0) {
            spawnElite();
            state.mode = "play";
        }
        return; // WARNING 時暫停其他更新
    }

    // === 更新敵人雷射 ===
    for (let i = state.enemyLasers.length - 1; i >= 0; i--) {
        const l = state.enemyLasers[i];
        l.time += dt;

        if (l.moveY !== undefined) {
            l.y += l.moveY * dt;
        }

        // ⭐ 新增：角度旋轉（指針扇形用）
        if (l.moveAngle !== undefined) {
            l.angle += l.moveAngle * dt;
        }

        if (l.clampTarget !== undefined && l.moveAngle !== undefined) {
            // 上指針與下指針都用「越過就停」的方式
            if ((l.moveAngle > 0 && l.angle >= l.clampTarget) ||
                (l.moveAngle < 0 && l.angle <= l.clampTarget)) {
                l.angle = l.clampTarget;
                l.moveAngle = 0;
            }
        }


        if (l.time >= l.duration) {
            state.enemyLasers.splice(i, 1);
            continue;
        }

        laserHitPlayer(l, dt);
    }

    // === 更新敵人子彈 ===
    for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
        const b = state.enemyBullets[i];
        b.x += b.vx;
        b.y += b.vy;

        if (
            b.x < -50 || b.x > canvas.width + 50 ||
            b.y < -50 || b.y > canvas.height + 50
        ) {
            state.enemyBullets.splice(i, 1);
            continue;
        }

        const rr = b.r + state.player.r;
        if (dist2(b.x, b.y, state.player.x, state.player.y) <= rr * rr) {
            const dmg = b.damage * (1 - state.player.damageReduction);
            state.player.hp -= dmg;
            state.enemyBullets.splice(i, 1);

            if (state.player.hp <= 0) {
                enterGameOver();
                return;
            }
        }
    }
}
