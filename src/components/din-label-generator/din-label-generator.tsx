import { component$, useSignal, $, useTask$ } from '@builder.io/qwik';
import { dinStandards, type DINStandard } from '~/data/din-standards';

export const DINLabelGenerator = component$(() => {
  // Signals for user inputs
  const selectedType = useSignal('Screw');
  const selectedSystem = useSignal('Metric');
  const threadSize = useSignal('');         // Top text (np. rozmiar gwintu)
  const hardwareStandard = useSignal('');   // Bottom text (np. "DIN 439")
  const notes = useSignal('');
  const standardImage = useSignal<HTMLImageElement | null>(null);
  const labelWidth = useSignal(40);          // Szerokość etykiety w mm
  const length = useSignal('');
  const isLoading = useSignal(false);
  const labelPreviewUrl = useSignal<string>('');

  const metricThreadSizes = ['M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M16', 'M20'];
  const imperialThreadSizes = ['#4', '#6', '#8', '#10', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"'];

  // Load DIN standard image when hardwareStandard or selectedType changes
  useTask$(({ track }) => {
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

  /**
   * QRL function to draw the label on a canvas.
   * Layout logic:
   * - The canvas is sized based on labelWidth (in mm) and a fixed height (10mm).
   * - The DIN image is drawn on the left, zachowując oryginalne proporcje (wysokość = etykieta).
   * - Ustalony jest stały odstęp (10px) między obrazkiem a obszarem tekstowym.
   * - W obszarze tekstowym (prawa strona) obie linie tekstu są poziomo wyśrodkowane:
   *    - Górna linia (thread size) rysowana od góry (textBaseline = 'top')
   *    - Dolna linia (DIN standard) rysowana od dołu (textBaseline = 'bottom')
   * Czcionka użyta do rysowania to "Noto Sans" z wagą 900, co odpowiada podanemu stylowi.
   */
  const drawLabel = $(
      (
          standardImg: HTMLImageElement | null,
          thread: string,
          hwStandard: string,
          labelWidthMm: number
      ): string | null => {
        if (!standardImg) {
          console.error("No DIN image available, cannot draw label.");
          return null;
        }

        // Constants for conversion and dimensions
        const dpi = 360;
        const mmToInch = 25.4;
        const labelHeightMm = 10; // fixed label height in mm
        const labelHeightPx = Math.round((labelHeightMm / mmToInch) * dpi);
        const labelWidthPx = Math.round((labelWidthMm / mmToInch) * dpi);

        // Create canvas and get context
        const canvas = document.createElement('canvas');
        canvas.width = labelWidthPx;
        canvas.height = labelHeightPx;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Draw white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, labelWidthPx, labelHeightPx);

        // Draw DIN image (icon) on the left with original proportions
        const naturalWidth = standardImg.naturalWidth;
        const naturalHeight = standardImg.naturalHeight;
        const aspectRatio = naturalWidth / naturalHeight;
        const drawnImgHeight = labelHeightPx; // icon's height equals label height
        const drawnImgWidth = Math.round(drawnImgHeight * aspectRatio);
        ctx.drawImage(standardImg, 0, 0, drawnImgWidth, drawnImgHeight);
        console.log("DIN image drawn with size:", drawnImgWidth, "x", drawnImgHeight);

        // Define a fixed gap (in px) between icon and text area
        const gapPx = 10;
        const textAreaX = drawnImgWidth + gapPx;
        const textAreaWidth = labelWidthPx - textAreaX;
        console.log("Text area starts at x =", textAreaX, "with width =", textAreaWidth);

        // Prepare font size proportional to label height
        const fontSize = labelHeightPx * 0.4; // przykładowa wartość
        // Używamy czcionki "Noto Sans" z wagą 900 – reszta właściwości (np. font-optical-sizing, font-variation-settings)
        // musi być zadeklarowana globalnie w CSS lub załadowana przez @font-face.
        ctx.font = `900 ${fontSize}px "Noto Sans", serif`;
        ctx.fillStyle = 'black';

        // --- Draw top text (thread) centered horizontally in the text area ---
        ctx.textBaseline = 'top'; // tekst zaczyna się od górnej krawędzi
        const topText = thread;
        const topMetrics = ctx.measureText(topText);
        const topTextWidth = topMetrics.width;
        const topTextX = textAreaX + (textAreaWidth - topTextWidth) / 2;
        // rysujemy tekst przy y = 0 (górna krawędź)
        ctx.fillText(topText, topTextX, 0);
        console.log("Top text drawn at:", topTextX, 0, "text:", topText);

        // --- Draw bottom text (DIN standard) centered horizontally in the text area ---
        ctx.textBaseline = 'bottom'; // tekst wyrównany do dolnej krawędzi
        const bottomText = hwStandard;
        const bottomMetrics = ctx.measureText(bottomText);
        const bottomTextWidth = bottomMetrics.width;
        const bottomTextX = textAreaX + (textAreaWidth - bottomTextWidth) / 2;
        // rysujemy tekst przy y = labelHeightPx (dolna krawędź)
        ctx.fillText(bottomText, bottomTextX, labelHeightPx);
        console.log("Bottom text drawn at:", bottomTextX, labelHeightPx, "text:", bottomText);

        return canvas.toDataURL('image/png');
      }
  );

  // Update label preview whenever relevant values change.
  useTask$(async ({ track }) => {
    track(() => standardImage.value);
    track(() => threadSize.value);
    track(() => hardwareStandard.value);
    track(() => labelWidth.value);
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

  // Generate label for download.
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

  // Dynamic calculation of preview dimensions in pixels
  const dpi = 360;
  const mmToInch = 25.4;
  const labelHeightPx = Math.round((10 / mmToInch) * dpi); // 10 mm height
  const labelWidthPx = Math.round((labelWidth.value / mmToInch) * dpi);

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
                { value: 'Metric', label: 'Metric' },
                { value: 'Imperial', label: 'Imperial' },
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
          <div class="mt-8 p-8 bg-[#F8FAFC] rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center min-h-[200px]">
            {isLoading.value ? (
                <div class="text-gray-600">Loading image...</div>
            ) : labelPreviewUrl.value ? (
                <div class="inline-block">
                  <img
                      src={labelPreviewUrl.value}
                      alt="Label Preview"
                      width={labelWidthPx}
                      height={labelHeightPx}
                      class="max-w-full h-auto"
                  />
                </div>
            ) : (
                <div class="text-gray-500 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z" clip-rule="evenodd" />
                    <path d="M9 11H3v5a2 2 0 002 2h4v-7zM11 18h4a2 2 0 002-2v-5h-6v7z" />
                  </svg>
                  Fill the form above to generate a label preview
                </div>
            )}
          </div>
        </div>
      </div>
  );
});
