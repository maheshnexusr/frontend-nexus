/**
 * userService.js
 * Re-exports profileService and teamMemberService for backwards compatibility.
 * Prefer importing directly from profileService or teamMemberService.
 */

export { profileService as userService } from './profileService';
export { teamMemberService } from './teamMemberService';
