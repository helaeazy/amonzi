import datetime

from django.db import migrations, models


def populate_member_email(apps, schema_editor):
    Member = apps.get_model("marketplace", "Member")
    updates = {
        "Marta Jansone": "marta@amonzi.demo",
        "Andrejs Ozols": "andrejs@amonzi.demo",
        "Elina Berzina": "elina@amonzi.demo",
        "Toms Liepa": "toms@amonzi.demo",
    }
    for member in Member.objects.all():
        member.email = updates.get(member.full_name, f"user-{member.pk}@amonzi.demo")
        if member.city is None:
            member.city = ""
        if not member.joined_at:
            member.joined_at = datetime.date.today()
        member.save(update_fields=["email", "city", "joined_at"])


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="member",
            name="email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
        migrations.AlterField(
            model_name="member",
            name="city",
            field=models.CharField(blank=True, default="", max_length=120),
        ),
        migrations.AlterField(
            model_name="member",
            name="joined_at",
            field=models.DateField(default=datetime.date.today),
        ),
        migrations.RunPython(populate_member_email, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="member",
            name="email",
            field=models.EmailField(max_length=254, unique=True),
        ),
    ]
