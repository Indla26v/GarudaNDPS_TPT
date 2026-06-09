import React, { useState } from 'react';
import api from '../../../api/axios';

export default function NdpsVerificationForm({ onCancel, onSuccess }) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    matchedOffenderId: null,
    subjectName: '',
    placeOfEnforcement: '',
    testResult: 'NEGATIVE',
    subjectAge: '',
    subjectGender: '',
    subjectAadhaar: '',
    subjectPhone: '',
    subjectPan: '',
    subjectVoterId: '',
    subjectAddress: '',
    subjectFatherName: '',
    subjectLandmark: '',
    subjectDistrict: '',
    subjectOccupation: '',
    addictionType: 'GANJA_ONLY',
    consumptionFrequency: 'OCCASIONAL',
    sourceOfProcurement: 'LOCAL',
    modeOfPurchase: 'CASH',
    usualConsumptionSpot: ''
  });

  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchQuery.length < 3) {
      alert("Please enter at least 3 characters to search.");
      return;
    }
    try {
      setIsSearching(true);
      const res = await api.post('/enforcement/search', { query: searchQuery });
      setSearchResults(res.data.data || []);
      setStep(2);
    } catch (err) {
      console.error(err);
      alert('Failed to search database.');
    } finally {
      setIsSearching(false);
    }
  };

  const selectOffender = (offender) => {
    setFormData(prev => ({
      ...prev,
      matchedOffenderId: offender.id,
      subjectName: offender.full_name
    }));
    setStep(3);
  };

  const createNewRecord = () => {
    const query = searchQuery.trim();
    const isNumeric = /^\d+$/.test(query);
    
    let prefilled = {
      matchedOffenderId: null,
      subjectName: '',
      subjectAadhaar: '',
      subjectPhone: '',
      subjectPan: '',
      subjectVoterId: ''
    };

    if (isNumeric) {
      if (query.length === 12) {
        prefilled.subjectAadhaar = query;
      } else if (query.length === 10) {
        prefilled.subjectPhone = query;
      }
    } else {
      if (query.length === 10 && /^[A-Z]{5}\d{4}[A-Z]$/i.test(query)) {
        prefilled.subjectPan = query.toUpperCase();
      } else {
        prefilled.subjectName = query;
      }
    }

    setFormData(prev => ({
      ...prev,
      ...prefilled
    }));
    setStep(3);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStep3Submit = async (e) => {
    e.preventDefault();
    if (!formData.subjectName || !formData.placeOfEnforcement) {
      alert("Subject Name and Place of Enforcement are required.");
      return;
    }
    submitLog();
  };

  const submitLog = async (e) => {
    if (e) e.preventDefault();
    try {
      setIsSubmitting(true);
      await api.post('/enforcement', formData);
      alert('NDPS Verification log submitted successfully!');
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to submit log');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // RENDER STEPS
  // ─────────────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <form onSubmit={handleSearch} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>
            Search Database
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input flex-1"
              placeholder="Enter Name, Phone, Aadhaar, PAN, or Voter ID..."
              required
            />
            <button type="submit" disabled={isSearching} className="btn btn-primary whitespace-nowrap">
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-garuda-400)' }}>
            Always check if the suspect is an existing offender before creating a new record.
          </p>
        </div>
        <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--color-garuda-700)' }}>
          <button type="button" onClick={onCancel} className="btn btn-secondary">Cancel</button>
        </div>
      </form>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-medium" style={{ color: 'var(--color-garuda-100)' }}>Search Results</h3>
        
        {searchResults.length === 0 ? (
          <div className="p-4 rounded-lg text-center" style={{ background: 'var(--color-garuda-900)' }}>
            <p style={{ color: 'var(--color-garuda-300)' }}>No records found for "{searchQuery}".</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {searchResults.map(result => (
              <div key={result.id} className="p-3 rounded-lg border flex justify-between items-center" style={{ borderColor: 'var(--color-garuda-700)', background: 'var(--color-garuda-800)' }}>
                <div>
                  <h4 className="font-medium" style={{ color: 'var(--color-garuda-100)' }}>{result.full_name}</h4>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-garuda-400)' }}>
                    Category: {result.category || 'N/A'} | Status: {result.status}
                  </p>
                  <p className="text-xs text-blue-400 mt-1">Matched via: {result.matchReason}</p>
                </div>
                <button type="button" onClick={() => selectOffender(result)} className="btn btn-primary text-sm px-3 py-1">
                  Select
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 rounded-lg border border-dashed text-center" style={{ borderColor: 'var(--color-garuda-600)' }}>
          <p className="text-sm mb-3" style={{ color: 'var(--color-garuda-300)' }}>Not finding who you're looking for?</p>
          <button type="button" onClick={createNewRecord} className="btn btn-secondary">
            Create New Record
          </button>
        </div>

        <div className="flex justify-between pt-4 border-t" style={{ borderColor: 'var(--color-garuda-700)' }}>
          <button type="button" onClick={() => setStep(1)} className="btn btn-secondary">Back to Search</button>
          <button type="button" onClick={onCancel} className="btn btn-secondary text-red-400">Cancel</button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    const isNewRecord = !formData.matchedOffenderId;

    return (
      <form onSubmit={handleStep3Submit} className="space-y-6 animate-fade-in">
        {/* Selected Suspect Info Header */}
        <div className="p-3 rounded-lg flex items-center justify-between" style={{ background: 'var(--color-garuda-900)' }}>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: 'var(--color-garuda-400)' }}>Suspect Selected</p>
            <p className="font-medium mt-1" style={{ color: 'var(--color-garuda-100)' }}>
              {!isNewRecord ? formData.subjectName : 'New Record (Unmatched)'}
            </p>
          </div>
          <button type="button" onClick={() => setStep(2)} className="text-xs text-blue-400 hover:text-blue-300">Change</button>
        </div>

        {/* Basic Enforcement Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isNewRecord && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Subject Name *</label>
              <input 
                type="text" 
                name="subjectName" 
                value={formData.subjectName} 
                onChange={handleFormChange} 
                className="input" 
                placeholder="Enter suspect's full name"
                required 
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>Place of Enforcement *</label>
            <input 
              type="text" 
              name="placeOfEnforcement" 
              value={formData.placeOfEnforcement} 
              onChange={handleFormChange} 
              className="input" 
              placeholder="e.g. MG Road, Near Station" 
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-200)' }}>NDPS Drug Test Result *</label>
            <select name="testResult" value={formData.testResult} onChange={handleFormChange} className="input" required>
              <option value="NEGATIVE">Negative (Clean)</option>
              <option value="POSITIVE">Positive (Drugs Found)</option>
            </select>
          </div>
        </div>

        {/* Extended Fields for New Record (Unmatched Suspects) */}
        {isNewRecord && (
          <div className="space-y-6 pt-4 border-t" style={{ borderColor: 'var(--color-garuda-700)' }}>
            {formData.testResult === 'POSITIVE' && (
              <div className="p-3 rounded-lg border border-orange-500/30" style={{ background: 'rgba(234, 88, 12, 0.1)' }}>
                <p className="text-sm font-medium text-orange-400 mb-1">Test Result: POSITIVE</p>
                <p className="text-xs text-gray-300">
                  Please collect detailed demographic and drug profile details. This will be sent to the SHO for approval to create a new entry in the Consumer Database.
                </p>
              </div>
            )}

            {/* Section 1: Demographics */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider mb-3 pb-1 border-b border-gray-700" style={{ color: 'var(--color-garuda-200)' }}>Demographics</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-300)' }}>Age</label>
                  <input type="number" name="subjectAge" value={formData.subjectAge} onChange={handleFormChange} className="input" placeholder="e.g. 25" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-300)' }}>Gender</label>
                  <select name="subjectGender" value={formData.subjectGender} onChange={handleFormChange} className="input">
                    <option value="">Select...</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-300)' }}>Father's/Husband's Name</label>
                  <input type="text" name="subjectFatherName" value={formData.subjectFatherName} onChange={handleFormChange} className="input" placeholder="Father's name" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-300)' }}>Occupation</label>
                  <input type="text" name="subjectOccupation" value={formData.subjectOccupation} onChange={handleFormChange} className="input" placeholder="e.g. Student, Driver" />
                </div>
              </div>
            </div>

            {/* Section 2: Contact & Identity Docs */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider mb-3 pb-1 border-b border-gray-700" style={{ color: 'var(--color-garuda-200)' }}>Identity & Contacts</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-300)' }}>Phone Number</label>
                  <input type="text" name="subjectPhone" value={formData.subjectPhone} onChange={handleFormChange} className="input" placeholder="10-digit number" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-300)' }}>Aadhaar Number</label>
                  <input type="text" name="subjectAadhaar" value={formData.subjectAadhaar} onChange={handleFormChange} className="input" maxLength="12" placeholder="12-digit number" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-300)' }}>PAN Card</label>
                  <input type="text" name="subjectPan" value={formData.subjectPan} onChange={handleFormChange} className="input" maxLength="10" placeholder="10-digit alphanumeric" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-300)' }}>Voter ID Card</label>
                  <input type="text" name="subjectVoterId" value={formData.subjectVoterId} onChange={handleFormChange} className="input" placeholder="Voter ID No." />
                </div>
              </div>
            </div>

            {/* Section 3: Address Details */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider mb-3 pb-1 border-b border-gray-700" style={{ color: 'var(--color-garuda-200)' }}>Residence Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-300)' }}>Full Address</label>
                  <input type="text" name="subjectAddress" value={formData.subjectAddress} onChange={handleFormChange} className="input" placeholder="Street, Village/City address" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-300)' }}>Landmark / Area</label>
                  <input type="text" name="subjectLandmark" value={formData.subjectLandmark} onChange={handleFormChange} className="input" placeholder="e.g. Near Temple, Main Junction" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-300)' }}>District</label>
                  <input type="text" name="subjectDistrict" value={formData.subjectDistrict} onChange={handleFormChange} className="input" placeholder="e.g. Tirupati" />
                </div>
              </div>
            </div>

            {/* Section 4: Drug Consumption Profile (Only for POSITIVE Test Results) */}
            {formData.testResult === 'POSITIVE' && (
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider mb-3 pb-1 border-b border-gray-700" style={{ color: 'var(--color-garuda-200)' }}>Drug Profile & Habits</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-300)' }}>Addiction Type</label>
                    <select name="addictionType" value={formData.addictionType} onChange={handleFormChange} className="input">
                      <option value="GANJA_ONLY">Ganja Only</option>
                      <option value="GANJA_ALCOHOL">Ganja + Alcohol</option>
                      <option value="GANJA_OTHER_DRUGS">Ganja + Other Drugs</option>
                      <option value="MULTIPLE">Multiple Substances</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-300)' }}>Consumption Frequency</label>
                    <select name="consumptionFrequency" value={formData.consumptionFrequency} onChange={handleFormChange} className="input">
                      <option value="OCCASIONAL">Occasional</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="DAILY">Daily</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-300)' }}>Source of Procurement</label>
                    <select name="sourceOfProcurement" value={formData.sourceOfProcurement} onChange={handleFormChange} className="input">
                      <option value="LOCAL">Local Dealer</option>
                      <option value="OUTSIDE_DISTRICT">Outside District</option>
                      <option value="ONLINE">Online Delivery</option>
                      <option value="COURIER">Courier Post</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-300)' }}>Mode of Purchase</label>
                    <select name="modeOfPurchase" value={formData.modeOfPurchase} onChange={handleFormChange} className="input">
                      <option value="CASH">Cash payment</option>
                      <option value="UPI">UPI Transfer</option>
                      <option value="CREDIT">On Credit</option>
                      <option value="BARTER">Barter trade</option>
                      <option value="MIXED">Mixed methods</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-garuda-300)' }}>Usual Consumption Spot</label>
                    <input type="text" name="usualConsumptionSpot" value={formData.usualConsumptionSpot} onChange={handleFormChange} className="input" placeholder="e.g. Abandoned building near station, park" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form Action Buttons */}
        <div className="flex justify-between pt-4 border-t" style={{ borderColor: 'var(--color-garuda-700)' }}>
          <button type="button" onClick={onCancel} className="btn btn-secondary text-red-400">Cancel</button>
          <button type="submit" disabled={isSubmitting} className={isNewRecord && formData.testResult === 'POSITIVE' ? 'btn btn-primary bg-orange-600 hover:bg-orange-700' : 'btn btn-primary'}>
            {isSubmitting ? 'Submitting...' : (isNewRecord && formData.testResult === 'POSITIVE' ? 'Submit to SHO for Approval' : 'Submit Log')}
          </button>
        </div>
      </form>
    );
  }

  return null;
}
