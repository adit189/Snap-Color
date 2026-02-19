import React, { useState } from 'react';
import { EditSettings, Lut, ColorMixerChannel, Mask, DEFAULT_LOCAL_SETTINGS } from '../types.ts';
import { Sun, Contrast, Cloud, CloudRain, Zap, Palette, Upload, Sliders, Target, Droplet, Scissors, Info, Thermometer, BoxSelect, FlipHorizontal, Layers, Plus, Trash2, Eye, EyeOff, Circle, Pipette, Sparkles, MoveDiagonal, RotateCw, Move } from 'lucide-react';

interface ControlPanelProps {
  settings: EditSettings;
  updateSetting: (key: keyof EditSettings, value: any) => void;
  syncSettings: (all: boolean) => void;
  selectedCount: number;
  totalCount: number;
  luts: Lut[];
  onImportLut: (e: React.ChangeEvent<HTMLInputElement>) => void;
  activeMaskId: string | null;
  setActiveMaskId: (id: string | null) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  settings, 
  updateSetting, 
  syncSettings,
  selectedCount,
  totalCount,
  luts,
  onImportLut,
  activeMaskId,
  setActiveMaskId
}) => {
  const [activeMixerTab, setActiveMixerTab] = useState<keyof EditSettings['colorMixer']>('red');

  const activeMaskIndex = activeMaskId ? settings.masks.findIndex(m => m.id === activeMaskId) : -1;
  const activeMask = activeMaskIndex >= 0 ? settings.masks[activeMaskIndex] : null;

  const handleWheel = (e: React.WheelEvent, value: number, onChange: (v: number) => void, min: number, max: number, step: number = 1) => {
    e.stopPropagation();
    e.preventDefault();
    const delta = e.deltaY > 0 ? -step : step;
    const newValue = Math.min(max, Math.max(min, value + delta));
    onChange(newValue);
  };

  const addMask = (type: Mask['type']) => {
      const newMask: Mask = {
          id: Math.random().toString(36).substr(2, 9),
          name: type === 'color' ? 'Color' : 'Linear',
          type,
          settings: { ...DEFAULT_LOCAL_SETTINGS },
          x: 0.5, y: 0.5, radius: 0.5, feather: 20, rotation: 0,
          colorRange: 0.1,
          targetColor: type === 'color' ? { h: 0, s: 0, l: 0.5 } : null,
          invert: false,
          opacity: 100
      };
      updateSetting('masks', [...settings.masks, newMask]);
      setActiveMaskId(newMask.id);
  };

  const updateMask = (changes: Partial<Mask>) => {
      if (!activeMaskId) return;
      const newMasks = [...settings.masks];
      const idx = newMasks.findIndex(m => m.id === activeMaskId);
      if (idx >= 0) {
          newMasks[idx] = { ...newMasks[idx], ...changes };
          updateSetting('masks', newMasks);
      }
  };

  const updateMaskSetting = (key: keyof import('../types.ts').LocalSettings, value: number) => {
      if (!activeMaskId) return;
      const newMasks = [...settings.masks];
      const idx = newMasks.findIndex(m => m.id === activeMaskId);
      if (idx >= 0) {
          newMasks[idx] = { 
              ...newMasks[idx], 
              settings: { ...newMasks[idx].settings, [key]: value } 
          };
          updateSetting('masks', newMasks);
      }
  };

  const deleteMask = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newMasks = settings.masks.filter(m => m.id !== id);
      updateSetting('masks', newMasks);
      if (activeMaskId === id) setActiveMaskId(null);
  };

  const Slider = ({ label, icon: Icon, value, onChange, min = -100, max = 100, step = 1, gradient = '' }: { label: string, icon: any, value: number, onChange: (v: number) => void, min?: number, max?: number, step?: number, gradient?: string }) => (
    <div className="mb-5 group" onWheel={(e) => handleWheel(e, value, onChange, min, max, step)}>
      <div className="flex justify-between items-center mb-2 text-[10px] uppercase tracking-wider text-slate-400 font-bold group-hover:text-slate-600 transition-colors">
        <div className="flex items-center gap-2">
          <Icon size={12} className="text-slate-300 group-hover:text-[#355faa] transition-colors" />
          {label}
        </div>
        <div className="flex items-center gap-2 font-mono">
           <button onClick={() => onChange(0)} className="opacity-0 group-hover:opacity-100 text-[9px] text-[#355faa] hover:underline transition-opacity">Reset</button>
           <span className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded min-w-[24px] text-center">{Math.round(value)}</span>
        </div>
      </div>
      <div className="relative flex items-center h-4">
        {gradient ? (
          <div className="absolute inset-x-0 h-1 rounded-full z-0 opacity-40" style={{ background: gradient }}></div>
        ) : (
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 pointer-events-none z-0"></div>
        )}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer range-slider focus:outline-none z-10"
        />
      </div>
    </div>
  );

  const MixerSlider = ({ channel, type }: { channel: keyof EditSettings['colorMixer'], type: keyof ColorMixerChannel }) => {
    const channelData = settings.colorMixer[channel];
    const val = channelData[type];
    
    return (
      <Slider 
        label={type} 
        icon={type === 'hue' ? Palette : type === 'saturation' ? Droplet : Sun} 
        value={val} 
        onChange={(v) => {
            updateSetting('colorMixer', {
                ...settings.colorMixer,
                [channel]: { ...channelData, [type]: v }
            });
        }} 
      />
    );
  };

  const renderAdjustmentSliders = (
      values: import('../types.ts').LocalSettings, 
      updater: (k: keyof import('../types.ts').LocalSettings, v: number) => void
  ) => (
      <>
        <div className="mb-6">
            <Slider label="Exposure" icon={Sun} value={values.exposure} onChange={(v) => updater('exposure', v)} />
            <Slider label="Contrast" icon={Contrast} value={values.contrast} onChange={(v) => updater('contrast', v)} />
            <Slider label="Highlights" icon={Cloud} value={values.highlights} onChange={(v) => updater('highlights', v)} />
            <Slider label="Shadows" icon={CloudRain} value={values.shadows} onChange={(v) => updater('shadows', v)} />
        </div>
        <div className="mb-6">
            <Slider 
                label="Temp" 
                icon={Sun} 
                value={values.temperature} 
                onChange={(v) => updater('temperature', v)} 
                gradient="linear-gradient(to right, #3b82f6, #ffffff, #eab308)"
            />
            <Slider 
                label="Tint" 
                icon={Droplet} 
                value={values.tint} 
                onChange={(v) => updater('tint', v)} 
                gradient="linear-gradient(to right, #22c55e, #ffffff, #d946ef)"
            />
        </div>
        <div>
            <Slider label="Saturation" icon={Droplet} value={values.saturation} onChange={(v) => updater('saturation', v)} />
            <Slider label="Texture" icon={Scissors} value={values.texture} onChange={(v) => updater('texture', v)} />
            <Slider label="Clarity" icon={Target} value={values.clarity} onChange={(v) => updater('clarity', v)} />
        </div>
      </>
  );

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Top Tabs */}
      <div className="flex border-b border-slate-100">
          <button 
             onClick={() => setActiveMaskId(null)}
             className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${!activeMaskId ? 'text-[#355faa] border-b-2 border-[#355faa] bg-blue-50/50' : 'text-slate-400 hover:text-slate-600'}`}
          >
              Global
          </button>
          <button 
             className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeMaskId ? 'text-[#355faa] border-b-2 border-[#355faa] bg-blue-50/50' : 'text-slate-400 hover:text-slate-600'}`}
          >
             <Layers size={14} /> Masking
          </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
      
        {/* Masking Controls */}
        <section className="mb-8 border-b border-slate-100 pb-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Masks</h3>
                <div className="flex gap-1">
                    <button onClick={() => addMask('linear')} title="Linear Gradient" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-[#355faa] transition-colors"><MoveDiagonal size={14} /></button>
                    <button onClick={() => addMask('color')} title="Color Mask" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-[#355faa] transition-colors"><Pipette size={14} /></button>
                </div>
            </div>
            
            <div className="space-y-2 mb-4">
                {settings.masks.map(mask => (
                    <div 
                        key={mask.id}
                        onClick={() => setActiveMaskId(mask.id)}
                        className={`group flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${activeMaskId === mask.id ? 'bg-[#355faa] border-[#355faa] text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200'}`}
                    >
                        <div className="flex items-center gap-3">
                            {mask.type === 'color' ? <Pipette size={14} /> : <MoveDiagonal size={14} />}
                            <span className="text-xs font-bold">{mask.name}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); updateMask({ invert: !mask.invert }); }} className={`p-1.5 rounded hover:bg-white/20 ${mask.invert ? 'bg-white/20' : ''}`} title="Invert"><Contrast size={12} /></button>
                            <button onClick={(e) => deleteMask(mask.id, e)} className="p-1.5 rounded hover:bg-red-500/20 hover:text-red-100"><Trash2 size={12} /></button>
                        </div>
                    </div>
                ))}
                {settings.masks.length === 0 && (
                    <div className="text-center p-4 border-2 border-dashed border-slate-100 rounded-xl text-slate-400 text-[10px]">
                        No masks active. Add one to start local editing.
                    </div>
                )}
            </div>
        </section>

        {activeMaskId && activeMask ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Mask Properties</h4>
                    <Slider label="Opacity" icon={Eye} value={activeMask.opacity} onChange={(v) => updateMask({ opacity: v })} min={0} max={100} />
                    
                    {activeMask.type === 'linear' && (
                        <>
                             <Slider label="Feather" icon={Cloud} value={activeMask.feather} onChange={(v) => updateMask({ feather: v })} min={0} max={100} />
                             <Slider label="Rotation" icon={RotateCw} value={activeMask.rotation || 0} onChange={(v) => updateMask({ rotation: v })} min={0} max={360} />
                             <Slider label="Position X" icon={Move} value={activeMask.x * 100} onChange={(v) => updateMask({ x: v / 100 })} min={0} max={100} />
                             <Slider label="Position Y" icon={Move} value={activeMask.y * 100} onChange={(v) => updateMask({ y: v / 100 })} min={0} max={100} />
                        </>
                    )}

                    {activeMask.type === 'color' && (
                        <>
                            <Slider label="Range" icon={Target} value={activeMask.colorRange * 100} onChange={(v) => updateMask({ colorRange: v / 100 })} min={1} max={50} />
                            <div className="flex gap-2 items-center text-[10px] text-slate-500 mb-2">
                                <span className="font-bold">Target Hue:</span>
                                <input 
                                    type="range" min="0" max="1" step="0.01" 
                                    value={activeMask.targetColor?.h || 0}
                                    onChange={(e) => updateMask({ targetColor: { ...activeMask.targetColor!, h: parseFloat(e.target.value) } })}
                                    className="flex-1 h-2 bg-gradient-to-r from-red-500 via-green-500 to-blue-500 rounded-full appearance-none"
                                />
                            </div>
                        </>
                    )}
                </div>
                
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Local Adjustments</h4>
                {renderAdjustmentSliders(activeMask.settings, updateMaskSetting)}
            </div>
        ) : (
            <>
                {/* Profiles at TOP */}
                <section className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                            <Palette size={14} className="text-[#355faa]" /> Profiles
                        </h3>
                        <label className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-lg cursor-pointer flex items-center gap-1 border border-slate-200 transition-colors font-bold">
                            <Upload size={10} /> .cube
                            <input type="file" accept=".cube" multiple onChange={onImportLut} className="hidden" />
                        </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <button onClick={() => updateSetting('lutId', null)} className={`text-[10px] px-3 py-2 rounded-xl border transition-all font-bold ${!settings.lutId ? 'border-[#355faa] bg-[#355faa] text-white shadow-md' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}>Standard</button>
                        {luts.map(lut => (
                            <button key={lut.id} onClick={() => updateSetting('lutId', lut.id)} className={`text-[10px] px-3 py-2 rounded-xl border transition-all font-bold truncate ${settings.lutId === lut.id ? 'border-[#355faa] bg-[#355faa] text-white shadow-md' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}>
                                {lut.name}
                            </button>
                        ))}
                    </div>
                    {settings.lutId && (
                        <Slider label="Intensity" icon={Sliders} value={settings.lutIntensity} onChange={(v) => updateSetting('lutIntensity', v)} min={0} max={100} />
                    )}
                </section>

                <div className="grid grid-cols-2 gap-3 mb-8">
                    <button onClick={() => syncSettings(false)} disabled={selectedCount < 2} className="flex items-center justify-center py-2.5 bg-white hover:bg-slate-50 disabled:opacity-30 text-slate-600 text-[10px] rounded-xl border border-slate-200 font-bold uppercase tracking-widest transition-all shadow-sm">
                    Selected ({selectedCount})
                    </button>
                    <button onClick={() => syncSettings(true)} className="flex items-center justify-center py-2.5 bg-[#355faa] hover:opacity-90 text-white text-[10px] rounded-xl font-bold shadow-lg shadow-blue-900/10 uppercase tracking-widest transition-all">
                    Sync All ({totalCount})
                    </button>
                </div>

                <section className="mb-8">
                    <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Zap size={14} className="text-[#355faa]" /> Global Tone
                    </h3>
                    <Slider label="Exposure" icon={Sun} value={settings.exposure} onChange={(v) => updateSetting('exposure', v)} />
                    <Slider label="Contrast" icon={Contrast} value={settings.contrast} onChange={(v) => updateSetting('contrast', v)} />
                    <Slider label="Highlights" icon={Cloud} value={settings.highlights} onChange={(v) => updateSetting('highlights', v)} />
                    <Slider label="Shadows" icon={CloudRain} value={settings.shadows} onChange={(v) => updateSetting('shadows', v)} />
                </section>

                <section className="mb-8">
                    <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Thermometer size={14} className="text-[#fbdc00]" /> White Balance
                    </h3>
                    <Slider 
                        label="Temp" 
                        icon={Sun} 
                        value={settings.temperature} 
                        onChange={(v) => updateSetting('temperature', v)} 
                        gradient="linear-gradient(to right, #3b82f6, #ffffff, #eab308)"
                    />
                    <Slider 
                        label="Tint" 
                        icon={Droplet} 
                        value={settings.tint} 
                        onChange={(v) => updateSetting('tint', v)} 
                        gradient="linear-gradient(to right, #22c55e, #ffffff, #d946ef)"
                    />
                </section>

                <section className="mb-8">
                    <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <Target size={14} className="text-[#d6314a]" /> Presence
                    </h3>
                    <Slider label="Texture" icon={Scissors} value={settings.texture} onChange={(v) => updateSetting('texture', v)} />
                    <Slider label="Clarity" icon={Target} value={settings.clarity} onChange={(v) => updateSetting('clarity', v)} />
                    <Slider label="Saturation" icon={Droplet} value={settings.saturation} onChange={(v) => updateSetting('saturation', v)} />
                </section>

                <section className="mb-8">
                    <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <Palette size={14} className="text-[#fbdc00]" /> Color Mixer
                    </h3>
                    
                    <div className="flex bg-slate-100 rounded-xl p-1 mb-4">
                        {(['red', 'orange', 'yellow', 'aqua', 'blue', 'magenta'] as const).map(color => (
                            <button 
                                key={color}
                                onClick={() => setActiveMixerTab(color)}
                                className={`flex-1 h-6 rounded-lg transition-all ${activeMixerTab === color ? 'shadow bg-white scale-105' : 'hover:bg-white/50'}`}
                            >
                                <div className="w-3 h-3 rounded-full mx-auto" style={{ 
                                    backgroundColor: color === 'aqua' ? '#00ffff' : color 
                                }} />
                            </button>
                        ))}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 text-center">{activeMixerTab}</div>
                        <MixerSlider channel={activeMixerTab} type="hue" />
                        <MixerSlider channel={activeMixerTab} type="saturation" />
                        <MixerSlider channel={activeMixerTab} type="luminance" />
                    </div>
                </section>
            </>
        )}
      </div>
    </div>
  );
};