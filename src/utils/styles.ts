/**
 * @fileoverview Centralized style constants and utilities for consistent UI styling
 * @module utils/styles
 */

/**
 * Common button and input styles used across the application
 * @constant {Object} COMMON_STYLES
 */
export const COMMON_STYLES = {
  /**
   * Base input field styling
   * Used for text inputs, dropdowns, and similar form controls
   * @type {string}
   */
  input:
    'h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent',

  /**
   * Small input field styling
   * Used for compact form inputs
   * @type {string}
   */
  inputSmall: 'h-[40px] px-3 bg-gray-50 border border-gray-200 rounded text-base text-gray-700',

  /**
   * Toggle button styling for unselected state
   * Used in button groups like hardware type selector
   * @type {string}
   */
  toggleButton: 'h-[60px] px-3 rounded text-base font-medium transition-all',

  /**
   * Toggle button styling for selected state (primary variant)
   * @type {string}
   */
  toggleButtonSelected: 'bg-blue-600 text-white shadow-xs',

  /**
   * Toggle button styling for selected state (secondary variant)
   * @type {string}
   */
  toggleButtonSelectedSecondary: 'bg-blue-100 text-blue-700 border border-blue-600',

  /**
   * Toggle button styling for unselected state
   * @type {string}
   */
  toggleButtonUnselected: 'bg-transparent text-gray-700 hover:bg-gray-100',

  /**
   * Settings panel row styling
   * Used for consistent spacing in settings rows
   * @type {string}
   */
  settingsRow:
    'flex items-center justify-between bg-white h-[60px] px-4 rounded-lg border border-gray-200',

  /**
   * Dropdown option button styling
   * Used in dropdown menus for individual options
   * @type {string}
   */
  dropdownOption: 'h-12 px-3 rounded text-base font-medium transition-all',

  /**
   * Dropdown option selected state
   * @type {string}
   */
  dropdownOptionSelected: 'bg-blue-50 text-blue-700 border border-blue-600',

  /**
   * Dropdown option hover state
   * @type {string}
   */
  dropdownOptionHover: 'hover:bg-gray-50 text-gray-700',
}

/**
 * Icon component styling
 * @constant {Object} ICON_STYLES
 */
export const ICON_STYLES = {
  /**
   * Default icon size and styling
   * @type {string}
   */
  default: 'w-5 h-5',

  /**
   * Small icon size
   * @type {string}
   */
  small: 'w-4 h-4',

  /**
   * Large icon size
   * @type {string}
   */
  large: 'w-6 h-6',
}

/**
 * Container and layout styles
 * @constant {Object} LAYOUT_STYLES
 */
export const LAYOUT_STYLES = {
  /**
   * Button group container styling
   * @type {string}
   */
  buttonGroup: 'grid gap-0.5 bg-gray-50 p-0.5 rounded-lg',

  /**
   * Settings panel container
   * @type {string}
   */
  settingsPanel: 'bg-white p-4 rounded-lg border border-gray-200',

  /**
   * Dropdown container
   * @type {string}
   */
  dropdownContainer:
    'absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg',
}

/**
 * Generates dynamic button classes based on selection state
 * @param {boolean} isSelected - Whether the button is selected
 * @param {'primary' | 'secondary'} [variant='primary'] - The style variant to use
 * @returns {string} Combined CSS classes for the button
 *
 * @example
 * // For a selected primary button
 * const classes = getToggleButtonClass(true, 'primary')
 * // Returns: "h-[60px] px-3 rounded text-base font-medium transition-all bg-blue-600 text-white shadow-xs"
 *
 * @example
 * // For an unselected button
 * const classes = getToggleButtonClass(false)
 * // Returns: "h-[60px] px-3 rounded text-base font-medium transition-all bg-transparent text-gray-700 hover:bg-gray-100"
 */
export function getToggleButtonClass(
  isSelected: boolean,
  variant: 'primary' | 'secondary' = 'primary'
): string {
  const baseClass = COMMON_STYLES.toggleButton

  if (isSelected) {
    const selectedClass =
      variant === 'primary'
        ? COMMON_STYLES.toggleButtonSelected
        : COMMON_STYLES.toggleButtonSelectedSecondary
    return `${baseClass} ${selectedClass}`
  }

  return `${baseClass} ${COMMON_STYLES.toggleButtonUnselected}`
}

/**
 * Generates dropdown option classes based on selection state
 * @param {boolean} isSelected - Whether the option is selected
 * @returns {string} Combined CSS classes for the dropdown option
 *
 * @example
 * const classes = getDropdownOptionClass(true)
 * // Returns: "h-12 px-3 rounded text-base font-medium transition-all bg-blue-50 text-blue-700 border border-blue-600"
 */
export function getDropdownOptionClass(isSelected: boolean): string {
  const baseClass = COMMON_STYLES.dropdownOption
  const stateClass = isSelected
    ? COMMON_STYLES.dropdownOptionSelected
    : COMMON_STYLES.dropdownOptionHover

  return `${baseClass} ${stateClass}`
}
