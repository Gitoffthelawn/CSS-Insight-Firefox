export function formatTagName(tagName) {
  const formattedTagName = tagName.replace(/^[^#]*#/, "#");
  return formattedTagName;
}