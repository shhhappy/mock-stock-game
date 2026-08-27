// ── State ────────────────────────────────────────────────
const S = {
  user: null, room: null,
  stocks: [], sectors: [], activeSector: '',
  currentPage: 'market',
  tradeSymbol: null, tradePrice: 0, tradeCash: 0, tradeHolding: 0,
  stockChart: null, portChart: null, hostBarChart: null, resultsBarChart: null, assetLineChart: null,
  timerInterval: null, pollInterval: null, newsInterval: null,
  newsTs: 0,
  txnPage: 1, txnTotalPages: 1,
  studentTxnUid: null, studentTxnPage: 1, studentTxnTotalPages: 1,
  depositWarningShown: false,
  adjustTargetUid: null,
  depRate: 3, depCash: 0,
  eduTab: 'glossary', glossaryData: [],
  hostTab: 'rank',
  watchlist: (() => { try { return new Set(JSON.parse(localStorage.getItem('watchlist') || '[]')); } catch(e) { return new Set(); } })(),
  watchlistOnly: false,
  assetHistory: [],
  quizTimerInterval: null,
  rouletteOpened: false,
  lotteryRoundDue: null,
  lotteryHostModalOpen: false,
};

let _newsPopupTimer = null;

// ── API ──────────────────────────────────────────────────
const api = {
  async get(url) {
    const r = await fetch(url);
    const body = await r.json().catch(() => null);
    if (!r.ok) return {error: body?.error || `HTTP ${r.status}`};
    return body;
  },
  async post(url, body) {
    const r = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
    const data = await r.json().catch(() => null);
    if (!r.ok) return {error: data?.error || `HTTP ${r.status}`};
    return data;
  },
  async del(url) {
    const r = await fetch(url, {method:'DELETE'});
    const body = await r.json().catch(() => null);
    if (!r.ok) return {error: body?.error || `HTTP ${r.status}`};
    return body;
  },
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
  S.assetHistory = []; S.stocks = []; S.sectors = []; S.newsTs = 0;
  S.depositWarningShown = false;
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
  _stopLotPolling();
  _lotParticipantPicks = []; _lotPickerSubmitted = false; _lotResultRound = null;
  showLanding();
}

function confirmLeaveGame() {
  if (confirm('게임을 나가시겠습니까?\n진행 중인 게임에서 퇴장합니다.')) {
    goHome();
  }
}

async function confirmCancelHostRoom() {
  // 게임 시작 전(대기실) 상태의 방을 취소하고 나감. 그냥 화면만 벗어나면
  // 방이 'waiting' 상태로 DB에 남아, 다음 로그인 시 재입장 로직 때문에
  // 계속 이 방으로 다시 끌려오게 되므로 실제로 방을 종료 처리해야 함.
  const memberCount = document.getElementById('lobby-count')?.textContent || '0';
  const msg = memberCount !== '0'
    ? `방을 취소하고 나가시겠습니까?\n대기 중인 참여자 ${memberCount}명도 함께 나가지게 됩니다.`
    : '방을 취소하고 나가시겠습니까?';
  if (!confirm(msg)) return;
  if (S.room) await api.post(`/api/rooms/${S.room.id}/end`, {}).catch(() => {});
  goHome();
}

// ── Room: Create ─────────────────────────────────────────
function _prefillLastRoomSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('lastRoomSettings') || 'null');
    if (!saved) return;
    if (saved.name)             document.getElementById('room-name').value = saved.name;
    if (saved.duration_minutes) document.getElementById('room-duration').value = saved.duration_minutes;
    if (saved.starting_cash)    document.getElementById('room-cash').value = saved.starting_cash;
    if (saved.deposit_rate !== undefined) document.getElementById('room-rate').value = saved.deposit_rate;
    if (saved.code) document.getElementById('room-code').value = saved.code;
  } catch(e) { /* 저장된 값이 손상된 경우 무시하고 기본값 유지 */ }
}

async function doCreateRoom() {
  const sid      = document.getElementById('host-student-id').value.trim();
  const hostName = document.getElementById('host-name').value.trim();
  const roomName = document.getElementById('room-name').value.trim();
  const dur  = parseInt(document.getElementById('room-duration').value) || 30;
  const cash = parseFloat(document.getElementById('room-cash').value)   || 10_000_000;
  const rate = parseFloat(document.getElementById('room-rate').value)   || 3;
  const code = document.getElementById('room-code').value.trim().toUpperCase();
  const err  = document.getElementById('create-err');
  err.textContent = '';
  if (!sid)      { err.textContent = '학번을 입력하세요.'; return; }
  if (!hostName) { err.textContent = '이름을 입력하세요.'; return; }
  let authData;
  try {
    authData = await doAuth(sid, hostName);
  } catch(e) { err.textContent = e.message; return; }
  if (authData.active_room) {
    // 세션이 끊겨(브라우저 재시작·다른 기기 등) 다시 "방 만들기"로 들어온 경우 — 방 이름을
    // 안 적었어도(재입장이므로) 새 방을 만들지 않고 진행 중이던 기존 방으로 돌려보낸다.
    // 이 분기가 방 이름 검증보다 먼저 와야 다른 기기에서 이름 없이도 재입장이 된다.
    S.room = authData.active_room;
    toast('진행 중인 방으로 돌아왔습니다.', 'info');
    resumeRoom();
    return;
  }
  if (!roomName) { err.textContent = '방 이름을 입력하세요.'; return; }
  const data = await api.post('/api/rooms', {name: roomName, duration_minutes: dur, starting_cash: cash, deposit_rate: rate, code});
  if (data.error) { err.textContent = data.error; return; }
  try {
    localStorage.setItem('lastRoomSettings', JSON.stringify({name: roomName, duration_minutes: dur, starting_cash: cash, deposit_rate: rate, code}));
  } catch(e) { /* localStorage 사용 불가 환경(시크릿 모드 등)은 조용히 무시 */ }
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
  if (code.length < 4 || code.length > 6) { err.textContent = '4~6자리 코드를 입력하세요.'; return; }
  if (!sid)  { err.textContent = '학번을 입력하세요.'; return; }
  if (!name) { err.textContent = '이름을 입력하세요.'; return; }
  try {
    await doAuth(sid, name);
  } catch(e) { err.textContent = e.message; return; }
  const data = await api.post('/api/rooms/join', {code});
  if (data.error) { err.textContent = data.error; return; }
  S.room = data.room;
  if (S.room.status === 'active' || S.room.status === 'paused') {
    enterParticipantGame();
  } else if (S.room.status === 'ended') {
    if (S.room.results_published) {
      await loadResults(); showScreen('screen-results');
    } else {
      showScreen('screen-waiting-results'); startWaitingPoll();
    }
  } else {
    enterParticipantLobby();
  }
}

function resumeRoom() {
  if (!S.room) return;
  if (S.room.is_host) {
    if (S.room.status === 'waiting') enterHostLobby();
    else if (S.room.status === 'active' || S.room.status === 'paused') enterHostGame();
    else loadResults().then(() => showScreen('screen-results'));
  } else {
    if (S.room.status === 'waiting') enterParticipantLobby();
    else if (S.room.status === 'active' || S.room.status === 'paused') enterParticipantGame();
    else if (S.room.results_published) loadResults().then(() => showScreen('screen-results'));
    else { showScreen('screen-waiting-results'); startWaitingPoll(); }
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

function _makeQR(el, size) {
  el.innerHTML = '';
  const joinUrl = `${location.origin}${location.pathname}?code=${S.room.code}`;
  new QRCode(el, {
    text: joinUrl,
    width: size,
    height: size,
    colorDark: '#e6edf3',
    colorLight: '#0d1117',
    correctLevel: QRCode.CorrectLevel.M,
  });
}

function generateLobbyQR() {
  _makeQR(document.getElementById('lobby-qr'), 148);
}

function openGameQR() {
  const canvas = document.getElementById('modal-game-qr-canvas');
  _makeQR(canvas, 280);
  document.getElementById('modal-game-qr-code').textContent = S.room.code;
  openModal('modal-game-qr');
}

function openGameQRWindow() {
  // 프로젝터/외부 모니터에 띄워두고 쓸 수 있도록 QR+메모를 별도 창으로 분리
  const url = `/static/qr-display.html?code=${encodeURIComponent(S.room.code)}&name=${encodeURIComponent(S.room.name || '')}`;
  window.open(url, `qr-display-${S.room.code}`, 'width=1000,height=680');
}

async function loadLobbyMembers() {
  const data = await api.get(`/api/rooms/${S.room.id}/host/lobby-members`);
  if (data.error) return;
  document.getElementById('lobby-count').textContent = data.length;
  document.getElementById('lobby-members-list').innerHTML = data.length
    ? data.map(m => `
        <div class="lobby-member">
          <div class="avatar-sm">${escHtml(m.username[0].toUpperCase())}</div>
          <span style="font-weight:600;flex:1">${escHtml(m.username)}</span>
          <button class="btn btn-secondary btn-sm" style="padding:3px 8px;color:var(--down)"
            data-uid="${m.user_id}" data-name="${escHtml(m.username)}" onclick="doKickMember(this.dataset.uid,this.dataset.name)">강퇴</button>
        </div>`).join('')
    : '<div class="muted" style="font-size:13px;padding:10px 0">아직 참여자가 없습니다.</div>';
}

async function doKickMember(uid, username) {
  if (!confirm(`"${username}"을(를) 강퇴하시겠습니까?`)) return;
  const data = await api.del(`/api/rooms/${S.room.id}/host/members/${uid}`);
  if (data.error) { toast(data.error, 'error'); return; }
  toast(`${username} 강퇴 완료`, 'info');
  loadLobbyMembers();
}

function copyCode() {
  navigator.clipboard?.writeText(S.room.code).then(() => toast('코드가 복사되었습니다!', 'success'));
}

async function doStartGame() {
  if (!confirm('게임을 시작하시겠습니까?')) return;
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
  loadRltConfig();
  startNewsPolling();
  updatePauseBtn();
  S.pollInterval = setInterval(() => {
    if (S.hostTab === 'rank') loadHostMembers();
    else if (S.hostTab === 'market') loadHostMarket();
    refreshRoomStatus();
  }, 10000);
}

function updatePauseBtn() {
  const btn = document.getElementById('pause-btn');
  if (!btn) return;
  if (S.room?.status === 'paused') {
    btn.textContent = '▶ 재개';
    btn.style.background = 'var(--up)';
  } else {
    btn.textContent = '⏸ 일시정지';
    btn.style.background = 'var(--warn)';
  }
}

async function doPauseGame() {
  if (S.room?.status === 'paused') {
    const data = await api.post(`/api/rooms/${S.room.id}/resume`, {});
    if (data.error) { toast(data.error, 'error'); return; }
    S.room = data.room;
    toast('게임 재개', 'success');
  } else {
    const data = await api.post(`/api/rooms/${S.room.id}/pause`, {});
    if (data.error) { toast(data.error, 'error'); return; }
    S.room = data.room;
    toast('게임 일시정지', 'info');
  }
  updatePauseBtn();
}

async function doAdjustTime(deltaMinutes) {
  const msg = document.getElementById('time-adjust-msg');
  const data = await api.post(`/api/rooms/${S.room.id}/host/adjust-time`, {delta_minutes: deltaMinutes});
  if (data.error) { msg.style.color = 'var(--down)'; msg.textContent = data.error; return; }
  S.room.end_time = data.end_time;
  S.room.remaining_seconds = data.remaining_seconds;
  const sign = deltaMinutes > 0 ? '+' : '';
  msg.style.color = 'var(--up)';
  msg.textContent = `적용됨 (${sign}${deltaMinutes}분) · 남은 시간 ${Math.floor(data.remaining_seconds/60)}분 ${data.remaining_seconds%60}초`;
  toast(`남은 시간 ${sign}${deltaMinutes}분 조정됨`, 'success');
}

function doAdjustTimeCustom() {
  const input = document.getElementById('time-adjust-input');
  const val = parseFloat(input.value);
  if (!val || !isFinite(val)) {
    document.getElementById('time-adjust-msg').style.color = 'var(--down)';
    document.getElementById('time-adjust-msg').textContent = '0이 아닌 숫자를 입력하세요.';
    return;
  }
  doAdjustTime(val);
  input.value = '';
}

function switchHostTab(tab) {
  S.hostTab = tab;
  document.getElementById('htab-rank').classList.toggle('active', tab === 'rank');
  document.getElementById('htab-market').classList.toggle('active', tab === 'market');
  document.getElementById('htab-settings').classList.toggle('active', tab === 'settings');
  document.getElementById('htab-rank-content').hidden = tab !== 'rank';
  document.getElementById('htab-market-content').hidden = tab !== 'market';
  document.getElementById('htab-settings-content').hidden = tab !== 'settings';
  if (tab === 'market') loadHostMarket();
  if (tab === 'settings') loadLotteryTimes();
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

  const secSel = document.getElementById('market-event-sector');
  if (secSel && secSel.options.length <= 1 && data.sectors) {
    data.sectors.forEach(sector => {
      const opt = document.createElement('option');
      opt.value = sector;
      opt.textContent = `📂 ${sector} 섹터`;
      secSel.appendChild(opt);
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

async function doMarketEvent(quickPct) {
  const sector = document.getElementById('market-event-sector').value;
  const pct = quickPct !== undefined ? quickPct : parseFloat(document.getElementById('market-event-pct').value);
  const msg = document.getElementById('market-event-msg');
  if (isNaN(pct) || pct === 0) { msg.textContent = '변동률을 입력하세요.'; return; }
  const data = await api.post(`/api/rooms/${S.room.id}/host/market-event`, { sector, pct });
  if (data.error) { msg.style.color = 'var(--down)'; msg.textContent = data.error; return; }
  msg.style.color = 'var(--up)';
  msg.textContent = `✓ ${data.message}`;
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
        <span style="flex:1;font-weight:600">${escHtml(m.username)}</span>
        <span style="font-size:12px;${m.gain_pct>=0?'color:var(--up)':'color:var(--down)'}">
          ${sign}${m.gain_pct.toFixed(1)}%
        </span>
        <span style="font-weight:700;min-width:90px;text-align:right;font-size:13px">${krw(m.total_value)}</span>
        <button class="btn btn-secondary btn-sm" data-uid="${m.user_id}" data-name="${escHtml(m.username)}" onclick="openStudentTxn(this.dataset.uid,this.dataset.name)" style="margin-left:4px;padding:4px 8px;font-size:11px">거래</button>
        <button class="btn btn-secondary btn-sm" data-uid="${m.user_id}" data-name="${escHtml(m.username)}" data-cash="${m.cash}" onclick="openAdjust(this.dataset.uid,this.dataset.name,this.dataset.cash)" style="margin-left:4px;padding:4px 8px">조정</button>
      </div>`;
  }).join('');

  renderHostBarChart(data);
}

function renderHostBarChart(members) {
  const ctx = document.getElementById('host-bar-chart').getContext('2d');
  const labels = members.map(m => m.username);
  const values = members.map(m => m.total_value);
  const colors = members.map(m => m.gain_pct >= 0 ? 'rgba(63,185,80,.7)' : 'rgba(248,81,73,.7)');
  const starting = S.room.starting_cash;

  if (S.hostBarChart) {
    S.hostBarChart.data.labels = labels;
    S.hostBarChart.data.datasets[0].data = values;
    S.hostBarChart.data.datasets[0].backgroundColor = colors;
    S.hostBarChart.data.datasets[0].borderColor = colors.map(c => c.replace('.7)', '1)'));
    S.hostBarChart.update();
    return;
  }

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

function openStudentTxn(uid, username) {
  S.studentTxnUid = uid;
  S.studentTxnPage = 1;
  S.studentTxnTotalPages = 1;
  document.getElementById('stxn-username').textContent = username;
  document.getElementById('stxn-list').innerHTML = '<div class="loading-center"><span class="spinner"></span></div>';
  document.getElementById('stxn-more-wrap').hidden = true;
  openModal('modal-student-txn');
  loadStudentTxn(true);
}

async function loadStudentTxn(reset = false) {
  const data = await api.get(`/api/rooms/${S.room.id}/host/members/${S.studentTxnUid}/transactions?page=${S.studentTxnPage}`);
  const list = document.getElementById('stxn-list');
  if (!data.transactions?.length && reset) {
    list.innerHTML = '<div class="empty-state"><div class="e-icon">📋</div>거래 내역 없음</div>';
    return;
  }
  S.studentTxnTotalPages = data.pages || 1;
  const html = (data.transactions || []).map(t => `
    <div class="txn-item">
      <div>
        <div style="font-weight:600">${escHtml(t.name)}</div>
        <div class="muted" style="font-size:11px">${escHtml(t.timestamp)}${t.note ? ' · ' + escHtml(t.note) : ''}</div>
      </div>
      <div style="text-align:right">
        <span class="txn-badge ${t.action.toLowerCase()}">${t.action==='BUY'?'매수':t.action==='SELL'?'매도':'조정'}</span>
        ${t.action !== 'ADJ' ? `<div class="muted" style="font-size:11px">${t.shares}주 · ${krw(t.price)}</div>` : ''}
        <div style="font-weight:600">${t.action==='ADJ'?(t.amount>=0?'+':'')+krw(t.amount):krw(t.amount)}</div>
      </div>
    </div>`).join('');
  if (reset) list.innerHTML = html; else list.insertAdjacentHTML('beforeend', html);
  document.getElementById('stxn-more-wrap').hidden = S.studentTxnPage >= S.studentTxnTotalPages;
}

async function loadMoreStudentTxn() { S.studentTxnPage++; await loadStudentTxn(false); }

async function doEndGame() {
  if (!confirm('정말 게임을 종료하시겠습니까?')) return;
  const data = await api.post(`/api/rooms/${S.room.id}/end`, {});
  if (data.error) { toast(data.error, 'error'); return; }
  S.room = data.room;
  if (data.ending_soon) {
    toast('⏰ 1분 후 게임이 종료됩니다!', 'info');
    const btn = document.getElementById('end-game-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏰ 1분 후 종료'; }
    return;
  }
  stopPolling(); stopTimer();
  await loadResults(); showScreen('screen-results');
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
    if (r.status === 'active' || r.status === 'paused') {
      S.room = r; stopPolling(); enterParticipantGame();
    } else if (r.status === 'ended') {
      S.room = r; stopPolling();
      if (!r.end_time) {
        // end_time이 없다는 건 게임이 시작조차 안 된 채(대기실 상태) 진행자가 방을 취소했다는 뜻.
        // "결과 발표 대기" 화면은 오해를 주므로 바로 홈으로 안내.
        toast('진행자가 방을 취소했습니다.', 'info');
        goHome();
      } else if (r.results_published) {
        await loadResults(); showScreen('screen-results');
      } else {
        showScreen('screen-waiting-results'); startWaitingPoll();
      }
    }
  }, 5000);
}

async function loadPLobbyMembers() {
  const data = await api.get(`/api/rooms/${S.room.id}/host/lobby-members`).catch(() => []);
  if (!Array.isArray(data)) return;
  document.getElementById('plobby-count').textContent = data.length;
  document.getElementById('plobby-members-list').innerHTML = data.map(m =>
    `<div class="lobby-member"><div class="avatar-sm">${escHtml(m.username[0].toUpperCase())}</div>
     <span style="font-weight:600">${escHtml(m.username)}</span></div>`
  ).join('');
}

// ── Participant: Game ────────────────────────────────────
function enterParticipantGame() {
  S.depositWarningShown = false;
  S.rouletteOpened = false;
  _stopLotPolling();
  _lotParticipantPicks = [];
  _lotPickerSubmitted = false;
  _lotResultRound = null;
  S.depRate = S.room.deposit_rate;
  setDepLockType('free');
  showScreen('screen-p-game');

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
  S.pollInterval = setInterval(async () => {
    const r = await api.get(`/api/rooms/${S.room.id}`);
    if (r.status === 'ended') {
      S.room = r; stopPolling(); stopTimer();
      closeQuiz();
      document.getElementById('lottery-overlay').style.display = 'none';
      hidePausedBanner(); hideEndingSoonBanner();
      await showMaturedDepositResult();
      toast('⏰ 게임이 종료되었습니다!', 'info');
      if (r.results_published) { await loadResults(); showScreen('screen-results'); }
      else { showScreen('screen-waiting-results'); startWaitingPoll(); }
    } else {
      S.room = r;
      // 5초 트리거 룰렛 자동 실행
      if (r.minigame_available && !S.rouletteOpened) {
        S.rouletteOpened = true;
        openRouletteModal();
      }
      if (r.lottery_active && !_lotPollInterval && _lotResultRound !== r.lottery_current_round) {
        _startLotPolling(S.room.id);
      }
      if (r.status === 'paused') {
        showPausedBanner();
        hideEndingSoonBanner();
      } else if (r.ending_soon) {
        hidePausedBanner();
        showEndingSoonBanner();
        if (r.remaining_seconds <= 60) checkDepositMaturity();
      } else {
        hidePausedBanner();
        hideEndingSoonBanner();
        if (r.remaining_seconds <= 60) checkDepositMaturity();
      }
    }
    refreshMyRank();
    if (S.currentPage === 'market') loadMarket();
    if (S.currentPage === 'rankings') loadParticipantRankings();
  }, 10000);
}

function showPausedBanner() {
  // Suppress banner while lottery or roulette overlay is active (auto-paused)
  if (_lotPollInterval || document.getElementById('lottery-overlay')?.style.display === 'flex'
      || document.getElementById('roulette-overlay')?.style.display === 'flex') return;
  let banner = document.getElementById('paused-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'paused-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:var(--warn);color:#000;text-align:center;font-weight:700;font-size:13px;padding:6px;z-index:9000';
    banner.textContent = '⏸ 게임이 일시정지되었습니다';
    document.body.appendChild(banner);
  }
  updateTradeButtonState();
}

function hidePausedBanner() {
  document.getElementById('paused-banner')?.remove();
  updateTradeButtonState();
}

function showEndingSoonBanner() {
  if (document.getElementById('ending-soon-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'ending-soon-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#cf6679;color:#fff;text-align:center;font-weight:700;font-size:13px;padding:6px;z-index:9000;animation:pulse 1.5s infinite';
  banner.textContent = '⏰ 게임이 곧 종료됩니다 (1분 이내)';
  document.body.appendChild(banner);
}

function hideEndingSoonBanner() {
  document.getElementById('ending-soon-banner')?.remove();
}

function updateTradeButtonState() {
  const paused = S.room?.status === 'paused';
  ['trade-buy-btn', 'trade-sell-btn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) { btn.disabled = paused; btn.style.opacity = paused ? '0.5' : '1'; }
  });
  const msg = document.getElementById('trade-paused-msg');
  if (msg) msg.style.display = paused ? '' : 'none';
}

async function checkDepositMaturity() {
  if (S.depositWarningShown) return;
  S.depositWarningShown = true;
  const deps = await api.get(`/api/rooms/${S.room.id}/deposits`).catch(() => null);
  if (!deps) return;
  const active = deps.filter(d => d.status === 'active');
  if (!active.length) return;
  const totalAmount = active.reduce((s, d) => s + d.amount, 0);
  const totalInterest = active.reduce((s, d) => s + (d.expected_interest || 0), 0);
  const popup = document.createElement('div');
  popup.id = 'dep-maturity-banner';
  popup.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);background:#1c2128;border:2px solid var(--warn);border-radius:12px;padding:14px 18px;z-index:8000;width:calc(100% - 32px);max-width:380px;box-shadow:0 4px 24px rgba(0,0,0,.5)';
  popup.innerHTML = `
    <div style="font-weight:700;font-size:15px;margin-bottom:6px;color:var(--warn)">🏦 예금 만기 임박!</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:8px">게임 종료 1분 전 — 예금이 곧 만기됩니다</div>
    ${active.map(d => `
      <div style="font-size:13px;display:flex;justify-content:space-between;margin-top:4px">
        <span>원금 ${krw(d.amount)}</span>
        <span style="color:var(--up)">+이자 ${krw(d.expected_interest)}</span>
      </div>`).join('')}
    <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border);font-weight:700;display:flex;justify-content:space-between">
      <span>예상 수령액</span>
      <span style="color:var(--warn)">${krw(totalAmount + totalInterest)}</span>
    </div>`;
  document.getElementById('dep-maturity-banner')?.remove();
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 6000);
}

async function showMaturedDepositResult() {
  const deps = await api.get(`/api/rooms/${S.room.id}/deposits`).catch(() => null);
  if (!deps) return;
  const matured = deps.filter(d => d.status === 'matured');
  if (!matured.length) return;
  const totalAmount = matured.reduce((s, d) => s + d.amount, 0);
  const totalInterest = matured.reduce((s, d) => s + (d.interest_earned || 0), 0);
  toast(`🏦 예금 만기! 원금 ${krw(totalAmount)} + 이자 ${krw(totalInterest)} 지급`, 'success');
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
    const el = document.getElementById(elId);
    if (!el) return;
    let rem;
    if (S.room.status === 'paused') {
      rem = S.room.remaining_seconds || 0;
      el.textContent = `⏸ ${String(Math.floor(rem/60)).padStart(2,'0')}:${String(rem%60).padStart(2,'0')}`;
      el.className = 'timer-display warn';
      return;
    }
    rem = Math.max(0, Math.floor((new Date(S.room.end_time) - new Date()) / 1000));
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
  clearInterval(S._waitingPoll); S._waitingPoll = null;
  stopNewsPolling();
}

function startWaitingPoll() {
  clearInterval(S._waitingPoll);
  S._waitingPoll = setInterval(async () => {
    const r = await api.get(`/api/rooms/${S.room.id}`);
    if (r.results_published) {
      clearInterval(S._waitingPoll); S._waitingPoll = null;
      S.room = r;
      await loadResults();
      showScreen('screen-results');
    }
  }, 3000);
}

async function publishResults() {
  const data = await api.post(`/api/rooms/${S.room.id}/host/publish-results`, {});
  if (data.error) { toast(data.error, 'error'); return; }
  S.room.results_published = true;
  document.getElementById('results-publish-wrap').hidden = true;
  toast('결과가 발표되었습니다!', 'success');
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
  }, 8000);
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
    const td = await api.post(`/api/rooms/${S.room.id}/quiz`, { answer: false, timeout: true });
    if (td.penalty > 0) toast(`-${td.penalty.toLocaleString()}원 차감!`, 'error');
    return;
  }
  const data = await api.post(`/api/rooms/${S.room.id}/quiz`, { answer });
  if (data.correct) {
    result.innerHTML = `<div style="font-size:32px">⭕</div><div style="color:var(--up);font-weight:700;font-size:18px;margin-top:8px">정답! +${data.reward.toLocaleString()}원</div><div style="color:var(--muted);font-size:13px;margin-top:8px">${data.explanation}</div>`;
    toast(`+${data.reward.toLocaleString()}원 획득!`, 'success');
  } else {
    const penaltyText = data.penalty > 0 ? ` (-${data.penalty.toLocaleString()}원)` : '';
    result.innerHTML = `<div style="font-size:32px">❌</div><div style="color:var(--down);font-weight:700;font-size:18px;margin-top:8px">오답${penaltyText}</div><div style="color:var(--muted);font-size:13px;margin-top:8px">${data.explanation}</div>`;
    if (data.penalty > 0) toast(`-${data.penalty.toLocaleString()}원 차감!`, 'error');
  }
}

function closeQuiz() {
  if (_quizTimerTick) { clearInterval(_quizTimerTick); _quizTimerTick = null; }
  document.getElementById('quiz-overlay').style.display = 'none';
}

async function openQuizHistory() {
  const list = document.getElementById('quiz-history-list');
  list.innerHTML = `<div style="color:var(--muted);text-align:center;padding:20px 0">불러오는 중…</div>`;
  document.getElementById('quiz-history-overlay').style.display = 'flex';
  const hist = await api.get(`/api/rooms/${S.room.id}/quiz/history`);
  if (!Array.isArray(hist) || hist.length === 0) {
    list.innerHTML = `<div style="color:var(--muted);text-align:center;padding:20px 0">아직 푼 퀴즈가 없습니다.</div>`;
    return;
  }
  list.innerHTML = hist.map(h => `
    <div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:${h.correct ? 'var(--up-bg,rgba(0,180,100,.08))' : 'var(--down-bg,rgba(220,60,60,.08))'}">
      <div style="display:flex;align-items:flex-start;gap:8px">
        <span style="font-size:16px">${h.correct ? '⭕' : '❌'}</span>
        <span style="font-size:14px;font-weight:600;line-height:1.4">${escHtml(h.question)}</span>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px;padding-left:24px">${escHtml(h.explanation)}</div>
    </div>
  `).join('');
}

function closeQuizHistory() {
  document.getElementById('quiz-history-overlay').style.display = 'none';
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Roulette Mini-game ────────────────────────────────────
let _rltSpinning = false;
let _rltCash = 0;
let _rltMults = [0, 1, 2, 5, 25];
let _rltWeights = [70, 20, 7, 2, 1];
const _RLT_COLORS = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6'];

function _rltLabel(m) { return m === 0 ? '꽝' : `${m}배`; }

function _rltPctStr(weights) {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map(w => (w / total * 100).toFixed(1));
}

function updateRltWheel(weights) {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let cum = 0;
  const stops = weights.map((w, i) => {
    const from = (cum / total * 100).toFixed(2);
    cum += w;
    const to = (cum / total * 100).toFixed(2);
    return `${_RLT_COLORS[i]} ${from}% ${to}%`;
  });
  const wheel = document.getElementById('roulette-wheel');
  if (wheel) wheel.style.background = `conic-gradient(${stops.join(', ')})`;
}

function updateRltLegend(mults, weights) {
  _rltMults = mults;
  if (weights) _rltWeights = weights;
  const pcts = _rltPctStr(_rltWeights);
  mults.forEach((m, i) => {
    const el = document.getElementById(`rlt-leg-${i}`);
    if (el) el.textContent = `${_rltLabel(m)} ${pcts[i]}%`;
  });
  updateRltWheel(_rltWeights);
}

async function loadRltConfig() {
  const data = await api.get(`/api/rooms/${S.room.id}/host/roulette-config`);
  if (data.error) return;
  const m = data.multipliers || [0,1,2,5,25];
  const w = data.weights    || [70,20,7,2,1];
  _rltMults = m;
  _rltWeights = w;
  m.slice(1).forEach((v, i) => {
    const el = document.getElementById(`rlt-mult-${i+1}`);
    if (el) el.value = v;
  });
  w.forEach((v, i) => {
    const el = document.getElementById(`rlt-w-${i}`);
    if (el) el.value = v;
  });
}

async function doSetRltConfig() {
  const weights = [0,1,2,3,4].map(i => parseFloat(document.getElementById(`rlt-w-${i}`)?.value) || 0);
  const mults   = [0, ...[1,2,3,4].map(i => parseFloat(document.getElementById(`rlt-mult-${i}`)?.value) || 1)];
  const msg = document.getElementById('rlt-config-msg');
  if (weights.every(w => w === 0)) {
    msg.style.color = 'var(--down)'; msg.textContent = '확률 합계가 0이 될 수 없습니다.'; return;
  }
  const data = await api.post(`/api/rooms/${S.room.id}/host/roulette-config`, { multipliers: mults, weights });
  if (data.error) { msg.style.color = 'var(--down)'; msg.textContent = data.error; return; }
  _rltMults = data.multipliers;
  _rltWeights = data.weights;
  const pcts = _rltPctStr(data.weights);
  msg.style.color = 'var(--up)';
  msg.textContent = `적용됨 · 꽝 ${pcts[0]}% / ${mults[1]}배 ${pcts[1]}% / ${mults[2]}배 ${pcts[2]}% / ${mults[3]}배 ${pcts[3]}% / ${mults[4]}배 ${pcts[4]}%`;
}

let _rltAutoCloseTimer = null;
let _rltAutoCloseSec = 60;

function _startRltAutoClose() {
  if (_rltAutoCloseTimer) clearInterval(_rltAutoCloseTimer);
  _rltAutoCloseSec = 60;
  const el = document.getElementById('rlt-auto-timer');
  if (el) el.textContent = `⏱ ${_rltAutoCloseSec}초 후 자동으로 닫힙니다`;
  _rltAutoCloseTimer = setInterval(() => {
    _rltAutoCloseSec--;
    if (el) el.textContent = _rltAutoCloseSec > 0
      ? `⏱ ${_rltAutoCloseSec}초 후 자동으로 닫힙니다`
      : '';
    if (_rltAutoCloseSec <= 0) {
      clearInterval(_rltAutoCloseTimer);
      _rltAutoCloseTimer = null;
      closeRoulette();
    }
  }, 1000);
}

function _stopRltAutoClose() {
  if (_rltAutoCloseTimer) { clearInterval(_rltAutoCloseTimer); _rltAutoCloseTimer = null; }
  const el = document.getElementById('rlt-auto-timer');
  if (el) el.textContent = '';
}

async function openRouletteModal() {
  const data = await api.get(`/api/rooms/${S.room.id}/minigame`);
  if (data.error || data.spins_left <= 0) return;
  if (data.multipliers) updateRltLegend(data.multipliers, data.weights);
  _rltCash = data.total_assets ?? data.cash;
  document.getElementById('rlt-spins').textContent = data.spins_left;
  document.getElementById('rlt-cash').textContent = krw(_rltCash);
  document.getElementById('rlt-bet-input').value = '';
  document.getElementById('rlt-err').textContent = '';
  document.getElementById('rlt-bet-section').style.display = '';
  document.getElementById('rlt-result').style.display = 'none';
  document.getElementById('rlt-again-btn').style.display = 'none';
  document.getElementById('rlt-close-btn').style.display = 'none';
  document.getElementById('rlt-spin-btn').disabled = false;
  const wheel = document.getElementById('roulette-wheel');
  wheel.style.transition = 'none';
  wheel.style.transform = 'rotate(0deg)';
  const bnp = document.getElementById('bomb-news-popup');
  if (bnp) bnp.style.display = 'none';
  if (_newsPopupTimer) { clearTimeout(_newsPopupTimer); _newsPopupTimer = null; }
  document.getElementById('roulette-overlay').style.display = 'flex';
  _startRltAutoClose();
  const pr = await api.post(`/api/rooms/${S.room.id}/minigame/open`, {}).catch(() => null);
  if (pr?.paused) {
    S.room.status = 'paused';
    S.room.remaining_seconds = pr.remaining_seconds;
  }
}

function setRltPct(pct) {
  document.getElementById('rlt-bet-input').value = Math.floor(_rltCash * pct / 100) || 1;
}

async function doRouletteSpin() {
  if (_rltSpinning) return;
  const bet = parseFloat(document.getElementById('rlt-bet-input').value);
  const errEl = document.getElementById('rlt-err');
  errEl.textContent = '';
  if (!bet || bet <= 0) { errEl.textContent = '베팅 금액을 입력하세요.'; return; }
  if (bet > _rltCash)   { errEl.textContent = '잔액이 부족합니다.'; return; }

  _rltSpinning = true;
  document.getElementById('rlt-spin-btn').disabled = true;

  const data = await api.post(`/api/rooms/${S.room.id}/minigame/spin`, {bet});
  if (data.error) {
    document.getElementById('rlt-err').textContent = data.error;
    document.getElementById('rlt-spin-btn').disabled = false;
    _rltSpinning = false;
    return;
  }

  // 스핀 애니메이션 (seg_start/seg_end는 서버에서 수신)
  const half = (data.seg_end - data.seg_start) / 2 * 0.65;
  const centerDeg = (data.seg_start + data.seg_end) / 2 + (Math.random() * 2 - 1) * half;
  const spinDeg = 3600 + (360 - centerDeg % 360);
  const wheel = document.getElementById('roulette-wheel');
  wheel.style.transition = 'none';
  wheel.style.transform = 'rotate(0deg)';
  void wheel.offsetWidth;
  wheel.style.transition = 'transform 4s cubic-bezier(0.17,0.67,0.12,0.99)';
  wheel.style.transform = `rotate(${spinDeg}deg)`;

  await new Promise(r => setTimeout(r, 4300));

  // 결과 표시 (주식 청산 가능성 있으므로 총자산 재조회)
  _rltCash = data.cash;
  api.get(`/api/rooms/${S.room.id}/minigame`).then(d => {
    if (d.total_assets != null) { _rltCash = d.total_assets; document.getElementById('rlt-cash').textContent = krw(_rltCash); }
  });
  document.getElementById('rlt-spins').textContent = data.spins_left;
  document.getElementById('rlt-cash').textContent = krw(_rltCash);
  document.getElementById('rlt-bet-section').style.display = 'none';

  const resultEl = document.getElementById('rlt-result');
  resultEl.style.display = '';
  if (data.multiplier === 0) {
    resultEl.innerHTML = `<div style="font-size:44px">💸</div>
      <div style="font-size:22px;font-weight:800;color:var(--down);margin:6px 0">꽝!</div>
      <div style="color:var(--muted);font-size:13px">베팅금 ${krw(data.bet)} 소멸</div>`;
    toast('💸 꽝! 베팅금 소멸', 'error');
  } else {
    const emoji = data.multiplier >= _rltMults[4] ? '🎊' : data.multiplier >= _rltMults[3] ? '🎉' : '✨';
    const gain = data.winnings - data.bet;
    resultEl.innerHTML = `<div style="font-size:44px">${emoji}</div>
      <div style="font-size:22px;font-weight:800;color:var(--up);margin:6px 0">${data.outcome} 당첨!</div>
      <div style="color:var(--up);font-size:15px;font-weight:700">+${krw(gain)}</div>
      <div style="color:var(--muted);font-size:12px;margin-top:4px">${krw(data.bet)} → ${krw(data.winnings)}</div>`;
    toast(`${emoji} ${data.outcome} 당첨! +${krw(gain)}`, 'success');
  }

  if (data.spins_left > 0) {
    document.getElementById('rlt-again-btn').style.display = '';
  } else {
    document.getElementById('rlt-close-btn').style.display = '';
  }
  refreshMyRank();
  _rltSpinning = false;
}

function resetRltSpin() {
  document.getElementById('rlt-result').style.display = 'none';
  document.getElementById('rlt-again-btn').style.display = 'none';
  document.getElementById('rlt-bet-section').style.display = '';
  document.getElementById('rlt-bet-input').value = '';
  document.getElementById('rlt-err').textContent = '';
  document.getElementById('rlt-spin-btn').disabled = false;
  const wheel = document.getElementById('roulette-wheel');
  wheel.style.transition = 'none';
  wheel.style.transform = 'rotate(0deg)';
}

async function closeRoulette() {
  if (_rltSpinning) return;
  _stopRltAutoClose();
  document.getElementById('roulette-overlay').style.display = 'none';
  const cr = await api.post(`/api/rooms/${S.room.id}/minigame/close`, {}).catch(() => null);
  if (cr?.ended) {
    // 5초 트리거 룰렛 종료 → 게임 끝
    stopPolling(); stopTimer();
    const r = await api.get(`/api/rooms/${S.room.id}`);
    S.room = r;
    hidePausedBanner(); hideEndingSoonBanner();
    if (r.results_published) { await loadResults(); showScreen('screen-results'); }
    else { showScreen('screen-waiting-results'); startWaitingPoll(); }
  } else if (cr?.resumed && cr.end_time) {
    S.room.status = 'active';
    S.room.end_time = cr.end_time;
  }
}


async function doSetQuizSettings() {
  const reward = parseFloat(document.getElementById('quiz-reward-input').value) || 1.0;
  const penalty = parseFloat(document.getElementById('quiz-penalty-input').value) || 0.5;
  const data = await api.post(`/api/rooms/${S.room.id}/host/quiz-settings`, {reward_pct: reward, penalty_pct: penalty});
  const msg = document.getElementById('quiz-settings-msg');
  if (data.ok) {
    msg.textContent = '✓ 저장됨';
    setTimeout(() => msg.textContent = '', 2500);
    const info = document.getElementById('quiz-reward-info');
    if (info) info.textContent = `💰 정답 시 시작 자금의 ${reward}% 지급 / 오답 시 ${penalty}% 차감`;
  }
}

async function doSendNews() {
  const showHint = document.getElementById('news-hint-checkbox').checked;
  await api.post(`/api/rooms/${S.room.id}/host/send-news`, { show_hint: showHint });
}

function showBombNews(items, showHint = true) {
  // 복권 또는 룰렛 진행 중에는 폭탄뉴스 표시 안 함
  if (document.getElementById('lottery-overlay')?.style.display === 'flex') return;
  if (document.getElementById('roulette-overlay')?.style.display === 'flex') return;
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
  } else {
    S.room = r;
    updatePauseBtn();
    // ending_soon 버튼 상태 반영
    if (r.ending_soon) {
      const btn = document.getElementById('end-game-btn');
      if (btn && !btn.disabled) { btn.disabled = true; btn.textContent = '⏰ 1분 후 종료'; }
    }
    // Lottery: notify bar for host
    if (r.lottery_round_due && r.lottery_round_due !== S.lotteryRoundDue) {
      showLotteryNotifyBar(r.lottery_round_due);
    }
    // Hide notify bar when lottery is actually running
    if (r.lottery_active) {
      hideLotteryNotifyBar();
      S.lotteryRoundDue = null;
    }
    // Lottery: active → start polling for host
    if (r.lottery_active && !_lotPollInterval && _lotResultRound !== r.lottery_current_round) {
      _startLotPolling(S.room.id);
    }
  }
}

// ── Navigation (participant game) ────────────────────────
const PAGE_ORDER = ['market', 'portfolio', 'deposit', 'rankings', 'education'];

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
  filterStocks(prev);
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

function filterStocks(prevPrices = {}) {
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
  renderGrid(filtered, prevPrices);
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
async function openStockModal(symbol, fallback = null) {
  const st = S.stocks.find(s => s.symbol === symbol) || fallback;
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

  const port = await api.get(`/api/rooms/${S.room.id}/portfolio`);
  if (!port.error) {
    S.tradeCash = port.cash;
    const h = (port.holdings || []).find(x => x.symbol === symbol);
    S.tradeHolding = h ? h.shares : 0;
    document.getElementById('ms-cash').textContent    = krw(port.cash);
    document.getElementById('ms-holding').textContent = S.tradeHolding + '주';
  }

  document.querySelectorAll('.period-tab').forEach((b, i) => b.classList.toggle('active', i === 2));
  openModal('modal-stock');
  updateTradeButtonState();
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

function setMaxBuy() {
  if (!S.tradePrice) return;
  const maxShares = Math.floor(S.tradeCash / S.tradePrice);
  document.getElementById('trade-qty').value = Math.max(1, maxShares);
  updateTotal();
}

function setMaxSell() {
  if (!S.tradeHolding) return;
  document.getElementById('trade-qty').value = S.tradeHolding;
  updateTotal();
}

async function execTrade(action) {
  if (S.room?.status === 'paused') {
    const fb = document.getElementById('trade-fb');
    fb.style.color = 'var(--warn)'; fb.textContent = '⏸ 게임 일시정지 중입니다.';
    return;
  }
  const shares = parseInt(document.getElementById('trade-qty').value);
  if (!shares) return;
  const fb = document.getElementById('trade-fb');
  fb.textContent = '';
  const data = await api.post(`/api/rooms/${S.room.id}/trade`, {symbol: S.tradeSymbol, action, shares});
  if (data.error) { fb.style.color = 'var(--down)'; fb.textContent = data.error; return; }
  fb.style.color = 'var(--up)'; fb.textContent = data.message;
  toast(data.message, 'success');

  document.getElementById('trade-qty').value = 1;
  updateTotal();

  S.tradeCash = data.cash;
  document.getElementById('ms-cash').textContent = krw(data.cash);

  if (action === 'BUY') {
    S.tradeHolding += shares;
  } else {
    S.tradeHolding = Math.max(0, S.tradeHolding - shares);
  }
  document.getElementById('ms-holding').textContent = S.tradeHolding + '주';

  S.depCash = data.cash;
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

  const hList = document.getElementById('holdings-list');
  if (!data.holdings.length) {
    hList.innerHTML = '<div class="empty-state"><div class="e-icon">📭</div>보유 종목 없음</div>';
  } else {
    hList.innerHTML = data.holdings.map(h => `
      <div class="holding-item" style="flex-wrap:wrap">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600">${h.name}</div>
          <div class="muted" style="font-size:11px">${h.shares}주 · 평균 ${krw(h.avg_price)} · 현재 ${krw(h.current_price)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-weight:700">${krw(h.current_value)}</div>
          <div class="${updn(h.gain_pct)}" style="font-size:12px">${pct(h.gain_pct)}</div>
        </div>
        <div style="width:100%;display:flex;gap:8px;margin-top:8px">
          <button class="btn btn-sm" style="flex:1;background:var(--up);color:#fff;border:none;font-weight:700"
            onclick="openStockModal('${h.symbol}',{symbol:'${h.symbol}',name:'${h.name}',sector:'${h.sector}',price:${h.current_price},change_pct:${h.gain_pct}})">▲ 매수</button>
          <button class="btn btn-sm" style="flex:1;background:var(--down);color:#fff;border:none;font-weight:700"
            onclick="openStockModal('${h.symbol}',{symbol:'${h.symbol}',name:'${h.name}',sector:'${h.sector}',price:${h.current_price},change_pct:${h.gain_pct}})">▼ 매도</button>
        </div>
      </div>`).join('');
  }

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
        <div style="font-weight:600">${escHtml(t.name)}</div>
        <div class="muted" style="font-size:11px">${escHtml(t.timestamp)}${t.note ? ' · ' + escHtml(t.note) : ''}</div>
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

function depEffectiveRate() {
  return (S.depRate || 0) * (S.depLockType === 'fixed' ? 1.5 : 1);
}

function setDepLockType(type) {
  S.depLockType = type;
  document.getElementById('dep-type-free').className  = 'btn btn-sm ' + (type === 'free'  ? 'btn-warning' : 'btn-secondary');
  document.getElementById('dep-type-fixed').className = 'btn btn-sm ' + (type === 'fixed' ? 'btn-warning' : 'btn-secondary');
  document.getElementById('dep-type-desc').textContent = type === 'fixed'
    ? `기본 금리의 1.5배(${depEffectiveRate().toFixed(1)}%), 게임 종료 전까지 중도해지 불가`
    : '언제든 중도해지 가능 (중도해지 시 이자 없음)';
  document.getElementById('dep-rate-display').textContent = depEffectiveRate().toFixed(1) + '%';
  updateDepPreview();
}

function updateDepPreview() {
  const amount = parseFloat(document.getElementById('dep-amount').value) || 0;
  const preview = document.getElementById('dep-preview');
  if (amount > 0) {
    const totalSec   = (S.room?.duration_minutes || 30) * 60;
    const remaining  = S.room?.remaining_seconds ?? totalSec;
    const ratio      = totalSec > 0 ? Math.min(1, remaining / totalSec) : 1;
    const rate       = depEffectiveRate();
    const interest   = amount * rate / 100 * ratio;
    const maxInterest = amount * rate / 100;
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
        <div style="font-weight:600">${krw(d.amount)} ${d.lock_type === 'fixed' ? '<span class="chip chip-blue" style="font-size:10px">정기예금</span>' : ''}</div>
        <div class="muted" style="font-size:11px">${d.created_at} · 금리 ${d.rate}%</div>
        <div style="color:var(--up);font-size:12px">현재 예상 이자 +${krw(d.expected_interest)}</div>
        <div style="color:var(--muted);font-size:11px">최대 이자 +${krw(d.max_interest)}</div>
      </div>
      ${d.lock_type === 'fixed'
        ? '<span class="muted" style="font-size:11px">만기까지 보유</span>'
        : `<button class="btn btn-secondary btn-sm" onclick="doWithdraw(${d.id})" style="color:var(--down)">해지</button>`}
    </div>`).join('');
}

async function doDeposit() {
  const amount = parseFloat(document.getElementById('dep-amount').value);
  const err = document.getElementById('dep-err');
  err.textContent = '';
  if (!amount || amount <= 0) { err.textContent = '금액을 입력하세요.'; return; }
  const data = await api.post(`/api/rooms/${S.room.id}/deposits`, {amount, lock_type: S.depLockType || 'free'});
  if (data.error) { err.textContent = data.error; return; }
  toast(data.message, 'success');
  document.getElementById('dep-amount').value = '';
  document.getElementById('dep-preview').style.display = 'none';
  S.depCash = data.cash;
  document.getElementById('dep-cash-display').textContent = krw(data.cash);
  refreshMyRank();
  loadDepositsPage();
}

async function doWithdraw(id) {
  if (!confirm('예금을 해지하면 이자가 지급되지 않습니다. 계속하시겠습니까?')) return;
  const data = await api.del(`/api/rooms/${S.room.id}/deposits/${id}`);
  if (data.error) { toast(data.error, 'error'); return; }
  toast(data.message, 'info');
  S.depCash = data.cash;
  refreshMyRank();
  loadDepositsPage();
}

// ── Rankings ─────────────────────────────────────────────
async function loadParticipantRankings() {
  const list = document.getElementById('p-rankings-list');
  if (!list.children.length) {
    list.innerHTML = '<div class="loading-center"><span class="spinner"></span></div>';
  }
  const data = await api.get(`/api/rooms/${S.room.id}/rankings`);
  if (!data.length) { list.innerHTML = '<div class="empty-state">참여자 없음</div>'; return; }
  list.innerHTML = data.map(e => {
    const medal = e.rank===1?'🥇':e.rank===2?'🥈':e.rank===3?'🥉':e.rank+'위';
    return `
      <div class="rank-row${e.rank<=3?' rank-'+e.rank:''}${e.is_me?' me':''}">
        <div class="rank-num">${medal}</div>
        <div class="rank-user">${escHtml(e.username)}${e.is_me?'<span class="chip chip-blue" style="font-size:10px;margin-left:6px">나</span>':''}</div>
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

  const trophyEl = document.getElementById('results-trophy');
  if (trophyEl) {
    trophyEl.classList.remove('results-trophy-anim');
    void trophyEl.offsetWidth;
    trophyEl.classList.add('results-trophy-anim');
  }

  const winnerSection = document.getElementById('results-winner-section');
  if (data.length > 0 && winnerSection) {
    const w = data[0];
    const {name} = parseUsername(w.username);
    document.getElementById('results-winner-name').textContent = name;
    document.getElementById('results-winner-value').textContent = krw(w.total_value);
    document.getElementById('results-winner-pct').textContent = pct(w.gain_pct);
    winnerSection.style.display = '';
  }

  const runnersUp = document.getElementById('results-runners-up');
  const top23 = data.filter(e => e.rank === 2 || e.rank === 3).sort((a,b) => a.rank - b.rank);
  if (top23.length && runnersUp) {
    runnersUp.style.display = 'flex';
    runnersUp.innerHTML = top23.map((e, i) => {
      const medal = e.rank === 2 ? '🥈' : '🥉';
      const {name} = parseUsername(e.username);
      return `
        <div class="results-runner-card rank-${e.rank}" style="animation-delay:${0.55 + i * 0.1}s">
          <div style="font-size:22px">${medal}</div>
          <div style="font-weight:700;font-size:14px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(name)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${e.rank}위</div>
          <div class="${updn(e.gain_pct)}" style="font-size:12px;margin-top:4px;font-weight:600">${pct(e.gain_pct)}</div>
        </div>`;
    }).join('');
  }

  const list = document.getElementById('results-list');
  list.innerHTML = data.map((e, i) => {
    const medal = e.rank===1?'🥇':e.rank===2?'🥈':e.rank===3?'🥉':e.rank+'위';
    const {sid, name} = parseUsername(e.username);
    return `
      <div class="results-row${e.rank<=3?' rank-'+e.rank:''}" style="animation-delay:${i * 90}ms">
        <div style="font-size:20px;width:36px;text-align:center">${medal}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700">${escHtml(name)}${e.is_me?'<span class="chip chip-blue" style="font-size:10px;margin-left:4px">나</span>':''}</div>
          <div style="font-size:11px;color:var(--muted)">${escHtml(sid)}</div>
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

  const publishWrap = document.getElementById('results-publish-wrap');
  const publishBtn = publishWrap?.querySelector('button');
  if (publishWrap) {
    const isHost = S.room?.is_host;
    const published = !!S.room?.results_published;
    publishWrap.hidden = !isHost || published;
    if (isHost && !published && publishBtn) {
      publishBtn.disabled = false;
      publishBtn.textContent = '📢 결과 발표하기';
    }
  }

  if (data.length > 0) setTimeout(startConfetti, 200);
}

function startConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const COLORS = ['#d4af37','#3fb950','#58a6ff','#f85149','#e3b341','#8957e5','#c0c0c0','#ff6b6b','#4ecdc4'];
  const pieces = Array.from({length: 110}, () => ({
    x:   Math.random() * canvas.width,
    y:   Math.random() * canvas.height * 0.5 - canvas.height * 0.5,
    w:   Math.random() * 10 + 5,
    h:   Math.random() * 5 + 3,
    rot: Math.random() * Math.PI * 2,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx:  (Math.random() - 0.5) * 3,
    vy:  Math.random() * 3 + 2.5,
    vrot: (Math.random() - 0.5) * 0.14,
  }));
  let frame = 0;
  const FALL = 220, FADE = 50;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const alpha = frame < FALL ? 1 : Math.max(0, 1 - (frame - FALL) / FADE);
    pieces.forEach(p => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
      p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
      if (p.y > canvas.height + 20) { p.y = -20; p.x = Math.random() * canvas.width; }
    });
    frame++;
    if (alpha > 0) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
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
  toast('학습은 게임 중 [학습] 탭에서 볼 수 있습니다.', 'info');
}

// ── Lottery System ────────────────────────────────────────

let _lotPollInterval = null;
let _lotCountdownTimer = null;
let _lotParticipantPicks = [];
let _lotHostPicks = [];
let _lotPickerSubmitted = false;
let _lotResultRound = null;

function _startLotPolling(rid) {
  if (_lotPollInterval) return;
  _checkLotteryStatus(rid);
  _lotPollInterval = setInterval(() => _checkLotteryStatus(rid), 5000);
}

function _stopLotPolling() {
  clearInterval(_lotPollInterval);
  _lotPollInterval = null;
  clearInterval(_lotCountdownTimer);
  _lotCountdownTimer = null;
}

async function _checkLotteryStatus(rid) {
  const d = await api.get(`/api/rooms/${rid}/lottery`).catch(() => null);
  if (!d || !d.state) { _stopLotPolling(); return; }
  const isHost = S.room?.host_id === S.user?.id;
  if (d.state === 'picking') {
    if (isHost) {
      _showLotHostPickingUI(d);
    } else {
      _showLotParticipantPicker(d);
    }
  } else if (d.state === 'drawing') {
    if (isHost) {
      _showLotHostDrawingUI(d);
    } else {
      _showLotParticipantWaiting(d);
    }
  } else if (d.state === 'revealed') {
    _stopLotPolling();
    _showLotteryResult(d, isHost);
  }
}

function _lotCountdown(elemId, deadline) {
  clearInterval(_lotCountdownTimer);
  const el = document.getElementById(elemId);
  if (!el) return;
  _lotCountdownTimer = setInterval(() => {
    const left = Math.max(0, Math.ceil(deadline - Date.now() / 1000));
    el.textContent = left;
    if (left <= 0) clearInterval(_lotCountdownTimer);
  }, 500);
}

// ── HOST side ──

function showLotteryNotifyBar(round) {
  S.lotteryRoundDue = round;
  const bar = document.getElementById('lottery-notify-bar');
  bar.style.display = 'flex';
}

function hideLotteryNotifyBar() {
  document.getElementById('lottery-notify-bar').style.display = 'none';
}

function openLotteryStartModal() {
  hideLotteryNotifyBar();
  const memberCount = S.room?.member_count ?? 0;
  document.getElementById('lottery-prize-input').value = memberCount * 30000000 || '';
  document.getElementById('lottery-start-err').textContent = '';
  openModal('modal-lottery-start');
}

function openManualLotteryModal() {
  if (!S.room || S.room.status !== 'active') { toast('게임 진행 중에만 수동 복권을 시작할 수 있습니다.', 'error'); return; }
  S.lotteryRoundDue = null;  // null = 수동 시작
  const memberCount = S.room?.member_count ?? 0;
  document.getElementById('lottery-prize-input').value = memberCount * 30000000 || '';
  document.getElementById('lottery-start-err').textContent = '';
  openModal('modal-lottery-start');
}

// ── 복권 시간 설정 (대한민국 시간 기준 직접 지정) ─────────────
let _lotteryTimesDraft = [];

function renderLotteryTimesList() {
  const el = document.getElementById('lottery-times-list');
  if (!el) return;
  if (!_lotteryTimesDraft.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--muted)">설정된 시간 없음 (자동 모드)</div>';
    return;
  }
  el.innerHTML = _lotteryTimesDraft.map((t, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;background:var(--s2);border-radius:8px;padding:6px 10px;font-size:13px">
      <span>⏰ ${t}</span>
      <button onclick="removeLotteryTime(${i})" style="background:none;border:none;color:var(--down);cursor:pointer;font-size:14px">✕</button>
    </div>`).join('');
}

function addLotteryTime() {
  const input = document.getElementById('lottery-time-input');
  if (!input.value) return;
  if (!_lotteryTimesDraft.includes(input.value)) {
    _lotteryTimesDraft.push(input.value);
    _lotteryTimesDraft.sort();
  }
  input.value = '';
  renderLotteryTimesList();
}

function removeLotteryTime(i) {
  _lotteryTimesDraft.splice(i, 1);
  renderLotteryTimesList();
}

async function loadLotteryTimes() {
  if (!S.room) return;
  const data = await api.get(`/api/rooms/${S.room.id}/host/lottery-times`);
  if (data.times) {
    _lotteryTimesDraft = data.times.slice();
    renderLotteryTimesList();
  }
}

async function doSaveLotteryTimes() {
  const msg = document.getElementById('lottery-times-msg');
  const data = await api.post(`/api/rooms/${S.room.id}/host/lottery-times`, {times: _lotteryTimesDraft});
  if (data.error) { msg.style.color = 'var(--down)'; msg.textContent = data.error; return; }
  msg.style.color = 'var(--up)';
  msg.textContent = _lotteryTimesDraft.length
    ? `적용됨 · ${_lotteryTimesDraft.join(', ')} (KST)`
    : '자동 모드로 전환됨 (경과 비율 기준)';
}

// ── Web Push 구독 (로또·룰렛 1분 전 알림) ─────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr;
}

async function enablePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    toast('이 브라우저/기기는 알림을 지원하지 않습니다. (iOS는 홈 화면에 추가한 뒤 사용 가능)', 'error');
    return;
  }
  try {
    const keyData = await api.get('/api/push/vapid-public-key');
    if (!keyData.key) { toast('서버에 알림 기능이 아직 설정되지 않았습니다.', 'error'); return; }

    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.', 'warn'); return; }

    const reg = await navigator.serviceWorker.register('/static/sw.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.key),
      });
    }
    const data = await api.post('/api/push/subscribe', sub.toJSON());
    if (data.error) { toast(data.error, 'error'); return; }
    try { localStorage.setItem('pushEnabled', '1'); } catch(e) {}
    toast('🔔 로또·룰렛 1분 전 알림이 켜졌습니다!', 'success');
    ['push-enable-btn', 'push-enable-btn-p'].forEach(id => {
      const b = document.getElementById(id);
      if (b) { b.textContent = '🔔 알림 켜짐'; b.disabled = true; }
    });
    ['push-enable-btn-pg', 'push-enable-btn-hg'].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.textContent = '🔔✓';
    });
  } catch (e) {
    toast('알림 설정 실패: ' + e.message, 'error');
  }
}

async function doStartLottery() {
  const prize = parseFloat(document.getElementById('lottery-prize-input').value);
  if (!prize || prize <= 0) {
    document.getElementById('lottery-start-err').textContent = '상금을 입력하세요.';
    return;
  }
  const d = await api.post(`/api/rooms/${S.room.id}/lottery/start`, {
    round: S.lotteryRoundDue ?? null, prize
  });
  if (d.error) { document.getElementById('lottery-start-err').textContent = d.error; return; }
  closeModal('modal-lottery-start');
  toast('복권 추첨 시작!', 'info');
  S.lotteryHostModalOpen = false;
  _lotHostPicks = [];
  _startLotPolling(S.room.id);
}

async function skipLottery() {
  hideLotteryNotifyBar();
  await api.post(`/api/rooms/${S.room.id}/lottery/skip`, { round: S.lotteryRoundDue });
  S.lotteryRoundDue = null;
}

function _showLotHostPickingUI(d) {
  if (!S.lotteryHostModalOpen) {
    S.lotteryHostModalOpen = true;
    document.getElementById('lhost-picking-section').style.display = 'block';
    document.getElementById('lhost-drawing-section').style.display = 'none';
    openModal('modal-lottery-host');
  }
  _lotCountdown('lhost-pick-countdown', d.pick_deadline);
}

function _showLotHostDrawingUI(d) {
  S.lotteryHostModalOpen = true;
  document.getElementById('lhost-picking-section').style.display = 'none';
  const drawSec = document.getElementById('lhost-drawing-section');
  drawSec.style.display = 'block';
  document.getElementById('lhost-draw-err').textContent = '';
  if (!document.getElementById('host-draw-grid').children.length || _lotHostPicks.length === 0) {
    _lotHostPicks = [];
    _renderLotGrid('host-draw-grid', [], _toggleHostNum);
    document.getElementById('lhost-draw-count').textContent = '0';
  }
  openModal('modal-lottery-host');
  _lotCountdown('lhost-draw-countdown', d.draw_deadline);
}

function _renderLotGrid(containerId, selected, clickFn) {
  const el = document.getElementById(containerId);
  let html = '';
  for (let i = 1; i <= 45; i++) {
    const sel = selected.includes(i) ? 'selected' : '';
    html += `<button class="lottery-num ${sel}" onclick="${clickFn.name}(this,${i})">${i}</button>`;
  }
  el.innerHTML = html;
}

function _toggleHostNum(btn, n) {
  const idx = _lotHostPicks.indexOf(n);
  if (idx >= 0) {
    _lotHostPicks.splice(idx, 1);
    btn.classList.remove('selected');
  } else {
    if (_lotHostPicks.length >= 6) { toast('6개만 선택할 수 있습니다.', 'warn'); return; }
    _lotHostPicks.push(n);
    btn.classList.add('selected');
  }
  document.getElementById('lhost-draw-count').textContent = _lotHostPicks.length;
}

async function doSubmitLotteryDraw() {
  if (_lotHostPicks.length !== 6) {
    document.getElementById('lhost-draw-err').textContent = '6개를 선택해주세요.';
    return;
  }
  const d = await api.post(`/api/rooms/${S.room.id}/lottery/draw`, { numbers: _lotHostPicks });
  if (d.error) { document.getElementById('lhost-draw-err').textContent = d.error; return; }
  closeModal('modal-lottery-host');
  S.lotteryHostModalOpen = false;
  _stopLotPolling();
  _showLotteryResult(d, true);
}

async function doRandomLotteryDraw() {
  const d = await api.post(`/api/rooms/${S.room.id}/lottery/draw`, {});
  if (d.error) { document.getElementById('lhost-draw-err').textContent = d.error; return; }
  closeModal('modal-lottery-host');
  S.lotteryHostModalOpen = false;
  _stopLotPolling();
  _showLotteryResult(d, true);
}

// ── PARTICIPANT side ──

function _showLotParticipantPicker(d) {
  const overlay = document.getElementById('lottery-overlay');
  if (overlay.style.display === 'flex' && document.getElementById('lottery-picker-section').style.display !== 'none') {
    _lotCountdown('lottery-countdown', d.pick_deadline);
    return;
  }
  _lotParticipantPicks = d.my_picks || [];
  _lotPickerSubmitted = !!d.my_picks;
  document.getElementById('lottery-prize-display').textContent = (d.prize || 0).toLocaleString() + '원';
  document.getElementById('lottery-picks-count').textContent = _lotParticipantPicks.length;
  const submitBtn = document.getElementById('lottery-submit-btn');
  submitBtn.disabled = _lotPickerSubmitted;
  submitBtn.textContent = _lotPickerSubmitted ? '제출 완료!' : '제출하기';
  _renderLotGrid('lottery-picker-grid', _lotParticipantPicks, _toggleParticipantNum);
  if (_lotPickerSubmitted) {
    document.querySelectorAll('#lottery-picker-grid .lottery-num').forEach(b => b.disabled = true);
  }
  document.getElementById('lottery-picker-section').style.display = 'block';
  document.getElementById('lottery-waiting-section').style.display = 'none';
  document.getElementById('lottery-result-section').style.display = 'none';
  overlay.style.display = 'flex';
  _lotCountdown('lottery-countdown', d.pick_deadline);
}

function _toggleParticipantNum(btn, n) {
  if (_lotPickerSubmitted) return;
  const idx = _lotParticipantPicks.indexOf(n);
  if (idx >= 0) {
    _lotParticipantPicks.splice(idx, 1);
    btn.classList.remove('selected');
  } else {
    if (_lotParticipantPicks.length >= 6) { toast('6개만 선택할 수 있습니다.', 'warn'); return; }
    _lotParticipantPicks.push(n);
    btn.classList.add('selected');
  }
  document.getElementById('lottery-picks-count').textContent = _lotParticipantPicks.length;
}

async function doSubmitLotteryPick() {
  if (_lotParticipantPicks.length !== 6) { toast('6개를 선택해주세요.', 'warn'); return; }
  const d = await api.post(`/api/rooms/${S.room.id}/lottery/pick`, { numbers: _lotParticipantPicks });
  if (d.error) { toast(d.error, 'error'); return; }
  _lotPickerSubmitted = true;
  const btn = document.getElementById('lottery-submit-btn');
  btn.disabled = true;
  btn.textContent = '제출 완료!';
  document.querySelectorAll('#lottery-picker-grid .lottery-num').forEach(b => b.disabled = true);
  toast('번호 제출 완료!', 'success');
}

function _showLotParticipantWaiting(d) {
  const _bnp = document.getElementById('bomb-news-popup');
  if (_bnp) _bnp.style.display = 'none';
  if (_newsPopupTimer) { clearTimeout(_newsPopupTimer); _newsPopupTimer = null; }
  document.getElementById('lottery-picker-section').style.display = 'none';
  document.getElementById('lottery-waiting-section').style.display = 'block';
  document.getElementById('lottery-result-section').style.display = 'none';
  document.getElementById('lottery-overlay').style.display = 'flex';
  if (_lotParticipantPicks.length > 0) {
    document.getElementById('lottery-my-submitted').textContent = `내 선택: ${_lotParticipantPicks.sort((a,b)=>a-b).join(', ')}`;
  }
  _lotCountdown('lottery-draw-countdown', d.draw_deadline);
}

function _showLotteryResult(d, isHost) {
  clearInterval(_lotCountdownTimer);
  const winning = d.winning || [];

  if (isHost) {
    document.getElementById('lresult-winning-nums').innerHTML =
      winning.map(n => `<span class="lottery-winning-num">${n}</span>`).join('');
    const results = d.results || d.all_results || {};
    const entries = Object.entries(results).sort((a,b) => b[1].matched - a[1].matched);
    if (entries.length === 0) {
      document.getElementById('lresult-detail').innerHTML = '<div class="muted">제출한 참여자가 없습니다.</div>';
    } else {
      document.getElementById('lresult-detail').innerHTML =
        `<table style="width:100%;font-size:12px;border-collapse:collapse">
          <tr style="color:var(--muted);border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:4px 0">번호</th>
            <th style="text-align:center">일치</th>
            <th style="text-align:right">당첨금</th>
          </tr>` +
        entries.map(([uid, r]) => {
          const pStr = (r.picks || []).join(', ');
          const prizeColor = r.prize > 0 ? 'color:var(--up)' : 'color:var(--muted)';
          return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:5px 0;font-size:11px">${pStr}</td>
            <td style="text-align:center;font-weight:700">${r.matched}개</td>
            <td style="text-align:right;font-weight:700;${prizeColor}">${r.prize > 0 ? '+' + (r.prize||0).toLocaleString() + '원' : '꽝'}</td>
          </tr>`;
        }).join('') + '</table>';
    }
    openModal('modal-lottery-result');
  } else {
    const _bnp2 = document.getElementById('bomb-news-popup');
    if (_bnp2) _bnp2.style.display = 'none';
    if (_newsPopupTimer) { clearTimeout(_newsPopupTimer); _newsPopupTimer = null; }
    document.getElementById('lottery-picker-section').style.display = 'none';
    document.getElementById('lottery-waiting-section').style.display = 'none';
    const res = document.getElementById('lottery-result-section');
    res.style.display = 'block';
    document.getElementById('lottery-overlay').style.display = 'flex';
    document.getElementById('lottery-result-winning').innerHTML =
      winning.map(n => `<span class="lottery-winning-num">${n}</span>`).join('');
    const my = d.my_result;
    if (my) {
      const myPicks = (my.picks || []).sort((a,b)=>a-b);
      document.getElementById('lottery-my-picks-result').textContent = `내 번호: ${myPicks.join(', ')}`;
      if (my.prize > 0) {
        document.getElementById('lottery-result-detail').innerHTML =
          `<span style="color:var(--up)">🎉 ${my.matched}개 일치 — +${(my.prize).toLocaleString()}원 당첨!</span>`;
      } else {
        document.getElementById('lottery-result-detail').innerHTML =
          `<span style="color:var(--muted)">${my.matched}개 일치 — 꽝</span>`;
      }
    } else {
      document.getElementById('lottery-my-picks-result').textContent = '';
      document.getElementById('lottery-result-detail').innerHTML =
        '<span class="muted">번호를 제출하지 않았습니다.</span>';
    }
  }
  S.lotteryHostModalOpen = false;
  _lotResultRound = d.round;
}

function closeLotteryOverlay() {
  document.getElementById('lottery-overlay').style.display = 'none';
  _stopLotPolling();
  // 배너는 다음 폴링 사이클에서 서버 상태 기반으로 복원/유지됨
}

function closeLotteryResultModal() {
  closeModal('modal-lottery-result');
}

// ── Rules modal ──────────────────────────────────────────

function openRules() {
  openModal('modal-rules');
  document.querySelector('.rules-tab')?.click();
}

function switchRulesTab(tab, btn) {
  document.querySelectorAll('.rules-section').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.rules-tab').forEach(el => el.classList.remove('active'));
  document.getElementById(`rules-${tab}`).style.display = 'block';
  btn.classList.add('active');
}

// ── Init ─────────────────────────────────────────────────
window.addEventListener('load', async () => {
  document.getElementById('trade-qty')?.addEventListener('input', updateTotal);
  document.getElementById('join-code')?.addEventListener('input', function() {
    this.value = this.value.toUpperCase();
  });
  _prefillLastRoomSettings();

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
