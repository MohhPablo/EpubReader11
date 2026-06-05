import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useIndexedDB } from '../hooks/useIndexedDB';
import { useWakeLock } from '../hooks/useWakeLock';

const THEMES = {
  light: { label: 'Light', bg: '#ffffff', text: '#1c1c1e', border: 'rgba(0,0,0,0.08)', accent: '#007aff' },
  sepia: { label: 'Sepia', bg: '#f8f1e3', text: '#3d2b1f', border: 'rgba(61,43,31,0.12)', accent: '#8b6914' },
  dark:  { label: 'Dark',  bg: '#141414', text: '#e8e8e8', border: 'rgba(255,255,255,0.08)', accent: '#0a84ff' },
};

export function Reader({ book, onBack }) {
  const savedTheme = localStorage.getItem('reader-theme') || 'light';
  const savedSize  = Number(localStorage.getItem('reader-font-size')) || 19;

  const [chapterIdx, setChapterIdx]     = useState(book.progress?.spineIndex || 0);
  const [theme, setTheme]               = useState(savedTheme);
  const [fontSize, setFontSize]         = useState(savedSize);
  const [showUI, setShowUI]             = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const scrollRef  = useRef(null);
  const hideTimer  = useRef(null);
  const saveTimer  = useRef(null);
  const didRestore = useRef(false);

  const { saveProgress } = useIndexedDB();
  const { requestWakeLock } = useWakeLock();
  const t = THEMES[theme];
  const chapter = book.chapters[chapterIdx];

  // Wake lock — keep screen on while reading
  useEffect(() => { requestWakeLock(); }, []);

  // Apply theme to body
  useEffect(() => {
    document.body.style.backgroundColor = t.bg;
    document.body.style.color = t.text;
    localStorage.setItem('reader-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('reader-font-size', fontSize);
  }, [fontSize]);

  // Scroll to top on chapter change (except initial restore)
  useEffect(() => {
    if (!didRestore.current) return;
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [chapterIdx]);

  // Restore saved scroll position on first load
  useEffect(() => {
    const saved = localStorage.getItem(`pos_${book.id}`);
    if (saved && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: Number(saved), behavior: 'instant' });
        didRestore.current = true;
      }, 80);
    } else {
      didRestore.current = true;
    }
  }, []);

  // Save scroll position + chapter as user reads
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        localStorage.setItem(`pos_${book.id}`, el.scrollTop);
        saveProgress(book.id, chapterIdx, 0);
      }, 800);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); clearTimeout(saveTimer.current); };
  }, [chapterIdx, book.id, saveProgress]);

  // Auto-hide UI after 3 s
  const resetHideTimer = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!showSettings) setShowUI(false);
    }, 3000);
  }, [showSettings]);

  useEffect(() => { resetHideTimer(); return () => clearTimeout(hideTimer.current); }, []);

  const handleTap = () => {
    if (showSettings) { setShowSettings(false); return; }
    setShowUI(prev => {
      if (!prev) { resetHideTimer(); return true; }
      clearTimeout(hideTimer.current);
      return false;
    });
  };

  const goTo = (idx) => {
    setChapterIdx(idx);
    localStorage.removeItem(`pos_${book.id}`);
    setShowUI(true);
    resetHideTimer();
  };

  const progress = Math.round(((chapterIdx + 1) / book.chapters.length) * 100);
  const isFirst  = chapterIdx === 0;
  const isLast   = chapterIdx === book.chapters.length - 1;

  return (
    <div className="h-full w-full relative" style={{ backgroundColor: t.bg, color: t.text }}>

      {/* ── Scrollable reading area ── */}
      <div
        ref={scrollRef}
        className="h-full w-full overflow-y-auto overscroll-none"
        onClick={handleTap}
      >
        {/* space for header */}
        <div style={{ height: 64 }} />

        {/* Chapter content */}
        <div
          className="reader-prose"
          style={{ fontSize, color: t.text, fontFamily: "Georgia, 'Times New Roman', serif", lineHeight: 1.75, padding: '0 24px 8px', maxWidth: 680, margin: '0 auto' }}
          dangerouslySetInnerHTML={{ __html: chapter?.content || '<p style="text-align:center;padding:4rem 0;opacity:.4">Loading…</p>' }}
        />

        {/* Chapter navigation */}
        <div
          className="flex items-center justify-between px-5 py-10"
          onClick={e => e.stopPropagation()}
        >
          <button
            disabled={isFirst}
            onClick={() => goTo(chapterIdx - 1)}
            className="flex items-center gap-1.5 px-5 py-3 rounded-2xl text-sm font-medium transition-opacity"
            style={{ opacity: isFirst ? 0 : 0.65, background: t.border, color: t.text, border: 'none' }}
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>

          <span className="text-xs" style={{ opacity: 0.35 }}>
            {chapterIdx + 1} / {book.chapters.length}
          </span>

          <button
            disabled={isLast}
            onClick={() => goTo(chapterIdx + 1)}
            className="flex items-center gap-1.5 px-5 py-3 rounded-2xl text-sm font-medium transition-opacity"
            style={{ opacity: isLast ? 0 : 0.65, background: t.border, color: t.text, border: 'none' }}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div style={{ height: 48 }} />
      </div>

      {/* ── Header (fades in/out) ── */}
      <div
        className="absolute top-0 left-0 right-0 z-40 transition-all duration-300"
        style={{ opacity: showUI ? 1 : 0, pointerEvents: showUI ? 'auto' : 'none' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ background: t.bg, borderBottom: `1px solid ${t.border}` }}>
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              onClick={onBack}
              className="p-2 rounded-full"
              style={{ color: t.accent }}
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 min-w-0 text-center">
              <p className="text-sm font-medium truncate" style={{ color: t.text }}>{book.title}</p>
            </div>

            <button
              onClick={() => { setShowSettings(true); clearTimeout(hideTimer.current); }}
              className="p-2 rounded-full"
              style={{ color: t.text, opacity: 0.5 }}
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Reading progress bar */}
          <div style={{ height: 2, background: t.border, margin: '0 0 2px' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: t.accent, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      </div>

      {/* ── Settings sheet ── */}
      {showSettings && (
        <div
          className="absolute inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-full rounded-t-3xl p-6 animate-slide-up"
            style={{ background: t.bg, borderTop: `1px solid ${t.border}` }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full mx-auto mb-7" style={{ background: t.border }} />

            {/* Theme */}
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ opacity: 0.4, color: t.text }}>
              Theme
            </p>
            <div className="grid grid-cols-3 gap-3 mb-7">
              {Object.entries(THEMES).map(([key, th]) => (
                <button
                  key={key}
                  onClick={() => setTheme(key)}
                  className="py-4 rounded-2xl text-sm font-medium transition-all"
                  style={{
                    background: th.bg,
                    color: th.text,
                    border: `2px solid ${theme === key ? t.accent : 'transparent'}`,
                    boxShadow: theme === key ? `0 0 0 1px ${t.accent}` : 'none',
                  }}
                >
                  {th.label}
                </button>
              ))}
            </div>

            {/* Font size */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ opacity: 0.4, color: t.text }}>
                Text Size
              </p>
              <span className="text-sm font-medium" style={{ color: t.text }}>{fontSize}px</span>
            </div>
            <div className="flex items-center gap-4 pb-4">
              <span style={{ fontSize: 13, color: t.text, opacity: 0.45 }}>A</span>
              <input
                type="range" min="15" max="26" step="1"
                value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                className="flex-1"
                style={{ accentColor: t.accent }}
              />
              <span style={{ fontSize: 20, color: t.text, opacity: 0.45 }}>A</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
