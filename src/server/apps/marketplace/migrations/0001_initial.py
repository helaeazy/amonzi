import datetime
from decimal import Decimal

from django.db import migrations, models
import django.core.validators


def seed_demo_data(apps, schema_editor):
    Member = apps.get_model("marketplace", "Member")
    Listing = apps.get_model("marketplace", "Listing")
    Rental = apps.get_model("marketplace", "Rental")
    Review = apps.get_model("marketplace", "Review")

    members = [
        Member.objects.create(
            full_name="Marta Jansone",
            city="Riga",
            bio="Reliable host with clean gear and quick replies.",
            avatar_url="https://images.unsplash.com/photo-1494790108377-be9c29b29330",
            response_time="within 15 minutes",
            joined_at=datetime.date(2023, 6, 3),
        ),
        Member.objects.create(
            full_name="Andrejs Ozols",
            city="Jurmala",
            bio="Outdoor and event rentals for weekend plans.",
            avatar_url="https://images.unsplash.com/photo-1500648767791-00dcc994a43e",
            response_time="within 30 minutes",
            joined_at=datetime.date(2022, 9, 14),
        ),
        Member.objects.create(
            full_name="Elina Berzina",
            city="Riga",
            bio="Photographer renting cameras, lights, and tripods.",
            avatar_url="https://images.unsplash.com/photo-1438761681033-6461ffad8d80",
            response_time="within 1 hour",
            joined_at=datetime.date(2024, 1, 20),
        ),
        Member.objects.create(
            full_name="Toms Liepa",
            city="Liepaja",
            bio="Small tools, movers kit, and party extras.",
            avatar_url="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d",
            response_time="within 45 minutes",
            joined_at=datetime.date(2023, 11, 9),
        ),
    ]

    listings = [
        Listing.objects.create(
            owner=members[0],
            title="Fujifilm Mirrorless Camera Kit",
            description="Camera body, two lenses, spare battery, and charger for day shoots.",
            category="electronics",
            city="Riga",
            price_per_day=Decimal("32.00"),
            deposit=Decimal("150.00"),
            image_url="https://images.unsplash.com/photo-1516035069371-29a1b244cc32",
        ),
        Listing.objects.create(
            owner=members[1],
            title="Inflatable Paddle Board Set",
            description="Board, paddle, pump, dry bag, and life vest.",
            category="outdoor",
            city="Jurmala",
            price_per_day=Decimal("24.00"),
            deposit=Decimal("80.00"),
            image_url="https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
        ),
        Listing.objects.create(
            owner=members[2],
            title="LED Light Panels x2",
            description="Portable light kit for interviews, reels, and small product shoots.",
            category="electronics",
            city="Riga",
            price_per_day=Decimal("18.00"),
            deposit=Decimal("60.00"),
            image_url="https://images.unsplash.com/photo-1492691527719-9d1e07e534b4",
        ),
        Listing.objects.create(
            owner=members[3],
            title="Pressure Washer",
            description="Great for cars, patios, and spring cleanup jobs.",
            category="tools",
            city="Liepaja",
            price_per_day=Decimal("21.00"),
            deposit=Decimal("70.00"),
            image_url="https://images.unsplash.com/photo-1581578731548-c64695cc6952",
        ),
        Listing.objects.create(
            owner=members[0],
            title="Foldable Event Tables",
            description="Set of 4 sturdy tables for pop-ups, birthdays, and markets.",
            category="events",
            city="Riga",
            price_per_day=Decimal("28.00"),
            deposit=Decimal("100.00"),
            image_url="https://images.unsplash.com/photo-1511578314322-379afb476865",
        ),
    ]

    rentals = [
        Rental.objects.create(
            listing=listings[0],
            renter=members[2],
            start_date=datetime.date(2026, 3, 2),
            end_date=datetime.date(2026, 3, 3),
            status="completed",
            total_price=Decimal("64.00"),
        ),
        Rental.objects.create(
            listing=listings[1],
            renter=members[0],
            start_date=datetime.date(2026, 3, 11),
            end_date=datetime.date(2026, 3, 12),
            status="completed",
            total_price=Decimal("48.00"),
        ),
        Rental.objects.create(
            listing=listings[3],
            renter=members[1],
            start_date=datetime.date(2026, 4, 18),
            end_date=datetime.date(2026, 4, 19),
            status="approved",
            total_price=Decimal("21.00"),
        ),
        Rental.objects.create(
            listing=listings[4],
            renter=members[3],
            start_date=datetime.date(2026, 3, 20),
            end_date=datetime.date(2026, 3, 21),
            status="completed",
            total_price=Decimal("56.00"),
        ),
    ]

    Review.objects.create(
        rental=rentals[0],
        listing=listings[0],
        author=members[2],
        reviewed_member=members[0],
        rating=5,
        comment="Gear was clean, pickup was fast, and the owner was easy to reach.",
    )
    Review.objects.create(
        rental=rentals[1],
        listing=listings[1],
        author=members[0],
        reviewed_member=members[1],
        rating=4,
        comment="Everything matched the listing and the whole handoff was smooth.",
    )


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Member",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("full_name", models.CharField(max_length=120)),
                ("city", models.CharField(max_length=120)),
                ("bio", models.TextField(blank=True)),
                ("avatar_url", models.URLField(blank=True)),
                ("response_time", models.CharField(default="within 1 hour", max_length=60)),
                ("joined_at", models.DateField()),
            ],
            options={"ordering": ["full_name"]},
        ),
        migrations.CreateModel(
            name="Listing",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=160)),
                ("description", models.TextField()),
                ("category", models.CharField(choices=[("tools", "Tools"), ("vehicles", "Vehicles"), ("electronics", "Electronics"), ("events", "Events"), ("home", "Home"), ("outdoor", "Outdoor"), ("other", "Other")], max_length=40)),
                ("city", models.CharField(max_length=120)),
                ("price_per_day", models.DecimalField(decimal_places=2, max_digits=8)),
                ("deposit", models.DecimalField(decimal_places=2, default=0, max_digits=8)),
                ("image_url", models.URLField(blank=True)),
                ("status", models.CharField(choices=[("live", "Live"), ("paused", "Paused")], default="live", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("owner", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="listings", to="marketplace.member")),
            ],
            options={"ordering": ["-created_at", "title"]},
        ),
        migrations.CreateModel(
            name="Rental",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("start_date", models.DateField()),
                ("end_date", models.DateField()),
                ("status", models.CharField(choices=[("requested", "Requested"), ("approved", "Approved"), ("active", "Active"), ("completed", "Completed"), ("cancelled", "Cancelled")], default="requested", max_length=20)),
                ("total_price", models.DecimalField(decimal_places=2, max_digits=9)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("listing", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="rentals", to="marketplace.listing")),
                ("renter", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="rentals", to="marketplace.member")),
            ],
            options={"ordering": ["-start_date", "-created_at"]},
        ),
        migrations.CreateModel(
            name="Review",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("rating", models.PositiveSmallIntegerField(validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)])),
                ("comment", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("author", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="written_reviews", to="marketplace.member")),
                ("listing", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="reviews", to="marketplace.listing")),
                ("rental", models.OneToOneField(on_delete=models.deletion.CASCADE, related_name="review", to="marketplace.rental")),
                ("reviewed_member", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="received_reviews", to="marketplace.member")),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.RunPython(seed_demo_data, migrations.RunPython.noop),
    ]
