import React, { useState } from 'react';
import { X, Download } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (packageName: string, customerName: string) => void;
  count: number;
}

export function ExportModal({ isOpen, onClose, onExport, count }: ExportModalProps) {
  const [packageName, setPackageName] = useState('Self Photo');
  const [customerName, setCustomerName] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-800">Export {count} Photo{count !== 1 ? 's' : ''}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Package Type</label>
            <select 
              value={packageName} 
              onChange={(e) => setPackageName(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#355faa] focus:border-transparent appearance-none"
            >
              <option value="Self Photo">Self Photo</option>
              <option value="Photobox">Photobox</option>
              <option value="Pass Photo">Pass Photo</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Customer Name</label>
            <input 
              type="text" 
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#355faa] focus:border-transparent"
              autoFocus
            />
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <p className="text-xs text-blue-600 font-medium mb-1">Preview Filename:</p>
            <p className="text-sm font-mono text-blue-800 break-all">
              Snap Fun_{packageName}_{customerName || '[Name]'}.jpg
            </p>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onExport(packageName, customerName)}
            disabled={!customerName.trim()}
            className="px-4 py-2 bg-[#355faa] text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-900/20 hover:bg-[#2d4d8a] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <Download size={16} />
            Export Now
          </button>
        </div>
      </div>
    </div>
  );
}
