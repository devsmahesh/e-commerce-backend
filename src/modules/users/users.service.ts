import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AddAddressDto } from './dto/add-address.dto';
import { Address } from './schemas/address.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
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

  async getAddresses(userId: string) {
    const user = await this.userModel.findById(userId).select('addresses');
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return (user as any).addresses || [];
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

    addresses.push(addAddressDto);
    (user as any).addresses = addresses;
    await user.save();

    return addresses;
  }

  async updateAddress(userId: string, addressId: string, updateData: Partial<AddAddressDto>) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const addresses = (user as any).addresses || [];
    const addressIndex = addresses.findIndex(
      (addr: Address, index: number) => index.toString() === addressId,
    );

    if (addressIndex === -1) {
      throw new NotFoundException('Address not found');
    }

    // If setting as default, unset other defaults
    if (updateData.isDefault) {
      addresses.forEach((addr: Address) => {
        addr.isDefault = false;
      });
    }

    addresses[addressIndex] = { ...addresses[addressIndex], ...updateData };
    (user as any).addresses = addresses;
    await user.save();

    return addresses[addressIndex];
  }

  async deleteAddress(userId: string, addressId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const addresses = (user as any).addresses || [];
    const addressIndex = addresses.findIndex(
      (addr: Address, index: number) => index.toString() === addressId,
    );

    if (addressIndex === -1) {
      throw new NotFoundException('Address not found');
    }

    addresses.splice(addressIndex, 1);
    (user as any).addresses = addresses;
    await user.save();

    return { message: 'Address deleted successfully' };
  }

  async getWishlist(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .populate('wishlist')
      .select('wishlist');
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return (user as any).wishlist || [];
  }

  async addToWishlist(userId: string, productId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const wishlist = (user as any).wishlist || [];
    if (!wishlist.includes(productId)) {
      wishlist.push(productId);
      (user as any).wishlist = wishlist;
      await user.save();
    }

    return { message: 'Product added to wishlist' };
  }

  async removeFromWishlist(userId: string, productId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const wishlist = (user as any).wishlist || [];
    (user as any).wishlist = wishlist.filter(
      (id: string) => id.toString() !== productId,
    );
    await user.save();

    return { message: 'Product removed from wishlist' };
  }
}

