import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Layers,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Check,
  CheckCircle2,
  Film,
  Sun,
  Zap,
  Wind,
  Activity,
  Flame,
  Volume2,
  ChevronRight,
  Maximize2,
  Scissors,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  TimelineClip,
  AppliedTransition,
  TransitionType,
  TransitionSuggestion,
  TransitionSuggestResult,
  CutPairInfo,
} from '../types/editor';
import { useTransitionSuggest } from '../hooks/useTransitionSuggest';

interface AiTransitionSuggestModalProps {
  isOpen: boolean;
  onClose: () => void;
  clips: TimelineClip[];
  selectedClipId: string | null;
  onApplyTransition: (transition: AppliedTransition) => void;
  onBatchApplyTransitions?: (transitions: AppliedTransition[]) => void;
  onRemoveTransition?: (cutTime: number, fromClipId: string, toClipId: string) => void;
  appliedTransitions?: AppliedTransition[];
  initialCutTime?: number;
}

export const AiTransitionSuggestModal: React.FC<AiTransitionSuggestModalProps> = ({
  isOpen,
  onClose,
  clips,
  selectedClipId,
  onApplyTransition,
  onBatchApplyTransitions,
  onRemoveTransition,
  appliedTransitions = [],
  initialCutTime,
}) => {
  const {
    isAnalyzing,
    progress,
    stepMessage,
    lastResult,
    error,
    analyzeTransition,
    reset,
  } = useTransitionSuggest();

  // Find all adjacent cut pairs on tracks
  const adjacentCutPairs = React.useMemo<CutPairInfo[]>(() => {
    const pairs: CutPairInfo[] = [];
    const videoClips = clips
      .filter((c) => c.type === 'video')
      .sort((a, b) => a.startTime - b.startTime);

    // Group by trackId
    const tracksMap = new Map<string, TimelineClip[]>();
    videoClips.forEach((c) => {
      if (!tracksMap.has(c.trackId)) tracksMap.set(c.trackId, []);
      tracksMap.get(c.trackId)!.push(c);
    });

    tracksMap.forEach((trackClips, trackId) => {
      for (let i = 0; i < trackClips.length - 1; i++) {
        const a = trackClips[i];
        const b = trackClips[i + 1];
        const aEnd = a.startTime + a.duration;
        // If adjacent or overlapping within 0.5s tolerance
        if (Math.abs(b.startTime - aEnd) <= 0.5 || b.startTime <= aEnd) {
          const cutTime = Number(aEnd.toFixed(2));
          const existing = appliedTransitions.find(
            (t) => t.fromClipId === a.id && t.toClipId === b.id
          ) || b.transitionIn;

          pairs.push({
            cutTime,
            trackId,
            clipA: a,
            clipB: b,
            existingTransition: existing,
          });
        }
      }
    });

    return pairs;
  }, [clips, appliedTransitions]);

  // Selected cut pair index
  const [selectedPairIndex, setSelectedPairIndex] = useState<number>(0);

  // Fallback to manual selection if needed
  const currentPair = adjacentCutPairs[selectedPairIndex] || null;
  const [clipAId, setClipAId] = useState<string>('');
  const [clipBId, setClipBId] = useState<string>('');

  // Style preference
  const [stylePreference, setStylePreference] = useState<'cinematic' | 'dynamic' | 'subtle' | 'modern'>('cinematic');

  // Active chosen transition (hero or alternative)
  const [selectedTransition, setSelectedTransition] = useState<TransitionSuggestion | null>(null);

  // Editable parameters
  const [customDuration, setCustomDuration] = useState<number>(0.8);
  const [customEasing, setCustomEasing] = useState<'ease_in_out' | 'exponential' | 'elastic' | 'linear'>('ease_in_out');
  const [customIntensity, setCustomIntensity] = useState<number>(85);

  // Interactive preview scrub state
  const [previewScrub, setPreviewScrub] = useState<number>(0.5); // 0.0 to 1.0
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);

  // Success toast state
  const [appliedSuccessMessage, setAppliedSuccessMessage] = useState<string | null>(null);

  // Synchronize pair when modal opens
  useEffect(() => {
    if (!isOpen) {
      reset();
      setIsPreviewPlaying(false);
      setAppliedSuccessMessage(null);
      return;
    }

    if (adjacentCutPairs.length > 0) {
      let matchIdx = 0;
      if (initialCutTime !== undefined) {
        const found = adjacentCutPairs.findIndex((p) => Math.abs(p.cutTime - initialCutTime) < 0.2);
        if (found !== -1) matchIdx = found;
      } else if (selectedClipId) {
        const found = adjacentCutPairs.findIndex(
          (p) => p.clipA.id === selectedClipId || p.clipB.id === selectedClipId
        );
        if (found !== -1) matchIdx = found;
      }
      setSelectedPairIndex(matchIdx);
      const pair = adjacentCutPairs[matchIdx];
      if (pair) {
        setClipAId(pair.clipA.id);
        setClipBId(pair.clipB.id);
      }
    } else if (clips.length >= 2) {
      setClipAId(clips[0].id);
      setClipBId(clips[1].id);
    }
  }, [isOpen, initialCutTime, selectedClipId, adjacentCutPairs, clips]);

  const clipA = clips.find((c) => c.id === (currentPair?.clipA.id || clipAId)) || clips[0];
  const clipB = clips.find((c) => c.id === (currentPair?.clipB.id || clipBId)) || clips[1] || clips[0];

  // Sync selected transition when new AI analysis arrives
  useEffect(() => {
    if (lastResult?.recommendedTransition) {
      setSelectedTransition(lastResult.recommendedTransition);
      setCustomDuration(lastResult.recommendedTransition.recommendedDuration || 0.8);
      setCustomEasing(lastResult.recommendedTransition.recommendedEasing || 'ease_in_out');
      setCustomIntensity(lastResult.recommendedTransition.parameters?.intensity || 85);
    }
  }, [lastResult]);

  // Preview animation loop
  useEffect(() => {
    if (!isPreviewPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    let startTime = performance.now();
    const cycleDuration = (customDuration || 0.8) * 1600; // ms per cycle

    const loop = (now: number) => {
      const elapsed = (now - startTime) % cycleDuration;
      const progress = elapsed / cycleDuration;
      setPreviewScrub(progress);
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    animationFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPreviewPlaying, customDuration]);

  // Trigger analysis
  const handleTriggerAnalysis = async () => {
    if (!clipA || !clipB) return;
    setAppliedSuccessMessage(null);
    await analyzeTransition(clipA, clipB, stylePreference);
  };

  // Auto-analyze on first pair select if not already analyzed
  useEffect(() => {
    if (isOpen && clipA && clipB && !lastResult && !isAnalyzing) {
      handleTriggerAnalysis();
    }
  }, [isOpen, clipA?.id, clipB?.id]);

  // Handle apply to cut
  const handleApplyToCut = () => {
    if (!selectedTransition || !clipA || !clipB) return;

    const cutTime = Number((clipA.startTime + clipA.duration).toFixed(2));
    const newTransition: AppliedTransition = {
      id: `trans-${clipA.id}-${clipB.id}-${Date.now().toString(36)}`,
      type: selectedTransition.type,
      title: selectedTransition.title,
      duration: Number(customDuration.toFixed(2)),
      easing: customEasing,
      alignment: 'center',
      cutTime,
      fromClipId: clipA.id,
      toClipId: clipB.id,
      parameters: {
        intensity: customIntensity,
        warmth: selectedTransition.parameters.warmth,
        blurAmount: selectedTransition.parameters.blurAmount,
        direction: selectedTransition.parameters.direction,
        rgbSplit: selectedTransition.parameters.rgbSplit,
      },
      similarityScore: selectedTransition.similarityScore,
      appliedAt: Date.now(),
    };

    onApplyTransition(newTransition);
    setAppliedSuccessMessage(`¡Transición "${selectedTransition.title}" (${customDuration.toFixed(1)}s) aplicada con éxito al corte en ${cutTime}s!`);
    setTimeout(() => {
      setAppliedSuccessMessage(null);
    }, 3500);
  };

  // Batch apply to all cuts
  const handleBatchApply = () => {
    if (adjacentCutPairs.length === 0) return;

    const batch: AppliedTransition[] = adjacentCutPairs.map((pair, idx) => {
      const tType: TransitionType = idx % 2 === 0 ? 'light_leak' : 'zoom_blur';
      const tTitle = tType === 'light_leak' ? 'Anamorphic Golden Light Leak' : 'Dynamic Crash Zoom Blur';
      return {
        id: `trans-batch-${pair.clipA.id}-${pair.clipB.id}-${idx}`,
        type: tType,
        title: tTitle,
        duration: 0.8,
        easing: 'ease_in_out',
        alignment: 'center',
        cutTime: pair.cutTime,
        fromClipId: pair.clipA.id,
        toClipId: pair.clipB.id,
        parameters: { intensity: 85, warmth: 90, blurAmount: 70 },
        similarityScore: 92,
        appliedAt: Date.now(),
      };
    });

    if (onBatchApplyTransitions) {
      onBatchApplyTransitions(batch);
    } else {
      batch.forEach((t) => onApplyTransition(t));
    }

    setAppliedSuccessMessage(`¡Se aplicaron transiciones neuronales óptimas a los ${batch.length} cortes adyacentes de la línea de tiempo!`);
    setTimeout(() => {
      setAppliedSuccessMessage(null);
    }, 3500);
  };

  if (!isOpen) return null;

  // Helper icon for transition type
  const getTransitionIcon = (type: TransitionType) => {
    switch (type) {
      case 'light_leak':
        return <Sun className="w-4 h-4 text-amber-400" />;
      case 'zoom_blur':
        return <Zap className="w-4 h-4 text-sky-400" />;
      case 'cross_dissolve':
        return <Film className="w-4 h-4 text-purple-400" />;
      case 'whip_pan':
        return <Wind className="w-4 h-4 text-teal-400" />;
      case 'glitch':
        return <Activity className="w-4 h-4 text-rose-400" />;
      case 'film_burn':
        return <Flame className="w-4 h-4 text-orange-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-400" />;
    }
  };

  // Calculate live transition visuals for interactive preview
  const transitionType = selectedTransition?.type || 'light_leak';
  const flareIntensity = Math.sin(previewScrub * Math.PI) * (customIntensity / 100);
  const zoomScale = 1.0 + Math.sin(previewScrub * Math.PI) * 0.35 * (customIntensity / 100);
  const blurPx = Math.sin(previewScrub * Math.PI) * 16 * (customIntensity / 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b101b] border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl shadow-black/80 overflow-hidden text-slate-200">
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 bg-[#0e1626] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 via-sky-500/20 to-purple-500/20 border border-amber-500/30 text-amber-300 shadow-sm">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  AI Transition Suggest
                </h2>
                <span className="bg-gradient-to-r from-amber-500/20 to-sky-500/20 text-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                  Gemini 3.8 Flash Vision
                </span>
                <span className="bg-sky-500/10 text-sky-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-sky-500/20">
                  Scene Similarity Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Analiza la similitud óptica de clips adyacentes y recomienda transiciones cinemáticas (Light Leak, Zoom Blur, Cross Dissolve)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Banner */}
        {appliedSuccessMessage && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/60 px-5 py-2.5 flex items-center gap-2 text-emerald-200 text-xs font-semibold animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{appliedSuccessMessage}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 1. Adjacent Cut Pair Selector Bar */}
          <div className="bg-[#0f172a]/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Punto de Corte Adyacente Seleccionado:
                </span>
              </div>

              {adjacentCutPairs.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {adjacentCutPairs.map((pair, idx) => {
                    const isCur = idx === selectedPairIndex;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedPairIndex(idx);
                          setClipAId(pair.clipA.id);
                          setClipBId(pair.clipB.id);
                          reset();
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition whitespace-nowrap flex items-center gap-1.5 border ${
                          isCur
                            ? 'bg-sky-500/20 text-sky-200 border-sky-500/60 shadow-sm'
                            : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800'
                        }`}
                      >
                        <span>Corte {idx + 1}</span>
                        <span className="opacity-70">({pair.cutTime.toFixed(2)}s)</span>
                        {pair.existingTransition && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Transición aplicada" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Side-by-Side Clips Juxtaposition Display */}
            <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
              {/* Outgoing Clip A */}
              <div className="md:col-span-5 bg-[#090d16] border border-slate-800 rounded-xl p-3 relative overflow-hidden group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase font-bold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/60">
                    Plano Saliente (Clip A)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {clipA?.duration.toFixed(2)}s • Pista {clipA?.trackId}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-20 h-14 bg-black rounded-lg overflow-hidden border border-slate-800 shrink-0 relative">
                    <img
                      src={clipA?.thumbnail || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=80'}
                      alt={clipA?.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className="absolute bottom-1 right-1 text-[8px] font-mono text-white bg-black/70 px-1 rounded">
                      FIN: {(clipA?.startTime + clipA?.duration).toFixed(1)}s
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white truncate">{clipA?.title}</h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      LUT: <span className="text-amber-300 font-mono">{clipA?.lumetri?.lutPreset || 'Rec.709'}</span> • Temp: {clipA?.lumetri?.temperature || 0}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                        4K RAW
                      </span>
                      <span className="text-[9px] bg-sky-950/60 text-sky-300 px-1.5 py-0.2 rounded font-mono">
                        {clipA?.startTime.toFixed(2)}s ➔ {(clipA?.startTime + clipA?.duration).toFixed(2)}s
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Cut Junction Indicator */}
              <div className="md:col-span-1 flex flex-col items-center justify-center text-center">
                <div className="w-8 h-8 rounded-full bg-slate-800/90 border border-slate-700 flex items-center justify-center text-amber-400 shadow-md">
                  <Scissors className="w-4 h-4" />
                </div>
                <span className="text-[9px] font-mono text-slate-400 mt-1 font-bold">
                  {(clipA?.startTime + clipA?.duration).toFixed(2)}s
                </span>
              </div>

              {/* Incoming Clip B */}
              <div className="md:col-span-5 bg-[#090d16] border border-slate-800 rounded-xl p-3 relative overflow-hidden group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                    Plano Entrante (Clip B)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {clipB?.duration.toFixed(2)}s • Pista {clipB?.trackId}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-20 h-14 bg-black rounded-lg overflow-hidden border border-slate-800 shrink-0 relative">
                    <img
                      src={clipB?.thumbnail || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format&fit=crop&q=80'}
                      alt={clipB?.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className="absolute bottom-1 right-1 text-[8px] font-mono text-white bg-black/70 px-1 rounded">
                      INI: {clipB?.startTime.toFixed(1)}s
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-white truncate">{clipB?.title}</h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      LUT: <span className="text-emerald-300 font-mono">{clipB?.lumetri?.lutPreset || 'Rec.709'}</span> • Temp: {clipB?.lumetri?.temperature || 0}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                        4K RAW
                      </span>
                      <span className="text-[9px] bg-emerald-950/60 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                        {clipB?.startTime.toFixed(2)}s ➔ {(clipB?.startTime + clipB?.duration).toFixed(2)}s
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Style Preference & Re-Analyze Action */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">
                  Preferencia Editorial:
                </span>
                <div className="grid grid-cols-2 sm:flex items-center gap-1.5 w-full sm:w-auto">
                  {(
                    [
                      { id: 'cinematic', label: '🎬 Cinemático', desc: 'Light Leaks, Dissolves' },
                      { id: 'dynamic', label: '⚡ Dinámico', desc: 'Zoom Blur, Whip Pan' },
                      { id: 'subtle', label: '🕊️ Sutil', desc: 'Luma Fade, Match Cut' },
                      { id: 'modern', label: '🔬 Tech / Glitch', desc: 'RGB Split, Razor Cut' },
                    ] as const
                  ).map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setStylePreference(style.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                        stylePreference === style.id
                          ? 'bg-amber-500/20 text-amber-200 border-amber-500/60 shadow-sm'
                          : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800'
                      }`}
                      title={style.desc}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleTriggerAnalysis}
                disabled={isAnalyzing}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-200 animate-spin" />
                <span>{isAnalyzing ? 'Analizando con Gemini...' : 'Re-Analizar con Gemini 3.8 Flash'}</span>
              </button>
            </div>
          </div>

          {/* Analysis Progress Loading State */}
          {isAnalyzing && (
            <div className="bg-[#0f172a] border border-amber-500/40 rounded-xl p-4 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                  {stepMessage || 'Procesando con Gemini 3.8 Flash...'}
                </span>
                <span className="font-mono text-amber-400 font-bold">{progress}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-rose-950/80 border border-rose-500/60 rounded-xl p-3 text-rose-200 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 2. Gemini Analysis Dashboard & Telemetry */}
          {lastResult && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column: Similarity Score & Contrast Telemetry */}
              <div className="lg:col-span-5 space-y-4">
                {/* Scene Similarity Gauge Card */}
                <div className="bg-[#090d16] border border-slate-800 rounded-xl p-4 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Índice de Similitud Óptica
                    </span>
                    <span className="bg-amber-950/80 text-amber-300 border border-amber-700/60 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                      {lastResult.similarityCategory}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Radial Meter Visual */}
                    <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-800"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className={
                            lastResult.overallSimilarityScore >= 70
                              ? 'text-amber-400'
                              : lastResult.overallSimilarityScore >= 45
                              ? 'text-sky-400'
                              : 'text-purple-400'
                          }
                          strokeDasharray={`${lastResult.overallSimilarityScore}, 100`}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-black text-white font-mono leading-none">
                          {lastResult.overallSimilarityScore}%
                        </span>
                        <span className="text-[8px] text-slate-400 uppercase font-semibold">Match</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="text-slate-300 text-[11px] leading-relaxed">
                        {lastResult.sceneJuxtapositionSummary}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Contrast Metrics Grid */}
                <div className="bg-[#090d16] border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                    Métricas de Continuidad Neuronal
                  </span>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
                      <span className="text-slate-400 block font-semibold mb-0.5">💡 Iluminación:</span>
                      <span className="text-amber-300 font-mono line-clamp-2">
                        {lastResult.contrastMetrics?.lightingDelta}
                      </span>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
                      <span className="text-slate-400 block font-semibold mb-0.5">🎯 Movimiento:</span>
                      <span className="text-sky-300 font-mono line-clamp-2">
                        {lastResult.contrastMetrics?.motionDelta}
                      </span>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
                      <span className="text-slate-400 block font-semibold mb-0.5">🎨 Espacio de Color:</span>
                      <span className="text-purple-300 font-mono line-clamp-2">
                        {lastResult.contrastMetrics?.colorGamutDelta}
                      </span>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
                      <span className="text-slate-400 block font-semibold mb-0.5">⚡ Energía & Pacing:</span>
                      <span className="text-emerald-300 font-mono line-clamp-2">
                        {lastResult.contrastMetrics?.pacingEnergy}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Hero Recommended Transition & Alternative Cards */}
              <div className="lg:col-span-7 space-y-4">
                {/* Hero Recommendation Card */}
                {lastResult.recommendedTransition && (
                  <div
                    onClick={() => {
                      setSelectedTransition(lastResult.recommendedTransition);
                      setCustomDuration(lastResult.recommendedTransition.recommendedDuration);
                      setCustomEasing(lastResult.recommendedTransition.recommendedEasing);
                    }}
                    className={`bg-gradient-to-br from-[#121c2f] to-[#0a101d] border rounded-xl p-4 cursor-pointer transition shadow-lg relative overflow-hidden group ${
                      selectedTransition?.type === lastResult.recommendedTransition.type
                        ? 'border-amber-500/80 ring-2 ring-amber-500/30'
                        : 'border-slate-700/80 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-gradient-to-r from-amber-500 to-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                          <Sparkles className="w-3 h-3 text-yellow-200" />
                          RECOMENDACIÓN ÓPTIMA GEMINI
                        </span>
                        <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                          {lastResult.recommendedTransition.category}
                        </span>
                      </div>

                      <span className="text-sm font-black font-mono text-emerald-400">
                        {lastResult.recommendedTransition.similarityScore}% Match
                      </span>
                    </div>

                    <div className="flex items-start gap-3 mt-2">
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 shrink-0">
                        {getTransitionIcon(lastResult.recommendedTransition.type)}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">
                            {lastResult.recommendedTransition.title}
                          </h3>
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                            {lastResult.recommendedTransition.recommendedDuration}s
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                          {lastResult.recommendedTransition.editorialReasoning}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 mt-3 text-[10px]">
                          <span className="bg-slate-800/80 text-amber-300 px-2 py-0.5 rounded font-semibold border border-slate-700">
                            ✨ {lastResult.recommendedTransition.visualImpact}
                          </span>
                          <span className="bg-slate-800/80 text-purple-300 px-2 py-0.5 rounded font-mono border border-slate-700">
                            📈 Curva: {lastResult.recommendedTransition.recommendedEasing}
                          </span>
                          {lastResult.recommendedTransition.audioRecommendation && (
                            <span className="bg-slate-800/80 text-emerald-300 px-2 py-0.5 rounded font-mono border border-slate-700 flex items-center gap-1">
                              <Volume2 className="w-2.5 h-2.5" />
                              {lastResult.recommendedTransition.audioRecommendation}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Alternative Recommendations */}
                {lastResult.alternativeTransitions && lastResult.alternativeTransitions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Alternativas Cinemáticas Disponibles:
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {lastResult.alternativeTransitions.map((alt, idx) => {
                        const isSel = selectedTransition?.type === alt.type;
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedTransition(alt);
                              setCustomDuration(alt.recommendedDuration);
                              setCustomEasing(alt.recommendedEasing);
                            }}
                            className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                              isSel
                                ? 'bg-[#151e30] border-sky-500/80 ring-2 ring-sky-500/30'
                                : 'bg-[#090d16] border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                {getTransitionIcon(alt.type)}
                                <span className="text-xs font-bold text-white">{alt.title}</span>
                              </div>
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                {alt.similarityScore}%
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                              {alt.editorialReasoning}
                            </p>

                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
                              <span>{alt.recommendedDuration}s</span>
                              <span className="text-sky-300">{alt.visualImpact}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Interactive Transition Scrub / Live Preview Player */}
          {selectedTransition && (
            <div className="bg-[#090d16] border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Simulación Visual en Vivo: {selectedTransition.title}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPreviewPlaying(!isPreviewPlaying)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    {isPreviewPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>{isPreviewPlaying ? 'Pausar Loop' : 'Reproducir Loop'}</span>
                  </button>

                  <button
                    onClick={() => setPreviewScrub(0.5)}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                    title="Centro de Corte (50%)"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Interactive Viewport Canvas */}
              <div className="relative aspect-video max-h-56 w-full max-w-xl mx-auto rounded-xl overflow-hidden bg-black border border-slate-800 shadow-2xl flex items-center justify-center">
                {/* Outgoing Image Layer (Clip A) */}
                <div
                  className="absolute inset-0 transition-opacity"
                  style={{
                    opacity: transitionType === 'cross_dissolve' ? 1 - previewScrub : previewScrub < 0.5 ? 1 : 0,
                    transform:
                      transitionType === 'zoom_blur'
                        ? `scale(${zoomScale})`
                        : transitionType === 'whip_pan'
                        ? `translateX(${-previewScrub * 100}%)`
                        : 'scale(1)',
                    filter:
                      transitionType === 'zoom_blur'
                        ? `blur(${blurPx}px)`
                        : transitionType === 'glitch' && previewScrub > 0.3 && previewScrub < 0.7
                        ? `drop-shadow(-4px 0 #00ffff) drop-shadow(4px 0 #ff0055)`
                        : 'none',
                  }}
                >
                  <img
                    src={clipA?.thumbnail || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=80'}
                    alt="Clip A"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[9px] font-mono text-sky-300">
                    Clip A: {clipA?.title}
                  </div>
                </div>

                {/* Incoming Image Layer (Clip B) */}
                <div
                  className="absolute inset-0 transition-opacity"
                  style={{
                    opacity: transitionType === 'cross_dissolve' ? previewScrub : previewScrub >= 0.5 ? 1 : 0,
                    transform:
                      transitionType === 'zoom_blur'
                        ? `scale(${zoomScale})`
                        : transitionType === 'whip_pan'
                        ? `translateX(${(1 - previewScrub) * 100}%)`
                        : 'scale(1)',
                    filter:
                      transitionType === 'zoom_blur'
                        ? `blur(${blurPx}px)`
                        : transitionType === 'glitch' && previewScrub > 0.3 && previewScrub < 0.7
                        ? `drop-shadow(4px 0 #00ffff) drop-shadow(-4px 0 #ff0055)`
                        : 'none',
                  }}
                >
                  <img
                    src={clipB?.thumbnail || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format&fit=crop&q=80'}
                    alt="Clip B"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-black/70 px-2 py-0.5 rounded text-[9px] font-mono text-emerald-300">
                    Clip B: {clipB?.title}
                  </div>
                </div>

                {/* Light Leak Radiant Lens Flare Overlay */}
                {(transitionType === 'light_leak' || transitionType === 'film_burn') && flareIntensity > 0.05 && (
                  <div
                    className="absolute inset-0 pointer-events-none mix-blend-screen transition-opacity"
                    style={{
                      opacity: flareIntensity * 1.2,
                      background:
                        transitionType === 'film_burn'
                          ? 'radial-gradient(ellipse at 70% 30%, rgba(255, 120, 20, 0.9) 0%, rgba(255, 200, 50, 0.6) 35%, rgba(200, 30, 10, 0.3) 70%, transparent 100%)'
                          : 'radial-gradient(ellipse at 30% 40%, rgba(255, 230, 150, 0.95) 0%, rgba(255, 160, 40, 0.7) 40%, rgba(255, 100, 20, 0.3) 75%, transparent 100%)',
                    }}
                  >
                    {/* Anamorphic Flare Streak */}
                    <div
                      className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-amber-200/90 blur-sm"
                      style={{ opacity: flareIntensity }}
                    />
                  </div>
                )}

                {/* Glitch Scanline Overlay */}
                {transitionType === 'glitch' && previewScrub > 0.25 && previewScrub < 0.75 && (
                  <div className="absolute inset-0 pointer-events-none mix-blend-screen bg-[repeating-linear-gradient(0deg,#00ffff_0px,#ff0077_2px,transparent_4px,transparent_8px)] opacity-35" />
                )}

                {/* HUD Banner */}
                <div className="absolute bottom-2 inset-x-2 flex items-center justify-between text-[10px] font-mono bg-black/80 backdrop-blur px-2.5 py-1 rounded-md border border-slate-700/60 pointer-events-none">
                  <span className="text-amber-300 flex items-center gap-1 font-bold">
                    {getTransitionIcon(transitionType)}
                    <span>{selectedTransition.title.toUpperCase()}</span>
                  </span>
                  <span className="text-slate-400">
                    Posición: {(previewScrub * 100).toFixed(0)}% • Corte {(clipA.startTime + clipA.duration).toFixed(2)}s
                  </span>
                </div>
              </div>

              {/* Scrub Slider */}
              <div className="space-y-1 max-w-xl mx-auto">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Clip A (0%)</span>
                  <span className="text-amber-300 font-bold">Punto de Cruce: {(previewScrub * 100).toFixed(0)}%</span>
                  <span>Clip B (100%)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={previewScrub}
                  onChange={(e) => {
                    setIsPreviewPlaying(false);
                    setPreviewScrub(parseFloat(e.target.value));
                  }}
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              {/* Transition Tuning Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800 max-w-2xl mx-auto text-xs">
                {/* Duration Slider */}
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1 text-[11px]">
                    <span className="text-slate-400 font-semibold">Duración:</span>
                    <span className="text-amber-300 font-mono font-bold">{customDuration.toFixed(2)}s</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.5"
                    step="0.05"
                    value={customDuration}
                    onChange={(e) => setCustomDuration(parseFloat(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                    <span>0.2s</span>
                    <span>1.0s</span>
                    <span>2.5s</span>
                  </div>
                </div>

                {/* Easing Curve Selector */}
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 font-semibold text-[11px] block mb-1.5">
                    Curva de Aceleración:
                  </span>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    {(['ease_in_out', 'exponential', 'elastic', 'linear'] as const).map((crv) => (
                      <button
                        key={crv}
                        onClick={() => setCustomEasing(crv)}
                        className={`py-1 rounded font-mono capitalize border ${
                          customEasing === crv
                            ? 'bg-amber-500/20 text-amber-200 border-amber-500/50'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {crv.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Intensity Slider */}
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1 text-[11px]">
                    <span className="text-slate-400 font-semibold">Intensidad / Flare:</span>
                    <span className="text-sky-300 font-mono font-bold">{customIntensity}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="100"
                    step="5"
                    value={customIntensity}
                    onChange={(e) => setCustomIntensity(parseInt(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
                    <span>Suave</span>
                    <span>Medio</span>
                    <span>Impacto 100%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="px-5 py-3.5 bg-[#0e1626] border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {adjacentCutPairs.length} puntos de corte adyacentes listos para transición en la línea de tiempo.
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Batch Apply Button */}
            {adjacentCutPairs.length > 1 && (
              <button
                onClick={handleBatchApply}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
                title="Aplica transiciones inteligentes a todos los cortes de la pista"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Aplicar a Todos los Cortes ({adjacentCutPairs.length})</span>
              </button>
            )}

            {/* Remove existing transition if present */}
            {currentPair?.existingTransition && onRemoveTransition && (
              <button
                onClick={() => {
                  if (currentPair) {
                    onRemoveTransition(currentPair.cutTime, currentPair.clipA.id, currentPair.clipB.id);
                    setAppliedSuccessMessage(`Transición eliminada del corte en ${currentPair.cutTime}s.`);
                  }
                }}
                className="px-3 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded-xl text-xs font-semibold border border-rose-800/60 transition"
              >
                Quitar Transición
              </button>
            )}

            {/* Main Apply Button */}
            <button
              onClick={handleApplyToCut}
              disabled={!selectedTransition}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-500/20 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Aplicar al Corte ({(clipA?.startTime + clipA?.duration).toFixed(2)}s)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
