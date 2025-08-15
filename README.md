# Resume Builder Backend

A Node.js backend API for a resume builder application built with Express.js, Sequelize ORM, and PostgreSQL.

## Features

- RESTful API under base path `/api`
- PostgreSQL with Sequelize ORM
- JWT authentication (Bearer tokens) with revocation
- Email verification flow for signup
- Google and Facebook OAuth (Passport)
- Input validation with Zod
- Centralized error handling middleware
- CORS enabled
- Structured logging with Winston
- Environment-based configuration
- Docker support

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Sequelize
- **Auth**: Passport (Google, Facebook), JWT
- **Validation**: Zod
- **Email**: Nodemailer + Handlebars templates
- **Logging**: Winston
- **Development**: Nodemon for hot reloading
- **Containerization**: Docker & Docker Compose

## Prerequisites

Before running this application locally, make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v14 or higher)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [PostgreSQL](https://www.postgresql.org/) (v12 or higher)
- [Git](https://git-scm.com/)

## Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/huzaifa-khambaty/resume_builder_back.git
cd resume_builder_back
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory and configure the following environment variables:

```env
# Server
PORT=4000
NODE_ENV=development
BACKEND_URL=http://localhost:4000
FRONTEND_URL=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=resume_builder
DB_USERNAME=your_db_username
DB_PASSWORD=your_db_password

# JWT & Email Verification
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h
EMAIL_VERIFICATION_EXPIRES_IN=15m

# Google OAuth (Passport)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Facebook OAuth (Passport)
FACEBOOK_CLIENT_ID=your_facebook_client_id
FACEBOOK_CLIENT_SECRET=your_facebook_client_secret
```

### 4. Database Setup

Make sure PostgreSQL is running on your machine, then:

1. Create a database named `resume_builder`:

   ```sql
   CREATE DATABASE resume_builder;
   ```

2. Run database migrations:

   ```bash
   npx sequelize-cli db:migrate
   ```

3. (Optional) Run seeders to populate initial data:
   ```bash
   npx sequelize-cli db:seed:all
   ```

## Running the Application

### Development Mode (with hot reloading)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:4000` (or the port specified in your `.env` file). All routes are prefixed with `/api`.

## Docker Setup (Alternative)

If you prefer using Docker:

### 1. Using Docker Compose

```bash
docker-compose up -d
```

This will start both the application and PostgreSQL database in containers.

### 2. Using Docker only

```bash
# Build the image
docker build -t resume-builder-backend .

# Run the container
docker run -p 3000:3000 --env-file .env resume-builder-backend
```

## Check Server Health = (Is Server Running?)

- **GET** `/api/health` - Check if the server is running

```bash
curl http://localhost:4000/api/health
```

Response:

```json
{
  "status": "ok",
  "message": "Server is running!!!"
}
```

## Project Structure

```
resume_builder_back/
├── src/
│   ├── config/          # Env-based config, Sequelize and Passport
│   ├── controllers/     # Route controllers
│   ├── emails/          # Email templates and renderer
│   ├── middlewares/     # Auth and error handler
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic (candidates, lookup, email, pagination)
│   ├── validations/     # Zod schemas and helpers
│   └── index.js         # Application entry point (mounts /api)
├── .env                 # Environment variables (create this)
├── .gitignore          # Git ignore rules
├── .sequelizerc        # Sequelize CLI configuration
├── docker-compose.yml  # Docker compose configuration
├── Dockerfile          # Docker configuration
├── package.json        # Node.js dependencies and scripts
└── README.md           # This file
```

## Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with nodemon
- `npx sequelize-cli db:migrate` - Run database migrations
- `npx sequelize-cli db:seed:all` - Run database seeders
- `npx sequelize-cli migration:generate --name migration-name` - Generate new migration
- `npx sequelize-cli seed:generate --name seed-name` - Generate new seed file

## Development Guidelines

### Database Migrations

To create a new migration:

```bash
npx sequelize-cli migration:generate --name add-new-table
```

To run migrations:

```bash
npx sequelize-cli db:migrate
```

To undo the last migration:

```bash
npx sequelize-cli db:migrate:undo
```

### Adding New Routes

1. Create controller in `src/controllers/`
2. Add route definition in `src/routes/`
3. Import and use in the main routes file

## Troubleshooting

### Common Issues

1. **Database Connection Error**

   - Ensure PostgreSQL is running
   - Verify database credentials in `.env` file
   - Check if the database exists

2. **Port Already in Use**

   - Change the PORT in `.env` file
   - Kill the process using the port: `npx kill-port 3000`

3. **Migration Errors**
   - Ensure database exists
   - Check migration files for syntax errors
   - Verify database user permissions

### Logs

The application logs are displayed in the console. For production, consider using a logging service.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For support and questions, please open an issue in the [GitHub repository](https://github.com/huzaifa-khambaty/resume_builder_back/issues).
