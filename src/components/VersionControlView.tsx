import React, { useState } from 'react';
import { 
  GitBranch, GitCommit, GitMerge, RotateCcw, Plus, Check, 
  Clock, Shield, Layers, FileDiff, Sparkles, User
} from 'lucide-react';
import { ProjectBranch, ProjectCommit, TimelineClip } from '../types/editor';

interface VersionControlViewProps {
  branches: ProjectBranch[];
  commits: ProjectCommit[];
  currentBranch: string;
  clips: TimelineClip[];
  onSelectBranch: (branchId: string) => void;
  onCreateBranch: (name: string, description: string) => void;
  onCreateCommit: (message: string) => void;
  lastCheckpointTime?: string;
  onTriggerCheckpoint?: () => void;
}

export const VersionControlView: React.FC<VersionControlViewProps> = ({
  branches,
  commits,
  currentBranch,
  clips,
  onSelectBranch,
  onCreateBranch,
  onCreateCommit,
  lastCheckpointTime,
  onTriggerCheckpoint,
}) => {
  const [newCommitMessage, setNewCommitMessage] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [showNewBranchModal, setShowNewBranchModal] = useState(false);

  const activeBranchData = branches.find((b) => b.id === currentBranch) || branches[0];

  const handleCommitSubmit = () => {
    if (!newCommitMessage.trim()) return;
    onCreateCommit(newCommitMessage.trim());
    setNewCommitMessage('');
  };

  const handleBranchSubmit = () => {
    if (!newBranchName.trim()) return;
    onCreateBranch(newBranchName.trim(), `Branch derivado de ${activeBranchData.name}`);
    setNewBranchName('');
    setShowNewBranchModal(false);
  };

  return (
    <div className="flex-1 bg-[#090d16] p-4 sm:p-6 overflow-y-auto select-none space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-950/40 border border-emerald-800/40 rounded-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GitBranch className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white">Control de Versiones Avanzado para Edición</h2>
            <span className="text-[10px] font-mono bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded font-bold">
              Git-Style Non-Destructive Branches
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl">
            Experimenta con cortes alternativos, formatos verticales o mezclas de sonido en ramas independientes. Nunca pierdas el corte maestro de producción.
          </p>
        </div>

        <button
          onClick={() => setShowNewBranchModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition active:scale-95 cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Crear Nueva Rama</span>
        </button>
      </div>

      {/* Firestore 5-min Auto-Save Checkpoint Card */}
      <div className="bg-gradient-to-r from-[#06151f] via-[#091b29] to-[#07131e] border border-cyan-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
            <Shield className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>Auto-Save Checkpoint en Firebase Firestore</span>
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              </h3>
              <span className="text-[9px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-700/60 px-1.5 py-0.2 rounded font-bold">
                Intervalo: 5 minutos
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Genera commits automáticos de tipo 'Checkpoint' periódicamente para prevenir pérdidas en sesiones largas. Último guardado: <strong className="text-cyan-300 font-mono">{lastCheckpointTime || 'Reciente'}</strong>.
            </p>
          </div>
        </div>

        {onTriggerCheckpoint && (
          <button
            onClick={onTriggerCheckpoint}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Crea un commit Checkpoint manual de inmediato en Firestore"
          >
            <Shield className="w-3.5 h-3.5 text-cyan-200" />
            <span>Crear Checkpoint Ahora</span>
          </button>
        )}
      </div>

      {/* Snapshot Commit Creator */}
      <div className="bg-[#0c1220] border border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-emerald-400" />
          <span>Guardar Instantánea (Commit) en Rama Activa: <strong className="text-white font-mono">{activeBranchData.name}</strong></span>
        </h3>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Mensaje del snapshot (ej: 'Ajuste de rampa Vegas y corrección de color final')..."
            value={newCommitMessage}
            onChange={(e) => setNewCommitMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitSubmit();
            }}
            className="flex-1 bg-[#070b13] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleCommitSubmit}
            disabled={!newCommitMessage.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span>Crear Snapshot</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Branches List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Ramas del Proyecto ({branches.length})</span>
          </h3>

          <div className="space-y-2">
            {branches.map((b) => {
              const isActive = b.id === currentBranch;

              return (
                <div
                  key={b.id}
                  onClick={() => onSelectBranch(b.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition space-y-2 ${
                    isActive
                      ? 'bg-emerald-950/30 border-emerald-500/80 shadow-md shadow-emerald-500/10'
                      : 'bg-[#0c1220] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                      {b.name}
                    </span>
                    {isActive && (
                      <span className="bg-emerald-500 text-black font-extrabold text-[9px] px-1.5 py-0.2 rounded font-mono">
                        ACTIVA
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2">{b.description}</p>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/80">
                    <span>{b.clipCount} clips en timeline</span>
                    <span>{b.lastModified}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Columns: Commit History Timeline */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Historial de Commits y Registro de Cambios
          </h3>

          <div className="bg-[#0c1220] border border-slate-800 rounded-xl p-4 space-y-4">
            {commits.map((c, idx) => {
              const isCheckpoint = c.isCheckpoint || c.message.toLowerCase().includes('checkpoint');

              return (
                <div key={c.hash} className="flex gap-3 relative group">
                  {/* Timeline vertical line */}
                  {idx < commits.length - 1 && (
                    <div className="w-0.5 bg-slate-800 absolute top-7 bottom-0 left-3" />
                  )}

                  {/* Commit Dot */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 group-hover:scale-110 transition border-2 ${
                    isCheckpoint
                      ? 'bg-cyan-950 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                      : 'bg-slate-900 border-emerald-500 text-emerald-400'
                  }`}>
                    {isCheckpoint ? (
                      <Shield className="w-3 h-3 text-cyan-300" />
                    ) : (
                      <GitCommit className="w-3 h-3 text-emerald-400" />
                    )}
                  </div>

                  <div className={`flex-1 rounded-lg p-3 space-y-1 border transition ${
                    isCheckpoint
                      ? 'bg-[#061520] border-cyan-600/50 shadow-sm shadow-cyan-500/10'
                      : 'bg-[#070b13] border-slate-800/80'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-200 text-xs">{c.message}</h4>
                        {isCheckpoint && (
                          <span className="text-[8px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-700/60 px-1 py-0.2 rounded font-bold">
                            CHECKPOINT AUTO-SAVE
                          </span>
                        )}
                      </div>
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                        isCheckpoint
                          ? 'text-cyan-300 bg-cyan-950/80 border-cyan-800'
                          : 'text-emerald-400 bg-emerald-950/80 border-emerald-900'
                      }`}>
                        {c.hash}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400">{c.diffSummary}</p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                      <span>{c.author}</span>
                      <span>{c.timestamp}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* New Branch Modal */}
      {showNewBranchModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d1322] border border-slate-700 rounded-xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-emerald-400" />
              <span>Crear Nueva Rama de Edición</span>
            </h3>
            <p className="text-xs text-slate-400">
              Copia el estado actual de la línea de tiempo a una rama independiente.
            </p>

            <input
              type="text"
              placeholder="Nombre de la rama (ej: feature/director-cut-soundtrack)..."
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="w-full bg-[#070b13] border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNewBranchModal(false)}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleBranchSubmit}
                disabled={!newBranchName.trim()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-1.5 rounded text-xs font-semibold transition"
              >
                Crear Rama
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
