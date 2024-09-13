import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import {
  DynamoDBClient,
  GetItemCommand,
  GetItemCommandInput,
  PutItemCommand,
  QueryCommand,
  QueryCommandInput,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';

@Injectable()
export class QueueProcessorService implements OnModuleInit {
  private readonly sqsClient: SQSClient;
  private readonly dynamoDBClient: DynamoDBClient;
  private readonly queueUrl: string;
  private readonly tableName: string;
  private readonly logger = new Logger(QueueProcessorService.name);
  private readonly pollingInterval = 10000; // 30 seconds
  IndexName: string;

  constructor() {
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION,
    });

    this.dynamoDBClient = new DynamoDBClient({
      region: process.env.AWS_REGION,
    });

    this.queueUrl = process.env.SQS_QUEUE_URL;
    this.tableName = process.env.TABLE_NAME;
    this.IndexName = process.env.INDEX_NAME;
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
      } else if (operation === 'update') {
        const { id, ...updateAttributes } = user;
        const userStatus = await this.getgetUserDetailsById(id);
        if (userStatus.status === 'blocked') {
          this.logger.warn('Update operation aborted: User is blocked');
          return;
        }
        if (!id) {
          throw new BadRequestException('ID must be provided.');
        }

        // Check if user exists
        const queryCommandInput: QueryCommandInput = {
          TableName: this.tableName,
          KeyConditionExpression: 'id = :id',
          ExpressionAttributeValues: {
            ':id': { S: id },
          },
        };

        const queryCommand = new QueryCommand(queryCommandInput);
        const queryResponse = await this.dynamoDBClient.send(queryCommand);

        if (queryResponse.Items && queryResponse.Items.length > 0) {
          const updateExpression = `SET ${Object.keys(updateAttributes)
            .map((key) => `#${key} = :${key}`)
            .join(', ')}`;
          const expressionAttributeNames = Object.keys(updateAttributes).reduce(
            (acc, key) => {
              acc[`#${key}`] = key;
              return acc;
            },
            {} as Record<string, string>,
          );
          const expressionAttributeValues = Object.keys(
            updateAttributes,
          ).reduce(
            (acc, key) => {
              acc[`:${key}`] = { S: updateAttributes[key] };
              return acc;
            },
            {} as Record<string, any>,
          );
          await this.dynamoDBClient.send(
            new UpdateItemCommand({
              TableName: this.tableName,
              Key: { id: { S: id } },
              UpdateExpression: updateExpression,
              ExpressionAttributeNames: expressionAttributeNames,
              ExpressionAttributeValues: expressionAttributeValues,
            }),
          );
          this.logger.log('User updated in DynamoDB');
        }
      } else if (operation === 'block') {
        await this.dynamoDBClient.send(
          new UpdateItemCommand({
            TableName: this.tableName,
            Key: { id: { S: user.id } },
            UpdateExpression: 'SET #status = :status',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':status': { S: 'blocked' } },
          }),
        );
        this.logger.log('User blocked in DynamoDB');
      } else {
        this.logger.warn(`User with ${user.id} does not exist`);
      }
    } catch (error) {
      this.logger.error('Error handling SQS message:', error);
    }
  }

  async checkUserStatus(checkUserStatusDto: { email: string; dob: string }) {
    const { email, dob } = checkUserStatusDto;

    if (!email || !dob) {
      throw new BadRequestException(
        'Both email and date of birth must be provided.',
      );
    }

    try {
      const commandInput = {
        TableName: this.tableName,
        IndexName: this.IndexName,
        KeyConditionExpression: 'email = :email AND dob = :dob',
        ExpressionAttributeValues: {
          ':email': { S: email },
          ':dob': { S: dob },
        },
      };
      const command = new QueryCommand(commandInput);
      const response = await this.dynamoDBClient.send(command);

      if (response.Items && response.Items.length > 0) {
        const user = response.Items[0];
        const id = user.id.S;
        const status = user.status.S;
        return { id, status };
      } else {
        throw new BadRequestException('User not found');
      }
    } catch (error) {
      this.logger.error('Error checking user status:', error);
      throw new BadRequestException('Failed to check user status');
    }
  }

  async getgetUserDetailsById(userId: string) {
    try {
      const commandInput: GetItemCommandInput = {
        TableName: this.tableName,
        Key: { email: { S: userId } },
      };
      const command = new GetItemCommand(commandInput);
      const response = await this.dynamoDBClient.send(command);

      if (!response.Item) {
        throw new NotFoundException(`User with the ${userId} is not found`);
      }
      const item = response.Item;
      const user = {
        id: item.id?.S,
        firstName: item.firstName?.S,
        lastName: item.lastName?.S,
        email: item.email?.S,
        dob: item.dob?.S,
        status: item.status?.S,
      };
      return user;
    } catch (error) {
      throw error;
    }
  }

  async blockUser(id: string) {
    await this.dynamoDBClient.send(
      new UpdateItemCommand({
        TableName: this.tableName,
        Key: { id: { S: id } },
        UpdateExpression: 'SET #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': { S: 'blocked' } },
      }),
    );
    this.logger.log('User blocked in DynamoDB');
  }
}
