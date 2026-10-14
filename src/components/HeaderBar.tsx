import React, { useState } from 'react';
import { 
  Film, Sparkles, Cloud, GitBranch, Layers, Sliders, 
  Terminal, Search, FileText, ChevronDown, Check, Users, ArrowUpRight,
  Video, User as UserIcon, LogIn, LogOut, Database, Mic, Shield, Wrench, FolderPlus
} from 'lucide-react';
import { WorkspaceTab, AspectRatio, Collaborator, ProjectBranch } from '../types/editor';

interface HeaderBarProps {
  currentTab: WorkspaceTab;
  aspectRatio: AspectRatio;
  currentBranch: string;
  branches: ProjectBranch[];
  collaborators: Collaborator[];
  onSelectTab: (tab: WorkspaceTab) => void;
  onSelectAspectRatio: (ratio: AspectRatio) => void;
  onSelectBranch: (branchId: string) => void;
  onOpenAiPrompt: () => void;
  onOpenCloudRender: () => void;
  onOpenAiTools: () => void;
  onOpenVoiceoverStudio?: () => void;
  onOpenMediaLibrary?: () => void;
  user: any | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onSyncFirestore: () => void;
  lastCheckpointTime?: string;
  onTriggerCheckpoint?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  currentTab,
  aspectRatio,
  currentBranch,
  branches,
  collaborators,
  onSelectTab,
  onSelectAspectRatio,
  onSelectBranch,
  onOpenAiPrompt,
  onOpenCloudRender,
  onOpenAiTools,
  onOpenVoiceoverStudio,
  onOpenMediaLibrary,
  user,
  onSignIn,
  onSignOut,
  onSyncFirestore,
  lastCheckpointTime,
  onTriggerCheckpoint,
}) => {
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  return (
    <header className="h-14 bg-[#090d16] border-b border-[#1b2434] px-3 sm:px-4 flex items-center justify-between select-none z-30">
      {/* Left: Brand & Workspace Navigation */}
      <div className="flex items-center gap-3 lg:gap-5 overflow-x-auto">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 via-indigo-500 to-pink-500 p-0.5 shadow-lg shadow-sky-500/20">
            <div className="w-full h-full bg-[#090d16] rounded-[7px] flex items-center justify-center">
              <Film className="w-4 h-4 text-sky-400" />
            </div>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-wide text-white">OmniCut</span>
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold">
                PRO NLE
              </span>
            </div>
            <p className="text-[9px] text-slate-400 font-mono">Premiere • CapCut • Vegas Hybrid</p>
          </div>
        </div>

        {/* Workspace Mode Tabs */}
        <nav className="flex items-center gap-1 bg-[#060910] p-1 rounded-lg border border-slate-800/80">
          <button
            onClick={() => onSelectTab('editing')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
              currentTab === 'editing'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Editing</span>
          </button>

          <button
            onClick={() => onSelectTab('color')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
              currentTab === 'color'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Lumetri Color</span>
          </button>

          <button
            onClick={() => onSelectTab('text_edit')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
              currentTab === 'text_edit'
                ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Text Edit</span>
          </button>

          <button
            onClick={() => onSelectTab('ai_indexing')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
              currentTab === 'ai_indexing'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>AI Index</span>
          </button>

          <button
            onClick={() => onSelectTab('cloud_render')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
              currentTab === 'cloud_render'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Cloud Render</span>
          </button>

          <button
            onClick={() => onSelectTab('version_control')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
              currentTab === 'version_control'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Branches</span>
          </button>

          <button
            onClick={() => onSelectTab('api_pipeline')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
              currentTab === 'api_pipeline'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">API</span>
          </button>
        </nav>
      </div>

      {/* Center/Right: Aspect Ratio, Branch, Collaborators, Generative Tools & Auth */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
        {/* Aspect Ratio Switcher */}
        <div className="hidden sm:flex items-center bg-[#060910] border border-slate-800 rounded p-0.5 text-xs">
          {(['16:9', '9:16', '1:1'] as AspectRatio[]).map((ratio) => (
            <button
              key={ratio}
              onClick={() => onSelectAspectRatio(ratio)}
              className={`px-2 py-0.5 rounded font-mono text-[11px] transition ${
                aspectRatio === ratio
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>

        {/* Branch Selector Dropdown */}
        <div className="hidden md:flex items-center gap-1 bg-[#060910] border border-slate-800 rounded px-2 py-1 text-xs text-slate-300">
          <GitBranch className="w-3 h-3 text-emerald-400" />
          <select
            value={currentBranch}
            onChange={(e) => onSelectBranch(e.target.value)}
            className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer max-w-[120px] truncate"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id} className="bg-slate-900 text-slate-200">
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Firestore 5-min Auto-Save Checkpoint Status Indicator */}
        <button
          onClick={onTriggerCheckpoint}
          className="hidden xl:flex items-center gap-1.5 bg-[#060910] border border-cyan-900/60 hover:border-cyan-500/70 text-slate-300 px-2 py-1 rounded-lg text-xs transition cursor-pointer group"
          title={`Firestore Auto-Save: Checkpoint commit periódico cada 5 min. Último commit guardado: ${lastCheckpointTime || 'Reciente'}. Clic para guardar Checkpoint en la nube ahora.`}
        >
          <Shield className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition" />
          <div className="flex flex-col text-left">
            <span className="text-[9px] font-mono text-cyan-300 font-bold leading-none">AUTO-SAVE 5m</span>
            <span className="text-[8px] text-slate-400 leading-none">{lastCheckpointTime || 'Guardado'}</span>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        </button>

        {/* Firebase Cloud Media Library Action Button */}
        <button
          onClick={onOpenMediaLibrary}
          className="flex items-center gap-1.5 bg-gradient-to-r from-sky-900/90 to-blue-900/90 hover:from-sky-800 hover:to-blue-800 border border-sky-500/40 text-sky-200 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-sky-950/40 transition active:scale-95 cursor-pointer"
          title="Biblioteca Cloud: Explora y sube archivos en Firebase Storage y arrástralos a la línea de tiempo"
        >
          <FolderPlus className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">Media Library</span>
        </button>

        {/* AI Voiceover Direct Action Button */}
        <button
          onClick={onOpenVoiceoverStudio}
          className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
          title="AI Voiceover Studio: Genera locuciones profesionales con IA (control de tono, velocidad e idioma) directamente a la línea de tiempo"
        >
          <Mic className="w-3.5 h-3.5 text-emerald-200" />
          <span className="hidden sm:inline">Voiceover</span>
        </button>

        {/* 'Tools' Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-purple-600/20 transition active:scale-95 cursor-pointer"
            title="Menú de Herramientas IA (Tools): AI Voiceover Studio, Veo 3, Nano Banana, Lyria Music, etc."
          >
            <Wrench className="w-3.5 h-3.5 text-yellow-300" />
            <span>Tools</span>
            <ChevronDown className={`w-3 h-3 text-white/80 transition-transform ${isToolsMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isToolsMenuOpen && (
            <div 
              className="absolute right-0 top-full mt-2 w-80 bg-[#0c1220] border border-slate-700/80 rounded-xl shadow-2xl p-2 z-50 space-y-1 backdrop-blur-lg animate-fadeIn"
              onMouseLeave={() => setIsToolsMenuOpen(false)}
            >
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex justify-between items-center">
                <span>OmniCut AI Tools Suite</span>
                <span className="text-[9px] font-mono text-purple-400">DeepMind &amp; Gemini</span>
              </div>
              
              {/* Item 1: AI Voiceover Studio */}
              <button
                onClick={() => {
                  setIsToolsMenuOpen(false);
                  onOpenVoiceoverStudio?.();
                }}
                className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-emerald-950/40 border border-transparent hover:border-emerald-500/40 text-left transition group cursor-pointer"
              >
                <div className="p-1.5 rounded-md bg-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black transition flex-shrink-0">
                  <Mic className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <span>AI Voiceover Studio</span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-mono font-bold">TTS &bull; Direct Track</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Locuciones con control de tono, velocidad e idioma agregadas a la pista A1</p>
                </div>
              </button>

              {/* Item 2: AI Studio Generative Suite */}
              <button
                onClick={() => {
                  setIsToolsMenuOpen(false);
                  onOpenAiTools();
                }}
                className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-purple-950/40 border border-transparent hover:border-purple-500/40 text-left transition group cursor-pointer"
              >
                <div className="p-1.5 rounded-md bg-purple-500/20 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition flex-shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <span>AI Studio Generative Engine</span>
                    <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1 py-0.2 rounded font-mono font-bold">Veo 3 &bull; Lyria</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Veo 3 Video, Nano Banana, Lyria Music, Live Audio y Maps</p>
                </div>
              </button>

              {/* Item 3: Firebase Cloud Media Library */}
              <button
                onClick={() => {
                  setIsToolsMenuOpen(false);
                  onOpenMediaLibrary?.();
                }}
                className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-sky-950/40 border border-transparent hover:border-sky-500/40 text-left transition group cursor-pointer"
              >
                <div className="p-1.5 rounded-md bg-sky-500/20 text-sky-400 group-hover:bg-sky-500 group-hover:text-white transition flex-shrink-0">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <span>Firebase Storage Media Library</span>
                    <span className="text-[9px] bg-sky-500/20 text-sky-300 px-1 py-0.2 rounded font-mono font-bold">Cloud &bull; Drag &amp; Drop</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Explora, sube y arrastra activos directamente a la línea de tiempo</p>
                </div>
              </button>

              {/* Item 4: Auto-Save Checkpoint Manual Commit */}
              <button
                onClick={() => {
                  setIsToolsMenuOpen(false);
                  onTriggerCheckpoint?.();
                }}
                className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-cyan-950/40 border border-transparent hover:border-cyan-500/40 text-left transition group cursor-pointer"
              >
                <div className="p-1.5 rounded-md bg-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-black transition flex-shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <span>Crear Checkpoint en Firestore</span>
                    <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1 py-0.2 rounded font-mono font-bold">Auto-Save 5m</span>
                  </div>
                  <p className="text-[10px] text-slate-400">Crea un snapshot persistente inmediato para prevenir pérdida de datos</p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Gemini AI Co-Pilot Button */}
        <button
          onClick={onOpenAiPrompt}
          className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95"
        >
          <Sliders className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden xl:inline">Co-Pilot</span>
        </button>

        {/* Cloud Render Button */}
        <button
          onClick={onOpenCloudRender}
          className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-sky-600/20 transition active:scale-95"
        >
          <Cloud className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Render</span>
          <ArrowUpRight className="w-3 h-3 text-sky-200" />
        </button>

        {/* Firebase Authentication & Cloud Sync */}
        {user ? (
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg p-1">
            <img
              src={user.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
              alt=""
              className="w-6 h-6 rounded-full border border-emerald-400 object-cover"
            />
            <span className="text-[11px] font-bold text-slate-200 truncate max-w-[80px] hidden xl:inline">
              {user.displayName?.split(' ')[0] || 'Editor'}
            </span>
            <button
              onClick={onSyncFirestore}
              title="Guardar proyecto en Firebase Firestore"
              className="p-1 rounded hover:bg-slate-800 text-emerald-400 transition"
            >
              <Database className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onSignOut}
              title="Cerrar sesión"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onSignIn}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 shadow cursor-pointer"
            title="Iniciar sesión con Google para guardar proyectos en Firestore"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Google Login</span>
          </button>
        )}
      </div>
    </header>
  );
};
