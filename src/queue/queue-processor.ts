import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

@Injectable()
export class QueueProcessorService implements OnModuleInit {
  private readonly sqsClient: SQSClient;
  private readonly dynamoDBClient: DynamoDBClient;
  private readonly queueUrl: string;
  private readonly tableName = 'Users';
  private readonly logger = new Logger(QueueProcessorService.name);
  private readonly pollingInterval = 100000; // 30 seconds

  constructor() {
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION,
    });

    this.dynamoDBClient = new DynamoDBClient({
      region: process.env.AWS_REGION,
    });

    this.queueUrl = process.env.SQS_QUEUE_URL;
  }

  async onModuleInit() {
    this.pollQueue();
  }

  private async pollQueue() {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: this.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
      });

      const response = await this.sqsClient.send(command);

      if (response.Messages && response.Messages.length > 0) {
        for (const message of response.Messages) {
          await this.handleUserEvent(message);

          // Delete message after processing
          await this.sqsClient.send(
            new DeleteMessageCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: message.ReceiptHandle!,
            }),
          );
        }

        // Continue polling as there are messages
        this.pollQueue();
      } else {
        // No messages, wait and poll again
        this.logger.log('Queue is empty, waiting before next poll...');
        setTimeout(() => this.pollQueue(), this.pollingInterval);
      }
    } catch (error) {
      this.logger.error('Error polling SQS queue:', error);
      // Optionally add a delay before retrying in case of error
      setTimeout(() => this.pollQueue(), this.pollingInterval);
    }
  }

  private async handleUserEvent(message: any) {
    try {
      const body = JSON.parse(message.Body!);

      // Check message body structure
      if (!body.user || !body.operation) {
        throw new Error('Invalid message structure');
      }

      const user = body.user;
      const operation = body.operation;

      // Example: Handle 'create' operation
      if (operation === 'create') {
        await this.dynamoDBClient.send(
          new PutItemCommand({
            TableName: this.tableName,
            Item: {
              id: { S: user.id },
              firstName: { S: user.firstName },
              lastName: { S: user.lastName },
              email: { S: user.email },
              dob: { S: user.dob },
              status: { S: user.status || 'created' },
            },
          }),
        );

        this.logger.log('User created in DynamoDB');
      } else {
        this.logger.warn(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      this.logger.error('Error handling SQS message:', error);
    }
  }
}
