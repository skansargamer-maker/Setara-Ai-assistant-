export type OrbState =
  | 'idle'
  | 'listening'
  | 'user-speaking'
  | 'thinking'
  | 'ai-speaking';

export type LiveState =
  | 'disconnected'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking';

export type AttachmentCategory = 'photos' | 'images' | 'documents' | 'files';

export interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  category: AttachmentCategory;
  dataUrl?: string;
  textPreview?: string;
  uploadedAt?: number;
}

export interface ChatMessage {
  id: string;
  text: string;
  isModel: boolean;
  timestamp: number;
  isFinal?: boolean;
  isStreaming?: boolean;
  attachments?: ChatAttachment[];
}

export type SignInMethod = 'email' | 'google';

export interface AuthUser {
  uid: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: number;
  connectedMethods: SignInMethod[];
  lastSignInAt: number;
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemePreference = ThemeMode;

export type VoiceName = 'Aoede' | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

export interface AppSettings {
  // Assistant
  responseLength: 'concise' | 'balanced' | 'detailed';
  streamResponses?: boolean;
  voice: VoiceName;
  speechSpeed: number;
  language: string;
  personalisation: string;

  // Voice & Live Talk
  noiseSuppression: boolean;
  echoCancellation: boolean;
  micNoiseSuppression?: boolean;
  micEchoCancellation?: boolean;
  autoSendSpeechToText?: boolean;
  bargeInEnabled?: boolean;
  liveAutoConnectMic?: boolean;
  micSensitivity?: 'low' | 'medium' | 'high';
  voiceOutput?: boolean;
  voiceOutputEnabled?: boolean;
  autoPlayVoice: boolean;

  // Appearance
  theme: ThemePreference;
  orbStyle: 'ocean' | 'aurora' | 'monochrome';
  compactChat: boolean;
  reducedMotion: boolean;
  textSize?: 'standard' | 'large';

  // Notifications
  notificationsEnabled: boolean;
  soundCues?: boolean;
  liveSessionAlerts?: boolean;
  notifySound?: boolean;
  notifyLiveAlerts?: boolean;
  notifyUpdates?: boolean;

  // Privacy
  saveChatHistory: boolean;
  allowDiagnostics?: boolean;
  analyticsEnabled?: boolean;
  micPermission?: 'prompt' | 'granted' | 'denied';
  cameraPermission?: 'prompt' | 'granted' | 'denied';
  filePermission?: 'granted' | 'restricted';

  // Security
  confirmDestructiveActions?: boolean;
  twoFactorEnabled?: boolean;
  sessionLockEnabled?: boolean;

  // General
  highContrast: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  responseLength: 'balanced',
  streamResponses: true,
  voice: 'Aoede',
  speechSpeed: 1.0,
  language: 'Hindi',
  personalisation: '',

  noiseSuppression: true,
  echoCancellation: true,
  micNoiseSuppression: true,
  micEchoCancellation: true,
  autoSendSpeechToText: false,
  bargeInEnabled: true,
  liveAutoConnectMic: true,
  micSensitivity: 'medium',
  voiceOutput: true,
  voiceOutputEnabled: true,
  autoPlayVoice: false,

  theme: 'dark',
  orbStyle: 'ocean',
  compactChat: false,
  reducedMotion: false,
  textSize: 'standard',

  notificationsEnabled: true,
  soundCues: false,
  liveSessionAlerts: true,
  notifySound: false,
  notifyLiveAlerts: true,
  notifyUpdates: true,

  saveChatHistory: true,
  allowDiagnostics: false,
  analyticsEnabled: false,
  micPermission: 'prompt',
  cameraPermission: 'prompt',
  filePermission: 'granted',

  confirmDestructiveActions: true,
  twoFactorEnabled: false,
  sessionLockEnabled: false,

  highContrast: false,
};

export interface RegisteredAccountRecord {
  uid: string;
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  createdAt: number;
  connectedMethods: SignInMethod[];
}

export interface ToolCallPayload {
  id?: string;
  name: string;
  args: Record<string, any>;
}
