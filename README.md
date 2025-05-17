# Gridfinity Label Generator

Create professional labels for Gridfinity storage system - perfect for organizing hardware, tools, and parts.

## Features

- 🛠️ **Extensive Hardware Library**: Pre-loaded images for screws, nuts, and washers (DIN & ISO standards)
- 📏 **Multiple Label Sizes**: Support for various Gridfinity label dimensions
- 🌍 **Measurement Systems**: Both metric and imperial unit support
- 🎨 **Smart Layout**: Automatically optimized text and image positioning
- 📱 **QR Code Integration**: Generate QR codes for part references or inventory tracking
- 💾 **PNG Export**: Download high-quality label images for printing
- 📱 **Mobile Friendly**: Responsive design works on all devices

## Usage

### Try it Online

Visit [https://gridfinitylabels.com](https://gridfinitylabels.com)

### Run with Docker

```bash
# Docker Hub
docker run -p 80:80 kamilpajak/storage-label-maker:latest

# GitHub Container Registry
docker run -p 80:80 ghcr.io/kamilpajak/gridfinity-label-generator:latest
```

### Run Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

## Development Commands

```bash
npm run build        # Build for production
npm run test         # Run tests
npm run release:auto # Create new release
```

## Docker Images

- Docker Hub: https://hub.docker.com/r/kamilpajak/storage-label-maker
- GitHub Container Registry: https://ghcr.io/kamilpajak/gridfinity-label-generator

## Copyright

© 2025 Kamil Pająk. All rights reserved.
