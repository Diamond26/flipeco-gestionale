import Papa from 'papaparse'

export interface ParsedRow {
  [key: string]: string
}

export function parseCSV(file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const headers = results.meta.fields || []
        const rows = results.data as ParsedRow[]
        resolve({ headers, rows })
      },
      error(error) {
        reject(new Error(`Errore parsing CSV: ${error.message}`))
      },
    })
  })
}
