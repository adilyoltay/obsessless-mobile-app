#!/usr/bin/env tsx
/**
 * ✅ F-07 FIX: RLS and Schema Drift Verification Script
 * 
 * Manual verification tool for:
 * - RLS policies status
 * - Schema drift detection  
 * - Database health checks
 * - Index optimization recommendations
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface RLSCheck {
  tableName: string;
  hasRLS: boolean;
  policyCount: number;
  policies: string[];
}

interface SchemaHealth {
  table: string;
  rowCount: number;
  hasUserIdColumn: boolean;
  hasCreatedAtColumn: boolean;
  hasUpdatedAtColumn: boolean;
  missingIndexes: string[];
}

class RLSVerifier {
  private supabase: any;

  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  /**
   * Check RLS status for all user tables
   */
  async checkRLSStatus(): Promise<RLSCheck[]> {
    const userTables = [
      'mood_entries',
      'thought_records', 
      'voice_checkins',
      'compulsions',
      'ai_telemetry',
      'ai_cache',
      'user_profiles',
      'user_achievements'
    ];

    const results: RLSCheck[] = [];

    for (const tableName of userTables) {
      try {
        console.log(`🔍 Checking RLS for ${tableName}...`);
        
        // Check if RLS is enabled
        const { data: tableData, error: tableError } = await this.supabase
          .rpc('check_table_rls', { table_name: tableName })
          .single();

        if (tableError) {
          console.warn(`⚠️ Could not check RLS for ${tableName}:`, tableError.message);
          continue;
        }

        // Get RLS policies
        const { data: policies, error: policyError } = await this.supabase
          .from('pg_policies')
          .select('policyname, cmd, qual')
          .eq('tablename', tableName);

        const policyNames = policies?.map(p => `${p.policyname} (${p.cmd})`) || [];

        results.push({
          tableName,
          hasRLS: tableData?.rls_enabled || false,
          policyCount: policies?.length || 0,
          policies: policyNames
        });

      } catch (error) {
        console.error(`❌ Error checking ${tableName}:`, error);
      }
    }

    return results;
  }

  /**
   * Analyze schema health and optimization opportunities
   */
  async analyzeSchemaHealth(): Promise<SchemaHealth[]> {
    const tables = [
      'mood_entries',
      'thought_records',
      'voice_checkins', 
      'compulsions'
    ];

    const results: SchemaHealth[] = [];

    for (const table of tables) {
      try {
        console.log(`📊 Analyzing ${table} schema health...`);

        // Get table info
        const { data: tableInfo, error: infoError } = await this.supabase
          .from('information_schema.columns')
          .select('column_name, data_type')
          .eq('table_name', table)
          .eq('table_schema', 'public');

        if (infoError) {
          console.warn(`⚠️ Could not get info for ${table}:`, infoError.message);
          continue;
        }

        const columns = tableInfo?.map(col => col.column_name) || [];
        
        // Check row count (sample)
        const { count } = await this.supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        // Check for missing indexes (simplified check)
        const missingIndexes = [];
        
        if (columns.includes('user_id') && columns.includes('created_at')) {
          // Check if composite index exists
          const { data: indexCheck } = await this.supabase
            .rpc('check_composite_index', { 
              table_name: table,
              columns: ['user_id', 'created_at'] 
            });
          
          if (!indexCheck) {
            missingIndexes.push('user_id,created_at');
          }
        }

        results.push({
          table,
          rowCount: count || 0,
          hasUserIdColumn: columns.includes('user_id'),
          hasCreatedAtColumn: columns.includes('created_at'),
          hasUpdatedAtColumn: columns.includes('updated_at'),
          missingIndexes
        });

      } catch (error) {
        console.error(`❌ Error analyzing ${table}:`, error);
      }
    }

    return results;
  }

  /**
   * Check for potential security issues
   */
  async runSecurityAudit(): Promise<void> {
    console.log('🛡️ Running security audit...\n');

    try {
      // Check for tables without RLS
      const { data: noRLSTables } = await this.supabase
        .from('pg_tables')
        .select('tablename')
        .eq('schemaname', 'public')
        .eq('rowsecurity', false);

      if (noRLSTables && noRLSTables.length > 0) {
        console.log('⚠️ Tables without RLS:');
        noRLSTables.forEach(table => console.log(`  - ${table.tablename}`));
        console.log();
      }

      // Check for overly permissive policies
      const { data: policies } = await this.supabase
        .from('pg_policies')
        .select('tablename, policyname, qual')
        .like('qual', '%true%'); // Potentially overly permissive

      if (policies && policies.length > 0) {
        console.log('⚠️ Potentially permissive policies:');
        policies.forEach(policy => {
          console.log(`  - ${policy.tablename}.${policy.policyname}: ${policy.qual}`);
        });
        console.log();
      }

    } catch (error) {
      console.error('❌ Security audit failed:', error);
    }
  }

  /**
   * Generate optimization recommendations
   */
  async generateRecommendations(healthResults: SchemaHealth[]): Promise<void> {
    console.log('💡 Optimization Recommendations:\n');

    healthResults.forEach(result => {
      console.log(`📋 ${result.table}:`);
      
      if (result.rowCount > 1000 && result.missingIndexes.length > 0) {
        console.log(`  ⚡ Add composite index for better RLS performance:`);
        console.log(`     CREATE INDEX idx_${result.table}_user_created ON ${result.table}(user_id, created_at);`);
      }

      if (!result.hasUpdatedAtColumn) {
        console.log(`  📅 Consider adding updated_at column for change tracking`);
      }

      if (result.rowCount > 10000) {
        console.log(`  🗂️ Consider partitioning strategy for ${result.rowCount} rows`);
      }

      console.log();
    });
  }

  /**
   * Main verification runner
   */
  async run(): Promise<void> {
    console.log('🚀 Starting RLS and Schema Verification...\n');

    try {
      // 1. Check RLS Status
      console.log('=' .repeat(60));
      console.log('🛡️ RLS STATUS CHECK');
      console.log('=' .repeat(60));
      
      const rlsResults = await this.checkRLSStatus();
      
      rlsResults.forEach(result => {
        const status = result.hasRLS ? '✅' : '❌';
        console.log(`${status} ${result.tableName}: RLS ${result.hasRLS ? 'ENABLED' : 'DISABLED'} (${result.policyCount} policies)`);
        
        if (result.policies.length > 0) {
          result.policies.forEach(policy => {
            console.log(`   📋 ${policy}`);
          });
        }
        console.log();
      });

      // 2. Schema Health Analysis
      console.log('=' .repeat(60));
      console.log('📊 SCHEMA HEALTH ANALYSIS');
      console.log('=' .repeat(60));
      
      const healthResults = await this.analyzeSchemaHealth();
      
      healthResults.forEach(result => {
        console.log(`📋 ${result.table}:`);
        console.log(`   📊 Rows: ${result.rowCount.toLocaleString()}`);
        console.log(`   👤 Has user_id: ${result.hasUserIdColumn ? '✅' : '❌'}`);
        console.log(`   📅 Has created_at: ${result.hasCreatedAtColumn ? '✅' : '❌'}`);
        console.log(`   🔄 Has updated_at: ${result.hasUpdatedAtColumn ? '✅' : '❌'}`);
        console.log(`   📇 Missing indexes: ${result.missingIndexes.length || 'None'}`);
        console.log();
      });

      // 3. Security Audit
      console.log('=' .repeat(60));
      console.log('🛡️ SECURITY AUDIT');
      console.log('=' .repeat(60));
      
      await this.runSecurityAudit();

      // 4. Recommendations  
      console.log('=' .repeat(60));
      console.log('💡 RECOMMENDATIONS');
      console.log('=' .repeat(60));
      
      await this.generateRecommendations(healthResults);

      // 5. Summary
      const totalTables = rlsResults.length;
      const protectedTables = rlsResults.filter(r => r.hasRLS).length;
      const coveragePercent = Math.round((protectedTables / totalTables) * 100);

      console.log('=' .repeat(60));
      console.log('📈 SUMMARY');
      console.log('=' .repeat(60));
      console.log(`🛡️ RLS Coverage: ${protectedTables}/${totalTables} tables (${coveragePercent}%)`);
      console.log(`📊 Schema Health: ${healthResults.length} tables analyzed`);
      
      if (coveragePercent === 100) {
        console.log('✅ All user tables are properly protected with RLS!');
      } else {
        console.log('⚠️ Some tables need RLS protection!');
      }

    } catch (error) {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    }
  }
}

// Run the verification
if (require.main === module) {
  const verifier = new RLSVerifier();
  verifier.run().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

export { RLSVerifier };
