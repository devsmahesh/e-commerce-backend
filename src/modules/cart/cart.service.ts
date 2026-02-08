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
    const { productId, variantId, quantity } = addToCartDto;

    // Verify product exists and is available
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.isActive) {
      throw new BadRequestException('Product is not available');
    }

    // Handle variant if provided
    let selectedVariant: any = null;
    let price = product.price;
    let stock = product.stock;
    let variantName: string | undefined = undefined;

    if (variantId) {
      if (!product.variants || product.variants.length === 0) {
        throw new BadRequestException('Product does not have variants');
      }

      // Find the variant - Mongoose subdocuments have _id property
      selectedVariant = product.variants.find(
        (v: any) => {
          const vId = (v as any)._id?.toString() || (v as any).id?.toString();
          return vId === variantId;
        },
      );

      if (!selectedVariant) {
        throw new NotFoundException('Variant not found');
      }

      price = selectedVariant.price;
      stock = selectedVariant.stock;
      variantName = selectedVariant.name;
    } else if (product.variants && product.variants.length > 0) {
      // If product has variants but no variant selected, use default variant
      const defaultVariant = product.variants.find((v: any) => v.isDefault === true);
      if (defaultVariant) {
        selectedVariant = defaultVariant;
        price = defaultVariant.price;
        stock = defaultVariant.stock;
        variantName = defaultVariant.name;
        // Note: variantId will remain undefined, which is fine for default variant
      }
    }

    // Check stock
    if (stock < quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    // Get or create cart
    let cart = await this.cartModel.findOne({ userId });
    if (!cart) {
      cart = await this.cartModel.create({ userId, items: [], total: 0 });
    }

    // Check if same product with same variant already in cart
    const existingItemIndex = cart.items.findIndex(
      (item) => 
        item.productId.toString() === productId &&
        (item.variantId === variantId || (!item.variantId && !variantId)),
    );

    if (existingItemIndex > -1) {
      // Replace quantity (don't add to existing)
      if (stock < quantity) {
        throw new BadRequestException('Insufficient stock');
      }
      cart.items[existingItemIndex].quantity = quantity;
      cart.items[existingItemIndex].price = price;
      if (variantId) {
        cart.items[existingItemIndex].variantId = variantId;
        cart.items[existingItemIndex].variantName = variantName;
      }
    } else {
      // Add new item
      const newItem: any = {
        productId: new Types.ObjectId(productId),
        quantity,
        price,
      };
      
      if (variantId) {
        newItem.variantId = variantId;
        newItem.variantName = variantName;
      } else if (selectedVariant) {
        // Default variant selected but no variantId provided
        // Mongoose subdocuments have _id property
        const variantDoc = selectedVariant as any;
        newItem.variantId = variantDoc._id?.toString();
        newItem.variantName = variantName;
      }

      cart.items.push(newItem);
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

    const cartItem = cart.items[itemIndex];

    // Verify stock
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    let stock = product.stock;
    let price = product.price;

    // If cart item has variant, check variant stock
    if (cartItem.variantId) {
      if (!product.variants || product.variants.length === 0) {
        throw new BadRequestException('Product variant not found');
      }

      const variant = product.variants.find(
        (v: any) => {
          const vId = (v as any)._id?.toString() || (v as any).id?.toString();
          return vId === cartItem.variantId;
        },
      );

      if (!variant) {
        throw new NotFoundException('Variant not found');
      }

      stock = variant.stock;
      price = variant.price;
    }

    if (stock < updateDto.quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    cart.items[itemIndex].quantity = updateDto.quantity;
    cart.items[itemIndex].price = price;

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
      
      const formattedItem: any = {
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

      // Include variant information if present
      if (item.variantId) {
        formattedItem.variantId = item.variantId;
        formattedItem.variantName = item.variantName;
      }

      return formattedItem;
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

