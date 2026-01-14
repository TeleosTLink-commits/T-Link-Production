import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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
    const baseName = originalFilename
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .toLowerCase();
    const result: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `tlink/${folder}`,
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true,
          public_id: baseName
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(buffer);
    });
    return result.secure_url as string;
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
