import { computeDynamicFontSize, mmToPx } from "../utils/measurements";

async function ensureFontsLoaded() {
  try {
    await Promise.all([
      document.fonts.load('900 16px "Noto Sans"'),
      document.fonts.load('900 16px "Oswald"')
    ]);
  } catch (error) {
    console.error("Failed to load fonts:", error);
  }
}

export function getLabelTexts(
  selectedType: string,
  selectedSystem: string,
  threadSize: string,
  length: string,
  hardwareStandard: string,
  notes: string,
  showStandardName: boolean
): { topText: string; bottomText: string } {
  let topText: string;
  if (selectedType === "Screw" && length) {
    topText =
      selectedSystem === "Metric"
        ? `${threadSize} × ${length}`
        : `${threadSize} × ${length}″`;
  } else {
    topText = threadSize || "Default top text";
  }

  // If toggle is off, skip standard name.
  let bottomText: string;
  if (showStandardName) {
    bottomText = hardwareStandard
      ? notes
        ? `${hardwareStandard} ${notes}`
        : hardwareStandard
      : "Default bottom text";
  } else {
    bottomText = notes || "";
  }

  return { topText, bottomText };
}

export async function generateLabel(
  standardImgUrl: string,
  topText: string,
  bottomText: string,
  labelWidthMm: number,
  showImage: boolean
): Promise<string | null> {
  // Ensure fonts are loaded before generating the label
  await ensureFontsLoaded();

  // Load the image first
  const standardImg = new Image();
  standardImg.crossOrigin = "anonymous";
  
  try {
    await new Promise((resolve, reject) => {
      standardImg.onload = resolve;
      standardImg.onerror = () => {
        console.error("Failed to load image:", standardImgUrl);
        resolve(null); // Resolve with null instead of rejecting to handle missing images gracefully
      };
      standardImg.src = standardImgUrl;
    });
  } catch (error) {
    console.error("Failed to load DIN image:", error);
    return null;
  }

  // Label: fixed height 10mm, width = (labelWidthMm - 4mm margins)
  const labelHeightPx = mmToPx(10);
  const effectiveLabelWidthMm = labelWidthMm - 4;
  const labelWidthPx = mmToPx(effectiveLabelWidthMm);

  const canvas = document.createElement("canvas");
  canvas.width = labelWidthPx;
  canvas.height = labelHeightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("Could not get canvas context.");
    return null;
  }

  // Fill background with white
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, labelWidthPx, labelHeightPx);

  // Set gap between image and text (default 2mm)
  let gapPx = mmToPx(2);
  const textPadding = 10; // additional padding for text measurement

  // If image is disabled, set gap to 0
  if (!showImage) {
    gapPx = 0;
  }

  // Set text mode: single line if bottom text is empty
  const isSingleLine = bottomText.trim() === "";
  // Each line has maximum height of 4mm
  const desiredTextHeight = mmToPx(4);

  // Calculate text sizes with given height
  let topFontSize = computeDynamicFontSize(ctx, desiredTextHeight, topText, "Noto Sans");
  ctx.font = `900 ${topFontSize}px "Noto Sans", serif`;
  let topMetrics = ctx.measureText(topText);

  let bottomMetrics;
  let bottomFontSize = 0;
  if (!isSingleLine) {
    bottomFontSize = computeDynamicFontSize(ctx, desiredTextHeight, bottomText, "Oswald");
    ctx.font = `900 ${bottomFontSize}px "Oswald", sans-serif`;
    bottomMetrics = ctx.measureText(bottomText);
  }

  const measuredTextWidth = isSingleLine
    ? topMetrics.width
    : Math.max(topMetrics.width, bottomMetrics?.width || 0);
  const textAreaWidthNeeded = measuredTextWidth + textPadding;

  // Calculate available area for image
  let availableForImage = showImage ? labelWidthPx - gapPx - textAreaWidthNeeded : 0;
  if (availableForImage < 0) {
    availableForImage = 0;
    gapPx = 0;
  }

  // Calculate image size (if it should be drawn)
  let drawnImgWidth = 0;
  let drawnImgHeight = 0;
  if (showImage && standardImg.complete && standardImg.naturalWidth > 0) {
    const aspectRatio = standardImg.naturalWidth / standardImg.naturalHeight;
    drawnImgHeight = labelHeightPx;
    drawnImgWidth = Math.round(labelHeightPx * aspectRatio);
    if (drawnImgWidth > availableForImage) {
      drawnImgWidth = availableForImage;
      drawnImgHeight = Math.round(availableForImage / aspectRatio);
    }
    // Draw image, vertically centered
    const imgY = (labelHeightPx - drawnImgHeight) / 2;
    ctx.drawImage(standardImg, 0, imgY, drawnImgWidth, drawnImgHeight);
  }

  // Text area starts after image (if image is displayed) or from left edge
  const textAreaX = showImage ? drawnImgWidth + gapPx : 0;
  const textAreaWidth = labelWidthPx - textAreaX;

  ctx.fillStyle = "black";
  ctx.textBaseline = "alphabetic";

  if (isSingleLine) {
    // Single line mode: scale text to fit available space
    if (topMetrics.width > textAreaWidth) {
      const scaleFactor = textAreaWidth / topMetrics.width;
      topFontSize *= scaleFactor;
      ctx.font = `900 ${topFontSize}px "Noto Sans", serif`;
      topMetrics = ctx.measureText(topText);
    }
    const topTextX = textAreaX + (textAreaWidth - topMetrics.width) / 2;
    // Center vertically the entire line (within label)
    const verticalOffset = (labelHeightPx - desiredTextHeight) / 2;
    const baseline = verticalOffset + topMetrics.actualBoundingBoxAscent;
    ctx.fillText(topText, topTextX, baseline);
  } else {
    // Two line mode
    let topFontSizeLine = computeDynamicFontSize(ctx, desiredTextHeight, topText, "Noto Sans");
    ctx.font = `900 ${topFontSizeLine}px "Noto Sans", serif`;
    topMetrics = ctx.measureText(topText);
    if (topMetrics.width > textAreaWidth) {
      const scaleFactor = textAreaWidth / topMetrics.width;
      topFontSizeLine *= scaleFactor;
      ctx.font = `900 ${topFontSizeLine}px "Noto Sans", serif`;
      topMetrics = ctx.measureText(topText);
    }
    const topTextX = textAreaX + (textAreaWidth - topMetrics.width) / 2;
    // Top line: set baseline so top edge touches top edge
    const topBaseline = topMetrics.actualBoundingBoxAscent;
    ctx.fillText(topText, topTextX, topBaseline);

    let bottomFontSizeLine = computeDynamicFontSize(ctx, desiredTextHeight, bottomText, "Oswald");
    ctx.font = `900 ${bottomFontSizeLine}px "Oswald", sans-serif`;
    bottomMetrics = ctx.measureText(bottomText);
    if (bottomMetrics.width > textAreaWidth) {
      const scaleFactor = textAreaWidth / bottomMetrics.width;
      bottomFontSizeLine *= scaleFactor;
      ctx.font = `900 ${bottomFontSizeLine}px "Oswald", sans-serif`;
      bottomMetrics = ctx.measureText(bottomText);
    }
    const bottomTextX = textAreaX + (textAreaWidth - bottomMetrics.width) / 2;
    // Bottom line: set baseline so bottom edge touches bottom edge of label
    const bottomBaseline = labelHeightPx - bottomMetrics.actualBoundingBoxDescent;
    ctx.fillText(bottomText, bottomTextX, bottomBaseline);
  }

  return canvas.toDataURL("image/png");
}