const PT = {
  MODES: {
    study: { label: '공부',     color: '#FF6B6B', glow: 'rgba(255,107,107,0.25)' },
    short: { label: '짧은 휴식', color: '#4ECDC4', glow: 'rgba(78,205,196,0.25)'  },
    long:  { label: '긴 휴식',  color: '#95E1A3', glow: 'rgba(149,225,163,0.25)' },
  },
  mode: 'study',
  timeLeft: 25 * 60,
  running: false,
  cycle: 1,
  completedPomodoros: 0,
  totalStudySeconds: 0,
  sessions: [],
  customMinutes: { study: 25, short: 5, long: 15 },
  interval: null,
  audioCtx: null,
};
const PT_R = 110;
const PT_C = 2 * Math.PI * PT_R;

function ptGetAudio() {
  if (!PT.audioCtx) PT.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return PT.audioCtx;
}

function ptBeep(freq, duration, delay) {
  try {
    const ctx = ptGetAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq; osc.type = 'sine';
    gain.gain.setValueAtTime(0, ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.05);
  } catch {}
}

function ptPlayDone() {
  ptBeep(660, 0.15, 0);
  ptBeep(880, 0.15, 0.2);
  ptBeep(1100, 0.3, 0.4);
}

function ptFormatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function ptFormatTotal(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

function ptUpdateUI() {
  const m = PT.MODES[PT.mode];
  const totalDuration = PT.customMinutes[PT.mode] * 60;
  const progress = PT.timeLeft / totalDuration;
  const dashOffset = PT_C * (1 - progress);

  const ring = document.getElementById('pt-progress-ring');
  if (ring) {
    ring.setAttribute('stroke', m.color);
    ring.setAttribute('stroke-dashoffset', dashOffset.toFixed(2));
    ring.style.filter = `drop-shadow(0 0 8px ${m.color})`;
  }

  const glow = document.getElementById('pt-glow');
  if (glow) glow.style.background = `radial-gradient(circle, ${m.glow} 0%, transparent 70%)`;

  const disp = document.getElementById('pt-time-display');
  if (disp) {
    disp.textContent = ptFormatTime(PT.timeLeft);
    disp.style.textShadow = `0 0 20px ${m.color}66`;
    disp.classList.toggle('pulse', PT.running && PT.timeLeft <= 10);
  }
  const lbl = document.getElementById('pt-mode-label');
  if (lbl) { lbl.textContent = m.label.toUpperCase(); lbl.style.color = m.color; }

  const btn = document.getElementById('pt-start-btn');
  if (btn) { btn.textContent = PT.running ? '⏸ 일시정지' : '▶ 시작'; btn.style.background = m.color; }

  ['study', 'short', 'long'].forEach(k => {
    const tab = document.getElementById(`pt-tab-${k}`);
    if (!tab) return;
    const active = k === PT.mode;
    tab.style.color = active ? m.color : '';
    tab.style.borderColor = active ? m.color : '';
    tab.style.background = active ? `${m.color}18` : '';
  });

  const filled = PT.completedPomodoros % 4;
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`pt-dot-${i}`);
    if (!dot) continue;
    dot.style.setProperty('--pt-color', m.color);
    dot.classList.toggle('filled', i < filled);
  }

  const totalEl = document.getElementById('pt-total-study');
  if (totalEl) totalEl.textContent = PT.totalStudySeconds > 0 ? ptFormatTotal(PT.totalStudySeconds) : '—';
  const pomoEl = document.getElementById('pt-total-pomo');
  if (pomoEl) pomoEl.textContent = `🍅 ×${PT.completedPomodoros}`;
  const cycleEl = document.getElementById('pt-cycle-stat');
  if (cycleEl) cycleEl.textContent = `#${PT.cycle}`;
  const cycleHdr = document.getElementById('pt-cycle');
  if (cycleHdr) cycleHdr.textContent = PT.cycle;
  const pomoHdr = document.getElementById('pt-pomodoro-count');
  if (pomoHdr) pomoHdr.textContent = PT.completedPomodoros;

  ['study', 'short', 'long'].forEach(k => {
    const inp = document.getElementById(`pt-custom-${k}`);
    if (inp) inp.disabled = PT.running;
  });

  const wrap = document.getElementById('pt-sessions-wrap');
  const list = document.getElementById('pt-sessions-list');
  if (wrap && list) {
    wrap.style.display = PT.sessions.length > 0 ? '' : 'none';
    list.innerHTML = [...PT.sessions].reverse().map(s =>
      `<div class="pt-session-chip">🍅 ${s.time} · ${s.minutes}분</div>`
    ).join('');
  }

  document.title = PT.running
    ? `${ptFormatTime(PT.timeLeft)} — ${m.label}`
    : '🍅 집중 타이머';
}

function ptSwitchMode(newMode) {
  if (PT.running) return;
  PT.mode = newMode;
  PT.timeLeft = PT.customMinutes[newMode] * 60;
  ptUpdateUI();
}

function ptHandleComplete() {
  PT.running = false;
  clearInterval(PT.interval);
  PT.interval = null;
  ptPlayDone();

  if (PT.mode === 'study') {
    const elapsed = PT.customMinutes.study * 60;
    PT.totalStudySeconds += elapsed;
    PT.completedPomodoros += 1;
    const now = new Date();
    PT.sessions = [...PT.sessions.slice(-9), {
      time: now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      minutes: PT.customMinutes.study,
    }];
    const nextMode = PT.cycle % 4 === 0 ? 'long' : 'short';
    PT.cycle += 1;
    PT.mode = nextMode;
    PT.timeLeft = PT.customMinutes[nextMode] * 60;
  } else {
    PT.mode = 'study';
    PT.timeLeft = PT.customMinutes.study * 60;
  }
  ptUpdateUI();
}

function ptToggle() {
  try { ptGetAudio().resume(); } catch {}
  PT.running = !PT.running;
  if (PT.running) {
    PT.interval = setInterval(() => {
      PT.timeLeft -= 1;
      if (PT.timeLeft <= 0) {
        PT.timeLeft = 0;
        ptUpdateUI();
        ptHandleComplete();
      } else {
        ptUpdateUI();
      }
    }, 1000);
  } else {
    clearInterval(PT.interval);
    PT.interval = null;
  }
  ptUpdateUI();
}

function ptReset() {
  PT.running = false;
  clearInterval(PT.interval);
  PT.interval = null;
  PT.timeLeft = PT.customMinutes[PT.mode] * 60;
  ptUpdateUI();
}

function ptCustomChange(key, val) {
  const v = Math.max(1, Math.min(99, parseInt(val) || 1));
  PT.customMinutes[key] = v;
  if (key === PT.mode && !PT.running) {
    PT.timeLeft = v * 60;
    ptUpdateUI();
  }
}

function ptInitTicks() {
  const g = document.getElementById('pt-ticks');
  if (!g) return;
  let html = '';
  for (let i = 0; i < 60; i++) {
    const angle = (i / 60) * 2 * Math.PI;
    const isMajor = i % 5 === 0;
    const inner = isMajor ? PT_R - 14 : PT_R - 9;
    const outer = PT_R - 2;
    const x1 = (140 + inner * Math.cos(angle)).toFixed(2);
    const y1 = (140 + inner * Math.sin(angle)).toFixed(2);
    const x2 = (140 + outer * Math.cos(angle)).toFixed(2);
    const y2 = (140 + outer * Math.sin(angle)).toFixed(2);
    html += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${isMajor ? '#2A2A35' : '#1C1C25'}" stroke-width="${isMajor ? 1.5 : 1}"/>`;
  }
  g.innerHTML = html;
}

window.addEventListener('load', () => {
  ptInitTicks();
  ptUpdateUI();
});
