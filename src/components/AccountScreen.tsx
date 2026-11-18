import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  Edit3,
  Eye,
  EyeOff,
  History,
  HardDrive,
  KeyRound,
  LogOut,
  Mail,
  Shield,
  Trash2,
  User as UserIcon,
  Download,
} from 'lucide-react';
import { AuthUser, ChatMessage } from '../types/assistant';
import { ConfirmDialog } from './ConfirmDialog';

interface AccountScreenProps {
  isOpen: boolean;
  user: AuthUser;
  messages: ChatMessage[];
  onClose: () => void;
  onUpdateProfile: (updates: Partial<AuthUser>) => void;
  onChangePassword: (currentPassword: string, newPassword: string) => { ok: boolean; message: string };
  onOpenChat: () => void;
  onClearHistory: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({
  isOpen,
  user,
  messages,
  onClose,
  onUpdateProfile,
  onChangePassword,
  onOpenChat,
  onClearHistory,
  onLogout,
  onDeleteAccount,
}) => {
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [draftName, setDraftName] = useState(user.name);
  const [draftEmail, setDraftEmail] = useState(user.email);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmNewPw, setConfirmNewPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwFeedback, setPwFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const initials = (user.name || 'U')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const chatJsonSize = new Blob([JSON.stringify(messages)]).size;
  const attachmentBytes = messages.reduce(
    (sum, m) =>
      sum + (m.attachments?.reduce((aSum, att) => aSum + (att.size || 0), 0) || 0),
    0
  );

  const handleAvatarSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateProfile({ avatarUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = draftName.trim();
    const cleanEmail = draftEmail.trim().toLowerCase();
    if (!cleanName || !cleanEmail) return;
    onUpdateProfile({ name: cleanName, email: cleanEmail });
    setIsEditingProfile(false);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPwFeedback(null);
    if (newPw.length < 6) {
      setPwFeedback({ ok: false, text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPw !== confirmNewPw) {
      setPwFeedback({ ok: false, text: 'New passwords do not match.' });
      return;
    }
    const result = onChangePassword(currentPw, newPw);
    setPwFeedback({ ok: result.ok, text: result.message });
    if (result.ok) {
      setCurrentPw('');
      setNewPw('');
      setConfirmNewPw('');
    }
  };

  const handleExportChat = () => {
    const blob = new Blob([JSON.stringify(messages, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `assistant-chat-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleMethod = (method: 'email' | 'google') => {
    const exists = user.connectedMethods.includes(method);
    if (exists && user.connectedMethods.length <= 1) return;
    const next = exists
      ? user.connectedMethods.filter((m) => m !== method)
      : [...user.connectedMethods, method];
    onUpdateProfile({ connectedMethods: next });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Account and Profile"
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
          Account & Profile
        </h1>
        <div className="w-11" aria-hidden="true" />
      </header>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-safe">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Profile Card */}
          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="relative self-start">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelected}
                  className="hidden"
                />
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-500 p-[2px]">
                  <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-semibold text-indigo-600 dark:text-cyan-400">
                        {initials || <UserIcon className="w-8 h-8" />}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  aria-label="Change profile picture"
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md hover:bg-indigo-500 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white truncate font-[family-name:var(--font-display)]">
                  {user.name}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {user.email}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftName(user.name);
                      setDraftEmail(user.email);
                      setIsEditingProfile((prev) => !prev);
                    }}
                    className="min-h-[40px] px-4 py-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100 flex items-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditingProfile ? 'Cancel Edit' : 'Edit Profile'}</span>
                  </button>
                  {user.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => onUpdateProfile({ avatarUrl: undefined })}
                      className="min-h-[40px] px-3 py-1.5 rounded-2xl text-xs font-medium text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
              </div>
            </div>

            {isEditingProfile && (
              <form
                onSubmit={handleSaveProfile}
                className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 space-y-3"
              >
                <div>
                  <label
                    htmlFor="edit-profile-name"
                    className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
                  >
                    Display Name
                  </label>
                  <input
                    id="edit-profile-name"
                    type="text"
                    required
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <div>
                  <label
                    htmlFor="edit-profile-email"
                    className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
                  >
                    Email Address
                  </label>
                  <input
                    id="edit-profile-email"
                    type="email"
                    required
                    value={draftEmail}
                    onChange={(e) => setDraftEmail(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="min-h-[44px] px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Account Information */}
          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-semibold tracking-wide uppercase text-slate-400">
                Account Information
              </h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">Account ID</span>
                <span className="font-mono text-xs text-slate-700 dark:text-slate-200 tabular-nums truncate max-w-[180px]">
                  {user.uid}
                </span>
              </div>
              <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">Member Since</span>
                <span className="text-slate-800 dark:text-slate-100 tabular-nums">
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="px-5 py-3.5 flex items-center justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">Last Sign-In</span>
                <span className="text-slate-800 dark:text-slate-100 tabular-nums">
                  {user.lastSignInAt
                    ? new Date(user.lastSignInAt).toLocaleString([], {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    : 'Current session'}
                </span>
              </div>
            </div>
          </section>

          {/* Connected Sign-In Methods & Password */}
          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-semibold tracking-wide uppercase text-slate-400">
                Sign-In & Password
              </h3>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-cyan-400 flex items-center justify-center">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Email & Password</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleMethod('email')}
                  className={`min-h-[36px] px-3 rounded-xl text-xs font-medium transition-colors ${
                    user.connectedMethods.includes('email')
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {user.connectedMethods.includes('email') ? 'Connected' : 'Connect'}
                </button>
              </div>

              <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Google Account</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Single-tap sign-in provider
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleMethod('google')}
                  className={`min-h-[36px] px-3 rounded-xl text-xs font-medium transition-colors ${
                    user.connectedMethods.includes('google')
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {user.connectedMethods.includes('google') ? 'Connected' : 'Connect'}
                </button>
              </div>

              {/* Change Password */}
              <div className="px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword((prev) => !prev);
                    setPwFeedback(null);
                  }}
                  className="w-full min-h-[44px] flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Change Password</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Update your account password
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-indigo-600 dark:text-cyan-400">
                    {isChangingPassword ? 'Close' : 'Update'}
                  </span>
                </button>

                {isChangingPassword && (
                  <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3">
                    {pwFeedback && (
                      <p
                        className={`text-xs px-3 py-2 rounded-xl ${
                          pwFeedback.ok
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {pwFeedback.text}
                      </p>
                    )}

                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        placeholder="Current password (if set)"
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                        className="w-full min-h-[44px] pl-3.5 pr-11 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((p) => !p)}
                        aria-label={showPw ? 'Hide passwords' : 'Show passwords'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      placeholder="New password"
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      placeholder="Confirm new password"
                      value={confirmNewPw}
                      onChange={(e) => setConfirmNewPw(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                    <button
                      type="submit"
                      className="min-h-[44px] px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                    >
                      Save New Password
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>

          {/* Chat History & Data Storage */}
          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-semibold tracking-wide uppercase text-slate-400">
                Chat History & Data Storage
              </h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Chat History</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {messages.length} saved messages
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenChat();
                    }}
                    className="min-h-[38px] px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Open Chat
                  </button>
                  <button
                    type="button"
                    onClick={handleExportChat}
                    aria-label="Export chat history"
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Data & Storage</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      Messages {formatBytes(chatJsonSize)} · Attachments {formatBytes(attachmentBytes)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmClearOpen(true)}
                  disabled={messages.length === 0}
                  className="min-h-[38px] px-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 disabled:opacity-40 text-xs font-medium hover:bg-rose-500/20 transition-colors"
                >
                  Clear History
                </button>
              </div>
            </div>
          </section>

          {/* Session & Danger Zone */}
          <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <button
                type="button"
                onClick={() => setConfirmLogoutOpen(true)}
                className="w-full min-h-[54px] px-5 py-3.5 flex items-center gap-3 text-left text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <LogOut className="w-4 h-4 text-slate-500" />
                <span>Log Out</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="w-full min-h-[54px] px-5 py-3.5 flex items-center gap-3 text-left text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Account</span>
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={confirmClearOpen}
        title="Clear Chat History"
        description="This will permanently delete all saved chat messages and uploaded conversation attachments on this device."
        confirmLabel="Clear History"
        destructive
        onCancel={() => setConfirmClearOpen(false)}
        onConfirm={() => {
          onClearHistory();
          setConfirmClearOpen(false);
        }}
      />

      <ConfirmDialog
        isOpen={confirmLogoutOpen}
        title="Log Out"
        description="You will be signed out of your current session and returned to the Sign In screen."
        confirmLabel="Log Out"
        onCancel={() => setConfirmLogoutOpen(false)}
        onConfirm={() => {
          setConfirmLogoutOpen(false);
          onLogout();
        }}
      />

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="Delete Account"
        description="This action permanently deletes your local account credentials, saved profile, and conversation history. This cannot be undone."
        confirmLabel="Delete Account"
        destructive
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          onDeleteAccount();
        }}
      />
    </div>
  );
};
