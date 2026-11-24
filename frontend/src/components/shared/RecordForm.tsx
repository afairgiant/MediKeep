import { createContext, useContext, useMemo, useRef, useState } from 'react';
import type {
  FormEvent,
  FormEventHandler,
  FormHTMLAttributes,
  ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The <form> of every record Add/Edit form. Use it in place of <form>.
 *
 * To make a field mandatory, give it the `required` prop. Nothing else is
 * needed, whichever tab the field is on and whatever input it is (text, date,
 * Select). On submit, RecordForm finds the first field that is empty or
 * invalid, switches to its tab, focuses it, and says why in the form's
 * FormErrorPopup. The form's onSubmit runs only when every field passes.
 *
 * The browser's own check is switched off (noValidate) because it stops the
 * submit without a word when the field is on a tab that is not showing, and it
 * never checks a non-searchable Mantine Select, whose input is read-only.
 *
 * Other rules (a range, one field depending on another) belong in the page's
 * form check, with a message that names the field. The backend is the final
 * check; its message also shows in FormErrorPopup.
 */

type FieldElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * Why a field stops the submit. The browser's own message (validationMessage)
 * is not used: it is in the browser's language, not the app's.
 */
type FieldProblem =
  | { kind: 'missing' }
  | { kind: 'email' | 'url' | 'format' | 'invalid' }
  | { kind: 'tooShort'; min: number }
  | { kind: 'tooLong'; max: number }
  | { kind: 'belowMinimum'; min: string }
  | { kind: 'aboveMaximum'; max: string };

export interface RecordFormFieldError {
  message: string;
  /** Counts refused submits, so a repeat of the same message is still new */
  attempt: number;
  /** Puts the cursor in the field, such as when a popup about it closes */
  focusField: () => void;
}

export interface RecordFormErrors {
  /** Why RecordForm refused the last submit, or null when it passed */
  fieldError: RecordFormFieldError | null;
  /**
   * Counts submits that passed the check, so the page's error after one is new
   * even when its text is the same as before
   */
  passedSubmits: number;
}

const RecordFormErrorsContext = createContext<RecordFormErrors>({
  fieldError: null,
  passedSubmits: 0,
});

/** What FormErrorPopup needs from the RecordForm it is in */
export const useRecordFormErrors = () => useContext(RecordFormErrorsContext);

const isFieldElement = (element: Element): element is FieldElement =>
  element instanceof HTMLInputElement ||
  element instanceof HTMLTextAreaElement ||
  element instanceof HTMLSelectElement;

const getFieldProblem = (field: FieldElement): FieldProblem | null => {
  if (field.disabled || field.type === 'hidden') return null;

  if (field.willValidate) {
    const { validity } = field;
    if (validity.valid) return null;
    if (validity.valueMissing) return { kind: 'missing' };
    if (validity.typeMismatch) {
      if (field.type === 'email') return { kind: 'email' };
      if (field.type === 'url') return { kind: 'url' };
      return { kind: 'format' };
    }
    if (validity.patternMismatch) return { kind: 'format' };
    if (validity.tooShort && 'minLength' in field) {
      return { kind: 'tooShort', min: field.minLength };
    }
    if (validity.tooLong && 'maxLength' in field) {
      return { kind: 'tooLong', max: field.maxLength };
    }
    if (validity.rangeUnderflow && 'min' in field) {
      return { kind: 'belowMinimum', min: field.min };
    }
    if (validity.rangeOverflow && 'max' in field) {
      return { kind: 'aboveMaximum', max: field.max };
    }
    return { kind: 'invalid' };
  }

  // The browser skips read-only inputs. A required one that is empty is a
  // non-searchable Select with nothing chosen.
  const isReadOnly = 'readOnly' in field && field.readOnly;
  if (field.required && isReadOnly && field.value.trim() === '') {
    return { kind: 'missing' };
  }
  return null;
};

/** Visible text of an element, without the required asterisk or badges */
const getVisibleText = (element: Element): string => {
  const copy = element.cloneNode(true) as Element;
  copy
    .querySelectorAll('[aria-hidden="true"], .mantine-Badge-root')
    .forEach(node => node.remove());
  return copy.textContent?.trim() ?? '';
};

const getFieldLabel = (field: FieldElement): string => {
  const label = field.labels?.[0];
  const text = label ? getVisibleText(label) : '';
  return text || field.getAttribute('aria-label')?.trim() || '';
};

/** The tabs that hold the field, outermost first */
const getTabsHoldingField = (
  field: FieldElement,
  form: HTMLFormElement
): HTMLElement[] => {
  const tabs: HTMLElement[] = [];
  let panel = field.closest('[role="tabpanel"]');
  while (panel && form.contains(panel)) {
    const tabId = panel.getAttribute('aria-labelledby');
    const tab = tabId ? form.ownerDocument.getElementById(tabId) : null;
    if (tab) tabs.unshift(tab);
    panel = panel.parentElement?.closest('[role="tabpanel"]') ?? null;
  }
  return tabs;
};

const getTabLabel = (tab: HTMLElement): string => {
  const label = tab.querySelector('.mantine-Tabs-tabLabel') ?? tab;
  return getVisibleText(label);
};

interface RecordFormProps extends Omit<
  FormHTMLAttributes<HTMLFormElement>,
  'onSubmit' | 'noValidate'
> {
  onSubmit: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
}

const RecordForm = ({ onSubmit, children, ...formProps }: RecordFormProps) => {
  const { t } = useTranslation('shared');
  const [fieldError, setFieldError] = useState<{
    message: string;
    field: FieldElement;
    attempt: number;
  } | null>(null);
  const [passedSubmits, setPassedSubmits] = useState(0);
  const refusedSubmits = useRef(0);

  const errors = useMemo<RecordFormErrors>(
    () => ({
      fieldError: fieldError
        ? {
            message: fieldError.message,
            attempt: fieldError.attempt,
            focusField: () => fieldError.field.focus(),
          }
        : null,
      passedSubmits,
    }),
    [fieldError, passedSubmits]
  );

  const describeReason = (problem: FieldProblem): string => {
    switch (problem.kind) {
      case 'email':
        return t(
          'errors:form.invalidEmail',
          'Please enter a valid email address.'
        );
      case 'url':
        return t(
          'errors:form.invalidWebsiteUrl',
          'Please enter a valid website URL'
        );
      case 'format':
        return t('errors:form.invalidFormat', 'The format is not valid.');
      case 'tooShort':
        return t('errors:form.tooShort', 'Use at least {{min}} characters.', {
          min: problem.min,
        });
      case 'tooLong':
        return t(
          'errors:form.tooLong',
          'Use no more than {{max}} characters.',
          {
            max: problem.max,
          }
        );
      case 'belowMinimum':
        return t('errors:form.belowMinimum', 'Must be at least {{min}}.', {
          min: problem.min,
        });
      case 'aboveMaximum':
        return t('errors:form.aboveMaximum', 'Must be at most {{max}}.', {
          max: problem.max,
        });
      default:
        return t('errors:form.invalidValue', 'This value is not valid.');
    }
  };

  const describeProblem = (
    field: FieldElement,
    problem: FieldProblem,
    tab: string
  ): string => {
    const name =
      getFieldLabel(field) || t('formValidation.unnamedField', 'A field');

    if (problem.kind === 'missing') {
      return tab
        ? t(
            'formValidation.requiredOnTab',
            '{{field}} on the {{tab}} tab is required.',
            { field: name, tab }
          )
        : t('formValidation.required', '{{field}} is required.', {
            field: name,
          });
    }
    const reason = describeReason(problem);
    return tab
      ? t(
          'formValidation.invalidOnTab',
          '{{field}} on the {{tab}} tab: {{reason}}',
          { field: name, tab, reason }
        )
      : t('formValidation.invalid', '{{field}}: {{reason}}', {
          field: name,
          reason,
        });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // A dialog opened from this form (such as New practitioner) has its own
    // form, and React passes that form's submit up to this one. It is not a
    // submit of this form, so it goes through unchecked, as it always has.
    if (event.target !== event.currentTarget) {
      onSubmit(event);
      return;
    }

    const form = event.currentTarget;
    for (const element of Array.from(form.elements)) {
      if (!isFieldElement(element)) continue;
      const problem = getFieldProblem(element);
      if (!problem) continue;

      // Required with noValidate: otherwise the browser submits the page.
      // A refused submit ends here, so a form this one is nested in never sees it.
      event.preventDefault();
      event.stopPropagation();

      const tabs = getTabsHoldingField(element, form);
      tabs
        .filter(tab => tab.getAttribute('aria-selected') !== 'true')
        .forEach(tab => tab.click());

      const outermostTab = tabs[0] ?? null;
      setFieldError({
        message: describeProblem(
          element,
          problem,
          outermostTab ? getTabLabel(outermostTab) : ''
        ),
        field: element,
        attempt: (refusedSubmits.current += 1),
      });

      // A field on a hidden tab can be focused once the tab change has rendered
      setTimeout(() => element.focus(), 0);
      return;
    }

    setFieldError(null);
    onSubmit(event);
    setPassedSubmits(count => count + 1);
  };

  return (
    <form {...formProps} noValidate onSubmit={handleSubmit}>
      <RecordFormErrorsContext.Provider value={errors}>
        {children}
      </RecordFormErrorsContext.Provider>
    </form>
  );
};

export default RecordForm;
