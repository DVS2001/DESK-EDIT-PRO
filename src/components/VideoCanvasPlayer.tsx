import React, { useRef, useEffect, useState, useMemo } from 'react';
import { 
  Play, Pause, RotateCcw, Volume2, VolumeX, Maximize2, 
  Grid, Shield, Sparkles, Smartphone, Layers, SkipBack, SkipForward,
  FastForward, Rewind, Eye, Sun, Zap, Wind
} from 'lucide-react';
import { TimelineClip, AspectRatio, LumetriColorSettings, AppliedTransition } from '../types/editor';
import { secondsToTimecode } from '../utils/timecode';

interface VideoCanvasPlayerProps {
  currentTime: number;
  isPlaying: boolean;
  duration: number;
  clips: TimelineClip[];
  aspectRatio: AspectRatio;
  onTimeUpdate: (time: number) => void;
  onTogglePlay: () => void;
  selectedClipId: string | null;
  isProxyModeActive?: boolean;
  onToggleProxyMode?: (active: boolean) => void;
  appliedTransitions?: AppliedTransition[];
}

export const VideoCanvasPlayer: React.FC<VideoCanvasPlayerProps> = ({
  currentTime,
  isPlaying,
  duration,
  clips,
  aspectRatio,
  onTimeUpdate,
  onTogglePlay,
  selectedClipId,
  isProxyModeActive = true,
  onToggleProxyMode,
  appliedTransitions = [],
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showSafeMargins, setShowSafeMargins] = useState(false);
  const [showRuleOfThirds, setShowRuleOfThirds] = useState(false);
  const [showSocialOverlay, setShowSocialOverlay] = useState(aspectRatio === '9:16');
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [previewQuality, setPreviewQuality] = useState<'Full' | '1/2' | '1/4'>('Full');
  const [splitCompare, setSplitCompare] = useState(false);
  const [vuLeft, setVuLeft] = useState(-18);
  const [vuRight, setVuRight] = useState(-18);

  // Sync social overlay state when aspect ratio changes
  useEffect(() => {
    if (aspectRatio === '9:16') {
      setShowSocialOverlay(true);
    } else {
      setShowSocialOverlay(false);
    }
  }, [aspectRatio]);

  // Find currently active clips at currentTime
  const activeVideoClips = useMemo(() => {
    return clips
      .filter((c) => c.type === 'video' && currentTime >= c.startTime && currentTime < c.startTime + c.duration)
      .sort((a, b) => {
        // Track layer hierarchy: V2 above V1
        return a.trackId.localeCompare(b.trackId);
      });
  }, [clips, currentTime]);

  const activeCaptionClip = useMemo(() => {
    return clips.find((c) => c.type === 'text' && currentTime >= c.startTime && currentTime < c.startTime + c.duration);
  }, [clips, currentTime]);

  // Selected or topmost active video clip
  const currentVideoClip = activeVideoClips[activeVideoClips.length - 1] || clips.find(c => c.type === 'video');

  // Active Transition calculation when playhead crosses a transition cut boundary
  const activeTransition = useMemo(() => {
    if (!appliedTransitions || appliedTransitions.length === 0) return null;
    return appliedTransitions.find((t) => {
      const half = t.duration / 2;
      return currentTime >= t.cutTime - half && currentTime <= t.cutTime + half;
    }) || null;
  }, [appliedTransitions, currentTime]);

  const transitionProgress = useMemo(() => {
    if (!activeTransition) return 0;
    const half = activeTransition.duration / 2;
    const start = activeTransition.cutTime - half;
    return Math.max(0, Math.min(1, (currentTime - start) / activeTransition.duration));
  }, [activeTransition, currentTime]);

  const transitionClipA = useMemo(() => {
    if (!activeTransition) return null;
    return clips.find((c) => c.id === activeTransition.fromClipId) || null;
  }, [activeTransition, clips]);

  const transitionClipB = useMemo(() => {
    if (!activeTransition) return null;
    return clips.find((c) => c.id === activeTransition.toClipId) || null;
  }, [activeTransition, clips]);

  // =========================================================================
  // AI MOTION BLUR (Optical Flow, Shutter Angle & High-Velocity Synthesis)
  // =========================================================================
  const motionBlurSettings = currentVideoClip?.motionBlur;
  const isMotionBlurActive = Boolean(
    motionBlurSettings?.isEnabled && !motionBlurSettings?.isBypassed
  );

  // Compute velocity based on velocity envelope or high-velocity threshold
  const currentVelocityMultiplier = useMemo(() => {
    if (!currentVideoClip) return 1.0;
    const clipRelTime = Math.max(0, currentTime - currentVideoClip.startTime);
    const velEnv = currentVideoClip.velocityEnvelope || [];
    if (velEnv.length >= 2) {
      for (let i = 0; i < velEnv.length - 1; i++) {
        if (clipRelTime >= velEnv[i].timeOffset && clipRelTime <= velEnv[i + 1].timeOffset) {
          const t1 = velEnv[i].timeOffset;
          const t2 = velEnv[i + 1].timeOffset;
          const v1 = velEnv[i].value;
          const v2 = velEnv[i + 1].value;
          const ratio = (clipRelTime - t1) / Math.max(0.001, t2 - t1);
          return v1 + (v2 - v1) * ratio;
        }
      }
      return velEnv[velEnv.length - 1].value;
    }
    return 1.15;
  }, [currentVideoClip, currentTime]);

  const motionBlurPixels = useMemo(() => {
    if (!isMotionBlurActive || !motionBlurSettings) return 0;
    const baseBlur = (motionBlurSettings.blurAmount || 50) / 12;
    const shutterMult = (motionBlurSettings.shutterAngle || 180) / 180;
    const velMult = Math.max(0.4, currentVelocityMultiplier);
    return Math.min(22, Math.max(0, baseBlur * shutterMult * velMult));
  }, [isMotionBlurActive, motionBlurSettings, currentVelocityMultiplier]);

  // Compute CSS filter for Lumetri Color
  const getLumetriFilterString = (lumetri?: LumetriColorSettings) => {
    if (!lumetri) return 'none';
    const exposureMult = 1 + lumetri.exposure / 100;
    const contrastMult = 1 + lumetri.contrast / 100;
    const satMult = lumetri.saturation / 100;
    const tempDeg = lumetri.temperature * 0.4;

    let presetFilter = '';
    if (lumetri.lutPreset === 'teal_orange') {
      presetFilter = 'contrast(115%) saturate(130%) hue-rotate(-8deg)';
    } else if (lumetri.lutPreset === 'cyberpunk') {
      presetFilter = 'contrast(135%) saturate(160%) hue-rotate(25deg) brightness(105%)';
    } else if (lumetri.lutPreset === 'warm_cinema') {
      presetFilter = 'sepia(20%) saturate(120%) contrast(110%)';
    } else if (lumetri.lutPreset === 'bleach_bypass') {
      presetFilter = 'contrast(140%) saturate(60%) brightness(110%)';
    } else if (lumetri.lutPreset === 'noir_bw') {
      presetFilter = 'grayscale(100%) contrast(150%) brightness(95%)';
    } else if (lumetri.lutPreset === 'vintage_70s') {
      presetFilter = 'sepia(35%) contrast(95%) brightness(105%) saturate(85%) hue-rotate(-10deg)';
    }

    return `brightness(${exposureMult}) contrast(${contrastMult}) saturate(${satMult}) hue-rotate(${tempDeg}deg) ${presetFilter}`;
  };

  // Sync HTML5 video element currentTime
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentVideoClip) return;

    const clipLocalTime = Math.max(0, (currentTime - currentVideoClip.startTime) + currentVideoClip.offsetTime);
    if (Math.abs(video.currentTime - clipLocalTime) > 0.25) {
      video.currentTime = clipLocalTime;
    }
  }, [currentTime, currentVideoClip]);

  // Video play/pause effect
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.playbackRate = playbackRate;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, playbackRate]);

  // Animate VU meters when playing
  useEffect(() => {
    if (!isPlaying) {
      setVuLeft(-32);
      setVuRight(-34);
      return;
    }

    const interval = setInterval(() => {
      // Simulate dynamic audio activity with music/dialogue peaks
      const baseL = -14 + Math.sin(Date.now() / 150) * 8 + (Math.random() * 4 - 2);
      const baseR = -15 + Math.cos(Date.now() / 180) * 8 + (Math.random() * 4 - 2);
      setVuLeft(Math.max(-48, Math.min(-1, baseL)));
      setVuRight(Math.max(-48, Math.min(-1, baseR)));
    }, 80);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Aspect ratio container styles
  const aspectClass = useMemo(() => {
    switch (aspectRatio) {
      case '9:16':
        return 'w-[320px] h-[568px] sm:w-[340px] sm:h-[604px]';
      case '1:1':
        return 'w-[420px] h-[420px]';
      case '4:5':
        return 'w-[380px] h-[475px]';
      case '21:9':
        return 'w-[90%] max-w-[840px] aspect-[21/9]';
      case '16:9':
      default:
        return 'w-[92%] max-w-[800px] aspect-video';
    }
  }, [aspectRatio]);

  // Step 1 frame (1/30 sec)
  const stepFrame = (frames: number) => {
    const nextTime = Math.max(0, Math.min(duration, currentTime + frames / 30));
    onTimeUpdate(nextTime);
  };

  // Keyboard shortcut listener for J/K/L, Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        setPlaybackRate((prev) => (prev > 0 ? -1 : prev * 2));
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        if (isPlaying) onTogglePlay();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        if (!isPlaying) onTogglePlay();
        setPlaybackRate((prev) => (prev < 4 ? prev + 0.5 : 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepFrame(e.shiftKey ? -30 : -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepFrame(e.shiftKey ? 30 : 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, duration]);

  // Interpolated Motion Keyframes calculation based on current time
  const currentMotion = useMemo(() => {
    if (!currentVideoClip) return { zoom: 1, panX: 0, panY: 0, rotation: 0 };
    const kfs = currentVideoClip.motionKeyframes;
    if (!kfs || kfs.length === 0) {
      return currentVideoClip.panCrop || { zoom: 1, panX: 0, panY: 0, rotation: 0 };
    }

    const clipLocalSec = Math.max(0, currentTime - currentVideoClip.startTime);
    if (clipLocalSec <= kfs[0].timeOffset) {
      return { zoom: kfs[0].zoom, panX: kfs[0].panX, panY: kfs[0].panY, rotation: kfs[0].rotation };
    }
    const lastKf = kfs[kfs.length - 1];
    if (clipLocalSec >= lastKf.timeOffset) {
      return { zoom: lastKf.zoom, panX: lastKf.panX, panY: lastKf.panY, rotation: lastKf.rotation };
    }

    // Find interval [kfA, kfB]
    let kfA = kfs[0];
    let kfB = lastKf;
    for (let i = 0; i < kfs.length - 1; i++) {
      if (clipLocalSec >= kfs[i].timeOffset && clipLocalSec <= kfs[i + 1].timeOffset) {
        kfA = kfs[i];
        kfB = kfs[i + 1];
        break;
      }
    }

    const span = Math.max(0.001, kfB.timeOffset - kfA.timeOffset);
    const t = Math.max(0, Math.min(1, (clipLocalSec - kfA.timeOffset) / span));

    // Easing math
    const easing = kfB.easing || kfA.easing || 'ease_in_out';
    let easeT = t;
    if (easing === 'ease_in') {
      easeT = t * t;
    } else if (easing === 'ease_out') {
      easeT = t * (2 - t);
    } else if (easing === 'ease_in_out' || easing === 'bezier_s_curve') {
      easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    } else if (easing === 'elastic_whip') {
      const s = 1.70158 * 1.5;
      const t2 = t * 2;
      if (t2 < 1) {
        easeT = 0.5 * (t2 * t2 * ((s + 1) * t2 - s));
      } else {
        const tPost = t2 - 2;
        easeT = 0.5 * (tPost * tPost * ((s + 1) * tPost + s) + 2);
      }
    } else if (easing === 'exponential_slam') {
      easeT = t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
    }

    return {
      zoom: Number((kfA.zoom + (kfB.zoom - kfA.zoom) * easeT).toFixed(3)),
      panX: Number((kfA.panX + (kfB.panX - kfA.panX) * easeT).toFixed(2)),
      panY: Number((kfA.panY + (kfB.panY - kfA.panY) * easeT).toFixed(2)),
      rotation: Number((kfA.rotation + (kfB.rotation - kfA.rotation) * easeT).toFixed(2)),
    };
  }, [currentVideoClip, currentTime]);

  const panCrop = currentMotion;
  const lumetri = currentVideoClip?.lumetri;

  // Dynamic transition visual values
  const transitionZoomExtra = activeTransition?.type === 'zoom_blur' 
    ? 1 + Math.sin(transitionProgress * Math.PI) * 0.35 * ((activeTransition.parameters.intensity || 85) / 100) 
    : 1;

  const transitionBlurPx = activeTransition?.type === 'zoom_blur'
    ? Math.sin(transitionProgress * Math.PI) * 16 * ((activeTransition.parameters.intensity || 85) / 100)
    : 0;

  const transitionPanXExtra = activeTransition?.type === 'whip_pan'
    ? (transitionProgress - 0.5) * -120 * ((activeTransition.parameters.intensity || 85) / 100)
    : 0;

  const transitionGlitchActive = activeTransition?.type === 'glitch' && transitionProgress > 0.25 && transitionProgress < 0.75;

  const transitionFlareIntensity = (activeTransition?.type === 'light_leak' || activeTransition?.type === 'film_burn')
    ? Math.sin(transitionProgress * Math.PI) * ((activeTransition.parameters.intensity || 85) / 100)
    : 0;

  return (
    <div className="flex-1 flex flex-col bg-[#080c14] border-b border-[#1b2434] select-none relative overflow-hidden">
      {/* Top Preview Status Bar */}
      <div className="h-9 px-3 flex items-center justify-between bg-[#0e1422] border-b border-[#1b2434] text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Program Monitor
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400 font-mono text-[11px] bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
            {aspectRatio} ({aspectRatio === '16:9' ? '3840x2160 UHD' : aspectRatio === '9:16' ? '1080x1920 9:16 Vertical' : '1080x1080'})
          </span>

          {/* Interactive Proxy Generation Mode Indicator */}
          <button
            onClick={() => onToggleProxyMode?.(!isProxyModeActive)}
            title={isProxyModeActive ? 'Modo Proxy 720p Activo: Clic para alternar a RAW 4K' : 'Modo RAW 4K: Clic para activar Proxies 720p'}
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer border ${
              isProxyModeActive
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 shadow-sm shadow-amber-500/20'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isProxyModeActive ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>{isProxyModeActive ? '⚡ PROXY 720p (60 FPS)' : '4K RAW (NATIVO)'}</span>
          </button>

          {currentVideoClip?.activeMotionPreset && (
            <span className="bg-purple-950/80 text-purple-300 border border-purple-800/60 px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5 text-purple-400" />
              <span>Motion: {currentVideoClip.activeMotionPreset}</span>
            </span>
          )}
          {currentVideoClip?.lumetri?.lutPreset && currentVideoClip.lumetri.lutPreset !== 'none' && (
            <span className="bg-sky-950/80 text-sky-300 border border-sky-800/60 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase">
              LUT: {currentVideoClip.lumetri.lutPreset}
            </span>
          )}
          {activeTransition && (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/50 px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 animate-pulse">
              <Sparkles className="w-2.5 h-2.5 text-amber-400" />
              <span>FX: {activeTransition.title.toUpperCase()} ({(transitionProgress * 100).toFixed(0)}%)</span>
            </span>
          )}
        </div>

        {/* Viewport Guides & Utilities */}
        <div className="flex items-center gap-1.5 text-slate-300">
          <button
            onClick={() => setSplitCompare(!splitCompare)}
            title="Split-Screen Compare (Original vs Graded)"
            className={`p-1 rounded text-[11px] flex items-center gap-1 transition ${
              splitCompare ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Compare</span>
          </button>

          <button
            onClick={() => setShowRuleOfThirds(!showRuleOfThirds)}
            title="Rule of Thirds Grid"
            className={`p-1 rounded transition ${showRuleOfThirds ? 'bg-sky-500/20 text-sky-300' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowSafeMargins(!showSafeMargins)}
            title="Title & Action Safe Margins"
            className={`p-1 rounded transition ${showSafeMargins ? 'bg-sky-500/20 text-sky-300' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <Shield className="w-3.5 h-3.5" />
          </button>

          {aspectRatio === '9:16' && (
            <button
              onClick={() => setShowSocialOverlay(!showSocialOverlay)}
              title="TikTok / Reels UI Overlay Guide"
              className={`p-1 rounded transition ${showSocialOverlay ? 'bg-rose-500/20 text-rose-300' : 'hover:bg-slate-800 text-slate-400'}`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="h-3 w-px bg-slate-700 mx-1" />

          {/* Quality Selector */}
          <select
            value={isProxyModeActive ? 'Proxy' : previewQuality}
            onChange={(e) => {
              if (e.target.value === 'Proxy') {
                onToggleProxyMode?.(true);
              } else {
                if (isProxyModeActive) onToggleProxyMode?.(false);
                setPreviewQuality(e.target.value as any);
              }
            }}
            className="bg-slate-900 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 text-[11px] focus:outline-none"
          >
            <option value="Proxy">720p Proxy (Fluido 60fps)</option>
            <option value="Full">Full Res (4K RAW)</option>
            <option value="1/2">1/2 Playback</option>
            <option value="1/4">1/4 Playback</option>
          </select>
        </div>
      </div>

      {/* Main Canvas Viewport Area */}
      <div 
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-3 relative bg-radial from-[#111726] to-[#070a10]"
      >
        {/* Aspect Ratio Box Frame */}
        <div 
          className={`${aspectClass} relative rounded-md overflow-hidden shadow-2xl bg-black border border-slate-700/80 flex items-center justify-center transition-all duration-300`}
        >
          {/* Main Video Element */}
          <video
            ref={videoRef}
            src={(isProxyModeActive ? currentVideoClip?.proxySrc : null) || currentVideoClip?.src || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'}
            className="w-full h-full object-cover transition-transform duration-75"
            muted={isMuted}
            playsInline
            loop
            style={{
              transform: `scale(${panCrop.zoom * transitionZoomExtra}) translate(${panCrop.panX + transitionPanXExtra}%, ${panCrop.panY}%) rotate(${panCrop.rotation}deg)`,
              filter: `${splitCompare ? 'none' : getLumetriFilterString(lumetri)} ${transitionBlurPx > 0 ? `blur(${transitionBlurPx.toFixed(1)}px)` : ''} ${motionBlurPixels > 0.3 ? `blur(${motionBlurPixels.toFixed(1)}px)` : ''} ${transitionGlitchActive ? 'drop-shadow(-4px 0 #00ffff) drop-shadow(4px 0 #ff0055)' : ''}`,
            }}
          />

          {/* AI Motion Blur Program Monitor HUD Indicator */}
          {isMotionBlurActive && motionBlurSettings && (
            <div className="absolute bottom-2 left-2 z-25 pointer-events-none flex items-center gap-1.5 bg-black/85 backdrop-blur border border-sky-500/60 text-sky-200 px-2.5 py-1 rounded-md text-[9px] font-mono shadow-xl">
              <Wind className="w-3 h-3 text-sky-400 animate-spin" style={{ animationDuration: '4s' }} />
              <span>AI MOTION BLUR: {motionBlurSettings.shutterAngle}° SHUTTER &bull; {motionBlurSettings.blurMode.toUpperCase()} ({motionBlurPixels.toFixed(1)}px)</span>
            </div>
          )}

          {/* AI Transition: Cross Dissolve Incoming Clip Overlay */}
          {activeTransition?.type === 'cross_dissolve' && transitionClipB && (
            <div 
              className="absolute inset-0 pointer-events-none transition-opacity duration-75"
              style={{ opacity: transitionProgress }}
            >
              <img
                src={transitionClipB.thumbnail || transitionClipB.src || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format&fit=crop&q=80'}
                alt=""
                className="w-full h-full object-cover"
                style={{
                  filter: getLumetriFilterString(transitionClipB.lumetri),
                }}
              />
            </div>
          )}

          {/* AI Transition: Radiant Light Leak / Film Burn Anamorphic Flare Overlay */}
          {transitionFlareIntensity > 0.05 && (
            <div
              className="absolute inset-0 pointer-events-none mix-blend-screen transition-opacity z-20"
              style={{
                opacity: transitionFlareIntensity * 1.25,
                background:
                  activeTransition?.type === 'film_burn'
                    ? 'radial-gradient(ellipse at 70% 30%, rgba(255, 120, 20, 0.95) 0%, rgba(255, 200, 50, 0.7) 35%, rgba(200, 30, 10, 0.3) 70%, transparent 100%)'
                    : 'radial-gradient(ellipse at 30% 40%, rgba(255, 235, 160, 0.98) 0%, rgba(255, 165, 45, 0.8) 40%, rgba(255, 110, 25, 0.4) 75%, transparent 100%)',
              }}
            >
              {/* Anamorphic Lens Flare Horizontal Streak */}
              <div
                className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 bg-amber-200/90 blur-[2px]"
                style={{ opacity: transitionFlareIntensity }}
              />
            </div>
          )}

          {/* AI Transition: Digital Glitch Scanline Overlay */}
          {transitionGlitchActive && (
            <div className="absolute inset-0 pointer-events-none mix-blend-screen bg-[repeating-linear-gradient(0deg,#00ffff_0px,#ff0077_2px,transparent_4px,transparent_8px)] opacity-40 z-20" />
          )}

          {/* Active Transition Program Monitor HUD Indicator */}
          {activeTransition && (
            <div className="absolute top-2 right-2 z-25 pointer-events-none flex items-center gap-1.5 bg-black/85 backdrop-blur border border-amber-500/60 text-amber-300 px-2.5 py-1 rounded-md text-[10px] font-mono shadow-xl animate-pulse">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>TRANSICIÓN: {activeTransition.title.toUpperCase()} ({(transitionProgress * 100).toFixed(0)}%)</span>
            </div>
          )}

          {/* Floating Proxy Status HUD */}
          {isProxyModeActive && (
            <div className="absolute top-2 left-2 z-20 pointer-events-none flex items-center gap-1.5 bg-black/80 backdrop-blur border border-amber-500/50 text-amber-300 px-2 py-0.5 rounded text-[9px] font-mono shadow-md">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>PROXY 720p • 60.00 FPS • SIN LAG</span>
            </div>
          )}

          {/* Split Compare Graded overlay if active */}
          {splitCompare && (
            <div 
              className="absolute inset-0 w-1/2 overflow-hidden border-r-2 border-amber-400 z-10"
              style={{
                pointerEvents: 'none',
              }}
            >
              <video
                src={currentVideoClip?.src || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'}
                className="w-full h-full object-cover max-w-none"
                style={{
                  width: containerRef.current?.clientWidth || '100%',
                  transform: `scale(${panCrop.zoom}) translate(${panCrop.panX}%, ${panCrop.panY}%) rotate(${panCrop.rotation}deg)`,
                  filter: getLumetriFilterString(lumetri),
                }}
              />
              <span className="absolute top-2 left-2 bg-black/70 text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                GRADED
              </span>
            </div>
          )}

          {splitCompare && (
            <span className="absolute top-2 right-2 bg-black/70 text-slate-300 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold z-10">
              ORIGINAL RAW
            </span>
          )}

          {/* CapCut Subtitles & Viral Animated Captions Overlay */}
          {activeCaptionClip && activeCaptionClip.captionText && (
            <div className="absolute bottom-12 inset-x-4 flex justify-center pointer-events-none z-20">
              <div 
                className={`px-4 py-2 font-black text-center uppercase tracking-wide transition-all transform animate-bounce duration-300 ${
                  activeCaptionClip.captionStyle === 'hormozi'
                    ? 'text-yellow-300 text-2xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)] [-webkit-text-stroke:1.5px_black]'
                    : activeCaptionClip.captionStyle === 'mrbeast'
                    ? 'text-emerald-400 bg-black/90 px-3 py-1 rounded-xl text-xl border-2 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)]'
                    : activeCaptionClip.captionStyle === 'cyberpunk'
                    ? 'text-cyan-300 text-2xl font-mono tracking-widest drop-shadow-[0_0_10px_#06b6d4]'
                    : 'text-white text-xl bg-black/60 px-3 py-1 rounded backdrop-blur-sm'
                }`}
              >
                {activeCaptionClip.captionText}
              </div>
            </div>
          )}

          {/* Vegas Pro Crossfade Overlay Indicator */}
          {currentVideoClip?.crossfadeStart && (
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1 bg-violet-900/80 text-violet-200 border border-violet-700/60 text-[10px] px-2 py-0.5 rounded backdrop-blur-sm">
              <span>Vegas X-Fade</span>
              <span className="font-mono">{currentVideoClip.crossfadeStart}s</span>
            </div>
          )}

          {/* Rule of Thirds Grid Overlay */}
          {showRuleOfThirds && (
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none z-10">
              <div className="border-r border-b border-cyan-400/25" />
              <div className="border-r border-b border-cyan-400/25" />
              <div className="border-b border-cyan-400/25" />
              <div className="border-r border-b border-cyan-400/25" />
              <div className="border-r border-b border-cyan-400/25" />
              <div className="border-b border-cyan-400/25" />
              <div className="border-r border-cyan-400/25" />
              <div className="border-r border-cyan-400/25" />
              <div />
            </div>
          )}

          {/* Action & Title Safe Margins */}
          {showSafeMargins && (
            <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
              {/* Action Safe (90%) */}
              <div className="w-[90%] h-[90%] border border-dashed border-emerald-400/40 relative">
                <span className="absolute top-1 left-1 text-[9px] text-emerald-400/60 font-mono">ACTION SAFE (90%)</span>
                {/* Title Safe (80%) */}
                <div className="absolute inset-[5%] border border-dashed border-amber-400/40">
                  <span className="absolute top-1 left-1 text-[9px] text-amber-400/60 font-mono">TITLE SAFE (80%)</span>
                </div>
              </div>
            </div>
          )}

          {/* TikTok / Reels 9:16 Mock Overlay */}
          {showSocialOverlay && aspectRatio === '9:16' && (
            <div className="absolute inset-0 pointer-events-none z-15 flex flex-col justify-between p-3 bg-gradient-to-b from-black/20 via-transparent to-black/60">
              <div className="flex justify-between items-center text-white/80 text-xs">
                <span className="font-semibold">Following | For You</span>
                <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded">9:16 Preview</span>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-left text-white max-w-[70%]">
                  <p className="font-bold text-xs">@omnicut.studio</p>
                  <p className="text-[11px] text-slate-200 line-clamp-2">Neural cloud video editing pipeline powered by Gemini AI #editing #nle</p>
                  <p className="text-[10px] text-slate-300 mt-1 flex items-center gap-1">♫ Original Audio - 128 BPM Synth</p>
                </div>
                <div className="flex flex-col items-center gap-3 text-white/90">
                  <div className="w-8 h-8 rounded-full bg-slate-700/80 border border-white flex items-center justify-center text-xs">❤️</div>
                  <div className="w-8 h-8 rounded-full bg-slate-700/80 border border-white flex items-center justify-center text-xs">💬</div>
                  <div className="w-8 h-8 rounded-full bg-slate-700/80 border border-white flex items-center justify-center text-xs">↗️</div>
                  <div className="w-7 h-7 rounded-full bg-slate-900 border border-white animate-spin">💿</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dual Stereo VU Peak Meters on Right Side */}
        <div className="hidden lg:flex flex-col items-center absolute right-3 top-4 bottom-4 w-7 bg-[#0b101c] border border-slate-800 rounded p-1">
          <span className="text-[9px] text-slate-500 font-mono mb-1">VU</span>
          <div className="flex-1 flex gap-1 w-full justify-center">
            {/* Left Channel */}
            <div className="w-2 bg-slate-900 rounded-sm relative flex flex-col-reverse overflow-hidden border border-slate-800">
              <div 
                className={`w-full transition-all duration-75 ${
                  vuLeft > -3 ? 'bg-rose-500' : vuLeft > -10 ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
                style={{ height: `${Math.min(100, Math.max(4, ((vuLeft + 48) / 48) * 100))}%` }}
              />
            </div>
            {/* Right Channel */}
            <div className="w-2 bg-slate-900 rounded-sm relative flex flex-col-reverse overflow-hidden border border-slate-800">
              <div 
                className={`w-full transition-all duration-75 ${
                  vuRight > -3 ? 'bg-rose-500' : vuRight > -10 ? 'bg-amber-400' : 'bg-emerald-500'
                }`}
                style={{ height: `${Math.min(100, Math.max(4, ((vuRight + 48) / 48) * 100))}%` }}
              />
            </div>
          </div>
          <div className="flex flex-col text-[8px] font-mono text-slate-500 mt-1">
            <span>0</span>
            <span>-12</span>
            <span>-24</span>
          </div>
          {clips.some((c) => c.audioCleanup?.isEnabled && !c.audioCleanup?.isBypassed) && (
            <div
              className="mt-1 flex items-center justify-center"
              title="DSP Audio Cleanup Activo: Filtro de muesca 60Hz y sustracción espectral en tiempo real"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Transport Controls & Timecode Deck */}
      <div className="h-12 px-4 bg-[#0d1320] border-t border-[#1b2434] flex items-center justify-between">
        {/* Left SMPTE Timecode display */}
        <div className="flex items-center gap-3">
          <div className="bg-black/80 border border-slate-700/80 px-2.5 py-1 rounded text-sky-400 font-mono text-sm tracking-wider font-semibold shadow-inner">
            {secondsToTimecode(currentTime)}
          </div>
          <span className="text-slate-500 font-mono text-xs hidden sm:inline">
            / {secondsToTimecode(duration)}
          </span>
        </div>

        {/* Center Playback Deck (J-K-L, Step, Play) */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => stepFrame(-1)}
            title="Step Back 1 Frame (Left Arrow)"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 transition"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={() => setPlaybackRate((r) => (r > 1 ? 1 : 2))}
            title="Shuttle Reverse / Slow (J)"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 transition hidden sm:inline-flex"
          >
            <Rewind className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            title="Play / Stop (Space or K)"
            className="w-8 h-8 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20 transition active:scale-95"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
          </button>

          <button
            onClick={() => setPlaybackRate((r) => (r === 1 ? 1.5 : r === 1.5 ? 2 : 1))}
            title="Shuttle Forward Fast (L)"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 transition hidden sm:inline-flex"
          >
            <FastForward className="w-4 h-4" />
          </button>

          <button
            onClick={() => stepFrame(1)}
            title="Step Forward 1 Frame (Right Arrow)"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 transition"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {playbackRate !== 1 && (
            <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
              {playbackRate}x
            </span>
          )}
        </div>

        {/* Right Audio & Fullscreen Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 transition"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              if (containerRef.current) {
                if (!document.fullscreenElement) {
                  containerRef.current.requestFullscreen?.();
                } else {
                  document.exitFullscreen?.();
                }
              }
            }}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-300 transition"
            title="Fullscreen Cinema Mode"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
