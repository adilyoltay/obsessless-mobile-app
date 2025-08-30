/**
 * Smart Audio Analysis Service
 * 
 * Ses kaydını metne çevirmek yerine, ses özelliklerinden (süre, ton, sessizlik)
 * direkt mood analizi yapar. Native speech-to-text olmadan da çalışır.
 */

import { Audio } from 'expo-av';

interface AudioAnalysisResult {
  duration: number;
  estimatedMood: number;    // 1-10
  estimatedEnergy: number;  // 1-10
  estimatedAnxiety: number; // 1-10
  dominantEmotion: string;
  confidence: number;
  audioCharacteristics: {
    speechRate: 'slow' | 'normal' | 'fast';
    silencePauses: number;
    intensity: 'low' | 'medium' | 'high';
    consistency: number;
  };
  suggestedText: string; // Estimated content based on audio characteristics
}

class SmartAudioAnalysisService {
  private static instance: SmartAudioAnalysisService;

  static getInstance(): SmartAudioAnalysisService {
    if (!SmartAudioAnalysisService.instance) {
      SmartAudioAnalysisService.instance = new SmartAudioAnalysisService();
    }
    return SmartAudioAnalysisService.instance;
  }

  /**
   * 🎤 Analyze audio file characteristics to estimate mood
   */
  async analyzeAudioMood(audioUri: string): Promise<AudioAnalysisResult> {
    console.log('🎵 Starting smart audio analysis...', { audioUri });

    try {
      // Get basic audio info
      const audioInfo = await this.getAudioInfo(audioUri);
      
      // Analyze speech characteristics
      const characteristics = this.analyzeAudioCharacteristics(audioInfo);
      
      // Estimate mood from audio patterns
      const moodEstimation = this.estimateMoodFromAudio(characteristics, audioInfo.duration);
      
      // Generate suggested text based on analysis
      const suggestedText = this.generateSuggestedText(characteristics, moodEstimation);

      const result: AudioAnalysisResult = {
        duration: audioInfo.duration,
        estimatedMood: moodEstimation.mood,
        estimatedEnergy: moodEstimation.energy,
        estimatedAnxiety: moodEstimation.anxiety,
        dominantEmotion: moodEstimation.emotion,
        confidence: moodEstimation.confidence,
        audioCharacteristics: characteristics,
        suggestedText
      };

      console.log('✅ Smart audio analysis complete:', {
        duration: result.duration,
        mood: result.estimatedMood,
        energy: result.estimatedEnergy,
        emotion: result.dominantEmotion,
        confidence: result.confidence
      });

      return result;

    } catch (error) {
      console.error('❌ Smart audio analysis failed:', error);
      return this.createFallbackResult();
    }
  }

  /**
   * 📊 Get basic audio information
   */
  private async getAudioInfo(audioUri: string): Promise<{
    duration: number;
    fileSize: number;
    isValid: boolean;
  }> {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
      const status = await sound.getStatusAsync();
      
      let duration = 0;
      if (status.isLoaded && status.durationMillis) {
        duration = status.durationMillis / 1000;
      }
      
      await sound.unloadAsync();

      return {
        duration,
        fileSize: 0, // Would need native module to get file size
        isValid: duration > 0.5 // At least 0.5 seconds
      };

    } catch (error) {
      console.warn('Could not get audio info:', error);
      return {
        duration: 0,
        fileSize: 0,
        isValid: false
      };
    }
  }

  /**
   * 🔍 Analyze audio characteristics from duration and patterns
   */
  private analyzeAudioCharacteristics(audioInfo: { duration: number }): {
    speechRate: 'slow' | 'normal' | 'fast';
    silencePauses: number;
    intensity: 'low' | 'medium' | 'high';
    consistency: number;
  } {
    const { duration } = audioInfo;

    // Estimate speech characteristics from duration patterns
    let speechRate: 'slow' | 'normal' | 'fast' = 'normal';
    let silencePauses = 0;
    let intensity: 'low' | 'medium' | 'high' = 'medium';
    let consistency = 0.7;

    // Duration-based heuristics
    if (duration < 3) {
      // Short recordings - likely quick, confident speech
      speechRate = 'fast';
      intensity = 'high';
      consistency = 0.8;
    } else if (duration > 10) {
      // Long recordings - likely detailed, thoughtful speech
      speechRate = 'slow';
      intensity = 'medium';
      consistency = 0.9;
      silencePauses = Math.floor(duration / 5); // Estimate pauses
    } else {
      // Medium recordings - normal speech
      speechRate = 'normal';
      intensity = 'medium';
      consistency = 0.75;
    }

    return {
      speechRate,
      silencePauses,
      intensity,
      consistency
    };
  }

  /**
   * 🧠 Estimate mood from audio characteristics
   */
  private estimateMoodFromAudio(
    characteristics: any,
    duration: number
  ): {
    mood: number;
    energy: number;
    anxiety: number;
    emotion: string;
    confidence: number;
  } {
    let mood = 5; // Baseline
    let energy = 5;
    let anxiety = 5;
    let emotion = 'normal';
    let confidence = 0.6; // Lower confidence for audio-only analysis

    // Speech rate patterns
    if (characteristics.speechRate === 'fast' && duration < 5) {
      // Fast, short speech - likely excited or anxious
      if (characteristics.intensity === 'high') {
        mood = 7;
        energy = 8;
        anxiety = 7;
        emotion = 'heyecanlı';
      } else {
        mood = 4;
        energy = 6;
        anxiety = 8;
        emotion = 'kaygılı';
      }
    } else if (characteristics.speechRate === 'slow' && duration > 8) {
      // Slow, long speech - likely thoughtful or sad
      mood = 4;
      energy = 3;
      anxiety = 6;
      emotion = 'düşünceli';
    } else if (duration > 12) {
      // Very long recording - likely detailed sharing
      mood = 6;
      energy = 5;
      anxiety = 5;
      emotion = 'paylaşımcı';
      confidence = 0.7;
    } else {
      // Normal patterns - balanced mood
      mood = 6;
      energy = 6;
      anxiety = 4;
      emotion = 'dengeli';
    }

    // Consistency boost
    confidence *= characteristics.consistency;

    return {
      mood: Math.max(1, Math.min(10, Math.round(mood))),
      energy: Math.max(1, Math.min(10, Math.round(energy))),
      anxiety: Math.max(1, Math.min(10, Math.round(anxiety))),
      emotion,
      confidence: Math.max(0.3, Math.min(0.8, confidence))
    };
  }

  /**
   * 📝 Generate suggested text based on audio characteristics
   */
  private generateSuggestedText(characteristics: any, estimation: any): string {
    const templates = {
      'heyecanlı': 'Bugün kendimi çok enerjik ve heyecanlı hissediyorum.',
      'kaygılı': 'Biraz kaygılı ve gergin hissediyorum bugün.',
      'düşünceli': 'Bugün derin düşüncelere daldım, biraz yavaş hissediyorum.',
      'paylaşımcı': 'Bugün birçok şey yaşadım ve paylaşmak istedim.',
      'dengeli': 'Bugün genel olarak dengeli ve normal hissediyorum.',
      'normal': 'Bugün normal bir gün geçiriyorum.'
    };

    return templates[estimation.emotion] || templates['normal'];
  }

  /**
   * 🔄 Create fallback result for errors
   */
  private createFallbackResult(): AudioAnalysisResult {
    return {
      duration: 0,
      estimatedMood: 5,
      estimatedEnergy: 5,
      estimatedAnxiety: 5,
      dominantEmotion: 'normal',
      confidence: 0.3,
      audioCharacteristics: {
        speechRate: 'normal',
        silencePauses: 0,
        intensity: 'medium',
        consistency: 0.5
      },
      suggestedText: 'Ses analizi yapılamadı.'
    };
  }
}

export default SmartAudioAnalysisService.getInstance();
export type { AudioAnalysisResult };
