import { Controller, Post, Body, Logger } from '@nestjs/common';
import { CheckUserStatusDto } from './dto/check-user-status.dto';
import { QueueProcessorService } from './queue-processor';

@Controller('check-status')
export class ConsumerController {
  private readonly logger = new Logger(ConsumerController.name);

  constructor(private readonly QueueProcessorService: QueueProcessorService) {}

  @Post()
  async checkStatus(@Body() checkUserStatusDto: CheckUserStatusDto) {
    try {
      const result =
        await this.QueueProcessorService.checkUserStatus(checkUserStatusDto);
      return result;
    } catch (error) {
      this.logger.error('Error in checkStatus endpoint:', error);
      throw error;
    }
  }
}
