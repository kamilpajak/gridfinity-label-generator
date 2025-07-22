import type { PropFunction, Signal } from '@builder.io/qwik'
import { $, component$, Slot, useOnDocument, useSignal } from '@builder.io/qwik'

/**
 * Properties for the BaseDropdown component
 * @typedef {Object} BaseDropdownProps
 * @property {boolean} isOpen - Controls dropdown visibility
 * @property {PropFunction<() => void>} onToggle$ - Function to toggle dropdown open/closed state
 * @property {PropFunction<(isOpen: boolean) => void>} [setIsOpen$] - Function to explicitly set dropdown state
 * @property {string} [buttonClass] - Additional CSS classes for the dropdown button
 * @property {string} [dropdownClass] - Additional CSS classes for the dropdown container
 * @property {Signal<Element>} [dropdownRef] - Optional external ref for the dropdown container
 * @property {boolean} [closeOnSelect] - Whether to close dropdown when an option is selected (default: true)
 */
interface BaseDropdownProps {
  isOpen: boolean
  onToggle$: PropFunction<() => void>
  setIsOpen$?: PropFunction<(isOpen: boolean) => void>
  buttonClass?: string
  dropdownClass?: string
  dropdownRef?: Signal<Element | undefined>
  closeOnSelect?: boolean
}

/**
 * Base dropdown component that provides common dropdown functionality
 * including click-outside detection, keyboard navigation support, and focus management.
 *
 * @component
 * @param {BaseDropdownProps} props - Component properties
 * @returns {JSX.Element} Rendered dropdown component with slots for customization
 *
 * @example
 * // Basic usage
 * <BaseDropdown
 *   isOpen={isDropdownOpen.value}
 *   onToggle$={() => isDropdownOpen.value = !isDropdownOpen.value}
 * >
 *   <div q:slot="button">Select an option</div>
 *   <div q:slot="content">
 *     <button>Option 1</button>
 *     <button>Option 2</button>
 *   </div>
 * </BaseDropdown>
 *
 * @example
 * // With custom styling and refs
 * <BaseDropdown
 *   isOpen={isOpen.value}
 *   onToggle$={handleToggle}
 *   setIsOpen$={setIsOpen}
 *   buttonClass="custom-button-class"
 *   dropdownClass="custom-dropdown-class"
 *   dropdownRef={myDropdownRef}
 * >
 *   <div q:slot="button">Custom Button</div>
 *   <div q:slot="content">Custom Content</div>
 * </BaseDropdown>
 */
export const BaseDropdown = component$<BaseDropdownProps>(
  ({
    isOpen,
    onToggle$,
    setIsOpen$,
    buttonClass = '',
    dropdownClass = '',
    dropdownRef: externalRef,
  }) => {
    // Use internal ref if external ref not provided
    const internalRef = useSignal<Element>()
    const dropdownRef = externalRef || internalRef

    /**
     * Handle clicks outside the dropdown to close it
     * This ensures the dropdown closes when user clicks anywhere else on the page
     */
    useOnDocument(
      'mousedown',
      $((event: Event) => {
        if (
          isOpen &&
          dropdownRef.value &&
          !(dropdownRef.value as HTMLElement).contains(event.target as Node)
        ) {
          if (setIsOpen$) {
            setIsOpen$(false)
          } else {
            onToggle$()
          }
        }
      })
    )

    /**
     * Handle keyboard navigation for the dropdown button
     * Supports Enter, Space, and ArrowDown keys to open the dropdown
     *
     * @param {KeyboardEvent} event - The keyboard event
     */
    const handleButtonKeyDown$ = $((event: KeyboardEvent) => {
      if ((event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') && !isOpen) {
        event.preventDefault()
        onToggle$()
      }
    })

    /**
     * Handle keyboard navigation within dropdown content
     * Supports Escape key to close dropdown and arrow keys for navigation
     *
     * @param {KeyboardEvent} event - The keyboard event
     */
    const handleContentKeyDown$ = $((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (setIsOpen$) {
          setIsOpen$(false)
        } else {
          onToggle$()
        }
      }
    })

    return (
      <div class="relative" ref={dropdownRef}>
        {/* Dropdown trigger button */}
        <button
          type="button"
          class={`w-full ${buttonClass}`}
          onClick$={onToggle$}
          onKeyDown$={handleButtonKeyDown$}
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <Slot name="button" />
        </button>

        {/* Dropdown content */}
        {isOpen && (
          <div
            class={`absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg ${dropdownClass}`}
            onKeyDown$={handleContentKeyDown$}
          >
            <Slot name="content" />
          </div>
        )}
      </div>
    )
  }
)
