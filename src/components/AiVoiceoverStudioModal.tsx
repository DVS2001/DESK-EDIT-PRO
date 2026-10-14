import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Mic, Volume2, Sparkles, Play, Pause, RotateCcw, 
  Sliders, Check, CheckCircle2, Download, Plus, Globe, 
  User, Gauge, Music, Radio, VolumeX, ArrowRight, FileText
} from 'lucide-react';
import { TimelineClip } from '../types/editor';

interface AiVoiceoverStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAudioClipToTimeline: (clip: TimelineClip) => void;
  currentTime?: number;
}

interface VoicePersona {
  id: string;
  name: string;
  role: string;
  gender: 'male' | 'female';
  tone: string;
  avatar: string;
  sampleText: string;
}

const VOICES: VoicePersona[] = [
  {
    id: 'marcus',
    name: 'Marcus Vance',
    role: 'Cinematic Baritone & Epic Trailers',
    gender: 'male',
    tone: 'Voz profunda, resonante, ideal para trailers, intros y suspenso',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    sampleText: 'En un mundo dominado por el silencio, una sola voz desafió el destino.',
  },
  {
    id: 'elena',
    name: 'Elena Rostova',
    role: 'Documental & Narración Cálida',
    gender: 'female',
    tone: 'Cálida, empática, dicción perfecta para documentales y podcasts',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    sampleText: 'A través de los valles del Himalaya, los glaciares guardan los secretos de milenios.',
  },
  {
    id: 'alex',
    name: 'Alex Rivera',
    role: 'Tech Keynote & Presentador',
    gender: 'male',
    tone: 'Seguro, visionario, ágil y moderno para lanzamientos de producto',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    sampleText: 'La inteligencia artificial está transformando fundamentalmente los flujos creativos.',
  },
  {
    id: 'sarah',
    name: 'Sarah Jenkins',
    role: 'Comercial & Publicidad Dinámica',
    gender: 'female',
    tone: 'Clara, persuasiva, enérgica y elegante para spots comerciales',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    sampleText: 'Descubre la nueva generación de tecnología diseñada para superar cualquier límite.',
  },
  {
    id: 'liam',
    name: 'Liam Sterling',
    role: 'British Nature & Narrativa Clásica',
    gender: 'male',
    tone: 'Acento británico refinado, reflexivo y de alta fidelidad',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
    sampleText: 'Here, in the uncharted wilderness, nature writes its most breathtaking chapters.',
  },
  {
    id: 'nova',
    name: 'Nova Sparks',
    role: 'Viral Shorts & TikTok Host',
    gender: 'female',
    tone: 'Alta energía, punchy, ritmo rápido para retención en redes sociales',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    sampleText: '¡Pausa el scroll! Estos son los tres trucos de edición que revolucionarán tus videos.',
  },
];

const TEMPLATES = [
  {
    title: 'Tech Keynote',
    text: 'Artificial intelligence is fundamentally revolutionizing creative workflows. With neural parallel rendering, editors can move ten times faster without sacrificing frame precision.',
  },
  {
    title: 'Trailer Épico',
    text: 'En un mundo al borde del colapso, una sola chispa encenderá la rebelión. Prepárate para presenciar la mayor batalla cinematográfica del año.',
  },
  {
    title: 'Viral Hook',
    text: '¡Espera, no pases este video! Si quieres que tus ediciones se vean como producciones de Hollywood en menos de 60 segundos, aplica este secreto ahora mismo.',
  },
  {
    title: 'Documental',
    text: 'A miles de metros sobre el nivel del mar, los picos nevados del monte Dhaulagiri desafían a los exploradores más audaces del planeta.',
  },
];

export const AiVoiceoverStudioModal: React.FC<AiVoiceoverStudioModalProps> = ({
  isOpen,
  onClose,
  onAddAudioClipToTimeline,
  currentTime = 0,
}) => {
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('marcus');
  const [language, setLanguage] = useState<string>('es-ES');
  const [tone, setTone] = useState<string>('cinematic');
  const [speed, setSpeed] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(0);
  const [scriptText, setScriptText] = useState<string>(TEMPLATES[0].text);
  const [masteringMode, setMasteringMode] = useState<string>('broadcast_master');

  // Generation & Audio playback state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedAudio, setGeneratedAudio] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playProgress, setPlayProgress] = useState<number>(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Generate simulated waveform data when script changes
  useEffect(() => {
    const wordCount = scriptText.trim().split(/\s+/).length;
    const peaks = Array.from({ length: 48 }).map((_, i) => {
      const base = Math.sin(i * 0.4) * 0.4 + 0.5;
      return Math.max(0.15, Math.min(1.0, base + (Math.random() * 0.3 - 0.15)));
    });
    setWaveformPeaks(peaks);
  }, [scriptText]);

  // Audio Playback simulation / HTML5 audio
  useEffect(() => {
    let animId: number;
    if (isPlaying && generatedAudio) {
      const totalDur = generatedAudio.duration || 5.0;
      const startTime = Date.now() - playProgress * totalDur * 1000;

      const tick = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const prog = Math.min(1.0, elapsed / totalDur);
        setPlayProgress(prog);

        if (prog >= 1.0) {
          setIsPlaying(false);
          setPlayProgress(0);
        } else {
          animId = requestAnimationFrame(tick);
        }
      };
      animId = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, generatedAudio]);

  if (!isOpen) return null;

  const selectedVoice = VOICES.find((v) => v.id === selectedVoiceId) || VOICES[0];
  const wordCount = scriptText.trim() ? scriptText.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Number(((wordCount / (2.2 * speed)) + 0.5).toFixed(1));

  const handleGenerateVoiceover = async () => {
    if (!scriptText.trim()) return;
    setIsGenerating(true);
    setAudioError(null);

    try {
      const res = await fetch('/api/ai/voiceover-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptText: scriptText.trim(),
          voiceId: selectedVoiceId,
          language,
          tone,
          speed,
          pitch,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al generar audio');
      }

      const data = await res.json();
      setGeneratedAudio(data.result);
      setPlayProgress(0);
      setIsPlaying(true);
    } catch (err: any) {
      setAudioError(err.message || 'Error en síntesis vocal.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInsertToTimeline = () => {
    if (!generatedAudio) return;

    const newClip: TimelineClip = {
      id: `clip-vo-${Date.now()}`,
      trackId: 'track-a1', // Master Dialogue & Voiceover track
      title: `VO: ${selectedVoice.name.split(' ')[0]} ("${scriptText.substring(0, 22)}...")`,
      type: 'audio',
      src: generatedAudio.audioUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
      thumbnail: selectedVoice.avatar,
      startTime: currentTime,
      duration: generatedAudio.duration || estimatedSeconds,
      offsetTime: 0,
      sourceDuration: generatedAudio.duration || estimatedSeconds,
      color: '#10b981', // Emerald Voiceover Color
      volumeEnvelope: [
        { id: `vo-v-1`, timeOffset: 0, value: 100 },
        { id: `vo-v-2`, timeOffset: generatedAudio.duration, value: 100 },
      ],
      opacityEnvelope: [],
      velocityEnvelope: [],
      panCrop: { zoom: 1, panX: 0, panY: 0, rotation: 0 },
      lumetri: {
        exposure: 0, contrast: 0, highlights: 0, shadows: 0,
        temperature: 0, tint: 0, saturation: 100, vibrance: 0, lutPreset: 'none',
      },
      audioGain: 0,
      transcript: generatedAudio.words || [],
      audioCleanup: {
        isEnabled: true,
        reductionDb: -24,
        noiseReductionPercent: 95,
        humRemoval: 'off',
        deHiss: true,
        deReverbPercent: 40,
        voiceClarityBoost: 80,
        detectedNoiseType: 'Studio Clean TTS Master',
        noiseFloorDb: -62.0,
        targetNoiseFloorDb: -65.0,
        snrImprovementDb: 28.0,
        spectralConfidence: 0.99,
        isBypassed: false,
      },
    };

    onAddAudioClipToTimeline(newClip);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-[#0b101c] border border-emerald-500/30 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl shadow-emerald-950/40 overflow-hidden text-slate-100">
        {/* 1. Modal Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-[#0d1f2d] via-[#091522] to-[#121c2e] border-b border-[#1b2a40] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-emerald-400">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-white tracking-wide">
                  AI Voiceover Studio
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  Gemini TTS &bull; Neural Speech
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Generación de locución profesional multilingüe con control de tono, ritmo y masterización de estudio
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Modal Body Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column (5 cols): Voice Personas & Language */}
          <div className="lg:col-span-5 space-y-4">
            {/* Language & Tone selectors */}
            <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-emerald-400" />
                    <span>Idioma / Acento</span>
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="es-ES">Español (Castellano / Neutro)</option>
                    <option value="es-MX">Español (Latinoamérica)</option>
                    <option value="en-US">English (United States)</option>
                    <option value="en-GB">English (British UK)</option>
                    <option value="fr-FR">Français (France)</option>
                    <option value="de-DE">Deutsch (Germany)</option>
                    <option value="ja-JP">日本語 (Japanese)</option>
                    <option value="pt-BR">Português (Brasil)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Inflección Vocal</span>
                  </label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="cinematic">Cinemático &amp; Autoritario</option>
                    <option value="warm">Cálido &amp; Conversacional</option>
                    <option value="viral">Enérgico &amp; Viral (TikTok/Shorts)</option>
                    <option value="dramatic">Dramático &amp; Tensión</option>
                    <option value="whisper">Íntimo &amp; Susurrado</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Voice Persona List */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-300 uppercase font-mono tracking-wider flex items-center justify-between">
                <span>Personajes Vocales ({VOICES.length})</span>
                <span className="text-emerald-400 font-mono text-[10px]">100% Neural 48kHz</span>
              </span>

              <div className="space-y-1.5 max-h-[290px] overflow-y-auto pr-1">
                {VOICES.map((voice) => {
                  const isSelected = selectedVoiceId === voice.id;
                  return (
                    <div
                      key={voice.id}
                      onClick={() => {
                        setSelectedVoiceId(voice.id);
                        if (!scriptText.trim()) setScriptText(voice.sampleText);
                      }}
                      className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center gap-3 ${
                        isSelected
                          ? 'bg-emerald-950/60 border-emerald-500/80 shadow-md shadow-emerald-950/30 ring-1 ring-emerald-500/40'
                          : 'bg-[#0f1728] border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <img
                        src={voice.avatar}
                        alt={voice.name}
                        className="w-10 h-10 rounded-full object-cover border border-emerald-500/40 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-200 text-xs truncate">{voice.name}</span>
                          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/20">
                            {voice.gender === 'male' ? 'MASCULINO' : 'FEMENINO'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 font-medium truncate">{voice.role}</p>
                        <p className="text-[9px] text-slate-400 truncate">{voice.tone}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Speed & Pitch Controls */}
            <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-3 space-y-3">
              {/* Speed Slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-300 font-medium flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Velocidad de Lectura</span>
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">{speed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.6"
                  step="0.05"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-700 rounded cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-400">
                  <button onClick={() => setSpeed(0.85)} className="hover:text-emerald-300">0.85x Lento</button>
                  <button onClick={() => setSpeed(1.0)} className="hover:text-emerald-300 font-bold text-white">1.0x Normal</button>
                  <button onClick={() => setSpeed(1.15)} className="hover:text-emerald-300">1.15x Ágil</button>
                  <button onClick={() => setSpeed(1.35)} className="hover:text-emerald-300">1.35x Rápido</button>
                </div>
              </div>

              {/* Pitch Slider */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-300 font-medium flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Modulación de Tono (Pitch)</span>
                  </span>
                  <span className="font-mono text-emerald-400 font-bold">{pitch > 0 ? `+${pitch}` : pitch}%</span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="1"
                  value={pitch}
                  onChange={(e) => setPitch(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-700 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Right Column (7 cols): Script Textarea, Audio Waveform & Preview */}
          <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
            {/* Script Text Input */}
            <div className="space-y-2 flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300 uppercase font-mono flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Guión de la Locución</span>
                </label>

                {/* Templates chip list */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500 mr-1 hidden sm:inline">Plantillas:</span>
                  {TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      onClick={() => setScriptText(tmpl.text)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-mono transition border border-slate-700"
                    >
                      {tmpl.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative flex-1 min-h-[140px]">
                <textarea
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  placeholder="Escribe o pega aquí el guión que deseas que la voz de IA locute..."
                  className="w-full h-full min-h-[140px] bg-[#070b14] border border-slate-700/80 rounded-xl p-3.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 leading-relaxed resize-none shadow-inner"
                />
                <div className="absolute bottom-2.5 right-3 flex items-center gap-3 text-[10px] font-mono text-slate-400 pointer-events-none bg-black/60 px-2 py-0.5 rounded">
                  <span>{wordCount} palabras</span>
                  <span>&bull;</span>
                  <span className="text-emerald-300 font-bold">~{estimatedSeconds}s estimado</span>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateVoiceover}
              disabled={isGenerating || !scriptText.trim()}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 transition active:scale-95 cursor-pointer disabled:opacity-50 text-xs tracking-wide"
            >
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>{isGenerating ? 'Generando Síntesis Neural con Gemini...' : 'Sintetizar Locución con IA (TTS)'}</span>
            </button>

            {/* Generated Audio Preview Player Card */}
            {generatedAudio ? (
              <div className="p-3.5 bg-[#08101a] border border-emerald-500/40 rounded-xl space-y-3 shadow-xl animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={selectedVoice.avatar}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border border-emerald-400"
                    />
                    <div>
                      <h4 className="font-bold text-white text-xs leading-tight">
                        Locución Lista: {selectedVoice.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {generatedAudio.duration}s &bull; {generatedAudio.words?.length || wordCount} palabras sincronizadas
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="w-8 h-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center transition shadow-md cursor-pointer"
                    >
                      {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
                    </button>
                  </div>
                </div>

                {/* Simulated Audio Waveform Bar */}
                <div className="h-10 bg-black/50 border border-slate-800 rounded-lg px-2 flex items-center justify-between gap-1 overflow-hidden relative">
                  {waveformPeaks.map((peak, idx) => {
                    const progressRatio = idx / waveformPeaks.length;
                    const hasPlayed = progressRatio <= playProgress;
                    return (
                      <div
                        key={idx}
                        style={{ height: `${Math.max(15, peak * 85)}%` }}
                        className={`w-1 rounded-full transition-colors ${
                          hasPlayed
                            ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.7)]'
                            : 'bg-emerald-950 border border-emerald-900/60'
                        }`}
                      />
                    );
                  })}
                  {/* Playhead line */}
                  <div
                    style={{ left: `${playProgress * 100}%` }}
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-sm pointer-events-none"
                  />
                </div>

                {/* Director Notes */}
                {generatedAudio.directorNotes && (
                  <p className="text-[10px] text-slate-300 font-sans italic bg-emerald-950/30 p-2 rounded border border-emerald-500/20">
                    &quot;{generatedAudio.directorNotes}&quot;
                  </p>
                )}

                {/* Insert to Timeline Button */}
                <button
                  onClick={handleInsertToTimeline}
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold rounded-lg flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Insertar en Línea de Tiempo (Pista A1 - Voz)</span>
                </button>
              </div>
            ) : (
              <div className="p-3 bg-black/30 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-[11px] py-4">
                Presiona &quot;Sintetizar Locución con IA&quot; para previsualizar y afinar la pista antes de añadirla a la línea de tiempo.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
