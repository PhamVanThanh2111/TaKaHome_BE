import { Property } from '../entities/property.entity';
import { RoomTypeEntry } from './room-type-entry.interface';

export interface PropertyWithUrl extends Property {
  url: string;
}

export interface RoomTypeEntryWithUrl extends RoomTypeEntry {
  url: string;
}

export type PropertyOrRoomTypeWithUrl = PropertyWithUrl | RoomTypeEntryWithUrl;
