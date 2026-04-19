import { DateInput as MantineDateInput } from '@mantine/dates';
import { useDateFormat } from '../../hooks/useDateFormat';
import { createDateParser } from '../../utils/dateUtils';

/**
 * Shared date input that defaults `valueFormat` and `dateParser` from the
 * user's `date_format` preference. All medical forms import this so the
 * permissive parsing (accepts `16.1.2018`, `16/01/2018`, etc.) and the
 * separator choice (dots vs slashes vs dashes) live in one place.
 *
 * Props are forwarded to Mantine's DateInput unchanged; callers only need
 * to override `valueFormat` / `dateParser` / `placeholder` when the default
 * preference-driven behavior isn't wanted.
 */
export const DateInput = ({
  valueFormat,
  dateParser,
  placeholder,
  ...props
}) => {
  const { dateInputFormat } = useDateFormat();
  const effectiveFormat = valueFormat || dateInputFormat;

  return (
    <MantineDateInput
      {...props}
      valueFormat={effectiveFormat}
      dateParser={dateParser || createDateParser(effectiveFormat)}
      placeholder={placeholder || effectiveFormat}
    />
  );
};

export default DateInput;
