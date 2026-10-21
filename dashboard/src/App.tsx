import React, { useState, useEffect, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { WorkstationStage } from './components/WorkstationStage';
import { MetricCards } from './components/MetricCards';
import { FourLayersArchitecture } from './components/FourLayersArchitecture';
import { InteractiveFeatures } from './components/InteractiveFeatures';
import { EventLogTable } from './components/EventLogTable';
import type { CameraZonesConfig, EventLogEntry, EventType } from './types';
import { AlertTriangle, Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const [videoSrc, setVideoSrc] = useState<string>('/simulation_demo.webm');
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
    const inEvents = events.filter((e) => e.Event_Type === 'CROSS_IN' && e.Frame_ID <= currentFrame);
    const outEvents = events.filter((e) => e.Event_Type === 'CROSS_OUT' && e.Frame_ID <= currentFrame);

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

  // Download CSV
  const handleExportCSV = () => {
    const headers = ['Frame_ID', 'Track_ID', 'BBox_Center_X', 'BBox_Center_Y', 'Event_Type', 'Timestamp'];
    const rows = events.map((e) => [
      e.Frame_ID,
      e.Track_ID,
      e.BBox_Center_X,
      e.BBox_Center_Y,
      e.Event_Type,
      e.Timestamp,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `aspire_vision_events_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#18181B] flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        onVideoUpload={handleVideoUpload}
        onCSVUpload={handleCSVUpload}
        onExportCSV={handleExportCSV}
        onScrollToStage={() => scrollTo('stage-section')}
        onScrollToLayers={() => scrollTo('layers-section')}
        onScrollToLogs={() => scrollTo('logs-section')}
        cameraId={zonesConfig?.camera_id}
      />

      {/* Main Content Sections */}
      <main className="flex-1 flex flex-col">
        {/* Error / Loading alerts */}
        {errorMsg && (
          <div className="max-w-7xl mx-auto px-6 lg:px-12 w-full mt-4">
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          </div>
        )}
        {loading && (
          <div className="max-w-7xl mx-auto px-6 lg:px-12 w-full mt-4">
            <div className="rounded-2xl bg-[#EFECE6] border border-[#E5E0D8] p-3.5 text-xs text-[#716B61] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#F06548]" />
              <span>Loading simulation records and pre-rendered video assets...</span>
            </div>
          </div>
        )}

        {/* 1. Hero Section */}
        <HeroSection
          onStartSimulation={() => {
            scrollTo('stage-section');
            if (videoRef.current) videoRef.current.play();
          }}
          onExploreArchitecture={() => scrollTo('layers-section')}
        />

        {/* 2. Interactive Workstation Stage (Image 1 inspo) */}
        <WorkstationStage
          videoSrc={videoSrc}
          zonesConfig={zonesConfig}
          events={events}
          currentFrame={currentFrame}
          onFrameUpdate={setCurrentFrame}
          videoRef={videoRef}
          currentOccupancy={currentOccupancy}
          totalIn={totalIn}
          totalOut={totalOut}
          maxCapacity={50}
        />

        {/* 3. Metric Cards with Minimalist Sparkline Curves (Image 2 inspo) */}
        <MetricCards
          currentOccupancy={currentOccupancy}
          totalIn={totalIn}
          totalOut={totalOut}
          maxCapacity={50}
        />

        {/* 4. Four Layers System Architecture (Image 3 inspo) */}
        <FourLayersArchitecture />

        {/* 5. Analytic Capabilities (Image 4 inspo) */}
        <InteractiveFeatures />

        {/* 6. Standard Data Dictionary Event Log Stream */}
        <EventLogTable
          events={events}
          currentFrame={currentFrame}
          onSelectFrame={handleSelectFrame}
        />

        {/* Editorial Footer */}
        <footer className="mt-16 border-t border-[#EAE5DD] bg-white py-10 px-6 lg:px-12">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#8A8275]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#22C55E]"></div>
              <span className="font-semibold text-[#18181B]">ASPIRE-Vision System</span>
              <span>· CAT405 Intelligent Computing Major Project</span>
            </div>
            <div className="flex items-center gap-5 text-[11px]">
              <span>Student: <strong className="text-[#18181B]">Adam Zafry Bin Zaharin</strong></span>
              <span>•</span>
              <span>Supervisor: <strong className="text-[#18181B]">Dr. Fadratul Hafinaz Hassan</strong></span>
              <span>•</span>
              <span>School of Computer Sciences, USM</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default App;
