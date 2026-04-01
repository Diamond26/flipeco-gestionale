'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

interface ChartColors {
  grid: string
  tick: string
  axis: string
  dotStroke: string
}

const LIGHT: ChartColors = {
  grid: '#CCD0D5',
  tick: '#9CA3AF',
  axis: '#CCD0D5',
  dotStroke: '#ffffff',
}

const DARK: ChartColors = {
  grid: '#2a2f38',
  tick: '#6b7280',
  axis: '#2a2f38',
  dotStroke: '#1a1d24',
}

export function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme()
  const [colors, setColors] = useState<ChartColors>(LIGHT)

  useEffect(() => {
    setColors(resolvedTheme === 'dark' ? DARK : LIGHT)
  }, [resolvedTheme])

  return colors
}
