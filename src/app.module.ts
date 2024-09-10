import { Module } from '@nestjs/common';
import { QueueProcessorModule } from './queue/queue.module';

@Module({
  imports: [QueueProcessorModule],
})
export class AppModule {}
