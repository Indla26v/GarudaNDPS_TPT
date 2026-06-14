import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';

export default function RowdySheeterForm({ onCancel, onSuccess }) {
  const [formData, setFormData] = useState({
    rowdy_sheeter_name: '',
    rowdy_sheet_no: '',
    activity_status: 'Active',
    current_employment: '',
    associates_noted: '',
    verification_notes: '',
    no_suspicious_activity: false,
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
    if (!formData.rowdy_sheeter_name) {
      alert("Rowdy Sheeter Name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/enforcement/rowdy-sheeter', formData);
      alert('Rowdy Sheeter verification logged successfully!');
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
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Rowdy Sheeter Name *</label>
          <input
            type="text"
            name="rowdy_sheeter_name"
            value={formData.rowdy_sheeter_name}
            onChange={handleChange}
            className="input"
            placeholder="e.g. Ramesh Kumar"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Rowdy Sheet Number</label>
          <input
            type="text"
            name="rowdy_sheet_no"
            value={formData.rowdy_sheet_no}
            onChange={handleChange}
            className="input"
            placeholder="e.g. RS/142/TPT"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Activity Status</label>
          <select
            name="activity_status"
            value={formData.activity_status}
            onChange={handleChange}
            className="input cursor-pointer"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Relocated">Relocated / Moved</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Current Occupation / Employment</label>
          <input
            type="text"
            name="current_employment"
            value={formData.current_employment}
            onChange={handleChange}
            className="input"
            placeholder="e.g. Real Estate agent, unemployed"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Associates / Gang Members Noted</label>
          <input
            type="text"
            name="associates_noted"
            value={formData.associates_noted}
            onChange={handleChange}
            className="input"
            placeholder="Comma-separated list of associates spotted or verified"
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
            <span className="block text-sm font-bold text-green-600">All Clear / No Suspicious Activity Found</span>
            <span className="block text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>Check this if the sheeter check concluded without any adverse findings or illicit activities.</span>
          </div>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Verification Notes</label>
        <textarea
          name="verification_notes"
          value={formData.verification_notes}
          onChange={handleChange}
          rows="3"
          className="input"
          placeholder="Enter details of verification, behaviour, or current status..."
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
