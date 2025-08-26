# Release & PR

Branching:
- feature: `feat/...`
- chore/fix/docs: `chore/...` / `fix/...` / `docs/...`

PR Checklist:
- Type/lint/test/build yeşil
- Migrations belgelenmiş (ADD COLUMN/RLS)
- QA notları ve smoke sonuçları
- Rollback: Migration güvenli (ADD COLUMN), env değişmeden geri dönülebilir

Migrations:
- supabase/migrations dizininde tarihli dosyalar
