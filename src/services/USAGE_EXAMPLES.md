# API Architecture — Usage Examples

## Architecture Flow

```
Component
  └─ useApi(serviceFunction, config)   ← hook manages state
       └─ serviceFunction(args)         ← service: only Axios calls
            └─ axiosClient.verb(path)   ← Axios: interceptors, base URL
                 └─ Real backend API
```

---

## 1. Manual trigger (login form)

```jsx
import { useApi }       from '@/hooks/useApi';
import { authService }  from '@/services';
import { useDispatch }  from 'react-redux';
import { loginSuccess } from '@/features/auth/authSlice';

export default function LoginPage() {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { execute, loading, error } = useApi(authService.login, {
    onSuccess: (data) => {
      // Store tokens
      localStorage.setItem('accessToken',  data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      // Update Redux
      dispatch(loginSuccess(data));
    },
    onError: (err) => {
      // err.message is already human-readable (from normalizeError)
      console.error(err.message);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    execute({ email, password });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

      {error && <p className="error">{error.message}</p>}

      <button disabled={loading}>
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  );
}
```

---

## 2. Auto-fetch on mount (list page)

```jsx
import { useApi }          from '@/hooks/useApi';
import { sponsorService }  from '@/services';

export default function SponsorListPage() {
  const { data: sponsors = [], loading, error, execute: reload } =
    useApi(sponsorService.list, { immediate: true });

  if (loading) return <Spinner />;
  if (error)   return <ErrorBanner message={error.message} onRetry={reload} />;

  return sponsors.map((s) => <SponsorCard key={s.id} sponsor={s} />);
}
```

---

## 3. Auto-fetch with args (detail page)

```jsx
import { useApi }        from '@/hooks/useApi';
import { studyService }  from '@/services';
import { useParams }     from 'react-router-dom';

export default function StudyDetailPage() {
  const { studyId } = useParams();

  const { data: study, loading } = useApi(studyService.getById, {
    immediate:     true,
    immediateArgs: [studyId],
  });

  return loading ? <Spinner /> : <StudyDetail study={study} />;
}
```

---

## 4. Re-fetch when filters change (useApiQuery)

```jsx
import { useApiQuery }     from '@/hooks/useApi';
import { sponsorService }  from '@/services';

export default function SponsorList({ status, search }) {
  const { data, loading, refetch } = useApiQuery(
    () => sponsorService.list({ status, search }),
    [status, search],          // re-fetches whenever these change
  );

  return (
    <>
      <button onClick={refetch}>Refresh</button>
      {loading ? <Spinner /> : data?.map(…)}
    </>
  );
}
```

---

## 5. Paginated list (usePaginatedApi)

```jsx
import { usePaginatedApi } from '@/hooks/useApi';
import { userService }     from '@/services';

export default function TeamPage() {
  const {
    rows, totalCount,
    page, pageSize,
    loading,
    setPage, setPageSize,
    refetch,
  } = usePaginatedApi(userService.listMembers, { defaultPageSize: 25 });

  return (
    <DataTable
      data={rows}
      totalCount={totalCount}
      page={page}
      pageSize={pageSize}
      loading={loading}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
    />
  );
}
```

---

## 6. Multiple independent calls in one component

```jsx
export default function DashboardPage() {
  const { data: studies,  loading: l1 } = useApi(studyService.list,   { immediate: true });
  const { data: sponsors, loading: l2 } = useApi(sponsorService.list, { immediate: true });
  const { data: members,  loading: l3 } = useApi(userService.listMembers, { immediate: true });

  const loading = l1 || l2 || l3;
  if (loading) return <Spinner />;
  // …
}
```

---

## 7. Mutate + optimistic update pattern

```jsx
export default function StudyCard({ study }) {
  const { execute: updateStatus, loading } = useApi(studyService.changeStatus, {
    onSuccess: () => toast.success('Status updated'),
    onError:   (err) => toast.error(err.message),
  });

  return (
    <button
      disabled={loading}
      onClick={() => updateStatus(study.id, 'Inactive')}
    >
      Deactivate
    </button>
  );
}
```

---

## 8. File / Blob download

```jsx
import { buildExportFilename } from '@/api/apiHelpers';

export default function ExportButton({ studyId }) {
  const { execute, loading } = useApi(studyService.export, {
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = buildExportFilename('Study_Export', 'xlsx');
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  return (
    <button disabled={loading} onClick={() => execute(studyId, 'xlsx')}>
      {loading ? 'Exporting…' : 'Export XLSX'}
    </button>
  );
}
```

---

## Error shape reference

Every error thrown by `useApi` has this shape (from `normalizeError`):

```js
{
  status:  number,   // HTTP status (0 = network, -1 = unknown, -2 = cancelled)
  message: string,   // human-readable, safe to show in UI
  errors:  object | null,  // field-level errors from 422 responses
  raw:     Error,    // original Axios error for logging
}
```

Field-level errors (422 validation):
```js
if (error.errors) {
  // { "email": ["already taken"], "name": ["is required"] }
  setFieldErrors(error.errors);
}
```
