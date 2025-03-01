import { component$ } from "@builder.io/qwik";
import { LabelIcon } from "./icons";

interface Props {
  isLoading: boolean;
  labelUrl: string;
  labelWidth: number;
}

// Helper: Renders the header with title and dimensions.
const renderHeader = (labelWidth: number) => (
  <div class="flex items-center justify-between">
    <h3 id="label-preview" class="text-base font-medium text-gray-700">
      Label Preview
    </h3>
    <span class="text-sm text-gray-500">{labelWidth}mm × 10mm</span>
  </div>
);

// Helper: Renders the label image responsively.
// The container sets the width while the image uses width:100% and height:auto to preserve its proportions.
const renderLabelImage = (labelUrl: string, labelWidth: number) => (
  <div class="relative w-full">
    <div class="relative">
      {/* Multi-layered shadow for depth */}
      <div class="absolute inset-0 bg-black/5 blur-lg transform translate-y-2"></div>
      <div class="absolute inset-0 bg-black/10 blur-md transform translate-y-1.5"></div>
      <div class="relative">
        <img 
          src={labelUrl} 
          alt={`Generated label with dimensions ${labelWidth}mm × 10mm`} 
          class="block w-full h-auto" 
          width="300" 
          height="60" 
        />
      </div>
    </div>
  </div>
);

// Helper: Renders fallback content when no label image is available.
const renderFallback = () => (
  <div class="text-gray-400 flex items-center gap-3">
    <LabelIcon />
    <span class="text-sm">Fill out the form to generate a label</span>
  </div>
);

// Main component
export const LabelPreview = component$<Props>(({ labelUrl, labelWidth }) => {
  // Render content based on current state.
  const renderContent = () => {
    if (labelUrl) return renderLabelImage(labelUrl, labelWidth);
    return renderFallback();
  };

  return (
    <div class="space-y-2">
      {renderHeader(labelWidth)}
      {/*
        The container below takes the full available width.
        It scales responsively, and the generated PNG image (inside renderLabelImage)
        will adjust its size while preserving its natural aspect ratio.
      */}
      <div class="relative p-[1px] rounded-xl bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200">
        {/* Background pattern overlay */}
        <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImNoZWNrZXJlZCIgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoMCkiPjxyZWN0IHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2YzZjRmNiIvPjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjNmNGY2Ii8+PHJlY3QgeD0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2U1ZTdlYiIvPjxyZWN0IHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNlNWU3ZWIiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjY2hlY2tlcmVkKSIvPjwvc3ZnPg==')] opacity-100 rounded-xl"></div>
        {/* Content container with backdrop blur */}
        <div class="relative rounded-xl p-8 flex items-center justify-center min-h-[160px] bg-gradient-to-b from-white/40 to-white/20 backdrop-blur-[2px]">
          {renderContent()}
        </div>
      </div>
    </div>
  );
});
