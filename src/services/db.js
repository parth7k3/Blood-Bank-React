const DB_NAME = 'VardaanDB';
const STORE_NAME = 'donors';
const CAMPS_STORE = 'camps';

export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);

    request.onupgradeneeded = (e) => {
      const activeDB = e.target.result;
      if (!activeDB.objectStoreNames.contains(STORE_NAME)) {
        activeDB.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!activeDB.objectStoreNames.contains(CAMPS_STORE)) {
        activeDB.createObjectStore(CAMPS_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export function getAllDonorsFromDB(activeDB) {
  return new Promise((resolve, reject) => {
    const transaction = activeDB.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export function saveAllDonorsToDB(activeDB, donors) {
  return new Promise((resolve, reject) => {
    const transaction = activeDB.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const clearReq = store.clear();
    clearReq.onsuccess = () => {
      if (donors.length === 0) {
        resolve();
        return;
      }

      let errorOccurred = false;
      donors.forEach(donor => {
        const req = store.put(donor);
        req.onerror = () => { errorOccurred = true; };
      });

      transaction.oncomplete = () => {
        if (errorOccurred) reject(new Error("Failed to write some donor records to database."));
        else resolve();
      };

      transaction.onerror = (e) => reject(e.target.error);
    };

    clearReq.onerror = (e) => reject(e.target.error);
  });
}

export function getAllCampsFromDB(activeDB) {
  return new Promise((resolve, reject) => {
    if (!activeDB.objectStoreNames.contains(CAMPS_STORE)) {
      resolve([]);
      return;
    }
    const transaction = activeDB.transaction(CAMPS_STORE, 'readonly');
    const store = transaction.objectStore(CAMPS_STORE);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

export function saveAllCampsToDB(activeDB, camps) {
  return new Promise((resolve, reject) => {
    if (!activeDB.objectStoreNames.contains(CAMPS_STORE)) {
      resolve();
      return;
    }
    const transaction = activeDB.transaction(CAMPS_STORE, 'readwrite');
    const store = transaction.objectStore(CAMPS_STORE);

    const clearReq = store.clear();
    clearReq.onsuccess = () => {
      if (!camps || camps.length === 0) {
        resolve();
        return;
      }

      let errorOccurred = false;
      camps.forEach(camp => {
        const req = store.put(camp);
        req.onerror = () => { errorOccurred = true; };
      });

      transaction.oncomplete = () => {
        if (errorOccurred) reject(new Error("Failed to write some camp records to database."));
        else resolve();
      };

      transaction.onerror = (e) => reject(e.target.error);
    };

    clearReq.onerror = (e) => reject(e.target.error);
  });
}
