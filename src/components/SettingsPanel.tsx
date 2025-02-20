import type { PropFunction } from "@builder.io/qwik";
import { $, component$ } from "@builder.io/qwik";
import { IdentifierIcon, ImageIcon, SettingsIcon } from "./icons";
import type { LabelSettings } from "~/types";
import { validateWidth } from "~/utils/measurements";

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

    return (
      <div class="h-full bg-gray-50">
        <div class="p-8 space-y-6">
          <div class="flex items-center gap-3 text-gray-700">
            <SettingsIcon />
            <h3 class="text-lg font-medium">Label Settings</h3>
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

            <div class="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-base text-gray-700">Width</span>
                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    min="40"
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
                  min="40"
                  max="100"
                  value={settings.labelWidth}
                  onInput$={(e) =>
                    handleWidthChange$((e.target as HTMLInputElement).value)
                  }
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
      </div>
    );
  },
);
