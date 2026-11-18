import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { OrbState } from '../types/assistant';

interface AudioLevelPayload {
  inputLevel: number;
  outputLevel: number;
  bands: number[];
}

interface AIOrbProps {
  state: OrbState;
  orbStyle?: 'ocean' | 'aurora' | 'monochrome';
  reducedMotion?: boolean;
  getAudioLevels?: () => AudioLevelPayload;
  onClick?: () => void;
}

export const AIOrb: React.FC<AIOrbProps> = ({
  state,
  reducedMotion = false,
  getAudioLevels,
  onClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<OrbState>(state);
  const reducedMotionRef = useRef(reducedMotion);
  const audioFnRef = useRef(getAudioLevels);

  stateRef.current = state;
  reducedMotionRef.current = reducedMotion;
  audioFnRef.current = getAudioLevels;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let phase = 0;
    let rotation = 0;
    let smoothLevel = 0;
    let smoothScale = 1.0;
    let smoothWaveAmp = 0.025;
    let smoothAuraGlow = 0.38;
    const smoothBands = new Float32Array(8);

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const targetW = Math.max(300, Math.round(rect.width * dpr));
      const targetH = Math.max(300, Math.round(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const render = () => {
      animId = requestAnimationFrame(render);
      resizeCanvas();

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const minDim = Math.min(w, h);
      // Base radius proportioned to leave generous breathing room for organic fluid wave ripples
      const baseRadius = minDim * 0.25;

      ctx.clearRect(0, 0, w, h);

      const curState = stateRef.current;
      const isReduced = reducedMotionRef.current;

      // Real-time audio sampling from live mic or neural TTS
      let targetLevel = 0;
      const targetBands = [0, 0, 0, 0, 0, 0, 0, 0];

      if (audioFnRef.current) {
        const { inputLevel, outputLevel, bands } = audioFnRef.current();
        if (curState === 'ai-speaking') {
          targetLevel = outputLevel;
        } else if (curState === 'listening' || curState === 'user-speaking') {
          targetLevel = inputLevel;
        }
        for (let b = 0; b < 8; b++) {
          targetBands[b] = bands[b] || 0;
        }
      }

      // ChatGPT-style vocal cadence modulation: rhythmic natural breathing when speaking
      if (curState === 'ai-speaking' || curState === 'user-speaking') {
        const cadence =
          (Math.sin(phase * 4.0) * 0.5 + 0.5) *
          (Math.sin(phase * 2.3 + 1.2) * 0.5 + 0.5) *
          0.36;
        targetLevel = Math.max(targetLevel, 0.18 + cadence);
        for (let b = 0; b < 8; b++) {
          const mod = Math.sin(phase * 3.2 + b * 0.8) * 0.5 + 0.5;
          targetBands[b] = Math.max(targetBands[b], 0.22 + mod * 0.38);
        }
      }

      // Fast attack for immediate speech response, silky smooth decay
      const attackRate = targetLevel > smoothLevel ? 0.35 : 0.08;
      smoothLevel += (targetLevel - smoothLevel) * attackRate;

      for (let b = 0; b < 8; b++) {
        const bRate = (targetBands[b] || 0) > smoothBands[b] ? 0.32 : 0.085;
        smoothBands[b] += ((targetBands[b] || 0) - smoothBands[b]) * bRate;
      }

      // ChatGPT Organic Fluid Physics: voice volume directly drives wave amplitude & radius
      let targetScale = 1.0;
      let targetWaveAmp = 0.025;
      let targetAuraGlow = 0.38;
      let speedMult = 1.0;

      if (curState === 'idle') {
        const breath = Math.sin(phase * 0.75) * 0.03;
        targetScale = 1.0 + breath;
        targetWaveAmp = 0.024;
        targetAuraGlow = 0.35 + Math.sin(phase * 0.75) * 0.08;
        speedMult = 0.85;
      } else if (curState === 'listening') {
        const breath = Math.sin(phase * 1.1) * 0.04;
        targetScale = 1.04 + breath + smoothLevel * 0.16;
        targetWaveAmp = 0.042 + smoothLevel * 0.09;
        targetAuraGlow = 0.52 + smoothLevel * 0.42;
        speedMult = 1.25 + smoothLevel * 0.8;
      } else if (curState === 'user-speaking') {
        targetScale = 1.08 + smoothLevel * 0.32;
        targetWaveAmp = 0.06 + smoothLevel * 0.15;
        targetAuraGlow = 0.68 + smoothLevel * 0.5;
        speedMult = 1.6 + smoothLevel * 1.5;
      } else if (curState === 'thinking') {
        targetScale = 1.03 + Math.sin(phase * 1.8) * 0.035;
        targetWaveAmp = 0.045;
        targetAuraGlow = 0.55 + Math.sin(phase * 1.8) * 0.15;
        speedMult = 1.8;
      } else if (curState === 'ai-speaking') {
        // Dramatic, mesmerizing ChatGPT-style liquid wave morphing on speech peaks
        targetScale = 1.1 + smoothLevel * 0.36;
        targetWaveAmp = 0.065 + smoothLevel * 0.18;
        targetAuraGlow = 0.72 + smoothLevel * 0.55;
        speedMult = 1.8 + smoothLevel * 1.6;
      }

      if (isReduced) {
        speedMult = 0.35;
        targetWaveAmp *= 0.35;
        targetScale = 1.0 + (targetScale - 1.0) * 0.3;
      }

      phase += 0.02 * speedMult;
      rotation += (0.014 + smoothLevel * 0.03) * (isReduced ? 0.3 : 1.0);

      smoothScale += (targetScale - smoothScale) * 0.12;
      smoothWaveAmp += (targetWaveAmp - smoothWaveAmp) * 0.12;
      smoothAuraGlow += (targetAuraGlow - smoothAuraGlow) * 0.1;

      const currentRadius = baseRadius * smoothScale;

      // -------------------------------------------------------------
      // LAYER 1: ChatGPT Atmospheric Ambient Bloom (Ultra-soft, Zero Clip)
      // -------------------------------------------------------------
      const outerHaloRadius = currentRadius * (1.75 + smoothLevel * 0.45);
      const haloGrad = ctx.createRadialGradient(
        cx,
        cy,
        currentRadius * 0.3,
        cx,
        cy,
        outerHaloRadius
      );
      haloGrad.addColorStop(
        0,
        `rgba(34, 211, 238, ${(0.32 * smoothAuraGlow).toFixed(3)})`
      );
      haloGrad.addColorStop(
        0.38,
        `rgba(99, 102, 241, ${(0.24 * smoothAuraGlow).toFixed(3)})`
      );
      haloGrad.addColorStop(
        0.68,
        `rgba(168, 85, 247, ${(0.12 * smoothAuraGlow).toFixed(3)})`
      );
      haloGrad.addColorStop(1, 'rgba(8, 10, 20, 0)');

      ctx.save();
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, outerHaloRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // -------------------------------------------------------------
      // Helper function: Draw a ChatGPT Organic Fluid Harmonic Polygon
      // -------------------------------------------------------------
      const drawFluidPath = (
        radiusMult: number,
        rotOffset: number,
        freqMult: number,
        wAmp: number
      ) => {
        ctx.beginPath();
        const steps = 144;
        for (let i = 0; i <= steps; i++) {
          const theta = (i / steps) * Math.PI * 2;
          const bandIdx = Math.floor((i / steps) * 8) % 8;
          const bandEnergy = smoothBands[bandIdx] || 0;

          // Organic harmonic Fourier wave modulation (ChatGPT signature fluid ripple)
          const w1 =
            Math.sin(theta * 3 + rotation * freqMult + rotOffset) * wAmp;
          const w2 =
            Math.cos(theta * 4 - rotation * (freqMult * 0.75) + rotOffset * 1.4) *
            (wAmp * 0.75);
          const w3 =
            Math.sin(theta * 6 + phase * 1.3) * (wAmp * 0.35);
          const bandPulse = bandEnergy * (wAmp * 1.25);

          const r =
            currentRadius * radiusMult * (1 + w1 + w2 + w3 + bandPulse);
          const px = cx + Math.cos(theta) * r;
          const py = cy + Math.sin(theta) * r;

          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      };

      // -------------------------------------------------------------
      // LAYER 2: Outermost Swirling Fluid Aurora Veil
      // -------------------------------------------------------------
      ctx.save();
      drawFluidPath(1.18 + smoothLevel * 0.14, 1.25, 0.9, smoothWaveAmp * 1.25);
      const veilGrad = ctx.createLinearGradient(
        cx + Math.cos(rotation) * currentRadius,
        cy + Math.sin(rotation) * currentRadius,
        cx - Math.cos(rotation) * currentRadius,
        cy - Math.sin(rotation) * currentRadius
      );
      veilGrad.addColorStop(
        0,
        `rgba(34, 211, 238, ${(0.42 * smoothAuraGlow).toFixed(3)})`
      );
      veilGrad.addColorStop(
        0.5,
        `rgba(99, 102, 241, ${(0.32 * smoothAuraGlow).toFixed(3)})`
      );
      veilGrad.addColorStop(
        1,
        `rgba(236, 72, 153, ${(0.38 * smoothAuraGlow).toFixed(3)})`
      );
      ctx.fillStyle = veilGrad;
      ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
      ctx.shadowBlur = (16 + smoothLevel * 18) * dpr;
      ctx.fill();
      ctx.restore();

      // -------------------------------------------------------------
      // LAYER 3: Middle Counter-Rotating Liquid Body (ChatGPT Fluid Wave)
      // -------------------------------------------------------------
      ctx.save();
      drawFluidPath(
        1.07 + smoothLevel * 0.09,
        -0.85,
        -1.2,
        smoothWaveAmp * 1.05
      );
      const midGrad = ctx.createLinearGradient(
        cx + Math.cos(-rotation * 0.95) * currentRadius,
        cy + Math.sin(-rotation * 0.95) * currentRadius,
        cx - Math.cos(-rotation * 0.95) * currentRadius,
        cy - Math.sin(-rotation * 0.95) * currentRadius
      );
      midGrad.addColorStop(0, 'rgba(14, 165, 233, 0.72)');
      midGrad.addColorStop(0.48, 'rgba(124, 58, 237, 0.7)');
      midGrad.addColorStop(1, 'rgba(217, 70, 239, 0.65)');
      ctx.fillStyle = midGrad;
      ctx.shadowColor = 'rgba(139, 92, 246, 0.55)';
      ctx.shadowBlur = (18 + smoothLevel * 22) * dpr;
      ctx.fill();
      ctx.restore();

      // -------------------------------------------------------------
      // LAYER 4: Core Fluid Sphere (Deep rich gradient with shifting focal)
      // -------------------------------------------------------------
      ctx.save();
      drawFluidPath(1.0, 0, 1.4, smoothWaveAmp * 0.85);

      const focalX = cx + Math.cos(rotation * 1.15) * currentRadius * 0.28;
      const focalY = cy + Math.sin(rotation * 1.15) * currentRadius * 0.28;

      const coreGrad = ctx.createRadialGradient(
        focalX,
        focalY,
        currentRadius * 0.04,
        cx,
        cy,
        currentRadius * 1.05
      );
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
      coreGrad.addColorStop(0.22, 'rgba(56, 189, 248, 0.95)');
      coreGrad.addColorStop(0.55, 'rgba(67, 56, 202, 0.96)');
      coreGrad.addColorStop(0.85, 'rgba(109, 40, 217, 0.98)');
      coreGrad.addColorStop(1, 'rgba(15, 23, 42, 0.98)');

      ctx.shadowColor = 'rgba(56, 189, 248, 0.7)';
      ctx.shadowBlur = (22 + smoothLevel * 26) * dpr;
      ctx.fillStyle = coreGrad;
      ctx.fill();
      ctx.clip(); // Restrict internal light ribbons inside the core fluid

      // -------------------------------------------------------------
      // LAYER 5: Internal Aurora Light Ribbons (Swirling inside the core)
      // -------------------------------------------------------------
      const ribbon1X = cx + Math.cos(rotation * 1.4) * currentRadius * 0.45;
      const ribbon1Y = cy + Math.sin(rotation * 1.4) * currentRadius * 0.45;
      const ribbon1 = ctx.createRadialGradient(
        ribbon1X,
        ribbon1Y,
        0,
        ribbon1X,
        ribbon1Y,
        currentRadius * 0.9
      );
      ribbon1.addColorStop(
        0,
        `rgba(244, 114, 182, ${(0.58 + smoothLevel * 0.32).toFixed(3)})`
      );
      ribbon1.addColorStop(0.5, 'rgba(139, 92, 246, 0.26)');
      ribbon1.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ribbon1;
      ctx.fillRect(
        cx - currentRadius * 1.6,
        cy - currentRadius * 1.6,
        currentRadius * 3.2,
        currentRadius * 3.2
      );

      const ribbon2X = cx + Math.cos(-rotation * 1.3) * currentRadius * 0.42;
      const ribbon2Y = cy + Math.sin(-rotation * 1.3) * currentRadius * 0.42;
      const ribbon2 = ctx.createRadialGradient(
        ribbon2X,
        ribbon2Y,
        0,
        ribbon2X,
        ribbon2Y,
        currentRadius * 0.85
      );
      ribbon2.addColorStop(
        0,
        `rgba(34, 211, 238, ${(0.58 + smoothLevel * 0.32).toFixed(3)})`
      );
      ribbon2.addColorStop(0.55, 'rgba(59, 130, 246, 0.24)');
      ribbon2.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = ribbon2;
      ctx.fillRect(
        cx - currentRadius * 1.6,
        cy - currentRadius * 1.6,
        currentRadius * 3.2,
        currentRadius * 3.2
      );

      // -------------------------------------------------------------
      // LAYER 6: Crystal Glass Specular Dome (Tactile 3D Depth)
      // -------------------------------------------------------------
      const specGrad = ctx.createRadialGradient(
        cx - currentRadius * 0.32,
        cy - currentRadius * 0.36,
        0,
        cx - currentRadius * 0.32,
        cy - currentRadius * 0.36,
        currentRadius * 0.7
      );
      specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
      specGrad.addColorStop(0.42, 'rgba(255, 255, 255, 0.18)');
      specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
      ctx.fill();

      // Delicate inner rim shadow for depth
      const rimGrad = ctx.createRadialGradient(
        cx,
        cy,
        currentRadius * 0.72,
        cx,
        cy,
        currentRadius
      );
      rimGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      rimGrad.addColorStop(1, 'rgba(8, 10, 20, 0.46)');
      ctx.fillStyle = rimGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, currentRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const isSpeaking = state === 'ai-speaking';
  const isListening = state === 'listening' || state === 'user-speaking';
  const isThinking = state === 'thinking';

  // ChatGPT-style clean status indicator
  const statusLabel = isSpeaking
    ? 'Speaking'
    : isThinking
      ? 'Thinking'
      : isListening
        ? 'Listening'
        : 'Tap to Talk';

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{
        duration: reducedMotion ? 0.2 : 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="w-full flex-1 flex flex-col items-center justify-center relative select-none overflow-hidden py-4"
    >
      {/* Full Background Ambient Light Support (ChatGPT-Style Atmospheric Glow) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden"
      >
        {/* Layer 1: Wide Deep Atmospheric Aura that shifts with state */}
        <div
          className={`w-[520px] h-[520px] sm:w-[720px] sm:h-[720px] rounded-full blur-[110px] sm:blur-[160px] transition-all duration-700 ease-out ${
            isSpeaking
              ? 'bg-gradient-to-tr from-rose-500/22 via-fuchsia-600/20 to-purple-600/15 scale-110 opacity-90'
              : isListening
                ? 'bg-gradient-to-tr from-cyan-500/22 via-sky-500/20 to-indigo-600/15 scale-105 opacity-90'
                : 'bg-gradient-to-tr from-blue-600/12 via-indigo-600/12 to-purple-800/10 scale-95 opacity-60'
          }`}
        />

        {/* Layer 2: Core Soft Luminous Spotlight */}
        <div
          className={`w-[320px] h-[320px] sm:w-[440px] sm:h-[440px] rounded-full blur-[70px] sm:blur-[95px] transition-all duration-500 ease-out ${
            isSpeaking
              ? 'bg-gradient-to-br from-pink-400/24 via-rose-500/20 to-purple-500/18 scale-105 opacity-95'
              : isListening
                ? 'bg-gradient-to-br from-cyan-400/24 via-blue-500/20 to-indigo-500/18 scale-100 opacity-95'
                : 'bg-gradient-to-br from-cyan-500/10 via-indigo-600/10 to-transparent scale-90 opacity-50'
          }`}
        />

        {/* Layer 3: Subtle Vignette to melt smoothly into page theme */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(9,8,15,0.65)_100%)] pointer-events-none" />
      </div>

      {/* Relative Content Container */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-md mx-auto">
        {/* Top Status Capsule (Clean ChatGPT Voice Style) */}
        <div className="mb-4 sm:mb-5 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/50 dark:bg-white/[0.06] border border-slate-700/50 dark:border-white/10 backdrop-blur-md shadow-sm">
            <span
              aria-hidden="true"
              className={`w-2 h-2 rounded-full ${
                isSpeaking
                  ? 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.85)] animate-pulse'
                  : isListening
                    ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.85)] animate-pulse'
                    : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]'
              }`}
            />
            <span className="text-[10px] font-semibold tracking-[0.2em] text-slate-300 uppercase font-mono">
              {isSpeaking ? 'VOICE · SPEAKING' : isListening ? 'VOICE · LISTENING' : 'VOICE · READY'}
            </span>
          </div>
        </div>

        {/* ChatGPT-Style Fluid Morphing Voice Orb Button */}
        <button
          type="button"
          onClick={onClick}
          aria-label={`Setara Voice Assistant — ${statusLabel}. Tap to interact.`}
          className="relative w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 cursor-pointer active:scale-[0.96] transition-transform duration-200"
        >
          {/* Real-Time HTML5 High-DPR Fluid Morphing Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Minimalist Floating Center Badge (ChatGPT Style) */}
          <div className="relative z-10 px-3 py-1.5 rounded-full bg-slate-950/40 border border-white/15 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.4)] pointer-events-none flex items-center gap-1.5 text-center">
            <span className="text-cyan-300 font-mono text-xs">✦</span>
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-white font-[family-name:var(--font-display)] drop-shadow-sm whitespace-nowrap">
              {statusLabel}
            </span>
          </div>
        </button>

        {/* Subtitle Caption */}
        <p className="mt-5 sm:mt-6 max-w-[280px] sm:max-w-[340px] text-center text-xs font-normal text-slate-400 dark:text-slate-400 leading-relaxed">
          {isSpeaking
            ? 'Tap orb to stop speaking'
            : isListening
              ? 'Setara is listening to your voice...'
              : 'Tap the orb to start live voice talk'}
        </p>
      </div>
    </motion.div>
  );
};
