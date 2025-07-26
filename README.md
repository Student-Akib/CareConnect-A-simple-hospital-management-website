# CareConnect Hospital Management System

A full-stack web application for hospital management with patient portal functionality.

## Project Structure

```
h0/
├── server/                 # Backend (Node.js/Express)
│   ├── controllers/       # Route handlers
│   ├── routes/           # API route definitions
│   ├── db.js            # Database connection
│   ├── server.js        # Main server file
│   └── package.json     # Backend dependencies
├── public/               # Frontend (HTML/CSS/JS)
│   ├── js/              # JavaScript files
│   │   ├── common/      # Shared utilities
│   │   └── *.js         # Page-specific scripts
│   ├── css/             # Stylesheets
│   ├── images/          # Static assets
│   └── *.html           # HTML pages
└── database/            # Database files (if any)
```

## Quick Start

### Backend Setup
1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your database configuration:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/database_name
   JWT_SECRET=your_super_secret_key_here
   PORT=3000
   ```

4. Start the server:
   ```bash
   npm run dev  # Development with auto-restart
   # or
   npm start    # Production
   ```

### Frontend Setup
1. Serve the frontend files using any static file server
2. Open `http://localhost:5000` (or your preferred port) in your browser

## Features

### Patient Portal
- User registration and authentication
- Personal dashboard with notifications
- Branch location information
- Profile management (coming soon)
- Appointment booking (coming soon)

### Backend API
- RESTful API with JWT authentication
- PostgreSQL database integration
- CORS enabled for frontend communication
- Standardized error handling

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/users/me` - Get current user info
- `GET /api/users/notifications` - Get user notifications
- `GET /api/branches` - Get all branches

## Technology Stack

### Backend
- Node.js with Express
- PostgreSQL database
- JWT for authentication
- bcrypt for password hashing

### Frontend
- Vanilla JavaScript (ES6 modules)
- HTML5 and CSS3
- Responsive design
- Local storage for session management

## Development

- Backend runs on `http://localhost:3000`
- Frontend can be served on any port (e.g., `http://localhost:5000`)
- Uses nodemon for backend development
- CORS configured for cross-origin requests

## Environment Variables

Required environment variables for the backend:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `PORT` - Server port (defaults to 3000)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for educational purposes.
