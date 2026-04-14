from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.marketplace.views import (
    ListingViewSet,
    MemberViewSet,
    OverviewView,
    RentalViewSet,
    ReviewViewSet,
)

router = DefaultRouter()
router.register("members", MemberViewSet, basename="member")
router.register("listings", ListingViewSet, basename="listing")
router.register("rentals", RentalViewSet, basename="rental")
router.register("reviews", ReviewViewSet, basename="review")

urlpatterns = [
    path("overview/", OverviewView.as_view(), name="overview"),
    path("", include(router.urls)),
]
