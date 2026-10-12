import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Tabs } from '@mantine/core';
import '@testing-library/jest-dom';

import render, { act, screen, waitFor } from '../../../test-utils/render';
import RecordLinkTabButtons from '../RecordLinkTabButtons';
import type { RecordLinkPath } from '../../../constants/recordLinkKinds';
import type { PendingLink } from '../../../types/encounterLinks';

const api = vi.hoisted(() => ({
  getRecordEncounterLinks: vi.fn(),
  getRecordLabResultLinks: vi.fn(),
  getConditionMedicationLinks: vi.fn(),
  getMedicationConditions: vi.fn(),
}));
vi.mock('../../../services/api', () => ({ apiService: api }));

const pending = (n: number): PendingLink[] =>
  Array.from({ length: n }, (_, index) => ({
    entityId: index + 1,
    relevanceNote: null,
    purpose: null,
  }));

const renderTabs = (
  recordPath: RecordLinkPath,
  props: Partial<ComponentProps<typeof RecordLinkTabButtons>> = {}
) =>
  render(
    <Tabs value="x">
      <Tabs.List>
        <RecordLinkTabButtons
          {...({ recordPath, ...props } as ComponentProps<
            typeof RecordLinkTabButtons
          >)}
        />
      </Tabs.List>
    </Tabs>
  );

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset().mockResolvedValue([]));
});

describe('RecordLinkTabButtons - saved record', () => {
  it.each([
    [
      'conditions',
      'getConditionMedicationLinks',
      'shared:categories.medications',
    ],
    ['medications', 'getMedicationConditions', 'shared:categories.conditions'],
    ['medications', 'getRecordLabResultLinks', 'shared:tabs.labResults'],
    ['procedures', 'getRecordLabResultLinks', 'shared:tabs.labResults'],
    ['conditions', 'getRecordEncounterLinks', 'Visits'],
  ] as const)(
    'shows the number of links of a %s record before a tab is opened (%s)',
    async (path, method, label) => {
      api[method].mockResolvedValue([{ id: 1 }, { id: 2 }]);
      renderTabs(path, { recordId: 5 });
      expect(
        await screen.findByRole('tab', { name: `${label} (2)` })
      ).toBeInTheDocument();
    }
  );

  it('asks each API with the record id, and only for the kinds the record has', async () => {
    renderTabs('injuries', { recordId: 5 });
    await screen.findByRole('tab', { name: 'Visits (0)' });
    expect(api.getRecordEncounterLinks).toHaveBeenCalledWith(
      'injuries',
      5,
      expect.anything()
    );
    expect(api.getRecordLabResultLinks).not.toHaveBeenCalled();
    expect(api.getConditionMedicationLinks).not.toHaveBeenCalled();
    expect(api.getMedicationConditions).not.toHaveBeenCalled();
    expect(screen.queryByRole('tab', { name: /labResults/ })).toBeNull();
  });

  it('lists the kinds of a condition, medication and procedure in tab order', async () => {
    const order = async (path: RecordLinkPath) => {
      const { unmount } = renderTabs(path, { recordId: 5 });
      await screen.findAllByRole('tab');
      const names = screen.getAllByRole('tab').map(tab => tab.textContent);
      unmount();
      return names.map(name => name?.replace(/ \(\d+\)$/, ''));
    };
    expect(await order('conditions')).toEqual([
      'shared:categories.medications',
      'shared:tabs.labResults',
      'Visits',
    ]);
    expect(await order('medications')).toEqual([
      'shared:categories.conditions',
      'shared:tabs.labResults',
      'Visits',
    ]);
    expect(await order('procedures')).toEqual([
      'Visits',
      'shared:tabs.labResults',
    ]);
  });
});

describe('RecordLinkTabButtons - record not saved yet', () => {
  it('counts the chosen links of each kind and makes no API calls', () => {
    renderTabs('conditions', {
      pendingLinks: {
        medications: pending(1),
        labResults: pending(2),
        visits: pending(3),
      },
      activeTab: 'medications',
    });
    expect(
      screen.getByRole('tab', { name: 'shared:categories.medications (1)' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'shared:tabs.labResults (2)' })
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Visits (3)' })).toBeInTheDocument();
    Object.values(api).forEach(fn => expect(fn).not.toHaveBeenCalled());
  });

  it('shows only the kinds with links in the Add form', () => {
    renderTabs('medications', { pendingLinks: { conditions: pending(1) } });
    expect(
      screen.getByRole('tab', { name: 'shared:categories.conditions (1)' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /labResults/ })).toBeNull();
  });
});

describe('RecordLinkTabButtons - read-only dialog of a saved record', () => {
  const settled = async () => {
    await waitFor(() => expect(api.getRecordEncounterLinks).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
  };

  it('shows no tab until every count has loaded, then only the kinds with links', async () => {
    let resolveLabResults: (_rows: unknown[]) => void = () => undefined;
    api.getRecordLabResultLinks.mockReturnValue(
      new Promise<unknown[]>(resolve => (resolveLabResults = resolve))
    );
    api.getConditionMedicationLinks.mockResolvedValue([{ id: 1 }]);
    api.getRecordEncounterLinks.mockResolvedValue([]);
    renderTabs('conditions', { recordId: 5, isViewMode: true });

    // Medications already has a link, but its tab waits for the slowest count
    await settled();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);

    resolveLabResults([]);
    expect(
      await screen.findByRole('tab', {
        name: 'shared:categories.medications (1)',
      })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });

  it('keeps the tab of a kind whose count could not be loaded, without a number', async () => {
    api.getRecordLabResultLinks.mockRejectedValue(new Error('boom'));
    api.getConditionMedicationLinks.mockResolvedValue([]);
    api.getRecordEncounterLinks.mockResolvedValue([]);
    renderTabs('conditions', { recordId: 5, isViewMode: true });

    expect(
      await screen.findByRole('tab', { name: 'shared:tabs.labResults' })
    ).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(1);
  });

  it('shows no tab for a record without links', async () => {
    renderTabs('procedures', { recordId: 5, isViewMode: true });
    await settled();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('does not ask again for counts the edit form reuses after the view dialog', async () => {
    api.getRecordEncounterLinks.mockResolvedValue([{ id: 1 }]);
    const view = renderTabs('injuries', { recordId: 5, isViewMode: true });
    await screen.findByRole('tab', { name: 'Visits (1)' });
    view.unmount();

    renderTabs('injuries', {
      recordId: 5,
      activeTab: 'basic',
      onSelectTab: vi.fn(),
    });

    expect(
      await screen.findByRole('tab', { name: 'Visits (1)' })
    ).toBeInTheDocument();
    expect(api.getRecordEncounterLinks).toHaveBeenCalledTimes(1);
  });
});
