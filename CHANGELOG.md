# Changelog

## 1.23.1 - 2026-10-28

### Added

- Complete interface localizations for German, Spanish, Japanese, Brazilian Portuguese and Ukrainian alongside English.

### Development

- Static checks now require every supported locale to contain the complete English message-key set and a store-safe description.

## 1.23.0 - 2026-10-28

### Added

- The element picker now runs in matching iframe documents and keeps the selected frame as the target for later CSS operations.
- Elements inside open shadow roots can be selected and inspected through nested host paths.
- Declared Styles, Computed Styles, Media Rules, Keyframes and Apply Rule now use the selected frame and open shadow-root context.

### Changed

- Related `about:blank`, `about:srcdoc`, `data:` and `blob:` frames are included when their creator is an allowed page.
- CSS preview styles are isolated per document or shadow root, so updating one preview does not replace a preview in another root.
- The on-page details dialog stays in the top frame to avoid being clipped by a small iframe.

### Fixed

- Picker-generated selectors are now unique within their actual document or shadow root instead of being collapsed to the outer shadow host.
- A removed or replaced open shadow root produces a stable localized result instead of running the operation against the wrong document.
- Document-aware routing is used when supported so a navigated iframe cannot silently receive operations intended for its previous document.

### Development

- Added a shared inspection-target helper, iframe routing checks and nested open-shadow-root regression coverage.
- Added iframe and open shadow-root cases to the modern CSS fixture.
- Removed the obsolete selector-token helper and limited persistent frame scripts to the picker dependencies.

## 1.22.0 - 2026-10-28

### Added

- Declared Styles now finds matching rules inside `@media`, `@supports`, `@layer`, `@container`, `@scope` and native CSS nesting while preserving their parent context.
- Document-level `adoptedStyleSheets` are included in declared styles, media-rule and keyframe inspection.

### Changed

- Declared-style matching now checks real page elements against complete selector branches instead of merging tag, class and ID fragments from unrelated comma-separated selectors.
- Pseudo-element and transient-state rules such as `:hover` remain discoverable for the selected element.
- Media rules and keyframes are collected recursively rather than only from the top level of each stylesheet.

### Fixed

- Invalid selectors now return a stable localized message from both Declared Styles and Computed Styles.
- Selector text and stylesheet errors are sanitized before being written into generated CSS comments.

### Development

- Added a shared, browser-independent CSSOM walker and focused coverage for nested rules, constructed stylesheets, selector lists, pseudo-elements and invalid input.

## 1.21.1 - 2026-08-27

### Fixed

- Stabilized the desktop extension popup width by removing its viewport-dependent sizing feedback loop and reserving consistent space for the vertical scrollbar.
- Unrelated local-storage updates no longer trigger popup DOM updates.
- Repeated tracking of the same target tab no longer rewrites local storage.

### Development

- Added regression coverage for fixed popup geometry, filtered storage updates and deduplicated target tracking.

## 1.21.0 - 2026-08-15

### Changed

- **Pick an Element** now arms every supported webpage in the current browser window without closing the extension interface or activating a tab.
- The first element selected in that window wins, stops the picker in the other tabs and becomes the target for later CSS operations.
- Picker sessions expire after two minutes and can be cancelled from the extension interface.
- Broad page and tab permissions are retained because they are required for the any-tab mobile workflow.

### Fixed

- Picker sessions and selected results are isolated by browser window.
- Token validation and serialized background updates ensure that simultaneous clicks cannot produce two winners.
- Picked selectors appear in an open or reopened extension interface without a manual refresh.
- Protected Mozilla pages remain excluded before script injection is attempted.
- Embedded and runtime-generated styles now show a descriptive source instead of the raw CSSOM value `null`.
- A tab that does not answer a content message can no longer block the picker queue permanently.
- Old token-scoped stop commands can no longer disable a newer picker session.
- The extension interface always leaves its disabled state when the background does not respond in time.
- Dynamically injected style collectors now load their helpers explicitly, preventing `getSubSelectors` and `formatRule` reference errors.

### Development

- Pure state-machine tests cover window isolation, cancellation, expiry and first-selection-wins behavior.
- Reproducible release archives separate the minimal AMO package from the complete source package, with project files directly at the source ZIP root.
