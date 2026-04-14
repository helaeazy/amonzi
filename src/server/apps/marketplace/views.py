from rest_framework import status, viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.marketplace.models import Listing, Member, Rental, Review
from apps.marketplace.serializers import (
    ListingSerializer,
    MemberSerializer,
    OverviewSerializer,
    RentalSerializer,
    ReviewSerializer,
)


@api_view(["GET"])
def health_check(request):
    return Response({"status": "ok", "service": "amonzi-server"})


class MemberViewSet(viewsets.ModelViewSet):
    serializer_class = MemberSerializer

    def get_queryset(self):
        queryset = Member.objects.all()
        email = self.request.query_params.get("email")
        if email:
            queryset = queryset.filter(email__iexact=email)
        return queryset


class ListingViewSet(viewsets.ModelViewSet):
    serializer_class = ListingSerializer

    def get_queryset(self):
        queryset = Listing.objects.select_related("owner").all()
        category = self.request.query_params.get("category")
        city = self.request.query_params.get("city")
        if category:
            queryset = queryset.filter(category=category)
        if city:
            queryset = queryset.filter(city__iexact=city)
        return queryset


class RentalViewSet(viewsets.ModelViewSet):
    queryset = Rental.objects.select_related("listing", "renter").all()
    serializer_class = RentalSerializer


class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.select_related(
        "author", "reviewed_member", "listing", "rental"
    ).all()
    serializer_class = ReviewSerializer

    def create(self, request, *args, **kwargs):
        rental = Rental.objects.select_related("listing", "renter").get(
            pk=request.data["rental"]
        )
        if rental.status != Rental.Status.COMPLETED:
            return Response(
                {"detail": "Reviews can only be left after a completed rental."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.data["listing"] = rental.listing_id
        request.data["reviewed_member"] = rental.listing.owner_id
        return super().create(request, *args, **kwargs)


class OverviewView(APIView):
    def get(self, request):
        featured_listings = Listing.objects.select_related("owner")[:6]
        top_members = sorted(
            Member.objects.all(), key=lambda member: member.score, reverse=True
        )[:5]
        recent_reviews = Review.objects.select_related(
            "author", "reviewed_member", "listing"
        )[:6]
        stats = {
            "members": Member.objects.count(),
            "live_listings": Listing.objects.filter(status=Listing.Status.LIVE).count(),
            "completed_rentals": Rental.objects.filter(
                status=Rental.Status.COMPLETED
            ).count(),
            "reviews": Review.objects.count(),
        }
        serializer = OverviewSerializer(
            {
                "featured_listings": featured_listings,
                "top_members": top_members,
                "recent_reviews": recent_reviews,
                "stats": stats,
            }
        )
        return Response(serializer.data)
