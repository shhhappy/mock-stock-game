package com.potato.minipotatogame

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.potato.minipotatogame.R

// SharedPreferences 키 — Flutter(Dart)와 반드시 동일하게 유지
private const val PREFS_NAME = "FlutterSharedPreferences"
private const val KEY_STAGE = "flutter.potato_stage"
private const val KEY_COINS = "flutter.potato_coins"
private const val KEY_PROGRESS = "flutter.potato_progress"

// 성장 단계 (GrowthStage enum 순서와 동일)
private val stageEmojis = listOf("🥔", "🌱", "🌿", "🌸", "🎉")
private val stageLabels = listOf("씨앗", "새싹", "성장", "꽃", "수확!")
private val stageActions = listOf("💧 물주기", "☀️ 햇빛·비료", "🐛 병충해 방어", "🌸 수분 이벤트", "🎉 수확하기")

class PotatoWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        appWidgetIds.forEach { widgetId ->
            updateWidget(context, appWidgetManager, widgetId)
        }
    }

    companion object {
        fun updateWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            widgetId: Int
        ) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val stageIndex = (prefs.getLong(KEY_STAGE, 0L)).toInt().coerceIn(0, 4)
            val coins = prefs.getLong(KEY_COINS, 0L).toInt()
            val progress = prefs.getFloat(KEY_PROGRESS, 0f)

            val views = RemoteViews(context.packageName, R.layout.widget_potato)
            views.setTextViewText(R.id.tv_potato_emoji, stageEmojis[stageIndex])
            views.setTextViewText(R.id.tv_stage_label, "${stageLabels[stageIndex]} 단계")
            views.setTextViewText(R.id.tv_coins, "🪙 $coins")
            views.setProgressBar(R.id.progress_growth, 100, (progress * 100).toInt(), false)
            views.setTextViewText(R.id.btn_action, stageActions[stageIndex])

            // 위젯 탭 시 앱 실행
            val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (intent != null) {
                val pendingIntent = android.app.PendingIntent.getActivity(
                    context, 0, intent,
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT or
                            android.app.PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.btn_action, pendingIntent)
            }

            appWidgetManager.updateAppWidget(widgetId, views)
        }
    }
}
