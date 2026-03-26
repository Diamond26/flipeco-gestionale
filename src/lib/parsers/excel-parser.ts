import * as XLSX from 'xlsx'

export interface ParsedRow {
  [key: string]: string
}

export function parseExcel(file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: '' })

        if (jsonData.length === 0) {
          resolve({ headers: [], rows: [] })
          return
        }

        const headers = Object.keys(jsonData[0])
        const rows = jsonData.map((row) => {
          const cleanRow: ParsedRow = {}
          for (const key of headers) {
            cleanRow[key] = String(row[key] ?? '')
          }
          return cleanRow
        })

        resolve({ headers, rows })
      } catch (err) {
        reject(new Error(`Errore parsing Excel: ${err}`))
      }
    }
    reader.onerror = () => reject(new Error('Errore lettura file'))
    reader.readAsArrayBuffer(file)
  })
}
