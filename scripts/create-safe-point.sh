#!/bin/bash

# Safe Point Creation System
# 
# KRITIK: AI feature development öncesi güvenli backup noktaları oluşturur
# Git tag + full backup + Metro/Watchman state backup

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./backups"
SAFE_POINT_PREFIX="safe-point"
DATE_FORMAT=$(date +%Y%m%d-%H%M%S)

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        error "Bu dizin bir git repository değil!"
    fi
}

# Check if there are uncommitted changes
check_clean_working_tree() {
    if ! git diff-index --quiet HEAD --; then
        warn "Uncommitted changes bulundu!"
        echo ""
        git status --porcelain
        echo ""
        read -p "Devam etmek istiyor musunuz? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "İşlem iptal edildi. Önce değişiklikleri commit edin."
        fi
    fi
}
# Stash current changes (optional but recommended)
stash_changes() {
    if ! git diff-index --quiet HEAD --; then
        info "Geçici olarak değişiklikler stash'e alınıyor..."
        # Tüm izlenmeyen dosyalar dahil
        git stash push -u -m "$SAFE_POINT_PREFIX-$DATE_FORMAT" || warn "git stash sırasında uyarı oluştu"
    fi
}

# Create backup directory
create_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    log "Backup dizini oluşturuldu: $BACKUP_DIR"
}

# Get current project state
get_project_state() {
    local state_file="$BACKUP_DIR/project-state-$DATE_FORMAT.json"
    
    log "Proje durumu analiz ediliyor..."
    
    cat > "$state_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "git": {
    "branch": "$(git branch --show-current)",
    "commit": "$(git rev-parse HEAD)",
    "commit_message": "$(git log -1 --pretty=%B | tr '\n' ' ' | sed 's/"/\\"/g')",
    "tag_count": $(git tag | wc -l),
    "uncommitted_files": $(git status --porcelain | wc -l)
  },
  "npm": {
    "version": "$(npm --version 2>/dev/null || echo 'not_found')",
    "node_version": "$(node --version 2>/dev/null || echo 'not_found')"
  },
  "expo": {
    "cli_version": "$(npx expo --version 2>/dev/null || echo 'not_found')",
    "sdk_version": "$(grep '"expo"' package.json | cut -d'"' -f4 2>/dev/null || echo 'not_found')"
  },
  "metro": {
    "cache_exists": $([ -d "node_modules/.cache" ] && echo "true" || echo "false"),
    "expo_cache_exists": $([ -d ".expo" ] && echo "true" || echo "false")
  },
  "watchman": {
    "running": $(pgrep watchman > /dev/null && echo "true" || echo "false"),
    "watches": $(watchman watch-list 2>/dev/null | jq '.roots | length' 2>/dev/null || echo "0")
  },
  "directories": {
    "app_exists": $([ -d "app" ] && echo "true" || echo "false"),
    "components_exists": $([ -d "components" ] && echo "true" || echo "false"),
    "features_exists": $([ -d "features" ] && echo "true" || echo "false"),
    "src_exists": $([ -d "src" ] && echo "true" || echo "false")
  }
}
EOF
    
    echo "$state_file"
}

# Backup critical files
backup_critical_files() {
    local backup_subdir="$BACKUP_DIR/files-$DATE_FORMAT"
    mkdir -p "$backup_subdir"
    
    log "Kritik dosyalar yedekleniyor..."
    
    # Package files
    cp package.json "$backup_subdir/" 2>/dev/null || warn "package.json kopyalanamadı"
    cp package-lock.json "$backup_subdir/" 2>/dev/null || warn "package-lock.json kopyalanamadı"
    
    # Config files
    cp app.json "$backup_subdir/" 2>/dev/null || warn "app.json kopyalanamadı"
    cp tsconfig.json "$backup_subdir/" 2>/dev/null || warn "tsconfig.json kopyalanamadı"
    cp babel.config.js "$backup_subdir/" 2>/dev/null || warn "babel.config.js kopyalanamadı"
    cp metro.config.js "$backup_subdir/" 2>/dev/null || warn "metro.config.js kopyalanamadı"
    
    # Environment files (if they exist)
    cp .env "$backup_subdir/" 2>/dev/null || true
    cp .env.local "$backup_subdir/" 2>/dev/null || true
    
    # Feature flags
    cp constants/featureFlags.ts "$backup_subdir/" 2>/dev/null || warn "featureFlags.ts kopyalanamadı"
    
    # Git ignore and other important configs
    cp .gitignore "$backup_subdir/" 2>/dev/null || true
    cp .watchmanconfig "$backup_subdir/" 2>/dev/null || true
    
    echo "$backup_subdir"
}

# Create git tag
create_git_tag() {
    local tag_name="$1"
    local description="$2"
    
    log "Git tag oluşturuluyor: $tag_name"
    
    git tag -a "$tag_name" -m "$description"
    
    info "Tag oluşturuldu: $tag_name"
    info "Tag mesajı: $description"
}

# Save Metro and Watchman state
save_metro_watchman_state() {
    local state_file="$BACKUP_DIR/metro-watchman-$DATE_FORMAT.log"
    
    log "Metro ve Watchman durumu kaydediliyor..."
    
    {
        echo "=== METRO CACHE STATE ==="
        echo "Date: $(date)"
        echo "Metro cache dir exists: $([ -d "node_modules/.cache" ] && echo "YES" || echo "NO")"
        echo "Expo cache dir exists: $([ -d ".expo" ] && echo "YES" || echo "NO")"
        
        if [ -d "node_modules/.cache" ]; then
            echo "Metro cache size: $(du -sh node_modules/.cache 2>/dev/null || echo 'unknown')"
            echo "Metro cache files: $(find node_modules/.cache -type f | wc -l 2>/dev/null || echo 'unknown')"
        fi
        
        echo ""
        echo "=== WATCHMAN STATE ==="
        echo "Watchman running: $(pgrep watchman > /dev/null && echo "YES" || echo "NO")"
        
        if pgrep watchman > /dev/null; then
            echo "Watchman version: $(watchman version 2>/dev/null | jq -r '.version' 2>/dev/null || echo 'unknown')"
            echo "Watchman watches:"
            watchman watch-list 2>/dev/null || echo "Failed to get watch list"
        fi
        
        echo ""
        echo "=== TEMPORARY DIRECTORIES ==="
        echo "TMPDIR: $TMPDIR"
        if [ -d "$TMPDIR" ]; then
            echo "Metro temp files: $(find $TMPDIR -name "metro-*" -type d 2>/dev/null | wc -l || echo '0')"
            echo "Haste temp files: $(find $TMPDIR -name "haste-*" -type d 2>/dev/null | wc -l || echo '0')"
        fi
        
    } > "$state_file"
    
    echo "$state_file"
}

# Create restoration script
create_restoration_script() {
    local tag_name="$1"
    local backup_files_dir="$2"
    local restoration_script="$BACKUP_DIR/restore-$DATE_FORMAT.sh"
    
    log "Restoration script oluşturuluyor..."
    
    cat > "$restoration_script" << EOF
#!/bin/bash

# Restoration Script for Safe Point: $tag_name
# Generated: $(date)
# 
# Bu script safe point'e geri dönmek için kullanılır

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "\${GREEN}[RESTORE] \$1\${NC}"
}

warn() {
    echo -e "\${YELLOW}[WARNING] \$1\${NC}"
}

error() {
    echo -e "\${RED}[ERROR] \$1\${NC}"
    exit 1
}

echo "🔄 Safe Point Restoration: $tag_name"
echo "Backup Date: $(date)"
echo ""

# Confirm restoration
read -p "Bu işlem mevcut değişiklikleri kaybedeceğiniz. Devam etmek istiyor musunuz? (y/N): " -n 1 -r
echo
if [[ ! \$REPLY =~ ^[Yy]\$ ]]; then
    echo "İşlem iptal edildi."
    exit 0
fi

log "Git checkout yapılıyor: $tag_name"
git checkout "$tag_name"

log "Metro cache temizleniyor..."
rm -rf node_modules/.cache
rm -rf .expo
rm -rf \$TMPDIR/metro-* 2>/dev/null || true
rm -rf \$TMPDIR/haste-* 2>/dev/null || true

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
echo "Original backup files: $backup_files_dir"
EOF

    chmod +x "$restoration_script"
    echo "$restoration_script"
}

# Generate safe point summary
generate_summary() {
    local tag_name="$1"
    local backup_files_dir="$2"
    local state_file="$3"
    local metro_watchman_file="$4"
    local restoration_script="$5"
    
    local summary_file="$BACKUP_DIR/summary-$DATE_FORMAT.md"
    
    cat > "$summary_file" << EOF
# Safe Point Summary

**Tag:** \`$tag_name\`  
**Created:** $(date)  
**Git Commit:** \`$(git rev-parse HEAD)\`  
**Branch:** \`$(git branch --show-current)\`  

## Backup Contents

- **Project State:** \`$state_file\`
- **Critical Files:** \`$backup_files_dir\`
- **Metro/Watchman State:** \`$metro_watchman_file\`
- **Restoration Script:** \`$restoration_script\`

## Restoration Instructions

1. Run the restoration script:
   \`\`\`bash
   $restoration_script
   \`\`\`

2. Or manually restore:
   \`\`\`bash
   git checkout $tag_name
   rm -rf node_modules/.cache .expo
   watchman watch-del-all && watchman shutdown-server
   npm install
   npx expo start -c
   \`\`\`

## Project State at Backup

$(cat "$state_file" | jq '.' 2>/dev/null || echo "State file could not be parsed")

---
*Generated by create-safe-point.sh*
EOF

    echo "$summary_file"
}

# Main function
main() {
    local description="${1:-"Safe point created automatically"}"
    local tag_name="$SAFE_POINT_PREFIX-$DATE_FORMAT"
    
    echo "🛡️  Safe Point Creation System"
    echo "=============================="
    echo ""
    
    # Pre-checks
    log "Ön kontroller yapılıyor..."
    check_git_repo
    check_clean_working_tree
    create_backup_dir
    
    # Get current state
    log "Proje durumu analiz ediliyor..."
    local state_file
    state_file=$(get_project_state)
    
    # Backup critical files
    local backup_files_dir
    backup_files_dir=$(backup_critical_files)
    
    # Save Metro/Watchman state
    local metro_watchman_file
    metro_watchman_file=$(save_metro_watchman_state)
    
    # Stash changes to ensure clean tag snapshot
    stash_changes

    # Create git tag
    create_git_tag "$tag_name" "$description"
    
    # Create restoration script
    local restoration_script
    restoration_script=$(create_restoration_script "$tag_name" "$backup_files_dir")
    
    # Generate summary
    local summary_file
    summary_file=$(generate_summary "$tag_name" "$backup_files_dir" "$state_file" "$metro_watchman_file" "$restoration_script")
    
    # Success message
    echo ""
    log "✅ Safe point başarıyla oluşturuldu!"
    echo ""
    info "Tag: $tag_name"
    info "Backup Directory: $BACKUP_DIR"
    info "Summary: $summary_file"
    info "Restoration Script: $restoration_script"
    echo ""
    echo "🔄 Geri dönmek için:"
    echo "   $restoration_script"
    echo ""
    echo "📋 Safe point listesi:"
    git tag -l "$SAFE_POINT_PREFIX-*" | tail -5
    echo ""
}

# Script'in doğrudan çalıştırılıp çalıştırılmadığını kontrol et
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 