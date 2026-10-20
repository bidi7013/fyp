import React, { useState, useMemo } from 'react';
import { Download, Search, Filter, Clock, Eye } from 'lucide-react';
import type { EventLogEntry, EventType } from '../types';

interface EventLogTableProps {
  events: EventLogEntry[];
  currentFrame: number;
  onSelectFrame: (frameId: number) => void;
}

export const EventLogTable: React.FC<EventLogTableProps> = ({
  events,
  currentFrame,
  onSelectFrame,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTrackId, setSearchTrackId] = useState<string>('');

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchType = filterType === 'ALL' || ev.Event_Type === filterType;
      const matchTrack = searchTrackId === '' || ev.Track_ID.toString().includes(searchTrackId);
      return matchType && matchTrack;
    });
  }, [events, filterType, searchTrackId]);

  const counts = useMemo(() => {
    const total = events.length;
    const inCount = events.filter((e) => e.Event_Type === 'CROSS_IN').length;
    const outCount = events.filter((e) => e.Event_Type === 'CROSS_OUT').length;
    const occCount = events.filter((e) => e.Event_Type === 'OCCUPY').length;
    return { total, inCount, outCount, occCount };
  }, [events]);

  const downloadCSV = () => {
    const headers = ['Frame_ID', 'Track_ID', 'BBox_Center_X', 'BBox_Center_Y', 'Event_Type', 'Timestamp'];
    const rows = filteredEvents.map((e) => [
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

  const getBadgeStyle = (type: EventType) => {
    switch (type) {
      case 'CROSS_IN':
        return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30';
      case 'CROSS_OUT':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/30';
      case 'OCCUPY':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border border-slate-700';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl backdrop-blur">
      {/* Header & Controls */}
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/50">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            Standard Data Dictionary Event Stream
          </h3>
          <p className="text-xs text-slate-400">
            Strict image-space coordinates & discrete state triggers ({filteredEvents.length} records)
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Search Track ID */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter Track ID..."
              value={searchTrackId}
              onChange={(e) => setSearchTrackId(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Download CSV button */}
          <button
            onClick={downloadCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-1.5 overflow-x-auto text-xs">
        <span className="text-slate-500 mr-1 flex items-center gap-1">
          <Filter className="w-3 h-3" /> Filter:
        </span>
        <button
          onClick={() => setFilterType('ALL')}
          className={`px-2.5 py-1 rounded-md font-medium transition ${
            filterType === 'ALL'
              ? 'bg-slate-800 text-white border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All ({counts.total})
        </button>
        <button
          onClick={() => setFilterType('CROSS_IN')}
          className={`px-2.5 py-1 rounded-md font-medium transition ${
            filterType === 'CROSS_IN'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-cyan-400/70 hover:text-cyan-300'
          }`}
        >
          CROSS_IN ({counts.inCount})
        </button>
        <button
          onClick={() => setFilterType('CROSS_OUT')}
          className={`px-2.5 py-1 rounded-md font-medium transition ${
            filterType === 'CROSS_OUT'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'text-rose-400/70 hover:text-rose-300'
          }`}
        >
          CROSS_OUT ({counts.outCount})
        </button>
        <button
          onClick={() => setFilterType('OCCUPY')}
          className={`px-2.5 py-1 rounded-md font-medium transition ${
            filterType === 'OCCUPY'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-emerald-400/70 hover:text-emerald-300'
          }`}
        >
          OCCUPY ({counts.occCount})
        </button>
      </div>

      {/* Virtual Table */}
      <div className="flex-1 overflow-y-auto max-h-[380px] text-xs">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-950/90 backdrop-blur z-10 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-2.5 px-3">Frame_ID</th>
              <th className="py-2.5 px-3">Track_ID</th>
              <th className="py-2.5 px-3">Anchor_X (px)</th>
              <th className="py-2.5 px-3">Anchor_Y (px)</th>
              <th className="py-2.5 px-3">Event_Type</th>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3 text-right">Seek</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                  No events found matching filter criteria.
                </td>
              </tr>
            ) : (
              filteredEvents.map((row, idx) => {
                const isCurrent = Math.abs(row.Frame_ID - currentFrame) <= 1;
                return (
                  <tr
                    key={idx}
                    onClick={() => onSelectFrame(row.Frame_ID)}
                    className={`cursor-pointer transition-colors ${
                      isCurrent
                        ? 'bg-emerald-500/15 border-l-2 border-emerald-400 text-white font-bold'
                        : 'hover:bg-slate-800/50 text-slate-300'
                    }`}
                  >
                    <td className="py-2 px-3">
                      <span className="font-semibold text-slate-200">#{row.Frame_ID}</span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-sans text-[11px]">
                        ID {row.Track_ID}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400">{row.BBox_Center_X.toFixed(1)}</td>
                    <td className="py-2 px-3 text-slate-400">{row.BBox_Center_Y.toFixed(1)}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold uppercase tracking-wider ${getBadgeStyle(row.Event_Type)}`}>
                        {row.Event_Type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400 text-[11px]">
                      {row.Timestamp.split('T')[1] || row.Timestamp}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        title="Jump video to frame"
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
