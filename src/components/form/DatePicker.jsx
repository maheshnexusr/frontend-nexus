/**
 * DatePicker — re-export of the platform date picker.
 *
 * Historical name kept so existing call-sites continue to import this path.
 * The actual implementation is in `PlatformDatePicker` — a Microsoft Fluent
 * style picker with a custom calendar popover (no browser-native UI).
 *
 * react-hook-form  register() pattern:
 *   <FormField label="Date of Birth" error={errors.dob?.message}>
 *     <DatePicker {...register('dob')} min="1900-01-01" max={today} />
 *   </FormField>
 *
 * react-hook-form  Controller pattern:
 *   <Controller
 *     name="visitDate"
 *     control={control}
 *     render={({ field }) => (
 *       <FormField label="Visit Date" error={errors.visitDate?.message}>
 *         <DatePicker {...field} min="2020-01-01" />
 *       </FormField>
 *     )}
 *   />
 */

export { default } from './PlatformDatePicker';
