import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface UploadResult {
  url: string;
  publicId?: string; // For Cloudinary
}

@Injectable()
export class FileUploadService {
  private readonly useCloudinary: boolean;
  private readonly baseUploadDir: string;

  constructor(private configService: ConfigService) {
    // Check if Cloudinary is configured
    const cloudinaryCloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const cloudinaryApiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const cloudinaryApiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    this.useCloudinary = !!(cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret);

    if (this.useCloudinary) {
      cloudinary.config({
        cloud_name: cloudinaryCloudName,
        api_key: cloudinaryApiKey,
        api_secret: cloudinaryApiSecret,
      });
    }

    // Set base upload directory for local storage
    this.baseUploadDir = path.join(process.cwd(), 'public', 'uploads');
  }

  private async ensureUploadDirectory(folder: string): Promise<string> {
    const uploadDir = path.join(this.baseUploadDir, folder);
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      return uploadDir;
    } catch (error) {
      throw new InternalServerErrorException('Failed to create upload directory');
    }
  }

  async uploadImage(file: Express.Multer.File, folder: string = 'categories'): Promise<UploadResult> {
    // Validate file
    this.validateImageFile(file);

    if (this.useCloudinary) {
      return this.uploadToCloudinary(file, folder);
    } else {
      return this.uploadToLocal(file, folder);
    }
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
              reject(
                new InternalServerErrorException(
                  'Failed to upload image. Please try again.',
                ),
              );
            } else if (!result) {
              reject(
                new InternalServerErrorException(
                  'Failed to upload image. No result returned.',
                ),
              );
            } else {
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
      throw new InternalServerErrorException('Failed to upload image. Please try again.');
    }
  }

  private async uploadToLocal(file: Express.Multer.File, folder: string): Promise<UploadResult> {
    try {
      // Ensure upload directory exists
      const uploadDir = await this.ensureUploadDirectory(folder);

      // Generate unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      // Use folder name as prefix (e.g., 'products' -> 'product-', 'categories' -> 'category-')
      const prefix = folder.endsWith('s') ? folder.slice(0, -1) : folder;
      const filename = `${prefix}-${uniqueSuffix}${ext}`;
      const filepath = path.join(uploadDir, filename);

      // Write file to disk
      await fs.writeFile(filepath, file.buffer);

      // Generate URL - use BACKEND_URL from env or config
      let apiUrl = process.env.BACKEND_URL || this.configService.get<string>('BACKEND_URL');
      if (!apiUrl) {
        const port = process.env.PORT || 3000;
        apiUrl = `http://localhost:${port}`;
      }
      const url = `${apiUrl}/uploads/${folder}/${filename}`;

      return { url };
    } catch (error) {
      throw new InternalServerErrorException('Failed to upload image. Please try again.');
    }
  }

  async deleteImage(url: string, publicId?: string, folder?: string): Promise<void> {
    if (this.useCloudinary && publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (error) {
        // Log error but don't throw - deletion is optional
        console.error('Failed to delete image from Cloudinary:', error);
      }
    } else if (!this.useCloudinary) {
      // For local storage, extract filename from URL
      try {
        const filename = path.basename(url);
        const uploadDir = folder 
          ? path.join(this.baseUploadDir, folder)
          : this.baseUploadDir;
        const filepath = path.join(uploadDir, filename);
        await fs.unlink(filepath);
      } catch (error) {
        // Log error but don't throw - deletion is optional
        console.error('Failed to delete local image:', error);
      }
    }
  }
}

