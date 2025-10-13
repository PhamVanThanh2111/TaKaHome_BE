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
    province: string;
    ward: string;
    address: string;
    landlord?: { id: string; name?: string };
  };
}
