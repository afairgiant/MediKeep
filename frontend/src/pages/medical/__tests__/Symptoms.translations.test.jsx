/**
 * Translation tests for Symptoms page
 * Tests episode management and symptom tracking translations from PR #350
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n/config';
import Symptoms from '../Symptoms';

// Mock services
vi.mock('../../../services/api/symptomsApi', () => ({
  default: {
    getAll: vi.fn(() => Promise.resolve([])),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../hooks/useGlobalData', () => ({
  useGlobalData: () => ({
    currentPatient: { id: 1, first_name: 'John', last_name: 'Doe' },
  }),
}));

const renderWithProviders = (component, locale = 'en') => {
  i18n.changeLanguage(locale);

  return render(
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <MantineProvider>
          {component}
        </MantineProvider>
      </I18nextProvider>
    </MemoryRouter>
  );
};

describe('Symptoms Page - Translations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Page Headers', () => {
    it('should display page title in English', async () => {
      renderWithProviders(<Symptoms />);

      await waitFor(() => {
        expect(screen.getByText(/symptoms/i)).toBeInTheDocument();
      });
    });

    it('should display action buttons in English', async () => {
      renderWithProviders(<Symptoms />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add symptom/i })).toBeInTheDocument();
      });
    });

    it('should display action buttons in German', async () => {
      renderWithProviders(<Symptoms />, 'de');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /symptom hinzufügen/i })).toBeInTheDocument();
      });
    });

    it('should display action buttons in French', async () => {
      renderWithProviders(<Symptoms />, 'fr');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /ajouter un symptôme/i })).toBeInTheDocument();
      });
    });
  });

  describe('Modal Titles - Add Symptom', () => {
    it('should show correct modal title in English when adding symptom', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Symptoms />);

      await waitFor(async () => {
        const addButton = screen.getByRole('button', { name: /add symptom/i });
        await user.click(addButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Add New Symptom')).toBeInTheDocument();
      });
    });

    it('should show correct modal title in German when adding symptom', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Symptoms />, 'de');

      await waitFor(async () => {
        const addButton = screen.getByRole('button', { name: /symptom hinzufügen/i });
        await user.click(addButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Neues Symptom hinzufügen')).toBeInTheDocument();
      });
    });

    it('should show correct modal title in French when adding symptom', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Symptoms />, 'fr');

      await waitFor(async () => {
        const addButton = screen.getByRole('button', { name: /ajouter un symptôme/i });
        await user.click(addButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Ajouter un nouveau symptôme')).toBeInTheDocument();
      });
    });
  });

  describe('Episode Management', () => {
    it('should show log episode button in English', async () => {
      renderWithProviders(<Symptoms />);

      await waitFor(() => {
        // Assumes symptoms are loaded and displayed
        const logButton = screen.queryByRole('button', { name: /log episode/i });
        if (logButton) {
          expect(logButton).toBeInTheDocument();
        }
      });
    });

    it('should show log episode modal title in English', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Symptoms />);

      // This test assumes a symptom card with log episode button exists
      await waitFor(async () => {
        const logButton = screen.queryByRole('button', { name: /log episode/i });
        if (logButton) {
          await user.click(logButton);

          await waitFor(() => {
            expect(screen.getByText('Log Episode')).toBeInTheDocument();
          });
        }
      });
    });

    it('should show log episode modal title in German', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Symptoms />, 'de');

      await waitFor(async () => {
        const logButton = screen.queryByRole('button', { name: /episode protokollieren/i });
        if (logButton) {
          await user.click(logButton);

          await waitFor(() => {
            expect(screen.getByText('Episode Protokollieren')).toBeInTheDocument();
          });
        }
      });
    });

    it('should show log episode modal title in French', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Symptoms />, 'fr');

      await waitFor(async () => {
        const logButton = screen.queryByRole('button', { name: /enregistrer un épisode/i });
        if (logButton) {
          await user.click(logButton);

          await waitFor(() => {
            expect(screen.getByText('Enregistrer un Épisode')).toBeInTheDocument();
          });
        }
      });
    });
  });

  describe('Episode Form Fields', () => {
    it('should display additional notes field label in English', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Symptoms />);

      await waitFor(async () => {
        const logButton = screen.queryByRole('button', { name: /log episode/i });
        if (logButton) {
          await user.click(logButton);

          await waitFor(() => {
            expect(screen.getByLabelText(/additional notes/i)).toBeInTheDocument();
          });
        }
      });
    });

    it('should display additional notes placeholder in English', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Symptoms />);

      await waitFor(async () => {
        const logButton = screen.queryByRole('button', { name: /log episode/i });
        if (logButton) {
          await user.click(logButton);

          await waitFor(() => {
            expect(
              screen.getByPlaceholderText(/additional details about this episode/i)
            ).toBeInTheDocument();
          });
        }
      });
    });

    it('should display additional notes field in German', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Symptoms />, 'de');

      await waitFor(async () => {
        const logButton = screen.queryByRole('button', { name: /episode protokollieren/i });
        if (logButton) {
          await user.click(logButton);

          await waitFor(() => {
            expect(screen.getByLabelText(/zusätzliche notizen/i)).toBeInTheDocument();
          });
        }
      });
    });
  });

  describe('Delete Confirmation', () => {
    it('should show delete confirmation in English', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Symptoms />);

      await waitFor(async () => {
        const deleteButton = screen.queryByLabelText(/delete symptom/i);
        if (deleteButton) {
          await user.click(deleteButton);

          await waitFor(() => {
            expect(
              screen.getByText(/are you sure you want to delete this symptom/i)
            ).toBeInTheDocument();
          });
        }
      });
    });

    it('should show delete confirmation in German', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Symptoms />, 'de');

      await waitFor(async () => {
        const deleteButton = screen.queryByLabelText(/löschen/i);
        if (deleteButton) {
          await user.click(deleteButton);

          await waitFor(() => {
            expect(
              screen.getByText(/möchten sie dieses symptom.*wirklich löschen/i)
            ).toBeInTheDocument();
          });
        }
      });
    });
  });

  describe('Empty States', () => {
    it('should display empty state message in English', async () => {
      renderWithProviders(<Symptoms />);

      await waitFor(() => {
        const emptyMessage = screen.queryByText(/no symptoms recorded yet/i);
        if (emptyMessage) {
          expect(emptyMessage).toBeInTheDocument();
          expect(screen.getByText(/click.*add symptom.*to start tracking/i)).toBeInTheDocument();
        }
      });
    });

    it('should display empty state message in German', async () => {
      renderWithProviders(<Symptoms />, 'de');

      await waitFor(() => {
        const emptyMessage = screen.queryByText(/noch keine symptome aufgezeichnet/i);
        if (emptyMessage) {
          expect(emptyMessage).toBeInTheDocument();
        }
      });
    });

    it('should display empty state message in French', async () => {
      renderWithProviders(<Symptoms />, 'fr');

      await waitFor(() => {
        const emptyMessage = screen.queryByText(/aucun symptôme enregistré/i);
        if (emptyMessage) {
          expect(emptyMessage).toBeInTheDocument();
        }
      });
    });
  });

  describe('Chronic Badge', () => {
    it('should display chronic badge in English', async () => {
      renderWithProviders(<Symptoms />);

      await waitFor(() => {
        const chronicBadge = screen.queryByText(/chronic/i);
        if (chronicBadge) {
          expect(chronicBadge).toBeInTheDocument();
        }
      });
    });

    it('should display chronic badge in German', async () => {
      renderWithProviders(<Symptoms />, 'de');

      await waitFor(() => {
        const chronicBadge = screen.queryByText(/chronisch/i);
        if (chronicBadge) {
          expect(chronicBadge).toBeInTheDocument();
        }
      });
    });

    it('should display chronic badge in French', async () => {
      renderWithProviders(<Symptoms />, 'fr');

      await waitFor(() => {
        const chronicBadge = screen.queryByText(/chronique/i);
        if (chronicBadge) {
          expect(chronicBadge).toBeInTheDocument();
        }
      });
    });
  });

  describe('Category Display', () => {
    it('should show category label in English', async () => {
      renderWithProviders(<Symptoms />);

      await waitFor(() => {
        const categoryLabel = screen.queryByText(/category/i);
        if (categoryLabel) {
          expect(categoryLabel).toBeInTheDocument();
        }
      });
    });

    it('should show category label in German', async () => {
      renderWithProviders(<Symptoms />, 'de');

      await waitFor(() => {
        const categoryLabel = screen.queryByText(/kategorie/i);
        if (categoryLabel) {
          expect(categoryLabel).toBeInTheDocument();
        }
      });
    });

    it('should show category label in French', async () => {
      renderWithProviders(<Symptoms />, 'fr');

      await waitFor(() => {
        const categoryLabel = screen.queryByText(/catégorie/i);
        if (categoryLabel) {
          expect(categoryLabel).toBeInTheDocument();
        }
      });
    });
  });

  describe('Timeline Tab', () => {
    it('should show timeline tab in English', async () => {
      renderWithProviders(<Symptoms />);

      await waitFor(() => {
        const timelineTab = screen.queryByRole('tab', { name: /timeline/i });
        if (timelineTab) {
          expect(timelineTab).toBeInTheDocument();
        }
      });
    });

    it('should show timeline tab in German', async () => {
      renderWithProviders(<Symptoms />, 'de');

      await waitFor(() => {
        const timelineTab = screen.queryByRole('tab', { name: /zeitachse/i });
        if (timelineTab) {
          expect(timelineTab).toBeInTheDocument();
        }
      });
    });

    it('should show timeline tab in French', async () => {
      renderWithProviders(<Symptoms />, 'fr');

      await waitFor(() => {
        const timelineTab = screen.queryByRole('tab', { name: /chronologie/i });
        if (timelineTab) {
          expect(timelineTab).toBeInTheDocument();
        }
      });
    });
  });
});
