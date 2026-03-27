export interface ParsedRow {
  [key: string]: string
}

// Regex patterns per riconoscere i campi dai PDF
const BARCODE_PATTERN = /\b(\d{8,13})\b/
const SKU_PATTERN = /\b([A-Z0-9]{2,6}[-_]?\d{3,10})\b/i

const SIZE_KEYWORDS = [
  'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL',
  '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '48', '50', '52', '54', '56',
  'UNICA', 'TU', 'OS'
]

const COLOR_KEYWORDS = [
  'NERO', 'BIANCO', 'ROSSO', 'BLU', 'VERDE', 'GIALLO', 'ARANCIONE', 'VIOLA', 'ROSA',
  'GRIGIO', 'MARRONE', 'BEIGE', 'AZZURRO', 'CELESTE', 'BORDEAUX', 'PANNA', 'CREMA',
  'NAVY', 'MILITARE', 'FUCSIA', 'CORALLO', 'TURCHESE', 'INDACO', 'LILLA', 'SENAPE',
  'BLACK', 'WHITE', 'RED', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'PURPLE', 'PINK',
  'GREY', 'GRAY', 'BROWN', 'CREAM', 'IVORY', 'KHAKI', 'OLIVE', 'CAMEL', 'TAUPE'
]

// Pattern per codici colore alfanumerici brevi (2-5 char) accanto al nome colore
// Cattura pattern come "NERO 900", "BLU/001", "ROSSO-A2"
const COLOR_CODE_PATTERN = /\b([A-Z0-9]{2,5})\b/i

/**
 * Dato un testo che contiene un colore, separa il nome colore dal codice colore.
 * Es: "NERO 900" -> { color: 'NERO', colorCode: '900' }
 *     "BLU"      -> { color: 'BLU',  colorCode: '' }
 */
function splitColorAndCode(text: string): { color: string; colorCode: string } {
  const upper = text.trim().toUpperCase()

  for (const color of COLOR_KEYWORDS) {
    const regex = new RegExp(`\\b${color}\\b`, 'i')
    if (regex.test(upper)) {
      // Togli il nome colore e vedi se rimane un codice
      const remainder = upper.replace(regex, '').replace(/[\s/\-_.,]+/g, ' ').trim()
      let colorCode = ''
      if (remainder.length >= 1 && remainder.length <= 5 && COLOR_CODE_PATTERN.test(remainder)) {
        colorCode = remainder
      }
      return { color, colorCode }
    }
  }

  // Nessun nome colore trovato — tutta la stringa potrebbe essere un codice
  const trimmed = text.trim()
  if (trimmed.length >= 1 && trimmed.length <= 5 && /^[A-Z0-9]+$/i.test(trimmed)) {
    return { color: '', colorCode: trimmed }
  }

  return { color: text.trim(), colorCode: '' }
}

function extractFieldsWithScore(line: string): ParsedRow | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length < 5) return null

  // Filtri rumore
  if (/^(page|pagina|pag\.?)\s*\d/i.test(trimmed)) return null
  if (/^(totale|subtotale|iva|imposta|sconto|spedizione|importo)/i.test(trimmed)) return null
  if (/^\d+\s*[/\-]\s*\d+\s*[/\-]\s*\d+$/.test(trimmed)) return null
  if (/^[\s\-_=*#.]+$/.test(trimmed)) return null
  const lowerTrimmed = trimmed.toLowerCase()
  if (lowerTrimmed.startsWith('tel') || lowerTrimmed.startsWith('fax') || lowerTrimmed.startsWith('email')) return null
  if (/^(p\.?\s*iva|c\.?\s*f\.?|cod\.?\s*fisc)/i.test(trimmed)) return null

  const row: ParsedRow = { barcode: '', sku: '', name: '', size: '', color: '', color_code: '' }
  let score = 0

  // 1. Tabular Awareness: prova a splittare per multipli spazi o tab
  const columns = trimmed.split(/\s{2,}|\t/).filter(c => c.trim().length > 0)

  if (columns.length >= 3) {
    // Probabile struttura a tabella
    score += 2
    for (const col of columns) {
      if (!row.barcode && BARCODE_PATTERN.test(col)) {
        row.barcode = col.match(BARCODE_PATTERN)?.[1] || ''
        score += 2
      } else if (!row.sku && SKU_PATTERN.test(col)) {
        row.sku = col.match(SKU_PATTERN)?.[1] || ''
      } else if (!row.size && SIZE_KEYWORDS.some(k => new RegExp(`\\b${k}\\b`, 'i').test(col))) {
        row.size = col.trim()
        score += 1
      } else if (!row.color && COLOR_KEYWORDS.some(k => new RegExp(`\\b${k}\\b`, 'i').test(col))) {
        const { color, colorCode } = splitColorAndCode(col)
        row.color = color
        row.color_code = colorCode
        score += 1
      } else if (!row.name && col.length > 3 && !/^\d+[.,]?\d*$/.test(col)) {
        row.name = col.trim()
      }
    }
  } else {
    // 2. Pattern Matching testuale fallback
    const barcodeMatch = trimmed.match(BARCODE_PATTERN)
    if (barcodeMatch) {
      row.barcode = barcodeMatch[1]
      score += 2
    }

    const skuMatch = trimmed.match(SKU_PATTERN)
    if (skuMatch && skuMatch[1] !== row.barcode) {
      row.sku = skuMatch[1]
    }

    const upperLine = trimmed.toUpperCase()
    for (const size of SIZE_KEYWORDS) {
      if (new RegExp(`\\b${size}\\b`, 'i').test(upperLine)) {
        row.size = size
        score += 1
        break
      }
    }

    for (const color of COLOR_KEYWORDS) {
      if (new RegExp(`\\b${color}\\b`, 'i').test(upperLine)) {
        row.color = color
        score += 1
        // Cerca un codice colore adiacente (es: "NERO 900")
        const colorIdx = upperLine.indexOf(color)
        const after = upperLine.slice(colorIdx + color.length).trim()
        const codeBefore = upperLine.slice(0, colorIdx).trim()
        // Cerca prima dopo, poi prima del nome colore
        const codeMatch = after.match(/^[\s/\-_]*([A-Z0-9]{1,5})\b/i) || codeBefore.match(/\b([A-Z0-9]{1,5})[\s/\-_]*$/i)
        if (codeMatch && codeMatch[1] !== row.barcode && codeMatch[1] !== row.sku && codeMatch[1] !== row.size) {
          row.color_code = codeMatch[1]
        }
        break
      }
    }

    // Ricava il nome dal rimanente
    let tempName = trimmed
    if (row.barcode) tempName = tempName.replace(row.barcode, '')
    if (row.sku) tempName = tempName.replace(row.sku, '')
    if (row.size) tempName = tempName.replace(new RegExp(`\\b${row.size}\\b`, 'i'), '')
    if (row.color) tempName = tempName.replace(new RegExp(`\\b${row.color}\\b`, 'i'), '')
    if (row.color_code) tempName = tempName.replace(new RegExp(`\\b${row.color_code}\\b`, 'i'), '')
    
    // Pulisci i prezzi rimasti
    tempName = tempName.replace(/€?\s*\d+[.,]\d{2}\b/g, '')
    row.name = tempName.replace(/\s+/g, ' ').replace(/^[\s,;:\-–—]+|[\s,;:\-–—]+$/g, '').trim()
  }

  // Bonus puntaggio se c'è un nome molto descrittivo
  if (row.name.length > 5) score += 1

  // Filtriamo: deve avere almeno un punteggio di affidabilità decente
  // es: ha un barcode (score=2), oppure nome lungo + colore (score >= 2), ecc.
  if (score < 2) return null

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
    const parsed = extractFieldsWithScore(line)
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

  const headers = ['barcode', 'sku', 'name', 'size', 'color', 'color_code']

  return { headers, rows }
}
