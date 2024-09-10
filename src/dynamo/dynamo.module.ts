import { Module } from '@nestjs/common';
import { DynamoDBService } from './dynamo.service';

@Module({
  providers: [DynamoDBService],
  exports: [DynamoDBService],
})
export class DynamoModule {}
