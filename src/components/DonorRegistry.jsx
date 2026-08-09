import React, { useState, useMemo, useEffect, useRef } from 'react';
import { checkEligibility, getDiseaseScreeningResults } from '../utils/helpers';
import DonorModal from './DonorModal';
import DonorDrawer from './DonorDrawer';

function DonorRegistry({
  financialYear,
  addDonor,
  updateDonor,
  deleteDonor,
  user,
  onLoginClick,
  registryFilters,
  setRegistryFilters,
  camps = []
}) {
  // Local filter states
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterBlood, setFilterBlood] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSort, setFilterSort] = useState('latest');

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;
  
  // Data states
  const [donors, setDonors] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Modal and Drawer states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState(null); // For edit/view
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerDonor, setDrawerDonor] = useState(null);
  
  // Delete confirm modal state
  const [donorToDelete, setDonorToDelete] = useState(null);

  // References for the floating scrollbar
  const tableWrapperRef = useRef(null);
  const floatScrollRef = useRef(null);
  const floatContentRef = useRef(null);
  const loadDonorsRef = useRef(null);

  // Apply incoming filters from Dashboard
  useEffect(() => {
    if (registryFilters) {
      if (registryFilters.status !== undefined) setFilterStatus(registryFilters.status);
      if (registryFilters.blood !== undefined) setFilterBlood(registryFilters.blood);
      if (registryFilters.search !== undefined) setSearch(registryFilters.search);
      setRegistryFilters(null); // Clear after applying so user can manually change them
    }
  }, [registryFilters, setRegistryFilters]);

  // Reset pagination if filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterDate, filterBlood, filterStatus, filterSort, financialYear]);

  // Fetch paginated donors
  useEffect(() => {
    async function loadDonors() {
      setLoading(true);
      try {
        const { api } = await import('../services/api');
        const data = await api.getDonors({
          page: currentPage,
          limit: rowsPerPage,
          search,
          bloodGroup: filterBlood,
          fy: financialYear,
          status: filterStatus,
          date: filterDate,
          sort: filterSort
        });
        setDonors(data.donors);
        setTotalRecords(data.total);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadDonorsRef.current = loadDonors;
    loadDonors();
  }, [currentPage, search, filterBlood, financialYear, filterStatus, filterDate, filterSort]);

  const paginatedDonors = donors;

  // 3. Floating Scrollbar sync useEffect
  useEffect(() => {
    const wrapper = tableWrapperRef.current;
    const floatScroll = floatScrollRef.current;
    const floatContent = floatContentRef.current;
    if (!wrapper || !floatScroll || !floatContent) return;

    let isSyncingFloat = false;
    let isSyncingWrapper = false;

    const handleFloatScroll = () => {
      if (isSyncingFloat) return;
      isSyncingWrapper = true;
      wrapper.scrollLeft = floatScroll.scrollLeft;
      setTimeout(() => { isSyncingWrapper = false; }, 10);
    };

    const handleWrapperScroll = () => {
      if (isSyncingWrapper) return;
      isSyncingFloat = true;
      floatScroll.scrollLeft = wrapper.scrollLeft;
      setTimeout(() => { isSyncingFloat = false; }, 10);
    };

    floatScroll.addEventListener('scroll', handleFloatScroll);
    wrapper.addEventListener('scroll', handleWrapperScroll);

    // Position updater based on scroll and visibility
    const updateScrollbar = () => {
      const table = wrapper.querySelector('.donor-table');
      if (!table) return;

      const wrapperRect = wrapper.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      const needsScroll = tableRect.width > wrapperRect.width;
      const isBottomOffscreen = wrapperRect.bottom > viewportHeight;
      const isTopOnscreen = wrapperRect.top < viewportHeight;

      if (needsScroll && isBottomOffscreen && isTopOnscreen) {
        floatScroll.style.left = `${wrapperRect.left}px`;
        floatScroll.style.width = `${wrapperRect.width}px`;
        floatContent.style.width = `${tableRect.width}px`;
        floatScroll.style.display = 'block';
        floatScroll.scrollLeft = wrapper.scrollLeft;
      } else {
        floatScroll.style.display = 'none';
      }
    };

    window.addEventListener('scroll', updateScrollbar);
    window.addEventListener('resize', updateScrollbar);
    updateScrollbar();

    return () => {
      floatScroll.removeEventListener('scroll', handleFloatScroll);
      wrapper.removeEventListener('scroll', handleWrapperScroll);
      window.removeEventListener('scroll', updateScrollbar);
      window.removeEventListener('resize', updateScrollbar);
    };
  }, [paginatedDonors]);

  // Actions triggers
  const handleAddClick = () => {
    setSelectedDonor(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (donor) => {
    setSelectedDonor(donor);
    setIsModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleDeleteClick = async (donor) => {
    if (!user) {
      alert("Please login as Admin to delete donor profiles.");
      onLoginClick();
      return;
    }
    setDonorToDelete(donor);
  };

  const confirmDeleteDonor = async () => {
    if (donorToDelete) {
      await deleteDonor(donorToDelete.id);
      setDonorToDelete(null);
      if (loadDonorsRef.current) loadDonorsRef.current();
    }
  };

  const handleRowClick = (donor) => {
    setDrawerDonor(donor);
    setIsDrawerOpen(true);
  };

  const handleSaveDonor = async (formData) => {
    if (selectedDonor) {
      // Update
      await updateDonor(selectedDonor.id, formData, true);
    } else {
      // Add
      await addDonor(formData);
    }
    setIsModalOpen(false);
    if (loadDonorsRef.current) loadDonorsRef.current();
  };

  // Master Event Listener for Table (Event Delegation)
  const handleTableClick = (e) => {
    // 1. Check for action buttons first
    const editBtn = e.target.closest('button.edit-btn');
    const deleteBtn = e.target.closest('button.delete-btn');
    
    if (editBtn) {
      e.stopPropagation();
      const id = editBtn.getAttribute('data-id');
      const donor = paginatedDonors.find(d => String(d.id) === String(id));
      if (donor) handleEditClick(donor);
      return;
    }
    
    if (deleteBtn) {
      e.stopPropagation();
      const id = deleteBtn.getAttribute('data-id');
      const donor = paginatedDonors.find(d => String(d.id) === String(id));
      if (donor) handleDeleteClick(donor);
      return;
    }
    
    // 2. Check for row click (view profile)
    const row = e.target.closest('tr[data-id]');
    if (row) {
      const id = row.getAttribute('data-id');
      const donor = paginatedDonors.find(d => String(d.id) === String(id));
      if (donor) handleRowClick(donor);
    }
  };

  return (
    <div className="glass-panel">
      {/* Header controls bar */}
      <div className="panel-header">
        <div className="panel-title">
          <h3>📋 Registered Blood Donors</h3>
        </div>
        <button className="btn btn-primary" onClick={handleAddClick}>
          <span>➕</span> Register New Donor
        </button>
      </div>

      {/* Filters row controls wrapper */}
      <div className="controls-row">
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, contact info, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <input
            type="date"
            className="select-input"
            style={{ maxWidth: '150px' }}
            title="Filter by Donation Date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />

          <select
            className="select-input"
            value={filterBlood}
            onChange={(e) => setFilterBlood(e.target.value)}
          >
            <option value="">All Blood Groups</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </select>

          <select
            className="select-input"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="eligible">Eligible (Ready)</option>
            <option value="ineligible">Ineligible (Cooldown)</option>
            <option value="deferred">Deferred (Disease +)</option>
          </select>

          <select
            className="select-input"
            value={filterSort}
            onChange={(e) => setFilterSort(e.target.value)}
          >
            <option value="latest">Sort: Latest</option>
            <option value="oldest">Sort: Oldest</option>
          </select>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Total Results: <strong>{totalRecords}</strong>
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading records...
        </div>
      ) : (
      <div className="table-wrapper" ref={tableWrapperRef}>
        <table className="donor-table">
          <thead>
            <tr>
              <th>{financialYear ? 'S.No' : 'ID'}</th>
              <th>Donor Demographics</th>
              <th>Blood Camp</th>
              <th>Blood Group</th>
              <th>Contact Information</th>
              <th>Donation Date</th>
              <th>HIV</th>
              <th>HCV</th>
              <th>HBsAg</th>
              <th>VDRL</th>
              <th>MP</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody onClick={handleTableClick}>
            {paginatedDonors.length === 0 ? (
              <tr>
                <td colSpan="12" style={{ textAlign: 'center', color: 'var(--text-dark)', padding: '3rem' }}>
                  No donors matching filters found in database.
                </td>
              </tr>
            ) : (
              paginatedDonors.map((donor, index) => {
                const diseases = getDiseaseScreeningResults(donor.diseases);
                const isDeferred = donor.diseasePositive;

                return (
                  <tr
                    key={donor.id}
                    data-id={donor.id}
                    className={isDeferred ? 'infected-row' : ''}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      {financialYear ? (
                        <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>
                          {filterSort === 'latest' 
                            ? totalRecords - ((currentPage - 1) * rowsPerPage) - index 
                            : ((currentPage - 1) * rowsPerPage) + index + 1}
                        </span>
                      ) : (
                        <span className="badge">{donor.id}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{donor.name}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                        {donor.age} yrs • {donor.gender} • {donor.relativeName || 'No relative'}
                      </div>
                      {donor.notes && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={donor.notes}>
                          📝 {donor.notes}
                        </div>
                      )}
                    </td>
                    <td>{donor.camp ? <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-main)' }}>{donor.camp}</span> : '-'}</td>
                    <td><span className="badge badge-blood">{donor.bloodGroup}</span></td>
                    <td>
                      <div>📞 {donor.contact || 'N/A'}</div>
                      {donor.email && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>✉️ {donor.email}</div>}
                    </td>
                    <td>{donor.lastDonationDate || 'Never'}</td>
                    <td>
                      <span className={`badge ${diseases.hiv === 'Reactive' ? 'badge-deferred' : 'badge-safe'}`}>
                        {diseases.hiv === 'Reactive' ? 'R' : 'NR'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${diseases.hcv === 'Reactive' ? 'badge-deferred' : 'badge-safe'}`}>
                        {diseases.hcv === 'Reactive' ? 'R' : 'NR'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${diseases.hbsag === 'Reactive' ? 'badge-deferred' : 'badge-safe'}`}>
                        {diseases.hbsag === 'Reactive' ? 'R' : 'NR'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${diseases.vdrl === 'Reactive' ? 'badge-deferred' : 'badge-safe'}`}>
                        {diseases.vdrl === 'Reactive' ? 'R' : 'NR'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${diseases.mp !== 'NEG' ? 'badge-deferred' : 'badge-safe'}`}>
                        {diseases.mp !== 'NEG' ? diseases.mp : 'NEG'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn edit-btn" data-id={donor.id} title="Edit Donor Information">
                          ✍️
                        </button>
                        <button className="action-btn delete-btn" data-id={donor.id} title="Delete Donor Profile">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Floating horizontal scrollbar matching styles */}
      <div
        id="floating-table-scrollbar"
        ref={floatScrollRef}
        style={{
          position: 'fixed',
          bottom: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          height: '12px',
          zIndex: 99,
          background: 'rgba(22, 24, 31, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'none',
          borderRadius: 0
        }}
      >
        <div ref={floatContentRef} style={{ height: '1px' }} />
      </div>

      {/* Pagination component controls row */}
      <div className="pagination-container">
        <div className="pagination-info">
          Showing {totalRecords === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, totalRecords)} of {totalRecords} entries
        </div>
        <div className="pagination-buttons">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            « First
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            ‹ Prev
          </button>
          <span className="page-number-indicator">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next ›
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last »
          </button>
        </div>
      </div>

      {/* Add / Edit Donor Modal */}
      <DonorModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSaveDonor}
        donor={selectedDonor}
        camps={camps}
        donors={donors}
      />

      {/* View Donor Profile Drawer */}
      <DonorDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        donor={drawerDonor}
        donors={donors}
        addDonor={async (d) => {
          const newD = await addDonor(d);
          if (newD) {
            setCurrentPage(1);
          }
          return newD;
        }}
        updateDonor={async (id, data, isEdit) => {
          const res = await updateDonor(id, data, isEdit);
          if (res) {
            const { api } = await import('../services/api');
            const newData = await api.getDonors({ page: currentPage, limit: rowsPerPage, search, bloodGroup: filterBlood, fy: financialYear, status: filterStatus, date: filterDate });
            setDonors(newData.donors);
          }
          return res;
        }}
        deleteDonor={async (id) => {
          const res = await deleteDonor(id);
          if (res) {
            const { api } = await import('../services/api');
            const newData = await api.getDonors({ page: currentPage, limit: rowsPerPage, search, bloodGroup: filterBlood, fy: financialYear, status: filterStatus, date: filterDate });
            setDonors(newData.donors);
          }
          return res;
        }}
        onEditClick={() => handleEditClick(drawerDonor)}
      />
      {/* Delete Confirmation Modal */}
      {donorToDelete && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ color: '#ef4444' }}>⚠️ Confirm Deletion</h3>
              <button className="close-btn" onClick={() => setDonorToDelete(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <p style={{ color: 'var(--text-main)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                Are you sure you want to permanently delete the profile of <strong>{donorToDelete.name}</strong> (ID: {donorToDelete.id})? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setDonorToDelete(null)} className="btn btn-secondary" style={{ flex: 1, padding: '10px' }}>Cancel</button>
                <button type="button" onClick={confirmDeleteDonor} className="btn btn-primary" style={{ flex: 1, padding: '10px', background: '#ef4444' }}>Delete Donor</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DonorRegistry;
