import type { PropFunction } from '@builder.io/qwik'
import { component$ } from '@builder.io/qwik'
import { getToggleButtonClass, LAYOUT_STYLES } from '~/utils/styles'

/**
 * Individual button option configuration
 * @typedef {Object} ButtonOption
 * @property {string} value - The value associated with this button
 * @property {string} text - The display text for the button
 * @property {boolean} [disabled] - Whether this button is disabled
 */
export interface ButtonOption {
  value: string
  text: string
  disabled?: boolean
}

/**
 * Properties for the ButtonGroup component
 * @typedef {Object} ButtonGroupProps
 * @property {ButtonOption[]} options - Array of button options to display
 * @property {string} selectedValue - Currently selected value
 * @property {PropFunction<(value: string) => void>} onSelect$ - Function called when a button is selected
 * @property {'primary' | 'secondary'} [variant] - Visual style variant (default: 'primary')
 * @property {number} [columns] - Number of columns in the button grid (default: auto)
 * @property {string} [className] - Additional CSS classes for the container
 */
interface ButtonGroupProps {
  options: ButtonOption[]
  selectedValue: string
  onSelect$: PropFunction<(value: string) => void>
  variant?: 'primary' | 'secondary'
  columns?: number
  className?: string
}

/**
 * Button group component for selecting a single option from multiple choices.
 * Displays buttons in a grid layout with consistent styling and selection states.
 *
 * @component
 * @param {ButtonGroupProps} props - Component properties
 * @returns {JSX.Element} Rendered button group
 *
 * @example
 * // Basic usage with 3 columns
 * const hardwareTypes = [
 *   { value: 'Screw', text: 'Screw' },
 *   { value: 'Nut', text: 'Nut' },
 *   { value: 'Washer', text: 'Washer' }
 * ]
 *
 * <ButtonGroup
 *   options={hardwareTypes}
 *   selectedValue={selectedType.value}
 *   onSelect$={(value) => selectedType.value = value}
 *   columns={3}
 * />
 *
 * @example
 * // With secondary variant and auto columns
 * const systems = [
 *   { value: 'Metric', text: 'Metric' },
 *   { value: 'Imperial', text: 'Imperial' }
 * ]
 *
 * <ButtonGroup
 *   options={systems}
 *   selectedValue={selectedSystem.value}
 *   onSelect$={handleSystemChange}
 *   variant="secondary"
 * />
 *
 * @example
 * // With disabled options
 * const heights = [
 *   { value: '9', text: '9mm' },
 *   { value: '12', text: '12mm' },
 *   { value: '18', text: '18mm', disabled: true },
 *   { value: '24', text: '24mm', disabled: true }
 * ]
 *
 * <ButtonGroup
 *   options={heights}
 *   selectedValue={selectedHeight.value}
 *   onSelect$={updateHeight}
 *   columns={4}
 * />
 */
export const ButtonGroup = component$<ButtonGroupProps>(
  ({ options, selectedValue, onSelect$, variant = 'primary', columns, className = '' }) => {
    /**
     * Determine grid columns class based on columns prop or options length
     * @returns {string} Tailwind grid columns class
     */
    const getGridColumnsClass = (): string => {
      if (columns) {
        return `grid-cols-${columns}`
      }

      // Auto-determine columns based on number of options
      const optionCount = options.length
      if (optionCount <= 2) return 'grid-cols-2'
      if (optionCount <= 3) return 'grid-cols-3'
      if (optionCount <= 4) return 'grid-cols-4'
      return 'grid-cols-3' // Default for more than 4 options
    }

    return (
      <div class={`${LAYOUT_STYLES.buttonGroup} ${getGridColumnsClass()} ${className}`}>
        {options.map(option => (
          <button
            key={option.value}
            onClick$={() => !option.disabled && onSelect$(option.value)}
            disabled={option.disabled}
            class={getToggleButtonClass(selectedValue === option.value, variant)}
            aria-pressed={selectedValue === option.value}
            aria-disabled={option.disabled}
          >
            {option.text}
          </button>
        ))}
      </div>
    )
  }
)
