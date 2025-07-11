import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { ChatRoom } from '../../chatroom/entities/chatroom.entity';

@Entity()
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ChatRoom, (room) => room.messages)
  chatroom: ChatRoom;

  @ManyToOne(() => User)
  sender: User;

  @Column('text')
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}
