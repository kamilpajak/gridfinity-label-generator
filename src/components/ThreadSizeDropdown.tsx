import type { PropFunction } from '@builder.io/qwik'
import { $, component$, useSignal, useVisibleTask$ } from '@builder.io/qwik'
import { ChevronDownIcon } from './icons'
import { BaseDropdown } from './shared/BaseDropdown'

interface Props {
  selectedValue: string
  options: string[]
  onSelect$: PropFunction<(value: string) => void>
}

export const ThreadSizeDropdown = component$<Props>(({ selectedValue, options, onSelect$ }) => {
  const isOpen = useSignal(false)
  const optionsContainerRef = useSignal<Element>()
  const firstOptionRef = useSignal<Element>()

  // Focus first option when dropdown opens
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    track(() => isOpen.value)
    if (isOpen.value && firstOptionRef.value) {
      const firstOption = firstOptionRef.value as HTMLElement
      firstOption.focus()
    }
  })

  // Helper function to calculate next grid index
  const calculateNextIndex = $(
    (key: string, currentIndex: number, gridLength: number, cols: number): number | null => {
      const currentRow = Math.floor(currentIndex / cols)
      const currentCol = currentIndex % cols
      const rows = Math.ceil(gridLength / cols)

      const movements: Record<string, () => number | null> = {
        ArrowUp: () => (currentRow > 0 ? (currentRow - 1) * cols + currentCol : null),
        ArrowDown: () => {
          if (currentRow >= rows - 1) return null
          const next = (currentRow + 1) * cols + currentCol
          return next < gridLength ? next : null
        },
        ArrowLeft: () => (currentCol > 0 ? currentRow * cols + (currentCol - 1) : null),
        ArrowRight: () => {
          if (currentCol >= cols - 1 || currentIndex >= gridLength - 1) return null
          const next = currentRow * cols + (currentCol + 1)
          return next < gridLength ? next : null
        },
      }

      const movementFn = movements[key]
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      return movementFn ? movementFn() : null
    }
  )

  // Handle keyboard navigation for grid layout
  const handleGridKeyDown$ = $(async (event: KeyboardEvent, optionIndex: number) => {
    const { key } = event

    // Handle selection keys
    if (key === 'Enter' || key === ' ') {
      event.preventDefault()
      onSelect$(options[optionIndex])
      isOpen.value = false
      return
    }

    // Handle arrow keys
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
    if (!arrowKeys.includes(key)) return

    event.preventDefault()
    const grid = optionsContainerRef.value?.querySelectorAll('button[data-option]')
    if (!grid || grid.length === 0) return

    const gridArray = Array.from(grid) as HTMLElement[]
    const cols = window.innerWidth >= 640 ? 3 : 2
    const nextIndex = await calculateNextIndex(key, optionIndex, gridArray.length, cols)

    if (nextIndex !== null) {
      gridArray[nextIndex].focus()
    }
  })

  return (
    <BaseDropdown
      isOpen={isOpen.value}
      onToggle$={() => (isOpen.value = !isOpen.value)}
      setIsOpen$={(open: boolean) => (isOpen.value = open)}
      buttonClass="h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-left text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
      dropdownClass="bg-white border border-gray-200 rounded-lg shadow-lg"
    >
      <div q:slot="button" class="flex items-center justify-between w-full">
        <span>{selectedValue || 'Thread size...'}</span>
        <ChevronDownIcon />
      </div>

      <div q:slot="content" class="max-h-64 overflow-y-auto py-1">
        {/* Using role="listbox" for better accessibility with custom dropdown implementation */}
        <div
          class="grid grid-cols-2 sm:grid-cols-3 gap-0.5 p-0.5"
          ref={optionsContainerRef}
          role="listbox"
          aria-label="Thread size options"
        >
          {options.map((option, index) => (
            <button
              key={option}
              data-option={index}
              ref={index === 0 ? firstOptionRef : undefined}
              role="option"
              aria-selected={selectedValue === option}
              class={`
                h-12 px-3 rounded text-base font-medium transition-all
                ${
                  selectedValue === option
                    ? 'bg-blue-50 text-blue-700 border border-blue-600'
                    : 'hover:bg-gray-50 text-gray-700'
                }
              `}
              onClick$={() => {
                onSelect$(option)
                isOpen.value = false
              }}
              onKeyDown$={e => handleGridKeyDown$(e, index)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </BaseDropdown>
  )
})
