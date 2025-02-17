import {component$} from '@builder.io/qwik';
import {LabelIcon, LoaderIcon} from './icons';
import {mmToPx} from '~/utils/measurements';

interface Props {
    isLoading: boolean;
    labelUrl: string;
    labelWidth: number;
}

export const LabelPreview = component$<Props>(({isLoading, labelUrl, labelWidth}) => {
    // Convert label width from mm to pixels
    const labelWidthPx = mmToPx(labelWidth);

    return (
        <div class="space-y-2">
            <div class="flex items-center justify-between">
                <h3 class="text-base font-medium text-gray-700">Label Preview</h3>
                <span class="text-sm text-gray-500">{labelWidth}mm × 10mm</span>
            </div>

            {/* Preview container with gradient border */}
            <div class="relative p-[1px] rounded-xl bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200">
                <div
                    class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImNoZWNrZXJlZCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoMCkiPjxyZWN0IHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2YzZjRmNiIvPjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjNmNGY2Ii8+PHJlY3QgeD0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2U1ZTdlYiIvPjxyZWN0IHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlNWU3ZWIiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjY2hlY2tlcmVkKSIvPjwvc3ZnPg==')] opacity-100 rounded-xl"/>

                {/* Content container */}
                <div
                    class="relative rounded-xl p-8 flex items-center justify-center min-h-[160px] bg-gradient-to-b from-white/40 to-white/20 backdrop-blur-[2px]">
                    {isLoading && (
                        <div class="flex items-center gap-3 text-gray-600">
                            <LoaderIcon/>
                            <span class="text-base">Generating label...</span>
                        </div>
                    )}

                    {!isLoading && labelUrl && (
                        <div class="relative" style={{width: `${labelWidthPx}px`}}>
                            {/* Label with enhanced shadow */}
                            <div class="relative">
                                {/* Multi-layered shadow for more depth */}
                                <div class="absolute inset-0 bg-black/5 blur-lg transform translate-y-2"/>
                                <div class="absolute inset-0 bg-black/10 blur-md transform translate-y-1.5"/>

                                {/* Label */}
                                <div class="relative">
                                    <img
                                        src={labelUrl}
                                        alt="Label Preview"
                                        style={{
                                            width: `${labelWidthPx}px`,
                                            height: `${mmToPx(10)}px`,
                                        }}
                                        class="max-w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {!isLoading && !labelUrl && (
                        <div class="text-gray-400 flex items-center gap-3">
                            <LabelIcon class="w-8 h-8"/>
                            <span class="text-sm">Fill out the form to generate a label</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});