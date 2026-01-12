import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { RedactionOptions, Length, Source, Tone, Thesis, StructureType, ModelId } from '../types';

const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Configuración agresiva para romper patrones de IA
const getHumanizerConfig = () => {
    return { 
        temperature: 0.95, // Alta temperatura para creatividad y "errores" humanos sutiles
        topP: 0.95,
        maxOutputTokens: 8192 
    };
};

const buildContextBlock = (sources: Source[]) => 
    sources.map(s => `<document name="${s.name}">${s.content.slice(0, 20000)}</document>`).join('\n');

const cleanJsonOutput = (text: string): string => {
  if (!text) return "[]";
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- PROMPT PORTABLE (EXPORTACIÓN) ---
export const buildPortablePrompt = (
  sources: Source[], 
  instruction: string, 
  options: RedactionOptions
): string => {
  const fileManifest = sources.length > 0 
    ? sources.map(s => `    <file_requirement status="PENDING_ATTACHMENT">${s.name}</file_requirement>`).join('\n')
    : "    <file_requirement>El usuario adjuntará los documentos relevantes manualmente.</file_requirement>";

  const styleBlock = options.styleGuide 
    ? `  <style_dna_imperative>\n    <description>Mimetiza rigurosamente este estilo:</description>\n    <voice_sample>\n${options.styleGuide}\n    </voice_sample>\n  </style_dna_imperative>`
    : `  <style_configuration>\n    <tone>${options.tone}</tone>\n  </style_configuration>`;

  return `<!-- SYSTEM PROMPT: REDACTA_IA ANTI-DETECTOR v3.0 -->
<system_role>
  Actúa como un Escritor Académico Humano. Tu objetivo es burlar los detectores de IA.
  REGLAS DE ORO:
  1. NO USES LISTAS (Bullet points). Convierte todo en párrafos densos y conectados.
  2. VARIABILIDAD (Burstiness): Mezcla frases muy largas y complejas con frases cortas y contundentes.
  3. VOCABULARIO: Evita palabras de IA como "Cabe destacar", "En conclusión", "Por otro lado". Usa conectores naturales.
</system_role>

<context_input>
  <manifest_of_expected_files>\n${fileManifest}\n  </manifest_of_expected_files>
</context_input>

<project_configuration>
  <output_format>${options.format}</output_format>
  <target_length>${options.length}</target_length>
  <citation_style>${options.includeCrossReferences ? 'APA 7 (Citas explícitas)' : 'Narrativa'}</citation_style>
</project_configuration>

${styleBlock}

<task_directive>
  ${instruction}
</task_directive>
`.trim();
};

// --- 1. GENERADOR DE TESIS ---
export const generateTheses = async (sources: Source[], instruction: string): Promise<Thesis[]> => {
  const ai = getClient();
  const context = buildContextBlock(sources);
  
  // Usamos Flash para lógica rápida
  const prompt = `
    Analiza fuentes e instrucción.
    <library>${context || "General"}</library>
    <instruction>${instruction}</instruction>
    Genera 3 Tesis (Enfoques) para un trabajo académico.
    SALIDA: JSON Array válido. [{ "id": "1", "angle": "Crítico", "title": "...", "description": "..." }]
  `;

  try {
    const resp = await ai.models.generateContent({
      model: 'gemini-2.0-flash', 
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJsonOutput(resp.text || "[]"));
  } catch (e) {
    console.error("Error tesis:", e);
    return [];
  }
};

// --- 2. GENERADOR DE ÍNDICE (ARQUITECTO) ---
const generateOutline = async (sources: Source[], instruction: string, thesis: Thesis | null, options: RedactionOptions): Promise<string[]> => {
  const ai = getClient();
  const context = buildContextBlock(sources);
  const sectionsCount = options.length === Length.THESIS ? "8-12" : "5-7";
  
  const prompt = `
    Actúa como Editor. Crea un ÍNDICE para un texto de longitud ${options.length} (${sectionsCount} secciones).
    Tema: ${instruction}. Tesis: ${thesis?.title || "N/A"}.
    Contexto: <library>${context.slice(0, 10000)}</library>
    SALIDA: JSON Array de títulos. Ej: ["Introducción", "Desarrollo", "Conclusión"]
  `;

  try {
    const resp = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJsonOutput(resp.text || "[]"));
  } catch (e) {
    return ["Introducción", "Cuerpo Principal", "Conclusión"];
  }
};

// --- HELPER: HUMANIZADOR (EL SECRETO ANTI-IA) ---
// Esta función reescribe el texto lógico para hacerlo "humano" y caótico
const humanizeContent = async (ai: GoogleGenAI, text: string, options: RedactionOptions, context: string): Promise<string> => {
    const prompt = `
        TU ÚNICA MISIÓN: REESCRIBIR ESTE TEXTO PARA QUE PAREZCA 100% HUMANO.
        
        TEXTO A HUMANIZAR:
        "${text}"

        REGLAS OBLIGATORIAS (ANTI-DETECCIÓN IA):
        1. 🔥 **MUERTE A LAS LISTAS**: Si ves una lista con viñetas, DESTRÚYELA y conviértela en un párrafo narrativo fluido.
        2. 🌊 **BURSTINESS (Caos)**: Alterna oraciones muy largas y subordinadas con oraciones de 4 palabras. Rompe el ritmo robótico.
        3. 🚫 **PALABRAS PROHIBIDAS**: No uses "En conclusión", "En resumen", "Por consiguiente", "Es importante destacar". Usa "Y es que", "Total,", "Al final", "Entonces".
        4. 🎭 **ESTILO**: ${options.styleGuide ? `Imita este estilo: ${options.styleGuide}` : `Tono: ${options.tone}, pero natural.`}
        5. 🧬 **IMPERFECCIÓN**: Sé directo. No seas pedante.

        ${options.includeCrossReferences ? "Mantén las citas bibliográficas si existen." : ""}
    `;

    // Usamos gemini-2.0-flash con ALTA temperatura porque es menos rígido que los modelos Pro
    const resp = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: getHumanizerConfig()
    });

    return resp.text || text;
};

// --- 3. MOTOR DE REDACCIÓN ---
export const generateRedaction = async (
  sources: Source[],
  instruction: string, 
  options: RedactionOptions,
  selectedThesis: Thesis | null,
  onChunk: (c: string) => void,
  onReset: () => void
): Promise<string> => {
  const ai = getClient();
  const isModular = options.length === Length.LONG || options.length === Length.THESIS;
  
  // Usamos el modelo seleccionado para la lógica, pero Flash para humanizar
  const logicModel = options.model || ModelId.GEMINI_3_FLASH;

  if (isModular) {
    return generateModularRedaction(ai, logicModel, sources, instruction, options, selectedThesis, onChunk, onReset);
  } else {
    return generateSinglePassRedaction(ai, logicModel, sources, instruction, options, selectedThesis, onChunk, onReset);
  }
};

// --- ESTRATEGIA CORTA (SINGLE PASS + HUMANIZER) ---
const generateSinglePassRedaction = async (ai: any, model: string, sources: Source[], instruction: string, options: RedactionOptions, thesis: any, onChunk: any, onReset: any) => {
    const context = buildContextBlock(sources);
    
    // FASE 1: BORRADOR LÓGICO (Streaming)
    const draftPrompt = `
        Escribe un borrador académico sólido.
        Tema: ${instruction}. Tesis: ${thesis?.title || "N/A"}.
        Fuentes: ${context}.
        Longitud: ${options.length}.
        ESTRUCTURA: Introducción, Desarrollo, Conclusión.
        NOTA: Prioriza la estructura y los argumentos.
    `;

    let draft = "";
    // Si el usuario eligió un modelo Thinking (Gemini 3 Pro), aquí brilla
    const config: any = { maxOutputTokens: 8192 };
    if (model.includes('gemini-3-pro')) config.thinkingConfig = { thinkingBudget: 2048 };

    const draftResp = await ai.models.generateContentStream({
        model: model,
        contents: draftPrompt,
        config: config
    });

    for await (const chunk of draftResp) {
        const t = (chunk as GenerateContentResponse).text || '';
        draft += t;
        onChunk(t); // Mostramos el borrador mientras se genera
    }

    // FASE 2: HUMANIZACIÓN (Si no es borrador rápido)
    // Siempre aplicamos una capa de pulido para evitar el "Robot Voice", a menos que sea muy corto
    if (options.length !== Length.SHORT) {
        onReset();
        onChunk(draft); // Restauramos visualmente
        onChunk("\n\n_🧬 Humanizando texto para evitar detección IA..._");
        
        const humanized = await humanizeContent(ai, draft, options, context);
        onReset();
        onChunk(humanized);
        return humanized;
    }

    return draft;
};

// --- ESTRATEGIA LARGA (MODULAR + HUMANIZER PER SECTION) ---
const generateModularRedaction = async (ai: any, model: string, sources: Source[], instruction: string, options: RedactionOptions, thesis: any, onChunk: any, onReset: any) => {
    const context = buildContextBlock(sources);
    
    onChunk(`_🏗️ Arquitecto diseñando estructura..._\n\n`);
    const outline = await generateOutline(sources, instruction, thesis, options);
    onReset();

    let fullDocument = "";
    let previousContext = "Inicio.";

    for (let i = 0; i < outline.length; i++) {
        const sectionTitle = outline[i];
        onChunk(`\n\n## ${sectionTitle}\n\n`);
        fullDocument += `## ${sectionTitle}\n\n`;

        // 1. Generar Borrador de Sección
        const sectionPrompt = `
            Escribe la sección "${sectionTitle}" de un trabajo sobre ${instruction}.
            Contexto previo: ${previousContext.slice(-2000)}.
            Fuentes: ${context}.
            Solo contenido, sin preámbulos.
        `;

        let sectionDraft = "";
        try {
            // Usamos un modelo rápido para el borrador de sección para no hacer esperar tanto
            const draftResp = await ai.models.generateContent({
                model: 'gemini-2.0-flash', 
                contents: sectionPrompt
            });
            sectionDraft = draftResp.text || "";
            
            // 2. Humanizar Sección INMEDIATAMENTE
            // Esto asegura que la siguiente sección use contexto "humano" y no "robot"
            const humanizedSection = await humanizeContent(ai, sectionDraft, options, "");
            
            onChunk(humanizedSection); // Mostramos solo la versión final
            fullDocument += humanizedSection + "\n\n";
            previousContext += `\nResumen ${sectionTitle}: ${humanizedSection.slice(0, 300)}...`;

        } catch (e) {
            onChunk(`_[Error en sección ${sectionTitle}]_`);
        }
    }

    return fullDocument;
};

export const generateOptimizedPrompt = async (sources: Source[], instruction: string): Promise<string> => {
    const ai = getClient();
    const resp = await ai.models.generateContent({ 
        model: 'gemini-2.0-flash', 
        contents: `Mejora esta instrucción para una IA: "${instruction}". Hazla detallada.` 
    });
    return resp.text?.trim() || instruction;
};

export const generateStyleGuide = async (samples: string[]): Promise<string> => {
    const ai = getClient();
    const resp = await ai.models.generateContent({ 
        model: 'gemini-2.0-flash', 
        contents: `Analiza este estilo de escritura y crea un prompt para imitarlo (vocabulario, longitud de frases, tono):\n${samples.join('\n')}` 
    });
    return resp.text || "";
};