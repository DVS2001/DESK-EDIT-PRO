import { useState, useCallback } from 'react';
import { TimelineClip, SceneSplitterSettings, SceneSplitterResult } from '../types/editor';

export const DEFAULT_SCENE_SPLITTER_SETTINGS: SceneSplitterSettings = {
  sensitivity: 'medium',
  minSceneDuration: 1.5,
  detectTransitions: true,
  autoPlaceMarkers: true,
  autoSplitClips: false,
};

export interface UseSceneSplitterReturn {
  isAnalyzing: boolean;
  progress: number;
  stepMessage: string;
  lastResult: SceneSplitterResult | null;
  error: string | null;
  analyzeScenes: (
    clip: TimelineClip,
    customSettings?: Partial<SceneSplitterSettings>
  ) => Promise<SceneSplitterResult | null>;
  reset: () => void;
}

export const useSceneSplitter = (): UseSceneSplitterReturn => {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [lastResult, setLastResult] = useState<SceneSplitterResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsAnalyzing(false);
    setProgress(0);
    setStepMessage('');
    setError(null);
  }, []);

  const analyzeScenes = useCallback(
    async (
      clip: TimelineClip,
      customSettings?: Partial<SceneSplitterSettings>
    ): Promise<SceneSplitterResult | null> => {
      setIsAnalyzing(true);
      setProgress(15);
      setError(null);
      setStepMessage('Extrayendo fotogramas ópticos y metadatos de la toma...');

      const settings: SceneSplitterSettings = {
        ...DEFAULT_SCENE_SPLITTER_SETTINGS,
        ...customSettings,
      };

      try {
        // Step 1: Simulated Frame Analysis Phase
        await new Promise((r) => setTimeout(r, 450));
        setProgress(35);
        setStepMessage('Evaluando histograma de luminancia y flujo óptico...');

        // Step 2: Gemini Neural Scene Boundary Recognition
        await new Promise((r) => setTimeout(r, 400));
        setProgress(65);
        setStepMessage('Gemini 3.8 Flash: Detectando cortes de cámara y cambios narrativos...');

        const transcriptText = clip.transcript?.map((w) => w.word).join(' ') || '';

        const response = await fetch('/api/ai/scene-splitter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipId: clip.id,
            clipTitle: clip.title,
            clipSrc: clip.src,
            duration: clip.duration,
            timelineStartTime: clip.startTime,
            settings,
            transcriptText,
          }),
        });

        setProgress(85);
        setStepMessage('Sintetizando marcadores de corte y catálogo de tomas...');

        if (!response.ok) {
          throw new Error(`Error en el servidor: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.success || !data.result) {
          throw new Error(data.error || 'No se pudo obtener el análisis de escenas');
        }

        setProgress(100);
        setStepMessage('¡Detección de escenas completada!');
        setLastResult(data.result);

        return data.result as SceneSplitterResult;
      } catch (err: any) {
        console.error('Error during scene splitting:', err);
        setError(err.message || 'Error inesperado durante la detección de escenas');
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  return {
    isAnalyzing,
    progress,
    stepMessage,
    lastResult,
    error,
    analyzeScenes,
    reset,
  };
};
