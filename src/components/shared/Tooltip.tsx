import { component$, Slot } from '@builder.io/qwik'

/**
 * Tooltip position options
 * @typedef {'top' | 'bottom' | 'left' | 'right'} TooltipPosition
 */
type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

/**
 * Properties for the Tooltip component
 * @typedef {Object} TooltipProps
 * @property {string} text - The text content to display in the tooltip
 * @property {TooltipPosition} [position] - Position of tooltip relative to trigger (default: 'bottom')
 * @property {string} [class] - Additional CSS classes for the tooltip container
 * @property {boolean} [multiline] - Whether tooltip content can wrap to multiple lines
 */
interface TooltipProps {
  text: string
  position?: TooltipPosition
  class?: string
  multiline?: boolean
}

/**
 * Tooltip component that displays contextual information on hover.
 * Provides a consistent way to show help text and additional information.
 *
 * @component
 * @param {TooltipProps} props - Component properties
 * @returns {JSX.Element} Rendered tooltip component
 *
 * @example
 * // Basic usage with bottom position
 * <Tooltip text="This is helpful information">
 *   <InfoIcon />
 * </Tooltip>
 *
 * @example
 * // With custom position and multiline text
 * <Tooltip
 *   text="Long URLs will be automatically shortened for better QR code readability."
 *   position="top"
 *   multiline={true}
 * >
 *   <button>Hover me</button>
 * </Tooltip>
 *
 * @example
 * // With custom styling
 * <Tooltip
 *   text="Custom styled tooltip"
 *   className="max-w-xs"
 *   position="right"
 * >
 *   <span>?</span>
 * </Tooltip>
 */
export const Tooltip = component$<TooltipProps>(
  ({ text, position = 'bottom', class: className = '', multiline = false }) => {
    /**
     * Get position-specific CSS classes for tooltip placement
     * @param {TooltipPosition} pos - The position of the tooltip
     * @returns {Object} CSS class configuration for positioning
     */
    const getPositionClasses = (pos: TooltipPosition) => {
      const positions = {
        top: {
          tooltip: 'bottom-full mb-2 left-1/2 transform -translate-x-1/2',
          arrow:
            'top-full left-1/2 transform -translate-x-1/2 border-t-gray-800 border-l-transparent border-r-transparent border-b-transparent',
        },
        bottom: {
          tooltip: 'top-full mt-2 left-1/2 transform -translate-x-1/2',
          arrow:
            'bottom-full left-1/2 transform -translate-x-1/2 border-b-gray-800 border-l-transparent border-r-transparent border-t-transparent',
        },
        left: {
          tooltip: 'right-full mr-2 top-1/2 transform -translate-y-1/2',
          arrow:
            'left-full top-1/2 transform -translate-y-1/2 border-l-gray-800 border-t-transparent border-b-transparent border-r-transparent',
        },
        right: {
          tooltip: 'left-full ml-2 top-1/2 transform -translate-y-1/2',
          arrow:
            'right-full top-1/2 transform -translate-y-1/2 border-r-gray-800 border-t-transparent border-b-transparent border-l-transparent',
        },
      }
      return positions[pos]
    }

    const positionClasses = getPositionClasses(position)

    return (
      <div class="relative group inline-block">
        {/* Trigger element (provided via slot) */}
        <div class="cursor-help">
          <Slot />
        </div>

        {/* Tooltip container */}
        <div
          class={`absolute ${positionClasses.tooltip} hidden group-hover:block z-10 ${className}`}
          role="tooltip"
        >
          {/* Tooltip content */}
          <div
            class={`
              bg-gray-800 text-white text-xs rounded px-2 py-1 
              ${multiline ? '' : 'whitespace-nowrap'}
            `}
          >
            {text}
          </div>

          {/* Arrow pointer */}
          <div
            class={`
              absolute w-0 h-0 
              border-l-4 border-r-4 border-t-4 border-b-4
              ${positionClasses.arrow}
            `}
            aria-hidden="true"
          />
        </div>
      </div>
    )
  }
)
