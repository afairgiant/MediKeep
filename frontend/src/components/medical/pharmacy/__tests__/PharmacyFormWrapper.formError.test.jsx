import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import render from '../../../../test-utils/render';
import PharmacyFormWrapper from '../PharmacyFormWrapper';

const FORM_DATA = {
  name: 'Corner Pharmacy',
  brand: '',
  street_address: '',
  city: '',
  state: '',
  zip_code: '',
  country: '',
  store_number: '',
  phone_number: '',
  website: '',
  specialty_services: '',
};

const renderForm = (props = {}) =>
  render(
    <PharmacyFormWrapper
      isOpen
      onClose={vi.fn()}
      title="Add New Pharmacy"
      formData={FORM_DATA}
      onInputChange={vi.fn()}
      onSubmit={vi.fn()}
      editingPharmacy={null}
      {...props}
    />
  );

const clickSubmit = () => {
  const submit = document.querySelector('button[type="submit"]');
  if (!submit) throw new Error('No submit button');
  fireEvent.click(submit);
};

describe('PharmacyFormWrapper save errors (#1317)', () => {
  it("shows the page's save error in the popup", async () => {
    renderForm({
      formError: 'Name: Must be at least 2 characters (Error: VAL-422)',
    });

    const popup = await screen.findByRole('dialog', { name: 'Cannot save' });
    expect(
      within(popup).getByText(
        'Name: Must be at least 2 characters (Error: VAL-422)'
      )
    ).toBeInTheDocument();
  });

  it('shows its own website check in the popup and does not save', async () => {
    const onSubmit = vi.fn();
    renderForm({
      onSubmit,
      formData: { ...FORM_DATA, website: 'not a website' },
    });

    clickSubmit();

    const popup = await screen.findByRole('dialog', { name: 'Cannot save' });
    expect(
      within(popup).getByText('form.invalidWebsiteUrl')
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
