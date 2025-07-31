# 🔧 Google Cloud Console Setup Rehberi

## 1. Google Cloud Console'a Git
https://console.cloud.google.com/

## 2. Yeni Proje Oluştur (veya mevcut proje seç)
- "New Project" tıkla
- Project name: "ObsessLess Mobile App"

## 3. APIs & Services → Credentials
- Sol menüden "APIs & Services" → "Credentials"

## 4. OAuth 2.0 Client IDs Oluştur

### 📱 iOS Client ID:
```
Application type: iOS
Name: ObsessLess iOS
Bundle ID: com.adilyoltay.obslesstest
```

### 🌐 Web Client ID:
```
Application type: Web application
Name: ObsessLess Web
Authorized JavaScript origins:
- http://localhost
- https://localhost
Authorized redirect URIs:
- http://localhost
- https://localhost
```

### 🤖 Android Client ID (gelecekte):
```
Application type: Android
Name: ObsessLess Android
Package name: com.adilyoltay.obslesstest
SHA-1: (Debug keystore SHA-1)
```

## 5. Client ID'leri Kopyala
iOS Client ID → .env dosyasına GOOGLE_IOS_CLIENT_ID
Web Client ID → .env dosyasına GOOGLE_WEB_CLIENT_ID

## 6. iOS URL Scheme Güncelle
app.json dosyasında:
```json
"iosUrlScheme": "com.googleusercontent.apps.YOUR_IOS_CLIENT_ID"
```
(YOUR_IOS_CLIENT_ID kısmını gerçek iOS Client ID ile değiştir)

## 7. OAuth Consent Screen (gerekirse)
- "OAuth consent screen" sekmesi
- External user type seç
- App name: ObsessLess
- User support email: adil.yoltay@gmail.com
- Developer contact: adil.yoltay@gmail.com

## 8. Test Environment
Test için birkaç email adresi ekle:
- adil.yoltay@gmail.com
- test@example.com
