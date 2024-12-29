function formatMediaRule(rule) {
  let formattedRule = rule.cssText;

  formattedRule = formattedRule
    .replace(/\s*{\s*/g, ' {\n    ')
    .replace(/;\s*/g, ';\n    ')
    .replace(/\s*}\s*/g, '\n  }\n')
    .replace(/\n\s+}\s*/g, '\n  }\n')
    .replace(/\n\s*\n/g, '\n')
    .replace(/^(?!\s|@)(?=.{4,}).*/gm, '  $&')
    .replace(/^ {4}(.*\{)$/gm, '  $1');

  return formattedRule.trim();
}

function formatRegularRule(rule) {
  const formattedRule = rule.cssText
    .replace(/\{/g, '{\n  ')
    .replace(/;/g, ';\n  ')
    .replace(/\n\s*\}/g, '\n}');
  return formattedRule.trim();
}

function formatFlattenRule(rule) {
  return rule.cssText;
}

function formatRule(rule) {
  if (rule instanceof CSSMediaRule ||
      rule instanceof CSSSupportsRule ||
      rule instanceof CSSKeyframesRule) {
    return formatMediaRule(rule);
  } else {
    return formatRegularRule(rule);
  }
  
  return formatFlattenRule(rule);
}