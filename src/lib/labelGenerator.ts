import {computeDynamicFontSize, mmToPx} from "~/utils/measurements";

/**
 * Ensures that required fonts are loaded.
 */
async function ensureFontsLoaded(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('900 16px "Noto Sans"'),
      document.fonts.load('900 16px "Oswald"'),
    ]);
  } catch (error) {
    console.error("Failed to load fonts:", error);
  }
}

/**
 * Returns label texts based on provided parameters.
 */
export function getLabelTexts(
  selectedType: string,
  selectedSystem: string,
  threadSize: string,
  length: string,
  hardwareStandard: string,
  notes: string,
  showStandardName: boolean,
): { topText: string; bottomText: string } {
  let topText = "Default top text";
  let bottomText: string;

  // Decide topText based on selectedType and length
  if (selectedType === "Screw" && length) {
    topText =
      selectedSystem === "Metric"
        ? `${threadSize} × ${length}`
        : `${threadSize} × ${length}″`;
  } else if (threadSize) {
    topText = threadSize;
  }

  // Decide bottomText based on showStandardName flag and provided texts
  if (!showStandardName) {
    bottomText = notes || "";
  } else if (notes && hardwareStandard) {
    bottomText = `${hardwareStandard} ${notes}`;
  } else if (notes) {
    bottomText = "Default bottom text";
  } else {
    bottomText = hardwareStandard || "Default bottom text";
  }

  return { topText, bottomText };
}

/**
 * Loads an image from the given URL. If the image is an SVG and fails to load,
 * attempts to load a JPG fallback.
 */
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.crossOrigin = "anonymous";

  try {
    // Attempt to load the original image
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = () => {
        console.warn(`Failed to load image with original extension: ${url}`);
        resolve(null);
      };
      img.src = url;
    });

    if (img.complete && img.naturalWidth > 0) {
      return img;
    }

    // If the original was an SVG, try loading a JPG fallback
    if (url.toLowerCase().endsWith(".svg")) {
      const jpgUrl = url.replace(/\.svg$/i, ".jpg");
      const jpgImg = new Image();
      jpgImg.crossOrigin = "anonymous";

      await new Promise((resolve) => {
        jpgImg.onload = resolve;
        jpgImg.onerror = () => {
          console.error(`Failed to load both SVG and JPG: ${url}`);
          resolve(null);
        };
        jpgImg.src = jpgUrl;
      });

      if (jpgImg.complete && jpgImg.naturalWidth > 0) {
        return jpgImg;
      }
    }

    return null;
  } catch (error) {
    console.error("Error loading image:", error);
    return null;
  }
}

/**
 * Helper to measure text and scale it down if it exceeds the max width.
 * Returns the final font size and measurement metrics.
 */
function measureAndScaleText(
  ctx: CanvasRenderingContext2D,
  text: string,
  desiredPxHeight: number,
  fontFamily: string,
  fontWeight: string,
  maxWidth: number,
) {
  // Compute initial font size
  let fontSize = computeDynamicFontSize(ctx, desiredPxHeight, text, fontFamily);
  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;
  let metrics = ctx.measureText(text);

  // Scale down if text exceeds maxWidth
  if (metrics.width > maxWidth) {
    const scaleFactor = maxWidth / metrics.width;
    fontSize *= scaleFactor;
    ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;
    metrics = ctx.measureText(text);
  }

  return { fontSize, metrics };
}

/**
 * Draws the image if available and required.
 * Returns the total horizontal space occupied by the image plus gap.
 */
function drawImageIfNeeded(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  labelWidthPx: number,
  labelHeightPx: number,
  gapPx: number,
  showImage: boolean,
): number {
  if (!showImage || !image) return 0;

  const aspectRatio = image.naturalWidth / image.naturalHeight;
  let drawnImgWidth = Math.round(labelHeightPx * aspectRatio);
  let drawnImgHeight = labelHeightPx;

  // Adjust size if image width exceeds available space
  if (drawnImgWidth > labelWidthPx - gapPx) {
    drawnImgWidth = labelWidthPx - gapPx;
    drawnImgHeight = Math.round(drawnImgWidth / aspectRatio);
  }

  // Center image vertically
  const imgY = (labelHeightPx - drawnImgHeight) / 2;
  ctx.drawImage(image, 0, imgY, drawnImgWidth, drawnImgHeight);

  return drawnImgWidth + gapPx;
}

/**
 * Generates a label image as a DataURL based on input parameters.
 */
export async function generateLabel(
  standardImgUrl: string,
  topText: string,
  bottomText: string,
  labelWidthMm: number,
  showImage: boolean,
): Promise<string | null> {
  // Ensure required fonts are loaded
  await ensureFontsLoaded();

  // Load the standard image
  const standardImg = await loadImage(standardImgUrl);

  // Calculate label dimensions (10mm height, width adjusted for 4mm margins)
  const labelHeightPx = mmToPx(10);
  const effectiveLabelWidthMm = labelWidthMm - 4;
  const labelWidthPx = mmToPx(effectiveLabelWidthMm);

  // Create canvas for label generation
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
  if (!showImage || !standardImg) {
    gapPx = 0;
  }

  // Draw image and calculate available text area
  const textAreaX = drawImageIfNeeded(
    ctx,
    standardImg,
    labelWidthPx,
    labelHeightPx,
    gapPx,
    showImage,
  );
  const textAreaWidth = labelWidthPx - textAreaX;

  ctx.fillStyle = "black";
  ctx.textBaseline = "alphabetic";

  const desiredTextHeight = mmToPx(4);
  const isSingleLine = bottomText.trim() === "";

  if (isSingleLine) {
    // Single-line text: measure, scale, and center the top text
    const { metrics: topMetrics } = measureAndScaleText(
      ctx,
      topText,
      desiredTextHeight,
      "Noto Sans",
      "900",
      textAreaWidth,
    );
    const xPos = textAreaX + (textAreaWidth - topMetrics.width) / 2;
    const verticalOffset = (labelHeightPx - desiredTextHeight) / 2;
    const baseline = verticalOffset + topMetrics.actualBoundingBoxAscent;
    ctx.fillText(topText, xPos, baseline);
  } else {
    // Two-line text: draw both top and bottom texts

    // Top line
    const { metrics: topMetrics } = measureAndScaleText(
      ctx,
      topText,
      desiredTextHeight,
      "Noto Sans",
      "900",
      textAreaWidth,
    );
    const topX = textAreaX + (textAreaWidth - topMetrics.width) / 2;
    const topBaseline = topMetrics.actualBoundingBoxAscent;
    ctx.fillText(topText, topX, topBaseline);

    // Bottom line
    const { metrics: bottomMetrics } = measureAndScaleText(
      ctx,
      bottomText,
      desiredTextHeight,
      "Oswald",
      "900",
      textAreaWidth,
    );
    const bottomX = textAreaX + (textAreaWidth - bottomMetrics.width) / 2;
    const bottomBaseline =
      labelHeightPx - bottomMetrics.actualBoundingBoxDescent;
    ctx.fillText(bottomText, bottomX, bottomBaseline);
  }

  return canvas.toDataURL("image/png");
}
