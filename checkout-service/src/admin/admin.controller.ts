import { Controller, Get } from '@nestjs/common';
import { CheckoutService } from '../checkout/checkout.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Get('circuit-state')
  getCircuitState() {
    return this.checkoutService.getCircuitState();
  }
}
