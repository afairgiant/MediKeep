import type { ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { IconHeart } from '@tabler/icons-react';
import VitalStatCard from './VitalStatCard';

const NORMAL = { level: 'normal', label: 'Normal' } as const;

const renderCard = (
  props: Partial<ComponentProps<typeof VitalStatCard>> = {}
) =>
  render(
    <MantineProvider>
      <VitalStatCard
        title="Heart Rate"
        description="Click to view trend analysis"
        icon={IconHeart}
        color="blue"
        value={72}
        unit="BPM"
        category={NORMAL}
        isSelected={false}
        onSelect={vi.fn()}
        {...props}
      />
    </MantineProvider>
  );

const getCard = () =>
  screen.getByRole('button', {
    name: 'Heart Rate. Click to view trend analysis',
  });

describe('VitalStatCard', () => {
  it('renders title, value and unit', () => {
    renderCard();

    expect(screen.getByText('Heart Rate')).toBeInTheDocument();
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('BPM')).toBeInTheDocument();
  });

  it('renders the category badge when a category is given', () => {
    renderCard({ category: { level: 'high', label: 'High' } });

    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it.each([
    ['high', 'Hoch', 'red'],
    ['low', 'Niedrig', 'orange'],
    ['normal', 'Normal', 'green'],
    ['high', 'Высокий', 'red'],
    ['low', 'ต่ำ', 'orange'],
  ] as const)(
    'colors a %s badge %s from its level, not its translated label (%s)',
    (level, label, color) => {
      renderCard({ category: { level, label } });

      const badge = screen.getByText(label).closest('.mantine-Badge-root');
      expect(badge?.getAttribute('style')).toContain(
        `--mantine-color-${color}-light`
      );
    }
  );

  it.each([null, undefined])(
    'renders no badge but keeps the badge slot when category is %s',
    category => {
      renderCard({ category });

      expect(screen.queryByText('Normal')).not.toBeInTheDocument();
      expect(
        screen.getByTestId('vital-stat-category-slot')
      ).toBeInTheDocument();
    }
  );

  it('reserves the same badge slot height with and without a category', () => {
    const { unmount } = renderCard({ category: NORMAL });
    const withBadge = screen.getByTestId('vital-stat-category-slot').style
      .height;
    unmount();

    renderCard({ category: null });
    const withoutBadge = screen.getByTestId('vital-stat-category-slot').style
      .height;

    expect(withBadge).toBeTruthy();
    expect(withoutBadge).toBe(withBadge);
  });

  it('omits the unit when none is given', () => {
    renderCard({ value: 'N/A', unit: undefined, category: null });

    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.queryByText('BPM')).not.toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    renderCard({ onSelect });

    fireEvent.click(getCard());

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it.each(['Enter', ' '])('calls onSelect when %j is pressed', key => {
    const onSelect = vi.fn();
    renderCard({ onSelect });

    fireEvent.keyDown(getCard(), { key });

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const onSelect = vi.fn();
    renderCard({ onSelect });

    fireEvent.keyDown(getCard(), { key: 'a' });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('exposes an accessible name and pressed state', () => {
    const { unmount } = renderCard({ isSelected: false });
    expect(getCard()).toHaveAttribute('aria-pressed', 'false');
    unmount();

    renderCard({ isSelected: true });
    expect(getCard()).toHaveAttribute('aria-pressed', 'true');
  });
});
