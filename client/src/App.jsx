import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { MyApplicationsProvider } from './context/MyApplicationsContext';
import { Toaster } from 'react-hot-toast';
import { LazyMotion, MotionConfig } from 'motion/react';
import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';
import RequireRole, { PageSpinner } from './components/RequireRole';
import RouteEffects from './components/RouteEffects';
import PageTransition from './components/PageTransition';
import Backdrop from './components/backdrop/Backdrop';
import Home from './pages/Home';

// Only Home is in the first download; every other page loads when it is first visited
const PlacementDetail = lazy(() => import('./pages/PlacementDetail'));
const Timeline = lazy(() => import('./pages/Timeline'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const NotFound = lazy(() => import('./pages/NotFound'));
const StudentLogin = lazy(() => import('./pages/StudentLogin'));
const StudentSignup = lazy(() => import('./pages/StudentSignup'));
const StudentProfile = lazy(() => import('./pages/StudentProfile'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const MyApplications = lazy(() => import('./pages/MyApplications'));

// Admin pages load on demand: students never download them
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminStudents = lazy(() => import('./pages/AdminStudents'));
const AdminApplicants = lazy(() => import('./pages/AdminApplicants'));
const AdminSettings = lazy(() => import('./pages/AdminSettings'));

// Motion's features load after the first render (motionFeatures.js); `strict` keeps code on the
// lightweight `m.` components
const loadMotionFeatures = () => import('./motionFeatures').then((mod) => mod.default);

function App() {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
      <LazyMotion features={loadMotionFeatures} strict>
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
            <Backdrop />
            {/* Bottom-centre: never covers the header, the bell or its open panel (desktop or phone) */}
            <Toaster
              position="bottom-center"
              // Lifted above the floating selection bar while it is open (set by SelectionBar)
              containerStyle={{ bottom: 'calc(16px + var(--selection-bar-lift, 0px))' }}
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
          <main id="main-content" tabIndex={-1} className="flex-1 min-h-0 flex flex-col overflow-y-auto content-scrollbar focus:outline-hidden">
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
                path="/admin/change-password"
                element={
                  <RequireRole role="admin">
                    <ChangePassword forAdmin />
                  </RequireRole>
                }
              />
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
            {/* Inside the scroller: the footer comes after the page, it does not stay on screen */}
            <Footer />
          </main>
        </div>
        </NotificationProvider>
        </MyApplicationsProvider>
      </AuthProvider>
      </LazyMotion>
      </MotionConfig>
    </BrowserRouter>
  );
}

export default App;
