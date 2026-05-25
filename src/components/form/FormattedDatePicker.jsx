/**
 * FormattedDatePicker — re-export of the platform date picker.
 *
 * Historical name kept so existing call-sites continue to import this path.
 * The actual implementation lives in `PlatformDatePicker` — a Microsoft Fluent
 * style picker that renders a calendar popover and shows the chosen date in
 * DD-MMM-YYYY (e.g. "12-MAY-2026").
 *
 *   <FormattedDatePicker
 *     value={form.startDate}
 *     onChange={(e) => set('startDate')(e)}
 *     min={today}
 *   />
 */

export { default } from './PlatformDatePicker';
