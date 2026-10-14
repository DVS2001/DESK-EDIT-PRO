import React, { useState } from 'react';
import { 
  Search, Sparkles, Film, Clock, Tag, PlusCircle, 
  CheckCircle2, RefreshCw, Database, Cpu, Play
} from 'lucide-react';
import { MediaAsset, TimelineClip } from '../types/editor';
import { secondsToTimecode } from '../utils/timecode';

interface SemanticIndexingViewProps {
  mediaAssets: MediaAsset[];
  currentTime: number;
  onAddSegmentToTimeline: (asset: MediaAsset, startIn: number, endOut: number) => void;
}

export const SemanticIndexingView: React.FC<SemanticIndexingViewProps> = ({
  mediaAssets,
  currentTime,
  onAddSegmentToTimeline,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const sampleQueries = [
    'toma aérea de dron sobre montañas al amanecer con niebla',
    'persona hablando en escenario sobre revolución de inteligencia artificial',
    'ambiente nocturno con lluvia y neones estilo cyberpunk',
    'salto de skater a alta velocidad para rampa de velocidad en cámara lenta',
  ];

  const handleSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsSearching(true);
    setHasSearched(true);

    try {
      const response = await fetch('/api/gemini/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          catalog: mediaAssets,
        }),
      });

      const data = await response.json();
      if (data.success && data.matches) {
        setSearchResults(data.matches);
      }
    } catch (err) {
      console.error('Semantic search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex-1 bg-[#090d16] p-4 sm:p-6 overflow-y-auto select-none space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-sky-950/40 border border-purple-800/40 rounded-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white">Indexación Semántica y Búsqueda por IA</h2>
            <span className="text-[10px] font-mono bg-purple-900/60 text-purple-300 border border-purple-700/60 px-2 py-0.5 rounded font-bold">
              Gemini Vision &amp; Audio Embeddings
            </span>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl">
            Encuentra segmentos exactos de video describiendo la escena, emociones, iluminación o frases habladas en lenguaje natural.
          </p>
        </div>

        {/* Telemetry Stats */}
        <div className="flex items-center gap-4 text-xs font-mono bg-black/40 px-3 py-2 rounded-lg border border-purple-900/40">
          <div>
            <span className="text-slate-500 block text-[10px]">CLIPS INDEXADOS</span>
            <span className="text-sky-300 font-bold">{mediaAssets.length} Assets (4K/HD)</span>
          </div>
          <div className="h-6 w-px bg-slate-800" />
          <div>
            <span className="text-slate-500 block text-[10px]">PRECISIÓN TEMPORAL</span>
            <span className="text-emerald-400 font-bold">Word-Level SMPTE</span>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="space-y-3">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch(searchQuery);
            }}
            placeholder="Describe la toma deseada: 'dron sobre cordillera', 'discurso entusiasta sobre IA', 'luces de neón bajo lluvia'..."
            className="w-full bg-[#0c121e] border border-slate-700 rounded-xl px-4 py-3 pl-11 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 shadow-lg"
          />
          <Search className="w-5 h-5 text-purple-400 absolute left-3.5 top-3.5 pointer-events-none" />

          <button
            onClick={() => handleSearch(searchQuery)}
            disabled={isSearching || !searchQuery.trim()}
            className="absolute right-2 top-2 bottom-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            {isSearching ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Indexando...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Buscar Segmento</span>
              </>
            )}
          </button>
        </div>

        {/* Sample Query Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-slate-400">
          <span className="text-[11px] font-mono text-slate-500 flex-shrink-0">Ejemplos:</span>
          {sampleQueries.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSearchQuery(q);
                handleSearch(q);
              }}
              className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] whitespace-nowrap transition cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Search Results Grid */}
      {hasSearched && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
            <span className="font-semibold text-slate-200">
              Coincidencias Semánticas Encontradas ({searchResults.length})
            </span>
            <span>Ordenadas por afinidad neural</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {searchResults.map((match) => {
              const asset = mediaAssets.find((a) => a.id === match.assetId);
              if (!asset) return null;

              return (
                <div
                  key={match.assetId}
                  className="bg-[#0c1220] border border-slate-800 hover:border-purple-800/70 rounded-xl p-4 flex gap-4 transition shadow-md group"
                >
                  {/* Thumbnail with overlay duration */}
                  <div className="w-36 h-24 rounded-lg overflow-hidden bg-black relative flex-shrink-0">
                    <img src={asset.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                    <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-mono px-1.5 py-0.5 rounded text-white">
                      {secondsToTimecode(match.recommendedIn)} - {secondsToTimecode(match.recommendedOut)}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-bold text-slate-200 text-sm truncate">{asset.title}</h4>
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded">
                          {match.matchScore}% Match
                        </span>
                      </div>
                      <p className="text-xs text-purple-300/90 line-clamp-2">{match.reason}</p>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] font-mono text-slate-500 uppercase">
                        {asset.resolution || 'Stereo Audio'}
                      </span>
                      <button
                        onClick={() => onAddSegmentToTimeline(asset, match.recommendedIn, match.recommendedOut)}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition active:scale-95 cursor-pointer shadow"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Insertar en Timeline</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Catalog Overview when not searching */}
      {!hasSearched && (
        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Material Indexado en Este Proyecto
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mediaAssets.map((asset) => (
              <div
                key={asset.id}
                className="p-3 bg-[#0c1220] border border-slate-800 rounded-xl space-y-2"
              >
                <div className="h-32 rounded-lg bg-black overflow-hidden relative">
                  <img src={asset.thumbnail} alt="" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-mono px-1 rounded text-white">
                    {asset.duration.toFixed(0)}s
                  </span>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-200 text-xs truncate">{asset.title}</h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{asset.description}</p>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {asset.tags.slice(0, 4).map((tag, i) => (
                    <span key={i} className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
