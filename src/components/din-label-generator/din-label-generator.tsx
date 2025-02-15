// file: src/components/din-label-generator/din-label-generator.tsx
import { $, component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { mmToPx } from "~/lib/utils";
import { drawLabel, getLabelTexts } from "~/lib/labelGenerator";
import { type DINStandard, dinStandards } from "~/data/din-standards";

export const DINLabelGenerator = component$(() => {
  // Signals for user inputs.
  const selectedType = useSignal("Screw");
  const selectedSystem = useSignal("Metric");
  const threadSize = useSignal(""); // Top text.
  const hardwareStandard = useSignal(""); // Bottom text.
  const notes = useSignal("");
  const standardImage = useSignal<HTMLImageElement | null>(null);
  const labelWidth = useSignal(55); // in mm.
  const length = useSignal("");
  const isLoading = useSignal(false);
  const labelPreviewUrl = useSignal<string>("");

  // Signal for toggling the standard name.
  const showStandardName = useSignal(true);
  // Signal for toggling the image.
  const showImage = useSignal(true);

  const metricThreadSizes = [
    "M1.4",
    "M1.6",
    "M2",
    "M2.5",
    "M3",
    "M4",
    "M5",
    "M6",
    "M8",
    "M10",
    "M12",
    "M16",
    "M20",
  ];
  const imperialThreadSizes = [
    "#4",
    "#6",
    "#8",
    "#10",
    "1/4″",
    "5/16″",
    "3/8″",
    "1/2″",
    "5/8″",
  ];

  // Load DIN image – only on client side.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => hardwareStandard.value);
    track(() => selectedType.value);

    if (hardwareStandard.value) {
      isLoading.value = true;
      const img = new Image();
      const standardNumber = hardwareStandard.value
        .replace("DIN ", "")
        .toLowerCase();
      const subfolder = selectedType.value.toLowerCase() + "s";
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

  // Re-render preview on form changes.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track }) => {
    track(() => threadSize.value);
    track(() => hardwareStandard.value);
    track(() => labelWidth.value);
    track(() => length.value);
    track(() => notes.value);
    track(() => standardImage.value);
    track(() => showStandardName.value);
    track(() => showImage.value);

    console.log("Before drawing label, values are:", {
      thread: threadSize.value,
      hwStandard: hardwareStandard.value,
      labelWidth: labelWidth.value,
      length: length.value,
      notes: notes.value,
      standardImageExists: !!standardImage.value,
      showStandardName: showStandardName.value,
      showImage: showImage.value,
    });

    await Promise.all([
      document.fonts.load(`900 57px "Noto Sans"`),
      document.fonts.load('900 57px "Oswald", sans-serif'),
    ]).catch((err) => console.error("Failed to load fonts:", err));

    // Generate preview only when required fields are filled.
    if (
      threadSize.value === "" ||
      hardwareStandard.value === "" ||
      (selectedType.value === "Screw" && length.value === "") ||
      !standardImage.value
    ) {
      return;
    }

    const { topText, bottomText } = getLabelTexts(
      selectedType.value,
      selectedSystem.value,
      threadSize.value,
      length.value,
      hardwareStandard.value,
      notes.value,
      showStandardName.value,
    );

    const previewUrl = drawLabel(
      standardImage.value,
      topText,
      bottomText,
      labelWidth.value,
      showImage.value,
    );
    if (previewUrl) {
      labelPreviewUrl.value = previewUrl;
      console.log("Label preview updated.");
    } else {
      labelPreviewUrl.value = "";
    }
  });

  // Generate label and initiate download.
  const generateLabel = $(async () => {
    const { topText, bottomText } = getLabelTexts(
      selectedType.value,
      selectedSystem.value,
      threadSize.value,
      length.value,
      hardwareStandard.value,
      notes.value,
      showStandardName.value,
    );
    const dataUrl = drawLabel(
      standardImage.value,
      topText,
      bottomText,
      labelWidth.value,
      showImage.value,
    );
    if (!dataUrl) {
      console.error("Label generation failed: No valid label drawn.");
      return;
    }
    console.log("Label generated successfully, initiating download...");
    const link = document.createElement("a");
    link.download = `${hardwareStandard.value.toLowerCase().replace(" ", "_")}_label.png`;
    link.href = dataUrl;
    link.click();
  });

  const isFormValid = () => {
    const requiredFields = {
      threadSize: threadSize.value !== "",
      hardwareStandard: hardwareStandard.value !== "",
      length: selectedType.value === "Screw" ? length.value !== "" : true,
    };
    return Object.values(requiredFields).every(Boolean);
  };

  const labelWidthPx = mmToPx(labelWidth.value);

  return (
    <div class="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg">
      <div class="space-y-6">
        {/* Hardware Type */}
        <div>
          <div class="grid grid-cols-3 gap-0 bg-white rounded-lg border border-gray-200 overflow-hidden">
            {["Screw", "Nut", "Washer"].map((type) => (
              <button
                key={type}
                onClick$={() => {
                  if (selectedType.value !== type) {
                    console.log("Selected hardware type:", type);
                    selectedType.value = type;
                    // Reset form on type change.
                    threadSize.value = "";
                    hardwareStandard.value = "";
                    length.value = "";
                    notes.value = "";
                    labelPreviewUrl.value = "";
                  }
                }}
                class={{
                  "py-3 px-4 text-center transition-colors font-medium": true,
                  "bg-[#2D3748] text-white": selectedType.value === type,
                  "bg-white text-gray-700 hover:bg-gray-50":
                    selectedType.value !== type,
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Measurement System */}
        <div>
          <div class="grid grid-cols-2 gap-0 bg-white rounded-lg border border-gray-200 overflow-hidden">
            {[
              { value: "Metric", label: "Metric" },
              { value: "Imperial", label: "Imperial" },
            ].map((system) => (
              <button
                key={system.value}
                onClick$={() => {
                  console.log("Selected measurement system:", system.value);
                  if (selectedSystem.value !== system.value) {
                    selectedSystem.value = system.value;
                    // Reset form on system change.
                    threadSize.value = "";
                    hardwareStandard.value = "";
                    length.value = "";
                    notes.value = "";
                    labelPreviewUrl.value = "";
                  }
                }}
                class={{
                  "py-3 px-4 text-center transition-colors font-medium": true,
                  "bg-[#94A3B8] text-white":
                    selectedSystem.value === system.value,
                  "bg-white text-gray-700 hover:bg-gray-50":
                    selectedSystem.value !== system.value,
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
            required
            class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={threadSize.value}
            onChange$={(e) => {
              console.log(
                "Selected thread size:",
                (e.target as HTMLSelectElement).value,
              );
              threadSize.value = (e.target as HTMLSelectElement).value;
            }}
          >
            <option value="">Thread size...</option>
            {(selectedSystem.value === "Metric"
              ? metricThreadSizes
              : imperialThreadSizes
            ).map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        {/* Length (for screws) */}
        {selectedType.value === "Screw" && (
          <div>
            <input
              type="text"
              required
              placeholder={
                selectedSystem.value === "Metric"
                  ? "Length (e.g., 10)"
                  : "Length (e.g., 3/8″)"
              }
              class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={length.value}
              onInput$={(e) => {
                console.log(
                  "Entered length:",
                  (e.target as HTMLInputElement).value,
                );
                length.value = (e.target as HTMLInputElement).value;
              }}
            />
          </div>
        )}

        {/* Hardware Standard */}
        <div>
          <select
            required
            class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={hardwareStandard.value}
            onChange$={(e) => {
              console.log(
                "Selected hardware standard:",
                (e.target as HTMLSelectElement).value,
              );
              hardwareStandard.value = (e.target as HTMLSelectElement).value;
            }}
          >
            <option value="">Hardware standard...</option>
            {dinStandards[
              selectedType.value.toLowerCase() as keyof typeof dinStandards
            ].map((standard: DINStandard) => (
              <option key={standard.value} value={standard.value}>
                {standard.text}
              </option>
            ))}
          </select>
        </div>

        {/* Toggle for showing/hiding the standard name */}
        <div class="flex items-center gap-2">
          <span class="text-gray-700">Show standard name</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showStandardName.value}
              onChange$={(e) => {
                showStandardName.value = (e.target as HTMLInputElement).checked;
                console.log("Show standard name:", showStandardName.value);
              }}
              class="sr-only peer"
            />
            <div
              class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full dark:bg-gray-700
                        peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                        after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600
                        peer-checked:bg-blue-600"
            ></div>
          </label>
        </div>

        {/* Toggle for showing/hiding the image */}
        <div class="flex items-center gap-2">
          <span class="text-gray-700">Show image</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showImage.value}
              onChange$={(e) => {
                showImage.value = (e.target as HTMLInputElement).checked;
                console.log("Show image:", showImage.value);
              }}
              class="sr-only peer"
            />
            <div
              class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full dark:bg-gray-700
                        peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                        after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600
                        peer-checked:bg-blue-600"
            ></div>
          </label>
        </div>

        {/* Additional Notes */}
        <div>
          <input
            type="text"
            placeholder="Additional notes (optional)"
            class="w-full p-3 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={notes.value}
            onInput$={(e) => {
              console.log(
                "Entered additional notes:",
                (e.target as HTMLInputElement).value,
              );
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
                min="40"
                max="100"
                class="w-20 p-2 bg-white border border-gray-200 rounded text-right text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={labelWidth.value}
                onInput$={(e) => {
                  let newValue =
                    parseInt((e.target as HTMLInputElement).value) || 0;
                  if (newValue < 40) newValue = 40;
                  if (newValue > 100) newValue = 100;
                  console.log("Set label width (number):", newValue);
                  labelWidth.value = newValue;
                }}
              />
              <span class="text-sm text-gray-600">mm</span>
            </div>
          </div>
          <input
            type="range"
            min="40"
            max="100"
            value={labelWidth.value}
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            onInput$={(e) => {
              console.log(
                "Set label width (range):",
                (e.target as HTMLInputElement).value,
              );
              labelWidth.value = parseInt((e.target as HTMLInputElement).value);
            }}
          />
          <div class="text-xs text-gray-500">
            Label height is 10mm - perfect for 12mm tape labels
          </div>
        </div>

        {/* Buttons */}
        <div class="grid grid-cols-[1fr_217px] gap-4">
          <button
            class="w-full bg-[#2D3748] text-white p-3 rounded-lg hover:bg-[#1A202C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            onClick$={generateLabel}
            disabled={isLoading.value || !isFormValid()}
          >
            Download Label
          </button>
          <a href="https://www.buymeacoffee.com/kamilpajak" target="_blank">
            <img
              src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
              alt="Buy Me A Coffee"
              width="217"
              height="60"
              style="height: 60px !important; width: 217px !important;"
            />
          </a>
        </div>

        {/* Preview Area */}
        <div class="mt-8 p-8 bg-[#F8FAFC] rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center min-h-[200px]">
          {isLoading.value && <div class="text-gray-600">Loading image...</div>}
          {!isLoading.value && labelPreviewUrl.value ? (
            <div class="inline-block">
              <img
                src={labelPreviewUrl.value}
                alt="Label Preview"
                width={labelWidthPx}
                height={mmToPx(10)} // fixed height: 10mm
                class="max-w-full"
              />
            </div>
          ) : (
            <div class="text-gray-500 flex items-center gap-2">
              Fill the form above to generate a label preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
