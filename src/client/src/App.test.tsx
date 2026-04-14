import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.stubGlobal(
  "fetch",
  vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    let payload: unknown = [];
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
        name: "Rent almost anything, fast.",
      })
    ).toBeInTheDocument();
  });
});
