import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { RedactionOptions, Length, Source, Tone, Thesis, StructureType, ModelId } from '../types';

const getClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const getModelConfig = (length: Length) => {
  switch (length) {
    case Length.SHORT:
      return { thinkingBudget: 1024, maxOutputTokens: 8192 };
    case Length.MEDIUM:
      return { thinkingBudget: 2048, maxOutputTokens: 16384 };
    // Para modo modular, los tokens son por sección, así que usamos configuración estándar
    default:
      return { thinkingBudget: 4096, maxOutputTokens: 32768 };
  }
};

const buildContextBlock = (sources: Source[]) => 
    sources.map(s => `<document name="${s.name}">${s.content.slice(0, 20000)}</document>`).join('\n'); // Limitamos contexto por seguridad

const cleanJsonOutput = (text: string): string => {
  if (!text) return "[]";
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- PROMPT PORTABLE (MEJORADO: XML SYSTEM PROMPT) ---
export const buildPortablePrompt = (
  sources: Source[], 
  instruction: string, 
  options: RedactionOptions
): string => {
  
  // Lista de archivos para que el usuario sepa qué adjuntar
  const fileManifest = sources.length > 0 
    ? sources.map(s => `    <file_requirement status="USER_MUST_ATTACH">${s.name}</file_requirement>`).join('\n')
    : "    <file_requirement>El usuario adjuntará los documentos relevantes.</file_requirement>";

  // Bloque de Estilo Avanzado
  const styleBlock = options.styleGuide 
    ? `  <style_dna_imperative>
    <description>Se ha proporcionado un ADN de estilo específico. La IA DEBE mimetizar esta voz, vocabulario y cadencia rigurosamente.</description>
    <voice_sample>
${options.styleGuide}
    </voice_sample>
  </style_dna_imperative>`
    : `  <style_configuration>
    <tone>${options.tone}</tone>
    <register>Académico / Formal / Experto</register>
  </style_configuration>`;

  // Estructura XML optimizada para Claude/Grok/GPT-4o
  return `<!-- SYSTEM PROMPT: REDACTA_IA UNIVERSITY EXPORT -->
<!-- INSTRUCCIÓN PARA EL USUARIO: Copia este prompt y ADJUNTA los archivos originales (PDF) en el chat con tu IA favorita. -->

<system_role>
  Actúa como un Profesor Universitario Titular y Editor Académico de clase mundial.
  Tu objetivo es producir textos de alta densidad intelectual, rigurosidad metodológica y fluidez narrativa, basándote EXCLUSIVAMENTE en la evidencia proporcionada.
</system_role>

<context_input>
  <instruction>
    El usuario proporcionará archivos adjuntos al chat. Tu análisis debe basarse en esos documentos.
  </instruction>
  <manifest_of_expected_files>
${fileManifest}
  </manifest_of_expected_files>
</context_input>

<project_configuration>
  <output_format>${options.format}</output_format>
  <target_length>${options.length}</target_length>
  <structure_archetype>${options.structure}</structure_archetype>
  <citation_style>${options.includeCrossReferences ? 'APA 7 (Citas explícitas requeridas: Autor, Año)' : 'Narrativa / Referencial'}</citation_style>
</project_configuration>

${styleBlock}

<task_directive>
  ${instruction}
</task_directive>

<execution_protocol>
  <phase_1_analysis>
    Analiza profundamente los documentos adjuntos. Extrae tesis centrales, contra-argumentos, datos duros y matices sutiles.
  </phase_1_analysis>
  <phase_2_synthesis>
    Integra la información. No hagas resúmenes lineales; sintetiza por temas o argumentos (Sintopía).
  </phase_2_synthesis>
  <phase_3_production>
    Redacta el contenido usando Markdown jerárquico y limpio.
    - Usa H1 para el Título Principal.
    - Usa H2 y H3 para organizar secciones y subsecciones lógicas.
    - Emplea negritas para resaltar conceptos clave (sin abusar).
  </phase_3_production>
  <phase_4_quality_check>
    Asegura que el tono sea consistente y que NO existan alucinaciones fuera de los documentos proporcionados.
  </phase_4_quality_check>
</execution_protocol>

<output_trigger>
  Si has recibido los archivos adjuntos, procede a generar la respuesta siguiendo la <task_directive>.
</output_trigger>`.trim();
};

// --- 1. GENERADOR DE TESIS (El Estratega) ---
export const generateTheses = async (sources: Source[], instruction: string): Promise<Thesis[]> => {
  const ai = getClient();
  const context = buildContextBlock(sources);
  const modelId = 'gemini-3-flash-preview';

  const prompt = `
    Actúa como un Tutor de Universidad Senior.
    Analiza las siguientes fuentes y la instrucción del alumno.
    <library>${context || "Conocimiento General"}</library>
    <instruction>${instruction || "Analizar el tema principal"}</instruction>
    
    TU TAREA: Propón 3 enfoques (Tesis) académicos sólidos.
    SALIDA: JSON Array válido. [{ "id": "1", "angle": "Crítico", "title": "...", "description": "..." }]
  `;

  try {
    const resp = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJsonOutput(resp.text || "[]")) as Thesis[];
  } catch (e) {
    console.error("Error tesis:", e);
    return [];
  }
};

// --- 2. GENERADOR DE ÍNDICE (El Arquitecto - Solo para textos largos) ---
const generateOutline = async (sources: Source[], instruction: string, thesis: Thesis | null, options: RedactionOptions): Promise<string[]> => {
  const ai = getClient();
  const context = buildContextBlock(sources);
  const sectionsCount = options.length === Length.THESIS ? "8-12" : "5-7";
  
  const prompt = `
    Actúa como Arquitecto de Contenidos Académicos.
    TAREA: Crea un ÍNDICE ESTRUCTURADO (Outline) para un trabajo de longitud: ${options.length}.
    Debe tener aprox ${sectionsCount} secciones principales.
    
    TEMA: ${instruction}
    TESIS CENTRAL: ${thesis ? thesis.title : "N/A"}
    ESTRUCTURA: ${options.structure}
    CONTEXTO: <library>${context.slice(0, 10000)}</library>

    SALIDA: Solo devuelve un JSON Array de strings con los títulos.
    Ej: ["Introducción", "Capítulo 1: Historia", "Capítulo 2: Análisis", "Conclusión"]
  `;

  try {
    const resp = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Flash es excelente para estructuras
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(cleanJsonOutput(resp.text || "[]"));
  } catch (e) {
    console.error("Error outline:", e);
    return ["Introducción", "Desarrollo", "Conclusión"];
  }
};

// --- 3. PIPELINE PRINCIPAL DE REDACCIÓN ---
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
  const selectedModel = options.model || ModelId.GEMINI_3_PRO;
  
  // Decisión de Estrategia
  const isModular = options.length === Length.LONG || options.length === Length.THESIS;

  if (isModular) {
    return generateModularRedaction(ai, selectedModel, sources, instruction, options, selectedThesis, onChunk, onReset);
  } else {
    return generateSinglePassRedaction(ai, selectedModel, sources, instruction, options, selectedThesis, onChunk, onReset);
  }
};

// --- ESTRATEGIA A: SINGLE PASS (Textos Cortos/Medios) ---
const generateSinglePassRedaction = async (
    ai: GoogleGenAI, 
    model: string,
    sources: Source[],
    instruction: string, 
    options: RedactionOptions,
    selectedThesis: Thesis | null,
    onChunk: StreamCallback,
    onReset: ResetCallback
): Promise<string> => {
    
    const context = buildContextBlock(sources);
    const { thinkingBudget, maxOutputTokens } = getModelConfig(options.length);

    // Prompt unificado
    const prompt = `
      Actúa como Estudiante de Doctorado.
      OBJETIVO: Escribir un trabajo académico impecable.
      
      Configuración:
      - Tono: ${options.tone}
      - Formato: ${options.format}
      - Tesis: ${selectedThesis?.title || "N/A"}
      ${options.styleGuide ? `⚠️ ESTILO OBLIGATORIO: ${options.styleGuide}` : ""}
      
      Instrucción: ${instruction}
      Fuentes: ${context}
    `;

    // Configuración Thinking
    const config: any = { maxOutputTokens, temperature: 0.7 };
    if (model.includes('gemini-3') || model.includes('gemini-2.5')) {
       config.thinkingConfig = { thinkingBudget };
    }

    let fullText = '';
    
    // Paso 1: Redacción
    const draftResp = await ai.models.generateContentStream({
      model: model,
      contents: prompt,
      config: config
    });

    for await (const chunk of draftResp) {
      const t = (chunk as GenerateContentResponse).text || '';
      fullText += t;
      if (!options.criticMode) onChunk(t);
    }

    // Paso 2 (Opcional): Crítico / Tutor
    if (options.criticMode) {
        onReset();
        onChunk(fullText); // Restaurar texto original visualmente
        onChunk("\n\n_👨‍🏫 El Tutor Virtual está revisando el texto..._\n\n");
        
        const critiquePrompt = `
           Actúa como Profesor. Revisa este texto.
           Si es bueno, no cambies nada. Si hay errores lógicos o de tono, corrígelos.
           Añade al final: "--- 📝 INFORME DEL TUTOR ---" con 3 puntos clave.
           Texto: ${fullText}
        `;
        
        const critResp = await ai.models.generateContentStream({
            model: model, 
            contents: critiquePrompt
        });
        
        let improved = "";
        onReset();
        for await (const chunk of critResp) {
            const t = (chunk as GenerateContentResponse).text || '';
            improved += t;
            onChunk(t);
        }
        fullText = improved;
    }

    return fullText;
};

// --- ESTRATEGIA B: MODULAR (Textos Largos - Chain of Density) ---
const generateModularRedaction = async (
    ai: GoogleGenAI, 
    model: string,
    sources: Source[],
    instruction: string, 
    options: RedactionOptions,
    selectedThesis: Thesis | null,
    onChunk: StreamCallback,
    onReset: ResetCallback
): Promise<string> => {
    const context = buildContextBlock(sources);

    // 1. Arquitecto
    onChunk(`_🏗️ El Arquitecto está diseñando la estructura para un trabajo ${options.length}..._\n\n`);
    const outline = await generateOutline(sources, instruction, selectedThesis, options);
    onReset();

    let fullDocument = "";
    let previousContext = "Inicio del documento.";

    // 2. Constructor (Loop)
    for (let i = 0; i < outline.length; i++) {
        const sectionTitle = outline[i];
        
        onChunk(`\n\n## ${sectionTitle} \n\n`); // Renderizar título
        fullDocument += `## ${sectionTitle}\n\n`;

        const sectionPrompt = `
            ESTAMOS ESCRIBIENDO UN TRABAJO EXTENSO Y COHERENTE.
            
            ESTRUCTURA TOTAL: ${JSON.stringify(outline)}
            SECCIÓN AHORA: "${sectionTitle}"
            CONTEXTO PREVIO (Resumen): "${previousContext.slice(-3000)}"
            
            INSTRUCCIONES:
            1. Desarrolla ESTA sección en profundidad.
            2. Usa Markdown.
            3. ${options.includeCrossReferences ? "Cita fuentes (Autor, Año)." : ""}
            4. Tono: ${options.tone}.
            ${options.styleGuide ? `5. ⚠️ ESTILO: ${options.styleGuide}` : ""}
            
            FUENTES DISPONIBLES:
            ${context}
        `;

        // Usamos el modelo seleccionado. Si es 'gemini-3-pro', usaremos thinking moderado por sección.
        const config: any = { maxOutputTokens: 8192 }; // Tokens suficientes por sección
        if (model.includes('gemini-3') || model.includes('gemini-2.5')) {
             config.thinkingConfig = { thinkingBudget: 2048 }; // Thinking moderado por capítulo
        }

        let sectionText = "";
        try {
            const resp = await ai.models.generateContentStream({
                model: model,
                contents: sectionPrompt,
                config: config
            });

            for await (const chunk of resp) {
                const t = (chunk as GenerateContentResponse).text || '';
                sectionText += t;
                onChunk(t);
            }
        } catch (e) {
            onChunk(`\n_[Error generando sección ${sectionTitle}. Continuando...]_`);
        }

        fullDocument += sectionText + "\n\n";
        previousContext += `\nResumen de ${sectionTitle}: ` + sectionText.slice(0, 500) + "..."; // Acumulamos contexto
    }

    // 3. Cierre (Si hay modo crítico, añadimos un informe final, no reescribimos todo para no gastar infinito)
    if (options.criticMode) {
        onChunk("\n\n_👨‍🏫 Generando Informe Final del Tutor..._\n\n");
        const reportPrompt = `Genera un breve informe académico evaluando la estructura y contenido de este trabajo. Título: INFORME FINAL.`;
        const report = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: reportPrompt });
        const text = report.text || "";
        onChunk(text);
        fullDocument += "\n\n" + text;
    }

    return fullDocument;
};

// --- UTILS ADICIONALES ---
export const generateOptimizedPrompt = async (sources: Source[], instruction: string): Promise<string> => {
  const ai = getClient();
  const prompt = `Mejora esta instrucción académica: "${instruction}". Hazla detallada y estructurada.`;
  const resp = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
  return resp.text?.trim() || instruction;
};

export const generateStyleGuide = async (samples: string[]): Promise<string> => {
  const ai = getClient();
  const prompt = `Analiza estilo: ${samples.join('\n')}. Crea prompt de sistema para imitarlo.`;
  const resp = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt });
  return resp.text || "";
};