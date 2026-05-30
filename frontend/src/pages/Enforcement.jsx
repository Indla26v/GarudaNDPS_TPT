/**
 * GARUDA — Enforcement Operations Module (Phase 2)
 * Route: /enforcement
 * 
 * Elegant placeholder dashboard detailing upcoming operational tools:
 *  - Raid Planning & dispatch trackers
 *  - Asset Forfeiture tracking (NDPS Section 68)
 *  - Inter-agency coordination widgets
 *  - Prosecution and court filings preparation
 */
import { useState } from 'react';
import { IconShield, IconClipboard, IconNetwork, IconUsers, IconScale } from '../components/Icons';

export default function Enforcement() {
  const [activeTab, setActiveTab] = useState('overview');

  const upcomingFeatures = [
    {
      id: 'raids',
      title: 'Raid & Seizure Planning',
      icon: IconClipboard,
      color: '#f97316', // Orange
      status: 'In Design',
      desc: 'Schedule tactical raids, dispatch enforcement teams, log live seizures, and coordinate backup with local circles in real time.',
      points: [
        'Geofenced officer check-ins during operations',
        'Live digital seizure list generation with signatures',
        'Direct link to drug disposal workflows'
      ]
    },
    {
      id: 'assets',
      title: 'Asset Forfeiture & NDPS 68',
      icon: IconScale,
      color: '#dc2626', // Red
      status: 'Planning Phase',
      desc: 'Identify, freeze, and manage illegal assets and properties acquired via drug trafficking under Section 68 of the NDPS Act.',
      points: [
        'Property registry linkage and ownership mapping',
        'Automated drafting of freeze notices (Form A/B)',
        'Forfeiture timeline trackers with legal deadline alerts'
      ]
    },
    {
      id: 'interagency',
      title: 'Inter-Agency Intel Pipeline',
      icon: IconNetwork,
      color: '#2563eb', // Blue
      status: 'System Integration',
      desc: 'Establish high-speed data exchanges between local circles, cyber intelligence cells, and the state excise task forces.',
      points: [
        'Multi-department case file locking mechanisms',
        'Encrypted file and surveillance feed transfers',
        'Cross-agency alert board for high-priority offenders'
      ]
    },
    {
      id: 'prosecution',
      title: 'Prosecution Preparedness',
      icon: IconUsers,
      color: '#16a34a', // Green
      status: 'Database Modeling',
      desc: 'Prepare court-admissible electronic records, trace evidence chains of custody, and manage prosecutor review feedback.',
      points: [
        'Digital evidence locker checklist and verification logs',
        'Automated charge-sheet readiness assessment',
        'Calendar syncing for summons and testimony dates'
      ]
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl border"
        style={{
          background: 'linear-gradient(135deg, rgba(234,88,12,0.08), rgba(220,38,38,0.05))',
          borderColor: 'rgba(234, 88, 12, 0.2)',
        }}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-accent-500/10 border border-accent-500/30 text-accent-500 animate-pulse">
            <IconShield size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
                Enforcement Operations
              </h1>
              <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Phase 2
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-garuda-400)' }}>
              Integrated tactical dispatch, asset seizure tracking, and inter-agency coordination portal.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping" />
          <span className="text-xs font-semibold" style={{ color: 'var(--color-accent-400)' }}>
            Under Active Development
          </span>
        </div>
      </div>

      {/* Main Grid: Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {upcomingFeatures.map((feat) => {
          const FeatIcon = feat.icon;
          return (
            <div
              key={feat.id}
              className="card p-6 flex flex-col justify-between hover:translate-y-[-2px] transition-all duration-200"
              style={{
                background: 'var(--color-garuda-800)',
                border: '1px solid var(--color-garuda-700)',
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${feat.color}15` }}
                  >
                    <FeatIcon size={20} color={feat.color} />
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                    style={{
                      backgroundColor: `${feat.color}0a`,
                      borderColor: `${feat.color}30`,
                      color: feat.color,
                    }}
                  >
                    {feat.status}
                  </span>
                </div>
                <h3 className="text-base font-bold mb-2" style={{ color: 'var(--color-garuda-100)' }}>
                  {feat.title}
                </h3>
                <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--color-garuda-400)' }}>
                  {feat.desc}
                </p>
              </div>

              <div className="pt-4 border-t border-dashed" style={{ borderColor: 'var(--color-garuda-700)' }}>
                <p className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: 'var(--color-garuda-200)' }}>
                  Core Components:
                </p>
                <ul className="space-y-1.5">
                  {feat.points.map((p, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs" style={{ color: 'var(--color-garuda-300)' }}>
                      <span className="text-accent-500 mt-0.5">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Bar Panel */}
      <div className="card p-6 flex flex-col md:flex-row items-center gap-6" style={{ background: 'var(--color-garuda-800)' }}>
        <div className="flex-1 space-y-2 w-full">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Development Progress</span>
            <span className="font-bold text-accent-500">45% Completed</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700/60 border border-slate-200/40 dark:border-slate-800/40">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: '45%', background: 'linear-gradient(to right, #ea580c, #dc2626)' }} />
          </div>
        </div>
        <div className="flex-shrink-0 text-center md:text-right">
          <p className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>Target Alpha Release</p>
          <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--color-garuda-100)' }}>Q3 2026</p>
        </div>
      </div>
    </div>
  );
}
