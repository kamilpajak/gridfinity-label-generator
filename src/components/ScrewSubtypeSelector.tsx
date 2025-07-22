import type { PropFunction } from '@builder.io/qwik'
import { component$ } from '@builder.io/qwik'
import { screwSubtypes } from '~/constants/hardware'
import { ButtonGroup } from './shared/ButtonGroup'

/**
 * Properties for ScrewSubtypeSelector component
 * @typedef {Object} ScrewSubtypeSelectorProps
 * @property {string} selectedSubtype - Currently selected screw subtype
 * @property {PropFunction<(subtype: string) => void>} onSubtypeChange$ - Handler for subtype changes
 */
interface Props {
  selectedSubtype: string
  onSubtypeChange$: PropFunction<(subtype: string) => void>
}

/**
 * Screw subtype selector component.
 * Allows users to choose between Bolt and Screw subtypes.
 *
 * @component
 * @param {ScrewSubtypeSelectorProps} props - Component properties
 * @returns {JSX.Element} Rendered selector with label and button group
 *
 * @example
 * <ScrewSubtypeSelector
 *   selectedSubtype="Bolt"
 *   onSubtypeChange$={(subtype) => updateScrewSubtype(subtype)}
 * />
 */
export const ScrewSubtypeSelector = component$<Props>(({ selectedSubtype, onSubtypeChange$ }) => (
  <div class="mt-4">
    <label class="block text-sm font-medium text-gray-700 mb-1">Screw Type</label>
    <ButtonGroup
      options={screwSubtypes}
      selectedValue={selectedSubtype}
      onSelect$={onSubtypeChange$}
      variant="secondary"
      columns={2}
    />
  </div>
))
