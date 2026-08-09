import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export function useDonors(user) {
  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load data when user logs in
  useEffect(() => {
    async function loadData() {
      if (!user) {
        setCamps([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const campsData = await api.getCamps();
        setCamps(campsData);
      } catch (err) {
        console.error("Failed to load data from server", err);
        if (err.message.includes('401') || err.message.includes('403')) {
          setCamps([]);
        }
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [user]);

  // CRUD: Add Donor
  const addDonor = useCallback(async (donorData) => {
    try {
      const history = [{ date: donorData.lastDonationDate || new Date().toISOString().split('T')[0], ...donorData }];
      const payload = {
        ...donorData,
        donationHistory: JSON.stringify(history)
      };
      
      const newDonor = await api.createDonor(payload);
      return { ...newDonor, donationHistory: history };
    } catch (err) {
      console.error("Failed to add donor", err);
      return null;
    }
  }, []);

  // CRUD: Update Donor
  const updateDonor = useCallback(async (id, donorData, isEditMode = false) => {
    try {
      await api.updateDonor(id, donorData);
      return true;
    } catch (err) {
      console.error("Failed to update donor", err);
      return false;
    }
  }, []);

  // CRUD: Delete Donor
  const deleteDonor = useCallback(async (id) => {
    try {
      await api.deleteDonor(id);
      return true;
    } catch (err) {
      console.error("Failed to delete donor", err);
      return false;
    }
  }, []);

  // CRUD: Add Camp
  const addCamp = useCallback(async (campData) => {
    try {
      const newCamp = await api.createCamp(campData);
      setCamps(prev => [...prev, newCamp]);
      return newCamp;
    } catch (err) {
      console.error("Failed to add camp", err);
      return null;
    }
  }, []);

  // CRUD: Edit Camp
  const editCamp = useCallback(async (campId, campData) => {
    try {
      await api.updateCamp(campId, campData);
      setCamps(prev => prev.map(c => (c.id === campId ? { ...c, ...campData } : c)));
      return true;
    } catch (err) {
      console.error("Failed to edit camp", err);
      return false;
    }
  }, []);

  // CRUD: Delete Camp
  const deleteCamp = useCallback(async (campId) => {
    try {
      await api.deleteCamp(campId);
      setCamps(prev => prev.filter(c => c.id !== campId));
      return true;
    } catch (err) {
      console.error("Failed to delete camp", err);
      return false;
    }
  }, []);

  // Process Imported list
  const processImportedDonorsList = useCallback(async (parsedImport) => {
    try {
      const result = await api.bulkImportDonors(parsedImport);
      return { addedCount: result.count, mergedCount: 0 };
    } catch (err) {
      console.error("Bulk import failed:", err);
      return { addedCount: 0, mergedCount: 0 };
    }
  }, []);

  // Reset Database
  const resetDatabase = useCallback(async (password) => {
    try {
      await api.resetDatabase(password);
      setCamps([]);
    } catch (err) {
      console.error("Failed to reset database", err);
      throw err;
    }
  }, []);

  return {
    camps,
    loading,
    addDonor,
    updateDonor,
    deleteDonor,
    addCamp,
    editCamp,
    deleteCamp,
    processImportedDonorsList,
    resetDatabase
  };
}
