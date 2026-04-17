#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * EAS Prebuild Hook - Handles google-services.json
 * This script decodes the GOOGLE_SERVICES_JSON secret and places it in the
 * correct location for the Android build process
 */

async function runPrebuild() {
  try {
    // Get the build directory - EAS sets this env variable
    const buildDir = process.env.EAS_BUILD_DIR || process.cwd();
    
    // Check if GOOGLE_SERVICES_JSON secret is available
    if (process.env.GOOGLE_SERVICES_JSON) {
      console.log('🔧 Decoding GOOGLE_SERVICES_JSON secret...');
      
      // The secret is base64 encoded, so decode it
      const decodedContent = Buffer.from(process.env.GOOGLE_SERVICES_JSON, 'base64').toString('utf-8');
      
      // Verify it's valid JSON
      try {
        JSON.parse(decodedContent);
      } catch (e) {
        throw new Error('GOOGLE_SERVICES_JSON secret is not valid JSON after decoding');
      }
      
      // Place the file in the project root
      const googleServicesPath = path.join(buildDir, 'google-services.json');
      fs.writeFileSync(googleServicesPath, decodedContent, 'utf-8');
      console.log(`✅ Successfully created google-services.json at ${googleServicesPath}`);
      
      // Also create it in android/app/ for safety
      const androidAppDir = path.join(buildDir, 'android', 'app');
      if (fs.existsSync(androidAppDir)) {
        const androidGoogleServicesPath = path.join(androidAppDir, 'google-services.json');
        fs.writeFileSync(androidGoogleServicesPath, decodedContent, 'utf-8');
        console.log(`✅ Also created google-services.json at ${androidGoogleServicesPath}`);
      }
    } else {
      console.log('⚠️  GOOGLE_SERVICES_JSON secret not found in environment');
      console.log('   Make sure you have set this secret in your EAS project');
      
      // Check if the file already exists locally
      const localPath = path.join(buildDir, 'google-services.json');
      if (!fs.existsSync(localPath)) {
        throw new Error('google-services.json not found and GOOGLE_SERVICES_JSON secret is not set');
      }
      console.log('   Using existing google-services.json from the repository');
    }
  } catch (error) {
    console.error('❌ Prebuild hook failed:', error.message);
    process.exit(1);
  }
}

runPrebuild();
