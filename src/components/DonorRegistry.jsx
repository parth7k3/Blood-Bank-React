import React, { useState, useMemo, useEffect, useRef } from 'react';
import { checkEligibility, getDiseaseScreeningResults } from '../utils/helpers';
import DonorModal from './DonorModal';
import DonorDrawer from './DonorDrawer';

function DonorRegistry({
  donors,
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


  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  // Modal and Drawer states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState(null); // For edit/view
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerDonor, setDrawerDonor] = useState(null);

  // References for the floating scrollbar
  const tableWrapperRef = useRef(null);
  const floatScrollRef = useRef(null);
  const floatContentRef = useRef(null);

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
  }, [search, filterDate, filterBlood, filterStatus, financialYear]);

  // 1. Filtering logic
  const filteredDonors = useMemo(() => {
    return donors.filter(donor => {
      // Financial Year filter (from sidebar)
      if (financialYear && donor.financialYear !== financialYear) return false;

      // Blood group filter
      if (filterBlood && donor.bloodGroup !== filterBlood) return false;

      // Status eligibility filter
      if (filterStatus) {
        const statusObj = checkEligibility(donor, donors);
        if (filterStatus === 'eligible' && statusObj.status !== 'safe') return false;
        if (filterStatus === 'ineligible' && statusObj.status !== 'pending') return false;
        if (filterStatus === 'deferred' && statusObj.status !== 'deferred') return false;
      }

      // Specific donation date filter
      if (filterDate && donor.lastDonationDate !== filterDate) return false;

      // Search keyword filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const idMatch = donor.id ? donor.id.toLowerCase().includes(query) : false;
        const nameMatch = donor.name ? donor.name.toLowerCase().includes(query) : false;
        const contactMatch = donor.contact ? donor.contact.includes(query) : false;
        const relativeMatch = donor.relativeName ? donor.relativeName.toLowerCase().includes(query) : false;
        const addressMatch = donor.address ? donor.address.toLowerCase().includes(query) : false;
        if (!idMatch && !nameMatch && !contactMatch && !relativeMatch && !addressMatch) return false;
      }

      return true;
    });
  }, [donors, financialYear, filterBlood, filterStatus, filterDate, search]);

  // 2. Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredDonors.length / rowsPerPage));
  const paginatedDonors = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredDonors.slice(start, end);
  }, [filteredDonors, currentPage]);

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
    if (window.confirm(`Are you sure you want to permanently delete the profile of ${donor.name} (ID: ${donor.id})?`)) {
      await deleteDonor(donor.id);
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
        </div>
      </div>

      {/* Registry main data table */}
      <div className="table-wrapper" ref={tableWrapperRef}>
        <table className="donor-table">
          <thead>
            <tr>
              <th>ID</th>
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
          <tbody>
            {paginatedDonors.length === 0 ? (
              <tr>
                <td colSpan="12" style={{ textAlign: 'center', color: 'var(--text-dark)', padding: '3rem' }}>
                  No donors matching filters found in database.
                </td>
              </tr>
            ) : (
              paginatedDonors.map(donor => {
                const diseases = getDiseaseScreeningResults(donor.diseases);
                const isDeferred = donor.diseasePositive;

                return (
                  <tr
                    key={donor.id}
                    className={isDeferred ? 'infected-row' : ''}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleRowClick(donor)}
                  >
                    <td>{donor.id}</td>
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
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="action-buttons">
                        <button className="action-btn edit-btn" onClick={() => handleEditClick(donor)} title="Edit Donor Information">
                          ✍️
                        </button>
                        <button className="action-btn delete-btn" onClick={() => handleDeleteClick(donor)} title="Delete Donor Profile">
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
          Showing {filteredDonors.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredDonors.length)} of {filteredDonors.length} entries
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
        onEditClick={() => handleEditClick(drawerDonor)}
      />
    </div>
  );
}

export default DonorRegistry;
