#!/usr/bin/env node

/**
 * 🏥 Production Health Check Script
 * Supabase production ortamında veri sağlığını kontrol eder
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Service role key gerekli

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Required: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * 🔍 Check for duplicate mood entries
 */
async function checkDuplicates() {
  console.log('🔍 Checking for duplicate mood entries...');
  
  try {
    const { data, error } = await supabase.rpc('check_mood_duplicates');
    
    if (error) {
      console.error('❌ Error checking duplicates:', error);
      return { success: false, duplicates: 0 };
    }

    if (!data || data.length === 0) {
      console.log('✅ No duplicates found');
      return { success: true, duplicates: 0 };
    }

    console.log(`⚠️ Found ${data.length} duplicate groups:`);
    data.slice(0, 10).forEach(dup => {
      console.log(`  User: ${dup.user_id}, Hash: ${dup.content_hash}, Count: ${dup.duplicate_count}`);
    });

    if (data.length > 10) {
      console.log(`  ... and ${data.length - 10} more`);
    }

    return { success: true, duplicates: data.length, data };
  } catch (error) {
    console.error('❌ Exception checking duplicates:', error);
    return { success: false, duplicates: 0 };
  }
}

/**
 * 📊 Get mood entries statistics
 */
async function getMoodStats() {
  console.log('📊 Getting mood entries statistics...');
  
  try {
    const { data, error } = await supabase.rpc('mood_entries_stats');
    
    if (error) {
      console.error('❌ Error getting stats:', error);
      return { success: false };
    }

    if (!data || data.length === 0) {
      console.log('⚠️ No statistics data returned');
      return { success: false };
    }

    const stats = data[0];
    console.log('📈 Mood Entries Statistics:');
    console.log(`  Total entries: ${stats.total_entries}`);
    console.log(`  Entries with hash: ${stats.entries_with_hash}`);
    console.log(`  Entries without hash: ${stats.entries_without_hash}`);
    console.log(`  Unique hashes: ${stats.unique_hashes}`);
    console.log(`  Duplicate groups: ${stats.duplicate_groups}`);

    const hashCoverage = stats.total_entries > 0 
      ? ((stats.entries_with_hash / stats.total_entries) * 100).toFixed(1)
      : '0';
    console.log(`  Hash coverage: ${hashCoverage}%`);

    return { success: true, stats };
  } catch (error) {
    console.error('❌ Exception getting stats:', error);
    return { success: false };
  }
}

/**
 * 🏥 Get overall data health
 */
async function getDataHealth() {
  console.log('🏥 Checking overall data health...');
  
  try {
    const { data, error } = await supabase
      .from('mood_data_health')
      .select('*');
    
    if (error) {
      console.error('❌ Error getting data health:', error);
      return { success: false };
    }

    console.log('🏥 Data Health Summary:');
    data.forEach(row => {
      console.log(`\n📋 ${row.table_name}:`);
      console.log(`  Total records: ${row.total_records}`);
      console.log(`  Unique users: ${row.unique_users}`);
      console.log(`  Records with hash: ${row.records_with_hash}`);
      console.log(`  Records without hash: ${row.records_without_hash}`);
      console.log(`  Oldest record: ${row.oldest_record}`);
      console.log(`  Newest record: ${row.newest_record}`);
      console.log(`  Potential duplicates: ${row.potential_duplicates}`);
    });

    return { success: true, health: data };
  } catch (error) {
    console.error('❌ Exception getting data health:', error);
    return { success: false };
  }
}

/**
 * 🔐 Check RLS policies
 */
async function checkRLSPolicies() {
  console.log('🔐 Checking RLS policies...');
  
  try {
    // Check if RLS is enabled (only for tables, not views)
    const { data: rlsData, error: rlsError } = await supabase
      .from('pg_class')
      .select('relname, relrowsecurity, relkind')
      .in('relname', ['mood_entries', 'mood_tracking']);

    if (rlsError) {
      console.error('❌ Error checking RLS status:', rlsError);
      return { success: false };
    }

    console.log('🔐 RLS Status:');
    rlsData.forEach(table => {
      if (table.relkind === 'v') {
        console.log(`  ${table.relname}: 📋 VIEW (inherits RLS from underlying tables)`);
      } else {
        const status = table.relrowsecurity ? '✅ Enabled' : '❌ Disabled';
        console.log(`  ${table.relname}: ${status}`);
      }
    });

    // Check policies
    const { data: policiesData, error: policiesError } = await supabase
      .from('pg_policies')
      .select('tablename, policyname, cmd, permissive')
      .in('tablename', ['mood_entries', 'mood_tracking']);

    if (policiesError) {
      console.error('❌ Error checking policies:', policiesError);
      return { success: false };
    }

    console.log('\n🛡️ Active Policies:');
    const groupedPolicies = {};
    policiesData.forEach(policy => {
      if (!groupedPolicies[policy.tablename]) {
        groupedPolicies[policy.tablename] = [];
      }
      groupedPolicies[policy.tablename].push(policy);
    });

    Object.entries(groupedPolicies).forEach(([table, policies]) => {
      console.log(`\n  ${table}:`);
      policies.forEach(policy => {
        console.log(`    ${policy.policyname} (${policy.cmd})`);
      });
    });

    return { success: true, rls: rlsData, policies: policiesData };
  } catch (error) {
    console.error('❌ Exception checking RLS policies:', error);
    return { success: false };
  }
}

/**
 * 🧪 Test basic operations
 */
async function testBasicOperations() {
  console.log('🧪 Testing basic operations...');
  
  try {
    // Test SELECT on mood_entries (should work)
    const { data: entriesData, error: entriesError } = await supabase
      .from('mood_entries')
      .select('id')
      .limit(1);

    if (entriesError) {
      console.log('❌ mood_entries SELECT failed:', entriesError.message);
    } else {
      console.log('✅ mood_entries SELECT works');
    }

    // Test SELECT on mood_tracking view (should work)
    const { data: trackingData, error: trackingError } = await supabase
      .from('mood_tracking')
      .select('id')
      .limit(1);

    if (trackingError) {
      console.log('❌ mood_tracking SELECT failed:', trackingError.message);
    } else {
      console.log('✅ mood_tracking SELECT works');
    }

    // Test INSERT on mood_tracking (should fail - view is read-only)
    const { error: insertError } = await supabase
      .from('mood_tracking')
      .insert({ 
        user_id: '00000000-0000-0000-0000-000000000000',
        mood_score: 5,
        notes: 'test'
      });

    if (insertError) {
      console.log('✅ mood_tracking INSERT properly blocked:', insertError.message);
    } else {
      console.log('⚠️ mood_tracking INSERT should be blocked but succeeded');
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Exception testing operations:', error);
    return { success: false };
  }
}

/**
 * 📋 Generate health report
 */
async function generateHealthReport() {
  const timestamp = new Date().toISOString();
  console.log(`\n🏥 ObsessLess Production Health Check Report`);
  console.log(`📅 Generated: ${timestamp}`);
  console.log(`🌐 Environment: ${supabaseUrl}`);
  console.log('=' .repeat(60));

  const results = {
    timestamp,
    duplicates: await checkDuplicates(),
    stats: await getMoodStats(),
    health: await getDataHealth(),
    rls: await checkRLSPolicies(),
    operations: await testBasicOperations()
  };

  console.log('\n📋 Summary:');
  const allSuccessful = Object.values(results).every(r => r.success !== false);
  
  if (allSuccessful) {
    console.log('✅ All health checks passed');
  } else {
    console.log('⚠️ Some health checks failed - review output above');
  }

  // Save report to file
  const fs = require('fs');
  const reportPath = `health-report-${Date.now()}.json`;
  
  try {
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);
  } catch (error) {
    console.log('⚠️ Could not save report file:', error.message);
  }

  return results;
}

/**
 * 🚀 Main execution
 */
async function main() {
  try {
    const report = await generateHealthReport();
    
    // Exit with appropriate code
    const hasErrors = Object.values(report).some(r => r.success === false);
    process.exit(hasErrors ? 1 : 0);
  } catch (error) {
    console.error('💥 Health check failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  checkDuplicates,
  getMoodStats,
  getDataHealth,
  checkRLSPolicies,
  testBasicOperations,
  generateHealthReport
};
