import React from 'react';
import { Tone, Length, Format, RedactionOptions } from '../types';
import { Settings2, PenTool, AlignLeft, LayoutTemplate } from 'lucide-react';

interface SettingsBarProps {
  options: RedactionOptions;
  setOptions: React.Dispatch<React.SetStateAction<RedactionOptions>>;
  disabled: boolean;
}

export const SettingsBar: React.FC<SettingsBarProps> = ({ options, setOptions, disabled }) => {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 sm:px-6 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
        
        <div className="flex items-center gap-2 text-gray-700 font-medium">
          <Settings2 className="w-5 h-5 text-primary-600" />
          <span>Configuración</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 max-w-3xl">
          {/* Format Selection */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <LayoutTemplate className="h-4 w-4 text-gray-400" />
            </div>
            <select
              disabled={disabled}
              value={options.format}
              onChange={(e) => setOptions(prev => ({ ...prev, format: e.target.value as Format }))}
              className="block w-full pl-10 pr-3 py-2 text-sm border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg border bg-gray-50 hover:bg-white transition-colors cursor-pointer disabled:opacity-60"
            >
              {Object.values(Format).map((format) => (
                <option key={format} value={format}>{format}</option>
              ))}
            </select>
          </div>

          {/* Tone Selection */}
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <PenTool className="h-4 w-4 text-gray-400" />
            </div>
            <select
              disabled={disabled}
              value={options.tone}
              onChange={(e) => setOptions(prev => ({ ...prev, tone: e.target.value as Tone }))}
              className="block w-full pl-10 pr-3 py-2 text-sm border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg border bg-gray-50 hover:bg-white transition-colors cursor-pointer disabled:opacity-60"
            >
              {Object.values(Tone).map((tone) => (
                <option key={tone} value={tone}>{tone}</option>
              ))}
            </select>
          </div>

          {/* Length Selection */}
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <AlignLeft className="h-4 w-4 text-gray-400" />
            </div>
            <select
              disabled={disabled}
              value={options.length}
              onChange={(e) => setOptions(prev => ({ ...prev, length: e.target.value as Length }))}
              className="block w-full pl-10 pr-3 py-2 text-sm border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-lg border bg-gray-50 hover:bg-white transition-colors cursor-pointer disabled:opacity-60"
            >
              {Object.values(Length).map((length) => (
                <option key={length} value={length}>{length}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};