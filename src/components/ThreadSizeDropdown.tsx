import type {PropFunction} from '@builder.io/qwik';
import {component$, useSignal, useVisibleTask$} from '@builder.io/qwik';
import {ChevronDownIcon} from './icons';

interface Props {
    selectedValue: string;
    options: string[];
    onSelect$: PropFunction<(value: string) => void>;
}

export const ThreadSizeDropdown = component$<Props>(({
                                                         selectedValue,
                                                         options,
                                                         onSelect$
                                                     }) => {
    const isOpen = useSignal(false);
    const dropdownRef = useSignal<Element>();

    useVisibleTask$(({cleanup}) => {
        function handleClickOutside(event: MouseEvent) {
            if (isOpen.value && dropdownRef.value && !(dropdownRef.value as HTMLElement).contains(event.target as Node)) {
                isOpen.value = false;
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        cleanup(() => document.removeEventListener('mousedown', handleClickOutside));
    });

    return (
        <div class="relative" ref={dropdownRef}>
            <button
                type="button"
                class="w-full h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-left text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
                onClick$={() => isOpen.value = !isOpen.value}
            >
                <span>{selectedValue || 'Thread size...'}</span>
                <ChevronDownIcon/>
            </button>

            {isOpen.value && (
                <div class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                    <div class="max-h-60 overflow-y-auto py-1">
                        {options.map((option) => (
                            <button
                                key={option}
                                class="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                                onClick$={() => {
                                    onSelect$(option);
                                    isOpen.value = false;
                                }}
                            >
                                <div class="text-sm font-medium text-gray-900">{option}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});