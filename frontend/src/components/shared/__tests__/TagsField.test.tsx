import { vi } from 'vitest';
import render, { screen } from '../../../test-utils/render';
import '@testing-library/jest-dom';
import TagsField from '../TagsField';

vi.mock('../../common/TagInput', () => ({
  TagInput: ({ value, onChange, disabled, placeholder, id, maxTags }: any) => (
    <button
      type="button"
      id={id}
      disabled={disabled}
      title={placeholder}
      data-max-tags={maxTags}
      onClick={() => onChange([...value, 'fasting'])}
    >
      add-tag
    </button>
  ),
}));

describe('TagsField', () => {
  it('renders the Tags label and forwards the placeholder', () => {
    render(<TagsField value={[]} onChange={vi.fn()} />);
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByTitle('Add tags to organize and find this record')).toBeInTheDocument();
  });

  it('uses the label, description, placeholder and maxTags passed in', () => {
    render(
      <TagsField
        value={[]}
        onChange={vi.fn()}
        label="Custom label"
        description="Helper text"
        placeholder="Type a tag"
        maxTags={5}
      />
    );
    expect(screen.getByText('Custom label').closest('label')).not.toBeNull();
    expect(screen.getByText('Helper text')).toBeInTheDocument();
    expect(screen.getByTitle('Type a tag')).toHaveAttribute(
      'data-max-tags',
      '5'
    );
  });

  it('calls onChange with the updated tag list', () => {
    const onChange = vi.fn();
    render(<TagsField value={['annual']} onChange={onChange} />);
    screen.getByText('add-tag').click();
    expect(onChange).toHaveBeenCalledWith(['annual', 'fasting']);
  });

  it('passes disabled through to the tag input', () => {
    render(<TagsField value={[]} onChange={vi.fn()} disabled />);
    expect(screen.getByText('add-tag')).toBeDisabled();
  });

  it('uses the same semi-bold label weight as the themed inputs', () => {
    render(<TagsField value={[]} onChange={vi.fn()} />);
    const label = screen.getByText('Tags').closest('label');
    expect(label).not.toBeNull();
    expect(getComputedStyle(label as Element).fontWeight).toBe('600');
  });

  it('associates the label with the tag input', () => {
    render(<TagsField value={[]} onChange={vi.fn()} />);
    const label = screen.getByText('Tags').closest('label');
    expect(label).toHaveAttribute('for');
    expect(screen.getByText('add-tag')).toHaveAttribute('id', label!.getAttribute('for'));
  });
});
