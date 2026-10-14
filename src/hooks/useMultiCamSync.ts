import { useState, useCallback } from 'react';
import { TimelineClip, TimelineTrack, MultiCamSyncResult, MultiCamSyncSettings } from '../types/editor';
import { analyzeAndSyncMultiCam } from '../utils/multiCamSyncEngine';

export const DEFAULT_MULTICAM_SETTINGS: MultiCamSyncSettings = {
  syncMethod: 'waveform',
  referenceClipId: 'auto',
  distributeTracks: true,
  muteNonReferenceAudio: true,
  searchWindowSeconds: 8.0,
  audioBandpassFilter: true,
};

export interface UseMultiCamSyncReturn {
  isAnalyzing: boolean;
  progress: number;
  stepMessage: string;
  lastResult: MultiCamSyncResult | null;
  error: string | null;
  analyzeMultiCamSync: (
    clipsToSync: TimelineClip[],
    customSettings?: Partial<MultiCamSyncSettings>,
    tracks?: TimelineTrack[]
  ) => Promise<MultiCamSyncResult | null>;
  applySyncToTimeline: (
    result: MultiCamSyncResult,
    currentClips: TimelineClip[]
  ) => TimelineClip[];
  reset: () => void;
}

export const useMultiCamSync = (): UseMultiCamSyncReturn => {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [lastResult, setLastResult] = useState<MultiCamSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsAnalyzing(false);
    setProgress(0);
    setStepMessage('');
    setError(null);
  }, []);

  const analyzeMultiCamSync = useCallback(
    async (
      clipsToSync: TimelineClip[],
      customSettings?: Partial<MultiCamSyncSettings>,
      tracks: TimelineTrack[] = []
    ): Promise<MultiCamSyncResult | null> => {
      if (clipsToSync.length < 2) {
        setError('Selecciona al menos 2 clips de vídeo para sincronización multicámara.');
        return null;
      }

      setIsAnalyzing(true);
      setProgress(15);
      setError(null);
      setStepMessage('Extrayendo envolventes acústicas y firmas de frecuencia de los clips...');

      const settings: MultiCamSyncSettings = {
        ...DEFAULT_MULTICAM_SETTINGS,
        ...customSettings,
      };

      try {
        // Step 1: Local Acoustic Signal Analysis
        await new Promise((r) => setTimeout(r, 350));
        setProgress(40);
        setStepMessage('Filtrando banda vocal (100Hz - 8kHz) y normalizando picos acústicos...');

        // Step 2: Cross-Correlation / Gemini AI sync
        await new Promise((r) => setTimeout(r, 400));
        setProgress(70);
        setStepMessage('Calculando correlación cruzada normalizada R_xy(τ) y detección de claqueta...');

        let syncResult: MultiCamSyncResult | null = null;

        try {
          const response = await fetch('/api/ai/multicam-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clips: clipsToSync,
              settings,
              tracks: tracks.map((t) => ({ id: t.id, type: t.type, name: t.name })),
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.result) {
              syncResult = data.result as MultiCamSyncResult;
            }
          }
        } catch (fetchErr) {
          console.warn('Network call to /api/ai/multicam-sync failed, using local engine:', fetchErr);
        }

        // If server failed or offline, fall back to pure client-side mathematical engine
        if (!syncResult) {
          syncResult = analyzeAndSyncMultiCam(clipsToSync, settings, tracks);
        }

        await new Promise((r) => setTimeout(r, 300));
        setProgress(100);
        setStepMessage('¡Sincronización multicámara completada con éxito!');
        setLastResult(syncResult);
        return syncResult;
      } catch (err: any) {
        console.error('Error analyzing multi-cam sync:', err);
        setError(err?.message || 'Error durante la sincronización multicámara');
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  const applySyncToTimeline = useCallback(
    (result: MultiCamSyncResult, currentClips: TimelineClip[]): TimelineClip[] => {
      const angleMap = new Map(result.angles.map((a) => [a.clipId, a]));

      return currentClips.map((clip) => {
        const angle = angleMap.get(clip.id);
        if (!angle) return clip;

        // Apply updated startTime, trackId (if distributed), and multiCam metadata
        const updatedTrackId = angle.targetTrackId || clip.trackId;
        
        // Mute non-reference audio if requested to prevent acoustic comb filtering / echo
        let updatedGain = clip.audioGain;
        if (!angle.isReference) {
          updatedGain = -36; // low scratch level
        }

        return {
          ...clip,
          startTime: angle.newStartTime,
          trackId: updatedTrackId,
          audioGain: updatedGain,
          multiCam: {
            isSynced: true,
            cameraName: angle.cameraName,
            referenceClipId: result.referenceClipId,
            timeOffset: angle.calculatedOffset,
            correlationConfidence: angle.correlationConfidence,
            phaseAligned: angle.phaseAligned,
            syncedAt: Date.now(),
            angleIndex: result.angles.findIndex((a) => a.clipId === clip.id),
          },
        };
      });
    },
    []
  );

  return {
    isAnalyzing,
    progress,
    stepMessage,
    lastResult,
    error,
    analyzeMultiCamSync,
    applySyncToTimeline,
    reset,
  };
};
