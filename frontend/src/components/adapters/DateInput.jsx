import { useState } from 'react';
import PropTypes from 'prop-types';
import { ActionIcon, Popover } from '@mantine/core';
import {
  DateInput as MantineDateInput,
  DatePicker,
  pickCalendarProps,
} from '@mantine/dates';
import { useDidUpdate, useMediaQuery, useUncontrolled } from '@mantine/hooks';
import { IconCalendar } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useDateFormat } from '../../hooks/useDateFormat';
import { createDateParser } from '../../utils/dateUtils';

/**
 * Shared date input that defaults `valueFormat` and `dateParser` from the
 * user's `date_format` preference. All medical forms import this so the
 * permissive parsing (accepts `16.1.2018`, `16/01/2018`, etc.) and the
 * separator choice (dots vs slashes vs dashes) live in one place.
 *
 * Props are forwarded to Mantine's DateInput, except `rightSection`, which
 * holds a calendar button that opens the picker without focusing the field.
 * On touch devices focusing the field does not open the inline calendar.
 *
 * @param {import('@mantine/dates').DateInputProps} props
 */
export const DateInput = ({
  valueFormat,
  dateParser,
  placeholder,
  value,
  defaultValue,
  onChange,
  popoverProps,
  disabled,
  readOnly,
  clearable,
  size,
  ...props
}) => {
  const { t } = useTranslation('common');
  const { dateInputFormat } = useDateFormat();
  // Read synchronously: a form that autofocuses this field must not open the inline calendar on first render
  const isTouch = useMediaQuery('(pointer: coarse)', undefined, {
    getInitialValueInEffect: false,
  });
  const [pickerOpened, setPickerOpened] = useState(false);
  const [currentValue, setCurrentValue] = useUncontrolled({
    value,
    defaultValue,
    finalValue: null,
    onChange,
  });
  const { calendarProps } = pickCalendarProps(props);
  const [pickerDate, setPickerDate] = useUncontrolled({
    value: calendarProps.date,
    defaultValue: calendarProps.defaultDate ?? (currentValue || undefined),
    onChange: calendarProps.onDateChange,
  });
  useDidUpdate(() => {
    if (currentValue) setPickerDate(currentValue);
  }, [currentValue]);
  const effectiveFormat = valueFormat || dateInputFormat;
  const pickerDisabled = disabled || readOnly;

  const handlePick = pickedValue => {
    setCurrentValue(pickedValue);
    setPickerOpened(false);
  };

  const calendarButton = (
    <Popover
      opened={pickerOpened}
      disabled={pickerDisabled}
      onChange={setPickerOpened}
      position="bottom-end"
      trapFocus
      returnFocus
      shadow="md"
      withinPortal={popoverProps?.withinPortal}
      zIndex={popoverProps?.zIndex}
    >
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size={size ?? 'sm'}
          disabled={pickerDisabled}
          aria-label={t('buttons.openCalendar')}
          onClick={() => setPickerOpened(opened => !opened)}
        >
          <IconCalendar size={16} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <DatePicker
          {...calendarProps}
          value={currentValue || null}
          date={pickerDate}
          onDateChange={setPickerDate}
          allowDeselect={calendarProps.allowDeselect ?? clearable}
          onChange={handlePick}
          size={size}
          // Keeps Escape inside the picker from also closing an enclosing Modal
          __stopPropagation
        />
      </Popover.Dropdown>
    </Popover>
  );

  return (
    <MantineDateInput
      {...props}
      value={currentValue}
      onChange={setCurrentValue}
      disabled={disabled}
      readOnly={readOnly}
      clearable={clearable}
      size={size}
      rightSection={calendarButton}
      rightSectionPointerEvents="all"
      popoverProps={{
        ...popoverProps,
        ...(isTouch && { disabled: true }),
      }}
      valueFormat={effectiveFormat}
      dateParser={dateParser || createDateParser(effectiveFormat)}
      placeholder={placeholder || effectiveFormat}
    />
  );
};

DateInput.propTypes = {
  valueFormat: PropTypes.string,
  dateParser: PropTypes.func,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
  defaultValue: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.instanceOf(Date),
  ]),
  onChange: PropTypes.func,
  popoverProps: PropTypes.object,
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,
  clearable: PropTypes.bool,
  size: PropTypes.string,
};

export default DateInput;
