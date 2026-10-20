import React from 'react';
import { Users, ArrowDownRight, ArrowUpRight, Activity } from 'lucide-react';

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
  const occupancyPercent = Math.min(100, Math.round((currentOccupancy / maxCapacity) * 100));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Current Regional Occupancy Card */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900/80 border border-slate-800 p-5 shadow-lg backdrop-blur hover:border-emerald-500/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Regional Occupancy
          </span>
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Users className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white tracking-tight">
            {currentOccupancy}
          </span>
          <span className="text-xs text-slate-400 font-medium">
            / {maxCapacity} cap ({occupancyPercent}%)
          </span>
        </div>
        <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${occupancyPercent}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>Active Zone: FOYER</span>
          <span className="text-emerald-400 font-medium">State: Monitored</span>
        </div>
      </div>

      {/* Directional Inflow (CROSS_IN) Card */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900/80 border border-slate-800 p-5 shadow-lg backdrop-blur hover:border-cyan-500/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Inflow (CROSS_IN)
          </span>
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
            <ArrowDownRight className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-cyan-400 tracking-tight">
            +{totalIn}
          </span>
          <span className="text-xs text-slate-400 font-medium">pedestrians</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-cyan-400/90 font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          Tripwire: LINE_MAIN_ENTRANCE
        </div>
      </div>

      {/* Directional Outflow (CROSS_OUT) Card */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900/80 border border-slate-800 p-5 shadow-lg backdrop-blur hover:border-rose-500/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Total Outflow (CROSS_OUT)
          </span>
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-rose-400 tracking-tight">
            -{totalOut}
          </span>
          <span className="text-xs text-slate-400 font-medium">pedestrians</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-rose-400/90 font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-rose-400"></span>
          Egress: Verified Safe
        </div>
      </div>

      {/* Net Flow Accumulation Card */}
      <div className="relative overflow-hidden rounded-xl bg-slate-900/80 border border-slate-800 p-5 shadow-lg backdrop-blur hover:border-purple-500/50 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Net Accumulation (ΔN)
          </span>
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className={`text-3xl font-extrabold tracking-tight ${netFlow >= 0 ? 'text-purple-400' : 'text-amber-400'}`}>
            {netFlow > 0 ? `+${netFlow}` : netFlow}
          </span>
          <span className="text-xs text-slate-400 font-medium">flux balance</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>In - Out Formula</span>
          <span className="text-purple-300 font-medium">
            {netFlow > 0 ? 'Net Influx' : netFlow < 0 ? 'Net Egress' : 'Balanced'}
          </span>
        </div>
      </div>
    </div>
  );
};
