# CareConnect Hospital Server

A Node.js/Express server for the CareConnect Hospital management system.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   Create a `.env` file in the server directory with the following variables:
   ```env
   # Database Configuration (choose one option)
   
   # Option 1: Connection String
   DATABASE_URL=postgresql://username:password@localhost:5432/database_name
   
   # Option 2: Individual Variables
   DB_USER=your_username
   DB_HOST=localhost
   DB_NAME=your_database_name
   DB_PASSWORD=your_password
   DB_PORT=5432
   
   # JWT Secret
   JWT_SECRET=your_super_secret_key_that_should_be_in_an_env_file
   
   # Server Port (optional, defaults to 3000)
   PORT=3000
   ```

3. **Start the server:**
   ```bash
   # Development (with auto-restart)
   npm run dev
   
   # Production
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

### Users
- `GET /api/users/me` - Get current user info
- `GET /api/users/notifications` - Get user notifications
- `PUT /api/users/me` - Update user profile
- `DELETE /api/users/me` - Delete user account
- `GET /api/users/dashboard` - Get dashboard data

### Branches
- `GET /api/branches` - Get all branches

## Database

The server connects to a PostgreSQL database. Make sure your database is running and the connection details are correctly configured in your `.env` file.

## Development

- Uses `nodemon` for automatic server restart during development
- CORS enabled for frontend communication
- JWT-based authentication
- Standardized error responses 