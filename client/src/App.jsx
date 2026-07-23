import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import PlacementDetail from './pages/PlacementDetail';
import Timeline from './pages/Timeline';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="h-screen overflow-hidden flex flex-col">
          <Navbar />
          <main id="main-content" className="flex-1 min-h-0 overflow-y-auto content-scrollbar">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/placement/:id" element={<PlacementDetail />} />
              <Route path="/timeline" element={<Timeline />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
