# Technical Context: Gridfinity Label Generator

## Technologies Used

### Core Framework
- **Qwik & Qwik City**: The application is built using Qwik, a resumable framework designed for optimal performance. Qwik's unique approach to lazy-loading and resumability (rather than hydration) provides excellent performance characteristics.

### Frontend
- **TypeScript**: Strongly-typed language for improved developer experience and code quality
- **TailwindCSS**: Utility-first CSS framework for styling
- **HTML Canvas API**: Used for label generation and rendering
- **QRCode.js**: Library for generating QR codes

### Build & Development
- **Vite**: Modern build tool and development server
- **ESLint**: Static code analysis for identifying problematic patterns
- **Prettier**: Code formatter for consistent style
- **Vitest**: Testing framework compatible with Vite

### Deployment
- **Express**: Minimal server implementation for production deployment
- **Node.js**: JavaScript runtime for server-side execution

## Development Setup

### Prerequisites
- Node.js (^18.17.0 || ^20.3.0 || >=21.0.0)
- npm (comes with Node.js)

### Environment Setup
```bash
# Clone repository
git clone [repository-url]

# Install dependencies
npm install

# Start development server
npm run dev
```

### Development Server
- Development server runs on `http://localhost:5173/` by default
- Uses Vite's built-in development server with hot module replacement

### Build Process
```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Serve production build with Express
npm run serve
```

### Project Structure
```
gridfinity-label-generator/
├── adapters/           # Server adapters (Express)
├── public/             # Static assets
│   ├── nuts/           # Hardware images (nuts)
│   ├── screws/         # Hardware images (screws)
│   └── washers/        # Hardware images (washers)
├── src/
│   ├── components/     # UI components
│   │   └── icons/      # Icon components
│   ├── constants/      # Application constants
│   ├── lib/            # Core functionality
│   ├── routes/         # Application routes
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions
├── server/             # Server-side code
└── memory-bank/        # Project documentation
```

## Technical Constraints

### Browser Compatibility
- Modern browsers with Canvas API support
- No explicit support for legacy browsers (IE11, etc.)

### Performance Considerations
- Label generation happens client-side using Canvas
- Font loading must be handled carefully to ensure consistent rendering
- Image loading includes fallback mechanisms (SVG → JPG)

### Responsive Design
- Application is designed to work on various screen sizes
- Mobile-first approach with responsive breakpoints
- Layout adjusts for smaller screens (stacked vs. side-by-side)

### Security Configuration
- Content Security Policy (CSP) skonfigurowana do zezwalania na połączenia z niezbędnymi zewnętrznymi serwisami
- Dozwolone domeny w CSP obejmują m.in. tinyurl.com dla funkcjonalności skracania URL-i
- Zbalansowane podejście między bezpieczeństwem a funkcjonalnością

## Dependencies

### Production Dependencies
- **express**: Web server for production deployment
- **qrcode**: QR code generation library

### Development Dependencies
- **@builder.io/qwik**: Core Qwik framework
- **@builder.io/qwik-city**: Routing and server-side rendering
- **@qwikest/icons**: Icon library for Qwik
- **@testing-library/dom**: DOM testing utilities
- **@testing-library/jest-dom**: Jest DOM testing utilities
- **autoprefixer**: PostCSS plugin for vendor prefixes
- **tailwindcss**: Utility-first CSS framework
- **typescript**: TypeScript language
- **vite**: Build tool and development server
- **vitest**: Testing framework

## Font System

The application uses specific fonts for label generation:

1. **Noto Sans**: Primary font for top text
   - Weights: 400 (regular), 900 (black)
   - Used for thread size and primary specifications

2. **Oswald**: Secondary font for bottom text
   - Weights: 400 (regular), 700 (bold)
   - Used for standard information and notes

Font loading is handled with careful error checking and fallbacks:
- Preloading fonts when the component is visible
- Verification of font loading before rendering
- Multiple fallback mechanisms if fonts fail to load

## Image System

Hardware images are stored as static assets:
- Organized by hardware type (screws, nuts, washers)
- Named according to standard (e.g., `din_934.jpg`)
- SVG format preferred with JPG fallback
- Loaded dynamically based on selected hardware standard

## Measurement System

The application handles physical measurements with precision:

1. **Unit Conversion**
   - `mmToPx()`: Converts millimeters to pixels
   - Dynamic calculation based on device pixel density
   - Ensures consistent physical dimensions

2. **Font Sizing**
   - `computeDynamicFontSize()`: Calculates appropriate font size
   - Scales text to fit available space
   - Maintains readability at different label widths

3. **Label Dimensions**
   - Fixed height: 10mm
   - Adjustable width: Default 55mm, user-configurable
   - All internal measurements maintain proper physical proportions

## Canvas Rendering

The label generation process uses HTML Canvas for pixel-perfect rendering:

1. **Canvas Setup**
   - Create canvas with dimensions based on label size
   - Set white background
   - Establish 2D rendering context

2. **Element Rendering Order**
   1. QR Code (if enabled)
   2. Hardware image (if enabled)
   3. Text content (single or two-line mode)

3. **Export Process**
   - Convert canvas to PNG via `toDataURL()`
   - Return data URL for preview and download
   - Filename based on hardware specifications

## Testing Strategy

The application includes tests for critical functionality:

1. **Unit Tests**
   - Test individual functions and utilities
   - Focus on label generation logic
   - Verify measurement conversions

2. **Component Tests**
   - Test UI components in isolation
   - Verify correct rendering and behavior
   - Mock dependencies as needed

3. **Integration Tests**
   - Test interactions between components
   - Verify end-to-end label generation process

Tests are run using Vitest, with commands:
- `npm test`: Run all tests
- `npm run test:watch`: Run tests in watch mode
- `npm run test:coverage`: Generate test coverage report
