import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Scissors,
  Film,
  CheckCircle2,
  Sliders,
  Clock,
  Layers,
  Play,
  RotateCcw,
  Zap,
  Info,
  ChevronRight,
  Split,
  Eye,
  Check,
  Tag,
} from 'lucide-react';
import {
  TimelineClip,
  TimelineMarker,
  DetectedScene,
  SceneSplitterSettings,
  SceneSplitterResult,
  MediaAsset,
} from '../types/editor';
import { useSceneSplitter, DEFAULT_SCENE_SPLITTER_SETTINGS } from '../hooks/useSceneSplitter';

interface AutoSceneSplitterModalProps {
  isOpen: boolean;
  onClose: () => void;
  clips: TimelineClip[];
  mediaAssets?: MediaAsset[];
  selectedClipId: string | null;
  onAddMarkers: (markers: TimelineMarker[]) => void;
  onSplitClipAtScenes?: (clipId: string, cutTimes: number[]) => void;
  onSeekTime?: (time: number) => void;
}

export const AutoSceneSplitterModal: React.FC<AutoSceneSplitterModalProps> = ({
  isOpen,
  onClose,
  clips,
  selectedClipId,
  onAddMarkers,
  onSplitClipAtScenes,
  onSeekTime,
}) => {
  // Filter for video clips
  const videoClips = clips.filter((c) => c.type === 'video');

  const [activeClipId, setActiveClipId] = useState<string>(
    selectedClipId && videoClips.some((c) => c.id === selectedClipId)
      ? selectedClipId
      : videoClips[0]?.id || ''
  );

  const [settings, setSettings] = useState<SceneSplitterSettings>(DEFAULT_SCENE_SPLITTER_SETTINGS);
  const [clearPreviousMarkers, setClearPreviousMarkers] = useState<boolean>(true);
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  const { isAnalyzing, progress, stepMessage, lastResult, error, analyzeScenes, reset } =
    useSceneSplitter();

  // Keep activeClipId in sync with modal opening
  useEffect(() => {
    if (isOpen) {
      if (selectedClipId && videoClips.some((c) => c.id === selectedClipId)) {
        setActiveClipId(selectedClipId);
      } else if (videoClips.length > 0 && !activeClipId) {
        setActiveClipId(videoClips[0].id);
      }
      setAppliedNotice(null);
    }
  }, [isOpen, selectedClipId, videoClips]);

  if (!isOpen) return null;

  const currentClip = videoClips.find((c) => c.id === activeClipId) || videoClips[0];

  const handleStartAnalysis = async () => {
    if (!currentClip) return;
    setAppliedNotice(null);
    await analyzeScenes(currentClip, settings);
  };

  const handleApplyMarkersOnly = () => {
    if (!lastResult || !lastResult.cutMarkers) return;
    onAddMarkers(lastResult.cutMarkers);
    setAppliedNotice(`¡Se agregaron ${lastResult.cutMarkers.length} marcadores de corte al timeline!`);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleApplySplitClipsOnly = () => {
    if (!lastResult || !currentClip || !onSplitClipAtScenes) return;
    const cutTimes = lastResult.scenes.slice(1).map((s) => s.timelineStartTime);
    onSplitClipAtScenes(currentClip.id, cutTimes);
    setAppliedNotice(`¡Clip dividido en ${lastResult.scenes.length} subclips independientes!`);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleApplyBoth = () => {
    if (!lastResult || !currentClip) return;
    if (lastResult.cutMarkers && lastResult.cutMarkers.length > 0) {
      onAddMarkers(lastResult.cutMarkers);
    }
    if (onSplitClipAtScenes) {
      const cutTimes = lastResult.scenes.slice(1).map((s) => s.timelineStartTime);
      onSplitClipAtScenes(currentClip.id, cutTimes);
    }
    setAppliedNotice(
      `¡Marcadores colocados y clip dividido en ${lastResult.scenes.length} tomas!`
    );
    setTimeout(() => {
      onClose();
    }, 1400);
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(2);
    return `${mins.toString().padStart(2, '0')}:${secs.padStart(5, '0')}`;
  };

  const getCutBadgeStyle = (cutType: string) => {
    switch (cutType) {
      case 'dissolve':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'whip_pan':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'jump_cut':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'match_cut':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'hard_cut':
      default:
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 select-none animate-in fade-in duration-200">
      <div className="bg-[#0b101b] border border-[#223048] rounded-2xl w-full max-w-5xl h-[92vh] max-h-[820px] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="px-5 py-3.5 bg-[#0e1626] border-b border-[#1b263b] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-rose-500 p-0.5 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <div className="w-full h-full bg-[#090d16] rounded-[10px] flex items-center justify-center">
                <Scissors className="w-4 h-4 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Auto-Scene Splitter &amp; Cut Detection
                </h2>
                <span className="bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                  <Sparkles className="w-2.5 h-2.5 text-sky-400" />
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Segmentación óptica inteligente de tomas y colocación de marcadores de corte en el timeline
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* 1. Target Clip Selection */}
          <div className="bg-[#0f172a]/80 border border-slate-800/90 rounded-xl p-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {currentClip?.thumbnail ? (
                  <img
                    src={currentClip.thumbnail}
                    alt=""
                    className="w-14 h-10 object-cover rounded-lg border border-slate-700/80 shadow"
                  />
                ) : (
                  <div className="w-14 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Film className="w-5 h-5 text-slate-500" />
                  </div>
                )}
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Toma / Clip a Analizar
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <select
                      value={activeClipId}
                      onChange={(e) => {
                        setActiveClipId(e.target.value);
                        reset();
                      }}
                      className="bg-slate-900 border border-slate-700 text-white text-xs font-semibold rounded-lg px-2.5 py-1 focus:outline-none focus:border-sky-500 cursor-pointer"
                    >
                      {videoClips.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.duration.toFixed(1)}s en pista {c.trackId})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {currentClip && (
                <div className="flex items-center gap-3 text-xs text-slate-300 font-mono bg-black/40 px-3 py-1.5 rounded-lg border border-slate-800 self-start sm:self-auto">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    <span>Duración: {currentClip.duration.toFixed(2)}s</span>
                  </div>
                  <div className="w-px h-3 bg-slate-700" />
                  <div>
                    <span>Posición Timeline: {formatSeconds(currentClip.startTime)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Detection Parameters & Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Sensitivity Selection */}
            <div className="bg-[#0f172a]/70 border border-slate-800/80 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-sky-400" />
                  Sensibilidad de Detección
                </span>
                <span className="text-[10px] font-mono text-sky-400 uppercase font-semibold">
                  {settings.sensitivity}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {(['low', 'medium', 'high'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setSettings((s) => ({ ...s, sensitivity: lvl }))}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition capitalize border ${
                      settings.sensitivity === lvl
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/60 shadow-sm'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {lvl === 'low' ? 'Baja (Actos)' : lvl === 'medium' ? 'Media (Cine)' : 'Alta (Montaje)'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                {settings.sensitivity === 'low'
                  ? 'Detecta únicamente cambios radicales de locación o secuencia narrativa.'
                  : settings.sensitivity === 'medium'
                  ? 'Recomendado: Identifica cambios de ángulo de cámara, primeros planos y contraplanos.'
                  : 'Sensible a micro-cortes, aceleraciones de ritmo y ediciones de video musical.'}
              </p>
            </div>

            {/* Minimum Scene Duration */}
            <div className="bg-[#0f172a]/70 border border-slate-800/80 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Duración Mínima de Toma
                </span>
                <span className="text-[11px] font-mono font-bold text-amber-400">
                  {settings.minSceneDuration.toFixed(1)}s
                </span>
              </div>
              <div className="pt-2">
                <input
                  type="range"
                  min="0.5"
                  max="4.0"
                  step="0.25"
                  value={settings.minSceneDuration}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, minSceneDuration: parseFloat(e.target.value) }))
                  }
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0.5s (Cortes flash)</span>
                <span>4.0s (Tomas largas)</span>
              </div>
            </div>

            {/* Advanced Detection Toggles */}
            <div className="bg-[#0f172a]/70 border border-slate-800/80 rounded-xl p-3 space-y-2.5">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-rose-400" />
                Opciones Ópticas
              </span>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={settings.detectTransitions}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, detectTransitions: e.target.checked }))
                  }
                  className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0 cursor-pointer"
                />
                <span>Detectar disolvencias y paneos rápidos</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={clearPreviousMarkers}
                  onChange={(e) => setClearPreviousMarkers(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0 cursor-pointer"
                />
                <span>Reemplazar marcadores de corte previos</span>
              </label>
            </div>
          </div>

          {/* 3. Action Button / Analysis Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={handleStartAnalysis}
              disabled={isAnalyzing || !currentClip}
              className={`flex-1 w-full py-3 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.99] cursor-pointer ${
                isAnalyzing
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-sky-600 via-indigo-600 to-rose-600 hover:from-sky-500 hover:to-rose-500 text-white shadow-sky-600/25'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <Sparkles className="w-4 h-4 text-sky-400 animate-spin" />
                  <span>{stepMessage || 'Analizando con Gemini 3.8 Flash...'}</span>
                </>
              ) : (
                <>
                  <Scissors className="w-4 h-4 text-white" />
                  <span>
                    {lastResult ? 'Volver a Analizar Tomas con Gemini' : 'Detectar Escenas y Cortes Automáticos'}
                  </span>
                </>
              )}
            </button>

            {lastResult && (
              <button
                onClick={reset}
                className="px-3 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition text-xs font-semibold flex items-center gap-1.5"
                title="Reiniciar análisis"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar</span>
              </button>
            )}
          </div>

          {/* Analysis Progress Bar */}
          {isAnalyzing && (
            <div className="space-y-1.5 bg-[#080d18] border border-sky-900/40 rounded-xl p-3 animate-in fade-in">
              <div className="flex justify-between text-xs">
                <span className="text-sky-300 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                  {stepMessage}
                </span>
                <span className="font-mono text-sky-400 font-bold">{progress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-sky-500 via-indigo-500 to-rose-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Notice Feedback Banner */}
          {appliedNotice && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-xl flex items-center gap-2 text-emerald-300 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{appliedNotice}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-950/70 border border-rose-500/50 rounded-xl flex items-center gap-2 text-rose-300 text-xs font-semibold animate-in fade-in">
              <Info className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 4. Results Section: Filmstrip of Detected Scenes */}
          {lastResult && (
            <div className="space-y-3 pt-2">
              {/* Telemetry Overview Bar */}
              <div className="bg-[#0d1525] border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center font-mono font-bold text-emerald-400 text-sm">
                    {lastResult.totalScenesDetected}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white">
                      {lastResult.totalScenesDetected} Escenas / Planos Detectados
                    </span>
                    <p className="text-[11px] text-slate-400">{lastResult.analysisSummary}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-[11px]">
                  <span className="bg-sky-500/10 text-sky-300 px-2.5 py-1 rounded-md border border-sky-500/20 font-semibold">
                    {lastResult.cutMarkers.length} Puntos de Corte
                  </span>
                  {lastResult.suggestedBpm && (
                    <span className="bg-purple-500/10 text-purple-300 px-2.5 py-1 rounded-md border border-purple-500/20 font-semibold">
                      {lastResult.suggestedBpm} BPM Ritmo
                    </span>
                  )}
                </div>
              </div>

              {/* Scene Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[310px] overflow-y-auto pr-1">
                {lastResult.scenes.map((scene, idx) => {
                  const isFirst = idx === 0;

                  return (
                    <div
                      key={scene.id || idx}
                      className="bg-[#0b1220]/90 border border-slate-800 hover:border-slate-700 rounded-xl p-3 transition space-y-2 relative overflow-hidden group"
                    >
                      {/* Dominant color accent strip */}
                      <div
                        className="absolute top-0 left-0 right-0 h-1"
                        style={{ backgroundColor: scene.thumbnailColor || '#38bdf8' }}
                      />

                      {/* Scene Header */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold text-black shadow-sm"
                            style={{ backgroundColor: scene.thumbnailColor || '#38bdf8' }}
                          >
                            {scene.sceneIndex}
                          </span>
                          <span className="text-xs font-bold text-white truncate max-w-[200px]" title={scene.sceneTitle}>
                            {scene.sceneTitle}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase font-bold ${getCutBadgeStyle(
                              scene.cutType
                            )}`}
                          >
                            {scene.cutType.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            {scene.confidence.toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      {/* Visual Description */}
                      <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2">
                        {scene.visualDescription}
                      </p>

                      {/* Timecodes & Seek Action */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <span>
                            Clip: {scene.startTime.toFixed(2)}s → {scene.endTime.toFixed(2)}s ({scene.duration.toFixed(1)}s)
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {onSeekTime && (
                            <button
                              onClick={() => onSeekTime(scene.timelineStartTime)}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
                              title="Mover cabezal de reproducción a este corte"
                            >
                              <Play className="w-2.5 h-2.5 text-sky-400" />
                              <span>{formatSeconds(scene.timelineStartTime)}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer / Application Bar */}
        <div className="px-5 py-3.5 bg-[#0a0f1a] border-t border-[#1b263b] flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-4 h-4 text-sky-400 flex-shrink-0" />
            <span>
              {lastResult
                ? `Listo para aplicar ${lastResult.cutMarkers.length} cortes al timeline.`
                : 'Ejecuta el análisis para visualizar los puntos de corte ópticos.'}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              Cancelar
            </button>

            {lastResult && (
              <>
                <button
                  onClick={handleApplyMarkersOnly}
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-md shadow-sky-600/20 flex items-center gap-1.5 cursor-pointer"
                  title="Coloca marcadores de corte coloreados con etiquetas en la regla del timeline"
                >
                  <Tag className="w-3.5 h-3.5 text-sky-200" />
                  <span>Solo Marcadores</span>
                </button>

                <button
                  onClick={handleApplySplitClipsOnly}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer"
                  title="Divide físicamente el clip de video en subclips en el timeline"
                >
                  <Scissors className="w-3.5 h-3.5 text-rose-200" />
                  <span>Dividir en Subclips</span>
                </button>

                <button
                  onClick={handleApplyBoth}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
                  title="Coloca marcadores y corta el clip en el timeline (Recomendado)"
                >
                  <Zap className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Ambos (Marcadores + Cortes)</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
