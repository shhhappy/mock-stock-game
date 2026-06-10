// ── State ────────────────────────────────────────────────
const S = {
  user: null, room: null,
  stocks: [], sectors: [], activeSector: '',
  currentPage: 'market',
  tradeSymbol: null, tradePrice: 0,
  stockChart: null, portChart: null, hostBarChart: null, resultsBarChart: null, assetLineChart: null,
  timerInterval: null, pollInterval: null, newsInterval: null,
  newsTs: 0,
  txnPage: 1, txnTotalPages: 1,
  adjustTargetUid: null,
  depRate: 3, depCash: 0,
  eduTab: 'glossary', glossaryData: [],
  hostTab: 'rank',
  watchlist: new Set(JSON.parse(localStorage.getItem('watchlist') || '[]')),
  watchlistOnly: false,
  assetHistory: [],
  chatLastId: 0,
  chatUnread: 0,
  chatInterval: null,
  quizTimerInterval: null,
};

let _newsPopupTimer = null;

// ── API ──────────────────────────────────────────────────
const api = {
  async get(url) { return (await fetch(url)).json(); },
  async post(url, body) {
    return (await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)})).json();
  },
  async del(url) { return (await fetch(url, {method:'DELETE'})).json(); },
};

// ── Formatters ───────────────────────────────────────────
const krw  = n => Math.round(n).toLocaleString('ko-KR') + '원';
const pct  = n => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const updn = n => n > 0 ? 'up' : n < 0 ? 'down' : 'muted';

// ── Toast ────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = Object.assign(document.createElement('div'), {className: `toast toast-${type}`, textContent: msg});
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), 4200);
}

// ── Screens & Modals ─────────────────────────────────────
let _curScreen = 'screen-landing';

function showScreen(id) {
  if (_curScreen === id) return;
  document.getElementById(_curScreen)?.setAttribute('hidden', '');
  document.getElementById(id).removeAttribute('hidden');
  _curScreen = id;
}
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeModalOutside(e, id) { if (e.target.id === id) closeModal(id); }

// ── Auth ─────────────────────────────────────────────────
async function doAuth(sid, name) {
  const u = `${sid} ${name}`;
  const data = await api.post('/api/auth/enter', {username: u});
  if (data.error) throw new Error(data.error);
  if (!data.user) throw new Error('서버 오류가 발생했습니다.');
  S.user = data.user;
  return data;
}

function onLogin(data) {
  S.user = data.user;
  if (data.active_room) {
    S.room = data.active_room;
    resumeRoom();
  } else {
    showLanding();
  }
}

function showLanding() {
  stopPolling(); stopTimer();
  showScreen('screen-landing');
}

function showHome() { showLanding(); }

async function doLogout() {
  stopPolling(); stopTimer();
  await api.post('/api/auth/logout', {});
  S.user = null; S.room = null;
  showLanding();
}

function goHome() {
  api.post('/api/auth/logout', {}).catch(() => {});
  S.user = null; S.room = null;
  showLanding();
}

// ── Room: Create ─────────────────────────────────────────
async function doCreateRoom() {
  const sid      = document.getElementById('host-student-id').value.trim();
  const hostName = document.getElementById('host-name').value.trim();
  const roomName = document.getElementById('room-name').value.trim();
  const dur  = parseInt(document.getElementById('room-duration').value) || 30;
  const cash = parseFloat(document.getElementById('room-cash').value)   || 10_000_000;
  const rate = parseFloat(document.getElementById('room-rate').value)   || 3;
  const err  = document.getElementById('create-err');
  err.textContent = '';
  if (!sid)      { err.textContent = '학번을 입력하세요.'; return; }
  if (!hostName) { err.textContent = '이름을 입력하세요.'; return; }
  if (!roomName) { err.textContent = '방 이름을 입력하세요.'; return; }
  try {
    await doAuth(sid, hostName);
  } catch(e) { err.textContent = e.message; return; }
  const data = await api.post('/api/rooms', {name: roomName, duration_minutes: dur, starting_cash: cash, deposit_rate: rate});
  if (data.error) { err.textContent = data.error; return; }
  S.room = data.room;
  enterHostLobby();
}

// ── Room: Join ───────────────────────────────────────────
async function doJoinRoom() {
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  const sid  = document.getElementById('join-student-id').value.trim();
  const name = document.getElementById('join-name').value.trim();
  const err  = document.getElementById('join-err');
  err.textContent = '';
  if (code.length !== 6) { err.textContent = '6자리 코드를 입력하세요.'; return; }
  if (!sid)  { err.textContent = '학번을 입력하세요.'; return; }
  if (!name) { err.textContent = '이름을 입력하세요.'; return; }
  try {
    await doAuth(sid, name);
  } catch(e) { err.textContent = e.message; return; }
  const data = await api.post('/api/rooms/join', {code});
  if (data.error) { err.textContent = data.error; return; }
  S.room = data.room;
  if (S.room.status === 'active') {
    enterParticipantGame();
  } else if (S.room.status === 'ended') {
    await loadResults();
    showScreen('screen-results');
  } else {
    enterParticipantLobby();
  }
}

function resumeRoom() {
  if (!S.room) return;
  if (S.room.is_host) {
    if (S.room.status === 'waiting') enterHostLobby();
    else if (S.room.status === 'active') enterHostGame();
    else loadResults();
  } else {
    if (S.room.status === 'waiting') enterParticipantLobby();
    else if (S.room.status === 'active') enterParticipantGame();
    else loadResults().then(() => showScreen('screen-results'));
  }
}

// ── Host: Lobby ──────────────────────────────────────────
function enterHostLobby() {
  document.getElementById('lobby-room-name').textContent = S.room.name;
  document.getElementById('lobby-code').textContent      = S.room.code;
  showScreen('screen-host-lobby');
  generateLobbyQR();
  loadLobbyMembers();
  S.pollInterval = setInterval(loadLobbyMembers, 5000);
}

function generateLobbyQR() {
  const el = document.getElementById('lobby-qr');
  el.innerHTML = '';
  const joinUrl = `${location.origin}${location.pathname}?code=${S.room.code}`;
  new QRCode(el, {
    text: joinUrl,
    width: 148,
    height: 148,
    colorDark: '#e6edf3',
    colorLight: '#0d1117',
    correctLevel: QRCode.CorrectLevel.M,
  });
}

async function loadLobbyMembers() {
  const data = await api.get(`/api/rooms/${S.room.id}/host/lobby-members`);
  if (data.error) return;
  document.getElementById('lobby-count').textContent = data.length;
  document.getElementById('lobby-members-list').innerHTML = data.length
    ? data.map(m => `<div class="lobby-member"><div class="avatar-sm">${m.username[0].toUpperCase()}</div><span style="font-weight:600">${m.username}</span></div>`).join('')
    : '<div class="muted" style="font-size:13px;padding:10px 0">아직 참여자가 없습니다.</div>';
}

function copyCode() {
  navigator.clipboard?.writeText(S.room.code).then(() => toast('코드가 복사되었습니다!', 'success'));
}

async function doStartGame() {
  const btn = document.getElementById('start-btn');
  btn.disabled = true;
  const data = await api.post(`/api/rooms/${S.room.id}/start`, {});
  if (data.error) { toast(data.error, 'error'); btn.disabled = false; return; }
  S.room = data.room;
  stopPolling();
  enterHostGame();
}

// ── Host: Game ───────────────────────────────────────────
function enterHostGame() {
  document.getElementById('host-room-name').textContent = S.room.name;
  document.getElementById('host-code').textContent      = S.room.code;
  showScreen('screen-host-game');
  startTimer('host-timer');
  switchHostTab('rank');
  loadHostMembers();
  loadNewsInterval();
  startNewsPolling();
  S.pollInterval = setInterval(() => {
    if (S.hostTab === 'rank') loadHostMembers();
    else loadHostMarket();
    refreshRoomStatus();
  }, 10000);
}

function switchHostTab(tab) {
  S.hostTab = tab;
  document.getElementById('htab-rank').classList.toggle('active', tab === 'rank');
  document.getElementById('htab-market').classList.toggle('active', tab === 'market');
  document.getElementById('htab-rank-content').hidden = tab !== 'rank';
  document.getElementById('htab-market-content').hidden = tab !== 'market';
  if (tab === 'market') loadHostMarket();
}

async function loadHostMarket() {
  const grid = document.getElementById('host-stock-grid');
  if (!grid) return;
  if (!grid.children.length) {
    grid.innerHTML = '<div class="loading-center"><span class="spinner"></span> 시세 불러오는 중…</div>';
  }
  const data = await api.get(`/api/rooms/${S.room.id}/stocks`);
  if (!data.stocks) return;

  const sel = document.getElementById('force-price-symbol');
  if (sel && !sel.options.length) {
    data.stocks.forEach(st => {
      const opt = document.createElement('option');
      opt.value = st.symbol;
      opt.textContent = `${st.name} (${st.symbol})`;
      sel.appendChild(opt);
    });
  }

  grid.innerHTML = data.stocks.map(st => {
    const cls   = st.change_pct > 0 ? 'chip-up' : st.change_pct < 0 ? 'chip-down' : 'chip-flat';
    const arrow = st.change_pct > 0 ? '▲' : st.change_pct < 0 ? '▼' : '─';
    const pColor = st.change_pct > 0 ? 'var(--up)' : st.change_pct < 0 ? 'var(--down)' : 'var(--text)';
    return `
      <div class="stock-card">
        <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${st.name}</div>
        <div style="color:var(--muted);font-size:11px;margin-top:1px">${st.symbol}</div>
        <div style="font-size:19px;font-weight:700;margin-top:8px;color:${pColor}">${krw(st.price)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span class="chip ${cls}" style="font-size:11px">${arrow} ${pct(st.change_pct)}</span>
          <span style="font-size:10px;color:var(--muted)">${st.sector}</span>
        </div>
      </div>`;
  }).join('');
}

async function doForcePrice(quickPct) {
  const symbol = document.getElementById('force-price-symbol').value;
  const pct = quickPct !== undefined ? quickPct : parseFloat(document.getElementById('force-price-pct').value);
  const msg = document.getElementById('force-price-msg');
  if (!symbol) { msg.textContent = '종목을 선택하세요.'; return; }
  if (isNaN(pct) || pct === 0) { msg.textContent = '변동률을 입력하세요.'; return; }
  const data = await api.post(`/api/rooms/${S.room.id}/host/force-price`, { symbol, pct });
  if (data.error) { msg.textContent = data.error; return; }
  const sign = pct > 0 ? '+' : '';
  msg.textContent = `적용됨: ${symbol} → ${data.price.toLocaleString()}원 (${sign}${pct}%)`;
  loadHostMarket();
}

async function loadNewsInterval() {
  const data = await api.get(`/api/rooms/${S.room.id}/host/news-interval`);
  if (data.news_seconds) document.getElementById('news-interval-input').value = data.news_seconds;
  if (data.price_seconds) document.getElementById('price-interval-input').value = data.price_seconds;
}

async function doSetIntervals() {
  const news  = parseInt(document.getElementById('news-interval-input').value);
  const price = parseInt(document.getElementById('price-interval-input').value);
  const msg   = document.getElementById('news-interval-msg');
  if (!news || news < 5 || news > 300 || !price || price < 5 || price > 300) {
    msg.style.color = 'var(--down)';
    msg.textContent = '모든 값을 5~300초 사이로 입력하세요.';
    return;
  }
  const data = await api.post(`/api/rooms/${S.room.id}/host/news-interval`, {
    news_seconds: news, price_seconds: price,
  });
  if (data.error) { msg.style.color = 'var(--down)'; msg.textContent = data.error; return; }
  msg.style.color = 'var(--up)';
  msg.textContent = `적용됨: 폭탄뉴스 ${data.news_seconds}초 · 주가변동 ${data.price_seconds}초`;
}

async function loadHostMembers() {
  const data = await api.get(`/api/rooms/${S.room.id}/host/members`);
  if (data.error) return;

  const list = document.getElementById('host-members-list');
  list.innerHTML = data.map(m => {
    const medal = m.rank === 1 ? '🥇' : m.rank === 2 ? '🥈' : m.rank === 3 ? '🥉' : m.rank + '위';
    const cls   = m.rank <= 3 ? ` rank-${m.rank}` : '';
    const sign  = m.gain_pct >= 0 ? '+' : '';
    return `
      <div class="host-member-row${cls}">
        <span style="font-size:18px;width:34px;text-align:center">${medal}</span>
        <span style="flex:1;font-weight:600">${m.username}</span>
        <span style="font-size:12px;${m.gain_pct>=0?'color:var(--up)':'color:var(--down)'}">
          ${sign}${m.gain_pct.toFixed(1)}%
        </span>
        <span style="font-weight:700;min-width:90px;text-align:right;font-size:13px">${krw(m.total_value)}</span>
        <button class="btn btn-secondary btn-sm" onclick="openAdjust(${m.user_id},'${m.username}',${m.cash})" style="margin-left:6px;padding:4px 8px">조정</button>
      </div>`;
  }).join('');

  // Bar chart
  renderHostBarChart(data);
}

function renderHostBarChart(members) {
  const ctx = document.getElementById('host-bar-chart').getContext('2d');
  const labels = members.map(m => m.username);
  const values = members.map(m => m.total_value);
  const colors = members.map(m => m.gain_pct >= 0 ? 'rgba(63,185,80,.7)' : 'rgba(248,81,73,.7)');
  const starting = S.room.starting_cash;

  if (S.hostBarChart) S.hostBarChart.destroy();
  S.hostBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('.7)', '1)')),
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: {display: false},
        tooltip: {callbacks: {label: ctx => krw(ctx.parsed.x)}},
      },
      scales: {
        x: {
          ticks: {color: '#8b949e', callback: v => (v/1000000).toFixed(1) + 'M'},
          grid: {color: '#21262d'},
          min: starting * 0.8,
        },
        y: {ticks: {color: '#e6edf3'}, grid: {display: false}},
      }
    }
  });
}

function openAdjust(uid, username, cash) {
  S.adjustTargetUid = uid;
  document.getElementById('adj-username').textContent     = username;
  document.getElementById('adj-current-cash').textContent = krw(cash);
  document.getElementById('adj-delta').value = '';
  document.getElementById('adj-note').value  = '';
  document.getElementById('adj-err').textContent = '';
  openModal('modal-adjust');
}

async function doAdjust() {
  const delta = parseFloat(document.getElementById('adj-delta').value);
  const note  = document.getElementById('adj-note').value.trim() || '진행자 자산 조정';
  const err   = document.getElementById('adj-err');
  err.textContent = '';
  if (isNaN(delta)) { err.textContent = '금액을 입력하세요.'; return; }
  const data = await api.post(`/api/rooms/${S.room.id}/host/adjust`, {user_id: S.adjustTargetUid, delta, note});
  if (data.error) { err.textContent = data.error; return; }
  toast(data.message, 'success');
  closeModal('modal-adjust');
  loadHostMembers();
}

async function doEndGame() {
  if (!confirm('게임을 종료하시겠습니까?')) return;
  const data = await api.post(`/api/rooms/${S.room.id}/end`, {});
  if (data.error) { toast(data.error, 'error'); return; }
  S.room = data.room;
  stopPolling(); stopTimer();
  await loadResults();
  showScreen('screen-results');
}

// ── Participant: Lobby ───────────────────────────────────
function enterParticipantLobby() {
  document.getElementById('plobby-room-name').textContent = S.room.name;
  document.getElementById('plobby-host-name').textContent = S.room.host_name;
  document.getElementById('plobby-settings').textContent  =
    `시작 자금: ${krw(S.room.starting_cash)} · 게임 시간: ${S.room.duration_minutes}분 · 예금 금리: ${S.room.deposit_rate}%`;
  showScreen('screen-p-lobby');
  loadPLobbyMembers();
  S.pollInterval = setInterval(async () => {
    loadPLobbyMembers();
    const r = await api.get(`/api/rooms/${S.room.id}`);
    if (r.status === 'active') {
      S.room = r; stopPolling(); enterParticipantGame();
    } else if (r.status === 'ended') {
      S.room = r; stopPolling();
      await loadResults(); showScreen('screen-results');
    }
  }, 3000);
}

async function loadPLobbyMembers() {
  const data = await api.get(`/api/rooms/${S.room.id}/host/lobby-members`).catch(() => []);
  if (!Array.isArray(data)) return;
  document.getElementById('plobby-count').textContent = data.length;
  document.getElementById('plobby-members-list').innerHTML = data.map(m =>
    `<div class="lobby-member"><div class="avatar-sm">${m.username[0].toUpperCase()}</div>
     <span style="font-weight:600">${m.username}</span></div>`
  ).join('');
}

// ── Participant: Game ────────────────────────────────────
function enterParticipantGame() {
  S.depRate = S.room.deposit_rate;
  document.getElementById('dep-rate-display').textContent = S.room.deposit_rate + '%';
  showScreen('screen-p-game');

  // Reset to market page
  PAGE_ORDER.forEach(p => {
    const el = document.getElementById(`pg-${p}`);
    if (p === 'market') el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  });

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-market').classList.add('active');
  S.currentPage = 'market';
  startTimer('pg-timer');
  loadMarket();
  refreshMyRank();
  startNewsPolling();
  startChatPolling();
  S.pollInterval = setInterval(async () => {
    const r = await api.get(`/api/rooms/${S.room.id}`);
    if (r.status === 'ended') {
      S.room = r; stopPolling(); stopTimer();
      toast('⏰ 게임이 종료되었습니다!', 'info');
      await loadResults();
      showScreen('screen-results');
    } else if (r.remaining_seconds !== undefined) {
      S.room = r;
    }
    refreshMyRank();
    if (S.currentPage === 'market') loadMarket();
  }, 5000);
}

async function refreshMyRank() {
  const data = await api.get(`/api/rooms/${S.room.id}/rankings`);
  if (data.error) return;
  const me = data.find(e => e.is_me);
  if (!me) return;

  document.getElementById('pg-rank').textContent = me.rank + '위';
  document.getElementById('pg-cash').textContent = krw(me.total_value);
  const gp = document.getElementById('pg-gain-pct');
  gp.textContent = pct(me.gain_pct);
  if (me.gain_pct > 0) gp.style.color = 'var(--up)';
  else if (me.gain_pct < 0) gp.style.color = 'var(--down)';
  else gp.style.color = 'var(--muted)';

  const now = new Date();
  const label = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  S.assetHistory.push({ label, value: me.total_value });
  if (S.assetHistory.length > 120) S.assetHistory.shift();
}

// ── Timer ─────────────────────────────────────────────────
function startTimer(elId) {
  stopTimer();
  function tick() {
    if (!S.room?.end_time) return;
    const rem = Math.max(0, Math.floor((new Date(S.room.end_time) - new Date()) / 1000));
    const el  = document.getElementById(elId);
    if (!el) return;
    el.textContent = `${String(Math.floor(rem/60)).padStart(2,'0')}:${String(rem%60).padStart(2,'0')}`;
    el.className   = 'timer-display' + (rem <= 60 ? ' danger' : rem <= 300 ? ' warn' : '');
    if (rem <= 0) stopTimer();
  }
  tick();
  S.timerInterval = setInterval(tick, 1000);
}

function stopTimer()   { clearInterval(S.timerInterval); S.timerInterval = null; }
function stopPolling() {
  clearInterval(S.pollInterval);  S.pollInterval = null;
  stopNewsPolling();
  stopChatPolling();
}

function startNewsPolling() {
  S.newsTs = 0;
  if (S.newsInterval) clearInterval(S.newsInterval);
  S.newsInterval = setInterval(async () => {
    if (!S.room) return;
    const data = await api.get(`/api/rooms/${S.room.id}/news`).catch(() => null);
    if (!data || !data.timestamp) return;
    if (data.timestamp > S.newsTs) {
      S.newsTs = data.timestamp;
      if (data.items && data.items.length) showBombNews(data.items, data.show_hint !== false);
    }
  }, 3000);
}

function stopNewsPolling() {
  if (S.newsInterval) { clearInterval(S.newsInterval); S.newsInterval = null; }
  if (_newsPopupTimer) { clearTimeout(_newsPopupTimer); _newsPopupTimer = null; }
  const popup = document.getElementById('bomb-news-popup');
  if (popup) popup.style.display = 'none';
}

// ── Quiz ─────────────────────────────────────────────────
let _quizTimeSec = 30;
let _quizTimerTick = null;

async function openQuiz() {
  const overlay = document.getElementById('quiz-overlay');
  overlay.style.display = 'flex';
  document.getElementById('quiz-result').style.display = 'none';
  document.getElementById('quiz-btns').style.display = 'flex';
  document.getElementById('quiz-cooldown-msg').style.display = 'none';
  document.getElementById('quiz-question').textContent = '불러오는 중…';

  const data = await api.get(`/api/rooms/${S.room.id}/quiz`);
  if (data.error) {
    document.getElementById('quiz-question').textContent = data.error;
    document.getElementById('quiz-btns').style.display = 'none';
    return;
  }
  if (data.cooldown > 0) {
    document.getElementById('quiz-question').style.display = 'none';
    document.getElementById('quiz-btns').style.display = 'none';
    const msg = document.getElementById('quiz-cooldown-msg');
    msg.style.display = '';
    msg.textContent = `⏳ ${data.cooldown}초 후에 다시 도전할 수 있습니다`;
    return;
  }
  document.getElementById('quiz-question').style.display = '';
  document.getElementById('quiz-question').textContent = data.question;
  _quizTimeSec = 30;
  document.getElementById('quiz-timer-fill').style.width = '100%';
  if (_quizTimerTick) clearInterval(_quizTimerTick);
  _quizTimerTick = setInterval(() => {
    _quizTimeSec--;
    document.getElementById('quiz-timer-fill').style.width = (_quizTimeSec / 30 * 100) + '%';
    document.getElementById('quiz-timer-sec').textContent = _quizTimeSec;
    if (_quizTimeSec <= 0) {
      clearInterval(_quizTimerTick);
      submitQuiz(null);
    }
  }, 1000);
}

async function submitQuiz(answer) {
  if (_quizTimerTick) { clearInterval(_quizTimerTick); _quizTimerTick = null; }
  document.getElementById('quiz-btns').style.display = 'none';
  const result = document.getElementById('quiz-result');
  result.style.display = '';
  if (answer === null) {
    result.innerHTML = `<div style="font-size:28px">⏰</div><div style="color:var(--muted);margin-top:8px">시간 초과!</div>`;
    await api.post(`/api/rooms/${S.room.id}/quiz`, { answer: false });
    return;
  }
  const data = await api.post(`/api/rooms/${S.room.id}/quiz`, { answer });
  if (data.correct) {
    result.innerHTML = `<div style="font-size:32px">⭕</div><div style="color:var(--up);font-weight:700;font-size:18px;margin-top:8px">정답! +${data.reward.toLocaleString()}원</div><div style="color:var(--muted);font-size:13px;margin-top:8px">${data.explanation}</div>`;
    toast(`+${data.reward.toLocaleString()}원 획득!`, 'success');
  } else {
    result.innerHTML = `<div style="font-size:32px">❌</div><div style="color:var(--down);font-weight:700;font-size:18px;margin-top:8px">오답</div><div style="color:var(--muted);font-size:13px;margin-top:8px">${data.explanation}</div>`;
  }
}

function closeQuiz() {
  if (_quizTimerTick) { clearInterval(_quizTimerTick); _quizTimerTick = null; }
  document.getElementById('quiz-overlay').style.display = 'none';
}

// ── Chat ─────────────────────────────────────────────────
let _chatHistory = [];

async function renderChatHistory() {
  const list = document.getElementById('chat-messages');
  if (!list) return;
  list.innerHTML = '';
  // 최근 50개 메시지를 서버에서 다시 가져와 렌더링
  const data = await api.get(`/api/rooms/${S.room.id}/chat?after=0`).catch(() => []);
  _chatHistory = data;
  data.forEach(m => {
    const mine = m.user_id === S.user?.id;
    const row = document.createElement('div');
    row.className = `chat-row ${mine ? 'mine' : 'other'}`;
    row.innerHTML = `
      <div class="chat-meta ${mine ? 'mine' : ''}">${m.username} · ${m.time}</div>
      <div class="chat-bubble ${mine ? 'mine' : 'other'}">${escHtml(m.message)}</div>`;
    list.appendChild(row);
    S.chatLastId = Math.max(S.chatLastId, m.id || 0);
  });
  list.scrollTop = list.scrollHeight;
}

function startChatPolling() {
  S.chatLastId = 0;
  S.chatUnread = 0;
  if (S.chatInterval) clearInterval(S.chatInterval);
  S.chatInterval = setInterval(() => fetchChatBackground(), 3000);
}

function stopChatPolling() {
  if (S.chatInterval) { clearInterval(S.chatInterval); S.chatInterval = null; }
}

function updateChatBadge() {
  const badge = document.getElementById('chat-badge');
  if (!badge) return;
  if (S.chatUnread > 0) {
    badge.style.display = '';
    badge.textContent = S.chatUnread > 99 ? '99+' : S.chatUnread;
  } else {
    badge.style.display = 'none';
  }
}

async function fetchChatBackground() {
  if (!S.room) return;
  const data = await api.get(`/api/rooms/${S.room.id}/chat?after=${S.chatLastId}`).catch(() => []);
  if (!data.length) return;

  const onChat = S.currentPage === 'chat';
  const list = onChat ? document.getElementById('chat-messages') : null;
  const atBottom = list ? list.scrollHeight - list.scrollTop <= list.clientHeight + 50 : false;

  data.forEach(m => {
    const mine = m.user_id === S.user?.id;
    if (list) {
      const row = document.createElement('div');
      row.className = `chat-row ${mine ? 'mine' : 'other'}`;
      row.innerHTML = `
        <div class="chat-meta ${mine ? 'mine' : ''}">${m.username} · ${m.time}</div>
        <div class="chat-bubble ${mine ? 'mine' : 'other'}">${escHtml(m.message)}</div>`;
      list.appendChild(row);
    }
    if (!onChat && !mine) {
      S.chatUnread++;
    }
    S.chatLastId = Math.max(S.chatLastId, m.id);
  });

  if (list && atBottom) list.scrollTop = list.scrollHeight;
  updateChatBadge();
}

async function doSendChat() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  await api.post(`/api/rooms/${S.room.id}/chat`, { message: msg });
  await fetchChatBackground();
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function doSendNews() {
  const showHint = document.getElementById('news-hint-checkbox').checked;
  await api.post(`/api/rooms/${S.room.id}/host/send-news`, { show_hint: showHint });
}

function showBombNews(items, showHint = true) {
  const popup  = document.getElementById('bomb-news-popup');
  const content = document.getElementById('bomb-news-content');
  const bar    = document.getElementById('bomb-news-bar');
  if (!popup || !content || !bar) return;

  content.innerHTML = items.map(item => {
    if (!showHint) {
      return `<div class="bomb-news-headline">${item.headline}</div>`;
    }
    const arrow = item.direction === 'up' ? '▲' : '▼';
    const cls   = item.direction === 'up' ? 'news-up' : 'news-down';
    return `<div class="bomb-news-headline ${cls}">${arrow} ${item.headline}</div>`;
  }).join('');

  // 애니메이션 리셋
  popup.style.display = 'flex';
  const inner = popup.querySelector('.bomb-news-inner');
  inner.style.animation = 'none';
  bar.style.animation = 'none';
  void inner.offsetWidth;
  inner.style.animation = '';
  bar.style.animation = 'bombProgress 3s linear forwards';

  if (_newsPopupTimer) clearTimeout(_newsPopupTimer);
  _newsPopupTimer = setTimeout(() => {
    popup.style.display = 'none';
  }, 3000);
}

async function refreshRoomStatus() {
  const r = await api.get(`/api/rooms/${S.room.id}`);
  if (r.status === 'ended') {
    S.room = r; stopPolling(); stopTimer();
    await loadResults(); showScreen('screen-results');
  }
}

// ── Navigation (participant game) ────────────────────────
const PAGE_ORDER = ['market', 'portfolio', 'deposit', 'rankings', 'education', 'chat'];

function showPage(page) {
  if (S.currentPage === page) return;

  document.getElementById(`pg-${S.currentPage}`).setAttribute('hidden', '');
  document.getElementById(`pg-${page}`).removeAttribute('hidden');

  S.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`nav-${page}`).classList.add('active');

  if (page === 'portfolio') loadPortfolio();
  if (page === 'deposit')   loadDepositsPage();
  if (page === 'rankings')  loadParticipantRankings();
  if (page === 'education') loadEducation();
  if (page === 'chat') {
    S.chatUnread = 0;
    updateChatBadge();
    renderChatHistory();
  }

  const fab = document.querySelector('.quiz-fab');
  if (fab) fab.style.display = page === 'chat' ? 'none' : '';
}

// ── Market ───────────────────────────────────────────────
async function loadMarket() {
  const grid = document.getElementById('stock-grid');
  if (!S.stocks.length) {
    grid.innerHTML = '<div class="loading-center"><span class="spinner"></span> 시세 불러오는 중…</div>';
  }
  const data = await api.get(`/api/rooms/${S.room.id}/stocks`);
  if (!data.stocks) return;
  const prev = Object.fromEntries(S.stocks.map(s => [s.symbol, s.price]));
  S.stocks  = data.stocks;
  S.sectors = data.sectors;
  renderSectors();
  renderGrid(S.stocks, prev);
}

function renderSectors() {
  const sectors = [...new Set(S.stocks.map(st => st.sector))].sort();
  document.getElementById('sector-filters').innerHTML = ['전체', ...sectors].map(s => {
    const act = (s === '전체' && !S.activeSector) || s === S.activeSector;
    return `<button class="sector-btn${act?' active':''}" onclick="setSector('${s}')">${s}</button>`;
  }).join('');
}

function setSector(s) {
  S.activeSector = s === '전체' ? '' : s;
  renderSectors();
  filterStocks();
}

function filterStocks() {
  const q = (document.getElementById('stock-search').value || '').toLowerCase();
  const filtered = S.stocks.filter(st =>
    (!S.activeSector || st.sector === S.activeSector) &&
    (!q || st.name.toLowerCase().includes(q) || st.symbol.toLowerCase().includes(q)) &&
    (!S.watchlistOnly || S.watchlist.has(st.symbol))
  );
  if (S.watchlistOnly && !filtered.length) {
    document.getElementById('stock-grid').innerHTML =
      '<div class="empty-state"><div class="e-icon">⭐</div>관심 종목을 추가해보세요</div>';
    return;
  }
  renderGrid(filtered, {});
}

function toggleWatchlistFilter() {
  S.watchlistOnly = !S.watchlistOnly;
  const btn = document.getElementById('watchlist-filter-btn');
  if (btn) btn.style.background = S.watchlistOnly ? 'var(--warn)' : '';
  filterStocks();
}

function toggleWatchlist(symbol, e) {
  e.stopPropagation();
  if (S.watchlist.has(symbol)) S.watchlist.delete(symbol);
  else S.watchlist.add(symbol);
  localStorage.setItem('watchlist', JSON.stringify([...S.watchlist]));
  filterStocks();
}

function renderGrid(stocks, prevPrices) {
  const grid = document.getElementById('stock-grid');
  if (!stocks.length) {
    grid.innerHTML = '<div class="empty-state"><div class="e-icon">🔍</div>검색 결과 없음</div>';
    return;
  }
  grid.innerHTML = stocks.map(st => {
    const cls    = st.change_pct > 0 ? 'chip-up' : st.change_pct < 0 ? 'chip-down' : 'chip-flat';
    const arrow  = st.change_pct > 0 ? '▲' : st.change_pct < 0 ? '▼' : '─';
    const pColor = st.change_pct > 0 ? 'var(--up)' : st.change_pct < 0 ? 'var(--down)' : 'var(--text)';
    const starred = S.watchlist.has(st.symbol);
    return `
      <div class="stock-card" id="sc-${st.symbol.replace('.','_')}" onclick="openStockModal('${st.symbol}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${st.name}</div>
          <button onclick="toggleWatchlist('${st.symbol}',event)" style="background:none;border:none;cursor:pointer;font-size:14px;padding:0 0 0 4px;line-height:1;color:${starred?'var(--warn)':'var(--muted)'}">${starred?'★':'☆'}</button>
        </div>
        <div style="color:var(--muted);font-size:11px;margin-top:1px">${st.symbol}</div>
        <div style="font-size:19px;font-weight:700;margin-top:8px;color:${pColor}">${krw(st.price)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span class="chip ${cls}" style="font-size:11px">${arrow} ${pct(st.change_pct)}</span>
          <span style="font-size:10px;color:var(--muted)">${st.sector}</span>
        </div>
      </div>`;
  }).join('');

  // Flash animation on price change
  stocks.forEach(st => {
    const prev = prevPrices[st.symbol];
    if (prev && prev !== st.price) {
      const el = document.getElementById('sc-' + st.symbol.replace('.','_'));
      if (el) {
        el.classList.remove('flash-up','flash-down');
        void el.offsetWidth;
        el.classList.add(st.price > prev ? 'flash-up' : 'flash-down');
      }
    }
  });
}

// ── Stock Modal & Chart ──────────────────────────────────
async function openStockModal(symbol) {
  const st = S.stocks.find(s => s.symbol === symbol);
  if (!st) return;
  S.tradeSymbol = symbol;
  S.tradePrice  = st.price;

  document.getElementById('ms-name').textContent    = st.name;
  document.getElementById('ms-sector').textContent  = st.sector;
  document.getElementById('ms-price').textContent   = krw(st.price);
  const chEl = document.getElementById('ms-change');
  chEl.textContent = `${st.change_pct >= 0 ? '▲' : '▼'} ${pct(st.change_pct)}`;
  chEl.className = updn(st.change_pct);

  document.getElementById('trade-qty').value = 1;
  document.getElementById('trade-fb').textContent = '';
  updateTotal();

  // cash & holding
  const port = await api.get(`/api/rooms/${S.room.id}/portfolio`);
  if (!port.error) {
    document.getElementById('ms-cash').textContent = krw(port.cash);
    const h = (port.holdings || []).find(x => x.symbol === symbol);
    document.getElementById('ms-holding').textContent = h ? `${h.shares}주` : '0주';
  }

  document.querySelectorAll('.period-tab').forEach((b, i) => b.classList.toggle('active', i === 2));
  openModal('modal-stock');
  loadChart('1mo');
}

async function loadChart(period) {
  document.querySelectorAll('.period-tab').forEach(b =>
    b.classList.toggle('active', b.textContent === {
      '1d':'1일','1w':'1주','1mo':'1달','3mo':'3달','1y':'1년'
    }[period])
  );
  const data = await api.get(`/api/rooms/${S.room.id}/stocks/${S.tradeSymbol}/chart?period=${period}`);
  const hist = data.history || [];
  if (!hist.length) return;

  const labels = hist.map(h => h.date);
  const closes = hist.map(h => h.close);
  const isUp   = closes.at(-1) >= closes[0];
  const color  = isUp ? '#3fb950' : '#f85149';
  const ctx    = document.getElementById('stock-chart').getContext('2d');

  if (S.stockChart) S.stockChart.destroy();
  S.stockChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: closes,
        borderColor: color,
        backgroundColor: color + '22',
        fill: true, tension: 0.3,
        pointRadius: hist.length > 60 ? 0 : 2,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {legend:{display:false}, tooltip:{callbacks:{label: c => krw(c.parsed.y)}}},
      scales: {
        x: {ticks:{color:'#8b949e', maxTicksLimit:6}, grid:{color:'#21262d'}},
        y: {ticks:{color:'#8b949e', callback: v => (v/1000).toFixed(0)+'K'}, grid:{color:'#21262d'}},
      }
    }
  });
}

// ── Trade ────────────────────────────────────────────────
function adjQty(d) {
  const el = document.getElementById('trade-qty');
  el.value = Math.max(1, (parseInt(el.value) || 1) + d);
  updateTotal();
}
function updateTotal() {
  const n = parseInt(document.getElementById('trade-qty').value) || 0;
  document.getElementById('trade-total').textContent = krw(n * S.tradePrice);
}

async function refreshTotalAsset() {
  const port = await api.get(`/api/rooms/${S.room.id}/portfolio`);
  if (!port.error) document.getElementById('pg-cash').textContent = krw(port.total_value);
}

async function execTrade(action) {
  const shares = parseInt(document.getElementById('trade-qty').value);
  if (!shares) return;
  const fb = document.getElementById('trade-fb');
  fb.textContent = '';
  const data = await api.post(`/api/rooms/${S.room.id}/trade`, {symbol: S.tradeSymbol, action, shares});
  if (data.error) { fb.style.color = 'var(--down)'; fb.textContent = data.error; return; }
  fb.style.color = 'var(--up)'; fb.textContent = data.message;
  toast(data.message, 'success');
  S.depCash = data.cash;
  document.getElementById('ms-cash').textContent = krw(data.cash);
  refreshTotalAsset();
  refreshMyRank();
}

// ── Portfolio ────────────────────────────────────────────
async function loadPortfolio() {
  const data = await api.get(`/api/rooms/${S.room.id}/portfolio`);
  if (data.error) return;

  const gainClass = data.total_gain >= 0 ? 'up' : 'down';
  document.getElementById('port-summary').innerHTML = `
    <div class="summary-card">
      <div class="summary-label">총 자산</div>
      <div class="summary-value">${krw(data.total_value)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">보유 현금</div>
      <div class="summary-value accent">${krw(data.cash)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">수익률</div>
      <div class="summary-value ${gainClass}">${pct(data.total_gain_pct)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">예금 잠금</div>
      <div class="summary-value" style="color:var(--warn)">${krw(data.deposits_locked)}</div>
    </div>`;

  // Donut chart
  const labels = ['현금', ...data.holdings.map(h => h.name)];
  const values = [data.cash, ...data.holdings.map(h => h.current_value)];
  if (data.deposits_locked > 0) { labels.push('예금'); values.push(data.deposits_locked); }
  const COLORS = ['#58a6ff','#3fb950','#f85149','#e3b341','#8957e5','#56d364',
                  '#c0392b','#2ecc71','#3498db','#d4af37','#ff6b6b','#4ecdc4'];
  const ctx = document.getElementById('port-donut').getContext('2d');
  if (S.portChart) S.portChart.destroy();
  if (values.some(v => v > 0)) {
    document.getElementById('port-donut').parentElement.style.display = '';
    S.portChart = new Chart(ctx, {
      type: 'doughnut',
      data: {labels, datasets:[{data: values, backgroundColor: COLORS.slice(0, values.length),
                                borderColor: '#161b22', borderWidth: 2}]},
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: {
          legend: {position:'right', labels:{color:'#8b949e', font:{size:11}, boxWidth:12}},
          tooltip: {callbacks: {label: c => `${c.label}: ${krw(c.parsed)}`}},
        }
      }
    });
  } else {
    document.getElementById('port-donut').parentElement.style.display = 'none';
  }

  // Asset history line chart
  const lineCtx = document.getElementById('asset-line-chart')?.getContext('2d');
  if (lineCtx && S.assetHistory.length >= 2) {
    const starting = S.room?.starting_cash || S.assetHistory[0]?.value || 1;
    const lineColor = data.total_gain >= 0 ? '#3fb950' : '#f85149';
    if (S.assetLineChart) S.assetLineChart.destroy();
    S.assetLineChart = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels: S.assetHistory.map(p => p.label),
        datasets: [{
          data: S.assetHistory.map(p => p.value),
          borderColor: lineColor,
          backgroundColor: lineColor + '22',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => krw(c.parsed.y) } },
        },
        scales: {
          x: { ticks: { color: '#8b949e', maxTicksLimit: 6, font: { size: 10 } }, grid: { display: false } },
          y: {
            ticks: { color: '#8b949e', font: { size: 10 }, callback: v => (v/10000).toFixed(0)+'만' },
            grid: { color: '#21262d' },
            suggestedMin: starting * 0.95,
          }
        }
      }
    });
  }

  // Holdings
  const hList = document.getElementById('holdings-list');
  if (!data.holdings.length) {
    hList.innerHTML = '<div class="empty-state"><div class="e-icon">📭</div>보유 종목 없음</div>';
  } else {
    hList.innerHTML = data.holdings.map(h => `
      <div class="holding-item">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600">${h.name}</div>
          <div class="muted" style="font-size:11px">${h.shares}주 · 평균 ${krw(h.avg_price)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700">${krw(h.current_value)}</div>
          <div class="${updn(h.gain_pct)}" style="font-size:12px">${pct(h.gain_pct)}</div>
        </div>
      </div>`).join('');
  }

  // Transactions
  S.txnPage = 1;
  await loadTxn(true);
}

async function loadTxn(reset = false) {
  const data = await api.get(`/api/rooms/${S.room.id}/transactions?page=${S.txnPage}`);
  S.txnTotalPages = data.pages || 1;
  const list = document.getElementById('txn-list');
  if (!data.transactions?.length && reset) {
    list.innerHTML = '<div class="empty-state"><div class="e-icon">📋</div>거래 내역 없음</div>';
    return;
  }
  const html = (data.transactions || []).map(t => `
    <div class="txn-item">
      <div>
        <div style="font-weight:600">${t.name}</div>
        <div class="muted" style="font-size:11px">${t.timestamp}${t.note ? ' · ' + t.note : ''}</div>
      </div>
      <div style="text-align:right">
        <span class="txn-badge ${t.action.toLowerCase()}">${t.action==='BUY'?'매수':t.action==='SELL'?'매도':'조정'}</span>
        ${t.action !== 'ADJ' ? `<div class="muted" style="font-size:11px">${t.shares}주 · ${krw(t.price)}</div>` : ''}
        <div style="font-weight:600">${t.action==='ADJ'?(t.amount>=0?'+':'')+krw(t.amount):krw(t.amount)}</div>
      </div>
    </div>`).join('');
  if (reset) list.innerHTML = html; else list.insertAdjacentHTML('beforeend', html);
  document.getElementById('txn-more-wrap').hidden = S.txnPage >= S.txnTotalPages;
}

async function loadMoreTxn() { S.txnPage++; await loadTxn(false); }

// ── Deposits ─────────────────────────────────────────────
function setDepPct(pct) {
  const cash = S.depCash || 0;
  const amount = Math.floor(cash * pct / 100 / 10000) * 10000;
  document.getElementById('dep-amount').value = amount > 0 ? amount : '';
  updateDepPreview();
}

function updateDepPreview() {
  const amount = parseFloat(document.getElementById('dep-amount').value) || 0;
  const preview = document.getElementById('dep-preview');
  if (amount > 0) {
    const totalSec   = (S.room?.duration_minutes || 30) * 60;
    const remaining  = S.room?.remaining_seconds ?? totalSec;
    const ratio      = totalSec > 0 ? Math.min(1, remaining / totalSec) : 1;
    const interest   = amount * S.depRate / 100 * ratio;
    const maxInterest = amount * S.depRate / 100;
    document.getElementById('dep-preview-interest').textContent = '+' + krw(interest);
    document.getElementById('dep-preview-total').textContent    = krw(amount + interest);
    document.getElementById('dep-preview-max').textContent      = krw(maxInterest);
    preview.style.display = '';
  } else {
    preview.style.display = 'none';
  }
}

async function loadDepositsPage() {
  const port = await api.get(`/api/rooms/${S.room.id}/portfolio`);
  if (!port.error) {
    document.getElementById('dep-cash-display').textContent = krw(port.cash);
    S.depCash = port.cash;
  }
  const data = await api.get(`/api/rooms/${S.room.id}/deposits`);
  const list = document.getElementById('deposits-list');
  const active = (data || []).filter(d => d.status === 'active');
  if (!active.length) {
    list.innerHTML = '<div class="empty-state"><div class="e-icon">🏦</div>활성 예금 없음</div>';
    return;
  }
  list.innerHTML = active.map(d => `
    <div class="deposit-item">
      <div>
        <div style="font-weight:600">${krw(d.amount)}</div>
        <div class="muted" style="font-size:11px">${d.created_at} · 금리 ${d.rate}%</div>
        <div style="color:var(--up);font-size:12px">현재 예상 이자 +${krw(d.expected_interest)}</div>
        <div style="color:var(--muted);font-size:11px">최대 이자 +${krw(d.max_interest)}</div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="doWithdraw(${d.id})" style="color:var(--down)">해지</button>
    </div>`).join('');
}

async function doDeposit() {
  const amount = parseFloat(document.getElementById('dep-amount').value);
  const err = document.getElementById('dep-err');
  err.textContent = '';
  if (!amount || amount <= 0) { err.textContent = '금액을 입력하세요.'; return; }
  const data = await api.post(`/api/rooms/${S.room.id}/deposits`, {amount});
  if (data.error) { err.textContent = data.error; return; }
  toast(data.message, 'success');
  document.getElementById('dep-amount').value = '';
  document.getElementById('dep-preview').style.display = 'none';
  S.depCash = data.cash;
  document.getElementById('dep-cash-display').textContent = krw(data.cash);
  refreshTotalAsset();
  loadDepositsPage();
}

async function doWithdraw(id) {
  if (!confirm('예금을 해지하면 이자가 지급되지 않습니다. 계속하시겠습니까?')) return;
  const data = await api.del(`/api/rooms/${S.room.id}/deposits/${id}`);
  if (data.error) { toast(data.error, 'error'); return; }
  toast(data.message, 'info');
  S.depCash = data.cash;
  refreshTotalAsset();
  loadDepositsPage();
}

// ── Rankings ─────────────────────────────────────────────
async function loadParticipantRankings() {
  const list = document.getElementById('p-rankings-list');
  list.innerHTML = '<div class="loading-center"><span class="spinner"></span></div>';
  const data = await api.get(`/api/rooms/${S.room.id}/rankings`);
  if (!data.length) { list.innerHTML = '<div class="empty-state">참여자 없음</div>'; return; }
  list.innerHTML = data.map(e => {
    const medal = e.rank===1?'🥇':e.rank===2?'🥈':e.rank===3?'🥉':e.rank+'위';
    return `
      <div class="rank-row${e.rank<=3?' rank-'+e.rank:''}${e.is_me?' me':''}">
        <div class="rank-num">${medal}</div>
        <div class="rank-user">${e.username}${e.is_me?'<span class="chip chip-blue" style="font-size:10px;margin-left:6px">나</span>':''}</div>
        <div style="text-align:right">
          <div style="font-weight:700;font-size:13px">${krw(e.total_value)}</div>
          <div class="${updn(e.gain_pct)}" style="font-size:12px">${pct(e.gain_pct)}</div>
        </div>
      </div>`;
  }).join('');
}

// ── Results ──────────────────────────────────────────────
function parseUsername(username) {
  const parts = username.split(' ');
  const sid  = parts[0];
  const name = parts.slice(1).join(' ') || username;
  return {sid, name};
}

async function loadResults() {
  document.getElementById('results-room-name').textContent = S.room?.name || '';
  const data = await api.get(`/api/rooms/${S.room.id}/rankings`);
  const list = document.getElementById('results-list');
  list.innerHTML = data.map(e => {
    const medal = e.rank===1?'🥇':e.rank===2?'🥈':e.rank===3?'🥉':e.rank+'위';
    const {sid, name} = parseUsername(e.username);
    return `
      <div class="results-row${e.rank<=3?' rank-'+e.rank:''}">
        <div style="font-size:20px;width:36px;text-align:center">${medal}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700">${name}${e.is_me?'<span class="chip chip-blue" style="font-size:10px;margin-left:4px">나</span>':''}</div>
          <div style="font-size:11px;color:var(--muted)">${sid}</div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:700">${krw(e.total_value)}</div>
          <div class="${updn(e.gain_pct)}" style="font-size:12px">${pct(e.gain_pct)}</div>
        </div>
      </div>`;
  }).join('');

  renderResultsChart(data);

  const me = data.find(e => e.is_me);
  const myStats = document.getElementById('results-my-stats');
  if (me) {
    myStats.innerHTML = `
      <div class="section-title" style="margin-bottom:10px">내 결과</div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span class="muted">최종 순위</span><span style="font-weight:700">${me.rank}위</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span class="muted">최종 자산</span><span style="font-weight:700">${krw(me.total_value)}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span class="muted">총 수익률</span>
        <span class="${updn(me.gain_pct)}" style="font-weight:700">${pct(me.gain_pct)}</span>
      </div>`;
  } else {
    myStats.innerHTML = '';
  }

  const exportWrap = document.getElementById('results-export-wrap');
  if (exportWrap) exportWrap.hidden = !S.room?.is_host;
}

function downloadExcel() {
  window.location.href = `/api/rooms/${S.room.id}/export`;
}

function renderResultsChart(data) {
  const sorted = [...data].sort((a, b) => b.total_value - a.total_value);
  const labels = sorted.map(e => {
    const {sid, name} = parseUsername(e.username);
    return [name, sid];
  });
  const values = sorted.map(e => e.total_value);
  const colors = sorted.map(e => e.gain_pct >= 0 ? 'rgba(63,185,80,.75)' : 'rgba(248,81,73,.75)');

  const wrap = document.getElementById('results-chart-wrap');
  wrap.style.height = Math.max(220, sorted.length * 52) + 'px';

  if (S.resultsBarChart) S.resultsBarChart.destroy();
  S.resultsBarChart = new Chart(
    document.getElementById('results-bar-chart').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('.75)', '1)')),
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {display: false},
        tooltip: {callbacks: {label: c => krw(c.parsed.x)}},
      },
      scales: {
        x: {
          ticks: {color: '#8b949e', callback: v => (v/1000000).toFixed(1) + 'M'},
          grid: {color: '#21262d'},
          min: S.room?.starting_cash ? S.room.starting_cash * 0.75 : 0,
        },
        y: {ticks: {color: '#e6edf3', font: {size: 12}}, grid: {display: false}},
      }
    }
  });
}

// ── Education ────────────────────────────────────────────
function loadEducation() { switchEduTab(S.eduTab); }

function switchEduTab(tab) {
  S.eduTab = tab;
  ['glossary','guides','tips'].forEach(t => {
    document.getElementById(`edu-${t}`).style.display = t === tab ? '' : 'none';
  });
  document.querySelectorAll('.edu-tab').forEach((b, i) =>
    b.classList.toggle('active', ['glossary','guides','tips'][i] === tab)
  );
  if (tab === 'glossary' && !S.glossaryData.length) loadGlossary();
  if (tab === 'guides')   loadGuides();
  if (tab === 'tips')     loadTips();
}

async function loadGlossary() {
  const data = await api.get('/api/education/glossary');
  S.glossaryData = data; renderGlossary(data);
}

function renderGlossary(data) {
  const cats = [...new Set(data.map(g => g.category))];
  document.getElementById('glossary-list').innerHTML = cats.map(cat => {
    const items = data.filter(g => g.category === cat);
    return `<div style="margin-bottom:14px">
      <div class="muted" style="font-size:11px;font-weight:600;text-transform:uppercase;margin-bottom:6px">${cat}</div>
      ${items.map(g => `
        <div class="glossary-item" onclick="this.classList.toggle('expanded')">
          <div style="display:flex;justify-content:space-between">
            <span style="font-weight:600">${g.term}</span>
            <span class="muted">+</span>
          </div>
          <div class="glossary-def">${g.definition}</div>
        </div>`).join('')}
    </div>`;
  }).join('');
}

async function searchGlossary() {
  const q = document.getElementById('glossary-search').value.trim();
  const data = await api.get(`/api/education/glossary?q=${encodeURIComponent(q)}`);
  S.glossaryData = data; renderGlossary(data);
}

async function loadGuides() {
  const data = await api.get('/api/education/guides');
  document.getElementById('guides-list').innerHTML = data.map(g => `
    <div class="guide-card" onclick="openGuide(${g.id})">
      <div style="font-size:28px">${g.emoji}</div>
      <div>
        <div style="font-weight:600;margin-bottom:3px">${g.title}</div>
        <div class="muted" style="font-size:12px">${g.summary}</div>
        <span class="chip chip-blue" style="margin-top:5px;font-size:10px">${g.category}</span>
      </div>
    </div>`).join('');
}

async function openGuide(id) {
  const data = await api.get(`/api/education/guides/${id}`);
  document.getElementById('guide-emoji').textContent = data.emoji;
  document.getElementById('guide-title').textContent = data.title;
  document.getElementById('guide-cat').textContent   = data.category;
  document.getElementById('guide-body').innerHTML = data.content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  openModal('modal-guide');
}

async function loadTips() {
  const data = await api.get('/api/education/tips');
  document.getElementById('tips-list').innerHTML = data.map(t => `
    <div class="tip-card">
      <div style="font-size:22px">${t.emoji}</div>
      <div>
        <div style="font-weight:600;margin-bottom:3px">${t.title}</div>
        <div class="muted" style="font-size:12px;line-height:1.6">${t.content}</div>
      </div>
    </div>`).join('');
}

function showEduStandalone() {
  // Show education page from home — reuse the screen-p-game's education tab
  // by showing just that tab without the full game UI
  toast('학습은 게임 중 [학습] 탭에서 볼 수 있습니다.', 'info');
}

// ── REMOVED: Pomodoro moved to /pomodoro (standalone app)
const _PT_REMOVED = {
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
const PT_C = 2 * Math.PI * PT_R; // ≈ 691.15

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

  // ring
  const ring = document.getElementById('pt-progress-ring');
  if (ring) {
    ring.setAttribute('stroke', m.color);
    ring.setAttribute('stroke-dashoffset', dashOffset.toFixed(2));
    ring.style.filter = `drop-shadow(0 0 8px ${m.color})`;
  }

  // glow
  const glow = document.getElementById('pt-glow');
  if (glow) glow.style.background = `radial-gradient(circle, ${m.glow} 0%, transparent 70%)`;

  // time & label
  const disp = document.getElementById('pt-time-display');
  if (disp) {
    disp.textContent = ptFormatTime(PT.timeLeft);
    disp.style.textShadow = `0 0 20px ${m.color}66`;
    disp.classList.toggle('pulse', PT.running && PT.timeLeft <= 10);
  }
  const lbl = document.getElementById('pt-mode-label');
  if (lbl) { lbl.textContent = m.label.toUpperCase(); lbl.style.color = m.color; }

  // start button
  const btn = document.getElementById('pt-start-btn');
  if (btn) { btn.textContent = PT.running ? '⏸ 일시정지' : '▶ 시작'; btn.style.background = m.color; }

  // mode tabs
  ['study', 'short', 'long'].forEach(k => {
    const tab = document.getElementById(`pt-tab-${k}`);
    if (!tab) return;
    const active = k === PT.mode;
    tab.style.color = active ? m.color : '';
    tab.style.borderColor = active ? m.color : '';
    tab.style.background = active ? `${m.color}18` : '';
  });

  // dots
  const filled = PT.completedPomodoros % 4;
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`pt-dot-${i}`);
    if (!dot) continue;
    dot.style.setProperty('--pt-color', m.color);
    dot.classList.toggle('filled', i < filled);
  }

  // stats
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

  // inputs disabled while running
  ['study', 'short', 'long'].forEach(k => {
    const inp = document.getElementById(`pt-custom-${k}`);
    if (inp) inp.disabled = PT.running;
  });

  // session history
  const wrap = document.getElementById('pt-sessions-wrap');
  const list = document.getElementById('pt-sessions-list');
  if (wrap && list) {
    wrap.style.display = PT.sessions.length > 0 ? '' : 'none';
    list.innerHTML = [...PT.sessions].reverse().map(s =>
      `<div class="pt-session-chip">🍅 ${s.time} · ${s.minutes}분</div>`
    ).join('');
  }
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

// ── Init ─────────────────────────────────────────────────
window.addEventListener('load', async () => {
  document.getElementById('trade-qty')?.addEventListener('input', updateTotal);
  document.getElementById('join-code')?.addEventListener('input', function() {
    this.value = this.value.toUpperCase();
  });

  // Pre-fill join code from URL ?code=XXXXXX (QR scan)
  const urlCode = new URLSearchParams(location.search).get('code');
  if (urlCode) {
    const joinCodeEl = document.getElementById('join-code');
    if (joinCodeEl) joinCodeEl.value = urlCode.toUpperCase();
    history.replaceState({}, '', location.pathname);
    showScreen('screen-join');
    return;
  }

  const me = await api.get('/api/auth/me');
  if (!me.error) {
    onLogin(me);
  } else {
    showLanding();
  }
});
