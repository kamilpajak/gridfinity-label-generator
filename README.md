# Gridfinity Label Generator

[![Try Online](https://img.shields.io/badge/Try-Online-blue)](https://gridfinitylabels.com)
[![Framework](https://img.shields.io/badge/framework-SvelteKit-orange)](https://kit.svelte.dev/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Create professional labels for your Gridfinity storage system with this modern web application.

**[Try it now at gridfinitylabels.com](https://gridfinitylabels.com)**

![Gridfinity Label Generator Screenshot](docs/screenshot.png)

## ✨ Features

- **Fastener Labels**: Generate labels for screws, bolts, nuts, and washers with automatic hardware type detection
- **General Item Labels**: Create custom labels for any storage needs
- **Batch Mode**: Generate multiple labels at once with individual configuration
- **Custom Images**: Upload your own logos or product images (PNG, JPG, SVG with auto-compression)
- **Smart Thread Detection**: Automatically shows correct thread sizes based on hardware type
- **Smart Formatting**: Formats thread sizes and lengths based on metric/imperial selection
- **Hardware Standards**: 200+ ISO/DIN standards with descriptions from official DIN Media database
- **Real-time Preview**: See your label as you design it
- **Export to PNG**: Download print-ready labels with descriptive filenames
- **Mobile-Responsive**: Collapsible settings panel optimized for smaller screens
- **Display Options**: Toggle standard references, hardware images, and QR codes
- **Dimension Control**: Support for 9mm and 12mm label tape widths
- **What's New**: Built-in changelog with recent updates

## 🛠️ Tech Stack

- **Framework**: [SvelteKit](https://kit.svelte.dev/) with Svelte 5
- **UI Components**: [shadcn-svelte](https://www.shadcn-svelte.com/) with bits-ui
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Testing**: [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/)
- **Language**: TypeScript
- **Build Tool**: Vite

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/kamilpajak/gridfinity-label-generator.git
cd gridfinity-label-generator

# Install dependencies (requires pnpm)
pnpm install

# Start development server
pnpm dev

# Open in browser
open http://localhost:5173
```

## 🔧 Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm test         # Run all tests
pnpm test:unit    # Run unit tests
pnpm test:e2e     # Run E2E tests
pnpm check        # Type check
pnpm lint         # Lint code
pnpm format       # Format code
```

## 🚢 Deployment

The application can be deployed to any static hosting service:

```bash
# Build for production
pnpm build

# The output will be in the 'build' directory
# Deploy this directory to your hosting service
```

### Deployment Options

- **Vercel**: `pnpm add -D @sveltejs/adapter-vercel`
- **Netlify**: `pnpm add -D @sveltejs/adapter-netlify`
- **Cloudflare Pages**: `pnpm add -D @sveltejs/adapter-cloudflare`
- **Static hosting**: Default adapter creates static files

## 📝 Project Structure

```
gridfinity-label-generator/
├── src/
│   ├── routes/          # SvelteKit routes
│   ├── lib/
│   │   ├── components/  # UI components
│   │   ├── data/        # Hardware standards data
│   │   └── utils/       # Utility functions (with *.test.ts)
│   ├── app.html         # HTML template
│   └── app.css          # Global styles
├── e2e/                 # Playwright E2E tests
├── scripts/             # CLI tools (SVG processing)
├── docs/                # Documentation
├── static/              # Static assets
└── package.json         # Dependencies
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💖 Support

If you find this project helpful, consider:

- ⭐ Starring the repository
- ☕ [Buying me a coffee](https://www.buymeacoffee.com/kamilpajak)
- 🐛 [Reporting issues](https://github.com/kamilpajak/gridfinity-label-generator/issues)
- 💡 [Providing feedback](https://github.com/kamilpajak/gridfinity-label-generator/discussions)

## 🙏 Acknowledgments

- [Gridfinity](https://www.youtube.com/watch?v=ra_9zU-mnl8) system by Zack Freedman
- [SvelteKit](https://kit.svelte.dev/) team for the amazing framework
- [shadcn-svelte](https://www.shadcn-svelte.com/) for the component library
- All contributors and users of this project
