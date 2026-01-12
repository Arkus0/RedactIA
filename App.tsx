import React, { useState, useEffect, useRef } from 'react';
import { generateRedaction, generateTheses, generateOptimizedPrompt, buildPortablePrompt, humanizeTextOnly } from './services/geminiService';
import { extractTextFromPdf } from './services/pdfService';
import { saveHistory, getHistory, deleteHistoryItem } from './services/db';
import { Tone, Length, Format, StructureType, RedactionOptions, HistoryItem, Source, Thesis, ModelId, AppMode } from './types';
import { SettingsBar } from './components/SettingsBar';
import { HistorySidebar } from './components/HistorySidebar';
import { StyleManager } from './components/StyleManager';
import { ThesisSelector } from './components/ThesisSelector';
import { Toast, ToastType } from './components/Toast';
import ReactMarkdown from 'react-markdown';
import { 
  Sparkles, Copy, Eraser, History, ArrowRight, Loader2, PenLine, 
  Trash2, Paperclip, X, StickyNote, Wand2, FileText, Code2, ShieldAlert
} from 'lucide-react';

function App() {
  // State
  const [appMode, setAppMode] = useState<AppMode>('ARCHITECT');
  const [userInstruction, setUserInstruction] = useState('');
  const [humanizerInput, setHumanizerInput] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: ToastType} | null>(null);
  
  const [options, setOptions] = useState<RedactionOptions>({
    model: ModelId.GEMINI_3_FLASH,
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
  
  // Modals
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [textModalTitle, setTextModalTitle] = useState('');
  const [textModalContent, setTextModalContent] = useState('');
  const [isStyleManagerOpen, setIsStyleManagerOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportPromptContent, setExportPromptContent] = useState('');
  const [exportCopied, setExportCopied] = useState(false);
  const [isThesisModalOpen, setIsThesisModalOpen] = useState(false);
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [isAnalyzingTheses, setIsAnalyzingTheses] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadHistory(); }, []);
  const loadHistory = async () => setHistory(await getHistory());
  const showToast = (msg: string, type: ToastType = 'info') => setToast({msg, type});

  // --- HANDLERS ---
  const handleOptimizePrompt = async () => {
    if (!userInstruction.trim() && sources.length === 0) return showToast("Falta contenido", 'error');
    setIsOptimizingPrompt(true);
    try {
      const optimized = await generateOptimizedPrompt(sources, userInstruction || "Trabajo académico");
      setUserInstruction(optimized);
    } catch (e) { showToast("Error optimizando", 'error'); } 
    finally { setIsOptimizingPrompt(false); }
  };

  const handleExportPrompt = () => {
     if (!userInstruction.trim() && sources.length === 0) return showToast("Nada que exportar", 'error');
     setExportPromptContent(buildPortablePrompt(sources, userInstruction, options));
     setIsExportModalOpen(true);
  };

  // Acción Principal (Bifurcada por Modo)
  const handleMainAction = async () => {
      if (appMode === 'HUMANIZER') {
          handleHumanizeOnly();
      } else {
          handleStartRedaction();
      }
  };

  const handleHumanizeOnly = async () => {
      if (!humanizerInput.trim()) return showToast("Pega un texto para humanizar", 'error');
      setIsGenerating(true);
      setGeneratedText('');
      
      try {
          const result = await humanizeTextOnly(
              humanizerInput, 
              options, 
              (chunk) => setGeneratedText(prev => prev + chunk)
          );
          
          // Guardamos en historial como una entrada especial
          await saveHistory({
              id: Date.now().toString(), 
              userInstruction: "[HUMANIZACIÓN] " + humanizerInput.slice(0, 50) + "...", 
              generatedText: result, 
              options: {...options}, 
              timestamp: Date.now()
          });
          await loadHistory();
      } catch (error) {
          console.error(error);
          showToast("Error en humanización", 'error');
      } finally {
          setIsGenerating(false);
      }
  };

  const handleStartRedaction = async () => {
    if (!userInstruction.trim() && sources.length === 0) return showToast("Añade instrucción o fuentes", 'error');
    if (options.length === Length.SHORT || options.tone !== Tone.ACADEMIC) { handleFinalGenerate(null); return; }

    setIsGenerating(true);
    setIsAnalyzingTheses(true);
    setIsThesisModalOpen(true);

    try {
      const generatedTheses = await generateTheses(sources, userInstruction);
      if (generatedTheses?.length > 0) {
        setTheses(generatedTheses);
        setIsAnalyzingTheses(false);
      } else { handleFinalGenerate(null); }
    } catch (error) { handleFinalGenerate(null); }
  };

  const handleFinalGenerate = async (selectedThesis: Thesis | null) => {
    setIsThesisModalOpen(false);
    setIsGenerating(true);
    setGeneratedText('');
    
    try {
      const finalResult = await generateRedaction(
        sources, userInstruction, options, selectedThesis,
        (chunk) => setGeneratedText(prev => prev + chunk),
        () => setGeneratedText('')
      );
      await saveHistory({
        id: Date.now().toString(), userInstruction, generatedText: finalResult, options: {...options}, timestamp: Date.now()
      });
      await loadHistory();
    } catch (error) { 
      console.error(error); 
      showToast("Error generando redacción", 'error'); 
    } finally {
      setIsGenerating(false);
      setIsAnalyzingTheses(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') return showToast('Solo archivos PDF', 'error');
    if (file.size > 10 * 1024 * 1024) return showToast('Máximo 10MB', 'error');

    setIsGenerating(true);
    try {
      const base64Content = await extractTextFromPdf(file);
      setSources(prev => [...prev, { id: Date.now().toString(), name: file.name, content: base64Content, mimeType: 'application/pdf' }]);
      showToast("PDF añadido", 'success');
    } catch (error) { showToast("Error leyendo PDF", 'error'); } 
    finally { setIsGenerating(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleSaveTextSource = () => {
    if (!textModalTitle.trim() || !textModalContent.trim()) return;
    setSources(prev => [...prev, { id: Date.now().toString(), name: textModalTitle.trim(), content: textModalContent, mimeType: 'text/plain' }]);
    setTextModalTitle(''); setTextModalContent(''); setIsTextModalOpen(false);
 };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-slate-800">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Modals omitted for brevity - they remain the same logic-wise but connected */}
      {isExportModalOpen && (
         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh]">
             <div className="p-4 border-b flex justify-between bg-gray-50">
               <h3 className="font-bold flex items-center gap-2"><Code2 className="w-5 h-5"/> Prompt Portable</h3>
               <button onClick={() => setIsExportModalOpen(false)}><X className="w-5 h-5"/></button>
             </div>
             <textarea readOnly className="flex-1 p-4 bg-slate-900 text-slate-300 font-mono text-xs resize-none" value={exportPromptContent} />
             <div className="p-4 border-t flex justify-end">
               <button onClick={() => { navigator.clipboard.writeText(exportPromptContent); setExportCopied(true); setTimeout(() => setExportCopied(false), 2000); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">
                 {exportCopied ? 'Copiado' : 'Copiar'}
               </button>
             </div>
           </div>
         </div>
      )}

      {isTextModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-lg space-y-4">
             <div className="flex justify-between"><h3 className="font-bold">Añadir Texto</h3><button onClick={() => setIsTextModalOpen(false)}><X/></button></div>
             <input className="w-full border p-2 rounded" placeholder="Título" value={textModalTitle} onChange={e => setTextModalTitle(e.target.value)}/>
             <textarea className="w-full border p-2 rounded h-40" placeholder="Contenido" value={textModalContent} onChange={e => setTextModalContent(e.target.value)}/>
             <div className="flex justify-end gap-2"><button onClick={handleSaveTextSource} className="bg-primary-600 text-white px-4 py-2 rounded">Guardar</button></div>
          </div>
        </div>
      )}

      <StyleManager isOpen={isStyleManagerOpen} onClose={() => setIsStyleManagerOpen(false)} onSaveStyle={(g) => setOptions(p => ({...p, styleGuide: g, personalStyleMode: true}))} currentGuide={options.styleGuide}/>
      <ThesisSelector isOpen={isThesisModalOpen} isGenerating={isAnalyzingTheses} theses={theses} onSelect={handleFinalGenerate} onCancel={() => handleFinalGenerate(null)}/>

      {/* HEADER */}
      <header className="bg-white border-b h-16 flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white transition-colors ${appMode === 'HUMANIZER' ? 'bg-indigo-600' : 'bg-primary-600'}`}>
                {appMode === 'HUMANIZER' ? <ShieldAlert className="w-5 h-5"/> : <PenLine className="w-5 h-5"/>}
            </div>
            <h1 className="font-bold text-xl text-gray-800">RedactaIA <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded border ml-2">Post-Producción</span></h1>
        </div>
        <div className="flex items-center gap-3">
             {/* MODE SWITCHER TABS */}
             <div className="bg-gray-100 p-1 rounded-lg flex text-xs font-medium">
                <button 
                    onClick={() => setAppMode('ARCHITECT')} 
                    className={`px-3 py-1.5 rounded-md transition-all ${appMode === 'ARCHITECT' ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Arquitecto (PDFs)
                </button>
                <button 
                    onClick={() => setAppMode('HUMANIZER')} 
                    className={`px-3 py-1.5 rounded-md transition-all ${appMode === 'HUMANIZER' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Humanizador (Texto)
                </button>
             </div>
             <div className="h-6 w-px bg-gray-200"></div>
             <button onClick={() => setIsSidebarOpen(true)} className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-lg"><History className="w-4 h-4"/> Historial</button>
        </div>
      </header>

      <SettingsBar options={options} setOptions={setOptions} disabled={isGenerating} onOpenStyleModal={() => setIsStyleManagerOpen(true)}/>
      <HistorySidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} history={history} onSelect={(item) => {setUserInstruction(item.userInstruction); setGeneratedText(item.generatedText); setOptions(item.options); setIsSidebarOpen(false);}} onDelete={async (id, e) => {e.stopPropagation(); await deleteHistoryItem(id); await loadHistory();}}/>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-4 h-[calc(100vh-10rem)]">
          
          {/* --- LEFT PANEL: DYNAMIC BASED ON MODE --- */}
          
          {appMode === 'ARCHITECT' ? (
            // MODE: ARCHITECT (Sources + Instruction)
            <>
                <div className="bg-white rounded-xl shadow-sm border flex flex-col h-1/3">
                    <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 uppercase flex gap-2"><Paperclip className="w-4 h-4"/> Fuentes ({sources.length})</span>
                        <div className="flex gap-2">
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="application/pdf" className="hidden"/>
                        <button onClick={() => setIsTextModalOpen(true)} className="text-xs border px-2 py-1 rounded hover:bg-gray-100">+ Texto</button>
                        <button onClick={() => fileInputRef.current?.click()} className="text-xs border px-2 py-1 rounded hover:bg-gray-100">+ PDF</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/50">
                        {sources.map(s => (
                            <div key={s.id} className="flex justify-between items-center p-2 bg-white border rounded shadow-sm text-sm">
                                <div className="flex items-center gap-2 truncate">
                                    {s.mimeType === 'application/pdf' ? <FileText className="w-4 h-4 text-red-500"/> : <StickyNote className="w-4 h-4 text-blue-500"/>}
                                    <span className="truncate max-w-[200px]">{s.name}</span>
                                </div>
                                <button onClick={() => setSources(p => p.filter(x => x.id !== s.id))} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                            </div>
                        ))}
                        {sources.length === 0 && <div className="text-center text-gray-400 text-xs mt-4">Sube los PDFs que usaste en NotebookLM.</div>}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border flex flex-col flex-1">
                    <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 uppercase flex gap-2"><Sparkles className="w-4 h-4"/> Instrucción</span>
                        <div className="flex gap-2">
                            <button onClick={handleOptimizePrompt} disabled={isOptimizingPrompt} className="text-xs text-purple-600 hover:bg-purple-50 px-2 py-1 rounded flex gap-1 items-center"><Wand2 className="w-3 h-3"/> Mejorar</button>
                            <button onClick={handleExportPrompt} className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded flex gap-1 items-center"><Code2 className="w-3 h-3"/> Prompt para Claude</button>
                        </div>
                    </div>
                    <textarea className="flex-1 p-4 resize-none outline-none text-sm" placeholder="Describe qué quieres escribir..." value={userInstruction} onChange={e => setUserInstruction(e.target.value)}/>
                </div>
            </>
          ) : (
            // MODE: HUMANIZER (Raw Text Input)
            <div className="bg-white rounded-xl shadow-sm border flex flex-col h-full border-indigo-100">
                 <div className="p-3 border-b bg-indigo-50/50 flex justify-between items-center">
                    <span className="text-xs font-bold text-indigo-800 uppercase flex gap-2"><ShieldAlert className="w-4 h-4"/> Input de Claude / GPT</span>
                    <button onClick={() => setHumanizerInput('')} className="text-xs text-gray-400 hover:text-red-500"><Eraser className="w-3 h-3"/></button>
                 </div>
                 <textarea 
                    className="flex-1 p-4 resize-none outline-none text-sm font-mono text-gray-600 bg-gray-50/30 focus:bg-white transition-colors" 
                    placeholder="Pega aquí el texto perfecto y aburrido que generó Claude..." 
                    value={humanizerInput} 
                    onChange={e => setHumanizerInput(e.target.value)}
                 />
            </div>
          )}

          {/* SHARED ACTION BUTTON */}
          <button 
             onClick={handleMainAction} 
             disabled={isGenerating || (appMode === 'ARCHITECT' && !userInstruction && sources.length === 0) || (appMode === 'HUMANIZER' && !humanizerInput)} 
             className={`w-full py-3 rounded-xl font-bold text-sm shadow-md disabled:opacity-50 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] ${
                 appMode === 'HUMANIZER' 
                 ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200' 
                 : 'bg-primary-600 hover:bg-primary-700 text-white'
             }`}
          >
             {isGenerating ? <Loader2 className="w-4 h-4 animate-spin"/> : (appMode === 'HUMANIZER' ? <ShieldAlert className="w-4 h-4"/> : <PenLine className="w-4 h-4"/>)}
             {isGenerating ? 'Procesando...' : (appMode === 'HUMANIZER' ? 'Humanizar y Ensuciar' : 'Generar Borrador')}
          </button>

        </div>

        {/* Panel Resultado (Shared) */}
        <div className="bg-white rounded-xl shadow-sm border flex flex-col h-[calc(100vh-10rem)]">
           <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-500 uppercase">Resultado Final</span>
              {generatedText && <button onClick={() => {navigator.clipboard.writeText(generatedText); setCopied(true); setTimeout(() => setCopied(false), 2000);}} className="text-xs border px-2 py-1 rounded bg-white">{copied ? 'Copiado' : 'Copiar'}</button>}
           </div>
           <div className="flex-1 overflow-y-auto p-8 prose prose-sm max-w-none">
              {!generatedText && !isGenerating ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-300">
                      <ArrowRight className="w-12 h-12 mb-4 opacity-20"/>
                      <p>El texto procesado aparecerá aquí.</p>
                  </div>
              ) : (
                  <ReactMarkdown>{generatedText}</ReactMarkdown>
              )}
           </div>
        </div>
      </main>
    </div>
  );
}

export default App;