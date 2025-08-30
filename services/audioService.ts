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
   * 🔄 Preload sound effects (simplified - haptics only)
   */
  async preloadSounds(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🎵 Preloading voice check-in sound effects...');

      // Simple haptic-based system - more reliable than complex audio generation
      this.isInitialized = true;
      console.log('✅ Voice check-in sounds preloaded (haptic mode)');

    } catch (error) {
      console.error('❌ Sound preload failed:', error);
    }
  }

  /**
   * 🔔 Play start recording sound (ding) - Simplified
   */
  async playStartSound(): Promise<void> {
    try {
      // Enhanced haptic feedback for "ding" effect
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }, 50);

      console.log('🔔 Ding! Recording started (haptic)');
    } catch (error) {
      console.warn('⚠️ Start sound failed:', error);
      // Final fallback
      Haptics.selectionAsync();
    }
  }

  /**
   * 🔕 Play stop recording sound (dong) - Simplified  
   */
  async playStopSound(): Promise<void> {
    try {
      // Enhanced haptic feedback for "dong" effect
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }, 100);

      console.log('🔕 Dong! Recording stopped (haptic)');
    } catch (error) {
      console.warn('⚠️ Stop sound failed:', error);
      // Final fallback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  // 🎵 Simplified audio service - complex audio generation removed
  // Focus on reliable haptic feedback instead

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
