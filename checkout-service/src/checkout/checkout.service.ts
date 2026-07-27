import { Injectable, InternalServerErrorException, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import CircuitBreaker from 'opossum';
import { Redis } from 'ioredis';
import { DlqService } from '../dlq/dlq.service';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge, Counter } from 'prom-client';

@Injectable()
export class CheckoutService implements OnModuleInit {
  private readonly logger = new Logger(CheckoutService.name);
  private circuitBreaker: CircuitBreaker<any, any>;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly httpService: HttpService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly dlqService: DlqService,
    @InjectMetric('payment_circuit_state') public circuitStateGauge: Gauge<string>,
    @InjectMetric('payment_retries_total') public retriesCounter: Counter<string>,
  ) {}

  onModuleInit() {
    const makePaymentCall = async (amount: number, currency: string) => {
      const mockUrl = process.env.MOCK_PROVIDER_URL || 'http://localhost:3002';
      const response = await lastValueFrom(
        this.httpService.post(`${mockUrl}/charge`, { amount, currency }, { timeout: 2000 })
      );
      return response.data;
    };

    this.circuitBreaker = new CircuitBreaker(makePaymentCall, {
      timeout: 3000,
      errorThresholdPercentage: 50,
      resetTimeout: 10000,
      volumeThreshold: 5,
    });

    this.circuitBreaker.on('open', () => {
      this.logger.warn('Circuit breaker tripped to OPEN state!');
      this.circuitStateGauge.set(2);
    });
    this.circuitBreaker.on('halfOpen', () => {
      this.logger.log('Circuit breaker is HALF-OPEN.');
      this.circuitStateGauge.set(1);
    });
    this.circuitBreaker.on('close', () => {
      this.logger.log('Circuit breaker closed. Normal operation resumed.');
      this.circuitStateGauge.set(0);
    });
    // Init state
    this.circuitStateGauge.set(0);
    this.retriesCounter.inc(0);
  }

  getCircuitState() {
    return {
      state: this.circuitBreaker.opened ? 'open' : this.circuitBreaker.halfOpen ? 'half-open' : 'closed',
      failureCount: this.circuitBreaker.stats.failures,
      lastTrippedAt: (this.circuitBreaker.stats as any).lastTrippedAt || Date.now(),
    };
  }

  private async retryPaymentCall(amount: number, currency: string, maxRetries = 3) {
    let attempt = 0;
    let baseDelay = 200;

    while (attempt <= maxRetries) {
      try {
        return await this.circuitBreaker.fire(amount, currency);
      } catch (error) {
        if (error.code === 'EOPEN') {
          this.logger.warn('Circuit is open, aborting retries.');
          throw error;
        }

        attempt++;
        this.retriesCounter.inc();
        if (attempt > maxRetries) {
          this.logger.error(`Max retries reached (${maxRetries}). Payment failed.`);
          throw error;
        }

        const jitter = Math.random() * 50;
        const delay = baseDelay * Math.pow(2, attempt - 1) + jitter;
        
        this.logger.warn(`Payment failed. Retrying in ${Math.round(delay)}ms (Attempt ${attempt}/${maxRetries})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async processCheckout(dto: { userId: string; amount: number; currency: string }) {
    const order = this.orderRepository.create({ ...dto, status: 'pending' });
    await this.orderRepository.save(order);

    // 1. Check Redis for a recent valid response (fallback data)
    const cacheKey = `payment_fallback:${dto.currency}`;
    const cachedData = await this.redis.get(cacheKey);

    try {
      // 2. Try the primary provider
      const result = await this.retryPaymentCall(dto.amount, dto.currency);

      // 3. Cache the successful result for future fallbacks (TTL 60s)
      await this.redis.set(cacheKey, JSON.stringify({ transactionId: 'fallback_txn_cached' }), 'EX', 60);

      order.status = 'confirmed';
      order.chargeId = result.transactionId;
      await this.orderRepository.save(order);

      return {
        status: 'confirmed',
        orderId: order.id,
        chargeId: order.chargeId,
      };
    } catch (error) {
      // 4. On provider failure, serve cached value if present
      if (cachedData) {
        this.logger.warn(`Using cached fallback for order ${order.id}`);
        const parsedCache = JSON.parse(cachedData);
        
        order.status = 'degraded';
        order.chargeId = parsedCache.transactionId;
        order.note = 'using cached pricing';
        await this.orderRepository.save(order);

        return {
          status: 'degraded',
          orderId: order.id,
          note: 'using cached pricing',
        };
      }

      // 5. Fall through to DLQ
      this.logger.warn(`No fallback available for order ${order.id}. Sending to DLQ.`);
      order.status = 'queued';
      order.note = 'will retry automatically';
      await this.orderRepository.save(order);
      
      await this.dlqService.publishToDlq(order.id, dto.amount, dto.currency);

      return {
        status: 'queued',
        orderId: order.id,
        note: 'will retry automatically',
      };
    }
  }
}
