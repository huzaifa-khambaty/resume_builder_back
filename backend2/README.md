# NextMatch AI - Backend

AI-powered resume platform backend built with Node.js, Express.js, and PostgreSQL.

## 🚀 Features

- **User Authentication**: AWS Cognito integration with JWT validation
- **Resume Generation**: OpenAI-powered resume creation and optimization
- **Simulation Engine**: Time-based employer interaction simulation
- **Subscription Management**: Stripe/Paddle integration for payments
- **Admin Dashboard**: Complete admin panel for system management
- **File Storage**: AWS S3 integration for resume PDFs
- **Email Service**: AWS SES for transactional emails
- **Real-time Analytics**: Dashboard metrics and reporting

## 🛠 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: AWS Cognito
- **File Storage**: AWS S3
- **Email**: AWS SES
- **AI**: OpenAI GPT-4
- **Payments**: Stripe
- **Logging**: Winston
- **Validation**: Joi
- **Scheduling**: node-cron

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- PostgreSQL 12+ database
- AWS Account with:
  - Cognito User Pool
  - S3 Bucket
  - SES (Simple Email Service)
- OpenAI API Key
- Stripe Account

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nextmatch-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=nextmatch
   DB_USER=postgres
   DB_PASSWORD=your_password
   
   # AWS Configuration
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_S3_BUCKET=nextmatch-resumes
   AWS_COGNITO_USER_POOL_ID=your_user_pool_id
   AWS_COGNITO_CLIENT_ID=your_client_id
   
   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key
   
   # Stripe Configuration
   STRIPE_SECRET_KEY=your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=your_webhook_secret
   
   # Other configurations...
   ```

4. **Database Setup**
   ```bash
   # Run migrations
   npm run migrate
   
   # Seed initial data
   npm run seed
   ```

## 🚀 Running the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `GET /api/auth/dashboard` - Get dashboard summary
- `POST /api/auth/admin/login` - Admin login

### Resume Endpoints
- `POST /api/resumes` - Create new resume
- `GET /api/resumes` - Get user's resumes
- `GET /api/resumes/:id` - Get specific resume
- `PUT /api/resumes/:id` - Update resume
- `POST /api/resumes/:id/upload-url` - Get S3 upload URL
- `GET /api/resumes/:id/download` - Get download URL

### Subscription Endpoints
- `GET /api/subscriptions/pricing` - Get pricing info
- `POST /api/subscriptions/create-payment-intent` - Create payment
- `POST /api/subscriptions/confirm` - Confirm subscription
- `GET /api/subscriptions/current` - Get current subscription
- `POST /api/subscriptions/simulate` - Start simulation

### Dashboard Endpoints
- `GET /api/dashboard` - Dashboard overview
- `GET /api/dashboard/simulations` - Get simulations
- `GET /api/dashboard/stats` - Get statistics
- `POST /api/dashboard/simulation/:id/pause` - Pause simulation

### Admin Endpoints
- `GET /api/admin/dashboard` - Admin dashboard
- `GET /api/admin/users` - Get all users
- `GET /api/admin/health` - System health check
- `POST /api/employers/upload` - Upload employers CSV

## 🗄 Database Schema

### Core Tables
- `users` - User accounts (linked to Cognito)
- `resumes` - Resume data and metadata
- `work_experiences` - Resume work history
- `subscriptions` - User subscriptions
- `subscription_countries` - Country access mapping
- `resume_simulations` - Simulation tracking
- `dashboard_metrics` - Time-series metrics
- `employers` - Employer database
- `countries` - Available countries
- `job_categories` - Job categories

### Admin Tables
- `admin_users` - Admin accounts
- `system_settings` - Configuration
- `email_templates` - Email templates
- `email_logs` - Email tracking

## 🔄 Simulation Engine

The simulation engine runs automatically every 2 hours and:

1. **Updates Active Simulations**: Calculates progress based on time elapsed
2. **Randomizes Metrics**: Adds realistic variation to opens/shortlists
3. **Completes Expired Simulations**: Marks finished simulations
4. **Updates Dashboard Metrics**: Creates time-series data points

### Simulation Parameters
- **Duration**: 1-96 hours based on resume quality
- **Open Rate**: 20-80% of employers based on quality + skill match
- **Shortlist Rate**: 5-25% of opens based on overall score

## 💳 Payment Integration

### Stripe Integration
- Payment intents for one-time purchases
- Webhook handling for payment events
- Subscription management
- Upgrade/downgrade functionality

### Subscription Model
- **Quantity-based**: $1.99 per country for 6 months
- **Flexible**: 1-10 countries per subscription
- **Upgradeable**: Add countries anytime
- **Cancellable**: Cancel at period end

## 📧 Email System

### AWS SES Integration
- Transactional emails
- Template-based system
- Delivery tracking
- Bounce/complaint handling

### Email Templates
- Welcome email
- Subscription confirmation
- Simulation started
- Payment receipts

## 🔐 Security Features

- **JWT Authentication**: Cognito-based tokens
- **Rate Limiting**: API request throttling
- **Input Validation**: Joi schema validation
- **SQL Injection Protection**: Parameterized queries
- **CORS Configuration**: Secure cross-origin requests
- **Helmet.js**: Security headers

## 📊 Monitoring & Logging

### Winston Logging
- Structured JSON logs
- Multiple log levels
- File rotation
- Console output (development)

### Health Checks
- Database connectivity
- AWS services status
- Simulation service health
- System metrics

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📦 Deployment

### Environment Variables
Ensure all production environment variables are set:
- Database credentials
- AWS credentials and regions
- API keys (OpenAI, Stripe)
- JWT secrets
- Email configuration

### Database Migration
```bash
npm run migrate
```

### Process Management
Use PM2 or similar for production:
```bash
pm2 start src/server.js --name nextmatch-backend
```

## 🔧 Admin Panel

Default admin credentials (change immediately):
- **Email**: admin@nextmatch.ai
- **Password**: admin123456

### Admin Features
- User management
- Employer database management
- System settings
- Revenue analytics
- Simulation monitoring
- Health dashboard

## 📈 Scaling Considerations

### Database
- Connection pooling configured
- Indexes on frequently queried columns
- Pagination for large datasets

### File Storage
- S3 for scalable file storage
- Signed URLs for secure access
- CDN integration ready

### Caching
- Ready for Redis integration
- Database query optimization
- Static asset caching

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify connection credentials
   - Ensure database exists

2. **AWS Services Unavailable**
   - Verify AWS credentials
   - Check service regions
   - Confirm IAM permissions

3. **OpenAI API Errors**
   - Check API key validity
   - Monitor rate limits
   - Verify model availability

4. **Stripe Webhook Issues**
   - Verify webhook secret
   - Check endpoint URL
   - Monitor webhook logs

### Logs Location
- Development: Console output
- Production: `logs/` directory
  - `error.log` - Error messages
  - `combined.log` - All logs

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## 📄 License

This project is proprietary software. All rights reserved.

## 📞 Support

For technical support:
- Email: support@nextmatch.ai
- Documentation: [Internal Wiki]
- Issue Tracker: [Internal System]

---

**NextMatch AI Backend v1.0.0**  
Built with ❤️ for the future of recruitment