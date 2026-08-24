export type UsernamePriority = 'high' | 'mid' | 'low' | 'none';

export interface Username {
  id?: string;
  username: string;
  price: string;
  description: string;
  category: string;
  isNew: boolean;
  isHot: boolean;
  isSold: boolean;
  priority: UsernamePriority;
  isBest4?: boolean;
  public?: boolean;
  createdAt?: number;
  updatedAt?: number;
}
