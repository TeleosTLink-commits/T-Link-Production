import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';

function normalizeEnvValue(value?: string): string {
  const trimmed = (value || '').trim();
  return trimmed.replace(/^['\"]|['\"]$/g, '');
}

// Configure Cloudinary
cloudinary.config({
  cloud_name: normalizeEnvValue(process.env.CLOUDINARY_CLOUD_NAME),
  api_key: normalizeEnvValue(process.env.CLOUDINARY_API_KEY),
  api_secret: normalizeEnvValue(process.env.CLOUDINARY_API_SECRET)
});

function hasCloudinaryConfig(): boolean {
  const cloudName = normalizeEnvValue(process.env.CLOUDINARY_CLOUD_NAME);
  const apiKey = normalizeEnvValue(process.env.CLOUDINARY_API_KEY);
  const apiSecret = normalizeEnvValue(process.env.CLOUDINARY_API_SECRET);

  return Boolean(
    cloudName &&
    apiKey &&
    apiSecret
  );
}

function sanitizeBaseName(originalFilename: string): string {
  return originalFilename
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .toLowerCase();
}

async function uploadBufferWithOptions(buffer: Buffer, options: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
}

export async function uploadToCloudinary(filePath: string, folder: string): Promise<string | null> {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `tlink/${folder}`,
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true
    });
    return result.secure_url;
  } catch (error: any) {
    console.error(`Error uploading to Cloudinary:`, error.message);
    return null;
  }
}

/**
 * Upload a file buffer to Cloudinary (used in production where local disk paths are not available)
 */
export async function uploadBufferToCloudinary(buffer: Buffer, originalFilename: string, folder: string): Promise<string | null> {
  try {
    const cloudName = normalizeEnvValue(process.env.CLOUDINARY_CLOUD_NAME);
    const apiKey = normalizeEnvValue(process.env.CLOUDINARY_API_KEY);
    const apiSecret = normalizeEnvValue(process.env.CLOUDINARY_API_SECRET);

    // Reconfigure every call so Render env vars are always used (not stale module-load values)
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret
    });

    if (!hasCloudinaryConfig()) {
      console.error('Cloudinary env vars are missing (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET).');
      return null;
    }

    // Log masked credentials for diagnostics
    console.log('[Cloudinary] cloud_name:', cloudName);
    console.log('[Cloudinary] api_key:', apiKey ? `${apiKey.slice(0, 6)}...` : 'MISSING');
    console.log('[Cloudinary] api_secret:', apiSecret ? `${apiSecret.slice(0, 4)}...` : 'MISSING');

    const baseName = sanitizeBaseName(originalFilename);
    const baseOptions = {
      folder: `tlink/${folder}`,
      use_filename: true,
      unique_filename: true,
      public_id: baseName,
    };

    // PDF and document uploads are often more reliable as raw resources.
    let result: any;
    try {
      result = await uploadBufferWithOptions(buffer, {
        ...baseOptions,
        resource_type: 'raw',
      });
    } catch (rawError: any) {
      console.warn('Cloudinary raw upload failed, retrying with auto resource_type:', rawError?.message);
      result = await uploadBufferWithOptions(buffer, {
        ...baseOptions,
        resource_type: 'auto',
      });
    }

    const uploadedUrl = result?.secure_url || result?.url || null;
    if (!uploadedUrl) {
      console.error('Cloudinary upload completed but returned no URL:', result);
      return null;
    }

    return uploadedUrl as string;
  } catch (error: any) {
    console.error(`Error uploading buffer to Cloudinary:`, error.message);
    return null;
  }
}

export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error: any) {
    console.error(`Error deleting from Cloudinary:`, error.message);
    return false;
  }
}

/**
 * Generate a signed URL for accessing protected Cloudinary files
 * Uses Cloudinary SDK to create temporary authenticated access
 */
export function getSignedCloudinaryUrl(cloudinaryUrl: string, expiresIn: number = 3600): string {
  try {
    // Extract public_id from full Cloudinary URL
    // Format: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{public_id}.{ext}
    const match = cloudinaryUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
    if (!match) {
      console.error('Could not extract public_id from URL:', cloudinaryUrl);
      return cloudinaryUrl;
    }

    const publicId = match[1];
    
    // Generate signed URL with temporary access (default 1 hour)
    const signedUrl = cloudinary.url(publicId, {
      secure: true,
      sign_url: true,
      type: 'authenticated',
      resource_type: 'auto',
      expiration: Math.floor(Date.now() / 1000) + expiresIn
    });
    
    console.log(`Generated signed URL for ${publicId}, expires in ${expiresIn}s`);
    return signedUrl;
  } catch (error: any) {
    console.error('Error generating signed URL:', error.message);
    return cloudinaryUrl; // Return original URL on error
  }
}

export default cloudinary;
