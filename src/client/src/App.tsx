import { FormEvent, useRef, useDeferredValue, useEffect, useState, useTransition } from "react";
import { Search, LayoutList, MessageSquare, User as UserIcon, Settings, Globe, ChevronLeft, ChevronRight, MoreHorizontal, LogOut } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { api } from "./api";
import {
  isAuthDisabled,
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

const en = {
  nav: { explore: "Explore", myPosts: "My Posts", offers: "Offers", profile: "Profile", settings: "Settings" },
  settings: { title: "Settings", subtitle: "Manage your account preferences.", language: "Language", langEn: "English", langLv: "Latvian" },
  footer: { support: "Support", privacy: "Privacy Policy", terms: "Terms of Use", rights: "All rights reserved.", tagline: "Simple rentals. Fast access. Clear listings." },
  pagination: { prev: "Previous", next: "Next", of: "of" },
  explore: {
    title: "Find a rental",
    search: "Search",
    searchPlaceholder: "Search listing, city, or owner",
    category: "Category",
    city: "City",
    sort: "Sort",
    allCategories: "All categories",
    allCities: "All cities",
    sortNewest: "Newest first",
    sortPriceLow: "Price: low to high",
    sortPriceHigh: "Price: high to low",
    categories: {
      all: "All categories",
      tools: "Tools",
      vehicles: "Vehicles",
      electronics: "Electronics",
      events: "Events",
      home: "Home",
      outdoor: "Outdoor",
      other: "Other",
    },
  },
};

const lv: typeof en = {
  nav: { explore: "Meklēt", myPosts: "Mani sludinājumi", offers: "Piedāvājumi", profile: "Profils", settings: "Iestatījumi" },
  settings: { title: "Iestatījumi", subtitle: "Pārvaldiet sava konta preferences.", language: "Valoda", langEn: "Angļu", langLv: "Latviešu" },
  footer: { support: "Atbalsts", privacy: "Privātuma politika", terms: "Lietošanas noteikumi", rights: "Visas tiesības aizsargātas.", tagline: "Vienkārša noma. Ātra ieeja. Skaidri sludinājumi." },
  pagination: { prev: "Iepriekšējā", next: "Nākamā", of: "no" },
  explore: {
    title: "Atrast nomu",
    search: "Meklēt",
    searchPlaceholder: "Meklēt sludinājumu, pilsētu vai īpašnieku",
    category: "Kategorija",
    city: "Pilsēta",
    sort: "Kārtot",
    allCategories: "Visas kategorijas",
    allCities: "Visas pilsētas",
    sortNewest: "Jaunākie pirmie",
    sortPriceLow: "Cena: no zemākas",
    sortPriceHigh: "Cena: no augstākas",
    categories: {
      all: "Visas kategorijas",
      tools: "Instrumenti",
      vehicles: "Transportlīdzekļi",
      electronics: "Elektronika",
      events: "Pasākumi",
      home: "Māja",
      outdoor: "Daba",
      other: "Cits",
    },
  },
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHomeRoute = location.pathname === "/";
  const queryClient = useQueryClient();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCity, setSelectedCity] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [search, setSearch] = useState("");
  const [listingForm, setListingForm] = useState(initialListingForm);
  const [rentalForm, setRentalForm] = useState(initialRentalForm);
  const [reviewForm, setReviewForm] = useState(initialReviewForm);
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();
  const [lang, setLang] = useState<"en" | "lv">(() => {
    return (localStorage.getItem("lang") as "en" | "lv") || "en";
  });
  const t = lang === "lv" ? lv : en;
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [avatarMenuOpen]);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    return subscribeToAuth((user) => {
      if (authReady && !user) {
        navigate("/");
      }
      setAuthUser(user);
      setAuthReady(true);
    });
  }, [authReady, navigate]);

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
    enabled: isHomeRoute || isAuthDisabled() || Boolean(memberSyncQuery.data),
  });
  const listingsQuery = useQuery({
    queryKey: ["listings"],
    queryFn: api.getListings,
    enabled: isAuthDisabled() || Boolean(memberSyncQuery.data),
  });
  const membersQuery = useQuery({
    queryKey: ["members"],
    queryFn: () => api.getMembers(),
    enabled: isAuthDisabled() || Boolean(memberSyncQuery.data),
  });
  const rentalsQuery = useQuery({
    queryKey: ["rentals"],
    queryFn: api.getRentals,
    enabled: isAuthDisabled() || Boolean(memberSyncQuery.data),
  });
  const reviewsQuery = useQuery({
    queryKey: ["reviews"],
    queryFn: api.getReviews,
    enabled: isAuthDisabled() || Boolean(memberSyncQuery.data),
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
  const fallbackMember = membersQuery.data?.[0] ?? null;
  const currentMember = isAuthDisabled() ? fallbackMember : activeMember;
  const currentMemberId = currentMember?.id ?? null;

  const cityOptions = Array.from(
    new Set(listings.map((listing) => listing.city.trim()).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right));

  const filteredListings = listings
    .filter((listing) => {
      const matchesCategory =
        selectedCategory === "all" || listing.category === selectedCategory;
      const matchesCity = selectedCity === "all" || listing.city === selectedCity;
      const query = deferredSearch.trim().toLowerCase();
      const matchesSearch =
        query.length === 0 ||
        listing.title.toLowerCase().includes(query) ||
        listing.city.toLowerCase().includes(query) ||
        listing.owner.full_name.toLowerCase().includes(query);
      return matchesCategory && matchesCity && matchesSearch;
    })
    .sort((left, right) => {
      if (sortOrder === "price-low") {
        return Number(left.price_per_day) - Number(right.price_per_day);
      }
      if (sortOrder === "price-high") {
        return Number(right.price_per_day) - Number(left.price_per_day);
      }
      return Date.parse(right.created_at) - Date.parse(left.created_at);
    });

  const reviewableRentals = rentals.filter(
    (rental) =>
      rental.status === "completed" &&
      rental.renter === currentMemberId &&
      !reviews.some((review) => review.rental === rental.id)
  );

  const handleListingSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentMemberId) {
      return;
    }
    listingMutation.mutate({
      owner_id: currentMemberId,
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
    if (!currentMemberId || !rentalForm.listing) {
      return;
    }
    const selectedListing = listings.find(
      (listing) => listing.id === Number(rentalForm.listing)
    );
    const totalPrice = selectedListing ? selectedListing.price_per_day : "0";
    rentalMutation.mutate({
      listing: Number(rentalForm.listing),
      renter: currentMemberId,
      start_date: rentalForm.start_date,
      end_date: rentalForm.end_date,
      status: "requested",
      total_price: totalPrice,
    });
  };

  const handleReviewSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentMemberId || !reviewForm.rental) {
      return;
    }
    reviewMutation.mutate({
      rental: Number(reviewForm.rental),
      author: currentMemberId,
      rating: Number(reviewForm.rating),
      comment: reviewForm.comment,
    });
  };

  if (isHomeRoute && authReady && authUser) {
    return <Navigate replace to="/app" />;
  }

  if (isHomeRoute) {
    return (
      <HomeScreen
        overview={overview}
        canUseGoogleSignIn={!isAuthDisabled() && isFirebaseConfigured()}
        onGoogleSignIn={() => void signInWithGoogle()}
      />
    );
  }

  if (!isAuthDisabled() && !isFirebaseConfigured()) {
    return (
      <AuthScreen
        message="Add Firebase web config in Vite env vars to enable Google sign-in."
        ready
      />
    );
  }

  if (!isAuthDisabled() && !authReady) {
    return <AuthScreen message="Checking Google sign-in..." ready={false} />;
  }

  if (!isAuthDisabled() && !authUser) {
    return (
      <AuthScreen
        message="Sign in with your Google account to use Amonzi."
        onAction={() => void signInWithGoogle()}
        actionLabel="Continue with Google"
        ready
      />
    );
  }

  if (!isAuthDisabled() && memberSyncQuery.isLoading) {
    return <AuthScreen message="Preparing your Amonzi profile..." ready={false} />;
  }

  if (!isAuthDisabled() && (memberSyncQuery.error || !activeMember)) {
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
    <div className={isSidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell"}>
      <header className="app-header">
        <Link className="app-header-logo" to="/app">
          Amonzi
        </Link>
      </header>

      <aside className="sidebar">
        <header className="topbar">
          <div className="acting-card">
            {isAuthDisabled() ? (
              <>
                <strong>{currentMember?.full_name || "Demo member"}</strong>
                <small>Auth disabled</small>
              </>
            ) : (
              <>
                <div className="acting-profile-wrap" ref={avatarRef}>
                  <button
                    aria-label="Account menu"
                    className="acting-profile-row"
                    onClick={() => setAvatarMenuOpen((o) => !o)}
                    type="button"
                  >
                    <div className="avatar-ring">
                      <img
                        alt={authUser?.displayName || authUser?.email || "User"}
                        src={authUser?.photoURL || currentMember?.avatar_url || ""}
                      />
                    </div>
                    <div className="acting-profile-copy">
                      <strong>{authUser?.displayName || authUser?.email}</strong>
                      <small>{authUser?.email}</small>
                    </div>
                    <MoreHorizontal size={16} className="acting-more-icon" />
                  </button>
                  {currentMember ? (
                    <span className="rating-line">
                      <StarRating score={currentMember.score} />
                      {currentMember.review_count} reviews
                    </span>
                  ) : null}
                  {avatarMenuOpen && (
                    <div className="avatar-menu">
                      <button
                        className="avatar-menu-item"
                        onClick={() => { setAvatarMenuOpen(false); void signOutFromGoogle(); }}
                        type="button"
                      >
                        <LogOut size={15} />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </header>

        <nav className="tabbar">
          <NavLink to="/app" end>
            <Search size={18} className="nav-icon" />{t.nav.explore}
          </NavLink>
          <NavLink to="/app/my-posts">
            <LayoutList size={18} className="nav-icon" />{t.nav.myPosts}
          </NavLink>
          <NavLink to="/app/offers">
            <MessageSquare size={18} className="nav-icon" />{t.nav.offers}
          </NavLink>
          <NavLink to="/app/profile">
            <UserIcon size={18} className="nav-icon" />{t.nav.profile}
          </NavLink>
          <NavLink to="/app/settings">
            <Globe size={18} className="nav-icon" />
            {t.nav.settings}
            <span className="lang-badge">{lang.toUpperCase()}</span>
          </NavLink>
        </nav>
      </aside>

      <main className="main-panel">
        {notice ? <div className="notice">{notice}</div> : null}

        <Routes>
          <Route path="/" element={<Navigate replace to="/app" />} />
          <Route
            path="/app"
            element={
              <ExploreScreen
                activeMember={currentMember}
                cityOptions={cityOptions}
                filteredListings={filteredListings}
                onCategoryChange={(category) =>
                  startTransition(() => setSelectedCategory(category))
                }
                onCityChange={(city) => startTransition(() => setSelectedCity(city))}
                onSearchChange={(value) => setSearch(value)}
                overview={overview}
                onSortChange={(value) => startTransition(() => setSortOrder(value))}
                search={search}
                selectedCity={selectedCity}
                selectedCategory={selectedCategory}
                sortOrder={sortOrder}
                t={t}
              />
            }
          />
          <Route
            path="/app/post"
            element={
              <PostScreen
                form={listingForm}
                isBusy={listingMutation.isPending}
                onChange={setListingForm}
                onSubmit={handleListingSubmit}
              />
            }
          />
          <Route path="/app/my-posts" element={<MyPostsScreen activeMember={currentMember} listings={listings} />} />
          <Route path="/app/offers" element={<OffersScreen activeMember={currentMember} />} />
          <Route path="/app/settings" element={<SettingsScreen activeMember={currentMember} lang={lang} onLangChange={(l) => { setLang(l); localStorage.setItem("lang", l); }} t={t} />} />
          <Route
            path="/app/profile"
            element={
              <ProfileScreen
                activeMember={currentMember}
                listings={listings}
                rentals={rentals}
              />
            }
          />
          <Route path="*" element={<Navigate replace to="/app" />} />
        </Routes>

        {overviewQuery.isLoading || listingsQuery.isLoading || membersQuery.isLoading ? (
          <div className="loading-sheet">Loading Amonzi…</div>
        ) : null}
        {overviewQuery.error || listingsQuery.error || membersQuery.error ? (
          <div className="error-sheet">Backend is not reachable. Start `make server`.</div>
        ) : null}
        {isPending ? <div className="ghost-chip">Updating filters…</div> : null}
      </main>

      <footer className="app-footer">
        <div className="app-footer-brand">
          <span className="app-footer-logo">Amonzi</span>
          <span className="app-footer-tagline">{t.footer.tagline}</span>
        </div>
        <nav className="app-footer-links">
          <a href="mailto:support@amonzi.com">{t.footer.support}</a>
          <a href="/privacy">{t.footer.privacy}</a>
          <a href="/terms">{t.footer.terms}</a>
        </nav>
        <p className="app-footer-copy">© {new Date().getFullYear()} Amonzi. {t.footer.rights}</p>
      </footer>
    </div>
  );
}

function HomeScreen(props: {
  overview: Awaited<ReturnType<typeof api.getOverview>> | undefined;
  canUseGoogleSignIn: boolean;
  onGoogleSignIn: () => void;
}) {
  return (
    <main className="home-shell">
      <header className="home-header">
        <Link className="home-logo" to="/">
          Amonzi
        </Link>
        <div className="home-header-actions">
          {props.canUseGoogleSignIn ? (
            <button className="secondary-button" onClick={props.onGoogleSignIn} type="button">
              Pieslēgties
            </button>
          ) : (
            <Link className="secondary-button" to="/app">
              Pieslēgties
            </Link>
          )}
          <Link className="primary-button" to="/app">
            Ieiet platformā
          </Link>
          <Link className="secondary-button" to="/app/profile">
            Profils
          </Link>
        </div>
      </header>

      <section className="home-hero">
        <div className="home-copy">
          <p className="brand-mark">Amonzi</p>
          <h1>Redzi, gribi, nomā.</h1>
          <p className="lead">Vienkārša noma. Ātra ieeja. Skaidri sludinājumi.</p>
          <div className="home-actions">
            {props.canUseGoogleSignIn ? (
              <button className="primary-button" onClick={props.onGoogleSignIn} type="button">
                Ieiet ar Google
              </button>
            ) : (
              <Link className="primary-button" to="/app">
                Atvērt platformu
              </Link>
            )}
            <a className="secondary-button" href="#ka-tas-strada">
              Kā tas strādā
            </a>
          </div>
        </div>
        <div className="home-panel">
          <div className="home-stat">
            <span>Ātri</span>
            <strong>Atrodi vajadzīgo bez liekiem soļiem</strong>
          </div>
          <div className="home-stat">
            <span>Vienkārši</span>
            <strong>Ieeja, sludinājumi un noma vienā vietā</strong>
          </div>
          <div className="home-stat">
            <span>Uzticami</span>
            <strong>Vērtējumi un atsauksmes palīdz izvēlēties</strong>
          </div>
        </div>
      </section>

      <section className="home-strip" id="ka-tas-strada">
        <article className="home-mini-card">
          <strong>Pieslēdzies</strong>
          <p>Ar Google un sāc uzreiz.</p>
        </article>
        <article className="home-mini-card">
          <strong>Atrodi</strong>
          <p>Pārlūko pēc cenas, pilsētas un kategorijas.</p>
        </article>
        <article className="home-mini-card">
          <strong>Nomā</strong>
          <p>Nosūti pieprasījumu un pārvaldi visu vienuviet.</p>
        </article>
      </section>

      <section className="home-preview-block">
        <div className="section-head">
          <h2>Platformas skati</h2>
          <p>Īss priekšskats, kā izskatīsies platforma.</p>
        </div>
        <div className="home-preview-grid">
          <article className="home-preview-card">
            <div className="home-preview-bar">
              <span />
              <span />
              <span />
            </div>
            <div className="home-preview-content">
              <strong>Explore skats</strong>
              <p>Meklēšana, kategorijas, pilsētas filtrs un sludinājumu saraksts.</p>
              <div className="home-preview-lines">
                <span />
                <span />
                <span />
              </div>
            </div>
          </article>

          <article className="home-preview-card">
            <div className="home-preview-bar">
              <span />
              <span />
              <span />
            </div>
            <div className="home-preview-content">
              <strong>Post skats</strong>
              <p>Forma jaunam sludinājumam ar virsrakstu, cenu, attēlu un kategoriju.</p>
              <div className="home-preview-lines">
                <span />
                <span />
                <span />
              </div>
            </div>
          </article>

          <article className="home-preview-card">
            <div className="home-preview-bar">
              <span />
              <span />
              <span />
            </div>
            <div className="home-preview-content">
              <strong>Trips skats</strong>
              <p>Nomas pieprasījumi, datumi, statusi un atsauksmju sadaļa vienuviet.</p>
              <div className="home-preview-lines">
                <span />
                <span />
                <span />
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="home-preview-block">
        <div className="section-head">
          <h2>Sludinājumu karuselis</h2>
          <p>Piemēri tam, ko lietotājs redzēs uzreiz.</p>
        </div>
        <div className="home-carousel">
          {(props.overview?.featured_listings ?? []).map((listing) => (
            <article className="home-carousel-card" key={listing.id}>
              <div
                className="home-carousel-image"
                style={{ backgroundImage: `url(${listing.image_url})` }}
              />
              <div className="home-carousel-body">
                <span className="tag">{listing.category}</span>
                <strong>{listing.title}</strong>
                <p>{listing.city}</p>
                <strong>EUR {listing.price_per_day}/dienā</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-preview-block">
        <div className="section-head">
          <h2>Atsauksmes</h2>
          <p>Ko lietotāji redzēs pirms izvēles.</p>
        </div>
        <div className="home-carousel">
          {(props.overview?.recent_reviews ?? []).map((review) => (
            <article className="home-carousel-card review-card" key={review.id}>
              <div className="home-carousel-body">
                <span className="tag">Atsauksme</span>
                <strong>{review.reviewed_member_name}</strong>
                <span className="rating-line">
                  <StarRating score={review.rating} />
                </span>
                <p>{review.comment}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
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
  cityOptions: string[];
  filteredListings: Listing[];
  onCategoryChange: (category: string) => void;
  onCityChange: (city: string) => void;
  onSearchChange: (value: string) => void;
  overview: Awaited<ReturnType<typeof api.getOverview>> | undefined;
  onSortChange: (value: string) => void;
  search: string;
  selectedCity: string;
  selectedCategory: string;
  sortOrder: string;
  t: typeof en;
}) {
  const PAGE_SIZE = 9;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(props.filteredListings.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = props.filteredListings.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [props.filteredListings.length, props.selectedCategory, props.selectedCity, props.sortOrder, props.search]);

  return (
    <main className="screen">
      <section className="surface">
        <div className="section-head">
          <h3>{props.t.explore.title}</h3>
        </div>
        <div className="filter-row">
          <div className="filter-field filter-search">
            <span>{props.t.explore.search}</span>
            <input
              value={props.search}
              onChange={(event) => props.onSearchChange(event.target.value)}
              placeholder={props.t.explore.searchPlaceholder}
            />
          </div>
          <div className="filter-grid">
            <label className="filter-field">
              <span>{props.t.explore.category}</span>
              <select
                value={props.selectedCategory}
                onChange={(event) => props.onCategoryChange(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {props.t.explore.categories[category as keyof typeof props.t.explore.categories]}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span>{props.t.explore.city}</span>
              <select
                value={props.selectedCity}
                onChange={(event) => props.onCityChange(event.target.value)}
              >
                <option value="all">{props.t.explore.allCities}</option>
                {props.cityOptions.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
            <label className="filter-field">
              <span>{props.t.explore.sort}</span>
              <select
                value={props.sortOrder}
                onChange={(event) => props.onSortChange(event.target.value)}
              >
                <option value="newest">{props.t.explore.sortNewest}</option>
                <option value="price-low">{props.t.explore.sortPriceLow}</option>
                <option value="price-high">{props.t.explore.sortPriceHigh}</option>
              </select>
            </label>
          </div>
        </div>
        <div className="listing-grid">
          {paginated.map((listing) => (
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

        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              disabled={safePage === 1}
              onClick={() => setPage((p) => p - 1)}
              type="button"
            >
              <ChevronLeft size={16} />
              {props.t.pagination.prev}
            </button>
            <div className="pagination-pages">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  className={`pagination-page${n === safePage ? " active" : ""}`}
                  onClick={() => setPage(n)}
                  type="button"
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              className="pagination-btn"
              disabled={safePage === totalPages}
              onClick={() => setPage((p) => p + 1)}
              type="button"
            >
              {props.t.pagination.next}
              <ChevronRight size={16} />
            </button>
          </div>
        )}
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

function MyPostsScreen(props: { activeMember: Member | null; listings: Listing[] }) {
  const myListings = props.listings.filter(
    (listing) => listing.owner.id === props.activeMember?.id
  );

  return (
    <main className="screen">
      <section className="surface">
        <div className="section-head">
          <h3>My Posts</h3>
          <p>Items you have listed for rent.</p>
        </div>
        {myListings.length === 0 ? (
          <div className="notice">You have not posted any listings yet.</div>
        ) : (
          <div className="listing-grid">
            {myListings.map((listing) => (
              <article className="listing-card" key={listing.id}>
                {listing.image_url && (
                  <div
                    className="listing-image"
                    style={{ backgroundImage: `url(${listing.image_url})` }}
                  />
                )}
                <div className="listing-body">
                  <div className="listing-top">
                    <strong>{listing.title}</strong>
                    <span className="status-pill live">{listing.status}</span>
                  </div>
                  <p>{listing.description}</p>
                  <div className="meta-stack">
                    <span className="tag">{listing.category}</span>
                    <span className="tag">{listing.city}</span>
                    <span className="tag">€{listing.price_per_day}/day</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function OffersScreen(props: { activeMember: Member | null }) {
  return (
    <main className="screen">
      <section className="surface">
        <div className="section-head">
          <h3>Offers</h3>
          <p>Messages and rental requests from other members.</p>
        </div>
        <div className="notice">No offers yet. This is where incoming rental requests and messages will appear.</div>
      </section>
    </main>
  );
}

function SettingsScreen(props: {
  activeMember: Member | null;
  lang: "en" | "lv";
  onLangChange: (l: "en" | "lv") => void;
  t: typeof en;
}) {
  return (
    <main className="screen">
      <section className="surface">
        <div className="section-head">
          <h3>{props.t.settings.title}</h3>
          <p>{props.t.settings.subtitle}</p>
        </div>
        <div className="settings-group">
          <p className="settings-label"><Globe size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />{props.t.settings.language}</p>
          <div className="lang-toggle">
            <button
              className={`lang-option${props.lang === "en" ? " active" : ""}`}
              onClick={() => props.onLangChange("en")}
              type="button"
            >
              🇬🇧 {props.t.settings.langEn}
            </button>
            <button
              className={`lang-option${props.lang === "lv" ? " active" : ""}`}
              onClick={() => props.onLangChange("lv")}
              type="button"
            >
              🇱🇻 {props.t.settings.langLv}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
