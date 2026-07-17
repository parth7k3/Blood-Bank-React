import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { checkEligibility, getDiseaseScreeningResults, isSamePerson } from '../utils/helpers';
import { printDonorCertificate as printEngine } from '../utils/print';

function DonorDrawer({ isOpen, onClose, donor, donors, onEditClick }) {
  if (!donor) return null;

  const eligibility = useMemo(() => {
    return checkEligibility(donor, donors);
  }, [donor, donors]);

  const diseaseResults = useMemo(() => {
    return getDiseaseScreeningResults(donor.diseases);
  }, [donor.diseases]);

  // Calculations for cooldown and next eligibility dates matching vanilla
  const datesInfo = useMemo(() => {
    if (!donor.lastDonationDate || donor.lastDonationDate === 'Never') {
      return {
        daysSince: 'N/A',
        nextDate: 'Immediately (No history)',
        cooldownDays: 0
      };
    }

    const last = new Date(donor.lastDonationDate);
    const today = new Date();
    last.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(today - last);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const cooldownDays = donor.gender === 'Female' ? 120 : 90;
    const nextDateObj = new Date(last.getTime() + cooldownDays * 24 * 60 * 60 * 1000);
    
    // Format nextDateObj to YYYY-MM-DD
    const y = nextDateObj.getFullYear();
    const m = String(nextDateObj.getMonth() + 1).padStart(2, '0');
    const d = String(nextDateObj.getDate()).padStart(2, '0');
    const nextDate = `${y}-${m}-${d}`;

    return {
      daysSince: `${diffDays} days elapsed`,
      nextDate: nextDate,
      cooldownDays: diffDays
    };
  }, [donor.lastDonationDate, donor.gender]);

  const historyList = useMemo(() => {
    const personDonations = donors
      .filter(d => isSamePerson(d, donor))
      .map(d => ({
        id: d.id,
        date: d.lastDonationDate || 'Never',
        financialYear: d.financialYear,
        diseasePositive: d.diseasePositive,
        diseases: d.diseases,
        notes: d.notes
      }));

    // Sort descending by date
    personDonations.sort((a, b) => {
      if (!a.date || a.date === 'Never') return 1;
      if (!b.date || b.date === 'Never') return -1;
      return new Date(b.date) - new Date(a.date);
    });

    return personDonations;
  }, [donors, donor]);

  const handlePrint = () => {
    printEngine(donor);
  };

  return createPortal(
    <div className={`drawer-backdrop ${isOpen ? 'show' : ''}`} id="profile-drawer-backdrop" style={{ zIndex: 999 }} onClick={onClose}>
      <div className="drawer-box" onClick={(e) => e.stopPropagation()} style={{ overflowY: 'auto' }}>
        
        {/* Drawer Header Brand */}
        <div className="drawer-brand-header">
          <img src="/icon.svg" alt="Vardaan Logo" className="drawer-brand-logo" style={{ width: '36px', height: '36px', marginRight: '8px' }} />
          <div className="drawer-brand-text">
            <h3>Vardaan Charitable Blood Centre</h3>
            <p>A Unit of Jansiksha Foundation | Sirsa, Haryana</p>
          </div>
        </div>
        
        <div className="drawer-header" style={{ paddingTop: '0.5rem' }}>
          <div>
            <span className="drawer-id-badge" id="drawer-donor-id">{donor.id}</span>
            <h3 id="drawer-donor-name" style={{ marginBottom: 0, marginTop: '0.2rem' }}>{donor.name}</h3>
          </div>
          <button className="drawer-close" onClick={onClose}>&times;</button>
        </div>

        <div className="drawer-body">
          
          {/* Eligibility Banner */}
          <div className={`drawer-alert-banner ${eligibility.status}`} style={{
            background: eligibility.status === 'safe' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${eligibility.status === 'safe' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            color: eligibility.status === 'safe' ? 'var(--success)' : 'var(--danger)',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '1rem',
            fontSize: '0.9rem',
            fontWeight: '600'
          }}>
            {eligibility.status === 'safe' && `✅ Eligible: Ready for blood donation.`}
            {eligibility.status === 'deferred' && `⚠️ Deferred: Permanent deferral (${donor.diseases || 'Disease Positive'}).`}
            {eligibility.status === 'pending' && `⏳ Cooldown: ${eligibility.reason}.`}
          </div>

          {/* Demographics Card */}
          <div className="drawer-card">
            <h4>👤 Donor Demographics</h4>
            <div className="drawer-details-grid">
              <div className="detail-item"><strong>Age:</strong> {donor.age} yrs</div>
              <div className="detail-item"><strong>F/H Name:</strong> {donor.relativeName || 'N/A'}</div>
              <div className="detail-item"><strong>Gender:</strong> {donor.gender}</div>
              <div className="detail-item"><strong>Blood Group:</strong> <span className="badge badge-blood">{donor.bloodGroup}</span></div>
              <div className="detail-item"><strong>Phone:</strong> {donor.contact || 'N/A'}</div>
              <div className="detail-item"><strong>Email:</strong> {donor.email || 'N/A'}</div>
              <div className="detail-item form-full"><strong>Address:</strong> <div style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>{donor.address || 'N/A'}</div></div>
              <div className="detail-item form-full"><strong>Administrative Details:</strong> <div className="notes-box">{donor.notes || 'N/A'}</div></div>
            </div>
          </div>

          {/* Screening Tests Badges */}
          <div className="drawer-card">
            <h4>🔬 Transmissible Disease Screenings</h4>
            <div className="screening-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))', gap: '8px', marginTop: '8px' }}>
              <div className="screening-item" style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>HIV 1 & 2</div>
                <span className={`badge ${diseaseResults.hiv === 'Reactive' ? 'badge-deferred' : 'badge-safe'}`}>
                  {diseaseResults.hiv === 'Reactive' ? 'R' : 'NR'}
                </span>
              </div>
              <div className="screening-item" style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>HCV</div>
                <span className={`badge ${diseaseResults.hcv === 'Reactive' ? 'badge-deferred' : 'badge-safe'}`}>
                  {diseaseResults.hcv === 'Reactive' ? 'R' : 'NR'}
                </span>
              </div>
              <div className="screening-item" style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>HBsAg</div>
                <span className={`badge ${diseaseResults.hbsag === 'Reactive' ? 'badge-deferred' : 'badge-safe'}`}>
                  {diseaseResults.hbsag === 'Reactive' ? 'R' : 'NR'}
                </span>
              </div>
              <div className="screening-item" style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>VDRL</div>
                <span className={`badge ${diseaseResults.vdrl === 'Reactive' ? 'badge-deferred' : 'badge-safe'}`}>
                  {diseaseResults.vdrl === 'Reactive' ? 'R' : 'NR'}
                </span>
              </div>
              <div className="screening-item" style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '4px' }}>MP</div>
                <span className={`badge ${diseaseResults.mp !== 'NEG' ? 'badge-deferred' : 'badge-safe'}`}>
                  {diseaseResults.mp !== 'NEG' ? diseaseResults.mp : 'NEG'}
                </span>
              </div>
            </div>
            {donor.diseasePositive && (
              <div style={{ marginTop: '0.8rem', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: '500' }}>
                ⚠️ Permanently deferred due to positive screenings.
              </div>
            )}
          </div>

          {/* Donation / Cooldown details */}
          <div className="drawer-card">
            <h4>📅 Donation Logistics</h4>
            <div className="drawer-details-grid">
              <div className="detail-item"><strong>Financial Year:</strong> {donor.financialYear}</div>
              <div className="detail-item"><strong>Last Donation:</strong> {donor.lastDonationDate || 'Never'}</div>
              <div className="detail-item"><strong>Next Eligibility Date:</strong> {datesInfo.nextDate}</div>
              <div className="detail-item"><strong>Days Since Donation:</strong> {datesInfo.daysSince}</div>
            </div>
          </div>

          {/* History table */}
          {historyList.length > 0 && (
            <div className="drawer-card" id="drawer-history-card">
              <h4>📋 History Log</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '6px' }}>Date</th>
                    <th style={{ padding: '6px' }}>FY</th>
                    <th style={{ padding: '6px' }}>Status</th>
                    <th style={{ padding: '6px' }}>Detail/Note</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map((h, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '6px' }}>{h.date}</td>
                      <td style={{ padding: '6px' }}>{h.financialYear}</td>
                      <td style={{ padding: '6px' }}>
                        <span className={`badge ${h.diseasePositive ? 'badge-deferred' : 'badge-safe'}`} style={{ padding: '2px 6px', fontSize: '0.72rem' }}>
                          {h.diseasePositive ? 'Diseased' : 'Cleared'}
                        </span>
                      </td>
                      <td style={{ padding: '6px', color: '#94a3b8' }}>{h.notes || h.diseases || 'Standard donation'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Printed Report Footer */}
        <div className="drawer-print-footer">
          <img src="/icon.svg" alt="Jansiksha Logo" className="drawer-footer-logo" />
          <div className="drawer-footer-text">
            <h3>JANSIKSHA FOUNDATION</h3>
            <p>Voluntary Blood Donation Services & Community Health Initiative</p>
          </div>
        </div>

        {/* Action button options */}
        <div className="drawer-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem', display: 'flex', gap: '8px', position: 'sticky', bottom: 0, background: '#16181f' }}>
          <button className="btn btn-secondary" id="btn-print-profile" style={{ flex: 1 }} onClick={handlePrint}>
            🖨️ Print Certificate
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onEditClick}>
            ✍️ Edit Profile
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default DonorDrawer;
