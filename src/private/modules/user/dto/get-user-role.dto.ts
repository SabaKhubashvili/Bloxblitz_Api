import { IsString, MaxLength } from "class-validator";

export class getUserRoleDto{
    @IsString()
    @MaxLength(32)
    username:string;
}