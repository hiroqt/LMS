import axe from "axe-core";

/**
 * Runs axe on rendered markup. Color contrast is disabled here because jsdom
 * has no layout or computed colors; it is covered in the browser by
 * e2e/design-system.spec.ts and by tokens.test.ts.
 */
export async function axeViolations(container: Element = document.body) {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map((violation) => `${violation.id}: ${violation.help} (${violation.nodes.length})`);
}
