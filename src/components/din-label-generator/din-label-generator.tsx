import { component$, useSignal, $, useTask$ } from '@builder.io/qwik';
import { dinStandards, type DINStandard } from '~/data/din-standards';

export const DINLabelGenerator = component$(() => {
  const selectedType = useSignal('Screw');
  const selectedSystem = useSignal('Metric');
  const threadSize = useSignal('');
  const hardwareStandard = useSignal('');
  const notes = useSignal('');
  const standardImage = useSignal<HTMLImageElement | null>(null);
  const labelWidth = useSignal(40); // width in mm
  const length = useSignal('');
  const isLoading = useSignal(false);
  const labelPreviewUrl = useSignal<string>('');

  const metricThreadSizes = ['M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12', 'M16', 'M20'];
  const imperialThreadSizes = ['#4', '#6', '#8', '#10', '1/4"', '5/16"', '3/8"', '1/2"', '5/8"'];

  // Load DIN standard image when hardware standard or type changes
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

  // QRL function for drawing the label.
  // Przyjmuje jako argumenty wszystkie niezbędne wartości, aby nie "chwytac" zmiennych z zewnętrznego zakresu.
  const drawLabel = $(
      (
          standardImg: HTMLImageElement | null,
          thread: string,
          hwStandard: string,
          width: number
      ): string | null => {
        if (!standardImg) {
          console.error("No DIN image available, cannot draw label.");
          return null;
        }
        const dpi = 360;
        const mmToInch = 25.4;
        // Fixed label height is 10mm
        const heightPx = Math.round((10 / mmToInch) * dpi);
        const widthPx = Math.round((width / mmToInch) * dpi);
        const canvas = document.createElement('canvas');
        canvas.width = widthPx;
        canvas.height = heightPx;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        // Draw white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, widthPx, heightPx);
        // Draw DIN image on the left side
        const imgHeight = heightPx;
        const imgWidth = imgHeight;
        ctx.drawImage(standardImg, 0, 0, imgWidth, imgHeight);
        // Set text properties
        ctx.font = `${heightPx * 0.4}px Arial`;
        ctx.fillStyle = 'black';
        // Calculate margins in pixels (4mm from top and 4mm from bottom)
        const marginPx = Math.round((4 / mmToInch) * dpi);
        const topY = marginPx;             // 4mm from top
        const bottomY = heightPx - marginPx; // 4mm from bottom
        const textX = imgWidth + 10;         // Text starts a bit right to the image
        // Draw thread size in the top row (if provided)
        if (thread) {
          ctx.textBaseline = 'top'; // Align text to the top
          ctx.fillText(thread, textX, topY);
          console.log("Thread size drawn at top row:", thread);
        } else {
          console.warn("Thread size value is empty.");
        }
        // Draw DIN standard text in the bottom row (if provided)
        if (hwStandard) {
          ctx.textBaseline = 'bottom'; // Align text to the bottom
          ctx.fillText(hwStandard, textX, bottomY);
          console.log("DIN standard drawn at bottom row:", hwStandard);
        } else {
          console.warn("DIN standard value is empty.");
        }
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

  // Dynamicznie obliczamy wymiary etykiety w pikselach na podstawie wartości w mm
  const dpi = 360;
  const mmToInch = 25.4;
  const labelHeightPx = Math.round((10 / mmToInch) * dpi); // 10mm wysokości
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
