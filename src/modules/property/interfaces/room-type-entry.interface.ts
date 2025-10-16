export interface RoomTypeEntry {
  id: string;
  name: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  price: number;
  deposit: number;
  furnishing: string;
  images: string[];
  description?: string;
  heroImage?: string;
  rooms: Array<{
    id: string;
    name: string;
    floor: number;
    isVisible?: boolean;
  }>;
  property: {
    id: string;
    title: string;
    description?: string;
    province: string;
    ward: string;
    address: string;
    isApproved?: boolean;
    createdAt?: Date;
    landlord?: {
      id: string;
      name?: string;
      email?: string;
      phone?: string;
      isVerified?: boolean;
      avatarUrl?: string;
      status?: string;
      CCCD?: string;
      createdAt?: Date;
      updatedAt?: Date;
    };
  };
}
