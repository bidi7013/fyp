import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import type { CameraZonesConfig, EventLogEntry } from '../types';

interface WorkstationStageProps {
  videoSrc: string;
  zonesConfig: CameraZonesConfig | null;
  events: EventLogEntry[];
  currentFrame: number;
  onFrameUpdate: (frame: number) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentOccupancy: number;
  totalIn: number;
  totalOut: number;
  maxCapacity?: number;
}

export const WorkstationStage: React.FC<WorkstationStageProps> = ({
  videoSrc,
  zonesConfig,
  events,
  currentFrame,
  onFrameUpdate,
  videoRef,
  currentOccupancy,
  totalIn,
  totalOut,
  maxCapacity = 50,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(5.0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [selectedTrackId, setSelectedTrackId] = useState<number>(1);

  // Layer toggles
  const [showTripwire, setShowTripwire] = useState<boolean>(true);
  const [showPolygon, setShowPolygon] = useState<boolean>(true);
  const [showAnchors, setShowAnchors] = useState<boolean>(true);

  // Active pedestrian events at current frame
  const activeEvents = events.filter((e) => Math.abs(e.Frame_ID - currentFrame) <= 1);
  const activeTrackIds = Array.from(new Set(activeEvents.map((e) => e.Track_ID)));

  // Resolution
  const baseWidth = zonesConfig?.resolution.width || 1280;
  const baseHeight = zonesConfig?.resolution.height || 720;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
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

  // Distinct tracks mock list for the left column
  const trackedEntities = [
    {
      id: 1,
      name: 'Pedestrian #1',
      action: 'Traversed LINE_MAIN_ENTRANCE',
      type: 'CROSS_IN',
      avatarBg: 'bg-[#F06548]',
      time: '08:00:02.60',
    },
    {
      id: 2,
      name: 'Pedestrian #2',
      action: 'In Foyer Area (ZONE_FOYER)',
      type: 'OCCUPY',
      avatarBg: 'bg-[#18181B]',
      time: '08:00:03.56',
    },
    {
      id: 3,
      name: 'Pedestrian #3 (Loiter)',
      action: 'Filtered by Hysteresis Deadband',
      type: 'FILTERED',
      avatarBg: 'bg-[#5C6B50]',
      time: '08:00:01.40',
    },
  ];

  const occupancyRatio = Math.min(1, currentOccupancy / maxCapacity);
  const occupancyPercent = Math.round(occupancyRatio * 100);

  return (
    <section id="stage-section" className="px-6 lg:px-12 max-w-7xl mx-auto my-6">
      <div className="bg-white rounded-3xl border border-[#EAE5DD] shadow-[0_12px_44px_rgba(0,0,0,0.03)] overflow-hidden">
        {/* 3-Column Workstation Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#EAE5DD]">
          {/* Left Column: Tracked Entities Queue (3 cols) */}
          <div className="lg:col-span-3 flex flex-col bg-[#FDFCFB]">
            {/* Header */}
            <div className="p-4 border-b border-[#EAE5DD] flex items-center justify-between">
              <span className="text-xs font-bold text-[#18181B]">Tracked Entities</span>
              <span className="text-[11px] font-semibold text-[#F06548] bg-[#FDEFEA] px-2 py-0.5 rounded-full">
                {activeTrackIds.length > 0 ? `${activeTrackIds.length} ACTIVE` : 'READY'}
              </span>
            </div>

            {/* Entity List */}
            <div className="divide-y divide-[#F3EFE8] overflow-y-auto max-h-[580px]">
              {trackedEntities.map((item) => {
                const isSelected = selectedTrackId === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedTrackId(item.id);
                      // Seek to frame where this item was active
                      if (item.id === 1) onFrameUpdate(78);
                      if (item.id === 2) onFrameUpdate(107);
                      if (videoRef.current) {
                        videoRef.current.currentTime = item.id === 1 ? 2.6 : item.id === 2 ? 3.56 : 1.4;
                      }
                    }}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-white border-l-3 border-[#F06548]' : 'hover:bg-[#F9F7F3]'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full ${item.avatarBg} text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 shadow-sm`}
                    >
                      P{item.id}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-bold text-[#18181B] truncate">{item.name}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                            item.type === 'CROSS_IN'
                              ? 'bg-[#FDE7E3] text-[#F06548]'
                              : item.type === 'OCCUPY'
                              ? 'bg-[#EAF0E6] text-[#2F6838]'
                              : 'bg-[#EAE5DD] text-[#716B61]'
                          }`}
                        >
                          {item.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#716B61] line-clamp-1 leading-snug">{item.action}</p>
                      <span className="text-[10px] text-[#A39C8F] font-mono mt-1 inline-block">
                        {item.time}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Informational item */}
              <div className="p-4 bg-[#F7F5F0]/70 text-[11px] text-[#716B61] leading-relaxed border-t border-[#EAE5DD]">
                <p className="font-semibold text-[#18181B] mb-1">Decoupled Spatial Ground Anchor</p>
                Points evaluated at base center <code className="text-[#F06548] font-mono font-bold">[x+w/2, y+h]</code> to decouple camera perspective pitch from pedestrian height variations.
              </div>
            </div>
          </div>

          {/* Center Column: Video Stage Viewport (6 cols) */}
          <div className="lg:col-span-6 flex flex-col bg-white">
            {/* Viewport Top Header */}
            <div className="px-5 py-3 border-b border-[#EAE5DD] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-pulse"></div>
                <span className="font-bold text-[#18181B]">Single-Camera Monocular Feed</span>
                <span className="text-[#A39C8F]">·</span>
                <span className="text-[#716B61] font-mono text-[11px]">1280x720 @ 30 FPS</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-[#716B61]">
                <span>FRAME #{currentFrame}</span>
                <span>·</span>
                <span className="text-[#F06548] font-bold">{formatTime(currentTime)}</span>
              </div>
            </div>

            {/* Video Canvas Container */}
            <div className="relative w-full aspect-video bg-[#0D0F12] flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                src={videoSrc}
                className="w-full h-full object-contain cursor-pointer"
                playsInline
                muted
                loop
                onClick={togglePlay}
              />

              {/* Scaled Dynamic SVG Overlays */}
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
                          fill="rgba(34, 197, 94, 0.12)"
                          stroke="#22C55E"
                          strokeWidth="2.5"
                          strokeDasharray="6 4"
                        />
                        <text
                          x={zone.polygon[0][0] + 20}
                          y={zone.polygon[0][1] + 32}
                          fill="#22C55E"
                          fontSize="22"
                          fontWeight="bold"
                          fontFamily="sans-serif"
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
                      <line
                        x1={wire.start[0]}
                        y1={wire.start[1]}
                        x2={wire.end[0]}
                        y2={wire.end[1]}
                        stroke="#F06548"
                        strokeWidth="3.5"
                      />
                      <circle cx={wire.start[0]} cy={wire.start[1]} r="7" fill="#F06548" />
                      <circle cx={wire.end[0]} cy={wire.end[1]} r="7" fill="#F06548" />
                      <text
                        x={wire.start[0] + 15}
                        y={wire.start[1] - 15}
                        fill="#F06548"
                        fontSize="22"
                        fontWeight="bold"
                        fontFamily="sans-serif"
                      >
                        Tripwire: {wire.name}
                      </text>
                    </g>
                  ))}

                {/* Active Pedestrian Ground Anchors & Tags */}
                {showAnchors &&
                  activeEvents.map((ev, i) => (
                    <g key={i}>
                      {/* Ground contact anchor */}
                      <circle
                        cx={ev.BBox_Center_X}
                        cy={ev.BBox_Center_Y}
                        r="8"
                        fill="#FACC15"
                        stroke="#18181B"
                        strokeWidth="2.5"
                      />
                      {/* Label badge */}
                      <rect
                        x={ev.BBox_Center_X - 44}
                        y={ev.BBox_Center_Y - 38}
                        width="88"
                        height="24"
                        rx="4"
                        fill="rgba(24, 24, 27, 0.9)"
                        stroke="#F06548"
                        strokeWidth="1.5"
                      />
                      <text
                        x={ev.BBox_Center_X}
                        y={ev.BBox_Center_Y - 22}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="13"
                        fontWeight="bold"
                        fontFamily="sans-serif"
                      >
                        ID #{ev.Track_ID}
                      </text>
                    </g>
                  ))}
              </svg>

              {/* Floating Event Bubble (styled after prompt inspiration) */}
              <div className="absolute bottom-3 left-4 right-4 pointer-events-none">
                <div className="bg-[#18181B]/95 text-white backdrop-blur rounded-2xl p-3 shadow-xl border border-white/10 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#F06548] animate-ping"></span>
                    <div>
                      <span className="text-[#A39C8F] text-[11px] block">Spatial Analytics Engine</span>
                      <span className="font-semibold text-white">
                        {currentFrame < 78
                          ? 'Evaluating pedestrian trajectories toward boundary tripwire...'
                          : currentFrame < 107
                          ? 'Event Trigger: ID #1 crossed LINE_MAIN_ENTRANCE into Foyer.'
                          : 'Event Trigger: ID #2 crossed LINE_MAIN_ENTRANCE into Foyer.'}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] bg-white/10 px-2.5 py-1 rounded-full text-slate-200">
                    Confidence: 96%
                  </span>
                </div>
              </div>
            </div>

            {/* Video Scrubber Slider */}
            <div className="px-5 pt-3 pb-1 bg-white">
              <input
                type="range"
                min="0"
                max={duration || 5.0}
                step="0.033"
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-[#EAE5DD] rounded-lg appearance-none cursor-pointer accent-[#F06548]"
              />
            </div>

            {/* Playback Controls & Overlay Toggles */}
            <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EAE5DD] bg-[#FAF8F5]">
              {/* Play / Step Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={togglePlay}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F06548] hover:bg-[#DE5337] text-white text-xs font-semibold transition shadow-sm cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <button
                  onClick={() => stepFrame(-1)}
                  title="Step Back 1 Frame"
                  className="p-2 rounded-full bg-white border border-[#E5E0D8] hover:bg-[#EFECE6] text-[#18181B] transition cursor-pointer"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => stepFrame(1)}
                  title="Step Forward 1 Frame"
                  className="p-2 rounded-full bg-white border border-[#E5E0D8] hover:bg-[#EFECE6] text-[#18181B] transition cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => {
                    if (videoRef.current) videoRef.current.currentTime = 0;
                  }}
                  title="Restart"
                  className="p-2 rounded-full bg-white border border-[#E5E0D8] hover:bg-[#EFECE6] text-[#18181B] transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Speed Selector */}
                <div className="flex items-center ml-2 bg-white border border-[#E5E0D8] rounded-full p-0.5 text-xs">
                  {[0.5, 1.0, 2.0].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => changeSpeed(rate)}
                      className={`px-2 py-0.5 rounded-full font-medium transition cursor-pointer ${
                        playbackRate === rate ? 'bg-[#18181B] text-white font-bold' : 'text-[#716B61]'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Overlays Checkboxes */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#8A8275] flex items-center gap-1 text-[11px] mr-1">
                  <Layers className="w-3 h-3" /> Overlays:
                </span>

                <label className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-full bg-white border border-[#E5E0D8] text-[11px] font-medium text-[#18181B]">
                  <input
                    type="checkbox"
                    checked={showTripwire}
                    onChange={(e) => setShowTripwire(e.target.checked)}
                    className="accent-[#F06548] rounded"
                  />
                  <span>Tripwire</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-full bg-white border border-[#E5E0D8] text-[11px] font-medium text-[#18181B]">
                  <input
                    type="checkbox"
                    checked={showPolygon}
                    onChange={(e) => setShowPolygon(e.target.checked)}
                    className="accent-[#22C55E] rounded"
                  />
                  <span>Occupancy</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-full bg-white border border-[#E5E0D8] text-[11px] font-medium text-[#18181B]">
                  <input
                    type="checkbox"
                    checked={showAnchors}
                    onChange={(e) => setShowAnchors(e.target.checked)}
                    className="accent-[#FACC15] rounded"
                  />
                  <span>Base Point</span>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Live Telemetry & Donut Chart (3 cols) */}
          <div className="lg:col-span-3 p-5 flex flex-col justify-between bg-[#FDFCFB]">
            {/* Donut Chart Widget (Inspired directly by Image 1) */}
            <div className="p-4 rounded-2xl bg-white border border-[#EAE5DD] shadow-sm mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A8275] block mb-2">
                ZONE OCCUPANCY
              </span>
              <div className="flex items-center gap-4">
                {/* SVG Donut Ring */}
                <div className="relative w-16 h-16 shrink-0">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                    {/* Background circle */}
                    <path
                      className="text-[#EFECE6]"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    {/* Foreground coral circle */}
                    <path
                      className="text-[#F06548] transition-all duration-300"
                      strokeDasharray={`${occupancyPercent}, 100`}
                      strokeWidth="3.8"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-[#18181B]">
                    {occupancyPercent}%
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-extrabold text-[#18181B] tracking-tight">
                    {currentOccupancy} <span className="text-xs font-normal text-[#8A8275]">/ {maxCapacity} cap</span>
                  </div>
                  <span className="text-[11px] font-medium text-[#22C55E] flex items-center gap-1 mt-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Foyer Density Safe
                  </span>
                </div>
              </div>
            </div>

            {/* Vertical Flow Distribution Chart (Inspired by Image 1) */}
            <div className="p-4 rounded-2xl bg-white border border-[#EAE5DD] shadow-sm mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#8A8275] block mb-2">
                HOURLY FLUX DISTRIBUTION
              </span>
              <div className="flex items-end gap-2 h-16 pt-2">
                {[15, 25, 45, 60, 85, 40, 20].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t-md transition-all ${
                        i === 4 ? 'bg-[#F06548]' : 'bg-[#18181B]'
                      }`}
                      style={{ height: `${h}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[9px] text-[#A39C8F] mt-2 font-mono">
                <span>08:00</span>
                <span>08:30 (Peak)</span>
                <span>09:00</span>
              </div>
            </div>

            {/* Metadata Parameters List */}
            <div className="p-4 rounded-2xl bg-white border border-[#EAE5DD] shadow-sm text-xs space-y-2.5">
              <div className="flex justify-between">
                <span className="text-[#8A8275]">Camera Feed</span>
                <span className="font-semibold text-[#18181B] font-mono">CAM_01_GATEWAY</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8A8275]">Ground Anchor</span>
                <span className="font-semibold text-[#18181B] font-mono">[x+w/2, y+h]</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8A8275]">Hysteresis Deadband</span>
                <span className="font-semibold text-[#F06548] font-mono font-bold">±10.0 px</span>
              </div>
              <div className="flex justify-between border-t border-[#F3EFE8] pt-2">
                <span className="text-[#8A8275]">Net Accumulation (ΔN)</span>
                <span className="font-bold text-[#18181B]">
                  {totalIn - totalOut > 0 ? `+${totalIn - totalOut}` : totalIn - totalOut}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
