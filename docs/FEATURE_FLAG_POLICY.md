# Feature Flag Policy

Bu belge ObsessLess uygulamasında feature flag kullanımını ve temizleme süreçlerini tanımlar.

## Flag Temizleme Prosedürü

1. CI'da çalışan `npm run flag-audit` komutu ile kullanılmayan bayrakları düzenli olarak raporla.
2. Her bayrak satırında bulunan `// sunset: vX.Y` yorumunu takip et. İlgili sürüm yayımlandığında:
   - Flag tanımını ve ona bağlı koşullu kodları kaldır.
   - Gerekli testleri ve dokümantasyonu güncelle.
   - `npm run flag-audit` ve `npm run pre-commit` çalıştırarak kodun temiz olduğundan emin ol.
3. PR açıklamasında kaldırılan bayrakları ve etkilerini belirt.

Bu prosedür, kod tabanında eskimiş bayrakların kalmamasını ve uygulamanın sade kalmasını sağlar.
