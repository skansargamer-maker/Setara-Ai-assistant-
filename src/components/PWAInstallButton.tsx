import React from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  onOpenModal?: () => void;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  onOpenModal,
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  // If already running in standalone mode, hide direct install prompt
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Edge / Desktop 1-click install flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        title="Install Setara App"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/20 text-xs font-semibold transition ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // General install / download helper trigger
  return (
    <button
      onClick={onOpenModal}
      title="Install or Download App"
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cyan-500/40 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-300 hover:text-white transition text-xs font-medium ${className}`}
    >
      <Download className="w-3.5 h-3.5 text-cyan-400" />
      <span>{isIOS ? 'Install on iOS' : 'Install App'}</span>
    </button>
  );
};
