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
