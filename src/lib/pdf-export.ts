import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

interface ExportOptions {
  title: string
  headers: string[]
  rows: (string | number)[][]
  filename: string
}

export function exportToPDF({ title, headers, rows, filename }: ExportOptions) {
  const doc = new jsPDF()

  // Header con brand
  doc.setFillColor(123, 179, 95) // #7BB35F
  doc.rect(0, 0, 210, 30, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Flip&Co', 14, 15)

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(title, 14, 24)

  // Data
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(9)
  const now = new Date().toLocaleString('it-IT')
  doc.text(`Generato il ${now}`, 210 - 14, 24, { align: 'right' })

  // Tabella
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 38,
    theme: 'grid',
    headStyles: {
      fillColor: [123, 179, 95],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [245, 246, 247],
    },
    styles: {
      cellPadding: 4,
    },
  })

  doc.save(`${filename}.pdf`)
}
