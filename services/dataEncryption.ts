import * as Crypto from 'expo-crypto';
import { secureDataService } from './encryption/secureDataService';

class DataEncryptionService {
  /**
   * ✅ FIXED: Proper AES-256 encryption instead of SHA-256 hash
   */
  async encryptSensitiveData(data: any): Promise<{ encrypted: string; iv: string; algorithm: string; version: number }> {
    try {
      // Use proper AES-256-GCM encryption
      const encryptedResult = await secureDataService.encryptData(data);
      return encryptedResult;
    } catch (error) {
      console.error('❌ AES-256 encryption failed:', error);
      
      // Fallback to basic hash if secure encryption fails
      // This ensures we don't store plaintext data
      const json = JSON.stringify(data);
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, json, { encoding: Crypto.CryptoEncoding.BASE64 });
      
      return {
        encrypted: hash,
        iv: '',
        algorithm: 'SHA256_FALLBACK',
        version: 0
      };
    }
  }
  
  /**
   * ✅ NEW: Decrypt sensitive data (reverse of encryption)
   */
  async decryptSensitiveData(encryptedData: { encrypted: string; iv: string; algorithm: string; version: number }): Promise<any> {
    if (encryptedData.algorithm === 'SHA256_FALLBACK') {
      throw new Error('Cannot decrypt hashed data - use SHA256_FALLBACK only as last resort');
    }
    
    try {
      return await secureDataService.decryptData({
        ciphertext: encryptedData.encrypted,
        iv: encryptedData.iv,
        algorithm: encryptedData.algorithm,
        version: encryptedData.version
      });
    } catch (error) {
      console.error('❌ AES-256 decryption failed:', error);
      throw error;
    }
  }

  maskPII<T extends Record<string, any>>(data: T): T {
    const masked: any = { ...data };
    if (masked.email && typeof masked.email === 'string') {
      const [local, domain] = masked.email.split('@');
      masked.email = `${String(local || '').slice(0, 2)}***@${domain || ''}`;
    }
    if (masked.name && typeof masked.name === 'string') {
      masked.name = `${masked.name.slice(0, 1)}***`;
    }
    return masked as T;
  }
}

export const dataEncryption = new DataEncryptionService();
export default dataEncryption;


