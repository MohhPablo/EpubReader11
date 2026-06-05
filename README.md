# Premium ePub Reader PWA

A minimalist, cross-platform ePub Reader Progressive Web App built with React, Tailwind CSS, and IndexedDB. Designed for a native-like reading experience on iOS Safari and Android Chrome.

## Features

- **Premium UI**: Clean, ultra-minimalist design inspired by Apple Books and Google Play Books
- **PWA Optimized**: Fully compliant Web App Manifest with standalone display, maskable icons, and theme-aware status bars
- **Cross-Platform**: Optimized for both iOS Safari (safe areas, black-translucent status bar) and Android Chrome (dynamic theme color, overscroll prevention)
- **Local Storage**: Robust IndexedDB persistence for books, reading progress, and bookmarks
- **Horizontal Pagination**: CSS columns-based page turning with tap zones and swipe gestures
- **Reading Customization**: Serif/Sans-serif fonts, adjustable font size (14px-28px), Light/Sepia/Dark themes
- **Bookmarks**: Quick bookmark toggle with structured overlay menu
- **Screen Wake Lock**: Prevents device from sleeping while reading
- **Zero Friction**: Disables browser-specific behaviors (text selection outside reader, long-press menus, pull-to-refresh, rubber-band scrolling)

## Tech Stack

- React 18 + Vite
- Tailwind CSS
- Lucide React (icons)
- JSZip (ePub parsing)
- Native IndexedDB API
- Screen Wake Lock API

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Navigate to project directory
cd epub-reader-pwa

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Building for Production

```bash
npm run build
```

The production build will be in the `dist/` directory. Serve this directory with any static file server.

For PWA testing on mobile:
1. Build the project
2. Serve `dist/` over HTTPS (required for PWA features like Wake Lock and Service Workers)
3. Access from your mobile device
4. Use "Add to Home Screen" to install as a standalone app

## PWA Configuration

### Web App Manifest
The `manifest.json` is configured with:
- `display: "standalone"` for native-like experience
- `orientation: "portrait"` for optimal reading
- Maskable icons for adaptive shapes on Android
- Theme colors that dynamically update based on reading theme

### iOS Optimizations
- `apple-mobile-web-app-capable: yes` enables standalone mode
- `apple-mobile-web-app-status-bar-style: black-translucent` for immersive status bar
- `viewport-fit: cover` with `env(safe-area-inset-*)` for notch/Dynamic Island compatibility

### Android Optimizations
- Dynamic `theme-color` meta tag updates with reading theme
- `mobile-web-app-capable: yes` for Add to Home Screen prompt
- `overscroll-behavior: none` prevents pull-to-refresh

## Architecture

### ePub Parsing
The custom parser (`src/utils/epubParser.js`) uses JSZip to:
1. Extract the EPUB container structure
2. Parse OPF metadata (title, author, cover)
3. Resolve the spine (reading order)
4. Inline CSS and convert images to data URLs for standalone rendering

### IndexedDB Schema
- **books**: Stores parsed book metadata and chapter content
- **progress**: Stores current spine index and page index per book
- **bookmarks**: Stores user bookmarks with spine/page references

### Reader Engine
- CSS multi-column layout creates horizontal "pages"
- `scrollLeft` manipulation provides smooth page transitions
- Tap zones (33% left, 33% center, 33% right) handle navigation and UI toggling
- Touch event handlers detect swipe gestures for page turning

## Project Structure

```
epub-reader-pwa/
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── components/
│   │   ├── Library.jsx       # Book grid view
│   │   ├── Reader.jsx        # Main reading interface
│   │   └── UploadZone.jsx    # Drag-and-drop import
│   ├── hooks/
│   │   ├── useIndexedDB.js   # Database operations
│   │   └── useWakeLock.js    # Screen wake lock management
│   ├── utils/
│   │   └── epubParser.js     # EPUB parsing engine
│   ├── App.jsx               # Main app router
│   ├── main.jsx              # Entry point
│   └── index.css             # Global styles + Tailwind
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Browser Support

- **iOS**: Safari 15.4+ (Wake Lock API support)
- **Android**: Chrome 84+ (Wake Lock API support)
- **Desktop**: Chrome, Edge, Firefox (for testing)

Note: Some PWA features (Wake Lock, standalone display) require HTTPS in production.

## Customization

### Themes
Edit the `THEMES` object in `Reader.jsx` to add custom color schemes:
```javascript
const THEMES = {
  light: { class: '', color: '#ffffff', label: 'Light', icon: Sun },
  sepia: { class: 'theme-sepia', color: '#f4ecd8', label: 'Sepia', icon: Coffee },
  dark: { class: 'theme-dark', color: '#1a1a1a', label: 'Dark', icon: Moon },
};
```

### Fonts
Add custom font families to `tailwind.config.js` and update the font selector in `Reader.jsx`.

## License

MIT
