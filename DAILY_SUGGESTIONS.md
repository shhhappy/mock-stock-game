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
