import { Module } from '@nestjs/common';
import { QueueProcessorService } from './queue-processor';

@Module({
  providers: [QueueProcessorService],
})
export class QueueProcessorModule {}
