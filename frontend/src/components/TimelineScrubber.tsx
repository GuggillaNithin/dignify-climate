import { useState, useEffect } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Play,
  Pause,
  RotateCcw,
  Calendar,
} from 'lucide-react';
import type { RegionalAnnualMetric } from '../types/api';

interface TimelineScrubberProps {
  startYear: number;
  endYear: number;
  selectedYear: number | null;
  onYearSelect: (year: number) => void;
  annualSeries?: RegionalAnnualMetric[];
  hazardLabel?: string;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  startYear,
  endYear,
  selectedYear,
  onYearSelect,
  annualSeries = [],
  hazardLabel = 'Hazard',
}) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });
  const [isPlaying, setIsPlaying] = useState(false);

  // Generate array of years
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }

  // Animation player
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      onYearSelect(
        selectedYear === null || selectedYear >= endYear ? startYear : selectedYear + 1
      );
    }, 1200);

    return () => clearInterval(interval);
  }, [isPlaying, selectedYear, startYear, endYear, onYearSelect]);

  const seriesByYear = new Map<number, RegionalAnnualMetric>();
  annualSeries.forEach((pt) => {
    seriesByYear.set(pt.year, pt);
  });

  // Maximum hazard days for relative bar height
  const maxDays = Math.max(
    1,
    ...annualSeries.map((s) => s.weighted_hazard_days || 0)
  );

  return (
    <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto transition-all max-w-[calc(100vw-2rem)]">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden font-sans">
        {/* Header / Collapse Toggle Bar */}
        <div className="px-3.5 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-teal-700" />
            <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
              Temporal Timeline ({startYear}–{endYear})
            </span>
            {selectedYear && (
              <span className="font-mono text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-[11px]">
                {selectedYear}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition"
              title={isPlaying ? 'Pause timeline playback' : 'Play timeline animation'}
              aria-label={isPlaying ? 'Pause playback' : 'Play animation'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                onYearSelect(endYear);
              }}
              className="p-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition"
              title="Reset to latest year"
              aria-label="Reset to latest year"
            >
              <RotateCcw className="w-3 h-3" />
            </button>

            <div className="h-3 w-px bg-slate-200 mx-0.5" />

            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition"
              title={isCollapsed ? 'Expand timeline' : 'Collapse timeline'}
              aria-label={isCollapsed ? 'Expand timeline' : 'Collapse timeline'}
            >
              {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {!isCollapsed && (
          <div className="p-2.5 sm:p-3">
            <div className="flex items-end gap-1 sm:gap-2 overflow-x-auto max-w-[85vw] sm:max-w-[450px] md:max-w-[550px] lg:max-w-[650px] no-scrollbar pb-1">
              {years.map((year) => {
                const metric = seriesByYear.get(year);
                const days = metric?.weighted_hazard_days ?? 0;
                const isAvailable = metric?.is_available ?? true;
                const isSelected = selectedYear === year;
                const barHeightPct = Math.max(15, Math.round((days / maxDays) * 100));

                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      onYearSelect(year);
                    }}
                    className={`flex flex-col items-center group transition focus:outline-none ${
                      isSelected ? 'scale-105' : 'hover:scale-102'
                    }`}
                  >
                    {/* Micro bar indicator */}
                    <div className="h-10 w-6 sm:w-8 flex items-end justify-center pb-1">
                      <div
                        style={{ height: `${barHeightPct}%` }}
                        className={`w-3 sm:w-4 rounded-t transition-all ${
                          isSelected
                            ? 'bg-teal-700 shadow-xs'
                            : days > 0
                            ? 'bg-teal-200 group-hover:bg-teal-300'
                            : 'bg-slate-200 group-hover:bg-slate-300'
                        }`}
                        title={`${year}: ${days.toFixed(1)} ${hazardLabel} days`}
                      />
                    </div>

                    {/* Year pill */}
                    <div
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                        isSelected
                          ? 'bg-teal-700 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      {year}
                    </div>

                    {/* Status dot */}
                    <div className="mt-0.5">
                      {metric ? (
                        isAvailable ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Certified complete" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Incomplete coverage" />
                        )
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
