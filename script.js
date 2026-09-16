// ==========================================
    // FLUXO DE TRANSIÇÃO (LOBBY -> VÍDEO -> TELA CHEIA)
    // ==========================================
    const lobbyScreen = document.getElementById('lobby-screen');
    const videoScreen = document.getElementById('video-screen');
    const introVideo = document.getElementById('intro-video');
    const skipBtn = document.getElementById('skip-btn');
    const gameContainer = document.getElementById('game-container');

    // Ao clicar no fliperama do lobby
    lobbyScreen.addEventListener('click', () => {
      // 1. Coloca o navegador em tela cheia
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }

      // 2. Esconde o lobby e abre o player de vídeo
      lobbyScreen.style.display = 'none';
      videoScreen.style.display = 'flex';
      
      introVideo.currentTime = 0;
      introVideo.play().catch(err => {
        console.warn("Autoplay impedido, pulando pro jogo...", err);
        launchGame();
      });
    });

    // Quando o vídeo acaba, entra no jogo direto
    introVideo.addEventListener('ended', launchGame);

    // Botão de pular vídeo
    skipBtn.addEventListener('click', () => {
      introVideo.pause();
      launchGame();
    });

    function launchGame() {
      videoScreen.style.display = 'none';
      gameContainer.style.display = 'flex';
      gameState = 'RUNNER'; // Libera o jogo para começar!
    }

    // ==========================================
    // MOTOR DO JOGO E CANVAS
    // ==========================================
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let gameState = 'LOBBY'; // Começa bloqueado até o vídeo acabar
    let score = 0;
    let photosCollected = 0;
    let gameSpeed = 5.5;

    // Controles do teclado
    const keys = {};
    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if (gameState === 'RUNNER' || gameState === 'BOSS') {
        if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') player.jump();
        if (e.code === 'KeyS' || e.code === 'ArrowDown') player.slide();
        if (e.code === 'KeyJ' || e.code === 'KeyK') player.shoot();
      }
      if (e.code === 'KeyB' && gameState === 'RUNNER') startBossFight();
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    // Carregamento de Sprites
    const playerImg = new Image(); playerImg.src = 'player_2.png';
    let playerLoaded = false; playerImg.onload = () => { playerLoaded = true; };

    const batImg = new Image(); batImg.src = 'bat.png';
    let batLoaded = false; batImg.onload = () => { batLoaded = true; };

    const bossImg = new Image(); bossImg.src = 'boss.png';
    let bossLoaded = false; bossImg.onload = () => { bossLoaded = true; };

    let smokeParticles = [];
    function createSmoke(x, y) {
      smokeParticles.push({
        x: x, y: y, size: Math.random() * 5 + 3, alpha: 0.9,
        vx: -Math.random() * 2 - 1, vy: -Math.random() * 0.4
      });
    }

    let bullets = [];
    let bossProjectiles = [];
    let bats = [];
    let bossLasers = [];

    // ==========================================
    // PROTAGONISTA
    // ==========================================
    const player = {
      x: 80, y: 265, w: 55, h: 110,
      vy: 0, gravity: 0.7, jumpPower: -14,
      isGrounded: true, isSliding: false, shootTimer: 0, runFrame: 0, tick: 0,
      hp: 3, maxHp: 3, invincibleTimer: 0, ammo: 3, maxAmmo: 3, isReloading: false, reloadTimer: 0, reloadDuration: 75,

      idleCrop: [0, 0, 0.125, 0.25],
      runCrops: [
        [0, 0.25, 0.125, 0.25], [0.125, 0.25, 0.125, 0.25], [0.250, 0.25, 0.125, 0.25], [0.375, 0.25, 0.125, 0.25], 
        [0.500, 0.25, 0.125, 0.25], [0.625, 0.25, 0.125, 0.25], [0.750, 0.25, 0.125, 0.25], [0.875, 0.25, 0.125, 0.25]
      ],
      jumpCrop: [0.125, 0.50, 0.125, 0.25],
      slideCrop: [0.625, 0.50, 0.125, 0.25],
      shootCrop: [0, 0.75, 0.125, 0.25],
      shootJumpCrop: [0.375, 0.75, 0.125, 0.25],

      jump() {
        if (this.isGrounded && !this.isSliding) {
          this.vy = this.jumpPower; this.isGrounded = false;
          for (let i = 0; i < 7; i++) createSmoke(this.x + 10, this.y + this.h);
        }
      },

      slide() {
        if (this.isGrounded && !this.isSliding && (gameState === 'RUNNER' || gameState === 'BOSS')) {
          this.isSliding = true;
          this.w = 90; this.h = 55; // Hitbox reduzida
          createSmoke(this.x, this.y + this.h - 5);
          setTimeout(() => { this.isSliding = false; this.w = 55; this.h = 110; }, 650);
        }
      },

      shoot() {
        if (this.isReloading || this.ammo <= 0) return;
        let bulletY = this.isSliding ? this.y + 25 : this.y + 45;
        bullets.push({ x: this.x + this.w, y: bulletY, vx: 16 });
        this.ammo--; this.shootTimer = 15;
        if (this.ammo <= 0) { this.isReloading = true; this.reloadTimer = this.reloadDuration; }
      },

      takeDamage() {
        if (this.invincibleTimer > 0) return;
        this.hp--; this.invincibleTimer = 60;
        if (this.hp <= 0) {
          alert("FIM DE JOGO! O NSA pegou você!");
          location.reload();
        }
      },

      update() {
        if (this.invincibleTimer > 0) this.invincibleTimer--;
        if (this.shootTimer > 0) this.shootTimer--;
        if (this.isReloading) {
          this.reloadTimer--;
          if (this.reloadTimer <= 0) { this.ammo = this.maxAmmo; this.isReloading = false; }
        }
        if (gameState === 'BOSS') {
          if (keys['KeyA'] || keys['ArrowLeft']) this.x = Math.max(20, this.x - 5);
          if (keys['KeyD'] || keys['ArrowRight']) this.x = Math.min(boss.x - 70, this.x + 5);
        }
        this.vy += this.gravity; this.y += this.vy;
        let floorY = 375 - this.h;
        if (this.y >= floorY) { this.y = floorY; this.vy = 0; this.isGrounded = true; }

        if (this.isGrounded) {
          this.tick++;
          if (this.tick % 5 === 0) {
            this.runFrame = (this.runFrame + 1) % this.runCrops.length;
            if (gameState === 'RUNNER' && !this.isSliding) createSmoke(this.x + 5, this.y + this.h - 5);
          }
        }
      },

      draw() {
        if (!playerLoaded) return;
        if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 6) % 2 === 0) return;

        let cropRatio = this.idleCrop;
        if (this.isSliding) cropRatio = this.slideCrop;
        else if (!this.isGrounded) cropRatio = this.shootTimer > 0 ? this.shootJumpCrop : this.jumpCrop;
        else {
          if (this.shootTimer > 0) cropRatio = this.shootCrop;
          else if (gameState === 'RUNNER' || (gameState === 'BOSS' && (keys['KeyA'] || keys['KeyD']))) cropRatio = this.runCrops[this.runFrame];
        }

        const renderW = 55, renderH = 110;
        const drawX = this.x + (this.w / 2) - (renderW / 2);
        const drawY = this.y + this.h - renderH;

        const sx = cropRatio[0] * playerImg.naturalWidth;
        const sy = cropRatio[1] * playerImg.naturalHeight;
        const sw = cropRatio[2] * playerImg.naturalWidth;
        const sh = cropRatio[3] * playerImg.naturalHeight;

        ctx.drawImage(playerImg, sx, sy, sw, sh, drawX, drawY, renderW, renderH);
      }
    };

    // ==========================================
    // BOSS NSA
    // ==========================================
    const boss = {
      active: false, x: 550, y: 150, w: 180, h: 180, hp: 100, maxHp: 100,
      tick: 0, frame: 0, mode: 'idle', attackCooldown: 120,

      idleCrops: [[0.02, 0.0, 0.22, 0.33], [0.27, 0.0, 0.22, 0.33], [0.52, 0.0, 0.22, 0.33]],
      punchCrops: [[0.02, 0.33, 0.21, 0.33], [0.27, 0.33, 0.24, 0.33]],
      summonCrops: [[0.51, 0.33, 0.22, 0.33], [0.76, 0.33, 0.22, 0.33]],

      update() {
        this.tick++;
        if (this.tick % 10 === 0) {
          let currentList = this.idleCrops;
          if (this.mode === 'punch') currentList = this.punchCrops;
          if (this.mode === 'summon') currentList = this.summonCrops;
          this.frame = (this.frame + 1) % currentList.length;
        }

        this.attackCooldown--;
        if (this.attackCooldown <= 0) {
          this.attackCooldown = 120 + Math.random() * 60;
          this.frame = 0;

          if (Math.random() > 0.5) {
            this.mode = 'punch';
            setTimeout(() => { this.mode = 'idle'; }, 600);
            bossProjectiles.push({
              x: this.x + 20, y: this.y + 80 + (Math.random() * 40 - 20),
              vx: -(6 + Math.random() * 3), text: 'F'
            });
          } else {
            this.mode = 'summon';
            setTimeout(() => { this.mode = 'idle'; }, 800);
            let qtd = Math.random() > 0.4 ? 2 : 1;
            for (let i = 0; i < qtd; i++) {
              bats.push({
                x: this.x + 80, y: this.y + 40,
                targetX: 50 + Math.random() * 350, targetY: 30 + Math.random() * 120,
                w: 60, h: 45, hp: 2, state: 'flying', timer: 0, tick: 0
              });
            }
          }
        }
      },

      draw() {
        const floatY = this.y + Math.sin(this.tick * 0.06) * 10;
        if (bossLoaded) {
          let currentList = this.idleCrops;
          if (this.mode === 'punch') currentList = this.punchCrops;
          if (this.mode === 'summon') currentList = this.summonCrops;
          const cropRatio = currentList[this.frame % currentList.length];

          const sx = cropRatio[0] * bossImg.naturalWidth;
          const sy = cropRatio[1] * bossImg.naturalHeight;
          const sw = cropRatio[2] * bossImg.naturalWidth;
          const sh = cropRatio[3] * bossImg.naturalHeight;

          ctx.drawImage(bossImg, sx, sy, sw, sh, this.x, floatY, this.w, this.h);
        }

        ctx.fillStyle = "#222"; ctx.fillRect(this.x + 10, floatY - 20, 160, 12);
        ctx.fillStyle = "#ef4444"; ctx.fillRect(this.x + 12, floatY - 18, (156) * (this.hp / this.maxHp), 8);
        ctx.strokeStyle = "#ffcc00"; ctx.lineWidth = 2; ctx.strokeRect(this.x + 10, floatY - 20, 160, 12);
        ctx.fillStyle = "#fff"; ctx.font = "10px monospace"; ctx.fillText("NSA - SISTEMA", this.x + 15, floatY - 25);
      }
    };

    // ==========================================
    // MORCEGOS E PROJÉTEIS
    // ==========================================
    function handleCombatProjectiles() {
      for (let i = bats.length - 1; i >= 0; i--) {
        let bat = bats[i]; bat.tick++;
        let frameX = Math.floor(bat.tick / 6) % 4;
        let frameY = 0;

        if (bat.state === 'flying') {
          let dx = bat.targetX - bat.x, dy = bat.targetY - bat.y;
          let dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 5) { bat.x += (dx / dist) * 4; bat.y += (dy / dist) * 4; }
          else { bat.state = 'charging'; bat.timer = 50; }
        } else if (bat.state === 'charging') {
          bat.timer--;
          frameY = (Math.floor(bat.tick / 5) % 2 === 0) ? 2 : 3;
          if (bat.timer <= 0) {
            let angle = Math.atan2((player.y + player.h/2) - (bat.y + bat.h/2), (player.x + player.w/2) - (bat.x + bat.w/2));
            bossLasers.push({ x: bat.x + bat.w/2, y: bat.y + bat.h/2, vx: Math.cos(angle) * 10, vy: Math.sin(angle) * 10 });
            bat.state = 'cooldown'; bat.timer = 40;
          }
        } else if (bat.state === 'cooldown') {
          bat.timer--; bat.y -= 4;
          if (bat.y < -50) bats.splice(i, 1);
        }

        if (batLoaded) {
          let sx = frameX * (batImg.naturalWidth / 4);
          let sy = frameY * (batImg.naturalHeight / 4);
          let sw = batImg.naturalWidth / 4;
          let sh = batImg.naturalHeight / 4;
          ctx.drawImage(batImg, sx, sy, sw, sh, bat.x, bat.y, bat.w, bat.h);
        }
      }

      for (let i = bossLasers.length - 1; i >= 0; i--) {
        let laser = bossLasers[i]; laser.x += laser.vx; laser.y += laser.vy;
        ctx.fillStyle = "#ff0000"; ctx.beginPath(); ctx.arc(laser.x, laser.y, 8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#ffff00"; ctx.beginPath(); ctx.arc(laser.x, laser.y, 4, 0, Math.PI*2); ctx.fill();
        if (laser.x > player.x && laser.x < player.x + player.w && laser.y > player.y && laser.y < player.y + player.h) {
          player.takeDamage(); bossLasers.splice(i, 1); continue;
        }
        if (laser.y > canvas.height || laser.x < 0) bossLasers.splice(i, 1);
      }

      for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; b.x += b.vx;
        ctx.fillStyle = "#38bdf8"; ctx.fillRect(b.x, b.y, 14, 10);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(b.x + 2, b.y + 2, 5, 6);

        let hit = false;
        if (boss.active && b.x > boss.x && b.x < boss.x + boss.w && b.y > boss.y && b.y < boss.y + boss.h) {
          boss.hp = Math.max(0, boss.hp - 4); score += 30; hit = true;
          if (boss.hp <= 0) { alert("VITÓRIA! NSA DERROTADO! Você salvou o LC!"); location.reload(); }
        }
        if (!hit) {
          for (let j = bats.length - 1; j >= 0; j--) {
            let bat = bats[j];
            if (b.x > bat.x && b.x < bat.x + bat.w && b.y > bat.y && b.y < bat.y + bat.h) {
              bat.hp -= 1; hit = true;
              if (bat.hp <= 0) { bats.splice(j, 1); score += 20; }
              break;
            }
          }
        }
        if (hit || b.x > canvas.width) bullets.splice(i, 1);
      }

      for (let i = bossProjectiles.length - 1; i >= 0; i--) {
        let bp = bossProjectiles[i]; bp.x += bp.vx;
        ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(bp.x, bp.y, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 14px monospace"; ctx.fillText(bp.text, bp.x - 5, bp.y + 5);
        if (bp.x > player.x && bp.x < player.x + player.w && bp.y > player.y && bp.y < player.y + player.h) {
          player.takeDamage(); bossProjectiles.splice(i, 1); continue;
        }
        if (bp.x < -30) bossProjectiles.splice(i, 1);
      }
    }

    // ==========================================
    // PARALLAX E OBSTÁCULOS
    // ==========================================
    let bgFar = 0, groundX = 0;
    function drawMuseumParallax() {
      ctx.fillStyle = "#1a1f33"; ctx.fillRect(0, 0, canvas.width, 360);
      bgFar = (bgFar - gameSpeed * 0.2) % 400;
      for (let i = 0; i < 3; i++) {
        let x = bgFar + i * 400;
        ctx.fillStyle = "#131624"; ctx.fillRect(x + 50, 40, 90, 220);
        ctx.beginPath(); ctx.arc(x + 95, 40, 45, Math.PI, 0); ctx.fill();
      }
      groundX = (groundX - gameSpeed) % 40;
      ctx.fillStyle = "#4a1c1d"; ctx.fillRect(0, 360, canvas.width, 90);
      ctx.strokeStyle = "#2b0f10"; ctx.lineWidth = 2;
      for (let x = groundX; x < canvas.width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 360); ctx.lineTo(x, 450); ctx.stroke(); }
      ctx.fillStyle = "#d4af37"; ctx.fillRect(0, 360, canvas.width, 4);
    }

    let objects = []; let spawnTimer = 0;
    function spawnObjects() {
      spawnTimer++;
      if (spawnTimer > 85) {
        spawnTimer = 0; const rand = Math.random();
        if (rand < 0.35) objects.push({ type: 'photo', x: 820, y: 180 + Math.random() * 80, w: 24, h: 28 });
        else if (rand < 0.6) objects.push({ type: 'tcc', x: 820, y: 340, w: 30, h: 35 });
        else if (rand < 0.8) objects.push({ type: 'wire', x: 820, y: 363, w: 36, h: 12, spark: 0 });
        else objects.push({ type: 'notice', x: 820, y: 250, w: 40, h: 40 }); 
      }
    }

    function updateAndDrawObjects() {
      for (let i = objects.length - 1; i >= 0; i--) {
        let obj = objects[i]; obj.x -= gameSpeed;
        if (obj.type === 'photo') {
          ctx.fillStyle = "#fff"; ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
          ctx.fillStyle = "#003049"; ctx.fillRect(obj.x + 3, obj.y + 3, obj.w - 6, obj.h - 9);
          if (player.x < obj.x + obj.w && player.x + player.w > obj.x && player.y < obj.y + obj.h && player.y + player.h > obj.y) {
            photosCollected++; score += 150; objects.splice(i, 1);
            if (photosCollected >= 5) startBossFight();
            continue;
          }
        } else if (obj.type === 'tcc') {
          ctx.fillStyle = "#b3261e"; ctx.fillRect(obj.x, obj.y + 15, obj.w, 20);
          ctx.fillStyle = "#ffffff"; ctx.fillRect(obj.x + 3, obj.y, obj.w - 6, 15);
          ctx.fillStyle = "#000"; ctx.font = "8px monospace"; ctx.fillText("TCC", obj.x + 5, obj.y + 25);
          if (player.x + player.w - 15 > obj.x && player.x + 15 < obj.x + obj.w && player.y + player.h > obj.y + 4) { player.takeDamage(); objects.splice(i, 1); continue; }
        } else if (obj.type === 'wire') {
          ctx.fillStyle = "#111"; ctx.fillRect(obj.x, obj.y, obj.w, 8); obj.spark++;
          if (obj.spark % 6 < 3) { ctx.fillStyle = "#00ffff"; ctx.fillRect(obj.x + 12, obj.y - 6, 10, 10); }
          if (player.x + player.w - 10 > obj.x && player.x + 10 < obj.x + obj.w && player.y + player.h > obj.y - 2) { player.takeDamage(); objects.splice(i, 1); continue; }
        } else if (obj.type === 'notice') {
          ctx.fillStyle = "#ffb703"; ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
          ctx.fillStyle = "#d00000"; ctx.font = "8px monospace"; ctx.fillText("! DP !", obj.x + 6, obj.y + 20);
          if (player.x + player.w - 15 > obj.x && player.x + 15 < obj.x + obj.w && player.y < obj.y + obj.h && player.y + player.h > obj.y) { player.takeDamage(); objects.splice(i, 1); continue; }
        }
        if (obj.x < -60) objects.splice(i, 1);
      }
    }

    function handleSmoke() {
      for (let i = smokeParticles.length - 1; i >= 0; i--) {
        let p = smokeParticles[i]; p.x += p.vx; p.y += p.vy; p.alpha -= 0.035;
        ctx.fillStyle = `rgba(230, 230, 230, ${p.alpha})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        if (p.alpha <= 0) smokeParticles.splice(i, 1);
      }
    }

    function startBossFight() {
      boss.active = true; gameState = 'BOSS'; gameSpeed = 0; objects = [];
      const dBox = document.getElementById('dialogue-box');
      dBox.style.display = 'block';
      document.getElementById('diag-name').innerText = "BOSS: NSA";
      document.getElementById('diag-text').innerHTML = "ERRO 403: LC BLOQUEADO!<br>Desvie das Letras F e atire nos morcegos!";
      setTimeout(() => { dBox.style.display = 'none'; }, 3500);
    }

    function drawHUD() {
      ctx.fillStyle = "#fff"; ctx.font = "14px 'Courier New', monospace"; ctx.fillText("VIDA:", 20, 25);
      for (let i = 0; i < player.maxHp; i++) {
        ctx.fillStyle = i < player.hp ? "#e63946" : "#495057";
        ctx.beginPath(); ctx.arc(75 + i * 22, 21, 8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#ffcc00"; ctx.fillText(`FOTOS: ${photosCollected}/5`, 20, 50); ctx.fillText(`PONTOS: ${score}`, 20, 72);

      if (gameState === 'BOSS') {
        ctx.fillStyle = "#00ffcc"; ctx.font = "13px monospace"; ctx.fillText("[A/D] Mover | [W] Pular | [S] Deslizar | [J/K] Atirar", 380, 25);
        if (player.isReloading) {
          ctx.fillStyle = "#ff3333"; ctx.font = "bold 13px monospace"; ctx.fillText("⚡ RECARREGANDO... ⚡", 470, 48);
        } else {
          ctx.fillStyle = "#38bdf8"; ctx.fillText(`DISQUETES: `, 470, 48);
          for (let i = 0; i < player.ammo; i++) ctx.fillRect(570 + i * 16, 38, 11, 12);
        }
      }
    }

    // ==========================================
    // LOOP PRINCIPAL
    // ==========================================
    function gameLoop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (gameState === 'RUNNER' || gameState === 'BOSS') {
        drawMuseumParallax();
        handleSmoke();

        if (gameState === 'RUNNER') {
          spawnObjects(); updateAndDrawObjects(); player.update(); player.draw();
        } else if (gameState === 'BOSS') {
          handleCombatProjectiles(); player.update(); player.draw(); boss.update(); boss.draw();
        }
        drawHUD();
      }

      requestAnimationFrame(gameLoop);
    }

    gameLoop();
