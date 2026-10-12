import type { ComponentProps } from 'react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Tabs } from '@mantine/core';
import { IconPill, IconScissors } from '@tabler/icons-react';

import render, { act, screen } from '../../../test-utils/render';
import CollapsibleLinkTabs from '../CollapsibleLinkTabs';
import {
  LINK_TAB_LOADING_DEADLINE_MS,
  linkTabMode,
  type LinkTabItem,
} from '../LinkTabMenu';

/** A number, undefined (unknown, its load failed) or 'loading' (still on its way) */
type TestCount = number | undefined | 'loading';

const countProps = (count: TestCount) => ({
  count: typeof count === 'number' ? count : undefined,
  loading: count === 'loading',
});

const items = (counts: TestCount[]): LinkTabItem[] => [
  {
    key: 'procedures',
    label: 'Procedures',
    icon: IconScissors,
    ...countProps(counts[0]),
  },
  {
    key: 'medications',
    label: 'Medications',
    icon: IconPill,
    ...countProps(counts[1]),
  },
];

const renderTabs = (
  counts: TestCount[],
  mode: 'view' | 'add' | 'edit',
  onSelectTab?: (_tab: string) => void,
  activeTab?: string
) => {
  const tree = (c: TestCount[], active = activeTab) => (
    <Tabs value="procedures">
      <Tabs.List>
        <CollapsibleLinkTabs
          {...({
            items: items(c),
            mode,
            activeTab: active,
            onSelectTab,
          } as ComponentProps<typeof CollapsibleLinkTabs>)}
        />
      </Tabs.List>
    </Tabs>
  );
  const result = render(tree(counts));
  return {
    ...result,
    rerenderWith: (c: TestCount[], active = activeTab) =>
      result.rerender(tree(c, active)),
  };
};

const menuButton = () =>
  screen
    .getAllByRole('button', { name: 'common:buttons.link' })
    .find(button => button.hasAttribute('aria-haspopup')) as HTMLElement;

describe('linkTabMode', () => {
  it('is view in a read-only dialog, edit for a saved record, add for a new one', () => {
    expect(linkTabMode(true, true)).toBe('view');
    expect(linkTabMode(true, false)).toBe('view');
    expect(linkTabMode(false, true)).toBe('edit');
    expect(linkTabMode(undefined, false)).toBe('add');
  });
});

describe('CollapsibleLinkTabs', () => {
  it('view: shows only types with links, with their counts, and no Link menu', () => {
    renderTabs([2, 0], 'view');
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Procedures (2)',
    ]);
    expect(
      screen.queryByRole('button', { name: 'common:buttons.link' })
    ).toBeNull();
  });

  it('view: a type whose count is not known keeps its tab, without a number', () => {
    renderTabs([undefined, 1], 'view');
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Procedures',
      'Medications (1)',
    ]);
  });

  it('view: a type known to have no links has no tab once its count is loaded', () => {
    const { rerenderWith } = renderTabs([undefined, 1], 'view');
    rerenderWith([0, 1]);
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Medications (1)',
    ]);
  });

  it('add: a type whose count is not known has no tab', () => {
    renderTabs([undefined, 1], 'add', vi.fn(), 'procedures-none');
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Medications (1)',
    ]);
  });

  it('edit: shows every type, zero included, and no Link menu', () => {
    renderTabs([0, 0], 'edit');
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Procedures (0)',
      'Medications (0)',
    ]);
    expect(
      screen.queryByRole('button', { name: 'common:buttons.link' })
    ).toBeNull();
  });

  it('add: lists the types without links in the Link menu, and picking one asks to open it', async () => {
    const onSelectTab = vi.fn();
    renderTabs([1, 0], 'add', onSelectTab);
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Procedures (1)',
    ]);

    await userEvent.click(menuButton());
    const items = await screen.findAllByRole('menuitem', { hidden: true });
    expect(items.map(item => item.textContent)).toEqual(['Medications']);
    await userEvent.click(items[0]);

    expect(onSelectTab).toHaveBeenCalledWith('medications');
  });

  it('add: a type opened from the Link menu is a tab only while it is open', async () => {
    const { rerenderWith } = renderTabs(
      [1, 0],
      'add',
      undefined,
      'medications'
    );
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Procedures (1)',
      'Medications (0)',
    ]);

    // Left without linking anything: back into the Link menu, not an empty (0) tab
    rerenderWith([1, 0], 'procedures');
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Procedures (1)',
    ]);
    await userEvent.click(menuButton());
    expect(
      (await screen.findAllByRole('menuitem')).map(item => item.textContent)
    ).toEqual(['Medications']);
  });

  it('add: an opened type that gets a link stays a tab after the user leaves it', () => {
    const { rerenderWith } = renderTabs(
      [1, 0],
      'add',
      undefined,
      'medications'
    );
    rerenderWith([1, 2], 'procedures');
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Procedures (1)',
      'Medications (2)',
    ]);
  });

  it('view: the open tab stays even without links; the other types follow their counts', () => {
    renderTabs([0, 0], 'view', undefined, 'medications');
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Medications (0)',
    ]);
  });

  it('view: no tab is shown while a count is loading, then all of them appear together', () => {
    const { rerenderWith } = renderTabs([2, 'loading'], 'view');
    expect(screen.queryAllByRole('tab')).toHaveLength(0);

    rerenderWith([2, 0]);
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Procedures (2)',
    ]);
  });

  it('view: the open tab is shown while the counts load', () => {
    renderTabs([0, 'loading'], 'view', undefined, 'medications');
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Medications',
    ]);
  });

  it('view: a count that never arrives does not hide the links for good', () => {
    vi.useFakeTimers();
    try {
      renderTabs([2, 'loading'], 'view');
      expect(screen.queryAllByRole('tab')).toHaveLength(0);

      act(() => {
        vi.advanceTimersByTime(LINK_TAB_LOADING_DEADLINE_MS);
      });

      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
        'Procedures (2)',
        'Medications',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('view: the deadline does not start while nothing is loading', () => {
    vi.useFakeTimers();
    try {
      renderTabs([2, 0], 'view');
      act(() => {
        vi.advanceTimersByTime(LINK_TAB_LOADING_DEADLINE_MS * 2);
      });
      expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
        'Procedures (2)',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('edit and add do not wait for counts', () => {
    const edit = renderTabs([0, 'loading'], 'edit');
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    edit.unmount();

    renderTabs([1, 'loading'], 'add', vi.fn());
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Procedures (1)',
    ]);
  });

  it('add: the Link button is styled like the tabs, not as a primary-color button', () => {
    renderTabs([1, 0], 'add');
    const button = menuButton();
    // The class gives it the tabs' text color and hover background in both color schemes
    expect(button).toHaveClass('link-tab-menu-button');
    expect(button).toHaveAttribute('data-variant', 'transparent');
  });

  it('add: no Link menu once every type is shown', () => {
    renderTabs([1, 3], 'add');
    expect(
      screen.queryByRole('button', { name: 'common:buttons.link' })
    ).toBeNull();
  });

  it('view: a type whose last link is removed is no longer a tab', () => {
    const { rerenderWith } = renderTabs([1, 0], 'view');
    expect(
      screen.getByRole('tab', { name: 'Procedures (1)' })
    ).toBeInTheDocument();
    rerenderWith([0, 0]);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });
});
