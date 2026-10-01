import { Route, Routes } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import RequireAuth from '../components/common/RequireAuth';
import CatalogPage from '../pages/catalog/CatalogPage';
import MedicineDetailPage from '../pages/catalog/MedicineDetailPage';
import ContactPage from '../pages/catalog/ContactPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import InventoryPage from '../pages/staff/InventoryPage';
import SalesPage from '../pages/staff/SalesPage';
import AlertsPage from '../pages/staff/AlertsPage';
import ReservationsPage from '../pages/staff/ReservationsPage';
import LoginPage from '../pages/auth/LoginPage';
import NotFoundPage from '../pages/NotFoundPage';

export default function App() {
  return (
    <AppShell>
      <Routes>
        {/* Public storefront */}
        <Route path="/" element={<CatalogPage />} />
        <Route path="/medicines/:id" element={<MedicineDetailPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Staff. RequireAuth sends anyone without a session to /login and
            remembers where they were headed. */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/inventory"
          element={
            <RequireAuth>
              <InventoryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/sales"
          element={
            <RequireAuth>
              <SalesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/alerts"
          element={
            <RequireAuth>
              <AlertsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/reservations"
          element={
            <RequireAuth>
              <ReservationsPage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
