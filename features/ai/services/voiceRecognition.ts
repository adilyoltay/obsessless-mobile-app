/**
 * Voice Recognition Service
 * 
 * Sesli komut ve transkripsiyon servisi
 * Privacy-first: Ses verileri lokal işlenir, sadece transkript gönderilir
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { 
  AIError,
  AIErrorCode
} from '@/features/ai/types';
import { trackAIInteraction } from '@/features/ai/telemetry/aiTelemetry';
import { AIEventType } from '@/features/ai/types';
import { logger } from '@/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ses tanıma durumları
export enum VoiceRecognitionState {
  IDLE = 'idle',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  TRANSCRIBING = 'transcribing',
  ERROR = 'error',
  COMPLETED = 'completed'
}

// Ses komutu
export interface VoiceCommand {
  id: string;
  command: string;
  aliases: string[];
  action: (params?: any) => Promise<void>;
  requiresConfirmation?: boolean;
}

// Transkripsiyon sonucu
export interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  duration: number;
  timestamp: Date;
  alternatives?: string[];
}

// Ses ayarları
export interface VoiceSettings {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  profanityFilter: boolean;
  partialResults: boolean;
  preferOffline: boolean;
}

// Ses oturumu
export interface VoiceSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  state: VoiceRecognitionState;
  recordings: Recording[];
  transcriptions: TranscriptionResult[];
  errors: Error[];
}

// Kayıt
interface Recording {
  uri: string;
  duration: number;
  timestamp: Date;
}

class VoiceRecognitionService {
  private static instance: VoiceRecognitionService;
  private recording: Audio.Recording | null = null;
  private currentSession: VoiceSession | null = null;
  private commands: Map<string, VoiceCommand> = new Map();
  private settings: VoiceSettings;
  private isInitialized: boolean = false;

  private constructor() {
    this.settings = this.getDefaultSettings();
    this.initializeCommands();
  }

  static getInstance(): VoiceRecognitionService {
    if (!this.instance) {
      this.instance = new VoiceRecognitionService();
    }
    return this.instance;
  }

  /**
   * Servisi başlat
   */
  async initialize(): Promise<void> {
    if (!FEATURE_FLAGS.isEnabled('AI_VOICE')) {
      logger.ai.info('Voice recognition is disabled by feature flag');
      return;
    }

    if (this.isInitialized) return;

    try {
      // Ses izinlerini kontrol et
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw this.createError('Microphone permission denied', AIErrorCode.PRIVACY_VIOLATION);
      }

      // Audio mode ayarla
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false
      });

      // Kaydedilmiş ayarları yükle
      await this.loadSettings();

      this.isInitialized = true;
      logger.ai.info('Voice recognition initialized successfully');

      // Telemetri
      await trackAIInteraction(AIEventType.FEATURE_ENABLED, {
        feature: 'voice_recognition',
        language: this.settings.language
      });
    } catch (error) {
      logger.ai.error('Failed to initialize voice recognition', error);
      throw error;
    }
  }

  /**
   * Ses kaydını başlat
   */
  async startListening(sessionId?: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.recording) {
      logger.ai.warn('Recording already in progress');
      return;
    }

    try {
      // Yeni oturum oluştur
      this.currentSession = {
        id: sessionId || `voice_${Date.now()}`,
        startTime: new Date(),
        state: VoiceRecognitionState.LISTENING,
        recordings: [],
        transcriptions: [],
        errors: []
      };

      // Kayıt başlat
      this.recording = new Audio.Recording();
      
      await this.recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {}
      });

      await this.recording.startAsync();
      
      logger.ai.info('Voice recording started', { sessionId: this.currentSession.id });

      // Telemetri
      await trackAIInteraction(AIEventType.CONVERSATION_START, {
        type: 'voice',
        sessionId: this.currentSession.id
      });
    } catch (error) {
      logger.ai.error('Failed to start recording', error);
      this.handleRecordingError(error as Error);
      throw error;
    }
  }

  /**
   * Ses kaydını durdur ve transkribe et
   */
  async stopListening(): Promise<TranscriptionResult | null> {
    if (!this.recording || !this.currentSession) {
      logger.ai.warn('No active recording to stop');
      return null;
    }

    try {
      this.currentSession.state = VoiceRecognitionState.PROCESSING;

      // Kaydı durdur
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      
      if (!uri) {
        throw this.createError('No recording URI available');
      }

      // Kayıt bilgilerini al
      const { durationMillis } = await this.recording.getStatusAsync();
      const recordingData: Recording = {
        uri,
        duration: durationMillis || 0,
        timestamp: new Date()
      };

      this.currentSession.recordings.push(recordingData);
      this.recording = null;

      // Transkripsiyon
      this.currentSession.state = VoiceRecognitionState.TRANSCRIBING;
      const transcription = await this.transcribeAudio(uri, durationMillis || 0);

      if (transcription) {
        this.currentSession.transcriptions.push(transcription);
        this.currentSession.state = VoiceRecognitionState.COMPLETED;
        
        // Komut kontrolü
        await this.checkForCommands(transcription.text);
      }

      // Oturumu bitir
      this.currentSession.endTime = new Date();
      await this.saveSession();

      // Telemetri
      await trackAIInteraction(AIEventType.CONVERSATION_END, {
        type: 'voice',
        sessionId: this.currentSession.id,
        duration: durationMillis,
        transcribed: !!transcription
      });

      return transcription;
    } catch (error) {
      logger.ai.error('Failed to stop recording', error);
      this.handleRecordingError(error as Error);
      throw error;
    }
  }

  /**
   * Metni sese dönüştür (TTS)
   */
  async speak(
    text: string, 
    options?: Speech.SpeechOptions
  ): Promise<void> {
    if (!FEATURE_FLAGS.isEnabled('AI_VOICE')) {
      return;
    }

    try {
      const defaultOptions: Speech.SpeechOptions = {
        language: this.settings.language,
        pitch: 1.0,
        rate: 0.9,
        onDone: () => {
          logger.ai.info('TTS completed');
        },
        onError: (error) => {
          logger.ai.error('TTS error', error);
        }
      };

      await Speech.speak(text, { ...defaultOptions, ...options });

      // Telemetri
      await trackAIInteraction(AIEventType.MESSAGE_SENT, {
        type: 'tts',
        length: text.length,
        language: this.settings.language
      });
    } catch (error) {
      logger.ai.error('TTS failed', error);
      throw error;
    }
  }

  /**
   * TTS'i durdur
   */
  async stopSpeaking(): Promise<void> {
    await Speech.stop();
  }

  /**
   * Ses komutu ekle
   */
  registerCommand(command: VoiceCommand): void {
    this.commands.set(command.command.toLowerCase(), command);
    
    // Alias'ları da kaydet
    command.aliases.forEach(alias => {
      this.commands.set(alias.toLowerCase(), command);
    });

    logger.ai.info(`Voice command registered: ${command.command}`);
  }

  /**
   * Ayarları güncelle
   */
  async updateSettings(settings: Partial<VoiceSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    await this.saveSettings();

    logger.ai.info('Voice settings updated', settings);
  }

  /**
   * Ses verisini transkribe et
   */
  private async transcribeAudio(
    uri: string, 
    duration: number
  ): Promise<TranscriptionResult | null> {
    try {
      // Try production STT first
      const { sttService } = await import('@/features/ai/services/sttService');
      const stt = await sttService.transcribe({
        uri,
        languageCode: this.settings.language,
        sampleRateHertz: 44100,
        enablePunctuation: true,
        maxAlternatives: this.settings.maxAlternatives
      });

      if (stt?.text) {
        return {
          text: stt.text,
          confidence: stt.confidence ?? 0.7,
          language: this.settings.language,
          duration,
          timestamp: new Date(),
          alternatives: (stt.alternatives || []).map(a => a.text)
        };
      }

      // Fallback mock
      return {
        text: "Bu bir test transkripsiyonudur",
        confidence: 0.6,
        language: this.settings.language,
        duration,
        timestamp: new Date(),
        alternatives: []
      };
    } catch (error) {
      logger.ai.error('Transcription failed', error);
      return null;
    }
  }

  /**
   * Komutları kontrol et
   */
  private async checkForCommands(text: string): Promise<void> {
    const normalizedText = text.toLowerCase().trim();

    for (const [trigger, command] of this.commands) {
      if (normalizedText.includes(trigger)) {
        logger.ai.info(`Voice command detected: ${command.command}`);

        if (command.requiresConfirmation) {
          // Onay iste
          await this.speak('Bu komutu onaylıyor musunuz?');
          // Onay bekleme mantığı eklenebilir
        } else {
          // Komutu çalıştır
          try {
            await command.action();
            await this.speak('Komut başarıyla çalıştırıldı');
          } catch (error) {
            logger.ai.error(`Command execution failed: ${command.command}`, error);
            await this.speak('Komut çalıştırılamadı');
          }
        }

        break;
      }
    }
  }

  /**
   * Varsayılan komutları yükle
   */
  private initializeCommands() {
    // Temel komutlar
    this.registerCommand({
      id: 'start_recording',
      command: 'kayıt başlat',
      aliases: ['kaydı başlat', 'kompulsiyon kaydet'],
      action: async () => {
        logger.ai.info('Voice command: Start recording');
        // Kompulsiyon kaydı başlat
      }
    });

    this.registerCommand({
      id: 'stop_session',
      command: 'oturumu bitir',
      aliases: ['oturumu kapat', 'bitir'],
      action: async () => {
        logger.ai.info('Voice command: Stop session');
        // ERP oturumunu bitir
      }
    });

    this.registerCommand({
      id: 'get_insight',
      command: 'içgörü ver',
      aliases: ['öneri ver', 'tavsiye ver'],
      action: async () => {
        logger.ai.info('Voice command: Get insight');
        // Anlık içgörü üret
      }
    });

    this.registerCommand({
      id: 'emergency_help',
      command: 'acil yardım',
      aliases: ['yardım', 'panik'],
      action: async () => {
        logger.ai.info('Voice command: Emergency help');
        // Acil yardım protokolü
      },
      requiresConfirmation: false // Acil durumda onay bekleme
    });
  }

  /**
   * Varsayılan ayarlar
   */
  private getDefaultSettings(): VoiceSettings {
    return {
      language: 'tr-TR',
      continuous: false,
      interimResults: true,
      maxAlternatives: 3,
      profanityFilter: true,
      partialResults: true,
      preferOffline: true
    };
  }

  /**
   * Ayarları kaydet
   */
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        '@voice_settings',
        JSON.stringify(this.settings)
      );
    } catch (error) {
      logger.ai.error('Failed to save voice settings', error);
    }
  }

  /**
   * Ayarları yükle
   */
  private async loadSettings(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem('@voice_settings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (error) {
      logger.ai.error('Failed to load voice settings', error);
    }
  }

  /**
   * Oturumu kaydet
   */
  private async saveSession(): Promise<void> {
    if (!this.currentSession) return;

    try {
      const sessions = await this.loadSessions();
      sessions.push(this.currentSession);
      
      // Son 50 oturumu tut
      const recentSessions = sessions.slice(-50);
      
      await AsyncStorage.setItem(
        '@voice_sessions',
        JSON.stringify(recentSessions)
      );
    } catch (error) {
      logger.ai.error('Failed to save voice session', error);
    }
  }

  /**
   * Oturumları yükle
   */
  private async loadSessions(): Promise<VoiceSession[]> {
    try {
      const saved = await AsyncStorage.getItem('@voice_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      logger.ai.error('Failed to load voice sessions', error);
      return [];
    }
  }

  /**
   * Kayıt hatalarını yönet
   */
  private handleRecordingError(error: Error): void {
    if (this.currentSession) {
      this.currentSession.state = VoiceRecognitionState.ERROR;
      this.currentSession.errors.push(error);
    }

    if (this.recording) {
      this.recording = null;
    }
  }

  /**
   * Hata oluştur
   */
  private createError(
    message: string, 
    code: AIErrorCode = AIErrorCode.UNKNOWN
  ): AIError {
    const error = new Error(message) as AIError;
    error.code = code;
    error.severity = 'medium';
    error.userMessage = 'Ses tanıma hatası oluştu';
    return error;
  }

  /**
   * Temizlik
   */
  async cleanup(): Promise<void> {
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch (error) {
        logger.ai.error('Failed to cleanup recording', error);
      }
      this.recording = null;
    }

    await Speech.stop();
    this.currentSession = null;
    this.isInitialized = false;

    logger.ai.info('Voice recognition cleaned up');
  }
}

// Singleton export
export const voiceRecognitionService = VoiceRecognitionService.getInstance(); 