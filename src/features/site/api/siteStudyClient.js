/**
 * siteStudyClient — the site-personnel study picker + DB switching.
 *
 *   GET  /api/v1/site/studies           → { studies: [...] }   (session token)
 *   POST /api/v1/site/studies/choose    { study_id, environment }
 *        → { workspaceToken, studyId, environment, siteId, personnelId,
 *            roleId, roleName, scope, permissions, tenantDatabaseName, ... }
 *
 * "Switching DB" is just choose() with a different study — the session token
 * stays valid. choose() persists the workspace token + study context so every
 * subsequent tenant-DB request (see siteWorkspaceClient) routes to
 * db_study_<id>_<env>.
 */

import siteAxiosClient from '@/api/siteAxiosClient';
import {
  setSiteStudies,
  setSiteStudyContext,
  clearSiteStudyContext,
} from '../authStore';

const BASE = '/api/v1/site/studies';

export const siteStudyClient = {
  /** The studies this person is assigned to (the picker list). */
  async list() {
    const res = await siteAxiosClient.get(BASE);
    const studies = Array.isArray(res.studies) ? res.studies : [];
    setSiteStudies(studies);
    return studies;
  },

  /**
   * Pick (or switch to) a study. Persists the workspace token + study context;
   * returns the full context including the permission tree the UI gates on.
   */
  async choose({ studyId, environment }) {
    const res = await siteAxiosClient.post(`${BASE}/choose`, {
      study_id:    studyId,
      environment,
    });
    return setSiteStudyContext(res);
  },

  /** Leave the current study and go back to the picker (keeps the session). */
  exitStudy() {
    clearSiteStudyContext();
  },
};

export default siteStudyClient;
