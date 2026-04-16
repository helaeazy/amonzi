import { FormEvent, useRef, useDeferredValue, useEffect, useState, useTransition } from "react";
import { Search, LayoutList, MessageSquare, User as UserIcon, Globe, ChevronLeft, ChevronRight, MoreHorizontal, LogOut, Eye, Plus, Trash2, X, MapPin, Shield, CalendarDays, Repeat, Wallet } from "lucide-react";
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
import type { Listing, Member, Rental, Review } from "./types";

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

const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;
const LISTING_POST_FEE = 5;
const LISTING_POST_DAYS = 30;

function getListingPhotos(listing: Pick<Listing, "photo_urls" | "image_url">) {
  return listing.photo_urls?.length ? listing.photo_urls : [listing.image_url].filter(Boolean);
}

function hasListingReviews(listing: Pick<Listing, "review_count">) {
  return Number(listing.review_count) > 0;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

function formatApiError(error: unknown) {
  if (!(error instanceof Error)) return "Request failed";
  try {
    const parsed = JSON.parse(error.message) as { detail?: string };
    return parsed.detail || error.message;
  } catch {
    return error.message;
  }
}

function getListingDurationLabel(createdAt: string) {
  const created = new Date(createdAt);
  const expires = new Date(created.getTime() + LISTING_POST_DAYS * 24 * 60 * 60 * 1000);
  const remainingMs = expires.getTime() - Date.now();
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

  if (remainingDays === 0) {
    return "Ends today";
  }

  if (remainingDays === 1) {
    return "1 day left";
  }

  return `${remainingDays} days left`;
}

type PendingListingPreview = {
  title: string;
  description: string;
  category: string;
  city: string;
  price_per_day: string;
  image_url: string;
  status: string;
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
  pagination: { prev: "Previous", next: "Next" },
  common: {
    day: "day", deposit: "Deposit", reviews: "reviews", delete: "Delete", cancel: "Cancel",
    publishing: "Publishing...", publish: "Publish listing", newListing: "New listing",
    noListings: "You have not posted any listings yet.", signOut: "Sign out", hostedBy: "Hosted by",
    authDisabled: "Auth disabled",
  },
  notices: {
    listingPublished: "Listing published.", listingDeleted: "Listing deleted.",
    rentalSent: "Rental request sent.", reviewPosted: "Review posted.",
    updatingFilters: "Updating filters…", loading: "Loading…",
    backendError: "Backend is not reachable. Start `make server`.",
    walletUpdated: "Wallet updated.",
    insufficientWallet: "Add money to your wallet before posting a new listing.",
  },
  explore: {
    title: "Find a rental",
    search: "Search", searchPlaceholder: "Search listing, city, or owner",
    category: "Category", city: "City", sort: "Sort",
    allCategories: "All categories", allCities: "All cities",
    sortNewest: "Newest first", sortPriceLow: "Price: low to high", sortPriceHigh: "Price: high to low",
    aboutOwner: "About the owner", memberSinceShort: "Member since",
    views: "Views", clicks: "Clicks", shares: "Shares",
    categories: { all: "All categories", tools: "Tools", vehicles: "Vehicles", electronics: "Electronics", events: "Events", home: "Home", outdoor: "Outdoor", other: "Other" },
  },
  myPosts: {
    title: "My Posts", subtitle: "Items you have listed for rent.",
    placeholderTitle: "Listing title", placeholderDesc: "What is included, condition, pickup details",
    placeholderCity: "City", placeholderPrice: "Price per day (€)", placeholderDeposit: "Deposit (€)", placeholderImage: "Add picture",
    chooseImage: "Choose picture", removeImage: "Remove picture", imageHelp: "Upload a photo instead of pasting a link.",
    walletTitle: "Wallet",
    walletBalance: "Balance",
    walletAllowance: "Posting power",
    walletDuration: "Live duration",
    walletOpen: "Open wallet",
    walletAdd: "Add money",
    walletContinue: "Continue to listing",
    walletAmount: "Top up amount (€)",
    walletPostingRule: "Each listing costs EUR 5.00 and stays live for 30 days.",
  },
  modal: {
    perDay: "/ day", deposit: "Deposit", owner: "Owner", memberSince: "Member since",
    responseTime: "Response time", noReviews: "No reviews yet.", reviews: "Reviews",
    close: "Close", listed: "Listed", messageOwner: "Message owner",
  },
  offers: { title: "Offers", subtitle: "Messages and rental requests from other members.", empty: "No offers yet. This is where incoming rental requests and messages will appear." },
  profile: {
    publicProfile: "Public profile", bioPlaceholder: "Your public bio appears here.",
    score: "Score", reviews: "Reviews", listings: "Listings", rentals: "Rentals",
    inventory: "Your active inventory", addCity: "Add your city after sign-in",
  },
};

const lv: typeof en = {
  nav: { explore: "Meklēt", myPosts: "Mani sludinājumi", offers: "Piedāvājumi", profile: "Profils", settings: "Iestatījumi" },
  settings: { title: "Iestatījumi", subtitle: "Pārvaldiet sava konta preferences.", language: "Valoda", langEn: "Angļu", langLv: "Latviešu" },
  footer: { support: "Atbalsts", privacy: "Privātuma politika", terms: "Lietošanas noteikumi", rights: "Visas tiesības aizsargātas.", tagline: "Vienkārša noma. Ātra ieeja. Skaidri sludinājumi." },
  pagination: { prev: "Iepriekšējā", next: "Nākamā" },
  common: {
    day: "diena", deposit: "Depozīts", reviews: "atsauksmes", delete: "Dzēst", cancel: "Atcelt",
    publishing: "Publicē...", publish: "Publicēt sludinājumu", newListing: "Jauns sludinājums",
    noListings: "Jūs vēl neesat publicējis nevienu sludinājumu.", signOut: "Iziet", hostedBy: "Publicē",
    authDisabled: "Autentifikācija atspējota",
  },
  notices: {
    listingPublished: "Sludinājums publicēts.", listingDeleted: "Sludinājums dzēsts.",
    rentalSent: "Nomas pieprasījums nosūtīts.", reviewPosted: "Atsauksme publicēta.",
    updatingFilters: "Atjaunina filtrus…", loading: "Ielādē…",
    backendError: "Serveris nav sasniedzams. Palaidiet `make server`.",
    walletUpdated: "Maks papildināts.",
    insufficientWallet: "Pirms jauna sludinājuma publicēšanas papildiniet maku.",
  },
  explore: {
    title: "Atrast nomu",
    search: "Meklēt", searchPlaceholder: "Meklēt sludinājumu, pilsētu vai īpašnieku",
    category: "Kategorija", city: "Pilsēta", sort: "Kārtot",
    allCategories: "Visas kategorijas", allCities: "Visas pilsētas",
    sortNewest: "Jaunākie pirmie", sortPriceLow: "Cena: no zemākas", sortPriceHigh: "Cena: no augstākas",
    aboutOwner: "Par īpašnieku", memberSinceShort: "Dalībnieks kopš",
    views: "Skatījumi", clicks: "Klikšķi", shares: "Dalīšanās",
    categories: { all: "Visas kategorijas", tools: "Instrumenti", vehicles: "Transportlīdzekļi", electronics: "Elektronika", events: "Pasākumi", home: "Māja", outdoor: "Daba", other: "Cits" },
  },
  myPosts: {
    title: "Mani sludinājumi", subtitle: "Preces, ko esat izlikuši iznomāšanai.",
    placeholderTitle: "Sludinājuma nosaukums", placeholderDesc: "Kas iekļauts, stāvoklis, paņemšanas detaļas",
    placeholderCity: "Pilsēta", placeholderPrice: "Cena dienā (€)", placeholderDeposit: "Depozīts (€)", placeholderImage: "Pievienot attēlu",
    chooseImage: "Izvēlēties attēlu", removeImage: "Noņemt attēlu", imageHelp: "Augšupielādējiet attēlu, nevis saiti.",
    walletTitle: "Maks",
    walletBalance: "Bilance",
    walletAllowance: "Cik var publicēt",
    walletDuration: "Publicēšanas ilgums",
    walletOpen: "Atvērt maku",
    walletAdd: "Pievienot naudu",
    walletContinue: "Turpināt uz sludinājumu",
    walletAmount: "Papildinājuma summa (€)",
    walletPostingRule: "Katrs sludinājums maksā EUR 5.00 un ir aktīvs 30 dienas.",
  },
  modal: {
    perDay: "/ dienā", deposit: "Depozīts", owner: "Īpašnieks", memberSince: "Dalībnieks kopš",
    responseTime: "Atbildes laiks", noReviews: "Pagaidām nav atsauksmju.", reviews: "Atsauksmes",
    close: "Aizvērt", listed: "Publicēts", messageOwner: "Rakstīt īpašniekam",
  },
  offers: { title: "Piedāvājumi", subtitle: "Ziņojumi un nomas pieprasījumi no citiem lietotājiem.", empty: "Pagaidām nav piedāvājumu. Šeit parādīsies ienākošie nomas pieprasījumi." },
  profile: {
    publicProfile: "Publiskais profils", bioPlaceholder: "Jūsu publiskā biogrāfija parādīsies šeit.",
    score: "Vērtējums", reviews: "Atsauksmes", listings: "Sludinājumi", rentals: "Nomas",
    inventory: "Jūsu aktīvais inventārs", addCity: "Pievienojiet pilsētu pēc pieteikšanās",
  },
};

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHomeRoute = location.pathname === "/";
  const queryClient = useQueryClient();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSidebarCollapsed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCity, setSelectedCity] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [search, setSearch] = useState("");
  const [listingForm, setListingForm] = useState(initialListingForm);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rentalForm, setRentalForm] = useState(initialRentalForm);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [reviewForm, setReviewForm] = useState(initialReviewForm);
  const [notice, setNotice] = useState("");
  const [pendingListingPreview, setPendingListingPreview] = useState<PendingListingPreview | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isHeaderHiddenOnScroll, setIsHeaderHiddenOnScroll] = useState(false);
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [lang, setLang] = useState<"en" | "lv">(() => {
    return (localStorage.getItem("lang") as "en" | "lv") || "en";
  });
  const t = lang === "lv" ? lv : en;
  const tRef = useRef(t);
  // eslint-disable-next-line react-hooks/refs
  tRef.current = t;
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
    let lastScrollY = window.scrollY;

    function handleScroll() {
      const currentScrollY = window.scrollY;
      const isNearTop = currentScrollY < 24;
      const isScrollingDown = currentScrollY > lastScrollY;

      setIsHeaderHiddenOnScroll(!isNearTop && isScrollingDown);
      lastScrollY = currentScrollY;
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.pathname]);

  useEffect(() => {
    setIsListingModalOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    return subscribeToAuth((user) => {
      if (authReady && !user) {
        navigate("/");
      }
      if (user && window.location.pathname === "/") {
        navigate("/app");
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
      setNotice(tRef.current.notices.listingPublished);
      setListingForm(initialListingForm);
      setPendingListingPreview(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["listings"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
        queryClient.invalidateQueries({ queryKey: ["members"] }),
        queryClient.invalidateQueries({ queryKey: ["member-sync"] }),
      ]);
    },
    onError: (error) => {
      setPendingListingPreview(null);
      setNotice(formatApiError(error));
    },
  });

  const walletMutation = useMutation({
    mutationFn: ({ id, walletBalance }: { id: number; walletBalance: string }) =>
      api.updateMember(id, { wallet_balance: walletBalance }),
    onSuccess: async () => {
      setNotice(tRef.current.notices.walletUpdated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["members"] }),
        queryClient.invalidateQueries({ queryKey: ["member-sync"] }),
      ]);
    },
    onError: (error) => {
      setNotice(formatApiError(error));
    },
  });

  const deleteListingMutation = useMutation({
    mutationFn: api.deleteListing,
    onSuccess: async () => {
      setNotice(tRef.current.notices.listingDeleted);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["listings"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
      ]);
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const rentalMutation = useMutation({
    mutationFn: api.createRental,
    onSuccess: async () => {
      setNotice(tRef.current.notices.rentalSent);
      setRentalForm(initialRentalForm);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rentals"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
      ]);
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const reviewMutation = useMutation({
    mutationFn: api.createReview,
    onSuccess: async () => {
      setNotice(tRef.current.notices.reviewPosted);
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

  const handleListingSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentMemberId) {
      return;
    }
    if (Number(currentMember?.wallet_balance ?? 0) < LISTING_POST_FEE) {
      setNotice(tRef.current.notices.insufficientWallet);
      return;
    }
    setPendingListingPreview({
      title: listingForm.title,
      description: listingForm.description,
      category: listingForm.category,
      city: listingForm.city,
      price_per_day: listingForm.price_per_day,
      image_url: listingForm.image_url,
      status: "posting",
    });
    listingMutation.mutate({
      owner_id: currentMemberId,
      title: listingForm.title,
      description: listingForm.description,
      category: listingForm.category,
      city: listingForm.city,
      price_per_day: listingForm.price_per_day,
      deposit: listingForm.deposit,
      image_url: listingForm.image_url,
      photo_urls: listingForm.image_url ? [listingForm.image_url] : [],
      status: "live",
    });
  };

  const handleWalletTopUp = (amount: string) => {
    if (!currentMemberId || !currentMember) return;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return;
    }
    const nextBalance = (Number(currentMember.wallet_balance) + numericAmount).toFixed(2);
    walletMutation.mutate({ id: currentMemberId, walletBalance: nextBalance });
  };

  const handleMessageOwner = (listing: Listing) => {
    setNotice(`Open conversation with ${listing.owner.full_name} in Offers.`);
    navigate("/app/offers");
  };

  if (isHomeRoute) {
    return (
      <HomeScreen
        overview={overview}
        authReady={authReady}
        authUser={authUser}
        canUseGoogleSignIn={!isAuthDisabled() && isFirebaseConfigured()}
        onGoogleSignIn={() => void signInWithGoogle()}
        onSignOut={() => void signOutFromGoogle()}
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
      <header className={`app-header${isHeaderHiddenOnScroll || isListingModalOpen ? " app-header--hidden" : ""}`}>
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
                <small>{t.common.authDisabled}</small>
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
                      {currentMember.review_count} {t.common.reviews}
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
                        {t.common.signOut}
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

        <div className="route-transition" key={location.pathname}>
        <Routes>
          <Route path="/" element={<Navigate replace to="/app" />} />
          <Route
            path="/app"
            element={
              <ExploreScreen
                activeMember={currentMember}
                cityOptions={cityOptions}
                filteredListings={filteredListings}
                rentals={rentals}
                reviews={reviews}
                onMessageOwner={handleMessageOwner}
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
                onModalOpenChange={setIsListingModalOpen}
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
          <Route path="/app/my-posts" element={
            <MyPostsScreen
              activeMember={currentMember}
              listings={listings}
              form={listingForm}
              isBusy={listingMutation.isPending}
              isDeleting={deleteListingMutation.isPending}
              onChange={setListingForm}
              onSubmit={handleListingSubmit}
              onDelete={(id) => deleteListingMutation.mutate(id)}
              onTopUp={handleWalletTopUp}
              pendingListing={pendingListingPreview}
              walletBalance={currentMember?.wallet_balance ?? "0.00"}
              walletBusy={walletMutation.isPending}
              t={t}
            />
          } />
          <Route path="/app/offers" element={<OffersScreen activeMember={currentMember} listings={listings} rentals={rentals} t={t} />} />
          <Route path="/app/settings" element={<SettingsScreen activeMember={currentMember} lang={lang} onLangChange={(l) => { setLang(l); localStorage.setItem("lang", l); }} t={t} />} />
          <Route
            path="/app/profile"
            element={
              <ProfileScreen
                activeMember={currentMember}
                listings={listings}
                rentals={rentals}
                t={t}
              />
            }
          />
          <Route path="*" element={<Navigate replace to="/app" />} />
        </Routes>
        </div>

        {overviewQuery.isLoading || listingsQuery.isLoading || membersQuery.isLoading ? (
          <div className="loading-sheet">{t.notices.loading}</div>
        ) : null}
        {overviewQuery.error || listingsQuery.error || membersQuery.error ? (
          <div className="error-sheet">{t.notices.backendError}</div>
        ) : null}
        {isPending ? <div className="ghost-chip">{t.notices.updatingFilters}</div> : null}
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

const HOME_CATS = [
  { emoji: "🔧", label: "Instrumenti" },
  { emoji: "🚗", label: "Transports" },
  { emoji: "📱", label: "Elektronika" },
  { emoji: "🎉", label: "Pasākumi" },
  { emoji: "🏠", label: "Māja" },
  { emoji: "🌲", label: "Daba" },
];

function HomeScreen(props: {
  overview: Awaited<ReturnType<typeof api.getOverview>> | undefined;
  authReady: boolean;
  authUser: User | null;
  canUseGoogleSignIn: boolean;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
}) {
  const isSignedIn = Boolean(props.authUser);
  const stats = props.overview?.stats;

  return (
    <main className="home-shell">
      <header className="app-header home-topbar">
        <Link className="app-header-logo" to="/app">Amonzi</Link>
        <div className="home-header-actions">
          {isSignedIn ? (
            <>
              <Link className="secondary-button" to="/app">Atvērt</Link>
              <button className="secondary-button" onClick={props.onSignOut} type="button">Iziet</button>
            </>
          ) : props.canUseGoogleSignIn ? (
            <>
              <button className="secondary-button" onClick={props.onGoogleSignIn} type="button">Pieslēgties</button>
              <Link className="primary-button" to="/app">Ienākt</Link>
            </>
          ) : (
            <Link className="primary-button" to="/app">Atvērt platformu</Link>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="home-hero-new">
        <p className="home-eyebrow">Latvijas nomas platforma</p>
        <h1 className="home-headline">Redzi, Gribi, Nomā.</h1>
        <div className="home-hero-actions">
          {isSignedIn ? (
            <Link className="primary-button home-cta-btn" to="/app">Atvērt sludinājumus</Link>
          ) : props.canUseGoogleSignIn ? (
            <>
              <button className="primary-button home-cta-btn" onClick={props.onGoogleSignIn} type="button">Sākt ar Google</button>
              <Link className="secondary-button home-cta-btn" to="/app">Skatīt platformu</Link>
            </>
          ) : (
            <Link className="primary-button home-cta-btn" to="/app">Atvērt platformu</Link>
          )}
        </div>
        {stats && (
          <div className="home-stats">
            <div className="home-stat">
              <strong>{stats.live_listings}</strong>
              <span>Sludinājumi</span>
            </div>
            <div className="home-stat-div" />
            <div className="home-stat">
              <strong>10,000+</strong>
              <span>Lietotāji</span>
            </div>
            <div className="home-stat-div" />
            <div className="home-stat">
              <strong>{stats.completed_rentals}</strong>
              <span>Darījumi</span>
            </div>
          </div>
        )}
      </section>

      {/* ── Categories ── */}
      <section className="home-cats">
        {HOME_CATS.map((item) => (
          <Link key={item.label} className="home-cat-tile" to="/app">
            <span className="home-cat-icon">{item.emoji}</span>
            <span className="home-cat-label">{item.label}</span>
          </Link>
        ))}
      </section>

      {/* ── How it works ── */}
      <section className="home-steps">
        <div className="home-step">
          <span className="home-step-num">01</span>
          <strong>Atrodi</strong>
          <p>Pārlūko pēc kategorijas vai pilsētas.</p>
        </div>
        <div className="home-step">
          <span className="home-step-num">02</span>
          <strong>Vienojies</strong>
          <p>Sazinies ar īpašnieku tieši platformā.</p>
        </div>
        <div className="home-step">
          <span className="home-step-num">03</span>
          <strong>Nomā</strong>
          <p>Saņem, izmanto un atdod. Vienkārši.</p>
        </div>
      </section>

      {/* ── Final CTA ── */}
      {!isSignedIn && (
        <section className="home-final-cta">
          {props.canUseGoogleSignIn ? (
            <button className="primary-button home-cta-btn" onClick={props.onGoogleSignIn} type="button">
              Pieslēgties ar Google
            </button>
          ) : (
            <Link className="primary-button home-cta-btn" to="/app">Atvērt platformu</Link>
          )}
        </section>
      )}
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
  rentals: Rental[];
  reviews: Review[];
  onMessageOwner: (listing: Listing) => void;
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
  onModalOpenChange: (isOpen: boolean) => void;
}) {
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const PAGE_SIZE = 9;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(props.filteredListings.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = props.filteredListings.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); }, [props.filteredListings.length, props.selectedCategory, props.selectedCity, props.sortOrder, props.search]);
  useEffect(() => {
    props.onModalOpenChange(Boolean(selectedListing));
  }, [props.onModalOpenChange, selectedListing]);

  useEffect(() => {
    return () => props.onModalOpenChange(false);
  }, [props.onModalOpenChange]);

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
            <article className="listing-card listing-card--clickable" key={listing.id} onClick={() => setSelectedListing(listing)}>
              <div
                className="listing-image"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.22)), url(${getListingPhotos(listing)[0]})`,
                }}
              />
              <div className="listing-body">
                <div className="listing-head-block">
                  <div className="listing-title-row">
                    <div className="listing-title-copy">
                      <h4>{listing.title}</h4>
                      {hasListingReviews(listing) ? (
                        <div className="listing-rating-value">
                          <StarRating score={listing.rating} />
                          <span>({listing.review_count})</span>
                        </div>
                      ) : (
                        <div className="listing-rating-value listing-rating-value--empty">
                          <span>0 reviews</span>
                        </div>
                      )}
                    </div>
                    <strong className="listing-price-top">EUR {listing.price_per_day}/{props.t.common.day}</strong>
                  </div>
                  <div className="listing-top-tags">
                    <span className="tag">{props.t.explore.categories[listing.category as keyof typeof props.t.explore.categories] ?? listing.category}</span>
                    <span className="tag muted">{listing.city}</span>
                  </div>
                </div>
                <p>{listing.description}</p>
                <div className="owner-preview">
                  <div className="owner-preview-head">
                    <div className="avatar-ring owner-preview-avatar">
                      <img alt={listing.owner.full_name} src={listing.owner.avatar_url} />
                    </div>
                    <div className="owner-preview-copy">
                      <span className="owner-preview-label">{props.t.common.hostedBy}</span>
                      <strong>{listing.owner.full_name}</strong>
                      <p>{listing.owner.bio}</p>
                    </div>
                  </div>
                  <div className="owner-preview-meta">
                    <span>{props.t.modal.responseTime}: {listing.owner.response_time}</span>
                    <span>{props.t.explore.memberSinceShort} {new Date(listing.owner.joined_at).getFullYear()}</span>
                  </div>
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

      {selectedListing && (
        <ListingModal
          listing={selectedListing}
          rentalCount={props.rentals.filter((rental) => rental.listing === selectedListing.id).length}
          reviews={props.reviews.filter((r) => r.listing === selectedListing.id)}
          onMessageOwner={props.onMessageOwner}
          t={props.t}
          onClose={() => setSelectedListing(null)}
        />
      )}
    </main>
  );
}

function PostScreen(props: {
  form: typeof initialListingForm;
  isBusy: boolean;
  onChange: React.Dispatch<React.SetStateAction<typeof initialListingForm>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LISTING_IMAGE_BYTES) {
      window.alert("Please choose an image smaller than 5 MB.");
      event.target.value = "";
      return;
    }

    const imageUrl = await readFileAsDataUrl(file);
    props.onChange((current) => ({ ...current, image_url: imageUrl }));
    event.target.value = "";
  };

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
          <ListingImageField
            buttonLabel="Choose picture"
            helpText="Upload a photo instead of pasting a link."
            imageUrl={props.form.image_url}
            onChange={props.onChange}
            onFileChange={handleImageChange}
            placeholder="Add picture"
            removeLabel="Remove picture"
          />
          <button className="primary-button" disabled={props.isBusy} type="submit">
            {props.isBusy ? "Publishing..." : "Publish listing"}
          </button>
        </form>
      </section>
    </main>
  );
}

function ListingImageField(props: {
  buttonLabel: string;
  helpText: string;
  imageUrl: string;
  onChange: React.Dispatch<React.SetStateAction<typeof initialListingForm>>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  removeLabel: string;
}) {
  return (
    <div className="image-field">
      <div className="image-field-header">
        <span className="image-field-label">{props.placeholder}</span>
        {props.imageUrl ? (
          <button
            className="image-field-remove"
            onClick={() => props.onChange((current) => ({ ...current, image_url: "" }))}
            type="button"
          >
            {props.removeLabel}
          </button>
        ) : null}
      </div>
      <label className="image-field-picker">
        <input accept="image/*" onChange={props.onFileChange} type="file" />
        <span>{props.buttonLabel}</span>
      </label>
      <p className="image-field-help">{props.helpText}</p>
      {props.imageUrl ? (
        <div
          className="image-field-preview"
          style={{ backgroundImage: `linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.16)), url(${props.imageUrl})` }}
        />
      ) : null}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  t: typeof en;
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
          <p className="eyebrow">{props.t.profile.publicProfile}</p>
          <h2>{props.activeMember.full_name}</h2>
          <p className="lead">{props.activeMember.bio || props.t.profile.bioPlaceholder}</p>
        </div>
      </section>
      <section className="stats-grid">
        <StatCard
          label={props.t.profile.score}
          value={
            <span className="rating-line">
              <StarRating score={props.activeMember.score} />
            </span>
          }
        />
        <StatCard label={props.t.profile.reviews} value={props.activeMember.review_count} />
        <StatCard label={props.t.profile.listings} value={ownedListings.length} />
        <StatCard label={props.t.profile.rentals} value={rentalCount} />
      </section>
      <section className="surface">
        <div className="section-head">
          <h3>{props.t.profile.inventory}</h3>
          <p>{props.activeMember.city || props.t.profile.addCity}</p>
        </div>
        <div className="timeline">
          {ownedListings.map((listing) => (
            <div className="timeline-card" key={listing.id}>
              <div>
                <strong>{listing.title}</strong>
                <p>
                  EUR {listing.price_per_day}/{props.t.common.day} · {props.t.explore.categories[listing.category as keyof typeof props.t.explore.categories] ?? listing.category}
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

function MyPostsScreen(props: {
  activeMember: Member | null;
  listings: Listing[];
  form: typeof initialListingForm;
  isBusy: boolean;
  isDeleting: boolean;
  onChange: React.Dispatch<React.SetStateAction<typeof initialListingForm>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (id: number) => void;
  onTopUp: (amount: string) => void;
  pendingListing: PendingListingPreview | null;
  walletBalance: string;
  walletBusy: boolean;
  t: typeof en;
}) {
  const [showForm, setShowForm] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("25");
  const myListings = props.listings.filter(
    (listing) => listing.owner.id === props.activeMember?.id
  );
  const walletBalance = Number(props.walletBalance || 0);
  const postingAllowance = Math.floor(walletBalance / LISTING_POST_FEE);
  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_LISTING_IMAGE_BYTES) {
      window.alert("Please choose an image smaller than 5 MB.");
      event.target.value = "";
      return;
    }

    const imageUrl = await readFileAsDataUrl(file);
    props.onChange((current) => ({ ...current, image_url: imageUrl }));
    event.target.value = "";
  };

  return (
    <main className="screen">
      <section className="surface">
        <div className="my-posts-head">
          <div className="section-head">
            <h3>{props.t.myPosts.title}</h3>
            <p>{props.t.myPosts.subtitle}</p>
          </div>
          <div className="my-posts-actions">
            <button
              className="wallet-inline-button"
              onClick={() => setShowWalletModal(true)}
              type="button"
            >
              <span className="wallet-inline-balance">{walletBalance.toFixed(2)} EUR</span>
              <Wallet size={16} />
              <Plus size={16} />
            </button>
            <button
              className={showForm ? "secondary-button" : "primary-button"}
              onClick={() => {
                if (showForm) {
                  setShowForm(false);
                  return;
                }
                setShowWalletModal(true);
              }}
              type="button"
            >
              {showForm ? props.t.common.cancel : <><Plus size={16} /> {props.t.common.newListing}</>}
            </button>
          </div>
        </div>

        {showForm && (
          <form
            className="stack-form my-posts-form"
            onSubmit={(e) => { props.onSubmit(e); setShowForm(false); }}
          >
            <input
              placeholder={props.t.myPosts.placeholderTitle}
              value={props.form.title}
              onChange={(e) => props.onChange((c) => ({ ...c, title: e.target.value }))}
            />
            <textarea
              placeholder={props.t.myPosts.placeholderDesc}
              value={props.form.description}
              onChange={(e) => props.onChange((c) => ({ ...c, description: e.target.value }))}
            />
            <div className="split">
              <select
                value={props.form.category}
                onChange={(e) => props.onChange((c) => ({ ...c, category: e.target.value }))}
              >
                {categories.filter((cat) => cat !== "all").map((cat) => (
                  <option key={cat} value={cat}>
                    {props.t.explore.categories[cat as keyof typeof props.t.explore.categories]}
                  </option>
                ))}
              </select>
              <input
                placeholder={props.t.myPosts.placeholderCity}
                value={props.form.city}
                onChange={(e) => props.onChange((c) => ({ ...c, city: e.target.value }))}
              />
            </div>
            <div className="split">
              <input
                placeholder={props.t.myPosts.placeholderPrice}
                value={props.form.price_per_day}
                onChange={(e) => props.onChange((c) => ({ ...c, price_per_day: e.target.value }))}
              />
              <input
                placeholder={props.t.myPosts.placeholderDeposit}
                value={props.form.deposit}
                onChange={(e) => props.onChange((c) => ({ ...c, deposit: e.target.value }))}
              />
            </div>
            <ListingImageField
              buttonLabel={props.t.myPosts.chooseImage}
              helpText={props.t.myPosts.imageHelp}
              imageUrl={props.form.image_url}
              onChange={props.onChange}
              onFileChange={handleImageChange}
              placeholder={props.t.myPosts.placeholderImage}
              removeLabel={props.t.myPosts.removeImage}
            />
            <button className="primary-button" disabled={props.isBusy} type="submit">
              {props.isBusy ? props.t.common.publishing : props.t.common.publish}
            </button>
          </form>
        )}

        {showWalletModal ? (
          <WalletModal
            balance={walletBalance}
            canContinue={postingAllowance > 0}
            days={LISTING_POST_DAYS}
            fee={LISTING_POST_FEE}
            isBusy={props.walletBusy}
            onAmountChange={setTopUpAmount}
            onClose={() => setShowWalletModal(false)}
            onContinue={() => {
              setShowWalletModal(false);
              setShowForm(true);
            }}
            onTopUp={() => props.onTopUp(topUpAmount)}
            t={props.t}
            topUpAmount={topUpAmount}
          />
        ) : null}

        {myListings.length === 0 && !props.pendingListing ? (
          <div className="notice">{props.t.common.noListings}</div>
        ) : (
          <div className="listing-grid">
            {props.pendingListing ? (
              <article className="listing-card listing-card--pending">
                {props.pendingListing.image_url ? (
                  <div
                    className="listing-image"
                    style={{ backgroundImage: `url(${props.pendingListing.image_url})` }}
                  />
                ) : null}
                <div className="listing-body">
                  <div className="listing-top">
                    <strong>{props.pendingListing.title}</strong>
                    <span className="status-pill posting">{props.pendingListing.status}</span>
                  </div>
                  <p>{props.pendingListing.description}</p>
                  <div className="meta-stack">
                    <span className="tag">{props.t.explore.categories[props.pendingListing.category as keyof typeof props.t.explore.categories] ?? props.pendingListing.category}</span>
                    <span className="tag">{props.pendingListing.city}</span>
                    <span className="tag">€{props.pendingListing.price_per_day}/{props.t.common.day}</span>
                  </div>
                </div>
              </article>
            ) : null}
            {myListings.map((listing) => (
              <article className="listing-card" key={listing.id}>
                {getListingPhotos(listing)[0] && (
                  <div
                    className="listing-image"
                    style={{ backgroundImage: `url(${getListingPhotos(listing)[0]})` }}
                  />
                )}
                <div className="listing-body">
                  <div className="listing-top">
                    <strong>{listing.title}</strong>
                    <span className="status-pill live">{listing.status}</span>
                  </div>
                  <p>{listing.description}</p>
                  <div className="meta-stack">
                    <span className="tag">{props.t.explore.categories[listing.category as keyof typeof props.t.explore.categories] ?? listing.category}</span>
                    <span className="tag">{listing.city}</span>
                    <span className="tag">€{listing.price_per_day}/{props.t.common.day}</span>
                    <span className="tag muted">{getListingDurationLabel(listing.created_at)}</span>
                  </div>
                  <button
                    className="delete-button"
                    disabled={props.isDeleting}
                    onClick={() => props.onDelete(listing.id)}
                    type="button"
                  >
                    <Trash2 size={14} /> {props.t.common.delete}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function WalletModal(props: {
  balance: number;
  canContinue: boolean;
  days: number;
  fee: number;
  isBusy: boolean;
  onAmountChange: (value: string) => void;
  onClose: () => void;
  onContinue: () => void;
  onTopUp: () => void;
  t: typeof en;
  topUpAmount: string;
}) {
  const postingAllowance = Math.floor(props.balance / props.fee);

  return (
    <div className="modal-backdrop" onClick={props.onClose}>
      <div className="modal-center" onClick={(event) => event.stopPropagation()}>
        <section className="wallet-modal surface">
          <div className="wallet-modal-head">
            <div className="section-head">
              <h3>{props.t.myPosts.walletTitle}</h3>
              <p>{props.t.myPosts.walletPostingRule}</p>
            </div>
            <button className="modal-close" onClick={props.onClose} type="button">
              <X size={20} />
            </button>
          </div>
          <div className="wallet-summary wallet-summary--modal">
            <article className="wallet-card">
              <span className="wallet-label">{props.t.myPosts.walletBalance}</span>
              <strong>EUR {props.balance.toFixed(2)}</strong>
            </article>
            <article className="wallet-card">
              <span className="wallet-label">{props.t.myPosts.walletAllowance}</span>
              <strong>{postingAllowance} items</strong>
            </article>
            <article className="wallet-card">
              <span className="wallet-label">{props.t.myPosts.walletDuration}</span>
              <strong>{props.days} days each</strong>
            </article>
          </div>
          <div className="wallet-topup">
            <input
              min="1"
              onChange={(event) => props.onAmountChange(event.target.value)}
              placeholder={props.t.myPosts.walletAmount}
              step="1"
              type="number"
              value={props.topUpAmount}
            />
            <button className="primary-button" disabled={props.isBusy} onClick={props.onTopUp} type="button">
              {props.t.myPosts.walletAdd}
            </button>
          </div>
          <div className="wallet-modal-actions">
            <button className="secondary-button" onClick={props.onClose} type="button">
              {props.t.common.cancel}
            </button>
            <button className="primary-button" disabled={!props.canContinue} onClick={props.onContinue} type="button">
              {props.t.myPosts.walletContinue}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

const OFFER_THREADS_STORAGE_KEY = "amonzi-offer-threads-v1";

type OfferDealState = "pending" | "accepted" | "declined";

type OfferMessage = {
  id: string;
  sender: "me" | "them" | "system";
  kind: "text" | "deal";
  text?: string;
  created_at: string;
  deal?: {
    title: string;
    amount: string;
    deposit: string;
    dateRange: string;
    note: string;
    state: OfferDealState;
  };
};

type OfferThread = {
  messages: OfferMessage[];
};

function describeRentalStatus(status: Rental["status"]) {
  if (status === "completed") return "Completed rental";
  if (status === "active") return "Rental is active";
  if (status === "approved") return "Approved and ready";
  if (status === "cancelled") return "Rental was cancelled";
  return "New rental request";
}

function createOfferMessage(message: Omit<OfferMessage, "id" | "created_at"> & { created_at?: string }): OfferMessage {
  return {
    ...message,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: message.created_at ?? new Date().toISOString(),
  };
}

function buildSeedMessages(args: {
  counterpartName: string;
  dateRange: string;
  isOwner: boolean;
  listingTitle: string;
  rental: Rental;
}): OfferMessage[] {
  const renterInquiry = createOfferMessage({
    sender: args.isOwner ? "them" : "me",
    kind: "text",
    text: `Hi, I want to rent "${args.listingTitle}" for ${args.dateRange}. Is it available?`,
    created_at: args.rental.created_at,
  });

  const ownerReply = createOfferMessage({
    sender: args.isOwner ? "me" : "them",
    kind: "text",
    text:
      args.rental.status === "requested"
        ? "Yes, it is available. I sent the rental terms below."
        : args.rental.status === "cancelled"
          ? "This rental was cancelled, but we can discuss new dates if needed."
          : `Status update: ${describeRentalStatus(args.rental.status)}.`,
    created_at: new Date(Date.parse(args.rental.created_at) + 60_000).toISOString(),
  });

  const dealState: OfferDealState =
    args.rental.status === "cancelled"
      ? "declined"
      : args.rental.status === "approved" ||
          args.rental.status === "active" ||
          args.rental.status === "completed"
        ? "accepted"
        : "pending";

  const dealMessage = createOfferMessage({
    sender: args.isOwner ? "me" : "them",
    kind: "deal",
    created_at: new Date(Date.parse(args.rental.created_at) + 120_000).toISOString(),
    deal: {
      title: "Rental agreement",
      amount: args.rental.total_price,
      deposit: "Flexible",
      dateRange: args.dateRange,
      note:
        args.rental.status === "requested"
          ? "If this looks good, accept the agreement and we can lock it in."
          : "Agreement details for this rental.",
      state: dealState,
    },
  });

  return [renterInquiry, ownerReply, dealMessage];
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getThreadPreview(message: OfferMessage | undefined, counterpartName: string) {
  if (!message) return "No messages yet.";
  if (message.kind === "deal") {
    if (message.sender === "me") return "You sent an agreement";
    if (message.sender === "them") return `${counterpartName} sent an agreement`;
    return "Agreement updated";
  }
  return message.text ?? "No messages yet.";
}

function OffersScreen(props: {
  activeMember: Member | null;
  listings: Listing[];
  rentals: Rental[];
  t: typeof en;
}) {
  const currentMemberId = props.activeMember?.id ?? null;
  const baseConversations = props.rentals
    .map((rental) => {
      const listing = props.listings.find((item) => item.id === rental.listing);
      if (!listing || !currentMemberId) {
        return null;
      }

      const isOwner = listing.owner.id === currentMemberId;
      const isRenter = rental.renter === currentMemberId;
      if (!isOwner && !isRenter) {
        return null;
      }

      return {
        id: rental.id,
        counterpartName: isOwner ? rental.renter_name : listing.owner.full_name,
        counterpartAvatar: isOwner ? "" : listing.owner.avatar_url,
        dateRange: `${rental.start_date} to ${rental.end_date}`,
        isOwner,
        listingTitle: rental.listing_title,
        listingId: rental.listing,
        status: rental.status,
        statusLabel: describeRentalStatus(rental.status),
        totalPrice: rental.total_price,
        updatedAt: rental.created_at,
        rental,
      };
    })
    .filter((conversation): conversation is NonNullable<typeof conversation> => Boolean(conversation));

  const [searchValue, setSearchValue] = useState("");
  const [composerValue, setComposerValue] = useState("");
  const [showDealForm, setShowDealForm] = useState(false);
  const [dealForm, setDealForm] = useState({
    title: "Rental agreement",
    amount: "",
    deposit: "",
    note: "",
  });
  const [threadState, setThreadState] = useState<Record<number, OfferThread>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = window.localStorage.getItem(OFFER_THREADS_STORAGE_KEY);
      if (!stored) return {};
      return JSON.parse(stored) as Record<number, OfferThread>;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThreadState((current) => {
      const next: Record<number, OfferThread> = {};
      let changed = false;
      baseConversations.forEach((conversation) => {
        if (!current[conversation.id]) {
          changed = true;
        }
        next[conversation.id] =
          current[conversation.id] ?? {
            messages: buildSeedMessages({
              counterpartName: conversation.counterpartName,
              dateRange: conversation.dateRange,
              isOwner: conversation.isOwner,
              listingTitle: conversation.listingTitle,
              rental: conversation.rental,
            }),
          };
      });
      if (Object.keys(current).length !== Object.keys(next).length) {
        changed = true;
      }
      return changed ? next : current;
    });
  }, [currentMemberId, props.listings, props.rentals]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(OFFER_THREADS_STORAGE_KEY, JSON.stringify(threadState));
  }, [threadState]);

  const conversations = baseConversations
    .map((conversation) => {
      const messages = threadState[conversation.id]?.messages ?? [];
      const lastMessage = messages[messages.length - 1];
      const pendingIncomingDeals = messages.filter(
        (message) =>
          message.kind === "deal" &&
          message.sender === "them" &&
          message.deal?.state === "pending"
      ).length;

      return {
        ...conversation,
        lastMessage,
        lastPreview: getThreadPreview(lastMessage, conversation.counterpartName),
        messages,
        pendingIncomingDeals,
        updatedAt: lastMessage?.created_at ?? conversation.updatedAt,
      };
    })
    .filter((conversation) => {
      const query = searchValue.trim().toLowerCase();
      if (!query) return true;
      return `${conversation.counterpartName} ${conversation.listingTitle}`.toLowerCase().includes(query);
    })
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

  const [activeConversationId, setActiveConversationId] = useState<number | null>(
    conversations[0]?.id ?? null
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveConversationId((current) => {
      if (current && conversations.some((conversation) => conversation.id === current)) {
        return current;
      }
      return conversations[0]?.id ?? null;
    });
  }, [conversations]);

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ??
    conversations[0] ??
    null;

  useEffect(() => {
    if (!activeConversation) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDealForm({
      title: "Rental agreement",
      amount: activeConversation.totalPrice,
      deposit: "",
      note: "",
    });
    setComposerValue("");
    setShowDealForm(false);
  }, [activeConversationId]);

  const updateConversationMessages = (
    conversationId: number,
    updater: (messages: OfferMessage[]) => OfferMessage[]
  ) => {
    setThreadState((current) => {
      const existing = current[conversationId]?.messages ?? [];
      return {
        ...current,
        [conversationId]: {
          messages: updater(existing),
        },
      };
    });
  };

  const sendMessage = () => {
    if (!activeConversation || !composerValue.trim()) return;
    const messageText = composerValue.trim();
    updateConversationMessages(activeConversation.id, (messages) => [
      ...messages,
      createOfferMessage({
        sender: "me",
        kind: "text",
        text: messageText,
      }),
    ]);
    setComposerValue("");
  };

  const sendDeal = () => {
    if (!activeConversation || !dealForm.amount.trim()) return;
    updateConversationMessages(activeConversation.id, (messages) => [
      ...messages,
      createOfferMessage({
        sender: "me",
        kind: "deal",
        deal: {
          title: dealForm.title.trim() || "Rental agreement",
          amount: dealForm.amount.trim(),
          deposit: dealForm.deposit.trim() || "Not set",
          dateRange: activeConversation.dateRange,
          note: dealForm.note.trim(),
          state: "pending",
        },
      }),
    ]);
    setShowDealForm(false);
    setDealForm((current) => ({ ...current, note: "" }));
  };

  const respondToDeal = (messageId: string, nextState: OfferDealState) => {
    if (!activeConversation) return;
    updateConversationMessages(activeConversation.id, (messages) => [
      ...messages.map((message) =>
        message.id === messageId && message.kind === "deal" && message.deal
          ? { ...message, deal: { ...message.deal, state: nextState } }
          : message
      ),
      createOfferMessage({
        sender: "system",
        kind: "text",
        text:
          nextState === "accepted"
            ? "Agreement accepted. You can now continue with final pickup details."
            : "Agreement declined. Send a new version if you want to renegotiate.",
      }),
    ]);
  };

  return (
    <main className="screen">
      <section className="surface">
        <div className="section-head">
          <h3>{props.t.offers.title}</h3>
          <p>{props.t.offers.subtitle}</p>
        </div>
        {conversations.length === 0 ? (
          <div className="notice">{props.t.offers.empty}</div>
        ) : (
          <div className="offers-layout offers-page">
            <aside className="offers-sidebar">
              <div className="offers-search">
                <input
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search conversations"
                  value={searchValue}
                />
              </div>

              <div className="offers-list" aria-label="Past conversations">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    className={`offers-thread${conversation.id === activeConversation?.id ? " active" : ""}`}
                    onClick={() => setActiveConversationId(conversation.id)}
                    type="button"
                  >
                    <div className="offers-thread-head">
                      <div className="avatar-ring offers-avatar">
                        {conversation.counterpartAvatar ? (
                          <img alt={conversation.counterpartName} src={conversation.counterpartAvatar} />
                        ) : (
                          <span>{conversation.counterpartName.charAt(0)}</span>
                        )}
                      </div>
                      <div className="offers-thread-copy">
                        <div className="offers-thread-row">
                          <strong>{conversation.counterpartName}</strong>
                          <small>{new Date(conversation.updatedAt).toLocaleDateString()}</small>
                        </div>
                        <span>{conversation.listingTitle}</span>
                        <p>{conversation.lastPreview}</p>
                        <div className="offers-thread-meta">
                          <span className={`status-pill ${conversation.status}`}>{conversation.status}</span>
                          {conversation.pendingIncomingDeals > 0 && (
                            <span className="offers-unread-badge">{conversation.pendingIncomingDeals} pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            {activeConversation && (
              <article className="offers-panel">
                <div className="offers-panel-head">
                  <div className="offers-panel-head-main">
                    <div className="avatar-ring offers-avatar offers-avatar-lg">
                      {activeConversation.counterpartAvatar ? (
                        <img alt={activeConversation.counterpartName} src={activeConversation.counterpartAvatar} />
                      ) : (
                        <span>{activeConversation.counterpartName.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <p className="modal-section-label">Conversation</p>
                      <h4>{activeConversation.counterpartName}</h4>
                      <p className="offers-panel-subtitle">{activeConversation.listingTitle}</p>
                    </div>
                  </div>
                  <span className={`status-pill ${activeConversation.status}`}>{activeConversation.status}</span>
                </div>

                <div className="offers-summary-grid">
                  <div className="modal-meta-item">
                    <span className="modal-meta-label">Dates</span>
                    <strong>{activeConversation.dateRange}</strong>
                  </div>
                  <div className="modal-meta-item">
                    <span className="modal-meta-label">Current total</span>
                    <strong>EUR {activeConversation.totalPrice}</strong>
                  </div>
                  <div className="modal-meta-item">
                    <span className="modal-meta-label">Role</span>
                    <strong>{activeConversation.isOwner ? "Owner" : "Renter"}</strong>
                  </div>
                </div>

                <div className="offers-thread-window">
                  <div className="offers-message-stack">
                    {activeConversation.messages.map((message) => {
                      const bubbleClass =
                        message.sender === "me"
                          ? "outgoing"
                          : message.sender === "them"
                            ? "incoming"
                            : "system";

                      return (
                        <div className={`offers-message ${bubbleClass}`} key={message.id}>
                          {message.kind === "deal" && message.deal ? (
                            <div className="offers-deal-card">
                              <div className="offers-deal-head">
                                <div>
                                  <small>{message.sender === "me" ? "You sent an agreement" : `${activeConversation.counterpartName} sent an agreement`}</small>
                                  <strong>{message.deal.title}</strong>
                                </div>
                                <span className={`offers-deal-state ${message.deal.state}`}>{message.deal.state}</span>
                              </div>
                              <div className="offers-deal-grid">
                                <div>
                                  <span>Amount</span>
                                  <strong>EUR {message.deal.amount}</strong>
                                </div>
                                <div>
                                  <span>Deposit</span>
                                  <strong>{message.deal.deposit}</strong>
                                </div>
                                <div>
                                  <span>Dates</span>
                                  <strong>{message.deal.dateRange}</strong>
                                </div>
                              </div>
                              {message.deal.note ? <p>{message.deal.note}</p> : null}
                              {message.sender === "them" && message.deal.state === "pending" ? (
                                <div className="offers-deal-actions">
                                  <button
                                    className="secondary-button"
                                    onClick={() => respondToDeal(message.id, "declined")}
                                    type="button"
                                  >
                                    Decline
                                  </button>
                                  <button
                                    className="primary-button"
                                    onClick={() => respondToDeal(message.id, "accepted")}
                                    type="button"
                                  >
                                    Accept agreement
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <>
                              <small>
                                {message.sender === "me"
                                  ? "You"
                                  : message.sender === "them"
                                    ? activeConversation.counterpartName
                                    : "Update"}
                              </small>
                              <p>{message.text}</p>
                            </>
                          )}
                          <span className="offers-message-time">{formatMessageTime(message.created_at)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="offers-composer">
                  <div className="offers-composer-actions">
                    <button
                      className={`secondary-button${showDealForm ? " active" : ""}`}
                      onClick={() => setShowDealForm((current) => !current)}
                      type="button"
                    >
                      {showDealForm ? "Close agreement" : "Send agreement"}
                    </button>
                  </div>

                  {showDealForm && (
                    <div className="offers-deal-form">
                      <div className="split">
                        <input
                          onChange={(event) => setDealForm((current) => ({ ...current, title: event.target.value }))}
                          placeholder="Agreement title"
                          value={dealForm.title}
                        />
                        <input
                          onChange={(event) => setDealForm((current) => ({ ...current, amount: event.target.value }))}
                          placeholder="Total amount"
                          value={dealForm.amount}
                        />
                      </div>
                      <div className="split">
                        <input
                          onChange={(event) => setDealForm((current) => ({ ...current, deposit: event.target.value }))}
                          placeholder="Deposit"
                          value={dealForm.deposit}
                        />
                        <input disabled value={activeConversation.dateRange} />
                      </div>
                      <textarea
                        onChange={(event) => setDealForm((current) => ({ ...current, note: event.target.value }))}
                        placeholder="Agreement note"
                        value={dealForm.note}
                      />
                      <div className="offers-deal-form-actions">
                        <button className="primary-button" onClick={sendDeal} type="button">
                          Send agreement
                        </button>
                      </div>
                    </div>
                  )}

                  <textarea
                    className="offers-composer-input"
                    onChange={(event) => setComposerValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Write a message..."
                    value={composerValue}
                  />
                  <div className="offers-composer-footer">
                    <p>Keep the thread short. Use agreements only when terms are clear.</p>
                    <button className="primary-button" disabled={!composerValue.trim()} onClick={sendMessage} type="button">
                      Send
                    </button>
                  </div>
                </div>
              </article>
            )}
          </div>
        )}
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

function ListingModal(props: {
  listing: Listing;
  rentalCount: number;
  reviews: Review[];
  onMessageOwner: (listing: Listing) => void;
  t: typeof en;
  onClose: () => void;
}) {
  const { listing, rentalCount, reviews, onMessageOwner, t, onClose } = props;
  const galleryRef = useRef<HTMLDivElement>(null);
  const photos = getListingPhotos(listing);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const hasListingRating = hasListingReviews(listing);
  const hasOwnerRating = Number(listing.owner.score) > 0;

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setActivePhotoIndex(0); }, [listing.id]);

  const handleGalleryScroll = () => {
    if (!galleryRef.current) return;
    const slides = Array.from(galleryRef.current.children) as HTMLElement[];
    if (slides.length === 0) return;

    const scrollLeft = galleryRef.current.scrollLeft;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    slides.forEach((slide, index) => {
      const distance = Math.abs(slide.offsetLeft - scrollLeft);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setActivePhotoIndex(closestIndex);
  };

  const scrollToPhoto = (index: number) => {
    if (!galleryRef.current) return;
    const slides = Array.from(galleryRef.current.children) as HTMLElement[];
    const targetSlide = slides[index];
    if (!targetSlide) return;

    galleryRef.current.scrollTo({
      left: targetSlide.offsetLeft,
      behavior: "smooth",
    });
    setActivePhotoIndex(index);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-center">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-scroll">
          <button className="modal-close" onClick={onClose} type="button" aria-label={t.modal.close}>
            <X size={20} />
          </button>

          {/* ── Photos ── */}
          {photos.length > 0 && (
            <>
              <div className="modal-gallery-frame">
                <div className="modal-gallery" ref={galleryRef} onScroll={handleGalleryScroll}>
                  {photos.map((photo, index) => (
                    <div className="modal-gallery-image" key={`${listing.id}-${index}`} style={{ backgroundImage: `url(${photo})` }} />
                  ))}
                </div>
              </div>
              {photos.length > 1 && (
                <div className="modal-gallery-dots">
                  {photos.map((_, index) => (
                    <button
                      aria-label={`Show photo ${index + 1}`}
                      className={`modal-gallery-dot${index === activePhotoIndex ? " active" : ""}`}
                      key={`${listing.id}-dot-${index}`}
                      onClick={() => scrollToPhoto(index)}
                      type="button"
                    />
                  ))}
                </div>
              )}
            </>
          )}

          <div className="modal-body">
          {/* ── Title + price ── */}
          <div className="modal-header-block">
            <p className="modal-kicker">{t.explore.categories[listing.category as keyof typeof t.explore.categories] ?? listing.category}</p>
            <div className="modal-header-row">
              <div>
                <h2 className="modal-title">{listing.title}</h2>
              </div>
              <div className="modal-price">
                <div className="modal-price-line">
                  <strong>EUR {listing.price_per_day}</strong>
                  <span className="modal-price-unit">{t.modal.perDay}</span>
                </div>
              </div>
            </div>
            {(hasListingRating || hasOwnerRating) && (
              <div className="modal-rating-grid">
                {hasListingRating && (
                  <div className="modal-rating">
                    <div className="modal-rating-value">
                      <StarRating score={listing.rating} />
                      <span>({listing.review_count})</span>
                    </div>
                    <p className="modal-rating-notes">Quality · Condition</p>
                  </div>
                )}
                {!hasListingRating && (
                  <div className="modal-rating">
                    <div className="modal-rating-value modal-rating-value--empty">
                      <span>0 reviews</span>
                    </div>
                    <p className="modal-rating-notes">Quality · Condition</p>
                  </div>
                )}
                {hasOwnerRating && (
                  <div className="modal-rating">
                    <div className="modal-rating-value">
                      <StarRating score={listing.owner.score} />
                      <span>({listing.owner.review_count})</span>
                    </div>
                    <p className="modal-rating-notes">Kindness · Communication</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Details ── */}
          <div className="modal-meta">
            <div className="modal-meta-item">
              <span className="modal-meta-label">Location</span>
              <strong><MapPin size={15} /> {listing.city}</strong>
            </div>
            <div className="modal-meta-item">
              <span className="modal-meta-label">{t.modal.deposit}</span>
              <strong><Shield size={15} /> EUR {listing.deposit}</strong>
            </div>
            <div className="modal-meta-item">
              <span className="modal-meta-label">{t.modal.listed}</span>
              <strong><CalendarDays size={15} /> {new Date(listing.created_at).toLocaleDateString()}</strong>
            </div>
            <div className="modal-meta-item">
              <span className="modal-meta-label">Rent times</span>
              <strong><Repeat size={15} /> {rentalCount}</strong>
            </div>
            <div className="modal-meta-item">
              <span className="modal-meta-label">Clicks</span>
              <strong><Eye size={15} /> {formatCompactCount(listing.views_count)}</strong>
            </div>
          </div>

          {/* ── Description ── */}
          <div className="modal-section">
            <p className="modal-section-label">About this listing</p>
            <p className="modal-desc">{listing.description}</p>
            <button
              className="secondary-button modal-message-button"
              onClick={() => {
                onMessageOwner(listing);
                onClose();
              }}
              type="button"
            >
              <MessageSquare size={16} />
              {t.modal.messageOwner}
            </button>
          </div>

          <div className="modal-divider" />

          {/* ── Owner ── */}
          <div className="modal-owner">
            <div className="avatar-ring">
              <img alt={listing.owner.full_name} src={listing.owner.avatar_url} />
            </div>
            <div>
              <p className="modal-owner-label">{t.modal.owner}</p>
              <strong>{listing.owner.full_name}</strong>
              <div className="modal-owner-meta">
                <span>{listing.owner.review_count} {t.common.reviews}</span>
                {listing.owner.response_time && <span>{t.modal.responseTime}: {listing.owner.response_time}</span>}
                {listing.owner.joined_at && <span>{t.modal.memberSince}: {new Date(listing.owner.joined_at).getFullYear()}</span>}
              </div>
            </div>
          </div>

          <div className="modal-divider" />

          {/* ── Reviews ── */}
          <div className="modal-reviews">
            <h4>{t.modal.reviews} ({reviews.length})</h4>
            {reviews.length === 0 ? (
              <p className="modal-no-reviews">{t.modal.noReviews}</p>
            ) : (
              <div className="modal-reviews-list">
                {reviews.map((review) => (
                  <div className="modal-review-card" key={review.id}>
                    <div className="modal-review-top">
                      <strong>{review.author_name}</strong>
                      <StarRating score={review.rating} />
                    </div>
                    <p>{review.comment}</p>
                    <small>{new Date(review.created_at).toLocaleDateString()}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function formatCompactCount(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export default App;
