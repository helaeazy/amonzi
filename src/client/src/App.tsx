import { FormEvent, useDeferredValue, useEffect, useState, useTransition } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, Route, Routes } from "react-router-dom";
import type { User } from "firebase/auth";
import { api } from "./api";
import {
  isFirebaseConfigured,
  signInWithGoogle,
  signOutFromGoogle,
  subscribeToAuth,
} from "./firebase";
import type { Listing, Member, Rental } from "./types";

const categories = [
  "all",
  "tools",
  "vehicles",
  "electronics",
  "events",
  "home",
  "outdoor",
  "other",
];

const initialListingForm = {
  title: "",
  description: "",
  category: "tools",
  city: "Riga",
  price_per_day: "20",
  deposit: "50",
  image_url: "",
};

const initialRentalForm = {
  listing: "",
  start_date: "2026-04-20",
  end_date: "2026-04-21",
};

const initialReviewForm = {
  rental: "",
  rating: "5",
  comment: "",
};

function App() {
  const queryClient = useQueryClient();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [listingForm, setListingForm] = useState(initialListingForm);
  const [rentalForm, setRentalForm] = useState(initialRentalForm);
  const [reviewForm, setReviewForm] = useState(initialReviewForm);
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    return subscribeToAuth((user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
  }, []);

  const memberSyncQuery = useQuery({
    queryKey: ["member-sync", authUser?.email],
    enabled: Boolean(authUser?.email),
    queryFn: async () => {
      const email = authUser?.email;
      if (!email) {
        throw new Error("Missing Google account email.");
      }
      const existing = await api.getMembers(email);
      if (existing.length > 0) {
        return existing[0];
      }
      return api.createMember({
        full_name: authUser?.displayName || email.split("@")[0],
        email,
        avatar_url: authUser?.photoURL || "",
        city: "",
        bio: "",
        response_time: "within 1 hour",
      });
    },
  });

  const overviewQuery = useQuery({
    queryKey: ["overview"],
    queryFn: api.getOverview,
    enabled: Boolean(memberSyncQuery.data),
  });
  const listingsQuery = useQuery({
    queryKey: ["listings"],
    queryFn: api.getListings,
    enabled: Boolean(memberSyncQuery.data),
  });
  const membersQuery = useQuery({
    queryKey: ["members"],
    queryFn: () => api.getMembers(),
    enabled: Boolean(memberSyncQuery.data),
  });
  const rentalsQuery = useQuery({
    queryKey: ["rentals"],
    queryFn: api.getRentals,
    enabled: Boolean(memberSyncQuery.data),
  });
  const reviewsQuery = useQuery({
    queryKey: ["reviews"],
    queryFn: api.getReviews,
    enabled: Boolean(memberSyncQuery.data),
  });

  const listingMutation = useMutation({
    mutationFn: api.createListing,
    onSuccess: async () => {
      setNotice("Listing published.");
      setListingForm(initialListingForm);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["listings"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
        queryClient.invalidateQueries({ queryKey: ["members"] }),
      ]);
    },
  });

  const rentalMutation = useMutation({
    mutationFn: api.createRental,
    onSuccess: async () => {
      setNotice("Rental request sent.");
      setRentalForm(initialRentalForm);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rentals"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
      ]);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: api.createReview,
    onSuccess: async () => {
      setNotice("Review posted.");
      setReviewForm(initialReviewForm);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
        queryClient.invalidateQueries({ queryKey: ["listings"] }),
        queryClient.invalidateQueries({ queryKey: ["members"] }),
        queryClient.invalidateQueries({ queryKey: ["rentals"] }),
      ]);
    },
  });

  const activeMember = memberSyncQuery.data ?? null;
  const resolvedActiveMemberId = activeMember?.id ?? null;
  const listings = listingsQuery.data ?? [];
  const rentals = rentalsQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];
  const overview = overviewQuery.data;

  const filteredListings = listings.filter((listing) => {
    const matchesCategory =
      selectedCategory === "all" || listing.category === selectedCategory;
    const query = deferredSearch.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      listing.title.toLowerCase().includes(query) ||
      listing.city.toLowerCase().includes(query) ||
      listing.owner.full_name.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  const reviewableRentals = rentals.filter(
    (rental) =>
      rental.status === "completed" &&
      rental.renter === resolvedActiveMemberId &&
      !reviews.some((review) => review.rental === rental.id)
  );

  const handleListingSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resolvedActiveMemberId) {
      return;
    }
    listingMutation.mutate({
      owner_id: resolvedActiveMemberId,
      title: listingForm.title,
      description: listingForm.description,
      category: listingForm.category,
      city: listingForm.city,
      price_per_day: listingForm.price_per_day,
      deposit: listingForm.deposit,
      image_url: listingForm.image_url,
      status: "live",
    });
  };

  const handleRentalSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resolvedActiveMemberId || !rentalForm.listing) {
      return;
    }
    const selectedListing = listings.find(
      (listing) => listing.id === Number(rentalForm.listing)
    );
    const totalPrice = selectedListing ? selectedListing.price_per_day : "0";
    rentalMutation.mutate({
      listing: Number(rentalForm.listing),
      renter: resolvedActiveMemberId,
      start_date: rentalForm.start_date,
      end_date: rentalForm.end_date,
      status: "requested",
      total_price: totalPrice,
    });
  };

  const handleReviewSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resolvedActiveMemberId || !reviewForm.rental) {
      return;
    }
    reviewMutation.mutate({
      rental: Number(reviewForm.rental),
      author: resolvedActiveMemberId,
      rating: Number(reviewForm.rating),
      comment: reviewForm.comment,
    });
  };

  if (!isFirebaseConfigured()) {
    return (
      <AuthScreen
        message="Add Firebase web config in Vite env vars to enable Google sign-in."
        ready
      />
    );
  }

  if (!authReady) {
    return <AuthScreen message="Checking Google sign-in..." ready={false} />;
  }

  if (!authUser) {
    return (
      <AuthScreen
        message="Sign in with your Google account to use Amonzi."
        onAction={() => void signInWithGoogle()}
        actionLabel="Continue with Google"
        ready
      />
    );
  }

  if (memberSyncQuery.isLoading) {
    return <AuthScreen message="Preparing your Amonzi profile..." ready={false} />;
  }

  if (memberSyncQuery.error || !activeMember) {
    return (
      <AuthScreen
        message="We could not create or load your member profile."
        onAction={() => void signOutFromGoogle()}
        actionLabel="Sign out"
        ready
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand-mark">Amonzi</p>
          <p className="hero-brand">Amonzi</p>
          <h1>Rent almost anything, fast.</h1>
        </div>
        <div className="acting-card">
          <span>Signed in with Google</span>
          <strong>{authUser.displayName || authUser.email}</strong>
          <small>{authUser.email}</small>
          <button
            className="secondary-button"
            onClick={() => void signOutFromGoogle()}
            type="button"
          >
            Sign out
          </button>
        </div>
      </header>

      <nav className="tabbar">
        <NavLink to="/">Explore</NavLink>
        <NavLink to="/post">Post</NavLink>
        <NavLink to="/trips">Trips</NavLink>
        <NavLink to="/profile">Profile</NavLink>
      </nav>

      {notice ? <div className="notice">{notice}</div> : null}

      <Routes>
        <Route
          path="/"
          element={
            <ExploreScreen
              activeMember={activeMember}
              filteredListings={filteredListings}
              onCategoryChange={(category) =>
                startTransition(() => setSelectedCategory(category))
              }
              onSearchChange={(value) => setSearch(value)}
              overview={overview}
              search={search}
              selectedCategory={selectedCategory}
            />
          }
        />
        <Route
          path="/post"
          element={
            <PostScreen
              form={listingForm}
              isBusy={listingMutation.isPending}
              onChange={setListingForm}
              onSubmit={handleListingSubmit}
            />
          }
        />
        <Route
          path="/trips"
          element={
            <TripsScreen
              activeMemberId={resolvedActiveMemberId}
              listings={listings}
              rentalForm={rentalForm}
              rentals={rentals}
              reviewForm={reviewForm}
              reviewableRentals={reviewableRentals}
              onRentalChange={setRentalForm}
              onRentalSubmit={handleRentalSubmit}
              onReviewChange={setReviewForm}
              onReviewSubmit={handleReviewSubmit}
              rentalBusy={rentalMutation.isPending}
              reviewBusy={reviewMutation.isPending}
            />
          }
        />
        <Route
          path="/profile"
          element={
            <ProfileScreen
              activeMember={activeMember}
              listings={listings}
              rentals={rentals}
            />
          }
        />
      </Routes>

      {overviewQuery.isLoading || listingsQuery.isLoading || membersQuery.isLoading ? (
        <div className="loading-sheet">Loading Amonzi…</div>
      ) : null}
      {overviewQuery.error || listingsQuery.error || membersQuery.error ? (
        <div className="error-sheet">Backend is not reachable. Start `make server`.</div>
      ) : null}
      {isPending ? <div className="ghost-chip">Updating filters…</div> : null}
    </div>
  );
}

function AuthScreen(props: {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  ready: boolean;
}) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="brand-mark">Amonzi</p>
        <p className="hero-brand">Amonzi</p>
        <h1>Google sign-in only.</h1>
        <p className="lead">{props.message}</p>
        {props.onAction && props.actionLabel ? (
          <button className="primary-button" onClick={props.onAction} type="button">
            {props.actionLabel}
          </button>
        ) : null}
        {!props.ready ? <div className="ghost-chip">Please wait…</div> : null}
      </section>
    </main>
  );
}

function ExploreScreen(props: {
  activeMember: Member | null;
  filteredListings: Listing[];
  onCategoryChange: (category: string) => void;
  onSearchChange: (value: string) => void;
  overview: Awaited<ReturnType<typeof api.getOverview>> | undefined;
  search: string;
  selectedCategory: string;
}) {
  return (
    <main className="screen">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Simple rental marketplace</p>
          <h2>List it today. Rent it tomorrow. Review after.</h2>
          <p className="lead">
            Amonzi stays basic on purpose: listings, short rental requests,
            trusted scores, and easy reviews.
          </p>
        </div>
        <div className="stats-grid">
          <StatCard label="Members" value={props.overview?.stats.members ?? 0} />
          <StatCard
            label="Live listings"
            value={props.overview?.stats.live_listings ?? 0}
          />
          <StatCard
            label="Completed rentals"
            value={props.overview?.stats.completed_rentals ?? 0}
          />
          <StatCard label="Reviews" value={props.overview?.stats.reviews ?? 0} />
        </div>
      </section>

      <section className="surface">
        <div className="section-head">
          <h3>Find a rental</h3>
          <p>{props.activeMember ? `Browsing as ${props.activeMember.full_name}` : ""}</p>
        </div>
        <div className="filter-row">
          <input
            value={props.search}
            onChange={(event) => props.onSearchChange(event.target.value)}
            placeholder="Search listing, city, or owner"
          />
          <div className="chip-row">
            {categories.map((category) => (
              <button
                key={category}
                className={category === props.selectedCategory ? "chip active" : "chip"}
                onClick={() => props.onCategoryChange(category)}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        <div className="listing-grid">
          {props.filteredListings.map((listing) => (
            <article className="listing-card" key={listing.id}>
              <div
                className="listing-image"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.22)), url(${listing.image_url})`,
                }}
              />
              <div className="listing-body">
                <div className="listing-top">
                  <span className="tag">{listing.category}</span>
                  <span className="tag muted">{listing.city}</span>
                </div>
                <h4>{listing.title}</h4>
                <p>{listing.description}</p>
                <div className="meta-row">
                  <strong>EUR {listing.price_per_day}/day</strong>
                  <span>Deposit EUR {listing.deposit}</span>
                </div>
                <div className="owner-row">
                  <span>{listing.owner.full_name}</span>
                  <span className="rating-line">
                    <StarRating score={listing.owner.score} />
                    {listing.owner.review_count} reviews
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="surface">
        <div className="section-head">
          <h3>Trusted owners</h3>
          <p>Good scores come from finished rentals and public reviews.</p>
        </div>
        <div className="member-grid">
          {props.overview?.top_members.map((member) => (
            <article className="member-card" key={member.id}>
              <div className="avatar-ring">
                <img alt={member.full_name} src={member.avatar_url} />
              </div>
              <h4>{member.full_name}</h4>
              <p>{member.bio}</p>
              <div className="meta-stack">
                <span>{member.city || "City not added yet"}</span>
                <span className="rating-line">
                  <StarRating score={member.score} />
                </span>
                <span>{member.response_time}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function PostScreen(props: {
  form: typeof initialListingForm;
  isBusy: boolean;
  onChange: React.Dispatch<React.SetStateAction<typeof initialListingForm>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="screen">
      <section className="surface">
        <div className="section-head">
          <h3>Post a rental</h3>
          <p>Keep it short, clear, and easy to trust.</p>
        </div>
        <form className="stack-form" onSubmit={props.onSubmit}>
          <input
            placeholder="Listing title"
            value={props.form.title}
            onChange={(event) =>
              props.onChange((current) => ({ ...current, title: event.target.value }))
            }
          />
          <textarea
            placeholder="What is included, condition, pickup details"
            value={props.form.description}
            onChange={(event) =>
              props.onChange((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
          <div className="split">
            <select
              value={props.form.category}
              onChange={(event) =>
                props.onChange((current) => ({
                  ...current,
                  category: event.target.value,
                }))
              }
            >
              {categories
                .filter((category) => category !== "all")
                .map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
            </select>
            <input
              placeholder="City"
              value={props.form.city}
              onChange={(event) =>
                props.onChange((current) => ({ ...current, city: event.target.value }))
              }
            />
          </div>
          <div className="split">
            <input
              placeholder="Price per day"
              value={props.form.price_per_day}
              onChange={(event) =>
                props.onChange((current) => ({
                  ...current,
                  price_per_day: event.target.value,
                }))
              }
            />
            <input
              placeholder="Deposit"
              value={props.form.deposit}
              onChange={(event) =>
                props.onChange((current) => ({
                  ...current,
                  deposit: event.target.value,
                }))
              }
            />
          </div>
          <input
            placeholder="Image URL"
            value={props.form.image_url}
            onChange={(event) =>
              props.onChange((current) => ({
                ...current,
                image_url: event.target.value,
              }))
            }
          />
          <button className="primary-button" disabled={props.isBusy} type="submit">
            {props.isBusy ? "Publishing..." : "Publish listing"}
          </button>
        </form>
      </section>
    </main>
  );
}

function TripsScreen(props: {
  activeMemberId: number | null;
  listings: Listing[];
  rentalForm: typeof initialRentalForm;
  rentals: Rental[];
  reviewForm: typeof initialReviewForm;
  reviewableRentals: Rental[];
  onRentalChange: React.Dispatch<React.SetStateAction<typeof initialRentalForm>>;
  onRentalSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReviewChange: React.Dispatch<React.SetStateAction<typeof initialReviewForm>>;
  onReviewSubmit: (event: FormEvent<HTMLFormElement>) => void;
  rentalBusy: boolean;
  reviewBusy: boolean;
}) {
  const myRentals = props.rentals.filter(
    (rental) => rental.renter === props.activeMemberId
  );

  return (
    <main className="screen">
      <section className="surface">
        <div className="section-head">
          <h3>Request a rental</h3>
          <p>Ask for the item and keep the first request light.</p>
        </div>
        <form className="stack-form" onSubmit={props.onRentalSubmit}>
          <select
            value={props.rentalForm.listing}
            onChange={(event) =>
              props.onRentalChange((current) => ({
                ...current,
                listing: event.target.value,
              }))
            }
          >
            <option value="">Choose listing</option>
            {props.listings.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.title} · EUR {listing.price_per_day}/day
              </option>
            ))}
          </select>
          <div className="split">
            <input
              type="date"
              value={props.rentalForm.start_date}
              onChange={(event) =>
                props.onRentalChange((current) => ({
                  ...current,
                  start_date: event.target.value,
                }))
              }
            />
            <input
              type="date"
              value={props.rentalForm.end_date}
              onChange={(event) =>
                props.onRentalChange((current) => ({
                  ...current,
                  end_date: event.target.value,
                }))
              }
            />
          </div>
          <button className="primary-button" disabled={props.rentalBusy} type="submit">
            {props.rentalBusy ? "Sending..." : "Send rental request"}
          </button>
        </form>
      </section>

      <section className="surface">
        <div className="section-head">
          <h3>Your rentals</h3>
          <p>Track requests, active trips, and completed ones ready for review.</p>
        </div>
        <div className="timeline">
          {myRentals.map((rental) => (
            <div className="timeline-card" key={rental.id}>
              <div>
                <strong>{rental.listing_title}</strong>
                <p>
                  {rental.start_date} to {rental.end_date}
                </p>
              </div>
              <span className={`status-pill ${rental.status}`}>{rental.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="surface">
        <div className="section-head">
          <h3>Leave a review</h3>
          <p>Only completed rentals can be reviewed.</p>
        </div>
        <form className="stack-form" onSubmit={props.onReviewSubmit}>
          <select
            value={props.reviewForm.rental}
            onChange={(event) =>
              props.onReviewChange((current) => ({
                ...current,
                rental: event.target.value,
              }))
            }
          >
            <option value="">Choose completed rental</option>
            {props.reviewableRentals.map((rental) => (
              <option key={rental.id} value={rental.id}>
                {rental.listing_title}
              </option>
            ))}
          </select>
          <div className="split">
            <select
              value={props.reviewForm.rating}
              onChange={(event) =>
                props.onReviewChange((current) => ({
                  ...current,
                  rating: event.target.value,
                }))
              }
            >
              {["5", "4", "3", "2", "1"].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} stars
                </option>
              ))}
            </select>
          </div>
          <textarea
            placeholder="Was the owner reliable? Did the item match the listing?"
            value={props.reviewForm.comment}
            onChange={(event) =>
              props.onReviewChange((current) => ({
                ...current,
                comment: event.target.value,
              }))
            }
          />
          <button className="primary-button" disabled={props.reviewBusy} type="submit">
            {props.reviewBusy ? "Posting..." : "Post review"}
          </button>
        </form>
      </section>
    </main>
  );
}

function ProfileScreen(props: {
  activeMember: Member | null;
  listings: Listing[];
  rentals: Rental[];
}) {
  if (!props.activeMember) {
    return null;
  }

  const ownedListings = props.listings.filter(
    (listing) => listing.owner.id === props.activeMember?.id
  );
  const rentalCount = props.rentals.filter(
    (rental) => rental.renter === props.activeMember?.id
  ).length;

  return (
    <main className="screen">
      <section className="profile-hero">
        <div className="avatar-ring large">
          <img alt={props.activeMember.full_name} src={props.activeMember.avatar_url} />
        </div>
        <div>
          <p className="eyebrow">Public profile</p>
          <h2>{props.activeMember.full_name}</h2>
          <p className="lead">{props.activeMember.bio || "Your public bio appears here."}</p>
        </div>
      </section>
      <section className="stats-grid">
        <StatCard
          label="Score"
          value={
            <span className="rating-line">
              <StarRating score={props.activeMember.score} />
            </span>
          }
        />
        <StatCard label="Reviews" value={props.activeMember.review_count} />
        <StatCard label="Listings" value={ownedListings.length} />
        <StatCard label="Rentals" value={rentalCount} />
      </section>
      <section className="surface">
        <div className="section-head">
          <h3>Your active inventory</h3>
          <p>{props.activeMember.city || "Add your city after sign-in"}</p>
        </div>
        <div className="timeline">
          {ownedListings.map((listing) => (
            <div className="timeline-card" key={listing.id}>
              <div>
                <strong>{listing.title}</strong>
                <p>
                  EUR {listing.price_per_day}/day · {listing.category}
                </p>
              </div>
              <span className="status-pill live">{listing.status}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function StarRating(props: { score: number | string }) {
  const numericScore =
    typeof props.score === "number" ? props.score : Number(props.score);
  const rounded = Math.round(numericScore);

  return (
    <span className="stars" aria-label={`${numericScore} out of 5 stars`}>
      {"★★★★★".slice(0, rounded)}
      <span className="stars-muted">{"★★★★★".slice(rounded)}</span>
      <strong>{numericScore.toFixed(1)}</strong>
    </span>
  );
}

function StatCard(props: { label: string; value: React.ReactNode }) {
  return (
    <article className="stat-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </article>
  );
}

export default App;
