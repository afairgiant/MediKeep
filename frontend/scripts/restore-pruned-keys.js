#!/usr/bin/env node

/**
 * Restores domain-specific keys that were incorrectly pruned by the dedup script.
 * Reads values from the previous git commit (before dedup) and restores them.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const keysToRestore = [
  'common:search.types.encounters',
  'common:sidebarNav.sections.careAndTreatment',
  'common:sidebarNav.sections.misc',
  'common:sidebarNav.sections.tools',
  'common:sidebarNav.sections.administration',
  'notifications:toasts.settings.saved',
  'notifications:toasts.settings.saveFailed',
  'medical:allergies.severity.placeholder',
  'medical:conditions.diagnosis.label',
  'medical:conditions.severity.placeholder',
  'medical:emergencyContacts.form.name.label',
  'medical:emergencyContacts.form.relationship.label',
  'medical:emergencyContacts.form.address.label',
  'medical:familyHistory.form.condition.severity.label',
  'medical:familyHistory.form.condition.severity.placeholder',
  'medical:familyHistory.form.condition.status.placeholder',
  'medical:familyHistory.form.member.name.label',
  'medical:familyHistory.form.member.relationship.label',
  'medical:familyHistory.form.member.gender.label',
  'medical:immunizations.vaccineName.label',
  'medical:immunizations.doseNumber.label',
  'medical:immunizations.lotNumber.label',
  'medical:immunizations.manufacturer.label',
  'medical:injuries.practitioner.placeholder',
  'medical:insurance.form.expirationDate.label',
  'medical:insurance.form.status.placeholder',
  'medical:labResults.testName.label',
  'medical:labResults.orderingPractitioner.placeholder',
  'medical:labResults.testStatus.placeholder',
  'medical:labResults.additionalNotes.label',
  'medical:medications.dosage.label',
  'medical:medications.frequency.label',
  'medical:medications.route.label',
  'common:fields.startDate.label',
  'common:fields.endDate.label',
  'medical:medications.pharmacy.label',
  'medical:practitioners.form.name.label',
  'medical:procedures.procedureName.label',
  'medical:procedures.facility.label',
  'medical:procedures.practitioner.placeholder',
  'medical:procedures.complications.label',
  'medical:symptoms.occurrence.severity.placeholder',
  'medical:symptoms.occurrence.duration.label',
  'medical:symptoms.occurrence.location.label',
  'medical:symptoms.occurrence.additionalNotes.label',
  'medical:symptoms.parent.category.label',
  'medical:symptoms.parent.status.placeholder',
  'medical:treatments.mode.advancedOption',
  'medical:treatments.relatedCondition.label',
  'medical:treatments.treatmentStatus.placeholder',
  'medical:treatments.frequency.label',
  'medical:treatments.notes.label',
  'common:messages.unsavedChanges',
  'common:messages.saveSuccess',
];

const locales = ['en', 'de', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'sv'];

function flatten(obj, prefix = '') {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) Object.assign(result, flatten(v, key));
    else result[key] = v;
  }
  return result;
}

function setKeyPath(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// Group by namespace
const byNs = {};
for (const k of keysToRestore) {
  const colonIdx = k.indexOf(':');
  const ns = k.substring(0, colonIdx);
  const keyPath = k.substring(colonIdx + 1);
  if (!byNs[ns]) byNs[ns] = [];
  byNs[ns].push(keyPath);
}

let totalRestored = 0;

for (const locale of locales) {
  for (const [ns, keyPaths] of Object.entries(byNs)) {
    const relPath = `frontend/public/locales/${locale}/${ns}.json`;

    // Get pre-change version from previous commit
    let oldData;
    try {
      const oldContent = execSync(`git show HEAD~1:${relPath}`, { encoding: 'utf8' });
      oldData = flatten(JSON.parse(oldContent));
    } catch {
      try {
        const oldContent = execSync(`git show HEAD:${relPath}`, { encoding: 'utf8' });
        oldData = flatten(JSON.parse(oldContent));
      } catch {
        console.log(`  Skipping ${locale}/${ns}.json (not in git)`);
        continue;
      }
    }

    // Read current file
    const currentPath = path.join(__dirname, '..', 'public', 'locales', locale, `${ns}.json`);
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));

    let restored = 0;
    for (const keyPath of keyPaths) {
      if (oldData[keyPath] !== undefined) {
        setKeyPath(currentData, keyPath, oldData[keyPath]);
        restored++;
      }
    }

    if (restored > 0) {
      fs.writeFileSync(currentPath, JSON.stringify(currentData, null, 2) + '\n');
      totalRestored += restored;
    }
  }
  console.log(`${locale}: restored keys`);
}

console.log(`\nTotal: ${totalRestored} keys restored across ${locales.length} locales`);
