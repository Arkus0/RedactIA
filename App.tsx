import React, { useState, useEffect, useRef } from 'react';
import { generateRedaction, generateOptimizedPrompt } from './services/geminiService';
import { extractTextFromPdf } from './services/pdfService';
import { db, saveHistory, getHistory, deleteHistoryItem, clearHistory } from './services/db';
import { Tone, Length, Format, RedactionOptions, HistoryItem, Source } from './types';
import { SettingsBar } from './components/SettingsBar';
import { HistorySidebar } from './components/HistorySidebar';
import ReactMarkdown from 'react-markdown';
import { 
  Sparkles, 
  Copy, 
  Check, 
  Eraser, 
  History, 
  Menu, 
  ArrowRight,
  Loader2,
  PenLine,
  Upload,
  Code2,
  FileText,
  Trash2,
  Paperclip,
  Plus,
  X,
  StickyNote
} from 'lucide-react';

function App() {
  // State
  const [userInstruction, setUserInstruction] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [options, setOptions] = useState<RedactionOptions>({
    tone: Tone.PROFESSIONAL,
    length: Length.MEDIUM,
    format: Format.ESSAY,
    includeCrossReferences: false,
    humanizeMode: false
  });
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Text Source Modal State
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [textModalTitle, setTextModalTitle] = useState('');
  const [textModalContent, setTextModalContent] = useState('');
  const [humanizingPhase, setHumanizingPhase] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history on mount from IndexedDB
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const items = await getHistory();
    setHistory(items);
  };

  const handleGenerate = async (mode: 'redaction' | 'prompt') => {
    if (!userInstruction.trim() && sources.length === 0) {
      alert("Por favor añade una instrucción o al menos una fuente.");
      return;
    }

    setIsGenerating(true);
    setGeneratedText('');
    setHumanizingPhase(false);
    
    try {
      let finalResult = '';
      
      if (mode === 'redaction') {
        // Callback para streaming: actualizamos el texto conforme llega
        finalResult = await generateRedaction(
          sources, 
          userInstruction, 
          options,
          (chunk) => setGeneratedText(prev => prev + chunk), // Append chunk
          () => setGeneratedText('') // Reset text (e.g. before humanization phase)
        );
      } else {
        finalResult = await generateOptimizedPrompt(sources, userInstruction, options);
        setGeneratedText(finalResult);
      }
      
      // Save to history (IndexedDB handles larger size better)
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        userInstruction: userInstruction,
        generatedText: finalResult,
        options: { ...options },
        timestamp: Date.now()
      };
      
      await saveHistory(newItem);
      await loadHistory(); // Refresh list

    } catch (error) {
      console.error(error);
      alert("Hubo un error al generar. Revisa la consola o intenta más tarde.");
    } finally {
      setIsGenerating(false);
      setHumanizingPhase(false);
    }
  };

  const handleCopy = () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearAll = () => {
    if (confirm("¿Borrar todo (fuentes e instrucciones)?")) {
      setUserInstruction('');
      setSources([]);
      setGeneratedText('');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Por favor, selecciona un archivo PDF válido.');
      return;
    }

    // Check for duplicate
    if (sources.some(s => s.name === file.name)) {
      alert('Este archivo ya ha sido añadido.');
      return;
    }

    setIsGenerating(true); // Show loading state briefly while parsing
    try {
      const text = await extractTextFromPdf(file);
      const newSource: Source = {
        id: Date.now().toString(),
        name: file.name,
        content: text,
        type: 'pdf'
      };
      setSources(prev => [...prev, newSource]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Error al leer el PDF");
    } finally {
      setIsGenerating(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveTextSource = () => {
    if (!textModalTitle.trim() || !textModalContent.trim()) {
      alert("El título y el contenido son obligatorios.");
      return;
    }
    
    const newSource: Source = {
      id: Date.now().toString(),
      name: textModalTitle.trim(),
      content: textModalContent,
      type: 'text'
    };
    
    setSources(prev => [...prev, newSource]);
    setTextModalTitle('');
    setTextModalContent('');
    setIsTextModalOpen(false);
 };

  const handleRemoveSource = (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setUserInstruction(item.userInstruction);
    setGeneratedText(item.generatedText);
    setOptions(item.options);
    setIsSidebarOpen(false);
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteHistoryItem(id);
    await loadHistory();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Text Source Modal */}
      {isTextModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-primary-600" />
                Añadir Fuente de Texto
              </h3>
              <button onClick={() => setIsTextModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase">Título de la fuente</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder="Ej: Apuntes de Historia, Email del cliente..."
                  value={textModalTitle}
                  onChange={e => setTextModalTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase">Contenido</label>
                <textarea 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm min-h-[200px] resize-none font-mono"
                  placeholder="Pega aquí el texto o escribe tus notas..."
                  value={textModalContent}
                  onChange={e => setTextModalContent(e.target.value)}
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              <button 
                onClick={() => setIsTextModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveTextSource}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors"
              >
                Guardar Fuente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-lg lg:hidden"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-tr from-primary-600 to-primary-400 rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary-500/30">
                <PenLine className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                RedactaIA
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
              onClick={() => setIsSidebarOpen(true)}
              className="hidden lg:flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary-600 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors"
            >
              <History className="w-4 h-4" />
              Historial
            </button>
          </div>
        </div>
      </header>

      <SettingsBar 
        options={options} 
        setOptions={setOptions} 
        disabled={isGenerating} 
      />

      <HistorySidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        history={history}
        onSelect={handleSelectHistory}
        onDelete={handleDeleteHistory}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 h-auto lg:h-[calc(100vh-8rem)]">
        
        {/* Left Column: Sources & Instruction */}
        <div className="flex flex-col gap-4 h-full">
          
          {/* Section 1: Sources */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-h-[40%]">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Fuentes / Contexto
              </label>
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="application/pdf"
                  className="hidden"
                />
                
                <button 
                  onClick={() => setIsTextModalOpen(true)}
                  disabled={isGenerating}
                  className="text-xs flex items-center gap-1 bg-white border border-gray-300 text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 px-2 py-1 rounded shadow-sm transition-all disabled:opacity-50"
                  title="Añadir texto manual"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Texto
                </button>

                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isGenerating}
                  className="text-xs flex items-center gap-1 bg-white border border-gray-300 text-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 px-2 py-1 rounded shadow-sm transition-all disabled:opacity-50"
                  title="Subir PDF"
                >
                  <Upload className="w-3.5 h-3.5" />
                  PDF
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
              {sources.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl p-4">
                  <div className="flex gap-2 mb-2">
                    <FileText className="w-6 h-6 text-gray-300" />
                    <StickyNote className="w-6 h-6 text-gray-300" />
                  </div>
                  <p>Añade PDFs o notas de texto como contexto.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sources.map(source => (
                    <div key={source.id} className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm group">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className={`min-w-8 h-8 rounded flex items-center justify-center ${source.type === 'pdf' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                          {source.type === 'pdf' ? <FileText className="w-4 h-4" /> : <StickyNote className="w-4 h-4" />}
                        </div>
                        <span className="text-sm text-gray-700 font-medium truncate">{source.name}</span>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          ({(source.content.length / 1000).toFixed(1)}k chars)
                        </span>
                      </div>
                      <button 
                        onClick={() => handleRemoveSource(source.id)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Instructions */}
          <div className="flex flex-col flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden group focus-within:ring-2 focus-within:ring-primary-100 focus-within:border-primary-400 transition-all">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary-500" />
                Tu Pedido / Instrucción
              </label>
              <button 
                onClick={handleClearAll}
                className="text-xs flex items-center gap-1 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Eraser className="w-3.5 h-3.5" />
                Limpiar Todo
              </button>
            </div>
            <textarea
              className="flex-1 w-full p-4 resize-none focus:outline-none text-gray-700 leading-relaxed placeholder-gray-300 text-sm"
              placeholder="Ej: 'Escribe un resumen ejecutivo de las fuentes adjuntas' o 'Genera un ensayo sobre la inflación basándote en los documentos'..."
              value={userInstruction}
              onChange={(e) => setUserInstruction(e.target.value)}
            />
            <div className="p-4 bg-gray-50 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
               <button
                onClick={() => handleGenerate('prompt')}
                disabled={(!userInstruction && sources.length === 0) || isGenerating}
                className="py-2.5 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:bg-gray-100 disabled:text-gray-400 font-medium rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] text-sm"
              >
                <Code2 className="w-4 h-4 text-purple-600" />
                Generar Prompt
              </button>
               <button
                onClick={() => handleGenerate('redaction')}
                disabled={(!userInstruction && sources.length === 0) || isGenerating}
                className="py-2.5 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl shadow-lg shadow-primary-600/20 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] text-sm"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {options.humanizeMode ? 'Redactando & Humanizando...' : 'Escribiendo...'}
                  </>
                ) : (
                  <>
                    <PenLine className="w-4 h-4" />
                    Redactar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Output */}
        <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative min-h-[500px]">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <label className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              Resultado
              {isGenerating && (
                <span className="text-xs font-normal normal-case text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full animate-pulse">
                  Streaming...
                </span>
              )}
            </label>
            {generatedText && (
              <button 
                onClick={handleCopy}
                className={`text-xs flex items-center gap-1 px-2 py-1 rounded border transition-all ${
                  copied 
                    ? 'bg-green-50 text-green-600 border-green-200' 
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            {!generatedText && !isGenerating && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center">
                  <ArrowRight className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-center max-w-xs text-sm">
                  1. Sube tus fuentes (PDFs o Texto).<br/>
                  2. Escribe qué quieres que haga la IA con ellas.<br/>
                  3. Presiona "Redactar".
                </p>
              </div>
            )}
            
            {/* Si no hay texto pero estamos generando, mostramos loading skeleton inicial hasta que llegue el primer chunk */}
            {isGenerating && !generatedText && (
              <div className="space-y-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            )}

            {(generatedText) && (
              <div className="generated-content prose prose-base lg:prose-lg prose-blue max-w-none">
                <ReactMarkdown>{generatedText}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;