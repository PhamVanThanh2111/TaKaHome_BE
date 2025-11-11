import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { S3StorageService } from '../s3-storage/s3-storage.service';
import { CccdRecognitionService } from './cccd-recognition.service';
import { CccdRecognitionResponseDto } from './dto/cccd-recognition.dto';
import { Account } from '../account/entities/account.entity';
import { FaceVerificationService } from './face-verification.service';
import { FaceVerificationResponseDto } from './dto/face-verification.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    private readonly s3StorageService: S3StorageService,
    private readonly cccdRecognitionService: CccdRecognitionService,
    private readonly faceVerificationService: FaceVerificationService,
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
          const oldKey = this.s3StorageService.extractKeyFromUrl(
            user.avatarUrl,
          );
          await this.s3StorageService.deleteAvatar(oldKey);
        } catch (error) {
          console.warn(
            'Failed to delete old avatar:',
            error instanceof Error ? error.message : 'Unknown error',
          );
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
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      console.error('Failed to upload avatar:', error);
      throw new BadRequestException(
        `Failed to upload avatar: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Recognize CCCD information from image
   */
  async recognizeCccd(
    imageBuffer: Buffer,
    originalFilename: string,
    userId: string,
  ): Promise<ResponseCommon<CccdRecognitionResponseDto>> {
    try {
      // Call CCCD recognition service
      const result = await this.cccdRecognitionService.recognizeCccd(
        imageBuffer,
        originalFilename,
      );
      if (userId) {
        const user = await this.userRepository.findOne({
          where: { id: userId },
          relations: ['account'],
        });
        if (!user) {
          throw new NotFoundException(`User with id ${userId} not found`);
        }

        user.CCCD = result.id;
        user.fullName = result.name; // Update full name from CCCD
        user.isVerified = true;

        if (user.account) {
          user.account.isVerified = true;
        }

        await this.userRepository.save(user);

        if (user.account) {
          user.account.isVerified = true;
          await this.accountRepository.save(user.account);
        }
      }
      return new ResponseCommon(
        200,
        'CCCD recognition completed successfully',
        result,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('Failed to recognize CCCD:', error);
      throw new BadRequestException(
        `Failed to recognize CCCD: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Verify face with CCCD - Combined flow
   * 1. Recognize CCCD information from CCCD image
   * 2. Verify face matching between face image and CCCD image
   * 3. Update user verification status if successful
   */
  async verifyFaceWithCccd(
    faceImageBuffer: Buffer,
    cccdImageBuffer: Buffer,
    faceImageFilename: string,
    cccdImageFilename: string,
    userId: string,
  ): Promise<ResponseCommon<FaceVerificationResponseDto>> {
    try {
      // Step 1: Recognize CCCD first
      console.log('Step 1: Recognizing CCCD information...');
      const cccdResult = await this.cccdRecognitionService.recognizeCccd(
        cccdImageBuffer,
        cccdImageFilename,
      );

      console.log('CCCD recognized successfully:', cccdResult);

      // Step 2: Verify face matching
      console.log('Step 2: Verifying face matching...');
      const faceVerificationResult =
        await this.faceVerificationService.verifyFace(
          faceImageBuffer,
          cccdImageBuffer,
          faceImageFilename,
          cccdImageFilename,
        );

      console.log('Face verification result:', faceVerificationResult);

      // Step 3: Check if faces match (similarity >= 80%)
      if (!faceVerificationResult.isMatch) {
        throw new BadRequestException(`Khuôn mặt không khớp với ảnh CCCD.`);
      }

      // Step 4: Update user information if userId is provided
      if (userId) {
        const user = await this.userRepository.findOne({
          where: { id: userId },
          relations: ['account'],
        });

        if (!user) {
          throw new NotFoundException(`User with id ${userId} not found`);
        }

        // Update user CCCD, full name, and verification status
        user.CCCD = cccdResult.id;
        user.fullName = cccdResult.name; // Update full name from CCCD
        user.isVerified = true;

        if (user.account) {
          user.account.isVerified = true;
        }

        await this.userRepository.save(user);

        if (user.account) {
          await this.accountRepository.save(user.account);
        }

        console.log(
          `User ${userId} verified successfully with CCCD ${cccdResult.id}, Name: ${cccdResult.name}`,
        );
      }

      // Return success response with verification result
      return new ResponseCommon(200, 'Xác thực gương mặt và CCCD thành công', {
        ...faceVerificationResult,
        cccdInfo: cccdResult,
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      console.error('Failed to verify face with CCCD:', error);
      throw new BadRequestException(
        `Failed to verify face with CCCD: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
