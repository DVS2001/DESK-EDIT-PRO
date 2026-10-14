import { useState, useCallback } from 'react';
import {
  TimelineClip,
  LumetriColorSettings,
  ColorMatchSettings,
  ColorMatchReference,
  ColorMatchResult,
} from '../types/editor';

export interface UseColorMatchReturn {
  isAnalyzing: boolean;
  isMatching: boolean;
  progress: number;
  currentStepMessage: string;
  lastResult: ColorMatchResult | null;
  error: string | null;
  matchColor: (
    targetClip: TimelineClip,
    reference: ColorMatchReference,
    settings?: Partial<ColorMatchSettings>
  ) => Promise<ColorMatchResult>;
  applyColorMatchToClip: (
    targetClip: TimelineClip,
    result: ColorMatchResult,
    customStrength?: number
  ) => TimelineClip;
  batchMatchClips: (
    clips: TimelineClip[],
    reference: ColorMatchReference,
    settings?: Partial<ColorMatchSettings>
  ) => Promise<TimelineClip[]>;
  exportCubeLut: (result: ColorMatchResult) => void;
  clearError: () => void;
}

export const DEFAULT_COLOR_MATCH_SETTINGS: ColorMatchSettings = {
  preserveSkinTones: true,
  matchStrength: 100,
  targetLumaMatch: true,
  chromaMatch: true,
  autoWhiteBalance: true,
};

export function useColorMatch(): UseColorMatchReturn {
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentStepMessage, setCurrentStepMessage] = useState<string>('');
  const [lastResult, setLastResult] = useState<ColorMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const matchColor = useCallback(
    async (
      targetClip: TimelineClip,
      reference: ColorMatchReference,
      settings?: Partial<ColorMatchSettings>
    ): Promise<ColorMatchResult> => {
      setIsAnalyzing(true);
      setIsMatching(true);
      setProgress(15);
      setError(null);
      setCurrentStepMessage('Analizando espacio de color y tonalidad de referencia...');

      const activeSettings: ColorMatchSettings = {
        ...DEFAULT_COLOR_MATCH_SETTINGS,
        ...settings,
      };

      try {
        await new Promise((resolve) => setTimeout(resolve, 180));
        setProgress(35);
        setCurrentStepMessage('Descomponiendo luminancia, balance de blancos y espectro cromático...');

        const currentLumetri: LumetriColorSettings = targetClip.lumetri || {
          exposure: 0,
          contrast: 0,
          highlights: 0,
          shadows: 0,
          temperature: 0,
          tint: 0,
          saturation: 100,
          vibrance: 0,
          lutPreset: 'none',
        };

        const res = await fetch('/api/ai/color-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetClipTitle: targetClip.title,
            targetCurrentLumetri: currentLumetri,
            reference: {
              id: reference.id,
              type: reference.type,
              title: reference.title,
              filmLookName: reference.filmLookName,
              thumbnailUrl: reference.thumbnailUrl,
              sourceDescription: reference.sourceDescription,
              imageBase64: reference.thumbnailUrl?.startsWith('data:') ? reference.thumbnailUrl : undefined,
            },
            settings: activeSettings,
          }),
        });

        setProgress(70);
        setCurrentStepMessage('Sintetizando ruedas de 3 vías (Lift/Gamma/Gain) y curvas Lumetri...');

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP error ${res.status}`);
        }

        const data = await res.json();
        const result: ColorMatchResult = data.result;

        setProgress(100);
        setCurrentStepMessage('¡Grado cromático emparejado con éxito!');
        setLastResult(result);

        return result;
      } catch (err: any) {
        console.error('Error during AI Color Match:', err);
        setError(err.message || 'Error al emparejar el color con IA');
        throw err;
      } finally {
        setIsAnalyzing(false);
        setIsMatching(false);
      }
    },
    []
  );

  const applyColorMatchToClip = useCallback(
    (
      targetClip: TimelineClip,
      result: ColorMatchResult,
      customStrength?: number
    ): TimelineClip => {
      const strength = customStrength !== undefined ? Math.max(0, Math.min(100, customStrength)) / 100 : 1;
      const original = result.originalLumetri || targetClip.lumetri || {
        exposure: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        temperature: 0,
        tint: 0,
        saturation: 100,
        vibrance: 0,
        lutPreset: 'none',
      };

      const matched = result.matchedLumetri;

      // Blend between original and matched according to strength
      const blendedLumetri: LumetriColorSettings = {
        exposure: Math.round(original.exposure + (matched.exposure - original.exposure) * strength),
        contrast: Math.round(original.contrast + (matched.contrast - original.contrast) * strength),
        highlights: Math.round(original.highlights + (matched.highlights - original.highlights) * strength),
        shadows: Math.round(original.shadows + (matched.shadows - original.shadows) * strength),
        temperature: Math.round(original.temperature + (matched.temperature - original.temperature) * strength),
        tint: Math.round(original.tint + (matched.tint - original.tint) * strength),
        saturation: Math.round(original.saturation + (matched.saturation - original.saturation) * strength),
        vibrance: Math.round(original.vibrance + (matched.vibrance - original.vibrance) * strength),
        lutPreset: strength > 0.3 ? matched.lutPreset : original.lutPreset,
      };

      return {
        ...targetClip,
        lumetri: blendedLumetri,
        colorMatchInfo: {
          isMatched: true,
          referenceSource: result.referenceTitle,
          matchedAt: Date.now(),
          lookName: result.lookName,
          matchStrength: Math.round(strength * 100),
          confidence: result.matchConfidence,
          palette: [
            result.dominantPalette.shadows,
            result.dominantPalette.midtones,
            result.dominantPalette.highlights,
            result.dominantPalette.accent,
          ],
        },
      };
    },
    []
  );

  const batchMatchClips = useCallback(
    async (
      clips: TimelineClip[],
      reference: ColorMatchReference,
      settings?: Partial<ColorMatchSettings>
    ): Promise<TimelineClip[]> => {
      const videoClips = clips.filter((c) => c.type === 'video');
      if (videoClips.length === 0) return clips;

      setIsAnalyzing(true);
      setIsMatching(true);
      setCurrentStepMessage(`Emparejando ${videoClips.length} clips con "${reference.title}"...`);

      const updatedMap = new Map<string, TimelineClip>();

      for (let i = 0; i < videoClips.length; i++) {
        const clip = videoClips[i];
        setProgress(Math.round(((i + 1) / videoClips.length) * 100));
        setCurrentStepMessage(`Graduando clip ${i + 1}/${videoClips.length}: "${clip.title}"...`);

        try {
          const res = await matchColor(clip, reference, settings);
          const updated = applyColorMatchToClip(clip, res, settings?.matchStrength);
          updatedMap.set(clip.id, updated);
        } catch {
          // Continue with next clip
        }
      }

      setIsAnalyzing(false);
      setIsMatching(false);
      return clips.map((c) => updatedMap.get(c.id) || c);
    },
    [matchColor, applyColorMatchToClip]
  );

  const exportCubeLut = useCallback((result: ColorMatchResult) => {
    // Generate a standardized DaVinci Resolve / Premiere Pro .CUBE 3D LUT file format
    const title = result.lookName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const lutSize = 17; // standard 17x17x17 compact 3D LUT
    let cubeContent = `# Adobe / DaVinci Resolve 3D LUT created by AI Studio Color Match\n`;
    cubeContent += `TITLE "${result.lookName}"\n`;
    cubeContent += `LUT_3D_SIZE ${lutSize}\n\n`;

    const lum = result.matchedLumetri;
    const tempK = (lum.temperature || 0) / 100;
    const sat = (lum.saturation || 100) / 100;
    const con = 1 + (lum.contrast || 0) / 150;
    const exp = Math.pow(2, (lum.exposure || 0) / 50);

    for (let b = 0; b < lutSize; b++) {
      for (let g = 0; g < lutSize; g++) {
        for (let r = 0; r < lutSize; r++) {
          let normR = r / (lutSize - 1);
          let normG = g / (lutSize - 1);
          let normB = b / (lutSize - 1);

          // Apply exposure
          normR *= exp;
          normG *= exp;
          normB *= exp;

          // Apply contrast S-curve
          normR = (normR - 0.5) * con + 0.5;
          normG = (normG - 0.5) * con + 0.5;
          normB = (normB - 0.5) * con + 0.5;

          // Apply color temperature
          if (tempK > 0) {
            normR *= 1 + tempK * 0.25;
            normB *= 1 - tempK * 0.2;
          } else {
            normR *= 1 - Math.abs(tempK) * 0.2;
            normB *= 1 + Math.abs(tempK) * 0.25;
          }

          // Apply saturation
          const luma = 0.2126 * normR + 0.7152 * normG + 0.0722 * normB;
          normR = luma + (normR - luma) * sat;
          normG = luma + (normG - luma) * sat;
          normB = luma + (normB - luma) * sat;

          // Clamp
          normR = Math.max(0, Math.min(1, normR));
          normG = Math.max(0, Math.min(1, normG));
          normB = Math.max(0, Math.min(1, normB));

          cubeContent += `${normR.toFixed(6)} ${normG.toFixed(6)} ${normB.toFixed(6)}\n`;
        }
      }
    }

    const blob = new Blob([cubeContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}_AI_ColorMatch.cube`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return {
    isAnalyzing,
    isMatching,
    progress,
    currentStepMessage,
    lastResult,
    error,
    matchColor,
    applyColorMatchToClip,
    batchMatchClips,
    exportCubeLut,
    clearError,
  };
}
