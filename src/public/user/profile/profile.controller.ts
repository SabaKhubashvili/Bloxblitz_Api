import { Body, Controller, Get, Param, Post, Request, UseGuards } from "@nestjs/common";
import { type AuthenticatedRequest, JwtAuthGuard } from "src/middleware/jwt.middleware";
import { ProfileService } from "./profile.service";
import { response } from "express";
import { SetPrivateProfileDto } from "./dto/set-private-profile.dto";
import { UsernameParamDto } from "./dto/get-public-profile.dto";

@Controller('/user/profile')
export class ProfileController {
    constructor(private readonly profileService: ProfileService) {}
    @Get('/get')
    @UseGuards(JwtAuthGuard)
    async getProfile(@Request() req: AuthenticatedRequest) {
        const response =  await this.profileService.getProfile(req.user.username); 

        return response
    }
    @Get('/get-public/:username')
    async getPublicProfile(@Request() req: AuthenticatedRequest, @Param() dto: UsernameParamDto) {
        return await this.profileService.getUserProfileWithRank(dto.username);
    }
    @Post('/set-private')
    @UseGuards(JwtAuthGuard)
    async setPrivateProfile(@Request() req: AuthenticatedRequest, @Body() body: SetPrivateProfileDto) {
        return await this.profileService.setPrivateProfile(req.user.username, body.privateProfile);
    }
}