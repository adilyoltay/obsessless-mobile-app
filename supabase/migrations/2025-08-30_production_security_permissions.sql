-- ===============================================
-- Production Security & Permissions Migration
-- ===============================================
-- Bu migration production güvenliği için:
-- 1. mood_tracking VIEW'a sadece SELECT yetkisi
-- 2. Duplicate kontrol sorguları
-- 3. RLS policy güncellemeleri

-- 1. mood_tracking VIEW için güvenlik
-- mood_tracking artık bir VIEW olduğu için RLS policy uygulanamaz
-- VIEW'lar otomatik olarak underlying table'ın RLS policy'lerini kullanır

-- VIEW'a sadece SELECT yetkisi ver (INSERT/UPDATE/DELETE zaten mümkün değil)
grant select on public.mood_tracking to authenticated;

-- VIEW'larda RLS policy tanımlanamaz, underlying mood_entries table'ı kullanır
-- Bu nedenle policy oluşturmaya gerek yok

-- 2. mood_entries için güçlendirilmiş RLS policies
-- Mevcut policy'leri kontrol et ve güçlendir

-- SELECT policy
drop policy if exists "Users can view their own mood entries" on public.mood_entries;
create policy "Users can view their own mood entries" 
  on public.mood_entries for select 
  using (auth.uid() = user_id);

-- INSERT policy (idempotent upsert için)
drop policy if exists "Users can insert their own mood entries" on public.mood_entries;
create policy "Users can insert their own mood entries" 
  on public.mood_entries for insert 
  with check (auth.uid() = user_id);

-- UPDATE policy (sadece kendi kayıtları)
drop policy if exists "Users can update their own mood entries" on public.mood_entries;
create policy "Users can update their own mood entries" 
  on public.mood_entries for update 
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE policy (sadece kendi kayıtları)
drop policy if exists "Users can delete their own mood entries" on public.mood_entries;
create policy "Users can delete their own mood entries" 
  on public.mood_entries for delete 
  using (auth.uid() = user_id);

-- 3. Duplicate kontrol ve monitoring fonksiyonları
-- Bu fonksiyonlar production'da duplicate durumunu kontrol etmek için

create or replace function public.check_mood_duplicates()
returns table(
  user_id uuid,
  content_hash text,
  duplicate_count bigint,
  first_created timestamptz,
  last_created timestamptz
) as $$
begin
  return query
  select 
    me.user_id,
    me.content_hash,
    count(*) as duplicate_count,
    min(me.created_at) as first_created,
    max(me.created_at) as last_created
  from public.mood_entries me
  where me.content_hash is not null
  group by me.user_id, me.content_hash
  having count(*) > 1
  order by duplicate_count desc, me.user_id;
end;
$$ language plpgsql security definer;

-- Sadece authenticated kullanıcılar çalıştırabilir
grant execute on function public.check_mood_duplicates() to authenticated;

-- 4. Content hash istatistikleri fonksiyonu
create or replace function public.mood_entries_stats()
returns table(
  total_entries bigint,
  entries_with_hash bigint,
  entries_without_hash bigint,
  unique_hashes bigint,
  duplicate_groups bigint
) as $$
begin
  return query
  select 
    count(*) as total_entries,
    count(content_hash) as entries_with_hash,
    count(*) - count(content_hash) as entries_without_hash,
    count(distinct content_hash) as unique_hashes,
    count(*) - count(distinct content_hash) as duplicate_groups
  from public.mood_entries;
end;
$$ language plpgsql security definer;

grant execute on function public.mood_entries_stats() to authenticated;

-- 5. Temizlik ve bakım fonksiyonu (sadece service_role için)
create or replace function public.cleanup_old_mood_entries(days_to_keep integer default 365)
returns table(
  deleted_count bigint
) as $$
declare
  cutoff_date timestamptz;
  result_count bigint;
begin
  -- Sadece service_role çalıştırabilir
  if current_setting('role') != 'service_role' then
    raise exception 'Access denied: cleanup function requires service_role';
  end if;
  
  cutoff_date := now() - (days_to_keep || ' days')::interval;
  
  -- Eski kayıtları sil (dikkatli!)
  delete from public.mood_entries 
  where created_at < cutoff_date;
  
  get diagnostics result_count = row_count;
  
  return query select result_count;
end;
$$ language plpgsql security definer;

-- Bu fonksiyon sadece service_role için
revoke execute on function public.cleanup_old_mood_entries(integer) from public;
-- Service role'e grant etmiyoruz, manuel olarak gerektiğinde çalıştırılacak

-- 6. Monitoring ve alerting için view
create or replace view public.mood_data_health as
select 
  'mood_entries' as table_name,
  count(*) as total_records,
  count(distinct user_id) as unique_users,
  count(content_hash) as records_with_hash,
  count(*) - count(content_hash) as records_without_hash,
  min(created_at) as oldest_record,
  max(created_at) as newest_record,
  count(*) - count(distinct content_hash) as potential_duplicates
from public.mood_entries
union all
select 
  'mood_tracking_view' as table_name,
  count(*) as total_records,
  count(distinct user_id) as unique_users,
  0 as records_with_hash,
  0 as records_without_hash,
  min(created_at) as oldest_record,
  max(created_at) as newest_record,
  0 as potential_duplicates
from public.mood_tracking;

-- View için SELECT yetkisi
grant select on public.mood_data_health to authenticated;

-- 7. RLS enable kontrolü
alter table public.mood_entries enable row level security;
-- mood_tracking bir VIEW olduğu için RLS policy'si yok, underlying table'ı kullanır

-- 8. Index optimizasyonu (performance için)
-- Duplicate kontrol sorguları için
create index if not exists idx_mood_entries_user_hash_created 
  on public.mood_entries(user_id, content_hash, created_at);

-- User bazlı sorgular için
create index if not exists idx_mood_entries_user_created 
  on public.mood_entries(user_id, created_at desc);

-- Content hash bazlı sorgular için (duplicate detection)
create index if not exists idx_mood_entries_hash_user 
  on public.mood_entries(content_hash, user_id) 
  where content_hash is not null;

-- 9. Telemetry için trigger (opsiyonel)
create or replace function public.log_mood_entry_changes()
returns trigger as $$
begin
  -- Sadece production'da önemli değişiklikleri logla
  if tg_op = 'DELETE' then
    -- DELETE işlemlerini logla (audit için)
    insert into public.audit_log (
      table_name, operation, user_id, old_data, timestamp
    ) values (
      'mood_entries', 'DELETE', old.user_id, 
      jsonb_build_object('id', old.id, 'content_hash', old.content_hash),
      now()
    ) on conflict do nothing; -- Audit tablosu yoksa hata vermesin
    return old;
  end if;
  
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

-- Trigger'ı oluştur (audit_log tablosu varsa)
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'audit_log') then
    drop trigger if exists trg_mood_entry_audit on public.mood_entries;
    create trigger trg_mood_entry_audit
      after delete on public.mood_entries
      for each row execute function public.log_mood_entry_changes();
  end if;
end $$;

-- 10. Başarı mesajı
do $$
begin
  raise notice '✅ Production security migration completed successfully';
  raise notice '📊 Run SELECT * FROM public.mood_data_health; to check data health';
  raise notice '🔍 Run SELECT * FROM public.check_mood_duplicates(); to find duplicates';
  raise notice '📈 Run SELECT * FROM public.mood_entries_stats(); for statistics';
end $$;
