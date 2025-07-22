import type { PropFunction } from '@builder.io/qwik'
import { component$ } from '@builder.io/qwik'

/**
 * Properties for the ToggleSwitch component
 * @typedef {Object} ToggleSwitchProps
 * @property {boolean} checked - Current state of the toggle switch
 * @property {PropFunction<(checked: boolean) => void>} onChange$ - Function called when toggle state changes
 * @property {boolean} [disabled] - Whether the toggle is disabled
 * @property {string} [label] - Accessible label for screen readers
 * @property {string} [id] - HTML id attribute for the input element
 */
interface ToggleSwitchProps {
  checked: boolean
  onChange$: PropFunction<(checked: boolean) => void>
  disabled?: boolean
  label?: string
  id?: string
}

/**
 * Toggle switch component for boolean on/off selections.
 * Provides an accessible, styled toggle switch with smooth transitions.
 *
 * @component
 * @param {ToggleSwitchProps} props - Component properties
 * @returns {JSX.Element} Rendered toggle switch
 *
 * @example
 * // Basic usage
 * <ToggleSwitch
 *   checked={isEnabled.value}
 *   onChange$={(checked) => isEnabled.value = checked}
 * />
 *
 * @example
 * // With label and disabled state
 * <ToggleSwitch
 *   checked={settings.showImage}
 *   onChange$={(checked) => updateSettings({ showImage: checked })}
 *   label="Show image on label"
 *   disabled={!hasImageSupport}
 *   id="show-image-toggle"
 * />
 */
export const ToggleSwitch = component$<ToggleSwitchProps>(
  ({ checked, onChange$, disabled = false, label, id }) => {
    return (
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange$={e => onChange$((e.target as HTMLInputElement).checked)}
          class="sr-only peer"
          aria-label={label}
          id={id}
        />
        <div
          class={`
            w-12 h-6 rounded-full peer 
            after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
            after:bg-white after:border-gray-300 after:border after:rounded-full 
            after:h-5 after:w-5 after:transition-all
            ${
              disabled
                ? 'bg-gray-100 cursor-not-allowed'
                : 'bg-gray-200 peer-checked:after:translate-x-full peer-checked:bg-blue-600'
            }
          `}
          aria-hidden="true"
        />
      </label>
    )
  }
)
