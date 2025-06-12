import type { PropFunction } from '@builder.io/qwik'
import { component$ } from '@builder.io/qwik'

interface Props {
  selectedType: string
  selectedSystem: string
  onTypeChange$: PropFunction<(type: string) => void>
  onSystemChange$: PropFunction<(system: string) => void>
}

export const HardwareTypeSelector = component$<Props>(
  ({ selectedType, selectedSystem, onTypeChange$, onSystemChange$ }) => (
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
      <div class="grid grid-cols-3 gap-0.5 bg-gray-50 p-0.5 rounded-lg">
        {['Screw', 'Nut', 'Washer'].map(type => (
          <button
            key={type}
            onClick$={() => onTypeChange$(type)}
            class={`
            h-[60px] px-3 rounded text-base font-medium transition-all
            ${
              selectedType === type
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-transparent text-gray-700 hover:bg-gray-100'
            }
          `}
          >
            {type}
          </button>
        ))}
      </div>

      <div class="grid grid-cols-2 gap-0.5 bg-gray-50 p-0.5 rounded-lg">
        {['Metric', 'Imperial'].map(system => (
          <button
            key={system}
            onClick$={() => onSystemChange$(system)}
            class={`
            h-[60px] px-3 rounded text-base font-medium transition-all
            ${
              selectedSystem === system
                ? 'bg-blue-100 text-blue-700 border border-blue-600'
                : 'bg-transparent text-gray-700 hover:bg-gray-100'
            }
          `}
          >
            {system}
          </button>
        ))}
      </div>
    </div>
  )
)
