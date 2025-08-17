import * as SecureStore from 'expo-secure-store';

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  algorithm: 'AES-256-GCM';
  tag?: string; // kept for compatibility, not used explicitly by simple-crypto
  version: number;
}

/**
 * SecureDataService
 * - AES-256-GCM ile veri şifreleme
 * - Master key SecureStore'da tutulur (base64)
 */
class SecureDataService {
  private static instance: SecureDataService;
  private static KEY_ID = 'master_encryption_key_v1';
  private keyCache: ArrayBuffer | null = null;

  static getInstance(): SecureDataService {
    if (!SecureDataService.instance) {
      SecureDataService.instance = new SecureDataService();
    }
    return SecureDataService.instance;
  }

  private async getOrCreateKey(): Promise<ArrayBuffer> {
    if (this.keyCache) return this.keyCache;
    let stored = await SecureStore.getItemAsync(SecureDataService.KEY_ID);
    if (!stored) {
      const keyBytes = await Random.getRandomBytes(32);
      stored = CryptoUtils.convertArrayBufferToBase64(keyBytes);
      await SecureStore.setItemAsync(SecureDataService.KEY_ID, stored);
      this.keyCache = keyBytes;
      return keyBytes;
    }
    const ab = CryptoUtils.convertBase64ToArrayBuffer(stored);
    this.keyCache = ab;
    return ab;
  }

  async encryptData(data: unknown): Promise<EncryptedData> {
    const key = await this.getOrCreateKey();
    const { utils: CryptoUtils, AES, Random } = await import('react-native-simple-crypto');
    const iv = await Random.getRandomBytes(12); // 96-bit IV for GCM
    const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
    const ptBytes = CryptoUtils.convertUtf8ToArrayBuffer(plaintext);
    const ct = await AES.encrypt(ptBytes, key, iv, { mode: 'gcm' } as any);
    return {
      ciphertext: CryptoUtils.convertArrayBufferToBase64(ct),
      iv: CryptoUtils.convertArrayBufferToBase64(iv),
      algorithm: 'AES-256-GCM',
      version: 1,
    };
  }

  async decryptData(payload: EncryptedData): Promise<unknown> {
    if (payload.algorithm !== 'AES-256-GCM') {
      throw new Error('Unsupported encryption algorithm');
    }
    const key = await this.getOrCreateKey();
    const { utils: CryptoUtils, AES } = await import('react-native-simple-crypto');
    const iv = CryptoUtils.convertBase64ToArrayBuffer(payload.iv);
    const ct = CryptoUtils.convertBase64ToArrayBuffer(payload.ciphertext);
    const pt = await AES.decrypt(ct, key, iv, { mode: 'gcm' } as any);
    const text = CryptoUtils.convertArrayBufferToUtf8(pt);
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}

export const secureDataService = SecureDataService.getInstance();
export default secureDataService;


