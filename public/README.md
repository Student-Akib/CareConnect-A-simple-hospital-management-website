# Frontend Setup

## API Configuration

The frontend communicates with the backend server. The API base URL is configured in `js/common/config.js`.

### Default Configuration
- **API Base URL**: `http://localhost:3000`
- **Server Port**: 3000

### Changing the API URL

If your backend server runs on a different port or host, update the `API_BASE_URL` in `js/common/config.js`:

```javascript
export const API_BASE_URL = 'http://your-server-host:port';
```

### Development vs Production

For different environments, you can modify the config file:

**Development:**
```javascript
export const API_BASE_URL = 'http://localhost:3000';
```

**Production:**
```javascript
export const API_BASE_URL = 'https://your-production-domain.com';
```

## File Structure

```
public/
├── css/
│   └── style.css
├── images/
│   ├── branches-icon.png
│   ├── hero-background.jpg
│   └── patient-icon.png
├── js/
│   ├── common/
│   │   ├── auth.js (authentication helpers)
│   │   ├── config.js (API configuration)
│   │   └── nav.js (navigation logic)
│   ├── branches.js
│   ├── dashboard.js
│   ├── homepage.js
│   ├── login.js
│   └── register.js
├── branches.html
├── dashboard.html
├── index.html
├── login.html
└── register.html
```

## Running the Frontend

1. **Using a local server** (recommended):
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js (if you have http-server installed)
   npx http-server -p 8000
   
   # Using PHP
   php -S localhost:8000
   ```

2. **Access the application**:
   - Open `http://localhost:8000` in your browser
   - The frontend will communicate with the backend on `http://localhost:3000`

## Notes

- All API calls use the centralized configuration from `config.js`
- The frontend and backend run on different ports to avoid conflicts
- CORS is enabled on the backend to allow cross-origin requests
- Make sure the backend server is running before testing the frontend 