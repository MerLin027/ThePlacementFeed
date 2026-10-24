import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { MyApplicationsProvider } from './context/MyApplicationsContext';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';
import RequireRole, { PageSpinner } from './components/RequireRole';
import RouteEffects from './components/RouteEffects';
import PageTransition from './components/PageTransition';
import Home from './pages/Home';
import PlacementDetail from './pages/PlacementDetail';
import Timeline from './pages/Timeline';
import AdminLogin from './pages/AdminLogin';
import NotFound from './pages/NotFound';
import StudentLogin from './pages/StudentLogin';
import StudentSignup from './pages/StudentSignup';
import StudentProfile from './pages/StudentProfile';
import ChangePassword from './pages/ChangePassword';
import MyApplications from './pages/MyApplications';

// Admin pages load on demand: students never download them
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminStudents = lazy(() => import('./pages/AdminStudents'));
const AdminApplicants = lazy(() => import('./pages/AdminApplicants'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MyApplicationsProvider>
        <NotificationProvider>
          <div className="h-dvh overflow-hidden flex flex-col">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-60 focus:px-4 focus:py-3 focus:rounded-lg focus:bg-primary-container focus:text-on-primary focus:font-label-md"
            >
              Skip to main content
            </a>
            <RouteEffects />
            {/* Bottom-centre: never covers the header, the bell or its open panel (desktop or phone) */}
            <Toaster
              position="bottom-center"
              containerStyle={{ bottom: 16 }}
              toastOptions={{
                className: 'font-body-sm text-body-sm',
                style: {
                  borderRadius: '1rem',
                  padding: '10px 14px',
                  color: 'var(--color-on-surface)',
                  border: '1px solid var(--color-outline-variant)',
                  boxShadow: 'var(--shadow-pop)',
                },
              }}
            />
            <Navbar />
          <main id="main-content" tabIndex={-1} className="flex-1 min-h-0 overflow-y-auto content-scrollbar focus:outline-hidden">
            <PageTransition>
            <Suspense fallback={<PageSpinner />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/placement/:id" element={<PlacementDetail />} />
              <Route path="/timeline" element={<Timeline />} />
              <Route path="/login" element={<StudentLogin />} />
              <Route path="/signup" element={<StudentSignup />} />
              <Route
                path="/profile"
                element={
                  <RequireRole role="student">
                    <StudentProfile />
                  </RequireRole>
                }
              />
              <Route
                path="/applications"
                element={
                  <RequireRole role="student">
                    <MyApplications />
                  </RequireRole>
                }
              />
              <Route
                path="/change-password"
                element={
                  <RequireRole role="student" allowPendingPasswordChange>
                    <ChangePassword />
                  </RequireRole>
                }
              />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin/dashboard"
                element={
                  <RequireRole role="admin">
                    <AdminDashboard />
                  </RequireRole>
                }
              />
              <Route
                path="/admin/drives/:driveId/applicants"
                element={
                  <RequireRole role="admin">
                    <AdminApplicants />
                  </RequireRole>
                }
              />
              <Route
                path="/admin/students"
                element={
                  <RequireRole role="admin">
                    <AdminStudents />
                  </RequireRole>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <RequireRole role="admin">
                    <AdminSettings />
                  </RequireRole>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </PageTransition>
          </main>
          <Footer />
        </div>
        </NotificationProvider>
        </MyApplicationsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
