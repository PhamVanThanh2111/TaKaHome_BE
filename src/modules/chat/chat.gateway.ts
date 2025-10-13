import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseFilters, UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../core/auth/guards/ws-jwt.guard';
import { ChatMessageService } from '../chatmessage/chatmessage.service';
import { ChatRoomService } from '../chatroom/chatroom.service';

// WebSocket Exception Filter
import { Catch, ArgumentsHost } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';

@Catch(WsException)
export class WebsocketExceptionsFilter extends BaseWsExceptionFilter {
  catch(exception: WsException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();
    const error = exception.getError();
    const details = error instanceof Object ? { ...error } : { message: error };
    
    client.emit('error', {
      id: client.id,
      rid: Math.random().toString(36).substring(2, 15),
      ...details,
    });
  }
}

// Interface for socket events
interface JoinRoomData {
  chatroomId: string;
}

interface SendMessageData {
  chatroomId: string;
  content: string;
}

interface TypingData {
  chatroomId: string;
  isTyping: boolean;
}

interface UserTypingInfo {
  userId: string;
  fullName: string;
  isTyping: boolean;
  timestamp: number;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
  namespace: '/chat',
})
@UseFilters(new WebsocketExceptionsFilter())
@UseGuards(WsJwtGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  
  // Store online users and typing states
  private onlineUsers = new Map<string, { socketId: string; user: any }>();
  private typingUsers = new Map<string, Map<string, UserTypingInfo>>(); // chatroomId -> userId -> typing info

  constructor(
    private chatMessageService: ChatMessageService,
    private chatRoomService: ChatRoomService,
  ) {}

  // Connection handlers
  async handleConnection(client: Socket) {
    try {
      const user = client.data.user;
      if (!user) {
        client.disconnect();
        return;
      }

      // Store online user
      this.onlineUsers.set(user.id, { 
        socketId: client.id, 
        user: { id: user.id, fullName: user.fullName, email: user.email }
      });

      this.logger.log(`User ${user.fullName} connected: ${client.id}`);
      
      // Notify all rooms about user coming online
      client.broadcast.emit('user-online', {
        userId: user.id,
        fullName: user.fullName,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error('Connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const user = client.data.user;
      if (!user) return;

      // Remove from online users
      this.onlineUsers.delete(user.id);

      // Clear typing state for this user
      for (const [chatroomId, typingInRoom] of this.typingUsers) {
        if (typingInRoom.has(user.id)) {
          typingInRoom.delete(user.id);
          
          // Notify room about user stopped typing
          client.to(chatroomId).emit('user-typing', {
            chatroomId,
            users: Array.from(typingInRoom.values()),
          });
        }
      }

      this.logger.log(`User ${user.fullName} disconnected: ${client.id}`);
      
      // Notify all rooms about user going offline
      client.broadcast.emit('user-offline', {
        userId: user.id,
        fullName: user.fullName,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error('Disconnect error:', error);
    }
  }

  // Chat room events
  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @MessageBody() data: JoinRoomData,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { chatroomId } = data;
      const user = client.data.user;

      // Validate if user has access to this room
      const chatRoom = await this.chatRoomService.findOne(parseInt(chatroomId));
      const room = chatRoom.data;

      if (!room) {
        throw new WsException('Chat room not found');
      }

      // Check if user is participant in this room
      const isParticipant = room.user1.id === user.id || room.user2.id === user.id;
      if (!isParticipant) {
        throw new WsException('Access denied to this chat room');
      }

      // Join the socket room
      await client.join(chatroomId);
      
      this.logger.log(`User ${user.fullName} joined room: ${chatroomId}`);

      // Notify room about user joining
      client.to(chatroomId).emit('user-joined-room', {
        chatroomId,
        userId: user.id,
        fullName: user.fullName,
        timestamp: new Date().toISOString(),
      });

      // Send confirmation to client
      client.emit('joined-room', {
        chatroomId,
        message: 'Successfully joined chat room',
      });

    } catch (error) {
      this.logger.error('Join room error:', error);
      throw new WsException(error.message || 'Failed to join room');
    }
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @MessageBody() data: JoinRoomData,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { chatroomId } = data;
      const user = client.data.user;

      await client.leave(chatroomId);
      
      // Clear typing state
      this.clearUserTyping(chatroomId, user.id);

      this.logger.log(`User ${user.fullName} left room: ${chatroomId}`);

      // Notify room about user leaving
      client.to(chatroomId).emit('user-left-room', {
        chatroomId,
        userId: user.id,
        fullName: user.fullName,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      this.logger.error('Leave room error:', error);
      throw new WsException('Failed to leave room');
    }
  }

  // Message events
  @SubscribeMessage('send-message')
  async handleMessage(
    @MessageBody() data: SendMessageData,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { chatroomId, content } = data;
      const user = client.data.user;

      // Save message to database
      const messageResponse = await this.chatMessageService.create({
        chatroomId,
        senderId: user.id,
        content,
      });

      const savedMessage = messageResponse.data;

      if (!savedMessage) {
        throw new WsException('Failed to save message');
      }

      // Clear typing state for this user
      this.clearUserTyping(chatroomId, user.id);

      // Broadcast message to room participants
      this.server.to(chatroomId).emit('new-message', {
        id: savedMessage.id,
        chatroomId,
        content,
        sender: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
        },
        createdAt: savedMessage.createdAt,
      });

      this.logger.log(`Message sent in room ${chatroomId} by ${user.fullName}`);

    } catch (error) {
      this.logger.error('Send message error:', error);
      throw new WsException('Failed to send message');
    }
  }

  // Typing indicators
  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: TypingData,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { chatroomId, isTyping } = data;
      const user = client.data.user;

      // Initialize typing map for room if not exists
      if (!this.typingUsers.has(chatroomId)) {
        this.typingUsers.set(chatroomId, new Map());
      }

      const typingInRoom = this.typingUsers.get(chatroomId)!;

      if (isTyping) {
        // Add user to typing list
        typingInRoom.set(user.id, {
          userId: user.id,
          fullName: user.fullName,
          isTyping: true,
          timestamp: Date.now(),
        });

        // Auto-clear typing after 3 seconds of inactivity
        setTimeout(() => {
          this.clearUserTyping(chatroomId, user.id);
        }, 3000);
      } else {
        // Remove user from typing list
        typingInRoom.delete(user.id);
      }

      // Broadcast typing state to room (except sender)
      client.to(chatroomId).emit('user-typing', {
        chatroomId,
        users: Array.from(typingInRoom.values()),
      });

    } catch (error) {
      this.logger.error('Typing indicator error:', error);
    }
  }

  // Get online users
  @SubscribeMessage('get-online-users')
  handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    const onlineUsersList = Array.from(this.onlineUsers.values()).map(item => item.user);
    client.emit('online-users', onlineUsersList);
  }

  // Utility methods
  private clearUserTyping(chatroomId: string, userId: string) {
    const typingInRoom = this.typingUsers.get(chatroomId);
    if (typingInRoom && typingInRoom.has(userId)) {
      typingInRoom.delete(userId);
      
      // Broadcast updated typing state
      this.server.to(chatroomId).emit('user-typing', {
        chatroomId,
        users: Array.from(typingInRoom.values()),
      });
    }
  }

  // Public method to emit messages from external services
  public emitMessageToRoom(chatroomId: string, messageData: any) {
    this.server.to(chatroomId).emit('new-message', messageData);
  }

  // Public method to get online status
  public isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  // Public method to get online users list
  public getOnlineUsers(): any[] {
    return Array.from(this.onlineUsers.values()).map(item => item.user);
  }
}