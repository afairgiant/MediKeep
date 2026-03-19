# Dutch (nl) Translation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Dutch (nl) as the 8th supported language in MediKeep, following the exact pattern established by the Russian translation (PR #660).

**Architecture:** The i18n system uses i18next with JSON namespace files per language. Adding a language requires: (1) creating 6 translation JSON files, (2) registering "nl" in all language lists across backend, frontend, scripts, and tests, (3) updating documentation.

**Tech Stack:** i18next, react-i18next, Python/Pydantic (backend validation), Mantine Select (UI)

---

## Edge Cases & Gotchas

1. **Dutch-specific characters**: Dutch uses ë, ï, é, ö, ü (e.g., "geïmmuniseerd", "patiënt"). All JSON files are UTF-8 so this is fine, but translations must use correct diacritics.
2. **Formal vs informal**: Dutch has formal "u" and informal "je/jij". Medical apps should use formal "u" consistently.
3. **Compound words**: Dutch has very long compound words (e.g., "bloeddrukwaarde"). UI may need to handle overflow for labels/buttons.
4. **Date format**: Dutch uses DD-MM-YYYY (dmy format) — already supported via the existing `dmy` date format option. No new date format needed.
5. **Number formatting**: Dutch uses comma for decimals (3,5 kg) and period for thousands (1.000). This is handled by the browser's `Intl` API when locale is set, but verify the app doesn't hardcode decimal points.
6. **PDF generation**: DejaVu Sans font already supports Dutch diacritics (Latin Extended). No font changes needed.
7. **Plural forms**: Dutch has 2 plural forms (same as English: singular/plural). i18next handles this natively. Verify plural keys use `_one`/`_other` suffixes where needed.
8. **"nl" vs "nl-NL" vs "nl-BE"**: The app uses `load: 'languageOnly'`, so `nl-NL` and `nl-BE` browser locales will both resolve to `nl`. We use standard Dutch (Netherlands), not Belgian Dutch (Flemish). This is correct — differences are minor (like British vs American English).
9. **Browser language detection**: Users with Dutch browser locale will auto-detect `nl` once added. Before this PR, they'd fall back to English — no migration needed.
10. **SUPPORTED_LANGUAGES duplication**: The language list is defined in 7 separate locations. All must be updated atomically to avoid validation mismatches.

---

## All Files to Touch (Checklist)

**Create (6 files):**
- `frontend/public/locales/nl/admin.json`
- `frontend/public/locales/nl/common.json`
- `frontend/public/locales/nl/errors.json`
- `frontend/public/locales/nl/medical.json`
- `frontend/public/locales/nl/navigation.json`
- `frontend/public/locales/nl/notifications.json`

**Modify (7 files):**
- `app/schemas/user_preferences.py:9` — add `"nl"` to `SUPPORTED_LANGUAGES`
- `frontend/src/components/shared/LanguageSwitcher.tsx:20-28` — add Dutch entry to `LANGUAGES`
- `frontend/src/contexts/UserPreferencesContext.jsx:14` — add `"nl"` to `SUPPORTED_LANGUAGES`
- `frontend/scripts/check-translations.js:25` — add `"nl"` to `ALL_LOCALES`
- `frontend/scripts/check-exposed-keys.js:34` — add `"nl"` to `ALL_LOCALES`
- `frontend/src/__tests__/localization/translationKeys.test.js:59` — add `"nl"` to `locales`
- `tests/api/test_user_preferences_language.py:210` — add `"nl"` to `supported_languages`

**Update docs (3 files):**
- `docs/developer-guide/00-quickstart.md:307` — change "7 languages" to "8 languages"
- `docs/developer-guide/01-architecture.md:29` — add `nl` to language list
- `docs/wiki/FAQ.md:89` — add "Dutch" to the list

---

## Task 1: Create Dutch locale directory and translation files

This is the bulk of the work. Each namespace JSON file must be translated from the English source.

**Files:**
- Source: `frontend/public/locales/en/*.json` (6 files, ~6311 lines total)
- Create: `frontend/public/locales/nl/admin.json`
- Create: `frontend/public/locales/nl/common.json`
- Create: `frontend/public/locales/nl/errors.json`
- Create: `frontend/public/locales/nl/medical.json`
- Create: `frontend/public/locales/nl/navigation.json`
- Create: `frontend/public/locales/nl/notifications.json`

**Step 1: Create the nl locale directory**

```bash
mkdir -p frontend/public/locales/nl
```

**Step 2: Translate each namespace file**

For each of the 6 English source files, create the Dutch equivalent. The JSON structure (keys) must be identical to the English version — only the values change.

Translation guidelines:
- Use formal Dutch ("u" not "je/jij") throughout — this is a medical application
- Use correct Dutch diacritics (ë, ï, é, ö, ü)
- Keep interpolation variables like `{{name}}`, `{{count}}`, `{{date}}` untouched
- Keep HTML tags like `<strong>`, `<br/>` untouched
- Translate plural forms using i18next conventions (`_one`, `_other`)
- Medical terminology should use standard Dutch medical terms (e.g., "bloeddruk" not "tensie")
- Abbreviations (BMI, DNA, etc.) stay in English/Latin as is standard in Dutch medical practice

Process per file:
1. Read the English source file
2. Create Dutch translation with identical key structure
3. Verify the JSON is valid (`node -e "JSON.parse(require('fs').readFileSync('path'))"`)

**Step 3: Run translation checker to verify completeness**

```bash
cd frontend && npm run i18n:check -- --locale nl
```

Expected: 0 missing keys, 0 extra keys, 0 empty values for all 6 namespaces.

---

## Task 2: Register Dutch in backend validation

**Files:**
- Modify: `app/schemas/user_preferences.py:9`

**Step 1: Add "nl" to SUPPORTED_LANGUAGES**

In `app/schemas/user_preferences.py`, change line 9:

```python
# Before:
SUPPORTED_LANGUAGES = ["en", "fr", "de", "es", "it", "pt", "ru"]

# After:
SUPPORTED_LANGUAGES = ["en", "fr", "de", "es", "it", "pt", "ru", "nl"]
```

**Step 2: Run backend tests to verify**

```bash
python -m pytest tests/api/test_user_preferences_language.py -v
```

Expected: All existing tests pass. The `test_supported_languages_list` test will fail because it hardcodes the old list — that gets fixed in Task 6.

---

## Task 3: Register Dutch in frontend LanguageSwitcher

**Files:**
- Modify: `frontend/src/components/shared/LanguageSwitcher.tsx:20-28`

**Step 1: Add Dutch entry to LANGUAGES array**

In `LanguageSwitcher.tsx`, add after the Russian entry (line 27):

```typescript
// Before:
  { value: 'ru', label: 'Русский', shortLabel: 'RU' },
];

// After:
  { value: 'ru', label: 'Русский', shortLabel: 'RU' },
  { value: 'nl', label: 'Nederlands', shortLabel: 'NL' },
];
```

---

## Task 4: Register Dutch in UserPreferencesContext

**Files:**
- Modify: `frontend/src/contexts/UserPreferencesContext.jsx:14`

**Step 1: Add "nl" to SUPPORTED_LANGUAGES**

```javascript
// Before:
const SUPPORTED_LANGUAGES = ['en', 'fr', 'de', 'es', 'it', 'pt', 'ru'];

// After:
const SUPPORTED_LANGUAGES = ['en', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'nl'];
```

---

## Task 5: Register Dutch in i18n validation scripts

**Files:**
- Modify: `frontend/scripts/check-translations.js:25`
- Modify: `frontend/scripts/check-exposed-keys.js:34`

**Step 1: Update check-translations.js**

```javascript
// Before:
const ALL_LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt', 'ru'];

// After:
const ALL_LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt', 'ru', 'nl'];
```

**Step 2: Update check-exposed-keys.js**

```javascript
// Before:
const ALL_LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt', 'ru'];

// After:
const ALL_LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt', 'ru', 'nl'];
```

**Step 3: Run both scripts to verify Dutch is now checked**

```bash
cd frontend && npm run i18n:check -- --locale nl
node scripts/check-exposed-keys.js --locale nl
```

Expected: Both scripts recognize `nl` and report results.

---

## Task 6: Update tests

**Files:**
- Modify: `frontend/src/__tests__/localization/translationKeys.test.js:59`
- Modify: `tests/api/test_user_preferences_language.py:210`

**Step 1: Update frontend localization test**

```javascript
// Before:
const locales = ['en', 'de', 'es', 'fr', 'it', 'pt', 'ru'];

// After:
const locales = ['en', 'de', 'es', 'fr', 'it', 'pt', 'ru', 'nl'];
```

**Step 2: Update backend language test**

In `tests/api/test_user_preferences_language.py`, update line 210:

```python
# Before:
supported_languages = ["en", "fr", "de", "es", "it", "pt", "ru"]

# After:
supported_languages = ["en", "fr", "de", "es", "it", "pt", "ru", "nl"]
```

Also add a dedicated Dutch test case. Search the file for the pattern of individual language tests (e.g., `test_update_language_to_russian`) and add:

```python
def test_update_language_to_dutch(
    self, client, test_user_with_token
):
    """Test updating language preference to Dutch."""
    token = test_user_with_token["token"]
    response = client.put(
        "/api/v1/users/me/preferences",
        json={"language": "nl"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "nl"
```

**Step 3: Run all tests**

```bash
# Backend tests
python -m pytest tests/api/test_user_preferences_language.py -v

# Frontend tests
cd frontend && npx jest src/__tests__/localization/translationKeys.test.js --verbose
```

Expected: All tests pass including the new Dutch test.

---

## Task 7: Update documentation

**Files:**
- Modify: `docs/developer-guide/00-quickstart.md:307`
- Modify: `docs/developer-guide/01-architecture.md:29`
- Modify: `docs/wiki/FAQ.md:89`

**Step 1: Update quickstart.md**

```markdown
# Before (line 307):
│   ├── i18n/              # Localization (7 languages)

# After:
│   ├── i18n/              # Localization (8 languages)
```

**Step 2: Update architecture.md**

```markdown
# Before (line 29):
- **Localization**: i18next (7 languages: en, fr, de, es, it, pt, ru)

# After:
- **Localization**: i18next (8 languages: en, fr, de, es, it, pt, ru, nl)
```

**Step 3: Update FAQ.md**

```markdown
# Before (line 89):
Yes. MediKeep supports 7 languages: English, French, German, Spanish, Italian, Portuguese, and Russian.

# After:
Yes. MediKeep supports 8 languages: English, French, German, Spanish, Italian, Portuguese, Russian, and Dutch.
```

---

## Task 8: Final verification

**Step 1: Run the full i18n check**

```bash
cd frontend && npm run i18n:check
```

Expected: All 8 languages pass with 0 missing keys.

**Step 2: Run exposed keys check**

```bash
cd frontend && node scripts/check-exposed-keys.js
```

Expected: No exposed keys for Dutch.

**Step 3: Run full backend test suite**

```bash
python -m pytest tests/api/test_user_preferences_language.py -v
```

Expected: All tests pass (including new Dutch test).

**Step 4: Run frontend localization tests**

```bash
cd frontend && npx jest src/__tests__/localization/ --verbose
```

Expected: All tests pass.

**Step 5: Manual smoke test (if running locally)**

1. Start the app
2. Go to Settings → Language
3. Select "Nederlands (NL)" from dropdown
4. Verify UI switches to Dutch
5. Navigate through key pages: Dashboard, Medical Records, Settings
6. Verify no untranslated keys appear (shown as raw keys like `common.button.save`)
7. Check that date formatting works correctly
8. Verify PDF export renders Dutch text with correct diacritics

---

## Summary

| Task | Description | Files | Effort |
|------|-------------|-------|--------|
| 1 | Create 6 Dutch translation JSON files | 6 new | Large (translation work) |
| 2 | Register in backend validation | 1 modified | Small |
| 3 | Register in LanguageSwitcher | 1 modified | Small |
| 4 | Register in UserPreferencesContext | 1 modified | Small |
| 5 | Register in validation scripts | 2 modified | Small |
| 6 | Update tests | 2 modified | Small |
| 7 | Update documentation | 3 modified | Small |
| 8 | Final verification | — | Medium |
| **Total** | | **6 new + 10 modified** | |
