import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import render from '../../../../test-utils/render';
import AdminSettingsPage from '../AdminSettingsPage';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
};

export const renderPage = (path = '/admin/settings/users') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/admin/settings/:section?"
          element={
            <>
              <AdminSettingsPage />
              <LocationProbe />
            </>
          }
        />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
    { skipRouter: true }
  );
