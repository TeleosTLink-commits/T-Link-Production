// Test Cloudinary API and fix access control
const { v2: cloudinary } = require('cloudinary');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function fixCloudinaryAccess() {
  try {
    console.log('Testing Cloudinary API...');
    
    // List resources in the tlink folder
    const resources = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'tlink/samples/',
      max_results: 500
    });
    
    console.log(`Found ${resources.resources.length} files in tlink/samples/`);
    
    let updated = 0;
    for (const resource of resources.resources) {
      try {
        // Update to make publicly accessible
        await cloudinary.api.update(resource.public_id, {
          access_control: [{ access_type: 'public' }]
        });
        console.log(`✓ ${resource.public_id}`);
        updated++;
      } catch (error) {
        console.log(`✗ ${resource.public_id}: ${error.message}`);
      }
    }
    
    console.log(`\nSuccessfully updated ${updated}/${resources.resources.length} files`);
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.message.includes('Authentication')) {
      console.log('\nCredentials issue - check .env file');
    }
    process.exit(1);
  }
}

fixCloudinaryAccess();
