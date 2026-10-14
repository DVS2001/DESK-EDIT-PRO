export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '21:9';

export type WorkspaceTab = 
  | 'editing' 
  | 'color' 
  | 'audio' 
  | 'text_edit' 
  | 'ai_indexing' 
  | 'cloud_render' 
  | 'version_control' 
  | 'api_pipeline';

export type ToolType = 'select' | 'razor' | 'ripple' | 'envelope' | 'slip' | 'hand' | 'text';

export interface EnvelopeKeyframe {
  id: string;
  timeOffset: number; // seconds relative to clip start
  value: number; // 0 to 100 for opacity/volume, 0.25 to 4.0 for velocity
}

export interface LumetriColorSettings {
  exposure: number; // -100 to 100
  contrast: number; // -100 to 100
  highlights: number; // -100 to 100
  shadows: number; // -100 to 100
  temperature: number; // -100 to 100 (cool to warm)
  tint: number; // -100 to 100 (green to magenta)
  saturation: number; // 0 to 200 (100 normal)
  vibrance: number; // -100 to 100
  lutPreset: 'none' | 'teal_orange' | 'cyberpunk' | 'warm_cinema' | 'bleach_bypass' | 'noir_bw' | 'vintage_70s';
}

export interface PanCropSettings {
  zoom: number; // 1.0 to 3.0
  panX: number; // -100 to 100%
  panY: number; // -100 to 100%
  rotation: number; // -180 to 180 deg
}

export interface MotionKeyframe {
  id: string;
  timeOffset: number; // relative seconds from clip start
  zoom: number; // e.g. 1.0 to 3.0
  panX: number; // -100% to 100%
  panY: number; // -100% to 100%
  rotation: number; // -180 to 180 deg
  easing: 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out' | 'bezier_s_curve' | 'elastic_whip' | 'exponential_slam';
  description?: string;
}

export interface MotionCurveResult {
  motionTitle: string;
  moodDescription: string;
  easingPreset: string;
  bezierCurveCss: string; // e.g. cubic-bezier(0.25, 0.1, 0.25, 1.0)
  keyframes: MotionKeyframe[];
  explanation: string;
  tags: string[];
}

export interface TranscriptWord {
  id: string;
  word: string;
  start: number;
  end: number;
  confidence: number;
  isDeleted?: boolean;
}

export interface TimelineClip {
  id: string;
  trackId: string;
  title: string;
  type: 'video' | 'audio' | 'text' | 'adjustment';
  src: string;
  thumbnail?: string;
  startTime: number; // start in timeline (seconds)
  duration: number; // duration in timeline (seconds)
  offsetTime: number; // offset from source media start
  sourceDuration: number;
  color?: string; // clip bar color
  
  // Vegas Pro features
  volumeEnvelope: EnvelopeKeyframe[];
  opacityEnvelope: EnvelopeKeyframe[];
  velocityEnvelope: EnvelopeKeyframe[]; // Vegas velocity curve (speed ramp)
  crossfadeStart?: number; // seconds of crossfade with previous clip
  crossfadeEnd?: number;
  panCrop: PanCropSettings;
  
  // Premiere Pro features
  lumetri: LumetriColorSettings;
  audioGain: number; // -48dB to +12dB
  
  // CapCut features
  captionText?: string;
  captionStyle?: 'hormozi' | 'mrbeast' | 'cyberpunk' | 'minimal' | 'karaoke';
  captionFontSize?: number;
  captionColor?: string;
  filterPreset?: string;
  
  // AI Keyframe Assist Motion Curves
  motionKeyframes?: MotionKeyframe[];
  activeMotionPreset?: string;
  
  // Text-based editing transcript
  transcript?: TranscriptWord[];

  // 4K Proxy Transcoding features
  hasProxy?: boolean;
  proxySrc?: string;
  isProxyActive?: boolean;
  originalResolution?: string;
  proxyMetadata?: {
    codec: 'ProRes 422 Proxy' | 'H.264 Fast Proxy' | 'DNxHR LB';
    resolution: string; // e.g. '1280x720'
    bitrate: string; // e.g. '8 Mbps'
    fileSizeMb: number;
    generatedAt: number;
    workerThreadId?: string;
  };

  // AI Audio Cleanup & De-Hum features
  audioCleanup?: AudioCleanupSettings;

  // AI Color Match features
  colorMatchInfo?: ColorMatchInfo;

  // AI Transition Suggest features
  transitionIn?: AppliedTransition;

  // AI Motion Blur features
  motionBlur?: MotionBlurSettings;

  // Multi-Cam Sync features
  multiCam?: {
    isSynced: boolean;
    cameraName: string;
    referenceClipId: string;
    timeOffset: number; // offset in seconds applied relative to master
    correlationConfidence: number; // 0-100%
    phaseAligned: boolean;
    syncedAt: number;
    angleIndex: number;
  };
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'text';
  isMuted: boolean;
  isSolo: boolean;
  isLocked: boolean;
  volume: number; // 0 to 100
  pan: number; // -100 (left) to 100 (right)
  height: number;
}

export interface TimelineMarker {
  id: string;
  time: number;
  label: string;
  color: string;
  type: 'beat' | 'chapter' | 'ai_note' | 'comment' | 'scene_cut';
  sceneIndex?: number;
  cutType?: 'hard_cut' | 'jump_cut' | 'dissolve' | 'match_cut' | 'whip_pan';
  confidence?: number;
  description?: string;
  clipId?: string;
  transientEnergy?: number;
  beatIndex?: number;
  isDownbeat?: boolean;
  frequencyBand?: 'sub_bass' | 'low_kick' | 'mid_snare' | 'high_transient';
}

export interface Collaborator {
  id: string;
  name: string;
  role: 'Director' | 'Lead Editor' | 'Sound Designer' | 'Colorist' | 'Client';
  avatar: string;
  color: string;
  currentPlayhead: number;
  activeTrackId?: string;
  isOnline: boolean;
}

export interface TimelineComment {
  id: string;
  author: string;
  avatar: string;
  time: number;
  text: string;
  status: 'open' | 'resolved';
  createdAt: string;
  replies?: Array<{ author: string; text: string; createdAt: string }>;
}

export interface ProjectBranch {
  id: string;
  name: string;
  description: string;
  author: string;
  lastModified: string;
  commitHash: string;
  clipCount: number;
  changesSummary: string;
}

export interface ProjectCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  branch: string;
  diffSummary: string;
  isCheckpoint?: boolean;
  snapshotClipCount?: number;
}

export interface CloudRenderJob {
  id: string;
  title: string;
  preset: 'H264_1080P' | 'PRORES_422HQ' | 'AV1_4K_HDR' | 'TIKTOK_VERTICAL_60FPS' | 'WEBM_ALPHA';
  resolution: string;
  fps: number;
  bitrate: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalChunks: number;
  completedChunks: number;
  estimatedTimeLeft: string;
  nodesAssigned: number;
  fileSizeBytes: number;
  downloadUrl?: string;
}

export interface MediaAsset {
  id: string;
  title: string;
  type: 'video' | 'audio' | 'broll' | 'graphics' | 'transcript';
  category?: 'Video' | 'Audio' | 'Graphics' | 'Transcripts';
  autoCategory?: 'Video' | 'Audio' | 'Graphics' | 'Transcripts';
  autoTags?: string[];
  url: string;
  proxyUrl?: string;
  hasProxy?: boolean;
  duration: number;
  resolution?: string;
  fps?: number;
  tags: string[];
  description: string;
  thumbnail: string;
  transcriptSample?: string;
  sizeBytes?: number;
  storagePath?: string;
  isCloudStored?: boolean;
  uploadedAt?: string;
  ownerId?: string;
  fileFormat?: string;
  mimeType?: string;
  firebaseMetadata?: {
    contentType?: string;
    size?: number;
    timeCreated?: string;
    updated?: string;
    customMetadata?: Record<string, string>;
    storageBucket?: string;
  };
}

export interface TranscodedProxyAsset {
  id: string;
  title: string;
  originalResolution: string;
  proxyResolution: string;
  originalBitrate: string;
  proxyBitrate: string;
  status: 'ready' | 'transcoding' | 'pending';
  progressPercent: number;
  fileSizeReduction: string;
}

export interface SpectralBandData {
  frequency: string;
  rawDb: number;
  cleanedDb: number;
  attenuationDb: number;
}

export interface AudioCleanupSettings {
  isEnabled: boolean;
  reductionDb: number; // e.g. -6 to -36 dB
  noiseReductionPercent: number; // 0 to 100%
  humRemoval: 'off' | '50hz' | '60hz' | 'both';
  deHiss: boolean;
  deReverbPercent: number; // 0 to 100%
  voiceClarityBoost: number; // 0 to 100%
  detectedNoiseType?: string;
  noiseFloorDb?: number; // e.g. -34.5 dBFS
  targetNoiseFloorDb?: number; // e.g. -58.2 dBFS
  snrImprovementDb?: number; // e.g. +23.7 dB
  spectralConfidence?: number;
  isBypassed?: boolean;
  harmonicsRemoved?: number[];
  spectralBands?: SpectralBandData[];
  explanation?: string;
  lastCleanedAt?: number;
}

export interface AudioCleanupResult {
  clipId: string;
  detectedNoiseType: string;
  noiseFloorDb: number;
  targetNoiseFloorDb: number;
  snrImprovementDb: number;
  spectralConfidence: number;
  humRemovalRecommended: 'off' | '50hz' | '60hz' | 'both';
  harmonicsDetected: number[];
  recommendedSettings: {
    reductionDb: number;
    noiseReductionPercent: number;
    humRemoval: 'off' | '50hz' | '60hz' | 'both';
    deHiss: boolean;
    deReverbPercent: number;
    voiceClarityBoost: number;
  };
  spectralBands: SpectralBandData[];
  explanation: string;
  dspFilterUrl?: string;
}

// AI Color Match Types & Interfaces
export interface ColorMatchSettings {
  preserveSkinTones: boolean;
  matchStrength: number; // 0 to 100%
  targetLumaMatch: boolean;
  chromaMatch: boolean;
  autoWhiteBalance: boolean;
}

export interface ColorMatchReference {
  id: string;
  type: 'clip' | 'preset' | 'upload' | 'media';
  title: string;
  thumbnailUrl: string;
  sourceDescription?: string;
  dominantColors?: string[];
  filmLookName?: string;
  category?: string;
}

export interface ThreeWayColorWheel {
  lift: { color: string; intensity: number; label?: string };   // shadows
  gamma: { color: string; intensity: number; label?: string };  // midtones
  gain: { color: string; intensity: number; label?: string };   // highlights
}

export interface ColorMatchResult {
  referenceTitle: string;
  referenceThumbnail?: string;
  lookName: string;
  matchConfidence: number; // e.g. 96 (%)
  matchedLumetri: LumetriColorSettings;
  originalLumetri: LumetriColorSettings;
  threeWayWheels: ThreeWayColorWheel;
  dominantPalette: {
    shadows: string;
    midtones: string;
    highlights: string;
    accent: string;
  };
  explanation: string;
  colorGradingRecipe: string[];
  scopesComparison: {
    refLumaAvg: number;
    targetLumaBefore: number;
    targetLumaAfter: number;
    colorTempShift: number;
    tintShift: number;
  };
}

export interface ColorMatchInfo {
  isMatched: boolean;
  referenceSource: string;
  matchedAt: number;
  lookName: string;
  matchStrength: number;
  confidence: number;
  palette: string[];
}

// AI Auto-Scene Splitter Types
export interface DetectedScene {
  id: string;
  sceneIndex: number;
  startTime: number; // clip relative (seconds)
  endTime: number;
  timelineStartTime: number; // timeline absolute (seconds)
  timelineEndTime: number;
  duration: number;
  sceneTitle: string;
  cutType: 'hard_cut' | 'jump_cut' | 'dissolve' | 'match_cut' | 'whip_pan';
  confidence: number;
  visualDescription: string;
  detectedLighting?: string;
  thumbnailColor?: string;
}

export interface SceneSplitterSettings {
  sensitivity: 'low' | 'medium' | 'high';
  minSceneDuration: number;
  detectTransitions: boolean;
  autoPlaceMarkers: boolean;
  autoSplitClips: boolean;
}

export interface SceneSplitterResult {
  clipId: string;
  clipTitle: string;
  totalScenesDetected: number;
  analysisSummary: string;
  suggestedBpm?: number;
  scenes: DetectedScene[];
  cutMarkers: TimelineMarker[];
}

// AI Transition Suggest & Scene Similarity Types
export type TransitionType = 
  | 'light_leak' 
  | 'zoom_blur' 
  | 'cross_dissolve' 
  | 'whip_pan' 
  | 'glitch' 
  | 'film_burn' 
  | 'luma_fade' 
  | 'hard_cut';

export interface TransitionParameters {
  intensity: number; // 0 to 100
  warmth?: number; // 0 to 100 (for light leak, film burn)
  blurAmount?: number; // 0 to 100 (for zoom blur, whip pan)
  direction?: 'in' | 'out' | 'left' | 'right';
  rgbSplit?: number; // 0 to 100 (for glitch)
}

export interface TransitionSuggestion {
  type: TransitionType;
  title: string;
  category: string;
  similarityScore: number; // 0-100%
  recommendedDuration: number; // in seconds (e.g. 0.8)
  recommendedEasing: 'ease_in_out' | 'exponential' | 'elastic' | 'linear';
  editorialReasoning: string;
  visualImpact: string;
  parameters: TransitionParameters;
  audioRecommendation?: string;
}

export interface TransitionSuggestResult {
  clipA: {
    id: string;
    title: string;
    src: string;
    thumbnail?: string;
    trackId: string;
    startTime: number;
    duration: number;
    endTime: number;
    visualAnalysis?: string;
    dominantTone?: string;
  };
  clipB: {
    id: string;
    title: string;
    src: string;
    thumbnail?: string;
    trackId: string;
    startTime: number;
    duration: number;
    endTime: number;
    visualAnalysis?: string;
    dominantTone?: string;
  };
  cutPointTime: number; // timestamp on timeline
  overallSimilarityScore: number; // 0-100
  similarityCategory: string; // e.g. "Dynamic Action Juxtaposition", "High Visual Continuity", "Thematic Shift"
  sceneJuxtapositionSummary: string;
  contrastMetrics: {
    lightingDelta: string;
    motionDelta: string;
    colorGamutDelta: string;
    pacingEnergy: string;
  };
  recommendedTransition: TransitionSuggestion;
  alternativeTransitions: TransitionSuggestion[];
}

export interface AppliedTransition {
  id: string;
  type: TransitionType;
  title: string;
  duration: number; // e.g. 0.8 seconds
  easing: 'ease_in_out' | 'exponential' | 'elastic' | 'linear';
  alignment: 'center' | 'start_on_cut' | 'end_on_cut';
  cutTime: number; // timeline cut point timestamp
  fromClipId: string;
  toClipId: string;
  parameters: TransitionParameters;
  similarityScore?: number;
  appliedAt?: number;
}

export interface CutPairInfo {
  cutTime: number;
  trackId: string;
  clipA: TimelineClip;
  clipB: TimelineClip;
  existingTransition?: AppliedTransition;
}

// AI Motion Blur types
export type MotionBlurMode = 'optical_flow' | 'directional' | 'rotational' | 'smart_auto';

export interface MotionBlurActionSegment {
  start: number;
  end: number;
  velocityRating: 'extreme' | 'high' | 'moderate';
  label: string;
}

export interface MotionBlurAnalysis {
  detectedPeakVelocity: number; // e.g. 840 px/s
  primaryMovementType: 'high_speed_action' | 'whip_pan' | 'rapid_tracking' | 'drone_flight' | 'steady_cam';
  recommendedShutterAngle: number; // 0 to 360
  recommendedBlurAmount: number; // 0 to 100
  sampleSteps?: number; // e.g. 16 or 24
  motionDirectionAngle: number; // 0 to 360 degrees
  motionVectorSummary: string;
  detectedActionSegments: MotionBlurActionSegment[];
  analyzedAt: number;
}

export interface MotionBlurSettings {
  isEnabled: boolean;
  shutterAngle: number; // 0 to 360 degrees (180 standard)
  sampleSteps: number; // 4 to 32 sub-frame samples
  blurAmount: number; // 0 to 100%
  motionSensitivity: number; // 0 to 100%
  blurMode: MotionBlurMode;
  motionDirection: number; // 0 to 360 degrees
  velocityThreshold: number; // threshold velocity in px/s or multiplier
  isBypassed?: boolean;
  aiAnalysis?: MotionBlurAnalysis;
}

// AI Beat Alignment & Transient Snapping types
export type BeatQuantizationMode = 'free_transients' | '1/4_notes' | '1/8_notes' | 'downbeats_only';

export interface BeatAlignmentSettings {
  sensitivity: 'low' | 'medium' | 'high' | 'ultra';
  transientThreshold: number; // 0 to 100% (energy threshold)
  minTransientSpacing: number; // seconds, e.g. 0.25 to 1.2
  quantization: BeatQuantizationMode;
  bpm: number; // 60 to 220
  autoDetectBpm: boolean;
  filterMode: 'all' | 'primary_beats' | 'downbeats_only';
  clearExistingBeatMarkers: boolean;
  autoSnapVideoCuts: boolean;
  accentuateDownbeats: boolean;
  markerColor: string;
}

export interface DetectedBeatTransient {
  id: string;
  time: number; // seconds relative to clip start
  timelineTime: number; // seconds in global timeline
  energy: number; // 0 to 100%
  type: 'downbeat' | 'beat' | 'snare' | 'drop' | 'transient';
  label: string;
  confidence: number; // 0 to 100%
  isPeak: boolean;
  frequencyBand: 'sub_bass' | 'low_kick' | 'mid_snare' | 'high_transient';
  measureIndex?: number;
  beatInMeasure?: number;
}

export interface BeatAlignmentResult {
  clipId: string;
  clipTitle: string;
  detectedBpm: number;
  timeSignature: string;
  musicalKey: string;
  rhythmStyle: string;
  totalTransientsDetected: number;
  downbeatsCount: number;
  averageConfidence: number;
  markers: TimelineMarker[];
  transients: DetectedBeatTransient[];
  waveformPoints: number[];
  transientEnergyCurve: number[];
  suggestedCutTimes: number[];
  musicalAnalysisSummary: string;
  analyzedAt: number;
}

// Magnet-Snapping & Neighbor Alignment types
export interface MagnetSnappingSettings {
  isEnabled: boolean;
  snapToNeighbors: boolean;
  snapToPlayhead: boolean;
  snapToMarkers: boolean;
  snapTolerancePx: number; // default 14-16px
}

export interface MagnetSnapFeedback {
  time: number;
  label: string;
  type: 'neighbor' | 'playhead' | 'beat' | 'scenecut' | 'marker';
  edge: 'start' | 'end';
  targetClipId?: string;
  distanceDiffSeconds: number;
}

// Multi-Cam Waveform Sync Types
export interface MultiCamAngle {
  clipId: string;
  clipTitle: string;
  trackId: string;
  cameraName: string; // e.g. "CAM A (Master)", "CAM B (Medium)", "CAM C (Profile)"
  color: string;
  thumbnail?: string;
  src: string;
  duration: number;
  originalStartTime: number;
  calculatedOffset: number; // seconds to shift relative to reference (e.g. +1.42s)
  newStartTime: number;
  correlationConfidence: number; // 0 to 100%
  phaseAligned: boolean;
  isReference: boolean;
  waveformPeaks: number[]; // normalized 0-1 peak heights for cross-correlation visualizer
  detectedClapTime?: number; // peak acoustic spike/clap time within clip (seconds)
  targetTrackId?: string;
}

export interface MultiCamSyncResult {
  referenceClipId: string;
  referenceCameraName: string;
  syncMethod: 'waveform' | 'clap_transient' | 'timecode';
  alignedClipsCount: number;
  averageCorrelation: number; // e.g. 97.4%
  angles: MultiCamAngle[];
  suggestedTrackAssignments: Record<string, string>; // clipId -> trackId
  commonTemporalReferencePoint: number; // timeline seconds anchor point
  summary: string;
  analyzedAt: number;
}

export interface MultiCamSyncSettings {
  syncMethod: 'waveform' | 'clap_transient' | 'timecode';
  referenceClipId: string; // 'auto' or specific clipId
  distributeTracks: boolean; // place angles onto parallel tracks (V1, V2, V3)
  muteNonReferenceAudio: boolean; // mute secondary cam mics
  searchWindowSeconds: number; // max offset search window (e.g. 10.0s)
  audioBandpassFilter: boolean; // filter out rumble <100Hz and hiss >8kHz
}

// Smart Proxy Manager Types
export type ProxyCodecProfile = 'prores_proxy' | 'h264_fast' | 'dnxhr_lb';

export interface ProxyScanItem {
  clipId: string;
  clipTitle: string;
  trackId: string;
  src: string;
  thumbnail?: string;
  duration: number;
  originalResolution: string; // e.g. '3840x2160 (4K UHD)'
  originalBitrate: string; // e.g. '95 Mbps'
  rawEstimatedSizeMb: number;
  hasProxy: boolean;
  proxySrc?: string;
  isProxyActive: boolean;
  status: 'missing' | 'queued' | 'transcoding' | 'ready' | 'error';
  progressPercent: number;
  encodingFps?: number;
  timeRemainingSec?: number;
  workerId?: string;
  proxyResolution: string; // e.g. '1280x720'
  proxyBitrate: string; // e.g. '8 Mbps ProRes'
  proxyEstimatedSizeMb: number;
}

export interface ProxyManagerSummary {
  totalVideoClips: number;
  missingProxyCount: number;
  readyProxyCount: number;
  transcodingCount: number;
  rawTotalSizeMb: number;
  proxyTotalSizeMb: number;
  savingsPercentage: number;
  isScanning: boolean;
  lastScannedAt: number;
}

