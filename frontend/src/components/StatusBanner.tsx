import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { ConnectionState } from '../types/api';

interface StatusBannerProps {
  connectionState: ConnectionState;
  errorMessage: string | null;
  apiBaseUrl: string;
  onRetry: () => void;
}

export const StatusBanner: React.FC<StatusBannerProps> = ({
  connectionState,
  errorMessage,
  apiBaseUrl,
  onRetry,
}) => {
  if (connectionState === 'connected') {
    return null;
  }

  if (connectionState === 'checking') {
    return (
      <div className="bg-space-900 border-b border-space-700 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Establishing connection to Dygnify backend at <code className="font-mono bg-space-950 px-1.5 py-0.5 rounded">{apiBaseUrl}</code>...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-rose-950/70 border-b border-rose-800/80 px-4 py-3 text-rose-100">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-rose-200">Backend API Offline:</span>{' '}
            <span className="text-rose-100/90">
              Cannot connect to Backend API. Try reconnecting and wait until backend connects.
            </span>
            <p className="text-xs text-rose-200/80 mt-1">
              Scientific integrity rule: All thresholds, Mann-Kendall statistics, and event counts are calculated server-side by deterministic Python routines. No simulated or synthetic observations will be rendered while disconnected.
            </p>
            {errorMessage && (
              <p className="text-xs font-mono text-rose-300/80 mt-1 bg-rose-950/80 p-1.5 rounded border border-rose-900/50">
                Detail: {errorMessage}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center shrink-0">
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-850 hover:bg-rose-800 text-rose-100 border border-rose-700 text-xs font-medium transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      </div>
    </div>
  );
};
