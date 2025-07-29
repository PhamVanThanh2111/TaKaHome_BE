import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
  ) {}

  async create(createReviewDto: CreateReviewDto): Promise<Review> {
    const { propertyId, reviewerId, comment, rating } = createReviewDto;
    const review = this.reviewRepository.create({
      comment,
      rating,
      property: { id: propertyId },
      reviewer: { id: reviewerId },
    });
    return this.reviewRepository.save(review);
  }

  async findAll(): Promise<Review[]> {
    return this.reviewRepository.find({ relations: ['reviewer', 'property'] });
  }

  // findAllByPropertyId
  async findAllByPropertyId(propertyId: string): Promise<Review[]> {
    return this.reviewRepository.find({
      where: { property: { id: propertyId } },
      relations: ['reviewer'],
    });
  }

  async findOne(id: string): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id: id },
      relations: ['reviewer', 'property'],
    });
    if (!review) {
      throw new Error(`Review with id ${id} not found`);
    }
    return review;
  }

  async update(id: string, updateReviewDto: UpdateReviewDto): Promise<Review> {
    await this.reviewRepository.update(id, updateReviewDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.reviewRepository.delete(id);
  }
}
