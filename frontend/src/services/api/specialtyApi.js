import { apiService } from './index';
import logger from '../logger';

const LEGACY_LOCALSTORAGE_KEY = 'customMedicalSpecialties';
const MIGRATION_FLAG_KEY = 'customMedicalSpecialtiesMigratedAt';

class SpecialtyApi {
  async list() {
    return apiService.get('/medical-specialties/');
  }

  async create({ name, description }) {
    return apiService.post('/medical-specialties/', {
      name,
      description: description || null,
      is_active: true,
    });
  }

  /**
   * Promote any specialty names left in the legacy
   * ``customMedicalSpecialties`` localStorage key into real DB rows.
   *
   * Pre-PR2 the practitioner combobox cached user-typed values there as a
   * frontend fallback; after PR2 the dropdown reads exclusively from the
   * DB, so those entries would vanish unless we backfill them. Runs at
   * most once per browser (guarded by ``MIGRATION_FLAG_KEY``) and is
   * safe if the key is absent or malformed.
   */
  async migrateLegacyCustomSpecialties() {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(MIGRATION_FLAG_KEY)) return;

    const raw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    const markComplete = () => {
      localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY);
      localStorage.setItem(MIGRATION_FLAG_KEY, new Date().toISOString());
    };

    if (!raw) {
      markComplete();
      return;
    }

    let names;
    try {
      names = JSON.parse(raw);
    } catch {
      markComplete();
      return;
    }
    if (!Array.isArray(names) || names.length === 0) {
      markComplete();
      return;
    }

    let migrated = 0;
    for (const rawName of names) {
      const name = typeof rawName === 'string' ? rawName.trim() : '';
      if (!name) continue;
      try {
        await this.create({ name });
        migrated += 1;
      } catch (err) {
        // Abort on auth failure so we retry next time the user loads the
        // app while authenticated. All other errors are per-item and
        // shouldn't prevent the remaining names from migrating.
        if (err?.message?.includes('401')) {
          return;
        }
        logger.warn(
          'legacy_specialty_migration_item_failed',
          'Failed to migrate a legacy specialty',
          { name, error: err.message, component: 'SpecialtyApi' }
        );
      }
    }

    logger.info(
      'legacy_specialty_migration_complete',
      'Migrated legacy custom specialties from localStorage',
      { migrated, total: names.length, component: 'SpecialtyApi' }
    );
    markComplete();
  }
}

const specialtyApi = new SpecialtyApi();
export default specialtyApi;
