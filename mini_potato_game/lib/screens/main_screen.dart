import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/game_provider.dart';
import '../models/potato_model.dart';
import '../widgets/growth_progress_bar.dart';
import 'shop_screen.dart';

class MainScreen extends StatelessWidget {
  const MainScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0E8),
      appBar: AppBar(
        backgroundColor: const Color(0xFF8B6914),
        foregroundColor: Colors.white,
        title: const Text('🥔 미니 감자 키우기'),
        actions: [
          IconButton(
            icon: const Icon(Icons.store),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ShopScreen()),
            ),
          ),
        ],
      ),
      body: Consumer<GameProvider>(
        builder: (context, game, _) {
          if (game.isLoading) {
            return const Center(child: CircularProgressIndicator());
          }

          final potato = game.potato;

          return Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                // 코인 표시
                _CoinDisplay(coins: potato.coins),
                const SizedBox(height: 32),

                // 감자 이미지 (이모지 크게)
                _PotatoDisplay(stage: potato.stage),
                const SizedBox(height: 16),

                // 단계 텍스트
                Text(
                  '${potato.stage.emoji} ${potato.stage.label} 단계',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF5A3E00),
                  ),
                ),
                const SizedBox(height: 8),

                if (potato.stage != GrowthStage.harvest)
                  Text(
                    '다음 단계까지 ${((1.0 - potato.growthProgress) * potato.stage.secondsToNext).ceil()}초',
                    style: TextStyle(color: Colors.grey[600]),
                  ),

                const SizedBox(height: 24),

                // 성장 진행바
                GrowthProgressBar(potato: potato),
                const Spacer(),

                // 액션 버튼
                _ActionButton(
                  stage: potato.stage,
                  onTap: () => game.performAction(),
                ),
                const SizedBox(height: 16),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _CoinDisplay extends StatelessWidget {
  final int coins;
  const _CoinDisplay({required this.coins});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.amber[100],
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.amber),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('🪙', style: TextStyle(fontSize: 20)),
          const SizedBox(width: 8),
          Text(
            '$coins 감자코인',
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Color(0xFF8B6914),
            ),
          ),
        ],
      ),
    );
  }
}

class _PotatoDisplay extends StatelessWidget {
  final GrowthStage stage;
  const _PotatoDisplay({required this.stage});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 160,
      height: 160,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.brown.withOpacity(0.2),
            blurRadius: 20,
            spreadRadius: 5,
          ),
        ],
      ),
      child: Center(
        child: Text(
          stage.emoji,
          style: const TextStyle(fontSize: 80),
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final GrowthStage stage;
  final VoidCallback onTap;

  const _ActionButton({required this.stage, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isHarvest = stage == GrowthStage.harvest;
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: isHarvest ? Colors.amber : Colors.green[600],
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        child: Text(
          isHarvest ? '🎉 수확하기 (+50코인)' : '${stage.emoji} ${stage.action}',
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}
