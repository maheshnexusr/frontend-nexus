/**
 * headingStyle — shared definitions + renderer for Heading (h2/h3) field styling
 * configured in the Study Form Builder.
 *
 * A heading's optional style is persisted on the field as `field.headingStyle`:
 *   { textColor?, bgColor?, fontSize?, fontWeight?, align? }
 *
 * The same `headingStyleToCss()` is used by the builder canvas, the preview, and
 * the runtime so a configured heading looks identical everywhere. When no style
 * is configured (legacy headings, or nothing chosen) it returns `undefined` and
 * the heading keeps its default CSS-class appearance — preserving backward
 * compatibility.
 */

// Font sizes use clamp() so headings scale fluidly across desktop / tablet /
// mobile without media queries (min, preferred, max).
export const HEADING_FONT_SIZES = [
  { value: 'sm', label: 'Small',       css: 'clamp(0.875rem, 0.80rem + 0.4vw, 1rem)' },
  { value: 'md', label: 'Medium',      css: 'clamp(1rem, 0.90rem + 0.6vw, 1.25rem)' },
  { value: 'lg', label: 'Large',       css: 'clamp(1.25rem, 1.00rem + 1.0vw, 1.625rem)' },
  { value: 'xl', label: 'Extra Large', css: 'clamp(1.5rem, 1.20rem + 1.6vw, 2rem)' },
];

export const HEADING_FONT_WEIGHTS = [
  { value: 'normal',   label: 'Normal',    css: 400 },
  { value: 'medium',   label: 'Medium',    css: 500 },
  { value: 'semibold', label: 'Semi-Bold', css: 600 },
  { value: 'bold',     label: 'Bold',      css: 700 },
];

export const HEADING_ALIGNMENTS = [
  { value: 'left',   label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right',  label: 'Right' },
];

// Predefined, accessibility-minded theme pairs (dark text on a light tint of the
// same hue → AA contrast). Picking a theme sets both text + highlight at once
// for visual consistency; users can still fine-tune the raw colors afterwards.
export const HEADING_THEME_COLORS = [
  { name: 'Default', text: '',        bg: ''        },
  { name: 'Slate',   text: '#0f172a', bg: '#f1f5f9' },
  { name: 'Blue',    text: '#1e3a8a', bg: '#dbeafe' },
  { name: 'Green',   text: '#14532d', bg: '#dcfce7' },
  { name: 'Amber',   text: '#92400e', bg: '#fef3c7' },
  { name: 'Red',     text: '#991b1b', bg: '#fee2e2' },
  { name: 'Purple',  text: '#5b21b6', bg: '#ede9fe' },
  { name: 'Teal',    text: '#115e59', bg: '#ccfbf1' },
];

const SIZE_MAP   = Object.fromEntries(HEADING_FONT_SIZES.map((o) => [o.value, o.css]));
const WEIGHT_MAP = Object.fromEntries(HEADING_FONT_WEIGHTS.map((o) => [o.value, o.css]));

/** True when a heading has any custom style configured. */
export function hasHeadingStyle(field) {
  const hs = field?.headingStyle;
  return !!hs && typeof hs === 'object'
    && Object.values(hs).some((v) => v != null && v !== '');
}

/**
 * Build a React inline-style object from a heading's `headingStyle`. Only the
 * properties that are actually set are emitted, so unset ones fall through to
 * the default heading CSS. Returns `undefined` when nothing is configured.
 */
export function headingStyleToCss(field) {
  const hs = field?.headingStyle;
  if (!hs || typeof hs !== 'object') return undefined;

  const style = {};
  if (hs.textColor) style.color = hs.textColor;
  if (hs.fontSize && SIZE_MAP[hs.fontSize]) style.fontSize = SIZE_MAP[hs.fontSize];
  if (hs.fontWeight && WEIGHT_MAP[hs.fontWeight]) style.fontWeight = WEIGHT_MAP[hs.fontWeight];
  if (hs.align) style.textAlign = hs.align;
  if (hs.bgColor) {
    style.background = hs.bgColor;
    // Highlight reads as a block: padding + rounding + breathing room.
    style.padding = '0.5rem 0.75rem';
    style.borderRadius = '8px';
  }

  if (!Object.keys(style).length) return undefined;

  // Overflow + responsive safety, applied only when custom styling is present so
  // long titles wrap instead of overflowing their column on small screens.
  style.overflowWrap = 'break-word';
  style.wordBreak = 'break-word';
  style.maxWidth = '100%';
  return style;
}
