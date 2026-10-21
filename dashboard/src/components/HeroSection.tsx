import React from 'react';
import { Play, Layers } from 'lucide-react';

interface HeroSectionProps {
  onStartSimulation: () => void;
  onExploreArchitecture: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onStartSimulation,
  onExploreArchitecture,
}) => {
  return (
    <section className="pt-10 pb-8 px-6 lg:px-12 max-w-7xl mx-auto">
      {/* Category Pill Tag */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A8275] bg-[#EFECE6] px-3 py-1 rounded-full">
          ASPIRE · VISION ANALYTICS · CAT405 FYP
        </span>
      </div>

      {/* Main Grid: Headline + Description */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-end">
        {/* Large Display Typography */}
        <div className="lg:col-span-8">
          <h1 className="text-4xl sm:text-5xl lg:text-[62px] leading-[1.08] font-bold tracking-tight text-[#18181B]">
            Every pedestrian accounted for{' '}
            <span className="text-[#F06548] underline decoration-[#F06548]/30 decoration-wavy underline-offset-8">
              before
            </span>{' '}
            they cross
          </h1>
        </div>

        {/* Narrative & Action Buttons */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          <p className="text-sm sm:text-base leading-relaxed text-[#6B655B]">
            Single-camera offline vision pipeline integrating YOLOv8 detection, multi-object tracking, and
            spatial tripwires into an evidence-based system that logs, counts, and verifies.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={onStartSimulation}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-semibold transition shadow-md cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Interactive Stage</span>
            </button>

            <button
              onClick={onExploreArchitecture}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-[#E5E0D8] hover:bg-[#F3EFE8] text-[#18181B] text-xs font-semibold transition cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-[#716B61]" />
              <span>View 4 Layers</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
