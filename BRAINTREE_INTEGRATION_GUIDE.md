# Braintree Integration Guide

## Overview

This guide explains how to properly set up and test the Braintree subscription system that has been implemented in your application.

## Current Implementation Status

✅ **Database Plans**: Working - Plans are stored in your database
✅ **Admin API**: Working - Admins can create/update plans via API
✅ **Candidate API**: Working - Candidates can view and purchase subscriptions
✅ **Braintree Sync**: Implemented - Plans sync with Braintree when credentials are provided
❌ **Braintree Processing**: Requires configuration - Actual payments need Braintree credentials

## Setting Up Braintree

### 1. Create Braintree Account

1. Go to https://developer.paypal.com/braintree/docs/start/hello-sandbox
2. Sign up for a Braintree sandbox account
3. Get your API credentials from the sandbox dashboard

### 2. Add Credentials to Environment

Create a `.env` file in your project root with these variables:

```env
# Braintree Configuration
BRAINTREE_ENVIRONMENT=Sandbox
BRAINTREE_MERCHANT_ID=your_merchant_id_here
BRAINTREE_PUBLIC_KEY=your_public_key_here
BRAINTREE_PRIVATE_KEY=your_private_key_here
```

### 3. Restart Your Server

After adding credentials, restart your server to load the new environment variables:

```bash
npm run dev
```

## Testing the Integration

### Step 1: Admin Login

First, get an admin authentication token:

**POST** `/api/auth/admin/login`

```json
{
  "email": "admin@gmail.com",
  "password": "12345678"
}
```

### Step 2: Create Subscription Plan

Use the admin token to create a plan:

**POST** `/api/admin/subscription-plans`
**Headers:**

```
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json
```

**Body:**

```json
{
  "name": "Basic Plan",
  "description": "30-day access to job opportunities",
  "duration_days": 30,
  "price_per_country": 9.99,
  "is_active": true
}
```

### Step 3: Verify Plan Creation

Check that the plan was created in both your database and Braintree:

**GET** `/api/admin/subscription-plans`

## How the Integration Works

### Database + Braintree Sync

When you create a plan in your system:

1. ✅ Plan is created in your PostgreSQL database
2. ✅ If Braintree credentials exist, plan is also created in Braintree
3. ✅ Plan IDs are synchronized between both systems

### Country-Based Pricing

- Each plan has a `price_per_country` field
- When a candidate purchases a subscription, the total price is calculated as:
  `total_price = price_per_country × number_of_countries_selected`

### Duration Overlap Logic

If a candidate has an active subscription with 15 days remaining:

- New subscription duration is automatically limited to 15 days
- Price is prorated based on the actual duration

## Testing Without Braintree Credentials

You can fully test the system without Braintree credentials:

1. ✅ Admin can create/view plans in database
2. ✅ Candidates can view available plans
3. ✅ Pricing calculations work correctly
4. ✅ Duration overlap logic functions
5. ✅ All API endpoints return proper responses

When Braintree credentials are missing, the system gracefully handles this and shows helpful error messages.

## API Endpoints

### Admin Endpoints

```
POST   /api/admin/subscription-plans           # Create plan
GET    /api/admin/subscription-plans           # List plans
PUT    /api/admin/subscription-plans/:planId   # Update plan
GET    /api/admin/subscriptions                # List all subscriptions
DELETE /api/admin/subscriptions/:subscriptionId # Cancel any subscription
```

### Candidate Endpoints

```
GET    /api/candidate/subscriptions/plans              # View available plans
POST   /api/candidate/subscriptions/calculate          # Calculate pricing
GET    /api/candidate/subscriptions/client-token       # Get Braintree token
POST   /api/candidate/subscriptions                    # Purchase subscription
GET    /api/candidate/subscriptions                    # List my subscriptions
GET    /api/candidate/subscriptions/:subscriptionId    # View subscription details
DELETE /api/candidate/subscriptions/:subscriptionId    # Cancel my subscription
```

## Error Handling

### Missing Braintree Credentials

When Braintree credentials are not provided:

- System continues to work with database storage
- Helpful warning messages are shown
- Payment endpoints return 503 Service Unavailable with clear message

### Invalid Plan Data

- Proper validation with descriptive error messages
- Duplicate plan names are prevented
- Price and duration constraints are enforced

## Next Steps

1. ✅ Set up Braintree sandbox account
2. ✅ Add credentials to `.env` file
3. ✅ Restart server
4. ✅ Test plan creation (will sync to Braintree automatically)
5. ✅ Test candidate subscription purchase flow
6. ✅ Move to production credentials when ready

## Troubleshooting

### "Admin authentication required"

Make sure you're:

1. Using the correct admin login endpoint
2. Including the Authorization header with Bearer token
3. Using a valid admin account (admin@gmail.com / 12345678)

### "Braintree credentials missing"

1. Check that all 4 Braintree environment variables are set
2. Verify there are no typos in variable names
3. Restart the server after adding credentials

### Plan not appearing in Braintree

1. Check Braintree dashboard for the plan
2. Verify the plan was created after adding credentials
3. Check server logs for any Braintree API errors

The system is designed to work seamlessly whether or not Braintree is configured, making it easy to develop and test before going live with payments.
