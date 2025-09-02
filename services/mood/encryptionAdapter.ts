import { secureDataService } from '@/services/encryption/secureDataService';

/**
 * encryptionAdapter: thin wrapper around secureDataService to decouple callers
 */
export const encryptionAdapter = {
  encryptSensitiveData: (data: any) => secureDataService.encryptSensitiveData(data),
  decryptSensitiveData: (payload: any) => secureDataService.decryptSensitiveData(payload),
  encryptData: (data: any) => secureDataService.encryptData(data),
  decryptData: (payload: any) => secureDataService.decryptData(payload),
};
