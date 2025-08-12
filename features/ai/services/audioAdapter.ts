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
      if (this.AudioMod && this.AudioMod.Audio) {
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
    // expo-audio hypothetical permissions
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
    // Generic minimal wrapper for expo-audio recording
    const Recorder = this.AudioMod.Audio?.Recording || this.AudioMod.Recording;
    if (Recorder) {
      const rec = new Recorder();
      // Ensure method compat
      if (!rec.prepareAsync && rec.prepareToRecordAsync) {
        rec.prepareAsync = rec.prepareToRecordAsync.bind(rec);
      }
      if (!rec.getStatusAsync) {
        rec.getStatusAsync = async () => ({ durationMillis: (rec.getDurationMillis?.() || 0) });
      }
      return rec as unknown as RecordingHandle;
    }
    // Fallback to expo-av as last resort
    const av = await import('expo-av');
    const rec = new av.Audio.Recording();
    return new ExpoAVRecordingHandle(rec);
  }
}

export const audio = new AudioAdapter();
