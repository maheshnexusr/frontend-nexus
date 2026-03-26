# SclinNexus EDC — Project Reference

> Everything you need to know about how the project is structured, how it works,
> and exactly where to add new code.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Folder Structure](#2-folder-structure)
3. [How the App Boots](#3-how-the-app-boots)
4. [Routing](#4-routing)
5. [Redux Store](#5-redux-store)
6. [Authentication Flow](#6-authentication-flow)
7. [Role-Based Access](#7-role-based-access)
8. [Layouts](#8-layouts)
9. [Shared Components](#9-shared-components)
10. [Custom Hooks](#10-custom-hooks)
11. [Styling System](#11-styling-system)
12. [Where to Add New Code](#12-where-to-add-new-code)

---

## 1. Tech Stack

| Area | Library |
|---|---|
| UI framework | React 18 (plain JavaScript, no TypeScript) |
| Routing | React Router v6 — `createBrowserRouter` |
| State management | Redux Toolkit (RTK) |
| Async state / API | RTK Query *(API slices pending — mocks in place)* |
| Forms | react-hook-form + zod (validation) |
| Styling | CSS Modules + CSS custom properties |
| Component library | Shadcn UI (`src/components/ui/`) |
| Build tool | Vite |
| Icons | lucide-react |

---

## 2. Folder Structure

```
src/
├── App.jsx                     # Root component — Redux Provider + RouterProvider
├── main.jsx                    # Entry point — mounts <App />
├── vite-env.d.ts               # Vite type reference (import.meta.env)
├── index.css                   # Global resets
│
├── app/
│   ├── router.jsx              # ALL routes defined here (createBrowserRouter)
│   ├── store.js                # Redux store — reducers + RTK Query middleware slots
│   └── hooks.js                # useAppDispatch / useAppSelector
│
├── styles/
│   └── globals.css             # Design tokens (CSS variables), animations
│
├── layouts/                    # Page shell wrappers (sidebar + header + <Outlet>)
│   ├── AuthLayout.jsx          # Two-column auth shell
│   ├── PublicLayout.jsx        # Public navbar + footer shell
│   ├── CROLayout.jsx           # CRO admin workspace (sidebar + header)
│   ├── SponsorLayout.jsx       # Sponsor study workspace (sidebar + header)
│   └── WorkspaceHeader.jsx     # Top header used by CROLayout & SponsorLayout
│
├── features/                   # Feature slices — each feature owns its pages, components, slice
│   ├── auth/
│   │   ├── authSlice.js        # Auth Redux slice (tokens, user, permissions)
│   │   ├── index.jsx           # Barrel export of auth pages
│   │   ├── pages/              # SignInPage, SignUpPage, EmailVerificationPage, ForgotPasswordPage
│   │   └── components/         # SignInTabs, PasswordLoginForm, OTPLoginForm, OTPInput, SignUpForm
│   │
│   ├── workspace/
│   │   ├── workspaceSlice.js   # Workspace Redux slice (sponsor, study, env, sidebar)
│   │   └── pages/              # WorkspaceSelectorPage, StudySelectorPage
│   │
│   ├── cro/
│   │   ├── index.jsx           # Barrel export of CRO pages
│   │   └── pages/              # All CRO pages (dashboard, sponsors, studies, team, masters…)
│   │
│   ├── sponsor/
│   │   ├── index.jsx           # Barrel export of Sponsor pages
│   │   └── pages/              # All Sponsor pages (dashboard, capture, consent, queries…)
│   │
│   ├── public/
│   │   ├── index.jsx           # Barrel export of public pages
│   │   └── pages/              # HomePage, PrivacyPolicyPage, TermsOfUsePage, CookiePolicyPage
│   │
│   └── notifications/
│       └── notificationSlice.js  # Toast notification Redux slice
│
├── components/                 # Shared, reusable components
│   ├── layout/                 # Sidebar, Header, MobileOverlay, ThemeToggle
│   ├── form/                   # PasswordInput, FormField, TextArea, DatePicker, ImageUpload, SearchableDropdown
│   ├── feedback/               # Modal, ConfirmDialog, Toast, ToastContainer, StatusBadge
│   ├── data-table/             # DataTable, EmptyState
│   ├── navigation/             # ProtectedRoute
│   ├── shared/                 # PlaceholderPage
│   └── ui/                     # Shadcn UI primitives (button, dialog, input…)
│
├── hooks/                      # Custom React hooks
│   ├── useGeoIP.js
│   ├── usePermissions.js
│   ├── useStorageSync.js
│   ├── useDebounce.js
│   └── use-mobile.jsx
│
└── lib/                        # Utilities / helpers
    ├── api-client.js           # Axios instance with auth interceptors
    ├── roleRedirect.js         # getRoleRedirect(role) → path
    └── utils.js                # cn() (Tailwind class merge), isIframe
```

---

## 3. How the App Boots

```
main.jsx
  └── <App />
        ├── <Provider store={store}>      ← Redux
        │     <RouterProvider router={router} />  ← React Router
        └── <ToastContainer />            ← Global toasts (outside router)
```

When the router loads, `RootLayout` runs first on every route:

```js
// src/app/router.jsx — RootLayout
function RootLayout() {
  // 1. If a token exists in sessionStorage but Redux lost it (hard refresh),
  //    re-fetch the current user from the API.
  useEffect(() => {
    const token = sessionStorage.getItem('accessToken');
    if (token && !isAuthenticated) dispatch(fetchCurrentUserAsync());
  }, []);

  // 2. Cross-tab logout sync
  useStorageSync();

  return <Outlet />;
}
```

---

## 4. Routing

All routes live in **`src/app/router.jsx`** — the single source of truth.

### Route Groups

| Path | Layout | Auth guard |
|---|---|---|
| `/` `/privacy-policy` `/terms-of-use` `/cookie-policy` | PublicLayout | None |
| `/signup` `/signin` `/verify/:token` `/forgot-password` | AuthLayout | None |
| `/workspace` `/workspace/:sponsorId/studies` | Outlet | ProtectedRoute |
| `/cro/*` | CROLayout | ProtectedRoute |
| `/sponsor/:studyId/*` | SponsorLayout | ProtectedRoute |
| `*` | — | None (inline 404) |

### Study Creation Wizard (nested routes)

```
/cro/studies/new              → StudyNewPage (stepper shell)
  /cro/studies/new/step-1     → StudyWizardStep1
  /cro/studies/new/step-2     → StudyWizardStep2
  ...
  /cro/studies/new/step-6     → StudyWizardStep6
```

### Adding a New Route

1. Create the page file, e.g. `src/features/cro/pages/ReportsPage.jsx`
2. Add the lazy import in `src/app/router.jsx`:
   ```js
   const ReportsPage = lazy(() => import('@/features/cro/pages/ReportsPage'));
   ```
3. Add the route inside the correct group:
   ```js
   { path: 'reports', element: sp(ReportsPage) },
   ```
4. Export it from the barrel file `src/features/cro/index.jsx`:
   ```js
   export { default as ReportsPage } from './pages/ReportsPage';
   ```
5. Add the nav item to `CROLayout.jsx`'s `NAV_ITEMS` array.

### ProtectedRoute

```jsx
// Redirect to /signin if not authenticated
// Show inline 403 if requiredPermission not in state.auth.permissions
<ProtectedRoute requiredPermission="team:read">
  <SomePage />
</ProtectedRoute>
```

---

## 5. Redux Store

### Slices

```
store
├── auth          ← src/features/auth/authSlice.js
├── workspace     ← src/features/workspace/workspaceSlice.js
└── notifications ← src/features/notifications/notificationSlice.js
```

### auth slice

**State shape:**
```js
{
  user:            { id, fullName, email, role, photograph, contactNumber } | null,
  accessToken:     string | null,   // persisted to sessionStorage
  refreshToken:    string | null,   // persisted to sessionStorage
  permissions:     string[],        // e.g. ['team:read', 'masters:read']
  isAuthenticated: boolean,
  status:          'idle' | 'loading' | 'succeeded' | 'failed',
  error:           string | null,
  geoInfo:         { ip, latitude, longitude, city } | null,
}
```

**Async thunks:**
| Thunk | Endpoint | What it does |
|---|---|---|
| `signupAsync` | POST `/auth/signup` | Create account |
| `loginAsync` | POST `/auth/signin` | Password login |
| `loginWithOtpAsync` | POST `/auth/verify-otp` | OTP login |
| `requestOtpAsync` | POST `/auth/request-otp` | Send OTP email |
| `verifyEmailAsync` | POST `/auth/verify-email` | Verify email token |
| `refreshTokenAsync` | POST `/auth/refresh-token` | Refresh access token |
| `fetchCurrentUserAsync` | GET `/auth/me` | Restore session on refresh |
| `changePasswordAsync` | PUT `/auth/change-password` | Change password |

**Selectors:**
```js
import {
  selectCurrentUser,       // → user object
  selectIsAuthenticated,   // → boolean
  selectAuthStatus,        // → 'idle' | 'loading' | 'succeeded' | 'failed'
  selectAuthError,         // → string | null
  selectPermissions,       // → string[]
  selectGeoInfo,           // → { latitude, longitude, ... } | null
} from '@/features/auth/authSlice';
```

**Actions:**
```js
import { logout, setGeoInfo, clearError } from '@/features/auth/authSlice';
dispatch(logout());               // clears auth state + sessionStorage
dispatch(setGeoInfo({ ... }));    // set geo coordinates
dispatch(clearError());           // reset error/status
```

---

### workspace slice

**State shape:**
```js
{
  currentWorkspace:  'cro' | 'sponsor',
  activeSponsorId:   string | null,
  activeSponsorName: string | null,
  activeStudyId:     string | null,
  activeStudyTitle:  string | null,
  activeEnvironment: 'UAT' | 'LIVE',
  studyScope:        'EDC' | 'Survey' | 'ePRO' | null,
  studyConfig:       { consentEnabled, queryEnabled, dataManagerEnabled, navBarEnabled } | null,
  sidebarCollapsed:  boolean,
}
```

**Actions:**
```js
import {
  switchWorkspace,        // payload: 'cro' | 'sponsor'
  selectSponsor,          // payload: { id, name }
  selectStudy,            // payload: { id, title, scope, config }
  switchEnvironment,      // payload: 'UAT' | 'LIVE'
  toggleSidebar,          // no payload
  clearWorkspaceContext,  // no payload
} from '@/features/workspace/workspaceSlice';
```

**Selectors:**
```js
import {
  selectCurrentWorkspace,  // → 'cro' | 'sponsor'
  selectActiveSponsor,     // → { id, name }
  selectActiveStudy,       // → { id, title, scope, config }
  selectEnvironment,       // → 'UAT' | 'LIVE'
  selectSidebarCollapsed,  // → boolean
} from '@/features/workspace/workspaceSlice';
```

---

### notifications slice

**Usage — show a toast from any component:**
```js
import { addToast } from '@/features/notifications/notificationSlice';

dispatch(addToast({ type: 'success', message: 'Study saved!' }));
dispatch(addToast({ type: 'error',   message: 'Something went wrong.', duration: 6000 }));
dispatch(addToast({ type: 'warning', message: 'Unsaved changes.' }));
dispatch(addToast({ type: 'info',    message: 'Fetching data…' }));
```

Toast types: `success` | `error` | `warning` | `info`
Default duration: 4000 ms

---

### Adding a New Redux Slice

1. Create `src/features/<feature>/<feature>Slice.js`:
   ```js
   import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
   import apiClient from '@/lib/api-client';

   export const fetchThingsAsync = createAsyncThunk(
     'things/fetchAll',
     async (_, { rejectWithValue }) => {
       try {
         const { data } = await apiClient.get('/things');
         return data;
       } catch (err) {
         return rejectWithValue(err.response?.data?.message ?? err.message);
       }
     },
   );

   const thingsSlice = createSlice({
     name: 'things',
     initialState: { items: [], status: 'idle', error: null },
     reducers: { /* sync actions */ },
     extraReducers: (builder) => { /* handle thunk states */ },
   });

   export const selectThings = (state) => state.things.items;
   export default thingsSlice.reducer;
   ```

2. Register it in `src/app/store.js`:
   ```js
   import thingsReducer from '@/features/things/thingsSlice';

   const store = configureStore({
     reducer: {
       auth:          authReducer,
       workspace:     workspaceReducer,
       notifications: notificationReducer,
       things:        thingsReducer,   // ← add here
     },
   });
   ```

---

### Adding an RTK Query API Slice

When the backend is ready, replace mock data with RTK Query:

1. Create `src/features/<feature>/<feature>Api.js`:
   ```js
   import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

   export const sponsorApi = createApi({
     reducerPath: 'sponsorApi',
     baseQuery: fetchBaseQuery({
       baseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
       prepareHeaders: (headers) => {
         const token = sessionStorage.getItem('accessToken');
         if (token) headers.set('Authorization', `Bearer ${token}`);
         return headers;
       },
     }),
     endpoints: (builder) => ({
       getSponsors: builder.query({ query: () => '/sponsors' }),
       createSponsor: builder.mutation({ query: (body) => ({ url: '/sponsors', method: 'POST', body }) }),
     }),
   });

   export const { useGetSponsorsQuery, useCreateSponsorMutation } = sponsorApi;
   ```

2. Add to `src/app/store.js`:
   ```js
   import { sponsorApi } from '@/features/sponsor/sponsorApi';

   const store = configureStore({
     reducer: {
       // ... existing reducers
       [sponsorApi.reducerPath]: sponsorApi.reducer,
     },
     middleware: (getDefaultMiddleware) =>
       getDefaultMiddleware().concat(sponsorApi.middleware), // ← uncomment slot
   });
   ```

---

## 6. Authentication Flow

### Login (Password)
```
User submits /signin form
  → dispatch(loginAsync({ email, password, geoInfo }))
      DEV: checks DEV_MOCK_USERS → returns mock token + user
      PROD: POST /auth/signin → returns { accessToken, refreshToken, user, permissions }
  → applyTokens() → saves to sessionStorage
  → applyUser()   → sets user, permissions, isAuthenticated=true
  → navigate(getRoleRedirect(user.role))
```

### Session Restore (page refresh)
```
Hard refresh
  → RootLayout mounts
  → sessionStorage has accessToken but Redux is empty
  → dispatch(fetchCurrentUserAsync())
      → GET /auth/me → returns { user, permissions }
      → applyUser()
```

### Logout
```
dispatch(logout())
  → clears Redux auth state
  → removes accessToken + refreshToken from sessionStorage
  → useStorageSync broadcasts to other tabs via localStorage
  → all tabs navigate to /signin
```

### Dev Mock Credentials

| Email | Password | Role | Redirects to |
|---|---|---|---|
| `robert@domain.com` | `password123` | `cro_admin` | `/cro/dashboard` |
| `user@example.com` | `password123` | `cro` | `/cro/dashboard` |
| `admin@sclin.com` | `Admin@123` | `admin` | `/cro/dashboard` |
| `sponsor@sclin.com` | `Sponsor@123` | `sponsor` | `/workspace` |

> Mock users are defined in `src/features/auth/authSlice.js` under `DEV_MOCK_USERS`.
> They are stripped in production builds (`import.meta.env.DEV` guard).

---

## 7. Role-Based Access

### Post-login redirect logic — `src/lib/roleRedirect.js`

`getRoleRedirect(user)` accepts the **full user object** from the API response.

| Role | Condition | Redirects to |
|---|---|---|
| `admin`, `cro_admin`, `cro` | — | `/cro/dashboard` |
| `sponsor`, `site_staff`, `investigator`, `data_manager` | `user.studyId` present | `/sponsor/:studyId/dashboard` |
| `sponsor`, `site_staff`, `investigator`, `data_manager` | no `studyId` | `/sponsor/select-study` |

**When connecting the real backend:**
- Single-study sponsor → API returns `{ user: { role: 'sponsor', studyId: 'abc123', ... } }` → lands directly on dashboard
- Multi-study sponsor → API omits `studyId` → lands on `/sponsor/select-study` study picker

### Permission-gated nav items

In `CROLayout.jsx`, nav items with a `permission` field are hidden if the user's
permissions array doesn't include it:

```js
const NAV_ITEMS = [
  { key: 'team', label: 'CRO Team Admin', permission: 'team:read', ... },
];
```

Permissions come from the API login response and are stored in `state.auth.permissions`.

### Permission-gated routes

```jsx
<ProtectedRoute requiredPermission="team:read">
  <TeamMembersPage />
</ProtectedRoute>
```

### Reading permissions in a component

```js
import { usePermissions } from '@/hooks/usePermissions';

const { canAccess, permissions } = usePermissions();

if (canAccess('team:read')) { /* show team section */ }
```

---

## 8. Layouts

| Layout | Used by | File |
|---|---|---|
| `PublicLayout` | Public marketing pages | `src/layouts/PublicLayout.jsx` |
| `AuthLayout` | Sign in, Sign up, etc. | `src/layouts/AuthLayout.jsx` |
| `CROLayout` | All `/cro/*` pages | `src/layouts/CROLayout.jsx` |
| `SponsorLayout` | All `/sponsor/:studyId/*` pages | `src/layouts/SponsorLayout.jsx` |

### CROLayout nav items

To add a new item to the CRO sidebar, edit `NAV_ITEMS` in `src/layouts/CROLayout.jsx`:

```js
// Leaf item (no children)
{ key: 'reports', label: 'Reports', icon: BarChart2, path: '/cro/reports' },

// Group with children
{
  key: 'masters',
  label: 'Masters',
  icon: BookOpen,
  path: '/cro/masters',
  permission: 'masters:read',     // optional — hides if permission missing
  children: [
    { key: 'countries', label: 'Countries', path: '/cro/masters/countries' },
  ],
},
```

### SponsorLayout — dynamic nav

Sponsor sidebar items are built dynamically from `studyConfig` flags:
```js
// Always shown
const BASE_ITEMS = [ dashboard, subjects, forms, visits, monitoring ];

// Shown only if study has consent module enabled
if (study?.config?.consentEnabled)  → adds Consent item
if (study?.config?.queryEnabled)    → adds Queries item
```

---

## 9. Shared Components

### PlaceholderPage

Used for pages not yet built:
```jsx
import PlaceholderPage from '@/components/shared/PlaceholderPage';

export default function MyPage() {
  return <PlaceholderPage title="My Page" description="Coming soon." />;
}
```

### ProtectedRoute
```jsx
import ProtectedRoute from '@/components/navigation/ProtectedRoute';

// Auth only
<ProtectedRoute><Outlet /></ProtectedRoute>

// Auth + permission
<ProtectedRoute requiredPermission="team:read"><TeamPage /></ProtectedRoute>
```

### Toast notification
```js
import { addToast } from '@/features/notifications/notificationSlice';
import { useAppDispatch } from '@/app/hooks';

const dispatch = useAppDispatch();
dispatch(addToast({ type: 'success', message: 'Saved!' }));
```

### Form components

All in `src/components/form/`:

```jsx
import FormField         from '@/components/form/FormField';
import PasswordInput     from '@/components/form/PasswordInput';
import TextArea          from '@/components/form/TextArea';
import DatePicker        from '@/components/form/DatePicker';
import ImageUpload       from '@/components/form/ImageUpload';
import SearchableDropdown from '@/components/form/SearchableDropdown';
```

### StatusBadge
```jsx
import StatusBadge from '@/components/feedback/StatusBadge';

<StatusBadge status="active" />    // green
<StatusBadge status="inactive" />  // gray
<StatusBadge status="pending" />   // amber
```

### Modal / ConfirmDialog
```jsx
import Modal         from '@/components/feedback/Modal';
import ConfirmDialog from '@/components/feedback/ConfirmDialog';
```

---

## 10. Custom Hooks

| Hook | File | What it does |
|---|---|---|
| `useAppDispatch` | `src/app/hooks.js` | Typed `dispatch` — use this everywhere instead of bare `useDispatch()` |
| `useAppSelector` | `src/app/hooks.js` | Typed `useSelector` — use this everywhere |
| `usePermissions` | `src/hooks/usePermissions.js` | `{ canAccess(permission), permissions[] }` |
| `useGeoIP` | `src/hooks/useGeoIP.js` | Silently populates `state.auth.geoInfo` via browser geolocation |
| `useStorageSync` | `src/hooks/useStorageSync.js` | Cross-tab logout — mounted once in RootLayout |
| `useDebounce` | `src/hooks/useDebounce.js` | Debounce a value by N ms |
| `useMobile` | `src/hooks/use-mobile.jsx` | Returns `true` when viewport < 768 px |

### Usage example

```js
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { usePermissions }                 from '@/hooks/usePermissions';

function MyComponent() {
  const dispatch  = useAppDispatch();
  const user      = useAppSelector(selectCurrentUser);
  const { canAccess } = usePermissions();

  return canAccess('team:read') ? <TeamSection /> : null;
}
```

---

## 11. Styling System

### CSS Variables (Design Tokens)

Defined in `src/styles/globals.css`, available everywhere:

```css
/* Backgrounds */
var(--bg-page)      /* #f8fafc — page background */
var(--bg-surface)   /* #ffffff — card/panel background */
var(--bg-sidebar)   /* #ffffff — sidebar background */
var(--bg-hover)     /* #f8fafc — hover state */
var(--bg-active)    /* #f1f5f9 — active/selected state */

/* Text */
var(--text-primary)    /* #0f172a */
var(--text-secondary)  /* #64748b */
var(--text-muted)      /* #94a3b8 */

/* Borders */
var(--border)         /* #f1f5f9 */
var(--border-medium)  /* #e2e8f0 */

/* Layout */
var(--sidebar-width)            /* 248px */
var(--sidebar-width-collapsed)  /* 68px */
var(--header-height)            /* 56px */

/* Spacing (4px base) */
var(--sp-1)  /* 4px */   var(--sp-2)  /* 8px */
var(--sp-3)  /* 12px */  var(--sp-4)  /* 16px */
var(--sp-6)  /* 24px */  var(--sp-8)  /* 32px */

/* Border radius */
var(--r-sm) /* 6px */  var(--r-md) /* 8px */
var(--r-lg) /* 12px */ var(--r-xl) /* 16px */

/* Shadows */
var(--shadow-sm)    var(--shadow-md)
var(--shadow-lg)    var(--shadow-popup)

/* Transitions */
var(--t-fast)    /* 150ms */
var(--t-normal)  /* 200ms */
var(--t-slow)    /* 300ms */
```

### Dark mode

The dark theme is activated by adding the `.dark` class to the `<html>` element.
All `var(--*)` tokens automatically switch. `ThemeToggle` component handles this.

### Writing component styles

Always use CSS Modules (`.module.css` file next to each `.jsx`):

```css
/* MyComponent.module.css */
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: var(--sp-6);
  box-shadow: var(--shadow-sm);
}
```

```jsx
import styles from './MyComponent.module.css';

function MyComponent() {
  return <div className={styles.card}>...</div>;
}
```

### Path alias

`@/` maps to `src/`:
```js
import { useAppDispatch } from '@/app/hooks';
import Sidebar from '@/components/layout/Sidebar';
```

---

## 12. Where to Add New Code

### New CRO page

1. Create `src/features/cro/pages/MyNewPage.jsx`
2. Add lazy import + route in `src/app/router.jsx`
3. Export from `src/features/cro/index.jsx`
4. Add nav item in `src/layouts/CROLayout.jsx`

### New Sponsor page

1. Create `src/features/sponsor/pages/MyNewPage.jsx`
2. Add lazy import + route in `src/app/router.jsx`
3. Export from `src/features/sponsor/index.jsx`
4. Add nav item in `src/layouts/SponsorLayout.jsx`

### New Redux slice

1. Create `src/features/<feature>/<feature>Slice.js`
2. Register reducer in `src/app/store.js`

### New RTK Query API slice

1. Create `src/features/<feature>/<feature>Api.js`
2. Register reducer + middleware in `src/app/store.js`

### New reusable component

- Form inputs → `src/components/form/`
- Feedback (modals, alerts) → `src/components/feedback/`
- Navigation helpers → `src/components/navigation/`
- General shared → `src/components/shared/`

### New custom hook

- Create `src/hooks/use<HookName>.js`

### New utility / helper

- Create `src/lib/<name>.js`

### New public page

1. Create `src/features/public/pages/MyPage.jsx`
2. Add lazy import + route in `src/app/router.jsx` under the PublicLayout group
3. Export from `src/features/public/index.jsx`

### Add a permission

Permissions are returned by the API in the login response as a string array.
To use one in a nav item or route, add its string key wherever needed:
```js
permission: 'reports:read'  // in CROLayout NAV_ITEMS
```
```jsx
<ProtectedRoute requiredPermission="reports:read">  // in router.jsx
```

### Environment variables

Add to `.env` (or `.env.local` for secrets):
```
VITE_API_BASE_URL=https://api.example.com
```

Access in code:
```js
import.meta.env.VITE_API_BASE_URL
```

---

## API Client

All HTTP calls go through `src/lib/api-client.js` (Axios instance):

- **Base URL**: `VITE_API_BASE_URL` env variable, falls back to `/api`
- **Auth**: automatically injects `Authorization: Bearer <token>` from sessionStorage
- **401 handling**: automatically clears tokens on 401 response

```js
import apiClient from '@/lib/api-client';

// Inside a createAsyncThunk:
const { data } = await apiClient.get('/sponsors');
const { data } = await apiClient.post('/sponsors', body);
const { data } = await apiClient.put('/sponsors/123', body);
await apiClient.delete('/sponsors/123');
```
