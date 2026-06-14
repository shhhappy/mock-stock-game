# 모의주식게임 일일 분석 노트

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
