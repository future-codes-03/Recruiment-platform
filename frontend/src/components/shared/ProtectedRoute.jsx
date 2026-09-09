import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// Wrap any page that requires login: <ProtectedRoute><Dashboard/></ProtectedRoute>
// Restrict by role with either a single role or a list:
//   <ProtectedRoute role="candidate">...</ProtectedRoute>
//   <ProtectedRoute roles={["company_admin", "recruiter"]}>...</ProtectedRoute>
export default function ProtectedRoute({ children, role, roles }) {
  const { user, loading } = useAuth();
  const allowed = roles ?? (role ? [role] : null);

  if (loading) return null; // or a spinner, once we have one

  if (!user) return <Navigate to="/login" replace />;

  if (allowed && !allowed.includes(user.role)) {
    // Logged in, but wrong side of the platform (e.g. a candidate hitting
    // an employer-only route) — send them back to their own home.
    return <Navigate to="/" replace />;
  }

  return children;
}
