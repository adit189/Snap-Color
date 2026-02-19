import React from 'react';
import { Photo, EditSettings, Lut, DEFAULT_SETTINGS } from '../types.ts';
import { Image as ImageIcon, CheckCircle, Circle, ZoomIn } from 'lucide-react';
import { ProcessedThumbnail } from './ProcessedThumbnail.tsx';

interface PhotoGridProps {
  photos: Photo[];
  selectedIds: Set<string>;
  onSelect: (id: string, multi: boolean) => void;
  currentPhotoId: string | null;
  onOpen: (photo: Photo) => void;
  settingsMap: Record<string, EditSettings>;
  luts: Lut[];
}

export const PhotoGrid: React.FC<PhotoGridProps> = ({ 
  photos, 
  selectedIds, 
  onSelect, 
  currentPhotoId,
  onOpen,
  settingsMap,
  luts
}) => {
  if (photos.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6">
            <ImageIcon className="w-10 h-10 opacity-30" />
        </div>
        <h3 className="text-slate-800 font-bold mb-1">Your library is empty</h3>
        <p className="text-xs max-w-[200px] leading-relaxed">Import a folder of photos to start professional color grading.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-6 p-8 overflow-y-auto h-full custom-scrollbar">
      {photos.map((photo) => {
        const isSelected = selectedIds.has(photo.id);
        const isCurrent = currentPhotoId === photo.id;
        // Use DEFAULT_SETTINGS to ensure all required properties (colorMixer, masks, etc.) are present
        const settings = settingsMap[photo.id] || DEFAULT_SETTINGS;

        return (
          <div 
            key={photo.id}
            className={`group relative aspect-square bg-white rounded-3xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 border-2 ${
              isCurrent ? 'border-[#355faa] ring-4 ring-blue-50 scale-95' : isSelected ? 'border-blue-400' : 'border-transparent'
            }`}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey) {
                onSelect(photo.id, true);
              } else {
                onOpen(photo);
              }
            }}
          >
            <div className="w-full h-full relative overflow-hidden">
                <ProcessedThumbnail 
                    photo={photo} 
                    settings={settings} 
                    luts={luts} 
                    className="transition-transform group-hover:scale-105 duration-500"
                />
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            
            <div 
              className="absolute top-4 right-4 z-20 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(photo.id, true);
              }}
            >
              {isSelected ? (
                <CheckCircle className="text-[#355faa] fill-white" size={24} />
              ) : (
                <Circle className="text-white/80 group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" size={24} />
              )}
            </div>

            <div className="absolute bottom-4 right-4 p-2 bg-white/90 backdrop-blur rounded-xl shadow-lg opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all">
                <ZoomIn size={14} className="text-slate-600" />
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-4 pt-10">
              <p className="text-[9px] font-bold text-white truncate uppercase tracking-widest">{photo.name}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};