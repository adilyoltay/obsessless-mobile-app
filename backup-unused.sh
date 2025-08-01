#!/bin/bash

# Yedekleme dizini oluştur
BACKUP_DIR="./backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Kullanılmayan bileşenleri yedekle
echo "📦 Kullanılmayan dosyalar yedekleniyor..."

# Demo/Test bileşenleri (sadece gerçekten kullanılmayanlar)
mkdir -p "$BACKUP_DIR/demo-components"
[ -f components/HelloWave.tsx ] && mv components/HelloWave.tsx "$BACKUP_DIR/demo-components/" 2>/dev/null
[ -f components/ExternalLink.tsx ] && mv components/ExternalLink.tsx "$BACKUP_DIR/demo-components/" 2>/dev/null

# Kullanılmayan UI bileşenleri
mkdir -p "$BACKUP_DIR/unused-ui"
[ -f components/ui/OAuthWebView.tsx ] && mv components/ui/OAuthWebView.tsx "$BACKUP_DIR/unused-ui/" 2>/dev/null

# Yedekleme bilgisi oluştur
cat > "$BACKUP_DIR/README.md" << 'EOREADME'
# Yedeklenen Dosyalar
Tarih: $(date)

## Demo/Test Bileşenleri
- HelloWave.tsx - Örnek animasyon bileşeni
- ExternalLink.tsx - Harici link bileşeni

## Kullanılmayan UI Bileşenleri
- OAuthWebView.tsx - OAuth web view bileşeni (kullanılmıyor)

Bu dosyalar gerektiğinde geri yüklenebilir.

## NOT: Aşağıdaki bileşenler kullanıldığı için KORUNDU:
- ParallaxScrollView.tsx - +not-found.tsx tarafından kullanılıyor
- ThemedText.tsx - Birçok bileşen tarafından kullanılıyor
- ThemedView.tsx - Birçok bileşen tarafından kullanılıyor
- Collapsible.tsx - ErrorBoundary tarafından referans ediliyor
- IconSymbol.tsx - Tab layout tarafından kullanılıyor
- TabBarBackground.tsx - Tab layout tarafından kullanılıyor
- Stepper.tsx - Onboarding'de özel implementasyon var
EOREADME

echo "✅ Yedekleme tamamlandı: $BACKUP_DIR" 