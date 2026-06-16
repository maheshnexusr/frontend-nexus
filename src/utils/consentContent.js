/**
 * consentContent — normalize the consent form_structure between the snake_case
 * shape it is PERSISTED as and the camelCase shape every consumer expects.
 *
 * Why this exists: all of the axios clients deep-convert request bodies
 * camelCase → snake_case, so the consent form_structure ({ blocks, ... }) is
 * stored snake_case in consent_templates.content (field_width, help_text,
 * heading_align, …). Responses are NOT camel-converted, so anything that reads
 * the content back (the Consent Builder slice, the SFB preview, ConsentFormFill,
 * the login gate) would see snake_case keys and silently lose field appearance /
 * layout settings. Mirror what the CRO study designer does on load: deep-camel
 * the structure so it round-trips cleanly.
 */

const toCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

function deepToCamel(value) {
  if (Array.isArray(value)) return value.map(deepToCamel);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [toCamel(k), deepToCamel(v)]),
  );
}

/** Deep-camel a list of consent blocks (blocks → pages → fields). */
export function normalizeConsentBlocks(blocks) {
  return Array.isArray(blocks) ? deepToCamel(blocks) : [];
}

/**
 * Deep-camel a consent content object ({ blocks, submissionControls, … }).
 * Legacy string / { html } / { text } content is returned untouched.
 */
export function normalizeConsentContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return content;
  // Only structured form content carries blocks; leave legacy shapes alone.
  if (!('blocks' in content) && !('submission_controls' in content) && !('submissionControls' in content)) {
    return content;
  }
  return deepToCamel(content);
}

export default normalizeConsentContent;
