import Papa from 'papaparse'

export interface ParsedRow {
  [key: string]: string
}

export function parseCSV(file: File, hasHeader: boolean = true): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: hasHeader,
      skipEmptyLines: true,
      complete(results) {
        if (hasHeader) {
          const headers = results.meta.fields || []
          const rows = results.data as ParsedRow[]
          resolve({ headers, rows })
        } else {
          const data = results.data as string[][]
          if (data.length === 0) {
            resolve({ headers: [], rows: [] })
            return
          }
          const maxCols = Math.max(...data.map(r => r.length))
          const headers = Array.from({ length: maxCols }, (_, i) => `Colonna ${i + 1}`)
          const rows = data.map(rowArray => {
            const row: ParsedRow = {}
            for (let i = 0; i < headers.length; i++) {
              row[headers[i]] = rowArray[i] ?? ''
            }
            return row
          })
          resolve({ headers, rows })
        }
      },
      error(error) {
        reject(new Error(`Errore parsing CSV: ${error.message}`))
      },
    })
  })
}
