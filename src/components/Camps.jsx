import React, { useState } from 'react';

export default function Camps({ camps, donors, onAddCamp, onEditCamp, onDeleteCamp, onSelectDonor }) {
  const [newCampName, setNewCampName] = useState('');
  const [newCampDate, setNewCampDate] = useState('');
  const [expandedCampIds, setExpandedCampIds] = useState(new Set());
  
  // Edit modal state
  const [editingCamp, setEditingCamp] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');

  const handleCreateCamp = (e) => {
    e.preventDefault();
    if (!newCampName.trim()) {
      alert('Please enter a valid camp name.');
      return;
    }

    if (camps.some(c => c.name.toLowerCase() === newCampName.trim().toLowerCase())) {
      alert('A camp with this name already exists.');
      return;
    }

    onAddCamp({ name: newCampName, date: newCampDate });
    setNewCampName('');
    setNewCampDate('');
  };

  const toggleExpand = (campId) => {
    setExpandedCampIds(prev => {
      const next = new Set(prev);
      if (next.has(campId)) {
        next.delete(campId);
      } else {
        next.add(campId);
      }
      return next;
    });
  };

  const openEditModal = (camp, e) => {
    e.stopPropagation();
    setEditingCamp(camp);
    setEditName(camp.name);
    setEditDate(camp.date || '');
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) {
      alert('Please enter a valid camp name.');
      return;
    }

    if (
      editName.trim().toLowerCase() !== editingCamp.name.toLowerCase() &&
      camps.some(c => c.name.toLowerCase() === editName.trim().toLowerCase())
    ) {
      alert('A camp with this name already exists.');
      return;
    }

    onEditCamp(editingCamp.id, { name: editName, date: editDate });
    setEditingCamp(null);
  };

  const handleDelete = (camp, e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${camp.name}"? Assigned donors will have their camp tag removed.`)) {
      onDeleteCamp(camp.id);
    }
  };

  // Group donors by camp
  const campDonorsMap = {};
  camps.forEach(c => {
    campDonorsMap[c.name] = [];
  });

  donors.forEach(donor => {
    if (donor.camp && campDonorsMap[donor.camp]) {
      campDonorsMap[donor.camp].push(donor);
    }
  });

  return (
    <section id="camps" className="app-section">
      <div className="glass-panel">
        <div className="panel-header">
          <div className="panel-title">
            <h3>⛺ Blood Donation Camps</h3>
          </div>
        </div>

        <form onSubmit={handleCreateCamp} className="form-grid sub-card-box" style={{ marginBottom: '2rem', background: 'rgba(255, 255, 255, 0.02)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="new-camp-name" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Camp Name</label>
            <input
              type="text"
              id="new-camp-name"
              className="form-control"
              placeholder="e.g. Red Cross College Camp"
              value={newCampName}
              onChange={(e) => setNewCampName(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="new-camp-date" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Camp Date</label>
            <input
              type="date"
              id="new-camp-date"
              className="form-control"
              value={newCampDate}
              onChange={(e) => setNewCampDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <span>➕</span> Create Camp
            </button>
          </div>
        </form>

        <div id="camps-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {camps.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
              No blood camps found. Create one above!
            </div>
          ) : (
            camps.map(camp => {
              const campDonors = campDonorsMap[camp.name] || [];
              const isExpanded = expandedCampIds.has(camp.id);

              return (
                <div key={camp.id} className={`camp-card ${isExpanded ? 'expanded' : ''}`}>
                  <div className="camp-header" onClick={() => toggleExpand(camp.id)}>
                    <div className="camp-header-left">
                      <div className="camp-title">⛺ {camp.name}</div>
                      <div className="camp-subtitle">
                        <span>📅 {camp.date || 'No Date'}</span>
                        <div className="camp-stats">
                          <span className="camp-stat-badge">👥 {campDonors.length} Donors</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="action-btn btn-edit-camp"
                        title="Edit Camp"
                        onClick={(e) => openEditModal(camp, e)}
                      >
                        ✍️
                      </button>
                      <button
                        type="button"
                        className="action-btn btn-delete-camp"
                        title="Delete Camp"
                        onClick={(e) => handleDelete(camp, e)}
                      >
                        🗑️
                      </button>
                      <div className="camp-expand-icon" style={{ marginLeft: '0.5rem' }}>
                        ▼
                      </div>
                    </div>
                  </div>

                  <div className="camp-donors-container">
                    <table className="donor-table" style={{ fontSize: '0.8rem', width: '100%', tableLayout: 'fixed', wordBreak: 'break-word' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.5rem', textAlign: 'left', width: '40%' }}>ID / Name</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', width: '25%' }}>Blood Group</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', width: '35%' }}>Contact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campDonors.length === 0 ? (
                          <tr>
                            <td colSpan="3" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>
                              No donors registered for this camp yet.
                            </td>
                          </tr>
                        ) : (
                          campDonors.map(d => (
                            <tr
                              key={d.id}
                              className="camp-donor-row"
                              onClick={() => onSelectDonor && onSelectDonor(d.id)}
                            >
                              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                                <strong>{d.id}</strong><br />{d.name}
                              </td>
                              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                <span className="badge badge-blood">{d.bloodGroup}</span>
                              </td>
                              <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                                {d.contact || 'N/A'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Edit Camp Modal */}
      {editingCamp && (
        <div className="modal-backdrop active" style={{ zIndex: 3000 }} onClick={() => setEditingCamp(null)}>
          <div className="modal-box" style={{ width: '420px', maxWidth: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Blood Camp</h3>
              <button className="modal-close" onClick={() => setEditingCamp(null)}>&times;</button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem 0' }}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label htmlFor="edit-camp-name">Camp Name</label>
                <input
                  type="text"
                  id="edit-camp-name"
                  className="form-control"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-camp-date">Camp Date</label>
                <input
                  type="date"
                  id="edit-camp-date"
                  className="form-control"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingCamp(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
