import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';

export default function DrunkDriveForm({ onCancel, onSuccess }) {
  const [formData, setFormData] = useState({
    vehicle_no: '',
    driver_name: '',
    driver_age: '',
    driver_gender: '',
    bac_level: '',
    fine_amount: '',
    vehicle_impounded: false,
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
    if (!formData.vehicle_no) {
      alert("Vehicle Number is required");
      return;
    }
    if (!formData.driver_name) {
      alert("Driver Name is required");
      return;
    }
    if (formData.bac_level === '') {
      alert("BAC level is required");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/enforcement/drunk-drive', formData);
      alert('Drunk & Drive check logged successfully!');
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
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Vehicle Number *</label>
          <input
            type="text"
            name="vehicle_no"
            value={formData.vehicle_no}
            onChange={handleChange}
            className="input"
            placeholder="e.g. AP39TV1234"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Driver/Rider Name *</label>
          <input
            type="text"
            name="driver_name"
            value={formData.driver_name}
            onChange={handleChange}
            className="input"
            placeholder="Enter driver's full name"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Driver Age</label>
          <input
            type="number"
            name="driver_age"
            value={formData.driver_age}
            onChange={handleChange}
            className="input"
            placeholder="e.g. 28"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Driver Gender</label>
          <select
            name="driver_gender"
            value={formData.driver_gender}
            onChange={handleChange}
            className="input"
          >
            <option value="">Select...</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>BAC Level (mg/100ml) *</label>
          <input
            type="number"
            name="bac_level"
            value={formData.bac_level}
            onChange={handleChange}
            className="input"
            placeholder="e.g. 35 (Limit: 30 mg/100ml)"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Fine Amount (₹)</label>
          <input
            type="number"
            name="fine_amount"
            value={formData.fine_amount}
            onChange={handleChange}
            className="input"
            placeholder="e.g. 10000"
          />
        </div>

        {formData.geo_lat && formData.geo_lng && (
          <div className="flex items-center space-x-2 text-xs text-green-400 font-semibold self-end pb-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Geo-tagged: {formData.geo_lat.toFixed(5)}, {formData.geo_lng.toFixed(5)}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-700)' }}>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              name="vehicle_impounded"
              checked={formData.vehicle_impounded}
              onChange={handleChange}
              className="w-5 h-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500"
            />
            <div>
              <span className="block text-sm font-semibold" style={{ color: 'var(--color-garuda-200)' }}>Vehicle Impounded</span>
              <span className="block text-xs" style={{ color: 'var(--color-garuda-400)' }}>Check if vehicle was seized at the spot</span>
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
              <span className="block text-sm font-bold text-green-600">Clean Check / Below Legal Limit</span>
              <span className="block text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>Check this if driver test was negative/clean</span>
            </div>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Remarks / Notes</label>
        <textarea
          name="remarks"
          value={formData.remarks}
          onChange={handleChange}
          rows="3"
          className="input"
          placeholder="Enter violations details, repeat offender details, spot observations..."
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
