import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Layers,
} from 'lucide-react';
import type { CameraZonesConfig, EventLogEntry } from '../types';

interface VideoPlayerProps {
  videoSrc: string;
  zonesConfig: CameraZonesConfig | null;
  events: EventLogEntry[];
  currentFrame: number;
  onFrameUpdate: (frame: number) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoSrc,
  zonesConfig,
  events,
  currentFrame,
  onFrameUpdate,
  videoRef,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(5.0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const isMuted = true;

  // Overlay toggles
  const [showTripwire, setShowTripwire] = useState<boolean>(true);
  const [showPolygon, setShowPolygon] = useState<boolean>(true);
  const [showAnchors, setShowAnchors] = useState<boolean>(true);

  // Calculate current active pedestrian events for the frame
  const activeEvents = events.filter((e) => Math.abs(e.Frame_ID - currentFrame) <= 1);

  // Video aspect ratio base: 1280x720 or 1920x1080
  const baseWidth = zonesConfig?.resolution.width || 1280;
  const baseHeight = zonesConfig?.resolution.height || 720;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // Approximate 30 FPS conversion
      const frame = Math.max(1, Math.floor(video.currentTime * 30));
      onFrameUpdate(frame);
    };

    const handleLoadedMetadata = () => {
      if (video.duration && !isNaN(video.duration)) {
        setDuration(video.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoRef, onFrameUpdate]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    const frame = Math.max(1, Math.floor(newTime * 30));
    onFrameUpdate(frame);
  };

  const stepFrame = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    const newTime = Math.max(0, Math.min(duration, video.currentTime + delta / 30.0));
    video.currentTime = newTime;
  };

  const changeSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = (timeInSeconds % 60).toFixed(2);
    return `${minutes.toString().padStart(2, '0')}:${seconds.padStart(5, '0')}`;
  };

  return (
    <div className="flex flex-col bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur">
      {/* Video Viewport & SVG Overlay Layer */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden group">
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-contain"
          playsInline
          muted={isMuted}
          loop
          onClick={togglePlay}
        />

        {/* Dynamic SVG Spatial Overlay */}
        <svg
          viewBox={`0 0 ${baseWidth} ${baseHeight}`}
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Occupancy Polygons */}
          {showPolygon &&
            zonesConfig?.occupancy_zones.map((zone) => {
              const pointsStr = zone.polygon.map((p) => `${p[0]},${p[1]}`).join(' ');
              return (
                <g key={zone.id}>
                  <polygon
                    points={pointsStr}
                    fill="rgba(34, 197, 94, 0.15)"
                    stroke="#22c55e"
                    strokeWidth="3"
                    strokeDasharray="6 4"
                  />
                  <text
                    x={zone.polygon[0][0] + 20}
                    y={zone.polygon[0][1] + 35}
                    fill="#4ade80"
                    fontSize="22"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    ROI: {zone.name}
                  </text>
                </g>
              );
            })}

          {/* Tripwire Counting Lines */}
          {showTripwire &&
            zonesConfig?.tripwires.map((wire) => (
              <g key={wire.id}>
                {/* Glow filter */}
                <line
                  x1={wire.start[0]}
                  y1={wire.start[1]}
                  x2={wire.end[0]}
                  y2={wire.end[1]}
                  stroke="rgba(244, 114, 182, 0.4)"
                  strokeWidth="8"
                />
                <line
                  x1={wire.start[0]}
                  y1={wire.start[1]}
                  x2={wire.end[0]}
                  y2={wire.end[1]}
                  stroke="#f472b6"
                  strokeWidth="3"
                />
                <circle cx={wire.start[0]} cy={wire.start[1]} r="6" fill="#f472b6" />
                <circle cx={wire.end[0]} cy={wire.end[1]} r="6" fill="#f472b6" />
                <text
                  x={wire.start[0] + 15}
                  y={wire.start[1] - 15}
                  fill="#f472b6"
                  fontSize="22"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  Tripwire: {wire.name}
                </text>
              </g>
            ))}

          {/* Active Pedestrian Anchors & Bounding Boxes */}
          {showAnchors &&
            activeEvents.map((ev, i) => (
              <g key={i}>
                {/* Simulated ground contact anchor point */}
                <circle
                  cx={ev.BBox_Center_X}
                  cy={ev.BBox_Center_Y}
                  r="9"
                  fill="#facc15"
                  stroke="#000"
                  strokeWidth="2"
                />
                {/* Label tag */}
                <rect
                  x={ev.BBox_Center_X - 45}
                  y={ev.BBox_Center_Y - 40}
                  width="90"
                  height="26"
                  rx="4"
                  fill="rgba(15, 23, 42, 0.85)"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <text
                  x={ev.BBox_Center_X}
                  y={ev.BBox_Center_Y - 22}
                  textAnchor="middle"
                  fill="#38bdf8"
                  fontSize="14"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  ID:{ev.Track_ID}
                </text>
              </g>
            ))}
        </svg>

        {/* Live HUD Header */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-xs pointer-events-none">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-200 backdrop-blur font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Frame: <span className="font-bold text-white">#{currentFrame}</span>
            <span className="text-slate-500">|</span>
            Time: <span className="text-emerald-400 font-semibold">{formatTime(currentTime)}</span>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300 backdrop-blur flex items-center gap-3">
            <span>Active Tracks: <strong className="text-white">{activeEvents.length}</strong></span>
          </div>
        </div>
      </div>

      {/* Scrubber Slider */}
      <div className="px-4 pt-3 pb-1 bg-slate-950/50">
        <input
          type="range"
          min="0"
          max={duration || 5.0}
          step="0.033"
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
      </div>

      {/* Playback Controls & Overlay Toggles */}
      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-slate-800/80 bg-slate-900/60">
        {/* Playback Control Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="p-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition shadow-md flex items-center gap-1.5 text-xs"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            onClick={() => stepFrame(-1)}
            title="Step Back 1 Frame"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={() => stepFrame(1)}
            title="Step Forward 1 Frame"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (videoRef.current) videoRef.current.currentTime = 0;
            }}
            title="Restart Video"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Speed Selector */}
          <div className="flex items-center ml-2 bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            {[0.5, 1.0, 2.0].map((rate) => (
              <button
                key={rate}
                onClick={() => changeSpeed(rate)}
                className={`px-2 py-1 rounded font-medium transition ${
                  playbackRate === rate ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>

        {/* Spatial Overlay Toggles */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 flex items-center gap-1 mr-1">
            <Layers className="w-3.5 h-3.5" /> Overlays:
          </span>

          <label className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700">
            <input
              type="checkbox"
              checked={showTripwire}
              onChange={(e) => setShowTripwire(e.target.checked)}
              className="accent-pink-500 rounded"
            />
            <span className="text-pink-400 font-medium">Tripwires</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700">
            <input
              type="checkbox"
              checked={showPolygon}
              onChange={(e) => setShowPolygon(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
            <span className="text-emerald-400 font-medium">Occupancy ROI</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700">
            <input
              type="checkbox"
              checked={showAnchors}
              onChange={(e) => setShowAnchors(e.target.checked)}
              className="accent-yellow-400 rounded"
            />
            <span className="text-yellow-400 font-medium">Ground Anchors</span>
          </label>
        </div>
      </div>
    </div>
  );
};
