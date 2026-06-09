import React, { useState } from 'react';
import api from '../../../api/axios';

export default function VillageVisitForm({ onCancel, onSuccess }) {
  const [formData, setFormData] = useState({
    village_name: '',
    verified_bad_chars: false,
    verified_rowdies: false,
    verified_bound_overs: false,
    verified_habitual: false,
    interacted_elders: false,
    intel_collected: false,
    drug_peddler_check: false,
    drone_surveillance: false,
    vehicle_checking: false,
    palle_nidra: false,
    no_suspicious_activity: false,
    intel_notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.village_name) {
      alert("Village Name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/enforcement/village-visit', formData);
      alert('Village visit logged successfully!');
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to submit log');
    } finally {
      setIsSubmitting(false);
    }
  };

  const checks = [
    { name: 'verified_bad_chars', label: 'Verified Bad Characters' },
    { name: 'verified_rowdies', label: 'Verified Rowdy Sheeters' },
    { name: 'verified_bound_overs', label: 'Checked Bound Overs' },
    { name: 'verified_habitual', label: 'Checked Habitual Offenders' },
    { name: 'interacted_elders', label: 'Interacted with Village Elders' },
    { name: 'intel_collected', label: 'Gathered Intelligence' },
    { name: 'drug_peddler_check', label: 'Drug Peddler Checks' },
    { name: 'drone_surveillance', label: 'Drone Surveillance Conducted' },
    { name: 'vehicle_checking', label: 'Vehicle Checking' },
    { name: 'palle_nidra', label: 'Palle Nidra Performed' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Village/Habitation Name *</label>
        <input
          type="text"
          name="village_name"
          value={formData.village_name}
          onChange={handleChange}
          className="input"
          placeholder="e.g. Chandragiri Rural"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--color-garuda-200)' }}>Activities Performed (Check all that apply)</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {checks.map(check => (
            <label key={check.name} className="flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-700)' }}>
              <input
                type="checkbox"
                name={check.name}
                checked={formData[check.name]}
                onChange={handleChange}
                className="w-5 h-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm font-medium" style={{ color: 'var(--color-garuda-300)' }}>{check.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-lg" style={{ background: 'rgba(22, 163, 74, 0.05)', border: '1px solid rgba(22, 163, 74, 0.2)' }}>
        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            name="no_suspicious_activity"
            checked={formData.no_suspicious_activity}
            onChange={handleChange}
            className="w-5 h-5 mt-0.5 rounded border-gray-600 text-green-500 focus:ring-green-500"
          />
          <div>
            <span className="block text-sm font-bold text-green-600">All Clear / No Suspicious Activity Found</span>
            <span className="block text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>Check this if the visit concluded without any adverse findings. This ensures your check is still counted in the dashboard.</span>
          </div>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Intelligence / Findings Notes</label>
        <textarea
          name="intel_notes"
          value={formData.intel_notes}
          onChange={handleChange}
          rows="3"
          className="input"
          placeholder="Enter any intelligence gathered or observations made..."
        ></textarea>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t" style={{ borderColor: 'var(--color-garuda-700)' }}>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Log'}
        </button>
      </div>
    </form>
  );
}
