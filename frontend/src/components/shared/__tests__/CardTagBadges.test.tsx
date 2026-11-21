import { vi } from 'vitest';
import render, { screen } from '../../../test-utils/render';
import '@testing-library/jest-dom';
import CardTagBadges from '../CardTagBadges';

const getTagColor = vi.fn(() => 'blue');

describe('CardTagBadges', () => {
  it('shows the first two tags and a count for the rest', () => {
    render(
      <CardTagBadges
        tags={['fasting', 'annual', 'urgent', 'follow-up']}
        getTagColor={getTagColor}
      />
    );
    expect(screen.getByText('fasting')).toBeInTheDocument();
    expect(screen.getByText('annual')).toBeInTheDocument();
    expect(screen.queryByText('urgent')).not.toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('shows no count when there are two tags or fewer', () => {
    render(
      <CardTagBadges tags={['fasting', 'annual']} getTagColor={getTagColor} />
    );
    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument();
  });

  it.each([[[]], [null], [undefined]])('renders nothing for %p', tags => {
    render(
      <div data-testid="host">
        <CardTagBadges tags={tags} getTagColor={getTagColor} />
      </div>
    );
    expect(screen.getByTestId('host')).toBeEmptyDOMElement();
  });
});
