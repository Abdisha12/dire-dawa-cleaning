const chai = require('chai');
const expect = chai.expect;
const request = require('supertest');

// Import app (server.js exports app)
const app = require('../server');

describe('Health endpoint', function() {
  it('GET /api/health should return status ok', async function() {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body).to.be.an('object');
    expect(res.body).to.have.property('status', 'ok');
    expect(res.body).to.have.property('ts');
  });
});
