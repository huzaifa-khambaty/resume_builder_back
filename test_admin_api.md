# How to Test Admin Subscription API

## Step 1: Login as Admin

First, you need to get an admin token by logging in:

**POST** `http://localhost:4000/api/auth/admin/login`

```json
{
  "email": "admin@gmail.com",
  "password": "12345678"
}
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "your_admin_jwt_token_here",
    "user_id": "admin-uuid",
    "email": "admin@gmail.com",
    "full_name": "Admin User"
  }
}
```

## Step 2: Use Admin Token for Subscription Plans

Copy the `token` from the login response and use it in the Authorization header:

**POST** `http://localhost:4000/api/admin/subscription-plans`

**Headers:**

```
Authorization: Bearer your_admin_jwt_token_here
Content-Type: application/json
```

**Body:**

```json
{
  "name": "Test Plan",
  "description": "A test subscription plan",
  "duration_days": 30,
  "price_per_country": 19.99,
  "is_active": true
}
```

## Step 3: Get All Plans (Admin)

**GET** `http://localhost:4000/api/admin/subscription-plans`

**Headers:**

```
Authorization: Bearer your_admin_jwt_token_here
```

## Curl Examples

### 1. Admin Login

```bash
curl -X POST http://localhost:4000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gmail.com","password":"12345678"}'
```

### 2. Create Subscription Plan

```bash
# Replace YOUR_ADMIN_TOKEN with the token from login response
curl -X POST http://localhost:4000/api/admin/subscription-plans \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "Premium Plan",
    "description": "Premium subscription for 30 days",
    "duration_days": 30,
    "price_per_country": 25.99,
    "is_active": true
  }'
```

### 3. Get All Plans

```bash
curl -X GET http://localhost:4000/api/admin/subscription-plans \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Available Admin Credentials

From the seeder file, you can use these credentials:

- **Email:** `admin@gmail.com`
- **Password:** `12345678`

Or

- **Email:** `manager@gmail.com`
- **Password:** `12345678`

## Error Resolution

If you get "Admin authentication required", it means:

1. ❌ **No Authorization header** - Add `Authorization: Bearer <token>`
2. ❌ **Invalid token** - Login again to get a fresh token
3. ❌ **Expired token** - Login again to get a fresh token
4. ❌ **Wrong endpoint** - Make sure you're using `/api/admin/` endpoints

## Next Steps

Once you have the admin token working:

1. ✅ Create subscription plans
2. ✅ Test candidate subscription purchase flow
3. ✅ Set up Braintree credentials for actual payments
