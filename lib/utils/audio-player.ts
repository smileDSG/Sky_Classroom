/**
 * Audio Player - Audio player interface
 *
 * Handles audio playback, pause, stop, and other operations
 * Loads pre-generated TTS audio files from IndexedDB
 *
 */

import { db } from '@/lib/utils/database';
import { createLogger } from '@/lib/logger';

const log = createLogger('AudioPlayer');

/**
 * Audio player implementation
 */
export class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private onEndedCallback: (() => void) | null = null;
  private muted: boolean = false;
  private volume: number = 1;
  private playbackRate: number = 1;
  // Preloaded element for the next expected audio (avoids sentence-gap network stalls)
  private prefetchedAudio: HTMLAudioElement | null = null;
  private prefetchedKey: string | null = null;
  private prefetchedBlobUrl: string | null = null;
  private prefetchInFlight: boolean = false;

  private static key(audioId: string, audioUrl?: string): string {
    return `${audioId}\u0000${audioUrl || ''}`;
  }

  /**
   * Preload audio for a future play() call. The element stays paused until
   * play() is invoked with the same (audioId, audioUrl) pair, then it is
   * reused so playback starts with no network/IndexedDB latency.
   */
  public async prefetch(audioId: string, audioUrl?: string): Promise<void> {
    if (this.prefetchedAudio || this.prefetchInFlight || !audioId) return;
    this.prefetchInFlight = true;
    try {
      let src: string;
      let blobUrl: string | null = null;
      if (audioUrl) {
        src = audioUrl;
      } else {
        const audioRecord = await db.audioFiles.get(audioId);
        if (!audioRecord) return;
        blobUrl = URL.createObjectURL(audioRecord.blob);
        src = blobUrl;
      }
      const el = new Audio();
      el.preload = 'auto';
      el.src = src;
      el.volume = this.muted ? 0 : this.volume;
      el.defaultPlaybackRate = this.playbackRate;
      el.load();
      this.prefetchedAudio = el;
      this.prefetchedBlobUrl = blobUrl;
      this.prefetchedKey = AudioPlayer.key(audioId, audioUrl);
    } catch (error) {
      log.warn('Audio prefetch failed:', error);
      this.clearPrefetched();
    } finally {
      this.prefetchInFlight = false;
    }
  }

  private clearPrefetched(): void {
    if (this.prefetchedBlobUrl) {
      URL.revokeObjectURL(this.prefetchedBlobUrl);
      this.prefetchedBlobUrl = null;
    }
    this.prefetchedAudio = null;
    this.prefetchedKey = null;
  }

  /**
   * Play audio (from URL or IndexedDB pre-generated cache)
   * @param audioId Audio ID
   * @param audioUrl Optional server-generated audio URL (takes priority over IndexedDB)
   * @returns true if audio started playing, false if no audio (TTS disabled or not generated)
   */
  public async play(audioId: string, audioUrl?: string): Promise<boolean> {
    try {
      // Reuse the prefetched element when it matches the requested audio
      const key = AudioPlayer.key(audioId, audioUrl);
      if (this.prefetchedAudio && this.prefetchedKey === key) {
        const el = this.prefetchedAudio;
        this.prefetchedAudio = null;
        this.prefetchedKey = null;
        const blobUrl = this.prefetchedBlobUrl;
        this.prefetchedBlobUrl = null;
        this.stop();
        this.audio = el;
        this.audio.addEventListener('ended', () => {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          this.onEndedCallback?.();
        });
        await this.audio.play();
        this.audio.playbackRate = this.playbackRate;
        return true;
      }
      this.clearPrefetched();

      // 1. Try audioUrl first (server-generated TTS)
      if (audioUrl) {
        this.stop();
        this.audio = new Audio();
        this.audio.src = audioUrl;
        if (this.muted) this.audio.volume = 0;
        else this.audio.volume = this.volume;
        this.audio.defaultPlaybackRate = this.playbackRate;
        this.audio.playbackRate = this.playbackRate;
        this.audio.addEventListener('ended', () => {
          this.onEndedCallback?.();
        });
        await this.audio.play();
        this.audio.playbackRate = this.playbackRate;
        return true;
      }

      // 2. Fall back to IndexedDB (client-generated TTS)
      const audioRecord = await db.audioFiles.get(audioId);

      if (!audioRecord) {
        // Pre-generated audio does not exist (generation failed), skip silently
        return false;
      }

      // Stop current playback
      this.stop();

      // Create audio element
      this.audio = new Audio();

      // Set audio source
      const blobUrl = URL.createObjectURL(audioRecord.blob);
      this.audio.src = blobUrl;
      if (this.muted) this.audio.volume = 0;
      else this.audio.volume = this.volume;

      // Apply playback rate
      this.audio.defaultPlaybackRate = this.playbackRate;
      this.audio.playbackRate = this.playbackRate;

      // Set ended callback
      this.audio.addEventListener('ended', () => {
        URL.revokeObjectURL(blobUrl);
        this.onEndedCallback?.();
      });

      // Play
      await this.audio.play();
      // Re-apply after play() — some browsers reset during load
      this.audio.playbackRate = this.playbackRate;
      return true;
    } catch (error) {
      log.error('Failed to play audio:', error);
      throw error;
    }
  }

  /**
   * Pause playback
   */
  public pause(): void {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
  }

  /**
   * Stop playback
   */
  public stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    // Note: onEndedCallback intentionally NOT cleared here because play()
    // calls stop() internally — clearing would break the callback chain.
    // Stale callbacks are harmless: engine mode check prevents processNext().
  }

  /**
   * Resume playback
   */
  public resume(): void {
    if (this.audio?.paused) {
      this.audio.playbackRate = this.playbackRate;
      this.audio.play().catch((error) => {
        log.error('Failed to resume audio:', error);
      });
    }
  }

  /**
   * Get current playback status (actively playing, not paused)
   */
  public isPlaying(): boolean {
    return this.audio !== null && !this.audio.paused;
  }

  /**
   * Whether there is active audio (playing or paused, but not ended)
   * Used to decide whether to resume playback or skip to the next line
   */
  public hasActiveAudio(): boolean {
    return this.audio !== null;
  }

  /**
   * Get current playback time (milliseconds)
   */
  public getCurrentTime(): number {
    return this.audio ? this.audio.currentTime * 1000 : 0;
  }

  /**
   * Get audio duration (milliseconds)
   */
  public getDuration(): number {
    return this.audio && !isNaN(this.audio.duration) ? this.audio.duration * 1000 : 0;
  }

  /**
   * Set playback ended callback
   */
  public onEnded(callback: () => void): void {
    this.onEndedCallback = callback;
  }

  /**
   * Set mute state (takes effect immediately on currently playing audio)
   */
  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.audio) {
      this.audio.volume = muted ? 0 : this.volume;
    }
  }

  /**
   * Set volume (0-1)
   */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audio && !this.muted) {
      this.audio.volume = this.volume;
    }
  }

  /**
   * Set playback speed (takes effect immediately on currently playing audio)
   */
  public setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.5, Math.min(2, rate));
    if (this.audio) {
      this.audio.playbackRate = this.playbackRate;
    }
  }

  /**
   * Destroy the player
   */
  public destroy(): void {
    this.stop();
    this.clearPrefetched();
    this.onEndedCallback = null;
  }
}

/**
 * Create an audio player instance
 */
export function createAudioPlayer(): AudioPlayer {
  return new AudioPlayer();
}
