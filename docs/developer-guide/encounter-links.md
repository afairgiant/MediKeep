# Encounter (Visit) Links

A visit (encounter) can be linked to procedures, treatments, injuries, symptoms,
conditions, medications and lab results. Links are many-to-many and bi-directional:
they can be created, listed, edited (relevance note) and deleted from either the visit
or the linked record. Both sides read and write the same junction row.

## Data model

| Link | Table | Notes |
|------|-------|-------|
| Procedure | `encounter_procedures` | new |
| Symptom | `encounter_symptoms` | new |
| Injury | `encounter_injuries` | new |
| Medication | `encounter_medications` | new |
| Condition | `encounter_conditions` | new |
| Treatment | `treatment_encounters` | existing; `visit_label` / `visit_sequence` stay managed from the treatment side |
| Lab result | `encounter_lab_results` | existing; carries a `purpose` field |

New tables hold `encounter_id`, `<record>_id`, `relevance_note`, timestamps, a unique
constraint on the pair and `ON DELETE CASCADE` on both foreign keys. Models share
`EncounterLinkMixin` in `app/models/associations.py`. Migration: `7c1e4a9b2d35`.

`encounters.condition_id` (the visit's single primary condition) is a separate, older
field and is unrelated to `encounter_conditions`.

## API

Visit side (`{type}` is `procedures`, `symptoms`, `injuries`, `medications`,
`conditions` or `treatments`):

- `GET    /api/v1/encounters/{id}/{type}`
- `POST   /api/v1/encounters/{id}/{type}` body `{entity_id, relevance_note?}`
- `POST   /api/v1/encounters/{id}/{type}/bulk` body `{entity_ids, relevance_note?}`
- `PUT    /api/v1/encounters/{id}/{type}/{relationship_id}` body `{relevance_note?}`
- `DELETE /api/v1/encounters/{id}/{type}/{relationship_id}`

Record side (`procedures`, `symptoms`, `injuries`, `medications`, `conditions`):

- `GET    /api/v1/{type}/{id}/encounters`
- `POST   /api/v1/{type}/{id}/encounters` body `{encounter_id, relevance_note?}`
- `POST   /api/v1/{type}/{id}/encounters/bulk` body `{encounter_ids, relevance_note?}`
- `PUT    /api/v1/{type}/{id}/encounters/{relationship_id}` body `{relevance_note?}`
- `DELETE /api/v1/{type}/{id}/encounters/{relationship_id}`

Treatments and lab results keep their own record-side routes
(`/treatments/{id}/encounters`, `/lab-results/{id}/encounters`) because those links carry
extra fields. Lab results on the visit side still use `/encounters/{id}/lab-results`.

Responses use generic fields: `entity_id`, `entity_name`, `entity_date`,
`entity_status`, `encounter_reason`, `encounter_date`, `relevance_note`.

Rules:

- Writes need edit permission on the visit (visit side) or the record (record side);
  reads need view permission. Access denial is reported as 404, the app convention.
- The record and the visit must belong to the same patient (400 otherwise).
- A duplicate single create returns 400. Bulk create skips pairs that already exist and
  removes duplicate ids in the request.
- On the record side, a relationship id that belongs to a different record returns 400.
- Updates only change fields that are sent, so a visit-side note edit on a treatment link
  leaves `visit_label` and `visit_sequence` untouched.

## Code map

- Routes: `app/api/v1/endpoints/encounter_links.py` (factory driven by
  `ENCOUNTER_LINK_CONFIGS`); registered once on the encounters router and once on each
  record router.
- CRUD: `CRUDEncounterLink` in `app/crud/encounter.py`
- Schemas: `EncounterLink*` and `RecordEncounterLink*` in `app/schemas/encounter.py`
- Tests: `tests/api/test_encounter_links.py`
- Adding a type: add a junction model and migration entry, a CRUD instance, an
  `ENCOUNTER_LINK_CONFIGS` entry, and a `register_record_encounter_routes` call on the
  record's router.

## Frontend

There is no "Relationships" tab. Each kind of linked record has its own tab, like the
Treatment dialog: the card that links a record type lives in a tab named after it.

### Visit side

- Add, Edit and View have one tab per linked type: Procedures, Treatments, Injuries, Symptoms,
  Conditions, Medications and Lab Results (`VisitLinkTabButtons` / `VisitLinkTabPanels` in
  `components/medical/visits/VisitLinkTabs.tsx`).
  - View: read-only.
  - Edit: links are created, edited and removed immediately through the API.
  - Add: links are held in `formData.pending_links` and created after the visit is saved
    (`savePendingEncounterLinks` in `utils/encounterLinks.ts`). One warning is shown if any
    call fails; the visit itself is kept.
- A tab mounts its content only while it is open, so record lists are fetched on demand, and
  not at all in View mode.
- `components/shared/LinkedRecordsSection.tsx` is the live/pending engine shared with the
  record side; `LinkSection.tsx` is the list + modal it renders, in the same format as
  `MedicationRelationships`.
- `constants/encounterLinkTypes.ts`: one adapter per type (candidate lists, row normalization,
  bulk request body, `visitLinkSource`). Lab results use their older `lab_result_*` fields and
  carry `purpose`.
- API helpers: `getEncounterLinks`, `createEncounterLinksBulk`, `updateEncounterLink`,
  `deleteEncounterLink` in `services/api/index.js` (the `linkType` is the URL segment, e.g.
  `lab-results`).

### Record side

Procedures, injuries, symptoms, conditions and medications have a "Visits" tab (Add, Edit,
View). The same link can be created, viewed, edited and removed from either side.

- `components/shared/RecordVisitsTab.tsx`: the tab; takes `recordType` (the URL segment).
  `RecordVisitsCard.tsx` is the card itself.
- `constants/recordEncounterLinks.ts`: record-side adapters (`genericVisitLinkSource`,
  `labResultVisitLinkSource`).
- `utils/recordVisitLinks.ts`: saves the visits picked in an Add form after the record is
  created (`linkPendingVisitsOrWarn`). Pending visits live in `formData.pending_visit_links`
  and are never part of the create payload.
- API helpers: `getRecordEncounterLinks`, `createRecordEncounterLinksBulk`,
  `updateRecordEncounterLink`, `deleteRecordEncounterLink` in `services/api/index.js`.

### Medications, lab results and treatments

- **Medications** get a Visits tab next to the existing Conditions tab.
- **Lab results** (Advanced Add, Edit and View; the quick Simple Add dialog creates the result
  and hands off to the Edit form) have five tabs: Conditions, Visits, Medications, Procedures
  and Treatments (`labresults/LabResultLinkTabs.jsx`). The Visits tab is
  `RecordVisitsCard recordType="labResults"`; it uses the lab result's own routes and edits the
  link `purpose`. The other four tabs hold the existing sections unchanged. In Advanced Add the
  pending visits stay in the form's `pendingEncounters` (API field names) and are saved by the
  page.
- **Treatments** keep their own Visits tab (it edits `visit_label` and `visit_sequence`). The tab
  appears in Simple mode as well as Treatment Plan mode; in Simple mode its content mounts only
  while the tab is open.

## Creating a record from a link tab (inline create)

A link tab can create the record it links, from inside the dialog you are editing. "Add
Procedure" sits next to "Link" on the visit's Procedures tab, "Add Visit" on a record's Visits
tab. The new record is created, linked, and you stay on the same tab; nothing in the dialog
behind is lost.

Supported: Procedures, Injuries, Symptoms, Conditions, Medications, Treatments and Lab Results
(from a visit) and Visits (from a record, except on a Treatment). In a sub-dialog the form hides
all of its own link tabs (a Condition hides Medications, Lab Results and Visits; a Medication hides
Conditions and Visits; a Treatment hides Visits and, in Treatment Plan mode, its Medications,
Labs and Equipment tabs), so what you see is the record's own fields only.

Lab Results use the quick panel dialog (`TestPanelCreateDialog`) with the Simple/Advanced switch
hidden: a panel needs at least one test result, and there is no follow-on edit screen. The panel,
its test components and the link all exist by the time the dialog closes, so a failed link never
leads to a second panel being created.

How it works, and why:

- **App-level host** (`contexts/InlineCreateContext.tsx`, mounted in `App.jsx`). The create
  dialog is rendered outside every page and form. React events bubble through portals, so a
  dialog rendered inside the parent's `<form>` would submit the parent when you press Save or
  Enter; the entity forms do not stop that. The parent also stays mounted, so its tab, typed
  text and staged files are untouched. Only one create dialog is open at a time.
- **One level deep.** The host wraps its dialogs in `SubDialogContext`. Forms rendered in a
  sub-dialog hide their link tabs (`useSubDialog()`), and `LinkedRecordsSection` hides "Add ...",
  so a sub-dialog can never open another create dialog. Any new form gets this by calling
  `useSubDialog()`; it also supplies the stacking order (2050, above the forms at 2000 and below
  the "New practitioner" sub-modal at 2100 and dropdowns at 3000).
- **Escape.** Escape in a sub-dialog closes only that dialog (`utils/nestedDialogStack.ts`,
  `hooks/useNestedDialog.ts`; imported first in `index.jsx` so it runs before the modals' own
  handlers). Any dialog opened from another dialog should call `useNestedDialog`.
- **Order of steps** (`components/inlineCreate/useInlineCreateFlow.ts`): validate, create, link,
  upload staged files, close. A failure at create keeps the dialog and everything typed. A failure
  at link or upload shows a warning and keeps the record.
- **Parent not saved yet.** The record is created immediately, but its link is held as a pending
  link and saved with the parent. If the parent is then cancelled, the record stays.
- **No drift between page and dialog.** Each type's initial data, validation and API body live in
  `utils/<type>FormUtils.ts`, used by both the page and the create dialog. The bodies list their
  fields explicitly, so form-only state such as pending links is never sent to the API.

Adding a type: write `utils/<type>FormUtils.ts`, a thin `components/inlineCreate/<Type>CreateDialog.tsx`
using `useInlineCreateFlow`, one line in the registry in `InlineCreateContext.tsx`, an
`ADD_LABEL_KEYS` entry in `LinkedRecordsSection.tsx`, `createType` on the link config, `useSubDialog()`
in the form (hide link tabs, use `zIndex`), and the `inlineCreate.add.<type>` string in all locales.

## Counts on link tabs

Every link tab shows its count, like the Symptoms "Episodes (n)" tab: "Procedures (3)" on a
visit, "Visits (2)" on a record, and Conditions / Medications / Procedures / Treatments / Visits on
a lab result. A tab with nothing linked shows "(0)". A count that is not known yet (still loading,
or the load failed) shows the name alone.

- **Saved record:** the counts are loaded when the dialog opens, in parallel, one list request per
  type (7 for a visit, 1 for a record), so they are there before any tab is opened. The tab's panel
  keeps its count current when you add, remove or create links.
- **Unsaved record (Add form):** the count is the number of links chosen so far.
- **Where:** `utils/linkCountStore.ts` (a small store shared by a tab button and its panel, numbers
  only), `hooks/useTabLabel.ts`, `VisitLinkTabButtons` (visits), `RecordVisitsTabButton` (records),
  `LabResultLinkTabButtons` (lab results; the four older sections take their numbers from the page's
  per-lab-result link maps, which the dialog loads when it opens).
- **Not covered:** the Treatment dialog's own relationship tabs (they have their own count badges)
  and the Condition dialog's older Medications / Lab Results tabs.
