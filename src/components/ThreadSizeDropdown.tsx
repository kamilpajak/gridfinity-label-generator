import type { PropFunction } from "@builder.io/qwik";
import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { ChevronDownIcon } from "./icons";

interface Props {
  selectedValue: string;
  options: string[];
  onSelect$: PropFunction<(value: string) => void>;
}

export const ThreadSizeDropdown = component$<Props>(
  ({ selectedValue, options, onSelect$ }) => {
    const isOpen = useSignal(false);
    const dropdownRef = useSignal<Element>();

    useVisibleTask$(({ cleanup }) => {
      function handleClickOutside(event: MouseEvent) {
        if (
          isOpen.value &&
          dropdownRef.value &&
          !(dropdownRef.value as HTMLElement).contains(event.target as Node)
        ) {
          isOpen.value = false;
        }
      }

      document.addEventListener("mousedown", handleClickOutside);
      cleanup(() =>
        document.removeEventListener("mousedown", handleClickOutside),
      );
    });

    return (
      <div class="relative" ref={dropdownRef}>
        <button
          type="button"
          class="w-full h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-left text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
          onClick$={() => (isOpen.value = !isOpen.value)}
        >
          <span>{selectedValue || "Thread size..."}</span>
          <ChevronDownIcon />
        </button>

        {isOpen.value && (
          <div class="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
            <div class="max-h-64 overflow-y-auto py-1">
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-0.5 p-0.5">
                {options.map((option) => (
                  <button
                    key={option}
                    class={`
                    h-12 px-3 rounded text-base font-medium transition-all
                    ${
                      selectedValue === option
                        ? "bg-blue-50 text-blue-700 border border-blue-600"
                        : "hover:bg-gray-50 text-gray-700"
                    }
                  `}
                    onClick$={() => {
                      onSelect$(option);
                      isOpen.value = false;
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
);
