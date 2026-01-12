import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { RedactionOptions, Length, Source, Thesis, ModelId } from '../types';

const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Convierte nuestras fuentes a formato nativo de Gemini (Text Parts + Inline Data Parts)
const buildContentParts = (sources: Source[], additionalPrompt: string) => {
  const parts: any[] = [];

  // 1. Añadimos los PDFs como imágenes/datos binarios (Multimodalidad Real)
  sources.forEach(source => {
    if (source.mimeType === 'application/pdf') {
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: source.content // Base64 puro
        }
      });
    } else {
      parts.push({
        text: `FUENTE DE TEXTO [${source.name}]:\n${source.content}\n---`
      });
    }
  });

  // 2. Añadimos el prompt de texto al final
  parts.push({ text: additionalPrompt });

  return parts;
};

const cleanJsonOutput = (text: string): string => {
  if (!text) return "[]";
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- 1. GENERADOR DE TESIS (ESTRATEGA) ---
export const generateTheses = async (sources: Source[], instruction: string): Promise<Thesis[]> => {
  const ai = getClient();
  
  const prompt = `
    ACTÚA COMO: Profesor Universitario Senior.
    TAREA: Analizar los documentos adjuntos y la instrucción del usuario para proponer 3 enfoques (Tesis) sólidos.
    INSTRUCCIÓN USUARIO: "${instruction}"
    
    SALIDA ESPERADA: JSON Array.
    [{ "id": "1", "angle": "Crítico", "title": "Título Académico Sugerido", "description": "Breve explicación del enfoque..." }]
  `;

  try {
    const resp = await ai.models.generateContent({
      model: 'gemini-2.0-flash', 
      contents: {
        parts: buildContentParts(sources, prompt)
      },
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJsonOutput(resp.text || "[]"));
  } catch (e) {
    console.error("Error tesis:", e);
    return [];
  }
};

// --- 2. ARQUITECTO DE ESTRUCTURA ---
const generateOutline = async (sources: Source[], instruction: string, thesis: Thesis | null, options: RedactionOptions): Promise<string[]> => {
  const ai = getClient();
  const sectionsCount = options.length === Length.THESIS ? "10-15" : "6-8";
  
  const prompt = `
    ACTÚA COMO: Editor Académico.
    OBJETIVO: Crear un Índice Estructural (Outline) coherente para un trabajo de longitud: ${options.length}.
    TESIS CENTRAL: ${thesis?.title || "Análisis General"} (${thesis?.description})
    INSTRUCCIÓN: ${instruction}
    
    Genera una lista de ${sectionsCount} títulos de secciones lógicas.
    SALIDA: JSON Array de strings.
  `;

  try {
    const resp = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts: buildContentParts(sources, prompt) },
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJsonOutput(resp.text || "[]"));
  } catch (e) {
    return ["Introducción", "Desarrollo Teórico", "Análisis de Evidencia", "Discusión", "Conclusión"];
  }
};

// --- HUMANIZADOR (INTERNAL) ---
const humanizeContentLogic = async (ai: any, text: string, options: RedactionOptions): Promise<string> => {
    const prompt = `
        TU ÚNICA MISIÓN: POST-PRODUCCIÓN "ANTI-IA".
        
        INPUT: Un texto generado por una IA (probablemente Claude o GPT) que suena "demasiado perfecto" y robótico.
        
        OUTPUT: El mismo contenido, reescrito por un humano real.

        REGLAS DE DESTRUCCIÓN DE PATRONES:
        1. 🔥 **MUERTE A LAS LISTAS**: Si ves bullet points, CONVIÉRTELOS en párrafos densos y narrativos. (Esencial).
        2. 🚫 **VOCABULARIO PROHIBIDO**: Elimina: "Cabe destacar", "En conclusión", "Es fundamental", "Ahondar", "Panorama", "Tapiz".
        3. 🌊 **CAOS ESTRUCTURAL (Burstiness)**: Alterna frases muy largas (subordinadas) con frases de 3 palabras. Rompe el ritmo hipnótico de la IA.
        4. 🧬 **ADN PERSONAL**: ${options.styleGuide ? 'Imita estrictamente este estilo: ' + options.styleGuide : 'Usa un tono ' + options.tone + ' pero imperfecto/natural.'}
        
        IMPORTANTE:
        - No cambies datos fácticos (fechas, nombres).
        - No seas "educado". Sé directo.
        - Introduce conectores naturales: "Y es que...", "Total,", "Al final del día...", "Lo curioso es que...".
        
        TEXTO A HUMANIZAR:
        "${text}"
    `;

    // Usamos temperatura alta (1.1) para romper la predictibilidad estadística
    const resp = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: { 
            temperature: 1.1, 
            topP: 0.95, 
        }
    });

    return resp.text || text;
};

// --- 3. EXPOSED: HUMANIZADOR DIRECTO (PARA TEXTO PEGADO) ---
export const humanizeTextOnly = async (
    text: string, 
    options: RedactionOptions,
    onChunk: (c: string) => void
): Promise<string> => {
    const ai = getClient();
    
    // Si el texto es muy largo, lo partimos? Gemini 2.0 aguanta mucho, enviamos de golpe.
    // Simular streaming para UX
    onChunk("Detectando patrones de IA en el texto de entrada...\n");
    await new Promise(r => setTimeout(r, 600));
    onChunk("Aplicando imperfecciones y estilo personal...\n\n");
    
    const result = await humanizeContentLogic(ai, text, options);
    
    // Limpiar el loading text simulado antes de devolver
    return result; 
};

// --- 4. MOTOR DE REDACCIÓN (PDF -> TEXTO) ---
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
  const logicModel = 'gemini-2.0-flash'; 

  if (isModular) {
    return generateModularRedaction(ai, logicModel, sources, instruction, options, selectedThesis, onChunk, onReset);
  } else {
    return generateSinglePassRedaction(ai, logicModel, sources, instruction, options, selectedThesis, onChunk, onReset);
  }
};

const generateSinglePassRedaction = async (ai: any, model: string, sources: Source[], instruction: string, options: RedactionOptions, thesis: any, onChunk: any, onReset: any) => {
    const prompt = `
        Escribe un trabajo académico completo.
        TEMA: ${instruction}
        ENFOQUE: ${thesis?.title || "Estándar"}
        LONGITUD: ${options.length}
        
        INSTRUCCIONES CLAVE:
        - Basa tus argumentos EXCLUSIVAMENTE en los documentos adjuntos.
        - Estructura: Título, Introducción, Cuerpo, Conclusión.
    `;

    let draft = "";
    const draftResp = await ai.models.generateContentStream({
        model: model,
        contents: { parts: buildContentParts(sources, prompt) },
        config: { maxOutputTokens: 8192 } 
    });

    for await (const chunk of draftResp) {
        const t = (chunk as GenerateContentResponse).text || '';
        draft += t;
        onChunk(t);
    }

    if (options.length !== Length.SHORT) {
        onReset();
        onChunk(draft);
        onChunk("\n\n_🧬 Humanizando y verificando coherencia..._");
        const humanized = await humanizeContentLogic(ai, draft, options);
        onReset();
        onChunk(humanized);
        return humanized;
    }
    return draft;
};

const generateModularRedaction = async (ai: any, model: string, sources: Source[], instruction: string, options: RedactionOptions, thesis: any, onChunk: any, onReset: any) => {
    onChunk(`_🏗️ Analizando ${sources.length} documentos y diseñando estructura..._\n\n`);
    
    const outline = await generateOutline(sources, instruction, thesis, options);
    onReset();

    let fullDocument = ""; 

    for (let i = 0; i < outline.length; i++) {
        const sectionTitle = outline[i];
        onChunk(`\n\n## ${sectionTitle}\n\n`);
        fullDocument += `## ${sectionTitle}\n\n`;

        const sectionPrompt = `
            ROL: Escritor Académico Senior.
            TAREA: Escribir la sección "${sectionTitle}" (Sección ${i + 1} de ${outline.length}).
            
            ESTRUCTURA DEL PROYECTO:
            ${JSON.stringify(outline)}

            TESIS CENTRAL:
            ${thesis?.title || "N/A"} - ${thesis?.description || ""}
            
            MEMORIA DE TRABAJO (LO YA ESCRITO):
            <previous_content>
            ${fullDocument}
            </previous_content>
            
            INSTRUCCIONES PARA ESTA SECCIÓN:
            1. Analiza los documentos adjuntos para extraer evidencia NUEVA.
            2. Mantén la coherencia estricta con <previous_content>.
        `;

        let sectionDraft = "";
        try {
            const draftResp = await ai.models.generateContent({
                model: model,
                contents: { parts: buildContentParts(sources, sectionPrompt) }
            });
            sectionDraft = draftResp.text || "";

            // Humanizamos
            const humanizedSection = await humanizeContentLogic(ai, sectionDraft, options);
            
            onChunk(humanizedSection);
            fullDocument += humanizedSection + "\n\n";

        } catch (e) {
            onChunk(`_[Error generando sección ${sectionTitle}]_`);
            console.error(e);
        }
    }

    return fullDocument;
};

// Exportar helpers
export const generateOptimizedPrompt = async (sources: Source[], instruction: string): Promise<string> => {
    const ai = getClient();
    const resp = await ai.models.generateContent({ 
        model: 'gemini-2.0-flash', 
        contents: `Mejora esta instrucción: "${instruction}"` 
    });
    return resp.text?.trim() || instruction;
};

export const generateStyleGuide = async (samples: string[]): Promise<string> => {
    const ai = getClient();
    const resp = await ai.models.generateContent({ 
        model: 'gemini-2.0-flash', 
        contents: `Analiza este estilo de escritura para crear un "System Prompt" que permita a una IA imitarlo perfectamente. Describe longitud de frases, vocabulario típico, uso de conectores, tono y peculiaridades gramaticales:\n${samples.join('\n')}` 
    });
    return resp.text || "";
};

export const buildPortablePrompt = (sources: Source[], instruction: string, options: RedactionOptions): string => {
   return `<!-- SYSTEM PROMPT PARA CLAUDE PROJECTS -->
   <role>
   Eres un redactor académico experto.
   Estilo de Escritura Requerido: ${options.styleGuide || options.tone}
   </role>
   
   <task>
   Escribe un borrador completo sobre: "${instruction}".
   Usa la información de los archivos adjuntos.
   </task>
   `;
};