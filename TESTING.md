# Manual Firefox test checklist

Run `npm run build`, then load `dist/firefox/manifest.json` through `about:debugging#/runtime/this-firefox`.

## Popup stability

- Open the extension popup on desktop and leave it open for at least 30 seconds. Confirm its width remains fixed and no horizontal jumping occurs.
- Reload or navigate the active webpage while the popup is open. Confirm background tab tracking does not resize or visibly redraw the popup.
- Arm and cancel **Pick an Element** several times. Confirm the status message can change the popup height without changing its width.

## Localization

- Run `npm run check` and confirm all 82 message keys are present in `de`, `en`, `es`, `ja`, `pt_BR` and `uk`.
- Switch the browser UI through German, Spanish, Japanese, Brazilian Portuguese and Ukrainian, restarting the browser when prompted. Confirm the extension name, description, popup controls, picker tooltips, status messages and on-page details dialog use the selected locale.
- In every locale, trigger an invalid selector, a protected-page message, a picker timeout and an unavailable iframe or shadow-root target. Confirm no empty labels or raw localization keys appear.
- Confirm long German and Portuguese labels wrap vertically without changing the desktop popup width.
- Open the update page in every locale and confirm its title, features, tips, links and Close button are translated.
- Inspect the popup and update page DOM and confirm `lang` matches the browser UI locale and `dir` matches its writing direction.

## Page access

- Open a normal HTTPS page and confirm all page actions are enabled.
- Open Google Search and confirm element picking and computed styles work.
- Open Firefox Add-ons and confirm CSS Insight displays a protected-page explanation.
- Open `support.mozilla.org` and confirm the protected Mozilla page explanation.
- Open `about:addons` and `about:debugging` and confirm a protected-page explanation.
- Open a local HTML file and confirm CSS Insight either works or displays a visible access error.
- Open a PDF in Firefox and Reader View and confirm failed access is explained without breaking the popup.

## Element picker

- Select **Pick an Element**. Confirm the extension interface stays open and no webpage is activated automatically.
- Switch to any supported webpage in the same window, then click a normal element. Confirm the picker stops automatically in all tabs.
- Return to CSS Insight and confirm the generated selector appears without refreshing the popup.
- Confirm **Current target** shows the selected page, iframe and open shadow-root path. Select **Use active page** and confirm the hidden frame and shadow context is cleared.
- Pick a link. Confirm the selecting click does not navigate and the link works normally afterward.
- Pick an element whose class contains punctuation, such as a utility class with `:`. Confirm the generated selector is accepted by **Get Computed Styles**.
- Start the picker, cancel it from the popup, then start it again and complete a selection.
- Leave the picker armed for two minutes. Confirm it stops and the interface returns to **Pick an Element**.
- Click elements in two armed tabs as close together as practical. Confirm only the first accepted selector is retained.

## CSS tools

- Serve `tests/fixtures/modern-css.html` from localhost and use it for the modern CSS checks below.
- Retrieve declared styles for `body` and for the selected element.
- Retrieve a matching rule inside each of `@media`, `@supports`, `@layer`, `@container` and `@scope`. Confirm every result retains its parent at-rule context.
- Test native CSS nesting with a selector that uses `&`. Confirm the nested rule is returned for the matching element.
- Add a constructed stylesheet through `document.adoptedStyleSheets`. Confirm its rules, media queries and keyframes are returned and labeled **constructed stylesheet**.
- Add `.other, .unrelated` beside a selected `.card` rule. Confirm unrelated selector branches are not returned.
- Confirm `.card:hover` and `.card::before` remain discoverable when `.card` is selected.
- Reload the extension over an existing test tab, retrieve declared styles and confirm the page console contains no missing-helper reference error.
- Retrieve a rule declared inside a page `<style>` element. Confirm its source is labeled as inline instead of `null`.
- Apply a CSS Insight preview, retrieve the same rule and confirm its source is labeled **CSS Insight preview**.
- Retrieve computed styles for a valid selector.
- Filter Computed Styles by a property name such as `grid`, then by a resolved value such as `rgb`. Confirm Copy, Save and View More Details use only the visible filtered result.
- Enter a filter with no matches and confirm a localized empty result appears. Press Escape and confirm the complete computed result returns without another page query.
- Enter an invalid selector in both Declared Styles and Computed Styles. Confirm the localized validation result is shown without breaking the popup.
- Retrieve media rules and keyframes on a page that contains them.
- Resize the test viewport across a media-query boundary and retrieve Media Rules again. Confirm each result reports whether its media conditions match the current frame environment.
- Test nested `@media` rules and confirm an inner result is marked matching only when every enclosing media condition also matches.
- Copy retrieved CSS and save it to `styles.css`.
- Open **View More Details**, copy from the native page dialog, close it with Escape and close it by selecting the backdrop. Confirm Tab stays inside the dialog and focus returns to the previously focused page element.
- Apply a CSS rule, then apply a different rule. Confirm the second preview replaces the first CSS Insight style element.
- Select **Remove Preview** and confirm the selected document or shadow root returns to its original styling without a reload. Select it again and confirm the popup reports that no preview is active.

## Iframe and shadow-root targets

- In `tests/fixtures/modern-css.html`, start the picker and select `.frame-card` inside the iframe. Confirm the popup stores the selector and Declared Styles, Computed Styles, Media Rules and Keyframes all read from the iframe document.
- Apply a rule to `.frame-card`. Confirm the rule changes the iframe element rather than a matching element in the top document.
- Open View More Details for iframe output. Confirm the dialog appears over the top document and is not clipped to the iframe bounds.
- Select `.shadow-card` inside the open shadow root. Confirm the picker tooltip shows the host path separated with `>>>` and the popup keeps the local `.shadow-card` selector.
- Retrieve declared and computed styles for `.shadow-card`. Confirm the inline shadow stylesheet and its media rule are returned.
- Apply two preview rules inside the open shadow root. Confirm the second replaces the first in that root without removing a preview previously applied to the document.
- Remove `#component-fixture` after selecting `.shadow-card`, then run a CSS action. Confirm CSS Insight reports that the selected target is no longer available.
- Confirm a click inside a closed shadow root selects its visible host instead of claiming access to hidden descendants.
- Repeat the iframe and open shadow-root checks in a same-origin nested iframe and an `about:srcdoc` iframe.

## Firefox Android

- Load the extension on Firefox Android 120 or newer with `web-ext run --target=firefox-android`.
- Repeat element picking, computed styles, copy, and protected-page checks.
- Open pages A and B, invoke CSS Insight and start the picker. Confirm Firefox does not choose a page for you.
- Switch to page B, pick an element, then return to the existing CSS Insight interface. Confirm the selector appears without a refresh.
- Retrieve styles, then arm the picker again and choose an element on page A. Confirm later CSS actions target page A.
- Repeat the page-to-interface cycle at least three times. Confirm there is no wrong-tab activation, permanent disabled state or manual refresh.
- Repeat **Pick an Element** immediately after returning from a successful selection. Confirm the next page receives the picker every time.
- Include an old, unloaded or discarded tab in the window. Confirm it cannot leave the interface permanently disabled.
- Confirm touch selection stops after one tap and protected Mozilla pages do not fall back to an older target.
- Confirm the update page Close button closes its tab.

## Window isolation

- Open two browser windows and arm the picker in each.
- Pick an element in the second window. Confirm the first window remains armed and keeps its own selector.
- Cancel the picker in the first window. Confirm the second window result remains unchanged.

## Package and permissions

- Confirm the extension requests `storage`, `tabs`, `activeTab`, `scripting` and all-sites host access.
- Confirm the picker content controller remains idle until **Pick an Element** is selected and page operations use the resident inspection runtime.
- Confirm the manifest content script uses `all_frames`, `match_about_blank` and `match_origin_as_fallback` without adding permissions.
- Confirm Firefox uses a non-persistent background event page, not a service worker.
- Run `npm run check` and confirm all automated tests pass.
- On Firefox Android, reload a page while requesting Media Rules or Keyframes. Confirm the operation either finishes in the original document or shows the localized retry message, never a result from the replacement document.
- Select an element inside an iframe and open View More Details. Confirm the modal still opens in the top frame.
- Update from `1.23.4` to `1.23.5` and confirm no release-notes tab opens. Simulate a minor-version update and confirm the localized release-notes page opens once.
- If `web-ext` is installed, run `web-ext lint --warnings-as-errors` before submitting to AMO.
- Run `unzip -t dist/CSS-Insight-firefox-1.23.5-amo.zip`.
- Run `unzip -t dist/CSS-Insight-firefox-1.23.5-source.zip` and confirm `manifest.json`, `package.json`, `scripts/` and `tests/` are at the ZIP root.
- Confirm the AMO archive contains no tests, build tools, `.gitignore`, `metadata.json`, or obsolete scripts.
