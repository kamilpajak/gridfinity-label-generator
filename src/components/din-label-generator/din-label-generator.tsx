// file: src/components/din-label-generator/din-label-generator.tsx

import { $, component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { mmToPx } from "~/lib/utils";
import { drawLabel, getLabelTexts } from "~/lib/labelGenerator";
import { type DINStandard, dinStandards } from "~/data/din-standards";

export const DINLabelGenerator = component$(() => {
  // Signals for user inputs
  const selectedType = useSignal("Screw");
  const selectedSystem = useSignal("Metric");
  const threadSize = useSignal(""); // top text
  const hardwareStandard = useSignal(""); // bottom text
  const notes = useSignal("");
  const standardImage = useSignal<HTMLImageElement | null>(null);
  const labelWidth = useSignal(55); // in mm
  const length = useSignal("");
  const isLoading = useSignal(false);
  const labelPreviewUrl = useSignal<string>("");

  // Signal for toggling the standard name
  const showStandardName = useSignal(true);
  // Signal for toggling the image
  const showImage = useSignal(true);

  // Example thread sizes
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

  // Load DIN image – only on client side
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

  // Re-render preview on form changes
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

    // Load fonts
    await Promise.all([
      document.fonts.load(`900 57px "Noto Sans"`),
      document.fonts.load('900 57px "Oswald", sans-serif'),
    ]).catch((err) => console.error("Failed to load fonts:", err));

    // Generate preview only when required fields are filled
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

  // Generate label and initiate download
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

  // Simple validation
  const isFormValid = () => {
    const requiredFields = {
      threadSize: threadSize.value !== "",
      hardwareStandard: hardwareStandard.value !== "",
      length: selectedType.value === "Screw" ? length.value !== "" : true,
    };
    return Object.values(requiredFields).every(Boolean);
  };

  // Helper for mm -> px
  const labelWidthPx = mmToPx(labelWidth.value);

  // Function for range/number input clamping
  const handleWidthChange = $((value: string | number) => {
    let newValue = typeof value === "string" ? parseInt(value) : value;
    if (isNaN(newValue)) newValue = 55;
    if (newValue < 40) newValue = 40;
    if (newValue > 100) newValue = 100;
    labelWidth.value = newValue;
  });

  return (
    <div class="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4">
      <div class="max-w-5xl mx-auto">
        {/* Header with title and subtitle */}
        <div class="text-center mb-6">
          <h1 class="text-3xl md:text-4xl font-bold text-gray-900">
            Gridfinity Label Generator
          </h1>
          <p class="text-lg md:text-xl text-gray-600 mt-2">
            Beautifully Simple Labels for Your Gridfinity System
          </p>
        </div>

        {/* Main Container */}
        <div class="bg-white rounded-xl shadow-lg overflow-hidden">
          <div class="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            {/* Left side (form section) */}
            <div class="p-4 md:p-8 space-y-6 md:col-span-2">
              {/* Hardware Type & Measurement System */}
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Hardware Type */}
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-0.5 bg-gray-50 p-0.5 rounded-lg">
                  {["Screw", "Nut", "Washer"].map((type) => (
                    <button
                      key={type}
                      onClick$={() => {
                        if (selectedType.value !== type) {
                          console.log("Selected hardware type:", type);
                          selectedType.value = type;
                          // Reset form on type change
                          threadSize.value = "";
                          hardwareStandard.value = "";
                          length.value = "";
                          notes.value = "";
                          labelPreviewUrl.value = "";
                        }
                      }}
                      class={{
                        "h-[60px] px-3 rounded text-base font-medium transition-all":
                          true,
                        "bg-blue-600 text-white shadow-sm":
                          selectedType.value === type,
                        "bg-transparent text-gray-700 hover:bg-gray-100":
                          selectedType.value !== type,
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {/* Measurement System */}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-0.5 bg-gray-50 p-0.5 rounded-lg">
                  {["Metric", "Imperial"].map((system) => (
                    <button
                      key={system}
                      onClick$={() => {
                        if (selectedSystem.value !== system) {
                          console.log("Selected measurement system:", system);
                          selectedSystem.value = system;
                          // Reset form on system change
                          threadSize.value = "";
                          hardwareStandard.value = "";
                          length.value = "";
                          notes.value = "";
                          labelPreviewUrl.value = "";
                        }
                      }}
                      class={{
                        "h-[60px] px-3 rounded text-base font-medium transition-all":
                          true,
                        "bg-blue-100 text-blue-700 border border-blue-600":
                          selectedSystem.value === system,
                        "bg-transparent text-gray-700 hover:bg-gray-100":
                          selectedSystem.value !== system,
                      }}
                    >
                      {system}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thread Size & Length (or Notes if not Screw) */}
              <div class="grid grid-cols-2 gap-6">
                {/* Thread Size */}
                <select
                  required
                  class="w-full h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={threadSize.value}
                  onChange$={(e) => {
                    const value = (e.target as HTMLSelectElement).value;
                    console.log("Selected thread size:", value);
                    threadSize.value = value;
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

                {/* If 'Screw', show Length input; otherwise show a Notes input */}
                {selectedType.value === "Screw" ? (
                  <input
                    type="text"
                    required
                    placeholder={
                      selectedSystem.value === "Metric"
                        ? "Length (e.g., 10)"
                        : "Length (e.g., 3/8″)"
                    }
                    class="w-full h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={length.value}
                    onInput$={(e) => {
                      const val = (e.target as HTMLInputElement).value;
                      console.log("Entered length:", val);
                      length.value = val;
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    placeholder="Optional notes"
                    class="w-full h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={notes.value}
                    onInput$={(e) => {
                      const val = (e.target as HTMLInputElement).value;
                      console.log("Entered notes:", val);
                      notes.value = val;
                    }}
                  />
                )}
              </div>

              {/* Hardware Standard */}
              <select
                required
                class="w-full h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={hardwareStandard.value}
                onChange$={(e) => {
                  const val = (e.target as HTMLSelectElement).value;
                  console.log("Selected hardware standard:", val);
                  hardwareStandard.value = val;
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

              {/* If 'Screw', show an additional notes field */}
              {selectedType.value === "Screw" && (
                <input
                  type="text"
                  placeholder="Optional notes"
                  class="w-full h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={notes.value}
                  onInput$={(e) => {
                    const val = (e.target as HTMLInputElement).value;
                    console.log("Entered additional notes:", val);
                    notes.value = val;
                  }}
                />
              )}

              {/* Preview + Download */}
              <div class="space-y-4">
                {/* Preview area */}
                <div class="bg-white shadow-lg rounded-lg overflow-hidden">
                  {isLoading.value && (
                    <div class="flex flex-col items-center justify-center p-4 text-center">
                      <svg
                        class="w-5 h-5 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          class="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          stroke-width="4"
                        ></circle>
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        ></path>
                      </svg>
                      <span class="mt-2 text-gray-600">Loading image...</span>
                    </div>
                  )}

                  {!isLoading.value && labelPreviewUrl.value && (
                    <img
                      src={labelPreviewUrl.value}
                      alt="Label Preview"
                      width={labelWidthPx}
                      height={mmToPx(10)}
                      class="w-full"
                    />
                  )}

                  {!isLoading.value && !labelPreviewUrl.value && (
                    <div class="flex flex-row items-center justify-center p-4 text-center text-gray-500 gap-3">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="w-6 h-6"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"
                        />
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M6 6h.008v.008H6V6Z"
                        />
                      </svg>
                      <span class="text-base">
                        Fill the form to generate preview
                      </span>
                    </div>
                  )}
                </div>

                {/* Download & BuyMeACoffee */}
                <div class="flex flex-col md:flex-row gap-4">
                  <button
                    class="w-full flex items-center justify-center gap-3 h-[60px] rounded-lg text-base font-medium transition-all bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick$={generateLabel}
                    disabled={isLoading.value || !isFormValid()}
                  >
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                      />
                    </svg>
                    <span>Download</span>
                  </button>
                  <a
                    href="https://www.buymeacoffee.com/kamilpajak"
                    target="_blank"
                    class="inline-block"
                  >
                    <img
                      src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                      alt="Buy Me A Coffee"
                      width="217"
                      height="60"
                      class="w-auto max-w-[217px] mx-auto"
                    />
                  </a>
                </div>
              </div>
            </div>
            {/* End of left side */}

            {/* Right side (settings panel) */}
            <div class="p-4 md:p-8 space-y-6">
              <div class="flex items-center gap-3 text-gray-700">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width={1.5}
                  stroke="currentColor"
                  class="w-6 h-6"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"
                  />
                </svg>
                <h3 class="text-lg font-medium">Label Settings</h3>
              </div>

              <div class="space-y-4">
                {/* Toggle for showing/hiding the standard name */}
                <div class="flex items-center justify-between bg-white h-[60px] px-4 rounded-lg border border-gray-200">
                  <div class="flex items-center gap-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width={1.5}
                      stroke="currentColor"
                      class="w-6 h-6"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5-3.9 19.5m-2.1-19.5-3.9 19.5"
                      />
                    </svg>
                    <span class="text-base text-gray-700">Standard</span>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showStandardName.value}
                      onChange$={(e) => {
                        showStandardName.value = (
                          e.target as HTMLInputElement
                        ).checked;
                        console.log(
                          "Show standard name:",
                          showStandardName.value,
                        );
                      }}
                      class="sr-only peer"
                    />
                    <div class="w-12 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                </div>

                {/* Toggle for showing/hiding the image */}
                <div class="flex items-center justify-between bg-white h-[60px] px-4 rounded-lg border border-gray-200">
                  <div class="flex items-center gap-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width={1.5}
                      stroke="currentColor"
                      class="w-6 h-6"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                      />
                    </svg>
                    <span class="text-base text-gray-700">Image</span>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showImage.value}
                      onChange$={(e) => {
                        showImage.value = (
                          e.target as HTMLInputElement
                        ).checked;
                        console.log("Show image:", showImage.value);
                      }}
                      class="sr-only peer"
                    />
                    <div class="w-12 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                  </label>
                </div>

                {/* Label width controls */}
                <div class="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
                  <div class="flex items-center justify-between">
                    <span class="text-base text-gray-700">Width</span>
                    <div class="flex items-center gap-2">
                      <input
                        type="number"
                        min="40"
                        max="100"
                        class="w-20 h-[40px] px-2 bg-gray-50 border border-gray-200 rounded text-right text-base text-gray-700"
                        value={labelWidth.value}
                        onInput$={(e) => {
                          handleWidthChange(
                            (e.target as HTMLInputElement).value,
                          );
                        }}
                      />
                      <span class="text-sm text-gray-600">mm</span>
                    </div>
                  </div>
                  <div class="space-y-2">
                    <input
                      type="range"
                      min="40"
                      max="100"
                      value={labelWidth.value}
                      onInput$={(e) => {
                        handleWidthChange((e.target as HTMLInputElement).value);
                      }}
                      class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div class="flex justify-between text-xs text-gray-500">
                      <span>40mm</span>
                      <span>100mm</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* End of left side */}
          </div>
        </div>
      </div>
    </div>
  );
});
