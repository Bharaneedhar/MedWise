import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDoctorPatients } from '../services/doctorService';
import DoctorLayout from '../components/DoctorLayout';
import Loading from '../components/Loading';
import { formatDisplayDate } from '../utils/patientUtils';
import {
  Users,
  Search,
  ArrowRight,
  Droplet,
  Pill,
  Activity,
  Calendar,
  AlertCircle,
  CreditCard,
  UserCheck,
} from 'lucide-react';

const DoctorPatients = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const fetchPatients = async (query = '') => {
    try {
      if (query) setSearching(true);
      const data = await getDoctorPatients(query);
      if (data) {
        setPatients(data.patients || []);
      }
    } catch (err) {
      console.warn('Failed to load doctor patients:', err.message);
      setError('Could not retrieve patient list. Please try again.');
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPatients(searchQuery);
  };

  if (loading) {
    return <Loading message="Loading patient clinical index..." />;
  }

  return (
    <DoctorLayout>
      {/* PAGE HEADER */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'var(--slate-900)',
            }}
          >
            My Patients
          </h1>
          <span
            className="card-section-badge"
            style={{
              background: 'var(--accent-emerald-light)',
              color: 'var(--accent-emerald)',
              border: '1px solid #a7f3d0',
            }}
          >
            {patients.length} Active Records
          </span>
        </div>
        <p style={{ fontSize: '0.95rem', color: 'var(--slate-500)' }}>
          Search and access longitudinal clinical health records for your under-care patients.
        </p>
      </div>

      {error && (
        <div className="alert-box error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle className="alert-icon" />
          <span>{error}</span>
        </div>
      )}

      {/* SEARCH BAR */}
      <div
        className="dashboard-card-section"
        style={{
          marginBottom: '2rem',
          padding: '1.25rem 1.5rem',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="input-wrapper" style={{ flex: 1, minWidth: '260px' }}>
            <Search className="input-icon-left" />
            <input
              type="text"
              className="form-input has-left-icon"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={searching}
            style={{ minWidth: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {searching ? (
              <div className="spinner-sm" />
            ) : (
              <>
                <Search size={16} />
                <span>Search</span>
              </>
            )}
          </button>
          {searchQuery && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSearchQuery('');
                fetchPatients('');
              }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* PATIENTS LIST */}
      {patients.length === 0 ? (
        <div className="dashboard-card-section" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
          <Users className="empty-state-icon" size={42} style={{ color: 'var(--slate-400)' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-800)', marginTop: '0.75rem', marginBottom: '0.25rem' }}>
            {searchQuery ? 'No Matching Patient Found' : 'No Patient Records in Workspace'}
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--slate-500)', maxWidth: '440px', margin: '0.5rem auto 1.5rem auto' }}>
            {searchQuery
              ? `No patient matches "${searchQuery}". Please verify the Patient ID, mobile number, or spelling.`
              : 'Patients who consult with you or receive prescriptions authored by your practice will appear in your clinical list.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {patients.map((patient) => (
            <div
              key={patient.patientId}
              className="stat-summary-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                padding: '1.5rem',
                gap: '1.25rem',
              }}
            >
              {/* CARD TOP */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div
                    className="user-avatar-circle"
                    style={{
                      width: '44px',
                      height: '44px',
                      background: 'var(--primary-100)',
                      color: 'var(--primary-700)',
                      fontSize: '1rem',
                      fontWeight: 700,
                    }}
                  >
                    {patient.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--slate-900)', margin: 0, lineHeight: 1.2 }}>
                      {patient.name}
                    </h3>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--accent-emerald)', fontWeight: 700, marginTop: '2px' }}>
                      {patient.pid}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    background: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <Droplet size={11} />
                  <span>{patient.bloodGroup}</span>
                </span>
              </div>

              {/* DEMOGRAPHICS & CLINICAL SUMMARY PILLS */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.65rem',
                  padding: '0.85rem',
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-200)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--slate-500)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>Age / Gender</span>
                  <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{patient.age} yrs • {patient.gender}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--slate-500)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>Active Medications</span>
                  <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{patient.activeMedicationsCount} Drugs</span>
                </div>
                <div>
                  <span style={{ color: 'var(--slate-500)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>Conditions</span>
                  <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{patient.medicalConditionsCount} Documented</span>
                </div>
                <div>
                  <span style={{ color: 'var(--slate-500)', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700 }}>Last Consult</span>
                  <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>
                    {patient.lastConsultationDate ? formatDisplayDate(patient.lastConsultationDate) : 'None'}
                  </span>
                </div>
              </div>

              {/* ACTION BUTTON */}
              <Link
                to={`/doctor/patients/${patient.patientId}`}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '0.85rem',
                  padding: '0.65rem 1rem',
                  textDecoration: 'none',
                }}
              >
                <span>View Longitudinal Record</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </DoctorLayout>
  );
};

export default DoctorPatients;
