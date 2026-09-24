const arena = document.querySelector('#arena');
const roachesLayer = document.querySelector('#roaches');
const effectsLayer = document.querySelector('#effects');
const overlay = document.querySelector('#overlay');
const scoreDisplay = document.querySelector('#score');
const timeDisplay = document.querySelector('#time');
const livesDisplay = document.querySelector('#lives');
const startButton = document.querySelector('#startButton');
const pauseButton = document.querySelector('#pauseButton');
const restartButton = document.querySelector('#restartButton');
const soundButton = document.querySelector('#soundButton');

const ROUND_SECONDS = 60;
const MAX_LIVES = 3;
const state = { status: 'ready', score: 0, time: ROUND_SECONDS, lives: MAX_LIVES, roaches: new Map(), nextId: 0, elapsed: 0, nextSpawn: 0, lastFrame: 0, runId: 0, sound: false };
let audioContext;

function updateHud() {
  scoreDisplay.textContent = String(state.score).padStart(3, '0');
  timeDisplay.innerHTML = `${Math.ceil(state.time)}<span class="unit">s</span>`;
  livesDisplay.textContent = `${'♥ '.repeat(state.lives)}${'♡ '.repeat(MAX_LIVES - state.lives)}`.trim();
  livesDisplay.setAttribute('aria-label', `${state.lives} 条生命`);
}

function playTone(frequency, duration, type = 'sine') {
  if (!state.sound) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gain.gain.setValueAtTime(0.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Audio is optional; the game continues if unavailable. */ }
}

function showEffect(x, y, label, className = '') {
  const effect = document.createElement('span');
  effect.className = `effect ${className}`;
  effect.textContent = label;
  effect.style.left = `${x}px`;
  effect.style.top = `${y}px`;
  effectsLayer.append(effect);
  effect.addEventListener('animationend', () => effect.remove(), { once: true });
  setTimeout(() => effect.remove(), 900);
}

function showShot(x, y) {
  const ring = document.createElement('span');
  ring.className = 'crosshair';
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  effectsLayer.append(ring);
  ring.addEventListener('animationend', () => ring.remove(), { once: true });
  setTimeout(() => ring.remove(), 500);
}

function removeRoach(id, hit = false) {
  const roach = state.roaches.get(id);
  if (!roach) return;
  state.roaches.delete(id);
  roach.element.classList.add('vanish');
  setTimeout(() => roach.element.remove(), 250);
  if (hit) {
    state.score += 10;
    showEffect(roach.x, roach.y - 24, '+10');
    playTone(540, 0.11, 'square');
  } else {
    state.lives -= 1;
    showEffect(roach.x, roach.y - 24, '漏掉了！', 'miss');
    playTone(170, 0.23, 'sawtooth');
    if (state.lives <= 0) endGame();
  }
  updateHud();
}

function spawnRoach() {
  if (state.roaches.size >= 4) return;
  const id = ++state.nextId;
  const width = arena.clientWidth;
  const height = arena.clientHeight;
  const x = 44 + Math.random() * Math.max(1, width - 88);
  const y = 53 + Math.random() * Math.max(1, height - 106);
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'roach';
  element.setAttribute('aria-label', '射击蟑螂');
  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  element.style.setProperty('--angle', `${Math.round(Math.random() * 100 - 50)}deg`);
  element.innerHTML = '<span class="antenna left"></span><span class="antenna right"></span><span class="leg l1"></span><span class="leg l2"></span><span class="leg l3"></span><span class="leg r1"></span><span class="leg r2"></span><span class="leg r3"></span><span class="body"></span><span class="head"></span>';
  element.addEventListener('click', event => {
    event.stopPropagation();
    if (state.status !== 'playing') return;
    showShot(x, y);
    removeRoach(id, true);
  });
  roachesLayer.append(element);
  const lifetime = Math.max(1.6, 2.7 - state.elapsed / 55);
  state.roaches.set(id, { element, x, y, expiresAt: state.elapsed + lifetime });
}

function showOverlay(icon, kicker, title, message, action) {
  document.querySelector('#overlayIcon').textContent = icon;
  document.querySelector('#overlayKicker').textContent = kicker;
  document.querySelector('#overlayTitle').textContent = title;
  document.querySelector('#overlayMessage').textContent = message;
  startButton.innerHTML = `${action} <span aria-hidden="true">↗</span>`;
  overlay.hidden = false;
}

function startGame() {
  state.runId += 1;
  state.status = 'playing';
  state.score = 0;
  state.time = ROUND_SECONDS;
  state.lives = MAX_LIVES;
  state.elapsed = 0;
  state.nextSpawn = 0.5;
  state.lastFrame = performance.now();
  state.roaches.clear();
  roachesLayer.replaceChildren();
  effectsLayer.replaceChildren();
  overlay.hidden = true;
  pauseButton.disabled = false;
  pauseButton.textContent = '暂停';
  restartButton.disabled = false;
  updateHud();
  const runId = state.runId;
  requestAnimationFrame(now => tick(now, runId));
}

function endGame() {
  if (state.status !== 'playing') return;
  state.status = 'finished';
  pauseButton.disabled = true;
  roachesLayer.replaceChildren();
  state.roaches.clear();
  const survived = state.time <= 0;
  showOverlay(survived ? '★' : '◎', survived ? 'TIME IS UP!' : 'GAME OVER', survived ? '时间到！' : '蟑螂溜走了！', `本局得分 ${state.score} 分。再试一次，刷新你的纪录！`, '再玩一次');
  playTone(survived ? 660 : 220, 0.25);
}

function togglePause() {
  if (state.status === 'playing') {
    state.status = 'paused';
    pauseButton.textContent = '继续';
    showOverlay('Ⅱ', 'PAUSED', '游戏已暂停', '准备好了就继续，时间会从暂停处接着走。', '继续游戏');
  } else if (state.status === 'paused') {
    state.status = 'playing';
    state.lastFrame = performance.now();
    pauseButton.textContent = '暂停';
    overlay.hidden = true;
    const runId = state.runId;
    requestAnimationFrame(now => tick(now, runId));
  }
}

function tick(now, runId) {
  if (state.status !== 'playing' || runId !== state.runId) return;
  const delta = Math.min((now - state.lastFrame) / 1000, 0.1);
  state.lastFrame = now;
  state.elapsed += delta;
  state.time = Math.max(0, ROUND_SECONDS - state.elapsed);
  if (state.time <= 0) { updateHud(); endGame(); return; }
  for (const [id, roach] of state.roaches) {
    if (state.elapsed >= roach.expiresAt) {
      removeRoach(id);
      if (state.status !== 'playing') return;
    }
  }
  if (state.elapsed >= state.nextSpawn) {
    spawnRoach();
    state.nextSpawn = state.elapsed + Math.max(0.45, 1.15 - state.elapsed / 100);
  }
  updateHud();
  requestAnimationFrame(nextNow => tick(nextNow, runId));
}

startButton.addEventListener('click', () => state.status === 'paused' ? togglePause() : startGame());
pauseButton.addEventListener('click', togglePause);
restartButton.addEventListener('click', startGame);
soundButton.addEventListener('click', () => {
  state.sound = !state.sound;
  soundButton.textContent = state.sound ? '♪ 声音：开' : '♪ 声音：关';
  soundButton.setAttribute('aria-label', state.sound ? '关闭声音' : '开启声音');
  soundButton.setAttribute('aria-pressed', String(state.sound));
  if (state.sound) playTone(480, 0.1);
});
arena.addEventListener('click', event => {
  if (state.status !== 'playing' || event.target.closest('.roach')) return;
  const rect = arena.getBoundingClientRect();
  showShot(event.clientX - rect.left, event.clientY - rect.top);
  playTone(220, 0.04);
});
document.addEventListener('keydown', event => {
  if (event.code === 'Space' && !['BUTTON', 'INPUT'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    togglePause();
  }
});
updateHud();
