import JSZip from 'jszip';

/**
 * Robust EPUB parser that handles real-world EPUB 2/3 files
 */
export async function parseEpub(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const files = Object.keys(zip.files);

  // Find container.xml (case-insensitive, handle nested paths)
  const containerPath = findFile(files, 'META-INF/container.xml');
  if (!containerPath) {
    throw new Error('Invalid EPUB: missing META-INF/container.xml');
  }

  const containerXml = await zip.file(containerPath).async('text');
  const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');

  // Extract OPF path from container.xml
  const rootfile = containerDoc.querySelector('rootfile[media-type="application/oebps-package+xml"]');
  if (!rootfile) {
    throw new Error('Invalid EPUB: no OPF rootfile found in container.xml');
  }

  let opfPath = rootfile.getAttribute('full-path');
  if (!opfPath) {
    throw new Error('Invalid EPUB: rootfile missing full-path attribute');
  }

  // Normalize path separators
  opfPath = opfPath.replace(/\\/g, '/');
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  // Parse OPF
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new Error(`Invalid EPUB: OPF file not found at ${opfPath}`);
  }

  const opfXml = await opfFile.async('text');
  const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');

  // Extract metadata (handle namespaces properly)
  const metadata = opfDoc.querySelector('metadata');
  const title = getDcText(metadata, 'title') || 'Untitled';
  const author = getDcText(metadata, 'creator') || 'Unknown Author';
  const description = getDcText(metadata, 'description') || '';

  // Parse manifest
  const manifestItems = {};
  const manifest = opfDoc.querySelector('manifest');
  if (manifest) {
    manifest.querySelectorAll('item').forEach(item => {
      const id = item.getAttribute('id');
      let href = item.getAttribute('href');
      const mediaType = item.getAttribute('media-type');
      if (id && href) {
        // Resolve href relative to OPF directory
        href = normalizePath(opfDir + href);
        manifestItems[id] = { href, mediaType };
      }
    });
  }

  // Parse spine (reading order)
  const spine = [];
  const spineEl = opfDoc.querySelector('spine');
  if (spineEl) {
    spineEl.querySelectorAll('itemref').forEach(item => {
      const idref = item.getAttribute('idref');
      if (manifestItems[idref]) {
        spine.push({
          id: idref,
          href: manifestItems[idref].href,
          mediaType: manifestItems[idref].mediaType
        });
      }
    });
  }

  if (spine.length === 0) {
    throw new Error('Invalid EPUB: spine contains no readable chapters');
  }

  // Find cover
  let coverDataUrl = null;

  // Method 1: meta name="cover" reference
  const metaCover = metadata?.querySelector('meta[name="cover"]');
  if (metaCover) {
    const coverId = metaCover.getAttribute('content');
    if (manifestItems[coverId]) {
      coverDataUrl = await extractImage(zip, manifestItems[coverId].href);
    }
  }

  // Method 2: item with properties="cover-image"
  if (!coverDataUrl) {
    const coverItem = manifest?.querySelector('item[properties*="cover-image"]');
    if (coverItem) {
      const href = normalizePath(opfDir + coverItem.getAttribute('href'));
      coverDataUrl = await extractImage(zip, href);
    }
  }

  // Method 3: item with id containing "cover"
  if (!coverDataUrl) {
    const coverItem = manifest?.querySelector('item[id*="cover" i]');
    if (coverItem) {
      const href = normalizePath(opfDir + coverItem.getAttribute('href'));
      coverDataUrl = await extractImage(zip, href);
    }
  }

  // Extract chapters
  const chapters = [];
  for (const item of spine) {
    const file = zip.file(item.href);
    if (file) {
      try {
        let content = await file.async('text');
        content = await resolveResources(content, item.href, zip, opfDir);
        chapters.push({ id: item.id, href: item.href, content });
      } catch (err) {
        console.warn(`Failed to process chapter ${item.href}:`, err);
        chapters.push({
          id: item.id,
          href: item.href,
          content: '<p style="padding:2rem;color:var(--reader-muted)">Could not load chapter content.</p>'
        });
      }
    }
  }

  return {
    id: generateId(),
    title: title.trim(),
    author: author.trim(),
    description: description.trim(),
    cover: coverDataUrl,
    spine,
    chapters,
    addedAt: Date.now()
  };
}

/**
 * Find a file in the ZIP by path (case-insensitive)
 */
function findFile(files, target) {
  const lowerTarget = target.toLowerCase().replace(/\\/g, '/');
  return files.find(f => f.toLowerCase().replace(/\\/g, '/') === lowerTarget);
}

/**
 * Get Dublin Core metadata text (handles namespaced and non-namespaced)
 */
function getDcText(metadata, name) {
  if (!metadata) return '';
  // Try namespaced first
  let el = metadata.querySelector(`dc\\:${name}`);
  if (!el) el = metadata.querySelector(name);
  // Try with any namespace
  if (!el) {
    const all = metadata.getElementsByTagNameNS('*', name);
    if (all.length > 0) el = all[0];
  }
  return el?.textContent?.trim() || '';
}

/**
 * Normalize a path by resolving . and ..
 */
function normalizePath(path) {
  const parts = path.split('/').filter(p => p && p !== '.');
  const resolved = [];
  for (const part of parts) {
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return resolved.join('/');
}

/**
 * Resolve relative paths in HTML content (images, CSS)
 */
async function resolveResources(html, chapterHref, zip, opfDir) {
  const chapterDir = chapterHref.includes('/') 
    ? chapterHref.substring(0, chapterHref.lastIndexOf('/') + 1) 
    : '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Resolve images
  const images = doc.querySelectorAll('img[src]');
  for (const img of images) {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('http') || src.startsWith('data:') || src.startsWith('#')) continue;

    const resolvedPath = normalizePath(opfDir + chapterDir + src);
    const file = zip.file(resolvedPath);
    if (file) {
      try {
        const blob = await file.async('blob');
        const dataUrl = await blobToDataUrl(blob);
        img.setAttribute('src', dataUrl);
      } catch (e) {
        console.warn('Failed to inline image:', resolvedPath);
      }
    }
  }

  // Resolve CSS links (inline them)
  const links = doc.querySelectorAll('link[rel="stylesheet"]');
  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('data:')) continue;

    const resolvedPath = normalizePath(opfDir + chapterDir + href);
    const file = zip.file(resolvedPath);
    if (file) {
      try {
        const css = await file.async('text');
        const style = doc.createElement('style');
        style.textContent = css;
        link.parentNode.replaceChild(style, link);
      } catch (e) {
        console.warn('Failed to inline CSS:', resolvedPath);
      }
    }
  }

  return doc.body ? doc.body.innerHTML : doc.documentElement.innerHTML;
}

/**
 * Extract an image from the ZIP as a data URL
 */
async function extractImage(zip, path) {
  const file = zip.file(path);
  if (!file) return null;
  try {
    const blob = await file.async('blob');
    return await blobToDataUrl(blob);
  } catch (e) {
    return null;
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function generateId() {
  return 'book_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}
