import 'package:shared_preferences/shared_preferences.dart';
import '../models/potato_model.dart';

// SharedPreferences 키 — 위젯(Kotlin)과 반드시 동일하게 유지
const kStageKey = 'potato_stage';
const kCoinsKey = 'potato_coins';
const kLastActionKey = 'potato_last_action';
const kProgressKey = 'potato_progress';

class PotatoService {
  static Future<void> save(PotatoModel model) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(kStageKey, model.stage.index);
    await prefs.setInt(kCoinsKey, model.coins);
    await prefs.setString(
        kLastActionKey, model.lastActionTime.toIso8601String());
    await prefs.setDouble(kProgressKey, model.growthProgress);
  }

  static Future<PotatoModel> load() async {
    final prefs = await SharedPreferences.getInstance();
    final stageIndex = prefs.getInt(kStageKey) ?? 0;
    final coins = prefs.getInt(kCoinsKey) ?? 0;
    final lastActionStr = prefs.getString(kLastActionKey);
    final progress = prefs.getDouble(kProgressKey) ?? 0.0;

    final lastAction =
        lastActionStr != null ? DateTime.parse(lastActionStr) : DateTime.now();

    return PotatoModel(
      stage: GrowthStage.values[stageIndex.clamp(0, GrowthStage.values.length - 1)],
      coins: coins,
      lastActionTime: lastAction,
      growthProgress: progress,
    );
  }
}
