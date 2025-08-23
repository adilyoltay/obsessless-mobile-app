-- ================================
-- DISABLE CBT TRIGGER WORKAROUND  
-- ================================
-- CBT kayıtları için auto_compute_content_hash trigger'ını devre dışı bırak
-- Problem: Trigger 'text' field'ı arıyor ama thought_records'da 'thought' var

-- 1. CBT tablosu için trigger'ı kapat
DROP TRIGGER IF EXISTS auto_compute_content_hash_trigger ON thought_records;

-- 2. Sadece voice_checkins için trigger'ı yeniden oluştur
CREATE TRIGGER auto_compute_content_hash_trigger
  BEFORE INSERT OR UPDATE ON voice_checkins
  FOR EACH ROW
  EXECUTE FUNCTION auto_compute_content_hash();

-- 3. ERP sessions için ayrı trigger (eğer var ise)
DROP TRIGGER IF EXISTS auto_compute_content_hash_trigger ON erp_sessions;
CREATE TRIGGER auto_compute_content_hash_trigger
  BEFORE INSERT OR UPDATE ON erp_sessions  
  FOR EACH ROW
  EXECUTE FUNCTION auto_compute_content_hash();

-- 4. Log açıklaması
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CBT TRIGGER WORKAROUND APPLIED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Disabled auto_compute_content_hash for thought_records';
  RAISE NOTICE 'CBT records will use manual content_hash from application';
  RAISE NOTICE 'This prevents "record new has no field text" error';
  RAISE NOTICE '========================================';
END $$;
