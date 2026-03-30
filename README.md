# Wayfinder

A Trello-inspired kanban collaboration platform with a dark fantasy cyberpunk aesthetic. Manage projects through boards, lists, and cards in an immersive interface that feels like a hacker's command deck.

## Features

- **Board Management**: Create and organize multiple boards for different projects
- **Kanban Workflow**: Drag-and-drop cards between lists (Backlog, In Progress, Review, Done)
- **Card Details**: Labels, due dates, priority levels, assignees, descriptions
- **Comments & Activity**: Discussion threads and activity tracking on cards
- **Team Collaboration**: Workspaces, member management, role-based access
- **Dark Mode UI**: Immersive dark fantasy cyberpunk visual design
- **Responsive**: Works on desktop, tablet, and mobile devices
- **Secure**: JWT authentication, rate limiting, input validation

## Quick Start with Docker

```bash
# Clone the repository
git clone <repository-url>
cd wayfinder

# Start with Docker Compose
docker-compose up -d

# Access the application
open http://localhost:8008
```

The first user to register becomes the Super Admin.

## Production Deployment

To deploy Wayfinder to your own domain:

1. **Configure environment variables** in `docker-compose.yml`:
   ```yaml
   environment:
     - FRONTEND_URL=https://your-domain.com
     - ALLOWED_ORIGINS=https://your-domain.com
     - JWT_SECRET=your-secure-random-secret
   ```

   Or use shell environment variables:
   ```bash
   export FRONTEND_URL=https://your-domain.com
   export ALLOWED_ORIGINS=https://your-domain.com
   export JWT_SECRET=$(openssl rand -hex 64)
   ```

2. **Build and run**:
   ```bash
   docker-compose up -d --build
   ```

3. **Configure reverse proxy** (nginx, Caddy, Traefik):
   - Point your domain to port 8008
   - Enable HTTPS with Let's Encrypt
   - Set appropriate proxy headers

4. **Verify deployment**:
   ```bash
   # Check logs for CORS configuration
   docker-compose logs -f

   # Test health endpoint
   curl https://your-domain.com/api/health
   ```

### Environment Variables for Custom Domains

| Variable | Description | Default |
|----------|-------------|---------|
| `FRONTEND_URL` | Public URL for outbound links (emails, etc.) | `http://localhost:8008` |
| `ALLOWED_ORIGINS` | Allowed CORS origins (comma-separated). If empty, allows all HTTP/HTTPS origins. | (empty = permissive) |
| `JWT_SECRET` | Secret for JWT signing. Generate with `openssl rand -hex 64`. | Auto-generated |

See [CLAUDE.md](CLAUDE.md) for detailed configuration options and nginx example.

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Backend Setup

```bash
cd backend
cp .env.example .env
npm install
npm run init-db
npm run dev
```

The API will be available at `http://localhost:3001`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Environment Variables

### Backend (.env)

```
PORT=3001
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
DATABASE_PATH=./data/wayfinder.db
ALLOWED_ORIGINS=http://localhost:8008,http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Docker Environment

Set these in `docker-compose.yml` or pass via command line:

- `JWT_SECRET`: Will be auto-generated if not provided
- `PORT`: Default 8008
- `NODE_ENV`: production

## Project Structure

```
wayfinder/
  backend/
    src/
      controllers/    # Request handlers
      db/             # Database schema and connection
      middleware/     # Auth, validation middleware
      routes/         # API route definitions
      utils/          # Helper functions
      server.js       # Express server entry point
  frontend/
    src/
      components/     # React components
      pages/          # Page components
      store/          # Zustand state management
      styles/         # CSS styles
      utils/          # API client, helpers
  docker/
    entrypoint.sh     # Docker startup script
  Dockerfile
  docker-compose.yml
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get current user profile

### Workspaces
- `GET /api/workspaces` - List user's workspaces
- `POST /api/workspaces` - Create workspace
- `POST /api/workspaces/:id/invite` - Invite member

### Boards
- `GET /api/boards` - List boards
- `GET /api/boards/:id` - Get board with lists and cards
- `POST /api/boards` - Create board
- `PATCH /api/boards/:id` - Update board
- `DELETE /api/boards/:id` - Archive board

### Lists
- `POST /api/lists` - Create list
- `PATCH /api/lists/:id` - Update list
- `POST /api/lists/reorder` - Reorder lists
- `DELETE /api/lists/:id` - Archive list

### Cards
- `GET /api/cards/:id` - Get card details
- `POST /api/cards` - Create card
- `PATCH /api/cards/:id` - Update card
- `POST /api/cards/:id/move` - Move card
- `POST /api/cards/:id/labels` - Update card labels
- `POST /api/cards/:id/assignees` - Update card assignees
- `DELETE /api/cards/:id` - Archive card

### Comments
- `GET /api/comments/card/:cardId` - Get card comments
- `POST /api/comments` - Create comment
- `PATCH /api/comments/:id` - Update comment
- `DELETE /api/comments/:id` - Delete comment

## Security

- JWT-based authentication with secure token handling
- Password hashing with bcrypt (12 rounds)
- Rate limiting on all API endpoints
- Stricter rate limits on authentication endpoints
- Input validation and sanitization
- CORS configuration
- Helmet security headers
- Non-root Docker user

## Tech Stack

**Backend:**
- Node.js + Express
- SQLite with better-sqlite3
- JWT for authentication
- bcryptjs for password hashing
- express-validator for input validation

**Frontend:**
- React 18 with Vite
- React Router for navigation
- Zustand for state management
- @dnd-kit for drag-and-drop
- date-fns for date formatting
- react-hot-toast for notifications

**Infrastructure:**
- Docker + Docker Compose
- Multi-stage builds for optimized images

## License

MIT
