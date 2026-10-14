import React, { useRef, useState, useMemo, useEffect } from 'react';
import { 
  Scissors, MousePointer, MoveHorizontal, Edit3, Type, Hand, 
  Volume2, VolumeX, Eye, EyeOff, Lock, Unlock, Plus, ZoomIn, 
  ZoomOut, MessageSquare, Sparkles, Sliders, Activity, Palette, Film, Sun, Zap, Trash2, ArrowLeftRight, Mic, Music, Magnet, Gauge,
  Video, Layers, CheckCircle2, SplitSquareVertical
} from 'lucide-react';
import { 
  TimelineClip, TimelineTrack, TimelineMarker, ToolType, 
  Collaborator, TimelineComment, EnvelopeKeyframe, AppliedTransition, MediaAsset,
  MagnetSnapFeedback
} from '../types/editor';
import { secondsToTimecode } from '../utils/timecode';

interface TimelineProps {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  markers: TimelineMarker[];
  collaborators: Collaborator[];
  comments: TimelineComment[];
  currentTime: number;
  duration: number;
  selectedClipId: string | null;
  selectedClipIds?: string[];
  activeTool: ToolType;
  onSelectClip: (clipId: string | null) => void;
  onSelectMultipleClips?: (clipIds: string[]) => void;
  onTimeUpdate: (time: number) => void;
  onSetActiveTool: (tool: ToolType) => void;
  onUpdateClips: (clips: TimelineClip[]) => void;
  onSplitClipAtPlayhead?: () => void;
  isProxyModeActive?: boolean;
  onToggleProxyMode?: (active: boolean) => void;
  onOpenAudioCleanup?: (clipId?: string) => void;
  onOpenColorMatch?: (clipId?: string) => void;
  onOpenSceneSplitter?: () => void;
  appliedTransitions?: AppliedTransition[];
  onOpenTransitionSuggest?: (cutTime?: number, clipAId?: string, clipBId?: string) => void;
  isRippleEditMode?: boolean;
  onToggleRippleEditMode?: (active: boolean) => void;
  onDeleteClip?: (clipId: string, forceRipple?: boolean) => void;
  onResizeClip?: (clipId: string, edge: 'left' | 'right', deltaSeconds: number, forceRipple?: boolean) => void;
  onCloseGap?: (trackId?: string) => void;
  onOpenVoiceoverStudio?: () => void;
  onOpenBeatAlignment?: (clipId?: string) => void;
  onSnapVideoCutsToBeats?: (beatTimes: number[]) => void;
  onDropMediaAsset?: (asset: MediaAsset, trackId: string, dropTime: number) => void;
  snapToNeighbors?: boolean;
  onToggleSnapToNeighbors?: (active: boolean) => void;
  onOpenMultiCamSync?: (clipIds?: string[]) => void;
  onOpenSmartProxyManager?: (clipId?: string) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  tracks,
  clips,
  markers,
  collaborators,
  comments,
  currentTime,
  duration,
  selectedClipId,
  activeTool,
  onSelectClip,
  onTimeUpdate,
  onSetActiveTool,
  onUpdateClips,
  onSplitClipAtPlayhead,
  isProxyModeActive = true,
  onToggleProxyMode,
  onOpenAudioCleanup,
  onOpenColorMatch,
  onOpenSceneSplitter,
  appliedTransitions = [],
  onOpenTransitionSuggest,
  isRippleEditMode = true,
  onToggleRippleEditMode,
  onDeleteClip,
  onResizeClip,
  onCloseGap,
  onOpenVoiceoverStudio,
  onOpenBeatAlignment,
  onSnapVideoCutsToBeats,
  onDropMediaAsset,
  snapToNeighbors: initialSnapToNeighbors = true,
  onToggleSnapToNeighbors,
  selectedClipIds = [],
  onSelectMultipleClips,
  onOpenMultiCamSync,
  onOpenSmartProxyManager,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(36); // pixels per second
  const [showEnvelopes, setShowEnvelopes] = useState<boolean>(true);
  const [isSnapping, setIsSnapping] = useState<boolean>(true);
  const [snapToNeighbors, setSnapToNeighbors] = useState<boolean>(initialSnapToNeighbors ?? true);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
  const [snappedGuide, setSnappedGuide] = useState<MagnetSnapFeedback | null>(null);

  // Multi-clip selection state (for Multi-Cam sync and batch editing)
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>(
    selectedClipIds && selectedClipIds.length > 0 ? selectedClipIds : (selectedClipId ? [selectedClipId] : [])
  );

  // Sync external selectedClipIds
  useEffect(() => {
    if (selectedClipIds && selectedClipIds.length > 0) {
      setMultiSelectedIds(selectedClipIds);
    }
  }, [selectedClipIds]);

  // Selected video clips helper for Multi-Cam sync
  const selectedVideoClips = useMemo(() => {
    return clips.filter(
      (c) => c.type === 'video' && (multiSelectedIds.includes(c.id) || selectedClipId === c.id)
    );
  }, [clips, multiSelectedIds, selectedClipId]);

  // Sync external snapToNeighbors prop changes
  useEffect(() => {
    if (initialSnapToNeighbors !== undefined) {
      setSnapToNeighbors(initialSnapToNeighbors);
    }
  }, [initialSnapToNeighbors]);

  // Audio Context for subtle tactile snap feedback
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastSnapSoundTimeRef = useRef<number>(0);
  const playSnapHapticSound = () => {
    try {
      const now = Date.now();
      if (now - lastSnapSoundTimeRef.current < 90) return;
      lastSnapSoundTimeRef.current = now;
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        const osc = audioCtxRef.current.createOscillator();
        const gain = audioCtxRef.current.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(920, audioCtxRef.current.currentTime);
        osc.frequency.exponentialRampToValueAtTime(460, audioCtxRef.current.currentTime + 0.035);
        gain.gain.setValueAtTime(0.04, audioCtxRef.current.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtxRef.current.currentTime + 0.035);
        osc.connect(gain);
        gain.connect(audioCtxRef.current.destination);
        osc.start();
        osc.stop(audioCtxRef.current.currentTime + 0.04);
      }
    } catch {
      // Audio feedback is purely non-blocking enhancement
    }
  };

  /**
   * Unified Magnet-Snapping Engine
   * Calculates magnetic pull towards:
   * 1. Playhead position (currentTime)
   * 2. Adjacent neighbor clips on same track (preceding end / succeeding start for 0-gap flush cuts)
   * 3. Neighbor clips across all other tracks (multi-track alignment)
   * 4. Beat markers & scene cuts
   */
  const calculateMagnetSnap = (
    candidateTime: number,
    ignoreClipId?: string,
    clipDuration?: number, // when dragging whole clip, test both head & tail edges
    currentTrackId?: string
  ): {
    snappedTime: number;
    feedback: MagnetSnapFeedback | null;
  } => {
    if (!isSnapping) {
      return { snappedTime: candidateTime, feedback: null };
    }

    const snapTolerance = 16 / zoomLevel; // ~16px tolerance
    let bestSnappedTime = candidateTime;
    let bestDiff = snapTolerance;
    let bestFeedback: MagnetSnapFeedback | null = null;

    const testTarget = (
      targetTime: number,
      label: string,
      type: 'neighbor' | 'playhead' | 'beat' | 'scenecut' | 'marker',
      targetClipId?: string
    ) => {
      // 1. Test clip head (candidateTime)
      const diffStart = Math.abs(targetTime - candidateTime);
      if (diffStart < bestDiff) {
        bestDiff = diffStart;
        bestSnappedTime = targetTime;
        bestFeedback = {
          time: targetTime,
          label,
          type,
          edge: 'start',
          targetClipId,
          distanceDiffSeconds: diffStart,
        };
      }

      // 2. If clipDuration is provided (moving whole clip), also test clip tail
      if (clipDuration !== undefined) {
        const candidateEnd = candidateTime + clipDuration;
        const diffEnd = Math.abs(targetTime - candidateEnd);
        if (diffEnd < bestDiff) {
          bestDiff = diffEnd;
          bestSnappedTime = Math.max(0, targetTime - clipDuration);
          bestFeedback = {
            time: targetTime,
            label,
            type,
            edge: 'end',
            targetClipId,
            distanceDiffSeconds: diffEnd,
          };
        }
      }
    };

    // Target 1: Playhead Position (currentTime)
    testTarget(currentTime, `Snap al Playhead (${secondsToTimecode(currentTime)})`, 'playhead');

    // Target 2: Neighbor Clips (when Snap to Neighbors is active)
    if (snapToNeighbors) {
      // Same-track neighbor clips (Prioritized for zero-gap flush editing)
      const sameTrackClips = clips
        .filter((c) => c.id !== ignoreClipId && (!currentTrackId || c.trackId === currentTrackId))
        .sort((a, b) => a.startTime - b.startTime);

      for (const neighbor of sameTrackClips) {
        testTarget(
          neighbor.startTime,
          `Snap a Vecino: "${neighbor.title}" (Inicio)`,
          'neighbor',
          neighbor.id
        );
        testTarget(
          neighbor.startTime + neighbor.duration,
          `Snap a Vecino: "${neighbor.title}" (Fin)`,
          'neighbor',
          neighbor.id
        );
      }

      // Other tracks clips (cross-track cut alignment)
      const otherTrackClips = clips.filter(
        (c) => c.id !== ignoreClipId && currentTrackId && c.trackId !== currentTrackId
      );
      for (const neighbor of otherTrackClips) {
        testTarget(
          neighbor.startTime,
          `Snap a Pista ${neighbor.trackId.toUpperCase()}: "${neighbor.title}"`,
          'neighbor',
          neighbor.id
        );
        testTarget(
          neighbor.startTime + neighbor.duration,
          `Snap a Pista ${neighbor.trackId.toUpperCase()}: "${neighbor.title}"`,
          'neighbor',
          neighbor.id
        );
      }
    }

    // Target 3: Musical Beat markers and Scene cuts
    for (const m of markers) {
      if (m.type === 'beat') {
        testTarget(m.time, `Snap al Beat: ${m.label}`, 'beat');
      } else if (m.type === 'scene_cut') {
        testTarget(m.time, `Snap a Corte: ${m.label}`, 'scenecut');
      } else {
        testTarget(m.time, `Snap a Marcador: ${m.label}`, 'marker');
      }
    }

    return { snappedTime: bestSnappedTime, feedback: bestFeedback };
  };

  // Drag and drop from Media Library onto tracks with Magnet Snapping
  const [dragOverTrackId, setDragOverTrackId] = useState<string | null>(null);
  const [dragOverTime, setDragOverTime] = useState<number | null>(null);

  const handleTrackDragOver = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverTrackId(trackId);

    const trackElement = e.currentTarget as HTMLDivElement;
    const rect = trackElement.getBoundingClientRect();
    const scrollContainer = timelineRef.current;
    const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
    const offsetX = e.clientX - rect.left + scrollLeft;
    const rawTime = Math.max(0, offsetX / zoomLevel);

    const { snappedTime, feedback } = calculateMagnetSnap(rawTime, undefined, 6.0, trackId);
    if (feedback) {
      setSnappedGuide(feedback);
      playSnapHapticSound();
    } else {
      setSnappedGuide(null);
    }
    setDragOverTime(snappedTime);
  };

  const handleTrackDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverTrackId(null);
      setDragOverTime(null);
      setSnappedGuide(null);
    }
  };

  const handleTrackDrop = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();
    const finalTrackId = dragOverTrackId || trackId;
    const finalTime = dragOverTime !== null ? dragOverTime : currentTime;
    setDragOverTrackId(null);
    setDragOverTime(null);
    setSnappedGuide(null);

    try {
      const rawData = e.dataTransfer.getData('application/json');
      if (rawData) {
        const asset: MediaAsset = JSON.parse(rawData);
        if (onDropMediaAsset) {
          onDropMediaAsset(asset, finalTrackId, finalTime);
        }
      }
    } catch (err) {
      console.warn('Error processing timeline drop:', err);
    }
  };

  // Interactive trimming state for Ripple Edit & normal trim
  const [trimmingState, setTrimmingState] = useState<{
    clipId: string;
    edge: 'left' | 'right';
    startX: number;
    initialDuration: number;
    initialStartTime: number;
    currentDelta: number;
  } | null>(null);

  // Window listeners for mouse drag trim with Magnet Snapping
  useEffect(() => {
    if (!trimmingState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - trimmingState.startX;
      let deltaSec = deltaX / zoomLevel;

      if (isSnapping) {
        const currentClip = clips.find((c) => c.id === trimmingState.clipId);
        const currentTrackId = currentClip?.trackId;

        const rawTargetTime =
          trimmingState.edge === 'right'
            ? trimmingState.initialStartTime + trimmingState.initialDuration + deltaSec
            : trimmingState.initialStartTime + deltaSec;

        const { snappedTime, feedback } = calculateMagnetSnap(
          rawTargetTime,
          trimmingState.clipId,
          undefined,
          currentTrackId
        );

        if (feedback) {
          if (trimmingState.edge === 'right') {
            deltaSec = snappedTime - (trimmingState.initialStartTime + trimmingState.initialDuration);
          } else {
            deltaSec = snappedTime - trimmingState.initialStartTime;
          }
          setSnappedGuide(feedback);
          playSnapHapticSound();
        } else {
          setSnappedGuide(null);
        }
      }

      setTrimmingState((prev) => (prev ? { ...prev, currentDelta: deltaSec } : null));
    };

    const handleMouseUp = () => {
      if (trimmingState && Math.abs(trimmingState.currentDelta) >= 0.04) {
        onResizeClip?.(
          trimmingState.clipId,
          trimmingState.edge,
          trimmingState.currentDelta,
          isRippleEditMode
        );
      }
      setTrimmingState(null);
      setSnappedGuide(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [trimmingState, zoomLevel, onResizeClip, isRippleEditMode, isSnapping, snapToNeighbors, markers, clips, currentTime]);

  // Interactive clip dragging / moving state (horizontal repositioning & track moves)
  const [clipDraggingState, setClipDraggingState] = useState<{
    clipId: string;
    startX: number;
    startY: number;
    initialStartTime: number;
    initialTrackId: string;
    currentStartTime: number;
    targetTrackId: string;
    hasMoved: boolean;
  } | null>(null);

  // Window listeners for mouse drag clip repositioning with Magnet Snapping
  useEffect(() => {
    if (!clipDraggingState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - clipDraggingState.startX;
      const deltaY = Math.abs(e.clientY - clipDraggingState.startY);

      if (Math.abs(deltaX) > 3 || deltaY > 3) {
        const targetClip = clips.find((c) => c.id === clipDraggingState.clipId);
        if (!targetClip) return;

        const deltaSec = deltaX / zoomLevel;
        const rawStartTime = Math.max(0, clipDraggingState.initialStartTime + deltaSec);

        // Detect track lane under mouse cursor
        let targetTrackId = clipDraggingState.initialTrackId;
        if (timelineRef.current) {
          const trackElements = timelineRef.current.querySelectorAll('[data-track-id]');
          for (const el of Array.from(trackElements)) {
            const rect = el.getBoundingClientRect();
            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
              const tid = el.getAttribute('data-track-id');
              if (tid) {
                const tr = tracks.find((t) => t.id === tid);
                // Check track compatibility
                if (tr) {
                  const isAudioClip = targetClip.type === 'audio';
                  const isVideoClip = targetClip.type === 'video';
                  if ((isAudioClip && tr.type === 'audio') || (isVideoClip && tr.type === 'video') || targetClip.type === 'text') {
                    targetTrackId = tid;
                  }
                }
              }
              break;
            }
          }
        }

        const { snappedTime, feedback } = calculateMagnetSnap(
          rawStartTime,
          clipDraggingState.clipId,
          targetClip.duration,
          targetTrackId
        );

        if (feedback) {
          setSnappedGuide(feedback);
          playSnapHapticSound();
        } else {
          setSnappedGuide(null);
        }

        setClipDraggingState((prev) =>
          prev
            ? {
                ...prev,
                hasMoved: true,
                currentStartTime: snappedTime,
                targetTrackId,
              }
            : null
        );
      }
    };

    const handleMouseUp = () => {
      if (clipDraggingState && clipDraggingState.hasMoved) {
        const diffTime = Math.abs(clipDraggingState.currentStartTime - clipDraggingState.initialStartTime);
        const changedTrack = clipDraggingState.targetTrackId !== clipDraggingState.initialTrackId;

        if (diffTime >= 0.03 || changedTrack) {
          const updatedClips = clips.map((c) => {
            if (c.id === clipDraggingState.clipId) {
              return {
                ...c,
                startTime: Number(clipDraggingState.currentStartTime.toFixed(3)),
                trackId: clipDraggingState.targetTrackId,
              };
            }
            return c;
          });
          onUpdateClips(updatedClips);
        }
      }

      setClipDraggingState(null);
      setSnappedGuide(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [clipDraggingState, zoomLevel, isSnapping, snapToNeighbors, clips, markers, tracks, onUpdateClips, currentTime]);

  // Window listeners for Playhead scrubbing / dragging
  useEffect(() => {
    if (!draggingPlayhead) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const scrollLeft = timelineRef.current.scrollLeft;
      const rawTime = Math.max(0, Math.min(duration, (e.clientX - rect.left + scrollLeft) / zoomLevel));

      let targetTime = rawTime;
      if (isSnapping) {
        const snapTolerance = 14 / zoomLevel;
        let minDiff = snapTolerance;
        let lockedTarget: number | null = null;
        let feedbackLabel = '';

        // Check clip boundaries
        for (const c of clips) {
          const diffStart = Math.abs(c.startTime - rawTime);
          if (diffStart < minDiff) {
            minDiff = diffStart;
            lockedTarget = c.startTime;
            feedbackLabel = `Snap a "${c.title}" (Inicio)`;
          }
          const diffEnd = Math.abs((c.startTime + c.duration) - rawTime);
          if (diffEnd < minDiff) {
            minDiff = diffEnd;
            lockedTarget = c.startTime + c.duration;
            feedbackLabel = `Snap a "${c.title}" (Fin)`;
          }
        }

        // Check markers
        for (const m of markers) {
          const diffM = Math.abs(m.time - rawTime);
          if (diffM < minDiff) {
            minDiff = diffM;
            lockedTarget = m.time;
            feedbackLabel = `Snap a ${m.label}`;
          }
        }

        if (lockedTarget !== null) {
          targetTime = lockedTarget;
          setSnappedGuide({
            time: lockedTarget,
            label: feedbackLabel,
            type: 'playhead',
            edge: 'start',
            distanceDiffSeconds: minDiff,
          });
          playSnapHapticSound();
        } else {
          setSnappedGuide(null);
        }
      }

      onTimeUpdate(Number(targetTime.toFixed(3)));
    };

    const handleMouseUp = () => {
      setDraggingPlayhead(false);
      setSnappedGuide(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingPlayhead, zoomLevel, duration, isSnapping, clips, markers, onTimeUpdate]);

  // Keyboard shortcuts (Delete, Backspace, 'B' / 'R' for Ripple Edit toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipId && onDeleteClip) {
          e.preventDefault();
          const forceRipple = e.shiftKey ? true : isRippleEditMode;
          onDeleteClip(selectedClipId, forceRipple);
        }
      } else if (e.key === 'b' || e.key === 'B' || e.key === 'r' || e.key === 'R') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          const next = !isRippleEditMode;
          onToggleRippleEditMode?.(next);
          if (next) onSetActiveTool('ripple');
          else if (activeTool === 'ripple') onSetActiveTool('select');
        }
      } else if (e.key === 'v' || e.key === 'V') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          onSetActiveTool('select');
        }
      } else if (e.key === 's' || e.key === 'S') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setIsSnapping((prev) => !prev);
        }
      } else if (e.key === 'n' || e.key === 'N') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setSnapToNeighbors((prev) => {
            const next = !prev;
            onToggleSnapToNeighbors?.(next);
            return next;
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, isRippleEditMode, onDeleteClip, onToggleRippleEditMode, onSetActiveTool, activeTool, onToggleSnapToNeighbors]);

  const handleClipMouseDown = (e: React.MouseEvent, clip: TimelineClip) => {
    // Only handle primary left button
    if (e.button !== 0) return;
    if (activeTool === 'razor') {
      handleClipClick(e, clip);
      return;
    }

    // Support Shift+Click or Ctrl/Cmd+Click for multi-clip selection (crucial for Multi-Cam sync!)
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      setMultiSelectedIds((prev) => {
        const next = prev.includes(clip.id)
          ? prev.filter((id) => id !== clip.id)
          : [...prev, clip.id];
        onSelectMultipleClips?.(next);
        return next;
      });
      onSelectClip(clip.id);
      return;
    }

    // Standard single selection
    onSelectClip(clip.id);
    setMultiSelectedIds([clip.id]);
    onSelectMultipleClips?.([clip.id]);

    setClipDraggingState({
      clipId: clip.id,
      startX: e.clientX,
      startY: e.clientY,
      initialStartTime: clip.startTime,
      initialTrackId: clip.trackId,
      currentStartTime: clip.startTime,
      targetTrackId: clip.trackId,
      hasMoved: false,
    });
  };

  const handleTrimStart = (e: React.MouseEvent, clip: TimelineClip, edge: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    onSelectClip(clip.id);
    setTrimmingState({
      clipId: clip.id,
      edge,
      startX: e.clientX,
      initialDuration: clip.duration,
      initialStartTime: clip.startTime,
      currentDelta: 0,
    });
  };

  // Ruler tick marks calculation
  const totalWidth = Math.max(1200, (duration + 10) * zoomLevel);

  const rulerTicks = useMemo(() => {
    const ticks: { time: number; isMajor: boolean }[] = [];
    const step = zoomLevel > 40 ? 1 : zoomLevel > 20 ? 2 : 5;
    for (let t = 0; t <= duration + 8; t += step) {
      ticks.push({ time: t, isMajor: t % (step * 2) === 0 });
    }
    return ticks;
  }, [duration, zoomLevel]);

  // Handle timeline ruler mousedown to scrub playhead with magnet snapping
  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDraggingPlayhead(true);
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.scrollLeft;
    const clickX = e.clientX - rect.left + scrollLeft;
    const rawTime = Math.max(0, Math.min(duration, clickX / zoomLevel));

    let targetTime = rawTime;
    if (isSnapping) {
      const snapTolerance = 14 / zoomLevel;
      let minDiff = snapTolerance;
      let lockedTarget: number | null = null;
      let feedbackLabel = '';

      for (const c of clips) {
        const diffStart = Math.abs(c.startTime - rawTime);
        if (diffStart < minDiff) {
          minDiff = diffStart;
          lockedTarget = c.startTime;
          feedbackLabel = `Snap a "${c.title}" (Inicio)`;
        }
        const diffEnd = Math.abs((c.startTime + c.duration) - rawTime);
        if (diffEnd < minDiff) {
          minDiff = diffEnd;
          lockedTarget = c.startTime + c.duration;
          feedbackLabel = `Snap a "${c.title}" (Fin)`;
        }
      }
      for (const m of markers) {
        const diffM = Math.abs(m.time - rawTime);
        if (diffM < minDiff) {
          minDiff = diffM;
          lockedTarget = m.time;
          feedbackLabel = `Snap a ${m.label}`;
        }
      }
      if (lockedTarget !== null) {
        targetTime = lockedTarget;
        setSnappedGuide({
          time: lockedTarget,
          label: feedbackLabel,
          type: 'playhead',
          edge: 'start',
          distanceDiffSeconds: minDiff,
        });
        playSnapHapticSound();
      }
    }

    onTimeUpdate(Number(targetTime.toFixed(3)));
  };

  // Handle timeline ruler / body click to set playhead
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.scrollLeft;
    const clickX = e.clientX - rect.left + scrollLeft;
    const time = Math.max(0, Math.min(duration, clickX / zoomLevel));
    onTimeUpdate(Number(time.toFixed(3)));
  };

  // Click on clip with Razor Blade tool (C) -> Slice clip in two!
  const handleClipClick = (e: React.MouseEvent, clip: TimelineClip) => {
    e.stopPropagation();

    if (activeTool === 'razor') {
      // Split clip at click position
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const clickOffsetSec = (e.clientX - rect.left) / zoomLevel;
      const splitTime = clip.startTime + clickOffsetSec;

      if (splitTime > clip.startTime + 0.3 && splitTime < clip.startTime + clip.duration - 0.3) {
        const firstDuration = splitTime - clip.startTime;
        const secondDuration = clip.duration - firstDuration;

        const firstClip: TimelineClip = {
          ...clip,
          duration: firstDuration,
        };

        const secondClip: TimelineClip = {
          ...clip,
          id: `clip-split-${Date.now()}`,
          startTime: splitTime,
          duration: secondDuration,
          offsetTime: clip.offsetTime + firstDuration,
        };

        const updated = clips.flatMap((c) => (c.id === clip.id ? [firstClip, secondClip] : [c]));
        onUpdateClips(updated);
        onSelectClip(secondClip.id);
        return;
      }
    }

    onSelectClip(clip.id);
  };

  // Add keyframe to Vegas Velocity or Opacity Envelope
  const handleAddEnvelopeKeyframe = (e: React.MouseEvent, clip: TimelineClip, envelopeType: 'velocity' | 'opacity' | 'volume') => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickOffsetSec = Math.max(0, Math.min(clip.duration, (e.clientX - rect.left) / zoomLevel));
    const clickRelativeY = (e.clientY - rect.top) / rect.height; // 0 (top) to 1 (bottom)

    let newValue = envelopeType === 'velocity' ? (2 - clickRelativeY * 1.5) : (1 - clickRelativeY) * 100;
    newValue = Math.max(0.1, Number(newValue.toFixed(2)));

    const newKeyframe: EnvelopeKeyframe = {
      id: `kf-${Date.now()}`,
      timeOffset: Number(clickOffsetSec.toFixed(2)),
      value: newValue,
    };

    const updatedClips = clips.map((c) => {
      if (c.id !== clip.id) return c;
      if (envelopeType === 'velocity') {
        const curve = [...(c.velocityEnvelope || []), newKeyframe].sort((a, b) => a.timeOffset - b.timeOffset);
        return { ...c, velocityEnvelope: curve };
      }
      if (envelopeType === 'opacity') {
        const curve = [...(c.opacityEnvelope || []), newKeyframe].sort((a, b) => a.timeOffset - b.timeOffset);
        return { ...c, opacityEnvelope: curve };
      }
      const curve = [...(c.volumeEnvelope || []), newKeyframe].sort((a, b) => a.timeOffset - b.timeOffset);
      return { ...c, volumeEnvelope: curve };
    });

    onUpdateClips(updatedClips);
  };

  return (
    <div className="h-[280px] sm:h-[320px] bg-[#0a0e17] border-t border-[#1b2434] flex flex-col select-none relative">
      {/* Timeline Controls & Tools Toolbar */}
      <div className="h-10 px-3 bg-[#0d1320] border-b border-[#1b2434] flex items-center justify-between">
        {/* NLE Editing Tools (Premiere Pro style) */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSetActiveTool('select')}
            title="Selection Tool (V)"
            className={`p-1.5 rounded transition ${activeTool === 'select' ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onSetActiveTool('razor')}
            title="Razor Tool - Slice Clips (C)"
            className={`p-1.5 rounded transition ${activeTool === 'razor' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Scissors className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onSetActiveTool('envelope')}
            title="Vegas Envelope Tool - Add/Edit Bézier Keyframes (E)"
            className={`p-1.5 rounded transition ${activeTool === 'envelope' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              onSetActiveTool('ripple');
              onToggleRippleEditMode?.(true);
            }}
            title="Ripple Edit Tool (B / R)"
            className={`p-1.5 rounded transition ${activeTool === 'ripple' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <MoveHorizontal className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onSetActiveTool('text')}
            title="Type / Caption Tool (T)"
            className={`p-1.5 rounded transition ${activeTool === 'text' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40' : 'text-slate-400 hover:bg-slate-800'}`}
          >
            <Type className="w-3.5 h-3.5" />
          </button>

          {/* AI Voiceover Studio Tool */}
          <button
            onClick={() => onOpenVoiceoverStudio?.()}
            title="AI Voiceover Studio: Generar locuciones con IA directamente a la pista A1"
            className="flex items-center gap-1 p-1.5 rounded transition text-emerald-400 hover:bg-emerald-950/50 hover:text-emerald-300"
          >
            <Mic className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Ripple Edit Mode Toggle Button */}
          <button
            onClick={() => {
              const next = !isRippleEditMode;
              onToggleRippleEditMode?.(next);
              if (next) onSetActiveTool('ripple');
              else if (activeTool === 'ripple') onSetActiveTool('select');
            }}
            title="Ripple Edit Mode Toggle (B / R): Automatically shift subsequent clips across all tracks when deleting or resizing clips to maintain sync"
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer border ${
              isRippleEditMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 hover:bg-amber-500/30 shadow-sm shadow-amber-500/20 ring-1 ring-amber-400/50'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isRippleEditMode ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="font-bold">Ripple Edit</span>
            <span className={`text-[9px] font-mono px-1 rounded uppercase font-bold ${
              isRippleEditMode ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40' : 'bg-slate-900 text-slate-500'
            }`}>
              {isRippleEditMode ? 'ON • SYNC' : 'OFF'}
            </span>
          </button>

          {/* Delete Clip (Ripple Delete if active or Shift pressed) */}
          <button
            onClick={() => {
              if (selectedClipId && onDeleteClip) {
                onDeleteClip(selectedClipId, isRippleEditMode);
              }
            }}
            disabled={!selectedClipId}
            title={
              !selectedClipId
                ? 'Selecciona un clip para eliminar'
                : isRippleEditMode
                ? `Ripple Delete (Delete): Elimina el clip y desplaza automáticamente todas las pistas para cerrar el hueco`
                : `Eliminar Clip (Delete): Elimina el clip dejando el hueco intacto`
            }
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition border ${
              selectedClipId
                ? isRippleEditMode
                  ? 'bg-amber-950/70 text-amber-300 border-amber-600/50 hover:bg-amber-900/80 cursor-pointer shadow-sm'
                  : 'bg-rose-950/60 text-rose-300 border-rose-700/50 hover:bg-rose-900/70 cursor-pointer'
                : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
            }`}
          >
            <Trash2 className="w-3 h-3 text-rose-400" />
            <span className="hidden sm:inline">{isRippleEditMode ? 'Ripple Del' : 'Delete'}</span>
          </button>

          {/* Quick Trim Buttons when clip is selected */}
          {selectedClipId && (
            <div className="hidden lg:flex items-center gap-1 bg-slate-900/90 border border-slate-700/60 rounded px-1.5 py-0.5">
              <span className="text-[10px] text-slate-400 font-mono">Trim Out:</span>
              <button
                onClick={() => onResizeClip?.(selectedClipId, 'right', -0.5, isRippleEditMode)}
                className="px-1.5 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono text-[9px] border border-slate-700 cursor-pointer"
                title={`Recortar -0.5s ${isRippleEditMode ? '(desplaza todas las pistas con Ripple Sync)' : ''}`}
              >
                -0.5s
              </button>
              <button
                onClick={() => onResizeClip?.(selectedClipId, 'right', 0.5, isRippleEditMode)}
                className="px-1.5 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 font-mono text-[9px] border border-slate-700 cursor-pointer"
                title={`Alargar +0.5s ${isRippleEditMode ? '(desplaza todas las pistas con Ripple Sync)' : ''}`}
              >
                +0.5s
              </button>
            </div>
          )}

          {/* Quick Action: Split at Current Playhead */}
          <button
            onClick={() => {
              if (onSplitClipAtPlayhead) onSplitClipAtPlayhead();
            }}
            title="Split Clip at Playhead (Ctrl+K / Cmd+K)"
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            <Scissors className="w-3 h-3 text-sky-400" />
            <span>Split (Ctrl+K)</span>
          </button>

          {/* Vegas Envelopes Toggle */}
          <button
            onClick={() => setShowEnvelopes(!showEnvelopes)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition ${
              showEnvelopes ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-700/60' : 'bg-slate-800 text-slate-400'
            }`}
            title="Show Vegas Pro Velocity, Opacity & Volume Envelopes"
          >
            <Activity className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">Vegas Envelopes</span>
          </button>

          {/* Proxy Generation Mode Timeline Status & Quick Toggle */}
          <button
            onClick={() => onToggleProxyMode?.(!isProxyModeActive)}
            title={isProxyModeActive ? 'Modo Proxy 720p Activo: Clic para alternar a RAW 4K' : 'Modo RAW 4K: Clic para activar Proxies 720p para reproducción fluida'}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer border ${
              isProxyModeActive
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isProxyModeActive ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="hidden sm:inline font-mono font-bold">{isProxyModeActive ? 'Proxy 720p (60fps)' : 'RAW 4K'}</span>
            <span className="sm:hidden font-mono font-bold">{isProxyModeActive ? '720p' : '4K'}</span>
          </button>

          {/* AI Audio Cleanup & De-Hum Button */}
          <button
            onClick={() => onOpenAudioCleanup?.(selectedClipId || undefined)}
            title="AI Audio Cleanup: Detección y eliminación de zumbido (50/60Hz) y ruido de fondo"
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer border ${
              clips.some((c) => c.audioCleanup?.isEnabled)
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-600/60 hover:bg-emerald-900/80 shadow-sm shadow-emerald-950/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span className="font-semibold">Audio Cleanup</span>
            <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-mono px-1 rounded border border-emerald-500/30">
              {clips.filter((c) => c.audioCleanup?.isEnabled).length > 0
                ? `${clips.filter((c) => c.audioCleanup?.isEnabled).length} Clean`
                : 'AI'}
            </span>
          </button>

          {/* AI Color Match Button */}
          <button
            onClick={() => onOpenColorMatch?.(selectedClipId || undefined)}
            title="AI Color Match: Analiza una imagen o clip de referencia y empareja el grado de color (Gemini)"
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer border ${
              clips.some((c) => c.colorMatchInfo?.isMatched)
                ? 'bg-amber-950/70 text-amber-300 border-amber-600/60 hover:bg-amber-900/80 shadow-sm shadow-amber-950/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Palette className="w-3 h-3 text-amber-400" />
            <span className="font-semibold">AI Color Match</span>
            <span className="bg-amber-500/20 text-amber-300 text-[9px] font-mono px-1 rounded border border-amber-500/30">
              {clips.filter((c) => c.colorMatchInfo?.isMatched).length > 0
                ? `${clips.filter((c) => c.colorMatchInfo?.isMatched).length} Matched`
                : 'Gemini'}
            </span>
          </button>

          {/* AI Auto-Scene Splitter Button */}
          <button
            onClick={() => onOpenSceneSplitter?.()}
            title="Auto-Scene Splitter: Detecta cambios ópticos de tomas con Gemini y coloca marcadores de corte en el timeline"
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer border ${
              markers.some((m) => m.type === 'scene_cut')
                ? 'bg-sky-950/70 text-sky-300 border-sky-500/60 hover:bg-sky-900/80 shadow-sm shadow-sky-950/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Film className="w-3 h-3 text-sky-400" />
            <span className="font-semibold">Auto-Scene Splitter</span>
            <span className="bg-sky-500/20 text-sky-300 text-[9px] font-mono px-1 rounded border border-sky-500/30">
              {markers.filter((m) => m.type === 'scene_cut').length > 0
                ? `${markers.filter((m) => m.type === 'scene_cut').length} Cortes`
                : 'Gemini'}
            </span>
          </button>

          {/* AI Transition Suggest Button */}
          <button
            onClick={() => onOpenTransitionSuggest?.()}
            title="AI Transition Suggest: Analiza la similitud óptica de clips adyacentes y recomienda Light Leak, Zoom Blur o Cross Dissolve (Gemini)"
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer border ${
              appliedTransitions.length > 0
                ? 'bg-amber-950/70 text-amber-300 border-amber-500/60 hover:bg-amber-900/80 shadow-sm shadow-amber-950/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span className="font-semibold">AI Transitions</span>
            <span className="bg-amber-500/20 text-amber-300 text-[9px] font-mono px-1 rounded border border-amber-500/30">
              {appliedTransitions.length > 0
                ? `${appliedTransitions.length} FX`
                : 'Gemini'}
            </span>
          </button>

          {/* AI Beat Alignment Button */}
          <button
            onClick={() => onOpenBeatAlignment?.(selectedClipId || undefined)}
            title="AI Beat Alignment: Analiza envolvente de transitorios de audio y coloca marcadores rítmicos para alinear cortes de vídeo al ritmo (Gemini)"
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer border ${
              markers.some((m) => m.type === 'beat')
                ? 'bg-pink-950/70 text-pink-300 border-pink-500/60 hover:bg-pink-900/80 shadow-sm shadow-pink-950/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Music className="w-3 h-3 text-pink-400" />
            <span className="font-semibold">AI Beat Alignment</span>
            <span className="bg-pink-500/20 text-pink-300 text-[9px] font-mono px-1 rounded border border-pink-500/30">
              {markers.filter((m) => m.type === 'beat').length > 0
                ? `${markers.filter((m) => m.type === 'beat').length} Beats`
                : 'Gemini'}
            </span>
          </button>

          {/* Quick Snap Video Cuts to Beats Action */}
          {markers.some((m) => m.type === 'beat') && (
            <button
              onClick={() => {
                const beatTimes = markers.filter((m) => m.type === 'beat').map((m) => m.time);
                onSnapVideoCutsToBeats?.(beatTimes);
              }}
              title="Alinear automáticamente todos los cortes de vídeo del timeline a los beats más cercanos"
              className="hidden xl:flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-gradient-to-r from-pink-950/90 to-rose-950/90 hover:from-pink-900 hover:to-rose-900 text-pink-200 border border-pink-500/50 transition cursor-pointer shadow-sm"
            >
              <Magnet className="w-3 h-3 text-pink-400" />
              <span>Snap Cuts al Beat</span>
            </button>
          )}

          {/* AI Multi-Cam Waveform Sync Button */}
          <button
            onClick={() => onOpenMultiCamSync?.(selectedVideoClips.map((c) => c.id))}
            title="Multi-Cam Sync: Analiza formas de onda de audio de múltiples clips de vídeo seleccionados y los alinea automáticamente a lo largo de un punto temporal común"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer border ${
              selectedVideoClips.length >= 2
                ? 'bg-gradient-to-r from-indigo-950/90 via-sky-950/90 to-indigo-950/90 text-indigo-200 border-indigo-400/80 hover:from-indigo-900 hover:to-sky-900 shadow-md shadow-indigo-500/25 ring-1 ring-indigo-400/40 font-bold'
                : clips.some((c) => c.multiCam?.isSynced)
                ? 'bg-indigo-950/70 text-indigo-300 border-indigo-500/60 hover:bg-indigo-900/80 shadow-sm shadow-indigo-950/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Video className={`w-3 h-3 ${selectedVideoClips.length >= 2 ? 'text-indigo-400 animate-pulse' : 'text-indigo-400'}`} />
            <span className="font-semibold">Multi-Cam Sync</span>
            <span className={`text-[9px] font-mono px-1 rounded border font-bold ${
              selectedVideoClips.length >= 2
                ? 'bg-indigo-500/30 text-indigo-200 border-indigo-400/50'
                : clips.filter((c) => c.multiCam?.isSynced).length > 0
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}>
              {selectedVideoClips.length >= 2
                ? `${selectedVideoClips.length} Cams (Sync)`
                : clips.filter((c) => c.multiCam?.isSynced).length > 0
                ? `${clips.filter((c) => c.multiCam?.isSynced).length} Synced`
                : 'Waveform'}
            </span>
          </button>

          {/* Smart Proxy Manager Button */}
          <button
            onClick={() => onOpenSmartProxyManager?.(selectedClipId || undefined)}
            title="Smart Proxy Manager: Escanea metraje 4K de la línea de tiempo y codifica proxies ligeros de 720p en hilos de trabajo en segundo plano"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer border ${
              clips.some((c) => c.type === 'video' && !c.hasProxy)
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/60 hover:bg-amber-900/80 shadow-sm shadow-amber-500/20'
                : isProxyModeActive
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/60 hover:bg-emerald-900/80 shadow-sm shadow-emerald-950/30'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Zap className={`w-3 h-3 ${clips.some((c) => c.type === 'video' && !c.hasProxy) ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`} />
            <span className="font-semibold">Smart Proxy</span>
            <span className={`text-[9px] font-mono px-1 rounded border font-bold ${
              clips.some((c) => c.type === 'video' && !c.hasProxy)
                ? 'bg-amber-500/30 text-amber-200 border-amber-400/50 animate-pulse'
                : isProxyModeActive
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}>
              {clips.filter((c) => c.type === 'video' && !c.hasProxy).length > 0
                ? `${clips.filter((c) => c.type === 'video' && !c.hasProxy).length} Sin Proxy`
                : isProxyModeActive
                ? '720p 60FPS'
                : '4K RAW'}
            </span>
          </button>
        </div>

        {/* Timeline Zoom & Magnet Snapping Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 px-2 py-0.5 rounded">
            <ZoomOut className="w-3 h-3 text-slate-400" />
            <input
              type="range"
              min="15"
              max="80"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(parseInt(e.target.value, 10))}
              className="w-14 sm:w-20 accent-sky-500 h-1 bg-slate-700 rounded cursor-pointer"
            />
            <ZoomIn className="w-3 h-3 text-slate-400" />
            <span className="font-mono text-[10px] text-slate-400 w-7 text-right">{zoomLevel}px</span>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          {/* Master Magnetic Snap Toggle (S) */}
          <button
            onClick={() => setIsSnapping(!isSnapping)}
            title="Snap Maestro (S): Activa o desactiva la adherencia magnética general"
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition cursor-pointer ${
              isSnapping 
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm shadow-sky-500/20 font-semibold' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Magnet className={`w-3 h-3 ${isSnapping ? 'text-sky-400' : 'text-slate-500'}`} />
            <span>Snap (S)</span>
          </button>

          {/* Global 'Snap to Neighbors' Toggle (N) */}
          <button
            onClick={() => {
              const next = !snapToNeighbors;
              setSnapToNeighbors(next);
              onToggleSnapToNeighbors?.(next);
            }}
            title="Snap to Neighbors (N): Alinea magnéticamente los bordes de los clips al ras con clips adyacentes y el Playhead con cero huecos (Flush Cuts)"
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border transition cursor-pointer ${
              snapToNeighbors && isSnapping
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/25 ring-1 ring-emerald-400/40 font-semibold'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${snapToNeighbors && isSnapping ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
            <Magnet className={`w-3 h-3 ${snapToNeighbors && isSnapping ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="hidden md:inline">Snap to Neighbors</span>
            <span className="md:hidden">Neighbors</span>
            <span className={`text-[9px] font-mono px-1 rounded uppercase font-bold ${
              snapToNeighbors && isSnapping ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40' : 'bg-slate-900 text-slate-500'
            }`}>
              {snapToNeighbors && isSnapping ? 'FLUSH' : 'OFF'}
            </span>
          </button>
        </div>
      </div>

      {/* Ripple Edit Mode Active Status Bar */}
      {isRippleEditMode && (
        <div className="bg-gradient-to-r from-amber-950/80 via-[#191408] to-amber-950/80 border-b border-amber-500/40 px-3 py-1 flex items-center justify-between text-[11px] text-amber-200 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="font-bold text-amber-300 flex items-center gap-1">
              <MoveHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>RIPPLE EDIT SYNC MODE ACTIVO:</span>
            </span>
            <span className="text-amber-200/90 text-[10px] sm:text-[11px]">
              Al eliminar o redimensionar clips, todos los clips posteriores en <strong>todas las pistas</strong> se desplazan automáticamente para mantener sincronía perfecta.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onCloseGap?.()}
              title="Cerrar todos los huecos en blanco entre clips en las pistas"
              className="text-[10px] font-semibold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/30 px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
            >
              <ArrowLeftRight className="w-2.5 h-2.5" />
              <span>Cerrar Huecos</span>
            </button>
            <button
              onClick={() => onToggleRippleEditMode?.(false)}
              className="text-[10px] font-bold text-amber-400 hover:text-white bg-amber-500/20 hover:bg-amber-500/40 px-2 py-0.5 rounded transition cursor-pointer"
            >
              Desactivar
            </button>
          </div>
        </div>
      )}

      {/* Main Timeline Workspace: Left Track Headers + Right Track Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Track Headers (Premiere / Vegas style) */}
        <div className="w-48 sm:w-56 bg-[#0a0e16] border-r border-[#1b2434] flex flex-col z-20 flex-shrink-0 shadow-lg">
          {/* Track Header Title Row */}
          <div className="h-6 px-3 bg-[#0c121e] border-b border-[#1b2434] text-[10px] font-mono text-slate-400 flex items-center justify-between">
            <span>TRACKS &amp; FX BUS</span>
            <span className="text-slate-600">6 TRACKS</span>
          </div>

          {/* Individual Track Controls */}
          <div className="flex-1 overflow-hidden divide-y divide-[#161f30]">
            {tracks.map((track) => (
              <div 
                key={track.id}
                style={{ height: `${track.height}px` }}
                className="px-2 flex items-center justify-between bg-[#0b0f19] hover:bg-[#0f1524] transition text-xs"
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className={`w-2 h-2 rounded-full ${
                    track.type === 'video' ? 'bg-sky-500' : track.type === 'text' ? 'bg-pink-500' : 'bg-emerald-500'
                  }`} />
                  <span className="font-semibold text-slate-300 text-[11px] truncate" title={track.name}>
                    {track.name}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* AI Voiceover Studio shortcut on audio tracks */}
                  {track.type === 'audio' && onOpenVoiceoverStudio && (
                    <button
                      onClick={onOpenVoiceoverStudio}
                      title="Generar Voiceover IA directamente en esta pista (A1)"
                      className="p-1 rounded text-[10px] text-emerald-400 hover:bg-emerald-950/60 hover:text-emerald-300 transition"
                    >
                      <Mic className="w-3 h-3" />
                    </button>
                  )}

                  {/* Mute Track */}
                  <button 
                    onClick={() => { track.isMuted = !track.isMuted; }}
                    title="Mute Track"
                    className={`p-1 rounded text-[10px] ${track.isMuted ? 'bg-rose-500/30 text-rose-300' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <VolumeX className="w-3 h-3" />
                  </button>

                  {/* Solo Track */}
                  <button 
                    onClick={() => { track.isSolo = !track.isSolo; }}
                    title="Solo Track"
                    className={`px-1 py-0.5 rounded text-[9px] font-bold ${track.isSolo ? 'bg-amber-500/30 text-amber-300' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    S
                  </button>

                  {/* Lock Track */}
                  <button 
                    onClick={() => { track.isLocked = !track.isLocked; }}
                    title="Lock Track"
                    className={`p-1 rounded text-[10px] ${track.isLocked ? 'bg-amber-500/30 text-amber-300' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {track.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Scrollable Timeline Body */}
        <div 
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="flex-1 overflow-x-auto overflow-y-hidden relative bg-[#070b12] cursor-crosshair select-none"
        >
          {/* Scrollable Container with Total Width */}
          <div style={{ width: `${totalWidth}px` }} className="relative h-full flex flex-col">
            {/* Top Timecode Ruler with scrubbing and magnet snapping */}
            <div 
              onMouseDown={handleRulerMouseDown}
              className="h-6 bg-[#0c121e] border-b border-[#1b2434] relative cursor-pointer"
            >
              {rulerTicks.map((tick) => (
                <div
                  key={tick.time}
                  style={{ left: `${tick.time * zoomLevel}px` }}
                  className="absolute top-0 bottom-0 pointer-events-none flex flex-col justify-end"
                >
                  <span className={`h-2.5 w-px ${tick.isMajor ? 'bg-slate-400 h-3' : 'bg-slate-700'}`} />
                  {tick.isMajor && (
                    <span className="text-[9px] font-mono text-slate-400 absolute -top-0.5 left-1 whitespace-nowrap">
                      {secondsToTimecode(tick.time)}
                    </span>
                  )}
                </div>
              ))}

              {/* Markers & Comments Flags on Ruler */}
              {markers.map((marker) => {
                const isSceneCut = marker.type === 'scene_cut';
                const isBeat = marker.type === 'beat';

                return (
                  <div
                    key={marker.id}
                    style={{ left: `${marker.time * zoomLevel}px` }}
                    className="absolute top-0 bottom-0 z-30 pointer-events-none flex items-center"
                  >
                    {isBeat ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onTimeUpdate(marker.time);
                        }}
                        style={{ borderColor: marker.color }}
                        className="px-1.5 py-0.5 -ml-2.5 rounded text-[8px] font-mono font-bold bg-[#070b14] border shadow-lg flex items-center gap-1 cursor-pointer pointer-events-auto hover:scale-110 hover:bg-[#0c1424] transition group z-40"
                        title={`🎵 ${marker.label} - ${secondsToTimecode(marker.time)} (${marker.transientEnergy || 85}% energía)`}
                      >
                        <Music className="w-2.5 h-2.5 text-pink-400" />
                        <span className="font-semibold text-white text-[8px]" style={{ color: marker.color }}>
                          {marker.isDownbeat ? 'DOWNBEAT' : 'BEAT'}
                        </span>
                      </div>
                    ) : isSceneCut ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onTimeUpdate(marker.time);
                        }}
                        style={{ borderColor: marker.color }}
                        className="px-1.5 py-0.5 -ml-3 rounded text-[8px] font-mono font-bold bg-[#070b14] border shadow-lg flex items-center gap-1 cursor-pointer pointer-events-auto hover:scale-110 hover:bg-[#0c1424] transition group z-40"
                        title={`🎬 ${marker.label} - ${secondsToTimecode(marker.time)} (${marker.confidence || 95}% confianza)`}
                      >
                        <Scissors className="w-2.5 h-2.5 text-rose-400" />
                        <span className="font-semibold text-white text-[8px]" style={{ color: marker.color }}>
                          {marker.cutType ? marker.cutType.replace('_', ' ') : 'CORTE'}
                        </span>
                      </div>
                    ) : (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          onTimeUpdate(marker.time);
                        }}
                        style={{ backgroundColor: marker.color }}
                        className="w-2.5 h-2.5 rotate-45 -ml-1.5 shadow-md border border-black/60 flex items-center justify-center cursor-pointer pointer-events-auto hover:scale-125 transition"
                        title={`${marker.label} (${secondsToTimecode(marker.time)})`}
                      />
                    )}
                  </div>
                );
              })}

              {comments.map((comment) => (
                <div
                  key={comment.id}
                  style={{ left: `${comment.time * zoomLevel}px` }}
                  className="absolute top-0 bottom-0 z-30 pointer-events-none flex items-center"
                >
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      onTimeUpdate(comment.time);
                    }}
                    className="w-3 h-3 bg-amber-400 rounded-full -ml-1.5 border border-black flex items-center justify-center cursor-pointer pointer-events-auto shadow-md hover:scale-125 transition"
                    title={`Comment: ${comment.author} - "${comment.text}"`}
                  >
                    <MessageSquare className="w-2 h-2 text-black" />
                  </div>
                </div>
              ))}
            </div>

            {/* Track Lanes with Timeline Clips */}
            <div className="flex-1 divide-y divide-[#141d2d] relative timeline-grid">
              {/* Scene Cut Vertical Marker Hairline Guides */}
              {markers
                .filter((m) => m.type === 'scene_cut')
                .map((marker) => (
                  <div
                    key={`sc-guide-${marker.id}`}
                    style={{
                      left: `${marker.time * zoomLevel}px`,
                      borderColor: marker.color || '#38bdf8',
                    }}
                    className="absolute top-0 bottom-0 w-px border-l border-dashed pointer-events-none z-10 opacity-60"
                  />
                ))}

              {/* Beat Vertical Marker Hairline Guides for Rhythm Snapping */}
              {markers
                .filter((m) => m.type === 'beat')
                .map((marker) => (
                  <div
                    key={`bt-guide-${marker.id}`}
                    style={{
                      left: `${marker.time * zoomLevel}px`,
                      borderColor: marker.color || '#ec4899',
                    }}
                    className={`absolute top-0 bottom-0 w-px border-l pointer-events-none z-10 ${
                      marker.isDownbeat
                        ? 'border-dashed opacity-75 ring-1 ring-rose-500/30'
                        : 'border-dotted opacity-35'
                    }`}
                  />
                ))}

              {/* Dynamic Magnet-Snapping Guide Line & HUD across entire Timeline */}
              {snappedGuide !== null && (
                <div
                  style={{ left: `${snappedGuide.time * zoomLevel}px` }}
                  className={`absolute top-0 bottom-0 w-0.5 z-40 pointer-events-none ${
                    snappedGuide.type === 'neighbor'
                      ? 'bg-gradient-to-b from-emerald-400 via-teal-300 to-sky-400 shadow-[0_0_14px_rgba(52,211,153,1)]'
                      : snappedGuide.type === 'playhead'
                      ? 'bg-gradient-to-b from-sky-400 via-cyan-300 to-blue-500 shadow-[0_0_14px_rgba(56,189,248,1)]'
                      : 'bg-gradient-to-b from-pink-400 via-rose-400 to-amber-400 shadow-[0_0_14px_rgba(244,63,94,1)]'
                  }`}
                >
                  {/* Floating Snapping HUD Tag */}
                  <div className={`absolute top-1 left-1.5 px-2 py-0.5 rounded text-[9px] font-mono font-bold whitespace-nowrap shadow-2xl flex items-center gap-1.5 border z-50 animate-bounce ${
                    snappedGuide.type === 'neighbor'
                      ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200'
                      : snappedGuide.type === 'playhead'
                      ? 'bg-sky-950/95 border-sky-400 text-sky-200'
                      : 'bg-pink-950/95 border-pink-400 text-pink-200'
                  }`}>
                    <Magnet className={`w-3 h-3 ${
                      snappedGuide.type === 'neighbor' ? 'text-emerald-400' : snappedGuide.type === 'playhead' ? 'text-sky-400' : 'text-pink-400'
                    }`} />
                    <span className="font-extrabold uppercase">{snappedGuide.label}</span>
                    <span className="opacity-80 text-[8px] bg-black/40 px-1 py-0.2 rounded font-mono">
                      {secondsToTimecode(snappedGuide.time)}
                    </span>
                    {snappedGuide.type === 'neighbor' && (
                      <span className="text-[7px] bg-emerald-500/30 text-emerald-200 px-1 py-0.2 rounded font-bold uppercase">
                        FLUSH
                      </span>
                    )}
                  </div>
                </div>
              )}
              {tracks.map((track) => {
                const isDragOverTargetTrack = clipDraggingState && clipDraggingState.targetTrackId === track.id && clipDraggingState.targetTrackId !== clipDraggingState.initialTrackId;
                const trackClips = clips.filter((c) => {
                  if (clipDraggingState && clipDraggingState.clipId === c.id) {
                    return clipDraggingState.targetTrackId === track.id;
                  }
                  return c.trackId === track.id;
                });

                return (
                  <div
                    key={track.id}
                    data-track-id={track.id}
                    style={{ height: `${track.height}px` }}
                    onDragOver={(e) => handleTrackDragOver(e, track.id)}
                    onDragLeave={handleTrackDragLeave}
                    onDrop={(e) => handleTrackDrop(e, track.id)}
                    className={`relative transition-all duration-150 ${
                      dragOverTrackId === track.id
                        ? 'bg-sky-950/40 ring-2 ring-sky-400 ring-inset z-20 shadow-inner'
                        : isDragOverTargetTrack
                        ? 'bg-sky-950/20 ring-1 ring-sky-400/50 ring-inset'
                        : 'bg-transparent'
                    }`}
                  >
                    {/* Visual Drop Insertion Guide Line */}
                    {dragOverTrackId === track.id && dragOverTime !== null && (
                      <div
                        style={{ left: `${dragOverTime * zoomLevel}px` }}
                        className="absolute top-0 bottom-0 w-0.5 bg-sky-400 z-30 pointer-events-none shadow-[0_0_8px_rgba(56,189,248,1)] animate-pulse"
                      >
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-sky-900 text-sky-200 border border-sky-400 text-[8px] font-mono px-1 rounded whitespace-nowrap shadow font-bold">
                          {secondsToTimecode(dragOverTime)}
                        </div>
                      </div>
                    )}
                    {trackClips.map((clip) => {
                      const isSelected = selectedClipId === clip.id || multiSelectedIds.includes(clip.id);
                      const isTrimmingThis = trimmingState?.clipId === clip.id;
                      const isDraggingThis = clipDraggingState?.clipId === clip.id;
                      const isSnappedTarget = snappedGuide?.targetClipId === clip.id;

                      let clipStartTime = clip.startTime;
                      let clipDuration = clip.duration;

                      if (isTrimmingThis && trimmingState) {
                        if (trimmingState.edge === 'right') {
                          clipDuration = Math.max(0.3, trimmingState.initialDuration + trimmingState.currentDelta);
                        } else if (trimmingState.edge === 'left') {
                          clipStartTime = Math.max(0, trimmingState.initialStartTime + trimmingState.currentDelta);
                          clipDuration = Math.max(0.3, trimmingState.initialDuration - trimmingState.currentDelta);
                        }
                      } else if (isDraggingThis && clipDraggingState) {
                        clipStartTime = clipDraggingState.currentStartTime;
                      }

                      const clipLeft = clipStartTime * zoomLevel;
                      const clipWidth = clipDuration * zoomLevel;

                      return (
                        <div
                          key={clip.id}
                          onClick={(e) => handleClipClick(e, clip)}
                          onMouseDown={(e) => handleClipMouseDown(e, clip)}
                          style={{
                            left: `${clipLeft}px`,
                            width: `${clipWidth}px`,
                          }}
                          className={`absolute top-1 bottom-1 rounded-md overflow-hidden cursor-pointer transition-shadow shadow-sm flex flex-col justify-between border ${
                            isSnappedTarget
                              ? 'ring-2 ring-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)] border-emerald-300 z-25'
                              : isDraggingThis
                              ? 'ring-2 ring-sky-400 border-white shadow-2xl z-30 opacity-95 scale-[1.01] cursor-grabbing'
                              : isSelected 
                              ? 'ring-2 ring-sky-400 border-white shadow-lg z-20' 
                              : clip.multiCam?.isSynced
                              ? 'border-indigo-500/80 hover:border-indigo-400 ring-1 ring-indigo-500/50 z-10'
                              : 'border-slate-700/60 hover:border-slate-500 z-10'
                          } ${
                            clip.type === 'video'
                              ? 'bg-gradient-to-r from-sky-900/90 to-blue-900/90 text-sky-100'
                              : clip.type === 'text'
                              ? 'bg-gradient-to-r from-pink-900/90 to-rose-900/90 text-pink-100'
                              : 'bg-gradient-to-r from-emerald-950/90 to-teal-900/90 text-emerald-100'
                          }`}
                        >
                          {/* Active Drag Moving HUD Ghost with Magnet Snapping Feedback */}
                          {isDraggingThis && (
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-sky-950/95 border border-sky-400 text-sky-200 px-2 py-0.5 rounded text-[9px] font-mono font-bold shadow-2xl whitespace-nowrap z-50 flex items-center gap-1.5 pointer-events-none">
                              <MoveHorizontal className="w-2.5 h-2.5 text-sky-400" />
                              <span>{secondsToTimecode(clipStartTime)}</span>
                              {snappedGuide ? (
                                <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-400/60 px-1 py-0.2 rounded text-[8px] flex items-center gap-1 font-extrabold uppercase">
                                  <Magnet className="w-2 h-2 text-emerald-300" />
                                  <span>{snappedGuide.label}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[8px]">({clip.duration.toFixed(1)}s)</span>
                              )}
                            </div>
                          )}

                          {/* Clip Header Label */}
                          <div className="px-2 py-0.5 flex items-center justify-between text-[10px] font-semibold bg-black/40 border-b border-black/20">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="truncate">{clip.title}</span>
                              {clip.type === 'video' && (
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenSmartProxyManager?.(clip.id);
                                  }}
                                  className={`text-[8px] font-mono px-1 py-0.2 rounded font-bold flex items-center gap-0.5 transition cursor-pointer z-20 ${
                                    clip.hasProxy
                                      ? (isProxyModeActive
                                        ? 'bg-amber-950/90 text-amber-300 border border-amber-600/70 hover:bg-amber-900 shadow-sm'
                                        : 'bg-slate-900/90 text-slate-400 border border-slate-700/70 hover:bg-slate-800')
                                      : 'bg-rose-950/90 text-rose-300 border border-rose-500/70 hover:bg-rose-900 shadow-sm shadow-rose-500/25 animate-pulse'
                                  }`}
                                  title={clip.hasProxy ? 'Proxy 720p Vinculado. Clic para abrir Smart Proxy Manager.' : 'Metraje 4K sin proxy. Clic para generar proxy con Worker Thread.'}
                                >
                                  {clip.hasProxy ? (isProxyModeActive ? '⚡ 720p PROXY' : '4K RAW') : '⚠️ SIN PROXY'}
                                </button>
                              )}
                              {clip.activeMotionPreset && (
                                <span className="bg-purple-950/90 text-purple-300 border border-purple-700/70 text-[8px] font-mono px-1 py-0.2 rounded flex items-center gap-0.5 font-bold">
                                  <Sparkles className="w-2 h-2 text-purple-400" />
                                  <span>{clip.activeMotionPreset.split(' ')[0]}</span>
                                </span>
                              )}

                              {/* Multi-Cam Synced Camera Badge */}
                              {clip.multiCam?.isSynced && (
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenMultiCamSync?.();
                                  }}
                                  className="bg-indigo-950/95 text-indigo-300 border border-indigo-500/70 hover:bg-indigo-900 shadow-sm shadow-indigo-500/25 text-[8px] font-mono px-1 py-0.2 rounded flex items-center gap-0.5 font-bold transition z-20 cursor-pointer"
                                  title={`Multi-Cam Synced: ${clip.multiCam.cameraName} (${clip.multiCam.timeOffset >= 0 ? '+' : ''}${clip.multiCam.timeOffset.toFixed(2)}s, ${clip.multiCam.correlationConfidence}%). Clic para abrir el sincronizador.`}
                                >
                                  <Video className="w-2 h-2 text-indigo-400" />
                                  <span>{clip.multiCam.cameraName}</span>
                                  <span className="text-[7px] text-emerald-400 font-bold">SYNC ✓</span>
                                </button>
                              )}

                              {/* AI Audio Cleanup Badge */}
                              {clip.audioCleanup?.isEnabled && (
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenAudioCleanup?.(clip.id);
                                  }}
                                  className={`text-[8px] font-mono px-1 py-0.2 rounded flex items-center gap-0.5 font-bold transition z-20 cursor-pointer ${
                                    clip.audioCleanup.isBypassed
                                      ? 'bg-amber-950/90 text-amber-300 border border-amber-600/70 hover:bg-amber-900'
                                      : 'bg-emerald-950/95 text-emerald-300 border border-emerald-500/70 hover:bg-emerald-900 shadow-sm shadow-emerald-500/25'
                                  }`}
                                  title={`Audio Cleanup: ${clip.audioCleanup.detectedNoiseType || 'Noise Reduced'} (${clip.audioCleanup.reductionDb} dB). Clic para ajustar.`}
                                >
                                  <Sparkles className="w-2 h-2 text-emerald-400" />
                                  <span>{clip.audioCleanup.isBypassed ? 'RAW BYPASS' : `CLEAN ${clip.audioCleanup.reductionDb}dB`}</span>
                                </button>
                              )}

                              {/* Audio Gain Normalization Badge */}
                              {clip.audioGain !== undefined && clip.audioGain !== 0 && (
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenAudioCleanup?.(clip.id);
                                  }}
                                  className="bg-teal-950/95 text-teal-300 border border-teal-500/70 hover:bg-teal-900 shadow-sm shadow-teal-500/25 text-[8px] font-mono px-1 py-0.2 rounded flex items-center gap-0.5 font-bold transition z-20 cursor-pointer"
                                  title={`Normalización de Ganancia: ${clip.audioGain > 0 ? '+' : ''}${clip.audioGain} dB. Clic para abrir el normalizador.`}
                                >
                                  <Gauge className="w-2 h-2 text-teal-400" />
                                  <span>{clip.audioGain > 0 ? `+${clip.audioGain}` : `${clip.audioGain}`}dB</span>
                                </button>
                              )}

                              {clip.colorMatchInfo?.isMatched && (
                                <button
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenColorMatch?.(clip.id);
                                  }}
                                  className="bg-amber-950/95 text-amber-300 border border-amber-500/70 hover:bg-amber-900 shadow-sm shadow-amber-500/25 text-[8px] font-mono px-1 py-0.2 rounded flex items-center gap-0.5 font-bold transition z-20 cursor-pointer"
                                  title={`AI Color Match: ${clip.colorMatchInfo.lookName} (${clip.colorMatchInfo.confidence.toFixed(0)}%). Clic para ajustar.`}
                                >
                                  <Palette className="w-2 h-2 text-amber-400" />
                                  <span>{clip.colorMatchInfo.confidence.toFixed(0)}% MATCH</span>
                                </button>
                              )}

                              {/* AI Beat Alignment Action for Audio Clips */}
                              {clip.type === 'audio' && (
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenBeatAlignment?.(clip.id);
                                  }}
                                  className="bg-pink-950/90 text-pink-300 border border-pink-500/60 hover:bg-pink-900 text-[8px] font-mono px-1 py-0.2 rounded flex items-center gap-0.5 font-bold transition z-20 cursor-pointer shadow-sm"
                                  title="Alinear cortes de vídeo al ritmo y picos de este audio con IA"
                                >
                                  <Music className="w-2 h-2 text-pink-400" />
                                  <span>BEAT SNAP</span>
                                </button>
                              )}
                            </div>
                            <span className="font-mono text-[9px] opacity-80">{clip.duration.toFixed(1)}s</span>
                          </div>

                          {/* Clip Body / Audio Waveform / Vegas Envelopes */}
                          <div className="flex-1 relative overflow-hidden px-1 flex items-center">
                            {/* Video Clip Audio Waveform Simulation for Multi-Cam alignment */}
                            {clip.type === 'video' && (
                              <div className="absolute inset-0 flex items-center justify-around opacity-20 pointer-events-none">
                                {Array.from({ length: Math.min(50, Math.floor(clipWidth / 5)) }).map((_, i) => {
                                  const h = 14 + Math.sin(i * 0.75) * 26 + (i % 8 === 0 ? 30 : 0);
                                  return (
                                    <div
                                      key={i}
                                      style={{ height: `${h}%` }}
                                      className={`w-0.5 rounded-full ${clip.multiCam?.isSynced ? 'bg-indigo-300' : 'bg-sky-400'}`}
                                    />
                                  );
                                })}
                              </div>
                            )}
                            {/* Audio Waveform Simulation */}
                            {clip.type === 'audio' && (
                              <div className="absolute inset-0 flex items-center justify-around opacity-45 pointer-events-none">
                                {Array.from({ length: Math.min(60, Math.floor(clipWidth / 4)) }).map((_, i) => {
                                  const isClean = clip.audioCleanup?.isEnabled && !clip.audioCleanup?.isBypassed;
                                  const heightPercent = isClean
                                    ? Math.max(10, Math.sin(i * 0.7) * 40 + 28)
                                    : (20 + Math.sin(i * 0.7) * 45 + Math.random() * 25);
                                  return (
                                    <div
                                      key={i}
                                      style={{
                                        height: `${heightPercent}%`,
                                      }}
                                      className={`w-0.5 rounded-full transition-colors ${
                                        isClean ? 'bg-emerald-300 shadow-[0_0_3px_rgba(52,211,153,0.6)]' : 'bg-emerald-500/80'
                                      }`}
                                    />
                                  );
                                })}
                                {/* Noise floor threshold indicator if cleaned */}
                                {clip.audioCleanup?.isEnabled && !clip.audioCleanup?.isBypassed && (
                                  <div className="absolute inset-x-1 bottom-0.5 border-b border-dashed border-emerald-400/40 flex justify-between text-[7px] font-mono text-emerald-300/70 pointer-events-none px-0.5">
                                    <span>-58dBFS NOISE FLOOR (AI CLEAN)</span>
                                    <span>NOTCH 60Hz</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Caption Text preview */}
                            {clip.type === 'text' && clip.captionText && (
                              <span className="text-[10px] font-black italic text-yellow-300 truncate z-10">
                                &quot;{clip.captionText}&quot;
                              </span>
                            )}

                            {/* AI Keyframe Assist Motion Diamond Nodes */}
                            {clip.motionKeyframes && clip.motionKeyframes.map((kf) => (
                              <div
                                key={kf.id}
                                style={{ left: `${(kf.timeOffset / clip.duration) * 100}%` }}
                                className="absolute top-1 w-2 h-2 -ml-1 bg-purple-400 rotate-45 border border-black shadow pointer-events-none z-10"
                                title={`Motion Keyframe: ${kf.zoom}x, ${kf.rotation}° at ${kf.timeOffset}s`}
                              />
                            ))}

                            {/* Vegas Pro Velocity & Opacity Envelope Curves Overlay */}
                            {showEnvelopes && clip.velocityEnvelope && clip.velocityEnvelope.length > 0 && (
                              <div 
                                onClick={(e) => {
                                  if (activeTool === 'envelope') {
                                    handleAddEnvelopeKeyframe(e, clip, 'velocity');
                                  }
                                }}
                                className="absolute inset-x-0 bottom-1 h-3 pointer-events-auto"
                                title="Vegas Velocity Envelope Curve"
                              >
                                <div className="w-full h-0.5 bg-emerald-400/80 relative">
                                  {clip.velocityEnvelope.map((kf) => (
                                    <div
                                      key={kf.id}
                                      style={{ left: `${(kf.timeOffset / clip.duration) * 100}%` }}
                                      className="absolute -top-1 w-2.5 h-2.5 -ml-1 rounded-full bg-emerald-300 border border-black shadow hover:scale-125 transition"
                                      title={`Velocity: ${kf.value}x at ${kf.timeOffset}s`}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Vegas Crossfade Visual Overlay */}
                            {clip.crossfadeStart && (
                              <div 
                                style={{ width: `${clip.crossfadeStart * zoomLevel}px` }}
                                className="absolute top-0 bottom-0 left-0 bg-violet-500/25 border-r border-violet-400/60 flex items-center justify-center pointer-events-none"
                              >
                                <span className="text-[8px] font-mono text-violet-200">X-Fade</span>
                              </div>
                            )}
                          </div>

                          {/* Trim Handles on Left and Right edges */}
                          {/* Left Trim Handle */}
                          <div
                            onMouseDown={(e) => handleTrimStart(e, clip, 'left')}
                            className={`absolute top-0 bottom-0 left-0 w-3 z-30 flex items-center justify-center cursor-col-resize group transition select-none ${
                              isRippleEditMode
                                ? 'hover:bg-amber-400 bg-amber-500/25 text-amber-300 border-r border-amber-400/40'
                                : 'hover:bg-sky-400 bg-white/10 text-white/70 border-r border-white/20'
                            }`}
                            title={
                              isRippleEditMode
                                ? 'Ripple Trim In (Recorte con Ripple Sync en todas las pistas)'
                                : 'Trim In (Recorte normal)'
                            }
                          >
                            <span className="text-[10px] font-mono font-black drop-shadow group-hover:scale-125 transition">
                              {isRippleEditMode ? '‹' : '['}
                            </span>
                          </div>

                          {/* Right Trim Handle */}
                          <div
                            onMouseDown={(e) => handleTrimStart(e, clip, 'right')}
                            className={`absolute top-0 bottom-0 right-0 w-3 z-30 flex items-center justify-center cursor-col-resize group transition select-none ${
                              isRippleEditMode
                                ? 'hover:bg-amber-400 bg-amber-500/25 text-amber-300 border-l border-amber-400/40'
                                : 'hover:bg-sky-400 bg-white/10 text-white/70 border-l border-white/20'
                            }`}
                            title={
                              isRippleEditMode
                                ? 'Ripple Trim Out (Recorte con Ripple Sync en todas las pistas)'
                                : 'Trim Out (Recorte normal)'
                            }
                          >
                            <span className="text-[10px] font-mono font-black drop-shadow group-hover:scale-125 transition">
                              {isRippleEditMode ? '›' : ']'}
                            </span>
                          </div>

                          {/* Active Drag Trimming HUD Ghost */}
                          {isTrimmingThis && trimmingState && (
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-950/95 border border-amber-400 text-amber-200 px-2 py-0.5 rounded text-[9px] font-mono font-bold shadow-2xl whitespace-nowrap z-50 flex items-center gap-1.5 pointer-events-none">
                              <span>{isRippleEditMode ? '⚡ RIPPLE' : '✂️ TRIM'}:</span>
                              <span>{clipDuration.toFixed(2)}s</span>
                              <span className={trimmingState.currentDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                                ({trimmingState.currentDelta >= 0 ? '+' : ''}{trimmingState.currentDelta.toFixed(2)}s)
                              </span>
                              {snappedGuide && (
                                <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-400/60 px-1 py-0.2 rounded text-[8px] flex items-center gap-1 font-bold uppercase">
                                  <Magnet className="w-2 h-2 text-emerald-300" />
                                  <span>{snappedGuide.label}</span>
                                </span>
                              )}
                              {isRippleEditMode && <span className="text-amber-400 text-[8px] uppercase">• Sync Todas Pistas</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Adjacent Cut Points & AI Transition Badges on this Track */}
                    {trackClips
                      .slice()
                      .sort((a, b) => a.startTime - b.startTime)
                      .map((clip, cIdx, arr) => {
                        if (cIdx === arr.length - 1) return null;
                        const nextClip = arr[cIdx + 1];
                        const cutPoint = Number((clip.startTime + clip.duration).toFixed(2));
                        if (Math.abs(nextClip.startTime - cutPoint) > 0.6 && nextClip.startTime > cutPoint + 0.5) return null;

                        const cutPixel = cutPoint * zoomLevel;
                        const existingTransition = appliedTransitions.find(
                          (t) => (t.fromClipId === clip.id && t.toClipId === nextClip.id) || Math.abs(t.cutTime - cutPoint) < 0.2
                        ) || nextClip.transitionIn;

                        if (existingTransition) {
                          const transWidth = Math.max(38, existingTransition.duration * zoomLevel);
                          const isLightLeak = existingTransition.type === 'light_leak';
                          const isZoomBlur = existingTransition.type === 'zoom_blur';
                          const isCrossDissolve = existingTransition.type === 'cross_dissolve';
                          return (
                            <div
                              key={`trans-${clip.id}-${nextClip.id}`}
                              style={{
                                left: `${cutPixel - transWidth / 2}px`,
                                width: `${transWidth}px`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenTransitionSuggest?.(cutPoint, clip.id, nextClip.id);
                              }}
                              className={`absolute top-1 bottom-1 z-25 rounded-md border shadow-lg cursor-pointer flex items-center justify-center gap-1 transition select-none group hover:scale-[1.03] ${
                                isLightLeak
                                  ? 'bg-gradient-to-r from-amber-600/90 via-orange-500/90 to-yellow-500/90 border-amber-300 text-white shadow-amber-500/30'
                                  : isZoomBlur
                                  ? 'bg-gradient-to-r from-sky-600/90 via-blue-500/90 to-indigo-600/90 border-sky-300 text-white shadow-sky-500/30'
                                  : isCrossDissolve
                                  ? 'bg-gradient-to-r from-purple-600/90 via-violet-500/90 to-fuchsia-600/90 border-purple-300 text-white shadow-purple-500/30'
                                  : 'bg-gradient-to-r from-rose-600/90 to-amber-600/90 border-rose-300 text-white'
                              }`}
                              title={`AI Transición: ${existingTransition.title} (${existingTransition.duration}s). Clic para ajustar con Gemini.`}
                            >
                              <span className="text-[9px] font-mono font-bold uppercase drop-shadow flex items-center gap-1 truncate px-1">
                                {isLightLeak ? <Sun className="w-2.5 h-2.5 text-yellow-200" /> : isZoomBlur ? <Zap className="w-2.5 h-2.5 text-sky-200" /> : <Sparkles className="w-2.5 h-2.5 text-white" />}
                                <span className="truncate">{existingTransition.title.split(' ')[0]}</span>
                                <span className="opacity-80 text-[8px] font-mono">{existingTransition.duration}s</span>
                              </span>
                            </div>
                          );
                        }

                        return (
                          <button
                            key={`cut-btn-${clip.id}-${nextClip.id}`}
                            style={{ left: `${cutPixel - 12}px` }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenTransitionSuggest?.(cutPoint, clip.id, nextClip.id);
                            }}
                            className="absolute top-1/2 -translate-y-1/2 w-6 h-6 z-25 rounded-full bg-slate-900/90 hover:bg-amber-500 text-amber-400 hover:text-black border border-amber-500/60 shadow-lg flex items-center justify-center transition active:scale-95 cursor-pointer opacity-80 hover:opacity-100 hover:scale-110"
                            title={`Sugerir Transición IA (Gemini) entre "${clip.title}" y "${nextClip.title}"`}
                          >
                            <Sparkles className="w-3 h-3" />
                          </button>
                        );
                      })}
                  </div>
                );
              })}
            </div>

            {/* Teammate Collaborator Playheads (Multi-user Presence) */}
            {collaborators.map((collab) => (
              <div
                key={collab.id}
                style={{ left: `${collab.currentPlayhead * zoomLevel}px` }}
                className="absolute top-0 bottom-0 pointer-events-none z-30"
              >
                <div 
                  style={{ backgroundColor: collab.color }}
                  className="w-0.5 h-full opacity-70 relative"
                >
                  {/* Collaborator Badge Tag */}
                  <div 
                    style={{ backgroundColor: collab.color }}
                    className="absolute -top-5 -left-3 px-1.5 py-0.5 rounded text-[9px] font-bold text-black flex items-center gap-1 shadow-md whitespace-nowrap"
                  >
                    <img src={collab.avatar} alt="" className="w-2.5 h-2.5 rounded-full" />
                    <span>{collab.name.split(' ')[0]}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Master Scrubbing Playhead (Premiere Pro Red / Sky Needle) */}
            <div
              style={{ left: `${currentTime * zoomLevel}px` }}
              className="absolute top-0 bottom-0 z-40 pointer-events-none"
            >
              <div className="relative w-0.5 h-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]">
                {/* Playhead Top Grip */}
                <div className="absolute -top-1 -left-2 w-4 h-4 bg-sky-400 rotate-45 rounded-sm shadow-md border border-white flex items-center justify-center" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
