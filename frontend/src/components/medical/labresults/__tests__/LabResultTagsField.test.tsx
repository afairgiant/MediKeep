import { vi } from 'vitest';
import render, { screen } from '../../../../test-utils/render';
import '@testing-library/jest-dom';
import LabResultTagsField from '../LabResultTagsField';

vi.mock('../../../common/TagInput', () => ({
  TagInput: ({ value, onChange, disabled, placeholder, id }: any) => (
    <button
      type="button"
      id={id}
      disabled={disabled}
      title={placeholder}
      onClick={() => onChange([...value, 'fasting'])}
    >
      add-tag
    </button>
  ),
}));

describe('LabResultTagsField', () => {
  it('renders the Tags label and forwards the placeholder', () => {
    render(<LabResultTagsField value={[]} onChange={vi.fn()} />);
    expect(screen.getByText('shared:labels.tags')).toBeInTheDocument();
    expect(screen.getByTitle('common:fields.tags.placeholder')).toBeInTheDocument();
  });

  it('calls onChange with the updated tag list', () => {
    const onChange = vi.fn();
    render(<LabResultTagsField value={['annual']} onChange={onChange} />);
    screen.getByText('add-tag').click();
    expect(onChange).toHaveBeenCalledWith(['annual', 'fasting']);
  });

  it('passes disabled through to the tag input', () => {
    render(<LabResultTagsField value={[]} onChange={vi.fn()} disabled />);
    expect(screen.getByText('add-tag')).toBeDisabled();
  });

  it('uses the same semi-bold label weight as the themed inputs', () => {
    render(<LabResultTagsField value={[]} onChange={vi.fn()} />);
    const label = screen.getByText('shared:labels.tags').closest('label');
    expect(label).not.toBeNull();
    expect(getComputedStyle(label as Element).fontWeight).toBe('600');
  });

  it('associates the label with the tag input', () => {
    render(<LabResultTagsField value={[]} onChange={vi.fn()} />);
    const label = screen.getByText('shared:labels.tags').closest('label');
    expect(label).toHaveAttribute('for');
    expect(screen.getByText('add-tag')).toHaveAttribute('id', label!.getAttribute('for'));
  });
});
