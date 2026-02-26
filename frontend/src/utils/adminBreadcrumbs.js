/**
 * Breadcrumb generation for admin routes.
 * Maps admin paths to human-readable labels and builds crumb arrays.
 */

const ADMIN_ROUTE_LABELS = {
  '/admin': 'Admin',
  '/admin/data-models': 'Data Models',
  '/admin/users': 'User Management',
  '/admin/trash': 'Trash',
  '/admin/audit-log': 'Audit Log',
  '/admin/system-health': 'System Health',
  '/admin/backup': 'Backup Management',
  '/admin/tools': 'Maintenance',
  '/admin/settings': 'Settings',
  '/admin/create-user': 'Create User',
  '/admin/analytics': 'Analytics',
};

/**
 * Humanize a snake_case or kebab-case model name.
 * e.g. "lab_result" -> "Lab Result", "emergency-contact" -> "Emergency Contact"
 */
function humanize(str) {
  return str
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Generate breadcrumb items for an admin pathname.
 *
 * @param {string} pathname - Current location pathname
 * @returns {Array<{label: string, path: string|null}>}
 *   Last item has path=null (current page). Returns single crumb for dashboard root.
 */
export function generateAdminBreadcrumbs(pathname) {
  // Always start with Admin root
  const crumbs = [{ label: 'Admin', path: '/admin' }];

  // Dashboard root — just the single crumb
  if (pathname === '/admin' || pathname === '/admin/') {
    return crumbs;
  }

  // Static route match
  if (ADMIN_ROUTE_LABELS[pathname]) {
    crumbs.push({ label: ADMIN_ROUTE_LABELS[pathname], path: null });
    return crumbs;
  }

  // Dynamic model routes: /admin/models/:modelName[/:recordId[/edit|/create]]
  const modelMatch = pathname.match(
    /^\/admin\/models\/([^/]+)(?:\/([^/]+))?(?:\/(edit|create))?$/
  );

  if (modelMatch) {
    const [, modelName, recordId, action] = modelMatch;
    const modelLabel = humanize(modelName);

    crumbs.push({ label: 'Data Models', path: '/admin/data-models' });
    crumbs.push({
      label: modelLabel,
      path: recordId ? `/admin/models/${modelName}` : null,
    });

    if (recordId && recordId !== 'create') {
      crumbs.push({
        label: action === 'edit' ? 'Edit' : `Record ${recordId}`,
        path: action ? `/admin/models/${modelName}/${recordId}` : null,
      });

      if (action === 'edit') {
        crumbs.push({ label: 'Edit', path: null });
      }
    } else if (recordId === 'create') {
      crumbs.push({ label: 'Create', path: null });
    }

    // Ensure last crumb has path=null
    if (crumbs[crumbs.length - 1].path !== null) {
      crumbs[crumbs.length - 1].path = null;
    }

    return crumbs;
  }

  // Fallback: split pathname and build crumbs from segments
  const segments = pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean);
  let currentPath = '/admin';

  for (let i = 0; i < segments.length; i++) {
    currentPath += `/${segments[i]}`;
    const isLast = i === segments.length - 1;
    const label = ADMIN_ROUTE_LABELS[currentPath] || humanize(segments[i]);
    crumbs.push({ label, path: isLast ? null : currentPath });
  }

  return crumbs;
}
