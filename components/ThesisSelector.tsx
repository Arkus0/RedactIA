import React from 'react';
import { Thesis } from '../types';
import { Target, ArrowRight, Sparkles, BrainCircuit } from 'lucide-react';

interface ThesisSelectorProps {
  isOpen: boolean;
  theses: Thesis[];
  onSelect: (thesis: Thesis) => void;
  onCancel: () => void;
  isGenerating: boolean;
}

export const ThesisSelector: React.FC<ThesisSelectorProps> = ({ 
  isOpen, theses, onSelect, onCancel, isGenerating 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header con gradiente */}
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Target className="w-6 h-6 text-primary-600" />
            Elige la Estrategia (El Arquitecto)
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            Antes de escribir, define el ángulo. Una tesis sólida es la diferencia entre un texto genérico y uno brillante.
          </p>
        </div>
        
        <div className="p-6 space-y-4 overflow-y-auto bg-gray-50/50 min-h-[300px]">
          {isGenerating ? (
             <div className="flex flex-col items-center justify-center h-full py-10 gap-6 text-gray-400">
               <div className="relative">
                 <BrainCircuit className="w-12 h-12 text-primary-400 animate-pulse" />
                 <Sparkles className="w-6 h-6 text-yellow-400 absolute -top-2 -right-2 animate-bounce" />
               </div>
               <div className="text-center">
                 <p className="font-medium text-gray-600">Analizando fuentes y conectando ideas...</p>
                 <p className="text-xs mt-1">El Estratega está diseñando 3 enfoques únicos.</p>
               </div>
             </div>
          ) : (
            theses.map((thesis) => (
              <button
                key={thesis.id}
                onClick={() => onSelect(thesis)}
                className="w-full text-left p-5 bg-white border border-gray-200 rounded-xl hover:border-primary-500 hover:ring-1 hover:ring-primary-500 hover:shadow-lg transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-5 h-5 text-primary-500" />
                </div>
                
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide border ${
                    thesis.angle === 'Analítico' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                    thesis.angle === 'Crítico' ? 'bg-red-50 text-red-700 border-red-100' :
                    thesis.angle === 'Comparativo' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                    'bg-emerald-50 text-emerald-700 border-emerald-100'
                  }`}>
                    {thesis.angle}
                  </span>
                </div>
                <h3 className="font-bold text-gray-800 mb-2 text-lg group-hover:text-primary-700 transition-colors">{thesis.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{thesis.description}</p>
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center">
          <span className="text-xs text-gray-400 italic">
            *Seleccionar una tesis optimiza la coherencia del texto en un 40%.
          </span>
          <button 
            onClick={onCancel}
            disabled={isGenerating}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors font-medium disabled:opacity-50"
          >
            Saltar estrategia (Escribir directo)
          </button>
        </div>
      </div>
    </div>
  );
};