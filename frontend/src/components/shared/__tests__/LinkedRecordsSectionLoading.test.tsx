import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { IconScissors } from '@tabler/icons-react';

import render, { act, screen, waitFor } from '../../../test-utils/render';
import LinkedRecordsSection from '../LinkedRecordsSection';
import type { LinkRow, LinkSource } from '../../../types/encounterLinks';

vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const NONE = 'common:visits.relationships.none';
const LINK = 'common:buttons.link';

const ROW: LinkRow = {
  id: 1,
  targetId: 9,
  name: 'Knee scope',
  date: null,
  status: null,
  relevanceNote: null,
  purpose: null,
};

/** A source whose rows and candidates arrive when the test says so. */
const slowSource = () => {
  let resolveRows: (_rows: LinkRow[]) => void = () => undefined;
  let resolveCandidates: (_c: { id: number; label: string }[]) => void = () =>
    undefined;
  const source: LinkSource = {
    loadRows: vi.fn(
      () => new Promise<LinkRow[]>(resolve => (resolveRows = resolve))
    ),
    fetchCandidates: vi.fn(
      () =>
        new Promise<{ id: number; label: string }[]>(
          resolve => (resolveCandidates = resolve)
        )
    ),
    createLinks: vi.fn().mockResolvedValue(undefined),
    updateLink: vi.fn().mockResolvedValue(undefined),
    removeLink: vi.fn().mockResolvedValue(undefined),
  };
  return {
    source,
    resolveRows: (rows: LinkRow[]) => act(async () => resolveRows(rows)),
    resolveCandidates: (list: { id: number; label: string }[]) =>
      act(async () => resolveCandidates(list)),
  };
};

const renderSection = (
  source: LinkSource,
  props: { isViewMode?: boolean; isSaved?: boolean } = {}
) =>
  render(
    <LinkedRecordsSection
      title="Procedures"
      source={source}
      isSaved
      entityType="procedure"
      icon={IconScissors}
      color="grape"
      hideWhenEmpty={false}
      {...props}
    />
  );

describe('LinkedRecordsSection - loading keeps the layout', () => {
  it('does not say there are no links while the rows are still on their way', async () => {
    const { source, resolveRows } = slowSource();
    renderSection(source);

    expect(screen.queryByText(NONE)).toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();

    await resolveRows([]);
    expect(await screen.findByText(NONE)).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('shows the Link controls from the start in the Edit dialog, disabled until the rows arrive', async () => {
    const { source, resolveRows, resolveCandidates } = slowSource();
    renderSection(source);

    expect(screen.getByRole('button', { name: LINK })).toBeDisabled();

    await resolveCandidates([{ id: 3, label: 'Hip scope' }]);
    expect(screen.getByRole('button', { name: LINK })).toBeDisabled();

    await resolveRows([]);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: LINK })).toBeEnabled()
    );
  });

  it('has no controls in the read-only dialog, while loading or after', async () => {
    const { source, resolveRows } = slowSource();
    renderSection(source, { isViewMode: true });

    expect(screen.queryByRole('button', { name: LINK })).toBeNull();
    await resolveRows([ROW]);
    expect(await screen.findByText('Knee scope')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: LINK })).toBeNull();
  });

  it('shows the rows once they arrive', async () => {
    const { source, resolveRows } = slowSource();
    renderSection(source);

    await resolveRows([ROW]);

    expect(await screen.findByText('Knee scope')).toBeInTheDocument();
    expect(screen.queryByText(NONE)).toBeNull();
  });

  it('never shows the loading box for a record that is not saved yet', () => {
    const { source } = slowSource();
    renderSection(source, { isSaved: false });

    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    expect(screen.getByText(NONE)).toBeInTheDocument();
    expect(source.loadRows).not.toHaveBeenCalled();
  });

  it('stops loading when the rows cannot be read, instead of waiting forever', async () => {
    const source: LinkSource = {
      loadRows: vi.fn().mockRejectedValue(new Error('boom')),
      fetchCandidates: vi.fn().mockResolvedValue([]),
      createLinks: vi.fn(),
      updateLink: vi.fn(),
      removeLink: vi.fn(),
    };
    renderSection(source);

    expect(await screen.findByText('boom')).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });
});
