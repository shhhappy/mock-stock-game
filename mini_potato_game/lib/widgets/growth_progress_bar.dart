import 'package:flutter/material.dart';
import '../models/potato_model.dart';

class GrowthProgressBar extends StatelessWidget {
  final PotatoModel potato;

  const GrowthProgressBar({super.key, required this.potato});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: GrowthStage.values.map((stage) {
            final isActive = stage.index <= potato.stage.index;
            return Column(
              children: [
                Text(stage.emoji, style: TextStyle(fontSize: isActive ? 24 : 16)),
                Text(
                  stage.label,
                  style: TextStyle(
                    fontSize: 10,
                    color: isActive ? Colors.green[700] : Colors.grey,
                    fontWeight:
                        stage == potato.stage ? FontWeight.bold : FontWeight.normal,
                  ),
                ),
              ],
            );
          }).toList(),
        ),
        const SizedBox(height: 8),
        LinearProgressIndicator(
          value: potato.stage == GrowthStage.harvest ? 1.0 : potato.growthProgress,
          backgroundColor: Colors.grey[200],
          valueColor: AlwaysStoppedAnimation<Color>(
            potato.stage == GrowthStage.harvest ? Colors.amber : Colors.green,
          ),
          minHeight: 10,
          borderRadius: BorderRadius.circular(5),
        ),
      ],
    );
  }
}
