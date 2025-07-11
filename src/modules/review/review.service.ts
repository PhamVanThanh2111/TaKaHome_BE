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

  async findOne(id: number): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: ['reviewer', 'property'],
    });
    if (!review) {
      throw new Error(`Review with id ${id} not found`);
    }
    return review;
  }

  async update(id: number, updateReviewDto: UpdateReviewDto): Promise<Review> {
    await this.reviewRepository.update(id, updateReviewDto as any);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.reviewRepository.delete(id);
  }
}
