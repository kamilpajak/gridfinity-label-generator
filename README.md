# Gridfinity Label Generator

<p align="center">
  <img src="public/favicon.svg" alt="Gridfinity Label Generator Logo" width="120" height="120">
</p>

<p align="center">
  Create professional labels for your Gridfinity storage system - perfect for organizing hardware, tools, and parts.
</p>

<p align="center">
  <a href="https://github.com/kamilpajak/gridfinity-label-generator/releases">
    <img src="https://img.shields.io/github/v/release/kamilpajak/gridfinity-label-generator?style=flat-square" alt="Latest Release">
  </a>
  <a href="https://hub.docker.com/r/kamilpajak/storage-label-maker">
    <img src="https://img.shields.io/docker/pulls/kamilpajak/storage-label-maker?style=flat-square" alt="Docker Pulls">
  </a>
</p>

## 📋 Features

- 🛠️ **Extensive Hardware Library**: Pre-loaded images for screws, nuts, and washers (DIN & ISO standards)
- 📏 **Multiple Label Sizes**: Support for various Gridfinity label dimensions
- 🌍 **Measurement Systems**: Both metric and imperial unit support
- 🎨 **Smart Layout**: Automatically optimized text and image positioning
- 📱 **QR Code Integration**: Generate QR codes for part references or inventory tracking
- 💾 **PNG Export**: Download high-quality label images for printing
- 📱 **Mobile Friendly**: Responsive design works on all devices

## 🚀 Getting Started

### Try it Online

Visit [https://gridfinitylabels.com](https://gridfinitylabels.com) to use the application without installation.

### Run with Docker

```bash
# Using Docker Hub
docker run -p 80:80 kamilpajak/storage-label-maker:latest

# Using GitHub Container Registry
docker run -p 80:80 ghcr.io/kamilpajak/gridfinity-label-generator:latest
```

Then visit [http://localhost](http://localhost)

### Run Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

## 📖 Usage Guide

1. **Select Hardware Type**: Choose from Screw, Nut, or Washer
2. **Pick Your Standard**: Select the DIN/ISO standard for your hardware
3. **Choose Specific Part**: Select the exact part number
4. **Select Thread Size**: Pick the appropriate thread size
5. **Customize Label**: Adjust text, add descriptions, or include QR codes
6. **Export**: Download your label as a PNG file

## 🛠️ Development

### Building for Production

```bash
# Build the application
npm run build

# Preview the production build
npm run serve
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint
```

### Docker Development

```bash
# Build local Docker image
./docker-build.sh

# Build and publish to DockerHub
./docker-publish.sh
```

## 🔄 Version Management

This project uses semantic versioning with automated releases:

```bash
# Automatic version bump based on commits
npm run release:auto

# Manual version bumps
npm run release:patch  # 0.1.13 -> 0.1.14
npm run release:minor  # 0.1.13 -> 0.2.0
npm run release:major  # 0.1.13 -> 1.0.0
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed release process.

## 📝 Copyright

© 2025 Kamil Pająk. All rights reserved.

## 🙏 Acknowledgments

- [Gridfinity](https://www.youtube.com/watch?v=ra_9zU-mnl8) - The modular storage system by Zack Freedman
- Hardware images sourced from DIN and ISO standard specifications
- Built with [Qwik](https://qwik.builder.io/) and [TailwindCSS](https://tailwindcss.com/)

## 🔗 Links

- [Documentation](https://github.com/kamilpajak/gridfinity-label-generator/wiki)
- [Issues](https://github.com/kamilpajak/gridfinity-label-generator/issues)
- [Releases](https://github.com/kamilpajak/gridfinity-label-generator/releases)
- [Docker Hub](https://hub.docker.com/r/kamilpajak/storage-label-maker)
