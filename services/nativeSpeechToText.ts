/**
 * 🎤 Native Speech-to-Text Service
 * 
 * Gerçek cihaz ses tanıma API'larını kullanır
 * iOS: SFSpeechRecognizer
 * Android: SpeechRecognizer
 */

import Voice, {
  SpeechRecognizedEvent,
  SpeechErrorEvent,
  SpeechResultsEvent,
  SpeechStartEvent,
  SpeechEndEvent,
} from '@react-native-voice/voice';
import { Platform } from 'react-native';

export interface NativeTranscriptionResult {
  text: string;
  confidence: number;
  isPartial: boolean;
  language: string;
  success: boolean;
  error?: string;
}

class NativeSpeechToTextService {
  private static instance: NativeSpeechToTextService;
  private isListening = false;
  private partialResults: string[] = [];
  private finalResults: string[] = [];
  private currentLanguage = 'tr-TR';
  private errorCount = 0;
  private lastErrorTime = 0;
  private isInitialized = false;
  
  constructor() {
    this.initializeVoice();
  }

  static getInstance(): NativeSpeechToTextService {
    if (!NativeSpeechToTextService.instance) {
      NativeSpeechToTextService.instance = new NativeSpeechToTextService();
    }
    return NativeSpeechToTextService.instance;
  }

  /**
   * 🎯 Initialize Voice Recognition
   */
  private async initializeVoice() {
    try {
      // Set up event listeners
      Voice.onSpeechStart = this.onSpeechStart.bind(this);
      Voice.onSpeechRecognized = this.onSpeechRecognized.bind(this);
      Voice.onSpeechEnd = this.onSpeechEnd.bind(this);
      Voice.onSpeechError = this.onSpeechError.bind(this);
      Voice.onSpeechResults = this.onSpeechResults.bind(this);
      Voice.onSpeechPartialResults = this.onSpeechPartialResults.bind(this);

      // Check if voice recognition is available
      const isAvailable = await Voice.isAvailable();
      console.log('🎤 Native Voice Recognition available:', isAvailable);

      if (!isAvailable) {
        console.warn('⚠️ Voice recognition not available on this device');
      }

      // Get supported languages
      const languages = await Voice.getSpeechRecognitionServices();
      console.log('🌍 Supported languages:', languages);

    } catch (error) {
      console.error('❌ Voice initialization failed:', error);
    }
  }

  /**
   * 🎤 Start listening for speech (Enhanced)
   */
  async startListening(language: string = 'tr-TR'): Promise<void> {
    if (this.isListening) {
      console.log('Already listening...');
      return;
    }

    // ⚡ ERROR RATE LIMITING
    const now = Date.now();
    if (this.errorCount >= 3 && now - this.lastErrorTime < 30000) {
      throw new Error('Too many speech recognition errors. Please wait 30 seconds.');
    }

    try {
      // Ensure clean state
      await this.forceCleanup();
      
      this.currentLanguage = language;
      this.partialResults = [];
      this.finalResults = [];
      
      await Voice.start(language);
      this.isListening = true;
      this.isInitialized = true;
      
      // Reset error count on successful start
      this.errorCount = 0;
      console.log(`🎤 Started listening in ${language}`);
      
    } catch (error) {
      console.error('❌ Failed to start listening:', error);
      this.isListening = false;
      this.errorCount++;
      this.lastErrorTime = now;
      throw error;
    }
  }

  /**
   * 🛑 Stop listening
   */
  async stopListening(): Promise<NativeTranscriptionResult> {
    if (!this.isListening) {
      return {
        text: '',
        confidence: 0,
        isPartial: false,
        language: this.currentLanguage,
        success: false,
        error: 'Not listening',
      };
    }

    try {
      await Voice.stop();
      this.isListening = false;
      console.log('🛑 Stopped listening');

      // Wait a bit for final results
      await new Promise(resolve => setTimeout(resolve, 500));

      // Return the final transcription
      const finalText = this.finalResults.join(' ') || this.partialResults.join(' ');
      
      return {
        text: finalText.trim(),
        confidence: finalText ? 0.9 : 0,
        isPartial: false,
        language: this.currentLanguage,
        success: !!finalText,
      };

    } catch (error) {
      console.error('❌ Failed to stop listening:', error);
      this.isListening = false;
      
      return {
        text: this.partialResults.join(' '),
        confidence: 0.5,
        isPartial: true,
        language: this.currentLanguage,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 🎯 Cancel listening
   */
  async cancelListening(): Promise<void> {
    try {
      await Voice.cancel();
      this.isListening = false;
      this.partialResults = [];
      this.finalResults = [];
      console.log('❌ Listening cancelled');
    } catch (error) {
      console.error('Failed to cancel:', error);
    }
  }

  /**
   * 🧹 Clean up resources
   */
  async destroy(): Promise<void> {
    try {
      await Voice.destroy();
      console.log('🧹 Voice service destroyed');
    } catch (error) {
      console.error('Failed to destroy voice service:', error);
    }
  }

  // Event Handlers
  private onSpeechStart(e: SpeechStartEvent) {
    console.log('🎤 Speech started');
  }

  private onSpeechRecognized(e: SpeechRecognizedEvent) {
    console.log('👂 Speech recognized');
  }

  private onSpeechEnd(e: SpeechEndEvent) {
    console.log('🛑 Speech ended');
    this.isListening = false;
  }

  private onSpeechError(e: SpeechErrorEvent) {
    console.error('❌ Speech error:', e.error);
    this.isListening = false;

    // Handle specific errors
    if (e.error?.code === 'no_match' || e.error?.message?.includes('No match')) {
      console.log('⚠️ No speech detected - user might be silent');
    } else if (e.error?.code === 'permissions') {
      console.error('🚫 Microphone permission denied');
    } else if (e.error?.code === '1101' || e.error?.message?.includes('1101')) {
      console.error('🚨 Speech Recognition Service Error 1101 - Cleaning up...');
      this.forceCleanup();
    }
  }

  /**
   * 🧹 Force cleanup when errors occur (Enhanced)
   */
  private async forceCleanup() {
    try {
      console.log('🧹 Starting force cleanup...');
      
      // Stop listening if active
      if (this.isListening) {
        try {
          await Voice.stop();
        } catch (stopError) {
          console.warn('⚠️ Stop failed during cleanup:', stopError);
        }
      }
      
      // Reset all state
      this.isListening = false;
      this.partialResults = [];
      this.finalResults = [];
      
      // Try to destroy any active voice sessions
      try {
        await Voice.destroy();
      } catch (destroyError) {
        console.warn('⚠️ Destroy failed during cleanup:', destroyError);
      }
      
      // Wait a bit before allowing new requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('✅ Force cleanup completed');
    } catch (cleanupError) {
      console.error('❌ Cleanup failed:', cleanupError);
    }
  }

  private onSpeechResults(e: SpeechResultsEvent) {
    console.log('✅ Final results:', e.value);
    if (e.value) {
      this.finalResults = e.value;
    }
  }

  private onSpeechPartialResults(e: SpeechResultsEvent) {
    console.log('📝 Partial results:', e.value);
    if (e.value) {
      this.partialResults = e.value;
    }
  }

  /**
   * 🎯 Direct transcription method for recorded audio
   * 
   * NOTE: Voice library works with real-time microphone input,
   * not pre-recorded audio files. For pre-recorded audio,
   * we need to use cloud services or play-and-capture approach.
   */
  async transcribeRecordedAudio(audioUri: string): Promise<NativeTranscriptionResult> {
    console.log('⚠️ Native Voice API does not support pre-recorded audio files directly');
    console.log('💡 Using real-time listening instead...');
    
    // For pre-recorded audio, you would need:
    // 1. Cloud service (Google STT, Azure, AWS)
    // 2. Play audio and capture with microphone (hacky)
    // 3. Custom native module that supports file input
    
    // For now, return empty and let user use real-time mode
    return {
      text: '',
      confidence: 0,
      isPartial: false,
      language: this.currentLanguage,
      success: false,
      error: 'Pre-recorded audio not supported. Use real-time listening.',
    };
  }

  /**
   * 🎤 Check if currently listening
   */
  getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * 📝 Get current partial results
   */
  getPartialResults(): string {
    return this.partialResults.join(' ');
  }

  /**
   * 🔍 Check availability
   */
  async checkAvailability(): Promise<boolean> {
    try {
      // Basic availability check
      const isAvailable = await Voice.isAvailable();
      console.log('🎤 Voice availability check:', isAvailable);
      
      if (!isAvailable) {
        return false;
      }
      
      // 🍎 iOS Speech Recognition Permission Check
      if (Platform.OS === 'ios') {
        try {
          // Try to start and immediately stop to trigger permission request
          console.log('🍎 Testing iOS Speech Recognition permission...');
          
          await Voice.start('tr-TR');
          await new Promise(resolve => setTimeout(resolve, 100)); // Brief pause
          await Voice.stop();
          
          console.log('✅ iOS Speech Recognition permission granted');
          return true;
          
        } catch (iosError: any) {
          console.warn('⚠️ iOS Speech Recognition test failed:', iosError);
          
          // Check specific error codes
          if (iosError.message?.includes('permissions') || iosError.message?.includes('authorization')) {
            console.error('🚫 Speech Recognition permission denied');
            return false;
          }
          
          // If it's just a service error but permission might be OK, allow it
          console.log('📝 Permission might be OK, service error detected');
          return true; // Let the actual usage handle the error
        }
      }
      
      return isAvailable ?? false;
      
    } catch (error) {
      console.error('❌ Availability check failed:', error);
      return false;
    }
  }

  /**
   * 🌍 Get supported languages
   */
  async getSupportedLanguages(): Promise<string[]> {
    try {
      const languages = await Voice.getSpeechRecognitionServices();
      return languages ?? [];
    } catch (error) {
      console.error('Failed to get languages:', error);
      return [];
    }
  }
}

export default NativeSpeechToTextService.getInstance();
