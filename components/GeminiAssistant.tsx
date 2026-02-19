import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Sparkles, Loader2, AlertTriangle, Check } from 'lucide-react';
import { EditSettings } from '../types.ts';

interface GeminiAssistantProps {
  currentImageBase64: string | null;
  onApplySuggestion: (settings: Partial<EditSettings>) => void;
}

export const GeminiAssistant: React.FC<GeminiAssistantProps> = ({ 
  currentImageBase64,
  onApplySuggestion
}) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Partial<EditSettings> | null>(null);

  const analyzeImage = async () => {
    if (!currentImageBase64) return;
    
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setSuggestion(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Data = currentImageBase64.split(',')[1];

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Data
              }
            },
            {
              text: "Analyze this image for professional color grading. Provide a 2-sentence concise expert critique. Suggest numeric adjustments for: Exposure (-100 to 100), Contrast (-100 to 100), Temperature (-100 to 100), Saturation (-100 to 100). Format suggestions strictly as JSON at the end like: {\"exposure\": 10, \"contrast\": 20...}"
            }
          ]
        }
      });

      const text = response.text || "";
      setAnalysis(text);

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
            const suggestions = JSON.parse(jsonMatch[0]);
            const mapped: Partial<EditSettings> = {};
            if (typeof suggestions.exposure === 'number') mapped.exposure = suggestions.exposure;
            if (typeof suggestions.contrast === 'number') mapped.contrast = suggestions.contrast;
            if (typeof suggestions.saturation === 'number') mapped.saturation = suggestions.saturation;
            if (typeof (suggestions.temperature || suggestions.temp) === 'number') {
              mapped.temperature = suggestions.temperature || suggestions.temp;
            }
            setSuggestion(mapped);
        } catch (e) {
            console.error("Failed to parse AI suggestions", e);
        }
      }
    } catch (err: any) {
      setError(err.message || "AI Analysis unavailable.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (suggestion) {
      onApplySuggestion(suggestion);
      setSuggestion(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Sparkles className="text-purple-500" size={14} />
            AI Insight
        </h4>
        {!loading && (
            <button 
                onClick={analyzeImage}
                className="text-[10px] font-bold bg-[#355faa] text-white px-3 py-1.5 rounded-lg transition-all shadow-md shadow-blue-900/10 hover:opacity-90"
            >
                {analysis ? 'Retry' : 'Analyze'}
            </button>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-6 text-slate-400">
            <Loader2 className="animate-spin mb-3 text-[#355faa]" size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Consulting Gemini...</span>
        </div>
      )}

      {error && (
        <div className="text-[10px] font-medium text-red-500 bg-red-50 p-3 rounded-xl flex items-start gap-2 border border-red-100">
            <AlertTriangle size={14} className="shrink-0" />
            {error}
        </div>
      )}

      {analysis && (
        <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl text-[11px] leading-relaxed text-slate-600 font-medium border border-slate-100">
                {analysis.split('{')[0].trim()}
            </div>
            {suggestion && (
              <button 
                onClick={handleApply}
                className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-green-900/10"
              >
                <Check size={14} /> Apply AI Suggestion
              </button>
            )}
        </div>
      )}
    </div>
  );
};