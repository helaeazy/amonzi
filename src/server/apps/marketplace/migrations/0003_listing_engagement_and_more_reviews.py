import datetime
from decimal import Decimal

from django.db import migrations, models


def seed_listing_metrics_and_reviews(apps, schema_editor):
    Member = apps.get_model("marketplace", "Member")
    Listing = apps.get_model("marketplace", "Listing")
    Rental = apps.get_model("marketplace", "Rental")
    Review = apps.get_model("marketplace", "Review")

    metrics_by_title = {
        "Fujifilm Mirrorless Camera Kit": {"views_count": 842, "clicks_count": 173, "shares_count": 28},
        "Inflatable Paddle Board Set": {"views_count": 691, "clicks_count": 141, "shares_count": 19},
        "LED Light Panels x2": {"views_count": 514, "clicks_count": 119, "shares_count": 13},
        "Pressure Washer": {"views_count": 463, "clicks_count": 96, "shares_count": 8},
        "Foldable Event Tables": {"views_count": 608, "clicks_count": 132, "shares_count": 17},
    }

    for listing in Listing.objects.all():
        metrics = metrics_by_title.get(listing.title, {"views_count": 240, "clicks_count": 44, "shares_count": 6})
        Listing.objects.filter(pk=listing.pk).update(**metrics)

    members = {member.full_name: member for member in Member.objects.all()}
    listings = {listing.title: listing for listing in Listing.objects.select_related("owner").all()}

    extra_reviews = [
        {
            "listing_title": "Fujifilm Mirrorless Camera Kit",
            "renter": "Andrejs Ozols",
            "start_date": datetime.date(2026, 2, 14),
            "end_date": datetime.date(2026, 2, 15),
            "total_price": Decimal("64.00"),
            "rating": 5,
            "comment": "Battery was charged, lenses were spotless, and Marta explained the setup in two minutes.",
        },
        {
            "listing_title": "Fujifilm Mirrorless Camera Kit",
            "renter": "Toms Liepa",
            "start_date": datetime.date(2026, 1, 26),
            "end_date": datetime.date(2026, 1, 27),
            "total_price": Decimal("64.00"),
            "rating": 4,
            "comment": "Pickup was quick and the kit matched the photos. Solid option for a one day shoot.",
        },
        {
            "listing_title": "Inflatable Paddle Board Set",
            "renter": "Elina Berzina",
            "start_date": datetime.date(2026, 2, 8),
            "end_date": datetime.date(2026, 2, 9),
            "total_price": Decimal("48.00"),
            "rating": 5,
            "comment": "Board was easy to inflate, everything fit in the bag, and Andrejs replied fast.",
        },
        {
            "listing_title": "Inflatable Paddle Board Set",
            "renter": "Toms Liepa",
            "start_date": datetime.date(2026, 1, 18),
            "end_date": datetime.date(2026, 1, 19),
            "total_price": Decimal("48.00"),
            "rating": 4,
            "comment": "Good condition set and clear meetup instructions. Great for a casual weekend ride.",
        },
        {
            "listing_title": "LED Light Panels x2",
            "renter": "Marta Jansone",
            "start_date": datetime.date(2026, 2, 20),
            "end_date": datetime.date(2026, 2, 21),
            "total_price": Decimal("36.00"),
            "rating": 5,
            "comment": "Light output was strong, stands were stable, and Elina packed the kit neatly.",
        },
        {
            "listing_title": "LED Light Panels x2",
            "renter": "Andrejs Ozols",
            "start_date": datetime.date(2026, 1, 12),
            "end_date": datetime.date(2026, 1, 13),
            "total_price": Decimal("36.00"),
            "rating": 4,
            "comment": "Perfect for interview lighting. Pickup and return both took less than ten minutes.",
        },
        {
            "listing_title": "Pressure Washer",
            "renter": "Marta Jansone",
            "start_date": datetime.date(2026, 2, 3),
            "end_date": datetime.date(2026, 2, 4),
            "total_price": Decimal("42.00"),
            "rating": 4,
            "comment": "Strong pressure and no issues with hoses. Toms was practical and easy to coordinate with.",
        },
        {
            "listing_title": "Pressure Washer",
            "renter": "Elina Berzina",
            "start_date": datetime.date(2026, 1, 7),
            "end_date": datetime.date(2026, 1, 8),
            "total_price": Decimal("42.00"),
            "rating": 5,
            "comment": "Worked exactly as expected for patio cleanup. The owner also shared a quick usage tip.",
        },
        {
            "listing_title": "Pressure Washer",
            "renter": "Andrejs Ozols",
            "start_date": datetime.date(2025, 12, 14),
            "end_date": datetime.date(2025, 12, 15),
            "total_price": Decimal("42.00"),
            "rating": 4,
            "comment": "Compact, powerful, and ready to go. Return process was just as smooth as pickup.",
        },
        {
            "listing_title": "Foldable Event Tables",
            "renter": "Andrejs Ozols",
            "start_date": datetime.date(2026, 2, 27),
            "end_date": datetime.date(2026, 2, 28),
            "total_price": Decimal("56.00"),
            "rating": 5,
            "comment": "Tables were clean and sturdy. Marta helped load them quickly and communication stayed clear.",
        },
        {
            "listing_title": "Foldable Event Tables",
            "renter": "Elina Berzina",
            "start_date": datetime.date(2026, 1, 30),
            "end_date": datetime.date(2026, 1, 31),
            "total_price": Decimal("56.00"),
            "rating": 4,
            "comment": "Very useful for a pop-up event. Everything folded down easily and fit the listing description.",
        },
    ]

    for item in extra_reviews:
        listing = listings.get(item["listing_title"])
        renter = members.get(item["renter"])
        if not listing or not renter:
            continue

        rental = Rental.objects.filter(
            listing=listing,
            renter=renter,
            start_date=item["start_date"],
            end_date=item["end_date"],
        ).first()
        if rental is None:
            rental = Rental.objects.create(
                listing=listing,
                renter=renter,
                start_date=item["start_date"],
                end_date=item["end_date"],
                status="completed",
                total_price=item["total_price"],
            )

        Review.objects.get_or_create(
            rental=rental,
            defaults={
                "listing": listing,
                "author": renter,
                "reviewed_member": listing.owner,
                "rating": item["rating"],
                "comment": item["comment"],
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0002_member_email_defaults"),
    ]

    operations = [
        migrations.AddField(
            model_name="listing",
            name="clicks_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="listing",
            name="shares_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="listing",
            name="views_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.RunPython(seed_listing_metrics_and_reviews, migrations.RunPython.noop),
    ]
