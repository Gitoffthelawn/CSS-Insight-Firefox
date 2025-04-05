export function formatTagName(tagName) {
  const formattedTagName = tagName.replaceAll(/ +/g, ".");
  return formattedTagName;
}