# 📋 FAZ 1 TEST KONTROL LİSTESİ

> **Tarih**: 2025-01-04  
> **Versiyon**: 1.0.0  
> **Durum**: Test Bekliyor

## 🎯 Test Edilecek Özellikler

Bu doküman, FAZ 1'de yapılan kritik hata düzeltmelerinin manuel test senaryolarını içerir.

---

## ✅ FAZ 1.1: OfflineSyncService Voice/Thought Desteği

### Test Senaryosu 1: Voice Checkin Offline Sync
**Ön Koşullar**: İnternet bağlantısı kapalı

**Adımlar**:
1. Uygulamayı aç ve Today sayfasına git
2. "Mood Check-in" butonuna tıkla
3. Ses kaydı yap (en az 5 saniye konuş)
4. Kaydın tamamlanmasını bekle

**Beklenen Sonuç**:
- [ ] Ses kaydı başarıyla tamamlanmalı
- [ ] "Added to offline sync queue" konsol mesajı görülmeli
- [ ] Hata mesajı gösterilmemeli

**Test Sonrası**:
1. İnternet bağlantısını aç
2. 30 saniye bekle
3. Supabase dashboard'da `voice_checkins` tablosunu kontrol et

**Beklenen**:
- [ ] Kayıt veritabanında görünmeli

---

### Test Senaryosu 2: CBT Thought Record Offline Sync
**Ön Koşullar**: İnternet bağlantısı kapalı

**Adımlar**:
1. CBT sekmesine git
2. FAB (+) butonuna tıkla
3. Düşünce kaydı formunu doldur
4. Kaydet butonuna bas

**Beklenen Sonuç**:
- [ ] Form başarıyla kaydedilmeli
- [ ] "CBT record added to offline sync queue" konsol mesajı
- [ ] Başarı bildirimi gösterilmeli

**Test Sonrası**:
1. İnternet bağlantısını aç
2. Uygulamayı yeniden başlat
3. Supabase dashboard kontrol et

**Beklenen**:
- [ ] `thought_records` tablosunda kayıt görünmeli

---

## ✅ FAZ 1.2: Voice Checkins Tablosu Kaydı

### Test Senaryosu 3: Voice Analiz ve Kayıt
**Ön Koşullar**: İnternet bağlantısı açık

**Adımlar**:
1. Today sayfasında "Mood Check-in" butonuna tıkla
2. Farklı türlerde cümleler söyle:
   - "Bugün kendimi çok iyi hissediyorum" (MOOD)
   - "Ya başarısız olursam?" (CBT)
   - "Kapıyı kilitledim mi?" (OCD)

**Her kayıt için kontrol**:
- [ ] Analiz doğru tip tespiti yapmalı
- [ ] Console'da "Voice checkin saved to database" mesajı
- [ ] Doğru sayfaya yönlendirme yapılmalı

**Veritabanı Kontrolü**:
```sql
SELECT * FROM voice_checkins 
WHERE user_id = 'YOUR_USER_ID' 
ORDER BY created_at DESC 
LIMIT 5;
```

**Beklenen alanlar**:
- [ ] `text`: PII maskelenmiş metin
- [ ] `mood`: 0-100 arası değer
- [ ] `trigger`: Tespit edilen tetikleyici
- [ ] `analysis_type`: MOOD/CBT/OCD/ERP/BREATHWORK
- [ ] `original_duration`: Milisaniye cinsinden süre

---

## ✅ FAZ 1.3: CBT Offline Sync Entegrasyonu

### Test Senaryosu 4: CBT Kayıt İnternet Kesintisi
**Ön Koşullar**: İnternet bağlantısı açık

**Adımlar**:
1. CBT sayfasına git
2. Yeni kayıt formunu aç
3. Formu yarıya kadar doldur
4. **İnterneti kapat**
5. Formu tamamla ve kaydet

**Beklenen**:
- [ ] Kayıt başarılı bildirimi
- [ ] Console'da "CBT record added to offline sync queue"
- [ ] Lokal storage'da kayıt mevcut

**Senkronizasyon Testi**:
1. İnterneti tekrar aç
2. 1 dakika bekle
3. Settings → Sync Status kontrol et

**Beklenen**:
- [ ] Sync queue: 0 items
- [ ] Last sync: Son 1 dakika içinde
- [ ] Veritabanında kayıt mevcut

---

## 🔄 Entegrasyon Testleri

### Test Senaryosu 5: Çoklu Offline Kayıt
**Senaryo**: İnternet yokken birden fazla kayıt

**Adımlar**:
1. İnterneti kapat
2. Sırasıyla yap:
   - 2 voice checkin
   - 1 CBT kaydı
   - 1 kompulsiyon kaydı
3. İnterneti aç
4. Uygulamayı arka plana al ve tekrar aç

**Kontrol Listesi**:
- [ ] Tüm kayıtlar kuyrukta görünmeli (Settings → Sync Status)
- [ ] Senkronizasyon otomatik başlamalı
- [ ] 2 dakika içinde tüm kayıtlar senkronize olmalı
- [ ] Veritabanında tüm kayıtlar doğru tablolarda

---

## 📱 Cihazlar Arası Test

### Test Senaryosu 6: Cross-Device Sync
**Cihazlar**: 2 farklı cihaz, aynı kullanıcı

**Adımlar**:
1. **Cihaz A**: Voice checkin yap
2. **Cihaz B**: 30 saniye sonra uygulamayı aç
3. **Cihaz B**: Today sayfasını yenile (pull-to-refresh)

**Beklenen**:
- [ ] Cihaz B'de son mood skoru görünmeli
- [ ] Analytics'te voice checkin kaydı

---

## 🐛 Edge Case Testleri

### Test Senaryosu 7: Hızlı Offline/Online Geçişler
1. Voice checkin başlat
2. Kayıt sırasında interneti kapat
3. Kaydı tamamla
4. Hemen interneti aç

**Beklenen**:
- [ ] Kayıt kaybolmamalı
- [ ] Sync başarılı olmalı
- [ ] Duplicate kayıt olmamalı

### Test Senaryosu 8: Büyük Metin Kaydı
1. 60+ saniye konuş
2. Kaydet

**Beklenen**:
- [ ] Metin truncate edilmemeli
- [ ] PII maskeleme çalışmalı
- [ ] Kayıt başarılı olmalı

---

## 🔍 Console Log Kontrolleri

Test sırasında aşağıdaki log mesajlarını takip edin:

### Başarılı Akış:
```
🎯 Unified Voice Analysis: {type: "MOOD", mood: 75, ...}
✅ Voice checkin saved to database
✅ CBT record saved to Supabase: abc-123
```

### Offline Akış:
```
⚠️ Voice checkin save failed, adding to offline queue: Error
✅ Added to offline sync queue
⚠️ Supabase save failed, adding to offline queue: Error
✅ CBT record added to offline sync queue
```

### Sync Akış:
```
🧾 Sync summary: {successful: 3, failed: 0, conflicts: 0}
✅ All items synced successfully
```

---

## 📊 Metrik Kontrolleri

Test sonrası kontrol edilecek metrikler:

1. **Sync Success Rate**:
   - Hedef: %100
   - SQL: `SELECT COUNT(*) FROM sync_logs WHERE status = 'success'`

2. **Data Loss Rate**:
   - Hedef: %0
   - Offline kayıt sayısı = Online kayıt sayısı

3. **Sync Latency**:
   - Hedef: <2 saniye
   - İnternet geldiğinde sync başlama süresi

---

## ✍️ Test Sonuçları

| Test # | Test Adı | Durum | Test Eden | Tarih | Notlar |
|--------|----------|-------|-----------|-------|--------|
| 1 | Voice Offline Sync | ⏳ | - | - | - |
| 2 | CBT Offline Sync | ⏳ | - | - | - |
| 3 | Voice Analiz Kayıt | ⏳ | - | - | - |
| 4 | CBT İnternet Kesintisi | ⏳ | - | - | - |
| 5 | Çoklu Offline Kayıt | ⏳ | - | - | - |
| 6 | Cross-Device Sync | ⏳ | - | - | - |
| 7 | Hızlı Geçişler | ⏳ | - | - | - |
| 8 | Büyük Metin | ⏳ | - | - | - |

**Lejant**: ✅ Başarılı | ❌ Başarısız | ⏳ Bekliyor | 🔄 Tekrar Test

---

## 📝 Bilinen Sorunlar

- [ ] Issue #1: (Henüz bilinen sorun yok)

---

## 🚀 Test Ortamı Hazırlığı

```bash
# Test build oluştur
npm run build:test

# Test veritabanını temizle (opsiyonel)
npm run db:reset:test

# Test kullanıcısı oluştur
# Email: test@obsessless.com
# Password: Test123!
```

---

**Son Güncelleme**: 2025-01-04  
**Sonraki Review**: Test tamamlandıktan sonra
