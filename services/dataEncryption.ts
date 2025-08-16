import * as Crypto from 'expo-crypto';

class DataEncryptionService {
  async encryptSensitiveData(data: any): Promise<string> {
    const json = JSON.stringify(data);
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, json, { encoding: Crypto.CryptoEncoding.BASE64 });
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


