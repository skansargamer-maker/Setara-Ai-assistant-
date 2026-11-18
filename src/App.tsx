import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, Settings, Mic, MicOff, Sparkles } from 'lucide-react';
import {
  AppSettings,
  AttachmentCategory,
  AuthUser,
  ChatAttachment,
  ChatMessage,
  DEFAULT_APP_SETTINGS,
  LiveState,
  OrbState,
  RegisteredAccountRecord,
} from './types/assistant';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  auth,
  syncUserProfileToFirestore,
  deleteUserProfileFromFirestore,
} from './firebase';
import { LiveClient } from './services/liveClient';
import { ttsPlayer } from './services/ttsPlayer';
import { AuthScreen } from './components/AuthScreen';
import { AIOrb } from './components/AIOrb';
import { BottomControls } from './components/BottomControls';
import { ChatInterface } from './components/ChatInterface';
import { AccountScreen } from './components/AccountScreen';
import { SettingsScreen } from './components/SettingsScreen';

const STORAGE_KEYS = {
  USER: 'assistant_active_user',
  ACCOUNTS: 'assistant_accounts',
  SETTINGS: 'assistant_settings',
  MESSAGES: 'assistant_messages',
};

function hashPasswordSimple(pw: string): string {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    hash = (hash << 5) - hash + pw.charCodeAt(i);
    hash |= 0;
  }
  return `h_${Math.abs(hash).toString(36)}_${pw.length}`;
}

export default function App() {
  // Accounts & Active User
  const [accounts, setAccounts] = useState<RegisteredAccountRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Settings (default language is Hindi and default theme is clean Light Mode unless manually changed)
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      let parsed = saved ? { ...DEFAULT_APP_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_APP_SETTINGS };
      if (!localStorage.getItem('assistant_hindi_default_v1')) {
        localStorage.setItem('assistant_hindi_default_v1', '1');
        parsed = { ...parsed, language: 'Hindi' };
      }
      if (!localStorage.getItem('assistant_dark_setara_v3')) {
        localStorage.setItem('assistant_dark_setara_v3', '1');
        parsed = { ...parsed, theme: 'dark' };
      }
      return parsed;
    } catch {
      return DEFAULT_APP_SETTINGS;
    }
  });

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [inputDraft, setInputDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  // Screens
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Voice & Speech states
  const [liveState, setLiveState] = useState<LiveState>('disconnected');
  const [isLiveMicMuted, setIsLiveMicMuted] = useState(false);
  const [isUserSpeakingLive, setIsUserSpeakingLive] = useState(false);
  const [isSttActive, setIsSttActive] = useState(false);
  const [isUserSpeakingStt, setIsUserSpeakingStt] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Refs
  const liveClientRef = useRef<LiveClient | null>(null);
  const recognitionRef = useRef<any>(null);
  const sttAudioCtxRef = useRef<AudioContext | null>(null);
  const sttStreamRef = useRef<MediaStream | null>(null);
  const sttAnalyserRef = useRef<AnalyserNode | null>(null);
  const sttBinsRef = useRef(new Uint8Array(64));
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastNotice(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastNotice(null);
    }, 3200);
  }, []);

  // Theme synchronization (Light / Dark / System)
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const useDark =
        settings.theme === 'dark' ||
        (settings.theme === 'system' && mediaQuery.matches);
      if (useDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      const metaTheme = document.querySelector('meta[name="theme-color"]');
      if (metaTheme) {
        metaTheme.setAttribute('content', useDark ? '#09080f' : '#ffffff');
      }
    };

    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [settings.theme]);

  // Persistence
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    } catch {
      /* ignore */
    }
  }, [accounts]);

  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    } catch {
      /* ignore */
    }
  }, [user]);

  // Keep Firebase Google session synced cleanly
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        const cleanEmail = (fbUser.email || '').toLowerCase();
        const displayName =
          fbUser.displayName || (cleanEmail ? cleanEmail.split('@')[0] : 'Google User');
        setUser((prev) => {
          if (prev && prev.uid === fbUser.uid) return prev;
          return {
            uid: fbUser.uid,
            name: displayName,
            email: cleanEmail,
            avatarUrl: fbUser.photoURL || undefined,
            createdAt: fbUser.metadata.creationTime
              ? new Date(fbUser.metadata.creationTime).getTime()
              : Date.now(),
            connectedMethods: ['google'],
            lastSignInAt: Date.now(),
          };
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  useEffect(() => {
    try {
      if (settings.saveChatHistory) {
        localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
      }
    } catch {
      /* ignore */
    }
  }, [messages, settings.saveChatHistory]);

  // Clear unread when opening chat
  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
    }
  }, [isChatOpen]);

  // Stop Speech Synthesis
  const stopSpeaking = useCallback(() => {
    ttsPlayer.stop();
    setSpeakingMessageId(null);
  }, []);

  // Speak an assistant message using real Gemini neural voice
  const speakMessage = useCallback(
    async (id: string, text: string) => {
      if (speakingMessageId === id) {
        stopSpeaking();
        return;
      }

      stopSpeaking();

      if (!settings.voiceOutputEnabled) {
        showToast('Voice output is turned off in Settings');
        return;
      }

      const cleanText = text.replace(/[*_`#~]/g, ' ').trim();
      if (!cleanText) return;

      await ttsPlayer.play({
        text: cleanText,
        voice: settings.voice,
        speechSpeed: settings.speechSpeed,
        language: settings.language,
        onStart: () => setSpeakingMessageId(id),
        onEnd: () => setSpeakingMessageId(null),
        onError: (err) => {
          setSpeakingMessageId(null);
          showToast(err.message || 'Unable to play voice response');
        },
      });
    },
    [
      speakingMessageId,
      stopSpeaking,
      settings.voiceOutputEnabled,
      settings.voice,
      settings.speechSpeed,
      settings.language,
      showToast,
    ]
  );

  // Stop Speech-to-Text
  const stopStt = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    if (sttStreamRef.current) {
      sttStreamRef.current.getTracks().forEach((t) => t.stop());
      sttStreamRef.current = null;
    }
    if (sttAudioCtxRef.current) {
      try {
        sttAudioCtxRef.current.close();
      } catch {
        /* ignore */
      }
      sttAudioCtxRef.current = null;
    }
    sttAnalyserRef.current = null;
    setIsSttActive(false);
    setIsUserSpeakingStt(false);
    setInterimTranscript('');
  }, []);

  // Initialize LiveClient
  useEffect(() => {
    const client = new LiveClient({
      onStateChange: (next) => {
        setLiveState(next);
      },
      onInterrupt: () => {
        stopSpeaking();
      },
      onText: (text, isModel, isFinal) => {
        if (!isModel) return;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.isModel && !last.isFinal) {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                text: last.text + text,
                isFinal: !!isFinal,
              },
            ];
          }
          return [
            ...prev,
            {
              id: `msg_${Date.now()}`,
              text,
              isModel: true,
              timestamp: Date.now(),
              isFinal: !!isFinal,
            },
          ];
        });
      },
      onError: (err) => {
        showToast(err.message || 'Voice connection error');
      },
    });

    liveClientRef.current = client;

    return () => {
      client.disconnect();
      stopSpeaking();
      stopStt();
    };
  }, [showToast, stopSpeaking, stopStt]);

  // Monitor audio level smoothly to distinguish 'listening' vs 'user-speaking'
  useEffect(() => {
    if (liveState !== 'listening' && !isSttActive) {
      setIsUserSpeakingLive(false);
      setIsUserSpeakingStt(false);
      return;
    }

    const interval = setInterval(() => {
      if (liveState === 'listening' && liveClientRef.current) {
        const { inputLevel } = liveClientRef.current.getAudioLevels();
        setIsUserSpeakingLive(inputLevel > 0.08);
      }
      if (isSttActive && sttAnalyserRef.current) {
        sttAnalyserRef.current.getByteFrequencyData(sttBinsRef.current);
        let sum = 0;
        const vocalEnd = 20;
        for (let i = 1; i <= vocalEnd; i++) {
          sum += sttBinsRef.current[i] || 0;
        }
        const level = sum / (vocalEnd * 115);
        setIsUserSpeakingStt(level > 0.08);
      }
    }, 60);

    return () => clearInterval(interval);
  }, [liveState, isSttActive]);

  // Unified Audio Level Sampler for AIOrb
  const getOrbAudioLevels = useCallback(() => {
    if (liveState !== 'disconnected' && liveClientRef.current) {
      return liveClientRef.current.getAudioLevels();
    }

    if (isSttActive && sttAnalyserRef.current) {
      sttAnalyserRef.current.getByteFrequencyData(sttBinsRef.current);
      let sum = 0;
      const vocalBins = 20;
      for (let i = 1; i <= vocalBins; i++) {
        sum += sttBinsRef.current[i] || 0;
      }
      const inputLevel = Math.min(1, sum / (vocalBins * 115));
      const bands: number[] = [];
      for (let b = 0; b < 8; b++) {
        const idxA = 1 + b * 2;
        const idxB = idxA + 1;
        const avg = ((sttBinsRef.current[idxA] || 0) + (sttBinsRef.current[idxB] || 0)) / 2;
        bands.push(Math.min(1, avg / 145));
      }
      return { inputLevel, outputLevel: 0, bands };
    }

    if (speakingMessageId && ttsPlayer.isPlaying()) {
      const { outputLevel, bands } = ttsPlayer.getOutputLevels();
      return { inputLevel: 0, outputLevel, bands };
    }

    return { inputLevel: 0, outputLevel: 0, bands: [0, 0, 0, 0, 0, 0, 0, 0] };
  }, [liveState, isSttActive, speakingMessageId]);

  // Toggle Live Talk
  const handleToggleLiveTalk = async () => {
    if (!liveClientRef.current) return;

    if (isSttActive) {
      stopStt();
    }

    if (liveState === 'disconnected') {
      stopSpeaking();
      setIsLiveMicMuted(false);
      await liveClientRef.current.connect(true, settings);
    } else {
      liveClientRef.current.disconnect();
      setIsLiveMicMuted(false);
    }
  };

  // Toggle Speech-to-Text Microphone (separate from Live Talk)
  const handleToggleStt = async () => {
    if (isSttActive) {
      stopStt();
      return;
    }

    if (liveState !== 'disconnected' && liveClientRef.current) {
      liveClientRef.current.disconnect();
    }
    stopSpeaking();

    const SpeechRec =
      (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (!SpeechRec) {
      showToast('Speech-to-text is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: settings.noiseSuppression,
          echoCancellation: settings.echoCancellation,
        },
      });
      sttStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      sttAudioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      sttAnalyserRef.current = analyser;

      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = settings.language === 'Hindi'
        ? 'hi-IN'
        : settings.language === 'Urdu'
        ? 'ur-PK'
        : settings.language === 'Spanish'
        ? 'es-ES'
        : settings.language === 'French'
        ? 'fr-FR'
        : settings.language === 'Arabic'
        ? 'ar-SA'
        : settings.language === 'German'
        ? 'de-DE'
        : 'en-US';

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += transcript;
          } else {
            interim += transcript;
          }
        }
        setInterimTranscript(interim);
        if (finalText.trim()) {
          setInputDraft((prev) => (prev ? `${prev} ${finalText.trim()}` : finalText.trim()));
          setIsChatOpen(true);
        }
      };

      recognition.onerror = () => {
        stopStt();
      };

      recognition.onend = () => {
        stopStt();
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsSttActive(true);
    } catch {
      stopStt();
      showToast('Microphone permission is required for speech-to-text.');
    }
  };

  // Handle File / Photo / Image / Document selection
  const handleSelectFiles = async (fileList: FileList, category: AttachmentCategory) => {
    const newAttachments: ChatAttachment[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const dataUrl = await new Promise<string | undefined>((resolve) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(typeof reader.result === 'string' ? reader.result : undefined);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(file);
      });

      let textPreview: string | undefined;
      if (
        file.type.startsWith('text/') ||
        /\.(txt|md|csv|json)$/i.test(file.name)
      ) {
        try {
          const rawText = await file.text();
          textPreview = rawText.slice(0, 6000);
        } catch {
          /* ignore */
        }
      }

      newAttachments.push({
        id,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        category,
        dataUrl,
        textPreview,
        uploadedAt: Date.now(),
      });
    }

    if (newAttachments.length > 0) {
      setPendingAttachments((prev) => [...prev, ...newAttachments]);
      setIsChatOpen(true);
    }
  };

  // Send message with streaming response
  const handleSendMessage = async () => {
    const trimmed = inputDraft.trim();
    if (!trimmed && pendingAttachments.length === 0) return;

    const currentAttachments = [...pendingAttachments];
    setInputDraft('');
    setPendingAttachments([]);
    stopSpeaking();

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      text: trimmed,
      isModel: false,
      timestamp: Date.now(),
      isFinal: true,
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    };

    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setIsChatOpen(true);

    if (liveState !== 'disconnected' && liveClientRef.current && trimmed) {
      liveClientRef.current.sendTextMessage(trimmed);
      return;
    }

    const assistantMsgId = `mod_${Date.now() + 1}`;
    setIsThinking(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedHistory.slice(-16),
          stream: settings.streamResponses,
          preferences: {
            language: settings.language,
            responseLength: settings.responseLength,
            personalisation: settings.personalisation,
          },
        }),
      });

      if (settings.streamResponses && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let createdBubble = false;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const block of lines) {
            const dataLine = block
              .split('\n')
              .find((l) => l.startsWith('data: '));
            if (!dataLine) continue;

            try {
              const parsed = JSON.parse(dataLine.slice(6));
              if (parsed.chunk) {
                accumulated += parsed.chunk;
                if (!createdBubble) {
                  createdBubble = true;
                  setIsThinking(false);
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: assistantMsgId,
                      text: accumulated,
                      isModel: true,
                      timestamp: Date.now(),
                      isFinal: false,
                      isStreaming: true,
                    },
                  ]);
                } else {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId ? { ...m, text: accumulated } : m
                    )
                  );
                }
              }
              if (parsed.done) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, isFinal: true, isStreaming: false }
                      : m
                  )
                );
              }
            } catch {
              /* ignore malformed chunk */
            }
          }
        }

        setIsThinking(false);
        if (!createdBubble) {
          const fallbackText = accumulated || 'I am ready to help.';
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMsgId,
              text: fallbackText,
              isModel: true,
              timestamp: Date.now(),
              isFinal: true,
            },
          ]);
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, isFinal: true, isStreaming: false }
                : m
            )
          );
        }

        if (settings.autoPlayVoice && settings.voiceOutputEnabled && accumulated) {
          speakMessage(assistantMsgId, accumulated);
        }
      } else {
        const data = await res.json();
        const reply = data.text || 'I am ready to help.';
        setIsThinking(false);
        setMessages((prev) => [
          ...prev,
          {
            id: assistantMsgId,
            text: reply,
            isModel: true,
            timestamp: Date.now(),
            isFinal: true,
          },
        ]);
        if (settings.autoPlayVoice && settings.voiceOutputEnabled) {
          speakMessage(assistantMsgId, reply);
        }
      }
    } catch {
      setIsThinking(false);
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          text: 'Unable to reach the server right now. Please try again.',
          isModel: true,
          timestamp: Date.now(),
          isFinal: true,
        },
      ]);
    }
  };

  // Compute Orb State (5 states: idle, listening, user-speaking, thinking, ai-speaking)
  const orbState: OrbState = useMemo(() => {
    if (liveState === 'speaking' || speakingMessageId) return 'ai-speaking';
    if (liveState === 'thinking' || liveState === 'connecting' || isThinking) return 'thinking';
    if (isUserSpeakingLive || isUserSpeakingStt) return 'user-speaking';
    if (liveState === 'listening' || isSttActive) return 'listening';
    return 'idle';
  }, [liveState, speakingMessageId, isThinking, isUserSpeakingLive, isUserSpeakingStt, isSttActive]);

  // Uploaded files list & local storage bytes
  const uploadedFiles = useMemo(() => {
    const list: ChatAttachment[] = [];
    for (const m of messages) {
      if (m.attachments) list.push(...m.attachments);
    }
    return list;
  }, [messages]);

  const storageBytes = useMemo(() => {
    try {
      let total = 0;
      for (const k of Object.values(STORAGE_KEYS)) {
        const val = localStorage.getItem(k);
        if (val) total += val.length * 2;
      }
      return total;
    } catch {
      return 0;
    }
  }, [messages, settings, user, accounts]);

  // Auth / Account handlers
  const handleAuthenticated = (authUser: AuthUser) => {
    setUser(authUser);
    setIsAccountOpen(false);
    setIsSettingsOpen(false);
  };

  const handleRegisterAccount = (record: RegisteredAccountRecord) => {
    setAccounts((prev) => [...prev, record]);
  };

  const handleUpdateProfile = (updates: Partial<AuthUser>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    setAccounts((prev) =>
      prev.map((acc) =>
        acc.uid === user.uid
          ? {
              ...acc,
              name: updatedUser.name,
              email: updatedUser.email,
              avatarUrl: updatedUser.avatarUrl,
              connectedMethods: updatedUser.connectedMethods,
            }
          : acc
      )
    );
    if (auth.currentUser && auth.currentUser.uid === user.uid) {
      syncUserProfileToFirestore({
        uid: updatedUser.uid,
        name: updatedUser.name,
        email: updatedUser.email,
        avatarUrl: updatedUser.avatarUrl,
      });
    }
    showToast('Profile updated');
  };

  const handleChangePassword = (
    currentPw: string,
    newPw: string
  ): { ok: boolean; message: string } => {
    if (!user) return { ok: false, message: 'No active session' };
    const record = accounts.find((a) => a.uid === user.uid);
    if (record && record.passwordHash && record.passwordHash !== hashPasswordSimple(currentPw)) {
      return { ok: false, message: 'Current password is incorrect.' };
    }
    const newHash = hashPasswordSimple(newPw);
    setAccounts((prev) =>
      prev.map((a) => (a.uid === user.uid ? { ...a, passwordHash: newHash } : a))
    );
    return { ok: true, message: 'Password updated successfully' };
  };

  const handleClearChatHistory = () => {
    setMessages([]);
    setPendingAttachments([]);
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
    showToast('Chat history cleared');
  };

  const handleClearCache = () => {
    stopSpeaking();
    showToast('Cache cleared');
  };

  const handleLogOut = async () => {
    liveClientRef.current?.disconnect();
    stopStt();
    stopSpeaking();
    setIsAccountOpen(false);
    setIsSettingsOpen(false);
    setIsChatOpen(false);
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch {
      /* ignore */
    }
    setUser(null);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    const targetUid = user.uid;
    liveClientRef.current?.disconnect();
    stopStt();
    stopSpeaking();
    setAccounts((prev) => prev.filter((a) => a.uid !== targetUid));
    setMessages([]);
    setPendingAttachments([]);
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
    localStorage.removeItem(STORAGE_KEYS.USER);
    setIsAccountOpen(false);
    setIsSettingsOpen(false);
    setIsChatOpen(false);
    try {
      if (auth.currentUser && auth.currentUser.uid === targetUid) {
        await deleteUserProfileFromFirestore(targetUid);
        await auth.currentUser.delete().catch(() => signOut(auth));
      }
    } catch {
      /* ignore */
    }
    setUser(null);
  };

  // Show Sign In / Sign Up screen if not authenticated
  if (!user) {
    return (
      <AuthScreen
        onAuthenticated={handleAuthenticated}
        accounts={accounts}
        onRegisterAccount={handleRegisterAccount}
      />
    );
  }

  const userInitials = (user.name || 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isLiveActive = liveState !== 'disconnected';

  return (
    <div
      className={`h-[100dvh] w-full flex flex-col overflow-hidden bg-white dark:bg-[#09080f] dark:bg-[radial-gradient(circle_at_50%_45%,#161428_0%,#0b0a12_65%,#08070d_100%)] text-slate-900 dark:text-slate-100 transition-colors duration-300 ${
        settings.highContrast ? 'contrast-125' : ''
      }`}
    >
      {/* TOP BAR: Profile (Top Left) & Settings (Top Right) */}
      <header className="relative z-20 shrink-0 pt-safe">
        <div className="max-w-5xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between">
          {/* Top-left: Account / Profile icon */}
          <button
            type="button"
            onClick={() => setIsAccountOpen(true)}
            aria-label="Open account and profile"
            className="w-11 h-11 shrink-0 rounded-full bg-white/90 dark:bg-slate-900/85 border border-slate-200/80 dark:border-slate-700/80 p-0.5 flex items-center justify-center shadow-[0_6px_20px_rgba(99,102,241,0.10)] hover:scale-105 active:scale-95 transition-all duration-300 backdrop-blur-xl overflow-hidden"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center">
                {userInitials || <User className="w-4 h-4" />}
              </span>
            )}
          </button>

          {/* Minimal Center Toggle when in Chat Mode */}
          {isChatOpen ? (
            <button
              type="button"
              onClick={() => setIsChatOpen(false)}
              className="min-h-[40px] px-4 rounded-full bg-white/90 dark:bg-slate-900/85 border border-slate-200/80 dark:border-slate-700/80 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2 shadow-[0_6px_20px_rgba(99,102,241,0.10)] hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 backdrop-blur-xl"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-cyan-400" />
              <span>Orb View</span>
            </button>
          ) : (
            <div aria-hidden="true" />
          )}

          {/* Top-right: Settings icon */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Open settings"
            className="w-11 h-11 shrink-0 rounded-full bg-white/90 dark:bg-slate-900/85 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-[0_6px_20px_rgba(99,102,241,0.10)] hover:scale-105 active:scale-95 transition-all duration-300 backdrop-blur-xl"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Toast Notification */}
      {toastNotice && (
        <div
          role="status"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium shadow-xl"
        >
          {toastNotice}
        </div>
      )}

      {/* MAIN CONTENT: Centre AI Orb OR Chat View */}
      <main className="relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden">
        {!isChatOpen ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4">
            <AIOrb
              state={orbState}
              orbStyle={settings.orbStyle}
              reducedMotion={settings.reducedMotion}
              getAudioLevels={getOrbAudioLevels}
              onClick={() => {
                if (speakingMessageId) {
                  stopSpeaking();
                } else {
                  handleToggleLiveTalk();
                }
              }}
            />

            {/* Contextual Live / STT Status Controls */}
            {isLiveActive && (
              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const next = !isLiveMicMuted;
                    setIsLiveMicMuted(next);
                    liveClientRef.current?.setMicMuted(next);
                  }}
                  className={`min-h-[44px] px-4 rounded-full border text-xs font-medium flex items-center gap-2 transition-colors ${
                    isLiveMicMuted
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-300'
                      : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {isLiveMicMuted ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      <span>Mic Muted</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>Mute Mic</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {isSttActive && interimTranscript && (
              <p className="mt-5 max-w-md text-center text-sm text-slate-600 dark:text-slate-300 px-4">
                {interimTranscript}
              </p>
            )}
          </div>
        ) : (
          <ChatInterface
            messages={messages}
            inputDraft={inputDraft}
            onChangeInput={setInputDraft}
            onSendMessage={handleSendMessage}
            pendingAttachments={pendingAttachments}
            onRemoveAttachment={(id) =>
              setPendingAttachments((prev) => prev.filter((a) => a.id !== id))
            }
            isThinking={isThinking}
            speakingMessageId={speakingMessageId}
            onSpeakMessage={(msg) => void speakMessage(msg.id, msg.text)}
            compactChat={settings.compactChat}
            textSize={settings.textSize}
            interimTranscript={interimTranscript}
          />
        )}
      </main>

      {/* BOTTOM CONTROL BAR: Attachment | Message | Microphone | Live Talk */}
      <BottomControls
        isChatOpen={isChatOpen}
        isSttActive={isSttActive}
        isLiveActive={isLiveActive}
        unreadCount={unreadCount}
        onToggleChat={() => setIsChatOpen((prev) => !prev)}
        onToggleStt={handleToggleStt}
        onToggleLiveTalk={handleToggleLiveTalk}
        onSelectFiles={handleSelectFiles}
      />

      {/* ACCOUNT / PROFILE SCREEN */}
      <AccountScreen
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        user={user}
        onUpdateProfile={handleUpdateProfile}
        onChangePassword={handleChangePassword}
        messages={messages}
        onOpenChat={() => setIsChatOpen(true)}
        onClearHistory={handleClearChatHistory}
        onLogout={handleLogOut}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* SETTINGS SCREEN */}
      <SettingsScreen
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        messages={messages}
        onUpdateSettings={(updates) =>
          setSettings((prev) => ({ ...prev, ...updates }))
        }
        onClearHistory={handleClearChatHistory}
        onClearCache={handleClearCache}
        onOpenAccount={() => setIsAccountOpen(true)}
      />
    </div>
  );
}
