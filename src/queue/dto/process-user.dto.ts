import { IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProcessUserDto {
  @ApiProperty({ description: 'ID of the user', example: '1234' })
  @IsString()
  readonly id: string;

  @ApiProperty({ description: 'First name of the user' })
  @IsString()
  readonly firstName: string;

  @ApiProperty({ description: 'Last name of the user' })
  @IsString()
  readonly lastName: string;

  @ApiProperty({
    description: 'Email of the user',
    example: 'user@example.com',
  })
  @IsString()
  readonly email: string;

  @ApiProperty({
    description: 'Date of birth of the user',
    example: '2000-01-01',
  })
  @IsDateString()
  readonly dob: string;

  @ApiProperty({
    description: 'Status of the user',
    example: 'created',
    enum: ['created', 'updated', 'blocked'],
  })
  @IsString()
  readonly status: string;
}
