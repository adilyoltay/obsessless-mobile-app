/* Cross-compatible Audio adapter: prefers expo-audio, falls back to expo-av */

export type RecordingStatus = { durationMillis?: number };

export interface RecordingHandle {
  prepareAsync(options: any): Promise<void>;
  startAsync(): Promise<void>;
  stopAndUnloadAsync(): Promise<void>;
  getURI(): string | null;
  getStatusAsync(): Promise<RecordingStatus>;
}

class ExpoAVRecordingHandle implements RecordingHandle {
  private rec: any;
  constructor(rec: any) { this.rec = rec; }
  async prepareAsync(options: any) { await this.rec.prepareToRecordAsync(options); }
  async startAsync() { await this.rec.startAsync(); }
  async stopAndUnloadAsync() { await this.rec.stopAndUnloadAsync(); }
  getURI(): string | null { return this.rec.getURI(); }
  async getStatusAsync(): Promise<RecordingStatus> { return this.rec.getStatusAsync(); }
}

class AudioAdapter {
  private impl: 'expo-audio' | 'expo-av' = 'expo-av';
  private AudioMod: any = null;

  async initialize(): Promise<void> {
    try {
      // Attempt to load expo-audio (SDK 54+)
      this.AudioMod = await import('expo-audio').catch(() => null);
      if (this.AudioMod && (this.AudioMod.Audio || this.AudioMod.Recording)) {
        this.impl = 'expo-audio';
        return;
      }
    } catch {}
    // Fallback to expo-av
    const mod = await import('expo-av');
    this.AudioMod = mod;
    this.impl = 'expo-av';
  }

  async requestPermissionsAsync() {
    if (!this.AudioMod) await this.initialize();
    if (this.impl === 'expo-av') {
      return this.AudioMod.Audio.requestPermissionsAsync();
    }
    const perms = this.AudioMod.Audio?.requestPermissionsAsync || this.AudioMod.requestPermissionsAsync;
    return perms ? perms() : { granted: true };
  }

  async setModeAsync(options: any) {
    if (!this.AudioMod) await this.initialize();
    if (this.impl === 'expo-av') {
      return this.AudioMod.Audio.setAudioModeAsync(options);
    }
    const setMode = this.AudioMod.Audio?.setModeAsync || this.AudioMod.setModeAsync;
    return setMode ? setMode(options) : undefined;
  }

  async createRecording(): Promise<RecordingHandle> {
    if (!this.AudioMod) await this.initialize();
    if (this.impl === 'expo-av') {
      const rec = new this.AudioMod.Audio.Recording();
      return new ExpoAVRecordingHandle(rec);
    }
    const Recorder = this.AudioMod.Audio?.Recording || this.AudioMod.Recording;
    if (Recorder) {
      const rec = new Recorder();
      if (!rec.prepareAsync && rec.prepareToRecordAsync) {
        rec.prepareAsync = rec.prepareToRecordAsync.bind(rec);
      }
      if (!rec.getStatusAsync) {
        rec.getStatusAsync = async () => ({ durationMillis: (rec.getDurationMillis?.() || 0) });
      }
      return rec as unknown as RecordingHandle;
    }
    const av = await import('expo-av');
    const rec = new av.Audio.Recording();
    return new ExpoAVRecordingHandle(rec);
  }

  async getDefaultRecordingOptions(): Promise<any> {
    if (!this.AudioMod) await this.initialize();
    if (this.impl === 'expo-av') {
      const { Audio } = this.AudioMod;
      return {
        android: {
          extension: '.webm',
          outputFormat: Audio.AndroidOutputFormat.WEBM,
          audioEncoder: Audio.AndroidAudioEncoder.OPUS,
          sampleRate: 48000,
          numberOfChannels: 1,
          bitRate: 96000
        },
        ios: {
          extension: '.wav',
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 256000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false
        },
        web: {}
      };
    }
    // expo-audio: let the module choose sensible defaults
    return {};
  }
}

export const audio = new AudioAdapter();
