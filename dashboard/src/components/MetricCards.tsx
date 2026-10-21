import React from 'react';

interface MetricCardsProps {
  currentOccupancy: number;
  totalIn: number;
  totalOut: number;
  maxCapacity?: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  currentOccupancy,
  totalIn,
  totalOut,
  maxCapacity = 50,
}) => {
  const netFlow = totalIn - totalOut;

  return (
    <section className="px-6 lg:px-12 max-w-7xl mx-auto my-4">
      {/* Editorial Quote / Lead-in line */}
      <div className="mb-6">
        <p className="text-xl sm:text-2xl font-bold tracking-tight text-[#18181B] max-w-3xl leading-snug">
          “ASPIRE-Vision takes pedestrian monitoring from manual turnstile tallies to frame-accurate spatial intelligence.”
        </p>
        <span className="text-[11px] font-mono text-[#8A8275] uppercase tracking-wider block mt-2">
          EVALUATION SUMMARY · PHASE 1 MVP SPECIFICATION
        </span>
      </div>

      {/* 3 Metric Cards with Minimalist Sparkline Curves (Styled after Image 2) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Regional Occupancy */}
        <div className="p-6 rounded-3xl bg-white border border-[#EAE5DD] shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-[#18181B] transition-all">
          <div className="flex items-center justify-between text-xs mb-6">
            <span className="font-bold text-[#8A8275] tracking-wider uppercase text-[10px]">
              REGIONAL OCCUPANCY
            </span>
            <span className="font-semibold text-[#18181B] font-mono text-[11px]">ZONE_FOYER</span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <div className="text-5xl font-bold tracking-tight text-[#18181B]">{currentOccupancy}</div>
              <span className="text-xs text-[#8A8275] mt-1 block">/ {maxCapacity} person capacity</span>
            </div>

            {/* Sparkline Curve */}
            <div className="w-28 h-10">
              <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
                <path
                  d="M 0 35 Q 25 30, 50 15 T 100 5"
                  fill="none"
                  stroke="#18181B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 2: Directional Crossing Flux */}
        <div className="p-6 rounded-3xl bg-white border border-[#EAE5DD] shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-[#F06548] transition-all">
          <div className="flex items-center justify-between text-xs mb-6">
            <span className="font-bold text-[#8A8275] tracking-wider uppercase text-[10px]">
              TRIPWIRE CROSSINGS
            </span>
            <span className="font-semibold text-[#F06548] font-mono text-[11px]">LINE_MAIN_ENTRANCE</span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <div className="text-5xl font-bold tracking-tight text-[#F06548]">+{totalIn}</div>
              <span className="text-xs text-[#8A8275] mt-1 block">Inflow ({totalOut} Outflow)</span>
            </div>

            {/* Sparkline Curve (Coral) */}
            <div className="w-28 h-10">
              <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
                <path
                  d="M 0 38 Q 30 32, 60 18 T 100 4"
                  fill="none"
                  stroke="#F06548"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 3: Net Flow Accumulation */}
        <div className="p-6 rounded-3xl bg-white border border-[#EAE5DD] shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-[#18181B] transition-all">
          <div className="flex items-center justify-between text-xs mb-6">
            <span className="font-bold text-[#8A8275] tracking-wider uppercase text-[10px]">
              NET ACCUMULATION (ΔN)
            </span>
            <span className="font-semibold text-[#18181B] font-mono text-[11px]">IN - OUT BALANCE</span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <div className="text-5xl font-bold tracking-tight text-[#18181B]">
                {netFlow > 0 ? `+${netFlow}` : netFlow}
              </div>
              <span className="text-xs text-[#8A8275] mt-1 block">Live spatial flux</span>
            </div>

            {/* Sparkline Curve */}
            <div className="w-28 h-10">
              <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
                <path
                  d="M 0 30 Q 30 25, 65 12 T 100 6"
                  fill="none"
                  stroke="#18181B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
