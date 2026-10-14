import { useState, useCallback } from 'react';
import { TimelineClip, TransitionSuggestResult } from '../types/editor';

export interface UseTransitionSuggestReturn {
  isAnalyzing: boolean;
  progress: number;
  stepMessage: string;
  lastResult: TransitionSuggestResult | null;
  error: string | null;
  analyzeTransition: (
    clipA: TimelineClip,
    clipB: TimelineClip,
    stylePreference?: 'cinematic' | 'dynamic' | 'subtle' | 'modern'
  ) => Promise<TransitionSuggestResult | null>;
  reset: () => void;
}

export const useTransitionSuggest = (): UseTransitionSuggestReturn => {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [stepMessage, setStepMessage] = useState<string>('');
  const [lastResult, setLastResult] = useState<TransitionSuggestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsAnalyzing(false);
    setProgress(0);
    setStepMessage('');
    setError(null);
  }, []);

  const analyzeTransition = useCallback(
    async (
      clipA: TimelineClip,
      clipB: TimelineClip,
      stylePreference: 'cinematic' | 'dynamic' | 'subtle' | 'modern' = 'cinematic'
    ): Promise<TransitionSuggestResult | null> => {
      setIsAnalyzing(true);
      setProgress(15);
      setError(null);
      setStepMessage(`Analizando yuxtaposición entre "${clipA.title}" y "${clipB.title}"...`);

      try {
        await new Promise((r) => setTimeout(r, 350));
        setProgress(40);
        setStepMessage('Calculando similitud cromática, vectores de movimiento y continuidad luminosa...');

        const transcriptA = clipA.transcript?.map((w) => w.word).join(' ') || '';
        const transcriptB = clipB.transcript?.map((w) => w.word).join(' ') || '';

        const cutTime = Number(clipA.startTime + clipA.duration);

        const response = await fetch('/api/ai/transition-suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clipA: {
              id: clipA.id,
              title: clipA.title,
              type: clipA.type,
              src: clipA.src,
              thumbnail: clipA.thumbnail,
              trackId: clipA.trackId,
              startTime: clipA.startTime,
              duration: clipA.duration,
              endTime: cutTime,
              lumetri: clipA.lumetri,
              transcriptText: transcriptA,
            },
            clipB: {
              id: clipB.id,
              title: clipB.title,
              type: clipB.type,
              src: clipB.src,
              thumbnail: clipB.thumbnail,
              trackId: clipB.trackId,
              startTime: clipB.startTime,
              duration: clipB.duration,
              endTime: Number(clipB.startTime + clipB.duration),
              lumetri: clipB.lumetri,
              transcriptText: transcriptB,
            },
            cutPointTime: cutTime,
            stylePreference,
          }),
        });

        setProgress(75);
        setStepMessage('Sintetizando recomendaciones de transiciones con Gemini 3.8 Flash...');

        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}: Error al obtener recomendaciones de transición`);
        }

        const data = await response.json();
        if (!data.success || !data.result) {
          throw new Error(data.error || 'No se recibieron resultados válidos del analizador.');
        }

        setProgress(100);
        setStepMessage('¡Análisis completado! Transición óptima recomendada.');
        setLastResult(data.result);
        setIsAnalyzing(false);
        return data.result as TransitionSuggestResult;
      } catch (err: any) {
        console.error('Error en useTransitionSuggest:', err);
        setError(err.message || 'Error desconocido al analizar transición.');
        setIsAnalyzing(false);
        return null;
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
    analyzeTransition,
    reset,
  };
};
