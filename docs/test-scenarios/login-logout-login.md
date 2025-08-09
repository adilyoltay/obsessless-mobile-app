# Login → Logout → Login Flow

## Purpose
Uygulamada ardışık giriş ve çıkış işlemlerinde onboarding durumunun düzgün sıfırlandığını doğrular.

## Adımlar
1. Uygulamayı aç ve giriş ekranına git.
2. Geçerli kullanıcı bilgileriyle **giriş yap**.
3. Onboarding sürecinden birkaç adım ilerle ve state'in değiştiğini doğrula.
4. Profil/ayarlar menüsünden **çıkış yap**.
5. `useOnboardingStore` durumunun başlangıç değerlerine döndüğünü doğrula.
6. Aynı kullanıcı bilgileriyle tekrar **giriş yap**.
7. Onboarding'in en baştan başladığını ve önceki adımların kaydedilmediğini doğrula.

## Beklenen Sonuç
- Çıkış sonrası onboarding state'i tamamen sıfırlanmalıdır.
- Yeniden girişte onboarding kullanıcıya sıfırdan sunulmalıdır.
