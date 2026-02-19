import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Photo, EditSettings, DEFAULT_SETTINGS, Lut } from './types.ts';
import { processImage, calculateMaskAlpha, rgbToHsl } from './utils/imageProcessing.ts';
import { parseCubeLut } from './utils/lutParser.ts';
import { PhotoGrid } from './components/PhotoGrid.tsx';
import { ControlPanel } from './components/ControlPanel.tsx';
import { ProcessedThumbnail } from './components/ProcessedThumbnail.tsx';
import { FolderOpen, Download, LayoutGrid, Maximize2, ChevronLeft, ChevronRight, Crop, Check, X, Undo2, Redo2, Sparkles, FlipHorizontal, Eye, Columns } from 'lucide-react';

type HistoryItem = Record<string, EditSettings>;

export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [luts, setLuts] = useState<Lut[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPhotoId, setCurrentPhotoId] = useState<string | null>(null);
  const [settingsMap, setSettingsMap] = useState<Record<string, EditSettings>>({});
  const [viewMode, setViewMode] = useState<'grid' | 'edit'>('grid');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCropMode, setIsCropMode] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [compareSplit, setCompareSplit] = useState(0.5);
  const [activeMaskId, setActiveMaskId] = useState<string | null>(null);
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const [isAltPressed, setIsAltPressed] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenImageRef = useRef<HTMLImageElement>(new Image());

  const currentPhoto = photos.find(p => p.id === currentPhotoId);
  const currentSettings = currentPhotoId ? (settingsMap[currentPhotoId] || { ...DEFAULT_SETTINGS }) : DEFAULT_SETTINGS;

  const pushHistory = useCallback((newSettings: Record<string, EditSettings>) => {
    setHistory(prev => {
      const next = prev.slice(0, historyIndex + 1);
      next.push(JSON.parse(JSON.stringify(newSettings)));
      if (next.length > 50) next.shift();
      return next;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setSettingsMap(JSON.parse(JSON.stringify(history[prevIdx])));
      setHistoryIndex(prevIdx);
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setSettingsMap(JSON.parse(JSON.stringify(history[nextIdx])));
      setHistoryIndex(nextIdx);
    }
  }, [historyIndex, history]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos: Photo[] = Array.from(e.target.files)
        .filter((file: File) => file.type.startsWith('image/'))
        .map((file: File) => ({
          id: Math.random().toString(36).substr(2, 9),
          file,
          previewUrl: URL.createObjectURL(file),
          name: file.name
        }));
      setPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const handleImportLut = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      const loadedLuts: Lut[] = [];
      for (const file of files) {
        if (file.name.toLowerCase().endsWith('.cube')) {
          const text = await file.text();
          try { loadedLuts.push(parseCubeLut(file.name.replace('.cube', ''), text)); } catch (err) { }
        }
      }
      setLuts(prev => [...prev, ...loadedLuts]);
    }
  };

  const updateSetting = (key: keyof EditSettings, value: any, saveToHistory = true) => {
    if (!currentPhotoId) return;
    setSettingsMap(prev => {
      const next = {
        ...prev,
        [currentPhotoId]: { ...(prev[currentPhotoId] || DEFAULT_SETTINGS), [key]: value }
      };
      if (saveToHistory) pushHistory(next);
      return next;
    });
  };

  const syncSettings = useCallback((all: boolean) => {
    if (!currentPhotoId) return;
    const sourceSettings = settingsMap[currentPhotoId] || DEFAULT_SETTINGS;
    const targets = all ? photos.map(p => p.id) : Array.from(selectedIds);
    setSettingsMap(prev => {
      const next = { ...prev };
      targets.forEach(id => { 
        next[id] = JSON.parse(JSON.stringify(sourceSettings));
      });
      pushHistory(next);
      return next;
    });
  }, [currentPhotoId, settingsMap, photos, selectedIds, pushHistory]);

  const handleExportAll = useCallback(async () => {
    if (photos.length === 0) return;
    setIsProcessing(true);
    const photosToExport = selectedIds.size > 0 ? photos.filter(p => selectedIds.has(p.id)) : photos;
    
    for (const photo of photosToExport) {
      const settings = settingsMap[photo.id] || DEFAULT_SETTINGS;
      const activeLut = settings.lutId ? luts.find(l => l.id === settings.lutId) || null : null;
      const img = new Image();
      img.src = photo.previewUrl;
      await new Promise(r => img.onload = r);
      
      const exportCanvas = document.createElement('canvas');
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) continue;

      let srcX = 0, srcY = 0, srcW = img.naturalWidth, srcH = img.naturalHeight;
      if (settings.crop) {
        srcX = settings.crop.x * img.naturalWidth;
        srcY = settings.crop.y * img.naturalHeight;
        srcW = settings.crop.width * img.naturalWidth;
        srcH = settings.crop.height * img.naturalHeight;
      }
      exportCanvas.width = srcW;
      exportCanvas.height = srcH;
      
      ctx.save();
      if (settings.isMirrored) {
          ctx.translate(exportCanvas.width, 0);
          ctx.scale(-1, 1);
          const realCropX = settings.crop ? settings.crop.x : 0;
          const realCropW = settings.crop ? settings.crop.width : 1;
          const mirrorSx = (1 - (realCropX + realCropW)) * img.naturalWidth;
          ctx.drawImage(img, mirrorSx, settings.crop ? settings.crop.y * img.naturalHeight : 0, srcW, srcH, 0, 0, srcW, srcH);
      } else {
          ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
      }
      ctx.restore();
      
      const processed = processImage(ctx.getImageData(0,0,exportCanvas.width,exportCanvas.height), settings, activeLut);
      ctx.putImageData(processed, 0, 0);
      
      const link = document.createElement('a');
      link.download = `Snap_${photo.name}`;
      link.href = exportCanvas.toDataURL('image/jpeg', 0.95);
      link.click();
    }
    setIsProcessing(false);
  }, [photos, settingsMap, luts, selectedIds]);

  const confirmCrop = useCallback(() => {
    if (!isCropMode) return;
    updateSetting('crop', {
      x: cropRect.x,
      y: cropRect.y,
      width: cropRect.w,
      height: cropRect.h
    });
    setIsCropMode(false);
  }, [isCropMode, cropRect, updateSetting]);

  const toggleCropMode = useCallback(() => {
    if (isCropMode) {
      confirmCrop();
    } else {
      if (currentSettings.crop) {
        setCropRect({
          x: currentSettings.crop.x,
          y: currentSettings.crop.y,
          w: currentSettings.crop.width,
          h: currentSettings.crop.height
        });
      } else {
        setCropRect({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
      }
      setIsCropMode(true);
    }
  }, [isCropMode, currentSettings.crop, confirmCrop]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isComparing && !isCropMode) return;
    if (!isCropMode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const hitTest = (hx: number, hy: number) => Math.sqrt((x - hx) ** 2 + (y - hy) ** 2) < 0.05;
    
    if (hitTest(cropRect.x, cropRect.y)) setActiveHandle('tl');
    else if (hitTest(cropRect.x + cropRect.w, cropRect.y)) setActiveHandle('tr');
    else if (hitTest(cropRect.x, cropRect.y + cropRect.h)) setActiveHandle('bl');
    else if (hitTest(cropRect.x + cropRect.w, cropRect.y + cropRect.h)) setActiveHandle('br');
    else if (hitTest(cropRect.x + cropRect.w / 2, cropRect.y)) setActiveHandle('t');
    else if (hitTest(cropRect.x + cropRect.w / 2, cropRect.y + cropRect.h)) setActiveHandle('b');
    else if (hitTest(cropRect.x, cropRect.y + cropRect.h / 2)) setActiveHandle('l');
    else if (hitTest(cropRect.x + cropRect.w, cropRect.y + cropRect.h / 2)) setActiveHandle('r');
    else if (x > cropRect.x && x < cropRect.x + cropRect.w && y > cropRect.y && y < cropRect.y + cropRect.h) setActiveHandle('move');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isComparing && !isCropMode && !activeHandle) {
        if (e.buttons === 1) {
            const rect = canvasRef.current!.getBoundingClientRect();
            setCompareSplit(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
        }
        return;
    }
    if (!activeHandle || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(-0.1, Math.min(1.1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(-0.1, Math.min(1.1, (e.clientY - rect.top) / rect.height));

    setCropRect(prev => {
      let { x: nx, y: ny, w: nw, h: nh } = prev;
      const prevCenterX = nx + nw / 2;
      const prevCenterY = ny + nh / 2;
      const aspect = prev.w / prev.h;

      if (activeHandle === 'move') {
          const dx = x - (prev.x + prev.w/2);
          const dy = y - (prev.y + prev.h/2);
          const newX = Math.max(0, Math.min(1 - prev.w, prev.x + dx));
          const newY = Math.max(0, Math.min(1 - prev.h, prev.y + dy));
          return { x: newX, y: newY, w: prev.w, h: prev.h };
      }

      if (['tl', 'tr', 'bl', 'br'].includes(activeHandle!)) {
         let newW = nw, newH = nh;
         let fixedX = 0, fixedY = 0;
         if (activeHandle === 'br') { fixedX = prev.x; fixedY = prev.y; }
         else if (activeHandle === 'tl') { fixedX = prev.x + prev.w; fixedY = prev.y + prev.h; }
         else if (activeHandle === 'tr') { fixedX = prev.x; fixedY = prev.y + prev.h; }
         else if (activeHandle === 'bl') { fixedX = prev.x + prev.w; fixedY = prev.y; }

         const rawW = Math.abs(x - fixedX);
         const rawH = Math.abs(y - fixedY);
         const errX = Math.abs(rawH - rawW / aspect);
         const errY = Math.abs(rawW - rawH * aspect);
         
         if (errX < errY) { newW = rawW; newH = newW / aspect; } 
         else { newH = rawH; newW = newH * aspect; }

         if (activeHandle === 'br') {
             if (fixedX + newW > 1) { newW = 1 - fixedX; newH = newW / aspect; }
             if (fixedY + newH > 1) { newH = 1 - fixedY; newW = newH * aspect; }
             return { x: fixedX, y: fixedY, w: Math.max(0.01, newW), h: Math.max(0.01, newH) };
         } else if (activeHandle === 'tl') {
             if (fixedX - newW < 0) { newW = fixedX; newH = newW / aspect; }
             if (fixedY - newH < 0) { newH = fixedY; newW = newH * aspect; }
             return { x: fixedX - Math.max(0.01, newW), y: fixedY - Math.max(0.01, newH), w: Math.max(0.01, newW), h: Math.max(0.01, newH) };
         } else if (activeHandle === 'tr') {
             if (fixedX + newW > 1) { newW = 1 - fixedX; newH = newW / aspect; }
             if (fixedY - newH < 0) { newH = fixedY; newW = newH * aspect; }
             return { x: fixedX, y: fixedY - Math.max(0.01, newW), w: Math.max(0.01, newW), h: Math.max(0.01, newH) };
         } else if (activeHandle === 'bl') {
             if (fixedX - newW < 0) { newW = fixedX; newH = newW / aspect; }
             if (fixedY + newH > 1) { newH = 1 - fixedY; newW = newH * aspect; }
             return { x: fixedX - Math.max(0.01, newW), y: fixedY, w: Math.max(0.01, newW), h: Math.max(0.01, newH) };
         }
      }

      if (activeHandle === 't') { 
          nh += ny - y; ny = y; 
          if (ny < 0) { nh += ny; ny = 0; }
          if (nh < 0.01) { ny = prev.y + prev.h - 0.01; nh = 0.01; }
      } else if (activeHandle === 'b') { 
          nh = y - ny; 
          if (ny + nh > 1) { nh = 1 - ny; }
          if (nh < 0.01) nh = 0.01;
      } else if (activeHandle === 'l') { 
          nw += nx - x; nx = x; 
          if (nx < 0) { nw += nx; nx = 0; }
          if (nw < 0.01) { nx = prev.x + prev.w - 0.01; nw = 0.01; }
      } else if (activeHandle === 'r') { 
          nw = x - nx; 
          if (nx + nw > 1) { nw = 1 - nx; }
          if (nw < 0.01) nw = 0.01;
      }

      if (isAltPressed) {
          const maxW = Math.min(prevCenterX, 1 - prevCenterX) * 2;
          const maxH = Math.min(prevCenterY, 1 - prevCenterY) * 2;
          nw = Math.min(Math.abs(x - prevCenterX) * 2, maxW);
          nh = Math.min(Math.abs(y - prevCenterY) * 2, maxH);
          nx = prevCenterX - nw / 2;
          ny = prevCenterY - nh / 2;
      }

      return { x: nx, y: ny, w: Math.max(0.01, nw), h: Math.max(0.01, nh) };
    });
  };

  const handleMouseUp = () => setActiveHandle(null);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'Alt') setIsAltPressed(true);

      const isCmd = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;
      const key = e.key.toLowerCase();

      // Undo/Redo
      if (key === 'z' && isCmd) {
        e.preventDefault();
        isShift ? redo() : undo();
        return;
      }
      if (key === 'y' && isCmd) {
          e.preventDefault();
          redo();
          return;
      }

      // Selection Movement (Shift + Arrows)
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && isShift && viewMode === 'grid') {
          e.preventDefault();
          if (photos.length === 0) return;
          
          const ids = photos.map(p => p.id);
          // Find the last selected item (or first if none)
          // For simplicity, we just grab the last added to the set or the first photo
          const selectedArray = Array.from(selectedIds);
          const lastId = selectedArray.length > 0 ? selectedArray[selectedArray.length - 1] : ids[0];
          const currentIndex = ids.indexOf(lastId);
          
          let nextIndex = currentIndex;
          if (e.key === 'ArrowRight' && currentIndex < ids.length - 1) nextIndex++;
          if (e.key === 'ArrowLeft' && currentIndex > 0) nextIndex--;
          
          if (nextIndex !== currentIndex) {
              const nextId = ids[nextIndex];
              setSelectedIds(prev => {
                  const next = new Set(prev);
                  next.add(nextId);
                  return next;
              });
          }
          return;
      }

      // Feature Shortcuts
      if (key === 'c') toggleCropMode();
      if (key === 'm') updateSetting('isMirrored', !currentSettings.isMirrored);
      if (key === 'b') setIsComparing(prev => !prev); // Before/After
      if (key === 's') syncSettings(true); // Sync All
      if (key === 'e') handleExportAll(); // Export
      if (key === 'enter' && isCropMode) confirmCrop();
      if (key === 'escape') isCropMode ? setIsCropMode(false) : setIsComparing(false);
    };

    const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Alt') setIsAltPressed(false); };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { 
        window.removeEventListener('keydown', handleKeyDown); 
        window.removeEventListener('keyup', handleKeyUp); 
    };
  }, [isCropMode, cropRect, undo, redo, syncSettings, confirmCrop, toggleCropMode, isAltPressed, currentSettings, viewMode, photos, selectedIds, handleExportAll]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    const container = containerRef.current;
    if (!ctx || !container || !hiddenImageRef.current.complete) return;
    
    const img = hiddenImageRef.current;
    if (!img.naturalWidth || !img.naturalHeight) return;

    const activeCrop = currentSettings.crop;
    const showCropped = activeCrop && !isCropMode;

    let effectiveW = img.naturalWidth;
    let effectiveH = img.naturalHeight;

    if (showCropped && activeCrop) {
        effectiveW = activeCrop.width * img.naturalWidth;
        effectiveH = activeCrop.height * img.naturalHeight;
    }

    const imgRatio = effectiveW / effectiveH;

    const padding = 80; 
    let maxWidth = container.clientWidth - padding;
    let maxHeight = container.clientHeight - padding;
    let w = maxWidth, h = w / imgRatio;
    if (h > maxHeight) { h = maxHeight; w = h * imgRatio; }
    
    if (canvas.width !== Math.floor(w) || canvas.height !== Math.floor(h)) {
      canvas.width = Math.floor(w);
      canvas.height = Math.floor(h);
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    // Separate canvas for raw image to calculate mask from stable data
    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = canvas.width;
    rawCanvas.height = canvas.height;
    const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true });

    const drawToBuffer = (settingsToUse: EditSettings) => {
        if (!tempCtx || !rawCtx) return;
        tempCtx.save();
        tempCtx.clearRect(0,0,tempCanvas.width,tempCanvas.height);

        rawCtx.save();
        rawCtx.clearRect(0,0,rawCanvas.width,rawCanvas.height);
        
        let srcX = 0, srcY = 0, srcW = img.naturalWidth, srcH = img.naturalHeight;
        
        if (settingsToUse.crop) {
            srcX = settingsToUse.crop.x * img.naturalWidth;
            srcY = settingsToUse.crop.y * img.naturalHeight;
            srcW = settingsToUse.crop.width * img.naturalWidth;
            srcH = settingsToUse.crop.height * img.naturalHeight;
        }
        
        if (settingsToUse.isMirrored) {
            tempCtx.translate(tempCanvas.width, 0); tempCtx.scale(-1, 1);
            rawCtx.translate(rawCanvas.width, 0); rawCtx.scale(-1, 1);
            if (settingsToUse.crop) srcX = (1 - (settingsToUse.crop.x + settingsToUse.crop.width)) * img.naturalWidth;
        }
        
        tempCtx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, tempCanvas.width, tempCanvas.height);
        rawCtx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, rawCanvas.width, rawCanvas.height);
        
        const processed = processImage(tempCtx.getImageData(0,0,tempCanvas.width,tempCanvas.height), settingsToUse, luts.find(l => l.id === settingsToUse.lutId) || null);
        tempCtx.putImageData(processed, 0, 0);
        tempCtx.restore();
        rawCtx.restore();
    };

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (isComparing && !isCropMode) {
        const beforeSettings = {
            ...DEFAULT_SETTINGS,
            crop: currentSettings.crop,
            isMirrored: currentSettings.isMirrored
        };

        drawToBuffer(beforeSettings);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width * compareSplit, canvas.height);
        ctx.clip();
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();

        drawToBuffer(currentSettings);
        ctx.save();
        ctx.beginPath();
        ctx.rect(canvas.width * compareSplit, 0, canvas.width * (1 - compareSplit), canvas.height);
        ctx.clip();
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
        
        ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(canvas.width * compareSplit, 0); ctx.lineTo(canvas.width * compareSplit, canvas.height); ctx.stroke();
        ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(canvas.width * compareSplit, canvas.height/2, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#355faa'; ctx.beginPath(); ctx.arc(canvas.width * compareSplit, canvas.height/2, 4, 0, Math.PI * 2); ctx.fill();
    } else {
        let settingsForRender = currentSettings;
        if (isCropMode) {
            settingsForRender = { ...currentSettings, crop: null };
        }
        drawToBuffer(settingsForRender);
        ctx.drawImage(tempCanvas, 0, 0);
    }

    // RED OVERLAY FOR ACTIVE MASK
    if (activeMaskId && !isCropMode && rawCtx) {
        const activeMask = currentSettings.masks.find(m => m.id === activeMaskId);
        if (activeMask) {
            const width = canvas.width;
            const height = canvas.height;
            const overlayData = ctx.createImageData(width, height);
            const data = overlayData.data;

            // Use raw image for stable mask calculation (esp. color masks)
            const rawImgData = rawCtx.getImageData(0,0,width,height).data;

            for (let i = 0; i < data.length; i += 4) {
                const x = (i / 4) % width;
                const y = Math.floor((i / 4) / width);
                let u = x / width;
                let v = y / height;

                if (currentSettings.isMirrored) {
                    u = 1 - u;
                }
                if (currentSettings.crop) {
                    u = currentSettings.crop.x + u * currentSettings.crop.width;
                    v = currentSettings.crop.y + v * currentSettings.crop.height;
                }

                let hsl;
                if (activeMask.type === 'color') {
                    const r = rawImgData[i];
                    const g = rawImgData[i+1];
                    const b = rawImgData[i+2];
                    const [h, s, l] = rgbToHsl(r, g, b); 
                    hsl = { h, s, l };
                }

                const alpha = calculateMaskAlpha(u, v, width, height, activeMask, hsl);
                
                // Red overlay with transparency based on mask strength
                if (alpha > 0) {
                    data[i] = 255;   // R
                    data[i+1] = 0;   // G
                    data[i+2] = 0;   // B
                    data[i+3] = alpha * 130; // Alpha (approx 50% opacity at full strength)
                }
            }

            const overlayCanvas = document.createElement('canvas');
            overlayCanvas.width = width;
            overlayCanvas.height = height;
            overlayCanvas.getContext('2d')?.putImageData(overlayData, 0, 0);
            ctx.drawImage(overlayCanvas, 0, 0);
        }
    }

    if (isCropMode) {
      const { x: rx, y: ry, w: rw, h: rh } = cropRect;
      const px = rx * canvas.width, py = ry * canvas.height, pw = rw * canvas.width, ph = rh * canvas.height;
      
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, canvas.width, py);
      ctx.fillRect(0, py + ph, canvas.width, canvas.height - py - ph);
      ctx.fillRect(0, py, px, ph);
      ctx.fillRect(px + pw, py, canvas.width - px - pw, ph);

      ctx.strokeStyle = 'white'; 
      ctx.lineWidth = 2; 
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(px, py, pw, ph);
      ctx.setLineDash([]); 

      ctx.fillStyle = 'white'; 
      const hs = 10; 
      ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 4;
      const handles = [
          [px - hs/2, py - hs/2], [px + pw - hs/2, py - hs/2], 
          [px - hs/2, py + ph - hs/2], [px + pw - hs/2, py + ph - hs/2],
          [px + pw/2 - hs/2, py - hs/2], [px + pw/2 - hs/2, py + ph - hs/2], 
          [px - hs/2, py + ph/2 - hs/2], [px + pw - hs/2, py + ph/2 - hs/2]
      ];
      handles.forEach(([hx, hy]) => { ctx.fillRect(hx, hy, hs, hs); });
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    }
  }, [currentSettings, luts, isCropMode, cropRect, isComparing, compareSplit, activeMaskId]);

  useEffect(() => {
    if (viewMode === 'edit' && currentPhoto) {
      if (hiddenImageRef.current.src !== currentPhoto.previewUrl) {
        hiddenImageRef.current.src = currentPhoto.previewUrl;
        hiddenImageRef.current.onload = render;
      } else render();
    }
  }, [viewMode, currentPhoto, render]);

  useEffect(() => {
    const observer = new ResizeObserver(render);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [render]);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-800 overflow-hidden select-none">
      <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 shadow-sm z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#355faa] rounded-xl shadow-lg flex items-center justify-center text-white">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-800 tracking-tight">Snap Color</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Professional AI Colorist</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-[#355faa] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={20} /></button>
            <button onClick={() => { if(photos.length) { setCurrentPhotoId(currentPhotoId || photos[0].id); setViewMode('edit'); } }} className={`p-2 rounded-lg transition-all ${viewMode === 'edit' ? 'bg-white text-[#355faa] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Maximize2 size={20} /></button>
          </div>
          
          <div className="flex items-center gap-1.5 border-l border-slate-100 pl-3">
            <button onClick={undo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)" className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition-all"><Undo2 size={18} /></button>
            <button onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Shift+Z)" className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition-all"><Redo2 size={18} /></button>
          </div>

          <button 
            onClick={() => setIsComparing(!isComparing)} 
            className={`p-2.5 rounded-xl border transition-all ${isComparing ? 'bg-[#355faa] text-white border-[#355faa] shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
            title="Compare Before/After (B)"
          >
            <Columns size={20} />
          </button>

          <button 
            onClick={() => updateSetting('isMirrored', !currentSettings.isMirrored)} 
            className={`p-2.5 rounded-xl border transition-all ${currentSettings.isMirrored ? 'bg-[#355faa] text-white border-[#355faa] shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
            title="Mirror Image (M)"
          >
            <FlipHorizontal size={20} />
          </button>

          <button 
            onClick={toggleCropMode} 
            title="Crop (C)"
            className={`p-2.5 rounded-xl border transition-all ${isCropMode || currentSettings.crop ? 'bg-[#fbdc00] text-slate-800 border-[#eab308] shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
          >
            {isCropMode ? <Check size={20} /> : currentSettings.crop ? <X size={20} onClick={(e) => { if(currentSettings.crop) { e.stopPropagation(); updateSetting('crop', null); } }} /> : <Crop size={20} />}
          </button>
          
          <button onClick={handleExportAll} disabled={isProcessing || photos.length === 0} title="Export (E)" className="px-5 py-2.5 bg-[#355faa] text-white hover:opacity-90 rounded-xl font-semibold text-xs uppercase tracking-widest shadow-lg shadow-blue-900/10 transition-all flex items-center gap-2">
            <Download size={14} /> Export
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className={`${viewMode === 'grid' ? 'w-full' : 'w-0 md:w-72'} transition-all duration-300 border-r border-slate-100 bg-white flex flex-col overflow-hidden`}>
            <div className={`flex-1 overflow-y-auto p-5 custom-scrollbar ${viewMode === 'grid' ? 'hidden' : 'block'}`}>
              <div className="flex items-center justify-between mb-6">
                <span className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em]">Library</span>
                <label className="cursor-pointer text-[#355faa] hover:underline text-[10px] font-bold">
                  <FolderOpen size={14} className="inline mr-1" /> Add
                  <input type="file" multiple {...{ webkitdirectory: "", directory: "" } as any} onChange={handleImport} className="hidden" />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {photos.map(p => {
                  const settings = settingsMap[p.id] || DEFAULT_SETTINGS;
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => setCurrentPhotoId(p.id)} 
                      className={`aspect-square rounded-2xl overflow-hidden cursor-pointer border-2 transition-all relative group shadow-sm ${currentPhotoId === p.id ? 'border-[#355faa] ring-4 ring-blue-50' : 'border-transparent hover:border-slate-200'}`}
                    >
                      <ProcessedThumbnail photo={p} settings={settings} luts={luts} />
                      <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  );
                })}
              </div>
            </div>
            {viewMode === 'grid' && (
              <div className="flex-1 flex flex-col bg-slate-50">
                <div className="p-8 pb-4">
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-slate-300 border-dashed rounded-3xl cursor-pointer bg-white hover:bg-slate-50 hover:border-blue-400 transition-all group shadow-sm mb-6">
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                      <FolderOpen className="text-slate-400 group-hover:text-[#355faa] mb-2 transition-colors" size={32} />
                      <p className="text-xs font-bold text-slate-500">Drop your photo folder here</p>
                      <p className="text-[10px] text-slate-400 mt-1">Images will stay on your device</p>
                    </div>
                    <input type="file" multiple {...{ webkitdirectory: "", directory: "" } as any} onChange={handleImport} className="hidden" />
                  </label>
                </div>
                <PhotoGrid photos={photos} selectedIds={selectedIds} onSelect={(id, m) => setSelectedIds(s => { const n = new Set(m ? s : []); n.has(id) ? n.delete(id) : n.add(id); return n; })} currentPhotoId={currentPhotoId} onOpen={p => { setCurrentPhotoId(p.id); setViewMode('edit'); }} settingsMap={settingsMap} luts={luts} />
              </div>
            )}
        </div>

        {viewMode === 'edit' && currentPhotoId && (
          <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center p-8 checkerboard-bg" ref={containerRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
             <canvas ref={canvasRef} className="max-w-full max-h-full shadow-2xl object-contain" />
          </div>
        )}

        {viewMode === 'edit' && currentPhotoId && (
          <div className="flex flex-col h-full bg-white shadow-2xl z-40 border-l border-slate-100 w-80 shrink-0">
            <ControlPanel settings={currentSettings} updateSetting={(k, v) => updateSetting(k, v)} syncSettings={syncSettings} selectedCount={selectedIds.size} totalCount={photos.length} luts={luts} onImportLut={handleImportLut} activeMaskId={activeMaskId} setActiveMaskId={setActiveMaskId} />
          </div>
        )}
      </div>
    </div>
  );
}