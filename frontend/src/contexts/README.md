# Global State Management Implementation

## Overview

This implementation solves the performance issue where the app was making redundant API calls by introducing a comprehensive global state management system. Previously, each page would independently fetch the same data (patient info, practitioners, pharmacies) on mount, leading to unnecessary network requests and slower navigation.

## Architecture

### 1. AppDataContext (`AppDataContext.js`)

The main context that manages global application data with smart caching capabilities.

**Features:**
- **Smart Caching**: Data is cached with configurable expiry times
- **Automatic Cache Validation**: Checks if cached data is still valid before making API calls
- **Loading State Management**: Centralized loading states for all data types
- **Error Handling**: Centralized error management
- **Cache Invalidation**: Ability to force refresh or clear specific cache entries

**Cached Data Types:**
- Patient data (expires after 15 minutes)
- Practitioners list (expires after 60 minutes)
- Pharmacies list (expires after 60 minutes)

### 2. Global Data Hooks (`hooks/useGlobalData.js`)

Custom hooks that provide convenient access to global data:

- `useCurrentPatient()` - Patient data with loading states and refresh functionality
- `usePractitioners()` - Practitioners list with caching
- `usePharmacies()` - Pharmacies list with caching
- `useStaticData()` - Both practitioners and pharmacies together
- `usePatientWithStaticData()` - Patient data plus all static data
- `useCacheManager()` - Cache management utilities

## Setup

### 1. Provider Setup

The `AppDataProvider` must be placed inside `AuthProvider` but outside `ThemeProvider`:

```jsx
<AuthProvider>
  <AppDataProvider>
    <ThemeProvider>
      {/* Your app components */}
    </ThemeProvider>
  </AppDataProvider>
</AuthProvider>
```

### 2. Automatic Data Loading

Data is automatically loaded when the user logs in:
- Patient data is fetched immediately
- Static lists (practitioners, pharmacies) are fetched in parallel
- All data is cached with appropriate expiry times

## Usage Examples

### Basic Patient Data Access

```jsx
import { useCurrentPatient } from '../hooks/useGlobalData';

function MyComponent() {
  const { patient, loading, error, refresh } = useCurrentPatient();
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <h1>{patient?.name}</h1>
      <button onClick={refresh}>Refresh Patient Data</button>
    </div>
  );
}
```

### Combined Data Access

```jsx
import { usePatientWithStaticData } from '../hooks/useGlobalData';

function MedicalForm() {
  const { 
    patient, 
    practitioners, 
    pharmacies, 
    loading, 
    refreshAll 
  } = usePatientWithStaticData();
  
  // All data is available without individual API calls
  return (
    <form>
      <select>
        {practitioners.practitioners.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </form>
  );
}
```

### Cache Management

```jsx
import { useCacheManager } from '../hooks/useGlobalData';

function AdminPanel() {
  const { 
    invalidateAll, 
    invalidatePatient, 
    updateCacheExpiry 
  } = useCacheManager();
  
  return (
    <div>
      <button onClick={invalidateAll}>Clear All Caches</button>
      <button onClick={invalidatePatient}>Refresh Patient Data</button>
      <button onClick={() => updateCacheExpiry({ patient: 5 })}>
        Set 5-minute patient cache
      </button>
    </div>
  );
}
```

## Migration Guide

### Before (Redundant API Calls)

```jsx
// OLD WAY - Each component fetches independently
function LabResults() {
  const [patient, setPatient] = useState(null);
  const [practitioners, setPractitioners] = useState([]);
  
  useEffect(() => {
    // These calls happen on every page mount
    apiService.getCurrentPatient().then(setPatient);
    apiService.getPractitioners().then(setPractitioners);
  }, []);
  
  // Component logic...
}
```

### After (Global State)

```jsx
// NEW WAY - Data comes from global cache
function LabResults() {
  const { patient } = useCurrentPatient();
  const { practitioners } = usePractitioners();
  
  // Data is automatically available from cache
  // No redundant API calls!
  
  // Component logic...
}
```

## Performance Benefits

### Before Implementation
- ✗ Each page made 2-3 API calls on mount
- ✗ Same data fetched multiple times during navigation
- ✗ Slower page transitions
- ✗ Higher server load
- ✗ Poor user experience on slow connections

### After Implementation
- ✅ Data fetched once and cached globally
- ✅ Instant access to cached data
- ✅ Faster page transitions
- ✅ Reduced server load
- ✅ Better user experience
- ✅ Configurable cache expiry
- ✅ Smart cache invalidation

## Cache Configuration

### Default Settings
```javascript
{
  patient: 15,      // 15 minutes
  practitioners: 60, // 1 hour
  pharmacies: 60    // 1 hour
}
```

### Customizing Cache Expiry
```jsx
const { updateCacheExpiry } = useCacheManager();

// Set shorter cache for development
updateCacheExpiry({
  patient: 1,       // 1 minute
  practitioners: 5, // 5 minutes
  pharmacies: 5     // 5 minutes
});
```

## Testing

### Global State Demo

Visit `/global-state-demo` to see the cache in action:
- Real-time cache status
- Cache expiry timers
- Manual cache controls
- Visual feedback for loading states

### Verification Steps

1. Navigate to a medical page (e.g., Lab Results)
2. Check network tab - should see initial API calls
3. Navigate to another page (e.g., Medications)
4. Network tab should show NO additional calls for patient/practitioners/pharmacies
5. Only medication-specific data should be fetched

## Error Handling

The system gracefully handles errors:
- Network failures don't crash the app
- Stale data is better than no data
- Individual cache failures don't affect other data
- Error states are clearly communicated to users

## Future Enhancements

1. **Local Storage Persistence**: Cache data across browser sessions
2. **Background Refresh**: Automatically refresh stale data
3. **Optimistic Updates**: Update UI before API confirmation
4. **Real-time Updates**: WebSocket integration for live data
5. **Advanced Caching**: LRU cache with size limits

## Troubleshooting

### Common Issues

1. **Data not updating**: Check if cache needs manual invalidation
2. **Slow initial load**: Normal - subsequent navigation should be fast
3. **Missing data**: Ensure AppDataProvider is properly wrapped
4. **TypeScript errors**: Import hooks from the correct path

### Debug Tools

Use the GlobalStateDemo component to debug cache issues:
```jsx
import GlobalStateDemo from '../components/common/GlobalStateDemo';
```

## Best Practices

1. **Use appropriate hooks**: `useCurrentPatient()` for patient data only, `usePatientWithStaticData()` for forms
2. **Handle loading states**: Always check loading state before rendering data
3. **Refresh when needed**: Use refresh functions after data mutations
4. **Invalidate carefully**: Don't over-invalidate caches
5. **Monitor performance**: Use browser dev tools to verify reduced API calls 