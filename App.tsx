import React, { useState, useEffect, useRef } from 'react';
import { generateRedaction, generateTheses, generateOptimizedPrompt, buildPortablePrompt } from './services/geminiService';
import { extractTextFromPdf } from './services/pdfService';
import { saveHistory, getHistory, deleteHistoryItem } from './services/db';
import { Tone, Length, Format, StructureType, RedactionOptions, HistoryItem, Source, Thesis, ModelId } from './types';
import { SettingsBar } from './components/SettingsBar';
import { HistorySidebar } from './components/HistorySidebar';
import { StyleManager } from './components/StyleManager';
import { ThesisSelector } from './components/ThesisSelector';
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
  StickyNote,
  Wand2,
  Share2
} from 'lucide-react';

function App() {
  // State
  const [userInstruction, setUserInstruction] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);
  
  // Opciones por defecto para University Edition
  const [options, setOptions] = useState<RedactionOptions>({
    model: ModelId.GEMINI_3_FLASH, // Default model
    tone: Tone.ACADEMIC,
    length: Length.MEDIUM,
    format: Format.ESSAY,
    structure: StructureType.STANDARD,
    includeCrossReferences: true,
    personalStyleMode: false,
    criticMode: false
  });
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Modals State
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [textModalTitle, setTextModalTitle] = useState('');
  const [textModalContent, setTextModalContent] = useState('');
  const [isStyleManagerOpen, setIsStyleManagerOpen] = useState(false);
  
  // Portable Prompt Modal
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportPromptContent, setExportPromptContent] = useState('');
  const [exportCopied, setExportCopied] = useState(false);
  
  // Thesis Strategy State
  const [isThesisModalOpen, setIsThesisModalOpen] = useState(false);
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [isAnalyzingTheses, setIsAnalyzingTheses] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const items = await getHistory();
    setHistory(items);
  };

  // --- HANDLERS ---
  
  const handleOptimizePrompt = async () => {
    if (!userInstruction.trim() && sources.length === 0) {
      alert("Escribe algo en la instrucción o añade fuentes primero.");
      return;
    }
    
    setIsOptimizingPrompt(true);
    try {
      const optimized = await generateOptimizedPrompt(sources, userInstruction || "Escribir un trabajo sobre los archivos adjuntos");
      setUserInstruction(optimized);
    } catch (e) {
      alert("Error optimizando instrucción.");
    } finally {
      setIsOptimizingPrompt(false);
    }
  };

  const handleExportPrompt = () => {
     if (!userInstruction.trim() && sources.length === 0) {
        alert("Necesitas contenido para exportar un prompt.");
        return;
     }
     const prompt = buildPortablePrompt(sources, userInstruction, options);
     setExportPromptContent(prompt);
     setIsExportModalOpen(true);
  };

  const handleCopyExport = () => {
     navigator.clipboard.writeText(exportPromptContent);
     setExportCopied(true);
     setTimeout(() => setExportCopied(false), 2000);
  };

  const handleStartRedaction = async () => {
    if (!userInstruction.trim() && sources.length === 0) {
      alert("Por favor añade una instrucción o al menos una fuente.");
      return;
    }

    // Si no es académico o es muy corto, saltamos la fase de tesis
    if (options.length === Length.SHORT || options.tone !== Tone.ACADEMIC) {
        handleFinalGenerate(null);
        return;
    }

    setIsGenerating(true);
    setIsAnalyzingTheses(true);
    setIsThesisModalOpen(true);

    try {
      const generatedTheses = await generateTheses(sources, userInstruction);
      if (generatedTheses && generatedTheses.length > 0) {
        setTheses(generatedTheses);
        setIsAnalyzingTheses(false);
      } else {
        handleFinalGenerate(null);
      }
    } catch (error) {
      console.error("Error en estrategia:", error);
      handleFinalGenerate(null);
    }
  };

  const handleFinalGenerate = async (selectedThesis: Thesis | null) => {
    setIsThesisModalOpen(false);
    setIsGenerating(true);
    setGeneratedText('');
    
    try {
      const finalResult = await generateRedaction(
        sources, 
        userInstruction, 
        options,
        selectedThesis,
        (chunk) => setGeneratedText(prev => prev + chunk),
        () => setGeneratedText('')
      );
      
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        userInstruction: userInstruction,
        generatedText: finalResult,
        options: { ...options },
        timestamp: Date.now()
      };
      await saveHistory(newItem);
      await loadHistory();

    } catch (error) {
      console.error(error);
      alert("Hubo un error al generar. Revisa la consola.");
    } finally {
      setIsGenerating(false);
      setIsAnalyzingTheses(false);
    }
  };

  // --- UTILIDADES DE UI ---

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
    if (file.type !== 'application/pdf') { alert('Solo PDF.'); return; }
    if (sources.some(s => s.name === file.name)) { alert('Ya existe.'); return; }

    setIsGenerating(true); 
    try {
      const text = await extractTextFromPdf(file);
      const newSource: Source = { id: Date.now().toString(), name: file.name, content: text, type: 'pdf' };
      setSources(prev => [...prev, newSource]);
    } catch (error) { alert("Error al leer PDF"); } 
    finally { setIsGenerating(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleSaveTextSource = () => {
    if (!textModalTitle.trim() || !textModalContent.trim()) return;
    setSources(prev => [...prev, { id: Date.now().toString(), name: textModalTitle.trim(), content: textModalContent, type: 'text' }]);
    setTextModalTitle(''); setTextModalContent(''); setIsTextModalOpen(false);
 };

  const handleRemoveSource = (id: string) => setSources(prev => prev.filter(s => s.id !== id));

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
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
      {/* Export Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between bg-gray-50">
              <div className="flex flex-col">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                    <Code2 className="w-5 h-5 text-indigo-600"/> Prompt Maestro (Portable)
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                    Copia esto en Claude 3.5, Grok 3 o ChatGPT o1 para obtener resultados idénticos.
                </p>
              </div>
              <button onClick={() => setIsExportModalOpen(false)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <div className="p-0 flex-1 relative bg-slate-900">
              <textarea 
                readOnly
                className="w-full h-full p-4 bg-slate-900 text-slate-300 font-mono text-xs resize-none focus:outline-none leading-relaxed" 
                value={exportPromptContent} 
              />
            </div>
            <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-2">
              <button onClick={() => setIsExportModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cerrar</button>
              <button 
                onClick={handleCopyExport} 
                className={`px-6 py-2 text-sm text-white rounded-lg flex items-center gap-2 transition-all ${exportCopied ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {exportCopied ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
                {exportCopied ? 'Copiado' : 'Copiar Prompt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text Modal */}
      {isTextModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between bg-gray-50">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2"><StickyNote className="w-4 h-4 text-primary-600"/> Añadir Texto</h3>
              <button onClick={() => setIsTextModalOpen(false)}><X className="w-5 h-5 text-gray-400"/></button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Título..." value={textModalTitle} onChange={e => setTextModalTitle(e.target.value)} autoFocus />
              <textarea className="w-full px-3 py-2 border rounded-lg text-sm min-h-[200px]" placeholder="Contenido..." value={textModalContent} onChange={e => setTextModalContent(e.target.value)} />
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              <button onClick={() => setIsTextModalOpen(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg">Cancelar</button>
              <button onClick={handleSaveTextSource} className="px-4 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-lg">Guardar</button>
            </div>
          </div>
        </div>
      )}

      <StyleManager 
        isOpen={isStyleManagerOpen}
        onClose={() => setIsStyleManagerOpen(false)}
        currentGuide={options.styleGuide}
        onSaveStyle={(guide) => setOptions(prev => ({ ...prev, styleGuide: guide, personalStyleMode: true }))}
      />

      <ThesisSelector 
        isOpen={isThesisModalOpen}
        isGenerating={isAnalyzingTheses}
        theses={theses}
        onSelect={handleFinalGenerate}
        onCancel={() => handleFinalGenerate(null)}
      />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 hover:bg-gray-100 rounded-lg lg:hidden"><Menu className="w-6 h-6 text-gray-600" /></button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-tr from-primary-600 to-primary-400 rounded-lg flex items-center justify-center text-white shadow-lg"><PenLine className="w-5 h-5" /></div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                RedactaIA <span className="text-xs bg-primary-100 text-primary-800 px-2 py-0.5 rounded ml-1 font-medium">Uni</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setIsSidebarOpen(true)} className="hidden lg:flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-primary-600 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors"><History className="w-4 h-4" /> Historial</button>
          </div>
        </div>
      </header>

      <SettingsBar options={options} setOptions={setOptions} disabled={isGenerating} onOpenStyleModal={() => setIsStyleManagerOpen(true)} />
      <HistorySidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} history={history} onSelect={handleSelectHistory} onDelete={handleDeleteHistory} />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 h-auto lg:h-[calc(100vh-8rem)]">
        
        {/* Left Column */}
        <div className="flex flex-col gap-4 h-full">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col max-h-[40%]">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <label className="text-sm font-semibold text-gray-700 uppercase flex items-center gap-2"><Paperclip className="w-4 h-4" /> Fuentes</label>
              <div className="flex items-center gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="application/pdf" className="hidden" />
                <button onClick={() => setIsTextModalOpen(true)} disabled={isGenerating} className="text-xs flex items-center gap-1 bg-white border border-gray-300 px-2 py-1 rounded shadow-sm hover:bg-blue-50"><Plus className="w-3.5 h-3.5" /> Texto</button>
                <button onClick={() => fileInputRef.current?.click()} disabled={isGenerating} className="text-xs flex items-center gap-1 bg-white border border-gray-300 px-2 py-1 rounded shadow-sm hover:bg-red-50"><Upload className="w-3.5 h-3.5" /> PDF</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
              {sources.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl p-4"><p>Añade fuentes de contexto.</p></div>
              ) : (
                <div className="space-y-2">{sources.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-2.5 bg-white border rounded-lg shadow-sm"><span className="text-sm truncate w-4/5">{s.name}</span><button onClick={() => handleRemoveSource(s.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button></div>
                ))}</div>
              )}
            </div>
          </div>

          <div className="flex flex-col flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden group focus-within:ring-2 focus-within:ring-primary-100 transition-all">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <label className="text-sm font-semibold text-gray-700 uppercase flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary-500" /> Instrucción</label>
              <div className="flex gap-2">
                  <button 
                    onClick={handleExportPrompt}
                    disabled={(!userInstruction && sources.length === 0)}
                    className="text-xs flex items-center gap-1 text-gray-600 hover:text-gray-900 bg-gray-100 px-2 py-1 rounded disabled:opacity-50 hover:bg-gray-200 border border-gray-200"
                    title="Exportar Prompt para Claude/Grok"
                  >
                    <Share2 className="w-3 h-3" />
                    Exportar Prompt
                  </button>
                  <button 
                    onClick={handleOptimizePrompt}
                    disabled={isGenerating || isOptimizingPrompt || (!userInstruction && sources.length === 0)}
                    className="text-xs flex items-center gap-1 text-purple-600 hover:text-purple-800 bg-purple-50 px-2 py-1 rounded disabled:opacity-50"
                  >
                    {isOptimizingPrompt ? <Loader2 className="w-3 h-3 animate-spin"/> : <Wand2 className="w-3 h-3" />}
                    Mejorar Instrucción
                  </button>
                  <button onClick={handleClearAll} className="text-xs flex items-center gap-1 text-gray-400 hover:text-red-500"><Eraser className="w-3.5 h-3.5" /> Limpiar</button>
              </div>
            </div>
            <textarea className="flex-1 w-full p-4 resize-none focus:outline-none text-gray-700 text-sm" placeholder="Describe qué quieres escribir..." value={userInstruction} onChange={(e) => setUserInstruction(e.target.value)} />
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
               <button onClick={handleStartRedaction} disabled={(!userInstruction && sources.length === 0) || isGenerating} className="py-2.5 px-6 bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-lg flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-50">
                {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</> : <><PenLine className="w-4 h-4" /> Redactar Trabajo</>}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative min-h-[500px]">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <label className="text-sm font-semibold text-gray-700 uppercase flex items-center gap-2">
              Resultado {isGenerating && <span className="text-xs text-primary-600 animate-pulse font-normal ml-2">Escribiendo...</span>}
            </label>
            {generatedText && <button onClick={handleCopy} className="text-xs flex items-center gap-1 px-2 py-1 rounded border bg-white hover:bg-gray-50">{copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />} Copiar</button>}
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            {!generatedText && !isGenerating ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4"><div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center"><ArrowRight className="w-8 h-8 text-gray-300" /></div><p className="text-sm">Configura y redacta.</p></div>
            ) : (
              <div className="generated-content prose prose-base lg:prose-lg prose-blue max-w-none"><ReactMarkdown>{generatedText}</ReactMarkdown></div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;