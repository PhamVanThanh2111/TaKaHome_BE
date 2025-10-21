import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { S3StorageService } from '../s3-storage/s3-storage.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private readonly s3StorageService: S3StorageService,
  ) {}

  async findAll(): Promise<ResponseCommon> {
    const users = await this.userRepository.find({ relations: ['account'] });
    return new ResponseCommon(200, 'SUCCESS', users);
  }

  async findOne(id: string): Promise<ResponseCommon> {
    const user = await this.userRepository.findOne({
      where: { id: id },
      relations: ['account'],
    });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', user);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<ResponseCommon> {
    const existingUser = await this.userRepository.findOne({ where: { id } });
    if (!existingUser) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    
    await this.userRepository.update(id, updateUserDto);
    const updatedUser = await this.findOne(id);
    return updatedUser;
  }

  async remove(id: string): Promise<ResponseCommon> {
    const existingUser = await this.userRepository.findOne({ where: { id } });
    if (!existingUser) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    
    await this.userRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS');
  }

  /**
   * Upload and update user avatar
   */
  async uploadAvatar(
    userId: string,
    avatarBuffer: Buffer,
    originalFilename: string,
    mimetype: string,
  ): Promise<ResponseCommon> {
    try {
      // Validate user exists
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException(`User with id ${userId} not found`);
      }

      // Delete old avatar if exists
      if (user.avatarUrl) {
        try {
          const oldKey = this.s3StorageService.extractKeyFromUrl(user.avatarUrl);
          await this.s3StorageService.deleteAvatar(oldKey);
        } catch (error) {
          console.warn('Failed to delete old avatar:', error instanceof Error ? error.message : 'Unknown error');
          // Continue with upload even if old avatar deletion fails
        }
      }

      // Upload new avatar to S3
      const uploadResult = await this.s3StorageService.uploadAvatar(
        avatarBuffer,
        userId,
        originalFilename,
        mimetype,
      );

      // Update user avatarUrl in database
      await this.userRepository.update(userId, {
        avatarUrl: uploadResult.url,
      });

      // Return updated user
      const updatedUser = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['account'],
      });

      return new ResponseCommon(200, 'Avatar uploaded successfully', {
        user: updatedUser,
        upload: {
          url: uploadResult.url,
          key: uploadResult.key,
          size: uploadResult.size,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      console.error('Failed to upload avatar:', error);
      throw new BadRequestException(
        `Failed to upload avatar: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
