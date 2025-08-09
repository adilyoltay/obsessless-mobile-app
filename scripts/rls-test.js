#!/usr/bin/env node

/**
 * 🔐 RLS Test Script
 *
 * Farklı kullanıcı token'ları ile `ai_profiles` ve `ai_treatment_plans`
 * tablolarındaki Row Level Security kurallarını test eder.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Supabase URL veya anon key eksik');
  process.exit(1);
}

const TOKENS = [
  process.env.SUPABASE_USER_TOKEN_1,
  process.env.SUPABASE_USER_TOKEN_2,
].filter(Boolean);

if (TOKENS.length < 2) {
  console.error('❌ Test için SUPABASE_USER_TOKEN_1 ve SUPABASE_USER_TOKEN_2 gerekli');
  process.exit(1);
}

function decodeUserId(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.sub;
  } catch (err) {
    console.error('Token decode edilemedi:', err.message);
    return null;
  }
}

async function testTableAccess(client, table, userId) {
  const { data, error } = await client.from(table).select('id, user_id');
  if (error) {
    console.error(`❌ ${table} sorgusu hata verdi:`, error.message);
    return false;
  }

  const foreignRows = data.filter((r) => r.user_id !== userId);
  if (foreignRows.length > 0) {
    console.log(`❌ ${table}: Başka kullanıcıya ait ${foreignRows.length} kayıt erişilebilir`);
    return false;
  }

  console.log(`✅ ${table}: Sadece kendi kayıtlarına erişildi (${data.length})`);
  return true;
}

(async () => {
  const [tokenA, tokenB] = TOKENS;
  const userA = decodeUserId(tokenA);
  const userB = decodeUserId(tokenB);

  const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${tokenA}` } },
    auth: { persistSession: false },
  });
  const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${tokenB}` } },
    auth: { persistSession: false },
  });

  console.log('\n🧪 Kullanıcı bazlı erişim testleri');
  await testTableAccess(clientA, 'ai_profiles', userA);
  await testTableAccess(clientA, 'ai_treatment_plans', userA);
  await testTableAccess(clientB, 'ai_profiles', userB);
  await testTableAccess(clientB, 'ai_treatment_plans', userB);

  console.log('\n🔀 Çapraz erişim testleri');
  const { data: crossData, error: crossError } = await clientB
    .from('ai_profiles')
    .select('id')
    .eq('user_id', userA);

  if (crossError) {
    console.log('✅ Çapraz erişim engellendi:', crossError.message);
  } else if (crossData.length === 0) {
    console.log('✅ Çapraz erişim sonucu 0 kayıt döndü');
  } else {
    console.log(`❌ Çapraz erişimde ${crossData.length} kayıt döndü`);
  }
})();

