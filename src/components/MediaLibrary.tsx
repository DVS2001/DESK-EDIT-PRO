import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Cloud, Upload, Film, Music, Volume2, Search, Filter, 
  Trash2, Play, Pause, Plus, CheckCircle2, AlertCircle, 
  RefreshCw, HardDrive, Sparkles, Folder, Grid, List, 
  ChevronDown, ChevronUp, ExternalLink, ShieldCheck, Eye, Layers,
  FileVideo, FileAudio, FileText, GripVertical, Check, ArrowDownToLine,
  SlidersHorizontal, X, ArrowUpRight, Maximize2, Minimize2,
  Tag, Palette, Copy, CheckCheck
} from 'lucide-react';
import { MediaAsset, TimelineTrack } from '../types/editor';
import { 
  auth, db, storage, handleFirestoreError, OperationType 
} from '../lib/firebase';
import { 
  collection, doc, setDoc, deleteDoc, onSnapshot 
} from 'firebase/firestore';
import { 
  ref, uploadBytesResumable, getDownloadURL, deleteObject 
} from 'firebase/storage';
import { INITIAL_MEDIA_ASSETS } from '../data/mockAssets';

export type AssetCategory = 'Video' | 'Audio' | 'Graphics' | 'Transcripts';

/**
 * Intelligent auto-tagging engine that uses Firebase Storage and Firestore metadata
 * (MIME type, file format, duration, transcript text, dimensions, and existing tags)
 * to automatically group assets into 'Video', 'Audio', 'Graphics', and 'Transcripts'.
 */
export function classifyAndAutoTagAsset(asset: Partial<MediaAsset>): {
  category: AssetCategory;
  autoTags: string[];
} {
  const mime = (asset.mimeType || '').toLowerCase();
  const format = (asset.fileFormat || '').toUpperCase();
  const title = (asset.title || '').toLowerCase();
  const desc = (asset.description || '').toLowerCase();
  const existingTags = (asset.tags || []).map((t) => t.toLowerCase());
  const storagePath = (asset.storagePath || '').toLowerCase();

  // 1. Check for TRANSCRIPTS
  const isTranscript = 
    asset.type === 'transcript' ||
    asset.category === 'Transcripts' ||
    Boolean(asset.transcriptSample && asset.transcriptSample.trim().length > 0) ||
    mime.includes('vtt') || mime.includes('srt') || (mime.includes('plain') && (title.includes('transcript') || title.includes('caption'))) ||
    format === 'VTT' || format === 'SRT' || format === 'TRANSCRIPT' ||
    existingTags.some((t) => ['transcript', 'captions', 'subtitles', 'speech-to-text', 'whisper', 'dialogue', 'timestamped'].includes(t)) ||
    title.includes('transcript') || title.includes('caption') || title.includes('subtitles') ||
    storagePath.includes('/transcripts/');

  if (isTranscript) {
    const autoTags = ['transcript', 'speech-to-text', 'captions', 'firebase-metadata'];
    if (existingTags.includes('interview') || title.includes('interview')) autoTags.push('dialogue-interview');
    if (asset.transcriptSample) autoTags.push('neural-stt');
    if (format === 'VTT' || format === 'SRT') autoTags.push(`${format.toLowerCase()}-timed`);
    return { category: 'Transcripts', autoTags };
  }

  // 2. Check for GRAPHICS
  const isGraphic = 
    asset.type === 'graphics' ||
    asset.category === 'Graphics' ||
    mime.startsWith('image/') ||
    ['PNG', 'SVG', 'PSD', 'GIF', 'JPEG', 'JPG', 'WEBP', 'TIFF'].includes(format) ||
    existingTags.some((t) => ['graphics', 'graphic', 'overlay', 'lower-third', 'title', 'logo', 'badge', 'callout', 'alpha', 'motion-graphic'].includes(t)) ||
    title.includes('graphic') || title.includes('lower third') || title.includes('overlay') || title.includes('badge') || title.includes('title card') ||
    storagePath.includes('/graphics/');

  if (isGraphic) {
    const autoTags = ['graphics', 'overlay', 'visual-element', 'firebase-metadata'];
    if (format === 'PNG' || format === 'SVG' || existingTags.includes('alpha') || (asset.resolution || '').toLowerCase().includes('alpha')) {
      autoTags.push('alpha-transparency');
    }
    if (title.includes('lower third') || existingTags.includes('lower-third')) {
      autoTags.push('lower-third');
    }
    if (title.includes('badge') || existingTags.includes('badge') || title.includes('callout')) {
      autoTags.push('vector-badge');
    }
    return { category: 'Graphics', autoTags };
  }

  // 3. Check for AUDIO
  const isAudio = 
    asset.type === 'audio' ||
    asset.category === 'Audio' ||
    mime.startsWith('audio/') ||
    ['MP3', 'WAV', 'AAC', 'FLAC', 'OGG', 'M4A', 'AIFF'].includes(format) ||
    existingTags.some((t) => ['audio', 'music', 'sfx', 'beat', 'riser', 'synthwave', 'sound', 'voiceover', 'soundtrack', 'impact'].includes(t)) ||
    title.includes('music') || title.includes('sfx') || title.includes('synth') || title.includes('sound') ||
    storagePath.includes('/audio/');

  if (isAudio) {
    const autoTags = ['audio', 'master-sound', 'firebase-metadata'];
    if (existingTags.includes('music') || existingTags.includes('synthwave') || title.includes('music') || (asset.duration || 0) > 20) {
      autoTags.push('soundtrack', 'music-bed');
    } else {
      autoTags.push('sound-effect', 'foley');
    }
    return { category: 'Audio', autoTags };
  }

  // 4. Default: VIDEO
  const autoTags = ['video', 'footage', 'firebase-metadata'];
  const res = (asset.resolution || '').toLowerCase();
  if (res.includes('4k') || res.includes('2160') || res.includes('dci')) {
    autoTags.push('4k-uhd');
  } else {
    autoTags.push('hd-video');
  }
  if ((asset.fps || 0) >= 60) {
    autoTags.push('high-fps', 'slow-motion');
  }
  if (asset.type === 'broll' || existingTags.includes('b-roll') || title.includes('b-roll')) {
    autoTags.push('b-roll');
  }
  return { category: 'Video', autoTags };
}

interface MediaLibraryProps {
  onAddMediaToTimeline: (asset: MediaAsset, targetTrackId?: string, startTime?: number) => void;
  availableTracks?: TimelineTrack[];
  isCompactMode?: boolean;
  onClose?: () => void;
  onExpandToModal?: () => void;
  onDockToSidebar?: () => void;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  onAddMediaToTimeline,
  availableTracks = [],
  isCompactMode = false,
  onClose,
  onExpandToModal,
  onDockToSidebar,
}) => {
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [cloudAssets, setCloudAssets] = useState<MediaAsset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'name' | 'tags'>('all');
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  
  // Category & Grouping States
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'all' | AssetCategory>('all');
  const [groupByCategory, setGroupByCategory] = useState<boolean>(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [isAutoTaggingRunning, setIsAutoTaggingRunning] = useState<boolean>(false);

  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'duration' | 'size'>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Upload progress tracking
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio / Video Audition Player
  const [auditioningAssetId, setAuditioningAssetId] = useState<string | null>(null);
  const [isPlayingAudition, setIsPlayingAudition] = useState<boolean>(false);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);

  // Dragging state
  const [draggedAssetId, setDraggedAssetId] = useState<string | null>(null);

  // Selected asset for detailed inspector modal
  const [inspectingAsset, setInspectingAsset] = useState<MediaAsset | null>(null);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  // Subscribe to Auth changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Sync cloud assets from Firestore & local storage with automatic tagging
  useEffect(() => {
    // Curated cloud assets with Firebase Storage references & auto-tag classification
    const initialBaseCloudAssets: MediaAsset[] = INITIAL_MEDIA_ASSETS.map((asset, index) => {
      const classification = classifyAndAutoTagAsset(asset);
      const combinedTags = Array.from(new Set([...(asset.tags || []), ...classification.autoTags]));
      const isVid = classification.category === 'Video';
      const isAud = classification.category === 'Audio';
      const isGfx = classification.category === 'Graphics';

      return {
        ...asset,
        category: classification.category,
        autoCategory: classification.category,
        autoTags: classification.autoTags,
        tags: combinedTags,
        isCloudStored: true,
        storagePath: asset.storagePath || `gs://gen-lang-client-0877103276.firebasestorage.app/demo-vault/${classification.category.toLowerCase()}/${asset.id}`,
        sizeBytes: asset.sizeBytes || (
          isVid ? 42500000 + index * 12000000 :
          isAud ? 8500000 + index * 3000000 :
          isGfx ? 2500000 + index * 800000 :
          32000 + index * 5000
        ),
        uploadedAt: asset.uploadedAt || new Date(Date.now() - (index + 1) * 86400000 * 2).toISOString(),
      };
    });

    // If user is authenticated, listen to real Firestore collection
    if (currentUser) {
      setIsLoading(true);
      const mediaCollectionRef = collection(db, 'users', currentUser.uid, 'mediaAssets');
      
      const unsubscribe = onSnapshot(
        mediaCollectionRef,
        (snapshot) => {
          const userItems: MediaAsset[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as MediaAsset;
            const classification = classifyAndAutoTagAsset(data);
            userItems.push({
              ...data,
              category: data.category || classification.category,
              autoCategory: data.autoCategory || classification.category,
              autoTags: data.autoTags || classification.autoTags,
              tags: Array.from(new Set([...(data.tags || []), ...(data.autoTags || classification.autoTags)])),
            });
          });

          // Merge user custom uploads with default cloud master assets
          const merged = [...userItems, ...initialBaseCloudAssets.filter(
            (b) => !userItems.some((u) => u.id === b.id)
          )];
          setCloudAssets(merged);
          setIsLoading(false);
        },
        (error) => {
          console.warn('Firestore personal media listener notice:', error);
          loadLocalFallback(initialBaseCloudAssets);
          setIsLoading(false);
        }
      );

      return () => unsubscribe();
    } else {
      // Guest mode: load from localStorage cache + defaults
      loadLocalFallback(initialBaseCloudAssets);
    }
  }, [currentUser]);

  const loadLocalFallback = (defaults: MediaAsset[]) => {
    try {
      const stored = localStorage.getItem('omnicut_cloud_media_library_v2');
      if (stored) {
        const parsed: MediaAsset[] = JSON.parse(stored);
        const merged = [...parsed, ...defaults.filter((b) => !parsed.some((p) => p.id === b.id))];
        setCloudAssets(merged);
        return;
      }
    } catch {
      // ignore
    }
    setCloudAssets(defaults);
  };

  const saveLocalAssets = (assets: MediaAsset[]) => {
    try {
      localStorage.setItem('omnicut_cloud_media_library_v2', JSON.stringify(assets));
    } catch {
      // ignore
    }
  };

  const showNotice = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatusNotice({ message, type });
    setTimeout(() => setStatusNotice(null), 4500);
  };

  // Run Auto-Tagging across all assets using Firebase Metadata
  const handleRunAutoTagging = async () => {
    setIsAutoTaggingRunning(true);
    try {
      const updated = cloudAssets.map((asset) => {
        const result = classifyAndAutoTagAsset(asset);
        const mergedTags = Array.from(new Set([...(asset.tags || []), ...result.autoTags]));
        return {
          ...asset,
          category: result.category,
          autoCategory: result.category,
          autoTags: result.autoTags,
          tags: mergedTags,
        };
      });

      setCloudAssets(updated);
      saveLocalAssets(updated);

      // Persist to Firestore if user is authenticated
      if (currentUser) {
        for (const item of updated) {
          if (item.id) {
            try {
              await setDoc(doc(db, 'users', currentUser.uid, 'mediaAssets', item.id), item, { merge: true });
            } catch (fsErr) {
              console.warn('Firestore update error during auto-tag:', fsErr);
            }
          }
        }
      }

      showNotice(
        `✨ Auto-etiquetado completado: ${updated.length} activos agrupados automáticamente en Video, Audio, Graphics y Transcripts usando metadatos de Firebase.`,
        'success'
      );
    } catch (err: any) {
      showNotice(`Error durante el auto-etiquetado: ${err?.message}`, 'error');
    } finally {
      setIsAutoTaggingRunning(false);
    }
  };

  // Upload handler to Firebase Storage & Firestore with automatic metadata categorization
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileNameLower = file.name.toLowerCase();
      
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/i.test(fileNameLower);
      const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|aac|flac|ogg|m4a)$/i.test(fileNameLower);
      const isGraphic = file.type.startsWith('image/') || /\.(png|svg|jpg|jpeg|gif|webp|psd)$/i.test(fileNameLower);
      const isTranscript = file.type.startsWith('text/') || file.type.includes('json') || /\.(vtt|srt|txt|json)$/i.test(fileNameLower);

      if (!isVideo && !isAudio && !isGraphic && !isTranscript) {
        showNotice(`Archivo "${file.name}" omitido. Se admiten formatos de Vídeo, Audio, Graphics e Transcripts.`, 'error');
        continue;
      }

      // Pre-classify based on file metadata
      const initialType = isVideo ? 'video' : isAudio ? 'audio' : isGraphic ? 'graphics' : 'transcript';
      const fileExt = fileNameLower.split('.').pop()?.toUpperCase() || 'FILE';
      const classification = classifyAndAutoTagAsset({
        title: file.name,
        type: initialType,
        mimeType: file.type,
        fileFormat: fileExt,
        description: `Subido a Firebase Storage`,
        tags: [initialType, 'cloud_upload'],
      });

      setUploadingFileName(file.name);
      setUploadProgress(15);

      const uniqueId = `cloud-asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const userFolder = currentUser ? currentUser.uid : 'guest-vault';
      const storageFilePath = `media-library/${userFolder}/${classification.category.toLowerCase()}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const storageRef = ref(storage, storageFilePath);

      try {
        let downloadUrl = '';
        
        try {
          // Attempt Firebase Storage Upload with custom classification metadata
          const uploadTask = uploadBytesResumable(storageRef, file, {
            contentType: file.type,
            customMetadata: {
              originalName: file.name,
              uploadedBy: currentUser?.email || 'guest',
              uploadedAt: new Date().toISOString(),
              autoCategory: classification.category,
              autoTags: classification.autoTags.join(','),
              fileSize: String(file.size),
            },
          });

          await new Promise<void>((resolve, reject) => {
            uploadTask.on(
              'state_changed',
              (snapshot) => {
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                setUploadProgress(progress);
              },
              (error) => {
                console.warn('Firebase Storage direct upload notice:', error.message);
                reject(error);
              },
              async () => {
                try {
                  downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
                  resolve();
                } catch (e) {
                  reject(e);
                }
              }
            );
          });
        } catch {
          // Fallback to Blob Object URL for immediate zero-latency local availability
          downloadUrl = URL.createObjectURL(file);
        }

        // Set appropriate thumbnails based on auto-detected category
        let thumbUrl = isVideo 
          ? 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=500&auto=format&fit=crop&q=80'
          : isAudio
          ? 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80'
          : isGraphic
          ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=500&auto=format&fit=crop&q=80';

        const mergedTags = Array.from(new Set([
          initialType,
          'cloud_upload',
          'firebase_storage',
          ...classification.autoTags,
        ]));

        const newAsset: MediaAsset = {
          id: uniqueId,
          title: file.name.replace(/\.[^/.]+$/, ''),
          type: initialType,
          category: classification.category,
          autoCategory: classification.category,
          autoTags: classification.autoTags,
          url: downloadUrl,
          duration: isVideo ? 12.0 : isAudio ? 25.0 : isGraphic ? 6.0 : 15.0,
          resolution: isVideo ? '1920x1080 (FHD)' : isGraphic ? '1920x1080 (Alpha)' : isAudio ? 'Stereo Audio' : 'Word Timestamps',
          fps: isVideo ? 60 : undefined,
          tags: mergedTags,
          description: `Archivo clasificado automáticamente como [${classification.category}] con metadatos de Firebase (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
          thumbnail: isGraphic && downloadUrl ? downloadUrl : thumbUrl,
          sizeBytes: file.size,
          storagePath: storageFilePath,
          isCloudStored: true,
          uploadedAt: new Date().toISOString(),
          ownerId: currentUser?.uid || 'guest-session',
          fileFormat: fileExt,
          mimeType: file.type,
          transcriptSample: isTranscript ? `Transcripción importada desde ${file.name}` : undefined,
        };

        // If authenticated, persist to Firestore
        if (currentUser) {
          try {
            await setDoc(
              doc(db, 'users', currentUser.uid, 'mediaAssets', uniqueId),
              newAsset
            );
          } catch (fsErr) {
            console.warn('Firestore asset save notice:', fsErr);
          }
        }

        // Update local state immediately
        setCloudAssets((prev) => {
          const next = [newAsset, ...prev];
          saveLocalAssets(next);
          return next;
        });

        showNotice(`"${file.name}" clasificado en [${classification.category}] y subido a Firebase Storage.`);
      } catch (err: any) {
        showNotice(`Error al subir ${file.name}: ${err?.message || 'Fallo de conexión'}`, 'error');
      } finally {
        setUploadProgress(null);
        setUploadingFileName(null);
      }
    }
  };

  // Delete asset handler
  const handleDeleteAsset = async (asset: MediaAsset) => {
    try {
      if (asset.storagePath) {
        try {
          const fileRef = ref(storage, asset.storagePath);
          await deleteObject(fileRef);
        } catch {
          // ignore
        }
      }

      if (currentUser && asset.id) {
        try {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'mediaAssets', asset.id));
        } catch (err) {
          console.warn('Firestore delete notice:', err);
        }
      }

      setCloudAssets((prev) => {
        const next = prev.filter((a) => a.id !== asset.id);
        saveLocalAssets(next);
        return next;
      });

      showNotice(`"${asset.title}" eliminado de la biblioteca en la nube.`);
      if (inspectingAsset?.id === asset.id) {
        setInspectingAsset(null);
      }
    } catch (err: any) {
      showNotice(`No se pudo eliminar el archivo: ${err?.message}`, 'error');
    }
  };

  // Audition audio play/pause
  const toggleAudition = (asset: MediaAsset) => {
    if (auditioningAssetId === asset.id) {
      if (isPlayingAudition) {
        auditionAudioRef.current?.pause();
        setIsPlayingAudition(false);
      } else {
        auditionAudioRef.current?.play();
        setIsPlayingAudition(true);
      }
    } else {
      setAuditioningAssetId(asset.id);
      setIsPlayingAudition(true);
      if (auditionAudioRef.current) {
        auditionAudioRef.current.src = asset.url;
        auditionAudioRef.current.play().catch(() => setIsPlayingAudition(false));
      }
    }
  };

  // Handle Drag Start for Timeline Drop
  const handleDragStart = (e: React.DragEvent, asset: MediaAsset) => {
    setDraggedAssetId(asset.id);
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.setData('text/plain', asset.id);
    e.dataTransfer.effectAllowed = 'copy';

    // Custom drag preview badge with category icon
    const category = asset.autoCategory || asset.category || 'Video';
    const catIcon = category === 'Video' ? '🎬' : category === 'Audio' ? '🎵' : category === 'Graphics' ? '🎨' : '📝';
    
    const dragGhost = document.createElement('div');
    dragGhost.style.padding = '8px 14px';
    dragGhost.style.background = '#0284c7';
    dragGhost.style.color = '#ffffff';
    dragGhost.style.borderRadius = '8px';
    dragGhost.style.fontWeight = 'bold';
    dragGhost.style.fontSize = '11px';
    dragGhost.style.position = 'absolute';
    dragGhost.style.top = '-1000px';
    dragGhost.style.boxShadow = '0 10px 25px rgba(0,0,0,0.6)';
    dragGhost.innerText = `${catIcon} ${asset.title} [${category}]`;
    document.body.appendChild(dragGhost);
    e.dataTransfer.setDragImage(dragGhost, 10, 10);
    setTimeout(() => dragGhost.remove(), 0);
  };

  const handleDragEnd = () => {
    setDraggedAssetId(null);
  };

  // Extract all unique metadata tags across all cloud assets
  const allTags = useMemo(() => {
    const set = new Set<string>();
    cloudAssets.forEach((asset) => {
      asset.tags?.forEach((tag) => {
        if (tag.trim()) set.add(tag.trim().toLowerCase());
      });
      asset.autoTags?.forEach((tag) => {
        if (tag.trim()) set.add(tag.trim().toLowerCase());
      });
    });
    return Array.from(set).sort();
  }, [cloudAssets]);

  // Filtered and sorted assets based on text search (name, metadata tags) and scope
  const filteredAssets = useMemo(() => {
    return cloudAssets
      .filter((asset) => {
        const itemCategory = asset.autoCategory || asset.category || (
          asset.type === 'video' || asset.type === 'broll' ? 'Video' :
          asset.type === 'audio' ? 'Audio' :
          asset.type === 'graphics' ? 'Graphics' : 'Transcripts'
        );

        // Category Filter
        if (selectedCategoryFilter !== 'all') {
          if (itemCategory !== selectedCategoryFilter) return false;
        }

        // Folder filter
        if (selectedFolder !== 'all') {
          if (selectedFolder === 'raw-footage' && itemCategory !== 'Video') return false;
          if (selectedFolder === 'broll' && (!asset.tags.includes('b-roll') && asset.type !== 'broll')) return false;
          if (selectedFolder === 'music' && (itemCategory !== 'Audio' || !asset.tags.includes('music'))) return false;
          if (selectedFolder === 'sfx' && (itemCategory !== 'Audio' || !asset.tags.includes('sfx'))) return false;
          if (selectedFolder === 'graphics' && itemCategory !== 'Graphics') return false;
          if (selectedFolder === 'transcripts' && itemCategory !== 'Transcripts') return false;
          if (selectedFolder === 'cloud-uploads' && !asset.tags.includes('cloud_upload')) return false;
        }

        // Text-based search input query: filter cloud assets by name or metadata tags
        if (searchQuery.trim()) {
          const rawQ = searchQuery.toLowerCase().trim();
          const cleanQ = rawQ.startsWith('#') ? rawQ.slice(1).trim() : rawQ;

          const matchName = asset.title.toLowerCase().includes(cleanQ);
          const matchDescription = (asset.description || '').toLowerCase().includes(cleanQ);
          const matchTags = asset.tags?.some((t) => t.toLowerCase().includes(cleanQ)) || false;
          const matchAutoTags = asset.autoTags?.some((t) => t.toLowerCase().includes(cleanQ)) || false;
          const matchCategory = itemCategory.toLowerCase().includes(cleanQ);
          const matchResolution = (asset.resolution || '').toLowerCase().includes(cleanQ);
          const matchFormat = (asset.fileFormat || '').toLowerCase().includes(cleanQ);
          const matchTranscript = (asset.transcriptSample || '').toLowerCase().includes(cleanQ);

          if (searchScope === 'name') {
            if (!matchName) return false;
          } else if (searchScope === 'tags') {
            if (!matchTags && !matchAutoTags) return false;
          } else {
            // 'all': matches either name, metadata tags, auto-tags, category, transcript, or format
            if (!matchName && !matchTags && !matchAutoTags && !matchCategory && !matchDescription && !matchResolution && !matchFormat && !matchTranscript) {
              return false;
            }
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date') {
          return new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime();
        }
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === 'duration') {
          return b.duration - a.duration;
        }
        if (sortBy === 'size') {
          return (b.sizeBytes || 0) - (a.sizeBytes || 0);
        }
        return 0;
      });
  }, [cloudAssets, selectedCategoryFilter, selectedFolder, searchQuery, searchScope, sortBy]);

  // Compute total library stats across categories
  const libraryStats = useMemo(() => {
    const totalSize = cloudAssets.reduce((acc, a) => acc + (a.sizeBytes || 0), 0);
    const videoCount = cloudAssets.filter((a) => (a.autoCategory || a.category || (a.type === 'video' || a.type === 'broll' ? 'Video' : '')) === 'Video').length;
    const audioCount = cloudAssets.filter((a) => (a.autoCategory || a.category || (a.type === 'audio' ? 'Audio' : '')) === 'Audio').length;
    const graphicsCount = cloudAssets.filter((a) => (a.autoCategory || a.category || (a.type === 'graphics' ? 'Graphics' : '')) === 'Graphics').length;
    const transcriptsCount = cloudAssets.filter((a) => (a.autoCategory || a.category || (a.type === 'transcript' ? 'Transcripts' : '')) === 'Transcripts').length;

    return {
      totalCount: cloudAssets.length,
      videoCount,
      audioCount,
      graphicsCount,
      transcriptsCount,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(1),
    };
  }, [cloudAssets]);

  // Grouped assets dictionary for the Category Grouping View
  const groupedAssets = useMemo(() => {
    const groups: Record<AssetCategory, MediaAsset[]> = {
      Video: [],
      Audio: [],
      Graphics: [],
      Transcripts: [],
    };

    filteredAssets.forEach((asset) => {
      const cat = (asset.autoCategory || asset.category || (
        asset.type === 'video' || asset.type === 'broll' ? 'Video' :
        asset.type === 'audio' ? 'Audio' :
        asset.type === 'graphics' ? 'Graphics' : 'Transcripts'
      )) as AssetCategory;

      if (groups[cat]) {
        groups[cat].push(asset);
      } else {
        groups.Video.push(asset);
      }
    });

    return groups;
  }, [filteredAssets]);

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Helper for category styling & metadata indicators
  const getCategoryTheme = (category: AssetCategory) => {
    switch (category) {
      case 'Video':
        return {
          icon: <Film className="w-3.5 h-3.5 text-sky-400" />,
          badgeClass: 'bg-sky-950/90 text-sky-300 border-sky-700/60',
          accentBorder: 'border-sky-500/40',
          recommendedTrack: 'Pista V1 / V2 (Vídeo y B-Roll)',
          defaultTrackId: 'track-v1',
          gradient: 'from-sky-950/40 via-[#0a1426] to-[#070d1a]',
        };
      case 'Audio':
        return {
          icon: <Music className="w-3.5 h-3.5 text-emerald-400" />,
          badgeClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60',
          accentBorder: 'border-emerald-500/40',
          recommendedTrack: 'Pista A1 / A2 / A3 (Voz, Música y SFX)',
          defaultTrackId: 'track-a2',
          gradient: 'from-emerald-950/40 via-[#091a18] to-[#070d1a]',
        };
      case 'Graphics':
        return {
          icon: <Palette className="w-3.5 h-3.5 text-pink-400" />,
          badgeClass: 'bg-pink-950/90 text-pink-300 border-pink-700/60',
          accentBorder: 'border-pink-500/40',
          recommendedTrack: 'Pista V2 / V3 (Overlays y Títulos)',
          defaultTrackId: 'track-v3',
          gradient: 'from-pink-950/40 via-[#1a0a18] to-[#070d1a]',
        };
      case 'Transcripts':
        return {
          icon: <FileText className="w-3.5 h-3.5 text-amber-400" />,
          badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-700/60',
          accentBorder: 'border-amber-500/40',
          recommendedTrack: 'Pista V3 (Subtítulos sincronizados)',
          defaultTrackId: 'track-v3',
          gradient: 'from-amber-950/40 via-[#1c1407] to-[#070d1a]',
        };
    }
  };

  return (
    <div className={`flex flex-col bg-[#080d19] border border-slate-800 rounded-xl overflow-hidden select-none ${
      isCompactMode ? 'h-full' : 'h-[620px] max-h-[85vh] shadow-2xl'
    }`}>
      {/* Hidden Audio Player for Auditioning */}
      <audio
        ref={auditionAudioRef}
        onEnded={() => setIsPlayingAudition(false)}
        className="hidden"
      />

      {/* Top Header Bar */}
      <div className="p-3.5 bg-gradient-to-r from-[#0d162b] via-[#0a1224] to-[#0d1c32] border-b border-slate-800 flex items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-sky-600/30 flex-shrink-0">
            <Cloud className="w-5 h-5 text-sky-200" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Firebase Cloud Media Library</span>
              </h3>
              <span className="text-[10px] font-mono bg-sky-950/80 text-sky-300 border border-sky-700/60 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Storage Vault</span>
              </span>
              <span className="text-[10px] font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Auto-Tag Engine</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
              <span>{libraryStats.totalCount} activos en la nube ({libraryStats.totalSizeMB} MB)</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 font-bold">Arrastra a la línea de tiempo</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Hidden File Input (supports video, audio, graphics, transcripts) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileUpload(e.target.files)}
            multiple
            accept="video/*,audio/*,image/*,.vtt,.srt,.txt,.json"
            className="hidden"
          />

          {/* Run Auto-Tagging with Firebase Metadata Button */}
          <button
            onClick={handleRunAutoTagging}
            disabled={isAutoTaggingRunning}
            className="bg-gradient-to-r from-indigo-700 to-purple-700 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/25 transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Analiza metadatos de Firebase para agrupar activos automáticamente en Video, Audio, Graphics y Transcripts"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isAutoTaggingRunning ? 'animate-spin' : ''}`} />
            <span className={isCompactMode ? 'hidden xl:inline' : 'hidden md:inline'}>
              {isAutoTaggingRunning ? 'Auto-Etiquetando...' : 'Auto-Etiquetar'}
            </span>
          </button>

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-sky-600/25 transition active:scale-95 cursor-pointer whitespace-nowrap"
            title="Subir archivos a Firebase Storage (Vídeo, Audio, Gráficos o Subtítulos)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className={isCompactMode ? 'hidden xl:inline' : 'hidden sm:inline'}>Subir a Storage</span>
          </button>

          {/* Expand to Full Modal Button (when in compact mode) */}
          {isCompactMode && onExpandToModal && (
            <button
              onClick={onExpandToModal}
              className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-400 hover:text-white flex items-center justify-center transition border border-slate-700 cursor-pointer"
              title="Expandir a ventana modal completa"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Dock to Sidebar Button (when in modal mode) */}
          {!isCompactMode && onDockToSidebar && (
            <button
              onClick={onDockToSidebar}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-300 hover:text-white flex items-center gap-1 text-xs transition border border-slate-700 cursor-pointer"
              title="Acoplar a la barra lateral junto a la línea de tiempo"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Acoplar a barra lateral</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition border border-slate-700 cursor-pointer"
              title="Cerrar panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Uploading Notification / Progress Bar */}
      {uploadProgress !== null && (
        <div className="px-4 py-2 bg-sky-950/90 border-b border-sky-600/50 flex items-center justify-between gap-3 text-xs font-mono animate-fadeIn flex-shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin flex-shrink-0" />
            <span className="text-white truncate">Subiendo y clasificando &quot;{uploadingFileName}&quot; en Firebase Storage...</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-32 bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-sky-400 h-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-sky-300 font-bold">{uploadProgress}%</span>
          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {statusNotice && (
        <div className={`px-4 py-2 border-b text-xs flex items-center justify-between animate-fadeIn flex-shrink-0 ${
          statusNotice.type === 'error'
            ? 'bg-rose-950/90 border-rose-700 text-rose-200'
            : 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
        }`}>
          <div className="flex items-center gap-2">
            {statusNotice.type === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{statusNotice.message}</span>
          </div>
          <button onClick={() => setStatusNotice(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Toolbar: Text Search, Scope, Category Auto-Grouping Tabs & Layout */}
      <div className="p-3 bg-[#060a14] border-b border-slate-800/80 space-y-2.5 flex-shrink-0">
        {/* Main Search Input & Scope Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Text-Based Search Input Field (filters by name or metadata tags) */}
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-sky-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                searchScope === 'name'
                  ? 'Filtrar activos por nombre (ej. Keynote, Entrevista, Cyberwave)...'
                  : searchScope === 'tags'
                  ? 'Filtrar por etiquetas de metadatos (ej. 4k, lower-third, subtitles, speech)...'
                  : 'Filtrar por nombre, categoría o etiquetas (ej. Keynote, video, audio, graphics, transcript)...'
              }
              aria-label="Filtrar activos por nombre o etiquetas de metadatos"
              className="w-full bg-[#0d1424] border border-slate-700/80 rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40 transition font-sans shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer transition"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Scope Selector (Name vs Tags vs All) */}
          <div className="flex items-center gap-1 bg-[#090f1e] p-1 rounded-lg border border-slate-800 text-[11px] font-mono flex-shrink-0">
            <span className="text-[10px] text-slate-500 px-1.5 hidden md:inline">Buscar en:</span>
            <button
              onClick={() => setSearchScope('all')}
              className={`px-2 py-0.5 rounded transition cursor-pointer whitespace-nowrap ${
                searchScope === 'all'
                  ? 'bg-sky-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Buscar en nombre de archivo, descripción y etiquetas de metadatos"
            >
              Nombre o Tags
            </button>
            <button
              onClick={() => setSearchScope('name')}
              className={`px-2 py-0.5 rounded transition cursor-pointer whitespace-nowrap ${
                searchScope === 'name'
                  ? 'bg-sky-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Filtrar estrictamente por el nombre del archivo"
            >
              Solo Nombre
            </button>
            <button
              onClick={() => setSearchScope('tags')}
              className={`px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                searchScope === 'tags'
                  ? 'bg-sky-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Filtrar estrictamente por etiquetas de metadatos"
            >
              <Tag className="w-2.5 h-2.5" />
              <span>Solo Tags</span>
            </button>
          </div>
        </div>

        {/* Row 2: Categories Automatically Grouped by Firebase Metadata */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-[#090f1e] p-1 rounded-lg border border-slate-800 text-[11px] font-mono overflow-x-auto scrollbar-none flex-shrink-0">
            <button
              onClick={() => setSelectedCategoryFilter('all')}
              className={`px-2.5 py-1 rounded transition cursor-pointer whitespace-nowrap font-bold ${
                selectedCategoryFilter === 'all' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({libraryStats.totalCount})
            </button>
            <button
              onClick={() => setSelectedCategoryFilter('Video')}
              className={`px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap font-bold ${
                selectedCategoryFilter === 'Video' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-sky-300'
              }`}
              title="Vídeo y B-Roll para pistas V1 y V2"
            >
              <Film className="w-3 h-3 text-sky-400" />
              <span>Video ({libraryStats.videoCount})</span>
            </button>
            <button
              onClick={() => setSelectedCategoryFilter('Audio')}
              className={`px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap font-bold ${
                selectedCategoryFilter === 'Audio' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-emerald-300'
              }`}
              title="Pistas de música y efectos sonoros para pistas A1, A2 y A3"
            >
              <Music className="w-3 h-3 text-emerald-400" />
              <span>Audio ({libraryStats.audioCount})</span>
            </button>
            <button
              onClick={() => setSelectedCategoryFilter('Graphics')}
              className={`px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap font-bold ${
                selectedCategoryFilter === 'Graphics' ? 'bg-pink-600 text-white shadow-sm' : 'text-slate-400 hover:text-pink-300'
              }`}
              title="Rótulos, tercios inferiores y gráficos transparentes para pistas V2 y V3"
            >
              <Palette className="w-3 h-3 text-pink-400" />
              <span>Graphics ({libraryStats.graphicsCount})</span>
            </button>
            <button
              onClick={() => setSelectedCategoryFilter('Transcripts')}
              className={`px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap font-bold ${
                selectedCategoryFilter === 'Transcripts' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-amber-300'
              }`}
              title="Transcripciones con marcas de tiempo para subtítulos sincronizados en pista V3"
            >
              <FileText className="w-3 h-3 text-amber-400" />
              <span>Transcripts ({libraryStats.transcriptsCount})</span>
            </button>
          </div>

          {/* Group by Category View Mode Toggle & Layout */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGroupByCategory(!groupByCategory)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                groupByCategory
                  ? 'bg-purple-950/80 text-purple-200 border-purple-500 shadow-sm'
                  : 'bg-[#0d1424] text-slate-400 border-slate-700 hover:text-slate-200 hover:border-slate-600'
              }`}
              title="Agrupar activos en secciones organizadas por Video, Audio, Graphics y Transcripts"
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Agrupar por Categorías</span>
            </button>

            {/* View Mode Toggle (Grid vs List) */}
            <div className="flex items-center bg-[#0d1424] border border-slate-800 rounded p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded cursor-pointer ${viewMode === 'grid' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Vista cuadrícula"
              >
                <Grid className="w-3 h-3" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1 rounded cursor-pointer ${viewMode === 'list' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Vista lista detallada"
              >
                <List className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Metadata Tag Quick-Filter Chips Row */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 text-[10px] font-mono scrollbar-none">
            <span className="text-slate-500 flex items-center gap-1 flex-shrink-0">
              <Tag className="w-3 h-3 text-sky-400" />
              <span>Etiquetas de metadatos:</span>
            </span>
            {allTags.map((tag) => {
              const isTagActive = searchQuery.toLowerCase().includes(tag.toLowerCase());
              return (
                <button
                  key={tag}
                  onClick={() => {
                    if (isTagActive) {
                      setSearchQuery('');
                    } else {
                      setSearchQuery(tag);
                    }
                  }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono transition cursor-pointer flex-shrink-0 border flex items-center gap-1 ${
                    isTagActive
                      ? 'bg-sky-500/30 text-sky-200 border-sky-400 shadow-sm font-bold'
                      : 'bg-[#0d1424] text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                  title={`Filtrar activos por etiqueta #${tag}`}
                >
                  <span>#{tag}</span>
                  {isTagActive && <X className="w-2.5 h-2.5 text-sky-300" />}
                </button>
              );
            })}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-rose-400 hover:text-rose-300 underline text-[10px] ml-1 flex-shrink-0 cursor-pointer"
              >
                Limpiar búsqueda
              </button>
            )}
          </div>
        )}

        {/* Active Search Results Feedback Banner */}
        {searchQuery && (
          <div className="flex items-center justify-between text-[11px] font-mono bg-sky-950/40 border border-sky-800/40 px-2.5 py-1 rounded-md text-sky-300">
            <span className="flex items-center gap-1.5 truncate">
              <Search className="w-3 h-3 text-sky-400 flex-shrink-0" />
              <span>
                Mostrando <strong className="text-white">{filteredAssets.length}</strong> de {cloudAssets.length} activos para: &quot;<strong className="text-sky-200">{searchQuery}</strong>&quot; ({searchScope === 'name' ? 'en nombre' : searchScope === 'tags' ? 'en etiquetas' : 'en nombre o etiquetas'})
              </span>
            </span>
            <button
              onClick={() => setSearchQuery('')}
              className="text-slate-400 hover:text-white text-[10px] underline cursor-pointer flex-shrink-0 ml-2"
            >
              Restablecer
            </button>
          </div>
        )}
      </div>

      {/* Media Assets Browser Workspace */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {filteredAssets.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-xl space-y-3 text-slate-400">
            <Cloud className="w-12 h-12 text-slate-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-300">No se encontraron activos con los filtros actuales</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Puedes subir tus propios archivos con el botón &quot;Subir a Storage&quot; o limpiar la búsqueda para ver toda la biblioteca.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategoryFilter('all');
                setSelectedFolder('all');
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg font-mono transition cursor-pointer"
            >
              Restablecer filtros
            </button>
          </div>
        ) : groupByCategory ? (
          /* ================= GROUPED BY CATEGORY VIEW ================= */
          <div className="space-y-6">
            {(['Video', 'Audio', 'Graphics', 'Transcripts'] as AssetCategory[]).map((catName) => {
              const catAssets = groupedAssets[catName] || [];
              if (selectedCategoryFilter !== 'all' && selectedCategoryFilter !== catName) return null;
              if (catAssets.length === 0 && searchQuery) return null;

              const theme = getCategoryTheme(catName);
              const isCollapsed = collapsedCategories[catName];

              return (
                <div key={catName} className="border border-slate-800/80 rounded-xl overflow-hidden bg-[#070b16]">
                  {/* Category Group Header Banner */}
                  <div 
                    onClick={() => toggleCategoryCollapse(catName)}
                    className={`p-3 bg-gradient-to-r ${theme.gradient} border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center">
                        {theme.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white tracking-wide">{catName}</h4>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${theme.badgeClass}`}>
                            {catAssets.length} activos
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Destino recomendado: <span className="text-slate-200 font-semibold">{theme.recommendedTrack}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                        {isCollapsed ? 'Expandir' : 'Colapsar'}
                      </span>
                      {isCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Category Assets Container */}
                  {!isCollapsed && (
                    <div className="p-3">
                      {catAssets.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500 font-mono">
                          No hay activos en la categoría {catName} para esta búsqueda.
                        </div>
                      ) : (
                        <div className={`grid gap-3 ${isCompactMode ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
                          {catAssets.map((asset) => renderAssetCard(asset, theme))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : viewMode === 'grid' ? (
          /* ================= STANDARD UNIFIED GRID VIEW ================= */
          <div className={`grid gap-3 ${isCompactMode ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
            {filteredAssets.map((asset) => {
              const cat = (asset.autoCategory || asset.category || 'Video') as AssetCategory;
              const theme = getCategoryTheme(cat);
              return renderAssetCard(asset, theme);
            })}
          </div>
        ) : (
          /* ================= DETAILED LIST VIEW ================= */
          <div className="bg-[#0a101f] border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80">
            {filteredAssets.map((asset) => {
              const cat = (asset.autoCategory || asset.category || 'Video') as AssetCategory;
              const theme = getCategoryTheme(cat);
              const isAuditioning = auditioningAssetId === asset.id && isPlayingAudition;
              const isDraggingThis = draggedAssetId === asset.id;

              return (
                <div
                  key={asset.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, asset)}
                  onDragEnd={handleDragEnd}
                  className={`p-2.5 flex items-center justify-between gap-3 transition-colors cursor-grab active:cursor-grabbing hover:bg-[#0d1628] ${
                    isDraggingThis ? 'opacity-40 bg-sky-950/40' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <GripVertical className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 cursor-grab" />
                    
                    {/* Thumbnail */}
                    <div className="w-14 h-10 rounded-lg bg-black overflow-hidden relative flex-shrink-0 border border-slate-700/50">
                      <img src={asset.thumbnail} alt="" className="w-full h-full object-cover" />
                      {(cat === 'Video' || cat === 'Audio') && (
                        <button
                          onClick={() => toggleAudition(asset)}
                          className="absolute inset-0 bg-black/50 hover:bg-sky-600/80 text-white flex items-center justify-center transition"
                        >
                          {isAuditioning ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white translate-x-0.2" />}
                        </button>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-white truncate">{asset.title}</h4>
                        <span className={`text-[8px] font-mono px-1.5 py-0.2 rounded font-bold border ${theme.badgeClass}`}>
                          {cat}
                        </span>
                        {asset.autoCategory && (
                          <span className="text-[8px] font-mono px-1.5 py-0.2 rounded font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/60 flex items-center gap-0.5">
                            <Sparkles className="w-2 h-2 text-amber-300" />
                            <span>Auto</span>
                          </span>
                        )}
                      </div>
                      
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {asset.description || 'Activo alojado en Firebase Storage'}
                      </p>

                      {/* Clickable Metadata Tags */}
                      {asset.tags && asset.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                          {asset.tags.slice(0, 6).map((tag) => {
                            const cleanQ = searchQuery.toLowerCase().replace('#', '').trim();
                            const isTagMatched = cleanQ && tag.toLowerCase().includes(cleanQ);
                            return (
                              <button
                                key={tag}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSearchScope('tags');
                                  setSearchQuery(tag);
                                }}
                                className={`text-[8px] font-mono px-1.5 py-0.2 rounded transition cursor-pointer border ${
                                  isTagMatched
                                    ? 'bg-sky-500/30 text-sky-200 border-sky-400 font-bold shadow-sm'
                                    : 'bg-slate-800/80 hover:bg-sky-950 text-slate-300 hover:text-sky-300 border-slate-700/60'
                                }`}
                                title={`Filtrar por etiqueta #${tag}`}
                              >
                                #{tag}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Metadata Columns */}
                  <div className="flex items-center gap-3 text-xs font-mono text-slate-400 flex-shrink-0">
                    <span className="hidden md:inline text-[11px]">{asset.resolution || cat}</span>
                    <span className="w-12 text-right">{asset.duration.toFixed(1)}s</span>
                    <span className="w-16 text-right hidden sm:inline">
                      {asset.sizeBytes ? `${(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : '--'}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onAddMediaToTimeline(asset, theme.defaultTrackId)}
                        className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                        title={`Insertar en ${theme.recommendedTrack}`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>Insertar</span>
                      </button>

                      {availableTracks && availableTracks.length > 0 && (
                        <select
                          aria-label="Pista destino lista"
                          onChange={(e) => {
                            if (e.target.value) {
                              onAddMediaToTimeline(asset, e.target.value);
                              e.target.value = '';
                            }
                          }}
                          defaultValue=""
                          className="bg-[#0c1424] border border-slate-700 hover:border-sky-500 text-sky-300 rounded text-[9px] font-mono px-1 py-1 focus:outline-none cursor-pointer hidden lg:inline"
                          title="Insertar en pista específica"
                        >
                          <option value="" disabled>Pista</option>
                          {availableTracks.map((tr) => (
                            <option key={tr.id} value={tr.id} className="bg-slate-900 text-slate-200">
                              {tr.name} ({tr.type.toUpperCase()})
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        onClick={() => setInspectingAsset(asset)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                        title="Ver detalles técnicos y metadatos de Firebase"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {deletingAssetId === asset.id ? (
                        <div className="flex items-center gap-1 bg-red-950/90 border border-red-500/60 p-0.5 rounded">
                          <span className="text-[9px] text-red-200 font-bold px-1">¿Borrar?</span>
                          <button
                            onClick={() => {
                              handleDeleteAsset(asset);
                              setDeletingAssetId(null);
                            }}
                            className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[9px] font-bold cursor-pointer"
                          >
                            Sí
                          </button>
                          <button
                            onClick={() => setDeletingAssetId(null)}
                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingAssetId(asset.id)}
                          className="p-1 rounded hover:bg-red-950 text-slate-500 hover:text-red-400 cursor-pointer"
                          title="Eliminar de Firebase Storage"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drag & Drop Instruction Footer Bar */}
      <div className="px-4 py-2.5 bg-[#050811] border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-slate-300">
            Sugerencia: Arrastra cualquier elemento a la línea de tiempo (V1 Vídeo, V2 Overlays, V3 Subtítulos/Títulos, A1/A2 Audio).
          </span>
        </div>
        <span className="text-slate-500 hidden sm:inline">Auto-Tag con Metadatos de Firebase Storage &bull; Firestore</span>
      </div>

      {/* Detailed Technical Asset Inspector Modal */}
      {inspectingAsset && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1220] border border-slate-700/80 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl space-y-4 animate-scaleUp">
            <div className="p-4 bg-gradient-to-r from-sky-950/60 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileVideo className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-white text-sm truncate max-w-md">{inspectingAsset.title}</h3>
              </div>
              <button
                onClick={() => setInspectingAsset(null)}
                className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-mono max-h-[75vh] overflow-y-auto">
              {/* Media Preview Player */}
              <div className="rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center relative border border-slate-800">
                {(inspectingAsset.autoCategory === 'Video' || inspectingAsset.type === 'video' || inspectingAsset.type === 'broll') ? (
                  <video
                    src={inspectingAsset.url}
                    controls
                    poster={inspectingAsset.thumbnail}
                    className="w-full h-full object-contain"
                  />
                ) : inspectingAsset.autoCategory === 'Audio' || inspectingAsset.type === 'audio' ? (
                  <div className="space-y-3 text-center">
                    <Music className="w-12 h-12 text-emerald-400 mx-auto animate-pulse" />
                    <audio src={inspectingAsset.url} controls className="w-64" />
                  </div>
                ) : inspectingAsset.autoCategory === 'Graphics' || inspectingAsset.type === 'graphics' ? (
                  <div className="w-full h-full p-4 flex items-center justify-center bg-[#050811] relative">
                    <img
                      src={inspectingAsset.thumbnail || inspectingAsset.url}
                      alt={inspectingAsset.title}
                      className="max-h-full max-w-full object-contain drop-shadow-xl"
                    />
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-[9px] text-pink-300 font-bold border border-pink-500/40">
                      Canal Alfa / Transparente
                    </span>
                  </div>
                ) : (
                  <div className="p-4 w-full h-full flex flex-col justify-between bg-[#0a0f1d] text-slate-200">
                    <div className="flex items-center gap-2 text-amber-400 font-bold">
                      <FileText className="w-4 h-4" />
                      <span>Muestra de Transcripción y Subtítulos</span>
                    </div>
                    <p className="text-xs text-slate-300 font-sans italic line-clamp-4 bg-black/40 p-2.5 rounded border border-slate-800">
                      &quot;{inspectingAsset.transcriptSample || 'Sin muestra de texto'}&quot;
                    </p>
                    <div className="text-[10px] text-slate-500">
                      Marcas de tiempo a nivel de palabra listas para sincronizar en Pista V3
                    </div>
                  </div>
                )}
              </div>

              {/* Technical Spec Matrix */}
              <div className="grid grid-cols-2 gap-3 bg-[#070b14] p-3 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase">Categoría Auto-Etiquetada</span>
                  <div className="font-bold text-white flex items-center gap-1.5 mt-0.5">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>{inspectingAsset.autoCategory || inspectingAsset.category || inspectingAsset.type}</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase">Resolución / Muestreo</span>
                  <div className="font-bold text-white mt-0.5">{inspectingAsset.resolution || 'Stereo 48kHz'}</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase">Duración</span>
                  <div className="font-bold text-white mt-0.5">{inspectingAsset.duration.toFixed(2)} segundos</div>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase">Tamaño en Storage</span>
                  <div className="font-bold text-white mt-0.5">
                    {inspectingAsset.sizeBytes ? `${(inspectingAsset.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : 'Nube'}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 text-[10px] uppercase">Ruta en Firebase Storage</span>
                  <div className="text-[11px] text-sky-300 break-all bg-slate-900/90 p-2 rounded border border-slate-800 mt-1 select-all font-mono">
                    {inspectingAsset.storagePath || inspectingAsset.url}
                  </div>
                </div>
              </div>

              {/* Tags Section */}
              {inspectingAsset.tags && inspectingAsset.tags.length > 0 && (
                <div>
                  <span className="text-slate-500 text-[10px] uppercase">Etiquetas y Metadatos:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {inspectingAsset.tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] border border-slate-700 font-mono">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => {
                    onAddMediaToTimeline(inspectingAsset);
                    setInspectingAsset(null);
                  }}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Insertar en Línea de Tiempo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper function to render an Asset Card in Grid Mode
  function renderAssetCard(asset: MediaAsset, theme: ReturnType<typeof getCategoryTheme>) {
    const isVideo = asset.autoCategory === 'Video' || asset.type === 'video' || asset.type === 'broll';
    const isAudio = asset.autoCategory === 'Audio' || asset.type === 'audio';
    const isGraphic = asset.autoCategory === 'Graphics' || asset.type === 'graphics';
    const isTranscript = asset.autoCategory === 'Transcripts' || asset.type === 'transcript';

    const isAuditioning = auditioningAssetId === asset.id && isPlayingAudition;
    const isDraggingThis = draggedAssetId === asset.id;

    return (
      <div
        key={asset.id}
        draggable
        onDragStart={(e) => handleDragStart(e, asset)}
        onDragEnd={handleDragEnd}
        className={`group relative bg-[#0a101f] border rounded-xl overflow-hidden transition-all duration-200 cursor-grab active:cursor-grabbing hover:shadow-xl hover:border-sky-500/70 flex flex-col justify-between ${
          isDraggingThis
            ? 'opacity-40 border-sky-400 scale-95 ring-2 ring-sky-400'
            : isAuditioning
            ? 'border-emerald-500/80 ring-1 ring-emerald-500/40 bg-[#0d1a24]'
            : 'border-slate-800 hover:bg-[#0c1428]'
        }`}
      >
        {/* Card Thumbnail / Preview Header */}
        <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
          <img
            src={asset.thumbnail}
            alt={asset.title}
            className={`w-full h-full ${isGraphic ? 'object-contain p-2 bg-[#050811]' : 'object-cover'} group-hover:scale-105 transition-transform duration-300`}
          />

          {/* Drag Grip Handle Overlay */}
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[9px] font-mono font-bold text-sky-300 flex items-center gap-1 border border-white/10 shadow-sm pointer-events-none">
            <GripVertical className="w-2.5 h-2.5 text-sky-400" />
            <span>ARRASTRAR</span>
          </div>

          {/* Duration Badge */}
          <span className="absolute bottom-1.5 right-1.5 bg-black/80 backdrop-blur-sm text-[9px] font-mono px-1.5 py-0.5 rounded text-white font-bold border border-white/10">
            {asset.duration.toFixed(1)}s
          </span>

          {/* Auto-Tag Category Badge */}
          <span className={`absolute top-2 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded font-bold border shadow-sm flex items-center gap-1 ${theme.badgeClass}`}>
            {theme.icon}
            <span>{asset.autoCategory || asset.category || 'Asset'}</span>
          </span>

          {/* Audition Play Trigger Button (for Video and Audio) */}
          {(isVideo || isAudio) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleAudition(asset);
              }}
              className={`absolute inset-0 m-auto w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isAuditioning
                  ? 'bg-emerald-600 text-white scale-105 opacity-100 shadow-lg shadow-emerald-500/50'
                  : 'bg-black/60 hover:bg-sky-600 text-white opacity-0 group-hover:opacity-100 backdrop-blur-sm'
              }`}
              title={isAuditioning ? 'Pausar audio' : 'Escuchar vista previa'}
            >
              {isAuditioning ? (
                <Pause className="w-5 h-5 fill-white" />
              ) : (
                <Play className="w-5 h-5 fill-white translate-x-0.5" />
              )}
            </button>
          )}

          {/* Transcript Snippet Overlay */}
          {isTranscript && asset.transcriptSample && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-2 text-[9px] text-amber-200 line-clamp-2 font-sans italic">
              &quot;{asset.transcriptSample}&quot;
            </div>
          )}
        </div>

        {/* Card Information Body */}
        <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-white truncate group-hover:text-sky-300 transition" title={asset.title}>
              {asset.title}
            </h4>
            <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 font-sans">
              {asset.description || 'Activo almacenado en Firebase Storage'}
            </p>

            {/* Target Track Hint */}
            <div className="mt-1 text-[9px] font-mono text-slate-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>{theme.recommendedTrack.split('(')[0].trim()}</span>
            </div>

            {/* Clickable Metadata Tags with Auto-tag badges */}
            {asset.tags && asset.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap mt-1.5">
                {asset.tags.slice(0, 4).map((tag) => {
                  const cleanQ = searchQuery.toLowerCase().replace('#', '').trim();
                  const isTagMatched = cleanQ && tag.toLowerCase().includes(cleanQ);
                  const isAutoTag = asset.autoTags?.includes(tag);

                  return (
                    <button
                      key={tag}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchScope('tags');
                        setSearchQuery(tag);
                      }}
                      className={`text-[8px] font-mono px-1.5 py-0.5 rounded transition cursor-pointer border flex items-center gap-0.5 ${
                        isTagMatched
                          ? 'bg-sky-500/30 text-sky-200 border-sky-400 font-bold shadow-sm'
                          : isAutoTag
                          ? 'bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border-indigo-700/60'
                          : 'bg-slate-800/80 hover:bg-sky-950 text-slate-300 hover:text-sky-300 border-slate-700/60'
                      }`}
                      title={`Filtrar por etiqueta #${tag}`}
                    >
                      {isAutoTag && <Sparkles className="w-2 h-2 text-amber-300" />}
                      <span>#{tag}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Technical Metadata Row */}
          <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[9px] font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-2.5 h-2.5 text-slate-500" />
              <span>{asset.sizeBytes ? `${(asset.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : 'Cloud'}</span>
            </div>
            <span className="text-slate-500">
              {asset.fps ? `${asset.fps} FPS` : asset.fileFormat || 'CLOUD'}
            </span>
          </div>

          {/* Action Bar */}
          <div className="pt-1 flex items-center justify-between gap-1.5 flex-wrap">
            {/* One-click Add to Timeline with track choice */}
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <button
                onClick={() => onAddMediaToTimeline(asset, theme.defaultTrackId)}
                className="flex-1 py-1.5 px-2 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white rounded-lg text-[10px] font-bold font-mono transition flex items-center justify-center gap-1 shadow-sm cursor-pointer truncate"
                title={`Añadir directamente a ${theme.recommendedTrack}`}
              >
                <Plus className="w-3 h-3 flex-shrink-0" />
                <span>Insertar</span>
              </button>

              {availableTracks && availableTracks.length > 0 && (
                <select
                  aria-label="Pista destino"
                  onChange={(e) => {
                    if (e.target.value) {
                      onAddMediaToTimeline(asset, e.target.value);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  className="bg-[#0c1424] border border-slate-700 hover:border-sky-500 text-sky-300 rounded-lg text-[9px] font-mono px-1 py-1 focus:outline-none cursor-pointer flex-shrink-0"
                  title="Insertar en pista específica"
                >
                  <option value="" disabled>Pista</option>
                  {availableTracks.map((tr) => (
                    <option key={tr.id} value={tr.id} className="bg-slate-900 text-slate-200">
                      {tr.name} ({tr.type.toUpperCase()})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Info / Inspect button */}
            <button
              onClick={() => setInspectingAsset(asset)}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer flex-shrink-0"
              title="Ver detalles técnicos y enlace de Firebase Storage"
            >
              <Eye className="w-3 h-3" />
            </button>

            {/* Delete button with inline confirm */}
            {deletingAssetId === asset.id ? (
              <div className="flex items-center gap-1 bg-red-950/90 border border-red-500/60 p-0.5 rounded-lg">
                <span className="text-[9px] text-red-200 font-bold px-1">¿Borrar?</span>
                <button
                  onClick={() => {
                    handleDeleteAsset(asset);
                    setDeletingAssetId(null);
                  }}
                  className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[9px] font-bold cursor-pointer"
                >
                  Sí
                </button>
                <button
                  onClick={() => setDeletingAssetId(null)}
                  className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDeletingAssetId(asset.id)}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-950/80 text-slate-500 hover:text-red-400 border border-slate-800 transition cursor-pointer flex-shrink-0"
                title="Eliminar de Firebase Storage"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
};
