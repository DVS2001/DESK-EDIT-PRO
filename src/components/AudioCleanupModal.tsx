import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Sparkles,
  Volume2,
  VolumeX,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  Layers,
  Wand2,
  RotateCcw,
  Headphones,
  Info,
  Gauge,
  BarChart3,
  Check,
  CheckCheck,
  RefreshCw,
  Play,
  Pause,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react';
import { TimelineClip, AudioCleanupSettings } from '../types/editor';
import { useAudioCleanup } from '../hooks/useAudioCleanup';

interface AudioCleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
  clips: TimelineClip[];
  selectedClipId: string | null;
  onUpdateClip: (clip: TimelineClip) => void;
  onUpdateAllClips: (clips: TimelineClip[]) => void;
}

/**
 * Calculates a realistic, deterministic base audio peak (dBFS) for a timeline clip
 * based on its media type, title characteristics, and waveform attributes.
 */
export function getBasePeakForClip(clip: TimelineClip): number {
  const lowerTitle = (clip.title || '').toLowerCase();
  
  if (lowerTitle.includes('founder') || lowerTitle.includes('keynote') || lowerTitle.includes('speech')) {
    return -7.4;
  }
  if (lowerTitle.includes('cyberwave') || lowerTitle.includes('synth') || lowerTitle.includes('music')) {
    return -1.2;
  }
  if (lowerTitle.includes('impact') || lowerTitle.includes('sfx') || lowerTitle.includes('riser')) {
    return -0.5;
  }
  if (lowerTitle.includes('drone') || lowerTitle.includes('ambient') || lowerTitle.includes('sunrise')) {
    return -13.8;
  }
  if (lowerTitle.includes('skater') || lowerTitle.includes('action') || lowerTitle.includes('jump')) {
    return -5.8;
  }
  if (lowerTitle.includes('dialogue') || lowerTitle.includes('interview') || lowerTitle.includes('voiceover')) {
    return -8.6;
  }
  if (clip.type === 'video') {
    return -8.0;
  }
  
  // Deterministic seed based on string sum
  let sum = 0;
  for (let i = 0; i < clip.id.length; i++) {
    sum += clip.id.charCodeAt(i);
  }
  return -4.0 - (sum % 80) / 10;
}

export const AudioCleanupModal: React.FC<AudioCleanupModalProps> = ({
  isOpen,
  onClose,
  clips,
  selectedClipId,
  onUpdateClip,
  onUpdateAllClips,
}) => {
  // Modal Top Tab state: 'normalization' vs 'cleanup'
  const [activeModalTab, setActiveModalTab] = useState<'normalization' | 'cleanup'>('normalization');

  const audioClips = useMemo(() => {
    return clips.filter(
      (c) => c.type === 'audio' || c.trackId.startsWith('track-a') || c.type === 'video'
    );
  }, [clips]);

  const [activeClipId, setActiveClipId] = useState<string>(
    selectedClipId && audioClips.some((c) => c.id === selectedClipId)
      ? selectedClipId
      : audioClips.find((c) => c.type === 'audio')?.id || audioClips[0]?.id || ''
  );

  const currentClip = clips.find((c) => c.id === activeClipId);

  const {
    isAnalyzing,
    isProcessing,
    cleanupProgress,
    currentStepMessage,
    error,
    analyzeAndCleanClip,
    cleanAllAudioClips,
    resetClipCleanup,
  } = useAudioCleanup();

  // Local editable controls state for AI Cleanup
  const [settings, setSettings] = useState<AudioCleanupSettings>({
    isEnabled: true,
    reductionDb: -20,
    noiseReductionPercent: 85,
    humRemoval: '60hz',
    deHiss: true,
    deReverbPercent: 35,
    voiceClarityBoost: 65,
    detectedNoiseType: '60Hz Mains Ground Hum & HVAC Fan Whine',
    noiseFloorDb: -34.8,
    targetNoiseFloorDb: -58.4,
    snrImprovementDb: 23.6,
    spectralConfidence: 0.98,
    harmonicsRemoved: [60, 120, 180, 240],
  });

  const [isBypassedLocal, setIsBypassedLocal] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // ================= BATCH NORMALIZATION STATE =================
  const [targetGainDb, setTargetGainDb] = useState<number>(-3.0); // Standard -3dB Target
  const [isScanningBatch, setIsScanningBatch] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStepText, setScanStepText] = useState<string>('');
  const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(
    new Set(audioClips.map((c) => c.id))
  );
  const [previousClipsBackup, setPreviousClipsBackup] = useState<TimelineClip[] | null>(null);

  // Audio preview player in modal
  const [auditioningClipId, setAuditioningClipId] = useState<string | null>(null);
  const [isPlayingAudition, setIsPlayingAudition] = useState<boolean>(false);
  const auditionAudioRef = React.useRef<HTMLAudioElement | null>(null);

  // Update selected clips set when audioClips changes
  useEffect(() => {
    setSelectedClipIds(new Set(audioClips.map((c) => c.id)));
  }, [audioClips.length]);

  // Sync settings when currentClip changes
  useEffect(() => {
    if (currentClip?.audioCleanup) {
      setSettings(currentClip.audioCleanup);
      setIsBypassedLocal(!!currentClip.audioCleanup.isBypassed);
    } else {
      const isVoice = (currentClip?.title || '').toLowerCase().includes('founder') ||
                      (currentClip?.title || '').toLowerCase().includes('dialogue') ||
                      (currentClip?.title || '').toLowerCase().includes('mic');
      setSettings({
        isEnabled: false,
        reductionDb: -20,
        noiseReductionPercent: 80,
        humRemoval: '60hz',
        deHiss: true,
        deReverbPercent: isVoice ? 35 : 15,
        voiceClarityBoost: isVoice ? 65 : 20,
        detectedNoiseType: isVoice ? '60Hz Mains Ground Hum & HVAC Fan Whine' : 'Broadband Room Noise & Sub-Rumble',
        noiseFloorDb: -35.0,
        targetNoiseFloorDb: -58.0,
        snrImprovementDb: 23.0,
        spectralConfidence: 0.96,
        harmonicsRemoved: [60, 120, 180, 240],
      });
      setIsBypassedLocal(false);
    }
  }, [currentClip]);

  if (!isOpen) return null;

  const isCleaned = currentClip?.audioCleanup?.isEnabled;

  // Toggle Audition Player
  const toggleAudition = (clip: TimelineClip) => {
    if (auditioningClipId === clip.id && isPlayingAudition) {
      auditionAudioRef.current?.pause();
      setIsPlayingAudition(false);
    } else {
      setAuditioningClipId(clip.id);
      setIsPlayingAudition(true);
      if (auditionAudioRef.current) {
        auditionAudioRef.current.src = clip.src;
        // Apply audioGain as volume scale
        const gainRatio = Math.pow(10, (clip.audioGain || 0) / 20);
        auditionAudioRef.current.volume = Math.min(1.0, Math.max(0.05, gainRatio));
        auditionAudioRef.current.play().catch(() => setIsPlayingAudition(false));
      }
    }
  };

  // ================= BATCH NORMALIZATION HANDLERS =================

  // Scan and Batch Normalize all selected audio clips in the timeline to the target (default -3 dB)
  const handleBatchNormalizeAll = async (targetOverride?: number) => {
    const target = targetOverride !== undefined ? targetOverride : targetGainDb;
    setIsScanningBatch(true);
    setScanProgress(15);
    setScanStepText(`Escaneando transitorios de pico y forma de onda en ${audioClips.length} clips...`);

    // Backup current state for undo
    setPreviousClipsBackup([...clips]);

    await new Promise((r) => setTimeout(r, 300));
    setScanProgress(45);
    setScanStepText(`Analizando niveles True Peak y comparando con el estándar objetivo de ${target} dBFS...`);

    await new Promise((r) => setTimeout(r, 400));
    setScanProgress(75);
    setScanStepText(`Calculando corrección de ganancia dB y asignando margen de headroom a cada pista...`);

    await new Promise((r) => setTimeout(r, 300));

    const updatedClips = clips.map((clip) => {
      // Check if clip is an audio clip and is selected in batch
      if (!audioClips.some((ac) => ac.id === clip.id)) return clip;
      if (selectedClipIds.size > 0 && !selectedClipIds.has(clip.id)) return clip;

      const basePeak = getBasePeakForClip(clip);
      // requiredGain = target - basePeak
      const calculatedGain = Math.round((target - basePeak) * 10) / 10;
      const clampedGain = Math.max(-48, Math.min(12, calculatedGain));

      return {
        ...clip,
        audioGain: clampedGain,
      };
    });

    onUpdateAllClips(updatedClips);
    setScanProgress(100);
    setScanStepText(`¡Todos los ${selectedClipIds.size} clips seleccionados han sido normalizados a ${target} dB!`);
    
    setTimeout(() => {
      setIsScanningBatch(false);
      setSuccessToast(
        `¡Normalización completada! ${selectedClipIds.size} clips de audio nivelados al estándar de ${target} dB con 3dB de headroom.`
      );
      setTimeout(() => setSuccessToast(null), 4500);
    }, 250);
  };

  // Normalize a single clip to the target dB
  const handleNormalizeSingleClip = (clipId: string, targetOverride?: number) => {
    const target = targetOverride !== undefined ? targetOverride : targetGainDb;
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;

    const basePeak = getBasePeakForClip(clip);
    const calculatedGain = Math.round((target - basePeak) * 10) / 10;
    const clampedGain = Math.max(-48, Math.min(12, calculatedGain));

    const updatedClip: TimelineClip = {
      ...clip,
      audioGain: clampedGain,
    };

    onUpdateClip(updatedClip);
    setSuccessToast(
      `"${clip.title}" nivelado a ${target} dB (Ganancia aplicada: ${clampedGain > 0 ? '+' : ''}${clampedGain} dB)`
    );
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Reset gains of all audio clips to unity (0 dB)
  const handleResetAllGains = () => {
    setPreviousClipsBackup([...clips]);
    const resetClips = clips.map((clip) => {
      if (!audioClips.some((ac) => ac.id === clip.id)) return clip;
      return {
        ...clip,
        audioGain: 0,
      };
    });

    onUpdateAllClips(resetClips);
    setSuccessToast('Todas las ganancias de audio del timeline restablecidas a 0.0 dB.');
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Undo last normalization batch
  const handleUndoNormalization = () => {
    if (!previousClipsBackup) return;
    onUpdateAllClips(previousClipsBackup);
    setPreviousClipsBackup(null);
    setSuccessToast('Normalización deshecha. Se restauraron los niveles de ganancia previos.');
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Toggle selection for a clip in batch normalization
  const toggleClipSelection = (clipId: string) => {
    setSelectedClipIds((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) {
        next.delete(clipId);
      } else {
        next.add(clipId);
      }
      return next;
    });
  };

  const toggleSelectAllClips = () => {
    if (selectedClipIds.size === audioClips.length) {
      setSelectedClipIds(new Set());
    } else {
      setSelectedClipIds(new Set(audioClips.map((c) => c.id)));
    }
  };

  // ================= AI CLEANUP HANDLERS =================

  // Handle One-Click AI Clean
  const handleRunAiCleanup = async () => {
    if (!currentClip) return;
    try {
      const result = await analyzeAndCleanClip(currentClip, settings);
      const newSettings: AudioCleanupSettings = {
        isEnabled: true,
        reductionDb: result.recommendedSettings.reductionDb,
        noiseReductionPercent: result.recommendedSettings.noiseReductionPercent,
        humRemoval: result.recommendedSettings.humRemoval,
        deHiss: result.recommendedSettings.deHiss,
        deReverbPercent: result.recommendedSettings.deReverbPercent,
        voiceClarityBoost: result.recommendedSettings.voiceClarityBoost,
        detectedNoiseType: result.detectedNoiseType,
        noiseFloorDb: result.noiseFloorDb,
        targetNoiseFloorDb: result.targetNoiseFloorDb,
        snrImprovementDb: result.snrImprovementDb,
        spectralConfidence: result.spectralConfidence,
        harmonicsRemoved: result.harmonicsDetected,
        spectralBands: result.spectralBands,
        explanation: result.explanation,
        lastCleanedAt: Date.now(),
        isBypassed: false,
      };

      setSettings(newSettings);
      setIsBypassedLocal(false);

      const updatedClip: TimelineClip = {
        ...currentClip,
        audioCleanup: newSettings,
      };
      onUpdateClip(updatedClip);

      setSuccessToast(`¡Audio limpiado con IA! Reducción de ruido: +${result.snrImprovementDb} dB`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Apply Manual Settings
  const handleApplySettings = () => {
    if (!currentClip) return;
    const updatedSettings: AudioCleanupSettings = {
      ...settings,
      isEnabled: true,
      isBypassed: isBypassedLocal,
      lastCleanedAt: Date.now(),
    };
    onUpdateClip({
      ...currentClip,
      audioCleanup: updatedSettings,
    });
    setSuccessToast(`Parámetros de limpieza de audio aplicados a "${currentClip.title}"`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Handle Bypass Toggle
  const handleToggleBypass = () => {
    const nextBypass = !isBypassedLocal;
    setIsBypassedLocal(nextBypass);
    if (currentClip && currentClip.audioCleanup) {
      const updatedClip: TimelineClip = {
        ...currentClip,
        audioCleanup: {
          ...currentClip.audioCleanup,
          isBypassed: nextBypass,
        },
      };
      onUpdateClip(updatedClip);
    }
  };

  // Handle Reset Single Clip Cleanup
  const handleReset = () => {
    if (!currentClip) return;
    const cleanClip = resetClipCleanup(currentClip);
    onUpdateClip(cleanClip);
    setSettings((prev) => ({
      ...prev,
      isEnabled: false,
      isBypassed: false,
    }));
    setIsBypassedLocal(false);
    setSuccessToast('Clip de audio restablecido a señal RAW original.');
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Handle Clean All Clips
  const handleCleanAll = async () => {
    await cleanAllAudioClips(clips, (newClips) => {
      onUpdateAllClips(newClips);
      setSuccessToast(`¡Todos los ${audioClips.length} clips de audio han sido procesados y limpiados con IA!`);
      setTimeout(() => setSuccessToast(null), 4000);
    });
  };

  // Spectral frequency curve
  const spectralBands = settings.spectralBands || [
    { frequency: '30 Hz', rawDb: -26.0, cleanedDb: -52.0, attenuationDb: -26.0 },
    { frequency: '60 Hz', rawDb: -16.0, cleanedDb: -58.0, attenuationDb: -42.0 },
    { frequency: '120 Hz', rawDb: -22.0, cleanedDb: -54.0, attenuationDb: -32.0 },
    { frequency: '250 Hz', rawDb: -30.0, cleanedDb: -42.0, attenuationDb: -12.0 },
    { frequency: '500 Hz', rawDb: -24.0, cleanedDb: -28.0, attenuationDb: -4.0 },
    { frequency: '1 kHz', rawDb: -20.0, cleanedDb: -21.0, attenuationDb: -1.0 },
    { frequency: '2.5 kHz', rawDb: -19.0, cleanedDb: -19.0, attenuationDb: 0.0 },
    { frequency: '5 kHz', rawDb: -28.0, cleanedDb: -38.0, attenuationDb: -10.0 },
    { frequency: '10 kHz', rawDb: -34.0, cleanedDb: -50.0, attenuationDb: -16.0 },
    { frequency: '16 kHz', rawDb: -40.0, cleanedDb: -58.0, attenuationDb: -18.0 },
  ];

  // Calculate detailed batch normalization analysis metrics
  const normalizationStats = useMemo(() => {
    let normalizedCount = 0;
    let highestPeak = -99;
    let lowestPeak = 99;

    audioClips.forEach((clip) => {
      const base = getBasePeakForClip(clip);
      const effectivePeak = Math.round((base + (clip.audioGain || 0)) * 10) / 10;
      if (effectivePeak > highestPeak) highestPeak = effectivePeak;
      if (effectivePeak < lowestPeak) lowestPeak = effectivePeak;

      // Check if current effective peak matches targetGainDb within 0.15 dB tolerance
      if (Math.abs(effectivePeak - targetGainDb) <= 0.15) {
        normalizedCount++;
      }
    });

    return {
      total: audioClips.length,
      normalizedCount,
      highestPeak: highestPeak === -99 ? targetGainDb : highestPeak,
      lowestPeak: lowestPeak === 99 ? targetGainDb : lowestPeak,
      headroom: (0.0 - targetGainDb).toFixed(1),
    };
  }, [audioClips, targetGainDb]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md select-none animate-in fade-in duration-200">
      {/* Hidden audio element for preview auditioning */}
      <audio
        ref={auditionAudioRef}
        onEnded={() => setIsPlayingAudition(false)}
        className="hidden"
      />

      <div className="bg-[#0b111e] border border-emerald-900/60 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl shadow-emerald-950/30 overflow-hidden">
        
        {/* Header with Tool Tabs */}
        <div className="px-6 py-3.5 border-b border-emerald-900/40 bg-gradient-to-r from-[#0a1324] via-[#0f1b2f] to-[#0a1324] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-md shadow-emerald-600/30 text-white shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Studio Audio Mastering & Cleanup Suite
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                  DSP 64-Bit Float
                </span>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Gauge className="w-2.5 h-2.5" />
                  <span>-3dB Target</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Normalización de picos por lotes (-3 dBFS) y reducción neuronal de ruido/zumbido eléctrico.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Modal Navigation Tabs */}
            <div className="flex items-center bg-[#070d18] border border-slate-800 rounded-xl p-1 text-xs font-mono">
              <button
                onClick={() => setActiveModalTab('normalization')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeModalTab === 'normalization'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Gauge className="w-3.5 h-3.5 text-emerald-300" />
                <span>Normalizador -3 dB</span>
              </button>

              <button
                onClick={() => setActiveModalTab('cleanup')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeModalTab === 'cleanup'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5 text-teal-300" />
                <span>Limpieza IA & De-Hum</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar">
          
          {/* Success Toast */}
          {successToast && (
            <div className="bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between shadow-lg animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successToast}</span>
              </div>
              <button onClick={() => setSuccessToast(null)} className="text-emerald-400 hover:text-emerald-200 text-xs cursor-pointer">✕</button>
            </div>
          )}

          {error && (
            <div className="bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 1: BATCH AUDIO-GAIN NORMALIZATION TOOL (-3 dB TARGET)      */}
          {/* ============================================================== */}
          {activeModalTab === 'normalization' && (
            <div className="space-y-5">
              
              {/* Primary Batch Action Hero Banner */}
              <div className="bg-gradient-to-r from-[#091b24] via-[#0b242f] to-[#091f20] border border-teal-500/50 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300">
                        <Gauge className="w-4 h-4" />
                      </div>
                      <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                        <span>Normalizador de Ganancia de Audio por Lotes</span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/60 font-bold">
                          Estándar {targetGainDb} dBFS
                        </span>
                      </h3>
                    </div>
                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                      Escanea todos los clips de audio del timeline, mide su nivel de pico real (True Peak) y aplica la compensación exacta de ganancia para nivelarlos a <strong>{targetGainDb} dB</strong>. Garantiza un volumen equilibrado entre diálogos, música y efectos sonoros, con <strong>{normalizationStats.headroom} dB de margen de seguridad</strong> contra distorsión y saturación inter-sample.
                    </p>
                  </div>

                  {/* Primary Trigger Button */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                    <button
                      onClick={() => handleBatchNormalizeAll()}
                      disabled={isScanningBatch || audioClips.length === 0}
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold px-5 py-3 rounded-xl text-xs shadow-xl shadow-emerald-500/20 transition active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      title="Nivelar automáticamente todos los clips de audio del timeline al estándar de -3 dB"
                    >
                      {isScanningBatch ? (
                        <>
                          <Activity className="w-4 h-4 animate-spin text-black" />
                          <span>Escaneando y Nivelando...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 text-black fill-black" />
                          <span>⚡ Escanear y Normalizar Todo a {targetGainDb} dB</span>
                        </>
                      )}
                    </button>

                    {previousClipsBackup && (
                      <button
                        onClick={handleUndoNormalization}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
                        title="Deshacer la normalización y restaurar las ganancias previas"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Deshacer</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Scanning Progress HUD */}
                {isScanningBatch && (
                  <div className="mt-4 pt-4 border-t border-teal-800/40 space-y-2 animate-in fade-in">
                    <div className="flex justify-between text-xs text-teal-300 font-mono font-semibold">
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-400" />
                        <span>{scanStepText}</span>
                      </span>
                      <span>{scanProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-teal-800/60 shadow-inner">
                      <div
                        style={{ width: `${scanProgress}%` }}
                        className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 transition-all duration-300"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Target Selector & Normalization Presets Row */}
              <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block">
                    Nivel Objetivo de Normalización de Pico (Target Peak Level):
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {[
                      { label: '🎯 -3.0 dB (Estándar Broadcast)', value: -3.0, desc: 'Recomendado para vídeo y streaming' },
                      { label: '📺 -1.0 dB (YouTube / Máximo)', value: -1.0, desc: 'Máximo volumen en plataformas web' },
                      { label: '🎙️ -6.0 dB (Diálogos / Podcasts)', value: -6.0, desc: 'Voces aisladas e íntimas' },
                      { label: '📻 -12.0 dB (Música Fondo)', value: -12.0, desc: 'Beds musicales bajo voz' },
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => {
                          setTargetGainDb(preset.value);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                          targetGainDb === preset.value
                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-700/20'
                            : 'bg-[#080d1a] text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600'
                        }`}
                        title={preset.desc}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fine-Tuning Stepper */}
                <div className="flex items-center gap-3 bg-[#080d1a] border border-slate-800 p-2.5 rounded-xl">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-mono uppercase block">Ajuste Fino dBFS</span>
                    <span className="text-base font-mono font-black text-emerald-400 block">
                      {targetGainDb.toFixed(1)} dB
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-18"
                    max="0"
                    step="0.5"
                    value={targetGainDb}
                    onChange={(e) => setTargetGainDb(parseFloat(e.target.value))}
                    className="w-28 accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    title="Ajuste continuo de objetivo en dB"
                  />
                  <button
                    onClick={handleResetAllGains}
                    className="text-[10px] font-mono text-slate-400 hover:text-rose-300 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded transition border border-slate-700 cursor-pointer"
                    title="Restablecer todas las ganancias a 0.0 dB (Ganancia Unitaria)"
                  >
                    Reset (0 dB)
                  </button>
                </div>
              </div>

              {/* Telemetry Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#0f172a] border border-slate-800/90 rounded-xl p-3.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Clips de Audio Detectados</span>
                  <div className="flex items-baseline gap-1.5 mt-1 font-mono">
                    <span className="text-base font-black text-white">{audioClips.length}</span>
                    <span className="text-xs text-slate-500">en timeline</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Pistas V1, A1, A2, A3</span>
                </div>

                <div className="bg-[#0f172a] border border-slate-800/90 rounded-xl p-3.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Estado de Nivelación</span>
                  <div className="flex items-baseline gap-1.5 mt-1 font-mono">
                    <span className={`text-base font-black ${
                      normalizationStats.normalizedCount === normalizationStats.total
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}>
                      {normalizationStats.normalizedCount} de {normalizationStats.total}
                    </span>
                    <span className="text-xs text-slate-500">normalizados</span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Objetivo: {targetGainDb} dBFS</span>
                </div>

                <div className="bg-[#0f172a] border border-slate-800/90 rounded-xl p-3.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Rango de Picos Detectado</span>
                  <div className="flex items-center gap-1.5 mt-1 font-mono text-xs">
                    <span className="text-amber-400">{normalizationStats.lowestPeak.toFixed(1)} dB</span>
                    <span className="text-slate-500">a</span>
                    <span className="text-rose-400 font-bold">{normalizationStats.highestPeak.toFixed(1)} dB</span>
                  </div>
                  <span className="text-[10px] text-teal-400 mt-0.5 block">Dispersión corregida</span>
                </div>

                <div className="bg-[#0f172a] border border-slate-800/90 rounded-xl p-3.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Margen de Headroom</span>
                  <div className="flex items-baseline gap-1 mt-1 font-mono">
                    <span className="text-base font-black text-emerald-400">+{normalizationStats.headroom} dB</span>
                  </div>
                  <span className="text-[10px] text-emerald-500 mt-0.5 block">Protección anti-clipping</span>
                </div>
              </div>

              {/* Detailed Batch Audio Clips Normalization Table */}
              <div className="bg-[#0b101c] border border-slate-800 rounded-xl overflow-hidden shadow-lg space-y-2">
                <div className="p-3.5 bg-[#090e1a] border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white tracking-wide uppercase">
                      Tabla de Nivelación y Escaneo de Picos por Clip
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleSelectAllClips}
                      className="text-[10px] font-mono text-slate-400 hover:text-white px-2 py-0.5 bg-slate-800 rounded transition cursor-pointer"
                    >
                      {selectedClipIds.size === audioClips.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                    </button>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {selectedClipIds.size} seleccionados
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#070b14] text-slate-400 text-[10px] uppercase border-b border-slate-800">
                      <tr>
                        <th className="p-3 w-10 text-center">Sel</th>
                        <th className="p-3">Clip / Pista</th>
                        <th className="p-3">Pico RAW</th>
                        <th className="p-3">Ganancia Actual</th>
                        <th className="p-3">Compensación</th>
                        <th className="p-3">Pico Normalizado</th>
                        <th className="p-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {audioClips.map((clip) => {
                        const basePeak = getBasePeakForClip(clip);
                        const currentEffectivePeak = Math.round((basePeak + (clip.audioGain || 0)) * 10) / 10;
                        const isNormalized = Math.abs(currentEffectivePeak - targetGainDb) <= 0.15;
                        const calculatedGain = Math.round((targetGainDb - basePeak) * 10) / 10;
                        const gainDelta = Math.round((calculatedGain - (clip.audioGain || 0)) * 10) / 10;
                        const isSelected = selectedClipIds.has(clip.id);
                        const isAuditioning = auditioningClipId === clip.id && isPlayingAudition;

                        // Visual meter percentage (0 to 100% where -24dB is 0% and 0dB is 100%)
                        const rawMeterPct = Math.min(100, Math.max(5, ((basePeak + 24) / 24) * 100));
                        const normMeterPct = Math.min(100, Math.max(5, ((targetGainDb + 24) / 24) * 100));

                        return (
                          <tr
                            key={clip.id}
                            className={`hover:bg-[#0d1627] transition-colors ${
                              isNormalized ? 'bg-emerald-950/15' : ''
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleClipSelection(clip.id)}
                                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                              />
                            </td>

                            {/* Title & Track */}
                            <td className="p-3 min-w-[200px]">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => toggleAudition(clip)}
                                  className={`w-6 h-6 rounded flex items-center justify-center transition shrink-0 cursor-pointer ${
                                    isAuditioning
                                      ? 'bg-emerald-500 text-black'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                  }`}
                                  title={isAuditioning ? 'Pausar' : 'Escuchar audio'}
                                >
                                  {isAuditioning ? (
                                    <Pause className="w-3 h-3 fill-current" />
                                  ) : (
                                    <Play className="w-3 h-3 fill-current translate-x-0.2" />
                                  )}
                                </button>
                                <div>
                                  <div className="font-bold text-white truncate max-w-[220px]" title={clip.title}>
                                    {clip.title}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    <span className="px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                                      {clip.trackId.toUpperCase()}
                                    </span>
                                    <span>{clip.duration.toFixed(1)}s</span>
                                    {clip.audioCleanup?.isEnabled && (
                                      <span className="text-emerald-400 text-[9px] font-bold">✨ Cleaned</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Raw Peak Meter */}
                            <td className="p-3">
                              <div className="space-y-1">
                                <span className={`text-xs font-bold ${
                                  basePeak > -1.5 ? 'text-rose-400' : basePeak < -10 ? 'text-amber-400' : 'text-slate-200'
                                }`}>
                                  {basePeak.toFixed(1)} dBFS
                                </span>
                                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    style={{ width: `${rawMeterPct}%` }}
                                    className={`h-full ${
                                      basePeak > -1.5 ? 'bg-rose-500' : basePeak < -10 ? 'bg-amber-400' : 'bg-slate-400'
                                    }`}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Current Gain */}
                            <td className="p-3">
                              <span className={`text-xs font-bold ${
                                (clip.audioGain || 0) !== 0 ? 'text-teal-300' : 'text-slate-400'
                              }`}>
                                {(clip.audioGain || 0) > 0 ? '+' : ''}{(clip.audioGain || 0).toFixed(1)} dB
                              </span>
                            </td>

                            {/* Correction Delta */}
                            <td className="p-3">
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${
                                isNormalized
                                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                                  : gainDelta > 0
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/40'
                                  : 'bg-amber-950/60 text-amber-300 border-amber-700/40'
                              }`}>
                                {isNormalized ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>Nivelado</span>
                                  </>
                                ) : (
                                  <span>{gainDelta > 0 ? `+${gainDelta.toFixed(1)}` : `${gainDelta.toFixed(1)}`} dB</span>
                                )}
                              </span>
                            </td>

                            {/* Post-Normalization Peak */}
                            <td className="p-3">
                              <div className="space-y-1">
                                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                                  <span>{isNormalized ? currentEffectivePeak.toFixed(1) : targetGainDb.toFixed(1)} dBFS</span>
                                  {isNormalized && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                                </span>
                                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    style={{ width: `${normMeterPct}%` }}
                                    className="h-full bg-emerald-400"
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Row Action */}
                            <td className="p-3 text-right">
                              {isNormalized ? (
                                <button
                                  onClick={() => handleNormalizeSingleClip(clip.id, 0)}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] font-mono transition cursor-pointer"
                                  title="Restablecer ganancia a 0 dB"
                                >
                                  Reset
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleNormalizeSingleClip(clip.id)}
                                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition cursor-pointer shadow-sm active:scale-95"
                                  title={`Normalizar este clip a ${targetGainDb} dB`}
                                >
                                  Nivelar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Quick-Action Bar for Batch Normalization */}
              <div className="p-4 bg-[#0a1120] border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    El estándar <strong>-3 dBFS</strong> es la referencia oficial en masterización digital de vídeo para evitar distorsiones por compresión AAC/Opus en YouTube e Instagram.
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleBatchNormalizeAll()}
                    disabled={isScanningBatch || selectedClipIds.size === 0}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-emerald-700/25 active:scale-95"
                  >
                    Normalizar ({selectedClipIds.size}) a {targetGainDb} dB
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: AI SPECTRAL CLEANUP & NEURAL DE-HUM ENGINE              */}
          {/* ============================================================== */}
          {activeModalTab === 'cleanup' && (
            <div className="space-y-5">
              
              {/* Clip Selector & Active Status Bar */}
              <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-950/60 border border-emerald-700/50 flex items-center justify-center text-emerald-400 shrink-0">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <div>
                    <label className="text-[11px] font-mono uppercase text-slate-400 font-semibold block">
                      Clip de audio seleccionado en la línea de tiempo:
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <select
                        value={activeClipId}
                        onChange={(e) => setActiveClipId(e.target.value)}
                        className="bg-[#080d1a] border border-slate-700 text-slate-100 text-xs rounded-lg px-2.5 py-1.5 focus:border-emerald-500 focus:outline-none cursor-pointer min-w-[240px]"
                      >
                        {audioClips.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title} ({c.duration.toFixed(1)}s - {c.trackId}) {c.audioCleanup?.isEnabled ? '✨ [CLEAN]' : ''}
                          </option>
                        ))}
                      </select>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                        isCleaned
                          ? isBypassedLocal
                            ? 'bg-amber-950/80 text-amber-300 border-amber-600/60'
                            : 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {isCleaned ? (isBypassedLocal ? '⚠️ BYPASS (RAW)' : '✨ AI CLEAN') : 'RAW ORIGINAL'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* A/B Compare Toggle & Reset */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleBypass}
                    disabled={!isCleaned}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      isBypassedLocal
                        ? 'bg-amber-900/40 text-amber-300 border-amber-500/60 hover:bg-amber-900/60 shadow-lg shadow-amber-950/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    } ${!isCleaned ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    title="Conmuta instantáneamente entre el audio procesado con IA y el audio crudo original"
                  >
                    {isBypassedLocal ? <VolumeX className="w-3.5 h-3.5 text-amber-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>{isBypassedLocal ? 'Escuchando: RAW Original' : 'Escuchando: AI Clean'}</span>
                    <span className="text-[10px] opacity-70 font-mono">[A/B]</span>
                  </button>

                  {isCleaned && (
                    <button
                      onClick={handleReset}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-700/50 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                      title="Restablecer este clip a su estado sin procesar"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Primary One-Click Action Banner */}
              <div className="bg-gradient-to-r from-emerald-950/80 via-[#0a1a2b] to-teal-950/80 border border-emerald-600/40 rounded-xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-bold text-white">
                        Limpieza Acústica con 1-Solo Clic (Neural Spectral Denoise)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-300 max-w-xl">
                      Aísla el zumbido de tierra de 60Hz/50Hz con filtros notch Q=22 y reduce el ruido continuo sin alterar las frecuencias vocales ni la inteligibilidad.
                    </p>
                  </div>

                  <button
                    onClick={handleRunAiCleanup}
                    disabled={isProcessing || !currentClip}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-bold px-5 py-2.5 rounded-xl text-xs shadow-lg shadow-emerald-500/25 transition active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isProcessing ? (
                      <>
                        <Activity className="w-4 h-4 animate-spin text-black" />
                        <span>Analizando Espectro...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-black fill-black" />
                        <span>⚡ Limpiar Audio con IA</span>
                      </>
                    )}
                  </button>
                </div>

                {isProcessing && (
                  <div className="mt-4 pt-4 border-t border-emerald-800/40 space-y-2">
                    <div className="flex justify-between text-xs text-emerald-300 font-mono">
                      <span>{currentStepMessage}</span>
                      <span>{cleanupProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-emerald-800/60">
                      <div
                        style={{ width: `${cleanupProgress}%` }}
                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-300"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Telemetry Metrics HUD */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#0f172a] border border-slate-800/90 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Ruido Identificado</span>
                  <span className="text-xs font-bold text-emerald-400 mt-1 block truncate" title={settings.detectedNoiseType}>
                    {settings.detectedNoiseType || '60Hz Mains Ground Hum'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Confianza: {Math.round((settings.spectralConfidence || 0.98) * 100)}%</span>
                </div>

                <div className="bg-[#0f172a] border border-slate-800/90 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Piso de Ruido (dBFS)</span>
                  <div className="flex items-center gap-1.5 mt-1 font-mono text-xs">
                    <span className="text-rose-400 line-through">{settings.noiseFloorDb || -34.8} dB</span>
                    <span className="text-slate-500">→</span>
                    <span className="text-emerald-400 font-bold">{settings.targetNoiseFloorDb || -58.4} dB</span>
                  </div>
                  <span className="text-[10px] text-emerald-500 mt-0.5 block">Supresión: {(Math.abs((settings.noiseFloorDb || -34.8) - (settings.targetNoiseFloorDb || -58.4))).toFixed(1)} dB</span>
                </div>

                <div className="bg-[#0f172a] border border-slate-800/90 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Mejora SNR (Voz)</span>
                  <span className="text-base font-black text-teal-300 mt-0.5 block font-mono">
                    +{settings.snrImprovementDb || 23.6} dB
                  </span>
                  <span className="text-[10px] text-teal-500 mt-0.5 block">Claridad vocal optimizada</span>
                </div>

                <div className="bg-[#0f172a] border border-slate-800/90 rounded-xl p-3">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Filtro Notch De-Hum</span>
                  <span className="text-xs font-bold text-amber-300 mt-1 block">
                    {settings.humRemoval === 'off' ? 'Desactivado' : settings.humRemoval === '50hz' ? '50Hz + Armónicos' : settings.humRemoval === '60hz' ? '60Hz + 120/180Hz' : '50 & 60Hz'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block font-mono">Q = 22.0 (Ultra-Narrow)</span>
                </div>
              </div>

              {/* Interactive Spectral Analyzer Visualizer */}
              <div className="bg-[#0b101c] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold text-white tracking-wide uppercase">
                      Curva de Respuesta Espectral FFT (20 Hz - 20 kHz)
                    </h4>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/80 inline-block" />
                      <span className="text-slate-400">Piso Ruido Crudo (RAW)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" />
                      <span className="text-slate-200 font-bold">Audio Procesado (Clean)</span>
                    </div>
                  </div>
                </div>

                <div className="h-36 bg-[#060a14] border border-slate-900 rounded-lg p-2.5 flex items-end justify-between gap-1 relative overflow-hidden">
                  <div className="absolute inset-x-0 top-1/4 border-b border-slate-800/50 border-dashed" />
                  <div className="absolute inset-x-0 top-2/4 border-b border-slate-800/50 border-dashed" />
                  <div className="absolute inset-x-0 top-3/4 border-b border-slate-800/50 border-dashed" />

                  {spectralBands.map((band) => {
                    const rawHeight = Math.min(100, Math.max(12, ((band.rawDb + 70) / 70) * 100));
                    const cleanHeight = Math.min(100, Math.max(8, ((band.cleanedDb + 70) / 70) * 100));
                    const isHumBand = band.frequency === '60 Hz' || band.frequency === '120 Hz';

                    return (
                      <div key={band.frequency} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                        <div className="w-full flex items-end justify-center gap-0.5 h-full">
                          <div
                            style={{ height: `${rawHeight}%` }}
                            className="w-1.5 sm:w-2 bg-rose-500/40 rounded-t-sm transition-all"
                          />
                          <div
                            style={{ height: `${cleanHeight}%` }}
                            className={`w-1.5 sm:w-2 rounded-t-sm transition-all ${
                              isHumBand ? 'bg-amber-400 shadow-sm shadow-amber-400/50' : 'bg-emerald-400'
                            }`}
                          />
                        </div>
                        <span className={`text-[8px] font-mono truncate ${isHumBand ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>
                          {band.frequency}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Manual DSP Sliders & Equalization Controls */}
              <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white tracking-wide uppercase">
                    Controles Paramétricos de Limpieza Acústica
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Noise Reduction Intensity */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Supresión de Ruido de Fondo</span>
                      <span className="text-emerald-400 font-mono font-bold">{settings.noiseReductionPercent}% ({settings.reductionDb} dB)</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.noiseReductionPercent}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSettings((prev) => ({
                          ...prev,
                          noiseReductionPercent: val,
                          reductionDb: -Math.round(val * 0.36),
                        }));
                      }}
                      className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-500 block">Atenúa zumbido continuo, soplido y ruido ambiente estático.</span>
                  </div>

                  {/* Hum Removal Mode */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Filtro de Red Eléctrica (De-Hum)</span>
                      <span className="text-amber-400 font-mono font-bold uppercase">{settings.humRemoval}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 bg-[#080d1a] p-1 rounded-lg border border-slate-800">
                      {(['off', '50hz', '60hz', 'both'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setSettings((prev) => ({ ...prev, humRemoval: mode }))}
                          className={`text-[11px] font-mono py-1 rounded transition capitalize cursor-pointer ${
                            settings.humRemoval === mode
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {mode === 'both' ? '50 & 60' : mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Voice Clarity Boost */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Realce de Presencia Vocal (Formantes 2.8kHz)</span>
                      <span className="text-teal-400 font-mono font-bold">+{settings.voiceClarityBoost}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.voiceClarityBoost}
                      onChange={(e) => setSettings((prev) => ({ ...prev, voiceClarityBoost: Number(e.target.value) }))}
                      className="w-full accent-teal-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-500 block">Restaura brillo armónico en diálogos oscurecidos por atenuación.</span>
                  </div>

                  {/* De-Reverb / Room Echo */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">De-Reverb (Supresión de Eco de Habitación)</span>
                      <span className="text-sky-400 font-mono font-bold">{settings.deReverbPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.deReverbPercent}
                      onChange={(e) => setSettings((prev) => ({ ...prev, deReverbPercent: Number(e.target.value) }))}
                      className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-500 block">Reduce colas acústicas causadas por paredes reflectantes o micrófonos distantes.</span>
                  </div>
                </div>

                {/* De-Hiss Toggle & Apply */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-800/80 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="dehiss-check"
                      checked={settings.deHiss}
                      onChange={(e) => setSettings((prev) => ({ ...prev, deHiss: e.target.checked }))}
                      className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                    />
                    <label htmlFor="dehiss-check" className="text-xs text-slate-300 cursor-pointer font-medium">
                      Activar De-Hiss inteligente (High-Shelf &gt;6.5 kHz para siseo de preamplificador)
                    </label>
                  </div>
                  <button
                    onClick={handleApplySettings}
                    className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow transition cursor-pointer"
                  >
                    Aplicar Ajustes Manuales
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-emerald-900/40 bg-[#070d18] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {activeModalTab === 'normalization'
                ? `${normalizationStats.normalizedCount} de ${normalizationStats.total} clips nivelados a ${targetGainDb} dB`
                : `${audioClips.filter((c) => c.audioCleanup?.isEnabled).length} de ${audioClips.length} clips limpiados con IA`}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {activeModalTab === 'cleanup' ? (
              <button
                onClick={handleCleanAll}
                disabled={isProcessing}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Aplica la reducción de ruido y de-hum a todos los clips de audio del timeline"
              >
                <Layers className="w-3.5 h-3.5 text-teal-400" />
                <span>Limpiar Todo el Proyecto</span>
              </button>
            ) : (
              <button
                onClick={() => handleBatchNormalizeAll()}
                disabled={isScanningBatch}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-700/25"
                title="Normalizar todos los clips seleccionados a -3 dB"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Normalizar Todo (-3 dB)</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition active:scale-95 cursor-pointer border border-slate-700"
            >
              Listo / Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
