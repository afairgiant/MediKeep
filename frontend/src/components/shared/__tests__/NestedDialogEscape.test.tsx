import { useState } from 'react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Modal } from '@mantine/core';
import { IconStethoscope } from '@tabler/icons-react';

import render, { screen, waitFor, within } from '../../../test-utils/render';
import LinkSection from '../LinkSection';
import { useNestedDialog } from '../../../hooks/useNestedDialog';
import type { LinkCandidate } from '../../../types/encounterLinks';

Element.prototype.scrollIntoView = vi.fn();

const candidates: LinkCandidate[] = [
  { id: 1, label: 'Appendectomy' },
  { id: 2, label: 'Knee arthroscopy' },
];

/** A dialog like the entity forms: a Modal containing a form and a LinkSection. */
const ParentDialog = ({ onClose }: { onClose: () => void }) => (
  <Modal opened onClose={onClose} title="Visit" zIndex={2000}>
    <form onSubmit={e => e.preventDefault()}>
      <input aria-label="unsaved-reason" />
      <LinkSection
        title="Procedures"
        rows={[]}
        candidates={candidates}
        entityType="procedure"
        icon={IconStethoscope}
        color="blue"
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />
    </form>
  </Modal>
);

describe('Escape in a sub-dialog', () => {
  it('closes the "+ Link" modal but not the dialog behind it', async () => {
    const onCloseParent = vi.fn();
    render(<ParentDialog onClose={onCloseParent} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('unsaved-reason'), 'half typed');
    await user.click(
      screen.getByRole('button', { name: 'common:buttons.link' })
    );
    const linkDialog = await screen.findByRole('dialog', {
      name: /common:visits.relationships.modalTitle/,
    });
    await user.click(
      within(linkDialog).getByPlaceholderText(
        'common:visits.relationships.selectPlaceholder'
      )
    );
    // Escape with the dropdown open only closes the dropdown
    await user.keyboard('{Escape}');
    expect(
      screen.getByRole('dialog', {
        name: /common:visits.relationships.modalTitle/,
      })
    ).toBeInTheDocument();

    // Escape again closes the Link modal
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', {
          name: /common:visits.relationships.modalTitle/,
        })
      ).toBeNull()
    );

    // The dialog behind it is untouched, with its unsaved text
    expect(onCloseParent).not.toHaveBeenCalled();
    expect(screen.getByLabelText('unsaved-reason')).toHaveValue('half typed');

    // With no sub-dialog open, Escape closes the dialog as before
    await user.keyboard('{Escape}');
    expect(onCloseParent).toHaveBeenCalledTimes(1);
  });
});

const Nested = ({
  onCloseParent,
  onCloseChild,
}: {
  onCloseParent: () => void;
  onCloseChild: () => void;
}) => {
  const [childOpen, setChildOpen] = useState(true);
  const closeChild = () => {
    onCloseChild();
    setChildOpen(false);
  };
  useNestedDialog(childOpen, closeChild);
  return (
    <Modal opened onClose={onCloseParent} title="parent" zIndex={2000}>
      <Modal
        opened={childOpen}
        onClose={closeChild}
        title="child"
        zIndex={2100}
      >
        <input aria-label="child-input" />
      </Modal>
    </Modal>
  );
};

describe('useNestedDialog', () => {
  it('Escape closes only the sub-dialog, then the parent on the next press', async () => {
    const onCloseParent = vi.fn();
    const onCloseChild = vi.fn();
    render(
      <Nested onCloseParent={onCloseParent} onCloseChild={onCloseChild} />
    );
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText('child-input'));

    await user.keyboard('{Escape}');
    expect(onCloseChild).toHaveBeenCalledTimes(1);
    expect(onCloseParent).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(onCloseParent).toHaveBeenCalledTimes(1);
  });
});
