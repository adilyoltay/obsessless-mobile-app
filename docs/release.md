# Release Management & Deployment

ObsessLess uygulaması için kapsamlı release ve deployment süreçleri.

## Branch Strategy

### Branch Naming Convention
```
feat/<feature-description>     # Yeni özellikler
fix/<bug-description>         # Bug düzeltmeleri
hotfix/<critical-fix>         # Kritik düzeltmeler
chore/<maintenance-task>      # Bakım işleri
docs/<documentation-update>   # Dokümantasyon güncellemeleri
refactor/<refactoring-task>   # Kod iyileştirmeleri
```

### Branch Workflow
```
main                          # Production ready code
├── develop                   # Integration branch (opsiyonel)
├── feat/onboarding-v2        # Feature branches
├── fix/sync-uuid-validation  # Bug fix branches
└── hotfix/critical-crash     # Emergency fixes
```

## Pull Request Process

### PR Template
```markdown
## Değişiklik Özeti
<!-- Yapılan değişikliklerin kısa açıklaması -->

## Değişiklik Türü
- [ ] 🚀 Yeni özellik (feat)
- [ ] 🐛 Bug düzeltmesi (fix)
- [ ] 📚 Dokümantasyon (docs)
- [ ] 🧹 Bakım/Refactor (chore)
- [ ] 🚨 Kritik düzeltme (hotfix)

## Test Edildi
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Smoke tests pass
- [ ] Manual testing completed

## Migration Değişiklikleri
- [ ] Yeni migration dosyası eklendi
- [ ] Migration backwards compatible
- [ ] RLS policies güncellendi
- [ ] Rollback planı hazır

## Checklist
- [ ] TypeScript hataları yok (`yarn typecheck`)
- [ ] Lint uyarıları yok (`yarn lint --max-warnings=0`)
- [ ] Tests geçiyor (`yarn test`)
- [ ] Build başarılı (`yarn build`)
- [ ] Dokümantasyon güncellendi
```

### PR Review Criteria

#### Code Quality
- [ ] **TypeScript Strict**: Tip güvenliği sağlandı
- [ ] **ESLint Rules**: Kod standartlarına uygun
- [ ] **Performance**: Gereksiz re-render, memory leak yok
- [ ] **Security**: PII sanitization, RLS policies doğru
- [ ] **Accessibility**: ARIA labels, accessibility props

#### Architecture Compliance
- [ ] **Unified AI Pipeline**: Tüm AI çağrıları `unifiedPipeline.process()` üzerinden
- [ ] **Offline-First**: Kritik operasyonlar queue'ya alınıyor
- [ ] **Privacy-First**: Hassas data şifreleniyor
- [ ] **Turkish Language**: User-facing metinler Türkçe

#### Testing Requirements
- [ ] **Unit Tests**: Yeni kod için unit test yazıldı
- [ ] **Integration Tests**: Cross-component interaction test edildi
- [ ] **Smoke Tests**: Critical path test edildi
- [ ] **Telemetry**: Events doğru şekilde track ediliyor

## Database Migration Management

### Migration File Naming
```
supabase/migrations/YYYY-MM-DD_HH-mm-ss_description.sql
```

### Safe Migration Patterns
```sql
-- ✅ Safe: ADD COLUMN (backwards compatible)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS new_field TEXT;

-- ✅ Safe: CREATE INDEX
CREATE INDEX CONCURRENTLY IF NOT EXISTS 
idx_user_profiles_new_field ON user_profiles(new_field);

-- ✅ Safe: ADD CONSTRAINT (after data validation)
ALTER TABLE user_profiles 
ADD CONSTRAINT check_new_field 
CHECK (new_field IN ('option1', 'option2'));

-- ❌ Risky: DROP COLUMN (data loss)
-- Only in separate migration with careful planning
ALTER TABLE user_profiles DROP COLUMN IF EXISTS old_field;
```

### Migration Checklist
- [ ] **Backwards Compatibility**: Eski kod versiyon ile çalışıyor
- [ ] **Data Validation**: Constraint eklemeden önce data temizlendi
- [ ] **Performance Impact**: Heavy operations `CONCURRENTLY` kullanıyor
- [ ] **RLS Policies**: Yeni tablolar için RLS aktif ve policies set
- [ ] **Rollback Plan**: Migration geri alınabilir
- [ ] **Documentation**: Migration amacı ve etkisi dokümante edildi

### Current Migration Files
```
supabase/migrations/
├── 20250120_create_mood_entries_table.sql
├── 2025-08-10_add_ai_tables.sql
├── 2025-08-27_add_onboarding_profile_v2.sql
├── 2025-01-21_create_cbt_thought_records_table.sql
└── 2025-01-04_create_missing_tables.sql
```

## Deployment Pipeline

### Staging Deployment
```bash
# Environment setup
export NODE_ENV=staging
export EXPO_PUBLIC_SUPABASE_URL=$STAGING_SUPABASE_URL

# Build and deploy to staging
eas build --profile staging --platform all
eas submit --profile staging --platform ios
eas submit --profile staging --platform android
```

### Production Deployment
```bash
# Pre-deployment checks
yarn typecheck
yarn lint --max-warnings=0
yarn test:ci
yarn build

# Migration deployment (if any)
npx supabase db push --remote

# Production build
eas build --profile production --platform all

# Store submission
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

### Deployment Checklist
- [ ] **Code Quality**: All static checks pass
- [ ] **Tests**: Full test suite passes
- [ ] **Database**: Migrations applied successfully
- [ ] **Environment**: Production configs verified
- [ ] **Builds**: iOS and Android builds successful
- [ ] **Smoke Test**: Critical paths tested in staging
- [ ] **Rollback Plan**: Previous version deployable
- [ ] **Monitoring**: Error tracking and performance monitoring active

## Rollback Strategy

### Code Rollback
```bash
# Revert to previous Git commit
git revert <commit-hash>

# Emergency rollback with force push (use carefully)
git reset --hard <previous-commit>
git push --force-with-lease
```

### Database Rollback
```sql
-- Safe column rollback (data preserved)
ALTER TABLE user_profiles DROP COLUMN IF EXISTS new_column;

-- Constraint rollback
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS check_new_constraint;

-- Index rollback
DROP INDEX CONCURRENTLY IF EXISTS idx_new_index;
```

### Migration Rollback Examples
```sql
-- Rollback: Add Column Migration
-- Original: ALTER TABLE user_profiles ADD COLUMN feature_flags JSONB;
-- Rollback:
ALTER TABLE user_profiles DROP COLUMN IF EXISTS feature_flags;

-- Rollback: Enum Constraint Migration  
-- Original: ALTER TABLE user_profiles ADD CONSTRAINT check_gender...
-- Rollback:
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS check_gender;

-- Rollback: New Table Migration
-- Original: CREATE TABLE new_feature_table...
-- Rollback:
DROP TABLE IF EXISTS new_feature_table CASCADE;
```

### App Store Rollback
```bash
# iOS App Store: Manual rollback through App Store Connect
# - Navigate to App Store Connect
# - Select previous version
# - Submit for review

# Android Play Store: Staged rollout control
# - Access Play Console
# - Reduce rollout percentage to 0%
# - Or release previous version
```

## Version Management

### Semantic Versioning
```
MAJOR.MINOR.PATCH
1.2.3

MAJOR: Breaking changes (API changes, removed features)
MINOR: New features (backwards compatible)
PATCH: Bug fixes (backwards compatible)
```

### Version Update Process
```javascript
// app.config.js
export default {
  expo: {
    version: "1.2.3",        // Semantic version
    ios: {
      buildNumber: "123"     // Increment for each build
    },
    android: {
      versionCode: 123       // Increment for each build
    }
  }
};
```

### Release Notes Template
```markdown
# ObsessLess v1.2.3

## 🚀 Yeni Özellikler
- Onboarding v2 ile gelişmiş kullanıcı profili
- Unified AI Pipeline ile daha hızlı analiz

## 🐛 Düzeltmeler
- Offline sync UUID doğrulama sorunu
- iOS bildirim izinleri

## 🔧 Teknik İyileştirmeler
- Geliştirilmiş cache yönetimi
- Database performance optimizasyonları

## 📊 Telemetry & Analytics
- Yeni onboarding completion tracking
- AI pipeline performance metrics

## 🔒 Güvenlik
- Enhanced PII sanitization
- Improved RLS policies
```

## Release Types

### Regular Release (2 weeks)
- Planned features and improvements
- Full QA cycle
- Gradual rollout (10% → 50% → 100%)

### Hotfix Release (same day)
- Critical bugs or security issues
- Minimal changes only
- Fast-track approval process
- Immediate 100% rollout after basic validation

### Major Release (quarterly)
- Significant new features
- Breaking changes (if any)
- Extended QA period
- Marketing coordination
- User communication plan

## Quality Gates

### Development Gate
- [ ] Feature complete
- [ ] Code review approved
- [ ] Unit tests pass (80% coverage)
- [ ] Integration tests pass

### Staging Gate
- [ ] End-to-end testing complete
- [ ] Performance benchmarks met
- [ ] Security scan passed
- [ ] Migration tested

### Production Gate
- [ ] Staging validation complete
- [ ] Rollback plan tested
- [ ] Monitoring alerts configured
- [ ] Support team notified

## Monitoring & Alerting

### Key Metrics
- **Crash Rate**: < 0.1%
- **API Response Time**: < 500ms p95
- **App Launch Time**: < 3s
- **Sync Success Rate**: > 95%
- **AI Pipeline Success Rate**: > 90%

### Alert Thresholds
- **High Priority**: Crash rate > 0.5%, API errors > 5%
- **Medium Priority**: Sync failures > 10%, slow responses
- **Low Priority**: Performance degradation, cache misses

### Post-Release Monitoring
```bash
# First 24 hours: Active monitoring
- Crash reports review
- Error rate monitoring  
- User feedback collection
- Performance metrics analysis

# First week: Trend analysis
- Feature adoption rates
- User retention impact
- Performance trend analysis
- Support ticket patterns
```

## Emergency Procedures

### Critical Bug Response
1. **Assess Impact** (< 15 min)
2. **Hotfix Development** (< 2 hours)
3. **Emergency Testing** (< 30 min)
4. **Deploy Hotfix** (< 1 hour)
5. **Monitor & Validate** (ongoing)

### Rollback Triggers
- Crash rate > 1%
- Critical feature completely broken
- Data corruption detected
- Security vulnerability confirmed
- User complaints > threshold

## İlgili Bölümler

- [**Testing**](./testing.md) – Quality assurance processes
- [**Development**](./development.md) – Development environment setup
- [**Troubleshooting**](./troubleshooting.md) – Common deployment issues
- [**Data Model**](./data-model.md) – Database migration patterns
