import React, { useState, useRef } from 'react';
import { 
  handleExcelImport, 
  handleCSVImport, 
  handleJSONImport, 
  exportToExcel, 
  exportToJSON, 
  exportToCSV, 
  downloadCSVTemplate 
} from '../utils/excel';
import { filterDonationsByDateRange } from '../utils/helpers';
import { api } from '../services/api';

function ImportExport({ processImportedDonorsList }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [importStatus, setImportStatus] = useState(null); // { type: 'success'|'error', text: '' }

  const fileInputRef = useRef(null);

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getExportFilename = (baseName, ext) => {
    let dateSuffix = '_all_dates';
    if (startDate || endDate) {
      dateSuffix = `_${startDate || 'start'}_to_${endDate || 'end'}`;
    }
    return `${baseName}${dateSuffix}.${ext}`;
  };

  const handleFile = async (file) => {
    setImportStatus(null);
    const extension = file.name.split('.').pop().toLowerCase();
    
    try {
      let parsedList = [];
      
      if (extension === 'xlsx') {
        const buffer = await file.arrayBuffer();
        parsedList = await handleExcelImport(buffer, () => "");
      } else if (extension === 'csv') {
        const text = await file.text();
        parsedList = handleCSVImport(text);
      } else if (extension === 'json') {
        const text = await file.text();
        parsedList = handleJSONImport(text);
      } else {
        throw new Error("Unsupported file format. Please upload .xlsx, .csv or .json files.");
      }

      if (parsedList.length === 0) {
        throw new Error("No valid donor records found in the uploaded file.");
      }

      const { addedCount, mergedCount } = await processImportedDonorsList(parsedList);
      setImportStatus({
        type: 'success',
        text: `Processed ${parsedList.length} records. Added ${addedCount} new, merged ${mergedCount} duplicates!`
      });
    } catch (err) {
      console.error(err);
      setImportStatus({
        type: 'error',
        text: err.message || "Failed to parse import file."
      });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleExportCSV = () => {
    // Open the backend CSV export endpoint in a new tab to start download
    const url = api.getExportUrl({ startDate, endDate });
    window.open(url, '_blank');
  };

  const handleExportJSON = () => {
    alert("JSON Export is no longer supported for large datasets.");
  };

  const handleExportExcel = async () => {
    alert("Excel Export is no longer supported due to 1 million row limit. Please use CSV export.");
  };

  const handleDownloadTemplate = () => {
    const blob = downloadCSVTemplate();
    downloadBlob(blob, 'vardaan_donor_template.csv');
  };

  const handleDownloadBackup = () => {
    // Open the download URL in a new window/tab to trigger the file download
    window.open(api.getBackupUrl(), '_blank');
  };

  return (
    <div className="import-grid">
      
      {/* Import Panel Box */}
      <div className="glass-panel">
        <div className="panel-header">
          <div className="panel-title">
            <h3>📥 Import Donor Records</h3>
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Upload Excel (.xlsx), CSV or JSON files to merge with the local database. Automatically parses side-by-side tables like <strong>DONOR.xlsx</strong> and maps records by financial year.
        </p>

        {importStatus && (
          <div style={{
            background: importStatus.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${importStatus.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            color: importStatus.type === 'success' ? 'var(--success)' : 'var(--danger)',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            fontWeight: '600',
            textAlign: 'center'
          }}>
            {importStatus.type === 'success' ? '✅ ' : '❌ '} {importStatus.text}
          </div>
        )}

        <div 
          className={`import-box-zone ${isDragOver ? 'dragover' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current.click()}
          style={{ cursor: 'pointer' }}
        >
          <div className="import-zone-icon">📤</div>
          <p>Drag and drop your file here, or click to browse</p>
          <span className="import-instructions">Supports .xlsx, .csv or .json formats</span>
          <input 
            type="file" 
            ref={fileInputRef}
            className="import-file-input" 
            accept=".csv,.json,.xlsx"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadTemplate}>
            ⬇️ Download Sample CSV Template
          </button>
        </div>
      </div>

      {/* Export Panel Box */}
      <div className="glass-panel">
        <div className="panel-header">
          <div className="panel-title">
            <h3>Export Database Backup</h3>
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Download a complete snapshot of the current donor database. Keep these files safe for data security and backup recovery purposes.
        </p>

        {/* Date range filter */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
          <h4 style={{ color: 'white', marginBottom: '0.75rem', fontSize: '0.95rem', fontWeight: 600 }}>📅 Date Range Filter</h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Select a donation date range to filter the exported records. Leave empty to export all records.
          </p>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="export-page-start-date" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>From Date</label>
              <input 
                type="date" 
                id="export-page-start-date" 
                className="form-control" 
                style={{ background: '#15161c', borderColor: 'rgba(255,255,255,0.1)' }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="export-page-end-date" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>To Date</label>
              <input 
                type="date" 
                id="export-page-end-date" 
                className="form-control" 
                style={{ background: '#15161c', borderColor: 'rgba(255,255,255,0.1)' }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Export buttons stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={handleExportExcel} style={{ justifyContent: 'center', padding: '1rem', fontWeight: 600, background: '#991b1b' }}>
            📈 Export Database as Excel (.xlsx)
          </button>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={handleExportCSV} style={{ flex: 1, justifyContent: 'center' }}>
              📄 Export CSV
            </button>
            <button className="btn btn-secondary" onClick={handleExportJSON} style={{ flex: 1, justifyContent: 'center' }}>
              📦 Export JSON
            </button>
          </div>
        </div>
        
        {/* Database SQLite Backup Stack */}
        <div style={{ marginTop: '2rem', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(225, 29, 72, 0.15)' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            💾 Full Database Backup
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '1rem' }}>
            Download the raw SQLite database file directly from the server. This contains all users, settings, camps, and donors.
          </p>
          <button className="btn btn-secondary" onClick={handleDownloadBackup} style={{ width: '100%', justifyContent: 'center' }}>
            ⬇️ Download SQLite Backup (.sqlite)
          </button>
        </div>
      </div>

    </div>
  );
}

export default ImportExport;
