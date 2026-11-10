import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import render from '../../../../test-utils/render';
import NameAutocompleteOption from '../NameAutocompleteOption';

describe('NameAutocompleteOption', () => {
  it('shows the alias a panel matched through', () => {
    render(<NameAutocompleteOption option="Cytology" query="pap smear" />);
    expect(screen.getByText('Cytology')).toBeInTheDocument();
    expect(screen.getByText('matched: Pap Smear')).toBeInTheDocument();
  });

  it('shows the alias a test matched through', () => {
    render(
      <NameAutocompleteOption option="Platelet Count (PLT)" query="thrombocytes" />
    );
    expect(screen.getByText('matched: Thrombocytes')).toBeInTheDocument();
  });

  it('shows only the name when the typed text is part of it', () => {
    render(<NameAutocompleteOption option="Cytology" query="cyto" />);
    expect(screen.getByText('Cytology')).toBeInTheDocument();
    expect(screen.queryByText(/matched:/)).toBeNull();
  });

  it('shows only the name when nothing has been typed', () => {
    render(<NameAutocompleteOption option="Skin Biopsy" query="" />);
    expect(screen.getByText('Skin Biopsy')).toBeInTheDocument();
    expect(screen.queryByText(/matched:/)).toBeNull();
  });
});
