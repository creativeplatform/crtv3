# Running the Project with Docker

## Docker Setup

This project includes Docker configurations to simplify the setup and deployment process. Follow the steps below to build and run the application using Docker.

### Prerequisites

- Ensure Docker and Docker Compose are installed on your system.
- Verify the required versions:
  - Node.js: 22.13.1 (as specified in the Dockerfile)
  - Python: 3.9 (as specified in the server Dockerfile)

### Environment Variables

- Create a `.env` file in the root directory with the necessary environment variables. Refer to `.env.sample` for the required variables.

### Build and Run

1. Build the Docker images and start the services:

   ```bash
   docker-compose up --build
   ```

2. Access the application:

   - Frontend: [http://localhost:3000](http://localhost:3000)

### Exposed Ports

- `app` service: 3000
- `server` service: (no port exposed)

### Notes

- The `app` service depends on the `server` service and will start after the server is ready.
- The `app` service uses a bridge network for inter-service communication.

For further details, refer to the Dockerfiles and the `docker-compose.yml` file included in the project.