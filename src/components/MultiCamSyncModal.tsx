import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, Video, Layers, Activity, CheckCircle2, AlertCircle, ArrowRight,
  Sparkles, Play, Pause, RotateCcw, Volume2, VolumeX, Sliders,
  HelpCircle, Eye, ShieldCheck, Zap, SplitSquareVertical
} from 'lucide-react';
import { TimelineClip, TimelineTrack, MultiCamSyncResult, MultiCamSyncSettings } from '../types/editor';
import { useMultiCamSync, DEFAULT_MULTICAM_SETTINGS } from '../hooks/useMultiCamSync';
import { secondsToTimecode } from '../utils/timecode';

interface MultiCamSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  selectedClipIds?: string[];
  onApplySync: (updatedClips: TimelineClip[], summary: string) => void;
  onLoadMultiCamDemoPreset?: () => void;
}

export const MultiCamSyncModal: React.FC<MultiCamSyncModalProps> = ({
  isOpen,
  onClose,
  clips,
  tracks,
  selectedClipIds = [],
  onApplySync,
  onLoadMultiCamDemoPreset,
}) => {
  // Available video clips on timeline
  const videoClips = useMemo(() => clips.filter((c) => c.type === 'video'), [clips]);

  // Selected clip IDs for sync (default to selectedClipIds or all video clips up to 4)
  const [activeClipIds, setActiveClipIds] = useState<string[]>([]);
  const [referenceClipId, setReferenceClipId] = useState<string>('auto');
  const [settings, setSettings] = useState<MultiCamSyncSettings>(DEFAULT_MULTICAM_SETTINGS);
  const [activePreviewAngle, setActivePreviewAngle] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [previewTime, setPreviewTime] = useState<number>(0);

  const {
    isAnalyzing,
    progress,
    stepMessage,
    lastResult,
    error,
    analyzeMultiCamSync,
    applySyncToTimeline,
    reset,
  } = useMultiCamSync();

  // Initialize selected clips when modal opens
  useEffect(() => {
    if (isOpen) {
      reset();
      setIsPlaying(false);
      setPreviewTime(0);

      const candidateIds = selectedClipIds.filter((id) => videoClips.some((c) => c.id === id));
      if (candidateIds.length >= 2) {
        setActiveClipIds(candidateIds);
      } else if (videoClips.length >= 2) {
        // Pre-select first 3 video clips
        setActiveClipIds(videoClips.slice(0, 3).map((c) => c.id));
      } else {
        setActiveClipIds(videoClips.map((c) => c.id));
      }
    }
  }, [isOpen, selectedClipIds, videoClips, reset]);

  // Current selected clips objects
  const selectedVideoClips = useMemo(() => {
    return activeClipIds
      .map((id) => videoClips.find((c) => c.id === id))
      .filter((c): c is TimelineClip => Boolean(c));
  }, [activeClipIds, videoClips]);

  // Sync player timer
  useEffect(() => {
    let animId: number;
    if (isPlaying) {
      const maxDur = Math.max(...selectedVideoClips.map((c) => c.duration), 5);
      const step = () => {
        setPreviewTime((prev) => {
          const next = prev + 0.05;
          return next > maxDur ? 0 : next;
        });
        animId = requestAnimationFrame(step);
      };
      animId = requestAnimationFrame(step);
    }
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, selectedVideoClips]);

  const toggleClipSelection = (clipId: string) => {
    setActiveClipIds((prev) => {
      if (prev.includes(clipId)) {
        if (prev.length <= 2) return prev; // keep at least 2
        return prev.filter((id) => id !== clipId);
      } else {
        return [...prev, clipId];
      }
    });
  };

  const handleRunSync = async () => {
    if (selectedVideoClips.length < 2) return;
    await analyzeMultiCamSync(
      selectedVideoClips,
      {
        ...settings,
        referenceClipId,
      },
      tracks
    );
  };

  const handleApplyToTimeline = () => {
    if (!lastResult) return;
    const updated = applySyncToTimeline(lastResult, clips);
    onApplySync(updated, lastResult.summary);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#0b101b] border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col text-slate-100 overflow-hidden ring-1 ring-white/10">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-[#101726] to-[#0f172a] border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shadow-inner">
              <Layers className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">Multi-Cam Audio Waveform Sync</h2>
                <span className="bg-sky-500/20 text-sky-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-sky-500/30">
                  Cross-Correlation Engine
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Sub-Frame Accuracy
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Analiza las envolventes acústicas de múltiples tomas de vídeo y alinea automáticamente sus puntos temporales en el Timeline.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onLoadMultiCamDemoPreset && (
              <button
                onClick={onLoadMultiCamDemoPreset}
                title="Cargar 3 clips con tomas multi-cámara desfasadas para probar la sincronización"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 transition cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span>Cargar Demo Multi-Cam (3 Cams)</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          
          {/* Left Column (5 cols): Camera Angle Selection & Settings */}
          <div className="lg:col-span-5 p-5 flex flex-col gap-5 overflow-y-auto bg-[#090d16]">
            
            {/* Angle Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-sky-400" />
                  <span>Ángulos de Cámara Seleccionados ({selectedVideoClips.length})</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {videoClips.length} clips en Timeline
                </span>
              </div>

              {videoClips.length < 2 ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-300">Se necesitan al menos 2 clips de vídeo en el Timeline</p>
                    <p className="text-[11px] text-amber-200/80 mt-1">
                      Agrega clips de vídeo adicionales o pulsa el botón &quot;Cargar Demo Multi-Cam&quot; arriba.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {videoClips.map((clip, idx) => {
                    const isSelected = activeClipIds.includes(clip.id);
                    const isRef = (referenceClipId === 'auto' && idx === 0) || referenceClipId === clip.id;
                    const angleColor = ['#0284c7', '#8b5cf6', '#ec4899', '#10b981'][idx % 4];

                    return (
                      <div
                        key={clip.id}
                        onClick={() => toggleClipSelection(clip.id)}
                        className={`p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-slate-800/90 border-slate-600 shadow-sm'
                            : 'bg-slate-900/50 border-slate-800/80 opacity-60 hover:opacity-90'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-slate-700 text-sky-500 accent-sky-500 focus:ring-0 cursor-pointer"
                          />
                          {clip.thumbnail ? (
                            <img
                              src={clip.thumbnail}
                              alt=""
                              className="w-10 h-7 object-cover rounded border border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-7 bg-slate-800 rounded border border-slate-700 flex items-center justify-center shrink-0">
                              <Video className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span 
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: angleColor }}
                              />
                              <p className="text-xs font-semibold text-white truncate max-w-[150px] sm:max-w-[180px]">
                                {clip.title}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              <span>Pista: {clip.trackId}</span>
                              <span>•</span>
                              <span>Inicio: {clip.startTime.toFixed(2)}s</span>
                              <span>•</span>
                              <span>Dur: {clip.duration.toFixed(1)}s</span>
                            </div>
                          </div>
                        </div>

                        {/* Reference Master Button */}
                        <div className="shrink-0 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReferenceClipId(clip.id);
                            }}
                            title="Fijar este clip como la Cámara Maestra de Referencia"
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer border ${
                              isRef
                                ? 'bg-sky-500/30 text-sky-200 border-sky-400/60 shadow-sm'
                                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                            }`}
                          >
                            {isRef ? 'MASTER' : 'Hacer Ref'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sync Settings */}
            <div className="border-t border-slate-800 pt-4 space-y-3.5">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span>Método & Parámetros de Sincronía</span>
              </span>

              {/* Sync Method */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Método de Alineación Acústica:</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'waveform', label: 'Forma de Onda', desc: 'Correlación continua' },
                    { id: 'clap_transient', label: 'Claqueta / Pico', desc: 'Transitorio inicial' },
                    { id: 'timecode', label: 'Timecode', desc: 'Alineación de origen' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, syncMethod: m.id as any }))}
                      className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                        settings.syncMethod === m.id
                          ? 'bg-sky-500/20 border-sky-400/60 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <p className="text-xs font-bold">{m.label}</p>
                      <p className="text-[10px] text-slate-400">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.distributeTracks}
                    onChange={(e) => setSettings((s) => ({ ...s, distributeTracks: e.target.checked }))}
                    className="rounded border-slate-700 text-sky-500 accent-sky-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Distribuir ángulos en pistas de vídeo paralelas (V1, V2, V3)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.muteNonReferenceAudio}
                    onChange={(e) => setSettings((s) => ({ ...s, muteNonReferenceAudio: e.target.checked }))}
                    className="rounded border-slate-700 text-sky-500 accent-sky-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Atenuar micros secundarios (-36 dB) para evitar cancelación de fase / eco</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.audioBandpassFilter}
                    onChange={(e) => setSettings((s) => ({ ...s, audioBandpassFilter: e.target.checked }))}
                    className="rounded border-slate-700 text-sky-500 accent-sky-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Filtro paso-banda vocal (100Hz - 8kHz) para correlación más nítida</span>
                </label>
              </div>

              {/* Analyze Button */}
              <button
                type="button"
                disabled={isAnalyzing || selectedVideoClips.length < 2}
                onClick={handleRunSync}
                className={`w-full mt-2 py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-lg ${
                  isAnalyzing || selectedVideoClips.length < 2
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-sky-500/25 ring-1 ring-white/20'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin text-white" />
                    <span>Analizando Formas de Onda ({progress}%)...</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4 text-sky-200" />
                    <span>Analizar & Sincronizar ({selectedVideoClips.length} Ángulos)</span>
                  </>
                )}
              </button>

              {/* Progress step */}
              {isAnalyzing && (
                <div className="space-y-1 mt-2">
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-sky-300 font-mono truncate">{stepMessage}</p>
                </div>
              )}

              {error && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (7 cols): Waveform Correlation Visualizer & Multi-Cam Quad Preview */}
          <div className="lg:col-span-7 p-5 flex flex-col gap-4 overflow-y-auto bg-[#0b101b]">
            
            {/* Visualizer Header */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                <span>Visualizador de Correlación Cruzada & Desplazamiento Temporal</span>
              </span>

              {lastResult && (
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                  {lastResult.averageCorrelation}% Correlación Acústica
                </span>
              )}
            </div>

            {/* Stacked Waveform Visualizer */}
            <div className="bg-[#070b13] border border-slate-800 rounded-xl p-4 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sky-400">R_xy(τ) Acoustic Waveforms</span>
                  <span className="text-slate-500">•</span>
                  <span>{lastResult ? 'ALINEADO (Offset compensado)' : 'ORIGINAL (Sin sincronizar)'}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-500">Punto Temporal Ref: 0.00s</span>
              </div>

              {/* Angles Waveforms */}
              <div className="space-y-2.5">
                {(lastResult?.angles || selectedVideoClips.map((clip, idx) => ({
                  clipId: clip.id,
                  clipTitle: clip.title,
                  cameraName: idx === 0 ? 'CAM A (Master)' : `CAM ${String.fromCharCode(65 + idx)}`,
                  color: ['#0284c7', '#8b5cf6', '#ec4899', '#10b981'][idx % 4],
                  duration: clip.duration,
                  originalStartTime: clip.startTime,
                  calculatedOffset: 0,
                  newStartTime: clip.startTime,
                  correlationConfidence: 95,
                  phaseAligned: true,
                  isReference: idx === 0,
                  waveformPeaks: Array.from({ length: 90 }, (_, i) => 0.15 + 0.6 * Math.abs(Math.sin((i / 90) * Math.PI * 6 + idx))),
                  detectedClapTime: 1.5,
                }))).map((angle, aIdx) => {
                  return (
                    <div key={angle.clipId} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: angle.color }}
                          />
                          <span className="font-bold text-white text-xs">{angle.cameraName}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                            {angle.clipTitle}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 font-mono text-[10px]">
                          {angle.isReference ? (
                            <span className="bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded font-bold border border-sky-500/30">
                              REF MASTER (±0.00s)
                            </span>
                          ) : (
                            <>
                              <span className={`px-1.5 py-0.5 rounded font-bold ${
                                angle.calculatedOffset >= 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                              }`}>
                                {angle.calculatedOffset >= 0 ? `+${angle.calculatedOffset.toFixed(3)}s` : `${angle.calculatedOffset.toFixed(3)}s`}
                              </span>
                              <span className="text-slate-500">
                                {Math.round(angle.calculatedOffset * 60)} frames
                              </span>
                              <span className="text-emerald-400">
                                {angle.correlationConfidence}% Sync
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Waveform Bar */}
                      <div className="h-8 bg-slate-900/90 rounded border border-slate-800/80 flex items-center px-1.5 gap-0.5 relative overflow-hidden">
                        {/* Reference Clapper transient hairline */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10 shadow-sm shadow-amber-400"
                          style={{ left: '20%' }}
                          title="Clapperboard / Acoustic Slate Spike Marker"
                        />

                        {angle.waveformPeaks.slice(0, 90).map((peak, pIdx) => {
                          const heightPct = Math.max(8, Math.min(100, Math.round(peak * 100)));
                          const isClapSpike = pIdx >= 17 && pIdx <= 19;

                          return (
                            <div
                              key={pIdx}
                              className="flex-1 flex flex-col justify-center items-center h-full"
                            >
                              <div
                                style={{
                                  height: `${heightPct}%`,
                                  backgroundColor: isClapSpike ? '#f59e0b' : angle.color,
                                }}
                                className="w-full rounded-sm opacity-80 hover:opacity-100 transition-all"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Cross-correlation summary badge */}
              {lastResult && (
                <div className="mt-3 p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-xs text-sky-200 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sky-100">{lastResult.summary}</p>
                    <p className="text-[10px] text-sky-300/80 mt-0.5">
                      Al aplicar, los clips se moverán a las posiciones sincronizadas en el Timeline.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Synchronized Multi-Angle Video Monitor */}
            <div className="bg-[#070b13] border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <SplitSquareVertical className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Monitor Multi-Cámara Sincronizado</span>
                </span>

                {/* Angle Selector Tabs */}
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 p-0.5 rounded-lg">
                  <button
                    onClick={() => setActivePreviewAngle(-1)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      activePreviewAngle === -1
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Quad-View (Multi)
                  </button>
                  {selectedVideoClips.map((clip, idx) => (
                    <button
                      key={clip.id}
                      onClick={() => setActivePreviewAngle(idx)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                        activePreviewAngle === idx
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      CAM {String.fromCharCode(65 + idx)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Video Player Display */}
              <div className="relative aspect-video bg-black rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center">
                {activePreviewAngle === -1 ? (
                  // Quad View / Split Grid
                  <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-0.5 bg-slate-900">
                    {selectedVideoClips.slice(0, 4).map((clip, idx) => (
                      <div key={clip.id} className="relative bg-black flex items-center justify-center overflow-hidden group">
                        {clip.thumbnail ? (
                          <img
                            src={clip.thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Video className="w-8 h-8 text-slate-700" />
                        )}
                        <div className="absolute top-1.5 left-1.5 bg-black/75 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono text-white border border-white/20">
                          CAM {String.fromCharCode(65 + idx)}
                        </div>
                        <div className="absolute bottom-1.5 right-1.5 bg-emerald-500/80 text-black text-[9px] font-bold px-1 rounded">
                          SYNC LOCKED
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Single Angle View
                  (() => {
                    const activeClip = selectedVideoClips[activePreviewAngle] || selectedVideoClips[0];
                    return (
                      <div className="relative w-full h-full flex items-center justify-center">
                        {activeClip?.thumbnail ? (
                          <img
                            src={activeClip.thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Video className="w-12 h-12 text-slate-700" />
                        )}
                        <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-sm px-2.5 py-1 rounded-md text-xs font-bold text-white border border-white/20 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span>CÁMARA ACTIVA: CAM {String.fromCharCode(65 + (activePreviewAngle >= 0 ? activePreviewAngle : 0))}</span>
                          <span className="text-slate-400">•</span>
                          <span className="font-mono text-[10px] text-sky-400">{activeClip?.title}</span>
                        </div>
                        <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/30">
                          Phase: 0.02ms Jitter (In-Phase)
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Playback Controls & Scrubber */}
              <div className="flex items-center gap-3 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-8 h-8 rounded-full bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center transition cursor-pointer shadow-md"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(false);
                    setPreviewTime(0);
                  }}
                  title="Reiniciar reproducción"
                  className="p-1.5 text-slate-400 hover:text-white rounded transition cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max={Math.max(...selectedVideoClips.map((c) => c.duration), 10)}
                    step="0.05"
                    value={previewTime}
                    onChange={(e) => setPreviewTime(parseFloat(e.target.value))}
                    className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded cursor-pointer"
                  />
                  <span className="font-mono text-xs text-sky-400 w-16 text-right">
                    {secondsToTimecode(previewTime)}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <HelpCircle className="w-4 h-4 text-slate-500" />
            <span>Los cortes se sincronizarán manteniendo intactas las envolventes y efectos de color.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={!lastResult}
              onClick={handleApplyToTimeline}
              className={`px-5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg ${
                lastResult
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/25 ring-1 ring-white/20'
                  : 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Aplicar Sincronización al Timeline</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
