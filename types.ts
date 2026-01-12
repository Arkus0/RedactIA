export enum Tone {
  ACADEMIC = 'Académico (Universitario)', 
  PROFESSIONAL = 'Profesional',
  PERSUASIVE = 'Persuasivo / Argumentativo',
  CRITICAL = 'Crítico / Analítico'
}

export enum Length {
  SHORT = 'Breve (~500 palabras)',
  MEDIUM = 'Estándar (~1500 palabras)',
  LONG = 'Extenso (~3000 palabras)',
  THESIS = 'Trabajo Final (~5000+ palabras)'
}

export enum Format {
  ESSAY = 'Ensayo Académico',
  REPORT = 'Informe de Investigación',
  LITERATURE_REVIEW = 'Revisión Bibliográfica',
  CRITICAL_ANALYSIS = 'Análisis Crítico'
}

export enum StructureType {
  STANDARD = 'Estándar (Intro - Desarrollo - Conclusión)',
  THESIS_DRIVEN = 'Dinámica (Basada en la Tesis)',
  COMPARATIVE = 'Comparativa (Bloque a Bloque)'
}

export enum ModelId {
  GEMINI_3_FLASH = 'gemini-3-flash-preview',
  GEMINI_3_PRO = 'gemini-3-pro-preview',
  GEMINI_2_FLASH = 'gemini-2.0-flash'
}

export type AppMode = 'ARCHITECT' | 'HUMANIZER';

export interface Thesis {
  id: string;
  title: string;
  description: string;
  angle: 'Analítico' | 'Crítico' | 'Comparativo' | 'Innovador';
}

export interface RedactionOptions {
  model: ModelId;
  tone: Tone;
  length: Length;
  format: Format;
  structure: StructureType;
  includeCrossReferences: boolean;
  personalStyleMode: boolean;
  criticMode: boolean;
  userStyle?: string; 
  styleGuide?: string;
}

export interface StyleSample {
  id: string;
  content: string;
  type: 'email' | 'essay' | 'chat' | 'other';
}

export interface Source {
  id: string;
  name: string;
  content: string; // Base64 string for PDFs, plain text for text inputs
  mimeType: 'application/pdf' | 'text/plain'; // Nuevo campo para diferenciar nativamente
}

export interface HistoryItem {
  id: string;
  userInstruction: string;
  generatedText: string;
  options: RedactionOptions;
  timestamp: number;
}