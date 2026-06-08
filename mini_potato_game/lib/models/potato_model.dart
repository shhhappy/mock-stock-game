enum GrowthStage { seed, sprout, growing, flower, harvest }

extension GrowthStageExt on GrowthStage {
  String get label {
    switch (this) {
      case GrowthStage.seed:
        return '씨앗';
      case GrowthStage.sprout:
        return '새싹';
      case GrowthStage.growing:
        return '성장';
      case GrowthStage.flower:
        return '꽃';
      case GrowthStage.harvest:
        return '수확!';
    }
  }

  String get emoji {
    switch (this) {
      case GrowthStage.seed:
        return '🥔';
      case GrowthStage.sprout:
        return '🌱';
      case GrowthStage.growing:
        return '🌿';
      case GrowthStage.flower:
        return '🌸';
      case GrowthStage.harvest:
        return '🎉';
    }
  }

  String get action {
    switch (this) {
      case GrowthStage.seed:
        return '물주기';
      case GrowthStage.sprout:
        return '햇빛·비료';
      case GrowthStage.growing:
        return '병충해 방어';
      case GrowthStage.flower:
        return '수분 이벤트';
      case GrowthStage.harvest:
        return '코인 획득';
    }
  }

  // 다음 단계까지 필요한 초(seconds)
  int get secondsToNext {
    switch (this) {
      case GrowthStage.seed:
        return 60;
      case GrowthStage.sprout:
        return 120;
      case GrowthStage.growing:
        return 180;
      case GrowthStage.flower:
        return 240;
      case GrowthStage.harvest:
        return 0;
    }
  }
}

class PotatoModel {
  GrowthStage stage;
  int coins;
  DateTime lastActionTime;
  double growthProgress; // 0.0 ~ 1.0

  PotatoModel({
    this.stage = GrowthStage.seed,
    this.coins = 0,
    DateTime? lastActionTime,
    this.growthProgress = 0.0,
  }) : lastActionTime = lastActionTime ?? DateTime.now();
}
