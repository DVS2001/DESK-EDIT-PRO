import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  Flame, AlertTriangle, Zap, Layers, Clock, CheckCircle2, 
  Sparkles, Sliders, Play, Info, Eye, ShieldAlert, Cpu, 
  ArrowUpDown, Filter, ChevronRight
} from 'lucide-react';
import { TimelineClip } from '../types/editor';
import { INITIAL_CLIPS } from '../data/mockAssets';

export interface TimelineStressSegment {
  id: string;
  startTime: number;
  endTime: number;
  timeLabel: string;
  loadPercent: number;
  frameTimeMs: number;
  vramMb: number;
  activeLayersCount: number;
  activeClips: TimelineClip[];
  primaryBottleneck: string;
  stressFactors: string[];
  isHotspot: boolean;
}

export interface ClipStressAnalysis {
  clip: TimelineClip;
  rank: number;
  stressScore: number;
  category: 'critical' | 'heavy' | 'moderate' | 'nominal';
  peakTimeRange: string;
  layerTrack: string;
  durationSec: number;
  factors: string[];
  primaryBottleneck: string;
  renderPenaltySec: number;
  proxySavingsPercent: number;
  isProxyApplied: boolean;
  recommendedAction: string;
}

interface D3TimelineHeatmapProps {
  timelineClips?: TimelineClip[];
  timelineDuration?: number;
  currentGpuLoad?: number;
  isProxyModeActive?: boolean;
  onSelectClip?: (clipId: string) => void;
  selectedClipId?: string | null;
  onQuickOptimizeClip?: (clipId: string, actionType: string) => void;
}

export const D3TimelineHeatmap: React.FC<D3TimelineHeatmapProps> = ({
  timelineClips = INITIAL_CLIPS,
  timelineDuration = 20.0,
  currentGpuLoad = 65,
  isProxyModeActive = false,
  onSelectClip,
  selectedClipId,
  onQuickOptimizeClip,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // User filter states
  const [activeMetric, setActiveMetric] = useState<'gpuLoad' | 'frameTime' | 'vram'>('gpuLoad');
  const [segmentGranularity, setSegmentGranularity] = useState<'fine' | 'standard'>('fine'); // 0.5s vs 1.0s
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'video'>('all');
  const [hoveredSegment, setHoveredSegment] = useState<TimelineStressSegment | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<TimelineStressSegment | null>(null);
  const [optimizedClipIds, setOptimizedClipIds] = useState<Set<string>>(new Set());

  // Effective clips fallback
  const effectiveClips = useMemo(() => {
    return timelineClips && timelineClips.length > 0 ? timelineClips : INITIAL_CLIPS;
  }, [timelineClips]);

  // Max duration
  const effectiveDuration = useMemo(() => {
    if (timelineDuration && timelineDuration > 0) return timelineDuration;
    const maxEnd = Math.max(...effectiveClips.map(c => c.startTime + c.duration), 20);
    return Math.max(maxEnd, 20);
  }, [timelineDuration, effectiveClips]);

  // Calculate per-clip stress analysis
  const clipAnalyses = useMemo<ClipStressAnalysis[]>(() => {
    return effectiveClips.map((clip) => {
      let score = 0;
      const factors: string[] = [];

      // 1. Media Type & Resolution
      if (clip.type === 'video') {
        const titleLower = clip.title.toLowerCase();
        const is4k = titleLower.includes('4k') || titleLower.includes('dci') || clip.originalResolution?.includes('3840') || clip.originalResolution?.includes('4096');
        
        if (is4k) {
          score += 38;
          factors.push('Decodificación 4K DCI/UHD Alta Tasa de Bits');
        } else {
          score += 18;
          factors.push('Decodificación 1080p Full HD');
        }
      } else if (clip.type === 'text') {
        score += 14;
        factors.push('Rasterización Tipográfica & Alpha Blending');
      } else {
        score += 6;
        factors.push('Procesamiento Audio DSP');
      }

      // 2. Color Grading / LUT complexity
      if (clip.lumetri) {
        if (clip.lumetri.lutPreset && clip.lumetri.lutPreset !== 'none') {
          score += 24;
          factors.push(`3D LUT Cúbico (${clip.lumetri.lutPreset.replace('_', ' ').toUpperCase()})`);
        }
        if (Math.abs(clip.lumetri.saturation - 100) > 20 || Math.abs(clip.lumetri.contrast) > 15) {
          score += 10;
          factors.push('Mapeo Lumetri Alto Rango Dinámico');
        }
      }

      // 3. Motion, Zoom, Speed Ramping
      if (clip.velocityEnvelope && clip.velocityEnvelope.length > 1) {
        const maxVel = Math.max(...clip.velocityEnvelope.map(v => v.value));
        if (maxVel > 1.2) {
          score += 20;
          factors.push(`Speed Ramp Acelerado (${maxVel.toFixed(1)}x Interpolación de Fotogramas)`);
        }
      }

      if (clip.panCrop && (clip.panCrop.zoom > 1.02 || clip.panCrop.rotation !== 0)) {
        score += 12;
        factors.push(`Transformación Pan/Crop (Zoom ${(clip.panCrop.zoom * 100).toFixed(0)}%)`);
      }

      // 4. Overlapping & Compositing position (Track V2 or V3)
      if (clip.trackId === 'track-v2' || clip.trackId === 'track-v3') {
        score += 16;
        factors.push('Superposición Multicapa & Alpha Composing');
      }

      // 5. Proxy Reduction
      const isProxy = isProxyModeActive || clip.isProxyActive || optimizedClipIds.has(clip.id);
      let proxySavings = 0;
      if (isProxy && clip.type === 'video') {
        proxySavings = 45;
        score = Math.max(15, score * 0.55);
        factors.push('⚡ Proxy Activo (-45% Carga GPU)');
      }

      // Dynamic load scaling with real-time WebGL factor
      const loadFactor = Math.max(0.7, Math.min(1.4, (currentGpuLoad || 65) / 60));
      score = Math.round(score * loadFactor);
      score = Math.min(98, Math.max(12, score));

      // Category
      let category: 'critical' | 'heavy' | 'moderate' | 'nominal' = 'nominal';
      if (score >= 85) category = 'critical';
      else if (score >= 68) category = 'heavy';
      else if (score >= 42) category = 'moderate';

      // Primary bottleneck string
      let primaryBottleneck = 'Carga de renderizado dentro de límites estándar';
      if (factors.length > 0) {
        primaryBottleneck = factors[0];
      }

      // Render penalty estimation
      const renderPenaltySec = Number(((score / 100) * (clip.duration * 0.8)).toFixed(1));

      return {
        clip,
        rank: 0, // Assigned after sort
        stressScore: score,
        category,
        peakTimeRange: `${clip.startTime.toFixed(1)}s - ${(clip.startTime + clip.duration).toFixed(1)}s`,
        layerTrack: clip.trackId.toUpperCase(),
        durationSec: clip.duration,
        factors,
        primaryBottleneck,
        renderPenaltySec,
        proxySavingsPercent: isProxy ? 0 : 45,
        isProxyApplied: isProxy,
        recommendedAction: isProxy 
          ? 'Optimizado con Proxy'
          : clip.type === 'video' 
            ? 'Activar Proxy ProRes' 
            : 'Pre-renderizar Capa'
      };
    }).sort((a, b) => b.stressScore - a.stressScore).map((item, idx) => ({
      ...item,
      rank: idx + 1
    }));
  }, [effectiveClips, isProxyModeActive, optimizedClipIds, currentGpuLoad]);

  // Build time segments for D3 heatmap
  const segments = useMemo<TimelineStressSegment[]>(() => {
    const step = segmentGranularity === 'fine' ? 0.5 : 1.0;
    const count = Math.ceil(effectiveDuration / step);
    const segs: TimelineStressSegment[] = [];

    for (let i = 0; i < count; i++) {
      const startTime = Number((i * step).toFixed(2));
      const endTime = Number((Math.min(effectiveDuration, (i + 1) * step)).toFixed(2));

      // Find overlapping clips
      const activeClips = effectiveClips.filter(c => {
        const clipEnd = c.startTime + c.duration;
        return c.startTime < endTime && clipEnd > startTime;
      });

      const videoClips = activeClips.filter(c => c.type === 'video');
      const activeLayersCount = activeClips.length;

      // Base load
      let rawLoad = 18; // base pipeline overhead
      const stressFactors: string[] = [];

      activeClips.forEach(c => {
        const analysis = clipAnalyses.find(a => a.clip.id === c.id);
        const clipScore = analysis ? analysis.stressScore : 30;
        rawLoad += clipScore * 0.55;
      });

      // Layer compositing penalty
      if (videoClips.length > 1) {
        const layerPenalty = (videoClips.length - 1) * 16;
        rawLoad += layerPenalty;
        stressFactors.push(`Colisión de ${videoClips.length} Capas de Vídeo Simultáneas (+${layerPenalty}%)`);
      }

      // Realtime GPU modulation
      const mod = Math.sin(i * 0.4) * 4;
      let finalLoad = Math.round(rawLoad + mod);
      finalLoad = Math.min(99, Math.max(15, finalLoad));

      // Frame render time estimate (ms): 16.6ms is 60fps, 33.3ms is 30fps, 50ms is 20fps
      const frameTimeMs = Number((12 + (finalLoad / 100) * 36).toFixed(1));
      const vramMb = Math.round(480 + (finalLoad / 100) * 1420);

      // Primary bottleneck for this time slice
      let primaryBottleneck = 'Composición Nominal';
      if (videoClips.length > 1) {
        primaryBottleneck = `Composición Multicapa (${videoClips.map(v => v.title).join(' + ')})`;
      } else if (activeClips.length > 0) {
        const topAnalysis = clipAnalyses.find(a => a.clip.id === activeClips[0].id);
        if (topAnalysis && topAnalysis.factors.length > 0) {
          primaryBottleneck = `${activeClips[0].title}: ${topAnalysis.factors[0]}`;
        }
      }

      segs.push({
        id: `seg-${i}`,
        startTime,
        endTime,
        timeLabel: `${startTime.toFixed(1)}s`,
        loadPercent: finalLoad,
        frameTimeMs,
        vramMb,
        activeLayersCount,
        activeClips,
        primaryBottleneck,
        stressFactors,
        isHotspot: finalLoad >= 80,
      });
    }

    return segs;
  }, [effectiveDuration, segmentGranularity, effectiveClips, clipAnalyses]);

  // Hotspots count and peak stress
  const summaryMetrics = useMemo(() => {
    if (segments.length === 0) return { hotspots: 0, peakLoad: 0, peakTime: '0.0s', avgLoad: 0 };
    const hotspots = segments.filter(s => s.isHotspot).length;
    let peak = segments[0];
    let total = 0;
    segments.forEach(s => {
      total += s.loadPercent;
      if (s.loadPercent > peak.loadPercent) {
        peak = s;
      }
    });
    return {
      hotspots,
      peakLoad: peak.loadPercent,
      peakTime: `${peak.startTime.toFixed(1)}s - ${peak.endTime.toFixed(1)}s`,
      avgLoad: Math.round(total / segments.length),
    };
  }, [segments]);

  // Quick Optimize handler
  const handleOptimizeClip = (clipId: string) => {
    setOptimizedClipIds(prev => {
      const next = new Set(prev);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
    if (onQuickOptimizeClip) {
      onQuickOptimizeClip(clipId, 'toggle-proxy');
    }
  };

  // --------------------------------------------------------------------------
  // D3 RENDER LIFECYCLE
  // --------------------------------------------------------------------------
  useEffect(() => {
    const svgEl = svgRef.current;
    const container = containerRef.current;
    if (!svgEl || !container || segments.length === 0) return;

    // Dimensions
    const containerWidth = container.clientWidth || 800;
    const margin = { top: 32, right: 28, bottom: 42, left: 65 };
    const width = containerWidth - margin.left - margin.right;
    
    // Layout heights
    const heatmapRibbonHeight = 44;
    const trackRowHeight = 22;
    const uniqueTracks = ['track-v3', 'track-v2', 'track-v1'];
    const trackMatrixHeight = uniqueTracks.length * trackRowHeight + 14;
    const curveHeight = 80;
    const totalHeight = heatmapRibbonHeight + trackMatrixHeight + curveHeight + margin.top + margin.bottom + 40;

    // Clear previous SVG contents
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    svg
      .attr('width', containerWidth)
      .attr('height', totalHeight)
      .attr('viewBox', `0 0 ${containerWidth} ${totalHeight}`)
      .attr('style', 'overflow: visible; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;');

    // Main Canvas Group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // D3 Scales
    const xScale = d3.scaleLinear()
      .domain([0, effectiveDuration])
      .range([0, width]);

    // Color Interpolator: Custom Cyber Heatmap Ramp
    // 0% -> Cyan (#06b6d4), 40% -> Emerald/Yellow (#10b981 to #eab308), 70% -> Orange (#f97316), 85% -> Crimson (#ef4444), 95%+ -> Hot Magenta (#ec4899)
    const colorScale = d3.scaleSequential<string>()
      .domain([15, 95])
      .interpolator(d3.interpolateTurbo);

    // Filter Defs: Ambient Glow for Hotspots
    const defs = svg.append('defs');
    
    const glowFilter = defs.append('filter')
      .attr('id', 'hotspot-glow')
      .attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    glowFilter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

    // Gradient for the continuous stress area curve
    const areaGradient = defs.append('linearGradient')
      .attr('id', 'stress-area-gradient')
      .attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
    areaGradient.append('stop').attr('offset', '0%').attr('stop-color', '#ef4444').attr('stop-opacity', 0.65);
    areaGradient.append('stop').attr('offset', '50%').attr('stop-color', '#f59e0b').attr('stop-opacity', 0.35);
    areaGradient.append('stop').attr('offset', '100%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.05);

    // ------------------------------------------------------------------------
    // SECTION 1: COMPOSITE GPU HEATMAP RIBBON (Top)
    // ------------------------------------------------------------------------
    const ribbonGroup = g.append('g').attr('class', 'heatmap-ribbon');

    // Section Title
    g.append('text')
      .attr('x', -margin.left + 8)
      .attr('y', -12)
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('letter-spacing', '0.08em')
      .text('BANDA DE CALOR GPU (CARGA TOTAL)');

    // Background track
    ribbonGroup.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', width)
      .attr('height', heatmapRibbonHeight)
      .attr('fill', '#070d18')
      .attr('rx', 6)
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 1);

    // Heatmap cells
    segments.forEach((seg) => {
      const x0 = xScale(seg.startTime);
      const x1 = xScale(seg.endTime);
      const cellWidth = Math.max(1, x1 - x0 - 0.5);
      const fillColor = colorScale(seg.loadPercent);

      const cell = ribbonGroup.append('rect')
        .attr('class', `heat-cell-${seg.id}`)
        .attr('x', x0)
        .attr('y', 2)
        .attr('width', cellWidth)
        .attr('height', heatmapRibbonHeight - 4)
        .attr('fill', fillColor)
        .attr('rx', 2)
        .attr('cursor', 'pointer')
        .attr('opacity', 0.88);

      // Pulse glow on critical hotspot
      if (seg.isHotspot) {
        cell.attr('filter', 'url(#hotspot-glow)')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 0.7);
      }

      // Interaction
      cell
        .on('mouseenter', (event: MouseEvent) => {
          d3.select(event.currentTarget as SVGRectElement)
            .attr('opacity', 1.0)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 2);
          setHoveredSegment(seg);
          const [mx, my] = d3.pointer(event, container);
          setHoverPosition({ x: mx, y: my });
        })
        .on('mousemove', (event: MouseEvent) => {
          const [mx, my] = d3.pointer(event, container);
          setHoverPosition({ x: mx, y: my });
        })
        .on('mouseleave', (event: MouseEvent) => {
          d3.select(event.currentTarget as SVGRectElement)
            .attr('opacity', 0.88)
            .attr('stroke', seg.isHotspot ? '#ffffff' : null)
            .attr('stroke-width', seg.isHotspot ? 0.7 : 0);
          setHoveredSegment(null);
          setHoverPosition(null);
        })
        .on('click', () => {
          setSelectedSegment(seg);
          if (seg.activeClips.length > 0 && onSelectClip) {
            onSelectClip(seg.activeClips[0].id);
          }
        });
    });

    // Label for 85% threshold warning mark if present
    const hotspotSegments = segments.filter(s => s.isHotspot);
    if (hotspotSegments.length > 0) {
      hotspotSegments.forEach(h => {
        const hx = xScale(h.startTime + (h.endTime - h.startTime) / 2);
        ribbonGroup.append('line')
          .attr('x1', hx).attr('x2', hx)
          .attr('y1', 0).attr('y2', heatmapRibbonHeight)
          .attr('stroke', '#f43f5e')
          .attr('stroke-dasharray', '2,2')
          .attr('stroke-width', 1.5)
          .attr('pointer-events', 'none');
      });
    }

    // ------------------------------------------------------------------------
    // SECTION 2: MULTI-TRACK MATRIX (Track Layers V3, V2, V1)
    // ------------------------------------------------------------------------
    const matrixY = heatmapRibbonHeight + 28;
    const matrixGroup = g.append('g')
      .attr('class', 'track-matrix')
      .attr('transform', `translate(0, ${matrixY})`);

    // Section title
    g.append('text')
      .attr('x', -margin.left + 8)
      .attr('y', matrixY - 10)
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('letter-spacing', '0.08em')
      .text('CAPAS DE PISTA (ESTRÉS POR CLIP)');

    // Track rows
    const trackLabels: Record<string, string> = {
      'track-v3': 'V3 Texto',
      'track-v2': 'V2 B-Roll',
      'track-v1': 'V1 Master',
    };

    uniqueTracks.forEach((trackId, trackIndex) => {
      const rowY = trackIndex * trackRowHeight;

      // Track label Y-axis
      matrixGroup.append('text')
        .attr('x', -8)
        .attr('y', rowY + trackRowHeight / 2 + 3)
        .attr('text-anchor', 'end')
        .attr('fill', '#64748b')
        .attr('font-size', '9px')
        .attr('font-weight', '600')
        .text(trackLabels[trackId] || trackId);

      // Track row lane background
      matrixGroup.append('rect')
        .attr('x', 0)
        .attr('y', rowY)
        .attr('width', width)
        .attr('height', trackRowHeight - 4)
        .attr('fill', '#050a14')
        .attr('rx', 3)
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 0.5);

      // Clips on this track
      const trackClips = effectiveClips.filter(c => c.trackId === trackId);
      trackClips.forEach(clip => {
        const clipX = xScale(clip.startTime);
        const clipWidth = Math.max(8, xScale(clip.startTime + clip.duration) - clipX);
        const analysis = clipAnalyses.find(a => a.clip.id === clip.id);
        const stress = analysis ? analysis.stressScore : 40;
        const clipColor = colorScale(stress);
        const isSelected = selectedClipId === clip.id;

        const clipBar = matrixGroup.append('rect')
          .attr('x', clipX)
          .attr('y', rowY + 1)
          .attr('width', clipWidth)
          .attr('height', trackRowHeight - 6)
          .attr('rx', 3)
          .attr('fill', clipColor)
          .attr('stroke', isSelected ? '#38bdf8' : (stress >= 85 ? '#f43f5e' : '#334155'))
          .attr('stroke-width', isSelected ? 2 : 1)
          .attr('cursor', 'pointer')
          .attr('opacity', 0.9);

        if (stress >= 85) {
          clipBar.attr('filter', 'url(#hotspot-glow)');
        }

        // Clip mini text title if wide enough
        if (clipWidth > 55) {
          matrixGroup.append('text')
            .attr('x', clipX + 5)
            .attr('y', rowY + trackRowHeight / 2)
            .attr('fill', '#ffffff')
            .attr('font-size', '8.5px')
            .attr('font-weight', '750')
            .attr('pointer-events', 'none')
            .text(clip.title.length > 18 ? clip.title.slice(0, 16) + '…' : clip.title);

          // Stress badge
          if (clipWidth > 95) {
            matrixGroup.append('text')
              .attr('x', clipX + clipWidth - 5)
              .attr('y', rowY + trackRowHeight / 2)
              .attr('text-anchor', 'end')
              .attr('fill', stress >= 80 ? '#fecdd3' : '#e2e8f0')
              .attr('font-size', '8px')
              .attr('font-weight', '800')
              .attr('pointer-events', 'none')
              .text(`${stress}%`);
          }
        }

        // Hover & click
        clipBar
          .on('mouseenter', (event) => {
            clipBar.attr('stroke', '#ffffff').attr('stroke-width', 2);
            const dummySeg: TimelineStressSegment = {
              id: `clip-seg-${clip.id}`,
              startTime: clip.startTime,
              endTime: clip.startTime + clip.duration,
              timeLabel: `${clip.startTime.toFixed(1)}s`,
              loadPercent: stress,
              frameTimeMs: Number((12 + (stress / 100) * 36).toFixed(1)),
              vramMb: Math.round(500 + (stress / 100) * 1400),
              activeLayersCount: 1,
              activeClips: [clip],
              primaryBottleneck: analysis?.primaryBottleneck || 'Carga Gráfica',
              stressFactors: analysis?.factors || [],
              isHotspot: stress >= 80,
            };
            setHoveredSegment(dummySeg);
            const [mx, my] = d3.pointer(event, container);
            setHoverPosition({ x: mx, y: my });
          })
          .on('mouseleave', () => {
            clipBar.attr('stroke', isSelected ? '#38bdf8' : (stress >= 85 ? '#f43f5e' : '#334155'))
                   .attr('stroke-width', isSelected ? 2 : 1);
            setHoveredSegment(null);
            setHoverPosition(null);
          })
          .on('click', () => {
            if (onSelectClip) onSelectClip(clip.id);
          });
      });
    });

    // ------------------------------------------------------------------------
    // SECTION 3: CONTINUOUS GPU LOAD & FRAME-TIME CURVE (Bottom)
    // ------------------------------------------------------------------------
    const curveY = matrixY + trackMatrixHeight + 22;
    const curveGroup = g.append('g')
      .attr('class', 'stress-curve')
      .attr('transform', `translate(0, ${curveY})`);

    // Title
    g.append('text')
      .attr('x', -margin.left + 8)
      .attr('y', curveY - 10)
      .attr('fill', '#94a3b8')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('letter-spacing', '0.08em')
      .text('PERFIL CONTINUO DE CARGA GPU Y LATENCIA DE FRAME (ms)');

    // Y scale for curve (0% to 100%)
    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([curveHeight, 0]);

    // Grid lines
    [25, 50, 75, 85].forEach(level => {
      curveGroup.append('line')
        .attr('x1', 0).attr('x2', width)
        .attr('y1', yScale(level)).attr('y2', yScale(level))
        .attr('stroke', level === 85 ? '#ef4444' : '#1e293b')
        .attr('stroke-dasharray', level === 85 ? '4,3' : '2,2')
        .attr('stroke-width', level === 85 ? 1.2 : 0.6)
        .attr('opacity', level === 85 ? 0.9 : 0.6);

      // Y-axis label
      curveGroup.append('text')
        .attr('x', -8)
        .attr('y', yScale(level) + 3)
        .attr('text-anchor', 'end')
        .attr('fill', level === 85 ? '#f43f5e' : '#475569')
        .attr('font-size', '8px')
        .attr('font-weight', level === 85 ? '700' : '500')
        .text(level === 85 ? '85% THROTTLE' : `${level}%`);
    });

    // Area generator
    const areaGen = d3.area<TimelineStressSegment>()
      .x(d => xScale(d.startTime + (d.endTime - d.startTime) / 2))
      .y0(curveHeight)
      .y1(d => yScale(d.loadPercent))
      .curve(d3.curveMonotoneX);

    // Line generator
    const lineGen = d3.line<TimelineStressSegment>()
      .x(d => xScale(d.startTime + (d.endTime - d.startTime) / 2))
      .y(d => yScale(d.loadPercent))
      .curve(d3.curveMonotoneX);

    // Draw Area Fill
    curveGroup.append('path')
      .datum(segments)
      .attr('fill', 'url(#stress-area-gradient)')
      .attr('d', areaGen);

    // Draw Line Stroke
    curveGroup.append('path')
      .datum(segments)
      .attr('fill', 'none')
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 2)
      .attr('d', lineGen);

    // Data points & Hotspot Markers on the curve
    segments.forEach(seg => {
      const cx = xScale(seg.startTime + (seg.endTime - seg.startTime) / 2);
      const cy = yScale(seg.loadPercent);

      if (seg.isHotspot) {
        curveGroup.append('circle')
          .attr('cx', cx).attr('cy', cy)
          .attr('r', 4.5)
          .attr('fill', '#ef4444')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.5)
          .attr('filter', 'url(#hotspot-glow)');
      }
    });

    // ------------------------------------------------------------------------
    // SECTION 4: TIME AXIS (X-Axis at very bottom)
    // ------------------------------------------------------------------------
    const axisY = curveY + curveHeight;
    const axisGroup = g.append('g')
      .attr('class', 'time-axis')
      .attr('transform', `translate(0, ${axisY})`);

    const xAxis = d3.axisBottom(xScale)
      .ticks(Math.min(10, Math.floor(width / 70)))
      .tickFormat(d => {
        const sec = Number(d);
        const mins = Math.floor(sec / 60);
        const secs = Math.floor(sec % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}s`;
      });

    axisGroup.call(xAxis);

    // Style X Axis ticks and lines
    axisGroup.select('.domain')
      .attr('stroke', '#334155')
      .attr('stroke-width', 1);

    axisGroup.selectAll('.tick line')
      .attr('stroke', '#334155')
      .attr('y2', 6);

    axisGroup.selectAll('.tick text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '9px')
      .attr('font-weight', '600')
      .attr('dy', '1em');

  }, [segments, effectiveClips, clipAnalyses, effectiveDuration, selectedClipId]);

  // Filter clips for ranking list
  const filteredClips = useMemo(() => {
    if (filterSeverity === 'critical') return clipAnalyses.filter(c => c.stressScore >= 80);
    if (filterSeverity === 'video') return clipAnalyses.filter(c => c.clip.type === 'video');
    return clipAnalyses;
  }, [clipAnalyses, filterSeverity]);

  return (
    <div className="space-y-4">
      {/* Heatmap Control Toolbar & KPI Header */}
      <div className="p-4 bg-[#070d18] border border-slate-800 rounded-xl space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Mapa de Calor GPU por Segmentos de Línea de Tiempo
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  D3.js WebGL Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Distribución espacial de la carga de renderizado en micro-segmentos de tiempo ({effectiveDuration.toFixed(1)}s total)
              </p>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-2.5 py-1.5 rounded-lg bg-[#040812] border border-slate-800 text-[11px] font-mono">
              <span className="text-slate-500 block text-[9px] uppercase font-bold">Pico Máximo</span>
              <span className={`font-bold ${summaryMetrics.peakLoad >= 85 ? 'text-red-400' : 'text-amber-300'}`}>
                {summaryMetrics.peakLoad}% ({summaryMetrics.peakTime})
              </span>
            </div>

            <div className="px-2.5 py-1.5 rounded-lg bg-[#040812] border border-slate-800 text-[11px] font-mono">
              <span className="text-slate-500 block text-[9px] uppercase font-bold">Zonas Críticas (&gt;80%)</span>
              <span className="font-bold text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-400" />
                {summaryMetrics.hotspots} {summaryMetrics.hotspots === 1 ? 'punto caliente' : 'puntos calientes'}
              </span>
            </div>

            <div className="px-2.5 py-1.5 rounded-lg bg-[#040812] border border-slate-800 text-[11px] font-mono">
              <span className="text-slate-500 block text-[9px] uppercase font-bold">Estrés Promedio</span>
              <span className="font-bold text-sky-300">{summaryMetrics.avgLoad}%</span>
            </div>
          </div>
        </div>

        {/* Granularity & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium text-[11px] flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              Granularidad:
            </span>
            <div className="flex bg-[#040812] p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setSegmentGranularity('fine')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                  segmentGranularity === 'fine'
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Fina (0.5s)
              </button>
              <button
                onClick={() => setSegmentGranularity('standard')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                  segmentGranularity === 'standard'
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Estándar (1.0s)
              </button>
            </div>
          </div>

          {/* D3 Heatmap Color Scale Legend */}
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
            <span>Escala:</span>
            <div className="flex items-center gap-1">
              <span className="text-cyan-400 font-bold">&lt;35% Ligero</span>
              <div className="w-24 h-2.5 rounded-full bg-gradient-to-r from-[#06b6d4] via-[#10b981] via-[#f59e0b] to-[#ef4444] border border-slate-700/60 shadow-inner" />
              <span className="text-red-400 font-bold">&gt;85% Crítico</span>
            </div>
          </div>
        </div>
      </div>

      {/* D3.js SVG Interactive Visualization Container */}
      <div 
        ref={containerRef}
        className="relative bg-[#040812] border border-slate-800 rounded-xl p-4 overflow-x-auto shadow-2xl min-h-[340px]"
      >
        <svg ref={svgRef} className="w-full select-none" />

        {/* Interactive Floating Hover Tooltip (Positioned dynamically) */}
        {hoveredSegment && hoverPosition && (
          <div 
            className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full -mt-3 min-w-[260px] max-w-[320px] bg-[#070d18]/95 border border-slate-700 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs font-mono space-y-2 transition-all duration-75"
            style={{
              left: `${Math.max(140, Math.min((containerRef.current?.clientWidth || 800) - 140, hoverPosition.x))}px`,
              top: `${Math.max(40, hoverPosition.y)}px`,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold text-white">
                  {hoveredSegment.startTime.toFixed(1)}s – {hoveredSegment.endTime.toFixed(1)}s
                </span>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                hoveredSegment.loadPercent >= 85 
                  ? 'bg-red-500/20 text-red-300 border border-red-500/50 animate-pulse'
                  : hoveredSegment.loadPercent >= 68
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}>
                {hoveredSegment.loadPercent >= 85 ? '🚨 Estrés Crítico' : hoveredSegment.loadPercent >= 68 ? '⚠️ Carga Alta' : '✅ Estable'}
              </span>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[9px]">CARGA GPU:</span>
                <span className={`text-base font-black ${hoveredSegment.loadPercent >= 85 ? 'text-red-400' : 'text-amber-400'}`}>
                  {hoveredSegment.loadPercent}%
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px]">TIEMPO POR FRAME:</span>
                <span className="text-base font-black text-sky-400">
                  {hoveredSegment.frameTimeMs} ms
                </span>
              </div>
            </div>

            {/* Active Clips in Segment */}
            {hoveredSegment.activeClips.length > 0 && (
              <div className="border-t border-slate-800/80 pt-1.5 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                  <Layers className="w-3 h-3 text-slate-400" />
                  Clips Activos ({hoveredSegment.activeClips.length}):
                </span>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {hoveredSegment.activeClips.map(clip => (
                    <div key={clip.id} className="p-1 rounded bg-[#03060d] text-[10px] text-slate-200 flex items-center justify-between">
                      <span className="truncate max-w-[170px]">{clip.title}</span>
                      <span className="text-amber-400 font-bold ml-1">{clip.trackId.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Primary Bottleneck cause */}
            <div className="border-t border-slate-800/80 pt-1 text-[10px] text-slate-300 flex items-start gap-1">
              <span className="text-amber-400 font-bold">Causa:</span>
              <span className="text-slate-300 leading-tight">{hoveredSegment.primaryBottleneck}</span>
            </div>
          </div>
        )}
      </div>

      {/* CLIPS CAUSING HIGHEST RENDER STRESS (Ranking & Optimization Inspector) */}
      <div className="bg-[#070d18] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Ranking de Clips con Mayor Estrés de Renderizado</span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Identificación de cuellos de botella por clips: 4K raw, etalonaje 3D LUT, reasignación de velocidad y sobrecarga compositiva
            </p>
          </div>

          {/* Filter clips severity */}
          <div className="flex items-center gap-1.5 bg-[#03060e] p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFilterSeverity('all')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                filterSeverity === 'all'
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos ({clipAnalyses.length})
            </button>
            <button
              onClick={() => setFilterSeverity('critical')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                filterSeverity === 'critical'
                  ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              Críticos ({clipAnalyses.filter(c => c.stressScore >= 80).length})
            </button>
            <button
              onClick={() => setFilterSeverity('video')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                filterSeverity === 'video'
                  ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Vídeo ({clipAnalyses.filter(c => c.clip.type === 'video').length})
            </button>
          </div>
        </div>

        {/* Clip Stress Ranking Grid */}
        <div className="space-y-2.5">
          {filteredClips.map((item) => {
            const isSelected = selectedClipId === item.clip.id;
            const isProxy = item.isProxyApplied;

            return (
              <div
                key={item.clip.id}
                onClick={() => onSelectClip && onSelectClip(item.clip.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 border-sky-400 shadow-lg shadow-sky-500/10'
                    : item.stressScore >= 85
                      ? 'bg-gradient-to-r from-red-950/30 via-[#0e1424] to-[#0a101d] border-red-900/60 hover:border-red-700'
                      : 'bg-[#091122]/70 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  {/* Left: Rank, Title, Track and Factors */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs flex-shrink-0 ${
                      item.rank === 1
                        ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                        : item.rank === 2
                          ? 'bg-orange-500 text-white'
                          : item.rank === 3
                            ? 'bg-amber-500 text-slate-900 font-black'
                            : 'bg-slate-800 text-slate-300'
                    }`}>
                      #{item.rank}
                    </div>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-xs truncate max-w-[280px]">
                          {item.clip.title}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {item.layerTrack}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          ⏱ {item.peakTimeRange} ({item.durationSec.toFixed(1)}s)
                        </span>

                        {isProxy && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 font-bold">
                            <Zap className="w-2.5 h-2.5 text-emerald-400" />
                            Proxy Activo
                          </span>
                        )}
                      </div>

                      {/* Stress Breakdown Badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.factors.map((factor, fIdx) => (
                          <span 
                            key={fIdx}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                              factor.includes('4K')
                                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                : factor.includes('LUT')
                                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                  : factor.includes('Speed') || factor.includes('Ramp')
                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                    : factor.includes('Proxy')
                                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-slate-800/90 text-slate-300'
                            }`}
                          >
                            {factor}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: Stress Index Bar & Quick Optimize Action */}
                  <div className="flex items-center gap-4 flex-shrink-0 self-end lg:self-center">
                    {/* Visual Meter Bar */}
                    <div className="w-32 sm:w-40 text-right space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-400 text-[9px]">ÍNDICE DE ESTRÉS:</span>
                        <span className={`font-black ${
                          item.stressScore >= 85 
                            ? 'text-red-400' 
                            : item.stressScore >= 68 
                              ? 'text-amber-400' 
                              : 'text-emerald-400'
                        }`}>
                          {item.stressScore}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.stressScore >= 85 
                              ? 'bg-gradient-to-r from-orange-500 to-red-500' 
                              : item.stressScore >= 68 
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500' 
                                : 'bg-gradient-to-r from-teal-500 to-emerald-500'
                          }`}
                          style={{ width: `${item.stressScore}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 block">
                        Impacto estimado: +{item.renderPenaltySec}s en cola
                      </span>
                    </div>

                    {/* Quick Optimize Action Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOptimizeClip(item.clip.id);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                        isProxy
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                          : item.stressScore >= 80
                            ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 shadow-sm'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      }`}
                      title={isProxy ? 'Revertir a resolución nativa 4K' : 'Generar y usar proxy ProRes para reducir la carga de GPU'}
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>{isProxy ? 'Quitar Proxy' : item.recommendedAction}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Optimization Summary Notice */}
        <div className="p-3 bg-[#03060d] rounded-lg border border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Info className="w-4 h-4 text-sky-400 flex-shrink-0" />
            <span>
              La activación de proxies reduce la carga de procesamiento de shaders en hasta un <strong className="text-emerald-400">45%</strong> por fotograma, eliminando el riesgo de estrangulamiento térmico a más de 85°C.
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Motor D3 v7 & WebGL Activos</span>
          </div>
        </div>
      </div>
    </div>
  );
};
