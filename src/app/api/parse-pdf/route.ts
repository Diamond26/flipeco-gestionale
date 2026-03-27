import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nessun file caricato' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const data = new Uint8Array(buffer)

    const parser = new PDFParse({ data })
    const result = await parser.getText()

    if (!result.text || result.text.trim().length < 100) {
      return NextResponse.json(
        { error: 'Il PDF sembra essere una scansione (testo insufficiente). Convertilo in formato testuale.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ text: result.text })
  } catch (error) {
    console.error('Errore parsing PDF:', error)
    return NextResponse.json({ error: 'Errore nel parsing del PDF' }, { status: 500 })
  }
}
