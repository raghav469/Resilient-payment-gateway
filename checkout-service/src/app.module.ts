import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckoutModule } from './checkout/checkout.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.POSTGRES_HOST || 'localhost',
      port: 5432,
      username: 'root',
      password: 'password',
      database: 'checkout_db',
      autoLoadEntities: true,
      synchronize: true, // For demo purposes
    }),
    CheckoutModule,
  ],
})
export class AppModule {}
