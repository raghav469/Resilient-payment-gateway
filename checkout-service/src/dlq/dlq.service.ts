import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer, Consumer } from 'kafkajs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../checkout/order.entity';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';

@Injectable()
export class DlqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DlqService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly httpService: HttpService,
    @InjectMetric('payment_dlq_depth') public dlqDepthGauge: Gauge<string>,
  ) {
    this.kafka = new Kafka({
      clientId: 'checkout-service',
      brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
    });
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: 'dlq-replay-group' });
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: 'payment-dlq', fromBeginning: true });
      this.dlqDepthGauge.set(0);

      // Start the consumer loop
      this.consumer.run({
        eachMessage: async ({ message }) => {
          if (!message.value) return;
          const payload = JSON.parse(message.value.toString());
          this.logger.log(`[DLQ] Processing failed order ${payload.orderId}`);
          await this.replayPayment(payload);
        },
      });
    } catch (err) {
      this.logger.error('Failed to connect to Kafka. DLQ disabled.', err);
    }
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
    await this.consumer.disconnect();
  }

  async publishToDlq(orderId: string, amount: number, currency: string) {
    try {
      await this.producer.send({
        topic: 'payment-dlq',
        messages: [{ value: JSON.stringify({ orderId, amount, currency }) }],
      });
      this.dlqDepthGauge.inc();
      this.logger.log(`Order ${orderId} published to DLQ`);
    } catch (err) {
      this.logger.error(`Failed to publish order ${orderId} to DLQ`, err);
    }
  }

  private async replayPayment(payload: { orderId: string; amount: number; currency: string }) {
    const order = await this.orderRepository.findOne({ where: { id: payload.orderId } });
    if (!order) return;

    try {
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
    } catch (error) {
      this.logger.warn(`[DLQ] Provider still failing for order ${order.id}. Throwing to retry later.`);
      // Throwing error causes kafkajs to retry the message based on its retry policy
      throw error;
    }
  }
}
