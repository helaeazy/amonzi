from django.contrib import admin

from apps.marketplace.models import Listing, Member, Rental, Review


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ("full_name", "email", "city", "response_time", "joined_at")
    search_fields = ("full_name", "email", "city")


@admin.register(Listing)
class ListingAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "category", "city", "price_per_day", "status")
    list_filter = ("category", "status", "city")
    search_fields = ("title", "description", "owner__full_name")


@admin.register(Rental)
class RentalAdmin(admin.ModelAdmin):
    list_display = ("listing", "renter", "start_date", "end_date", "status")
    list_filter = ("status",)
    search_fields = ("listing__title", "renter__full_name")


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("listing", "reviewed_member", "author", "rating", "created_at")
    list_filter = ("rating",)
    search_fields = (
        "listing__title",
        "author__full_name",
        "reviewed_member__full_name",
    )
