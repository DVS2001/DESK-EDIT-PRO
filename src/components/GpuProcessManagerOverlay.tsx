import React, { useState, useMemo, useEffect } from 'react';
import { 
  Server, Cpu, Activity, AlertOctagon, AlertTriangle, CheckCircle2, 
  X, RefreshCw, Trash2, PowerOff, ShieldAlert, Zap, HardDrive, 
  Terminal, Search, Filter, Layers, Clock, ArrowDownRight, Sparkles,
  BarChart3, ShieldCheck
} from 'lucide-react';
import { CloudRenderJob } from '../types/editor';

export interface GpuProcess {
  pid: number;
  name: string;
  type: 'cloud_worker' | 'local_webgl' | 'compute_shader' | 'ai_inference' | 'video_decoder';
  jobId?: string;
  status: 'running' | 'hung' | 'idle' | 'terminating';
  vramUsageMb: number;
  vramPeakMb: number;
  gpuCorePercent: number;
  durationSeconds: number;
  nodeId: string;
  clusterIp: string;
  hangReason?: string;
  threadCount: number;
  priority: 'normal' | 'high' | 'realtime';
}

interface GpuProcessManagerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  activeQueueJobs?: CloudRenderJob[];
  currentGpuLoad?: number;
  totalVramMb?: number;
  onKillCloudJob?: (jobId: string) => void;
}

export const GpuProcessManagerOverlay: React.FC<GpuProcessManagerOverlayProps> = ({
  isOpen,
  onClose,
  activeQueueJobs = [],
  currentGpuLoad = 35,
  totalVramMb = 8192,
  onKillCloudJob,
}) => {
  // Initial realistic rendering processes
  const [processes, setProcesses] = useState<GpuProcess[]>([
    {
      pid: 48921,
      name: 'ffmpeg-accel-worker-4k',
      type: 'cloud_worker',
      jobId: 'job-98a1-4k',
      status: 'idle',
      vramUsageMb: 1420,
      vramPeakMb: 2850,
      gpuCorePercent: 0,
      durationSeconds: 142,
      nodeId: 'worker-node-us-east-01',
      clusterIp: '10.142.8.21',
      threadCount: 16,
      priority: 'high',
    },
    {
      pid: 51204,
      name: 'nvenc-hevc-stream-node',
      type: 'cloud_worker',
      jobId: 'job-44c2-social',
      status: 'running',
      vramUsageMb: 1180,
      vramPeakMb: 1820,
      gpuCorePercent: 38,
      durationSeconds: 78,
      nodeId: 'worker-node-us-east-04',
      clusterIp: '10.142.8.24',
      threadCount: 24,
      priority: 'high',
    },
    {
      pid: 60192,
      name: 'cloud-chunk-render-h264',
      type: 'cloud_worker',
      jobId: 'job-chunk-9',
      status: 'running',
      vramUsageMb: 1440,
      vramPeakMb: 1950,
      gpuCorePercent: 34,
      durationSeconds: 98,
      nodeId: 'worker-node-eu-west-02',
      clusterIp: '10.142.9.11',
      threadCount: 32,
      priority: 'high',
    },
    {
      pid: 24018,
      name: 'webgl2-compositor-viewport',
      type: 'local_webgl',
      status: 'running',
      vramUsageMb: 890,
      vramPeakMb: 1240,
      gpuCorePercent: Math.min(65, Math.round(currentGpuLoad * 0.6)),
      durationSeconds: 620,
      nodeId: 'local-browser-gpu',
      clusterIp: '127.0.0.1',
      threadCount: 8,
      priority: 'high',
    },
    {
      pid: 31094,
      name: 'gemini-embedding-tensor-core',
      type: 'ai_inference',
      status: 'idle',
      vramUsageMb: 640,
      vramPeakMb: 1100,
      gpuCorePercent: 4,
      durationSeconds: 315,
      nodeId: 'inference-node-03',
      clusterIp: '10.142.12.08',
      threadCount: 12,
      priority: 'normal',
    },
    {
      pid: 44109,
      name: 'prores-hardware-decoder-pipe',
      type: 'video_decoder',
      status: 'running',
      vramUsageMb: 760,
      vramPeakMb: 980,
      gpuCorePercent: 18,
      durationSeconds: 195,
      nodeId: 'media-streamer-02',
      clusterIp: '10.142.8.55',
      threadCount: 8,
      priority: 'normal',
    },
  ]);

  // Sync active jobs into process list if they aren't represented
  useEffect(() => {
    if (activeQueueJobs && activeQueueJobs.length > 0) {
      setProcesses((prev) => {
        const next = [...prev];
        activeQueueJobs.forEach((job) => {
          const exists = next.some(p => p.jobId === job.id);
          if (!exists) {
            next.push({
              pid: 70000 + Math.floor(Math.random() * 9000),
              name: `cloud-render-${job.preset.toLowerCase()}`,
              type: 'cloud_worker',
              jobId: job.id,
              status: job.status === 'processing' ? 'running' : 'idle',
              vramUsageMb: job.preset.includes('4K') ? 2450 : 1120,
              vramPeakMb: job.preset.includes('4K') ? 3100 : 1450,
              gpuCorePercent: job.status === 'processing' ? 42 : 0,
              durationSeconds: 45,
              nodeId: `worker-node-dyn-${job.id.slice(-4)}`,
              clusterIp: `10.142.15.${(job.id.charCodeAt(0) % 200) + 10}`,
              threadCount: 16,
              priority: 'high',
            });
          }
        });
        return next;
      });
    }
  }, [activeQueueJobs]);

  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPid, setSelectedPid] = useState<number | null>(60192); // Default focus on hung job
  const [killConfirmPid, setKillConfirmPid] = useState<number | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'vram' | 'gpu' | 'pid' | 'time'>('vram');

  // Realistic telemetry totals
  const totalAllocatedVram = useMemo(() => {
    return processes.reduce((acc, p) => acc + (p.status !== 'terminating' ? p.vramUsageMb : 0), 0);
  }, [processes]);

  const hungCount = useMemo(() => {
    return processes.filter(p => p.status === 'hung').length;
  }, [processes]);

  const vramPercentage = Math.min(100, Math.round((totalAllocatedVram / totalVramMb) * 100));

  // Kill process action handler
  const handleKillProcess = (proc: GpuProcess) => {
    // Immediate UI feedback
    setProcesses((prev) => 
      prev.map(p => p.pid === proc.pid ? { ...p, status: 'terminating', gpuCorePercent: 0 } : p)
    );
    setKillConfirmPid(null);

    // Call upstream cloud kill hook if provided
    if (proc.jobId && onKillCloudJob) {
      onKillCloudJob(proc.jobId);
    }

    setActionFeedback(`Señal SIGKILL (9) enviada con éxito a PID ${proc.pid} (${proc.name}). Liberando ${proc.vramUsageMb} MB VRAM.`);

    setTimeout(() => {
      setProcesses((prev) => prev.filter(p => p.pid !== proc.pid));
      if (selectedPid === proc.pid) {
        setSelectedPid(null);
      }
    }, 1200);

    setTimeout(() => {
      setActionFeedback(null);
    }, 4500);
  };

  // Simulate injecting a hung cloud task for testing
  const handleSimulateHungTask = () => {
    const newPid = 80000 + Math.floor(Math.random() * 9000);
    const newHungProcess: GpuProcess = {
      pid: newPid,
      name: `render-node-av1-hang-${newPid}`,
      type: 'cloud_worker',
      jobId: `job-hang-${newPid}`,
      status: 'hung',
      vramUsageMb: 4120,
      vramPeakMb: 4400,
      gpuCorePercent: 98,
      durationSeconds: 520,
      nodeId: `worker-node-us-west-${Math.floor(Math.random() * 8) + 1}`,
      clusterIp: `10.142.18.${Math.floor(Math.random() * 80) + 10}`,
      hangReason: 'Incompatibilidad de buffer en GPU remota: Frame buffer lock sin respuesta hace 8m 40s',
      threadCount: 32,
      priority: 'realtime',
    };

    setProcesses((prev) => [newHungProcess, ...prev]);
    setSelectedPid(newPid);
    setActionFeedback(`Proceso de prueba colgado inyectado (PID ${newPid}). Puedes usar "Kill Process" o "Corregir Errores" para liberarlo.`);
    setTimeout(() => setActionFeedback(null), 5000);
  };

  // Auto-repair all programmed errors (hung processes, deadlocks, stuck workers)
  const handleFixAllProgrammedErrors = () => {
    setProcesses((prev) =>
      prev.map((p) => {
        if (p.status === 'hung') {
          return {
            ...p,
            name: p.name.replace(' [HANG_STATE]', ''),
            status: 'running',
            gpuCorePercent: 28,
            vramUsageMb: Math.min(p.vramUsageMb, 1200),
            hangReason: undefined,
          };
        }
        return p;
      })
    );
    setActionFeedback('✓ ¡Todos los errores programados han sido corregidos con éxito! Procesos colgados reparados y GPU en estado nominal.');
    setTimeout(() => setActionFeedback(null), 5000);
  };

  // Filtered and sorted processes
  const filteredProcesses = useMemo(() => {
    return processes
      .filter((p) => {
        if (filterType !== 'all' && p.type !== filterType) return false;
        if (filterStatus !== 'all' && p.status !== filterStatus) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchNode = p.nodeId.toLowerCase().includes(q);
          const matchPid = String(p.pid).includes(q);
          const matchJob = p.jobId?.toLowerCase().includes(q);
          if (!matchName && !matchNode && !matchPid && !matchJob) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortField === 'vram') return b.vramUsageMb - a.vramUsageMb;
        if (sortField === 'gpu') return b.gpuCorePercent - a.gpuCorePercent;
        if (sortField === 'pid') return a.pid - b.pid;
        if (sortField === 'time') return b.durationSeconds - a.durationSeconds;
        return 0;
      });
  }, [processes, filterType, filterStatus, searchQuery, sortField]);

  const selectedProcess = processes.find(p => p.pid === selectedPid);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gpu-process-manager-title"
    >
      <div className="bg-[#080d1a] border border-sky-800/80 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl shadow-sky-950/60 overflow-hidden text-slate-200">
        
        {/* Top Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#0d162b] via-[#09101f] to-[#0a1324] border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/40 flex items-center justify-center flex-shrink-0 text-sky-400">
              <Server className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="gpu-process-manager-title" className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>GPU Process Manager &amp; Task Killer</span>
                </h3>
                <span className="text-[10px] font-mono bg-sky-950 text-sky-300 border border-sky-700/60 px-2 py-0.5 rounded font-bold">
                  Cluster Telemetry
                </span>
                {hungCount > 0 && (
                  <span className="text-[10px] font-mono bg-red-600 text-white px-2 py-0.5 rounded font-black animate-pulse flex items-center gap-1 shadow-sm shadow-red-500/40">
                    <AlertOctagon className="w-3 h-3" />
                    {hungCount} PROCESO{hungCount > 1 ? 'S' : ''} COLGADO{hungCount > 1 ? 'S' : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Monitoriza huella de memoria (VRAM) de tareas individuales, núcleos GPU y termina trabajos colgados en la nube.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFixAllProgrammedErrors}
              className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 text-white transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
              title="Corregir y recuperar todos los procesos colgados o con errores programados"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-100" />
              <span>Corregir Errores</span>
            </button>

            <button
              onClick={handleSimulateHungTask}
              className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium bg-red-950/50 hover:bg-red-900/60 border border-red-700/60 text-red-300 transition flex items-center gap-1.5 cursor-pointer"
              title="Inyecta una tarea de renderizado colgada para probar la terminación de procesos forzada"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Simular Tarea Colgada</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              aria-label="Cerrar administrador de procesos"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Memory Footprint & Stats Bar */}
        <div className="px-5 py-3 bg-[#050811] border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-[#0a101f] p-2.5 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span className="flex items-center gap-1 font-sans">
                <HardDrive className="w-3.5 h-3.5 text-sky-400" /> VRAM Asignada
              </span>
              <span className="font-bold text-sky-300">{vramPercentage}%</span>
            </div>
            <div className="text-sm font-bold text-white">
              {(totalAllocatedVram / 1024).toFixed(2)} GB <span className="text-slate-500 text-[10px]">/ {(totalVramMb / 1024).toFixed(1)} GB</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${
                  vramPercentage > 85 ? 'bg-red-500' : vramPercentage > 65 ? 'bg-amber-400' : 'bg-sky-400'
                }`}
                style={{ width: `${vramPercentage}%` }}
              />
            </div>
          </div>

          <div className="bg-[#0a101f] p-2.5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 text-[11px] flex items-center gap-1 font-sans">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> Procesos Activos
            </span>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>{processes.length} PIDs</span>
              <span className="text-[10px] text-slate-400">({processes.filter(p => p.status === 'running').length} en cómputo)</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-sans block">Cluster Multi-GPU OK</span>
          </div>

          <div className="bg-[#0a101f] p-2.5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 text-[11px] flex items-center gap-1 font-sans">
              <AlertOctagon className="w-3.5 h-3.5 text-red-400" /> Trabajos Colgados
            </span>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span className={hungCount > 0 ? 'text-red-400 font-extrabold' : 'text-slate-300'}>
                {hungCount} Bloqueado{hungCount !== 1 ? 's' : ''}
              </span>
              {hungCount > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />}
            </div>
            <span className="text-[10px] text-slate-400 font-sans block">
              {hungCount > 0 ? 'Requiere Kill Process' : 'Sin bloqueos detectados'}
            </span>
          </div>

          <div className="bg-[#0a101f] p-2.5 rounded-xl border border-slate-800 space-y-1">
            <span className="text-slate-400 text-[11px] flex items-center gap-1 font-sans">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Tasa de Liberación
            </span>
            <div className="text-sm font-bold text-white">
              Instantánea &bull; SIGKILL
            </div>
            <span className="text-[10px] text-sky-400 font-sans block">Recupera VRAM en ~1.2s</span>
          </div>
        </div>

        {/* Action Feedback Toast */}
        {actionFeedback && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-gradient-to-r from-red-950/70 via-slate-900 to-sky-950/70 border border-red-500/60 text-xs flex items-center justify-between gap-3 text-red-200 animate-fade-in shadow-lg">
            <div className="flex items-center gap-2 font-mono">
              <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0 animate-pulse" />
              <span>{actionFeedback}</span>
            </div>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Search, Filters and Sort Toolbar */}
        <div className="px-5 py-3 bg-[#060a14] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por PID, nombre de tarea, ID de trabajo o nodo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0a101f] border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter by Type */}
            <div className="flex items-center gap-1 bg-[#0a101f] p-1 rounded-xl border border-slate-800 text-[11px]">
              <span className="text-slate-400 px-1 font-mono">Tipo:</span>
              <button
                onClick={() => setFilterType('all')}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                  filterType === 'all' ? 'bg-sky-500/20 text-sky-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterType('cloud_worker')}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                  filterType === 'cloud_worker' ? 'bg-sky-500/20 text-sky-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Nube
              </button>
              <button
                onClick={() => setFilterType('local_webgl')}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                  filterType === 'local_webgl' ? 'bg-sky-500/20 text-sky-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Local
              </button>
            </div>

            {/* Filter by Status */}
            <div className="flex items-center gap-1 bg-[#0a101f] p-1 rounded-xl border border-slate-800 text-[11px]">
              <span className="text-slate-400 px-1 font-mono">Estado:</span>
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                  filterStatus === 'all' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterStatus('hung')}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                  filterStatus === 'hung' ? 'bg-red-500/30 text-red-300 font-bold border border-red-500/50' : 'text-red-400/80 hover:text-red-200'
                }`}
              >
                Colgados ({hungCount})
              </button>
              <button
                onClick={() => setFilterStatus('running')}
                className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                  filterStatus === 'running' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                En Ejecución
              </button>
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="bg-[#0a101f] border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs text-slate-300 font-mono focus:outline-none focus:border-sky-500 cursor-pointer"
            >
              <option value="vram">Ordenar: Mayor VRAM</option>
              <option value="gpu">Ordenar: Mayor Carga GPU</option>
              <option value="time">Ordenar: Mayor Tiempo</option>
              <option value="pid">Ordenar: PID</option>
            </select>
          </div>
        </div>

        {/* Main Content Area: Split View (Process Table + Selected Process Diagnostics) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[380px]">
          
          {/* Left / Center Table: List of Rendering Tasks & Memory Footprints */}
          <div className="lg:col-span-8 overflow-y-auto divide-y divide-slate-800/80 bg-[#070b16]">
            {filteredProcesses.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-semibold">No se encontraron procesos con los filtros actuales.</p>
                <p className="text-xs text-slate-500 font-mono">Prueba cambiando los criterios de búsqueda.</p>
              </div>
            ) : (
              filteredProcesses.map((proc) => {
                const isSelected = selectedPid === proc.pid;
                const isHung = proc.status === 'hung';
                const isTerminating = proc.status === 'terminating';
                const vramPercentOfTotal = Math.round((proc.vramUsageMb / totalVramMb) * 100);

                return (
                  <div
                    key={proc.pid}
                    onClick={() => setSelectedPid(proc.pid)}
                    className={`p-3.5 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-sky-950/40 border-l-4 border-l-sky-400'
                        : isHung
                        ? 'bg-red-950/20 hover:bg-red-950/35 border-l-4 border-l-red-500'
                        : 'hover:bg-[#0a1224] border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-black text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/60">
                          PID {proc.pid}
                        </span>

                        <span className="font-bold text-white text-xs sm:text-sm truncate">
                          {proc.name}
                        </span>

                        {/* Status Badges */}
                        {isHung && (
                          <span className="text-[10px] font-mono uppercase font-black px-2 py-0.5 rounded bg-red-600 text-white animate-pulse flex items-center gap-1 shadow-sm shadow-red-500/30">
                            <AlertOctagon className="w-3 h-3" />
                            COLGADO (HUNG)
                          </span>
                        )}

                        {proc.status === 'running' && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Activo
                          </span>
                        )}

                        {proc.status === 'idle' && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">
                            En reposo
                          </span>
                        )}

                        {isTerminating && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-bold animate-pulse">
                            Terminando...
                          </span>
                        )}

                        <span className="text-[10px] font-mono text-slate-400 bg-black/40 px-1.5 py-0.5 rounded border border-slate-800">
                          {proc.nodeId}
                        </span>
                      </div>

                      {/* Memory Footprint Progress & Meta */}
                      <div className="flex items-center gap-4 text-xs font-mono text-slate-400 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                          <span>Huella VRAM:</span>
                          <strong className="text-sky-200">{proc.vramUsageMb} MB</strong>
                          <span className="text-[10px] text-slate-500">({vramPercentOfTotal}% del total)</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-amber-400" />
                          <span>Carga GPU:</span>
                          <strong className={proc.gpuCorePercent > 80 ? 'text-red-400' : 'text-amber-200'}>
                            {proc.gpuCorePercent}%
                          </strong>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Tiempo:</span>
                          <span className="text-slate-300">
                            {Math.floor(proc.durationSeconds / 60)}m {proc.durationSeconds % 60}s
                          </span>
                        </div>

                        {proc.jobId && (
                          <div className="text-[10px] text-slate-500 truncate">
                            Job: <span className="text-slate-300">{proc.jobId}</span>
                          </div>
                        )}
                      </div>

                      {/* Memory footprint bar */}
                      <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden max-w-md">
                        <div 
                          className={`h-full ${
                            isHung ? 'bg-red-500' : proc.vramUsageMb > 2500 ? 'bg-amber-400' : 'bg-sky-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, vramPercentOfTotal * 2.5))}%` }}
                        />
                      </div>
                    </div>

                    {/* Kill Process Action Button */}
                    <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                      {killConfirmPid === proc.pid ? (
                        <div className="flex items-center gap-1.5 animate-fade-in bg-red-950/80 p-1.5 rounded-xl border border-red-500">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleKillProcess(proc);
                            }}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer shadow-md"
                          >
                            <PowerOff className="w-3 h-3" />
                            Confirmar Kill
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setKillConfirmPid(null);
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isHung) {
                              // If already hung, allow instant 1-click kill or confirmation
                              handleKillProcess(proc);
                            } else {
                              setKillConfirmPid(proc.pid);
                            }
                          }}
                          disabled={isTerminating}
                          className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer border ${
                            isHung
                              ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white border-red-400 shadow-md shadow-red-600/30 animate-pulse'
                              : 'bg-slate-900/80 hover:bg-red-950/80 text-slate-300 hover:text-red-200 border-slate-700 hover:border-red-600/60'
                          } disabled:opacity-40`}
                          title={`Terminar proceso PID ${proc.pid} y liberar memoria asignada`}
                        >
                          <PowerOff className="w-3.5 h-3.5 text-current" />
                          <span>Kill Process</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Panel: Selected Process Deep Diagnostics & Cluster Node Inspector */}
          <div className="lg:col-span-4 bg-[#050914] border-t lg:border-t-0 lg:border-l border-slate-800/80 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto space-y-4">
            {selectedProcess ? (
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Diagnóstico de Tarea</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800 font-bold">
                      PID {selectedProcess.pid}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mt-1 break-words">{selectedProcess.name}</h4>
                  <span className="text-xs text-slate-400 font-mono block mt-0.5">
                    Nodo: <strong className="text-sky-300">{selectedProcess.nodeId}</strong> ({selectedProcess.clusterIp})
                  </span>
                </div>

                {/* Critical Hang Diagnostic Warning Box */}
                {selectedProcess.status === 'hung' && (
                  <div className="p-3.5 bg-red-950/50 border border-red-500/70 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-red-300 font-bold text-xs font-mono">
                      <AlertOctagon className="w-4 h-4 text-red-400 animate-bounce" />
                      <span>DEADLOCK DETECTADO EN KERNEL GPU</span>
                    </div>
                    <p className="text-xs text-red-200 leading-relaxed font-mono">
                      {selectedProcess.hangReason || 'La tarea dejó de emitir señales de vida de chunks hacia el cluster central.'}
                    </p>
                    <div className="pt-1 text-[11px] text-slate-300 font-sans">
                      Impacto: Retiene <strong>{selectedProcess.vramUsageMb} MB de VRAM</strong> en el cluster e impide que otros renders avancen.
                    </div>
                  </div>
                )}

                {/* Process Detailed Metrics */}
                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between p-2 rounded bg-black/40 border border-slate-800">
                    <span className="text-slate-400">Huella de VRAM Actual:</span>
                    <strong className="text-sky-300 font-bold">{selectedProcess.vramUsageMb} MB</strong>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-black/40 border border-slate-800">
                    <span className="text-slate-400">Pico Máximo de Memoria:</span>
                    <strong className="text-white">{selectedProcess.vramPeakMb} MB</strong>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-black/40 border border-slate-800">
                    <span className="text-slate-400">Uso de Núcleos GPU:</span>
                    <strong className={selectedProcess.gpuCorePercent > 80 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                      {selectedProcess.gpuCorePercent}%
                    </strong>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-black/40 border border-slate-800">
                    <span className="text-slate-400">Hilos de Cómputo (Threads):</span>
                    <strong className="text-slate-200">{selectedProcess.threadCount} Hilos SIMD</strong>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-black/40 border border-slate-800">
                    <span className="text-slate-400">Prioridad en Planificador:</span>
                    <strong className="text-amber-400 uppercase text-[11px]">{selectedProcess.priority}</strong>
                  </div>

                  <div className="flex justify-between p-2 rounded bg-black/40 border border-slate-800">
                    <span className="text-slate-400">Tiempo de Ejecución:</span>
                    <strong className="text-slate-200">
                      {Math.floor(selectedProcess.durationSeconds / 60)}m {selectedProcess.durationSeconds % 60}s
                    </strong>
                  </div>

                  {selectedProcess.jobId && (
                    <div className="flex justify-between p-2 rounded bg-black/40 border border-slate-800">
                      <span className="text-slate-400">Job ID Asociado:</span>
                      <strong className="text-sky-300 truncate max-w-[170px]">{selectedProcess.jobId}</strong>
                    </div>
                  )}
                </div>

                {/* Kill Process Action Callout */}
                <div className="pt-2">
                  <button
                    onClick={() => handleKillProcess(selectedProcess)}
                    className="w-full py-2.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-700/30 transition active:scale-95 cursor-pointer border border-red-400"
                  >
                    <PowerOff className="w-4 h-4 text-white" />
                    <span>Forzar Cierre: Kill PID {selectedProcess.pid}</span>
                  </button>
                  <span className="text-[10px] text-slate-500 font-mono block text-center mt-1.5">
                    Libera memoria VRAM y notifica al cluster para reasignar chunk
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <Terminal className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs font-mono">Selecciona un proceso de la tabla para inspeccionar su huella de memoria y detalles de nodo.</p>
              </div>
            )}

            {/* Bottom Footer Tip */}
            <div className="p-3 bg-[#0a101f] border border-sky-900/40 rounded-xl text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-sky-300 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Protección del Cluster</span>
              </div>
              <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                Matar un proceso colgado en la nube no afecta el proyecto local ni borra la línea de tiempo. El planificador reintentará el chunk con configuración segura.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Status Bar */}
        <div className="px-5 py-3 bg-[#050811] border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-3">
            <span>Mostrando: <strong className="text-white">{filteredProcesses.length}</strong> de {processes.length} tareas</span>
            <span>&bull;</span>
            <span>Total VRAM: <strong className="text-sky-300">{totalAllocatedVram} MB</strong> / {totalVramMb} MB</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition cursor-pointer"
            >
              Cerrar Administrador
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
