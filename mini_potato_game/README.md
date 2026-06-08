# 🥔 미니 감자 키우기

Flutter + Android 홈 위젯 감자 육성 게임

## 프로젝트 구조

```
mini_potato_game/
├── lib/
│   ├── main.dart                        # 앱 진입점, Provider 설정
│   ├── models/
│   │   └── potato_model.dart            # 감자 데이터 모델 + 5단계 enum
│   ├── services/
│   │   ├── potato_service.dart          # SharedPreferences 저장/불러오기
│   │   └── game_provider.dart           # 게임 로직, 타이머, 오프라인 성장
│   ├── screens/
│   │   ├── main_screen.dart             # 메인 게임 화면
│   │   └── shop_screen.dart             # 상점 화면
│   └── widgets/
│       └── growth_progress_bar.dart     # 성장 진행 바 위젯
└── android/app/src/main/
    ├── kotlin/.../PotatoWidget.kt        # 홈 위젯 AppWidgetProvider (Kotlin)
    ├── res/
    │   ├── xml/potato_widget_info.xml    # 위젯 메타데이터
    │   ├── layout/widget_potato.xml     # 위젯 레이아웃
    │   ├── drawable/widget_background.xml
    │   └── values/strings.xml
    └── AndroidManifest_widget_snippet.xml  # 위젯 등록 코드 (수동 추가)
```

## 감자 성장 5단계

| 단계 | 이모지 | 필요 시간 | 액션 |
|------|--------|-----------|------|
| 씨앗 | 🥔 | 60초 | 물주기 |
| 새싹 | 🌱 | 120초 | 햇빛·비료 |
| 성장 | 🌿 | 180초 | 병충해 방어 |
| 꽃   | 🌸 | 240초 | 수분 이벤트 |
| 수확 | 🎉 | — | +50 감자코인 |

## SharedPreferences 키 (Flutter ↔ Android 위젯 공유)

| 키 | 타입 | 설명 |
|----|------|------|
| `flutter.potato_stage` | Long | 성장 단계 인덱스 (0~4) |
| `flutter.potato_coins` | Long | 감자코인 잔액 |
| `flutter.potato_progress` | Float | 현재 단계 진행률 (0.0~1.0) |
| `flutter.potato_last_action` | String | 마지막 액션 ISO8601 시각 |

> Flutter의 SharedPreferences는 자동으로 `flutter.` 접두사를 붙입니다.

## 빠른 시작

```bash
# 1. 패키지 설치
flutter pub get

# 2. 에뮬레이터 / 실기기 실행
flutter run

# 3. 위젯 등록 (AndroidManifest.xml 수동 수정 필요)
#    AndroidManifest_widget_snippet.xml 내용을 <application> 안에 붙여넣기
```

## 개발 로드맵

- [x] 1단계: 감자 모델 & 성장 타이머
- [x] 2단계: Flutter 앱 화면 (메인 + 상점)
- [x] 3단계: Android 홈 위젯 (Kotlin)
- [ ] 4단계: 알림 (성장 완료, 수확 가능)
- [ ] 5단계: 감자 스킨 커스터마이징
