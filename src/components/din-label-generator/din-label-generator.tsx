// Utility function to convert millimeters to pixels.
function mmToPx(mm: number, dpi: number = 360): number {
    const mmToInch = 25.4;
    return Math.round((mm / mmToInch) * dpi);
}

// Utility function to convert pixels to millimeters.
function pxToMm(px: number, dpi: number = 360): number {
    return (px * 25.4) / dpi;
}

// Compute a dynamic font size so that effective text height ≈ desiredHeight
function computeDynamicFontSize(
    ctx: CanvasRenderingContext2D,
    desiredHeight: number,
    sampleText: string
): number {
    const baseSize = desiredHeight;
    ctx.font = `900 ${baseSize}px "Noto Sans", serif`;
    const metrics = ctx.measureText(sampleText);
    const effectiveHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    if (effectiveHeight === 0) {
        return baseSize;
    }
    return baseSize * (desiredHeight / effectiveHeight);
}

import {$, component$, useSignal, useVisibleTask$} from '@builder.io/qwik';
import {type DINStandard, dinStandards} from '~/data/din-standards';

export const DINLabelGenerator = component$(() => {
    // Signals for user inputs
    const selectedType = useSignal('Screw');
    const selectedSystem = useSignal('Metric');
    const threadSize = useSignal('');         // Top text (e.g., thread size)
    const hardwareStandard = useSignal('');   // Bottom text (np. "DIN 963")
    const notes = useSignal('');
    const standardImage = useSignal<HTMLImageElement | null>(null);
    const labelWidth = useSignal(55);          // Label width in mm
    const length = useSignal('');
    const isLoading = useSignal(false);
    const labelPreviewUrl = useSignal<string>('');

    const metricThreadSizes = ['M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M16', 'M20'];
    const imperialThreadSizes = ['#4', '#6', '#8', '#10', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"'];

    // Ładowanie obrazu DIN – wykonujemy to tylko po stronie klienta
    useVisibleTask$(({track}) => {
        track(() => hardwareStandard.value);
        track(() => selectedType.value);

        if (hardwareStandard.value) {
            isLoading.value = true;
            const img = new Image();
            const standardNumber = hardwareStandard.value.replace('DIN ', '').toLowerCase();
            const subfolder = selectedType.value.toLowerCase() + 's';
            const imageUrl = `/din/${subfolder}/din_${standardNumber}.png`;
            console.log("Loading DIN image from:", imageUrl);
            img.src = imageUrl;
            img.onload = () => {
                console.log("DIN image loaded successfully:", img.src);
                standardImage.value = img;
                isLoading.value = false;
            };
            img.onerror = () => {
                console.error("Error loading DIN image:", img.src);
                standardImage.value = null;
                isLoading.value = false;
            };
        } else {
            standardImage.value = null;
            isLoading.value = false;
        }
    });

    const drawLabel = $(
        (
            standardImg: HTMLImageElement | null,
            thread: string,
            hwStandard: string,
            labelWidthMm: number
        ): string | null => {
            // Log passed values
            console.log("drawLabel called with:", {
                standardImgExists: !!standardImg,
                thread,
                hwStandard,
                labelWidthMm,
            });

            if (!standardImg) {
                console.error("No DIN image available, cannot draw label.");
                return null;
            }

            // Fallback texts if needed
            const topText = thread || "Default top text";
            const bottomText = hwStandard || "Default bottom text";

            // Define label dimensions: height = 10mm, width as specified
            const labelHeightPx = mmToPx(10);
            const labelWidthPx = mmToPx(labelWidthMm);
            console.log(
                `Drawing label with dimensions: ${labelWidthPx}px (${pxToMm(labelWidthPx).toFixed(
                    2
                )}mm) x ${labelHeightPx}px (${pxToMm(labelHeightPx).toFixed(2)}mm)`
            );

            // Create canvas and context
            const canvas = document.createElement("canvas");
            canvas.width = labelWidthPx;
            canvas.height = labelHeightPx;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                console.error("Could not get canvas context.");
                return null;
            }

            // Draw white background
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, labelWidthPx, labelHeightPx);

            // Desired effective text height for each text line: 4.5mm
            const desiredTextHeight = mmToPx(4.5);

            // --- Compute dynamic font size for top text ---
            const topDynamicFontSize = computeDynamicFontSize(ctx, desiredTextHeight, topText);
            // Set font and measure top text metrics
            ctx.font = `900 ${topDynamicFontSize}px "Noto Sans", serif`;
            const topMetrics = ctx.measureText(topText);
            console.log(
                `Top text: font size ${topDynamicFontSize.toFixed(
                    2
                )}px, ascent = ${topMetrics.actualBoundingBoxAscent.toFixed(
                    2
                )}px, descent = ${topMetrics.actualBoundingBoxDescent.toFixed(2)}px`
            );

            // --- Compute dynamic font size for bottom text ---
            const bottomDynamicFontSize = computeDynamicFontSize(ctx, desiredTextHeight, bottomText);
            ctx.font = `900 ${bottomDynamicFontSize}px "Noto Sans", serif`;
            const bottomMetrics = ctx.measureText(bottomText);
            console.log(
                `Bottom text: font size ${bottomDynamicFontSize.toFixed(
                    2
                )}px, ascent = ${bottomMetrics.actualBoundingBoxAscent.toFixed(
                    2
                )}px, descent = ${bottomMetrics.actualBoundingBoxDescent.toFixed(2)}px`
            );

            // Calculate maximum horizontal space needed by texts (with some padding)
            const textPadding = 10; // additional horizontal padding in pixels
            const neededTextWidth = Math.max(topMetrics.width, bottomMetrics.width) + textPadding;

            // Constant gap between image and text area (if image is present)
            const gapPx = 1;
            // Calculate available width for the image
            const availableForImage = labelWidthPx - gapPx - neededTextWidth;
            console.log(
                `Available width for image: ${availableForImage}px (${pxToMm(availableForImage).toFixed(
                    2
                )}mm)`
            );

            // --- Draw DIN image (if space available) ---
            let drawnImgWidth = 0;
            let drawnImgHeight = 0;
            if (availableForImage > 0) {
                const naturalWidth = standardImg.naturalWidth;
                const naturalHeight = standardImg.naturalHeight;
                const aspectRatio = naturalWidth / naturalHeight;
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
                console.log(
                    "DIN image drawn with preserved aspect ratio:",
                    drawnImgWidth,
                    "x",
                    drawnImgHeight,
                    `(${pxToMm(drawnImgWidth).toFixed(2)}mm x ${pxToMm(drawnImgHeight).toFixed(2)}mm)`
                );
            } else {
                console.warn("Not enough space for image, prioritizing text area.");
            }

            // Calculate text area dimensions (to the right of the image)
            const textAreaX = drawnImgWidth > 0 ? drawnImgWidth + gapPx : 0;
            const textAreaWidth = labelWidthPx - textAreaX;
            console.log(
                "Text area starts at x =",
                textAreaX,
                `(${pxToMm(textAreaX).toFixed(2)}mm) with width = ${textAreaWidth}px (${pxToMm(
                    textAreaWidth
                ).toFixed(2)}mm)`
            );

            // --- Draw the texts with the desired vertical layout ---
            ctx.fillStyle = "black";
            ctx.textBaseline = "alphabetic";

            // Draw top text so that its top edge is at y = 0.
            // That is, set baseline = topMetrics.actualBoundingBoxAscent.
            ctx.font = `900 ${topDynamicFontSize}px "Noto Sans", serif`;
            const topTextX = textAreaX + (textAreaWidth - topMetrics.width) / 2;
            const topBaselineY = topMetrics.actualBoundingBoxAscent;
            ctx.fillText(topText, topTextX, topBaselineY);
            console.log("Top text drawn at: x =", topTextX, `, y = ${topBaselineY}px; text: "${topText}"`);

            // Log effective height of top text in mm
            const effectiveTopHeightPx = topMetrics.actualBoundingBoxAscent + topMetrics.actualBoundingBoxDescent;
            console.log(
                `Effective top text height: ${effectiveTopHeightPx}px (${pxToMm(effectiveTopHeightPx).toFixed(2)}mm)`
            );

            // Draw bottom text so that its bottom edge is at y = labelHeightPx.
            // That is, set baseline = labelHeightPx - bottomMetrics.actualBoundingBoxDescent.
            ctx.font = `900 ${bottomDynamicFontSize}px "Noto Sans", serif`;
            const bottomTextX = textAreaX + (textAreaWidth - bottomMetrics.width) / 2;
            const bottomBaselineY = labelHeightPx - bottomMetrics.actualBoundingBoxDescent;
            ctx.fillText(bottomText, bottomTextX, bottomBaselineY);
            console.log(
                "Bottom text drawn at: x =",
                bottomTextX,
                `, y = ${bottomBaselineY}px; text: "${bottomText}"`
            );

            // Log effective height of bottom text in mm
            const effectiveBottomHeightPx = bottomMetrics.actualBoundingBoxAscent + bottomMetrics.actualBoundingBoxDescent;
            console.log(
                `Effective bottom text height: ${effectiveBottomHeightPx}px (${pxToMm(effectiveBottomHeightPx).toFixed(2)}mm)`
            );

            // Rezultat:
            // Każda linia tekstu ma efektywną wysokość ~4.5mm.
            // Całkowita wysokość etykiety wynosi 10mm, więc przerwa pomiędzy liniami wynosi 10mm - 4.5mm - 4.5mm = 1mm.

            return canvas.toDataURL("image/png");
        }
    );

    // Aktualizacja podglądu etykiety – wykonywana po stronie klienta
    useVisibleTask$(async ({track}) => {
        track(() => standardImage.value);
        track(() => threadSize.value);
        track(() => hardwareStandard.value);
        track(() => labelWidth.value);

        console.log("Before drawing label, values are:", {
            thread: threadSize.value,
            hwStandard: hardwareStandard.value,
            labelWidth: labelWidth.value,
            standardImageExists: !!standardImage.value
        });

        await document.fonts.load(`900 57px "Noto Sans"`)
            .then(() => {
                console.log("Noto Sans loaded, redrawing canvas...");
            })
            .catch((err) => {
                console.error("Failed to load Noto Sans:", err);
            });

        const previewUrl = await drawLabel(
            standardImage.value,
            threadSize.value,
            hardwareStandard.value,
            labelWidth.value
        );
        if (previewUrl) {
            labelPreviewUrl.value = previewUrl;
            console.log("Label preview updated.");
        } else {
            labelPreviewUrl.value = '';
        }
    });

    // Generowanie etykiety do pobrania
    const generateLabel = $(async () => {
        const dataUrl = await drawLabel(
            standardImage.value,
            threadSize.value,
            hardwareStandard.value,
            labelWidth.value
        );
        if (!dataUrl) {
            console.error("Label generation failed: No valid label drawn.");
            return;
        }
        console.log("Label generated successfully, initiating download...");
        const link = document.createElement('a');
        link.download = `${hardwareStandard.value.toLowerCase().replace(' ', '_')}_label.png`;
        link.href = dataUrl;
        link.click();
    });

    const isFormValid = () => {
        const requiredFields = {
            threadSize: threadSize.value !== '',
            hardwareStandard: hardwareStandard.value !== '',
            length: selectedType.value === 'Screw' ? length.value !== '' : true,
        };
        return Object.values(requiredFields).every(Boolean);
    };

    // Dynamiczna kalkulacja wymiarów podglądu w pikselach
    const labelHeightPx = mmToPx(10);
    const labelWidthPx = mmToPx(labelWidth.value);

    return (
        <div class="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg">
            <div class="space-y-6">
                {/* Hardware Type */}
                <div>
                    <div class="text-sm font-medium text-gray-700 mb-2">Hardware Type</div>
                    <div class="grid grid-cols-3 gap-0 bg-white rounded-lg border border-gray-200 overflow-hidden">
                        {['Screw', 'Nut', 'Washer'].map((type) => (
                            <button
                                key={type}
                                onClick$={() => {
                                    console.log("Selected hardware type:", type);
                                    selectedType.value = type;
                                    hardwareStandard.value = '';
                                }}
                                class={{
                                    'py-3 px-4 text-center transition-colors font-medium': true,
                                    'bg-[#2D3748] text-white': selectedType.value === type,
                                    'bg-white text-gray-700 hover:bg-gray-50': selectedType.value !== type,
                                }}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Measurement System */}
                <div>
                    <div class="text-sm font-medium text-gray-700 mb-2">Measurement System</div>
                    <div class="grid grid-cols-2 gap-0 bg-white rounded-lg border border-gray-200 overflow-hidden">
                        {[
                            {value: 'Metric', label: 'Metric'},
                            {value: 'Imperial', label: 'Imperial'},
                        ].map((system) => (
                            <button
                                key={system.value}
                                onClick$={() => {
                                    console.log("Selected measurement system:", system.value);
                                    selectedSystem.value = system.value;
                                }}
                                class={{
                                    'py-3 px-4 text-center transition-colors font-medium': true,
                                    'bg-[#94A3B8] text-white': selectedSystem.value === system.value,
                                    'bg-white text-gray-700 hover:bg-gray-50': selectedSystem.value !== system.value,
                                }}
                            >
                                {system.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Thread Size */}
                <div>
                    <select
                        class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        value={threadSize.value}
                        onChange$={(e) => {
                            console.log("Selected thread size:", (e.target as HTMLSelectElement).value);
                            threadSize.value = (e.target as HTMLSelectElement).value;
                        }}
                    >
                        <option value="">Thread size...</option>
                        {(selectedSystem.value === 'Metric' ? metricThreadSizes : imperialThreadSizes).map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Length (for screws) */}
                {selectedType.value === 'Screw' && (
                    <div>
                        <input
                            type="text"
                            placeholder={`Length (e.g., 3/8", 10mm)`}
                            class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            value={length.value}
                            onInput$={(e) => {
                                console.log("Entered length:", (e.target as HTMLInputElement).value);
                                length.value = (e.target as HTMLInputElement).value;
                            }}
                        />
                    </div>
                )}

                {/* Hardware Standard */}
                <div>
                    <select
                        class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        value={hardwareStandard.value}
                        onChange$={(e) => {
                            console.log("Selected hardware standard:", (e.target as HTMLSelectElement).value);
                            hardwareStandard.value = (e.target as HTMLSelectElement).value;
                        }}
                    >
                        <option value="">Hardware standard...</option>
                        {dinStandards[selectedType.value.toLowerCase() as keyof typeof dinStandards].map(
                            (standard: DINStandard) => (
                                <option key={standard.value} value={standard.value}>
                                    {standard.text}
                                </option>
                            )
                        )}
                    </select>
                </div>

                {/* Additional Notes */}
                <div>
                    <input
                        type="text"
                        placeholder="Additional notes (optional)"
                        class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        value={notes.value}
                        onInput$={(e) => {
                            console.log("Entered additional notes:", (e.target as HTMLInputElement).value);
                            notes.value = (e.target as HTMLInputElement).value;
                        }}
                    />
                </div>

                {/* Label Width */}
                <div>
                    <div class="flex justify-between items-center mb-1">
                        <div class="text-sm text-gray-600">Label width</div>
                        <div class="flex items-center gap-2">
                            <input
                                type="number"
                                class="w-20 p-2 bg-white border border-gray-200 rounded text-right text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                value={labelWidth.value}
                                onInput$={(e) => {
                                    console.log("Set label width (number):", (e.target as HTMLInputElement).value);
                                    labelWidth.value = parseInt((e.target as HTMLInputElement).value) || 0;
                                }}
                            />
                            <span class="text-sm text-gray-600">mm</span>
                        </div>
                    </div>
                    <input
                        type="range"
                        min="20"
                        max="100"
                        value={labelWidth.value}
                        class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        onInput$={(e) => {
                            console.log("Set label width (range):", (e.target as HTMLInputElement).value);
                            labelWidth.value = parseInt((e.target as HTMLInputElement).value);
                        }}
                    />
                    <div class="text-xs text-gray-500">Label height is 10mm - perfect for 12mm tape labels</div>
                </div>

                {/* Buttons */}
                <div class="grid grid-cols-2 gap-4">
                    <button
                        class="w-full bg-[#2D3748] text-white p-3 rounded-lg hover:bg-[#1A202C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        onClick$={generateLabel}
                        disabled={isLoading.value || !isFormValid()}
                    >
                        Generate Label
                    </button>
                    <a
                        href="https://www.buymeacoffee.com"
                        target="_blank"
                        class="w-full bg-[#FFD644] text-gray-900 p-3 rounded-lg hover:bg-[#FFE066] transition-colors text-center flex items-center justify-center gap-2 font-medium"
                    >
                        <span class="material-icons">coffee</span>
                        Buy me a coffee
                    </a>
                </div>

                {/* Preview Area */}
                <div
                    class="mt-8 p-8 bg-[#F8FAFC] rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center min-h-[200px]">
                    {isLoading.value && (
                        <div class="text-gray-600">Loading image...</div>
                    )}
                    {!isLoading.value && labelPreviewUrl.value && (
                        <div class="inline-block">
                            <img
                                src={labelPreviewUrl.value}
                                alt="Label Preview"
                                width={labelWidthPx}
                                height={labelHeightPx} // wysokość wyliczona na podstawie 10mm
                                class="max-w-full"      // usunięto h-auto, by wysokość była stała
                            />
                        </div>
                    )}
                    {!isLoading.value && !labelPreviewUrl.value && (
                        <div class="text-gray-500 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20"
                                 fill="currentColor">
                                <path fill-rule="evenodd"
                                      d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z"
                                      clip-rule="evenodd"/>
                                <path d="M9 11H3v5a2 2 0 002 2h4v-7zM11 18h4a2 2 0 002-2v-5h-6v7z"/>
                            </svg>
                            Fill the form above to generate a label preview
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
