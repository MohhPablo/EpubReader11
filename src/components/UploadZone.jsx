import React, { useCallback, useState } from 'react';
import { ArrowLeft, Upload, FileText, Loader2 } from 'lucide-react';

export function UploadZone({ onUpload, onBack, isUploading }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onUpload(files[0]);
    }
  }, [onUpload]);

  const handleFileInput = useCallback((e) => {
    const files = e.target.files;
    if (files.length > 0) {
      onUpload(files[0]);
    }
  }, [onUpload]);

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center gap-4 px-6 pt-safe-top pb-4 border-b border-[var(--reader-border)]">
        <button
          onClick={onBack}
          className="tap-target p-2 -ml-2 rounded-full"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Import Book</h1>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            w-full max-w-md aspect-square rounded-3xl border-2 border-dashed
            flex flex-col items-center justify-center p-8 text-center
            transition-all duration-300 tap-target
            ${isDragging 
              ? 'border-[var(--reader-accent)] bg-[var(--reader-accent)]/5 scale-[0.98]' 
              : 'border-[var(--reader-border)] bg-[var(--reader-bg)]'
            }
          `}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-12 h-12 text-[var(--reader-accent)] animate-spin mb-4" />
              <p className="text-sm font-medium">Parsing book...</p>
              <p className="text-xs text-[var(--reader-muted)] mt-1">This may take a moment</p>
            </>
          ) : (
            <>
              <div className={`
                w-16 h-16 rounded-2xl flex items-center justify-center mb-4
                transition-colors duration-300
                ${isDragging ? 'bg-[var(--reader-accent)]/10' : 'bg-[var(--reader-border)]'}
              `}>
                {isDragging ? (
                  <FileText className="w-8 h-8 text-[var(--reader-accent)]" />
                ) : (
                  <Upload className="w-8 h-8 text-[var(--reader-muted)]" />
                )}
              </div>

              <h3 className="font-medium mb-2">
                {isDragging ? 'Drop your ePub here' : 'Upload your ePub'}
              </h3>
              <p className="text-sm text-[var(--reader-muted)] mb-6 max-w-xs">
                Drag and drop a .epub file, or tap below to browse
              </p>

              <label className="tap-target px-6 py-3 rounded-full bg-[var(--reader-accent)] text-white font-medium text-sm cursor-pointer inline-block">
                Browse Files
                <input
                  type="file"
                  accept=".epub"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
