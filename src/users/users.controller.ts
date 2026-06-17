import {
  Controller,
  Get,
  Logger,
  Patch,
  Body,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Request } from 'express';

export interface RequestWithUser extends Request {
  user: { id: string; email: string; role: string };
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private usersService: UsersService) {}

  @Get('me')
  async getProfile(@Req() req: RequestWithUser) {
    this.logger.log(`GET /users/me — userId: ${req.user.id}`);
    try {
      const result = await this.usersService.findOne(req.user.id);
      this.logger.log(`Fetched profile — userId: ${req.user.id}`);
      return result;
    } catch (err) {
      this.logger.error(`Fetch profile failed — userId: ${req.user.id}: ${err.message}`);
      throw err;
    }
  }

  @Patch('me')
  async updateProfile(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateUserDto,
  ) {
    this.logger.log(`PATCH /users/me — userId: ${req.user.id}`);
    try {
      const result = await this.usersService.update(req.user.id, dto);
      this.logger.log(`Profile updated — userId: ${req.user.id}`);
      return result;
    } catch (err) {
      this.logger.error(`Update profile failed — userId: ${req.user.id}: ${err.message}`);
      throw err;
    }
  }
}