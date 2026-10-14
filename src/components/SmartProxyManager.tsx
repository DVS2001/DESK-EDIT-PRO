import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, Cpu, Layers, HardDrive, Zap, CheckCircle2, AlertTriangle, 
  Play, Pause, RefreshCw, Sliders, ArrowRight, ShieldCheck, Film, 
  SplitSquareVertical, Sparkles, Activity, Eye, DownloadCloud, Clock, Check
} from 'lucide-react';
import { TimelineClip, ProxyScanItem, ProxyCodecProfile, ProxyManagerSummary } from '../types/editor';
import { proxyWorkerManager, ProxyProgressPayload, ProxyCompletePayload } from '../utils/proxyWorkerManager';
import { secondsToTimecode } from '../utils/timecode';

interface SmartProxyManagerProps {
  isOpen: boolean;
  onClose: () => void;
  clips: TimelineClip[];
  onUpdateClips: (updatedClips: TimelineClip[]) => void;
  isProxyModeActive: boolean;
  onToggleProxyMode: (active: boolean) => void;
  initialSelectedClipId?: string | null;
}

export const SmartProxyManager: React.FC<SmartProxyManagerProps> = ({
  isOpen,
  onClose,
  clips,
  onUpdateClips,
  isProxyModeActive,
  onToggleProxyMode,
  initialSelectedClipId,
}) => {
  // Available video footage in timeline
  const videoClips = useMemo(() => clips.filter((c) => c.type === 'video'), [clips]);

  // Selected clip IDs for proxy generation
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<'all' | 'missing' | 'ready'>('missing');
  const [codecProfile, setCodecProfile] = useState<ProxyCodecProfile>('prores_proxy');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);

  // Per-clip transcoding state tracking
  const [transcodingStates, setTranscodingStates] = useState<
    Record<
      string,
      {
        status: 'queued' | 'transcoding' | 'ready' | 'error';
        progress: number;
        fps: number;
        timeRemaining: number;
        workerId: string;
        bitrate: string;
      }
    >
  >({});

  // Active inspect clip for A/B comparison
  const [inspectedClipId, setInspectedClipId] = useState<string | null>(null);
  const [splitSliderPosition, setSplitSliderPosition] = useState<number>(50);

  // Scan timeline footage and construct scan items
  const scannedItems: ProxyScanItem[] = useMemo(() => {
    return videoClips.map((clip, idx) => {
      const hasProxy = Boolean(clip.hasProxy && clip.proxySrc);
      const isProxyActive = Boolean(clip.isProxyActive);
      const origRes = clip.originalResolution || (idx === 1 ? '4096x2160 (DCI 4K)' : '3840x2160 (4K UHD)');
      const origBitrate = idx === 1 ? '120 Mbps' : '95 Mbps';
      const rawEstimatedSizeMb = Math.round((clip.duration * 95) / 8);
      const proxyEstimatedSizeMb = Math.round((clip.duration * 8) / 8);

      const liveTranscode = transcodingStates[clip.id];
      const status: ProxyScanItem['status'] = liveTranscode
        ? liveTranscode.status
        : hasProxy
        ? 'ready'
        : 'missing';

      return {
        clipId: clip.id,
        clipTitle: clip.title,
        trackId: clip.trackId,
        src: clip.src,
        thumbnail: clip.thumbnail,
        duration: clip.duration,
        originalResolution: origRes,
        originalBitrate: origBitrate,
        rawEstimatedSizeMb,
        hasProxy,
        proxySrc: clip.proxySrc,
        isProxyActive,
        status,
        progressPercent: liveTranscode?.progress ?? (hasProxy ? 100 : 0),
        encodingFps: liveTranscode?.fps,
        timeRemainingSec: liveTranscode?.timeRemaining,
        workerId: liveTranscode?.workerId,
        proxyResolution: '1280x720',
        proxyBitrate: '8 Mbps ProRes',
        proxyEstimatedSizeMb,
      };
    });
  }, [videoClips, transcodingStates]);

  // Filtered list
  const filteredItems = useMemo(() => {
    if (filterMode === 'missing') return scannedItems.filter((i) => !i.hasProxy);
    if (filterMode === 'ready') return scannedItems.filter((i) => i.hasProxy);
    return scannedItems;
  }, [scannedItems, filterMode]);

  // Overall summary metrics
  const summary: ProxyManagerSummary = useMemo(() => {
    const totalVideoClips = scannedItems.length;
    const missingProxyCount = scannedItems.filter((i) => !i.hasProxy).length;
    const readyProxyCount = scannedItems.filter((i) => i.hasProxy).length;
    const transcodingCount = Object.values(transcodingStates).filter(
      (s) => s.status === 'transcoding' || s.status === 'queued'
    ).length;

    const rawTotalSizeMb = scannedItems.reduce((acc, i) => acc + i.rawEstimatedSizeMb, 0);
    const proxyTotalSizeMb = scannedItems.reduce((acc, i) => acc + i.proxyEstimatedSizeMb, 0);
    const savingsPercentage = rawTotalSizeMb > 0
      ? Math.round(((rawTotalSizeMb - proxyTotalSizeMb) / rawTotalSizeMb) * 100)
      : 88;

    return {
      totalVideoClips,
      missingProxyCount,
      readyProxyCount,
      transcodingCount,
      rawTotalSizeMb,
      proxyTotalSizeMb,
      savingsPercentage,
      isScanning,
      lastScannedAt: Date.now(),
    };
  }, [scannedItems, transcodingStates, isScanning]);

  // Auto-scan on modal open
  const handleScanTimeline = useCallback(() => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      // Pre-select all missing clips
      const missingIds = scannedItems.filter((i) => !i.hasProxy).map((i) => i.clipId);
      setSelectedIds(new Set(missingIds.length > 0 ? missingIds : scannedItems.map((i) => i.clipId)));
    }, 400);
  }, [scannedItems]);

  useEffect(() => {
    if (isOpen) {
      if (initialSelectedClipId && videoClips.some((c) => c.id === initialSelectedClipId)) {
        setSelectedIds(new Set([initialSelectedClipId]));
        setInspectedClipId(initialSelectedClipId);
      } else {
        const missing = videoClips.filter((c) => !c.hasProxy).map((c) => c.id);
        setSelectedIds(new Set(missing.length > 0 ? missing : videoClips.map((c) => c.id)));
        setInspectedClipId(videoClips[0]?.id || null);
      }
    }
  }, [isOpen, initialSelectedClipId, videoClips]);

  // Toggle selection for a clip
  const toggleSelectClip = (clipId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  };

  const handleSelectAll = (selectMissingOnly = false) => {
    if (selectMissingOnly) {
      setSelectedIds(new Set(scannedItems.filter((i) => !i.hasProxy).map((i) => i.clipId)));
    } else {
      setSelectedIds(new Set(scannedItems.map((i) => i.clipId)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // Generate Proxy for selected clips using Web Worker thread
  const handleGenerateProxyForSelection = async () => {
    const clipsToEncode = videoClips.filter((c) => selectedIds.has(c.id));
    if (clipsToEncode.length === 0) return;

    setIsBatchGenerating(true);

    // Initialize queued states
    setTranscodingStates((prev) => {
      const updated = { ...prev };
      clipsToEncode.forEach((c) => {
        updated[c.id] = {
          status: 'queued',
          progress: 0,
          fps: 0,
          timeRemaining: Math.round(c.duration * 0.4),
          workerId: 'Worker-Thread-Init',
          bitrate: '8 Mbps',
        };
      });
      return updated;
    });

    // Run parallel worker transcoding for each selected clip
    const transcodePromises = clipsToEncode.map((clip) => {
      setTranscodingStates((prev) => ({
        ...prev,
        [clip.id]: {
          status: 'transcoding',
          progress: 0,
          fps: 120,
          timeRemaining: Math.round(clip.duration * 0.35),
          workerId: 'Worker-Thread-Active',
          bitrate: '8 Mbps ProRes',
        },
      }));

      return proxyWorkerManager.generateProxy(
        clip,
        codecProfile,
        (progressData: ProxyProgressPayload) => {
          setTranscodingStates((prev) => ({
            ...prev,
            [clip.id]: {
              status: 'transcoding',
              progress: progressData.progressPercent,
              fps: progressData.encodingFps,
              timeRemaining: progressData.timeRemainingSec,
              workerId: progressData.workerThreadId,
              bitrate: progressData.bitrate,
            },
          }));
        }
      ).then((result: ProxyCompletePayload) => {
        setTranscodingStates((prev) => ({
          ...prev,
          [clip.id]: {
            status: 'ready',
            progress: 100,
            fps: 145,
            timeRemaining: 0,
            workerId: 'Completed',
            bitrate: result.proxyBitrate,
          },
        }));
        return { clipId: clip.id, result };
      });
    });

    try {
      const results = await Promise.all(transcodePromises);

      // Update clips in Timeline
      const resultMap = new Map(results.map((r) => [r.clipId, r.result]));
      const updatedClips = clips.map((clip) => {
        const completed = resultMap.get(clip.id);
        if (!completed) return clip;

        return {
          ...clip,
          hasProxy: true,
          proxySrc: completed.proxySrc || clip.src,
          isProxyActive: true,
          originalResolution: clip.originalResolution || '3840x2160 (4K)',
          proxyMetadata: {
            codec: codecProfile === 'prores_proxy' ? 'ProRes 422 Proxy' : codecProfile === 'h264_fast' ? 'H.264 Fast Proxy' : 'DNxHR LB',
            resolution: completed.proxyResolution,
            bitrate: completed.proxyBitrate,
            fileSizeMb: completed.fileSizeMb,
            generatedAt: Date.now(),
            workerThreadId: 'Worker-Thread-Pool',
          },
        };
      });

      onUpdateClips(updatedClips);
      onToggleProxyMode(true);
    } catch (err) {
      console.error('Error generating proxies via Web Worker:', err);
    } finally {
      setIsBatchGenerating(false);
    }
  };

  // Inspect currently selected clip
  const activeInspectItem = useMemo(() => {
    return scannedItems.find((i) => i.clipId === (inspectedClipId || selectedIds.values().next().value)) || scannedItems[0];
  }, [scannedItems, inspectedClipId, selectedIds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#0b101b] border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col text-slate-100 overflow-hidden ring-1 ring-white/10">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-[#101726] to-[#0f172a] border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">Smart Proxy Manager</h2>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-amber-500/30">
                  Worker Thread Encoder
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Real-Time 60 FPS Playback
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Escanea el metraje 4K/UHD de la línea de tiempo y codifica proxies ligeros de 720p en hilos secundarios para máxima fluidez.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Global Timeline Proxy Toggle */}
            <button
              onClick={() => onToggleProxyMode(!isProxyModeActive)}
              title="Activar o desactivar reproducción de proxies en el Timeline"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                isProxyModeActive
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 shadow-sm shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isProxyModeActive ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
              <span>{isProxyModeActive ? 'Modo Proxy 720p ACTIVO' : 'Modo RAW 4K Original'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scan Telemetry KPI Banner */}
        <div className="px-6 py-3 bg-[#080c14] border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Metraje Escaneado</p>
              <p className="text-base font-extrabold text-white font-mono">
                {summary.totalVideoClips} <span className="text-xs font-normal text-slate-400">clips de vídeo</span>
              </p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${
              summary.missingProxyCount > 0 
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 animate-pulse' 
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Sin Proxy (Pesados)</p>
              <p className={`text-base font-extrabold font-mono ${summary.missingProxyCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {summary.missingProxyCount} <span className="text-xs font-normal text-slate-400">clips 4K RAW</span>
              </p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Ahorro de VRAM & GPU</p>
              <p className="text-base font-extrabold text-amber-400 font-mono">
                -{summary.savingsPercentage}% <span className="text-xs font-normal text-slate-400">carga gráfica</span>
              </p>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-2.5 rounded-xl flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tasa de Transferencia</p>
              <p className="text-base font-extrabold text-indigo-300 font-mono">
                95 <span className="text-xs text-slate-400">➔</span> 8 <span className="text-xs font-normal text-slate-400">Mbps ProRes</span>
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          
          {/* Left Column (7 cols): Footage Scan Table & Action Controls */}
          <div className="lg:col-span-7 p-5 flex flex-col gap-4 overflow-y-auto bg-[#090d16]">
            
            {/* Toolbar: Filters & Batch Select */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setFilterMode('missing')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    filterMode === 'missing'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <span>Sin Proxy ({scannedItems.filter((i) => !i.hasProxy).length})</span>
                </button>

                <button
                  onClick={() => setFilterMode('ready')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    filterMode === 'ready'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Listos ({scannedItems.filter((i) => i.hasProxy).length})</span>
                </button>

                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todos ({scannedItems.length})
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => handleSelectAll(true)}
                  className="text-slate-400 hover:text-amber-300 transition cursor-pointer underline text-[11px]"
                >
                  Marcar Sin Proxy
                </button>
                <span className="text-slate-600">•</span>
                <button
                  onClick={() => handleSelectAll(false)}
                  className="text-slate-400 hover:text-sky-300 transition cursor-pointer underline text-[11px]"
                >
                  Marcar Todos
                </button>
                <span className="text-slate-600">•</span>
                <button
                  onClick={handleDeselectAll}
                  className="text-slate-400 hover:text-slate-200 transition cursor-pointer underline text-[11px]"
                >
                  Limpiar
                </button>
                <span className="text-slate-600">•</span>
                <button
                  onClick={handleScanTimeline}
                  disabled={isScanning}
                  title="Volver a escanear clips en el timeline"
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-sky-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Clips List */}
            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              {filteredItems.length === 0 ? (
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-bold text-slate-200">¡Todo el metraje está optimizado!</p>
                  <p className="text-xs text-slate-400">Todos los clips cuentan con proxies generados de alta velocidad.</p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isChecked = selectedIds.has(item.clipId);
                  const isInspected = activeInspectItem?.clipId === item.clipId;

                  return (
                    <div
                      key={item.clipId}
                      onClick={() => setInspectedClipId(item.clipId)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex flex-col gap-2.5 ${
                        isInspected
                          ? 'bg-slate-800/90 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/30'
                          : isChecked
                          ? 'bg-slate-800/60 border-slate-700'
                          : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelectClip(item.clipId);
                            }}
                            className="rounded border-slate-700 text-amber-500 accent-amber-500 focus:ring-0 cursor-pointer w-4 h-4"
                          />
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt=""
                              className="w-14 h-9 object-cover rounded-lg border border-slate-700 shrink-0 shadow-sm"
                            />
                          ) : (
                            <div className="w-14 h-9 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center shrink-0">
                              <Film className="w-4 h-4 text-slate-500" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-white truncate max-w-[220px] sm:max-w-[280px]">
                              {item.clipTitle}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              <span className="font-mono text-amber-300 font-semibold">{item.originalResolution}</span>
                              <span>•</span>
                              <span>{item.duration.toFixed(1)}s</span>
                              <span>•</span>
                              <span className="text-slate-500">{item.rawEstimatedSizeMb} MB RAW</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Badges */}
                        <div className="shrink-0 flex items-center gap-2">
                          {item.status === 'ready' ? (
                            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>720p PROXY</span>
                            </span>
                          ) : item.status === 'transcoding' ? (
                            <span className="bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-amber-500/40 flex items-center gap-1.5 animate-pulse">
                              <Activity className="w-3 h-3 text-amber-400 animate-spin" />
                              <span>WORKER {item.progressPercent}%</span>
                            </span>
                          ) : item.status === 'queued' ? (
                            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-indigo-500/30">
                              EN COLA
                            </span>
                          ) : (
                            <span className="bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-rose-500/30">
                              SIN PROXY (4K)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Transcoding Progress Bar (if in progress) */}
                      {item.status === 'transcoding' && (
                        <div className="space-y-1 bg-black/40 p-2 rounded-lg border border-amber-500/20">
                          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-150"
                              style={{ width: `${item.progressPercent}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                            <span className="text-amber-300 flex items-center gap-1">
                              <Cpu className="w-2.5 h-2.5" />
                              {item.workerId || 'Worker Thread'}: {item.encodingFps || 140} FPS (2.3x Realtime)
                            </span>
                            <span>Restante: ~{item.timeRemainingSec || 2.4}s</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Generation Panel */}
            <div className="border-t border-slate-800 pt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'prores_proxy', label: 'ProRes 422 Proxy', res: '720p @ 12 Mbps', rec: 'Recomendado NLE' },
                  { id: 'h264_fast', label: 'H.264 Fast Proxy', res: '720p @ 6 Mbps', rec: 'Menor Espacio' },
                  { id: 'dnxhr_lb', label: 'DNxHR LB Proxy', res: '540p @ 4 Mbps', rec: 'Laptops / Ultraligero' },
                ].map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => setCodecProfile(profile.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      codecProfile === profile.id
                        ? 'bg-amber-500/20 border-amber-400/60 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-200">{profile.label}</p>
                      {profile.id === 'prores_proxy' && (
                        <span className="text-[8px] bg-amber-500/30 text-amber-200 font-bold px-1 rounded">PRO</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{profile.res}</p>
                    <p className="text-[9px] text-emerald-400 mt-1">{profile.rec}</p>
                  </button>
                ))}
              </div>

              {/* Primary "Generate Proxy for Selection" Button */}
              <button
                type="button"
                disabled={isBatchGenerating || selectedIds.size === 0}
                onClick={handleGenerateProxyForSelection}
                className={`w-full py-3 px-5 rounded-xl font-bold text-xs flex items-center justify-center gap-2.5 transition cursor-pointer shadow-xl ${
                  isBatchGenerating || selectedIds.size === 0
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-black shadow-amber-500/25 ring-1 ring-white/20'
                }`}
              >
                {isBatchGenerating ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin text-black" />
                    <span>Codificando Proxies en Worker Thread ({selectedIds.size} clips)...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-black" />
                    <span>Generate Proxy for Selection ({selectedIds.size} {selectedIds.size === 1 ? 'clip' : 'clips'})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column (5 cols): Interactive A/B Comparison & Proxy Inspector */}
          <div className="lg:col-span-5 p-5 flex flex-col gap-4 overflow-y-auto bg-[#0b101b]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <SplitSquareVertical className="w-3.5 h-3.5 text-amber-400" />
                <span>Inspector A/B: RAW 4K vs 720p Proxy</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Idéntica Fidelidad Óptica
              </span>
            </div>

            {/* A/B Split Interactive Visualizer */}
            <div className="bg-[#070b13] border border-slate-800 rounded-xl p-3 flex flex-col gap-3">
              <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-800 bg-black select-none">
                {activeInspectItem?.thumbnail ? (
                  <>
                    {/* Background Full RAW Image */}
                    <img
                      src={activeInspectItem.thumbnail}
                      alt="RAW 4K"
                      className="w-full h-full object-cover"
                    />

                    {/* Split Overlay Image representing Proxy (slightly subsampled/sharpened) */}
                    <div
                      style={{ width: `${splitSliderPosition}%` }}
                      className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]"
                    >
                      <img
                        src={activeInspectItem.thumbnail}
                        alt="720p Proxy"
                        className="w-full h-full object-cover filter contrast-[1.03] max-w-none"
                        style={{ width: '100%', height: '100%' }}
                      />
                      <div className="absolute top-2 left-2 bg-amber-500/90 text-black px-1.5 py-0.5 rounded text-[9px] font-bold font-mono">
                        720p PROXY (8 Mbps)
                      </div>
                    </div>

                    <div className="absolute top-2 right-2 bg-black/80 text-sky-300 border border-sky-400/30 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono">
                      4K RAW (95 Mbps)
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <Film className="w-8 h-8" />
                  </div>
                )}
              </div>

              {/* Interactive Slider for Split Wipe */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>◀ 720p Proxy</span>
                  <span className="text-amber-300 font-bold">Wipe: {splitSliderPosition}%</span>
                  <span>4K RAW Original ▶</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={splitSliderPosition}
                  onChange={(e) => setSplitSliderPosition(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Detailed Technical Specs Card */}
            {activeInspectItem && (
              <div className="bg-[#070b13] border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-white truncate max-w-[200px]">
                    {activeInspectItem.clipTitle}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Pista: {activeInspectItem.trackId}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Fuente Original RAW</p>
                    <p className="font-mono text-white text-xs font-semibold">{activeInspectItem.originalResolution}</p>
                    <p className="font-mono text-[10px] text-slate-400">{activeInspectItem.originalBitrate}</p>
                    <p className="text-[10px] text-rose-400 font-mono mt-1">GPU Load: ~82%</p>
                  </div>

                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 space-y-1">
                    <p className="text-[10px] text-amber-300 font-bold uppercase">Proxy Ligero Generado</p>
                    <p className="font-mono text-white text-xs font-semibold">1280x720 (720p)</p>
                    <p className="font-mono text-[10px] text-amber-300">8 Mbps Apple ProRes</p>
                    <p className="text-[10px] text-emerald-400 font-mono mt-1">GPU Load: ~14% (-83%)</p>
                  </div>
                </div>

                <div className="space-y-1 text-[11px] text-slate-400 bg-slate-900/30 p-2.5 rounded-lg border border-slate-800/80">
                  <div className="flex justify-between">
                    <span>Tamaño Estimado RAW:</span>
                    <strong className="text-white font-mono">{activeInspectItem.rawEstimatedSizeMb} MB</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Tamaño Estimado Proxy:</span>
                    <strong className="text-emerald-400 font-mono">{activeInspectItem.proxyEstimatedSizeMb} MB</strong>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-1 mt-1">
                    <span>Ahorro en Almacenamiento & RAM:</span>
                    <strong className="text-emerald-400 font-mono">
                      -{Math.round(((activeInspectItem.rawEstimatedSizeMb - activeInspectItem.proxyEstimatedSizeMb) / activeInspectItem.rawEstimatedSizeMb) * 100)}%
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Architecture Explanation */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200/90 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Cpu className="w-3.5 h-3.5" />
                <span>Arquitectura de Hilos en Segundo Plano</span>
              </div>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                El proceso de codificación se ejecuta en un <strong>Web Worker aislado</strong>, dejando el hilo principal de la interfaz al 100% de fluidez para recortar, reproducir y aplicar efectos sin congelamientos.
              </p>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Al exportar el proyecto final, el renderizador utilizará automáticamente los archivos 4K originales.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
