import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Banner, BannerDocument } from '../admin/schemas/banner.schema';

export interface FindBannersOptions {
  position?: string;
  active?: boolean;
}

@Injectable()
export class BannersService {
  constructor(
    @InjectModel(Banner.name) private bannerModel: Model<BannerDocument>,
  ) {}

  async findAll(options: FindBannersOptions = {}) {
    const now = new Date();
    const query: any = {
      active: options.active !== undefined ? options.active : true,
      $and: [
        {
          $or: [
            { startDate: { $exists: false } },
            { startDate: { $lte: now } },
          ],
        },
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: { $gte: now } },
          ],
        },
      ],
    };

    if (options.position) {
      query.position = options.position;
    }

    const banners = await this.bannerModel
      .find(query)
      .sort({ createdAt: -1 })
      .exec();

    // Transform banners to use 'id' instead of '_id'
    return banners.map((banner) => {
      const bannerObj: any = banner.toObject ? banner.toObject() : banner;
      return {
        id: bannerObj._id?.toString() || bannerObj.id,
        title: bannerObj.title,
        image: bannerObj.image,
        link: bannerObj.link,
        position: bannerObj.position,
        active: bannerObj.active,
        startDate: bannerObj.startDate,
        endDate: bannerObj.endDate,
        description: bannerObj.description,
        createdAt: bannerObj.createdAt,
        updatedAt: bannerObj.updatedAt,
      };
    });
  }
}

