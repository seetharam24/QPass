/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { EventConfig, FieldConfig } from '../types';
import { X, Plus, Trash2, RotateCcw, Save, Sparkles, Check, Settings2 } from 'lucide-react';
import { DEFAULT_FIELDS, VOICE_INSTRUCTIONS } from '../constants/voiceInstructions';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventConfig: EventConfig;
  onSave: (config: EventConfig) => void;
  isDark: boolean;
}

export default function SettingsModal({
  isOpen,
  onClose,
  eventConfig,
  onSave,
  isDark
}: SettingsModalProps) {
  const [eventName, setEventName] = useState(eventConfig.name);
  const [fields, setFields] = useState<FieldConfig[]>([...eventConfig.fields]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  // Add field helper
  const handleAddField = () => {
    const newId = `custom_${Date.now()}`;
    const newField: FieldConfig = {
      id: newId,
      name: 'New Custom Field',
      type: 'text',
      question: VOICE_INSTRUCTIONS.CUSTOM_FIELD_DEFAULT_QUESTION
    };
    setFields([...fields, newField]);
  };

  // Remove field helper
  const handleRemoveField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  // Field change helper
  const handleFieldChange = (index: number, key: keyof FieldConfig, value: string) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
    setFields(updated);
  };

  // Reset helper
  const handleReset = () => {
    setEventName('visitor registration');
    setFields(DEFAULT_FIELDS.map(f => ({ ...f })));
  };

  // Save helper
  const handleSave = () => {
    onSave({
      id: eventConfig.id,
      name: eventName || 'visitor registration',
      fields: fields.filter(f => f.name.trim() !== '')
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-neutral-900/60 backdrop-blur-sm animate-fade-in p-4 overflow-y-auto">
      <div 
        id="settings-container-panel"
        className={`w-full max-w-md mx-auto my-auto rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh] transition-all duration-300 border ${
          isDark 
            ? 'bg-neutral-950 border-neutral-800 text-neutral-100' 
            : 'bg-white border-neutral-100 text-neutral-800'
        }`}
      >
        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center shrink-0 ${isDark ? 'border-neutral-800 bg-neutral-900/40' : 'border-neutral-100 bg-neutral-50/40'}`}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Settings2 size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">Agent Settings</h3>
              <p className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Configure voice fields & questions
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-settings-button"
            onClick={onClose}
            className={`p-1.5 rounded-full hover:scale-105 transition-all ${isDark ? 'hover:bg-neutral-800 text-neutral-400' : 'hover:bg-neutral-100 text-neutral-500'}`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Event name setup */}
          <div>
            <label className={`block text-xs font-semibold tracking-wider uppercase mb-1.5 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Event / Registration Name
            </label>
            <input
              type="text"
              id="event-name-input"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g. Visitor Registration"
              className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                isDark 
                  ? 'bg-neutral-900 border-neutral-800 text-neutral-100 focus:border-indigo-500/50' 
                  : 'bg-neutral-50 border-neutral-200 text-neutral-800 focus:border-indigo-500'
              }`}
            />
          </div>

          {/* Fields Setup */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className={`text-xs font-semibold tracking-wider uppercase ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Form Fields ({fields.length})
              </span>
              <button
                type="button"
                id="add-custom-field-button"
                onClick={handleAddField}
                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all"
              >
                <Plus size={12} />
                Add Field
              </button>
            </div>

            <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-1">
              {fields.map((field, index) => (
                <div 
                  key={field.id}
                  className={`p-3 rounded-2xl border flex flex-col gap-2 relative group transition-all duration-300 ${
                    isDark 
                      ? 'bg-neutral-900/50 border-neutral-800' 
                      : 'bg-neutral-50 border-neutral-200'
                  }`}
                >
                  {/* Field Header / Meta */}
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={field.name}
                        placeholder="Field Name (e.g. Company)"
                        onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                        className={`px-2 py-0.5 rounded text-xs font-bold bg-transparent focus:bg-white focus:text-neutral-900 border-b border-transparent focus:border-indigo-500 focus:outline-none w-32 ${
                          isDark ? 'text-neutral-200' : 'text-neutral-800'
                        }`}
                      />
                      <select
                        value={field.type}
                        onChange={(e) => handleFieldChange(index, 'type', e.target.value as any)}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                          isDark 
                            ? 'bg-neutral-800 border-neutral-700 text-neutral-300' 
                            : 'bg-white border-neutral-200 text-neutral-600'
                        }`}
                      >
                        <option value="text">Text Field</option>
                        <option value="tel">Phone No.</option>
                        <option value="photo">Camera Capture</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveField(field.id)}
                      className={`p-1 rounded-md text-rose-500 hover:bg-rose-500/10 transition-all ${
                        fields.length <= 1 ? 'opacity-30 pointer-events-none' : ''
                      }`}
                      title="Remove field"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Question */}
                  <div>
                    <label className={`block text-[10px] font-medium mb-1 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      Voice Assistant Question
                    </label>
                    <textarea
                      value={field.question}
                      onChange={(e) => handleFieldChange(index, 'question', e.target.value)}
                      placeholder="e.g. Could you please say your phone number?"
                      rows={2}
                      className={`w-full px-2 py-1 rounded-xl text-[11px] leading-relaxed border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none ${
                        isDark 
                          ? 'bg-neutral-950 border-neutral-800 text-neutral-300 focus:border-indigo-500/50' 
                          : 'bg-white border-neutral-200 text-neutral-700 focus:border-indigo-500'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className={`p-4 border-t flex items-center justify-between gap-2 shrink-0 ${isDark ? 'border-neutral-800 bg-neutral-900/40' : 'border-neutral-100 bg-neutral-50/40'}`}>
          <button
            type="button"
            id="reset-settings-button"
            onClick={handleReset}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              isDark 
                ? 'bg-neutral-900 hover:bg-neutral-850 text-neutral-400 border-neutral-800' 
                : 'bg-white hover:bg-neutral-50 text-neutral-500 border-neutral-200'
            }`}
          >
            <RotateCcw size={13} />
            Reset Defaults
          </button>

          <button
            type="button"
            id="save-settings-button"
            onClick={handleSave}
            disabled={saveSuccess}
            className={`flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-all min-w-[110px] ${
              saveSuccess ? 'bg-emerald-600 hover:bg-emerald-600' : ''
            }`}
          >
            {saveSuccess ? (
              <>
                <Check size={13} className="animate-scale-up" />
                Saved!
              </>
            ) : (
              <>
                <Save size={13} />
                Save Config
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
