import { $, component$, useSignal, useStore, useTask$, useVisibleTask$ } from '@builder.io/qwik'
import { HardwareTypeSelector } from '~/components/HardwareTypeSelector'
import { Header } from '~/components/Header'
import { DownloadIcon } from '~/components/icons'
import { LabelPreview } from '~/components/LabelPreview'
import { SearchableDropdown } from '~/components/SearchableDropdown'
import { ScrewSubtypeSelector } from '~/components/ScrewSubtypeSelector'
import { SettingsPanel } from '~/components/SettingsPanel'
import { ThreadSizeDropdown } from '~/components/ThreadSizeDropdown'
import {
  dinStandards,
  getScrewStandardsBySubtype,
  imperialThreadSizes,
  metricThreadSizes,
  screwImperialSizes,
  screwMetricSizes,
  type ScrewSubtype,
} from '~/constants/hardware'
import { generateLabel, getLabelTexts } from '~/lib/labelGenerator'
import type { LabelSettings } from '~/types'
import { validateWidth } from '~/utils/measurements'

export default component$(() => {
  // State signals
  const selectedType = useSignal('Screw')
  const selectedScrewSubtype = useSignal<ScrewSubtype>('Bolt')
  const selectedSystem = useSignal('Metric')
  const threadSize = useSignal('')
  const hardwareStandard = useSignal('')
  const notes = useSignal('')
  const length = useSignal('')
  const isLoading = useSignal(false)
  const labelPreviewUrl = useSignal('')
  const isStandardDropdownOpen = useSignal(false)
  const standardSearchQuery = useSignal('')

  const settings = useStore<LabelSettings>({
    showStandardName: true,
    showImage: true,
    labelWidth: 55,
    showQrCode: true,
    qrCodeContent: '',
  })

  // Preload local fonts as soon as the component is visible
  useVisibleTask$(
    async () => {
      try {
        // Force browser to load the fonts defined in our CSS
        // We're using the same font file for both weights, but still need to load both weights
        await Promise.all([
          document.fonts.load('400 24px "Noto Sans"'),
          document.fonts.load('900 24px "Noto Sans"'),
          document.fonts.load('400 24px "Oswald"'),
          document.fonts.load('700 24px "Oswald"'),
        ])
        console.log('Local fonts preloaded successfully')
      } catch (error) {
        console.error('Failed to preload local fonts:', error)
        // Fonts will still be loaded by the browser through the CSS
        // This preloading is just to ensure they're available before rendering
      }
    },
    { strategy: 'document-ready' }
  )

  // Helper to reset input values when type or system changes.
  const resetInputs = $(() => {
    threadSize.value = ''
    hardwareStandard.value = ''
    length.value = ''
    notes.value = ''
    labelPreviewUrl.value = ''
  })

  const handleTypeChange$ = $((type: string) => {
    if (selectedType.value !== type) {
      selectedType.value = type
      if (type === 'Screw') {
        selectedScrewSubtype.value = 'Bolt'
      }
      resetInputs()
    }
  })

  const handleScrewSubtypeChange$ = $((subtype: string) => {
    if (selectedScrewSubtype.value !== subtype) {
      selectedScrewSubtype.value = subtype as ScrewSubtype
      threadSize.value = ''
      hardwareStandard.value = ''
      labelPreviewUrl.value = ''
    }
  })

  const handleSystemChange$ = $((system: string) => {
    if (selectedSystem.value !== system) {
      selectedSystem.value = system
      resetInputs()
    }
  })

  const handleSettingsChange$ = $((newSettings: Partial<LabelSettings>) => {
    if (newSettings.labelWidth !== undefined) {
      settings.labelWidth = validateWidth(newSettings.labelWidth)
    }
    if (newSettings.showStandardName !== undefined) {
      settings.showStandardName = newSettings.showStandardName
    }
    if (newSettings.showImage !== undefined) {
      settings.showImage = newSettings.showImage
    }
    if (newSettings.showQrCode !== undefined) {
      settings.showQrCode = newSettings.showQrCode
    }
    if (newSettings.qrCodeContent !== undefined) {
      settings.qrCodeContent = newSettings.qrCodeContent
    }
  })

  const generatePreview$ = $(async () => {
    if (
      !threadSize.value ||
      !hardwareStandard.value ||
      (selectedType.value === 'Screw' && !length.value)
    ) {
      return
    }

    let standard
    if (selectedType.value === 'Screw') {
      standard = getScrewStandardsBySubtype(selectedScrewSubtype.value).find(
        s => s.value === hardwareStandard.value
      )
    } else {
      standard = dinStandards[selectedType.value.toLowerCase() as keyof typeof dinStandards].find(
        s => s.value === hardwareStandard.value
      )
    }

    if (!standard) return

    isLoading.value = true
    try {
      const { topText, bottomText } = getLabelTexts(
        selectedType.value,
        selectedSystem.value,
        threadSize.value,
        length.value,
        hardwareStandard.value,
        notes.value,
        settings.showStandardName,
        selectedScrewSubtype.value
      )

      const labelUrl = await generateLabel(
        standard.image,
        topText,
        bottomText,
        settings.labelWidth,
        settings.showImage,
        settings.showQrCode,
        settings.qrCodeContent
      )

      if (labelUrl) {
        labelPreviewUrl.value = labelUrl
      }
    } catch (error) {
      console.error('Error generating label:', error)
    } finally {
      isLoading.value = false
    }
  })

  const handleDownload$ = $(() => {
    if (!labelPreviewUrl.value) return
    const link = document.createElement('a')
    link.href = labelPreviewUrl.value
    const filename = `${selectedType.value.toLowerCase()}-${
      selectedType.value === 'Screw' ? selectedScrewSubtype.value.toLowerCase() + '-' : ''
    }${threadSize.value}${length.value ? `-${length.value}` : ''}.png`
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  })

  // Automatically generate preview when input signals change.
  useTask$(({ track }) => {
    track(() => settings.labelWidth)
    track(() => settings.showStandardName)
    track(() => settings.showImage)
    track(() => settings.showQrCode)
    track(() => settings.qrCodeContent)
    track(() => threadSize.value)
    track(() => hardwareStandard.value)
    track(() => length.value)
    track(() => notes.value)

    if (threadSize.value || hardwareStandard.value || length.value || notes.value) {
      generatePreview$()
    }
  })

  // Render helper functions

  const getThreadSizeOptions = () => {
    if (selectedType.value === 'Screw' && selectedScrewSubtype.value === 'Screw') {
      return selectedSystem.value === 'Metric' ? screwMetricSizes : screwImperialSizes
    } else {
      return selectedSystem.value === 'Metric' ? metricThreadSizes : imperialThreadSizes
    }
  }

  const renderInputFields = () => (
    <div class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <ThreadSizeDropdown
          selectedValue={threadSize.value}
          options={getThreadSizeOptions()}
          onSelect$={(value: string) => (threadSize.value = value)}
        />
        {selectedType.value === 'Screw' && (
          <input
            type="text"
            required
            placeholder={
              selectedSystem.value === 'Metric' ? 'Length (e.g., 10)' : 'Length (e.g., 3/8″)'
            }
            class="w-full h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={length.value}
            onInput$={e => (length.value = (e.target as HTMLInputElement).value)}
          />
        )}
      </div>

      <input
        type="text"
        placeholder="Optional notes"
        class="w-full h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        value={notes.value}
        onInput$={e => (notes.value = (e.target as HTMLInputElement).value)}
      />
    </div>
  )

  const getFilteredStandards = () => {
    if (selectedType.value === 'Screw') {
      return getScrewStandardsBySubtype(selectedScrewSubtype.value)
    } else {
      return dinStandards[selectedType.value.toLowerCase() as keyof typeof dinStandards]
    }
  }

  const renderStandardDropdown = () => (
    <SearchableDropdown
      isOpen={isStandardDropdownOpen.value}
      onToggle$={() => (isStandardDropdownOpen.value = !isStandardDropdownOpen.value)}
      setIsOpen$={(open: boolean) => (isStandardDropdownOpen.value = open)}
      selectedValue={hardwareStandard.value}
      searchQuery={standardSearchQuery.value}
      onSearchChange$={(query: string) => (standardSearchQuery.value = query)}
      options={getFilteredStandards()}
      onSelect$={(value: string) => {
        hardwareStandard.value = value
        isStandardDropdownOpen.value = false
        standardSearchQuery.value = ''
      }}
    />
  )

  const renderDownloadSection = () => (
    <div class="grid grid-cols-1 sm:grid-cols-[1fr,217px] gap-4">
      <button
        class={`w-full flex items-center justify-center gap-3 h-[60px] rounded-lg text-base font-medium transition-all ${
          threadSize.value &&
          hardwareStandard.value &&
          (selectedType.value !== 'Screw' || length.value)
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
        onClick$={handleDownload$}
        disabled={
          !threadSize.value ||
          !hardwareStandard.value ||
          (selectedType.value === 'Screw' && !length.value)
        }
      >
        <DownloadIcon />
        <span>Download</span>
      </button>
      <a
        href="https://www.buymeacoffee.com/kamilpajak"
        target="_blank"
        rel="noopener noreferrer"
        class="block mx-auto sm:inline-block"
      >
        <img
          src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
          alt="Buy Me A Coffee"
          style={{ height: '60px', width: '217px' }}
          width="217"
          height="60"
          loading="lazy"
        />
      </a>
    </div>
  )

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

              {selectedType.value === 'Screw' && (
                <ScrewSubtypeSelector
                  selectedSubtype={selectedScrewSubtype.value}
                  onSubtypeChange$={handleScrewSubtypeChange$}
                />
              )}

              {renderInputFields()}
              {renderStandardDropdown()}

              <LabelPreview
                isLoading={isLoading.value}
                labelUrl={labelPreviewUrl.value}
                labelWidth={settings.labelWidth}
                showQrCode={settings.showQrCode}
              />

              {renderDownloadSection()}
            </div>

            <div class="hidden lg:block">
              <SettingsPanel settings={settings} onSettingsChange$={handleSettingsChange$} />
            </div>
          </div>
        </div>

        <div class="lg:hidden">
          <div class="bg-white rounded-xl shadow-lg overflow-hidden">
            <SettingsPanel settings={settings} onSettingsChange$={handleSettingsChange$} />
          </div>
        </div>
      </div>
    </div>
  )
})
