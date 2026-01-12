import React from 'react';
import { Tone, Length, Format, StructureType, RedactionOptions, ModelId } from '../types';
import { Settings2, PenTool, LayoutTemplate, GraduationCap, UserPen, Microscope, AlignJustify, Cpu } from 'lucide-react';

interface SettingsBarProps {
  options: RedactionOptions;
  setOptions: React.Dispatch<React.SetStateAction<RedactionOptions>>;
  onOpenStyleModal: () => void;
  disabled: boolean;
}

export const SettingsBar: React.FC<SettingsBarProps> = ({ options, setOptions, onOpenStyleModal, disabled }) => {
  const handleChange = (key: keyof RedactionOptions, val: any) => setOptions(p => ({...p, [key]: val}));

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-4 justify-between xl:items-center">
        
        <div className="flex items-center gap-2 text-gray-800 font-bold shrink-0">
          <GraduationCap className="w-6 h-6 text-primary-600" />
          <span>Configuración</span>
        </div>

        <div className="flex flex-wrap gap-2 items-center flex-1 xl:justify-end">
          
          {/* Model Selector (New) */}
          <div className="relative min-w-[160px] w-full sm:w-auto">
             <Cpu className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
             <select
               disabled={disabled}
               value={options.model}
               onChange={(e) => handleChange('model', e.target.value)}
               className="w-full pl-9 pr-8 py-2 text-xs font-medium border border-blue-200 rounded-lg bg-blue-50 text-blue-800 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
             >
               <option value={ModelId.GEMINI_3_FLASH}>⚡ Gemini 3 Flash (Rápido)</option>
               <option value={ModelId.GEMINI_3_PRO}>🧠 Gemini 3 Pro (Razonamiento)</option>
               <option value={ModelId.GEMINI_2_FLASH}>⚖️ Gemini 2.0 Flash</option>
             </select>
          </div>

          <div className="w-px h-6 bg-gray-300 mx-1 hidden xl:block"></div>

          {/* Format */}
          <div className="relative min-w-[140px] w-full sm:w-auto">
             <LayoutTemplate className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
             <select 
                disabled={disabled}
                value={options.format}
                onChange={(e) => handleChange('format', e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-gray-50 appearance-none"
             >
                {Object.values(Format).map(o => <option key={o} value={o}>{o}</option>)}
             </select>
          </div>

          {/* Tone */}
          <div className="relative min-w-[140px] w-full sm:w-auto">
             <PenTool className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
             <select 
                disabled={disabled}
                value={options.tone}
                onChange={(e) => handleChange('tone', e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs border border-gray-300 rounded-lg bg-gray-50 appearance-none"
             >
                {Object.values(Tone).map(o => <option key={o} value={o}>{o}</option>)}
             </select>
          </div>

          {/* Length */}
          <div className="relative min-w-[140px] w-full sm:w-auto">
             <AlignJustify className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
             <select 
                disabled={disabled}
                value={options.length}
                onChange={(e) => handleChange('length', e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs border border-gray-300 rounded-lg bg-gray-50 appearance-none"
             >
                {Object.values(Length).map(o => <option key={o} value={o}>{o}</option>)}
             </select>
          </div>

          {/* Structure Selector */}
          <div className="relative min-w-[140px] w-full sm:w-auto">
             <div className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none font-mono font-bold">≡</div>
             <select
               disabled={disabled}
               value={options.structure}
               onChange={(e) => handleChange('structure', e.target.value)}
               className="w-full pl-9 pr-8 py-2 text-xs border border-gray-300 rounded-lg bg-gray-50 appearance-none"
             >
               {Object.values(StructureType).map(s => <option key={s} value={s}>{s}</option>)}
             </select>
          </div>

          <div className="w-px h-6 bg-gray-300 mx-1 hidden xl:block"></div>

          {/* Tutor Virtual */}
          <button
            disabled={disabled}
            onClick={() => handleChange('criticMode', !options.criticMode)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all whitespace-nowrap ${
              options.criticMode ? 'bg-orange-50 border-orange-300 text-orange-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
            title="Activa el Tutor Virtual que corrige y genera un informe final"
          >
            <Microscope className="w-3.5 h-3.5" /> Tutor
          </button>

          {/* Estilo Personal */}
          <div className="flex gap-0 rounded-lg shadow-sm">
            <button
              disabled={disabled}
              onClick={() => handleChange('personalStyleMode', !options.personalStyleMode)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-l-lg border transition-all whitespace-nowrap ${
                options.personalStyleMode ? 'bg-purple-50 border-purple-300 text-purple-700 border-r-0' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 border-r-0'
              }`}
            >
              <UserPen className="w-3.5 h-3.5" /> Estilo
            </button>
            <button 
                onClick={onOpenStyleModal} 
                disabled={disabled}
                className={`px-2 border border-l-0 rounded-r-lg transition-colors ${
                    options.personalStyleMode 
                        ? 'bg-purple-50 border-purple-300 text-purple-600 hover:bg-purple-100' 
                        : 'bg-white border-gray-300 text-gray-400 hover:text-purple-600 hover:bg-gray-50'
                }`}
                title="Configurar Bóveda de Estilo"
            >
                 ⚙️
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};