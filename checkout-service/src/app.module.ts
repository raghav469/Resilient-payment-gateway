import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckoutModule } from './checkout/checkout.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register(),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        if (process.env.DATABASE_URL) {
          return {
            type: 'postgres',
            url: process.env.DATABASE_URL,
            autoLoadEntities: true,
            synchronize: true, // For demo purposes
            ssl: { rejectUnauthorized: false },
          };
        }
        return {
          type: 'postgres',
          host: process.env.POSTGRES_HOST || 'localhost',
          port: 5432,
          username: 'root',
          password: 'password',
          database: 'checkout_db',
          autoLoadEntities: true,
          synchronize: true,
        };
      },
    }),
    CheckoutModule,
  ],
})
export class AppModule {}
