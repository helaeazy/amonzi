from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0004_listing_photo_gallery"),
    ]

    operations = [
        migrations.AlterField(
            model_name="listing",
            name="image_url",
            field=models.TextField(blank=True),
        ),
    ]
