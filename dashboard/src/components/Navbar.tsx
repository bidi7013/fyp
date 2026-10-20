import React from 'react';
import { ShieldCheck, Video, Upload, Camera } from 'lucide-react';

interface NavbarProps {
  onVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCSVUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  cameraId?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onVideoUpload,
  onCSVUpload,
  cameraId = 'CAM_01_GATEWAY',
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-white">
                ASPIRE-Vision
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                CAT405 FYP
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Intelligent Pedestrian Analytics & Directional Counting Dashboard
            </p>
          </div>
        </div>

        {/* System & Camera Status Badges */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span>Feed: <strong className="text-white">{cameraId}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Mode: <strong className="text-emerald-400">Offline Single-Cam</strong></span>
          </div>

          {/* Action Upload Buttons */}
          <div className="flex items-center gap-2 ml-2">
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer transition border border-slate-700 text-xs font-medium">
              <Video className="w-3.5 h-3.5 text-cyan-400" />
              <span>Change Video</span>
              <input
                type="file"
                accept="video/*"
                onChange={onVideoUpload}
                className="hidden"
              />
            </label>

            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer transition border border-slate-700 text-xs font-medium">
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Load CSV</span>
              <input
                type="file"
                accept=".csv"
                onChange={onCSVUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </header>
  );
};
