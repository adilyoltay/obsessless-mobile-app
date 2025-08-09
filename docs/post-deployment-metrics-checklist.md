# Deployment Sonrası 24 Saat Telemetri Kontrol Listesi

Bu liste, üretime yapılan yeni bir dağıtımın ardından ilk 24 saat içinde izlenmesi gereken metrikleri içerir.

- [ ] **Sentry/Datadog entegrasyonu**: İlgili ortamın (dev/prod) doğru veri aldığını doğrula.
- [ ] **Latency izle**: Ortalama yanıt süresinin 3s uyarı eşiği, 5s kritik eşiğinin altında olduğundan emin ol.
- [ ] **Hata oranı**: 2% uyarı, 5% kritik sınırlarının aşılmadığını kontrol et.
- [ ] **Offline kuyruk büyüklüğü**: 50 olay uyarı, 100 olay kritik eşiklerini aşmadığından emin ol.
- [ ] **Alert bildirimleri**: Kritik veya uyarı seviyesinde tetiklenen alarmları incele ve gerekirse müdahale et.
- [ ] **Flush başarıları**: Telemetry buffer'ının düzenli olarak boşaltıldığını ve birikmediğini doğrula.

Checklist tamamlandığında sonuçları ilgili rapor ya da monitoring panosuna ekle.
