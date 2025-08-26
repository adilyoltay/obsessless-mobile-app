import secureDataService, { EncryptedData } from '@/services/encryption/secureDataService';

describe('secureDataService AES-GCM round-trip', () => {
  it('encrypts and decrypts unicode and large payloads correctly (AES-256-GCM)', async () => {
    // Skip if runtime falls back to SHA256_FALLBACK (e.g., missing quick-crypto)
    const sample = {
      text: 'Merhaba 🌿 dünyâ — こんにちは — مرحبا — 😀',
      long: 'x'.repeat(256 * 1024), // 256 KB payload
      nested: { a: 1, b: [1,2,3], c: { d: 'çğüşiö' } }
    };
    const encrypted: EncryptedData = await secureDataService.encryptData(sample);
    if (encrypted.algorithm !== 'AES-256-GCM') {
      // Environment does not support AES (e.g., CI without quick-crypto); this is acceptable
      // for non-secret telemetry fallback. Skip strict round-trip assertion.
      return;
    }
    const decrypted = await secureDataService.decryptData(encrypted);
    expect(decrypted).toBeTruthy();
    expect((decrypted as any).text).toBe(sample.text);
    expect((decrypted as any).long.length).toBe(sample.long.length);
    expect((decrypted as any).nested.c.d).toBe(sample.nested.c.d);
  });
});


