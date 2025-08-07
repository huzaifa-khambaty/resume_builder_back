// Test setup file
require('dotenv').config({ path: '.env.test' });

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    getSignedUrl: jest.fn().mockReturnValue('https://mock-signed-url.com'),
    deleteObject: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    })
  })),
  SES: jest.fn(() => ({
    sendEmail: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ MessageId: 'mock-message-id' })
    })
  })),
  CognitoIdentityServiceProvider: jest.fn(() => ({
    adminDisableUser: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    }),
    adminGetUser: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        UserAttributes: [
          { Name: 'email', Value: 'test@example.com' },
          { Name: 'sub', Value: 'mock-cognito-sub' }
        ]
      })
    })
  }))
}));

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Mock generated resume content with professional experience and skills.'
            }
          }]
        })
      }
    }
  }));
});

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_mock_payment_intent',
        client_secret: 'pi_mock_payment_intent_secret',
        amount: 199,
        currency: 'usd',
        status: 'requires_payment_method'
      }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'pi_mock_payment_intent',
        status: 'succeeded',
        amount: 199,
        metadata: {
          user_id: 'mock-user-id',
          countries_count: '1',
          country_list: 'USA'
        }
      })
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_mock_payment_intent',
            status: 'succeeded'
          }
        }
      })
    }
  }));
});

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn()
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'nextmatch_test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';

// Global test timeout
jest.setTimeout(30000);

// Suppress console logs during tests unless debugging
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}

// Clean up after tests
afterAll(async () => {
  // Close any open connections
  if (global.__DB_CONNECTION__) {
    await global.__DB_CONNECTION__.end();
  }
});