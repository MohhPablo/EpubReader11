import { useCallback, useEffect, useState } from 'react';

const DB_NAME = 'EpubReaderDB';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('books')) {
        db.createObjectStore('books', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('progress')) {
        const progressStore = db.createObjectStore('progress', { keyPath: 'bookId' });
        progressStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains('bookmarks')) {
        const bookmarkStore = db.createObjectStore('bookmarks', { keyPath: 'id', autoIncrement: true });
        bookmarkStore.createIndex('bookId', 'bookId', { unique: false });
      }
    };
  });
}

export function useIndexedDB() {
  const [db, setDb] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    openDB().then(database => {
      setDb(database);
      setReady(true);
    }).catch(console.error);
  }, []);

  const saveBook = useCallback(async (book) => {
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite');
      const store = tx.objectStore('books');
      const request = store.put(book);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const getBooks = useCallback(async () => {
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readonly');
      const store = tx.objectStore('books');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const deleteBook = useCallback(async (bookId) => {
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['books', 'progress', 'bookmarks'], 'readwrite');
      tx.objectStore('books').delete(bookId);
      tx.objectStore('progress').delete(bookId);
      const bookmarkStore = tx.objectStore('bookmarks');
      const index = bookmarkStore.index('bookId');
      const request = index.openCursor(IDBKeyRange.only(bookId));
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          bookmarkStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }, [db]);

  const saveProgress = useCallback(async (bookId, spineIndex, pageIndex = 0) => {
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('progress', 'readwrite');
      const store = tx.objectStore('progress');
      const request = store.put({
        bookId,
        spineIndex,
        pageIndex,
        updatedAt: Date.now()
      });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const getProgress = useCallback(async (bookId) => {
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('progress', 'readonly');
      const store = tx.objectStore('progress');
      const request = store.get(bookId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const addBookmark = useCallback(async (bookId, spineIndex, pageIndex, title) => {
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('bookmarks', 'readwrite');
      const store = tx.objectStore('bookmarks');
      const request = store.add({
        bookId,
        spineIndex,
        pageIndex,
        title: title || `Chapter ${spineIndex + 1}`,
        createdAt: Date.now()
      });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const removeBookmark = useCallback(async (bookmarkId) => {
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('bookmarks', 'readwrite');
      const store = tx.objectStore('bookmarks');
      const request = store.delete(bookmarkId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const getBookmarks = useCallback(async (bookId) => {
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction('bookmarks', 'readonly');
      const store = tx.objectStore('bookmarks');
      const index = store.index('bookId');
      const request = index.getAll(bookId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  return {
    ready,
    saveBook,
    getBooks,
    deleteBook,
    saveProgress,
    getProgress,
    addBookmark,
    removeBookmark,
    getBookmarks
  };
}
