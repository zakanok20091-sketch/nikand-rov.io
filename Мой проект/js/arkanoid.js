// ===============================================
// АРКАНОИД — БЕСКОНЕЧНЫЙ + РЕКОРДЫ В FIREBASE
// Классическая аркадная игра "Арканоид" с неоновым дизайном
// Рекорды сохраняются в Firebase и отображаются только при улучшении
// ===============================================

// ========== ИНИЦИАЛИЗАЦИЯ CANVAS И ЭЛЕМЕНТОВ UI ==========
// Получаем canvas элемент для отрисовки игры
const canvas = document.getElementById('gameCanvas');
// Получаем 2D контекст для рисования
const ctx = canvas.getContext('2d');
// Элементы интерфейса для отображения счета и информации
const scoreEl = document.getElementById('currentScore'); // Текущий счет
const bestScoreEl = document.getElementById('bestScore'); // Лучший счет
const gameOverEl = document.getElementById('gameOver'); // Окно Game Over
const finalScoreEl = document.getElementById('finalScore'); // Финальный счет

// ========== КОНСТАНТЫ ==========
// Ключ для сохранения рекорда в Firebase (должен совпадать с лаунчером!)
const GAME_KEY = "arkanoidBest";

// ========== ИГРОВЫЕ ОБЪЕКТЫ ==========
// Платформа (ракетка) игрока: позиция, размеры
let paddle = { x: 350, y: 550, width: 100, height: 20 };
// Мяч: позиция, радиус, скорость по осям X и Y, максимальная скорость
let ball = { x: 400, y: 500, radius: 12, vx: 7, vy: -7, maxSpeed: 45 };
// Массив кирпичей для разрушения
let bricks = [];
// Игровые переменные
let score = 0; // Текущий счет
let gameRunning = true; // Флаг состояния игры (true = игра идет)
let keys = { left: false, right: false }; // Состояние нажатых клавиш
let bestScore = 0; // Лучший рекорд пользователя

// ========== ЗАГРУЗКА РЕКОРДА ИЗ FIREBASE ==========
/**
 * Загружает лучший рекорд пользователя из базы данных Firebase
 * Если пользователь не авторизован или Firebase не загружен, рекорд = 0
 */
function loadBestScore() {
  // Проверяем наличие Firebase и авторизованного пользователя
  if (typeof firebase === 'undefined' || !firebase.auth().currentUser) {
    bestScore = 0;
    bestScoreEl.textContent = '0';
    return;
  }

  // Получаем текущего пользователя
  const user = firebase.auth().currentUser;
  // Загружаем документ пользователя из Firestore
  firebase.firestore().collection('users').doc(user.uid).get()
    .then(doc => {
      // Если документ существует и содержит рекорд для этой игры
      if (doc.exists && doc.data().records?.[GAME_KEY] !== undefined) {
        bestScore = doc.data().records[GAME_KEY];
      } else {
        bestScore = 0;
      }
      // Отображаем рекорд на экране
      bestScoreEl.textContent = bestScore;
    })
    .catch(() => {
      // В случае ошибки устанавливаем рекорд в 0
      bestScore = 0;
      bestScoreEl.textContent = '0';
    });
}

// ========== СОХРАНЕНИЕ РЕКОРДА В FIREBASE ==========
/**
 * Сохраняет рекорд в Firebase только если текущий счет больше предыдущего рекорда
 * Использует merge: true чтобы не перезаписывать другие рекорды пользователя
 */
function saveBestScore() {
  // Проверяем наличие Firebase и авторизованного пользователя
  if (typeof firebase === 'undefined' || !firebase.auth().currentUser) return;

  const user = firebase.auth().currentUser;

  // Получаем текущий рекорд из базы данных
  firebase.firestore().collection('users').doc(user.uid).get()
    .then(doc => {
      // Извлекаем текущий рекорд из базы (или 0 если его нет)
      const currentBestInDB = doc.exists && doc.data().records?.[GAME_KEY] || 0;

      // Сохраняем только если новый счет больше предыдущего рекорда
      if (score > currentBestInDB) {
        bestScore = score;
        bestScoreEl.textContent = bestScore;

        // Сохраняем новый рекорд в Firestore (merge сохраняет другие рекорды)
        return firebase.firestore().collection('users').doc(user.uid)
          .set({ records: { [GAME_KEY]: score } }, { merge: true });
      }
    })
    .catch(err => console.error('Ошибка сохранения рекорда:', err));
}

// ========== СОЗДАНИЕ КИРПИЧЕЙ ==========
/**
 * Создает сетку из кирпичей (5 рядов по 13 кирпичей)
 * Каждый ряд имеет свой цвет из палитры
 * alive: true означает что кирпич еще не разрушен
 */
function createBricks() {
  bricks = []; // Очищаем массив кирпичей
  // Цвета для каждого ряда (сверху вниз)
  const colors = ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#a855f7'];
  
  // Создаем 5 рядов кирпичей
  for (let row = 0; row < 5; row++) {
    // В каждом ряду 13 кирпичей
    for (let col = 0; col < 13; col++) {
      bricks.push({
        x: col * 60 + 20,        // Позиция X (60px между кирпичами, отступ 20px)
        y: row * 30 + 80,        // Позиция Y (30px между рядами, отступ 80px сверху)
        width: 55,               // Ширина кирпича
        height: 25,              // Высота кирпича
        color: colors[row],      // Цвет из палитры (зависит от ряда)
        alive: true              // Флаг: кирпич не разрушен
      });
    }
  }
}

// ========== ОБРАБОТКА УПРАВЛЕНИЯ ==========
/**
 * Обработка нажатий клавиш
 * Поддерживает как WASD, так и стрелки для совместимости с разными раскладками
 */
document.addEventListener('keydown', e => {
  // Движение влево (A или стрелка влево)
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
    keys.left = true;
  }
  // Движение вправо (D или стрелка вправо)
  if (e.code === 'KeyD' || e.code === 'ArrowRight') {
    keys.right = true;
  }

  // ESC - возврат в главное меню
  if (e.code === 'Escape') {
    e.preventDefault();
    window.location.href = 'index.html?fromGame=true';
  }

  // Пробел - перезапуск игры (только если игра не запущена)
  if (e.code === 'Space' && !gameRunning) {
    e.preventDefault();
    restartGame();
  }
});

/**
 * Обработка отпускания клавиш
 * Сбрасывает флаги движения при отпускании клавиш
 */
document.addEventListener('keyup', e => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
    keys.left = false;
  }
  if (e.code === 'KeyD' || e.code === 'ArrowRight') {
    keys.right = false;
  }
});

// ========== ОБНОВЛЕНИЕ ПЛАТФОРМЫ ==========
/**
 * Обновляет позицию платформы в зависимости от нажатых клавиш
 * Ограничивает движение платформы границами canvas
 */
function updatePaddle() {
  const PADDLE_SPEED = 18; // Скорость движения платформы
  // Движение влево
  if (keys.left) paddle.x -= PADDLE_SPEED;
  // Движение вправо
  if (keys.right) paddle.x += PADDLE_SPEED;
  // Ограничиваем позицию платформы границами canvas
  paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, paddle.x));
}

// ========== УСКОРЕНИЕ МЯЧА ==========
/**
 * Постепенно увеличивает скорость мяча для усложнения игры
 * Ограничивает максимальную скорость
 */
function accelerateBall() {
  // Вычисляем текущую скорость мяча (длина вектора скорости)
  let speed = Math.hypot(ball.vx, ball.vy);
  // Если скорость меньше максимальной, увеличиваем её
  if (speed < ball.maxSpeed) {
    ball.vx *= 1.0005; // Увеличиваем скорость по X
    ball.vy *= 1.0005; // Увеличиваем скорость по Y
  }
}

// ========== ПРОВЕРКА УНИЧТОЖЕНИЯ ВСЕХ КИРПИЧЕЙ ==========
/**
 * Проверяет, все ли кирпичи разрушены
 * @returns {boolean} true если все кирпичи разрушены
 */
function checkAllBricksDestroyed() {
  return bricks.every(b => !b.alive);
}

// ========== ОСНОВНАЯ ФУНКЦИЯ ОБНОВЛЕНИЯ ИГРЫ ==========
/**
 * Обновляет состояние игры каждый кадр:
 * - Движение платформы и мяча
 * - Обработка столкновений
 * - Проверка условий победы/поражения
 */
function updateGame() {
  // Если игра не запущена, ничего не обновляем
  if (!gameRunning) return;

  // Обновляем позицию платформы
  updatePaddle();
  // Увеличиваем скорость мяча (если нужно)
  accelerateBall();

  // Обновляем позицию мяча
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Отскок от боковых стен (левая и правая)
  if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) ball.vx *= -1;
  // Отскок от верхней стены
  if (ball.y - ball.radius < 0) ball.vy *= -1;
  // Если мяч упал вниз - игра окончена
  if (ball.y + ball.radius > canvas.height) {
    gameOverFunc();
    return;
  }

  // Столкновение с платформой
  // Проверяем: мяч ниже платформы, в пределах её ширины, и движется вниз
  if (ball.y + ball.radius > paddle.y && ball.x > paddle.x && ball.x < paddle.x + paddle.width && ball.vy > 0) {
    ball.vy *= -1; // Меняем направление по Y
    // Вычисляем позицию удара относительно центра платформы (-1 до 1)
    let hitPos = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
    // Изменяем скорость по X в зависимости от места удара (эффект "англа")
    ball.vx += hitPos * 10;
  }

  // Проверка столкновений с кирпичами
  // Проходим по массиву кирпичей в обратном порядке (для безопасного удаления)
  for (let i = bricks.length - 1; i >= 0; i--) {
    let b = bricks[i];
    if (!b.alive) continue; // Пропускаем уже разрушенные кирпичи
    // Проверка пересечения мяча и кирпича (AABB коллизия)
    if (ball.x > b.x && ball.x < b.x + b.width && ball.y > b.y && ball.y < b.y + b.height) {
      b.alive = false; // Разрушаем кирпич
      score += 10; // Добавляем очки
      scoreEl.textContent = score; // Обновляем отображение счета
      ball.vy *= -1; // Меняем направление мяча
    }
  }

  // Если все кирпичи разрушены - создаем новый уровень
  if (checkAllBricksDestroyed()) {
    createBricks(); // Создаем новые кирпичи
    score += 100; // Бонус за прохождение уровня
    scoreEl.textContent = score;
  }
}

// ========== ОТРИСОВКА ИГРЫ ==========
/**
 * Рисует все игровые объекты на canvas
 * Использует градиенты и эффекты свечения для неонового стиля
 */
function draw() {
  // Создаем градиентный фон (от темно-синего к черному)
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#001122'); // Верх (темно-синий)
  gradient.addColorStop(1, '#000011'); // Низ (почти черный)
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ========== ОТРИСОВКА ПЛАТФОРМЫ ==========
  // Платформа с эффектом свечения (зеленый неон)
  ctx.fillStyle = '#4ade80';
  ctx.shadowBlur = 15; // Интенсивность свечения (уменьшено для производительности)
  ctx.shadowColor = '#4ade80';
  ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
  ctx.shadowBlur = 0; // Отключаем свечение для следующих объектов

  // ========== ОТРИСОВКА МЯЧА ==========
  // Мяч с эффектом свечения (желтый неон)
  ctx.fillStyle = '#fbbf24';
  ctx.shadowBlur = 18; // Интенсивность свечения
  ctx.shadowColor = '#fbbf24';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); // Рисуем круг
  ctx.fill();
  ctx.shadowBlur = 0; // Отключаем свечение

  // ========== ОТРИСОВКА КИРПИЧЕЙ ==========
  // Кирпичи рисуем без shadowBlur для лучшей производительности
  bricks.forEach(b => {
    if (b.alive) {
      // Заливка кирпича цветом ряда
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.width, b.height);
      // Обводка неоновым цветом
      ctx.strokeStyle = '#0ff'; // Циановая обводка
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.width, b.height);
    }
  });
}

// ========== ОБРАБОТКА КОНЦА ИГРЫ ==========
/**
 * Вызывается когда мяч падает вниз
 * Сохраняет рекорд и показывает экран Game Over
 */
function gameOverFunc() {
  gameRunning = false; // Останавливаем игру
  finalScoreEl.textContent = score; // Показываем финальный счет
  saveBestScore(); // Сохраняем рекорд (если он улучшен)
  gameOverEl.style.display = 'block'; // Показываем окно Game Over
  // Добавляем класс для красного свечения (визуальный эффект)
  document.getElementById('gameContainer').classList.add('game-over-mode');
}

// ========== ПЕРЕЗАПУСК ИГРЫ ==========
/**
 * Сбрасывает все игровые параметры и начинает новую игру
 */
function restartGame() {
  // Убираем визуальные эффекты Game Over
  document.getElementById('gameContainer').classList.remove('game-over-mode');
  gameOverEl.style.display = 'none';
  // Сбрасываем игровые переменные
  gameRunning = true;
  score = 0;
  scoreEl.textContent = '0';
  // Возвращаем платформу в начальную позицию
  paddle.x = 350;
  // Сбрасываем мяч в начальное состояние
  ball = { x: 400, y: 500, radius: 12, vx: 7, vy: -7, maxSpeed: 45 };
  // Создаем новый набор кирпичей
  createBricks();
}

// ========== СИСТЕМА DELTA TIME ==========
/**
 * Delta time используется для нормализации скорости игры на разных устройствах
 * Обеспечивает одинаковую скорость игры независимо от FPS устройства
 */
let lastTime = performance.now(); // Время последнего кадра
let accumulator = 0; // Накопитель времени для фиксированных шагов
const fixedTimeStep = 16.67; // Фиксированный шаг времени (60 FPS = 16.67ms на кадр)

// ========== ГЛАВНЫЙ ИГРОВОЙ ЦИКЛ ==========
/**
 * Основной цикл игры, вызывается через requestAnimationFrame
 * Использует фиксированный временной шаг для стабильности физики
 * @param {number} currentTime - Текущее время в миллисекундах
 */
function gameLoop(currentTime) {
  // Вычисляем время, прошедшее с последнего кадра
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;
  
  // Ограничиваем максимальный delta time (защита от больших задержек)
  const clampedDelta = Math.min(deltaTime, 100);
  accumulator += clampedDelta;
  
  // Обновляем игру фиксированными шагами для стабильности физики
  // Это гарантирует одинаковую скорость игры на всех устройствах
  while (accumulator >= fixedTimeStep) {
    updateGame(); // Обновляем логику игры
    accumulator -= fixedTimeStep; // Вычитаем использованное время
  }
  
  // Отрисовываем кадр
  draw();
  // Запрашиваем следующий кадр анимации
  requestAnimationFrame(gameLoop);
}

// ========== ИНИЦИАЛИЗАЦИЯ И ЗАПУСК ИГРЫ ==========
createBricks(); // Создаем начальный набор кирпичей
loadBestScore(); // Загружаем рекорд пользователя
lastTime = performance.now(); // Инициализируем время
gameLoop(lastTime); // Запускаем игровой цикл