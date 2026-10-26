# MedWise Backend API - Phase 1 (Authentication Module)

MedWise is a Clinical Decision Support Portal for Outpatient Prescription Audit and Drug Interaction Alert Management. This backend service powers user authentication, role-based authorization, and token issuance for the platform.

## Roles Supported
- `doctor`
- `pharmacist`
- `patient`

*(Note: There is strictly no Admin role in this system.)*

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB + Mongoose ODM
- **Authentication**: JWT (`jsonwebtoken`) & `bcryptjs`
- **Security**: CORS, Environment Variable Isolation, Clean JSON Error Handlers

---

## Directory Structure

```
backend/
├── src/
│   ├── config/
│   │   └── db.js                 # MongoDB connection logic
│   ├── controllers/
│   │   └── authController.js     # Register, Login, and GetMe handlers
│   ├── middleware/
│   │   ├── authMiddleware.js     # Bearer token verification
│   │   ├── roleMiddleware.js     # Role-based access control
│   │   └── errorMiddleware.js    # 404 and global error formatting
│   ├── models/
│   │   └── User.js               # Mongoose schema with bcrypt hashing
│   ├── routes/
│   │   └── authRoutes.js         # /api/auth route definitions
│   ├── utils/
│   │   └── generateToken.js      # JWT generator utility
│   └── server.js                 # Express server bootstrap
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Populate your `.env` file with your credentials:
   ```env
   PORT=5000
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/medwise?retryWrites=true&w=majority
   JWT_SECRET=your_super_secret_jwt_key_here
   ```

---

## Installation & Running

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Run in development mode (with nodemon)
npm run dev

# Run in production mode
npm start
```

---

## API Endpoints

### 1. Register User
- **URL**: `POST /api/auth/register`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "name": "Dr. Sarah Jenkins",
    "email": "sarah.jenkins@hospital.org",
    "password": "Password123!",
    "role": "doctor"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Registration successful",
    "token": "eyJhbGciOi...",
    "user": {
      "id": "664f...",
      "name": "Dr. Sarah Jenkins",
      "email": "sarah.jenkins@hospital.org",
      "role": "doctor"
    }
  }
  ```

### 2. Login User
- **URL**: `POST /api/auth/login`
- **Access**: Public
- **Request Body**:
  ```json
  {
    "email": "sarah.jenkins@hospital.org",
    "password": "Password123!"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "token": "eyJhbGciOi...",
    "user": {
      "id": "664f...",
      "name": "Dr. Sarah Jenkins",
      "email": "sarah.jenkins@hospital.org",
      "role": "doctor"
    }
  }
  ```

### 3. Get Current User (Session Restore)
- **URL**: `GET /api/auth/me`
- **Access**: Private (Requires `Authorization: Bearer <token>`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "user": {
      "id": "664f...",
      "name": "Dr. Sarah Jenkins",
      "email": "sarah.jenkins@hospital.org",
      "role": "doctor"
    }
  }
  ```
