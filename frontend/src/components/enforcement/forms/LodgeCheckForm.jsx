import React, { useState } from 'react';
import api from '../../../api/axios';

export default function LodgeCheckForm({ onCancel, onSuccess }) {
  const [formData, setFormData] = useState({
    lodge_name: '',
    owner_name: '',
    manager_name: '',
    location: '',
    checked_guest_register: false,
    verified_foreigners: false,
    verified_strangers: false,
    verified_suspicious: false,
    no_suspicious_activity: false,
    findings_notes: '',
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
    if (!formData.lodge_name) {
      alert("Lodge/Hotel Name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/enforcement/lodge-check', formData);
      alert('Lodge check logged successfully!');
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to submit log');
    } finally {
      setIsSubmitting(false);
    }
  };

  const checks = [
    { name: 'checked_guest_register', label: 'Checked Guest Register' },
    { name: 'verified_foreigners', label: 'Verified Foreign Nationals' },
    { name: 'verified_strangers', label: 'Verified Strangers/Newcomers' },
    { name: 'verified_suspicious', label: 'Checked for Suspicious Activities' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Lodge / Hotel Name *</label>
          <input
            type="text"
            name="lodge_name"
            value={formData.lodge_name}
            onChange={handleChange}
            className="input"
            placeholder="e.g. Grand Inn Hotel"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Location / Area</label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            className="input"
            placeholder="e.g. Near Railway Station"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Manager Name</label>
          <input
            type="text"
            name="manager_name"
            value={formData.manager_name}
            onChange={handleChange}
            className="input"
            placeholder="Name of person at desk"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--color-garuda-200)' }}>Verification Checklist</label>
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
            <span className="block text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>Check this if the lodge inspection concluded without any adverse findings or illegal activities.</span>
          </div>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Findings / Remarks</label>
        <textarea
          name="findings_notes"
          value={formData.findings_notes}
          onChange={handleChange}
          rows="3"
          className="input"
          placeholder="Enter any irregularities found or remarks for future checks..."
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
