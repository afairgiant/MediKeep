import {
  Suspense,
  createContext,
  lazy,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from 'react';

import { useLocation } from 'react-router-dom';

import InlineCreateErrorBoundary from '../components/inlineCreate/InlineCreateErrorBoundary';
import {
  SUB_DIALOG_Z_INDEX,
  SubDialogContext,
  type SubDialogInfo,
} from './SubDialogContext';

/** Record types that can be created from inside another dialog. */
export type InlineCreateType =
  | 'procedures'
  | 'injuries'
  | 'symptoms'
  | 'conditions'
  | 'medications'
  | 'treatments'
  | 'labResults'
  | 'equipment'
  | 'visits';

export interface CreatedRecord {
  id: number;
  [key: string]: unknown;
}

/**
 * What the caller learns about its link after a record is created, so the dialog can
 * say the right thing: linked now (parent already saved) or held until the parent saves.
 */
export type InlineCreateOutcome = 'linked' | 'pending' | void;

export interface InlineCreateRequest {
  /** The patient the new record belongs to: the parent record's patient */
  patientId: number;
  /** Called after the record exists; typically links it to the parent */
  onCreated: (
    _record: CreatedRecord
  ) => InlineCreateOutcome | Promise<InlineCreateOutcome>;
}

export interface InlineCreateDialogProps extends InlineCreateRequest {
  onClose: () => void;
}

type DialogComponent = LazyExoticComponent<
  ComponentType<InlineCreateDialogProps>
>;

/**
 * One entry per creatable type. To support a new type: add its create dialog
 * (see components/inlineCreate/) and one line here.
 */
const INLINE_CREATE_DIALOGS: Record<InlineCreateType, DialogComponent> = {
  procedures: lazy(
    () => import('../components/inlineCreate/ProcedureCreateDialog')
  ),
  injuries: lazy(() => import('../components/inlineCreate/InjuryCreateDialog')),
  symptoms: lazy(
    () => import('../components/inlineCreate/SymptomCreateDialog')
  ),
  conditions: lazy(
    () => import('../components/inlineCreate/ConditionCreateDialog')
  ),
  medications: lazy(
    () => import('../components/inlineCreate/MedicationCreateDialog')
  ),
  treatments: lazy(
    () => import('../components/inlineCreate/TreatmentCreateDialog')
  ),
  equipment: lazy(
    () => import('../components/inlineCreate/EquipmentCreateDialog')
  ),
  labResults: lazy(
    () => import('../components/inlineCreate/LabResultCreateDialog')
  ),
  visits: lazy(() => import('../components/inlineCreate/VisitCreateDialog')),
};

interface InlineCreateApi {
  open: (_type: InlineCreateType, _request: InlineCreateRequest) => void;
}

const InlineCreateContext = createContext<InlineCreateApi | null>(null);

/** `null` outside the provider (for example in isolated component tests). */
export const useInlineCreate = (): InlineCreateApi | null =>
  useContext(InlineCreateContext);

interface ActiveRequest {
  type: InlineCreateType;
  request: InlineCreateRequest;
  /** Remounts the dialog on every open so form state and staged files start fresh */
  key: number;
}

const SUB_DIALOG_INFO: SubDialogInfo = { zIndex: SUB_DIALOG_Z_INDEX };

/**
 * Hosts the create dialogs outside every page and form: a dialog opened here is not
 * inside the parent's <form>, so its Save/Enter can never submit the parent, and the
 * parent stays mounted underneath with its tab, text and staged files untouched.
 * Only one is open at a time, so nesting never goes deeper than one level.
 */
export const InlineCreateProvider = ({ children }: { children: ReactNode }) => {
  const [active, setActive] = useState<ActiveRequest | null>(null);

  const open = useCallback<InlineCreateApi['open']>((type, request) => {
    setActive(current =>
      current ? current : { type, request, key: Date.now() }
    );
  }, []);
  const close = useCallback(() => setActive(null), []);

  // A dialog must not outlive the page it was opened on (route change, logout redirect)
  const { pathname } = useLocation();
  useEffect(() => {
    setActive(null);
  }, [pathname]);

  const api = useMemo(() => ({ open }), [open]);
  const Dialog = active ? INLINE_CREATE_DIALOGS[active.type] : null;

  return (
    <InlineCreateContext.Provider value={api}>
      {children}
      {active && Dialog && (
        <SubDialogContext.Provider value={SUB_DIALOG_INFO}>
          <InlineCreateErrorBoundary key={active.key} onClose={close}>
            <Suspense fallback={null}>
              <Dialog {...active.request} onClose={close} />
            </Suspense>
          </InlineCreateErrorBoundary>
        </SubDialogContext.Provider>
      )}
    </InlineCreateContext.Provider>
  );
};
