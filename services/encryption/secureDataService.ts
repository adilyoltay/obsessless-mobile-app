import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

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
    try {
      const key = await this.getOrCreateKey();
      const keyObject = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      // Generate random IV (96-bit for GCM)
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
      const ptBytes = this.utf8ToArrayBuffer(plaintext);
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        keyObject,
        ptBytes
      );
      
      return {
        ciphertext: this.arrayBufferToBase64(encrypted),
        iv: this.arrayBufferToBase64(iv.buffer),
        algorithm: 'AES-256-GCM',
        version: 1,
      };
    } catch (error) {
      console.warn('⚠️ Web Crypto API not available, using fallback');
      // Fallback: return hashed data instead of encrypted
      const json = JSON.stringify(data);
      const hash = await this.createHash(json);
      return {
        ciphertext: hash,
        iv: '',
        algorithm: 'SHA256_FALLBACK',
        version: 0,
      };
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
      const key = await this.getOrCreateKey();
      const keyObject = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );
      
      const iv = this.base64ToArrayBuffer(payload.iv);
      const ciphertext = this.base64ToArrayBuffer(payload.ciphertext);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        keyObject,
        ciphertext
      );
      
      const text = this.arrayBufferToUtf8(decrypted);
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
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private utf8ToArrayBuffer(str: string): ArrayBuffer {
    const encoder = new TextEncoder();
    return encoder.encode(str).buffer;
  }

  private arrayBufferToUtf8(buffer: ArrayBuffer): string {
    const decoder = new TextDecoder();
    return decoder.decode(buffer);
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
      console.error('❌ AES-256 encryption failed:', error);
      
      // Generate fallback hash instead of storing plaintext
      const json = JSON.stringify(data);
      const fallbackHash = await this.createHash(json);
      
      console.warn('⚠️ Encryption failed, using sanitized data:', error);
      return {
        encrypted: fallbackHash,
        iv: '',
        algorithm: 'SHA256_FALLBACK',
        version: 0,
        hash: fallbackHash,
        timestamp: timestamp
      };
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


