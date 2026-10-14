/**
 * Helper utilities for SMPTE Timecode and frame conversions
 */

export function secondsToTimecode(seconds: number, fps: number = 30): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  
  const totalFrames = Math.floor(seconds * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(seconds);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
}

export function timecodeToSeconds(timecode: string, fps: number = 30): number {
  const parts = timecode.split(':').map((p) => parseInt(p, 10) || 0);
  if (parts.length !== 4) return 0;
  const [hours, mins, secs, frames] = parts;
  return hours * 3600 + mins * 60 + secs + frames / fps;
}
