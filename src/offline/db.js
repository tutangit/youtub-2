import { openDB } from 'idb';

const DB_NAME = 'MusicPlayerDB';
const DB_VERSION = 1;
const STORE_NAME = 'songs';

export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
