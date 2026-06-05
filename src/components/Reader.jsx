import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, Bookmark, Settings, ChevronLeft, ChevronRight, 
  Type, Sun, Moon, Coffee, Check, Trash2
} from 'lucide-react';
import { useIndexedDB } from '../hooks/useIndexedDB';
import { useWakeLock } from '../hooks/useWakeLock';

const THEMES = {
  light: { class: '', color: '#ffffff', label: 'Light', icon: Sun },
  sepia: { class: 'theme-sepia', color: '#f4ecd8', label: 'Sepia', icon: Coffee },
  dark: { class: 'theme-dark', color: '#1a1a1a', label: 'Dark', icon: Moon },
};

export function Reader({ book, onBack }) {
  const [currentSpineIndex, setCurrentSpineIndex] = useState(book.progress?.spineIndex || 0);
  const [currentPage, setCurrentPage] = useState(book.progress?.pageIndex || 0);
  const [showUI, setShowUI] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [theme, setTheme] = useState('light');
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState('serif');
  const [bookmarks, setBookmarks] = useState([]);
  const [totalPages, setTotalPages] = useState(1);

  const contentRef = useRef(null);
  const containerRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const { saveProgress, addBookmark, removeBookmark, getBookmarks } = useIndexedDB();
  const { requestWakeLock } = useWakeLock();

  useEffect(() => {
    requestWakeLock();
    loadBookmarks();
    applyTheme(theme);
    const timer = setTimeout(() => {
      goToPage(book.progress?.pageIndex || 0);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const meta = document.getElementById('theme-color-meta');
    if (meta) {
      meta.setAttribute('content', THEMES[theme].color);
    }
    document.body.className = THEMES[theme].class;
  }, [theme]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      saveProgress(book.id, currentSpineIndex, currentPage);
    }, 500);
    return () => clearTimeout(timeout);
  }, [currentSpineIndex, currentPage, book.id, saveProgress]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const calculatePages = () => {
      const scrollWidth = el.scrollWidth;
      const clientWidth = el.clientWidth;
      const pages = Math.max(1, Math.round(scrollWidth / clientWidth));
      setTotalPages(pages);
    };

    const timer = setTimeout(calculatePages, 100);
    window.addEventListener('resize', calculatePages);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculatePages);
    };
  }, [currentSpineIndex, fontSize, fontFamily, theme]);

  const loadBookmarks = async () => {
    const marks = await getBookmarks(book.id);
    setBookmarks(marks);
  };

  const applyTheme = (t) => {
    document.body.className = THEMES[t].class;
  };

  const goToPage = (page) => {
    const el = contentRef.current;
    if (!el) return;
    const maxPage = Math.max(0, totalPages - 1);
    const targetPage = Math.max(0, Math.min(page, maxPage));
    const pageWidth = el.clientWidth;
    el.scrollTo({ left: targetPage * pageWidth, behavior: 'instant' });
    setCurrentPage(targetPage);
  };

  const nextPage = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const pageWidth = el.clientWidth;
    const maxScroll = el.scrollWidth - el.clientWidth;

    if (el.scrollLeft + pageWidth >= maxScroll - 5) {
      if (currentSpineIndex < book.chapters.length - 1) {
        setCurrentSpineIndex(prev => prev + 1);
        setCurrentPage(0);
      }
    } else {
      el.scrollTo({ left: el.scrollLeft + pageWidth, behavior: 'smooth' });
      setCurrentPage(prev => prev + 1);
    }
  }, [currentSpineIndex, book.chapters.length]);

  const prevPage = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const pageWidth = el.clientWidth;

    if (el.scrollLeft <= 5) {
      if (currentSpineIndex > 0) {
        setCurrentSpineIndex(prev => prev - 1);
        setTimeout(() => {
          const newEl = contentRef.current;
          if (newEl) {
            const pages = Math.round(newEl.scrollWidth / newEl.clientWidth);
            const lastPage = Math.max(0, pages - 1);
            newEl.scrollTo({ left: lastPage * newEl.clientWidth, behavior: 'instant' });
            setCurrentPage(lastPage);
          }
        }, 150);
      }
    } else {
      el.scrollTo({ left: el.scrollLeft - pageWidth, behavior: 'smooth' });
      setCurrentPage(prev => prev - 1);
    }
  }, [currentSpineIndex]);

  const handleTap = useCallback((zone) => {
    if (zone === 'left') {
      prevPage();
    } else if (zone === 'right') {
      nextPage();
    } else if (zone === 'center') {
      setShowUI(prev => !prev);
      setShowSettings(false);
      setShowBookmarks(false);
    }
  }, [nextPage, prevPage]);

  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        prevPage();
      } else {
        nextPage();
      }
    }
  }, [nextPage, prevPage]);

  const toggleBookmark = async () => {
    const existing = bookmarks.find(b => b.spineIndex === currentSpineIndex && b.pageIndex === currentPage);
    if (existing) {
      await removeBookmark(existing.id);
    } else {
      const chapterTitle = book.chapters[currentSpineIndex]?.id || `Chapter ${currentSpineIndex + 1}`;
      await addBookmark(book.id, currentSpineIndex, currentPage, chapterTitle);
    }
    await loadBookmarks();
  };

  const isBookmarked = bookmarks.some(b => b.spineIndex === currentSpineIndex && b.pageIndex === currentPage);
  const currentChapter = book.chapters[currentSpineIndex];

  return (
    <div className="h-full w-full relative overflow-hidden" ref={containerRef}>
      {/* Reader Content */}
      <div
        ref={contentRef}
        className="reader-content selectable"
        style={{
          '--reader-font-size': `${fontSize}px`,
          '--reader-font-family': fontFamily === 'serif' 
            ? 'Georgia, Cambria, "Times New Roman", Times, serif' 
            : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        dangerouslySetInnerHTML={{ __html: currentChapter?.content || '<p style="padding: 2rem; text-align: center; color: var(--reader-muted);">Loading chapter...</p>' }}
      />

      {/* Tap Zones */}
      <div className="tap-zone tap-zone-left" onClick={() => handleTap('left')} />
      <div className="tap-zone tap-zone-center" onClick={() => handleTap('center')} />
      <div className="tap-zone tap-zone-right" onClick={() => handleTap('right')} />

      {/* Top UI Overlay */}
      <div className={`
        absolute top-0 left-0 right-0 z-50 transition-all duration-300
        ${showUI ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}
      `}>
        <div className="bg-[var(--reader-bg)]/90 backdrop-blur-xl border-b border-[var(--reader-border)]">
          <div className="flex items-center justify-between px-4 pt-safe-top pb-3">
            <button
              onClick={onBack}
              className="tap-target p-2 rounded-full hover:bg-[var(--reader-border)] transition-colors"
              aria-label="Back to library"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 mx-4 text-center min-w-0">
              <p className="text-xs font-medium text-[var(--reader-text)] truncate">
                {book.title}
              </p>
              <p className="text-[10px] text-[var(--reader-muted)] mt-0.5">
                {currentSpineIndex + 1} / {book.chapters.length}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={toggleBookmark}
                className={`tap-target p-2 rounded-full hover:bg-[var(--reader-border)] transition-colors ${isBookmarked ? 'text-[var(--reader-accent)]' : ''}`}
                aria-label="Bookmark"
              >
                <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={() => { setShowBookmarks(true); setShowUI(false); }}
                className="tap-target p-2 rounded-full hover:bg-[var(--reader-border)] transition-colors"
                aria-label="Bookmarks"
              >
                <ChevronRight className="w-5 h-5 rotate-90" />
              </button>
              <button
                onClick={() => { setShowSettings(true); setShowUI(false); }}
                className="tap-target p-2 rounded-full hover:bg-[var(--reader-border)] transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Progress Bar */}
      <div className={`
        absolute bottom-0 left-0 right-0 z-50 transition-all duration-300
        ${showUI ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}>
        <div className="bg-[var(--reader-bg)]/90 backdrop-blur-xl border-t border-[var(--reader-border)] px-6 pb-safe-bottom pt-2">
          <div className="flex items-center justify-between text-xs text-[var(--reader-muted)] mb-2">
            <span>Page {currentPage + 1} of {totalPages}</span>
            <span>{Math.round(((currentSpineIndex + (currentPage / Math.max(1, totalPages))) / book.chapters.length) * 100)}%</span>
          </div>
          <div className="h-0.5 bg-[var(--reader-border)] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[var(--reader-accent)] rounded-full transition-all duration-300"
              style={{ width: `${((currentSpineIndex + (currentPage / Math.max(1, totalPages))) / book.chapters.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute inset-0 z-[60] flex items-end justify-center">
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          />
          <div className="relative bg-[var(--reader-bg)] w-full max-w-lg rounded-t-3xl shadow-2xl border-t border-[var(--reader-border)] p-6 animate-slide-up">
            <div className="w-12 h-1 rounded-full bg-[var(--reader-border)] mx-auto mb-6" />

            <h3 className="text-lg font-semibold mb-6">Reading Settings</h3>

            <div className="mb-6">
              <label className="text-xs font-medium text-[var(--reader-muted)] uppercase tracking-wider mb-3 block">
                Theme
              </label>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(THEMES).map(([key, t]) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setTheme(key)}
                      className={`
                        tap-target flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                        ${theme === key 
                          ? 'border-[var(--reader-accent)] bg-[var(--reader-accent)]/5' 
                          : 'border-[var(--reader-border)] hover:border-[var(--reader-muted)]'
                        }
                      `}
                    >
                      <div 
                        className="w-8 h-8 rounded-full border border-[var(--reader-border)]"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="text-sm font-medium">{t.label}</span>
                      {theme === key && <Check className="w-4 h-4 text-[var(--reader-accent)]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs font-medium text-[var(--reader-muted)] uppercase tracking-wider mb-3 block">
                Font
              </label>
              <div className="flex gap-3">
                {['serif', 'sans'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFontFamily(f)}
                    className={`
                      tap-target flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all
                      ${fontFamily === f
                        ? 'border-[var(--reader-accent)] bg-[var(--reader-accent)]/5 text-[var(--reader-accent)]'
                        : 'border-[var(--reader-border)]'
                      }
                    `}
                    style={{ fontFamily: f === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif' }}
                  >
                    {f === 'serif' ? 'Serif' : 'Sans'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-[var(--reader-muted)] uppercase tracking-wider">
                  Size
                </label>
                <span className="text-sm font-medium">{fontSize}px</span>
              </div>
              <div className="flex items-center gap-4">
                <Type className="w-4 h-4 text-[var(--reader-muted)]" />
                <input
                  type="range"
                  min="14"
                  max="28"
                  step="2"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="flex-1 h-1.5 bg-[var(--reader-border)] rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: 'var(--reader-accent)' }}
                />
                <Type className="w-5 h-5 text-[var(--reader-muted)]" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bookmarks Panel */}
      {showBookmarks && (
        <div className="absolute inset-0 z-[60] flex items-end justify-center">
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setShowBookmarks(false)}
          />
          <div className="relative bg-[var(--reader-bg)] w-full max-w-lg rounded-t-3xl shadow-2xl border-t border-[var(--reader-border)] p-6 animate-slide-up max-h-[70vh] flex flex-col">
            <div className="w-12 h-1 rounded-full bg-[var(--reader-border)] mx-auto mb-6" />
            <h3 className="text-lg font-semibold mb-4">Bookmarks</h3>

            {bookmarks.length === 0 ? (
              <p className="text-sm text-[var(--reader-muted)] text-center py-8">
                No bookmarks yet. Tap the bookmark icon while reading to save your place.
              </p>
            ) : (
              <div className="overflow-y-auto flex-1 -mx-6 px-6">
                {bookmarks.map((bookmark) => (
                  <div
                    key={bookmark.id}
                    className="flex items-center justify-between py-3 border-b border-[var(--reader-border)] tap-target"
                    onClick={() => {
                      setCurrentSpineIndex(bookmark.spineIndex);
                      setTimeout(() => goToPage(bookmark.pageIndex), 100);
                      setShowBookmarks(false);
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Bookmark className="w-4 h-4 text-[var(--reader-accent)] fill-current shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{bookmark.title}</p>
                        <p className="text-xs text-[var(--reader-muted)]">
                          Page {bookmark.pageIndex + 1}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBookmark(bookmark.id).then(loadBookmarks);
                      }}
                      className="p-2 text-[var(--reader-muted)] hover:text-red-500 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
