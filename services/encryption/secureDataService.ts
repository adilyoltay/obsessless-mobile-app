import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  algorithm: 'AES-256-GCM' | 'SHA256_FALLBACK';
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
      // Generate random 32 bytes key
      const randomBytes = new Uint8Array(32);
      for (let i = 0; i < randomBytes.length; i++) randomBytes[i] = Math.floor(Math.random() * 256);
      const keyBytes = randomBytes.buffer as ArrayBuffer;
      stored = this.arrayBufferToBase64(keyBytes);
      await SecureStore.setItemAsync(SecureDataService.KEY_ID, stored);
      this.keyCache = keyBytes;
      return keyBytes;
    }
    const ab = this.base64ToArrayBuffer(stored);
    this.keyCache = ab;
    return ab;
  }

  async encryptData(data: unknown): Promise<EncryptedData> {
    // Prefer RN Quick Crypto (Node-style) for AES-256-GCM
    try {
      // Dynamically require to avoid bundling issues on web
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createCipheriv, randomBytes, Buffer }: any = require('react-native-quick-crypto');

      const keyAb = await this.getOrCreateKey();
      const key = Buffer.from(new Uint8Array(keyAb));
      if (key.length !== 32) {
        throw new Error('Invalid key length for AES-256-GCM');
      }

      const iv = randomBytes(12);
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
      const ptBuf = Buffer.from(plaintext, 'utf8');

      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(ptBuf), cipher.final()]);
      const tag = cipher.getAuthTag(); // 16 bytes
      const combined = Buffer.concat([encrypted, tag]);

      return {
        ciphertext: combined.toString('base64'),
        iv: iv.toString('base64'),
        algorithm: 'AES-256-GCM',
        version: 1,
      };
    } catch (rnError) {
      // Privacy-first: do not persist any form if strong encryption is unavailable
      console.error('❌ AES-256-GCM unavailable in this runtime. Aborting encryption.');
      const err: any = new Error('ENCRYPTION_UNAVAILABLE');
      err.code = 'ENCRYPTION_UNAVAILABLE';
      throw err;
    }
  }

  async decryptData(payload: EncryptedData): Promise<unknown> {
    if (payload.algorithm === 'SHA256_FALLBACK') {
      throw new Error('Cannot decrypt hashed data - use SHA256_FALLBACK only as last resort');
    }
    if (payload.algorithm !== 'AES-256-GCM') {
      throw new Error('Unsupported encryption algorithm');
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createDecipheriv, Buffer }: any = require('react-native-quick-crypto');

      const keyAb = await this.getOrCreateKey();
      const key = Buffer.from(new Uint8Array(keyAb));
      if (key.length !== 32) {
        throw new Error('Invalid key length for AES-256-GCM');
      }

      const iv = Buffer.from(payload.iv, 'base64');
      const combined = Buffer.from(payload.ciphertext, 'base64');
      if (combined.length < 17) throw new Error('Ciphertext too short');
      const tag = combined.slice(combined.length - 16);
      const enc = combined.slice(0, combined.length - 16);

      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]);
      const text = decrypted.toString('utf8');
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw error;
    }
  }

  // ✅ FIXED: Custom utility methods to replace undefined library functions
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Buffer }: any = require('react-native-quick-crypto');
      return Buffer.from(new Uint8Array(buffer)).toString('base64');
    } catch {
      // Minimal fallback (should rarely be used in RN)
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      // @ts-ignore
      return typeof btoa === 'function' ? btoa(binary) : binary;
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Buffer }: any = require('react-native-quick-crypto');
      const buf = Buffer.from(base64, 'base64');
      return new Uint8Array(buf).buffer;
    } catch {
      // @ts-ignore
      const binaryString = typeof atob === 'function' ? atob(base64) : '';
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      return bytes.buffer;
    }
  }

  private utf8ToArrayBuffer(str: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }

  private arrayBufferToUtf8(buffer: ArrayBufferLike): string {
    const decoder = new TextDecoder();
    const view = new Uint8Array(buffer as ArrayBufferLike);
    return decoder.decode(view);
  }

  /**
   * Create SHA-256 hash using expo-crypto
   */
  private async createHash(data: string): Promise<string> {
    try {
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        data,
        { encoding: Crypto.CryptoEncoding.HEX }
      );
    } catch (error) {
      console.warn('⚠️ Crypto hashing failed, using simple hash');
      // Fallback: simple hash algorithm
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash).toString(16);
    }
  }
  
  /**
   * Enhanced encryption with integrity metadata (from dataEncryption.ts)
   */
  async encryptSensitiveData(data: any): Promise<{ 
    encrypted: string; 
    iv: string; 
    algorithm: string; 
    version: number; 
    hash: string; 
    timestamp: number 
  }> {
    const timestamp = Date.now();
    
    try {
      // Use proper AES-256-GCM encryption
      const encryptedResult = await this.encryptData(data);
      
      // Generate integrity hash for auditability
      const json = JSON.stringify(data);
      const integrityHash = await this.createHash(json);
      
      return {
        encrypted: encryptedResult.ciphertext,
        iv: encryptedResult.iv,
        algorithm: encryptedResult.algorithm,
        version: encryptedResult.version,
        hash: integrityHash,
        timestamp: timestamp
      };
      
    } catch (error) {
      // Privacy-first: do not store, let caller decide
      console.error('❌ AES-256 encryption failed. Data will NOT be stored.', error);
      const err: any = new Error('ENCRYPTION_FAILED_DO_NOT_STORE');
      err.code = 'ENCRYPTION_FAILED_DO_NOT_STORE';
      throw err;
    }
  }
  
  /**
   * Decrypt sensitive data (reverse of encryptSensitiveData)
   */
  async decryptSensitiveData(encryptedData: { 
    encrypted: string; 
    iv: string; 
    algorithm: string; 
    version: number; 
    hash?: string; 
    timestamp?: number 
  }): Promise<any> {
    if (encryptedData.algorithm === 'SHA256_FALLBACK') {
      throw new Error('Cannot decrypt hashed data - use SHA256_FALLBACK only as last resort');
    }
    
    try {
      return await this.decryptData({
        ciphertext: encryptedData.encrypted,
        iv: encryptedData.iv,
        algorithm: encryptedData.algorithm as 'AES-256-GCM',
        version: encryptedData.version
      });
    } catch (error) {
      console.error('❌ AES-256 decryption failed:', error);
      throw error;
    }
  }

  /**
   * Mask PII data for logging/display (from dataEncryption.ts)
   */
  maskPII<T extends Record<string, any>>(data: T): T {
    const masked: any = { ...data };
    
    if (masked.email && typeof masked.email === 'string') {
      const [local, domain] = masked.email.split('@');
      masked.email = `${String(local || '').slice(0, 2)}***@${domain || ''}`;
    }
    
    if (masked.name && typeof masked.name === 'string') {
      masked.name = `${masked.name.slice(0, 1)}***`;
    }
    
    if (masked.phone && typeof masked.phone === 'string') {
      masked.phone = masked.phone.slice(0, 3) + '****' + masked.phone.slice(-2);
    }
    
    return masked as T;
  }
}

export const secureDataService = SecureDataService.getInstance();
export default secureDataService;


