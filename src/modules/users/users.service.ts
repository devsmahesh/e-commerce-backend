import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AddAddressDto } from './dto/add-address.dto';
import { Address } from './schemas/address.schema';
import { FileUploadService } from '../../common/services/file-upload.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private fileUploadService: FileUploadService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).select('-password -refreshTokens');
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { $set: updateProfileDto },
      { new: true, runValidators: true },
    ).select('-password -refreshTokens');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Transform address to include id field
   */
  private transformAddress(address: any): any {
    if (!address) return address;
    const addressObj = address.toObject ? address.toObject() : address;
    return {
      ...addressObj,
      id: addressObj._id ? addressObj._id.toString() : addressObj._id,
    };
  }

  async getAddresses(userId: string) {
    const user = await this.userModel.findById(userId).select('addresses');
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const addresses = (user as any).addresses || [];
    return addresses.map((addr: any) => this.transformAddress(addr));
  }

  async addAddress(userId: string, addAddressDto: AddAddressDto) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const addresses = (user as any).addresses || [];

    // If this is set as default, unset other defaults
    if (addAddressDto.isDefault) {
      addresses.forEach((addr: Address) => {
        addr.isDefault = false;
      });
    }

    // Add the new address
    addresses.push(addAddressDto);
    (user as any).addresses = addresses;
    user.markModified('addresses');
    await user.save();

    // Get the newly added address (last one in array)
    const savedAddress = addresses[addresses.length - 1];

    // Return the address with id field in expected format
    return {
      success: true,
      message: 'Address added successfully',
      data: this.transformAddress(savedAddress),
    };
  }

  async updateAddress(userId: string, addressId: string, updateData: Partial<AddAddressDto>) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const addresses = (user as any).addresses || [];
    
    // Find address by _id (MongoDB ObjectId)
    const address = addresses.find((addr: any) => {
      const addrId = addr._id ? addr._id.toString() : addr._id;
      return addrId === addressId;
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // If setting as default, unset other defaults (except current address)
    if (updateData.isDefault) {
      addresses.forEach((addr: any) => {
        const addrId = addr._id ? addr._id.toString() : addr._id;
        if (addrId !== addressId) {
          addr.isDefault = false;
        }
      });
    }

    // Update address fields (only update fields that are provided)
    if (updateData.street !== undefined) address.street = updateData.street;
    if (updateData.city !== undefined) address.city = updateData.city;
    if (updateData.state !== undefined) address.state = updateData.state;
    if (updateData.zipCode !== undefined) address.zipCode = updateData.zipCode;
    if (updateData.country !== undefined) address.country = updateData.country;
    if (updateData.label !== undefined) address.label = updateData.label;
    if (updateData.isDefault !== undefined) address.isDefault = updateData.isDefault;

    // Mark addresses array as modified to ensure Mongoose tracks changes
    user.markModified('addresses');
    await user.save();

    // Return the updated address with id field in expected format
    return {
      success: true,
      message: 'Address updated successfully',
      data: this.transformAddress(address),
    };
  }

  async deleteAddress(userId: string, addressId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const addresses = (user as any).addresses || [];
    
    // Find address by _id (MongoDB ObjectId)
    const addressIndex = addresses.findIndex((addr: any) => {
      const addrId = addr._id ? addr._id.toString() : addr._id;
      return addrId === addressId;
    });

    if (addressIndex === -1) {
      throw new NotFoundException('Address not found');
    }

    addresses.splice(addressIndex, 1);
    (user as any).addresses = addresses;
    user.markModified('addresses');
    await user.save();

    return { message: 'Address deleted successfully' };
  }

  async getWishlist(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const wishlist = (user as any).wishlist || [];
    if (wishlist.length === 0) {
      return [];
    }

    // Populate products with categoryId
    const products = await this.productModel
      .find({ _id: { $in: wishlist } })
      .populate('categoryId', 'name slug')
      .exec();

    return products;
  }

  async addToWishlist(userId: string, productId: string) {
    // Check if product exists
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const wishlist = (user as any).wishlist || [];
    const productObjectId = product._id.toString();

    // Check if product is already in wishlist (idempotent)
    const isAlreadyInWishlist = wishlist.some(
      (id: any) => id.toString() === productObjectId,
    );

    if (!isAlreadyInWishlist) {
      wishlist.push(product._id);
      (user as any).wishlist = wishlist;
      await user.save();
    }

    // Return the full product object with populated categoryId
    const populatedProduct = await this.productModel
      .findById(productId)
      .populate('categoryId', 'name slug')
      .exec();

    return populatedProduct;
  }

  async removeFromWishlist(userId: string, productId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const wishlist = (user as any).wishlist || [];
    const originalLength = wishlist.length;

    // Remove product from wishlist (idempotent - no error if not found)
    (user as any).wishlist = wishlist.filter(
      (id: any) => id.toString() !== productId,
    );

    // Only save if something changed
    if (wishlist.length !== originalLength) {
      await user.save();
    }

    return { message: 'Product removed from wishlist successfully' };
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No avatar file provided.');
    }

    // Get current user
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Store old avatar info for deletion
    const oldAvatarUrl = user.avatar;
    let oldPublicId: string | undefined;

    // Extract publicId from old Cloudinary URL if exists
    if (oldAvatarUrl) {
      try {
        // Cloudinary URL format: https://res.cloudinary.com/{cloud}/image/upload/{version}/{public_id}.{format}
        // or: https://res.cloudinary.com/{cloud}/image/upload/{public_id}.{format}
        const urlParts = oldAvatarUrl.split('/');
        const uploadIndex = urlParts.findIndex((part) => part === 'upload');
        if (uploadIndex !== -1 && uploadIndex < urlParts.length - 1) {
          // Get everything after 'upload' and before the file extension
          const publicIdWithVersion = urlParts.slice(uploadIndex + 1).join('/');
          // Remove version if present (format: v1234567890/public_id)
          const parts = publicIdWithVersion.split('/');
          if (parts.length > 1 && parts[0].startsWith('v')) {
            // Version is present, skip it
            oldPublicId = parts.slice(1).join('/');
          } else {
            oldPublicId = publicIdWithVersion;
          }
          // Remove file extension
          if (oldPublicId) {
            oldPublicId = oldPublicId.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
          }
        }
      } catch (error) {
        console.warn('⚠️  Could not extract publicId from old avatar URL:', error);
      }
    }

    // Upload new avatar
    const uploadResult = await this.fileUploadService.uploadAvatar(file);

    // Delete old avatar if exists
    if (oldAvatarUrl && oldPublicId) {
      try {
        await this.fileUploadService.deleteImage(oldAvatarUrl, oldPublicId);
      } catch (error) {
        // Log error but don't fail the upload
        console.error('❌ Failed to delete old avatar:', error);
      }
    }

    // Update user's avatar in database
    user.avatar = uploadResult.url;
    await user.save();

    // Return updated user (excluding password and refreshTokens)
    const userObject = user.toObject();
    const { password, refreshTokens, ...userWithoutSensitive } = userObject;

    return {
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        ...userWithoutSensitive,
        id: user._id.toString(),
      },
    };
  }
}

