import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/game_provider.dart';

class ShopItem {
  final String emoji;
  final String name;
  final String description;
  final int cost;

  const ShopItem({
    required this.emoji,
    required this.name,
    required this.description,
    required this.cost,
  });
}

const _shopItems = [
  ShopItem(
    emoji: '💧',
    name: '특수 물',
    description: '성장 속도 20% 증가 (1시간)',
    cost: 30,
  ),
  ShopItem(
    emoji: '☀️',
    name: '햇빛 부스터',
    description: '성장 속도 50% 증가 (30분)',
    cost: 50,
  ),
  ShopItem(
    emoji: '🧪',
    name: '비료',
    description: '다음 단계 즉시 성장',
    cost: 100,
  ),
  ShopItem(
    emoji: '🐛',
    name: '해충 방제',
    description: '병충해 피해 방지 (24시간)',
    cost: 40,
  ),
];

class ShopScreen extends StatelessWidget {
  const ShopScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0E8),
      appBar: AppBar(
        backgroundColor: const Color(0xFF8B6914),
        foregroundColor: Colors.white,
        title: const Text('🏪 감자 상점'),
      ),
      body: Consumer<GameProvider>(
        builder: (context, game, _) {
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('🪙', style: TextStyle(fontSize: 24)),
                    const SizedBox(width: 8),
                    Text(
                      '${game.potato.coins} 감자코인',
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF8B6914),
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: _shopItems.length,
                  itemBuilder: (context, i) {
                    final item = _shopItems[i];
                    final canAfford = game.potato.coins >= item.cost;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: ListTile(
                        leading: Text(item.emoji,
                            style: const TextStyle(fontSize: 36)),
                        title: Text(item.name,
                            style:
                                const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text(item.description),
                        trailing: ElevatedButton(
                          onPressed: canAfford
                              ? () async {
                                  final bought =
                                      await game.buyItem(item.name, item.cost);
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(bought
                                            ? '${item.name} 구매 완료!'
                                            : '감자코인이 부족해요 🥔'),
                                      ),
                                    );
                                  }
                                }
                              : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.green[600],
                            foregroundColor: Colors.white,
                          ),
                          child: Text('🪙 ${item.cost}'),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
