import React, { useState, useEffect } from 'react';
import { 
  FolderPlus, Video, Music, Sliders, Wand2, Crop, 
  MessageSquare, Sparkles, Check, Play, RefreshCw, Palette, 
  Volume2, FastForward, PlusCircle, Trash2, Film, Scissors, MoveHorizontal, Wind, Mic,
  Cloud, GripVertical, Gauge
} from 'lucide-react';
import { 
  MediaAsset, TimelineClip, LumetriColorSettings, 
  PanCropSettings, TimelineComment, WorkspaceTab, MotionBlurSettings, TimelineTrack 
} from '../types/editor';
import { secondsToTimecode } from '../utils/timecode';
import { MotionBlurPanel } from './MotionBlurPanel';
import { MediaLibrary } from './MediaLibrary';

interface LeftSidebarProps {
  currentTab?: WorkspaceTab;
  mediaAssets: MediaAsset[];
  selectedClip: TimelineClip | null;
  comments: TimelineComment[];
  currentTime: number;
  availableTracks?: TimelineTrack[];
  onAddMediaToTimeline: (asset: MediaAsset) => void;
  onOpenFullMediaLibrary?: () => void;
  onUpdateClipLumetri: (clipId: string, lumetri: LumetriColorSettings) => void;
  onUpdateClipPanCrop: (clipId: string, panCrop: PanCropSettings) => void;
  onApplyCapCutAction: (action: string, payload?: any) => void;
  onAddComment: (text: string) => void;
  onToggleCommentStatus: (id: string) => void;
  onOpenKeyframeAssist?: () => void;
  isProxyModeActive?: boolean;
  onOpenAudioCleanup?: (clipId?: string) => void;
  onOpenColorMatch?: () => void;
  onOpenSceneSplitter?: () => void;
  onOpenTransitionSuggest?: () => void;
  isRippleEditMode?: boolean;
  onToggleRippleEditMode?: (active: boolean) => void;
  onDeleteClip?: (clipId: string, forceRipple?: boolean) => void;
  onResizeClip?: (clipId: string, edge: 'left' | 'right', deltaSeconds: number, forceRipple?: boolean) => void;
  onCloseGap?: (trackId?: string) => void;
  onUpdateClipMotionBlur?: (clipId: string, settings: MotionBlurSettings) => void;
  onOpenVoiceoverStudio?: () => void;
  onOpenBeatAlignment?: (clipId?: string) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  currentTab,
  mediaAssets,
  selectedClip,
  comments,
  currentTime,
  availableTracks,
  onAddMediaToTimeline,
  onOpenFullMediaLibrary,
  onUpdateClipLumetri,
  onUpdateClipPanCrop,
  onApplyCapCutAction,
  onAddComment,
  onToggleCommentStatus,
  onOpenKeyframeAssist,
  isProxyModeActive = true,
  onOpenAudioCleanup,
  onOpenColorMatch,
  onOpenSceneSplitter,
  onOpenTransitionSuggest,
  isRippleEditMode = true,
  onToggleRippleEditMode,
  onDeleteClip,
  onResizeClip,
  onCloseGap,
  onUpdateClipMotionBlur,
  onOpenVoiceoverStudio,
  onOpenBeatAlignment,
}) => {
  const [activeTab, setActiveTab] = useState<'media' | 'cloud_media' | 'capcut' | 'lumetri' | 'vegas' | 'comments' | 'motion_blur'>('media');
  const [newCommentText, setNewCommentText] = useState('');

  // Handle Drag Start for Local Media Pool items to drop on Timeline
  const handleDragStartLocal = (e: React.DragEvent, asset: MediaAsset) => {
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.setData('text/plain', asset.id);
    e.dataTransfer.effectAllowed = 'copy';

    const dragGhost = document.createElement('div');
    dragGhost.style.padding = '6px 10px';
    dragGhost.style.background = '#0284c7';
    dragGhost.style.color = '#ffffff';
    dragGhost.style.borderRadius = '6px';
    dragGhost.style.fontWeight = 'bold';
    dragGhost.style.fontSize = '11px';
    dragGhost.style.position = 'absolute';
    dragGhost.style.top = '-1000px';
    dragGhost.innerText = `🎬 ${asset.title} (${asset.duration.toFixed(1)}s)`;
    document.body.appendChild(dragGhost);
    e.dataTransfer.setDragImage(dragGhost, 10, 10);
    setTimeout(() => dragGhost.remove(), 0);
  };

  // Auto-switch to Lumetri tab when the user selects the "Color" workspace tab
  useEffect(() => {
    if (currentTab === 'color') {
      setActiveTab('lumetri');
    }
  }, [currentTab]);

  // Handle Lumetri slider change
  const handleLumetriChange = (field: keyof LumetriColorSettings, value: any) => {
    if (!selectedClip) return;
    const updated: LumetriColorSettings = {
      ...(selectedClip.lumetri || {
        exposure: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        temperature: 0,
        tint: 0,
        saturation: 100,
        vibrance: 0,
        lutPreset: 'none',
      }),
      [field]: value,
    };
    onUpdateClipLumetri(selectedClip.id, updated);
  };

  // Handle Pan/Crop slider change
  const handlePanCropChange = (field: keyof PanCropSettings, value: number) => {
    if (!selectedClip) return;
    const updated: PanCropSettings = {
      ...(selectedClip.panCrop || { zoom: 1, panX: 0, panY: 0, rotation: 0 }),
      [field]: value,
    };
    onUpdateClipPanCrop(selectedClip.id, updated);
  };

  return (
    <div className="w-80 lg:w-96 bg-[#0c121e] border-r border-[#1b2434] flex flex-col select-none overflow-hidden h-full">
      {/* Sidebar Header Tabs */}
      <div className="flex items-center bg-[#090d16] border-b border-[#1b2434] p-1 gap-1 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('media')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-medium transition whitespace-nowrap ${
            activeTab === 'media' ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Media Pool</span>
        </button>

        <button
          onClick={() => setActiveTab('cloud_media')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-medium transition whitespace-nowrap ${
            activeTab === 'cloud_media' ? 'bg-sky-500/25 text-sky-200 border border-sky-400/50 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Biblioteca Cloud: Archivos en Firebase Storage con arrastre a la línea de tiempo"
        >
          <Cloud className="w-3.5 h-3.5 text-sky-400" />
          <span>Cloud Media</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </button>

        <button
          onClick={() => setActiveTab('capcut')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-medium transition whitespace-nowrap ${
            activeTab === 'capcut' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wand2 className="w-3.5 h-3.5" />
          <span>CapCut AI</span>
        </button>

        <button
          onClick={() => setActiveTab('lumetri')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-medium transition whitespace-nowrap ${
            activeTab === 'lumetri' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Lumetri</span>
        </button>

        <button
          onClick={() => setActiveTab('vegas')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-medium transition whitespace-nowrap ${
            activeTab === 'vegas' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Crop className="w-3.5 h-3.5" />
          <span>Vegas FX</span>
        </button>

        <button
          onClick={() => setActiveTab('motion_blur')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-medium transition whitespace-nowrap ${
            activeTab === 'motion_blur' ? 'bg-sky-500/25 text-sky-300 border border-sky-500/40' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wind className="w-3.5 h-3.5" />
          <span>Motion Blur</span>
          {selectedClip?.motionBlur?.isEnabled && (
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('comments')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded font-medium transition whitespace-nowrap ${
            activeTab === 'comments' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Review ({comments.length})</span>
        </button>
      </div>

      {/* Sidebar Content Body */}
      <div className="flex-1 overflow-y-auto p-3 text-xs space-y-3">
        {/* TAB: Firebase Cloud Media Library */}
        {activeTab === 'cloud_media' && (
          <div className="h-full flex flex-col -m-3 min-h-[500px]">
            <MediaLibrary
              isCompactMode={true}
              availableTracks={availableTracks}
              onAddMediaToTimeline={onAddMediaToTimeline}
              onExpandToModal={onOpenFullMediaLibrary}
            />
          </div>
        )}

        {/* TAB 1: Media Pool */}
        {activeTab === 'media' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">Project Assets</span>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded font-mono">{mediaAssets.length} clips</span>
            </div>

            {/* Cloud Storage Quick Banner */}
            <div className="p-2.5 bg-gradient-to-r from-sky-950/70 to-blue-950/50 border border-sky-500/40 rounded-lg flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center flex-shrink-0">
                  <Cloud className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-[11px] leading-tight">Firebase Cloud Storage</h4>
                  <p className="text-[9px] text-slate-400">Vault &amp; arrastre a la línea de tiempo</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('cloud_media')}
                className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-bold shadow transition cursor-pointer flex items-center gap-1 active:scale-95"
              >
                <FolderPlus className="w-2.5 h-2.5" />
                <span>Explorar</span>
              </button>
            </div>

            {/* Auto-Scene Splitter Quick Action Card */}
            <div className="p-2.5 bg-gradient-to-r from-[#0d1c2d] to-[#141b34] border border-sky-500/30 rounded-lg flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center">
                  <Film className="w-3.5 h-3.5 text-sky-400" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-[11px] leading-tight">Auto-Scene Splitter</h4>
                  <p className="text-[9px] text-slate-400">Segmentar tomas con Gemini Vision</p>
                </div>
              </div>
              <button
                onClick={() => onOpenSceneSplitter?.()}
                className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-bold shadow transition cursor-pointer flex items-center gap-1 active:scale-95"
              >
                <Scissors className="w-2.5 h-2.5" />
                <span>Analizar</span>
              </button>
            </div>

            {/* Selected Clip Ripple Edit & Track Sync Quick Card */}
            {selectedClip && (
              <div className="p-2.5 bg-gradient-to-br from-[#1c1407] to-[#0c1424] border border-amber-500/40 rounded-lg space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-300 flex items-center gap-1.5 text-[11px]">
                    <MoveHorizontal className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ripple Edit &amp; Sync</span>
                  </span>
                  <button
                    onClick={() => onToggleRippleEditMode?.(!isRippleEditMode)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition cursor-pointer border ${
                      isRippleEditMode
                        ? 'bg-amber-500/30 text-amber-300 border-amber-400/50'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {isRippleEditMode ? 'RIPPLE: ON' : 'RIPPLE: OFF'}
                  </button>
                </div>

                <div className="bg-black/40 p-1.5 rounded text-[10px] space-y-0.5 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Clip:</span>
                    <span className="text-slate-200 font-bold truncate max-w-[130px]">{selectedClip.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Duración:</span>
                    <span className="text-amber-300 font-bold">{selectedClip.duration.toFixed(2)}s</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <button
                    onClick={() => onResizeClip?.(selectedClip.id, 'right', -0.5, isRippleEditMode)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-mono text-center cursor-pointer"
                    title="Recortar 0.5s con Ripple Edit"
                  >
                    Trim -0.5s
                  </button>
                  <button
                    onClick={() => onResizeClip?.(selectedClip.id, 'right', 0.5, isRippleEditMode)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 font-mono text-center cursor-pointer"
                    title="Alargar 0.5s con Ripple Edit"
                  >
                    Trim +0.5s
                  </button>
                </div>

                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    onClick={() => onDeleteClip?.(selectedClip.id, true)}
                    className="flex-1 py-1 bg-amber-950/70 hover:bg-amber-900 text-amber-200 border border-amber-600/60 rounded text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition shadow-sm"
                    title="Ripple Delete: elimina el clip y desplaza todas las pistas posteriores"
                  >
                    <Trash2 className="w-3 h-3 text-amber-400" />
                    <span>Ripple Delete</span>
                  </button>
                  <button
                    onClick={() => onDeleteClip?.(selectedClip.id, false)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-[10px] border border-slate-700 cursor-pointer"
                    title="Eliminar conservando el hueco (Lift)"
                  >
                    Lift Del
                  </button>
                </div>

                <button
                  onClick={() => setActiveTab('motion_blur')}
                  className="w-full py-1 bg-sky-950/70 hover:bg-sky-900/80 text-sky-200 border border-sky-500/40 rounded text-[10px] font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Abrir panel de Motion Blur para este clip"
                >
                  <Wind className="w-3 h-3 text-sky-400" />
                  <span>Configurar AI Motion Blur ({selectedClip.motionBlur?.isEnabled ? `${selectedClip.motionBlur.shutterAngle}° Activo` : 'Inactivo'})</span>
                </button>
              </div>
            )}

            <div className="space-y-2">
              {mediaAssets.map((asset) => (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => handleDragStartLocal(e, asset)}
                  className="p-2 rounded-lg bg-[#0f1626] border border-slate-800 hover:border-sky-500/60 transition flex gap-2.5 group cursor-grab active:cursor-grabbing hover:bg-[#111a2e]"
                  title="Arrastra este clip a cualquier pista de la línea de tiempo"
                >
                  <div className="w-16 h-12 rounded bg-black overflow-hidden relative flex-shrink-0">
                    <img src={asset.thumbnail} alt={asset.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-[8px] font-mono px-1 rounded text-white">
                      {asset.duration.toFixed(0)}s
                    </span>
                    <div className="absolute top-0.5 left-0.5 bg-sky-950/80 text-sky-300 text-[7px] font-mono px-1 rounded flex items-center gap-0.5 pointer-events-none">
                      <GripVertical className="w-2 h-2 text-sky-400" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h4 className="font-semibold text-slate-200 truncate text-[11px] group-hover:text-sky-300 transition">{asset.title}</h4>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{asset.description}</p>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-mono text-slate-400 uppercase">
                          {asset.resolution || 'Stereo Audio'}
                        </span>
                        {asset.type === 'video' && (
                          <span className={`text-[8px] font-mono px-1 rounded font-bold ${
                            isProxyModeActive
                              ? 'bg-amber-950 text-amber-300 border border-amber-700/60'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {isProxyModeActive ? '⚡ 720p Proxy' : '4K RAW'}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => onAddMediaToTimeline(asset)}
                        className="flex items-center gap-1 bg-sky-600 hover:bg-sky-500 text-white px-2 py-0.5 rounded text-[10px] font-medium transition active:scale-95 cursor-pointer"
                        title="Añadir a la línea de tiempo"
                      >
                        <PlusCircle className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: CapCut Smart AI Tools */}
        {activeTab === 'capcut' && (
          <div className="space-y-4">
            <div className="p-3 bg-gradient-to-br from-pink-950/40 to-purple-950/40 border border-pink-800/40 rounded-lg">
              <div className="flex items-center gap-2 text-pink-300 font-bold mb-1">
                <Sparkles className="w-4 h-4 text-pink-400" />
                <span>CapCut Automation Engine</span>
              </div>
              <p className="text-slate-300 text-[11px]">
                One-click viral editing algorithms for speech detection, dynamic typography, and rhythm pacing.
              </p>
            </div>

            {/* Smart Tool 0: AI Voiceover Studio (TTS Direct) */}
            <div className="p-3 bg-gradient-to-br from-[#0c1b26] to-[#0f1424] border border-emerald-500/40 rounded-lg space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-emerald-200 text-xs flex items-center gap-1.5">
                  <Mic className="w-4 h-4 text-emerald-400" />
                  <span>AI Voiceover Studio</span>
                </span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded font-mono font-bold">
                  DIRECT TRACK A1
                </span>
              </div>
              <p className="text-slate-300 text-[10px]">
                Sintetiza locuciones profesionales de cine, podcasts o trailers con IA, con control de tono, velocidad e idioma.
              </p>
              <button
                onClick={() => onOpenVoiceoverStudio?.()}
                className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5 text-emerald-200" />
                <span>Abrir Generador de Voces IA</span>
              </button>
            </div>

            {/* Smart Tool 1: Auto-Captions */}
            <div className="p-3 bg-[#0f1626] border border-slate-800 rounded-lg space-y-2">
              <span className="font-semibold text-slate-200 flex items-center justify-between">
                <span>Auto-Captions &amp; Viral Styles</span>
                <span className="text-[9px] text-pink-400 uppercase font-mono">Neural STT</span>
              </span>
              <p className="text-slate-400 text-[10px]">Generate animated subtitles with keyword zoom and highlight coloring.</p>
              
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  onClick={() => onApplyCapCutAction('CAPTIONS_HORMOZI')}
                  className="p-2 rounded bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-left font-bold"
                >
                  <span className="block text-[11px]">Alex Hormozi</span>
                  <span className="text-[9px] font-normal opacity-80">Bold Yellow Pop</span>
                </button>

                <button
                  onClick={() => onApplyCapCutAction('CAPTIONS_MRBEAST')}
                  className="p-2 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-left font-bold"
                >
                  <span className="block text-[11px]">MrBeast</span>
                  <span className="text-[9px] font-normal opacity-80">Neon Green Badge</span>
                </button>

                <button
                  onClick={() => onApplyCapCutAction('CAPTIONS_CYBERPUNK')}
                  className="p-2 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-left font-bold"
                >
                  <span className="block text-[11px]">Cyberpunk</span>
                  <span className="text-[9px] font-normal opacity-80">Glitch Glow</span>
                </button>

                <button
                  onClick={() => onApplyCapCutAction('CAPTIONS_MINIMAL')}
                  className="p-2 rounded bg-slate-700/30 hover:bg-slate-700/50 text-slate-200 border border-slate-600 text-left font-bold"
                >
                  <span className="block text-[11px]">Cinema Minimal</span>
                  <span className="text-[9px] font-normal opacity-80">Clean White</span>
                </button>
              </div>
            </div>

            {/* Smart Tool 2: Remove Silences & Fillers */}
            <div className="p-3 bg-[#0f1626] border border-slate-800 rounded-lg space-y-2">
              <span className="font-semibold text-slate-200 flex items-center justify-between">
                <span>Auto-Cut Silences &amp; Jump Cuts</span>
                <span className="text-[9px] text-sky-400 font-mono">-38dB Gate</span>
              </span>
              <p className="text-slate-400 text-[10px]">
                Detect pauses longer than 0.5s in speech dialogue and delete gaps with automated ripple edit.
              </p>
              <button
                onClick={() => onApplyCapCutAction('AUTO_CUT_SILENCES')}
                className="w-full py-2 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded font-semibold flex items-center justify-center gap-1.5 shadow transition active:scale-95"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Remove All Silences (&gt;0.5s)</span>
              </button>
            </div>

            {/* Smart Tool 3: Beat-Detection & Transient Alignment */}
            <div className="p-3 bg-[#0f1626] border border-slate-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">AI Beat Alignment &amp; Snapping</span>
                <span className="text-[9px] text-pink-400 font-mono font-bold bg-pink-500/20 px-1.5 py-0.5 rounded border border-pink-500/40">
                  DETECTIVE
                </span>
              </div>
              <p className="text-slate-400 text-[10px]">
                Analiza transitorios de audio en el timeline y agrega marcadores magnéticos para cortes sincronizados al ritmo.
              </p>
              <button
                onClick={() => (onOpenBeatAlignment ? onOpenBeatAlignment() : onApplyCapCutAction('BEAT_SYNC'))}
                className="w-full py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded font-bold text-xs shadow-md shadow-pink-600/20 flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <Music className="w-3.5 h-3.5 text-pink-200" />
                <span>Abrir AI Beat Alignment Studio</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Premiere Pro Lumetri Color */}
        {activeTab === 'lumetri' && (
          <div className="space-y-4">
            {!selectedClip ? (
              <div className="p-6 text-center text-slate-400 bg-[#0f1626] border border-slate-800 rounded-lg">
                <Palette className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="font-medium text-slate-300">No Clip Selected</p>
                <p className="text-[10px] text-slate-500 mt-1">Select any video clip on the timeline to grade exposure, contrast, temperature, and LUTs.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 truncate max-w-[200px]">
                    {selectedClip.title}
                  </span>
                  <button
                    onClick={() => onUpdateClipLumetri(selectedClip.id, {
                      exposure: 0, contrast: 0, highlights: 0, shadows: 0,
                      temperature: 0, tint: 0, saturation: 100, vibrance: 0, lutPreset: 'none'
                    })}
                    className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Reset
                  </button>
                </div>

                {/* AI Color Match (Gemini) Card */}
                <div className="p-3 bg-gradient-to-br from-[#121c33] via-[#0d1629] to-[#181a30] border border-amber-500/30 rounded-lg space-y-2.5 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[11px] font-bold text-white tracking-wide">
                        AI Color Match (Gemini)
                      </span>
                    </div>
                    {selectedClip.colorMatchInfo?.isMatched ? (
                      <span className="text-[9px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> Matched
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                        Hollywood AI
                      </span>
                    )}
                  </div>

                  {selectedClip.colorMatchInfo?.isMatched && (
                    <div className="p-2 bg-black/40 rounded border border-slate-700/60 space-y-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-slate-300 font-semibold truncate max-w-[150px]">
                          {selectedClip.colorMatchInfo.lookName}
                        </span>
                        <span className="text-amber-400 font-mono text-[9px]">
                          {selectedClip.colorMatchInfo.confidence.toFixed(0)}% Match
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-slate-400">
                        <span className="truncate max-w-[140px]">Ref: {selectedClip.colorMatchInfo.referenceSource}</span>
                        <div className="flex items-center gap-1">
                          {selectedClip.colorMatchInfo.palette.slice(0, 4).map((c, i) => (
                            <span key={i} className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => onOpenColorMatch?.()}
                    className="w-full py-2 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white rounded font-bold text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 transition"
                  >
                    <Palette className="w-3.5 h-3.5 text-white" />
                    <span>{selectedClip.colorMatchInfo?.isMatched ? 'Re-ajustar Color Match' : 'Emparejar Color con IA'}</span>
                  </button>
                </div>

                {/* LUT Presets */}
                <div className="p-2.5 bg-[#0f1626] border border-slate-800 rounded-lg space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cinematic 3D LUT Presets</span>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'none', label: 'Rec.709' },
                      { id: 'teal_orange', label: 'Teal/Orange' },
                      { id: 'cyberpunk', label: 'Cyberpunk' },
                      { id: 'warm_cinema', label: 'Warm Film' },
                      { id: 'bleach_bypass', label: 'Bleach' },
                      { id: 'noir_bw', label: 'Noir B&W' },
                      { id: 'vintage_70s', label: 'Vintage 70s' },
                    ].map((lut) => (
                      <button
                        key={lut.id}
                        onClick={() => handleLumetriChange('lutPreset', lut.id)}
                        className={`p-1.5 rounded text-[10px] font-semibold border transition ${
                          selectedClip.lumetri?.lutPreset === lut.id
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                            : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        {lut.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Basic Correction Sliders */}
                <div className="p-2.5 bg-[#0f1626] border border-slate-800 rounded-lg space-y-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tone &amp; White Balance</span>
                  
                  {/* Exposure */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300">Exposure</span>
                      <span className="font-mono text-slate-400">{selectedClip.lumetri?.exposure || 0}%</span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={selectedClip.lumetri?.exposure || 0}
                      onChange={(e) => handleLumetriChange('exposure', parseInt(e.target.value, 10))}
                      className="w-full accent-amber-500 h-1 bg-slate-700 rounded cursor-pointer"
                    />
                  </div>

                  {/* Contrast */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300">Contrast</span>
                      <span className="font-mono text-slate-400">{selectedClip.lumetri?.contrast || 0}%</span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={selectedClip.lumetri?.contrast || 0}
                      onChange={(e) => handleLumetriChange('contrast', parseInt(e.target.value, 10))}
                      className="w-full accent-amber-500 h-1 bg-slate-700 rounded cursor-pointer"
                    />
                  </div>

                  {/* Temperature */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300">Temperature (Cool / Warm)</span>
                      <span className="font-mono text-slate-400">{selectedClip.lumetri?.temperature || 0}</span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={selectedClip.lumetri?.temperature || 0}
                      onChange={(e) => handleLumetriChange('temperature', parseInt(e.target.value, 10))}
                      className="w-full accent-amber-500 h-1 bg-slate-700 rounded cursor-pointer"
                    />
                  </div>

                  {/* Saturation */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300">Saturation</span>
                      <span className="font-mono text-slate-400">{selectedClip.lumetri?.saturation || 100}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      value={selectedClip.lumetri?.saturation || 100}
                      onChange={(e) => handleLumetriChange('saturation', parseInt(e.target.value, 10))}
                      className="w-full accent-amber-500 h-1 bg-slate-700 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Vegas Pro Pan/Crop & Velocity Curves */}
        {activeTab === 'vegas' && (
          <div className="space-y-4">
            {!selectedClip ? (
              <div className="p-6 text-center text-slate-400 bg-[#0f1626] border border-slate-800 rounded-lg">
                <Crop className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="font-medium text-slate-300">No Clip Selected</p>
                <p className="text-[10px] text-slate-500 mt-1">Select a clip to adjust Vegas Event Pan/Crop or Bézier speed ramping.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-[#0f1626] border border-slate-800 rounded-lg space-y-3">
                  <span className="font-semibold text-slate-200 block text-[11px]">Event Pan / Crop &amp; Zoom</span>
                  
                  {/* Zoom */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300">Zoom Scale</span>
                      <span className="font-mono text-slate-400">{(selectedClip.panCrop?.zoom || 1).toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="250"
                      value={Math.round((selectedClip.panCrop?.zoom || 1) * 100)}
                      onChange={(e) => handlePanCropChange('zoom', parseInt(e.target.value, 10) / 100)}
                      className="w-full accent-emerald-500 h-1 bg-slate-700 rounded cursor-pointer"
                    />
                  </div>

                  {/* Pan X */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300">Pan Horizontal (X)</span>
                      <span className="font-mono text-slate-400">{selectedClip.panCrop?.panX || 0}%</span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={selectedClip.panCrop?.panX || 0}
                      onChange={(e) => handlePanCropChange('panX', parseInt(e.target.value, 10))}
                      className="w-full accent-emerald-500 h-1 bg-slate-700 rounded cursor-pointer"
                    />
                  </div>

                  {/* Pan Y */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-300">Pan Vertical (Y)</span>
                      <span className="font-mono text-slate-400">{selectedClip.panCrop?.panY || 0}%</span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      value={selectedClip.panCrop?.panY || 0}
                      onChange={(e) => handlePanCropChange('panY', parseInt(e.target.value, 10))}
                      className="w-full accent-emerald-500 h-1 bg-slate-700 rounded cursor-pointer"
                    />
                  </div>
                </div>

                {/* Vegas Speed Ramp Presets */}
                <div className="p-3 bg-[#0f1626] border border-slate-800 rounded-lg space-y-2">
                  <span className="font-semibold text-slate-200 block text-[11px]">Vegas Velocity Curve Presets</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => onApplyCapCutAction('SPEED_RAMP_BULLET')}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded text-left border border-slate-700"
                    >
                      <span className="block font-bold">Bullet Time</span>
                      <span className="text-[9px] text-slate-400">2.0x &gt; 0.3x slow-mo</span>
                    </button>
                    <button
                      onClick={() => onApplyCapCutAction('SPEED_RAMP_HERO')}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded text-left border border-slate-700"
                    >
                      <span className="block font-bold">Hero Freeze</span>
                      <span className="text-[9px] text-slate-400">0.5x cinematic entrance</span>
                    </button>
                  </div>
                </div>

                {/* AI Keyframe Assist Motion Curves Card */}
                <div className="p-3 bg-gradient-to-br from-purple-950/40 to-indigo-950/30 border border-purple-800/40 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-purple-300 flex items-center gap-1.5 text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>AI Keyframe Motion Curves</span>
                    </span>
                    <span className="text-[9px] font-mono bg-purple-900/60 text-purple-300 border border-purple-700 px-1 py-0.2 rounded font-bold">
                      Gemini
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-300">
                    Genera coreografías de cámara (zoom cinemático, whip pan, vertigo) a partir de descripciones de estado de ánimo.
                  </p>

                  {selectedClip.activeMotionPreset && (
                    <div className="p-2 bg-black/40 rounded border border-purple-900/40 text-[10px] text-purple-200">
                      Preset Activo: <strong className="text-white">{selectedClip.activeMotionPreset}</strong>
                    </div>
                  )}

                  <button
                    onClick={() => onOpenKeyframeAssist?.()}
                    className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded font-semibold flex items-center justify-center gap-1.5 shadow transition active:scale-95 cursor-pointer text-[11px]"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Abrir AI Keyframe Assist</span>
                  </button>
                </div>

                {/* AI Audio Cleanup & De-Hum Card */}
                <div className="p-3 bg-gradient-to-br from-emerald-950/40 to-teal-950/30 border border-emerald-800/40 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-300 flex items-center gap-1.5 text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>AI Audio Cleanup &amp; De-Hum</span>
                    </span>
                    <span className="text-[9px] font-mono bg-emerald-900/60 text-emerald-300 border border-emerald-700 px-1 py-0.2 rounded font-bold">
                      Gemini
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-300">
                    Aísla zumbidos eléctricos (50/60Hz), ruido de ventilación HVAC y optimiza formantes vocales con sustracción espectral.
                  </p>

                  {selectedClip.audioCleanup?.isEnabled && (
                    <div className="p-2 bg-black/40 rounded border border-emerald-900/40 text-[10px] text-emerald-200 flex items-center justify-between">
                      <span>Estado: <strong className="text-white">Clean ({selectedClip.audioCleanup.reductionDb} dB)</strong></span>
                      <span className="text-[9px] font-mono text-emerald-400">+{selectedClip.audioCleanup.snrImprovementDb || 23.6}dB SNR</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenAudioCleanup?.(selectedClip.id)}
                      className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-black font-bold rounded flex items-center justify-center gap-1.5 shadow transition active:scale-95 cursor-pointer text-[11px]"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-black" />
                      <span>{selectedClip.audioCleanup?.isEnabled ? 'Ajustar Limpieza' : 'Limpiar Ruido IA'}</span>
                    </button>
                    <button
                      onClick={() => onOpenAudioCleanup?.(selectedClip.id)}
                      className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold rounded flex items-center justify-center gap-1 border border-slate-700 transition active:scale-95 cursor-pointer text-[11px]"
                      title="Normalizar ganancia de audio a -3 dB estándar"
                    >
                      <Gauge className="w-3.5 h-3.5 text-teal-400" />
                      <span>-3dB</span>
                    </button>
                  </div>
                </div>

                {/* AI Transition Suggest Card */}
                <div className="p-3 bg-gradient-to-br from-amber-950/40 to-purple-950/30 border border-amber-800/40 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300 flex items-center gap-1.5 text-[11px]">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>AI Transition Suggest</span>
                    </span>
                    <span className="text-[9px] font-mono bg-amber-900/60 text-amber-300 border border-amber-700 px-1 py-0.2 rounded font-bold">
                      Gemini
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-300">
                    Analiza la similitud óptica con el clip adyacente y recomienda transiciones óptimas (Light Leak, Zoom Blur o Cross Dissolve).
                  </p>

                  {selectedClip.transitionIn && (
                    <div className="p-2 bg-black/40 rounded border border-amber-900/40 text-[10px] text-amber-200 flex items-center justify-between">
                      <span className="truncate">Transición: <strong>{selectedClip.transitionIn.title}</strong></span>
                      <span className="font-mono text-amber-400 shrink-0 ml-1">{selectedClip.transitionIn.duration}s</span>
                    </div>
                  )}

                  <button
                    onClick={() => onOpenTransitionSuggest?.()}
                    className="w-full py-2 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-bold rounded flex items-center justify-center gap-1.5 shadow transition active:scale-95 cursor-pointer text-[11px]"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
                    <span>Sugerir Transición con Gemini</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Team Review Comments */}
        {activeTab === 'comments' && (
          <div className="space-y-3">
            <div className="p-2.5 bg-[#0f1626] border border-slate-800 rounded-lg space-y-2">
              <span className="font-semibold text-slate-200 text-[11px]">Add Frame Comment at {secondsToTimecode(currentTime)}</span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Leave feedback on this frame..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCommentText.trim()) {
                      onAddComment(newCommentText.trim());
                      setNewCommentText('');
                    }
                  }}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={() => {
                    if (newCommentText.trim()) {
                      onAddComment(newCommentText.trim());
                      setNewCommentText('');
                    }
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1 rounded text-[11px] font-semibold"
                >
                  Post
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={`p-2.5 rounded-lg border transition ${
                    c.status === 'resolved'
                      ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                      : 'bg-[#0f1626] border-purple-900/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <img src={c.avatar} alt="" className="w-4 h-4 rounded-full" />
                      <span className="font-bold text-slate-300 text-[10px]">{c.author}</span>
                    </div>
                    <span className="font-mono text-[9px] text-purple-400 bg-purple-950/80 px-1 py-0.5 rounded">
                      {secondsToTimecode(c.time)}
                    </span>
                  </div>

                  <p className="text-slate-300 text-[11px] my-1">{c.text}</p>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
                    <span className="text-slate-500">{c.createdAt}</span>
                    <button
                      onClick={() => onToggleCommentStatus(c.id)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition ${
                        c.status === 'resolved'
                          ? 'text-emerald-400 bg-emerald-950/50'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      <span>{c.status === 'resolved' ? 'Resolved' : 'Mark Done'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: AI Motion Blur Panel */}
        {activeTab === 'motion_blur' && (
          <MotionBlurPanel
            selectedClip={selectedClip}
            onUpdateClipMotionBlur={onUpdateClipMotionBlur || (() => {})}
            currentTime={currentTime}
          />
        )}
      </div>
    </div>
  );
};
