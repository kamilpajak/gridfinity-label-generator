import type { PropFunction } from '@builder.io/qwik'
import { $, component$, useOnDocument, useSignal, useVisibleTask$ } from '@builder.io/qwik'
import { ChevronDownIcon } from './icons'
import type { DINStandard } from '~/types'

interface Props {
  isOpen: boolean // Controls dropdown open/closed state
  selectedValue: string // Currently selected value
  options: DINStandard[] // List of available options
  searchQuery: string // Current search query
  onToggle$: PropFunction<() => void> // Function to toggle dropdown state
  onSearchChange$: PropFunction<(query: string) => void> // Function to handle search query changes
  onSelect$: PropFunction<(value: string) => void> // Function called when an option is selected
  setIsOpen$: PropFunction<(isOpen: boolean) => void> // Explicitly set dropdown open state
}

export const SearchableDropdown = component$<Props>(
  ({
    isOpen,
    selectedValue,
    options,
    searchQuery,
    onToggle$,
    onSearchChange$,
    onSelect$,
    setIsOpen$,
  }) => {
    // References to DOM elements for keyboard navigation
    const dropdownRef = useSignal<Element>()
    const searchInputRef = useSignal<HTMLInputElement>()

    // Focus the search input when dropdown opens
    useVisibleTask$(({ track }) => {
      track(() => isOpen)
      if (isOpen && searchInputRef.value) {
        searchInputRef.value.focus()
      }
    })

    // Handle clicks outside the dropdown
    useOnDocument(
      'mousedown',
      $((event: Event) => {
        if (
          isOpen &&
          dropdownRef.value &&
          !(dropdownRef.value as HTMLElement).contains(event.target as Node)
        ) {
          setIsOpen$(false)
        }
      })
    )

    // Handle keyboard interactions
    const handleKeyDown$ = $(
      (event: KeyboardEvent, type: 'button' | 'search' | 'option', index?: number) => {
        if (type === 'button') {
          if (
            (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') &&
            !isOpen
          ) {
            event.preventDefault()
            onToggle$()
          }
        } else if (type === 'search') {
          if (event.key === 'Escape') {
            event.preventDefault()
            setIsOpen$(false)
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            // Focus first option if available
            const options = dropdownRef.value?.querySelectorAll('button[data-option]')
            if (options && options.length > 0) {
              const firstOption = options[0] as HTMLElement
              firstOption.focus()
            }
          }
        } else if (type === 'option' && typeof index === 'number') {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            const option = filteredOptions[index]
            onSelect$(option.value)
            setIsOpen$(false)
            onSearchChange$('')
          } else if (event.key === 'Escape') {
            event.preventDefault()
            setIsOpen$(false)
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (index === 0) {
              // Focus back to search input
              searchInputRef.value?.focus()
            } else {
              // Focus previous option
              const options = dropdownRef.value?.querySelectorAll('button[data-option]')
              if (options && index > 0) {
                const prevOption = options[index - 1] as HTMLElement
                prevOption.focus()
              }
            }
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            // Focus next option if available
            const options = dropdownRef.value?.querySelectorAll('button[data-option]')
            if (options && index < options.length - 1) {
              const nextOption = options[index + 1] as HTMLElement
              nextOption.focus()
            }
          }
        }
      }
    )

    // Filter options based on the search query (case-insensitive)
    const filteredOptions = options.filter(option =>
      option.text.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
      <div class="relative" ref={dropdownRef}>
        {/* Button to toggle the dropdown */}
        <button
          type="button"
          class="w-full h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-left text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
          onClick$={onToggle$}
          onKeyDown$={e => handleKeyDown$(e, 'button')}
        >
          <span>{selectedValue || 'Hardware standard...'}</span>
          <ChevronDownIcon />
        </button>

        {/* Dropdown menu, visible only when dropdown is open */}
        {isOpen && (
          <div class="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
            {/* Search input at the top */}
            <div class="p-2 border-b border-gray-100">
              <input
                ref={searchInputRef}
                type="text"
                class="w-full h-10 px-4 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Search standards..."
                value={searchQuery}
                onInput$={e => onSearchChange$((e.target as HTMLInputElement).value)}
                onClick$={e => e.stopPropagation()}
                onKeyDown$={e => handleKeyDown$(e, 'search')}
              />
            </div>

            {/* Scrollable container for options */}
            <div class="max-h-64 overflow-y-auto">
              {filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  data-option={index}
                  class={`
                    w-full h-20 px-4 flex items-center text-left
                    hover:bg-gray-50 focus:bg-gray-50 focus:outline-hidden
                  `}
                  onClick$={$(() => {
                    onSelect$(option.value)
                    setIsOpen$(false) // Explicitly close dropdown after selection
                    onSearchChange$('')
                  })}
                  onKeyDown$={e => handleKeyDown$(e, 'option', index)}
                >
                  <div class="flex items-center gap-4 w-full">
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-gray-900 truncate">{option.value}</div>
                      <div class="text-sm text-gray-500 truncate">
                        {option.text.replace(option.value + ' - ', '')}
                      </div>
                    </div>
                    <div class="shrink-0 w-24 h-16 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center">
                      <img
                        src={option.image.replace('.svg', '.jpg')}
                        alt={option.value}
                        class="max-h-full max-w-full object-contain"
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                      />
                    </div>
                  </div>
                </button>
              ))}
              {filteredOptions.length === 0 && (
                <div class="px-4 py-3 text-sm text-gray-500">No standards found</div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
)
