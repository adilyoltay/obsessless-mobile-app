# Debug Check-in Sorunları

## Problem
Sesli check-in sonrası yönlendirme yapılmıyor ve kayıt eklenmiyor.

## Debug Adımları

### 1. Console Log'ları Kontrol Et
Uygulama çalışırken Developer Console'da şu log'ları ara:

```
🎯 Voice Analysis Result: 
🎯 Analysis Type:
🎯 Analysis Confidence:
🎯 Original Text:
🔄 handleAnalysisResult called with:
🔄 shouldShowAutoRecord:
🔄 prepareAutoRecord result:
📊 shouldShowAutoRecord called with:
📊 Confidence X vs threshold Y:
📊 prepareAutoRecord - confidence check:
```

### 2. Sorun Tespiti Kontrol Listesi

#### A. Ses Tanıma Çalışıyor mu?
- [ ] Konuşulan metin doğru transkripsiyona dönüşüyor mu?
- [ ] "Original Text" log'unda metin görünüyor mu?

#### B. AI Analizi Çalışıyor mu?
- [ ] Analysis Type doğru tespit ediliyor mu? (OCD/CBT/MOOD/ERP/BREATHWORK)
- [ ] Confidence değeri nedir? (0-1 arası)
- [ ] Gemini API çalışıyor mu? (Log: "Using Gemini result" veya "Using heuristic result")

#### C. Otomatik Kayıt Modalı Açılıyor mu?
- [ ] shouldShowAutoRecord true dönüyor mu?
- [ ] prepareAutoRecord data hazırlıyor mu?
- [ ] AutoRecordModal render ediliyor mu?

#### D. Yönlendirme Çalışıyor mu?
- [ ] Eğer modal açılmıyorsa, doğrudan yönlendirme yapılıyor mu?
- [ ] Router.push çağrılıyor mu?

## Olası Sorunlar ve Çözümler

### 1. Düşük Confidence Değeri
**Sorun**: AI analizi düşük güven skoruyla dönüyor (< 0.3)
**Çözüm**: 
- Daha spesifik kelimeler kullan
- Örnek: "Ellerimi sürekli yıkıyorum" (OCD)
- Örnek: "Her şey berbat olacak" (CBT)
- Örnek: "Bugün çok mutluyum" (MOOD)

### 2. Gemini API Çalışmıyor
**Sorun**: Gemini API key yok veya hatalı
**Çözüm**:
```bash
# .env.local dosyasına ekle:
EXPO_PUBLIC_GEMINI_API_KEY=your_api_key_here
```

### 3. Pattern Matching Başarısız
**Sorun**: Söylenen metin hiçbir pattern'e uymuyor
**Çözüm**: features/ai/services/checkinService.ts dosyasındaki pattern'leri genişlet

### 4. UI Render Sorunu
**Sorun**: Modal veya navigation çalışmıyor
**Çözüm**: React Native debugger'da hata var mı kontrol et

## Test Senaryoları

### OCD Testi
Şunları söyle:
- "Kapıyı kilitlemeyi unuttum mu acaba"
- "Ellerimi tekrar yıkamalıyım"
- "Her şey düzenli olmalı"

### CBT Testi
Şunları söyle:
- "Kesinlikle başarısız olacağım"
- "Herkes benden nefret ediyor"
- "Her zaman her şey kötü gidiyor"

### MOOD Testi
Şunları söyle:
- "Bugün kendimi çok iyi hissediyorum"
- "Çok yorgunum ve mutsuzum"
- "Normal bir gün, idare eder"

### Terapi Testi
Şunları söyle:
- "Terapi egzersizi yapmak istiyorum"
- "Maruz kalma çalışması yapacağım"
- "Kompulsiyonuma direnmeye çalışacağım"

## Geçici Çözümler

### Confidence Eşiğini Düşür (Test için)
```typescript
// services/autoRecordService.ts
const SHOW_THRESHOLD = 0.1; // Normalde 0.65
const CONFIDENCE_THRESHOLD = 0.1; // Normalde 0.7
```

### Her Zaman Modal Göster (Test için)
```typescript
// services/autoRecordService.ts
export function shouldShowAutoRecord() {
  return true; // Her zaman true dön
}
```

### Doğrudan Yönlendirme (Modal olmadan)
```typescript
// components/checkin/CheckinBottomSheet.tsx
// handleAnalysisResult fonksiyonunda modal kontrolünü atla
```

## Log Kayıtları Nasıl Okunur

1. **Metro Bundler Console**: JavaScript log'ları
2. **Expo Go App**: Shake gesture > Show Developer Menu > Debug Remote JS
3. **Chrome DevTools**: http://localhost:19001/debugger-ui
4. **React Native Debugger**: Standalone app

## Hata Bildirimi

Sorun devam ediyorsa şu bilgileri paylaş:
1. Söylediğin tam metin
2. Console log'ları (yukarıdaki tüm 🎯 🔄 📊 ile başlayanlar)
3. Hata mesajları (varsa)
4. Hangi platform (iOS/Android)
5. Expo versiyon (expo --version)
