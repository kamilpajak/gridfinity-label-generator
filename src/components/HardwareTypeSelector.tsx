import type { PropFunction } from '@builder.io/qwik'
import { component$ } from '@builder.io/qwik'
import { ButtonGroup } from './shared/ButtonGroup'

/**
 * Properties for HardwareTypeSelector component
 * @typedef {Object} HardwareTypeSelectorProps
 * @property {string} selectedType - Currently selected hardware type
 * @property {string} selectedSystem - Currently selected measurement system
 * @property {PropFunction<(type: string) => void>} onTypeChange$ - Handler for hardware type changes
 * @property {PropFunction<(system: string) => void>} onSystemChange$ - Handler for measurement system changes
 */
interface Props {
  selectedType: string
  selectedSystem: string
  onTypeChange$: PropFunction<(type: string) => void>
  onSystemChange$: PropFunction<(system: string) => void>
}

/**
 * Hardware type and measurement system selector component.
 * Allows users to choose between different hardware types (Screw, Nut, Washer)
 * and measurement systems (Metric, Imperial).
 *
 * @component
 * @param {HardwareTypeSelectorProps} props - Component properties
 * @returns {JSX.Element} Rendered selector with two button groups
 *
 * @example
 * <HardwareTypeSelector
 *   selectedType="Screw"
 *   selectedSystem="Metric"
 *   onTypeChange$={(type) => updateHardwareType(type)}
 *   onSystemChange$={(system) => updateMeasurementSystem(system)}
 * />
 */
export const HardwareTypeSelector = component$<Props>(
  ({ selectedType, selectedSystem, onTypeChange$, onSystemChange$ }) => {
    const hardwareTypes = [
      { value: 'Screw', text: 'Screw' },
      { value: 'Nut', text: 'Nut' },
      { value: 'Washer', text: 'Washer' },
    ]

    const measurementSystems = [
      { value: 'Metric', text: 'Metric' },
      { value: 'Imperial', text: 'Imperial' },
    ]

    return (
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <ButtonGroup
          options={hardwareTypes}
          selectedValue={selectedType}
          onSelect$={onTypeChange$}
          columns={3}
        />

        <ButtonGroup
          options={measurementSystems}
          selectedValue={selectedSystem}
          onSelect$={onSystemChange$}
          variant="secondary"
          columns={2}
        />
      </div>
    )
  }
)
