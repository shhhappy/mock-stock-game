// ── State ────────────────────────────────────────────────
const S = {
  user: null, room: null,
  stocks: [], sectors: [], activeSector: '',
  currentPage: 'market',
  tradeSymbol: null, tradePrice: 0,
  stockChart: null, portChart: null, hostBarChart: null,
  timerInterval: null, pollInterval: null,
  txnPage: 1, txnTotalPages: 1,
  adjustTargetUid: null,
  depRate: 3, depCash: 0,
  eduTab: 'glossary', glossaryData: [],
};

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
let _curScreen = 'screen-auth';

function showScreen(id, back = false) {
  if (_curScreen === id) return;
  const next = document.getElementById(id);
  const prev = document.getElementById(_curScreen);
  const ease = 'transform 0.32s cubic-bezier(0.25,0.46,0.45,0.94)';

  // Bring next into DOM (remove hidden), position it off-screen
  next.removeAttribute('hidden');
  next.style.cssText = `transition:none;transform:translateX(${back ? '-100%' : '100%'})`;
  next.offsetWidth; // force reflow

  // Slide next in, push prev aside
  next.style.cssText = `transition:${ease};transform:translateX(0)`;
  if (prev) prev.style.cssText = `transition:${ease};transform:translateX(${back ? '30%' : '-30%'})`;

  _curScreen = id;

  setTimeout(() => {
    if (prev) { prev.setAttribute('hidden', ''); prev.style.cssText = ''; }
    next.style.cssText = '';
  }, 340);
}
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeModalOutside(e, id) { if (e.target.id === id) closeModal(id); }

// ── Auth ─────────────────────────────────────────────────
async function doEnter() {
  const u   = document.getElementById('enter-username').value.trim();
  const err = document.getElementById('enter-err');
  err.textContent = '';
  if (!u) { err.textContent = '닉네임을 입력하세요.'; return; }
  const data = await api.post('/api/auth/enter', {username: u});
  if (data.error) { err.textContent = data.error; return; }
  onLogin(data);
}

function onLogin(data) {
  S.user = data.user;
  if (data.active_room) {
    S.room = data.active_room;
    resumeRoom();
  } else {
    showHome();
  }
}

function showHome(back = false) {
  stopPolling();
  stopTimer();
  document.getElementById('home-greeting').textContent = `안녕하세요, ${S.user.username}님! 👋`;
  showScreen('screen-home', back);
}

async function doLogout() {
  stopPolling(); stopTimer();
  await api.post('/api/auth/logout', {});
  S.user = null; S.room = null;
  document.getElementById('enter-username').value = '';
  document.getElementById('enter-err').textContent = '';
  showScreen('screen-auth', true); // 뒤로(왼쪽에서)
}

function goHome() { showHome(true); }

// ── Room: Create ─────────────────────────────────────────
async function doCreateRoom() {
  const name = document.getElementById('room-name').value.trim();
  const dur  = parseInt(document.getElementById('room-duration').value) || 30;
  const cash = parseFloat(document.getElementById('room-cash').value)   || 10_000_000;
  const rate = parseFloat(document.getElementById('room-rate').value)   || 3;
  const err  = document.getElementById('create-err');
  err.textContent = '';
  if (!name) { err.textContent = '방 이름을 입력하세요.'; return; }
  const data = await api.post('/api/rooms', {name, duration_minutes: dur, starting_cash: cash, deposit_rate: rate});
  if (data.error) { err.textContent = data.error; return; }
  S.room = data.room;
  enterHostLobby();
}

// ── Room: Join ───────────────────────────────────────────
async function doJoinRoom() {
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  const err  = document.getElementById('join-err');
  err.textContent = '';
  if (code.length !== 6) { err.textContent = '6자리 코드를 입력하세요.'; return; }
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
  loadLobbyMembers();
  S.pollInterval = setInterval(loadLobbyMembers, 5000);
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
  loadHostMembers();
  S.pollInterval = setInterval(() => {
    loadHostMembers();
    refreshRoomStatus();
  }, 10000);
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
  document.getElementById('pg-room-name').textContent = S.room.name;
  S.depRate = S.room.deposit_rate;
  document.getElementById('dep-rate-display').textContent = S.room.deposit_rate + '%';
  showScreen('screen-p-game');

  // Reset rail to first page (market) without animation
  const rail = document.querySelector('.pages-scroll');
  rail.style.transition = 'none';
  rail.style.transform  = 'translateX(0)';
  rail.offsetWidth; // force reflow
  rail.style.transition = '';

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('nav-market').classList.add('active');
  S.currentPage = 'market';
  startTimer('pg-timer');
  loadMarket();
  refreshMyRank();
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
  }, 8000);
}

async function refreshMyRank() {
  const data = await api.get(`/api/rooms/${S.room.id}/rankings`);
  if (data.error) return;
  const me = data.find(e => e.is_me);
  if (me) {
    document.getElementById('pg-rank').textContent = me.rank + '위';
  }
  const port = await api.get(`/api/rooms/${S.room.id}/portfolio`);
  if (!port.error) {
    S.user._cash = port.cash;
    document.getElementById('pg-cash').textContent = krw(port.total_value);
    const gp = document.getElementById('pg-gain-pct');
    gp.textContent = pct(port.total_gain_pct);
    gp.className = 'muted';
    if (port.total_gain_pct > 0) gp.style.color = 'var(--up)';
    else if (port.total_gain_pct < 0) gp.style.color = 'var(--down)';
    else gp.style.color = 'var(--muted)';
    document.getElementById('dep-cash-display').textContent = krw(port.cash);
    S.depCash = port.cash;
  }
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
function stopPolling() { clearInterval(S.pollInterval);  S.pollInterval = null; }

async function refreshRoomStatus() {
  const r = await api.get(`/api/rooms/${S.room.id}`);
  if (r.status === 'ended') {
    S.room = r; stopPolling(); stopTimer();
    await loadResults(); showScreen('screen-results');
  }
}

// ── Navigation (participant game) ────────────────────────
const PAGE_ORDER = ['market', 'portfolio', 'deposit', 'rankings', 'education'];

function showPage(page) {
  if (S.currentPage === page) return;
  const idx = PAGE_ORDER.indexOf(page);

  // Slide the entire rail to show the target page
  document.querySelector('.pages-scroll').style.transform = `translateX(-${idx * 100}%)`;

  // Update nav highlight
  S.currentPage = page;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`nav-${page}`).classList.add('active');

  // Load data for the page
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
  renderGrid(S.stocks, prev);
}

function renderSectors() {
  document.getElementById('sector-filters').innerHTML = ['전체', ...S.sectors].map(s => {
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
    (!q || st.name.includes(q) || st.symbol.toLowerCase().includes(q))
  );
  renderGrid(filtered, {});
}

function renderGrid(stocks, prevPrices) {
  const grid = document.getElementById('stock-grid');
  if (!stocks.length) {
    grid.innerHTML = '<div class="empty-state"><div class="e-icon">🔍</div>검색 결과 없음</div>';
    return;
  }
  grid.innerHTML = stocks.map(st => {
    const cls   = st.change_pct > 0 ? 'chip-up' : st.change_pct < 0 ? 'chip-down' : 'chip-flat';
    const arrow = st.change_pct > 0 ? '▲' : st.change_pct < 0 ? '▼' : '─';
    const pColor = st.change_pct > 0 ? 'var(--up)' : st.change_pct < 0 ? 'var(--down)' : 'var(--text)';
    return `
      <div class="stock-card" id="sc-${st.symbol.replace('.','_')}" onclick="openStockModal('${st.symbol}')">
        <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${st.name}</div>
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
  document.getElementById('pg-cash').textContent = krw(data.cash);
  document.getElementById('ms-cash').textContent = krw(data.cash);
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
function updateDepPreview() {
  const amount = parseFloat(document.getElementById('dep-amount').value) || 0;
  const preview = document.getElementById('dep-preview');
  if (amount > 0) {
    const interest = amount * S.depRate / 100;
    document.getElementById('dep-preview-interest').textContent = '+' + krw(interest);
    document.getElementById('dep-preview-total').textContent    = krw(amount + interest);
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
        <div style="color:var(--up);font-size:12px">예상 이자 +${krw(d.expected_interest)}</div>
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
  document.getElementById('pg-cash').textContent = krw(data.cash);
  S.depCash = data.cash;
  document.getElementById('dep-cash-display').textContent = krw(data.cash);
  loadDepositsPage();
}

async function doWithdraw(id) {
  if (!confirm('예금을 해지하면 이자가 지급되지 않습니다. 계속하시겠습니까?')) return;
  const data = await api.del(`/api/rooms/${S.room.id}/deposits/${id}`);
  if (data.error) { toast(data.error, 'error'); return; }
  toast(data.message, 'info');
  document.getElementById('pg-cash').textContent = krw(data.cash);
  S.depCash = data.cash;
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
async function loadResults() {
  document.getElementById('results-room-name').textContent = S.room?.name || '';
  const data = await api.get(`/api/rooms/${S.room.id}/rankings`);
  const list = document.getElementById('results-list');
  list.innerHTML = data.map(e => {
    const medal = e.rank===1?'🥇':e.rank===2?'🥈':e.rank===3?'🥉':e.rank+'위';
    return `
      <div class="results-row${e.rank<=3?' rank-'+e.rank:''}">
        <div style="font-size:20px;width:36px;text-align:center">${medal}</div>
        <div style="flex:1;font-weight:700">${e.username}${e.is_me?'<span class="chip chip-blue" style="font-size:10px;margin-left:4px">나</span>':''}</div>
        <div style="text-align:right">
          <div style="font-weight:700">${krw(e.total_value)}</div>
          <div class="${updn(e.gain_pct)}" style="font-size:12px">${pct(e.gain_pct)}</div>
        </div>
      </div>`;
  }).join('');

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

// ── Init ─────────────────────────────────────────────────
window.addEventListener('load', async () => {
  document.getElementById('enter-username')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doEnter();
  });
  document.getElementById('trade-qty')?.addEventListener('input', updateTotal);
  document.getElementById('join-code')?.addEventListener('input', function() {
    this.value = this.value.toUpperCase();
  });

  const me = await api.get('/api/auth/me');
  if (!me.error) { onLogin(me); }
});
