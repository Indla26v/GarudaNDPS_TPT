/**
 * GARUDA — Technical Surveillance Module (Page 5)
 * Route: /surveillance
 * Centralised intelligence gathering from mobile networks, IMEI data,
 * geo-location analysis, and social media monitoring.
 */
import { useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import {
  IconFieldStaff, IconSearch, IconMap, IconMegaphone, IconChain, IconSurveillance,
} from '../../components/Icons';

const TABS = [
  { id: 'mobile', label: 'Mobile Analysis', Icon: IconFieldStaff, color: '#3b82f6' },
  { id: 'imei', label: 'IMEI Tracking', Icon: IconSearch, color: '#8b5cf6' },
  { id: 'geo', label: 'Geo-Location', Icon: IconMap, color: '#059669' },
  { id: 'social', label: 'Social Media', Icon: IconMegaphone, color: '#ec4899' },
  { id: 'messaging', label: 'Messaging Intel', Icon: IconSurveillance, color: '#f59e0b' },
  { id: 'correlation', label: 'Correlation', Icon: IconChain, color: '#6366f1' },
];

export default function Surveillance() {
  const [activeTab, setActiveTab] = useState('mobile');
  const perms = usePermissions();

  const descriptions = {
    mobile: {
      title: 'Mobile Number Analysis',
      desc: 'Register and track mobile numbers linked to suspects. Tag with accused profiles, note network providers, and track status changes.',
    },
    imei: {
      title: 'IMEI Tracking Register',
      desc: 'IMEI number entries with linked mobile numbers, device details, tower location logs, and SIM swapping event history.',
    },
    geo: {
      title: 'Geo-Location Analysis',
      desc: 'Map view of all GPS-tagged surveillance reports. Cluster hotspot areas, station-wise heat maps, and contraband transit route mapping.',
    },
    social: {
      title: 'Social Media Intelligence',
      desc: 'Log social media intelligence from Facebook, Instagram, Telegram, WhatsApp, and X/Twitter. Rate intelligence as Confirmed, Probable, or Unverified.',
    },
    messaging: {
      title: 'Messaging Intelligence',
      desc: 'Log intelligence from encrypted messaging platforms. Track source types (Informer, Tip-off, Intercept) and disposition status.',
    },
    correlation: {
      title: 'Intelligence Correlation',
      desc: 'Cross-reference mobile numbers, locations, and associates across cases. Auto-detect when the same number appears in 2+ cases.',
    },
  };

  const current = descriptions[activeTab];
  const activeTabObj = TABS.find(t => t.id === activeTab);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
          Technical Surveillance
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
          Intelligence gathering — mobile networks, geo-location, social media monitoring
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
          >
            <tab.Icon size={14} color={activeTab === tab.id ? '#fff' : undefined} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="card rounded-xl p-8 text-center">
        <div className="space-y-4">
          {activeTabObj && (
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto" style={{ background: activeTabObj.color + '14' }}>
              <activeTabObj.Icon size={28} color={activeTabObj.color} />
            </div>
          )}
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{current.title}</h2>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--color-garuda-400)' }}>{current.desc}</p>
          <span className="btn btn-sm" style={{ background: '#14b8a6', color: '#fff', borderColor: '#14b8a6', cursor: 'default' }}>
            Coming in Phase 3 — Intelligence
          </span>
        </div>
      </div>
    </div>
  );
}
