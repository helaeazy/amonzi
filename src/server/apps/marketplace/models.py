from datetime import date
from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Avg, Count


class Member(models.Model):
    full_name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    city = models.CharField(max_length=120, blank=True, default="")
    bio = models.TextField(blank=True)
    avatar_url = models.URLField(blank=True)
    response_time = models.CharField(max_length=60, default="within 1 hour")
    joined_at = models.DateField(default=date.today)

    class Meta:
        ordering = ["full_name"]

    def __str__(self) -> str:
        return self.full_name

    @property
    def score(self) -> Decimal:
        rating = self.received_reviews.aggregate(value=Avg("rating"))["value"]
        if rating is None:
            return Decimal("5.0")
        return Decimal(str(round(rating, 1)))

    @property
    def review_count(self) -> int:
        value = self.received_reviews.aggregate(value=Count("id"))["value"]
        return int(value or 0)


class Listing(models.Model):
    class Category(models.TextChoices):
        TOOLS = "tools", "Tools"
        VEHICLES = "vehicles", "Vehicles"
        ELECTRONICS = "electronics", "Electronics"
        EVENTS = "events", "Events"
        HOME = "home", "Home"
        OUTDOOR = "outdoor", "Outdoor"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        LIVE = "live", "Live"
        PAUSED = "paused", "Paused"

    owner = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="listings")
    title = models.CharField(max_length=160)
    description = models.TextField()
    category = models.CharField(max_length=40, choices=Category.choices)
    city = models.CharField(max_length=120)
    price_per_day = models.DecimalField(max_digits=8, decimal_places=2)
    deposit = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    image_url = models.URLField(blank=True)
    photo_urls = models.JSONField(default=list, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.LIVE
    )
    views_count = models.PositiveIntegerField(default=0)
    clicks_count = models.PositiveIntegerField(default=0)
    shares_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "title"]

    def __str__(self) -> str:
        return self.title

    @property
    def rating(self) -> Decimal:
        rating = self.reviews.aggregate(value=Avg("rating"))["value"]
        if rating is None:
            return self.owner.score
        return Decimal(str(round(rating, 1)))

    @property
    def review_count(self) -> int:
        value = self.reviews.aggregate(value=Count("id"))["value"]
        return int(value or 0)


class Rental(models.Model):
    class Status(models.TextChoices):
        REQUESTED = "requested", "Requested"
        APPROVED = "approved", "Approved"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    listing = models.ForeignKey(
        Listing, on_delete=models.CASCADE, related_name="rentals"
    )
    renter = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="rentals")
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.REQUESTED
    )
    total_price = models.DecimalField(max_digits=9, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date", "-created_at"]

    def __str__(self) -> str:
        return f"{self.listing.title} for {self.renter.full_name}"


class Review(models.Model):
    rental = models.OneToOneField(
        Rental, on_delete=models.CASCADE, related_name="review"
    )
    listing = models.ForeignKey(
        Listing, on_delete=models.CASCADE, related_name="reviews"
    )
    author = models.ForeignKey(
        Member, on_delete=models.CASCADE, related_name="written_reviews"
    )
    reviewed_member = models.ForeignKey(
        Member, on_delete=models.CASCADE, related_name="received_reviews"
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.rating} for {self.reviewed_member.full_name}"
