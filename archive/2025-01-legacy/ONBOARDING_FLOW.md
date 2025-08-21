# 🧭 Onboarding Akışı (Güncel)

Giriş rotası: `/(auth)/onboarding` (Eski `/(auth)/ai-onboarding` kaldırıldı)

```mermaid
flowchart TD
    A[Uygulama Açılışı] --> B{Authenticated?}
    B -- Hayır --> L[Login/Signup]
    B -- Evet --> C{Onboarding Completed?}
    L --> C
    C -- Hayır --> D[Onboarding]
    C -- Evet --> T[Today (/(tabs))]

    subgraph D [Onboarding V3]
      D1[Karşılama + Hızlı Başlangıç Seçimi]
      D2[Gizlilik Onayı]
      D3[Y‑BOCS Kısa Değerlendirme]
      D4{Hızlı Başlangıç mı?}
      D5[Profil Adımları (İsteğe Bağlı: İsim, Demografi, Geçmiş, Belirtiler, Kültür, Hedefler)]
      D6[Tedavi Planı Önizleme]
      D7[Güvenlik Planı Bilgilendirme]
      D8[Tamamla → /(tabs)]
    end

    D1 --> D2 --> D3 --> D4
    D4 -- Evet --> D6
    D4 -- Hayır --> D5 --> D6 --> D7 --> D8
```

Notlar
- “Atla” → her zaman `/(tabs)` sayfasına yönlendirilir.
- Y‑BOCS yanıtları `Record<questionId, score>` olarak tutulur; geri gidince değerler saklanır.
- Hızlı başlangıç modunda profil adımları Ayarlar’dan daha sonra tamamlanabilir.
