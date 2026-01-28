import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Model } from 'mongoose';
import { ProductsService } from './products.service';
import { Product, ProductDocument } from './schemas/product.schema';
import { RedisService } from '../../config/redis/redis.service';
import { CreateProductDto } from './dto/create-product.dto';

describe('ProductsService', () => {
  let service: ProductsService;
  let productModel: Model<ProductDocument>;
  let redisService: RedisService;

  const mockProductModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    flushPattern: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getModelToken(Product.name),
          useValue: mockProductModel,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    productModel = module.get<Model<ProductDocument>>(
      getModelToken(Product.name),
    );
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a product successfully', async () => {
      const createProductDto: CreateProductDto = {
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 10,
        categoryId: 'category-id',
      };

      mockProductModel.findOne.mockResolvedValue(null);
      mockProductModel.create.mockResolvedValue({
        ...createProductDto,
        _id: '123',
        slug: 'test-product',
      });
      mockRedisService.flushPattern.mockResolvedValue(undefined);

      const result = await service.create(createProductDto);

      expect(result).toBeDefined();
      expect(mockProductModel.findOne).toHaveBeenCalled();
      expect(mockProductModel.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if product slug exists', async () => {
      const createProductDto: CreateProductDto = {
        name: 'Test Product',
        description: 'Test Description',
        price: 99.99,
        stock: 10,
        categoryId: 'category-id',
      };

      mockProductModel.findOne.mockResolvedValue({ slug: 'test-product' });

      await expect(service.create(createProductDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      const productId = '123';
      const mockProduct = {
        _id: productId,
        name: 'Test Product',
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: productId,
          name: 'Test Product',
        }),
      };

      mockRedisService.get.mockResolvedValue(null);
      mockProductModel.findById.mockReturnValue(mockProduct);
      mockRedisService.set.mockResolvedValue(undefined);

      const result = await service.findOne(productId);

      expect(result).toBeDefined();
      expect(mockProductModel.findById).toHaveBeenCalledWith(productId);
    });

    it('should throw NotFoundException if product not found', async () => {
      const productId = '123';

      mockRedisService.get.mockResolvedValue(null);
      mockProductModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne(productId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

