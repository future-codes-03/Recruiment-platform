import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/shared/ProtectedRoute";

import LandingPage from "./pages/public/LandingPage";
import AuthPage from "./pages/public/AuthPage";
import VerifyEmailPage from "./pages/public/VerifyEmailPage";
import ForgotPasswordPage from "./pages/public/ForgotPasswordPage";
import ResetPasswordPage from "./pages/public/ResetPasswordPage";
import NotFoundPage from "./pages/public/NotFoundPage";

import EmployerDashboard from "./pages/employer/Dashboard";
import JobForm from "./pages/employer/JobForm";
import JobDetail from "./pages/employer/JobDetail";
import JobRankedList from "./pages/employer/JobRankedList";
import JobSettings from "./pages/employer/JobSettings";
import CandidateDetail from "./pages/employer/CandidateDetail";
import Billing from "./pages/employer/Billing";
import EmployerSettings from "./pages/employer/Settings";
import StyleGuide from "./pages/employer/StyleGuide";

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
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

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
              <ProtectedRoute roles={["company_admin", "recruiter"]}>
                <EmployerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/jobs/new"
            element={
              <ProtectedRoute roles={["company_admin", "recruiter"]}>
                <JobForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/jobs/:id/edit"
            element={
              <ProtectedRoute roles={["company_admin", "recruiter"]}>
                <JobForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/jobs/:id/ranked"
            element={
              <ProtectedRoute roles={["company_admin", "recruiter"]}>
                <JobRankedList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/jobs/:id/settings"
            element={
              <ProtectedRoute roles={["company_admin", "recruiter"]}>
                <JobSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/jobs/:id/candidates/:candidateId"
            element={
              <ProtectedRoute roles={["company_admin", "recruiter"]}>
                <CandidateDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/jobs/:id"
            element={
              <ProtectedRoute roles={["company_admin", "recruiter"]}>
                <JobDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/billing"
            element={
              <ProtectedRoute roles={["company_admin", "recruiter"]}>
                <Billing />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employer/settings"
            element={
              <ProtectedRoute roles={["company_admin", "recruiter"]}>
                <EmployerSettings />
              </ProtectedRoute>
            }
          />
          {/* Design reference only — not linked from the app, no real data,
              intentionally left unprotected so it's easy to pull up for a
              styling check without needing to be logged in as a company. */}
          <Route path="/employer/styleguide" element={<StyleGuide />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
