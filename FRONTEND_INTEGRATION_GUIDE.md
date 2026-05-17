

> **How to use this file.** Hand it to Claude (or any agent) together with the
> frontend project and say: *"Integrate the SclinNexus backend using this spec.
> Use the exact method, path, payload and response shapes below. Do not invent
> fields."* Every endpoint in the backend is documented here with:
> `Method`, `Path`, `Auth`, `Payload`, `Success response`, and `Error responses`.

---

## 0. Global conventions

### 0.1 Base URL

```
Local       : http://localhost:8080
Production  : <to be filled by the client>
```

All API paths are prefixed with **`/api/v1`**.

### 0.2 Authentication

The backend uses **JWT access tokens + refresh tokens**. There are two
separate identity scopes:

| Scope        | Used for                                  | Issued by                         |
|--------------|-------------------------------------------|-----------------------------------|
| **CRO**      | `/api/v1/**` (everything except `sponsor/*`) | `/api/v1/auth/*` endpoints        |
| **sponsor**  | `/api/v1/sponsor/**`                      | `/api/v1/sponsor/auth/*` endpoints |

Send the access token on every protected request:

```
Authorization: Bearer <accessToken>
```

**Tokens cannot be swapped between scopes.** A CRO token is rejected by the
sponsor routes and vice versa.

### 0.3 Standard response envelopes

**Success** (every 2xx response):

```json
{ "success": true, ...data }
```

`data` differs per endpoint. Single-item endpoints use `item`, list endpoints
use `items` + pagination fields, custom endpoints use top-level keys.

**Error** (every 4xx / 5xx response):

```json
{
  "success": false,
  "message": "Human-readable message the UI can show as-is.",
  "details": { ...optional context } | null
}
```

### 0.4 Standard HTTP status codes

| Code | Meaning                                                     |
|------|-------------------------------------------------------------|
| 200  | OK                                                          |
| 201  | Created                                                     |
| 400  | Validation error (missing/invalid field)                    |
| 401  | Missing / invalid / expired token, or wrong credentials     |
| 403  | Authenticated but not authorized (RBAC denied, not activated) |
| 404  | Resource not found (or route not registered)                |
| 409  | Conflict — typically unique constraint violation            |
| 423  | Account locked (too many failed password attempts)          |
| 500  | Unhandled server error                                      |

A **409** response always includes `details.constraint` with the Postgres
constraint name so the frontend can map to a specific field if needed.

### 0.5 File uploads

Routes that accept file uploads use **`multipart/form-data`** with a single
file field named exactly `photograph` (sponsors, team members, profile) or
`files` (email template attachments). All other fields are sent as regular
multipart form fields with **snake_case** keys.

### 0.6 Field naming

**All request bodies use snake_case keys** (e.g. `full_name`, `email_address`,
`protocol_number`). The backend normalises these internally. Responses return
whatever column shape the DB layer produces — predominantly snake_case, with
the exception of `user` objects returned at login which use camelCase
(`fullName`, `emailAddress`, `roleId`, `roleName`, `teamMemberId`,
`isSystemRole`).

### 0.7 Identifiers

All resource IDs are short random strings (nanoid, `VARCHAR(32)`). Do not
assume integers.

### 0.8 Pagination / filtering (list endpoints)

Most list endpoints accept:

```
?page=1&pageSize=20&search=<free text>&status=Active|Inactive
```

Response envelope:

```json
{
  "success": true,
  "items": [ ... ],
  "page": 1,
  "pageSize": 20,
  "total": 137
}
```

---

# PART A — CRO Workspace APIs

All routes under this part require a **CRO scope** access token unless
labelled *Public*.

## 1. Auth — `/api/v1/auth`

### 1.1 Register

- **Method / Path:** `POST /api/v1/auth/register`
- **Auth:** Public
- **Purpose:** Creates a pending CRO user and emails an activation link.

**Request body** (JSON):

```json
{
  "full_name": "Jane Doe",              // required, string
  "email_address": "jane@cro.com",      // required, valid email
  "contact_number": "+91 90000 00000",  // optional, string
  "job_title": "Clinical Lead",         // optional, string
  "organization_code": "NEX-001",       // optional, string, unique
  "organization_name": "Nexus CRO"      // optional, string (defaults to "Pending CRO Organization")
}
```

**201 Success**

```json
{
  "success": true,
  "message": "Registration successful! Please check your email to activate your account and set your password."
}
```

**Errors**

| Status | When                                                          | `message`                                                                                       |
|--------|----------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| 400    | `full_name` / `email_address` missing or invalid               | `"Full Name is required."` or `"A valid email address is required."`                            |
| 409    | Email already registered                                       | `"The email address is already registered. Please use a different email or sign in."`           |
| 409    | Unique constraint (e.g. `organization_code`)                   | Dictionary message, details `{ constraint: "cro_users_organization_code_key" }`                 |
| 500    | Resend email provider failed                                   | `"Unable to send registration email. Please try again later."`                                  |

---

### 1.2 Activate account

- **Method / Path:** `POST /api/v1/auth/activate`
- **Auth:** Public

**Request body**

```json
{
  "token": "...from activation link...",    // required
  "password": "Str0ng!Pass",                // required, must pass strength rules
  "confirm_password": "Str0ng!Pass"         // required, must equal password
}
```

**200 Success**

```json
{ "success": true, "message": "Account activated successfully. You can now sign in." }
```

**Errors**

| Status | Scenario                                       | Message                                                              |
|--------|------------------------------------------------|----------------------------------------------------------------------|
| 400    | Passwords do not match                         | `"New password and confirmation do not match."`                      |
| 400    | Token invalid / expired                        | `"The activation link has expired. Please request a new registration."` |
| 400    | Password fails strength check                  | (specific rule text from `ensurePasswordStrength`)                   |

---

### 1.3 Login (password)

- **Method / Path:** `POST /api/v1/auth/login/password`
- **Auth:** Public

**Request body**

```json
{ "email_address": "jane@cro.com", "password": "Str0ng!Pass" }
```

**200 Success**

```json
{
  "success": true,
  "message": "Login successful.",
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "user": {
    "id": "u_abc123",
    "fullName": "Jane Doe",
    "emailAddress": "jane@cro.com",
    "roleId": "r_admin",
    "roleName": "CRO Administrator",
    "teamMemberId": "tm_xyz" | null,
    "isSystemRole": true
  },
  "permissions": [
    {
      "featureName": "ClinicalPrograms.Studies",
      "canView": true, "canCreate": true, "canEdit": true,
      "canDelete": false, "canExport": true, "canImport": false,
      "canDuplicate": false, "canLock": false, "canConfigure": true,
      "canPublish": true
    }
    // ...one object per feature
  ]
}
```

**Errors**

| Status | Scenario                                  | Message                                                               |
|--------|-------------------------------------------|-----------------------------------------------------------------------|
| 401    | Unknown email / wrong password            | `"Invalid email address or password."`                                |
| 403    | Account is `pending` (not activated)      | `"Your account is not yet activated. Please check your email..."`     |
| 423    | Locked after 5 failures                   | `"Your account is temporarily locked. Please try again later."`       |

---

### 1.4 Login (OTP — request)

- **Method / Path:** `POST /api/v1/auth/login/otp/request`
- **Auth:** Public
- **Body:** `{ "email_address": "jane@cro.com" }`
- **200 Success:** `{ "success": true, "message": "An OTP has been sent to your registered email address." }`
- **Errors:** `404` no such user, `403` not activated.

### 1.5 Login (OTP — verify)

- **Method / Path:** `POST /api/v1/auth/login/otp/verify`
- **Auth:** Public
- **Body:** `{ "email_address": "jane@cro.com", "otp": "123456" }` (OTP must be 6 digits)
- **200 Success:** Same shape as 1.3 (tokens + user + permissions)
- **Errors:** `400` OTP not 6 digits, `401` `"The OTP entered is invalid or has expired."`

### 1.6 Refresh

- **Method / Path:** `POST /api/v1/auth/refresh`
- **Auth:** Public
- **Body:** `{ "refresh_token": "<jwt>" }`
- **200 Success:** `{ success, accessToken, refreshToken, user, permissions }` (no `message`)
- **Errors:** `401` `"Invalid refresh token."`

### 1.7 Logout

- **Method / Path:** `POST /api/v1/auth/logout`
- **Auth:** CRO Bearer token
- **Body:** none
- **200 Success:** `{ "success": true, "message": "Logout successful." }`

---

## 2. Profile — `/api/v1/profile`

All protected by CRO auth.

### 2.1 Get current user

- `GET /api/v1/profile/me` → `{ success, item: { id, full_name, email_address, contact_number, job_title, organization_name, organization_code, photograph_url, ...} }`

### 2.2 Get current user permissions

- `GET /api/v1/profile/me/permissions` → `{ success, permissions: [ { featureName, canView, canCreate, ... } ], isSystemRole, roleId, roleName }`

### 2.3 Update profile (with optional photo)

- `PUT /api/v1/profile/me`
- **Content-Type:** `multipart/form-data`
- **Fields:** `full_name`, `contact_number`, `job_title`, `organization_name`, `organization_code`, `photograph` (file, optional — `image/jpeg` or `image/png`, ≤ 3 MB)
- **200:** `{ success, item: { ...updated profile } }`
- **Errors:** `400` validation; `409` `cro_users_organization_code_key` if code taken.

### 2.4 Change password

- `POST /api/v1/profile/change-password`
- **Body:** `{ "current_password": "...", "new_password": "...", "confirm_password": "..." }`
- **200:** `{ success, message: "Password changed successfully." }`
- **Errors:** `400` mismatch / weak; `401` wrong current password.

---

## 3. Workspace — `/api/v1/workspace`

### 3.1 List sponsors a user belongs to (workspace selection)

- `GET /api/v1/workspace/sponsors`
- Feature: `WorkspaceSelection.view`
- **200:** `{ success, items: [ { sponsor_id, full_name, organization_name, photograph_url, study_count, ... } ] }`

---

## 4. Dashboard — `/api/v1/dashboard`

### 4.1 Get dashboard

- `GET /api/v1/dashboard`
- Feature: `Dashboard.view`
- **200:** `{ success, metrics: { totalSponsors, totalStudies, activeStudies, pendingInvitations, ... }, charts: { ... }, recentActivity: [ ... ] }` (shape dictated by service).

### 4.2 Sync / refresh materialised stats

- `POST /api/v1/dashboard/sync`
- **200:** `{ success, message: "Dashboard refreshed." }`

---

## 5. Sponsors — `/api/v1/sponsors`

Feature gate: `ClinicalPrograms.Sponsors` (`view`, `create`, `edit`, `delete`, `export`).

### 5.1 List sponsors

- `GET /api/v1/sponsors?page=1&pageSize=20&search=...&status=Active`
- **200:** `{ success, items: [ { sponsor_id, full_name, email_address, contact_number, organization_name, website, registration_number, address_line1, address_line2, location_id, country_id, photograph_url, status, created_at, updated_at } ], page, pageSize, total }`

### 5.2 Export sponsors (CSV)

- `GET /api/v1/sponsors/export`
- **Response:** `text/csv` attachment (`sponsors.csv`). No JSON envelope.

### 5.3 Get sponsor

- `GET /api/v1/sponsors/:id` → `{ success, item: { ...sponsor } }`
- **404** if missing.

### 5.4 Create sponsor

- `POST /api/v1/sponsors`
- **Content-Type:** `multipart/form-data`

Fields:

| Field                  | Required | Notes                                                    |
|------------------------|----------|----------------------------------------------------------|
| `full_name`            | ✅        | Sponsor contact name                                     |
| `email_address`        | ✅        | Valid email; unique                                      |
| `contact_number`       | ❌        |                                                          |
| `organization_name`    | ✅        |                                                          |
| `website`              | ❌        |                                                          |
| `registration_number`  | ✅        | Unique                                                   |
| `address_line1`        | ❌        |                                                          |
| `address_line2`        | ❌        |                                                          |
| `location_id`          | ❌        | FK to `master_locations`                                 |
| `country_id`           | ❌        | FK to `master_countries`                                 |
| `status`               | ❌        | `Active` (default) / `Inactive`                          |
| `photograph`           | ❌        | JPG/PNG ≤ 3 MB                                           |

- **201:** `{ success, item: { sponsor_id, ...all fields... } }`
- **Errors:** `400` missing required; `409 constraint: cro_sponsors_email_address_key` or `cro_sponsors_registration_number_key`.

### 5.5 Update sponsor

- `PUT /api/v1/sponsors/:id` (same multipart shape; `email_address` becomes optional)
- **200:** `{ success, item: { ...updated } }`

### 5.6 Delete sponsor

- `DELETE /api/v1/sponsors/:id`
- **200:** `{ success, item: { sponsor_id, full_name } }`
- **404** if missing; **409** if constrained by existing studies.

---

## 6. Studies — `/api/v1/studies`

Feature gate: `ClinicalPrograms.Studies` (actions vary per step).

### 6.1 List studies

- `GET /api/v1/studies?page=...&pageSize=...&search=...&status=...&sponsor_id=...`
- **200:** `{ success, items: [ { study_id, protocol_number, study_title, study_phase_id, study_phase_name, sponsor_id, sponsor_name, status, current_step, scopes, created_at, updated_at } ], page, pageSize, total }`

### 6.2 Export studies

- `GET /api/v1/studies/export` → CSV attachment.

### 6.3 Get study

- `GET /api/v1/studies/:id` → `{ success, item: { ...full study incl. all step data, triggers, assignments, versions } }`

### 6.4 Create study — Step 1

- `POST /api/v1/studies/step-1`
- Feature: `ClinicalPrograms.Studies.create`

Body:

```json
{
  "protocol_number": "PROTO-001",              // required, unique
  "study_title": "Phase II oncology study",    // required
  "study_phase_id": "sp_phase2",               // required
  "sponsor_id": "sp_abc",                      // required
  "scopes": ["Consent","Query","Data"]         // required, ≥ 1 entry. Allowed values are any of Consent, Query, Data, Monitoring, Adverse, Deviation, DV (values stored as-is).
}
```

- **201:** `{ success, item: { study_id, protocol_number, study_title, current_step: 1, ... } }`
- **Errors:**
  - `400` missing field, or empty `scopes` → `"Please select at least one Scope of Study."`
  - `409 constraint: cro_studies_protocol_number_key` → `"A study with this protocol number already exists."`

> ⚠️ If the frontend is *editing* an existing study, call **`PUT /:id/step-1`**,
> not `POST /step-1`. Calling POST on an existing protocol number returns 409.

### 6.5 Update step 1..5

- `PUT /api/v1/studies/:id/step-1`    (Same body as 6.4. Feature: `edit`)
- `PUT /api/v1/studies/:id/step-2`    (Feature: `edit`)

  ```json
  {
    "start_date": "2026-05-01",              // required ISO date
    "expected_end_date": "2027-05-01",       // required ISO date
    "max_sites": 20,                          // optional, positive int
    "max_enrollments": 500,                   // required, positive int
    "coverage_type": "COUNTRY" | "REGION",   // required
    "coverage_id": "co_IN"                    // required — country_id or region_id
  }
  ```

- `PUT /api/v1/studies/:id/step-3`    (Feature: `configure`)

  ```json
  {
    "enable_consent_manager": true,
    "enable_query_manager": true,
    "enable_data_manager": true,
    "enable_navigation_bar": true
  }
  ```

- `PUT /api/v1/studies/:id/step-4`    (Feature: `configure`)

  ```json
  {
    "form_structure": { ... arbitrary JSON ... },   // required
    "version": 1,                                    // optional int
    "triggers": [
      {
        "trigger_condition": { ... JSON ... },
        "trigger_action": "Email" | "Notification" | "Both",
        "trigger_recipients": ["role:Admin", "email:ops@x.com"],
        "email_template_id": "tpl_123",              // optional
        "is_active": true
      }
    ]
  }
  ```

- `PUT /api/v1/studies/:id/step-5`    (Feature: `edit`)

  ```json
  {
    "assignments": [
      { "team_member_id": "tm_abc", "study_role": "CRC" }
    ]
  }
  ```

All return `{ success, item: { ...updated study... } }`.

### 6.6 Publish study

- `POST /api/v1/studies/:id/publish` (Feature: `publish`)

  ```json
  {
    "environment": "UAT" | "LIVE",         // required
    "status": "Published" | "Active" | "Inactive" | "Locked"   // optional, default "Published"
  }
  ```

- **201:** `{ success, item: { version_id, study_id, environment, database_name, status, published_at } }`
- **Errors:** `400` invalid env/status; `409` already published for this environment.

### 6.7 Send invitations

- `POST /api/v1/studies/:id/invitations` (Feature: `publish`)

  ```json
  {
    "version_id": "v_abc",                // required
    "environment": "UAT" | "LIVE",        // required
    "recipients": [
      {
        "email": "ops@sponsor.com",
        "recipient_type": "Sponsor" | "Site" | "Participant" | "CRO"
      }
    ]
  }
  ```

- **200:** `{ success, sent: <n>, invitations: [ { invitation_id, email, recipient_type, status } ] }`

---

## 7. Team members — `/api/v1/team-members`

Feature gate: `CROTeamAdministration.TeamMembers`.

### 7.1 List / Export / Get

- `GET /` list (paginated, filters: `search`, `status`, `role_id`)
- `GET /export` CSV
- `GET /:id` → `{ success, item: { team_member_id, full_name, email_address, contact_number, role_id, role_name, is_active, study_ids, photograph_url, ... } }`

### 7.2 Create team member

- `POST /` (multipart)

Fields:

| Field          | Required | Notes                                             |
|----------------|----------|---------------------------------------------------|
| `full_name`    | ✅        |                                                   |
| `email_address`| ✅        | Unique                                            |
| `role_id`      | ✅        | Role being assigned                               |
| `study_ids`    | ❌        | Array of study IDs (can be sent as repeated form field or JSON string) |
| `contact_number` / `job_title` / `organization_name` | ❌ | |
| `photograph`   | ❌        | JPG/PNG ≤ 3 MB                                    |

- **201:** `{ success, item: { ...team member, including role_name } }`
- **Errors:**
  - `400` missing field
  - `403` *"Cannot assign role with greater permissions than your own for feature 'X'."* — when a non-system creator tries to assign a stronger role.
  - `409 constraint: cro_team_members_email_address_key`

### 7.3 Update team member

- `PUT /:id` (same multipart fields; `email_address` optional on update)
- **200:** `{ success, item }`

### 7.4 Delete

- `DELETE /:id` → `{ success, item: { team_member_id, full_name } }`

---

## 8. Roles & permissions — `/api/v1/roles`

Feature gate: `CROTeamAdministration.RolesPermissions`.

### 8.1 List roles

- `GET /api/v1/roles?search=...` → `{ success, items: [ { role_id, role_name, description, is_system_role, created_at, assigned_count } ] }`

### 8.2 Get role (with permissions)

- `GET /api/v1/roles/:id` → `{ success, item: { role_id, role_name, description, is_system_role, permissions: [ { featureName, canView, canCreate, canEdit, canDelete, canExport, canImport, canDuplicate, canLock, canConfigure, canPublish } ] } }`

### 8.3 Create role

- `POST /api/v1/roles`

  ```json
  {
    "role_name": "Study Lead",
    "description": "Leads a clinical study",
    "permissions": [
      {
        "featureName": "ClinicalPrograms.Studies",
        "canView": true, "canCreate": true, "canEdit": true,
        "canDelete": false, "canExport": true, "canImport": false,
        "canDuplicate": false, "canLock": false,
        "canConfigure": false, "canPublish": true
      }
    ]
  }
  ```

- **201:** `{ success, item: { ...role with permissions } }`

### 8.4 Update / delete

- `PUT /api/v1/roles/:id` — same body as create.
- `DELETE /api/v1/roles/:id` — **403** if `is_system_role=true` or role is in use.

---

## 9. Activity log — `/api/v1/activity-logs`

Feature gate: `ActivityLog.view` / `.export`.

- `GET /api/v1/activity-logs?page=1&pageSize=50&module=...&user_id=...&from=...&to=...&status=SUCCESS|FAILURE`

  **200:** `{ success, items: [ { log_id, user_id, user_name, action_type, module, entity_type, entity_id, entity_name, action_description, ip_address, user_agent, status, failure_reason, created_at } ], page, pageSize, total }`

- `GET /api/v1/activity-logs/export` — CSV attachment.
- `GET /api/v1/activity-logs/:id` → `{ success, item: { ...log row } }`

---

## 10. Masters — `/api/v1/masters/*`

### 10.1 Email templates — `/api/v1/masters/email-templates`

Feature gate: `Masters.EmailTemplates`.

| Method | Path                              | Purpose                                              |
|--------|-----------------------------------|------------------------------------------------------|
| GET    | `/`                               | List (`?search=`, `?status=`, `?category=`)          |
| GET    | `/:id`                            | Fetch one                                            |
| POST   | `/`                               | Create                                               |
| PUT    | `/:id`                            | Update                                               |
| DELETE | `/:id`                            | Delete                                               |
| POST   | `/preview`                        | Render template with `{Placeholders}` for preview    |
| POST   | `/:id/duplicate`                  | Duplicate an existing template                       |
| POST   | `/:id/attachments`                | Upload attachments (multipart `files`, up to 5 MB per file, types: `application/pdf`, `image/png`, `image/jpeg`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`) |

Create / update body:

```json
{
  "template_code": "CRO_REGISTRATION_ACTIVATION",    // required, unique
  "template_name": "CRO activation",                  // required
  "subject_line": "Activate your SclinNexus account",// required
  "email_body": "<p>Hello {FullName}...</p>",        // required (HTML)
  "from_name": "SclinNexus",                          // optional
  "from_email": "no-reply@sclinnexus.com",           // optional
  "category": "Auth" | "Study" | "Sponsor" | ...,
  "placeholders": ["FullName","ActivationLink"],     // optional array
  "status": "Active" | "Inactive"
}
```

Preview body: `{ "template_code": "...", "values": { "FullName": "Jane", "ActivationLink": "https://..." } }` → `{ success, subject, body }`.

**409 constraint** `master_email_templates_template_code_key` on duplicate code.

---

### 10.2 Study phases — `/api/v1/masters/study-phases`

Feature gate: `Masters.StudyPhases`.

Standard CRUD. Body:

```json
{
  "phase_name": "Phase III",           // required, unique
  "description": "...",                 // optional
  "sort_order": 3,                      // optional integer
  "status": "Active" | "Inactive"
}
```

---

### 10.3 Countries — `/api/v1/masters/countries`

Feature gate: `Masters.Country`.

| Method | Path            | Purpose                                                            |
|--------|-----------------|--------------------------------------------------------------------|
| GET    | `/`             | List                                                               |
| GET    | `/export`       | CSV                                                                |
| POST   | `/import`       | Multipart `file` (CSV). Returns `{ success, inserted, skipped, errors: [...] }` |
| GET    | `/:id`          | Fetch one                                                          |
| POST   | `/`             | Create `{ country_name, iso_code, phone_code, status }`            |
| PUT    | `/:id`          | Update                                                             |
| DELETE | `/:id`          | Delete                                                             |

---

### 10.4 Locations — `/api/v1/masters/locations`

Feature gate: `Masters.Locations`. Same shape as countries.

Body: `{ country_id, state, district, city, postal_code, status }`.

---

### 10.5 Regions — `/api/v1/masters/regions`

Feature gate: `Masters.Regions`.

Body: `{ region_name, description, country_ids: ["co_IN","co_US"], status }`.

Standard CRUD returning `{ success, item }` or `{ success, items, page, pageSize, total }`.

---

# PART B — Sponsor Workspace APIs

All routes under this part require a **sponsor scope** access token
(issued by `/api/v1/sponsor/auth/*`) unless labelled *CRO-only* or *Public*.

Most sponsor-workspace feature routes need a **study context** so the backend
knows which tenant database (`db_sp_<sponsorId>`) and which table prefix
(`usp_` for UAT, `sp_` for LIVE) to query. Supply context in one of two ways
on every request:

1. **Query string (recommended for GET):** `?study_id=<id>&environment=UAT|LIVE`
2. **Body (for POST/PATCH/DELETE):** include `study_id` and `environment`

> Alternatively, call `/api/v1/sponsor/studies/:id/choose` once to receive a
> `studyContextToken` you can cache; include the `study_id` + `environment`
> in the request as shown above. The token is informational for the current
> implementation.

---

## 11. Sponsor Auth — `/api/v1/sponsor/auth`

### 11.1 Invite sponsor user (CRO-only)

- `POST /api/v1/sponsor/auth/invite`
- **Auth:** CRO Bearer token, feature `ClinicalPrograms.Sponsors.create`

Body:

```json
{
  "sponsor_id": "sp_abc",               // required
  "email_address": "user@sponsor.com",  // required
  "full_name": "Ravi Kumar",            // required
  "role_id": "spr_admin_system",        // required — sponsor_roles.role_id
  "study_ids": ["std_1","std_2"]        // optional — studies to pre-assign
}
```

- **201:** `{ success, sponsorUserId, activationLink, message: "Invitation email sent." }`
- **Errors:**
  - `400` missing field
  - `404` sponsor or role not found
  - `409 constraint: sponsor_users_sponsor_id_email_address_key` → `"A sponsor user with this email address already exists for this sponsor."`
  - `500` email send failure

### 11.2 Activate sponsor user

- `POST /api/v1/sponsor/auth/activate`
- **Auth:** Public
- Body: `{ "token": "...", "password": "...", "confirm_password": "..." }`
- **200:** `{ success, message: "Account activated successfully." }`
- **Errors:** `400` invalid/expired token, password mismatch, weak password.

### 11.3 Login (password)

- `POST /api/v1/sponsor/auth/login/password`
- Body: `{ "email_address": "...", "password": "..." }`
- **200:**

  ```json
  {
    "success": true,
    "message": "Login successful.",
    "accessToken": "<jwt scope=sponsor>",
    "refreshToken": "<jwt>",
    "user": {
      "sponsorUserId": "su_abc",
      "sponsorId": "sp_abc",
      "emailAddress": "user@sponsor.com",
      "fullName": "Ravi Kumar",
      "roleId": "spr_admin_system",
      "roleName": "Sponsor Administrator"
    }
  }
  ```

- **Errors:** `401` invalid creds, `403` not activated, `423` locked.

### 11.4 Login (OTP — request / verify)

- `POST /api/v1/sponsor/auth/login/otp/request` — Body `{ email_address }` → `{ success, message }`
- `POST /api/v1/sponsor/auth/login/otp/verify` — Body `{ email_address, otp }` (6 digits) → same shape as 11.3

### 11.5 Refresh

- `POST /api/v1/sponsor/auth/refresh` — Body `{ refresh_token }` → `{ success, accessToken, refreshToken, user }`

### 11.6 Logout

- `POST /api/v1/sponsor/auth/logout`
- **Auth:** sponsor Bearer token
- **200:** `{ success, message: "Logged out." }`

---

## 12. Sponsor Studies — `/api/v1/sponsor/studies`

### 12.1 List assigned studies

- `GET /api/v1/sponsor/studies`
- **200:** `{ success, items: [ { study_id, protocol_number, study_title, environments: ["UAT","LIVE"], metrics: { sites, subjects, queriesOpen } } ] }`

### 12.2 Choose a study (open workspace)

- `POST /api/v1/sponsor/studies/:id/choose`
- Body: `{ "environment": "UAT" | "LIVE" }`
- **200:** `{ success, studyContextToken: "<base64url>", study: { study_id, protocol_number, study_title, environment } }`

### 12.3 Study metrics / dashboard

- `GET /api/v1/sponsor/studies/:id/metrics?environment=UAT`
- **200:** `{ success, metrics: { sites, subjects, queries, dataVerifications, monitoringVisits, adverseEvents, deviations } }`

---

## 13. Sponsor Workspace Features — `/api/v1/sponsor/workspace`

Every endpoint below requires **sponsor Bearer token** and the study context
(`study_id` + `environment`) either in the query string (GET) or the body
(POST / PATCH / DELETE). RBAC is enforced by feature + action (view, create,
edit, delete, publish, approve).

All responses follow `{ success, ... }`. All errors follow `{ success:false, message, details? }`. Only the shape-specific fields are documented below.

---

### 13.1 Sites — `/sites`

Feature: `sites`.

| Method | Path                    | Action  | Body (in addition to `study_id`, `environment`)                                                                 |
|--------|-------------------------|---------|----------------------------------------------------------------------------------------------------------------|
| GET    | `/sites`                | view    | —                                                                                                              |
| POST   | `/sites`                | create  | `{ site_name, site_code, country_id, location_id, address, principal_investigator, status? }`                  |
| PATCH  | `/sites/:siteId`        | edit    | Any subset of the create fields                                                                                |
| POST   | `/sites/:siteId/activate`| edit    | —                                                                                                              |
| DELETE | `/sites/:siteId`        | delete  | —                                                                                                              |

List response `items`: `[{ site_id, site_name, site_code, country_id, location_id, address, principal_investigator, status, created_at }]`.

---

### 13.2 Site Roles — `/site-roles`

Feature: `site_roles`. CRUD.

Body: `{ role_name, description, permissions: { ...feature flags... } }`.

---

### 13.3 Site Personnel — `/site-personnel`

Feature: `site_personnel`.

| Method | Path                                  | Action  |
|--------|---------------------------------------|---------|
| GET    | `/site-personnel`                     | view    |
| POST   | `/site-personnel/invite`              | create  |
| PATCH  | `/site-personnel/:personnelId`        | edit    |
| DELETE | `/site-personnel/:personnelId`        | delete  |

Invite body: `{ site_id, full_name, email_address, role_id, contact_number? }`.

---

### 13.4 Consent — `/consent`

Feature: `consent_builder`.

| Method | Path                                              | Action   | Purpose                                   |
|--------|---------------------------------------------------|----------|-------------------------------------------|
| GET    | `/consent/templates`                              | view     | List                                      |
| GET    | `/consent/templates/:templateId`                  | view     | Detail                                    |
| POST   | `/consent/templates`                              | create   | Create draft                              |
| PATCH  | `/consent/templates/:templateId`                  | edit     | Update draft                              |
| POST   | `/consent/templates/:templateId/submit`           | edit     | Submit for review                         |
| POST   | `/consent/templates/:templateId/review`           | approve  | Approve / reject (`{ decision, notes }`)  |
| POST   | `/consent/templates/:templateId/publish`          | publish  | Publish approved template                 |

Template body: `{ template_name, version, language, content (HTML/JSON), consent_type }`.

Review body: `{ "decision": "Approved" | "Rejected", "notes": "..." }`.

---

### 13.5 Queries — `/queries`

Feature: `query_manager`.

| Method | Path                                      | Action  |
|--------|-------------------------------------------|---------|
| GET    | `/queries`                                | view    |
| GET    | `/queries/:queryId`                       | view    |
| POST   | `/queries`                                | create  |
| POST   | `/queries/:queryId/answer`                | edit    |
| POST   | `/queries/:queryId/close`                 | edit    |

Raise body:

```json
{
  "subject_id": "sbj_abc",
  "form_id": "frm_abc",
  "field_key": "systolic_bp",
  "severity": "Low" | "Medium" | "High" | "Critical",
  "question": "Please confirm reading"
}
```

Answer body: `{ "answer": "..." }`. Close body: `{ "resolution": "..." }`.

Status values returned: `Open | Answered | Closed | Cancelled`.

---

### 13.6 Data Verification — `/data-verifications`

Feature: `data_verification`.

| Method | Path                                                      | Action   |
|--------|-----------------------------------------------------------|----------|
| GET    | `/data-verifications`                                     | view     |
| POST   | `/data-verifications`                                     | create   |
| POST   | `/data-verifications/:verificationId/review`              | approve  |

Create body:

```json
{
  "subject_id": "sbj_abc",
  "form_id": "frm_abc",
  "verification_type": "SDV" | "Review" | "Lock",
  "notes": "..."
}
```

Review body: `{ "decision": "Approved" | "Rejected", "notes": "..." }`.

---

### 13.7 Masters (sponsor-scoped) — `/masters/*`

Feature: `masters`.

| Method | Path                              | Action  | Body                                                                    |
|--------|-----------------------------------|---------|-------------------------------------------------------------------------|
| GET    | `/masters/email-templates`        | view    | —                                                                       |
| POST   | `/masters/email-templates`        | create  | `{ template_code, template_name, subject, body, placeholders?, is_system?, status? }` (upsert — ON CONFLICT `(study_id, template_code)`) |
| GET    | `/masters/countries`              | view    | —                                                                       |
| POST   | `/masters/countries`              | create  | `{ country_name, iso_code?, status? }` — `country_name` required        |
| GET    | `/masters/locations?country_id=`  | view    | —                                                                       |
| POST   | `/masters/locations`              | create  | `{ country_id, state, city, district?, postal_code?, status? }` — `country_id`, `state`, `city` required |

---

### 13.8 Activity log — `/activity-logs`

Feature: `activity_log`.

- `GET /api/v1/sponsor/workspace/activity-logs?study_id=&environment=&page=&pageSize=&module=&actor_id=&from=&to=`
- **200:** `{ success, items: [ { log_id, sponsor_user_id, actor_name, action, resource_type, resource_id, metadata, ip_address, created_at } ], page, pageSize, total }`

---

# PART C — Integration checklist for Claude

When integrating against this backend, enforce these rules in every request
you generate:

1. **Always send snake_case keys in request bodies** (`full_name`, not `fullName`).
2. **Always attach the access token** on any non-public endpoint:
   `Authorization: Bearer <accessToken>`.
3. **Do not mix scopes.** A sponsor token on a `/api/v1/auth/*` endpoint (other
   than public ones) returns 401; a CRO token on `/api/v1/sponsor/workspace`
   returns 401.
4. **Refresh flow:** when any endpoint returns 401 with `"Invalid token."` or
   `"Token expired."`, call the matching `/refresh` endpoint for the current
   scope (`/api/v1/auth/refresh` or `/api/v1/sponsor/auth/refresh`) with the
   stored `refresh_token`, update both tokens, retry the original request
   once, and logout on repeated failure.
5. **Use `PUT /:id/step-X` to edit existing studies.** Only use `POST /step-1`
   to create a brand-new study; reusing `POST /step-1` on an existing
   protocol number returns 409.
6. **Multipart uploads** (sponsors, team members, profile, email-template
   attachments) must use `multipart/form-data` with the exact field names
   documented above (`photograph` or `files`). Other fields in the same
   request are regular snake_case form fields.
7. **Study context on sponsor workspace endpoints:** always include
   `study_id` + `environment` (query on GET, body on POST/PATCH/DELETE). The
   backend routes to the correct tenant DB (`db_sp_<sponsorId>`) and table
   prefix (`usp_` for UAT, `sp_` for LIVE).
8. **Display the error envelope verbatim.** `error.response.data.message` is
   always a user-safe string — render it directly. Use `details.constraint`
   on 409 responses to focus the offending field.
9. **Permissions-driven UI:** use the `permissions` array returned at login
   (and cached for the session) to hide / disable UI elements. The feature
   names used by the backend are listed in the `Feature gate` notes of each
   section (e.g. `ClinicalPrograms.Studies`, `Masters.EmailTemplates`,
   `sites`, `consent_builder`, ...).
10. **Dates** are ISO-8601 strings. Send dates as `YYYY-MM-DD` (date-only) or
    full ISO timestamps for datetimes. The backend uses the server's local
    timezone for `NOW()` writes.

---

*End of spec. If an endpoint you need is not listed above it does not exist
yet — ask the backend team before fabricating one.*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             