import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';

@Injectable()
export class DynamoDBService {
  private dynamoDB: AWS.DynamoDB.DocumentClient;

  constructor() {
    this.dynamoDB = new AWS.DynamoDB.DocumentClient({
      region: 'us-east-1',
    });
  }

  getInstance() {
    return this.dynamoDB;
  }
}
