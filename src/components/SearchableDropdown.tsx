import type { PropFunction } from "@builder.io/qwik";
import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { ChevronDownIcon } from "./icons";
import type { DINStandard } from "~/types";

interface Props {
  isOpen: boolean; // Controls dropdown open/closed state
  selectedValue: string; // Currently selected value
  options: DINStandard[]; // List of available options
  searchQuery: string; // Current search query
  onToggle$: PropFunction<() => void>; // Function to toggle dropdown state
  onSearchChange$: PropFunction<(query: string) => void>; // Function to handle search query changes
  onSelect$: PropFunction<(value: string) => void>; // Function called when an option is selected
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
  }) => {
    // Reference to the main dropdown element (for handling clicks outside)
    const dropdownRef = useSignal<Element>();

    // Close dropdown if clicked outside
    useVisibleTask$(({ cleanup }) => {
      function handleClickOutside(event: MouseEvent) {
        if (
          isOpen &&
          dropdownRef.value &&
          !(dropdownRef.value as HTMLElement).contains(event.target as Node)
        ) {
          onToggle$();
        }
      }

      document.addEventListener("mousedown", handleClickOutside);
      cleanup(() =>
        document.removeEventListener("mousedown", handleClickOutside),
      );
    });

    // Filter options based on the search query
    const filteredOptions = options.filter((option) =>
      option.text.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    return (
      <div class="relative" ref={dropdownRef}>
        {/* Button to toggle the dropdown */}
        <button
          type="button"
          class="
          w-full h-[60px] px-4 bg-white border border-gray-300
          rounded-lg text-base text-left text-gray-700
          focus:ring-2 focus:ring-blue-500 focus:border-transparent
          flex items-center justify-between
        "
          onClick$={onToggle$}
        >
          <span>{selectedValue || "Hardware standard..."}</span>
          <ChevronDownIcon />
        </button>

        {/* Options list (visible only when dropdown is open) */}
        {isOpen && (
          <div
            class="
            absolute z-50 w-full mt-1 bg-white border border-gray-200
            rounded-lg shadow-lg
          "
          >
            {/* Search input (at the top) */}
            <div class="p-2 border-b border-gray-100">
              <input
                type="text"
                class="
                w-full h-10 px-4 bg-gray-50 border border-gray-200
                rounded-md text-sm text-gray-700
                focus:ring-2 focus:ring-blue-500 focus:border-transparent
              "
                placeholder="Search standards..."
                value={searchQuery}
                onInput$={(e) =>
                  onSearchChange$((e.target as HTMLInputElement).value)
                }
                onClick$={(e) => e.stopPropagation()}
              />
            </div>

            {/* Scrollable container for the options */}
            <div class="max-h-64 overflow-y-auto">
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  class="
                  w-full h-20 px-4 flex items-center text-left
                  hover:bg-gray-50 focus:bg-gray-50 focus:outline-none
                "
                  onClick$={() => {
                    onSelect$(option.value);
                    onToggle$();
                    onSearchChange$("");
                  }}
                >
                  <div class="flex items-center gap-4 w-full">
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-gray-900 truncate">
                        {option.value}
                      </div>
                      <div class="text-sm text-gray-500 truncate">
                        {option.text.replace(option.value + " - ", "")}
                      </div>
                    </div>
                    <div
                      class="
                      flex-shrink-0 w-24 h-16 bg-gray-50
                      rounded-lg overflow-hidden
                      flex items-center justify-center
                    "
                    >
                      <img
                        src={option.image.replace(".svg", ".jpg")}
                        alt={option.value}
                        class="max-h-full max-w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  </div>
                </button>
              ))}
              {filteredOptions.length === 0 && (
                <div class="px-4 py-3 text-sm text-gray-500">
                  No standards found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  },
);
