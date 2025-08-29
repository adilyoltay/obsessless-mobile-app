/**
 * Audio Service - Voice Check-in Sound Effects
 * 
 * iPhone tarzı ding/dong ses efektleri yönetimi
 */

import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

interface AudioService {
  playStartSound: () => Promise<void>;
  playStopSound: () => Promise<void>;
  preloadSounds: () => Promise<void>;
  cleanup: () => Promise<void>;
}

class AudioServiceImpl implements AudioService {
  private startSound: Audio.Sound | null = null;
  private stopSound: Audio.Sound | null = null;
  private isInitialized = false;

  /**
   * 🔄 Preload sound effects
   */
  async preloadSounds(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🎵 Preloading voice check-in sound effects...');

      // Configure audio for concurrent sounds
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create audio objects with embedded base64 sounds (iOS system-like)
      this.startSound = new Audio.Sound();
      this.stopSound = new Audio.Sound();

      // Load start sound (higher pitch ding)
      await this.startSound.loadAsync({
        uri: this.generateDingSound(800, 0.15), // 800Hz, 150ms
      });

      // Load stop sound (lower pitch dong) 
      await this.stopSound.loadAsync({
        uri: this.generateDongSound(400, 0.2), // 400Hz, 200ms
      });

      this.isInitialized = true;
      console.log('✅ Voice check-in sounds preloaded');

    } catch (error) {
      console.error('❌ Sound preload failed:', error);
    }
  }

  /**
   * 🔔 Play start recording sound (ding)
   */
  async playStartSound(): Promise<void> {
    try {
      // Haptic feedback first (immediate)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (this.startSound) {
        await this.startSound.setPositionAsync(0);
        await this.startSound.playAsync();
      } else {
        // Fallback: generate and play inline
        await this.playGeneratedTone(800, 150);
      }

      console.log('🔔 Ding! Recording started');
    } catch (error) {
      console.warn('⚠️ Start sound failed:', error);
      // Fallback to haptic only
      Haptics.selectionAsync();
    }
  }

  /**
   * 🔕 Play stop recording sound (dong)
   */
  async playStopSound(): Promise<void> {
    try {
      // Haptic feedback first (immediate)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      if (this.stopSound) {
        await this.stopSound.setPositionAsync(0);
        await this.stopSound.playAsync();
      } else {
        // Fallback: generate and play inline
        await this.playGeneratedTone(400, 200);
      }

      console.log('🔕 Dong! Recording stopped');
    } catch (error) {
      console.warn('⚠️ Stop sound failed:', error);
      // Fallback to haptic only
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  /**
   * 🎵 Generate ding sound (high pitch, quick)
   */
  private generateDingSound(frequency: number, duration: number): string {
    // Generate simple sine wave for iOS-like ding
    // This is a placeholder - in production, use actual audio files
    const sampleRate = 44100;
    const samples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const envelope = Math.max(0, 1 - (i / samples)); // Fade out
      buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * envelope * 0.3;
    }

    // Convert to data URI (simplified - actual implementation would be more complex)
    return `data:audio/wav;base64,${this.audioBufferToBase64(buffer, sampleRate)}`;
  }

  /**
   * 🎵 Generate dong sound (low pitch, longer)
   */
  private generateDongSound(frequency: number, duration: number): string {
    const sampleRate = 44100;
    const samples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const envelope = Math.max(0, 1 - (i / samples) * 0.8); // Slower fade
      buffer[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * envelope * 0.4;
    }

    return `data:audio/wav;base64,${this.audioBufferToBase64(buffer, sampleRate)}`;
  }

  /**
   * 🎼 Play generated tone (fallback)
   */
  private async playGeneratedTone(frequency: number, duration: number): Promise<void> {
    try {
      const sound = new Audio.Sound();
      const uri = frequency > 600 
        ? this.generateDingSound(frequency, duration / 1000)
        : this.generateDongSound(frequency, duration / 1000);
      
      await sound.loadAsync({ uri });
      await sound.playAsync();
      
      // Auto cleanup
      setTimeout(async () => {
        await sound.unloadAsync();
      }, duration + 100);

    } catch (error) {
      console.warn('Generated tone playback failed:', error);
    }
  }

  /**
   * 📊 Convert audio buffer to base64 (simplified WAV)
   */
  private audioBufferToBase64(buffer: Float32Array, sampleRate: number): string {
    // Simplified WAV generation - in production, use proper audio library
    const header = this.createWAVHeader(buffer.length, sampleRate);
    const data = new Int16Array(buffer.length);
    
    // Convert float32 to int16
    for (let i = 0; i < buffer.length; i++) {
      data[i] = Math.max(-32768, Math.min(32767, buffer[i] * 32768));
    }

    // Combine header + data (simplified)
    const combined = new Uint8Array(header.length + data.byteLength);
    combined.set(header, 0);
    combined.set(new Uint8Array(data.buffer), header.length);

    // Convert to base64 (this is a placeholder - use proper base64 encoding)
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * 🎧 Create WAV header
   */
  private createWAVHeader(dataLength: number, sampleRate: number): Uint8Array {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    
    // WAV header (simplified)
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength * 2, true);

    return new Uint8Array(header);
  }

  /**
   * 🧹 Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.startSound) {
        await this.startSound.unloadAsync();
        this.startSound = null;
      }
      
      if (this.stopSound) {
        await this.stopSound.unloadAsync();
        this.stopSound = null;
      }

      this.isInitialized = false;
      console.log('🧹 Audio service cleaned up');
    } catch (error) {
      console.error('Audio cleanup failed:', error);
    }
  }
}

// Singleton instance
const audioService = new AudioServiceImpl();

export default audioService;

/**
 * 🎵 Simple audio hooks for components
 */
export const useVoiceCheckInAudio = () => {
  return {
    playStartSound: audioService.playStartSound,
    playStopSound: audioService.playStopSound,
    preload: audioService.preloadSounds,
    cleanup: audioService.cleanup,
  };
};
