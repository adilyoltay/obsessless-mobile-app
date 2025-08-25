/**
 * ✅ F-07 FIX: RLS Validation Tests
 * 
 * Tests Row Level Security policies to ensure proper access control:
 * - Users can only access their own data
 * - Cross-user data access is blocked
 * - INSERT/UPDATE/DELETE operations respect user boundaries
 * 
 * Tests are skipped if required environment variables are not present.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { jwtDecode } from 'jwt-decode';

// Load environment variables
dotenv.config();

// Required environment variables for RLS testing
const requiredEnv = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'TEST_USER_ACCESS_TOKEN_1', // First test user's JWT token
  'TEST_USER_ACCESS_TOKEN_2'  // Second test user's JWT token (for cross-user tests)
];

// Check if all required environment variables are present
const envMissing = requiredEnv.some(key => !process.env[key]);
const skipReason = envMissing ? 
  `Missing environment variables: ${requiredEnv.filter(key => !process.env[key]).join(', ')}` : 
  '';

// Skip tests if environment is not properly configured
const describeTest = envMissing ? describe.skip : describe;

/**
 * Extract user_id from JWT token
 * Falls back to mock IDs if JWT decode fails or no token provided
 */
function extractUserIdFromToken(token?: string): string {
  if (!token) {
    return 'test-user-mock-id';
  }

  try {
    const decoded = jwtDecode<{ sub?: string; user_id?: string; id?: string }>(token);
    return decoded.sub || decoded.user_id || decoded.id || 'test-user-jwt-fallback';
  } catch (error) {
    console.warn('⚠️ Failed to decode JWT token, using fallback user_id:', error);
    return 'test-user-decode-failed';
  }
}

describeTest('Row Level Security (RLS) Validation', () => {
  let supabaseUser1: any;
  let supabaseUser2: any;
  let testUserId1: string;
  let testUserId2: string;

  beforeAll(() => {
    if (envMissing) {
      console.warn(`⚠️ RLS tests skipped: ${skipReason}`);
      return;
    }

    // Create Supabase clients for two different users
    supabaseUser1 = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            authorization: `Bearer ${process.env.TEST_USER_ACCESS_TOKEN_1}`
          }
        }
      }
    );

    supabaseUser2 = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            authorization: `Bearer ${process.env.TEST_USER_ACCESS_TOKEN_2}`
          }
        }
      }
    );

    // ✅ POLISH 3: Extract real user IDs from JWT tokens
    testUserId1 = extractUserIdFromToken(process.env.TEST_USER_ACCESS_TOKEN_1);
    testUserId2 = extractUserIdFromToken(process.env.TEST_USER_ACCESS_TOKEN_2);
    
    console.log(`🔐 RLS Tests using user IDs: User1=${testUserId1.substring(0, 8)}..., User2=${testUserId2.substring(0, 8)}...`);
  });

  describe('SELECT Operations - Data Isolation', () => {
    it('should only return own mood_entries', async () => {
      const { data, error } = await supabaseUser1
        .from('mood_entries')
        .select('*');

      expect(error).toBeNull();
      
      // All returned records should belong to the authenticated user
      if (data && data.length > 0) {
        data.forEach(record => {
          expect(record.user_id).toBe(testUserId1);
        });
      }
    });

    it('should only return own thought_records', async () => {
      const { data, error } = await supabaseUser1
        .from('thought_records')
        .select('*');

      expect(error).toBeNull();
      
      if (data && data.length > 0) {
        data.forEach(record => {
          expect(record.user_id).toBe(testUserId1);
        });
      }
    });

    it('should only return own voice_checkins', async () => {
      const { data, error } = await supabaseUser1
        .from('voice_checkins')
        .select('*');

      expect(error).toBeNull();
      
      if (data && data.length > 0) {
        data.forEach(record => {
          expect(record.user_id).toBe(testUserId1);
        });
      }
    });

    it('should only return own compulsions', async () => {
      const { data, error } = await supabaseUser1
        .from('compulsions')
        .select('*');

      expect(error).toBeNull();
      
      if (data && data.length > 0) {
        data.forEach(record => {
          expect(record.user_id).toBe(testUserId1);
        });
      }
    });
  });

  describe('INSERT Operations - User ID Enforcement', () => {
    afterEach(async () => {
      // Cleanup test data after each test
      await cleanupTestData();
    });

    it('should allow inserting mood_entries with correct user_id', async () => {
      const testEntry = {
        user_id: testUserId1,
        mood_score: 7,
        energy_level: 6,
        anxiety_level: 4,
        notes: 'RLS test entry',
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabaseUser1
        .from('mood_entries')
        .insert(testEntry)
        .select();

      // Should succeed when user_id matches authenticated user
      expect(error).toBeNull();
      if (data) {
        expect(data[0]?.user_id).toBe(testUserId1);
      }
    });

    it('should block inserting mood_entries with different user_id', async () => {
      const testEntry = {
        user_id: testUserId2, // Different user ID
        mood_score: 7,
        energy_level: 6,
        anxiety_level: 4,
        notes: 'RLS violation attempt',
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabaseUser1
        .from('mood_entries')
        .insert(testEntry);

      // Should fail due to RLS policy
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe('UPDATE Operations - Ownership Enforcement', () => {
    let testRecordId: string;

    beforeEach(async () => {
      // Create a test record for update tests
      const { data } = await supabaseUser1
        .from('mood_entries')
        .insert({
          user_id: testUserId1,
          mood_score: 5,
          energy_level: 5,
          anxiety_level: 5,
          notes: 'Update test record'
        })
        .select()
        .single();

      testRecordId = data?.id;
    });

    afterEach(async () => {
      await cleanupTestData();
    });

    it('should allow updating own records', async () => {
      const { data, error } = await supabaseUser1
        .from('mood_entries')
        .update({ mood_score: 8, notes: 'Updated by owner' })
        .eq('id', testRecordId)
        .select();

      expect(error).toBeNull();
      if (data) {
        expect(data[0]?.mood_score).toBe(8);
        expect(data[0]?.notes).toBe('Updated by owner');
      }
    });

    it('should block updating records with different user context', async () => {
      // User2 tries to update User1's record
      const { data, error } = await supabaseUser2
        .from('mood_entries')
        .update({ mood_score: 1, notes: 'Unauthorized update attempt' })
        .eq('id', testRecordId);

      // Should fail due to RLS policy
      expect(error).not.toBeNull();
      expect(data).toBeNull();
    });
  });

  describe('DELETE Operations - Ownership Enforcement', () => {
    let testRecordId: string;

    beforeEach(async () => {
      // Create a test record for delete tests
      const { data } = await supabaseUser1
        .from('mood_entries')
        .insert({
          user_id: testUserId1,
          mood_score: 5,
          energy_level: 5,
          anxiety_level: 5,
          notes: 'Delete test record'
        })
        .select()
        .single();

      testRecordId = data?.id;
    });

    it('should allow deleting own records', async () => {
      const { error } = await supabaseUser1
        .from('mood_entries')
        .delete()
        .eq('id', testRecordId);

      expect(error).toBeNull();

      // Verify record is deleted
      const { data } = await supabaseUser1
        .from('mood_entries')
        .select('*')
        .eq('id', testRecordId);

      expect(data).toEqual([]);
    });

    it('should block deleting records from different user context', async () => {
      // User2 tries to delete User1's record
      const { error } = await supabaseUser2
        .from('mood_entries')
        .delete()
        .eq('id', testRecordId);

      // Should fail due to RLS policy  
      expect(error).not.toBeNull();

      // Verify record still exists
      const { data } = await supabaseUser1
        .from('mood_entries')
        .select('*')
        .eq('id', testRecordId);

      expect(data).toHaveLength(1);
    });
  });

  describe('AI Tables RLS Validation', () => {
    it('should only return own ai_telemetry records', async () => {
      const { data, error } = await supabaseUser1
        .from('ai_telemetry')
        .select('*')
        .limit(10);

      expect(error).toBeNull();
      
      if (data && data.length > 0) {
        data.forEach(record => {
          expect(record.user_id).toBe(testUserId1);
        });
      }
    });

    it('should only return own ai_cache records', async () => {
      const { data, error } = await supabaseUser1
        .from('ai_cache')
        .select('*')
        .limit(10);

      expect(error).toBeNull();
      
      if (data && data.length > 0) {
        data.forEach(record => {
          expect(record.user_id).toBe(testUserId1);
        });
      }
    });
  });

  // Helper function to clean up test data
  async function cleanupTestData() {
    try {
      // Clean up test records (best effort)
      await supabaseUser1.from('mood_entries').delete().ilike('notes', '%test%');
      await supabaseUser1.from('thought_records').delete().ilike('notes', '%test%');
    } catch (error) {
      console.warn('Test cleanup failed (non-critical):', error);
    }
  }
});

// Display skip reason if tests are skipped
if (envMissing) {
  console.log(`\n⚠️  RLS Tests Configuration:`);
  console.log(`   Required environment variables: ${requiredEnv.join(', ')}`);
  console.log(`   Missing: ${requiredEnv.filter(key => !process.env[key]).join(', ')}`);
  console.log(`   Tests will be SKIPPED until environment is properly configured.\n`);
  console.log(`\n   💡 To run RLS tests, provide:`);
  console.log(`      - SUPABASE_URL: Your project URL`);
  console.log(`      - SUPABASE_ANON_KEY: Anonymous key from project settings`);
  console.log(`      - TEST_USER_ACCESS_TOKEN_1: JWT token from test user login`);
  console.log(`      - TEST_USER_ACCESS_TOKEN_2: JWT token from another test user\n`);
} else {
  console.log(`✅ RLS Tests environment configured - tests will run with JWT decode`);
}
