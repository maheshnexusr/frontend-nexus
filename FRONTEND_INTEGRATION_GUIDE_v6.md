# CRO Workspace — Frontend Integration Guide

> **For the frontend engineer / for Claude:** This file is a complete, copy-paste-ready contract for integrating the CRO Workspace APIs. Each endpoint lists the HTTP method, URL, required headers, request payload, success response, and every possible error response. Do **not** invent fields that aren't listed here — the backend will reject them.

---

## 0. Global conventions

### Base URL
```
{API_BASE_URL}/api/v1
```
Use `VITE_API_BASE_URL` (or your env equivalent) — do not hardcode `localhost:4000`.

### Content type
- JSON endpoints: `Content-Type: application/json`.
- File upload endpoints (photographs, CSV imports, email attachments): `multipart/form-data`. The form-field name to use is noted per endpoint.

### Auth header
```
Authorization: Bearer <accessToken>
```
All CRO endpoints require a **CRO-scope JWT** obtained from `/api/v1/auth/login/password` or `/api/v1/auth/login/otp/verify`. Sponsor-scope tokens will be rejected.

### Token lifetimes
- Access token: **15 minutes** (configurable).
- Refresh token: **7 days**.
- OTP: **10 minutes**.
- Activation link (CRO registration): **48 hours**.
- Account lock after failed login attempts: **30 minutes**.

### Response envelope
Success:
```json
{ "success": true, ...fields }
```
Error:
```json
{ "success": false, "message": "Human-readable message", "code": "OPTIONAL_CODE" }
```

### Standard HTTP codes
| Status | Meaning |
| --- | --- |
| 200 | Success |
| 201 | Resource created |
| 400 | Validation error |
| 401 | Not authenticated, bad/expired token, wrong scope |
| 403 | Authenticated but missing required permission (see Permission Matrix) |
| 404 | Not found |
| 409 | Conflict (duplicate, state mismatch, dependency check) |
| 422 | Business rule failure |
| 500 | Server error |

### Pagination / filter convention
List endpoints accept these query params (every list endpoint supports at least `page`, `limit`, `search`):
```
?page=1&limit=20&search=keyword&status=Active&sort=created_at&order=DESC
```
Response for lists:
```json
{
  "success": true,
  "items": [...],
  "pagination": { "page": 1, "limit": 20, "total": 142, "totalPages": 8 }
}
```

### Permissions (what causes 403)
Every non-auth endpoint is gated by a `<feature>:<action>` permission. Actions include `view`, `create`, `edit`, `delete`, `export`, `import`, `duplicate`, `configure`, `publish`, `lock`. A user with `is_system_role: true` bypasses all checks. If you see a 403, inspect `GET /profile/me/permissions` — the feature name in the route matches one of the permissions there.

### File upload limits
| Upload type | Max size | MIME types |
| --- | --- | --- |
| Profile / team / sponsor photo | 3 MB (2 MB for profile) | `image/jpeg`, `image/png`, `image/gif` |
| CSV imports (countries, locations) | 5 MB | `text/csv`, `application/vnd.ms-excel` |
| Email template attachments | 5 MB | `application/pdf`, `image/png`, `image/jpeg`, `.doc`, `.docx` |

---

## 1. Authentication (`/api/v1/auth`)

### 1.1 Register (CRO signup)
- **Method / URL:** `POST /api/v1/auth/register`
- **Auth:** none
- **Payload:**
  ```json
  { "full_name": "John Admin", "email_address": "john@cro.com" }
  ```
- **Success (201):**
  ```json
  {
    "success": true,
    "userId": "usr_abc123",
    "message": "Registration successful. Please check your email to activate your account.",
    "emailSent": true
  }
  ```
- **Errors:**
  | Status | `message` |
  | --- | --- |
  | 400 | `"Full Name is required."` / `"Valid email address is required."` |
  | 409 | `"An account with this email already exists."` |

### 1.2 Activate account
- **Method / URL:** `POST /api/v1/auth/activate`
- **Auth:** none
- **Payload:**
  ```json
  { "token": "<from-email-link>", "password": "Secret1!", "confirm_password": "Secret1!" }
  ```
- **Success (200):** `{ "success": true, "message": "Account activated.", "userId": "usr_abc" }`
- **Errors:** `400` (mismatch / weak password), `404` (invalid token), `410` (expired).

### 1.3 Login with password
- **Method / URL:** `POST /api/v1/auth/login/password`
- **Payload:** `{ "email_address": "john@cro.com", "password": "Secret1!" }`
- **Success (200):**
  ```json
  {
    "success": true,
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "expiresIn": 900,
    "user": {
      "userId": "usr_abc",
      "teamMemberId": "tm_xyz",
      "fullName": "John Admin",
      "email": "john@cro.com",
      "roleId": "role_admin",
      "roleName": "CRO Administrator",
      "isSystemRole": true,
      "photographUrl": null
    }
  }
  ```
- **Errors:** `400` (bad payload), `401 "Invalid email or password."`, `403 "Account is not active."`, `423 "Account locked. Try again in N minutes."`

### 1.4 Login via OTP — request
- **Method / URL:** `POST /api/v1/auth/login/otp/request`
- **Payload:** `{ "email_address": "john@cro.com" }`
- **Success (200):** `{ "success": true, "message": "OTP sent to your email.", "expiresInMinutes": 10 }`
- **Errors:** always 200 for a non-existent email (generic response — security). Real errors: `400` bad email, `423` locked.

### 1.5 Login via OTP — verify
- **Method / URL:** `POST /api/v1/auth/login/otp/verify`
- **Payload:** `{ "email_address": "john@cro.com", "otp": "123456" }`
- **Success (200):** identical shape to 1.3.
- **Errors:** `400 "OTP must be 6 digits."`, `401 "Invalid or expired OTP."`, `429` on too many attempts.

### 1.6 Refresh access token
- **Method / URL:** `POST /api/v1/auth/refresh`
- **Payload:** `{ "refresh_token": "<jwt>" }`
- **Success (200):** `{ "success": true, "accessToken": "<jwt>", "expiresIn": 900 }`
- **Errors:** `401 "Invalid or expired refresh token."`

### 1.7 Logout
- **Method / URL:** `POST /api/v1/auth/logout`
- **Auth:** Bearer
- **Success (200):** `{ "success": true, "message": "Logged out." }`

---

## 2. Profile (`/api/v1/profile`)

### 2.1 Get my profile
- `GET /api/v1/profile/me` → `{ "success": true, "item": { "userId": "...", "fullName": "...", "email": "...", "contactNumber": "...", "photographUrl": "/uploads/team-members/...", "role": { "roleId": "...", "roleName": "...", "isSystemRole": true } } }`

### 2.2 Get my permissions
- `GET /api/v1/profile/me/permissions` → `{ "success": true, "roleId": "role_admin", "isSystemRole": true, "permissions": [ { "featureName": "ClinicalPrograms.Sponsors", "canView": true, "canCreate": true, "canEdit": true, ... } ] }`
- Use this to build a client-side permission guard for menu items and button disabling.

### 2.3 Update my profile (multipart)
- `PUT /api/v1/profile/me`
- `multipart/form-data` with:
  - `full_name` (required)
  - `contact_number` (optional)
  - `photograph` (optional file field; JPEG/PNG/GIF, ≤ 2 MB)
  - `remove_photo` (optional boolean — pass `"true"` to clear existing photo)
- **Success (200):** `{ "success": true, "item": { ...profile }, "message": "Your profile has been updated successfully." }`
- **Errors:** `400` (missing name / invalid file type), `413` (file too large).

### 2.4 Change password
- `POST /api/v1/profile/change-password`
- Payload: `{ "current_password": "...", "new_password": "...", "confirm_new_password": "..." }`
- **Success (200):** `{ "success": true, "message": "Password changed successfully." }`
- **Errors:** `400` (validation, password strength, mismatch), `401 "Current password is incorrect."`

---

## 3. Dashboard (`/api/v1/dashboard`)

### 3.1 Get dashboard
- `GET /api/v1/dashboard`
- Response depends on user: system-role users get CRO-wide aggregates; regular users get only what they're assigned to.
- **Success (200):**
  ```json
  {
    "success": true,
    "cards": { "totalSponsors": 12, "totalStudies": 48, "totalTeamMembers": 35, "activeStudies": 30, "closedStudies": 6 },
    "charts": { "studiesByPhase": [...], "enrollmentByMonth": [...] },
    "recentActivity": [...],
    "lastSyncedAt": "2026-04-21T10:02:00Z"
  }
  ```

### 3.2 Force re-sync
- `POST /api/v1/dashboard/sync`
- **Success (200):** `{ "success": true, "message": "Dashboard updated successfully." }`

---

## 4. Workspace selection (`/api/v1/workspace`)

### 4.1 List sponsors accessible to the current user
- `GET /api/v1/workspace/sponsors?search=pfizer`
- **Success (200):**
  ```json
  {
    "success": true,
    "sponsors": [
      { "sponsorId": "spn_abc", "organizationName": "Pfizer", "fullName": "Pfizer Inc.", "photographUrl": "...", "activeStudies": 12, "status": "Active" }
    ]
  }
  ```
- Backing the "Choose Sponsor Workspace" screen.

---

## 5. Masters

### 5.1 Email Templates (`/api/v1/masters/email-templates`)

| Action | Method / Path |
| --- | --- |
| List | `GET /` |
| Get one | `GET /:id` |
| Create | `POST /` |
| Update | `PUT /:id` |
| Delete | `DELETE /:id` |
| Export CSV | `GET /export` (returns `text/csv`) |
| Duplicate | `POST /:id/duplicate` |
| Preview rendered email | `POST /preview` |
| Add attachment | `POST /:id/attachments` (multipart, `file` field) |
| Remove attachment | `DELETE /:id/attachments/:attachmentId` |

Create/Update payload:
```json
{
  "template_name": "Welcome Email",
  "template_code": "CRO_USER_WELCOME",
  "category": "Transactional",
  "description": "Sent after team member account activation.",
  "subject_line": "Welcome to SclinNexus, {{full_name}}",
  "email_body": "<p>Hello {{full_name}}, ...</p>",
  "from_name": "SclinNexus",
  "from_email": "no-reply@sclinnexus.com",
  "reply_to": "support@sclinnexus.com",
  "cc_emails": ["ops@cro.com"],
  "bcc_emails": [],
  "placeholders": ["full_name", "login_url"],
  "template_type": "Transactional",
  "is_system_template": false,
  "status": "Active"
}
```

Preview payload:
```json
{ "subject_line": "Hello {{name}}", "email_body": "<p>Hi {{name}}</p>", "sample_data": { "name": "John" } }
```
**Success (200):** `{ "success": true, "renderedSubject": "Hello John", "renderedBody": "<p>Hi John</p>" }`

### 5.2 Study Phases (`/api/v1/masters/study-phases`)

| Action | Method | Payload |
| --- | --- | --- |
| List | `GET /` | — |
| Export | `GET /export` | CSV response |
| Create | `POST /` | `{ "phase_name": "Phase I", "description": "...", "status": "Active" }` |
| Update | `PUT /:id` | same as Create |
| Delete | `DELETE /:id` | — |

### 5.3 Country (`/api/v1/masters/countries`)

| Action | Method | Payload |
| --- | --- | --- |
| List | `GET /?status=Active&search=India` | — |
| Export CSV | `GET /export` | — |
| Import CSV | `POST /import` (multipart, `file` field) | CSV columns: `country_name`, `iso_code`, `status`. Response: `{ "success": true, "imported": 42, "skipped": 1, "errors": [...] }` |
| Create | `POST /` | `{ "country_name": "India", "iso_code": "IN", "phone_code": "+91", "status": "Active" }` |
| Update | `PUT /:id` | same |
| Delete | `DELETE /:id` | — |

### 5.4 Locations (`/api/v1/masters/locations`)

| Action | Method | Payload |
| --- | --- | --- |
| List | `GET /?country_id=cntry_in&search=Mumbai&status=Active` | — |
| Export | `GET /export` | CSV |
| Import | `POST /import` (multipart `file`) | Same shape as country import |
| Create | `POST /` | `{ "country_id": "cntry_in", "state": "Maharashtra", "district": "Mumbai City", "city": "Mumbai", "postal_code": "400001", "status": "Active" }` |
| Update | `PUT /:id` | same |
| Delete | `DELETE /:id` | — |

### 5.5 Regions (`/api/v1/masters/regions`)

| Action | Method | Payload |
| --- | --- | --- |
| List | `GET /` | — |
| Export | `GET /export` | CSV |
| Create | `POST /` | `{ "region_name": "APAC", "description": "...", "country_ids": ["cntry_in","cntry_sg"], "display_order": 3, "status": "Active" }` |
| Update | `PUT /:id` | same |
| Delete | `DELETE /:id` | — |

---

## 6. Clinical Programs — Sponsors (`/api/v1/sponsors`)

All require CRO auth.

### 6.1 List sponsors
- `GET /api/v1/sponsors?page=1&limit=20&search=pfizer&status=Active`
- **Success (200):** `{ "success": true, "items": [...], "pagination": {...} }`

### 6.2 Export sponsors
- `GET /api/v1/sponsors/export` → `text/csv` attachment download.

### 6.3 Get a sponsor
- `GET /api/v1/sponsors/:id` → `{ "success": true, "item": { sponsor } }`

### 6.4 Create sponsor (multipart)
- `POST /api/v1/sponsors`
- `multipart/form-data` with:
  - `full_name` (required) — contact full name
  - `email_address` (required)
  - `contact_number` (optional)
  - `organization_name` (required)
  - `website` (optional)
  - `registration_number` (required)
  - `address_line1`, `address_line2` (optional)
  - `location_id`, `country_id` (optional but recommended)
  - `status` (optional; defaults to `"Active"`)
  - `photograph` (file field; JPEG/PNG, ≤ 3 MB)
- **Success (201):** `{ "success": true, "item": { "sponsor_id": "spn_abc", ... } }`
- **Errors:** `400` (missing required), `409 "A sponsor with this registration number already exists."`

### 6.5 Update sponsor
- `PUT /api/v1/sponsors/:id` — same multipart fields. `email_address` is optional on update.

### 6.6 Delete sponsor
- `DELETE /api/v1/sponsors/:id`
- **Errors:** `409 "Cannot delete sponsor with active studies."`

---

## 7. Clinical Programs — Studies (`/api/v1/studies`)

Studies are created in a **6-step wizard**. Step 1 creates the draft; steps 2–5 update it; step 6 publishes it.

### 7.1 List studies
- `GET /api/v1/studies?page=1&limit=20&sponsor_id=spn_abc&status=Active&search=covid`
- **Success (200):** paginated list.

### 7.2 Export / Get / Delete
- `GET /api/v1/studies/export` → CSV.
- `GET /api/v1/studies/:id` → study detail including all steps populated so far.

### 7.3 Step 1 — Basic Info
- **Create:** `POST /api/v1/studies/step-1`
- **Update:** `PUT /api/v1/studies/:id/step-1`
- Payload:
  ```json
  {
    "protocol_number": "COV-III-001",
    "study_title": "COVID-19 Phase III Vaccine Trial",
    "study_phase_id": "phase_3",
    "sponsor_id": "spn_abc",
    "therapeutic_area": "Infectious Disease",
    "study_description": "Randomized Phase III trial...",
    "scopes": ["EDC", "ePRO"]
  }
  ```
- `scopes` — array, **at least one** of `"EDC"`, `"Survey"`, `"ePRO"`. Drives the sponsor menu later.
- **Success (201/200):** `{ "success": true, "item": { "study_id": "std_xyz", ...step1 fields } }`
- **Errors:** `400` (missing fields, empty scopes), `409 "A study with this protocol number already exists."`

### 7.4 Step 2 — Timeline & Coverage
- **Method / URL:** `PUT /api/v1/studies/:id/step-2`
- Payload:
  ```json
  {
    "start_date": "2026-06-01",
    "expected_end_date": "2028-12-31",
    "max_sites": 50,
    "max_enrollments": 2000,
    "coverage_type": "COUNTRY",
    "coverage_id": "cntry_us"
  }
  ```
- `coverage_type`: `"COUNTRY"` or `"REGION"`. `coverage_id` points to the selected country or region.
- `max_sites` is **required only when scopes include EDC**; ignored for pure Survey/ePRO studies. If omitted for an EDC study, you get `400 "Maximum Number of Sites is required."`

### 7.5 Step 3 — Configuration (toggles)
- **Method / URL:** `PUT /api/v1/studies/:id/step-3`
- Payload:
  ```json
  {
    "enable_consent_manager": true,
    "enable_query_manager": true,
    "enable_data_manager": true,
    "enable_navigation_bar": true
  }
  ```
- `enable_data_manager` only applies to EDC studies. Frontend should hide the toggle when Step 1 scopes are Survey/ePRO-only.

### 7.6 Step 4 — Study Design (form builder)
- **Method / URL:** `PUT /api/v1/studies/:id/step-4`
- Payload:
  ```json
  {
    "form_structure": { "sections": [ { "name": "Demographics", "fields": [ ... ] } ] },
    "version": 1,
    "triggers": [
      {
        "trigger_condition": { "field": "serious_adverse_event", "operator": "eq", "value": true },
        "trigger_action": "Both",
        "trigger_recipients": ["sponsor_admin", "medical_monitor"],
        "email_template_id": "et_sae_alert",
        "is_active": true
      }
    ]
  }
  ```
- `form_structure` can be a JSON object or a stringified JSON — backend parses both.
- `trigger_action`: one of `"Email"`, `"Notification"`, `"Both"`.

### 7.7 Step 5 — Team Assignment
- **Method / URL:** `PUT /api/v1/studies/:id/step-5`
- Payload:
  ```json
  {
    "assignments": [
      { "team_member_id": "tm_001", "study_role": "Principal Investigator" },
      { "team_member_id": "tm_002", "study_role": "Monitor" }
    ]
  }
  ```
- **Errors:** `400 "Please assign at least one team member to the study."`

### 7.8 Step 6 — Publish
- **Method / URL:** `POST /api/v1/studies/:id/publish`
- Payload:
  ```json
  {
    "environment": "UAT",
    "status": "Published",
    "notes": "Initial UAT build for integration testing."
  }
  ```
- `environment`: `"UAT"` or `"LIVE"`.
- `status`: `"Published"`, `"Active"`, `"Inactive"`, or `"Locked"`.
- **Success (201):**
  ```json
  {
    "success": true,
    "item": {
      "version_id": "sv_def",
      "version_number": 3,
      "environment": "UAT",
      "database_name": "db_study_std_xyz_uat",
      "published_at": "2026-04-21T10:30:00Z"
    }
  }
  ```
- Publishing provisions the per-study tenant database (`db_study_<studyId>_<env>`). If provisioning fails, the response is `500` and no version row is written — safe to retry.
- **Errors:** `409` if the study is incomplete (missing any of step 1–5).

### 7.9 Send study invitations
- **Method / URL:** `POST /api/v1/studies/:id/invitations`
- Payload:
  ```json
  {
    "version_id": "sv_def",
    "environment": "UAT",
    "recipients": [
      { "email": "pi@sponsor.com", "recipient_type": "Sponsor" },
      { "email": "coordinator@site.com", "recipient_type": "Site" }
    ]
  }
  ```
- `recipient_type`: `"Sponsor"`, `"Site"`, `"Participant"`, `"CRO"`.
- **Success (200):** `{ "success": true, "sent": 2, "failed": 0, "details": [...] }`

---

## 8. CRO Team Administration

### 8.1 Team Members (`/api/v1/team-members`)

| Action | Method | Path | Body (multipart for create/update) |
| --- | --- | --- | --- |
| List | `GET` | `/?page=1&limit=20&search=&role_id=&status=` | — |
| Export | `GET` | `/export` | — |
| Get one | `GET` | `/:id` | — |
| Create | `POST` | `/` | see below |
| Update | `PUT` | `/:id` | same fields as create |
| Delete | `DELETE` | `/:id` | — |

Create/Update multipart fields:
- `full_name` (required)
- `email_address` (required on create; optional on update)
- `contact_number` (optional)
- `job_title` (optional)
- `role_id` (required)
- `study_ids` (optional; JSON-encoded array or repeated form field) — studies to assign the new user to
- `status` (optional)
- `photograph` (file, JPEG/PNG, ≤ 3 MB)
- **Response:** `{ "success": true, "item": { "team_member_id": "tm_abc", ...fields, "role": { "role_id": "...", "role_name": "..." } } }`
- **Errors:**
  - `400` missing fields.
  - `409 "A team member with this email already exists."`
  - `403 "Cannot assign role with greater permissions than your own for feature 'X'."` — you can't escalate privileges.

### 8.2 Roles & Permissions (`/api/v1/roles`)

| Action | Method / Path |
| --- | --- |
| List | `GET /` |
| Get | `GET /:id` |
| Create | `POST /` |
| Update | `PUT /:id` |
| Delete | `DELETE /:id` (blocked for `is_system_role: true`) |

Create/Update payload:
```json
{
  "role_name": "Study Coordinator",
  "description": "Can manage assigned studies end-to-end.",
  "permissions": [
    {
      "feature_name": "ClinicalPrograms.Studies",
      "can_view": true, "can_create": true, "can_edit": true,
      "can_delete": false, "can_export": true, "can_duplicate": false,
      "can_lock": false, "can_import": false, "can_configure": true, "can_publish": false
    }
  ]
}
```
- **Errors:** `409 "System roles cannot be modified."`, `409 "Cannot delete role in use by team members."`, `400` if `permissions` is empty.

**Feature names you can use** (match the strings the backend authorizes on):
- `Dashboard`, `WorkspaceSelection`, `ActivityLog`
- `Masters.EmailTemplates`, `Masters.StudyPhases`, `Masters.Country`, `Masters.Locations`, `Masters.Regions`
- `ClinicalPrograms.Sponsors`, `ClinicalPrograms.Studies`
- `CROTeamAdministration.TeamMembers`, `CROTeamAdministration.RolesPermissions`

---

## 9. Activity Log (`/api/v1/activity-logs`)

- `GET /api/v1/activity-logs?page=1&limit=50&from=2026-04-01&to=2026-04-21&user_id=usr_abc&module=Studies&action_type=CREATE&search=covid&status=SUCCESS`
- **Success (200):**
  ```json
  {
    "success": true,
    "items": [
      { "log_id": "al_abc", "timestamp": "2026-04-21T10:05:00Z", "user_id": "usr_abc", "user_name": "John Admin",
        "action_type": "CREATE", "module": "Studies", "entity_type": "Study", "entity_id": "std_xyz", "entity_name": "COVID-19 Phase III",
        "action_description": "Study created (Step 1 completed).", "ip_address": "10.0.0.5", "status": "SUCCESS" }
    ],
    "pagination": {...}
  }
  ```
- `GET /api/v1/activity-logs/export` → CSV (same filters).
- `GET /api/v1/activity-logs/:id` → full record with before/after diff when applicable.

---

## 10. Error handling patterns

1. Always check `response.success === true`.
2. On `401`:
   - Call `/auth/refresh` with the stored refresh token **exactly once**. Retry the failing request.
   - If refresh also returns `401`, clear tokens and redirect to `/login`.
3. On `403`:
   - Do NOT redirect — keep the user where they are and show the `message` as a toast.
   - Optionally call `/profile/me/permissions` to re-sync the client-side permission guard.
4. On `409` and `422`:
   - Show the `message` inline under the form field. These are domain validations — do not retry.
5. On `413`:
   - File upload exceeded limit — show size limit and ask to reselect.
6. On `5xx`:
   - Retry once after 1s. If still failing, show generic "Something went wrong."

---

## 11. Suggested frontend module layout

```
src/api/
  axios.ts                    // base client + interceptors (auth, refresh)
  cro/
    auth.ts                   // register, activate, login, refresh, logout
    profile.ts                // me, me/permissions, update, change-password
    dashboard.ts
    workspace.ts              // sponsor workspace selector
    masters/
      emailTemplates.ts
      studyPhases.ts
      countries.ts
      locations.ts
      regions.ts
    sponsors.ts
    studies.ts                // step1..step5, publish, invitations
    team.ts
    roles.ts
    activity.ts

src/context/
  AuthContext.tsx             // accessToken, refreshToken, user, permissions
  WorkspaceContext.tsx        // currently selected sponsor workspace (from §4.1)

src/hooks/
  usePermission.ts            // (feature, action) => boolean — reads permissions from AuthContext
```

### Axios interceptor essentials
```ts
// Request: attach bearer
config.headers.Authorization = `Bearer ${auth.accessToken}`;

// Response: refresh once on 401
if (error.response?.status === 401 && !request._retried) {
  request._retried = true;
  try {
    const { accessToken } = await axios.post("/auth/refresh", { refresh_token: auth.refreshToken });
    auth.setAccessToken(accessToken);
    request.headers.Authorization = `Bearer ${accessToken}`;
    return axios(request);
  } catch {
    auth.logout();
    window.location.href = "/login";
  }
}
```

### Permission hook
```ts
export const usePermission = (feature: string, action: string) => {
  const { permissions, isSystemRole } = useAuth();
  if (isSystemRole) return true;
  return permissions
    .find(p => p.featureName === feature)
    ?.[`can${action[0].toUpperCase() + action.slice(1)}`] === true;
};

// usage
const canCreateStudy = usePermission("ClinicalPrograms.Studies", "create");
```

### Multipart helper
```ts
const buildForm = (fields: Record<string, any>, files?: Record<string, File>) => {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    form.append(k, Array.isArray(v) || typeof v === "object" ? JSON.stringify(v) : String(v));
  });
  Object.entries(files ?? {}).forEach(([k, f]) => form.append(k, f));
  return form;
};
```

---

## 12. Smoke test checklist

1. `POST /auth/register` → email arrives.
2. `POST /auth/activate` with the token → account active.
3. `POST /auth/login/password` → save `accessToken`, `refreshToken`, `user.roleId`.
4. `GET /profile/me/permissions` → verify returned feature names match what your UI gates on.
5. `GET /dashboard` → cards render.
6. `GET /workspace/sponsors` → sponsor list populates the workspace picker.
7. Masters: `GET /masters/countries`, add a country, import CSV → verify round-trip.
8. Sponsors: `POST /sponsors` (multipart, with photo) → CSV export confirms the new row.
9. Studies: Complete steps 1→5, then `POST /studies/:id/publish` to `UAT`. Verify version + `database_name` in the response.
10. `POST /studies/:id/invitations` to a test email → invitation arrives.
11. `GET /activity-logs` → all actions above show up with the correct `module` / `action_type`.

Any persistent `401`: your token scope is wrong (sponsor token used here, or token expired). Any persistent `403`: the user's role lacks the feature permission listed in §8.2.

---

## 13. Cross-reference to Sponsor Workspace

- Once a study is published to an environment (`§7.8`), the corresponding `cro_sponsors.sponsor_id` can be invited to that study via `POST /api/v1/sponsor/auth/invite` (documented in the Sponsor Workspace guide). The sponsor user then signs in via `/api/v1/sponsor/auth/*` and calls `/api/v1/sponsor/studies/*`.
- The sponsor menu is driven entirely by the `scopes` you selected in **Step 1 of the study wizard** (`EDC` / `Survey` / `ePRO`). Picking the right scopes is critical — it directly changes the sponsor's navigation.

---




# Sponsor Workspace — Frontend Integration Guide

> **For the frontend engineer / for Claude:** This file is a complete, copy-paste-ready contract for integrating the Sponsor Workspace APIs. Each endpoint lists the HTTP method, URL, required headers, request payload, success response, and every possible error response. Do **not** invent fields that aren't listed here — the backend will reject them silently or explicitly.

---

## 0. Global conventions

### Base URL
```
{API_BASE_URL}/api/v1
```
Use `VITE_API_BASE_URL` (or your env equivalent) — do not hardcode `localhost:4000`.

### Content type
All request bodies: `application/json`. Always set `Content-Type: application/json`.

### Auth header (after login)
```
Authorization: Bearer <accessToken>
```
There are **two JWT scopes**:
- `cro` — issued by `/api/v1/auth/*` (CRO users). Required to invite sponsors.
- `sponsor` — issued by `/api/v1/sponsor/auth/*`. Required for all `/api/v1/sponsor/**` endpoints.

Do **not** mix them. A CRO token will get `401 "Sponsor authentication required."` on sponsor routes.

### Token lifetimes
- Access token: **15 minutes** (configurable). Refresh before expiry using `/refresh`.
- Refresh token: **7 days**.
- OTP: **10 minutes**.
- Activation link (sponsor invitation): **7 days**.

### Response envelope
Every successful response returns:
```json
{ "success": true, ...fields }
```
Every error response returns:
```json
{ "success": false, "message": "Human-readable message", "code": "OPTIONAL_ERROR_CODE" }
```
`code` is present for validation/domain errors; omit handling when absent.

### Common HTTP status codes
| Status | Meaning |
| --- | --- |
| 200 | Success (GET / PATCH / POST that doesn't create a new resource) |
| 201 | Resource created |
| 400 | Validation error (bad / missing payload field) |
| 401 | Not authenticated, bad token, expired token, wrong scope |
| 403 | Authenticated but not authorized for that sponsor / study / environment |
| 404 | Resource not found |
| 409 | Conflict (duplicate, state mismatch, study not yet published, etc.) |
| 422 | Business-rule failure |
| 500 | Server error — show a generic retry message |

### Study context
Every feature endpoint (`/api/v1/sponsor/workspace/**`) requires the currently selected study:
- `study_id` — the sponsor study ID the user chose.
- `environment` — exactly `"UAT"` or `"LIVE"`.

Send them as **query params** for `GET` / `DELETE`, and as **body fields** for `POST` / `PATCH`. The backend reads both locations.

### Menu gating (IMPORTANT)
Sponsor menus are driven by **study scope flags**, not role permissions:
- `scope.edc` → show EDC menu (Data Capture)
- `scope.epro` → show ePRO menu (My Diary)
- `scope.survey` → show Survey menu (Take Survey)

These flags come back in `POST /sponsor/studies/choose` (authoritative) and `GET /sponsor/studies` (for the picker). Store them in your study context and conditionally render menu items. Do not call a permission endpoint — there isn't one.

---

## 1. CRO → Sponsor invitation

### 1.1 Invite a sponsor user
Invites a sponsor user by email. Sends activation email. Optionally assigns to a specific study + environment.

- **Method / URL:** `POST /api/v1/sponsor/auth/invite`
- **Auth:** CRO access token (`Authorization: Bearer <cro-token>`)
- **Required payload:**
  ```json
  {
    "sponsor_id": "spn_abc123",
    "email_address": "pi@sponsor.com"
  }
  ```
- **Optional payload:**
  ```json
  {
    "full_name": "Jane Doe",
    "contact_number": "+1-555-123-4567",
    "job_title": "Study Manager",
    "role_id": null,
    "study_id": "std_xyz789",
    "environment": "UAT",
    "study_title": "COVID-19 Phase III",
    "protocol_number": "COV-III-001",
    "is_primary_contact": false
  }
  ```
- **Notes:**
  - `role_id` is optional and cosmetic — sponsor menu access is NOT role-gated anymore.
  - `environment` must be `"UAT"` or `"LIVE"` if provided.
  - If `study_id` + `environment` are both provided, the user is auto-assigned to that study on create.
- **Success (201):**
  ```json
  {
    "success": true,
    "userId": "spu_abc123",
    "invitationId": "sinv_def456",
    "emailSent": true,
    "emailWarning": null
  }
  ```
  - If `emailSent` is `false`, `emailWarning` contains the reason (e.g., Resend domain unverified). Still treat the invite as successful — the user exists and can be re-sent.
- **Errors:**
  | Status | `message` | When |
  | --- | --- | --- |
  | 400 | `"sponsor_id is required."` | missing `sponsor_id` |
  | 400 | `"Valid email address is required."` | bad / missing email |
  | 400 | `"environment must be 'UAT' or 'LIVE'."` | bad environment |
  | 401 | `"Authentication required."` | no CRO token |
  | 403 | `"You do not have permission to perform this action."` | CRO user lacks `sponsors:create` |
  | 404 | `"Sponsor not found."` | `sponsor_id` invalid |
  | 409 | `"A sponsor user with this email already exists."` | duplicate email for that sponsor |

---

## 2. Sponsor authentication

### 2.1 Activate account (set password)
Called from the activation link sent in the invitation email (`?token=<plain-token>`).

- **Method / URL:** `POST /api/v1/sponsor/auth/activate`
- **Auth:** none
- **Payload:**
  ```json
  {
    "token": "<activation-token-from-email-link>",
    "password": "NewSecret1!",
    "confirm_password": "NewSecret1!"
  }
  ```
- **Success (200):**
  ```json
  {
    "success": true,
    "message": "Your sponsor account has been activated.",
    "sponsorUserId": "spu_abc123"
  }
  ```
- **Errors:**
  | Status | `message` |
  | --- | --- |
  | 400 | `"Activation token is required."` |
  | 400 | `"Password is required."` |
  | 400 | `"New password and confirmation do not match."` |
  | 400 | `"Password must be at least 8 characters and include uppercase, lowercase, number, and special character."` |
  | 410 | `"Activation link has expired."` |
  | 404 | `"Invalid activation token."` |
  | 409 | `"Account is already activated."` |

### 2.2 Sign in with password
- **Method / URL:** `POST /api/v1/sponsor/auth/login/password`
- **Auth:** none
- **Payload:**
  ```json
  { "email_address": "pi@sponsor.com", "password": "Secret1!" }
  ```
- **Success (200):**
  ```json
  {
    "success": true,
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "expiresIn": 900,
    "user": {
      "sponsorUserId": "spu_abc123",
      "sponsorId": "spn_abc123",
      "email": "pi@sponsor.com",
      "fullName": "Jane Doe",
      "roleId": null,
      "roleName": null,
      "sponsorName": "Acme Pharma"
    }
  }
  ```
- **Errors:**
  | Status | `message` |
  | --- | --- |
  | 400 | `"Valid email address is required."` / `"Password is required."` |
  | 401 | `"Invalid email or password."` |
  | 403 | `"Account is not active. Please complete activation."` |
  | 423 | `"Account locked. Try again in N minutes."` (after 5 failed attempts) |

### 2.3 Sign in with OTP — request code
- **Method / URL:** `POST /api/v1/sponsor/auth/login/otp/request`
- **Auth:** none
- **Payload:**
  ```json
  { "email_address": "pi@sponsor.com" }
  ```
- **Success (200):**
  ```json
  {
    "success": true,
    "message": "OTP sent to your email.",
    "expiresInMinutes": 10
  }
  ```
- **Errors:** same 400/401/403/423 as 2.2. For security, a non-existent email returns `200` with a generic message — do not distinguish.

### 2.4 Sign in with OTP — verify
- **Method / URL:** `POST /api/v1/sponsor/auth/login/otp/verify`
- **Auth:** none
- **Payload:**
  ```json
  { "email_address": "pi@sponsor.com", "otp": "123456" }
  ```
- **Success (200):** identical shape to `2.2` (returns `accessToken`, `refreshToken`, `user`).
- **Errors:**
  | Status | `message` |
  | --- | --- |
  | 400 | `"OTP must be 6 digits."` |
  | 401 | `"Invalid or expired OTP."` |
  | 401 | `"OTP has already been used."` |
  | 429 | `"Too many failed attempts. Request a new OTP."` |

### 2.5 Refresh access token
- **Method / URL:** `POST /api/v1/sponsor/auth/refresh`
- **Auth:** none (refresh token in body)
- **Payload:**
  ```json
  { "refresh_token": "<refresh-jwt>" }
  ```
- **Success (200):**
  ```json
  { "success": true, "accessToken": "<jwt>", "expiresIn": 900 }
  ```
- **Errors:** `401 "Invalid or expired refresh token."`

### 2.6 Logout
- **Method / URL:** `POST /api/v1/sponsor/auth/logout`
- **Auth:** sponsor access token
- **Payload:** none
- **Success (200):** `{ "success": true, "message": "Logged out." }`
- **Errors:** `401` if token missing/invalid.

---

## 3. Study selection (post-login)

All endpoints below require `Authorization: Bearer <sponsor-token>`.

### 3.1 List studies assigned to the logged-in user
- **Method / URL:** `GET /api/v1/sponsor/studies`
- **Success (200):**
  ```json
  {
    "success": true,
    "studies": [
      {
        "assignmentId": "sa_abc",
        "studyId": "std_xyz",
        "protocolNumber": "COV-III-001",
        "studyTitle": "COVID-19 Phase III",
        "therapeuticArea": "Infectious Disease",
        "environment": "UAT",
        "studyStatus": "Active",
        "scope": { "edc": true, "survey": false, "epro": true },
        "versionNumber": 3,
        "publishedAt": "2026-03-12T08:00:00Z",
        "roleId": null,
        "roleName": null,
        "sponsorId": "spn_abc",
        "sponsorName": "Acme Pharma",
        "accessStartsAt": "2026-02-01T00:00:00Z",
        "accessEndsAt": null
      }
    ]
  }
  ```
- Render each `study × environment` pair as a card. A single study can appear twice (UAT + LIVE).

### 3.2 Choose a study (build workspace context)
Call this when the user clicks a study card. The response holds everything you need to render the workspace shell (menu + study header).

- **Method / URL:** `POST /api/v1/sponsor/studies/choose`
- **Payload:**
  ```json
  { "study_id": "std_xyz", "environment": "UAT" }
  ```
- **Success (200):**
  ```json
  {
    "success": true,
    "sponsorId": "spn_abc",
    "sponsorName": "Acme Pharma",
    "studyId": "std_xyz",
    "protocolNumber": "COV-III-001",
    "studyTitle": "COVID-19 Phase III",
    "environment": "UAT",
    "scope": { "edc": true, "survey": false, "epro": true },
    "versionNumber": 3,
    "publishedAt": "2026-03-12T08:00:00Z",
    "tenantDatabaseName": "db_study_std_xyz_uat",
    "studyContextToken": "<opaque-base64url>"
  }
  ```
- **Store in context:** `studyId`, `environment`, `scope`, `studyContextToken`. Attach `studyContextToken` to request headers if you want audit trail correlation (optional; backend doesn't require it yet).
- **Menu rendering:** switch on `scope`:
  - `scope.edc === true` → show `Dashboard`, **`Data Capture`**, `Consent Management`, `Quality Management`, `Site Management`, `Masters`, `Activity Log`, `Profile Settings`
  - `scope.epro === true` → show `Dashboard`, **`My Diary`**, rest same
  - `scope.survey === true` → show `Dashboard`, **`Take Survey`**, rest same
  - Multiple scopes true → merge (show all matching scope-specific items).
- **Errors:**
  | Status | `message` |
  | --- | --- |
  | 400 | `"study_id is required."` / `"environment must be 'UAT' or 'LIVE'."` |
  | 403 | `"You do not have access to this study environment."` |
  | 403 | `"Study does not belong to your sponsor organization."` |
  | 409 | `"Study workspace has not been published yet. Please contact your CRO administrator."` |

### 3.3 Study dashboard metrics
- **Method / URL:** `GET /api/v1/sponsor/studies/dashboard?study_id=<id>&environment=UAT`
- **Success (200):**
  ```json
  {
    "success": true,
    "provisioned": true,
    "metrics": {
      "sites":    { "active_sites": 4, "inactive_sites": 1, "enrollment_target": 200, "enrolled_subjects": 73, "sites_without_activity": 1 },
      "subjects": { "total": 73, "enrolled": 60 },
      "queries":  { "open_queries": 12, "closed_queries": 45, "overdue_queries": 2, "critical_queries": 1 },
      "dataVerification": { "pending": 8, "verified": 22, "rejected": 1, "locked": 3 },
      "monitoring": { "scheduled": 5, "completed": 9, "reports_pending": 2 },
      "adverseEvents": { "total": 4, "serious": 1 },
      "protocolDeviations": { "total": 3 }
    }
  }
  ```
- If the study DB hasn't been provisioned, `provisioned: false` and `metrics: {}`. Show an empty-state message, not an error.
- **Errors:** `400` (missing params), `401`, `403` (same as above).

---

## 4. Sponsor workspace — feature endpoints

All endpoints under `/api/v1/sponsor/workspace` require:
- `Authorization: Bearer <sponsor-token>`
- `study_id` + `environment` in query string (GET/DELETE) or body (POST/PATCH).

### 4.1 Sites (`/sites`)

#### List sites
- `GET /sponsor/workspace/sites?study_id=...&environment=UAT`
- **Success (200):** `{ "success": true, "sites": [ { "siteId": "...", "siteNumber": "S001", "siteName": "...", "countryId": "...", "locationId": "...", "principalInvestigator": "...", "status": "Active", "enrollmentTarget": 50, "enrolledSubjects": 12, "lastActivityAt": "...", "createdAt": "..." } ] }`

#### Create site
- `POST /sponsor/workspace/sites`
- **Payload:**
  ```json
  {
    "study_id": "std_xyz",
    "environment": "UAT",
    "site_number": "S001",
    "site_name": "Mercy Hospital - Site 1",
    "country_id": "cntry_us",
    "location_id": "loc_ny",
    "principal_investigator": "Dr. Smith",
    "status": "Pending",
    "enrollment_target": 50
  }
  ```
- **Success (201):** `{ "success": true, "siteId": "site_...", "message": "Site created." }`
- **Errors:** `400` (missing required fields), `409 "Site number already exists."`

#### Update site
- `PATCH /sponsor/workspace/sites/:siteId`
- **Payload:** same fields as create (all optional; omit what you don't change). Must include `study_id` + `environment`.
- **Success (200):** `{ "success": true, "message": "Site updated." }`

#### Activate site
- `POST /sponsor/workspace/sites/:siteId/activate`
- **Payload:** `{ "study_id": "...", "environment": "UAT" }`
- **Success (200):** `{ "success": true, "message": "Site activated." }`
- Side-effect: sends `SPONSOR_SITE_ACTIVATED` email to sponsor users.

#### Delete site
- `DELETE /sponsor/workspace/sites/:siteId?study_id=...&environment=UAT`
- **Success (200):** `{ "success": true, "message": "Site deleted." }`
- **Errors:** `409 "Cannot delete site with enrolled subjects."`

### 4.2 Site Roles (`/site-roles`)

| Action | Method / Path |
| --- | --- |
| List | `GET /sponsor/workspace/site-roles?study_id=...&environment=...` |
| Create | `POST /sponsor/workspace/site-roles` |
| Update | `PATCH /sponsor/workspace/site-roles/:roleId` |
| Delete | `DELETE /sponsor/workspace/site-roles/:roleId?study_id=...&environment=...` |

Create/Update payload:
```json
{
  "study_id": "std_xyz",
  "environment": "UAT",
  "role_name": "Site Coordinator",
  "description": "Manages day-to-day site operations",
  "permissions": { "view_subjects": true, "edit_forms": true, "raise_queries": true },
  "is_system_role": false,
  "status": "Active"
}
```
- Can't delete `is_system_role: true` roles → `409 "System roles cannot be deleted."`

### 4.3 Site Personnel (`/site-personnel`)

| Action | Method / Path |
| --- | --- |
| List | `GET /sponsor/workspace/site-personnel?study_id=...&environment=...&site_id=...` (site_id optional) |
| Invite | `POST /sponsor/workspace/site-personnel/invite` |
| Update | `PATCH /sponsor/workspace/site-personnel/:personnelId` |
| Remove | `DELETE /sponsor/workspace/site-personnel/:personnelId?study_id=...&environment=...` |

Invite payload:
```json
{
  "study_id": "std_xyz",
  "environment": "UAT",
  "site_id": "site_abc",
  "full_name": "Dr. Alice",
  "email_address": "alice@site.com",
  "contact_number": "+1-555-000",
  "role_id": "srole_coord",
  "role_name": "Site Coordinator",
  "site_name": "Mercy Hospital",
  "study_title": "COVID-19 Phase III"
}
```
- **Success (201):** `{ "success": true, "personnelId": "sp_...", "emailSent": true }`
- Sends `SPONSOR_SITE_PERSONNEL_INVITE` email.

### 4.4 Consent Management (`/consent/templates`)

| Action | Method / Path |
| --- | --- |
| List | `GET /sponsor/workspace/consent/templates?study_id=...&environment=...&status=Draft` (status optional: `Draft`, `Review`, `Approved`, `Published`, `Rejected`) |
| Get one | `GET /sponsor/workspace/consent/templates/:templateId?study_id=...&environment=...` |
| Create | `POST /sponsor/workspace/consent/templates` |
| Update | `PATCH /sponsor/workspace/consent/templates/:templateId` |
| Submit for review | `POST /sponsor/workspace/consent/templates/:templateId/submit` |
| Review (approve/reject) | `POST /sponsor/workspace/consent/templates/:templateId/review` |
| Publish | `POST /sponsor/workspace/consent/templates/:templateId/publish` |

Create/Update payload:
```json
{
  "study_id": "std_xyz",
  "environment": "UAT",
  "template_name": "Main ICF",
  "version": "v1.0",
  "language": "en",
  "content": "<rich HTML or structured JSON string>",
  "status": "Draft"
}
```

Review payload:
```json
{
  "study_id": "std_xyz",
  "environment": "UAT",
  "decision": "Approved",
  "comments": "Looks good."
}
```
`decision` is `"Approved"` or `"Rejected"`. Rejected → returns to `Draft` status and emails the author (`SPONSOR_CONSENT_REJECTED`).

State machine:
```
Draft → (submit) → Review → (review:Approved) → Approved → (publish) → Published
                          ↘ (review:Rejected) → Draft
```
**Errors:** `409 "Template is not in a state that can be <action>."` if the transition is invalid.

### 4.5 Queries (`/queries`)

| Action | Method / Path |
| --- | --- |
| List | `GET /sponsor/workspace/queries?study_id=...&environment=...&status=Open&site_id=...&severity=Critical&overdue=true` |
| Get one | `GET /sponsor/workspace/queries/:queryId?study_id=...&environment=...` |
| Raise | `POST /sponsor/workspace/queries` |
| Answer | `POST /sponsor/workspace/queries/:queryId/answer` |
| Close | `POST /sponsor/workspace/queries/:queryId/close` |

Raise payload:
```json
{
  "study_id": "std_xyz",
  "environment": "UAT",
  "site_id": "site_abc",
  "subject_id": "subj_001",
  "form_id": "form_demographics",
  "field_name": "date_of_birth",
  "query_text": "DOB appears inconsistent with consent date.",
  "severity": "Major",
  "assigned_to": "sp_personnel_id",
  "due_at": "2026-05-01T00:00:00Z"
}
```
`severity` is one of: `"Minor"`, `"Major"`, `"Critical"`.

Answer payload: `{ "study_id": "...", "environment": "UAT", "answer": "DOB corrected to 1968-04-12." }`
Close payload:  `{ "study_id": "...", "environment": "UAT", "comments": "Resolved." }`

### 4.6 Data Verification (`/data-verifications`)

| Action | Method / Path |
| --- | --- |
| List | `GET /sponsor/workspace/data-verifications?study_id=...&environment=...&status=Pending&site_id=...&verification_type=SDV` |
| Create | `POST /sponsor/workspace/data-verifications` |
| Review | `POST /sponsor/workspace/data-verifications/:verificationId/review` |

Create payload:
```json
{
  "study_id": "std_xyz",
  "environment": "UAT",
  "site_id": "site_abc",
  "subject_id": "subj_001",
  "form_id": "form_vs",
  "field_name": "systolic_bp",
  "verification_type": "SDV"
}
```
`verification_type`: `"SDV"`, `"MedicalReview"`, `"DataReview"`.

Review payload: `{ "study_id": "...", "environment": "...", "decision": "Verified" | "Rejected" | "Locked", "comments": "..." }`

### 4.7 Masters (`/masters/...`)

Scope-limited view of sponsor-editable master data for the selected study.

#### Email templates
- `GET /sponsor/workspace/masters/email-templates?study_id=...&environment=...`
- `POST /sponsor/workspace/masters/email-templates` — upsert. Payload:
  ```json
  {
    "study_id": "std_xyz",
    "environment": "UAT",
    "template_id": "optional-existing-id",
    "template_code": "CUSTOM_WELCOME",
    "template_name": "Custom Welcome",
    "subject": "Welcome to {{study_title}}",
    "body": "Hello {{full_name}}, ...",
    "placeholders": ["full_name", "study_title"],
    "is_system": false,
    "status": "Active"
  }
  ```
- Success: `{ "success": true, "templateId": "et_...", "created": true }` (`created: false` on update).

#### Countries
- `GET /sponsor/workspace/masters/countries?study_id=...&environment=...`
- `POST /sponsor/workspace/masters/countries` — payload: `{ "study_id": "...", "environment": "...", "country_name": "India", "iso_code": "IN", "status": "Active" }`

#### Locations
- `GET /sponsor/workspace/masters/locations?study_id=...&environment=...&country_id=...` (country_id optional)
- `POST /sponsor/workspace/masters/locations` — payload:
  ```json
  {
    "study_id": "std_xyz",
    "environment": "UAT",
    "country_id": "cntry_us",
    "state": "NY",
    "district": "Kings",
    "city": "Brooklyn",
    "postal_code": "11201",
    "status": "Active"
  }
  ```

### 4.8 Activity Log (`/activity-logs`)

- `GET /sponsor/workspace/activity-logs?study_id=...&environment=...&limit=100&offset=0` → scope = `"study"`, returns per-study events.
- `GET /sponsor/workspace/activity-logs?limit=100&offset=0&action=LOGIN_SUCCESS` (no study_id) → scope = `"sponsor"`, returns master-DB sponsor-wide events.
- **Success (200):**
  ```json
  {
    "success": true,
    "scope": "study",
    "activity": [
      { "activity_id": "...", "created_at": "...", "actor_id": "...", "actor_type": "sponsor_user", "action": "SITE_ACTIVATED", "resource_type": "site", "resource_id": "...", "metadata": {}, "ip_address": "..." }
    ]
  }
  ```

---

## 5. Error handling patterns for the frontend

1. **Always** check `response.success === true` before reading payload fields.
2. On `401`:
   - If you have a refresh token, call `/sponsor/auth/refresh` once. If that also `401`s, clear tokens and redirect to login.
   - Don't loop — one refresh attempt per request.
3. On `403`:
   - For `/choose` or feature endpoints: clear study context and send user back to "Choose Study" screen.
   - For other endpoints: show a toast with `message` and keep the user where they are.
4. On `409`:
   - Show `message` to the user — these are domain errors (duplicate, state mismatch). No retry.
5. On `423` (account locked):
   - Parse the minutes out of the message and show a countdown.
6. On `5xx`:
   - Retry once with 1-second backoff. If still failing, show generic "Something went wrong — please try again."

---

## 6. Suggested frontend module layout

```
src/api/
  axios.ts                 // base instance + interceptors (Authorization, refresh on 401)
  sponsor/
    auth.ts                // activate, login (password/otp), refresh, logout
    studies.ts             // listStudies, chooseStudy, dashboard
    sites.ts
    siteRoles.ts
    sitePersonnel.ts
    consent.ts
    queries.ts
    dataVerification.ts
    masters.ts             // emailTemplates, countries, locations
    activity.ts

src/context/
  SponsorAuthContext.tsx   // holds accessToken, refreshToken, user
  StudyContext.tsx         // holds studyId, environment, scope (from chooseStudy)

src/routes/
  SponsorLayout.tsx        // renders the menu based on StudyContext.scope
```

### Axios interceptor essentials
```ts
// Request: attach token
config.headers.Authorization = `Bearer ${auth.accessToken}`;

// Response: 401 → try refresh once, then retry original request
if (error.response?.status === 401 && !request._retried) {
  request._retried = true;
  const { accessToken } = await refresh(auth.refreshToken);
  auth.setAccessToken(accessToken);
  request.headers.Authorization = `Bearer ${accessToken}`;
  return axios(request);
}
```

### Study-scoped menu component
```ts
const menu = [
  { label: "Dashboard", path: "/dashboard", show: true },
  { label: "Data Capture", path: "/edc", show: scope.edc },
  { label: "My Diary", path: "/diary", show: scope.epro },
  { label: "Take Survey", path: "/survey", show: scope.survey },
  { label: "Consent Management", path: "/consent", show: true },
  { label: "Quality Management", path: "/quality", show: true },
  { label: "Site Management", path: "/sites", show: true },
  { label: "Masters", path: "/masters", show: true },
  { label: "Activity Log", path: "/activity", show: true },
  { label: "Profile Settings", path: "/profile", show: true }
].filter(item => item.show);
```

---

## 7. Test accounts / smoke test

1. CRO invites sponsor: `POST /sponsor/auth/invite` with your email.
2. Open activation link from email → `POST /sponsor/auth/activate` with `token` from URL param and a new password.
3. `POST /sponsor/auth/login/password` with the new password → save `accessToken` + `refreshToken`.
4. `GET /sponsor/studies` → confirm the list contains the study the CRO assigned.
5. `POST /sponsor/studies/choose` with that `study_id` + `environment` → store `scope`.
6. Hit one feature endpoint (e.g. `GET /sponsor/workspace/sites?study_id=...&environment=...`) to validate the token + study context.

If any step returns `401 "Sponsor authentication required."` — your token scope is wrong (CRO token on sponsor route, or vice versa).
If any step returns `409 "Study workspace has not been published yet."` — ask the CRO to publish the study to that environment first (from the CRO workspace).

---

## 8. What is *not* on the backend

Do **not** call these — they don't exist and will 404:

- Any `/sponsor/permissions` or `/sponsor/roles` endpoint for menu gating. Menus are driven by `scope` from `/sponsor/studies/choose`.
- `GET /sponsor/me` — the user info you need is in the login response and in the JWT.
- Any endpoint that mutates study scope. Scope is set by the CRO at study creation.

---


