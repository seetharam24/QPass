/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Check if SpeechRecognition is supported
export const isSpeechRecognitionSupported = (): boolean => {
  return typeof window !== 'undefined' && (
    'SpeechRecognition' in window || 
    'webkitSpeechRecognition' in window
  );
};

// Check if SpeechSynthesis is supported
export const isSpeechSynthesisSupported = (): boolean => {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
};

// Detect iOS/iPadOS to apply timing & queue workarounds
export const isIOS = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Unlock SpeechSynthesis on iOS Safari by playing a silent utterance on user gesture
export const unlockSpeechSynthesis = (): void => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      const utterance = new SpeechSynthesisUtterance(' ');
      utterance.volume = 0;
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
      console.log('SpeechSynthesis iOS unlock triggered successfully.');
    } catch (e) {
      console.warn('SpeechSynthesis iOS unlock failed:', e);
    }
  }
};

// Simple Promise-based Text-to-Speech
export const speak = (text: string, voiceName?: string): Promise<void> => {
  return new Promise((resolve) => {
    if (!isSpeechSynthesisSupported()) {
      console.warn('Speech synthesis not supported in this browser.');
      resolve();
      return;
    }

    // On iOS Safari, cancel() can lock the engine if nothing is speaking.
    // Let's only cancel if actively speaking.
    try {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    } catch (e) {
      console.warn('Error calling cancel on speechSynthesis:', e);
    }

    // A slightly longer delay (e.g. 350ms on iOS, 100ms elsewhere)
    // ensures that any active SpeechRecognition or audio session release has completed,
    // which is critical for iOS Safari to switch audio category from record to play.
    const delay = isIOS() ? 350 : 100;

    setTimeout(() => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        
        // Attempt to pick a natural-sounding English voice if available
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          // Look for Google US English or standard English voices
          const targetVoice = voices.find(v => 
            v.name.includes('Google') && v.lang.startsWith('en')
          ) || voices.find(v => 
            v.lang.startsWith('en')
          );
          if (targetVoice) {
            utterance.voice = targetVoice;
          }
        }

        let hasResolved = false;
        const safeResolve = () => {
          if (!hasResolved) {
            hasResolved = true;
            clearTimeout(timeoutId);
            resolve();
          }
        };

        // Safety fallback timeout to prevent hangs (e.g. if voice engine stays paused or fails to trigger onend)
        const timeoutId = setTimeout(() => {
          console.warn('Speech synthesis safety timeout triggered.');
          safeResolve();
        }, Math.max(3500, text.length * 85));

        utterance.onend = () => {
          safeResolve();
        };

        utterance.onerror = (event) => {
          if (event.error !== 'interrupted' && event.error !== 'canceled') {
            console.warn('Speech synthesis minor error (gracefully handled):', event.error || event);
          }
          safeResolve(); // resolve anyway to not block the app
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Speech synthesis execution error:', err);
        resolve();
      }
    }, delay);
  });
};

export interface ListenResult {
  transcript: string;
  isFinal: boolean;
}

// Simple Promise-based Speech-to-Text for single utterance
export class VoiceListener {
  private recognition: any | null = null;
  private active = false;

  constructor() {
    if (isSpeechRecognitionSupported()) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';
    }
  }

  public listenWithTimeout(
    onResult: (text: string) => void,
    onStatusChange: (status: 'idle' | 'listening' | 'processing' | 'error') => void,
    timeoutSeconds = 8
  ): Promise<string> {
    return new Promise((resolve) => {
      if (!this.recognition) {
        onStatusChange('error');
        resolve('');
        return;
      }

      let hasResolved = false;
      let timeoutId: any = null;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        this.active = false;
        try {
          this.recognition.stop();
        } catch (e) {}
      };

      this.recognition.onstart = () => {
        onStatusChange('listening');
        this.active = true;
        
        // Start timeout timer
        timeoutId = setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true;
            cleanup();
            resolve('');
          }
        }, timeoutSeconds * 1000);
      };

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (!hasResolved) {
          hasResolved = true;
          cleanup();
          onResult(transcript);
          resolve(transcript);
        }
      };

      this.recognition.onerror = (event: any) => {
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          console.warn('Speech recognition minor error:', event.error);
        } else {
          console.log('Speech recognition session ended:', event.error);
        }
        if (!hasResolved) {
          hasResolved = true;
          cleanup();
          onStatusChange('error');
          resolve('');
        }
      };

      this.recognition.onend = () => {
        if (!hasResolved) {
          hasResolved = true;
          cleanup();
          resolve('');
        }
      };

      try {
        onStatusChange('processing');
        this.recognition.start();
      } catch (err) {
        console.error('Speech start error:', err);
        onStatusChange('error');
        resolve('');
      }
    });
  }

  // Set up continuous background listener for wake word "Hi" or "Hey"
  public startWakeWordListener(
    onWakeWordDetected: () => void,
    onListeningState: (isListening: boolean) => void
  ): () => void {
    if (!this.recognition) {
      return () => {};
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const wakeRecognition = new SpeechRecognition();
    wakeRecognition.continuous = true;
    wakeRecognition.interimResults = true;
    wakeRecognition.lang = 'en-US';

    let shouldRestart = true;

    wakeRecognition.onstart = () => {
      onListeningState(true);
    };

    wakeRecognition.onresult = (event: any) => {
      const resultIndex = event.resultIndex;
      const transcript = event.results[resultIndex][0].transcript.toLowerCase().trim();
      
      console.log('Background heard:', transcript);
      
      if (
        transcript.includes('hi') || 
        transcript.includes('hey') || 
        transcript.includes('hello') || 
        transcript.includes('qpass') ||
        transcript.includes('key')
      ) {
        console.log('Wake word detected!');
        shouldRestart = false;
        wakeRecognition.stop();
        onWakeWordDetected();
      }
    };

    wakeRecognition.onerror = (event: any) => {
      console.warn('Wake word recognition error:', event.error);
      if (event.error === 'not-allowed') {
        shouldRestart = false;
      }
    };

    wakeRecognition.onend = () => {
      onListeningState(false);
      if (shouldRestart) {
        try {
          wakeRecognition.start();
        } catch (e) {
          console.warn('Wake word restart error:', e);
        }
      }
    };

    try {
      wakeRecognition.start();
    } catch (err) {
      console.error('Failed to start wake recognition:', err);
    }

    return () => {
      shouldRestart = false;
      try {
        wakeRecognition.stop();
      } catch (e) {}
    };
  }
}
