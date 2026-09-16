// ==========================================
// CONFIGURAÇÕES BÁSICAS DO JOGO E DO CANVAS
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Desliga o filtro de suavização de imagem. 
// Isso é essencial para jogos pixel art, senão o gráfico fica borrado!
ctx.imageSmoothingEnabled = false;

// Controle geral do jogo
let gameState = 'MENU'; // Pode ser 'MENU', 'RUNNER' ou 'BOSS'
let score = 0;
let photosCollected = 0;
let gameSpeed = 5.5; // Velocidade que o cenário e os inimigos andam para a esquerda

// ==========================================
// CONTROLES DO JOGADOR
// ==========================================
const keys = {};

// Quando o jogador aperta uma tecla
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;

  // Só permite ações se o jogo estiver rodando
  if (gameState === 'RUNNER' || gameState === 'BOSS') {
    
    // Pulo (W, Seta para Cima ou Espaço)
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        player.jump();
    }
    
    // Abaixar / Deslizar (S ou Seta para Baixo)
    if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        player.slide();
    }
    
    // Atirar (J ou K)
    if (e.code === 'KeyJ' || e.code === 'KeyK') {
        player.shoot();
    }
  }

  // Cheat code / Atalho de testes: Pular direto pra fase do boss apertando 'B'
  if (e.code === 'KeyB' && gameState === 'RUNNER') {
      startBossFight();
  }
});

// Quando o jogador solta a tecla
window.addEventListener('keyup', (e) => { 
    keys[e.code] = false; 
});

// ==========================================
// CARREGAMENTO DE IMAGENS (SPRITESHEETS)
// ==========================================
// A gente carrega as imagens aqui e só desenha quando a flag 'Loaded' for true.

const playerImg = new Image(); 
playerImg.src = 'player_2.png';
let playerLoaded = false; 
playerImg.onload = () => { playerLoaded = true; };

const batImg = new Image(); 
batImg.src = 'bat.png';
let batLoaded = false; 
batImg.onload = () => { batLoaded = true; };

const bossImg = new Image(); 
bossImg.src = 'boss.png';
let bossLoaded = false; 
bossImg.onload = () => { bossLoaded = true; };


// ==========================================
// LISTAS DE ENTIDADES (O que está na tela)
// ==========================================
let smokeParticles = []; // Fumacinha do pé do jogador
let objects = [];        // Obstáculos e fotos (Fase Runner)
let bullets = [];        // Tiros do Jogador (Disquetes)
let bossProjectiles = []; // Ataques do Boss (Letras F)
let bats = [];           // Morcegos
let bossLasers = [];     // Lasers atirados pelos morcegos


// Função simples para criar fumaça de movimento
function createSmoke(x, y) {
  smokeParticles.push({ 
      x: x, 
      y: y, 
      size: Math.random() * 5 + 3, // Tamanho aleatório da bolinha
      alpha: 0.9,                  // Transparência (vai sumindo)
      vx: -Math.random() * 2 - 1,  // Joga pra trás
      vy: -Math.random() * 0.4     // Sobe um pouquinho
  });
}


// ==========================================
// OBJETO DO JOGADOR (PROTAGONISTA)
// ==========================================
const player = {
  // Posição e Hitbox (Caixa de colisão física)
  x: 80, 
  y: 265, 
  w: 55, // Largura de colisão
  h: 110, // Altura de colisão
  
  // Física e Pulo
  vy: 0, 
  gravity: 0.7, 
  jumpPower: -14, // Quão alto ele pula (número negativo porque o Y do canvas inverte para cima)
  isGrounded: true, 
  isSliding: false, 
  
  // Status de Combate
  hp: 3, 
  maxHp: 3, 
  invincibleTimer: 0, // Tempo piscando após levar dano
  
  // Sistema de Armas (Cuphead style)
  ammo: 3, 
  maxAmmo: 3, 
  isReloading: false, 
  reloadTimer: 0, 
  reloadDuration: 75, // Em frames (75 frames = ~1.2 segundos a 60 FPS)
  shootTimer: 0,      // Tempo que o personagem fica na "pose" de tiro

  // Controle de Animação
  runFrame: 0, 
  tick: 0, // Relógio interno do personagem para controlar a troca de sprites

  // Mapeamento dos Sprites na Imagem (Usando porcentagens [X, Y, Largura, Altura])
  idleCrop: [0, 0, 0.125, 0.25],
  runCrops: [
    [0, 0.25, 0.125, 0.25], 
    [0.125, 0.25, 0.125, 0.25], 
    [0.250, 0.25, 0.125, 0.25], 
    [0.375, 0.25, 0.125, 0.25], 
    [0.500, 0.25, 0.125, 0.25], 
    [0.625, 0.25, 0.125, 0.25], 
    [0.750, 0.25, 0.125, 0.25], 
    [0.875, 0.25, 0.125, 0.25]
  ],
  jumpCrop: [0.125, 0.50, 0.125, 0.25],
  slideCrop: [0.625, 0.50, 0.125, 0.25],
  shootCrop: [0, 0.75, 0.125, 0.25],
  shootJumpCrop: [0.375, 0.75, 0.125, 0.25],

  // Ação: Pular
  jump() {
    if (this.isGrounded && !this.isSliding) {
      this.vy = this.jumpPower; 
      this.isGrounded = false;
      // Levanta uma nuvem de fumaça ao pular
      for (let i = 0; i < 7; i++) createSmoke(this.x + 10, this.y + this.h);
    }
  },

  // Ação: Deslizar
  slide() {
    // Só pode deslizar se estiver no chão, não estiver deslizando já, e não estiver no Menu
    if (this.isGrounded && !this.isSliding && (gameState === 'RUNNER' || gameState === 'BOSS')) {
      this.isSliding = true; 
      
      // A mágica acontece aqui: mudamos apenas a CAIXA DE COLISÃO, não a imagem
      this.w = 90; // Fica mais gordinho pra frente
      this.h = 55; // Altura cai pela metade para passar sob quadros e lasers
      
      createSmoke(this.x, this.y + this.h - 5);
      
      // Volta ao normal após meio segundo (650 ms)
      setTimeout(() => { 
        this.isSliding = false; 
        this.w = 55; 
        this.h = 110; 
      }, 650);
    }
  },

  // Ação: Atirar
  shoot() {
    // Bloqueia o tiro se estiver sem munição
    if (this.isReloading || this.ammo <= 0) return;
    
    // Se ele estiver abaixado, o tiro sai mais de baixo
    let bulletY = this.isSliding ? this.y + 25 : this.y + 45;
    
    // Cria o disquete voando
    bullets.push({ 
        x: this.x + this.w, 
        y: bulletY, 
        vx: 16 
    });
    
    this.ammo--; 
    this.shootTimer = 15; // Mostra a "arminha de dedo" por 15 frames
    
    // Inicia a recarga automática se o pente zerar
    if (this.ammo <= 0) { 
        this.isReloading = true; 
        this.reloadTimer = this.reloadDuration; 
    }
  },

  // Ação: Levar Dano
  takeDamage() {
    // Se o timer de invencibilidade estiver rodando, ele ignora o dano
    if (this.invincibleTimer > 0) return;
    
    this.hp--; 
    this.invincibleTimer = 60; // Fica 1 segundo (60 frames) intocável
    
    if (this.hp <= 0) { 
        alert("FIM DE JOGO! O NSA te encheu de faltas!"); 
        location.reload(); // Reinicia a página
    }
  },

  // Lógica principal rodando a 60 fps
  update() {
    // Diminui os timers a cada frame
    if (this.invincibleTimer > 0) this.invincibleTimer--;
    if (this.shootTimer > 0) this.shootTimer--;
    
    // Logica de recarregar
    if (this.isReloading) {
      this.reloadTimer--;
      if (this.reloadTimer <= 0) { 
          this.ammo = this.maxAmmo; 
          this.isReloading = false; 
      }
    }
    
    // Movimentação lateral apenas na fase do Boss
    if (gameState === 'BOSS') {
      if (keys['KeyA'] || keys['ArrowLeft']) this.x = Math.max(20, this.x - 5);
      if (keys['KeyD'] || keys['ArrowRight']) this.x = Math.min(boss.x - 70, this.x + 5);
    }
    
    // Aplica gravidade no pulo/queda
    this.vy += this.gravity; 
    this.y += this.vy;
    
    // O chão do jogo tem o eixo Y fixo.
    // Calculamos o piso da base do pé: O Y do chão é 375. Subtraímos a altura do jogador para ele ficar em cima.
    let floorY = 375 - this.h;
    
    if (this.y >= floorY) { 
        this.y = floorY; 
        this.vy = 0; 
        this.isGrounded = true; 
    }
    
    // Se estiver correndo no chão, controla a animação dos passos
    if (this.isGrounded) {
      this.tick++;
      if (this.tick % 5 === 0) {
        this.runFrame = (this.runFrame + 1) % this.runCrops.length;
        // Solta fumacinha ao correr
        if (gameState === 'RUNNER' && !this.isSliding) {
            createSmoke(this.x + 5, this.y + this.h - 5);
        }
      }
    }
  },

  // Responsável exclusivo por desenhar o jogador na tela
  draw() {
    if (!playerLoaded) return;
    
    // Cria o efeito de "piscar" quando leva dano (se timer for ímpar ele pula o desenho)
    if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 6) % 2 === 0) return;

    let cropRatio = this.idleCrop;

    // Define qual recorte de sprite usar dependendo da ação atual
    if (this.isSliding) {
      cropRatio = this.slideCrop; 
    } else if (!this.isGrounded) {
      cropRatio = this.shootTimer > 0 ? this.shootJumpCrop : this.jumpCrop;
    } else {
      if (this.shootTimer > 0) {
          cropRatio = this.shootCrop;
      } else if (gameState === 'RUNNER' || (gameState === 'BOSS' && (keys['KeyA'] || keys['KeyD']))) {
          cropRatio = this.runCrops[this.runFrame];
      }
    }
    
    // TAMANHO FIXO DE DESENHO (O segredo para não achatar!)
    // Mesmo que a hitbox diminua, a imagem é renderizada nesse tamanho sempre.
    const renderW = 55;
    const renderH = 110;
    
    // Centraliza o desenho em relação à caixa física
    const drawX = this.x + (this.w / 2) - (renderW / 2);
    const drawY = this.y + this.h - renderH;

    // Converte a porcentagem [0.125] em pixels reais baseados no arquivo png
    const sx = cropRatio[0] * playerImg.naturalWidth;
    const sy = cropRatio[1] * playerImg.naturalHeight;
    const sw = cropRatio[2] * playerImg.naturalWidth;
    const sh = cropRatio[3] * playerImg.naturalHeight;
    
    ctx.drawImage(playerImg, sx, sy, sw, sh, drawX, drawY, renderW, renderH);
  }
};


// ==========================================
// OBJETO DO BOSS NSA
// ==========================================
const boss = {
  active: false, 
  x: 550, 
  y: 150, 
  w: 180, 
  h: 180, 
  hp: 100, 
  maxHp: 100,
  tick: 0, 
  frame: 0, 
  mode: 'idle', // Estado atual do chefe ('idle', 'punch', 'summon')
  attackCooldown: 120, // Tempo de espera entre os ataques

  // Mapeamento dos sprites do Boss. 
  // O tamanho exato do recorte tem margens de segurança pra imagem do lado não "vazar"
  idleCrops: [
      [0.02, 0.0, 0.22, 0.33], 
      [0.27, 0.0, 0.22, 0.33], 
      [0.52, 0.0, 0.22, 0.33]
  ],
  punchCrops: [
      [0.02, 0.33, 0.21, 0.33], 
      [0.27, 0.33, 0.24, 0.33]
  ],
  summonCrops: [
      [0.51, 0.33, 0.22, 0.33], 
      [0.76, 0.33, 0.22, 0.33]
  ],

  update() {
    this.tick++;
    
    // Controle da animação (Troca de frame a cada 10 ticks)
    if (this.tick % 10 === 0) {
      let currentList = this.idleCrops;
      if (this.mode === 'punch') currentList = this.punchCrops;
      if (this.mode === 'summon') currentList = this.summonCrops;
      
      this.frame = (this.frame + 1) % currentList.length;
    }

    // Controle dos Ataques da Inteligência Artificial do Boss
    this.attackCooldown--;
    if (this.attackCooldown <= 0) {
      this.attackCooldown = 120 + Math.random() * 60; // Reseta o tempo aleatoriamente
      this.frame = 0; 
      
      // 50% de chance para cada ataque
      if (Math.random() > 0.5) {
        // Ataque 1: Soco e disparo da Letra F
        this.mode = 'punch';
        setTimeout(() => { this.mode = 'idle'; }, 600); // Volta ao normal
        
        bossProjectiles.push({ 
            x: this.x + 20, 
            y: this.y + 80 + (Math.random() * 40 - 20), // Altura do tiro varia
            vx: -(6 + Math.random() * 3),               // Velocidade
            text: 'F'                                   // Projétil
        });
      } else {
        // Ataque 2: Invoca Morcegos
        this.mode = 'summon';
        setTimeout(() => { this.mode = 'idle'; }, 800);
        
        // Sorteia se joga 1 ou 2 morcegos
        let qtd = Math.random() > 0.4 ? 2 : 1;
        for (let i = 0; i < qtd; i++) {
          bats.push({
            x: this.x + 80, 
            y: this.y + 40, 
            targetX: 50 + Math.random() * 350, // Ponto alvo X
            targetY: 30 + Math.random() * 120, // Ponto alvo Y
            w: 60, 
            h: 45, 
            hp: 2,           // Morcego aguenta 2 tiros
            state: 'flying', // Estado inicial
            timer: 0, 
            tick: 0
          });
        }
      }
    }
  },

  draw() {
    // Efeito sutil flutuando (Cenoide baseada no tempo)
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

      // Desenha a Sprite real
      ctx.drawImage(bossImg, sx, sy, sw, sh, this.x, floatY, this.w, this.h);
    }

    // Interface (Barra de Vida Flutuante no Boss)
    ctx.fillStyle = "#222"; 
    ctx.fillRect(this.x + 10, floatY - 20, 160, 12);
    ctx.fillStyle = "#ef4444"; // Sangue
    ctx.fillRect(this.x + 12, floatY - 18, (156) * (this.hp / this.maxHp), 8);
    
    ctx.strokeStyle = "#ffcc00"; // Borda Dourada
    ctx.lineWidth = 2; 
    ctx.strokeRect(this.x + 10, floatY - 20, 160, 12);
    
    ctx.fillStyle = "#fff"; 
    ctx.font = "10px monospace"; 
    ctx.fillText("NSA - SISTEMA", this.x + 15, floatY - 25);
  }
};


// ==========================================
// GERENCIADOR DE COMBATE E TIROS (Fase Boss)
// ==========================================
function handleCombatProjectiles() {
  
  // 1. Controle dos Morcegos
  for (let i = bats.length - 1; i >= 0; i--) {
    let bat = bats[i];
    bat.tick++;
    
    let frameX = Math.floor(bat.tick / 6) % 4; // Bater de asas padrão
    let frameY = 0; 

    if (bat.state === 'flying') {
      // Calcula a distância até o alvo
      let dx = bat.targetX - bat.x;
      let dy = bat.targetY - bat.y;
      let dist = Math.sqrt(dx*dx + dy*dy);
      
      // Move o morcego na direção
      if (dist > 5) { 
          bat.x += (dx / dist) * 4; 
          bat.y += (dy / dist) * 4; 
      } else { 
          // Chegou no alvo, começa a carregar o laser
          bat.state = 'charging'; 
          bat.timer = 50; 
      }
    } 
    else if (bat.state === 'charging') {
      bat.timer--;
      // Faz o morcego piscar os olhos entre amarelo (linha 3) e vermelho (linha 4)
      frameY = (Math.floor(bat.tick / 5) % 2 === 0) ? 2 : 3; 
      
      if (bat.timer <= 0) {
        // Matemática básica (Trigonometria) para atirar na direção exata que o Player está!
        let angle = Math.atan2((player.y + player.h/2) - (bat.y + bat.h/2), (player.x + player.w/2) - (bat.x + bat.w/2));
        
        bossLasers.push({ 
            x: bat.x + bat.w/2, 
            y: bat.y + bat.h/2, 
            vx: Math.cos(angle) * 10, 
            vy: Math.sin(angle) * 10 
        });
        
        bat.state = 'cooldown'; 
        bat.timer = 40;
      }
    } 
    else if (bat.state === 'cooldown') {
      bat.timer--; 
      bat.y -= 4; // Morcego foge voando pra cima
      if (bat.y < -50) bats.splice(i, 1);
    }

    // Desenha a imagem correspondente do morcego
    if (batLoaded) {
      let sx = frameX * (batImg.naturalWidth / 4);
      let sy = frameY * (batImg.naturalHeight / 4);
      let sw = batImg.naturalWidth / 4;
      let sh = batImg.naturalHeight / 4;
      ctx.drawImage(batImg, sx, sy, sw, sh, bat.x, bat.y, bat.w, bat.h);
    }
  }

  // 2. Movimento dos Lasers inimigos
  for (let i = bossLasers.length - 1; i >= 0; i--) {
    let laser = bossLasers[i]; 
    laser.x += laser.vx; 
    laser.y += laser.vy;
    
    // Arte do laser redondinho com núcleo amarelo
    ctx.fillStyle = "#ff0000"; 
    ctx.beginPath(); 
    ctx.arc(laser.x, laser.y, 8, 0, Math.PI*2); 
    ctx.fill();
    ctx.fillStyle = "#ffff00"; 
    ctx.beginPath(); 
    ctx.arc(laser.x, laser.y, 4, 0, Math.PI*2); 
    ctx.fill();
    
    // Bateu no jogador?
    if (laser.x > player.x && laser.x < player.x + player.w && laser.y > player.y && laser.y < player.y + player.h) {
      player.takeDamage(); 
      bossLasers.splice(i, 1); 
      continue;
    }
    // Remove os perdidos da memória
    if (laser.y > canvas.height || laser.x < 0) bossLasers.splice(i, 1);
  }

  // 3. Controle dos Tiros do Jogador (Disquetes)
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i]; 
    b.x += b.vx;
    
    // Desenha disquete azul clássico
    ctx.fillStyle = "#38bdf8"; 
    ctx.fillRect(b.x, b.y, 14, 10);
    ctx.fillStyle = "#ffffff"; 
    ctx.fillRect(b.x + 2, b.y + 2, 5, 6);

    let hit = false; // Flag se o tiro bateu em algo
    
    // Verifica se acertou o Boss Principal
    if (boss.active && b.x > boss.x && b.x < boss.x + boss.w && b.y > boss.y && b.y < boss.y + boss.h) {
      boss.hp = Math.max(0, boss.hp - 4); 
      score += 30; 
      hit = true;
      if (boss.hp <= 0) { 
          alert("VITÓRIA! NSA DERROTADO! Você resgatou o LC!"); 
          location.reload(); 
      }
    }
    
    // Se não acertou o Boss, verifica se pegou num Morcego
    if (!hit) {
      for (let j = bats.length - 1; j >= 0; j--) {
        let bat = bats[j];
        if (b.x > bat.x && b.x < bat.x + bat.w && b.y > bat.y && b.y < bat.y + bat.h) {
          bat.hp -= 1; 
          hit = true;
          if (bat.hp <= 0) { 
              bats.splice(j, 1); 
              score += 20; // Pontinho por abater o cego
          }
          break;
        }
      }
    }
    
    // Remove o tiro da tela se ele bater em algo ou sumir na borda
    if (hit || b.x > canvas.width) bullets.splice(i, 1);
  }

  // 4. Controle das Letras F voadoras do Boss
  for (let i = bossProjectiles.length - 1; i >= 0; i--) {
    let bp = bossProjectiles[i]; 
    bp.x += bp.vx;
    
    // Desenha Letra vermelha
    ctx.fillStyle = "#ef4444"; 
    ctx.beginPath(); 
    ctx.arc(bp.x, bp.y, 14, 0, Math.PI * 2); 
    ctx.fill();
    ctx.fillStyle = "#ffffff"; 
    ctx.font = "bold 14px monospace"; 
    ctx.fillText(bp.text, bp.x - 5, bp.y + 5);
    
    // Acertou o jogador?
    if (bp.x > player.x && bp.x < player.x + player.w && bp.y > player.y && bp.y < player.y + player.h) {
      player.takeDamage(); 
      bossProjectiles.splice(i, 1); 
      continue;
    }
    
    if (bp.x < -30) bossProjectiles.splice(i, 1);
  }
}


// ==========================================
// GERENCIADOR DE CENÁRIO (Parkour / Runner)
// ==========================================
let bgFar = 0, groundX = 0;

// Efeito Parallax: Fundo move mais devagar, chão mais rápido
function drawMuseumParallax() {
  ctx.fillStyle = "#1a1f33"; 
  ctx.fillRect(0, 0, canvas.width, 360);
  
  bgFar = (bgFar - gameSpeed * 0.2) % 400; // Arcos no fundo
  for (let i = 0; i < 3; i++) {
    let x = bgFar + i * 400;
    ctx.fillStyle = "#131624"; 
    ctx.fillRect(x + 50, 40, 90, 220);
    ctx.beginPath(); 
    ctx.arc(x + 95, 40, 45, Math.PI, 0); 
    ctx.fill();
  }
  
  groundX = (groundX - gameSpeed) % 40; // Carpete/Piso
  ctx.fillStyle = "#4a1c1d"; 
  ctx.fillRect(0, 360, canvas.width, 90);
  ctx.strokeStyle = "#2b0f10"; 
  ctx.lineWidth = 2;
  
  // Desenha os frisos da madeira no piso rolando
  for (let x = groundX; x < canvas.width; x += 40) { 
      ctx.beginPath(); 
      ctx.moveTo(x, 360); 
      ctx.lineTo(x, 450); 
      ctx.stroke(); 
  }
  
  ctx.fillStyle = "#d4af37"; // Linha Dourada
  ctx.fillRect(0, 360, canvas.width, 4);
}

// Spawna os obstáculos na fase runner
let spawnTimer = 0;
function spawnObjects() {
  spawnTimer++;
  if (spawnTimer > 85) {
    spawnTimer = 0; 
    const rand = Math.random(); // Roleta Russa de obstáculo
    
    // Cria um item baseado na porcentagem
    if (rand < 0.35) objects.push({ type: 'photo', x: 820, y: 180 + Math.random() * 80, w: 24, h: 28 });
    else if (rand < 0.6) objects.push({ type: 'tcc', x: 820, y: 340, w: 30, h: 35 });
    else if (rand < 0.8) objects.push({ type: 'wire', x: 820, y: 363, w: 36, h: 12, spark: 0 });
    else objects.push({ type: 'notice', x: 820, y: 250, w: 40, h: 40 }); 
  }
}

// Controla colisões e movimentação das peças na corrida
function updateAndDrawObjects() {
  for (let i = objects.length - 1; i >= 0; i--) {
    let obj = objects[i]; 
    obj.x -= gameSpeed; // Item vem pra sua cara
    
    if (obj.type === 'photo') { // Item Coletável!
      ctx.fillStyle = "#fff"; ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
      ctx.fillStyle = "#003049"; ctx.fillRect(obj.x + 3, obj.y + 3, obj.w - 6, obj.h - 9);
      
      // Colisão boa: Pegou a foto
      if (player.x < obj.x + obj.w && player.x + player.w > obj.x && player.y < obj.y + obj.h && player.y + player.h > obj.y) {
        photosCollected++; 
        score += 150; 
        objects.splice(i, 1);
        
        // Juntou as 5, chama o chefinho
        if (photosCollected >= 5) startBossFight();
        continue;
      }
    } 
    else if (obj.type === 'tcc') { // Pilha de Trabalhos de Conclusão (Pular)
      ctx.fillStyle = "#b3261e"; ctx.fillRect(obj.x, obj.y + 15, obj.w, 20);
      ctx.fillStyle = "#ffffff"; ctx.fillRect(obj.x + 3, obj.y, obj.w - 6, 15);
      ctx.fillStyle = "#000"; ctx.font = "8px monospace"; ctx.fillText("TCC", obj.x + 5, obj.y + 25);
      
      // Margem de erro reduzida na colisão pra não ser injusto
      if (player.x + player.w - 15 > obj.x && player.x + 15 < obj.x + obj.w && player.y + player.h > obj.y + 4) { 
          player.takeDamage(); 
          objects.splice(i, 1); 
          continue; 
      }
    } 
    else if (obj.type === 'wire') { // Fio solto dando faísca (Pular)
      ctx.fillStyle = "#111"; ctx.fillRect(obj.x, obj.y, obj.w, 8); 
      obj.spark++;
      // A faísca apaga e acende (pisca pisca)
      if (obj.spark % 6 < 3) { 
          ctx.fillStyle = "#00ffff"; 
          ctx.fillRect(obj.x + 12, obj.y - 6, 10, 10); 
      }
      if (player.x + player.w - 10 > obj.x && player.x + 10 < obj.x + obj.w && player.y + player.h > obj.y - 2) { 
          player.takeDamage(); 
          objects.splice(i, 1); 
          continue; 
      }
    } 
    else if (obj.type === 'notice') { // DP Voadora (Deslizar por baixo)
      ctx.fillStyle = "#ffb703"; ctx.fillRect(obj.x, obj.y, obj.w, obj.h);
      ctx.fillStyle = "#d00000"; ctx.font = "8px monospace"; ctx.fillText("! DP !", obj.x + 6, obj.y + 20);
      
      if (player.x + player.w - 15 > obj.x && player.x + 15 < obj.x + obj.w && player.y < obj.y + obj.h && player.y + player.h > obj.y) { 
          player.takeDamage(); 
          objects.splice(i, 1); 
          continue; 
      }
    }
    
    // Limpeza de cache se passar da tela esquerda
    if (obj.x < -60) objects.splice(i, 1);
  }
}

// Cuida das nuvenzinhas que o jogador solta ao correr
function handleSmoke() {
  for (let i = smokeParticles.length - 1; i >= 0; i--) {
    let p = smokeParticles[i]; 
    p.x += p.vx; 
    p.y += p.vy; 
    p.alpha -= 0.035; // Vai ficando invisível
    
    ctx.fillStyle = `rgba(230, 230, 230, ${p.alpha})`; 
    ctx.beginPath(); 
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); 
    ctx.fill();
    
    // Mata a fumaça morta
    if (p.alpha <= 0) smokeParticles.splice(i, 1);
  }
}


// ==========================================
// TRANSIÇÃO PARA A BATALHA
// ==========================================
function startBossFight() {
  boss.active = true; 
  gameState = 'BOSS'; 
  gameSpeed = 0; // A tela para de correr, vira arena!
  objects = [];  // Limpa o chão
  
  // Abre e edita o texto do balão
  const dialogueBox = document.getElementById('dialogue-box');
  dialogueBox.style.display = 'block'; 
  document.getElementById('diag-name').innerText = "BOSS: NSA";
  document.getElementById('diag-text').innerHTML = "ERRO 403: LC BLOQUEADO!<br>Desvie das Letras F e atire nos morcegos antes que eles disparem!";
  
  // Esconde o balão de fala após 3,5 segundos
  setTimeout(() => { dialogueBox.style.display = 'none'; }, 3500);
}


// ==========================================
// HUD (INTERFACE E TEXTOS)
// ==========================================
function drawHUD() {
  // Corações de Vida
  ctx.fillStyle = "#fff"; 
  ctx.font = "14px 'Courier New', monospace"; 
  ctx.fillText("VIDA:", 20, 25);
  for (let i = 0; i < player.maxHp; i++) { 
      // Desenha cor vermelho se tiver HP, ou cinza apagado se tomou dano
      ctx.fillStyle = i < player.hp ? "#e63946" : "#495057"; 
      ctx.beginPath(); 
      ctx.arc(75 + i * 22, 21, 8, 0, Math.PI * 2); 
      ctx.fill(); 
  }
  
  // Placar padrão
  ctx.fillStyle = "#ffcc00"; 
  ctx.fillText(`FOTOS: ${photosCollected}/5`, 20, 50); 
  ctx.fillText(`PONTOS: ${score}`, 20, 72);
  
  // Informações extras quando estiver na arena final
  if (gameState === 'BOSS') {
    ctx.fillStyle = "#00ffcc"; 
    ctx.font = "13px monospace"; 
    ctx.fillText("[A/D] Mover | [W] Pular | [S] Abaixar | [J/K] Atirar", 390, 25);
    
    // Mostra o status dos disparos
    if (player.isReloading) { 
        ctx.fillStyle = "#ff3333"; 
        ctx.font = "bold 13px monospace"; 
        ctx.fillText("⚡ RECARREGANDO... ⚡", 470, 48); 
    } else { 
        ctx.fillStyle = "#38bdf8"; 
        ctx.fillText(`DISQUETES: `, 470, 48); 
        // Desenha os bloquinhos de munição sobrando
        for (let i = 0; i < player.ammo; i++) ctx.fillRect(570 + i * 16, 38, 11, 12); 
    }
  }
}


// ==========================================
// LOOP PRINCIPAL (MOTOR DO JOGO)
// ==========================================
function gameLoop() {
  // Limpa o canvas inteiro pra desenhar o próximo frame
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Coisas que sempre acontecem
  drawMuseumParallax(); 
  handleSmoke();
  
  // Coisas específicas de fase
  if (gameState === 'RUNNER') { 
      spawnObjects(); 
      updateAndDrawObjects(); 
      player.update(); 
      player.draw(); 
  } 
  else if (gameState === 'BOSS') { 
      handleCombatProjectiles(); 
      player.update(); 
      player.draw(); 
      boss.update(); 
      boss.draw(); 
  }
  
  drawHUD(); 
  
  // Chama a função novamente na taxa do seu monitor (geralmente 60fps)
  requestAnimationFrame(gameLoop);
}


// ==========================================
// BOTÕES DE TELA (HTML/DOM)
// ==========================================
document.getElementById('start-btn').addEventListener('click', () => { 
    document.getElementById('menu-screen').style.display = 'none'; 
    gameState = 'RUNNER'; 
});

document.getElementById('shop-btn').addEventListener('click', () => { 
    alert("Lojinha da Lauro:\n- Coxinha da Cantina (Speed Boost)\n- Regra de Três (Escudo Anti-DP)\n\n*Em construção pelo Grêmio!"); 
});


// Dá o "ignição" inicial assim que o código carrega
gameLoop();

</script>
