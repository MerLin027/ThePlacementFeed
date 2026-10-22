import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { MyApplicationsProvider } from './context/MyApplicationsContext';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';
import RequireRole from './components/RequireRole';
import Home from './pages/Home';
import PlacementDetail from './pages/PlacementDetail';
import Timeline from './pages/Timeline';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import NotFound from './pages/NotFound';
import StudentLogin from './pages/StudentLogin';
import StudentSignup from './pages/StudentSignup';
import StudentProfile from './pages/StudentProfile';
import ChangePassword from './pages/ChangePassword';
import AdminStudents from './pages/AdminStudents';
import AdminApplicants from './pages/AdminApplicants';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MyApplicationsProvider>
        <NotificationProvider>
          <div className="h-screen overflow-hidden flex flex-col">
            <Toaster position="top-right" />
            <Navbar />
          <main id="main-content" className="flex-1 min-h-0 overflow-y-auto content-scrollbar">
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
              <Route path="*" element={<NotFound />} />
            </Routes>
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
