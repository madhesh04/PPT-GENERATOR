import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

/**
 * AdminRoute — Role-based route guard.
 * Redirects non-admin users to the dashboard instead of showing the admin panel.
 * 
 * Usage in App.tsx:
 *   <Route element={<AdminRoute />}>
 *     <Route path="/admin" element={<AdminView />} />
 *   </Route>
 */
export function AdminRoute() {
  const { user } = useAuthStore();
  const role = user?.role?.toUpperCase();

  if (role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
