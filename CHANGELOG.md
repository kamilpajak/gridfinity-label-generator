# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.6.0] - 2026-01-07

### Improved

- Standard Descriptions: More accurate and consistent descriptions sourced from official DIN Media database.

## [2.5.4] - 2026-01-06

### Fixed

- DIN 917: Corrected from "pipe plugs" to "hexagon cap nuts".
- DIN 6917: Corrected from "screws" to "square taper washers for I-sections".

## [2.5.3] - 2026-01-06

### Fixed

- Hardware Classifications: Corrected categories for DIN 444 (eye bolts), DIN 1478 (turnbuckles), and separated ISO 10509 (tapping screws) from DIN 6923 (flange nuts).

## [2.5.2] - 2026-01-06

### Fixed

- DIN 7997 Form Fields: Corrected internal classification to show wood screw fields instead of machine screw fields.

## [2.5.1] - 2026-01-06

### Added

- Standard Images: 49 new hardware images including DIN 7997 (wood screws), improving visual reference coverage.

### Fixed

- DIN 6916 Classification: Corrected from "screw" to "washer" (HV washer for structural bolting).

## [2.5.0] - 2026-01-06

### Added

- Small Imperial Sizes: Added #0 and #2 thread sizes for electronics and miniature hardware (Arduino, Raspberry Pi, sensors).

### Fixed

- Imperial Fractions: Batch mode now correctly handles fractional lengths like 1/4", 3/8", 1-1/2" instead of rounding to whole numbers.

## [2.4.0] - 2026-01-05

### Added

- What's New Section: Interactive changelog display showing recent updates with timeline visualization.

## [2.3.0] - 2026-01-05

### Added

- Custom Image Upload: Add your own logos or product images directly to labels. Supports PNG, JPG, and SVG formats with automatic compression.

## [2.2.0] - 2025-10-26

### Added

- Descriptive Filenames: Exported labels now use meaningful names based on content instead of generic labels.

## [2.1.0] - 2025-10-21

### Added

- Wood Screw Support: New hardware type with specialized field logic for wood screws and ring fasteners.
- Hardware Image Auto-Detection: Automatically fetch product images from supported suppliers with validation.

### Fixed

- Batch Mode Fields: Fixed mutual exclusion issues and field handling in batch mode.
- Placeholder Styling: Improved select field placeholder visibility across all modes.
- Infinite Loop: Fixed issue when clicking active ToggleGroup button.
- Browser Performance: Optimized rendering for Firefox and Safari.

## [2.0.1] - 2025-10-10

### Added

- Batch Processing: Generate multiple labels at once for organizing entire drawers quickly.
- Label Readability: Improved label layout and text rendering.

### Fixed

- Input Validation: Smoother and more responsive field validation.
- UI Consistency: Improved batch mode toggle behavior and visual feedback.

## [2.0.0] - 2025-08-25

### Added

- Hardware Types: Support for screws, bolts, nuts, washers, and more.
- QR Code Support: Add scannable QR codes to your labels for quick reference.
- Standards Database: Searchable ISO/DIN standard database with automatic field population.
- Real-time Preview: Instant label preview as you configure options.

### Improved

- Performance: Faster and more responsive interface.
