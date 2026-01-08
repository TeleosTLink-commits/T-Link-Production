import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dsg5o79p9',
  api_key: process.env.CLOUDINARY_API_KEY || '781922545932665',
  api_secret: process.env.CLOUDINARY_API_SECRET || '4aTLnB4kLGi7cn3awl0wguFubVc'
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

export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  try {
    await cloudinary.uploader.destroy(publicId);
    return true;
  } catch (error: any) {
    console.error(`Error deleting from Cloudinary:`, error.message);
    return false;
  }
}

export default cloudinary;
