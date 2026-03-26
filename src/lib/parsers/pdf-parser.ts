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
  if (row.sku) name = name.replace(new RegExp(row.sku, 'i'), '')
  if (row.size) name = name.replace(new RegExp(`\\b${row.size}\\b`, 'i'), '')
  if (row.color) name = name.replace(new RegExp(`\\b${row.color}\\b`, 'i'), '')
  row.name = name.replace(/\s+/g, ' ').replace(/^[\s,;-]+|[\s,;-]+$/g, '').trim()

  // Solo se abbiamo almeno un campo significativo
  if (!row.barcode && !row.sku && !row.name) return null

  return row
}

export async function parsePDF(file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)

  // Dynamic import di pdf-parse (funziona solo lato client con workaround)
  // Per il parsing PDF usiamo un approccio basato su API route
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/parse-pdf', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Errore nel parsing del PDF')
  }

  const { text } = await response.json()

  const lines = text.split('\n').filter((l: string) => l.trim().length > 5)
  const rows: ParsedRow[] = []

  for (const line of lines) {
    const parsed = extractFieldsFromLine(line)
    if (parsed) {
      rows.push(parsed)
    }
  }

  const headers = ['barcode', 'sku', 'name', 'size', 'color']

  return { headers, rows }
}
