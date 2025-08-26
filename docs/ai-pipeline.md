# Unified AI Pipeline

Amaç: Mood/breath odaklı analiz, öneri ve içgörü üretimi; non‑breaking bağlam kullanımı.

Adımlar:
1) Input normalization (mood entries, voice check-ins)
2) Analiz modülleri (mood patterns, breath)
3) Context injection: `userProfileContext` (motivations, sleep_hours, reminders_enabled)
4) Results + metadata: öneriler, analytics (hafif ağırlıklandırma, örn. reminderBoost)

Kaynaklar:
- core/UnifiedAIPipeline.ts
- context/userProfileAdapter.ts
