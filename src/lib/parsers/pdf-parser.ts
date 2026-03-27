export interface ParsedRow {
  [key: string]: string
}

// Regex patterns per riconoscere i campi dai PDF dei fornitori
const BARCODE_PATTERN = /\b(\d{8,13})\b/
const SKU_PATTERN = /\b([A-Z]{2,4}[-_]?\d{3,10})\b/i

const SIZE_KEYWORDS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL',
  '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '48', '50', '52', '54', '56',
  'UNICA', 'TU', 'OS']

const COLOR_KEYWORDS = [
  'NERO', 'BIANCO', 'ROSSO', 'BLU', 'VERDE', 'GIALLO', 'ARANCIONE', 'VIOLA', 'ROSA',
  'GRIGIO', 'MARRONE', 'BEIGE', 'AZZURRO', 'CELESTE', 'BORDEAUX', 'PANNA', 'CREMA',
  'NAVY', 'MILITARE', 'FUCSIA', 'CORALLO', 'TURCHESE', 'INDACO', 'LILLA', 'SENAPE',
  'BLACK', 'WHITE', 'RED', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'PURPLE', 'PINK',
  'GREY', 'GRAY', 'BROWN', 'CREAM', 'IVORY', 'KHAKI', 'OLIVE', 'CAMEL', 'TAUPE',
]

function extractFieldsFromLine(line: string): ParsedRow | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length < 5) return null

  // Skip lines that look like headers, footers, page numbers, or noise
  if (/^(page|pagina|pag\.?)\s*\d/i.test(trimmed)) return null
  if (/^(totale|subtotale|iva|imposta|sconto|spedizione)/i.test(trimmed)) return null
  if (/^\d+\s*[/\-]\s*\d+\s*[/\-]\s*\d+$/.test(trimmed)) return null
  if (/^[\s\-_=*#.]+$/.test(trimmed)) return null
  const lowerTrimmed = trimmed.toLowerCase()
  if (lowerTrimmed.startsWith('tel') || lowerTrimmed.startsWith('fax') || lowerTrimmed.startsWith('email')) return null
  if (/^(p\.?\s*iva|c\.?\s*f\.?|cod\.?\s*fisc)/i.test(trimmed)) return null

  const row: ParsedRow = {
    barcode: '',
    sku: '',
    name: '',
    size: '',
    color: '',
  }

  // Estrai barcode
  const barcodeMatch = trimmed.match(BARCODE_PATTERN)
  if (barcodeMatch) {
    row.barcode = barcodeMatch[1]
  }

  // Estrai SKU
  const skuMatch = trimmed.match(SKU_PATTERN)
  if (skuMatch && skuMatch[1] !== row.barcode) {
    row.sku = skuMatch[1]
  }

  // Estrai taglia
  const upperLine = trimmed.toUpperCase()
  for (const size of SIZE_KEYWORDS) {
    const sizeRegex = new RegExp(`\\b${size}\\b`, 'i')
    if (sizeRegex.test(upperLine)) {
      row.size = size
      break
    }
  }

  // Estrai colore
  for (const color of COLOR_KEYWORDS) {
    const colorRegex = new RegExp(`\\b${color}\\b`, 'i')
    if (colorRegex.test(upperLine)) {
      row.color = color
      break
    }
  }

  // Il resto diventa il nome (rimuovi barcode/sku/taglia/colore trovati)
  let name = trimmed
  if (row.barcode) name = name.replace(row.barcode, '')
  if (row.sku) name = name.replace(new RegExp(row.sku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
  if (row.size) name = name.replace(new RegExp(`\\b${row.size}\\b`, 'i'), '')
  if (row.color) name = name.replace(new RegExp(`\\b${row.color}\\b`, 'i'), '')
  // Remove leftover prices (e.g. €12.50, 12,50)
  name = name.replace(/€?\s*\d+[.,]\d{2}\b/g, '')
  row.name = name.replace(/\s+/g, ' ').replace(/^[\s,;:\-–—]+|[\s,;:\-–—]+$/g, '').trim()

  // Solo se abbiamo almeno un campo significativo
  if (!row.barcode && !row.sku && !row.name) return null

  return row
}

export async function parsePDF(file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  // Validate file before sending
  if (!file || file.size === 0) {
    throw new Error('Il file PDF è vuoto o non valido.')
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Il file PDF è troppo grande (max 20 MB).')
  }

  const formData = new FormData()
  formData.append('file', file)

  let response: Response
  try {
    response = await fetch('/api/parse-pdf', {
      method: 'POST',
      body: formData,
    })
  } catch {
    throw new Error(
      'Impossibile connettersi al server per il parsing del PDF. Verifica la connessione e riprova.'
    )
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const serverMsg = body?.error || ''
    throw new Error(
      serverMsg
        ? `Errore nel parsing del PDF: ${serverMsg}`
        : `Errore nel parsing del PDF (codice ${response.status}). Il file potrebbe essere protetto, danneggiato o in un formato non supportato.`
    )
  }

  let text: string
  try {
    const body = await response.json()
    text = body?.text ?? ''
  } catch {
    throw new Error('Risposta non valida dal server durante il parsing del PDF.')
  }

  if (!text || text.trim().length < 10) {
    throw new Error(
      'Il PDF non contiene testo estraibile. Potrebbe essere un PDF composto solo da immagini (scansione). ' +
      'Prova a convertirlo in un formato testuale (CSV/Excel) prima di importarlo.'
    )
  }

  const lines = text.split('\n').filter((l: string) => l.trim().length > 5)
  const rows: ParsedRow[] = []

  for (const line of lines) {
    const parsed = extractFieldsFromLine(line)
    if (parsed) {
      rows.push(parsed)
    }
  }

  if (rows.length === 0) {
    throw new Error(
      `Il parsing del PDF non ha prodotto righe di prodotti valide. ` +
      `Sono state analizzate ${lines.length} righe di testo, ma nessuna corrisponde al formato atteso. ` +
      `Verifica che il file contenga un elenco prodotti con barcode, nome, taglia o colore.`
    )
  }

  const headers = ['barcode', 'sku', 'name', 'size', 'color']

  return { headers, rows }
}
