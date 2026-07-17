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

function ImportExport({ donors, processImportedDonorsList, getNextDonorId }) {
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
        parsedList = await handleExcelImport(buffer, getNextDonorId);
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

  // Export triggers
  const getFilteredListForExport = () => {
    if (!startDate && !endDate) return donors;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    return donors.filter(d => {
      if (d.donationHistory && d.donationHistory.length > 0) {
        const matches = filterDonationsByDateRange(d.donationHistory, startDate, endDate);
        return matches.length > 0;
      }
      if (d.lastDonationDate && d.lastDonationDate !== 'Never') {
        const dDate = new Date(d.lastDonationDate);
        if (start && dDate < start) return false;
        if (end && dDate > end) return false;
        return true;
      }
      return false;
    });
  };

  const handleExportExcel = async () => {
    const list = getFilteredListForExport();
    if (list.length === 0) {
      alert("No records found matching date range to export.");
      return;
    }
    try {
      const blob = await exportToExcel(list, startDate, endDate);
      downloadBlob(blob, getExportFilename('vardaan_donors', 'xlsx'));
    } catch (err) {
      alert("Excel export failed: " + err.message);
    }
  };

  const handleExportCSV = () => {
    const list = getFilteredListForExport();
    if (list.length === 0) {
      alert("No records found matching date range to export.");
      return;
    }
    const blob = exportToCSV(list, startDate, endDate);
    downloadBlob(blob, getExportFilename('vardaan_donors', 'csv'));
  };

  const handleExportJSON = () => {
    const list = getFilteredListForExport();
    if (list.length === 0) {
      alert("No records found matching date range to export.");
      return;
    }
    const blob = exportToJSON(list, startDate, endDate);
    downloadBlob(blob, getExportFilename('vardaan_donors', 'json'));
  };

  const handleDownloadTemplate = () => {
    const blob = downloadCSVTemplate();
    downloadBlob(blob, 'vardaan_donor_template.csv');
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
        
        <div style={{ marginTop: '2rem', background: 'rgba(225, 29, 72, 0.05)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(225, 29, 72, 0.15)' }}>
          <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ⚠️ Browser Privacy Note
          </h4>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>
            Data is stored locally in your browser's Cache/LocalStorage. Clearing cookies or site storage will remove this database. Export a CSV or JSON file regularly to ensure you do not lose any critical donor information.
          </p>
        </div>
      </div>

    </div>
  );
}

export default ImportExport;
