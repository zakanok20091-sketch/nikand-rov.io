// ===============================================
// КОСМИЧЕСКИЙ СТРЕЛОК — РЕКОРДЫ В FIREBASE
// Рекорд сохраняется ТОЛЬКО при улучшении результата
// ===============================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('bestScore');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');

const GAME_KEY = "spaceShooterBest";

let bestScore = 0;

// === ЗАГРУЗКА РЕКОРДА ===
function loadBestScore() {
  if (typeof firebase === 'undefined' || !firebase.auth().currentUser) {
    bestScore = 0;
    bestScoreEl.textContent = '0';
    return;
  }

  const user = firebase.auth().currentUser;
  firebase.firestore().collection('users').doc(user.uid).get()
    .then(doc => {
      if (doc.exists && doc.data().records?.[GAME_KEY] !== undefined) {
        bestScore = doc.data().records[GAME_KEY];
      } else {
        bestScore = 0;
      }
      bestScoreEl.textContent = bestScore;
    })
    .catch(() => {
      bestScore = 0;
      bestScoreEl.textContent = '0';
    });
}

// === СОХРАНЕНИЕ РЕКОРДА — ТОЛЬКО ПРИ УЛУЧШЕНИИ! ===
function saveBestScore() {
  if (typeof firebase === 'undefined' || !firebase.auth().currentUser) return;

  const user = firebase.auth().currentUser;

  firebase.firestore().collection('users').doc(user.uid).get()
    .then(doc => {
      const currentBestInDB = doc.exists && doc.data().records?.[GAME_KEY] || 0;

      if (score > currentBestInDB) {
        bestScore = score;
        bestScoreEl.textContent = bestScore;

        return firebase.firestore().collection('users').doc(user.uid)
          .set({ records: { [GAME_KEY]: score } }, { merge: true });
      }
    })
    .catch(err => console.error('Ошибка сохранения рекорда:', err));
}

// Игровые объекты
let ship = { x: 390, y: 520, width: 20, height: 25, vx: 0, vy: 0, maxSpeed: 18, accel: 1.5, friction: 0.94, hitbox: {} };
let bullets = [];
let asteroids = [];
let coins = [];
let score = 0;
let gameRunning = true;
let keys = { up: false, down: false, left: false, right: false }; // единый объект для всех направлений
let shooting = false;
let lastShotTime = 0;
const shootInterval = 60;

// Система патронов
let ammo = 30;
const maxAmmo = 30;
let isReloading = false;
const reloadTime = 2000; // 2 секунды на перезарядку
let reloadStartTime = 0;

// Управление — работает на ЛЮБОЙ раскладке (WASD + стрелки)
window.addEventListener('keydown', e => {
  // Движение (только во время игры)
  if (gameRunning) {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;

    if (e.code === 'Space') {
      e.preventDefault();
      shooting = true;
    }

    // Перезарядка по R
    if (e.code === 'KeyR' && !isReloading && ammo < maxAmmo) {
      e.preventDefault();
      startReload();
    }
  }

  // ESC — в меню (всегда)
  if (e.code === 'Escape') {
    e.preventDefault();
    window.location.href = 'index.html?fromGame=true';
  }

  // Пробел — рестарт после game over
  if (e.code === 'Space' && !gameRunning) {
    e.preventDefault();
    restartGame();
  }
});

window.addEventListener('keyup', e => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;

  if (e.code === 'Space') shooting = false;
});

function shoot() {
  if (isReloading || ammo <= 0) return; // Не стреляем если перезарядка или нет патронов
  
  const now = Date.now();
  if (now - lastShotTime < shootInterval) return;
  
  ammo--;
  updateAmmoDisplay();
  bullets.push({ x: ship.x + 9, y: ship.y, width: 4, height: 12, speed: 18 });
  lastShotTime = now;

  // Автоматическая перезарядка когда патроны закончились
  if (ammo === 0) {
    startReload();
  }
}

function startReload() {
  if (isReloading || ammo >= maxAmmo) return;
  isReloading = true;
  reloadStartTime = Date.now();
  updateAmmoDisplay();
}

function updateReload() {
  if (!isReloading) return;
  
  const now = Date.now();
  if (now - reloadStartTime >= reloadTime) {
    ammo = maxAmmo;
    isReloading = false;
    updateAmmoDisplay();
  }
}

function updateAmmoDisplay() {
  const ammoEl = document.getElementById('ammo');
  const ammoCountEl = document.getElementById('ammoCount');
  
  if (!ammoEl || !ammoCountEl) return;
  
  ammoCountEl.textContent = ammo;
  
  // Убираем все классы
  ammoEl.classList.remove('low-ammo', 'reloading');
  
  if (isReloading) {
    ammoEl.classList.add('reloading');
  } else if (ammo <= 10) {
    ammoEl.classList.add('low-ammo');
  }
}

function updateShipMovement() {
  let ax = 0, ay = 0;
  if (keys.left) ax -= 1;
  if (keys.right) ax += 1;
  if (keys.up) ay -= 1;
  if (keys.down) ay += 1;

  if (ax || ay) {
    const len = Math.hypot(ax, ay);
    ax /= len; ay /= len;
  }

  ship.vx += ax * ship.accel;
  ship.vy += ay * ship.accel;
  ship.vx *= ship.friction;
  ship.vy *= ship.friction;

  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed > ship.maxSpeed) {
    ship.vx = (ship.vx / speed) * ship.maxSpeed;
    ship.vy = (ship.vy / speed) * ship.maxSpeed;
  }

  ship.x += ship.vx;
  ship.y += ship.vy;
  ship.x = Math.max(0, Math.min(canvas.width - ship.width, ship.x));
  ship.y = Math.max(0, Math.min(canvas.height - ship.height, ship.y));
}

function createAsteroid() {
  if (score >= 2000 && Math.random() < 1.0) { // Увеличено в 2 раза (было 0.88, теперь 100%)
    asteroids.push({ x: Math.random() * (canvas.width - 75), y: -75, width: 75, height: 75, speed: 5.0, health: 5, maxHealth: 5, isRed: true });
    return;
  }
  const size = 30 + Math.random() * 30;
  const health = Math.floor(size / 10) + 1; // Увеличено HP: было size/15, стало size/10 + 1
  if (score >= 500 && Math.random() < 0.99) { // Увеличено в 2 раза (было 0.495)
    asteroids.push({ x: Math.random() * (canvas.width - 75), y: -75, width: 75, height: 75, speed: 5.0, health: 5, maxHealth: 5, isRed: true });
    return;
  }
  asteroids.push({ x: Math.random() * (canvas.width - size), y: -size, width: size, height: size, speed: 4.0 + Math.random() * 3.0, health: health, maxHealth: health, isRed: false });
}

function createCoin() {
  coins.push({ 
    x: Math.random() * (canvas.width - 20), 
    y: -20, 
    width: 20, 
    height: 20, 
    speed: 4.0 + Math.random() * 3.0, 
  });
}

function checkCollision(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function updateShipHitbox() {
  ship.hitbox = { x: ship.x + 3, y: ship.y + 5, width: ship.width * 0.7, height: ship.height * 0.7 };
}

function update() {
  if (!gameRunning) return;

  updateShipMovement();
  updateReload(); // Проверяем перезарядку
  if (shooting) shoot();
  updateShipHitbox();

  // Удаляем вылетевшие пули
  bullets = bullets.filter(b => { b.y -= b.speed; return b.y > -b.height; });

  // Движение астероидов и монет
  asteroids.forEach(a => a.y += a.speed);
  asteroids = asteroids.filter(a => a.y < canvas.height);
  coins.forEach(c => c.y += c.speed);
  coins = coins.filter(c => c.y < canvas.height);

  // Пули в астероиды
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    for (let ai = asteroids.length - 1; ai >= 0; ai--) {
      if (checkCollision(bullets[bi], asteroids[ai])) {
        asteroids[ai].health--;
        bullets.splice(bi, 1);
        if (asteroids[ai].health <= 0) {
          score += 10 * asteroids[ai].maxHealth;
          asteroids.splice(ai, 1);
        }
        scoreEl.textContent = score;
        break;
      }
    }
  }

  // Монеты
  for (let i = coins.length - 1; i >= 0; i--) {
    if (checkCollision(ship.hitbox, coins[i])) {
      coins.splice(i, 1);
      score += 1;
      scoreEl.textContent = score;
    }
  }

  // Столкновение с астероидом
  for (let i = asteroids.length - 1; i >= 0; i--) {
    if (checkCollision(ship.hitbox, asteroids[i])) {
      gameOver();
      return;
    }
  }

  if (Math.random() < 0.077) createAsteroid(); // Увеличено в 2 раза (было 0.0385)
  if (Math.random() < 0.020) createCoin();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#001122');
  gradient.addColorStop(1, '#000011');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (score >= 2000) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.fillRect(0, 0, canvas.width, 40);
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('РЕЖИМ БОССОВ', canvas.width / 2, 28);
  }

  // Корабль
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.moveTo(ship.x + 10, ship.y);
  ctx.lineTo(ship.x + 2, ship.y + 20);
  ctx.lineTo(ship.x + 7, ship.y + 17);
  ctx.lineTo(ship.x + 13, ship.y + 17);
  ctx.lineTo(ship.x + 18, ship.y + 20);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#22c55e';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (shooting) {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(ship.x + 10, ship.y + 5, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Пули
  ctx.fillStyle = '#fbbf24';
  bullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));

  // Астероиды
  asteroids.forEach(a => {
    ctx.fillStyle = a.isRed ? '#ef4444' : '#6b7280';
    ctx.beginPath();
    ctx.arc(a.x + a.width/2, a.y + a.height/2, a.width/2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = a.isRed ? '#dc2626' : '#4b5563';
    ctx.lineWidth = a.isRed ? 2.5 : 1.5;
    ctx.stroke();

    if (a.health) {
      const barW = a.width * 0.8;
      const barX = a.x + (a.width - barW) / 2;
      const barY = a.y - 10;
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(barX, barY, barW, 6);
      const hp = a.health / a.maxHealth;
      ctx.fillStyle = hp > 0.5 ? '#10b981' : hp > 0.2 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(barX, barY, barW * hp, 6);
      if (a.isRed) {
        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('BOSS', a.x + a.width/2, a.y + a.height/2 + 4);
      }
    }
  });

  // Монеты
  ctx.fillStyle = '#facc15';
  ctx.strokeStyle = '#eab308';
  coins.forEach(c => {
    ctx.save();
    ctx.translate(c.x + 10, c.y + 10);
    ctx.rotate(c.rotation || 0);
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(-3, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function gameOver() {
  gameRunning = false;
  finalScoreEl.textContent = score;
  saveBestScore();
  gameOverEl.style.display = 'block';
  document.getElementById('gameContainer').classList.add('game-over-mode');
}

function restartGame() {
  document.getElementById('gameContainer').classList.remove('game-over-mode');
  ship = { x: 390, y: 520, width: 20, height: 25, vx: 0, vy: 0, maxSpeed: 18, accel: 1.5, friction: 0.94, hitbox: {} };
  bullets = []; asteroids = []; coins = []; score = 0; gameRunning = true;
  ammo = maxAmmo;
  isReloading = false;
  scoreEl.textContent = '0';
  gameOverEl.style.display = 'none';
  updateShipHitbox();
  updateAmmoDisplay();
}

// Delta time для нормализации скорости на разных устройствах
let lastTime = performance.now();
let accumulator = 0;
const fixedTimeStep = 16.67; // 60 FPS

function gameLoop(currentTime) {
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;
  
  // Ограничиваем максимальный delta time для избежания больших скачков
  const clampedDelta = Math.min(deltaTime, 100);
  accumulator += clampedDelta;
  
  // Обновляем игру фиксированными шагами для стабильности
  while (accumulator >= fixedTimeStep) {
    update();
    accumulator -= fixedTimeStep;
  }
  
  draw();
  requestAnimationFrame(gameLoop);
}

// === СТАРТ ===
updateShipHitbox();
loadBestScore();
updateAmmoDisplay();
lastTime = performance.now();
gameLoop(lastTime);