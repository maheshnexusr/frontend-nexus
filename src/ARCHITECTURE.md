# EDC Platform — Source Architecture

## Folder Map

```
src/
│
├── app/                        Global app wiring (router, store, hooks)
│   ├── router.jsx              Route tree — all routes defined here
│   ├── store.js                RTK store — register reducers here
│   ├── hooks.js                Pre-bound useAppDispatch / useAppSelector
│   └── notificationSlice.js   Global toast state (not a feature — lives here)
│
├── api/                        ONE canonical HTTP client
│   ├── axiosClient.js          Axios instance: base URL, token attach, 401 refresh
│   └── apiHelpers.js           normalizeError(), buildQueryString(), buildExportFilename()
│
├── services/                   Real backend API calls (one file per domain)
│   ├── authService.js
│   ├── userService.js
│   ├── studyService.js
│   └── sponsorService.js
│
├── features/                   Feature modules — each is self-contained
│   │
│   ├── auth/                   Authentication & session management
│   │   ├── authSlice.js        Redux: user, tokens, permissions
│   │   ├── index.jsx           Barrel export
│   │   ├── pages/              SignInPage, SignUpPage, ForgotPasswordPage, EmailVerificationPage
│   │   └── components/         SignInTabs, PasswordLoginForm, OTPLoginForm, OTPInput, SignUpForm
│   │
│   ├── cro/                    CRO admin workspace
│   │   ├── index.jsx
│   │   ├── api/                localStorage mock clients (offline layer)
│   │   │   └── *Client.js      studiesClient, sponsorsClient, teamMembersClient, etc.
│   │   ├── store/              Redux slices scoped to this feature
│   │   │   ├── studyWizardSlice.js
│   │   │   └── studyFormSlice.js
│   │   ├── constants/
│   │   │   └── permissionsSchema.js
│   │   ├── pages/              Full-screen pages mapped to /cro/* routes
│   │   └── components/         Sub-components grouped by domain (sponsors/, study-form/, etc.)
│   │
│   ├── sponsor/                Sponsor participant workspace
│   │   ├── index.jsx
│   │   └── pages/              CapturePage, QueriesPage, VerificationPage, ReportsPage, etc.
│   │
│   ├── form-builder/           Standalone form editor
│   │   ├── api/
│   │   ├── store/
│   │   ├── lib/
│   │   ├── pages/
│   │   └── components/
│   │
│   ├── workspace/              Workspace / study selector
│   │   ├── store/
│   │   │   └── workspaceSlice.js   Redux: active workspace, sidebar collapse
│   │   └── pages/              WorkspaceSelectorPage, StudySelectorPage
│   │
│   └── public/                 Public marketing pages
│       ├── index.jsx
│       └── pages/              LandingPage, PrivacyPolicyPage, TermsOfUsePage, CookiePolicyPage
│
├── components/                 Shared UI — no business logic, no API calls
│   ├── ui/                     shadcn/radix primitives (DO NOT MODIFY)
│   ├── form/                   Custom form controls (DatePicker, SearchableDropdown, etc.)
│   ├── feedback/               Toast, Modal, ConfirmDialog, StatusBadge
│   ├── data-table/             DataTable, EmptyState
│   ├── layout/                 Sidebar, Header, ThemeToggle
│   ├── navigation/             ProtectedRoute
│   └── shared/                 PlaceholderPage, error states
│
├── layouts/                    Full-page shells (wrap entire routes)
│   ├── AuthLayout.jsx          Two-column: brand + form
│   ├── CROLayout.jsx           Sidebar + main content (admin)
│   ├── SponsorLayout.jsx       Context-aware nav (participant)
│   ├── PublicLayout.jsx        Navbar + footer (marketing)
│   └── WorkspaceHeader.jsx     Header shared by CRO + Sponsor layouts
│
├── hooks/                      Cross-feature reusable hooks
│   ├── useApi.js               API call hook (useApi, useApiQuery, usePaginatedApi)
│   ├── useDebounce.js
│   ├── usePermissions.js
│   ├── useStorageSync.js
│   ├── useGeoIP.js
│   └── use-mobile.jsx
│
├── lib/                        Third-party integration helpers
│   └── utils.js                cn() helper for shadcn — DO NOT MOVE (shadcn hardcodes this path)
│
└── utils/                      Pure utility functions (no React, no Axios)
    ├── index.ts                createPageUrl() and other pure helpers
    └── roleRedirect.js         Role → route mapping after login
```

---

## Rules

### Where does a new file go?

| Type | Location | Example |
|---|---|---|
| Full-screen page (has a route) | `features/<name>/pages/` | `features/cro/pages/StudyListPage.jsx` |
| Page-specific sub-component | `features/<name>/components/` | `features/cro/components/sponsors/SponsorForm.jsx` |
| Shared UI (used in 2+ features) | `components/<concern>/` | `components/feedback/ConfirmDialog.jsx` |
| Real backend API call | `services/<domain>Service.js` | `services/studyService.js` |
| localStorage/mock data client | `features/<name>/api/` | `features/cro/api/studiesClient.js` |
| Redux slice for one feature | `features/<name>/store/` | `features/cro/store/studyWizardSlice.js` |
| Redux slice used everywhere | `app/` | `app/notificationSlice.js` |
| Cross-feature hook | `hooks/` | `hooks/useApi.js` |
| Feature-only hook | `features/<name>/hooks/` | `features/cro/hooks/useStudyFilters.js` |
| Pure utility (no React/Axios) | `utils/` | `utils/roleRedirect.js` |
| Full-page layout shell | `layouts/` | `layouts/CROLayout.jsx` |

### Naming conventions

| What | Convention | Example |
|---|---|---|
| Pages | `PascalCase` + `Page` suffix | `SponsorListPage.jsx` |
| Components | `PascalCase` | `SponsorForm.jsx` |
| Hooks | `camelCase` + `use` prefix | `useApi.js` |
| Services | `camelCase` + `Service` suffix | `authService.js` |
| Redux slices | `camelCase` + `Slice` suffix | `studyWizardSlice.js` |
| API clients | `camelCase` + `Client` suffix | `sponsorsClient.js` |
| CSS modules | Same name as component | `SponsorForm.module.css` |
| Constants | `UPPER_SNAKE_CASE` for values | `PERMISSION_KEYS` |

### Import path rules

```js
// ✅ Always use path aliases (@/)
import { authService } from '@/services';
import { useApi }      from '@/hooks/useApi';
import axiosClient     from '@/api/axiosClient';

// ❌ Never use relative paths across feature boundaries
import something from '../../../features/cro/api/sponsorsClient';

// ✅ Relative paths only within the same feature
import SponsorForm from './SponsorForm';
import { formatDate } from '../utils/helpers';
```

### The two API layers — know the difference

```
src/api/axiosClient.js           ← HTTP transport (Axios config, interceptors)
src/services/*Service.js         ← Real backend calls using axiosClient
src/features/*/api/*Client.js    ← Mock/localStorage data (dev/demo only)
```

When the backend is ready, swap the localStorage client calls for the matching service function. No other code changes needed.

---

## What NOT to do

- ❌ Do not call `axiosClient` directly from a component
- ❌ Do not put business logic inside `components/ui/` (shadcn files)
- ❌ Do not create a new `features/` folder for a single Redux slice
- ❌ Do not import across feature boundaries (auth importing from cro, etc.)
- ❌ Do not move `src/lib/utils.js` — shadcn components hardcode that path
- ❌ Do not put page-level state in a Redux slice (use `useState`)
