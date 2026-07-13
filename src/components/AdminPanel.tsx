/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { VisitorRegistration } from '../types';
import { 
  X, Search, Download, Trash2, Calendar, FileText, 
  Users, CheckCircle, ShieldAlert, Award, ArrowLeft, Eye,
  Mic, RotateCcw, Save, Check, Settings2
} from 'lucide-react';
import { VoiceInstructionsConfig, DEFAULT_VOICE_INSTRUCTIONS } from '../constants/voiceInstructions';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  registrations: VisitorRegistration[];
  onDeleteRegistration: (id: string) => void;
  onClearAll: () => void;
  isDark: boolean;
  voiceInstructions: VoiceInstructionsConfig;
  onUpdateVoiceInstructions: (instructions: VoiceInstructionsConfig) => void;
}

export default function AdminPanel({
  isOpen,
  onClose,
  registrations,
  onDeleteRegistration,
  onClearAll,
  isDark,
  voiceInstructions,
  onUpdateVoiceInstructions
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'logs' | 'instructions'>('logs');
  const [localInstructions, setLocalInstructions] = useState<VoiceInstructionsConfig>(voiceInstructions);
  const [isSaveSuccess, setIsSaveSuccess] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorRegistration | null>(null);

  // Sync state when modal opens or parent instructions update
  useEffect(() => {
    if (isOpen) {
      setLocalInstructions(voiceInstructions);
    }
  }, [voiceInstructions, isOpen]);

  const handleInstructionChange = (key: keyof VoiceInstructionsConfig, value: string) => {
    setLocalInstructions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveInstructions = () => {
    onUpdateVoiceInstructions(localInstructions);
    setIsSaveSuccess(true);
    setTimeout(() => {
      setIsSaveSuccess(false);
    }, 2500);
  };

  const handleRestoreDefaults = () => {
    if (window.confirm('Are you sure you want to restore all voice instructions to defaults?')) {
      setLocalInstructions(DEFAULT_VOICE_INSTRUCTIONS);
    }
  };

  // Group registrations by Event Name
  const eventsMap = useMemo(() => {
    const groups: { [key: string]: { name: string; items: VisitorRegistration[] } } = {};
    registrations.forEach((reg) => {
      const eventKey = reg.eventId || 'visitor_registration';
      if (!groups[eventKey]) {
        groups[eventKey] = {
          name: reg.eventName || 'Visitor Registration',
          items: []
        };
      }
      groups[eventKey].items.push(reg);
    });
    return groups;
  }, [registrations]);

  const eventKeys = Object.keys(eventsMap);

  // If no event is selected and there are events, default to the first one
  const activeEventKey = selectedEventId || (eventKeys.length > 0 ? eventKeys[0] : null);
  const activeEvent = activeEventKey ? eventsMap[activeEventKey] : null;

  // Filter visitors within the active event
  const filteredVisitors = useMemo(() => {
    if (!activeEvent) return [];
    return activeEvent.items.filter((item) => {
      const textToSearch = Object.values(item.fields).join(' ').toLowerCase();
      return textToSearch.includes(searchQuery.toLowerCase());
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [activeEvent, searchQuery]);

  if (!isOpen) return null;

  // Export to CSV helper
  const exportToCSV = (eventName: string, items: VisitorRegistration[]) => {
    if (items.length === 0) return;
    
    // Gather all unique keys across registrations
    const fieldKeysSet = new Set<string>();
    items.forEach(item => {
      Object.keys(item.fields).forEach(key => {
        const val = item.fields[key];
        if (key !== 'photo' && !String(val).startsWith('data:image')) {
          fieldKeysSet.add(key); // exclude photo data from CSV string
        }
      });
    });
    const fieldKeys = Array.from(fieldKeysSet);

    // CSV Headers
    const headers = ['Registration ID', 'Timestamp', ...fieldKeys.map(k => k.toUpperCase())];
    
    // CSV Rows
    const rows = items.map(item => {
      return [
        item.id,
        new Date(item.timestamp).toLocaleString(),
        ...fieldKeys.map(key => {
          const val = item.fields[key] || '';
          // escape quotes
          return `"${val.replace(/"/g, '""')}"`;
        })
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${eventName.replace(/\s+/g, '_')}_guests.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-neutral-900/60 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
      <div 
        id="admin-dashboard-container"
        className={`w-full max-w-xl mx-auto my-auto rounded-3xl shadow-2xl flex flex-col overflow-hidden h-[90vh] transition-all duration-300 border ${
          isDark 
            ? 'bg-neutral-950 border-neutral-800 text-neutral-100' 
            : 'bg-white border-neutral-100 text-neutral-800'
        }`}
      >
        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center shrink-0 ${isDark ? 'border-neutral-800 bg-neutral-900/40' : 'border-neutral-100 bg-neutral-50/40'}`}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white font-black text-xs shadow-sm">
              Q
            </div>
            <div>
              <h3 className="font-bold text-xs tracking-tight">QPass Admin Portal</h3>
              <p className={`text-[9px] ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Monitor registered logs & check-ins
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-admin-button"
            onClick={onClose}
            className={`p-1.5 rounded-full hover:scale-105 transition-all ${isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className={`flex border-b text-xs shrink-0 ${isDark ? 'border-neutral-800 bg-neutral-950/20' : 'border-neutral-100 bg-neutral-50/20'}`}>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-3 text-center font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'logs'
                ? 'border-indigo-500 text-indigo-500 bg-indigo-500/5'
                : 'border-transparent hover:text-neutral-500 text-neutral-400'
            }`}
          >
            <FileText size={14} />
            Visitor Logs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('instructions')}
            className={`flex-1 py-3 text-center font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'instructions'
                ? 'border-indigo-500 text-indigo-500 bg-indigo-500/5'
                : 'border-transparent hover:text-neutral-500 text-neutral-400'
            }`}
          >
            <Mic size={14} />
            Voice Instructions
          </button>
        </div>

        {/* Content Body */}
        {activeTab === 'logs' ? (
          registrations.length === 0 ? (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className={`p-4 rounded-full mb-3 ${isDark ? 'bg-neutral-900 text-neutral-600' : 'bg-neutral-100 text-neutral-300'}`}>
                <Users size={40} />
              </div>
              <h4 className="font-bold text-sm">No registrations yet</h4>
              <p className={`text-xs mt-1 max-w-xs ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Once visitors use the voice assistant or submit the check-in form, logs will populate here.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* Sidebar with Events List */}
              <div className={`w-full md:w-48 border-r shrink-0 flex flex-col p-3 gap-2 overflow-y-auto ${isDark ? 'border-neutral-800 bg-neutral-900/10' : 'border-neutral-100 bg-neutral-50/40'}`}>
                <span className={`text-[10px] font-bold tracking-wider uppercase mb-1 px-1 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Active Events
                </span>
                <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 shrink-0">
                  {eventKeys.map((key) => {
                    const ev = eventsMap[key];
                    const isActive = activeEventKey === key;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          setSelectedEventId(key);
                          setSelectedVisitor(null);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all shrink-0 md:shrink flex items-center justify-between gap-2 ${
                          isActive
                            ? 'bg-sky-500 text-white shadow-sm'
                            : isDark
                              ? 'hover:bg-neutral-900 text-neutral-300'
                              : 'hover:bg-neutral-100 text-neutral-600'
                        }`}
                      >
                        <span className="truncate max-w-[100px] md:max-w-none">{ev.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-200 text-neutral-600'}`}>
                          {ev.items.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main Log Viewer */}
              <div className="flex-1 flex flex-col overflow-hidden p-4 min-w-0">
                {activeEvent && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Top Info & Actions bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 mb-3">
                      <div>
                        <h4 className="font-bold text-xs tracking-tight uppercase text-indigo-500 flex items-center gap-1">
                          <Calendar size={12} />
                          {activeEvent.name}
                        </h4>
                        <p className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                          {activeEvent.items.length} registered visitor(s)
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          id="export-csv-button"
                          onClick={() => exportToCSV(activeEvent.name, activeEvent.items)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-sm transition-all border ${
                            isDark 
                              ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800' 
                              : 'bg-white hover:bg-neutral-50 text-neutral-600 border-neutral-200'
                          }`}
                        >
                          <Download size={12} />
                          Export CSV
                        </button>
                      </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative shrink-0 mb-3">
                      <Search size={14} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`} />
                      <input
                        type="text"
                        placeholder="Search guests by name or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all ${
                          isDark 
                            ? 'bg-neutral-900 border-neutral-800 text-neutral-200 focus:border-sky-500/50' 
                            : 'bg-neutral-50 border-neutral-200 text-neutral-800 focus:border-sky-500'
                        }`}
                      />
                    </div>

                    {/* Log List */}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {filteredVisitors.length === 0 ? (
                        <p className={`text-center py-6 text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                          No matches found
                        </p>
                      ) : (
                        filteredVisitors.map((reg) => {
                          // Look for name or phone in dynamic fields
                          const nameKey = Object.keys(reg.fields).find(k => k.toLowerCase().includes('name')) || '';
                          const mobileKey = Object.keys(reg.fields).find(k => k.toLowerCase().includes('mobile') || k.toLowerCase().includes('phone') || k.toLowerCase().includes('tel')) || '';
                          const purposeKey = Object.keys(reg.fields).find(k => k.toLowerCase().includes('purpose') || k.toLowerCase().includes('visit')) || '';
                          
                          const nameVal = reg.fields[nameKey] || 'Anonymous Visitor';
                          const mobileVal = reg.fields[mobileKey] || 'N/A';
                          const purposeVal = reg.fields[purposeKey] || 'N/A';
                          let photoVal = reg.fields['photo'];
                          if (!photoVal) {
                            const foundKey = Object.keys(reg.fields).find(k => 
                              String(reg.fields[k]).startsWith('data:image') || k.toLowerCase().includes('photo')
                            );
                            if (foundKey) {
                              photoVal = reg.fields[foundKey];
                            }
                          }

                          return (
                            <div
                              key={reg.id}
                              className={`p-3 rounded-2xl border flex items-center justify-between gap-3 group transition-all duration-300 ${
                                isDark 
                                  ? 'bg-neutral-900/40 hover:bg-neutral-900/85 border-neutral-850' 
                                  : 'bg-neutral-50/50 hover:bg-neutral-50 border-neutral-150'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {/* Photo thumbnail or avatar */}
                                {photoVal ? (
                                  <img
                                    src={photoVal}
                                    alt={nameVal}
                                    className="w-10 h-10 rounded-xl object-cover shrink-0 shadow-sm border border-neutral-200"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border text-xs font-bold ${
                                    isDark ? 'bg-neutral-800 border-neutral-700 text-neutral-400' : 'bg-neutral-200/50 border-neutral-300 text-neutral-500'
                                  }`}>
                                    IMG
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <h5 className="font-bold text-xs truncate">{nameVal}</h5>
                                  <p className={`text-[10px] font-medium truncate ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                    {mobileVal} • {purposeVal}
                                  </p>
                                  <p className={`text-[9px] mt-0.5 ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`}>
                                    {new Date(reg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>

                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => setSelectedVisitor(reg)}
                                  className={`p-1.5 rounded-lg hover:scale-105 transition-all text-indigo-500 hover:bg-indigo-500/10`}
                                  title="View check-in details"
                                >
                                  <Eye size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteRegistration(reg.id)}
                                  className={`p-1.5 rounded-lg hover:scale-105 transition-all text-rose-500 hover:bg-rose-500/10`}
                                  title="Delete guest log"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        ) : (
          /* Voice Instructions Editor Tab content */
          <div className="flex-1 flex flex-col overflow-hidden">
            {isSaveSuccess && (
              <div className="mx-4 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center gap-2 text-xs font-bold animate-scale-up shrink-0">
                <CheckCircle size={14} className="animate-bounce" />
                Voice instructions saved successfully!
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className={`p-3.5 rounded-2xl border flex items-start gap-3 ${isDark ? 'bg-indigo-950/10 border-indigo-850 text-indigo-300' : 'bg-indigo-50/50 border-indigo-100 text-indigo-700'}`}>
                <ShieldAlert size={18} className="shrink-0 mt-0.5 text-indigo-500" />
                <div className="text-xs space-y-1">
                  <span className="font-bold block">Voice Agent Tuning</span>
                  <span className="opacity-80 block leading-relaxed">
                    Customize the voice prompts used by the AI Agent below. Your speech synthesis engine will read these aloud during the registration flow.
                  </span>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Greeting */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Welcome Greeting Speech
                  </label>
                  <textarea
                    value={localInstructions.GREETING}
                    onChange={(e) => handleInstructionChange('GREETING', e.target.value)}
                    className={`w-full p-3 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none h-18 ${
                      isDark 
                        ? 'bg-neutral-900 border-neutral-800 text-neutral-200 focus:border-indigo-500/50' 
                        : 'bg-neutral-50 border-neutral-200 text-neutral-800 focus:border-indigo-500'
                    }`}
                    placeholder="Welcome greeting..."
                  />
                </div>

                {/* Retry Prefix */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Retry Question Prefix
                  </label>
                  <input
                    type="text"
                    value={localInstructions.RETRY_PREFIX}
                    onChange={(e) => handleInstructionChange('RETRY_PREFIX', e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                      isDark 
                        ? 'bg-neutral-900 border-neutral-800 text-neutral-200 focus:border-indigo-500/50' 
                        : 'bg-neutral-50 border-neutral-200 text-neutral-800 focus:border-indigo-500'
                    }`}
                    placeholder="Retry prefix..."
                  />
                </div>

                {/* Got Answer */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Answer Received Feedback
                  </label>
                  <input
                    type="text"
                    value={localInstructions.GOT_ANSWER}
                    onChange={(e) => handleInstructionChange('GOT_ANSWER', e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                      isDark 
                        ? 'bg-neutral-900 border-neutral-800 text-neutral-200 focus:border-indigo-500/50' 
                        : 'bg-neutral-50 border-neutral-200 text-neutral-800 focus:border-indigo-500'
                    }`}
                    placeholder="Answer acknowledged..."
                  />
                </div>

                {/* Photo Captured */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Photo Captured Feedback
                  </label>
                  <input
                    type="text"
                    value={localInstructions.PHOTO_CAPTURED}
                    onChange={(e) => handleInstructionChange('PHOTO_CAPTURED', e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                      isDark 
                        ? 'bg-neutral-900 border-neutral-800 text-neutral-200 focus:border-indigo-500/50' 
                        : 'bg-neutral-50 border-neutral-200 text-neutral-800 focus:border-indigo-500'
                    }`}
                    placeholder="Photo captured feedback..."
                  />
                </div>

                {/* Success */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Check-In Success Speech
                  </label>
                  <textarea
                    value={localInstructions.REGISTRATION_SUCCESS}
                    onChange={(e) => handleInstructionChange('REGISTRATION_SUCCESS', e.target.value)}
                    className={`w-full p-3 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none h-18 ${
                      isDark 
                        ? 'bg-neutral-900 border-neutral-800 text-neutral-200 focus:border-indigo-500/50' 
                        : 'bg-neutral-50 border-neutral-200 text-neutral-800 focus:border-indigo-500'
                    }`}
                    placeholder="Check-in success..."
                  />
                </div>

                {/* Timeout Reset */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Inactivity Reset Warning
                  </label>
                  <textarea
                    value={localInstructions.TIMEOUT_RESET}
                    onChange={(e) => handleInstructionChange('TIMEOUT_RESET', e.target.value)}
                    className={`w-full p-3 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none h-18 ${
                      isDark 
                        ? 'bg-neutral-900 border-neutral-800 text-neutral-200 focus:border-indigo-500/50' 
                        : 'bg-neutral-50 border-neutral-200 text-neutral-800 focus:border-indigo-500'
                    }`}
                    placeholder="Timeout reset warning..."
                  />
                </div>

                {/* Fallback Custom Question */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Fallback Question for Custom Fields
                  </label>
                  <input
                    type="text"
                    value={localInstructions.CUSTOM_FIELD_DEFAULT_QUESTION}
                    onChange={(e) => handleInstructionChange('CUSTOM_FIELD_DEFAULT_QUESTION', e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                      isDark 
                        ? 'bg-neutral-900 border-neutral-800 text-neutral-200 focus:border-indigo-500/50' 
                        : 'bg-neutral-50 border-neutral-200 text-neutral-800 focus:border-indigo-500'
                    }`}
                    placeholder="Default custom field question..."
                  />
                </div>

                {/* Unsupported Alert */}
                <div className="space-y-1.5">
                  <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Unsupported Browser Warning Text
                  </label>
                  <textarea
                    value={localInstructions.UNSUPPORTED_BROWSER_ALERT}
                    onChange={(e) => handleInstructionChange('UNSUPPORTED_BROWSER_ALERT', e.target.value)}
                    className={`w-full p-3 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none h-18 ${
                      isDark 
                        ? 'bg-neutral-900 border-neutral-800 text-neutral-200 focus:border-indigo-500/50' 
                        : 'bg-neutral-50 border-neutral-200 text-neutral-800 focus:border-indigo-500'
                    }`}
                    placeholder="Unsupported alert..."
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Visitor Check-in Card (Modal Overlay) */}
        {selectedVisitor && (
          <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <div className={`w-full max-w-sm rounded-3xl p-5 border relative shadow-2xl animate-scale-up ${
              isDark ? 'bg-neutral-900 border-neutral-800 text-white' : 'bg-white border-neutral-100 text-neutral-800'
            }`}>
              <button
                type="button"
                onClick={() => setSelectedVisitor(null)}
                className={`absolute top-4 right-4 p-1 rounded-full ${isDark ? 'hover:bg-neutral-850 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}
              >
                <X size={16} />
              </button>

              <div className="flex flex-col items-center text-center mt-2">
                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 mb-3">
                  CHECK-IN VERIFIED
                </span>
                
                {/* Guest Photo Badge */}
                <div className="relative mb-4">
                  {(() => {
                    let photoVal = selectedVisitor.fields['photo'];
                    if (!photoVal) {
                      const foundKey = Object.keys(selectedVisitor.fields).find(k => 
                        String(selectedVisitor.fields[k]).startsWith('data:image') || k.toLowerCase().includes('photo')
                      );
                      if (foundKey) {
                        photoVal = selectedVisitor.fields[foundKey];
                      }
                    }
                    return photoVal ? (
                      <img
                        src={photoVal}
                        alt="Verified Visitor"
                        className="w-28 h-28 rounded-full object-cover shadow-lg border-2 border-indigo-500"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className={`w-28 h-28 rounded-full flex items-center justify-center text-xs font-bold border-2 border-dashed ${
                        isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-neutral-100 border-neutral-300'
                      }`}>
                        No Photo Captured
                      </div>
                    );
                  })()}
                  <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white p-1.5 rounded-full shadow border-2 border-white">
                    <Award size={14} />
                  </div>
                </div>

                <h4 className="font-bold text-base leading-tight">
                  {selectedVisitor.fields[Object.keys(selectedVisitor.fields).find(k => k.toLowerCase().includes('name')) || ''] || 'Guest'}
                </h4>
                <p className={`text-[10px] mt-1 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Checked in at: {new Date(selectedVisitor.timestamp).toLocaleString()}
                </p>

                {/* Captured Fields List */}
                <div className={`w-full text-left mt-5 p-3.5 rounded-2xl space-y-2.5 text-xs ${
                  isDark ? 'bg-neutral-950/80' : 'bg-neutral-50'
                }`}>
                  {Object.entries(selectedVisitor.fields).map(([key, val]) => {
                    if (key === 'photo' || String(val).startsWith('data:image')) return null;
                    return (
                      <div key={key} className="border-b last:border-0 pb-2 last:pb-0 border-neutral-200/50">
                        <span className={`block text-[9px] font-bold tracking-wider uppercase ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                          {key.replace('_', ' ')}
                        </span>
                        <span className="font-semibold block break-all text-neutral-800 dark:text-neutral-200 mt-0.5">
                          {val || 'N/A'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Footer */}
        <div className={`p-4 border-t flex items-center justify-between shrink-0 ${isDark ? 'border-neutral-800 bg-neutral-900/40' : 'border-neutral-100 bg-neutral-50/40'}`}>
          {activeTab === 'logs' ? (
            <button
              type="button"
              id="clear-all-data-button"
              onClick={() => {
                if (window.confirm('Are you absolutely sure you want to delete ALL registrations? This cannot be undone.')) {
                  onClearAll();
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border text-rose-500 border-rose-500/20 hover:bg-rose-500/5`}
            >
              <Trash2 size={13} />
              Wipe DB
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                id="restore-defaults-button"
                onClick={handleRestoreDefaults}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border border-neutral-200 hover:bg-neutral-100 text-neutral-500 dark:border-neutral-800 dark:hover:bg-neutral-900 dark:text-neutral-400`}
              >
                <RotateCcw size={13} />
                Defaults
              </button>

              <button
                type="button"
                id="save-instructions-button"
                onClick={handleSaveInstructions}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/10 transition-all hover:scale-105"
              >
                <Save size={13} />
                Save Changes
              </button>
            </div>
          )}

          <button
            type="button"
            id="back-to-checkin-button"
            onClick={onClose}
            className={`flex items-center gap-1.5 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold shadow transition-all`}
          >
            <ArrowLeft size={13} />
            Close Portal
          </button>
        </div>
      </div>
    </div>
  );
}
