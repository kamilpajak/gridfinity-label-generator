# System Patterns: Gridfinity Label Generator

## Architecture Overview

The Gridfinity Label Generator follows a component-based architecture using Qwik City as its foundation. The application is structured to optimize for performance, maintainability, and a clear separation of concerns.

```mermaid
flowchart TD
    User[User] --> UI[User Interface]
    UI --> Components[UI Components]
    Components --> LabelGenerator[Label Generator]
    LabelGenerator --> Canvas[Canvas Rendering]
    LabelGenerator --> QRCode[QR Code Generation]
    
    Components --> State[Application State]
    State --> Components
    
    subgraph "Core Components"
        HardwareSelector[Hardware Type Selector]
        ThreadSelector[Thread Size Selector]
        StandardSelector[Standard Selector]
        SettingsPanel[Settings Panel]
        LabelPreview[Label Preview]
    end
    
    Components --> Core[Core Components]
    Core --> HardwareSelector
    Core --> ThreadSelector
    Core --> StandardSelector
    Core --> SettingsPanel
    Core --> LabelPreview
```

## Key Design Patterns

### 1. Component-Based Architecture
- **Implementation**: The application is divided into focused, reusable components
- **Benefits**: Improved maintainability, code reuse, and separation of concerns
- **Examples**: HardwareTypeSelector, ThreadSizeDropdown, SearchableDropdown, LabelPreview

### 2. Reactive State Management
- **Implementation**: Qwik's reactive primitives (useSignal, useStore, useTask$)
- **Benefits**: Automatic UI updates when state changes, optimized rendering
- **Examples**: 
  - Signals for simple values (selectedType, threadSize)
  - Stores for complex objects (settings)
  - Tasks for reactive computations (useTask$ for label generation)

### 3. Unidirectional Data Flow
- **Implementation**: State flows down from parent to child components
- **Benefits**: Predictable state changes, easier debugging
- **Examples**: Settings passed from main component to SettingsPanel

### 4. Event Handler Pattern
- **Implementation**: Handler functions with $ suffix for Qwik's optimization
- **Benefits**: Optimized event handling with automatic lazy-loading
- **Examples**: handleTypeChange$, handleSystemChange$, handleSettingsChange$

### 5. Lazy Loading
- **Implementation**: Qwik's built-in lazy loading capabilities
- **Benefits**: Improved initial load performance, reduced bundle size
- **Examples**: Components and handlers only load when needed

## Component Relationships

```mermaid
flowchart TD
    Root[Root Component] --> Header
    Root --> MainContent[Main Content]
    Root --> Footer
    
    MainContent --> HardwareTypeSelector
    MainContent --> InputFields[Input Fields]
    MainContent --> StandardDropdown[Standard Dropdown]
    MainContent --> LabelPreview
    MainContent --> DownloadSection[Download Section]
    
    InputFields --> ThreadSizeDropdown
    InputFields --> LengthInput[Length Input]
    InputFields --> NotesInput[Notes Input]
    
    subgraph "Settings Panel"
        WidthSetting[Width Setting]
        ImageToggle[Image Toggle]
        StandardNameToggle[Standard Name Toggle]
        QRCodeToggle[QR Code Toggle]
        QRCodeContent[QR Code Content]
    end
    
    Root --> SettingsPanel
    SettingsPanel --> WidthSetting
    SettingsPanel --> ImageToggle
    SettingsPanel --> StandardNameToggle
    SettingsPanel --> QRCodeToggle
    SettingsPanel --> QRCodeContent
```

## Label Generation System

The label generation system is a core part of the application with a sophisticated approach to layout and rendering.

### Priority-Based Layout System

```mermaid
flowchart TD
    Start[Start Label Generation] --> CheckQR{QR Code Enabled?}
    
    CheckQR -->|Yes| AllocateQR[Allocate QR Code Space]
    CheckQR -->|No| SkipQR[Skip QR Code]
    
    AllocateQR --> CalculateRemaining1[Calculate Remaining Space]
    SkipQR --> CalculateRemaining2[Use Full Width]
    
    CalculateRemaining1 --> CheckImage{Image Enabled?}
    CalculateRemaining2 --> CheckImage
    
    CheckImage -->|Yes| AllocateImage[Allocate Image Space]
    CheckImage -->|No| SkipImage[Skip Image]
    
    AllocateImage --> CalculateTextSpace1[Calculate Text Space]
    SkipImage --> CalculateTextSpace2[Use Full Remaining Width]
    
    CalculateTextSpace1 --> CheckLines{Single or Two Lines?}
    CalculateTextSpace2 --> CheckLines
    
    CheckLines -->|Single| PositionSingle[Center Text Vertically]
    CheckLines -->|Two| PositionTwo[Position Top and Bottom Text]
    
    PositionSingle --> RenderElements[Render All Elements]
    PositionTwo --> RenderElements
    
    RenderElements --> ExportPNG[Export as PNG]
```

### Label Element Positioning Logic

1. **QR Code (Highest Priority)**
   - Fixed size: 10mm x 10mm
   - Position: Right side of label
   - When enabled, reduces available width for other elements

2. **Image Positioning**
   - Position: Left side of available space
   - Scaling: Preserves aspect ratio
   - Maximum width: 40% of available width (after QR code allocation)
   - Gap: Added between image and text

3. **Text Positioning**
   - Position: Center of remaining space (horizontally)
   - Single-line mode: Vertically centered
   - Two-line mode: 
     - Top text aligned to top edge
     - Bottom text aligned to bottom edge

4. **Text Scaling**
   - Dynamic font size calculation based on available width
   - Different font families for top text (Noto Sans) and bottom text (Oswald)
   - Scaling algorithm ensures text fits within allocated space

### Measurement System

The application uses a sophisticated measurement system to ensure accurate physical dimensions:

1. **Unit Conversion**
   - Conversion between millimeters (mm) and pixels
   - Dynamic calculation based on device pixel density
   - Ensures consistent physical size regardless of display

2. **Canvas Rendering**
   - HTML Canvas API for precise pixel-level control
   - Text measurement to calculate exact dimensions
   - Font loading and verification to ensure consistent rendering

3. **Responsive Scaling**
   - Label width adjustable by user (in mm)
   - Fixed height (10mm) for consistency
   - All internal measurements scale proportionally

## Data Flow

```mermaid
flowchart TD
    UserInput[User Input] --> StateUpdate[State Update]
    StateUpdate --> ReactiveTask[Reactive Task]
    ReactiveTask --> LabelGeneration[Label Generation]
    
    LabelGeneration --> TextGeneration[Generate Label Text]
    LabelGeneration --> ImageLoading[Load Hardware Image]
    LabelGeneration --> QRGeneration[Generate QR Code]
    
    TextGeneration --> CanvasRendering[Canvas Rendering]
    ImageLoading --> CanvasRendering
    QRGeneration --> CanvasRendering
    
    CanvasRendering --> DataURL[Generate Data URL]
    DataURL --> Preview[Update Preview]
    DataURL --> Download[Enable Download]
```

## Error Handling

1. **Font Loading**
   - Multiple fallback mechanisms for font loading
   - Verification of font availability before rendering
   - Graceful degradation if fonts fail to load

2. **Image Loading**
   - Fallback from SVG to JPG if primary format fails
   - Null checks to handle missing images
   - Appropriate error logging

3. **User Input Validation**
   - Required field validation
   - Appropriate UI feedback for missing information
   - Disabled download button until all required fields are filled
