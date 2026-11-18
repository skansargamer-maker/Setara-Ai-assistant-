import { LiveState, ToolCallPayload } from '../types/assistant';

export interface LiveClientCallbacks {
  onStateChange?: (state: LiveState) => void;
  onText?: (text: string, isModel: boolean, isFinal?: boolean) => void;
  onAudioData?: (data: { input: Uint8Array; output: Uint8Array }) => void;
  onToolCall?: (toolCall: ToolCallPayload) => void;
  onInterrupt?: () => void;
  onError?: (err: Error) => void;
}

export class LiveClient {
  private state: LiveState = 'disconnected';
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private outputGainNode: GainNode | null = null;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private speakingTimeout: any = null;
  private isMicActive: boolean = false;
  private isMicMuted: boolean = false;
  private isMuted: boolean = false;
  private shouldEnableMicOnReady: boolean = false;
  private micSettings = { noiseSuppression: true, echoCancellation: true };
  private inputBins = new Uint8Array(64);
  private outputBins = new Uint8Array(64);

  public onStateChange?: (state: LiveState) => void;
  public onText?: (text: string, isModel: boolean, isFinal?: boolean) => void;
  public onAudioData?: (data: { input: Uint8Array; output: Uint8Array }) => void;
  public onToolCall?: (toolCall: ToolCallPayload) => void;
  public onInterrupt?: () => void;
  public onError?: (err: Error) => void;

  constructor(callbacks?: LiveClientCallbacks) {
    if (callbacks) {
      this.onStateChange = callbacks.onStateChange;
      this.onText = callbacks.onText;
      this.onAudioData = callbacks.onAudioData;
      this.onToolCall = callbacks.onToolCall;
      this.onInterrupt = callbacks.onInterrupt;
      this.onError = callbacks.onError;
    }
  }

  public getState(): LiveState {
    return this.state;
  }

  private setState(newState: LiveState) {
    this.state = newState;
    this.onStateChange?.(newState);
  }

  public getIsMicActive(): boolean {
    return this.isMicActive;
  }

  public getIsMicMuted(): boolean {
    return this.isMicMuted;
  }

  public setMicMuted(muted: boolean) {
    this.isMicMuted = muted;
    if (this.mediaStream) {
      try {
        this.mediaStream.getAudioTracks().forEach((track) => {
          track.enabled = !muted;
        });
      } catch (e) {
        console.warn('Error toggling mic tracks', e);
      }
    }
  }

  public setOutputMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.outputGainNode) {
      this.outputGainNode.gain.value = muted ? 0 : 1;
    }
  }

  public getIsOutputMuted(): boolean {
    return this.isMuted;
  }

  public async connect(
    arg1?: boolean | string,
    arg2?: any,
    arg3: boolean = true,
    arg4?: any
  ): Promise<void> {
    let historyText = '';
    let userInfo: any = undefined;
    let autoStartMic = true;
    let settings: any = undefined;

    if (typeof arg1 === 'boolean') {
      autoStartMic = arg1;
      settings = arg2;
    } else if (typeof arg1 === 'string') {
      historyText = arg1;
      userInfo = arg2;
      autoStartMic = arg3 ?? true;
      settings = arg4;
    } else if (typeof arg1 === 'object' && arg1 !== null) {
      settings = arg1;
    }

    this.shouldEnableMicOnReady = autoStartMic;
    if (settings) {
      this.micSettings = {
        noiseSuppression: settings.micNoiseSuppression ?? true,
        echoCancellation: settings.micEchoCancellation ?? true,
      };
      this.isMuted = settings.voiceOutput === false;
    }

    if (this.state !== 'disconnected') {
      if (autoStartMic && !this.isMicActive) {
        await this.startLiveMic();
      }
      return;
    }

    this.setState('connecting');

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }

      this.nextStartTime = 0;
      this.outputGainNode = this.outputAudioCtx.createGain();
      this.outputGainNode.gain.value = this.isMuted ? 0 : 1;
      this.outputGainNode.connect(this.outputAudioCtx.destination);

      this.outputAnalyser = this.outputAudioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 128;
      this.outputAnalyser.smoothingTimeConstant = 0.72;
      this.outputAnalyser.connect(this.outputGainNode);

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/live`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = async () => {
        this.ws?.send(
          JSON.stringify({
            type: 'init',
            history: historyText,
            userInfo,
            settings,
          })
        );
      };

      this.ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'ready') {
            this.setState('listening');
            if (this.shouldEnableMicOnReady) {
              await this.startLiveMic();
            }
          }

          if (msg.audio) {
            this.setState('speaking');
            this.playAudioChunk(msg.audio);
          }

          if (msg.interrupted) {
            this.handleInterrupt();
            this.setState('listening');
            this.onInterrupt?.();
          }

          if (msg.text) {
            this.onText?.(msg.text, !!msg.isModel, msg.isFinal);
          }

          if (msg.toolCall) {
            this.onToolCall?.(msg.toolCall);
          }
        } catch (err) {
          console.error('Error processing live WebSocket message', err);
        }
      };

      this.ws.onclose = () => {
        this.disconnect();
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket connection error:', err);
        this.onError?.(new Error('Live connection interrupted.'));
        this.disconnect();
      };
    } catch (err: any) {
      console.error('Connection setup failed:', err);
      this.onError?.(err instanceof Error ? err : new Error(String(err)));
      this.disconnect();
    }
  }

  public async startLiveMic(): Promise<void> {
    this.shouldEnableMicOnReady = true;
    if (this.isMicActive) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.inputAudioCtx || this.inputAudioCtx.state === 'closed') {
        this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      }
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: this.micSettings.echoCancellation,
          noiseSuppression: this.micSettings.noiseSuppression,
          autoGainControl: true,
        },
      });

      this.source = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      this.processor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);
      this.inputAnalyser = this.inputAudioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 128;
      this.inputAnalyser.smoothingTimeConstant = 0.72;

      this.source.connect(this.inputAnalyser);
      this.source.connect(this.processor);

      const silenceGain = this.inputAudioCtx.createGain();
      silenceGain.gain.value = 0;
      this.processor.connect(silenceGain);
      silenceGain.connect(this.inputAudioCtx.destination);

      this.processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (
          this.ws?.readyState === WebSocket.OPEN &&
          this.isMicActive &&
          !this.isMicMuted
        ) {
          const inputData = e.inputBuffer.getChannelData(0);
          const base64Audio = this.pcmToBase64(inputData);
          this.ws.send(JSON.stringify({ audio: base64Audio }));
        }
      };

      this.isMicActive = true;
      this.isMicMuted = false;
      this.setState(this.state === 'speaking' ? 'speaking' : 'listening');
    } catch (err: any) {
      this.isMicActive = false;
      this.isMicMuted = false;
      this.shouldEnableMicOnReady = false;
      console.error('Microphone access failed:', err);
      this.onError?.(
        new Error('Microphone permission denied or device not found. Please allow microphone access.')
      );
    }
  }

  public stopLiveMic(): void {
    this.shouldEnableMicOnReady = false;
    this.isMicActive = false;
    this.isMicMuted = false;

    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {
        /* ignore */
      }
      this.processor = null;
    }

    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        /* ignore */
      }
      this.source = null;
    }

    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch {
        /* ignore */
      }
      this.mediaStream = null;
    }
  }

  public sendTextMessage(text: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'text', text }));
    }
  }

  public playAudioChunk(base64Pcm: string): void {
    if (!this.outputAudioCtx || !this.outputAnalyser) return;

    try {
      const binary = atob(base64Pcm);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const int16View = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16View.length);
      for (let i = 0; i < int16View.length; i++) {
        float32[i] = int16View[i] / 32768.0;
      }

      const buffer = this.outputAudioCtx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const sourceNode = this.outputAudioCtx.createBufferSource();
      sourceNode.buffer = buffer;
      sourceNode.connect(this.outputAnalyser);

      sourceNode.onended = () => {
        this.activeSources = this.activeSources.filter((s) => s !== sourceNode);
      };

      if (this.nextStartTime < this.outputAudioCtx.currentTime) {
        this.nextStartTime = this.outputAudioCtx.currentTime + 0.05;
      }

      sourceNode.start(this.nextStartTime);
      this.activeSources.push(sourceNode);
      this.nextStartTime += buffer.duration;

      this.resetSpeakingTimeout();
    } catch (err) {
      console.error('Error playing received PCM audio chunk', err);
    }
  }

  private resetSpeakingTimeout(): void {
    if (this.speakingTimeout) clearTimeout(this.speakingTimeout);
    this.speakingTimeout = setTimeout(() => {
      if (this.state === 'speaking') {
        this.setState(this.isMicActive ? 'listening' : 'disconnected');
      }
    }, 1200);
  }

  public handleInterrupt(): void {
    this.activeSources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    });
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
  }

  public getAudioFrequencyData(): { input: Uint8Array; output: Uint8Array } {
    const inCount = this.inputAnalyser ? this.inputAnalyser.frequencyBinCount : 32;
    const outCount = this.outputAnalyser ? this.outputAnalyser.frequencyBinCount : 32;

    const inputArr = new Uint8Array(inCount);
    const outputArr = new Uint8Array(outCount);

    if (this.inputAnalyser && (this.state === 'listening' || this.state === 'connecting')) {
      this.inputAnalyser.getByteFrequencyData(inputArr);
    }

    if (this.outputAnalyser && this.state === 'speaking') {
      this.outputAnalyser.getByteFrequencyData(outputArr);
    }

    return { input: inputArr, output: outputArr };
  }

  public getAudioLevels(): { inputLevel: number; outputLevel: number; bands: number[] } {
    let inputLevel = 0;
    let outputLevel = 0;
    const bands = [0, 0, 0, 0, 0, 0, 0, 0];

    if (this.inputAnalyser && this.isMicActive && !this.isMicMuted) {
      this.inputAnalyser.getByteFrequencyData(this.inputBins);
      let sum = 0;
      const vocalBins = Math.min(this.inputBins.length, 20);
      for (let i = 1; i < vocalBins; i++) sum += this.inputBins[i];
      inputLevel = Math.min(1, sum / ((vocalBins - 1) * 145));
      for (let b = 0; b < 8; b++) {
        const idx = 1 + b * 2;
        const val = ((this.inputBins[idx] || 0) + (this.inputBins[idx + 1] || 0)) / 2;
        bands[b] = Math.max(bands[b], Math.min(1, val / 170));
      }
    }

    if (this.outputAnalyser && this.state === 'speaking') {
      this.outputAnalyser.getByteFrequencyData(this.outputBins);
      let sum = 0;
      const vocalBins = Math.min(this.outputBins.length, 20);
      for (let i = 1; i < vocalBins; i++) sum += this.outputBins[i];
      outputLevel = Math.min(1, sum / ((vocalBins - 1) * 145));
      for (let b = 0; b < 8; b++) {
        const idx = 1 + b * 2;
        const val = ((this.outputBins[idx] || 0) + (this.outputBins[idx + 1] || 0)) / 2;
        bands[b] = Math.max(bands[b], Math.min(1, val / 170));
      }
    }

    return { inputLevel, outputLevel, bands };
  }

  public pcmToBase64(floatData: Float32Array): string {
    const buffer = new ArrayBuffer(floatData.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < floatData.length; i++) {
      let s = Math.max(-1, Math.min(1, floatData[i]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(i * 2, s, true);
    }
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  public disconnect(): void {
    this.stopLiveMic();

    if (this.state !== 'disconnected') {
      this.setState('disconnected');
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }

    this.handleInterrupt();

    if (this.speakingTimeout) {
      clearTimeout(this.speakingTimeout);
      this.speakingTimeout = null;
    }
  }
}
