export type Member = {
  id: number;
  full_name: string;
  email: string;
  city: string;
  bio: string;
  avatar_url: string;
  response_time: string;
  wallet_balance: string;
  joined_at: string;
  score: string;
  review_count: number;
  listing_count: number;
};

export type Listing = {
  id: number;
  title: string;
  description: string;
  category: string;
  city: string;
  price_per_day: string;
  deposit: string;
  image_url: string;
  photo_urls: string[];
  status: string;
  views_count: number;
  clicks_count: number;
  shares_count: number;
  created_at: string;
  owner: Member;
  rating: string;
  review_count: number;
};

export type Rental = {
  id: number;
  listing: number;
  listing_title: string;
  renter: number;
  renter_name: string;
  start_date: string;
  end_date: string;
  status: string;
  total_price: string;
  created_at: string;
};

export type Review = {
  id: number;
  rental: number;
  listing: number;
  author: number;
  author_name: string;
  reviewed_member: number;
  reviewed_member_name: string;
  rating: number;
  comment: string;
  created_at: string;
};

export type Overview = {
  featured_listings: Listing[];
  top_members: Member[];
  recent_reviews: Review[];
  stats: {
    members: number;
    live_listings: number;
    completed_rentals: number;
    reviews: number;
  };
};
