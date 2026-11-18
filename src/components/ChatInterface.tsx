import React, { useRef, useEffect, useState } from 'react';
import {
  Send,
  Volume2,
  Square,
  Copy,
  Check,
  FileText,
  X,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { ChatAttachment, ChatMessage } from '../types/assistant';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  inputDraft: string;
  onChangeInput: (val: string) => void;
  onSendMessage: (text: string, attachments?: ChatAttachment[]) => void;
  pendingAttachments: ChatAttachment[];
  onRemoveAttachment: (id: string) => void;
  isThinking: boolean;
  speakingMessageId: string | null;
  onSpeakMessage: (msg: ChatMessage) => void;
  compactChat?: boolean;
  textSize?: 'small' | 'standard' | 'large';
  interimTranscript?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  inputDraft,
  onChangeInput,
  onSendMessage,
  pendingAttachments,
  onRemoveAttachment,
  isThinking,
  speakingMessageId,
  onSpeakMessage,
  compactChat = false,
  textSize = 'medium',
  interimTranscript = '',
}) => {
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isThinking]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 130)}px`;
  }, [inputDraft]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
    } catch {
      /* ignore clipboard failures */
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = inputDraft.trim();
    if (!trimmed && pendingAttachments.length === 0) return;
    onSendMessage(trimmed, pendingAttachments);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 max-w-3xl w-full mx-auto px-3 sm:px-6">
      {/* Message List */}
      <div
        className={`flex-1 overflow-y-auto scrollbar-none py-4 ${
          compactChat ? 'space-y-3' : 'space-y-5'
        }`}
      >
        {messages.length === 0 ? (
          <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-cyan-400 flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white font-[family-name:var(--font-display)]">
              Start a conversation
            </h2>
            <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Send a message, share photos or documents, or use the microphone below to dictate.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSpeakingThis = speakingMessageId === msg.id;
            const timeLabel = new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.isModel ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`max-w-[88%] sm:max-w-[78%] rounded-3xl px-4 py-3 text-sm sm:text-[15px] leading-relaxed shadow-sm ${
                    msg.isModel
                      ? 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100 rounded-bl-lg'
                      : 'bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 text-white rounded-br-lg shadow-indigo-500/15'
                  }`}
                >
                  {/* Attachments inside message */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2.5 flex flex-col gap-2">
                      {msg.attachments.map((att) =>
                        att.mimeType.startsWith('image/') && att.dataUrl ? (
                          <div key={att.id} className="overflow-hidden rounded-2xl">
                            <img
                              src={att.dataUrl}
                              alt={att.name}
                              className="max-h-56 w-auto rounded-2xl object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            key={att.id}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-2xl border text-xs ${
                              msg.isModel
                                ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                                : 'bg-white/15 border-white/20 text-white'
                            }`}
                          >
                            <FileText className="w-4 h-4 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{att.name}</p>
                              <p className="opacity-75 tabular-nums">
                                {formatFileSize(att.size)}
                              </p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {msg.text && (
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  )}
                </div>

                {/* Timestamp & Assistant Actions */}
                <div
                  className={`mt-1.5 flex items-center gap-1.5 px-1 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums ${
                    msg.isModel ? 'flex-row' : 'flex-row-reverse'
                  }`}
                >
                  <span>{timeLabel}</span>

                  {msg.isModel && msg.text && (
                    <>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => onSpeakMessage(msg)}
                        aria-label={isSpeakingThis ? 'Stop speaking message' : 'Read message aloud'}
                        className={`p-1.5 rounded-full transition-colors ${
                          isSpeakingThis
                            ? 'text-indigo-600 dark:text-cyan-400 bg-indigo-500/10'
                            : 'hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                      >
                        {isSpeakingThis ? (
                          <Square className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.text)}
                        aria-label="Copy message text"
                        className="p-1.5 rounded-full hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Thinking / Streaming Indicator */}
        {isThinking && (
          <div className="flex items-start">
            <div className="rounded-3xl rounded-bl-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 px-4 py-3.5 shadow-sm">
              <div className="flex items-center gap-1.5" aria-label="Assistant is thinking">
                <span className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-cyan-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-cyan-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-cyan-400 animate-bounce" />
              </div>
            </div>
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>

      {/* Pending Attachments Strip */}
      {pendingAttachments.length > 0 && (
        <div className="py-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
          {pendingAttachments.map((att) => (
            <div
              key={att.id}
              className="relative shrink-0 flex items-center gap-2 pl-2 pr-8 py-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200"
            >
              {att.mimeType.startsWith('image/') && att.dataUrl ? (
                <img
                  src={att.dataUrl}
                  alt={att.name}
                  className="w-7 h-7 rounded-lg object-cover"
                />
              ) : att.category === 'photos' || att.category === 'images' ? (
                <ImageIcon className="w-4 h-4 text-cyan-500" />
              ) : (
                <FileText className="w-4 h-4 text-indigo-500" />
              )}
              <span className="max-w-[120px] truncate font-medium">{att.name}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(att.id)}
                aria-label={`Remove ${att.name}`}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-rose-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Keyboard-Safe Message Composer */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 py-2 flex items-end gap-2"
      >
        <div className="flex-1 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/35 focus-within:border-indigo-500 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputDraft}
            onChange={(e) => onChangeInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            aria-label="Message input"
            className="w-full max-h-[130px] resize-none bg-transparent text-sm sm:text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none leading-relaxed py-1"
          />
        </div>

        <button
          type="submit"
          disabled={!inputDraft.trim() && pendingAttachments.length === 0}
          aria-label="Send message"
          className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};
