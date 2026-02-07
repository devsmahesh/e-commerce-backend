import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export interface UploadResult {
  url: string;
  publicId?: string; // For Cloudinary
}

@Injectable()
export class FileUploadService {
  constructor(private configService: ConfigService) {
    // Check if Cloudinary is configured (REQUIRED)
    const cloudinaryCloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const cloudinaryApiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const cloudinaryApiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    // Cloudinary is now required - throw error if not configured
    if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
      throw new Error(
        'Cloudinary configuration is required. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.',
      );
    }

    // Configure Cloudinary
    cloudinary.config({
      cloud_name: cloudinaryCloudName,
      api_key: cloudinaryApiKey,
      api_secret: cloudinaryApiSecret,
    });

    console.log('☁️  Using Cloudinary for image storage');
    console.log(`   Cloud: ${cloudinaryCloudName}`);
  }

  async uploadImage(file: Express.Multer.File, folder: string = 'categories'): Promise<UploadResult> {
    // Validate file
    this.validateImageFile(file);

    // Always use Cloudinary (local storage is disabled)
    return this.uploadToCloudinary(file, folder);
  }

  async uploadAvatar(file: Express.Multer.File): Promise<UploadResult> {
    // Validate file
    this.validateImageFile(file);

    // Upload to Cloudinary with avatar-specific transformations
    return this.uploadAvatarToCloudinary(file);
  }

  private validateImageFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No image file provided.');
    }

    // Validate MIME type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only image files (JPG, PNG, GIF, WebP) are allowed.',
      );
    }

    // Validate file size (5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      throw new BadRequestException('File size exceeds maximum limit of 5MB.');
    }
  }

  private async uploadToCloudinary(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadResult> {
    try {
      console.log(`☁️  Uploading to Cloudinary: ${file.originalname} to folder: ${folder}`);
      
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: folder,
            resource_type: 'image',
            transformation: [
              { width: 1920, height: 1080, crop: 'limit' },
              { quality: 'auto' },
            ],
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
          },
          (error, result) => {
            if (error) {
              console.error('❌ Cloudinary upload error:', error);
              reject(
                new InternalServerErrorException(
                  `Failed to upload image to Cloudinary: ${error.message || 'Unknown error'}`,
                ),
              );
            } else if (!result) {
              console.error('❌ Cloudinary upload returned no result');
              reject(
                new InternalServerErrorException(
                  'Failed to upload image. No result returned from Cloudinary.',
                ),
              );
            } else {
              console.log(`✅ Image uploaded to Cloudinary: ${result.secure_url}`);
              resolve({
                url: result.secure_url,
                publicId: result.public_id,
              });
            }
          },
        );

        uploadStream.end(file.buffer);
      });
    } catch (error) {
      console.error('❌ Error uploading to Cloudinary:', error);
      throw new InternalServerErrorException(
        `Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }


  private async uploadAvatarToCloudinary(
    file: Express.Multer.File,
  ): Promise<UploadResult> {
    try {
      console.log(`☁️  Uploading avatar to Cloudinary: ${file.originalname}`);
      
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'avatars',
            resource_type: 'image',
            transformation: [
              { width: 400, height: 400, crop: 'fill', gravity: 'face' }, // Square crop, focus on face
              { quality: 'auto' },
            ],
            allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
          },
          (error, result) => {
            if (error) {
              console.error('❌ Cloudinary avatar upload error:', error);
              reject(
                new InternalServerErrorException(
                  `Failed to upload avatar to Cloudinary: ${error.message || 'Unknown error'}`,
                ),
              );
            } else if (!result) {
              console.error('❌ Cloudinary avatar upload returned no result');
              reject(
                new InternalServerErrorException(
                  'Failed to upload avatar. No result returned from Cloudinary.',
                ),
              );
            } else {
              console.log(`✅ Avatar uploaded to Cloudinary: ${result.secure_url}`);
              resolve({
                url: result.secure_url,
                publicId: result.public_id,
              });
            }
          },
        );

        uploadStream.end(file.buffer);
      });
    } catch (error) {
      console.error('❌ Error uploading avatar to Cloudinary:', error);
      throw new InternalServerErrorException(
        `Failed to upload avatar: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async deleteImage(url: string, publicId?: string, folder?: string): Promise<void> {
    // Always use Cloudinary for deletion
    if (publicId) {
      try {
        console.log(`🗑️  Deleting image from Cloudinary: ${publicId}`);
        const result = await cloudinary.uploader.destroy(publicId);
        if (result.result === 'ok') {
          console.log(`✅ Image deleted from Cloudinary: ${publicId}`);
        } else {
          console.warn(`⚠️  Cloudinary deletion result: ${result.result}`);
        }
      } catch (error) {
        // Log error but don't throw - deletion is optional
        console.error('❌ Failed to delete image from Cloudinary:', error);
      }
    } else {
      console.warn('⚠️  Cannot delete image: publicId not provided');
    }
  }
}

