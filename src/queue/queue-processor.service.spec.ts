import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { QueueProcessorService } from './queue-processor';

const mockUserDetails = {
  id: '1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  dob: '1990-01-01',
  status: 'active',
};
const mockBlockedUserDetails = {
  ...mockUserDetails,
  status: 'blocked',
};
const mockMessageCreate = {
  Body: JSON.stringify({
    operation: 'create',
    user: {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      dob: '1990-01-01',
    },
  }),
  ReceiptHandle: 'mockReceiptHandle',
};

const mockMessageUpdate = {
  Body: JSON.stringify({
    operation: 'update',
    user: {
      id: '1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      dob: '1990-01-01',
      status: 'active',
    },
  }),
  ReceiptHandle: 'mockReceiptHandle',
};

const mockMessageBlocked = {
  Body: JSON.stringify({
    operation: 'update',
    user: { id: '1' },
  }),
  ReceiptHandle: 'mockReceiptHandle',
};

describe('QueueProcessorService', () => {
  let queueProcessorService: QueueProcessorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QueueProcessorService],
    }).compile();

    queueProcessorService = module.get<QueueProcessorService>(
      QueueProcessorService,
    );
  });

  it('should be defined', () => {
    expect(queueProcessorService).toBeDefined();
  });

  describe('handleUserEvent', () => {
    it('should process user creation event', async () => {
      const logging1 = jest.spyOn(queueProcessorService['logger'], 'log');

      await queueProcessorService['handleUserEvent'](mockMessageCreate);

      expect(logging1).toHaveBeenCalledWith('User created in DynamoDB');
    });

    it('should process user update event', async () => {
      jest
        .spyOn(queueProcessorService, 'getUserDetailsById')
        .mockResolvedValueOnce({
          id: '1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          dob: '1990-01-01',
          status: 'active',
        });

      const logging1 = jest.spyOn(queueProcessorService['logger'], 'log');

      await queueProcessorService['handleUserEvent'](mockMessageUpdate);

      expect(logging1).toHaveBeenCalledWith('User updated in DynamoDB');
    });

    it('should log a warning if the user is blocked', async () => {
      jest
        .spyOn(queueProcessorService, 'getUserDetailsById')
        .mockResolvedValueOnce({
          id: '1',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          dob: '1990-01-01',
          status: 'blocked',
        });

      const logging = jest.spyOn(queueProcessorService['logger'], 'warn');

      await queueProcessorService['handleUserEvent'](mockMessageBlocked);

      expect(logging).toHaveBeenCalledWith(
        'Update operation aborted: User is blocked',
      );
    });

    it('should handle invalid message structure gracefully', async () => {
      const invalidMessage = { Body: null };

      const logging1 = jest.spyOn(queueProcessorService['logger'], 'error');
      await queueProcessorService['handleUserEvent'](invalidMessage);

      expect(logging1).toHaveBeenCalledWith(
        'Error handling SQS message:',
        expect.any(Error),
      );
    });

    it('should throw NotFoundException if user does not exist during update', async () => {
      jest
        .spyOn(queueProcessorService, 'getUserDetailsById')
        .mockResolvedValueOnce(null);

      await expect(
        queueProcessorService['handleUserEvent'](mockMessageUpdate),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserDetailsById', () => {
    it('should return user details if user exists', async () => {
      const mockUserDetails = {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        dob: '1990-01-01',
        status: 'active',
      };

      jest
        .spyOn(queueProcessorService, 'getUserDetailsById')
        .mockResolvedValueOnce(mockUserDetails);

      const userDetails = await queueProcessorService.getUserDetailsById('1');

      expect(userDetails).toEqual(mockUserDetails);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      jest
        .spyOn(queueProcessorService, 'getUserDetailsById')
        .mockResolvedValueOnce(null);

      await expect(
        queueProcessorService.getUserDetailsById('1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('blockUser', () => {
    it('should block a user successfully', async () => {
      jest
        .spyOn(queueProcessorService, 'getUserDetailsById')
        .mockResolvedValueOnce(mockBlockedUserDetails);

      const result = await queueProcessorService.blockUser('1');

      expect(result).toBe('User blocked');
    });

    it('should throw NotFoundException if user does not exist when trying to block', async () => {
      jest
        .spyOn(queueProcessorService, 'getUserDetailsById')
        .mockResolvedValueOnce(null);

      await expect(queueProcessorService.blockUser('1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if id is not provided', async () => {
      await expect(queueProcessorService.blockUser(null)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
