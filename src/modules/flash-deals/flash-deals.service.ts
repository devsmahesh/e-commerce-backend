import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  FlashDeal,
  FlashDealDocument,
  FlashDealType,
} from './schemas/flash-deal.schema';
import { CreateFlashDealDto } from './dto/create-flash-deal.dto';
import { UpdateFlashDealDto } from './dto/update-flash-deal.dto';
import { QueryFlashDealDto } from './dto/query-flash-deal.dto';

@Injectable()
export class FlashDealsService {
  constructor(
    @InjectModel(FlashDeal.name)
    private flashDealModel: Model<FlashDealDocument>,
  ) {}

  /**
   * Get active flash deals (public endpoint)
   * Only returns deals that are:
   * - active === true
   * - current date is between startDate and endDate
   * Sorted by priority (descending), then createdAt (descending)
   */
  async findActive(queryDto: QueryFlashDealDto = {}) {
    const now = new Date();
    const limit = queryDto.limit || 10;

    // Build query for active deals within date range
    const query: any = {
      active: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    };

    // Apply type filter if provided
    if (queryDto.type) {
      query.type = queryDto.type;
    }

    const deals = await this.flashDealModel
      .find(query)
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit)
      .exec();

    return deals;
  }

  /**
   * Get all flash deals (admin endpoint)
   * Returns all deals regardless of date/active status
   */
  async findAll(queryDto: QueryFlashDealDto = {}) {
    const query: any = {};
    const limit = queryDto.limit || 10;

    // Apply active filter if provided
    if (queryDto.active !== undefined) {
      query.active = queryDto.active;
    }

    // Apply type filter if provided
    if (queryDto.type) {
      query.type = queryDto.type;
    }

    const deals = await this.flashDealModel
      .find(query)
      .sort({ priority: -1, createdAt: -1 })
      .limit(limit)
      .exec();

    return deals;
  }

  /**
   * Get flash deal by ID
   */
  async findOne(id: string) {
    const deal = await this.flashDealModel.findById(id);
    if (!deal) {
      throw new NotFoundException('Flash deal not found');
    }
    return deal;
  }

  /**
   * Create a new flash deal
   */
  async create(createFlashDealDto: CreateFlashDealDto) {
    // Validate endDate is after startDate
    const startDate = new Date(createFlashDealDto.startDate);
    const endDate = new Date(createFlashDealDto.endDate);

    if (endDate <= startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }

    // Validate discountPercentage is provided for discount type
    if (
      createFlashDealDto.type === FlashDealType.Discount &&
      createFlashDealDto.discountPercentage === undefined
    ) {
      throw new BadRequestException(
        'discountPercentage is required when type is discount',
      );
    }

    const deal = await this.flashDealModel.create({
      ...createFlashDealDto,
      startDate,
      endDate,
      active: createFlashDealDto.active !== undefined ? createFlashDealDto.active : true,
      priority: createFlashDealDto.priority || 0,
      minPurchaseAmount: createFlashDealDto.minPurchaseAmount || 0,
      link: createFlashDealDto.link || '',
      buttonVariant: createFlashDealDto.buttonVariant || 'default',
    });

    return deal;
  }

  /**
   * Update a flash deal
   */
  async update(id: string, updateFlashDealDto: UpdateFlashDealDto) {
    const deal = await this.flashDealModel.findById(id);
    if (!deal) {
      throw new NotFoundException('Flash deal not found');
    }

    // Validate endDate is after startDate if both are being updated
    if (updateFlashDealDto.startDate && updateFlashDealDto.endDate) {
      const startDate = new Date(updateFlashDealDto.startDate);
      const endDate = new Date(updateFlashDealDto.endDate);

      if (endDate <= startDate) {
        throw new BadRequestException('endDate must be after startDate');
      }
    } else if (updateFlashDealDto.endDate) {
      // If only endDate is being updated, compare with existing startDate
      const endDate = new Date(updateFlashDealDto.endDate);
      if (endDate <= deal.startDate) {
        throw new BadRequestException('endDate must be after startDate');
      }
    } else if (updateFlashDealDto.startDate) {
      // If only startDate is being updated, compare with existing endDate
      const startDate = new Date(updateFlashDealDto.startDate);
      if (startDate >= deal.endDate) {
        throw new BadRequestException('startDate must be before endDate');
      }
    }

    // Validate discountPercentage for discount type
    if (updateFlashDealDto.type === FlashDealType.Discount) {
      // If type is being changed to discount, discountPercentage must be provided
      if (
        updateFlashDealDto.discountPercentage === undefined &&
        deal.type !== FlashDealType.Discount
      ) {
        throw new BadRequestException(
          'discountPercentage is required when type is discount',
        );
      }
    }

    // Convert date strings to Date objects if provided
    const updateData: any = { ...updateFlashDealDto };
    if (updateFlashDealDto.startDate) {
      updateData.startDate = new Date(updateFlashDealDto.startDate);
    }
    if (updateFlashDealDto.endDate) {
      updateData.endDate = new Date(updateFlashDealDto.endDate);
    }

    const updatedDeal = await this.flashDealModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    return updatedDeal;
  }

  /**
   * Delete a flash deal
   */
  async remove(id: string) {
    const deal = await this.flashDealModel.findById(id);
    if (!deal) {
      throw new NotFoundException('Flash deal not found');
    }

    await this.flashDealModel.findByIdAndDelete(id);
    return { message: 'Flash deal deleted successfully' };
  }
}

