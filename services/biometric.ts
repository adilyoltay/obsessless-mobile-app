
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface BiometricCapability {
  isAvailable: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  isEnrolled: boolean;
}

export class BiometricService {
  private static instance: BiometricService;
  private static readonly BIOMETRIC_CREDENTIALS_KEY = 'biometric_credentials';
  private static readonly BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

  public static getInstance(): BiometricService {
    if (!BiometricService.instance) {
      BiometricService.instance = new BiometricService();
    }
    return BiometricService.instance;
  }

  // Check biometric capabilities
  async checkBiometricCapability(): Promise<BiometricCapability> {
    try {
      // Web platformunda biometric desteklenmiyor
      if (Platform.OS === 'web') {
        return {
          isAvailable: false,
          supportedTypes: [],
          isEnrolled: false,
        };
      }

      const isAvailable = await LocalAuthentication.hasHardwareAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      return {
        isAvailable,
        supportedTypes,
        isEnrolled,
      };
    } catch (error) {
      console.error('Error checking biometric capability:', error);
      return {
        isAvailable: false,
        supportedTypes: [],
        isEnrolled: false,
      };
    }
  }

  // Authenticate with biometrics
  async authenticateWithBiometrics(): Promise<{ success: boolean; error?: string }> {
    try {
      const capability = await this.checkBiometricCapability();
      
      if (!capability.isAvailable) {
        return { success: false, error: 'Biometric authentication is not available on this device' };
      }

      if (!capability.isEnrolled) {
        return { success: false, error: 'No biometric credentials are enrolled on this device' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'ObsessLess\'e giriş yapmak için parmak izinizi kullanın',
        cancelLabel: 'İptal',
        fallbackLabel: 'Şifre kullan',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return { success: true };
      }
      return { success: false, error: 'Biometric doğrulama başarısız' };
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return { success: false, error: 'Biometric doğrulama sırasında hata oluştu' };
    }
  }

  // Enable biometric login
  async enableBiometricLogin(email: string, encryptedCredentials: string): Promise<boolean> {
    try {
      const capability = await this.checkBiometricCapability();
      
      if (!capability.isAvailable || !capability.isEnrolled) {
        return false;
      }

      // Store encrypted credentials securely
      await SecureStore.setItemAsync(BiometricService.BIOMETRIC_CREDENTIALS_KEY, JSON.stringify({
        email,
        credentials: encryptedCredentials,
        timestamp: Date.now(),
      }));

      await SecureStore.setItemAsync(BiometricService.BIOMETRIC_ENABLED_KEY, 'true');
      
      return true;
    } catch (error) {
      console.error('Error enabling biometric login:', error);
      return false;
    }
  }

  // Disable biometric login
  async disableBiometricLogin(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(BiometricService.BIOMETRIC_CREDENTIALS_KEY);
      await SecureStore.deleteItemAsync(BiometricService.BIOMETRIC_ENABLED_KEY);
    } catch (error) {
      console.error('Error disabling biometric login:', error);
    }
  }

  // Check if biometric login is enabled
  async isBiometricLoginEnabled(): Promise<boolean> {
    try {
      // Web platformunda biometric desteklenmiyor
      if (Platform.OS === 'web') {
        return false;
      }

      const enabled = await SecureStore.getItemAsync(BiometricService.BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking biometric login status:', error);
      return false;
    }
  }

  // Get stored biometric credentials
  async getBiometricCredentials(): Promise<{ email: string; credentials: string } | null> {
    try {
      const storedData = await SecureStore.getItemAsync(BiometricService.BIOMETRIC_CREDENTIALS_KEY);
      
      if (!storedData) {
        return null;
      }

      const parsed = JSON.parse(storedData);
      return {
        email: parsed.email,
        credentials: parsed.credentials,
      };
    } catch (error) {
      console.error('Error getting biometric credentials:', error);
      return null;
    }
  }

  // Get biometric type name for display
  getBiometricTypeName(types: LocalAuthentication.AuthenticationType[]): string {
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Yüz Tanıma';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return 'Parmak İzi';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'İris Tanıma';
    }
    return 'Biometric';
  }
}

export const biometricService = BiometricService.getInstance();
