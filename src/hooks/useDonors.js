import { useState, useEffect, useCallback } from 'react';
import { initDB, getAllDonorsFromDB, saveAllDonorsToDB } from '../services/db';
import { 
  getFinancialYear, 
  createHistoryEntry, 
  sortHistoryDesc, 
  mergeDonor, 
  isSamePerson,
  cleanDiseasesValue,
  cleanBloodGroup
} from '../utils/helpers';

export function useDonors() {
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDB, setActiveDB] = useState(null);

  // Background sync helper
  const syncBackup = useCallback(async (updatedDonors) => {
    try {
      await fetch('/api/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedDonors)
      });
    } catch (err) {
      console.log("Background disk backup sync skipped/failed.");
    }
  }, []);

  // Persistent save helper
  const persistDonors = useCallback(async (updatedDonors) => {
    setDonors(updatedDonors);

    // Save to IndexedDB
    if (activeDB) {
      try {
        await saveAllDonorsToDB(activeDB, updatedDonors);
      } catch (e) {
        console.error("IndexedDB write failed", e);
      }
    } else {
      // Fallback
      try {
        localStorage.setItem('bloodbank_donors', JSON.stringify(updatedDonors));
      } catch (e) {
        console.error("LocalStorage write failed", e);
      }
    }

    // Background sync
    syncBackup(updatedDonors);
  }, [activeDB, syncBackup]);

  // Load initial data
  useEffect(() => {
    let dbInstance = null;

    async function loadData() {
      try {
        dbInstance = await initDB();
        setActiveDB(dbInstance);
      } catch (e) {
        console.error("IndexedDB open failed", e);
      }

      let loadedDonors = [];
      if (dbInstance) {
        try {
          loadedDonors = await getAllDonorsFromDB(dbInstance);
        } catch (e) {
          console.error("Failed to read from IndexedDB", e);
        }
      }

      // Fallback to local server backup load
      if (loadedDonors.length === 0) {
        try {
          const backupRes = await fetch('/api/load');
          if (backupRes.ok) {
            const diskData = await backupRes.json();
            if (Array.isArray(diskData) && diskData.length > 0) {
              loadedDonors = diskData;
              if (dbInstance) {
                await saveAllDonorsToDB(dbInstance, loadedDonors);
              }
            }
          }
        } catch (err) {
          console.log("No local server backup available.");
        }
      }

      // Fallback to localStorage migration
      if (loadedDonors.length === 0) {
        const legacyData = localStorage.getItem('bloodbank_donors');
        if (legacyData) {
          try {
            loadedDonors = JSON.parse(legacyData);
            if (dbInstance) {
              await saveAllDonorsToDB(dbInstance, loadedDonors);
              localStorage.removeItem('bloodbank_donors');
            }
          } catch (e) {
            console.error("Failed to parse legacy database", e);
          }
        }
      }

      // Standardize values & run database auto-migration on load
      let migrationNeeded = false;
      const standardizedDonors = loadedDonors.map(d => {
        const cleaned = cleanDiseasesValue(d.diseases);
        let isDisPos = !!d.diseasePositive;
        if (cleaned !== d.diseases) {
          migrationNeeded = true;
        }
        const shouldBePos = cleaned !== '';
        if (isDisPos !== shouldBePos) {
          isDisPos = shouldBePos;
          migrationNeeded = true;
        }
        return {
          ...d,
          bloodGroup: cleanBloodGroup(d.bloodGroup),
          diseases: cleaned,
          diseasePositive: isDisPos
        };
      });

      if (migrationNeeded && dbInstance) {
        saveAllDonorsToDB(dbInstance, standardizedDonors).catch(err => {
          console.error("Database load auto-migration failed", err);
        });
      }

      setDonors(standardizedDonors);
      setLoading(false);
    }

    loadData();
  }, []);

  // Compute next donor ID helper
  const getNextDonorId = useCallback(() => {
    return donors.reduce((max, d) => {
      const match = d.id.match(/^D-(\d+)$/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 1000) + 1;
  }, [donors]);

  // CRUD: Add
  const addDonor = useCallback(async (donorData) => {
    const finYear = getFinancialYear(donorData.lastDonationDate);
    const newDonor = {
      id: donorData.id || `D-${getNextDonorId()}`,
      financialYear: finYear,
      ...donorData,
      donationHistory: [createHistoryEntry({ ...donorData, financialYear: finYear })]
    };

    const updated = [newDonor, ...donors];
    await persistDonors(updated);
    return newDonor;
  }, [donors, getNextDonorId, persistDonors]);

  // CRUD: Update
  const updateDonor = useCallback(async (id, donorData, isEditMode = false) => {
    const index = donors.findIndex(d => d.id === id);
    if (index === -1) return false;

    const updatedDonors = [...donors];
    const targetDonor = { ...updatedDonors[index] };

    const finYear = getFinancialYear(donorData.lastDonationDate, targetDonor.financialYear);
    const entryData = { ...donorData, financialYear: finYear };
    const newEntry = createHistoryEntry(entryData);

    let history = targetDonor.donationHistory || [];
    if (history.length === 0) {
      history = [createHistoryEntry(targetDonor)];
    }

    if (isEditMode) {
      const oldLastDonationDate = targetDonor.lastDonationDate || 'Never';
      const historyIdx = history.findIndex(item => item.date === oldLastDonationDate);
      if (historyIdx !== -1) {
        history[historyIdx] = newEntry;
      } else if (history.length > 0) {
        history[0] = newEntry;
      } else {
        history.unshift(newEntry);
      }
    } else {
      const hasMatch = history.some(item => item.date === donorData.lastDonationDate);
      if (!hasMatch && donorData.lastDonationDate) {
        history.unshift(newEntry);
      } else if (donorData.lastDonationDate) {
        const idx = history.findIndex(item => item.date === donorData.lastDonationDate);
        if (idx !== -1) history[idx] = newEntry;
      }
    }

    sortHistoryDesc(history);

    const latestDonationDate = history[0] && history[0].date !== 'Never' ? history[0].date : donorData.lastDonationDate;
    const latestFinYear = getFinancialYear(latestDonationDate, finYear);

    updatedDonors[index] = {
      ...targetDonor,
      ...donorData,
      lastDonationDate: latestDonationDate,
      financialYear: latestFinYear,
      donationHistory: history
    };

    await persistDonors(updatedDonors);
    return true;
  }, [donors, persistDonors]);

  // CRUD: Delete
  const deleteDonor = useCallback(async (id) => {
    const index = donors.findIndex(d => d.id === id);
    if (index === -1) return false;

    const updated = donors.filter(d => d.id !== id);
    await persistDonors(updated);
    return true;
  }, [donors, persistDonors]);

  // CRUD: Process Imported list (merging & sequential IDs table-wise)
  const processImportedDonorsList = useCallback(async (parsedImport) => {
    let addedCount = 0;
    let mergedCount = 0;

    const updatedDonors = [...donors];

    const duplicatesToMerge = [];
    const newRecordsToInsert = [];

    parsedImport.forEach(newDonor => {
      let existing = updatedDonors.find(d => d.id === newDonor.id && isSamePerson(d, newDonor));
      if (!existing) {
        existing = updatedDonors.find(d => isSamePerson(d, newDonor) && d.lastDonationDate === newDonor.lastDonationDate);
      }

      if (existing) {
        duplicatesToMerge.push({ existing, newDonor });
      } else {
        newRecordsToInsert.push(newDonor);
      }
    });

    duplicatesToMerge.forEach(({ existing, newDonor }) => {
      mergeDonor(existing, newDonor);
      mergedCount++;
    });

    newRecordsToInsert.sort((a, b) => {
      const dateA = a.lastDonationDate && a.lastDonationDate !== 'Never' ? a.lastDonationDate : '1970-01-01';
      const dateB = b.lastDonationDate && b.lastDonationDate !== 'Never' ? b.lastDonationDate : '1970-01-01';
      return dateA < dateB ? -1 : (dateA > dateB ? 1 : 0);
    });

    const existingIds = new Set(updatedDonors.map(d => d.id));
    let nextIdNum = 1001;

    newRecordsToInsert.forEach(newDonor => {
      if (newDonor.id && !existingIds.has(newDonor.id)) {
        existingIds.add(newDonor.id);
      } else {
        while (existingIds.has(`D-${String(nextIdNum).padStart(4, '0')}`)) {
          nextIdNum++;
        }
        newDonor.id = `D-${String(nextIdNum).padStart(4, '0')}`;
        existingIds.add(newDonor.id);
        nextIdNum++;
      }

      newDonor.donationHistory = newDonor.donationHistory || [createHistoryEntry(newDonor)];
      updatedDonors.unshift(newDonor);
      addedCount++;
    });

    await persistDonors(updatedDonors);
    return { addedCount, mergedCount };
  }, [donors, persistDonors]);

  // CRUD: Reset Database
  const resetDatabase = useCallback(async () => {
    try {
      await fetch('/api/clear', { method: 'POST' });
    } catch (err) {
      console.error("Failed to clear server backup", err);
    }
    await persistDonors([]);
  }, [persistDonors]);

  return {
    donors,
    loading,
    addDonor,
    updateDonor,
    deleteDonor,
    processImportedDonorsList,
    resetDatabase
  };
}
