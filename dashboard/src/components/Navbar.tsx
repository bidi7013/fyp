import React from 'react';
import { Video, Upload, Download, Eye } from 'lucide-react';

interface NavbarProps {
  onVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCSVUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportCSV: () => void;
  onScrollToStage: () => void;
  onScrollToLayers: () => void;
  onScrollToLogs: () => void;
  cameraId?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  onVideoUpload,
  onCSVUpload,
  onExportCSV,
  onScrollToStage,
  onScrollToLayers,
  onScrollToLogs,
  cameraId = 'CAM_01_GATEWAY',
}) => {
  return (
    <nav className="sticky top-0 z-40 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#EAE5DD] px-6 lg:px-12 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#F06548]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#18181B]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#18181B]/40"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#F06548]/40"></div>
          </div>
          <span className="text-xl font-bold tracking-tight text-[#18181B]">
            ASPIRE<span className="text-[#F06548]">.</span>Vision
          </span>
        </div>

        {/* Central Nav Links */}
        <div className="hidden md:flex items-center gap-8 text-xs font-medium text-[#716B61]">
          <button
            onClick={onScrollToStage}
            className="hover:text-[#18181B] transition-colors cursor-pointer"
          >
            Live Stage
          </button>
          <button
            onClick={onScrollToLayers}
            className="hover:text-[#18181B] transition-colors cursor-pointer"
          >
            4-Layer Pipeline
          </button>
          <button
            onClick={onScrollToLogs}
            className="hover:text-[#18181B] transition-colors cursor-pointer"
          >
            Data Dictionary Logs
          </button>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EFECE6] text-[11px] text-[#4A453E]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"></span>
            {cameraId}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Change Video Pill */}
          <label className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-[#E5E0D8] text-xs font-semibold text-[#18181B] hover:bg-[#F3EFE8] transition cursor-pointer shadow-sm">
            <Video className="w-3.5 h-3.5 text-[#716B61]" />
            <span>Load Video</span>
            <input
              type="file"
              accept="video/*"
              onChange={onVideoUpload}
              className="hidden"
            />
          </label>

          {/* Load CSV Pill */}
          <label className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-[#E5E0D8] text-xs font-semibold text-[#18181B] hover:bg-[#F3EFE8] transition cursor-pointer shadow-sm">
            <Upload className="w-3.5 h-3.5 text-[#716B61]" />
            <span>Load CSV</span>
            <input
              type="file"
              accept=".csv"
              onChange={onCSVUpload}
              className="hidden"
            />
          </label>

          {/* Export CSV Accent Pill */}
          <button
            onClick={onExportCSV}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#F06548] hover:bg-[#DE5337] text-white text-xs font-semibold transition shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
