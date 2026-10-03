import { vi } from 'vitest';
import '@testing-library/jest-dom';

import render, { screen } from '../../../test-utils/render';
import InlineCreateErrorBoundary from '../InlineCreateErrorBoundary';

const notify = vi.hoisted(() => ({ notifyError: vi.fn() }));
vi.mock('../../../utils/notifyTranslated', () => notify);
vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const Boom = () => {
  throw new Error('render exploded');
};

describe('InlineCreateErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // React logs caught render errors; keep the test output readable
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('closes the dialog and tells the user, without touching its siblings', () => {
    const onClose = vi.fn();
    render(
      <div>
        <p>dialog behind</p>
        <InlineCreateErrorBoundary onClose={onClose}>
          <Boom />
        </InlineCreateErrorBoundary>
      </div>
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(notify.notifyError).toHaveBeenCalledWith(
      'common:inlineCreate.loadError'
    );
    expect(screen.getByText('dialog behind')).toBeInTheDocument();
  });

  it('renders its children when nothing fails', () => {
    const onClose = vi.fn();
    render(
      <InlineCreateErrorBoundary onClose={onClose}>
        <p>all good</p>
      </InlineCreateErrorBoundary>
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
