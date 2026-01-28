import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([
      // Schemas will be registered here by their respective modules
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}

