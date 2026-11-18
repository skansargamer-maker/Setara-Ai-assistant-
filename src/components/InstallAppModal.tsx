import React, { useState } from 'react';
import {
  Download,
  X,
  Share2,
  Check,
  Smartphone,
  Laptop,
  Apple,
  ExternalLink,
  Copy,
  Terminal,
  Sparkles,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'pwa' | 'web' | 'developer'>('pwa');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const sharedUrl = window.location.origin;

  const copyAppUrl = () => {
    navigator.clipboard.writeText(sharedUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyCloneCmd = () => {
    navigator.clipboard.writeText(`npm install\nnpm run dev`);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-neutral-800 bg-neutral-950 p-6 md:p-8 shadow-2xl shadow-cyan-500/10 overflow-y-auto max-h-[90vh]">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-28 bg-gradient-to-b from-cyan-500/20 to-transparent blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-semibold mb-2">
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Install & Download Options
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Get Setara AI Assistant
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Install as a native app on mobile or desktop, or access instantly in browser.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-2xl mb-6 text-xs">
          <button
            onClick={() => setActiveTab('pwa')}
            className={`py-2 px-2 rounded-xl font-medium transition flex items-center justify-center gap-1.5 ${
              activeTab === 'pwa'
                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Install App (PWA)</span>
          </button>
          <button
            onClick={() => setActiveTab('web')}
            className={`py-2 px-2 rounded-xl font-medium transition flex items-center justify-center gap-1.5 ${
              activeTab === 'web'
                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Live Web Link</span>
          </button>
          <button
            onClick={() => setActiveTab('developer')}
            className={`py-2 px-2 rounded-xl font-medium transition flex items-center justify-center gap-1.5 ${
              activeTab === 'developer'
                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Developer Code</span>
          </button>
        </div>

        {/* TAB 1: PWA Install */}
        {activeTab === 'pwa' && (
          <div className="space-y-4">
            {isInstalled ? (
              <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2">
                  <Check className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-emerald-300">
                  Already Installed!
                </h4>
                <p className="text-xs text-neutral-400 mt-1">
                  You are currently running Setara AI as an installed standalone application.
                </p>
              </div>
            ) : isInstallable ? (
              <div className="p-4 rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-cyan-950/30 to-indigo-950/30 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-fuchsia-600 p-0.5 mx-auto mb-3 shadow-lg shadow-cyan-500/20">
                  <div className="w-full h-full rounded-[14px] bg-neutral-950 flex items-center justify-center text-cyan-300 font-bold text-lg">
                    S
                  </div>
                </div>
                <h4 className="text-base font-semibold text-white">
                  Ready for One-Click Install
                </h4>
                <p className="text-xs text-neutral-400 mt-1 mb-4">
                  Add Setara to your home screen or desktop application menu for instant offline capability and fullscreen experience.
                </p>
                <button
                  onClick={install}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-fuchsia-600 text-white font-semibold text-xs tracking-wider uppercase shadow-xl hover:opacity-95 transition flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Install Setara App Now</span>
                </button>
              </div>
            ) : null}

            {/* Platform Guides */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                How to install on your device:
              </span>

              {/* Android / Chrome */}
              <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/60 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white">
                    Android (Chrome / Edge / Samsung)
                  </h5>
                  <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                    Tap the <strong>three dots menu (⋮)</strong> in Chrome at the top right, then select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                  </p>
                </div>
              </div>

              {/* iPhone / iPad */}
              <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/60 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
                  <Apple className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white">
                    iPhone & iPad (Safari)
                  </h5>
                  <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                    Open in Safari, tap the <strong>Share button</strong> (square with arrow up), scroll down and tap <strong>"Add to Home Screen"</strong>.
                  </p>
                </div>
              </div>

              {/* Windows / Mac / Linux */}
              <div className="p-3 rounded-xl border border-neutral-800 bg-neutral-900/60 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
                  <Laptop className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white">
                    Windows & Mac (Chrome / Edge)
                  </h5>
                  <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                    Look for the <strong>Install icon (⨁)</strong> at the right end of the browser URL bar, or click Menu → <strong>"Install Setara AI Assistant"</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Live Web Link */}
        {activeTab === 'web' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/60">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-2">
                Your Direct Web App URL
              </span>
              <p className="text-xs text-neutral-300 mb-3 leading-relaxed">
                You do not need to download or install anything to use Setara! Anyone with this link can launch the voice, vision, and AI browsing experience directly in any browser:
              </p>

              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-cyan-300 break-all select-all">
                <span className="truncate flex-1">{sharedUrl}</span>
                <button
                  onClick={copyAppUrl}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-sans text-xs flex items-center gap-1 shrink-0 transition"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/40 space-y-2 text-xs text-neutral-400">
              <div className="flex items-center gap-2 text-white font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Zero Installation Required</span>
              </div>
              <p>
                Works instantly across mobile phones, tablets, Chromebooks, and PCs. Audio input, camera, screen sharing, and AI voice responses are handled via modern Web APIs.
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: Developer / Local Package */}
        {activeTab === 'developer' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-neutral-800 bg-neutral-900/60">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block mb-1.5">
                Run Locally as Node.js / React App
              </span>
              <p className="text-xs text-neutral-400 mb-3">
                If you have cloned or downloaded the project code to your local computer, execute:
              </p>

              <div className="relative p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-cyan-300">
                <pre className="whitespace-pre-wrap">{`# 1. Install dependencies
npm install

# 2. Run full-stack dev server (port 3000)
npm run dev

# 3. Or build & run for production
npm run build
npm start`}</pre>
                <button
                  onClick={copyCloneCmd}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition"
                  title="Copy commands"
                >
                  {copiedCurl ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-neutral-800 bg-neutral-900/40 text-xs text-neutral-400 space-y-1">
              <div className="font-semibold text-white">Environment Requirements:</div>
              <p>• Node.js version 18+ or 20+</p>
              <p>• Port 3000 (configurable via PORT env var)</p>
              <p>• GEMINI_API_KEY set in .env file</p>
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="mt-6 pt-4 border-t border-neutral-800 flex items-center justify-between">
          <button
            onClick={copyAppUrl}
            className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 transition"
          >
            <Share2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>{copiedLink ? 'Link Copied!' : 'Copy Shareable URL'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-white transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
