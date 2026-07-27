import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../checkout/order.entity';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';
import { Redis } from 'ioredis';

@Injectable()
export class DlqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DlqService.name);
  private isShuttingDown = false;

  private redis: Redis;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly httpService: HttpService,
    @InjectMetric('payment_dlq_depth') public dlqDepthGauge: Gauge<string>,
  ) {
    if (process.env.REDIS_URL) {
      const url = process.env.REDIS_URL.replace('redis://', 'rediss://');
      this.redis = new Redis(url, { family: 0 });
    } else {
      this.redis = new Redis({ host: process.env.REDIS_HOST || 'localhost', port: 6379 });
    }
  }

  async onModuleInit() {
    this.dlqDepthGauge.set(0);
    this.startConsumerLoop();
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
  }

  private async startConsumerLoop() {
    while (!this.isShuttingDown) {
      let payload: any = null;
      try {
        // blpop blocks until an element is pushed, timing out after 2 seconds to allow shutdown checks
        const result = await this.redis.blpop('payment-dlq', 2);
        if (result) {
          const [, value] = result;
          payload = JSON.parse(value);
          this.logger.log(`[DLQ] Processing failed order ${payload.orderId}`);
          
          await this.replayPayment(payload);
        }
      } catch (err) {
        if (payload) {
          this.logger.warn(`[DLQ] Provider still failing for order ${payload.orderId}. Re-queuing.`);
          await this.redis.rpush('payment-dlq', JSON.stringify(payload));
        }
        // Wait before retrying to prevent hot loop
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  async publishToDlq(orderId: string, amount: number, currency: string) {
    try {
      await this.redis.rpush('payment-dlq', JSON.stringify({ orderId, amount, currency }));
      this.dlqDepthGauge.inc();
      this.logger.log(`Order ${orderId} published to DLQ`);
    } catch (err) {
      this.logger.error(`Failed to publish order ${orderId} to DLQ`, err);
    }
  }

  private async replayPayment(payload: { orderId: string; amount: number; currency: string }) {
    const order = await this.orderRepository.findOne({ where: { id: payload.orderId } });
    if (!order) return;

    const mockUrl = process.env.MOCK_PROVIDER_URL || 'http://localhost:3002';
    const response = await lastValueFrom(
      this.httpService.post(`${mockUrl}/charge`, {
        amount: payload.amount,
        currency: payload.currency,
      }, { timeout: 2000 })
    );

    order.status = 'confirmed';
    order.chargeId = response.data.transactionId;
    order.note = 'recovered from dlq';
    await this.orderRepository.save(order);
    this.dlqDepthGauge.dec();
    this.logger.log(`[DLQ] Order ${order.id} successfully recovered!`);
  }
}
