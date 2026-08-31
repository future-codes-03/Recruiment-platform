import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Wrap any page that requires login: <ProtectedRoute><Dashboard/></ProtectedRoute>
// Optionally restrict by role: <ProtectedRoute role="candidate">...</ProtectedRoute>
export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) return null; // or a spinner, once we have one

  if (!user) return <Navigate to="/login" replace />;

  if (role && user.role !== role) {
    // Logged in, but wrong side of the platform (e.g. a candidate hitting
    // an employer-only route) — send them back to their own home.
    return <Navigate to="/" replace />;
  }

  return children;
}
