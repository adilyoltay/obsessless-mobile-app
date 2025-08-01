#!/bin/bash

# Safe Point Creation Script
# 
# Bu script, AI geliştirmeleri öncesinde güvenli bir nokta oluşturur
# Git tag, backup ve state dokümantasyonu yapar

echo "🛡️  Creating Safe Point..."

# Timestamp oluştur
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
TAG_NAME="safe-point-$TIMESTAMP"
BACKUP_DIR="backups"

# Backup dizinini oluştur
mkdir -p "$BACKUP_DIR"

# 1. Git durumunu kontrol et
echo "📊 Checking git status..."
if [[ -n $(git status -s) ]]; then
  echo "❌ Error: You have uncommitted changes!"
  echo "Please commit or stash your changes before creating a safe point."
  exit 1
fi

# 2. Git tag oluştur
echo "🏷️  Creating git tag: $TAG_NAME"
git tag -a "$TAG_NAME" -m "Safe point before AI development - $TIMESTAMP"
git push origin "$TAG_NAME"

# 3. Backup oluştur
BACKUP_FILE="$BACKUP_DIR/backup-$TIMESTAMP.tar.gz"
echo "📦 Creating backup: $BACKUP_FILE"

tar -czf "$BACKUP_FILE" \
  --exclude=node_modules \
  --exclude=.expo \
  --exclude=ios/build \
  --exclude=ios/Pods \
  --exclude=android/build \
  --exclude=android/.gradle \
  --exclude=backups \
  --exclude=.git \
  .

# 4. State dokümantasyonu oluştur
STATE_FILE="$BACKUP_DIR/state-$TIMESTAMP.md"
echo "📝 Documenting current state..."

cat > "$STATE_FILE" << EOF
# Safe Point State - $TIMESTAMP

## Git Information
- Tag: $TAG_NAME
- Branch: $(git branch --show-current)
- Last Commit: $(git log -1 --oneline)

## Environment
- Node Version: $(node --version)
- NPM Version: $(npm --version)
- Expo Version: $(npx expo --version 2>/dev/null || echo "Not available")

## Project State
- Total Files: $(find . -type f -name "*.ts" -o -name "*.tsx" | grep -v node_modules | wc -l)
- TypeScript Files: $(find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | wc -l)
- Components: $(find components -name "*.tsx" 2>/dev/null | wc -l)

## Metro/Watchman State
- Metro Cache: $(du -sh node_modules/.cache 2>/dev/null || echo "Not found")
- Expo Cache: $(du -sh .expo 2>/dev/null || echo "Not found")

## Restoration Instructions
To restore to this safe point:

\`\`\`bash
# 1. Checkout the tag
git checkout $TAG_NAME

# 2. Clean caches
rm -rf node_modules/.cache .expo
watchman watch-del-all

# 3. Reinstall dependencies
rm -rf node_modules
npm install

# 4. For iOS
cd ios && pod install && cd ..

# 5. Start Metro
npx expo start -c
\`\`\`

## Notes
- Created before AI feature development
- All tests passing
- No import errors
- Stable build
EOF

# 5. Özet
echo ""
echo "✅ Safe Point Created Successfully!"
echo ""
echo "📍 Git Tag: $TAG_NAME"
echo "📦 Backup: $BACKUP_FILE"
echo "📝 State Doc: $STATE_FILE"
echo ""
echo "🔄 To restore to this point later:"
echo "   git checkout $TAG_NAME"
echo ""
echo "🚀 You can now safely proceed with AI development!" 