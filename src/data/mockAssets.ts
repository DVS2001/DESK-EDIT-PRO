import { MediaAsset, TimelineClip, TimelineTrack, TimelineMarker, Collaborator, TimelineComment, ProjectBranch, ProjectCommit } from '../types/editor';

export const INITIAL_MEDIA_ASSETS: MediaAsset[] = [
  {
    id: 'asset-1',
    title: 'A-Roll: Tech Founder Keynote',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    duration: 15.0,
    resolution: '3840x2160 (4K)',
    fps: 60,
    tags: ['interview', 'founder', 'technology', 'presentation', 'speech', 'conference'],
    description: 'Tech founder speaking passionately on stage about artificial intelligence revolution and future workflows.',
    thumbnail: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=80',
    transcriptSample: 'Artificial intelligence is fundamentally revolutionizing creative workflows. With neural parallel rendering and semantic video indexing, editors can move ten times faster without sacrificing frame precision.'
  },
  {
    id: 'asset-2',
    title: 'B-Roll: Tokyo Neon Cyberpunk Rain',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    duration: 15.0,
    resolution: '3840x2160 (4K)',
    fps: 120,
    tags: ['city', 'neon', 'night', 'cyberpunk', 'tokyo', 'rain', 'b-roll', 'cinematic'],
    description: 'High-framerate slow-motion shot of cyberpunk neon reflections on wet asphalt in Shinjuku.',
    thumbnail: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'asset-3',
    title: 'B-Roll: Alpine Drone Mountain Sunrise',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    duration: 12.0,
    resolution: '4096x2160 (DCI 4K)',
    fps: 60,
    tags: ['drone', 'landscape', 'mountains', 'sunrise', 'nature', 'aerial', 'epic'],
    description: 'Epic drone flyover above snowy mountain peaks during golden hour sunrise with atmospheric fog.',
    thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'asset-4',
    title: 'Action: Extreme Urban Skater Jump',
    type: 'video',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    duration: 15.0,
    resolution: '1920x1080',
    fps: 240,
    tags: ['action', 'sports', 'skateboard', 'speed ramp', 'urban', 'dynamic', 'kickflip'],
    description: 'Extreme sports skater performing high-speed staircase grind captured at 240fps for velocity ramping.',
    thumbnail: 'https://images.unsplash.com/photo-1520045892732-304bc3ac5d8e?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'asset-5',
    title: 'Music: Cinematic Cyberwave Synth',
    type: 'audio',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    duration: 45.0,
    tags: ['synthwave', 'cyberpunk', 'bass', 'beat', 'music', 'energetic', '128bpm'],
    description: 'High-energy 128 BPM electronic soundtrack with driving synth arpeggios and deep sub-bass.',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'asset-6',
    title: 'SFX: Cinematic Deep Impact & Riser',
    type: 'audio',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
    duration: 6.0,
    tags: ['sfx', 'riser', 'impact', 'whoosh', 'trailer', 'sub-bass'],
    description: 'Deep Hollywood-style sub-bass boom impact followed by a tension riser.',
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
    mimeType: 'audio/mp3',
    fileFormat: 'MP3',
    category: 'Audio',
    autoCategory: 'Audio'
  },
  {
    id: 'asset-7',
    title: 'Graphic: Neon Cyberpunk Lower Third & Title Overlay',
    type: 'graphics',
    category: 'Graphics',
    autoCategory: 'Graphics',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    duration: 6.0,
    resolution: '3840x2160 (Alpha PNG)',
    tags: ['graphics', 'lower-third', 'overlay', 'cyberpunk', 'title', 'alpha', 'motion-graphic'],
    description: 'Animated broadcast title card with transparent alpha channel and luminous neon gradients.',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
    mimeType: 'image/png',
    fileFormat: 'PNG',
    sizeBytes: 4200000,
    storagePath: 'gs://gen-lang-client-0877103276.firebasestorage.app/demo-vault/graphics/asset-7.png'
  },
  {
    id: 'asset-8',
    title: 'Graphic: Minimalist Callout & Vector Badge',
    type: 'graphics',
    category: 'Graphics',
    autoCategory: 'Graphics',
    url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=80',
    duration: 5.0,
    resolution: '1920x1080 (Vector SVG)',
    tags: ['graphics', 'callout', 'badge', 'logo', 'overlay', 'ui', 'motion-graphic'],
    description: 'Sharp vector callout badge with drop shadow and clean typography for UI demonstrations.',
    thumbnail: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=500&auto=format&fit=crop&q=80',
    mimeType: 'image/svg+xml',
    fileFormat: 'SVG',
    sizeBytes: 1850000,
    storagePath: 'gs://gen-lang-client-0877103276.firebasestorage.app/demo-vault/graphics/asset-8.svg'
  },
  {
    id: 'asset-9',
    title: 'Transcript: Keynote AI Revolution Subtitles (VTT/JSON)',
    type: 'transcript',
    category: 'Transcripts',
    autoCategory: 'Transcripts',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    duration: 15.0,
    resolution: 'Word-level Timestamps',
    tags: ['transcript', 'subtitles', 'captions', 'speech-to-text', 'whisper', 'english', 'dialogue'],
    description: 'High-accuracy neural speech-to-text transcript with millisecond timestamps and word confidence scores.',
    thumbnail: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=500&auto=format&fit=crop&q=80',
    transcriptSample: 'Artificial intelligence is fundamentally revolutionizing creative workflows. With neural parallel rendering and semantic video indexing, editors can move ten times faster without sacrificing frame precision.',
    mimeType: 'text/vtt',
    fileFormat: 'VTT',
    sizeBytes: 34000,
    storagePath: 'gs://gen-lang-client-0877103276.firebasestorage.app/demo-vault/transcripts/asset-9.vtt'
  },
  {
    id: 'asset-10',
    title: 'Transcript: Executive Interview & Tech Q&A Captions',
    type: 'transcript',
    category: 'Transcripts',
    autoCategory: 'Transcripts',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    duration: 12.0,
    resolution: 'Sentence-level SRT',
    tags: ['transcript', 'captions', 'interview', 'subtitles', 'speech', 'text', 'timestamped'],
    description: 'Bilingual dialogue captions with speaker diarization and automated tone metadata.',
    thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&auto=format&fit=crop&q=80',
    transcriptSample: 'The transition from sequential NLEs to distributed neural timeline engines represents the largest leap in editing history since linear tape.',
    mimeType: 'text/plain',
    fileFormat: 'SRT',
    sizeBytes: 28000,
    storagePath: 'gs://gen-lang-client-0877103276.firebasestorage.app/demo-vault/transcripts/asset-10.srt'
  }
];

export const INITIAL_TRACKS: TimelineTrack[] = [
  { id: 'track-v3', name: 'V3 - Titles & Captions', type: 'text', isMuted: false, isSolo: false, isLocked: false, volume: 100, pan: 0, height: 42 },
  { id: 'track-v2', name: 'V2 - B-Roll & VFX Overlays', type: 'video', isMuted: false, isSolo: false, isLocked: false, volume: 100, pan: 0, height: 58 },
  { id: 'track-v1', name: 'V1 - Master A-Roll Video', type: 'video', isMuted: false, isSolo: false, isLocked: false, volume: 100, pan: 0, height: 68 },
  { id: 'track-a1', name: 'A1 - Dialogue & Voiceover', type: 'audio', isMuted: false, isSolo: false, isLocked: false, volume: 92, pan: 0, height: 52 },
  { id: 'track-a2', name: 'A2 - Score & Background Music', type: 'audio', isMuted: false, isSolo: false, isLocked: false, volume: 68, pan: 0, height: 50 },
  { id: 'track-a3', name: 'A3 - Sound FX & Risers', type: 'audio', isMuted: false, isSolo: false, isLocked: false, volume: 80, pan: 0, height: 44 }
];

export const INITIAL_CLIPS: TimelineClip[] = [
  {
    id: 'clip-1',
    trackId: 'track-v1',
    title: 'Tech Founder Keynote 4K',
    type: 'video',
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=80',
    startTime: 0,
    duration: 7.5,
    offsetTime: 0,
    sourceDuration: 15.0,
    color: '#0284c7', // Sky Blue
    volumeEnvelope: [
      { id: 'v1-0', timeOffset: 0, value: 100 },
      { id: 'v1-1', timeOffset: 7.5, value: 100 }
    ],
    opacityEnvelope: [
      { id: 'op1-0', timeOffset: 0, value: 100 },
      { id: 'op1-1', timeOffset: 7.5, value: 100 }
    ],
    velocityEnvelope: [
      { id: 'vel1-0', timeOffset: 0, value: 1.0 },
      { id: 'vel1-1', timeOffset: 3.5, value: 1.0 },
      { id: 'vel1-2', timeOffset: 5.0, value: 1.3 },
      { id: 'vel1-3', timeOffset: 7.5, value: 1.0 }
    ],
    panCrop: { zoom: 1.05, panX: 0, panY: -2, rotation: 0 },
    lumetri: {
      exposure: 8,
      contrast: 14,
      highlights: -10,
      shadows: 6,
      temperature: 4,
      tint: -2,
      saturation: 110,
      vibrance: 12,
      lutPreset: 'warm_cinema'
    },
    audioGain: 0,
    transcript: [
      { id: 'w1', word: 'Artificial', start: 0.2, end: 0.7, confidence: 0.99 },
      { id: 'w2', word: 'intelligence', start: 0.8, end: 1.4, confidence: 0.98 },
      { id: 'w3', word: 'is', start: 1.5, end: 1.7, confidence: 0.99 },
      { id: 'w4', word: 'fundamentally', start: 1.8, end: 2.5, confidence: 0.97 },
      { id: 'w5', word: 'revolutionizing', start: 2.6, end: 3.4, confidence: 0.98 },
      { id: 'w6', word: 'creative', start: 3.6, end: 4.1, confidence: 0.99 },
      { id: 'w7', word: 'workflows.', start: 4.2, end: 4.9, confidence: 0.98 },
      { id: 'w8', word: 'With', start: 5.2, end: 5.5, confidence: 0.99 },
      { id: 'w9', word: 'neural', start: 5.6, end: 6.0, confidence: 0.96 },
      { id: 'w10', word: 'rendering', start: 6.1, end: 6.8, confidence: 0.98 }
    ]
  },
  {
    id: 'clip-2',
    trackId: 'track-v1',
    title: 'Drone Mountain Sunrise DCI',
    type: 'video',
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&auto=format&fit=crop&q=80',
    startTime: 7.5,
    duration: 8.0,
    offsetTime: 1.0,
    sourceDuration: 12.0,
    color: '#0284c7',
    crossfadeStart: 0.8, // Vegas Pro crossfade transition with clip-1
    volumeEnvelope: [
      { id: 'v2-0', timeOffset: 0, value: 100 },
      { id: 'v2-1', timeOffset: 8.0, value: 100 }
    ],
    opacityEnvelope: [
      { id: 'op2-0', timeOffset: 0, value: 100 },
      { id: 'op2-1', timeOffset: 8.0, value: 100 }
    ],
    velocityEnvelope: [
      { id: 'vel2-0', timeOffset: 0, value: 1.0 },
      { id: 'vel2-1', timeOffset: 8.0, value: 1.0 }
    ],
    panCrop: { zoom: 1.0, panX: 0, panY: 0, rotation: 0 },
    lumetri: {
      exposure: 0,
      contrast: 18,
      highlights: -15,
      shadows: 10,
      temperature: 15,
      tint: 4,
      saturation: 125,
      vibrance: 20,
      lutPreset: 'teal_orange'
    },
    audioGain: -2
  },
  {
    id: 'clip-3',
    trackId: 'track-v2',
    title: 'B-Roll Tokyo Cyberpunk Cut',
    type: 'video',
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=500&auto=format&fit=crop&q=80',
    startTime: 3.2,
    duration: 3.8,
    offsetTime: 0.5,
    sourceDuration: 15.0,
    color: '#8b5cf6', // Violet
    volumeEnvelope: [
      { id: 'v3-0', timeOffset: 0, value: 0 },
      { id: 'v3-1', timeOffset: 3.8, value: 0 }
    ],
    opacityEnvelope: [
      { id: 'op3-0', timeOffset: 0, value: 0 },
      { id: 'op3-1', timeOffset: 0.4, value: 100 },
      { id: 'op3-2', timeOffset: 3.4, value: 100 },
      { id: 'op3-3', timeOffset: 3.8, value: 0 }
    ],
    velocityEnvelope: [
      { id: 'vel3-0', timeOffset: 0, value: 1.8 },
      { id: 'vel3-1', timeOffset: 1.2, value: 0.5 }, // Matrix bullet-time ramp
      { id: 'vel3-2', timeOffset: 2.8, value: 2.2 }
    ],
    panCrop: { zoom: 1.15, panX: 2, panY: 0, rotation: 0 },
    lumetri: {
      exposure: 5,
      contrast: 25,
      highlights: 10,
      shadows: -15,
      temperature: -20,
      tint: 18,
      saturation: 140,
      vibrance: 30,
      lutPreset: 'cyberpunk'
    },
    audioGain: -12
  },
  {
    id: 'clip-4',
    trackId: 'track-v3',
    title: 'CapCut Auto-Caption: REVOLUTIONIZING',
    type: 'text',
    src: '',
    captionText: 'REVOLUTIONIZING CREATIVE WORKFLOWS 🚀',
    captionStyle: 'hormozi',
    captionFontSize: 34,
    captionColor: '#fbbf24', // Hormozi bold yellow
    startTime: 2.5,
    duration: 3.0,
    offsetTime: 0,
    sourceDuration: 3.0,
    color: '#ec4899', // Pink
    volumeEnvelope: [],
    opacityEnvelope: [
      { id: 'op4-0', timeOffset: 0, value: 100 },
      { id: 'op4-1', timeOffset: 3.0, value: 100 }
    ],
    velocityEnvelope: [],
    panCrop: { zoom: 1.0, panX: 0, panY: 0, rotation: 0 },
    lumetri: {
      exposure: 0, contrast: 0, highlights: 0, shadows: 0,
      temperature: 0, tint: 0, saturation: 100, vibrance: 0, lutPreset: 'none'
    },
    audioGain: 0
  },
  {
    id: 'clip-a1',
    trackId: 'track-a1',
    title: 'Dialogue: Founder Boom Mic (60Hz Hum & HVAC)',
    type: 'audio',
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    startTime: 0,
    duration: 7.5,
    offsetTime: 0,
    sourceDuration: 15.0,
    color: '#0d9488', // Teal
    volumeEnvelope: [
      { id: 'va1-0', timeOffset: 0, value: 92 },
      { id: 'va1-1', timeOffset: 7.5, value: 92 }
    ],
    opacityEnvelope: [],
    velocityEnvelope: [],
    panCrop: { zoom: 1.0, panX: 0, panY: 0, rotation: 0 },
    lumetri: {
      exposure: 0, contrast: 0, highlights: 0, shadows: 0,
      temperature: 0, tint: 0, saturation: 100, vibrance: 0, lutPreset: 'none'
    },
    audioGain: 1,
    audioCleanup: {
      isEnabled: true,
      reductionDb: -20,
      noiseReductionPercent: 85,
      humRemoval: '60hz',
      deHiss: true,
      deReverbPercent: 35,
      voiceClarityBoost: 65,
      detectedNoiseType: '60Hz Mains Ground Hum & HVAC Fan Whine',
      noiseFloorDb: -34.8,
      targetNoiseFloorDb: -58.4,
      snrImprovementDb: 23.6,
      spectralConfidence: 0.98,
      harmonicsRemoved: [60, 120, 180, 240],
      isBypassed: false,
      explanation: 'Filtro Notch Q=22 suprimió el bucle de tierra de 60Hz y sus armónicos. Sustracción espectral redujo el ruido ambiente HVAC en 23.6 dB manteniendo intactas las resonancias vocales naturales.',
      lastCleanedAt: Date.now() - 3600000,
    }
  },
  {
    id: 'clip-5',
    trackId: 'track-a2',
    title: 'Cyber Synthwave Score (128 BPM)',
    type: 'audio',
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    startTime: 0,
    duration: 15.5,
    offsetTime: 0,
    sourceDuration: 45.0,
    color: '#10b981', // Emerald
    volumeEnvelope: [
      { id: 'va2-0', timeOffset: 0, value: 40 },
      { id: 'va2-1', timeOffset: 1.0, value: 75 },
      { id: 'va2-2', timeOffset: 3.0, value: 35 }, // Auto-ducking for speech
      { id: 'va2-3', timeOffset: 7.5, value: 85 }, // Swell during B-roll
      { id: 'va2-4', timeOffset: 14.5, value: 20 },
      { id: 'va2-5', timeOffset: 15.5, value: 0 }
    ],
    opacityEnvelope: [],
    velocityEnvelope: [],
    panCrop: { zoom: 1.0, panX: 0, panY: 0, rotation: 0 },
    lumetri: {
      exposure: 0, contrast: 0, highlights: 0, shadows: 0,
      temperature: 0, tint: 0, saturation: 100, vibrance: 0, lutPreset: 'none'
    },
    audioGain: -6
  },
  {
    id: 'clip-6',
    trackId: 'track-a3',
    title: 'Hollywood Riser Impact SFX',
    type: 'audio',
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
    startTime: 2.8,
    duration: 4.5,
    offsetTime: 0,
    sourceDuration: 6.0,
    color: '#f59e0b', // Amber
    volumeEnvelope: [
      { id: 'va3-0', timeOffset: 0, value: 20 },
      { id: 'va3-1', timeOffset: 3.2, value: 95 },
      { id: 'va3-2', timeOffset: 4.5, value: 0 }
    ],
    opacityEnvelope: [],
    velocityEnvelope: [],
    panCrop: { zoom: 1.0, panX: 0, panY: 0, rotation: 0 },
    lumetri: {
      exposure: 0, contrast: 0, highlights: 0, shadows: 0,
      temperature: 0, tint: 0, saturation: 100, vibrance: 0, lutPreset: 'none'
    },
    audioGain: 2
  }
];

export const INITIAL_MARKERS: TimelineMarker[] = [
  { id: 'm-1', time: 0.0, label: 'Intro Hook', color: '#38bdf8', type: 'chapter' },
  { id: 'm-2', time: 3.2, label: 'Beat Drop / B-Roll Cut', color: '#f43f5e', type: 'beat' },
  { id: 'm-3', time: 7.5, label: 'Transition Crossfade', color: '#a855f7', type: 'ai_note' },
  { id: 'm-4', time: 12.0, label: 'Peak Action', color: '#22c55e', type: 'chapter' }
];

export const INITIAL_COLLABORATORS: Collaborator[] = [
  {
    id: 'collab-1',
    name: 'Carlos Mendez',
    role: 'Lead Editor',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    color: '#06b6d4', // Cyan
    currentPlayhead: 3.2,
    activeTrackId: 'track-v2',
    isOnline: true
  },
  {
    id: 'collab-2',
    name: 'Elena Rostova',
    role: 'Director',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80',
    color: '#ec4899', // Pink
    currentPlayhead: 7.5,
    activeTrackId: 'track-v1',
    isOnline: true
  },
  {
    id: 'collab-3',
    name: 'Leo Tanaka',
    role: 'Sound Designer',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    color: '#eab308', // Amber
    currentPlayhead: 2.8,
    activeTrackId: 'track-a2',
    isOnline: true
  }
];

export const INITIAL_COMMENTS: TimelineComment[] = [
  {
    id: 'comm-1',
    author: 'Elena Rostova (Director)',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80',
    time: 3.2,
    text: 'Great speed ramp here! Can we punch in 10% more on the Tokyo neon signs?',
    status: 'open',
    createdAt: '10 mins ago',
    replies: [
      { author: 'Carlos Mendez', text: 'Adjusted Pan/Crop to 1.15x zoom with slight horizontal drift.', createdAt: '5 mins ago' }
    ]
  },
  {
    id: 'comm-2',
    author: 'Leo Tanaka (Sound)',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    time: 7.5,
    text: 'Added audio ducking on the synth score so the speaker frequency band remains crystalline.',
    status: 'resolved',
    createdAt: '25 mins ago'
  }
];

export const INITIAL_BRANCHES: ProjectBranch[] = [
  {
    id: 'b-main',
    name: 'main (Master 4K DCI)',
    description: 'Production baseline approved for theatrical & high-bitrate streaming delivery.',
    author: 'Carlos Mendez',
    lastModified: 'Today at 19:42',
    commitHash: '8f7a29c',
    clipCount: 6,
    changesSummary: 'Synced Lumetri grade & crossfade curves'
  },
  {
    id: 'b-social',
    name: 'feature/tiktok-reels-9x16',
    description: 'Auto-reframed 9:16 vertical cut with animated Hormozi typography and punchy B-roll.',
    author: 'Elena Rostova',
    lastModified: 'Today at 20:05',
    commitHash: '3d91b44',
    clipCount: 7,
    changesSummary: 'Applied 9:16 Auto-reframe and dynamic captions'
  },
  {
    id: 'b-directors',
    name: 'director-extended-cut',
    description: 'Uncut keynote monologue with extended alpine drone aerials and full synth crescendo.',
    author: 'Elena Rostova',
    lastModified: 'Yesterday at 22:15',
    commitHash: 'a12bc90',
    clipCount: 9,
    changesSummary: 'Added 2 additional B-roll layers and alternate score'
  }
];

export const INITIAL_COMMITS: ProjectCommit[] = [
  {
    hash: '8f7a29c',
    message: 'Merge branch feature/vegas-velocity-ramps into main',
    author: 'Carlos Mendez',
    timestamp: '20 mins ago',
    branch: 'main',
    diffSummary: 'Added Vegas Pro Bézier speed ramps to Tokyo B-roll (V2)'
  },
  {
    hash: 'e5b7210',
    message: 'Add Lumetri Cyberpunk LUT and audio ducking envelope',
    author: 'Leo Tanaka',
    timestamp: '1 hour ago',
    branch: 'main',
    diffSummary: 'Adjusted volume envelope on Track A2 (-12dB during speech)'
  },
  {
    hash: '44a83bf',
    message: 'Initial project rough cut and transcript indexing',
    author: 'Carlos Mendez',
    timestamp: '3 hours ago',
    branch: 'main',
    diffSummary: 'Imported 6 media assets and generated word-level SMPTE alignment'
  }
];
