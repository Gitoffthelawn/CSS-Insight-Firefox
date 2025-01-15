export function formatTagName(tagName) {
  const formattedTagName = tagName.replace(/^[^#]*#/, "#").replace(/\./g, ' .');
  return formattedTagName;
}