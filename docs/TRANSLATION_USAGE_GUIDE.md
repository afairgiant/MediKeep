# Translation Usage Guide

This guide shows how to use the i18next localization framework in MediKeep components.

## Table of Contents
- [Quick Start](#quick-start)
- [Using Translations in Components](#using-translations-in-components)
- [Translation Key Structure](#translation-key-structure)
- [Common Patterns](#common-patterns)
- [Medical Form Examples](#medical-form-examples)
- [Error Message Examples](#error-message-examples)
- [Best Practices](#best-practices)

---

## Quick Start

### Basic Usage

```jsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();

  return (
    <button>{t('common:buttons.save')}</button>
  );
}
```

### Using Custom Hook

```jsx
import useTranslations from '../i18n/useTranslations';

function MyComponent() {
  const { t } = useTranslations('common');  // Set default namespace

  return (
    <button>{t('buttons.save')}</button>  // No need to prefix with namespace
  );
}
```

---

## Using Translations in Components

### 1. Simple Button Labels

**Before:**
```jsx
<Button>Save</Button>
<Button>Cancel</Button>
<Button>Delete</Button>
```

**After:**
```jsx
import { useTranslation } from 'react-i18next';

function MyForm() {
  const { t } = useTranslation('common');

  return (
    <>
      <Button>{t('buttons.save')}</Button>
      <Button>{t('buttons.cancel')}</Button>
      <Button>{t('buttons.delete')}</Button>
    </>
  );
}
```

### 2. Form Field Labels

**Before:**
```jsx
<TextInput
  label="Full Name"
  placeholder="Enter your name"
  description="Your legal name as it appears on official documents"
/>
```

**After:**
```jsx
import { useTranslation } from 'react-i18next';

function NameField() {
  const { t } = useTranslation('medical');

  return (
    <TextInput
      label={t('common.fields.fullName.label')}
      placeholder={t('common.fields.fullName.placeholder')}
      description={t('common.fields.fullName.description')}
    />
  );
}
```

### 3. Loading & Empty States

**Before:**
```jsx
if (loading) return <div>Loading...</div>;
if (!data?.length) return <div>No data available</div>;
```

**After:**
```jsx
import { useTranslation } from 'react-i18next';

function DataList() {
  const { t } = useTranslation('common');

  if (loading) return <div>{t('labels.loading')}</div>;
  if (!data?.length) return <div>{t('labels.noData')}</div>;

  return <div>{/* render data */}</div>;
}
```

### 4. Error Messages

**Before:**
```jsx
if (error) {
  showNotification({
    title: 'Error',
    message: 'Failed to upload file. Please try again.',
    color: 'red',
  });
}
```

**After:**
```jsx
import { useTranslation } from 'react-i18next';

function FileUploader() {
  const { t } = useTranslation('errors');

  if (error) {
    showNotification({
      title: t('general.unknownError'),
      message: t('upload.failed'),
      color: 'red',
    });
  }
}
```

---

## Translation Key Structure

### Available Namespaces

- **common** - Buttons, labels, messages, time, pagination
- **medical** - All medical form fields (14 forms)
- **errors** - Error, success, and warning messages
- **navigation** - Menu items, page titles, sections

### Key Naming Convention

Format: `namespace:category.subcategory.field`

Examples:
- `common:buttons.save`
- `medical:allergies.allergen.label`
- `errors:upload.failed`
- `navigation:menu.dashboard`

---

## Common Patterns

### Pattern 1: Using Shared Field Definitions

Many fields (like notes, tags, status) are defined in `medical:common.fields`:

```jsx
import { useTranslation } from 'react-i18next';

function NotesField() {
  const { t } = useTranslation('medical');

  return (
    <Textarea
      label={t('common.fields.notes.label')}
      placeholder={t('common.fields.notes.placeholder')}
      description={t('common.fields.notes.description')}
    />
  );
}
```

### Pattern 2: Using Shared Status Options

Status options are shared across many forms:

```jsx
import { useTranslation } from 'react-i18next';

function StatusSelect() {
  const { t } = useTranslation('medical');

  const statusOptions = [
    { value: 'active', label: t('common.status.active') },
    { value: 'inactive', label: t('common.status.inactive') },
    { value: 'resolved', label: t('common.status.resolved') },
  ];

  return <Select data={statusOptions} label={t('common.fields.status.label')} />;
}
```

### Pattern 3: Using Shared Severity Levels

Severity options are shared across allergies, conditions, symptoms, etc.:

```jsx
import { useTranslation } from 'react-i18next';

function SeveritySelect() {
  const { t } = useTranslation('medical');

  const severityOptions = [
    { value: 'mild', label: t('common.severity.mild') },
    { value: 'moderate', label: t('common.severity.moderate') },
    { value: 'severe', label: t('common.severity.severe') },
    { value: 'lifeThreatening', label: t('common.severity.lifeThreatening') },
  ];

  return <Select data={severityOptions} label={t('common.fields.severity.label')} />;
}
```

---

## Medical Form Examples

### Example 1: Allergy Form

```jsx
import { useTranslation } from 'react-i18next';

function AllergyForm() {
  const { t } = useTranslation('medical');

  return (
    <form>
      <TextInput
        label={t('allergies.allergen.label')}
        placeholder={t('allergies.allergen.placeholder')}
        description={t('allergies.allergen.description')}
        required
      />

      <Select
        label={t('allergies.severity.label')}
        placeholder={t('allergies.severity.placeholder')}
        description={t('allergies.severity.description')}
        data={[
          { value: 'mild', label: t('allergies.severity.options.mild') },
          { value: 'moderate', label: t('allergies.severity.options.moderate') },
          { value: 'severe', label: t('allergies.severity.options.severe') },
          { value: 'lifeThreatening', label: t('allergies.severity.options.lifeThreatening') },
        ]}
      />

      <TextInput
        label={t('allergies.reaction.label')}
        placeholder={t('allergies.reaction.placeholder')}
        description={t('allergies.reaction.description')}
      />

      <Textarea
        label={t('common.fields.notes.label')}
        placeholder={t('allergies.notes.placeholder')}
        description={t('allergies.notes.description')}
      />
    </form>
  );
}
```

### Example 2: Medication Form

```jsx
import { useTranslation } from 'react-i18next';

function MedicationForm() {
  const { t } = useTranslation('medical');

  return (
    <form>
      <TextInput
        label={t('medications.medicationName.label')}
        placeholder={t('medications.medicationName.placeholder')}
        description={t('medications.medicationName.description')}
        required
      />

      <TextInput
        label={t('medications.dosage.label')}
        placeholder={t('medications.dosage.placeholder')}
        description={t('medications.dosage.description')}
      />

      <Select
        label={t('medications.route.label')}
        placeholder={t('medications.route.placeholder')}
        description={t('medications.route.description')}
        data={[
          { value: 'oral', label: t('medications.route.options.oral') },
          { value: 'injection', label: t('medications.route.options.injection') },
          { value: 'topical', label: t('medications.route.options.topical') },
          // ... other routes
        ]}
      />

      <DatePicker
        label={t('common.fields.startDate.label')}
        placeholder={t('common.fields.startDate.placeholder')}
        description={t('common.fields.startDate.description')}
      />
    </form>
  );
}
```

---

## Error Message Examples

### Example 1: File Upload Errors

```jsx
import { useTranslation } from 'react-i18next';

function FileUploader() {
  const { t } = useTranslation('errors');

  const handleUpload = async (file) => {
    try {
      await uploadFile(file);
      showNotification({
        title: t('success.uploadSuccess'),
        color: 'green',
      });
    } catch (error) {
      let errorMessage = t('upload.failed');

      if (error.message.includes('size')) {
        errorMessage = t('upload.fileTooLarge');
      } else if (error.message.includes('type')) {
        errorMessage = t('upload.invalidFileType');
      } else if (error.message.includes('network')) {
        errorMessage = t('network.unavailable');
      }

      showNotification({
        title: t('general.unknownError'),
        message: errorMessage,
        color: 'red',
      });
    }
  };
}
```

### Example 2: Form Validation

```jsx
import { useTranslation } from 'react-i18next';

function validateForm(values) {
  const { t } = useTranslation('errors');
  const errors = {};

  if (!values.email) {
    errors.email = t('form.requiredFieldMissing');
  } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
    errors.email = t('form.invalidEmail');
  }

  if (!values.phone) {
    errors.phone = t('form.requiredFieldMissing');
  } else if (!/^\d{10}$/.test(values.phone.replace(/\D/g, ''))) {
    errors.phone = t('form.invalidPhone');
  }

  return errors;
}
```

---

## Best Practices

### 1. Always Use Namespaces

✅ **Good:**
```jsx
const { t } = useTranslation('medical');
// ...
label={t('allergies.allergen.label')}
```

❌ **Bad:**
```jsx
const { t } = useTranslation();
// ...
label={t('medical:allergies.allergen.label')}  // Harder to read
```

### 2. Extract to Constants for Repeated Options

✅ **Good:**
```jsx
const STATUS_OPTIONS = useMemo(() => [
  { value: 'active', label: t('common.status.active') },
  { value: 'inactive', label: t('common.status.inactive') },
], [t]);
```

### 3. Use Shared Fields When Available

✅ **Good:**
```jsx
// Use shared field definition
label={t('common.fields.notes.label')}
placeholder={t('common.fields.notes.placeholder')}
```

❌ **Bad:**
```jsx
// Don't duplicate what's already in common
label={t('allergies.notes.label')}  // If this is just "Notes", use common!
```

### 4. Keep Translation Keys Close to Usage

✅ **Good:**
```jsx
function AllergyCard({ allergy }) {
  const { t } = useTranslation('medical');
  // Translation keys used immediately
}
```

### 5. Handle Missing Translations Gracefully

i18next will show the key if a translation is missing. In development, check console for warnings.

```jsx
// i18next config has debug: true in development
// Missing keys will log warnings to help you find them
```

---

## Quick Reference

### Common Buttons
```jsx
t('common:buttons.save')
t('common:buttons.cancel')
t('common:buttons.delete')
t('common:buttons.edit')
t('common:buttons.add')
t('common:buttons.submit')
```

### Common Labels
```jsx
t('common:labels.loading')
t('common:labels.noData')
t('common:labels.status')
t('common:labels.active')
t('common:labels.inactive')
```

### Common Messages
```jsx
t('common:messages.saveSuccess')
t('common:messages.deleteSuccess')
t('common:messages.confirmDelete')
t('common:messages.unsavedChanges')
```

### Shared Medical Fields
```jsx
t('medical:common.fields.notes.label')
t('medical:common.fields.tags.label')
t('medical:common.fields.status.label')
t('medical:common.fields.severity.label')
t('medical:common.fields.startDate.label')
t('medical:common.fields.endDate.label')
```

### Navigation
```jsx
t('navigation:menu.dashboard')
t('navigation:menu.patients')
t('navigation:menu.medicalRecords')
t('navigation:menu.settings')
```

---

## Testing Your Translations

### 1. Check for Missing Keys

Open browser console in development. i18next will log warnings for missing keys.

### 2. Test with Different Languages (Future)

When adding new languages:
```jsx
import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <Select
      value={i18n.language}
      onChange={(value) => i18n.changeLanguage(value)}
      data={[
        { value: 'en', label: 'English' },
        // Add more languages here when available
      ]}
    />
  );
}
```

### 3. Verify Build

```bash
npm run build
# Should build successfully with no translation errors
```

---

## Need Help?

- **Missing a translation key?** Check the JSON files in `frontend/public/locales/en/`
- **Adding new translations?** Follow the existing structure and naming conventions
- **Translation not showing?** Check console for missing key warnings

For more details, see:
- [docs/LOCALIZATION_GUIDE.md](./LOCALIZATION_GUIDE.md) - How to add new languages
- [docs/working_docs/LOCALIZATION_IMPLEMENTATION.md](./working_docs/LOCALIZATION_IMPLEMENTATION.md) - Implementation tracking
