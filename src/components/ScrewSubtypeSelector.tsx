import type { PropFunction } from '@builder.io/qwik'
import { component$ } from '@builder.io/qwik'
import { screwSubtypes } from '~/constants/hardware'

interface Props {
  selectedSubtype: string
  onSubtypeChange$: PropFunction<(subtype: string) => void>
}

export const ScrewSubtypeSelector = component$<Props>(({ selectedSubtype, onSubtypeChange$ }) => (
  <div class="mt-4">
    <label class="block text-sm font-medium text-gray-700 mb-1">Screw Type</label>
    <div class="grid grid-cols-2 gap-2">
      {screwSubtypes.map(subtype => (
        <button
          key={subtype.value}
          class={`
              h-[60px] px-3 rounded text-base font-medium transition-all
              ${
                selectedSubtype === subtype.value
                  ? 'bg-blue-100 text-blue-700 border border-blue-600'
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }
            `}
          onClick$={() => onSubtypeChange$(subtype.value)}
        >
          {subtype.text}
        </button>
      ))}
    </div>
  </div>
))
