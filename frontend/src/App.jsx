import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Loading from './components/Loading';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import CompleteProfile from './pages/CompleteProfile';

// Admin Pages
import AdminLogin from './pages/AdminLogin';
import AdminRegister from './pages/AdminRegister';
import AdminAppointments from './pages/AdminAppointments';

// Doctor Pages
import DoctorDashboard from './pages/DoctorDashboard';
import DoctorPatients from './pages/DoctorPatients';
import PatientClinicalRecord from './pages/PatientClinicalRecord';
import DoctorConsultations from './pages/DoctorConsultations';
import NewConsultation from './pages/NewConsultation';
import ConsultationDetail from './pages/ConsultationDetail';
import DoctorPrescriptions from './pages/DoctorPrescriptions';
import NewPrescription from './pages/NewPrescription';
import PrescriptionDetail from './pages/PrescriptionDetail';
import MedwiseDetailedReport from './pages/MedwiseDetailedReport';
import DoctorMedwiseReviews from './pages/DoctorMedwiseReviews';
import DoctorClinicalOverview from './pages/DoctorClinicalOverview';
import DoctorProfile from './pages/DoctorProfile';

// Pharmacist Pages
import PharmacistDashboard from './pages/PharmacistDashboard';
import PharmacistPrescriptions from './pages/PharmacistPrescriptions';

// System Management Page
import SystemManagementDashboard from './pages/SystemManagementDashboard';

// Patient Pages
import PatientDashboard from './pages/PatientDashboard';
import PatientProfile from './pages/PatientProfile';
import PatientConsultations from './pages/PatientConsultations';
import PatientPrescriptions from './pages/PatientPrescriptions';

/**
 * Root Index Redirector: Sends authenticated user to their role dashboard,
 * incomplete users to /complete-profile, or unauthenticated visitor to login.
 */
const RootRedirector = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Loading message="Initializing MedWise Clinical Portal..." />;
  }

  if (!isAuthenticated || !user || !user.role) {
    return <Navigate to="/login" replace />;
  }

  // Incomplete profile → complete-profile page
  if (user.profileCompleted === false) {
    return <Navigate to="/complete-profile" replace />;
  }

  // Completed profile → role dashboard
  const roleRoutes = {
    doctor: '/doctor/dashboard',
    pharmacist: '/pharmacist/dashboard',
    patient: '/patient/dashboard',
    admin: '/admin/appointments',
  };

  const destination = roleRoutes[user.role];
  if (!destination) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={destination} replace />;
};

function App() {
  return (
    <Routes>
      {/* Root smart redirect */}
      <Route path="/" element={<RootRedirector />} />

      {/* Public Authentication Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Dedicated Admin Portal Authentication & Management Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/register" element={<AdminRegister />} />
      <Route
        path="/admin/appointments"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminAppointments />
          </ProtectedRoute>
        }
      />
      <Route path="/appointments" element={<Navigate to="/admin/appointments" replace />} />

      {/* Profile Completion – protected but exempt from profile-completion redirect */}
      <Route
        path="/complete-profile"
        element={
          <ProtectedRoute>
            <CompleteProfile />
          </ProtectedRoute>
        }
      />

      {/* ============================================================
          DOCTOR PORTAL ROUTES (Role: doctor)
          ============================================================ */}
      <Route
        path="/doctor/dashboard"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/patients"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorPatients />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/patients/:patientId"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <PatientClinicalRecord />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/consultations"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorConsultations />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/consultations/new"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <NewConsultation />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/consultations/:id"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <ConsultationDetail />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/prescriptions"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorPrescriptions />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/prescriptions/new"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <NewPrescription />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/prescriptions/:prescriptionId"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <PrescriptionDetail />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/prescriptions/:prescriptionId/report"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <MedwiseDetailedReport />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/medwise-reviews"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorMedwiseReviews />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/clinical-overview"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorClinicalOverview />
          </ProtectedRoute>
        }
      />

      <Route
        path="/doctor/profile"
        element={
          <ProtectedRoute allowedRoles={['doctor']}>
            <DoctorProfile />
          </ProtectedRoute>
        }
      />

      {/* ============================================================
          PHARMACIST PORTAL ROUTES (Role: pharmacist)
          ============================================================ */}
      <Route
        path="/pharmacist/dashboard"
        element={
          <ProtectedRoute allowedRoles={['pharmacist']}>
            <PharmacistDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pharmacist/prescriptions"
        element={
          <ProtectedRoute allowedRoles={['pharmacist']}>
            <PharmacistPrescriptions />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pharmacist/prescriptions/:prescriptionId"
        element={
          <ProtectedRoute allowedRoles={['pharmacist']}>
            <PrescriptionDetail />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pharmacist/prescriptions/:prescriptionId/report"
        element={
          <ProtectedRoute allowedRoles={['pharmacist']}>
            <MedwiseDetailedReport />
          </ProtectedRoute>
        }
      />

      {/* ============================================================
          PATIENT PORTAL ROUTES (Role: patient)
          ============================================================ */}
      <Route
        path="/patient/dashboard"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/patient/profile"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientProfile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/patient/consultations"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientConsultations />
          </ProtectedRoute>
        }
      />

      <Route
        path="/patient/prescriptions"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <PatientPrescriptions />
          </ProtectedRoute>
        }
      />

      <Route
        path="/patient/prescriptions/:prescriptionId/report"
        element={
          <ProtectedRoute allowedRoles={['patient']}>
            <MedwiseDetailedReport />
          </ProtectedRoute>
        }
      />

      {/* Tightly Protected System Management Dashboard */}
      <Route path="/system-management" element={<SystemManagementDashboard />} />

      {/* Catch-all fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
