import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument } from './schemas/cart.schema';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { Product, ProductDocument } from '../products/schemas/product.schema';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  async getCart(userId: string) {
    let cart = await this.cartModel
      .findOne({ userId })
      .populate('items.productId', 'name slug images price stock')
      .exec();

    if (!cart) {
      cart = await this.cartModel.create({ userId, items: [], total: 0 });
    }

    // Recalculate totals
    const calculations = this.calculateCartTotals(cart);
    cart.total = calculations.total;

    // Format response with proper structure
    return this.formatCartResponse(cart, calculations);
  }

  async addToCart(userId: string, addToCartDto: AddToCartDto) {
    const { productId, quantity } = addToCartDto;

    // Verify product exists and is available
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.isActive) {
      throw new BadRequestException('Product is not available');
    }

    if (product.stock < quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    // Get or create cart
    let cart = await this.cartModel.findOne({ userId });
    if (!cart) {
      cart = await this.cartModel.create({ userId, items: [], total: 0 });
    }

    // Check if product already in cart
    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId,
    );

    if (existingItemIndex > -1) {
      // Replace quantity (don't add to existing)
      if (product.stock < quantity) {
        throw new BadRequestException('Insufficient stock');
      }
      cart.items[existingItemIndex].quantity = quantity;
      cart.items[existingItemIndex].price = product.price;
    } else {
      // Add new item
      cart.items.push({
        productId: new Types.ObjectId(productId),
        quantity,
        price: product.price,
      });
    }

    await this.calculateTotal(cart);
    await cart.save();

    return this.getCart(userId);
  }

  async updateCartItem(userId: string, productId: string, updateDto: UpdateCartItemDto) {
    const cart = await this.cartModel.findOne({ userId });
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId,
    );

    if (itemIndex === -1) {
      throw new NotFoundException('Item not found in cart');
    }

    // Verify stock
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.stock < updateDto.quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    cart.items[itemIndex].quantity = updateDto.quantity;
    cart.items[itemIndex].price = product.price;

    await this.calculateTotal(cart);
    await cart.save();

    return this.getCart(userId);
  }

  async removeFromCart(userId: string, productId: string) {
    const cart = await this.cartModel.findOne({ userId });
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId,
    );

    await this.calculateTotal(cart);
    await cart.save();

    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.cartModel.findOne({ userId });
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    cart.items = [];
    cart.total = 0;
    await cart.save();

    return { message: 'Cart cleared successfully' };
  }

  private async calculateTotal(cart: CartDocument) {
    const calculations = this.calculateCartTotals(cart);
    cart.total = calculations.total;
  }

  private calculateCartTotals(cart: CartDocument) {
    let subtotal = 0;
    for (const item of cart.items) {
      subtotal += item.price * item.quantity;
    }

    const tax = subtotal * 0.1; // 10% tax - adjust as needed
    const shipping = 0; // Shipping cost is typically set during checkout
    const discount = 0; // Discount is applied during order creation
    const total = subtotal + shipping + tax - discount;

    return {
      subtotal,
      tax,
      shipping,
      discount,
      total,
    };
  }

  private formatCartResponse(cart: CartDocument, calculations: any) {
    const formattedItems = cart.items.map((item: any, index: number) => {
      const product = item.productId;
      // Use productId as item id since cart items are embedded documents
      const itemId = item.productId?._id?.toString() || item.productId?.toString() || `item-${index}`;
      
      return {
        id: itemId,
        product: product && typeof product === 'object' && product._id
          ? {
              id: product._id.toString(),
              name: product.name,
              price: product.price,
              images: product.images || [],
            }
          : null,
        quantity: item.quantity,
        price: item.price,
      };
    });

    return {
      id: cart._id?.toString(),
      items: formattedItems,
      subtotal: calculations.subtotal,
      tax: calculations.tax,
      shipping: calculations.shipping,
      discount: calculations.discount,
      total: calculations.total,
    };
  }
}

