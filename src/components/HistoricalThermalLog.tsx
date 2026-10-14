import React, { useState, useMemo } from 'react';
import { 
  Flame, AlertTriangle, AlertOctagon, History, Trash2, Download, 
  Clock, ShieldAlert, Cpu, Fan, CheckCircle2, Filter, ChevronRight,
  TrendingUp, RefreshCw, Sparkles, Layers, Info, Calendar, ArrowUpRight
} from 'lucide-react';

export interface ThermalEvent {
  id: string;
  timestamp: string; // ISO string or readable format
  formattedTime: string; // HH:mm:ss
  formattedDate: string; // YYYY-MM-DD
  temperatureC: number;
  temperatureF: number;
  gpuLoadPercent: number;
  fanSpeedRpm: number;
  activePreset?: string;
  renderJobTitle?: string;
  durationSeconds?: number;
  severity: 'critical' | 'severe' | 'warning'; // >90: critical, 86-90: severe, 85: warning
  throttleImpact: string; // e.g., 'Clock reducido -40%, Render retardado +85%'
  rootCause?: string; // e.g., 'Codificación 4K ProRes 422 HQ multi-stream'
  mitigationApplied?: string; // e.g., 'Ventilador al 100%, Alerta emitida'
}

interface HistoricalThermalLogProps {
  events: ThermalEvent[];
  tempUnit: 'C' | 'F';
  onClearEvents: () => void;
  onSimulateThermalSpike: (tempC: number) => void;
  onSelectThermalTab?: () => void;
  onApplyPreset?: (preset: 'PRORES_422HQ' | 'H264_1080P' | 'AV1_4K_HDR' | 'TIKTOK_VERTICAL_60FPS', resolution: string) => void;
}

export const HistoricalThermalLog: React.FC<HistoricalThermalLogProps> = ({
  events,
  tempUnit,
  onClearEvents,
  onSimulateThermalSpike,
  onSelectThermalTab,
  onApplyPreset,
}) => {
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<'all' | 'critical' | 'severe' | 'warning'>('all');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(events[0]?.id || null);

  // Filtered list
  const filteredEvents = useMemo(() => {
    if (selectedSeverityFilter === 'all') return events;
    return events.filter(e => e.severity === selectedSeverityFilter);
  }, [events, selectedSeverityFilter]);

  const selectedEvent = useMemo(() => {
    return events.find(e => e.id === selectedEventId) || events[0] || null;
  }, [events, selectedEventId]);

  // Telemetry Aggregates
  const stats = useMemo(() => {
    if (events.length === 0) {
      return {
        totalEvents: 0,
        maxTempC: 0,
        maxTempF: 0,
        avgTempC: 0,
        criticalCount: 0,
        recurringRiskLevel: 'Bajo (0 incidentes)',
        riskColor: 'text-emerald-400',
        riskBg: 'bg-emerald-950/40 border-emerald-800/60',
      };
    }

    const temps = events.map(e => e.temperatureC);
    const maxC = Math.max(...temps);
    const avgC = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
    const criticals = events.filter(e => e.temperatureC >= 90).length;

    let riskLevel = 'Moderado';
    let riskColor = 'text-amber-400';
    let riskBg = 'bg-amber-950/40 border-amber-800/60';

    if (events.length >= 4 || maxC >= 92) {
      riskLevel = 'Crítico / Frecuente (Riesgo de daño por hardware)';
      riskColor = 'text-red-400';
      riskBg = 'bg-red-950/60 border-red-700/80 shadow-md shadow-red-900/20';
    } else if (events.length >= 2 || maxC >= 88) {
      riskLevel = 'Alto (Estrangulamiento térmico recurrente detectado)';
      riskColor = 'text-rose-400';
      riskBg = 'bg-rose-950/50 border-rose-800/70';
    }

    return {
      totalEvents: events.length,
      maxTempC: maxC,
      maxTempF: Math.round(maxC * 1.8 + 32),
      avgTempC: avgC,
      avgTempF: Math.round(avgC * 1.8 + 32),
      criticalCount: criticals,
      recurringRiskLevel: riskLevel,
      riskColor,
      riskBg,
    };
  }, [events]);

  const formatTemp = (tempC: number) => {
    if (tempUnit === 'F') {
      return `${Math.round(tempC * 1.8 + 32)}°F`;
    }
    return `${tempC}°C`;
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `gpu_thermal_incident_log_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Analytical Summary */}
      <div className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${stats.riskBg}`}>
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0 text-red-400 shadow-md">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-red-600/30 text-red-300 border border-red-500/40">
                Auditoría Térmica de Exportaciones
              </span>
              <span className="text-xs font-mono text-slate-300">
                Incidentes registrados a &gt;85°C (Límite de estrangulamiento)
              </span>
            </div>
            <h4 className="text-base sm:text-lg font-bold text-white mt-1 flex items-center gap-2">
              <span>Registro Histórico de Sobrecalentamiento GPU</span>
              {events.length > 0 && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-red-500 text-white font-extrabold shadow-sm">
                  {events.length} incidentes
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-300 max-w-2xl mt-0.5">
              Patrón de diagnóstico: <strong className={stats.riskColor}>{stats.recurringRiskLevel}</strong>. 
              {stats.totalEvents > 0 
                ? ' Las sesiones prolongadas con altas cargas (>80%) o formatos no optimizados han forzado al silicio a superar su curva segura de disipación.'
                : ' No se registran eventos térmicos anómalos. Tu hardware opera dentro de los márgenes nominales de seguridad.'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
          <button
            onClick={() => onSimulateThermalSpike(89)}
            className="px-2.5 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-200 text-xs rounded-lg font-mono flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
            title="Simular un pico térmico inmediato de 89°C para verificar el registro de eventos"
          >
            <Flame className="w-3.5 h-3.5 text-red-400" />
            <span>Simular Pico 89°C</span>
          </button>

          {events.length > 0 && (
            <>
              <button
                onClick={handleExportJson}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg font-mono flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
                title="Descargar registro como JSON"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Exportar JSON</span>
              </button>

              <button
                onClick={onClearEvents}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 text-white text-xs rounded-lg font-mono font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
                title="Corregir y limpiar todos los incidentes térmicos programados"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-100" />
                <span>Corregir Errores</span>
              </button>

              <button
                onClick={onClearEvents}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-red-950/60 border border-slate-700 hover:border-red-700/60 text-slate-300 hover:text-red-300 text-xs rounded-lg font-mono flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-sm"
                title="Limpiar registro histórico"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {/* Card 1: Total Incidents */}
        <div className="p-3 bg-[#070c16] border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono">
            <span className="uppercase tracking-wider">Total Incidentes</span>
            <History className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-white flex items-baseline gap-1.5">
            <span>{stats.totalEvents}</span>
            <span className="text-[10px] text-slate-400 font-normal">eventos &gt;85°C</span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">Desde el inicio de sesión</p>
        </div>

        {/* Card 2: Peak Temperature */}
        <div className="p-3 bg-[#070c16] border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono">
            <span className="uppercase tracking-wider">Temperatura Pico</span>
            <Flame className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-400 flex items-baseline gap-1.5">
            <span>{stats.maxTempC > 0 ? formatTemp(stats.maxTempC) : '--'}</span>
            {stats.maxTempC >= 90 && (
              <span className="text-[9px] bg-red-600 text-white px-1 rounded uppercase font-bold">Crítico</span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 font-mono">Máximo estrés alcanzado</p>
        </div>

        {/* Card 3: Average Overheat Temp */}
        <div className="p-3 bg-[#070c16] border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono">
            <span className="uppercase tracking-wider">Temp Media en Throttle</span>
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-300 flex items-baseline gap-1.5">
            <span>{stats.avgTempC > 0 ? formatTemp(stats.avgTempC) : '--'}</span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">Durante incidentes registrados</p>
        </div>

        {/* Card 4: Critical Severity (>90°C) */}
        <div className="p-3 bg-[#070c16] border border-slate-800 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono">
            <span className="uppercase tracking-wider">Sobrepaso Extremo (&gt;90°C)</span>
            <AlertOctagon className="w-3.5 h-3.5 text-red-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-red-400 flex items-baseline gap-1.5">
            <span>{stats.criticalCount}</span>
            <span className="text-[10px] text-slate-400 font-normal">casos severos</span>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">Penalización de reloj activa</p>
        </div>
      </div>

      {/* Main Content Layout: Timeline Log List + Detail Inspector */}
      {events.length === 0 ? (
        <div className="p-8 bg-[#070c16] border border-dashed border-slate-800 rounded-xl text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h5 className="text-sm font-bold text-white">Sin Registros de Sobrecalentamiento</h5>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No se han detectado eventos térmicos que superen el umbral crítico de 85°C. El sistema registrará automáticamente cada incidente con su marca de tiempo, nivel de carga y causa raíz.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => onSimulateThermalSpike(88)}
              className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900 border border-red-700/60 text-red-300 text-xs rounded-lg font-mono inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-red-400" />
              <span>Generar Evento de Prueba (88°C)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column (7 cols): Historical Events Table / Feed */}
          <div className="lg:col-span-7 bg-[#070c16] border border-slate-800/90 rounded-xl p-3.5 space-y-3 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold text-white">Línea Temporal de Incidentes</span>
                <span className="text-[10px] font-mono text-slate-400">
                  ({filteredEvents.length} mostrados)
                </span>
              </div>

              {/* Severity Filter Buttons */}
              <div className="flex items-center gap-1 bg-[#040812] p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                <button
                  onClick={() => setSelectedSeverityFilter('all')}
                  className={`px-2 py-0.5 rounded transition ${
                    selectedSeverityFilter === 'all'
                      ? 'bg-slate-700 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Todos ({events.length})
                </button>
                <button
                  onClick={() => setSelectedSeverityFilter('critical')}
                  className={`px-2 py-0.5 rounded transition ${
                    selectedSeverityFilter === 'critical'
                      ? 'bg-red-600 text-white font-bold'
                      : 'text-red-400 hover:text-red-200'
                  }`}
                >
                  &gt;90°C ({events.filter(e => e.severity === 'critical').length})
                </button>
                <button
                  onClick={() => setSelectedSeverityFilter('severe')}
                  className={`px-2 py-0.5 rounded transition ${
                    selectedSeverityFilter === 'severe'
                      ? 'bg-rose-600 text-white font-bold'
                      : 'text-rose-400 hover:text-rose-200'
                  }`}
                >
                  86-90°C ({events.filter(e => e.severity === 'severe').length})
                </button>
              </div>
            </div>

            {/* List of Thermal Incident Rows */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredEvents.map((evt) => {
                const isSelected = selectedEventId === evt.id;
                const isCritical = evt.temperatureC >= 90;

                return (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEventId(evt.id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-gradient-to-r from-red-950/60 to-[#0e1628] border-red-500/80 shadow-md ring-1 ring-red-500/30'
                        : isCritical
                        ? 'bg-red-950/20 hover:bg-red-950/40 border-red-900/60 hover:border-red-700/60'
                        : 'bg-[#040812] hover:bg-[#081020] border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Thermometer indicator */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-mono font-bold ${
                        isCritical
                          ? 'bg-red-600/30 border border-red-500 text-red-300 animate-pulse'
                          : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                      }`}>
                        <Flame className="w-4 h-4" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-black text-white">
                            {evt.formattedTime}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {evt.formattedDate}
                          </span>
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                            isCritical
                              ? 'bg-red-600 text-white shadow-sm'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}>
                            {isCritical ? 'PELIGRO >90°C' : 'THROTTLE >85°C'}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-300 mt-0.5 truncate max-w-sm">
                          {evt.renderJobTitle || 'Procesamiento en paralelo por GPU'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:text-right self-end sm:self-auto font-mono">
                      <div>
                        <div className="text-sm font-black text-rose-400">
                          {formatTemp(evt.temperatureC)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Carga: <strong className="text-sky-300">{evt.gpuLoadPercent}%</strong>
                        </div>
                      </div>

                      <ChevronRight className={`w-4 h-4 transition ${
                        isSelected ? 'text-red-400 translate-x-0.5' : 'text-slate-600'
                      }`} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom footnote */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3 text-sky-400" />
                <span>Muestreo autónomo ante picos &gt;85°C en la cola de render</span>
              </span>
              <span>Guardado en memoria de sesión</span>
            </div>
          </div>

          {/* Right Column (5 cols): Selected Incident Diagnostic Inspector */}
          <div className="lg:col-span-5 bg-[#070c16] border border-slate-800/90 rounded-xl p-4 space-y-4 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span className="text-xs font-bold text-white">Diagnóstico del Incidente</span>
              </div>
              {selectedEvent && (
                <span className="text-[10px] font-mono text-slate-400">
                  ID: {selectedEvent.id.slice(-8)}
                </span>
              )}
            </div>

            {selectedEvent ? (
              <div className="space-y-3.5 text-xs">
                {/* Event Temperature Header Card */}
                <div className={`p-3 rounded-xl border flex items-center justify-between ${
                  selectedEvent.temperatureC >= 90
                    ? 'bg-red-950/40 border-red-600/70'
                    : 'bg-rose-950/30 border-rose-800/60'
                }`}>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                      Temperatura Registrada
                    </span>
                    <div className="text-2xl font-black font-mono text-white flex items-baseline gap-2">
                      <span className="text-red-400">{formatTemp(selectedEvent.temperatureC)}</span>
                      <span className="text-xs text-slate-400 font-normal">
                        (+{selectedEvent.temperatureC - 85}°C sobre límite seguro)
                      </span>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-[10px] text-slate-400 block">Hora del Evento</span>
                    <span className="text-sm font-bold text-white">{selectedEvent.formattedTime}</span>
                  </div>
                </div>

                {/* Key Telemetry at Moment of Spike */}
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2.5 bg-[#040812] border border-slate-800 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Carga de GPU:</span>
                    <strong className="text-sky-300 text-sm">{selectedEvent.gpuLoadPercent}%</strong>
                  </div>

                  <div className="p-2.5 bg-[#040812] border border-slate-800 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Velocidad Ventilador:</span>
                    <strong className="text-emerald-300 text-sm">{selectedEvent.fanSpeedRpm} RPM</strong>
                  </div>

                  <div className="p-2.5 bg-[#040812] border border-slate-800 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Preset Activo:</span>
                    <strong className="text-amber-300 text-xs truncate block">{selectedEvent.activePreset || 'ProRes 422 HQ 4K'}</strong>
                  </div>

                  <div className="p-2.5 bg-[#040812] border border-slate-800 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Impacto en Reloj:</span>
                    <strong className="text-red-300 text-xs">Throttle Activo</strong>
                  </div>
                </div>

                {/* Cause Analysis */}
                <div className="p-3 bg-[#040812] border border-slate-800 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-300 font-bold text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Causa Raíz Identificada</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    {selectedEvent.rootCause || 'Acumulación de calor por decodificación en paralelo de múltiples capas 4K y saturación de búferes de texturas WebGL.'}
                  </p>
                </div>

                {/* Performance Degradation Impact */}
                <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-red-300 font-bold text-[11px]">
                    <TrendingUp className="w-3.5 h-3.5 text-red-400" />
                    <span>Consecuencias en Renderizado</span>
                  </div>
                  <p className="text-red-200/90 text-[11px] leading-relaxed font-mono">
                    {selectedEvent.throttleImpact || 'Clock de la GPU reducido un 42% por protección de silicio. Tiempo estimado de finalización de cola aumentado en +85%.'}
                  </p>
                </div>

                {/* Recommended Mitigation & Shortcut */}
                <div className="p-3 bg-[#07131e] border border-sky-900/60 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-sky-300 font-bold text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                    <span>Solución Recomendada</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Cambiar al preset balanceado <strong>H.264 1080p</strong> o activar <strong>Modo Proxy ProRes</strong> para reducir la demanda de VRAM y estabilizar la disipación bajo 72°C.
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    {onApplyPreset && (
                      <button
                        onClick={() => onApplyPreset('H264_1080P', '1920x1080')}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                      >
                        <span>Aplicar H.264 Seguro</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}

                    {onSelectThermalTab && (
                      <button
                        onClick={onSelectThermalTab}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-mono transition cursor-pointer"
                      >
                        Ver Curva en Vivo
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">
                Selecciona un incidente para ver detalles de telemetría y diagnóstico.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
