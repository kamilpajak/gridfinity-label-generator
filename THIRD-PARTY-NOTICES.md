# Third-Party Notices

This project's own source code is licensed under the terms in the [`LICENSE`](LICENSE)
file (GNU Affero General Public License v3.0). That license applies **only** to the
code authored for this project. Third-party components bundled with or served by the
application carry their own separate licenses, listed below.

---

## Fonts — SIL Open Font License 1.1 (OFL-1.1)

The following web fonts are served by the built application via the `@fontsource/*`
packages. Each is licensed under the SIL Open Font License, Version 1.1
(<https://openfontlicense.org>). The full license text ships with each package under
`node_modules/@fontsource/<name>/LICENSE`.

| Font      | Package                 | License | Upstream copyright / Reserved Font Name                                         |
| --------- | ----------------------- | ------- | ------------------------------------------------------------------------------- |
| Noto Sans | `@fontsource/noto-sans` | OFL-1.1 | Copyright The Noto Project Authors (Google Inc.). "Noto" is a Google trademark. |
| Oswald    | `@fontsource/oswald`    | OFL-1.1 | Copyright The Oswald Project Authors                                            |
| Fira Mono | `@fontsource/fira-mono` | OFL-1.1 | Copyright (c) 2012–2015 The Mozilla Foundation and Telefónica S.A. RFN "Fira".  |

OFL-1.1 permits use, modification, and redistribution as part of a bundled
application, provided the copyright and license notices are retained, the fonts are
not sold on their own, and Reserved Font Names are not used on modified fonts.

## Icon set — Lucide (ISC License)

Icons are provided by [Lucide](https://lucide.dev/) via `@lucide/svelte`, licensed
under the ISC License. Copyright (c) Lucide Contributors.

## UI components and framework

- [SvelteKit](https://kit.svelte.dev/) and Svelte — MIT License, Copyright (c) the Svelte contributors.
- [shadcn-svelte](https://www.shadcn-svelte.com/) and [bits-ui](https://bits-ui.com/) — MIT License.
- [Tailwind CSS](https://tailwindcss.com/) — MIT License, Copyright (c) Tailwind Labs, Inc.

The complete list of open-source dependencies and their licenses is defined by
`package.json` / `pnpm-lock.yaml`; each dependency ships its own license under
`node_modules/<package>/`.

## favicon — `static/favicon.svg`

Derived from [VMware Clarity Assets](https://github.com/vmware/clarity-assets),
MIT License. The attribution comment in the SVG header must be retained.

## Standards designations (DIN / ISO / EN)

This application references fastener standards by their **designations** (for example
`DIN 912`, `ISO 4762`) together with short descriptive names, used purely as factual
identifiers so users can find the right label. Standard numbers, titles, and the full
text of the standards themselves are the property of their respective standards bodies
and publishers (DIN, ISO, and others). This project does **not** reproduce or
distribute the standards documents; to obtain the official standards, purchase them
from the relevant publisher (e.g. [DIN Media](https://www.dinmedia.de/),
[ISO](https://www.iso.org/)).

## Reference geometry — FreeCAD Fasteners Workbench (LGPL)

The DIN 315 wing-nut profile construction in `catalog/models/wing_nut.py` was informed
by the open-source [FreeCAD Fasteners Workbench](https://github.com/shaise/FreeCAD_FastenersWB),
licensed under the GNU Lesser General Public License (LGPL). The build123d implementation
in this project is our own; the geometry it produces is dictated by the DIN 315 standard.
No FreeCAD source code is copied into or bundled with this project.

---

## Gridfinity

"Gridfinity" is a storage system created by [Zack Freedman](https://www.youtube.com/watch?v=ra_9zU-mnl8).
The name is used descriptively; this project is independent and is not affiliated with,
sponsored by, or endorsed by its creator.
