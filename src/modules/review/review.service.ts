import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
  ) {}

  async create(
    createReviewDto: CreateReviewDto,
  ): Promise<ResponseCommon<Review>> {
    const { propertyId, reviewerId, comment, rating } = createReviewDto;
    const review = this.reviewRepository.create({
      comment,
      rating,
      property: { id: propertyId },
      reviewer: { id: reviewerId },
    });
    const saved = await this.reviewRepository.save(review);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async findAll(): Promise<ResponseCommon<Review[]>> {
    const reviews = await this.reviewRepository.find({
      relations: ['reviewer', 'property'],
    });
    return new ResponseCommon(200, 'SUCCESS', reviews);
  }

  // findAllByPropertyId
  async findAllByPropertyId(
    propertyId: string,
  ): Promise<ResponseCommon<Review[]>> {
    const reviews = await this.reviewRepository.find({
      where: { property: { id: propertyId } },
      relations: ['reviewer'],
    });
    return new ResponseCommon(200, 'SUCCESS', reviews);
  }

  async findOne(id: string): Promise<ResponseCommon<Review>> {
    const review = await this.reviewRepository.findOne({
      where: { id: id },
      relations: ['reviewer', 'property'],
    });
    if (!review) {
      throw new Error(`Review with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', review);
  }

  async update(
    id: string,
    updateReviewDto: UpdateReviewDto,
  ): Promise<ResponseCommon<Review>> {
    await this.reviewRepository.update(id, updateReviewDto);
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: ['reviewer', 'property'],
    });
    if (!review) {
      throw new Error(`Review with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', review);
  }

  async remove(id: string): Promise<ResponseCommon<null>> {
    await this.reviewRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
