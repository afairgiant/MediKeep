import panelLibraryData from '../../../shared/data/panel_library.json';

export interface PanelLibraryItem {
  panel_name: string;
  abbreviation: string;
  category: string;
  common_names: string[];
  is_common: boolean;
  display_order: number;
}

export const PANEL_LIBRARY: PanelLibraryItem[] =
  (panelLibraryData as { panels: PanelLibraryItem[] }).panels;

/** Returns autocomplete option strings for a given query, common panels first. */
export function getPanelAutocompleteOptions(query: string, limit = 50): string[] {
  const q = query.toLowerCase().trim();

  const toOption = (p: PanelLibraryItem): string =>
    p.abbreviation ? `${p.panel_name} (${p.abbreviation})` : p.panel_name;

  const matches = (p: PanelLibraryItem): boolean => {
    if (!q) return true;
    return (
      p.panel_name.toLowerCase().includes(q) ||
      p.abbreviation.toLowerCase().includes(q) ||
      p.common_names.some(n => n.toLowerCase().includes(q))
    );
  };

  return PANEL_LIBRARY
    .filter(matches)
    .sort((a, b) => a.panel_name.localeCompare(b.panel_name))
    .slice(0, limit)
    .map(toOption);
}

/** Extracts just the panel name from an autocomplete option string.
 *  "Complete Blood Count (CBC)" → "Complete Blood Count"
 */
export function extractPanelName(option: string): string {
  return option.replace(/\s*\([^)]*\)$/, '').trim();
}

/**
 * The alias that made a panel match the query, only when its name and
 * abbreviation did not. Lets the dropdown say why "Cytology" is listed for
 * "pap smear".
 */
export function getMatchedPanelAlias(
  panel: PanelLibraryItem,
  query: string
): string | undefined {
  const q = query.toLowerCase().trim();
  if (!q) return undefined;
  if (
    panel.panel_name.toLowerCase().includes(q) ||
    panel.abbreviation.toLowerCase().includes(q)
  ) {
    return undefined;
  }
  return panel.common_names.find(name => name.toLowerCase().includes(q));
}

/** Returns the PanelLibraryItem for a given autocomplete option string, or undefined. */
export function getPanelByOption(option: string): PanelLibraryItem | undefined {
  const name = extractPanelName(option);
  return PANEL_LIBRARY.find(p => p.panel_name === name);
}

/**
 * Maps panel library category values to the form's test_category values.
 * Panel library categories that have no direct form equivalent fall back to 'blood work'.
 */
export const PANEL_CATEGORY_TO_FORM_CATEGORY: Record<string, string> = {
  cardiology: 'cardiology',
  chemistry: 'chemistry',
  endocrinology: 'blood work',
  hematology: 'blood work',
  hepatology: 'hepatology',
  imaging: 'imaging',
  immunology: 'immunology',
  infectious: 'microbiology',
  lipids: 'blood work',
  microbiology: 'microbiology',
  nephrology: 'blood work',
  nutrition: 'blood work',
  obstetrics: 'blood work',
  oncology: 'blood work',
  pathology: 'pathology',
  toxicology: 'blood work',
};
