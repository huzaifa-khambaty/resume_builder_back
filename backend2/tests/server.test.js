const request = require('supertest');
const app = require('../src/server');

describe('Server Health Check', () => {
  test('GET /health should return healthy status', async () => {
    const response = await request(app)
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
  });

  test('GET / should return API information', async () => {
    const response = await request(app)
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('message', 'NextMatch AI Backend API');
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('endpoints');
  });

  test('GET /nonexistent should return 404', async () => {
    const response = await request(app)
      .get('/nonexistent')
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');
  });
});

describe('API Routes', () => {
  test('GET /api/auth/options should return countries and job categories', async () => {
    const response = await request(app)
      .get('/api/auth/options')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('countries');
    expect(response.body.data).toHaveProperty('job_categories');
  });

  test('GET /api/subscriptions/pricing should return pricing information', async () => {
    const response = await request(app)
      .get('/api/subscriptions/pricing')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('pricing');
    expect(response.body.data.pricing).toHaveProperty('price_per_country');
    expect(response.body.data.pricing).toHaveProperty('available_countries');
  });
});

describe('Rate Limiting', () => {
  test('Should apply rate limiting to API routes', async () => {
    // Make multiple requests quickly
    const promises = Array(10).fill().map(() => 
      request(app).get('/api/auth/options')
    );

    const responses = await Promise.all(promises);
    
    // All should succeed as we're under the limit
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
});

describe('CORS', () => {
  test('Should include CORS headers', async () => {
    const response = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:3001');

    expect(response.headers).toHaveProperty('access-control-allow-origin');
  });
});

describe('Security Headers', () => {
  test('Should include security headers', async () => {
    const response = await request(app).get('/health');

    expect(response.headers).toHaveProperty('x-content-type-options');
    expect(response.headers).toHaveProperty('x-frame-options');
    expect(response.headers).toHaveProperty('x-xss-protection');
  });
});