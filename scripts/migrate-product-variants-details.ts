/**
 * Migration Script: Add Variants and Details to Products
 * 
 * This script adds the variants and details fields to existing products in the database.
 * 
 * Usage:
 *   npx ts-node scripts/migrate-product-variants-details.ts
 * 
 * Or with tsx:
 *   npx tsx scripts/migrate-product-variants-details.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '../src/modules/products/schemas/product.schema';
import { getModelToken } from '@nestjs/mongoose';

async function migrate() {
  console.log('🚀 Starting migration: Add variants and details to products...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const productModel = app.get<Model<ProductDocument>>(getModelToken(Product.name));

  try {
    // Find all products that don't have variants or details fields
    const products = await productModel.find({
      $or: [
        { variants: { $exists: false } },
        { details: { $exists: false } },
      ],
    }).exec();

    console.log(`📦 Found ${products.length} products to migrate\n`);

    let migrated = 0;
    let skipped = 0;

    for (const product of products) {
      const updateData: any = {};

      // Add variants field if missing (default to empty array)
      if (!product.variants) {
        updateData.variants = [];
      }

      // Add details field if missing (default to empty object)
      if (!product.details) {
        updateData.details = {};
      }

      // Only update if there's something to update
      if (Object.keys(updateData).length > 0) {
        await productModel.findByIdAndUpdate(product._id, {
          $set: updateData,
        }).exec();
        migrated++;
        console.log(`✅ Migrated product: ${product.name} (${product._id})`);
      } else {
        skipped++;
      }
    }

    console.log(`\n✨ Migration completed!`);
    console.log(`   - Migrated: ${migrated} products`);
    console.log(`   - Skipped: ${skipped} products`);
    console.log(`   - Total: ${products.length} products\n`);

    // Optional: Create default variant from existing price/stock for products without variants
    console.log('📝 Optional: Creating default variants from existing price/stock...\n');
    
    const productsWithoutVariants = await productModel.find({
      $or: [
        { variants: { $exists: false } },
        { variants: { $size: 0 } },
      ],
      price: { $exists: true, $gt: 0 },
    }).exec();

    let defaultVariantsCreated = 0;

    for (const product of productsWithoutVariants) {
      // Only create default variant if product has valid price and stock
      if (product.price > 0) {
        const defaultVariant = {
          name: 'Default',
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          stock: product.stock || 0,
          sku: product.sku,
          tags: [],
          isDefault: true,
        };

        await productModel.findByIdAndUpdate(product._id, {
          $set: {
            variants: [defaultVariant],
          },
        }).exec();
        
        defaultVariantsCreated++;
        console.log(`✅ Created default variant for: ${product.name} (${product._id})`);
      }
    }

    if (defaultVariantsCreated > 0) {
      console.log(`\n✨ Created ${defaultVariantsCreated} default variants\n`);
    } else {
      console.log(`\n✨ No default variants created (products already have variants or invalid data)\n`);
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });

