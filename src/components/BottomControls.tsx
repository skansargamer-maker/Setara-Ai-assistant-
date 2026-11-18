import React, { useState, useRef, useEffect } from 'react';
import {
  Paperclip,
  MessageSquare,
  Mic,
  MicOff,
  AudioLines,
  PhoneOff,
  Camera,
  Image as ImageIcon,
  FileText,
  FolderOpen,
  X,
} from 'lucide-react';
import { AttachmentCategory } from '../types/assistant';

interface BottomControlsProps {
  isChatOpen: boolean;
  isSttActive: boolean;
  isLiveActive: boolean;
  unreadCount?: number;
  onToggleChat: () => void;
  onToggleStt: () => void;
  onToggleLiveTalk: () => void;
  onSelectFiles: (files: FileList, category: AttachmentCategory) => void;
}

export const BottomControls: React.FC<BottomControlsProps> = ({
  isChatOpen,
  isSttActive,
  isLiveActive,
  unreadCount = 0,
  onToggleChat,
  onToggleStt,
  onToggleLiveTalk,
  onSelectFiles,
}) => {
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const photosInputRef = useRef<HTMLInputElement | null>(null);
  const imagesInputRef = useRef<HTMLInputElement | null>(null);
  const docsInputRef = useRef<HTMLInputElement | null>(null);
  const filesInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!attachMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [attachMenuOpen]);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    category: AttachmentCategory
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      onSelectFiles(e.target.files, category);
      e.target.value = '';
    }
    setAttachMenuOpen(false);
  };

  return (
    <div className="relative z-30 shrink-0 w-full px-3 sm:px-6 pb-3 pt-2 pb-safe bg-gradient-to-t from-white via-white/95 to-transparent dark:from-[#08070d] dark:via-[#08070d]/95 dark:to-transparent">
      {/* Hidden native file inputs */}
      <input
        ref={photosInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={(e) => handleFileChange(e, 'photos')}
        className="hidden"
      />
      <input
        ref={imagesInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFileChange(e, 'images')}
        className="hidden"
      />
      <input
        ref={docsInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xls,.xlsx,.ppt,.pptx"
        multiple
        onChange={(e) => handleFileChange(e, 'documents')}
        className="hidden"
      />
      <input
        ref={filesInputRef}
        type="file"
        multiple
        onChange={(e) => handleFileChange(e, 'files')}
        className="hidden"
      />

      <div className="max-w-lg mx-auto relative" ref={menuRef}>
        {/* Attachment Picker Popover */}
        {attachMenuOpen && (
          <div
            role="menu"
            aria-label="Attachment options"
            className="absolute bottom-full left-0 mb-3 w-60 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 shadow-2xl shadow-slate-900/15 dark:shadow-black/60 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between px-3 py-1.5 mb-1">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Attach
              </span>
              <button
                type="button"
                onClick={() => setAttachMenuOpen(false)}
                aria-label="Close attachment menu"
                className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => photosInputRef.current?.click()}
              className="w-full min-h-[44px] px-3 py-2 rounded-2xl flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <span className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Camera className="w-4 h-4" />
              </span>
              <span>Photos</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => imagesInputRef.current?.click()}
              className="w-full min-h-[44px] px-3 py-2 rounded-2xl flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <span className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <ImageIcon className="w-4 h-4" />
              </span>
              <span>Images</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => docsInputRef.current?.click()}
              className="w-full min-h-[44px] px-3 py-2 rounded-2xl flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <span className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </span>
              <span>Documents</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => filesInputRef.current?.click()}
              className="w-full min-h-[44px] px-3 py-2 rounded-2xl flex items-center gap-3 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <span className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                <FolderOpen className="w-4 h-4" />
              </span>
              <span>Files</span>
            </button>
          </div>
        )}

        {/* Main 4-control bar: Attachment | Message | Microphone | Live Talk */}
        <nav
          aria-label="Primary assistant controls"
          className="grid grid-cols-4 items-center gap-1.5 p-1.5 rounded-3xl bg-white/90 dark:bg-[#13121e]/90 border border-slate-200/70 dark:border-white/10 shadow-[0_14px_40px_rgba(99,102,241,0.10),0_2px_10px_rgba(15,23,42,0.04)] dark:shadow-black/60 backdrop-blur-2xl"
        >
          {/* 1. LEFT: Attachment / File */}
          <button
            type="button"
            onClick={() => setAttachMenuOpen((prev) => !prev)}
            aria-label="Attach photos, images, documents, or files"
            aria-expanded={attachMenuOpen}
            className={`min-h-[52px] px-2 py-1.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${
              attachMenuOpen
                ? 'bg-gradient-to-tr from-blue-500 to-purple-500 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
            }`}
          >
            <Paperclip className="w-5 h-5" />
            <span className="text-[11px] font-medium leading-none whitespace-nowrap">
              Attach
            </span>
          </button>

          {/* 2. CENTRE: Message / Chat */}
          <button
            type="button"
            onClick={onToggleChat}
            aria-label={isChatOpen ? 'Close chat view' : 'Open chat messages'}
            aria-pressed={isChatOpen}
            className={`relative min-h-[52px] px-2 py-1.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${
              isChatOpen
                ? 'bg-gradient-to-tr from-cyan-500 to-blue-500 text-white shadow-md shadow-sky-500/25'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[11px] font-medium leading-none whitespace-nowrap">
              Message
            </span>
            {unreadCount > 0 && !isChatOpen && (
              <span className="absolute top-1.5 right-3 min-w-[16px] h-4 px-1 rounded-full bg-indigo-500 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* 3. NEXT: Microphone (Speech-to-Text) */}
          <button
            type="button"
            onClick={onToggleStt}
            aria-label={isSttActive ? 'Stop speech-to-text microphone' : 'Start speech-to-text microphone'}
            aria-pressed={isSttActive}
            className={`min-h-[52px] px-2 py-1.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${
              isSttActive
                ? 'bg-gradient-to-tr from-cyan-500 via-blue-500 to-purple-500 text-white shadow-md shadow-cyan-500/25'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
            }`}
          >
            {isSttActive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            <span className="text-[11px] font-medium leading-none whitespace-nowrap">
              {isSttActive ? 'Listening' : 'Mic'}
            </span>
          </button>

          {/* 4. NEXT: Live Talk (Real-time voice conversation) */}
          <button
            type="button"
            onClick={onToggleLiveTalk}
            aria-label={isLiveActive ? 'End live talk' : 'Start live talk'}
            aria-pressed={isLiveActive}
            className={`min-h-[52px] px-2 py-1.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-300 ${
              isLiveActive
                ? 'bg-gradient-to-tr from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/25'
                : 'bg-gradient-to-tr from-cyan-500 via-blue-500 to-purple-500 text-white hover:opacity-95 shadow-md shadow-purple-500/20'
            }`}
          >
            {isLiveActive ? (
              <PhoneOff className="w-5 h-5" />
            ) : (
              <AudioLines className="w-5 h-5" />
            )}
            <span className="text-[11px] font-semibold leading-none whitespace-nowrap">
              {isLiveActive ? 'End Live' : 'Live Talk'}
            </span>
          </button>
        </nav>
      </div>
    </div>
  );
};
