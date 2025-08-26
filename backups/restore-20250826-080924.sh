#!/bin/bash

# Restoration Script for Safe Point: safe-point-20250826-080924
# Generated: Tue Aug 26 08:10:06 +03 2025
# 
# Bu script safe point'e geri dönmek için kullanılır

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[RESTORE] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

echo "🔄 Safe Point Restoration: safe-point-20250826-080924"
echo "Backup Date: Tue Aug 26 08:10:06 +03 2025"
echo ""

# Confirm restoration
read -p "Bu işlem mevcut değişiklikleri kaybedeceğiniz. Devam etmek istiyor musunuz? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "İşlem iptal edildi."
    exit 0
fi

log "Git checkout yapılıyor: safe-point-20250826-080924"
git checkout "safe-point-20250826-080924"

log "Metro cache temizleniyor..."
rm -rf node_modules/.cache
rm -rf .expo
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/haste-* 2>/dev/null || true

log "Watchman sıfırlanıyor..."
watchman watch-del-all 2>/dev/null || warn "Watchman komutu çalışmadı"
watchman shutdown-server 2>/dev/null || warn "Watchman shutdown çalışmadı"

log "Node modules yeniden yükleniyor..."
rm -rf node_modules
npm install

# iOS pods if directory exists
if [ -d "ios" ]; then
    log "iOS pods güncelleniyor..."
    cd ios && pod install && cd ..
fi

log "✅ Restoration tamamlandı!"
echo ""
echo "Sonraki adımlar:"
echo "1. npx expo start -c ile Metro'yu temiz başlatın"
echo "2. Uygulamanızı test edin"
echo "3. Gerekirse yeni safe point oluşturun"
echo ""
echo "Original backup files: [0;32m[2025-08-26 08:10:05] Kritik dosyalar yedekleniyor...[0m
./backups/files-20250826-080924"
