import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import {
  DynamoDBClient,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { ProcessUserDto } from './dto/process-user.dto';

@Injectable()
export class QueueProcessorService implements OnModuleInit {
  private readonly sqsClient: SQSClient;
  private readonly dynamoDBClient: DynamoDBClient;
  private readonly queueUrl: string;
  private readonly tableName = 'Users';
  private readonly logger = new Logger(QueueProcessorService.name);

  constructor() {
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION,
      endpoint: process.env.SQS_ENDPOINT,
    });

    this.dynamoDBClient = new DynamoDBClient({
      region: process.env.AWS_REGION,
      endpoint: process.env.DYNAMODB_ENDPOINT,
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
      if (response.Messages) {
        for (const message of response.Messages) {
          await this.handleUserEvent(message);
        }
      }

      this.pollQueue(); // Poll again
    } catch (error) {
      this.logger.error('Error polling SQS queue:', error);
    }
  }

  private async handleUserEvent(message: any) {
    const { operation, user } = JSON.parse(message.Body);
    const processUserDto: ProcessUserDto = user;

    try {
      if (operation === 'create') {
        await this.dynamoDBClient.send(
          new PutItemCommand({
            TableName: this.tableName,
            Item: {
              id: { S: processUserDto.id },
              firstName: { S: processUserDto.firstName },
              lastName: { S: processUserDto.lastName },
              email: { S: processUserDto.email },
              dob: { S: processUserDto.dob },
              status: { S: processUserDto.status },
              createdAt: { S: new Date().toISOString() },
              updatedAt: { S: new Date().toISOString() },
            },
          }),
        );
        this.logger.log('User created in DynamoDB');
      } else if (operation === 'update') {
        await this.dynamoDBClient.send(
          new UpdateItemCommand({
            TableName: this.tableName,
            Key: { id: { S: processUserDto.id } },
            UpdateExpression:
              'SET firstName = :firstName, lastName = :lastName, email = :email, dob = :dob, status = :status, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':firstName': { S: processUserDto.firstName },
              ':lastName': { S: processUserDto.lastName },
              ':email': { S: processUserDto.email },
              ':dob': { S: processUserDto.dob },
              ':status': { S: processUserDto.status },
              ':updatedAt': { S: new Date().toISOString() },
            },
          }),
        );
        this.logger.log('User updated in DynamoDB');
      } else {
        this.logger.error('Unknown operation:', operation);
      }

      // Delete message from queue after processing
      await this.sqsClient.send(
        new DeleteMessageCommand({
          QueueUrl: this.queueUrl,
          ReceiptHandle: message.ReceiptHandle,
        }),
      );

      this.logger.log('Message deleted from SQS');
    } catch (error) {
      this.logger.error('Error handling SQS message:', error);
    }
  }
}
