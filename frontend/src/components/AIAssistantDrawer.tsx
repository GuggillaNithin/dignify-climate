import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  Send,
  Trash2,
  Bot,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import type { AnalysisResponse } from '../types/api';
import { AIBriefingCard } from './AIBriefingCard';

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  locationName: string;
  analysisResult: AnalysisResponse | null;
  onRunAnalysis?: () => void;
  isAnalyzing?: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  evidenceFacts?: string[];
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({
  isOpen,
  onClose,
  locationName,
  analysisResult,
  onRunAnalysis,
  isAnalyzing,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'briefing'>('chat');
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggested questions from PRD
  const SUGGESTED_PROMPTS = [
    'Explain the trend for this location',
    'Compare the earliest and latest periods',
    'Summarize the recorded hazard events',
    'Is the observed trend statistically significant?',
  ];

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab, isTyping]);

  if (!isOpen) return null;

  // Answer questions using pure verified evidence
  const generateGroundedResponse = (prompt: string): { reply: string; facts: string[] } => {
    if (!analysisResult) {
      return {
        reply:
          'No climate hazard analysis has been run yet for this location. Please run the analysis first to compute verified ECMWF ERA5 metrics.',
        facts: [],
      };
    }

    const {
      hazard_type,
      trends,
      annual_series,
      definitions_summary,
      spatial_metadata,
    } = analysisResult;

    const lower = prompt.toLowerCase();
    const hazardLabel = hazard_type.replace('_', ' ');
    const validYears = annual_series.filter((y) => y.is_available);
    const earliest = validYears.length > 0 ? validYears[0] : null;
    const latest = validYears.length > 0 ? validYears[validYears.length - 1] : null;
    const thresholdDesc = definitions_summary
      ? `${definitions_summary.threshold_percentile}th percentile (${definitions_summary.threshold_value} ${definitions_summary.threshold_unit})`
      : 'the configured threshold';

    if (lower.includes('trend') || lower.includes('explain')) {
      const slope = trends?.ols_regression?.slope_per_year;
      const pVal = trends?.mann_kendall?.p_value;
      const isSig = trends?.is_statistically_significant;
      const slopeText =
        slope !== undefined
          ? `${slope > 0 ? '+' : ''}${slope.toFixed(2)} days/year (${(slope * 10).toFixed(1)} days/decade)`
          : 'N/A';
      const sigText = isSig
        ? `statistically significant at the 95% confidence level (Mann–Kendall p = ${pVal?.toFixed(4)} < 0.05)`
        : `not statistically significant (Mann–Kendall p = ${pVal !== undefined ? pVal.toFixed(4) : 'N/A'} ≥ 0.05)`;

      return {
        reply: `For ${locationName}, the recorded ${hazardLabel} trend shows an OLS rate of ${slopeText}. This monotonic trend is ${sigText}. Analysis spans ${validYears.length} valid calendar years using ECMWF ERA5 reanalysis at ${thresholdDesc}.`,
        facts: [
          `OLS Rate: ${slopeText}`,
          `Mann–Kendall: ${sigText}`,
          `Spatial Scope: ${spatial_metadata?.representation_text || 'Single ERA5 Grid Cell'}`,
        ],
      };
    }

    if (lower.includes('compare') || lower.includes('earliest') || lower.includes('latest') || lower.includes('period')) {
      if (!earliest || !latest) {
        return {
          reply: 'Insufficient multi-year records to compare periods.',
          facts: [],
        };
      }
      const earlyDays = earliest.weighted_hazard_days?.toFixed(1) ?? 'N/A';
      const lateDays = latest.weighted_hazard_days?.toFixed(1) ?? 'N/A';
      const earlyEvents = earliest.weighted_event_count?.toFixed(1) ?? '0';
      const lateEvents = latest.weighted_event_count?.toFixed(1) ?? '0';

      return {
        reply: `Comparing initial and final calendar years: In ${earliest.year}, the location experienced ${earlyDays} ${hazardLabel} days across ${earlyEvents} qualifying events. By ${latest.year}, annual metrics recorded ${lateDays} days across ${lateEvents} events. Complete empirical series must be viewed in the context of interannual variability.`,
        facts: [
          `Earliest Year (${earliest.year}): ${earlyDays} days, ${earlyEvents} events`,
          `Latest Year (${latest.year}): ${lateDays} days, ${lateEvents} events`,
        ],
      };
    }

    if (lower.includes('event') || lower.includes('summarize')) {
      const events = analysisResult.events_list || [];
      const count = events.length;
      if (count === 0) {
        return {
          reply: `During the verified observation window (${validYears[0]?.year || 'earliest'} to ${validYears[validYears.length - 1]?.year || 'latest'}), no events met the qualifying criteria exceeding ${thresholdDesc}.`,
          facts: ['Total Qualifying Events: 0'],
        };
      }
      const maxDuration = Math.max(...events.map((e) => e.duration_days));
      const worstEvent = events.reduce((prev, current) =>
        current.intensity_metric > prev.intensity_metric ? current : prev
      );

      return {
        reply: `Dygnify identified ${count} qualifying ${hazardLabel} events. The longest uninterrupted event lasted ${maxDuration} consecutive days. The most intense event began on ${worstEvent.start_date} with a cumulative intensity exceedance of ${worstEvent.intensity_metric.toFixed(1)} degree-days.`,
        facts: [
          `Total Events: ${count}`,
          `Maximum Duration: ${maxDuration} consecutive days`,
          `Peak Event: ${worstEvent.start_date} (${worstEvent.intensity_metric.toFixed(1)} exceedance)`,
        ],
      };
    }

    if (lower.includes('significant') || lower.includes('p-value')) {
      const isSig = trends?.is_statistically_significant;
      const tau = trends?.mann_kendall?.tau;
      const p = trends?.mann_kendall?.p_value;
      return {
        reply: `The Mann–Kendall non-parametric test yields tau = ${tau?.toFixed(2) ?? 'N/A'} with p-value = ${p?.toFixed(4) ?? 'N/A'}. The trend is ${isSig ? 'statistically significant (p < 0.05)' : 'NOT statistically significant (p ≥ 0.05)'}. Scientific note: operational significance depends on the chosen percentile threshold (${thresholdDesc}).`,
        facts: [
          `Mann–Kendall tau: ${tau?.toFixed(2)}`,
          `p-value: ${p?.toFixed(4)}`,
          `Is Significant: ${isSig ? 'Yes (p < 0.05)' : 'No (p ≥ 0.05)'}`,
        ],
      };
    }

    // Default grounded synthesis
    const events = analysisResult.events_list || [];
    return {
      reply: `Analysis for ${locationName} indicates ${events.length} qualifying ${hazardLabel} events over ${validYears.length} certified years. The OLS rate is ${trends?.ols_regression?.slope_per_year?.toFixed(2) ?? 'N/A'} days/year at the ${thresholdDesc}.`,
      facts: [
        `Location: ${locationName}`,
        `Hazard: ${hazardLabel}`,
        `Operational Threshold: ${thresholdDesc}`,
      ],
    };
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const { reply, facts } = generateGroundedResponse(text);
      const botMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        evidenceFacts: facts,
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 450);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  return (
    <aside
      aria-label="AI Climate Assistant panel"
      className="fixed inset-y-0 right-0 z-[9990] w-full sm:w-[480px] lg:w-[500px] bg-white border-l border-slate-200 shadow-2xl flex flex-col pointer-events-auto transition-transform duration-300 ease-in-out font-sans overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-800">
            <Sparkles className="w-5 h-5 text-teal-700" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">
              AI Climate Assistant
            </h2>
            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
              <span>{locationName}</span>
              <span>•</span>
              <span className="text-teal-700 font-semibold">Strict Evidence Guardrails</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && activeTab === 'chat' && (
            <button
              type="button"
              onClick={handleClearChat}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition"
              title="Clear conversation"
              aria-label="Clear chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition"
            title="Close AI Assistant drawer"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mode Tabs: Interactive Chat vs Evidence Synthesis Briefing */}
      <div className="flex items-center border-b border-slate-200 bg-white px-4 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`py-2.5 px-3 border-b-2 font-semibold transition ${
            activeTab === 'chat'
              ? 'border-teal-700 text-teal-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Interactive Q&A
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('briefing')}
          className={`py-2.5 px-3 border-b-2 font-semibold transition ${
            activeTab === 'briefing'
              ? 'border-teal-700 text-teal-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Synthesized Briefing
        </button>
      </div>

      {/* Main Tab View */}
      {activeTab === 'chat' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {/* Grounding Guardrail Badge */}
            <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200/80 text-xs text-teal-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed text-[11px]">
                <span className="font-bold">Evidence Grounded: </span>
                Responses are strictly synthesized from Python statistical outputs (ECMWF ERA5 reanalysis). The assistant will not hallucinate unverified causal claims or metrics.
              </div>
            </div>

            {/* Empty State with Suggested Prompts */}
            {messages.length === 0 && (
              <div className="py-6 text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-teal-700 shadow-xs">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Ask About Climate Trends
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Select a question below or enter your own query regarding {locationName}&apos;s hazard trends.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 pt-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSendMessage(prompt)}
                      className="text-left px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-xs text-slate-700 hover:text-teal-900 transition flex items-center justify-between group"
                    >
                      <span>{prompt}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700 transition" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message Thread */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-teal-700 text-white rounded-br-xs shadow-xs'
                      : 'bg-slate-100 border border-slate-200 text-slate-800 rounded-bl-xs'
                  }`}
                >
                  <p>{msg.text}</p>

                  {/* Grounded Fact Citations */}
                  {msg.evidenceFacts && msg.evidenceFacts.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200/80 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Verified Facts:
                      </div>
                      <ul className="text-[11px] font-mono text-teal-800 space-y-0.5 list-disc pl-3">
                        {msg.evidenceFacts.map((fact, idx) => (
                          <li key={idx}>{fact}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-slate-100 text-slate-500 text-xs w-24 animate-pulse">
                <Bot className="w-3.5 h-3.5 text-teal-700" />
                <span>Thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about trends, significance, or events..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-700 focus:bg-white transition"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="p-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white transition disabled:opacity-40 disabled:hover:bg-teal-700 shadow-xs"
                title="Send message"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Synthesized Briefing Tab: Embedding AIBriefingCard */
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {analysisResult ? (
            <AIBriefingCard analysis={analysisResult} />
          ) : (
            <div className="text-center py-12 space-y-3">
              <Bot className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Run climate hazard analysis to generate an evidence-grounded briefing.
              </p>
              {onRunAnalysis && (
                <button
                  type="button"
                  onClick={onRunAnalysis}
                  disabled={isAnalyzing}
                  className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs"
                >
                  Run Analysis
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
