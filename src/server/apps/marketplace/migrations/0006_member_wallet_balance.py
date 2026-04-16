from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0005_listing_image_url_text"),
    ]

    operations = [
        migrations.AddField(
            model_name="member",
            name="wallet_balance",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=8),
        ),
    ]
