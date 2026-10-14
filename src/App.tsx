/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  WorkspaceTab, AspectRatio, ToolType, TimelineClip, 
  TimelineTrack, TimelineMarker, Collaborator, TimelineComment, 
  ProjectBranch, ProjectCommit, MediaAsset, LumetriColorSettings, PanCropSettings, MotionCurveResult, AppliedTransition, MotionBlurSettings 
} from './types/editor';
import { 
  INITIAL_MEDIA_ASSETS, INITIAL_TRACKS, INITIAL_CLIPS, 
  INITIAL_MARKERS, INITIAL_COLLABORATORS, INITIAL_COMMENTS, 
  INITIAL_BRANCHES, INITIAL_COMMITS 
} from './data/mockAssets';
import { HeaderBar } from './components/HeaderBar';
import { LeftSidebar } from './components/LeftSidebar';
import { VideoCanvasPlayer } from './components/VideoCanvasPlayer';
import { Timeline } from './components/Timeline';
import { secondsToTimecode } from './utils/timecode';
import { AiAssistantModal } from './components/AiAssistantModal';
import { SemanticIndexingView } from './components/SemanticIndexingView';
import { TextBasedEditingView } from './components/TextBasedEditingView';
import { CloudRenderView } from './components/CloudRenderView';
import { VersionControlView } from './components/VersionControlView';
import { ApiPipelineView } from './components/ApiPipelineView';
import { AiStudioToolsModal } from './components/AiStudioToolsModal';
import { AudioCleanupModal } from './components/AudioCleanupModal';
import { ColorMatchModal } from './components/ColorMatchModal';
import { AutoSceneSplitterModal } from './components/AutoSceneSplitterModal';
import { AiTransitionSuggestModal } from './components/AiTransitionSuggestModal';
import { AiVoiceoverStudioModal } from './components/AiVoiceoverStudioModal';
import { AiBeatAlignmentModal } from './components/AiBeatAlignmentModal';
import { MultiCamSyncModal } from './components/MultiCamSyncModal';
import { SmartProxyManager } from './components/SmartProxyManager';
import { MediaLibrary } from './components/MediaLibrary';
import { auth, db, signInWithGoogle, logOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export default function App() {
  const [currentTab, setCurrentTab] = useState<WorkspaceTab>('editing');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [currentTime, setCurrentTime] = useState<number>(3.2);
  const [duration, setDuration] = useState<number>(20.0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [selectedClipId, setSelectedClipId] = useState<string | null>('clip-1');

  // Core project data states
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>(INITIAL_MEDIA_ASSETS);
  const [tracks, setTracks] = useState<TimelineTrack[]>(INITIAL_TRACKS);
  const [clips, setClips] = useState<TimelineClip[]>(INITIAL_CLIPS);
  const [markers, setMarkers] = useState<TimelineMarker[]>(INITIAL_MARKERS);
  const [collaborators, setCollaborators] = useState<Collaborator[]>(INITIAL_COLLABORATORS);
  const [comments, setComments] = useState<TimelineComment[]>(INITIAL_COMMENTS);
  const [branches, setBranches] = useState<ProjectBranch[]>(INITIAL_BRANCHES);
  const [commits, setCommits] = useState<ProjectCommit[]>(INITIAL_COMMITS);
  const [currentBranch, setCurrentBranch] = useState<string>('b-main');

  // Proxy Generation & Playback Mode
  const [isProxyModeActive, setIsProxyModeActive] = useState<boolean>(true);

  // Modal states
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [isAiToolsModalOpen, setIsAiToolsModalOpen] = useState<boolean>(false);
  const [isAudioCleanupModalOpen, setIsAudioCleanupModalOpen] = useState<boolean>(false);
  const [audioCleanupClipId, setAudioCleanupClipId] = useState<string | null>(null);
  const [isColorMatchModalOpen, setIsColorMatchModalOpen] = useState<boolean>(false);
  const [isSceneSplitterModalOpen, setIsSceneSplitterModalOpen] = useState<boolean>(false);
  const [sceneSplitterClipId, setSceneSplitterClipId] = useState<string | null>(null);

  // AI Transition Suggest state
  const [appliedTransitions, setAppliedTransitions] = useState<AppliedTransition[]>([
    {
      id: 'trans-init-clip1-clip2',
      type: 'light_leak',
      title: 'Anamorphic Golden Light Leak Flare',
      duration: 0.8,
      easing: 'ease_in_out',
      alignment: 'center',
      cutTime: 7.5,
      fromClipId: 'clip-1',
      toClipId: 'clip-2',
      parameters: { intensity: 85, warmth: 92, blurAmount: 30 },
      similarityScore: 95,
      appliedAt: Date.now(),
    },
  ]);
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState<boolean>(false);
  const [transitionCutTime, setTransitionCutTime] = useState<number | undefined>(undefined);

  // AI Voiceover Studio Modal State
  const [isVoiceoverStudioOpen, setIsVoiceoverStudioOpen] = useState<boolean>(false);

  // Firebase Storage Cloud Media Library Modal State
  const [isMediaLibraryModalOpen, setIsMediaLibraryModalOpen] = useState<boolean>(false);

  // AI Beat Alignment & Transient Snapping Modal State
  const [isBeatAlignmentModalOpen, setIsBeatAlignmentModalOpen] = useState<boolean>(false);
  const [beatAlignmentAudioClipId, setBeatAlignmentAudioClipId] = useState<string | null>(null);

  // AI Multi-Cam Waveform Sync Modal State
  const [isMultiCamSyncOpen, setIsMultiCamSyncOpen] = useState<boolean>(false);
  const [selectedClipIds, setSelectedClipIds] = useState<string[]>(['clip-1']);
  const [multiCamNotification, setMultiCamNotification] = useState<string | null>(null);

  // Smart Proxy Manager Modal State (Background Worker Transcoding)
  const [isSmartProxyManagerOpen, setIsSmartProxyManagerOpen] = useState<boolean>(false);
  const [smartProxySelectedClipId, setSmartProxySelectedClipId] = useState<string | null>(null);

  // Ripple Edit Mode State (Premiere Pro / Vegas style auto-shift across all tracks)
  const [isRippleEditMode, setIsRippleEditMode] = useState<boolean>(true);
  const [snapToNeighbors, setSnapToNeighbors] = useState<boolean>(true);
  const [rippleNotification, setRippleNotification] = useState<string | null>(null);

  const handleToggleSnapToNeighbors = (active: boolean) => {
    setSnapToNeighbors(active);
    setRippleNotification(
      active
        ? '🧲 Snap to Neighbors ACTIVO: Alineación magnética al ras con clips vecinos y Playhead (Flush Cuts sin micro-huecos).'
        : 'Snap to Neighbors desactivado.'
    );
  };

  useEffect(() => {
    if (rippleNotification) {
      const timer = setTimeout(() => setRippleNotification(null), 3600);
      return () => clearTimeout(timer);
    }
  }, [rippleNotification]);

  // Firebase Auth & Firestore Sync state
  const [user, setUser] = useState<User | null>(null);
  const [lastCheckpointTime, setLastCheckpointTime] = useState<string>('Just now');
  const [autoSaveNotification, setAutoSaveNotification] = useState<string | null>(null);

  useEffect(() => {
    if (autoSaveNotification) {
      const timer = setTimeout(() => setAutoSaveNotification(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [autoSaveNotification]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSyncFirestore = async () => {
    if (!user) {
      await handleSignIn();
      return;
    }
    try {
      await setDoc(doc(db, 'projects', `proj-${user.uid}`), {
        id: `proj-${user.uid}`,
        ownerId: user.uid,
        title: 'OmniCut Studio Cloud Master Cut',
        aspectRatio,
        duration,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setAutoSaveNotification('¡Proyecto guardado en la nube en Firebase Firestore exitosamente!');
    } catch (err) {
      console.error('Error syncing to Firestore:', err);
    }
  };

  // =========================================================================
  // AUTO-SAVE MECHANISM: Periodic 5-minute Checkpoint commit in Firestore
  // =========================================================================
  const handleTriggerCheckpoint = useCallback(async (isManual: boolean = false) => {
    const hash = Math.random().toString(36).substring(2, 9);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const currentBranchName = branches.find((b) => b.id === currentBranch)?.name || 'main';

    const commitMessage = isManual
      ? `Checkpoint: Manual Snapshot (${timeStr})`
      : `Checkpoint: Auto-save (${timeStr})`;

    const newCheckpointCommit: ProjectCommit = {
      hash,
      message: commitMessage,
      author: user?.displayName || 'Auto-Save Bot (Firestore)',
      timestamp: timeStr,
      branch: currentBranchName,
      diffSummary: `Automatic 5-minute Firestore Checkpoint commit. Synchronized ${clips.length} active timeline tracks.`,
      isCheckpoint: true,
      snapshotClipCount: clips.length,
    };

    setCommits((prev) => [newCheckpointCommit, ...prev]);
    setLastCheckpointTime(timeStr);

    // Save project checkpoint document to Firestore if authenticated
    try {
      if (user) {
        const projId = `proj-${user.uid}`;
        await setDoc(
          doc(db, 'projects', projId),
          {
            id: projId,
            ownerId: user.uid,
            title: 'OmniCut Studio Cloud Master Cut',
            aspectRatio,
            duration,
            currentBranch,
            updatedAt: now.toISOString(),
            lastCheckpoint: {
              commitHash: hash,
              message: commitMessage,
              timestamp: now.toISOString(),
              clipCount: clips.length,
              branch: currentBranchName,
            },
            summary: `${clips.length} active clips, branch ${currentBranchName}`,
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.warn('Firestore checkpoint background sync notice:', err);
    }

    // Backup to local storage for zero data loss
    try {
      localStorage.setItem('omnicut_last_checkpoint', JSON.stringify({
        hash,
        timestamp: now.toISOString(),
        clipCount: clips.length,
        branch: currentBranchName,
      }));
    } catch {
      // ignore
    }

    setAutoSaveNotification(
      user
        ? `Firestore Auto-Save: Checkpoint commit #${hash} creado (${clips.length} clips sincronizados)`
        : `Auto-Save Local: Checkpoint #${hash} respaldado (${clips.length} clips)`
    );
  }, [branches, currentBranch, user, clips, aspectRatio, duration]);

  // Periodic 5-minute interval timer for Checkpoint commits
  useEffect(() => {
    const AUTO_SAVE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    const interval = setInterval(() => {
      handleTriggerCheckpoint(false);
    }, AUTO_SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [handleTriggerCheckpoint]);

  // Playback timer loop
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      const deltaSec = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      setCurrentTime((prev) => {
        const next = prev + deltaSec;
        if (next >= duration) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, duration]);

  // Selected clip helper
  const selectedClip = clips.find((c) => c.id === selectedClipId) || null;

  // Toggle Play / Pause
  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  // Split clip at playhead position (Ctrl+K / Cmd+K)
  const handleSplitClipAtPlayhead = () => {
    const clipToSplit = clips.find(
      (c) => c.id === selectedClipId || (currentTime >= c.startTime && currentTime <= c.startTime + c.duration)
    );

    if (!clipToSplit) return;
    if (currentTime <= clipToSplit.startTime + 0.2 || currentTime >= clipToSplit.startTime + clipToSplit.duration - 0.2) return;

    const firstDuration = currentTime - clipToSplit.startTime;
    const secondDuration = clipToSplit.duration - firstDuration;

    const firstClip: TimelineClip = {
      ...clipToSplit,
      duration: firstDuration,
    };

    const secondClip: TimelineClip = {
      ...clipToSplit,
      id: `clip-split-${Date.now()}`,
      startTime: currentTime,
      duration: secondDuration,
      offsetTime: clipToSplit.offsetTime + firstDuration,
    };

    const updated = clips.flatMap((c) => (c.id === clipToSplit.id ? [firstClip, secondClip] : [c]));
    setClips(updated);
    setSelectedClipId(secondClip.id);
  };

  // Add media asset to timeline
  const handleAddMediaToTimeline = (asset: MediaAsset, targetTrackId?: string, startTimeParam?: number) => {
    const isGraphics = asset.type === 'graphics' || asset.category === 'Graphics' || asset.autoCategory === 'Graphics';
    const isTranscript = asset.type === 'transcript' || asset.category === 'Transcripts' || asset.autoCategory === 'Transcripts';
    const isVideo = asset.type === 'video' || asset.type === 'broll';

    const defaultTrackId = isGraphics || isTranscript 
      ? 'track-v3' 
      : isVideo 
      ? 'track-v1' 
      : 'track-a2';

    const trackId = targetTrackId || defaultTrackId;

    let startTime = startTimeParam !== undefined ? startTimeParam : currentTime;
    if (startTimeParam === undefined) {
      const lastClipInTrack = clips
        .filter((c) => c.trackId === trackId)
        .sort((a, b) => (b.startTime + b.duration) - (a.startTime + a.duration))[0];
      startTime = lastClipInTrack ? lastClipInTrack.startTime + lastClipInTrack.duration : currentTime;
    }

    const clipDuration = Math.min(8.0, asset.duration || 6.0);
    const safeStartTime = Math.max(0, Math.round(startTime * 100) / 100);

    const clipColor = isGraphics 
      ? '#ec4899' // Pink/Fuchsia for Graphics
      : isTranscript 
      ? '#f59e0b' // Amber/Gold for Transcripts
      : isVideo 
      ? (asset.type === 'broll' ? '#8b5cf6' : '#0284c7') 
      : '#10b981'; // Emerald for Audio

    const clipType: 'video' | 'audio' | 'text' = (isGraphics || isTranscript) 
      ? 'text' 
      : isVideo 
      ? 'video' 
      : 'audio';

    const newClip: TimelineClip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      trackId,
      title: asset.title,
      type: clipType,
      src: asset.url,
      thumbnail: asset.thumbnail,
      startTime: safeStartTime,
      duration: clipDuration,
      offsetTime: 0,
      sourceDuration: asset.duration,
      color: clipColor,
      volumeEnvelope: [{ id: 've-1', timeOffset: 0, value: 100 }, { id: 've-2', timeOffset: clipDuration, value: 100 }],
      opacityEnvelope: [{ id: 'oe-1', timeOffset: 0, value: 100 }, { id: 'oe-2', timeOffset: clipDuration, value: 100 }],
      velocityEnvelope: [{ id: 've-1', timeOffset: 0, value: 1.0 }, { id: 've-2', timeOffset: clipDuration, value: 1.0 }],
      panCrop: { zoom: 1.0, panX: 0, panY: 0, rotation: 0 },
      lumetri: {
        exposure: 0, contrast: 0, highlights: 0, shadows: 0,
        temperature: 0, tint: 0, saturation: 100, vibrance: 0, lutPreset: 'none'
      },
      audioGain: 0,
    };

    setClips((prev) => [...prev, newClip]);
    setSelectedClipId(newClip.id);
    if (safeStartTime + clipDuration > duration) {
      setDuration(safeStartTime + clipDuration + 4.0);
    }
    setRippleNotification(`"${asset.title}" agregado a la pista ${trackId.toUpperCase()}`);
  };

  // Handle Drag & Drop of media assets from Media Library directly onto Timeline tracks
  const handleDropMediaAsset = (asset: MediaAsset, targetTrackId: string, dropTime: number) => {
    const isGraphics = asset.type === 'graphics' || asset.category === 'Graphics' || asset.autoCategory === 'Graphics';
    const isTranscript = asset.type === 'transcript' || asset.category === 'Transcripts' || asset.autoCategory === 'Transcripts';
    const isVideo = asset.type === 'video' || asset.type === 'broll';

    // Verify track type compatibility or route to correct track
    let finalTrackId = targetTrackId;
    const targetTrack = tracks.find((t) => t.id === targetTrackId);
    if (targetTrack) {
      if ((isGraphics || isTranscript) && targetTrack.type === 'audio') {
        finalTrackId = 'track-v3';
      } else if (isVideo && targetTrack.type === 'audio') {
        finalTrackId = 'track-v1';
      } else if (!isVideo && !isGraphics && !isTranscript && targetTrack.type === 'video') {
        finalTrackId = 'track-a2';
      }
    } else {
      finalTrackId = (isGraphics || isTranscript) ? 'track-v3' : isVideo ? 'track-v1' : 'track-a2';
    }

    const clipDuration = Math.min(10.0, asset.duration || 6.0);
    const safeStartTime = Math.max(0, Math.round(dropTime * 100) / 100);

    const clipColor = isGraphics 
      ? '#ec4899' 
      : isTranscript 
      ? '#f59e0b' 
      : isVideo 
      ? (asset.type === 'broll' ? '#8b5cf6' : '#0284c7') 
      : '#10b981';

    const clipType: 'video' | 'audio' | 'text' = (isGraphics || isTranscript) 
      ? 'text' 
      : isVideo 
      ? 'video' 
      : 'audio';

    const newClip: TimelineClip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      trackId: finalTrackId,
      title: asset.title,
      type: clipType,
      src: asset.url,
      thumbnail: asset.thumbnail,
      startTime: safeStartTime,
      duration: clipDuration,
      offsetTime: 0,
      sourceDuration: asset.duration,
      color: clipColor,
      volumeEnvelope: [{ id: 've-1', timeOffset: 0, value: 100 }, { id: 've-2', timeOffset: clipDuration, value: 100 }],
      opacityEnvelope: [{ id: 'oe-1', timeOffset: 0, value: 100 }, { id: 'oe-2', timeOffset: clipDuration, value: 100 }],
      velocityEnvelope: [{ id: 've-1', timeOffset: 0, value: 1.0 }, { id: 've-2', timeOffset: clipDuration, value: 1.0 }],
      panCrop: { zoom: 1.0, panX: 0, panY: 0, rotation: 0 },
      lumetri: {
        exposure: 0, contrast: 0, highlights: 0, shadows: 0,
        temperature: 0, tint: 0, saturation: 100, vibrance: 0, lutPreset: 'none'
      },
      audioGain: 0,
    };

    setClips((prev) => [...prev, newClip]);
    setSelectedClipId(newClip.id);
    if (safeStartTime + clipDuration > duration) {
      setDuration(safeStartTime + clipDuration + 4.0);
    }
    setRippleNotification(
      `Clip "${asset.title}" colocado en ${finalTrackId.toUpperCase()} en ${secondsToTimecode(safeStartTime)}`
    );
  };

  // Update Lumetri Color on clip
  const handleUpdateClipLumetri = (clipId: string, lumetri: LumetriColorSettings) => {
    setClips((prev) => prev.map((c) => (c.id === clipId ? { ...c, lumetri } : c)));
  };

  // Update Pan/Crop on clip
  const handleUpdateClipPanCrop = (clipId: string, panCrop: PanCropSettings) => {
    setClips((prev) => prev.map((c) => (c.id === clipId ? { ...c, panCrop } : c)));
  };

  // Update Motion Blur on clip (AI Optical Flow & Shutter Angle)
  const handleUpdateClipMotionBlur = (clipId: string, settings: MotionBlurSettings) => {
    setClips((prev) => prev.map((c) => (c.id === clipId ? { ...c, motionBlur: settings } : c)));
  };

  // Add AI Voiceover Audio Clip directly to timeline (from AiVoiceoverStudioModal)
  const handleAddVoiceoverClip = (newClip: TimelineClip) => {
    setClips((prev) => [...prev, newClip]);
    setSelectedClipId(newClip.id);
    if (newClip.startTime + newClip.duration > duration) {
      setDuration(newClip.startTime + newClip.duration + 4.0);
    }
    setRippleNotification(`Pista de voz sintetizada agregada a la línea de tiempo: ${newClip.title}`);
  };

  // Add Comment on current frame
  const handleAddComment = (text: string) => {
    const newComment: TimelineComment = {
      id: `comm-${Date.now()}`,
      author: 'Carlos Mendez (Lead Editor)',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      time: currentTime,
      text,
      status: 'open',
      createdAt: 'Just now',
    };
    setComments((prev) => [newComment, ...prev]);
  };

  // Toggle comment status
  const handleToggleCommentStatus = (id: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: c.status === 'open' ? 'resolved' : 'open' } : c))
    );
  };

  // CapCut Smart Action applicator
  const handleApplyCapCutAction = (action: string, payload?: any) => {
    if (action.startsWith('CAPTIONS_')) {
      const style = action.replace('CAPTIONS_', '').toLowerCase() as any;
      setClips((prev) =>
        prev.map((c) => {
          if (c.trackId === 'track-v3' || c.type === 'text') {
            return {
              ...c,
              captionStyle: style,
              captionColor: style === 'hormozi' ? '#fbbf24' : style === 'mrbeast' ? '#34d399' : '#06b6d4',
            };
          }
          return c;
        })
      );
    } else if (action === 'AUTO_CUT_SILENCES') {
      // Simulate auto-cut silence removal
      setClips((prev) =>
        prev.map((c) => {
          if (c.id === 'clip-1') {
            return { ...c, duration: 6.2 }; // Trim silence gap
          }
          if (c.id === 'clip-2') {
            return { ...c, startTime: 6.2 };
          }
          return c;
        })
      );
      setDuration((d) => Math.max(12, d - 1.3));
    } else if (action === 'BEAT_SYNC') {
      const beatMarkers: TimelineMarker[] = [
        { id: `bm-${Date.now()}-1`, time: 1.8, label: 'Beat 1 (128 BPM)', color: '#ec4899', type: 'beat' },
        { id: `bm-${Date.now()}-2`, time: 3.6, label: 'Beat 2', color: '#ec4899', type: 'beat' },
        { id: `bm-${Date.now()}-3`, time: 5.4, label: 'Beat 3 Drop', color: '#ec4899', type: 'beat' },
        { id: `bm-${Date.now()}-4`, time: 7.2, label: 'Beat 4', color: '#ec4899', type: 'beat' },
      ];
      setMarkers((prev) => [...prev, ...beatMarkers]);
    } else if (action === 'SPEED_RAMP_BULLET' && selectedClipId) {
      setClips((prev) =>
        prev.map((c) => {
          if (c.id === selectedClipId) {
            return {
              ...c,
              velocityEnvelope: [
                { id: 'v-1', timeOffset: 0, value: 2.0 },
                { id: 'v-2', timeOffset: c.duration * 0.4, value: 0.35 },
                { id: 'v-3', timeOffset: c.duration * 0.8, value: 2.2 },
              ],
            };
          }
          return c;
        })
      );
    } else if (action === 'SPEED_RAMP_HERO' && selectedClipId) {
      setClips((prev) =>
        prev.map((c) => {
          if (c.id === selectedClipId) {
            return {
              ...c,
              velocityEnvelope: [
                { id: 'v-1', timeOffset: 0, value: 0.5 },
                { id: 'v-2', timeOffset: c.duration * 0.5, value: 1.0 },
              ],
            };
          }
          return c;
        })
      );
    }
  };

  // Apply AI Co-Pilot Result (from Gemini API)
  const handleApplyAiResult = (result: any) => {
    if (!result) return;

    if (result.lumetriPreset && result.lumetriPreset !== 'none') {
      setClips((prev) =>
        prev.map((c) => {
          if (c.type === 'video') {
            return {
              ...c,
              lumetri: {
                ...c.lumetri,
                lutPreset: result.lumetriPreset,
                saturation: result.lumetriPreset === 'cyberpunk' ? 140 : 120,
              },
            };
          }
          return c;
        })
      );
    }

    if (result.targetAspect) {
      setAspectRatio(result.targetAspect as AspectRatio);
      // If 9:16, punch in 1.35x zoom on video clips
      if (result.targetAspect === '9:16') {
        setClips((prev) =>
          prev.map((c) => {
            if (c.type === 'video') {
              return { ...c, panCrop: { ...c.panCrop, zoom: 1.35 } };
            }
            return c;
          })
        );
      }
    }

    if (result.captionStyle) {
      handleApplyCapCutAction(`CAPTIONS_${result.captionStyle.toUpperCase()}`);
    }

    if (result.actionType === 'AUTO_CUT_SILENCES') {
      handleApplyCapCutAction('AUTO_CUT_SILENCES');
    }

    if (result.actionType === 'VEGAS_SPEED_RAMP') {
      handleApplyCapCutAction('SPEED_RAMP_BULLET');
    }
  };

  // Branch switching
  const handleSelectBranch = (branchId: string) => {
    setCurrentBranch(branchId);
    if (branchId === 'b-social') {
      setAspectRatio('9:16');
      handleApplyCapCutAction('CAPTIONS_HORMOZI');
    } else if (branchId === 'b-directors') {
      setAspectRatio('16:9');
    } else {
      setAspectRatio('16:9');
    }
  };

  // Create new branch
  const handleCreateBranch = (name: string, description: string) => {
    const newB: ProjectBranch = {
      id: `b-${Date.now().toString(36)}`,
      name,
      description,
      author: 'Carlos Mendez',
      lastModified: 'Just now',
      commitHash: Math.random().toString(36).substring(2, 9),
      clipCount: clips.length,
      changesSummary: 'Branched from current timeline state',
    };
    setBranches((prev) => [...prev, newB]);
    setCurrentBranch(newB.id);
  };

  // Create commit
  const handleCreateCommit = (message: string) => {
    const newC: ProjectCommit = {
      hash: Math.random().toString(36).substring(2, 9),
      message,
      author: 'Carlos Mendez',
      timestamp: 'Just now',
      branch: branches.find((b) => b.id === currentBranch)?.name || 'main',
      diffSummary: `Snapshot created with ${clips.length} active timeline clips and Lumetri color states.`,
    };
    setCommits((prev) => [newC, ...prev]);
  };

  // Apply AI Keyframe Assist Motion Curve Result
  const handleApplyKeyframeAssist = (clipId: string, result: MotionCurveResult, applyToAll?: boolean) => {
    setClips((prev) =>
      prev.map((c) => {
        if (applyToAll ? c.type === 'video' : c.id === clipId) {
          return {
            ...c,
            motionKeyframes: result.keyframes,
            activeMotionPreset: result.motionTitle,
          };
        }
        return c;
      })
    );
  };

  // Master Proxy Mode Toggle Handler: ensures smooth real-time playback on the timeline
  const handleToggleProxyMode = (active: boolean) => {
    setIsProxyModeActive(active);
    setClips((prev) =>
      prev.map((c) => {
        if (c.type === 'video') {
          return {
            ...c,
            isProxyActive: active,
            hasProxy: true,
            proxySrc: active ? c.src : undefined,
          };
        }
        return c;
      })
    );
  };

  // AI Audio Cleanup & De-Hum Handlers
  const handleOpenAudioCleanup = (clipId?: string) => {
    if (clipId) {
      setAudioCleanupClipId(clipId);
      setSelectedClipId(clipId);
    } else if (selectedClipId) {
      setAudioCleanupClipId(selectedClipId);
    } else {
      const firstAudio = clips.find((c) => c.type === 'audio' || c.trackId.startsWith('track-a'));
      if (firstAudio) {
        setAudioCleanupClipId(firstAudio.id);
        setSelectedClipId(firstAudio.id);
      }
    }
    setIsAudioCleanupModalOpen(true);
  };

  const handleUpdateSingleClip = (updatedClip: TimelineClip) => {
    setClips((prev) => prev.map((c) => (c.id === updatedClip.id ? updatedClip : c)));
  };

  // AI Color Match Handlers
  const handleOpenColorMatch = (clipId?: string) => {
    if (clipId) {
      setSelectedClipId(clipId);
    }
    setIsColorMatchModalOpen(true);
  };

  // AI Auto-Scene Splitter Handlers
  const handleOpenSceneSplitter = (clipId?: string) => {
    if (clipId) {
      setSceneSplitterClipId(clipId);
      setSelectedClipId(clipId);
    } else if (selectedClipId) {
      setSceneSplitterClipId(selectedClipId);
    } else {
      const firstVideo = clips.find((c) => c.type === 'video');
      if (firstVideo) {
        setSceneSplitterClipId(firstVideo.id);
        setSelectedClipId(firstVideo.id);
      }
    }
    setIsSceneSplitterModalOpen(true);
  };

  const handleAddSceneMarkers = (newMarkers: TimelineMarker[]) => {
    setMarkers((prev) => {
      const filtered = prev.filter((m) => m.type !== 'scene_cut');
      return [...filtered, ...newMarkers].sort((a, b) => a.time - b.time);
    });
  };

  const handleSplitClipAtScenes = (targetClipId: string, cutTimes: number[]) => {
    const clipToSplit = clips.find((c) => c.id === targetClipId);
    if (!clipToSplit || cutTimes.length === 0) return;

    // Filter cuts that strictly sit within the clip bounds
    const validCuts = cutTimes
      .filter((t) => t > clipToSplit.startTime + 0.1 && t < clipToSplit.startTime + clipToSplit.duration - 0.1)
      .sort((a, b) => a - b);

    if (validCuts.length === 0) return;

    const newSubclips: TimelineClip[] = [];
    let currentStart = clipToSplit.startTime;
    let currentOffset = clipToSplit.offsetTime;

    validCuts.forEach((cutTime, index) => {
      const subclipDuration = Number((cutTime - currentStart).toFixed(2));
      newSubclips.push({
        ...clipToSplit,
        id: `clip-sc-${clipToSplit.id}-${index + 1}-${Date.now().toString(36)}`,
        title: `${clipToSplit.title} [Toma ${index + 1}]`,
        startTime: currentStart,
        duration: subclipDuration,
        offsetTime: currentOffset,
      });

      currentStart = cutTime;
      currentOffset = currentOffset + subclipDuration;
    });

    const lastDuration = Number(((clipToSplit.startTime + clipToSplit.duration) - currentStart).toFixed(2));
    newSubclips.push({
      ...clipToSplit,
      id: `clip-sc-${clipToSplit.id}-${validCuts.length + 1}-${Date.now().toString(36)}`,
      title: `${clipToSplit.title} [Toma ${validCuts.length + 1}]`,
      startTime: currentStart,
      duration: lastDuration,
      offsetTime: currentOffset,
    });

    const updatedClips = clips.flatMap((c) => (c.id === targetClipId ? newSubclips : [c]));
    setClips(updatedClips);
    if (newSubclips.length > 0) {
      setSelectedClipId(newSubclips[0].id);
    }
  };

  // AI Transition Suggest Handlers
  const handleOpenTransitionSuggest = (cutTime?: number, clipAId?: string, clipBId?: string) => {
    setTransitionCutTime(cutTime);
    if (clipAId) setSelectedClipId(clipAId);
    setIsTransitionModalOpen(true);
  };

  const handleApplyTransition = (transition: AppliedTransition) => {
    setAppliedTransitions((prev) => {
      const filtered = prev.filter(
        (t) => !(t.fromClipId === transition.fromClipId && t.toClipId === transition.toClipId) && Math.abs(t.cutTime - transition.cutTime) >= 0.2
      );
      return [...filtered, transition];
    });

    setClips((prevClips) =>
      prevClips.map((c) => (c.id === transition.toClipId ? { ...c, transitionIn: transition } : c))
    );
  };

  const handleBatchApplyTransitions = (newTransitions: AppliedTransition[]) => {
    setAppliedTransitions(newTransitions);
    setClips((prevClips) =>
      prevClips.map((c) => {
        const matching = newTransitions.find((t) => t.toClipId === c.id);
        return matching ? { ...c, transitionIn: matching } : c;
      })
    );
  };

  const handleRemoveTransition = (cutTime: number, fromClipId: string, toClipId: string) => {
    setAppliedTransitions((prev) =>
      prev.filter(
        (t) => !(t.fromClipId === fromClipId && t.toClipId === toClipId) && Math.abs(t.cutTime - cutTime) >= 0.2
      )
    );
    setClips((prevClips) =>
      prevClips.map((c) => (c.id === toClipId ? { ...c, transitionIn: undefined } : c))
    );
  };

  // ==========================================
  // AI BEAT ALIGNMENT & TRANSIENT SNAPPING
  // ==========================================
  const handleOpenBeatAlignment = (clipId?: string) => {
    if (clipId) {
      setBeatAlignmentAudioClipId(clipId);
      setSelectedClipId(clipId);
    } else if (selectedClipId && clips.some((c) => c.id === selectedClipId && c.type === 'audio')) {
      setBeatAlignmentAudioClipId(selectedClipId);
    } else {
      const firstAudio = clips.find((c) => c.type === 'audio');
      if (firstAudio) {
        setBeatAlignmentAudioClipId(firstAudio.id);
        setSelectedClipId(firstAudio.id);
      }
    }
    setIsBeatAlignmentModalOpen(true);
  };

  const handleAddBeatMarkers = (newMarkers: TimelineMarker[], clearExisting = true) => {
    setMarkers((prev) => {
      const remaining = clearExisting ? prev.filter((m) => m.type !== 'beat') : prev;
      return [...remaining, ...newMarkers].sort((a, b) => a.time - b.time);
    });
  };

  const handleSnapVideoCutsToBeats = (beatTimes: number[]) => {
    if (beatTimes.length === 0) return;
    const sortedBeats = [...beatTimes].sort((a, b) => a - b);

    let snappedCount = 0;
    const updatedClips = clips.map((clip) => {
      if (clip.type !== 'video') return clip;

      // Find closest beat to clip.startTime (if not at 0)
      let newStart = clip.startTime;
      if (clip.startTime > 0.1) {
        const closestStart = sortedBeats.reduce((prev, curr) =>
          Math.abs(curr - clip.startTime) < Math.abs(prev - clip.startTime) ? curr : prev
        );
        if (Math.abs(closestStart - clip.startTime) < 1.2) {
          newStart = Number(closestStart.toFixed(2));
          snappedCount++;
        }
      }

      // Find closest beat to clip end (startTime + duration)
      const clipEnd = clip.startTime + clip.duration;
      const closestEnd = sortedBeats.reduce((prev, curr) =>
        Math.abs(curr - clipEnd) < Math.abs(prev - clipEnd) ? curr : prev
      );

      let newDuration = clip.duration;
      if (Math.abs(closestEnd - clipEnd) < 1.2 && closestEnd > newStart + 0.5) {
        newDuration = Number((closestEnd - newStart).toFixed(2));
        snappedCount++;
      } else if (newStart !== clip.startTime) {
        newDuration = Number((clipEnd - newStart).toFixed(2));
      }

      return {
        ...clip,
        startTime: Math.max(0, newStart),
        duration: Math.max(0.5, newDuration),
      };
    });

    setClips(updatedClips);
    setRippleNotification(
      `⚡ Sincronización rítmica: ${snappedCount} puntos de corte de vídeo alineados con precisión a los transitorios musicales.`
    );
  };

  // ==========================================
  // MULTI-CAM WAVEFORM & ACOUSTIC SYNC
  // ==========================================
  const handleOpenMultiCamSync = (clipIds?: string[]) => {
    if (clipIds && clipIds.length > 0) {
      setSelectedClipIds(clipIds);
    } else if (selectedClipId) {
      setSelectedClipIds([selectedClipId]);
    }
    setIsMultiCamSyncOpen(true);
  };

  const handleApplyMultiCamSync = (updatedClips: TimelineClip[], summary: string) => {
    setClips(updatedClips);
    setMultiCamNotification(`🎬 Sincronización Multi-Cámara: ${summary}`);
    setTimeout(() => setMultiCamNotification(null), 5000);
  };

  const handleLoadMultiCamDemoPreset = () => {
    const demoClips: TimelineClip[] = [
      {
        id: 'multicam-cam-a',
        trackId: 'track-v1',
        title: 'CAM A - Keynote Speaker Wide (Master 4K)',
        type: 'video',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=80',
        startTime: 0.0,
        duration: 9.5,
        offsetTime: 0,
        sourceDuration: 15.0,
        color: '#0284c7',
        volumeEnvelope: [],
        opacityEnvelope: [],
        velocityEnvelope: [],
        panCrop: { zoom: 1.0, panX: 0, panY: 0, rotation: 0 },
        lumetri: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, temperature: 0, tint: 0, saturation: 100, vibrance: 0, lutPreset: 'warm_cinema' },
        audioGain: 0,
      },
      {
        id: 'multicam-cam-b',
        trackId: 'track-v2',
        title: 'CAM B - Keynote Close-Up Stage (Drift +1.42s)',
        type: 'video',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=500&auto=format&fit=crop&q=80',
        startTime: 1.42,
        duration: 8.5,
        offsetTime: 0.5,
        sourceDuration: 15.0,
        color: '#8b5cf6',
        volumeEnvelope: [],
        opacityEnvelope: [],
        velocityEnvelope: [],
        panCrop: { zoom: 1.2, panX: 0, panY: 0, rotation: 0 },
        lumetri: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, temperature: 0, tint: 0, saturation: 100, vibrance: 0, lutPreset: 'teal_orange' },
        audioGain: -2,
      },
      {
        id: 'multicam-cam-c',
        trackId: 'track-v3',
        title: 'CAM C - Audience & Side Profile (Drift +0.85s)',
        type: 'video',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format&fit=crop&q=80',
        startTime: 0.85,
        duration: 9.0,
        offsetTime: 0,
        sourceDuration: 12.0,
        color: '#ec4899',
        volumeEnvelope: [],
        opacityEnvelope: [],
        velocityEnvelope: [],
        panCrop: { zoom: 1.05, panX: -2, panY: 0, rotation: 0 },
        lumetri: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, temperature: 0, tint: 0, saturation: 100, vibrance: 0, lutPreset: 'cyberpunk' },
        audioGain: -4,
      },
    ];

    setClips((prev) => [
      ...demoClips,
      ...prev.filter((c) => c.type !== 'video' || (c.id !== 'multicam-cam-a' && c.id !== 'multicam-cam-b' && c.id !== 'multicam-cam-c'))
    ]);
    setSelectedClipIds(['multicam-cam-a', 'multicam-cam-b', 'multicam-cam-c']);
    setMultiCamNotification('¡Pack Demo Multi-Cámara cargado! 3 cámaras con audio preparadas para sincronización.');
    setTimeout(() => setMultiCamNotification(null), 5000);
  };

  // ==========================================
  // RIPPLE EDIT MODE LOGIC (Sync across tracks)
  // ==========================================
  const handleDeleteClip = (clipId: string, forceRipple?: boolean) => {
    const target = clips.find((c) => c.id === clipId);
    if (!target) return;

    const useRipple = forceRipple !== undefined ? forceRipple : isRippleEditMode;
    const clipStart = target.startTime;
    const clipDuration = target.duration;
    const clipEnd = Number((clipStart + clipDuration).toFixed(3));
    const lockedTrackIds = new Set(tracks.filter((t) => t.isLocked).map((t) => t.id));

    if (useRipple) {
      // 1. Shift all subsequent clips across ALL unlocked tracks left by clipDuration
      let shiftedCount = 0;
      const updatedClips = clips
        .filter((c) => c.id !== clipId)
        .map((c) => {
          if (!lockedTrackIds.has(c.trackId) && c.startTime >= clipEnd - 0.02) {
            shiftedCount++;
            return {
              ...c,
              startTime: Math.max(0, Number((c.startTime - clipDuration).toFixed(3))),
            };
          }
          return c;
        });

      // 2. Shift subsequent markers
      setMarkers((prevMarkers) =>
        prevMarkers.map((m) => {
          if (m.time >= clipEnd - 0.02) {
            return {
              ...m,
              time: Math.max(0, Number((m.time - clipDuration).toFixed(3))),
            };
          }
          return m;
        })
      );

      // 3. Clean up and shift transitions
      setAppliedTransitions((prevTrans) =>
        prevTrans
          .filter((t) => t.fromClipId !== clipId && t.toClipId !== clipId)
          .map((t) => {
            if (t.cutTime >= clipEnd - 0.02) {
              return {
                ...t,
                cutTime: Math.max(0, Number((t.cutTime - clipDuration).toFixed(3))),
              };
            }
            return t;
          })
      );

      setClips(updatedClips);

      // 4. Update timeline duration
      const maxEnd = updatedClips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0);
      setDuration(Math.max(12, Number((maxEnd + 2.0).toFixed(1))));

      // 5. Adjust playhead if inside deleted region
      if (currentTime > clipStart) {
        setCurrentTime(Math.max(0, Number((currentTime - clipDuration).toFixed(2))));
      }

      setRippleNotification(
        `⚡ Ripple Deleted "${target.title}" (-${clipDuration.toFixed(1)}s): ${shiftedCount} clips desplazados en todas las pistas para mantener sincronía perfecta.`
      );
    } else {
      // Standard Lift Delete (leaves gap)
      const updatedClips = clips.filter((c) => c.id !== clipId);
      setAppliedTransitions((prevTrans) =>
        prevTrans.filter((t) => t.fromClipId !== clipId && t.toClipId !== clipId)
      );
      setClips(updatedClips);
      setRippleNotification(`🗑️ Clip "${target.title}" eliminado (modo estándar: hueco conservado).`);
    }

    if (selectedClipId === clipId) {
      setSelectedClipId(null);
    }
  };

  const handleResizeClip = (
    clipId: string,
    edge: 'left' | 'right',
    deltaSeconds: number,
    forceRipple?: boolean
  ) => {
    const target = clips.find((c) => c.id === clipId);
    if (!target) return;

    const useRipple = forceRipple !== undefined ? forceRipple : isRippleEditMode;
    const lockedTrackIds = new Set(tracks.filter((t) => t.isLocked).map((t) => t.id));

    if (edge === 'right') {
      const originalEnd = Number((target.startTime + target.duration).toFixed(3));
      const maxSource = target.sourceDuration ? Math.max(target.sourceDuration, 30) : 60;
      const rawNewDuration = Math.max(0.3, target.duration + deltaSeconds);
      const newDuration = Number(Math.min(maxSource, rawNewDuration).toFixed(3));
      const actualDelta = Number((newDuration - target.duration).toFixed(3));

      if (Math.abs(actualDelta) < 0.01) return;

      if (useRipple) {
        let shiftedCount = 0;
        const updatedClips = clips.map((c) => {
          if (c.id === clipId) {
            return { ...c, duration: newDuration };
          }
          if (!lockedTrackIds.has(c.trackId) && c.startTime >= originalEnd - 0.02) {
            shiftedCount++;
            return {
              ...c,
              startTime: Math.max(0, Number((c.startTime + actualDelta).toFixed(3))),
            };
          }
          return c;
        });

        // Shift markers after cut point
        setMarkers((prevMarkers) =>
          prevMarkers.map((m) => {
            if (m.time >= originalEnd - 0.02) {
              return {
                ...m,
                time: Math.max(0, Number((m.time + actualDelta).toFixed(3))),
              };
            }
            return m;
          })
        );

        // Shift transitions after cut point
        setAppliedTransitions((prevTrans) =>
          prevTrans.map((t) => {
            if (t.fromClipId === clipId) {
              return { ...t, cutTime: Number((t.cutTime + actualDelta).toFixed(3)) };
            }
            if (t.cutTime >= originalEnd - 0.02) {
              return { ...t, cutTime: Math.max(0, Number((t.cutTime + actualDelta).toFixed(3))) };
            }
            return t;
          })
        );

        setClips(updatedClips);
        const maxEnd = updatedClips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0);
        setDuration(Math.max(12, Number((maxEnd + 2.0).toFixed(1))));

        setRippleNotification(
          `⚡ Ripple Trim Out [${actualDelta > 0 ? '+' : ''}${actualDelta.toFixed(1)}s]: ${shiftedCount} clips sincronizados en todas las pistas.`
        );
      } else {
        const updatedClips = clips.map((c) => (c.id === clipId ? { ...c, duration: newDuration } : c));
        setClips(updatedClips);
        setRippleNotification(`✂️ Trim Out: "${target.title}" ajustado a ${newDuration.toFixed(1)}s.`);
      }
    } else {
      // Trimming left edge (Trim In / head)
      const maxDelta = target.duration - 0.3;
      const clampedDelta = Math.min(maxDelta, deltaSeconds);
      const newDuration = Math.max(0.3, Number((target.duration - clampedDelta).toFixed(3)));
      const newOffsetTime = Math.max(0, Number(((target.offsetTime || 0) + clampedDelta).toFixed(3)));
      const actualDelta = Number((newDuration - target.duration).toFixed(3)); // negative if trimmed

      if (useRipple) {
        const originalEnd = Number((target.startTime + target.duration).toFixed(3));
        const updatedClips = clips.map((c) => {
          if (c.id === clipId) {
            return {
              ...c,
              duration: newDuration,
              offsetTime: newOffsetTime,
            };
          }
          if (!lockedTrackIds.has(c.trackId) && c.startTime >= originalEnd - 0.02) {
            return {
              ...c,
              startTime: Math.max(0, Number((c.startTime + actualDelta).toFixed(3))),
            };
          }
          return c;
        });

        setClips(updatedClips);
        const maxEnd = updatedClips.reduce((max, c) => Math.max(max, c.startTime + c.duration), 0);
        setDuration(Math.max(12, Number((maxEnd + 2.0).toFixed(1))));
        setRippleNotification(`⚡ Ripple Trim In: Recorte sincronizado en todas las pistas.`);
      } else {
        const newStartTime = Math.max(0, Number((target.startTime + clampedDelta).toFixed(3)));
        const updatedClips = clips.map((c) =>
          c.id === clipId
            ? { ...c, startTime: newStartTime, duration: newDuration, offsetTime: newOffsetTime }
            : c
        );
        setClips(updatedClips);
      }
    }
  };

  const handleCloseGap = (trackId?: string) => {
    // Automatically ripple closes all gaps between sequential clips on tracks
    let shiftedClips = [...clips];
    const tracksToProcess = trackId ? [trackId] : tracks.map((t) => t.id);

    tracksToProcess.forEach((tId) => {
      const trackClips = shiftedClips.filter((c) => c.trackId === tId).sort((a, b) => a.startTime - b.startTime);
      let cursor = 0;
      trackClips.forEach((c) => {
        if (c.startTime > cursor + 0.05) {
          const gap = c.startTime - cursor;
          shiftedClips = shiftedClips.map((item) =>
            item.id === c.id ? { ...item, startTime: cursor } : item
          );
          cursor += c.duration;
        } else {
          cursor = c.startTime + c.duration;
        }
      });
    });

    setClips(shiftedClips);
    setRippleNotification('⚡ Ripple Gap Close: Espacios en blanco eliminados con sincronización de pistas.');
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-[#070b14] text-slate-100 overflow-hidden font-sans">
      {/* 1. Header Bar */}
      <HeaderBar
        currentTab={currentTab}
        aspectRatio={aspectRatio}
        currentBranch={currentBranch}
        branches={branches}
        collaborators={collaborators}
        onSelectTab={setCurrentTab}
        onSelectAspectRatio={setAspectRatio}
        onSelectBranch={handleSelectBranch}
        onOpenAiPrompt={() => setIsAiModalOpen(true)}
        onOpenCloudRender={() => setCurrentTab('cloud_render')}
        onOpenAiTools={() => setIsAiToolsModalOpen(true)}
        onOpenVoiceoverStudio={() => setIsVoiceoverStudioOpen(true)}
        onOpenMediaLibrary={() => setIsMediaLibraryModalOpen(true)}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onSyncFirestore={handleSyncFirestore}
        lastCheckpointTime={lastCheckpointTime}
        onTriggerCheckpoint={() => handleTriggerCheckpoint(true)}
      />

      {/* 2. Main Workspace Body based on active tab */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Workspace: EDITING or COLOR (Default NLE View) */}
        {(currentTab === 'editing' || currentTab === 'color') && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Upper Work Area: Left Sidebar Inspector + Center Video Canvas Player */}
            <div className="flex-1 flex overflow-hidden">
              <LeftSidebar
                currentTab={currentTab}
                mediaAssets={mediaAssets}
                selectedClip={selectedClip}
                comments={comments}
                currentTime={currentTime}
                availableTracks={tracks}
                onAddMediaToTimeline={handleAddMediaToTimeline}
                onOpenFullMediaLibrary={() => setIsMediaLibraryModalOpen(true)}
                onUpdateClipLumetri={handleUpdateClipLumetri}
                onUpdateClipPanCrop={handleUpdateClipPanCrop}
                onApplyCapCutAction={handleApplyCapCutAction}
                onAddComment={handleAddComment}
                onToggleCommentStatus={handleToggleCommentStatus}
                onOpenKeyframeAssist={() => setIsAiModalOpen(true)}
                isProxyModeActive={isProxyModeActive}
                onOpenAudioCleanup={handleOpenAudioCleanup}
                onOpenColorMatch={() => handleOpenColorMatch()}
                onOpenSceneSplitter={() => handleOpenSceneSplitter()}
                onOpenTransitionSuggest={() => handleOpenTransitionSuggest()}
                isRippleEditMode={isRippleEditMode}
                onToggleRippleEditMode={setIsRippleEditMode}
                onDeleteClip={handleDeleteClip}
                onResizeClip={handleResizeClip}
                onCloseGap={handleCloseGap}
                onUpdateClipMotionBlur={handleUpdateClipMotionBlur}
                onOpenVoiceoverStudio={() => setIsVoiceoverStudioOpen(true)}
                onOpenBeatAlignment={() => handleOpenBeatAlignment()}
              />

              <VideoCanvasPlayer
                currentTime={currentTime}
                isPlaying={isPlaying}
                duration={duration}
                clips={clips}
                aspectRatio={aspectRatio}
                onTimeUpdate={setCurrentTime}
                onTogglePlay={handleTogglePlay}
                selectedClipId={selectedClipId}
                isProxyModeActive={isProxyModeActive}
                onToggleProxyMode={handleToggleProxyMode}
                appliedTransitions={appliedTransitions}
              />
            </div>

            {/* Lower Work Area: Hybrid Premiere + Vegas + CapCut Timeline */}
            <Timeline
              tracks={tracks}
              clips={clips}
              markers={markers}
              collaborators={collaborators}
              comments={comments}
              currentTime={currentTime}
              duration={duration}
              selectedClipId={selectedClipId}
              activeTool={activeTool}
              onSelectClip={setSelectedClipId}
              onTimeUpdate={setCurrentTime}
              onSetActiveTool={setActiveTool}
              onUpdateClips={setClips}
              onSplitClipAtPlayhead={handleSplitClipAtPlayhead}
              isProxyModeActive={isProxyModeActive}
              onToggleProxyMode={handleToggleProxyMode}
              onOpenAudioCleanup={handleOpenAudioCleanup}
              onOpenColorMatch={handleOpenColorMatch}
              onOpenSceneSplitter={() => handleOpenSceneSplitter()}
              appliedTransitions={appliedTransitions}
              onOpenTransitionSuggest={handleOpenTransitionSuggest}
              isRippleEditMode={isRippleEditMode}
              onToggleRippleEditMode={setIsRippleEditMode}
              onDeleteClip={handleDeleteClip}
              onResizeClip={handleResizeClip}
              onCloseGap={handleCloseGap}
              onOpenVoiceoverStudio={() => setIsVoiceoverStudioOpen(true)}
              onOpenBeatAlignment={handleOpenBeatAlignment}
              onSnapVideoCutsToBeats={handleSnapVideoCutsToBeats}
              onDropMediaAsset={handleDropMediaAsset}
              snapToNeighbors={snapToNeighbors}
              onToggleSnapToNeighbors={handleToggleSnapToNeighbors}
              selectedClipIds={selectedClipIds}
              onSelectMultipleClips={setSelectedClipIds}
              onOpenMultiCamSync={handleOpenMultiCamSync}
            />
          </div>
        )}

        {/* Workspace: AI Semantic Index & Search */}
        {currentTab === 'ai_indexing' && (
          <SemanticIndexingView
            mediaAssets={mediaAssets}
            currentTime={currentTime}
            onAddSegmentToTimeline={(asset, startIn, endOut) => {
              handleAddMediaToTimeline(asset);
              setCurrentTab('editing');
            }}
          />
        )}

        {/* Workspace: Text-Based Editing */}
        {currentTab === 'text_edit' && (
          <TextBasedEditingView
            clips={clips}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
            onUpdateClips={setClips}
          />
        )}

        {/* Workspace: Cloud Parallel Render Queue */}
        {currentTab === 'cloud_render' && (
          <CloudRenderView
            onStartNewRender={(preset, res) => {
              // Notification
            }}
            isProxyModeActive={isProxyModeActive}
            onToggleProxyMode={handleToggleProxyMode}
            timelineClips={clips}
            timelineDuration={duration}
          />
        )}

        {/* Workspace: Version Control & Git Branches */}
        {currentTab === 'version_control' && (
          <VersionControlView
            branches={branches}
            commits={commits}
            currentBranch={currentBranch}
            clips={clips}
            onSelectBranch={handleSelectBranch}
            onCreateBranch={handleCreateBranch}
            onCreateCommit={handleCreateCommit}
            lastCheckpointTime={lastCheckpointTime}
            onTriggerCheckpoint={() => handleTriggerCheckpoint(true)}
          />
        )}

        {/* Workspace: Parallel API Engine Playground */}
        {currentTab === 'api_pipeline' && <ApiPipelineView />}
      </main>

      {/* 3. Gemini AI Co-Pilot & Keyframe Assist Modal */}
      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        clips={clips}
        tracks={tracks}
        markers={markers}
        selectedClipId={selectedClipId}
        onApplyAiResult={handleApplyAiResult}
        onApplyKeyframeAssist={handleApplyKeyframeAssist}
      />

      {/* 4. AI Studio Generative Tools Modal (Veo 3, Live, Nano Banana, Lyria, Maps, Science, Mic) */}
      <AiStudioToolsModal
        isOpen={isAiToolsModalOpen}
        onClose={() => setIsAiToolsModalOpen(false)}
        onAddMediaToTimeline={handleAddMediaToTimeline}
      />

      {/* 5. AI Audio Cleanup & Neural De-Hum Modal */}
      <AudioCleanupModal
        isOpen={isAudioCleanupModalOpen}
        onClose={() => setIsAudioCleanupModalOpen(false)}
        clips={clips}
        selectedClipId={audioCleanupClipId || selectedClipId}
        onUpdateClip={handleUpdateSingleClip}
        onUpdateAllClips={setClips}
      />

      {/* 6. AI Color Match & Neural LUT Grading Modal */}
      <ColorMatchModal
        isOpen={isColorMatchModalOpen}
        onClose={() => setIsColorMatchModalOpen(false)}
        clips={clips}
        mediaAssets={mediaAssets}
        selectedClipId={selectedClipId}
        onUpdateClipLumetri={handleUpdateClipLumetri}
        onUpdateClip={handleUpdateSingleClip}
        onBatchUpdateClips={setClips}
      />

      {/* 7. AI Auto-Scene Splitter & Shot Cut Detection Modal */}
      <AutoSceneSplitterModal
        isOpen={isSceneSplitterModalOpen}
        onClose={() => setIsSceneSplitterModalOpen(false)}
        clips={clips}
        mediaAssets={mediaAssets}
        selectedClipId={sceneSplitterClipId || selectedClipId}
        onAddMarkers={handleAddSceneMarkers}
        onSplitClipAtScenes={handleSplitClipAtScenes}
        onSeekTime={setCurrentTime}
      />

      {/* 8. AI Transition Suggest & Scene Similarity Modal */}
      <AiTransitionSuggestModal
        isOpen={isTransitionModalOpen}
        onClose={() => setIsTransitionModalOpen(false)}
        clips={clips}
        selectedClipId={selectedClipId}
        onApplyTransition={handleApplyTransition}
        onBatchApplyTransitions={handleBatchApplyTransitions}
        onRemoveTransition={handleRemoveTransition}
        appliedTransitions={appliedTransitions}
        initialCutTime={transitionCutTime}
      />

      {/* 9. AI Voiceover Studio Modal (Generative TTS with Tone, Speed & Language) */}
      <AiVoiceoverStudioModal
        isOpen={isVoiceoverStudioOpen}
        onClose={() => setIsVoiceoverStudioOpen(false)}
        onAddAudioClipToTimeline={handleAddVoiceoverClip}
        currentTime={currentTime}
      />

      {/* 10. AI Beat Alignment & Peak Transient Snapping Modal */}
      <AiBeatAlignmentModal
        isOpen={isBeatAlignmentModalOpen}
        onClose={() => setIsBeatAlignmentModalOpen(false)}
        clips={clips}
        selectedClipId={beatAlignmentAudioClipId || selectedClipId}
        onAddMarkers={handleAddBeatMarkers}
        onSnapVideoCutsToBeats={handleSnapVideoCutsToBeats}
        onSeekTime={setCurrentTime}
      />

      {/* 11. AI Multi-Cam Audio Waveform Sync Modal */}
      <MultiCamSyncModal
        isOpen={isMultiCamSyncOpen}
        onClose={() => setIsMultiCamSyncOpen(false)}
        clips={clips}
        tracks={tracks}
        selectedClipIds={selectedClipIds}
        onApplySync={handleApplyMultiCamSync}
        onLoadMultiCamDemoPreset={handleLoadMultiCamDemoPreset}
      />

      {/* 12. Firebase Storage Cloud Media Library Modal */}
      {isMediaLibraryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="w-full max-w-5xl h-[88vh] max-h-[760px] bg-[#080d19] rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col">
            <MediaLibrary
              availableTracks={tracks}
              onAddMediaToTimeline={(asset, targetTrackId, startTime) => {
                if (targetTrackId && startTime !== undefined) {
                  handleDropMediaAsset(asset, targetTrackId, startTime);
                } else {
                  handleAddMediaToTimeline(asset, targetTrackId, startTime);
                }
              }}
              onClose={() => setIsMediaLibraryModalOpen(false)}
              onDockToSidebar={() => {
                setIsMediaLibraryModalOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Multi-Cam Sync Notification Toast */}
      {multiCamNotification && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#0f172a]/95 border border-indigo-400/70 text-indigo-100 px-4 py-2.5 rounded-lg shadow-2xl backdrop-blur-md flex items-center gap-3 animate-bounce text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
          <span>{multiCamNotification}</span>
        </div>
      )}

      {/* Ripple Edit Notification Toast */}
      {rippleNotification && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 bg-[#131b2c]/95 border border-amber-500/60 text-amber-200 px-4 py-2.5 rounded-lg shadow-2xl backdrop-blur-md flex items-center gap-3 animate-bounce text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>{rippleNotification}</span>
        </div>
      )}

      {/* Firestore Auto-Save Checkpoint Toast */}
      {autoSaveNotification && (
        <div className="fixed top-16 right-4 z-50 bg-[#06151f]/95 border border-cyan-500/60 text-cyan-200 px-3.5 py-2 rounded-lg shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs font-medium animate-fadeIn">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>{autoSaveNotification}</span>
        </div>
      )}
    </div>
  );
}
