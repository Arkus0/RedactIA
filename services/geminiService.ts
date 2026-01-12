import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { RedactionOptions, Length, Source, Tone } from '../types';

const getClient = () => {
  // Guidelines: API key must be obtained exclusively from process.env.API_KEY and used directly.
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const getModelConfig = (length: Length) => {
  switch (length) {
    case Length.SHORT:
      return { thinkingBudget: 1024, maxOutputTokens: 8192 };
    case Length.MEDIUM:
      return { thinkingBudget: 2048, maxOutputTokens: 16384 };
    case Length.LONG:
      return { thinkingBudget: 8192, maxOutputTokens: 32768 };
    case Length.EXTENSIVE:
      return { thinkingBudget: 16384, maxOutputTokens: 64000 };
    default:
      return { thinkingBudget: 1024, maxOutputTokens: 8192 };
  }
};

const buildPrompt = (sources: Source[], instruction: string, options: RedactionOptions) => {
  const contextBlock = sources.map(s => `
  <document name="${s.name}">
    ${s.content}
  </document>
  `).join('\n');

  const crossReferenceInstruction = options.includeCrossReferences 
    ? `
    - REFERENCIAS CRUZADAS: Analiza activamente el texto para encontrar conexiones. Cuando menciones un concepto explicado en otra sección, añade: (véase la sección: [Nombre exacto del encabezado]).
    ` 
    : '';

  return `
    Actúa como un experto redactor e investigador analítico de clase mundial.
    
    DATOS:
    1. <library>: Documentos fuente.
    2. <instruction>: Tarea a realizar.

    OBJETIVO:
    Generar un texto en formato "${options.format}" basado EXCLUSIVAMENTE en la biblioteca factual.

    CONFIGURACIÓN:
    - Tono: ${options.tone}
    - Longitud: ${options.length}
    - Idioma: Español.

    <library>
      ${contextBlock || "Sin fuentes adjuntas, usa conocimiento general."}
    </library>

    <instruction>
      ${instruction}
    </instruction>

    REGLAS:
    1. Cita implícitamente si es necesario.
    2. Respeta estrictamente Markdown.
    ${crossReferenceInstruction}
  `;
};

const buildHumanizePrompt = (text: string) => {
  return `
    Actúa como un editor corrector de estilo experto (Ghostwriter).
      
    TU TAREA:
    Reescribir el siguiente texto para eliminar CUALQUIER rastro de haber sido generado por una IA.
    
    TEXTO ORIGINAL:
    "${text}"
    
    REGLAS DE RE-ESCRITURA (Anti-Detección / Burstiness):
    1. ROMPE LA SIMETRÍA: Los humanos no escriben párrafos de igual longitud. Alterna agresivamente entre oraciones muy cortas y párrafos largos y complejos.
    2. ELIMINA MULETILLAS DE IA: Borra palabras como "Además", "Por lo tanto", "En conclusión", "Cabe destacar". Usa transiciones más naturales o ninguna transición.
    3. PERPLEJIDAD VARIABLE: Mezcla estructuras gramaticales simples con complejas.
    4. SUBJETIVIDAD CONTROLADA: Introduce matices sutiles, dudas retóricas o imperfecciones estilísticas menores para parecer menos robótico.
    5. EVITA LISTAS: Si es posible, transforma listas con viñetas en párrafos narrativos fluidos.
    
    IMPORTANTE: Mantén la información factual intacta, solo cambia la forma radicalmente para que parezca humano.
  `;
};

// Callback type definition
type StreamCallback = (chunk: string) => void;
type ResetCallback = () => void;

export const generateRedaction = async (
  sources: Source[],
  instruction: string, 
  options: RedactionOptions,
  onChunk: StreamCallback,
  onReset: ResetCallback
): Promise<string> => {
  const ai = getClient();
  const draftModelId = 'gemini-3-pro-preview'; // Mejor razonamiento para el contenido
  const humanizeModelId = 'gemini-3-flash-preview'; // Rápido para reescritura
  
  const { thinkingBudget, maxOutputTokens } = getModelConfig(options.length);

  // --- PASO 1: Generación de Borrador (Factual) ---
  // Si vamos a humanizar después, pedimos un tono profesional neutro primero para asegurar los datos
  const draftOptions = options.humanizeMode ? { ...options, tone: Tone.PROFESSIONAL } : options;
  const prompt = buildPrompt(sources, instruction, draftOptions);

  let fullDraft = '';

  try {
    const draftResponse = await ai.models.generateContentStream({
      model: draftModelId,
      contents: prompt,
      config: {
        maxOutputTokens: maxOutputTokens,
        thinkingConfig: { thinkingBudget: thinkingBudget },
        temperature: 0.7,
      }
    });

    for await (const chunk of draftResponse) {
      const c = chunk as GenerateContentResponse;
      if (c.text) {
        fullDraft += c.text;
        // Solo enviamos al UI si NO vamos a humanizar después, 
        // o podemos enviarlo para que el usuario vea el progreso del borrador
        onChunk(c.text); 
      }
    }

    // --- PASO 2: Humanización (Opcional) ---
    if (options.humanizeMode && fullDraft) {
      // Limpiamos el texto en la UI para empezar a escribir la versión humanizada
      onReset();
      onChunk("\n\n_Aplicando filtro de humanización y corrección de estilo..._\n\n");
      
      const humanizePrompt = buildHumanizePrompt(fullDraft);
      
      const humanizeResponse = await ai.models.generateContentStream({
        model: humanizeModelId,
        contents: humanizePrompt,
        config: { 
          temperature: 0.9 // Alta temperatura para creatividad y caos (burstiness)
        }
      });

      let fullHumanized = '';
      // Limpiamos el mensaje de estado
      onReset(); 

      for await (const chunk of humanizeResponse) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          fullHumanized += c.text;
          onChunk(c.text);
        }
      }
      return fullHumanized;
    }

    return fullDraft;

  } catch (error) {
    console.error("Error generating redaction:", error);
    throw error;
  }
};

export const generateOptimizedPrompt = async (
  sources: Source[],
  instruction: string,
  options: RedactionOptions
): Promise<string> => {
  const ai = getClient();
  const modelId = 'gemini-3-pro-preview';
  const sourcesSummary = sources.map(s => `- Archivo: ${s.name}`).join('\n');
  const crossRefNote = options.includeCrossReferences ? "Nota: Incluye referencias cruzadas internas." : "";

  const metaPrompt = `
    Actúa como Prompt Engineer. Crea un prompt maestro para esta tarea:
    Fuentes: ${sourcesSummary}
    Instrucción: "${instruction}"
    Config: ${options.tone}, ${options.format}, Humanizar: ${options.humanizeMode}.
    ${crossRefNote}
    
    Salida: Markdown con estructura XML (<role>, <task>, etc).
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: metaPrompt,
      config: { thinkingConfig: { thinkingBudget: 2048 } }
    });
    return response.text || "Error generando prompt.";
  } catch (error) {
    console.error(error);
    throw error;
  }
};