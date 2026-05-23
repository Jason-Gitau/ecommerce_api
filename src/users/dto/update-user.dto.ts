import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

// Makes all fields optional for PATCH requests
export class UpdateUserDto extends PartialType(CreateUserDto) {}