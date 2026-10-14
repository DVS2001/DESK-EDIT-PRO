import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Sparkles, Send, CheckCircle2, Wand2, Scissors, 
  Palette, Smartphone, Activity, Music, Sliders, Play, 
  RotateCcw, Film, Cpu, Eye, ArrowRight, AlertCircle, Layers
} from 'lucide-react';
import { 
  TimelineClip, TimelineTrack, TimelineMarker, 
  MotionCurveResult, MotionKeyframe 
} from '../types/editor';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  markers: TimelineMarker[];
  selectedClipId: string | null;
  onApplyAiResult: (result: any) => void;
  onApplyKeyframeAssist: (clipId: string, result: MotionCurveResult, applyToAll?: boolean) => void;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  clips,
  tracks,
  markers,
  selectedClipId,
  onApplyAiResult,
  onApplyKeyframeAssist,
}) => {
  const [modalTab, setModalTab] = useState<'director' | 'keyframe_assist'>('keyframe_assist');

  // General Director prompt state
  const [directorPrompt, setDirectorPrompt] = useState('');
  const [isDirectorLoading, setIsDirectorLoading] = useState(false);
  const [directorResult, setDirectorResult] = useState<any>(null);
  const [directorError, setDirectorError] = useState<string | null>(null);

  // Keyframe Assist state
  const [motionMood, setMotionMood] = useState('cinematic zoom');
  const [isKeyframeLoading, setIsKeyframeLoading] = useState(false);
  const [keyframeResult, setKeyframeResult] = useState<MotionCurveResult | null>(null);
  const [keyframeError, setKeyframeError] = useState<string | null>(null);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [isPreviewAnimating, setIsPreviewAnimating] = useState(true);

  const selectedClip = clips.find((c) => c.id === selectedClipId) || clips.find((c) => c.type === 'video') || clips[0];

  // Animation loop for mini preview simulator
  useEffect(() => {
    if (!isOpen || !isPreviewAnimating) return;

    let animId: number;
    let start = performance.now();

    const loop = (now: number) => {
      const elapsed = (now - start) / 1000;
      const duration = keyframeResult?.keyframes?.slice(-1)[0]?.timeOffset || 3.0;
      const progress = (elapsed % duration) / duration;
      setPreviewProgress(progress);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, isPreviewAnimating, keyframeResult]);

  // Initial keyframe assist trigger if empty
  useEffect(() => {
    if (isOpen && !keyframeResult && !isKeyframeLoading) {
      handleGenerateKeyframeCurve('cinematic zoom');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Quick Mood Presets for Keyframe Assist
  const moodPresets = [
    {
      id: 'cinematic_zoom',
      label: 'Cinematic Zoom',
      desc: 'Slow Push & Horizon Drift',
      query: 'cinematic zoom in with gentle drift',
      icon: '🎬',
    },
    {
      id: 'snappy_whip_pan',
      label: 'Snappy Whip Pan',
      desc: 'Kinetic Snap & Blur Recoil',
      query: 'snappy whip pan to the right with elastic snap',
      icon: '⚡',
    },
    {
      id: 'vertigo_dolly',
      label: 'Vertigo Dolly Zoom',
      desc: 'Hitchcock Perspective Warp',
      query: 'vertigo hitchcock dolly zoom with suspense tension',
      icon: '🌀',
    },
    {
      id: 'bass_impact_shake',
      label: 'Bass Drop Shake',
      desc: 'Seismic Impact & Rumble',
      query: 'high-impact earthquake bass drop shake with recoil',
      icon: '💥',
    },
    {
      id: 'punchy_punchline',
      label: 'Punchline Pop',
      desc: 'Viral Hormozi Center Crash',
      query: 'punchy fast kinetic punch zoom on punchline',
      icon: '🚀',
    },
    {
      id: 'organic_handheld',
      label: 'Handheld Float',
      desc: 'Organic Camera Breathing',
      query: 'organic handheld camera micro-float and breathing',
      icon: '🌊',
    },
  ];

  // Quick Prompts for Director Tab
  const quickDirectorPrompts = [
    {
      title: 'Auto-Cut Silencios',
      desc: 'Eliminar pausas >0.5s y acelerar ritmo',
      icon: Scissors,
      text: 'Detecta y elimina todos los silencios mayores a 0.5 segundos en la pista de diálogo, realizando cortes de salto limpios.',
    },
    {
      title: 'Color Cyberpunk Neón',
      desc: 'LUT Teal & Orange de alto contraste',
      icon: Palette,
      text: 'Aplica un grado de color Lumetri estilo Cyberpunk con sombras cian profundas, altas luces magenta y saturación vibrante.',
    },
    {
      title: 'Subtítulos Alex Hormozi',
      desc: 'Tipografía amarilla con zoom cinemático',
      icon: Wand2,
      text: 'Genera subtítulos estilo viral Alex Hormozi en amarillo con animación de impacto para captar máxima retención.',
    },
    {
      title: 'Auto-Reframe a 9:16 TikTok',
      desc: 'Reencuadre vertical con paneo inteligente',
      icon: Smartphone,
      text: 'Reencuadra el proyecto a formato vertical 9:16 para TikTok y Reels aplicando un zoom de 1.35x centrado en el sujeto.',
    },
  ];

  // Handle General Director Prompt
  const handleDirectorSubmit = async (promptText: string) => {
    if (!promptText.trim()) return;
    setIsDirectorLoading(true);
    setDirectorError(null);

    try {
      const response = await fetch('/api/gemini/prompt-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          currentClips: clips,
          currentTracks: tracks,
          currentMarkers: markers,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process AI command');
      }

      setDirectorResult(data.result);
      onApplyAiResult(data.result);
    } catch (err: any) {
      console.error(err);
      setDirectorError(err.message || 'Error executing AI command');
    } finally {
      setIsDirectorLoading(false);
    }
  };

  // Handle Keyframe Assist Generation
  const handleGenerateKeyframeCurve = async (mood: string) => {
    if (!mood.trim()) return;
    setIsKeyframeLoading(true);
    setKeyframeError(null);
    setMotionMood(mood);

    try {
      const response = await fetch('/api/gemini/keyframe-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moodDescription: mood,
          clipDuration: selectedClip?.duration || 6.0,
          currentSettings: selectedClip?.panCrop,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to calculate motion curve');
      }

      setKeyframeResult(data.result);
    } catch (err: any) {
      console.error(err);
      setKeyframeError(err.message || 'Keyframe calculation error');
    } finally {
      setIsKeyframeLoading(false);
    }
  };

  // Compute interpolated preview transform for the mini preview canvas
  const getSimulatedTransform = () => {
    if (!keyframeResult || !keyframeResult.keyframes || keyframeResult.keyframes.length === 0) {
      return { zoom: 1, panX: 0, panY: 0, rotation: 0 };
    }

    const kfs = keyframeResult.keyframes;
    const totalDuration = kfs[kfs.length - 1].timeOffset || 3.0;
    const currentTimeOffset = previewProgress * totalDuration;

    let kfA = kfs[0];
    let kfB = kfs[kfs.length - 1];

    for (let i = 0; i < kfs.length - 1; i++) {
      if (currentTimeOffset >= kfs[i].timeOffset && currentTimeOffset <= kfs[i + 1].timeOffset) {
        kfA = kfs[i];
        kfB = kfs[i + 1];
        break;
      }
    }

    const span = Math.max(0.001, kfB.timeOffset - kfA.timeOffset);
    const t = Math.max(0, Math.min(1, (currentTimeOffset - kfA.timeOffset) / span));

    const easing = kfB.easing || 'ease_in_out';
    let easeT = t;
    if (easing === 'ease_in') easeT = t * t;
    else if (easing === 'ease_out') easeT = t * (2 - t);
    else if (easing === 'ease_in_out' || easing === 'bezier_s_curve') easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    else if (easing === 'elastic_whip') {
      const s = 1.70158 * 1.5;
      const t2 = t * 2;
      if (t2 < 1) easeT = 0.5 * (t2 * t2 * ((s + 1) * t2 - s));
      else {
        const tPost = t2 - 2;
        easeT = 0.5 * (tPost * tPost * ((s + 1) * tPost + s) + 2);
      }
    } else if (easing === 'exponential_slam') {
      easeT = t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
    }

    return {
      zoom: kfA.zoom + (kfB.zoom - kfA.zoom) * easeT,
      panX: kfA.panX + (kfB.panX - kfA.panX) * easeT,
      panY: kfA.panY + (kfB.panY - kfA.panY) * easeT,
      rotation: kfA.rotation + (kfB.rotation - kfA.rotation) * easeT,
    };
  };

  const simTransform = getSimulatedTransform();

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none">
      <div className="w-full max-w-3xl bg-[#0c1220] border border-[#23314a] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 bg-[#080d16] border-b border-[#1b263b] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 via-indigo-600 to-sky-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white tracking-wide">
                  OmniCut AI Suite
                </h3>
                <span className="text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800 px-1.5 py-0.2 rounded font-bold">
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Coreografía de movimiento cinemático y edición automatizada.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Modal Mode Tabs */}
            <div className="flex items-center bg-[#060910] p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setModalTab('keyframe_assist')}
                className={`px-3 py-1 rounded-md font-semibold transition flex items-center gap-1.5 ${
                  modalTab === 'keyframe_assist'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Keyframe Assist</span>
                <span className="bg-yellow-400 text-black text-[9px] font-bold px-1 rounded">NEW</span>
              </button>

              <button
                onClick={() => setModalTab('director')}
                className={`px-3 py-1 rounded-md font-semibold transition flex items-center gap-1.5 ${
                  modalTab === 'director'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Director Co-Pilot</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: KEYFRAME ASSIST (The requested feature) */}
          {modalTab === 'keyframe_assist' && (
            <div className="space-y-4">
              {/* Feature Intro */}
              <div className="p-3.5 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-sky-950/40 border border-purple-800/40 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    <span>Generador de Curvas de Movimiento y Easing por Estado de Ánimo</span>
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Describe el estilo cinematográfico (ej: &quot;cinematic zoom&quot;, &quot;snappy whip pan&quot;, &quot;vertigo dolly&quot;) y Gemini diseñará la curva Bézier con keyframes de escala, paneo y rotación física.
                  </p>
                </div>
                {selectedClip && (
                  <div className="bg-black/50 border border-purple-900/50 px-2.5 py-1 rounded-lg text-right flex-shrink-0">
                    <span className="text-[10px] text-slate-400 block font-mono">CLIP DESTINO</span>
                    <span className="text-xs font-bold text-sky-300 truncate max-w-[120px] block">
                      {selectedClip.title}
                    </span>
                  </div>
                )}
              </div>

              {/* Mood Input Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={motionMood}
                  onChange={(e) => setMotionMood(e.target.value)}
                  placeholder="Describe el movimiento de cámara: 'cinematic zoom', 'snappy whip pan', 'hitchcock dolly zoom'..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGenerateKeyframeCurve(motionMood);
                  }}
                  className="w-full bg-[#070b13] border border-slate-700/80 rounded-xl px-4 py-3 pr-32 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 shadow-inner"
                />

                <button
                  onClick={() => handleGenerateKeyframeCurve(motionMood)}
                  disabled={isKeyframeLoading || !motionMood.trim()}
                  className="absolute right-2 top-2 bottom-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow"
                >
                  {isKeyframeLoading ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>Calculando...</span>
                    </>
                  ) : (
                    <>
                      <Activity className="w-3.5 h-3.5" />
                      <span>Generar Curva</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Mood Pills */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Presets de Estado de Ánimo &amp; Movimiento
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {moodPresets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleGenerateKeyframeCurve(preset.query)}
                      disabled={isKeyframeLoading}
                      className="p-2.5 rounded-lg bg-[#0a0f1c] hover:bg-[#12192e] border border-slate-800 hover:border-purple-800/70 text-left transition flex items-start gap-2 group cursor-pointer"
                    >
                      <span className="text-base group-hover:scale-110 transition">{preset.icon}</span>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-200 text-xs block group-hover:text-purple-300 transition truncate">
                          {preset.label}
                        </span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {preset.desc}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Display */}
              {keyframeError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{keyframeError}</span>
                </div>
              )}

              {/* Generated Motion Curve Results Display */}
              {keyframeResult && (
                <div className="space-y-4 pt-1">
                  {/* Title & Easing Header */}
                  <div className="p-3.5 bg-[#090e18] border border-purple-900/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-white text-sm">
                          {keyframeResult.motionTitle}
                        </h4>
                        <span className="text-[9px] font-mono bg-purple-950 text-purple-300 border border-purple-800 px-1.5 py-0.2 rounded font-bold uppercase">
                          {keyframeResult.easingPreset}
                        </span>
                      </div>
                      <p className="text-[11px] text-purple-300/90 mt-0.5 font-mono">
                        CSS Curva: <strong className="text-white">{keyframeResult.bezierCurveCss}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {keyframeResult.tags?.map((t, idx) => (
                        <span key={idx} className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Dual Panel: Left SVG Bézier Curve Graph + Right Live Motion Simulator */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Panel 1: Interactive SVG Bézier Curve Graph */}
                    <div className="p-3 bg-[#080c14] border border-slate-800 rounded-xl flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5 text-purple-400" />
                          <span>Curva de Aceleración Bézier</span>
                        </span>
                        <span className="text-[9px] font-mono text-emerald-400">
                          t = {(previewProgress * (keyframeResult.keyframes.slice(-1)[0]?.timeOffset || 3)).toFixed(2)}s
                        </span>
                      </div>

                      {/* SVG Canvas for Bézier Curve */}
                      <div className="h-28 bg-[#05080e] rounded-lg border border-slate-800/80 relative overflow-hidden flex items-center justify-center p-2">
                        <svg viewBox="0 0 240 100" className="w-full h-full overflow-visible">
                          {/* Grid background */}
                          <line x1="0" y1="20" x2="240" y2="20" stroke="#1e293b" strokeDasharray="3 3" />
                          <line x1="0" y1="50" x2="240" y2="50" stroke="#1e293b" strokeDasharray="3 3" />
                          <line x1="0" y1="80" x2="240" y2="80" stroke="#1e293b" strokeDasharray="3 3" />
                          <line x1="60" y1="0" x2="60" y2="100" stroke="#1e293b" strokeDasharray="3 3" />
                          <line x1="120" y1="0" x2="120" y2="100" stroke="#1e293b" strokeDasharray="3 3" />
                          <line x1="180" y1="0" x2="180" y2="100" stroke="#1e293b" strokeDasharray="3 3" />

                          {/* Base Curve Path (Dynamic representation of Bézier easing) */}
                          <path
                            d={
                              keyframeResult.easingPreset === 'elastic_whip'
                                ? 'M 10 85 C 40 95, 70 -5, 120 70 C 160 110, 190 20, 230 20'
                                : keyframeResult.easingPreset === 'exponential_slam'
                                ? 'M 10 85 C 70 85, 140 85, 170 30 C 190 15, 210 20, 230 20'
                                : keyframeResult.easingPreset === 'ease_out'
                                ? 'M 10 85 C 30 20, 120 20, 230 20'
                                : 'M 10 85 C 70 85, 170 20, 230 20' // Classic S-Curve
                            }
                            fill="none"
                            stroke="#c084fc"
                            strokeWidth="3.5"
                            strokeLinecap="round"
                          />

                          {/* Keyframe Nodes on Curve */}
                          {keyframeResult.keyframes.map((kf, i) => {
                            const x = 10 + (i / Math.max(1, keyframeResult.keyframes.length - 1)) * 220;
                            const y = 85 - ((kf.zoom - 1) / 1.5) * 65;

                            return (
                              <g key={kf.id}>
                                <circle cx={x} cy={Math.max(15, Math.min(85, y))} r="4" fill="#38bdf8" stroke="#000" strokeWidth="1.5" />
                                <text x={x} y={Math.max(12, y - 7)} fill="#94a3b8" fontSize="8" textAnchor="middle" fontFamily="monospace">
                                  {kf.timeOffset}s
                                </text>
                              </g>
                            );
                          })}

                          {/* Live Animated Tracker Dot running along the time axis */}
                          <circle
                            cx={10 + previewProgress * 220}
                            cy={
                              85 - (previewProgress < 0.5 ? 2 * previewProgress * previewProgress : -1 + (4 - 2 * previewProgress) * previewProgress) * 65
                            }
                            r="5"
                            fill="#facc15"
                            stroke="#000"
                            strokeWidth="2"
                          />
                        </svg>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono">
                        <span>Aceleración Inicial (Ease In)</span>
                        <span>Desaceleración (Ease Out)</span>
                      </div>
                    </div>

                    {/* Panel 2: Live Motion Previewer Mini-Canvas */}
                    <div className="p-3 bg-[#080c14] border border-slate-800 rounded-xl flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-sky-400" />
                          <span>Simulador en Tiempo Real</span>
                        </span>
                        <div className="flex items-center gap-2 font-mono text-[9px] text-slate-400">
                          <span>Zoom: <strong className="text-white">{simTransform.zoom.toFixed(2)}x</strong></span>
                          <span>Rot: <strong className="text-white">{simTransform.rotation.toFixed(1)}°</strong></span>
                        </div>
                      </div>

                      {/* Mini Video Container with real-time transform animation */}
                      <div className="h-28 bg-black rounded-lg border border-slate-700 overflow-hidden relative flex items-center justify-center">
                        <img
                          src={selectedClip?.thumbnail || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=80'}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-75"
                          style={{
                            transform: `scale(${simTransform.zoom}) translate(${simTransform.panX}%, ${simTransform.panY}%) rotate(${simTransform.rotation}deg)`,
                          }}
                        />

                        {/* Grid Reticle */}
                        <div className="absolute inset-0 pointer-events-none grid grid-cols-2 grid-rows-2">
                          <div className="border-r border-b border-white/20" />
                          <div className="border-b border-white/20" />
                          <div className="border-r border-white/20" />
                          <div />
                        </div>

                        {/* Center Target Dot */}
                        <div className="absolute w-2 h-2 rounded-full bg-sky-400/80 -ml-1 -mt-1 pointer-events-none" />

                        <span className="absolute bottom-1 left-1 bg-black/80 text-[8px] font-mono px-1 rounded text-slate-300">
                          PREVIEW LOOP
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[10px] text-slate-400">
                          Física cinematográfica no lineal
                        </span>
                        <button
                          onClick={() => setIsPreviewAnimating(!isPreviewAnimating)}
                          className="text-[10px] text-purple-400 hover:text-purple-300 font-medium"
                        >
                          {isPreviewAnimating ? 'Pausar Simulación' : 'Reanudar'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Keyframes Breakdown Table */}
                  <div className="p-3 bg-[#080c14] border border-slate-800 rounded-xl space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Secuencia de Fotogramas Clave (Keyframe Timeline Nodes)
                    </span>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500 text-[10px]">
                            <th className="pb-1.5">TIEMPO</th>
                            <th className="pb-1.5">ZOOM SCALE</th>
                            <th className="pb-1.5">PAN X / Y</th>
                            <th className="pb-1.5">ROTACIÓN</th>
                            <th className="pb-1.5">CURVA EASING</th>
                            <th className="pb-1.5">ACCIÓN CINEMÁTICA</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {keyframeResult.keyframes.map((kf, i) => (
                            <tr key={kf.id} className="text-slate-300 hover:bg-slate-900/50">
                              <td className="py-1 text-sky-400 font-bold">{kf.timeOffset.toFixed(2)}s</td>
                              <td className="py-1 text-white font-bold">{kf.zoom.toFixed(2)}x</td>
                              <td className="py-1">{kf.panX}% / {kf.panY}%</td>
                              <td className="py-1">{kf.rotation}°</td>
                              <td className="py-1 text-purple-300 uppercase text-[10px]">{kf.easing}</td>
                              <td className="py-1 text-slate-400 text-[11px] font-sans truncate max-w-[200px]">
                                {kf.description || 'Interpolar'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Cinematographic Rationale */}
                  <div className="p-3 bg-purple-950/20 border border-purple-900/40 rounded-xl text-xs text-purple-200 space-y-1">
                    <strong className="block text-purple-300 font-semibold">Explicación Cinematográfica del Motor de IA:</strong>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      {keyframeResult.explanation}
                    </p>
                  </div>

                  {/* Action Apply Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        if (selectedClip && keyframeResult) {
                          onApplyKeyframeAssist(selectedClip.id, keyframeResult, true);
                          onClose();
                        }
                      }}
                      className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95 cursor-pointer"
                    >
                      Aplicar a Todos los Clips de la Pista
                    </button>

                    <button
                      onClick={() => {
                        if (selectedClip && keyframeResult) {
                          onApplyKeyframeAssist(selectedClip.id, keyframeResult, false);
                          onClose();
                        }
                      }}
                      className="w-full sm:w-auto px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Aplicar Curva a Clip Seleccionado</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GENERAL DIRECTOR CO-PILOT */}
          {modalTab === 'director' && (
            <div className="space-y-4">
              {/* Natural Language Prompt Input Bar */}
              <div className="relative">
                <textarea
                  rows={3}
                  value={directorPrompt}
                  onChange={(e) => setDirectorPrompt(e.target.value)}
                  placeholder="Ej: 'Corta todos los silencios mayores a 0.5s, añade subtítulos estilo Hormozi y aplica el LUT Cyberpunk'..."
                  className="w-full bg-[#070b13] border border-slate-700/80 rounded-xl p-3 pr-24 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 shadow-inner resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleDirectorSubmit(directorPrompt);
                    }
                  }}
                />

                <button
                  onClick={() => handleDirectorSubmit(directorPrompt)}
                  disabled={isDirectorLoading || !directorPrompt.trim()}
                  className="absolute bottom-3 right-3 bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 disabled:opacity-50 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition active:scale-95 cursor-pointer"
                >
                  {isDirectorLoading ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Ejecutar</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Preset Action Cards */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Flujos Automatizados de 1-Clic
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {quickDirectorPrompts.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        disabled={isDirectorLoading}
                        onClick={() => {
                          setDirectorPrompt(item.text);
                          handleDirectorSubmit(item.text);
                        }}
                        className="p-3 bg-[#0a0f1c] hover:bg-[#11192e] border border-slate-800/80 hover:border-slate-700 rounded-lg text-left transition flex items-start gap-2.5 group cursor-pointer"
                      >
                        <div className="p-2 rounded bg-slate-800/80 group-hover:bg-purple-900/40 text-purple-400 border border-slate-700/60 flex-shrink-0 transition">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-slate-200 group-hover:text-white transition">
                            {item.title}
                          </h4>
                          <p className="text-[11px] text-slate-400 line-clamp-1">{item.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Error Message Display */}
              {directorError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                  <span>{directorError}</span>
                </div>
              )}

              {/* Result Confirmation Card */}
              {directorResult && (
                <div className="p-4 bg-emerald-950/30 border border-emerald-800/60 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Instrucción Aplicada Exitosamente al Timeline</span>
                  </div>
                  <p className="text-slate-200 text-xs font-medium">{directorResult.summary}</p>
                  <p className="text-slate-400 text-[11px] bg-black/40 p-2.5 rounded-lg border border-emerald-900/40">
                    {directorResult.explanation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[#080d16] border-t border-[#1b263b] flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono text-[11px]">
            {modalTab === 'keyframe_assist'
              ? 'Keyframe Assist: Curvas Bézier físicas generadas por red neural Gemini.'
              : 'Soporta macros de Premiere, CapCut y Vegas Pro.'}
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
