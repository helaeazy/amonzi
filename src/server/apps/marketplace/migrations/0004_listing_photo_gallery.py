from django.db import migrations, models


def seed_listing_photo_galleries(apps, schema_editor):
    Listing = apps.get_model("marketplace", "Listing")

    galleries = {
        "Fujifilm Mirrorless Camera Kit": [
            "https://images.unsplash.com/photo-1516035069371-29a1b244cc32",
            "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
            "https://images.unsplash.com/photo-1495707902641-75cac588d2e9",
        ],
        "Inflatable Paddle Board Set": [
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
            "https://images.unsplash.com/photo-1500375592092-40eb2168fd21",
            "https://images.unsplash.com/photo-1501785888041-af3ef285b470",
        ],
        "LED Light Panels x2": [
            "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4",
            "https://images.unsplash.com/photo-1516321318423-f06f85e504b3",
            "https://images.unsplash.com/photo-1521572267360-ee0c2909d518",
        ],
        "Pressure Washer": [
            "https://images.unsplash.com/photo-1581578731548-c64695cc6952",
            "https://images.unsplash.com/photo-1511884642898-4c92249e20b6",
            "https://images.unsplash.com/photo-1504384308090-c894fdcc538d",
        ],
        "Foldable Event Tables": [
            "https://images.unsplash.com/photo-1511578314322-379afb476865",
            "https://images.unsplash.com/photo-1517457373958-b7bdd4587205",
            "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3",
        ],
    }

    for listing in Listing.objects.all():
        photo_urls = galleries.get(listing.title) or ([listing.image_url] if listing.image_url else [])
        Listing.objects.filter(pk=listing.pk).update(photo_urls=photo_urls)


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0003_listing_engagement_and_more_reviews"),
    ]

    operations = [
        migrations.AddField(
            model_name="listing",
            name="photo_urls",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(seed_listing_photo_galleries, migrations.RunPython.noop),
    ]
