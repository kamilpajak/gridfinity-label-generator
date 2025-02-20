export const mmToPx = (mm: number): number => mm * 3.779527559; // 96 DPI conversion

export const validateWidth = (value: string | number): number => {
  let newValue = typeof value === "string" ? parseInt(value) : value;
  if (isNaN(newValue)) newValue = 55;
  if (newValue < 40) newValue = 40;
  if (newValue > 100) newValue = 100;
  return newValue;
};

export function computeDynamicFontSize(
  ctx: CanvasRenderingContext2D,
  desiredHeight: number,
  text: string,
  fontFamily: string,
): number {
  let fontSize = desiredHeight;
  ctx.font = `900 ${fontSize}px "${fontFamily}", sans-serif`;
  const metrics = ctx.measureText(text);

  // Adjust font size to match desired height
  const actualHeight =
    metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  if (actualHeight !== 0) {
    fontSize = (desiredHeight / actualHeight) * fontSize;
  }

  return Math.round(fontSize);
}
