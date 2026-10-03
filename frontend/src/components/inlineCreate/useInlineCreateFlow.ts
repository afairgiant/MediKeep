import { useCallback, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useNestedDialog } from '../../hooks/useNestedDialog';
import logger from '../../services/logger';
import { notifySuccess, notifyWarning } from '../../utils/notifyTranslated';
import type {
  CreatedRecord,
  InlineCreateDialogProps,
} from '../../contexts/InlineCreateContext';

/** The methods a DocumentManager exposes through `onDocumentManagerRef`. */
interface DocumentManagerMethods {
  hasPendingFiles?: () => boolean;
  uploadPendingFiles?: (_recordId: number) => Promise<unknown>;
}

interface FieldTarget {
  name: string;
  value: unknown;
  type?: string;
  checked?: boolean;
}

interface FlowOptions<TForm> extends InlineCreateDialogProps {
  /** Used in logs only (never put record data in them) */
  entity: string;
  initialData: TForm;
  /** Returns an error message to show, or null when the form is valid */
  validate: (_form: TForm, _patientId: number) => string | null;
  buildPayload: (_form: TForm, _patientId: number) => Record<string, unknown>;
  create: (_payload: Record<string, unknown>) => Promise<CreatedRecord>;
  /** Runs right after the record exists, e.g. to warn about something the form allowed */
  afterCreate?: (
    _payload: Record<string, unknown>,
    _record: CreatedRecord
  ) => void;
  /** Optional per-form rules for a field change (default: set the field) */
  applyInputChange?: (_prev: TForm, _target: FieldTarget) => TForm;
}

/**
 * Everything the create dialogs share. Order of steps, chosen so a failure after the
 * record exists never loses it:
 *   1. validate (nothing is created if invalid)
 *   2. create the record
 *   3. link it to the parent (a failure shows a warning; the record is kept)
 *   4. upload staged files (a failure shows a warning; the record is kept)
 *   5. close
 * A failure at step 2 keeps the dialog open with everything the user typed.
 */
export const useInlineCreateFlow = <TForm extends object>({
  entity,
  initialData,
  validate,
  buildPayload,
  create,
  applyInputChange,
  afterCreate,
  patientId,
  onCreated,
  onClose,
}: FlowOptions<TForm>) => {
  const { t } = useTranslation(['common', 'shared']);
  const [formData, setFormData] = useState<TForm>(initialData);
  const [busy, setBusy] = useState(false);
  // Shown inside the dialog: a toast can hide behind a dialog, and this must not be missed
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const documentManager = useRef<DocumentManagerMethods | null>(null);

  const handleInputChange = useCallback(
    (e: { target: FieldTarget }) => {
      setError(null);
      setFormData(prev =>
        applyInputChange
          ? applyInputChange(prev, e.target)
          : { ...prev, [e.target.name]: e.target.value }
      );
    },
    [applyInputChange]
  );

  const setDocumentManager = useCallback(
    (methods: DocumentManagerMethods | null) => {
      documentManager.current = methods;
    },
    []
  );

  const close = useCallback(() => {
    if (!busyRef.current) onClose();
  }, [onClose]);

  // Escape closes this dialog only, and never while a save is running
  useNestedDialog(true, close);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault?.();
    if (busyRef.current) return;

    const validationError = validate(formData, patientId);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    busyRef.current = true;
    setBusy(true);

    let record: CreatedRecord;
    let payload: ReturnType<typeof buildPayload>;
    try {
      payload = buildPayload(formData, patientId);
      record = await create(payload);
      if (!record?.id) throw new Error('Create returned no record');
    } catch (err) {
      logger.error('inline_create_failed', {
        message: 'Failed to create record inline',
        entity,
        error: err instanceof Error ? err.message : String(err),
        component: 'useInlineCreateFlow',
      });
      setError(
        t(
          'common:inlineCreate.createError',
          'Could not create it. Please try again.'
        )
      );
      busyRef.current = false;
      setBusy(false);
      return;
    }

    try {
      afterCreate?.(payload, record);
    } catch (err) {
      // A failing extra must never undo or hide a created record
      logger.warn('inline_create_after_create_failed', {
        message: 'afterCreate failed',
        entity,
        error: err instanceof Error ? err.message : String(err),
        component: 'useInlineCreateFlow',
      });
    }

    let outcome: Awaited<ReturnType<typeof onCreated>> = undefined;
    let linkFailed = false;
    try {
      outcome = await onCreated(record);
    } catch (err) {
      linkFailed = true;
      logger.error('inline_create_link_failed', {
        message: 'Record was created but could not be linked',
        entity,
        recordId: record.id,
        error: err instanceof Error ? err.message : String(err),
        component: 'useInlineCreateFlow',
      });
      notifyWarning('common:inlineCreate.linkFailed');
    }

    let uploadFailed = false;
    const files = documentManager.current;
    if (files?.hasPendingFiles?.()) {
      try {
        await files.uploadPendingFiles?.(record.id);
      } catch (err) {
        uploadFailed = true;
        logger.error('inline_create_upload_failed', {
          message: 'Record was created but files could not be uploaded',
          entity,
          recordId: record.id,
          error: err instanceof Error ? err.message : String(err),
          component: 'useInlineCreateFlow',
        });
        notifyWarning('common:inlineCreate.uploadFailed');
      }
    }

    if (!linkFailed && !uploadFailed) {
      notifySuccess(
        outcome === 'pending'
          ? 'common:inlineCreate.createdPending'
          : outcome === 'linked'
            ? 'common:inlineCreate.createdLinked'
            : 'common:inlineCreate.created'
      );
    }

    busyRef.current = false;
    onClose();
  };

  return {
    formData,
    handleInputChange,
    handleSubmit,
    setDocumentManager,
    close,
    busy,
    error,
  };
};
