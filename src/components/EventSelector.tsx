import React, { useState } from 'react';
import { 
  Calendar, Plus, Play, LogOut, CheckSquare, Square, ChevronRight, AlertCircle, Sparkles, Layout, Eye, Trash2, Sun, Moon
} from 'lucide-react';
import { UserProfile, EventConfig, FieldConfig } from '../types';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface EventSelectorProps {
  isDark: boolean;
  onToggleTheme: () => void;
  currentUser: UserProfile;
  userEvents: EventConfig[];
  onSelectEvent: (event: EventConfig) => void;
  onLogout: () => void;
}

const PRESET_FIELDS = [
  { id: 'name', name: 'Visitor Name', type: 'text', question: 'What is your name?', enabled: true },
  { id: 'mobile', name: 'Mobile Number', type: 'tel', question: 'What is your mobile number?', enabled: true },
  { id: 'purpose', name: 'Purpose of Visit', type: 'text', question: 'What is the purpose of your visit?', enabled: true },
  { id: 'photo', name: 'Face Scan (Photo)', type: 'photo', question: 'Please look at the camera for a quick face capture.', enabled: true }
];

export function EventSelector({ isDark, onToggleTheme, currentUser, userEvents, onSelectEvent, onLogout }: EventSelectorProps) {
  const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');
  
  // New event state
  const [newEventName, setNewEventName] = useState('');
  const [selectedFields, setSelectedFields] = useState<typeof PRESET_FIELDS>(PRESET_FIELDS);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Toggle field selection in New Event config
  const handleToggleFieldPreset = (fieldId: string) => {
    setSelectedFields(prev =>
      prev.map(f => f.id === fieldId ? { ...f, enabled: !f.enabled } : f)
    );
  };

  // Update question text in New Event config
  const handleQuestionChange = (fieldId: string, value: string) => {
    setSelectedFields(prev =>
      prev.map(f => f.id === fieldId ? { ...f, question: value } : f)
    );
  };

  // Update field name (label) in New Event config
  const handleFieldNameChange = (fieldId: string, value: string) => {
    setSelectedFields(prev =>
      prev.map(f => f.id === fieldId ? { ...f, name: value } : f)
    );
  };

  // Update field type in New Event config
  const handleFieldTypeChange = (fieldId: string, value: 'text' | 'tel' | 'photo') => {
    setSelectedFields(prev =>
      prev.map(f => f.id === fieldId ? { ...f, type: value } : f)
    );
  };

  // Add a new custom field
  const handleAddCustomField = () => {
    const customId = `custom_${Date.now()}`;
    setSelectedFields(prev => [
      ...prev,
      {
        id: customId,
        name: 'Custom Field',
        type: 'text',
        question: 'Could you please specify?',
        enabled: true
      }
    ]);
  };

  // Remove a field
  const handleRemoveField = (fieldId: string) => {
    setSelectedFields(prev => prev.filter(f => f.id !== fieldId));
  };

  // Submit/Save New Event to Firestore
  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!newEventName.trim()) {
      setErrorMsg('Please enter an Event Name.');
      return;
    }

    const enabledFields = selectedFields.filter(f => f.enabled);
    if (enabledFields.length === 0) {
      setErrorMsg('Please select at least one field to collect.');
      return;
    }

    setIsSaving(true);
    try {
      const eventId = `event_${Date.now()}`;
      const fieldsConfig: FieldConfig[] = enabledFields.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type as 'text' | 'tel' | 'photo',
        question: f.question
      }));

      const newEvent: EventConfig = {
        id: eventId,
        userId: currentUser.uid,
        name: newEventName.trim(),
        fields: fieldsConfig
      };

      // Write to Firestore events table (Collection: events)
      await setDoc(doc(db, 'events', eventId), newEvent);

      // Reset form & Switch Tab
      setNewEventName('');
      setSelectedFields(PRESET_FIELDS);
      setActiveTab('existing');
      
      // Auto launch
      onSelectEvent(newEvent);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to save event. Please check Firestore permissions.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete event with validation
  const handleDeleteEvent = async (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering event select
    if (window.confirm('Are you sure you want to delete this event? This will not wipe visitor logs but will delete the event design.')) {
      try {
        await deleteDoc(doc(db, 'events', eventId));
      } catch (err) {
        console.error("Error deleting event:", err);
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      
      {/* Dynamic Header */}
      <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${isDark ? 'border-neutral-800 bg-neutral-900/10' : 'border-neutral-100 bg-neutral-50/40'}`}>
        <div className="flex items-center gap-2">
          {/* Logo badge */}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white font-black text-xs shadow-sm">
            Q
          </div>
          <div>
            <h1 className="text-xs font-black tracking-tight leading-none">QPass</h1>
            <h2 className={`text-[10px] font-bold leading-none mt-1 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Hi, {currentUser.name}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Dark mode Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            className={`p-2 rounded-xl transition-all hover:scale-105 border ${
              isDark 
                ? 'bg-neutral-900 border-neutral-800 text-amber-400 hover:bg-neutral-850' 
                : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
            }`}
            title="Toggle Dark Mode"
          >
            {isDark ? <Sun size={13} /> : <Moon size={13} />}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
              isDark 
                ? 'border-neutral-800 hover:bg-neutral-900 text-neutral-400' 
                : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
            }`}
            title="Sign Out"
          >
            <LogOut size={11} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex border-b text-[11px] shrink-0 ${isDark ? 'border-neutral-800 bg-neutral-950/20' : 'border-neutral-100 bg-neutral-50/20'}`}>
        <button
          type="button"
          onClick={() => { setErrorMsg(''); setActiveTab('existing'); }}
          className={`flex-1 py-3 text-center font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'existing'
              ? 'border-indigo-500 text-indigo-500 bg-indigo-500/5'
              : 'border-transparent hover:text-neutral-500 text-neutral-400'
          }`}
        >
          <Calendar size={13} />
          Your Events ({userEvents.length})
        </button>
        <button
          type="button"
          onClick={() => { setErrorMsg(''); setActiveTab('new'); }}
          className={`flex-1 py-3 text-center font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'new'
              ? 'border-indigo-500 text-indigo-500 bg-indigo-500/5'
              : 'border-transparent hover:text-neutral-500 text-neutral-400'
          }`}
        >
          <Plus size={13} />
          New Event Setup
        </button>
      </div>

      {/* Content wrapper */}
      <div className="flex-1 overflow-y-auto p-5">
        
        {/* EXISTING EVENTS TAB */}
        {activeTab === 'existing' && (
          <div className="space-y-3 animate-scale-up">
            {userEvents.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-3">
                <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${isDark ? 'bg-neutral-900 text-neutral-600' : 'bg-neutral-100 text-neutral-300'}`}>
                  <Calendar size={22} />
                </div>
                <div>
                  <h4 className="font-bold text-xs">No Events Created Yet</h4>
                  <p className={`text-[11px] mt-1 max-w-xs mx-auto ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    Configure a new registration event with voice capability using the custom form builder above.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('new')}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-bold shadow-lg shadow-indigo-500/10 transition-all hover:scale-105 inline-flex items-center gap-1"
                >
                  <Plus size={12} />
                  Setup First Event
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <span className={`text-[9px] font-bold tracking-wider uppercase block px-1 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Select an event to launch kiosk
                </span>
                
                {userEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => onSelectEvent(event)}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 group cursor-pointer hover:scale-[1.01] transition-all duration-250 ${
                      isDark 
                        ? 'bg-neutral-900/30 hover:bg-neutral-900/80 border-neutral-850 hover:border-indigo-500/30' 
                        : 'bg-neutral-50/50 hover:bg-white border-neutral-150 hover:border-indigo-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                        isDark ? 'bg-indigo-950/20 border-indigo-900/30 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                      }`}>
                        <Layout size={16} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-extrabold text-xs truncate group-hover:text-indigo-500 transition-colors">
                          {event.name}
                        </h4>
                        <span className={`text-[10px] font-semibold flex items-center gap-1 mt-0.5 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                          {event.fields.length} dynamic check-in field(s)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteEvent(event.id, e)}
                        className={`p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100`}
                        title="Delete event design"
                      >
                        <Trash2 size={13} />
                      </button>
                      <span className={`p-1.5 rounded-xl transition-all ${
                        isDark ? 'text-neutral-600 group-hover:text-indigo-400' : 'text-neutral-400 group-hover:text-indigo-600'
                      }`}>
                        <Play size={14} fill="currentColor" className="translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* NEW EVENT BUILDER TAB */}
        {activeTab === 'new' && (
          <form onSubmit={handleCreateEventSubmit} className="space-y-4 animate-scale-up">
            
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                {errorMsg}
              </div>
            )}

            {/* Event Name */}
            <div className={`p-3.5 rounded-2xl border space-y-1.5 ${isDark ? 'border-neutral-800 bg-neutral-900/20' : 'border-neutral-150 bg-neutral-50/40'}`}>
              <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Event or Company Name
              </label>
              <input
                type="text"
                required
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                placeholder="E.g., Global Tech Summit 2026"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                  isDark 
                    ? 'bg-neutral-950 border-neutral-800 text-neutral-200 focus:border-indigo-500/50' 
                    : 'bg-white border-neutral-200 text-neutral-800 focus:border-indigo-500'
                }`}
              />
            </div>

            {/* Fields Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className={`text-[9px] font-bold tracking-wider uppercase block ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Select & Tune Registration Fields
                </span>
                <button
                  type="button"
                  onClick={handleAddCustomField}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-bold transition-all shadow hover:scale-105 flex items-center gap-1"
                >
                  <Plus size={10} />
                  Add Custom Field
                </button>
              </div>

              <div className="space-y-3">
                {selectedFields.map((field) => (
                  <div
                    key={field.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      field.enabled 
                        ? isDark ? 'bg-indigo-950/5 border-indigo-900/30' : 'bg-indigo-500/5 border-indigo-500/20'
                        : isDark ? 'bg-neutral-900/10 border-neutral-850 opacity-60' : 'bg-neutral-50/20 border-neutral-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleFieldPreset(field.id)}
                          className="focus:outline-none shrink-0"
                        >
                          {field.enabled ? (
                            <CheckSquare size={18} className="text-indigo-500" />
                          ) : (
                            <Square size={18} className={isDark ? 'text-neutral-700' : 'text-neutral-300'} />
                          )}
                        </button>
                        
                        {/* Editable Field Label Name */}
                        <div className="flex-1 min-w-0 flex gap-2 items-center">
                          <input
                            type="text"
                            required
                            value={field.name}
                            onChange={(e) => handleFieldNameChange(field.id, e.target.value)}
                            className={`px-2 py-1 rounded text-xs font-extrabold focus:outline-none focus:ring-1 focus:ring-indigo-500/50 w-full ${
                              isDark 
                                ? 'bg-neutral-950 border-neutral-800 text-neutral-200' 
                                : 'bg-white border-neutral-200 text-neutral-800'
                            }`}
                            placeholder="Field Label (e.g. Visitor Name)"
                          />
                          
                          {/* Editable Field Type Select */}
                          <select
                            value={field.type}
                            onChange={(e) => handleFieldTypeChange(field.id, e.target.value as any)}
                            className={`px-1.5 py-1 rounded text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500/50 border shrink-0 ${
                              isDark 
                                ? 'bg-neutral-950 border-neutral-800 text-neutral-300' 
                                : 'bg-white border-neutral-200 text-neutral-700'
                            }`}
                          >
                            <option value="text">Text</option>
                            <option value="tel">Telephone</option>
                            <option value="photo">Photo Capture</option>
                          </select>
                        </div>
                      </div>

                      {/* Remove Field Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveField(field.id)}
                        className={`p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0`}
                        title="Remove Field"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {field.enabled && (
                      <div className="mt-3 space-y-1">
                        <label className={`text-[9px] font-bold uppercase tracking-wider block ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                          Conversational Voice Agent Question
                        </label>
                        <input
                          type="text"
                          value={field.question}
                          onChange={(e) => handleQuestionChange(field.id, e.target.value)}
                          placeholder={`Question for ${field.name.toLowerCase()}`}
                          className={`w-full px-3 py-2 rounded-lg text-[11px] border focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all ${
                            isDark 
                              ? 'bg-neutral-950 border-neutral-800 text-neutral-300' 
                              : 'bg-white border-neutral-200 text-neutral-700'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Save Buttons */}
            <button
              type="submit"
              disabled={isSaving}
              id="new-event-submit-button"
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-sky-500 hover:from-indigo-500 hover:to-sky-400 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-500/15 transition-all hover:scale-102 flex items-center justify-center gap-1.5"
            >
              {isSaving ? 'Saving Event Setup...' : 'Save & Launch Event Kiosk'}
              <ChevronRight size={14} />
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
