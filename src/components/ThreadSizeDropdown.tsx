import type { PropFunction } from '@builder.io/qwik'
import { $, component$, useOnDocument, useSignal, useVisibleTask$ } from '@builder.io/qwik'
import { ChevronDownIcon } from './icons'

interface Props {
  selectedValue: string
  options: string[]
  onSelect$: PropFunction<(value: string) => void>
}

export const ThreadSizeDropdown = component$<Props>(({ selectedValue, options, onSelect$ }) => {
  const isOpen = useSignal(false)
  const dropdownRef = useSignal<Element>()
  const optionsContainerRef = useSignal<Element>()
  const firstOptionRef = useSignal<Element>()

  // Focus first option when dropdown opens
  useVisibleTask$(({ track }) => {
    track(() => isOpen.value)
    if (isOpen.value && firstOptionRef.value) {
      ;(firstOptionRef.value as HTMLElement).focus()
    }
  })

  // Handle clicks outside the dropdown
  useOnDocument(
    'mousedown',
    $((event: Event) => {
      if (
        isOpen.value &&
        dropdownRef.value &&
        !(dropdownRef.value as HTMLElement).contains(event.target as Node)
      ) {
        isOpen.value = false
      }
    })
  )

  // Handle keyboard navigation
  const handleKeyDown$ = $(
    (event: KeyboardEvent, type: 'button' | 'option', optionIndex?: number) => {
      if (type === 'button') {
        if (
          (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') &&
          !isOpen.value
        ) {
          event.preventDefault()
          isOpen.value = true
        }
      } else if (type === 'option' && typeof optionIndex === 'number') {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect$(options[optionIndex])
          isOpen.value = false
        } else if (event.key === 'Escape') {
          event.preventDefault()
          isOpen.value = false
        } else if (
          event.key === 'ArrowUp' ||
          event.key === 'ArrowDown' ||
          event.key === 'ArrowLeft' ||
          event.key === 'ArrowRight'
        ) {
          event.preventDefault()

          const grid = optionsContainerRef.value?.querySelectorAll('button[data-option]')
          if (!grid || grid.length === 0) return

          const gridArray = Array.from(grid) as HTMLElement[]
          const currentIndex = optionIndex
          const cols = window.innerWidth >= 640 ? 3 : 2 // sm:grid-cols-3 or grid-cols-2
          const rows = Math.ceil(gridArray.length / cols)

          // Calculate current position
          const currentRow = Math.floor(currentIndex / cols)
          const currentCol = currentIndex % cols

          let nextIndex: number | null = null

          if (event.key === 'ArrowUp') {
            // Move up one row, same column
            if (currentRow > 0) {
              nextIndex = (currentRow - 1) * cols + currentCol
            }
          } else if (event.key === 'ArrowDown') {
            // Move down one row, same column
            if (currentRow < rows - 1) {
              nextIndex = (currentRow + 1) * cols + currentCol
              // Make sure we don't go beyond the available options
              if (nextIndex >= gridArray.length) {
                nextIndex = null
              }
            }
          } else if (event.key === 'ArrowLeft') {
            // Move left one column, same row
            if (currentCol > 0) {
              nextIndex = currentRow * cols + (currentCol - 1)
            }
          } else if (event.key === 'ArrowRight') {
            // Move right one column, same row
            if (currentCol < cols - 1 && currentIndex < gridArray.length - 1) {
              nextIndex = currentRow * cols + (currentCol + 1)
              // Make sure we don't go beyond the available options
              if (nextIndex >= gridArray.length) {
                nextIndex = null
              }
            }
          }

          if (nextIndex !== null && nextIndex >= 0 && nextIndex < gridArray.length) {
            gridArray[nextIndex].focus()
          }
        }
      }
    }
  )

  return (
    <div class="relative" ref={dropdownRef}>
      <button
        type="button"
        class="w-full h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-left text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
        onClick$={() => (isOpen.value = !isOpen.value)}
        onKeyDown$={e => handleKeyDown$(e, 'button')}
      >
        <span>{selectedValue || 'Thread size...'}</span>
        <ChevronDownIcon />
      </button>

      {isOpen.value && (
        <div class="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div class="max-h-64 overflow-y-auto py-1">
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-0.5 p-0.5" ref={optionsContainerRef}>
              {options.map((option, index) => (
                <button
                  key={option}
                  data-option={index}
                  ref={index === 0 ? firstOptionRef : undefined}
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
                  onKeyDown$={e => handleKeyDown$(e, 'option', index)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
