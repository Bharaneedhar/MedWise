# MedWise

**A Clinical Decision Support Portal for Outpatient Prescription Audit and Drug Interaction Alert Management**

---

## Overview

MedWise is a full-stack MERN (MongoDB, Express, React, Node.js) healthcare application designed to support safer and more informed outpatient prescription management through clinical decision support and medication safety alerts.

### Phase 1: Authentication & Authorization Foundation

Phase 1 provides the complete full-stack authentication system with:
- **Strict Role-Based Access Control (RBAC)** for three roles:
  1. `doctor` (Physician / Prescriber)
  2. `pharmacist` (Pharmacy Reviewer)
  3. `patient` (Care Recipient)
  *(Strictly NO Admin role)*
- **Two-Panel SaaS Authentication UI** with healthcare branding, live validation, and password visibility toggle.
- **Node.js & Express REST API** with modular architecture (config, models, controllers, middleware, routes, utils).
- **MongoDB & Mongoose User Model** with pre-save bcrypt password hashing.
- **Stateless JWT Authentication** with token generation, verification middleware, and role authorization middleware.
- **React 18 + Vite Frontend** with React Router v6, Axios interceptor, Context API state management, and protected routes.
- **Temporary Role-Specific Dashboard Placeholders** with session restoration and logout functionality.

---

## Project Structure

```
MedWise/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                 # MongoDB connection logic
│   │   ├── controllers/
│   │   │   └── authController.js     # Register, Login, GetMe controllers
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js     # Bearer JWT verification
│   │   │   ├── roleMiddleware.js     # Role-based authorization
│   │   │   └── errorMiddleware.js    # 404 & Centralized error handling
│   │   ├── models/
│   │   │   └── User.js               # Mongoose schema with bcrypt
│   │   ├── routes/
│   │   │   └── authRoutes.js         # /api/auth endpoints
│   │   ├── utils/
│   │   │   └── generateToken.js      # JWT token generator
│   │   └── server.js                 # Express server entry point
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Loading.jsx            # Clinical loading spinner
│   │   │   └── ProtectedRoute.jsx     # Route & role access guard
│   │   ├── context/
│   │   │   └── AuthContext.jsx        # Auth state management
│   │   ├── pages/
│   │   │   ├── Login.jsx              # Two-panel login page
│   │   │   ├── Register.jsx           # Two-panel registration page
│   │   │   ├── DoctorDashboard.jsx    # Doctor workspace placeholder
│   │   │   ├── PharmacistDashboard.jsx# Pharmacist workspace placeholder
│   │   │   └── PatientDashboard.jsx   # Patient workspace placeholder
│   │   ├── services/
│   │   │   └── authService.js         # Axios client with token abstraction
│   │   ├── App.jsx                    # Application router
│   │   ├── main.jsx                   # React root entry
│   │   └── index.css                  # Custom CSS design system
│   ├── .env.example
│   ├── .gitignore
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
│
└── README.md
```

---

## Setup & Running Guide

### 1. Backend Setup

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
4. Edit `backend/.env` with your actual MongoDB connection string and JWT secret:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   ```
5. Start the backend server:
   ```bash
   # Development (with auto-reload):
   npm run dev

   # Production:
   npm start
   ```
   *Backend will run on `http://localhost:5000`.*

---

### 2. Frontend Setup

1. Open a second terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
4. Verify `frontend/.env` has:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```
5. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *Frontend will run on `http://localhost:5173`.*

---

## API Reference

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register user (`doctor`, `pharmacist`, or `patient`), hash password, return JWT & user profile |
| `POST` | `/api/auth/login` | Public | Authenticate user credentials, return JWT & user profile |
| `GET` | `/api/auth/me` | Protected | Restore authenticated session from JWT token |
| `GET` | `/api/health` | Public | Service health check |

---

## Phase 1 Verification Checklist

- [x] Doctor, Pharmacist, and Patient role registration
- [x] Email validation, duplicate email rejection, and password min-length enforcement
- [x] Secure password hashing using bcrypt (10 rounds)
- [x] JWT token generation with user ID & role payload
- [x] Bearer token extraction and authentication middleware
- [x] Role-based authorization middleware rejecting unauthorized roles with HTTP 403
- [x] Two-panel desktop authentication UI with MedWise branding & highlights
- [x] Responsive layout adapting smoothly to tablets and mobile devices
- [x] Role-based dashboard redirection on login/register:
  - Doctor -> `/doctor/dashboard`
  - Pharmacist -> `/pharmacist/dashboard`
  - Patient -> `/patient/dashboard`
- [x] Protected frontend routes guarding unauthorized access
- [x] Persistent session restoration via `GET /api/auth/me`
- [x] Logout removing JWT and clearing application state
- [x] No Admin role, routes, or permissions created
