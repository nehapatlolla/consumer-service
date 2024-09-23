import { Test, TestingModule } from '@nestjs/testing';
import { QueueProcessorService } from './queue-processor';
import { SQSClient } from '@aws-sdk/client-sqs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const mockMessage = {
  Body: JSON.stringify({
    operation: 'create',
    user: { id: '1', email: 'test@example.com' },
  }),
  ReceiptHandle: 'mockReceiptHandle',
};

const mockSQSClient = {
  send: jest.fn(),
};

const mockDynamoDBClient = {
  send: jest.fn(),
};

describe('QueueProcessorService', () => {
  let queueProcessorService: QueueProcessorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueProcessorService,
        { provide: SQSClient, useValue: mockSQSClient },
        { provide: DynamoDBClient, useValue: mockDynamoDBClient },
      ],
    }).compile();

    queueProcessorService = module.get<QueueProcessorService>(
      QueueProcessorService,
    );
  });

  it('should be defined', () => {
    expect(queueProcessorService).toBeDefined();
  });

  describe('pollQueue', () => {
    it('should poll the queue and process messages', async () => {
      mockSQSClient.send.mockResolvedValueOnce({
        Messages: [mockMessage],
      });

      await queueProcessorService['pollQueue']();

      expect(mockSQSClient.send).toHaveBeenCalled();
      expect(mockDynamoDBClient.send).toHaveBeenCalled();
    });

    it('should handle no messages gracefully', async () => {
      mockSQSClient.send.mockResolvedValueOnce({ Messages: [] });

      await queueProcessorService['pollQueue']();

      expect(mockSQSClient.send).toHaveBeenCalled();
      // Ensure no DynamoDB calls were made
      expect(mockDynamoDBClient.send).not.toHaveBeenCalled();
    });
  });

  describe('handleUserEvent', () => {
    it('should process user creation event', async () => {
      mockDynamoDBClient.send.mockResolvedValueOnce('User created in DB');

      await queueProcessorService['handleUserEvent'](mockMessage);

      expect(mockDynamoDBClient.send).toHaveBeenCalled();
    });

    it('should return an error if the message is invalid', async () => {
      const invalidMessage = { Body: null };

      await queueProcessorService['handleUserEvent'](invalidMessage);

      expect(mockDynamoDBClient.send).not.toHaveBeenCalled();
    });
  });
});
