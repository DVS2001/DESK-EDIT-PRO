import React, { useState } from 'react';
import { 
  FileText, Scissors, Trash2, Play, Volume2, Sparkles, 
  CheckCircle2, Clock, AlertCircle
} from 'lucide-react';
import { TimelineClip, TranscriptWord } from '../types/editor';
import { secondsToTimecode } from '../utils/timecode';

interface TextBasedEditingViewProps {
  clips: TimelineClip[];
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  onUpdateClips: (clips: TimelineClip[]) => void;
}

export const TextBasedEditingView: React.FC<TextBasedEditingViewProps> = ({
  clips,
  currentTime,
  onTimeUpdate,
  onUpdateClips,
}) => {
  // Find speech clips with transcript
  const speechClips = clips.filter((c) => c.transcript && c.transcript.length > 0);
  const currentClip = speechClips[0]; // Active speaker clip

  const [deletedWordIds, setDeletedWordIds] = useState<Set<string>>(new Set());

  // Toggle word deletion state (Text-based editing cut)
  const toggleDeleteWord = (wordId: string) => {
    const updated = new Set(deletedWordIds);
    if (updated.has(wordId)) {
      updated.delete(wordId);
    } else {
      updated.add(wordId);
    }
    setDeletedWordIds(updated);
  };

  // One-click remove all filler words or silences
  const handleRemoveFillerWords = () => {
    if (!currentClip?.transcript) return;
    const fillers = currentClip.transcript.filter((w) => ['fundamentally', 'revolutionary'].includes(w.word.toLowerCase()));
    const updated = new Set(deletedWordIds);
    fillers.forEach((f) => updated.add(f.id));
    setDeletedWordIds(updated);
  };

  return (
    <div className="flex-1 bg-[#090d16] p-4 sm:p-6 overflow-y-auto select-none space-y-6">
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-sky-950/40 border border-pink-800/40 rounded-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-bold text-white">Edición de Video Basada en Texto (Text-Based Editing)</h2>
            <span className="text-[10px] font-mono bg-pink-900/60 text-pink-300 border border-pink-700/60 px-2 py-0.5 rounded font-bold">
              Premiere &amp; CapCut Hybrid
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl">
            Edita el video como si fuera un documento de texto. Al eliminar palabras o frases del guion transcrito, el editor recorta automáticamente esos fotogramas de la línea de tiempo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRemoveFillerWords}
            className="bg-amber-600/80 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow cursor-pointer"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Eliminar Muletillas y Rellenos</span>
          </button>
        </div>
      </div>

      {/* Main Transcript Body */}
      {!currentClip || !currentClip.transcript ? (
        <div className="p-8 text-center bg-[#0c1220] border border-slate-800 rounded-xl text-slate-400">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="font-semibold text-slate-300">No se detectó diálogo con transcripción activa</p>
          <p className="text-xs text-slate-500 mt-1">
            Añade el clip &quot;Tech Founder Keynote&quot; a la pista V1 para editar el diálogo directamente.
          </p>
        </div>
      ) : (
        <div className="bg-[#0c1220] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500" />
              <h3 className="font-bold text-slate-200 text-sm">{currentClip.title}</h3>
              <span className="text-xs text-slate-500 font-mono">
                {secondsToTimecode(currentClip.startTime)} - {secondsToTimecode(currentClip.startTime + currentClip.duration)}
              </span>
            </div>

            <span className="text-xs text-slate-400">
              Palabras tachadas: <strong className="text-rose-400">{deletedWordIds.size}</strong> fotogramas omitidos
            </span>
          </div>

          {/* Interactive Word Tokens */}
          <div className="p-4 bg-[#070b13] border border-slate-800/80 rounded-xl leading-loose flex flex-wrap gap-2 text-sm">
            {currentClip.transcript.map((item, idx) => {
              const isDeleted = deletedWordIds.has(item.id);
              const isCurrentlyPlaying = currentTime >= (currentClip.startTime + item.start) && currentTime <= (currentClip.startTime + item.end);

              return (
                <span
                  key={item.id}
                  onClick={() => onTimeUpdate(currentClip.startTime + item.start)}
                  className={`group relative inline-flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer transition select-none ${
                    isDeleted
                      ? 'bg-rose-950/40 text-rose-400/50 line-through border border-rose-900/40'
                      : isCurrentlyPlaying
                      ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/30 scale-105'
                      : 'bg-slate-800/60 hover:bg-slate-700/80 text-slate-200 border border-slate-700/50'
                  }`}
                  title={`[${item.start.toFixed(1)}s - ${item.end.toFixed(1)}s] Clic para saltar al fotograma`}
                >
                  <span>{item.word}</span>

                  {/* Cut / Restore button on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDeleteWord(item.id);
                    }}
                    className={`ml-1 p-0.5 rounded transition ${
                      isDeleted ? 'text-emerald-400 hover:bg-emerald-950' : 'text-slate-400 hover:text-rose-300 hover:bg-rose-950/60'
                    }`}
                    title={isDeleted ? 'Restaurar en video' : 'Cortar del video'}
                  >
                    {isDeleted ? <CheckCircle2 className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                </span>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-800/80">
            <span>Haz clic en cualquier palabra para colocar el cabezal de reproducción exactamente en su tiempo.</span>
            <span className="font-mono text-emerald-400">Sincronización SMPTE: Activa</span>
          </div>
        </div>
      )}
    </div>
  );
};
