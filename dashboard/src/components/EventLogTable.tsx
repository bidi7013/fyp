import React, { useState, useMemo } from 'react';
import { Download, Search, Filter, Clock, Eye, CheckCircle2 } from 'lucide-react';
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
        return 'bg-[#FDE7E3] text-[#F06548] border border-[#FAD8CE]';
      case 'CROSS_OUT':
        return 'bg-[#FFE4E6] text-[#E11D48] border border-[#FECDD3]';
      case 'OCCUPY':
        return 'bg-[#EAF0E6] text-[#2F6838] border border-[#C5D9BE]';
      default:
        return 'bg-[#F3EFE8] text-[#716B61] border border-[#EAE5DD]';
    }
  };

  return (
    <section id="logs-section" className="px-6 lg:px-12 max-w-7xl mx-auto my-10">
      <div className="bg-white rounded-3xl border border-[#EAE5DD] shadow-[0_8px_30px_rgba(0,0,0,0.02)] overflow-hidden">
        {/* Header & Controls Bar */}
        <div className="p-6 border-b border-[#EAE5DD] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FDFCFB]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-[#F06548]" />
              <h3 className="text-base font-bold text-[#18181B]">
                Standard Data Dictionary Event Stream
              </h3>
              <span className="text-[10px] font-bold text-[#22C55E] bg-[#EAF0E6] px-2 py-0.5 rounded-full">
                Synchronized
              </span>
            </div>
            <p className="text-xs text-[#716B61]">
              Strict image-space coordinates & discrete state triggers conforming to Page 2 of the implementation plan ({filteredEvents.length} records)
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8A8275] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search Track ID..."
                value={searchTrackId}
                onChange={(e) => setSearchTrackId(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E5E0D8] rounded-full text-[#18181B] placeholder-[#8A8275] focus:outline-none focus:border-[#F06548]"
              />
            </div>

            {/* Export CSV Pill */}
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#18181B] hover:bg-black text-white text-xs font-semibold transition shadow-sm cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-6 py-2.5 border-b border-[#EAE5DD] bg-[#FAF8F5] flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-[#8A8275] mr-1 flex items-center gap-1 text-[11px] font-medium">
            <Filter className="w-3 h-3" /> Filter by:
          </span>
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1 rounded-full font-semibold transition cursor-pointer ${
              filterType === 'ALL'
                ? 'bg-[#18181B] text-white'
                : 'text-[#716B61] hover:text-[#18181B] hover:bg-[#EFECE6]'
            }`}
          >
            All Events ({counts.total})
          </button>
          <button
            onClick={() => setFilterType('CROSS_IN')}
            className={`px-3 py-1 rounded-full font-semibold transition cursor-pointer ${
              filterType === 'CROSS_IN'
                ? 'bg-[#F06548] text-white'
                : 'text-[#F06548] hover:bg-[#FDE7E3]'
            }`}
          >
            CROSS_IN ({counts.inCount})
          </button>
          <button
            onClick={() => setFilterType('CROSS_OUT')}
            className={`px-3 py-1 rounded-full font-semibold transition cursor-pointer ${
              filterType === 'CROSS_OUT'
                ? 'bg-[#E11D48] text-white'
                : 'text-[#E11D48] hover:bg-[#FFE4E6]'
            }`}
          >
            CROSS_OUT ({counts.outCount})
          </button>
          <button
            onClick={() => setFilterType('OCCUPY')}
            className={`px-3 py-1 rounded-full font-semibold transition cursor-pointer ${
              filterType === 'OCCUPY'
                ? 'bg-[#2F6838] text-white'
                : 'text-[#2F6838] hover:bg-[#EAF0E6]'
            }`}
          >
            OCCUPY ({counts.occCount})
          </button>
        </div>

        {/* Tabular Records */}
        <div className="overflow-x-auto max-h-[440px] text-xs">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#FAF8F5] z-10 border-b border-[#EAE5DD] text-[#8A8275] font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-5">Frame_ID</th>
                <th className="py-3 px-4">Track_ID</th>
                <th className="py-3 px-4">Anchor_X (px)</th>
                <th className="py-3 px-4">Anchor_Y (px)</th>
                <th className="py-3 px-4">Event_Type</th>
                <th className="py-3 px-4">Derived Timestamp</th>
                <th className="py-3 px-5 text-right">Seek to Frame</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3EFE8] font-mono">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#8A8275] italic font-sans">
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
                          ? 'bg-[#FDEFEA] border-l-4 border-[#F06548] font-bold text-[#18181B]'
                          : 'hover:bg-[#FAF8F5] text-[#3F3931]'
                      }`}
                    >
                      <td className="py-2.5 px-5 font-bold">#{row.Frame_ID}</td>
                      <td className="py-2.5 px-4 font-sans font-semibold text-[#18181B]">
                        ID {row.Track_ID}
                      </td>
                      <td className="py-2.5 px-4 text-[#716B61]">{row.BBox_Center_X.toFixed(1)}</td>
                      <td className="py-2.5 px-4 text-[#716B61]">{row.BBox_Center_Y.toFixed(1)}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase tracking-wider ${getBadgeStyle(
                            row.Event_Type
                          )}`}
                        >
                          {row.Event_Type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-[#716B61] text-[11px]">
                        {row.Timestamp.split('T')[1] || row.Timestamp}
                      </td>
                      <td className="py-2.5 px-5 text-right">
                        <button
                          title="Seek video to frame"
                          className="p-1 rounded-full hover:bg-[#EFECE6] text-[#716B61] hover:text-[#18181B] transition cursor-pointer"
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
    </section>
  );
};
