import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { Order } from './order.entity';
import { AdminController } from '../admin/admin.controller';
import { Redis } from 'ioredis';
import { DlqModule } from '../dlq/dlq.module';
import { makeGaugeProvider, makeCounterProvider } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    HttpModule,
    DlqModule,
  ],
  controllers: [CheckoutController, AdminController],
  providers: [
    CheckoutService,
    makeGaugeProvider({
      name: 'payment_circuit_state',
      help: 'Current state of the circuit breaker (0=closed, 1=half-open, 2=open)',
    }),
    makeCounterProvider({
      name: 'payment_retries_total',
      help: 'Total number of payment retries',
    }),
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        if (process.env.REDIS_URL) {
          // Use full connection string (e.g., Upstash)
          // ioredis automatically handles TLS if the URL is rediss://
          const url = process.env.REDIS_URL.replace('redis://', 'rediss://');
          return new Redis(url, { family: 0 });
        }
        return new Redis({ host: process.env.REDIS_HOST || 'localhost', port: 6379 });
      },
    },
  ],
})
export class CheckoutModule {}
