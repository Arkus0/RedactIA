import React, { useState, useRef } from 'react';
import { StyleSample } from '../types';
import { generateStyleGuide } from '../services/geminiService';
import { extractTextFromPdf } from '../services/pdfService';
import { Sparkles, Trash2, Plus, Save, X, Fingerprint, RefreshCw, Upload, FileText, MessageSquare, Copy } from 'lucide-react';

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
  const [copied, setCopied] = useState(false);
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
            alert("El PDF parece contener muy poco texto extraíble.");
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
      alert("Error al analizar el estilo.");
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyForClaude = () => {
    const prompt = `INSTRUCCIÓN DE SISTEMA (ESTILO):\nCuando escribas, debes adoptar estrictamente el siguiente perfil estilístico para evitar sonar como una IA genérica:\n\n${generatedGuide}`;
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              Bóveda de Estilo (ADN Personal)
            </h2>
            <p className="text-sm text-gray-500">Analiza tus textos para enseñar a Claude o RedactaIA cómo escribir como tú.</p>
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
                <Trash2 className="w-3 h-3" /> Limpiar
              </button>
            </div>
            
            <div className="space-y-3 flex-1 overflow-y-auto min-h-[100px]">
              {samples.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                  <p>Sube PDFs antiguos o pega emails/trabajos tuyos.</p>
                </div>
              ) : (
                samples.map(s => (
                  <div key={s.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm text-xs relative group hover:border-purple-200 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-1.5">
                            {s.type === 'essay' ? <FileText className="w-3.5 h-3.5 text-red-500" /> : <MessageSquare className="w-3.5 h-3.5 text-blue-500" />}
                            <span className="font-semibold text-gray-700">{s.type === 'essay' ? 'PDF' : 'Texto'}</span>
                        </div>
                    </div>
                    <p className="line-clamp-3 text-gray-600 font-mono">{s.content}</p>
                    <button 
                      onClick={() => setSamples(prev => prev.filter(x => x.id !== s.id))}
                      className="absolute top-2 right-2 bg-white p-1 rounded-md text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-auto pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-medium text-gray-700">Añadir muestra</label>
                <div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={handleFileUpload} />
                    <button onClick={() => fileInputRef.current?.click()} className="text-xs flex items-center gap-1 bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-red-50 transition-colors">
                        <Upload className="w-3 h-3" /> PDF
                    </button>
                </div>
              </div>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2 h-20 resize-none font-mono"
                placeholder="Pega texto aquí..."
                value={newSampleText}
                onChange={e => setNewSampleText(e.target.value)}
              />
              <button 
                onClick={handleAddSample}
                disabled={!newSampleText.trim()}
                className="w-full py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Añadir
              </button>
            </div>
          </div>

          {/* Columna Derecha: El "Alma" Generada */}
          <div className="w-full lg:w-7/12 p-5 flex flex-col gap-4 bg-white relative">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-700 text-xs uppercase tracking-wider flex items-center gap-2">
                2. Prompt de Estilo Generado
                {generatedGuide && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">LISTO</span>}
              </h3>
              {generatedGuide && !isAnalyzing && (
                 <button onClick={() => { if(confirm('¿Regenerar?')) handleAnalyze(); }} className="text-xs flex items-center gap-1 text-gray-500 hover:text-purple-600">
                    <RefreshCw className="w-3 h-3" /> Regenerar
                 </button>
              )}
            </div>
            
            <div className="flex-1 relative border border-purple-100 rounded-xl bg-purple-50/30 overflow-hidden">
              {isAnalyzing ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-purple-600 gap-4 bg-white/80 backdrop-blur-sm z-10">
                    <Sparkles className="w-10 h-10 animate-spin text-purple-500" />
                    <p className="text-sm font-bold text-gray-800">Decodificando tu estilo...</p>
                </div>
              ) : (
                <textarea
                  className="w-full h-full p-4 bg-transparent text-sm text-gray-700 font-mono resize-none focus:outline-none focus:bg-white"
                  placeholder="Aquí aparecerá el prompt maestro..."
                  value={generatedGuide}
                  onChange={e => setGeneratedGuide(e.target.value)}
                />
              )}
            </div>

            <div className="flex gap-2 pt-2 flex-wrap">
              {!generatedGuide ? (
                 <button 
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || (samples.length === 0 && !newSampleText.trim())}
                    className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-all shadow-md"
                 >
                    <Fingerprint className="w-4 h-4 inline mr-2" />
                    Analizar Estilo
                 </button>
              ) : (
                  <>
                    <button onClick={() => { onSaveStyle(generatedGuide); onClose(); }} className="flex-1 py-3 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 shadow-lg shadow-purple-200">
                        <Save className="w-4 h-4 inline mr-2" />
                        Usar en RedactaIA
                    </button>
                    <button onClick={handleCopyForClaude} className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-2">
                        {copied ? <CheckCircleIcon className="w-4 h-4 text-green-600"/> : <Copy className="w-4 h-4"/>}
                        {copied ? 'Copiado' : 'Copiar para Claude'}
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

const CheckCircleIcon = ({className}: {className?: string}) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);