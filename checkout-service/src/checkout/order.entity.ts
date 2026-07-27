import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

export type OrderStatus = 'confirmed' | 'degraded' | 'queued' | 'failed' | 'pending';

@Entity()
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column('decimal')
  amount: number;

  @Column()
  currency: string;

  @Column()
  status: OrderStatus;

  @Column({ nullable: true })
  chargeId: string;

  @Column({ nullable: true })
  note: string;
}
