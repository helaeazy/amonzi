import type { Listing, Member, Overview, Rental, Review } from "./types";

const API_BASE = "http://127.0.0.1:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  return response.json() as Promise<T>;
}

export const api = {
  getOverview: () => request<Overview>("/overview/"),
  getListings: () => request<Listing[]>("/listings/"),
  getMembers: () => request<Member[]>("/members/"),
  getRentals: () => request<Rental[]>("/rentals/"),
  getReviews: () => request<Review[]>("/reviews/"),
  createListing: (payload: {
    owner_id: number;
    title: string;
    description: string;
    category: string;
    city: string;
    price_per_day: string;
    deposit: string;
    image_url: string;
    status: string;
  }) =>
    request<Listing>("/listings/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createRental: (payload: {
    listing: number;
    renter: number;
    start_date: string;
    end_date: string;
    status: string;
    total_price: string;
  }) =>
    request<Rental>("/rentals/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createReview: (payload: {
    rental: number;
    author: number;
    rating: number;
    comment: string;
  }) =>
    request<Review>("/reviews/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
