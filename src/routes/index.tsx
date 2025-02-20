import { $, component$, useSignal, useStore, useTask$ } from "@builder.io/qwik";
import type { LabelSettings } from "~/types";
import {
  dinStandards,
  imperialThreadSizes,
  metricThreadSizes,
} from "~/constants/hardware";
import { generateLabel, getLabelTexts } from "~/lib/labelGenerator";
import { Header } from "~/components/Header";
import { HardwareTypeSelector } from "~/components/HardwareTypeSelector";
import { SearchableDropdown } from "~/components/SearchableDropdown";
import { ThreadSizeDropdown } from "~/components/ThreadSizeDropdown";
import { LabelPreview } from "~/components/LabelPreview";
import { SettingsPanel } from "~/components/SettingsPanel";
import { RedditComments } from "~/components/RedditComments";
import { validateWidth } from "~/utils/measurements";
import { DownloadIcon } from "~/components/icons";

export default component$(() => {
  const selectedType = useSignal("Screw");
  const selectedSystem = useSignal("Metric");
  const threadSize = useSignal("");
  const hardwareStandard = useSignal("");
  const notes = useSignal("");
  const length = useSignal("");
  const isLoading = useSignal(false);
  const labelPreviewUrl = useSignal("");
  const isStandardDropdownOpen = useSignal(false);
  const standardSearchQuery = useSignal("");
  const showComments = useSignal(false);
  // const showSettings = useSignal(false);

  const settings = useStore<LabelSettings>({
    showStandardName: true,
    showImage: true,
    labelWidth: 55,
  });

  const handleTypeChange$ = $((type: string) => {
    if (selectedType.value !== type) {
      selectedType.value = type;
      threadSize.value = "";
      hardwareStandard.value = "";
      length.value = "";
      notes.value = "";
      labelPreviewUrl.value = "";
    }
  });

  const handleSystemChange$ = $((system: string) => {
    if (selectedSystem.value !== system) {
      selectedSystem.value = system;
      threadSize.value = "";
      hardwareStandard.value = "";
      length.value = "";
      notes.value = "";
      labelPreviewUrl.value = "";
    }
  });

  const handleSettingsChange$ = $((newSettings: Partial<LabelSettings>) => {
    if (newSettings.labelWidth !== undefined) {
      settings.labelWidth = validateWidth(newSettings.labelWidth);
    }
    if (newSettings.showStandardName !== undefined) {
      settings.showStandardName = newSettings.showStandardName;
    }
    if (newSettings.showImage !== undefined) {
      settings.showImage = newSettings.showImage;
    }
  });

  const generatePreview$ = $(async () => {
    if (
      !threadSize.value ||
      !hardwareStandard.value ||
      (selectedType.value === "Screw" && !length.value)
    ) {
      return;
    }

    const standard = dinStandards[
      selectedType.value.toLowerCase() as keyof typeof dinStandards
    ].find((s) => s.value === hardwareStandard.value);

    if (!standard) return;

    isLoading.value = true;
    try {
      const { topText, bottomText } = getLabelTexts(
        selectedType.value,
        selectedSystem.value,
        threadSize.value,
        length.value,
        hardwareStandard.value,
        notes.value,
        settings.showStandardName,
      );

      const labelUrl = await generateLabel(
        standard.image,
        topText,
        bottomText,
        settings.labelWidth,
        settings.showImage,
      );

      if (labelUrl) {
        labelPreviewUrl.value = labelUrl;
      }
    } catch (error) {
      console.error("Error generating label:", error);
    } finally {
      isLoading.value = false;
    }
  });

  const handleDownload$ = $(() => {
    if (!labelPreviewUrl.value) return;

    // Create a temporary link element
    const link = document.createElement("a");
    link.href = labelPreviewUrl.value;

    // Generate filename based on the hardware details
    const filename = `${selectedType.value.toLowerCase()}-${threadSize.value}${length.value ? `-${length.value}` : ""}.png`;
    link.download = filename;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  useTask$(({ track }) => {
    track(() => settings.labelWidth);
    track(() => settings.showStandardName);
    track(() => settings.showImage);
    track(() => threadSize.value);
    track(() => hardwareStandard.value);
    track(() => length.value);
    track(() => notes.value);

    if (
      threadSize.value ||
      hardwareStandard.value ||
      length.value ||
      notes.value
    ) {
      generatePreview$();
    }
  });

  return (
    <div class="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4">
      <div class="max-w-5xl mx-auto space-y-6">
        <Header />

        <div class="bg-white rounded-xl shadow-lg">
          <div class="lg:grid lg:grid-cols-3 lg:divide-x divide-gray-100">
            <div class="lg:col-span-2 p-4 lg:p-8 space-y-6">
              <HardwareTypeSelector
                selectedType={selectedType.value}
                selectedSystem={selectedSystem.value}
                onTypeChange$={handleTypeChange$}
                onSystemChange$={handleSystemChange$}
              />

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <ThreadSizeDropdown
                  selectedValue={threadSize.value}
                  options={
                    selectedSystem.value === "Metric"
                      ? metricThreadSizes
                      : imperialThreadSizes
                  }
                  onSelect$={(value: string) => (threadSize.value = value)}
                />

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
                    onInput$={(e) =>
                      (length.value = (e.target as HTMLInputElement).value)
                    }
                  />
                ) : (
                  <input
                    type="text"
                    placeholder="Optional notes"
                    class="w-full h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={notes.value}
                    onInput$={(e) =>
                      (notes.value = (e.target as HTMLInputElement).value)
                    }
                  />
                )}
              </div>

              <SearchableDropdown
                isOpen={isStandardDropdownOpen.value}
                onToggle$={() =>
                  (isStandardDropdownOpen.value = !isStandardDropdownOpen.value)
                }
                selectedValue={hardwareStandard.value}
                searchQuery={standardSearchQuery.value}
                onSearchChange$={(query: string) =>
                  (standardSearchQuery.value = query)
                }
                options={
                  dinStandards[
                    selectedType.value.toLowerCase() as keyof typeof dinStandards
                  ]
                }
                onSelect$={(value: string) => {
                  hardwareStandard.value = value;
                  isStandardDropdownOpen.value = false;
                  standardSearchQuery.value = "";
                }}
              />

              {selectedType.value === "Screw" && (
                <input
                  type="text"
                  placeholder="Optional notes"
                  class="w-full h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={notes.value}
                  onInput$={(e) =>
                    (notes.value = (e.target as HTMLInputElement).value)
                  }
                />
              )}

              <LabelPreview
                isLoading={isLoading.value}
                labelUrl={labelPreviewUrl.value}
                labelWidth={settings.labelWidth}
              />

              <div class="grid grid-cols-1 sm:grid-cols-[1fr,217px] gap-4">
                <button
                  class={`
                    w-full flex items-center justify-center gap-3 h-[60px] rounded-lg text-base font-medium transition-all
                    ${
                      threadSize.value &&
                      hardwareStandard.value &&
                      (selectedType.value !== "Screw" || length.value)
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }
                  `}
                  onClick$={handleDownload$}
                  disabled={
                    !threadSize.value ||
                    !hardwareStandard.value ||
                    (selectedType.value === "Screw" && !length.value)
                  }
                >
                  <DownloadIcon />
                  <span>Download</span>
                </button>
                <a
                  href="https://www.buymeacoffee.com/kamilpajak"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hidden sm:inline-block"
                >
                  <img
                    src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                    alt="Buy Me A Coffee"
                    style={{ height: "60px", width: "217px" }}
                  />
                </a>
              </div>
            </div>

            <div class="hidden lg:block">
              <SettingsPanel
                settings={settings}
                onSettingsChange$={handleSettingsChange$}
              />
            </div>
          </div>
        </div>

        <div class="lg:hidden">
          <div class="bg-white rounded-xl shadow-lg overflow-hidden">
            <SettingsPanel
              settings={settings}
              onSettingsChange$={handleSettingsChange$}
            />
          </div>
        </div>

        <RedditComments
          showComments={showComments.value}
          onToggle$={() => (showComments.value = !showComments.value)}
        />
      </div>
    </div>
  );
});
