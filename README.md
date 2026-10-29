# CSS Insight for Firefox

![GitHub license](https://img.shields.io/github/license/MarkAlexI/CSS-Insight-Firefox)
![GitHub stars](https://img.shields.io/github/stars/MarkAlexI/CSS-Insight-Firefox?style=social)
![GitHub forks](https://img.shields.io/github/forks/MarkAlexI/CSS-Insight-Firefox?style=social)
![Last commit](https://img.shields.io/github/last-commit/MarkAlexI/CSS-Insight-Firefox)
![Issues](https://img.shields.io/github/issues/MarkAlexI/CSS-Insight-Firefox)
[![AMO](https://img.shields.io/amo/v/css-insight)](https://addons.mozilla.org/firefox/addon/css-insight/)
![status](https://img.shields.io/badge/status-v1.23.3-blue)

CSS Insight is a lightweight Firefox extension for inspecting and testing CSS directly on a webpage. It is designed for quick checks when opening a full developer tools workflow is inconvenient.

## Features

- **Element picker**: Click or tap an element in a page, matching iframe or open shadow root to create a usable CSS selector.
- **Declared styles**: Find matching rules across nested CSS at-rules, native nesting and constructed stylesheets in the selected root.
- **Computed styles**: View the final computed property values of an element.
- **Computed-style filter**: Narrow large computed-style results by property name or resolved value.
- **Media rules and keyframes**: Explore responsive and animation rules recursively and see whether media conditions currently match.
- **CSS preview**: Apply a custom rule to the selected document or open shadow root without changing the website source.
- **Visible target context**: See whether actions use the page, an iframe or an open shadow root, and reset to the active page at any time.
- **Removable preview**: Undo the CSS Insight preview without reloading the page.
- **Copy and export**: Copy retrieved CSS or save it as a `.css` file.
- **On-page details**: Open long output in an isolated page dialog.
- **Localized interface**: Use CSS Insight in English, German, Spanish, Japanese, Brazilian Portuguese or Ukrainian.
- **Firefox Android support**: Use the popup and one-step picker on supported mobile versions.

CSS Insight does not collect analytics or send inspected page data to a server. It requests page and tab access so a picker started from a mobile extension page can wait for a selection on any supported webpage in the same browser window. The content controller stays idle until the user starts the picker.

## Installation

Install [CSS Insight from Firefox Add-ons](https://addons.mozilla.org/firefox/addon/css-insight/) on Firefox desktop or Firefox for Android.

The current target requires Firefox 115 or newer on desktop and Firefox 120 or newer on Android.

## How to use

1. Open a regular webpage and select the CSS Insight toolbar icon.
2. Select **Pick an Element**.
3. Switch to any supported webpage in the same browser window and click or tap an element. The first selection wins and picking stops in every tab.
4. Return to CSS Insight. The selector field updates without requiring a popup refresh.
5. Retrieve declared or computed styles, inspect page rules, or apply a CSS preview.

The picker waits for up to two minutes and can be cancelled from the extension interface. On Firefox Android, CSS Insight remembers the page that supplied the selected element, so later CSS operations target that page.

Firefox does not allow extensions to run on browser-internal pages, the PDF viewer, Reader View, Firefox Add-ons, and other protected Mozilla pages.

## CSSOM limitations

Browsers prevent scripts from reading the rules of some cross-origin stylesheets. CSS Insight reports these inaccessible stylesheets, but cannot inspect their declarations without broader network permissions. Declared styles, media rules and keyframes therefore represent the CSS rules exposed by the page CSSOM.

Document and open-shadow-root `adoptedStyleSheets` are included. Matching iframe documents are inspected in their own frame context. Closed shadow roots remain inaccessible because their contents are intentionally hidden from ordinary page scripts.

## Development

The project uses vanilla JavaScript and has no runtime or development dependencies beyond Node.js 18 or newer.

```bash
npm test
npm run check
npm run build
```

`npm run build` creates two reproducible release archives in `dist/`:

- a minimal AMO package built from an explicit allowlist;
- a complete source archive with tests, metadata and build tools.

## License

CSS Insight is licensed under the [MIT License](LICENSE).

## Third-party library

CSS Insight includes [highlight.js](https://highlightjs.org/) 11.10.0 under the BSD 3-Clause License. The packaged syntax theme is `atom-one-light`. See [third_party/LICENSE.highlightjs.txt](third_party/LICENSE.highlightjs.txt).
