import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/shared/ProtectedRoute";

import LandingPage from "./pages/public/LandingPage";
import AuthPage from "./pages/public/AuthPage";

// Placeholder pages for routes we haven't built yet this session —
// swapped for real pages one at a time as we build them.
function ComingSoon({ label }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-slate text-sm">
      {label} — not built yet
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage />} />
          <Route path="/verify-email" element={<ComingSoon label="Email verification" />} />
          <Route path="/forgot-password" element={<ComingSoon label="Forgot password" />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute role="candidate">
                <ComingSoon label="Candidate dashboard" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/dashboard"
            element={
              <ProtectedRoute role="company_admin">
                <ComingSoon label="Employer dashboard" />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
