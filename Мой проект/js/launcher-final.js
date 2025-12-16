// ===============================================
// ЛАУНЧЕР ИГР — РЕКОРДЫ НА КАРТОЧКАХ ИЗ FIREBASE (ТОЧУДО СВЕРШИЛОСЬ!)
// ===============================================

const games = [
  { name: "Космический Стрелок", desc: "Уничтожай астероиды в неоновом космосе", playable: true,  key: "spaceShooterBest", bot: "space",      href: "space-shooter.html" },
  { name: "Арканоид",           desc: "Разбей все блоки",                       playable: true,  key: "arkanoidBest",    bot: "arkanoid",   href: "arkanoid.html" },
  { name: "Змейка",             desc: "Классика в неоновом стиле",               playable: false, key: "snakeBest",       bot: "soon" },
  { name: "Тетрис",             desc: "Собери линии и побей рекорд",            playable: false, key: "tetrisBest",      bot: "soon" },
  { name: "Память",             desc: "Найди все пары",                         playable: false, key: "memoryBest",      bot: "soon" }
];

let current = 0;
let isAnimating = false;
let animationId = null;
const canvas = document.getElementById('botCanvas');
const ctx = canvas.getContext('2d');
function resizeGameCanvas() {
  const scale = window.innerWidth / 1920;  // тот же коэффициент, что и в главном меню
  canvas.width = 800 * scale;
  canvas.height = 600 * scale;
}

window.addEventListener('resize', resizeGameCanvas);
resizeGameCanvas();

// === ГЛАВНАЯ ФУНКЦИЯ — ПОКАЗ РЕКОРДОВ ===
function updateRecordsDisplay() {
  if (typeof firebase === 'undefined') {
    console.log("Firebase не загружен");
    return;
  }

  const user = firebase.auth().currentUser;
  if (!user) {
    console.log("Пользователь не авторизован");
    document.querySelectorAll('.game-record').forEach(el => el.textContent = '');
    return;
  }

  console.log("Загружаем рекорды для:", user.email);

  firebase.firestore().collection('users').doc(user.uid).get()
    .then(doc => {
      if (!doc.exists) {
        console.log("Документ пользователя не найден");
        document.querySelectorAll('.game-record').forEach(el => el.textContent = '');
        return;
      }

      const records = doc.data().records || {};
      console.log("Рекорды из Firebase:", records);

      document.querySelectorAll('.stack-card').forEach((card, i) => {
        const recordEl = card.querySelector('.game-record');
        const key = games[i].key;
        const best = records[key] || 0;
        recordEl.textContent = best > 0 ? best : '';
      });
    })
    .catch(err => {
      console.error("Ошибка Firestore:", err);
    });
}

// === БОТЫ (без изменений) ===
function startSpaceShooterBot() {
  const stars = [];
  for (let i = 0; i < 180; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      speed: 0.15 + Math.random() * 0.5,
      alpha: 0.4 + Math.random() * 0.6
    });
  }

  let ship = { x: canvas.width / 2, y: 520 };
  let lastShot = 0;

  function loop() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#001122');
    gradient.addColorStop(1, '#000011');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    stars.forEach(star => {
      star.y += star.speed;
      if (star.y > canvas.height) star.y = -10;
      ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    });

    const t = Date.now() * 0.001;
    ship.x = canvas.width / 2 + Math.sin(t * 1.3) * 280;
    ship.y = 520 + Math.sin(t * 0.9) * 60;

    ctx.fillStyle = '#4ade80';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(ship.x, ship.y);
    ctx.lineTo(ship.x - 10, ship.y + 25);
    ctx.lineTo(ship.x - 5, ship.y + 22);
    ctx.lineTo(ship.x + 5, ship.y + 22);
    ctx.lineTo(ship.x + 10, ship.y + 25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (Date.now() - lastShot > 200) {
      lastShot = Date.now();
      ctx.fillStyle = '#fbbf24';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#fbbf24';
      ctx.fillRect(ship.x - 2, ship.y - 10, 4, 15);
      ctx.shadowBlur = 0;
    }

    animationId = requestAnimationFrame(loop);
  }
  loop();
}

// === БОТ ДЛЯ АРКАНОИДА ===
function startArkanoidBot() {
  let paddle = { x: 350, y: 550, width: 100, height: 20 };
  let ball = { x: 400, y: 500, radius: 12, vx: 3, vy: -3 };
  let bricks = [];
  const colors = ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#a855f7'];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 13; col++) {
      bricks.push({
        x: col * 60 + 20,
        y: row * 30 + 80,
        width: 55,
        height: 25,
        color: colors[row],
        alive: true
      });
    }
  }

  function loop() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#001122');
    gradient.addColorStop(1, '#000011');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    paddle.x = ball.x - paddle.width / 2;
    paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, paddle.x));

    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) ball.vx *= -1;
    if (ball.y - ball.radius < 0) ball.vy *= -1;
    if (ball.y + ball.radius > paddle.y && ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
      ball.vy *= -1;
      ball.vx += (ball.x - (paddle.x + paddle.width / 2)) * 0.15;
    }

    for (let i = bricks.length - 1; i >= 0; i--) {
      let b = bricks[i];
      if (!b.alive) continue;
      if (ball.x > b.x && ball.x < b.x + b.width && ball.y > b.y && ball.y < b.y + b.height) {
        b.alive = false;
        ball.vy *= -1;
      }
    }

    ctx.fillStyle = '#4ade80';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#4ade80';
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fbbf24';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#fbbf24';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    bricks.forEach(b => {
      if (b.alive) {
        ctx.fillStyle = b.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = b.color;
        ctx.fillRect(b.x, b.y, b.width, b.height);
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x, b.y, b.width, b.height);
        ctx.shadowBlur = 0;
      }
    });

    animationId = requestAnimationFrame(loop);
  }
  loop();
  }


// "СКОРО" для недоступных игр
function drawComingSoon() {
  ctx.fillStyle = '#000011';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0ff';
  ctx.font = '80px Orbitron';
  ctx.textAlign = 'center';
  ctx.fillText('СКОРО', canvas.width / 2, canvas.height / 2);
}

// === ОСНОВНАЯ ФУНКЦИЯ ===
function updatePreview() {
  if (isAnimating) return;
  isAnimating = true;

  document.getElementById('title').textContent = games[current].name;
  document.getElementById('desc').textContent = games[current].desc;

  const btn = document.getElementById('playBtn');
  btn.style.display = games[current].playable ? 'block' : 'none';
  if (games[current].playable) {
    btn.onclick = () => location.href = games[current].href;
  }

  if (animationId) cancelAnimationFrame(animationId);

  if (!games[current].playable) {
    drawComingSoon();
  } else if (games[current].bot === "space") {
    startSpaceShooterBot();
  } else if (games[current].bot === "arkanoid") {
    startArkanoidBot();
  }

  requestAnimationFrame(() => {
    const cards = document.querySelectorAll('.stack-card');
    const prevIndex = (current + games.length - 1) % games.length;
    cards.forEach(c => c.classList.remove('active', 'card-drop'));
    cards[prevIndex].classList.add('card-drop');
    cards[current].classList.add('active');
    
    updateRecordsDisplay(); // ← обновляем рекорды после смены карточки
    
    requestAnimationFrame(() => isAnimating = false);
  });
}

// Навигация
document.getElementById('nextBtn').onclick = () => {
  current = (current + 1) % games.length;
  updatePreview();
};

document.getElementById('prevBtn').onclick = () => {
  current = (current - 1 + games.length) % games.length;
  updatePreview();
};

document.querySelectorAll('.stack-card').forEach((card, i) => {
  card.onclick = () => { if (i !== current && !isAnimating) { current = i; updatePreview(); } };
});

// === САМОЕ ВАЖНОЕ: СРАЗУ ПОСЛЕ ВХОДА ПОЛЬЗОВАТЕЛЯ ===
firebase.auth().onAuthStateChanged(user => {
  console.log("Вход:", user ? user.email : "гость");
  updateRecordsDisplay();
  updatePreview();
});

// При загрузке страницы тоже обновляем
window.addEventListener('load', () => {
  updatePreview();
  updateRecordsDisplay();
});