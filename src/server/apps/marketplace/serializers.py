from rest_framework import serializers

from apps.marketplace.models import Listing, Member, Rental, Review


class MemberSerializer(serializers.ModelSerializer):
    score = serializers.DecimalField(max_digits=2, decimal_places=1, read_only=True)
    review_count = serializers.IntegerField(read_only=True)
    listing_count = serializers.IntegerField(source="listings.count", read_only=True)

    class Meta:
        model = Member
        fields = [
            "id",
            "full_name",
            "city",
            "bio",
            "avatar_url",
            "response_time",
            "joined_at",
            "score",
            "review_count",
            "listing_count",
        ]


class ReviewSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.full_name", read_only=True)
    reviewed_member_name = serializers.CharField(
        source="reviewed_member.full_name", read_only=True
    )

    class Meta:
        model = Review
        fields = [
            "id",
            "rental",
            "listing",
            "author",
            "author_name",
            "reviewed_member",
            "reviewed_member_name",
            "rating",
            "comment",
            "created_at",
        ]


class ListingSerializer(serializers.ModelSerializer):
    owner = MemberSerializer(read_only=True)
    owner_id = serializers.PrimaryKeyRelatedField(
        queryset=Member.objects.all(), source="owner", write_only=True
    )
    rating = serializers.DecimalField(max_digits=2, decimal_places=1, read_only=True)
    review_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Listing
        fields = [
            "id",
            "title",
            "description",
            "category",
            "city",
            "price_per_day",
            "deposit",
            "image_url",
            "status",
            "created_at",
            "owner",
            "owner_id",
            "rating",
            "review_count",
        ]


class RentalSerializer(serializers.ModelSerializer):
    listing_title = serializers.CharField(source="listing.title", read_only=True)
    renter_name = serializers.CharField(source="renter.full_name", read_only=True)

    class Meta:
        model = Rental
        fields = [
            "id",
            "listing",
            "listing_title",
            "renter",
            "renter_name",
            "start_date",
            "end_date",
            "status",
            "total_price",
            "created_at",
        ]


class OverviewSerializer(serializers.Serializer):
    featured_listings = ListingSerializer(many=True)
    top_members = MemberSerializer(many=True)
    recent_reviews = ReviewSerializer(many=True)
    stats = serializers.DictField()
