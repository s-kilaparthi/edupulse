import { Navigate, Outlet } from 'react-router-dom'

export default function ProtectedRoute({ session }) {
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
