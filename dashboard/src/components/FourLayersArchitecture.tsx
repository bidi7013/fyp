import React, { useState } from 'react';
import { ArrowRight, Video, Cpu, Activity, Database } from 'lucide-react';

export const FourLayersArchitecture: React.FC = () => {
  const [activeLayer, setActiveLayer] = useState<number>(3); // Default to Spatial Analytics

  const layers = [
    {
      id: 4,
      name: 'Data Dictionary & UI',
      icon: Database,
      tag: 'SCHEMA · CSV · REACT',
      desc: 'Standardized image-space CSV output (Frame_ID, Track_ID, Anchor_X, Anchor_Y, Event_Type, Timestamp) and offline client dashboard.',
      color: '#F06548',
    },
    {
      id: 3,
      name: 'Spatial Analytics Engine',
      icon: Activity,
      tag: 'CROSS_IN · OCCUPY · FSM',
      desc: 'Ground-plane bottom-center anchor point math, 2D vector cross-product line crossing, and finite state machine with spatial hysteresis deadbands.',
      color: '#18181B',
    },
    {
      id: 2,
      name: 'Object Detection & Tracker',
      icon: Cpu,
      tag: 'YOLOV8 · BYTETRACK · MOTA',
      desc: 'Deep learning monocular pedestrian detector combined with Kalman filter tracking to maintain consistent Track_IDs across frame sequences.',
      color: '#716B61',
    },
    {
      id: 1,
      name: 'Offline Monocular Video',
      icon: Video,
      tag: 'MP4 · AVI · 30 FPS',
      desc: 'Single-camera recorded footage strictly segregated into development sets (for algorithm tuning) and held-out test sets (for performance reporting).',
      color: '#22C55E',
    },
  ];

  return (
    <section id="layers-section" className="px-6 lg:px-12 max-w-7xl mx-auto my-12">
      <div className="bg-white rounded-3xl border border-[#EAE5DD] shadow-[0_4px_30px_rgba(0,0,0,0.02)] p-8 lg:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Text & Interactive Layer List */}
          <div className="lg:col-span-6 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#F06548] bg-[#FDEFEA] px-3 py-1 rounded-full inline-block mb-3">
                SYSTEM ARCHITECTURE
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#18181B] mb-3 leading-tight">
                One system. Four layers that do the work.
              </h2>
              <p className="text-sm text-[#716B61] leading-relaxed mb-6">
                ASPIRE-Vision connects video ingestion, deep neural detection, deterministic geometry, and
                standardized data export into one cohesive workflow.
              </p>
            </div>

            {/* Layer Selection Items */}
            <div className="divide-y divide-[#EAE5DD]/80 border-t border-b border-[#EAE5DD]/80">
              {layers.map((layer) => {
                const isActive = activeLayer === layer.id;
                const IconComponent = layer.icon;
                return (
                  <div
                    key={layer.id}
                    onClick={() => setActiveLayer(layer.id)}
                    className={`py-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isActive ? 'text-[#F06548]' : 'text-[#18181B] hover:text-[#F06548]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent className={`w-4 h-4 ${isActive ? 'text-[#F06548]' : 'text-[#716B61]'}`} />
                      <span className={`text-sm ${isActive ? 'font-bold text-[#F06548]' : 'font-medium'}`}>
                        {layer.name}
                      </span>
                    </div>
                    <ArrowRight className={`w-4 h-4 transition-transform ${isActive ? 'translate-x-1 text-[#F06548]' : 'text-[#A39C8F]'}`} />
                  </div>
                );
              })}
            </div>

            {/* Active Layer Details Card */}
            <div className="mt-6 p-4 rounded-2xl bg-[#FAF8F5] border border-[#EAE5DD] text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-[#18181B]">
                  Layer {activeLayer}: {layers.find((l) => l.id === activeLayer)?.name}
                </span>
                <span className="font-mono text-[10px] text-[#F06548] font-bold">
                  {layers.find((l) => l.id === activeLayer)?.tag}
                </span>
              </div>
              <p className="text-[#6B655B] leading-relaxed">
                {layers.find((l) => l.id === activeLayer)?.desc}
              </p>
            </div>
          </div>

          {/* Right 3D Isometric Stack Visualizer (Directly inspired by Image 3) */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center p-6 bg-[#FAF8F5] rounded-3xl border border-[#EAE5DD]/60 min-h-[380px]">
            <div className="relative w-72 sm:w-84 h-72 flex flex-col items-center justify-center">
              {/* Layer 4: Top Coral Plaque */}
              <div
                onClick={() => setActiveLayer(4)}
                className={`w-56 sm:w-64 h-16 rounded-2xl bg-[#F06548] shadow-lg flex items-center justify-center text-white font-bold text-xs uppercase tracking-wider cursor-pointer transition-all transform hover:-translate-y-1 ${
                  activeLayer === 4 ? 'ring-4 ring-[#F06548]/30 scale-105' : 'opacity-90'
                }`}
                style={{
                  transform: 'perspective(600px) rotateX(45deg) rotateZ(-20deg)',
                  boxShadow: '0 15px 30px rgba(240,101,72,0.3)',
                }}
              >
                Data & UI Layer
              </div>

              {/* Layer 3: Spatial Analytics Plaque */}
              <div
                onClick={() => setActiveLayer(3)}
                className={`w-56 sm:w-64 h-16 rounded-2xl bg-white border border-[#EAE5DD] shadow-md -mt-4 flex items-center justify-center text-[#18181B] font-bold text-xs uppercase tracking-wider cursor-pointer transition-all transform hover:-translate-y-1 ${
                  activeLayer === 3 ? 'ring-4 ring-[#18181B]/20 scale-105' : 'opacity-95'
                }`}
                style={{
                  transform: 'perspective(600px) rotateX(45deg) rotateZ(-20deg)',
                  boxShadow: '0 12px 25px rgba(0,0,0,0.06)',
                }}
              >
                Spatial Analytics (FSM)
              </div>

              {/* Layer 2: Detection & Tracking Plaque */}
              <div
                onClick={() => setActiveLayer(2)}
                className={`w-56 sm:w-64 h-16 rounded-2xl bg-white border border-[#EAE5DD] shadow-md -mt-4 flex items-center justify-center text-[#18181B] font-bold text-xs uppercase tracking-wider cursor-pointer transition-all transform hover:-translate-y-1 ${
                  activeLayer === 2 ? 'ring-4 ring-[#18181B]/20 scale-105' : 'opacity-90'
                }`}
                style={{
                  transform: 'perspective(600px) rotateX(45deg) rotateZ(-20deg)',
                  boxShadow: '0 10px 20px rgba(0,0,0,0.05)',
                }}
              >
                YOLOv8 + ByteTrack
              </div>

              {/* Layer 1: Base Video Feed (Soft Green Plaque) */}
              <div
                onClick={() => setActiveLayer(1)}
                className={`w-56 sm:w-64 h-16 rounded-2xl bg-[#EAF0E6] border border-[#C5D9BE] shadow-md -mt-4 flex items-center justify-center text-[#2F6838] font-bold text-xs uppercase tracking-wider cursor-pointer transition-all transform hover:-translate-y-1 ${
                  activeLayer === 1 ? 'ring-4 ring-[#22C55E]/30 scale-105' : 'opacity-90'
                }`}
                style={{
                  transform: 'perspective(600px) rotateX(45deg) rotateZ(-20deg)',
                  boxShadow: '0 8px 15px rgba(34,197,94,0.1)',
                }}
              >
                Offline Video Feed
              </div>
            </div>

            <span className="text-[10px] text-[#A39C8F] font-mono mt-4">
              Click any layer to inspect architectural reasoning
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
