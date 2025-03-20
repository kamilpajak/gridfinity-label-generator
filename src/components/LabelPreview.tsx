import { component$ } from "@builder.io/qwik";
import { InfoIcon, LabelIcon } from "./icons";
import { calculateExpectedPrintedWidth } from "~/utils/printCalibration";

interface Props {
  isLoading: boolean;
  labelUrl: string;
  labelWidth: number;
  showQrCode?: boolean;
}

// Helper: Renders the header with title and dimensions.
const renderHeader = (labelWidth: number) => {
  // Calculate expected printed dimensions
  const expectedPrintedWidth = calculateExpectedPrintedWidth(labelWidth);
  const expectedPrintableWidth = expectedPrintedWidth - 4; // 2mm margin on each side
  
  return (
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h3 id="label-preview" class="text-base font-medium text-gray-700">
          Label Preview
        </h3>
        <div class="relative group">
          <span class="cursor-help text-gray-400 hover:text-gray-600">
            <InfoIcon />
          </span>
          <div class="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-3 bg-white rounded-lg shadow-lg text-sm text-gray-700 z-10">
            <div class="relative">
              <div class="absolute -bottom-2 left-2 w-4 h-4 bg-white transform rotate-45"></div>
              <p>
                The selected width (e.g., 55mm) is the tape size. The printable
                area is 4mm narrower (2mm margin on each side) and 2mm shorter
                (1mm margin on top and bottom).
              </p>
              <p class="mt-2">
                <strong>Note:</strong> The printed width will match the tape size width
                of {labelWidth}mm.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div class="text-right">
        <div class="text-sm text-gray-500">
          {labelWidth}mm × 12mm <span class="text-gray-400">(tape size)</span>
        </div>
        <div class="text-xs text-gray-400">
          {labelWidth - 4}mm × 10mm (printable area)
        </div>
        <div class="text-xs text-blue-600">
          {labelWidth}mm printed width
        </div>
      </div>
    </div>
  );
};

// Helper: Renders the label image responsively.
// The container sets the width while the image uses width:100% and height:auto to preserve its proportions.
const renderLabelImage = (labelUrl: string, labelWidth: number) => {
  // Calculate margin percentages for the tape container
  const topBottomMarginPercent = (1 / 12) * 100; // 1mm out of 12mm height = 8.33%
  const leftRightMarginPercent = (2 / labelWidth) * 100; // 2mm out of labelWidth

  return (
    <div class="relative w-full">
      {/* Multi-layered shadow for depth */}
      <div class="absolute inset-0 bg-black/5 blur-lg transform translate-y-2"></div>
      <div class="absolute inset-0 bg-black/10 blur-md transform translate-y-1.5"></div>

      {/* Full tape container with white background */}
      <div
        class="relative bg-white border border-gray-200 rounded-sm overflow-hidden group"
        style={{ aspectRatio: `${labelWidth} / 12` }}
      >
        {/* Tape margins indicators are below */}

        {/* Printable area container - matches the actual generated label dimensions */}
        <div
          class="absolute"
          style={{
            top: `${topBottomMarginPercent}%`,
            bottom: `${topBottomMarginPercent}%`,
            left: `${leftRightMarginPercent}%`,
            right: `${leftRightMarginPercent}%`,
          }}
        >
          {/* Printable area border - very subtle */}
          <div class="absolute inset-0 border border-gray-300/20 pointer-events-none"></div>

          {/* Label image - positioned precisely within printable area */}
          <div class="w-full h-full flex items-center justify-center">
            <img
              src={labelUrl}
              alt={`Generated label with dimensions ${labelWidth - 4}mm × 10mm`}
              class="w-full h-full"
              style={{ objectFit: "contain" }}
            />
          </div>
        </div>

        {/* Margin indicators - very subtle */}
        <div class="absolute inset-0 pointer-events-none">
          {/* Margin labels - only visible on hover */}
          <div class="absolute top-[4%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
            1mm
          </div>
          <div class="absolute bottom-[4%] left-1/2 -translate-x-1/2 translate-y-1/2 text-[8px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
            1mm
          </div>
          <div class="absolute left-[2%] top-1/2 -translate-y-1/2 -translate-x-1/2 text-[8px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
            2mm
          </div>
          <div class="absolute right-[2%] top-1/2 -translate-y-1/2 translate-x-1/2 text-[8px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
            2mm
          </div>
        </div>

        {/* QR code indicator removed as per user request */}
      </div>
    </div>
  );
};

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
