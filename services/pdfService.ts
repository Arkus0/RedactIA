import * as pdfjsLib from 'pdfjs-dist';

// Configurar el worker para pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

export const extractTextFromPdf = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      let pageText = '';
      let lastY = null;
      
      // Iterar sobre los items de texto para reconstruir párrafos
      for (const item of textContent.items as any[]) {
        const text = item.str;
        // Saltar items vacíos para no romper párrafos innecesariamente
        if (!text || text.trim().length === 0) continue;

        // item.transform[5] es la coordenada Y
        const currentY = item.transform[5];
        
        // Si hay un cambio significativo en Y, es una nueva línea
        if (lastY !== null && Math.abs(currentY - lastY) > 8) { // Aumentado umbral para evitar saltos en subíndices
          pageText += '\n';
        } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
          // Si estamos en la misma línea visual, añadimos espacio si no lo tiene
          pageText += ' ';
        }
        
        pageText += text;
        lastY = currentY;
      }
      
      fullText += `--- Página ${i} ---\n${pageText}\n\n`;
    }
    
    return fullText;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error("No se pudo leer el archivo PDF. Asegúrate de que no esté protegido por contraseña o dañado.");
  }
};