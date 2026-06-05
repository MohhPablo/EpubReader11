import React from 'react';
import { Trash2, BookOpen } from 'lucide-react';

export function Library({ books, onSelect, onDelete }) {
  return (
    <div className="p-6 pt-4 pb-safe-bottom">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
        {books.map((book) => (
          <div
            key={book.id}
            className="group relative tap-target"
            onClick={() => onSelect(book)}
          >
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[var(--reader-border)] shadow-sm mb-3 relative">
              {book.cover ? (
                <img
                  src={book.cover}
                  alt={book.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                  <BookOpen className="w-12 h-12 text-[var(--reader-muted)] opacity-50" />
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Remove this book from your library?')) {
                    onDelete(book.id);
                  }
                }}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                aria-label="Delete book"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <h3 className="font-medium text-sm leading-tight line-clamp-2 mb-1">
              {book.title}
            </h3>
            <p className="text-xs text-[var(--reader-muted)] line-clamp-1">
              {book.author}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
