import { openDB } from 'idb';

const DB_NAME = 'MusicPlayerDB';
const DB_VERSION = 2; // Incremented version to apply schema change
const STORE_NAME = 'songs';

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      if (oldVersion < 1) {
        // Initial creation
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      } else if (oldVersion < 2) {
        // Upgrade from version 1 to 2: recreating the store with autoIncrement
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

export async function saveSong(song) {
  const db = await initDB();
  return db.put(STORE_NAME, song);
}

export async function getAllSongs() {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

export async function deleteSong(id) {
  const db = await initDB();
  return db.delete(STORE_NAME, id);
}
