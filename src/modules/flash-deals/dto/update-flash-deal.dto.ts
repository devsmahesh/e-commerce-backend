import { PartialType } from '@nestjs/swagger';
import { CreateFlashDealDto } from './create-flash-deal.dto';

export class UpdateFlashDealDto extends PartialType(CreateFlashDealDto) {}

