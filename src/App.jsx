import React, { useState, useCallback, useEffect } from 'react';
import { Library } from './components/Library';
import { Reader } from './components/Reader';
import { UploadZone } from './components/UploadZone';
import { useIndexedDB } from './hooks/useIndexedDB';
import { parseEpub } from './utils/epubParser';
import { BookOpen, Library as LibraryIcon } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('library'); // 'library' | 'reader' | 'upload'
  const [selectedBook, setSelectedBook] = useState(null);
  const [books, setBooks] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const { ready, saveBook, getBooks, deleteBook, getProgress } = useIndexedDB();

  const loadBooks = useCallback(async () => {
    if (!ready) return;
    const allBooks = await getBooks();
    setBooks(allBooks.sort((a, b) => b.addedAt - a.addedAt));
  }, [ready, getBooks]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const handleFileUpload = useCallback(async (file) => {
    if (!file || !file.name.endsWith('.epub')) return;
    setIsUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const book = await parseEpub(arrayBuffer);
      await saveBook(book);
      await loadBooks();
      setView('library');
    } catch (err) {
      console.error('Failed to parse EPUB:', err);
      alert('Failed to parse EPUB file. Please ensure it is a valid EPUB.');
    } finally {
      setIsUploading(false);
    }
  }, [saveBook, loadBooks]);

  const handleBookSelect = useCallback(async (book) => {
    const progress = await getProgress(book.id);
    setSelectedBook({ ...book, progress });
    setView('reader');
  }, [getProgress]);

  const handleDeleteBook = useCallback(async (bookId) => {
    await deleteBook(bookId);
    await loadBooks();
  }, [deleteBook, loadBooks]);

  const handleBackToLibrary = useCallback(() => {
    setView('library');
    setSelectedBook(null);
    loadBooks();
  }, [loadBooks]);

  return (
    <div className="h-full w-full bg-[var(--reader-bg)] text-[var(--reader-text)] transition-colors duration-300">
      {view === 'library' && (
        <div className="h-full flex flex-col">
          <header className="flex items-center justify-between px-6 pt-safe-top pb-4 border-b border-[var(--reader-border)]">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-[var(--reader-accent)]" />
              <h1 className="text-xl font-semibold tracking-tight">Reader</h1>
            </div>
            <button
              onClick={() => setView('upload')}
              className="tap-target p-2 rounded-full bg-[var(--reader-accent)] text-white"
              aria-label="Add book"
            >
              <LibraryIcon className="w-5 h-5" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto">
            {books.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center px-8 text-center">
                <div className="w-20 h-20 rounded-2xl bg-[var(--reader-border)] flex items-center justify-center mb-6">
                  <BookOpen className="w-10 h-10 text-[var(--reader-muted)]" />
                </div>
                <h2 className="text-lg font-medium mb-2">Your library is empty</h2>
                <p className="text-sm text-[var(--reader-muted)] mb-8 max-w-xs">
                  Import your favorite ePub books to start reading
                </p>
                <button
                  onClick={() => setView('upload')}
                  className="tap-target px-6 py-3 rounded-full bg-[var(--reader-accent)] text-white font-medium text-sm"
                >
                  Import Book
                </button>
              </div>
            ) : (
              <Library
                books={books}
                onSelect={handleBookSelect}
                onDelete={handleDeleteBook}
              />
            )}
          </div>
        </div>
      )}

      {view === 'upload' && (
        <UploadZone
          onUpload={handleFileUpload}
          onBack={() => setView('library')}
          isUploading={isUploading}
        />
      )}

      {view === 'reader' && selectedBook && (
        <Reader
          book={selectedBook}
          onBack={handleBackToLibrary}
        />
      )}
    </div>
  );
}
