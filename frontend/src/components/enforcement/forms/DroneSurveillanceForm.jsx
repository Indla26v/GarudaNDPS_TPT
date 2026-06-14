import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';

export default function DroneSurveillanceForm({ onCancel, onSuccess }) {
  const [formData, setFormData] = useState({
    area_name: '',
    drone_operator: '',
    area_scanned_sqm: '',
    ganja_detected: false,
    findings_notes: '',
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
    if (!formData.area_name) {
      alert("Area Name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/enforcement/drone-surveillance', formData);
      alert('Drone surveillance logged successfully!');
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
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Scanned Area / Location Name *</label>
          <input
            type="text"
            name="area_name"
            value={formData.area_name}
            onChange={handleChange}
            className="input"
            placeholder="e.g. Seshachalam Forest beat 4"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Drone Operator Name</label>
          <input
            type="text"
            name="drone_operator"
            value={formData.drone_operator}
            onChange={handleChange}
            className="input"
            placeholder="e.g. PC 2042 Venkat"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Estimated Area Scanned (sq. meters)</label>
          <input
            type="number"
            name="area_scanned_sqm"
            value={formData.area_scanned_sqm}
            onChange={handleChange}
            className="input"
            placeholder="e.g. 50000"
            min="0"
          />
        </div>

        {formData.geo_lat && formData.geo_lng && (
          <div className="flex items-center space-x-2 text-xs text-green-400 font-semibold pb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Geo-tagged: {formData.geo_lat.toFixed(5)}, {formData.geo_lng.toFixed(5)}</span>
          </div>
        )}
      </div>

      <div className="p-4 rounded-lg" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            name="ganja_detected"
            checked={formData.ganja_detected}
            onChange={handleChange}
            className="w-5 h-5 mt-0.5 rounded border-gray-600 text-red-500 focus:ring-red-500"
          />
          <div>
            <span className="block text-sm font-bold text-red-500">Cannabis / Ganja Cultivation Detected</span>
            <span className="block text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>Check this if the drone footage or survey detected illegal hemp/ganja cultivation.</span>
          </div>
        </label>
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
            <span className="block text-sm font-bold text-green-600">All Clear / No Adverse Findings</span>
            <span className="block text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>Check this if the drone survey scan did not find any illegal or suspicious activities.</span>
          </div>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Surveillance Findings / Notes</label>
        <textarea
          name="findings_notes"
          value={formData.findings_notes}
          onChange={handleChange}
          rows="3"
          className="input"
          placeholder="Enter details of drone surveillance flight, findings or video log details..."
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
