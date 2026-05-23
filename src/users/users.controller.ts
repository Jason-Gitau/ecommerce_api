import { 
  Controller, 
  Get, 
  Patch, 
  Body, 
  Req 
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Request } from 'express';

// 👇 Updated Interface: userId is now string (UUID)
export interface RequestWithUser extends Request {
  user: { id: string; email: string; role: string };
}

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getProfile(@Req() req: RequestWithUser) {
    // req.user.id is now a string, which matches the Service signature
    return this.usersService.findOne(req.user.id);
  }
  
  @Patch('me')
  updateProfile(
    @Req() req: RequestWithUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(req.user.id, dto);
  }
}