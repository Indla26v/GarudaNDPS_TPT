import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';

export default function PettyCasesForm({ onCancel, onSuccess }) {
  const [formData, setFormData] = useState({
    accused_name: '',
    petty_case_no: '',
    act_section: '',
    fine_amount: '',
    location: '',
    no_suspicious_activity: false,
    remarks: '',
    geo_lat: null,
    geo_lng: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            geo_lat: position.coords.latitude,
            geo_lng: position.coords.longitude
          }));
        },
        (error) => {
          console.log('Geolocation not available:', error);
        }
      );
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.accused_name || !formData.act_section) {
      alert("Accused Name and Act & Section are required");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/enforcement/petty-cases', formData);
      alert('Petty case logged successfully!');
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to submit log');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Accused / Suspect Name *</label>
          <input
            type="text"
            name="accused_name"
            value={formData.accused_name}
            onChange={handleChange}
            className="input"
            placeholder="e.g. Nagaraju"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Petty Case Number</label>
          <input
            type="text"
            name="petty_case_no"
            value={formData.petty_case_no}
            onChange={handleChange}
            className="input"
            placeholder="e.g. PC/442/2026"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Act & Section *</label>
          <input
            type="text"
            name="act_section"
            value={formData.act_section}
            onChange={handleChange}
            className="input"
            placeholder="e.g. Sec 290 IPC, Sec 32 Police Act"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Fine Amount (INR)</label>
          <input
            type="number"
            name="fine_amount"
            value={formData.fine_amount}
            onChange={handleChange}
            className="input"
            placeholder="e.g. 250"
            min="0"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Location / Area of Offence</label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            className="input"
            placeholder="e.g. RTC Bus Stand main road, Tirupati"
          />
        </div>

        {formData.geo_lat && formData.geo_lng && (
          <div className="flex items-center space-x-2 text-xs text-green-400 font-semibold md:col-span-2 pb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Geo-tagged: {formData.geo_lat.toFixed(5)}, {formData.geo_lng.toFixed(5)}</span>
          </div>
        )}
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
            <span className="block text-sm font-bold text-green-600">All Clear / Resolved Peacefully</span>
            <span className="block text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>Check this if the public dispute or minor nuisance was settled on-site without further legal actions.</span>
          </div>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Remarks / Details</label>
        <textarea
          name="remarks"
          value={formData.remarks}
          onChange={handleChange}
          rows="3"
          className="input"
          placeholder="Provide context or explanation of the petty offense/incident..."
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
