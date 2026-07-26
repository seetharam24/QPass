/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import CameraCapture from './components/CameraCapture';
import SettingsModal from './components/SettingsModal';
import AdminPanel from './components/AdminPanel';
import { EventConfig, FieldConfig, VisitorRegistration, UserProfile } from './types';
import { speak, VoiceListener, isSpeechRecognitionSupported, isSpeechSynthesisSupported, unlockSpeechSynthesis } from './utils/speech';
import { 
  Moon, Sun, ShieldAlert, CheckCircle, Flame, Clock, 
  Wifi, Battery, Smartphone, Play, Square, Settings, UserCheck, Mic, ArrowRight, UserPlus, ArrowLeft, LogOut,
  HelpCircle, Info, X, Volume2
} from 'lucide-react';
import { DEFAULT_EVENT_CONFIG, VOICE_INSTRUCTIONS, UI_SUGGESTIONS, DEFAULT_VOICE_INSTRUCTIONS, VoiceInstructionsConfig } from './constants/voiceInstructions';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, writeBatch, getDocs, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { AuthPages } from './components/AuthPages';
import { EventSelector } from './components/EventSelector';

export default function App() {
  // Organizer Auth & Event Management State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('qpass_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [selectedEvent, setSelectedEvent] = useState<EventConfig | null>(null);

  const [userEvents, setUserEvents] = useState<EventConfig[]>([]);

  // Theme & Panels state
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('qpass_is_dark');
    return saved ? saved === 'true' : false;
  });

  const [eventConfig, setEventConfig] = useState<EventConfig>(() => {
    const saved = localStorage.getItem('qpass_event_config');
    return saved ? JSON.parse(saved) : DEFAULT_EVENT_CONFIG;
  });

  const [registrations, setRegistrations] = useState<VisitorRegistration[]>(() => {
    const saved = localStorage.getItem('qpass_registrations');
    return saved ? JSON.parse(saved) : [];
  });

  const [voiceInstructions, setVoiceInstructions] = useState<VoiceInstructionsConfig>(() => {
    const saved = localStorage.getItem('qpass_voice_instructions');
    return saved ? JSON.parse(saved) : DEFAULT_VOICE_INSTRUCTIONS;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Form Submission/Input state
  const [formData, setFormData] = useState<{ [fieldId: string]: string }>({});
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  // Voice Agent State Machine
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>("Inactive. Click 'Start Agent' below to activate.");
  const [activeSpeakingField, setActiveSpeakingField] = useState<string | null>(null);
  const [activeListeningField, setActiveListeningField] = useState<string | null>(null);
  const [cameraCountdownTrigger, setCameraCountdownTrigger] = useState(false);
  const [showVoiceNotice, setShowVoiceNotice] = useState(false);
  const [showVoiceHelpModal, setShowVoiceHelpModal] = useState(false);

  // Current System time for Android Status Bar mockup
  const [systemTime, setSystemTime] = useState<string>('');

  // Refs for tracking async state interruption
  const isAgentRunningRef = useRef(false);
  const stopBackgroundWakeWordRef = useRef<(() => void) | null>(null);
  const onPhotoCapturedResolveRef = useRef<((img: string) => void) | null>(null);
  const isFlowActiveRef = useRef(false);

  // Save values to localStorage on change
  useEffect(() => {
    localStorage.setItem('qpass_is_dark', String(isDark));
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('qpass_event_config', JSON.stringify(eventConfig));
  }, [eventConfig]);

  useEffect(() => {
    localStorage.setItem('qpass_registrations', JSON.stringify(registrations));
  }, [registrations]);

  useEffect(() => {
    localStorage.setItem('qpass_voice_instructions', JSON.stringify(voiceInstructions));
  }, [voiceInstructions]);

  // Session persistence syncing
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('qpass_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('qpass_current_user');
      localStorage.removeItem('qpass_selected_event');
      setSelectedEvent(null);
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedEvent) {
      localStorage.setItem('qpass_selected_event', JSON.stringify(selectedEvent));
      setEventConfig(selectedEvent);
    } else {
      localStorage.removeItem('qpass_selected_event');
    }
  }, [selectedEvent]);

  // Firestore Real-Time Subscriptions & Auto-sync
  useEffect(() => {
    // 1. Listen to Registrations in real-time
    const q = query(collection(db, 'registrations'), orderBy('timestamp', 'desc'));
    const unsubscribeRegistrations = onSnapshot(q, (snapshot) => {
      const docsList: VisitorRegistration[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        docsList.push({
          id: docSnap.id,
          eventId: data.eventId || '',
          eventName: data.eventName || '',
          timestamp: data.timestamp || '',
          fields: data.fields || {}
        });
      });
      setRegistrations(docsList);
    }, (error) => {
      console.error("Firestore Registrations subscription failed:", error);
    });

    // 2. Listen to Selected Event in real-time if one is chosen
    let unsubscribeSelectedEvent = () => {};
    if (selectedEvent?.id) {
      unsubscribeSelectedEvent = onSnapshot(doc(db, 'events', selectedEvent.id), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const syncedEvent: EventConfig = {
            id: docSnap.id,
            userId: data.userId || '',
            name: data.name || '',
            fields: data.fields || []
          };
          setSelectedEvent(syncedEvent);
          setEventConfig(syncedEvent);
        }
      }, (error) => {
        console.error("Firestore Selected Event subscription failed:", error);
      });
    }

    // 3. Listen to Voice Instructions in real-time
    const unsubscribeVoice = onSnapshot(doc(db, 'configs', 'voice_instructions'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.data) {
          setVoiceInstructions(data.data as VoiceInstructionsConfig);
        }
      }
    }, (error) => {
      console.error("Firestore VoiceInstructions subscription failed:", error);
    });

    return () => {
      unsubscribeRegistrations();
      unsubscribeSelectedEvent();
      unsubscribeVoice();
    };
  }, [selectedEvent?.id]);

  // 4. Real-time User Events subscription
  useEffect(() => {
    if (!currentUser) {
      setUserEvents([]);
      return;
    }
    const q = query(collection(db, 'events'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: EventConfig[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.userId === currentUser.uid) {
          list.push({
            id: docSnap.id,
            userId: data.userId,
            name: data.name || '',
            fields: data.fields || []
          });
        }
      });
      setUserEvents(list);
    }, (error) => {
      console.error("Firestore User Events subscription failed:", error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Seed database with defaults if empty
  useEffect(() => {
    const seedDb = async () => {
      try {
        const eventDoc = await getDoc(doc(db, 'configs', 'event_config'));
        if (!eventDoc.exists()) {
          await setDoc(doc(db, 'configs', 'event_config'), { data: DEFAULT_EVENT_CONFIG });
        }
        
        const voiceDoc = await getDoc(doc(db, 'configs', 'voice_instructions'));
        if (!voiceDoc.exists()) {
          await setDoc(doc(db, 'configs', 'voice_instructions'), { data: DEFAULT_VOICE_INSTRUCTIONS });
        }
      } catch (err) {
        console.error("Error seeding Firestore config defaults:", err);
      }
    };
    seedDb();
  }, []);

  // Update mock system clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setSystemTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-unlock speech synthesis on iOS Safari when the user clicks/taps anywhere in the app
  useEffect(() => {
    const handleGestureUnlock = () => {
      unlockSpeechSynthesis();
      // Remove listener immediately after first gesture to avoid overhead
      window.removeEventListener('click', handleGestureUnlock);
      window.removeEventListener('touchstart', handleGestureUnlock);
    };
    window.addEventListener('click', handleGestureUnlock, { passive: true });
    window.addEventListener('touchstart', handleGestureUnlock, { passive: true });
    return () => {
      window.removeEventListener('click', handleGestureUnlock);
      window.removeEventListener('touchstart', handleGestureUnlock);
    };
  }, []);

  // Sync state reference
  useEffect(() => {
    isAgentRunningRef.current = isAgentRunning;
  }, [isAgentRunning]);

  // Handle voice agent workflow cancellation upon turning off
  useEffect(() => {
    if (!isAgentRunning) {
      isFlowActiveRef.current = false;
      if (stopBackgroundWakeWordRef.current) {
        stopBackgroundWakeWordRef.current();
        stopBackgroundWakeWordRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setActiveSpeakingField(null);
      setActiveListeningField(null);
      setCameraCountdownTrigger(false);
      setAgentStatus("Inactive. Click 'Start Agent' below to activate.");
    }
  }, [isAgentRunning]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (stopBackgroundWakeWordRef.current) {
        stopBackgroundWakeWordRef.current();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Form submission handler (manual or automated)
  const handleRegisterVisitor = (finalFormData: { [fieldId: string]: string }) => {
    // Validate required fields
    const missingFields = eventConfig.fields.filter(
      f => f.type !== 'photo' && (!finalFormData[f.id] || finalFormData[f.id].trim() === '')
    );

    if (missingFields.length > 0 && !isAgentRunning) {
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus('idle'), 3000);
      return;
    }

    setSubmitStatus('submitting');

    const newRecord: VisitorRegistration = {
      id: `reg_${Date.now()}`,
      eventId: eventConfig.id,
      eventName: eventConfig.name,
      timestamp: new Date().toISOString(),
      fields: { ...finalFormData }
    };

    // Save to Firestore
    setDoc(doc(db, 'registrations', newRecord.id), {
      eventId: newRecord.eventId,
      eventName: newRecord.eventName,
      timestamp: newRecord.timestamp,
      fields: newRecord.fields
    }).catch(err => {
      console.error("Failed to persist registration to Firestore:", err);
    });

    setRegistrations(prev => [newRecord, ...prev]);
    setSubmitStatus('success');
    
    setTimeout(() => {
      setFormData({});
      setSubmitStatus('idle');
    }, 4000);

    return newRecord;
  };

  // The main core Voice Agent workflow state machine!
  const startConversationalFlow = async () => {
    if (!isAgentRunningRef.current) return;
    if (isFlowActiveRef.current) {
      console.log("Conversational flow already active, ignoring duplicate trigger.");
      return;
    }
    isFlowActiveRef.current = true;

    // Stop the background wake-word listener immediately to prevent concurrent triggers or resets
    if (stopBackgroundWakeWordRef.current) {
      stopBackgroundWakeWordRef.current();
      stopBackgroundWakeWordRef.current = null;
    }

    // Give Android/iOS audio subsystem 400ms to release recording microphone focus before TTS speaks
    await new Promise(r => setTimeout(r, 400));

    const accumulatedData: Record<string, string> = {};

    try {
      setFormData({}); // Reset fields for new visitor
      setAgentStatus("Greeting visitor...");
      
      // Warm, professional greeting
      await speak(voiceInstructions.GREETING);
      
      // Loop through all fields dynamically configured
      for (const field of eventConfig.fields) {
        if (!isAgentRunningRef.current) return;

        let gotAnswer = false;
        let attempts = 0;
        let finalAnswerText = '';

        // Handle capture depending on Field Type
        if (field.type === 'photo') {
          setAgentStatus(`Asking: ${field.name}`);
          setActiveSpeakingField(field.id);
          await speak(field.question);
          setActiveSpeakingField(null);

          if (!isAgentRunningRef.current) return;

          setAgentStatus("Starting camera countdown...");
          
          // Trigger the photo countdown in CameraCapture component
          setCameraCountdownTrigger(true);
          
          // Wait until onPhotoCapturedResolveRef is resolved with captured Base64 string
          const base64Photo = await new Promise<string>((resolve) => {
            onPhotoCapturedResolveRef.current = (imgStr) => {
              resolve(imgStr);
            };
          });

          setCameraCountdownTrigger(false);
          accumulatedData[field.id] = base64Photo;
          setFormData({ ...accumulatedData });
          setAgentStatus("Photo successfully captured.");
          
          // Speak feedback
          await speak(voiceInstructions.PHOTO_CAPTURED);

        } else {
          // Regular text or tel inputs
          const isSttSupported = isSpeechRecognitionSupported();

          if (!isSttSupported) {
            // STT (Speech Recognition) is not supported in this browser/WebView, but TTS is!
            setAgentStatus(`Asking: ${field.name}`);
            setActiveSpeakingField(field.id);
            await speak(field.question);
            setActiveSpeakingField(null);

            if (!isAgentRunningRef.current) return;

            setAgentStatus(`Prompt spoken for ${field.name}. Type on keyboard or tap next.`);
          } else {
            while (attempts < 2 && !gotAnswer && isAgentRunningRef.current) {
              setAgentStatus(`Asking: ${field.name}`);
              setActiveSpeakingField(field.id);

              if (attempts === 0) {
                await speak(field.question);
              } else {
                // Ask the same question again on delay/timeout
                await speak(voiceInstructions.RETRY_PREFIX + field.question);
              }

              setActiveSpeakingField(null);

              if (!isAgentRunningRef.current) return;

              // Give OS 350ms to switch audio focus from SpeechSynthesis playback to SpeechRecognition capture
              await new Promise(r => setTimeout(r, 350));

              setAgentStatus(`Listening for ${field.name} (5s)...`);
              setActiveListeningField(field.id);

              const listener = new VoiceListener();
              const recognizedText = await listener.listenWithTimeout(
                (text) => {
                  // Interim update
                  setFormData({ ...accumulatedData, [field.id]: text });
                },
                (status) => {
                  if (status === 'listening') {
                    setAgentStatus(`Listening for ${field.name} (5s timeout)...`);
                  } else if (status === 'processing') {
                    setAgentStatus("Processing voice answer...");
                  }
                },
                5 // Strict 5 seconds timeout as requested!
              );

              setActiveListeningField(null);

              if (recognizedText && recognizedText.trim() !== '') {
                gotAnswer = true;
                finalAnswerText = recognizedText.trim();
                accumulatedData[field.id] = finalAnswerText;
                setFormData({ ...accumulatedData });
                await speak(voiceInstructions.GOT_ANSWER);
              } else {
                attempts++;
              }
            }

            // If visitor delayed/failed twice, we abort the registration and wait for another visitor
            if (!gotAnswer && isAgentRunningRef.current) {
              setAgentStatus("Registration timed out.");
              await speak(voiceInstructions.TIMEOUT_RESET);
              setFormData({});
              initiateWakeWordLoop();
              return; // Exit flow
            }
          }
        }
      }

      // 3. Complete and Submit
      if (!isAgentRunningRef.current) return;

      setAgentStatus("Finalizing check-in...");
      
      // Grab accumulated form data to submit
      handleRegisterVisitor(accumulatedData);

      setAgentStatus("Registration success!");
      await speak(voiceInstructions.REGISTRATION_SUCCESS);
      
      // 4. Start listening for the next visitor
      if (isAgentRunningRef.current) {
        initiateWakeWordLoop();
      }

    } catch (err) {
      console.error('Error in voice loop:', err);
      if (isAgentRunningRef.current) {
        setAgentStatus("Error. Restarting voice mode.");
        initiateWakeWordLoop();
      }
    } finally {
      isFlowActiveRef.current = false;
    }
  };

  // Set up the background listener to wait for wake word "Hi" or "Hey"
  const initiateWakeWordLoop = () => {
    if (!isAgentRunningRef.current) return;

    // Reset fields
    setFormData({});

    if (!isSpeechRecognitionSupported()) {
      setAgentStatus("TTS Voice Prompts Active. Tap 'Start Check-In' or fields to hear questions.");
      return;
    }

    setAgentStatus("Waiting for visitor to say 'Hi' or 'Hey'...");
    
    const listener = new VoiceListener();
    
    // Terminate any previous listener
    if (stopBackgroundWakeWordRef.current) {
      stopBackgroundWakeWordRef.current();
    }

    stopBackgroundWakeWordRef.current = listener.startWakeWordListener(
      () => {
        // Triggered upon hearing Hi/Hey
        startConversationalFlow();
      },
      (isListening) => {
        if (isListening) {
          setAgentStatus("Active. Speak 'Hi' or 'Hey' to begin check-in.");
        }
      }
    );
  };

  // Start Agent click handler
  const handleToggleAgent = () => {
    if (isAgentRunning) {
      setIsAgentRunning(false);
      setShowVoiceNotice(false);
    } else {
      const sttSupported = isSpeechRecognitionSupported();
      const ttsSupported = isSpeechSynthesisSupported();
      
      if (!sttSupported || !ttsSupported) {
        setShowVoiceNotice(true);
      } else {
        setShowVoiceNotice(false);
      }
      
      // Explicitly unlock SpeechSynthesis inside this direct user gesture handler
      unlockSpeechSynthesis();

      setIsAgentRunning(true);
      // Wait tiny bit for state to commit
      setTimeout(() => {
        initiateWakeWordLoop();
      }, 300);
    }
  };

  const filteredRegistrations = registrations.filter(r => r.eventId === eventConfig.id);

  return (
    <div className={`min-h-[100dvh] flex items-center justify-center p-0 sm:p-6 transition-all duration-300 ${
      isDark ? 'bg-neutral-900 text-neutral-100' : 'bg-neutral-50 text-neutral-800'
    }`}>
      
      {/* Dynamic Desktop Smartphone Wrap Container */}
      <div 
        id="phone-mockup-frame"
        className={`w-full max-w-md h-[100dvh] sm:h-[840px] sm:rounded-[40px] shadow-2xl flex flex-col relative overflow-hidden transition-all duration-300 border ${
          isDark 
            ? 'bg-neutral-950 border-neutral-800 sm:ring-8 sm:ring-neutral-900' 
            : 'bg-white border-neutral-200 sm:ring-8 sm:ring-neutral-100'
        }`}
      >
        {/* Android Status Bar mockup */}
        <div className={`hidden sm:flex justify-between items-center px-6 py-2 text-[10px] font-bold shrink-0 z-40 select-none ${
          isDark ? 'bg-neutral-950 text-neutral-400' : 'bg-white text-neutral-500'
        }`}>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-[11px]">{systemTime || "10:20"}</span>
          </div>
          {/* Audio Speaker Notch */}
          <div className={`w-20 h-4 rounded-full mx-auto -mt-2.5 shrink-0 ${isDark ? 'bg-neutral-900' : 'bg-neutral-200'}`} />
          <div className="flex items-center gap-1.5">
            <Wifi size={11} className="text-emerald-500" />
            <Battery size={13} className="text-indigo-500 rotate-90" />
            <span className="text-[9px]">100%</span>
          </div>
        </div>

        {/* Application Header section */}
        {currentUser && selectedEvent && (
          <div className={`p-4 border-b flex flex-col gap-3 shrink-0 ${isDark ? 'border-neutral-800 bg-neutral-950/40' : 'border-neutral-100 bg-neutral-50/40'}`}>
            <div className="flex items-center justify-between">
              {/* App Branding logo */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-indigo-500/20">
                  Q
                </div>
                <div>
                  <h1 className="text-sm font-extrabold tracking-tight">QPass</h1>
                  <p className={`text-[8px] font-semibold leading-normal ${isDark ? 'text-indigo-400/80' : 'text-indigo-600/80'}`}>
                    Effortless Entry for Every Event
                  </p>
                </div>
              </div>

              {/* Quick Action Utilities */}
              <div className="flex items-center gap-1.5">
                {/* Back to Events dashboard button (Exit Kiosk) */}
                <button
                  type="button"
                  id="exit-kiosk-button"
                  onClick={() => {
                    setIsAgentRunning(false);
                    setSelectedEvent(null);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg transition-all hover:scale-105 flex items-center gap-1 text-[10px] font-bold ${
                    isDark 
                      ? 'bg-neutral-900 text-indigo-400 hover:bg-neutral-800' 
                      : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                  }`}
                  title="Back to Organizer Console"
                >
                  <ArrowLeft size={11} />
                  Exit Kiosk
                </button>

                {/* Dark mode Toggle */}
                <button
                  type="button"
                  id="theme-toggle"
                  onClick={() => setIsDark(!isDark)}
                  className={`p-1.5 rounded-lg transition-all hover:scale-105 ${
                    isDark 
                      ? 'bg-neutral-900 hover:bg-neutral-800 text-amber-400' 
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                  }`}
                  title="Toggle Dark Mode"
                >
                  {isDark ? <Sun size={15} /> : <Moon size={15} />}
                </button>

                {/* Settings modal button */}
                <button
                  type="button"
                  id="open-settings-button"
                  onClick={() => setIsSettingsOpen(true)}
                  className={`p-1.5 rounded-lg transition-all hover:scale-105 flex items-center justify-center ${
                    isDark 
                      ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300' 
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                  }`}
                  title="Field Configurations"
                >
                  <Settings size={15} />
                </button>

                {/* Admin Database analyzer */}
                <button
                  type="button"
                  id="open-admin-button"
                  onClick={() => setIsAdminOpen(true)}
                  className={`p-1.5 rounded-lg transition-all hover:scale-105 flex items-center justify-center ${
                    isDark 
                      ? 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300' 
                      : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
                  }`}
                  title="Admin Visitor Logs"
                >
                  <UserCheck size={15} />
                </button>
              </div>
            </div>

            {/* Voice Agent Control Board */}
            <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 shadow-sm transition-all duration-300 ${
              isAgentRunning
                ? 'bg-indigo-600/10 border-indigo-500/30'
                : isDark
                  ? 'bg-neutral-900 border-neutral-850'
                  : 'bg-neutral-50 border-neutral-150'
            }`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`relative flex h-2 w-2`}>
                    {isAgentRunning && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    )}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isAgentRunning ? 'bg-emerald-500' : 'bg-neutral-400'}`}></span>
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    {isAgentRunning ? 'Voice Agent Active' : 'Voice Agent Offline'}
                  </span>
                </div>
                <p className={`text-[11px] font-semibold mt-0.5 truncate leading-normal ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}>
                  {agentStatus}
                </p>
              </div>

              <button
                type="button"
                id="voice-agent-toggle-button"
                onClick={handleToggleAgent}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold tracking-wide uppercase transition-all flex items-center gap-1 shrink-0 shadow-sm ${
                  isAgentRunning
                    ? 'bg-rose-600 hover:bg-rose-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {isAgentRunning ? (
                  <>
                    <Square size={10} fill="currentColor" />
                    Stop Agent
                  </>
                ) : (
                  <>
                    <Play size={10} fill="currentColor" />
                    Start Agent
                  </>
                )}
              </button>
            </div>

            {/* Non-intrusive Voice Support Notice Banner */}
            {showVoiceNotice && (
              <div className={`mt-2 p-2.5 rounded-xl border flex items-start justify-between gap-2 text-xs transition-all ${
                isDark ? 'bg-amber-950/40 border-amber-800/50 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <div className="flex items-start gap-2">
                  <Info size={15} className="mt-0.5 shrink-0 text-amber-500" />
                  <div>
                    <p className="font-semibold text-[11px] leading-snug">
                      Speech Recognition is restricted in this WebView/browser.
                    </p>
                    <p className="text-[10px] opacity-90 mt-0.5 leading-snug">
                      Text-to-Speech prompts & standard form input remain active.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowVoiceHelpModal(true)}
                      className="mt-1 text-[10px] font-bold underline flex items-center gap-1 hover:opacity-80"
                    >
                      <HelpCircle size={11} /> Voice Support & Play Store Guide
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVoiceNotice(false)}
                  className="p-1 rounded-md hover:bg-black/10 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Screens Router */}
        {!currentUser ? (
          <AuthPages isDark={isDark} onToggleTheme={() => setIsDark(!isDark)} onAuthSuccess={(user) => setCurrentUser(user)} />
        ) : !selectedEvent ? (
          <EventSelector
            isDark={isDark}
            onToggleTheme={() => setIsDark(!isDark)}
            currentUser={currentUser}
            userEvents={userEvents}
            onSelectEvent={(event) => setSelectedEvent(event)}
            onLogout={() => {
              setCurrentUser(null);
            }}
          />
        ) : (
          <>
            {/* Caption & Instructions Panel */}
            <div className={`px-5 py-3 border-b flex flex-col text-center select-none shrink-0 ${
              isDark ? 'bg-neutral-950 border-neutral-900 text-neutral-400' : 'bg-neutral-50/50 border-neutral-100 text-neutral-500'
            }`}>
              <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                {eventConfig.name}
              </span>
              <p className="text-[10px] mt-0.5 font-medium tracking-wide leading-relaxed opacity-80">
                {isAgentRunning 
                  ? UI_SUGGESTIONS.AGENT_ACTIVE
                  : UI_SUGGESTIONS.AGENT_OFFLINE}
              </p>
            </div>

            {/* Scrollable Registration Form Frame */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRegisterVisitor(formData);
                }} 
                className="space-y-4"
              >
                {/* Dynamically configured form fields */}
                {eventConfig.fields.map((field) => {
                  const isSpeaking = activeSpeakingField === field.id;
                  const isListening = activeListeningField === field.id;
                  const value = formData[field.id] || '';

                  if (field.type === 'photo') {
                    return (
                      <div key={field.id} className="space-y-1.5">
                        <label className={`block text-xs font-bold tracking-wide flex items-center justify-between ${
                          isSpeaking ? 'text-indigo-500' : isDark ? 'text-neutral-300' : 'text-neutral-700'
                        }`}>
                          <span className="flex items-center gap-1">
                            {field.name}
                            {isSpeaking && <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-indigo-500/10 text-indigo-400 animate-pulse">speaking...</span>}
                          </span>
                          {value && <span className="text-[9px] font-bold text-emerald-500 flex items-center gap-0.5"><CheckCircle size={10} /> Photo ready</span>}
                        </label>

                        {/* Camera Capture Module */}
                        <CameraCapture
                          savedImage={value}
                          onCapture={(base64) => {
                            setFormData(prev => ({ ...prev, [field.id]: base64 }));
                            // If voice sequence is waiting, resolve the await
                            if (onPhotoCapturedResolveRef.current) {
                              onPhotoCapturedResolveRef.current(base64);
                              onPhotoCapturedResolveRef.current = null;
                            }
                          }}
                          isDark={isDark}
                          countdownTrigger={cameraCountdownTrigger}
                          onCountdownComplete={() => setCameraCountdownTrigger(false)}
                        />
                      </div>
                    );
                  }

                  // Text / Tel Input Fields
                  return (
                    <div 
                      key={field.id} 
                      className={`space-y-1.5 p-3 rounded-2xl transition-all duration-300 border ${
                        isListening 
                          ? 'border-emerald-500/40 bg-emerald-500/5 ring-2 ring-emerald-500/10' 
                          : isSpeaking
                            ? 'border-indigo-500/40 bg-indigo-500/5'
                            : isDark
                              ? 'border-neutral-800 bg-neutral-900/10'
                              : 'border-neutral-150 bg-neutral-50/40'
                      }`}
                    >
                      <div className="flex justify-between items-center gap-2">
                        <label className={`text-xs font-bold tracking-wide flex items-center gap-1.5 ${
                          isDark ? 'text-neutral-300' : 'text-neutral-700'
                        }`}>
                          {field.name}
                          {isSpeaking && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-md bg-indigo-500/10 text-indigo-400 animate-pulse">
                              Speaking...
                            </span>
                          )}
                          {isListening && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-400 animate-pulse flex items-center gap-0.5">
                              <Mic size={8} /> Listening...
                            </span>
                          )}
                        </label>

                        {value && !isListening && (
                          <span className="text-emerald-500"><CheckCircle size={12} /></span>
                        )}
                      </div>

                      <input
                        type={field.type}
                        value={value}
                        onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                        disabled={isAgentRunning}
                        placeholder={
                          isListening 
                            ? "🎤 Listening to your voice..." 
                            : `Enter your ${field.name.toLowerCase()}`
                        }
                        className={`w-full px-3.5 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                          isListening
                            ? 'bg-neutral-950/20 border-emerald-500 text-neutral-800 dark:text-neutral-100 font-medium'
                            : isDark 
                              ? 'bg-neutral-950 border-neutral-800 text-neutral-200 focus:border-indigo-500/50' 
                              : 'bg-white border-neutral-200 text-neutral-800 focus:border-indigo-500'
                        } ${isAgentRunning ? 'cursor-not-allowed opacity-90' : ''}`}
                      />
                    </div>
                  );
                })}

                {/* Manual Submission Actions (only shown if agent isn't running) */}
                {!isAgentRunning && (
                  <button
                    type="submit"
                    id="submit-registration-button"
                    disabled={submitStatus !== 'idle'}
                    className={`w-full py-3 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-500/15 transition-all flex items-center justify-center gap-1.5 ${
                      submitStatus === 'success' ? 'from-emerald-600 to-emerald-500' : ''
                    }`}
                  >
                    {submitStatus === 'submitting' ? (
                      "Signing in visitor..."
                    ) : submitStatus === 'success' ? (
                      <>
                        <CheckCircle size={14} className="animate-bounce" />
                        Visitor Checked-in!
                      </>
                    ) : submitStatus === 'error' ? (
                      "Please fill all text fields first!"
                    ) : (
                      <>
                        <UserPlus size={14} />
                        Submit Registration
                      </>
                    )}
                  </button>
                )}
              </form>
            </div>

            {/* Copywrites footer note */}
            <div className={`p-4 border-t text-center shrink-0 ${isDark ? 'border-neutral-800 bg-neutral-950/20 text-neutral-500' : 'border-neutral-100 bg-neutral-50/20 text-neutral-400'}`}>
              <p className="text-[10px] font-medium tracking-wide select-none">
                © 2026 QPass Check-in • Powered by Voice Intelligence
              </p>
            </div>
          </>
        )}

        {/* Settings Configurations Modal Overlay */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          eventConfig={eventConfig}
          onSave={async (config) => {
            try {
              if (selectedEvent) {
                const updatedEvent = { ...selectedEvent, fields: config.fields, name: config.name };
                await setDoc(doc(db, 'events', selectedEvent.id), updatedEvent);
                setSelectedEvent(updatedEvent);
              } else {
                await setDoc(doc(db, 'configs', 'event_config'), { data: config });
              }
              setEventConfig(config);
            } catch (err) {
              console.error("Error saving event config to Firestore:", err);
            }
          }}
          isDark={isDark}
        />

        {/* Admin Visitor logs Overlay */}
        <AdminPanel
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          registrations={filteredRegistrations}
          onDeleteRegistration={async (id) => {
            try {
              await deleteDoc(doc(db, 'registrations', id));
              setRegistrations(prev => prev.filter(r => r.id !== id));
            } catch (err) {
              console.error("Error deleting registration from Firestore:", err);
            }
          }}
          onClearAll={async () => {
            try {
              const querySnapshot = await getDocs(collection(db, 'registrations'));
              const batch = writeBatch(db);
              querySnapshot.forEach((docSnap) => {
                if (docSnap.data().eventId === eventConfig.id) {
                  batch.delete(docSnap.ref);
                }
              });
              await batch.commit();
              setRegistrations(prev => prev.filter(r => r.eventId !== eventConfig.id));
              setIsAdminOpen(false);
            } catch (err) {
              console.error("Error clearing registrations from Firestore:", err);
            }
          }}
          isDark={isDark}
          voiceInstructions={voiceInstructions}
          onUpdateVoiceInstructions={async (instructions) => {
            try {
              await setDoc(doc(db, 'configs', 'voice_instructions'), { data: instructions });
              setVoiceInstructions(instructions);
            } catch (err) {
              console.error("Error saving voice instructions to Firestore:", err);
            }
          }}
        />

        {/* Voice Support Guide Modal */}
        {showVoiceHelpModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl relative ${
              isDark ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-white border-neutral-200 text-neutral-800'
            }`}>
              <button
                type="button"
                onClick={() => setShowVoiceHelpModal(false)}
                className={`absolute top-4 right-4 p-1.5 rounded-lg ${isDark ? 'hover:bg-neutral-800' : 'hover:bg-neutral-100'}`}
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-2 mb-3">
                <Volume2 className="text-indigo-500" size={20} />
                <h3 className="font-bold text-sm">Voice Support & Play Store Guide</h3>
              </div>

              <div className="space-y-3 text-xs leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
                <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-neutral-950 border-neutral-800' : 'bg-neutral-50 border-neutral-200'}`}>
                  <p className="font-bold text-[11px] mb-1">Device Capabilities Status:</p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span>Text-to-Speech (Audio Prompts):</span>
                    <span className={isSpeechSynthesisSupported() ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                      {isSpeechSynthesisSupported() ? "Supported" : "Unavailable"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span>Speech Recognition (Microphone STT):</span>
                    <span className={isSpeechRecognitionSupported() ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                      {isSpeechRecognitionSupported() ? "Supported" : "Restricted in WebView"}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-indigo-500 mb-1">Why is STT restricted in Play Store WebView?</h4>
                  <p className="text-[11px] opacity-80">
                    Standard Android WebViews disable Chrome Speech Recognition cloud services unless running inside Google Chrome directly or a Trusted Web Activity (TWA).
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-indigo-500 mb-1">How to enable full voice in Play Store:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] opacity-90">
                    <li>Build Play Store Bundle using <strong>TWA (Trusted Web Activity)</strong> via Bubblewrap / PWABuilder.</li>
                    <li>Ensure app is hosted over <strong>HTTPS</strong>.</li>
                    <li>Or open URL directly in <strong>Google Chrome</strong> / <strong>Safari</strong> on mobile.</li>
                  </ol>
                </div>

                <div className={`p-2 rounded-lg text-[10px] ${isDark ? 'bg-indigo-950/40 text-indigo-300' : 'bg-indigo-50 text-indigo-800'}`}>
                  <strong>Tip:</strong> Users can tap any input field and press the microphone icon on their Gboard / iOS keyboard for instant voice dictation!
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowVoiceHelpModal(false)}
                className="mt-4 w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all"
              >
                Got It
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

