# 🧪 Testing Strategy Overview (Q4 2025)

Bu belge, geçerli test stratejisini ve hangi kontrol listelerinin kullanılacağını özetler.

## Kapsam
- Voice Mood Check‑in
- CBT Thought Record
- Breathwork
- ERP Önerileri / ERP Oturum Akışı
- Insights v2 / Progress Analytics
- Telemetry (privacy-first)

## Hariç
- AI Chat (yok)
- Crisis Detection (kaldırıldı)

## Referans Kontrol Listeleri
- AI_TEST_CHECKLIST.md (güncel)
- AI_PRODUCTION_TEST_REPORT.md (güncel)

## Temel İlkeler
- Flag tabanlı test (sadece aktif özellikler)
- Offline-first senaryolar
- Supabase senkron doğrulamaları
- Telemetry event doğrulaması (enum’a karşı)
