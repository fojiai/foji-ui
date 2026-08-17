"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Pause, Play, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const SPEEDS = [1, 1.5, 2] as const;
const BAR_COUNT = 36;

/** Stable per-clip waveform. We never decode the audio (that would mean fetching
 *  and decoding every voice note in the thread), so the bars are a deterministic
 *  function of the URL — the same clip always draws the same shape. */
function waveform(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h ^= h >>> 13;
    const n = ((h >>> 0) % 1000) / 1000;
    // Envelope: speech tapers at both ends, so a flat noise field reads as a
    // progress bar rather than as a recording.
    const envelope = Math.sin((Math.PI * (i + 0.5)) / BAR_COUNT) ** 0.6;
    bars.push(0.22 + n * 0.78 * envelope);
  }
  return bars;
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AudioPlayer({ src, className }: { src: string; className?: string }) {
  const t = useTranslations();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(NaN);
  const [speed, setSpeed] = useState<number>(SPEEDS[0]);
  const [failed, setFailed] = useState(false);

  const bars = useMemo(() => waveform(src), [src]);
  const progress = Number.isFinite(duration) && duration > 0 ? current / duration : 0;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onLoaded = () => {
      // WhatsApp voice notes arrive as Opus in an Ogg/WebM container, which
      // often reports Infinity until the browser has seen the end of the
      // stream. Nudging the position past the end forces it to resolve.
      if (el.duration === Infinity) {
        el.currentTime = 1e101;
        return;
      }
      setDuration(el.duration);
    };
    const onTime = () => {
      if (el.duration === Infinity) return; // still resolving; ignore the probe seek
      setCurrent(el.currentTime);
    };
    const onDurationChange = () => {
      if (Number.isFinite(el.duration)) {
        setDuration(el.duration);
        if (el.currentTime > el.duration) el.currentTime = 0;
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
      el.currentTime = 0;
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => setFailed(true);

    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("durationchange", onDurationChange);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("error", onError);

    // A cached clip can be ready before this effect runs, in which case
    // loadedmetadata already fired and we would sit on "--:--" forever.
    if (el.readyState >= 1) onLoaded();

    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("durationchange", onDurationChange);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("error", onError);
    };
  }, []);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      // Only one clip plays at a time — a thread of voice notes talking over
      // each other is the fastest way to make an inbox unusable.
      document.querySelectorAll("audio").forEach((other) => {
        if (other !== el) other.pause();
      });
      el.play().catch(() => setFailed(true));
    } else {
      el.pause();
    }
  }, []);

  const seekToClientX = useCallback(
    (clientX: number) => {
      const el = audioRef.current;
      const track = trackRef.current;
      if (!el || !track || !Number.isFinite(duration) || duration <= 0) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      el.currentTime = ratio * duration;
      setCurrent(el.currentTime);
    },
    [duration]
  );

  function nudge(delta: number) {
    const el = audioRef.current;
    if (!el || !Number.isFinite(duration)) return;
    el.currentTime = Math.min(duration, Math.max(0, el.currentTime + delta));
    setCurrent(el.currentTime);
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  if (failed) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs italic opacity-80">
        <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
        {t("audio.unavailable")}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "flex w-[min(17rem,100%)] items-center gap-2.5 rounded-xl bg-current/8 px-2 py-1.5",
        className
      )}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? t("audio.pause") : t("audio.play")}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-current/15 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50 active:scale-95"
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
        )}
      </button>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label={t("audio.seek")}
          aria-valuemin={0}
          aria-valuemax={Number.isFinite(duration) ? Math.round(duration) : 0}
          aria-valuenow={Math.round(current)}
          aria-valuetext={clock(current)}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            seekToClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) seekToClientX(e.clientX);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); nudge(5); }
            if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-5); }
            if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); }
          }}
          className="flex h-6 cursor-pointer touch-none items-center gap-[2px] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50"
        >
          {bars.map((h, i) => {
            const played = (i + 1) / BAR_COUNT <= progress;
            return (
              <span
                key={i}
                aria-hidden
                style={{ height: `${Math.round(h * 100)}%` }}
                className={cn(
                  "min-h-[3px] flex-1 rounded-full bg-current transition-opacity",
                  played ? "opacity-100" : "opacity-25"
                )}
              />
            );
          })}
        </span>

        <span className="flex items-center justify-between gap-2 text-[10px] opacity-80">
          <span className="type-readout">
            {clock(current)} / {clock(duration)}
          </span>
          <button
            type="button"
            onClick={cycleSpeed}
            aria-label={t("audio.speed")}
            className="type-readout rounded px-1 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50"
          >
            {speed}×
          </button>
        </span>
      </span>
    </span>
  );
}
