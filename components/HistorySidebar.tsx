import React from 'react';
import { HistoryItem } from '../types';
import { Clock, FileText, Trash2, X } from 'lucide-react';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({ 
  isOpen, 
  onClose, 
  history, 
  onSelect,
  onDelete
}) => {
  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity" 
          onClick={onClose}
        />
      )}
      
      {/* Sidebar Panel */}
      <div className={`fixed inset-y-0 left-0 w-80 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-600" />
            Historial
          </h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto h-[calc(100vh-64px)] p-4 space-y-3">
          {history.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              <p>No hay redacciones guardadas.</p>
            </div>
          ) : (
            history.map((item) => (
              <div 
                key={item.id}
                onClick={() => onSelect(item)}
                className="group relative border border-gray-200 rounded-xl p-3 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer bg-white"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">
                    {item.options.format}
                  </span>
                  <button 
                    onClick={(e) => onDelete(item.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-red-400 hover:text-red-600 rounded transition-all"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 mb-2 font-medium">
                  {item.userInstruction || "Sin título"}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <FileText className="w-3 h-3" />
                  <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};