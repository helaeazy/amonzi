import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./firebase", () => ({
  isAuthDisabled: () => false,
  isFirebaseConfigured: () => true,
  signInWithGoogle: vi.fn(),
  signOutFromGoogle: vi.fn(),
  subscribeToAuth: (callback: (user: { displayName: string; email: string } | null) => void) => {
    callback(null);
    return () => undefined;
  },
}));

vi.stubGlobal(
  "fetch",
  vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    let payload: unknown = [];
    if (url.includes("/members/?email=")) {
      payload = [
        {
          id: 1,
          full_name: "Test User",
          email: "test@example.com",
          city: "",
          bio: "",
          avatar_url: "",
          response_time: "within 1 hour",
          joined_at: "2026-04-14",
          score: "5.0",
          review_count: 0,
          listing_count: 0,
        },
      ];
    }
    if (url.endsWith("/members/")) {
      payload = [];
    }
    if (url.endsWith("/overview/")) {
      payload = {
        featured_listings: [],
        top_members: [],
        recent_reviews: [],
        stats: {
          members: 0,
          live_listings: 0,
          completed_rentals: 0,
          reviews: 0,
        },
      };
    }
    if (url.endsWith("/listings/") || url.endsWith("/rentals/") || url.endsWith("/reviews/")) {
      payload = [];
    }
    return Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  })
);

describe("App", () => {
  it("renders the product heading", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(
      await screen.findByRole("heading", {
        name: "Noma bez haosa, čatiem un liekiem soļiem.",
      })
    ).toBeInTheDocument();
  });
});
