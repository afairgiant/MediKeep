# PageHeader Component

A standardized header component that can be used across all medical pages and the main dashboard.

## Usage

### Basic Medical Page

```jsx
import { PageHeader } from '../../components';

<PageHeader title="Medical Conditions" icon="🏥" variant="medical" />;
```

### Medical Page with Actions

```jsx
<PageHeader
  title="Healthcare Practitioners"
  icon="👩‍⚕️"
  variant="medical"
  actions={
    <>
      <button className="add-btn" onClick={handleAdd}>
        + Add Practitioner
      </button>
      <div className="search-container">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>
    </>
  }
/>
```

### Dashboard

```jsx
<PageHeader
  title="Medical Records App"
  icon="🏥"
  variant="dashboard"
  showBackButton={false}
  actions={
    <>
      <button className="settings-btn">⚙️</button>
      <ThemeToggle />
      <button className="logout-btn">Logout</button>
    </>
  }
/>
```

## Props

| Prop                | Type            | Default                 | Description                                                |
| ------------------- | --------------- | ----------------------- | ---------------------------------------------------------- |
| `title`             | string          | -                       | The page title (required)                                  |
| `icon`              | string          | -                       | Emoji or icon to display next to title                     |
| `showBackButton`    | boolean         | `true`                  | Whether to show the back button                            |
| `backButtonText`    | string          | `'← Back to Dashboard'` | Text for the back button                                   |
| `backButtonPath`    | string          | `'/dashboard'`          | Path to navigate to when back button is clicked            |
| `onBackClick`       | function        | -                       | Custom back button handler (overrides default navigation)  |
| `actions`           | React.ReactNode | -                       | Custom actions to display on the right side                |
| `className`         | string          | `''`                    | Additional CSS classes                                     |
| `variant`           | string          | `'dashboard'`           | Variant style ('medical' or 'dashboard')                   |
| `showNavigation`    | boolean         | `true`                  | Whether to render the navigation bar below the header      |
| `showTitle`         | boolean         | `true`                  | Whether to render the title block                          |

## Page-Specific Configurations

### Medical Pages

- `variant`: "medical" — must be passed explicitly; the default is "dashboard"
- `title`: Page-specific title (e.g., "Healthcare Practitioners", "Lab Results")
- `icon`: Page-specific emoji (e.g., "👩‍⚕️", "🧪", "💊")
- `actions`: Add buttons, search inputs, filters, etc.

### Dashboard

- `variant`: "dashboard"
- `showBackButton`: false
- `actions`: Settings, theme toggle, logout button

## Global Navigation

By default, all pages include:

- **Settings Button**: Access to user settings
- **Theme Toggle**: Switch between light/dark mode
- **Logout Button**: Sign out of the application

These live in the navigation bar, which `showNavigation={false}` removes entirely.

## Consistent Styling

The component automatically applies:

- Consistent spacing and padding
- Responsive design for mobile devices
- Theme-aware colors and borders
- Proper font sizing and hierarchy
- Flex layout for proper alignment
- Global navigation controls on all pages

## Examples by Page Type

### Simple Medical Page (Conditions, Allergies)

```jsx
<PageHeader title="Medical Conditions" icon="🏥" />
```

### Complex Medical Page (Practitioners, Medications)

```jsx
<PageHeader
  title="Medications"
  icon="💊"
  actions={
    <>
      <button onClick={handleAdd}>+ Add Medication</button>
      <ViewToggle mode={viewMode} onChange={setViewMode} />
    </>
  }
/>
```

### Settings Page

```jsx
<PageHeader
  title="Settings"
  icon="⚙️"
  backButtonText="← Back to Dashboard"
  backButtonPath="/dashboard"
/>
```
