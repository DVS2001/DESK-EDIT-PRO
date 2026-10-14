import { useState, useCallback } from 'react';
import { TimelineClip, MotionBlurAnalysis, MotionBlurSettings } from '../types/editor';

export interface UseMotionBlurReturn {
  isAnalyzing: boolean;
  progress: number;
  statusMessage: string;
  lastAnalysis: MotionBlurAnalysis | null;
  error: string | null;
  detectMotionBlur: (
    clip: TimelineClip,
    shutterPreference?: number
  ) => Promise<{ analysis: MotionBlurAnalysis; recommendedSettings: MotionBlurSettings } | null>;
  reset: () => void;
}

export const useMotionBlur = (): UseMotionBlurReturn => {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [lastAnalysis, setLastAnalysis] = useState<MotionBlurAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setIsAnalyzing(false);
    setProgress(0);
    setStatusMessage('');
    setError(null);
  }, []);

  const detectMotionBlur = useCallback(
    async (
      clip: TimelineClip,
      shutterPreference: number = 180
    ): Promise<{ analysis: MotionBlurAnalysis; recommendedSettings: MotionBlurSettings } | null> => {
      setIsAnalyzing(true);
      setProgress(15);
      setError(null);
      setStatusMessage(`Iniciando análisis óptico de movimiento en "${clip.title}"...`);

      try {
        await new Promise((r) => setTimeout(r, 250));
        setProgress(45);
        setStatusMessage('Calculando vectores de flujo óptico, aceleración y picos de velocidad con Gemini 3.8 Flash...');

        const response = await fetch('/api/ai/motion-blur-detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clip: {
              id: clip.id,
              title: clip.title,
              type: clip.type,
              duration: clip.duration,
              src: clip.src,
              velocityEnvelope: clip.velocityEnvelope,
              panCrop: clip.panCrop,
              motionKeyframes: clip.motionKeyframes,
            },
            shutterPreference,
          }),
        });

        if (!response.ok) {
          throw new Error(`Error en el servidor: ${response.statusText}`);
        }

        setProgress(85);
        setStatusMessage('Generando mapa de submuestreo de obturador y curvatura de desenfoque cinemático...');
        await new Promise((r) => setTimeout(r, 200));

        const data = await response.json();
        const analysis: MotionBlurAnalysis = data.analysis;

        const recommendedSettings: MotionBlurSettings = {
          isEnabled: true,
          shutterAngle: analysis.recommendedShutterAngle || 180,
          sampleSteps: analysis.sampleSteps || 16,
          blurAmount: analysis.recommendedBlurAmount || 60,
          motionSensitivity: 45,
          blurMode: 'smart_auto',
          motionDirection: analysis.motionDirectionAngle || 0,
          velocityThreshold: Math.round((analysis.detectedPeakVelocity || 600) * 0.4),
          isBypassed: false,
          aiAnalysis: analysis,
        };

        setProgress(100);
        setStatusMessage('Desenfoque cinemático de movimiento calculado con éxito.');
        setLastAnalysis(analysis);

        return { analysis, recommendedSettings };
      } catch (err: any) {
        console.error('Error analyzing motion blur:', err);
        setError(err.message || 'Error analizando desenfoque de movimiento');
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
    statusMessage,
    lastAnalysis,
    error,
    detectMotionBlur,
    reset,
  };
};
