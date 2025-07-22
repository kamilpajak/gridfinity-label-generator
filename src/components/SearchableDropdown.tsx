import type { PropFunction } from '@builder.io/qwik'
import { $, component$, useSignal, useVisibleTask$ } from '@builder.io/qwik'
import { ChevronDownIcon } from './icons'
import { BaseDropdown } from './shared/BaseDropdown'
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
    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track }) => {
      track(() => isOpen)
      if (isOpen && searchInputRef.value) {
        searchInputRef.value.focus()
      }
    })

    // Handle keyboard interactions specific to searchable list
    const handleSearchKeyDown$ = $((event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        // Focus first option if available
        const options = dropdownRef.value?.querySelectorAll('button[data-option]')
        if (options && options.length > 0) {
          const firstOption = options[0] as HTMLElement
          firstOption.focus()
        }
      }
    })

    const handleOptionKeyDown$ = $((event: KeyboardEvent, index: number) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        const option = filteredOptions[index]
        onSelect$(option.value)
        setIsOpen$(false)
        onSearchChange$('')
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
    })

    // Filter options based on the search query (case-insensitive)
    const filteredOptions = options.filter(option =>
      option.text.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
      <BaseDropdown
        isOpen={isOpen}
        onToggle$={onToggle$}
        setIsOpen$={setIsOpen$}
        buttonClass="h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-left text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
        dropdownClass="bg-white border border-gray-200 rounded-lg shadow-lg"
        dropdownRef={dropdownRef}
      >
        <div q:slot="button" class="flex items-center justify-between w-full">
          <span>{selectedValue || 'Hardware standard...'}</span>
          <ChevronDownIcon />
        </div>

        <div q:slot="content">
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
              onKeyDown$={handleSearchKeyDown$}
            />
          </div>

          {/* Scrollable container for options */}
          {/* Using role="listbox" for better accessibility with custom dropdown implementation */}
          <div
            class="max-h-64 overflow-y-auto"
            role="listbox"
            aria-label="Hardware standard options"
          >
            {filteredOptions.map((option, index) => (
              <button
                key={option.value}
                data-option={index}
                role="option"
                aria-selected={selectedValue === option.value}
                class={`
                  w-full h-20 px-4 flex items-center text-left
                  hover:bg-gray-50 focus:bg-gray-50 focus:outline-hidden
                `}
                onClick$={$(() => {
                  onSelect$(option.value)
                  setIsOpen$(false) // Explicitly close dropdown after selection
                  onSearchChange$('')
                })}
                onKeyDown$={e => handleOptionKeyDown$(e, index)}
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
                      width={96}
                      height={64}
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
      </BaseDropdown>
    )
  }
)
