import type { PropFunction } from '@builder.io/qwik'
import { $, component$, useSignal, useTask$ } from '@builder.io/qwik'
import type { LabelSettings } from '~/types'
import { validateWidth, validateHeight } from '~/utils/measurements'
import { shouldShortenUrl, shortenUrl } from '~/utils/urlShortener'
import { logger } from '~/config/logging'
import { ToggleSwitch } from './shared/ToggleSwitch'
import { Tooltip } from './shared/Tooltip'
import { COMMON_STYLES } from '~/utils/styles'
import {
  ChatBubbleIcon,
  IdentifierIcon,
  ImageIcon,
  InfoIcon,
  QrCodeIcon,
  SettingsIcon,
} from './icons'

/**
 * Properties for SettingsPanel component
 * @typedef {Object} SettingsPanelProps
 * @property {LabelSettings} settings - Current label settings
 * @property {PropFunction<(settings: Partial<LabelSettings>) => void>} onSettingsChange$ - Handler for settings changes
 */
interface Props {
  settings: LabelSettings
  onSettingsChange$: PropFunction<(settings: Partial<LabelSettings>) => void>
}

/**
 * Settings panel component for label configuration.
 * Provides controls for toggling features, setting dimensions, and configuring label options.
 *
 * @component
 * @param {SettingsPanelProps} props - Component properties
 * @returns {JSX.Element} Rendered settings panel
 *
 * @example
 * <SettingsPanel
 *   settings={labelSettings}
 *   onSettingsChange$={(updates) => updateSettings(updates)}
 * />
 */
export const SettingsPanel = component$<Props>(({ settings, onSettingsChange$ }) => {
  // Validates and updates the label width (total physical width)
  const handleWidthChange$ = $((value: string | number) => {
    const validatedWidth = validateWidth(value)
    onSettingsChange$({ labelWidth: validatedWidth })
  })

  // Validates and updates the printable height (not including margins)
  const handleHeightChange$ = $((value: string | number) => {
    const validatedHeight = validateHeight(value)
    onSettingsChange$({ labelHeight: validatedHeight })
  })

  // Signal to store the shortened URL preview
  const shortenedUrlPreview = useSignal<string>('')

  // Update the shortened URL preview when QR code content changes
  useTask$(async ({ track }) => {
    const qrContent = track(() => settings.qrCodeContent)

    if (shouldShortenUrl(qrContent)) {
      try {
        const shortened = await shortenUrl(qrContent)
        shortenedUrlPreview.value = shortened
      } catch (error) {
        logger.error('Failed to get shortened URL preview:', error)
        shortenedUrlPreview.value = ''
      }
    } else {
      shortenedUrlPreview.value = ''
    }
  })

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
          <div class={COMMON_STYLES.settingsRow}>
            <div class="flex items-center gap-3">
              <IdentifierIcon />
              <span class="text-base text-gray-700">Standard Reference</span>
            </div>
            <ToggleSwitch
              checked={settings.showStandardName}
              onChange$={checked => onSettingsChange$({ showStandardName: checked })}
              label="Show standard reference on label"
            />
          </div>

          <div class={COMMON_STYLES.settingsRow}>
            <div class="flex items-center gap-3">
              <ImageIcon />
              <span class="text-base text-gray-700">Image</span>
            </div>
            <ToggleSwitch
              checked={settings.showImage}
              onChange$={checked => onSettingsChange$({ showImage: checked })}
              label="Show image on label"
            />
          </div>

          <div class={COMMON_STYLES.settingsRow}>
            <div class="flex items-center gap-3">
              <QrCodeIcon />
              <span class="text-base text-gray-700">QR Code</span>
              {settings.labelHeight < 12 && (
                <Tooltip text="Minimum 12mm height required">
                  <span class="text-gray-400 hover:text-gray-600">
                    <InfoIcon />
                  </span>
                </Tooltip>
              )}
            </div>
            <ToggleSwitch
              checked={settings.showQrCode}
              onChange$={checked => onSettingsChange$({ showQrCode: checked })}
              disabled={settings.labelHeight < 12}
              label="Show QR code on label"
            />
          </div>

          {settings.showQrCode && settings.labelHeight >= 12 && (
            <div class="bg-white p-4 rounded-lg border border-gray-200">
              <div class="flex items-center gap-2 mb-2">
                <label class="block text-base text-gray-700">QR Code Content</label>
                <Tooltip
                  text="Long URLs will be automatically shortened for better QR code readability. This makes the QR code simpler and easier to scan on small labels."
                  multiline={true}
                  class="min-w-[250px] max-w-[90vw] sm:max-w-xs"
                >
                  <span class="cursor-help text-gray-400 hover:text-gray-600">
                    <InfoIcon />
                  </span>
                </Tooltip>
              </div>
              <input
                type="text"
                class="w-full h-[40px] px-3 bg-gray-50 border border-gray-200 rounded text-base text-gray-700"
                value={settings.qrCodeContent}
                onInput$={e =>
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
              <div class="flex items-center gap-2">
                <span class="text-base text-gray-700">Label Width</span>
                <Tooltip
                  text="The label width is the total physical width. The printable area is 4mm narrower (2mm margin on each side)."
                  multiline={true}
                  class="min-w-[250px] max-w-[90vw] sm:max-w-xs"
                >
                  <span class="cursor-help text-gray-400 hover:text-gray-600">
                    <InfoIcon />
                  </span>
                </Tooltip>
              </div>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  min="37"
                  max="100"
                  class="w-16 h-[40px] px-2 bg-gray-50 border border-gray-200 rounded text-right text-base text-gray-700"
                  value={settings.labelWidth}
                  onInput$={e => handleWidthChange$((e.target as HTMLInputElement).value)}
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
                onInput$={e => handleWidthChange$((e.target as HTMLInputElement).value)}
                class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div class="flex justify-between text-xs text-gray-500">
                <span>37mm</span>
                <span>100mm</span>
              </div>
            </div>
          </div>

          <div class="bg-white p-4 rounded-lg border border-gray-200">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <span class="text-base text-gray-700">Label Height</span>
                <Tooltip
                  text="This controls the total physical height of the label. The printable area is 2mm shorter (1mm margin on top and bottom)."
                  multiline={true}
                  class="min-w-[250px] max-w-[90vw] sm:max-w-xs"
                >
                  <span class="cursor-help text-gray-400 hover:text-gray-600">
                    <InfoIcon />
                  </span>
                </Tooltip>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2">
              {[9, 12, 18, 24].map(height => (
                <button
                  key={height}
                  onClick$={() => handleHeightChange$(height)}
                  class={`px-3 py-2 text-sm rounded-md transition-all ${
                    settings.labelHeight === height
                      ? 'bg-blue-500 text-white font-medium'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {height} mm
                </button>
              ))}
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
              <span>Provide feedback</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
})
