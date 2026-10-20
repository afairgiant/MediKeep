import { generateAdminBreadcrumbs } from '../adminBreadcrumbs';

test('the settings root has a Settings crumb', () => {
  expect(generateAdminBreadcrumbs('/admin/settings')).toEqual([
    { label: 'Admin', path: '/admin' },
    { label: 'Settings', path: null },
  ]);
});

test('a settings section shares the Settings crumb', () => {
  expect(generateAdminBreadcrumbs('/admin/settings/backups')).toEqual([
    { label: 'Admin', path: '/admin' },
    { label: 'Settings', path: null },
  ]);
});
