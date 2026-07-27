import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { DlqService } from './dlq.service';
import { Order } from '../checkout/order.entity';
import { makeGaugeProvider } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    HttpModule,
  ],
  providers: [
    DlqService,
    makeGaugeProvider({
      name: 'payment_dlq_depth',
      help: 'Number of failed checkouts currently in DLQ',
    }),
  ],
  exports: [DlqService],
})
export class DlqModule {}
