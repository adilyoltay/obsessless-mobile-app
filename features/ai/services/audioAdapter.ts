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
    try {
      // Prefer expo-av API if available
      const AudioObj = this.AudioMod?.Audio;
      if (this.impl === 'expo-av' && AudioObj) {
        if (typeof AudioObj.requestPermissionsAsync === 'function') {
          return await AudioObj.requestPermissionsAsync();
        }
        if (typeof AudioObj.getPermissionsAsync === 'function') {
          const res = await AudioObj.getPermissionsAsync();
          if (res?.granted !== undefined) return res;
        }
      }

      // expo-audio or other shapes
      const perms = this.AudioMod?.Audio?.requestPermissionsAsync || this.AudioMod?.requestPermissionsAsync;
      if (typeof perms === 'function') {
        return await perms();
      }

      // Ultimate fallback: assume granted to avoid hard crash. Actual recording will still fail gracefully if not permitted.
      return { granted: true } as any;
    } catch (e) {
      return { granted: true } as any;
    }
  }

  async setModeAsync(options: any) {
    if (!this.AudioMod) await this.initialize();
    try {
      const AudioObj = this.AudioMod?.Audio;
      if (this.impl === 'expo-av' && AudioObj?.setAudioModeAsync) {
        return await AudioObj.setAudioModeAsync(options);
      }
      const setMode = this.AudioMod?.Audio?.setModeAsync || this.AudioMod?.setModeAsync;
      return setMode ? await setMode(options) : undefined;
    } catch {
      return undefined;
    }
  }

  async createRecording(): Promise<RecordingHandle> {
    if (!this.AudioMod) await this.initialize();
    try {
      const AudioObj = this.AudioMod?.Audio;
      if (this.impl === 'expo-av' && AudioObj?.Recording) {
        const rec = new AudioObj.Recording();
        return new ExpoAVRecordingHandle(rec);
      }
      const Recorder = this.AudioMod?.Audio?.Recording || this.AudioMod?.Recording;
      if (Recorder) {
        const rec = new (Recorder as any)();
        if (!(rec as any).prepareAsync && (rec as any).prepareToRecordAsync) {
          (rec as any).prepareAsync = (rec as any).prepareToRecordAsync.bind(rec);
        }
        if (!(rec as any).getStatusAsync) {
          (rec as any).getStatusAsync = async () => ({ durationMillis: ((rec as any).getDurationMillis?.() || 0) });
        }
        return rec as unknown as RecordingHandle;
      }
      const av = await import('expo-av');
      const rec = new av.Audio.Recording();
      return new ExpoAVRecordingHandle(rec);
    } catch {
      const av = await import('expo-av');
      const rec = new av.Audio.Recording();
      return new ExpoAVRecordingHandle(rec);
    }
  }

  async getDefaultRecordingOptions(): Promise<any> {
    if (!this.AudioMod) await this.initialize();
    if (this.impl === 'expo-av') {
      const { Audio } = this.AudioMod;
      // LOW_QUALITY preset - otomatik olarak en küçük boyutu verir
      return Audio.RecordingOptionsPresets.LOW_QUALITY;
    }
    // expo-audio: let the module choose sensible defaults
    return {};
  }
}

export const audio = new AudioAdapter();
