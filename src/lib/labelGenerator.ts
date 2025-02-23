import {computeDynamicFontSize, mmToPx} from "~/utils/measurements";

/**
 * Loads required fonts before rendering.
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
 * Returns label texts (top and bottom) based on the provided parameters.
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
  let topText: string;
  if (selectedType === "Screw" && length) {
    if (selectedSystem === "Metric") {
      topText = `${threadSize} × ${length}`;
    } else {
      topText = `${threadSize} × ${length}″`;
    }
  } else {
    topText = threadSize || "Default top text";
  }

  let bottomText: string;
  if (showStandardName) {
    if (hardwareStandard) {
      if (notes) {
        bottomText = `${hardwareStandard} ${notes}`;
      } else {
        bottomText = hardwareStandard;
      }
    } else {
      bottomText = "Default bottom text";
    }
  } else {
    bottomText = notes || "";
  }

  return { topText, bottomText };
}

/**
 * Loads an image from a given URL. If the original image fails and the URL ends with .svg,
 * attempts to load a JPG fallback.
 */
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.crossOrigin = "anonymous";

  try {
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => {
        console.warn(`Failed to load image with original extension: ${url}`);
        resolve();
      };
      img.src = url;
    });

    if (img.complete && img.naturalWidth > 0) {
      return img;
    }

    if (url.toLowerCase().endsWith(".svg")) {
      const jpgUrl = url.replace(/\.svg$/i, ".jpg");
      const jpgImg = new Image();
      jpgImg.crossOrigin = "anonymous";

      await new Promise<void>((resolve) => {
        jpgImg.onload = () => resolve();
        jpgImg.onerror = () => {
          console.error(`Failed to load both SVG and JPG: ${url}`);
          resolve();
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
 * Measures text and scales it down if it exceeds maxWidth.
 * Returns an object with the final font size and measurement metrics.
 */
function measureAndScaleText(
  ctx: CanvasRenderingContext2D,
  text: string,
  desiredPxHeight: number,
  fontFamily: string,
  fontWeight: string,
  maxWidth: number,
) {
  let fontSize = computeDynamicFontSize(ctx, desiredPxHeight, text, fontFamily);
  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;
  let metrics = ctx.measureText(text);

  if (metrics.width > maxWidth) {
    const scaleFactor = maxWidth / metrics.width;
    fontSize *= scaleFactor;
    ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;
    metrics = ctx.measureText(text);
  }

  return { fontSize, metrics };
}

/**
 * Draws the image on the left side of the label while preserving its natural aspect ratio.
 * Limits the image width to a maximum of 40% of the label width.
 * Returns the total horizontal space occupied by the image plus a gap.
 */
function drawImageIfNeeded(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  labelWidthPx: number,
  labelHeightPx: number,
  gapPx: number,
  showImage: boolean,
): number {
  if (!showImage || !image) {
    return 0;
  }

  // Compute the natural aspect ratio of the image.
  const aspectRatio = image.naturalWidth / image.naturalHeight;

  // Calculate image width if drawn with full label height.
  const fullHeightWidth = Math.round(labelHeightPx * aspectRatio);

  // Maximum allowed image width: 40% of label width.
  const maxAllowedWidth = Math.floor(labelWidthPx * 0.4);

  let imageWidth: number, imageHeight: number;

  if (fullHeightWidth > maxAllowedWidth) {
    // Limit image width to the maximum allowed value.
    imageWidth = maxAllowedWidth;
    // Adjust height to maintain aspect ratio.
    imageHeight = Math.round(imageWidth / aspectRatio);
    // Optionally center the image vertically.
    const offsetY = Math.round((labelHeightPx - imageHeight) / 2);
    ctx.drawImage(image, 0, offsetY, imageWidth, imageHeight);
  } else {
    // Use full label height if the resulting width is within the limit.
    imageWidth = fullHeightWidth;
    imageHeight = labelHeightPx;
    ctx.drawImage(image, 0, 0, imageWidth, imageHeight);
  }

  return imageWidth + gapPx;
}

/**
 * Generates a label image as a PNG DataURL.
 * The image is drawn on the left at its natural aspect ratio,
 * and the remaining space is allocated for text.
 * In two-line mode, the top text is drawn so that its top edge touches the top of the label,
 * and the bottom text is drawn so that its bottom edge touches the bottom of the label.
 * Logs are added to output dimensions in millimeters.
 */
export async function generateLabel(
  standardImgUrl: string,
  topText: string,
  bottomText: string,
  labelWidthMm: number,
  showImage: boolean,
): Promise<string | null> {
  await ensureFontsLoaded();
  const standardImg = await loadImage(standardImgUrl);

  // Fixed label height in mm
  const labelHeightMm = 10;
  console.log(`Label width (mm): ${labelWidthMm}`);
  console.log(`Label height (mm): ${labelHeightMm}`);

  // Convert dimensions from mm to pixels
  const labelWidthPx = mmToPx(labelWidthMm);
  const labelHeightPx = mmToPx(labelHeightMm);
  const conversionFactor = labelWidthPx / labelWidthMm;
  console.log(`Conversion factor: ${conversionFactor.toFixed(2)} px/mm`);

  // Baseline text height and gap in mm
  const baselineTextHeight = 4;
  const baselineGap = 2;
  console.log(`Baseline text height (mm): ${baselineTextHeight}`);
  console.log(`Baseline gap (mm): ${baselineGap}`);

  // Compute gap in pixels (only if image is to be shown)
  const gapPx = showImage && standardImg ? mmToPx(baselineGap) : 0;
  console.log(`Computed gap (mm): ${(gapPx / conversionFactor).toFixed(2)}`);

  // Create canvas and fill background with white
  const canvas = document.createElement("canvas");
  canvas.width = labelWidthPx;
  canvas.height = labelHeightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.error("Could not get canvas context.");
    return null;
  }
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, labelWidthPx, labelHeightPx);

  // Draw image on the left and determine text area dimensions
  const imageUsedWidth = drawImageIfNeeded(
    ctx,
    standardImg,
    labelWidthPx,
    labelHeightPx,
    gapPx,
    showImage,
  );
  const imageUsedWidthMm = imageUsedWidth / conversionFactor;
  console.log(`Image used width (mm): ${imageUsedWidthMm.toFixed(2)}`);

  const textAreaX = imageUsedWidth;
  const textAreaWidth = labelWidthPx - textAreaX;
  console.log(
    `Text area starts at (mm): ${(textAreaX / conversionFactor).toFixed(2)}`,
  );
  console.log(
    `Text area width (mm): ${(textAreaWidth / conversionFactor).toFixed(2)}`,
  );

  // Set text color and baseline
  ctx.fillStyle = "black";
  ctx.textBaseline = "alphabetic";

  const desiredTextHeight = mmToPx(baselineTextHeight);
  const isSingleLine = bottomText.trim() === "";

  if (isSingleLine) {
    // Single-line mode: center text vertically
    const { fontSize, metrics } = measureAndScaleText(
      ctx,
      topText,
      desiredTextHeight,
      "Noto Sans",
      "900",
      textAreaWidth,
    );
    ctx.font = `900 ${fontSize}px "Noto Sans", serif`;
    const textX = textAreaX + (textAreaWidth - metrics.width) / 2;
    // Compute vertical center using "alphabetic" baseline.
    const textY =
      (labelHeightPx +
        metrics.actualBoundingBoxAscent -
        metrics.actualBoundingBoxDescent) /
      2;
    ctx.fillText(topText, textX, textY);
    console.log(
      `Single-line text dimensions (mm): width=${(metrics.width / conversionFactor).toFixed(2)}`,
    );
  } else {
    // Two-line mode: align top text to top edge and bottom text to bottom edge.
    // For top text: use "alphabetic" baseline and adjust Y so that actualBoundingBoxAscent equals 0.
    const topResult = measureAndScaleText(
      ctx,
      topText,
      desiredTextHeight,
      "Noto Sans",
      "900",
      textAreaWidth,
    );
    ctx.font = `900 ${topResult.fontSize}px "Noto Sans", serif`;
    const topX = textAreaX + (textAreaWidth - topResult.metrics.width) / 2;
    // Draw top text so that its top edge touches y = 0.
    // Using "alphabetic" baseline, the top edge is at y = actualBoundingBoxAscent.
    const topY = topResult.metrics.actualBoundingBoxAscent;
    ctx.fillText(topText, topX, topY);
    console.log(
      `Top text dimensions (mm): width=${(topResult.metrics.width / conversionFactor).toFixed(2)}`,
    );

    // For bottom text: use "alphabetic" baseline and adjust Y so that bottom edge touches y = labelHeightPx.
    const bottomResult = measureAndScaleText(
      ctx,
      bottomText,
      desiredTextHeight,
      "Oswald",
      "900",
      textAreaWidth,
    );
    ctx.font = `900 ${bottomResult.fontSize}px "Oswald", sans-serif`;
    const bottomX =
      textAreaX + (textAreaWidth - bottomResult.metrics.width) / 2;
    // Bottom edge should touch the bottom, so we position at:
    // y = labelHeightPx - actualBoundingBoxDescent
    const bottomY =
      labelHeightPx - bottomResult.metrics.actualBoundingBoxDescent;
    ctx.fillText(bottomText, bottomX, bottomY);
    console.log(
      `Bottom text dimensions (mm): width=${(bottomResult.metrics.width / conversionFactor).toFixed(2)}`,
    );
  }

  // Log final exported PNG dimensions in mm.
  console.log(
    `Exported PNG dimensions (mm): width=${labelWidthMm.toFixed(2)}mm, height=${labelHeightMm.toFixed(2)}mm`,
  );

  return canvas.toDataURL("image/png");
}
