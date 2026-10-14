import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Sparkles,
  Music,
  Activity,
  Zap,
  Sliders,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  Layers,
  Volume2,
  Scissors,
  ArrowRight,
  RotateCcw,
  Info,
  Maximize2,
  Check,
  Disc,
  FastForward,
  Radio,
  Flame,
  Magnet
} from 'lucide-react';
import {
  TimelineClip,
  TimelineMarker,
  BeatAlignmentSettings,
  BeatAlignmentResult,
  DetectedBeatTransient,
} from '../types/editor';
import { useBeatAlignment, DEFAULT_BEAT_ALIGNMENT_SETTINGS } from '../hooks/useBeatAlignment';
import { secondsToTimecode } from '../utils/timecode';

interface AiBeatAlignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clips: TimelineClip[];
  selectedClipId: string | null;
  onAddMarkers: (markers: TimelineMarker[], clearExisting?: boolean) => void;
  onSnapVideoCutsToBeats?: (beatTimes: number[]) => void;
  onSeekTime?: (time: number) => void;
}

export const AiBeatAlignmentModal: React.FC<AiBeatAlignmentModalProps> = ({
  isOpen,
  onClose,
  clips,
  selectedClipId,
  onAddMarkers,
  onSnapVideoCutsToBeats,
  onSeekTime,
}) => {
  // Filter for audio clips
  const audioClips = useMemo(() => clips.filter((c) => c.type === 'audio'), [clips]);

  const [activeClipId, setActiveClipId] = useState<string>(
    selectedClipId && audioClips.some((c) => c.id === selectedClipId)
      ? selectedClipId
      : audioClips[0]?.id || ''
  );

  const [settings, setSettings] = useState<BeatAlignmentSettings>(DEFAULT_BEAT_ALIGNMENT_SETTINGS);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [metronomeClick, setMetronomeClick] = useState(true);
  const [appliedNotification, setAppliedNotification] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playTimerRef = useRef<number | null>(null);

  const {
    isAnalyzing,
    progress,
    stepMessage,
    lastResult,
    error,
    analyzeBeats,
    recalcFilteredTransients,
    reset,
  } = useBeatAlignment();

  // Sync active clip on modal open
  useEffect(() => {
    if (isOpen) {
      if (selectedClipId && audioClips.some((c) => c.id === selectedClipId)) {
        setActiveClipId(selectedClipId);
      } else if (audioClips.length > 0 && (!activeClipId || !audioClips.some((c) => c.id === activeClipId))) {
        setActiveClipId(audioClips[0].id);
      }
      setAppliedNotification(null);
      setPreviewTime(0);
      setIsPlayingPreview(false);
    }
  }, [isOpen, selectedClipId, audioClips]);

  const currentClip = useMemo(
    () => audioClips.find((c) => c.id === activeClipId) || audioClips[0],
    [audioClips, activeClipId]
  );

  // Trigger initial analysis when opening modal or switching clip if no result exists yet
  useEffect(() => {
    if (isOpen && currentClip && (!lastResult || lastResult.clipId !== currentClip.id)) {
      analyzeBeats(currentClip, settings);
    }
  }, [isOpen, currentClip?.id]);

  // Audio synthesis metronome click
  const playClick = useCallback((freq = 1000) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // AudioContext unavailable or blocked
    }
  }, []);

  // Preview timer loop
  useEffect(() => {
    if (!isPlayingPreview || !currentClip) return;

    const interval = 40; // ms
    playTimerRef.current = window.setInterval(() => {
      setPreviewTime((prev) => {
        const next = prev + interval / 1000;
        if (next >= currentClip.duration) {
          setIsPlayingPreview(false);
          return 0;
        }

        // Metronome click check
        if (metronomeClick && lastResult) {
          const hitTransient = lastResult.transients.find(
            (t) => Math.abs(t.time - next) < interval / 2000
          );
          if (hitTransient) {
            playClick(hitTransient.type === 'downbeat' ? 1200 : 700);
          }
        }

        return next;
      });
    }, interval);

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlayingPreview, currentClip, lastResult, metronomeClick, playClick]);

  // Draw interactive Waveform and Peak Transients on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentClip) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background grid
    ctx.fillStyle = '#080d19';
    ctx.fillRect(0, 0, width, height);

    // Grid lines (measures / seconds)
    const duration = currentClip.duration || 15;
    const bpm = lastResult?.detectedBpm || settings.bpm || 128;
    const beatInterval = 60 / bpm;
    const beatsTotal = duration / beatInterval;

    ctx.strokeStyle = '#152033';
    ctx.lineWidth = 1;
    for (let b = 0; b <= beatsTotal; b++) {
      const x = (b * beatInterval / duration) * width;
      const isDownbeat = b % 4 === 0;
      ctx.beginPath();
      ctx.strokeStyle = isDownbeat ? '#1e3352' : '#111a2c';
      ctx.lineWidth = isDownbeat ? 1.5 : 0.8;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      if (isDownbeat && x < width - 20) {
        ctx.fillStyle = '#47658c';
        ctx.font = '9px monospace';
        ctx.fillText(`Bar ${b / 4 + 1}`, x + 4, 12);
      }
    }

    // Center horizontal centerline
    const centerY = height / 2;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Waveform rendering
    const points = lastResult?.waveformPoints || [];
    if (points.length > 0) {
      const sliceW = width / points.length;

      // Draw mirrored audio waveform
      ctx.fillStyle = '#0d9488';
      for (let i = 0; i < points.length; i++) {
        const x = i * sliceW;
        const val = points[i]; // 0 - 100
        const barH = (val / 100) * (height * 0.42);

        // Gradient based on energy
        const grad = ctx.createLinearGradient(0, centerY - barH, 0, centerY + barH);
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(0.5, '#10b981');
        grad.addColorStop(1, '#06b6d4');

        ctx.fillStyle = grad;
        ctx.fillRect(x, centerY - barH, Math.max(1, sliceW - 1), barH * 2);
      }
    }

    // Threshold Line
    const threshPercent = settings.transientThreshold / 100;
    const threshY = centerY - threshPercent * (height * 0.42);
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, threshY);
    ctx.lineTo(width, threshY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ec4899';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`Umbral Transitorio: ${settings.transientThreshold}%`, 8, threshY - 4);

    // Peak Transients Overlays
    if (lastResult?.transients) {
      lastResult.transients.forEach((t) => {
        const x = (t.time / duration) * width;
        const isDownbeat = t.type === 'downbeat' || t.type === 'drop';
        const isSnare = t.type === 'snare';
        const isDrop = t.type === 'drop';

        let color = '#a855f7'; // default kick
        if (isDrop) color = '#eab308';
        else if (isDownbeat) color = '#f43f5e';
        else if (isSnare) color = '#06b6d4';

        // Vertical transient pin
        ctx.strokeStyle = color;
        ctx.lineWidth = isDownbeat ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(x, 18);
        ctx.lineTo(x, height - 14);
        ctx.stroke();

        // Top diamond indicator
        ctx.fillStyle = color;
        ctx.beginPath();
        const size = isDownbeat ? 5 : 3.5;
        ctx.moveTo(x, 18 - size);
        ctx.lineTo(x + size, 18);
        ctx.lineTo(x, 18 + size);
        ctx.lineTo(x - size, 18);
        ctx.closePath();
        ctx.fill();

        // Transient label at top if downbeat or drop
        if (isDownbeat && x < width - 40) {
          ctx.fillStyle = color;
          ctx.font = 'bold 8px monospace';
          ctx.fillText(isDrop ? '💥 DROP' : '🎯 1.1', x - 8, 30);
        }
      });
    }

    // Playhead line
    const playheadX = (previewTime / duration) * width;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Playhead head
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(playheadX - 4, 0);
    ctx.lineTo(playheadX + 4, 0);
    ctx.lineTo(playheadX, 8);
    ctx.closePath();
    ctx.fill();
  }, [currentClip, lastResult, settings, previewTime]);

  if (!isOpen) return null;

  const handleStartAnalysis = async () => {
    if (!currentClip) return;
    setAppliedNotification(null);
    await analyzeBeats(currentClip, settings);
  };

  const handleThresholdChange = (newVal: number) => {
    const updated = { ...settings, transientThreshold: newVal };
    setSettings(updated);
    recalcFilteredTransients(updated);
  };

  const handleSensitivityChange = (sens: 'low' | 'medium' | 'high' | 'ultra') => {
    let thresh = 65;
    let minSp = 0.35;
    if (sens === 'ultra') {
      thresh = 40;
      minSp = 0.2;
    } else if (sens === 'high') {
      thresh = 55;
      minSp = 0.28;
    } else if (sens === 'medium') {
      thresh = 65;
      minSp = 0.35;
    } else {
      thresh = 78;
      minSp = 0.5;
    }

    const updated = {
      ...settings,
      sensitivity: sens,
      transientThreshold: thresh,
      minTransientSpacing: minSp,
    };
    setSettings(updated);
    recalcFilteredTransients(updated);
  };

  const handleFilterModeChange = (mode: 'all' | 'primary_beats' | 'downbeats_only') => {
    const updated = { ...settings, filterMode: mode };
    setSettings(updated);
    recalcFilteredTransients(updated);
  };

  const handleApplyMarkers = () => {
    if (!lastResult || !lastResult.markers) return;
    onAddMarkers(lastResult.markers, settings.clearExistingBeatMarkers);
    setAppliedNotification(
      `¡Se aplicaron ${lastResult.markers.length} marcadores rítmicos al timeline! Snap magnético activo.`
    );
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const handleApplySnapVideoCuts = () => {
    if (!lastResult) return;
    // Extract beat cut times
    const beatTimes = lastResult.markers.map((m) => m.time);
    onAddMarkers(lastResult.markers, settings.clearExistingBeatMarkers);
    if (onSnapVideoCutsToBeats) {
      onSnapVideoCutsToBeats(beatTimes);
    }
    setAppliedNotification(
      `¡Cortes de vídeo ajustados rítmicamente al beat! (${lastResult.markers.length} puntos de corte sincronizados)`
    );
    setTimeout(() => {
      onClose();
    }, 1600);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !currentClip) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * currentClip.duration;
    setPreviewTime(newTime);
    if (onSeekTime) {
      onSeekTime(currentClip.startTime + newTime);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none animate-fadeIn">
      <div className="bg-[#0b101b] border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#0e1626] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 p-0.5 shadow-md shadow-pink-500/20">
              <div className="w-full h-full bg-[#0b101b] rounded-[10px] flex items-center justify-center">
                <Music className="w-4 h-4 text-pink-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  AI Beat Alignment &amp; Transient Snapping
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40">
                  Gemini 3.8 Flash • Beat Detective
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Analiza la envolvente de audio, detecta picos transitorios y alinea automáticamente los cortes de vídeo al ritmo
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notification Banner */}
        {appliedNotification && (
          <div className="bg-emerald-950/80 border-b border-emerald-500/50 px-5 py-2 text-xs text-emerald-200 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{appliedNotification}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Audio Clip Selection Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#070b14] border border-slate-800/80 p-3 rounded-xl">
            <div className="flex items-center gap-2">
              <Disc className="w-4 h-4 text-pink-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span className="text-xs font-semibold text-slate-300">Pista de Audio Objetivo:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {audioClips.map((clip) => (
                <button
                  key={clip.id}
                  onClick={() => {
                    setActiveClipId(clip.id);
                    setPreviewTime(0);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2 border ${
                    activeClipId === clip.id
                      ? 'bg-pink-600/25 text-pink-300 border-pink-500/60 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span className="max-w-[200px] truncate">{clip.title}</span>
                  <span className="text-[10px] font-mono opacity-70">({clip.duration.toFixed(1)}s)</span>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Waveform & Peak Transients Canvas */}
          <div className="bg-[#050811] border border-slate-800 rounded-xl overflow-hidden shadow-inner relative">
            <div className="px-4 py-2 bg-[#090e1a] border-b border-slate-800/90 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-pink-400" />
                <span className="font-bold text-slate-200">Envolvente Espectral de Audio y Picos de Transitorios</span>
                {lastResult && (
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-500/40 px-2 py-0.2 rounded font-bold">
                    {lastResult.totalTransientsDetected} Transitorios ({lastResult.detectedBpm} BPM)
                  </span>
                )}
              </div>

              {/* Waveform Controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMetronomeClick(!metronomeClick)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border transition flex items-center gap-1 cursor-pointer ${
                    metronomeClick
                      ? 'bg-amber-950/70 text-amber-300 border-amber-500/50'
                      : 'bg-slate-900 text-slate-500 border-slate-800'
                  }`}
                  title="Metrónomo acústico al reproducir preview"
                >
                  <Radio className="w-3 h-3 text-amber-400" />
                  <span>Metrónomo: {metronomeClick ? 'ON' : 'OFF'}</span>
                </button>

                <div className="flex items-center gap-1 font-mono text-[11px] text-slate-300">
                  <Clock className="w-3 h-3 text-sky-400" />
                  <span>{secondsToTimecode(previewTime)}</span>
                  <span className="opacity-60">/ {secondsToTimecode(currentClip?.duration || 15)}</span>
                </div>
              </div>
            </div>

            {/* Canvas Visualizer */}
            <div className="relative p-2">
              <canvas
                ref={canvasRef}
                width={860}
                height={160}
                onClick={handleCanvasClick}
                className="w-full h-40 bg-[#080d19] rounded-lg cursor-crosshair block"
              />

              {/* Progress overlay when analyzing */}
              {isAnalyzing && (
                <div className="absolute inset-2 bg-black/85 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-3 text-center p-4">
                  <div className="flex items-center gap-2 text-pink-400">
                    <Sparkles className="w-5 h-5 animate-spin" />
                    <span className="text-sm font-bold text-white">Analizando Ritmo con Gemini 3.8 Flash...</span>
                  </div>
                  <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 via-rose-400 to-amber-400 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-300">{stepMessage}</span>
                </div>
              )}
            </div>

            {/* Playback Scrub Toolbar */}
            <div className="px-4 py-2.5 bg-[#090e1a] border-t border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsPlayingPreview(!isPlayingPreview)}
                  className="px-3 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-pink-600/30"
                >
                  {isPlayingPreview ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isPlayingPreview ? 'Pausar' : 'Reproducir'}</span>
                </button>

                <button
                  onClick={() => setPreviewTime(0)}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  title="Reiniciar reproducción al inicio"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Scrubber Range */}
                <input
                  type="range"
                  min="0"
                  max={currentClip?.duration || 15}
                  step="0.05"
                  value={previewTime}
                  onChange={(e) => setPreviewTime(parseFloat(e.target.value))}
                  className="w-36 sm:w-56 accent-pink-500 h-1 bg-slate-700 rounded cursor-pointer ml-2"
                />
              </div>

              {/* Transient Legend Badges */}
              <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>Downbeat (1.1)</span>
                </span>
                <span className="flex items-center gap-1 text-cyan-400">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>Snare / Caja</span>
                </span>
                <span className="flex items-center gap-1 text-purple-400">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span>Kick / Bombo</span>
                </span>
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Drop 💥</span>
                </span>
              </div>
            </div>
          </div>

          {/* Rhythm Metrics & Musical Phrasing Card */}
          {lastResult && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-[#070b14] border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-400">Tempo / BPM</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-pink-400 font-mono">{lastResult.detectedBpm}</span>
                  <span className="text-xs text-slate-400 font-mono">BPM</span>
                </div>
                <span className="text-[10px] text-slate-500 block truncate">{lastResult.timeSignature} Compás</span>
              </div>

              <div className="p-3 bg-[#070b14] border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-400">Tonalidad &amp; Estilo</span>
                <div className="text-sm font-bold text-amber-300 truncate">{lastResult.musicalKey}</div>
                <span className="text-[10px] text-slate-400 block truncate">{lastResult.rhythmStyle}</span>
              </div>

              <div className="p-3 bg-[#070b14] border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-400">Transitorios Totales</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-cyan-400 font-mono">{lastResult.totalTransientsDetected}</span>
                  <span className="text-[10px] text-slate-400">picos</span>
                </div>
                <span className="text-[10px] text-slate-500 block">{lastResult.downbeatsCount} compases (downbeats)</span>
              </div>

              <div className="p-3 bg-[#070b14] border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-400">Confianza Algorítmica</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-emerald-400 font-mono">{lastResult.averageConfidence}%</span>
                  <span className="text-[10px] text-emerald-500">Gemini</span>
                </div>
                <span className="text-[10px] text-slate-500 block">Precisión sub-frame</span>
              </div>
            </div>
          )}

          {/* AI Musical Analysis Summary */}
          {lastResult?.musicalAnalysisSummary && (
            <div className="p-3 bg-pink-950/20 border border-pink-500/30 rounded-xl text-xs text-pink-200/90 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{lastResult.musicalAnalysisSummary}</p>
            </div>
          )}

          {/* Interactive Tuning & Snapping Settings Controls */}
          <div className="bg-[#070b14] border border-slate-800 p-4 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Configuración de Detección de Transitorios y Marcadores
                </h3>
              </div>
              <button
                onClick={handleStartAnalysis}
                disabled={isAnalyzing}
                className="text-[11px] font-semibold text-pink-400 hover:text-pink-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Re-analizar con IA</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sensitivity Preset */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Sensibilidad de Transitorios:</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['low', 'medium', 'high', 'ultra'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSensitivityChange(s)}
                      className={`py-1.5 rounded-lg text-xs font-bold capitalize transition border cursor-pointer ${
                        settings.sensitivity === s
                          ? 'bg-pink-600/30 text-pink-300 border-pink-500/70 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {s === 'ultra' ? 'Ultra' : s === 'high' ? 'Alta' : s === 'medium' ? 'Media' : 'Baja'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">
                  {settings.sensitivity === 'ultra'
                    ? 'Captura todos los charles, redobles y síncopas sutiles.'
                    : settings.sensitivity === 'high'
                    ? 'Captura bombos, cajas y percusiones secundarias.'
                    : settings.sensitivity === 'medium'
                    ? 'Estándar balanceado para montaje al ritmo de música moderna.'
                    : 'Solo transitorios masivos de inicio de compás y drops.'}
                </p>
              </div>

              {/* Threshold Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300">Umbral de Energía (Threshold):</span>
                  <span className="font-mono text-pink-400 font-bold">{settings.transientThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="90"
                  value={settings.transientThreshold}
                  onChange={(e) => handleThresholdChange(parseInt(e.target.value, 10))}
                  className="w-full accent-pink-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 block">
                  Ajusta la línea horizontal punteada en la gráfica interactiva superior.
                </span>
              </div>

              {/* Filter Mode */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Tipo de Marcadores a Generar:</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'primary_beats', label: '1/4 Beats' },
                    { id: 'downbeats_only', label: 'Compases' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleFilterModeChange(m.id as any)}
                      className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
                        settings.filterMode === m.id
                          ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500/70 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">
                  {settings.filterMode === 'downbeats_only'
                    ? 'Ideal para cortes cinematográficos lentos en el compás 1.1.'
                    : settings.filterMode === 'primary_beats'
                    ? 'Ideal para videoclips musicales y reels de corte rápido.'
                    : 'Incluye síncopas y rellenos percusivos.'}
                </p>
              </div>
            </div>

            {/* Checkbox Options */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={settings.clearExistingBeatMarkers}
                  onChange={(e) =>
                    setSettings({ ...settings, clearExistingBeatMarkers: e.target.checked })
                  }
                  className="rounded accent-pink-500"
                />
                <span>Reemplazar marcadores rítmicos existentes en el timeline</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={settings.accentuateDownbeats}
                  onChange={(e) =>
                    setSettings({ ...settings, accentuateDownbeats: e.target.checked })
                  }
                  className="rounded accent-pink-500"
                />
                <span>Resaltar visualmente los inicios de compás (Downbeat 1.1) con color Carmesí</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-[#0e1626] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Magnet className="w-4 h-4 text-sky-400" />
            <span>El snapping magnético en el timeline se adherirá automáticamente a estos beats al arrastrar cortes</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>

            {/* Apply Markers Only */}
            <button
              onClick={handleApplyMarkers}
              disabled={!lastResult || lastResult.markers.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-pink-300 border border-pink-500/40 hover:border-pink-500/80 transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Music className="w-3.5 h-3.5 text-pink-400" />
              <span>Agregar {lastResult?.markers.length || 0} Marcadores al Timeline</span>
            </button>

            {/* Smart Snap Video Cuts to Beats Now */}
            <button
              onClick={handleApplySnapVideoCuts}
              disabled={!lastResult || lastResult.markers.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-pink-600 via-rose-600 to-amber-600 hover:from-pink-500 hover:via-rose-500 hover:to-amber-500 text-white transition cursor-pointer flex items-center gap-2 shadow-lg shadow-pink-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Ajusta automáticamente los cortes de vídeo al ritmo del beat y coloca marcadores"
            >
              <Scissors className="w-3.5 h-3.5 text-white" />
              <span>Alinear y Cortar Vídeos al Ritmo ⚡</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
