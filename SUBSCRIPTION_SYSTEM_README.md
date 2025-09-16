# Subscription System Documentation

## Overview

This document provides comprehensive documentation for the subscription and plan management system. The system allows candidates to purchase subscriptions for accessing job opportunities in multiple countries, with Braintree payment integration for secure payment processing.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [Business Logic](#business-logic)
5. [Payment Integration](#payment-integration)
6. [Validation Rules](#validation-rules)
7. [Error Handling](#error-handling)
8. [Usage Examples](#usage-examples)

## System Architecture

### Core Components

- **Models**: Database entities for subscription plans, candidate subscriptions, and subscription countries
- **Services**: Business logic layer handling subscription operations and Braintree integration
- **Controllers**: HTTP request handlers for both candidate and admin operations
- **Routes**: API endpoint definitions with authentication middleware
- **Validations**: Input validation using Zod schemas

### Key Features

- **Multi-country subscriptions**: Candidates can subscribe to job opportunities in multiple countries
- **Flexible pricing**: Price calculated per country with proration support
- **Payment integration**: Secure payment processing via Braintree
- **Admin management**: Full CRUD operations for subscription plans
- **Status tracking**: Comprehensive subscription and payment status management

## Database Schema

### 1. Subscription Plans (`subscription_plans`)

```sql
CREATE TABLE subscription_plans (
  plan_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  duration_days INTEGER NOT NULL CHECK (duration_days >= 1 AND duration_days <= 365),
  price_per_country DECIMAL(10,2) NOT NULL CHECK (price_per_country >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  updated_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Indexes:**
- `is_active` (for filtering active plans)
- `created_at` (for sorting)

### 2. Candidate Subscriptions (`candidate_subscriptions`)

```sql
CREATE TABLE candidate_subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(candidate_id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(plan_id) ON DELETE RESTRICT,
  braintree_subscription_id VARCHAR,
  braintree_transaction_id VARCHAR,
  country_count INTEGER NOT NULL CHECK (country_count >= 1),
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  status ENUM('pending', 'active', 'expired', 'cancelled') NOT NULL DEFAULT 'pending',
  payment_status ENUM('pending', 'completed', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL,
  updated_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Indexes:**
- `candidate_id` (for user subscriptions)
- `plan_id` (for plan analytics)
- `status` (for filtering)
- `start_date, end_date` (for date range queries)
- `braintree_subscription_id` (for payment tracking)

### 3. Subscription Countries (`subscription_countries`)

```sql
CREATE TABLE subscription_countries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES candidate_subscriptions(subscription_id) ON DELETE CASCADE,
  country_id UUID NOT NULL REFERENCES countries(country_id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(subscription_id, country_id)
);
```

**Indexes:**
- `subscription_id` (for subscription details)
- `country_id` (for country analytics)
- Unique constraint on `(subscription_id, country_id)`

## API Endpoints

### Candidate Endpoints

#### 1. Get Active Subscription Plans
```http
GET /api/candidate/subscription-plans
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "success": true,
  "message": "Active subscription plans retrieved successfully",
  "data": [
    {
      "plan_id": "uuid",
      "name": "Basic Plan",
      "description": "Access to basic features",
      "duration_days": 30,
      "price_per_country": 10.00
    }
  ]
}
```

#### 2. Calculate Subscription Pricing
```http
POST /api/candidate/subscriptions/calculate
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "plan_id": "uuid",
  "country_ids": ["country_uuid_1", "country_uuid_2"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription pricing calculated successfully",
  "data": {
    "plan": { /* plan details */ },
    "countries": [ /* country details */ ],
    "countryCount": 2,
    "originalAmount": 20.00,
    "finalAmount": 20.00,
    "effectiveDurationDays": 30,
    "originalDurationDays": 30,
    "remainingDays": 0,
    "isProrated": false,
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T00:00:00Z"
  }
}
```

#### 3. Get Braintree Client Token
```http
GET /api/candidate/subscriptions/client-token
Authorization: Bearer {jwt_token}
```

**Response:**
```json
{
  "success": true,
  "message": "Client token generated successfully",
  "data": {
    "client_token": "braintree_client_token_string"
  }
}
```

#### 4. Create Subscription
```http
POST /api/candidate/subscriptions
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "plan_id": "uuid",
  "country_ids": ["country_uuid_1", "country_uuid_2"],
  "payment_method_nonce": "braintree_nonce_from_frontend"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription created successfully",
  "data": {
    "subscription": { /* complete subscription details */ },
    "transaction": { /* Braintree transaction details */ },
    "pricingDetails": { /* pricing calculation details */ }
  }
}
```

#### 5. Get My Subscriptions
```http
GET /api/candidate/subscriptions?page=1&limit=10&status=active
Authorization: Bearer {jwt_token}
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `status` (optional): Filter by status (`pending`, `active`, `expired`, `cancelled`)
- `sortBy` (optional): Sort field
- `sortOrder` (optional): `ASC` or `DESC` (default: `DESC`)

#### 6. Get Subscription Details
```http
GET /api/candidate/subscriptions/{subscription_id}
Authorization: Bearer {jwt_token}
```

#### 7. Cancel Subscription
```http
DELETE /api/candidate/subscriptions/{subscription_id}
Authorization: Bearer {jwt_token}
```

### Admin Endpoints

#### 1. Get All Subscription Plans
```http
GET /api/admin/subscription-plans?page=1&limit=10&is_active=true
Authorization: Bearer {admin_jwt_token}
```

**Query Parameters:**
- `page`, `limit`, `search`, `sortBy`, `sortOrder`: Standard pagination
- `is_active` (optional): Filter by active status (`true`/`false`)

#### 2. Create Subscription Plan
```http
POST /api/admin/subscription-plans
Authorization: Bearer {admin_jwt_token}
Content-Type: application/json

{
  "name": "Premium Plan",
  "description": "Access to premium features",
  "duration_days": 90,
  "price_per_country": 25.00,
  "is_active": true
}
```

#### 3. Update Subscription Plan
```http
PUT /api/admin/subscription-plans/{plan_id}
Authorization: Bearer {admin_jwt_token}
Content-Type: application/json

{
  "name": "Updated Premium Plan",
  "price_per_country": 30.00
}
```

#### 4. Get All Subscriptions
```http
GET /api/admin/subscriptions?page=1&limit=10&status=active
Authorization: Bearer {admin_jwt_token}
```

**Query Parameters:**
- Standard pagination parameters
- `status`, `candidate_id`, `plan_id`: Filtering options

#### 5. Cancel Any Subscription
```http
DELETE /api/admin/subscriptions/{subscription_id}
Authorization: Bearer {admin_jwt_token}
```

## Business Logic

### Subscription Pricing Logic

#### 1. Basic Calculation
```javascript
totalAmount = plan.price_per_country * countryIds.length
```

#### 2. Proration Logic
When a candidate has an active subscription:
- Calculate remaining days in current subscription
- Limit new subscription duration to remaining days
- Apply proration factor: `effectiveDays / originalDays`
- Final amount = `originalAmount * prorationFactor`

#### 3. Date Calculation
- **Start Date**: Current date/time
- **End Date**: Start date + effective duration days
- **Effective Duration**: Min(plan duration, remaining days from active subscription)

### Subscription Status Management

#### Status Flow
1. **pending** → **active** (after successful payment)
2. **active** → **expired** (after end date)
3. **active** → **cancelled** (manual cancellation)
4. **pending** → **cancelled** (failed payment)

#### Payment Status Flow
1. **pending** → **completed** (successful payment)
2. **pending** → **failed** (payment failure)
3. **completed** → **refunded** (refund processed)

### Braintree Customer Management

#### Auto-Provisioning Logic
1. Check if Braintree customer exists using candidate ID
2. If not found, create customer with:
   - ID: candidate_id
   - First Name: extracted from full_name
   - Last Name: remaining part of full_name
   - Email: candidate email
3. Generate client token for existing/new customer
4. Fallback to anonymous token if customer operations fail

## Payment Integration

### Braintree Configuration

Required environment variables:
```env
BRAINTREE_ENVIRONMENT=Sandbox  # or Production
BRAINTREE_MERCHANT_ID=your_merchant_id
BRAINTREE_PUBLIC_KEY=your_public_key
BRAINTREE_PRIVATE_KEY=your_private_key
```

### Payment Flow

1. **Frontend**: Get client token from `/client-token` endpoint
2. **Frontend**: Initialize Braintree Drop-in UI with client token
3. **Frontend**: Collect payment method and get nonce
4. **Frontend**: Submit subscription request with payment nonce
5. **Backend**: Process transaction with Braintree
6. **Backend**: Create subscription record on successful payment

### Transaction Processing

```javascript
const transactionResult = await braintreeService.processTransaction({
  amount: finalAmount.toString(),
  paymentMethodNonce: paymentNonce,
  customerId: candidateId,
  options: {
    submitForSettlement: true
  }
});
```

## Validation Rules

### Subscription Plan Validation

```javascript
const createPlanSchema = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    unique: true
  },
  description: {
    optional: true,
    maxLength: 1000
  },
  duration_days: {
    required: true,
    type: 'integer',
    min: 1,
    max: 365
  },
  price_per_country: {
    required: true,
    type: 'decimal',
    min: 0,
    max: 1000
  },
  is_active: {
    optional: true,
    type: 'boolean',
    default: true
  }
}
```

### Subscription Creation Validation

```javascript
const createSubscriptionSchema = {
  plan_id: {
    required: true,
    type: 'uuid'
  },
  country_ids: {
    required: true,
    type: 'array',
    minItems: 1,
    maxItems: 50,
    items: { type: 'uuid' }
  },
  payment_method_nonce: {
    required: true,
    minLength: 1
  }
}
```

### Query Parameter Validation

```javascript
const paginationSchema = {
  page: {
    optional: true,
    type: 'integer',
    min: 1,
    default: 1
  },
  limit: {
    optional: true,
    type: 'integer',
    min: 1,
    max: 100,
    default: 10
  },
  sortOrder: {
    optional: true,
    enum: ['ASC', 'DESC'],
    default: 'DESC'
  }
}
```

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "duration_days",
      "message": "Duration must be at least 1 day",
      "value": 0
    }
  ]
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Subscription plan not found"
}
```

#### 409 Conflict
```json
{
  "success": false,
  "message": "A subscription plan with this name already exists",
  "error": "Duplicate entry"
}
```

#### 503 Service Unavailable
```json
{
  "success": false,
  "message": "Payment system is not configured. Please contact support.",
  "error": "Braintree credentials missing"
}
```

### Payment Error Handling

#### Failed Payment
```json
{
  "success": false,
  "message": "Payment failed: Insufficient funds",
  "details": {
    "processor_response_code": "2001",
    "processor_response_text": "Insufficient Funds"
  }
}
```

#### Braintree Service Errors
- Automatic fallback for customer creation failures
- Graceful degradation when Braintree is unavailable
- Comprehensive logging for debugging

## Usage Examples

### Frontend Integration Example

```javascript
// 1. Get client token
const tokenResponse = await fetch('/api/candidate/subscriptions/client-token', {
  headers: { 'Authorization': `Bearer ${jwtToken}` }
});
const { client_token } = await tokenResponse.json();

// 2. Initialize Braintree Drop-in
braintree.dropin.create({
  authorization: client_token,
  container: '#dropin-container'
}, (err, instance) => {
  // 3. Handle form submission
  document.getElementById('submit-button').addEventListener('click', () => {
    instance.requestPaymentMethod((err, payload) => {
      if (err) return;
      
      // 4. Create subscription
      fetch('/api/candidate/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({
          plan_id: selectedPlanId,
          country_ids: selectedCountryIds,
          payment_method_nonce: payload.nonce
        })
      });
    });
  });
});
```

### Admin Plan Management Example

```javascript
// Create a new subscription plan
const createPlan = async (planData) => {
  const response = await fetch('/api/admin/subscription-plans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Enterprise Plan',
      description: 'Full access to all features',
      duration_days: 365,
      price_per_country: 50.00,
      is_active: true
    })
  });
  
  return await response.json();
};
```

### Subscription Status Monitoring

```javascript
// Check subscription status
const checkSubscriptionStatus = async (candidateId) => {
  const response = await fetch(`/api/candidate/subscriptions?status=active`, {
    headers: { 'Authorization': `Bearer ${jwtToken}` }
  });
  
  const { data } = await response.json();
  const activeSubscriptions = data.items.filter(sub => 
    new Date(sub.end_date) > new Date()
  );
  
  return activeSubscriptions;
};
```

## Security Considerations

### Authentication & Authorization
- JWT token validation for all endpoints
- Separate admin authentication for management endpoints
- Candidates can only access their own subscriptions

### Payment Security
- Payment nonces are single-use tokens
- No sensitive payment data stored in database
- Braintree handles PCI compliance

### Data Protection
- UUID primary keys prevent enumeration attacks
- Soft delete patterns for audit trails
- Comprehensive logging without sensitive data

## Monitoring & Analytics

### Key Metrics to Track
- Subscription conversion rates
- Revenue per country
- Plan popularity
- Churn rates
- Payment failure rates

### Logging Points
- Subscription creation/cancellation
- Payment processing events
- Braintree integration errors
- Plan management actions

## Troubleshooting

### Common Issues

1. **Braintree Configuration**
   - Verify environment variables are set
   - Check sandbox vs production environment
   - Validate merchant account status

2. **Payment Failures**
   - Check Braintree transaction logs
   - Verify payment method validity
   - Review processor response codes

3. **Proration Calculations**
   - Verify active subscription detection
   - Check date calculations
   - Review remaining days logic

4. **Database Constraints**
   - Unique constraint violations on plan names
   - Foreign key constraint errors
   - Check referential integrity

### Debug Commands

```bash
# Check Braintree configuration
node -e "console.log(process.env.BRAINTREE_MERCHANT_ID ? 'Configured' : 'Missing')"

# Test database connectivity
npm run db:test

# View recent subscription logs
tail -f logs/subscription.log | grep ERROR
```

---

This documentation covers the complete subscription system implementation. For additional support or feature requests, please contact the development team.
