import React, { useState, useEffect } from 'react';
import api from '../../../api/axios';

export default function CourierCheckForm({ onCancel, onSuccess }) {
  const [formData, setFormData] = useState({
    courier_office_name: '',
    location: '',
    manager_name: '',
    checked_register: false,
    checked_suspicious_parcels: false,
    scanned_parcels_count: '',
    no_suspicious_activity: false,
    findings_notes: '',
    geo_lat: null,
    geo_lng: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Attempt to automatically get geo location for the premium geo-tagged enforcement check
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
          console.log('Geolocation permission denied or not available:', error);
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
    if (!formData.courier_office_name.trim()) {
      alert("Courier Office Name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      // Submit to the endpoint (either /courier-check or /courier-drive)
      await api.post('/enforcement/courier-check', {
        ...formData,
        scanned_parcels_count: formData.scanned_parcels_count ? parseInt(formData.scanned_parcels_count) : null
      });
      alert('Courier Office check logged successfully!');
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
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Courier Office Name *</label>
          <input
            type="text"
            name="courier_office_name"
            value={formData.courier_office_name}
            onChange={handleChange}
            className="input"
            placeholder="e.g. DTDC Courier Services, Tirupati Main Branch"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Manager / Contact Person Name</label>
          <input
            type="text"
            name="manager_name"
            value={formData.manager_name}
            onChange={handleChange}
            className="input"
            placeholder="Enter name of manager"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Location / Address</label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            className="input"
            placeholder="e.g. Balaji Colony, Tirupati"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Parcels Scanned Count</label>
          <input
            type="number"
            name="scanned_parcels_count"
            value={formData.scanned_parcels_count}
            onChange={handleChange}
            className="input"
            placeholder="e.g. 45"
            min="0"
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

      <div>
        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--color-garuda-200)' }}>Verification Checklist</label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-700)' }}>
            <input
              type="checkbox"
              name="checked_register"
              checked={formData.checked_register}
              onChange={handleChange}
              className="w-5 h-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium block" style={{ color: 'var(--color-garuda-300)' }}>Checked Booking Register</span>
              <span className="text-[10px]" style={{ color: 'var(--color-garuda-400)' }}>Verified sender and receiver IDs & records</span>
            </div>
          </label>

          <label className="flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors" style={{ background: 'var(--color-garuda-900)', border: '1px solid var(--color-garuda-700)' }}>
            <input
              type="checkbox"
              name="checked_suspicious_parcels"
              checked={formData.checked_suspicious_parcels}
              onChange={handleChange}
              className="w-5 h-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-medium block" style={{ color: 'var(--color-garuda-300)' }}>Inspected Suspicious Parcels</span>
              <span className="text-[10px]" style={{ color: 'var(--color-garuda-400)' }}>Checked packages from high-risk origin zones</span>
            </div>
          </label>
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
            <span className="block text-sm font-bold text-green-600">All Clear / No Suspicious Consignment Found</span>
            <span className="block text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>Check this if the inspection concluded without identifying any suspicious packages or contraband.</span>
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
          placeholder="Enter findings, parcel booking details, or any suspicious patterns noted..."
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
