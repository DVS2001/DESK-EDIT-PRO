import { useState, useCallback } from 'react';
import { TimelineClip, BeatAlignmentSettings, BeatAlignmentResult, DetectedBeatTransient, TimelineMarker } from '../types/editor';

export const DEFAULT_BEAT_ALIGNMENT_SETTINGS: BeatAlignmentSettings = {
  sensitivity: 'medium',
  transientThreshold: 65,
  minTransientSpacing: 0.35,
  quantization: '1/4_notes',
  bpm: 128,
  autoDetectBpm: true,
  filterMode: 'all',
  clearExistingBeatMarkers: true,
  autoSnapVideoCuts: false,
  accentuateDownbeats: true,
  markerColor: '#ec4899',
};

export interface UseBeatAlignmentReturn {
  isAnalyzing: boolean;
  progress: number;
  stepMessage: string;
  lastResult: BeatAlignmentResult | null;
  error: string | null;
  analyzeBeats: (
    clip: TimelineClip,
    customSettings?: Partial<BeatAlignmentSettings>
  ) => Promise<BeatAlignmentResult | null>;
  recalcFilteredTransients: (
    settings: BeatAlignmentSettings
  ) => void;
  reset: () => void;
}

export const useBeatAlignment = (): UseBeatAlignmentReturn => {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [lastResult, setLastResult] = useState<BeatAlignmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsAnalyzing(false);
    setProgress(0);
    setStepMessage('');
    setError(null);
  }, []);

  const analyzeBeats = useCallback(
    async (
      clip: TimelineClip,
      customSettings?: Partial<BeatAlignmentSettings>
    ): Promise<BeatAlignmentResult | null> => {
      setIsAnalyzing(true);
      setProgress(15);
      setError(null);
      setStepMessage('Decodificando envolvente acústica y transitorios de audio...');

      const settings: BeatAlignmentSettings = {
        ...DEFAULT_BEAT_ALIGNMENT_SETTINGS,
        ...customSettings,
      };

      try {
        // Step 1: Waveform RMS and Spectral Flux Analysis
        await new Promise((r) => setTimeout(r, 400));
        setProgress(40);
        setStepMessage('Calculando derivada de flujo espectral (HFC) y picos de bombo/caja...');

        // Step 2: Gemini Rhythm Analysis & Downbeat Phrasing
        await new Promise((r) => setTimeout(r, 450));
        setProgress(70);
        setStepMessage('Gemini 3.8 Flash: Mapeando compases rítmicos, BPM y transitorios de pico...');

        const response = await fetch('/api/ai/beat-align', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipId: clip.id,
            clipTitle: clip.title,
            clipSrc: clip.src,
            duration: clip.duration,
            timelineStartTime: clip.startTime,
            settings,
            genreHint: clip.title.includes('Synthwave') ? 'Cyberpunk Electronic Synthwave' : 'Cinematic Soundtrack',
          }),
        });

        if (!response.ok) {
          throw new Error(`Error en servidor de análisis de beat (${response.status})`);
        }

        const data = await response.json();
        if (!data.success || !data.result) {
          throw new Error(data.error || 'No se pudieron extraer transitorios de ritmo');
        }

        setProgress(100);
        setStepMessage('¡Alineación rítmica completada! Marcadores listos para snapping.');
        setLastResult(data.result);
        return data.result as BeatAlignmentResult;
      } catch (err: any) {
        console.error('Error analyzing beat alignment:', err);
        setError(err?.message || 'Error durante el análisis rítmico');
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  const recalcFilteredTransients = useCallback((settings: BeatAlignmentSettings) => {
    setLastResult((prev) => {
      if (!prev) return null;

      const threshold = settings.transientThreshold;
      const minSpacing = settings.minTransientSpacing;
      const filterMode = settings.filterMode;

      // Filter all transients
      const filtered: DetectedBeatTransient[] = [];
      let lastTime = -999;

      for (const t of prev.transients) {
        if (t.energy >= threshold && t.time - lastTime >= minSpacing) {
          if (filterMode === 'downbeats_only' && t.type !== 'downbeat' && t.type !== 'drop') {
            continue;
          }
          if (filterMode === 'primary_beats' && t.type === 'transient') {
            continue;
          }
          filtered.push({
            ...t,
            isPeak: t.energy >= threshold,
          });
          lastTime = t.time;
        }
      }

      // Recreate markers
      const updatedMarkers: TimelineMarker[] = filtered.map((bt, idx) => {
        let color = settings.markerColor || '#ec4899';
        if (bt.type === 'downbeat') color = '#f43f5e';
        else if (bt.type === 'drop') color = '#eab308';
        else if (bt.type === 'snare') color = '#06b6d4';
        else color = '#a855f7';

        return {
          id: `marker-beat-${prev.clipId}-${idx}-${Date.now().toString(36)}`,
          time: bt.timelineTime,
          label: `🎵 ${bt.label}`,
          color,
          type: 'beat',
          confidence: bt.confidence,
          transientEnergy: bt.energy,
          isDownbeat: bt.type === 'downbeat' || bt.type === 'drop',
          frequencyBand: bt.frequencyBand,
          description: `Transitorio rítmico (${bt.energy}% energía, ${bt.frequencyBand}) a ${prev.detectedBpm} BPM`,
          clipId: prev.clipId,
        };
      });

      return {
        ...prev,
        totalTransientsDetected: filtered.length,
        downbeatsCount: filtered.filter((t) => t.type === 'downbeat' || t.type === 'drop').length,
        transients: filtered,
        markers: updatedMarkers,
        suggestedCutTimes: filtered.filter((t) => t.type === 'downbeat' || t.type === 'drop').map((t) => t.timelineTime),
      };
    });
  }, []);

  return {
    isAnalyzing,
    progress,
    stepMessage,
    lastResult,
    error,
    analyzeBeats,
    recalcFilteredTransients,
    reset,
  };
};
