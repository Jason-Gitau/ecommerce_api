import { IsUUID } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsUUID('4')
  orderId: string;
}