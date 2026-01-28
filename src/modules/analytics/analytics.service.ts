import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async getRevenueStats(startDate?: Date, endDate?: Date) {
    const matchStage: any = {
      status: { $in: [OrderStatus.Paid, OrderStatus.Delivered] },
    };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = startDate;
      if (endDate) matchStage.createdAt.$lte = endDate;
    }

    const stats = await this.orderModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: '$total' },
        },
      },
    ]);

    return stats[0] || {
      totalRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0,
    };
  }

  async getDailyRevenue(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailyRevenue = await this.orderModel.aggregate([
      {
        $match: {
          status: { $in: [OrderStatus.Paid, OrderStatus.Delivered] },
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return dailyRevenue;
  }

  async getMonthlySales(months = 12) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const monthlySales = await this.orderModel.aggregate([
      {
        $match: {
          status: { $in: [OrderStatus.Paid, OrderStatus.Delivered] },
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$createdAt' },
          },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return monthlySales;
  }

  async getBestSellingProducts(limit = 10) {
    const bestSellers = await this.orderModel.aggregate([
      {
        $match: {
          status: { $in: [OrderStatus.Paid, OrderStatus.Delivered] },
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.total' },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $project: {
          productId: '$_id',
          productName: '$product.name',
          productSlug: '$product.slug',
          totalSold: 1,
          revenue: 1,
        },
      },
    ]);

    return bestSellers;
  }

  async getUserGrowth(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const userGrowth = await this.userModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          newUsers: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return userGrowth;
  }

  async getTopCategories(limit = 10) {
    const topCategories = await this.orderModel.aggregate([
      {
        $match: {
          status: { $in: [OrderStatus.Paid, OrderStatus.Delivered] },
        },
      },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.categoryId',
          totalSold: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.total' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: '$category' },
      {
        $project: {
          categoryId: '$_id',
          categoryName: '$category.name',
          totalSold: 1,
          revenue: 1,
        },
      },
    ]);

    return topCategories;
  }
}

