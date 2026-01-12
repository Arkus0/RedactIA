// Eliminamos pdfjs-dist. Usamos la capacidad nativa Multimodal de Gemini.
// Esto soluciona problemas de OCR, doble columna, tablas y gráficos.

export const extractTextFromPdf = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      // El resultado es: "data:application/pdf;base64,JVBERi0xLjQK..."
      // Necesitamos extraer solo la parte base64
      const base64String = reader.result as string;
      const base64Content = base64String.split(',')[1];
      resolve(base64Content);
    };
    
    reader.onerror = (error) => reject(error);
    
    reader.readAsDataURL(file);
  });
};