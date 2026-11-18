/**
 * SiteReportsPage — /site/:studyId/reports  ("Reports Studio")
 *
 * Site personnel get the same Reports Studio as the Sponsor / CRO workspace:
 * the All Subjects workbook. The backend scopes it to the caller's site and
 * environment from the workspace token (siteWorkspaceController
 * .downloadEnrollmentReport), so the file holds this site's subjects only.
 */
import ReportsPage from '@/features/sponsor/pages/ReportsPage';

export default function SiteReportsPage() {
  return <ReportsPage site />;
}
