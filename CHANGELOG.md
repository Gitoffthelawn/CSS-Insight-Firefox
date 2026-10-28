# Changelog

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
