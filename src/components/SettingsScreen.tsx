import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Bot,
  AudioLines,
  Sun,
  Moon,
  Monitor,
  Bell,
  Shield,
  Lock,
  HardDrive,
  Info,
  Volume2,
  Square,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { AppSettings, ChatMessage, ThemeMode, VoiceName } from '../types/assistant';
import { ttsPlayer } from '../services/ttsPlayer';
import { ConfirmDialog } from './ConfirmDialog';

interface SettingsScreenProps {
  isOpen: boolean;
  settings: AppSettings;
  messages: ChatMessage[];
  onClose: () => void;
  onUpdateSettings: (updates: Partial<AppSettings>) => void;
  onClearHistory: () => void;
  onClearCache: () => void;
  onOpenAccount: () => void;
}

const VOICES: { id: VoiceName; label: string; description: string }[] = [
  { id: 'Aoede', label: 'Aoede', description: 'Warm and natural' },
  { id: 'Kore', label: 'Kore', description: 'Clear and articulate' },
  { id: 'Zephyr', label: 'Zephyr', description: 'Bright and balanced' },
  { id: 'Puck', label: 'Puck', description: 'Light and expressive' },
  { id: 'Charon', label: 'Charon', description: 'Calm and steady' },
  { id: 'Fenrir', label: 'Fenrir', description: 'Deep and grounded' },
];

const LANGUAGES = ['English', 'Hindi', 'Auto', 'Urdu', 'Spanish', 'French', 'Arabic', 'German'];

const VOICE_SAMPLES_BY_LANGUAGE: Record<string, Record<VoiceName, string>> = {
  English: {
    Aoede: 'Hello, I am Aoede. My voice is warm, smooth, and natural for everyday conversation.',
    Kore: 'Hello, I am Kore. My voice is clear, focused, and easy to follow.',
    Zephyr: 'Hi there, I am Zephyr. I bring a bright and balanced tone to your day.',
    Puck: 'Hey, I am Puck. Light, friendly, and quick to jump in whenever you need.',
    Charon: 'Hello, I am Charon. Calm, steady, and measured at your preferred pace.',
    Fenrir: 'Greetings, I am Fenrir. Deep, grounded, and clear for focused listening.',
  },
  Hindi: {
    Aoede: 'नमस्ते, मैं Aoede हूँ। मेरी आवाज़ शांत, सहज और बातचीत के लिए बिल्कुल प्राकृतिक है।',
    Kore: 'नमस्ते, मैं Kore हूँ। मेरी आवाज़ साफ़, संतुलित और समझने में बेहद आसान है।',
    Zephyr: 'नमस्ते, मैं Zephyr हूँ। मैं आपकी हर बातचीत में एक ताज़ा और मधुर अंदाज़ लाती हूँ।',
    Puck: 'नमस्ते, मैं Puck हूँ। हल्की, दोस्ताना और हमेशा तुरंत मदद के लिए तैयार।',
    Charon: 'नमस्ते, मैं Charon हूँ। मेरी आवाज़ गंभीर, स्थिर और आरामदायक गति में है।',
    Fenrir: 'नमस्ते, मैं Fenrir हूँ। गहरी, स्पष्ट और संतुलित आवाज़ में आपका स्वागत है।',
  },
  Urdu: {
    Aoede: 'السلام علیکم، میں Aoede ہوں۔ میری آواز نرم، قدرتی اور روزمرہ گفتگو کے لیے موزوں ہے۔',
    Kore: 'السلام علیکم، میں Kore ہوں۔ میری آواز صاف، واضح اور سمجھنے میں آسان ہے۔',
    Zephyr: 'السلام علیکم، میں Zephyr ہوں۔ آپ کی گفتگو کے لیے ایک خوشگوار اور متوازن آواز۔',
    Puck: 'السلام علیکم، میں Puck ہوں۔ ہلکی پھلکی، دوستانہ اور ہر وقت مدد کے لیے تیار۔',
    Charon: 'السلام علیکم، میں Charon ہوں۔ پُرسکون، ٹھہراؤ والی اور متوازن آواز۔',
    Fenrir: 'السلام علیکم، میں Fenrir ہوں۔ گہری اور واضح آواز کے ساتھ حاضر ہوں۔',
  },
  Spanish: {
    Aoede: 'Hola, soy Aoede. Mi voz es cálida, suave y natural para conversar.',
    Kore: 'Hola, soy Kore. Mi voz es clara, precisa y fácil de escuchar.',
    Zephyr: 'Hola, soy Zephyr. Aporto un tono fresco y equilibrado.',
    Puck: 'Hola, soy Puck. Ligero, cercano y listo para ayudarte.',
    Charon: 'Hola, soy Charon. Una voz tranquila, firme y serena.',
    Fenrir: 'Hola, soy Fenrir. Una voz profunda, clara y segura.',
  },
  French: {
    Aoede: 'Bonjour, je suis Aoede. Ma voix est chaleureuse et naturelle.',
    Kore: 'Bonjour, je suis Kore. Ma voix est claire et précise.',
    Zephyr: 'Bonjour, je suis Zephyr. Un ton lumineux et équilibré.',
    Puck: 'Salut, je suis Puck. Léger, dynamique et toujours prêt.',
    Charon: 'Bonjour, je suis Charon. Une voix calme et posée.',
    Fenrir: 'Bonjour, je suis Fenrir. Une voix profonde et claire.',
  },
  Arabic: {
    Aoede: 'مرحباً، أنا Aoede. صوتي دافئ وطبيعي ومريح للمحادثة اليومية.',
    Kore: 'مرحباً، أنا Kore. صوتي واضح ومتوازن وسهل الاستماع.',
    Zephyr: 'أهلاً بك، أنا Zephyr. أقدم نبرة لطيفة ومشرقة.',
    Puck: 'مرحباً، أنا Puck. خفيف وودود ومستعد دائماً للمساعدة.',
    Charon: 'مرحباً، أنا Charon. صوت هادئ ومتزن.',
    Fenrir: 'أهلاً، أنا Fenrir. صوت عميق وواضح.',
  },
  German: {
    Aoede: 'Hallo, ich bin Aoede. Meine Stimme ist warm, ruhig und natürlich.',
    Kore: 'Hallo, ich bin Kore. Meine Stimme ist klar und gut verständlich.',
    Zephyr: 'Hallo, ich bin Zephyr. Ein heller und ausgewogener Klang.',
    Puck: 'Hey, ich bin Puck. Leicht, freundlich und direkt zur Stelle.',
    Charon: 'Hallo, ich bin Charon. Ruhig, gelassen und gleichmäßig.',
    Fenrir: 'Hallo, ich bin Fenrir. Tief, klar und präzise.',
  },
};

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked?: boolean;
  onChange: (val: boolean) => void;
}) {
  const isChecked = Boolean(checked);
  return (
    <div className="px-5 py-3.5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</p>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isChecked}
        aria-label={label}
        onClick={() => onChange(!isChecked)}
        className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${
          isChecked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
        }`}
      >
        <span
          className={`block w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
            isChecked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  isOpen,
  settings,
  messages,
  onClose,
  onUpdateSettings,
  onClearHistory,
  onClearCache,
  onOpenAccount,
}) => {
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmClearCache, setConfirmClearCache] = useState(false);
  const [activeInfoSheet, setActiveInfoSheet] = useState<'help' | 'about' | 'terms' | 'privacy' | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen && ttsPlayer.isPlaying()) {
      ttsPlayer.stop();
      setIsPreviewPlaying(false);
      setPreviewLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const uploadedAttachments = messages.flatMap((m) => m.attachments || []);
  const totalUploadedBytes = uploadedAttachments.reduce((acc, a) => acc + (a.size || 0), 0);
  const storageSizeLabel =
    totalUploadedBytes < 1024
      ? `${totalUploadedBytes} B`
      : totalUploadedBytes < 1024 * 1024
      ? `${(totalUploadedBytes / 1024).toFixed(1)} KB`
      : `${(totalUploadedBytes / (1024 * 1024)).toFixed(2)} MB`;

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      onUpdateSettings({ micPermission: 'granted' });
    } catch {
      onUpdateSettings({ micPermission: 'denied' });
    }
  };

  const requestCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      onUpdateSettings({ cameraPermission: 'granted' });
    } catch {
      onUpdateSettings({ cameraPermission: 'denied' });
    }
  };

  const handleTestVoice = async () => {
    if (isPreviewPlaying || previewLoading) {
      ttsPlayer.stop();
      setIsPreviewPlaying(false);
      setPreviewLoading(false);
      return;
    }

    setPreviewError(null);
    setPreviewLoading(true);
    const sampleLang =
      settings.language === 'Auto' ? 'English' : settings.language || 'English';
    const langSamples =
      VOICE_SAMPLES_BY_LANGUAGE[sampleLang] || VOICE_SAMPLES_BY_LANGUAGE.English;
    const sampleText =
      langSamples[settings.voice] ||
      `Hello, I am ${settings.voice}. This is a preview of my speaking voice.`;

    await ttsPlayer.speak(sampleText, settings.voice, {
      language: sampleLang,
      speechSpeed: settings.speechSpeed,
      onStart: () => {
        setPreviewLoading(false);
        setIsPreviewPlaying(true);
      },
      onEnd: () => {
        setPreviewLoading(false);
        setIsPreviewPlaying(false);
      },
      onError: (msg) => {
        setPreviewLoading(false);
        setIsPreviewPlaying(false);
        setPreviewError(msg);
      },
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-[#07090f] text-slate-900 dark:text-slate-100"
    >
      {/* Top Bar */}
      <header className="sticky top-0 z-10 shrink-0 h-16 px-4 sm:px-6 flex items-center justify-between bg-white/85 dark:bg-slate-950/85 border-b border-slate-200/80 dark:border-slate-800/80 backdrop-blur-xl pt-safe">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to home"
          className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold tracking-tight font-[family-name:var(--font-display)]">
          Settings
        </h1>
        <div className="w-11" aria-hidden="true" />
      </header>

      {/* Scrollable Sections */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-safe">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* 1. ASSISTANT */}
          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-500 dark:text-cyan-400" />
              <h2 className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400">
                Assistant
              </h2>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {/* Assistant Preferences (Response Length) */}
              <div className="px-5 py-3.5">
                <p className="text-sm font-medium mb-2">Assistant Preferences</p>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
                  {(['concise', 'balanced', 'detailed'] as const).map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => onUpdateSettings({ responseLength: len })}
                      className={`min-h-[38px] rounded-xl text-xs font-medium capitalize transition-all ${
                        settings.responseLength === len
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Selection + Test Preview */}
              <div className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div>
                    <p className="text-sm font-medium">Voice</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Choose a voice and preview how it sounds
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestVoice}
                    disabled={previewLoading}
                    className={`min-h-[38px] px-3.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                      isPreviewPlaying
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        : 'bg-indigo-500/10 text-indigo-600 dark:text-cyan-400 hover:bg-indigo-500/20'
                    }`}
                  >
                    {isPreviewPlaying ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>{previewLoading ? 'Loading...' : 'Test'}</span>
                      </>
                    )}
                  </button>
                </div>

                {previewError && (
                  <p className="mb-2.5 text-xs text-rose-600 dark:text-rose-400">
                    {previewError}
                  </p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {VOICES.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        if (ttsPlayer.isPlaying()) {
                          ttsPlayer.stop();
                          setIsPreviewPlaying(false);
                        }
                        onUpdateSettings({ voice: v.id });
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        settings.voice === v.id
                          ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-500 text-indigo-700 dark:text-cyan-300'
                          : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <p className="text-sm font-medium">{v.label}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {v.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Speech Speed */}
              <div className="px-5 py-3.5">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="speech-speed" className="text-sm font-medium">
                    Speech Speed
                  </label>
                  <span className="text-xs font-mono font-medium text-indigo-600 dark:text-cyan-400 tabular-nums">
                    {settings.speechSpeed.toFixed(2)}x
                  </span>
                </div>
                <input
                  id="speech-speed"
                  type="range"
                  min={0.75}
                  max={1.5}
                  step={0.05}
                  value={settings.speechSpeed}
                  onChange={(e) => onUpdateSettings({ speechSpeed: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 dark:accent-cyan-400"
                />
              </div>

              {/* Language */}
              <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                <label htmlFor="assistant-language" className="text-sm font-medium">
                  Language
                </label>
                <select
                  id="assistant-language"
                  value={settings.language}
                  onChange={(e) => onUpdateSettings({ language: e.target.value })}
                  className="min-h-[40px] px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              {/* Personalisation */}
              <div className="px-5 py-3.5">
                <label
                  htmlFor="assistant-personalisation"
                  className="block text-sm font-medium mb-1.5"
                >
                  Personalisation
                </label>
                <textarea
                  id="assistant-personalisation"
                  rows={2}
                  value={settings.personalisation}
                  onChange={(e) => onUpdateSettings({ personalisation: e.target.value })}
                  placeholder="Optional context preferences (e.g., preferred units, topics, or formatting)..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
                />
              </div>
            </div>
          </section>

          {/* 2. VOICE & LIVE TALK */}
          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <AudioLines className="w-4 h-4 text-cyan-500" />
              <h2 className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400">
                Voice & Live Talk
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <ToggleRow
                label="Noise Suppression"
                description="Reduce background noise for microphone input"
                checked={settings.micNoiseSuppression}
                onChange={(val) => onUpdateSettings({ micNoiseSuppression: val })}
              />
              <ToggleRow
                label="Echo Cancellation"
                description="Prevent speaker audio feedback during Live Talk"
                checked={settings.micEchoCancellation}
                onChange={(val) => onUpdateSettings({ micEchoCancellation: val })}
              />
              <ToggleRow
                label="Auto-connect Microphone"
                description="Start listening immediately when opening Live Talk"
                checked={settings.liveAutoConnectMic}
                onChange={(val) => onUpdateSettings({ liveAutoConnectMic: val })}
              />
              <ToggleRow
                label="Voice Output"
                description="Enable spoken responses during voice sessions"
                checked={settings.voiceOutput}
                onChange={(val) => onUpdateSettings({ voiceOutput: val })}
              />
              <ToggleRow
                label="Auto-play Voice"
                description="Automatically read new assistant chat replies aloud"
                checked={settings.autoPlayVoice}
                onChange={(val) => onUpdateSettings({ autoPlayVoice: val })}
              />
            </div>
          </section>

          {/* 3. APPEARANCE */}
          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400">
                Appearance
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <div className="px-5 py-4">
                <p className="text-sm font-medium mb-2.5">Theme</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'light', label: 'Light Mode', icon: Sun },
                      { id: 'dark', label: 'Dark Mode', icon: Moon },
                      { id: 'system', label: 'System Default', icon: Monitor },
                    ] as { id: ThemeMode; label: string; icon: any }[]
                  ).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onUpdateSettings({ theme: id })}
                      className={`min-h-[48px] px-2 py-2 rounded-2xl border flex flex-col items-center justify-center gap-1 text-xs font-medium transition-all ${
                        settings.theme === id
                          ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-500 text-indigo-700 dark:text-cyan-300'
                          : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-5 py-3.5">
                <p className="text-sm font-medium mb-2">Orb Visual Style</p>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
                  {(['aurora', 'ocean', 'monochrome'] as const).map((styleId) => (
                    <button
                      key={styleId}
                      type="button"
                      onClick={() => onUpdateSettings({ orbStyle: styleId })}
                      className={`min-h-[38px] rounded-xl text-xs font-medium capitalize transition-all ${
                        settings.orbStyle === styleId
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {styleId}
                    </button>
                  ))}
                </div>
              </div>

              <ToggleRow
                label="Compact Chat Layout"
                description="Use tighter spacing between conversation bubbles"
                checked={settings.compactChat}
                onChange={(val) => onUpdateSettings({ compactChat: val })}
              />
            </div>
          </section>

          {/* 4. NOTIFICATIONS */}
          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-500 dark:text-cyan-400" />
              <h2 className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400">
                Notifications
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <ToggleRow
                label="Notifications"
                description="Enable alerts for replies and session status"
                checked={settings.notificationsEnabled}
                onChange={(val) => onUpdateSettings({ notificationsEnabled: val })}
              />
              <ToggleRow
                label="Sound Cues"
                description="Subtle audio feedback when starting or ending voice"
                checked={settings.soundCues}
                onChange={(val) => onUpdateSettings({ soundCues: val })}
              />
              <ToggleRow
                label="Live Session Alerts"
                description="Show status notices if live audio disconnects"
                checked={settings.liveSessionAlerts}
                onChange={(val) => onUpdateSettings({ liveSessionAlerts: val })}
              />
            </div>
          </section>

          {/* 5. PRIVACY */}
          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              <h2 className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400">
                Privacy
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <ToggleRow
                label="Save Chat History"
                description="Keep conversation history stored locally across visits"
                checked={settings.saveChatHistory}
                onChange={(val) => onUpdateSettings({ saveChatHistory: val })}
              />
              <ToggleRow
                label="Usage Diagnostics"
                description="Allow anonymous performance metrics"
                checked={settings.allowDiagnostics}
                onChange={(val) => onUpdateSettings({ allowDiagnostics: val })}
              />

              <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Microphone Permission</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                    Status: {settings.micPermission}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={requestMicPermission}
                  className="min-h-[38px] px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors"
                >
                  Check Access
                </button>
              </div>

              <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Camera & Photos Permission</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                    Status: {settings.cameraPermission}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={requestCameraPermission}
                  className="min-h-[38px] px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors"
                >
                  Check Access
                </button>
              </div>

              <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">File Permission</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                    Status: {settings.filePermission}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      filePermission:
                        settings.filePermission === 'granted' ? 'restricted' : 'granted',
                    })
                  }
                  className="min-h-[38px] px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors"
                >
                  {settings.filePermission === 'granted' ? 'Restrict' : 'Allow'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setConfirmClearHistory(true)}
                className="w-full min-h-[52px] px-5 py-3.5 flex items-center justify-between text-left text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
              >
                <span>Clear Chat History</span>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* 6. SECURITY */}
          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400">
                Security
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAccount();
                }}
                className="w-full min-h-[54px] px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">Password & Sign-In Management</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manage password and connected sign-in methods
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              <ToggleRow
                label="Confirm Destructive Actions"
                description="Always ask confirmation before clearing data or deleting account"
                checked={settings.confirmDestructiveActions}
                onChange={(val) => onUpdateSettings({ confirmDestructiveActions: val })}
              />
              <ToggleRow
                label="Require Session Verification"
                description="Extra verification step when modifying account credentials"
                checked={settings.sessionLockEnabled}
                onChange={(val) => onUpdateSettings({ sessionLockEnabled: val })}
              />
            </div>
          </section>

          {/* 7. STORAGE */}
          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-purple-500" />
              <h2 className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400">
                Storage
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Uploaded Files</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {uploadedAttachments.length} items · {storageSizeLabel}
                  </p>
                </div>
              </div>

              <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Cache & Temporary Data</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {cacheNotice || 'Clear cached audio and temporary UI state'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmClearCache(true)}
                  className="min-h-[38px] px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors"
                >
                  Clear Cache
                </button>
              </div>
            </div>
          </section>

          {/* 8. GENERAL */}
          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-500" />
              <h2 className="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400">
                General
              </h2>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <ToggleRow
                label="Reduced Motion"
                description="Minimize fluid animations for accessibility"
                checked={settings.reducedMotion}
                onChange={(val) => onUpdateSettings({ reducedMotion: val })}
              />
              <ToggleRow
                label="High Contrast"
                description="Increase foreground contrast across controls"
                checked={settings.highContrast}
                onChange={(val) => onUpdateSettings({ highContrast: val })}
              />

              {(
                [
                  { id: 'help', label: 'Help & Support' },
                  { id: 'about', label: 'About' },
                  { id: 'terms', label: 'Terms & Conditions' },
                  { id: 'privacy', label: 'Privacy Policy' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setActiveInfoSheet((prev) => (prev === item.id ? null : item.id))
                  }
                  className="w-full min-h-[50px] px-5 py-3 flex items-center justify-between text-left text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <span>{item.label}</span>
                  <ChevronRight
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      activeInfoSheet === item.id ? 'rotate-90' : ''
                    }`}
                  />
                </button>
              ))}

              {activeInfoSheet && (
                <div className="px-5 py-4 bg-slate-50 dark:bg-slate-950/60 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {activeInfoSheet === 'help' &&
                    'Tap the central AI orb or Live Talk button for real-time voice conversation, use Mic for speech-to-text dictation, or open Message to send text and attachments.'}
                  {activeInfoSheet === 'about' &&
                    'Personal AI Assistant application designed for seamless voice, speech-to-text, and multimodal messaging across mobile and desktop screens.'}
                  {activeInfoSheet === 'terms' &&
                    'Use this assistant responsibly. Uploaded files and chat history remain under your user control and can be cleared at any time in Account or Privacy settings.'}
                  {activeInfoSheet === 'privacy' &&
                    'Voice streams, microphone access, and camera/photo selections are requested only when activated by you. Manage permissions and history controls directly in Settings.'}
                </div>
              )}

              <div className="px-5 py-3.5 flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">App Version</span>
                <span className="font-mono text-xs text-slate-700 dark:text-slate-200 tabular-nums">
                  1.0.0
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={confirmClearHistory}
        title="Clear Chat History"
        description="Remove all saved messages and conversation attachments from this device?"
        confirmLabel="Clear History"
        destructive
        onCancel={() => setConfirmClearHistory(false)}
        onConfirm={() => {
          onClearHistory();
          setConfirmClearHistory(false);
        }}
      />

      <ConfirmDialog
        isOpen={confirmClearCache}
        title="Clear Cache"
        description="Clear temporary audio buffers and cached application data? Your account and preferences will remain intact."
        confirmLabel="Clear Cache"
        onCancel={() => setConfirmClearCache(false)}
        onConfirm={() => {
          onClearCache();
          setConfirmClearCache(false);
          setCacheNotice('Cache cleared just now');
        }}
      />
    </div>
  );
};
