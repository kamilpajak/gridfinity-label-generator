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

    // Ustal wymiary etykiety: stała wysokość 10mm, a szerokość etykiety to (labelWidthMm - 4mm marginesów)
    const labelHeightPx = mmToPx(10);
    const effectiveLabelWidthMm = labelWidthMm - 4; // marginesy: 2mm z lewej i prawej
    const labelWidthPx = mmToPx(effectiveLabelWidthMm);

    // Utwórz canvas.
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

    // Ustal stały gap między obrazkiem a obszarem tekstowym – domyślnie 2mm.
    let gapPx = mmToPx(2);
    const textPadding = 10; // dodatkowy padding przy pomiarze szerokości tekstu

    // Ustal tryb: jeśli dolny tekst jest pusty, to tryb jednoliniowy, inaczej dwuliniowy.
    const isSingleLine = bottomText.trim() === "";
    // Docelowa wysokość tekstu (dla każdej linii) wynosi 4mm niezależnie od trybu.
    const desiredTextHeight = mmToPx(4);

    // Oblicz rozmiary tekstu przy zadanej docelowej wysokości.
    // Dla górnego tekstu:
    let topFontSize = computeDynamicFontSize(ctx, desiredTextHeight, topText, "Noto Sans");
    ctx.font = `900 ${topFontSize}px "Noto Sans", serif`;
    let topMetrics = ctx.measureText(topText);
    // Dla dolnego tekstu, jeśli tryb dwuliniowy:
    let bottomMetrics;
    let bottomFontSize = 0;
    if (!isSingleLine) {
        bottomFontSize = computeDynamicFontSize(ctx, desiredTextHeight, bottomText, "Oswald");
        ctx.font = `900 ${bottomFontSize}px "Oswald", sans-serif`;
        bottomMetrics = ctx.measureText(bottomText);
    }

    // Szerokość wymaganego obszaru tekstowego = max(szerokość górnego, dolnego tekstu) + padding.
    const measuredTextWidth = isSingleLine
        ? topMetrics.width
        : Math.max(topMetrics.width, bottomMetrics!.width);
    const textAreaWidthNeeded = measuredTextWidth + textPadding;

    // Oblicz dostępny obszar na obrazek: cała szerokość etykiety minus gap i wymagana szerokość tekstu.
    let availableForImage = labelWidthPx - gapPx - textAreaWidthNeeded;
    // Upewnij się, że nie jest ujemny.
    if (availableForImage < 0) {
        availableForImage = 0;
        gapPx = 0;
    }

    // Oblicz rozmiar obrazka:
    // Domyślnie obrazek ma być rysowany na pełną wysokość etykiety (labelHeightPx)
    // i jego szerokość = labelHeightPx * aspectRatio.
    const aspectRatio = standardImg.naturalWidth / standardImg.naturalHeight;
    let drawnImgHeight = labelHeightPx;
    let drawnImgWidth = Math.round(labelHeightPx * aspectRatio);
    // Jeśli szerokość obrazka przekracza dostępny obszar, skaluj proporcjonalnie.
    if (drawnImgWidth > availableForImage) {
        drawnImgWidth = availableForImage;
        drawnImgHeight = Math.round(availableForImage / aspectRatio);
    }

    // Narysuj obrazek: centrowany pionowo w wyznaczonym obszarze.
    const imgY = (labelHeightPx - drawnImgHeight) / 2;
    ctx.drawImage(standardImg, 0, imgY, drawnImgWidth, drawnImgHeight);

    // Obszar tekstowy zaczyna się na prawo od obrazka (z gapem).
    const textAreaX = drawnImgWidth + gapPx;
    const textAreaWidth = labelWidthPx - textAreaX;

    ctx.fillStyle = "black";
    ctx.textBaseline = "alphabetic";

    if (isSingleLine) {
        // Tryb jednoliniowy: mamy tylko górny tekst o docelowej wysokości 4mm.
        if (topMetrics.width > textAreaWidth) {
            const scaleFactor = textAreaWidth / topMetrics.width;
            topFontSize *= scaleFactor;
            ctx.font = `900 ${topFontSize}px "Noto Sans", serif`;
            topMetrics = ctx.measureText(topText);
        }
        // Wycentruj poziomo w obszarze tekstowym.
        const topTextX = textAreaX + (textAreaWidth - topMetrics.width) / 2;
        // Wycentruj pionowo całą linię tekstu w etykiecie.
        const verticalOffset = (labelHeightPx - desiredTextHeight) / 2;
        const baseline = verticalOffset + topMetrics.actualBoundingBoxAscent;
        ctx.fillText(topText, topTextX, baseline);
    } else {
        // Tryb dwuliniowy: każda linia ma docelową wysokość 4mm.
        // Górna linia (Noto Sans):
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
        // Ustaw baseline tak, aby górna krawędź tekstu stykała się z górną krawędzią etykiety.
        const topBaseline = topMetrics.actualBoundingBoxAscent;
        ctx.fillText(topText, topTextX, topBaseline);

        // Dolna linia (Oswald):
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
        // Ustaw baseline dolnego tekstu tak, aby dolna krawędź dotykała dolnej krawędzi etykiety.
        const bottomBaseline = labelHeightPx - bottomMetrics.actualBoundingBoxDescent;
        ctx.fillText(bottomText, bottomTextX, bottomBaseline);
    }

    return canvas.toDataURL("image/png");
}
