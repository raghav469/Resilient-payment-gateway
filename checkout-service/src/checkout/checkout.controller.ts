import { Body, Controller, Post } from '@nestjs/common';
import { CheckoutService } from './checkout.service';

class CheckoutDto {
  userId: string;
  amount: number;
  currency: string;
}

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  async checkout(@Body() dto: CheckoutDto) {
    return this.checkoutService.processCheckout(dto);
  }
}
