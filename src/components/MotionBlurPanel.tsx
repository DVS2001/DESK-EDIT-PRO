import React, { useState } from 'react';
import { 
  Wind, Sparkles, Sliders, Activity, Compass, 
  RotateCcw, Eye, EyeOff, Zap, ShieldCheck, Film, 
  ChevronRight, Gauge, Play, ArrowRight, CheckCircle2 
} from 'lucide-react';
import { TimelineClip, MotionBlurSettings, MotionBlurMode } from '../types/editor';
import { useMotionBlur } from '../hooks/useMotionBlur';

interface MotionBlurPanelProps {
  selectedClip: TimelineClip | null;
  onUpdateClipMotionBlur: (clipId: string, settings: MotionBlurSettings) => void;
  currentTime?: number;
}

const DEFAULT_SETTINGS: MotionBlurSettings = {
  isEnabled: false,
  shutterAngle: 180,
  sampleSteps: 16,
  blurAmount: 55,
  motionSensitivity: 40,
  blurMode: 'smart_auto',
  motionDirection: 15,
  velocityThreshold: 350,
  isBypassed: false,
};

export const MotionBlurPanel: React.FC<MotionBlurPanelProps> = ({
  selectedClip,
  onUpdateClipMotionBlur,
  currentTime = 0,
}) => {
  const { isAnalyzing, progress, statusMessage, detectMotionBlur, error } = useMotionBlur();
  const [selectedPreset, setSelectedPreset] = useState<string>('hollywood');

  if (!selectedClip) {
    return (
      <div className="p-4 text-center text-slate-400 space-y-2">
        <Wind className="w-8 h-8 mx-auto text-slate-600" />
        <p className="text-xs">Selecciona un clip en la línea de tiempo para ajustar el desenfoque de movimiento (Motion Blur).</p>
      </div>
    );
  }

  const settings: MotionBlurSettings = selectedClip.motionBlur || {
    ...DEFAULT_SETTINGS,
    isEnabled: false,
  };

  const updateSetting = <K extends keyof MotionBlurSettings>(
    key: K,
    value: MotionBlurSettings[K]
  ) => {
    const next: MotionBlurSettings = {
      ...settings,
      [key]: value,
    };
    onUpdateClipMotionBlur(selectedClip.id, next);
  };

  const handleRunAiDetection = async () => {
    const result = await detectMotionBlur(selectedClip, settings.shutterAngle || 180);
    if (result) {
      onUpdateClipMotionBlur(selectedClip.id, result.recommendedSettings);
    }
  };

  const handleApplyPreset = (presetName: string) => {
    setSelectedPreset(presetName);
    let preset: Partial<MotionBlurSettings> = {};

    switch (presetName) {
      case 'hollywood':
        preset = { shutterAngle: 180, blurAmount: 55, sampleSteps: 16, blurMode: 'smart_auto', motionSensitivity: 35 };
        break;
      case 'extreme_action':
        preset = { shutterAngle: 240, blurAmount: 75, sampleSteps: 24, blurMode: 'optical_flow', motionSensitivity: 25 };
        break;
      case 'whip_pan':
        preset = { shutterAngle: 320, blurAmount: 85, sampleSteps: 24, blurMode: 'directional', motionDirection: 0, motionSensitivity: 15 };
        break;
      case 'subtle_organic':
        preset = { shutterAngle: 120, blurAmount: 35, sampleSteps: 12, blurMode: 'smart_auto', motionSensitivity: 50 };
        break;
      case 'bullet_time':
        preset = { shutterAngle: 270, blurAmount: 80, sampleSteps: 32, blurMode: 'optical_flow', motionSensitivity: 20 };
        break;
    }

    const next: MotionBlurSettings = {
      ...settings,
      isEnabled: true,
      ...preset,
    };
    onUpdateClipMotionBlur(selectedClip.id, next);
  };

  // Compute current clip velocity multiplier
  const clipRelTime = Math.max(0, currentTime - selectedClip.startTime);
  const velocityEnvelope = selectedClip.velocityEnvelope || [];
  let currentVelocityMultiplier = 1.0;
  if (velocityEnvelope.length > 0) {
    const sorted = [...velocityEnvelope].sort((a, b) => a.timeOffset - b.timeOffset);
    const currPoint = sorted.filter((p) => p.timeOffset <= clipRelTime).pop();
    if (currPoint) currentVelocityMultiplier = currPoint.value;
  }

  return (
    <div className="space-y-3.5 text-xs select-none">
      {/* 1. Header Banner & Master Activation */}
      <div className="p-3 bg-gradient-to-br from-[#0c1829] via-[#091120] to-[#141b30] border border-sky-500/30 rounded-xl shadow-lg space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center border transition ${
              settings.isEnabled && !settings.isBypassed
                ? 'bg-sky-500/20 text-sky-400 border-sky-500/50 shadow-sm shadow-sky-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <Wind className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-[12px] flex items-center gap-1.5">
                <span>AI Motion Blur</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
                  Optical Flow
                </span>
              </h4>
              <p className="text-[10px] text-slate-400">
                Desenfoque cinemático con ángulo de obturador y submuestreo
              </p>
            </div>
          </div>

          {/* Master Switch */}
          <button
            onClick={() => updateSetting('isEnabled', !settings.isEnabled)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono transition cursor-pointer border flex items-center gap-1.5 ${
              settings.isEnabled
                ? 'bg-sky-500 text-white border-sky-400 shadow-sm shadow-sky-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${settings.isEnabled ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
            <span>{settings.isEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Clip Target & Velocity Meter Bar */}
        <div className="bg-black/40 border border-slate-800/80 rounded-lg p-2 flex items-center justify-between text-[10px] font-mono">
          <div className="flex items-center gap-1.5 truncate max-w-[170px]">
            <Film className="w-3 h-3 text-sky-400 flex-shrink-0" />
            <span className="text-slate-300 truncate font-semibold">{selectedClip.title}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Velocidad:</span>
            <span className={`font-bold flex items-center gap-1 ${
              currentVelocityMultiplier > 1.2
                ? 'text-amber-400'
                : currentVelocityMultiplier < 0.8
                ? 'text-sky-400'
                : 'text-emerald-400'
            }`}>
              <Gauge className="w-3 h-3" />
              <span>{currentVelocityMultiplier.toFixed(2)}x</span>
            </span>
          </div>
        </div>

        {/* Bypass Toggle */}
        {settings.isEnabled && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px]">
            <span className="text-slate-400">Comparación A/B (Bypass):</span>
            <button
              onClick={() => updateSetting('isBypassed', !settings.isBypassed)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer border ${
                settings.isBypassed
                  ? 'bg-amber-950/80 text-amber-300 border-amber-600/70'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {settings.isBypassed ? <EyeOff className="w-3 h-3 text-amber-400" /> : <Eye className="w-3 h-3 text-sky-400" />}
              <span>{settings.isBypassed ? 'Bypass Activo (Sin Blur)' : 'Efecto Visible'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. One-Click AI Detection with Gemini */}
      <div className="p-3 bg-[#0d1526] border border-sky-500/25 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-200 flex items-center gap-1.5 text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Detección de Movimiento IA</span>
          </span>
          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800">
            Gemini 3.8 Flash
          </span>
        </div>

        <p className="text-[10px] text-slate-400 leading-relaxed">
          Analiza aceleración de cuadros, vectores ópticos y calcula el ángulo de obturador óptimo para eliminar el estroboscopio.
        </p>

        {isAnalyzing && (
          <div className="space-y-1.5 py-1">
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] font-mono text-sky-300 animate-pulse text-center">
              {statusMessage || 'Calculando vectores de movimiento...'}
            </p>
          </div>
        )}

        {error && (
          <p className="text-[10px] text-rose-400 bg-rose-950/50 border border-rose-800 p-1.5 rounded">
            {error}
          </p>
        )}

        <button
          onClick={handleRunAiDetection}
          disabled={isAnalyzing}
          className="w-full py-2 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50 text-[11px]"
        >
          <Sparkles className="w-3.5 h-3.5 text-sky-200" />
          <span>{isAnalyzing ? 'Analizando con Gemini...' : 'Analizar y Aplicar Desenfoque IA'}</span>
        </button>

        {/* Last AI Analysis Result Card */}
        {settings.aiAnalysis && (
          <div className="mt-2.5 p-2.5 bg-black/50 border border-sky-500/30 rounded-lg space-y-2 text-[10px] font-mono">
            <div className="flex items-center justify-between text-slate-300 border-b border-slate-800 pb-1.5">
              <span className="flex items-center gap-1 text-sky-300 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Flujo Óptico Detectado</span>
              </span>
              <span className="text-amber-300 font-bold bg-amber-500/10 px-1 rounded border border-amber-500/30">
                {settings.aiAnalysis.detectedPeakVelocity} px/s
              </span>
            </div>

            <p className="text-[10px] text-slate-300 leading-tight font-sans">
              {settings.aiAnalysis.motionVectorSummary}
            </p>

            <div className="grid grid-cols-2 gap-1 text-[9px] pt-1">
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                <span className="text-slate-400 block">Tipo:</span>
                <strong className="text-white uppercase">{settings.aiAnalysis.primaryMovementType.replace(/_/g, ' ')}</strong>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
                <span className="text-slate-400 block">Obturador Óptimo:</span>
                <strong className="text-sky-300">{settings.aiAnalysis.recommendedShutterAngle}° ({settings.aiAnalysis.sampleSteps} Submuestras)</strong>
              </div>
            </div>

            {settings.aiAnalysis.detectedActionSegments?.length > 0 && (
              <div className="pt-1 space-y-1">
                <span className="text-[9px] text-slate-400 block">Segmentos de Alta Velocidad:</span>
                <div className="space-y-1">
                  {settings.aiAnalysis.detectedActionSegments.map((seg, i) => (
                    <div key={i} className="flex items-center justify-between bg-sky-950/40 border border-sky-500/20 px-2 py-0.5 rounded text-[9px]">
                      <span className="text-slate-200">{seg.label}</span>
                      <span className="text-sky-300">{seg.start}s - {seg.end}s</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Cinematic Presets */}
      <div className="space-y-1.5">
        <span className="font-semibold text-slate-300 block text-[11px]">Estilos &amp; Presets Cinemáticos</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => handleApplyPreset('hollywood')}
            className={`p-2 rounded text-left transition border ${
              selectedPreset === 'hollywood'
                ? 'bg-sky-500/20 text-sky-200 border-sky-500/60 font-bold'
                : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <span className="block text-[11px]">Hollywood 180° Rule</span>
            <span className="text-[9px] text-slate-400">180° Shutter • 16 Samples</span>
          </button>

          <button
            onClick={() => handleApplyPreset('extreme_action')}
            className={`p-2 rounded text-left transition border ${
              selectedPreset === 'extreme_action'
                ? 'bg-amber-500/20 text-amber-200 border-amber-500/60 font-bold'
                : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <span className="block text-[11px]">Extreme Action</span>
            <span className="text-[9px] text-slate-400">240° Shutter • 24 Samples</span>
          </button>

          <button
            onClick={() => handleApplyPreset('whip_pan')}
            className={`p-2 rounded text-left transition border ${
              selectedPreset === 'whip_pan'
                ? 'bg-purple-500/20 text-purple-200 border-purple-500/60 font-bold'
                : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <span className="block text-[11px]">Fast Whip Pan</span>
            <span className="text-[9px] text-slate-400">320° Shutter • Barrido 0°</span>
          </button>

          <button
            onClick={() => handleApplyPreset('bullet_time')}
            className={`p-2 rounded text-left transition border ${
              selectedPreset === 'bullet_time'
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/60 font-bold'
                : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <span className="block text-[11px]">Matrix Bullet-Time</span>
            <span className="text-[9px] text-slate-400">270° Shutter • 32 Samples</span>
          </button>
        </div>
      </div>

      {/* 4. Fine Controls (Shutter Angle, Blur Amount, Samples, Mode) */}
      <div className="p-3 bg-[#0d1424] border border-slate-800 rounded-xl space-y-3">
        <span className="font-semibold text-slate-200 block text-[11px]">Ajustes de Cámara &amp; Obturación</span>

        {/* Shutter Angle Slider */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-300">Ángulo de Obturador (Shutter Angle)</span>
            <span className="font-mono text-sky-400 font-bold">{settings.shutterAngle}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="5"
            value={settings.shutterAngle}
            onChange={(e) => updateSetting('shutterAngle', parseInt(e.target.value, 10))}
            className="w-full accent-sky-500 h-1.5 bg-slate-700 rounded cursor-pointer"
          />
          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span onClick={() => updateSetting('shutterAngle', 90)} className="cursor-pointer hover:text-sky-300">90° (Nítido)</span>
            <span onClick={() => updateSetting('shutterAngle', 180)} className="cursor-pointer text-sky-400 font-bold">180° (Cine 1/48s)</span>
            <span onClick={() => updateSetting('shutterAngle', 270)} className="cursor-pointer hover:text-sky-300">270°</span>
            <span onClick={() => updateSetting('shutterAngle', 360)} className="cursor-pointer hover:text-sky-300">360° (Máximo)</span>
          </div>
        </div>

        {/* Blur Amount Slider */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-300">Intensidad de Desenfoque</span>
            <span className="font-mono text-slate-300">{settings.blurAmount}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.blurAmount}
            onChange={(e) => updateSetting('blurAmount', parseInt(e.target.value, 10))}
            className="w-full accent-sky-500 h-1.5 bg-slate-700 rounded cursor-pointer"
          />
        </div>

        {/* Motion Sensitivity Threshold */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-300">Sensibilidad de Detección Dinámica</span>
            <span className="font-mono text-slate-300">{settings.motionSensitivity}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.motionSensitivity}
            onChange={(e) => updateSetting('motionSensitivity', parseInt(e.target.value, 10))}
            className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded cursor-pointer"
          />
          <p className="text-[9px] text-slate-500">
            Aplica desenfoque solo cuando la velocidad del movimiento supera el umbral de aceleración.
          </p>
        </div>

        {/* Sample Steps Selector */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-slate-300">Submuestras de Cuadro (Sample Steps)</span>
            <span className="font-mono text-sky-400">{settings.sampleSteps} Pasos</span>
          </div>
          <div className="grid grid-cols-5 gap-1 font-mono text-[10px]">
            {[8, 12, 16, 24, 32].map((s) => (
              <button
                key={s}
                onClick={() => updateSetting('sampleSteps', s)}
                className={`py-1 rounded text-center border transition ${
                  settings.sampleSteps === s
                    ? 'bg-sky-500/25 text-sky-300 border-sky-500 font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Blur Mode Selector */}
        <div className="space-y-1.5 pt-1">
          <span className="text-slate-300 block text-[11px]">Modo de Algoritmo Óptico</span>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'smart_auto', label: 'Smart Auto Flow', desc: 'Vectores IA' },
              { id: 'optical_flow', label: 'Optical Flow', desc: 'Flujo Vectorial Completo' },
              { id: 'directional', label: 'Direccional', desc: 'Barrido Lineal' },
              { id: 'rotational', label: 'Rotacional', desc: 'Giro Radial' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => updateSetting('blurMode', m.id as MotionBlurMode)}
                className={`p-1.5 rounded text-left border transition ${
                  settings.blurMode === m.id
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500 font-semibold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <span className="block text-[10px] leading-tight">{m.label}</span>
                <span className="text-[8px] text-slate-500 block">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Direction Angle Slider & Quick Angle compass */}
        {(settings.blurMode === 'directional' || settings.blurMode === 'smart_auto') && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-300">Ángulo del Vector de Movimiento</span>
              <span className="font-mono text-sky-300 font-bold">{settings.motionDirection}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={settings.motionDirection}
              onChange={(e) => updateSetting('motionDirection', parseInt(e.target.value, 10))}
              className="w-full accent-sky-500 h-1.5 bg-slate-700 rounded cursor-pointer"
            />
            <div className="flex justify-between text-[9px] font-mono text-slate-400">
              <button onClick={() => updateSetting('motionDirection', 0)} className="hover:text-white px-1">0° (Horizontal)</button>
              <button onClick={() => updateSetting('motionDirection', 45)} className="hover:text-white px-1">45°</button>
              <button onClick={() => updateSetting('motionDirection', 90)} className="hover:text-white px-1">90° (Vertical)</button>
              <button onClick={() => updateSetting('motionDirection', 180)} className="hover:text-white px-1">180°</button>
            </div>
          </div>
        )}
      </div>

      {/* Reset Button */}
      <button
        onClick={() => onUpdateClipMotionBlur(selectedClip.id, DEFAULT_SETTINGS)}
        className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded text-[10px] border border-slate-800 transition flex items-center justify-center gap-1 cursor-pointer"
      >
        <RotateCcw className="w-3 h-3" />
        <span>Restablecer Ajustes por Defecto</span>
      </button>
    </div>
  );
};
