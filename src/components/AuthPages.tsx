import React, { useState, useEffect } from 'react';
import { 
  Smartphone, Mail, User, ShieldCheck, Check, ArrowRight, ArrowLeft, 
  AlertCircle, Key, Info, HelpCircle, ShieldAlert, Sun, Moon
} from 'lucide-react';
import { UserProfile } from '../types';
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  ConfirmationResult 
} from 'firebase/auth';

interface AuthPagesProps {
  isDark: boolean;
  onToggleTheme: () => void;
  onAuthSuccess: (user: UserProfile) => void;
}

export function AuthPages({ isDark, onToggleTheme, onAuthSuccess }: AuthPagesProps) {
  const [view, setView] = useState<'landing' | 'login' | 'signup' | 'otp_verify'>('landing');
  
  // Form states
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [localMobile, setLocalMobile] = useState('');
  
  // OTP / Firebase Authentication states
  const [authMode, setAuthMode] = useState<'firebase' | 'simulated'>('firebase');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [recaptchaError, setRecaptchaError] = useState(false);
  const [smsRegionError, setSmsRegionError] = useState(false);
  const [hostnameError, setHostnameError] = useState(false);
  const [copiedHost, setCopiedHost] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // For preserving registration data across OTP screen
  const [tempUser, setTempUser] = useState<{ name: string; mobile: string; email: string } | null>(null);
  const [otpPurpose, setOtpPurpose] = useState<'login' | 'register'>('register');

  // Clear Recaptcha on unmount
  useEffect(() => {
    return () => {
      if ((window as any).recaptchaVerifier) {
        try {
          ((window as any).recaptchaVerifier).clear();
          (window as any).recaptchaVerifier = null;
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, []);

  // Setup Recaptcha container with clean re-initialization
  const setupRecaptcha = (containerId: string) => {
    try {
      if ((window as any).recaptchaVerifier) {
        try {
          ((window as any).recaptchaVerifier).clear();
        } catch (e) {
          console.warn("Cleared existing recaptcha verifier");
        }
        (window as any).recaptchaVerifier = null;
      }
      
      const verifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        },
        'expired-callback': () => {
          setErrorMsg('reCAPTCHA expired. Please request verification again.');
        }
      });
      
      (window as any).recaptchaVerifier = verifier;
      return verifier;
    } catch (err: any) {
      console.error("reCAPTCHA initialization error:", err);
      return null;
    }
  };

  const clearRecaptcha = () => {
    if ((window as any).recaptchaVerifier) {
      try {
        ((window as any).recaptchaVerifier).clear();
      } catch (e) {
        // ignore
      }
      (window as any).recaptchaVerifier = null;
    }
  };

  const triggerGenerateOtp = () => {
    // Generate a secure, simulated 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    return code;
  };

  const handleGoToLogin = () => {
    setErrorMsg('');
    setRecaptchaError(false);
    setSmsRegionError(false);
    setHostnameError(false);
    setView('login');
  };

  const handleGoToSignup = () => {
    setErrorMsg('');
    setRecaptchaError(false);
    setSmsRegionError(false);
    setHostnameError(false);
    setView('signup');
  };

  const handleBackToLanding = () => {
    setErrorMsg('');
    setRecaptchaError(false);
    setSmsRegionError(false);
    setHostnameError(false);
    setView('landing');
  };

  // Helper to format clean E.164 phone number
  const getFormattedMobile = () => {
    const isSandbox = localMobile.trim() === '123456789' || localMobile.trim() === '9999999999';
    if (isSandbox) {
      return { isSandbox: true, formattedMobile: '123456789', e164Mobile: '+911234567890' };
    }
    const cleanCountry = countryCode.trim().startsWith('+') ? countryCode.trim() : `+${countryCode.trim().replace(/\D/g, '')}`;
    const cleanLocal = localMobile.trim().replace(/\D/g, '').replace(/^0+/, '');
    const formatted = `${cleanCountry}${cleanLocal}`;
    return { isSandbox: false, formattedMobile: formatted, e164Mobile: formatted };
  };

  // Login handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setRecaptchaError(false);
    setSmsRegionError(false);
    setHostnameError(false);
    
    const { isSandbox, formattedMobile, e164Mobile } = getFormattedMobile();
    const currentAuthMode = isSandbox ? 'simulated' : authMode;
    setMobile(formattedMobile);
    
    if (!formattedMobile || formattedMobile.length < 8) {
      setErrorMsg('Please enter a valid mobile number with country code (e.g. +91 9876543210)');
      return;
    }

    setIsSubmitting(true);
    try {
      // Check if user exists in Firestore
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('mobile', '==', formattedMobile));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        if (isSandbox) {
          // Auto create/mock sandbox user to make login seamless!
          const sandboxUser = {
            name: 'Sandbox Organizer',
            mobile: '123456789',
            email: 'sandbox@qpass.com'
          };
          setTempUser(sandboxUser);
          setOtpPurpose('login');
          setAuthMode('simulated');
          setGeneratedOtp('123456');
          setView('otp_verify');
          setIsSubmitting(false);
          return;
        }
        setErrorMsg('Mobile number not registered. Please sign up first!');
        setIsSubmitting(false);
        // Automatically prompt to Register after a short delay
        setTimeout(() => {
          setView('signup');
        }, 1500);
        return;
      }

      // User exists, move to verification page
      const matchedUserDoc = querySnapshot.docs[0];
      const userData = matchedUserDoc.data();
      
      setTempUser({
        name: userData.name || 'Organizer',
        mobile: userData.mobile,
        email: userData.email || ''
      });
      setOtpPurpose('login');

      if (currentAuthMode === 'firebase') {
        // 1. Initialize Invisible reCAPTCHA
        const verifier = setupRecaptcha('recaptcha-container');
        if (!verifier) {
          throw new Error('Failed to initialize security verification. Please try Sandbox Mode.');
        }

        // 2. Trigger Firebase Phone Auth
        const confirmation = await signInWithPhoneNumber(auth, e164Mobile, verifier);
        setConfirmationResult(confirmation);
        setView('otp_verify');
      } else {
        // Simulated OTP
        setAuthMode('simulated');
        const code = isSandbox ? '123456' : triggerGenerateOtp();
        if (isSandbox) {
          setGeneratedOtp('123456');
        }
        setView('otp_verify');
        console.log(`[QPass Testing Mode] Generated OTP: ${isSandbox ? '123456' : code}`);
      }
    } catch (err: any) {
      console.error("Firebase Phone Sign In Error:", err);
      clearRecaptcha();
      let errMsg = err.message || 'Error checking user credentials. Please try again.';
      
      const errStr = String(err.message || '').toLowerCase() + ' ' + String(err.code || '').toLowerCase();
      
      if (errStr.includes('too_short') || errStr.includes('too-short') || err.code === 'auth/invalid-phone-number') {
        errMsg = 'The mobile number you entered is invalid. Please ensure you entered the correct country code (e.g. +91 for India, +1 for US) followed by your 10-digit number.';
      } else if (errStr.includes('region enabled') || errStr.includes('sms unable to be sent') || err.code === 'auth/operation-not-allowed') {
        errMsg = 'SMS Delivery Restriction: SMS messages cannot be delivered to this region until enabled in Firebase Console, or daily limit reached. Toggle Sandbox Mode below to test instantly!';
        setSmsRegionError(true);
        setRecaptchaError(true);
      } else if (errStr.includes('hostname match') || errStr.includes('captcha-check-failed') || err.code === 'auth/captcha-check-failed') {
        errMsg = 'Domain Authorization Notice: This hostname is not authorized in Firebase Console settings. Switch to Sandbox Mode below or add domain in Firebase Console.';
        setHostnameError(true);
        setRecaptchaError(true);
      } else if (err.code === 'auth/invalid-app-credential') {
        errMsg = 'Invalid app credentials or iframe domain restriction. Please switch to Sandbox Mode below to test.';
        setRecaptchaError(true);
      } else if (err.code === 'auth/too-many-requests' || err.code === 'auth/quota-exceeded') {
        errMsg = 'Firebase daily SMS quota (10 SMS/day on Spark free tier) exceeded. Please switch to Sandbox Mode to continue testing.';
        setRecaptchaError(true);
      }
      setErrorMsg(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Signup/Register handler
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setRecaptchaError(false);
    setSmsRegionError(false);
    setHostnameError(false);

    const { isSandbox, formattedMobile, e164Mobile } = getFormattedMobile();
    const currentAuthMode = isSandbox ? 'simulated' : authMode;
    setMobile(formattedMobile);

    if (!name.trim() || !formattedMobile || !email.trim()) {
      setErrorMsg('Please fill in all 3 fields');
      return;
    }

    if (formattedMobile.length < 8) {
      setErrorMsg('Please enter a valid mobile number');
      return;
    }

    if (!email.includes('@')) {
      setErrorMsg('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      // Check if mobile already exists
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('mobile', '==', formattedMobile));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setErrorMsg('Mobile number already registered. Please login instead.');
        setIsSubmitting(false);
        return;
      }

      // Save to temp state
      setTempUser({
        name: name.trim(),
        mobile: formattedMobile,
        email: email.trim()
      });
      setOtpPurpose('register');

      if (currentAuthMode === 'firebase') {
        // 1. Initialize Invisible reCAPTCHA
        const verifier = setupRecaptcha('recaptcha-container');
        if (!verifier) {
          throw new Error('Failed to initialize security verification. Please try Sandbox Mode.');
        }

        // 2. Trigger Firebase Phone Auth
        const confirmation = await signInWithPhoneNumber(auth, e164Mobile, verifier);
        setConfirmationResult(confirmation);
        setView('otp_verify');
      } else {
        // Simulated OTP
        setAuthMode('simulated');
        const code = isSandbox ? '123456' : triggerGenerateOtp();
        if (isSandbox) {
          setGeneratedOtp('123456');
        }
        setView('otp_verify');
        console.log(`[QPass Testing Mode] Generated OTP: ${isSandbox ? '123456' : code}`);
      }
    } catch (err: any) {
      console.error("Firebase Phone Sign Up Error:", err);
      clearRecaptcha();
      let errMsg = err.message || 'Error connecting to database. Please try again.';
      
      const errStr = String(err.message || '').toLowerCase() + ' ' + String(err.code || '').toLowerCase();
      
      if (errStr.includes('too_short') || errStr.includes('too-short') || err.code === 'auth/invalid-phone-number') {
        errMsg = 'The mobile number you entered is invalid. Please ensure you entered the correct country code (e.g. +91 for India) followed by your 10-digit number.';
      } else if (errStr.includes('region enabled') || errStr.includes('sms unable to be sent') || err.code === 'auth/operation-not-allowed') {
        errMsg = 'SMS Delivery Restriction: SMS messages cannot be sent to this region until enabled in Firebase Console. Toggle Sandbox Mode below to test!';
        setSmsRegionError(true);
        setRecaptchaError(true);
      } else if (errStr.includes('hostname match') || errStr.includes('captcha-check-failed') || err.code === 'auth/captcha-check-failed') {
        errMsg = 'Domain Authorization Notice: This domain is not authorized in Firebase Console settings. Switch to Sandbox Mode below or add domain in Firebase Console.';
        setHostnameError(true);
        setRecaptchaError(true);
      } else if (err.code === 'auth/invalid-app-credential') {
        errMsg = 'Invalid credentials or iframe domain restriction. Please switch to Sandbox Mode below to test.';
        setRecaptchaError(true);
      } else if (err.code === 'auth/too-many-requests' || err.code === 'auth/quota-exceeded') {
        errMsg = 'Firebase daily SMS quota (10 SMS/day on Spark free tier) reached. Switch to Sandbox Mode to test.';
        setRecaptchaError(true);
      }
      setErrorMsg(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // OTP Validation handler
  const handleOtpVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!tempUser) {
      setErrorMsg('Session expired. Please try again.');
      setView('landing');
      return;
    }

    if (!otpInput || otpInput.trim().length < 6) {
      setErrorMsg('Please enter a 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      let userUid = `user_${tempUser.mobile}`;

      if (authMode === 'firebase') {
        if (!confirmationResult) {
          throw new Error('No active verification session. Please request a new code.');
        }
        
        // Confirm real Firebase code
        const userCredential = await confirmationResult.confirm(otpInput.trim());
        if (userCredential.user) {
          userUid = userCredential.user.uid;
        }
      } else {
        // Simulated check
        if (otpInput.trim() !== generatedOtp) {
          setErrorMsg('Invalid verification code. Please check the simulated SMS tray above.');
          setIsSubmitting(false);
          return;
        }
      }

      const userProfile: UserProfile = {
        uid: userUid,
        name: tempUser.name,
        mobile: tempUser.mobile,
        email: tempUser.email,
        createdAt: new Date().toISOString()
      };

      if (otpPurpose === 'register') {
        // Save user details into Firestore users collection
        await setDoc(doc(db, 'users', userUid), userProfile);
      }

      // Save profile to localStorage for session persistence
      localStorage.setItem('qpass_current_user', JSON.stringify(userProfile));
      
      // Success Callback!
      onAuthSuccess(userProfile);
    } catch (err: any) {
      console.error("Verification confirmation error:", err);
      let errMsg = err.message || 'Error completing authentication. Please try again.';
      if (err.code === 'auth/invalid-verification-code') {
        errMsg = 'Invalid verification code. Please double-check and try again.';
      }
      setErrorMsg(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSmsRegionGuide = () => {
    if (!smsRegionError) return null;
    return (
      <div className={`mt-3 p-3.5 rounded-2xl border text-xs leading-relaxed text-left animate-scale-up ${
        isDark 
          ? 'bg-neutral-900/60 border-amber-500/20 text-neutral-300' 
          : 'bg-amber-50/50 border-amber-200/60 text-neutral-700'
      }`}>
        <div className="flex items-center gap-2 mb-2 font-bold text-amber-500 text-[11px] uppercase tracking-wider">
          <ShieldAlert size={14} className="shrink-0 text-amber-500 animate-pulse" />
          <span>How to Enable SMS Regions in Firebase</span>
        </div>
        <p className="text-[10.5px] mb-2 font-medium">
          By default, Firebase restricts SMS delivery to certain billing regions. To resolve this error and enable SMS delivery for your country/region:
        </p>
        <ol className="list-decimal list-inside space-y-1.5 text-[10px] pl-1 font-normal text-neutral-400 dark:text-neutral-400">
          <li>
            Open the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline font-semibold">Firebase Console</a> and select your project.
          </li>
          <li>
            In the left sidebar, navigate to <span className="font-semibold text-neutral-300 dark:text-neutral-200">Build &gt; Authentication</span>.
          </li>
          <li>
            Click on the <span className="font-semibold text-neutral-300 dark:text-neutral-200">Sign-in method</span> tab.
          </li>
          <li>
            Under <span className="font-semibold text-neutral-300 dark:text-neutral-200">Sign-in providers</span>, click the <span className="font-semibold text-neutral-300 dark:text-neutral-200">Phone</span> provider to edit it.
          </li>
          <li>
            Expand the <span className="font-semibold text-neutral-300 dark:text-neutral-200">SMS region policy</span> (or advanced options) section.
          </li>
          <li>
            Select <span className="font-semibold text-neutral-300 dark:text-neutral-200">Allow</span> and add your country/region (e.g., <span className="font-semibold text-indigo-400">India</span>) to the allowed list, then click <span className="font-semibold text-neutral-300 dark:text-neutral-200">Save</span>.
          </li>
        </ol>
        <div className="mt-3 pt-2 border-t border-neutral-800/10 dark:border-neutral-200/20">
          <p className="text-[9.5px] text-neutral-400 leading-normal">
            💡 <span className="font-semibold text-indigo-400">Sandbox Test Alternative:</span> You can also add mock test phone numbers in your Firebase console under the "Phone" provider settings (e.g., <code className="bg-neutral-950 px-1 py-0.5 rounded text-neutral-200 font-mono">+91 99999 99999</code> with SMS code <code className="bg-neutral-950 px-1 py-0.5 rounded text-neutral-200 font-mono">123456</code>) for instant verification without sending a real SMS or consuming quota!
          </p>
        </div>
      </div>
    );
  };

  const handleCopyHostname = (host: string) => {
    navigator.clipboard.writeText(host);
    setCopiedHost(true);
    setTimeout(() => setCopiedHost(false), 2000);
  };

  const renderHostnameGuide = () => {
    if (!hostnameError) return null;
    const currentHost = window.location.hostname || 'ais-pre-zzd5t7g4bfhfpjsltzmgtl-559238192323.asia-southeast1.run.app';
    
    return (
      <div className={`mt-3 p-3.5 rounded-2xl border text-xs leading-relaxed text-left animate-scale-up ${
        isDark 
          ? 'bg-neutral-900/60 border-amber-500/20 text-neutral-300' 
          : 'bg-amber-50/50 border-amber-200/60 text-neutral-700'
      }`}>
        <div className="flex items-center gap-2 mb-2 font-bold text-amber-500 text-[11px] uppercase tracking-wider">
          <ShieldAlert size={14} className="shrink-0 text-amber-500 animate-pulse" />
          <span>How to Authorize Hostname in Firebase</span>
        </div>
        <p className="text-[10.5px] mb-2 font-medium">
          Firebase restricts Phone/reCAPTCHA authentication to authorized domains only. To authorize this application environment:
        </p>
        <div className="mb-3 p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800/10 dark:border-neutral-800/80 flex items-center justify-between gap-2">
          <div className="overflow-hidden">
            <p className="text-[8px] text-neutral-500 font-mono tracking-wider">YOUR CURRENT WEB HOSTNAME</p>
            <p className="text-[10.5px] font-semibold text-neutral-200 font-mono truncate">{currentHost}</p>
          </div>
          <button
            type="button"
            onClick={() => handleCopyHostname(currentHost)}
            className="shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm"
          >
            {copiedHost ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <ol className="list-decimal list-inside space-y-1.5 text-[10px] pl-1 font-normal text-neutral-400 dark:text-neutral-400">
          <li>
            Open the <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline font-semibold">Firebase Console</a> and open your project.
          </li>
          <li>
            Navigate to <span className="font-semibold text-neutral-300 dark:text-neutral-200">Build &gt; Authentication</span>.
          </li>
          <li>
            Click the <span className="font-semibold text-neutral-300 dark:text-neutral-200">Settings</span> tab at the top.
          </li>
          <li>
            Select <span className="font-semibold text-neutral-300 dark:text-neutral-200">Authorized domains</span> in the left panel.
          </li>
          <li>
            Click <span className="font-semibold text-neutral-300 dark:text-neutral-200">Add domain</span> and paste the copied hostname (<code className="bg-neutral-950 px-1 py-0.5 rounded text-neutral-300">{currentHost}</code>), then click <span className="font-semibold text-neutral-300 dark:text-neutral-200">Add</span>.
          </li>
          <li>
            Also click <span className="font-semibold text-neutral-300 dark:text-neutral-200">Add domain</span> and add <code className="bg-neutral-950 px-1 py-0.5 rounded text-neutral-300">localhost</code> and <code className="bg-neutral-950 px-1 py-0.5 rounded text-neutral-300">asia-southeast1.run.app</code> if you are testing inside an iframe.
          </li>
        </ol>
        <div className="mt-3 pt-2 border-t border-neutral-800/10 dark:border-neutral-200/20">
          <p className="text-[9.5px] text-neutral-400 leading-normal">
            💡 <span className="font-semibold text-indigo-400">Instant Bypass:</span> You can also bypass this domain registration check instantly by toggling <span className="font-bold text-indigo-400">Developer Sandbox Mode</span> below to test user registration and kiosk flows!
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col justify-between overflow-hidden relative">
      
      {/* Floating Theme Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <button
          type="button"
          onClick={onToggleTheme}
          className={`p-2 rounded-xl transition-all hover:scale-105 shadow-sm border ${
            isDark 
              ? 'bg-neutral-900 border-neutral-850 hover:bg-neutral-800 text-amber-400' 
              : 'bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-600'
          }`}
          title="Toggle Dark Mode"
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>

      {/* Invisible reCAPTCHA Anchor */}
      <div id="recaptcha-container"></div>

      {/* Dynamic Simulated OTP banner to allow easy testing */}
      {view === 'otp_verify' && authMode === 'simulated' && generatedOtp && (
        <div className="p-3 mx-4 mt-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-start gap-2.5 shadow-sm animate-scale-up shrink-0">
          <Key size={16} className="text-indigo-500 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-normal font-medium">
            <span className="font-bold block text-indigo-300">Simulated SMS Message</span>
            <span>QPass Verification Code is: </span>
            <span className="font-extrabold tracking-wider bg-indigo-500/20 px-1.5 py-0.5 rounded text-indigo-300">{generatedOtp}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col justify-center">
        
        {/* LANDING VIEW */}
        {view === 'landing' && (
          <div className="space-y-6 text-center animate-scale-up">
            {/* Logo and Greeting card */}
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white font-extrabold text-2xl mx-auto shadow-xl shadow-indigo-500/25">
                Q
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight">Welcome to QPass</h2>
                <p className={`text-xs mt-1 leading-normal max-w-[240px] mx-auto ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  Effortless Entry for Every Event
                </p>
              </div>
            </div>

            {/* Core Action Buttons */}
            <div className="space-y-3 max-w-xs mx-auto">
              <button
                type="button"
                id="landing-login-button"
                onClick={handleGoToLogin}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-500/15 transition-all hover:scale-102 flex items-center justify-center gap-1.5"
              >
                Login with OTP
                <ArrowRight size={13} />
              </button>

              <button
                type="button"
                id="landing-signup-button"
                onClick={handleGoToSignup}
                className={`w-full py-3.5 rounded-2xl text-xs font-bold border transition-all hover:scale-102 ${
                  isDark 
                    ? 'border-neutral-800 hover:bg-neutral-900 text-neutral-300' 
                    : 'border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                }`}
              >
                Don't have an account? Sign up for free!
              </button>
            </div>

            {/* Quick trust badge */}
            <div className="pt-2 flex items-center justify-center gap-1.5 opacity-60">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span className="text-[10px] font-semibold tracking-wide uppercase">
                Secure OTP Verification Active
              </span>
            </div>
          </div>
        )}

        {/* LOGIN VIEW */}
        {view === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-5 animate-scale-up">
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={handleBackToLanding}
                className={`flex items-center gap-1 text-[11px] font-bold ${isDark ? 'text-neutral-500 hover:text-neutral-400' : 'text-neutral-400 hover:text-neutral-500'}`}
              >
                <ArrowLeft size={12} />
                Back
              </button>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-extrabold tracking-tight">Sign In</h3>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium flex flex-col gap-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>Authentication Notice</span>
                </div>
                <p className="text-[11px] leading-relaxed">{errorMsg}</p>
                {recaptchaError && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('simulated');
                      setErrorMsg('');
                      setRecaptchaError(false);
                      setSmsRegionError(false);
                      setHostnameError(false);
                    }}
                    className="mt-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-lg w-fit transition-all"
                  >
                    Switch to Developer Sandbox Mode
                  </button>
                )}
              </div>
            )}

            {renderSmsRegionGuide()}
            {renderHostnameGuide()}

            <div className="space-y-4">
              <div className={`space-y-1.5 p-3 rounded-2xl border ${isDark ? 'border-neutral-800 bg-neutral-900/20' : 'border-neutral-150 bg-neutral-50/40'}`}>
                <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  Mobile Number
                </label>
                <div className="flex gap-2">
                  <div className="relative w-24 shrink-0">
                    <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>Code</span>
                    <input
                      type="text"
                      required
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      placeholder="+91"
                      className={`w-full pl-11 pr-2 py-2.5 rounded-xl text-xs border font-semibold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                        isDark 
                          ? 'bg-neutral-950 border-neutral-800 text-neutral-200 focus:border-indigo-500/50' 
                          : 'bg-white border-neutral-200 text-neutral-800 focus:border-indigo-500'
                      }`}
                    />
                  </div>
                  <div className="relative flex-1">
                    <Smartphone size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`} />
                    <input
                      type="tel"
                      required
                      value={localMobile}
                      onChange={(e) => setLocalMobile(e.target.value.replace(/\D/g, ''))}
                      placeholder="9876543210"
                      className={`w-full pl-8 pr-3 py-2.5 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                        isDark 
                          ? 'bg-neutral-950 border-neutral-800 text-neutral-200 focus:border-indigo-500/50' 
                          : 'bg-white border-neutral-200 text-neutral-800 focus:border-indigo-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                id="login-submit-button"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-500/15 transition-all hover:scale-102 flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? 'Requesting OTP...' : 'Request OTP'}
                <ArrowRight size={13} />
              </button>
            </div>
          </form>
        )}

        {/* SIGNUP VIEW */}
        {view === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="space-y-5 animate-scale-up">
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={handleBackToLanding}
                className={`flex items-center gap-1 text-[11px] font-bold ${isDark ? 'text-neutral-500 hover:text-neutral-400' : 'text-neutral-400 hover:text-neutral-500'}`}
              >
                <ArrowLeft size={12} />
                Back
              </button>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-extrabold tracking-tight">Create Account</h3>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  authMode === 'firebase' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-500'
                }`}>
                  {authMode === 'firebase' ? 'Real SMS' : 'Sandbox'}
                </span>
              </div>
              <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Register to start configuring voice-enabled events.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium flex flex-col gap-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>Authentication Notice</span>
                </div>
                <p className="text-[11px] leading-relaxed">{errorMsg}</p>
                {recaptchaError && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('simulated');
                      setErrorMsg('');
                      setRecaptchaError(false);
                      setSmsRegionError(false);
                      setHostnameError(false);
                    }}
                    className="mt-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-lg w-fit transition-all"
                  >
                    Switch to Developer Sandbox Mode
                  </button>
                )}
              </div>
            )}

            {renderSmsRegionGuide()}
            {renderHostnameGuide()}

            <div className="space-y-3">
              {/* Name field */}
              <div className={`space-y-1 p-3 rounded-2xl border ${isDark ? 'border-neutral-800 bg-neutral-900/20' : 'border-neutral-150 bg-neutral-50/40'}`}>
                <label className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  Full Name
                </label>
                <div className="relative">
                  <User size={13} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`} />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="E.g., Seetharam"
                    className={`w-full pl-8 pr-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                      isDark 
                        ? 'bg-neutral-950 border-neutral-800 text-neutral-200' 
                        : 'bg-white border-neutral-200 text-neutral-800'
                    }`}
                  />
                </div>
              </div>

              {/* Mobile field */}
              <div className={`space-y-1.5 p-3 rounded-2xl border ${isDark ? 'border-neutral-800 bg-neutral-900/20' : 'border-neutral-150 bg-neutral-50/40'}`}>
                <label className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  Mobile Number
                </label>
                <div className="flex gap-2">
                  <div className="relative w-20 shrink-0">
                    <input
                      type="text"
                      required
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      placeholder="+91"
                      className={`w-full px-2 py-2 rounded-xl text-xs border font-semibold text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                        isDark 
                          ? 'bg-neutral-950 border-neutral-800 text-neutral-200' 
                          : 'bg-white border-neutral-200 text-neutral-800'
                      }`}
                    />
                  </div>
                  <div className="relative flex-1">
                    <Smartphone size={13} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`} />
                    <input
                      type="tel"
                      required
                      value={localMobile}
                      onChange={(e) => setLocalMobile(e.target.value.replace(/\D/g, ''))}
                      placeholder="9876543210"
                      className={`w-full pl-7 pr-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                        isDark 
                          ? 'bg-neutral-950 border-neutral-800 text-neutral-200' 
                          : 'bg-white border-neutral-200 text-neutral-800'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Email field */}
              <div className={`space-y-1 p-3 rounded-2xl border ${isDark ? 'border-neutral-800 bg-neutral-900/20' : 'border-neutral-150 bg-neutral-50/40'}`}>
                <label className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={13} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-neutral-600' : 'text-neutral-400'}`} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E.g., email@example.com"
                    className={`w-full pl-8 pr-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                      isDark 
                        ? 'bg-neutral-950 border-neutral-800 text-neutral-200' 
                        : 'bg-white border-neutral-200 text-neutral-800'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                id="signup-submit-button"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-500/15 transition-all hover:scale-102 flex items-center justify-center gap-1.5 mt-2"
              >
                {isSubmitting ? 'Requesting code...' : 'Send OTP Verification'}
                <ArrowRight size={13} />
              </button>
            </div>
          </form>
        )}

        {/* OTP VERIFY VIEW */}
        {view === 'otp_verify' && (
          <form onSubmit={handleOtpVerifySubmit} className="space-y-5 animate-scale-up">
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setView(otpPurpose === 'login' ? 'login' : 'signup')}
                className={`flex items-center gap-1 text-[11px] font-bold ${isDark ? 'text-neutral-500 hover:text-neutral-400' : 'text-neutral-400 hover:text-neutral-500'}`}
              >
                <ArrowLeft size={12} />
                Edit number
              </button>
              <h3 className="text-lg font-extrabold tracking-tight">Verify Mobile</h3>
              <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Enter the 6-digit verification code sent to <span className="font-extrabold">{tempUser?.mobile}</span>.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold flex items-center gap-2 animate-shake">
                <AlertCircle size={14} className="shrink-0" />
                {errorMsg}
              </div>
            )}

            <div className="space-y-4">
              <div className={`space-y-1.5 p-3 rounded-2xl border ${isDark ? 'border-neutral-800 bg-neutral-900/20' : 'border-neutral-150 bg-neutral-50/40'}`}>
                <label className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="------"
                  className="w-full text-center tracking-[0.5em] text-xl font-extrabold py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all dark:bg-neutral-950 dark:border-neutral-800 dark:text-neutral-200"
                />
              </div>

              <button
                type="submit"
                id="otp-submit-button"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-500/15 transition-all hover:scale-102 flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? 'Confirming Code...' : 'Verify & Submit'}
                <Check size={14} />
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
