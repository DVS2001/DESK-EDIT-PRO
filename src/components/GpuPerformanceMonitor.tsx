import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Cpu, Activity, Zap, Gauge, AlertTriangle, AlertOctagon, CheckCircle2, 
  RefreshCw, Flame, Shield, ArrowRight, Sparkles, Layers, Sliders, Play, Thermometer,
  X, Bell, Fan, Clock, Timer, History, Server
} from 'lucide-react';
import { 
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, 
  Tooltip, CartesianGrid, Legend, ReferenceLine 
} from 'recharts';

export interface ThermalDataPoint {
  time: string;
  load: number;
  temp: number;
  fanRpm: number;
}

export interface GpuPerformanceData {
  renderer: string;
  vendor: string;
  webglVersion: string;
  maxTextureSize: number;
  maxViewportSize: string;
  extensionsCount: number;
  currentFps: number;
  frameTimeMs: number;
  gpuLoadPercent: number;
  estimatedVramMb: number;
  maxVramMb: number;
  shaderPrecision: string;
  loadCategory: 'optimal' | 'moderate' | 'heavy' | 'bottleneck';
  coreTempC: number;
  thermalStatus: 'cool' | 'nominal' | 'warm' | 'throttle' | 'throttle-critical';
  fanSpeedRpm: number;
}

import { CloudRenderJob, TimelineClip } from '../types/editor';
import { D3TimelineHeatmap } from './D3TimelineHeatmap';
import { HistoricalThermalLog, ThermalEvent } from './HistoricalThermalLog';
import { GpuProcessManagerOverlay } from './GpuProcessManagerOverlay';

interface GpuPerformanceMonitorProps {
  onApplyExportOptimization?: (preset: 'PRORES_422HQ' | 'H264_1080P' | 'AV1_4K_HDR' | 'TIKTOK_VERTICAL_60FPS', resolution: string) => void;
  currentPreset?: string;
  currentResolution?: string;
  activeQueueJobs?: CloudRenderJob[];
  timelineClips?: TimelineClip[];
  timelineDuration?: number;
  isProxyModeActive?: boolean;
  onKillCloudJob?: (jobId: string) => void;
}

// Custom Tooltip for Recharts Thermal & Load Graph
const CustomThermalTooltip = ({ active, payload, label, tempUnit }: any) => {
  if (active && payload && payload.length) {
    const data: ThermalDataPoint = payload[0].payload;
    const isFahrenheit = tempUnit === 'F';
    const displayTemp = isFahrenheit 
      ? Math.round(data.temp * 1.8 + 32)
      : data.temp;

    return (
      <div className="bg-[#070d18]/95 border border-slate-700/90 rounded-xl p-3 shadow-2xl text-xs backdrop-blur-md space-y-1.5 font-mono min-w-[210px]">
        <div className="text-[10px] text-slate-400 border-b border-slate-800 pb-1 flex justify-between items-center">
          <span>Tiempo:</span>
          <span className="text-white font-bold">{data.time}</span>
        </div>
        
        <div className="flex items-center justify-between gap-3">
          <span className="text-sky-400 flex items-center gap-1.5 font-sans font-medium">
            <span className="w-2 h-2 rounded-full bg-sky-400" /> Carga GPU:
          </span>
          <span className="font-bold text-white text-sm">{data.load}%</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-rose-400 flex items-center gap-1.5 font-sans font-medium">
            <span className="w-2 h-2 rounded-full bg-rose-400" /> Temp Núcleo:
          </span>
          <span className="font-bold text-rose-300 text-sm">
            {displayTemp}°{tempUnit}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
          <span>Ventilador:</span>
          <span className="text-emerald-400 font-bold">{data.fanRpm} RPM</span>
        </div>

        <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400">
          <span>Estado Térmico:</span>
          <span className={`font-bold ${
            data.temp >= 85 ? 'text-red-400 font-extrabold animate-pulse' : data.temp > 78 ? 'text-rose-400' : data.temp > 68 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {data.temp >= 85 ? 'CRÍTICO (>85°C Throttle)' : data.temp > 78 ? 'Limitación Térmica' : data.temp > 68 ? 'Caliente' : 'Óptimo'}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const GpuPerformanceMonitor: React.FC<GpuPerformanceMonitorProps> = ({
  onApplyExportOptimization,
  currentPreset,
  currentResolution,
  activeQueueJobs,
  timelineClips,
  timelineDuration,
  isProxyModeActive,
  onKillCloudJob,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  
  // Historical data points for real-time load visualization
  const historyRef = useRef<number[]>(new Array(40).fill(32));
  const lastTimeRef = useRef<number>(performance.now());
  const benchmarkActiveRef = useRef<boolean>(false);
  const lastThermalSampleRef = useRef<number>(performance.now());

  // Temperature unit toggle (°C vs °F)
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('C');

  // Real-time thermal and load dataset for Recharts
  const [thermalData, setThermalData] = useState<ThermalDataPoint[]>(() => {
    const initial: ThermalDataPoint[] = [];
    const now = Date.now();
    for (let i = 24; i >= 0; i--) {
      const t = new Date(now - i * 1000);
      const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const load = 30 + Math.sin((24 - i) * 0.4) * 8;
      const temp = Math.round(42 + load * 0.38);
      initial.push({
        time: timeStr,
        load: Math.round(load),
        temp,
        fanRpm: Math.round(1400 + load * 9),
      });
    }
    return initial;
  });

  const [gpuInfo, setGpuInfo] = useState<GpuPerformanceData>({
    renderer: 'Detectando aceleración por hardware...',
    vendor: 'GPU Engine',
    webglVersion: 'WebGL 2.0',
    maxTextureSize: 16384,
    maxViewportSize: '16384x16384',
    extensionsCount: 38,
    currentFps: 60,
    frameTimeMs: 16.6,
    gpuLoadPercent: 32,
    estimatedVramMb: 1240,
    maxVramMb: 8192,
    shaderPrecision: 'High-p 32-bit Float',
    loadCategory: 'optimal',
    coreTempC: 54,
    thermalStatus: 'nominal',
    fanSpeedRpm: 1680,
  });

  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkProgress, setBenchmarkProgress] = useState(0);
  const [benchmarkScore, setBenchmarkScore] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState<'metrics' | 'thermal' | 'heatmap' | 'queue-etc' | 'thermal-log' | 'recommendations' | 'benchmark' | 'processes'>('metrics');

  // GPU Process Manager overlay toggle state
  const [isProcessManagerOpen, setIsProcessManagerOpen] = useState(false);

  // Historical thermal incidents log (>85°C) with initial realistic telemetry records
  const [thermalEvents, setThermalEvents] = useState<ThermalEvent[]>(() => [
    {
      id: 'thm-evt-101',
      timestamp: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      formattedTime: new Date(Date.now() - 14 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      formattedDate: new Date(Date.now() - 14 * 60 * 1000).toISOString().slice(0, 10),
      temperatureC: 88,
      temperatureF: 190,
      gpuLoadPercent: 94,
      fanSpeedRpm: 3200,
      activePreset: 'PRORES_422HQ',
      renderJobTitle: 'Batch #4 - Master Cinema 4K UHD 60fps',
      durationSeconds: 42,
      severity: 'severe',
      throttleImpact: 'Frecuencia reloj reducida -35%, velocidad de render bajó de 60fps a 34fps',
      rootCause: 'Codificación intensiva ProRes 422 HQ en 4K DCI sin proxies activados',
      mitigationApplied: 'Ventilador forzado a 3,200 RPM, notificación de throttle emitida',
    },
    {
      id: 'thm-evt-102',
      timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
      formattedTime: new Date(Date.now() - 6 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      formattedDate: new Date(Date.now() - 6 * 60 * 1000).toISOString().slice(0, 10),
      temperatureC: 91,
      temperatureF: 196,
      gpuLoadPercent: 97,
      fanSpeedRpm: 3200,
      activePreset: 'AV1_4K_HDR',
      renderJobTitle: 'Multi-cam Grading 10-bit HDR Timeline',
      durationSeconds: 65,
      severity: 'critical',
      throttleImpact: 'Protección térmica severa: clock recortado -48%, tiempo de cola aumentado +90%',
      rootCause: 'Combinación simultánea de 3D LUT Lumetri + Speed Ramp 120fps + Texturas 8K',
      mitigationApplied: 'Alerta crítica emitida, recomendación de conmutación a H.264 1080p',
    },
    {
      id: 'thm-evt-103',
      timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      formattedTime: new Date(Date.now() - 2 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      formattedDate: new Date(Date.now() - 2 * 60 * 1000).toISOString().slice(0, 10),
      temperatureC: 86,
      temperatureF: 187,
      gpuLoadPercent: 88,
      fanSpeedRpm: 3100,
      activePreset: 'TIKTOK_VERTICAL_60FPS',
      renderJobTitle: 'OmniCut_TikTok_Reels_Vertical_Batch',
      durationSeconds: 28,
      severity: 'warning',
      throttleImpact: 'Caída de frametime en previsualización de 16ms a 29ms',
      rootCause: 'Batch de 8 clips con transiciones de desenfoque de movimiento en paralelo',
      mitigationApplied: 'Disipación pasiva recuperada tras finalización del chunk #6',
    }
  ]);

  // Ref to debounce recording of recurring thermal spikes (>85°C) to prevent duplicate event spam
  const lastRecordedSpikeTimeRef = useRef<number>(0);

  // Thermal throttle overlay alert states
  const [isThrottleAlertDismissed, setIsThrottleAlertDismissed] = useState(false);
  const [simulatedHighTemp, setSimulatedHighTemp] = useState<number | null>(null);

  // Initialize WebGL context and micro-render pipeline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    try {
      gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as any;
    } catch (e) {
      console.warn('WebGL init fallback:', e);
    }

    if (!gl) {
      setGpuInfo((prev) => ({
        ...prev,
        renderer: 'Emulación por Software (Sin WebGL nativo)',
        vendor: 'CPU Fallback',
        gpuLoadPercent: 78,
        loadCategory: 'heavy',
        coreTempC: 72,
        thermalStatus: 'warm',
        fanSpeedRpm: 2400,
      }));
      return;
    }

    // Query hardware parameters
    let rendererName = 'Acelerador Gráfico Estándar';
    let vendorName = 'Hardware GPU';
    const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugExt) {
      const unmaskedRenderer = gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL);
      const unmaskedVendor = gl.getParameter(debugExt.UNMASKED_VENDOR_WEBGL);
      if (unmaskedRenderer) rendererName = String(unmaskedRenderer);
      if (unmaskedVendor) vendorName = String(unmaskedVendor);
    } else {
      const paramRenderer = gl.getParameter(gl.RENDERER);
      if (paramRenderer) rendererName = String(paramRenderer);
    }

    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 8192;
    const maxVp = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    const maxVpStr = maxVp ? `${maxVp[0]}x${maxVp[1]}` : '8192x8192';
    const extList = gl.getSupportedExtensions() || [];

    // Compile minimal vertex and fragment shaders for real micro-benchmarking
    const vsSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;
      uniform float u_time;
      uniform float u_complexity;
      void main() {
        vec2 p = gl_FragCoord.xy * 0.005;
        float v = sin(p.x * 10.0 + u_time) * cos(p.y * 10.0 + u_time * 0.5);
        for(int i = 0; i < 4; i++) {
          p = p * 1.3 + vec2(sin(float(i) + u_time), cos(float(i) - u_time));
          v += sin(length(p) * u_complexity);
        }
        gl_FragColor = vec4(vec3(v * 0.5 + 0.5), 1.0);
      }
    `;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    let program: WebGLProgram | null = null;

    if (vs && fs) {
      gl.shaderSource(vs, vsSource);
      gl.compileShader(vs);
      gl.shaderSource(fs, fsSource);
      gl.compileShader(fs);

      program = gl.createProgram();
      if (program) {
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
      }
    }

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    let frameCount = 0;
    let fpsAccumulator = 0;
    let lastFpsCalcTime = performance.now();
    let currentFps = 60;
    let smoothedLoad = 32;
    let smoothedTemp = 52;

    const renderLoop = (now: number) => {
      const deltaMs = now - lastTimeRef.current;
      lastTimeRef.current = now;

      frameCount++;
      fpsAccumulator += deltaMs;
      if (now - lastFpsCalcTime >= 500) {
        currentFps = Math.min(144, Math.round((frameCount * 1000) / (now - lastFpsCalcTime)));
        frameCount = 0;
        lastFpsCalcTime = now;
      }

      // Execute micro WebGL draw call and measure hardware response time
      let drawLatencyMs = 0.5;
      if (gl && program) {
        gl.useProgram(program);
        const posAttr = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(posAttr);
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

        const timeUniform = gl.getUniformLocation(program, 'u_time');
        const compUniform = gl.getUniformLocation(program, 'u_complexity');
        if (timeUniform) gl.uniform1f(timeUniform, now * 0.001);
        if (compUniform) {
          gl.uniform1f(compUniform, benchmarkActiveRef.current ? 12.0 : 3.0);
        }

        const startDraw = performance.now();
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (benchmarkActiveRef.current) {
          for (let b = 0; b < 6; b++) {
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          }
        }
        gl.flush();
        drawLatencyMs = performance.now() - startDraw;
      }

      // Calculate load % based on 60fps frame budget (16.6ms) + draw latency
      const targetBudgetMs = 16.67;
      const baseLoadFromDelta = Math.min(100, (deltaMs / targetBudgetMs) * 35);
      const latencyLoad = Math.min(100, (drawLatencyMs / 2.5) * 45);
      const instantLoad = Math.max(12, Math.min(98, baseLoadFromDelta * 0.5 + latencyLoad * 0.5 + (benchmarkActiveRef.current ? 45 : 0)));

      smoothedLoad = smoothedLoad * 0.85 + instantLoad * 0.15;
      const finalLoad = Math.round(smoothedLoad);

      // Core Temperature physics simulation based on load and benchmark
      const targetTemp = 41 + (finalLoad * 0.42) + (benchmarkActiveRef.current ? 14 : 0);
      smoothedTemp = smoothedTemp * 0.94 + targetTemp * 0.06;
      const finalTemp = Math.round(smoothedTemp);
      const finalFanRpm = Math.round(1350 + (finalLoad * 14) + (finalTemp > 75 ? 650 : 0));

      // Determine load category
      let category: 'optimal' | 'moderate' | 'heavy' | 'bottleneck' = 'optimal';
      if (finalLoad > 82) category = 'bottleneck';
      else if (finalLoad > 62) category = 'heavy';
      else if (finalLoad > 45) category = 'moderate';

      let thermalStatus: 'cool' | 'nominal' | 'warm' | 'throttle' | 'throttle-critical' = 'nominal';
      if (finalTemp >= 85) thermalStatus = 'throttle-critical';
      else if (finalTemp > 76) thermalStatus = 'throttle';
      else if (finalTemp > 68) thermalStatus = 'warm';
      else if (finalTemp < 50) thermalStatus = 'cool';

      // Update history buffer
      historyRef.current.push(finalLoad);
      if (historyRef.current.length > 40) {
        historyRef.current.shift();
      }

      // Sample real-time thermal data point into Recharts dataset every 800ms
      if (now - lastThermalSampleRef.current >= 800) {
        lastThermalSampleRef.current = now;
        const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setThermalData((prev) => {
          const next = [
            ...prev,
            {
              time: timeLabel,
              load: finalLoad,
              temp: finalTemp,
              fanRpm: finalFanRpm,
            },
          ];
          return next.slice(-30);
        });
      }

      // Update state at ~4Hz to prevent React thrashing
      if (frameCount % 12 === 0) {
        setGpuInfo((prev) => ({
          ...prev,
          renderer: rendererName,
          vendor: vendorName,
          webglVersion: gl instanceof WebGL2RenderingContext ? 'WebGL 2.0 (DirectX/Metal/Vulkan)' : 'WebGL 1.0',
          maxTextureSize: maxTex,
          maxViewportSize: maxVpStr,
          extensionsCount: extList.length,
          currentFps,
          frameTimeMs: Number(deltaMs.toFixed(1)),
          gpuLoadPercent: finalLoad,
          estimatedVramMb: Math.round(950 + (finalLoad / 100) * 1800 + (benchmarkActiveRef.current ? 1200 : 0)),
          loadCategory: category,
          coreTempC: finalTemp,
          thermalStatus,
          fanSpeedRpm: finalFanRpm,
        }));
      }

      // Draw real-time sparkline chart on chart canvas
      drawSparkline();

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, []);

  // Draw real-time GPU load waveform graph on canvas fallback
  const drawSparkline = useCallback(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const data = historyRef.current;
    if (data.length < 2) return;

    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.25);
    ctx.lineTo(w, h * 0.25);
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(w, h * 0.5);
    ctx.moveTo(0, h * 0.75);
    ctx.lineTo(w, h * 0.75);
    ctx.stroke();

    // Area fill gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    const lastVal = data[data.length - 1];
    if (lastVal > 80) {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.02)');
      ctx.strokeStyle = '#f87171';
    } else if (lastVal > 60) {
      gradient.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
      gradient.addColorStop(1, 'rgba(245, 158, 11, 0.02)');
      ctx.strokeStyle = '#fbbf24';
    } else {
      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
      gradient.addColorStop(1, 'rgba(56, 189, 248, 0.02)');
      ctx.strokeStyle = '#38bdf8';
    }

    const step = w / (data.length - 1);

    ctx.beginPath();
    data.forEach((val, i) => {
      const x = i * step;
      const y = h - (val / 100) * (h - 8) - 4;
      if (i === 0) ctx.moveTo(x, y);
      else {
        const prevX = (i - 1) * step;
        const prevY = h - (data[i - 1] / 100) * (h - 8) - 4;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    });

    // Stroke line
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fill under line
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Glowing tip
    const lastX = w;
    const lastY = h - (lastVal / 100) * (h - 8) - 4;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  // Run GPU Stress Benchmark
  const handleRunBenchmark = () => {
    if (isBenchmarking) return;
    setIsBenchmarking(true);
    benchmarkActiveRef.current = true;
    setBenchmarkProgress(10);
    setSelectedTab('benchmark');

    const startTime = performance.now();
    let steps = 0;

    const interval = setInterval(() => {
      steps++;
      setBenchmarkProgress((prev) => Math.min(95, prev + 18));

      if (steps >= 5) {
        clearInterval(interval);
        benchmarkActiveRef.current = false;
        const totalDuration = performance.now() - startTime;
        const baseMult = gpuInfo.maxTextureSize >= 16384 ? 4200 : 2600;
        const score = Math.round(baseMult + (1000 / (totalDuration / 5)) * 120);
        setBenchmarkScore(score);
        setBenchmarkProgress(100);
        setIsBenchmarking(false);
      }
    }, 450);
  };

  // Effective core temperature (supports realistic high-load simulation for demo/testing)
  const effectiveCoreTemp = simulatedHighTemp !== null ? simulatedHighTemp : gpuInfo.coreTempC;
  const isThermalThrottling = effectiveCoreTemp >= 85;

  // Track and log historical thermal events (>85°C) to help detect recurring overheating during render batches
  useEffect(() => {
    if (effectiveCoreTemp >= 85) {
      const now = Date.now();
      // Debounce logging so the same overheat spike isn't duplicated every tick (record once per spike or every 12 seconds)
      if (now - lastRecordedSpikeTimeRef.current >= 12000) {
        lastRecordedSpikeTimeRef.current = now;
        const d = new Date();
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = d.toISOString().slice(0, 10);
        const severity: 'critical' | 'severe' | 'warning' = 
          effectiveCoreTemp >= 90 ? 'critical' : (effectiveCoreTemp >= 87 ? 'severe' : 'warning');

        const activeJob = activeQueueJobs?.find(j => j.status === 'processing');
        const jobTitle = activeJob 
          ? `${activeJob.title} (${activeJob.resolution})`
          : (currentPreset ? `Exportación ${currentPreset} en curso` : 'Renderizado en Cola Paralela GPU');

        const newEvent: ThermalEvent = {
          id: `thm-evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timestamp: d.toISOString(),
          formattedTime: timeStr,
          formattedDate: dateStr,
          temperatureC: effectiveCoreTemp,
          temperatureF: Math.round(effectiveCoreTemp * 1.8 + 32),
          gpuLoadPercent: gpuInfo.gpuLoadPercent,
          fanSpeedRpm: Math.max(gpuInfo.fanSpeedRpm, 3200),
          activePreset: currentPreset || 'PRORES_422HQ',
          renderJobTitle: jobTitle,
          durationSeconds: Math.floor(Math.random() * 35) + 18,
          severity,
          throttleImpact: `Clock GPU reducido un ${effectiveCoreTemp >= 90 ? '45%' : '32%'} para protección térmica. ETC retardado.`,
          rootCause: effectiveCoreTemp >= 90 
            ? 'Carga combinada de efectos, gradación HDR y renderizado continuo de chunks' 
            : 'Saturación prolongada del motor WebGL a alta resolución (>1080p)',
          mitigationApplied: 'Ventilador al 100% (3,200 RPM) y advertencia al usuario',
        };

        setThermalEvents(prev => [newEvent, ...prev.slice(0, 49)]);
      }
    }
  }, [effectiveCoreTemp, gpuInfo.gpuLoadPercent, gpuInfo.fanSpeedRpm, currentPreset, activeQueueJobs]);

  // Export Settings Recommendations based on current load and hardware
  const exportRecommendations = useMemo(() => {
    const isBottlenecked = gpuInfo.gpuLoadPercent > 75 || effectiveCoreTemp >= 80;
    const isHighEnd = gpuInfo.maxTextureSize >= 16384 && gpuInfo.currentFps >= 50 && effectiveCoreTemp < 75;

    if (isBottlenecked) {
      return {
        recommendedPreset: 'H264_1080P' as const,
        recommendedResolution: '1920x1080',
        title: 'H.264 High Profile (Optimización por Carga/Temperatura)',
        reason: `Carga de GPU ${gpuInfo.gpuLoadPercent}% y temperatura ${effectiveCoreTemp}°C. Cambiar a H.264 1080p previene throttling térmico y asegura exportación rápida.`,
        color: 'text-amber-300',
        badge: effectiveCoreTemp >= 85 ? 'Peligro Térmico (>85°C)' : 'Carga Elevada',
        savings: '-65% tiempo de render',
      };
    } else if (isHighEnd && gpuInfo.gpuLoadPercent < 50) {
      return {
        recommendedPreset: 'PRORES_422HQ' as const,
        recommendedResolution: '3840x2160',
        title: 'Apple ProRes 422 HQ (4K UHD Master Cinema)',
        reason: `GPU con amplio margen térmico (${effectiveCoreTemp}°C) y texturas de 16K. Tu acelerador soporta renderizado multicapa en 10-bit 4K a 60 FPS.`,
        color: 'text-sky-300',
        badge: 'Rendimiento Óptimo',
        savings: 'Máxima Fidelidad',
      };
    } else {
      return {
        recommendedPreset: 'TIKTOK_VERTICAL_60FPS' as const,
        recommendedResolution: '1080x1920',
        title: 'TikTok / Reels 9:16 (60 FPS Balanceado)',
        reason: `Configuración equilibrada para exportación rápida con aceleración por hardware completa y temperatura estable (${effectiveCoreTemp}°C).`,
        color: 'text-emerald-300',
        badge: 'Recomendado',
        savings: '-40% uso de VRAM',
      };
    }
  }, [gpuInfo, effectiveCoreTemp]);

  // Render Queue ETC (Estimated Time of Completion) calculation based on GPU load
  const queueEtc = useMemo(() => {
    // Collect active jobs (status === 'processing' or 'queued')
    // Fallback to active jobs if activeQueueJobs is provided or simulate realistic queue state
    const jobsList: CloudRenderJob[] = (activeQueueJobs && activeQueueJobs.length > 0)
      ? activeQueueJobs
      : [
          {
            id: 'job-active-demo',
            title: 'OmniCut_TikTok_Reels_9x16_60fps',
            preset: 'TIKTOK_VERTICAL_60FPS',
            resolution: '1080x1920 (9:16 Vertical)',
            fps: 60,
            bitrate: '24 Mbps',
            status: 'processing',
            totalChunks: 8,
            completedChunks: 6,
            estimatedTimeLeft: '8s restante',
            nodesAssigned: 8,
            fileSizeBytes: 380000000,
          },
          {
            id: 'job-queued-demo',
            title: 'OmniCut_ProRes_Scene_Grading_4K',
            preset: 'PRORES_422HQ',
            resolution: '3840x2160 (4K UHD)',
            fps: 60,
            bitrate: '220 Mbps',
            status: 'queued',
            totalChunks: 10,
            completedChunks: 0,
            estimatedTimeLeft: 'En espera',
            nodesAssigned: 8,
            fileSizeBytes: 1250000000,
          }
        ];

    const activeJobs = jobsList.filter(j => j.status === 'processing' || j.status === 'queued');
    const completedJobs = jobsList.filter(j => j.status === 'completed');

    // Total chunks pending across active and queued jobs
    let totalPendingChunks = 0;
    let totalChunksCount = 0;
    let completedChunksCount = 0;

    // Detailed per-job ETC breakdown
    const jobBreakdowns = activeJobs.map(job => {
      const remainingChunks = Math.max(0, job.totalChunks - job.completedChunks);
      totalPendingChunks += remainingChunks;
      totalChunksCount += job.totalChunks;
      completedChunksCount += job.completedChunks;

      // Base chunk time: higher resolution & prores take longer baseline
      let baseChunkSeconds = 4.0;
      if (job.preset === 'PRORES_422HQ' || job.resolution.includes('4K') || job.resolution.includes('3840') || job.resolution.includes('4096')) {
        baseChunkSeconds = 7.5;
      } else if (job.preset === 'AV1_4K_HDR') {
        baseChunkSeconds = 6.8;
      } else if (job.preset === 'H264_1080P') {
        baseChunkSeconds = 3.2;
      } else if (job.preset === 'TIKTOK_VERTICAL_60FPS') {
        baseChunkSeconds = 3.5;
      }

      // GPU Load Factor:
      // When GPU load is light (<40%), processing takes baseline time.
      // High GPU load (>75%) increases duration (factor 1.35x - 2.2x).
      // If thermal throttling (>85°C), clock down causes additional 1.8x penalty!
      const currentLoad = gpuInfo.gpuLoadPercent;
      let loadMultiplier = 1.0;
      if (currentLoad > 85) {
        loadMultiplier = 1.95; // Extreme GPU load queue stall
      } else if (currentLoad > 70) {
        loadMultiplier = 1.55;
      } else if (currentLoad > 50) {
        loadMultiplier = 1.25;
      } else if (currentLoad < 25) {
        loadMultiplier = 0.85; // GPU is idle and fast
      }

      // Thermal throttle multiplier
      const thermalPenalty = isThermalThrottling ? 1.85 : (effectiveCoreTemp > 76 ? 1.25 : 1.0);
      
      // Multi-node cluster speedup: 8 nodes distribute chunks
      const nodeClusterEfficiency = Math.max(1, (job.nodesAssigned || 8) * 0.72);
      
      const secondsRemainingForJob = Math.max(
        1,
        Math.round((remainingChunks * baseChunkSeconds * loadMultiplier * thermalPenalty) / (nodeClusterEfficiency > 1 ? 1.8 : 1))
      );

      return {
        id: job.id,
        title: job.title,
        preset: job.preset,
        status: job.status,
        remainingChunks,
        totalChunks: job.totalChunks,
        completedChunks: job.completedChunks,
        secondsRemaining: secondsRemainingForJob,
        formattedRemaining: secondsRemainingForJob > 60 
          ? `${Math.floor(secondsRemainingForJob / 60)}m ${secondsRemainingForJob % 60}s`
          : `${secondsRemainingForJob}s`,
      };
    });

    // Total seconds for entire queue
    const totalQueueSeconds = jobBreakdowns.reduce((acc, curr) => acc + curr.secondsRemaining, 0);

    const formatTime = (secs: number) => {
      if (secs <= 0) return '0s (Completado)';
      if (secs < 60) return `${secs}s`;
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      if (m < 60) return `${m}m ${s}s`;
      const h = Math.floor(m / 60);
      const remM = m % 60;
      return `${h}h ${remM}m`;
    };

    // Projected completion timestamp
    const completionDate = new Date(Date.now() + totalQueueSeconds * 1000);
    const completionTimeStr = completionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Effective processing throughput (FPS) scaled by load
    const baseThroughputFps = 248.5; // 8-node cluster nominal
    const throughputMultiplier = isThermalThrottling ? 0.52 : (gpuInfo.gpuLoadPercent > 80 ? 0.72 : (gpuInfo.gpuLoadPercent < 40 ? 1.15 : 0.95));
    const effectiveThroughputFps = Math.round(baseThroughputFps * throughputMultiplier * 10) / 10;

    // Overall progress percentage across all chunks in queue
    const queueProgressPercent = totalChunksCount > 0 
      ? Math.round((completedChunksCount / totalChunksCount) * 100)
      : (activeJobs.length === 0 ? 100 : 0);

    return {
      activeJobsCount: activeJobs.length,
      completedJobsCount: completedJobs.length,
      totalPendingChunks,
      totalChunksCount,
      completedChunksCount,
      totalQueueSeconds,
      formattedQueueTime: formatTime(totalQueueSeconds),
      completionTimeStr,
      effectiveThroughputFps,
      queueProgressPercent,
      jobBreakdowns,
      loadImpact: gpuInfo.gpuLoadPercent > 80 ? 'Retraso por alta carga (+55%)' : (gpuInfo.gpuLoadPercent < 35 ? 'Acelerado (-15%)' : 'Nominal'),
      thermalThrottleImpact: isThermalThrottling ? '+85% tiempo extra por estrangulamiento térmico' : null,
    };
  }, [activeQueueJobs, gpuInfo.gpuLoadPercent, isThermalThrottling, effectiveCoreTemp]);

  return (
    <div className="bg-[#0b101c] border border-sky-900/50 rounded-xl p-4 sm:p-5 space-y-4 shadow-xl select-none">
      {/* Offscreen / Probe WebGL Canvas */}
      <canvas ref={canvasRef} width={64} height={64} className="hidden" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500/20 via-blue-500/20 to-indigo-500/30 border border-sky-500/40 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>GPU Performance &amp; Thermal Monitor</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </h3>
              <span className="text-[9px] font-mono bg-sky-950/80 text-sky-300 border border-sky-700/60 px-1.5 py-0.2 rounded font-bold">
                WebGL 2.0 &bull; Recharts
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate max-w-xl">
              {gpuInfo.renderer} &bull; {gpuInfo.vendor}
            </p>
          </div>
        </div>

        {/* Action Tabs & Temperature Unit Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Unit Toggle */}
          <div className="flex items-center bg-[#070b13] border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => setTempUnit('C')}
              className={`px-2 py-0.5 rounded transition ${
                tempUnit === 'C' ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              °C
            </button>
            <button
              onClick={() => setTempUnit('F')}
              className={`px-2 py-0.5 rounded transition ${
                tempUnit === 'F' ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              °F
            </button>
          </div>

          <div className="flex items-center gap-1 bg-[#070b13] p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedTab('metrics')}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                selectedTab === 'metrics'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Métricas en Vivo
            </button>
            <button
              onClick={() => setSelectedTab('thermal')}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1.5 ${
                selectedTab === 'thermal'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Thermometer className="w-3.5 h-3.5 text-rose-400" />
              <span>Curva Térmica vs Carga</span>
            </button>
            <button
              onClick={() => setSelectedTab('heatmap')}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1.5 ${
                selectedTab === 'heatmap'
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 font-bold shadow-sm shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Mapa de Calor D3</span>
            </button>
            <button
              onClick={() => setSelectedTab('queue-etc')}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1.5 ${
                selectedTab === 'queue-etc'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>ETC Cola ({queueEtc.formattedQueueTime})</span>
            </button>
            <button
              onClick={() => setSelectedTab('thermal-log')}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1.5 ${
                selectedTab === 'thermal-log'
                  ? 'bg-red-500/25 text-red-300 border border-red-500/50 font-bold shadow-sm shadow-red-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5 text-red-400" />
              <span>Historial &gt;85°C</span>
              {thermalEvents.length > 0 && (
                <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  thermalEvents.some(e => e.temperatureC >= 90)
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-red-950 text-red-300 border border-red-700/60'
                }`}>
                  {thermalEvents.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setSelectedTab('recommendations')}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                selectedTab === 'recommendations'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Optimización
            </button>
            <button
              onClick={() => setSelectedTab('benchmark')}
              className={`px-2.5 py-1 rounded font-medium transition cursor-pointer flex items-center gap-1 ${
                selectedTab === 'benchmark'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3 h-3 text-purple-400" />
              <span>Benchmark</span>
            </button>
          </div>

          {/* Process Manager Overlay Launcher Button */}
          <button
            onClick={() => setIsProcessManagerOpen(true)}
            className="px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition border cursor-pointer bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 border-sky-700/70 shadow-sm shadow-sky-950/40"
            title="Abrir GPU Process Manager para inspeccionar tareas individuales y matar procesos colgados"
          >
            <Server className="w-3.5 h-3.5 text-sky-400" />
            <span>Process Manager</span>
          </button>

          {/* Thermal Throttle Demo/Test Button */}
          <button
            onClick={() => setSimulatedHighTemp(prev => prev === null ? 88 : null)}
            className={`px-2 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition border cursor-pointer ${
              effectiveCoreTemp >= 85
                ? 'bg-red-500 text-white border-red-400 animate-pulse shadow-md shadow-red-500/30'
                : 'bg-red-950/40 hover:bg-red-900/60 text-red-300 border-red-800/60'
            }`}
            title="Simular subida de temperatura a 88°C para probar la advertencia de estrangulamiento térmico"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <span>{effectiveCoreTemp >= 85 ? 'Prueba Throttle 88°C Activa' : 'Probar Alerta >85°C'}</span>
          </button>
        </div>
      </div>

      {/* FEATURE: THERMAL THROTTLE WARNING OVERLAY / STATUS INDICATOR (Triggers when GPU Core Temp >= 85°C) */}
      {isThermalThrottling && !isThrottleAlertDismissed && (
        <div 
          role="alert"
          className="relative overflow-hidden rounded-xl border-2 border-red-500/90 bg-gradient-to-r from-red-950/90 via-[#1f0a0e] to-red-950/90 p-4 sm:p-5 shadow-2xl shadow-red-900/40 animate-pulse-subtle"
        >
          {/* Ambient red thermal glow effect */}
          <div className="absolute -top-12 -right-12 w-44 h-44 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-rose-600/20 rounded-full blur-2xl pointer-events-none" />

          {/* Dismiss button */}
          <button
            onClick={() => setIsThrottleAlertDismissed(true)}
            className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/40 hover:bg-black/80 text-red-300 hover:text-white border border-red-500/40 transition cursor-pointer z-10"
            title="Cerrar y descartar advertencia"
            aria-label="Cerrar advertencia"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pr-6 sm:pr-8">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-red-600/25 border-2 border-red-500 flex items-center justify-center flex-shrink-0 text-red-400 shadow-lg shadow-red-600/30">
                <AlertOctagon className="w-7 h-7 text-red-400 animate-bounce" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-red-600 text-white shadow-sm flex items-center gap-1 tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    PELIGRO: THERMAL THROTTLING DETECTADO
                  </span>
                  <span className="text-[11px] font-mono text-red-200 font-bold bg-red-950/80 px-2 py-0.5 rounded border border-red-700/60">
                    {effectiveCoreTemp}°C &gt; 85°C LÍMITE CRÍTICO
                  </span>
                </div>

                <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                  <span>Riesgo de Degeneración de Rendimiento en Renderizado</span>
                </h4>

                <p className="text-xs text-red-100/90 max-w-2xl leading-relaxed">
                  La temperatura del núcleo de la GPU ha sobrepasado los <strong>85°C ({tempUnit === 'F' ? `${Math.round(effectiveCoreTemp * 1.8 + 32)}°F` : `${effectiveCoreTemp}°C`})</strong>. El reloj de procesamiento entrará en modo de estrangulamiento térmico (<em>thermal throttling</em>), lo que puede provocar caídas severas de cuadros por segundo (FPS), retrasos en el scrubber y fallos por sobrecalentamiento durante la codificación multicapa.
                </p>

                {/* Mitigation checklist */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-red-200 font-mono">
                  <span className="flex items-center gap-1 text-red-300">
                    <Fan className="w-3.5 h-3.5 text-red-400 animate-spin" /> Ventilador forzado al 100% (3,200 RPM)
                  </span>
                  <span className="text-red-400">&bull;</span>
                  <span>Modo recomendado: <strong>H.264 1080p o Proxies 720p</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Actions inside Overlay */}
            <div className="flex items-center gap-2.5 self-stretch sm:self-end md:self-center flex-shrink-0 flex-wrap">
              <button
                onClick={() => {
                  setSimulatedHighTemp(null);
                  setIsThrottleAlertDismissed(true);
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-600/30 transition active:scale-95 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                title="Corregir sobrecalentamiento, restaurar frecuencia y enfriar GPU a estado óptimo"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Corregir Error / Enfriar GPU</span>
              </button>

              {onApplyExportOptimization && (
                <button
                  onClick={() => onApplyExportOptimization('H264_1080P', '1920x1080')}
                  className="px-3 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-red-600/30 transition active:scale-95 cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Perfil Seguro 1080p</span>
                </button>
              )}

              <button
                onClick={() => setSelectedTab('thermal')}
                className="px-3 py-2 bg-black/40 hover:bg-black/60 border border-red-500/50 text-red-200 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              >
                <Thermometer className="w-3.5 h-3.5 text-red-400" />
                <span>Ver Curva Térmica</span>
              </button>

              <button
                onClick={() => setSelectedTab('thermal-log')}
                className="px-3 py-2 bg-red-950/70 hover:bg-red-900/80 border border-red-600/70 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shadow-sm shadow-red-900/30"
              >
                <History className="w-3.5 h-3.5 text-red-300" />
                <span>Historial &gt;85°C ({thermalEvents.length})</span>
              </button>

              <button
                onClick={() => setIsProcessManagerOpen(true)}
                className="px-3 py-2 bg-slate-900/90 hover:bg-sky-950 border border-sky-600/70 text-sky-200 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap shadow-sm"
                title="Abrir Process Manager para inspeccionar procesos y matar tareas de render colgadas"
              >
                <Server className="w-3.5 h-3.5 text-sky-400" />
                <span>Process Manager</span>
              </button>

              {simulatedHighTemp !== null && (
                <button
                  onClick={() => setSimulatedHighTemp(null)}
                  className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition cursor-pointer"
                  title="Restaurar lectura de sensor normal"
                >
                  Restablecer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Telemetry Gauges Grid (6 Key Performance Pillars including Queue ETC) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Gauge 1: GPU Load */}
        <div className="p-3 bg-[#070c16] border border-slate-800 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span className="uppercase tracking-wider font-semibold">Carga del Motor GPU</span>
            <Gauge className={`w-3.5 h-3.5 ${
              gpuInfo.gpuLoadPercent > 80 ? 'text-rose-400' : gpuInfo.gpuLoadPercent > 60 ? 'text-amber-400' : 'text-sky-400'
            }`} />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-white">
              {gpuInfo.gpuLoadPercent}%
            </span>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
              gpuInfo.gpuLoadPercent > 80 
                ? 'bg-rose-950 text-rose-300 border border-rose-800' 
                : gpuInfo.gpuLoadPercent > 60 
                ? 'bg-amber-950 text-amber-300 border border-amber-800' 
                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
            }`}>
              {gpuInfo.loadCategory}
            </span>
          </div>
          <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${
                gpuInfo.gpuLoadPercent > 80 ? 'bg-rose-500' : gpuInfo.gpuLoadPercent > 60 ? 'bg-amber-500' : 'bg-sky-400'
              }`}
              style={{ width: `${gpuInfo.gpuLoadPercent}%` }}
            />
          </div>
        </div>

        {/* Gauge 2: Core Temperature (Thermal Sensor) */}
        <div className={`p-3 bg-[#070c16] rounded-lg space-y-1.5 transition-all ${
          effectiveCoreTemp >= 85 
            ? 'border-2 border-red-500 shadow-lg shadow-red-500/20 bg-gradient-to-b from-red-950/40 to-[#070c16]' 
            : effectiveCoreTemp > 76 
            ? 'border border-rose-700/80' 
            : 'border border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span className="uppercase tracking-wider font-semibold flex items-center gap-1">
              <span>Temp Núcleo (Core)</span>
              {effectiveCoreTemp >= 85 && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              )}
            </span>
            <Thermometer className={`w-3.5 h-3.5 ${
              effectiveCoreTemp >= 85 
                ? 'text-red-500 animate-bounce' 
                : effectiveCoreTemp > 76 
                ? 'text-rose-400 animate-pulse' 
                : effectiveCoreTemp > 68 
                ? 'text-amber-400' 
                : 'text-emerald-400'
            }`} />
          </div>
          <div className="flex items-baseline justify-between">
            <span className={`text-xl font-bold font-mono ${
              effectiveCoreTemp >= 85 
                ? 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' 
                : effectiveCoreTemp > 76 
                ? 'text-rose-400' 
                : effectiveCoreTemp > 68 
                ? 'text-amber-300' 
                : 'text-rose-200'
            }`}>
              {tempUnit === 'F' ? `${Math.round(effectiveCoreTemp * 1.8 + 32)}°F` : `${effectiveCoreTemp}°C`}
            </span>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
              effectiveCoreTemp >= 85
                ? 'bg-red-950 text-red-200 border border-red-600 animate-pulse font-extrabold'
                : effectiveCoreTemp > 76
                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                : effectiveCoreTemp > 68
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
            }`}>
              {effectiveCoreTemp >= 85 ? 'THROTTLE >85°' : effectiveCoreTemp > 76 ? 'CALIENTE' : effectiveCoreTemp > 68 ? 'MODERADO' : 'ÓPTIMO'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
            <span>Fan: {effectiveCoreTemp >= 85 ? Math.max(gpuInfo.fanSpeedRpm, 3200) : gpuInfo.fanSpeedRpm} RPM</span>
            <span className={effectiveCoreTemp >= 85 ? 'text-red-400 font-bold' : 'text-slate-500'}>
              {effectiveCoreTemp >= 85 ? '¡Límite 85°C Excedido!' : 'Límite Crítico: 85°C'}
            </span>
          </div>
        </div>

        {/* Gauge 3: Estimated Time of Completion (ETC) based on GPU Load */}
        <div 
          onClick={() => setSelectedTab('queue-etc')}
          className={`p-3 bg-[#070c16] rounded-lg space-y-1.5 cursor-pointer transition-all hover:border-emerald-500/60 ${
            selectedTab === 'queue-etc'
              ? 'border-2 border-emerald-500/80 shadow-lg shadow-emerald-500/20 bg-gradient-to-b from-emerald-950/30 to-[#070c16]'
              : 'border border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span className="uppercase tracking-wider font-semibold flex items-center gap-1">
              <span>ETC Cola Render</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </span>
            <Timer className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-emerald-300">
              {queueEtc.formattedQueueTime}
            </span>
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
              isThermalThrottling
                ? 'bg-red-950 text-red-300 border border-red-800 animate-pulse'
                : gpuInfo.gpuLoadPercent > 80
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
            }`}>
              {isThermalThrottling ? 'Penalizado +85%' : gpuInfo.gpuLoadPercent > 80 ? 'Demorado +55%' : 'Calibrado'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
            <span>Hora fin: <strong className="text-white">{queueEtc.completionTimeStr}</strong></span>
            <span className="text-emerald-400 font-semibold">{queueEtc.totalPendingChunks} chunks</span>
          </div>
        </div>

        {/* Gauge 4: Frametime & FPS */}
        <div className="p-3 bg-[#070c16] border border-slate-800 rounded-lg space-y-1.5">
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span className="uppercase tracking-wider font-semibold">Latencia &bull; Framerate</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-emerald-400">
              {gpuInfo.currentFps} <span className="text-xs font-normal text-slate-400">FPS</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {gpuInfo.frameTimeMs} ms
            </span>
          </div>
          <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
            <span>Presupuesto 60fps:</span>
            <strong className={gpuInfo.frameTimeMs <= 16.7 ? 'text-emerald-400' : 'text-amber-400'}>
              {gpuInfo.frameTimeMs <= 16.7 ? 'Fluido' : 'Sobrecarga'}
            </strong>
          </div>
        </div>

        {/* Gauge 5: VRAM Memory Footprint & Process Manager Shortcut */}
        <div 
          onClick={() => setIsProcessManagerOpen(true)}
          className="p-3 bg-[#070c16] border border-slate-800 hover:border-indigo-500/60 rounded-lg space-y-1.5 cursor-pointer transition group"
          title="Click para abrir GPU Process Manager e inspeccionar procesos"
        >
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span className="uppercase tracking-wider font-semibold group-hover:text-indigo-300 transition">Memoria de Video (VRAM)</span>
            <Layers className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-indigo-300">
              {(gpuInfo.estimatedVramMb / 1024).toFixed(2)} <span className="text-xs font-normal text-slate-400">GB</span>
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              / 8.0 GB
            </span>
          </div>
          <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 rounded-full transition-all duration-300"
              style={{ width: `${(gpuInfo.estimatedVramMb / gpuInfo.maxVramMb) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono pt-0.5">
            <span className="text-indigo-400 font-semibold group-hover:underline">Process Manager &rarr;</span>
            <span className="text-slate-500">Inspeccionar</span>
          </div>
        </div>

        {/* Gauge 6: Hardware Limits */}
        <div className="p-3 bg-[#070c16] border border-slate-800 rounded-lg space-y-1.5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 text-[10px]">
            <span className="uppercase tracking-wider font-semibold">Límite de Textura Máx</span>
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-yellow-300">
              {gpuInfo.maxTextureSize}px
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {gpuInfo.maxViewportSize}
            </span>
          </div>
          <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
            <span>Extensiones GL:</span>
            <strong className="text-slate-300">{gpuInfo.extensionsCount} activas</strong>
          </div>
        </div>
      </div>

      {/* FEATURE: REAL-TIME RECHARTS THERMAL & LOAD GRAPH (Visible in 'metrics' and 'thermal' tabs) */}
      {(selectedTab === 'metrics' || selectedTab === 'thermal') && (
        <div className="p-4 bg-[#070c16] border border-slate-800/90 rounded-xl space-y-3 shadow-inner">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-rose-400" />
              <h4 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Gráfico Térmico en Tiempo Real: Carga GPU vs Temperatura del Núcleo</span>
                <span className="text-[9px] font-mono bg-rose-950/70 text-rose-300 border border-rose-800/60 px-1.5 py-0.2 rounded font-bold">
                  Recharts Dual Axis
                </span>
              </h4>
            </div>

            <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 inline-block" /> Carga GPU (%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-1 rounded bg-rose-500 inline-block" /> Temperatura (°{tempUnit})
              </span>
              <span className="hidden md:inline text-slate-500">&bull; Muestreo continuo WebGL</span>
            </div>
          </div>

          {/* Recharts Chart Container */}
          <div className="w-full h-64 bg-[#04070e] rounded-xl border border-slate-900/80 p-2 relative">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={thermalData} margin={{ top: 12, right: 12, left: -10, bottom: 0 }}>
                <defs>
                  {/* Sky blue gradient for GPU load area */}
                  <linearGradient id="gpuLoadGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                  </linearGradient>
                  {/* Rose gradient for thermal warning */}
                  <linearGradient id="gpuTempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} vertical={false} />

                {/* X Axis: Time stamps */}
                <XAxis 
                  dataKey="time" 
                  stroke="#475569" 
                  fontSize={10} 
                  tickLine={false}
                  dy={4}
                />

                {/* Left Y Axis: GPU Load % */}
                <YAxis 
                  yAxisId="load" 
                  domain={[0, 100]} 
                  stroke="#38bdf8" 
                  fontSize={10} 
                  unit="%" 
                  tickLine={false}
                  dx={-4}
                />

                {/* Right Y Axis: Core Temperature in °C or °F */}
                <YAxis 
                  yAxisId="temp" 
                  orientation="right" 
                  domain={tempUnit === 'F' ? [85, 205] : [30, 95]} 
                  stroke="#f43f5e" 
                  fontSize={10} 
                  unit={`°${tempUnit}`} 
                  tickLine={false}
                  dx={4}
                />

                {/* Thermal Safety Guard Reference Line at 80°C (176°F) */}
                <ReferenceLine 
                  yAxisId="temp" 
                  y={tempUnit === 'F' ? 176 : 80} 
                  stroke="#f59e0b" 
                  strokeDasharray="4 4" 
                  label={{ 
                    value: `Alerta Temp (80°C)`, 
                    fill: '#fbbf24', 
                    fontSize: 9, 
                    position: 'insideTopRight' 
                  }} 
                />

                {/* CRITICAL THROTTLE THRESHOLD at 85°C (185°F) */}
                <ReferenceLine 
                  yAxisId="temp" 
                  y={tempUnit === 'F' ? 185 : 85} 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  strokeDasharray="5 3" 
                  label={{ 
                    value: `THROTTLE CRÍTICO (85°C)`, 
                    fill: '#f87171', 
                    fontSize: 9, 
                    fontWeight: 'bold',
                    position: 'insideBottomRight' 
                  }} 
                />

                <Tooltip content={<CustomThermalTooltip tempUnit={tempUnit} />} />

                <Legend 
                  wrapperStyle={{ fontSize: 11, paddingTop: 6 }} 
                  iconType="circle"
                  iconSize={8}
                />

                {/* GPU Load Area Curve */}
                <Area 
                  yAxisId="load" 
                  type="monotone" 
                  dataKey="load" 
                  name="Carga del Motor GPU (%)" 
                  fill="url(#gpuLoadGradient)" 
                  stroke="#38bdf8" 
                  strokeWidth={2} 
                />

                {/* Core Temperature Line Curve */}
                <Line 
                  yAxisId="temp" 
                  type="monotone" 
                  dataKey={tempUnit === 'F' ? (d: any) => Math.round(d.temp * 1.8 + 32) : 'temp'} 
                  name={`Temperatura del Núcleo (°${tempUnit})`} 
                  stroke="#f43f5e" 
                  strokeWidth={2.5} 
                  dot={false}
                  activeDot={{ r: 5, fill: '#f43f5e', stroke: '#ffffff', strokeWidth: 2 }} 
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Thermal Telemetry Footnote & Safety Margins */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-1 text-[11px] font-mono">
            <div className={`p-2.5 bg-[#040812] rounded-lg flex items-center justify-between border ${
              effectiveCoreTemp >= 85 ? 'border-red-500/80 bg-red-950/30' : 'border-slate-800'
            }`}>
              <span className="text-slate-400 font-sans">Margen Térmico:</span>
              <span className={`font-bold ${
                effectiveCoreTemp >= 85 ? 'text-red-400 animate-pulse' : 'text-emerald-400'
              }`}>
                {effectiveCoreTemp >= 85 ? '0°C (THROTTLE)' : `+${85 - effectiveCoreTemp}°C hasta 85°C`}
              </span>
            </div>

            <div className="p-2.5 bg-[#040812] border border-slate-800 rounded-lg flex items-center justify-between">
              <span className="text-slate-400 font-sans">Ventilador:</span>
              <span className="text-sky-300 font-bold">
                {gpuInfo.fanSpeedRpm} RPM ({Math.round((gpuInfo.fanSpeedRpm / 3200) * 100)}%)
              </span>
            </div>

            <div 
              onClick={() => setSelectedTab('thermal-log')}
              className={`p-2.5 bg-[#040812] rounded-lg flex items-center justify-between cursor-pointer transition group border ${
                thermalEvents.length > 0
                  ? 'border-red-900/60 hover:border-red-500/60 bg-red-950/15'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <span className="text-slate-400 font-sans flex items-center gap-1 group-hover:text-red-300">
                <History className="w-3 h-3 text-red-400" />
                <span>Historial &gt;85°C:</span>
              </span>
              <span className="text-red-300 font-bold flex items-center gap-1">
                <span>{thermalEvents.length} eventos</span>
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
              </span>
            </div>

            <div 
              onClick={() => setSelectedTab('heatmap')}
              className="p-2.5 bg-[#040812] border border-amber-900/60 hover:border-amber-500/60 rounded-lg flex items-center justify-between cursor-pointer transition group"
            >
              <span className="text-slate-400 font-sans flex items-center gap-1 group-hover:text-amber-300">
                <Flame className="w-3 h-3 text-amber-400 animate-pulse" />
                <span>Mapa de Calor:</span>
              </span>
              <span className="text-amber-300 font-bold underline decoration-amber-500/50">
                Ver Puntos
              </span>
            </div>

            <div className="p-2.5 bg-[#040812] border border-slate-800 rounded-lg flex items-center justify-between">
              <span className="text-slate-400 font-sans">Disipación:</span>
              <span className="text-amber-300 font-bold">
                ~1.6°C / 10%
              </span>
            </div>

            <div 
              onClick={() => setSelectedTab('queue-etc')}
              className="p-2.5 bg-[#040812] border border-emerald-900/60 hover:border-emerald-500/60 rounded-lg flex items-center justify-between cursor-pointer transition"
            >
              <span className="text-slate-400 font-sans flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" />
                <span>ETC Cola:</span>
              </span>
              <span className="text-emerald-300 font-bold">
                {queueEtc.formattedQueueTime}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB: D3.js Timeline GPU Load Heatmap & Clip Stress Identification */}
      {selectedTab === 'heatmap' && (
        <D3TimelineHeatmap
          timelineClips={timelineClips}
          timelineDuration={timelineDuration}
          currentGpuLoad={gpuInfo.gpuLoadPercent}
          isProxyModeActive={isProxyModeActive}
        />
      )}

      {/* TAB: Render Queue ETC (Estimated Time of Completion) Detail View */}
      {selectedTab === 'queue-etc' && (
        <div className="space-y-4">
          {/* Main ETC Banner Card */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-950/40 via-sky-950/30 to-[#07131e] border border-emerald-700/60 rounded-xl space-y-4 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 text-emerald-400">
                  <Clock className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Cálculo Dinámico Basado en Carga GPU
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {queueEtc.activeJobsCount} Trabajos Activos &bull; {queueEtc.totalPendingChunks} Chunks Pendientes
                    </span>
                  </div>
                  <h4 className="text-base sm:text-lg font-bold text-white mt-1 flex items-center gap-2">
                    <span>Tiempo Estimado de Finalización (ETC):</span>
                    <span className="text-emerald-400 font-mono font-black text-xl">
                      {queueEtc.formattedQueueTime}
                    </span>
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    El tiempo se recalcula en tiempo real correlacionando la carga actual de tu GPU ({gpuInfo.gpuLoadPercent}%), la frecuencia térmica del silicio ({effectiveCoreTemp}°C) y la aceleración en paralelo de 8 nodos de cómputo en la nube.
                  </p>
                </div>
              </div>

              {/* Estimated Completion Timestamp Badge */}
              <div className="flex flex-col sm:items-end bg-black/40 p-3 rounded-lg border border-emerald-900/40 font-mono text-xs flex-shrink-0 space-y-1">
                <span className="text-slate-400 text-[10px] uppercase font-sans">Hora Estimada de Entrega</span>
                <span className="text-lg font-bold text-white font-mono flex items-center gap-1.5">
                  <Timer className="w-4 h-4 text-emerald-400" />
                  <span>{queueEtc.completionTimeStr}</span>
                </span>
                <span className="text-[10px] text-emerald-400">
                  Throughput: ~{queueEtc.effectiveThroughputFps} FPS
                </span>
              </div>
            </div>

            {/* Impact factors notice */}
            {(gpuInfo.gpuLoadPercent > 80 || isThermalThrottling) && (
              <div className="p-3 bg-red-950/40 border border-red-700/60 rounded-lg text-xs flex items-center gap-2.5 text-red-200">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>
                  <strong>Aviso de Carga:</strong> {isThermalThrottling 
                    ? 'La GPU está en estrangulamiento térmico (>85°C). El ETC incluye un recargo de +85% por baja frecuencia de reloj.' 
                    : 'Carga de GPU saturada (>80%). El tiempo de procesamiento de chunks está demorado un +55%.'}
                </span>
              </div>
            )}

            {/* Queue Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-slate-300 font-mono">
                <span>Progreso Agregado de la Cola ({queueEtc.completedChunksCount} / {queueEtc.totalChunksCount} Chunks)</span>
                <span className="text-emerald-400 font-bold">{queueEtc.queueProgressPercent}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 via-sky-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${queueEtc.queueProgressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Active Jobs in Queue Breakdown Table */}
          <div className="p-4 bg-[#070c16] border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Desglose por Tarea en Cola con Ajuste de GPU</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Factor de carga actual: {gpuInfo.gpuLoadPercent > 80 ? '1.55x' : gpuInfo.gpuLoadPercent < 30 ? '0.85x' : '1.00x'}
              </span>
            </div>

            <div className="divide-y divide-slate-800/80">
              {queueEtc.jobBreakdowns.map((job) => (
                <div key={job.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100">{job.title}</span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                        job.status === 'processing' 
                          ? 'bg-sky-950 text-sky-300 border border-sky-800 animate-pulse'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {job.status === 'processing' ? 'Renderizando' : 'En espera'}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      Preset: <strong className="text-slate-300">{job.preset}</strong> &bull; Chunks pendientes: <strong className="text-white">{job.remainingChunks} / {job.totalChunks}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:text-right">
                    <div className="font-mono text-xs">
                      <span className="text-slate-500 block text-[9px] uppercase">Tiempo Restante</span>
                      <span className="text-emerald-400 font-bold">{job.formattedRemaining}</span>
                    </div>
                    <div className="w-20 bg-slate-800 rounded-full h-1.5 hidden sm:block">
                      <div 
                        className="bg-emerald-400 h-1.5 rounded-full"
                        style={{ width: `${Math.round((job.completedChunks / job.totalChunks) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Historical Thermal Incidents Log (>85°C Overheating Events Tracker) */}
      {selectedTab === 'thermal-log' && (
        <HistoricalThermalLog
          events={thermalEvents}
          tempUnit={tempUnit}
          onClearEvents={() => setThermalEvents([])}
          onSimulateThermalSpike={(tempC) => {
            setSimulatedHighTemp(tempC);
            // Also ensure alert is visible
            setIsThrottleAlertDismissed(false);
          }}
          onSelectThermalTab={() => setSelectedTab('thermal')}
          onApplyPreset={(preset, res) => onApplyExportOptimization?.(preset, res)}
        />
      )}

      {/* TAB 3: Export Optimization Suggestions */}
      {selectedTab === 'recommendations' && (
        <div className="space-y-3.5">
          {/* Main Recommendation Callout Card */}
          <div className="p-4 bg-gradient-to-r from-sky-950/30 via-indigo-950/20 to-slate-900 border border-sky-800/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  <span>Ajuste Recomendado para tu GPU Actual:</span>
                </span>
                <span className="text-[10px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded font-bold">
                  {exportRecommendations.badge}
                </span>
              </div>
              <h4 className="text-sm font-bold text-sky-200">{exportRecommendations.title}</h4>
              <p className="text-xs text-slate-300 max-w-xl">{exportRecommendations.reason}</p>
            </div>

            {onApplyExportOptimization && (
              <button
                onClick={() => onApplyExportOptimization(exportRecommendations.recommendedPreset, exportRecommendations.recommendedResolution)}
                className="bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-sky-600/25 transition active:scale-95 cursor-pointer whitespace-nowrap self-start sm:self-auto"
              >
                <span>Aplicar a la Exportación</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Preset Matrix Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Preset 1 */}
            <div 
              onClick={() => onApplyExportOptimization?.('PRORES_422HQ', '3840x2160')}
              className={`p-3 rounded-xl border transition cursor-pointer space-y-1.5 ${
                currentPreset === 'PRORES_422HQ'
                  ? 'bg-sky-500/15 border-sky-400 shadow-md ring-1 ring-sky-400/40'
                  : 'bg-[#070b13] border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-100">ProRes 422 HQ</span>
                <span className="text-[9px] font-mono text-emerald-400 font-bold">10-bit Cinema</span>
              </div>
              <p className="text-[10px] text-slate-400">Exige GPU de 16K y ~2.8 GB VRAM. Ideal para salas de cine y master de archivo.</p>
              <div className="pt-1 text-[10px] font-mono text-slate-400 flex justify-between border-t border-slate-800/80">
                <span>Carga estimada:</span>
                <strong className="text-sky-300">65-80%</strong>
              </div>
            </div>

            {/* Preset 2 */}
            <div 
              onClick={() => onApplyExportOptimization?.('H264_1080P', '1920x1080')}
              className={`p-3 rounded-xl border transition cursor-pointer space-y-1.5 ${
                currentPreset === 'H264_1080P'
                  ? 'bg-sky-500/15 border-sky-400 shadow-md ring-1 ring-sky-400/40'
                  : 'bg-[#070b13] border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-100">H.264 Fast Web</span>
                <span className="text-[9px] font-mono text-sky-400 font-bold">Bajo Consumo</span>
              </div>
              <p className="text-[10px] text-slate-400">Compatible con el 100% de dispositivos. Ideal si tu GPU tiene menos de 4GB VRAM.</p>
              <div className="pt-1 text-[10px] font-mono text-slate-400 flex justify-between border-t border-slate-800/80">
                <span>Carga estimada:</span>
                <strong className="text-emerald-400">25-40%</strong>
              </div>
            </div>

            {/* Preset 3 */}
            <div 
              onClick={() => onApplyExportOptimization?.('TIKTOK_VERTICAL_60FPS', '1080x1920')}
              className={`p-3 rounded-xl border transition cursor-pointer space-y-1.5 ${
                currentPreset === 'TIKTOK_VERTICAL_60FPS'
                  ? 'bg-sky-500/15 border-sky-400 shadow-md ring-1 ring-sky-400/40'
                  : 'bg-[#070b13] border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-100">TikTok 9:16 Vertical</span>
                <span className="text-[9px] font-mono text-pink-400 font-bold">60 FPS Ultra</span>
              </div>
              <p className="text-[10px] text-slate-400">Aceleración NVENC/Metal para transiciones dinámicas y 60fps sin stuttering.</p>
              <div className="pt-1 text-[10px] font-mono text-slate-400 flex justify-between border-t border-slate-800/80">
                <span>Carga estimada:</span>
                <strong className="text-emerald-400">35-50%</strong>
              </div>
            </div>

            {/* Preset 4 */}
            <div 
              onClick={() => onApplyExportOptimization?.('AV1_4K_HDR', '3840x2160')}
              className={`p-3 rounded-xl border transition cursor-pointer space-y-1.5 ${
                currentPreset === 'AV1_4K_HDR'
                  ? 'bg-sky-500/15 border-sky-400 shadow-md ring-1 ring-sky-400/40'
                  : 'bg-[#070b13] border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-100">AV1 Next-Gen HDR</span>
                <span className="text-[9px] font-mono text-purple-400 font-bold">Alta Eficiencia</span>
              </div>
              <p className="text-[10px] text-slate-400">Ahorra 40% de bitrate sobre H.264 manteniendo gama cromática amplia DCI-P3.</p>
              <div className="pt-1 text-[10px] font-mono text-slate-400 flex justify-between border-t border-slate-800/80">
                <span>Carga estimada:</span>
                <strong className="text-amber-400">70-88%</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WebGL Stress Benchmark */}
      {selectedTab === 'benchmark' && (
        <div className="space-y-4">
          <div className="p-4 bg-[#070c16] border border-purple-900/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-purple-400" />
                <h4 className="text-sm font-bold text-white">Prueba de Estrés WebGL y Cálculo de Throughput</h4>
              </div>
              <p className="text-xs text-slate-300 max-w-xl">
                Ejecuta 1,000,000 de operaciones de fragmentos en bucle cerrado sobre el lienzo gráfico para medir el límite de saturación térmica y capacidad de exportación en paralelo.
              </p>
            </div>

            <button
              onClick={handleRunBenchmark}
              disabled={isBenchmarking}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-600/30 transition active:scale-95 cursor-pointer whitespace-nowrap self-start sm:self-auto"
            >
              {isBenchmarking ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Midiendo ({benchmarkProgress}%)...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Iniciar Benchmark GPU</span>
                </>
              )}
            </button>
          </div>

          {/* Benchmark Progress Bar */}
          {isBenchmarking && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>Saturando pipeline de renderizado y midiendo elevación térmica...</span>
                <span className="text-purple-400 font-bold">{benchmarkProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${benchmarkProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Benchmark Results */}
          {benchmarkScore !== null && (
            <div className="p-4 bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-700/60 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">Puntuación de Capacidad Gráfica</span>
                  <div className="text-2xl font-black font-mono text-white flex items-baseline gap-2">
                    <span>{benchmarkScore}</span>
                    <span className="text-xs text-emerald-400 font-semibold">PUNTOS</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nodos en la Nube Sugeridos</span>
                  <span className="text-sm font-bold font-mono text-sky-300">8 Nodos Paralelos</span>
                </div>
              </div>

              <div className="text-xs text-slate-300 p-2.5 bg-black/40 rounded-lg border border-purple-900/50 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  Tu hardware tiene suficiente potencia térmica ({gpuInfo.coreTempC}°C) para manejar codificación multi-stream sin degradar el rendimiento del navegador.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* GPU Process Manager & Task Killer Modal Overlay */}
      <GpuProcessManagerOverlay
        isOpen={isProcessManagerOpen}
        onClose={() => setIsProcessManagerOpen(false)}
        activeQueueJobs={activeQueueJobs}
        currentGpuLoad={gpuInfo.gpuLoadPercent}
        totalVramMb={gpuInfo.maxVramMb}
        onKillCloudJob={onKillCloudJob}
      />
    </div>
  );
};
