import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { RedactionOptions, Length, Source, Tone, Thesis } from '../types';

const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const getModelConfig = (length: Length) => {
  switch (length) {
    case Length.SHORT:
      return { thinkingBudget: 1024, maxOutputTokens: 8192 };
    case Length.MEDIUM:
      return { thinkingBudget: 2048, maxOutputTokens: 16384 };
    case Length.LONG:
      return { thinkingBudget: 4096, maxOutputTokens: 32768 };
    case Length.EXTENSIVE:
      return { thinkingBudget: 8192, maxOutputTokens: 64000 };
    default:
      return { thinkingBudget: 1024, maxOutputTokens: 8192 };
  }
};

const buildContextBlock = (sources: Source[]) => 
    sources.map(s => `<document name="${s.name}">${s.content}</document>`).join('\n');

// --- 1. GENERADOR DE TESIS (El Estratega) ---
export const generateTheses = async (sources: Source[], instruction: string): Promise<Thesis[]> => {
  const ai = getClient();
  const context = buildContextBlock(sources);
  
  const prompt = `
    Actúa como un Estratega Editorial Senior y Arquitecto de Ensayos.
    Analiza las siguientes fuentes y la instrucción del usuario.
    
    <library>${context || "Conocimiento General"}</library>
    <instruction>${instruction || "Analizar el tema principal"}</instruction>
    
    TU TAREA:
    Propón 3 enfoques (tesis) únicos y potentes para escribir este texto. Evita lo obvio.
    1. Un enfoque ANALÍTICO (basado en datos, estructura y desglose de componentes).
    2. Un enfoque PERSUASIVO o "CONTRERAS" (desafiando una idea común o defendiendo un punto fuerte y polémico).
    3. Un enfoque VISIONARIO o SINTÉTICO (conectando puntos distantes, futuro o "big picture").

    SALIDA:
    Devuelve un JSON válido con esta estructura:
    [{ "id": "1", "angle": "Analítico", "title": "Título sugerido", "description": "Breve explicación del enfoque..." }, ...]
  `;

  try {
    const resp = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Flash es muy bueno siguiendo formatos JSON
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    angle: { type: Type.STRING, enum: ['Analítico', 'Persuasivo', 'Contreras', 'Visionario'] },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING }
                }
            }
        }
      }
    });
    
    // Parsing seguro
    if (resp.text) {
        return JSON.parse(resp.text) as Thesis[];
    }
    return [];
  } catch (e) {
    console.error("Error generando tesis", e);
    // Fallback silencioso para no romper el flujo
    return [];
  }
};

// --- 2. PIPELINE DE REDACCIÓN (Borrador -> Crítico -> Humanizador) ---
type StreamCallback = (chunk: string) => void;
type ResetCallback = () => void;

export const generateRedaction = async (
  sources: Source[],
  instruction: string, 
  options: RedactionOptions,
  selectedThesis: Thesis | null,
  onChunk: StreamCallback,
  onReset: ResetCallback
): Promise<string> => {
  const ai = getClient();
  const reasoningModel = 'gemini-3-pro-preview'; 
  const creativeModel = 'gemini-2.5-flash-preview-09-2025'; // Usamos 2.5 Flash reciente para creatividad rápida
  
  const { thinkingBudget, maxOutputTokens } = getModelConfig(options.length);
  const context = buildContextBlock(sources);

  // Instrucción de Tesis
  const thesisInstruction = selectedThesis 
    ? `\n\n🎯 ESTRATEGIA CENTRAL (OBLIGATORIO): 
       Todo el texto debe defender la siguiente tesis: "${selectedThesis.title}".
       Enfoque: ${selectedThesis.description}.
       No te desvíes de este ángulo.`
    : '';
  
  // Instrucción de Citas Inteligentes
  const quotesInstruction = options.includeCrossReferences 
    ? `\n\n💎 CITAS INTELIGENTES: 
       Es OBLIGATORIO extraer citas literales de las fuentes para respaldar cada argumento principal.
       Formato: "Cita literal" (Fuente, pág X).`
    : `\n\nCita implícitamente las fuentes integrándolas en la narrativa.`;

  // --- FASE 1: BORRADOR (El Escritor) ---
  // Si hay modo crítico, pedimos un borrador más "crudo" para pulir luego. Si no, pedimos el final.
  const draftPrompt = `
    Actúa como un Redactor de Élite de clase mundial.
    
    OBJETIVO: Escribir un texto excepcional en formato "${options.format}".
    
    CONFIGURACIÓN:
    - Tono: ${options.tone}
    - Longitud: ${options.length}
    ${thesisInstruction}
    ${quotesInstruction}

    <library>${context || "Sin fuentes, usa conocimiento general."}</library>
    <instruction>${instruction}</instruction>
    
    REGLAS:
    1. Estructura académica rigurosa (si es ensayo/artículo).
    2. Evita lugares comunes y frases vacías.
    3. Respeta estrictamente Markdown.
  `;

  let fullText = '';

  try {
    const draftResp = await ai.models.generateContentStream({
      model: reasoningModel,
      contents: draftPrompt,
      config: {
        maxOutputTokens: maxOutputTokens,
        thinkingConfig: { thinkingBudget: thinkingBudget },
        temperature: 0.7,
      }
    });

    for await (const chunk of draftResp) {
      const t = (chunk as GenerateContentResponse).text || '';
      fullText += t;
      // Si no hay fases posteriores, mostramos el streaming directo
      if (!options.criticMode && !options.humanizeMode) onChunk(t);
    }

    // --- FASE 2: EL CRÍTICO (Mejora de Calidad) ---
    if (options.criticMode) {
      // Limpiamos UI si estábamos mostrando el borrador (o mostramos estado si no)
      if (!options.humanizeMode) onReset();
      onChunk("\n\n_🕵️ El Crítico está revisando la lógica y puliendo argumentos..._\n\n");
      
      const critiquePrompt = `
        Actúa como un Editor Jefe Despiadado (The Ruthless Editor).
        TU TAREA: Revisar y REESCRIBIR el siguiente borrador para elevar su nivel intelectual.
        
        CRITERIOS DE MEJORA:
        1. LÓGICA DE HIERRO: Elimina falacias, argumentos circulares o afirmaciones débiles.
        2. FUERZA VERBAL: Cambia TODA la voz pasiva a activa. Elimina palabras vacías ("cosas", "aspectos", "diversos").
        3. EVIDENCIA: Asegúrate de que las afirmaciones clave parezcan respaldadas.
        4. CLARIDAD: Si una frase es confusa, reescríbela para que sea cristalina.
        
        BORRADOR ORIGINAL:
        ${fullText}
        
        IMPORTANTE: Devuelve SOLO la versión final mejorada, sin comentarios meta.
      `;

      const critiqueResp = await ai.models.generateContentStream({
        model: reasoningModel, // Usamos el modelo "pensante" también para criticar
        contents: critiquePrompt,
        config: { thinkingConfig: { thinkingBudget: 1024 } } // Piensa un poco sobre cómo mejorar
      });

      let improvedText = '';
      onReset(); 
      for await (const chunk of critiqueResp) {
        const t = (chunk as GenerateContentResponse).text || '';
        improvedText += t;
        // Si no hay humanización después, este es el resultado final
        if (!options.humanizeMode) onChunk(t);
      }
      fullText = improvedText;
    }

    // --- FASE 3: HUMANIZACIÓN (Bóveda de Estilo + Anti-Detección) ---
    if (options.humanizeMode) {
      onReset();
      const msg = options.styleGuide ? "Aplicando tu ADN de Escritura..." : "Aplicando estilo humano indetectable...";
      onChunk(`\n\n_✨ ${msg}_\n\n`);
      
      const styleInstruction = options.styleGuide 
        ? `⚠️ SIGUE ESTRICTAMENTE ESTE ADN DE ESTILO:\n${options.styleGuide}`
        : (options.userStyle ? `Imita este estilo: "${options.userStyle.substring(0,2000)}"` : `Aplica un estilo periodístico natural (New Yorker Style).`);

      const humanPrompt = `
        Actúa como un "Ghostwriter" experto en mimetismo.
        TU TAREA: Reescribir el texto para que sea indetectable como IA, aplicando el siguiente estilo.
        
        ${styleInstruction}
        
        REGLAS DE HUMANIZACIÓN (BURSTINESS):
        1. Alterna oraciones de 40 palabras con oraciones de 3 palabras. Rompe el ritmo.
        2. Elimina CUALQUIER conector de IA ("Además", "Por lo tanto", "En conclusión").
        3. Introduce imperfecciones estilísticas deliberadas (dudas, preguntas retóricas, paréntesis personales).
        
        TEXTO A HUMANIZAR: 
        ${fullText}
      `;

      const humanResp = await ai.models.generateContentStream({
        model: creativeModel, // Flash es excelente para reescritura de estilo rápida y fluida
        contents: humanPrompt,
        config: { temperature: 0.9 } // Alta temperatura para variedad
      });

      onReset();
      let final = '';
      for await (const chunk of humanResp) {
        const t = (chunk as GenerateContentResponse).text || '';
        final += t;
        onChunk(t);
      }
      fullText = final;
    }

    return fullText;

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

export const generateStyleGuide = async (samples: string[]): Promise<string> => {
  const ai = getClient();
  const modelId = 'gemini-3-pro-preview';

  if (samples.length === 0) return "";

  // IMPORTANTE: Eliminado el .substring() para permitir analizar todo el documento.
  // Gemini 3 Pro tiene una ventana de contexto de 2M tokens, suficiente para libros enteros.
  const analysisPrompt = `
    Actúa como un Analista Literario Forense.
    TU TAREA: Analizar estas muestras y crear un PROMPT DE SISTEMA que enseñe a una IA a imitar a este autor.

    MUESTRAS COMPLETAS:
    ${samples.map((s, i) => `--- MUESTRA ${i+1} ---\n${s}\n`).join('\n')}

    ASPECTOS CLAVE A DECODIFICAR: 
    1. Ritmo (Burstiness): Longitud de oraciones.
    2. Vocabulario: Palabras fetiche y jerga.
    3. Tono Emocional.
    4. Patrones de Puntuación.
    
    SALIDA: "IMPERATIVO DE ESTILO: Escribes como..."
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: analysisPrompt,
      // Aumentado el budget de pensamiento porque analizar textos largos requiere más procesamiento
      config: { thinkingConfig: { thinkingBudget: 8192 } } 
    });

    return response.text || "";
  } catch (error) {
    console.error("Error analizando estilo:", error);
    throw error;
  }
};