import { createContext, useContext } from 'react';

/**
 * Set by the inline-create host around every dialog it renders (a dialog opened
 * from inside another dialog). Anything inside can ask whether it is a sub-dialog:
 * forms hide their link tabs and "Add ..." buttons, which keeps nesting exactly one
 * level deep, and take the sub-dialog stacking order.
 */
export interface SubDialogInfo {
  zIndex: number;
}

/** Above the entity forms (2000) and below combobox dropdowns (3000) and sub-modals of sub-dialogs (2100). */
export const SUB_DIALOG_Z_INDEX = 2050;

export const SubDialogContext = createContext<SubDialogInfo | null>(null);

/** `null` when the component is not inside a sub-dialog. */
export const useSubDialog = (): SubDialogInfo | null =>
  useContext(SubDialogContext);
