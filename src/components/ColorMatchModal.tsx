import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Palette,
  CheckCircle2,
  Sliders,
  Upload,
  Film,
  Download,
  Layers,
  ArrowRight,
  Eye,
  RefreshCw,
  Zap,
  Info,
  ShieldCheck,
  Split,
  Maximize2,
} from 'lucide-react';
import {
  TimelineClip,
  LumetriColorSettings,
  ColorMatchReference,
  ColorMatchResult,
  ColorMatchSettings,
  MediaAsset,
} from '../types/editor';
import { useColorMatch, DEFAULT_COLOR_MATCH_SETTINGS } from '../hooks/useColorMatch';

interface ColorMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  clips: TimelineClip[];
  mediaAssets?: MediaAsset[];
  selectedClipId: string | null;
  onUpdateClipLumetri: (clipId: string, settings: LumetriColorSettings) => void;
  onUpdateClip: (clip: TimelineClip) => void;
  onBatchUpdateClips?: (clips: TimelineClip[]) => void;
}

// Preset Cinematic References
const CINEMATIC_REFERENCE_PRESETS: ColorMatchReference[] = [
  {
    id: 'preset-dune',
    type: 'preset',
    title: 'Dune: Arrakis Golden Sand & Cyan Shadows',
    filmLookName: 'Dune Desert Gold',
    category: 'Cinematic Blockbuster',
    sourceDescription: 'Warm desert golden highlights with rich sub-surface cyan darks',
    thumbnailUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=600&q=80',
    dominantColors: ['#0f1c24', '#b87333', '#f3c98b', '#2a9d8f'],
  },
  {
    id: 'preset-blade-runner',
    type: 'preset',
    title: 'Blade Runner 2049: Neon Cyberpunk & Indigo',
    filmLookName: 'Cyberpunk Neon Indigo',
    category: 'Sci-Fi Dystopia',
    sourceDescription: 'Deep crushed blacks, glowing cyan neon matrix and hot magenta highlights',
    thumbnailUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=600&q=80',
    dominantColors: ['#090514', '#00b4d8', '#ff007f', '#7209b7'],
  },
  {
    id: 'preset-matrix',
    type: 'preset',
    title: 'The Matrix: Phosphor Green CRT Wash',
    filmLookName: 'Matrix CRT Green',
    category: 'Cyber Aesthetic',
    sourceDescription: 'Heavy green tint balance, deep olive shadows, clinical cyberpunk contrast',
    thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
    dominantColors: ['#02160a', '#059669', '#34d399', '#10b981'],
  },
  {
    id: 'preset-oppenheimer',
    type: 'preset',
    title: 'Oppenheimer: 65mm High Contrast Tri-X Monolith',
    filmLookName: 'Noir 65mm Monolith',
    category: 'Monochrome Film',
    sourceDescription: 'Rich black & white silver-gelatin contrast with deep roll-off',
    thumbnailUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
    dominantColors: ['#050505', '#404040', '#a3a3a3', '#f5f5f5'],
  },
  {
    id: 'preset-teal-orange',
    type: 'preset',
    title: 'Hollywood Blockbuster: Teal & Orange Kodachrome',
    filmLookName: 'Blockbuster Teal Orange',
    category: 'Hollywood Standard',
    sourceDescription: 'Complementary color separation with protected warm skin vector',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    dominantColors: ['#061a23', '#2a9d8f', '#e76f51', '#f4a261'],
  },
  {
    id: 'preset-wes-anderson',
    type: 'preset',
    title: 'Grand Budapest: Pastel Vintage 70s Warmth',
    filmLookName: 'Pastel Vintage 70s',
    category: 'Art House Pastel',
    sourceDescription: 'Soft low-contrast shadows, muted nostalgic amber and blush tones',
    thumbnailUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&q=80',
    dominantColors: ['#2b1820', '#b56576', '#eaac8b', '#e56b6f'],
  },
];

export const ColorMatchModal: React.FC<ColorMatchModalProps> = ({
  isOpen,
  onClose,
  clips,
  mediaAssets = [],
  selectedClipId,
  onUpdateClipLumetri,
  onUpdateClip,
  onBatchUpdateClips,
}) => {
  const {
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
  } = useColorMatch();

  // Selected target clip
  const videoClips = clips.filter((c) => c.type === 'video');
  const [currentTargetClipId, setCurrentTargetClipId] = useState<string>(
    selectedClipId && videoClips.some((c) => c.id === selectedClipId)
      ? selectedClipId
      : videoClips[0]?.id || ''
  );

  const targetClip = videoClips.find((c) => c.id === currentTargetClipId) || videoClips[0];

  // Reference selection
  const [refCategory, setRefCategory] = useState<'presets' | 'timeline' | 'upload'>('presets');
  const [selectedReference, setSelectedReference] = useState<ColorMatchReference>(
    CINEMATIC_REFERENCE_PRESETS[0]
  );

  // Settings
  const [settings, setSettings] = useState<ColorMatchSettings>(DEFAULT_COLOR_MATCH_SETTINGS);
  const [matchStrength, setMatchStrength] = useState<number>(100);

  // Split-screen comparison controls
  const [comparisonMode, setComparisonMode] = useState<'side_by_side' | 'split_wipe' | 'target_graded'>('side_by_side');
  const [splitWipePercent, setSplitWipePercent] = useState<number>(50);
  const [isBypassed, setIsBypassed] = useState<boolean>(false);

  // Upload preview
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync target clip when selectedClipId changes
  useEffect(() => {
    if (selectedClipId && videoClips.some((c) => c.id === selectedClipId)) {
      setCurrentTargetClipId(selectedClipId);
    }
  }, [selectedClipId]);

  if (!isOpen) return null;

  // Build timeline references
  const timelineReferences: ColorMatchReference[] = videoClips
    .filter((c) => c.id !== targetClip?.id)
    .map((c) => ({
      id: `timeline-${c.id}`,
      type: 'clip',
      title: c.title,
      filmLookName: c.colorMatchInfo?.lookName || c.lumetri?.lutPreset !== 'none' ? `LUT: ${c.lumetri?.lutPreset}` : 'Rec.709 Timeline Frame',
      thumbnailUrl: c.thumbnail || 'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=400&q=80',
      sourceDescription: `Timeline Track ${c.trackId} (${c.duration.toFixed(1)}s)`,
      dominantColors: c.colorMatchInfo?.palette || ['#1e293b', '#475569', '#94a3b8', '#38bdf8'],
    }));

  // Handle image upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      const customRef: ColorMatchReference = {
        id: `upload-${Date.now()}`,
        type: 'upload',
        title: `Custom Frame: ${file.name}`,
        filmLookName: 'Custom Photographic Still',
        thumbnailUrl: base64Url,
        sourceDescription: `Uploaded Image (${(file.size / 1024).toFixed(0)} KB)`,
        dominantColors: ['#111827', '#374151', '#9ca3af', '#f3f4f6'],
      };
      setSelectedReference(customRef);
      setRefCategory('upload');
    };
    reader.readAsDataURL(file);
  };

  // Run AI Color Match
  const handleRunColorMatch = async () => {
    if (!targetClip || !selectedReference) return;
    try {
      await matchColor(targetClip, selectedReference, {
        ...settings,
        matchStrength,
      });
    } catch {
      // Error handled in hook
    }
  };

  // Apply to current clip
  const handleApplyToTarget = () => {
    if (!targetClip || !lastResult) return;
    const updated = applyColorMatchToClip(targetClip, lastResult, matchStrength);
    onUpdateClip(updated);
    onUpdateClipLumetri(targetClip.id, updated.lumetri!);
    onClose();
  };

  // Apply to all sequence video clips
  const handleApplyToAllClips = async () => {
    if (!lastResult || !onBatchUpdateClips) return;
    const updatedClips = await batchMatchClips(clips, selectedReference, {
      ...settings,
      matchStrength,
    });
    onBatchUpdateClips(updatedClips);
    onClose();
  };

  // Calculate live preview CSS filter
  const getPreviewFilter = (lumetri?: LumetriColorSettings, strengthFactor: number = 1) => {
    if (!lumetri || isBypassed) return 'none';
    const exposure = (lumetri.exposure || 0) * strengthFactor;
    const contrast = (lumetri.contrast || 0) * strengthFactor;
    const temp = (lumetri.temperature || 0) * strengthFactor;
    const sat = 100 + ((lumetri.saturation || 100) - 100) * strengthFactor;

    const exposureMult = 1 + exposure / 100;
    const contrastMult = 1 + contrast / 100;
    const satMult = sat / 100;
    const tempDeg = temp * 0.4;

    let presetFilter = '';
    if (lumetri.lutPreset === 'teal_orange') {
      presetFilter = 'contrast(115%) saturate(130%) hue-rotate(-8deg)';
    } else if (lumetri.lutPreset === 'cyberpunk') {
      presetFilter = 'contrast(135%) saturate(160%) hue-rotate(25deg) brightness(105%)';
    } else if (lumetri.lutPreset === 'warm_cinema') {
      presetFilter = 'sepia(20%) saturate(120%) contrast(110%)';
    } else if (lumetri.lutPreset === 'bleach_bypass') {
      presetFilter = 'contrast(140%) saturate(60%) brightness(110%)';
    } else if (lumetri.lutPreset === 'noir_bw') {
      presetFilter = 'grayscale(100%) contrast(150%) brightness(95%)';
    }

    return `brightness(${exposureMult}) contrast(${contrastMult}) saturate(${satMult}) hue-rotate(${tempDeg}deg) ${presetFilter}`;
  };

  const currentPreviewFilter = lastResult
    ? getPreviewFilter(lastResult.matchedLumetri, matchStrength / 100)
    : getPreviewFilter(targetClip?.lumetri);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-[#0b111e] border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#0e1628] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  AI Color Match &amp; Neural LUT Grading
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> Gemini 3.8 Flash
                </span>
                {lastResult && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {lastResult.matchConfidence.toFixed(1)}% Match
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Analiza el espacio cromático de una referencia y aplica automáticamente curvas Lumetri y LUTs de Hollywood
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Target Clip Selector */}
            <div className="flex items-center gap-1.5 bg-[#141d33] border border-slate-700/80 rounded-md px-2.5 py-1">
              <span className="text-[11px] text-slate-400">Clip Destino:</span>
              <select
                value={currentTargetClipId}
                onChange={(e) => setCurrentTargetClipId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer max-w-[180px] truncate"
              >
                {videoClips.map((clip) => (
                  <option key={clip.id} value={clip.id} className="bg-[#141d33] text-white">
                    {clip.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 1. DUAL COMPARISON WORKSPACE (Reference vs Target Clip) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LEFT: REFERENCE SOURCE VIEW */}
            <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-3.5 flex flex-col space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-amber-400" /> Referencia Visual (Origen)
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium truncate max-w-[220px]">
                    "{selectedReference.title}"
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-[#162238] p-0.5 rounded border border-slate-700/70 text-[10px]">
                  <button
                    onClick={() => setRefCategory('presets')}
                    className={`px-2 py-0.5 rounded font-medium transition ${
                      refCategory === 'presets' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Galería Film
                  </button>
                  <button
                    onClick={() => setRefCategory('timeline')}
                    className={`px-2 py-0.5 rounded font-medium transition ${
                      refCategory === 'timeline' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Clips Timeline ({timelineReferences.length})
                  </button>
                  <button
                    onClick={() => setRefCategory('upload')}
                    className={`px-2 py-0.5 rounded font-medium transition ${
                      refCategory === 'upload' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Subir Imagen
                  </button>
                </div>
              </div>

              {/* Reference Preview Canvas */}
              <div className="relative aspect-video bg-black/60 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center group shadow-inner">
                {selectedReference.thumbnailUrl ? (
                  <img
                    src={selectedReference.thumbnailUrl}
                    alt={selectedReference.title}
                    className="w-full h-full object-cover transition duration-300"
                  />
                ) : (
                  <div className="text-center text-slate-500 p-4">
                    <Film className="w-8 h-8 mx-auto mb-1 opacity-50" />
                    <p className="text-xs">Sin previsualización de referencia</p>
                  </div>
                )}

                {/* Film Look Badge Overlay */}
                <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-semibold text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shadow">
                  <Film className="w-3 h-3 text-amber-400" />
                  <span>{selectedReference.filmLookName || selectedReference.title}</span>
                </div>

                {/* Dominant Palette Swatches Overlay */}
                {selectedReference.dominantColors && selectedReference.dominantColors.length > 0 && (
                  <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-md border border-slate-700 flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-400 font-mono uppercase">Paleta:</span>
                    <div className="flex items-center gap-1">
                      {selectedReference.dominantColors.map((hex, idx) => (
                        <div
                          key={idx}
                          className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                          style={{ backgroundColor: hex }}
                          title={`Color espectral: ${hex}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Reference Selection Carousel / Picker */}
              <div className="mt-1 space-y-2">
                {refCategory === 'presets' && (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {CINEMATIC_REFERENCE_PRESETS.map((preset) => {
                      const isSelected = selectedReference.id === preset.id;
                      return (
                        <button
                          key={preset.id}
                          onClick={() => setSelectedReference(preset)}
                          className={`relative rounded-md overflow-hidden border transition text-left group flex flex-col ${
                            isSelected
                              ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
                              : 'border-slate-800 hover:border-slate-600 opacity-75 hover:opacity-100'
                          }`}
                        >
                          <div className="aspect-[16/10] w-full bg-slate-900 relative">
                            <img
                              src={preset.thumbnailUrl}
                              alt={preset.title}
                              className="w-full h-full object-cover"
                            />
                            {isSelected && (
                              <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4 text-amber-300 drop-shadow" />
                              </div>
                            )}
                          </div>
                          <div className="p-1 bg-[#11192a] flex-1">
                            <p className="text-[9px] font-semibold text-slate-200 truncate leading-tight">
                              {preset.filmLookName}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {refCategory === 'timeline' && (
                  <div className="space-y-1">
                    {timelineReferences.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-4 bg-slate-900/50 rounded">
                        No hay otros clips de vídeo en la línea de tiempo.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                        {timelineReferences.map((ref) => {
                          const isSelected = selectedReference.id === ref.id;
                          return (
                            <button
                              key={ref.id}
                              onClick={() => setSelectedReference(ref)}
                              className={`p-1.5 rounded-lg border text-left flex items-center gap-2 transition ${
                                isSelected
                                  ? 'bg-amber-500/20 border-amber-400 text-white'
                                  : 'bg-slate-900/70 border-slate-800 hover:bg-slate-800/80 text-slate-300'
                              }`}
                            >
                              <div className="w-10 h-7 rounded bg-slate-800 overflow-hidden flex-shrink-0">
                                <img src={ref.thumbnailUrl} alt={ref.title} className="w-full h-full object-cover" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-semibold truncate">{ref.title}</p>
                                <p className="text-[8px] text-slate-400 truncate">{ref.filmLookName}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {refCategory === 'upload' && (
                  <div className="p-3 bg-slate-900/60 border border-dashed border-slate-700 rounded-lg text-center">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md text-xs font-semibold border border-slate-600 transition"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-400" /> Seleccionar Fotograma o Imagen de Referencia
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Sube cualquier captura PNG o JPG (calificación de cine, Pinterest, Behance, etc.)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: TARGET CLIP BEFORE / AFTER PREVIEW */}
            <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-3.5 flex flex-col space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase flex items-center gap-1">
                    <Film className="w-3.5 h-3.5 text-indigo-400" /> Clip Destino:
                  </span>
                  <span className="text-[11px] text-slate-200 font-semibold truncate max-w-[200px]">
                    {targetClip?.title || 'Clip Seleccionado'}
                  </span>
                </div>

                {/* Comparison Mode Selector */}
                <div className="flex items-center gap-1 bg-[#162238] p-0.5 rounded border border-slate-700/70 text-[10px]">
                  <button
                    onClick={() => setComparisonMode('side_by_side')}
                    className={`px-2 py-0.5 rounded font-medium transition ${
                      comparisonMode === 'side_by_side' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Ver referencia y clip graduado lado a lado"
                  >
                    A / B Lado a Lado
                  </button>
                  <button
                    onClick={() => setComparisonMode('split_wipe')}
                    className={`px-2 py-0.5 rounded font-medium transition flex items-center gap-1 ${
                      comparisonMode === 'split_wipe' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Cortinilla interactiva antes/después"
                  >
                    <Split className="w-3 h-3" /> Cortinilla
                  </button>
                  <button
                    onClick={() => setIsBypassed(!isBypassed)}
                    className={`px-2 py-0.5 rounded font-medium transition ${
                      isBypassed ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Bypass temporal del grado"
                  >
                    {isBypassed ? 'Bypass Activo (Original)' : 'Bypass'}
                  </button>
                </div>
              </div>

              {/* Target Preview Canvas */}
              <div className="relative aspect-video bg-black/80 rounded-lg overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
                {targetClip ? (
                  comparisonMode === 'split_wipe' ? (
                    // Split Wipe View: Left original, Right graded
                    <div className="relative w-full h-full select-none">
                      {/* Graded Layer (Full) */}
                      <img
                        src={targetClip.thumbnail || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80'}
                        alt={targetClip.title}
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ filter: currentPreviewFilter }}
                      />

                      {/* Original Layer (Clipped to splitWipePercent) */}
                      <div
                        className="absolute inset-0 overflow-hidden"
                        style={{ width: `${splitWipePercent}%` }}
                      >
                        <img
                          src={targetClip.thumbnail || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80'}
                          alt="Original"
                          className="absolute inset-0 w-full h-full object-cover max-w-none"
                          style={{
                            width: '100%',
                            filter: 'none',
                          }}
                        />
                        <div className="absolute top-2 left-2 bg-black/75 px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-300">
                          ORIGINAL
                        </div>
                      </div>

                      {/* Graded label on right */}
                      <div className="absolute top-2 right-2 bg-indigo-950/80 border border-indigo-700/50 px-1.5 py-0.5 rounded text-[9px] font-mono text-indigo-300">
                        IA GRADED
                      </div>

                      {/* Split Divider Handle */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-amber-400 shadow-md cursor-ew-resize z-10"
                        style={{ left: `${splitWipePercent}%` }}
                      >
                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center text-[10px] shadow-lg font-bold">
                          ↔
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Standard Graded View
                    <div className="relative w-full h-full">
                      <img
                        src={targetClip.thumbnail || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80'}
                        alt={targetClip.title}
                        className="w-full h-full object-cover"
                        style={{ filter: currentPreviewFilter }}
                      />
                      <div className="absolute top-2 right-2 bg-indigo-950/80 border border-indigo-700/50 px-2 py-0.5 rounded text-[10px] font-mono text-indigo-300 flex items-center gap-1 shadow">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        {lastResult ? lastResult.lookName : 'Previsualización Lumetri'}
                      </div>
                    </div>
                  )
                ) : (
                  <p className="text-xs text-slate-500">Selecciona un clip en la línea de tiempo</p>
                )}
              </div>

              {/* Slider for Split Wipe if active */}
              {comparisonMode === 'split_wipe' && (
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] text-slate-400 font-mono">Original</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={splitWipePercent}
                    onChange={(e) => setSplitWipePercent(parseInt(e.target.value, 10))}
                    className="flex-1 accent-amber-400 h-1 bg-slate-700 rounded cursor-pointer"
                  />
                  <span className="text-[10px] text-indigo-300 font-mono">Graduado</span>
                </div>
              )}

              {/* Intensity Blend Slider */}
              <div className="p-2.5 bg-[#141e33] border border-slate-700/60 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" /> Intensidad de Ajuste Cromático
                  </span>
                  <span className="font-mono text-amber-400 font-bold">{matchStrength}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={matchStrength}
                  onChange={(e) => setMatchStrength(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>0% (Rec.709 Neutro)</span>
                  <span>50% (Sutil Hollywood)</span>
                  <span>100% (Grado Espectral Completo)</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. MATCH SETTINGS & ACTION BUTTON */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto flex-1">
              {/* Toggle 1: Skin Tone Protection */}
              <label className="flex items-center gap-2 p-2 rounded-lg bg-[#141e33] border border-slate-700/60 cursor-pointer hover:bg-slate-800/80 transition">
                <input
                  type="checkbox"
                  checked={settings.preserveSkinTones}
                  onChange={(e) => setSettings({ ...settings, preserveSkinTones: e.target.checked })}
                  className="accent-amber-400 rounded w-3.5 h-3.5"
                />
                <div>
                  <p className="text-[11px] font-semibold text-slate-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" /> Proteger Piel
                  </p>
                  <p className="text-[9px] text-slate-400">Línea I-line 56°</p>
                </div>
              </label>

              {/* Toggle 2: Luma Match */}
              <label className="flex items-center gap-2 p-2 rounded-lg bg-[#141e33] border border-slate-700/60 cursor-pointer hover:bg-slate-800/80 transition">
                <input
                  type="checkbox"
                  checked={settings.targetLumaMatch}
                  onChange={(e) => setSettings({ ...settings, targetLumaMatch: e.target.checked })}
                  className="accent-amber-400 rounded w-3.5 h-3.5"
                />
                <div>
                  <p className="text-[11px] font-semibold text-slate-200">Curva Luma</p>
                  <p className="text-[9px] text-slate-400">Sombras &amp; Luces</p>
                </div>
              </label>

              {/* Toggle 3: Chroma Saturation Match */}
              <label className="flex items-center gap-2 p-2 rounded-lg bg-[#141e33] border border-slate-700/60 cursor-pointer hover:bg-slate-800/80 transition">
                <input
                  type="checkbox"
                  checked={settings.chromaMatch}
                  onChange={(e) => setSettings({ ...settings, chromaMatch: e.target.checked })}
                  className="accent-amber-400 rounded w-3.5 h-3.5"
                />
                <div>
                  <p className="text-[11px] font-semibold text-slate-200">Saturación Croma</p>
                  <p className="text-[9px] text-slate-400">Dinámica de color</p>
                </div>
              </label>

              {/* Toggle 4: Auto White Balance */}
              <label className="flex items-center gap-2 p-2 rounded-lg bg-[#141e33] border border-slate-700/60 cursor-pointer hover:bg-slate-800/80 transition">
                <input
                  type="checkbox"
                  checked={settings.autoWhiteBalance}
                  onChange={(e) => setSettings({ ...settings, autoWhiteBalance: e.target.checked })}
                  className="accent-amber-400 rounded w-3.5 h-3.5"
                />
                <div>
                  <p className="text-[11px] font-semibold text-slate-200">Balance Blanco</p>
                  <p className="text-[9px] text-slate-400">Kelvin &amp; Tinte</p>
                </div>
              </label>
            </div>

            {/* Run Match Button */}
            <div className="flex-shrink-0 w-full md:w-auto">
              <button
                onClick={handleRunColorMatch}
                disabled={isMatching}
                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-bold rounded-lg shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isMatching ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Analizando Espectro...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>Auto Color Match (Gemini AI)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Processing Progress Bar */}
          {isMatching && (
            <div className="p-3 bg-amber-950/30 border border-amber-600/40 rounded-lg space-y-2 animate-pulse">
              <div className="flex justify-between text-xs text-amber-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" /> {currentStepMessage || 'Procesando coincidencia cromática...'}
                </span>
                <span className="font-mono">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button onClick={clearError} className="text-rose-400 hover:text-white underline">
                Cerrar
              </button>
            </div>
          )}

          {/* 3. COLORIST TELEMETRY & THREE-WAY WHEELS HUD */}
          {lastResult && (
            <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-amber-400" /> Ruedas de 3 Vías &amp; Corrección Primaria (Lumetri)
                  </span>
                  <span className="text-xs text-slate-300 font-semibold">
                    Look: {lastResult.lookName}
                  </span>
                </div>
                <button
                  onClick={() => exportCubeLut(lastResult)}
                  className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-md border border-slate-700 flex items-center gap-1.5 transition"
                  title="Descargar archivo .cube para DaVinci Resolve / Premiere Pro"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" /> Exportar 3D LUT (.CUBE)
                </button>
              </div>

              {/* Three-Way Wheels Visualization */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* LIFT (Shadows) */}
                <div className="p-3 bg-[#131d33] border border-slate-800 rounded-lg flex flex-col items-center text-center space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 tracking-wider uppercase">
                    Lift (Sombras)
                  </span>
                  <div
                    className="w-16 h-16 rounded-full border-2 border-slate-600 relative flex items-center justify-center shadow-inner"
                    style={{
                      background: `radial-gradient(circle at 50% 50%, ${lastResult.threeWayWheels.lift.color} 30%, #050b14 80%)`,
                    }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-white shadow-md border border-slate-900" />
                  </div>
                  <div className="text-[10px] space-y-0.5">
                    <p className="font-mono text-slate-300">{lastResult.threeWayWheels.lift.color}</p>
                    <p className="text-slate-400">{lastResult.threeWayWheels.lift.label || 'Tinte de Sombras'}</p>
                  </div>
                </div>

                {/* GAMMA (Midtones) */}
                <div className="p-3 bg-[#131d33] border border-slate-800 rounded-lg flex flex-col items-center text-center space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 tracking-wider uppercase">
                    Gamma (Medios)
                  </span>
                  <div
                    className="w-16 h-16 rounded-full border-2 border-slate-600 relative flex items-center justify-center shadow-inner"
                    style={{
                      background: `radial-gradient(circle at 50% 50%, ${lastResult.threeWayWheels.gamma.color} 30%, #050b14 80%)`,
                    }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-white shadow-md border border-slate-900" />
                  </div>
                  <div className="text-[10px] space-y-0.5">
                    <p className="font-mono text-slate-300">{lastResult.threeWayWheels.gamma.color}</p>
                    <p className="text-slate-400">{lastResult.threeWayWheels.gamma.label || 'Tinte de Piel & Medios'}</p>
                  </div>
                </div>

                {/* GAIN (Highlights) */}
                <div className="p-3 bg-[#131d33] border border-slate-800 rounded-lg flex flex-col items-center text-center space-y-2">
                  <span className="text-[11px] font-bold text-slate-300 tracking-wider uppercase">
                    Gain (Luces)
                  </span>
                  <div
                    className="w-16 h-16 rounded-full border-2 border-slate-600 relative flex items-center justify-center shadow-inner"
                    style={{
                      background: `radial-gradient(circle at 50% 50%, ${lastResult.threeWayWheels.gain.color} 30%, #050b14 80%)`,
                    }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-white shadow-md border border-slate-900" />
                  </div>
                  <div className="text-[10px] space-y-0.5">
                    <p className="font-mono text-slate-300">{lastResult.threeWayWheels.gain.color}</p>
                    <p className="text-slate-400">{lastResult.threeWayWheels.gain.label || 'Tinte de Altas Luces'}</p>
                  </div>
                </div>
              </div>

              {/* Lumetri Parameters Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1 text-center">
                <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase">Exposición</span>
                  <p className="text-xs font-mono font-bold text-white">
                    {lastResult.matchedLumetri.exposure > 0 ? '+' : ''}{lastResult.matchedLumetri.exposure}%
                  </p>
                </div>
                <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase">Contraste</span>
                  <p className="text-xs font-mono font-bold text-white">
                    {lastResult.matchedLumetri.contrast > 0 ? '+' : ''}{lastResult.matchedLumetri.contrast}%
                  </p>
                </div>
                <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase">Temperatura</span>
                  <p className="text-xs font-mono font-bold text-amber-400">
                    {lastResult.matchedLumetri.temperature > 0 ? '+' : ''}{lastResult.matchedLumetri.temperature}
                  </p>
                </div>
                <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase">Tinte</span>
                  <p className="text-xs font-mono font-bold text-rose-400">
                    {lastResult.matchedLumetri.tint > 0 ? '+' : ''}{lastResult.matchedLumetri.tint}
                  </p>
                </div>
                <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase">Luces</span>
                  <p className="text-xs font-mono font-bold text-white">
                    {lastResult.matchedLumetri.highlights}%
                  </p>
                </div>
                <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase">Sombras</span>
                  <p className="text-xs font-mono font-bold text-white">
                    {lastResult.matchedLumetri.shadows}%
                  </p>
                </div>
                <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase">Saturación</span>
                  <p className="text-xs font-mono font-bold text-indigo-400">
                    {lastResult.matchedLumetri.saturation}%
                  </p>
                </div>
                <div className="p-2 bg-slate-900/80 rounded border border-slate-800">
                  <span className="text-[9px] text-slate-400 uppercase">Preset LUT</span>
                  <p className="text-xs font-mono font-bold text-amber-300 uppercase truncate">
                    {lastResult.matchedLumetri.lutPreset}
                  </p>
                </div>
              </div>

              {/* Colorist Rationale & Recipe */}
              <div className="p-3 bg-[#131d33] border border-slate-800 rounded-lg space-y-2">
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong className="text-amber-400 font-semibold">Diagnóstico del Colorista AI: </strong>
                  {lastResult.explanation}
                </p>

                {lastResult.colorGradingRecipe && lastResult.colorGradingRecipe.length > 0 && (
                  <div className="pt-1.5 border-t border-slate-800/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Receta de Gradación Paso a Paso:
                    </span>
                    <ul className="mt-1 space-y-0.5 text-[11px] text-slate-400 font-mono">
                      {lastResult.colorGradingRecipe.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-amber-400">•</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-[#0e1628] border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBatchUpdateClips && (
              <button
                onClick={handleApplyToAllClips}
                disabled={!lastResult || isMatching}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition disabled:opacity-40 flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Aplicar a Toda la Secuencia ({videoClips.length} clips)
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleApplyToTarget}
              disabled={!lastResult || isMatching}
              className="px-5 py-2 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-amber-500/20 transition flex items-center gap-1.5 disabled:opacity-40"
            >
              <CheckCircle2 className="w-4 h-4 text-white" /> Aplicar Grado al Clip Seleccionado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
