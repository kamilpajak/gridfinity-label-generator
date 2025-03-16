# Product Context: Gridfinity Label Generator

## Problem Statement

The Gridfinity storage system has become popular among makers, hobbyists, and workshop organizers for its modular and customizable approach to organizing small parts and tools. However, without proper labeling, even the most organized storage system becomes inefficient as users struggle to quickly identify contents without opening each drawer or bin.

Existing solutions for creating labels have several limitations:
- Generic label makers lack standardization for Gridfinity dimensions
- Hand-written labels are inconsistent and often illegible
- General-purpose design tools require significant time and skill to create consistent labels
- No specialized tools exist for creating hardware-specific labels with standardized information

The Gridfinity Label Generator addresses these challenges by providing a purpose-built tool for creating standardized, information-rich labels specifically designed for hardware components in Gridfinity storage systems.

## User Needs

### Primary Needs
1. **Efficiency**: Create accurate labels quickly without repetitive manual work
2. **Consistency**: Generate visually uniform labels across all storage units
3. **Specificity**: Include precise hardware specifications (thread size, standard, etc.)
4. **Clarity**: Produce labels that are easy to read and understand at a glance

### Secondary Needs
1. **Customization**: Adjust label properties to match specific storage configurations
2. **Accessibility**: Use the tool without specialized knowledge of design software
3. **Flexibility**: Support various hardware types and measurement systems
4. **Integration**: Create labels that work well with the physical Gridfinity system

## User Experience Goals

1. **Intuitive Flow**
   - Users should be able to create a label within 30 seconds of opening the application
   - The interface should guide users through logical steps without confusion
   - Real-time preview should show exactly what the final label will look like

2. **Information Hierarchy**
   - Most important hardware specifications should be immediately visible
   - Secondary information should be present but not dominate the label
   - Visual elements (images) should aid identification without cluttering

3. **Error Prevention**
   - The application should prevent invalid combinations of hardware specifications
   - Clear feedback should be provided when required information is missing
   - Preview should update in real-time to show the effects of user choices

4. **Accessibility**
   - The application should be usable on various devices and screen sizes
   - Text should be legible and high-contrast
   - Interactive elements should be appropriately sized for touch interfaces

## How It Should Work

### Label Creation Process
1. User selects hardware type (screw, nut, washer)
2. User chooses measurement system (metric or imperial)
3. User selects thread size from appropriate options
4. For screws, user enters length information
5. User selects hardware standard (DIN/ISO with specific number)
6. User can add optional notes for additional information
7. User can adjust label settings (width, image visibility, etc.)
8. Application generates preview in real-time as selections are made
9. User downloads the label as a PNG file for printing

### Label Structure
- **Primary Information**: Thread size and length (for screws)
- **Secondary Information**: Hardware standard (DIN/ISO number)
- **Visual Aid**: Image of the hardware type based on selected standard
- **Optional Elements**: QR code, custom notes

### Technical Implementation
- Canvas-based label generation for precise control over layout
- Dynamic scaling of text and images based on label width
- Priority-based element positioning (QR code has highest priority)
- Conversion between physical dimensions (mm) and pixels for accurate printing

## Success Indicators

1. **Usability Metrics**
   - Time to create first label
   - Number of errors during creation process
   - Completion rate for first-time users

2. **Quality Metrics**
   - Accuracy of hardware specifications on labels
   - Consistency of label appearance across different hardware types
   - Readability of printed labels at typical viewing distance

3. **User Satisfaction**
   - Positive feedback on ease of use
   - Repeated use of the application
   - Voluntary donations via "Buy Me a Coffee" link
