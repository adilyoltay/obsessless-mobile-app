/**
 * UUID doğrulama yardımcıları
 * - Sürüm agnostik (v1-v5) UUID doğrulaması yapar.
 */

/**
 * Verilen metnin UUID biçiminde olup olmadığını kontrol eder.
 * UUID sürümünden bağımsız, genel 8-4-4-4-12 hex desenini kullanır.
 */
export function isUUID(value: string | undefined | null): boolean {
  if (!value || typeof value !== 'string') return false;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(value);
}

/**
 * Ortak UUID regex'i. Mümkün olduğunca `isUUID()` kullanın.
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;


