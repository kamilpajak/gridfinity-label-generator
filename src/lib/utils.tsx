// Convert millimeters to pixels.
export function mmToPx(mm: number, dpi: number = 360): number {
    const mmToInch = 25.4;
    return Math.round((mm / mmToInch) * dpi);
}

// Convert pixels to millimeters.
export function pxToMm(px: number, dpi: number = 360): number {
    return (px * 25.4) / dpi;
}

// Compute a dynamic font size so that effective text height ≈ desiredHeight.
export function computeDynamicFontSize(
    ctx: CanvasRenderingContext2D,
    desiredHeight: number,
    sampleText: string,
    fontFamily: string,
): number {
    const baseSize = desiredHeight;
    // Set temporary font for measurement.
    ctx.font = `900 ${baseSize}px "${fontFamily}", serif`;
    const metrics = ctx.measureText(sampleText);
    const effectiveHeight =
        metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    return effectiveHeight === 0 ? baseSize : baseSize * (desiredHeight / effectiveHeight);
}
