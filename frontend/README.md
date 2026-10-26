# MedWise Frontend - Phase 1 (Authentication Module)

MedWise is a Clinical Decision Support Portal for Outpatient Prescription Audit and Drug Interaction Alert Management. This frontend application provides the user interface for authentication and role-based portal access for Doctors, Pharmacists, and Patients.

## Features in Phase 1
- **Professional Healthcare SaaS Design**: Two-panel branded authentication screens with clinical badges and iconography.
- **Form Validation & Security**: Password show/hide toggles, email regex verification, password length & confirmation checks.
- **Role-Based Access Control (RBAC)**: Protected routes restricting access to authorized dashboards (`/doctor/dashboard`, `/pharmacist/dashboard`, `/patient/dashboard`).
- **Session Persistence**: JWT restoration via `GET /api/auth/me` on application load.
- **Responsive Layout**: Desktop two-panel layout, adapting seamlessly to tablet and mobile viewports.

---

## Directory Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Loading.jsx            # Animated clinical spinner
│   │   └── ProtectedRoute.jsx     # Auth and role guard component
│   ├── context/
│   │   └── AuthContext.jsx        # Authentication state & provider
│   ├── pages/
│   │   ├── Login.jsx              # Sign In page (Two-panel layout)
│   │   ├── Register.jsx           # Registration page (Role selector)
│   │   ├── DoctorDashboard.jsx    # Doctor placeholder workspace
│   │   ├── PharmacistDashboard.jsx# Pharmacist placeholder workspace
│   │   └── PatientDashboard.jsx   # Patient placeholder workspace
│   ├── services/
│   │   └── authService.js         # Axios API client & token abstraction
│   ├── App.jsx                    # Routing configuration
│   ├── main.jsx                   # React root mounting
│   └── index.css                  # Complete CSS design system
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

---

## Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Set your backend API URL in `.env`:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

---

## Installation & Running

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```
