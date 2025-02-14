// file: src/lib/labelGenerator.tsx
import {computeDynamicFontSize, mmToPx} from "./utils";

// Generate top and bottom label texts based on form values.
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

    // If switch is off, pomijamy nazwę standardu.
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

    return {topText, bottomText};
}

// Draw the label on a canvas and return a data URL.
// Draw the label on a canvas and return a data URL.
// Draw the label on a canvas and return a data URL.
export function drawLabel(
    standardImg: HTMLImageElement | null,
    topText: string,
    bottomText: string,
    labelWidthMm: number
): string | null {
    if (!standardImg) {
        console.error("No DIN image available, cannot draw label.");
        return null;
    }

    // Define label dimensions.
    const labelHeightPx = mmToPx(10);
    const effectiveLabelWidthMm = labelWidthMm - 4; // subtract margins (2mm left/right)
    const labelWidthPx = mmToPx(effectiveLabelWidthMm);

    const canvas = document.createElement("canvas");
    canvas.width = labelWidthPx;
    canvas.height = labelHeightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error("Could not get canvas context.");
        return null;
    }

    // Draw white background.
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, labelWidthPx, labelHeightPx);

    // Calculate desired text height (for both texts) in normal mode.
    const normalDesiredTextHeight = mmToPx(4.5);

    // Calculate required text width for image positioning.
    const textPadding = 10;
    ctx.font = `900 ${normalDesiredTextHeight}px "Noto Sans", serif`;
    const topMetricsNormal = ctx.measureText(topText);
    ctx.font = `900 ${normalDesiredTextHeight}px "Oswald", sans-serif`;
    const bottomMetricsNormal = ctx.measureText(bottomText);
    const neededTextWidth = Math.max(topMetricsNormal.width, bottomMetricsNormal.width) + textPadding;

    // Gap between image and text area (2mm).
    const gapPx = mmToPx(2);
    const availableForImage = labelWidthPx - gapPx - neededTextWidth;

    let drawnImgWidth = 0;
    let drawnImgHeight = 0;
    if (availableForImage > 0) {
        const aspectRatio = standardImg.naturalWidth / standardImg.naturalHeight;
        const idealImgWidth = labelHeightPx * aspectRatio;
        if (idealImgWidth <= availableForImage) {
            drawnImgWidth = Math.round(idealImgWidth);
            drawnImgHeight = labelHeightPx;
        } else {
            drawnImgWidth = availableForImage;
            drawnImgHeight = Math.round(availableForImage / aspectRatio);
        }
        const imgY = (labelHeightPx - drawnImgHeight) / 2;
        ctx.drawImage(standardImg, 0, imgY, drawnImgWidth, drawnImgHeight);
    } else {
        console.warn("Not enough space for image, prioritizing text area.");
    }

    // Text area is to the right of the image.
    const textAreaX = drawnImgWidth > 0 ? drawnImgWidth + gapPx : 0;
    const textAreaWidth = labelWidthPx - textAreaX;

    ctx.fillStyle = "black";
    ctx.textBaseline = "alphabetic";

    // If additional notes (or standard name) are not shown, use expanded mode for top text.
    if (bottomText.trim() === "") {
        // Używamy większej docelowej wysokości tekstu (np. 8mm) dla górnego tekstu.
        const expandedDesiredTextHeight = mmToPx(8);
        let topFontSize = computeDynamicFontSize(ctx, expandedDesiredTextHeight, topText, "Noto Sans");
        ctx.font = `900 ${topFontSize}px "Noto Sans", serif`;
        let topMetrics = ctx.measureText(topText);

        // Jeśli szerokość tekstu przekracza obszar przeznaczony na tekst, zmniejszamy czcionkę.
        if (topMetrics.width > textAreaWidth) {
            const scaleFactor = textAreaWidth / topMetrics.width;
            topFontSize = topFontSize * scaleFactor;
            ctx.font = `900 ${topFontSize}px "Noto Sans", serif`;
            topMetrics = ctx.measureText(topText);
        }

        // Wycentruj poziomo w obszarze tekstowym.
        const topTextX = textAreaX + (textAreaWidth - topMetrics.width) / 2;
        // Wycentruj pionowo względem całego labelu.
        const baseline = (labelHeightPx + topMetrics.actualBoundingBoxAscent - topMetrics.actualBoundingBoxDescent) / 2;
        ctx.fillText(topText, topTextX, baseline);
    } else {
        // Standardowy tryb – rysujemy górny i dolny tekst oddzielnie.
        // Top text (Noto Sans)
        const topFontSize = computeDynamicFontSize(ctx, normalDesiredTextHeight, topText, "Noto Sans");
        ctx.font = `900 ${topFontSize}px "Noto Sans", serif`;
        const topMetrics = ctx.measureText(topText);
        const topTextX = textAreaX + (textAreaWidth - topMetrics.width) / 2;
        const topBaselineY = topMetrics.actualBoundingBoxAscent;
        ctx.fillText(topText, topTextX, topBaselineY);

        // Bottom text (Oswald)
        const bottomFontSize = computeDynamicFontSize(ctx, normalDesiredTextHeight, bottomText, "Oswald");
        ctx.font = `900 ${bottomFontSize}px "Oswald", sans-serif`;
        const bottomMetrics = ctx.measureText(bottomText);
        const bottomTextX = textAreaX + (textAreaWidth - bottomMetrics.width) / 2;
        const bottomBaselineY = labelHeightPx - bottomMetrics.actualBoundingBoxDescent;
        ctx.fillText(bottomText, bottomTextX, bottomBaselineY);
    }

    return canvas.toDataURL("image/png");
}
