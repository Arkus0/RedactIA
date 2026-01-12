import { GoogleGenAI } from "@google/genai";
import { RedactionOptions, Length, Source } from '../types';

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
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
  // Construimos el bloque de contexto con XML tags para que el modelo distinga fuentes de instrucciones
  const contextBlock = sources.map(s => `
  <document name="${s.name}">
    ${s.content}
  </document>
  `).join('\n');

  return `
    Actúa como un experto redactor e investigador analítico de clase mundial.
    
    TINES DOS PARTES DE INFORMACIÓN:
    1. <library>: Una colección de documentos y fuentes de información.
    2. <instruction>: La tarea específica que el usuario quiere realizar basándose en esa biblioteca.

    OBJETIVO:
    Generar un texto en formato "${options.format}" siguiendo las instrucciones del usuario, utilizando EXCLUSIVAMENTE la información proporcionada en la biblioteca como base factual, pero adaptando el estilo y estructura según lo solicitado.

    CONFIGURACIÓN:
    - Tono: ${options.tone}
    - Longitud Objetivo: ${options.length}
    - Idioma: Español.

    <library>
      ${contextBlock || "No hay fuentes adjuntas, usa tu conocimiento general si la instrucción lo permite."}
    </library>

    <instruction>
      ${instruction}
    </instruction>

    REGLAS:
    1. Cita implícitamente las fuentes si es necesario para dar autoridad, pero mantén la fluidez.
    2. Si la instrucción pide algo que no está en las fuentes, indícalo sutilmente o usa tu conocimiento general aclarando que es información externa (a menos que sea un texto creativo).
    3. Para longitudes "Largo" o "Extenso", planifica la estructura antes de escribir.
    4. Estrictamente respeta el formato Markdown para la salida.
  `;
};

export const generateRedaction = async (
  sources: Source[],
  instruction: string, 
  options: RedactionOptions
): Promise<string> => {
  const ai = getClient();
  const modelId = 'gemini-3-pro-preview';
  const { thinkingBudget, maxOutputTokens } = getModelConfig(options.length);

  const prompt = buildPrompt(sources, instruction, options);

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        maxOutputTokens: maxOutputTokens,
        thinkingConfig: { thinkingBudget: thinkingBudget },
        temperature: 0.7,
      }
    });

    return response.text || "No se pudo generar el texto. Inténtalo de nuevo.";
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

  // Resumimos las fuentes para el meta-prompt (no enviamos todo el contenido si es gigante, solo metadata o primeros 1k chars para contexto del prompt engineer)
  // Aunque Gemini 1.5/3 soporta mucho contexto, para el meta-prompt queremos que diseñe la estructura.
  const sourcesSummary = sources.map(s => `- Archivo: ${s.name} (Contenido disponible en el prompt final)`).join('\n');

  const metaPrompt = `
    Actúa como un Ingeniero de Prompts Senior (Prompt Engineer).

    TU TAREA:
    Analizar la solicitud del usuario y las fuentes disponibles para crear el "Prompt Maestro" perfecto que se le enviaría a una IA para realizar el trabajo.
    
    DATOS DEL USUARIO:
    - Fuentes Disponibles: 
      ${sourcesSummary}
    - Instrucción del Usuario: "${instruction}"
    - Configuración: Tono ${options.tone}, Formato ${options.format}, Longitud ${options.length}.

    SALIDA ESPERADA:
    Genera un bloque de código Markdown con un prompt altamente estructurado (usando técnicas como Chain of Thought, Few-Shot si aplica, y delimitadores XML).
    
    El prompt que generes debe tener esta estructura:
    1. <role_definition>
    2. <task_description>
    3. <style_guidelines>
    4. <input_data_placeholders> (Indica dónde irían los textos de los PDF)
    5. <step_by_step_instructions>

    No realices la redacción. SOLO ESCRIBE EL PROMPT OPTIMIZADO.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: metaPrompt,
      config: {
        thinkingConfig: { thinkingBudget: 2048 },
        temperature: 0.8,
      }
    });

    return response.text || "No se pudo generar el prompt.";
  } catch (error) {
    console.error("Error generating optimized prompt:", error);
    throw error;
  }
};