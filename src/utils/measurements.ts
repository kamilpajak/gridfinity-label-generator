export const mmToPx = (mm: number): number => mm * 14.173228346 // 360 DPI conversion

export const validateWidth = (value: string | number): number => {
  let newValue = typeof value === 'string' ? parseInt(value) : value
  if (isNaN(newValue)) newValue = 55
  if (newValue < 37) newValue = 37
  if (newValue > 100) newValue = 100
  return newValue
}

export const validateHeight = (value: string | number): number => {
  const allowedHeights = [9, 12, 18, 24]

  if (value === null || value === undefined) {
    return 12 // Default value
  }

  let newValue = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(newValue)) {
    return 12 // Default value
  }

  // Find the closest allowed height
  const closest = allowedHeights.reduce(
    (prev, curr) => (Math.abs(curr - newValue) < Math.abs(prev - newValue) ? curr : prev),
    allowedHeights[0]
  )

  return closest
}

export const validateTextSize = (value: string | number): number => {
  let newValue = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(newValue)) newValue = 100
  if (newValue < 50) newValue = 50
  if (newValue > 150) newValue = 150
  return Math.round(newValue) // Round to nearest integer percent
}

export function computeDynamicFontSize(
  ctx: CanvasRenderingContext2D,
  desiredHeight: number,
  text: string,
  fontFamily: string
): number {
  let fontSize = desiredHeight
  ctx.font = `900 ${fontSize}px "${fontFamily}", sans-serif`
  const metrics = ctx.measureText(text)

  // Adjust font size to match desired height
  const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
  if (actualHeight !== 0) {
    fontSize = (desiredHeight / actualHeight) * fontSize
  }

  return Math.round(fontSize)
}
