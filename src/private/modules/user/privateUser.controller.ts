import { Body, Get, Post } from '@nestjs/common';
import { InternalController } from '../games/decorator/InternalController.decorator';
import { PrivateUserService } from './privateUser.service';
import { getUserRoleDto } from './dto/get-user-role.dto';
import { AddUserXpDto } from './dto/add-user-xp.dto';
import { getUserXpInfoDto } from './dto/get-user-xp-info';

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
  @Post('/xp/add')
  addUserXp(@Body() dto: AddUserXpDto) {
    return this.privateUserService.addUserXp(dto.username, dto.betAmount, dto.gameType, dto.referenceId);
  }
  @Get('/xp')
  getUserXp(@Body() dto: getUserXpInfoDto) {
    return this.privateUserService.getUserXp(dto.username);
  }
}
