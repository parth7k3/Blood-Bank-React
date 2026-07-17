import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

function DonorModal({ isOpen, onClose, onSave, donor }) {
  const [srNo, setSrNo] = useState('');
  const [name, setName] = useState('');
  const [relativeName, setRelativeName] = useState('');
  const [address, setAddress] = useState('');
  const [age, setAge] = useState('35');
  const [gender, setGender] = useState('Male');
  const [bloodGroup, setBloodGroup] = useState('');
  const [lastDonationDate, setLastDonationDate] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [diseaseCheck, setDiseaseCheck] = useState(false);
  const [diseases, setDiseases] = useState({
    HIV: false,
    HCV: false,
    HBsAg: false,
    VDRL: false,
    MP: false
  });
  const [notes, setNotes] = useState('');

  // Hydrate fields when editing a donor profile
  useEffect(() => {
    if (donor) {
      const match = donor.id ? donor.id.match(/^D-(\d+)$/) : null;
      setSrNo(match ? parseInt(match[1], 10).toString() : '');
      setName(donor.name || '');
      setRelativeName(donor.relativeName || '');
      setAddress(donor.address || '');
      setAge(donor.age ? donor.age.toString() : '35');
      setGender(donor.gender || 'Male');
      setBloodGroup(donor.bloodGroup || '');
      setLastDonationDate(donor.lastDonationDate && donor.lastDonationDate !== 'Never' ? donor.lastDonationDate : '');
      setContact(donor.contact || '');
      setEmail(donor.email || '');
      
      const isPos = !!donor.diseasePositive;
      setDiseaseCheck(isPos);
      
      const activeDiseases = donor.diseases ? donor.diseases.toUpperCase() : '';
      setDiseases({
        HIV: activeDiseases.includes('HIV'),
        HCV: activeDiseases.includes('HCV'),
        HBsAg: activeDiseases.includes('HBSAG'),
        VDRL: activeDiseases.includes('VDRL'),
        MP: activeDiseases.includes('MP')
      });
      setNotes(donor.notes || '');
    } else {
      // Defaults for new registration
      setSrNo('');
      setName('');
      setRelativeName('');
      setAddress('');
      setAge('35');
      setGender('Male');
      setBloodGroup('');
      setLastDonationDate(new Date().toISOString().substring(0, 10));
      setContact('');
      setEmail('');
      setDiseaseCheck(false);
      setDiseases({ HIV: false, HCV: false, HBsAg: false, VDRL: false, MP: false });
      setNotes('');
    }
  }, [donor, isOpen]);

  const handleDiseaseCheckbox = (key) => {
    setDiseases(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    let diseasesStr = '';
    if (diseaseCheck) {
      const list = [];
      if (diseases.HIV) list.push('HIV');
      if (diseases.HCV) list.push('HCV');
      if (diseases.HBsAg) list.push('HBsAg');
      if (diseases.VDRL) list.push('VDRL');
      if (diseases.MP) list.push('MP');
      diseasesStr = list.join(', ');

      if (list.length === 0) {
        alert("Please specify at least one positive transmissible disease.");
        return;
      }
    }

    const payload = {
      name,
      relativeName,
      address,
      age: parseInt(age, 10) || 35,
      gender,
      bloodGroup,
      lastDonationDate: lastDonationDate || 'Never',
      diseasePositive: diseaseCheck && diseasesStr !== '',
      diseases: diseaseCheck ? diseasesStr : '',
      notes
    };

    if (srNo.trim() !== '') {
      payload.id = `D-${String(srNo.trim()).padStart(4, '0')}`;
    }

    onSave(payload);
  };

  return createPortal(
    <div className={`modal-backdrop ${isOpen ? 'show' : ''}`} id="donor-modal" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h3 id="modal-title">{donor ? "Edit Donor Profile" : "Register New Donor"}</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form id="donor-form" onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-grid">
              
              <div className="form-group">
                <label htmlFor="donor-sr-no">Serial Number (Sr No.)</label>
                <input 
                  type="number" 
                  id="donor-sr-no" 
                  className="form-control" 
                  value={srNo}
                  onChange={(e) => setSrNo(e.target.value)}
                  placeholder="e.g. 1 (Auto if empty)"
                  disabled={!!donor}
                />
              </div>

              {/* Donor Name */}
              <div className="form-group">
                <label htmlFor="donor-name">Donor Full Name *</label>
                <input 
                  type="text" 
                  id="donor-name" 
                  className="form-control" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Johnathan Doe" 
                  required 
                  autoComplete="off"
                />
              </div>

              {/* Father/Husband Name */}
              <div className="form-group form-full">
                <label htmlFor="donor-relative-name">Father/Husband Name</label>
                <input 
                  type="text" 
                  id="donor-relative-name" 
                  className="form-control" 
                  value={relativeName}
                  onChange={(e) => setRelativeName(e.target.value)}
                  placeholder="e.g. Richard Doe"
                />
              </div>

              {/* Address */}
              <div className="form-group form-full">
                <label htmlFor="donor-address">Address</label>
                <input 
                  type="text" 
                  id="donor-address" 
                  className="form-control" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. #2769, Sector 20, Sirsa"
                />
              </div>

              {/* Age */}
              <div className="form-group">
                <label htmlFor="donor-age">Age (Years) *</label>
                <input 
                  type="number" 
                  id="donor-age" 
                  className="form-control" 
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Min 16, Max 80" 
                  min="16" 
                  max="80" 
                  required
                />
              </div>

              {/* Gender */}
              <div className="form-group">
                <label htmlFor="donor-gender">Gender</label>
                <select 
                  id="donor-gender" 
                  className="form-control"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Blood Group */}
              <div className="form-group">
                <label htmlFor="donor-blood">Blood Group *</label>
                <select 
                  id="donor-blood" 
                  className="form-control" 
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  required
                >
                  <option value="" disabled>Select blood type</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>

              {/* Donation / Entry Date */}
              <div className="form-group">
                <label htmlFor="donor-last-date">Donation / Entry Date</label>
                <input 
                  type="date" 
                  id="donor-last-date" 
                  className="form-control" 
                  value={lastDonationDate}
                  onChange={(e) => setLastDonationDate(e.target.value)}
                />
              </div>

              {/* Contact Number */}
              <div className="form-group">
                <label htmlFor="donor-contact">Contact Number</label>
                <input 
                  type="tel" 
                  id="donor-contact" 
                  className="form-control" 
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="e.g. 9876543210"
                />
              </div>

              {/* Email Address */}
              <div className="form-group">
                <label htmlFor="donor-email">Email Address</label>
                <input 
                  type="email" 
                  id="donor-email" 
                  className="form-control" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. name@example.com"
                />
              </div>

              {/* Disease Positive Check */}
              <div className="form-group form-full" style={{ marginTop: '0.5rem', background: 'rgba(239, 68, 68, 0.05)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    id="donor-disease-check"
                    checked={diseaseCheck}
                    onChange={(e) => setDiseaseCheck(e.target.checked)}
                  />
                  <span style={{ color: 'white', fontWeight: 500 }}>Mark Donor as Transmissible Disease Positive</span>
                </label>
              </div>

              {/* Disease detail checkboxes */}
              {diseaseCheck && (
                <div className="form-group form-full" id="disease-details-wrapper" style={{ background: 'rgba(239, 68, 68, 0.02)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '1rem', borderRadius: 'var(--radius-md)', marginTop: '0.5rem' }}>
                  <label style={{ color: 'var(--danger)', fontWeight: 600, marginBottom: '0.75rem', display: 'block' }}>
                    Select Diagnosed Diseases / Screening Positives *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.75rem' }}>
                    {Object.keys(diseases).map(dis => (
                      <label key={dis} className="checkbox-label" style={{ display: 'flex', align: 'center', gap: '0.5rem', color: '#fca5a5', fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={diseases[dis]} 
                          onChange={() => handleDiseaseCheckbox(dis)}
                          style={{ cursor: 'pointer', accentColor: 'var(--danger)' }}
                        /> {dis === 'HIV' ? 'HIV 1 & 2' : dis}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Special Notes */}
              <div className="form-group form-full">
                <label htmlFor="donor-notes">Special Administrative/Medical Notes</label>
                <textarea 
                  id="donor-notes" 
                  className="form-control" 
                  rows="3" 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add details like blood pressure readings, platelet counts, or deferral explanations..."
                />
              </div>

            </div>
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" id="btn-modal-submit">Save Profile</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default DonorModal;
