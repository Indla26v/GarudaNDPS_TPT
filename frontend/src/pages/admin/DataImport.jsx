/**
 * Admin — DPR Excel import (Phase 1)
 */
import { useState } from 'react';
import api from '../../api/axios';

export default function DataImport() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Select an Excel file');
      return;
    }
    setUploading(true);
    setError('');
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/admin/import/dpr', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>DPR Data Import</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-garuda-400)' }}>
          Upload Excel in DPR format (Police or Excise station abstracts). Columns: PS Name, CR No, Accused name, Year, Section, Quantity, etc.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{error}</div>
      )}

      <form onSubmit={handleUpload} className="rounded-xl p-6 space-y-4" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)' }}>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm w-full"
          style={{ color: 'var(--color-garuda-200)' }}
        />
        <button
          type="submit"
          disabled={uploading || !file}
          className="px-5 py-2.5 rounded-lg text-sm text-white"
          style={{ background: 'var(--color-accent-500)', opacity: uploading ? 0.6 : 1 }}
        >
          {uploading ? 'Importing...' : 'Import DPR'}
        </button>
      </form>

      {result && (
        <div className="rounded-xl p-6 text-sm space-y-2" style={{ background: 'var(--color-garuda-800)', border: '1px solid var(--color-garuda-700)', color: 'var(--color-garuda-200)' }}>
          <p>Rows processed: {result.rows}</p>
          <p>Cases created: {result.casesCreated}</p>
          <p>Offenders created: {result.offendersCreated}</p>
          <p>Skipped: {result.skipped}</p>
          {result.errors?.length > 0 && (
            <div className="mt-3 max-h-40 overflow-y-auto">
              <p className="font-medium text-amber-400">Warnings:</p>
              <ul className="list-disc pl-5 text-xs" style={{ color: 'var(--color-garuda-400)' }}>
                {result.errors.slice(0, 20).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
