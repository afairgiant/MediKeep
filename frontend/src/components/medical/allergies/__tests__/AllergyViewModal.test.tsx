import React from 'react';
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import '@testing-library/jest-dom';
import AllergyViewModal from '../AllergyViewModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

vi.mock('../../../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({ formatDate: (date: string) => date }),
}));

vi.mock('../../../../hooks/useTagColors', () => ({
  useTagColors: () => ({ getTagColor: () => 'blue' }),
}));

vi.mock('../../../../utils/linkNavigation', () => ({
  navigateToEntity: vi.fn(),
}));

vi.mock('../../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../common/ClickableTagBadge', () => ({
  ClickableTagBadge: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock('../../../shared/NotesView', () => ({ default: () => null }));

const documentManagerProps = vi.hoisted(() => ({
  current: null as { onError: (_message: string) => void } | null,
}));
vi.mock('../../../shared/DocumentManagerWithProgress', () => ({
  default: (props: { onError: (_message: string) => void }) => {
    documentManagerProps.current = props;
    return null;
  },
}));

describe('AllergyViewModal - document errors', () => {
  it('does not pass document errors on to the page behind the dialog', () => {
    documentManagerProps.current = null;
    const onError = vi.fn();
    render(
      <MantineProvider>
        <AllergyViewModal
          isOpen
          onClose={vi.fn()}
          allergy={{ id: 1, allergen: 'Peanuts', tags: [] }}
          onEdit={vi.fn()}
          navigate={vi.fn()}
          onError={onError}
        />
      </MantineProvider>
    );

    expect(documentManagerProps.current).not.toBeNull();
    // The document manager shows this error inside the dialog itself.
    documentManagerProps.current?.onError('Failed to load files');

    expect(onError).not.toHaveBeenCalled();
  });
});
