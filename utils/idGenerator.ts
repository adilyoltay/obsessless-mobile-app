/**
 * 🆔 SECURE ID GENERATION UTILITIES
 * Replaces insecure Date.now() + Math.random() patterns with cryptographically secure UUIDs
 * 
 * ❌ PROBLEM: Non-deterministic IDs using Date.now() + Math.random()
 * - Collision risk under heavy usage or rapid generation
 * - Predictable patterns (time-based component)
 * - Not cryptographically secure
 * 
 * ✅ SOLUTION: UUID v4 (RFC 4122) with crypto-secure randomness
 * - 2^122 possible values (collision probability ~0)
 * - Cryptographically secure random generation
 * - Industry standard for unique identifiers
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * 🔐 Generate cryptographically secure UUID v4
 * Replaces all Date.now() + Math.random() patterns
 * 
 * @returns UUID v4 string (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
export function generateSecureId(): string {
  return uuidv4();
}

/**
 * 🆔 Generate prefixed secure ID for specific entity types
 * Maintains readability while ensuring uniqueness
 * 
 * @param prefix - Entity type prefix (e.g., "mood", "device", "session")
 * @returns Prefixed UUID (e.g., "mood_550e8400-e29b-41d4-a716-446655440000")
 */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}_${uuidv4()}`;
}

/**
 * 🔢 Generate short secure ID for non-critical use cases
 * Uses first 12 characters of UUID for compactness
 * Still crypto-secure but shorter than full UUID
 * 
 * @param prefix - Optional prefix
 * @returns Short secure ID (e.g., "op_550e8400e29b")
 */
export function generateShortSecureId(prefix?: string): string {
  const shortId = uuidv4().replace(/-/g, '').substring(0, 12);
  return prefix ? `${prefix}_${shortId}` : shortId;
}

/**
 * 📊 SECURITY COMPARISON:
 * 
 * OLD (INSECURE):
 * `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
 * - Format: "1673123456789_x7k2m9p"
 * - Collision risk: Medium (time + 9 chars)
 * - Predictability: High (timestamp visible)
 * - Entropy: ~52 bits
 * 
 * NEW (SECURE):
 * UUID v4: "550e8400-e29b-41d4-a716-446655440000"  
 * - Format: Standard RFC 4122
 * - Collision risk: Negligible (2^122 space)
 * - Predictability: None (crypto-secure random)
 * - Entropy: 122 bits
 * 
 * SECURITY IMPROVEMENT: ~2^70 times more secure
 */

// Legacy pattern detection (for migration reference)
export const LEGACY_PATTERNS = {
  mood: /^mood_\d{13}_[a-z0-9]{7,9}$/,
  device: /^device_\d{13}_[a-z0-9]{7,9}$/,
  session: /^session_\d{13}_[a-z0-9]{7,9}$/,
  operation: /^op_\d{13}_[a-z0-9]{7,9}$/,
  conflict: /^conflict_\d{13}_[a-z0-9]{7,9}$/,
  export: /^export_\d{13}_[a-z0-9]{7,9}$/,
  deletion: /^deletion_\d{13}_[a-z0-9]{7,9}$/,
  audit: /^audit_\d{13}_[a-z0-9]{7,9}$/,
};

/**
 * 🔍 Check if an ID uses the old insecure pattern
 * Useful for migration detection and security auditing
 */
export function isLegacyId(id: string): boolean {
  return Object.values(LEGACY_PATTERNS).some(pattern => pattern.test(id));
}

export default {
  generateSecureId,
  generatePrefixedId,
  generateShortSecureId,
  isLegacyId,
  LEGACY_PATTERNS
};
