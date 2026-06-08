import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/potato_model.dart';
import 'potato_service.dart';

class GameProvider extends ChangeNotifier {
  PotatoModel _potato = PotatoModel();
  Timer? _growthTimer;
  bool _isLoading = true;

  PotatoModel get potato => _potato;
  bool get isLoading => _isLoading;
  bool get canHarvest => _potato.stage == GrowthStage.harvest;

  GameProvider() {
    _init();
  }

  Future<void> _init() async {
    _potato = await PotatoService.load();
    _applyOfflineGrowth();
    _isLoading = false;
    notifyListeners();
    _startGrowthTimer();
  }

  // 앱이 꺼진 동안 경과한 시간만큼 성장 반영
  void _applyOfflineGrowth() {
    if (_potato.stage == GrowthStage.harvest) return;

    final elapsed =
        DateTime.now().difference(_potato.lastActionTime).inSeconds;
    final needed = _potato.stage.secondsToNext;
    if (needed == 0) return;

    final total = _potato.growthProgress * needed + elapsed;
    final stages = (total / needed).floor();
    final remainder = total % needed;

    for (int i = 0; i < stages; i++) {
      if (_potato.stage.index < GrowthStage.values.length - 1) {
        _potato.stage = GrowthStage.values[_potato.stage.index + 1];
      } else {
        break;
      }
    }
    _potato.growthProgress =
        _potato.stage == GrowthStage.harvest ? 1.0 : remainder / needed;
  }

  void _startGrowthTimer() {
    _growthTimer?.cancel();
    _growthTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      _tick();
    });
  }

  void _tick() {
    if (_potato.stage == GrowthStage.harvest) return;

    final needed = _potato.stage.secondsToNext;
    if (needed == 0) return;

    _potato.growthProgress += 1.0 / needed;

    if (_potato.growthProgress >= 1.0) {
      _potato.growthProgress = 0.0;
      _potato.stage = GrowthStage.values[_potato.stage.index + 1];
    }

    notifyListeners();
    PotatoService.save(_potato);
  }

  // 현재 단계 액션 수행 (물주기, 햇빛, 방어 등)
  Future<void> performAction() async {
    if (_potato.stage == GrowthStage.harvest) {
      await harvest();
      return;
    }
    // 액션 시 성장 10% 가속
    _potato.growthProgress = (_potato.growthProgress + 0.1).clamp(0.0, 0.99);
    _potato.lastActionTime = DateTime.now();
    notifyListeners();
    await PotatoService.save(_potato);
  }

  Future<void> harvest() async {
    _potato.coins += 50;
    _potato.stage = GrowthStage.seed;
    _potato.growthProgress = 0.0;
    _potato.lastActionTime = DateTime.now();
    notifyListeners();
    await PotatoService.save(_potato);
  }

  Future<bool> buyItem(String itemName, int cost) async {
    if (_potato.coins < cost) return false;
    _potato.coins -= cost;
    notifyListeners();
    await PotatoService.save(_potato);
    return true;
  }

  @override
  void dispose() {
    _growthTimer?.cancel();
    super.dispose();
  }
}
