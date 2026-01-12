export enum Tone {
  PROFESSIONAL = 'Profesional',
  ACADEMIC = 'Académico',
  CREATIVE = 'Creativo',
  CASUAL = 'Informal',
  CONCISE = 'Conciso',
  PERSUASIVE = 'Persuasivo'
}

export enum Length {
  SHORT = 'Corto (~300 palabras)',
  MEDIUM = 'Medio (~1000 palabras)',
  LONG = 'Largo (~2500 palabras)',
  EXTENSIVE = 'Extenso (~5000 palabras)'
}

export enum Format {
  ESSAY = 'Ensayo',
  ARTICLE = 'Artículo de Blog',
  EMAIL = 'Correo Electrónico',
  SUMMARY = 'Resumen Ejecutivo',
  STORY = 'Narrativa'
}

export interface RedactionOptions {
  tone: Tone;
  length: Length;
  format: Format;
}

export interface Source {
  id: string;
  name: string;
  content: string;
  type: 'pdf' | 'text';
}

export interface HistoryItem {
  id: string;
  userInstruction: string;
  generatedText: string;
  options: RedactionOptions;
  timestamp: number;
}