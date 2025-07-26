# Server Setup

## Environment Variables

Create a `.env` file in the server directory with the following variables:

```
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=your_super_secret_jwt_key_here
PORT=3000
```

## Available Scripts

- `npm run dev` - Start server with nodemon (auto-restart on changes)
- `npm start` - Start server normally
- `npm test` - Run tests (not implemented yet)

## API Endpoints

### Authentication (`/api/auth`)
- `POST /login` - User login
- `POST /register` - User registration

### Users (`/api/users`) - All protected
- `GET /` - Get all users (admin only)
- `GET /me` - Get current user profile
- `GET /dashboard` - Get user dashboard
- `GET /notifications` - Get user notifications
- `PUT /me` - Update user profile
- `DELETE /me` - Delete user account

### Branches (`/api/branches`)
- `GET /` - Get all branches

## Database

Uses PostgreSQL with connection pooling. Make sure your database is running and accessible. 