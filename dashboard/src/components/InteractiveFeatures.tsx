import React, { useState } from 'react';
import { GitCommit, ShieldCheck, Box, FileSpreadsheet } from 'lucide-react';

export const InteractiveFeatures: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(0);

  const features = [
    {
      id: 0,
      title: 'Directional Tripwires',
      tag: 'CROSS_IN / OUT',
      desc: '2D vector cross-product line segment intersection calculating true directional inflow and outflow.',
      icon: GitCommit,
      highlightTitle: 'Deterministic vector crossing with zero double-counting',
      bullets: [
        'Decoupled from torso height via bottom-center [x+w/2, y+h] ground contact anchor',
        'Direction derived from cross-product sign: Orient(A, B, Pt-1) x Orient(A, B, Pt) < 0',
        'Independent cumulative counters for entry (CROSS_IN) vs exit (CROSS_OUT)',
      ],
    },
    {
      id: 1,
      title: 'Regional Occupancy',
      tag: 'OCCUPY DENSITY',
      desc: 'Multi-vertex polygon Region of Interest math evaluating instantaneous crowd presence.',
      icon: Box,
      highlightTitle: 'Continuous spatial density with self-correcting state',
      bullets: [
        'Ray-Casting (Jordan Curve) Point-in-Polygon algorithm',
        'Instantaneous state variable: resilient against brief tracking dropouts',
        'Capacity thresholds with automated high-density warning flags',
      ],
    },
    {
      id: 2,
      title: 'Hysteresis FSM',
      tag: 'NO LINE CHATTER',
      desc: 'Finite State Machine with spatial deadbands preventing jitter while permitting legitimate re-crossings.',
      icon: ShieldCheck,
      highlightTitle: 'Solving the multiple legitimate events dilemma',
      bullets: [
        '±10.0 px deadband buffer flanks the virtual counting tripwire',
        'State transitions to locked DEADBAND upon line crossing',
        'Only permits subsequent inverse crossings once subject clears opposite deadband',
      ],
    },
    {
      id: 3,
      title: 'Standard CSV Export',
      tag: 'DATA DICTIONARY',
      desc: 'Full tabular export strictly conforming to project schema for evaluation and supervisor review.',
      icon: FileSpreadsheet,
      highlightTitle: 'Ready for ground-truth comparison and MOTA evaluation',
      bullets: [
        'Fields: Frame_ID, Track_ID, BBox_Center_X, BBox_Center_Y, Event_Type, Timestamp',
        'Bi-directional synchronization: click any row in UI to jump video playback',
        'One-click client-side CSV download via PapaParse',
      ],
    },
  ];

  const currentFeature = features[activeTab];

  return (
    <section className="px-6 lg:px-12 max-w-7xl mx-auto my-12">
      {/* Section Title */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A8275] bg-[#EFECE6] px-3 py-1 rounded-full inline-block mb-3">
          ANALYTIC CAPABILITIES
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#18181B]">
          Everything you need to detect, track and verify
        </h2>
      </div>

      {/* 4 Cards in a Row (Styled after Image 4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {features.map((feat) => {
          const isSelected = activeTab === feat.id;
          const Icon = feat.icon;
          return (
            <div
              key={feat.id}
              onClick={() => setActiveTab(feat.id)}
              className={`p-6 rounded-2xl bg-white border cursor-pointer transition-all ${
                isSelected
                  ? 'border-[#F06548] shadow-md ring-1 ring-[#F06548]'
                  : 'border-[#EAE5DD] hover:border-[#18181B] shadow-sm'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
                  isSelected ? 'bg-[#F06548] text-white' : 'bg-[#FAF8F5] text-[#18181B]'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#18181B] mb-1.5">{feat.title}</h3>
              <p className="text-xs text-[#716B61] leading-relaxed line-clamp-2">{feat.desc}</p>

              <div className="mt-4 pt-3 border-t border-[#F3EFE8] flex items-center justify-between">
                <span className="text-[10px] font-mono text-[#8A8275]">{feat.tag}</span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    isSelected ? 'bg-[#FDEFEA] text-[#F06548]' : 'text-[#8A8275]'
                  }`}
                >
                  {isSelected ? 'Active' : 'Select'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Active Feature Card (Styled like pink/cream banner in Image 4) */}
      <div className="rounded-3xl bg-[#FDF2EE] border border-[#FAD8CE] p-8 lg:p-10 transition-all">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#F06548] bg-white px-3 py-1 rounded-full inline-block mb-3 shadow-xs">
              {currentFeature.title}
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#18181B] mb-3">
              {currentFeature.highlightTitle}
            </h3>
            <p className="text-sm text-[#716B61] leading-relaxed mb-6">
              {currentFeature.desc}
            </p>

            <div className="flex items-center gap-3">
              <span className="px-4 py-2 rounded-full bg-[#18181B] text-white text-xs font-semibold">
                Operational in MVP
              </span>
              <span className="px-4 py-2 rounded-full bg-white border border-[#E5E0D8] text-[#18181B] text-xs font-semibold">
                Week 1 Verified
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-[#FAD8CE] shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#18181B] mb-4">
              Mathematical & Architectural Highlights
            </h4>
            <ul className="space-y-3">
              {currentFeature.bullets.map((b, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-[#4A453E] leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F06548] mt-1.5 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
