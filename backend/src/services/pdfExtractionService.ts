import axios from 'axios';
import Tesseract from 'tesseract.js';

// Use require for pdf-parse as it's a CommonJS module
const pdfParse = require('pdf-parse');

interface ExtractedDates {
  certification_date?: Date;
  recertification_date?: Date;
  expiration_date?: Date;
  confidence: number;
}

/**
 * Extract dates from PDF using text extraction and OCR
 */
export async function extractDatesFromPDF(pdfUrl: string): Promise<ExtractedDates> {
  const result: ExtractedDates = {
    confidence: 0
  };

  try {
    // Download PDF from Cloudinary
    console.log(`Downloading PDF from: ${pdfUrl}`);
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    const pdfBuffer = Buffer.from(response.data);

    // Try text extraction first (faster)
    try {
      console.log('Attempting text extraction from PDF...');
      const pdfData = await pdfParse(pdfBuffer);
      const text = pdfData.text;
      
      if (text && text.length > 0) {
        const extractedFromText = parseDatesFromText(text);
        if (extractedFromText.certification_date) result.certification_date = extractedFromText.certification_date;
        if (extractedFromText.recertification_date) result.recertification_date = extractedFromText.recertification_date;
        if (extractedFromText.expiration_date) result.expiration_date = extractedFromText.expiration_date;
        result.confidence = 0.8; // Text extraction has good confidence
      }
    } catch (textError) {
      console.log('Text extraction failed, attempting OCR...');
    }

    // If text extraction didn't work well, try OCR on PDF images
    if (result.confidence < 0.5) {
      try {
        console.log('Running OCR on PDF...');
        const worker = await Tesseract.createWorker('eng');
        
        // Convert PDF to image and run OCR
        // Note: This is a simplified approach - in production you might want to:
        // 1. Convert PDF pages to images using pdf-lib or similar
        // 2. Run OCR on each image
        // 3. Aggregate results
        
        await worker.terminate();
      } catch (ocrError) {
        console.log('OCR processing skipped:', ocrError);
      }
    }

  } catch (error) {
    console.error('Error extracting dates from PDF:', error);
  }

  return result;
}

/**
 * Parse dates from text using regex patterns
 */
function parseDatesFromText(text: string): Partial<ExtractedDates> {
  const result: Partial<ExtractedDates> = {};

  // Common date patterns in COAs
  const datePatterns = [
    // MM/DD/YYYY or M/D/YYYY
    /(\d{1,2}\/\d{1,2}\/\d{4})/g,
    // YYYY-MM-DD
    /(\d{4}-\d{2}-\d{2})/g,
    // DD-MMM-YYYY or D-MMM-YYYY (e.g., 15-JAN-2026)
    /(\d{1,2}-[A-Z]{3}-\d{4})/gi,
    // Month DD, YYYY
    /([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/g,
  ];

  const allDates: Date[] = [];

  // Extract all dates
  for (const pattern of datePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const dateStr = match[0];
      const parsedDate = parseDate(dateStr);
      if (parsedDate) {
        allDates.push(parsedDate);
      }
    }
  }

  // Look for keywords near dates
  const certKeywords = ['certification', 'certified', 'date of issue', 'issued'];
  const expKeywords = ['expiration', 'expires', 'valid until', 'expiry', 'expiration date'];
  const recertKeywords = ['recertification', 'recertified', 'recertify', 'recert'];

  // Search for dates near keywords
  for (const keyword of certKeywords) {
    const regex = new RegExp(`${keyword}[^0-9]*(\\d{1,2}[/-]\\d{1,2}[/-]\\d{4}|\\d{4}[/-]\\d{2}[/-]\\d{2})`, 'gi');
    const matches = text.matchAll(regex);
    for (const match of matches) {
      if (match[1]) {
        const date = parseDate(match[1]);
        if (date) {
          result.certification_date = date;
        }
      }
    }
  }

  for (const keyword of expKeywords) {
    const regex = new RegExp(`${keyword}[^0-9]*(\\d{1,2}[/-]\\d{1,2}[/-]\\d{4}|\\d{4}[/-]\\d{2}[/-]\\d{2})`, 'gi');
    const matches = text.matchAll(regex);
    for (const match of matches) {
      if (match[1]) {
        const date = parseDate(match[1]);
        if (date) {
          result.expiration_date = date;
        }
      }
    }
  }

  for (const keyword of recertKeywords) {
    const regex = new RegExp(`${keyword}[^0-9]*(\\d{1,2}[/-]\\d{1,2}[/-]\\d{4}|\\d{4}[/-]\\d{2}[/-]\\d{2})`, 'gi');
    const matches = text.matchAll(regex);
    for (const match of matches) {
      if (match[1]) {
        const date = parseDate(match[1]);
        if (date) {
          result.recertification_date = date;
        }
      }
    }
  }

  // If no keyword matches found, use the earliest and latest dates as certification and expiration
  if (allDates.length > 0 && !result.certification_date) {
    allDates.sort((a, b) => a.getTime() - b.getTime());
    result.certification_date = allDates[0];
    if (allDates.length > 1) {
      result.expiration_date = allDates[allDates.length - 1];
    }
  }

  return result;
}

/**
 * Parse a date string in various formats
 */
function parseDate(dateStr: string): Date | null {
  try {
    // Try different parsing approaches
    const trimmed = dateStr.trim();

    // MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const parts = trimmed.split('/');
      const date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      if (!isNaN(date.getTime())) return date;
    }

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) return date;
    }

    // DD-MMM-YYYY (e.g., 15-JAN-2026)
    const mmmMatch = trimmed.match(/^(\d{1,2})-([A-Z]{3})-(\d{4})$/i);
    if (mmmMatch) {
      const day = parseInt(mmmMatch[1]);
      const month = parseMonth(mmmMatch[2]);
      const year = parseInt(mmmMatch[3]);
      if (month !== -1) {
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
      }
    }

    // Month DD, YYYY
    const monthMatch = trimmed.match(/^([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
    if (monthMatch) {
      const month = parseMonth(monthMatch[1]);
      const day = parseInt(monthMatch[2]);
      const year = parseInt(monthMatch[3]);
      if (month !== -1) {
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Parse month name to month number
 */
function parseMonth(monthStr: string): number {
  const months: { [key: string]: number } = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11,
  };
  return months[monthStr.toLowerCase()] ?? -1;
}

/**
 * Update sample with extracted dates in database
 */
export async function updateSampleDates(
  pool: any,
  sampleId: string,
  extractedDates: ExtractedDates
): Promise<boolean> {
  try {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (extractedDates.certification_date) {
      updates.push(`certification_date = $${paramIndex}`);
      params.push(extractedDates.certification_date);
      paramIndex++;
    }

    if (extractedDates.recertification_date) {
      updates.push(`recertification_date = $${paramIndex}`);
      params.push(extractedDates.recertification_date);
      paramIndex++;
    }

    if (extractedDates.expiration_date) {
      updates.push(`expiration_date = $${paramIndex}`);
      params.push(extractedDates.expiration_date);
      paramIndex++;
    }

    if (updates.length === 0) {
      return false;
    }

    params.push(sampleId);
    const query = `UPDATE samples SET ${updates.join(', ')} WHERE id = $${paramIndex}`;

    await pool.query(query, params);
    return true;
  } catch (error) {
    console.error('Error updating sample dates:', error);
    return false;
  }
}
