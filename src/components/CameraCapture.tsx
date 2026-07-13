/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, AlertCircle } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  savedImage?: string;
  isDark: boolean;
  countdownTrigger?: boolean;
  onCountdownComplete?: () => void;
}

export default function CameraCapture({
  onCapture,
  savedImage,
  isDark,
  countdownTrigger = false,
  onCountdownComplete
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState<boolean>(false);

  // Start Camera Stream
  const startCamera = async () => {
    setError(null);
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: 'user' // Default to selfie/front camera
        },
        audio: false
      });

      setStream(mediaStream);
      setIsCameraActive(true);
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setError('Could not access camera. Please check permissions.');
      setIsCameraActive(false);
    }
  };

  // Keep the video element srcObject synchronized with the stream
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isCameraActive]);

  // Stop Camera Stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  // Take photo
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        const width = video.videoWidth > 0 ? video.videoWidth : 640;
        const height = video.videoHeight > 0 ? video.videoHeight : 480;
        canvas.width = width;
        canvas.height = height;
        
        // Draw the video frame to the canvas
        context.drawImage(video, 0, 0, width, height);
        
        // Convert to base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        
        // Flash animation
        setFlash(true);
        setTimeout(() => setFlash(false), 200);

        onCapture(dataUrl);
        stopCamera();
      }
    }
  };

  // Handle Voice-triggered countdown
  useEffect(() => {
    if (countdownTrigger && isCameraActive) {
      setCountdown(3);
    } else if (countdownTrigger && !isCameraActive) {
      // Auto start camera if voice needs it
      startCamera().then(() => {
        setCountdown(3);
      });
    }
  }, [countdownTrigger]);

  // Countdown timer logic
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown reached 0
      capturePhoto();
      setCountdown(null);
      if (onCountdownComplete) {
        onCountdownComplete();
      }
    }
  }, [countdown]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Visual Canvas Container */}
      <div 
        id="camera-view-container"
        className={`relative w-full aspect-video rounded-2xl overflow-hidden shadow-md flex items-center justify-center transition-all duration-300 border ${
          isDark 
            ? 'bg-neutral-900 border-neutral-800' 
            : 'bg-neutral-100 border-neutral-200'
        }`}
      >
        {/* Flash Effect overlay */}
        {flash && (
          <div className="absolute inset-0 bg-white z-50 animate-flash" />
        )}

        {/* Countdown overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 bg-black/60 z-40 flex flex-col items-center justify-center text-white">
            <div className="text-8xl font-black tracking-widest scale-up animate-pulse">
              {countdown > 0 ? countdown : 'Smile! 📸'}
            </div>
            <p className="mt-4 text-sm font-medium tracking-wide uppercase text-neutral-300">
              Capturing photo...
            </p>
          </div>
        )}

        {/* Saved image preview */}
        {savedImage && !isCameraActive && countdown === null ? (
          <div className="relative w-full h-full group">
            <img 
              src={savedImage} 
              alt="Visitor check-in" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              id="visitor-preview-image"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                id="retake-photo-button"
                onClick={startCamera}
                className="px-4 py-2 bg-white/90 hover:bg-white text-neutral-900 rounded-xl font-semibold text-sm shadow flex items-center gap-2 transition-all"
              >
                <RefreshCw size={16} />
                Retake Photo
              </button>
            </div>
          </div>
        ) : isCameraActive ? (
          /* Active video stream */
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            id="camera-video-stream"
            className="w-full h-full object-cover"
          />
        ) : (
          /* Camera inactive / Initial view */
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className={`p-4 rounded-full mb-3 ${isDark ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-200/50 text-neutral-500'}`}>
              <Camera size={32} />
            </div>
            <p className={`text-sm font-medium ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Visitor Camera
            </p>
            {error ? (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-500 max-w-xs font-medium">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            ) : (
              <p className={`text-xs mt-1 max-w-xs ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Will be captured automatically during voice assistant registration or click below to manually start camera.
              </p>
            )}
            
            <button
              type="button"
              id="start-camera-button"
              onClick={startCamera}
              className={`mt-4 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm border transition-all flex items-center gap-1.5 ${
                isDark 
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700' 
                  : 'bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200'
              }`}
            >
              <Camera size={14} />
              Open Camera
            </button>
          </div>
        )}
      </div>

      {/* Manual Controls when Camera is active */}
      {isCameraActive && (
        <div className="flex gap-2 mt-3 w-full">
          <button
            type="button"
            id="capture-manual-button"
            onClick={capturePhoto}
            className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs shadow transition-all flex items-center justify-center gap-1.5"
          >
            <Camera size={14} />
            Capture Now
          </button>
          <button
            type="button"
            id="cancel-camera-button"
            onClick={stopCamera}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
              isDark 
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700' 
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600 border-neutral-200'
            }`}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Hidden canvas for taking snapshot */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
