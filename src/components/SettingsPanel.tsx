import type { PropFunction } from "@builder.io/qwik";
import { $, component$, useSignal, useTask$ } from "@builder.io/qwik";
import type { LabelSettings } from "~/types";
import { validateWidth } from "~/utils/measurements";
import { shouldShortenUrl, shortenUrl } from "~/utils/urlShortener";
import { ChatBubbleIcon, IdentifierIcon, ImageIcon, InfoIcon, QrCodeIcon, SettingsIcon } from "./icons";

interface Props {
  settings: LabelSettings;
  onSettingsChange$: PropFunction<(settings: Partial<LabelSettings>) => void>;
}

export const SettingsPanel = component$<Props>(
  ({ settings, onSettingsChange$ }) => {
    const handleWidthChange$ = $((value: string | number) => {
      const validatedWidth = validateWidth(value);
      onSettingsChange$({ labelWidth: validatedWidth });
    });
    
    // Signal to store the shortened URL preview
    const shortenedUrlPreview = useSignal<string>("");
    
    // Update the shortened URL preview when QR code content changes
    useTask$(async ({ track }) => {
      const qrContent = track(() => settings.qrCodeContent);
      
      if (shouldShortenUrl(qrContent)) {
        try {
          const shortened = await shortenUrl(qrContent);
          shortenedUrlPreview.value = shortened;
        } catch (error) {
          console.error("Failed to get shortened URL preview:", error);
          shortenedUrlPreview.value = "";
        }
      } else {
        shortenedUrlPreview.value = "";
      }
    });

    return (
      <div class="h-full bg-gray-50">
        <div class="p-8 space-y-6">
          <div class="flex items-center gap-3 text-gray-700">
            <SettingsIcon />
            <h3 id="label-settings" class="text-lg font-medium">
              Label Settings
            </h3>
          </div>

          <div class="space-y-4">
            <div class="flex items-center justify-between bg-white h-[60px] px-4 rounded-lg border border-gray-200">
              <div class="flex items-center gap-3">
                <IdentifierIcon />
                <span class="text-base text-gray-700">Standard Reference</span>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showStandardName}
                  onChange$={(e) =>
                    onSettingsChange$({
                      showStandardName: (e.target as HTMLInputElement).checked,
                    })
                  }
                  class="sr-only peer"
                />
                <div class="w-12 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
              </label>
            </div>

            <div class="flex items-center justify-between bg-white h-[60px] px-4 rounded-lg border border-gray-200">
              <div class="flex items-center gap-3">
                <ImageIcon />
                <span class="text-base text-gray-700">Image</span>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showImage}
                  onChange$={(e) =>
                    onSettingsChange$({
                      showImage: (e.target as HTMLInputElement).checked,
                    })
                  }
                  class="sr-only peer"
                />
                <div class="w-12 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
              </label>
            </div>

            <div class="flex items-center justify-between bg-white h-[60px] px-4 rounded-lg border border-gray-200">
              <div class="flex items-center gap-3">
                <QrCodeIcon />
                <span class="text-base text-gray-700">QR Code</span>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showQrCode}
                  onChange$={(e) =>
                    onSettingsChange$({
                      showQrCode: (e.target as HTMLInputElement).checked,
                    })
                  }
                  class="sr-only peer"
                />
                <div class="w-12 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
              </label>
            </div>

            {settings.showQrCode && (
              <div class="bg-white p-4 rounded-lg border border-gray-200">
                <div class="flex items-center gap-2 mb-2">
                  <label class="block text-base text-gray-700">
                    QR Code Content
                  </label>
                  {/* Info icon with tooltip for URL shortening */}
                  <div class="relative group">
                    <span class="cursor-help text-gray-400 hover:text-gray-600">
                      <InfoIcon />
                    </span>
                    <div class="absolute transform -translate-x-1/4 sm:translate-x-0 sm:left-0 md:-translate-x-1/4 md:left-1/4 bottom-full mb-3 hidden group-hover:block min-w-[250px] max-w-[90vw] sm:max-w-xs bg-white rounded-lg shadow-lg text-sm text-gray-700 z-20">
                      {/* Triangle pointer */}
                      <div class="absolute -bottom-2 left-[10%] sm:left-4 w-4 h-4 bg-white transform rotate-45 z-10"></div>
                      
                      {/* Content container with higher z-index to appear above the triangle */}
                      <div class="relative p-4 rounded-lg bg-white z-20">
                        <p>
                          Long URLs will be automatically shortened for better QR code readability.
                          This makes the QR code simpler and easier to scan on small labels.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <input
                  type="text"
                  class="w-full h-[40px] px-3 bg-gray-50 border border-gray-200 rounded text-base text-gray-700"
                  value={settings.qrCodeContent}
                  onInput$={(e) =>
                    onSettingsChange$({
                      qrCodeContent: (e.target as HTMLInputElement).value,
                    })
                  }
                  placeholder="URL or text for QR code"
                />
                {/* Show URL preview only if URL will be shortened */}
                {shortenedUrlPreview.value && shouldShortenUrl(settings.qrCodeContent) && (
                  <div class="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs">
                    <div class="font-medium text-gray-700">Original:</div>
                    <div class="text-gray-600 truncate">{settings.qrCodeContent}</div>
                    <div class="font-medium text-gray-700 mt-1">Shortened:</div>
                    <div class="text-blue-600">{shortenedUrlPreview.value}</div>
                  </div>
                )}
              </div>
            )}

            <div class="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-base text-gray-700">Width</span>
                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    min="37"
                    max="100"
                    class="w-20 h-[40px] px-2 bg-gray-50 border border-gray-200 rounded text-right text-base text-gray-700"
                    value={settings.labelWidth}
                    onInput$={(e) =>
                      handleWidthChange$((e.target as HTMLInputElement).value)
                    }
                  />
                  <span class="text-sm text-gray-600">mm</span>
                </div>
              </div>
              <div class="space-y-2">
                <input
                  type="range"
                  min="37"
                  max="100"
                  value={settings.labelWidth}
                  onInput$={(e) =>
                    handleWidthChange$((e.target as HTMLInputElement).value)
                  }
                  class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div class="flex justify-between text-xs text-gray-500">
                  <span>37mm</span>
                  <span>100mm</span>
                </div>
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-gray-200">
            <div class="sharethis-inline-share-buttons"></div>
            
            <div class="mt-4">
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSegG3P2FED1dOJ1P5Pjv68R4bAq1IFFoc-2U-5_Gt-7IoSDvQ/viewform?usp=dialog"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center justify-center gap-2 px-6 py-3 w-full bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg font-medium transition-all"
              >
                <ChatBubbleIcon />
                <span>Take our feedback survey</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
