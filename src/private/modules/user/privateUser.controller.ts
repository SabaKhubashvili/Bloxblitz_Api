import { Body, Get } from '@nestjs/common';
import { InternalController } from '../games/decorator/InternalController.decorator';
import { PrivateUserService } from './privateUser.service';
import { getUserRoleDto } from './dto/get-user-role.dto';

@InternalController('user')
export class PrivateUserController {
  constructor(private readonly privateUserService: PrivateUserService) {}

  @Get('role/get')
  getUserInfo(@Body() dto: getUserRoleDto) {
    return this.privateUserService.getUserRole(dto.username);
  }
  @Get('info')
  getUserInfoByUsername(@Body() dto: getUserRoleDto) {
    return this.privateUserService.getUserInfoByUsername(dto.username);
  }
  @Get('last-login-ip')
  getUserLastLoginIp(@Body() dto: getUserRoleDto) {
    return this.privateUserService.getUserLastLoginIp(dto.username);
  }
  
}
