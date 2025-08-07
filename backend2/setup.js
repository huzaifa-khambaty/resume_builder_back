#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setup() {
  console.log('🚀 NextMatch AI Backend Setup');
  console.log('================================\n');

  try {
    // Check if .env exists
    if (!fs.existsSync('.env')) {
      console.log('📝 Creating .env file from template...');
      fs.copyFileSync('.env.example', '.env');
      console.log('✅ .env file created. Please update it with your configuration.\n');
    }

    // Create necessary directories
    console.log('📁 Creating necessary directories...');
    const dirs = ['logs', 'uploads', 'temp'];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`   ✅ Created ${dir}/ directory`);
      }
    });

    // Install dependencies
    console.log('\n📦 Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });

    // Ask about database setup
    const setupDb = await question('\n🗄️  Do you want to set up the database now? (y/N): ');
    
    if (setupDb.toLowerCase() === 'y' || setupDb.toLowerCase() === 'yes') {
      console.log('\n🔧 Setting up database...');
      
      try {
        // Run migrations
        console.log('   Running database migrations...');
        execSync('npm run migrate', { stdio: 'inherit' });
        
        // Run seeds
        console.log('   Seeding initial data...');
        execSync('npm run seed', { stdio: 'inherit' });
        
        console.log('   ✅ Database setup completed');
      } catch (error) {
        console.log('   ❌ Database setup failed. Please check your database configuration.');
        console.log('   You can run "npm run setup" later to set up the database.');
      }
    }

    // Ask about running tests
    const runTests = await question('\n🧪 Do you want to run tests to verify setup? (y/N): ');
    
    if (runTests.toLowerCase() === 'y' || runTests.toLowerCase() === 'yes') {
      console.log('\n🧪 Running tests...');
      try {
        execSync('npm test', { stdio: 'inherit' });
        console.log('   ✅ All tests passed');
      } catch (error) {
        console.log('   ⚠️  Some tests failed. Please check the configuration.');
      }
    }

    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Update your .env file with the correct configuration');
    console.log('   2. Make sure your PostgreSQL database is running');
    console.log('   3. Configure your AWS services (S3, Cognito, SES)');
    console.log('   4. Add your OpenAI API key');
    console.log('   5. Set up your Stripe account and keys');
    console.log('\n🚀 To start the development server:');
    console.log('   npm run dev');
    console.log('\n📚 To view API documentation:');
    console.log('   Open http://localhost:3000 in your browser');
    console.log('\n🔍 To check system health:');
    console.log('   Open http://localhost:3000/health in your browser');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 18) {
  console.error('❌ Node.js 18 or higher is required. Current version:', nodeVersion);
  process.exit(1);
}

// Run setup
setup().catch(console.error);