import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export function useDonors(user) {
  const [donors, setDonors] = useState([]);
  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load data when user logs in
  useEffect(() => {
    async function loadData() {
      if (!user) {
        setDonors([]);
        setCamps([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const [donorsData, campsData] = await Promise.all([
          api.getDonors(),
          api.getCamps()
        ]);
        
        // Ensure donors have history property (from server or computed)
        const parsedDonors = donorsData.map(d => ({
          ...d,
          donationHistory: d.donationHistory ? JSON.parse(d.donationHistory) : []
        }));
        
        setDonors(parsedDonors);
        setCamps(campsData);
      } catch (err) {
        console.error("Failed to load data from server", err);
        // Handle unauthorized or network error
        if (err.message.includes('401') || err.message.includes('403')) {
          setDonors([]);
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
      const formattedDonor = {
        ...newDonor,
        donationHistory: history
      };
      setDonors(prev => [formattedDonor, ...prev]);
      return formattedDonor;
    } catch (err) {
      console.error("Failed to add donor", err);
      return null;
    }
  }, []);

  // CRUD: Update Donor
  const updateDonor = useCallback(async (id, donorData, isEditMode = false) => {
    try {
      const payload = {
        ...donorData
      };
      await api.updateDonor(id, payload);
      setDonors(prev => prev.map(d => (d.id === id ? { ...d, ...donorData } : d)));
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
      setDonors(prev => prev.filter(d => d.id !== id));
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
      // Reload donors from backend after bulk insert
      const donorsData = await api.getDonors();
      const parsedDonors = donorsData.map(d => ({
        ...d,
        donationHistory: d.donationHistory ? JSON.parse(d.donationHistory) : []
      }));
      setDonors(parsedDonors);
      
      return { addedCount: result.count, mergedCount: 0 };
    } catch (err) {
      console.error("Bulk import failed:", err);
      return { addedCount: 0, mergedCount: 0 };
    }
  }, []);

  // Reset Database
  const resetDatabase = useCallback(async () => {
    console.warn("Reset Database must be implemented on the backend.");
  }, []);

  return {
    donors,
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
