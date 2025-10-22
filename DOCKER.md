# Docker Setup Guide for Bright-Buy

This guide will help you run the Bright-Buy application using Docker and Docker Compose.

## Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 2.0 or higher)

## Quick Start

1. **Clone the repository** (if you haven't already)
   ```bash
   git clone <repository-url>
   cd Bright-Buy
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   ```

3. **Configure environment variables**
   
   Edit the `.env` file with your settings:
   - Change `JWT_SECRET` to a secure random string
   - Update database credentials if needed
   - Configure CORS origins for your frontend URLs

4. **Build and start all services**
   ```bash
   docker-compose up --build
   ```

   Or run in detached mode:
   ```bash
   docker-compose up -d --build
   ```

## Services

The application consists of three services:

### 1. Database (PostgreSQL)
- **Container:** `brightbuy-db`
- **Port:** `5432`
- **Volume:** `postgres_data` (persistent storage)

### 2. Backend API
- **Container:** `brightbuy-backend`
- **Port:** `5000`
- **Technology:** Node.js + Express

### 3. Frontend
- **Container:** `brightbuy-frontend`
- **Port:** `3000` (mapped to internal port 80)
- **Technology:** React + Nginx

## Accessing the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **Database:** localhost:5432

## Useful Commands

### Start services
```bash
docker-compose up
```

### Start services in background
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### Stop services and remove volumes
```bash
docker-compose down -v
```

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f database
```

### Rebuild containers
```bash
docker-compose up --build
```

### Restart a specific service
```bash
docker-compose restart backend
```

### Execute commands in running containers
```bash
# Access backend shell
docker-compose exec backend sh

# Access database shell
docker-compose exec database psql -U postgres -d brightbuy
```

## Database Initialization

The database is automatically initialized with SQL scripts located in the `backend` directory:
- `DB script.sql` - Main schema
- `procedures.sql` - Stored procedures
- `views.sql` - Database views
- `Triggers.sql` - Database triggers

These scripts run automatically when the database container is first created.

## Development Tips

### Hot Reloading

For development with hot reloading, you can mount your source code as volumes:

Create a `docker-compose.dev.yml` file:
```yaml
version: '3.8'

services:
  backend:
    volumes:
      - ./backend:/app
      - /app/node_modules
    environment:
      NODE_ENV: development
    command: npm run dev

  frontend:
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm start
```

Then run:
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Environment-Specific Overrides

You can create additional compose files for different environments:
- `docker-compose.dev.yml` - Development
- `docker-compose.prod.yml` - Production

## Troubleshooting

### Port Conflicts
If ports are already in use, modify the port mappings in `docker-compose.yml`:
```yaml
ports:
  - "3001:80"  # Change 3000 to 3001
```

### Database Connection Issues
- Ensure the database service is healthy: `docker-compose ps`
- Check logs: `docker-compose logs database`
- Verify environment variables in `.env`

### Volume Permissions
On Linux/Mac, you might need to adjust file permissions:
```bash
sudo chown -R $USER:$USER backend/Assets
```

### Clean Build
If you encounter build issues, try a clean rebuild:
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

## Production Deployment

For production deployment:

1. Update environment variables with secure values
2. Use production-grade database credentials
3. Configure proper CORS origins
4. Consider using Docker Swarm or Kubernetes for orchestration
5. Set up SSL/TLS certificates
6. Configure proper logging and monitoring

## Notes

- The backend Assets folder is mounted as a volume to persist uploaded files
- Database data persists in the `postgres_data` volume
- The frontend is served through Nginx for optimal performance
- All services are connected through a custom bridge network

## Support

For issues or questions, please refer to the main README.md or open an issue in the repository.
