import { VoiceName } from '../types/assistant';

export interface TtsAudioLevels {
  inputLevel: number;
  outputLevel: number;
  bands: number[];
}

class TtsAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private bins = new Uint8Array(64);
  private playing = false;
  private onEndCallback: (() => void) | null = null;
  private abortController: AbortController | null = null;

  private ensureContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume();
    }
    if (!this.analyser) {
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.72;
      this.analyser.connect(this.audioCtx.destination);
    }
    return this.audioCtx;
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public stop(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.currentSource) {
      try {
        this.currentSource.onended = null;
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        /* ignore */
      }
      this.currentSource = null;
    }
    const cb = this.onEndCallback;
    this.onEndCallback = null;
    this.playing = false;
    cb?.();
  }

  public async speak(
    text: string,
    voice: VoiceName,
    options?: {
      language?: string;
      speechSpeed?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (msg: string) => void;
    }
  ): Promise<void> {
    this.stop();
    const cleanText = text.trim();
    if (!cleanText) {
      options?.onEnd?.();
      return;
    }

    const controller = new AbortController();
    this.abortController = controller;
    this.onEndCallback = options?.onEnd || null;

    try {
      const ctx = this.ensureContext();
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          voice,
          language: options?.language || 'English',
        }),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.audioBase64) {
        throw new Error(data?.error || 'Unable to synthesize voice preview.');
      }

      if (controller.signal.aborted) return;

      const binary = atob(data.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
      if (controller.signal.aborted) return;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      const rate = Math.min(1.5, Math.max(0.75, options?.speechSpeed ?? 1.0));
      source.playbackRate.value = rate;
      if (this.analyser) {
        source.connect(this.analyser);
      } else {
        source.connect(ctx.destination);
      }

      this.currentSource = source;
      this.playing = true;
      options?.onStart?.();

      source.onended = () => {
        if (this.currentSource === source) {
          this.currentSource = null;
          this.playing = false;
          const cb = this.onEndCallback;
          this.onEndCallback = null;
          cb?.();
        }
      };

      source.start(0);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      this.playing = false;
      this.currentSource = null;
      const cb = this.onEndCallback;
      this.onEndCallback = null;
      options?.onError?.(err?.message || 'Voice playback failed.');
      cb?.();
    }
  }

  public async play(options: {
    text: string;
    voice: VoiceName;
    speechSpeed?: number;
    language?: string;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: Error) => void;
  }): Promise<void> {
    return this.speak(options.text, options.voice, {
      language: options.language,
      speechSpeed: options.speechSpeed,
      onStart: options.onStart,
      onEnd: options.onEnd,
      onError: (msg) => options.onError?.(new Error(msg)),
    });
  }

  public getOutputLevels(): TtsAudioLevels {
    if (!this.playing || !this.analyser) {
      return { inputLevel: 0, outputLevel: 0, bands: [0, 0, 0, 0, 0, 0, 0, 0] };
    }
    this.analyser.getByteFrequencyData(this.bins);
    let sum = 0;
    const vocalMaxBin = Math.min(this.bins.length, 20);
    for (let i = 1; i < vocalMaxBin; i++) {
      sum += this.bins[i];
    }
    const outputLevel = Math.min(1, sum / ((vocalMaxBin - 1) * 145));
    const bands: number[] = [];
    for (let b = 0; b < 8; b++) {
      const idx = 1 + b * 2;
      const val = ((this.bins[idx] || 0) + (this.bins[idx + 1] || 0)) / 2;
      bands.push(Math.min(1, val / 180));
    }
    return { inputLevel: 0, outputLevel, bands };
  }
}

export const ttsPlayer = new TtsAudioPlayer();
