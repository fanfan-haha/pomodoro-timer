const { ipcRenderer } = require('electron');

const MODES = {
  focus: { label: 'FOCUS',       duration: 25 * 60, bodyClass: '' },
  short: { label: 'SHORT BREAK', duration: 5 * 60,  bodyClass: 'mode-short' },
  long:  { label: 'LONG BREAK',  duration: 15 * 60, bodyClass: 'mode-long' },
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 88;

let currentMode = 'focus';
let timeLeft = MODES.focus.duration;
let timerId = null;
let sessionCount = 0;

const storage = {
  get(key, def) {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : def;
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },
};

function getTodayKey() {
  return `pomodoro_${new Date().toISOString().slice(0, 10)}`;
}

function increment(key) {
  const v = storage.get(key, 0) + 1;
  storage.set(key, v);
  return v;
}

function getTodayCount() {
  return storage.get(getTodayKey(), 0);
}

function getTotalCount() {
  return storage.get('pomodoro_total', 0);
}

function pruneOldKeys() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith('pomodoro_') && key !== 'pomodoro_total') {
      if (key.slice(9) < cutoffStr) localStorage.removeItem(key);
    }
  }
}

// DOM refs
const timerDisplay = document.getElementById('timer-display');
const timerModeLabel = document.getElementById('timer-mode-label');
const ringProgress = document.getElementById('ring-progress');
const btnStart = document.getElementById('btn-start');
const btnReset = document.getElementById('btn-reset');
const btnSkip = document.getElementById('btn-skip');
const tabs = document.querySelectorAll('.tab');
const todayCountEl = document.getElementById('today-count');
const sessionCountEl = document.getElementById('session-count');
const totalCountEl = document.getElementById('total-count');

function formatTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function updateRing() {
  const offset = RING_CIRCUMFERENCE * (1 - timeLeft / MODES[currentMode].duration);
  ringProgress.style.strokeDashoffset = offset;
}

function updateDisplay() {
  const formatted = formatTime(timeLeft);
  timerDisplay.textContent = formatted;
  updateRing();
  if (timerId) document.title = `${formatted} — ${MODES[currentMode].label}`;
}

function updateStats() {
  todayCountEl.textContent = getTodayCount();
  sessionCountEl.textContent = sessionCount;
  totalCountEl.textContent = getTotalCount();
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
  timerDisplay.classList.remove('ticking');
}

function setMode(mode) {
  currentMode = mode;
  tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  document.body.className = MODES[mode].bodyClass;
  timerModeLabel.textContent = MODES[mode].label;
  timeLeft = MODES[mode].duration;
  updateDisplay();
  document.title = `POMODORO — ${MODES[mode].label}`;
}

function start() {
  btnStart.textContent = 'PAUSE';
  timerDisplay.classList.add('ticking');
  timerId = setInterval(tick, 1000);
}

function pause() {
  stopTimer();
  btnStart.textContent = 'RESUME';
}

function reset() {
  stopTimer();
  btnStart.textContent = 'START';
  timeLeft = MODES[currentMode].duration;
  updateDisplay();
}

function tick() {
  if (timeLeft <= 0) {
    onTimerEnd();
    return;
  }
  timeLeft--;
  updateDisplay();
}

function onTimerEnd() {
  stopTimer();
  btnStart.textContent = 'START';

  if (currentMode === 'focus') {
    sessionCount++;
    const todayCount = increment(getTodayKey());
    const totalCount = increment('pomodoro_total');
    todayCountEl.textContent = todayCount;
    sessionCountEl.textContent = sessionCount;
    totalCountEl.textContent = totalCount;

    const nextMode = sessionCount % 4 === 0 ? 'long' : 'short';
    ipcRenderer.send('notify', {
      title: '专注结束！',
      body: nextMode === 'long' ? `完成第 ${sessionCount} 个番茄，休息 15 分钟！` : '休息 5 分钟吧',
    });
    setMode(nextMode);
  } else {
    ipcRenderer.send('notify', { title: '休息结束！', body: '专注时间开始了' });
    setMode('focus');
  }
}

btnStart.addEventListener('click', () => {
  if (timerId) pause(); else start();
});

btnReset.addEventListener('click', reset);
btnSkip.addEventListener('click', onTimerEnd);

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    if (timerId) pause();
    setMode(tab.dataset.mode);
    btnStart.textContent = 'START';
  });
});

ringProgress.style.strokeDasharray = RING_CIRCUMFERENCE;
pruneOldKeys();
setMode('focus');
updateStats();
