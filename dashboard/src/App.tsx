import React, { useState, useEffect, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import { Navbar } from './components/Navbar';
import { MetricCards } from './components/MetricCards';
import { VideoPlayer } from './components/VideoPlayer';
import { EventLogTable } from './components/EventLogTable';
import type { CameraZonesConfig, EventLogEntry, EventType } from './types';
import { Info, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [videoSrc, setVideoSrc] = useState<string>('/simulation_demo.mp4');
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [zonesConfig, setZonesConfig] = useState<CameraZonesConfig | null>(null);
  const [currentFrame, setCurrentFrame] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Load default zones.json
  useEffect(() => {
    fetch('/zones.json')
      .then((res) => res.json())
      .then((data: CameraZonesConfig) => {
        setZonesConfig(data);
      })
      .catch((err) => {
        console.warn('Could not load /zones.json, using fallback config:', err);
        setZonesConfig({
          camera_id: 'CAM_01_GATEWAY',
          resolution: { width: 1280, height: 720 },
          tripwires: [
            {
              id: 'LINE_MAIN_ENTRANCE',
              name: 'Main Entrance Tripwire',
              start: [400, 700],
              end: [1500, 700],
              in_label: 'CROSS_IN',
              out_label: 'CROSS_OUT',
            },
          ],
          occupancy_zones: [
            {
              id: 'ZONE_FOYER',
              name: 'Foyer Lobby Area',
              polygon: [
                [350, 450],
                [1550, 450],
                [1600, 950],
                [300, 950],
              ],
              label: 'OCCUPY',
            },
          ],
        });
      });
  }, []);

  // Load default events_log.csv
  useEffect(() => {
    fetch('/events_log.csv')
      .then((res) => res.text())
      .then((csvText) => {
        Papa.parse<any>(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            const parsed: EventLogEntry[] = results.data.map((row: any) => ({
              Frame_ID: Number(row.Frame_ID),
              Track_ID: Number(row.Track_ID),
              BBox_Center_X: Number(row.BBox_Center_X),
              BBox_Center_Y: Number(row.BBox_Center_Y),
              Event_Type: row.Event_Type as EventType,
              Timestamp: String(row.Timestamp),
            }));
            setEvents(parsed);
            setLoading(false);
          },
          error: (err: any) => {
            setErrorMsg(`CSV Parse Error: ${err.message}`);
            setLoading(false);
          },
        });
      })
      .catch((err) => {
        setErrorMsg(`Failed to fetch /events_log.csv: ${err.message}`);
        setLoading(false);
      });
  }, []);

  // Compute live metrics strictly based on current video frame
  const { currentOccupancy, totalIn, totalOut } = useMemo(() => {
    // Cumulative crossings up to currentFrame
    const inEvents = events.filter((e) => e.Event_Type === 'CROSS_IN' && e.Frame_ID <= currentFrame);
    const outEvents = events.filter((e) => e.Event_Type === 'CROSS_OUT' && e.Frame_ID <= currentFrame);

    // Instantaneous occupants inside polygon at currentFrame (distinct tracks)
    const activeOccTracks = new Set(
      events
        .filter((e) => e.Event_Type === 'OCCUPY' && Math.abs(e.Frame_ID - currentFrame) <= 1)
        .map((e) => e.Track_ID)
    );

    return {
      currentOccupancy: activeOccTracks.size,
      totalIn: inEvents.length,
      totalOut: outEvents.length,
    };
  }, [events, currentFrame]);

  // Handle local video upload
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
    }
  };

  // Handle local CSV upload
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse<any>(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsed: EventLogEntry[] = results.data.map((row: any) => ({
            Frame_ID: Number(row.Frame_ID),
            Track_ID: Number(row.Track_ID),
            BBox_Center_X: Number(row.BBox_Center_X),
            BBox_Center_Y: Number(row.BBox_Center_Y),
            Event_Type: row.Event_Type as EventType,
            Timestamp: String(row.Timestamp),
          }));
          setEvents(parsed);
        },
      });
    }
  };

  // Seeking when clicking table row
  const handleSelectFrame = (frameId: number) => {
    setCurrentFrame(frameId);
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, frameId / 30.0);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        onVideoUpload={handleVideoUpload}
        onCSVUpload={handleCSVUpload}
        cameraId={zonesConfig?.camera_id}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {errorMsg && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {loading && (
          <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 text-xs text-slate-400 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Loading simulation data...</span>
          </div>
        )}

        {/* Metric Cards KPI Row */}
        <MetricCards
          currentOccupancy={currentOccupancy}
          totalIn={totalIn}
          totalOut={totalOut}
          maxCapacity={50}
        />

        {/* 2-Column Responsive Layout: Video Player + Event Log */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Video Viewport & Controls (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <VideoPlayer
              videoSrc={videoSrc}
              zonesConfig={zonesConfig}
              events={events}
              currentFrame={currentFrame}
              onFrameUpdate={setCurrentFrame}
              videoRef={videoRef}
            />

            {/* Architecture Scope Notice */}
            <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 text-xs text-slate-400 flex items-start gap-3 backdrop-blur">
              <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200">System Scope Protection:</strong> Single-camera offline recorded
                video only. The dashboard visualizer decouples regional occupancy (O(t)) from directional
                crossing line integrals (vector cross-product). Ground contact points are anchored to
                [x_min + w/2, y_max] to decouple from human height variations.
              </div>
            </div>
          </div>

          {/* Right Column: Standard Data Dictionary Event Table (5 cols) */}
          <div className="lg:col-span-5 h-[560px]">
            <EventLogTable
              events={events}
              currentFrame={currentFrame}
              onSelectFrame={handleSelectFrame}
            />
          </div>
        </div>

        {/* Supervision Sprint 1 Verification Summary Footer */}
        <div className="rounded-xl bg-slate-900/40 border border-slate-800/80 p-5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            Sprint 1 Workflow Verified: Offline Video ➔ Spatial Analytics ➔ CSV Exporter ➔ React Dashboard
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Student: <strong>Adam Zafry</strong></span>
            <span>•</span>
            <span>Supervisor: <strong>Dr. Fadratul Hafinaz Hassan</strong></span>
            <span>•</span>
            <span>CAT405 Major Project</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
