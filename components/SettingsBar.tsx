import React from 'react';
import { Tone, Length, Format, RedactionOptions } from '../types';
import { Settings2, PenTool, AlignLeft, LayoutTemplate, Link2, Wand2, UserPen, Microscope } from 'lucide-react';

interface SettingsBarProps {
  options: RedactionOptions;
  setOptions: React.Dispatch<React.SetStateAction<RedactionOptions>>;
  disabled: boolean;
  onOpenStyleModal: () => void;
}

export const SettingsBar: React.FC<SettingsBarProps> = ({ options, setOptions, disabled, onOpenStyleModal }) => {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 sm:px-6 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-4 xl:items-center justify-between">
        
        <div className="flex items-center gap-2 text-gray-700 font-medium shrink-0">
          <Settings2 className="w-5 h-5 text-primary-600" />
          <span>Configuración</span>
        </div>

        <div className="flex flex-wrap gap-3 flex-1 xl:justify-end items-center">
          {/* Format Selection */}
          <div className="relative group w-full sm:w-auto min-w-[140px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LayoutTemplate className="h-4 w-4 text-gray-400" />
            </div>
            <select
              disabled={disabled}
              value={options.format}
              onChange={(e) => setOptions(prev => ({ ...prev, format: e.target.value as Format }))}
              className="block w-full pl-9 pr-8 py-2 text-sm border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg border bg-gray-50 hover:bg-white transition-colors cursor-pointer disabled:opacity-60 appearance-none"
            >
              {Object.values(Format).map((format) => (
                <option key={format} value={format}>{format}</option>
              ))}
            </select>
          </div>

          {/* Tone Selection */}
          <div className="relative w-full sm:w-auto min-w-[140px]">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <PenTool className="h-4 w-4 text-gray-400" />
            </div>
            <select
              disabled={disabled}
              value={options.tone}
              onChange={(e) => setOptions(prev => ({ ...prev, tone: e.target.value as Tone }))}
              className="block w-full pl-9 pr-8 py-2 text-sm border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg border bg-gray-50 hover:bg-white transition-colors cursor-pointer disabled:opacity-60 appearance-none"
            >
              {Object.values(Tone).map((tone) => (
                <option key={tone} value={tone}>{tone}</option>
              ))}
            </select>
          </div>

          {/* Length Selection */}
          <div className="relative w-full sm:w-auto min-w-[140px]">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <AlignLeft className="h-4 w-4 text-gray-400" />
            </div>
            <select
              disabled={disabled}
              value={options.length}
              onChange={(e) => setOptions(prev => ({ ...prev, length: e.target.value as Length }))}
              className="block w-full pl-9 pr-8 py-2 text-sm border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg border bg-gray-50 hover:bg-white transition-colors cursor-pointer disabled:opacity-60 appearance-none"
            >
              {Object.values(Length).map((length) => (
                <option key={length} value={length}>{length}</option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-gray-300 hidden sm:block mx-1"></div>

          {/* Buttons Group */}
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto sm:overflow-visible pb-1 sm:pb-0">
            {/* Cross References */}
            <button
                disabled={disabled}
                onClick={() => setOptions(prev => ({ ...prev, includeCrossReferences: !prev.includeCrossReferences }))}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-all whitespace-nowrap ${
                options.includeCrossReferences 
                    ? 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm' 
                    : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-white'
                } disabled:opacity-60`}
                title="Generar referencias internas entre secciones"
            >
                <Link2 className="w-3.5 h-3.5" />
                Citas
            </button>

             {/* Critic Mode (New) */}
             <button
                disabled={disabled}
                onClick={() => setOptions(prev => ({ ...prev, criticMode: !prev.criticMode }))}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-all whitespace-nowrap ${
                options.criticMode 
                    ? 'bg-orange-50 border-orange-300 text-orange-700 shadow-sm ring-1 ring-orange-200' 
                    : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-white'
                } disabled:opacity-60`}
                title="El Crítico: Realiza una segunda pasada para corregir lógica y argumentos"
            >
                <Microscope className="w-3.5 h-3.5" />
                Crítico
            </button>

            {/* Humanize Group */}
            <div className="flex items-center gap-0 bg-gray-50 p-0.5 rounded-lg border border-gray-300 whitespace-nowrap">
                <button
                disabled={disabled}
                onClick={() => setOptions(prev => ({ ...prev, humanizeMode: !prev.humanizeMode }))}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    options.humanizeMode 
                    ? 'bg-purple-100 text-purple-800 shadow-sm' 
                    : 'text-gray-600 hover:bg-gray-200'
                } disabled:opacity-60`}
                title="Modo Anti-IA: Reescribe el texto para evitar detección"
                >
                <Wand2 className="w-3.5 h-3.5" />
                Humanizar
                </button>
                
                {options.humanizeMode && (
                <button
                    disabled={disabled}
                    onClick={onOpenStyleModal}
                    className={`p-1.5 rounded-md transition-colors ${
                        options.userStyle || options.styleGuide
                        ? 'bg-purple-600 text-white shadow-sm' 
                        : 'text-gray-500 hover:bg-gray-200 hover:text-purple-600'
                    }`}
                    title="Configurar mi estilo de escritura (Clonación)"
                >
                    <UserPen className="w-3.5 h-3.5" />
                </button>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};