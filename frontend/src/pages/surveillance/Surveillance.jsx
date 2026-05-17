/**
 * GARUDA — Technical Surveillance Module (Page 5)
 * Route: /surveillance
 * Centralised intelligence gathering from mobile networks, IMEI data,
 * geo-location analysis, and social media monitoring.
 */
import { useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';

const TABS = [
  { id: 'mobile', label: 'Mobile Analysis', icon: '📱' },
  { id: 'imei', label: 'IMEI Tracking', icon: '📟' },
  { id: 'geo', label: 'Geo-Location', icon: '🗺️' },
  { id: 'social', label: 'Social Media', icon: '📣' },
  { id: 'messaging', label: 'Messaging Intel', icon: '💬' },
  { id: 'correlation', label: 'Correlation', icon: '🔗' },
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
            className="px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
            style={{
              background: activeTab === tab.id ? 'var(--color-accent-500)' : 'var(--color-garuda-800)',
              color: activeTab === tab.id ? '#fff' : 'var(--color-garuda-300)',
              border: `1px solid ${activeTab === tab.id ? 'var(--color-accent-500)' : 'var(--color-garuda-700)'}`,
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-xl p-8 text-center" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
        <div className="space-y-4">
          <div className="text-4xl">{TABS.find(t => t.id === activeTab)?.icon}</div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-garuda-100)' }}>{current.title}</h2>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--color-garuda-400)' }}>{current.desc}</p>
          <div className="inline-block px-4 py-2 rounded-full text-xs font-medium" style={{ background: '#14b8a6', color: '#fff' }}>
            Coming in Phase 3 — Intelligence
          </div>
        </div>
      </div>
    </div>
  );
}
