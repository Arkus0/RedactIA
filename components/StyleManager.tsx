import React, { useState, useRef } from 'react';
import { StyleSample } from '../types';
import { generateStyleGuide } from '../services/geminiService';
import { extractTextFromPdf } from '../services/pdfService';
import { Sparkles, Trash2, Plus, Save, X, Fingerprint, RefreshCw, Upload, FileText, MessageSquare, AlertCircle } from 'lucide-react';

interface StyleManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveStyle: (styleGuide: string) => void;
  currentGuide?: string;
}

export const StyleManager: React.FC<StyleManagerProps> = ({ isOpen, onClose, onSaveStyle, currentGuide }) => {
  const [samples, setSamples] = useState<StyleSample[]>([]);
  const [newSampleText, setNewSampleText] = useState('');
  const [generatedGuide, setGeneratedGuide] = useState(currentGuide || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddSample = () => {
    if (!newSampleText.trim()) return;
    setSamples(prev => [...prev, {
      id: Date.now().toString(),
      content: newSampleText,
      type: 'other'
    }]);
    setNewSampleText('');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Solo se permiten archivos PDF.');
      return;
    }

    try {
        const text = await extractTextFromPdf(file);
        
        if (text.length < 100) {
            alert("El PDF parece contener muy poco texto extraíble. Asegúrate de que no sea una imagen escaneada.");
        }

        setSamples(prev => [...prev, {
            id: Date.now().toString(),
            content: text,
            type: 'essay'
        }]);
    } catch (e) {
        console.error(e);
        alert("Error al leer el archivo PDF.");
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (samples.length === 0 && !newSampleText.trim()) {
      alert("Añade al menos una muestra de texto para analizar.");
      return;
    }
    
    const activeSamples = [...samples];
    if (newSampleText.trim()) {
        activeSamples.push({ id: 'temp', content: newSampleText, type: 'other' });
    }

    setIsAnalyzing(true);
    try {
      const texts = activeSamples.map(s => s.content);
      const soul = await generateStyleGuide(texts);
      setGeneratedGuide(soul);
      
      if (newSampleText.trim()) setNewSampleText('');
      if (newSampleText.trim()) {
          setSamples(activeSamples.filter(s => s.id !== 'temp').concat([{
              id: Date.now().toString(),
              content: newSampleText,
              type: 'other'
          }]));
      }

    } catch (e) {
      alert("Error al analizar el estilo. Inténtalo de nuevo.");
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Fingerprint className="w-6 h-6 text-purple-600" />
              Bóveda de Estilo
            </h2>
            <p className="text-sm text-gray-500">Analiza tus textos para crear un "ADN Digital" que imite tu forma de escribir.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Columna Izquierda: Muestras */}
          <div className="w-full lg:w-5/12 p-5 border-r border-gray-100 overflow-y-auto bg-gray-50/50 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">1. Tus Muestras ({samples.length})</h3>
              <button 
                onClick={() => setSamples([])} 
                className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
                disabled={samples.length === 0}
              >
                <Trash2 className="w-3 h-3" /> Limpiar todo
              </button>
            </div>
            
            <div className="space-y-3 flex-1 overflow-y-auto min-h-[100px]">
              {samples.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                  <p>No hay muestras añadidas.</p>
                </div>
              ) : (
                samples.map(s => (
                  <div key={s.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm text-xs relative group hover:border-purple-200 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-1.5">
                            {s.type === 'essay' ? (
                                <FileText className="w-3.5 h-3.5 text-red-500" />
                            ) : (
                                <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                            )}
                            <span className="font-semibold text-gray-700">
                                {s.type === 'essay' ? 'Documento PDF' : 'Texto Manual'}
                            </span>
                        </div>
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                           ~{s.content.split(/\s+/).length} palabras
                        </span>
                    </div>
                    
                    <p className="line-clamp-4 text-gray-600 font-mono leading-relaxed">{s.content}</p>
                    
                    <button 
                      onClick={() => setSamples(prev => prev.filter(x => x.id !== s.id))}
                      className="absolute top-2 right-2 bg-white p-1 rounded-md shadow-sm border border-gray-100 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100"
                      title="Eliminar muestra"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-auto pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-medium text-gray-700">Añadir nueva muestra</label>
                <div>
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        className="hidden"
                        accept="application/pdf"
                        onChange={handleFileUpload}
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs flex items-center gap-1 bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm"
                        title="Subir archivo PDF con ejemplos de tu escritura"
                    >
                        <Upload className="w-3 h-3" /> Subir PDF
                    </button>
                </div>
              </div>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2 h-24 resize-none font-mono"
                placeholder="O pega aquí un email, ensayo o mensaje tuyo..."
                value={newSampleText}
                onChange={e => setNewSampleText(e.target.value)}
              />
              <button 
                onClick={handleAddSample}
                disabled={!newSampleText.trim()}
                className="w-full py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> Añadir Texto Manual
              </button>
            </div>
          </div>

          {/* Columna Derecha: El "Alma" Generada */}
          <div className="w-full lg:w-7/12 p-5 flex flex-col gap-4 bg-white relative">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-2">
                2. Tu ADN Estilístico
                {generatedGuide && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">ACTIVO</span>}
              </h3>
              {generatedGuide && !isAnalyzing && (
                 <button 
                    onClick={() => {
                        if(confirm('¿Generar de nuevo sobrescribirá los cambios manuales. ¿Continuar?')) handleAnalyze();
                    }}
                    className="text-xs flex items-center gap-1 text-gray-500 hover:text-purple-600"
                 >
                    <RefreshCw className="w-3 h-3" /> Regenerar
                 </button>
              )}
            </div>
            
            <div className="flex-1 relative border border-purple-100 rounded-xl bg-purple-50/30 overflow-hidden">
              {isAnalyzing ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-purple-600 gap-4 bg-white/80 backdrop-blur-sm z-10">
                  <div className="relative">
                    <Sparkles className="w-10 h-10 animate-spin text-purple-500" />
                    <div className="absolute inset-0 animate-ping opacity-30 bg-purple-400 rounded-full"></div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-800">Analizando patrones lingüísticos...</p>
                    <p className="text-xs text-gray-500 mt-1">Leyendo documento completo...</p>
                  </div>
                </div>
              ) : (
                <textarea
                  className="w-full h-full p-4 bg-transparent text-sm text-gray-700 font-mono resize-none focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-500 transition-colors"
                  placeholder="Aquí aparecerá el prompt maestro de tu estilo. Puedes editarlo manualmente o generarlo analizando tus muestras."
                  value={generatedGuide}
                  onChange={e => setGeneratedGuide(e.target.value)}
                />
              )}
            </div>

            <div className="flex gap-3 pt-2">
              {!generatedGuide && (
                 <button 
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || (samples.length === 0 && !newSampleText.trim())}
                    className="flex-1 py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 transition-all shadow-md hover:shadow-lg"
                 >
                    <Fingerprint className="w-4 h-4" />
                    Analizar todo el texto y Generar ADN
                 </button>
              )}
              
              {generatedGuide && (
                  <>
                    <button 
                        onClick={() => setGeneratedGuide('')}
                        className="px-4 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                    >
                        Borrar
                    </button>
                    <button 
                        onClick={() => { onSaveStyle(generatedGuide); onClose(); }}
                        className="flex-1 py-3 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 flex justify-center items-center gap-2 shadow-lg shadow-purple-200 transition-all transform active:scale-[0.98]"
                    >
                        <Save className="w-4 h-4" />
                        Guardar y Usar este Estilo
                    </button>
                  </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};