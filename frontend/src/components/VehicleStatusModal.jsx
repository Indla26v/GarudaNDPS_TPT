import { useState, useEffect } from 'react';
import api from '../api/axios';

const STATUS_OPTIONS = [
  { value: 'SEIZED', label: 'Seized (Impounded)' },
  { value: 'COURT_CUSTODY', label: 'Court Custody' },
  { value: 'RELEASED', label: 'Released (Interim Custody)' },
  { value: 'DISPOSED', label: 'Disposed (Auction/Destroyed)' },
];

export default function VehicleStatusModal({ vehicle, isOpen, onClose, onSuccess }) {
  const [status, setStatus] = useState('SEIZED');
  const [courtOrderNo, setCourtOrderNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (vehicle) {
      setStatus(vehicle.currentStatus || 'SEIZED');
      setCourtOrderNo(vehicle.courtOrderNo || '');
      setRemarks(vehicle.remarks || '');
      setError('');
    }
  }, [vehicle, isOpen]);

  if (!isOpen || !vehicle) return null;

  const requiresCourtOrder = status === 'RELEASED' || status === 'DISPOSED';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (requiresCourtOrder && !courtOrderNo.trim()) {
      setError('Court Order Number is required for this status.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.put(`/vehicles/${vehicle.id}`, {
        currentStatus: status,
        courtOrderNo,
        remarks,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update vehicle status.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div 
        className="w-full max-w-md rounded-xl shadow-2xl overflow-hidden" 
        style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}
      >
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-garuda-700)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            Update Vehicle Status
          </h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-md hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded bg-red-500/10 text-red-400 text-sm border border-red-500/20">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>
              Registration Number
            </label>
            <div className="text-sm font-mono font-bold" style={{ color: 'var(--color-garuda-100)' }}>
              {vehicle.registrationNo} 
              <span className="text-xs font-sans font-normal ml-2 text-gray-500">
                ({vehicle.makeModel || vehicle.vehicleType})
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>
              Current Status *
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {requiresCourtOrder && (
            <div className="animate-fade-in">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>
                Court Order Number *
              </label>
              <input
                value={courtOrderNo}
                onChange={(e) => setCourtOrderNo(e.target.value)}
                placeholder="e.g. Spl.CC No. 45/2026"
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}
                required={requiresCourtOrder}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-garuda-400)' }}>
              Remarks / Notes
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any additional details about this status change..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
              style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-600)', color: 'var(--color-garuda-100)' }}
            />
          </div>

          <div className="pt-2 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-200)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white"
              style={{ background: 'var(--color-accent-500)', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving...' : 'Update Status'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
