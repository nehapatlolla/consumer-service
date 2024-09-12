import { Module } from '@nestjs/common';
import { QueueProcessorService } from './queue-processor';
import { ConsumerController } from './queue.controller';

@Module({
  providers: [QueueProcessorService],
  controllers: [ConsumerController],
})
export class QueueProcessorModule {}
