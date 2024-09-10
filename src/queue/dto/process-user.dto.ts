import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsDateString, IsNotEmpty } from 'class-validator';

// DTO for processing user messages from the queue
export class ProcessUserDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  id: string;
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsDateString()
  dob: string;
  status: never;
}
