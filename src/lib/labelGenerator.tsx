// file: src/lib/labelGenerator.tsx
import {computeDynamicFontSize, mmToPx} from "./utils";

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

    return {topText, bottomText};
}

export function drawLabel(
    standardImg: HTMLImageElement | null,
    topText: string,
    bottomText: string,
    labelWidthMm: number,
    showImage: boolean
): string | null {
    if (!standardImg) {
        console.error("No DIN image available, cannot draw label.");
        return null;
    }

    // Etykieta: stała wysokość 10mm, szerokość = (labelWidthMm - 4mm marginesów)
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

    // Wypełnij tło białym kolorem.
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, labelWidthPx, labelHeightPx);

    // Ustal gap między obrazkiem a tekstem (domyślnie 2mm).
    let gapPx = mmToPx(2);
    const textPadding = 10; // dodatkowy padding przy pomiarze tekstu

    // Jeśli obrazek ma być wyłączony, ustaw gap na 0.
    if (!showImage) {
        gapPx = 0;
    }

    // Ustal tryb tekstowy: jednoliniowy jeśli dolny tekst jest pusty.
    const isSingleLine = bottomText.trim() === "";
    // Każda linia ma maksymalną wysokość 4mm.
    const desiredTextHeight = mmToPx(4);

    // Oblicz rozmiary tekstu przy zadanej wysokości.
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
        : Math.max(topMetrics.width, bottomMetrics!.width);
    const textAreaWidthNeeded = measuredTextWidth + textPadding;

    // Oblicz dostępny obszar na obrazek.
    let availableForImage = showImage ? labelWidthPx - gapPx - textAreaWidthNeeded : 0;
    if (availableForImage < 0) {
        availableForImage = 0;
        gapPx = 0;
    }

    // Oblicz rozmiar obrazka (jeśli ma być rysowany).
    let drawnImgWidth = 0;
    let drawnImgHeight = 0;
    if (showImage) {
        const aspectRatio = standardImg.naturalWidth / standardImg.naturalHeight;
        drawnImgHeight = labelHeightPx;
        drawnImgWidth = Math.round(labelHeightPx * aspectRatio);
        if (drawnImgWidth > availableForImage) {
            drawnImgWidth = availableForImage;
            drawnImgHeight = Math.round(availableForImage / aspectRatio);
        }
        // Narysuj obrazek, centrowany pionowo.
        const imgY = (labelHeightPx - drawnImgHeight) / 2;
        ctx.drawImage(standardImg, 0, imgY, drawnImgWidth, drawnImgHeight);
    }

    // Obszar tekstowy zaczyna się po obrazie (jeśli obrazek jest wyświetlony) lub od lewej krawędzi.
    const textAreaX = showImage ? drawnImgWidth + gapPx : 0;
    const textAreaWidth = labelWidthPx - textAreaX;

    ctx.fillStyle = "black";
    ctx.textBaseline = "alphabetic";

    if (isSingleLine) {
        // Tryb jednoliniowy: skalujemy tekst, by mieścił się w dostępnej przestrzeni.
        if (topMetrics.width > textAreaWidth) {
            const scaleFactor = textAreaWidth / topMetrics.width;
            topFontSize *= scaleFactor;
            ctx.font = `900 ${topFontSize}px "Noto Sans", serif`;
            topMetrics = ctx.measureText(topText);
        }
        const topTextX = textAreaX + (textAreaWidth - topMetrics.width) / 2;
        // Wycentruj pionowo całą linię (w obrębie etykiety).
        const verticalOffset = (labelHeightPx - desiredTextHeight) / 2;
        const baseline = verticalOffset + topMetrics.actualBoundingBoxAscent;
        ctx.fillText(topText, topTextX, baseline);
    } else {
        // Tryb dwuliniowy.
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
        // Górna linia: baseline ustawiamy tak, aby górna krawędź dotykała górnej krawędzi.
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
        // Dolna linia: baseline ustawiamy tak, aby dolna krawędź dotykała dolnej krawędzi etykiety.
        const bottomBaseline = labelHeightPx - bottomMetrics.actualBoundingBoxDescent;
        ctx.fillText(bottomText, bottomTextX, bottomBaseline);
    }

    return canvas.toDataURL("image/png");
}
