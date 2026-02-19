import React, { useEffect, useRef } from 'react';
import { Photo, EditSettings, Lut, DEFAULT_SETTINGS } from '../types.ts';
import { processImage } from '../utils/imageProcessing.ts';

interface ProcessedThumbnailProps {
  photo: Photo;
  settings: EditSettings;
  luts: Lut[];
  className?: string;
}

export const ProcessedThumbnail: React.FC<ProcessedThumbnailProps> = ({ 
  photo, 
  settings, 
  luts,
  className 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = photo.previewUrl;
    img.onload = () => {
      imageRef.current = img;
      renderThumbnail();
    };
  }, [photo.previewUrl]);

  useEffect(() => {
    renderThumbnail();
  }, [settings, luts]);

  const renderThumbnail = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Use a small fixed size for thumbnails to save performance
    const size = 160; 
    canvas.width = size;
    canvas.height = size;

    // Draw original scaled to fit (cover style)
    const scale = Math.max(size / img.width, size / img.height);
    const x = (size - img.width * scale) / 2;
    const y = (size - img.height * scale) / 2;
    
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

    const activeLut = settings.lutId ? luts.find(l => l.id === settings.lutId) || null : null;
    const imageData = ctx.getImageData(0, 0, size, size);
    const processed = processImage(imageData, settings, activeLut);
    ctx.putImageData(processed, 0, 0);
  };

  return (
    <canvas 
      ref={canvasRef} 
      className={`w-full h-full object-cover ${className}`}
    />
  );
};