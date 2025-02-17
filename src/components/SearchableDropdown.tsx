import type {PropFunction} from '@builder.io/qwik';
import {component$, useSignal, useVisibleTask$} from '@builder.io/qwik';
import {ChevronDownIcon} from './icons';
import type {DINStandard} from '~/types';

interface Props {
    isOpen: boolean;
    selectedValue: string;
    options: DINStandard[];
    searchQuery: string;
    onToggle$: PropFunction<() => void>;
    onSearchChange$: PropFunction<(query: string) => void>;
    onSelect$: PropFunction<(value: string) => void>;
}

export const SearchableDropdown = component$<Props>(({
                                                         isOpen,
                                                         selectedValue,
                                                         options,
                                                         searchQuery,
                                                         onToggle$,
                                                         onSearchChange$,
                                                         onSelect$
                                                     }) => {
    const dropdownRef = useSignal<Element>();

    // Add click outside handler
    useVisibleTask$(({cleanup}) => {
        function handleClickOutside(event: MouseEvent) {
            if (isOpen && dropdownRef.value && !(dropdownRef.value as HTMLElement).contains(event.target as Node)) {
                // Only close if it's open
                if (isOpen) {
                    onToggle$();
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        cleanup(() => document.removeEventListener('mousedown', handleClickOutside));
    });

    const filteredOptions = options.filter(option =>
        option.text.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div class="relative" ref={dropdownRef}>
            <button
                type="button"
                class="w-full h-[60px] px-4 bg-white border border-gray-300 rounded-lg text-base text-left text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent flex items-center justify-between"
                onClick$={onToggle$}
            >
                <span>{selectedValue || 'Hardware standard...'}</span>
                <ChevronDownIcon/>
            </button>

            {isOpen && (
                <div class="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                    <div class="p-2 border-b border-gray-100">
                        <input
                            type="text"
                            class="w-full h-10 px-4 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Search standards..."
                            value={searchQuery}
                            onInput$={(e) => onSearchChange$((e.target as HTMLInputElement).value)}
                            onClick$={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div class="max-h-60 overflow-y-auto">
                        {filteredOptions.map((option) => (
                            <button
                                key={option.value}
                                class="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                                onClick$={() => {
                                    onSelect$(option.value);
                                    if (isOpen) {
                                        onToggle$();
                                    }
                                    onSearchChange$('');
                                }}
                            >
                                <div class="flex items-center justify-between">
                                    <div class="flex-1">
                                        <div class="text-sm font-medium text-gray-900">{option.value}</div>
                                        <div
                                            class="text-sm text-gray-500">{option.text.replace(option.value + ' - ', '')}</div>
                                    </div>
                                    <img
                                        src={option.image}
                                        alt={option.value}
                                        class="w-12 h-12 object-cover rounded-md ml-4"
                                    />
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
});