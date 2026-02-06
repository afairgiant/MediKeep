/**
 * i18n-aware notification helpers.
 *
 * Uses i18next directly (not a React hook) so these can be called from
 * any context — components, utilities, event handlers, etc.
 *
 * Usage:
 *   import { notifySuccess, notifyError, notifyWarning, notifyInfo } from '../utils/notifyTranslated';
 *
 *   notifySuccess('notifications:channels.createSuccess');
 *   notifyError('notifications:channels.deleteFailed', { title: 'notifications:channels.delete' });
 *   notifyWarning('common:messages.unsavedChanges');
 *   notifyInfo('notifications:events.backup_completed.name');
 */

import i18n from '../i18n/config';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconX,
  IconExclamationMark,
  IconInfoCircle,
} from '@tabler/icons-react';

/**
 * Resolve a value through i18n if it looks like a translation key, otherwise return as-is.
 * Keys are detected by containing a colon (namespace separator) or a dot (nested key).
 * Literal strings without dots/colons pass through unchanged.
 */
const resolve = (keyOrLiteral, interpolation) => {
  if (!keyOrLiteral) return '';
  // If it contains a colon (namespace:key) or looks like a dotted path with no spaces,
  // treat it as a translation key.
  if (
    typeof keyOrLiteral === 'string' &&
    (keyOrLiteral.includes(':') ||
      (keyOrLiteral.includes('.') && !/\s/.test(keyOrLiteral)))
  ) {
    return i18n.t(keyOrLiteral, interpolation);
  }
  return keyOrLiteral;
};

/**
 * Show a translated success notification.
 * @param {string} messageKey - Translation key or literal string for the message
 * @param {Object} [options] - Additional options
 * @param {string} [options.title] - Translation key or literal for title (default: common:messages.saveSuccess)
 * @param {Object} [options.interpolation] - Values for {{placeholder}} interpolation
 * @param {number} [options.autoClose] - Auto close time in ms (default: 5000)
 */
export const notifySuccess = (messageKey, options = {}) => {
  const { title, interpolation, autoClose = 5000, ...rest } = options;
  notifications.show({
    title: resolve(title || 'common:messages.saveSuccess', interpolation),
    message: resolve(messageKey, interpolation),
    color: 'green',
    icon: <IconCheck size={16} />,
    autoClose,
    ...rest,
  });
};

/**
 * Show a translated error notification.
 * @param {string} messageKey - Translation key or literal string for the message
 * @param {Object} [options] - Additional options
 * @param {string} [options.title] - Translation key or literal for title (default: common:labels.error)
 * @param {Object} [options.interpolation] - Values for {{placeholder}} interpolation
 * @param {number} [options.autoClose] - Auto close time in ms (default: 7000)
 */
export const notifyError = (messageKey, options = {}) => {
  const {
    title,
    interpolation,
    autoClose = 7000,
    withCloseButton = true,
    ...rest
  } = options;
  notifications.show({
    title: resolve(title || 'common:labels.error', interpolation),
    message: resolve(messageKey, interpolation),
    color: 'red',
    icon: <IconX size={16} />,
    autoClose,
    withCloseButton,
    ...rest,
  });
};

/**
 * Show a translated warning notification.
 * @param {string} messageKey - Translation key or literal string for the message
 * @param {Object} [options] - Additional options
 * @param {string} [options.title] - Translation key or literal for title
 * @param {Object} [options.interpolation] - Values for {{placeholder}} interpolation
 * @param {number} [options.autoClose] - Auto close time in ms (default: 7000)
 */
export const notifyWarning = (messageKey, options = {}) => {
  const { title, interpolation, autoClose = 7000, ...rest } = options;
  notifications.show({
    title: resolve(title, interpolation),
    message: resolve(messageKey, interpolation),
    color: 'orange',
    icon: <IconExclamationMark size={16} />,
    autoClose,
    ...rest,
  });
};

/**
 * Show a translated info notification.
 * @param {string} messageKey - Translation key or literal string for the message
 * @param {Object} [options] - Additional options
 * @param {string} [options.title] - Translation key or literal for title
 * @param {Object} [options.interpolation] - Values for {{placeholder}} interpolation
 * @param {number} [options.autoClose] - Auto close time in ms (default: 5000)
 */
export const notifyInfo = (messageKey, options = {}) => {
  const { title, interpolation, autoClose = 5000, ...rest } = options;
  notifications.show({
    title: resolve(title, interpolation),
    message: resolve(messageKey, interpolation),
    color: 'blue',
    icon: <IconInfoCircle size={16} />,
    autoClose,
    ...rest,
  });
};
